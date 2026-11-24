"""
La cobijita que M.A.D.R.E. le pone a Skulley cuando se queda dormido (Oscar, 2026-11-23).

Se corre en Blender sobre Character/SkulleyRad.blend, después de idles.py (usa su acción Dormir):
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
o en segundo plano (blender.exe -b <blend> --python <runner>). No guarda el .blend.

Es tela de verdad: una malla con simulación de tela (cloth) que cae sobre Skulley dormido (la pose del
primer cuadro de Dormir) chocando con sus piezas y con el piso. La caída se guarda como formas (shape keys)
de un solo objeto, `Cobija`, que el sitio recorre en orden (home/CobijaSkulley.jsx):
  - la base: la cobija plana y extendida, donde la suelta el drone;
  - cae_01 … cae_NN: la caída, cuadro por cuadro (CAIDA), hasta quedar acomodada sobre él;
  - inhala: igual de acomodada, con el pecho de Skulley arriba (lo más hondo de su respiración);
  - piso: tirada en el piso, lo que queda si Skulley desaparece de abajo (al despertar se la quita).
Sale en el mismo espacio que el personaje (metros, sus coordenadas): el sitio la pone en el grupo del modelo.
"""
import bpy, bmesh, math, os, json
from mathutils import Vector, Matrix

_REPOS = [r"D:\Work\mroscar\Website\new\SkulleyRadPortfolio", r"D:\Work\mroscar\Website\new\Skulley-Rad-Portfolio"]
REPO = next((r for r in _REPOS if os.path.isdir(os.path.join(r, "public"))), _REPOS[0])
AQUI = os.path.join(REPO, "scripts", "skulley-anim")
SALIDA = os.path.join(REPO, "public", "props", "cobija.glb")

ns = {}
exec(open(os.path.join(AQUI, "idles.py"), encoding="utf-8").read(), ns)
ARM = ns["ARM"]
PISO = ns["PISO"] / 100  # m

ANCHO = 1.15               # de lado a lado (m); a lo largo va de abajo de la barbilla hacia los pies (malla_plana)
MAS_LARGA = 0.32           # lo que pasa de las rodillas hacia los pies (Oscar, 2026-11-23: "un poco más larga"; y
                           # con la ropa puesta no lo cubría: "más ancha y larga")
NX, NY = 24, 22             # cuadros de la malla (pocos: es edredón, no sábana; con muchos salían arrugas finas)
# la ropa de Customize: la tela cae chocando también con ella, toda junta (la silueta más gorda: con la chamarra, la
# inflada o las botas puestas, la ropa atravesaba la cobija, que se simulaba sobre Skulley desnudo). Sin ropa queda
# un poco más holgada, nunca atravesada.
ROPA = ("Chamarra", "Hoodie", "Inflada", "Pantalones", "Botas", "Tenis", "Munequeras", "Boxers")
# un edredón (Oscar, 2026-11-24, con su referencia: "no tiene que adaptarse a la forma completamente, puede quedar sin
# tanto detalle"): un montículo suave sobre él, sin seguir cada hueso ni cada prenda
GROSOR_CUERPO = 0.03
GROSOR_ROPA = 0.035
SUELTA = 0.30               # a cuántos m sobre lo más alto del cuerpo la suelta el drone
GIRO = 4.0                  # grados: no cae perfectamente derecha
CUADROS = 150
# cuadros de la simulación que se guardan como la caída (el primero de la lista es el de la base + 1)
CAIDA = [4, 7, 10, 13, 16, 20, 25, 32, 44, 70]
QUIETA = 90                 # aquí ya está acomodada; de aquí a INHALA el pecho sube
INHALA = 125
PIEZAS = ns["PIEZAS"]


def _vs(o):
    dg = bpy.context.evaluated_depsgraph_get()
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    M = oe.matrix_world
    out = [M @ v.co for v in me.vertices]
    oe.to_mesh_clear()
    return out


def _tela(o, quality=8):
    cl = o.modifiers.new("Tela", "CLOTH")
    st = cl.settings
    st.quality = quality
    st.mass = 0.5
    st.air_damping = 6.0          # cae flotando, como sábana
    st.tension_stiffness = 30
    st.compression_stiffness = 30
    st.shear_stiffness = 15
    st.bending_stiffness = 25     # edredón: casi no se dobla, cae en un montículo con pliegues grandes y suaves
    st.tension_damping = 6
    st.compression_damping = 6
    st.shear_damping = 6
    st.bending_damping = 1.5
    cc = cl.collision_settings
    cc.collision_quality = 5
    cc.distance_min = 0.008
    cc.use_self_collision = True
    cc.self_distance_min = 0.006
    cc.self_friction = 8
    cl.point_cache.frame_start = 1
    cl.point_cache.frame_end = CUADROS
    return cl


