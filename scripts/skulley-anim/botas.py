"""
Arma las botas de Skulley (prop "Botas") en Character/SkulleyRad.blend.

En Blender, en modo objeto:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
Reemplaza el objeto Botas si ya existe. Todo va en las coordenadas del armature (cm), el piso
es z = 0. Se arma la izquierda (x > 0) y la derecha sale de espejo, con sus pesos .l -> .r.

Bota de moda futurista (referencia de Oscar: tenis-bota azul, suela blanca, calcetín gris carbón; la
primera versión, redonda de juguete, no se le parecía: la quiere puntiaguda y afilada). Piezas:
- caña: horma puntiaguda y baja (la línea de arriba baja recta hasta la punta) + calcetín recto y esbelto,
  unidos por voxel, inflados donde el pie o la espinilla quedan a menos de su holgura, en cuadros con
  QuadriFlow (y proyectados de vuelta a la forma: movía la orilla junto a la punta); costura de color por un
  plano inclinado (azul abajo, gris carbón arriba) y forro hacia adentro en lo que se ve por la boca;
- suela: banda de orillas definidas, más gruesa en el talón, fondo plano a HUECO_SUELA bajo el pie (como
  los tenis) con chaflán recto atrás; su orilla de arriba se dobla hacia la caña y se mete en ella, y en la
  punta sube pegada a la nariz (la parte blanca corre paralela al contorno de la suela; cortada por un plano se
  veía rota); contrafuerte en triángulo (orilla recta en diagonal, paramétrico: por voxel + QuadriFlow su orilla
  salía en zigzag); dibujo de la suela (chevrones, placa del arco, orilla) y línea en el costado; al final toda
  la punta se dobla hacia arriba (doblar_punta, toe spring);
- lengüeta grande que sale de la garganta (vivo en U), dos correas pegadas a la bota (la de arriba alrededor
  del tobillo y la de abajo cruzando el empeine sobre la base de la lengüeta) con sus hebillas y el clip
  amarillos, rollo en la boca, jaladera amarilla y puntitos perforados en la puntera.
El pie no se levanta: la bota lo envuelve y lo grueso se ve en la suela.
revisar_botas.py mide traspasos y piso cuadro por cuadro.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ARM = bpy.data.objects["root"]
TMP = "Botas_tmp"
XC = 11.6


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


def puntos_cuerpo(nombres):
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


# --- pose
def reposo():
    for pb in ARM.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    aj = ARM.pose.bones["ctl_ajustes"]
    for k in ("rig", "ik_pierna_l", "ik_pierna_r", "ik_brazo_l", "ik_brazo_r"):
        if k in aj:
            aj[k] = 1
    bpy.context.view_layer.update()


def poner_accion(nombre, cuadro):
    ad = ARM.animation_data
    act = bpy.data.actions[nombre]; ad.action = act
    if len(act.slots):
        ad.action_slot = act.slots[0]
    bpy.context.scene.frame_set(cuadro)


def quitar_accion():
    ARM.animation_data.action = None
    reposo()


def foto(ruta, objetivo=(0, -8, 8), direccion=(0, -1, 0.25), distancia=90.0, lente=50.0,
         ancho=1200, alto=1200, accion=None, cuadro=None, orto=None, muestras=32):
    """Render con una cámara temporal apuntando a 'objetivo' (cm del armature) desde 'direccion'.
    Solo salen el cuerpo y las botas; deja todo como estaba."""
    sc = bpy.context.scene; r = sc.render
    guard = dict(cam=sc.camera, rx=r.resolution_x, ry=r.resolution_y, pct=r.resolution_percentage,
                 fp=r.filepath, frame=sc.frame_current, fmt=r.image_settings.file_format,
                 samples=getattr(sc.eevee, "taa_render_samples", None))
    # solo el cuerpo y lo de las botas: los props y piezas temporales de las otras sesiones se esconden
    mias = set(bpy.data.collections[TMP].objects) if TMP in bpy.data.collections else set()
    escondidos = []
    for o in bpy.context.scene.objects:
        if o.type != 'MESH' or o.hide_render:
            continue
        if o.name.startswith("Egg_") or o.name == "Botas" or o in mias:
            if o.name != "Egg_EnergyBall":
                continue
        o.hide_render = True; escondidos.append(o)
    mw = ARM.matrix_world
    tgt = mw @ Vector(objetivo)
    d = Vector(direccion).normalized()
    pos = mw @ (Vector(objetivo) + d * distancia)
    cd = bpy.data.cameras.new("bts_cam_botas")
    cam = bpy.data.objects.new("bts_cam_botas", cd)
    sc.collection.objects.link(cam)
    cam.location = pos
    cam.rotation_euler = (tgt - pos).to_track_quat('-Z', 'Y').to_euler()
    cd.lens = lente; cd.clip_start = 0.01; cd.clip_end = 100
    if orto:
        cd.type = 'ORTHO'; cd.ortho_scale = orto * mw.to_scale().x
    try:
        if accion:
            poner_accion(accion, cuadro or 1)
        else:
            quitar_accion()
        sc.camera = cam
        r.resolution_x = ancho; r.resolution_y = alto; r.resolution_percentage = 100
        r.filepath = ruta; r.image_settings.file_format = 'PNG'
        if guard["samples"] is not None:
            sc.eevee.taa_render_samples = muestras
        bpy.ops.render.render(write_still=True)
    finally:
        for o in escondidos:
            o.hide_render = False
        sc.camera = guard["cam"]
        r.resolution_x = guard["rx"]; r.resolution_y = guard["ry"]; r.resolution_percentage = guard["pct"]
        r.filepath = guard["fp"]; r.image_settings.file_format = guard["fmt"]
        if guard["samples"] is not None:
            sc.eevee.taa_render_samples = guard["samples"]
        if accion:
            quitar_accion()
        sc.frame_set(guard["frame"])
        bpy.data.objects.remove(cam, do_unlink=True)
        bpy.data.cameras.remove(cd)
    return ruta


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def smax(vals, k=0.35):
    m = max(vals)
    return m + k * math.log(sum(math.exp((v - m) / k) for v in vals))


# --- medidas (cm del armature; la bota izquierda, x > 0)
Z_BAJO = -1.0        # la horma baja hasta aquí (se corta en Z_CORTE)
Z0_SUELA = -0.818    # fondo de la suela (lo pone suela())
Z_CORTE = 1.6        # la caña termina abajo aquí, dentro de la banda de la suela
Z_BOCA = 29.5        # boca de la caña (ahí va el rollo)
GROSOR = 0.4         # pared de la caña
HUECO_SUELA = 0.3    # del punto más bajo del pie al fondo de la suela (igual que los tenis)
SUELA_ALTO = 3.5     # alto de la banda de la suela desde el fondo, adelante (atrás sube, ver alto_banda)
SUELA_SALE = 1.2     # lo que la banda sobresale de la caña
PIES = ("Egg_Foot_L",)
PIERNAS = ("Egg_Leg1_L",)

# horma: anillos a lo largo del pie (y, centro x, medio ancho, alto de arriba); de la punta (y<0) al talón.
# Puntiaguda y baja, de moda futurista (Oscar: las redondas no se parecían a su referencia): de lado la
# línea de arriba baja recta del empeine a la punta, y de planta se adelgaza más allá de los dedos hasta
# una punta al centro (cargada hacia adentro se veía chueca, Oscar). Con 1.2 cm del pie a la cara de afuera.
HORMA = [
    (-28.7, XC, 0.6, 3.6),
    (-28.3, XC, 1.9, 4.2),
    (-27.5, XC, 3.0, 4.75),
    (-26.0, XC, 4.15, 5.45),
    (-24.0, XC, 5.7, 6.3),
    (-22.0, XC, 7.7, 7.15),
    (-20.0, XC, 8.45, 8.0),
    (-17.5, XC, 8.7, 9.1),
    (-15.0, XC, 8.9, 10.2),
    (-12.5, XC, 9.3, 11.3),
    (-10.0, XC, 9.4, 12.4),
    (-7.0, XC, 9.4, 13.7),
    (-4.0, XC, 9.3, 15.0),
    (0.0, XC, 9.1, 15.0),
    (4.0, XC, 8.6, 14.0),
    (6.5, XC, 7.5, 11.0),
    (8.4, XC, 5.3, 8.0),
    (9.2, XC, 2.0, 6.0),
]

# caña: anillos alrededor del tobillo (z, medio ancho x, y de enfrente, y de atrás). Calcetín acolchado
# con cuerpo (Oscar: "que no se sienta tan delgadita"): ancho a los lados y al frente y un poco abierto
# arriba; por atrás crece poco, porque corriendo el muslo ya baja a la pantorrilla.
CANA = [
    (Z_BAJO, 9.3, -12.0, 8.9),
    (3.0, 9.3, -11.9, 9.1),
    (6.0, 9.2, -11.7, 8.9),
    (9.0, 9.0, -11.5, 8.4),
    (12.0, 8.8, -11.3, 7.7),
    (14.0, 8.6, -11.3, 7.1),
    (16.0, 8.4, -11.4, 6.2),
    (18.0, 8.25, -11.6, 5.2),
    (20.0, 8.15, -11.9, 4.4),
    (22.0, 8.1, -12.2, 3.8),
    (24.0, 8.1, -12.5, 3.3),
    (26.0, 8.15, -12.8, 3.0),
    (28.0, 8.2, -13.1, 2.7),
    (30.5, 8.25, -13.5, 2.4),
]


def seccion(cx, cy, cz, a, b_arriba, b_abajo, eje, N=48, n_arriba=3.0, n_abajo=7.0):
    """Anillo de caja redondeada: superelipse más cuadrada abajo que arriba.
    eje 'y' = sección perpendicular a y (x-z); eje 'z' = perpendicular a z (x-y)."""
    pts = []
    for i in range(N):
        t = 2 * math.pi * i / N
        c, s = math.cos(t), math.sin(t)
        n = n_arriba if s >= 0 else n_abajo
        u = a * math.copysign(abs(c) ** (2 / n), c)
        w = (b_arriba if s >= 0 else b_abajo) * math.copysign(abs(s) ** (2 / n), s)
        pts.append(Vector((cx + u, cy, cz + w)) if eje == 'y' else Vector((cx + u, cy + w, cz)))
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


def horma_proxy(bm):
    tubo(bm, [seccion(xc, y, Z_BAJO, a, zt - Z_BAJO, 0.01, 'y') for (y, xc, a, zt) in HORMA])


def cana_proxy(bm, paso=1.0):
    zs = [CANA[0][0]]
    while zs[-1] + paso < CANA[-1][0]:
        zs.append(zs[-1] + paso)
    zs.append(CANA[-1][0])
    anillos = []
    for z in zs:
        k = min(max(i for i in range(len(CANA)) if CANA[i][0] <= z), len(CANA) - 2)
        z0, ax0, yf0, yb0 = CANA[k]; z1, ax1, yf1, yb1 = CANA[k + 1]
        t = (z - z0) / (z1 - z0)
        t = t * t * (3 - 2 * t)
        ax = ax0 + (ax1 - ax0) * t; yf = yf0 + (yf1 - yf0) * t; yb = yb0 + (yb1 - yb0) * t
        anillos.append(seccion(XC, (yf + yb) / 2, z, ax, (yb - yf) / 2, (yb - yf) / 2, 'z', n_arriba=2.7, n_abajo=2.7))
    tubo(bm, anillos)


def holgura(p):
    """Lo que tiene que quedar entre el punto del cuerpo y la cara de afuera de la caña (cm)."""
    if p.z > 9.0:          # tobillo y espinilla: la pierna gira contra la caña
        return GROSOR + 1.2
    return GROSOR + 0.7


def inflar(o, puntos, radio=3.0, vueltas=6, zmin=None, zmax=None):
    """Empuja la superficie hacia afuera, con caída suave, donde un punto del cuerpo queda a menos
    de su holgura de la cara de afuera (o afuera). (El mismo de tenis.py.)"""
    zmin = Z_CORTE + 0.6 if zmin is None else zmin
    zmax = Z_BOCA - 0.5 if zmax is None else zmax
    pts = [p for p in puntos if zmin < p.z < zmax]
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
        for v in bm.verts:
            if empuje[v.index] > 0:
                v.co += v.normal * empuje[v.index]
        bm.to_mesh(o.data); bm.free(); o.data.update()
    return round(falto, 3)


def remallar_voxel(o, voxel, suave, factor=0.6):
    activo(o)
    o.data.remesh_voxel_size = voxel
    o.data.use_remesh_fix_poles = True
    bpy.ops.object.voxel_remesh()
    if suave:
        m = o.modifiers.new("suave", 'SMOOTH'); m.factor = factor; m.iterations = suave
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def cortar(o, abajo=Z_CORTE, arriba=Z_BOCA):
    bm = bmesh.new(); bm.from_mesh(o.data)
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=g, plane_co=(0, 0, abajo), plane_no=(0, 0, 1), clear_inner=True)
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=g, plane_co=(0, 0, arriba), plane_no=(0, 0, 1), clear_outer=True)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data); bm.free(); o.data.update()


def bvh_de(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def revisar_remallado(o, ref):
    """Caras volteadas (contra la normal de la superficie de antes en ese punto) y lo más que se alejó."""
    bm = bmesh.new(); bm.from_mesh(o.data); bm.normal_update()
    volteadas = 0; lejos = 0.0
    for f in bm.faces:
        loc, nrm, _, d = ref.find_nearest(f.calc_center_median())
        if loc is not None and f.normal.dot(nrm) < 0:
            volteadas += 1
    for v in bm.verts:
        lejos = max(lejos, ref.find_nearest(v.co)[3])
    bm.free()
    return volteadas, lejos


def quadriflow_seguro(o, caras, intentos=8, lejos_max=0.6, frontera=True, proyectar=True):
    """QuadriFlow con semillas distintas hasta que no voltee nada; si ninguna sale limpia, la mejor."""
    ref = o.data.copy(); ref.name = "bts_qf_ref"
    ref_bvh = bvh_de(o)
    mejor = None; hechas = {ref.name}
    for k in range(intentos):
        o.data = ref.copy(); o.data.name = "bts_qf_%d" % k
        activo(o)
        bpy.ops.object.quadriflow_remesh(target_faces=caras + 30 * k, use_preserve_sharp=False,
                                         use_preserve_boundary=frontera, smooth_normals=False,
                                         use_mesh_symmetry=False, seed=k)
        hechas.add(o.data.name)
        volt, lejos = revisar_remallado(o, ref_bvh)
        nota = (volt, lejos)
        if mejor is None or nota < mejor[0]:
            mejor = (nota, o.data.name)
        if volt == 0 and lejos < lejos_max:
            break
    o.data = bpy.data.meshes[mejor[1]]
    for n in hechas:
        me = bpy.data.meshes.get(n)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    if proyectar:
        # QuadriFlow mueve algunos vértices de la orilla (junto a la punta, hasta 2 cm): de regreso a la forma
        for v in o.data.vertices:
            loc = ref_bvh.find_nearest(v.co)[0]
            if loc is not None:
                v.co = loc
        o.data.update()
    volt, lejos = revisar_remallado(o, ref_bvh)
    return dict(intento=k, volteadas=volt, lejos_antes=round(mejor[0][1], 3), lejos=round(lejos, 3),
                caras=len(o.data.polygons))


def cana(caras=1000):
    """La caña de la bota (horma + caña unidas por voxel), libre del pie y la espinilla, en cuadros.
    QuadriFlow va sobre la caña cerrada y después se cortan el fondo y la boca: con las orillas ya cortadas
    (la de abajo pasa por la punta delgada) dejaba caras volteadas y una tela metida a la altura del empeine."""
    bm = bmesh.new()
    horma_proxy(bm); cana_proxy(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto("bts_cana", bm)
    remallar_voxel(o, 0.38, 6)
    cuerpo = puntos_cuerpo(PIES + PIERNAS)
    f1 = inflar(o, cuerpo, zmin=Z_CORTE + 0.4, zmax=Z_BOCA + 1.0)
    m = o.modifiers.new("suave", 'SMOOTH'); m.factor = 0.5; m.iterations = 4
    activo(o); bpy.ops.object.modifier_apply(modifier=m.name)
    qf = quadriflow_seguro(o, caras, frontera=False)
    cortar(o)
    f2 = inflar(o, cuerpo, radio=2.2)
    # orillas de abajo y de la boca planas y sin picos
    bm = bmesh.new(); bm.from_mesh(o.data)
    for zc in (Z_CORTE, Z_BOCA):
        orilla = [v for v in bm.verts if v.is_boundary and abs(v.co.z - zc) < 0.3]
        for v in orilla:
            v.co.z = zc
        for _ in range(4):
            nuevo = {}
            for v in orilla:
                vec = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                if len(vec) == 2:
                    m2 = (vec[0].co + vec[1].co) / 2
                    nuevo[v] = Vector((v.co.x + (m2.x - v.co.x) * 0.5, v.co.y + (m2.y - v.co.y) * 0.5, zc))
            for v, p in nuevo.items():
                v.co = p
    bm.to_mesh(o.data); bm.free(); o.data.update()
    for p in o.data.polygons:
        p.use_smooth = True
    return o, dict(falto_antes=f1, falto_despues=f2, quadriflow=qf)


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
    """Contorno de abajo de la caña (z = Z_CORTE), en orden, remuestreado y abierto 'sale' hacia afuera
    (2D), más lo que la caña se sale del contorno hasta z_hasta. (Como en tenis.py.)"""
    bm = bmesh.new(); bm.from_mesh(o.data)
    abajo = [v for v in bm.verts if v.is_boundary and v.co.z < Z_CORTE + 0.05]
    lazo = [v.co.copy() for v in lazo_ordenado(bm, abajo[0])]
    bm.free()
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
    for _ in range(6):
        out = [(out[i - 1] + out[i] * 2 + out[(i + 1) % n]) / 4 for i in range(n)]
    area = sum(out[i].x * out[(i + 1) % n].y - out[(i + 1) % n].x * out[i].y for i in range(n)) / 2
    giro = 1 if area > 0 else -1
    nrms = []
    for i in range(n):
        t = (out[(i + 1) % n] - out[i - 1]).normalized()
        nrms.append(Vector((t.y, -t.x)) * giro)
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
        for _ in range(3):
            extra = [max(extra[i - 1], extra[i], extra[(i + 1) % n]) for i in range(n)]
        extra = [(extra[i - 1] + 2 * extra[i] + extra[(i + 1) % n]) / 4 for i in range(n)]
    return [out[i] + nrms[i] * (sale + max(0.0, extra[i])) for i in range(n)]


def contorno_adentro(lazo, d):
    n = len(lazo)
    area = sum(lazo[i].x * lazo[(i + 1) % n].y - lazo[(i + 1) % n].x * lazo[i].y for i in range(n)) / 2
    giro = 1 if area > 0 else -1
    out = []
    for i in range(n):
        t = (lazo[(i + 1) % n] - lazo[i - 1]).normalized()
        out.append(lazo[i] - Vector((t.y, -t.x)) * giro * d)
    return out


MECEDORA_TALON = (2.0, 10.8, 2.3)   # chaflán recto en la orilla de atrás del talón (y desde, y hasta, sube)
PUNTA_SUBE = (-13.0, -29.8, 3.6)    # la punta se dobla hacia arriba (toe spring): y desde, y de la punta, sube


def alto_banda(y):
    """Alto de la banda desde el fondo: más gruesa en el talón (la suela de la referencia es una cuña)."""
    return SUELA_ALTO + 1.8 * smooth(-6.0, 7.0, y)


def tope_pie(pie):
    """f(x, y) = lo más que puede subir el fondo ahí sin quedar a menos de HUECO_SUELA del pie."""
    z0 = min(p.z for p in pie) - HUECO_SUELA
    kd = KDTree(len(pie))
    for i, p in enumerate(pie):
        kd.insert(Vector((p.x, p.y, 0)), i)
    kd.balance()
    def f(x, y):
        # el radio cubre los triángulos vecinos del fondo: entre vértices el fondo es plano y el pie curvo
        cerca = kd.find_range(Vector((x, y, 0)), 3.0)
        return min((pie[i].z for _, i, _ in cerca), default=99.0) - HUECO_SUELA - z0
    return z0, f


def fondo_suela(pie):
    """z del fondo en reposo: plano a HUECO_SUELA bajo lo más bajo del pie y, en el talón, un chaflán recto
    hacia atrás (al pisar con el talón la orilla de atrás se metía al piso). La punta sube con doblar_punta."""
    z0, tope = tope_pie(pie)
    def z(x, y):
        a, b, h = MECEDORA_TALON
        if y <= a:
            return z0
        s = h * min(1.0, (y - a) / (b - a))
        return max(z0, min(z0 + s, z0 + tope(x, y), Z_CORTE - 0.5))
    return z0, z


def tapa(bm, anillo, z_de, paso, arriba):
    """Tapa plana del anillo (verts de bmesh) con puntos por dentro en rejilla, por Delaunay restringido,
    para que el fondo tenga vértices donde doblarse con los dedos. (La de tenis.py.)"""
    from mathutils.geometry import delaunay_2d_cdt
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
    mapa = {}
    for k, co in enumerate(vout):
        mejor = min(range(n), key=lambda i: (P[i] - co).length)
        if (P[mejor] - co).length < 1e-4:
            mapa[k] = anillo[mejor]
        else:
            mapa[k] = bm.verts.new((co.x, co.y, z_de))
    caras = []
    for f in fout:
        vs = [mapa[k] for k in f]
        if not arriba:
            vs = list(reversed(vs))
        try:
            caras.append(bm.faces.new(vs))
        except ValueError:
            pass
    return caras


SUBIDA_PUNTA = 1.7       # lo que la banda sube en la punta (la parte blanca de arriba de la punta)
SUBIDA_DESDE = -16.5     # y donde empieza a subir...
SUBIDA_HASTA = -23.5     # ...y donde ya subió todo


def subida_punta(y):
    return SUBIDA_PUNTA * smooth(SUBIDA_DESDE, SUBIDA_HASTA, y)


def z_banda_arriba(y, z0):
    """Altura de la orilla de arriba de la banda (antes de doblar la punta)."""
    return z0 + alto_banda(y) + subida_punta(y)


def banda(o_cana, z0, zfondo, r_abajo=0.6, r_arriba=0.45, arcos=2, paso_orilla=1.5, paso_fondo=1.7,
          n_arriba=7, grueso_arriba=0.55, labio=0.3, adentro=0.25):
    """La banda de la suela, sólida y cerrada: fondo plano en z0 (con chaflán en el talón), pared derecha y,
    arriba, una orilla que se dobla hacia la caña y se mete en ella (sin repisa plana). En la punta la banda
    sube SUBIDA_PUNTA pegada a la nariz, así la orilla blanca de arriba corre paralela al contorno de la suela
    (Oscar: la punta blanca cortada por un plano se veía rota). Cada columna se mide contra la caña con rayos
    horizontales por su normal, a la misma altura en todas: la orilla sale limpia desde arriba."""
    bvh = bvh_de(o_cana)
    lazo = huella(o_cana, SUELA_SALE, paso_orilla, z_hasta=z0 + alto_banda(10.0) + 0.1)
    n = len(lazo)
    area = sum(lazo[i].x * lazo[(i + 1) % n].y - lazo[(i + 1) % n].x * lazo[i].y for i in range(n)) / 2
    giro = 1 if area > 0 else -1
    bm = bmesh.new()
    normales = []
    for i, q in enumerate(lazo):
        t2 = (lazo[(i + 1) % n] - lazo[i - 1]).normalized()
        normales.append(Vector((t2.y, -t2.x)) * giro)  # normal hacia afuera (2D)
    def d_cana_en(q, nn, z):
        """Qué tan adentro del contorno está la caña a la altura z (None si el rayo no la toca)."""
        o3 = Vector((q.x + nn.x * 6.0, q.y + nn.y * 6.0, z))
        hit = bvh.ray_cast(o3, Vector((-nn.x, -nn.y, 0)), 14.0)[0]
        return None if hit is None else (Vector((q.x, q.y)) - Vector((hit.x, hit.y))).dot(nn)
    # la altura de la orilla de cada columna, sin pasar de donde la caña sigue enfrente (la nariz es baja en
    # la punta), y suavizada entre vecinas para que no quede un pliegue donde se topa
    alturas = []
    for q, nn in zip(lazo, normales):
        zw = z0 + alto_banda(q.y) - r_arriba
        zt = z_banda_arriba(q.y, z0)
        if d_cana_en(q, nn, zt) is None:
            lo, hi = zw, zt
            for _ in range(20):
                m_ = (lo + hi) / 2
                if d_cana_en(q, nn, m_) is None:
                    hi = m_
                else:
                    lo = m_
            zt = max(zw + labio + 0.15, lo - 0.35)
        alturas.append(zt)
    for _ in range(6):
        suave = [(alturas[i - 1] + 2 * alturas[i] + alturas[(i + 1) % n]) / 4 for i in range(n)]
        alturas = [min(a, b) for a, b in zip(alturas, suave)]
    columnas = []          # por columna: lista de (punto, subida 0..1)
    for i, q in enumerate(lazo):
        nn = normales[i]
        def d_cana(z, q=q, nn=nn):
            return d_cana_en(q, nn, z)
        def punto(d, z, q=q, nn=nn):
            return Vector((q.x - nn.x * d, q.y - nn.y * d, z))
        zw = z0 + alto_banda(q.y) - r_arriba          # arriba de la pared derecha
        zt = alturas[i]
        perfil = []
        for k in range(arcos + 1):                    # orilla de abajo y pared
            a = math.pi / 2 * (1 - k / arcos)
            perfil.append((punto(r_abajo - r_abajo * math.cos(a), z0 + r_abajo - r_abajo * math.sin(a)), 0.0))
        perfil.append((punto(0.0, (z0 + r_abajo + zw) / 2), 0.0))
        # arriba: de la pared a la caña, pegada a ella (grueso_arriba), y el labio que se mete en la caña
        curva = []
        d_w = d_cana(zw) or SUELA_SALE
        zl = zt - labio
        for k in range(8):
            z = zw + (zl - zw) * k / 7
            dc = d_cana(z) or d_w
            s = smooth(zw, zl, z)
            g = d_w * (1 - s) + grueso_arriba * s
            curva.append((max(0.0, dc - g), z))
        d_out = curva[-1][0]; d_in = (d_cana(zl) or d_w) + adentro
        dc_ = (d_out + d_in) / 2; ra = (d_in - d_out) / 2
        for k in range(1, 7):
            a = math.pi * k / 6
            curva.append((dc_ - ra * math.cos(a), zl + labio * math.sin(a)))
        # remuestrear la curva a n_arriba puntos parejos (las columnas quedan con el mismo número de filas)
        L = [0.0]
        for a, b in zip(curva, curva[1:]):
            L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        sub = smooth(SUBIDA_DESDE, SUBIDA_HASTA, q.y)
        for k in range(n_arriba):
            s = L[-1] * k / (n_arriba - 1)
            j = next((x for x in range(len(L) - 1) if L[x + 1] >= s), len(L) - 2)
            u = (s - L[j]) / max(1e-9, L[j + 1] - L[j])
            d = curva[j][0] + (curva[j + 1][0] - curva[j][0]) * u
            z = curva[j][1] + (curva[j + 1][1] - curva[j][1]) * u
            perfil.append((punto(d, z), sub * smooth(zw, zl, z)))
        columnas.append(perfil)
    m = len(columnas[0])
    vfilas = [[bm.verts.new(columnas[i][k][0]) for i in range(n)] for k in range(m)]
    for f0, f1 in zip(vfilas, vfilas[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((f0[i], f0[j], f1[j], f1[i]))
    tapa(bm, vfilas[0], z0, paso_fondo, arriba=False)
    tapa(bm, vfilas[-1], z0 + alto_banda(0.0), 99.0, arriba=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.join_triangles(bm, faces=[f for f in bm.faces if len(f.verts) == 3], angle_face_threshold=0.2,
                             angle_shape_threshold=0.9)
    for v in bm.verts:
        sube = zfondo(v.co.x, v.co.y) - z0
        if sube > 0:
            v.co.z += sube * max(0.0, 1 - (v.co.z - z0) / alto_banda(v.co.y))
    # cuánto de cada vértice es "subida" (la parte pegada a la nariz): sus pesos salen de la caña
    sub = {}
    for k in range(m):
        for i in range(n):
            sub[vfilas[k][i].co.copy().freeze()] = columnas[i][k][1]
    o = objeto("bts_suela", bm)
    g = o.vertex_groups.new(name="bts_subida")
    for v in o.data.vertices:
        w = sub.get(v.co.copy().freeze(), 0.0)
        if w > 1e-3:
            g.add([v.index], w, 'REPLACE')
    return o, dict(lazo=lazo, fondo=round(z0, 3), alto=(round(alto_banda(-20), 2), round(alto_banda(9), 2)), orilla=n,
                   caras=len(o.data.polygons))


def arco_corte(bvh, z, c, psi_desde, psi_hasta, g, muestras=170):
    """Corte horizontal de la caña a la altura z, recorrido de psi_desde a psi_hasta alrededor de c, solo
    el tramo donde g(punto) >= 0 (cortado justo en g = 0): puntos, normales horizontales suaves y largo."""
    pts = []
    for k in range(muestras + 1):
        psi = psi_desde + (psi_hasta - psi_desde) * k / muestras
        d = Vector((math.cos(psi), math.sin(psi), 0))
        loc, nrm, _, _ = bvh.ray_cast(Vector((c.x, c.y, z)) + d * 45.0, -d, 70.0)
        if loc is not None:
            pts.append((loc, nrm))
    i0 = next(i for i in range(len(pts) - 1) if g(pts[i][0]) < 0 <= g(pts[i + 1][0]))
    i1 = next(i for i in range(len(pts) - 1, 0, -1) if g(pts[i][0]) < 0 <= g(pts[i - 1][0]))
    def corte(a, b):
        t = (0 - g(a[0])) / (g(b[0]) - g(a[0]))
        return a[0].lerp(b[0], t), a[1].lerp(b[1], t).normalized()
    tramo = [corte(pts[i0], pts[i0 + 1])] + pts[i0 + 1:i1] + [corte(pts[i1], pts[i1 - 1])]
    nrm = [t[1] for t in tramo]
    for _ in range(3):
        nrm = [nrm[0]] + [(nrm[i - 1] + nrm[i] * 2 + nrm[i + 1]).normalized() for i in range(1, len(nrm) - 1)] + [nrm[-1]]
    tramo = [(t[0], Vector((nn.x, nn.y, 0)).normalized()) for t, nn in zip(tramo, nrm)]
    L = [0.0]
    for a, b in zip(tramo, tramo[1:]):
        L.append(L[-1] + (b[0] - a[0]).length)
    return tramo, L


def en_arco(tramo, L, u):
    s = u * L[-1]
    k = next((i for i in range(len(L) - 1) if L[i + 1] >= s), len(L) - 2)
    t = (s - L[k]) / max(1e-9, L[k + 1] - L[k])
    return tramo[k][0].lerp(tramo[k + 1][0], t), tramo[k][1].lerp(tramo[k + 1][1], t).normalized()


def panel_suela(nombre, o_cana, z0, c, psi_desde, psi_hasta, g, z_tope, cols=22, filas=5, arco_n=4,
                adentro=0.25, punta=1.0, grueso_arriba=0.7, r_tope=0.3):
    """Pieza de la suela que sube pegada a la caña (contrafuerte, puntera): un barrido alrededor de c por el
    tramo donde g >= 0, con perfil de orilla definida arriba, hasta z_tope(y). Abajo nace dentro de la banda
    a ras de su pared; en las puntas el perfil se adelgaza (orilla redonda) y el alto llega al de la banda."""
    bvh = bvh_de(o_cana)
    z_desde = Z_CORTE + 0.15
    arcos = {}
    def arco(z):
        k = round(z, 3)
        if k not in arcos:
            arcos[k] = arco_corte(bvh, z, c, psi_desde, psi_hasta, g)
        return arcos[k]
    z_medio = Z_CORTE + 1.0      # altura donde se mide cada columna (la caña empieza en Z_CORTE)
    largo = arco(z_medio)[1][-1]
    us = [0.5 - 0.5 * math.cos(math.pi * k / cols) for k in range(cols + 1)]
    def ancho(u):
        s = min(u, 1 - u) * largo
        return 1.0 if s >= punta else max(0.12, math.sqrt(max(0.0, 1 - (1 - s / punta) ** 2)))
    bm = bmesh.new()
    lazos = []
    for u in us:
        e = ancho(u)
        pm, _ = en_arco(*arco(z_medio), u)
        zb = z0 + alto_banda(pm.y)
        zc = max(zb + 0.2, z_tope(pm.y))
        zc = zb + (zc - zb) * (0.3 + 0.7 * e)
        def grueso(z):
            return (SUELA_SALE - 0.05) + (grueso_arriba - SUELA_SALE + 0.05) * smooth(zb - 0.6, zc - r_tope, z)
        perfil = []
        for j in range(filas + 1):
            z = z_desde + (zc - r_tope - z_desde) * j / filas
            perfil.append((grueso(z) * e, z))
        s_out = grueso(zc - r_tope) * e; s_in = -adentro * e
        sc = (s_out + s_in) / 2; ra = (s_out - s_in) / 2
        for k in range(1, arco_n):
            a = math.pi * k / arco_n
            perfil.append((sc + ra * math.cos(a), zc - r_tope + r_tope * math.sin(a)))
        perfil.append((s_in, zc - r_tope))
        perfil.append((s_in, z_desde))
        lazo = []
        for (s, z) in perfil:
            p, n = en_arco(*arco(z), u)
            lazo.append(bm.verts.new(p + n * s))
        lazos.append(lazo)
    m = len(lazos[0])
    for a, b in zip(lazos, lazos[1:]):
        for i in range(m):
            j = (i + 1) % m
            bm.faces.new((a[i], b[i], b[j], a[j]))
    bm.faces.new(list(reversed(lazos[0])))
    bm.faces.new(lazos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto(nombre, bm)
    return o, dict(columnas=cols + 1, perfil=m, caras=len(o.data.polygons))


# contrafuerte en triángulo: la orilla de arriba es una diagonal recta del talón (arriba) a la banda (al frente)
CONTRA_FRENTE = -3.0
CONTRA_ALTO = 12.2


def z_contrafuerte(y, z0):
    zb = z0 + alto_banda(CONTRA_FRENTE)
    return zb + (CONTRA_ALTO - zb) * min(1.0, max(0.0, (y - CONTRA_FRENTE) / (8.8 - CONTRA_FRENTE)))


def doblar_punta(objs, pie):
    """Dobla hacia arriba la punta de todas las piezas por igual (toe spring de la referencia): sube con y
    al cuadrado hasta PUNTA_SUBE en la punta, sin acercar el fondo al pie más que HUECO_SUELA."""
    z0, tope = tope_pie(pie)
    y0, y1, h = PUNTA_SUBE
    def sube(x, y):
        if y >= y0:
            return 0.0
        return max(0.0, min(h * min(1.0, (y0 - y) / (y0 - y1)) ** 2, tope(x, y)))
    for o in objs:
        for v in o.data.vertices:
            v.co.z += sube(v.co.x, v.co.y)
        at = o.data.attributes
        if all(n in at for n in BASE_CAPAS):
            xs, ys, zs = (at[n].data for n in BASE_CAPAS)
            for i in range(len(o.data.vertices)):
                zs[i].value += sube(xs[i].value, ys[i].value)
        o.data.update()


# --- la huella: dibujo de la suela por abajo (chevrones al frente, barras en el talón, una placa en el arco y
# una línea que sigue la orilla) y una línea en el costado de la banda. Tiras planas oscuras apenas afuera
# de la cara de la banda.
HUELLA_ANCHO = 0.42


def _dentro(P, q):
    c = False; n = len(P)
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        if (a.y > q.y) != (b.y > q.y) and q.x < a.x + (q.y - a.y) * (b.x - a.x) / (b.y - a.y):
            c = not c
    return c


def dibujo_suela(o_suela, lazo, z0, r_abajo=0.6):
    bvh = bvh_de(o_suela)
    adentro = contorno_adentro(lazo, r_abajo + 0.9)       # la orilla del dibujo
    bm = bmesh.new(); n_tiras = 0
    def abajo(q):
        loc, nrm, _, _ = bvh.ray_cast(Vector((q.x, q.y, z0 - 6.0)), Vector((0, 0, 1)), 12.0)
        if loc is None:
            return None
        if nrm.z > 0:
            nrm = -nrm
        return loc + nrm * 0.025, nrm
    def tira(pts2d, ancho=HUELLA_ANCHO, cerrada=False):
        """Tira plana por una polilínea 2D (solo los tramos dentro del contorno del dibujo)."""
        nonlocal n_tiras
        tramos = [[]]
        for q in pts2d:
            if _dentro(adentro, q):
                tramos[-1].append(q)
            elif tramos[-1]:
                tramos.append([])
        if cerrada and len(tramos) == 1 and len(tramos[0]) == len(pts2d):
            tramos = [pts2d + pts2d[:1]]
        for tr in tramos:
            if len(tr) < 2:
                continue
            filas = []
            for i, q in enumerate(tr):
                h = abajo(q)
                if h is None:
                    break
                p, n = h
                a = tr[max(0, i - 1)]; b = tr[min(len(tr) - 1, i + 1)]
                t = Vector((b.x - a.x, b.y - a.y, 0)).normalized()
                lado = t.cross(n).normalized() * (ancho / 2)
                filas.append((bm.verts.new(p - lado), bm.verts.new(p + lado)))
            for (a0, a1), (b0, b1) in zip(filas, filas[1:]):
                f = bm.faces.new((a0, a1, b1, b0)); f.normal_update()
                if f.normal.z > 0:
                    f.normal_flip()
            n_tiras += 1
    def muestras(a, b, paso=0.45):
        # fino solo donde el fondo se dobla (punta y talón); en lo plano la tira es recta
        if -14.0 < (a.y + b.y) / 2 < 1.0:
            paso = 2.5
        n = max(1, int((b - a).length / paso))
        return [a.lerp(b, k / n) for k in range(n + 1)]
    # chevrones en la parte de enfrente (apuntan a la punta) y en el talón (apuntan atrás)
    y = -26.0
    while y < -8.0:
        punta = Vector((XC, y - 1.3))
        tira(muestras(Vector((XC - 9.0, y + 1.7)), punta) + muestras(punta, Vector((XC + 9.0, y + 1.7)))[1:])
        y += 1.7
    y = 1.8
    while y < 9.5:
        cola = Vector((XC, y + 0.9))
        tira(muestras(Vector((XC - 9.0, y - 0.9)), cola) + muestras(cola, Vector((XC + 9.0, y - 0.9)))[1:])
        y += 1.6
    # placa del arco (rectángulo de esquinas redondas) y la línea de la orilla
    placa = []
    for k in range(24):
        a = 2 * math.pi * k / 24
        c, s_ = math.cos(a), math.sin(a)
        placa.append(Vector((XC + 3.0 * math.copysign(abs(c) ** 0.5, c), -3.4 + 2.6 * math.copysign(abs(s_) ** 0.5, s_))))
    tira(placa, cerrada=True)
    tira(contorno_adentro(lazo, r_abajo + 0.45), ancho=0.3, cerrada=True)
    o = objeto("bts_huella", bm)
    return o, n_tiras


def linea_costado(o_suela, lazo, z0, ancho=0.24):
    """Línea en el costado de la banda, a media altura (como el molde de una suela)."""
    bvh = bvh_de(o_suela)
    n = len(lazo)
    area = sum(lazo[i].x * lazo[(i + 1) % n].y - lazo[(i + 1) % n].x * lazo[i].y for i in range(n)) / 2
    giro = 1 if area > 0 else -1
    bm = bmesh.new(); filas = []
    for i, q in enumerate(lazo):
        t = (lazo[(i + 1) % n] - lazo[i - 1]).normalized()
        nn = Vector((t.y, -t.x, 0)) * giro
        z = z0 + 0.42 * alto_banda(q.y)
        loc, nrm, _, _ = bvh.ray_cast(Vector((q.x, q.y, z)) + nn * 5.0, -nn, 10.0)
        if loc is None:
            loc, nrm = Vector((q.x, q.y, z)), nn
        p = loc + nrm * 0.02
        filas.append((bm.verts.new(p - Vector((0, 0, ancho / 2))), bm.verts.new(p + Vector((0, 0, ancho / 2)))))
    for i in range(n):
        (a0, a1), (b0, b1) = filas[i], filas[(i + 1) % n]
        f = bm.faces.new((a0, b0, b1, a1)); f.normal_update()
    bm.normal_update()
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.dot(Vector((c.x - XC, c.y + 9.0, 0))) < 0:
            f.normal_flip()
    return objeto("bts_costado", bm)


def suela(o_cana):
    """Banda de la suela (sube en la punta), contrafuerte en triángulo y el dibujo de la suela."""
    global Z0_SUELA
    pie = puntos_cuerpo(PIES)
    z0, zfondo = fondo_suela(pie)
    Z0_SUELA = z0
    o, info = banda(o_cana, z0, zfondo)
    lazo = info.pop("lazo")
    oc, info["contrafuerte"] = panel_suela("bts_contra", o_cana, z0, Vector((XC, 0.5)), -1.0, math.pi + 1.0,
                                           lambda p: p.y - CONTRA_FRENTE, lambda y: z_contrafuerte(y, z0),
                                           punta=1.6)
    _, info["dibujo"] = dibujo_suela(o, lazo, z0)
    linea_costado(o, lazo, z0)
    for x in (o, oc):
        for p in x.data.polygons:
            p.use_smooth = True
    return o, info


# --- superficie de la caña para pegar cosas encima y sacar pesos (como en tenis.py)
class Superficie:
    def __init__(self, o):
        me = o.data
        me.calc_loop_triangles()
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


def perfil_frente(o, paso=0.25):
    """Corte de la caña con el plano x = XC, el tramo de enfrente, de abajo a la boca, remuestreado."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    r = bmesh.ops.bisect_plane(bm, geom=g, plane_co=(XC, 0, 0), plane_no=(1, 0, 0))
    aristas = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    vec = {}
    for e in aristas:
        a, b = e.verts
        vec.setdefault(a, []).append(b); vec.setdefault(b, []).append(a)
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
    return pts, total / n, total


