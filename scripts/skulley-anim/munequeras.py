"""
Arma las muñequeras de picos de Skulley (prop "Munequeras") en Character/SkulleyRad.blend.

En Blender, en modo objeto:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
Reemplaza el objeto Munequeras si ya existe. Se arma la izquierda y la derecha sale de espejo (.l -> .r).

Referencia de Oscar (Character/referencias/munequera_picos.webp): aro negro ancho y grueso armado por
segmentos, picos triangulares grandes y planos hacia afuera (placas con escalón y tornillo), cinchos en
las uniones y una correa tejida por dentro. Versión toon:
- correa: un anillo entero entre las dos placas; se asoma por el hueco (va 0.2 cm más adentro que las
  placas) y en el surco de afuera, entre placa y placa;
- placas: delantera (hacia la mano) y trasera, cada una en 4 segmentos con su ranura; las uniones de una
  van corridas respecto a las de la otra, como en la referencia;
- picos: prismas triangulares en el plano del aro, metidos en el surco entre las placas, con un triángulo
  de escalón en cada cara y un tornillo plateado;
- cinchos: cabeza y tira sobre la orilla, en las uniones que caen entre picos.

Todo se arma en el marco del hueso forearm_twist.l en reposo (cm): y a lo largo del antebrazo hacia la
mano (la articulación de la muñeca queda en y = 8.94), x hacia el pulgar y z hacia el dorso. El ángulo
psi = atan2(z, x): 0 pulgar, 90 dorso, 180 meñique, 270 palma. Es rígida: todo su peso va a
forearm_twist, que gira con la muñeca y no se dobla con ella.

Por qué así (medido en idle, caminar y Correr, envolvente de revisar_munequeras.py):
- El cuerpo solo se acerca al antebrazo por el lado de la palma y del pulgar (psi de 180 a 60, pasando
  por 270 y 0): caminando el tórax pasa a 10 cm del eje (derecha) y a 12 (izquierda). Del dorso al meñique
  (60 a 180) nunca hay nada. Primero los picos iban solo del dorso al meñique; Oscar los quiso en toda la
  vuelta, así que en el sitio apartaManos abre el brazo lo justo también sin ropa. El aro sigue excéntrico:
  delgado del lado del cuerpo (RADIO - EXC = 9.2 cm del eje) y grueso del otro (12).
- El hueco libra la manga de la chamarra (6.4 cm del eje). El puño de la inflada (7.8) y el del hoodie (9.5)
  no caben: con un hueco de 8.2 el aro quedaba delgado del lado de la palma y Oscar escogió el grueso
  (2026-11-18), así que en el sitio se excluyen con esas dos.
- Va de y = -0.8 a 6.0: la mano empieza en ~7 y al doblar la muñeca no debe tocar la placa de enfrente.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

ARM = bpy.data.objects["root"]
TMP = "Munequeras_tmp"
HUESO = "forearm_twist"

HUECO = 6.9          # radio del hueco (cara de adentro de la correa)
Y0, Y1 = -0.8, 6.0   # de dónde a dónde va a lo largo del antebrazo
PLACA = 1.9          # grueso de cada placa
RECESO = 0.8         # lo que el surco entre placas se mete desde la orilla
RADIO = 10.6         # círculo de afuera de las placas...
EXC = 1.4            # ...corrido hacia el lado de los picos
EXC_ANG = 135.0
# en toda la vuelta (Oscar: "les hacen falta más picos para llenar la circunferencia"); entre dos picos
# queda el lado por donde el cuerpo pasa más cerca caminando (psi ~ 330)
PICOS = tuple(37.5 + 45.0 * k for k in range(8))
PICO_ALTO = 4.8      # de la orilla del aro a la punta
PICO_BASE = 5.4      # ancho de la base en la orilla
# Del lado de la palma los picos son más bajos: caminando, la mano se dobla hacia la palma y los dedos
# regresan junto al aro a 15-17 cm del eje (psi 255 y 305), y por ahí pasa el cuerpo.
PALMA = 285.0
PICO_CORTE = 1.8     # lo que se le quita a la altura justo en PALMA (menos, hacia los lados)


def alto_pico(psi):
    return PICO_ALTO - PICO_CORTE * max(0.0, math.cos(rad(psi - PALMA)))
# uniones y cinchos entre picos; los cinchos, lejos del lado del cuerpo
UNIONES_FRENTE = (15.0, 105.0, 195.0, 285.0)
UNIONES_ATRAS = (60.0, 150.0, 240.0, 330.0)
CINCHOS = (("frente", 105.0), ("frente", 195.0), ("atras", 60.0), ("atras", 150.0))
RANURA = 0.3         # ancho de la ranura entre segmentos (cm de arco)
PASO = 8.0           # grados por paso en los arcos
BISEL = 0.14

MATERIALES = (
    ("Munequera_Placa", (0.016, 0.016, 0.019), 0.45),
    ("Munequera_Correa", (0.034, 0.034, 0.04), 0.9),
    ("Munequera_Pico", (0.021, 0.021, 0.025), 0.4),
    ("Munequera_Escalon", (0.045, 0.045, 0.055), 0.25),
    ("Munequera_Metal", (0.66, 0.69, 0.73), 0.3),
    ("Munequera_Cincho", (0.006, 0.006, 0.007), 0.6),
)
M_PLACA, M_CORREA, M_PICO, M_ESCALON, M_METAL, M_CINCHO = range(6)


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


def activo(o):
    vl = bpy.context.view_layer
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for x in vl.objects:
        x.select_set(False)
    o.select_set(True); vl.objects.active = o


def reposo():
    for pb in ARM.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    aj = ARM.pose.bones["ctl_ajustes"]
    for k in ("rig", "ik_pierna_l", "ik_pierna_r", "ik_brazo_l", "ik_brazo_r"):
        if k in aj:
            aj[k] = 1
    bpy.context.view_layer.update()


def quitar_accion():
    if ARM.animation_data:
        ARM.animation_data.action = None
    reposo()


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


# ---------------------------------------------------------------- forma
def rad(g):
    return math.radians(g)


def r_fuera(psi):
    """Radio de la orilla de afuera de las placas en la dirección psi (círculo corrido EXC hacia EXC_ANG)."""
    ux, uz = math.cos(rad(psi)), math.sin(rad(psi))
    cx, cz = EXC * math.cos(rad(EXC_ANG)), EXC * math.sin(rad(EXC_ANG))
    uc = ux * cx + uz * cz
    return uc + math.sqrt(uc * uc - (cx * cx + cz * cz) + RADIO * RADIO)


def P(r, psi, y):
    return Vector((r * math.cos(rad(psi)), y, r * math.sin(rad(psi))))


def caja_anular(bm, psi_a, psi_b, r_in, r_out, ya, yb, mat, cerrado=False):
    """Sólido entre dos radios (números o funciones de psi), de psi_a a psi_b y de ya a yb."""
    fin = psi_b if not cerrado else psi_a + 360.0
    n = max(2, int(math.ceil(abs(fin - psi_a) / PASO)))
    if cerrado:
        pasos = [psi_a + (fin - psi_a) * i / n for i in range(n)]
    else:
        pasos = [psi_a + (fin - psi_a) * i / n for i in range(n + 1)]
    ri = r_in if callable(r_in) else (lambda p, v=r_in: v)
    ro = r_out if callable(r_out) else (lambda p, v=r_out: v)
    filas = []
    for p in pasos:
        a, b = ri(p), ro(p)
        filas.append([bm.verts.new(P(a, p, ya)), bm.verts.new(P(b, p, ya)), bm.verts.new(P(b, p, yb)), bm.verts.new(P(a, p, yb))])
    caras = []
    pares = list(zip(filas, filas[1:])) + ([(filas[-1], filas[0])] if cerrado else [])
    for f0, f1 in pares:
        for k in range(4):
            caras.append(bm.faces.new((f0[k], f0[(k + 1) % 4], f1[(k + 1) % 4], f1[k])))
    if not cerrado:
        caras.append(bm.faces.new(filas[0]))
        caras.append(bm.faces.new(list(reversed(filas[-1]))))
    for f in caras:
        f.material_index = mat
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    return caras


def prisma(bm, contorno, ya, yb, mat):
    """Extruye un polígono del plano del aro (lista de (r, psi)) de ya a yb."""
    abajo = [bm.verts.new(P(r, p, ya)) for r, p in contorno]
    arriba = [bm.verts.new(P(r, p, yb)) for r, p in contorno]
    n = len(contorno)
    caras = [bm.faces.new(abajo), bm.faces.new(list(reversed(arriba)))]
    for k in range(n):
        caras.append(bm.faces.new((abajo[k], abajo[(k + 1) % n], arriba[(k + 1) % n], arriba[k])))
    for f in caras:
        f.material_index = mat
    bmesh.ops.recalc_face_normals(bm, faces=caras)
    return caras


def polar(v2):
    """(x, z) del plano del aro -> (r, psi)."""
    return (math.hypot(v2[0], v2[1]), math.degrees(math.atan2(v2[1], v2[0])))


def triangulo(psi, r_base, r_punta, medio_ancho_base):
    """Triángulo isósceles con la punta hacia afuera en la dirección psi, como lista (r, psi)."""
    u = Vector((math.cos(rad(psi)), math.sin(rad(psi))))
    t = Vector((-u.y, u.x))
    a = u * r_base + t * medio_ancho_base
    b = u * r_punta
    c = u * r_base - t * medio_ancho_base
    return [polar(c), polar(a), polar(b)]


def cilindro(bm, centro2, radio, ya, yb, mat, lados=6):
    u = [Vector(centro2) + Vector((math.cos(2 * math.pi * k / lados), math.sin(2 * math.pi * k / lados))) * radio for k in range(lados)]
    return prisma(bm, [polar(p) for p in u], ya, yb, mat)


def correa(bm):
    return caja_anular(bm, 0.0, 360.0, HUECO, lambda p: r_fuera(p) - RECESO, Y0 + 0.25, Y1 - 0.25, M_CORREA, cerrado=True)


def placas(bm):
    """Delantera y trasera, cada una en segmentos con su ranura."""
    for uniones, ya, yb in ((UNIONES_FRENTE, Y1 - PLACA, Y1), (UNIONES_ATRAS, Y0, Y0 + PLACA)):
        u = sorted(uniones)
        for k in range(len(u)):
            a = u[k]; b = u[(k + 1) % len(u)] + (360.0 if k == len(u) - 1 else 0.0)
            media = math.degrees(RANURA / 2 / RADIO)
            caja_anular(bm, a + media, b - media, HUECO + 0.2, r_fuera, ya, yb, M_PLACA)


def picos(bm):
    """Cada pico: prisma en el surco entre las placas, escalón en cada cara y tornillo."""
    ya, yb = Y0 + PLACA - 0.05, Y1 - PLACA + 0.05
    for psi in PICOS:
        alto = alto_pico(psi)
        base = PICO_BASE * (0.8 + 0.2 * alto / PICO_ALTO)
        alfa = math.atan((base / 2) / alto)
        ro = r_fuera(psi)
        r_b = ro - RECESO - 0.3
        r_p = ro + alto
        w = lambda rr: (base / 2) * (r_p - rr) / alto
        prisma(bm, triangulo(psi, r_b, r_p, w(r_b)), ya, yb, M_PICO)
        # escalón: el triángulo metido 0.8 de cada lado, desde la orilla del aro
        d = 0.8
        rt_b = ro + 0.55
        rt_p = r_p - d / math.sin(alfa)
        wt = (rt_p - rt_b) * math.tan(alfa)
        tri = triangulo(psi, rt_b, rt_p, wt)
        prisma(bm, tri, ya - 0.35, ya + 0.05, M_ESCALON)
        prisma(bm, tri, yb - 0.05, yb + 0.35, M_ESCALON)
        # tornillo en cada escalón, cerca de la base
        u = Vector((math.cos(rad(psi)), math.sin(rad(psi))))
        c = u * (rt_b + 0.95)
        cilindro(bm, c, 0.42, ya - 0.62, ya - 0.3, M_METAL)
        cilindro(bm, c, 0.42, yb + 0.3, yb + 0.62, M_METAL)


def cinchos(bm):
    """Cabeza de cincho sobre la orilla de la placa y su tira cruzando la orilla."""
    for cara, psi in CINCHOS:
        ro = r_fuera(psi)
        u = Vector((math.cos(rad(psi)), math.sin(rad(psi))))
        t = Vector((-u.y, u.x))
        if cara == "frente":
            ya, yb = Y1 - 0.85, Y1 + 0.3
            ta, tb = Y1 - PLACA - 0.15, Y1 + 0.12
        else:
            ya, yb = Y0 - 0.3, Y0 + 0.85
            ta, tb = Y0 - 0.12, Y0 + PLACA + 0.15
        def rect(r0, r1, ancho):
            return [polar(u * r0 - t * ancho), polar(u * r1 - t * ancho), polar(u * r1 + t * ancho), polar(u * r0 + t * ancho)]
        prisma(bm, rect(ro - 0.55, ro + 0.45, 0.48), ya, yb, M_CINCHO)
        prisma(bm, rect(ro - 0.2, ro + 0.13, 0.26), ta, tb, M_CINCHO)


def marcar_bisel(bm, sin_bisel):
    """Peso de bisel en las aristas filosas que se ven; la correa (casi toda escondida) no lleva: era la
    mitad de los triángulos."""
    capa = bm.edges.layers.float.get("bevel_weight_edge") or bm.edges.layers.float.new("bevel_weight_edge")
    for e in bm.edges:
        if len(e.link_faces) != 2 or any(f in sin_bisel for f in e.link_faces):
            continue
        if e.calc_face_angle(0.0) > math.radians(40):
            e[capa] = 1.0


def munequera_izquierda():
    """La muñequera izquierda en las coordenadas del armature (cm), pesada a forearm_twist.l."""
    bm = bmesh.new()
    sin_bisel = set(correa(bm))
    placas(bm)
    picos(bm)
    cinchos(bm)
    marcar_bisel(bm, sin_bisel)
    M = ARM.data.bones[HUESO + ".l"].matrix_local
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    borrar("mq_izq")
    me = bpy.data.meshes.new("mq_izq")
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("mq_izq", me)
    col_tmp().objects.link(o)
    o.matrix_world = ARM.matrix_world.copy()
    for m in materiales():
        me.materials.append(m)
    g = o.vertex_groups.new(name=HUESO + ".l")
    g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    return o


def espejo(o):
    """La derecha: espejo en x del armature, caras volteadas y el grupo .l -> .r."""
    borrar("mq_der")
    me = o.data.copy(); me.name = "mq_der"
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.scale(bm, vec=(-1, 1, 1), verts=bm.verts)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    r = bpy.data.objects.new("mq_der", me)
    col_tmp().objects.link(r)
    r.matrix_world = o.matrix_world.copy()
    # los nombres de los grupos viven en la malla: la copia traía forearm_twist.l
    r.vertex_groups.clear()
    g = r.vertex_groups.new(name=HUESO + ".r")
    g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    return r


def montar(nombre="Munequeras"):
    """Junta las dos, hijo del armature con bisel y armature, en la colección de los props."""
    L = munequera_izquierda()
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
    me = o.data
    me.shade_smooth()
    try:
        me.set_sharp_from_angle(angle=math.radians(35))
    except Exception:
        pass
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    # El bisel en cm del armature, solo en las aristas marcadas (marcar_bisel). No se llama "Bisel":
    # exportar_prop le sube a 3 los segmentos a ese (el de los lentes) y aquí con 2 basta.
    b = o.modifiers.new("Bisel_mq", 'BEVEL')
    b.width = BISEL; b.segments = 2; b.limit_method = 'WEIGHT'
    try:
        b.edge_weight = "bevel_weight_edge"
    except Exception:
        pass
    b.harden_normals = False
    a = o.modifiers.new("Armature", 'ARMATURE'); a.object = ARM; a.use_vertex_groups = True
    return o


def limpiar_tmp():
    c = bpy.data.collections.get(TMP)
    if c:
        for o in list(c.objects):
            borrar(o.name)
        bpy.data.collections.remove(c)
    for me in list(bpy.data.meshes):
        if me.users == 0 and me.name.startswith("mq_"):
            bpy.data.meshes.remove(me)


def todo():
    quitar_accion()
    o = montar()
    limpiar_tmp()
    dg = bpy.context.evaluated_depsgraph_get()
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    me.calc_loop_triangles()
    info = dict(triangulos=len(me.loop_triangles), vertices=len(me.vertices),
                huesos=sorted(g.name for g in o.vertex_groups),
                orilla=[round(r_fuera(p), 2) for p in (0, 45, 90, 135, 180, 225, 270, 315)])
    oe.to_mesh_clear()
    activo(o)
    return o, info


# ---------------------------------------------------------------- mangas ceñidas
# Con el hoodie y la inflada la muñequera aprieta la manga (Oscar, 2026-11-18: "déjalas en su tamaño normal
# para todos"; una variante con hueco de 10 cm le pareció demasiado grande). El puño del hoodie llega a 9.5 cm
# del eje y el de la inflada a 7.8: todo lo de la manga, desde CINE_DESDE antes del aro, se aprieta hacia el
# eje del antebrazo, de CINE_DENTRO (más afuera que el antebrazo, 4.95) a CINE_FUERA (el hueco menos medio
# centímetro), conservando el orden de las capas. Esto lo hace el sitio al ponerlas juntas
# (accesorios.js, cenirMangas); aquí solo se arma en una copia para verlo y medirlo, nunca encima de la prenda.
CINE_DESDE = 3.0
CINE_DENTRO = 5.8
CINE_FUERA = HUECO - 0.5
# pasando la cara de enfrente del aro la manga se suelta y el puño vuelve a abrirse: ceñido hasta la punta,
# la mano al doblarse se metía en el final del puño del hoodie caminando
CINE_SUELTA = (0.15, 0.6)


def suave(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def cenido(o, picos_mat=("Inflada_Picos",)):
    """Posiciones de reposo de la prenda `o` con las mangas ceñidas (coordenadas del objeto)."""
    me = o.data
    gn = {g.index: g.name for g in o.vertex_groups}
    inv_o = o.matrix_world.inverted() @ ARM.matrix_world
    a_arm = ARM.matrix_world.inverted() @ o.matrix_world
    mat_de = {}
    for poly in me.polygons:
        for vi in poly.vertices:
            mat_de[vi] = me.materials[poly.material_index].name if me.materials[poly.material_index] else ""
    nuevas = [v.co.copy() for v in me.vertices]
    for s in ("l", "r"):
        B = ARM.data.bones[HUESO + "." + s].matrix_local
        Binv = B.inverted()
        lado = []
        for v in me.vertices:
            w = sum(g.weight for g in v.groups if gn[g.group].endswith("." + s) and gn[g.group].split(".")[0].startswith(("arm", "forearm", "hand")))
            if w < 0.5:
                continue
            l = Binv @ (a_arm @ v.co)
            lado.append((v.index, l))
        y_full = Y0 - 0.3
        rmax = max((math.hypot(l.x, l.z) for i, l in lado if l.y >= y_full and mat_de.get(i) not in picos_mat), default=0.0)
        if rmax <= CINE_FUERA:
            continue
        k = (CINE_FUERA - CINE_DENTRO) / (rmax - CINE_DENTRO)
        for i, l in lado:
            w = suave(Y0 - CINE_DESDE, y_full, l.y) * (1 - suave(Y1 + CINE_SUELTA[0], Y1 + CINE_SUELTA[1], l.y))
            if w <= 0:
                continue
            r = math.hypot(l.x, l.z)
            if r <= CINE_DENTRO:
                continue
            r2 = min(CINE_DENTRO + (r - CINE_DENTRO) * k, CINE_FUERA)
            r3 = r + w * (r2 - r)
            l2 = Vector((l.x * r3 / r, l.y, l.z * r3 / r))
            nuevas[i] = inv_o @ (B @ l2)
    return nuevas


def copia_cenida(nombre):
    """Copia temporal de la prenda con las mangas ceñidas (mq_<nombre>_cenida, en la colección temporal)."""
    o = bpy.data.objects[nombre]
    borrar("mq_" + nombre + "_cenida")
    c = o.copy(); c.data = o.data.copy()
    c.name = "mq_" + nombre + "_cenida"; c.data.name = c.name
    col_tmp().objects.link(c)
    for v, p in zip(c.data.vertices, cenido(o)):
        v.co = p
    c.hide_set(False); c.hide_render = False
    return c


# ---------------------------------------------------------------- renders
def render(ruta, objetivo, desde, lente=85.0, ancho=1100, alto=1100, mostrar=("Munequeras",), accion=None,
           cuadro=None, motor="BLENDER_EEVEE", muestras=24, orto=None, pose=None):
    """Render con cámara temporal (objetivo y desde en cm del armature). Salen el cuerpo y lo de `mostrar`;
    lo demás (otros props, temporales de otras sesiones) se esconde y se regresa como estaba."""
    sc = bpy.context.scene; r = sc.render
    mw = ARM.matrix_world
    antes = dict(cam=sc.camera, rx=r.resolution_x, ry=r.resolution_y, pct=r.resolution_percentage, fp=r.filepath,
                 motor=r.engine, frame=sc.frame_current, fmt=r.image_settings.file_format)
    esc = []
    for o in sc.objects:
        if o.type != 'MESH' or o.hide_render:
            continue
        if (o.name.startswith("Egg_") and o.name != "Egg_EnergyBall") or o.name in mostrar:
            continue
        o.hide_render = True; esc.append(o)
    # los que están ocultos en la vista también se ocultan en el render si no se piden
    prendidos = []
    for n in mostrar:
        o = bpy.data.objects.get(n)
        if o and o.hide_render:
            o.hide_render = False; prendidos.append(o)
    cd = bpy.data.cameras.new("mq_cam"); cd.lens = lente; cd.clip_start = 0.01; cd.clip_end = 100
    if orto:
        cd.type = 'ORTHO'; cd.ortho_scale = orto * mw.to_scale().x
    cam = bpy.data.objects.new("mq_cam", cd)
    sc.collection.objects.link(cam)
    tgt = mw @ Vector(objetivo); pos = mw @ Vector(desde)
    cam.location = pos
    cam.rotation_euler = (tgt - pos).to_track_quat('-Z', 'Y').to_euler()
    ad = ARM.animation_data
    try:
        if accion:
            act = bpy.data.actions[accion]; ad.action = act
            if len(act.slots):
                ad.action_slot = act.slots[0]
            sc.frame_set(cuadro or 1)
        else:
            quitar_accion()
        if pose:
            pose()   # p. ej. abrir los brazos como apartaManos (revisar_munequeras.abrir_brazo)
        sc.camera = cam
        r.engine = motor
        if motor.startswith("BLENDER_EEVEE"):
            try:
                sc.eevee.taa_render_samples = muestras
            except Exception:
                pass
        r.resolution_x = ancho; r.resolution_y = alto; r.resolution_percentage = 100
        r.filepath = ruta; r.image_settings.file_format = 'PNG'
        bpy.ops.render.render(write_still=True)
    finally:
        for o in esc:
            o.hide_render = False
        for o in prendidos:
            o.hide_render = True
        sc.camera = antes["cam"]
        r.resolution_x, r.resolution_y, r.resolution_percentage = antes["rx"], antes["ry"], antes["pct"]
        r.filepath = antes["fp"]; r.engine = antes["motor"]; r.image_settings.file_format = antes["fmt"]
        if accion:
            quitar_accion()
        sc.frame_set(antes["frame"])
        bpy.data.objects.remove(cam, do_unlink=True)
        bpy.data.cameras.remove(cd)
    return ruta
