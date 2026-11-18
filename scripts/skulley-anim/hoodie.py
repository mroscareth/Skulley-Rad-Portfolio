"""
Arma el hoodie de Skulley (prop "Hoodie") en Character/SkulleyRad.blend.

En Blender, en modo objeto:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
Reemplaza el objeto Hoodie si ya existe. Mismo método que chamarra.py, en las coordenadas
del armature (cm): torso de anillos superelípticos pegado al cuerpo (Oscar: "que no parezca un
bulto o costal") que solo se ablusa arriba del resorte, y mangas de cápsulas que se juntan
redonditas en el puño, unidos con voxel remesh; las aberturas (abajo, puños, cuello en V) se
cortan antes de QuadriFlow (orillas fijas), se relaja la malla sobre la forma de antes (QuadriFlow
doblaba caras) y se simetriza; grosor con Solidify sin even offset. El resorte de abajo y los puños
se arman sobre la orilla real de la tela (la tela acaba adentro de ellos), acanalados en zigzag.
La capucha caída es un tubo que sigue la orilla del cuello: el bulto atrás, plana al frente (donde
baja la quijada) y cruzada en V; de ahí salen los cordones con sus puntas. Negro, con SKULLEYRAD en
SKULLEYGLYPH a lo largo de las dos mangas y "PUNKS NOT DEAD" en un anillo en la espalda (estampar(): una
textura empacada "Hoodie_Tela_estampado" en Hoodie_Tela con las dos imágenes de estampado_runas.mjs, y UV a
lo largo del brazo y proyectado desde atrás, como los corazones de los bóxers). Pesos: transferidos de
las piezas del cuerpo a la tela, suavizados y más en axilas y codos; resorte, puños, capucha y
cordones toman el peso de la tela bajo cada vértice; el lado derecho es el espejo del izquierdo.

medir() revisa cuadro por cuadro una acción (idle, caminar, correr) por cruce de superficies entre
cuerpo y ropa, y lo que la manga se mete en el costado; revisar_reposo() el reposo con la quijada
abierta. render() saca vistas con una cámara temporal y deja la escena como estaba.
"""
import bpy, bmesh, math, json
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from mathutils.geometry import barycentric_transform

ARM = bpy.data.objects["root"]
NOMBRE = "Hoodie"
TMP = "Hoodie_tmp"

# materiales, en este orden (mismo convenio que la chamarra: 1 = la cara de adentro)
# la capucha va en su propio material (mismo negro): el sitio la sigue como piel en la tela suelta y no la
# cuenta como costado del torso en apartaManos
TELA, FORRO, PUNO, CORDON, PUNTA, CAPUCHA = range(6)

Z_ORILLA = 70.5          # donde acaba la tela del torso, adentro del resorte (en idle, agachado, el muslo
                         # rozaba el resorte 1 cm mas abajo)
T_ORILLA = 20.0          # cm del codo hacia la muñeca donde acaba la manga, adentro del puño
# cuello: elipse alrededor del cuello, ancha a los lados: la quijada mide +-13.6, abierta baja sus esquinas
# a z 129 y caminando la cabeza se inclina 9 grados y gira 11 respecto al torso, y su esquina bajaba a 1.2 cm
# de la tela donde arranca la V (x 15, y -8, z 122)
CUELLO_C = Vector((0.0, 2.5)); CUELLO_AX = 18.0; CUELLO_R = 12.0; CUELLO_Z = 116.0
V_Z = 103.0; V_PEND = 0.85        # cuello en V: fondo y pendiente
V_MAX = CUELLO_AX * math.sqrt(1 - ((-1.0 - CUELLO_C.y) / CUELLO_R) ** 2)   # empata con la elipse en y = -1


def col_tmp():
    c = bpy.data.collections.get(TMP)
    if not c:
        c = bpy.data.collections.new(TMP)
        bpy.context.scene.collection.children.link(c)
    return c


def borrar(nombre):
    o = bpy.data.objects.get(nombre)
    if o:
        me = o.data if o.type == 'MESH' else None
        bpy.data.objects.remove(o, do_unlink=True)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)


def objeto(nombre, bm, coleccion=None):
    borrar(nombre)
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(nombre, me)
    (coleccion or col_tmp()).objects.link(o)
    o.matrix_world = ARM.matrix_world.copy()
    return o


def activo(o):
    vl = bpy.context.view_layer
    for x in vl.objects:
        x.select_set(False)
    o.select_set(True); vl.objects.active = o


# --- torso: anillos superelipticos (z, a = medio ancho, yf = frente, yb = espalda, n)
# pegado al cuerpo (Oscar: "que no parezca un bulto o costal"); solo se ablusa un poco arriba
# del resorte (73-83) y regresa a la cintura en la orilla (70.5), que libra los boxers
ANILLOS = [
    (65.5, 22.6, -19.6, 19.0, 2.4),
    (68.0, 22.8, -19.8, 19.2, 2.4),
    (70.5, 23.0, -20.0, 19.5, 2.4),
    (73.5, 24.2, -21.4, 20.9, 2.5),
    (77.0, 24.4, -21.8, 21.6, 2.5),
    (82.5, 23.8, -21.3, 21.9, 2.5),
    (90.0, 22.6, -20.5, 22.0, 2.5),
    (98.0, 22.4, -19.6, 22.2, 2.5),
    (104.0, 22.8, -18.0, 21.9, 2.6),
    (110.0, 24.4, -16.4, 21.2, 2.7),
    (115.0, 25.6, -14.6, 19.6, 2.8),
    (119.0, 25.2, -12.6, 17.4, 2.8),
    (122.0, 22.8, -10.6, 15.0, 2.6),
    (124.0, 18.0, -8.6, 12.6, 2.4),
    (125.2, 10.0, -6.0, 10.0, 2.2),
]
N = 64


def anillo(z, a, yf, yb, n):
    c = (yf + yb) / 2; b = (yb - yf) / 2
    pts = []
    for i in range(N):
        t = 2 * math.pi * i / N
        ct, st = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(ct) ** (2 / n), ct)
        y = c + b * math.copysign(abs(st) ** (2 / n), st)
        pts.append(Vector((x, y, z)))
    return pts


def torso_proxy():
    bm = bmesh.new()
    filas = [[bm.verts.new(p) for p in anillo(*r)] for r in ANILLOS]
    for f0, f1 in zip(filas, filas[1:]):
        for i in range(N):
            j = (i + 1) % N
            bm.faces.new((f0[i], f0[j], f1[j], f1[i]))
    bm.faces.new(list(reversed(filas[0])))
    bm.faces.new(filas[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objeto("tmp_torso", bm)


# --- mangas: capsulas encadenadas (punto, radio) que se inflan en el antebrazo y se juntan en el puño
def brazo(lado):
    B = ARM.data.bones
    return (B["arm_stretch." + lado].head_local.copy(), B["forearm_stretch." + lado].head_local.copy(),
            B["hand." + lado].head_local.copy())


def manga_puntos(lado):
    h, c, m = brazo(lado)
    s = 1 if lado == 'l' else -1
    uf = (m - c).normalized()
    # pegada al brazo; se ablusa poco en el antebrazo y se junta redondita en el puño
    return [
        (Vector((12.0 * s, 1.0, 113.0)), 7.4),
        (Vector((h.x, h.y + 0.2, 115.0)), 7.6),
        ((h + c) / 2, 7.6),
        (c, 9.0),
        (c + uf * 8.0, 9.0),
        (c + uf * 13.0, 8.6),
        (c + uf * 16.5, 7.8),
        (c + uf * 19.0, 7.2),
        (c + uf * 22.0, 7.1),
    ]


def capsula(bm, a, ra, b, rb, seg=32):
    ab = b - a; L = ab.length; u = ab / L
    M = u.to_track_quat('Z', 'Y').to_matrix()
    for centro, r in ((a, ra), (b, rb)):
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r,
                                  matrix=Matrix.Translation(centro))
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=ra, radius2=rb, depth=L,
                          matrix=Matrix.Translation((a + b) / 2) @ M.to_4x4())


def mangas_proxy():
    bm = bmesh.new()
    for lado in ('l', 'r'):
        pts = manga_puntos(lado)
        for (a, ra), (b, rb) in zip(pts, pts[1:]):
            capsula(bm, a, ra, b, rb)
    return objeto("tmp_mangas", bm)


def x_v(z):
    return min(V_MAX, max(0.0, (z - V_Z) * V_PEND))


def abierto(p):
    if p.z > CUELLO_Z and (p.x / CUELLO_AX) ** 2 + ((p.y - CUELLO_C.y) / CUELLO_R) ** 2 < 1:
        return True
    if p.y < -1.0 and p.z > V_Z and abs(p.x) < x_v(p.z):
        return True
    return False


