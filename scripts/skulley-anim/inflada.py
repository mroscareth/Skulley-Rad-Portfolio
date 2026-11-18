"""
Arma la chamarra inflada de Skulley (prop "Inflada") en Character/SkulleyRad.blend.

En Blender, en cualquier modo:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
Reemplaza el objeto Inflada si ya existe y deja el armature en Pose. Todo va en las coordenadas
del armature (cm). Referencias de Oscar (2026-11-17): una chamarra de plumas amarilla como de
globos (gajos horizontales inflados, mangas como pilas de anillos, cuello de rollo, cierre al
frente, puños delgados) con los picos de tela en el lado de afuera de las mangas (rosas en la referencia; Oscar los quiso del cyan del pelo).

Pegada al cuerpo (Oscar: "que no parezca un costal", "se ve muy gordo"). Mismo método que
chamarra.py y hoodie.py: torso de anillos superelípticos (abajo y en las axilas la base del hoodie;
en medio, ~2 cm afuera de las costillas) con gajos chicos y redondos sumados encima (al frente y
atrás; a los lados casi nada, para que el brazo no choque con el costado), mangas que siguen el
brazo con anillos más inflados arriba y afuera que del lado del cuerpo, unidos con voxel remesh;
las aberturas (abajo, puños, cuello con V) se cortan antes de QuadriFlow, se relaja la malla sobre
la forma de antes, se lleva una fila de vértices al fondo de cada costura y se simetriza; grosor
con Solidify sin even offset. Sobre las orillas reales: bastilla y puños lisos, el cuello de rollo
(una pieza aparte que sigue la orilla del cuello, como la capucha del hoodie), el cierre en el surco
del frente y un pico por anillo de cada manga. Pesos: transferidos de las piezas del cuerpo (la tela
del torso solo del tórax y la pelvis), suavizados y más en axilas y codos; lo agregado toma el peso
de la tela bajo cada vértice; los picos siguen la tela en la base y son rígidos hacia la punta; el
lado derecho es el espejo del izquierdo.

medir() revisa cuadro por cuadro una acción por cruce de superficies entre cuerpo y ropa y
medir_abierto() lo mismo con los brazos abiertos; apertura_necesaria() lo que habría que abrir los
brazos (como apartaManos) para que la manga no cruce el costado (con costillas=True, tampoco el
tórax la axila); picos_medir() cuánto se hunde o se despega cada pico; forro_asoma() dónde la cara
de adentro cruza la de afuera; revisar_reposo() el reposo con la quijada abierta. render() saca
vistas con una cámara temporal y deja la escena como estaba.
"""
import bpy, bmesh, math, json, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from mathutils.geometry import barycentric_transform

ARM = bpy.data.objects["root"]
NOMBRE = "Inflada"
TMP = "Inflada_tmp"        # colección de temporales; todos se llaman inf_*

# materiales, en este orden (convenio de la chamarra y el hoodie: 1 = la cara de adentro)
TELA, FORRO, PUNO, CIERRE, PICOS, CUELLO, ESTAMPADO = range(7)

AMARILLO = (1.0, 0.604, 0.010)        # #ffcc1a en lineal, el amarillo de la referencia (juguete)
AZUL = (0.0, 0.831, 1.0)              # #00ebff, el cyan del pelo por defecto (Oscar los quiso de ese azul; antes rosa #ff4da6)
NEGRO = (0.008, 0.008, 0.009)


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
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for x in vl.objects:
        x.select_set(False)
    o.select_set(True); vl.objects.active = o


def a_pose():
    """Deja el armature activo y en Pose (como lo encontramos)."""
    vl = bpy.context.view_layer
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for x in vl.objects:
        x.select_set(False)
    ARM.select_set(True); vl.objects.active = ARM
    bpy.ops.object.mode_set(mode='POSE')


def suave(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def espejo(v):
    return Vector((-v.x, v.y, v.z))


def gajo(x, costuras, k=0.45):
    """Perfil de un gajo inflado: 0 en las costuras, 1 a la mitad, redondo (casi medio círculo)."""
    for a, b in zip(costuras, costuras[1:]):
        if a <= x <= b:
            u = 2 * (x - a) / (b - a) - 1
            return max(0.0, 1 - u * u) ** k, costuras.index(a)
    return 0.0, -1


# ===================== torso =====================
# base (z, a = medio ancho, yf = frente, yb = espalda, n): abajo (hasta z 72) y de las axilas para arriba (desde
# z 104) los anillos del hoodie: abajo libran los bóxers y los muslos en los clips, y en las axilas el omóplato,
# que se mueve con el hombro (1 cm más ceñido ahí y se metía en la tela de la axila aun abriendo el brazo 45°).
# En medio, pegada al cuerpo (Oscar: "se ve muy gordo"): ~2 cm afuera de lo más ancho de las costillas y, entre
# las costillas y la pelvis, derecha, como cuelga la tela
ANILLOS = [
    (61.0, 22.6, -19.6, 19.0, 2.4),
    (65.5, 22.6, -19.6, 19.0, 2.4),
    (68.0, 22.8, -19.8, 19.2, 2.4),
    (71.0, 23.0, -19.8, 19.4, 2.4),
    (74.0, 22.9, -19.6, 19.6, 2.45),
    (78.0, 22.6, -19.4, 19.7, 2.5),
    (84.0, 22.0, -19.2, 20.0, 2.5),
    (90.0, 21.6, -19.0, 20.4, 2.5),
    (96.0, 21.6, -18.6, 21.0, 2.5),
    (100.0, 22.0, -18.3, 21.5, 2.55),
    (104.0, 22.8, -18.0, 21.9, 2.6),
    (110.0, 24.4, -16.4, 21.2, 2.7),
    (115.0, 25.6, -14.6, 19.6, 2.8),
    (119.0, 25.2, -12.6, 17.4, 2.8),
    (122.0, 22.8, -10.6, 15.0, 2.6),
    (124.0, 18.0, -8.6, 12.6, 2.4),
    (125.2, 10.0, -6.0, 10.0, 2.2),
]
Z_BASTILLA = 67.0      # donde se corta la tela; la bastilla baja a 64.8 (más abajo, el muslo la tocaba en idle)
# pegada como el hoodie (Oscar: "que no parezca un costal"): las costuras van sobre la base del hoodie y lo
# inflado son gajos chicos y redondos (alto ~2 veces lo que se inflan), no volumen
COSTURAS_TORSO = [68.0, 76.0, 84.0, 92.0, 100.0, 108.5, 121.0]
SEPARA = -0.3         # al frente y atrás la costura se mete esto de la base: el gajo se lee sin tanto volumen
                      # (a los lados no: bajo el brazo el omóplato se metía en la tela)
GAJO_FRENTE = 2.6     # cuánto se infla el gajo al frente y atrás
GAJO_LADO = 0.7       # y bajo el brazo: casi nada, para que la manga no choque con el costado
CIERRE_ANCHO = (0.8, 4.6)   # el surco del cierre: de 0 a todo el gajo entre estos |x| (solo al frente)
# holgura propia a la altura de las axilas, a los lados y hacia el omóplato: esa tela va a medio peso entre el brazo
# y la espalda y, al bajar el brazo en idle, se hundía en el omóplato (pasaba o no según cómo saliera QuadriFlow)
AXILA_HOLGURA = 1.0; AXILA_Z = (110.0, 6.0)
NT = 128


def anillo_en(z):
    if z <= ANILLOS[0][0]:
        return ANILLOS[0][1:]
    for r0, r1 in zip(ANILLOS, ANILLOS[1:]):
        if r0[0] <= z <= r1[0]:
            t = (z - r0[0]) / (r1[0] - r0[0])
            return tuple(a + (b - a) * t for a, b in zip(r0[1:], r1[1:]))
    return ANILLOS[-1][1:]


def _super(t, a, yf, yb, n):
    c = (yf + yb) / 2; b = (yb - yf) / 2
    ct, st = math.cos(t), math.sin(t)
    return Vector((a * math.copysign(abs(ct) ** (2 / n), ct), c + b * math.copysign(abs(st) ** (2 / n), st), 0.0))


def torso_punto(z, t):
    a, yf, yb, n = anillo_en(z)
    p = _super(t, a, yf, yb, n)
    dt = 1e-3
    tg = _super(t + dt, a, yf, yb, n) - _super(t - dt, a, yf, yb, n)
    nr = Vector((tg.y, -tg.x, 0.0)).normalized()
    if nr.dot(Vector((p.x, p.y - (yf + yb) / 2, 0))) < 0:
        nr = -nr
    g, _ = gajo(z, COSTURAS_TORSO)
    amp = GAJO_LADO + (GAJO_FRENTE - GAJO_LADO) * abs(math.sin(t)) ** 2.0
    if p.y < 0:
        amp *= suave(CIERRE_ANCHO[0], CIERRE_ANCHO[1], abs(p.x))
    d = SEPARA * math.sin(t) ** 2 + amp * g
    d += AXILA_HOLGURA * math.exp(-((z - AXILA_Z[0]) / AXILA_Z[1]) ** 2) * (1 - abs(math.sin(t)) ** 4)
    q = p + nr * d
    q.z = z
    return q


def loft_cerrado(bm, filas):
    vs = [[bm.verts.new(p) for p in f] for f in filas]
    n = len(filas[0])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    for fila in (vs[0], vs[-1]):
        c = bm.verts.new(sum((v.co for v in fila), Vector()) / n)
        for i in range(n):
            bm.faces.new((fila[i], fila[(i + 1) % n], c))


def torso_proxy(dz=0.35, solo_bm=False):
    bm = bmesh.new()
    filas = []
    z = ANILLOS[0][0]
    while z <= ANILLOS[-1][0] + 1e-6:
        filas.append([torso_punto(z, 2 * math.pi * i / NT) for i in range(NT)])
        z += dz
    loft_cerrado(bm, filas)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm if solo_bm else objeto("inf_torso", bm)


# ===================== mangas =====================
def brazo(lado):
    B = ARM.data.bones
    return (B["arm_stretch." + lado].head_local.copy(), B["forearm_stretch." + lado].head_local.copy(),
            B["hand." + lado].head_local.copy())


def catmull(pts, por_tramo=16):
    P = [pts[0] + (pts[0] - pts[1])] + list(pts) + [pts[-1] + (pts[-1] - pts[-2])]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(por_tramo):
            t = k / por_tramo; t2 = t * t; t3 = t2 * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-1].copy())
    return out


