"""
Arma la chamarra de piel de Skulley (prop "Chamarra") en Character/SkulleyRad.blend.

En Blender, en modo objeto:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
Reemplaza el objeto Chamarra si ya existe. Todo va en las coordenadas del armature (cm):
torso de anillos superelípticos + mangas de cápsulas, unidos con voxel remesh y
QuadriFlow (6000 caras: con menos cerraba los puños); abertura del frente en V y
cuello; solapas y cuello doblados sobre la superficie; grosor (Solidify sin even
offset: en el doblez de 180° disparaba vértices); picos en los hombros, dientes del
cierre, jaladera y broches; pesos transferidos de las piezas del cuerpo, suavizados
y más en las axilas; hijo del armature con su modificador.
revisar_traspasos.py mide lo que el cuerpo se mete en la chamarra.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

ARM = bpy.data.objects["root"]
TMP = "Chamarra_tmp"


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
    # en las coordenadas del armature (cm): misma matriz que el armature
    o.matrix_world = ARM.matrix_world.copy()
    return o


# --- torso: anillos superelipticos (z, a = medio ancho, yf = frente, yb = espalda, n)
# Pegadita al cuerpo (~1.7 cm del esqueleto, Oscar: por atrás se veía abultada y
# acartonada) y acampanada abajo, como pantalón de campana: de la cintura (lo
# justo para que no se asomen los bóxers) a la bastilla se abre ~3.5 cm.
ANILLOS = [
    (61.0, 25.0, -22.5, 23.0, 2.2),
    (65.0, 23.6, -21.2, 21.8, 2.2),
    (69.0, 21.4, -19.2, 20.2, 2.3),
    (73.0, 20.3, -18.0, 19.4, 2.3),
    (78.0, 20.2, -17.6, 19.3, 2.4),
    (84.0, 20.9, -18.0, 20.0, 2.4),
    (90.0, 21.2, -18.8, 20.3, 2.4),
    (96.0, 21.0, -17.8, 20.9, 2.4),
    (102.0, 21.4, -16.0, 20.6, 2.5),
    (107.0, 23.0, -14.6, 20.2, 2.6),
    (111.0, 24.4, -13.4, 19.6, 2.6),
    (115.0, 24.8, -12.0, 17.4, 2.7),
    (119.0, 24.6, -10.4, 14.8, 2.6),
    (122.0, 22.0, -9.0, 13.0, 2.4),
    (123.4, 17.5, -7.6, 11.4, 2.3),
    (124.4, 10.0, -5.2, 9.0, 2.2),
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
    filas = []
    for (z, a, yf, yb, n) in ANILLOS:
        filas.append([bm.verts.new(p) for p in anillo(z, a, yf, yb, n)])
    for f0, f1 in zip(filas, filas[1:]):
        for i in range(N):
            j = (i + 1) % N
            bm.faces.new((f0[i], f0[j], f1[j], f1[i]))
    bm.faces.new(list(reversed(filas[0])))
    bm.faces.new(filas[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objeto("tmp_torso", bm)


# --- mangas: capsulas encadenadas (punto, radio)
def manga_puntos(lado):
    s = 1 if lado == 'l' else -1
    pts = [
        (Vector((13.0 * s, 1.0, 117.0)), 7.5),
        (Vector((22.3 * s, 0.3, 116.1)), 6.9),
        (Vector((43.1 * s, 2.5, 98.7)), 7.0),
        (Vector((62.6 * s, -8.6, 88.2)), 6.3),
    ]
    return pts


def capsula(bm, a, ra, b, rb, seg=32, anillos=8):
    """Tronco de cono a->b con media esfera en cada punta (suficiente para el voxel remesh)."""
    ab = b - a; L = ab.length; u = ab / L
    q = u.to_track_quat('Z', 'Y')
    M = q.to_matrix()
    for centro, r in ((a, ra), (b, rb)):
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r,
                                  matrix=Matrix.Translation(centro))
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=ra, radius2=rb, depth=L,
                                matrix=Matrix.Translation((a + b) / 2) @ M.to_4x4())
    return res


def mangas_proxy():
    bm = bmesh.new()
    for lado in ('l', 'r'):
        pts = manga_puntos(lado)
        for (a, ra), (b, rb) in zip(pts, pts[1:]):
            capsula(bm, a, ra, b, rb)
    return objeto("tmp_mangas", bm)


Z_BASTILLA = 65.0
CUELLO_C = Vector((0.0, 5.0)); CUELLO_R = 10.0; CUELLO_Z = 116.0


def x_frente(z):
    """Medio ancho de la abertura del frente: recta hasta el pecho y en V hasta el cuello."""
    if z <= 96.0:
        return 5.5
    return 5.5 + (min(z, 120.0) - 96.0) / 24.0 * 8.5


def abierto(p):
    if p.y < 2.0 and abs(p.x) < x_frente(p.z):
        return True
    if p.z > CUELLO_Z and (Vector((p.x, p.y)) - CUELLO_C).length < CUELLO_R:
        return True
    return False


def cortar(o, iteraciones=40):
    from mathutils.bvhtree import BVHTree
    bm = bmesh.new(); bm.from_mesh(o.data)
    bvh = BVHTree.FromBMesh(bm)
    # bastilla
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, Z_BASTILLA),
                           plane_no=(0, 0, 1), clear_inner=True)
    # punos
    for lado in ('l', 'r'):
        pts = manga_puntos(lado)
        (c0, _), (c1, _) = pts[-2], pts[-1]
        nrm = (c1 - c0).normalized(); fin = c1 - nrm * 0.5
        s = 1 if lado == 'l' else -1
        geom = [v for v in bm.verts if v.co.x * s > 40]
        geom = geom + list({e for v in geom for e in v.link_edges}) + list({f for v in geom for f in v.link_faces})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=fin, plane_no=nrm, clear_outer=True)
    # frente y cuello
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abierto(f.calc_center_median())], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # suavizar la orilla del frente y del cuello (la de voxel queda en escalones)
    def es_frente(v):
        return v.co.z > Z_BASTILLA + 0.3 and abs(v.co.x) < 20
    for _ in range(iteraciones):
        nuevos = {}
        for v in bm.verts:
            if not v.is_boundary or not es_frente(v):
                continue
            vec = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(vec) != 2:
                continue
            m = (vec[0].co + vec[1].co) / 2
            p = v.co.lerp(m, 0.5)
            # restriccion: sobre la curva de la abertura
            if p.z > CUELLO_Z and p.y > -2:
                d = Vector((p.x, p.y)) - CUELLO_C
                d = d.normalized() * CUELLO_R
                p = Vector((CUELLO_C.x + d.x, CUELLO_C.y + d.y, p.z)).lerp(p, 0.5)
            elif p.y < 2:
                xo = x_frente(p.z)
                p.x = p.x + (math.copysign(xo, p.x) - p.x) * 0.5
            loc = bvh.find_nearest(p)[0]
            nuevos[v] = loc if loc is not None else p
        for v, p in nuevos.items():
            v.co = p
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return o


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


def materiales(o):
    def mat(nombre, color, rough, metal=0.0):
        m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        m.diffuse_color = (*color, 1); m.roughness = rough; m.metallic = metal
        return m
    piel = mat("Chamarra_Piel", (0.032, 0.032, 0.036), 0.38)
    # forro oscuro como la referencia: el rojo se veia en las axilas cuando la manga se mete al caminar
    forro = mat("Chamarra_Forro", (0.075, 0.062, 0.06), 0.7)
    metal = mat("Chamarra_Metal", (0.78, 0.79, 0.81), 0.22, 1.0)
    o.data.materials.clear()
    for m in (piel, forro, piel, metal):
        o.data.materials.append(m)


def suavestep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lazo_ordenado(bm, semilla):
    """Vertices del lazo de borde que contiene a 'semilla', en orden."""
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


# ancho de la solapa/cuello segun la distancia (cm) desde donde empieza el doblez
def ancho_doblez(s):
    pico, muesca, cuello = 8.5, 2.2, 5.0
    if s < 17.0:
        return 0.3 + (pico - 0.3) * suavestep(0.0, 17.0, s)
    if s < 23.5:
        return pico + (muesca - pico) * suavestep(17.0, 23.5, s)
    return muesca + (cuello - muesca) * suavestep(23.5, 36.0, s)


def doblez(o, z_inicio=96.0, filas_solapa=6, hueco=0.35, c_desde=36.0, c_hasta=50.0):
    """Solapas y cuello: la orilla del frente y del cuello se dobla hacia afuera sobre la chamarra."""
    from mathutils.bvhtree import BVHTree
    bm = bmesh.new(); bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    afuera(bm)
    bm.normal_update()
    bvh = BVHTree.FromBMesh(bm)
    # lazo principal (el del frente, el cuello y la bastilla) = el que tiene el vertice mas alto
    bordes = [v for v in bm.verts if v.is_boundary]
    alto = max(bordes, key=lambda v: v.co.z)
    lazo = lazo_ordenado(bm, alto)
    # tramo del doblez: z > z_inicio, desde el lado izquierdo (x>0) pasando por la nuca
    n = len(lazo)
    i0 = lazo.index(alto)
    tramo = [lazo[i0]]
    # crecer hacia ambos lados mientras z > z_inicio
    a = i0
    while lazo[(a - 1) % n].co.z > z_inicio and len(tramo) < n:
        a = (a - 1) % n; tramo.insert(0, lazo[a])
    b = i0
    while lazo[(b + 1) % n].co.z > z_inicio and len(tramo) < n:
        b = (b + 1) % n; tramo.append(lazo[b])
    if tramo[0].co.x < tramo[-1].co.x:
        tramo.reverse()
    # largo de arco desde cada punta
    L = [0.0]
    for v0, v1 in zip(tramo, tramo[1:]):
        L.append(L[-1] + (v1.co - v0.co).length)
    total = L[-1]
    ZUP = Vector((0, 0, 1))
    datos = []
    for k, v in enumerate(tramo):
        p = v.co.copy()
        nrm = v.normal.copy()
        e = (tramo[min(k + 1, len(tramo) - 1)].co - tramo[max(k - 1, 0)].co).normalized()
        u = e.cross(nrm).normalized()
        # u debe apuntar hacia el hueco (lejos de las caras)
        cara = v.link_faces[0].calc_center_median()
        if u.dot(cara - p) > 0:
            u = -u
        s = min(L[k], total - L[k])
        # el cuello se levanta hasta atras de la quijada (abierta, sus esquinas pegaban con el)
        c = suavestep(c_desde, c_hasta, s)
        hs = 0.3 + (3.0 - 0.3) * c
        A = (u.lerp(ZUP * 0.94 + u * 0.34, c)).normalized()
        B = nrm.lerp(-Vector((u.x, u.y, 0)).normalized() if Vector((u.x, u.y)).length > 1e-4 else nrm, c).normalized()
        w = ancho_doblez(s)
        datos.append((v, p, nrm, u, A, B, hs, w, c))
    # suavizar los marcos a lo largo del tramo
    for _ in range(10):
        nuevos = []
        for k in range(len(datos)):
            k0, k1 = max(k - 1, 0), min(k + 1, len(datos) - 1)
            v, p, nrm, u, A, B, hs, w, c = datos[k]
            uu = (datos[k0][3] + u * 2 + datos[k1][3]).normalized()
            AA = (datos[k0][4] + A * 2 + datos[k1][4]).normalized()
            BB = (datos[k0][5] + B * 2 + datos[k1][5]).normalized()
            nuevos.append((v, p, nrm, uu, AA, BB, hs, w, c))
        datos = nuevos
    filas = []
    broches = []
    s_lista = [min(L[k], total - L[k]) for k in range(len(tramo))]
    for lado in (0, 1):
        idx = [k for k in range(len(tramo)) if (k < len(tramo) / 2) == (lado == 0)]
        kb = min(idx, key=lambda k: abs(s_lista[k] - 15.0))
        broches.append(kb)
    puntos_broche = []
    for k, (v, p, nrm, u, A, B, hs, w, c) in enumerate(datos):
        fila = [v]
        # donde empieza el doblez el labio crece desde casi nada (si no, las filas se enciman)
        rr = 0.15 + 0.85 * suavestep(0.0, 4.0, s_lista[k])
        perfil = [A * hs * 0.5 * rr, A * hs * rr, (A * (hs + 0.35) + B * 0.35) * rr, (A * hs + B * 0.7) * rr,
                  (A * hs * 0.45 + B * 0.85) * rr]
        for d in perfil:
            fila.append(bm.verts.new(p + d))
        # la solapa camina sobre la superficie (proyectar cada punto suelto la doblaba sobre si misma)
        cur = p.copy(); dirc = -u
        paso = w / filas_solapa
        for j in range(1, filas_solapa + 1):
            sub = 4
            for _ in range(sub):
                loc, nn, _, _ = bvh.find_nearest(cur + dirc * (paso / sub))
                dirc = (dirc - nn * dirc.dot(nn)).normalized()
                cur = loc
            fila.append(bm.verts.new(cur + nn * (hueco + 0.25 * (1 - j / filas_solapa))))
            if k in broches and j == filas_solapa - 2:
                puntos_broche.append((cur.copy(), nn.copy()))
        filas.append(fila)
    nuevas = []
    for f0, f1 in zip(filas, filas[1:]):
        for j in range(len(f0) - 1):
            try:
                f = bm.faces.new((f0[j], f1[j], f1[j + 1], f0[j + 1]))
                f.material_index = 0 if j < 2 else 1
                nuevas.append(f)
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    afuera(bm)
    bm.to_mesh(o.data); bm.free(); o.data.update()
    o["broches"] = [list(p) + list(n) for p, n in puntos_broche]
    return dict(tramo=len(tramo), largo=round(total, 1), broches=len(puntos_broche))


def grosor(o, t=0.55):
    vl = bpy.context.view_layer
    for x in vl.objects: x.select_set(False)
    o.select_set(True); vl.objects.active = o
    m = o.modifiers.new("grosor", 'SOLIDIFY')
    # sin even offset: en el doblez de 180° de las solapas disparaba vertices lejos
    m.thickness = t; m.offset = -1.0; m.use_rim = True; m.use_even_offset = False; m.use_quality_normals = True
    m.material_offset = 1; m.material_offset_rim = 0
    bpy.ops.object.modifier_apply(modifier=m.name)


def _bvh_afuera(bm):
    from mathutils.bvhtree import BVHTree
    caras = [f for f in bm.faces if f.material_index == 0]
    vs = {}
    for f in caras:
        for v in f.verts:
            vs.setdefault(v, len(vs))
    pts = [None] * len(vs)
    for v, i in vs.items():
        pts[i] = v.co.copy()
    return BVHTree.FromPolygons(pts, [[vs[v] for v in f.verts] for f in caras]), caras


def caja(bm, centro, ejes, medidas, mat=3):
    """Caja orientada: ejes = (X, Y, Z) unitarios, medidas = (dx, dy, dz)."""
    X, Y, Z = ejes
    M = Matrix((X, Y, Z)).transposed().to_4x4()
    M.translation = centro
    r = bmesh.ops.create_cube(bm, size=1.0, matrix=M @ Matrix.Diagonal((*medidas, 1.0)))
    for f in {f for v in r["verts"] for f in v.link_faces}:
        f.material_index = mat; f.smooth = False
    return r["verts"]


def cierre(o, z0=Z_BASTILLA + 0.6, z1=95.5, paso=0.85):
    """Dientes del cierre en la orilla de cada lado del frente y la jaladera abajo a la izquierda."""
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    bvh, _ = _bvh_afuera(bm)
    n_dientes = 0
    for s in (1, -1):
        z = z0; k = 0
        while z < z1:
            xo = x_frente(z)
            hit = bvh.ray_cast(Vector(((xo + 0.55) * s, -45.0, z)), Vector((0, 1, 0)))
            if hit[0] is not None and hit[0].y < 0 and hit[1].y < -0.3:
                loc, nrm = hit[0], hit[1]
                Zt = Vector((0, 0, 1)); X = (Zt.cross(nrm)).normalized() * -s
                Y = nrm.cross(X).normalized() if False else Zt
                ancho = 0.75 if (k % 2 == 0) else 0.55
                centro = loc + nrm * 0.18 + X * (0.25 + (0.12 if k % 2 else 0))
                caja(bm, centro, (X, Vector((0, 0, 1)), nrm), (ancho, 0.42, 0.32))
                n_dientes += 1
                if s == 1 and k == 1:
                    # jaladera: corredera y lengüeta colgando
                    caja(bm, loc + nrm * 0.55 + X * -0.15 + Vector((0, 0, 0.6)), (X, Vector((0, 0, 1)), nrm), (1.0, 1.5, 0.45))
                    caja(bm, loc + nrm * 0.75 + X * -0.15 + Vector((0, 0, -1.3)), (X, Vector((0, 0, 1)), nrm), (0.7, 2.4, 0.22))
            z += paso; k += 1
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return n_dientes


def broches(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    for d in o.get("broches", []):
        p = Vector(d[:3]); n = Vector(d[3:])
        q = n.to_track_quat('Z', 'Y')
        M = Matrix.Translation(p + n * 1.05) @ q.to_matrix().to_4x4()
        r = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.85, matrix=M @ Matrix.Diagonal((1, 1, 0.45, 1)))
        for f in {f for v in r["verts"] for f in v.link_faces}:
            f.material_index = 3; f.smooth = True
    bm.to_mesh(o.data); bm.free(); o.data.update()


# perfil (radio, altura) del pico de tornillo, para R = 1: arandela, cuellito, hombro redondeado y cono
PERFIL_PICO = [
    (0.0, 0.0), (1.03, 0.0), (1.08, 0.10), (1.06, 0.23), (0.95, 0.32), (0.58, 0.34),
    (0.53, 0.42), (0.50, 0.58), (0.56, 0.69), (0.80, 0.79), (0.97, 0.90), (1.01, 1.03),
    (0.94, 1.19), (0.07, 3.05), (0.0, 3.12),
]
# el de adentro, lejos de la orilla del cuello: el cuello se mueve con el del esqueleto y se le encimaba
X_PICOS = (20.6, 25.1, 29.5)


def pico_tornillo(bm, base, nrm, R=1.8, seg=20, mat=3):
    """Pico como los de la foto: el perfil girado alrededor de nrm; aristas duras donde el perfil quiebra."""
    q = nrm.to_track_quat('Z', 'Y').to_matrix()
    anillos = []
    for (r, z) in PERFIL_PICO:
        if r == 0.0:
            anillos.append([bm.verts.new(base + q @ Vector((0, 0, z * R)))])
            continue
        fila = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            fila.append(bm.verts.new(base + q @ Vector((r * R * math.cos(a), r * R * math.sin(a), z * R))))
        anillos.append(fila)
    caras = []
    for a0, a1 in zip(anillos, anillos[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            if len(a0) == 1:
                caras.append(bm.faces.new((a0[0], a1[j], a1[i])))
            elif len(a1) == 1:
                caras.append(bm.faces.new((a0[i], a0[j], a1[0])))
            else:
                caras.append(bm.faces.new((a0[i], a0[j], a1[j], a1[i])))
    for f in caras:
        f.material_index = mat; f.smooth = True
    # aristas duras: donde el perfil dobla mas de 40 grados
    for k in range(1, len(PERFIL_PICO) - 1):
        (r0, z0), (r1, z1), (r2, z2) = PERFIL_PICO[k - 1], PERFIL_PICO[k], PERFIL_PICO[k + 1]
        d0 = Vector((r1 - r0, z1 - z0)).normalized(); d1 = Vector((r2 - r1, z2 - z1)).normalized()
        if math.degrees(d0.angle(d1)) > 40 and len(anillos[k]) > 1:
            fila = anillos[k]
            for i in range(seg):
                e = bm.edges.get((fila[i], fila[(i + 1) % seg]))
                if e:
                    e.smooth = False
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    return [v for fila in anillos for v in fila]


def lomo_hombro(bvh, x):
    """Punto mas alto de la chamarra a lo largo de y, para una x (el lomo del hombro)."""
    mejor = None
    for k in range(-24, 25):
        y = k * 0.5
        hit = bvh.ray_cast(Vector((x, y, 250.0)), Vector((0, 0, -1)))
        if hit[0] is not None and (mejor is None or hit[0].z > mejor[0].z):
            mejor = hit
    return mejor


def picos(o, xs=X_PICOS, R=1.8):
    """Tres picos de tornillo en el lomo de cada hombro."""
    from mathutils.bvhtree import BVHTree
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    caras = [f for f in bm.faces if f.material_index in (0, 2)]
    idx = {}
    for f in caras:
        for v in f.verts:
            idx.setdefault(v, len(idx))
    pts = [None] * len(idx)
    for v, i in idx.items():
        pts[i] = v.co.copy()
    bvh = BVHTree.FromPolygons(pts, [[idx[v] for v in f.verts] for f in caras])
    n = 0
    for x in xs:
        hit = lomo_hombro(bvh, x)
        if hit is None:
            continue
        loc, nrm = hit[0], hit[1]
        for s in (1, -1):
            p = Vector((loc.x * s, loc.y, loc.z)); nn = Vector((nrm.x * s, nrm.y, nrm.z)).normalized()
            pico_tornillo(bm, p - nn * 0.12, nn, R=R)
            n += 1
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return n


def rehacer_picos(o, **kw):
    """Quita los picos que tenga la chamarra (islas de metal en los hombros), pone los nuevos y les copia el peso."""
    from mathutils.kdtree import KDTree
    arm_mod = [m for m in o.modifiers if m.type == 'ARMATURE']
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    vistos = set(); quitar = []
    for v in bm.verts:
        if v in vistos:
            continue
        pila = [v]; isla = []
        vistos.add(v)
        while pila:
            x = pila.pop(); isla.append(x)
            for e in x.link_edges:
                w = e.other_vert(x)
                if w not in vistos:
                    vistos.add(w); pila.append(w)
        if all(f.material_index == 3 for x in isla for f in x.link_faces):
            c = sum((x.co for x in isla), Vector()) / len(isla)
            if c.z > 100 and c.y > -12 and abs(c.x) > 10:
                quitar += isla
    bmesh.ops.delete(bm, geom=quitar, context='VERTS')
    antes = len(bm.verts)
    bm.to_mesh(o.data); bm.free(); o.data.update()
    n = picos(o, **kw)
    # pesos: cada pico, parejo, con los del vertice de tela mas cercano
    me = o.data
    tela = [v.index for v in me.vertices if v.index < antes]
    metal = set()
    for p in me.polygons:
        if p.material_index == 3:
            metal.update(p.vertices)
    tela = [i for i in tela if i not in metal]
    kd = KDTree(len(tela))
    for i in tela:
        kd.insert(me.vertices[i].co, i)
    kd.balance()
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    nuevos = [v for v in bm.verts if v.index >= antes]
    vistos = set(); islas = []
    for v in nuevos:
        if v in vistos:
            continue
        pila = [v]; isla = []
        vistos.add(v)
        while pila:
            x = pila.pop(); isla.append(x.index)
            for e in x.link_edges:
                w = e.other_vert(x)
                if w not in vistos:
                    vistos.add(w); pila.append(w)
        islas.append(isla)
    bm.free()
    # el peso de la superficie justo bajo su base (interpolado en la cara de afuera que pisa):
    # asi la base se mueve con la piel; con un vertice suelto o un promedio se hundia al moverse
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    nombres = {g.index: g.name for g in o.vertex_groups}
    tris = []
    for p in me.polygons:
        if p.material_index in (0, 2):
            vv = list(p.vertices)
            for t in range(1, len(vv) - 1):
                tris.append((vv[0], vv[t], vv[t + 1]))
    bvh = BVHTree.FromPolygons([v.co for v in me.vertices], tris)
    def pesos_de(i):
        return {nombres[g.group]: g.weight for g in me.vertices[i].groups}
    for isla in islas:
        # la base: el vertice del pico mas pegado a la piel
        base = min((me.vertices[i].co for i in isla), key=lambda q: bvh.find_nearest(q)[3])
        loc, _, ti, _ = bvh.find_nearest(base)
        a, b2, c2 = tris[ti]
        A, B, C = me.vertices[a].co, me.vertices[b2].co, me.vertices[c2].co
        bar = barycentric_transform(loc, A, B, C, Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        acc = {}
        for idx, w in zip((a, b2, c2), (bar.x, bar.y, bar.z)):
            for k, pw in pesos_de(idx).items():
                acc[k] = acc.get(k, 0.0) + max(w, 0.0) * pw
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        s = sum(w for _, w in top)
        for k, w in top:
            o.vertex_groups[k].add(isla, w / s, 'REPLACE')
    return dict(quitados=len(quitar), picos=n, islas=len(islas), armature=len(arm_mod))


PIEZAS_CUERPO = ["Egg_Torax", "Egg_Arm1_L", "Egg_Arm1_R", "Egg_Arm2_L", "Egg_Arm2_R", "Egg_Pelvis"]
DEDOS = ("thumb", "index", "middle", "ring", "pinky")


def remapeo(nombre):
    """A qué hueso se pasa el peso que viene del cuerpo (None = se tira)."""
    if nombre.startswith(DEDOS) or nombre.startswith("c_"):
        return None
    if nombre.startswith("hand."):
        return "forearm_twist." + nombre.split(".")[1]
    if nombre == "head.x":
        return "neck.x"
    if nombre.startswith(("thigh", "leg", "foot", "toes", "prop_", "spline")):
        return "root.x"
    return nombre


def pesar(o, repeticiones=10, factor=0.5, max_huesos=4, axila=(23.0, 1.5, 104.0), radio_axila=12.0, rep_axila=40):
    vl = bpy.context.view_layer
    # cuerpo de referencia: copias de las piezas, juntas, con sus grupos
    copias = []
    for n in PIEZAS_CUERPO:
        src = bpy.data.objects[n]
        c = src.copy(); c.data = src.data.copy(); c.modifiers.clear()
        col_tmp().objects.link(c); copias.append(c)
    for x in vl.objects: x.select_set(False)
    for c in copias: c.select_set(True)
    vl.objects.active = copias[0]
    bpy.ops.object.join()
    cuerpo = copias[0]; cuerpo.name = "tmp_cuerpo"
    o.vertex_groups.clear()
    for g in cuerpo.vertex_groups:
        o.vertex_groups.new(name=g.name)
    m = o.modifiers.new("pesos", 'DATA_TRANSFER')
    m.object = cuerpo; m.use_vert_data = True; m.data_types_verts = {'VGROUP_WEIGHTS'}
    m.vert_mapping = 'POLYINTERP_NEAREST'
    m.layers_vgroup_select_src = 'ALL'; m.layers_vgroup_select_dst = 'NAME'
    for x in vl.objects: x.select_set(False)
    o.select_set(True); vl.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)
    borrar("tmp_cuerpo")
    # leer pesos a diccionarios
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
    # islas (la tela es una; picos, dientes y broches son sueltos)
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    isla = [-1] * len(bm.verts); islas = []
    for v in bm.verts:
        if isla[v.index] >= 0:
            continue
        pila = [v]; miembros = []
        isla[v.index] = len(islas)
        while pila:
            x = pila.pop(); miembros.append(x.index)
            for e in x.link_edges:
                w = e.other_vert(x)
                if isla[w.index] < 0:
                    isla[w.index] = len(islas); pila.append(w)
        islas.append(miembros)
    tela = max(islas, key=len)
    vecinos = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    coords = [v.co.copy() for v in bm.verts]
    bm.free()
    # suavizar en la tela
    en_tela = set(tela)
    for _ in range(repeticiones):
        nuevos = {}
        for i in tela:
            acc = {}
            for j in vecinos[i]:
                for k, w in pesos[j].items():
                    acc[k] = acc.get(k, 0.0) + w
            nv = len(vecinos[i]) or 1
            d = {}
            for k in set(acc) | set(pesos[i]):
                d[k] = pesos[i].get(k, 0.0) * (1 - factor) + acc.get(k, 0.0) / nv * factor
            nuevos[i] = d
        for i, d in nuevos.items():
            pesos[i] = d
    # axilas: mas suavizado alrededor, para que la manga y el costado se repartan el movimiento
    for s in (1, -1):
        A = Vector((axila[0] * s, axila[1], axila[2]))
        zona = [(i, 1 - (coords[i] - A).length / radio_axila) for i in tela if (coords[i] - A).length < radio_axila]
        for _ in range(rep_axila):
            nuevos = {}
            for i, peso in zona:
                acc = {}
                for j in vecinos[i]:
                    for k, w in pesos[j].items():
                        acc[k] = acc.get(k, 0.0) + w
                nv = len(vecinos[i]) or 1
                f = 0.6 * peso
                nuevos[i] = {k: pesos[i].get(k, 0.0) * (1 - f) + acc.get(k, 0.0) / nv * f for k in set(acc) | set(pesos[i])}
            for i, d in nuevos.items():
                pesos[i] = d
    # limitar y normalizar
    def limpiar(d):
        top = sorted(d.items(), key=lambda kv: -kv[1])[:max_huesos]
        s = sum(w for _, w in top)
        return {k: w / s for k, w in top if w / s > 0.01} if s > 0 else {}
    for i in tela:
        pesos[i] = limpiar(pesos[i])
    # piezas sueltas: pesos parejos, los del punto de tela mas cercano a su centro
    from mathutils.kdtree import KDTree
    kd = KDTree(len(tela))
    for i in tela:
        kd.insert(coords[i], i)
    kd.balance()
    for miembros in islas:
        if miembros is tela:
            continue
        c = sum((coords[i] for i in miembros), Vector()) / len(miembros)
        _, j, _ = kd.find(c)
        for i in miembros:
            pesos[i] = dict(pesos[j])
    # escribir
    o.vertex_groups.clear()
    usados = sorted({k for d in pesos for k in d})
    grupos = {k: o.vertex_groups.new(name=k) for k in usados}
    for i, d in enumerate(pesos):
        for k, w in d.items():
            grupos[k].add([i], w, 'REPLACE')
    sin = sum(1 for d in pesos if not d)
    return dict(huesos=usados, sin_peso=sin, islas=len(islas))


def pesar_metal(o):
    """Cada pieza de metal (picos, dientes, jaladera, broches) con el peso de la piel bajo su base."""
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    me = o.data
    metal = set()
    for p in me.polygons:
        if p.material_index == 3:
            metal.update(p.vertices)
    tris = []
    for p in me.polygons:
        if p.material_index in (0, 2):
            vv = list(p.vertices)
            for t in range(1, len(vv) - 1):
                tris.append((vv[0], vv[t], vv[t + 1]))
    bvh = BVHTree.FromPolygons([v.co for v in me.vertices], tris)
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    vistos = set(); islas = []
    for i in metal:
        if i in vistos:
            continue
        pila = [bm.verts[i]]; isla = []; vistos.add(i)
        while pila:
            x = pila.pop(); isla.append(x.index)
            for e in x.link_edges:
                w = e.other_vert(x)
                if w.index not in vistos:
                    vistos.add(w.index); pila.append(w)
        islas.append(isla)
    bm.free()
    nombres = {g.index: g.name for g in o.vertex_groups}
    for isla in islas:
        base = min((me.vertices[i].co for i in isla), key=lambda q: bvh.find_nearest(q)[3])
        loc, _, ti, _ = bvh.find_nearest(base)
        a, b2, c2 = tris[ti]
        A, B, C = me.vertices[a].co, me.vertices[b2].co, me.vertices[c2].co
        bar = barycentric_transform(loc, A, B, C, Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        acc = {}
        for idx, w in zip((a, b2, c2), (bar.x, bar.y, bar.z)):
            for g in me.vertices[idx].groups:
                k = nombres[g.group]
                acc[k] = acc.get(k, 0.0) + max(w, 0.0) * g.weight
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        s = sum(w for _, w in top) or 1.0
        for i in isla:
            for g in list(me.vertices[i].groups):
                o.vertex_groups[g.group].remove([i])
        for k, w in top:
            o.vertex_groups[k].add(isla, w / s, 'REPLACE')
    return len(islas)


def giro_manga(o, t0=0.55, t1=0.8, t2=1.0, max_huesos=4):
    """Reparte el peso del brazo entre sus tres huesos según la altura en el brazo (0 hombro, 1 codo).

    Los pesos venían del brazo del personaje, que es delgado: ahí que arm_twist_2 y
    arm_stretch se tuerzan (hasta 56° y 99° al caminar) casi no mueve nada. La manga es
    gruesa y la tela de la axila queda a ~9 cm del eje: con ese giro barría la tela de
    atrás por debajo del brazo, atravesaba la del frente y salían astillas (Oscar,
    2026-11-18). Hasta `t0` todo va con arm_twist, que no se tuerce; de `t0` a `t1` pasa
    a arm_twist_2 y de `t1` a `t2` a arm_stretch. Lo que no es de esos tres no cambia.
    Medido (pliegues de la piel en idle, caminar y correr): con t0 0.4 la torsión todavía
    llegaba a la axila; con 0.65 se amontonaba en el codo."""
    B = ARM.data.bones
    from mathutils.geometry import intersect_point_line
    me = o.data
    nombres = {g.index: g.name for g in o.vertex_groups}
    n = 0
    for lado in ("l", "r"):
        J = B["arm_stretch." + lado].head_local
        E = B["forearm_stretch." + lado].head_local
        huesos = ("arm_twist." + lado, "arm_twist_2." + lado, "arm_stretch." + lado)
        for k in huesos:
            if k not in o.vertex_groups:
                o.vertex_groups.new(name=k)
        for v in me.vertices:
            w = {nombres[g.group]: g.weight for g in v.groups}
            U = sum(w.get(k, 0.0) for k in huesos)
            if U < 1e-4:
                continue
            t = intersect_point_line(v.co, J, E)[1]
            a = suavestep(t0, t1, t); b = suavestep(t1, t2, t)
            w.update(zip(huesos, (U * (1 - a), U * a * (1 - b), U * a * b)))
            # el sitio usa 4 huesos por vértice: los mismos 4 aquí, para que se mueva igual
            top = dict(sorted(((k, x) for k, x in w.items() if x > 0.01), key=lambda kv: -kv[1])[:max_huesos])
            s = sum(top.values()) or 1.0
            for g in list(v.groups):
                o.vertex_groups[g.group].remove([v.index])
            for k, x in top.items():
                o.vertex_groups[k].add([v.index], x / s, 'REPLACE')
            n += 1
    return n


def suavizar_pesos(o, zonas, iters, factor=0.8, max_huesos=4):
    """Laplaciano de los pesos de la piel de afuera alrededor de cada zona (centro en cm, con
    |x| para los dos lados; radio), con caída suave a la orilla; deja `max_huesos`."""
    import numpy as np
    me = o.data
    fuera = sorted({i for p in me.polygons if p.material_index in (0, 2) for i in p.vertices})
    pos = {i: k for k, i in enumerate(fuera)}
    n = len(fuera)
    W = np.zeros((n, len(o.vertex_groups)))
    for k, i in enumerate(fuera):
        for g in me.vertices[i].groups:
            W[k, g.group] = g.weight
    co = np.array([tuple(me.vertices[i].co) for i in fuera])
    co[:, 0] = np.abs(co[:, 0])
    a, b = [], []
    for e in me.edges:
        x, y = e.vertices
        if x in pos and y in pos:
            a += [pos[x], pos[y]]; b += [pos[y], pos[x]]
    a = np.array(a); b = np.array(b)
    grado = np.bincount(a, minlength=n).astype(float); grado[grado == 0] = 1
    peso = np.zeros(n)
    for centro, radio in zonas:
        t = np.clip(1 - np.linalg.norm(co - np.array(centro), axis=1) / radio, 0, 1)
        peso = np.maximum(peso, t * t * (3 - 2 * t))
    f = (factor * peso)[:, None]
    for _ in range(iters):
        S = np.zeros_like(W); np.add.at(S, a, W[b])
        W = W * (1 - f) + (S / grado[:, None]) * f
    filas = np.arange(n)[:, None]
    top = np.argsort(-W, axis=1)[:, :max_huesos]
    W2 = np.zeros_like(W); W2[filas, top] = W[filas, top]
    W2[W2 < 0.01] = 0
    s = W2.sum(1, keepdims=True); s[s == 0] = 1; W2 /= s
    tocados = np.where(peso > 0)[0]
    for k in tocados:
        i = fuera[k]
        for g in list(me.vertices[i].groups):
            o.vertex_groups[g.group].remove([i])
        for j in np.nonzero(W2[k])[0]:
            o.vertex_groups[int(j)].add([i], float(W2[k, j]), 'REPLACE')
    return int(len(tocados))


def huesos_axila(o, centro=(23.0, 1.5, 104.0), radio=26.0, brazo_t0=0.5, brazo_t1=0.65):
    """Alrededor de cada axila todos los vértices con los mismos 4 huesos: hombro, arm_twist,
    spine_03 y spine_02. Al dejar 4 por vértice, cada uno tiraba otro (spine_01, el hombro,
    arm_twist...) y dos vecinos quedaban con juegos distintos: ahí se quebraba la tela. Los
    demás pasan su peso al vecino de la cadena (spine_01 y root.x a spine_02, que es lo que
    tiene el torso del cuerpo a esa altura; los del brazo a arm_twist, solo hasta `brazo_t0`
    del brazo, porque más abajo manda giro_manga), con caída suave hacia la orilla."""
    from mathutils.geometry import intersect_point_line
    B = ARM.data.bones
    me = o.data
    nombres = {g.index: g.name for g in o.vertex_groups}
    for k in ("spine_02.x", "spine_03.x", "arm_twist.l", "arm_twist.r", "shoulder.l", "shoulder.r"):
        if k not in o.vertex_groups:
            o.vertex_groups.new(name=k)
    n = 0
    for v in me.vertices:
        s = "l" if v.co.x > 0 else "r"
        d = (Vector((abs(v.co.x), v.co.y, v.co.z)) - Vector(centro)).length
        if d >= radio:
            continue
        p = suavestep(0.0, 1.0, 1 - d / radio)
        ta = intersect_point_line(v.co, B["arm_stretch." + s].head_local, B["forearm_stretch." + s].head_local)[1]
        p_brazo = p * (1 - suavestep(brazo_t0, brazo_t1, ta))
        permitidos = {"shoulder." + s, "arm_twist." + s, "spine_03.x", "spine_02.x"}
        nuevo = {}
        for g in v.groups:
            h, x = nombres[g.group], g.weight
            if h in permitidos:
                nuevo[h] = nuevo.get(h, 0.0) + x
                continue
            es_brazo = h.endswith("." + s) and h.startswith(("arm_", "forearm_"))
            q = p_brazo if es_brazo else p
            dst = "arm_twist." + s if es_brazo else ("spine_02.x" if h in ("spine_01.x", "root.x") else "spine_03.x")
            nuevo[h] = nuevo.get(h, 0.0) + x * (1 - q)
            nuevo[dst] = nuevo.get(dst, 0.0) + x * q
        for g in list(v.groups):
            o.vertex_groups[g.group].remove([v.index])
        for h, x in nuevo.items():
            if x > 1e-4:
                o.vertex_groups[h].add([v.index], x, 'REPLACE')
        n += 1
    return n


# Zonas de suavizado (centro en cm, |x|; radio) y pasadas. Medidas el 2026-11-18 con los
# pliegues de la piel (aristas que se doblan 60° más que en reposo) en idle, caminar y
# correr, y revisadas en Cycles: más pasadas en la axila o en el codo regaban el peso del
# brazo y la manga se sumía (con 300 en el codo asomaba el brazo).
ZONA_HOMBRO = ((14.0, 0.0, 125.0), 9.0)
ZONA_CODO = ((43.1, 2.5, 98.7), 12.0)
ZONA_AXILA = ((23.0, 1.5, 104.0), 16.0)
# la franja del fondo de la axila, donde el peso va mitad brazo y mitad torso, y el cuello por atrás
FRANJAS = (((24.0, 7.0, 110.0), 9.0), ((24.0, -2.0, 106.0), 7.0), ((24.0, 2.0, 104.0), 7.0), ((10.5, 8.0, 124.5), 7.0))
# la línea del pliegue de adentro del codo: suaviza la raya pellizcada. Con radio 5 y 200
# pasadas quedaba más bonita, pero en idle el hueso del brazo asomaba por el pliegue (medido
# con renders de los dos codos en 12 cuadros y 5 ángulos); así, en ninguno.
CODO_PLIEGUE = (((41.0, -4.0, 98.0), 4.0), ((43.0, -4.5, 100.5), 4.0), ((45.5, -2.5, 103.5), 4.0))


def pesos_finos(o):
    """Después de giro_manga: hombros, codos y axilas sin quiebres (Oscar, 2026-11-18, "que
    quede bien pesado"). Contra los pesos de pesar(): aristas que se doblan 60° de más al
    caminar, en las axilas de 554 a 11, en los codos de 100 a 56 y en los hombros de 161
    a 14; ninguna al correr."""
    return dict(
        hombro=suavizar_pesos(o, [ZONA_HOMBRO], 300),
        codo=suavizar_pesos(o, [ZONA_CODO], 50),
        huesos=huesos_axila(o),
        axila=suavizar_pesos(o, [ZONA_AXILA], 40),
        franjas=suavizar_pesos(o, FRANJAS, 300),
        codo_pliegue=suavizar_pesos(o, CODO_PLIEGUE, 60),
    )


def repesar_estampados(o):
    """Los estampados (material 4 en adelante) con el peso de la piel bajo cada vértice, como
    los deja estampado(), para cuando cambian los pesos de la piel sin volver a pegarlos."""
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    me = o.data
    nombres = {g.index: g.name for g in o.vertex_groups}
    coords = [v.co for v in me.vertices]
    tris = []
    for p in me.polygons:
        if p.material_index == 0:
            vv = list(p.vertices)
            for t in range(1, len(vv) - 1):
                tris.append((vv[0], vv[t], vv[t + 1]))
    bvh = BVHTree.FromPolygons(coords, tris)
    estampa = sorted({i for p in me.polygons if p.material_index >= 4 for i in p.vertices})
    for i in estampa:
        loc, _, ti, _ = bvh.find_nearest(coords[i])
        a, b, c = tris[ti]
        bar = barycentric_transform(loc, coords[a], coords[b], coords[c], Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        acc = {}
        for idx, w in zip((a, b, c), (bar.x, bar.y, bar.z)):
            for g in me.vertices[idx].groups:
                acc[nombres[g.group]] = acc.get(nombres[g.group], 0.0) + max(w, 0.0) * g.weight
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        s = sum(w for _, w in top) or 1.0
        for g in list(me.vertices[i].groups):
            o.vertex_groups[g.group].remove([i])
        for h, w in top:
            o.vertex_groups[h].add([i], w / s, 'REPLACE')
    return len(estampa)


def pesos_forro(o, vecinos=8):
    """Cada vértice del forro con los pesos de su vértice de afuera.

    Con pesos propios (transferidos y suavizados aparte) el forro se movía distinto que la
    piel y donde la tela se dobla se asomaba en manchas claras (Oscar, 2026-11-18). Su
    pareja es el vértice de afuera del que el Solidify lo bajó: está del lado al que apunta
    su normal; el más cercano a secas, en las solapas dobladas, era la piel del pecho."""
    from mathutils.kdtree import KDTree
    me = o.data
    fuera_v, dentro_v = set(), set()
    for p in me.polygons:
        if p.material_index in (0, 2):
            fuera_v.update(p.vertices)
        elif p.material_index == 1:
            dentro_v.update(p.vertices)
    afuera = sorted(fuera_v - dentro_v)
    kd = KDTree(len(afuera))
    for i in afuera:
        kd.insert(me.vertices[i].co, i)
    kd.balance()
    nombres = {g.index: g.name for g in o.vertex_groups}
    hechos = 0
    for i in sorted(dentro_v - fuera_v):
        p = me.vertices[i].co
        for q, j, d in kd.find_n(p, vecinos):
            if d > 1e-6 and (q - p).dot(me.vertices[j].normal) > 0.7 * d:
                src = {nombres[g.group]: g.weight for g in me.vertices[j].groups}
                for g in list(me.vertices[i].groups):
                    o.vertex_groups[g.group].remove([i])
                for k, w in src.items():
                    o.vertex_groups[k].add([i], w, 'REPLACE')
                hechos += 1
                break
    return hechos


# Estampado de la espalda (Oscar, 2026-11-17): su imagen (el círculo rojo con
# el bicho negro, el pico se sale del círculo por abajo), en un cuadro con
# fondo transparente, en Character/assets. El círculo mide 24 cm en la espalda.
RUTA_ESTAMPADO = r"D:\Work\mroscar\Website\new\Character\assets\chamarra_espalda.png"
RUTA_PARCHE = r"D:\Work\mroscar\Website\new\Character\assets\chamarra_parche.png"
# Cada imagen pegada a la chamarra: material, imagen, centro (x, z) del cuadro,
# lado del cuadro y de qué lado del cuerpo (+1 espalda, -1 frente).
ESTAMPADOS = {
    # el círculo mide 24 cm y su centro queda en z 97 (el pico baja más)
    "Chamarra_Estampado": dict(imagen="Chamarra_Espalda", ruta=RUTA_ESTAMPADO, x=0.0, z=95.0, lado=28.1, cara=1),
    # la carita con copete (Oscar): ~10 cm de alto en el pecho derecho, abajo de la solapa
    # (del lado izquierdo la tapaba la luz de la llama de la mano)
    "Chamarra_Parche": dict(imagen="Chamarra_Parche", ruta=RUTA_PARCHE, x=-13.6, z=87.5, lado=10.1, cara=-1),
}
ESTAMPADO = ESTAMPADOS["Chamarra_Estampado"]


def material_estampado(nombre="Chamarra_Estampado"):
    cfg = ESTAMPADOS[nombre]
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    img = bpy.data.images.get(cfg["imagen"])
    if img:
        # la imagen cambia en disco (Oscar la actualiza): se vuelve a leer y a empacar
        img.filepath = cfg["ruta"]
        if img.packed_file:
            img.unpack(method='REMOVE')
        img.reload()
    else:
        img = bpy.data.images.load(cfg["ruta"])
        img.name = cfg["imagen"]
    img.pack()
    tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None) or nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.location = (-420, 260)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    # lo transparente no se dibuja (recorte): Mayor que 0.5 → alfa
    corte = next((n for n in nt.nodes if n.type == 'MATH' and n.operation == 'GREATER_THAN'), None)
    if not corte:
        corte = nt.nodes.new('ShaderNodeMath'); corte.operation = 'GREATER_THAN'
    corte.inputs[1].default_value = 0.5
    corte.location = (-180, 40)
    nt.links.new(tex.outputs['Alpha'], corte.inputs[0])
    nt.links.new(corte.outputs['Value'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.68
    bsdf.inputs['Metallic'].default_value = 0.0
    m.diffuse_color = (1, 1, 1, 1)
    return m


def estampado(o, nombre="Chamarra_Estampado", celdas=None, alto=0.12):
    """Cuadro con una imagen pegado a la chamarra: cada vértice se proyecta a la piel de
    afuera, queda `alto` encima y lleva el peso de la piel bajo él (se dobla con ella).
    Lo transparente de la imagen no se dibuja."""
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import barycentric_transform
    cfg = ESTAMPADOS[nombre]
    x0, z, lado, cara = cfg["x"], cfg["z"], cfg["lado"], cfg["cara"]
    celdas = celdas or max(8, int(round(lado)))
    me = o.data
    mat = material_estampado(nombre)
    nombres_mat = [s.name if s else None for s in me.materials]
    if mat.name not in nombres_mat:
        me.materials.append(mat)
        nombres_mat.append(mat.name)
    im = nombres_mat.index(mat.name)
    bm = bmesh.new(); bm.from_mesh(me)
    viejas = [f for f in bm.faces if f.material_index == im]
    if viejas:
        bmesh.ops.delete(bm, geom=viejas, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.verts.ensure_lookup_table()
    deform = bm.verts.layers.deform.verify()
    uvl = bm.loops.layers.uv.verify()
    coords = [v.co.copy() for v in bm.verts]
    pesos = [dict(v[deform].items()) for v in bm.verts]
    tris = []
    for f in bm.faces:
        if f.material_index != 0:
            continue
        vv = [v.index for v in f.verts]
        for t in range(1, len(vv) - 1):
            tris.append((vv[0], vv[t], vv[t + 1]))
    bvh = BVHTree.FromPolygons(coords, tris)
    hit = bvh.ray_cast(Vector((x0, 80.0 * cara, z)), Vector((0, -cara, 0)))
    P0, N0 = hit[0], hit[1].normalized()
    arriba = (Vector((0, 0, 1)) - N0 * N0.z).normalized()
    derecha = arriba.cross(N0).normalized()   # vista de frente al estampado: su derecha (atrás va a -x, al frente a +x)
    uv_de = {}

    def colocar(u, v):
        guia = P0 + derecha * u + arriba * v + N0 * 4.0
        h = bvh.ray_cast(guia, -N0)
        if h[0] is None:
            loc, nrm, ti, _ = bvh.find_nearest(guia)
        else:
            loc, nrm, ti = h[0], h[1], h[2]
        vert = bm.verts.new(loc + nrm.normalized() * alto)
        a, b, c = tris[ti]
        bar = barycentric_transform(loc, coords[a], coords[b], coords[c], Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        acc = {}
        for idx, w in zip((a, b, c), (bar.x, bar.y, bar.z)):
            for gi, gw in pesos[idx].items():
                acc[gi] = acc.get(gi, 0.0) + max(w, 0.0) * gw
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        s = sum(w for _, w in top) or 1.0
        for gi, gw in top:
            vert[deform][gi] = gw / s
        uv_de[vert] = (0.5 + u / lado, 0.5 + v / lado)
        return vert

    rejilla = [[colocar(lado * (i / celdas - 0.5), lado * (k / celdas - 0.5)) for i in range(celdas + 1)] for k in range(celdas + 1)]
    nuevas = []
    for k in range(celdas):
        for i in range(celdas):
            nuevas.append(bm.faces.new((rejilla[k][i], rejilla[k][i + 1], rejilla[k + 1][i + 1], rejilla[k + 1][i])))
    for f in nuevas:
        f.material_index = im
        f.smooth = True
        for lp in f.loops:
            lp[uvl].uv = uv_de[lp.vert]
    bm.normal_update()
    if nuevas[len(nuevas) // 2].normal.dot(N0) < 0:
        bmesh.ops.reverse_faces(bm, faces=nuevas)
    bm.to_mesh(me); bm.free(); me.update()
    return dict(vertices=len(uv_de), caras=len(nuevas), centro=[round(x, 1) for x in P0])


def simetrizar(o, umbral=0.05):
    """La tela del lado izquierdo (x>0) espejeada al derecho, con sus pesos (.l <-> .r).
    QuadriFlow la dejaba un poco chueca y el brazo derecho pedia el doble de apertura."""
    vl = bpy.context.view_layer
    arm_mods = [(m.name, m.object) for m in o.modifiers if m.type == 'ARMATURE']
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    for x in vl.objects: x.select_set(False)
    o.select_set(True); vl.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(o.data)
    for v in bm.verts: v.select = False
    for e in bm.edges: e.select = False
    for f in bm.faces:
        f.select = f.material_index != 3
    bm.select_flush_mode()
    bmesh.update_edit_mesh(o.data)
    bpy.ops.mesh.symmetrize(direction='POSITIVE_X', threshold=umbral)
    bpy.ops.object.mode_set(mode='OBJECT')
    # pesos del lado derecho = los del izquierdo espejeados
    from mathutils.kdtree import KDTree
    me = o.data
    metal = set()
    for p in me.polygons:
        if p.material_index == 3:
            metal.update(p.vertices)
    izq = [v.index for v in me.vertices if v.co.x > 1e-3 and v.index not in metal]
    kd = KDTree(len(izq))
    for i in izq:
        kd.insert(me.vertices[i].co, i)
    kd.balance()
    nombres = {g.index: g.name for g in o.vertex_groups}
    def espejo(n):
        if n.endswith(".l"): return n[:-2] + ".r"
        if n.endswith(".r"): return n[:-2] + ".l"
        return n
    peor = 0.0
    for v in me.vertices:
        if v.index in metal or v.co.x > -1e-3:
            continue
        co, j, d = kd.find(Vector((-v.co.x, v.co.y, v.co.z)))
        peor = max(peor, d)
        src = {espejo(nombres[g.group]): g.weight for g in me.vertices[j].groups}
        for g in list(v.groups):
            o.vertex_groups[g.group].remove([v.index])
        for k, w in src.items():
            if k not in o.vertex_groups:
                o.vertex_groups.new(name=k)
            o.vertex_groups[k].add([v.index], w, 'REPLACE')
    for nombre, ob in arm_mods:
        a = o.modifiers.new(nombre, 'ARMATURE'); a.object = ob; a.use_vertex_groups = True
    return dict(espejo_max=round(peor, 4), verts=len(me.vertices))


def montar(o, nombre="Chamarra"):
    """Nombre final, colección de los props, hijo del armature con su modificador."""
    vieja = bpy.data.objects.get(nombre)
    if vieja and vieja is not o:
        borrar(nombre)
    o.name = nombre; o.data.name = nombre
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


def todo(kw_pesos=dict(radio_axila=22, rep_axila=140)):
    vieja = bpy.data.objects.get("Chamarra")
    if vieja:
        borrar("Chamarra")
    o = unir_y_remallar(caras=6000)
    materiales(o)
    info = doblez(o)
    for p in o.data.polygons:
        p.use_smooth = True
    grosor(o)
    info["picos"] = picos(o)
    info["dientes"] = cierre(o)
    broches(o)
    info["caras"] = len(o.data.polygons)
    info["pesos"] = pesar(o, **(kw_pesos or {}))["sin_peso"]
    montar(o)
    info["simetria"] = simetrizar(o)
    info["giro_manga"] = giro_manga(o)
    info["pesos_finos"] = pesos_finos(o)
    info["forro"] = pesos_forro(o)
    info["metal"] = pesar_metal(o)
    # después de simetrizar: las imágenes no son simétricas
    info["estampados"] = {n: estampado(o, n) for n in ESTAMPADOS}
    return o, info


def unir_y_remallar(voxel=0.8, suave=12, caras=3200):
    for o in list(col_tmp().objects):
        borrar(o.name)
    t = torso_proxy(); m = mangas_proxy()
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    # union booleana con voxel: juntar y remallar (el voxel remesh une los volúmenes)
    vl = bpy.context.view_layer
    t.select_set(True); m.select_set(True); vl.objects.active = t
    bpy.ops.object.join()
    t.name = "tmp_chamarra"
    t.data.remesh_voxel_size = voxel
    t.data.use_remesh_fix_poles = True
    bpy.ops.object.voxel_remesh()
    mod = t.modifiers.new("suave", 'SMOOTH'); mod.factor = 0.6; mod.iterations = suave
    bpy.ops.object.modifier_apply(modifier=mod.name)
    cortar(t)
    if caras:
        bpy.ops.object.quadriflow_remesh(target_faces=caras, use_preserve_sharp=False, use_preserve_boundary=True,
                                         smooth_normals=False, use_mesh_symmetry=True)
    return t