def cortar(o, iteraciones=30):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bvh = BVHTree.FromBMesh(bm)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, Z_ORILLA),
                           plane_no=(0, 0, 1), clear_inner=True)
    for lado in ('l', 'r'):
        h, c, m = brazo(lado)
        uf = (m - c).normalized()
        s = 1 if lado == 'l' else -1
        geom = [v for v in bm.verts if v.co.x * s > 40]
        geom = geom + list({e for v in geom for e in v.link_edges}) + list({f for v in geom for f in v.link_faces})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=c + uf * T_ORILLA, plane_no=uf, clear_outer=True)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abierto(f.calc_center_median())], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # la orilla del cuello sale de voxel en escalones: suavizarla sobre la superficie
    for _ in range(iteraciones):
        nuevos = {}
        for v in bm.verts:
            if not v.is_boundary or v.co.z < 100 or abs(v.co.x) > 30:
                continue
            vec = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(vec) != 2:
                continue
            p = v.co.lerp((vec[0].co + vec[1].co) / 2, 0.5)
            loc = bvh.find_nearest(p)[0]
            nuevos[v] = loc if loc is not None else p
        for v, p in nuevos.items():
            v.co = p
    bm.to_mesh(o.data); bm.free(); o.data.update()


def afuera(bm):
    """Voltea todas las caras si la mayoria del torso mira hacia adentro."""
    a = d = 0
    for f in bm.faces:
        c = f.calc_center_median()
        if 75 < c.z < 105 and abs(c.x) < 18:
            r = Vector((c.x, c.y - 1.0, 0))
            if r.length > 1:
                if f.normal.dot(r) > 0: a += 1
                else: d += 1
    if d > a:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.normal_update()


AXILA_C = Vector((22.0, 0.0, 108.0)); AXILA_R = 14.0


