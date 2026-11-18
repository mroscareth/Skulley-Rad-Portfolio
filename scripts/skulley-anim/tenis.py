"""
Arma los tenis de bota de Skulley (prop "Tenis") en Character/SkulleyRad.blend.

En Blender, en modo objeto:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
Reemplaza el objeto Tenis si ya existe. Todo va en las coordenadas del armature (cm), el piso
es z = 0. Se arma el izquierdo (x > 0) y el derecho sale de espejo, con sus pesos .l -> .r.

La forma es de tenis estilizado, dibujada en la tabla DISENO (planta y alto, del talón a una punta que se
afila en curva), no la del pie: el pie de Skulley es un bloque con tres dedos de 14 cm de ancho y todo lo
que lo envolvía salía con punta cuadrada (Oscar). Por eso EL PIE SE OCULTA cuando trae los tenis (Egg_Foot_L/R)
y el tenis solo sigue a sus huesos. La lona sale de rebanadas horizontales: cada una es la unión suave de
la horma y el anillo de la caña, cuyas orillas son rectas que contienen a la espinilla (su tobillo es una
bola de 13.6 cm) y la abrazan en la boca. Se rehace por voxel, QuadriFlow la remalla cerrada (con
reintentos: a veces doblaba el empeine) y luego se corta abajo en Z_CORTE, dentro de la banda de hule, y
en la boca. La suela es una pieza sólida aparte
(anillos con orillas redondas y tapas por Delaunay) con el fondo donde pisaba el pie en reposo y talón y
punta de mecedora. Puntera de hule, ojilleras, lengüeta, ojillos, agujetas en barras, puntas colgando y
jaladera van encima de la lona (las de enfrente sobre un mapa (s, l) del frente, `Mapa`).
Pesos: lona y suela mezclan los del pie y los de la espinilla por altura (de 5 a 11 cm pasa a la
espinilla, así la caña la sigue); la franja de abajo de la lona copia los de la suela; todo lo demás
copia los de la lona bajo él. Huesos: foot, toes_01, leg_twist, leg_twist_2 y leg_stretch.
revisar_tenis.py mide lo que la pierna se sale de los tenis y dónde queda la suela contra el piso.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ARM = bpy.data.objects["root"]
TMP = "Tenis_tmp"
XC = 11.6            # centro del pie izquierdo (x)
Z_CORTE = 2.8        # la lona termina aquí abajo, dentro de la parte recta de la banda de hule
# boca de la caña, inclinada como la de un Converse: baja enfrente y alta atrás (referencia de Oscar)
Z_CUELLO = 16.5          # enfrente (lo más bajo), a un dedo de la espinilla
Z_CUELLO_ATRAS = 23.0
Y_CUELLO_FRENTE = -8.8
Y_CUELLO_ATRAS = 3.0
GROSOR = 0.3         # pared de la lona
# ceñido (Oscar: "parece como si trajera bolsas en los pies"): de la cara de afuera al cuerpo
CENIDO_PIE = 0.55    # pie (0.25 de aire + la pared)
CENIDO_PIERNA = 0.6  # espinilla y tobillo, enfrente y atrás: el tobillo se dobla hacia adelante y atrás
CENIDO_PIERNA_LADO = 0.5  # a los lados casi no se mueve
ACOJINADO = 0.3      # aire de más enfrente del tobillo (8 a 16 cm)
HUECO_SUELA = 0.0    # el fondo de la suela, donde pisaba el pie (el pie va oculto)
SUELA_ALTO = 4.8     # alto de la banda de hule desde el fondo (Oscar: "la suela alta")
SUELA_SALE = 0.6     # lo que la suela sobresale de la lona (más que el redondeo de arriba)
PIES = ("Egg_Foot_L",)
PIERNAS = ("Egg_Leg1_L",)


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


def objeto(nombre, bm, coleccion=None, huecos=0):
    """'huecos': cuántos lugares de material lleva la malla (sin ellos el índice de material se pierde)."""
    borrar(nombre)
    me = bpy.data.meshes.new(nombre)
    for _ in range(huecos):
        me.materials.append(None)
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


def puntos_cuerpo(nombres):
    """Vértices en reposo (evaluados) de las piezas del cuerpo, en cm del armature."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    out = []
    for n in nombres:
        o = bpy.data.objects[n]
        oe = o.evaluated_get(dg); me = oe.to_mesh()
        m = inv @ o.matrix_world
        out += [m @ v.co for v in me.vertices]
        oe.to_mesh_clear()
    return out