class Mapa:
    """(s, l) sobre el frente de la caña: s = largo sobre el perfil del centro (de abajo a la boca y, más
    arriba, recto por la tangente), l = de lado (x - XC)."""
    def __init__(self, o):
        self.sup = Superficie(o)
        self.pts, self.paso, self.total = perfil_frente(o)

    def s_de_z(self, z):
        for i in range(len(self.pts) - 1):
            if self.pts[i].z <= z <= self.pts[i + 1].z:
                t = (z - self.pts[i].z) / max(1e-9, self.pts[i + 1].z - self.pts[i].z)
                return (i + t) * self.paso
        return 0.0 if z < self.pts[0].z else self.total

    def en(self, s):
        n = len(self.pts)
        if s >= self.total:
            t = (self.pts[-1] - self.pts[-6]).normalized()
            return self.pts[-1] + t * (s - self.total), t
        f = max(0.0, s / self.paso); i = min(n - 2, int(f)); u = f - i
        p = self.pts[i].lerp(self.pts[i + 1], u)
        t = (self.pts[min(n - 1, i + 2)] - self.pts[max(0, i - 1)]).normalized()
        return p, t

    def punto(self, s, l):
        """Punto de la superficie en (s, l) y su normal; arriba de la boca sigue recto con la normal de la orilla."""
        p, _ = self.en(min(s, self.total))
        loc, nrm, _, _ = self.sup.cerca(p + Vector((l, 0, 0)))
        if s > self.total:
            p2, _ = self.en(s)
            loc = loc + (p2 - p)
        return loc, nrm