def por_largo(poly, paso):
    """Remuestrea una polilínea a paso fijo: [(punto, s)]."""
    L = [0.0]
    for a, b in zip(poly, poly[1:]):
        L.append(L[-1] + (b - a).length)
    out = []; s = 0.0; j = 0
    while s <= L[-1] + 1e-6:
        while j < len(L) - 2 and L[j + 1] < s:
            j += 1
        t = (s - L[j]) / max(L[j + 1] - L[j], 1e-9)
        out.append((poly[j].lerp(poly[j + 1], min(1.0, t)), s))
        s += paso
    return out


# s = cm a lo largo de la manga desde el hombro (arm_stretch.head); el codo cae en 27.2
COSTURAS_MANGA = [-4.0, 3.8, 11.6, 19.4, 27.2, 33.7, 40.2, 46.7]
S_CORTE_MANGA = 47.3          # donde acaba la tela (el puño la cubre)
# cuánto se infla cada anillo arriba/afuera, del hombro al puño; el del hombro poco: junto al hombro "afuera"
# es arriba y una joroba de 7 cm subía el cuello hasta el cráneo
GAJO_AFUERA = [1.6, 2.5, 2.45, 2.4, 2.3, 2.2, 2.1]
GAJO_ADENTRO = 0.5            # y del lado del cuerpo (donde roza el costado)
# radio de la costura: la envolvente medida del brazo (mas grande atras del codo) + 1.7, y + 1.9 junto al hombro
# (con 2 mm menos, en idle el brazo atravesaba la tela de atrás de la axila)
RADIO_MANGA = [(-14.0, 8.4), (-4.0, 7.2), (0.0, 6.6), (12.0, 6.4), (18.0, 6.9), (21.0, 7.6), (27.2, 7.7),
               (33.0, 7.8), (38.0, 6.9), (42.0, 6.3), (49.0, 6.3)]


def _tabla(tab, x):
    if x <= tab[0][0]:
        return tab[0][1]
    for (x0, y0), (x1, y1) in zip(tab, tab[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return tab[-1][1]


def manga_camino(lado='l', paso=0.3):
    """[(punto, s, T, o)] a lo largo del brazo izquierdo; o = el lado de afuera (arriba y afuera, en el
    plano del frente), perpendicular al camino."""
    h, c, m = brazo(lado)
    uf = (m - c).normalized()
    ctrl = [Vector((12.0, 1.0, 113.0)), Vector((h.x, h.y + 0.2, h.z - 0.5)), (h + c) / 2, c,
            c + uf * 8.0, c + uf * 16.0, c + uf * 23.0, c + uf * 26.0]
    poly = catmull(ctrl, 24)
    # s = 0 en el punto mas cercano al hombro
    pts = por_largo(poly, paso)
    i0 = min(range(len(pts)), key=lambda i: (pts[i][0] - h).length)
    s0 = pts[i0][1]
    out = []
    Y = Vector((0, 1, 0))
    for i, (p, s) in enumerate(pts):
        a = pts[max(i - 1, 0)][0]; b = pts[min(i + 1, len(pts) - 1)][0]
        T = (b - a).normalized()
        o = T.cross(Y).normalized()
        out.append((p, s - s0, T, o))
    return out


def gajo_manga(s):
    g, k = gajo(s, COSTURAS_MANGA)
    return g, GAJO_AFUERA[max(0, k)], k


def manga_seccion(p, s, T, o, NS=72):
    w = T.cross(o)
    g, afuera, _ = gajo_manga(s)
    r0 = _tabla(RADIO_MANGA, s)
    fila = []
    for i in range(NS):
        ph = 2 * math.pi * i / NS
        d = o * math.cos(ph) + w * math.sin(ph)
        amp = GAJO_ADENTRO + (afuera - GAJO_ADENTRO) * ((1 + math.cos(ph)) / 2) ** 1.2
        fila.append(p + d * (r0 + amp * g))
    return fila


def mangas_proxy(solo_bm=False):
    bm = bmesh.new()
    camino = [c for c in manga_camino('l') if c[1] <= S_CORTE_MANGA + 1.5]
    filas = [manga_seccion(*c) for c in camino]
    loft_cerrado(bm, filas)
    der = [[espejo(p) for p in reversed(f)] for f in filas]
    loft_cerrado(bm, der)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm if solo_bm else objeto("inf_mangas", bm)


# ===================== aberturas =====================
# cuello: elipse alrededor del cuello atras y a los lados; al frente una V ancha arriba, porque la
# quijada (abierta 35 grados) baja hasta z 116.8 frente al pecho y sus esquinas miden +-13.6
CUELLO_C = Vector((0.0, 2.5)); CUELLO_AX = 19.0; CUELLO_R = 12.0; CUELLO_Z = 116.0
V_Z = 106.0; V_PEND = 1.05
V_MAX = CUELLO_AX * math.sqrt(1 - ((-1.0 - CUELLO_C.y) / CUELLO_R) ** 2)


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
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, Z_BASTILLA),
                           plane_no=(0, 0, 1), clear_inner=True)
    camino = manga_camino('l')
    p, s, T, _ = min(camino, key=lambda c: abs(c[1] - S_CORTE_MANGA))
    for sg in (1, -1):
        co = Vector((p.x * sg, p.y, p.z)); no = Vector((T.x * sg, T.y, T.z))
        geom = [v for v in bm.verts if v.co.x * sg > 40]
        geom = geom + list({e for v in geom for e in v.link_edges}) + list({f for v in geom for f in v.link_faces})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_outer=True)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abierto(f.calc_center_median())], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # islas sueltas que deje el corte (pedacitos entre la V y el cuello)
    vistos = set(); islas = []
    for v in bm.verts:
        if v in vistos:
            continue
        pila = [v]; isla = []; vistos.add(v)
        while pila:
            x = pila.pop(); isla.append(x)
            for e in x.link_edges:
                w = e.other_vert(x)
                if w not in vistos:
                    vistos.add(w); pila.append(w)
        islas.append(isla)
    grande = max(islas, key=len)
    sueltos = [v for isla in islas if isla is not grande for v in isla]
    if sueltos:
        bmesh.ops.delete(bm, geom=sueltos, context='VERTS')
    # la orilla del cuello sale de voxel en escalones: suavizarla sobre la superficie
    for _ in range(iteraciones):
        nuevos = {}
        for v in bm.verts:
            if not v.is_boundary or v.co.z < 100 or abs(v.co.x) > 30:
                continue
            vec = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(vec) != 2:
                continue
            q = v.co.lerp((vec[0].co + vec[1].co) / 2, 0.5)
            loc = bvh.find_nearest(q)[0]
            nuevos[v] = loc if loc is not None else q
        for v, q in nuevos.items():
            v.co = q
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return len(sueltos)


def afuera(bm):
    """Voltea todas las caras si la mayoría del torso mira hacia adentro."""
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