def relajar(o, forma, vueltas=10, f=0.5):
    """QuadriFlow dejaba un pliegue (caras dobladas) al frente del pecho junto a la axila, que se veia como
    un punto oscuro y hacia que el forro cruzara la tela: cada vertice va hacia el promedio de sus vecinos
    y regresa a la superficie de antes de QuadriFlow (la forma no cambia, solo se reparten los vertices)."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    def pasada(verts):
        nuevos = {}
        for v in verts:
            if v.is_boundary or not v.link_edges:
                continue
            m = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
            p = v.co.lerp(m, f)
            loc = forma.find_nearest(p)[0]
            nuevos[v] = loc if loc is not None else p
        for v, p in nuevos.items():
            v.co = p
    for _ in range(vueltas):
        pasada(bm.verts)
    # lo que siga volteado (su normal contra la de sus vecinas): insistir solo ahi, con unos anillos alrededor
    volteadas = []
    for _ in range(40):
        bm.normal_update()
        volteadas = []
        for fc in bm.faces:
            vec = [g for v in fc.verts for g in v.link_faces if g is not fc]
            avg = sum((g.normal for g in vec), Vector())
            if avg.length > 0 and fc.normal.dot(avg) < 0:
                volteadas.append(fc)
        if not volteadas:
            break
        zona = {v for fc in volteadas for v in fc.verts}
        for _ in range(3):
            zona |= {e.other_vert(v) for v in zona for e in v.link_edges}
        for _ in range(5):
            pasada(zona)
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return len(volteadas)


def unir_y_remallar(voxel=0.8, suave=12, caras=5600):
    for o in list(col_tmp().objects):
        borrar(o.name)
    t = torso_proxy(); m = mangas_proxy()
    vl = bpy.context.view_layer
    for x in vl.objects:
        x.select_set(False)
    t.select_set(True); m.select_set(True); vl.objects.active = t
    bpy.ops.object.join()
    t.name = "tmp_hoodie"
    t.data.remesh_voxel_size = voxel
    t.data.use_remesh_fix_poles = True
    activo(t)
    bpy.ops.object.voxel_remesh()
    mod = t.modifiers.new("suave", 'SMOOTH'); mod.factor = 0.6; mod.iterations = suave
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # el pliegue donde la manga entra al torso queda filoso con el voxel: se redondea solo esa zona
    g = t.vertex_groups.new(name="axila")
    for v in t.data.vertices:
        d = min((v.co - Vector((s * AXILA_C.x, AXILA_C.y, AXILA_C.z))).length for s in (1, -1))
        if d < AXILA_R:
            g.add([v.index], 1 - d / AXILA_R, 'REPLACE')
    mod = t.modifiers.new("suave_axila", 'SMOOTH'); mod.factor = 0.8; mod.iterations = 25; mod.vertex_group = "axila"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    t.vertex_groups.clear()
    cortar(t)
    bm = bmesh.new(); bm.from_mesh(t.data)
    forma = BVHTree.FromBMesh(bm); bm.free()
    activo(t)
    bpy.ops.object.quadriflow_remesh(target_faces=caras, use_preserve_sharp=False, use_preserve_boundary=True,
                                     smooth_normals=False, use_mesh_symmetry=True)
    t["volteadas"] = relajar(t, forma)
    # QuadriFlow la deja un poco chueca: el lado derecho es el espejo del izquierdo
    activo(t)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.symmetrize(direction='POSITIVE_X', threshold=0.05)
    bpy.ops.object.mode_set(mode='OBJECT')
    bm = bmesh.new(); bm.from_mesh(t.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    afuera(bm)
    for f in bm.faces:
        f.smooth = True; f.material_index = TELA
    bm.to_mesh(t.data); bm.free(); t.data.update()
    return t


def materiales(o):
    def mat(nombre, color, rough):
        m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = 0.0
        m.diffuse_color = (*color, 1); m.roughness = rough; m.metallic = 0.0
        return m
    o.data.materials.clear()
    # negro (Oscar, 2026-11-17); el color de la tela lo da la textura del estampado
    for m in (mat("Hoodie_Tela", NEGRO, 0.9),
              mat("Hoodie_Forro", (0.018, 0.018, 0.02), 0.95),
              mat("Hoodie_Puno", (0.008, 0.008, 0.009), 0.9),
              mat("Hoodie_Cordon", (0.012, 0.012, 0.013), 0.7),
              mat("Hoodie_Punta", (0.12, 0.12, 0.13), 0.4),
              mat("Hoodie_Capucha", NEGRO, 0.9)):
        o.data.materials.append(m)


# --- estampados: una sola textura de la tela (negro, con el texto de las mangas arriba y el anillo de la
# espalda abajo) y UV: a lo largo del brazo en las mangas y proyectado desde atras en la espalda
NEGRO = (0.006, 0.006, 0.0068)   # lineal
# Los dos en SKULLEYGLYPH Bold, blanco, de estampado_runas.mjs con la fuente publicada. Oscar cambio el logo
# de la calavera de la espalda por SKULLEYRAD, lo paso a las mangas y luego pidio en la espalda "punks not
# dead" en un circulo, como el anillo de la pantalla de carga (2026-11-17).
ESTAMPADO = r"D:\Work\mroscar\Website\new\Character\assets\hoodie_estampado_runas.png"
ESTAMPADO_ESPALDA = r"D:\Work\mroscar\Website\new\Character\assets\hoodie_espalda_anillo.png"
TEX_N = 1024
# cajas en la textura (px, desde abajo a la izquierda, como guarda Blender): la tira de las mangas arriba y
# el anillo abajo al centro; (0.01, 0.01), el negro de todo lo demas, queda fuera de las dos
CAJA_MANGAS = (32, 792, 960, 200)
CAJA_ESPALDA = (142, 24, 740, 740)
# cada imagen queda dentro de su caja con este margen negro (px); las caras que se salen de su imagen van
# al negro: con las dos en una textura, la espalda fuera del anillo caia en la tira de las mangas
MARGEN_CAJA = 16


def _srgb(c):
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def textura_atlas(entradas, nombre="Hoodie_Tela_estampado"):
    """La tela negra con cada imagen (recortada a lo que tiene tinta, escalada y centrada en su caja),
    empacada en el .blend. entradas = [(ruta, (x, y, ancho, alto))]. Regresa (imagen, [((u0, v0, du, dv),
    ancho/alto, (mu, mv))] por entrada): el lugar de la imagen, su proporcion y su margen negro (en fraccion
    de la imagen)."""
    import numpy as np
    neg = np.array([_srgb(c) for c in NEGRO], np.float32)
    tex = np.empty((TEX_N, TEX_N, 4), np.float32)
    tex[..., :3] = neg; tex[..., 3] = 1.0
    previa = {i.name for i in bpy.data.images}
    sitios = []
    for ruta, (bx, by, bw, bh) in entradas:
        src = bpy.data.images.load(ruta, check_existing=True)
        w, h = src.size
        a = np.empty(w * h * 4, np.float32); src.pixels.foreach_get(a); a = a.reshape(h, w, 4)
        ys, xs = np.nonzero(a[:, :, 3] > 0.01)
        crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        ch, cw = crop.shape[:2]
        M = MARGEN_CAJA
        s = min((bw - 2 * M) / cw, (bh - 2 * M) / ch)
        tw, th = max(1, round(cw * s)), max(1, round(ch * s))
        gx = np.clip((np.arange(tw) + 0.5) / s - 0.5, 0, cw - 1); gy = np.clip((np.arange(th) + 0.5) / s - 0.5, 0, ch - 1)
        x0 = np.floor(gx).astype(int); y0 = np.floor(gy).astype(int)
        x1 = np.minimum(x0 + 1, cw - 1); y1 = np.minimum(y0 + 1, ch - 1)
        fx = (gx - x0)[None, :, None]; fy = (gy - y0)[:, None, None]
        r = (crop[y0][:, x0] * (1 - fx) + crop[y0][:, x1] * fx) * (1 - fy) + \
            (crop[y1][:, x0] * (1 - fx) + crop[y1][:, x1] * fx) * fy
        ox = bx + (bw - tw) // 2; oy = by + (bh - th) // 2
        al = r[..., 3:4]
        tex[oy:oy + th, ox:ox + tw, :3] = r[..., :3] * al + neg * (1 - al)
        sitios.append(((ox / TEX_N, oy / TEX_N, tw / TEX_N, th / TEX_N), cw / ch, (M / tw, M / th)))
        if src.name not in previa:
            bpy.data.images.remove(src)
    img = bpy.data.images.get(nombre)
    if img and tuple(img.size) != (TEX_N, TEX_N):
        bpy.data.images.remove(img); img = None
    img = img or bpy.data.images.new(nombre, TEX_N, TEX_N, alpha=False)
    img.pixels.foreach_set(tex.ravel())
    img.update(); img.pack()
    return img, sitios


def _tela_con_textura(img):
    m = bpy.data.materials["Hoodie_Tela"]
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tx = nt.nodes.get("Estampado") or nt.nodes.new("ShaderNodeTexImage")
    tx.name = tx.label = "Estampado"
    tx.image = img; tx.extension = 'EXTEND'; tx.interpolation = 'Linear'
    tx.location = (bsdf.location.x - 320, bsdf.location.y)
    nt.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"])


def _uv_negro(me):
    uv = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for d in uv.data:
        d.uv = (0.01, 0.01)
    return uv


def estampar(o, n_tela, mangas=ESTAMPADO, espalda=ESTAMPADO_ESPALDA):
    """Arma la textura con lo que toque (mangas y/o espalda) y pone los UV de cada uno."""
    entradas = ([(mangas, CAJA_MANGAS)] if mangas else []) + ([(espalda, CAJA_ESPALDA)] if espalda else [])
    img, sitios = textura_atlas(entradas)
    me = o.data
    uv = _uv_negro(me)
    info = {}
    k = 0
    if mangas:
        info["mangas"] = uv_mangas(me, uv, n_tela, *sitios[k]); k += 1
    if espalda:
        info["espalda"] = uv_espalda_anillo(me, uv, n_tela, *sitios[k]); k += 1
    _tela_con_textura(img)
    return info


def _abajo_capucha(me):
    capucha = {i for p in me.polygons if p.material_index == CAPUCHA for i in p.vertices}
    return min(me.vertices[i].co.z for i in capucha if abs(me.vertices[i].co.x) < 8 and me.vertices[i].co.y > 8)


def _a_la_imagen(rel, margen):
    """Los (u, v) relativos a la imagen de una cara: None si ninguno cae en la imagen (la cara va al negro);
    si alguno cae, todos recortados a la imagen y su margen negro, para no tocar la imagen vecina (recortar y
    no tirar la cara: tirarla se comia las puntas de las letras en las orillas)."""
    mu, mv = margen
    if not any(0 <= a <= 1 and 0 <= b <= 1 for a, b in rel):
        return None
    return [(min(max(a, -mu), 1 + mu), min(max(b, -mv), 1 + mv)) for a, b in rel]


def _uv_desde_atras(me, uv, n_tela, sitio, margen, W, H, zc):
    """La cara de afuera de la tela que mira hacia atras, con el UV proyectado desde atras: la izquierda de la
    imagen es el lado izquierdo de Skulley (+x) visto por la espalda."""
    (u0, v0, du, dv) = sitio
    impresas = 0
    for p in me.polygons:
        if p.material_index == TELA and max(p.vertices) < n_tela and p.normal.y > 0.2 and p.center.y > 0:
            rel = []
            for li in p.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co
                rel.append((li, 0.5 - co.x / W, 0.5 + (co.z - zc) / H))
            ab = _a_la_imagen([(a, b) for _, a, b in rel], margen)
            if ab is None:
                continue
            for (li, _, _), (a, b) in zip(rel, ab):
                uv.data[li].uv = (u0 + a * du, v0 + b * dv)
            impresas += 1
    return impresas


def uv_espalda_anillo(me, uv, n_tela, sitio, aspecto, margen, diametro=29.0, subir=2.5, aire_abajo=3.0, aire_arriba=3.0):
    """El anillo de "punks not dead" en la espalda, entre el resorte y donde cuelga la capucha, de
    `diametro` cm por fuera (lo que quepa), `subir` cm arriba del centro de ese espacio (Oscar: "un pelín")
    sin meterse bajo la capucha."""
    z1 = _abajo_capucha(me) - aire_arriba; z0 = Z_ORILLA + 1.6 + aire_abajo
    H = min(diametro, z1 - z0); W = H * aspecto
    zc = min((z0 + z1) / 2 + subir, z1 - H / 2)
    n = _uv_desde_atras(me, uv, n_tela, sitio, margen, W, H, zc)
    return dict(caras=n, ancho_cm=round(W, 1), alto_cm=round(H, 1), centro_z=round(zc, 1))


def uv_espalda_arriba(me, uv, n_tela, sitio, aspecto, margen, ancho=34.0, aire_abajo=3.0, aire_arriba=3.0):
    """(Una version anterior: SKULLEYRAD arriba en la espalda.) La imagen justo debajo de donde cuelga la
    capucha, de `ancho` cm."""
    z1 = _abajo_capucha(me) - aire_arriba
    H = min(ancho / aspecto, z1 - (Z_ORILLA + 1.6 + aire_abajo)); W = H * aspecto
    zc = z1 - H / 2
    return dict(caras=_uv_desde_atras(me, uv, n_tela, sitio, margen, W, H, zc), ancho_cm=round(W, 1), alto_cm=round(H, 1))


def uv_mangas(me, uv, n_tela, sitio, aspecto, margen, inicio=2.0, antes_del_puno=1.0, abierto=75.0):
    """El texto en las dos mangas, por el lado de afuera (arriba-afuera con el brazo en reposo, afuera con el
    brazo abajo), a lo largo de toda la manga: de `inicio` cm bajo el hombro hasta `antes_del_puno` cm antes
    del puno (Oscar: corto se veia aplastado). Se lee del hombro al puno y sin espejo en las dos: visto de
    lado, girando la cabeza a la derecha. Cada vertice de la manga toma (s, w): s = largo de arco sobre el
    eje hombro-codo-muneca y w = su distancia a la linea de afuera vista de frente a ella (proyeccion plana,
    no el arco: con el arco las letras se veian aplastadas al rodear la manga). Lo que queda a mas de
    `abierto` grados de esa linea cae en el negro."""
    (u0, v0, du, dv) = sitio
    hh, cc, _ = brazo('l')
    largo = (cc - hh).length + (T_ORILLA - 2.0 - antes_del_puno) - inicio   # el puno empieza 2 cm antes de la orilla
    H = largo / aspecto
    Z = Vector((0, 0, 1))
    impresas = {}
    for lado in ('l', 'r'):
        sg = 1 if lado == 'l' else -1
        h, c, mu = brazo(lado)
        tramos = [(h, c), (c, mu)]
        largos = [(b - a).length for a, b in tramos]
        def eje(p):
            """(s, punto del eje, direccion) mas cercano a p sobre los dos tramos."""
            mejor = None; acum = 0.0
            for (a, b), L in zip(tramos, largos):
                d = (b - a) / L
                t = min(max((p - a).dot(d), 0.0), L)
                q = a + d * t
                dist = (p - q).length
                if mejor is None or dist < mejor[0]:
                    mejor = (dist, acum + t, q, d)
                acum += L
            return mejor[1], mejor[2], mejor[3]
        n_ok = 0
        for poly in me.polygons:
            if poly.material_index != TELA or max(poly.vertices) >= n_tela or poly.center.x * sg < 18:
                continue
            datos = []
            for li in poly.loop_indices:
                p = me.vertices[me.loops[li].vertex_index].co
                s, q, d = eje(p)
                n = (Z - d * Z.dot(d)).normalized()       # la linea de afuera de la manga
                b = n.cross(d).normalized()                 # hacia donde apunta lo de arriba de las letras
                r = p - q; r = r - d * r.dot(d)
                phi = math.atan2(r.dot(b), r.dot(n))
                datos.append((li, s, phi, r.length))
            sc = sum(x[1] for x in datos) / len(datos)
            if sc < inicio - 3 or sc > inicio + largo + 3 or any(abs(math.degrees(x[2])) > abierto for x in datos):
                continue
            rel = [(li, (s - inicio) / largo, 0.5 + rr * math.sin(phi) / H) for li, s, phi, rr in datos]
            ab = _a_la_imagen([(a, b) for _, a, b in rel], margen)
            if ab is None:
                continue
            for (li, _, _), (a, b) in zip(rel, ab):
                uv.data[li].uv = (u0 + a * du, v0 + b * dv)
            n_ok += 1
        impresas[lado] = n_ok
    return dict(caras=impresas, largo_cm=round(largo, 1), alto_cm=round(H, 1))


def grosor(o, t=0.55):
    activo(o)
    m = o.modifiers.new("grosor", 'SOLIDIFY')
    # sin even offset (en la chamarra disparaba vertices en los dobleces)
    m.thickness = t; m.offset = -1.0; m.use_rim = True; m.use_even_offset = False; m.use_quality_normals = True
    m.material_offset = 1; m.material_offset_rim = 0
    bpy.ops.object.modifier_apply(modifier=m.name)
    return forro_adentro(o)


def forro_adentro(o, holgura=0.3, vueltas=10):
    """En el pliegue de la axila la cara de adentro (desplazada sin even offset) cruzaba la de afuera y
    el forro se asomaba como un punto oscuro. Primero cada vertice del forro que quede afuera, o a menos
    de holgura de la cara de afuera, regresa abajo de ella; luego, mientras alguna cara del forro cruce
    la de afuera, sus vertices bajan un poco mas. Regresa (vertices movidos, cruces que quedan)."""
    me = o.data
    fuera = [tuple(p.vertices) for p in me.polygons if p.material_index == TELA]
    dentro = [tuple(p.vertices) for p in me.polygons if p.material_index == FORRO]
    en_fuera = {i for f in fuera for i in f}
    forro = sorted({i for f in dentro for i in f} - en_fuera)
    movidos = set()
    cruces = 0
    for vuelta in range(vueltas):
        vs = [v.co.copy() for v in me.vertices]
        bvh = BVHTree.FromPolygons(vs, fuera)
        if vuelta == 0:
            cuales = forro; h = holgura
        else:
            bd = BVHTree.FromPolygons(vs, dentro)
            pares = [(i, j) for i, j in bvh.overlap(bd) if not (set(fuera[i]) & set(dentro[j]))]
            cruces = len(pares)
            if not pares:
                break
            cuales = sorted({k for _, j in pares for k in dentro[j]} - en_fuera)
            h = holgura + 0.1 * vuelta
        for i in cuales:
            loc, nrm, _, d = bvh.find_nearest(vs[i], 2.0)
            if loc is not None and (vs[i] - loc).dot(nrm) > -h:
                me.vertices[i].co = loc - nrm * h
                movidos.add(i)
    me.update()
    vs = [v.co.copy() for v in me.vertices]
    bvh = BVHTree.FromPolygons(vs, fuera); bd = BVHTree.FromPolygons(vs, dentro)
    cruces = sum(1 for i, j in bvh.overlap(bd) if not (set(fuera[i]) & set(dentro[j])))
    return len(movidos), cruces
def lazo_ordenado(semilla):
    orden = [semilla]; prev = None; v = semilla
    while True:
        sig = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
        sig = [w for w in sig if w is not prev]
        if not sig or sig[0] is semilla:
            break
        prev, v = v, sig[0]
        orden.append(v)
        if len(orden) > 100000:
            break
    return orden


def lazos(o):
    """Orillas de la tela (antes del grosor): cuello, abajo y puños, cada una [(punto, normal)] en orden."""
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    vistos = set(); todos = []
    for v in bm.verts:
        if v.is_boundary and v not in vistos:
            l = lazo_ordenado(v)
            vistos.update(l)
            todos.append([(w.co.copy(), w.normal.copy()) for w in l])
    bm.free()
    def prom(l, f):
        return sum(f(p) for p, _ in l) / len(l)
    cuello = max(todos, key=lambda l: prom(l, lambda p: p.z))
    abajo = min(todos, key=lambda l: prom(l, lambda p: p.z))
    punos = [l for l in todos if abs(prom(l, lambda p: p.x)) > 40]
    pl = max(punos, key=lambda l: prom(l, lambda p: p.x))
    return dict(cuello=cuello, abajo=abajo, puno_l=pl, n=len(todos))


def desde_plano(l, atras=True):
    """El lazo empezando en el punto exacto donde cruza x=0 (atrás o al frente) y siguiendo hacia x>0."""
    n = len(l); mejor = None
    for i in range(n):
        (a, na), (b, nb) = l[i], l[(i + 1) % n]
        if (a.x <= 0 < b.x) or (b.x <= 0 < a.x):
            t = a.x / (a.x - b.x)
            p = a.lerp(b, t); p.x = 0.0
            q = na.lerp(nb, t); q.x = 0.0
            if mejor is None or ((p.y > mejor[0].y) if atras else (p.y < mejor[0].y)):
                mejor = (p, q.normalized(), i)
    p, q, i = mejor
    nuevo = [(p, q)] + l[i + 1:] + l[:i + 1]
    if nuevo[1][0].x < 0:
        nuevo = [nuevo[0]] + list(reversed(nuevo[1:]))
    return nuevo


def remuestrear(l, m, cerrado=True):
    P = l + [l[0]] if cerrado else l
    L = [0.0]
    for (a, _), (b, _) in zip(P, P[1:]):
        L.append(L[-1] + (b - a).length)
    tot = L[-1]; out = []; j = 0
    for i in range(m):
        s = tot * i / m if cerrado else tot * i / (m - 1)
        while j < len(L) - 2 and L[j + 1] < s:
            j += 1
        t = (s - L[j]) / max(L[j + 1] - L[j], 1e-9)
        (a, na), (b, nb) = P[j], P[j + 1]
        out.append((a.lerp(b, t), na.lerp(nb, t).normalized()))
    return out, tot


def espejo(v):
    return Vector((-v.x, v.y, v.z))


# --- resorte y puños: tubo con corte de rectángulo redondeado, la cara de afuera acanalada
def perfil_banda(di, do, h0, h1, rc, panza=0.25):
    """[(n, u, afuera)] alrededor del corte, empezando abajo-afuera. afuera 0..1 = cuanto se acanala.
    Las esquinas de adentro (casi no se ven) llevan menos puntos."""
    pts = []
    def arco(cn, cu, a0, a1, k=3):
        for j in range(k):
            a = math.radians(a0 + (a1 - a0) * j / (k - 1))
            pts.append((cn + rc * math.cos(a), cu + rc * math.sin(a)))
    arco(do - rc, h0 + rc, -90, 0)
    pts.append((do + panza, (h0 + h1) / 2))
    arco(do - rc, h1 - rc, 0, 90)
    arco(di + rc, h1 - rc, 90, 180, 2)
    pts.append((di, (h0 + h1) / 2))
    arco(di + rc, h0 + rc, 180, 270, 2)
    mid = (di + do) / 2
    return [(n, u, min(1.0, max(0.0, (n - mid) / (do - mid)))) for n, u in pts], di


def barrer_banda(bm, marcos, perfiles, canal=0.3):
    """marcos [(origen, n, u)] en un lazo cerrado; perfiles[i] = (perfil, di). Acanalado en zigzag (cada 2)."""
    filas = []
    for i, ((o, n, u), (perf, di)) in enumerate(zip(marcos, perfiles)):
        c = canal if i % 2 == 0 else 0.0
        filas.append([bm.verts.new(o + n * (pn + c * f) + u * pu) for pn, pu, f in perf])
    caras = []
    m = len(perfiles[0][0])
    for k in range(len(filas)):
        f0, f1 = filas[k], filas[(k + 1) % len(filas)]
        perf, di = perfiles[k]
        for j in range(m):
            jj = (j + 1) % m
            cara = bm.faces.new((f0[j], f0[jj], f1[jj], f1[j]))
            dentro = perf[j][0] <= di + 1e-6 and perf[jj][0] <= di + 1e-6
            cara.material_index = FORRO if dentro else PUNO
            cara.smooth = True
            caras.append(cara)
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    return [v for f in filas for v in f], caras


def marcos_lazo(pts, u_fijo=None, centro=None):
    out = []
    n = len(pts)
    for i, (p, _) in enumerate(pts):
        t = (pts[(i + 1) % n][0] - pts[i - 1][0]).normalized()
        u = u_fijo
        nn = t.cross(u).normalized()
        ref = (p - centro)
        ref = ref - u * ref.dot(u)
        if nn.dot(ref) < 0:
            nn = -nn
        out.append((p, nn, u))
    return out


def resorte(bm, lazo, paso=1.35, di=-1.0, do=1.2, alto=(-6.0, 1.6), rc=1.0):
    pts = desde_plano(lazo, atras=True)
    L = sum((pts[(i + 1) % len(pts)][0] - pts[i][0]).length for i in range(len(pts)))
    m = int(L / paso) // 2 * 2
    pts, _ = remuestrear(pts, m)
    centro = sum((p for p, _ in pts), Vector()) / m
    marcos = marcos_lazo(pts, Vector((0, 0, 1)), centro)
    perf = perfil_banda(di, do, alto[0], alto[1], rc, panza=0.35)
    vs, caras = barrer_banda(bm, marcos, [perf] * m, canal=0.35)
    return vs, dict(muestras=m, largo=round(L, 1))


R_PUNO = 6.1   # radio de adentro del puño desde el eje del antebrazo (el antebrazo mide hasta 5.0 ahí)


def punos(bm, lazo_l, paso=1.15, do=1.5, alto=(-2.0, 5.0), rc=1.2):
    """Puño izquierdo sobre la orilla real de la manga; el derecho es su espejo."""
    h, c, mu = brazo('l')
    uf = (mu - c).normalized()
    # empezar donde el lazo queda mas abajo (no hay plano de simetria en la manga)
    i0 = min(range(len(lazo_l)), key=lambda i: lazo_l[i][0].z)
    pts = lazo_l[i0:] + lazo_l[:i0]
    L = sum((pts[(i + 1) % len(pts)][0] - pts[i][0]).length for i in range(len(pts)))
    m = int(L / paso) // 2 * 2
    pts, _ = remuestrear(pts, m)
    marcos = []; perfiles = []; radios = []
    for i, (p, _) in enumerate(pts):
        t = (pts[(i + 1) % m][0] - pts[i - 1][0]).normalized()
        q = p - c; r = q - uf * q.dot(uf)
        nn = t.cross(uf).normalized()
        if nn.dot(r) < 0:
            nn = -nn
        ri = r.length; radios.append(ri)
        marcos.append((p, nn, uf))
        perfiles.append(perfil_banda(R_PUNO - ri, do, alto[0], alto[1], rc, panza=0.45))
    vs, caras = barrer_banda(bm, marcos, perfiles, canal=0.35)
    # el derecho: los mismos vertices espejeados (con las caras al reves para que miren afuera)
    nuevos = {v: bm.verts.new(espejo(v.co)) for v in vs}
    caras_r = []
    for f in caras:
        g = bm.faces.new([nuevos[v] for v in reversed(f.verts)])
        g.material_index = f.material_index; g.smooth = True
        caras_r.append(g)
    return vs + list(nuevos.values()), dict(muestras=m, radio_orilla=(round(min(radios), 2), round(max(radios), 2)))


# --- capucha caida: tubo a lo largo de la orilla del cuello
CAP_ATRAS = (8.5, 4.8); CAP_LADO = (3.4, 1.8); CAP_FRENTE = (2.6, 1.1); CAP_PUNTA = (2.0, 1.0)


def _suave(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def capucha_medidas(s, p):
    """(A, B): medio ancho sobre la tela y alto. El bulto va atras; a los lados es la orilla de la capucha
    y al frente (donde baja la esquina de la quijada) y por la V queda plana."""
    c = math.cos(math.atan2(p.x, p.y - CUELLO_C.y))
    w = max(0.0, c) ** 1.5
    A = CAP_LADO[0] + (CAP_ATRAS[0] - CAP_LADO[0]) * w
    B = CAP_LADO[1] + (CAP_ATRAS[1] - CAP_LADO[1]) * w
    f = _suave(0.0, 0.4, -c)
    A += (CAP_FRENTE[0] - A) * f; B += (CAP_FRENTE[1] - B) * f
    t = _suave(0.8, 1.0, abs(s))
    return A + (CAP_PUNTA[0] - A) * t, B + (CAP_PUNTA[1] - B) * t


def capucha(bm, lazo, bvh_tela, m=96, k_seg=12, e=2.4, hundir=0.45, adentro=0.1):
    pts = desde_plano(lazo, atras=False)
    pts, L = remuestrear(pts, m)
    centro = sum((p for p, _ in pts), Vector()) / m
    camino = pts[1:]          # del fondo de la V, por la nuca, de regreso a la V (sin el punto del fondo)
    n = len(camino)
    datos = []
    for i, (p, nr) in enumerate(camino):
        s = -1 + 2 * (i + 1) / m
        a = camino[max(i - 1, 0)][0]; b = camino[min(i + 1, n - 1)][0]
        T = (b - a).normalized()
        Nn = (nr - T * nr.dot(T)).normalized()
        Bn = T.cross(Nn).normalized()
        if Bn.dot(p - centro) < 0:
            Bn = -Bn
        A, B = capucha_medidas(s, p)
        c = p + Bn * (A * (1 - adentro)) + Nn * (B - hundir)
        datos.append((c, T, Nn, Bn, A, B, s))
    filas = []
    for (c, T, Nn, Bn, A, B, s) in datos:
        fila = []
        for k in range(k_seg):
            th = 2 * math.pi * k / k_seg
            ct, st = math.cos(th), math.sin(th)
            x = A * math.copysign(abs(ct) ** (2 / e), ct)
            y = B * math.copysign(abs(st) ** (2 / e), st)
            q = c + Bn * x + Nn * y
            if st < 0:
                # la mitad de abajo se asienta sobre la tela
                loc, nq, _, _ = bvh_tela.find_nearest(q)
                if loc is not None:
                    q = q.lerp(loc - nq * 0.3, (-st) ** 0.8)
            fila.append(bm.verts.new(q))
        filas.append(fila)
    caras = []
    for f0, f1 in zip(filas, filas[1:]):
        for k in range(k_seg):
            kk = (k + 1) % k_seg
            caras.append(bm.faces.new((f0[k], f0[kk], f1[kk], f1[k])))
    # tapas redondas en las dos puntas
    for fila, (c, T, Nn, Bn, A, B, s), sentido in ((filas[0], datos[0], -1), (filas[-1], datos[-1], 1)):
        cen = sum((v.co for v in fila), Vector()) / len(fila)
        tip = bm.verts.new(cen + T * sentido * min(A, B) * 0.8)
        for k in range(k_seg):
            caras.append(bm.faces.new((fila[k], fila[(k + 1) % k_seg], tip)))
    for f in caras:
        f.material_index = CAPUCHA; f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    vs = list({v for f in caras for v in f.verts})
    return vs, datos, dict(muestras=n, largo=round(L, 1))


# --- cordones: salen de la orilla de la capucha y cuelgan pegados a la tela
R_CORDON = 0.45; R_PUNTA = 0.75; L_PUNTA = 3.2


def cordones(bm, datos_cap, bvh_tela, z_sale=109.5, largo=22.0, abre=1.2, pasos=26, seg=8):
    # sale de la orilla de la V del lado izquierdo, a la altura z_sale
    i = min((k for k in range(len(datos_cap)) if datos_cap[k][6] < 0 and datos_cap[k][0].y < -10),
            key=lambda k: abs(datos_cap[k][0].z - z_sale))
    c, T, Nn, Bn, A, B, s = datos_cap[i]
    inicio = c + Nn * (B * 0.2)
    camino = []
    for k in range(1, pasos + 1):
        u = k / pasos
        x = inicio.x + abre * u; z = inicio.z - largo * u
        hit = bvh_tela.ray_cast(Vector((x, -80.0, z)), Vector((0, 1, 0)))
        if hit[0] is None or hit[0].y > -8 or hit[1].y > 0:
            camino.append(None)
        else:
            camino.append(hit[0] + hit[1] * (R_PUNTA + 0.3))
    k0 = next(k for k, p in enumerate(camino) if p is not None)
    for k in range(k0):
        camino[k] = inicio.lerp(camino[k0], (k + 1) / (k0 + 1))
    camino = [inicio] + camino
    # largo de arco: la punta es lo ultimo
    L = [0.0]
    for a, b in zip(camino, camino[1:]):
        L.append(L[-1] + (b - a).length)
    tot = L[-1]
    filas = []; mats = []
    nrm = Nn.copy()
    for k, p in enumerate(camino):
        t = (camino[min(k + 1, len(camino) - 1)] - camino[max(k - 1, 0)]).normalized()
        nrm = (nrm - t * nrm.dot(t)).normalized()
        bn = t.cross(nrm)
        punta = L[k] > tot - L_PUNTA
        r = R_PUNTA if punta else R_CORDON
        filas.append([bm.verts.new(p + (nrm * math.cos(2 * math.pi * j / seg) + bn * math.sin(2 * math.pi * j / seg)) * r)
                      for j in range(seg)])
        mats.append(PUNTA if punta else CORDON)
    caras = []
    for k, (f0, f1) in enumerate(zip(filas, filas[1:])):
        for j in range(seg):
            jj = (j + 1) % seg
            f = bm.faces.new((f0[j], f0[jj], f1[jj], f1[j]))
            f.material_index = mats[k + 1]; caras.append(f)
    t0 = (camino[1] - camino[0]).normalized(); t1 = (camino[-1] - camino[-2]).normalized()
    for fila, p, t, mat in ((filas[0], camino[0], -t0, CORDON), (filas[-1], camino[-1], t1, PUNTA)):
        tip = bm.verts.new(p + t * (R_PUNTA if mat == PUNTA else R_CORDON) * 0.8)
        for j in range(seg):
            f = bm.faces.new((fila[j], fila[(j + 1) % seg], tip)); f.material_index = mat; caras.append(f)
    for f in caras:
        f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    vs = list({v for f in caras for v in f.verts})
    # el otro cordon: espejo
    nuevos = {v: bm.verts.new(espejo(v.co)) for v in vs}
    for f in caras:
        g = bm.faces.new([nuevos[v] for v in reversed(f.verts)])
        g.material_index = f.material_index; g.smooth = True
    return vs + list(nuevos.values()), dict(puntos=len(camino), largo=round(tot, 1), sale=[round(x, 1) for x in inicio])


# --- pesos
PIEZAS_CUERPO = ["Egg_Torax", "Egg_Arm1_L", "Egg_Arm1_R", "Egg_Arm2_L", "Egg_Arm2_R", "Egg_Pelvis"]
DEDOS = ("thumb", "index", "middle", "ring", "pinky")


def remapeo(nombre):
    if nombre.startswith(DEDOS) or nombre.startswith("c_"):
        return None
    if nombre.startswith("hand."):
        return "forearm_twist." + nombre.split(".")[1]
    if nombre == "head.x":
        return "neck.x"
    if nombre.startswith(("thigh", "leg", "foot", "toes", "prop_", "spline")):
        return "root.x"
    return nombre


def limpiar(d, max_huesos=4):
    top = sorted(d.items(), key=lambda kv: -kv[1])[:max_huesos]
    s = sum(w for _, w in top)
    return {k: w / s for k, w in top if s > 0 and w / s > 0.01} if s > 0 else {}


def suavizar_pesos(pesos, idx, vecinos, rep, factor):
    for _ in range(rep):
        nuevos = {}
        for i in idx:
            acc = {}
            for j in vecinos[i]:
                for k, w in pesos[j].items():
                    acc[k] = acc.get(k, 0.0) + w
            nv = len(vecinos[i]) or 1
            f = factor(i) if callable(factor) else factor
            nuevos[i] = {k: pesos[i].get(k, 0.0) * (1 - f) + acc.get(k, 0.0) / nv * f for k in set(acc) | set(pesos[i])}
        for i, d in nuevos.items():
            pesos[i] = d


def pesar_tela(o, repeticiones=10, factor=0.5, axila=(25.0, 1.5, 104.0), radio_axila=22.0, rep_axila=140,
               radio_codo=15.0, rep_codo=90):
    """Pesos de la tela (la malla en este momento es solo la tela con grosor)."""
    vl = bpy.context.view_layer
    copias = []
    for n in PIEZAS_CUERPO:
        src = bpy.data.objects[n]
        c = src.copy(); c.data = src.data.copy(); c.modifiers.clear()
        col_tmp().objects.link(c); copias.append(c)
    for x in vl.objects:
        x.select_set(False)
    for c in copias:
        c.select_set(True)
    vl.objects.active = copias[0]
    bpy.ops.object.join()
    cuerpo = copias[0]; cuerpo.name = "tmp_cuerpo_hoodie"
    o.vertex_groups.clear()
    for g in cuerpo.vertex_groups:
        o.vertex_groups.new(name=g.name)
    m = o.modifiers.new("pesos", 'DATA_TRANSFER')
    m.object = cuerpo; m.use_vert_data = True; m.data_types_verts = {'VGROUP_WEIGHTS'}
    m.vert_mapping = 'POLYINTERP_NEAREST'
    m.layers_vgroup_select_src = 'ALL'; m.layers_vgroup_select_dst = 'NAME'
    activo(o)
    bpy.ops.object.modifier_apply(modifier=m.name)
    borrar("tmp_cuerpo_hoodie")
    me = o.data
    nombres = {g.index: g.name for g in o.vertex_groups}
    pesos = []
    for v in me.vertices:
        d = {}
        for g in v.groups:
            if g.weight <= 1e-4:
                continue
            dst = remapeo(nombres[g.group])
            if dst:
                d[dst] = d.get(dst, 0.0) + g.weight
        pesos.append(d)
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    vecinos = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    coords = [v.co.copy() for v in bm.verts]
    bm.free()
    todos = list(range(len(pesos)))
    suavizar_pesos(pesos, todos, vecinos, repeticiones, factor)
    for s in (1, -1):
        A = Vector((axila[0] * s, axila[1], axila[2]))
        zona = {i: 1 - (coords[i] - A).length / radio_axila for i in todos if (coords[i] - A).length < radio_axila}
        suavizar_pesos(pesos, list(zona), vecinos, rep_axila, lambda i: 0.6 * zona[i])
    # codos: los clips los doblan 60-80 grados mas que el reposo y el pliegue de adentro se colapsaba
    # sobre el antebrazo; repartir el paso de brazo a antebrazo en mas tela lo redondea
    for lado in ('l', 'r'):
        C = brazo(lado)[1]
        zona = {i: 1 - (coords[i] - C).length / radio_codo for i in todos if (coords[i] - C).length < radio_codo}
        suavizar_pesos(pesos, list(zona), vecinos, rep_codo, lambda i: 0.6 * zona[i])
    pesos = [limpiar(d) for d in pesos]
    escribir_pesos(o, pesos)
    return dict(sin_peso=sum(1 for d in pesos if not d))


def escribir_pesos(o, pesos):
    o.vertex_groups.clear()
    usados = sorted({k for d in pesos for k in d})
    grupos = {k: o.vertex_groups.new(name=k) for k in usados}
    for i, d in enumerate(pesos):
        for k, w in d.items():
            grupos[k].add([i], w, 'REPLACE')


def leer_pesos(o):
    nombres = {g.index: g.name for g in o.vertex_groups}
    return [{nombres[g.group]: g.weight for g in v.groups if g.weight > 0} for v in o.data.vertices]


def pesos_desde_tela(o, n_tela, rep=6):
    """Cada vertice agregado (indice >= n_tela) con el peso de la tela de afuera justo bajo el,
    interpolado en el triangulo que pisa; luego suavizado dentro de su pieza."""
    me = o.data
    pesos = leer_pesos(o)
    tris = []
    for p in me.polygons:
        if p.material_index == TELA and all(i < n_tela for i in p.vertices):
            vv = list(p.vertices)
            for t in range(1, len(vv) - 1):
                tris.append((vv[0], vv[t], vv[t + 1]))
    bvh = BVHTree.FromPolygons([v.co for v in me.vertices], tris)
    nuevos = range(n_tela, len(me.vertices))
    for i in nuevos:
        co = me.vertices[i].co
        loc, _, ti, _ = bvh.find_nearest(co)
        a, b, c = tris[ti]
        A, B, C = me.vertices[a].co, me.vertices[b].co, me.vertices[c].co
        bar = barycentric_transform(loc, A, B, C, Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        acc = {}
        for idx, w in zip((a, b, c), (bar.x, bar.y, bar.z)):
            for k, pw in pesos[idx].items():
                acc[k] = acc.get(k, 0.0) + max(w, 0.0) * pw
        pesos[i] = limpiar(acc)
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    vecinos = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    bm.free()
    suavizar_pesos(pesos, list(nuevos), vecinos, rep, 0.5)
    for i in nuevos:
        pesos[i] = limpiar(pesos[i])
    escribir_pesos(o, pesos)


def espejar_pesos(o):
    """Los pesos de x<0 = los de su espejo en x>0 (.l <-> .r)."""
    me = o.data
    # la fila del centro (|x| < 0.05) se queda con sus pesos: la de la capucha no cae exacta en x = 0
    izq = [v.index for v in me.vertices if v.co.x > -0.05]
    kd = KDTree(len(izq))
    for i in izq:
        kd.insert(me.vertices[i].co, i)
    kd.balance()
    pesos = leer_pesos(o)
    def cambia(n):
        if n.endswith(".l"): return n[:-2] + ".r"
        if n.endswith(".r"): return n[:-2] + ".l"
        return n
    peor = 0.0
    for v in me.vertices:
        if v.co.x > -0.05:
            continue
        _, j, d = kd.find(espejo(v.co))
        peor = max(peor, d)
        pesos[v.index] = {cambia(k): w for k, w in pesos[j].items()}
    escribir_pesos(o, pesos)
    return round(peor, 4)


def montar(o):
    vieja = bpy.data.objects.get(NOMBRE)
    if vieja and vieja is not o:
        borrar(NOMBRE)
    o.name = NOMBRE; o.data.name = NOMBRE
    destino = bpy.data.objects["Boxers"].users_collection[0]
    for c in list(o.users_collection):
        c.objects.unlink(o)
    destino.objects.link(o)
    mw = ARM.matrix_world.copy()
    o.parent = ARM
    o.matrix_parent_inverse = ARM.matrix_world.inverted()
    o.matrix_world = mw
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    a = o.modifiers.new("Armature", 'ARMATURE'); a.object = ARM; a.use_vertex_groups = True
    return o


def todo():
    borrar(NOMBRE)
    o = unir_y_remallar()
    materiales(o)
    orillas = lazos(o)
    if orillas["n"] != 4:
        raise RuntimeError(f"la tela salio con {orillas['n']} orillas (cuello, abajo y dos punos): QuadriFlow cerro o abrio algo")
    # la tela de afuera, antes del grosor, para asentar la capucha y los cordones
    bm0 = bmesh.new(); bm0.from_mesh(o.data)
    bvh_tela = BVHTree.FromBMesh(bm0); bm0.free()
    info = dict(orillas=orillas["n"], volteadas=o.get("volteadas"))
    info["forro"] = grosor(o)
    info["tela"] = pesar_tela(o)
    n_tela = len(o.data.vertices)
    bm = bmesh.new(); bm.from_mesh(o.data)
    _, info["resorte"] = resorte(bm, orillas["abajo"])
    _, info["punos"] = punos(bm, orillas["puno_l"])
    _, datos_cap, info["capucha"] = capucha(bm, orillas["cuello"], bvh_tela)
    _, info["cordones"] = cordones(bm, datos_cap, bvh_tela)
    bm.to_mesh(o.data); bm.free(); o.data.update()
    pesos_desde_tela(o, n_tela)
    info["espejo"] = espejar_pesos(o)
    info["estampado"] = estampar(o, n_tela)
    montar(o)
    for c in list(col_tmp().objects):
        borrar(c.name)
    bpy.data.collections.remove(col_tmp())
    me = o.data
    info["verts"] = len(me.vertices)
    info["tris"] = sum(len(p.vertices) - 2 for p in me.polygons)
    info["huesos"] = len(o.vertex_groups)
    return o, info


# ===================== revision =====================
# Cuerpo contra ropa por cruce de superficies (triangulo contra triangulo): si el cuerpo va bien adentro
# nunca cruza la cara de adentro, y lo que va afuera (quijada, cabeza) nunca cruza la de afuera ni la
# capucha. Asi no importa que parte de la ropa envuelve a cada hueso (el antebrazo pegado al costado va
# bien metido en su manga aunque la cara mas cercana sea la del torso). La profundidad se mide solo
# contra las caras que de verdad se cruzan, del lado de la tela (todas las normales miran hacia afuera
# de la tela: las de adentro, hacia el cuerpo).
CUERPO = ["Egg_Torax", "Egg_Arm1_L", "Egg_Arm1_R", "Egg_Arm2_L", "Egg_Arm2_R", "Egg_Pelvis",
          "Egg_Jaw", "Egg_Head", "Egg_Leg2_L", "Egg_Leg2_R"]
BRAZO = ("arm_", "forearm_")
HONDO_MAX = 3.0   # mas alla de esto la prueba de lado ya no es confiable: 3.0 se lee como 3 o mas


def _pos(o, dg):
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    m = ARM.matrix_world.inverted() @ o.matrix_world
    co = [0.0] * (3 * len(me.vertices)); me.vertices.foreach_get("co", co)
    vs = [m @ Vector(co[i:i + 3]) for i in range(0, len(co), 3)]
    oe.to_mesh_clear()
    return vs


def preparar(nombre=NOMBRE):
    """Lo que no cambia entre cuadros: caras con su zona (manga_l/r, axila, torso, resorte, puno, capucha,
    cordon), las caras de afuera de manga y torso, y la topologia de las piezas del cuerpo."""
    o = bpy.data.objects[nombre]; me = o.data
    caras = [(tuple(p.vertices), p.material_index) for p in me.polygons]
    padre = list(range(len(me.vertices)))
    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]; i = padre[i]
        return i
    for vs, _ in caras:
        for a in vs[1:]:
            ra, rb = raiz(vs[0]), raiz(a)
            if ra != rb:
                padre[ra] = rb
    islas = {}
    for k, (vs, m) in enumerate(caras):
        islas.setdefault(raiz(vs[0]), []).append(k)
    co = [v.co.copy() for v in me.vertices]
    def nombre_isla(ks):
        mats = {caras[k][1] for k in ks}
        c = sum((co[caras[k][0][0]] for k in ks), Vector()) / len(ks)
        if mats & {CORDON, PUNTA}: return "cordon"
        if PUNO in mats: return "resorte" if c.z < Z_ORILLA + 2 else ("puno_l" if c.x > 0 else "puno_r")
        if CAPUCHA in mats: return "capucha"
        if FORRO in mats: return "tela"
        return "capucha"
    pieza = [None] * len(caras)
    for ks in islas.values():
        nm = nombre_isla(ks)
        for k in ks:
            pieza[k] = nm
    nombres = {g.index: g.name for g in o.vertex_groups}
    fb = []
    for v in me.vertices:
        b = t = 0.0
        for g in v.groups:
            if nombres[g.group].startswith(BRAZO): b += g.weight
            else: t += g.weight
        fb.append(b / ((b + t) or 1))
    etiqueta = []; manga = []; torso = []
    for k, (vs, m) in enumerate(caras):
        if pieza[k] != "tela":
            etiqueta.append(pieza[k]); continue
        f = sum(fb[i] for i in vs) / len(vs)
        cx = sum(co[i].x for i in vs) / len(vs)
        if f >= 0.85:
            etiqueta.append("manga_l" if cx > 0 else "manga_r")
            if m == TELA: manga.append(k)
        elif f <= 0.15:
            etiqueta.append("torso")
            if m == TELA: torso.append(k)
        else:
            etiqueta.append("axila")
    cuerpo = {}
    for n in CUERPO:
        ob = bpy.data.objects.get(n)
        if ob:
            cuerpo[n] = dict(polys=[tuple(p.vertices) for p in ob.data.polygons], nv=len(ob.data.vertices))
    return dict(o=o, polys=[c for c, _ in caras], etiqueta=etiqueta, manga=manga, torso=torso,
                v_manga=sorted({i for k in manga for i in caras[k][0]}), x_reposo=[p.x for p in co], cuerpo=cuerpo)


def _hondo(puntos, vs, polys, ks):
    """Lo mas que se meten los puntos del lado de la tela de las caras ks (y cuantos)."""
    g = BVHTree.FromPolygons(vs, [polys[k] for k in ks])
    h = 0.0; c = 0
    for p in puntos:
        loc, nrm, _, d = g.find_nearest(p, HONDO_MAX)
        if loc is not None and (p - loc).dot(nrm) < 0:
            c += 1; h = max(h, d)
    return h, c


def revisar_cuadro(R):
    """Un cuadro. pen[(pieza del cuerpo, zona de la ropa)] = (cm que se mete, vertices, pares de triangulos
    que se cruzan); manga = lo que la manga se mete en el costado por lado (cm, pares)."""
    dg = bpy.context.evaluated_depsgraph_get()
    vs = _pos(R["o"], dg)
    polys = R["polys"]
    ropa = BVHTree.FromPolygons(vs, polys)
    pen = {}
    for n, pb in R["cuerpo"].items():
        bv = _pos(bpy.data.objects[n], dg)
        if len(bv) != pb["nv"]:
            raise RuntimeError(f"{n}: la malla evaluada cambio de topologia")
        pares = ropa.overlap(BVHTree.FromPolygons(bv, pb["polys"]))
        por = {}
        for kr, _ in pares:
            por.setdefault(R["etiqueta"][kr], []).append(kr)
        for et, ks in por.items():
            h, c = _hondo(bv, vs, polys, sorted(set(ks)))
            pen[(n, et)] = (h, c, len(ks))
    t = BVHTree.FromPolygons(vs, [polys[k] for k in R["torso"]])
    m = BVHTree.FromPolygons(vs, [polys[k] for k in R["manga"]])
    pares = m.overlap(t)
    manga = {"l": [0.0, 0], "r": [0.0, 0]}
    if pares:
        for a, _ in pares:
            k = R["manga"][a]
            manga["l" if R["etiqueta"][k] == "manga_l" else "r"][1] += 1
        ks = sorted({R["torso"][b] for _, b in pares})
        for s in ("l", "r"):
            pts = [vs[i] for i in R["v_manga"] if (R["x_reposo"][i] > 0) == (s == "l")]
            manga[s][0] = round(_hondo(pts, vs, polys, ks)[0], 2)
    return pen, manga


def reposo():
    for pb in ARM.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    aj = ARM.pose.bones["ctl_ajustes"]
    for k in ("rig", "ik_pierna_l", "ik_pierna_r", "ik_brazo_l", "ik_brazo_r"):
        if k in aj:
            aj[k] = 1
    bpy.context.view_layer.update()


def _fmt(pen):
    return {f"{a}>{b}": (round(h, 2), c, p) for (a, b), (h, c, p) in sorted(pen.items())}


def medir(accion, desde=None, hasta=None, R=None, archivo=None):
    """Cada cuadro de una accion (o de desde..hasta). Regresa la lista por cuadro; con archivo, la agrega ahi (json lines)."""
    R = R or preparar()
    ad = ARM.animation_data; sc = bpy.context.scene
    f_ori = sc.frame_current
    out = []
    try:
        act = bpy.data.actions[accion]; ad.action = act
        if len(act.slots):
            ad.action_slot = act.slots[0]
        f0, f1 = [int(round(x)) for x in act.frame_range]
        for f in range(desde or f0, (hasta or f1) + 1):
            sc.frame_set(f)
            pen, manga = revisar_cuadro(R)
            fila = dict(accion=accion, f=f, pen=_fmt(pen), manga=manga)
            out.append(fila)
            if archivo:
                with open(archivo, "a", encoding="utf-8") as fh:
                    fh.write(json.dumps(fila) + "\n")
    finally:
        ad.action = None
        reposo()
        sc.frame_set(f_ori)
    return out


def resumir(filas):
    """Por zona: en cuantos cuadros se cruza, lo mas hondo y en que cuadro; y la manga en el costado."""
    out = {}
    for fl in filas:
        for k, (h, c, p) in fl["pen"].items():
            d = out.setdefault(k, dict(cuadros=0, max_cm=0.0, en=None))
            d["cuadros"] += 1
            if h >= d["max_cm"]:
                d["max_cm"] = h; d["en"] = fl["f"]
    man = {s: dict(cuadros=sum(1 for fl in filas if fl["manga"][s][1]),
                   max_cm=max(fl["manga"][s][0] for fl in filas),
                   max_pares=max(fl["manga"][s][1] for fl in filas)) for s in ("l", "r")}
    return dict(cuadros=len(filas), limpios=sum(1 for fl in filas if not fl["pen"]), pen=out, manga=man)


def _abrir_brazos(grados):
    """Abre los dos brazos desde el hombro (arm_stretch, que lleva el giro, el antebrazo y la mano), girando
    en el plano del frente del torso, como apartaManos. Se aplica sobre el cuadro ya puesto."""
    P = ARM.pose.bones
    rs = ARM.data.bones["spine_03.x"].matrix_local.to_3x3()
    frente = (P["spine_03.x"].matrix.to_3x3() @ rs.inverted()) @ Vector((0, -1, 0))
    for lado, s in (("l", 1), ("r", -1)):
        pb = P["arm_stretch." + lado]
        p = pb.head.copy()
        # el signo que aleja el codo del cuerpo
        R = Matrix.Rotation(math.radians(grados) * s, 4, frente)
        pb.matrix = Matrix.Translation(p) @ R @ Matrix.Translation(-p) @ pb.matrix
    bpy.context.view_layer.update()


def _costado(R, vs):
    """Por lado: pares manga-torso y si el brazo cruza el torso, la axila o el resorte."""
    polys = R["polys"]
    t = BVHTree.FromPolygons(vs, [polys[k] for k in R["torso"]])
    m = BVHTree.FromPolygons(vs, [polys[k] for k in R["manga"]])
    out = {"l": 0, "r": 0}
    for a, _ in m.overlap(t):
        out["l" if R["etiqueta"][R["manga"][a]] == "manga_l" else "r"] += 1
    zona = [k for k, e in enumerate(R["etiqueta"]) if e in ("torso", "axila", "resorte")]
    bz = BVHTree.FromPolygons(vs, [polys[k] for k in zona])
    dg = bpy.context.evaluated_depsgraph_get()
    for lado, sufijo in (("l", "_L"), ("r", "_R")):
        for n in ("Egg_Arm1" + sufijo, "Egg_Arm2" + sufijo):
            bv = _pos(bpy.data.objects[n], dg)
            out[lado] += len(bz.overlap(BVHTree.FromPolygons(bv, R["cuerpo"][n]["polys"])))
    return out


def apertura_necesaria(accion, R=None, paso=3, tope=36):
    """Por cuadro y lado, cuantos grados hay que abrir el brazo para que ni la manga cruce el costado ni el
    brazo cruce torso, axila o resorte (None = ni con el tope). Verifica que el signo de giro abra."""
    R = R or preparar()
    ad = ARM.animation_data; sc = bpy.context.scene; P = ARM.pose.bones
    f_ori = sc.frame_current
    out = {}
    try:
        act = bpy.data.actions[accion]; ad.action = act
        if len(act.slots):
            ad.action_slot = act.slots[0]
        f0, f1 = [int(round(x)) for x in act.frame_range]
        for f in range(f0, f1 + 1):
            falta = {"l": None, "r": None}
            for g in range(0, tope + 1, paso):
                sc.frame_set(f)
                if g:
                    antes = {s: abs(P["hand." + s].head.x) for s in ("l", "r")}
                    _abrir_brazos(g)
                    if f == f0 and g == paso:
                        abre = {s: abs(P["hand." + s].head.x) > antes[s] for s in ("l", "r")}
                        if not all(abre.values()):
                            raise RuntimeError(f"el giro no abre los brazos: {abre}")
                c = _costado(R, _pos(R["o"], bpy.context.evaluated_depsgraph_get()))
                for s in ("l", "r"):
                    if falta[s] is None and c[s] == 0:
                        falta[s] = g
                if falta["l"] is not None and falta["r"] is not None:
                    break
            out[f] = falta
    finally:
        ad.action = None
        reposo()
        sc.frame_set(f_ori)
    return out


def revisar_reposo(angulos=(0, 20, 35)):
    """En reposo, y con la quijada abierta: cruces y la distancia minima de la quijada a la ropa."""
    reposo()
    R = preparar()
    P = ARM.pose.bones
    out = {}
    try:
        for ang in angulos:
            P["ctl_quijada"].rotation_euler = (math.radians(ang), 0, 0)
            bpy.context.view_layer.update()
            pen, manga = revisar_cuadro(R)
            dg = bpy.context.evaluated_depsgraph_get()
            t = BVHTree.FromPolygons(_pos(R["o"], dg), R["polys"])
            jaw = min(t.find_nearest(p)[3] for p in _pos(bpy.data.objects["Egg_Jaw"], dg))
            out[ang] = dict(pen=_fmt(pen), manga=manga, quijada_cm=round(jaw, 2))
    finally:
        P["ctl_quijada"].rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
    return out


# ===================== renders =====================
VISTAS = {
    "frente": ((0.0, -5.6, 1.15), (0.0, 0.0, 1.12)),
    "tres_cuartos": ((3.2, -4.6, 1.5), (0.0, 0.0, 1.12)),
    "espalda": ((0.0, 5.6, 1.3), (0.0, 0.0, 1.12)),
    "lado": ((5.6, 0.0, 1.15), (0.0, 0.0, 1.12)),
    "cuello": ((1.6, -2.6, 2.1), (0.0, 0.05, 1.18)),
}


def render(carpeta, vistas=None, accion=None, cuadro=None, res=(1000, 1300), muestras=16, ocultar=("Chamarra",), lente=85):
    """Renders con una camara temporal; deja la escena (camara, resolucion, salida, visibles) como estaba."""
    import os
    sc = bpy.context.scene; r = sc.render
    antes = dict(cam=sc.camera, rx=r.resolution_x, ry=r.resolution_y, pct=r.resolution_percentage, fp=r.filepath,
                 smp=sc.eevee.taa_render_samples, frame=sc.frame_current,
                 ocultos={n: bpy.data.objects[n].hide_render for n in ocultar if n in bpy.data.objects})
    cd = bpy.data.cameras.new("Hoodie_cam_tmp"); cd.lens = lente
    cam = bpy.data.objects.new("Hoodie_cam_tmp", cd)
    sc.collection.objects.link(cam)
    ad = ARM.animation_data
    hechos = []
    try:
        sc.camera = cam
        r.resolution_x, r.resolution_y = res; r.resolution_percentage = 100
        sc.eevee.taa_render_samples = muestras
        for n in antes["ocultos"]:
            bpy.data.objects[n].hide_render = True
        if accion:
            act = bpy.data.actions[accion]; ad.action = act
            if len(act.slots):
                ad.action_slot = act.slots[0]
            sc.frame_set(cuadro)
        for nombre in (vistas or VISTAS):
            loc, mira = VISTAS[nombre]
            cam.location = loc
            cam.rotation_euler = (Vector(mira) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
            ruta = os.path.join(carpeta, f"hoodie_{nombre}{'_' + str(cuadro) if accion else ''}.png")
            r.filepath = ruta
            bpy.ops.render.render(write_still=True)
            hechos.append(ruta)
    finally:
        if accion:
            ad.action = None
            reposo()
        sc.camera = antes["cam"]
        r.resolution_x, r.resolution_y, r.resolution_percentage = antes["rx"], antes["ry"], antes["pct"]
        r.filepath = antes["fp"]; sc.eevee.taa_render_samples = antes["smp"]
        for n, h in antes["ocultos"].items():
            bpy.data.objects[n].hide_render = h
        sc.frame_set(antes["frame"])
        bpy.data.objects.remove(cam, do_unlink=True)
        bpy.data.cameras.remove(cd)
    return hechos