def sd_caja_redonda(x, y, bx, by, r):
    """Distancia con signo a un rectángulo de esquinas redondas (medio ancho bx, medio alto by)."""
    qx = abs(x) - bx + r; qy = abs(y) - by + r
    fuera = math.hypot(max(qx, 0.0), max(qy, 0.0))
    return fuera + min(max(qx, qy), 0.0) - r


BASE_CAPAS = ("bts_bx", "bts_by", "bts_bz")


def capas_base(bm):
    return [bm.verts.layers.float.get(n) or bm.verts.layers.float.new(n) for n in BASE_CAPAS]


def marcar_base(capas, v, p):
    """Guarda en el vértice el punto de la superficie sobre la que se armó: sus pesos salen de ahí. Del punto más
    cercano a cada vértice, en el pliegue del empeine la lengüeta, el vivo y la correa de abajo tomaban unos
    del pie y otros de la espinilla y se cruzaban al doblar el tobillo (el idle lo dobla 25°)."""
    v[capas[0]] = p.x; v[capas[1]] = p.y; v[capas[2]] = p.z


def base_de_vertices(o):
    """El punto base de cada vértice (o su posición si la pieza no lo guarda)."""
    at = o.data.attributes
    if all(n in at for n in BASE_CAPAS):
        xs, ys, zs = (at[n].data for n in BASE_CAPAS)
        return [Vector((xs[i].value, ys[i].value, zs[i].value)) for i in range(len(o.data.vertices))]
    return [v.co.copy() for v in o.data.vertices]