AXILA_C = Vector((23.0, 1.0, 108.0)); AXILA_R = 13.0


def relajar(o, forma, vueltas=8, f=0.5):
    """QuadriFlow dobla caras donde la superficie se quiebra: cada vértice va al promedio de sus vecinos
    y regresa a la superficie de antes de QuadriFlow; donde algo siga volteado, se insiste ahí."""
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


def afinar_costuras(o, forma, bvh_torso, bvh_manga, vueltas=4):
    """QuadriFlow (~2 cm por arista) deja las costuras en un valle redondo y los gajos se pierden. Sus aristas
    siguen los gajos, así que junto a cada costura corre una fila de vértices: esa fila se lleva al fondo del
    valle (de los vecinos que cruzan la costura, el que le queda más cerca) y lo demás se reparte sobre la
    forma de antes. Regresa cuántos vértices se movieron a una costura."""
    camino = manga_camino('l', paso=0.25)
    kd = KDTree(len(camino))
    for i, c in enumerate(camino):
        kd.insert(c[0], i)
    kd.balance()
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    largo = sum(e.calc_length() for e in bm.edges) / max(len(bm.edges), 1)
    cost_t = COSTURAS_TORSO[1:-1]; cost_m = COSTURAS_MANGA[1:-1]
    def coord(p):
        dt = bvh_torso.find_nearest(p)[3]; dm = bvh_manga.find_nearest(p)[3]
        if dt < dm - 0.4 and COSTURAS_TORSO[0] < p.z < COSTURAS_TORSO[-1]:
            return 't', p.z, None
        if dm < dt - 0.4:
            q = Vector((abs(p.x), p.y, p.z))
            _, i, _ = kd.find(q)
            pc, s, T, _ = camino[i]
            s = s + (q - pc).dot(T)
            if p.x < 0:
                T = Vector((-T.x, T.y, T.z))
            return 'm', s, T
        return None, None, None
    info = [coord(v.co) for v in bm.verts]
    fijos = set()
    for v in bm.verts:
        k, u, T = info[v.index]
        if k is None or v.is_boundary:
            continue
        # junto a la axila las costuras del torso y de la manga se juntan sin orden: ahí no se tocan (las dejaba
        # en zigzag y se veían como manchas)
        if min((v.co - Vector((sg * AXILA_C.x, AXILA_C.y, AXILA_C.z))).length for sg in (1, -1)) < AXILA_R:
            continue
        S = min(cost_t if k == 't' else cost_m, key=lambda c: abs(c - u))
        d = u - S
        if abs(d) > 0.7 * largo:
            continue
        minimo = True
        for e in v.link_edges:
            w = e.other_vert(v)
            kw, uw, _ = info[w.index]
            if kw != k:
                continue
            if abs(uw - u) > 0.4 * e.calc_length() and abs(uw - S) < abs(d):
                minimo = False; break
        if not minimo:
            continue
        p = v.co.copy()
        q = Vector((p.x, p.y, S)) if k == 't' else p - T * d
        for _ in range(3):
            q = forma.find_nearest(q)[0]
        v.co = q
        fijos.add(v)
    for _ in range(vueltas):
        nuevos = {}
        for v in bm.verts:
            if v in fijos or v.is_boundary or not v.link_edges:
                continue
            m = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
            nuevos[v] = forma.find_nearest(v.co.lerp(m, 0.35))[0]
        for v, q in nuevos.items():
            v.co = q
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return len(fijos)


def unir_y_remallar(voxel=0.6, suaves=3, caras=6300, afilar=False, costuras=True):
    for x in list(col_tmp().objects):
        borrar(x.name)
    t = torso_proxy(); m = mangas_proxy()
    bmt = bmesh.new(); bmt.from_mesh(t.data); bvh_torso = BVHTree.FromBMesh(bmt); bmt.free()
    bmm = bmesh.new(); bmm.from_mesh(m.data); bvh_manga = BVHTree.FromBMesh(bmm); bmm.free()
    activo(t); m.select_set(True)
    bpy.ops.object.join()
    t.name = "inf_inflada"
    t.data.remesh_voxel_size = voxel
    t.data.use_remesh_fix_poles = True
    activo(t)
    bpy.ops.object.voxel_remesh()
    mod = t.modifiers.new("suave", 'SMOOTH'); mod.factor = 0.5; mod.iterations = suaves
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # el pliegue donde la manga entra al torso queda filoso con el voxel: se redondea solo esa zona
    g = t.vertex_groups.new(name="axila")
    for v in t.data.vertices:
        d = min((v.co - Vector((s * AXILA_C.x, AXILA_C.y, AXILA_C.z))).length for s in (1, -1))
        if d < AXILA_R:
            g.add([v.index], 1 - d / AXILA_R, 'REPLACE')
    mod = t.modifiers.new("suave_axila", 'SMOOTH'); mod.factor = 0.8; mod.iterations = 20; mod.vertex_group = "axila"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    t.vertex_groups.clear()
    t["sueltos"] = cortar(t)
    bm = bmesh.new(); bm.from_mesh(t.data)
    forma = BVHTree.FromBMesh(bm); bm.free()
    activo(t)
    bpy.ops.object.quadriflow_remesh(target_faces=caras, use_preserve_sharp=afilar, use_preserve_boundary=True,
                                     smooth_normals=False, use_mesh_symmetry=True)
    t["volteadas"] = relajar(t, forma)
    if costuras:
        t["en_costura"] = afinar_costuras(t, forma, bvh_torso, bvh_manga)
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
    for m in (mat("Inflada_Tela", AMARILLO, 0.42),
              # el forro casi del color de la tela: en el pliegue de la axila se asoma al doblar el brazo
              mat("Inflada_Forro", (0.75, 0.45, 0.0075), 0.8),
              mat("Inflada_Puno", AMARILLO, 0.6),
              mat("Inflada_Cierre", NEGRO, 0.5),
              mat("Inflada_Picos", AZUL, 0.9),
              mat("Inflada_Cuello", AMARILLO, 0.42)):
        o.data.materials.append(m)


def grosor(o, t=0.55):
    activo(o)
    m = o.modifiers.new("grosor", 'SOLIDIFY')
    # sin even offset (en la chamarra disparaba vertices en los dobleces)
    m.thickness = t; m.offset = -1.0; m.use_rim = True; m.use_even_offset = False; m.use_quality_normals = True
    m.material_offset = 1; m.material_offset_rim = 0
    bpy.ops.object.modifier_apply(modifier=m.name)
    return forro_adentro(o)


def forro_adentro(o, holgura=0.3, vueltas=10):
    """En los pliegues la cara de adentro puede cruzar la de afuera: el vértice del forro que quede
    afuera, o a menos de holgura de la cara de afuera, regresa abajo de ella; luego, mientras alguna
    cara del forro cruce la de afuera, sus vértices bajan un poco más. Regresa (movidos, cruces)."""
    me = o.data
    fuera = [tuple(p.vertices) for p in me.polygons if p.material_index == TELA]
    dentro = [tuple(p.vertices) for p in me.polygons if p.material_index == FORRO]
    en_fuera = {i for f in fuera for i in f}
    forro = sorted({i for f in dentro for i in f} - en_fuera)
    movidos = set()
    for vuelta in range(vueltas):
        vs = [v.co.copy() for v in me.vertices]
        bvh = BVHTree.FromPolygons(vs, fuera)
        if vuelta == 0:
            cuales = forro; h = holgura
        else:
            bd = BVHTree.FromPolygons(vs, dentro)
            pares = [(i, j) for i, j in bvh.overlap(bd) if not (set(fuera[i]) & set(dentro[j]))]
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


# ===================== orillas =====================
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
    pl = max(punos, key=lambda l: prom(l, lambda p: p.x)) if punos else None
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


# --- bastilla y puños: tubo liso con corte de rectángulo redondeado
def perfil_banda(di, do, h0, h1, rc, panza=0.25):
    """[(n, u)] alrededor del corte, empezando abajo-afuera; y di (lo de adentro va en el forro)."""
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
    return pts, di


def barrer_banda(bm, marcos, perfiles):
    filas = []
    for (o, n, u), (perf, di) in zip(marcos, perfiles):
        filas.append([bm.verts.new(o + n * pn + u * pu) for pn, pu in perf])
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