def _colision(o, grosor=0.006):
    m = o.modifiers.new("Colision_cobija", "COLLISION")
    o.collision.thickness_outer = grosor
    o.collision.cloth_friction = 12
    o.collision.damping = 0.6
    return m


def _piso():
    me = bpy.data.meshes.new("piso_cobija")
    me.from_pydata([(-3, -3, PISO), (3, -3, PISO), (3, 3, PISO), (-3, 3, PISO)], [], [(0, 1, 2, 3)])
    o = bpy.data.objects.new("piso_cobija", me)
    bpy.context.scene.collection.objects.link(o)
    _colision(o, 0.004)
    return o


def _ropa():
    return tuple(n for n in ROPA if bpy.data.objects.get(n))


def ropa_visible(si=True):
    """La ropa visible y evaluada (oculta no entra a la simulación); regresa cómo estaba para dejarla igual."""
    antes = {}
    for n in _ropa():
        o = bpy.data.objects[n]
        antes[n] = (o.hide_get(), o.hide_viewport)
        if si:
            o.hide_set(False)
            o.hide_viewport = False
    return antes


def ropa_choque():
    """La ropa en la pose de dormido como mallas fijas y simplificadas (~3000 caras) para chocar: la ropa deformada
    por el armature, densa y recalculada cada cuadro, hacía la simulación de 5 minutos más de media hora."""
    sc = bpy.context.scene
    sc.frame_set(1)
    dg = bpy.context.evaluated_depsgraph_get()
    hechos = []
    for n in _ropa():
        oe = bpy.data.objects[n].evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(oe, preserve_all_data_layers=False, depsgraph=dg)
        me.transform(oe.matrix_world)
        p = bpy.data.objects.new(n + "_choque", me)
        sc.collection.objects.link(p)
        p.hide_render = True
        dec = p.modifiers.new("Simplifica", "DECIMATE")
        dec.ratio = max(0.03, min(1.0, 3000 / max(1, len(me.polygons))))
        hechos.append(p)
    return hechos


def pose_fija():
    """Una acción de prueba: dormido y quieto hasta QUIETA, y de ahí sube el pecho hasta INHALA."""
    S = ns["capturar"]("Dormir", 1)
    Inh = ns["capturar"]("Dormir", 32)
    ns["nueva_accion"]("Prueba_cobija", CUADROS)
    ns["poner_animado"]([(1, S), (QUIETA, S), (INHALA, Inh), (CUADROS, Inh)], CUADROS)


def malla_plana():
    """La cobija plana sobre Skulley: de abajo de la barbilla (la cabeza queda fuera: es enorme y el torso
    corto) a media espinilla; los pies salen. Centrada en su cuerpo."""
    bpy.context.scene.frame_set(1)
    torax = _vs(bpy.data.objects["Egg_Torax"])
    pelvis = _vs(bpy.data.objects["Egg_Pelvis"])
    cabeza = _vs(bpy.data.objects["Egg_Jaw"]) + _vs(bpy.data.objects["Egg_Head"])
    muslos = _vs(bpy.data.objects["Egg_Leg2_L"]) + _vs(bpy.data.objects["Egg_Leg2_R"])
    arriba_y = min(v.y for v in cabeza) - 0.01
    abajo_y = min(v.y for v in muslos) - 0.06 - MAS_LARGA
    largo = arriba_y - abajo_y
    cx = (sum(v.x for v in torax + pelvis) / len(torax + pelvis))
    cy = (arriba_y + abajo_y) / 2
    alto = -9.0
    for n in tuple(PIEZAS) + _ropa():
        if n in ("Egg_Head", "Egg_Jaw", "Egg_Eye_L", "Egg_Eye_R"):
            continue
        for v in _vs(bpy.data.objects[n]):
            if abs(v.x - cx) < ANCHO / 2 + 0.05 and abs(v.y - cy) < largo / 2 + 0.05:
                alto = max(alto, v.z)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    bmesh.ops.create_grid(bm, x_segments=NX, y_segments=NY, size=0.5, calc_uvs=True)
    M = (Matrix.Translation((cx, cy, alto + SUELTA)) @ Matrix.Rotation(math.radians(GIRO), 4, "Z")
         @ Matrix.Diagonal((ANCHO, largo, 1, 1)))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    me = bpy.data.meshes.new("Cobija")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Cobija_sim", me)
    bpy.context.scene.collection.objects.link(o)
    return o, {"centro": [round(cx, 3), round(cy, 3)], "largo": round(largo, 3), "alto_cuerpo": round(alto, 3)}