def almohada(nombre, base, nu, nv, grosor, r_borde, hueco, dist, plana=False, parejo_u=False):
    """Pieza acolchada: dos caras (frente y espalda) sobre la rejilla base(u, v) -> (punto, normal), que se
    juntan en la orilla con perfil de elipse (orilla redonda, sin arista). dist(u, v) = distancia a la orilla
    en cm. grosor y hueco pueden ser números o funciones de (u, v). Las filas y columnas van más juntas cerca
    de la orilla."""
    f_grosor = grosor if callable(grosor) else (lambda u, v: grosor)
    f_hueco = hueco if callable(hueco) else (lambda u, v: hueco)
    # parejo_u: columnas a lo largo parejas (las correas: juntas solo en las puntas dejaban caras largas en
    # medio que cortaban la lengüeta)
    us = ([i / nu for i in range(nu + 1)] if parejo_u else
          [0.5 - 0.5 * math.cos(math.pi * i / nu) for i in range(nu + 1)])
    vs = [0.5 - 0.5 * math.cos(math.pi * j / nv) for j in range(nv + 1)]
    bm = bmesh.new()
    capas = capas_base(bm)
    frente = []; espalda = []
    for j, v in enumerate(vs):
        ff = []; ee = []
        for i, u in enumerate(us):
            p, n = base(u, v)
            borde = i in (0, nu) or j in (0, nv)
            d = 0.0 if borde else max(0.0, dist(u, v))
            g = math.sqrt(max(0.0, 1 - (1 - min(d / r_borde, 1.0)) ** 2))
            t = f_grosor(u, v); h = f_hueco(u, v)
            if plana:      # abajo pegada a la base, arriba con la orilla redonda
                ff.append(bm.verts.new(p + n * (h + t * g)))
                ee.append(ff[-1] if borde else bm.verts.new(p + n * h))
            else:
                medio = h + t / 2
                ff.append(bm.verts.new(p + n * (medio + t / 2 * g)))
                ee.append(ff[-1] if borde else bm.verts.new(p + n * (medio - t / 2 * g)))
            marcar_base(capas, ff[-1], p); marcar_base(capas, ee[-1], p)
        frente.append(ff); espalda.append(ee)
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((frente[j][i], frente[j][i + 1], frente[j + 1][i + 1], frente[j + 1][i]))
            bm.faces.new((espalda[j][i], espalda[j + 1][i], espalda[j + 1][i + 1], espalda[j][i + 1]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto(nombre, bm)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# --- lengüeta: paleta gruesa al frente de la caña que sobresale arriba del rollo
LENGUA_DESDE = 10.6      # z donde nace, en el empeine (sale de la garganta, detrás de la puntera)
LENGUA_SALE = 0.6        # lo que sube arriba de la boca
LENGUA_ANCHO_BASE = 3.4  # medio ancho donde nace
LENGUA_ANCHO = 6.3       # medio ancho de la correa para arriba (abraza el frente del calcetín)
LENGUA_GROSOR = 2.4      # acolchada (en la base, 0.7: sale de debajo de la puntera)
LENGUA_BORDE = 0.55
LENGUA_INCLINA = 0.8     # lo que se va al frente la punta
LENGUA_ESQUINA = 2.4     # radio de las esquinas de arriba
LENGUA_ESQUINA_BASE = 1.8


def forma_lengua(mapa):
    """La silueta de la lengüeta en (s, l) del frente de la caña: s0..s1 y el medio ancho lim(s)."""
    s0 = mapa.s_de_z(LENGUA_DESDE); s1 = mapa.total + LENGUA_SALE
    s_correa = mapa.s_de_z(z_correa(0.0))
    def ancho(s):
        return LENGUA_ANCHO_BASE + (LENGUA_ANCHO - LENGUA_ANCHO_BASE) * smooth(s0, s0 + (s_correa - s0) * 1.1, s)
    def lim(s):
        w = ancho(s)
        r = LENGUA_ESQUINA
        if s > s1 - r:
            return w - r + math.sqrt(max(0.0, r * r - (s - (s1 - r)) ** 2))
        r = LENGUA_ESQUINA_BASE
        if s < s0 + r:
            return w - r + math.sqrt(max(0.0, r * r - (s0 + r - s) ** 2))
        return w
    return s0, s1, lim


def lengueta(mapa):
    """La lengüeta grande de la referencia: nace delgada en el empeine (un poco dentro de la caña, como si
    saliera de debajo de la puntera), se engruesa a 2 cm y sube ancha por el frente del calcetín hasta la boca."""
    s0, s1, lim = forma_lengua(mapa)
    def sl(u, v):
        s = s0 + (s1 - s0) * v
        return s, (u * 2 - 1) * lim(s)
    def base(u, v):
        s, l = sl(u, v)
        p, n = mapa.punto(s, l)
        if s > mapa.total:      # al salir se separa un poco hacia adelante (de la espinilla)
            p = p + n * LENGUA_INCLINA * ((s - mapa.total) / LENGUA_SALE) ** 2
        return p, n
    def dist(u, v):
        # con la misma forma que la rejilla: si no, las esquinas quedan fuera de la orilla y sus dos caras se
        # juntan (aristas con tres caras)
        s, l = sl(u, v)
        return min(lim(s) - abs(l), s - s0, s1 - s)
    def grosor(u, v):
        s, _ = sl(u, v)
        return 0.7 + (LENGUA_GROSOR - 0.7) * smooth(s0, s0 + 5.0, s)
    def hueco(u, v):
        s, _ = sl(u, v)
        return -0.45 + 0.65 * smooth(s0, s0 + 2.5, s)
    o = almohada("bts_lengua", base, 10, 16, grosor, LENGUA_BORDE, hueco, dist)
    return o, dict(s0=round(s0, 2), s1=round(s1, 2))


def garganta(mapa, r=0.42, lados=6, aparte=0.8):
    """La orilla de la puntera alrededor de donde sale la lengüeta (una U de vivo, como la garganta de un
    tenis): sube por los dos lados hasta esconderse bajo la correa."""
    s0, s1, lim = forma_lengua(mapa)
    s_fin = mapa.s_de_z(z_correa(0.0) - CORREA_ANCHO + 0.9)
    rb = LENGUA_ESQUINA_BASE
    pts = []
    n_lado = 10
    def ap(s):
        # arriba se abre un poco más: ahí la lengüeta ya es ancha y en el idle (tobillo doblado) la rozaba
        return aparte + 0.6 * smooth(s0 + 3.0, s_fin, s)
    for k in range(n_lado + 1):                       # un lado, de arriba hacia abajo
        s = s_fin + (s0 + rb - s_fin) * k / n_lado
        pts.append((s, -(lim(s) + ap(s))))
    w0 = lim(s0 + rb)
    for k in range(1, 7):                             # esquina
        a = math.pi + math.pi / 2 * k / 6
        pts.append((s0 + rb + (rb + aparte) * math.sin(a), -(w0 - rb) + (rb + aparte) * math.cos(a)))
    for k in range(1, 6):                             # fondo
        l = -(w0 - rb) + 2 * (w0 - rb) * k / 6
        pts.append((s0 - aparte, l))
    for k in range(0, 7):                             # esquina
        a = math.pi * 1.5 + math.pi / 2 * k / 6
        pts.append((s0 + rb + (rb + aparte) * math.sin(a), (w0 - rb) + (rb + aparte) * math.cos(a)))
    for k in range(1, n_lado + 1):                    # el otro lado, hacia arriba
        s = s0 + rb + (s_fin - s0 - rb) * k / n_lado
        pts.append((s, lim(s) + ap(s)))
    centros = []; nrms = []; bases = []
    for (s, l) in pts:
        p, n = mapa.punto(s, l)
        centros.append(p + n * (r * 0.7)); nrms.append(n); bases.append(p)
    A = []; B = []
    m = len(centros)
    for i in range(m):
        t = (centros[min(m - 1, i + 1)] - centros[max(0, i - 1)]).normalized()
        nn = (nrms[i] - t * nrms[i].dot(t)).normalized()
        A.append(nn); B.append(t.cross(nn).normalized())
    bm = bmesh.new()
    tubo_camino(bm, centros, A, B, r, r, lados, bases=bases)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto("bts_garganta", bm)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def perforaciones(mapa, r=0.2, paso=1.32, lados=6):
    """Los puntitos perforados de la puntera de la referencia: discos chicos oscuros sobre la parte de arriba
    de la puntera, en tresbolillo, entre la punta blanca y la garganta."""
    s0, _, lim = forma_lengua(mapa)
    s_ini = mapa.s_de_z(Z_CORTE + 2.0)
    s_fin = s0 - 1.3
    bm = bmesh.new(); n_puntos = 0
    fila = 0; s = s_ini
    while s <= s_fin:
        desfase = 0.5 * paso if fila % 2 else 0.0
        centro_x = mapa.punto(s, 0.0)[0].x
        for k in range(-6, 7):
            l = k * paso + desfase
            if abs(l) > 6.0:
                continue
            p, n = mapa.punto(s, l)
            if n.z > 0.3 and abs(p.x - centro_x) <= 5.4 and p.z > z_banda_arriba(p.y, Z0_SUELA) + 0.9:
                X = n.cross(Vector((0, 1, 0)))
                if X.length < 1e-3:
                    X = n.cross(Vector((1, 0, 0)))
                X.normalize(); Y = n.cross(X).normalized()
                c = p + n * 0.03
                vs = [bm.verts.new(c + (X * math.cos(2 * math.pi * k / lados) + Y * math.sin(2 * math.pi * k / lados)) * r)
                      for k in range(lados)]
                f = bm.faces.new(vs)
                f.normal_update()
                if f.normal.dot(n) < 0:
                    f.normal_flip()
                n_puntos += 1
        s += paso * 0.9; fila += 1
    o = objeto("bts_perforado", bm)
    return o, n_puntos


# --- correa: banda acolchada que cruza el frente del tobillo, encima de la lengüeta
CORREA_EJE = Vector((XC, -3.6))
CORREA_ANCHO = 2.5       # medio ancho (vertical)
CORREA_PHI0 = math.radians(-100)   # punta de adentro; 0 = al frente
CORREA_PHI1 = math.radians(128)    # punta de afuera: da la vuelta hacia el talón
CORREA_GROSOR = 1.0
CORREA_BORDE = 0.32


def z_correa(phi):
    # casi horizontal: sube apenas hacia atrás
    return 19.4 + 0.7 * (1 - math.cos(phi))


def phi_de(u):
    return CORREA_PHI0 + (CORREA_PHI1 - CORREA_PHI0) * u


def radial(phi):
    return Vector((math.sin(phi), -math.cos(phi), 0.0))


def radios_pegados(tabla, ensancha=2, suaviza=3, piso=None):
    """tabla[i][j] = radio de la superficie en el ángulo i y la fila j. Cada fila: el máximo de unas pocas
    vecinas (para pasar por la orilla de la lengüeta en rampa corta) y suavizado. piso[i][j] (opcional) = lo
    más alto de los vértices de lo que va debajo en esa celda: el resultado nunca baja de ahí (el suavizado
    bajaba la correa justo en las orillas angostas, el vivo de la garganta, y se metía en ellas). Devuelve
    f(fi, fj) bilineal en índices fraccionarios."""
    ni, nj = len(tabla), len(tabla[0])
    if piso:
        # el piso, ensanchado una celda en las dos direcciones (las caras de la correa son planas entre filas)
        p2 = [[max(piso[ii][jj] for ii in range(max(0, i - 1), min(ni, i + 2)) for jj in range(max(0, j - 1), min(nj, j + 2)))
               for j in range(nj)] for i in range(ni)]
        tabla = [[max(tabla[i][j], p2[i][j]) for j in range(nj)] for i in range(ni)]
    filas = []
    for j in range(nj):
        col = [tabla[i][j] for i in range(ni)]
        for _ in range(ensancha):
            col = [max(col[max(0, i - 1)], col[i], col[min(ni - 1, i + 1)]) for i in range(ni)]
        for _ in range(suaviza):
            col = [col[0]] + [(col[i - 1] + 2 * col[i] + col[i + 1]) / 4 for i in range(1, ni - 1)] + [col[-1]]
        if piso:
            col = [max(c, p2[i][j]) for i, c in enumerate(col)]
        filas.append(col)
    def f(fi, fj):
        i = max(0, min(ni - 2, int(fi))); ti = min(1.0, max(0.0, fi - i))
        j = max(0, min(nj - 2, int(fj))); tj = min(1.0, max(0.0, fj - j))
        a = filas[j][i] * (1 - ti) + filas[j][i + 1] * ti
        b = filas[j + 1][i] * (1 - ti) + filas[j + 1][i + 1] * ti
        return a * (1 - tj) + b * tj
    return f


def piso_de(objs, coords, ni, nj):
    """Lo más alto (radio) de los vértices de 'objs' en cada celda (i, j) de la rejilla de una correa.
    coords(p) -> (fi, fj, r) en índices fraccionarios, o None si cae fuera."""
    piso = [[0.0] * nj for _ in range(ni)]
    for o in objs:
        for v in o.data.vertices:
            c = coords(v.co)
            if c is None:
                continue
            fi, fj, r = c
            i = int(round(fi)); j = int(round(fj))
            if 0 <= i < ni and 0 <= j < nj and r > piso[i][j]:
                piso[i][j] = r
    return piso


def correa(objs, hueco=0.15, nu=44, nv=6):
    """La correa sobre la caña y la lengüeta, pegada a ellas (Oscar: que queden pegadas a la bota)."""
    bvhs = [bvh_de(o) for o in objs]
    phis = [phi_de(k / 120) for k in range(121)]
    zs = [-CORREA_ANCHO - 0.6 + (2 * CORREA_ANCHO + 1.2) * k / 12 for k in range(13)]
    def r_env(phi, z):
        d = radial(phi)
        o = Vector((CORREA_EJE.x, CORREA_EJE.y, z)) + d * 40.0
        mejor = 0.0
        for b in bvhs:
            loc = b.ray_cast(o, -d, 60.0)[0]
            if loc is not None:
                mejor = max(mejor, (Vector((loc.x, loc.y)) - CORREA_EJE).length)
        return mejor
    tabla = [[r_env(phi, z_correa(phi) + dz) for dz in zs] for phi in phis]
    col = [max(c) for c in tabla]
    def coords(p):
        q = Vector((p.x - CORREA_EJE.x, p.y - CORREA_EJE.y))
        phi = math.atan2(q.x, -q.y)
        if not (CORREA_PHI0 - 0.05 <= phi <= CORREA_PHI1 + 0.05):
            return None
        dz = p.z - z_correa(phi)
        if not (zs[0] <= dz <= zs[-1]):
            return None
        return ((phi - CORREA_PHI0) / (CORREA_PHI1 - CORREA_PHI0) * (len(phis) - 1),
                (dz - zs[0]) / (zs[-1] - zs[0]) * (len(zs) - 1), q.length)
    radio = radios_pegados(tabla, ensancha=4, piso=piso_de(objs, coords, len(phis), len(zs)))
    def r_de(phi, dz=0.0):
        fi = (phi - CORREA_PHI0) / (CORREA_PHI1 - CORREA_PHI0) * (len(phis) - 1)
        fj = (dz - zs[0]) / (zs[-1] - zs[0]) * (len(zs) - 1)
        return radio(fi, fj)
    largo = sum((radial(phis[k + 1]) * r_de(phis[k + 1]) - radial(phis[k]) * r_de(phis[k])).length
                for k in range(len(phis) - 1))
    A = largo / 2; r_punta = 0.9
    def ancho(u):
        a = abs(u - 0.5) * largo
        if a <= A - r_punta:
            return CORREA_ANCHO
        return CORREA_ANCHO - r_punta + math.sqrt(max(0.0, r_punta ** 2 - (a - (A - r_punta)) ** 2))
    def base(u, v):
        phi = phi_de(u)
        dz = (v * 2 - 1) * ancho(u)
        d = radial(phi)
        return Vector((CORREA_EJE.x, CORREA_EJE.y, z_correa(phi) + dz)) + d * r_de(phi, dz), d
    def dist(u, v):
        w = ancho(u)
        return min(w - abs(v * 2 - 1) * w, A - abs(u - 0.5) * largo)
    o = almohada("bts_correa", base, nu, nv, CORREA_GROSOR, CORREA_BORDE, hueco, dist, plana=True, parejo_u=True)
    return o, dict(largo=round(largo, 1), r_min=round(min(col), 2), r_max=round(max(col), 2)), base


# --- segunda correa: cruza el empeine sobre la base de la lengüeta, donde sale de la bota (Oscar). Va en el
# plano perpendicular a la subida del empeine: sus direcciones salen de un punto dentro del pie, por arriba
# (sobre la lengüeta) y a los dos costados.
CORREA2_S = -0.5         # cm sobre el frente desde donde nace la lengüeta (toda en el empeine: en la esquina
                         # con el frente del calcetín, la mitad se trepaba hasta la correa de arriba)
CORREA2_ANCHO = 1.6      # medio ancho
CORREA2_PHI = math.radians(82)
CORREA2_HONDO = 7.0      # qué tan adentro va el centro de los rayos


def correa_baja(mapa, objs, hueco=0.2, nu=34, nv=6):
    s0, s1, lim = forma_lengua(mapa)
    s_c = s0 + CORREA2_S
    _, t = mapa.en(s_c)
    loc, nrm = mapa.punto(s_c, 0.0)
    A = t.normalized()                                   # a lo largo del empeine (el ancho de la correa)
    U = (nrm - A * nrm.dot(A)).normalized()              # hacia arriba, sobre la lengüeta
    V = A.cross(U).normalized()
    if V.x < 0:
        V = -V                                           # +x: el costado de afuera (bota izquierda)
    C = loc - U * CORREA2_HONDO
    bvhs = [bvh_de(o) for o in objs]
    def d(phi):
        return U * math.cos(phi) + V * math.sin(phi)
    def r_env(phi, a, desde=40.0):
        o = C + A * a
        dd = d(phi)
        mejor = 0.0
        for b in bvhs:
            hit = b.ray_cast(o + dd * desde, -dd, desde + 20.0)[0]
            if hit is not None:
                mejor = max(mejor, (hit - o).dot(dd))
        return mejor
    phis = [-CORREA2_PHI + 2 * CORREA2_PHI * k / 120 for k in range(121)]
    aes = [-CORREA2_ANCHO - 0.6 + (2 * CORREA2_ANCHO + 1.2) * k / 12 for k in range(13)]
    # cada fila busca la superficie cerca de la del centro: desde lejos, la orilla de arriba agarraba la parte
    # de la lengüeta que ya sube por el calcetín (a 17 cm) y la correa se estiraba hasta la de arriba
    r0 = [r_env(phi, 0.0) for phi in phis]
    tabla = [[r_env(phi, a, desde=r + 2.5) or r for a in aes] for phi, r in zip(phis, r0)]
    col = [max(c) for c in tabla]
    def coords(p):
        w = p - C
        a = w.dot(A)
        if not (aes[0] <= a <= aes[-1]):
            return None
        w = w - A * a
        phi = math.atan2(w.dot(V), w.dot(U))
        if not (-CORREA2_PHI - 0.05 <= phi <= CORREA2_PHI + 0.05):
            return None
        r = w.length
        if r > max(r0) + 4.0:          # lo que ya va lejos (la lengüeta que sube por el calcetín)
            return None
        return ((phi + CORREA2_PHI) / (2 * CORREA2_PHI) * (len(phis) - 1),
                (a - aes[0]) / (aes[-1] - aes[0]) * (len(aes) - 1), r)
    radio = radios_pegados(tabla, ensancha=3, suaviza=6, piso=piso_de(objs, coords, len(phis), len(aes)))
    def r_de(phi, a=0.0):
        fi = (phi + CORREA2_PHI) / (2 * CORREA2_PHI) * (len(phis) - 1)
        fj = (a - aes[0]) / (aes[-1] - aes[0]) * (len(aes) - 1)
        return radio(fi, fj)
    largo = sum((d(phis[k + 1]) * r_de(phis[k + 1]) - d(phis[k]) * r_de(phis[k])).length for k in range(len(phis) - 1))
    L2 = largo / 2; r_punta = 0.9
    def ancho(u):
        a = abs(u - 0.5) * largo
        if a <= L2 - r_punta:
            return CORREA2_ANCHO
        return CORREA2_ANCHO - r_punta + math.sqrt(max(0.0, r_punta ** 2 - (a - (L2 - r_punta)) ** 2))
    def base(u, v):
        phi = -CORREA2_PHI + 2 * CORREA2_PHI * u
        a = (v * 2 - 1) * ancho(u)
        return C + A * a + d(phi) * r_de(phi, a), d(phi)
    def dist(u, v):
        w = ancho(u)
        return min(w - abs(v * 2 - 1) * w, L2 - abs(u - 0.5) * largo)
    o = almohada("bts_correa2", base, nu, nv, CORREA_GROSOR, CORREA_BORDE, hueco, dist, plana=True, parejo_u=True)
    return o, dict(largo=round(largo, 1), r_min=round(min(col), 2), r_max=round(max(col), 2)), base


def hebilla_baja(base2, phi=math.radians(62), medidas=(3.4, 2.3, 0.5)):
    """Hebilla amarilla en el costado de afuera de la correa de abajo."""
    u = (phi + CORREA2_PHI) / (2 * CORREA2_PHI)
    p, dd = base2(u, 0.5)
    p2, _ = base2(u + 0.01, 0.5)
    X = (p2 - p).normalized(); Z = dd
    Y = Z.cross(X).normalized(); X = Y.cross(Z).normalized()
    centro = p + Z * (0.12 + CORREA_GROSOR - 0.08 + medidas[2] / 2)
    return caja_redonda("bts_hebilla2", centro, X, Y, Z, medidas, radio=0.14, segmentos=2)


def tubo_camino(bm, centros, ejes_a, ejes_b, ra, rb, lados, cerrado=False, tapas=True, bases=None):
    """Tubo de sección elíptica por una lista de centros; ra/rb pueden ser listas (uno por centro). bases
    (opcional): el punto de la superficie bajo cada centro, para los pesos."""
    filas = []
    capas = capas_base(bm) if bases else None
    for k, (c, A, B) in enumerate(zip(centros, ejes_a, ejes_b)):
        a = ra[k] if isinstance(ra, list) else ra
        b = rb[k] if isinstance(rb, list) else rb
        filas.append([bm.verts.new(c + A * (a * math.cos(2 * math.pi * i / lados))
                                   + B * (b * math.sin(2 * math.pi * i / lados))) for i in range(lados)])
        if capas:
            for v in filas[-1]:
                marcar_base(capas, v, bases[k])
    n = len(filas)
    for i in range(n if cerrado else n - 1):
        f0, f1 = filas[i], filas[(i + 1) % n]
        for k in range(lados):
            kk = (k + 1) % lados
            bm.faces.new((f0[k], f0[kk], f1[kk], f1[k]))
    if tapas and not cerrado:
        bm.faces.new(list(reversed(filas[0]))); bm.faces.new(filas[-1])
    return filas


def rollo(o_cana, ra=1.1, rb=0.95, lados=8, abierto=LENGUA_ANCHO - 0.8, punta=1.6, paso=1.2, atras_rollo=0.55):
    """El rollo acolchado de la boca: tubo por la orilla de arriba, abierto al frente detrás de la lengüeta
    (sus puntas, adelgazadas, quedan escondidas detrás de ella)."""
    bm = bmesh.new(); bm.from_mesh(o_cana.data); bm.normal_update()
    arriba = [v for v in bm.verts if v.is_boundary and v.co.z > Z_BOCA - 0.05]
    lazo = lazo_ordenado(bm, arriba[0])
    pts = [v.co.copy() for v in lazo]; nrms = [v.normal.copy() for v in lazo]
    bm.free()
    n = len(pts)
    for _ in range(4):
        pts = [(pts[i - 1] + pts[i] * 2 + pts[(i + 1) % n]) / 4 for i in range(n)]
    cy = sum(p.y for p in pts) / n
    frente = [abs(p.x - XC) < abierto and p.y < cy for p in pts]
    k0 = next(i for i in range(n) if frente[i - 1] and not frente[i])
    orden = [i for i in [(k0 + j) % n for j in range(n)] if not frente[i]]
    centros = []; A = []; B = []
    L = [0.0]
    for a, b in zip(orden, orden[1:]):
        L.append(L[-1] + (pts[b] - pts[a]).length)
    ras = []; rbs = []
    for k, i in enumerate(orden):
        t = (pts[(i + 1) % n] - pts[i - 1]).normalized()
        afuera = (nrms[i] - t * nrms[i].dot(t)).normalized()
        afuera = Vector((afuera.x, afuera.y, 0)).normalized()
        c = pts[i] - afuera * (GROSOR / 2) + Vector((0, 0, 0.25))
        arriba_v = t.cross(afuera).normalized()
        if arriba_v.z < 0:
            arriba_v = -arriba_v
        centros.append(c); A.append(afuera); B.append(arriba_v)
        e = min(L[k], L[-1] - L[k])
        f = 0.45 + 0.55 * smooth(0.0, punta, e)
        # por atrás más delgado: corriendo, el muslo baja hasta la pantorrilla (lo trae el clip) y lo pisaba
        atras = smooth(cy + 1.0, max(p.y for p in pts) - 0.5, pts[i].y)
        f *= 1.0 - (1.0 - atras_rollo) * atras
        ras.append(ra * f); rbs.append(rb * f)
    # remuestrear parejo a 'paso' cm (la orilla de QuadriFlow trae vértices muy juntos)
    m = max(8, int(L[-1] / paso))
    def en(lista, s):
        k = next((i for i in range(len(L) - 1) if L[i + 1] >= s), len(L) - 2)
        t = (s - L[k]) / max(1e-9, L[k + 1] - L[k])
        a, b = lista[k], lista[k + 1]
        return a.lerp(b, t) if isinstance(a, Vector) else a + (b - a) * t
    ss = [L[-1] * i / m for i in range(m + 1)]
    centros = [en(centros, x) for x in ss]
    A = [en(A, x).normalized() for x in ss]; B = [en(B, x).normalized() for x in ss]
    ras = [en(ras, x) for x in ss]; rbs = [en(rbs, x) for x in ss]
    bm = bmesh.new()
    tubo_camino(bm, centros, A, B, ras, rbs, lados)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto("bts_rollo", bm)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# --- costura del color: plano inclinado, alto al frente (debajo de la correa) y bajo atrás (donde llega
# el contrafuerte). Abajo azul, arriba gris carbón.
COSTURA_A = Vector((0.0, -10.5, 17.8))
COSTURA_B = Vector((0.0, 8.6, 11.6))


def costura_normal():
    d = (COSTURA_B - COSTURA_A).normalized()
    return Vector((0.0, -d.z, d.y)).normalized()   # perpendicular a d en el plano y-z, hacia arriba


def costura(o_cana, mat_azul, mat_cuello):
    """Corta la caña por el plano de la costura (una arista limpia) y le pone su material a cada lado."""
    nrm = costura_normal()
    bm = bmesh.new(); bm.from_mesh(o_cana.data)
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=g, plane_co=COSTURA_A, plane_no=nrm)
    for f in bm.faces:
        f.material_index = mat_cuello if (f.calc_center_median() - COSTURA_A).dot(nrm) > 0 else mat_azul
        f.smooth = True
    bm.to_mesh(o_cana.data); bm.free(); o_cana.data.update()


def forro(o_cana, z_desde=Z_BOCA - 12.0):
    """Cara de adentro de la caña (lo que se ve por la boca), hacia adentro y volteada."""
    borrar("bts_forro")
    o = o_cana.copy(); o.data = o_cana.data.copy(); o.name = "bts_forro"; o.data.name = "bts_forro"
    col_tmp().objects.link(o)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[x for x in bm.faces if x.calc_center_median().z < z_desde], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update()
    for v in bm.verts:
        v.co -= v.normal * GROSOR
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return o


def caja_redonda(nombre, centro, X, Y, Z, medidas, radio=0.3, segmentos=3):
    """Caja de esquinas redondas: ejes X, Y, Z (unitarios), medidas = (dx, dy, dz) totales."""
    bm = bmesh.new()
    M = Matrix((X, Y, Z)).transposed().to_4x4(); M.translation = centro
    bmesh.ops.create_cube(bm, size=1.0, matrix=M @ Matrix.Diagonal((*medidas, 1.0)))
    bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=radio, segments=segmentos, affect='EDGES',
                    profile=0.5, clamp_overlap=True)
    o = objeto(nombre, bm)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def hebilla(base_correa, phi=math.radians(92), medidas=(3.8, 2.7, 0.5)):
    """Hebilla amarilla en el costado de afuera de la correa, acostada sobre ella."""
    u = (phi - CORREA_PHI0) / (CORREA_PHI1 - CORREA_PHI0)
    p, d = base_correa(u, 0.5)
    p2, _ = base_correa(u + 0.01, 0.5)
    X = (p2 - p).normalized()
    Z = d
    Y = Z.cross(X).normalized()
    X = Y.cross(Z).normalized()
    centro = p + Z * (0.12 + CORREA_GROSOR - 0.08 + medidas[2] / 2)
    return caja_redonda("bts_hebilla", centro, X, Y, Z, medidas, radio=0.14, segmentos=2)


