"""
Arma los pantalones de mezclilla de Skulley (prop "Pantalones") en Character/SkulleyRad.blend:
grises deslavados, rectos y cerca del hueso, rotos de las rodillas y un poco arremangados abajo.

En Blender, en cualquier modo:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
(o por partes, si el MCP corta por tiempo: ns["forma"]() y luego ns["armar"]()).
Reemplaza el objeto Pantalones si ya existe. Todo va en las coordenadas del armature (cm), el piso es z = 0.

Forma (Oscar: "que no tomen la forma del cuerpo literalmente... solo que sean rectos"): cada pierna es un
tubo superelíptico de lados rectos vista de frente (un poco más angosto abajo) que de lado sigue suave la
línea de la pierna, del tamaño que pide el hueso donde más se acerca; de la entrepierna a la cintura, el
contorno de la pelvis y los muslos con la cuerda tensa de arriba abajo (cintura pegada, sin lonjas: ver
anillos_cadera). Unidos con voxel remesh, la unión redondeada, cortados (cintura con
más tiro atrás, bastilla) y QuadriFlow con la orilla quieta; simetrizado e inflado donde algún punto del
cuerpo queda a menos de la holgura. Después se corta un roto en el frente de cada rodilla (antes de
QuadriFlow lo cerraba), con la orilla en dientes, canto blanco (el Solidify pone el canto en
Pantalones_Hilos) e hilos blancos atravesados. Pretina con presillas, botón y remaches; abajo dos rollos
del lado de adentro de la tela (Pantalones_Forro), arriba de los tenis. Textura deslavada empacada
(Pantalones_Mezclilla_tex) en UVMap.
Pesos (ver pesar_tela): pelvis arriba y pierna abajo, mezcladas por altura; cada parte copia los de su
pieza del cuerpo (la rodilla se dobla como la del cuerpo) y lo común pasa a prop_cadera (gira la mitad que
el muslo, como en los bóxers).
revisar_pantalones.py mide lo que el cuerpo atraviesa y saca las fotos.
"""
import bpy, bmesh, math, random
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ARM = bpy.data.objects["root"]
TMP = "Pantalones_tmp"          # temporales con prefijo propio: otras sesiones borran por nombre
P = "pnt_"
NOMBRE = "Pantalones"

PELVIS = ("Egg_Pelvis",)
PIERNA_L = ("Egg_Leg1_L", "Egg_Leg2_L")       # espinilla y fémur
PIERNA_R = ("Egg_Leg1_R", "Egg_Leg2_R")

GROSOR = 0.35            # la tela (el Solidify va hacia adentro: los anillos son la cara de afuera)
HOLGURA_MIN = 0.45       # lo mínimo que tiene que quedar entre el cuerpo y la cara de adentro (inflado)

Z_CINTURA = 72.3         # corte de arriba al centro; con más tiro atrás (TIRO_ATRAS cm por cm de y)
TIRO_ATRAS = 0.035
Z_TIRO = 59.0            # entrepierna, como en el dibujo de Oscar (la pelvis acaba en 60.5)
Z_TUBO_FIN = 32.5        # la tela de la pierna acaba aquí, adentro del rollo de abajo
# rollos de la bastilla (z de abajo, z de arriba, cuánto salen de la tela): arriba de las botas (Oscar: "con
# las botas subimos la bastilla"; su caña acaba pareja en z 30.3-30.9). Con los tenis (boca a 22.4 atrás)
# queda la espinilla al aire en medio. Abajo, en 23.9, chocaban con la caña de las botas. Dos vueltas finas:
# ya cerca de la rodilla, con los rollos de antes (hasta 36.6) el muslo se les metía en el paso de atrás.
ROLLOS = [(31.8, 33.6, 0.5), (33.4, 35.1, 0.42)]

# roto de cada rodilla: centro (x, z) del lado izquierdo, medio ancho y medio alto (cm), dientes; arriba de
# los rollos con tela de por medio
ROTO = dict(x=11.7, z=39.9, a=4.6, b=2.7, dientes=14, amp=0.42, semilla=7)
HILOS = (-0.6, -0.2, 0.2, 0.58)   # alturas de los hilos atravesados, en fracción del medio alto


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


def objeto(nombre, bm, huecos=0):
    """'huecos': cuántos lugares de material lleva la malla (sin ellos se pierde el índice de material)."""
    borrar(nombre)
    me = bpy.data.meshes.new(nombre)
    for _ in range(huecos):
        me.materials.append(None)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(nombre, me)
    col_tmp().objects.link(o)
    o.matrix_world = ARM.matrix_world.copy()
    return o


def activo(o):
    vl = bpy.context.view_layer
    if bpy.context.view_layer.objects.active and bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for x in vl.objects:
        x.select_set(False)
    o.select_set(True); vl.objects.active = o


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def reposo():
    for pb in ARM.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    aj = ARM.pose.bones["ctl_ajustes"]
    for k in ("rig", "ik_pierna_l", "ik_pierna_r", "ik_brazo_l", "ik_brazo_r"):
        if k in aj:
            aj[k] = 1
    bpy.context.view_layer.update()


def puntos(nombres):
    """Vértices evaluados (pose actual) de las piezas del cuerpo, en cm del armature."""
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


def envolvente(vals, k=2, minimo=False):
    """Perfil que nunca queda adentro de los datos: máximo en una ventana (o mínimo) y luego promedio."""
    sg = -1 if minimo else 1
    v = [sg * x for x in vals]
    n = len(v)
    dil = [max(v[max(0, i - k):i + k + 1]) for i in range(n)]
    lis = [sum(dil[max(0, i - k):i + k + 1]) / len(dil[max(0, i - k):i + k + 1]) for i in range(n)]
    return [sg * x for x in lis]


def z_cintura(y):
    return Z_CINTURA + y * TIRO_ATRAS


# ---------------------------------------------------------------- forma

def anillo(cx, cy, z, a, bf, bb, n, N=64):
    """Superelipse en z con medio ancho a, frente bf (hacia -y) y espalda bb (hacia +y)."""
    pts = []
    for i in range(N):
        t = 2 * math.pi * i / N
        c, s = math.cos(t), math.sin(t)
        x = cx + a * math.copysign(abs(c) ** (2 / n), c)
        y = cy + (bb if s > 0 else bf) * math.copysign(abs(s) ** (2 / n), s)
        pts.append(Vector((x, y, z)))
    return pts


def tubo(bm, anillos):
    filas = [[bm.verts.new(p) for p in r] for r in anillos]
    N = len(filas[0])
    for f0, f1 in zip(filas, filas[1:]):
        for i in range(N):
            j = (i + 1) % N
            bm.faces.new((f0[i], f0[j], f1[j], f1[i]))
    bm.faces.new(list(reversed(filas[0])))
    bm.faces.new(filas[-1])


def suavizar(vals, sigma):
    """Promedio gaussiano (sigma en muestras), con las puntas pegadas."""
    n = len(vals); r = int(3 * sigma) + 1
    out = []
    for i in range(n):
        acc = w = 0.0
        for j in range(i - r, i + r + 1):
            k = math.exp(-0.5 * ((j - i) / sigma) ** 2)
            acc += vals[min(max(j, 0), n - 1)] * k; w += k
        out.append(acc / w)
    return out


def recta_encima(zs, vals, pendiente):
    """La recta v = v0 + pendiente * (z - z_arriba) más baja que no queda debajo de ningún valor."""
    zt = zs[-1]
    v0 = max(v - pendiente * (z - zt) for z, v in zip(zs, vals))
    return [v0 + pendiente * (z - zt) for z in zs]


def fondo_necesario(sl, cx, cy, a, n):
    """Con el medio ancho 'a' ya fijo, lo mínimo de frente y de espalda para que la superelipse contenga los
    puntos de la rebanada."""
    bf = bb = 0.0
    for p in sl:
        u = min(abs(p.x - cx) / a, 0.999)
        d = abs(p.y - cy) / (1 - u ** n) ** (1 / n)
        if p.y < cy:
            bf = max(bf, d)
        else:
            bb = max(bb, d)
    return bf, bb


# Rectos (Oscar: "que no tomen la forma del cuerpo literalmente... solo que sean rectos"): de frente cada
# pierna es un tubo de lados rectos (un poco más angosto abajo, AFINA por lado); de lado sigue la línea de
# la pierna, suave, con el mismo fondo de arriba abajo (también en recta). Nada copia los bultos del hueso.
N_PIERNA = 2.4
AFINA = 0.5              # cm por lado, de arriba de la pierna a la bastilla
HOLGURA = 0.9            # aire mínimo de la cara de adentro al hueso, donde la pierna es más ancha (rodilla)
Z_PIERNA_ARRIBA = Z_TIRO + 1.0   # el tubo de la pierna acaba en la entrepierna; arriba, la cadera lo cubre todo
# Cadera y cintura (Oscar: "la parte de arriba... está demasiado despegada, debería estar pegada" y luego
# "cuidado de no dejar esas lonjas"): cada anillo es el contorno de lo que hay en su rebanada (envolvente
# convexa de la pelvis y los muslos, engordada con el aire y la tela; abajo, también lo que miden los tubos de
# las piernas) y, en cada dirección, el perfil de arriba abajo es la cuerda tensa sobre esos contornos (su
# envolvente cóncava en z): del ancho de la pelvis en la cintura baja recto hasta los muslos, sin el hombro
# que dejaba cerrar de golpe abajo de la pretina. El aire baja de HOLGURA a HOLGURA_CINTURA hacia la cintura
# (ahí la tela va con la pelvis: no hay que dejarle juego).
CINE = (63.0, 67.5)
HOLGURA_CINTURA = 0.45
CINTURA_ARRIBA = 1.5     # en la cintura, la rebanada mira también esto hacia arriba
TROCANTER_MAS = 0.6
TROCANTER_X = 14.0
TROCANTER_Z = (55.0, 66.0)
SUAVE_CENTRO = 6.0       # cm: qué tan suave sigue la línea de la pierna vista de lado