def bastilla(bm, lazo, paso=1.5, di=-0.9, do=1.1, alto=(-2.2, 1.3), rc=0.9):
    pts = desde_plano(lazo, atras=True)
    L = sum((pts[(i + 1) % len(pts)][0] - pts[i][0]).length for i in range(len(pts)))
    m = int(L / paso) // 2 * 2
    pts, _ = remuestrear(pts, m)
    centro = sum((p for p, _ in pts), Vector()) / m
    u = Vector((0, 0, 1))
    marcos = []
    for i, (p, _) in enumerate(pts):
        t = (pts[(i + 1) % m][0] - pts[i - 1][0]).normalized()
        nn = t.cross(u).normalized()
        ref = p - centro; ref = ref - u * ref.dot(u)
        if nn.dot(ref) < 0:
            nn = -nn
        marcos.append((p, nn, u))
    perf = perfil_banda(di, do, alto[0], alto[1], rc, panza=0.3)
    vs, _ = barrer_banda(bm, marcos, [perf] * m)
    return vs, dict(muestras=m, largo=round(L, 1))


R_PUNO = 6.1   # radio de adentro del puño desde el eje del antebrazo (el antebrazo mide hasta 5.0 ahí)


def punos(bm, lazo_l, paso=1.25, do=1.1, alto=(-1.0, 3.0), rc=0.9):
    """Puño izquierdo sobre la orilla real de la manga (delgado, liso); el derecho es su espejo."""
    h, c, mu = brazo('l')
    uf = (mu - c).normalized()
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
        perfiles.append(perfil_banda(R_PUNO - ri, do, alto[0], alto[1], rc, panza=0.3))
    vs, caras = barrer_banda(bm, marcos, perfiles)
    nuevos = {v: bm.verts.new(espejo(v.co)) for v in vs}
    for f in caras:
        g = bm.faces.new([nuevos[v] for v in reversed(f.verts)])
        g.material_index = f.material_index; g.smooth = True
    return vs + list(nuevos.values()), dict(muestras=m, radio_orilla=(round(min(radios), 2), round(max(radios), 2)))


# --- cuello de rollo: tubo inflado a lo largo de la orilla del cuello, parado atrás y a los lados y acostado
# sobre el pecho en la V (A = medio grueso, B = medio alto). Atrás no puede pasar de ~131: el cráneo baja a
# 133.9 a 8-12 cm del eje del cuello
CUELLO_ATRAS = (2.8, 3.6); CUELLO_LADO = (2.6, 2.3); CUELLO_FRENTE = (2.4, 2.0); CUELLO_PUNTA = (1.5, 1.4)
# qué tanto del grueso del rollo queda sobre la abertura (el resto, sobre la tela): atrás, a los lados y al
# frente; adelante de los lados poco, porque ahí bajan las esquinas de la quijada abierta
CUELLO_ADENTRO = (0.35, 0.22, 0.05)
CUELLO_PARADO = 0.75      # atrás, cuánto se endereza hacia arriba (0 = sigue la normal de la tela)


def cuello_medidas(s, p):
    c = math.cos(math.atan2(p.x, p.y - CUELLO_C.y))
    w = max(0.0, c) ** 1.2
    A = CUELLO_LADO[0] + (CUELLO_ATRAS[0] - CUELLO_LADO[0]) * w
    B = CUELLO_LADO[1] + (CUELLO_ATRAS[1] - CUELLO_LADO[1]) * w
    f = suave(0.0, 0.6, -c)
    A += (CUELLO_FRENTE[0] - A) * f; B += (CUELLO_FRENTE[1] - B) * f
    t = suave(0.82, 1.0, abs(s))
    return A + (CUELLO_PUNTA[0] - A) * t, B + (CUELLO_PUNTA[1] - B) * t


def cuello(bm, lazo, bvh_tela, m=96, k_seg=14, hundir=0.5):
    pts = desde_plano(lazo, atras=False)
    pts, L = remuestrear(pts, m)
    centro = sum((p for p, _ in pts), Vector()) / m
    camino = pts[1:]
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
        A, B = cuello_medidas(s, p)
        # parado: el alto del rollo va hacia arriba atrás y a los lados; en la V sigue la normal del pecho
        cc = math.cos(math.atan2(p.x, p.y - CUELLO_C.y))
        a = CUELLO_PARADO * suave(0.0, 0.7, cc)
        U = Nn * (1 - a) + Vector((0, 0, 1)) * a
        U = (U - T * U.dot(T)).normalized()
        Bn = T.cross(U).normalized()
        if Bn.dot(p - centro) < 0:
            Bn = -Bn
        Nn = U
        ad = CUELLO_ADENTRO[1] + (CUELLO_ADENTRO[0] - CUELLO_ADENTRO[1]) * max(0.0, cc)             + (CUELLO_ADENTRO[2] - CUELLO_ADENTRO[1]) * suave(0.0, 0.5, -cc)
        c = p + Bn * (A * (1 - 2 * ad)) + Nn * (B - hundir)
        datos.append((c, T, Nn, Bn, A, B, s))
    # suavizar los marcos (la orilla tiene quiebres)
    for _ in range(6):
        nuevos = []
        for k in range(n):
            k0, k1 = max(k - 1, 0), min(k + 1, n - 1)
            c, T, Nn, Bn, A, B, s = datos[k]
            cc = (datos[k0][0] + c * 2 + datos[k1][0]) / 4
            NN = (datos[k0][2] + Nn * 2 + datos[k1][2]).normalized()
            BB = (datos[k0][3] + Bn * 2 + datos[k1][3]).normalized()
            nuevos.append((cc, T, NN, BB, A, B, s))
        datos = nuevos
    filas = []
    for (c, T, Nn, Bn, A, B, s) in datos:
        fila = []
        for k in range(k_seg):
            th = 2 * math.pi * k / k_seg
            ct, st = math.cos(th), math.sin(th)
            q = c + Bn * (A * ct) + Nn * (B * st)
            if st < 0:
                # la mitad de abajo se asienta sobre la tela
                loc, nq, _, _ = bvh_tela.find_nearest(q)
                if loc is not None:
                    q = q.lerp(loc - nq * 0.35, (-st) ** 0.8)
            fila.append(bm.verts.new(q))
        filas.append(fila)
    caras = []
    for f0, f1 in zip(filas, filas[1:]):
        for k in range(k_seg):
            kk = (k + 1) % k_seg
            caras.append(bm.faces.new((f0[k], f0[kk], f1[kk], f1[k])))
    for fila, (c, T, Nn, Bn, A, B, s), sentido in ((filas[0], datos[0], -1), (filas[-1], datos[-1], 1)):
        cen = sum((v.co for v in fila), Vector()) / len(fila)
        tip = bm.verts.new(cen + T * sentido * min(A, B) * 0.8)
        for k in range(k_seg):
            caras.append(bm.faces.new((fila[k], fila[(k + 1) % k_seg], tip)))
    for f in caras:
        f.material_index = CUELLO; f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    vs = list({v for f in caras for v in f.verts})
    return vs, dict(muestras=n, largo=round(L, 1))


# --- cierre: tira negra en el surco del frente, de la bastilla al fondo de la V
def cierre(bm, bvh_tela, z0=Z_BASTILLA + 1.2, z1=V_Z - 0.2, paso=0.7, ancho=0.9, alto=0.35):
    filas = []
    z = z0
    while z <= z1:
        hit = bvh_tela.ray_cast(Vector((0.0, -80.0, z)), Vector((0, 1, 0)))
        if hit[0] is not None and hit[0].y < -5:
            p, nr = hit[0], hit[1]
            X = Vector((1, 0, 0))
            Nn = (nr - X * nr.dot(X)).normalized()
            c = p + Nn * 0.05
            filas.append([c - X * ancho / 2, c + X * ancho / 2, c + X * ancho / 2 + Nn * alto, c - X * ancho / 2 + Nn * alto])
        z += paso
    vs = [[bm.verts.new(q) for q in f] for f in filas]
    caras = []
    for a, b in zip(vs, vs[1:]):
        for i in range(4):
            j = (i + 1) % 4
            caras.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    caras.append(bm.faces.new(list(reversed(vs[0]))))
    caras.append(bm.faces.new(vs[-1]))
    for f in caras:
        f.material_index = CIERRE; f.smooth = False
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    return [v for f in vs for v in f], dict(filas=len(filas))


# --- picos: conos de tela rellenos, uno en la cresta de cada anillo de la manga, por el lado de afuera
PERFIL_PICO = [(0.0, 0.0), (1.0, 0.0), (1.05, 0.12), (1.02, 0.30), (0.9, 0.66), (0.71, 1.08), (0.5, 1.5),
               (0.3, 1.86), (0.14, 2.08), (0.0, 2.16)]
PICO_R = (2.6, 1.9)        # radio de la base, del hombro al puño
PICO_HUNDE = 0.45          # la base entra esto en la tela