def clip_frente(base_correa, medidas=(3.4, 1.5, 0.55)):
    """Clip amarillo donde la correa cruza la lengüeta, al frente (el de la referencia)."""
    u = (0.0 - CORREA_PHI0) / (CORREA_PHI1 - CORREA_PHI0)
    p, d = base_correa(u, 0.5)
    p2, _ = base_correa(u + 0.01, 0.5)
    X = (p2 - p).normalized(); Z = d
    Y = Z.cross(X).normalized(); X = Y.cross(Z).normalized()
    centro = p + Z * (0.12 + CORREA_GROSOR - 0.08 + medidas[2] / 2)
    return caja_redonda("bts_clip", centro, X, Y, Z, medidas, radio=0.14, segmentos=2)


def jaladera(mapa, o_lengua, medidas=(2.8, 1.1, 0.45)):
    """Jaladera amarilla en el frente de la lengüeta, cerca de la punta."""
    s = mapa.total + LENGUA_SALE - 1.5
    p, n = mapa.punto(s, 0.0)
    if s > mapa.total:
        p = p + n * LENGUA_INCLINA * ((s - mapa.total) / LENGUA_SALE) ** 2
    bvh = bvh_de(o_lengua)
    hit = bvh.ray_cast(p + n * 8.0, -n, 20.0)
    loc = hit[0] if hit[0] is not None else p + n * (0.2 + LENGUA_GROSOR)
    _, t = mapa.en(s)
    Z = n; X = Vector((1, 0, 0)); Y = Z.cross(X).normalized(); X = Y.cross(Z).normalized()
    centro = loc + Z * (medidas[2] / 2 - 0.12)
    return caja_redonda("bts_jaladera", centro, X, Y, Z, medidas, radio=0.12, segmentos=2)