def aristas_cuerpo(nombres):
    """Aristas en reposo (evaluadas) de las piezas del cuerpo, en cm del armature."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    out = []
    for n in nombres:
        o = bpy.data.objects[n]
        oe = o.evaluated_get(dg); me = oe.to_mesh()
        m = inv @ o.matrix_world
        vs = [m @ v.co for v in me.vertices]
        out += [(vs[e.vertices[0]], vs[e.vertices[1]]) for e in me.edges]
        oe.to_mesh_clear()
    return out


def corte(aristas, z):
    """El contorno exacto de la malla a la altura z (donde cada arista cruza el plano). Con los vértices de
    una franja salía incompleto: la pierna tiene pocos y la franja se quedaba entre dos vueltas."""
    out = []
    for a, b in aristas:
        if (a.z - z) * (b.z - z) < 0:
            out.append(a.lerp(b, (z - a.z) / (b.z - a.z)))
    return out


def z_boca(y):
    """Altura de la boca (plano inclinado) a la altura y."""
    k = (Z_CUELLO_ATRAS - Z_CUELLO) / (Y_CUELLO_ATRAS - Y_CUELLO_FRENTE)
    return Z_CUELLO + (y - Y_CUELLO_FRENTE) * k


# --- horma: la forma del tenis, dibujada (Oscar: "son tenis estilizados", "la punta no debe ser cuadrada").
# No sigue al pie: el pie de Skulley es un bloque con tres dedos de 14 cm de ancho y todo lo que lo envuelve
# sale con punta cuadrada. El pie se oculta cuando trae los tenis; el tenis solo sigue a sus huesos.
# (y, medio ancho, centro x, alto de arriba), del talón a la punta: angosto atrás, ancho en la bola del pie
# y la punta que se afila en curva, un poco hacia adentro (del lado del dedo gordo). 12 % más ancho que la
# primera tabla, sobre todo hacia afuera (Oscar: "que no se sintieran tan delgados"), y la punta 2 cm más
# alta: con la suela alta apenas salía de ella y lo que se veía era su cresta, más puntiaguda que la suela
DISENO = [
    (8.8, 0.9, 11.63, 4.6), (8.4, 3.14, 11.70, 6.2), (7.6, 5.15, 11.77, 8.0), (6.4, 6.72, 11.82, 9.4),
    (4.7, 7.84, 11.85, 10.6), (2.5, 8.51, 11.87, 11.4), (0.0, 8.85, 11.88, 11.8), (-4.0, 8.96, 11.79, 11.8),
    (-8.0, 9.07, 11.69, 11.0), (-11.5, 9.13, 11.59, 9.9), (-14.5, 8.9, 11.39, 8.9), (-17.5, 8.12, 11.16, 8.2),
    (-20.2, 6.66, 10.91, 7.7), (-22.2, 4.87, 10.66, 7.2), (-23.6, 2.97, 10.50, 6.7), (-24.5, 1.23, 10.39, 6.2),
]
_HORMA = []

# la sección de la horma sube con paredes verticales hasta la orilla de la suela y encima es domo: así lo
# que asoma de la suela tiene su mismo contorno. Con el domo desde abajo de la suela, en la punta la lona
# apenas salía de ella y se veía solo su cresta, más puntiaguda que la suela (Oscar)
ZB_HORMA = 4.0
# redondez de la sección de la horma a lo largo (2 = elipse; más, costados más parados): la punta redonda
# y el empeine con los costados parados, del ancho de la caña a media altura (con elipse en todo el largo
# el empeine se angostaba arriba y la caña se le salía por los lados: Oscar, "deforme de los lados")
REDONDEZ = [(-24.5, 2.4), (-17.0, 2.5), (-10.0, 2.6), (8.8, 2.6)]


def catmull(pts, t):
    """Catmull-Rom por una lista de valores igualmente espaciados, t en [0, len-1]."""
    n = len(pts)
    i = max(0, min(n - 2, int(t))); u = t - i
    p0 = pts[max(0, i - 1)]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[min(n - 1, i + 2)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)


def horma_anillos(pasos=40):
    """Anillos a lo largo del tenis, interpolados suave (Catmull-Rom) por la tabla DISENO."""
    cols = list(zip(*DISENO))
    out = []
    for k in range(pasos + 1):
        t = (len(DISENO) - 1) * k / pasos
        y, a, cx, zt = (catmull(list(c), t) for c in cols)
        out.append((y, cx, max(0.4, a), max(ZB_HORMA + 0.6, zt)))
    out.sort(key=lambda r: r[0])
    _HORMA[:] = out
    return out


def xc_horma(y):
    """Centro del pie a la altura y (de los anillos de la horma)."""
    if not _HORMA:
        return XC
    if y <= _HORMA[0][0]:
        return _HORMA[0][1]
    for (ya, ca, _, _), (yb, cb, _, _) in zip(_HORMA, _HORMA[1:]):
        if ya <= y <= yb:
            return ca + (cb - ca) * (y - ya) / (yb - ya)
    return _HORMA[-1][1]


def interp(tabla, x):
    """Lineal por una tabla [(x, v), ...] ordenada por x; fuera de ella, el valor del extremo."""
    if x <= tabla[0][0]:
        return tabla[0][1]
    for (xa, va), (xb, vb) in zip(tabla, tabla[1:]):
        if x <= xb:
            return va + (vb - va) * (x - xa) / (xb - xa) if xb > xa else vb
    return tabla[-1][1]


# --- caña: cada orilla en línea recta (Oscar: "que siga la forma de la pierna"). El tobillo de Skulley es
# una bola de 13.6 cm de ancho a 13 cm de alto y la pierna en la boca mide 8: pegada a la pierna la caña
# dibujaba la bola ("volviste a la esfera"); en cono casi vertical quedaba ancha arriba ("bolsa de basura").
# Así: casi vertical desde la suela con el ancho del cuerpo, toca la bola y se cierra recta hasta la boca.
CANA_BASE = 8.7        # medio ancho en la suela (el del cuerpo)
CANA_TALON = 8.8       # la espalda en la suela (y)
Z_ACAMPANA = 6.0       # hasta aquí abajo conserva el ancho y la espalda de la suela
CANA_N_ATRAS = 2.6     # redondez en planta: la espalda más llena que una elipse (el talón, que contiene al de la horma)
CANA_N_FRENTE = 2.0
FRENTE_MIN = -12.0     # abajo, el anillo llega hasta aquí; adelante sigue la horma
# hasta qué altura cuenta la pierna para cada orilla: la boca va inclinada (enfrente a 16.5, a los lados
# a ~20, atrás a ~22); más arriba la orilla ya no se ve y, con la pierna de allá, la línea recta dejaba
# casi un centímetro de más en los lados del cuello
Z_PIDE = {"l": 21.0, "f": 18.0, "t": 23.5}
SUAVE_UNION = 0.5      # unión suave de la horma y el anillo en cada rebanada (cm)
Z_LONA = (1.0, 26.0)   # de abajo del corte a arriba de la boca (lo redondo de las tapas queda fuera)
DZ_REBANADA = 0.25
DY_REBANADA = 0.1
N_REBANADA = 144


def casco(puntos, arriba=True):
    """Envolvente convexa de puntos (z, v): con arriba, la que los tapa por arriba (líneas rectas)."""
    h = []
    for q in sorted(puntos):
        while len(h) >= 2:
            (z1, v1), (z2, v2) = h[-2], h[-1]
            cruz = (z2 - z1) * (q[1] - v1) - (v2 - v1) * (q[0] - z1)
            if (cruz >= 0) if arriba else (cruz <= 0):
                h.pop()
            else:
                break
        h.append(q)
    return h


def media_movil(vals, ancho):
    n = len(vals)
    return [sum(vals[max(0, i - ancho):i + ancho + 1]) / len(vals[max(0, i - ancho):i + ancho + 1])
            for i in range(n)]


def y_cima(z, filas):
    """Dónde queda la cima del empeine a la altura z (adelante del punto más alto de la horma);
    None si z está arriba de toda la horma."""
    i_max = max(range(len(filas)), key=lambda i: filas[i][3])
    if z >= filas[i_max][3]:
        return None
    for i in range(i_max, 0, -1):
        za, zb = filas[i - 1][3], filas[i][3]
        if za <= z < zb:
            return filas[i - 1][0] + (filas[i][0] - filas[i - 1][0]) * (z - za) / (zb - za)
    return filas[0][0]


def aire_frente(z):
    return CENIDO_PIERNA + ACOJINADO * smooth(7.0, 9.0, z) * (1 - smooth(15.0, 17.0, z))


def cana_perfil(aristas, zs, filas):
    """El anillo de la caña en cada altura de zs: (centro x, centro y, medio ancho, frente, espalda).
    Cada orilla es la envolvente convexa (líneas rectas) de la suela y de la caja de la espinilla en reposo,
    con su aire, y lleva las esquinas redondeadas. Luego se revisa que el anillo de verdad contenga a la
    espinilla y, donde no, se le pide más a esa altura y se vuelve a armar (ajustar una elipse a cada
    rebanada pedía de más en las delgadas de abajo del tobillo y la caña salía panzona). El frente, abajo,
    sigue la cima del empeine hasta FRENTE_MIN: así cada rebanada cierra donde cierra la horma."""
    z_pierna = min(min(a.z, b.z) for a, b in aristas)
    rebanadas = []
    z = z_pierna + 0.1
    while z < Z_PIDE["t"]:
        # la rebanada entera, también lo de arriba de la boca: el anillo sigue a la pierna completa y la boca
        # lo corta después (sin eso el anillo se iba hacia atrás con el corte y se desfasaba)
        sl = corte(aristas, z)
        if len(sl) >= 6:
            rebanadas.append((z, sl))
        z += 0.5
    pide = {"l": [], "r": [], "f": [], "t": []}
    for z, sl in rebanadas:
        if z <= Z_PIDE["l"]:
            pide["l"].append((z, min(q.x for q in sl) - CENIDO_PIERNA_LADO))
            pide["r"].append((z, max(q.x for q in sl) + CENIDO_PIERNA_LADO))
        if z <= Z_PIDE["f"]:
            pide["f"].append((z, min(q.y for q in sl) - aire_frente(z)))
        pide["t"].append((z, max(q.y for q in sl) + CENIDO_PIERNA))
    z0 = Z_LONA[0]
    base = {"l": [(z0, XC - CANA_BASE), (Z_ACAMPANA, XC - CANA_BASE)],
            "r": [(z0, XC + CANA_BASE), (Z_ACAMPANA, XC + CANA_BASE)],
            "t": [(z0, CANA_TALON), (Z_ACAMPANA, CANA_TALON)], "f": []}
    ancho = int(round(1.5 / DZ_REBANADA))
    cimas = [y_cima(z, filas) for z in zs]
    for vuelta in range(8):
        orillas = {}
        for o, arriba in (("l", False), ("r", True), ("f", False), ("t", True)):
            vals = [interp(casco(base[o] + pide[o], arriba=arriba), z) for z in zs]
            if o == "f":
                vals = [min(max(FRENTE_MIN, c if c is not None else 99.0), v) for c, v in zip(cimas, vals)]
            orillas[o] = media_movil(vals, ancho)
        tabla = {o: list(zip(zs, v)) for o, v in orillas.items()}
        faltan = 0
        for z, sl in rebanadas:
            l, r, f, t = (interp(tabla[o], z) for o in "lrft")
            cx, cy = (l + r) / 2, (f + t) / 2
            a = (r - l) / 2 - CENIDO_PIERNA_LADO
            bf = cy - f - aire_frente(z); bt = t - cy - CENIDO_PIERNA
            # cuánto le falta a cada mitad del anillo (lo de arriba de la boca ya quedó afuera del tenis)
            kf = kt = 0.0
            for q in sl:
                if z > z_boca(q.y) - 0.2:
                    continue
                dy = q.y - cy
                n, b = (CANA_N_ATRAS, bt) if dy >= 0 else (CANA_N_FRENTE, bf)
                k = ((abs(q.x - cx) / a) ** n + (abs(dy) / b) ** n) ** (1 / n)
                if dy >= 0:
                    kt = max(kt, k)
                else:
                    kf = max(kf, k)
            if max(kf, kt) > 1.002:
                faltan += 1
                k = max(kf, kt) * 1.01
                pide["l"].append((z, cx - a * k - CENIDO_PIERNA_LADO))
                pide["r"].append((z, cx + a * k + CENIDO_PIERNA_LADO))
                if kf > 1.002:
                    pide["f"].append((z, cy - bf * kf * 1.01 - aire_frente(z)))
                if kt > 1.002:
                    pide["t"].append((z, cy + bt * kt * 1.01 + CENIDO_PIERNA))
        if not faltan:
            break
    return [((l + r) / 2, (f + t) / 2, (r - l) / 2, f, t)
            for l, r, f, t in zip(orillas["l"], orillas["r"], orillas["f"], orillas["t"])]


# --- lona: rebanadas horizontales, cada una la unión suave de la horma (DISENO) y el anillo de la caña.
# Una sola superficie: con la horma y la caña como dos cuerpos unidos por voxel, la caña se salía por los
# costados del empeine y dejaba bultos.
def max_suave(a, b, k):
    if k <= 1e-6:
        return max(a, b)
    h = max(k - abs(a - b), 0.0) / k
    return max(a, b) + h * h * k / 4


PUNTA_CIERRA = (-15.0, -25.6)   # la nariz: cuarto de elipsoide entre estas dos y
TALON_HORMA = 8.4               # atrás de aquí el talón es el anillo de la caña


def horma_fina(filas, ys):
    """Por cada y de la rejilla: (centro x, medio ancho, alto, redondez) de la horma, o None. De la puntera
    para adelante la nariz es un cuarto de elipsoide (ancho y alto bajan juntos): cada rebanada de la punta
    es una copia chica del contorno de la suela y la punta queda redonda, de unos 7 cm de radio en planta.
    Con la tabla se afilaba en ojiva y la suela le quedaba redonda alrededor (Oscar: "no coinciden"). El
    talón lo hace el anillo de la caña (el remate de la horma salía 8 mm atrás de él)."""
    def en(y):
        for fa, fb in zip(filas, filas[1:]):
            if fa[0] <= y <= fb[0]:
                t = (y - fa[0]) / (fb[0] - fa[0]) if fb[0] > fa[0] else 0.0
                return tuple(fa[i] + (fb[i] - fa[i]) * t for i in (1, 2, 3))
        return None
    y0, y_punta = PUNTA_CIERRA
    cx0, a0, zt0 = en(y0)
    cx1 = filas[0][1]          # el centro se va un poco hacia adentro, como en la tabla
    out = []
    for y in ys:
        if y > TALON_HORMA:
            out.append(None)
        elif y < y0:
            # cuarto de elipsoide: baja también de alto (de un solo ancho quedaba de filo, como proa)
            u = (y0 - y) / (y0 - y_punta)
            w = math.sqrt(1 - u * u) if u < 1 else 0.0
            out.append((cx0 + (cx1 - cx0) * u, a0 * w, ZB_HORMA + (zt0 - ZB_HORMA) * w,
                        interp(REDONDEZ, y)) if u < 1 else None)
        else:
            for fa, fb in zip(filas, filas[1:]):
                if fa[0] <= y <= fb[0]:
                    t = (y - fa[0]) / (fb[0] - fa[0]) if fb[0] > fa[0] else 0.0
                    out.append((fa[1] + (fb[1] - fa[1]) * t, fa[2] + (fb[2] - fa[2]) * t,
                                fa[3] + (fb[3] - fa[3]) * t, interp(REDONDEZ, y)))
                    break
    return out


def rebanada(z, ys, hf, anillo):
    """Contorno de la lona a la altura z, empezando por la espalda."""
    cxr, cyr, ar, fr, tr = anillo
    der, izq, yv = [], [], []
    for y, h in zip(ys, hf):
        hd = None
        if h is not None:
            cx, a, zt, n = h
            if z <= ZB_HORMA:
                hd = (cx, a)
            elif z < zt:
                hd = (cx, a * (1 - ((z - ZB_HORMA) / (zt - ZB_HORMA)) ** n) ** (1 / n))
        hr = None
        if fr < y < tr:
            if y >= cyr:
                u, n = (y - cyr) / (tr - cyr), CANA_N_ATRAS
            else:
                u, n = (cyr - y) / (cyr - fr), CANA_N_FRENTE
            hr = (cxr, ar * (1 - u ** n) ** (1 / n))
        if hd is None and hr is None:
            continue
        if hd is None or hr is None:
            cx, w = hd or hr
            der.append(cx + w); izq.append(cx - w)
        else:
            k = min(SUAVE_UNION, 0.5 * max(hd[1], hr[1]))
            der.append(max_suave(hd[0] + hd[1], hr[0] + hr[1], k))
            izq.append(-max_suave(-(hd[0] - hd[1]), -(hr[0] - hr[1]), k))
        yv.append(y)
    pts = [Vector((x, y, z)) for x, y in zip(der, yv)] + [Vector((x, y, z)) for x, y in zip(reversed(izq), reversed(yv))]
    i0 = len(der) - 1        # la espalda
    return pts[i0:] + pts[:i0]


def remuestrear(pts, n):
    """n puntos repartidos por igual a lo largo del contorno cerrado."""
    largos = [0.0]
    for a, b in zip(pts, pts[1:] + pts[:1]):
        largos.append(largos[-1] + (b - a).length)
    total = largos[-1]
    out = []; j = 0
    for k in range(n):
        d = total * k / n
        while largos[j + 1] < d:
            j += 1
        a, b = pts[j], pts[(j + 1) % len(pts)]
        seg = largos[j + 1] - largos[j]
        out.append(a.lerp(b, (d - largos[j]) / seg if seg > 1e-9 else 0.0))
    return out


def tubo(bm, anillos):
    filas = [[bm.verts.new(q) for q in r] for r in anillos]
    N = len(filas[0])
    for f0, f1 in zip(filas, filas[1:]):
        for i in range(N):
            j = (i + 1) % N
            bm.faces.new((f0[i], f0[j], f1[j], f1[i]))
    bm.faces.new(list(reversed(filas[0])))
    bm.faces.new(filas[-1])


def lona_proxy(bm, aristas):
    filas = horma_anillos(pasos=240)
    zs = [Z_LONA[0] + DZ_REBANADA * k for k in range(int((Z_LONA[1] - Z_LONA[0]) / DZ_REBANADA) + 1)]
    ys = [-27.0 + DY_REBANADA * k for k in range(int(38.5 / DY_REBANADA) + 1)]
    hf = horma_fina(filas, ys)
    anillos = cana_perfil(aristas, zs, filas)
    tubo(bm, [remuestrear(rebanada(z, ys, hf, an), N_REBANADA) for z, an in zip(zs, anillos)])


def holgura(p):
    """Lo que tiene que quedar entre el punto del cuerpo y la cara de afuera de la lona (cm)."""
    if p.z > 9.0:          # tobillo y espinilla: lo mínimo es el aire de los lados (enfrente y atrás hay más)
        return CENIDO_PIERNA_LADO - 0.05
    return CENIDO_PIE - 0.05


def inflar(o, puntos, radio=3.0, vueltas=10, zmin=None, zmax=None):
    """Empuja la superficie hacia afuera, con caída suave, donde un punto del cuerpo queda a menos
    de su holgura de la cara de afuera (o afuera)."""
    zmin = 2.4 if zmin is None else zmin
    pts = [p for p in puntos if zmin < p.z and p.z < (z_boca(p.y) - 1.0 if zmax is None else zmax)]
    falto = 0.0
    for vuelta in range(vueltas):
        bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update(); bm.verts.ensure_lookup_table()
        bvh = BVHTree.FromBMesh(bm)
        kd = KDTree(len(bm.verts))
        for v in bm.verts:
            kd.insert(v.co, v.index)
        kd.balance()
        empuje = [0.0] * len(bm.verts)
        falto = 0.0
        for p in pts:
            loc, nrm, _, d = bvh.find_nearest(p)
            if loc is None:
                continue
            prof = d if (p - loc).dot(nrm) < 0 else -d
            deficit = holgura(p) - prof
            if deficit <= 0.01:
                continue
            falto = max(falto, deficit)
            for (_, i, dist) in kd.find_range(loc, radio):
                w = 1 - dist / radio
                w = w * w * (3 - 2 * w)
                empuje[i] = max(empuje[i], deficit * w * 1.05)
        if falto <= 0.01:
            bm.free()
            break
        movidos = [v for v in bm.verts if empuje[v.index] > 0]
        for v in movidos:
            v.co += v.normal * empuje[v.index]
        # lo empujado se relaja con sus vecinos: si no, vuelta tras vuelta un vértice suelto se disparaba
        # (con la normal ya chueca) y dejaba un pico; la siguiente vuelta revisa otra vez la holgura
        nuevo = {}
        for v in movidos:
            if v.is_boundary:
                continue
            nb = [e.other_vert(v).co for e in v.link_edges]
            nuevo[v] = v.co.lerp(sum(nb, Vector()) / len(nb), 0.5)
        for v, q in nuevo.items():
            v.co = q
        bm.to_mesh(o.data); bm.free(); o.data.update()
    return round(falto, 3)


def lona_cruda(voxel=0.45, suave=3):
    """Las rebanadas de la lona, rehechas por voxel (malla pareja y cerrada) y apenas suavizadas."""
    bm = bmesh.new()
    lona_proxy(bm, aristas_cuerpo(PIERNAS))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto("tns_lona", bm)
    activo(o)
    o.data.remesh_voxel_size = voxel
    o.data.use_remesh_fix_poles = True
    bpy.ops.object.voxel_remesh()
    m = o.modifiers.new("suave", 'SMOOTH'); m.factor = 0.6; m.iterations = suave
    bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def cortar(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    r = bmesh.ops.bisect_plane(bm, geom=g, plane_co=(0, 0, Z_CORTE), plane_no=(0, 0, 1), clear_inner=True)
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    k = (Z_CUELLO_ATRAS - Z_CUELLO) / (Y_CUELLO_ATRAS - Y_CUELLO_FRENTE)
    bmesh.ops.bisect_plane(bm, geom=g, plane_co=(0, Y_CUELLO_FRENTE, Z_CUELLO), plane_no=(0, -k, 1),
                           clear_outer=True)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # el corte pasa a veces junto a un vértice y deja aristas diminutas: se juntan
    cerca = [v for v in bm.verts if abs(v.co.z - Z_CORTE) < 0.15 or abs(v.co.z - z_boca(v.co.y)) < 0.15]
    bmesh.ops.remove_doubles(bm, verts=cerca, dist=0.08)
    bm.to_mesh(o.data); bm.free(); o.data.update()


def revisar_remallado(o, ref_bvh):
    """Caras volteadas (contra la normal de la superficie de antes) y lo más que se alejó de ella:
    QuadriFlow a veces dobla el empeine. Solo cuenta lo que queda después de los cortes."""
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()

    def queda(p):
        return Z_CORTE - 0.3 < p.z < z_boca(p.y) + 0.3
    volteadas = sum(1 for f in bm.faces if queda(f.calc_center_median())
                    and f.normal.dot(ref_bvh.find_nearest(f.calc_center_median())[1]) <= 0)
    lejos = max(ref_bvh.find_nearest(v.co)[3] for v in bm.verts if queda(v.co))
    bm.free()
    return volteadas, lejos


def quadriflow_seguro(o, caras, intentos=16):
    """QuadriFlow con semillas distintas hasta que no doble nada; si ninguna sale limpia, la mejor."""
    ref = o.data.copy(); ref.name = "tns_qf_ref"
    ref_bvh = bvh_de(o)
    mejor = None; hechas = {ref.name}
    for k in range(intentos):
        o.data = ref.copy(); o.data.name = "tns_qf_%d" % k
        activo(o)
        bpy.ops.object.quadriflow_remesh(target_faces=caras + 40 * (k % 4), use_preserve_sharp=False,
                                         use_preserve_boundary=True, smooth_normals=False,
                                         use_mesh_symmetry=False, seed=k)
        hechas.add(o.data.name)
        volt, lejos = revisar_remallado(o, ref_bvh)
        nota = (volt, lejos)
        if mejor is None or nota < mejor[0]:
            mejor = (nota, o.data.name)
        if volt == 0 and lejos < 0.6:
            break
    o.data = bpy.data.meshes[mejor[1]]
    for n in hechas:
        me = bpy.data.meshes.get(n)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    return dict(intento=k, volteadas=mejor[0][0], lejos=round(mejor[0][1], 3))


def lona(caras=1150):
    o = lona_cruda()
    cuerpo = puntos_cuerpo(PIERNAS)   # el pie va oculto: solo la espinilla tiene que quedar adentro
    f1 = inflar(o, cuerpo, zmin=2.0, zmax=Z_CUELLO_ATRAS + 2)
    m = o.modifiers.new("suave", 'SMOOTH'); m.factor = 0.5; m.iterations = 4
    activo(o); bpy.ops.object.modifier_apply(modifier=m.name)
    # QuadriFlow sobre la lona cerrada y después los cortes (las caras de más se van con ellos): con las
    # orillas ya cortadas, recortaba la punta abajo hasta 1.6 cm y doblaba caras ahí
    qf = quadriflow_seguro(o, caras)
    cortar(o)
    f2 = inflar(o, cuerpo, radio=2.2)
    # la orilla de abajo (dentro de la suela) sin picos: el inflado empujaba algún vértice suelto y el
    # contorno de la suela, que sale de esta orilla, no lo cubría
    bm = bmesh.new(); bm.from_mesh(o.data)
    abajo = [v for v in bm.verts if v.is_boundary and v.co.z < Z_CORTE + 0.05]
    for _ in range(4):
        nuevo = {}
        for v in abajo:
            vec = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(vec) == 2:
                m = (vec[0].co + vec[1].co) / 2
                nuevo[v] = Vector((v.co.x + (m.x - v.co.x) * 0.5, v.co.y + (m.y - v.co.y) * 0.5, v.co.z))
        for v, p in nuevo.items():
            v.co = p
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return o, dict(falto_antes=f1, falto_despues=f2, caras=len(o.data.polygons), quadriflow=qf)


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lazo_ordenado(bm, semilla):
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


def huella(o, sale, paso=0.5, z_hasta=None):
    """Contorno de abajo de la lona (z = Z_CORTE), en orden, remuestreado y abierto 'sale' hacia afuera (2D)."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    abajo = [v for v in bm.verts if v.is_boundary and v.co.z < Z_CORTE + 0.05]
    lazo = [v.co.copy() for v in lazo_ordenado(bm, abajo[0])]
    bm.free()
    # remuestrear parejo
    P = [Vector((p.x, p.y)) for p in lazo]
    L = [0.0]
    for a, b in zip(P, P[1:] + P[:1]):
        L.append(L[-1] + (b - a).length)
    total = L[-1]; n = max(16, int(total / paso))
    out = []; k = 0
    for i in range(n):
        s = total * i / n
        while L[k + 1] < s:
            k += 1
        a, b = P[k], P[(k + 1) % len(P)]
        t = (s - L[k]) / max(1e-9, L[k + 1] - L[k])
        out.append(a.lerp(b, t))
    # suavizar un poco el contorno (la orilla del voxel queda en escalones)
    for _ in range(6):
        out = [(out[i - 1] + out[i] * 2 + out[(i + 1) % n]) / 4 for i in range(n)]
    area = sum(out[i].x * out[(i + 1) % n].y - out[(i + 1) % n].x * out[i].y for i in range(n)) / 2
    giro = 1 if area > 0 else -1   # antihorario: la normal de afuera es (t.y, -t.x)
    nrms = []
    for i in range(n):
        t = (out[(i + 1) % n] - out[i - 1]).normalized()
        nrms.append(Vector((t.y, -t.x)) * giro)
    # lo que la lona se sale del contorno en toda la altura de la banda de hule (arriba de la orilla es
    # un poco más ancha): el contorno se abre eso de más
    extra = [0.0] * n
    if z_hasta is not None:
        kd = KDTree(n)
        for i, q in enumerate(out):
            kd.insert(Vector((q.x, q.y, 0)), i)
        kd.balance()
        for v in o.data.vertices:
            if Z_CORTE - 0.01 <= v.co.z <= z_hasta:
                _, i, _ = kd.find(Vector((v.co.x, v.co.y, 0)))
                extra[i] = max(extra[i], (Vector((v.co.x, v.co.y)) - out[i]).dot(nrms[i]))
        for _ in range(3):   # que no quede un escalón: el máximo de los vecinos, luego suave
            extra = [max(extra[i - 1], extra[i], extra[(i + 1) % n]) for i in range(n)]
        extra = [(extra[i - 1] + 2 * extra[i] + extra[(i + 1) % n]) / 4 for i in range(n)]
    return [out[i] + nrms[i] * (sale + max(0.0, extra[i])) for i in range(n)]