def pico(bm, base, eje, R, seg=12, bvh=None):
    """El perfil girado alrededor de eje; con bvh, la parte de abajo (h <= 0.3 R) se asienta en la tela (la
    cresta del anillo es curva y la orilla de una base plana quedaba en el aire)."""
    q = eje.to_track_quat('Z', 'Y').to_matrix()
    anillos = []
    for (r, z) in PERFIL_PICO:
        if r == 0.0:
            pts = [base + q @ Vector((0, 0, z * R))]
        else:
            pts = [base + q @ Vector((r * R * math.cos(2 * math.pi * i / seg), r * R * math.sin(2 * math.pi * i / seg), z * R))
                   for i in range(seg)]
        if bvh is not None and z <= 0.31:
            asentados = []
            for pt in pts:
                hit = bvh.ray_cast(pt + eje * 8.0, -eje)
                asentados.append(hit[0] + eje * (z * R - PICO_HUNDE) if hit[0] is not None else pt)
            pts = asentados
        anillos.append([bm.verts.new(pt) for pt in pts])
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
        f.material_index = PICOS; f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    return [v for fila in anillos for v in fila]


def picos(bm, bvh_tela):
    """Uno por anillo de cada manga, en la cresta del lado de afuera; el derecho es el espejo."""
    camino = manga_camino('l', paso=0.1)
    n = len(COSTURAS_MANGA) - 1
    hechos = []
    vs_l = []
    for k in range(n):
        sc = (COSTURAS_MANGA[k] + COSTURAS_MANGA[k + 1]) / 2
        p, s, T, o = min(camino, key=lambda c: abs(c[1] - sc))
        hit = bvh_tela.ray_cast(p + o * 40.0, -o)
        if hit[0] is None:
            continue
        loc, nr = hit[0], hit[1]
        eje = (o + nr).normalized()
        R = PICO_R[0] + (PICO_R[1] - PICO_R[0]) * k / max(n - 1, 1)
        vs_l += pico(bm, loc - eje * PICO_HUNDE, eje, R, bvh=bvh_tela)
        hechos.append(dict(s=round(s, 1), R=round(R, 2), base=[round(x, 1) for x in loc]))
    nuevos = {v: bm.verts.new(espejo(v.co)) for v in vs_l}
    caras_l = {f for v in vs_l for f in v.link_faces}
    for f in caras_l:
        g = bm.faces.new([nuevos[v] for v in reversed(f.verts)])
        g.material_index = PICOS; g.smooth = True
    return vs_l + list(nuevos.values()), hechos


# ===================== pesos =====================
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


def _transferir(o, piezas):
    """Pesos (remapeados) que le tocan a cada vértice de o desde la superficie más cercana de esas piezas."""
    copias = []
    for n in piezas:
        src = bpy.data.objects[n]
        c = src.copy(); c.data = src.data.copy(); c.modifiers.clear()
        col_tmp().objects.link(c); copias.append(c)
    activo(copias[0])
    for c in copias:
        c.select_set(True)
    if len(copias) > 1:
        bpy.ops.object.join()
    cuerpo = copias[0]; cuerpo.name = "inf_cuerpo"
    o.vertex_groups.clear()
    for g in cuerpo.vertex_groups:
        o.vertex_groups.new(name=g.name)
    m = o.modifiers.new("pesos", 'DATA_TRANSFER')
    m.object = cuerpo; m.use_vert_data = True; m.data_types_verts = {'VGROUP_WEIGHTS'}
    m.vert_mapping = 'POLYINTERP_NEAREST'
    m.layers_vgroup_select_src = 'ALL'; m.layers_vgroup_select_dst = 'NAME'
    activo(o)
    bpy.ops.object.modifier_apply(modifier=m.name)
    borrar("inf_cuerpo")
    nombres = {g.index: g.name for g in o.vertex_groups}
    pesos = []
    for v in o.data.vertices:
        d = {}
        for g in v.groups:
            if g.weight <= 1e-4:
                continue
            dst = remapeo(nombres[g.group])
            if dst:
                d[dst] = d.get(dst, 0.0) + g.weight
        pesos.append(d)
    o.vertex_groups.clear()
    return pesos


def pesar_tela(o, repeticiones=10, factor=0.5, axila=(25.0, 1.5, 106.0), radio_axila=22.0, rep_axila=140,
               radio_codo=15.0, rep_codo=90, torso_aparte=True):
    """Pesos de la tela (la malla en este momento es solo la tela con grosor). Con torso_aparte, la tela del
    torso (la que queda más cerca del torso de antes que de la manga) toma los pesos solo del tórax y la
    pelvis: detrás de la axila la superficie más cercana era la del brazo, esa tela se iba con el brazo y el
    omóplato se asomaba."""
    me = o.data
    pesos = _transferir(o, PIEZAS_CUERPO)
    if torso_aparte:
        solo_torso = _transferir(o, ["Egg_Torax", "Egg_Pelvis"])
        bt = torso_proxy(solo_bm=True); bvt = BVHTree.FromBMesh(bt); bt.free()
        bmn = mangas_proxy(solo_bm=True); bvm = BVHTree.FromBMesh(bmn); bmn.free()
        for i, v in enumerate(me.vertices):
            dt = bvt.find_nearest(v.co)[3]; dm = bvm.find_nearest(v.co)[3]
            w = suave(-1.5, 1.5, dm - dt)     # 1 = tela del torso
            if w <= 0:
                continue
            d = {}
            for k in set(pesos[i]) | set(solo_torso[i]):
                d[k] = pesos[i].get(k, 0.0) * (1 - w) + solo_torso[i].get(k, 0.0) * w
            pesos[i] = d
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


def _islas(me, idx):
    """Islas (por aristas) de los vértices idx."""
    en = set(idx)
    vecinos = {i: set() for i in idx}
    for e in me.edges:
        a, b = e.vertices
        if a in en and b in en:
            vecinos[a].add(b); vecinos[b].add(a)
    vistos = set(); out = []
    for i in idx:
        if i in vistos:
            continue
        pila = [i]; isla = []; vistos.add(i)
        while pila:
            x = pila.pop(); isla.append(x)
            for w in vecinos[x]:
                if w not in vistos:
                    vistos.add(w); pila.append(w)
        out.append(isla)
    return out