# --- materiales, pesos y armado
MATERIALES = [
    ("Botas_Azul", (0.03, 0.06, 0.70), 0.55),
    ("Botas_Cuello", (0.022, 0.023, 0.027), 0.75),
    ("Botas_Suela", (0.80, 0.80, 0.82), 0.6),
    ("Botas_Amarillo", (0.913, 1.0, 0.0), 0.5),     # #f5ff00, el amarillo del sitio
    ("Botas_Forro", (0.04, 0.04, 0.045), 0.85),
    ("Botas_Perforado", (0.008, 0.014, 0.16), 0.6),   # los puntitos de la puntera
    ("Botas_Huella", (0.30, 0.30, 0.32), 0.7),         # el dibujo de la suela y la línea del costado
]
AZUL, CUELLO, SUELA, AMARILLO, FORRO, PERFORADO, HUELLA = range(7)
# pieza: (material o None si ya trae los suyos, de dónde saca los pesos)
#   'cuerpo' = del pie (y la espinilla) por la superficie más cercana, suavizados
#   'cana'   = de la caña bajo cada vértice;  'rigida' = cada isla con el peso de la caña bajo su centro
#   'contra' = de la suela abajo y de la caña arriba;  'banda' = de la banda de la suela bajo cada vértice
PIEZAS = {
    "bts_cana": (None, "cuerpo"),
    "bts_suela": (SUELA, "cuerpo_pie"),
    "bts_contra": (SUELA, "contra"),
    "bts_forro": (FORRO, "cana"),
    "bts_lengua": (AZUL, "cana"),
    "bts_garganta": (AZUL, "cana"),
    "bts_rollo": (CUELLO, "cana"),
    "bts_perforado": (PERFORADO, "rigida"),
    "bts_huella": (HUELLA, "banda"),
    "bts_costado": (HUELLA, "banda"),
    # lo que va encima de otras piezas saca los pesos de lo que tiene justo abajo (de la caña sola, la correa de
    # abajo tomaba en la esquina del empeine los del calcetín y la lengüeta los del pie: se cruzaban al moverse)
    "bts_correa": (AZUL, ("encima", ("bts_cana", "bts_lengua"))),
    "bts_correa2": (AZUL, ("encima", ("bts_cana", "bts_lengua", "bts_garganta"))),
    "bts_hebilla": (AMARILLO, ("rigida", ("bts_correa",))),
    "bts_clip": (AMARILLO, ("rigida", ("bts_correa",))),
    "bts_hebilla2": (AMARILLO, ("rigida", ("bts_correa2",))),
    "bts_jaladera": (AMARILLO, ("rigida", ("bts_lengua",))),
}
MAX_HUESOS = 4


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
    cuerpo = copias[0]; cuerpo.name = "bts_cuerpo_botas"
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
    """Suaviza por las aristas de la malla, sin las largas (la tapa de arriba de la suela cruza el pie)."""
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