# talón y punta de mecedora: (desde dónde sube, hasta dónde, cuánto sube en la orilla)
MECEDORA_TALON = (1.5, 9.4, 1.6)
MECEDORA_PUNTA = (-15.0, -25.6, 2.6)   # la punta levantada de la referencia (más con la nariz redonda, que al despegar corriendo se metía 1.9 cm en el piso)


def fondo_suela(pie):
    """z del fondo de la suela en reposo: plano a HUECO_SUELA bajo lo más bajo del pie y, en el talón y
    en la punta, sube en curva (mecedora) sin acercarse al pie más que HUECO_SUELA. Plano de punta a
    punta, la esquina del talón se metía 2.3 cm más que el pie al pisar con el talón, y la de la punta
    2 cm al despegar. Sube poco: más alto que la orilla de la lona (Z_CORTE), la lona se asomaba abajo."""
    z0 = min(p.z for p in pie) - HUECO_SUELA
    kd = KDTree(len(pie))
    for i, p in enumerate(pie):
        kd.insert(Vector((p.x, p.y, 0)), i)
    kd.balance()
    def sube(y):
        a, b, h = MECEDORA_TALON
        if y > a:
            return h * min(1.0, (y - a) / (b - a)) ** 2
        a, b, h = MECEDORA_PUNTA
        if y < a:
            return h * min(1.0, (a - y) / (a - b)) ** 2
        return 0.0
    def z(x, y):
        s = sube(y)
        if s <= 0:
            return z0
        return max(z0, min(z0 + s, Z_CORTE - 0.5))
    return z0, z


