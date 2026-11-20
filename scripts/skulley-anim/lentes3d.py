"""
Arma los lentes 3D de Skulley (prop "Lentes3D") en Character/SkulleyRad.blend.

En Blender (o en segundo plano: blender -b SkulleyRad.blend --python-expr ...):
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
Reemplaza el objeto Lentes3D (colección Collection, hijo del hueso head.x como los Lentes, sin piel: el
sitio los pega a la cabeza igual que a los otros). Los temporales van en Lentes3D_tmp y se llaman l3d_*.

Pedido de Oscar (2026-11-19): "unos lentes 3D, de esos blancos cuadrados con un lente rojo y otro azul".
Los de cartón de anáglifo: armazón blanco plano, mica roja en el ojo izquierdo de Skulley (+x) y azul en el
derecho, patas planas que se doblan en la orilla del armazón.

Todo en las coordenadas del armature (cm, z arriba, -y al frente). Va completo con la cabeza, igual que el
cráneo, los ojos y el beanie, así que lo que libra en reposo libra en cualquier cuadro (medir() lo revisa).

Forma:
- El armazón es un contorno plano (x, z) con dos huecos y la muesca de la nariz, extruido a GROSOR y
  doblado sobre la curva del frente de los Lentes de hoy (y = Y0 + A x^2 + B x^4, ajustada a su barra de
  arriba): así queda a la misma distancia de la cara y debajo del dobladillo del beanie.
- Las micas son placas delgadas en medio del grueso del armazón, un poco más grandes que el hueco (la
  orilla queda escondida adentro), opacas: así no hay transparencias que ordenar ni dibujar dos veces.
- Las patas siguen el camino de las de los Lentes (lo que el beanie ya libra), con su cara de adentro a
  H_CRANEO del cráneo y la de afuera a H_BEANIE del beanie; atrás se curvan con el cráneo.
- La bisagra: detrás de la orilla del armazón, una lengüeta del armazón llega hasta el plano Y_BISAGRA y
  la pata empieza justo detrás. En el sitio (lib/lentesArticulados.js) lo que queda adelante de ese plano
  es el armazón y lo de atrás, las patas, que giran en un eje vertical por la esquina de adentro de la
  pata (doblada, queda detrás del plano y no se mete en el armazón). bisagras() da esas medidas en metros
  y en las coordenadas del GLB (LENTES3D_BISAGRAS).
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon
from mathutils.bvhtree import BVHTree

ARM = bpy.data.objects["root"]
NOMBRE = "Lentes3D"
TMP = "Lentes3D_tmp"
HUESO = "head.x"
PLANTILLA = "Lentes"       # los lentes de hoy: el camino de sus patas y el lugar en la cabeza

# materiales, en este orden
ARMAZON, ROJO, AZUL = range(3)
MATERIALES = (
    ("Lentes3D_Armazon", (0.86, 0.85, 0.82), 0.6),
    ("Lentes3D_Rojo", (0.80, 0.015, 0.03), 0.2),
    ("Lentes3D_Azul", (0.01, 0.22, 0.85), 0.2),
)

# curva del frente (la de la barra de arriba de los Lentes: -29.75 al centro, -26.6 en x = 20)
Y0, A_CURVA, B_CURVA = -29.75, 0.006608, 2.917e-6

GROSOR = 0.8          # del armazón
BISEL = 0.12
# contorno del armazón (x >= 0; el otro lado sale de espejo)
Z_ARRIBA = 154.2      # el dobladillo del beanie empieza en 157.2 al frente; el armazón de los Lentes llega a 154.5
Z_ABAJO = 137.8
X_FUERA = 23.6        # orilla de afuera arriba...
X_FUERA_ABAJO = 22.6  # ...y abajo (los lados se cierran un poco hacia abajo, como los de cartón)
R_ARRIBA = 0.9
R_ABAJO = 3.2
# la muesca de la nariz: de la orilla de abajo sube angostándose y cierra redonda. Chica, como la de los de
# cartón: hasta media mica (145.6 + 2.2) dejaba ver de lado el ojo de enfrente por ella (el armazón queda a 3 cm
# del ojo). La nariz no la necesita: el armazón le pasa a 0.9 cm por delante
NARIZ_ABAJO = 3.9     # medio ancho en la orilla
NARIZ_ARRIBA = 1.7    # medio ancho arriba
NARIZ_Z = 143.2       # donde empieza el redondo de arriba
# el hueco de cada ojo (x > 0): rectángulo con la esquina de abajo de adentro cortada paralela a la muesca
HUECO_DENTRO = 3.6    # medio puente
HUECO_FUERA = 20.8
HUECO_FUERA_ABAJO = 20.2
HUECO_ARRIBA = 151.8
HUECO_ABAJO = 140.4
BORDE_NARIZ = 1.4     # ancho del armazón junto a la muesca
R_HUECO = 1.4
# micas
MICA = 0.3            # grosor
MICA_SOBRA = 0.7      # lo que se meten en el armazón alrededor del hueco
# patas
ANCHO_PATA = 0.9      # grosor en x
RECORTE_Z = 0.25      # más bajas que las de los Lentes, arriba y abajo
PATA_FUERA = 23.3     # cara de afuera junto a la bisagra (tapada de frente por la orilla del armazón: 23.4 a su altura)
PATA_FIN = 9.4        # donde acaba (las de los Lentes llegan a 10, con la punta redonda)
PUNTA = 1.6           # largo del redondeo de la punta
H_CRANEO = 0.3
H_BEANIE = 0.35
HUECO_BISAGRA = 0.03  # media separación entre la lengüeta y la pata (el plano queda en medio)

SEG = 6               # segmentos por esquina redonda
PASO_X = 0.75         # cortes del armazón en x, para que siga la curva


# ---------------------------------------------------------------- utilidades
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


def curva(x):
    return Y0 + A_CURVA * x * x + B_CURVA * x ** 4


def pendiente(x):
    return 2 * A_CURVA * x + 4 * B_CURVA * x ** 3


def doblar(x, d, z):
    """Del plano del armazón (x, z, d: profundidad, +GROSOR/2 al frente) a la curva: d va por la normal."""
    s = pendiente(x)
    n = math.hypot(s, 1.0)
    nx, ny = s / n, -1.0 / n            # normal hacia el frente
    atras = GROSOR / 2 - d
    return Vector((x - nx * atras, curva(x) - ny * atras, z))


def redondear(poly, radios):
    """Polígono (lista de Vector 2D) con sus esquinas redondeadas; radios: uno por vértice."""
    out = []
    n = len(poly)
    for i in range(n):
        p0, p1, p2 = poly[i - 1], poly[i], poly[(i + 1) % n]
        r = radios[i]
        d1 = (p0 - p1).normalized()
        d2 = (p2 - p1).normalized()
        ang = math.acos(max(-1.0, min(1.0, d1.dot(d2))))
        if r <= 0 or ang > math.pi - 1e-3:
            out.append(p1.copy())
            continue
        t = min(r / math.tan(ang / 2), (p0 - p1).length * 0.49, (p2 - p1).length * 0.49)
        re = t * math.tan(ang / 2)
        a = p1 + d1 * t
        b = p1 + d2 * t
        c = p1 + (d1 + d2).normalized() * (re / math.sin(ang / 2))
        ta = math.atan2(a.y - c.y, a.x - c.x)
        tb = math.atan2(b.y - c.y, b.x - c.x)
        dif = tb - ta
        while dif > math.pi:
            dif -= 2 * math.pi
        while dif < -math.pi:
            dif += 2 * math.pi
        for k in range(SEG + 1):
            th = ta + dif * k / SEG
            out.append(Vector((c.x + math.cos(th) * re, c.y + math.sin(th) * re)))
    return out


def densificar(poly, paso=0.8):
    out = []
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        n = max(1, int(math.ceil((b - a).length / paso)))
        for k in range(n):
            out.append(a.lerp(b, k / n))
    return out


def sin_repetidos(poly, eps=1e-4):
    out = []
    for p in poly:
        if not out or (p - out[-1]).length > eps:
            out.append(p)
    if len(out) > 2 and (out[0] - out[-1]).length <= eps:
        out.pop()
    return out


def area(poly):
    return 0.5 * sum(poly[i - 1].x * poly[i].y - poly[i].x * poly[i - 1].y for i in range(len(poly)))


def ccw(poly):
    return poly if area(poly) > 0 else list(reversed(poly))


def desplazar(poly, delta):
    """Polígono convexo (en sentido antihorario) con cada lado corrido delta hacia afuera."""
    n = len(poly)
    lineas = []
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        t = (b - a).normalized()
        nrm = Vector((t.y, -t.x))          # afuera, en sentido antihorario
        lineas.append((a + nrm * delta, t))
    out = []
    for i in range(n):
        (p, u), (q, v) = lineas[i - 1], lineas[i]
        den = u.x * v.y - u.y * v.x
        s = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / den
        out.append(p + u * s)
    return out


# ---------------------------------------------------------------- contornos
def contorno_armazon():
    """El contorno de afuera, con la muesca de la nariz, en sentido antihorario."""
    lado = [
        (Vector((NARIZ_ABAJO, Z_ABAJO)), 0.6),
        (Vector((X_FUERA_ABAJO, Z_ABAJO)), R_ABAJO),
        (Vector((X_FUERA, Z_ARRIBA)), R_ARRIBA),
    ]
    der = [(Vector((-p.x, p.y)), r) for p, r in reversed(lado)]
    nariz_d = Vector((NARIZ_ARRIBA, NARIZ_Z))
    poly = [p for p, _ in lado] + [p for p, _ in der]
    rad = [r for _, r in lado] + [r for _, r in der]
    # la muesca: de la orilla izquierda de la nariz (x < 0) sube y baja a la derecha
    poly += [Vector((-NARIZ_ARRIBA, NARIZ_Z))]
    rad += [0.0]
    # el redondo de arriba de la muesca (medio círculo de NARIZ_ARRIBA)
    arco = [Vector((-NARIZ_ARRIBA * math.cos(math.pi * k / 10), NARIZ_Z + NARIZ_ARRIBA * math.sin(math.pi * k / 10))) for k in range(1, 10)]
    poly += arco
    rad += [0.0] * len(arco)
    poly += [nariz_d]
    rad += [0.0]
    # orden: (NARIZ_ABAJO, abajo) → afuera abajo → afuera arriba → arriba izquierda... va en sentido antihorario
    # visto con x a la derecha y z arriba
    return ccw(redondear(poly, rad))


def hueco_base(signo=1):
    """El hueco de un ojo sin redondear (convexo, antihorario), del lado de signo x."""
    # la línea de la muesca, corrida BORDE_NARIZ hacia el hueco
    a = Vector((NARIZ_ABAJO, Z_ABAJO))
    b = Vector((NARIZ_ARRIBA, NARIZ_Z))
    t = (b - a).normalized()
    nrm = Vector((t.y, -t.x))
    if nrm.x < 0:
        nrm = -nrm
    p = a + nrm * BORDE_NARIZ

    def en_linea_z(z):
        s = (z - p.y) / t.y
        return p + t * s

    def en_linea_x(x):
        s = (x - p.x) / t.x
        return p + t * s

    c_abajo = en_linea_z(HUECO_ABAJO)
    c_arriba = en_linea_x(HUECO_DENTRO)
    pts = [
        Vector((HUECO_DENTRO, HUECO_ARRIBA)),
        c_arriba,
        c_abajo,
        Vector((HUECO_FUERA_ABAJO, HUECO_ABAJO)),
        Vector((HUECO_FUERA, HUECO_ARRIBA)),
    ]
    pts = ccw(pts)
    if signo < 0:
        pts = ccw([Vector((-q.x, q.y)) for q in pts])
    return pts


def hueco(signo=1, sobra=0.0):
    base = hueco_base(signo)
    if sobra:
        base = desplazar(base, sobra)
    return ccw(redondear(base, [R_HUECO + sobra] * len(base)))


# ---------------------------------------------------------------- sólidos
def solido_plano(bm, loops, d0, d1, mat):
    """Extruye una región plana (el primer loop es el de afuera, los demás huecos) de d0 a d1 en el plano
    del armazón. Los vértices quedan con co = (x, d, z) hasta doblar()."""
    loops = [sin_repetidos(densificar(l)) for l in loops]
    planos = [p for l in loops for p in l]
    frente = [bm.verts.new((p.x, d1, p.y)) for p in planos]
    atras = [bm.verts.new((p.x, d0, p.y)) for p in planos]
    # la tapa de enfrente con triangle_fill (respeta los huecos; tessellate_polygon los tapaba) y la de atrás
    # con los mismos triángulos al revés
    orillas = []
    base = 0
    for l in loops:
        n = len(l)
        orillas += [bm.edges.new((frente[base + i], frente[base + (i + 1) % n])) for i in range(n)]
        base += n
    r = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=orillas, normal=(0.0, 1.0, 0.0))
    idx = {v: i for i, v in enumerate(frente)}
    caras = [g for g in r["geom"] if isinstance(g, bmesh.types.BMFace)]
    for f in list(caras):
        caras.append(bm.faces.new([atras[idx[v]] for v in reversed(f.verts)]))
    base = 0
    paredes = []
    for l in loops:
        n = len(l)
        for i in range(n):
            j = (i + 1) % n
            paredes.append(bm.faces.new((frente[base + i], atras[base + i], atras[base + j], frente[base + j])))
        base += n
    for f in caras + paredes:
        f.material_index = mat
    bmesh.ops.recalc_face_normals(bm, faces=caras + paredes)
    tapas = set(caras)
    aristas = set()
    for f in paredes:
        for e in f.edges:
            if any(g in tapas for g in e.link_faces):
                aristas.add(e)
    return caras + paredes, list(aristas)


def caja(bm, secciones, mat):
    """Sólido barrido: lista de secciones (4 Vector cada una, en el mismo orden), con tapas en los extremos."""
    filas = [[bm.verts.new(p) for p in s] for s in secciones]
    caras = []
    for f0, f1 in zip(filas, filas[1:]):
        for k in range(4):
            caras.append(bm.faces.new((f0[k], f0[(k + 1) % 4], f1[(k + 1) % 4], f1[k])))
    caras.append(bm.faces.new(filas[0]))
    caras.append(bm.faces.new(list(reversed(filas[-1]))))
    for f in caras:
        f.material_index = mat
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    return caras


def biselar(bm, aristas, ancho=BISEL):
    if aristas:
        bmesh.ops.bevel(bm, geom=aristas, offset=ancho, offset_type='OFFSET', segments=1, profile=0.5,
                        affect='EDGES', clamp_overlap=True)


# ---------------------------------------------------------------- medidas de la cabeza
def malla_arm(o, dg, inv):
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.transform(inv @ o.matrix_world)
    bm.normal_update()
    oe.to_mesh_clear()
    return bm


class Cabeza:
    """El cráneo, los ojos y la quijada (y el beanie, si está) en las coordenadas del armature, en reposo."""

    def __init__(self):
        ARM.data.pose_position = 'REST'
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        inv = ARM.matrix_world.inverted()
        self.bms = {}
        for n in ("Egg_Head", "Egg_Eye_L", "Egg_Eye_R", "Egg_Jaw"):
            self.bms[n] = malla_arm(bpy.data.objects[n], dg, inv)
        self.cuerpo = {n: BVHTree.FromBMesh(b) for n, b in self.bms.items()}
        b = bpy.data.objects.get("Beanie")
        self.bm_beanie = malla_arm(b, dg, inv) if b else None
        self.beanie = BVHTree.FromBMesh(self.bm_beanie) if b else None
        self.plantilla = malla_arm(bpy.data.objects[PLANTILLA], dg, inv)

    def craneo_x(self, y, z):
        """Lo más afuera (+x) del cráneo y los ojos en (y, z)."""
        mejor = None
        for t in self.cuerpo.values():
            h = t.ray_cast(Vector((80.0, y, z)), Vector((-1.0, 0.0, 0.0)), 200.0)
            if h[0] is not None and (mejor is None or h[0].x > mejor):
                mejor = h[0].x
        return mejor

    def beanie_x(self, y, z):
        """La cara de adentro del beanie, desde el centro hacia +x, en (y, z)."""
        if not self.beanie:
            return None
        h = self.beanie.ray_cast(Vector((0.0, y, z)), Vector((1.0, 0.0, 0.0)), 100.0)
        return h[0].x if h[0] is not None else None

    def pata_plantilla(self):
        """Por cada cm de y (de -23 a 10): x de adentro y z de abajo y de arriba de la pata izquierda de los Lentes."""
        out = {}
        for v in self.plantilla.verts:
            p = v.co
            if p.x < 15 or p.y < -23.5:
                continue
            k = int(round(p.y))
            a = out.get(k)
            if a is None:
                out[k] = [p.x, p.z, p.z]
            else:
                a[0] = min(a[0], p.x); a[1] = min(a[1], p.z); a[2] = max(a[2], p.z)
        return dict(sorted(out.items()))


def interp(tabla, y):
    ks = list(tabla.keys())
    if y <= ks[0]:
        return tabla[ks[0]]
    if y >= ks[-1]:
        return tabla[ks[-1]]
    for a, b in zip(ks, ks[1:]):
        if a <= y <= b:
            t = (y - a) / (b - a)
            return [u + (w - u) * t for u, w in zip(tabla[a], tabla[b])]


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- armado
def armar_armazon(bm):
    """Armazón y micas en el plano (x, d, z); regresa las caras de cada cosa."""
    afuera = contorno_armazon()
    caras, aristas = solido_plano(bm, [afuera, hueco(1), hueco(-1)], -GROSOR / 2, GROSOR / 2, ARMAZON)
    biselar(bm, aristas)
    rojas, _ = solido_plano(bm, [hueco(1, MICA_SOBRA)], -MICA / 2, MICA / 2, ROJO)
    azules, _ = solido_plano(bm, [hueco(-1, MICA_SOBRA)], -MICA / 2, MICA / 2, AZUL)
    # cortes en x para que las caras sigan la curva al doblar
    k = -X_FUERA - 1
    while k <= X_FUERA + 1:
        g = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=g, plane_co=(k, 0, 0), plane_no=(1, 0, 0))
        k += PASO_X
    for v in bm.verts:
        v.co = doblar(v.co.x, v.co.y, v.co.z)


def armar_patas(bm, cab, y_bisagra):
    """Lengüetas (del armazón, hasta antes del plano de la bisagra) y patas (desde después). Regresa los datos
    de cada pata para bisagras()."""
    tabla = cab.pata_plantilla()
    y_ini = y_bisagra + HUECO_BISAGRA
    z_fr = interp(tabla, -23.0)
    z0_fr, z1_fr = z_fr[1] + RECORTE_Z, z_fr[2] - RECORTE_Z
    x_in_fr = PATA_FUERA - ANCHO_PATA
    # estaciones de la pata: cada cm, más juntas en la punta
    ys = []
    y = y_ini
    while y < PATA_FIN - PUNTA:
        ys.append(y)
        y += 1.0
    for k in range(9):
        ys.append(PATA_FIN - PUNTA + PUNTA * math.sin(0.5 * math.pi * k / 8))
    filas = []
    for y in ys:
        x_tab, z0, z1 = interp(tabla, y)
        z0 += RECORTE_Z
        z1 -= RECORTE_Z
        # adelante, de la bisagra (x_in_fr) a la pata de los Lentes (más pegada atrás)
        delta = (x_in_fr - interp(tabla, -23.0)[0]) * (1 - smoothstep(-23.0, -8.0, y))
        x_in = x_tab + delta
        zs = [z0 + (z1 - z0) * i / 5 for i in range(6)]
        piso = max((cab.craneo_x(y, z) or -1e9) for z in zs) + H_CRANEO
        techo_b = [cab.beanie_x(y, z) for z in [z0 - 0.3] + zs + [z1 + 0.6]]
        techo_b = [b for b in techo_b if b is not None]
        techo = (min(techo_b) - H_BEANIE - ANCHO_PATA) if techo_b else 1e9
        filas.append([y, x_in, z0, z1, piso, techo])
    # suaviza x_in y luego respeta cráneo y beanie
    for _ in range(3):
        xs = [f[1] for f in filas]
        for i in range(1, len(filas) - 1):
            filas[i][1] = (xs[i - 1] + 2 * xs[i] + xs[i + 1]) / 4
    for f in filas:
        f[1] = min(max(f[1], f[4]), max(f[5], f[4]))
    # la punta redonda: el alto se cierra en un cuarto de círculo
    secciones = []
    for f in filas:
        y, x_in, z0, z1 = f[0], f[1], f[2], f[3]
        if y > PATA_FIN - PUNTA:
            u = (y - (PATA_FIN - PUNTA)) / PUNTA
            h = max(0.22, math.sqrt(max(0.0, 1 - u * u)))
            zc, hz = (z0 + z1) / 2, (z1 - z0) / 2 * h
            z0, z1 = zc - hz, zc + hz
        secciones.append((y, x_in, z0, z1))
    datos = dict(x_in=x_in_fr, z0=z0_fr, z1=z1_fr, y=y_ini, secciones=secciones,
                 piso_min=min(f[1] - f[4] for f in filas), techo_min=min(f[5] - f[1] for f in filas))
    for signo in (1, -1):
        def P(x, y, z):
            return Vector((signo * x, y, z))
        # la lengüeta: desde adentro del armazón (su cara de enfrente sigue la curva) hasta antes del plano
        ya, yb = curva(x_in_fr) + GROSOR * 0.45, curva(PATA_FUERA) + GROSOR * 0.45
        y1 = y_bisagra - HUECO_BISAGRA
        sec_l = [[P(x_in_fr, ya, z0_fr), P(PATA_FUERA, yb, z0_fr), P(PATA_FUERA, yb, z1_fr), P(x_in_fr, ya, z1_fr)],
                 [P(x_in_fr, y1, z0_fr), P(PATA_FUERA, y1, z0_fr), P(PATA_FUERA, y1, z1_fr), P(x_in_fr, y1, z1_fr)]]
        caras = caja(bm, sec_l if signo > 0 else [list(reversed(s)) for s in sec_l], ARMAZON)
        biselar(bm, list({e for f in caras for e in f.edges}), 0.08)
        sec_p = [[P(x, y, z0), P(x + ANCHO_PATA, y, z0), P(x + ANCHO_PATA, y, z1), P(x, y, z1)] for y, x, z0, z1 in secciones]
        caras = caja(bm, sec_p if signo > 0 else [list(reversed(s)) for s in sec_p], ARMAZON)
        biselar(bm, list({e for f in caras for e in f.edges if e.calc_face_angle(0) > 0.6}), BISEL)
    return datos


def materiales(o):
    # materials.clear() regresa todas las caras al material 0: se guardan y se reponen
    idx = [0] * len(o.data.polygons)
    o.data.polygons.foreach_get("material_index", idx)
    o.data.materials.clear()
    for nombre, color, rough in MATERIALES:
        m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = 0.0
        m.diffuse_color = (*color, 1); m.roughness = rough; m.metallic = 0.0
        o.data.materials.append(m)
    o.data.polygons.foreach_set("material_index", idx)
    o.data.update()


def montar(me):
    """El objeto Lentes3D colgado del hueso de la cabeza, en el mismo lugar que los Lentes."""
    borrar(NOMBRE)
    plantilla = bpy.data.objects[PLANTILLA]
    ARM.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    # la malla viene en el espacio del armature; los Lentes guardan sus vértices en su propio espacio
    a_local = plantilla.matrix_world.inverted() @ ARM.matrix_world
    me.transform(a_local)
    o = bpy.data.objects.new(NOMBRE, me)
    plantilla.users_collection[0].objects.link(o)
    o.parent = ARM
    o.parent_type = 'BONE'
    o.parent_bone = HUESO
    o.matrix_parent_inverse = plantilla.matrix_parent_inverse.copy()
    o.matrix_basis = plantilla.matrix_basis.copy()
    return o


def armar():
    cab = Cabeza()
    bm = bmesh.new()
    armar_armazon(bm)
    # el plano de la bisagra: justo detrás de lo más atrás del armazón
    y_max = max(v.co.y for v in bm.verts)
    y_bisagra = y_max + 2 * HUECO_BISAGRA
    datos = armar_patas(bm, cab, y_bisagra)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    # doblar() voltea la profundidad (al frente es -y), así que el armazón y las micas quedaban con las
    # normales hacia adentro: cada pieza es cerrada y aquí se orientan hacia afuera
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(NOMBRE)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    try:
        # un chaflán de 45°: duro, como las bandas del toon; la curva del frente (1.5° entre cortes) queda suave
        me.set_sharp_from_angle(angle=math.radians(30))
    except Exception:
        pass
    return me, cab, y_bisagra, datos


def bisagras(y_bisagra, datos):
    """Las medidas de la bisagra para lentesArticulados.js (metros, coordenadas del GLB: x, z → y, -y → z)."""
    esc = ARM.matrix_world.to_scale().x
    return dict(bisagraZ=round(-y_bisagra * esc, 4), bisagraX=round(datos["x_in"] * esc, 4),
                bisagraY=[round(datos["z0"] * esc, 4), round(datos["z1"] * esc, 4)])


# ---------------------------------------------------------------- medición
def medir(o=None, cab=None):
    """Holguras en reposo contra el cráneo, los ojos, la quijada y el beanie (cm), y que el plano de la
    bisagra separe limpio el armazón de las patas."""
    o = o or bpy.data.objects[NOMBRE]
    cab = cab or Cabeza()
    dg = bpy.context.evaluated_depsgraph_get()
    bm = malla_arm(o, dg, ARM.matrix_world.inverted())
    lentes = BVHTree.FromBMesh(bm)
    out = {}

    def peor(arbol, puntos):
        mn, dentro = 1e9, 0
        for p in puntos:
            h = arbol.find_nearest(p, 50.0)
            if h[0] is None:
                continue
            mn = min(mn, h[3])
            if (p - h[0]).dot(h[1]) < 0:
                dentro += 1
        return round(mn, 3), dentro

    pts = [v.co.copy() for v in bm.verts]
    for n, t in cab.cuerpo.items():
        out[n] = peor(t, pts)
        out[n + "_al_reves"] = peor(lentes, [v.co for v in cab.bms[n].verts if v.co.z > 130 and v.co.y < 15])
    if cab.beanie:
        out["Beanie"] = peor(cab.beanie, pts)
        out["Beanie_al_reves"] = peor(lentes, [v.co for v in cab.bm_beanie.verts if v.co.z < 160])
    bm.free()
    return out


def particion(me_arm, y_bisagra):
    """Lo más atrás del armazón y lo más adelante de las patas, contra el plano (cm)."""
    frente = [v.co.y for v in me_arm.vertices if v.co.y < y_bisagra]
    atras = [v.co.y for v in me_arm.vertices if v.co.y >= y_bisagra]
    return dict(armazon_max=round(max(frente), 3), patas_min=round(min(atras), 3), plano=round(y_bisagra, 3))


def todo():
    pose_antes = ARM.data.pose_position
    col_tmp()
    me, cab, y_bisagra, datos = armar()
    part = particion(me, y_bisagra)
    o = montar(me)
    materiales(o)
    c = bpy.data.collections.get(TMP)
    if c and not c.objects:
        bpy.data.collections.remove(c)
    out = dict(verts=len(o.data.vertices), caras=len(o.data.polygons), particion=part,
               bisagras=bisagras(y_bisagra, datos), pata_holgura_craneo=round(datos["piso_min"], 3),
               pata_holgura_beanie=round(datos["techo_min"], 3), medir=medir(o, cab))
    ARM.data.pose_position = pose_antes
    return out