def de_superficie(sup, pesos):
    def f(p):
        _, _, tri, w = sup.cerca(p)
        acc = {}
        for i, wi in zip(tri, w):
            for k, x in pesos[i].items():
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


def pesar(vueltas_cana=12, vueltas_suela=8):
    o_cana = bpy.data.objects["bts_cana"]; o_suela = bpy.data.objects["bts_suela"]
    g = o_suela.vertex_groups.get("bts_subida")
    subida = [0.0] * len(o_suela.data.vertices)
    if g:
        for v in o_suela.data.vertices:
            for x in v.groups:
                if x.group == g.index:
                    subida[v.index] = x.weight
    # 1) caña y banda de la suela: del cuerpo, suavizados
    transferir(o_cana, PIES + PIERNAS)
    pc = suavizar_pesos(o_cana, leer_pesos(o_cana), vueltas_cana)
    transferir(o_suela, PIES)
    ps = suavizar_pesos(o_suela, leer_pesos(o_suela), vueltas_suela)
    # 1b) la subida de la banda en la punta va pegada a la nariz: se mueve con la caña bajo ella
    de_c0 = de_superficie(Superficie(o_cana), pc)
    for i, w in enumerate(subida):
        if w > 0:
            a = de_c0(o_suela.data.vertices[i].co)
            ps[i] = limpiar({k: ps[i].get(k, 0.0) * (1 - w) + a.get(k, 0.0) * w for k in set(a) | set(ps[i])})
    escribir_pesos(o_suela, ps)
    # 2) la caña, dentro de la banda y un poco arriba, se mueve con la suela (con sus propios pesos se
    #    asomaba por la banda; lo mismo en los tenis)
    sup_s = Superficie(o_suela); de_s = de_superficie(sup_s, ps)
    bvh_s = bvh_de(o_suela)
    def sobre_banda(p):
        # altura del punto sobre la cara de arriba de la banda (negativa si queda debajo, dentro de ella)
        arriba = bvh_s.ray_cast(p, Vector((0, 0, 1)), 12.0)[0]
        if arriba is not None:
            return p.z - arriba.z
        abajo = bvh_s.ray_cast(p, Vector((0, 0, -1)), 30.0)[0]
        return p.z - abajo.z if abajo is not None else 99.0
    for v in o_cana.data.vertices:
        t = smooth(-0.2, 1.8, sobre_banda(v.co))
        if t >= 1.0:
            continue
        a = de_s(v.co)
        pc[v.index] = limpiar({k: a.get(k, 0.0) * (1 - t) + pc[v.index].get(k, 0.0) * t
                               for k in set(a) | set(pc[v.index])})
    escribir_pesos(o_cana, pc)
    # 3) lo demás, de la caña (el contrafuerte, de la suela abajo; lo que va encima de otra pieza, de ella)
    sup = Superficie(o_cana); de_c = de_superficie(sup, pc)
    hechos = {"bts_cana": pc, "bts_suela": ps}
    def de_varias(nombres):
        sups = [(Superficie(bpy.data.objects[x]), hechos[x]) for x in nombres]
        def f(p):
            mejor = None
            for sp, pw in sups:
                d = sp.bvh.find_nearest(p)[3]
                if mejor is None or d < mejor[0]:
                    mejor = (d, sp, pw)
            return de_superficie(mejor[1], mejor[2])(p)
        return f
    for n, (mi, modo) in PIEZAS.items():
        if modo in ("cuerpo", "cuerpo_pie"):
            continue
        o = bpy.data.objects[n]
        base_de = de_c
        if isinstance(modo, tuple):
            modo, bases = modo
            base_de = de_varias(bases)
        if modo == "encima":
            hechos[n] = [base_de(q) for q in base_de_vertices(o)]
            escribir_pesos(o, hechos[n])
        elif modo == "cana":
            hechos[n] = [de_c(q) for q in base_de_vertices(o)]
            escribir_pesos(o, hechos[n])
        elif modo == "banda":
            escribir_pesos(o, [de_s(v.co) for v in o.data.vertices])
        elif modo == "contra":
            pesos = []
            for v in o.data.vertices:
                t = smooth(-0.6, 1.4, sobre_banda(v.co))
                a = de_s(v.co); b = de_c(v.co)
                pesos.append(limpiar({k: a.get(k, 0.0) * (1 - t) + b.get(k, 0.0) * t for k in set(a) | set(b)}))
            escribir_pesos(o, pesos)
        elif modo == "rigida":
            pesos = [None] * len(o.data.vertices)
            for isla in islas(o):
                c = sum((o.data.vertices[i].co for i in isla), Vector()) / len(isla)
                d = base_de(c)
                for i in isla:
                    pesos[i] = d
            hechos[n] = pesos
            escribir_pesos(o, pesos)
    return dict(huesos=sorted({k for d in pc for k in d}))


# --- el tobillo como articulación: cuánto sigue cada vértice a la espinilla depende solo del ángulo alrededor de la
# bisagra del tobillo (igual en todo el ancho). Así la caña, la lengüeta, el vivo y las correas, que van una sobre
# otra, giran juntas. Con los pesos de cada una (de pie a espinilla en 6 cm al frente, y con algo de los dedos) se
# cruzaban al doblar el tobillo, y el idle lo dobla 25°. La mezcla entre los huesos de la pierna (por altura) y
# entre pie y dedos (por y) sale promediada de la caña (tablas_tobillo) y es la misma para todas las capas.
# Las correas, hebillas y jaladera toman los pesos de lo que tienen debajo en su punto base (capas bts_bx/by/bz).
TOBILLO = Vector((0.0, 2.7, 5.0))       # la bisagra (cabeza de foot.l), eje en x
TOBILLO_PIERNA = 106.0                  # ángulo (grados, en y-z) hacia donde sube la espinilla
PIEZAS_TOBILLO = ("bts_cana", "bts_forro", "bts_lengua", "bts_perforado", "bts_rollo", "bts_contra")
# después, de lo que tienen debajo (ya con el campo del tobillo), en este orden
ENCIMA_TOBILLO = ("bts_correa", "bts_correa2", "bts_hebilla", "bts_clip", "bts_hebilla2", "bts_jaladera")


# El idle dobla el tobillo 25° (Skulley agachado): el frente se cierra 25° alrededor de la bisagra. Con el cambio
# de pie a espinilla en un tramo corto, ese tramo se comprimía más de lo que cabe y las capas (lengüeta, vivo,
# correas) se encimaban y el costado se arrugaba. Repartido en todo el frente (del pie a casi la espinilla) cada
# parte se comprime poco. Arriba llega a 1 antes del todo para que la caña siga a la espinilla (si no, la
# espinilla empuja el frente de la caña). Atrás, igual entre el talón y la espinilla.
TOBILLO_FRENTE_PIE = 200.0              # ángulo donde el frente ya va con el pie...
TOBILLO_FRENTE_PIERNA = 122.0           # ...y donde ya va con la espinilla (en medio, rampa pareja: con la
                                        # curva en S lo más empinado caía en la orilla de la correa de abajo)