def contorno_adentro(lazo, d):
    """El contorno (2D, cerrado) recorrido 'd' hacia adentro."""
    n = len(lazo)
    area = sum(lazo[i].x * lazo[(i + 1) % n].y - lazo[(i + 1) % n].x * lazo[i].y for i in range(n)) / 2
    giro = 1 if area > 0 else -1
    out = []
    for i in range(n):
        t = (lazo[(i + 1) % n] - lazo[i - 1]).normalized()
        out.append(lazo[i] - Vector((t.y, -t.x)) * giro * d)
    return out


def tapa(bm, anillo, z_de, paso, arriba):
    """Tapa plana del anillo (verts de bmesh) con puntos por dentro en rejilla, por Delaunay restringido,
    para que el fondo tenga vértices donde doblarse con los dedos."""
    from mathutils.geometry import delaunay_2d_cdt, intersect_point_tri_2d
    P = [Vector((v.co.x, v.co.y)) for v in anillo]
    n = len(P)
    xs = [p.x for p in P]; ys = [p.y for p in P]
    def dentro(q):
        c = False
        for i in range(n):
            a, b = P[i], P[(i + 1) % n]
            if (a.y > q.y) != (b.y > q.y) and q.x < a.x + (q.y - a.y) * (b.x - a.x) / (b.y - a.y):
                c = not c
        return c
    def lejos(q):
        return min((q - p).length for p in P) > paso * 0.6
    interior = []
    y = min(ys) + paso * 0.5
    while y < max(ys):
        x = min(xs) + paso * 0.5 + (paso * 0.5 if int(y / paso) % 2 else 0)
        while x < max(xs):
            q = Vector((x, y))
            if dentro(q) and lejos(q):
                interior.append(q)
            x += paso
        y += paso * 0.866
    pts = P + interior
    edges = [(i, (i + 1) % n) for i in range(n)]
    vout, eout, fout, *_ = delaunay_2d_cdt(pts, edges, [], 1, 1e-5)
    # output_type 1: solo lo de adentro de las aristas cerradas
    mapa = {}
    nuevos = []
    for k, co in enumerate(vout):
        # empatar con los del anillo
        mejor = min(range(n), key=lambda i: (P[i] - co).length)
        if (P[mejor] - co).length < 1e-4:
            mapa[k] = anillo[mejor]
        else:
            v = bm.verts.new((co.x, co.y, z_de)); mapa[k] = v; nuevos.append(v)
    caras = []
    for f in fout:
        vs = [mapa[k] for k in f]
        if not arriba:
            vs = list(reversed(vs))
        try:
            caras.append(bm.faces.new(vs))
        except ValueError:
            pass
    return caras, nuevos