def anillos_pierna(pierna, z0, z1, paso=1.0, n=N_PIERNA):
    """(z, cx, cy, a, bf, bb, n) de la pierna izquierda: tubo recto que contiene a la espinilla y al fémur
    con HOLGURA donde más se acercan, más el grosor de la tela."""
    zs = [z0 + paso * k for k in range(int(round((z1 - z0) / paso)) + 1)]
    rebanadas = []
    for z in zs:
        s = [p for p in pierna if abs(p.z - z) < paso * 0.75]
        rebanadas.append(s if len(s) > 20 else rebanadas[-1])   # arriba del fémur sigue como la última
    cx = (min(p.x for s in rebanadas for p in s) + max(p.x for s in rebanadas for p in s)) / 2
    cy = suavizar([(min(p.y for p in s) + max(p.y for p in s)) / 2 for s in rebanadas], SUAVE_CENTRO / paso)
    pend = AFINA / (z1 - z0)
    ancho = recta_encima(zs, [max(abs(p.x - cx) for p in s) * 1.1 for s in rebanadas], pend)
    bf, bb = zip(*[fondo_necesario(s, cx, c, a, n) for s, c, a in zip(rebanadas, cy, ancho)])
    bf = recta_encima(zs, bf, pend); bb = recta_encima(zs, bb, pend)
    e = HOLGURA + GROSOR
    return [(z, cx, c, a + e, f + e, b + e, n) for z, c, a, f, b in zip(zs, cy, ancho, bf, bb)]


def cuerda_tensa(zs, rs):
    """Envolvente cóncava de los puntos (z, r): la cuerda tensa por encima, sin abultarse entre ellos."""
    pila = []
    for p in sorted(zip(zs, rs)):
        while len(pila) >= 2:
            (z1, r1), (z2, r2) = pila[-2], pila[-1]
            if (z2 - z1) * (p[1] - r1) - (r2 - r1) * (p[0] - z1) >= 0:
                pila.pop()
            else:
                break
        pila.append(p)
    out = []
    for z in zs:
        for (za, ra), (zb, rb) in zip(pila, pila[1:]):
            if za <= z <= zb:
                out.append(ra + (rb - ra) * (z - za) / (zb - za) if zb > za else max(ra, rb))
                break
        else:
            out.append(pila[0][1] if z <= pila[0][0] else pila[-1][1])
    return out


def anillos_cadera(pelvis, piernas, z0, z1, pl, paso=1.0):
    """Anillos (listas de puntos) alrededor de la pelvis y los muslos, centrados en x = 0, de z0 a z1.
    pl: los anillos de la pierna izquierda (los de la derecha, en espejo), para cubrir donde acaban."""
    zs = [z0 + paso * k for k in range(int(round((z1 - z0) / paso)) + 1)]
    ts = [smooth(CINE[0], CINE[1], z) for z in zs]
    es = [HOLGURA + (HOLGURA_CINTURA - HOLGURA) * t + GROSOR for t in ts]
    # el trocánter (lo de afuera de arriba del fémur) con más aire: en el idle, con las piernas abiertas, se
    # asomaba por el costado; va en el contorno (no inflando después) para que el costado siga recto
    pts = [Vector((abs(p.x), p.y, p.z)) for p in pelvis]
    pts += [Vector((abs(p.x) + (TROCANTER_MAS if abs(p.x) > TROCANTER_X and TROCANTER_Z[0] < p.z < TROCANTER_Z[1] else 0.0), p.y, p.z))
            for p in piernas]
    # la pelvis se abre arriba del corte y la orilla de arriba de la pretina (que sube sobre el corte) se le
    # metía: en la cintura la rebanada mira también CINTURA_ARRIBA cm hacia arriba
    rebanadas = [[p for p in pts if z - paso * 0.75 < p.z < z + paso * 0.75 + CINTURA_ARRIBA * t]
                 for z, t in zip(zs, ts)]
    cy = suavizar([(min(p.y for p in s) + max(p.y for p in s)) / 2 for s in rebanadas], 3.0)
    angs = [2 * math.pi * i / N_ANILLO for i in range(N_ANILLO)]
    radios = []
    for z, s, c, e in zip(zs, rebanadas, cy, es):
        centro = Vector((0.0, c))
        casco = casco_convexo([Vector((x, p.y)) for p in s for x in (p.x, -p.x)])
        r = [radio_ceñido(casco, centro, a, e) for a in angs]
        if z <= Z_PIERNA_ARRIBA:
            # donde acaban los tubos de las piernas, el anillo los cubre (si no, quedaba un escalón)
            (_, cx, cyp, a_, bf, bb, n) = min(pl, key=lambda q: abs(q[0] - z))
            izq = [Vector((p.x, p.y)) for p in anillo(cx, cyp, z, a_, bf, bb, n, N=128)]
            der = [Vector((-p.x, p.y)) for p in izq]
            r = [max(ri, radio_polar(izq, centro, a), radio_polar(der, centro, a)) for ri, a in zip(r, angs)]
        radios.append(r)
    for i in range(N_ANILLO):
        col = cuerda_tensa(zs, [r[i] for r in radios])
        for r, x in zip(radios, col):
            r[i] = x
    return [[Vector((math.cos(a) * ri, c + math.sin(a) * ri, z)) for a, ri in zip(angs, r)]
            for z, c, r in zip(zs, cy, radios)]


N_ANILLO = 64


def casco_convexo(pts):
    """Envolvente convexa 2D (cadena monótona), en orden antihorario."""
    p = sorted({(round(q.x, 3), round(q.y, 3)) for q in pts})
    if len(p) < 3:
        return [Vector(x) for x in p]
    def cruz(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    abajo, arriba = [], []
    for q in p:
        while len(abajo) >= 2 and cruz(abajo[-2], abajo[-1], q) <= 0:
            abajo.pop()
        abajo.append(q)
    for q in reversed(p):
        while len(arriba) >= 2 and cruz(arriba[-2], arriba[-1], q) <= 0:
            arriba.pop()
        arriba.append(q)
    return [Vector(x) for x in abajo[:-1] + arriba[:-1]]


def _dist_poligono(poly, q):
    """Distancia de q a un polígono convexo (0 si está adentro)."""
    n = len(poly)
    dentro = True; mejor = 1e9
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        ab = b - a
        if ab.x * (q.y - a.y) - ab.y * (q.x - a.x) < 0:
            dentro = False
        t = max(0.0, min(1.0, (q - a).dot(ab) / (ab.length_squared or 1e-9)))
        mejor = min(mejor, (a + ab * t - q).length)
    return 0.0 if dentro else mejor


def radio_ceñido(casco, centro, ang, e):
    """Hasta dónde llega, desde el centro y en ese ángulo, el contorno convexo engordado e."""
    u = Vector((math.cos(ang), math.sin(ang)))
    lo, hi = 0.0, 80.0
    for _ in range(30):
        m = (lo + hi) / 2
        if _dist_poligono(casco, centro + u * m) <= e:
            lo = m
        else:
            hi = m
    return lo


def radio_polar(poly, centro, ang):
    """Distancia del centro al borde de un polígono (estrellado desde el centro) en ese ángulo."""
    u = Vector((math.cos(ang), math.sin(ang)))
    mejor = 0.0
    for i in range(len(poly)):
        a, b = poly[i] - centro, poly[(i + 1) % len(poly)] - centro
        d = b - a
        den = u.x * d.y - u.y * d.x
        if abs(den) < 1e-12:
            continue
        t = (a.x * d.y - a.y * d.x) / den
        s = (a.x * u.y - a.y * u.x) / den
        if t > 0 and -1e-9 <= s <= 1 + 1e-9:
            mejor = max(mejor, t)
    return mejor


def proxy():
    pierna = puntos(PIERNA_L)
    pierna_r = puntos(PIERNA_R)
    pelvis = puntos(PELVIS)
    piernas = [p for p in pierna] + [Vector((-p.x, p.y, p.z)) for p in pierna_r]
    bm = bmesh.new()
    pl = anillos_pierna(pierna, Z_TUBO_FIN - 1.5, Z_PIERNA_ARRIBA)
    for s in (1, -1):
        tubo(bm, [anillo(cx * s, cy, z, a, bf, bb, n) for (z, cx, cy, a, bf, bb, n) in pl])
    ca = anillos_cadera(pelvis, piernas, Z_TIRO, Z_CINTURA + 3.0, pl)
    tubo(bm, ca)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto(P + "proxy", bm)
    return o, dict(pierna=pl, cadera=ca)


UNION = (55.0, 58.0, 61.0, 63.5)   # z donde la cadera y las piernas se redondean entre sí (sube, 1, 1, baja)


def unir(o, voxel=0.5, suave=6, suave_union=40):
    """Voxel remesh (une las piezas) y suavizado; en la unión de la cadera con las piernas, mucho más: la
    cadera (la pelvis es muy honda) queda como hombro sobre el muslo y así baja en curva, como pantalón."""
    activo(o)
    o.data.remesh_voxel_size = voxel
    o.data.use_remesh_fix_poles = True
    bpy.ops.object.voxel_remesh()
    m = o.modifiers.new("suave", 'SMOOTH'); m.factor = 0.5; m.iterations = suave
    bpy.ops.object.modifier_apply(modifier=m.name)
    g = o.vertex_groups.new(name=P + "union")
    a, b, c, d = UNION
    for v in o.data.vertices:
        w = smooth(a, b, v.co.z) * (1 - smooth(c, d, v.co.z))
        if w > 0:
            g.add([v.index], w, 'REPLACE')
    m = o.modifiers.new("union", 'SMOOTH'); m.factor = 0.9; m.iterations = suave_union
    m.vertex_group = g.name
    bpy.ops.object.modifier_apply(modifier=m.name)
    o.vertex_groups.clear()
    return o


# ---------------------------------------------------------------- roto de la rodilla

def _dientes():
    rnd = random.Random(ROTO["semilla"])
    n = ROTO["dientes"]
    return [(rnd.uniform(0.55, 1.0), rnd.uniform(-0.25, 0.25)) for _ in range(n)]


DIENTES = _dientes()


def radio_roto(phi):
    """Radio (en la elipse normalizada) de la orilla del roto en el ángulo phi: dientes de sierra irregulares."""
    n = ROTO["dientes"]
    t = (phi % (2 * math.pi)) / (2 * math.pi) * n
    i = int(t) % n
    alto, corre = DIENTES[i]
    u = (t - int(t)) + corre * 0.3
    tri = 1 - abs(2 * (u % 1.0) - 1)            # 0 en los valles, 1 en las puntas
    amp = ROTO["amp"] / ((ROTO["a"] + ROTO["b"]) / 2)
    return 1.0 + amp * (tri * alto - 0.5)


def en_roto(p, margen=0.0, dientes=True):
    """El punto (cara de enfrente de la rodilla) cae dentro del roto de su lado. dientes=False: dentro de
    lo más que llegan los dientes (para cortar y luego meter la orilla hasta el contorno)."""
    s = 1 if p.x > 0 else -1
    if p.y > -6.0:
        return False
    u = (p.x * s - ROTO["x"]) / (ROTO["a"] + margen)
    w = (p.z - ROTO["z"]) / (ROTO["b"] + margen)
    r = math.hypot(u, w)
    if r > 1.6:
        return False
    if not dientes:
        return r < 1.0 + 0.5 * ROTO["amp"] / ((ROTO["a"] + ROTO["b"]) / 2)
    return r < radio_roto(math.atan2(w, u))


def cortar(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=g, plane_co=(0, 0, Z_CINTURA), plane_no=(0, -TIRO_ATRAS, 1), clear_outer=True)
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=g, plane_co=(0, 0, Z_TUBO_FIN), plane_no=(0, 0, 1), clear_inner=True)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # si un vértice cae justo en el plano, el corte deja caras de área cero y QuadriFlow se cancela
    bmesh.ops.dissolve_degenerate(bm, dist=1e-3, edges=bm.edges[:])
    bm.to_mesh(o.data); bm.free(); o.data.update()