def simular(o, guardar_en):
    """Avanza la simulación cuadro por cuadro y regresa las posiciones de los cuadros pedidos."""
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, CUADROS
    out = {}
    for f in range(1, max(guardar_en) + 1):
        sc.frame_set(f)
        if f in guardar_en:
            out[f] = [v.copy() for v in _vs(o)]
    return out


def penetracion(vs, piezas=None):
    """Lo más que se mete un vértice de la cobija en una pieza (cm) con la pose del cuadro actual."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    peor = -9.0
    for n in (piezas or PIEZAS):
        vb, tb = ns["_malla"](bpy.data.objects[n], dg)
        t = BVHTree.FromPolygons(vb, tb)
        for v in vs:
            loc, nor, i, d = t.find_nearest(v, 0.05)
            if loc is None:
                continue
            peor = max(peor, (loc - v).dot(nor) * 100)
    return round(peor, 2)


GROSOR = 0.035              # m: acolchada, como edredón (y con grosor lleva el contorno de tinta)


def _normales(vs, caras):
    n = [Vector((0, 0, 0)) for _ in vs]
    for c in caras:
        a, b, cc, d = (vs[i] for i in c)
        f = (cc - a).cross(d - b)
        for i in c:
            n[i] += f
    return [x.normalized() if x.length > 1e-9 else Vector((0, 0, 1)) for x in n]


def _orilla(caras):
    """Las aristas de la orilla, en el sentido de su cara."""
    cuenta = {}
    for c in caras:
        for i in range(len(c)):
            k = tuple(sorted((c[i], c[(i + 1) % len(c)])))
            cuenta[k] = cuenta.get(k, 0) + 1
    return [(c[i], c[(i + 1) % len(c)]) for c in caras for i in range(len(c))
            if cuenta[tuple(sorted((c[i], c[(i + 1) % len(c)])))] == 1]


def _gruesa(vs, caras, g=GROSOR):
    """La hoja con grosor: la cara de arriba (hacia fuera del cuerpo) y la de abajo, cada una a g/2."""
    n = _normales(vs, caras)
    return [v + x * (g / 2) for v, x in zip(vs, n)] + [v - x * (g / 2) for v, x in zip(vs, n)]


def armar(base, formas):
    """El objeto final con grosor y sus formas (base plana + las de la caída, cubre, inhala y piso)."""
    src = bpy.data.objects["Cobija_sim"].data
    caras = [tuple(p.vertices) for p in src.polygons]
    # la cara de arriba ve hacia +Z en la cobija plana (de ahí sale qué lado es "afuera")
    if sum(x.z for x in _normales(base, caras)) < 0:
        caras = [tuple(reversed(c)) for c in caras]
    uv_de = {}
    for p in src.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            uv_de[vi] = tuple(src.uv_layers[0].data[li].uv)
    nv = len(base)
    orilla = _orilla(caras)
    caras_g = ([tuple(c) for c in caras] + [tuple(i + nv for i in reversed(c)) for c in caras]
               + [(b, a, a + nv, b + nv) for a, b in orilla])
    me = bpy.data.meshes.new("Cobija")
    me.from_pydata([tuple(v) for v in _gruesa(base, caras)], [], caras_g)
    uvl = me.uv_layers.new(name="UVMap")
    for p in me.polygons:
        p.use_smooth = True
        for li, vi in zip(p.loop_indices, p.vertices):
            uvl.data[li].uv = uv_de[vi % nv]
    vieja = bpy.data.objects.get("Cobija")
    if vieja:
        bpy.data.objects.remove(vieja)
    o = bpy.data.objects.new("Cobija", me)
    bpy.context.scene.collection.objects.link(o)
    o.shape_key_add(name="Basis", from_mix=False)
    for nombre, vs in formas:
        k = o.shape_key_add(name=nombre, from_mix=False)
        for i, v in enumerate(_gruesa(vs, caras)):
            k.data[i].co = v
    mat = bpy.data.materials.get("Cobija") or bpy.data.materials.new("Cobija")
    mat.diffuse_color = (0.85, 0.2, 0.25, 1)
    try:
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (0.85, 0.2, 0.25, 1)
        bsdf.inputs["Roughness"].default_value = 0.9
    except Exception:
        pass
    me.materials.append(mat)
    return o


def exportar(o, ruta=SALIDA):
    vl = bpy.context.view_layer
    for x in vl.objects:
        x.select_set(False)
    o.select_set(True)
    vl.objects.active = o
    crudo = ruta[:-4] + "_raw.glb"
    bpy.ops.export_scene.gltf(
        filepath=crudo, export_format="GLB", use_selection=True,
        export_animations=False, export_skins=False, export_morph=True, export_morph_normal=True,
        export_materials="EXPORT", export_image_format="NONE", export_cameras=False, export_lights=False,
        export_extras=False, export_yup=True, export_apply=False, export_texcoords=True, export_normals=True,
    )
    import subprocess
    npx = "npx.cmd" if os.name == "nt" else "npx"
    r = subprocess.run([npx, "--no-install", "gltf-transform", "meshopt", crudo, ruta], cwd=REPO, capture_output=True, text=True)
    if r.returncode == 0 and os.path.exists(ruta):
        os.remove(crudo)
    else:
        print("no se pudo comprimir", r.stderr[-400:])
        os.replace(crudo, ruta)
    return ruta


TRAJES = {"desnudo": (), "chamarra": ("Chamarra", "Pantalones", "Botas", "Munequeras"), "inflada": ("Inflada", "Pantalones", "Tenis")}


def todo(exportar_glb=True, fotos=None):
    sc = bpy.context.scene
    ARM.data.pose_position = "POSE"
    pose_fija()
    piso = _piso()
    vis_antes = ropa_visible()
    # el colchón de choque: la tela se queda a esta distancia; con la ropa, más grueso, así no la cruzan las solapas
    # de la chamarra ni los picos de las muñequeras (piezas delgadas que la tela deja pasar)
    for n in PIEZAS:
        _colision(bpy.data.objects[n], GROSOR_CUERPO)
    choque = ropa_choque()
    for p in choque:
        _colision(p, GROSOR_ROPA)
    o, info = malla_plana()
    base = [v.copy() for v in _vs(o)]
    _tela(o)
    quiero = set(CAIDA) | {QUIETA, INHALA, CUADROS}
    cuadros = simular(o, quiero)
    sc.frame_set(QUIETA)
    info["mete_quieta"] = penetracion(cuadros[QUIETA])
    info["mete_quieta_ropa"] = penetracion(cuadros[QUIETA], _ropa())
    sc.frame_set(INHALA)
    info["mete_inhala"] = penetracion(cuadros[INHALA])
    info["mete_inhala_ropa"] = penetracion(cuadros[INHALA], _ropa())
    # tirada: la misma tela acomodada, sin Skulley debajo, cae al piso
    for n in PIEZAS:
        m = bpy.data.objects[n].modifiers.get("Colision_cobija")
        if m:
            bpy.data.objects[n].modifiers.remove(m)
    for p in choque:
        bpy.data.objects.remove(p)
    me2 = o.data.copy()
    o2 = bpy.data.objects.new("Cobija_sim2", me2)
    sc.collection.objects.link(o2)
    for v, p in zip(me2.vertices, cuadros[QUIETA]):
        v.co = p
    _tela(o2)
    o.modifiers.remove(o.modifiers["Tela"])
    tirada = simular(o2, {60})[60]
    info["alto_tirada_cm"] = round((max(v.z for v in tirada) - PISO) * 100, 1)
    formas = [(f"cae_{i + 1:02d}", cuadros[f]) for i, f in enumerate(CAIDA)]
    formas += [("cubre", cuadros[QUIETA]), ("inhala", cuadros[INHALA]), ("piso", tirada)]
    fin = armar(base, formas)
    bpy.data.objects.remove(o)
    bpy.data.objects.remove(o2)
    bpy.data.objects.remove(piso)
    for n, (h, hv) in vis_antes.items():
        bpy.data.objects[n].hide_set(h)
        bpy.data.objects[n].hide_viewport = hv
    info["ropa"] = list(_ropa())
    info["formas"] = [k.name for k in fin.data.shape_keys.key_blocks]
    info["fps"] = sc.render.fps / sc.render.fps_base
    info["caida"] = CAIDA
    info["vertices"] = len(fin.data.vertices)
    if exportar_glb:
        info["glb"] = exportar(fin)
        info["kb"] = round(os.path.getsize(info["glb"]) / 1024, 1)
    if fotos:
        info["fotos"] = []
        for traje, prendas in TRAJES.items():
            for n in _ropa():
                bpy.data.objects[n].hide_set(False)
                bpy.data.objects[n].hide_viewport = False
                bpy.data.objects[n].hide_render = n not in prendas
            info["fotos"] += fotos_cobija(fin, os.path.join(fotos, traje), formas=("cubre",), props=True)
        for n, (h, hv) in vis_antes.items():
            bpy.data.objects[n].hide_set(h)
            bpy.data.objects[n].hide_viewport = hv
    return info


def _render_con_ropa(salida, f):
    props, ns["PROPS"] = ns["PROPS"], ()   # render() prende o apaga todos los props: aquí manda el traje
    try:
        return ns["render"](salida, [f], vistas=("piso_juego", "piso", "piso_arriba"), lado=420)
    finally:
        ns["PROPS"] = props


def fotos_cobija(o, salida, formas=("Basis", "cae_03", "cae_06", "cae_08", "cubre", "inhala", "piso"), props=False):
    """Fotos de Skulley dormido con la cobija en cada forma (la de inhala, con su pecho arriba)."""
    sc = bpy.context.scene
    rutas = []
    for nombre in formas:
        for k in o.data.shape_keys.key_blocks[1:]:
            k.value = 1.0 if k.name == nombre else 0.0
        f = INHALA if nombre == "inhala" else QUIETA
        oculto = nombre == "piso"
        for n in PIEZAS:
            bpy.data.objects[n].hide_render = oculto
        if props:   # la ropa la decide quien llama (render() la apagaría)
            r = _render_con_ropa(os.path.join(salida, nombre), f)
        else:
            r = ns["render"](os.path.join(salida, nombre), [f], vistas=("piso_juego", "piso"), lado=360)
        rutas += r
    for n in PIEZAS:
        bpy.data.objects[n].hide_render = False
    return rutas


# ---------------------------------------------------------------- el edredón sin simular (Oscar, 2026-11-24: la tela
# simulada contra toda la ropa tardaba más de media hora; y "no tiene que adaptarse a la forma completamente, puede
# quedar sin tanto detalle", con su referencia de un edredón liso). Un montículo: la altura de Skulley y de toda su
# ropa debajo de la cobija (en la pose de dormido), ensanchada y desenfocada (así no sigue cada hueso ni cada prenda
# y nunca queda abajo de nada), más un colchón; donde no hay nadie, el piso. La caída: cada punto baja con gravedad
# desde la cobija plana y se queda donde toca el montículo (lo más alto toca primero).
CELDA = 0.015               # m, la rejilla de alturas
ENSANCHA = 0.10             # m: cada altura se extiende a esta distancia (que el desenfoque no la baje)
SUAVE = 0.05                # m: el desenfoque (gaussiano)
COLCHON = 0.03              # m sobre lo más alto de lo que tapa
CAE_G = 4.5                 # m/s²: cae flotando, como tela
PECHO = 0.012               # m que la sube el pecho al inhalar


def _alturas(puntos, x0, y0, nx, ny):
    """Rejilla de lo más alto (z) de los puntos por celda; -9 donde no hay nada."""
    h = [[-9.0] * nx for _ in range(ny)]
    for v in puntos:
        i = int((v.x - x0) / CELDA)
        j = int((v.y - y0) / CELDA)
        if 0 <= i < nx and 0 <= j < ny and v.z > h[j][i]:
            h[j][i] = v.z
    return h


def _ensancha(h, r):
    nx, ny = len(h[0]), len(h)
    k = int(round(r / CELDA))
    # separable: máximo por filas y luego por columnas (cuadrado; basta)
    a = [[max(fila[max(0, i - k):i + k + 1]) for i in range(nx)] for fila in h]
    return [[max(a[jj][i] for jj in range(max(0, j - k), min(ny, j + k + 1))) for i in range(nx)] for j in range(ny)]


def _desenfoca(h, sigma, piso):
    nx, ny = len(h[0]), len(h)
    k = int(round(2.5 * sigma / CELDA))
    w = [math.exp(-0.5 * (d * CELDA / sigma) ** 2) for d in range(-k, k + 1)]
    sw = sum(w)
    base = [[max(x, piso) for x in fila] for fila in h]
    a = [[sum(w[d + k] * base[j][min(nx - 1, max(0, i + d))] for d in range(-k, k + 1)) / sw for i in range(nx)] for j in range(ny)]
    return [[sum(w[d + k] * a[min(ny - 1, max(0, j + d))][i] for d in range(-k, k + 1)) / sw for i in range(nx)] for j in range(ny)]


def _muestrea(h, x0, y0, x, y):
    nx, ny = len(h[0]), len(h)
    fx = min(nx - 1.001, max(0.0, (x - x0) / CELDA))
    fy = min(ny - 1.001, max(0.0, (y - y0) / CELDA))
    i, j = int(fx), int(fy)
    tx, ty = fx - i, fy - j
    return (h[j][i] * (1 - tx) * (1 - ty) + h[j][i + 1] * tx * (1 - ty) + h[j + 1][i] * (1 - tx) * ty + h[j + 1][i + 1] * tx * ty)


def edredon(exportar_glb=True):
    sc = bpy.context.scene
    ARM.data.pose_position = "POSE"
    pose_fija()
    vis_antes = ropa_visible()
    sc.frame_set(1)
    o, info = malla_plana()
    base = [v.copy() for v in _vs(o)]
    puntos = []
    for n in tuple(PIEZAS) + _ropa():
        if n in ("Egg_Head", "Egg_Jaw", "Egg_Eye_L", "Egg_Eye_R"):
            continue
        puntos += _vs(bpy.data.objects[n])
    x0 = min(v.x for v in base) - 0.2
    y0 = min(v.y for v in base) - 0.2
    nx = int((max(v.x for v in base) + 0.2 - x0) / CELDA) + 1
    ny = int((max(v.y for v in base) + 0.2 - y0) / CELDA) + 1
    piso = PISO + GROSOR / 2 + 0.003
    h = _alturas(puntos, x0, y0, nx, ny)
    h = _ensancha(h, ENSANCHA)
    h = [[x + COLCHON if x > -8 else -9.0 for x in fila] for fila in h]
    H = _desenfoca(h, SUAVE, piso)
    cubre = [Vector((v.x, v.y, max(piso, _muestrea(H, x0, y0, v.x, v.y)))) for v in base]
    # inhala: el pecho la sube (alrededor del tórax)
    sc.frame_set(INHALA)
    tor = _vs(bpy.data.objects["Egg_Torax"])
    tc = sum(tor, Vector()) / len(tor)
    sc.frame_set(1)
    inhala = [Vector((v.x, v.y, v.z + PECHO * math.exp(-((v.x - tc.x) ** 2 + (v.y - tc.y) ** 2) / (2 * 0.14 ** 2)))) for v in cubre]
    # la caída: gravedad desde la plana hasta tocar el montículo (cuadros de CAIDA a 30 fps)
    fps = sc.render.fps / sc.render.fps_base
    formas = []
    for k, f in enumerate(CAIDA):
        t = (f - 1) / fps
        caida = 0.5 * CAE_G * t * t
        formas.append((f"cae_{k + 1:02d}", [Vector((b.x, b.y, max(c.z, b.z - caida))) for b, c in zip(base, cubre)]))
    # tirada en el piso: lo mismo, aplastada, con dos pliegues suaves
    tirada = [Vector((c.x, c.y, piso + 0.025 * max(0.0, math.sin((c.y - y0) * 7.0)) * math.exp(-((c.x) ** 2) / 0.08))) for c in cubre]
    formas += [("cubre", cubre), ("inhala", inhala), ("piso", tirada)]
    sc.frame_set(QUIETA)
    info["mete_cubre"] = penetracion(cubre)
    info["mete_cubre_ropa"] = penetracion(cubre, _ropa())
    fin = armar(base, formas)
    bpy.data.objects.remove(o)
    for n, (hh, hv) in vis_antes.items():
        bpy.data.objects[n].hide_set(hh)
        bpy.data.objects[n].hide_viewport = hv
    info["formas"] = [kb.name for kb in fin.data.shape_keys.key_blocks]
    info["vertices"] = len(fin.data.vertices)
    info["alto_max"] = round(max(v.z for v in cubre) - PISO, 3)
    if exportar_glb:
        info["glb"] = exportar(fin)
        info["kb"] = round(os.path.getsize(info["glb"]) / 1024, 1)
    return info