def suela(o_lona, r_abajo=1.7, r_arriba=0.5, arcos=4, arcos_arriba=3, paso=2.2, paso_orilla=1.3,
          linea=(2.0, 2.3), panza=0.15):
    pie = puntos_cuerpo(PIES)
    z0, zfondo = fondo_suela(pie)
    zt = z0 + SUELA_ALTO
    lazo = huella(o_lona, SUELA_SALE, paso_orilla, z_hasta=zt + 0.1)
    # perfil (cuanto se mete, z), de la tapa de abajo a la de arriba
    perfil = []
    for k in range(arcos + 1):
        a = math.pi / 2 * (1 - k / arcos)            # de 90° (abajo, adentro) a 0°
        perfil.append((r_abajo - r_abajo * math.cos(a), z0 + r_abajo - r_abajo * math.sin(a)))
    # la línea oscura de la banda (como la de la referencia): dos filas, la cara entre ellas va en negro
    fila_linea = len(perfil)
    perfil.append((0.0, z0 + linea[0])); perfil.append((0.0, z0 + linea[1]))
    perfil.append((-panza, (z0 + linea[1] + zt - r_arriba) / 2))
    for k in range(arcos_arriba + 1):
        a = math.pi / 2 * k / arcos_arriba
        perfil.append((r_arriba - r_arriba * math.cos(a), zt - r_arriba + r_arriba * math.sin(a)))
    bm = bmesh.new()
    filas = []
    for (d, z) in perfil:
        c = contorno_adentro(lazo, d) if d > 1e-6 else lazo
        filas.append([bm.verts.new((p.x, p.y, z)) for p in c])
    n = len(lazo)
    for k, (f0, f1) in enumerate(zip(filas, filas[1:])):
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new((f0[i], f0[j], f1[j], f1[i]))
            f.material_index = 1 if k == fila_linea else 0
    tapa(bm, filas[0], z0, paso, arriba=False)
    tapa(bm, filas[-1], zt, 99.0, arriba=True)   # queda dentro de la lona: sin puntos por dentro
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.join_triangles(bm, faces=[f for f in bm.faces if len(f.verts) == 3], angle_face_threshold=0.2,
                             angle_shape_threshold=0.9)
    # talón y punta de mecedora: lo de abajo sube con el fondo y la orilla de arriba se queda
    for v in bm.verts:
        sube = zfondo(v.co.x, v.co.y) - z0
        if sube > 0:
            v.co.z += sube * max(0.0, 1 - (v.co.z - z0) / SUELA_ALTO)
    o = objeto("tns_suela", bm, huecos=2)
    return o, dict(fondo=round(z0, 3), arriba=round(zt, 2), caras=len(o.data.polygons))


# --- parches sobre la lona (puntera, ojilleras, lengüeta): copia de las caras de una región,
# con la orilla llevada a la curva f = 0 sobre la superficie, y grosor hacia afuera
def bvh_de(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def parche(o_lona, f, nombre, grosor, vueltas=30, gradiente=0.05):
    bvh = bvh_de(o_lona)
    bm = bmesh.new(); bm.from_mesh(o_lona.data)
    quitar = [x for x in bm.faces if f(x.calc_center_median()) > 0]
    bmesh.ops.delete(bm, geom=quitar, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # solo la isla más grande
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
    for isla in islas:
        if isla is not grande:
            bmesh.ops.delete(bm, geom=isla, context='VERTS')
    def grad(p):
        h = gradiente
        return Vector(((f(p + Vector((h, 0, 0))) - f(p - Vector((h, 0, 0)))) / (2 * h),
                       (f(p + Vector((0, h, 0))) - f(p - Vector((0, h, 0)))) / (2 * h),
                       (f(p + Vector((0, 0, h))) - f(p - Vector((0, 0, h)))) / (2 * h)))
    abajo = Z_CORTE + 0.05
    for _ in range(vueltas):
        nuevo = {}
        for v in bm.verts:
            if v.is_boundary:
                if v.co.z < abajo:      # la orilla de abajo (dentro de la suela) se queda
                    continue
                vec = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                p = v.co.lerp((vec[0].co + vec[1].co) / 2, 0.5) if len(vec) == 2 else v.co.copy()
                g = grad(p); gg = g.length_squared
                if gg > 1e-9:
                    p = p - g * (f(p) / gg)
            else:
                # solo la fila junto a la orilla se acomoda; lo de adentro se queda como la lona
                vec = [e.other_vert(v) for e in v.link_edges]
                if not any(w.is_boundary for w in vec):
                    continue
                p = v.co.lerp(sum((w.co for w in vec), Vector()) / len(vec), 0.3)
            loc = bvh.find_nearest(p)[0]
            nuevo[v] = loc if loc is not None else p
        for v, p in nuevo.items():
            v.co = p
    o = objeto(nombre, bm)
    if grosor:
        activo(o)
        m = o.modifiers.new("grosor", 'SOLIDIFY')
        m.thickness = grosor; m.offset = 1.0; m.use_rim = True; m.use_even_offset = False
        m.use_quality_normals = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def f_puntera(p):
    # adelante de esta curva va el hule: arriba de los dedos (y = -16.5) y baja en diagonal por los lados
    # hasta la suela
    u = (p.x - xc_horma(p.y)) / 8.0
    return p.y - (-17.0 + 1.6 * u * u + 0.9 * (6.0 - p.z))


def quitar_pegadas(o, o_lona, tol=0.06):
    """Borra las caras pegadas a la lona (la cara de abajo de un parche con grosor): nunca se ven."""
    bvh = bvh_de(o_lona)
    bm = bmesh.new(); bm.from_mesh(o.data)
    fuera = [f for f in bm.faces if all(bvh.find_nearest(v.co)[3] < tol for v in f.verts)]
    bmesh.ops.delete(bm, geom=fuera, context='FACES')
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return len(fuera)


def puntera(o_lona, grosor=0.3):
    o = parche(o_lona, f_puntera, "tns_puntera", grosor)
    quitar_pegadas(o, o_lona)
    return o


def forro(o_lona, z_desde=0.0):
    """Grosor hacia adentro solo en la caña (lo que se ve por la boca); abajo no se ve nunca."""
    borrar("tns_forro")
    o = o_lona.copy(); o.data = o_lona.data.copy(); o.name = "tns_forro"; o.data.name = "tns_forro"
    col_tmp().objects.link(o)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[x for x in bm.faces if x.calc_center_median().z < z_desde], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0))
    bm.normal_update()
    for v in bm.verts:
        v.co -= v.normal * GROSOR
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return o


def tubo_camino(bm, centros, ejes_a, ejes_b, ra, rb, lados, cerrado=False, tapas=True):
    """Tubo de sección elíptica por una lista de centros; ejes_a/ejes_b = ejes de la sección en cada punto."""
    filas = []
    for c, A, B in zip(centros, ejes_a, ejes_b):
        filas.append([bm.verts.new(c + A * (ra * math.cos(2 * math.pi * k / lados))
                                   + B * (rb * math.sin(2 * math.pi * k / lados))) for k in range(lados)])
    n = len(filas)
    for i in range(n if cerrado else n - 1):
        f0, f1 = filas[i], filas[(i + 1) % n]
        for k in range(lados):
            kk = (k + 1) % lados
            bm.faces.new((f0[k], f0[kk], f1[kk], f1[k]))
    if tapas and not cerrado:
        bm.faces.new(list(reversed(filas[0]))); bm.faces.new(filas[-1])
    return filas


def cuello(o_lona, r=0.38, lados=6, hueco=None):
    """Orilla acolchada de la boca: un tubo por el borde de arriba, centrado en medio de la pared.
    Abierto al frente, donde sale la lengüeta (como el de un tenis de verdad)."""
    hueco = LENGUA + 0.3 if hueco is None else hueco
    bm = bmesh.new(); bm.from_mesh(o_lona.data); bm.normal_update()
    arriba = [v for v in bm.verts if v.is_boundary and v.co.z > 12.0]
    lazo = lazo_ordenado(bm, arriba[0])
    pts = [v.co.copy() for v in lazo]; nrms = [v.normal.copy() for v in lazo]
    bm.free()
    n = len(pts)
    for _ in range(4):
        pts = [(pts[i - 1] + pts[i] * 2 + pts[(i + 1) % n]) / 4 for i in range(n)]
    cy = sum(p.y for p in pts) / n
    frente = [abs(p.x - XC) < hueco and p.y < cy for p in pts]
    # empezar justo después del hueco: el tubo es un solo tramo abierto
    k0 = next(i for i in range(n) if frente[i - 1] and not frente[i])
    orden = [i for i in [(k0 + j) % n for j in range(n)] if not frente[i]]
    centros = []; A = []; B = []
    for i in orden:
        t = (pts[(i + 1) % n] - pts[i - 1]).normalized()
        afuera = (nrms[i] - t * nrms[i].dot(t)).normalized()
        # abulta hacia afuera: por dentro no pasa de la pared (con la caña ceñida se le metía a la pierna)
        c = pts[i] + afuera * (r - GROSOR) + Vector((0, 0, 0.1))
        arriba_v = t.cross(afuera).normalized()
        if arriba_v.z < 0:
            arriba_v = -arriba_v
        centros.append(c); A.append(afuera); B.append(arriba_v)
    bm = bmesh.new()
    tubo_camino(bm, centros, A, B, r * 1.05, r, lados)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objeto("tns_cuello", bm)


