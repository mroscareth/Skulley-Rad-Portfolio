"""
Arma el beanie largo de tejido de Skulley (prop "Beanie") en Character/SkulleyRad.blend.

En Blender (o en segundo plano: blender -b SkulleyRad.blend --python-expr ...):
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
Reemplaza el objeto Beanie (colección Collection, hijo de root con un modificador Armature). Los
temporales van en la colección Beanie_tmp y se llaman bn_*.

Todo en las coordenadas del armature (cm, z arriba, -y al frente). Va completo con la cabeza (head.x),
igual que el cráneo y los lentes: lo que libra en reposo libra en cualquier cuadro de cualquier animación
(revisar_beanie.py lo mide igual, cuadro por cuadro).

Forma: un campo de distancia. El cráneo (la malla Head de Egg_Head) con una holgura, más un volumen de
cápsulas que hace la copa aguada que cae hacia atrás, unidos con una unión suave. La copa se recorre con
rayos desde un centro dentro de la cabeza (en cada rayo, el último cruce: la superficie es una sola capa,
sin pliegues que se crucen), con el polo en la punta de lo que cae: ahí se juntan las costillas del tejido,
como en un gorro de verdad. Abajo la corta un plano inclinado (más alto al frente, arriba de los lentes;
más bajo atrás). El dobladillo enrollado es un anillo grueso aparte, de sección redondeada, que sigue el
cráneo con su propia holgura; en los costados pasa por encima de las patas de los lentes (la holgura crece
ahí, suavizada, para no hacer chipotes). La copa empieza adentro del dobladillo.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ARM = bpy.data.objects["root"]
NOMBRE = "Beanie"
TMP = "Beanie_tmp"
HUESO = "head.x"

# materiales, en este orden
TEJIDO, DOBLADILLO, ETIQUETA = range(3)

# orilla de abajo del dobladillo: un plano inclinado (en x = 0, al frente y atrás)
BORDE_FRENTE = Vector((0.0, -27.0, 157.2))   # el armazón de los lentes llega a z 154.5
BORDE_ATRAS = Vector((0.0, 24.0, 146.0))
# atrás la orilla baja más que el plano, como un gorro jalado hacia la nuca (Oscar, 2026-11-18: "que cubra más
# abajo en la parte trasera del cráneo"): a lo largo del eje, BAJA_ATRAS en la nuca y nada desde BAJA_ANCHO
# grados a cada lado (campana de coseno), así los costados y las patas de los lentes quedan igual. Inclinar todo
# el plano también bajaba los costados
BAJA_ATRAS = 7.0
BAJA_ANCHO = 80.0
H_CRANEO = 0.5         # holgura del cráneo a la cara de adentro
H_LENTES = 0.6          # holgura de las patas de los lentes a la cara de adentro del dobladillo
TELA = 0.9              # grosor de la copa (su cara de afuera queda a holgura + TELA del cráneo)
SUELTO = 1.4            # cuánto se afloja la copa arriba del dobladillo
ALTO_D = 7.5            # alto del dobladillo, a lo largo del eje del plano
GRUESO_D = 2.9          # grosor del dobladillo
RADIO_D = 1.35          # redondeo de sus orillas
A_COPA = 2.6            # la copa empieza a esta altura sobre el borde (adentro del dobladillo)

# lo aguado que cae atrás: cadena de cápsulas (y, z, radio) en x = 0
# (sube por la coronilla, se va atrás y cuelga pegado a la nuca hasta apoyarse en el dobladillo; más abajo,
# la orilla de la copa quedaba afuera del dobladillo y se veía el hueco). El cuarto número es lo ancho (x)
CAIDA = [(2.0, 162.0, 16.0, 1.35), (8.0, 172.0, 14.0, 1.45), (17.0, 176.0, 12.5, 1.45), (24.0, 172.0, 11.0, 1.4),
         (27.0, 164.0, 9.5, 1.3)]
K_CAIDA = 5.0           # unión suave entre cápsulas (sin, se notaban los escalones)
K_UNION = 7.0           # unión suave entre el cráneo y la caída
CENTRO_COPA = Vector((0.0, 4.0, 158.0))     # de aquí salen los rayos de la copa
# polo de la copa (donde se juntan las costillas): arriba y atrás. Apuntando a la punta de lo que cae
# (abajo y atrás) la orilla de enfrente ya no subía pareja desde el polo y la copa dejaba un hueco
EJE_POLO = Vector((0.0, 0.75, 0.66)).normalized()

# la etiqueta tejida: al frente, del lado izquierdo de Skulley (+x), como en la referencia; la imagen la hace
# etiqueta_beanie.mjs (SKULLEYRAD en SKULLEYGLYPH, Oscar) en Character/assets/beanie_etiqueta.png
ETIQUETA_TH = 146.0     # grados en el plano del borde: 0 atrás, 90 a la izquierda de Skulley, 180 al frente
ANCHO_ET = 12.6         # misma proporción que la imagen (1120 x 400)
ALTO_ET = 4.5
SOBRE_ET = 0.12         # despegada de la cara de afuera del dobladillo
ET_IMAGEN = "beanie_etiqueta.png"

N_U = 128               # columnas alrededor (copa y dobladillo)
N_V = 60                # filas de la copa, del borde al polo
N_P = 28                # puntos de la sección del dobladillo

NEGRO = (0.012, 0.012, 0.014)
# el tejido: costillas verticales en una textura empacada (Beanie_Tejido_tex), en sRGB
COSTILLAS = 60                  # alrededor (la cabeza mide ~165 cm de contorno en el dobladillo)
# negro (Oscar). Con menos contraste (48 contra 20) el toon y la trama de puntos del sitio las borraban
LOMO = (80, 80, 87)             # lo alto de cada costilla
SURCO = (22, 22, 26)            # el surco entre costillas
TEX_W, TEX_H = 1024, 256


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


def smin(a, b, k):
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


class Campo:
    """El cráneo, los lentes y la caída, en reposo y en las coordenadas del armature."""

    def __init__(self, caida=True):
        self.caida = caida
        arm = ARM
        antes = arm.data.pose_position
        arm.data.pose_position = "REST"
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        inv = arm.matrix_world.inverted()

        def malla(nombre, material=None):
            o = bpy.data.objects[nombre]
            oe = o.evaluated_get(dg)
            me = oe.to_mesh()
            m = inv @ o.matrix_world
            vs = [m @ v.co for v in me.vertices]
            caras = [tuple(p.vertices) for p in me.polygons if material is None or p.material_index == material]
            oe.to_mesh_clear()
            return vs, caras

        vs, caras = malla("Egg_Head", 0)
        usados = sorted({i for c in caras for i in c})
        mapa = {v: k for k, v in enumerate(usados)}
        self.craneo_vs = [vs[i] for i in usados]
        self.craneo = BVHTree.FromPolygons(self.craneo_vs, [tuple(mapa[i] for i in c) for c in caras])
        lv, lc = malla("Lentes")
        self.lentes = BVHTree.FromPolygons(lv, lc)
        arm.data.pose_position = antes
        bpy.context.view_layer.update()

        # plano del borde y su eje
        t = (BORDE_ATRAS - BORDE_FRENTE).normalized()
        self.n0 = Vector((0.0, -t.z, t.y)).normalized()
        if self.n0.z < 0:
            self.n0 = -self.n0
        self.atras = t                       # en el plano, hacia atrás (costura del tejido)
        self.izq = Vector((1.0, 0.0, 0.0))   # +x: el lado izquierdo de Skulley
        self.c0 = (BORDE_FRENTE + BORDE_ATRAS) * 0.5
        # el centro del corte del cráneo en el plano
        for _ in range(3):
            pts = [self.rayo_plano(math.radians(a), 0.0, 0.0, holgura=False, baja=False) for a in range(0, 360, 10)]
            c = sum(pts, Vector()) / len(pts)
            self.c0 = c - self.n0 * (c - self.c0).dot(self.n0)
        self.extra = [0.0] * 360
        self.extra = self.holgura_lentes()

    # distancias
    def sd(self, p):
        loc, nrm, _, d = self.craneo.find_nearest(p)
        return d if (p - loc).dot(nrm) >= 0 else -d

    def baja(self, th):
        """Lo que la orilla baja de más en el ángulo th (0 atrás)."""
        g = abs(math.degrees(math.atan2(math.sin(th), math.cos(th))))
        if g >= BAJA_ANCHO:
            return 0.0
        return BAJA_ATRAS * 0.5 * (1.0 + math.cos(math.pi * g / BAJA_ANCHO))

    def alto(self, p):
        """Altura sobre la orilla de abajo del dobladillo (con lo que baja atrás)."""
        return (p - self.c0).dot(self.n0) + self.baja(self.theta(p))

    def theta(self, p):
        q = p - self.c0
        return math.atan2(q.dot(self.izq), q.dot(self.atras))

    def dir_plano(self, th):
        return self.atras * math.cos(th) + self.izq * math.sin(th)

    def holgura(self, th, a):
        i = int(round(math.degrees(th))) % 360
        return H_CRANEO + self.extra[i] * (1.0 - smoothstep(ALTO_D, ALTO_D + 4.0, a))

    def caida_sd(self, p):
        d = None
        for (y0, z0, r0, w0), (y1, z1, r1, w1) in zip(CAIDA, CAIDA[1:]):
            a = Vector((0.0, y0, z0)); b = Vector((0.0, y1, z1))
            ab = b - a
            t = min(max((Vector((0.0, p.y, p.z)) - a).dot(ab) / ab.length_squared, 0.0), 1.0)
            # las cápsulas son más anchas que altas: de frente la copa sale redonda, no en cono
            q = a + ab * t
            ancho = w0 + (w1 - w0) * t
            di = Vector((p.x / ancho, p.y - q.y, p.z - q.z)).length - (r0 + (r1 - r0) * t)
            d = di if d is None else smin(d, di, K_CAIDA)
        return d

    def copa(self, p):
        """< 0 adentro de la copa."""
        a = self.alto(p)
        f = self.sd(p) - self.holgura(self.theta(p), a) - TELA - SUELTO * smoothstep(ALTO_D - 1.0, ALTO_D + 7.0, a)
        if not self.caida:
            return f
        return smin(f, self.caida_sd(p), K_UNION)

    # rayos
    def rayo_plano(self, th, a, b, holgura=True, baja=True):
        """Punto del rayo en el plano (a sobre el borde, ángulo th) donde la distancia al cráneo menos la
        holgura vale b (el primer cruce desde adentro)."""
        o = self.c0 + self.n0 * (a - (self.baja(th) if baja else 0.0))
        w = self.dir_plano(th)
        h = self.holgura(th, a) if holgura else 0.0
        f = lambda s: self.sd(o + w * s) - h - b
        s0, s1 = 6.0, 7.0
        while f(s1) < 0 and s1 < 80:
            s0, s1 = s1, s1 + 1.0
        for _ in range(16):
            m = (s0 + s1) * 0.5
            if f(m) < 0:
                s0 = m
            else:
                s1 = m
        return o + w * ((s0 + s1) * 0.5)

    def holgura_lentes(self):
        """Holgura extra del dobladillo por ángulo: lo que se salen las patas de los lentes del cráneo, más
        su holgura, en la altura del dobladillo. Dilatada y suavizada para no hacer chipotes."""
        crudo = [0.0] * 360
        for g in range(360):
            th = math.radians(g)
            w = self.dir_plano(th)
            for k in range(7):
                a = -0.5 + k * (ALTO_D + 1.0) / 6
                o = self.c0 + self.n0 * (a - self.baja(th))
                lejos = o + w * 70.0
                hit = self.lentes.ray_cast(lejos, -w, 70.0)
                if hit[0] is None:
                    continue
                s_len = 70.0 - hit[3]
                s_cr = (self.rayo_plano(th, a, 0.0, holgura=False) - o).length
                crudo[g] = max(crudo[g], s_len + H_LENTES - s_cr - H_CRANEO)
        dil = [max(crudo[(g + d) % 360] for d in range(-10, 11)) for g in range(360)]
        sig = 9.0
        ker = [math.exp(-0.5 * (d / sig) ** 2) for d in range(-27, 28)]
        sk = sum(ker)
        return [sum(dil[(g + d) % 360] * ker[d + 27] for d in range(-27, 28)) / sk for g in range(360)]


# ---------------------------------------------------------------- la copa

def eje_polo():
    return EJE_POLO


def base_polo(ax):
    x = Vector((1.0, 0.0, 0.0))
    e1 = (x - ax * x.dot(ax)).normalized()     # +x
    e2 = ax.cross(e1).normalized()
    return e1, e2


def radio_copa(campo, d, s_max=75.0, paso=1.25):
    """Distancia desde el centro de la copa a su superficie en la dirección d (el último cruce)."""
    c = CENTRO_COPA
    ult = None
    prev = campo.copa(c + d * 2.0) < 0
    s = 2.0
    while s < s_max:
        s2 = s + paso
        dentro = campo.copa(c + d * s2) < 0
        if prev and not dentro:
            ult = (s, s2)
        prev = dentro
        s = s2
    if ult is None:
        return None
    s0, s1 = ult
    for _ in range(14):
        m = (s0 + s1) * 0.5
        if campo.copa(c + d * m) < 0:
            s0 = m
        else:
            s1 = m
    return (s0 + s1) * 0.5


def dir_esf(ax, e1, e2, th, ph):
    return (ax * math.cos(ph) + (e1 * math.cos(th) + e2 * math.sin(th)) * math.sin(ph)).normalized()


def copa(campo):
    ax = eje_polo()
    e1, e2 = base_polo(ax)
    # costura atrás: th = 0 hacia +y del plano del polo
    off = math.atan2(Vector((0.0, 1.0, 0.0)).dot(e2), Vector((0.0, 1.0, 0.0)).dot(e1))
    # para cada columna, el ángulo desde el polo donde la copa cruza el plano del borde + A_COPA
    phis = []
    for i in range(N_U):
        th = off + 2 * math.pi * i / N_U
        lo, hi = math.radians(15), math.radians(178)
        for _ in range(16):
            m = (lo + hi) * 0.5
            d = dir_esf(ax, e1, e2, th, m)
            r = radio_copa(campo, d)
            if r is not None and campo.alto(CENTRO_COPA + d * r) > A_COPA:
                lo = m
            else:
                hi = m
        phis.append((lo + hi) * 0.5)
    filas = []
    for j in range(N_V):
        v = j / (N_V - 1)
        fila = []
        for i in range(N_U):
            th = off + 2 * math.pi * i / N_U
            ph = phis[i] * (1.0 - v)
            d = dir_esf(ax, e1, e2, th, ph)
            r = radio_copa(campo, d)
            fila.append((d, r if r is not None else 10.0))
        filas.append(fila)
    return filas, ax, phis


def suavizar_copa(filas, vueltas=2):
    """Promedia los radios con sus vecinos (sin la fila de abajo)."""
    for _ in range(vueltas):
        nuevo = [list(f) for f in filas]
        for j in range(1, len(filas) - 1):
            for i in range(N_U):
                d, r = filas[j][i]
                rs = [filas[j][(i - 1) % N_U][1], filas[j][(i + 1) % N_U][1], filas[j - 1][i][1], filas[j + 1][i][1]]
                nuevo[j][i] = (d, r * 0.5 + sum(rs) / 8.0)
        filas = nuevo
    return filas


# ---------------------------------------------------------------- el dobladillo

def seccion_dobladillo():
    """Rectángulo redondeado en (a, b): a a lo largo del eje, b hacia afuera desde la holgura. Empieza en
    la cara de adentro y va hacia arriba (con el plano visto así, las caras salen hacia afuera)."""
    A, B, R = ALTO_D, GRUESO_D, RADIO_D
    # tramos en (b, a): rectas (inicio, fin) y arcos (centro, ángulo inicial, ángulo final)
    tramos = [
        ("lin", (0.0, R), (0.0, A - R)),                  # cara de adentro, sube
        ("arc", (R, A - R), math.pi, math.pi / 2),        # esquina de arriba adentro
        ("lin", (R, A), (B - R, A)),                      # arriba
        ("arc", (B - R, A - R), math.pi / 2, 0.0),        # esquina de arriba afuera
        ("lin", (B, A - R), (B, R)),                      # cara de afuera, baja
        ("arc", (B - R, R), 0.0, -math.pi / 2),           # esquina de abajo afuera
        ("lin", (B - R, 0.0), (R, 0.0)),                  # abajo
        ("arc", (R, R), -math.pi / 2, -math.pi),          # esquina de abajo adentro
    ]
    arco = math.pi * R / 2
    largos = [(Vector(t[2]) - Vector(t[1])).length if t[0] == "lin" else arco for t in tramos]
    total = sum(largos)
    pts = []
    for k in range(N_P):
        s = total * k / N_P
        for t, largo in zip(tramos, largos):
            if s <= largo + 1e-9:
                f = s / largo if largo else 0.0
                if t[0] == "lin":
                    p = Vector(t[1]).lerp(Vector(t[2]), f)
                    pts.append((p.y, p.x))
                else:
                    ang = t[2] + (t[3] - t[2]) * f
                    pts.append((t[1][1] + R * math.sin(ang), t[1][0] + R * math.cos(ang)))
                break
            s -= largo
    return pts   # (a, b)


def dobladillo(campo):
    sec = seccion_dobladillo()
    anillos = []
    for i in range(N_U):
        th = 2 * math.pi * i / N_U
        anillos.append([campo.rayo_plano(th, a, b) for a, b in sec])
    return anillos, sec


# ---------------------------------------------------------------- la etiqueta

def etiqueta(campo, nu=24, nv=6):
    """Rejilla pegada a la cara de afuera del dobladillo. Regresa filas de (punto, uv)."""
    thc = math.radians(ETIQUETA_TH)
    ac = ALTO_D * 0.5
    o = campo.c0 + campo.n0 * ac
    r = (campo.rayo_plano(thc, ac, GRUESO_D) - o).length
    dth = ANCHO_ET / r
    filas = []
    for j in range(nv + 1):
        a = ac - ALTO_ET * 0.5 + ALTO_ET * j / nv
        fila = []
        for i in range(nu + 1):
            # visto de frente, +x queda a la derecha: el texto avanza hacia +x (el ángulo baja de 180 hacia 90)
            th = thc + dth * 0.5 - dth * i / nu
            fila.append((campo.rayo_plano(th, a, GRUESO_D + SOBRE_ET), (i / nu, j / nv)))
        filas.append(fila)
    return filas


def imagen_etiqueta():
    import os
    nombre = "Beanie_Etiqueta_tex"
    img = bpy.data.images.get(nombre)
    if img:
        bpy.data.images.remove(img)
    rutas = [os.path.join(os.path.dirname(bpy.data.filepath), "assets", ET_IMAGEN),
             os.path.join(os.path.dirname(os.path.abspath(__file__ if "__file__" in globals() else ".")), ET_IMAGEN)]
    ruta = next((r for r in rutas if os.path.exists(r)), None)
    if not ruta:
        return None
    img = bpy.data.images.load(ruta)
    img.name = nombre
    img.pack()
    return img


# ---------------------------------------------------------------- malla

def armar(caida=True):
    campo = Campo(caida=caida)
    filas, ax, phis = copa(campo)
    filas = suavizar_copa(filas, 4)
    # el polo, en el promedio de la última fila (calculado aparte quedaba un piquito)
    polo_r = sum(r for _, r in filas[-1]) / N_U
    anillos, sec = dobladillo(campo)

    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    c = CENTRO_COPA
    # copa
    vs = [[bm.verts.new(c + d * r) for d, r in fila] for fila in filas]
    polo = bm.verts.new(c + ax * polo_r)
    for j in range(N_V - 1):
        for i in range(N_U):
            i2 = (i + 1) % N_U
            f = bm.faces.new((vs[j][i], vs[j][i2], vs[j + 1][i2], vs[j + 1][i]))
            f.material_index = TEJIDO
            u0, u1 = i / N_U, (i + 1) / N_U
            for lp, (uu, vv) in zip(f.loops, ((u0, j), (u1, j), (u1, j + 1), (u0, j + 1))):
                lp[uv].uv = (uu, vv / (N_V - 1) * 0.5)
    for i in range(N_U):
        i2 = (i + 1) % N_U
        f = bm.faces.new((vs[-1][i], vs[-1][i2], polo))
        f.material_index = TEJIDO
        for lp, (uu, vv) in zip(f.loops, ((i / N_U, 0.5), ((i + 1) / N_U, 0.5), ((i + 0.5) / N_U, 0.5))):
            lp[uv].uv = (uu, vv)
    # dobladillo
    dv = [[bm.verts.new(p) for p in an] for an in anillos]
    for i in range(N_U):
        i2 = (i + 1) % N_U
        for k in range(N_P):
            k2 = (k + 1) % N_P
            f = bm.faces.new((dv[i][k], dv[i][k2], dv[i2][k2], dv[i2][k]))
            f.material_index = DOBLADILLO
            u0, u1 = i / N_U, (i + 1) / N_U
            v0, v1 = 0.5 + 0.5 * k / N_P, 0.5 + 0.5 * (k + 1) / N_P
            for lp, (uu, vv) in zip(f.loops, ((u0, v0), (u0, v1), (u1, v1), (u1, v0))):
                lp[uv].uv = (uu, vv)
    # etiqueta
    et = etiqueta(campo)
    ev = [[bm.verts.new(p) for p, _ in fila] for fila in et]
    for j in range(len(et) - 1):
        for i in range(len(et[0]) - 1):
            f = bm.faces.new((ev[j][i], ev[j][i + 1], ev[j + 1][i + 1], ev[j + 1][i]))
            f.material_index = ETIQUETA
            for lp, (jj, ii) in zip(f.loops, ((j, i), (j, i + 1), (j + 1, i + 1), (j + 1, i))):
                lp[uv].uv = et[jj][ii][1]
    bm.normal_update()
    fe = next(f for f in bm.faces if f.material_index == ETIQUETA)
    re_ = fe.calc_center_median() - campo.c0; re_ -= campo.n0 * re_.dot(campo.n0)
    if fe.normal.dot(re_) < 0:
        for f in bm.faces:
            if f.material_index == ETIQUETA:
                f.normal_flip()
    # caras hacia afuera: la copa, comparada con la dirección desde el centro
    f0 = next(f for f in bm.faces if f.material_index == TEJIDO)
    if f0.normal.dot(f0.calc_center_median() - c) < 0:
        for f in bm.faces:
            if f.material_index == TEJIDO:
                f.normal_flip()
    # el dobladillo: con la cara que más se aleja del eje (la de afuera) basta
    afuera = [f for f in bm.faces if f.material_index == DOBLADILLO]
    ff = max(afuera, key=lambda f: ((f.calc_center_median() - campo.c0) - campo.n0 * (f.calc_center_median() - campo.c0).dot(campo.n0)).length)
    rr = (ff.calc_center_median() - campo.c0); rr -= campo.n0 * rr.dot(campo.n0)
    if ff.normal.dot(rr) < 0:
        for f in afuera:
            f.normal_flip()
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new("bn_beanie")
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("bn_beanie", me)
    col_tmp().objects.link(o)
    o.matrix_world = ARM.matrix_world.copy()
    return o, campo


def textura():
    """Costillas verticales: u alrededor, v a lo largo (copa en v 0..0.5, del borde al polo; dobladillo en
    0.5..1). Cerca del polo se juntan todas y se desvanecen (si no, se haría un remolino)."""
    import numpy as np
    nombre = "Beanie_Tejido_tex"
    img = bpy.data.images.get(nombre)
    if img and (img.size[0] != TEX_W or img.size[1] != TEX_H):
        bpy.data.images.remove(img); img = None
    if not img:
        img = bpy.data.images.new(nombre, TEX_W, TEX_H, alpha=False)
    u = (np.arange(TEX_W) + 0.5) / TEX_W
    v = (np.arange(TEX_H) + 0.5) / TEX_H
    # perfil de una costilla: lomo ancho y redondo, surco angosto
    c = 0.5 + 0.5 * np.cos(2 * np.pi * COSTILLAS * u)
    perfil = c ** 0.45
    fuerza = np.where(v < 0.5, 1.0 - np.clip((v - 0.40) / 0.09, 0.0, 1.0), 1.0)
    t = 0.5 + (perfil[None, :] - 0.5) * fuerza[:, None]
    lomo = np.array(LOMO) / 255.0; surco = np.array(SURCO) / 255.0
    rgb = surco[None, None, :] + (lomo - surco)[None, None, :] * t[:, :, None]
    px = np.concatenate([rgb, np.ones((TEX_H, TEX_W, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(px.ravel())
    img.update()
    img.pack()
    return img


def materiales(o):
    def mat(nombre, color, rough, imagen=None):
        m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        for n in [n for n in nt.nodes if n.type == 'TEX_IMAGE']:
            nt.nodes.remove(n)
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = 0.0
        if imagen:
            tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = imagen; tx.location = (-400, 200)
            tx.extension = 'REPEAT'
            nt.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"])
        m.diffuse_color = (*color, 1); m.roughness = rough; m.metallic = 0.0
        return m
    img = textura()
    # materials.clear() regresa todas las caras al material 0: se guardan y se reponen
    idx = [p.material_index for p in o.data.polygons]
    o.data.materials.clear()
    for m in (mat("Beanie_Tejido", NEGRO, 0.95, img),
              mat("Beanie_Dobladillo", NEGRO, 0.95, img),
              mat("Beanie_Etiqueta", (0.85, 0.85, 0.82), 0.7, imagen_etiqueta())):
        o.data.materials.append(m)
    o.data.polygons.foreach_set("material_index", idx)
    o.data.update()


def pesos(o):
    g = o.vertex_groups.new(name=HUESO)
    g.add(range(len(o.data.vertices)), 1.0, 'REPLACE')


def montar(o):
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


def todo(caida=True):
    borrar("bn_beanie")
    o, campo = armar(caida=caida)
    materiales(o)
    pesos(o)
    montar(o)
    c = bpy.data.collections.get(TMP)
    if c and not c.objects:
        bpy.data.collections.remove(c)
    return dict(verts=len(o.data.vertices), caras=len(o.data.polygons), c0=tuple(round(x, 2) for x in campo.c0),
                extra_max=round(max(campo.extra), 2))
