"""
La guitarra del solo de Skulley (Oscar, 2026-11-23: "¿y si le ponemos una guitarra de verdad?"; escogió una
Flying V, en azul). Procedural y en el toon del sitio: cuerpo en V biselado con el canto más claro, golpeador
negro, dos pastillas, puente y cordal, tres perillas y el selector, mástil con diapasón, trastes y puntos,
cejuela, clavijero en flecha con seis clavijas y seis cuerdas.

Se corre en Blender sobre Character/SkulleyRad.blend:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); g = ns["modelar"]()
El origen de la guitarra es el punto donde se rasguea (entre las pastillas, en el plano de las cuerdas): X va por
el mástil hacia el clavijero, Y cruza las cuerdas (hacia el ala de arriba) y Z sale de la tapa. En cm, como el
armature. `colocar(G)` la cuelga del hueso del pecho (spine_03.x) con G = dónde va en el espacio del armature en la
pose de ese momento; así la sigue en cualquier pose. idles.py (el solo) la coloca y le pone las manos encima.
Se exporta con exportar_animaciones.exportar_prop("Guitarra") a public/props/guitarra.glb.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

NOMBRE = "Guitarra"
HUESO = "spine_03.x"
# todo se arma a la medida de abajo y al final se escala (Oscar, 2026-11-23: "está muy chica, hazla más grande");
# lo que se mide sobre ella (traste_x) ya sale escalado
ESCALA = 1.5
L_ESCALA = 56.0                 # de la cejuela al puente (cm)
CEJUELA = 47.5                  # x de la cejuela
PUENTE = CEJUELA - L_ESCALA     # -8.5
TAPA_Z = -1.4                   # la cara del cuerpo (las cuerdas van en z = 0)
FONDO_Z = -5.0                  # la espalda
DIAP_Z = -0.55                  # la cara del diapasón
MATS = {  # colores para verla en Blender; el sitio pone los suyos por nombre (accesorios.js)
    "Guitarra_Cuerpo": (0.10, 0.36, 1.0, 1),
    "Guitarra_Canto": (0.45, 0.72, 1.0, 1),
    "Guitarra_Negro": (0.02, 0.02, 0.02, 1),
    "Guitarra_Madera": (0.33, 0.16, 0.07, 1),
    "Guitarra_Diapason": (0.11, 0.05, 0.03, 1),
    "Guitarra_Metal": (0.68, 0.71, 0.75, 1),
    "Guitarra_Blanco": (0.92, 0.9, 0.85, 1),
}
NOMBRES = list(MATS)
# El ala de arriba (la de abajo es su espejo): el canto de afuera recto desde el mástil hasta la punta, la punta
# apenas redondeada (Oscar: "las flying V terminan en puntas, no cuadradas") y el canto de adentro RECTO hasta la
# muesca (con un quiebre a medio canto se veía "mordida")
_ALA = [(16.5, 3.4), (-38.04, 16.65), (-39.3, 16.85), (-38.3, 16.1)]
CUERPO = [(18.2, -1.8), (18.2, 1.8)] + _ALA + [(-15.0, 0.0)] + [(x, -y) for x, y in reversed(_ALA)]
# (ya no se usa: Oscar lo quitó) cubría el ala de abajo por dentro
GOLPEADOR = [(14.0, -2.4), (14.4, 2.2), (-11.0, 2.2), (-14.6, 0.4), (-16.6, -2.3), (-27.0, -8.4), (-32.4, -12.5),
             (-31.0, -13.3), (10.0, -3.4)]
# el clavijero en flecha: se abre después de la cejuela y sus cantos rectos se juntan en la punta
CLAVIJERO = [(47.6, -2.25), (50.5, -4.6), (63.4, -0.9), (64.4, 0.0), (63.4, 0.9), (50.5, 4.6), (47.6, 2.25)]
PASTILLAS = (-4.6, 5.8)
PERILLAS = ((-21.0, -7.9), (-25.0, -9.7), (-28.6, -11.1))
SELECTOR = (-19.0, 9.0)
CLAVIJAS_X = (52.2, 55.8, 59.4)


def _mi(nombre):
    return NOMBRES.index(nombre)


def ancho_mastil(x):
    """5.6 cm junto al cuerpo, 4.5 en la cejuela."""
    t = max(0.0, min(1.0, (x - 13.0) / (CEJUELA - 13.0)))
    return 5.6 + (4.5 - 5.6) * t


def _area(pts):
    return 0.5 * sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))


def placa(bm, pts, z0, z1, mat_cara, mat_canto, bisel=0.0, segs=3):
    """Un polígono extruido de z0 a z1 (cara de arriba y abajo de `mat_cara`, cantos de `mat_canto`), biselado."""
    if _area(pts) < 0:
        pts = list(reversed(pts))
    abajo = [bm.verts.new((x, y, z0)) for x, y in pts]
    arriba = [bm.verts.new((x, y, z1)) for x, y in pts]
    n = len(pts)
    caras = [bm.faces.new(arriba), bm.faces.new(list(reversed(abajo)))]
    caras[0].material_index = caras[1].material_index = _mi(mat_cara)
    lados = []
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((abajo[i], abajo[j], arriba[j], arriba[i]))
        f.material_index = _mi(mat_canto)
        lados.append(f)
    if bisel > 0:
        orilla = [e for e in bm.edges if (e.verts[0] in arriba and e.verts[1] in arriba) or (e.verts[0] in abajo and e.verts[1] in abajo)]
        r = bmesh.ops.bevel(bm, geom=orilla, offset=bisel, segments=segs, profile=0.5, affect="EDGES", clamp_overlap=True)
        for f in r["faces"]:
            f.material_index = _mi(mat_canto)
    return caras


def caja(bm, centro, tam, mat, M=None):
    """Caja de tamaño `tam` centrada en `centro` (en los ejes de la guitarra, o girada con M 3x3)."""
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r["verts"]
    S = Matrix.Diagonal((tam[0], tam[1], tam[2], 1.0))
    T = Matrix.Translation(centro) @ ((M.to_4x4() if M is not None else Matrix.Identity(4)) @ S)
    bmesh.ops.transform(bm, matrix=T, verts=vs)
    for f in {f for v in vs for f in v.link_faces}:
        f.material_index = _mi(mat)
    return vs


def cilindro(bm, centro, eje, radio, alto, mat, segs=14):
    """Cilindro tapado de `radio` y `alto` sobre `eje` (vector), centrado en `centro`."""
    r = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radio, radius2=radio, depth=alto)
    vs = r["verts"]
    z = Vector((0, 0, 1))
    q = z.rotation_difference(Vector(eje).normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centro) @ q.to_matrix().to_4x4(), verts=vs)
    for f in {f for v in vs for f in v.link_faces}:
        f.material_index = _mi(mat)
    return vs


def barra(bm, p0, p1, ancho, alto, mat, arriba=(0, 0, 1)):
    """Una barra delgada de p0 a p1 (las cuerdas): su cara ancha mira hacia `arriba`."""
    p0, p1 = Vector(p0), Vector(p1)
    x = (p1 - p0).normalized()
    z = Vector(arriba)
    z = (z - z.dot(x) * x).normalized()
    y = z.cross(x)
    M = Matrix((x, y, z)).transposed()
    return caja(bm, (p0 + p1) / 2, ((p1 - p0).length, ancho, alto), mat, M)


def mastil(bm):
    """El mástil (la espalda redonda) y el diapasón encima, de x = 13 a la cejuela."""
    xs = [13.0 + (CEJUELA + 0.3 - 13.0) * i / 10 for i in range(11)]
    tope = DIAP_Z - 0.6
    anillos = []
    for x in xs:
        w = ancho_mastil(x)
        ring = []
        for k in range(9):
            a = math.pi * k / 8
            ring.append(bm.verts.new((x, (w / 2) * math.cos(a), tope - 2.25 * math.sin(a))))
        anillos.append(ring)
    for a, b in zip(anillos, anillos[1:]):
        for k in range(8):
            f = bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
            f.material_index = _mi("Guitarra_Madera")
        f = bm.faces.new((a[8], b[8], b[0], a[0]))   # la cara de arriba (queda bajo el diapasón)
        f.material_index = _mi("Guitarra_Madera")
    for ring, rev in ((anillos[0], True), (anillos[-1], False)):
        f = bm.faces.new(list(reversed(ring)) if rev else ring)
        f.material_index = _mi("Guitarra_Madera")
    # el diapasón: una placa que se angosta
    pts = [(13.5, -ancho_mastil(13.5) / 2 - 0.05), (CEJUELA, -ancho_mastil(CEJUELA) / 2 - 0.05),
           (CEJUELA, ancho_mastil(CEJUELA) / 2 + 0.05), (13.5, ancho_mastil(13.5) / 2 + 0.05)]
    placa(bm, pts, tope, DIAP_Z, "Guitarra_Diapason", "Guitarra_Diapason", 0.0)


def trastes(bm):
    n = 1
    previo = CEJUELA
    while True:
        x = CEJUELA - L_ESCALA * (1 - 2 ** (-n / 12))
        if x < 14.5:
            break
        w = ancho_mastil(x)
        caja(bm, (x, 0, DIAP_Z + 0.07), (0.16, w, 0.14), "Guitarra_Metal")
        medio = (x + previo) / 2
        if n in (3, 5, 7, 9, 15):
            cilindro(bm, (medio, 0, DIAP_Z + 0.02), (0, 0, 1), 0.32, 0.06, "Guitarra_Blanco", 10)
        if n == 12:
            for y in (-1.15, 1.15):
                cilindro(bm, (medio, y, DIAP_Z + 0.02), (0, 0, 1), 0.32, 0.06, "Guitarra_Blanco", 10)
        previo = x
        n += 1
    caja(bm, (CEJUELA, 0, DIAP_Z + 0.27), (0.45, ancho_mastil(CEJUELA), 0.54), "Guitarra_Blanco")


def canto_clavijero():
    """El canto de arriba del clavijero (de donde se abre a la punta): un punto, su dirección y su normal hacia fuera."""
    a, b = Vector(CLAVIJERO[5]), Vector(CLAVIJERO[4])
    d = (b - a).normalized()
    return a, d, Vector((-d.y, d.x))


def clavijero(bm):
    """El clavijero y sus seis clavijas, tres por canto: el poste sobre la cara a 1.3 cm del canto y la llave
    afuera del canto. Regresa los postes: (x, y, de qué lado, qué tan lejos de la cejuela)."""
    placa(bm, CLAVIJERO, -2.3, -0.8, "Guitarra_Negro", "Guitarra_Negro", 0.25, 2)
    a, d, n = canto_clavijero()
    postes = []
    for lado in (1, -1):
        for k, x in enumerate(CLAVIJAS_X):
            t = (x - a.x) / d.x
            e = a + d * t                       # el punto del canto (lado de arriba)
            poste = e - n * 1.3
            llave = e + n * 1.15
            eje = (n.x, n.y * lado, 0)
            cilindro(bm, (poste.x, lado * poste.y, -0.4), (0, 0, 1), 0.3, 0.8, "Guitarra_Metal", 10)
            cilindro(bm, ((e + n * 0.45).x, lado * (e + n * 0.45).y, -1.55), eje, 0.18, 1.0, "Guitarra_Metal", 8)
            cilindro(bm, (llave.x, lado * llave.y, -1.55), eje, 0.75, 0.38, "Guitarra_Metal", 14)
            postes.append((poste.x, lado * poste.y, lado, k))
    return postes


def cuerpo(bm):
    placa(bm, CUERPO, FONDO_Z, TAPA_Z, "Guitarra_Cuerpo", "Guitarra_Canto", 0.6, 3)
    for x in PASTILLAS:
        caja(bm, (x, 0, TAPA_Z + 0.45), (3.6, 7.6, 0.9), "Guitarra_Metal")
        caja(bm, (x, 0, TAPA_Z + 0.25), (4.4, 8.4, 0.5), "Guitarra_Negro")
    caja(bm, (PUENTE, 0, -0.6), (1.2, 8.4, 0.9), "Guitarra_Metal")
    for y in (-4.6, 4.6):
        cilindro(bm, (PUENTE, y, -0.9), (0, 0, 1), 0.45, 1.0, "Guitarra_Metal", 10)
    caja(bm, (-11.6, 0, -1.0), (1.4, 8.0, 0.8), "Guitarra_Metal")
    for x, y in PERILLAS:
        cilindro(bm, (x, y, TAPA_Z + 0.45), (0, 0, 1), 0.95, 0.9, "Guitarra_Metal", 16)
    cilindro(bm, (SELECTOR[0], SELECTOR[1], TAPA_Z + 0.2), (0, 0, 1), 0.85, 0.3, "Guitarra_Negro", 14)
    cilindro(bm, (SELECTOR[0], SELECTOR[1], TAPA_Z + 0.9), (0, 0, 1), 0.28, 1.2, "Guitarra_Blanco", 8)


def cuerdas(bm, postes):
    # del cordal al puente, del puente a la cejuela y de la cejuela a su clavija: las tres de abajo a las clavijas
    # de abajo y las tres de arriba a las de arriba; la de afuera a la más cercana a la cejuela y la de en medio a
    # la de la punta, así no se cruzan (Oscar, con su referencia del entorchado)
    de = {(lado, k): (x, y) for x, y, lado, k in postes}
    for i in range(6):
        yb = -2.6 + i * 1.04
        yn = -1.85 + i * 0.74
        barra(bm, (-11.0, yb * 0.95, -0.55), (PUENTE, yb, 0.0), 0.14, 0.14, "Guitarra_Blanco")
        barra(bm, (PUENTE, yb, 0.0), (CEJUELA, yn, 0.0), 0.14, 0.14, "Guitarra_Blanco")
        lado, k = (-1, i) if i < 3 else (1, 5 - i)
        px, py = de[(lado, k)]
        barra(bm, (CEJUELA, yn, 0.0), (px, py, -0.15), 0.12, 0.12, "Guitarra_Blanco")


def materiales():
    out = []
    for n, c in MATS.items():
        m = bpy.data.materials.get(n) or bpy.data.materials.new(n)
        m.diffuse_color = c
        try:
            m.use_nodes = True
            b = m.node_tree.nodes["Principled BSDF"]
            b.inputs["Base Color"].default_value = c
            b.inputs["Roughness"].default_value = 0.55
        except Exception:
            pass
        out.append(m)
    return out


def modelar():
    """Arma (o rehace) el objeto Guitarra, en su espacio propio y sin padre."""
    vieja = bpy.data.objects.get(NOMBRE)
    previo = None
    if vieja:
        previo = (vieja.parent, vieja.parent_type, vieja.parent_bone, vieja.matrix_world.copy())
        bpy.data.objects.remove(vieja)
    bm = bmesh.new()
    cuerpo(bm)
    mastil(bm)
    trastes(bm)
    postes = clavijero(bm)
    cuerdas(bm, postes)
    bmesh.ops.scale(bm, vec=(ESCALA, ESCALA, ESCALA), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.get(NOMBRE)
    if me:
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(NOMBRE)
    bm.to_mesh(me)
    bm.free()
    for m in materiales():
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.set_sharp_from_angle(angle=math.radians(35))
    except Exception:
        pass
    o = bpy.data.objects.new(NOMBRE, me)
    bpy.context.scene.collection.objects.link(o)
    if previo and previo[0] is not None:
        o.parent, o.parent_type, o.parent_bone = previo[0], previo[1], previo[2]
        o.matrix_world = previo[3]
    return o


def matriz_padre(arm, hueso=HUESO):
    """La matriz de mundo con la que un hijo de hueso queda pegado (el hueso cuelga a sus hijos de su cola)."""
    pb = arm.pose.bones[hueso]
    return arm.matrix_world @ pb.matrix @ Matrix.Translation((0, arm.data.bones[hueso].length, 0))


def colocar(arm, G, hueso=HUESO):
    """Cuelga la guitarra del hueso con G (espacio del armature, cm) en la pose que tenga el armature ahora."""
    o = bpy.data.objects.get(NOMBRE) or modelar()
    bpy.context.view_layer.update()
    o.parent = arm
    o.parent_type = "BONE"
    o.parent_bone = hueso
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.matrix_basis = matriz_padre(arm, hueso).inverted() @ (arm.matrix_world @ G)
    bpy.context.view_layer.update()
    return o


def marco(arm):
    """Dónde está la guitarra ahora (espacio del armature, cm), con la pose evaluada."""
    o = bpy.data.objects[NOMBRE]
    dg = bpy.context.evaluated_depsgraph_get()
    return arm.matrix_world.inverted() @ o.evaluated_get(dg).matrix_world


def marco_de(G, x=0.0, y=0.0, z=0.0):
    """Un punto de la guitarra (cm, sus ejes) en el espacio del armature."""
    return G @ Vector((x, y, z))


def traste_x(n):
    """La x de la mitad entre el traste n-1 y el n (donde se pisa)."""
    a = CEJUELA - L_ESCALA * (1 - 2 ** (-(n - 1) / 12))
    b = CEJUELA - L_ESCALA * (1 - 2 ** (-n / 12))
    return ESCALA * (a + b) / 2


# ---------------------------------------------------------------- la púa (Oscar, 2026-11-23: "como si estuviera
# tocando con una púa"): un triángulo redondeado amarillo, pellizcado entre la yema del pulgar y el costado del índice.
# Va colgada del pulgar (thumb3.r): con los cuernos y el puño el pulgar sigue encima del dedo de en medio y la púa con
# él. Su origen es el centro del pellizco, +Y va hacia la punta y Z es el eje del pellizco (de su cara a la otra).
PUA = "Pua"
PUA_HUESO = "thumb3.r"
PUA_ESCALA = 1.5    # de caricatura, como la guitarra (a tamaño real no llegaba a las cuerdas ni se veía)
PUA_PUNTA = 2.0 * PUA_ESCALA     # cm del centro a la punta
PUA_GRUESO = 0.3


def pua_contorno(n=48):
    """El contorno de la púa: la envolvente de dos círculos de los hombros y uno chico en la punta."""
    k = PUA_ESCALA
    circ = [((-0.78 * k, -0.35 * k), 0.78 * k), ((0.78 * k, -0.35 * k), 0.78 * k), ((0.0, PUA_PUNTA - 0.26 * k), 0.26 * k)]
    pts = [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for (cx, cy), r in circ for k in range(n)]
    pts.sort()
    def cruz(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    abajo, arriba = [], []
    for p in pts:
        while len(abajo) >= 2 and cruz(abajo[-2], abajo[-1], p) <= 0:
            abajo.pop()
        abajo.append(p)
    for p in reversed(pts):
        while len(arriba) >= 2 and cruz(arriba[-2], arriba[-1], p) <= 0:
            arriba.pop()
        arriba.append(p)
    return abajo[:-1] + arriba[:-1]


def pua_modelar():
    """Arma (o rehace) el objeto Pua, en su espacio propio y sin padre."""
    vieja = bpy.data.objects.get(PUA)
    if vieja:
        bpy.data.objects.remove(vieja)
    pts = pua_contorno()
    bm = bmesh.new()
    h = PUA_GRUESO / 2
    abajo = [bm.verts.new((x, y, -h)) for x, y in pts]
    arriba = [bm.verts.new((x, y, h)) for x, y in pts]
    bm.faces.new(arriba)
    bm.faces.new(list(reversed(abajo)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((abajo[i], abajo[j], arriba[j], arriba[i]))
    orilla = [e for e in bm.edges if all(v in arriba for v in e.verts) or all(v in abajo for v in e.verts)]
    bmesh.ops.bevel(bm, geom=orilla, offset=0.09, segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.get(PUA)
    if me:
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(PUA)
    bm.to_mesh(me)
    bm.free()
    m = bpy.data.materials.get("Pua") or bpy.data.materials.new("Pua")
    m.diffuse_color = (0.96, 1.0, 0.0, 1)
    me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.set_sharp_from_angle(angle=math.radians(35))
    except Exception:
        pass
    o = bpy.data.objects.new(PUA, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def pua_colocar(arm, M):
    """Cuelga la púa del pulgar con M (espacio del armature, cm) en la pose que tenga el armature ahora."""
    o = bpy.data.objects.get(PUA) or pua_modelar()
    bpy.context.view_layer.update()
    o.parent = arm
    o.parent_type = "BONE"
    o.parent_bone = PUA_HUESO
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.matrix_basis = matriz_padre(arm, PUA_HUESO).inverted() @ (arm.matrix_world @ M)
    bpy.context.view_layer.update()
    return o