TOBILLO_ATRAS_TALON = 0.0
TOBILLO_ATRAS_PIERNA = 75.0


def peso_pierna_tobillo(p):
    a = math.degrees(math.atan2(p.z - TOBILLO.z, p.y - TOBILLO.y))      # -180..180
    if a < -90.0:
        a += 360.0                                                       # abajo y al frente: lado del pie
    if a >= TOBILLO_PIERNA:
        return min(1.0, max(0.0, (TOBILLO_FRENTE_PIE - a) / (TOBILLO_FRENTE_PIE - TOBILLO_FRENTE_PIERNA)))
    return smooth(TOBILLO_ATRAS_TALON, TOBILLO_ATRAS_PIERNA, a)


def tablas_tobillo(o_cana):
    """De los pesos de la caña: la mezcla de los huesos de la pierna según la altura y la de pie y dedos según
    qué tan adelante, promediadas (las mismas para todas las piezas a esa altura y en esa y: si cada capa
    trae su propia mezcla de los huesos de giro, al girar la espinilla se deslizan una sobre otra)."""
    piernas = {}; pies = {}
    nombres = {g.index: g.name for g in o_cana.vertex_groups}
    for v in o_cana.data.vertices:
        d = {nombres[g.group]: g.weight for g in v.groups}
        lp = {k: w for k, w in d.items() if k.startswith("leg")}
        fp = {k: w for k, w in d.items() if not k.startswith("leg")}
        sp = sum(lp.values()); sf = sum(fp.values())
        if sp > 0.05:
            acc = piernas.setdefault(int(math.floor(v.co.z)), {})
            for k, w in lp.items():
                acc[k] = acc.get(k, 0.0) + w / sp * sp
        if sf > 0.05:
            acc = pies.setdefault(int(math.floor(v.co.y)), {})
            for k, w in fp.items():
                acc[k] = acc.get(k, 0.0) + w / sf * sf
    def norm(tabla):
        out = {}
        for k, acc in tabla.items():
            s_ = sum(acc.values())
            out[k] = {b: w / s_ for b, w in acc.items()}
        return out
    piernas = norm(piernas); pies = norm(pies)
    def mezcla(tabla, x, defecto):
        k = int(math.floor(x))
        llaves = sorted(tabla)
        if not llaves:
            return defecto
        k = min(max(k, llaves[0]), llaves[-1])
        while k not in tabla:
            k -= 1
        return tabla[k]
    return (lambda z: mezcla(piernas, z, {"leg_twist_2.l": 1.0})), (lambda y: mezcla(pies, y, {"foot.l": 1.0}))


def zona_tobillo(p):
    """Dónde manda el campo del tobillo: al frente, arriba del pie y detrás de la puntera (ahí se apilan la lengüeta,
    el vivo y las correas). En la puntera, los costados y atrás la bota sigue al cuerpo: con el campo en toda la
    bota, al doblar el pie (el idle, y 70° en un cuadro de correr) el pie se salía por la puntera y por abajo.
    La orilla de abajo (8.2 a 11 de alto) es un trato: más abajo, en el cuadro 12 de correr el empeine se asoma
    más (1.26 cm con 7.5 a 10); más arriba (9 a 12), en el idle la correa de abajo se mete en la lengüeta."""
    return smooth(-4.0, -8.0, p.y) * smooth(8.2, 11.0, p.z) * smooth(-17.5, -15.0, p.y)


def a_tobillo(p, mezcla_pierna, mezcla_pie, d0=None):
    """Los pesos en el punto p: la parte de pierna por el ángulo alrededor del tobillo, con las mezclas de huesos
    según la posición (iguales para todas las piezas); fuera de la zona, los que traía (d0)."""
    r = zona_tobillo(p) if d0 is not None else 1.0
    if r <= 0.0:
        return d0
    wp = peso_pierna_tobillo(p)
    campo = {}
    for k, w in mezcla_pie(p.y).items():
        campo[k] = campo.get(k, 0.0) + (1 - wp) * w
    for k, w in mezcla_pierna(p.z).items():
        campo[k] = campo.get(k, 0.0) + wp * w
    if r < 1.0:
        campo = {k: d0.get(k, 0.0) * (1 - r) + campo.get(k, 0.0) * r for k in set(d0) | set(campo)}
    return limpiar(campo)


def pesos_tobillo():
    mezcla_pierna, mezcla_pie = tablas_tobillo(bpy.data.objects["bts_cana"])
    bvh_s = bvh_de(bpy.data.objects["bts_suela"])
    def sobre_banda(p):
        arriba = bvh_s.ray_cast(p, Vector((0, 0, 1)), 12.0)[0]
        if arriba is not None:
            return p.z - arriba.z
        abajo = bvh_s.ray_cast(p, Vector((0, 0, -1)), 30.0)[0]
        return p.z - abajo.z if abajo is not None else 99.0
    for n in PIEZAS_TOBILLO:
        o = bpy.data.objects.get(n)
        if not o:
            continue
        modo = PIEZAS.get(n, (None, None))[1]
        rigida = modo == "rigida" or (isinstance(modo, tuple) and modo[0] == "rigida")
        viejos = leer_pesos(o)
        ps = [None] * len(o.data.vertices)
        if rigida:
            for isla in islas(o):
                c = sum((o.data.vertices[i].co for i in isla), Vector()) / len(isla)
                d = a_tobillo(c, mezcla_pierna, mezcla_pie, viejos[isla[0]])
                for i in isla:
                    ps[i] = d
        else:
            for i, v in enumerate(o.data.vertices):
                d = a_tobillo(v.co, mezcla_pierna, mezcla_pie, viejos[i])
                if n in ("bts_cana", "bts_contra"):
                    # junto a la banda se queda como venía (sigue a la suela; si no, se asoma por ella)
                    t = smooth(-0.2, 1.8, sobre_banda(v.co))
                    if t < 1.0:
                        d = limpiar({k: viejos[i].get(k, 0.0) * (1 - t) + d.get(k, 0.0) * t for k in set(d) | set(viejos[i])})
                ps[i] = d
        escribir_pesos(o, ps)
    # el vivo de la garganta va junto a la orilla de la lengüeta: sus pesos, los de ella (por el ángulo quedaba más
    # atrás que la lengüeta, giraba distinto en el idle y la rozaba)
    o_l = bpy.data.objects["bts_lengua"]; o_g = bpy.data.objects.get("bts_garganta")
    if o_g:
        de_l = de_superficie(Superficie(o_l), leer_pesos(o_l))
        escribir_pesos(o_g, [de_l(q) for q in base_de_vertices(o_g)])
    # las correas, de la caña, la lengüeta y el vivo bajo ellas; hebillas, clip y jaladera, de su pieza
    for n in ENCIMA_TOBILLO:
        o = bpy.data.objects.get(n)
        if not o:
            continue
        modo, bases = PIEZAS[n][1]
        sups = [(Superficie(bpy.data.objects[x]), leer_pesos(bpy.data.objects[x])) for x in bases]
        def base_de(p, sups=sups):
            mejor = min(sups, key=lambda t: t[0].bvh.find_nearest(p)[3])
            return de_superficie(mejor[0], mejor[1])(p)
        if modo == "encima":
            escribir_pesos(o, [base_de(q) for q in base_de_vertices(o)])
        else:
            ps = [None] * len(o.data.vertices)
            for isla in islas(o):
                c = sum((o.data.vertices[i].co for i in isla), Vector()) / len(isla)
                d = base_de(c)
                for i in isla:
                    ps[i] = d
            escribir_pesos(o, ps)


def unir():
    """Junta las piezas de la bota izquierda en 'bts_botas_L' con sus materiales (ya con pesos)."""
    mats = materiales()
    for n, (mi, modo) in PIEZAS.items():
        o = bpy.data.objects[n]
        if mi is not None:
            o.data.materials.clear()
            for m in mats:
                o.data.materials.append(m)
            for p in o.data.polygons:
                p.material_index = mi
        for p in o.data.polygons:
            p.use_smooth = True
    objs = [bpy.data.objects[n] for n in PIEZAS]
    borrar("bts_botas_L")
    activo(objs[0])
    for o in objs:
        o.select_set(True)
    bpy.ops.object.join()
    t = objs[0]; t.name = "bts_botas_L"; t.data.name = "bts_botas_L"
    return t


def espejo(o_l):
    """La derecha: la izquierda espejeada en x, con las caras volteadas y los grupos .l -> .r."""
    bm = bmesh.new(); bm.from_mesh(o_l.data)
    for v in bm.verts:
        v.co.x = -v.co.x
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    o = objeto("bts_botas_R", bm)
    for m in o_l.data.materials:
        o.data.materials.append(m)
    nombres = {g.index: g.name for g in o_l.vertex_groups}
    def lado(n):
        return n[:-2] + ".r" if n.endswith(".l") else n
    escribir_pesos(o, [{lado(nombres[g.group]): g.weight for g in v.groups} for v in o_l.data.vertices])
    return o


def montar(nombre="Botas"):
    """Junta izquierda y derecha, hijo del armature con su modificador, en la colección de los props."""
    L = bpy.data.objects["bts_botas_L"]
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
    for nombre_capa in BASE_CAPAS:
        if nombre_capa in o.data.attributes:
            o.data.attributes.remove(o.data.attributes[nombre_capa])
    return o


def limpiar_tmp():
    # prefijo propio "bts_": los tenis usaban los mismos tmp_* y los dos scripts borraban por nombre
    c = bpy.data.collections.get(TMP)
    if c:
        for o in list(c.objects):
            borrar(o.name)
        bpy.data.collections.remove(c)
    for me in list(bpy.data.meshes):
        if me.users == 0 and me.name.startswith(("bts_cana", "bts_suela", "bts_contra", "bts_forro", "bts_lengua",
                                                 "bts_correa", "bts_rollo", "bts_hebilla", "bts_jaladera", "bts_puntera", "bts_clip",
                                                 "bts_garganta", "bts_perforado", "bts_huella", "bts_costado", "bts_correa2", "bts_hebilla2",
                                                 "bts_botas", "bts_qf", "bts_cuerpo_botas")):
            bpy.data.meshes.remove(me)


def cruces_piezas(pares=(("bts_correa", "bts_lengua"), ("bts_correa", "bts_cana"), ("bts_correa2", "bts_lengua"),
                          ("bts_correa2", "bts_garganta"), ("bts_correa2", "bts_cana"), ("bts_correa", "bts_correa2"),
                          ("bts_lengua", "bts_garganta"))):
    """Cuántas caras se cruzan entre piezas que van una sobre otra (en reposo, antes de juntarlas)."""
    out = {}
    for a, b in pares:
        oa, ob = bpy.data.objects.get(a), bpy.data.objects.get(b)
        if oa and ob:
            out[a + "/" + b] = len(bvh_de(oa).overlap(bvh_de(ob)))
    return out


def piezas():
    """Arma todas las piezas de la bota izquierda en la colección temporal."""
    quitar_accion()
    info = {}
    o_cana, info["cana"] = cana()
    o_suela, info["suela"] = suela(o_cana)
    mapa = Mapa(o_cana)
    o_lengua, info["lengua"] = lengueta(mapa)
    _, info["correa"], base = correa([o_cana, o_lengua])
    rollo(o_cana)
    hebilla(base)
    clip_frente(base)
    jaladera(mapa, o_lengua)
    o_garganta = garganta(mapa)
    _, info["correa_baja"], base2 = correa_baja(mapa, [o_cana, o_lengua, o_garganta])
    hebilla_baja(base2)
    _, info["perforaciones"] = perforaciones(mapa)
    info["cruces"] = cruces_piezas()
    forro(o_cana)
    doblar_punta([bpy.data.objects[n] for n in PIEZAS if n in bpy.data.objects], puntos_cuerpo(PIES))
    o_cana.data.materials.clear()
    for m in materiales():
        o_cana.data.materials.append(m)
    costura(o_cana, AZUL, CUELLO)
    return info


def todo():
    info = piezas()
    info["pesos"] = pesar()
    pesos_tobillo()
    unir()
    o = montar()
    limpiar_tmp()
    me = o.data
    me.calc_loop_triangles()
    info["triangulos"] = len(me.loop_triangles)
    info["vertices"] = len(me.vertices)
    info["huesos"] = sorted(g.name for g in o.vertex_groups)
    activo(o)
    return o, info