def bvh_de(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    t = BVHTree.FromBMesh(bm); bm.free()
    return t


def revisar_remallado(o, ref):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    volt = sum(1 for f in bm.faces if f.normal.dot(ref.find_nearest(f.calc_center_median())[1]) <= 0)
    lejos = max(ref.find_nearest(v.co)[3] for v in bm.verts)
    bm.free()
    return volt, lejos


def quadriflow(o, caras, intentos=8):
    """QuadriFlow con la orilla quieta y semillas distintas hasta que no voltee caras."""
    ref = o.data.copy(); ref.name = P + "qf_ref"
    ref_bvh = bvh_de(o)
    mejor = None; hechas = {ref.name}
    k = 0
    for k in range(intentos):
        o.data = ref.copy(); o.data.name = P + "qf_%d" % k
        activo(o)
        r = bpy.ops.object.quadriflow_remesh(target_faces=caras + 30 * (k % 3), use_preserve_sharp=False,
                                             use_preserve_boundary=True, smooth_normals=False,
                                             use_mesh_symmetry=True, seed=k)
        if 'FINISHED' not in r:
            raise RuntimeError("QuadriFlow se canceló (¿malla no manifold?)")
        hechas.add(o.data.name)
        volt, lejos = revisar_remallado(o, ref_bvh)
        if mejor is None or (volt, lejos) < mejor[0]:
            mejor = ((volt, lejos), o.data.name)
        if volt == 0 and lejos < 0.4:
            break
    o.data = bpy.data.meshes[mejor[1]]
    for n in hechas:
        me = bpy.data.meshes.get(n)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    return dict(intento=k, volteadas=mejor[0][0], lejos=round(mejor[0][1], 3))


def simetrizar_malla(o, umbral=0.02):
    activo(o)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.symmetrize(direction='POSITIVE_X', threshold=umbral)
    bpy.ops.mesh.remove_doubles(threshold=0.001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def cuerpo_dentro():
    """Puntos del cuerpo (reposo) que tienen que quedar adentro de los pantalones, con su holgura."""
    pts = puntos(PELVIS + PIERNA_L + PIERNA_R)
    out = []
    for p in pts:
        if p.z < Z_TUBO_FIN + 0.6 or p.z > z_cintura(p.y) - 0.6:
            continue
        if en_roto(p, margen=0.8):
            continue
        out.append(p)
    return out


# el frente del muslo abajo de la ingle: con la pierna adelante el fémur avanza más que la tela de la cadera
# (que va a medias con prop_cadera) y se asomaba hasta 0.6 cm corriendo
HOLGURA_INGLE = 1.1
INGLE_Z = (51.0, 62.0)


def holgura_de(p):
    if INGLE_Z[0] < p.z < INGLE_Z[1] and p.y < -3.0 and 5.0 < abs(p.x) < 19.0:
        return HOLGURA_INGLE
    return HOLGURA_MIN


def inflar(o, pts, radio=2.5, vueltas=12):
    """Empuja la superficie hacia afuera, con caída suave, donde un punto del cuerpo queda a menos de
    GROSOR + su holgura (holgura_de) de la cara de afuera (o afuera de ella). Regresa lo que faltaba al final."""
    falto = 0.0
    metas = [GROSOR + holgura_de(p) for p in pts]
    for vuelta in range(vueltas):
        bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update(); bm.verts.ensure_lookup_table()
        bvh = BVHTree.FromBMesh(bm)
        kd = KDTree(len(bm.verts))
        for v in bm.verts:
            kd.insert(v.co, v.index)
        kd.balance()
        empuje = [0.0] * len(bm.verts)
        falto = 0.0
        for p, meta in zip(pts, metas):
            loc, nrm, _, d = bvh.find_nearest(p)
            if loc is None:
                continue
            prof = d if (p - loc).dot(nrm) < 0 else -d
            deficit = meta - prof
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
        nuevo = {}
        for v in movidos:
            if v.is_boundary:
                continue
            nb = [e.other_vert(v).co for e in v.link_edges]
            nuevo[v] = v.co.lerp(sum(nb, Vector()) / len(nb), 0.4)
        for v, q in nuevo.items():
            v.co = q
        bm.to_mesh(o.data); bm.free(); o.data.update()
    return round(falto, 3)


def rotos(o, ref, vueltas=3):
    """Corta el roto de cada rodilla en la malla ya remallada (antes de QuadriFlow, aun con la orilla
    quieta, lo cerraba), parte en dos las aristas de su orilla (más puntos para los dientes), la lleva a su
    contorno en dientes proyectada sobre la superficie sin cortar y relaja el anillo de al lado."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    # se corta hasta lo más que llegan los dientes y la orilla se mete al contorno: moverla hacia afuera
    # pasaba sobre el anillo de al lado y volteaba caras
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if en_roto(f.calc_center_median(), dientes=False)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    def de_roto(e):
        c = (e.verts[0].co + e.verts[1].co) / 2
        return e.is_boundary and abs(c.z - ROTO["z"]) < ROTO["b"] + 2.5 and c.y < -4
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if de_roto(e)], cuts=1)
    bm.verts.ensure_lookup_table()
    orilla = [v for v in bm.verts if v.is_boundary and abs(v.co.z - ROTO["z"]) < ROTO["b"] + 2.5 and v.co.y < -4]
    movidos = 0
    antes = {v: v.co.copy() for v in orilla}
    for v in orilla:
        s = 1 if v.co.x > 0 else -1
        u = (v.co.x * s - ROTO["x"]) / ROTO["a"]; w = (v.co.z - ROTO["z"]) / ROTO["b"]
        phi = math.atan2(w, u)
        r = radio_roto(phi)
        x = (ROTO["x"] + math.cos(phi) * r * ROTO["a"]) * s
        z = ROTO["z"] + math.sin(phi) * r * ROTO["b"]
        hit = ref.ray_cast(Vector((x, -60.0, z)), Vector((0, 1, 0)))
        if hit[0] is not None:
            v.co = hit[0]; movidos += 1
    anillo2 = {e.other_vert(v) for v in orilla for e in v.link_edges if not e.other_vert(v).is_boundary}
    for _ in range(vueltas):
        nuevo = {}
        for v in anillo2:
            nb = [e.other_vert(v).co for e in v.link_edges]
            q = v.co.lerp(sum(nb, Vector()) / len(nb), 0.5)
            loc = ref.find_nearest(q)[0]
            nuevo[v] = loc if loc is not None else q
        for v, q in nuevo.items():
            v.co = q
    # si alguna cara quedó volteada (un diente pasó sobre el anillo de al lado), ese diente se regresa
    # hacia donde estaba y el anillo se relaja otra vez
    zona = {f for v in orilla for f in v.link_faces}
    zona |= {f for v in anillo2 for f in v.link_faces}
    volteadas = []
    for _ in range(12):
        bm.normal_update()
        volteadas = [f for f in zona if f.normal.dot(ref.find_nearest(f.calc_center_median())[1]) <= 0.2]
        if not volteadas:
            break
        for f in volteadas:
            for v in f.verts:
                if v in antes:
                    v.co = ref.find_nearest(v.co.lerp(antes[v], 0.35))[0]
                elif not v.is_boundary:
                    nb = [e.other_vert(v).co for e in v.link_edges]
                    v.co = ref.find_nearest(v.co.lerp(sum(nb, Vector()) / len(nb), 0.6))[0]
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return dict(orilla=movidos, volteadas=len(volteadas))


def tela_cruda():
    """Paso 1: la forma unida e inflada, sin cortar (queda como pnt_crudo; se usa de referencia)."""
    o, anillos = proxy()
    unir(o)
    info = {"falto": inflar(o, cuerpo_dentro())}
    borrar(P + "crudo")
    o.name = P + "crudo"; o.data.name = P + "crudo"
    o.hide_set(True); o.hide_render = True
    p = anillos["pierna"]
    info["pierna_arriba"] = [round(x, 2) for x in p[-1][1:6]]
    info["pierna_abajo"] = [round(x, 2) for x in p[0][1:6]]
    return info


def tela_remallada(caras=5000, intentos=3):
    """Paso 2: copia de pnt_crudo cortada y remallada con QuadriFlow (pnt_tela)."""
    crudo = bpy.data.objects[P + "crudo"]
    bm = bmesh.new(); bm.from_mesh(crudo.data)
    o = objeto(P + "tela", bm)
    cortar(o)
    return quadriflow(o, caras, intentos)


def tela_final():
    """Paso 3: simétrica, inflada otra vez y con la orilla de los rotos en dientes."""
    o = bpy.data.objects[P + "tela"]
    ref = bvh_de(bpy.data.objects[P + "crudo"])
    simetrizar_malla(o)
    pts = cuerpo_dentro()
    info = {"falto": inflar(o, pts, radio=2.0)}
    simetrizar_malla(o)
    info["orilla_roto"] = rotos(o, ref)
    info["falto_final"] = inflar(o, pts, radio=1.5, vueltas=4)
    info["caras"] = len(o.data.polygons)
    return info


# ---------------------------------------------------------------- materiales y grosor

# (nombre, color lineal, rugosidad). El metal con metalness 0 (en el sitio, con 1 y sin reflejo, sale negro).
MATERIALES = [
    ("Pantalones_Mezclilla", (0.16, 0.165, 0.175), 0.85),   # lleva la textura deslavada
    ("Pantalones_Forro", (0.43, 0.44, 0.45), 0.9),          # el revés de la mezclilla: adentro y los rollos
    ("Pantalones_Hilos", (0.86, 0.85, 0.80), 0.9),          # canto del roto e hilos atravesados
    ("Pantalones_Metal", (0.55, 0.56, 0.58), 0.35),         # botón y remaches
]
MEZCLILLA, FORRO, HILOS_MAT, METAL = range(4)


def materiales():
    out = []
    for nombre, color, rough in MATERIALES:
        m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = 0.0
        m.diffuse_color = (*color, 1); m.roughness = rough; m.metallic = 0.0
        out.append(m)
    return out


def preparar(o, material=None):
    """Los cuatro materiales en orden (así el join conserva los índices)."""
    mats = materiales()
    o.data.materials.clear()
    for m in mats:
        o.data.materials.append(m)
    for p in o.data.polygons:
        if material is not None:
            p.material_index = material
        p.use_smooth = True


def grosor(o):
    preparar(o, MEZCLILLA)
    activo(o)
    m = o.modifiers.new("grosor", 'SOLIDIFY')
    # sin even offset (en la chamarra disparaba vértices en los dobleces); hacia adentro: la forma es la
    # cara de afuera
    m.thickness = GROSOR; m.offset = -1.0; m.use_rim = True; m.use_even_offset = False
    m.use_quality_normals = True
    m.material_offset = FORRO; m.material_offset_rim = HILOS_MAT
    bpy.ops.object.modifier_apply(modifier=m.name)


class Superficie:
    """Triángulos de una malla (de ciertos materiales): para pegar piezas encima y sacar pesos."""
    def __init__(self, o, mats=None):
        me = o.data
        me.calc_loop_triangles()
        self.co = [v.co.copy() for v in me.vertices]
        self.tris = [tuple(t.vertices) for t in me.loop_triangles
                     if mats is None or me.polygons[t.polygon_index].material_index in mats]
        self.bvh = BVHTree.FromPolygons(self.co, self.tris)

    def cerca(self, p):
        from mathutils.geometry import barycentric_transform
        loc, _, i, d = self.bvh.find_nearest(p)
        a, b, c = self.tris[i]
        bar = barycentric_transform(loc, self.co[a], self.co[b], self.co[c],
                                    Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        w = [max(0.0, bar.x), max(0.0, bar.y), max(0.0, bar.z)]
        s = sum(w) or 1.0
        return loc, (a, b, c), [x / s for x in w]

    def rayo(self, origen, d, largo=200.0):
        return self.bvh.ray_cast(origen, d, largo)


def radio_en(sup, centro, d, z, z_min=None):
    """Distancia horizontal del centro (x, y) a la cara de afuera en la dirección d, a la altura z (si es
    más bajo que z_min, a z_min: ahí ya no hay tela)."""
    zz = z if z_min is None else max(z, z_min)
    hit = sup.rayo(Vector((centro.x, centro.y, zz)), Vector((d.x, d.y, 0.0)))
    if hit[0] is None:
        return None
    return (Vector((hit[0].x, hit[0].y)) - Vector((centro.x, centro.y))).length


def toro(bm, anillos):
    """Une anillos de puntos (cada uno un lazo cerrado) en un tubo cerrado en las dos direcciones."""
    filas = [[bm.verts.new(p) for p in r] for r in anillos]
    n = len(filas); m = len(filas[0])
    for i in range(n):
        f0, f1 = filas[i], filas[(i + 1) % n]
        for j in range(m):
            k = (j + 1) % m
            bm.faces.new((f0[j], f1[j], f1[k], f0[k]))


def perfil_redondo(d0, d1, z0, z1, n=4.0, pasos=14):
    """Lazo (d, z) de un rectángulo redondeado (superelipse)."""
    dc, zc = (d0 + d1) / 2, (z0 + z1) / 2
    hd, hz = (d1 - d0) / 2, (z1 - z0) / 2
    out = []
    for i in range(pasos):
        t = 2 * math.pi * i / pasos
        c, s = math.cos(t), math.sin(t)
        out.append((dc + hd * math.copysign(abs(c) ** (2 / n), c), zc + hz * math.copysign(abs(s) ** (2 / n), s)))
    return out


# ---------------------------------------------------------------- pretina, presillas, botón, remaches

ALTO_PRETINA = 3.6
PRETINA_SALE = 0.45      # lo que sale de la tela
PRETINA_ENTRA = 0.45     # su cara de adentro, metida en la tela (tapa el canto de arriba)
PRETINA_ARRIBA = 0.3     # lo que sube sobre el corte


def centro_cintura(o_tela):
    ys = [v.co.y for v in o_tela.data.vertices if v.co.z > Z_CINTURA - 2.5]
    return Vector((0.0, (min(ys) + max(ys)) / 2))


def z_arriba(sup, c, d):
    """Altura del corte de arriba en la dirección d (el corte va inclinado: más tiro atrás)."""
    hit = sup.rayo(Vector((c.x, c.y, Z_CINTURA - 2.0)), Vector((d.x, d.y, 0)))
    y = hit[0].y if hit[0] is not None else c.y
    return z_cintura(y)


def pretina(sup, c, N=96):
    bm = bmesh.new()
    perfil = perfil_redondo(-PRETINA_ENTRA, PRETINA_SALE, 0.0, ALTO_PRETINA, n=5.0, pasos=14)
    anillos = []
    for i in range(N):
        t = 2 * math.pi * i / N
        d = Vector((math.cos(t), math.sin(t), 0))
        zt = z_arriba(sup, c, d)
        zb = zt + PRETINA_ARRIBA - ALTO_PRETINA
        fila = []
        for (dd, hz) in perfil:
            z = zb + hz
            r = radio_en(sup, c, d, min(z, zt - 0.3))
            fila.append(Vector((c.x, c.y, 0)) + d * (r + dd) + Vector((0, 0, z)))
        anillos.append(fila)
    toro(bm, anillos)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto(P + "pretina", bm)
    preparar(o, MEZCLILLA)
    # UV: u la vuelta, v la altura en la pretina (franja V_PRETINA de la textura)
    me = o.data; m = len(perfil)
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        ii = [me.loops[li].vertex_index // m for li in poly.loop_indices]
        da_vuelta = 0 in ii and N - 1 in ii
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            i, j = vi // m, vi % m
            if da_vuelta and i == 0:
                i = N
            hz = min(max(perfil[j][1] / ALTO_PRETINA, 0.0), 1.0)
            uv.data[li].uv = (0.01 + 0.98 * i / N, V_PRETINA[0] + (V_PRETINA[1] - V_PRETINA[0]) * hz)
    return o


# presillas: (x, lado de y) donde van; cinco, como unos jeans
PRESILLAS = [(9.0, -1), (-9.0, -1), (10.5, 1), (-10.5, 1), (0.0, 1)]
# camino de la presilla (d desde la cara de afuera de la tela, h desde abajo de la pretina): cosida abajo
# en la tela, sube por fuera de la pretina y acaba sobre su orilla de afuera (doblada hacia adentro, con la
# cintura pegada, la cresta de la pelvis la atravesaba)
CAMINO_PRESILLA = [(-0.05, -1.3), (0.25, -1.0), (0.62, -0.35), (0.72, 0.4), (0.72, ALTO_PRETINA - 0.7),
                   (0.68, ALTO_PRETINA - 0.1), (0.55, ALTO_PRETINA + 0.15), (0.32, ALTO_PRETINA + 0.08)]


def direccion_a_x(sup, c, x, sy, z):
    """La dirección horizontal desde c que cae en la tela en esa x (del lado de y pedido)."""
    mejor = None
    for k in range(720):
        t = 2 * math.pi * k / 720
        d = Vector((math.cos(t), math.sin(t), 0))
        if d.y * sy <= 0:
            continue
        hit = sup.rayo(Vector((c.x, c.y, z)), d)
        if hit[0] is None:
            continue
        e = abs(hit[0].x - x)
        if mejor is None or e < mejor[0]:
            mejor = (e, d)
    return mejor[1]


def presillas(sup, c, ancho=1.0, grueso=0.2):
    bm = bmesh.new()
    for (x, sy) in PRESILLAS:
        d = direccion_a_x(sup, c, x, sy, Z_CINTURA - 2.0)
        lado = Vector((-d.y, d.x, 0))
        zt = z_arriba(sup, c, d)
        zb = zt + PRETINA_ARRIBA - ALTO_PRETINA
        pts = []
        for (dd, hz) in CAMINO_PRESILLA:
            z = zb + hz
            r = radio_en(sup, c, d, min(z, zt - 0.3))
            pts.append(Vector((c.x, c.y, 0)) + d * (r + dd) + Vector((0, 0, z)))
        filas = []
        for k, p in enumerate(pts):
            tg = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
            nn = tg.cross(lado).normalized()
            if nn.dot(d) < 0:
                nn = -nn
            filas.append([bm.verts.new(p + lado * sx * ancho / 2 + nn * sn * grueso / 2)
                          for sx, sn in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        for f0, f1 in zip(filas, filas[1:]):
            for j in range(4):
                k = (j + 1) % 4
                bm.faces.new((f0[j], f0[k], f1[k], f1[j]))
        bm.faces.new(list(reversed(filas[0]))); bm.faces.new(filas[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto(P + "presillas", bm)
    preparar(o, MEZCLILLA)
    uv_constante(o)
    return o


PERFIL_BOTON = [(0.0, 0.0), (0.92, 0.0), (0.98, 0.1), (0.95, 0.24), (0.78, 0.3), (0.55, 0.36), (0.0, 0.4)]
PERFIL_REMACHE = [(0.0, 0.0), (0.33, 0.0), (0.34, 0.08), (0.24, 0.16), (0.0, 0.19)]


def girado(bm, base, eje, perfil, lados=20, escala=1.0):
    q = eje.to_track_quat('Z', 'Y').to_matrix()
    anillos = []
    for (r, z) in perfil:
        if r == 0.0:
            anillos.append([bm.verts.new(base + q @ Vector((0, 0, z * escala)))])
            continue
        anillos.append([bm.verts.new(base + q @ Vector((r * escala * math.cos(2 * math.pi * i / lados),
                                                         r * escala * math.sin(2 * math.pi * i / lados), z * escala)))
                        for i in range(lados)])
    for a0, a1 in zip(anillos, anillos[1:]):
        for i in range(lados):
            j = (i + 1) % lados
            if len(a0) == 1:
                bm.faces.new((a0[0], a1[j], a1[i]))
            elif len(a1) == 1:
                bm.faces.new((a0[i], a0[j], a1[0]))
            else:
                bm.faces.new((a0[i], a0[j], a1[j], a1[i]))


def bolsa_delantera(sup, s, pasos=24):
    """Abertura de la bolsa de enfrente (lado s): de abajo de la pretina, a 8 cm del centro, en curva hasta
    la costura de afuera. Puntos sobre la tela (de la pretina hacia el costado)."""
    zb = Z_CINTURA - 0.55 - ALTO_PRETINA + PRETINA_ARRIBA - 0.6
    out = []
    for k in range(pasos + 1):
        ang = k / pasos * math.pi / 2
        x = (8.0 + (18.3 - 8.0) * math.sin(ang)) * s
        z = zb - 7.5 * (1 - math.cos(ang)) ** 1.2
        hit = sup.rayo(Vector((x, -60.0, z)), Vector((0, 1, 0)))
        if hit[0] is not None:
            out.append(hit[0])
    return out


def metales(sup, c):
    """Botón al frente de la pretina y remaches en las puntas de las bolsas de enfrente."""
    bm = bmesh.new()
    d = Vector((0, -1, 0))
    zt = z_arriba(sup, c, d)
    zm = zt + PRETINA_ARRIBA - ALTO_PRETINA * 0.5
    r = radio_en(sup, c, d, zm)
    base = Vector((c.x, c.y, zm)) + d * (r + PRETINA_SALE - 0.05)
    girado(bm, base, d, PERFIL_BOTON)
    for s in (1, -1):
        curva = bolsa_delantera(sup, s)
        for p in (curva[0], curva[-1]):
            n = Vector((p.x - c.x, p.y - c.y, 0)).normalized()
            girado(bm, p - n * 0.03, n, PERFIL_REMACHE, lados=12)
    o = objeto(P + "metales", bm)
    preparar(o, METAL)
    return o


# ---------------------------------------------------------------- rollos de la bastilla

def centro_pierna(sup, s, z):
    """Centro (x, y) de la pierna (lado s) a la altura z: punto medio de lo que mide la tela de lado."""
    zz = max(z, Z_TUBO_FIN + 0.3)
    x0 = 11.61 * s
    ys = []
    for dy in (-1, 1):
        hit = sup.rayo(Vector((x0, dy * 60.0, zz)), Vector((0, -dy, 0)))
        if hit[0] is not None:
            ys.append(hit[0].y)
    return Vector((x0, sum(ys) / len(ys) if ys else -4.0))


def rollos(sup, N=48):
    bm = bmesh.new()
    for s in (1, -1):
        for (z0, z1, sale) in ROLLOS:
            c = centro_pierna(sup, s, (z0 + z1) / 2)
            perfil = perfil_redondo(-0.2, sale, z0, z1, n=3.2, pasos=14)
            anillos = []
            for i in range(N):
                t = 2 * math.pi * i / N
                d = Vector((math.cos(t), math.sin(t), 0))
                fila = []
                for (dd, z) in perfil:
                    r = radio_en(sup, c, d, z, z_min=Z_TUBO_FIN + 0.25)
                    fila.append(Vector((c.x, c.y, 0)) + d * (r + dd) + Vector((0, 0, z)))
                anillos.append(fila)
            toro(bm, anillos)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto(P + "rollos", bm)
    preparar(o, FORRO)
    return o


# ---------------------------------------------------------------- hilos del roto

def orilla_x(z, s, lado):
    """x de la orilla del roto (lado s de Skulley) a la altura z, del lado 'lado' del roto (+1 afuera)."""
    w = (z - ROTO["z"]) / ROTO["b"]
    mejor = None
    for k in range(721):
        phi = -math.pi / 2 + math.pi * k / 720
        if lado < 0:
            phi = math.pi - phi
        r = radio_roto(phi)
        e = abs(math.sin(phi) * r - w)
        if mejor is None or e < mejor[0]:
            mejor = (e, math.cos(phi) * r)
    return (ROTO["x"] + mejor[1] * ROTO["a"]) * s


def hilos(sup_ref, radio=0.13, lados=6, pasos=16, metido=0.45):
    """Hilos blancos atravesados en cada roto, de orilla a orilla (metidos un poco en la tela), colgando un
    poco. Regresa el objeto y, por hilo, (primer vértice, filas, lados, punta a, punta b) para los pesos."""
    bm = bmesh.new()
    rnd = random.Random(3)
    puntas = []
    for s in (1, -1):
        for f in HILOS:
            z = ROTO["z"] + f * ROTO["b"]
            xa = orilla_x(z, s, -1) - metido * s
            xb = orilla_x(z, s, 1) + metido * s
            cuelga = 0.25 + 0.2 * rnd.random()
            fase = rnd.uniform(0, 6.28)
            pts = []
            for j in range(pasos + 1):
                t = j / pasos
                x = xa + (xb - xa) * t
                zz = z - cuelga * math.sin(math.pi * t) + 0.08 * math.sin(fase + 9 * t)
                hit = sup_ref.ray_cast(Vector((x, -60.0, zz)), Vector((0, 1, 0)))
                pts.append(hit[0] + Vector((0, 0.05, 0)))
            puntas.append((len(bm.verts), pasos + 1, lados, pts[0], pts[-1]))
            filas = []
            for j, p in enumerate(pts):
                tg = (pts[min(j + 1, pasos)] - pts[max(j - 1, 0)]).normalized()
                a = tg.cross(Vector((0, 1, 0))).normalized(); b = tg.cross(a).normalized()
                filas.append([bm.verts.new(p + (a * math.cos(2 * math.pi * i / lados) +
                                                b * math.sin(2 * math.pi * i / lados)) * radio)
                              for i in range(lados)])
            for f0, f1 in zip(filas, filas[1:]):
                for i in range(lados):
                    i2 = (i + 1) % lados
                    bm.faces.new((f0[i], f0[i2], f1[i2], f1[i]))
            bm.faces.new(list(reversed(filas[0]))); bm.faces.new(filas[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto(P + "hilos", bm)
    preparar(o, HILOS_MAT)
    return o, puntas


# ---------------------------------------------------------------- pesos

MUSLO = ("thigh_stretch", "thigh_twist", "thigh_twist_2")
MAX_HUESOS = 4


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
    copias = []
    for n in fuentes:
        src = bpy.data.objects[n]
        c = src.copy(); c.data = src.data.copy(); c.modifiers.clear()
        col_tmp().objects.link(c); copias.append(c)
    activo(copias[0])
    for c in copias:
        c.select_set(True)
    bpy.ops.object.join()
    cuerpo = copias[0]; cuerpo.name = P + "cuerpo_pesos"
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


def espejo_nombre(n):
    if n.endswith(".l"):
        return n[:-2] + ".r"
    if n.endswith(".r"):
        return n[:-2] + ".l"
    return n


def suavizar_pesos(o, pesos, vueltas, factor=0.5):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    vec = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
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


def a_cadera(d):
    """Donde se mezclan pelvis y muslo, la parte común pasa a prop_cadera (gira la mitad que el muslo, como
    en los bóxers): mezclar dos huesos que giran distinto aplasta la tela; el de en medio la lleva por la
    mitad del giro."""
    for lado in ("l", "r"):
        wt = sum(d.get(b + "." + lado, 0.0) for b in MUSLO)
        w1 = d.get("root.x", 0.0)
        m = min(w1, wt)
        if m < 0.01:
            continue
        d["root.x"] = w1 - m
        for b in MUSLO:
            k = b + "." + lado
            if k in d:
                d[k] -= m * d[k] / wt
        d["prop_cadera." + lado] = d.get("prop_cadera." + lado, 0.0) + 2 * m
    return limpiar({k: w for k, w in d.items() if w > 1e-4})


def simetria_pesos(o, pesos):
    """Lado derecho = el izquierdo espejeado (.l <-> .r); en la línea del centro, el promedio con su espejo."""
    co = [v.co.copy() for v in o.data.vertices]
    izq = [i for i, p in enumerate(co) if p.x >= -1e-4]
    kd = KDTree(len(izq))
    for i in izq:
        kd.insert(co[i], i)
    kd.balance()
    peor = 0.0
    nuevos = list(pesos)
    for i, p in enumerate(co):
        if p.x > 1e-3:
            continue
        _, j, dist = kd.find(Vector((-p.x, p.y, p.z)))
        peor = max(peor, dist)
        esp = {espejo_nombre(k): w for k, w in pesos[j].items()}
        if abs(p.x) <= 1e-3:
            nuevos[i] = limpiar({k: (pesos[i].get(k, 0.0) + esp.get(k, 0.0)) / 2 for k in set(pesos[i]) | set(esp)})
        else:
            nuevos[i] = esp
    return nuevos, peor


# Pesos: el tubo recto queda lejos del hueso, así que copiar la pieza del cuerpo más cercana engañaba (la
# pelvis le ganaba al fémur arriba del muslo), y las poses de Skulley son fuertes (el idle va agachado con las
# rodillas abiertas; caminando y corriendo la rodilla se dobla hasta 150°). Por eso la mezcla pelvis/pierna
# va por altura (CADERA_Z) y lo de cada lado se copia de su pieza: la pierna, de la espinilla y el fémur
# (así la rodilla se dobla como la del cuerpo, con la rótula yendo con la espinilla); la pelvis, de la pelvis
# (su parte de arriba también sigue a spine_01: con root.x sola la cresta se metía en la pretina corriendo).
# Arriba de z alto, pelvis; abajo de z bajo, pierna; en medio, lo común a prop_cadera (a_cadera). Lo de
# enfrente de la articulación (el vientre) tiene que quedarse con la pelvis: medido a lo largo del fémur, al
# subir la pierna se iba hacia atrás y la pelvis salía por enfrente. A los lados la cadera baja más (ahí la
# pelvis y la cabeza del fémur llegan más abajo).
CADERA_Z = (57.0, 63.0)
CADERA_LADO = 4.5
ENTREPIERNA_X = (4.0, 9.0)    # cm del centro: más cerca, la pelvis manda...
ENTREPIERNA_Z = (54.0, 57.5)  # ...desde esta altura


def _copiar(o, fuentes, quedarse):
    """Pesos de la pieza más cercana (solo 'fuentes'), por vértice, con los huesos que pasan 'quedarse'."""
    transferir(o, fuentes)
    out = []
    for p, d in zip(o.data.vertices, leer_pesos(o)):
        lado = "l" if p.co.x >= 0 else "r"
        out.append({k: w for k, w in d.items() if quedarse(k, lado)})
    return out


def pesar_tela(o, vueltas=2):
    H = ARM.data.bones["thigh_stretch.l"].head_local.copy()
    pierna = _copiar(o, PIERNA_L + PIERNA_R, lambda k, lado: k.startswith(("thigh_", "leg_")) and k.endswith("." + lado))
    pierna = suavizar_pesos(o, pierna, 4)
    pelvis = _copiar(o, PELVIS, lambda k, lado: k in ("root.x", "spine_01.x"))
    pelvis = suavizar_pesos(o, pelvis, 4)
    pesos = []
    for v, dp, dv in zip(o.data.vertices, pierna, pelvis):
        s = 1 if v.co.x >= 0 else -1
        lado = "l" if s > 0 else "r"
        p = Vector((v.co.x * s, v.co.y, v.co.z))
        r = Vector((p.x - H.x, p.y - H.y))
        lado_fuera = max(0.0, r.x / r.length) if r.length > 1e-6 else 0.0
        t_h = 1 - smooth(CADERA_Z[0] + CADERA_LADO * lado_fuera, CADERA_Z[1] + CADERA_LADO * lado_fuera, p.z)
        # la entrepierna (junto al centro, arriba del tiro) con la pelvis: con la rodilla en el pecho el
        # muslo la jalaba y el pubis se asomaba
        t_h *= 1 - (1 - smooth(ENTREPIERNA_X[0], ENTREPIERNA_X[1], p.x)) * smooth(ENTREPIERNA_Z[0], ENTREPIERNA_Z[1], p.z)
        dp = dp or {"thigh_stretch." + lado: 1.0}
        dv = dv or {"root.x": 1.0}
        d = {}
        for k, x in dv.items():
            d[k] = d.get(k, 0.0) + (1 - t_h) * x
        for k, x in dp.items():
            d[k] = d.get(k, 0.0) + t_h * x
        pesos.append(limpiar({k: x for k, x in d.items() if x > 1e-4}))
    pesos = suavizar_pesos(o, pesos, vueltas)
    pesos = [a_cadera(d) for d in pesos]
    pesos, peor = simetria_pesos(o, pesos)
    escribir_pesos(o, pesos)
    return dict(huesos=sorted({k for d in pesos for k in d}), sin_peso=sum(1 for d in pesos if not d),
                espejo=round(peor, 4))


def pesos_de_tela(o_tela):
    """Función p -> pesos de la cara de afuera de la tela bajo p (interpolados en su triángulo)."""
    sup = Superficie(o_tela, mats=(MEZCLILLA,))
    pt = leer_pesos(o_tela)
    def f(p):
        _, tri, w = sup.cerca(p)
        acc = {}
        for i, wi in zip(tri, w):
            for k, x in pt[i].items():
                acc[k] = acc.get(k, 0.0) + wi * x
        return limpiar(acc)
    return f


def islas(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    vistos = set(); out = []
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
        out.append(isla)
    bm.free()
    return out


def pesar_pieza(o, de_tela, rigida=False, z_fija=None):
    """Cada vértice con el peso de la tela bajo él; las piezas rígidas (botón, remaches), cada una entera con
    el de la tela bajo su centro (si no, se deforman). z_fija: el peso de la tela a esa altura, en la misma
    dirección (los rollos, con el de abajo de la pierna: ya cerca de la rodilla, arriba la tela lleva algo de
    muslo y el rollo se doblaba con ella)."""
    co = [v.co.copy() for v in o.data.vertices]
    if z_fija is not None:
        co = [Vector((p.x, p.y, z_fija)) for p in co]
    if not rigida:
        escribir_pesos(o, [de_tela(p) for p in co])
        return
    pesos = [None] * len(co)
    for isla in islas(o):
        c = sum((co[i] for i in isla), Vector()) / len(isla)
        d = de_tela(c)
        for i in isla:
            pesos[i] = d
    escribir_pesos(o, pesos)


def pesar_hilos(o, puntas, de_tela):
    """Cada hilo pasa de los pesos de una punta a los de la otra."""
    pesos = [{} for _ in o.data.vertices]
    for (i0, filas, lados, a, b) in puntas:
        wa, wb = de_tela(a), de_tela(b)
        for j in range(filas):
            t = j / max(filas - 1, 1)
            d = limpiar({k: wa.get(k, 0.0) * (1 - t) + wb.get(k, 0.0) * t for k in set(wa) | set(wb)})
            for i in range(lados):
                pesos[i0 + j * lados + i] = d
    escribir_pesos(o, pesos)


# ---------------------------------------------------------------- UV y textura deslavada

TEX_N = 1024
NOMBRE_TEX = "Pantalones_Mezclilla_tex"
V_PIERNA = (0.0, 0.86)       # franja de las piernas en la textura (v); la izquierda en u 0-0.5, la derecha 0.5-1
Z_UV = (Z_TUBO_FIN - 0.8, 75.5)
F_MAX = 1.1                  # cada pierna cubre una vuelta y 10 % más (las caras que cruzan la costura de adentro)
V_PRETINA = (0.885, 0.975)
V_LISO = (0.982, 1.0)        # mezclilla lisa (presillas y lo que no lleva textura)
UV_LISO = (0.5, 0.991)


def uv_constante(o, uv=UV_LISO):
    me = o.data
    capa = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for d in capa.data:
        d.uv = uv


def ejes_pierna():
    """(z, cy) del centro de la pierna izquierda (de la forma, en reposo) y su x."""
    pl = anillos_pierna(puntos(PIERNA_L), Z_TUBO_FIN - 1.5, Z_PIERNA_ARRIBA)
    return [(r[0], r[2]) for r in pl], pl[0][1]


def _cy(ejes, z):
    if z <= ejes[0][0]:
        return ejes[0][1]
    for (za, ya), (zb, yb) in zip(ejes, ejes[1:]):
        if za <= z <= zb:
            return ya + (yb - ya) * (z - za) / (zb - za)
    return ejes[-1][1]


def fz(p, ejes, cx, s):
    """(f, z): f = vuelta alrededor del eje de la pierna del lado s (0 costura de adentro, 0.25 enfrente,
    0.5 costura de afuera, 0.75 atrás); la derecha espejeada, así las dos leen igual."""
    dx = p.x * s - cx
    dy = p.y - _cy(ejes, p.z)
    th = math.degrees(math.atan2(dy, dx))
    return ((th - 180.0) % 360.0) / 360.0, p.z


def uv_pierna(f, z, s):
    u0 = 0.0 if s > 0 else 0.5
    u = u0 + 0.5 * min(max(f, 0.0), F_MAX) / F_MAX
    v = V_PIERNA[0] + (V_PIERNA[1] - V_PIERNA[0]) * (z - Z_UV[0]) / (Z_UV[1] - Z_UV[0])
    return (u0 + 0.002 + (u - u0) * 0.996), min(max(v, 0.0), V_PIERNA[1])


def uv_tela(o, ejes, cx):
    """Cara de afuera: (f, z) de su pierna (en la cadera, la mitad de cada lado sigue a su pierna); lo
    demás (adentro, canto) a lo liso."""
    me = o.data
    uv = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        lis = list(poly.loop_indices)
        if poly.material_index != MEZCLILLA:
            for li in lis:
                uv.data[li].uv = UV_LISO
            continue
        s = 1 if poly.center.x >= 0 else -1
        fs = [fz(me.vertices[me.loops[li].vertex_index].co, ejes, cx, s) for li in lis]
        vals = [f for f, _ in fs]
        if max(vals) - min(vals) > 0.5:
            vals = [f + 1.0 if f < 0.5 else f for f in vals]
        for li, f, (_, z) in zip(lis, vals, fs):
            uv.data[li].uv = uv_pierna(f, z, s)


def _a_pixel(f, z, s):
    u, v = uv_pierna(f, z, s)
    return u * TEX_N - 0.5, v * TEX_N - 0.5


def sobre_tela(sup, x, z, atras=False):
    """Punto de la cara de afuera visto de frente (o de atrás) en (x, z)."""
    dy = 1 if not atras else -1
    hit = sup.rayo(Vector((x, -60.0 * dy, z)), Vector((0, dy, 0)))
    return hit[0]


def marcas_textura(sup, ref, ejes, cx):
    """Costuras y orillas en (u, v) de pixel. Las curvas se ponen en 3D sobre la tela y se pasan con el
    mismo mapeo que los UV, así caen donde van."""
    out = dict(costura=[], pespunte=[], roto=[])
    def a_px(pts, s):
        res = []
        for p in pts:
            if p is None:
                continue
            f, z = fz(p, ejes, cx, s)
            res.append(_a_pixel(f, z, s))
        return res
    for s in (1, -1):
        zt_f = z_cintura(-16.0); zt_a = z_cintura(16.0)
        zb_f = zt_f + PRETINA_ARRIBA - ALTO_PRETINA
        zb_a = zt_a + PRETINA_ARRIBA - ALTO_PRETINA
        # bolsa de enfrente
        bolsa = bolsa_delantera(sup, s)
        out["costura"].append(a_px(bolsa, s))
        out["pespunte"].append(a_px([p + (Vector((0, 0, -0.55))) for p in bolsa], s))
        # centro de enfrente y de atrás (costura) y la bragueta (pespunte en J, del lado izquierdo)
        out["costura"].append(a_px([sobre_tela(sup, 0.2 * s, z) for z in [Z_TIRO + 0.6 + k * 0.5 for k in range(int((zb_f - Z_TIRO) / 0.5))]], s))
        out["costura"].append(a_px([sobre_tela(sup, 0.2 * s, z, True) for z in [Z_TIRO + 0.6 + k * 0.5 for k in range(int((zb_a - Z_TIRO) / 0.5))]], s))
        if s > 0:
            j = [sobre_tela(sup, 3.3, z) for z in [zb_f - k * 0.5 for k in range(int((zb_f - 63.0) / 0.5))]]
            for k in range(13):
                a = k / 12 * math.pi / 2
                j.append(sobre_tela(sup, 0.5 + 2.8 * math.cos(a), 63.0 - 2.8 * math.sin(a)))
            out["pespunte"].append(a_px(j, s))
        # canesú (la V de atrás) y la bolsa de atrás (pentágono)
        out["costura"].append(a_px([sobre_tela(sup, (18.0 - 17.8 * t) * s, 67.4 - 3.0 * t, True) for t in [k / 30 for k in range(31)]], s))
        bolsa_a = [(4.6, 63.6), (14.6, 64.2), (14.0, 57.4), (9.4, 55.9), (5.0, 57.4), (4.6, 63.6)]
        pts = []
        for (x0, z0), (x1, z1) in zip(bolsa_a, bolsa_a[1:]):
            for t in [k / 10 for k in range(10)]:
                pts.append(sobre_tela(sup, (x0 + (x1 - x0) * t) * s, z0 + (z1 - z0) * t, True))
        pts.append(pts[0])
        out["costura"].append(a_px(pts, s))
        # arco de adorno en la bolsa de atrás
        arco = [sobre_tela(sup, (5.6 + 8.2 * t) * s, 60.6 + 1.6 * math.sin(math.pi * t) - 0.6 * t, True) for t in [k / 20 for k in range(21)]]
        out["pespunte"].append(a_px(arco, s))
        # orilla del roto
        roto = []
        for k in range(97):
            phi = 2 * math.pi * k / 96
            r = radio_roto(phi)
            x = (ROTO["x"] + math.cos(phi) * r * ROTO["a"]) * s
            z = ROTO["z"] + math.sin(phi) * r * ROTO["b"]
            hit = ref.ray_cast(Vector((x, -60.0, z)), Vector((0, 1, 0)))
            roto.append(hit[0])
        out["roto"].append(a_px(roto, s))
    return out


def _srgb(c):
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


# colores en sRGB (lo que guarda la imagen)
GRIS = (0.40, 0.41, 0.43)        # la mezclilla
# Plana (Oscar, 2026-11-18: "se ve muy sucia... más flat o sin el deslavado"): un gris parejo con las
# costuras, los pespuntes y las bolsas, sin deslavado, manchas, bigotes, sarga ni grano, y sin el
# deshilachado difuso alrededor del roto (el canto blanco y los hilos ya lo dicen). False: la deslavada.
TEXTURA_PLANA = True
GRIS_PLANO = (0.45, 0.46, 0.48)
DESLAVADO = (0.70, 0.71, 0.72)   # lo deslavado (muslos, rodillas, asentaderas)
OSCURO = (0.27, 0.28, 0.30)      # costuras y orillas
PESPUNTE = (0.84, 0.84, 0.82)    # hilo de las costuras
DESHILADO = (0.93, 0.93, 0.91)   # alrededor del roto


def textura(marcas, semilla=11):
    """Mezclilla gris: costuras de adentro y de afuera con pespunte, bolsas, bragueta y canesú; con
    TEXTURA_PLANA en False, además sarga en diagonal, deslavado en el frente de los muslos, las rodillas y las
    asentaderas (con manchas), bigotes en la entrepierna y lo deshilachado alrededor de los rotos. Empacada en
    el .blend."""
    import numpy as np
    rng = np.random.default_rng(semilla)
    N = TEX_N
    W = N // 2
    img = np.zeros((N, N, 3), np.float32)

    def ruido(alto, ancho, escala):
        g = rng.random((alto // escala + 3, ancho // escala + 3)).astype(np.float32)
        yy = np.linspace(0, g.shape[0] - 2.001, alto); xx = np.linspace(0, g.shape[1] - 2.001, ancho)
        y0 = yy.astype(int); x0 = xx.astype(int); fy = (yy - y0)[:, None]; fx = (xx - x0)[None, :]
        fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        a = g[y0][:, x0]; b = g[y0][:, x0 + 1]; c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

    def campana(z, a, b, c, d):
        return np.clip((z - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((z - a) / (b - a), 0, 1)) * \
            (1 - np.clip((z - c) / (d - c), 0, 1) ** 2 * (3 - 2 * np.clip((z - c) / (d - c), 0, 1)))

    v = (np.arange(N) + 0.5) / N
    Z = Z_UV[0] + (v - V_PIERNA[0]) / (V_PIERNA[1] - V_PIERNA[0]) * (Z_UV[1] - Z_UV[0])
    F = (np.arange(W) + 0.5) / W * F_MAX
    FF, ZZ = np.meshgrid(F, Z)
    fp = FF % 1.0
    # vuelta en cm (aprox.): ~48 en la pierna, ~70 en la cadera
    C = 48 + 22 * campana(ZZ, 56, 63, 200, 201)
    xcm = fp * C
    frente = np.cos(2 * np.pi * (fp - 0.25))
    for lado, u0 in ((1, 0), (-1, W)):
        manchas = 0.75 + 0.5 * ruido(N, W, 24) * (0.6 + 0.4 * ruido(N, W, 7))
        w = (0.85 * np.clip(frente, 0, 1) ** 1.2 * campana(ZZ, 42, 49, 60, 64)
             + 0.95 * np.clip(frente, 0, 1) ** 1.4 * campana(ZZ, 31, 35.5, 42.5, 47)
             + 0.7 * np.clip(-frente, 0, 1) ** 1.3 * campana(ZZ, 54, 58.5, 65, 68.5)
             + 0.35 * np.clip(frente, 0, 1) * campana(ZZ, 23, 25, 30, 33))
        w = np.clip(w * manchas, 0, 1)
        # bigotes: rayas claras cortas y algo inclinadas en el frente de la entrepierna
        for k in range(5):
            zc = 54.5 + k * 1.15 + rng.uniform(-0.2, 0.2)
            f0 = 0.17 + rng.uniform(-0.02, 0.02)
            incl = rng.uniform(0.6, 1.4)
            d = (ZZ - zc - (fp - f0) * C * 0.18 * incl)
            largo = np.clip(1 - np.abs(fp - (f0 + 0.08)) / 0.09, 0, 1)
            w = np.maximum(w, 0.75 * np.exp(-(d / 0.22) ** 2) * largo * campana(ZZ, 52, 54, 60, 61.5))
        # orillas de las costuras más oscuras, y un poco los costados
        lejos = np.minimum(np.abs(fp - 0.5), np.minimum(fp, 1 - fp)) * C
        w = w * np.clip(lejos / 2.5, 0.35, 1)
        if TEXTURA_PLANA:
            base = np.ones((N, W, 1), np.float32) * np.array(GRIS_PLANO, np.float32)
        else:
            base = np.array(GRIS) * (1 - w[..., None]) + np.array(DESLAVADO) * w[..., None]
            # sarga en diagonal y grano
            sarga = 0.035 * np.sin(2 * np.pi * (xcm + ZZ) / 0.32) + 0.03 * (ruido(N, W, 2) - 0.5)
            base = base * (1 + sarga[..., None])
        # costuras de adentro y de afuera: línea oscura y pespunte doble a un lado
        for fc in (0.0, 0.5, 1.0):
            dcm = (fp - fc) * C
            base = base * (1 - 0.45 * np.exp(-(dcm / 0.12) ** 2)[..., None])
            for off in (0.35, 0.62):
                linea = np.exp(-((dcm - off) / 0.07) ** 2) * (((ZZ / 0.42) % 1.0) < 0.62)
                base = base * (1 - linea[..., None]) + np.array(PESPUNTE) * linea[..., None]
        img[:, u0:u0 + W] = base

    yy, xx = np.mgrid[0:N, 0:N]
    pxcm = W / (F_MAX * 48.0)       # pixeles por cm (en la pierna)

    def trazo(pts, ancho, color, guiones=None, fuerza=1.0):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            m = int(ancho + 3)
            xa, xb = int(max(min(x0, x1) - m, 0)), int(min(max(x0, x1) + m + 1, N))
            ya, yb = int(max(min(y0, y1) - m, 0)), int(min(max(y0, y1) + m + 1, N))
            if xa >= xb or ya >= yb:
                continue
            X = xx[ya:yb, xa:xb] + 0.0; Y = yy[ya:yb, xa:xb] + 0.0
            dx, dy = x1 - x0, y1 - y0
            L2 = dx * dx + dy * dy or 1e-9
            t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
            d = np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy))
            a = np.clip(ancho / 2 + 0.5 - d, 0, 1) * fuerza
            if guiones:
                s = (np.hypot(X - x0, Y - y0) / pxcm) % guiones[0]
                a = a * (s < guiones[0] * guiones[1])
            reg = img[ya:yb, xa:xb]
            reg[:] = reg * (1 - a[..., None]) + np.array(color) * a[..., None]

    for pts in marcas["costura"]:
        trazo(pts, 1.6, OSCURO, fuerza=0.7)
        trazo([(x + 0.0, y - 0.45 * pxcm) for x, y in pts], 1.2, PESPUNTE, guiones=(0.42, 0.62), fuerza=0.9)
    for pts in marcas["pespunte"]:
        trazo(pts, 1.2, PESPUNTE, guiones=(0.42, 0.62), fuerza=0.9)
    # alrededor del roto: deshilachado blanco que se va perdiendo, con grano
    fibra = ruido(N, N, 3)
    for pts in ([] if TEXTURA_PLANA else marcas["roto"]):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        m = int(2.0 * pxcm) + 2
        xa, xb = int(max(min(xs) - m, 0)), int(min(max(xs) + m, N)); ya, yb = int(max(min(ys) - m, 0)), int(min(max(ys) + m, N))
        X = xx[ya:yb, xa:xb] + 0.0; Y = yy[ya:yb, xa:xb] + 0.0
        dmin = np.full(X.shape, 1e9, np.float32)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            dx, dy = x1 - x0, y1 - y0
            L2 = dx * dx + dy * dy or 1e-9
            t = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
            dmin = np.minimum(dmin, np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy)))
        dcm = dmin / pxcm
        a = np.clip(1.25 - dcm / 1.1, 0, 1) ** 1.5 * (0.55 + 0.6 * fibra[ya:yb, xa:xb])
        # hilitos horizontales sueltos (el roto es de trama: quedan hilos blancos atravesados)
        rayas = (np.sin(Y / (0.28 * pxcm) * np.pi) > 0.55) * np.clip(1.6 - dcm / 1.0, 0, 1) * 0.5
        a = np.clip(np.maximum(a, rayas * fibra[ya:yb, xa:xb]), 0, 1)
        reg = img[ya:yb, xa:xb]
        reg[:] = reg * (1 - a[..., None]) + np.array(DESHILADO) * a[..., None]

    # pretina: un poco más oscura, con dos pespuntes
    r0, r1 = int(V_PRETINA[0] * N), int(V_PRETINA[1] * N) + 1
    hz = (np.arange(r0, r1) + 0.5) / N
    hz = (hz - V_PRETINA[0]) / (V_PRETINA[1] - V_PRETINA[0])
    UU = np.arange(N)[None, :] + 0.0
    if TEXTURA_PLANA:
        banda = np.array(GRIS_PLANO, np.float32) * 0.94 * np.ones((r1 - r0, N, 1), np.float32)
    else:
        banda = np.array(GRIS) * 0.92 * (1 + 0.03 * np.sin(2 * np.pi * (UU / 3.1 + hz[:, None] * 12)))[..., None]
        banda = banda * np.ones((r1 - r0, N, 1), np.float32)
    for h in (0.14, 0.86):
        linea = np.exp(-((hz[:, None] - h) / 0.022) ** 2) * (((UU / 4.4) % 1.0) < 0.62)
        banda = banda * (1 - linea[..., None]) + np.array(PESPUNTE) * linea[..., None]
    img[r0:r1] = banda
    # liso (presillas)
    l0 = int(V_LISO[0] * N)
    img[l0:] = np.array(GRIS_PLANO if TEXTURA_PLANA else GRIS) * 0.95

    img = np.clip(img, 0, 1)
    rgba = np.ones((N, N, 4), np.float32); rgba[..., :3] = img
    im = bpy.data.images.get(NOMBRE_TEX)
    if im and tuple(im.size) != (N, N):
        bpy.data.images.remove(im); im = None
    im = im or bpy.data.images.new(NOMBRE_TEX, N, N, alpha=False)
    im.pixels.foreach_set(rgba.ravel())
    im.update(); im.pack()
    m = bpy.data.materials["Pantalones_Mezclilla"]
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tx = nt.nodes.get("Textura") or nt.nodes.new("ShaderNodeTexImage")
    tx.name = tx.label = "Textura"
    tx.image = im; tx.extension = 'EXTEND'; tx.interpolation = 'Linear'
    tx.location = (bsdf.location.x - 320, bsdf.location.y)
    nt.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"])
    return im


# ---------------------------------------------------------------- armado

def montar(piezas):
    """Junta las piezas en Pantalones, hijo del armature con su modificador, en la colección de los props."""
    o = piezas[0]
    activo(o)
    for x in piezas[1:]:
        x.select_set(True)
    bpy.ops.object.join()
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


def limpiar_tmp():
    c = bpy.data.collections.get(TMP)
    if c:
        for o in list(c.objects):
            borrar(o.name)
        bpy.data.collections.remove(c)
    for me in list(bpy.data.meshes):
        if me.users == 0 and me.name.startswith(P):
            bpy.data.meshes.remove(me)


def _al_terminar():
    vl = bpy.context.view_layer
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for x in vl.objects:
        x.select_set(False)
    vl.objects.active = ARM; ARM.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')


def forma(caras=5000, intentos=6):
    """Pasos 1 a 3 (la tela sin grosor): pnt_crudo (referencia) y pnt_tela."""
    ad = ARM.animation_data
    if ad and ad.action is None:
        reposo()
    info = {"cruda": tela_cruda(), "quadriflow": tela_remallada(caras, intentos), "final": tela_final()}
    _al_terminar()
    return info


def armar():
    """Paso 4: grosor, pesos, piezas, UV, textura y el objeto Pantalones."""
    ad = ARM.animation_data
    if ad and ad.action is None:
        reposo()
    base = bpy.data.objects[P + "tela"]           # se copia: así armar() se puede repetir sin rehacer la forma
    bm = bmesh.new(); bm.from_mesh(base.data)
    o = objeto(P + "tela_armada", bm)
    sup = Superficie(o)                       # la cara de afuera, antes del grosor
    ref = bvh_de(bpy.data.objects[P + "crudo"])
    c = centro_cintura(o)
    grosor(o)
    info = {"pesos": pesar_tela(o)}
    de_tela = pesos_de_tela(o)
    ejes, cx = ejes_pierna()
    uv_tela(o, ejes, cx)
    piezas = [o]
    for hacer, rigida, z_fija in ((lambda: pretina(sup, c), False, None), (lambda: presillas(sup, c), False, None),
                                  (lambda: metales(sup, c), True, None),
                                  (lambda: rollos(sup), False, Z_TUBO_FIN + 0.4)):
        x = hacer()
        if not x.data.uv_layers:
            uv_constante(x)
        pesar_pieza(x, de_tela, rigida, z_fija)
        piezas.append(x)
    hi, puntas = hilos(ref)
    uv_constante(hi)
    pesar_hilos(hi, puntas, de_tela)
    piezas.append(hi)
    textura(marcas_textura(sup, ref, ejes, cx))
    p = montar(piezas)
    me = p.data
    me.calc_loop_triangles()
    info["triangulos"] = len(me.loop_triangles)
    info["vertices"] = len(me.vertices)
    info["huesos"] = sorted(g.name for g in p.vertex_groups)
    _al_terminar()
    return info


def todo():
    info = {"forma": forma(), "armado": armar()}
    limpiar_tmp()
    _al_terminar()
    return bpy.data.objects[NOMBRE], info