# --- la zona de las agujetas: un mapa (s, l) del frente de la lona. s = largo sobre el perfil del
# centro (de la punta, abajo, a la boca), l = de lado (x - XC)
class Superficie:
    """Triángulos de una malla con sus normales suaves, para pegar cosas encima y sacar pesos."""
    def __init__(self, o):
        me = o.data
        me.calc_loop_triangles() if hasattr(me, "calc_loop_triangles") else None
        self.co = [v.co.copy() for v in me.vertices]
        self.nrm = [v.normal.copy() for v in me.vertices]
        self.tris = [tuple(t.vertices) for t in me.loop_triangles]
        self.bvh = BVHTree.FromPolygons(self.co, self.tris)
        self.o = o

    def cerca(self, p):
        from mathutils.geometry import barycentric_transform
        loc, _, i, d = self.bvh.find_nearest(p)
        a, b, c = self.tris[i]
        bar = barycentric_transform(loc, self.co[a], self.co[b], self.co[c],
                                    Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        w = [max(0.0, bar.x), max(0.0, bar.y), max(0.0, bar.z)]
        s = sum(w) or 1.0
        w = [x / s for x in w]
        n = (self.nrm[a] * w[0] + self.nrm[b] * w[1] + self.nrm[c] * w[2]).normalized()
        return loc, n, (a, b, c), w


def perfil_frente(o_lona, paso=0.25, atras=False):
    bm = bmesh.new(); bm.from_mesh(o_lona.data)
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    r = bmesh.ops.bisect_plane(bm, geom=g, plane_co=(XC, 0, 0), plane_no=(1, 0, 0))
    aristas = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    vec = {}
    for e in aristas:
        a, b = e.verts
        vec.setdefault(a, []).append(b); vec.setdefault(b, []).append(a)
    # cadenas abiertas; la del frente tiene el punto con menor y
    puntas = [v for v, n in vec.items() if len(n) == 1]
    cadenas = []; usados = set()
    for p in puntas:
        if p in usados:
            continue
        c = [p]; usados.add(p); prev = None; v = p
        while True:
            sig = [w for w in vec[v] if w is not prev and w not in usados]
            if not sig:
                break
            prev, v = v, sig[0]; c.append(v); usados.add(v)
        cadenas.append([x.co.copy() for x in c])
    bm.free()
    if atras:
        frente = max(cadenas, key=lambda c: max(p.y for p in c))
    else:
        frente = min(cadenas, key=lambda c: min(p.y for p in c))
    if frente[0].z > frente[-1].z:
        frente.reverse()
    L = [0.0]
    for a, b in zip(frente, frente[1:]):
        L.append(L[-1] + (b - a).length)
    total = L[-1]; n = int(total / paso) + 1
    pts = []; k = 0
    for i in range(n + 1):
        s = total * i / n
        while k < len(L) - 2 and L[k + 1] < s:
            k += 1
        t = (s - L[k]) / max(1e-9, L[k + 1] - L[k])
        pts.append(frente[k].lerp(frente[k + 1], t))
    for _ in range(3):
        pts = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]
    kd = KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(Vector((0, p.y, p.z)), i)
    kd.balance()
    return dict(pts=pts, paso=total / n, total=total, kd=kd)


class Mapa:
    def __init__(self, o_lona, atras=False):
        self.sup = Superficie(o_lona)
        pf = perfil_frente(o_lona, atras=atras)
        self.pts, self.paso, self.total, self.kd = pf["pts"], pf["paso"], pf["total"], pf["kd"]

    def en(self, s):
        """Punto y tangente del perfil en s (extrapola recto pasando la boca)."""
        n = len(self.pts)
        if s >= self.total:
            t = (self.pts[-1] - self.pts[-4]).normalized()
            return self.pts[-1] + t * (s - self.total), t
        f = max(0.0, s / self.paso); i = min(n - 2, int(f)); u = f - i
        p = self.pts[i].lerp(self.pts[i + 1], u)
        t = (self.pts[min(n - 1, i + 2)] - self.pts[max(0, i - 1)]).normalized()
        return p, t

    def s_de(self, p):
        """s continuo del punto del perfil más cercano (en el plano y-z) y la distancia a él."""
        q = Vector((p.y, p.z))
        _, i, _ = self.kd.find(Vector((0, p.y, p.z)))
        mejor = None
        for a in (i - 1, i):
            if a < 0 or a + 1 >= len(self.pts):
                continue
            A = Vector((self.pts[a].y, self.pts[a].z)); B = Vector((self.pts[a + 1].y, self.pts[a + 1].z))
            ab = B - A
            t = max(0.0, min(1.0, (q - A).dot(ab) / max(1e-12, ab.length_squared)))
            d = (A + ab * t - q).length
            if mejor is None or d < mejor[1]:
                mejor = ((a + t) * self.paso, d)
        return mejor

    def punto(self, s, l, sobre=0.0):
        """Punto de la superficie en (s, l), levantado 'sobre' por su normal; con la normal y los pesos."""
        p, _ = self.en(min(s, self.total))
        q = p + Vector((l, 0, 0))
        loc, nrm, tri, w = self.sup.cerca(q)
        extra = Vector()
        if s > self.total:   # arriba de la boca: sigue recto por la tangente
            p2, _ = self.en(s); extra = p2 - p
        return loc + nrm * sobre + extra, nrm, tri, w


def smax(vals, k=0.35):
    m = max(vals)
    return m + k * math.log(sum(math.exp((v - m) / k) for v in vals))


# ancho de la lengüeta (medio) y de cada ojillera
LENGUA = 1.9
OJILLERA = 2.4


def zona_agujetas(mapa):
    """s donde empieza la zona de agujetas (justo arriba de la puntera) y donde está la boca."""
    s = 0.0
    while s < mapa.total and f_puntera(mapa.en(s)[0]) < 0:
        s += 0.1
    return s + 1.3, mapa.total


