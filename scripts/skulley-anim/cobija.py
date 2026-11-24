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

ANCHO = 0.86               # de lado a lado (m); a lo largo va de abajo de la barbilla a media espinilla (malla_plana)
MAS_LARGA = 0.14           # lo que pasa de las rodillas hacia los pies (Oscar, 2026-11-23: "un poco más larga")
NX, NY = 30, 26             # cuadros de la malla
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
    st.mass = 0.3
    st.air_damping = 6.0          # cae flotando, como sábana
    st.tension_stiffness = 14
    st.compression_stiffness = 14
    st.shear_stiffness = 8
    st.bending_stiffness = 1.2    # felpa gruesa: pliegues grandes (con 0.4 se hacía bola como trapo)
    st.tension_damping = 6
    st.compression_damping = 6
    st.shear_damping = 6
    st.bending_damping = 0.6
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
    for n in PIEZAS:
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


def penetracion(vs):
    """Lo más que se mete un vértice de la cobija en una pieza (cm) con la pose del cuadro actual."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    peor = -9.0
    for n in PIEZAS:
        vb, tb = ns["_malla"](bpy.data.objects[n], dg)
        t = BVHTree.FromPolygons(vb, tb)
        for v in vs:
            loc, nor, i, d = t.find_nearest(v, 0.05)
            if loc is None:
                continue
            peor = max(peor, (loc - v).dot(nor) * 100)
    return round(peor, 2)


GROSOR = 0.012              # m: con grosor lleva el contorno de tinta (una hoja sin grosor no tiene silueta)


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


def todo(exportar_glb=True, fotos=None):
    sc = bpy.context.scene
    ARM.data.pose_position = "POSE"
    pose_fija()
    piso = _piso()
    for n in PIEZAS:
        _colision(bpy.data.objects[n])
    o, info = malla_plana()
    base = [v.copy() for v in _vs(o)]
    _tela(o)
    quiero = set(CAIDA) | {QUIETA, INHALA, CUADROS}
    cuadros = simular(o, quiero)
    sc.frame_set(QUIETA)
    info["mete_quieta"] = penetracion(cuadros[QUIETA])
    sc.frame_set(INHALA)
    info["mete_inhala"] = penetracion(cuadros[INHALA])
    # tirada: la misma tela acomodada, sin Skulley debajo, cae al piso
    for n in PIEZAS:
        m = bpy.data.objects[n].modifiers.get("Colision_cobija")
        if m:
            bpy.data.objects[n].modifiers.remove(m)
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
    info["formas"] = [k.name for k in fin.data.shape_keys.key_blocks]
    info["fps"] = sc.render.fps / sc.render.fps_base
    info["caida"] = CAIDA
    info["vertices"] = len(fin.data.vertices)
    if exportar_glb:
        info["glb"] = exportar(fin)
        info["kb"] = round(os.path.getsize(info["glb"]) / 1024, 1)
    if fotos:
        info["fotos"] = fotos_cobija(fin, fotos)
    return info


def fotos_cobija(o, salida, formas=("Basis", "cae_03", "cae_06", "cae_08", "cubre", "inhala", "piso")):
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
        r = ns["render"](os.path.join(salida, nombre), [f], vistas=("piso_juego", "piso"), lado=360)
        rutas += r
    for n in PIEZAS:
        bpy.data.objects[n].hide_render = False
    return rutas