def pesos_desde_tela(o, n_tela, rep=6):
    """Cada vértice agregado (índice >= n_tela) con el peso de la tela de afuera justo bajo él,
    interpolado en el triángulo que pisa; luego suavizado dentro de su pieza. Los picos van rígidos:
    toda la pieza con el peso de la tela bajo el centro de su base."""
    me = o.data
    pesos = leer_pesos(o)
    tris = []
    for p in me.polygons:
        if p.material_index == TELA and all(i < n_tela for i in p.vertices):
            vv = list(p.vertices)
            for t in range(1, len(vv) - 1):
                tris.append((vv[0], vv[t], vv[t + 1]))
    bvh = BVHTree.FromPolygons([v.co for v in me.vertices], tris)
    def bajo(co):
        loc, _, ti, _ = bvh.find_nearest(co)
        a, b, c = tris[ti]
        A, B, C = me.vertices[a].co, me.vertices[b].co, me.vertices[c].co
        bar = barycentric_transform(loc, A, B, C, Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        acc = {}
        for idx, w in zip((a, b, c), (bar.x, bar.y, bar.z)):
            for k, pw in pesos[idx].items():
                acc[k] = acc.get(k, 0.0) + max(w, 0.0) * pw
        return limpiar(acc)
    pico_v = set()
    for p in me.polygons:
        if p.material_index == PICOS:
            pico_v.update(p.vertices)
    nuevos = [i for i in range(n_tela, len(me.vertices)) if i not in pico_v]
    for i in nuevos:
        pesos[i] = bajo(me.vertices[i].co)
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    vecinos = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    bm.free()
    suavizar_pesos(pesos, nuevos, vecinos, rep, 0.5)
    for i in nuevos:
        pesos[i] = limpiar(pesos[i])
    # picos: la parte de abajo sigue la tela que pisa (rígidos, cerca del codo la orilla de la base se despegaba
    # 1.3 cm o se hundía) y de ahí a la punta pasan al peso de la tela bajo el centro de la base, rígido: un cono
    # de tela relleno que se dobla un poco en la base. Los vértices van en el orden en que se hicieron.
    n_picos = 0
    anillos = len(PERFIL_PICO) - 2
    for isla in _islas(me, sorted(pico_v)):
        isla = sorted(isla)
        seg = (len(isla) - 2) // anillos
        cen = sum((me.vertices[i].co for i in isla[:1 + seg]), Vector()) / (1 + seg)
        rigido = bajo(cen)
        for j, i in enumerate(isla):
            z = 0.0 if j == 0 else (PERFIL_PICO[-1][1] if j == len(isla) - 1 else PERFIL_PICO[(j - 1) // seg + 1][1])
            t = suave(0.3, 1.2, z)
            propio = bajo(me.vertices[i].co) if t < 1 else {}
            d = {}
            for k in set(propio) | set(rigido):
                d[k] = propio.get(k, 0.0) * (1 - t) + rigido.get(k, 0.0) * t
            pesos[i] = limpiar(d)
        n_picos += 1
    escribir_pesos(o, pesos)
    return n_picos


def espejar_pesos(o):
    """Los pesos de x<0 = los de su espejo en x>0 (.l <-> .r)."""
    me = o.data
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


# --- estampados (Oscar, 2026-11-18): su X magenta de brocha, grande en la espalda y chica en el pecho. La imagen,
# recortada a la X con fondo transparente, vive en Character/assets; cada estampado es una rejilla pegada a la tela
# de afuera (cada vértice sobre la tela, un poco encima, con el peso de la tela bajo él: se dobla con ella) y lo
# transparente no se dibuja. Como el estampado de la chamarra de piel.
RUTA_X = r"D:\Work\mroscar\Website\new\Character\assets\inflada_x.png"
ESTAMPADOS = {
    # centro (x, z) en la superficie, alto en cm, cara (+1 espalda, -1 frente). El del pecho va del lado derecho
    # de Skulley, como el parche de la chamarra: del izquierdo lo tapa la luz de la llama de la mano
    "espalda": dict(x=0.0, z=94.0, alto=32.0, cara=1),
    "pecho": dict(x=-11.0, z=99.0, alto=8.0, cara=-1),
}


def material_estampado(nombre="Inflada_Estampado", ruta=RUTA_X, imagen="Inflada_X"):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    img = bpy.data.images.get(imagen)
    if img:
        img.filepath = ruta
        if img.packed_file:
            img.unpack(method='REMOVE')
        img.reload()
    else:
        img = bpy.data.images.load(ruta)
        img.name = imagen
    img.pack()
    tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None) or nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.location = (-420, 260)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    # lo transparente no se dibuja (recorte en 0.5, como alphaTest en el sitio)
    corte = next((n for n in nt.nodes if n.type == 'MATH' and n.operation == 'GREATER_THAN'), None)
    if not corte:
        corte = nt.nodes.new('ShaderNodeMath'); corte.operation = 'GREATER_THAN'
    corte.inputs[1].default_value = 0.5
    corte.location = (-180, 40)
    nt.links.new(tex.outputs['Alpha'], corte.inputs[0])
    nt.links.new(corte.outputs['Value'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.6
    bsdf.inputs['Metallic'].default_value = 0.0
    m.diffuse_color = (1, 0, 1, 1)
    return m, img


def estampar(o, celda=0.8, encima=0.12):
    """Pone (o rehace) los estampados de ESTAMPADOS sobre la tela de afuera. Se puede correr sobre la chamarra ya
    montada: borra los que tenga y los vuelve a poner."""
    me = o.data
    mat, img = material_estampado()
    nombres = [x.name if x else None for x in me.materials]
    while len(nombres) < ESTAMPADO:
        me.materials.append(None); nombres.append(None)
    if len(nombres) == ESTAMPADO:
        me.materials.append(mat)
    else:
        me.materials[ESTAMPADO] = mat
    aspecto = img.size[0] / img.size[1]
    bm = bmesh.new(); bm.from_mesh(me)
    viejas = [f for f in bm.faces if f.material_index == ESTAMPADO]
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
        if f.material_index != TELA:
            continue
        vv = [v.index for v in f.verts]
        for t in range(1, len(vv) - 1):
            tris.append((vv[0], vv[t], vv[t + 1]))
    bvh = BVHTree.FromPolygons(coords, tris)
    info = {}
    for nombre, cfg in ESTAMPADOS.items():
        x0, z0, H, cara = cfg["x"], cfg["z"], cfg["alto"], cfg["cara"]
        W = H * aspecto
        hit = bvh.ray_cast(Vector((x0, 80.0 * cara, z0)), Vector((0, -cara, 0)))
        P0, N0 = hit[0], hit[1].normalized()
        # el estampado mira hacia afuera parejo (de frente o de espaldas), no siguiendo un gajo
        N0 = Vector((0, cara, 0))
        arriba = Vector((0, 0, 1))
        derecha = arriba.cross(N0).normalized()
        ni, nk = max(4, int(round(W / celda))), max(4, int(round(H / celda)))
        uv_de = {}
        def colocar(u, v):
            guia = P0 + derecha * u + arriba * v + N0 * 8.0
            h = bvh.ray_cast(guia, -N0)
            if h[0] is None:
                loc, nrm, ti, _ = bvh.find_nearest(guia)
            else:
                loc, nrm, ti = h[0], h[1], h[2]
            vert = bm.verts.new(loc + nrm.normalized() * encima)
            a, b, c = tris[ti]
            bar = barycentric_transform(loc, coords[a], coords[b], coords[c], Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
            acc = {}
            for idx, w in zip((a, b, c), (bar.x, bar.y, bar.z)):
                for gi, gw in pesos[idx].items():
                    acc[gi] = acc.get(gi, 0.0) + max(w, 0.0) * gw
            top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
            sm = sum(w for _, w in top) or 1.0
            for gi, gw in top:
                vert[deform][gi] = gw / sm
            uv_de[vert] = (0.5 + u / W, 0.5 + v / H)
            return vert
        rejilla = [[colocar(W * (i / ni - 0.5), H * (k / nk - 0.5)) for i in range(ni + 1)] for k in range(nk + 1)]
        nuevas = []
        for k in range(nk):
            for i in range(ni):
                nuevas.append(bm.faces.new((rejilla[k][i], rejilla[k][i + 1], rejilla[k + 1][i + 1], rejilla[k + 1][i])))
        for f in nuevas:
            f.material_index = ESTAMPADO
            f.smooth = True
            for lp in f.loops:
                lp[uvl].uv = uv_de[lp.vert]
        bm.normal_update()
        if nuevas[len(nuevas) // 2].normal.dot(N0) < 0:
            bmesh.ops.reverse_faces(bm, faces=nuevas)
        info[nombre] = dict(caras=len(nuevas), centro=[round(x, 1) for x in P0], ancho=round(W, 1), alto=H)
    bm.to_mesh(me); bm.free(); me.update()
    return info


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


def todo(caras=6300, suaves=3, afilar=False, kw_pesos=None):
    """Arma la chamarra desde cero. Regresa (objeto, info)."""
    ad = ARM.animation_data
    if ad and ad.action:
        ad.action = None
    reposo()
    borrar(NOMBRE)
    try:
        o = unir_y_remallar(caras=caras, suaves=suaves, afilar=afilar)
        materiales(o)
        orillas = lazos(o)
        info = dict(orillas=orillas["n"], volteadas=o.get("volteadas"), sueltos=o.get("sueltos"), en_costura=o.get("en_costura"))
        if orillas["n"] != 4:
            raise RuntimeError(f"la tela salió con {orillas['n']} orillas (cuello, abajo y dos puños): QuadriFlow cerró o abrió algo")
        bm0 = bmesh.new(); bm0.from_mesh(o.data)
        bvh_tela = BVHTree.FromBMesh(bm0); bm0.free()
        info["forro"] = grosor(o)
        info["tela"] = pesar_tela(o, **(kw_pesos or {}))
        n_tela = len(o.data.vertices)
        bm = bmesh.new(); bm.from_mesh(o.data)
        _, info["bastilla"] = bastilla(bm, orillas["abajo"])
        _, info["punos"] = punos(bm, orillas["puno_l"])
        _, info["cuello"] = cuello(bm, orillas["cuello"], bvh_tela)
        _, info["cierre"] = cierre(bm, bvh_tela)
        _, info["picos"] = picos(bm, bvh_tela)
        bm.to_mesh(o.data); bm.free(); o.data.update()
        info["picos_rigidos"] = pesos_desde_tela(o, n_tela)
        info["espejo"] = espejar_pesos(o)
        # después del espejo: la X del pecho va de un solo lado
        info["estampados"] = estampar(o)
        montar(o)
        me = o.data
        info["verts"] = len(me.vertices)
        info["tris"] = sum(len(p.vertices) - 2 for p in me.polygons)
        info["huesos"] = len(o.vertex_groups)
    finally:
        c = bpy.data.collections.get(TMP)
        if c:
            for x in list(c.objects):
                borrar(x.name)
            bpy.data.collections.remove(c)
        a_pose()
    return o, info


# ===================== revisión =====================
# Cuerpo contra ropa por cruce de superficies (triángulo contra triángulo), como hoodie.py: si el
# cuerpo va bien adentro nunca cruza la cara de adentro, y lo que va afuera (quijada, cabeza) nunca
# cruza la de afuera ni el cuello. La profundidad se mide solo contra las caras que de verdad se
# cruzan, del lado de la tela.
CUERPO = ["Egg_Torax", "Egg_Arm1_L", "Egg_Arm1_R", "Egg_Arm2_L", "Egg_Arm2_R", "Egg_Pelvis",
          "Egg_Jaw", "Egg_Head", "Egg_Leg2_L", "Egg_Leg2_R"]
BRAZO = ("arm_", "forearm_")
HONDO_MAX = 3.0   # más allá de esto la prueba de lado ya no es confiable: 3.0 se lee como 3 o más


def _pos(o, dg):
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    m = ARM.matrix_world.inverted() @ o.matrix_world
    co = [0.0] * (3 * len(me.vertices)); me.vertices.foreach_get("co", co)
    vs = [m @ Vector(co[i:i + 3]) for i in range(0, len(co), 3)]
    oe.to_mesh_clear()
    return vs


def preparar(nombre=NOMBRE):
    """Lo que no cambia entre cuadros: cada cara con su zona (manga_l/r, axila, torso, bastilla, puno,
    cuello, cierre, pico), las caras de afuera de manga y torso, los picos y la topología del cuerpo."""
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
        if ESTAMPADO in mats: return "estampado"
        if PICOS in mats: return "pico"
        if CIERRE in mats: return "cierre"
        if CUELLO in mats: return "cuello"
        if PUNO in mats: return "bastilla" if c.z < Z_BASTILLA + 4 else ("puno_l" if c.x > 0 else "puno_r")
        return "tela"
    pieza = [None] * len(caras)
    picos_islas = []
    for ks in islas.values():
        nm = nombre_isla(ks)
        for k in ks:
            pieza[k] = nm
        if nm == "pico":
            picos_islas.append(sorted({i for k in ks for i in caras[k][0]}))
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
    # de cada pico: la base (el anillo de la arandela, h = 0) y lo de arriba (h > 30 % del alto)
    datos_picos = []
    tela_tris = [c for c, m in caras if m == TELA]
    bvh = BVHTree.FromPolygons(co, tela_tris)
    anillos = len(PERFIL_PICO) - 2
    for isla in picos_islas:
        # los vértices de un pico van en el orden en que se hicieron: el centro de la base, el anillo de la
        # base, los demás anillos y la punta
        seg = (len(isla) - 2) // anillos
        base = isla[:1 + seg]
        cen = sum((co[i] for i in base), Vector()) / len(base)
        punta = max(isla, key=lambda i: (co[i] - cen).length)
        eje = (co[punta] - cen); alto = eje.length; eje /= alto
        arriba = [i for i in isla if (co[i] - cen).dot(eje) > 0.3 * alto]
        datos_picos.append(dict(base=base, arriba=arriba, x=cen.x, s=cen.z))
    return dict(o=o, polys=[c for c, _ in caras], mats=[m for _, m in caras], etiqueta=etiqueta, manga=manga,
                torso=torso, v_manga=sorted({i for k in manga for i in caras[k][0]}), x_reposo=[p.x for p in co],
                cuerpo=cuerpo, picos=datos_picos)


def _hondo(puntos, vs, polys, ks):
    """Lo más que se meten los puntos del lado de la tela de las caras ks (y cuántos)."""
    g = BVHTree.FromPolygons(vs, [polys[k] for k in ks])
    h = 0.0; c = 0
    for p in puntos:
        loc, nrm, _, d = g.find_nearest(p, HONDO_MAX)
        if loc is not None and (p - loc).dot(nrm) < 0:
            c += 1; h = max(h, d)
    return h, c


def revisar_cuadro(R):
    """Un cuadro. pen[(pieza del cuerpo, zona de la ropa)] = (cm que se mete, vértices, pares de triángulos
    que se cruzan); manga = lo que la manga se mete en el costado por lado (cm, pares)."""
    dg = bpy.context.evaluated_depsgraph_get()
    vs = _pos(R["o"], dg)
    polys = R["polys"]
    ropa = BVHTree.FromPolygons(vs, polys)
    pen = {}
    for n, pb in R["cuerpo"].items():
        bv = _pos(bpy.data.objects[n], dg)
        if len(bv) != pb["nv"]:
            raise RuntimeError(f"{n}: la malla evaluada cambió de topología")
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


def _poner(accion):
    ad = ARM.animation_data
    act = bpy.data.actions[accion]; ad.action = act
    if len(act.slots):
        ad.action_slot = act.slots[0]
    return [int(round(x)) for x in act.frame_range]


def _quitar(f_ori):
    ARM.animation_data.action = None
    reposo()
    bpy.context.scene.frame_set(f_ori)


def medir(accion, desde=None, hasta=None, R=None):
    """Cada cuadro de una acción (o de desde..hasta): [dict(f, pen, manga)]."""
    R = R or preparar()
    sc = bpy.context.scene
    f_ori = sc.frame_current
    out = []
    try:
        f0, f1 = _poner(accion)
        for f in range(desde or f0, (hasta or f1) + 1):
            sc.frame_set(f)
            pen, manga = revisar_cuadro(R)
            out.append(dict(accion=accion, f=f, pen=_fmt(pen), manga=manga))
    finally:
        _quitar(f_ori)
    return out


def resumir(filas):
    """Por zona: en cuántos cuadros se cruza, lo más hondo y en qué cuadro; y la manga en el costado."""
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
    en el plano del frente del torso, como apartaManos. Se aplica sobre el cuadro ya puesto. grados puede ser
    un número (los dos) o {"l": g, "r": g}."""
    P = ARM.pose.bones
    rs = ARM.data.bones["spine_03.x"].matrix_local.to_3x3()
    frente = (P["spine_03.x"].matrix.to_3x3() @ rs.inverted()) @ Vector((0, -1, 0))
    for lado, s in (("l", 1), ("r", -1)):
        g = grados.get(lado) if isinstance(grados, dict) else grados
        if not g:
            continue
        pb = P["arm_stretch." + lado]
        p = pb.head.copy()
        Rm = Matrix.Rotation(math.radians(g) * s, 4, frente)
        pb.matrix = Matrix.Translation(p) @ Rm @ Matrix.Translation(-p) @ pb.matrix
    bpy.context.view_layer.update()


def _costado(R, vs, costillas=False):
    """Por lado: pares manga-torso y si el brazo cruza el torso, la axila o la bastilla. Con costillas, también
    si el tórax cruza la axila o la manga (la tela de abajo del brazo se va con él y se mete en las costillas)."""
    polys = R["polys"]
    t = BVHTree.FromPolygons(vs, [polys[k] for k in R["torso"]])
    m = BVHTree.FromPolygons(vs, [polys[k] for k in R["manga"]])
    out = {"l": 0, "r": 0}
    for a, _ in m.overlap(t):
        out["l" if R["etiqueta"][R["manga"][a]] == "manga_l" else "r"] += 1
    zona = [k for k, e in enumerate(R["etiqueta"]) if e in ("torso", "axila", "bastilla")]
    bz = BVHTree.FromPolygons(vs, [polys[k] for k in zona])
    dg = bpy.context.evaluated_depsgraph_get()
    for lado, sufijo in (("l", "_L"), ("r", "_R")):
        for n in ("Egg_Arm1" + sufijo, "Egg_Arm2" + sufijo):
            bv = _pos(bpy.data.objects[n], dg)
            out[lado] += len(bz.overlap(BVHTree.FromPolygons(bv, R["cuerpo"][n]["polys"])))
    if costillas:
        ks = [k for k, e in enumerate(R["etiqueta"]) if e in ("axila", "manga_l", "manga_r")]
        ba = BVHTree.FromPolygons(vs, [polys[k] for k in ks])
        bv = _pos(bpy.data.objects["Egg_Torax"], dg)
        for a, _ in ba.overlap(BVHTree.FromPolygons(bv, R["cuerpo"]["Egg_Torax"]["polys"])):
            out["l" if R["x_reposo"][polys[ks[a]][0]] > 0 else "r"] += 1
    return out


def apertura_necesaria(accion, R=None, paso=3, tope=45, desde=None, hasta=None, costillas=False):
    """Por cuadro y lado, cuántos grados hay que abrir el brazo para que ni la manga cruce el costado ni el
    brazo cruce torso, axila o bastilla (None = ni con el tope). Verifica que el signo de giro abra."""
    R = R or preparar()
    sc = bpy.context.scene; P = ARM.pose.bones
    f_ori = sc.frame_current
    out = {}
    try:
        f0, f1 = _poner(accion)
        for f in range(desde or f0, (hasta or f1) + 1):
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
                c = _costado(R, _pos(R["o"], bpy.context.evaluated_depsgraph_get()), costillas)
                for s in ("l", "r"):
                    if falta[s] is None and c[s] == 0:
                        falta[s] = g
                if falta["l"] is not None and falta["r"] is not None:
                    break
            out[f] = falta
    finally:
        _quitar(f_ori)
    return out


def medir_abierto(accion, apertura, R=None):
    """Como medir(), pero con los brazos abiertos lo que pidió apertura_necesaria en cada cuadro (lo que haría
    apartaManos): lo que queda cruzado."""
    R = R or preparar()
    sc = bpy.context.scene
    f_ori = sc.frame_current
    out = []
    try:
        f0, f1 = _poner(accion)
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            g = apertura.get(f) or apertura.get(str(f)) or {}
            _abrir_brazos({k: (v or 0) for k, v in g.items()})
            pen, manga = revisar_cuadro(R)
            out.append(dict(accion=accion, f=f, pen=_fmt(pen), manga=manga))
    finally:
        _quitar(f_ori)
    return out


def forro_asoma(accion, apertura=None, R=None):
    """Por cuadro, con los brazos abiertos como apertura: pares de caras donde el forro cruza la tela de afuera
    (se asoma), y cuántos de ellos van al frente (y < -2 en reposo, lo que más se ve)."""
    R = R or preparar()
    sc = bpy.context.scene
    f_ori = sc.frame_current
    rest = [v.co.copy() for v in R["o"].data.vertices]
    tela = ("torso", "axila", "manga_l", "manga_r")      # sin bastilla ni puños: su cara de adentro abraza la orilla
    kt = [k for k, m in enumerate(R["mats"]) if m == TELA and R["etiqueta"][k] in tela]
    kf = [k for k, m in enumerate(R["mats"]) if m == FORRO and R["etiqueta"][k] in tela]
    out = {}
    try:
        f0, f1 = _poner(accion)
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            if apertura:
                g = apertura.get(f) or apertura.get(str(f)) or {}
                _abrir_brazos({k: (v or 0) for k, v in g.items()})
            vs = _pos(R["o"], bpy.context.evaluated_depsgraph_get())
            t = BVHTree.FromPolygons(vs, [R["polys"][k] for k in kt])
            fo = BVHTree.FromPolygons(vs, [R["polys"][k] for k in kf])
            pares = [(a, b) for a, b in t.overlap(fo) if not (set(R["polys"][kt[a]]) & set(R["polys"][kf[b]]))]
            frente = sum(1 for a, _ in pares if sum(rest[i].y for i in R["polys"][kt[a]]) / 4 < -2)
            out[f] = (len(pares), frente)
    finally:
        _quitar(f_ori)
    return out


def picos_medir(accion=None, R=None, desde=None, hasta=None):
    """Por cuadro, de todos los picos: lo más hondo que entra la base en la tela (cm, negativo = adentro) y lo
    más que se despega (positivo = queda aire bajo la base); y cuántos vértices de lo alto del pico quedan
    dentro de la tela (la tela tragándose el pico). Sin acción, el reposo."""
    R = R or preparar()
    sc = bpy.context.scene
    f_ori = sc.frame_current
    polys = R["polys"]
    tela = [polys[k] for k, m in enumerate(R["mats"]) if m == TELA]
    def uno():
        vs = _pos(R["o"], bpy.context.evaluated_depsgraph_get())
        g = BVHTree.FromPolygons(vs, tela)
        hondo = 0.0; despega = -9.0; tragado = 0
        for pk in R["picos"]:
            ds = []
            for i in pk["base"]:
                loc, nrm, _, d = g.find_nearest(vs[i], 6.0)
                if loc is None:
                    continue
                ds.append((vs[i] - loc).dot(nrm))
            if ds:
                hondo = min(hondo, min(ds)); despega = max(despega, max(ds))
            for i in pk["arriba"]:
                loc, nrm, _, d = g.find_nearest(vs[i], 3.0)
                if loc is not None and (vs[i] - loc).dot(nrm) < 0:
                    tragado += 1
        return dict(hondo=round(hondo, 2), despega=round(despega, 2), tragado=tragado)
    if not accion:
        return uno()
    out = {}
    try:
        f0, f1 = _poner(accion)
        for f in range(desde or f0, (hasta or f1) + 1):
            sc.frame_set(f)
            out[f] = uno()
    finally:
        _quitar(f_ori)
    return out


def holgura_reposo(R=None):
    """En reposo: lo más cerca que queda cada pieza del cuerpo de la cara de adentro de la ropa (cm)."""
    R = R or preparar()
    dg = bpy.context.evaluated_depsgraph_get()
    vs = _pos(R["o"], dg)
    adentro = BVHTree.FromPolygons(vs, [R["polys"][k] for k, m in enumerate(R["mats"]) if m == FORRO])
    out = {}
    for n in CUERPO:
        bv = _pos(bpy.data.objects[n], dg)
        d = min((adentro.find_nearest(p, 30.0)[3] for p in bv if adentro.find_nearest(p, 30.0)[0] is not None), default=None)
        out[n] = round(d, 2) if d is not None else None
    return out


def revisar_reposo(angulos=(0, 20, 35)):
    """En reposo, y con la quijada abierta: cruces y la distancia mínima de la quijada y la cabeza a la ropa."""
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
            cab = min(t.find_nearest(p)[3] for p in _pos(bpy.data.objects["Egg_Head"], dg))
            out[ang] = dict(pen=_fmt(pen), manga=manga, quijada_cm=round(jaw, 2), cabeza_cm=round(cab, 2))
    finally:
        P["ctl_quijada"].rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
    return out


# ===================== renders =====================
VISTAS = {
    "frente": ((0.0, -5.6, 1.15), (0.0, 0.0, 1.08)),
    "tres_cuartos": ((3.4, -4.4, 1.55), (0.0, 0.0, 1.08)),
    "espalda": ((0.0, 5.6, 1.3), (0.0, 0.0, 1.08)),
    "lado": ((5.6, 0.0, 1.15), (0.0, 0.0, 1.08)),
    "cuello": ((1.4, -2.4, 2.0), (0.0, 0.0, 1.2)),
    "manga": ((1.6, -2.6, 1.55), (0.42, 0.0, 1.06)),
}
def otros_props():
    """Las mallas que no son el cuerpo ni esta chamarra: los otros props y los temporales de otras sesiones."""
    return tuple(o.name for o in bpy.data.objects
                 if o.type == 'MESH' and not o.name.startswith("Egg_") and o.name != NOMBRE)


def render(carpeta, vistas=None, accion=None, cuadro=None, res=(1000, 1300), muestras=16, ocultar=None,
           lente=85, sufijo="", abrir=None):
    """Renders con una cámara temporal; deja la escena (cámara, resolución, salida, visibles, acción) como estaba.
    abrir = {"l": g, "r": g}: con acción, abre los brazos así (lo que haría apartaManos en ese cuadro)."""
    ocultar = otros_props() if ocultar is None else ocultar
    sc = bpy.context.scene; r = sc.render
    antes = dict(cam=sc.camera, rx=r.resolution_x, ry=r.resolution_y, pct=r.resolution_percentage, fp=r.filepath,
                 smp=sc.eevee.taa_render_samples, frame=sc.frame_current,
                 ocultos={n: bpy.data.objects[n].hide_render for n in ocultar if n in bpy.data.objects})
    cd = bpy.data.cameras.new("inf_cam"); cd.lens = lente
    cam = bpy.data.objects.new("inf_cam", cd)
    sc.collection.objects.link(cam)
    hechos = []
    try:
        sc.camera = cam
        r.resolution_x, r.resolution_y = res; r.resolution_percentage = 100
        sc.eevee.taa_render_samples = muestras
        for n in antes["ocultos"]:
            bpy.data.objects[n].hide_render = True
        if accion:
            _poner(accion)
            sc.frame_set(cuadro)
            if abrir:
                _abrir_brazos(abrir)
        for nombre in (vistas or VISTAS):
            loc, mira = VISTAS[nombre]
            cam.location = loc
            cam.rotation_euler = (Vector(mira) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
            ruta = os.path.join(carpeta, f"inflada_{nombre}{'_' + accion.split('|')[-1] + str(cuadro) if accion else ''}{sufijo}.png")
            r.filepath = ruta
            bpy.ops.render.render(write_still=True)
            hechos.append(ruta)
    finally:
        if accion:
            ARM.animation_data.action = None
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