def ojillera(mapa, lado, s0, grosor=0.28, cols=2, paso=1.0):
    """Tira de los ojillos, de s0 a la boca, con la punta de abajo redonda; pegada a la lona."""
    r = OJILLERA / 2
    s1 = mapa.total
    filas = max(6, int((s1 - s0) / paso))
    lc = (LENGUA + r) * lado
    bm = bmesh.new(); grid = []
    for i in range(filas + 1):
        s = s0 + (s1 - s0) * i / filas
        u = min(1.0, (s - s0) / r)
        medio = r * math.sqrt(max(0.0, 1 - (1 - u) ** 2))
        medio = max(medio, 0.35)
        fila = []
        for j in range(cols + 1):
            l = lc - medio + 2 * medio * j / cols
            p, n, _, _ = mapa.punto(s, l, 0.02)
            fila.append(bm.verts.new(p))
        grid.append(fila)
    for i in range(filas):
        for j in range(cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    bm.normal_update()
    if sum(f.normal.y for f in bm.faces) > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    o = objeto("tns_ojillera_" + ("i" if lado > 0 else "e"), bm)
    activo(o)
    m = o.modifiers.new("grosor", 'SOLIDIFY')
    m.thickness = grosor; m.offset = 1.0; m.use_rim = True; m.use_even_offset = False
    bpy.ops.object.modifier_apply(modifier=m.name)
    quitar_pegadas(o, mapa.sup.o, tol=0.05)
    return o


def lengueta(mapa, s0, sale=2.4, grosor=0.3, ancho=None, r=None, filas=12, cols=6):
    """La lengüeta: pegada a la lona entre las ojilleras y asomando 'sale' arriba de la boca."""
    ancho = LENGUA - 0.12 if ancho is None else ancho
    r = ancho if r is None else r   # punta redonda (media luna)
    s1 = mapa.total + sale
    bm = bmesh.new(); grid = []
    for i in range(filas + 1):
        s = s0 + (s1 - s0) * i / filas
        lim = ancho
        if s > s1 - r:
            u = (s - (s1 - r)) / r
            lim = ancho - r + r * math.sqrt(max(0.0, 1 - u * u))
        lim = max(lim, 0.25)
        fila = []
        for j in range(cols + 1):
            l = -lim + 2 * lim * j / cols
            p, n, _, _ = mapa.punto(s, l, 0.08)
            if s > mapa.total:   # al salir se aleja un poco de la espinilla
                p = p + n * 0.25 * ((s - mapa.total) / sale) ** 2
            fila.append(bm.verts.new(p))
        grid.append(fila)
    for i in range(filas):
        for j in range(cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    bm.normal_update()
    # que mire hacia afuera (al frente la lona mira a -y)
    if sum(f.normal.y for f in bm.faces) > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    o = objeto("tns_lengueta", bm)
    activo(o)
    m = o.modifiers.new("grosor", 'SOLIDIFY')
    m.thickness = grosor; m.offset = 1.0; m.use_rim = True; m.use_even_offset = False
    bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def ojillos(mapa, filas_s, l_o, sobre=0.28, R=0.62, r=0.18, lados=8, anillo=3):
    """Arillos de metal en cada ojillera (toro chico acostado en la superficie)."""
    bm = bmesh.new()
    for s in filas_s:
        for lado in (1, -1):
            c, n, _, _ = mapa.punto(s, l_o * lado, sobre + r * 0.6)
            X = n.cross(Vector((0, 0, 1)))
            if X.length < 1e-3:
                X = n.cross(Vector((0, 1, 0)))
            X.normalize(); Y = n.cross(X).normalized()
            filas = []
            for k in range(lados):
                a = 2 * math.pi * k / lados
                d = X * math.cos(a) + Y * math.sin(a)
                filas.append([bm.verts.new(c + d * (R + r * math.cos(2 * math.pi * m / anillo))
                                           + n * (r * math.sin(2 * math.pi * m / anillo))) for m in range(anillo)])
            for k in range(lados):
                f0, f1 = filas[k], filas[(k + 1) % lados]
                for m in range(anillo):
                    mm = (m + 1) % anillo
                    bm.faces.new((f0[m], f0[mm], f1[mm], f1[m]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objeto("tns_ojillos", bm)


def cordon(bm, mapa, camino, sobre, ra=0.5, rb=0.27, lados=4, cerrado=False):
    """Agujeta por un camino en el mapa: lista de (s, l, levanta). Sección plana, acostada en la superficie."""
    pts = []; nrms = []
    for (s, l, lev) in camino:
        p, n, _, _ = mapa.punto(s, l, sobre + lev)
        pts.append(p); nrms.append(n)
    A = []; B = []
    m = len(pts)
    for i in range(m):
        t = (pts[(i + 1) % m] - pts[i - 1]) if cerrado else (pts[min(m - 1, i + 1)] - pts[max(0, i - 1)])
        t.normalize()
        n = (nrms[i] - t * nrms[i].dot(t)).normalized()
        A.append(t.cross(n).normalized()); B.append(n)
    return tubo_camino(bm, pts, A, B, ra, rb, lados, cerrado=cerrado)


def tramo(a, b, pasos, lev_medio=0.0):
    """Camino recto en el mapa de a=(s,l) a b, con una joroba 'lev_medio' en medio (el que pasa encima)."""
    out = []
    for k in range(pasos + 1):
        t = k / pasos
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, lev_medio * math.sin(math.pi * t)))
    return out


def agujetas(mapa, filas_s, l_o, sobre_lengua=0.62, pasos=6, estilo="barras", ra=0.62, rb=0.17):
    """'barras': una barra derecha por fila, de ojillo a ojillo, arqueada sobre la lengüeta (como la
    referencia de Oscar). 'cruzadas': en X de una fila a la siguiente."""
    bm = bmesh.new()
    if estilo == "barras":
        for s_ in filas_s:
            cordon(bm, mapa, tramo((s_, -l_o), (s_, l_o), pasos, 0.25), sobre_lengua, ra=ra, rb=rb, lados=6)
    else:
        s_ = filas_s[0]
        cordon(bm, mapa, tramo((s_, -l_o), (s_, l_o), pasos, 0.0), sobre_lengua - 0.15, ra=ra, rb=rb)
        for i in range(len(filas_s) - 1):
            a, b = filas_s[i], filas_s[i + 1]
            cordon(bm, mapa, tramo((a, -l_o), (b, l_o), pasos, 0.32), sobre_lengua, ra=ra, rb=rb)
            cordon(bm, mapa, tramo((a, l_o), (b, -l_o), pasos, 0.0), sobre_lengua, ra=ra, rb=rb)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objeto("tns_agujetas", bm)


def puntas(mapa, s_top, l_o, sobre=0.75, largos=(6.5, 4.2), ra=0.62, rb=0.17, lados=4):
    """Las dos puntas de la agujeta salen de los ojillos de arriba y cuelgan por fuera de cada lado,
    de distinto largo, con su herrete."""
    bm = bmesh.new()
    for lado, largo in zip((1, -1), largos):
        cam = []
        for k in range(9):
            t = k / 8
            cam.append((s_top - 0.1 - largo * t, lado * (l_o + 0.25 + 0.9 * math.sin(math.pi * 0.6 * t)),
                        0.25 * math.sin(math.pi * t)))
        cordon(bm, mapa, cam, sobre, ra=ra, rb=rb, lados=lados)
        s_f, l_f, _ = cam[-1]
        cordon(bm, mapa, tramo((s_f + 0.2, l_f), (s_f - 0.9, l_f + lado * 0.05), 2), sobre,
               ra=0.24, rb=0.24, lados=lados)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return objeto("tns_puntas", bm)


def jaladera(o_lona, alto=2.6, abajo=2.4, ancho=1.1, r=0.8, grosor=0.3, filas=8, cols=3):
    """La jaladera de atrás: tira que baja por la espalda y sale arriba de la boca, echada hacia atrás."""
    mapa = Mapa(o_lona, atras=True)
    s0 = mapa.total - abajo; s1 = mapa.total + alto
    bm = bmesh.new(); grid = []
    for i in range(filas + 1):
        s_ = s0 + (s1 - s0) * i / filas
        lim = ancho
        if s_ > s1 - r:
            u = (s_ - (s1 - r)) / r
            lim = ancho - r + r * math.sqrt(max(0.0, 1 - u * u))
        lim = max(lim, 0.2)
        fila = []
        for j in range(cols + 1):
            l = -lim + 2 * lim * j / cols
            q, n, _, _ = mapa.punto(s_, l, 0.06)
            if s_ > mapa.total:   # se echa hacia atrás, lejos de la pierna
                q = q + n * 0.9 * ((s_ - mapa.total) / alto) ** 1.5
            fila.append(bm.verts.new(q))
        grid.append(fila)
    for i in range(filas):
        for j in range(cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    bm.normal_update()
    if sum(f.normal.y for f in bm.faces) < 0:   # mira hacia atrás
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    o = objeto("tns_jaladera", bm)
    activo(o)
    m = o.modifiers.new("grosor", 'SOLIDIFY')
    m.thickness = grosor; m.offset = 1.0; m.use_rim = True; m.use_even_offset = False
    bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def detalles(o_lona, filas=6, estilo="barras"):
    mapa = Mapa(o_lona)
    s0, s_boca = zona_agujetas(mapa)
    l_o = LENGUA + OJILLERA / 2
    s_a = s0 + 0.9; s_b = s_boca - 1.9
    filas_s = [s_a + (s_b - s_a) * i / (filas - 1) for i in range(filas)]
    o1 = ojillera(mapa, 1, s0 + 0.5)
    o2 = ojillera(mapa, -1, s0 + 0.5)
    lg = lengueta(mapa, s0 + 0.4, sale=4.0)
    oj = ojillos(mapa, filas_s, l_o)
    ag = agujetas(mapa, filas_s, l_o, estilo=estilo)
    mo = puntas(mapa, filas_s[-1], l_o)
    ja = jaladera(o_lona)
    return dict(s0=round(s0, 2), boca=round(s_boca, 2), filas=[round(x, 2) for x in filas_s],
                ojilleras=(len(o1.data.polygons), len(o2.data.polygons)), lengueta=len(lg.data.polygons),
                ojillos=len(oj.data.polygons), agujetas=len(ag.data.polygons), puntas=len(mo.data.polygons),
                jaladera=len(ja.data.polygons))


# --- materiales, unión, pesos, espejo y montaje
# (nombre, color, rugosidad, papel en la medición): el metal va con metalness 0 (en el sitio, con 1 y sin
# reflejo que tomar, sale negro)
MATERIALES = [
    ("Tenis_Lona", (0.035, 0.035, 0.04), 0.85, "afuera"),
    ("Tenis_Forro", (0.06, 0.06, 0.066), 0.9, "adentro"),
    ("Tenis_Suela", (0.80, 0.72, 0.56), 0.6, "afuera"),
    ("Tenis_Agujetas", (0.87, 0.81, 0.68), 0.8, None),
    ("Tenis_Metal", (0.72, 0.73, 0.75), 0.35, None),
]
# pieza: (material, de dónde saca sus pesos: 'cuerpo' = del pie y la espinilla, 'lona' = de la lona
# bajo ella, 'rigida' = cada isla con el peso de la lona bajo su centro)
PIEZAS = {
    "tns_lona": (0, "cuerpo"),
    "tns_suela": ({0: 2, 1: 0}, "cuerpo"),   # banda crema y su línea negra
    "tns_forro": (1, "lona"),
    "tns_cuello": (0, "lona"),
    "tns_puntera": (2, "lona"),
    "tns_ojillera_i": (0, "lona"),
    "tns_ojillera_e": (0, "lona"),
    "tns_lengueta": (0, "lona"),
    "tns_agujetas": (3, "lona"),
    "tns_puntas": (3, "lona"),
    "tns_jaladera": (0, "lona"),
    "tns_ojillos": (4, "rigida"),
}
MAX_HUESOS = 4


def materiales():
    out = []
    for nombre, color, rough, papel in MATERIALES:
        m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = 0.0
        m.diffuse_color = (*color, 1); m.roughness = rough; m.metallic = 0.0
        for k in ("tenis_afuera", "tenis_adentro"):
            if k in m:
                del m[k]
        if papel:
            m["tenis_" + papel] = True
        out.append(m)
    return out


def leer_pesos(o):
    nombres = {g.index: g.name for g in o.vertex_groups}
    return [{nombres[g.group]: g.weight for g in v.groups if g.weight > 1e-4} for v in o.data.vertices]


def escribir_pesos(o, pesos):
    o.vertex_groups.clear()
    usados = sorted({k for d in pesos for k in d})
    grupos = {k: o.vertex_groups.new(name=k) for k in usados}
    for i, d in enumerate(pesos):
        for k, w in d.items():
            grupos[k].add([i], w, 'REPLACE')
    return usados


def limpiar(d, n=MAX_HUESOS):
    top = sorted(d.items(), key=lambda kv: -kv[1])[:n]
    s = sum(w for _, w in top)
    return {k: w / s for k, w in top if s > 0 and w / s > 0.01} if s > 0 else {}


def transferir(o, fuentes):
    """Pesos del cuerpo (las piezas 'fuentes', juntas) a 'o' por la superficie más cercana."""
    vl = bpy.context.view_layer
    copias = []
    for n in fuentes:
        src = bpy.data.objects[n]
        c = src.copy(); c.data = src.data.copy(); c.modifiers.clear()
        col_tmp().objects.link(c); copias.append(c)
    activo(copias[0])
    for c in copias:
        c.select_set(True)
    bpy.ops.object.join()
    cuerpo = copias[0]; cuerpo.name = "tns_cuerpo_tenis"
    o.vertex_groups.clear()
    for g in cuerpo.vertex_groups:
        o.vertex_groups.new(name=g.name)
    m = o.modifiers.new("pesos", 'DATA_TRANSFER')
    m.object = cuerpo; m.use_vert_data = True; m.data_types_verts = {'VGROUP_WEIGHTS'}
    m.vert_mapping = 'POLYINTERP_NEAREST'
    m.layers_vgroup_select_src = 'ALL'; m.layers_vgroup_select_dst = 'NAME'
    activo(o)
    bpy.ops.object.modifier_apply(modifier=m.name)
    me_c = cuerpo.data
    bpy.data.objects.remove(cuerpo, do_unlink=True)
    if me_c.users == 0:
        bpy.data.meshes.remove(me_c)


def suavizar_pesos(o, pesos, vueltas, factor=0.5, max_arista=3.5):
    """Suaviza por las aristas de la malla, sin las largas: la tapa de arriba de la suela va de punta a
    talón en un triángulo y por ahí se le pasaban los pesos del talón a la punta."""
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    vec = [[e.other_vert(v).index for e in v.link_edges if e.calc_length() <= max_arista] for v in bm.verts]
    bm.free()
    for _ in range(vueltas):
        nuevos = []
        for i, d in enumerate(pesos):
            acc = {}
            for j in vec[i]:
                for k, w in pesos[j].items():
                    acc[k] = acc.get(k, 0.0) + w
            nv = len(vec[i]) or 1
            nuevos.append({k: d.get(k, 0.0) * (1 - factor) + acc.get(k, 0.0) / nv * factor for k in set(acc) | set(d)})
        pesos = nuevos
    return [limpiar(d) for d in pesos]


def unir(vueltas_lona=12, vueltas_suela=8):
    """Junta las piezas del tenis izquierdo en 'tmp_tenis_L' con sus materiales y pesos."""
    mats = materiales()
    lona = bpy.data.objects["tns_lona"]
    # 1) lona y suela. El tenis ya no sigue la forma del pie (que va oculto), así que no basta con copiar
    # los pesos de la superficie más cercana: los del pie (pie y dedos) y los de la espinilla se copian
    # aparte y se mezclan por altura: abajo y en la punta, el pie; de 5 a 11 cm pasa a la espinilla, así la
    # caña la sigue y no se le sale por los lados del tobillo.
    pesos_de = {}
    for n, vueltas in (("tns_lona", vueltas_lona), ("tns_suela", vueltas_suela)):
        o = bpy.data.objects[n]
        transferir(o, PIES); wp = leer_pesos(o)
        transferir(o, PIERNAS); wl = leer_pesos(o)
        p = []
        for v, a, b in zip(o.data.vertices, wp, wl):
            f = smooth(5.0, 11.0, v.co.z) * smooth(-14.0, -11.0, v.co.y)
            d = {k: x * (1 - f) for k, x in a.items()}
            for k, x in b.items():
                d[k] = d.get(k, 0.0) + x * f
            p.append(limpiar(d))
        p = suavizar_pesos(o, p, vueltas)
        escribir_pesos(o, p)
        pesos_de[n] = p
    # 1b) la franja de abajo de la lona (dentro de la banda de hule) se mueve con la suela: con sus
    # propios pesos se asomaba 3 mm por la banda al caminar. Arriba de la banda pasa a los suyos.
    sup_s = Superficie(bpy.data.objects["tns_suela"])
    ps = pesos_de["tns_suela"]; pl = pesos_de["tns_lona"]
    z_banda = min(v.co.z for v in bpy.data.objects["tns_suela"].data.vertices) + SUELA_ALTO
    for v in lona.data.vertices:
        t = smooth(z_banda - 0.2, z_banda + 1.8, v.co.z)
        if t >= 1.0:
            continue
        _, _, tri, w = sup_s.cerca(v.co)
        acc = {}
        for i, wi in zip(tri, w):
            for k, x in ps[i].items():
                acc[k] = acc.get(k, 0.0) + wi * x * (1 - t)
        for k, x in pl[v.index].items():
            acc[k] = acc.get(k, 0.0) + x * t
        pl[v.index] = limpiar(acc)
    escribir_pesos(lona, pl)
    # 2) lo demás: de la lona bajo cada vértice (o bajo el centro de cada isla, en las rígidas)
    sup = Superficie(lona)
    def de_lona(p):
        _, _, tri, w = sup.cerca(p)
        acc = {}
        for i, wi in zip(tri, w):
            for k, x in pl[i].items():
                acc[k] = acc.get(k, 0.0) + wi * x
        return limpiar(acc)
    for n, (mi, modo) in PIEZAS.items():
        o = bpy.data.objects[n]
        locales = [poly.material_index for poly in o.data.polygons]
        o.data.materials.clear()
        for m in mats:
            o.data.materials.append(m)
        for poly, loc in zip(o.data.polygons, locales):
            poly.material_index = mi.get(loc, 0) if isinstance(mi, dict) else mi
            poly.use_smooth = True
        if modo == "lona":
            escribir_pesos(o, [de_lona(v.co) for v in o.data.vertices])
        elif modo == "rigida":
            bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
            pesos = [None] * len(bm.verts); vistos = set()
            for v in bm.verts:
                if v.index in vistos:
                    continue
                pila = [v]; isla = []; vistos.add(v.index)
                while pila:
                    x = pila.pop(); isla.append(x.index)
                    for e in x.link_edges:
                        w = e.other_vert(x)
                        if w.index not in vistos:
                            vistos.add(w.index); pila.append(w)
                c = sum((bm.verts[i].co for i in isla), Vector()) / len(isla)
                d = de_lona(c)
                for i in isla:
                    pesos[i] = d
            bm.free()
            escribir_pesos(o, pesos)
    # 3) juntar
    objs = [bpy.data.objects[n] for n in PIEZAS]
    borrar("tns_tenis_L")
    activo(objs[0])
    for o in objs:
        o.select_set(True)
    bpy.ops.object.join()
    t = objs[0]; t.name = "tns_tenis_L"; t.data.name = "tns_tenis_L"
    return t


def espejo(o_l):
    """El derecho: el izquierdo espejeado en x, con las caras volteadas y los grupos .l -> .r."""
    bm = bmesh.new(); bm.from_mesh(o_l.data)
    for v in bm.verts:
        v.co.x = -v.co.x
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    o = objeto("tns_tenis_R", bm)
    for m in o_l.data.materials:
        o.data.materials.append(m)
    nombres = {g.index: g.name for g in o_l.vertex_groups}
    def lado(n):
        return n[:-2] + ".r" if n.endswith(".l") else n
    pesos = [{lado(nombres[g.group]): g.weight for g in v.groups} for v in o_l.data.vertices]
    escribir_pesos(o, pesos)
    return o


def montar(nombre="Tenis"):
    """Junta izquierdo y derecho, lo hace hijo del armature con su modificador, en la colección de los props."""
    L = bpy.data.objects["tns_tenis_L"]
    R = espejo(L)
    activo(L); R.select_set(True)
    bpy.ops.object.join()
    o = L
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


def limpiar_tmp():
    c = bpy.data.collections.get(TMP)
    if c:
        for o in list(c.objects):
            borrar(o.name)
        bpy.data.collections.remove(c)
    for me in list(bpy.data.meshes):
        if me.users == 0 and me.name.startswith(("tns_lona", "tns_suela", "tns_forro", "tns_puntera", "tns_cuello",
                                                 "tns_ojill", "tns_lengueta", "tns_agujetas", "tns_puntas", "tns_jaladera",
                                                 "tns_tenis", "tns_qf")):
            bpy.data.meshes.remove(me)


def piezas():
    """Arma todas las piezas del izquierdo en la colección temporal."""
    info = {}
    L, info["lona"] = lona()
    _, info["suela"] = suela(L)
    puntera(L); forro(L); cuello(L)
    info["detalles"] = detalles(L)
    return info


def todo():
    info = piezas()
    unir()
    o = montar()
    limpiar_tmp()
    me = o.data
    me.calc_loop_triangles()
    info["triangulos"] = len(me.loop_triangles)
    info["vertices"] = len(me.vertices)
    info["huesos"] = sorted(g.name for g in o.vertex_groups)
    return o, info
