"""
Los idles de Skulley para cuando el jugador lo deja quieto mucho rato (Oscar, 2026-11-23):
dormirse en el piso (M.A.D.R.E. le trae una cobijita) y un solo de guitarra de aire.

Se corre dentro de Blender sobre Character/SkulleyRad.blend (el de trabajo, ..\\Character\\):
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["todo"]()
o en segundo plano con blender.exe --background ... --python <runner> (ver memoria
blender-en-segundo-plano). Cada animación es una acción hecha de la Plantilla_rig
(controles en `rig` = 1) con poses clave en el espacio del armature (cm; Skulley mira
hacia -Y, su izquierda es +X). Después se exportan con exportar_animaciones.py.

Herramientas: `render(...)` saca fotos con Eevee y `medir(accion)` recorre la acción
cuadro por cuadro: lo más bajo de cada pieza contra el piso y las piezas que se meten
en otras (manos en el cráneo, brazos en el torso). Nada puede atravesar a Skulley
(memoria animaciones-sin-traspasos).
"""
import bpy, math, json, os
from mathutils import Vector, Matrix, Quaternion, Euler
from mathutils.bvhtree import BVHTree

ARM = bpy.data.objects["root"]
# el piso de las animaciones del .blend: donde pisan el reposo y el idle (0.48 cm bajo z = 0)
PISO = -0.48
PB = ARM.pose.bones
BN = ARM.data.bones
# El .blend se guardó con el armature en "Posición de reposo": así las mallas no siguen la pose.
# Aquí se trabaja en "Pose" y `guardar()` lo regresa como estaba.
POSICION_ANTES = ARM.data.pose_position
ARM.data.pose_position = "POSE"
PROPS = ("Beanie", "Botas", "Boxers", "Chamarra", "Hoodie", "Inflada", "Lentes", "Lentes3D",
         "Munequeras", "Pantalones", "Tenis")
PIEZAS = ("Egg_Head", "Egg_Jaw", "Egg_Eye_L", "Egg_Eye_R", "Egg_Torax", "Egg_Pelvis",
          "Egg_Arm1_L", "Egg_Arm1_R", "Egg_Arm2_L", "Egg_Arm2_R",
          "Egg_Leg1_L", "Egg_Leg1_R", "Egg_Leg2_L", "Egg_Leg2_R", "Egg_Foot_L", "Egg_Foot_R")
# piezas que se tocan por diseño (la unión): no cuentan como traspaso entre ellas
VECINAS = {
    frozenset(p) for p in [
        ("Egg_Head", "Egg_Jaw"), ("Egg_Head", "Egg_Eye_L"), ("Egg_Head", "Egg_Eye_R"), ("Egg_Jaw", "Egg_Eye_L"), ("Egg_Jaw", "Egg_Eye_R"),
        ("Egg_Head", "Egg_Torax"), ("Egg_Jaw", "Egg_Torax"), ("Egg_Torax", "Egg_Pelvis"),
        ("Egg_Torax", "Egg_Arm1_L"), ("Egg_Torax", "Egg_Arm1_R"), ("Egg_Arm1_L", "Egg_Arm2_L"), ("Egg_Arm1_R", "Egg_Arm2_R"),
        ("Egg_Pelvis", "Egg_Leg1_L"), ("Egg_Pelvis", "Egg_Leg1_R"), ("Egg_Leg1_L", "Egg_Leg2_L"), ("Egg_Leg1_R", "Egg_Leg2_R"),
        ("Egg_Leg2_L", "Egg_Foot_L"), ("Egg_Leg2_R", "Egg_Foot_R"),
    ]
}
CONTROLES = ["root.x", "spine_01.x", "spine_02.x", "spine_03.x", "neck.x", "head.x", "ctl_quijada",
             "ctl_pie_ik.l", "ctl_pie_ik.r", "ctl_mano_ik.l", "ctl_mano_ik.r",
             "ctl_rodilla.l", "ctl_rodilla.r", "ctl_codo.l", "ctl_codo.r"]


def rest(n):
    return BN[n].matrix_local.copy()


def rest_head(n):
    return BN[n].head_local.copy()


# ---------------------------------------------------------------- acciones
def nueva_accion(nombre, cuadros):
    """La acción `nombre` desde la Plantilla_rig (si ya existe, se rehace) y activa en el armature."""
    vieja = bpy.data.actions.get(nombre)
    if vieja:
        bpy.data.actions.remove(vieja)
    act = bpy.data.actions["Plantilla_rig"].copy()
    act.name = nombre
    act.use_fake_user = True
    # el slot se llama como el armature ("OBroot"): con otro nombre, Blender no lo conecta solo al escoger la acción
    for sl in act.slots:
        if sl.identifier != "OBroot":
            sl.name_display = "root"
    ad = ARM.animation_data or ARM.animation_data_create()
    ad.use_nla = False
    ad.action = act
    if len(act.slots):
        ad.action_slot = act.slots[0]
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, cuadros
    return act


def limpiar_pose():
    for p in PB:
        p.location = (0, 0, 0)
        p.rotation_quaternion = (1, 0, 0, 0)
        p.rotation_euler = (0, 0, 0)
        p.scale = (1, 1, 1)


# ---------------------------------------------------------------- poses
# Una pose es un dict con lo que cambia respecto al reposo:
#   cadera: {"pos": (x,y,z) del head de root.x, "rot": (rx,ry,rz) grados en el mundo (XYZ)}
#   columna: [(rx,ry,rz) por spine_01..03] grados locales; cuello, cabeza: (rx,ry,rz) locales
#   quijada: grados (0..35)
#   pie_l / pie_r / mano_l / mano_r: {"pos": (x,y,z), "rot": (rx,ry,rz) grados en el mundo}
#   rodilla_l / rodilla_r / codo_l / codo_r: (x,y,z) del polo
def _mat_mundo(n, pos=None, rot=(0, 0, 0)):
    m = rest(n)
    h = m.to_translation()
    R = Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()
    p = Vector(pos) if pos is not None else h
    return Matrix.Translation(p) @ R @ Matrix.Translation(-h) @ m


def _local(r):
    return Euler([math.radians(a) for a in r], "XYZ").to_quaternion()


def _poner_matriz(n, M):
    """Pone el hueso en la matriz M (espacio del armature) por su base local: sin actualizar la escena,
    que volvería a leer la acción y lo regresaría. Solo para huesos cuyo padre no se mueve (ctl_raiz)."""
    pb = PB[n]
    pb.matrix_basis = ARM.convert_space(pose_bone=pb, matrix=M, from_space="POSE", to_space="LOCAL")


DEDOS = [b.name for b in BN if any(k in b.name for k in ("thumb", "index", "middle", "ring", "pinky")) and b.use_deform]
PELO = [f"ctl_pelo_{i}" for i in range(1, 9)]


def aplicar(pose):
    """Pone la pose en el armature (sin llaves)."""
    limpiar_pose()
    # el idle trae rig = 0 en su acción y el valor se queda al quitarla: sin esto el IK no sigue a los controles
    aj = PB["ctl_ajustes"]
    for k in ("rig", "ik_pierna_l", "ik_pierna_r", "ik_brazo_l", "ik_brazo_r"):
        aj[k] = 1
    c = pose.get("cadera")
    if "cadera_mat" in pose:
        M = pose["cadera_mat"].copy()
        if "cadera_mueve" in pose:
            M.translation = M.translation + Vector(pose["cadera_mueve"])
        _poner_matriz("root.x", M)
    elif c:
        _poner_matriz("root.x", _mat_mundo("root.x", c.get("pos"), c.get("rot", (0, 0, 0))))
    for n, q in (pose.get("dedos") or {}).items():
        PB[n].rotation_quaternion = q
    pelo = pose.get("pelo")
    if pelo:
        for i, n in enumerate(PELO):
            r = pelo[i] if isinstance(pelo[0], (list, tuple)) else pelo
            PB[n].rotation_quaternion = _local(r)
    for i, r in enumerate(pose.get("columna", [])):
        PB[f"spine_0{i + 1}.x"].rotation_quaternion = _local(r)
    if "cuello" in pose:
        PB["neck.x"].rotation_quaternion = _local(pose["cuello"])
    if "cabeza" in pose:
        PB["head.x"].rotation_quaternion = _local(pose["cabeza"])
    if "quijada" in pose:
        PB["ctl_quijada"].rotation_euler = (math.radians(pose["quijada"]), 0, 0)
    for lado in ("l", "r"):
        for k, n in (("pie", "ctl_pie_ik"), ("mano", "ctl_mano_ik")):
            v = pose.get(f"{k}_{lado}")
            if v and "mat" in v:
                M = v["mat"].copy()
                if "mueve" in v:
                    M.translation = M.translation + Vector(v["mueve"])
                _poner_matriz(f"{n}.{lado}", M)
            elif v:
                _poner_matriz(f"{n}.{lado}", _mat_mundo(f"{n}.{lado}", v.get("pos"), v.get("rot", (0, 0, 0))))
        for k, n in (("rodilla", "ctl_rodilla"), ("codo", "ctl_codo")):
            v = pose.get(f"{k}_{lado}")
            if v:
                _poner_matriz(f"{n}.{lado}", Matrix.Translation(Vector(v)) @ Matrix.Translation(-rest_head(f"{n}.{lado}")) @ rest(f"{n}.{lado}"))


def llave(f):
    """Llave en el cuadro f de todos los controles que se animan (más dedos y pelo)."""
    for n in CONTROLES + DEDOS + PELO:
        p = PB[n]
        p.keyframe_insert("location", frame=f)
        if p.rotation_mode == "QUATERNION":
            p.keyframe_insert("rotation_quaternion", frame=f)
        else:
            p.keyframe_insert("rotation_euler", frame=f)


def poner(cuadros):
    """cuadros: [(f, pose)] en orden. Pone cada pose y le pone llave."""
    for f, pose in cuadros:
        aplicar(pose)
        llave(f)


# ---------------------------------------------------------------- medir
def _malla(o, dg):
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    M = oe.matrix_world
    vs = [M @ v.co for v in me.vertices]
    tris = []
    me.calc_loop_triangles()
    for t in me.loop_triangles:
        tris.append(tuple(t.vertices))
    oe.to_mesh_clear()
    return vs, tris


_TOLERANCIA = None
# lo que se pueden encimar de más dos piezas que ya se tocan en el reposo (codo, rodilla, ingle) al doblarse:
# son piezas rígidas y la junta se encima; no es un traspaso que se vea
PLIEGUE = 1.6


def calibrar_vecinas(margen=0.4):
    """Lo que cada par de piezas ya se mete en el reposo (cm): eso es la unión por diseño, no un traspaso."""
    global _TOLERANCIA
    sc = bpy.context.scene
    ad = ARM.animation_data
    antes = ad.action if ad else None
    if ad:
        ad.action = None
    tol = {}
    # el reposo y el idle: lo que ya se meten ahí es de diseño (el idle trae el brazo 1.6 cm en el torso)
    poses = [None]
    poses.append(capturar("root|root|Iddle", 1))
    ad.action = None
    for pose in poses:
        if pose is None:
            limpiar_pose()
        else:
            aplicar(pose)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        datos = {n: _malla(bpy.data.objects[n], dg) for n in PIEZAS if n in bpy.data.objects}
        arbol = {n: BVHTree.FromPolygons(vs, tris) for n, (vs, tris) in datos.items()}
        for a, (vs_a, _) in datos.items():
            for b2, t in arbol.items():
                if a == b2:
                    continue
                m = 0.0
                for v in vs_a:
                    loc, nor, i, d = t.find_nearest(v, 0.08)
                    if loc is not None:
                        m = max(m, (loc - v).dot(nor))
                if m * 100 > 0.05:
                    tol[(a, b2)] = max(tol.get((a, b2), 0), m * 100 + margen)
    _TOLERANCIA = tol
    if ad:
        ad.action = antes
        if antes and len(antes.slots):
            ad.action_slot = antes.slots[0]
    return {f"{a}>{b2}": round(v, 2) for (a, b2), v in tol.items()}


def medir(cuadros=None, cada=1, piezas=PIEZAS, piso=None):
    """Recorre la acción activa: lo más bajo (m, mundo) y el peor traspaso entre piezas por cuadro."""
    sc = bpy.context.scene
    piso = PISO if piso is None else piso
    dg = bpy.context.evaluated_depsgraph_get()
    fs = cuadros or range(sc.frame_start, sc.frame_end + 1, cada)
    out = []
    for f in fs:
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        datos = {n: _malla(bpy.data.objects[n], dg) for n in piezas if n in bpy.data.objects}
        bajo = min((min(v.z for v in vs), n) for n, (vs, _) in datos.items())
        arbol = {n: BVHTree.FromPolygons(vs, tris) for n, (vs, tris) in datos.items()}
        if _TOLERANCIA is None:
            calibrar_vecinas()
            sc.frame_set(f)
        peor = (0.0, "")
        for a, (vs_a, _) in datos.items():
            mano = set(_indices_mano(a)) if a.startswith("Egg_Arm1") else None
            for b, t in arbol.items():
                if a == b:
                    continue
                tol = _TOLERANCIA.get((a, b), 0.0)
                tol = (tol + PLIEGUE if tol > 0 else 0.0) / 100
                for k in range(0, len(vs_a), 3):
                    v = vs_a[k]
                    loc, nor, i, d = t.find_nearest(v, 0.08)
                    if loc is None:
                        continue
                    hondo = (loc - v).dot(nor) - tol
                    if hondo > peor[0]:
                        parte = "" if mano is None else (" (mano)" if k in mano else " (antebrazo)")
                        peor = (hondo, f"{a}>{b}{parte}")
        cp = _cabeza_y_pelo(dg)
        out.append({"f": f, "bajo": round(bajo[0] * 100 - piso, 2), "bajo_pieza": bajo[1], "pelo": round(cp["pelo"] - piso, 2),
                    "traspaso_cm": round(peor[0] * 100, 2), "par": peor[1]})
    return out


# ---------------------------------------------------------------- fotos
def _camara(nombre, pos, mira, lente=40):
    cam = bpy.data.objects.get(nombre)
    if not cam:
        cam = bpy.data.objects.new(nombre, bpy.data.cameras.new(nombre))
        bpy.context.scene.collection.objects.link(cam)
    cam.location = pos
    d = (Vector(mira) - Vector(pos))
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lente
    return cam


def render(salida, cuadros, vistas=("frente", "juego"), lado=420, props=False, tomas_extra=None):
    """Fotos de los cuadros pedidos: 'frente' (de frente, a su altura), 'lado' y 'juego' (como la cámara del sitio)."""
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = lado
    sc.render.resolution_y = int(lado * 0.75)
    sc.render.film_transparent = False
    for n in PROPS:
        o = bpy.data.objects.get(n)
        if o:
            o.hide_render = not props
    tomas = {
        "frente": ((0, -5.2, 0.95), (0, 0, 0.9)),
        "lado": ((5.2, -0.4, 0.95), (0, 0, 0.9)),
        "juego": ((0, -4.6, 4.0), (0, 0, 0.55)),
        "arriba": ((0.01, -0.6, 5.4), (0, 0, 0.3)),
        "bajo": ((0, -4.6, 0.8), (0, 0, 0.35)),
        # acostado: más cerca y a ras de piso
        "piso": ((0, -3.0, 0.55), (0, 0, 0.22)),
        "piso_juego": ((0, -2.6, 2.3), (0, 0, 0.15)),
        "piso_arriba": ((0.01, -0.3, 3.2), (0, 0, 0.1)),
        "piso_atras": ((0, 3.0, 0.7), (0, 0, 0.22)),
    }
    tomas.update(tomas_extra or {})
    piso = bpy.data.objects.get("piso_fotos")
    if not piso:
        me = bpy.data.meshes.new("piso_fotos")
        me.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
        piso = bpy.data.objects.new("piso_fotos", me)
        bpy.context.scene.collection.objects.link(piso)
        mat = bpy.data.materials.new("piso_fotos")
        mat.diffuse_color = (0.22, 0.24, 0.42, 1)
        try:
            mat.use_nodes = True
            mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.22, 0.24, 0.42, 1)
        except Exception:
            pass
        me.materials.append(mat)
    piso.hide_render = False
    os.makedirs(salida, exist_ok=True)
    rutas = []
    for v in vistas:
        pos, mira = tomas[v]
        sc.camera = _camara("cam_idles", pos, mira)
        for f in cuadros:
            sc.frame_set(f)
            ruta = os.path.join(salida, f"{v}_{f:03d}.png")
            sc.render.filepath = ruta
            bpy.ops.render.render(write_still=True)
            rutas.append(ruta)
    return rutas


def guardar(ruta_esperada=None, mtime_al_cargar=None):
    """Guarda el .blend (regresa el armature a como estaba), solo si nadie lo cambió desde que se cargó."""
    ruta = bpy.data.filepath
    if mtime_al_cargar is not None and abs(os.path.getmtime(ruta) - mtime_al_cargar) > 1e-3:
        raise RuntimeError("el .blend cambió desde que se cargó: no se guarda")
    for n in ("piso_fotos", "cam_idles"):
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o)
    for a in [a for a in bpy.data.actions if a.name.startswith("Prueba_")]:
        bpy.data.actions.remove(a)
    # se guarda en pose y con la acción puesta con su slot (Oscar, 2026-11-23: guardado en reposo y sin acción, al
    # abrirlo en Blender no podía activar ninguna animación)
    ad = ARM.animation_data
    if ad and ad.action is not None and len(ad.action.slots) and ad.action_slot is None:
        ad.action_slot = ad.action.slots[0]
    ARM.data.pose_position = "POSE"
    bpy.ops.wm.save_mainfile()


def puntos(nombres=("head.x", "neck.x", "arm_stretch.l", "arm_stretch.r", "forearm_stretch.l", "forearm_stretch.r", "hand.l", "hand.r",
                     "root.x", "thigh_stretch.l", "leg_stretch.l", "leg_stretch.r", "foot.l", "foot.r")):
    """Dónde quedan (cm, espacio del armature) las juntas en el cuadro actual, y la caja del cráneo."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ARM.evaluated_get(dg)
    out = {n: [round(v, 1) for v in ev.pose.bones[n].head] for n in nombres}
    vs, _ = _malla(bpy.data.objects["Egg_Head"], dg)
    out["craneo_min"] = [round(min(v[i] for v in vs) * 100, 1) for i in range(3)]
    out["craneo_max"] = [round(max(v[i] for v in vs) * 100, 1) for i in range(3)]
    return out


# ---------------------------------------------------------------- capturar una pose de otra acción
def _deg(q):
    return tuple(math.degrees(a) for a in q.to_euler("XYZ"))


def capturar(accion="root|root|Iddle", cuadro=1):
    """La pose de esa acción en ese cuadro, como pose de los controles (para empezar y acabar igual que el idle)."""
    sc = bpy.context.scene
    ad = ARM.animation_data
    antes, antes_slot = ad.action, ad.action_slot
    act = bpy.data.actions[accion]
    ad.action = act
    if len(act.slots):
        ad.action_slot = act.slots[0]
    sc.frame_set(cuadro)
    dg = bpy.context.evaluated_depsgraph_get()
    P = ARM.evaluated_get(dg).pose.bones
    pose = {"cadera_mat": P["root.x"].matrix.copy(),
            "columna": [_deg(P[f"spine_0{i}.x"].rotation_quaternion) for i in (1, 2, 3)],
            "cuello": _deg(P["neck.x"].rotation_quaternion), "cabeza": _deg(P["head.x"].rotation_quaternion),
            "quijada": max(0.0, min(35.0, math.degrees(P["c_jawbone.x"].rotation_quaternion.to_euler("XYZ").x))),
            "dedos": {n: P[n].rotation_quaternion.copy() for n in DEDOS}}
    for lado in ("l", "r"):
        pose[f"mano_{lado}"] = {"mat": P[f"hand.{lado}"].matrix.copy()}
        pose[f"pie_{lado}"] = {"mat": P[f"foot.{lado}"].matrix.copy()}
        h, e, w = P[f"arm_stretch.{lado}"].head, P[f"forearm_stretch.{lado}"].head, P[f"hand.{lado}"].head
        pose[f"codo_{lado}"] = tuple(e + (e - (h + w) / 2).normalized() * 40)
        h, k, a = P[f"thigh_stretch.{lado}"].head, P[f"leg_stretch.{lado}"].head, P[f"foot.{lado}"].head
        pose[f"rodilla_{lado}"] = tuple(k + (k - (h + a) / 2).normalized() * 40)
    ad.action = antes
    if antes is not None:
        ad.action_slot = antes_slot
    return pose


def mezclar(a, b, t):
    """Una pose a la fracción t entre a y b (solo lo que tengan las dos en el mismo formato)."""
    out = {}
    lerp = lambda x, y: tuple(xi + (yi - xi) * t for xi, yi in zip(x, y))
    for k in set(a) | set(b):
        va, vb = a.get(k), b.get(k)
        if va is None or vb is None:
            out[k] = va if vb is None else vb
            continue
        if k == "cadera_mat" or (isinstance(va, dict) and "mat" in va and "mat" in vb):
            ma = va if k == "cadera_mat" else va["mat"]
            mb = vb if k == "cadera_mat" else vb["mat"]
            loc = ma.to_translation().lerp(mb.to_translation(), t)
            q = ma.to_quaternion().slerp(mb.to_quaternion(), t)
            M = Matrix.Translation(loc) @ q.to_matrix().to_4x4()
            out[k] = M if k == "cadera_mat" else {"mat": M}
        elif k == "columna":
            out[k] = [lerp(x, y) for x, y in zip(va, vb)]
        elif k == "dedos":
            out[k] = {n: va[n].slerp(vb[n], t) for n in va if n in vb}
        elif isinstance(va, (int, float)):
            out[k] = va + (vb - va) * t
        elif isinstance(va, (tuple, list)):
            out[k] = lerp(va, vb)
        else:
            out[k] = vb if t >= 0.5 else va
    return out


# ---------------------------------------------------------------- apoyar en el piso
def _cabeza_y_pelo(dg):
    """Lo más bajo del cráneo y del pelo por separado (el pelo es el material Hair de la cabeza)."""
    o = bpy.data.objects["Egg_Head"]
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    M = oe.matrix_world
    mats = [m.name if m else "" for m in o.data.materials]
    bajo = {"craneo": 9e9, "pelo": 9e9}
    for poly in me.polygons:
        nom = mats[poly.material_index] if poly.material_index < len(mats) else ""
        k = "pelo" if "air" in nom else "craneo"
        for vi in poly.vertices:
            z = (M @ me.vertices[vi].co).z
            if z < bajo[k]:
                bajo[k] = z
    oe.to_mesh_clear()
    return {k: round(v * 100, 2) for k, v in bajo.items()}


def bajo_cuerpo(pose, piezas=PIEZAS):
    """Lo más bajo de cada pieza (cm) con esa pose puesta, sin acción."""
    ad = ARM.animation_data
    antes, antes_slot = ad.action, ad.action_slot
    ad.action = None
    aplicar(pose)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for n in piezas:
        vs, _ = _malla(bpy.data.objects[n], dg)
        out[n] = round(min(v.z for v in vs) * 100, 2)
    out.update(_cabeza_y_pelo(dg))
    ad.action = antes
    if antes is not None:
        ad.action_slot = antes_slot
    return out


def mover_todo(pose, d):
    """La misma pose movida d (cm) en el armature: cadera, manos, pies y polos."""
    p = dict(pose)
    d = Vector(d)
    if "cadera_mat" in p:
        M = p["cadera_mat"].copy(); M.translation = M.translation + d; p["cadera_mat"] = M
    elif "cadera" in p:
        c = dict(p["cadera"]); c["pos"] = tuple(Vector(c["pos"]) + d); p["cadera"] = c
    for lado in ("l", "r"):
        for k in ("pie", "mano"):
            v = p.get(f"{k}_{lado}")
            if v and "mat" in v:
                M = v["mat"].copy(); M.translation = M.translation + d; p[f"{k}_{lado}"] = {"mat": M}
            elif v:
                v = dict(v); v["pos"] = tuple(Vector(v["pos"]) + d); p[f"{k}_{lado}"] = v
        for k in ("rodilla", "codo"):
            if p.get(f"{k}_{lado}"):
                p[f"{k}_{lado}"] = tuple(Vector(p[f"{k}_{lado}"]) + d)
    return p


def apoyar(pose, holgura=0.15, sin_pelo=True):
    """Sube o baja la pose entera para que lo más bajo del cuerpo quede `holgura` cm arriba del piso."""
    b = bajo_cuerpo(pose)
    claves = [k for k in b if k != "Egg_Head" and (k != "pelo" or not sin_pelo)]
    m = min(b[k] for k in claves)
    return mover_todo(pose, (0, 0, holgura - m)), b


# ================================================================ las animaciones
# Todo en el espacio del armature (cm). El idle (capturado en su cuadro 1) es el
# principio y el final de las que regresan a estar de pie: entran y salen sin
# brinco. Las manos y los dedos se animan en cada pose (Oscar: "anima las manos,
# los dedos, que no estén tiesas") y van con retraso del cuerpo (`RETRASO`), igual
# que la cabeza: así nada se mueve en bloque.
IDLE = "root|root|Iddle"
# cuadros de retraso de cada grupo respecto a la cadera y la columna
RETRASO = {"cuerpo": 0, "cabeza": 2, "manos": 2, "dedos": 3, "pies": 0}
GRUPOS = {
    "cuerpo": ["root.x", "spine_01.x", "spine_02.x", "spine_03.x", "ctl_codo.l", "ctl_codo.r", "ctl_rodilla.l", "ctl_rodilla.r"],
    "cabeza": ["neck.x", "head.x", "ctl_quijada"] + PELO,
    "manos": ["ctl_mano_ik.l", "ctl_mano_ik.r"],
    "pies": ["ctl_pie_ik.l", "ctl_pie_ik.r"],
}
LIBRES = [p.name for p in PB if BN[p.name].use_deform and p.name not in (
    "root.x", "spine_01.x", "spine_02.x", "spine_03.x", "neck.x", "head.x") and p.name not in DEDOS
    and not p.name.startswith("prop_")
    and all(getattr(c, "subtarget", "").startswith("ctl_pelo") for c in p.constraints)]
GRUPOS["dedos"] = DEDOS + LIBRES


def llave_grupos(f, grupos=None, fin=None):
    """Llave del grupo en f + su retraso (sin pasarse de `fin`)."""
    for g, nombres in GRUPOS.items():
        if grupos and g not in grupos:
            continue
        ff = f + RETRASO[g]
        if fin is not None:
            ff = min(ff, fin)
        for n in nombres:
            p = PB[n]
            p.keyframe_insert("location", frame=ff)
            if p.rotation_mode == "QUATERNION":
                p.keyframe_insert("rotation_quaternion", frame=ff)
            else:
                p.keyframe_insert("rotation_euler", frame=ff)


def poner_animado(poses, fin):
    """Como `poner`, con el retraso por grupo; el primer y el último cuadro van exactos, y las poses de
    contacto (tercer elemento True: la mano toca el cuerpo) también, para que la mano llegue con el cuerpo."""
    for i, item in enumerate(poses):
        f, pose = item[0], item[1]
        aplicar(pose)
        exacto = i == 0 or f >= fin or (len(item) > 2 and item[2])
        if exacto:
            viejo = dict(RETRASO)
            for k in RETRASO:
                RETRASO[k] = 0
            llave_grupos(f, fin=fin)
            RETRASO.update(viejo)
        else:
            llave_grupos(f, fin=fin)


# ---------------------------------------------------------------- manos
CURVA = {  # grados de doblez por falange (1, 2, 3): índice, medio, meñique, pulgar
    "relajada": {"index": (14, 22, 14), "middle": (22, 28, 18), "pinky": (30, 34, 22), "thumb": (8, 10, 6)},
    "abierta": {"index": (-6, -4, -2), "middle": (-6, -4, -2), "pinky": (-6, -4, -2), "thumb": (-14, -6, 0)},
    "estirada": {"index": (-14, -8, -4), "middle": (-14, -8, -4), "pinky": (-16, -8, -4), "thumb": (-22, -10, 0)},
    "puno": {"index": (70, 88, 62), "middle": (74, 90, 64), "pinky": (78, 90, 66), "thumb": (30, 38, 30)},
    "apoyada": {"index": (6, 8, 4), "middle": (8, 8, 4), "pinky": (10, 10, 6), "thumb": (-4, 2, 0)},
    "panza": {"index": (10, 14, 8), "middle": (12, 16, 8), "pinky": (14, 18, 10), "thumb": (6, 8, 4)},
    "rasca": {"index": (48, 58, 40), "middle": (52, 60, 42), "pinky": (56, 62, 44), "thumb": (18, 20, 10)},
    "rasca_medio": {"index": (29, 36, 24), "middle": (32, 38, 25), "pinky": (35, 40, 27), "thumb": (12, 14, 7)},
    "unieta": {"index": (46, 40, 30), "middle": (40, 46, 30), "pinky": (48, 50, 34), "thumb": (30, 26, 14)},
    "acorde_a": {"index": (30, 46, 30), "middle": (52, 56, 36), "pinky": (24, 30, 20), "thumb": (22, 18, 8)},
    "acorde_b": {"index": (48, 52, 34), "middle": (28, 40, 26), "pinky": (56, 58, 40), "thumb": (22, 18, 8)},
    "pua": {"index": (60, 90, 40), "middle": (4, 6, 4), "pinky": (10, 12, 6), "thumb": (60, 70, 40)},
    "cuernos": {"index": (-4, -2, 0), "middle": (80, 92, 66), "pinky": (-6, -2, 0), "thumb": (44, 40, 26)},
    "susto": {"index": (-16, -10, -4), "middle": (-18, -10, -4), "pinky": (-20, -10, -4), "thumb": (-26, -10, 0)},
}


def dedos(idle_dedos, izq="relajada", der="relajada", ajuste=None):
    """Los dedos de las dos manos en esas formas (doblez en X negativo de su falange, desde el reposo);
    `ajuste`: {(lado, dedo): (a, b, c)} grados que se suman (para que no se vean iguales)."""
    out = {}
    for n in DEDOS:
        lado = n[-1]
        if "base" in n:
            out[n] = idle_dedos[n].copy()
            continue
        dedo = next(d for d in ("index", "middle", "pinky", "thumb") if n.startswith(d))
        falange = int(n[len(dedo)]) - 1
        forma = CURVA[izq if lado == "l" else der]
        a = forma[dedo][falange]
        if ajuste and (lado, dedo) in ajuste:
            a += ajuste[(lado, dedo)][falange]
        out[n] = Euler((math.radians(-a), 0, 0), "XYZ").to_quaternion()
    if der == "pua" and "MANO_PUA" in globals():   # la mano de la púa: los dedos de Oscar tal cual
        for n, q in MANO_PUA["dedos"].items():
            if n in out:
                out[n] = Quaternion(q)
    if izq in ("acorde_a", "acorde_b") and "MANO_TRASTE" in globals():   # los acordes: los dedos de Oscar
        for n, q in MANO_TRASTE["dedos"].items():
            if n in out:
                out[n] = Quaternion(q)
        a2, a3 = MANO_TRASTE["abre_pulgar"]
        out["thumb2.l"] = out["thumb2.l"] @ Quaternion((1, 0, 0), math.radians(a2))
        out["thumb3.l"] = out["thumb3.l"] @ Quaternion((1, 0, 0), math.radians(a3))
    return out


def mano_mat(pos, dedos_hacia, dorso_hacia):
    """La matriz del control de la mano: en `pos`, los dedos hacia `dedos_hacia` y el dorso hacia `dorso_hacia`
    (eje Y del hueso = hacia los dedos, Z = el dorso; la palma ve hacia -Z)."""
    Y = Vector(dedos_hacia).normalized()
    Z = Vector(dorso_hacia)
    Z = (Z - Z.dot(Y) * Y).normalized()
    X = Y.cross(Z)
    M = Matrix((X, Y, Z)).transposed().to_4x4()
    M.translation = Vector(pos)
    return M


# ---------------------------------------------------------------- apoyar por partes
PARTES_PISO = {"cadera": ("Egg_Pelvis", "Egg_Torax", "Egg_Head", "Egg_Leg2_L", "Egg_Leg2_R"),
               "pie_l": ("Egg_Foot_L", "Egg_Leg1_L"), "pie_r": ("Egg_Foot_R", "Egg_Leg1_R"),
               "mano_l": ("Egg_Arm1_L",), "mano_r": ("Egg_Arm1_R",)}


def _bajo_de(pose, piezas):
    b = bajo_cuerpo(pose, piezas=piezas)
    return min(b[n] for n in piezas)


def _bajo_mano(pose, lado, radio=24.0):
    """Lo más bajo de la mano (cm): los vértices de su pieza a menos de `radio` de la muñeca (la pieza trae el antebrazo)."""
    ad = ARM.animation_data
    antes, antes_slot = ad.action, ad.action_slot
    ad.action = None
    aplicar(pose)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    muneca = ARM.matrix_world @ ARM.evaluated_get(dg).pose.bones[f"hand.{lado}"].head
    vs, _ = _malla(bpy.data.objects["Egg_Arm1_L" if lado == "l" else "Egg_Arm1_R"], dg)
    cerca = [v.z for v in vs if (v - muneca).length < radio * 0.01]
    ad.action = antes
    if antes is not None:
        ad.action_slot = antes_slot
    return min(cerca) * 100 if cerca else 9e9


def apoyar_partes(pose, partes=("cadera", "pie_l", "pie_r", "mano_l", "mano_r"), holgura=PISO + 0.15, vueltas=3, tope=8.0, holgura_manos=1.3):
    """Pone en el piso lo que se pide: primero el cuerpo entero (lo más bajo de cadera, torso, cabeza y muslos)
    y luego cada mano o pie por su cuenta (lo más bajo de su pieza), sin meter nada bajo el piso."""
    p = pose
    if "cadera" in partes:
        m = _bajo_de(p, PARTES_PISO["cadera"] + tuple(n for k in partes if k != "cadera" for n in PARTES_PISO[k]))
        p = mover_todo(p, (0, 0, holgura - m))
        m = _bajo_de(p, PARTES_PISO["cadera"])
        # el cuerpo baja hasta tocar (manos y pies se apoyan después)
        p = mover_todo(p, (0, 0, holgura - m))
    for _ in range(vueltas):
        for k in partes:
            if k == "cadera":
                continue
            m = _bajo_mano(p, k[-1]) if k.startswith("mano") else _bajo_de(p, PARTES_PISO[k])
            meta = holgura + (holgura_manos if k.startswith("mano") else 0.0)
            # si el brazo no alcanza, la mano no sigue al control: con tope no se desboca
            m = meta - max(-tope, min(tope, meta - m))
            v = p.get(k)
            if not v:
                continue
            v = dict(v)
            if "mat" in v:
                M = v["mat"].copy(); M.translation.z += meta - m; v = {"mat": M}
            else:
                v["pos"] = (v["pos"][0], v["pos"][1], v["pos"][2] + meta - m)
            p = dict(p); p[k] = v
    return p


# ---------------------------------------------------------------- capturar (con los huesos libres)
_capturar_base = capturar


def capturar(accion=IDLE, cuadro=1):
    pose = _capturar_base(accion, cuadro)
    sc = bpy.context.scene
    ad = ARM.animation_data
    antes, antes_slot = ad.action, ad.action_slot
    act = bpy.data.actions[accion]
    ad.action = act
    if len(act.slots):
        ad.action_slot = act.slots[0]
    sc.frame_set(cuadro)
    dg = bpy.context.evaluated_depsgraph_get()
    P = ARM.evaluated_get(dg).pose.bones
    pose["libres"] = {n: (P[n].location.copy(), P[n].rotation_quaternion.copy()) for n in LIBRES}
    ad.action = antes
    if antes is not None:
        ad.action_slot = antes_slot
    return pose


_aplicar_base = aplicar


def aplicar(pose):
    _aplicar_base(pose)
    for n, (loc, q) in (pose.get("libres") or {}).items():
        PB[n].location = loc
        PB[n].rotation_quaternion = q


# ---------------------------------------------------------------- variar y cuerpo
def _add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def _mat_de(v):
    return v["mat"].copy() if "mat" in v else _mat_mundo("ctl_mano_ik.l", v.get("pos"), v.get("rot", (0, 0, 0)))


def variar(base, cadera_mueve=None, cadera_gira=None, columna=None, cuello=None, cabeza=None, quijada=None,
           manos=None, pies=None, codos=None, rodillas=None, dedos_=None, pelo=None):
    """Una pose desde `base` (con matrices): mueve/gira la cadera, SUMA a columna, cuello y cabeza, y cambia
    manos/pies (lado -> {"mat": M} | {"pos": p} | {"mueve": d} | {"gira": r grados mundo})."""
    p = dict(base)
    if cadera_mueve or cadera_gira:
        M = p["cadera_mat"].copy()
        h = M.to_translation()
        if cadera_gira:
            R = Euler([math.radians(a) for a in cadera_gira], "XYZ").to_matrix().to_4x4()
            M = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M
        if cadera_mueve:
            M.translation = M.translation + Vector(cadera_mueve)
        p["cadera_mat"] = M
    if columna:
        p["columna"] = [_add(a, b) for a, b in zip(base["columna"], columna)]
    if cuello:
        p["cuello"] = _add(base["cuello"], cuello)
    if cabeza:
        p["cabeza"] = _add(base["cabeza"], cabeza)
    if quijada is not None:
        p["quijada"] = quijada
    for k, cambios in (("mano", manos), ("pie", pies)):
        for lado, c in (cambios or {}).items():
            M = base[f"{k}_{lado}"]["mat"].copy()
            if "mat" in c:
                M = c["mat"].copy()
            if "gira" in c:
                R = Euler([math.radians(a) for a in c["gira"]], "XYZ").to_matrix().to_4x4()
                t = M.to_translation()
                M = Matrix.Translation(t) @ R @ Matrix.Translation(-t) @ M
            if "pos" in c:
                M.translation = Vector(c["pos"])
            if "mueve" in c:
                M.translation = M.translation + Vector(c["mueve"])
            p[f"{k}_{lado}"] = {"mat": M}
    for k, cambios in (("codo", codos), ("rodilla", rodillas)):
        for lado, v in (cambios or {}).items():
            p[f"{k}_{lado}"] = tuple(v)
    if dedos_ is not None:
        p["dedos"] = dedos_
    if pelo is not None:
        p["pelo"] = pelo
    return p


def cuerpo(base, cadera, rot, columna=((0, 0, 0),) * 3, cuello=(0, 0, 0), cabeza=(0, 0, 0), quijada=0,
           manos=None, pies=None, codos=None, rodillas=None, dedos_=None, pelo=None):
    """Una pose suelta (sentado, acostado) con los huesos libres de `base`: la cadera en `cadera` girada
    `rot` (grados, mundo) desde el reposo; manos: lado -> Matrix (mano_mat); pies: lado -> (pos, rot extra)."""
    Rb = Euler([math.radians(a) for a in rot], "XYZ").to_matrix()
    p = {"cadera": {"pos": tuple(cadera), "rot": tuple(rot)}, "columna": [tuple(c) for c in columna],
         "cuello": tuple(cuello), "cabeza": tuple(cabeza), "quijada": quijada, "libres": base.get("libres", {})}
    for lado, M in (manos or {}).items():
        p[f"mano_{lado}"] = {"mat": M}
    for lado, (pos, extra) in (pies or {}).items():
        R = (Rb @ Euler([math.radians(a) for a in extra], "XYZ").to_matrix()).to_euler("XYZ")
        p[f"pie_{lado}"] = {"pos": tuple(pos), "rot": tuple(math.degrees(a) for a in R)}
    for k, cambios in (("codo", codos), ("rodilla", rodillas)):
        for lado, v in (cambios or {}).items():
            p[f"{k}_{lado}"] = tuple(v)
    p["dedos"] = dedos_ if dedos_ is not None else base["dedos"]
    if pelo is not None:
        p["pelo"] = pelo
    return p


def a_matrices(pose):
    """La misma pose con cadera, manos y pies como matrices (para variarla con `variar`)."""
    ad = ARM.animation_data
    antes, antes_slot = ad.action, ad.action_slot
    ad.action = None
    aplicar(pose)
    bpy.context.view_layer.update()
    out = dict(pose)
    out.pop("cadera", None)
    out["cadera_mat"] = PB["root.x"].matrix.copy()
    for lado in ("l", "r"):
        out[f"mano_{lado}"] = {"mat": PB[f"ctl_mano_ik.{lado}"].matrix.copy()}
        out[f"pie_{lado}"] = {"mat": PB[f"ctl_pie_ik.{lado}"].matrix.copy()}
        for k, n in (("codo", "ctl_codo"), ("rodilla", "ctl_rodilla")):
            out[f"{k}_{lado}"] = tuple(PB[f"{n}.{lado}"].head)
    out.setdefault("columna", [(0, 0, 0)] * 3)
    out.setdefault("cuello", (0, 0, 0))
    out.setdefault("cabeza", (0, 0, 0))
    ad.action = antes
    if antes is not None:
        ad.action_slot = antes_slot
    return out


def con_libres(pose, giros):
    """La pose con algunos huesos libres girados (grados locales sumados): dedos de los pies, etc."""
    p = dict(pose)
    lib = dict(p.get("libres") or {})
    for n, g in giros.items():
        if n in lib:
            loc, q = lib[n]
            lib[n] = (loc, q @ Euler([math.radians(a) for a in g], "XYZ").to_quaternion())
    p["libres"] = lib
    return p


# las manos de cada momento (posiciones en cm del armature; ver mano_mat)
# Las manos en el piso van con los dedos en diagonal hacia el frente y afuera (Oscar, 2026-11-23: volteadas
# hacia atrás "no se ven naturales"; tampoco del todo al frente)
def M_piso_atras(lado, y=36, x=22):
    s = 1 if lado == "l" else -1
    return mano_mat((s * x, y, 4), (s * 0.7, -0.7, 0), (0, 0, 1))


def M_piso_lado(lado, y=12, x=27):
    s = 1 if lado == "l" else -1
    return mano_mat((s * x, y, 4), (s * 0.6, -0.8, 0), (0, 0, 1))


def relajado(I):
    """De pie y suelto, sin lo particular del idle (Oscar, 2026-11-23: las animaciones "agarraban poses del idle
    original"): el idle trae el pie izquierdo atrás con el talón arriba y sus dedos doblados 53° (se quedaban
    doblados hasta acostado) y los brazos de pistolero con las manos hacia afuera. Aquí: los pies parejos y planos
    bajo la cadera, los dedos de los pies derechos, los brazos colgando con las palmas hacia los muslos y los dedos
    sueltos. Las animaciones parten de esto y no heredan nada del idle, tampoco su primer ni su último cuadro
    (regla de Oscar, 2026-11-23): el sitio mezcla suave de lo que traiga a la animación y de regreso."""
    R = dict(I)
    R["libres"] = {n: ((loc * 0, Quaternion()) if n.startswith("toes") else (loc, q)) for n, (loc, q) in I["libres"].items()}
    Mr = I["pie_r"]["mat"]
    espejo = Matrix.Diagonal((-1, 1, 1))
    rot_r = Mr.to_3x3()
    for lado, rot in (("r", rot_r), ("l", espejo @ rot_r @ espejo)):
        sx = 1 if lado == "l" else -1
        M = rot.to_4x4()
        M.translation = Vector((sx * 12, -4, Mr.translation.z))
        R[f"pie_{lado}"] = {"mat": M}
    for lado in ("l", "r"):
        sx = 1 if lado == "l" else -1
        R[f"mano_{lado}"] = {"mat": mano_mat((sx * 26, -13, 54), (sx * 0.08, -0.2, -1), (sx, -0.15, 0))}
        R[f"codo_{lado}"] = (sx * 32, 24, 74)
        R[f"rodilla_{lado}"] = (sx * 16, -45, 40)
    R["columna"] = [(0, 0, 0)] * 3
    R["dedos"] = dedos(I["dedos"], "relajada", "relajada")
    R = apoyar_partes(R, partes=("pie_l", "pie_r"))
    for lado in ("l", "r"):
        sx = 1 if lado == "l" else -1
        R = tocar(R, lado, ("Egg_Pelvis", "Egg_Leg2_L", "Egg_Leg2_R", "Egg_Torax"), (-sx, 0, 0), lejos=14, holgura=2.0)
    return a_matrices(R)


def paso_a(desde, hacia, lado, alto=5.0, t=0.5):
    """Medio paso: el pie `lado` entre su lugar en `desde` y en `hacia`, levantado `alto` cm (para que no patine)."""
    a = desde[f"pie_{lado}"]["mat"]
    b = hacia[f"pie_{lado}"]["mat"]
    M = b.copy()
    M.translation = a.translation.lerp(b.translation, t) + Vector((0, 0, alto))
    return M


def M_panza(lado):
    """Acostado boca arriba: la izquierda sobre las costillas de abajo y la derecha sobre el pecho (es un
    esqueleto: entre costillas y pelvis no hay panza, solo la columna). Arriba de más: `tocar` las baja."""
    if lado == "l":
        return mano_mat((7, 2, 34), (-1, 0, -0.1), (0.1, 0, 1))
    return mano_mat((-7, 24, 36), (1, 0, -0.1), (-0.1, 0, 1))


def M_estira(lado, x=60, y=6, z=101, sube=0.3):
    s = 1 if lado == "l" else -1
    return mano_mat((s * x, y, z), (s, 0, sube), (0, 1, 0))


# ---------------------------------------------------------------- dormir
def pose_dormido(idle):
    """Boca arriba, las manos en la panza (la derecha encima), los tobillos cruzados y la barbilla metida."""
    idle = relajado(idle)
    p = cuerpo(idle, (0, -10, 11), (-84, 0, 0), cuello=(10, 0, 0), cabeza=(12, 0, 0), quijada=18,
               manos={"l": M_panza("l"), "r": M_panza("r")},
               pies={"r": ((-5, -64, 19), (30, -12, 0)), "l": ((6, -69, 5), (30, 12, 0))},
               codos={"r": (-64, 14, 24), "l": (64, -4, 22)}, rodillas={"r": (-14, -40, 50), "l": (14, -40, 50)},
               dedos_=dedos(idle["dedos"], "panza", "panza", {("r", "index"): (6, 4, 2), ("l", "pinky"): (-4, 0, 0)}))
    p = apoyar_partes(p, partes=("cadera", "pie_l"))
    p = tocar(p, "l", CUERPO, (0, 0, -1))
    p = tocar(p, "r", CUERPO, (0, 0, -1))
    return p


def dormir_entra(fin=142):
    I = capturar(IDLE, 1)
    Id = I["dedos"]
    R = relajado(I)
    S = pose_dormido(I)
    Sm = a_matrices(S)
    # su propia pose desde el primer cuadro: no hereda nada del idle; el sitio mezcla desde lo que traiga
    poses = [(1, R)]
    # se le cierran los ojos: cabecea
    poses.append((8, variar(R, cadera_mueve=(0, 0, -3), columna=[(6, 0, 0)] * 3, cabeza=(10, 0, 0), quijada=3,
                            manos={"l": {"mueve": (0, -1, -2)}, "r": {"mueve": (0, -1, -2)}},
                            dedos_=dedos(Id, "relajada", "relajada", {("l", "index"): (6, 4, 0), ("r", "pinky"): (4, 0, 0)}))))
    poses.append((14, variar(R, cadera_mueve=(0, 0, -1.5), columna=[(3, 0, 0)] * 3, cabeza=(-4, 0, 0), quijada=2,
                             dedos_=dedos(Id, "relajada", "relajada"))))
    # bosteza estirándose: brazos a los lados con las palmas al frente, dedos abriéndose
    poses.append((26, variar(R, cadera_mueve=(0, 0, 2), columna=[(-6, 0, 0), (-6, 0, 0), (-4, 0, 0)],
                             cuello=(-12, 0, 0), cabeza=(-14, 0, 0), quijada=28,
                             manos={"l": {"mat": M_estira("l")}, "r": {"mat": M_estira("r")}},
                             codos={"l": (40, 45, 84), "r": (-40, 45, 84)}, dedos_=dedos(Id, "abierta", "abierta"))))
    poses.append((38, variar(R, cadera_mueve=(0, 0, 3), columna=[(-7, 0, 0), (-7, 0, 0), (-5, 0, 0)],
                             cuello=(-14, 0, 0), cabeza=(-18, 0, 0), quijada=35,
                             manos={"l": {"mat": M_estira("l", 64, 13, 108, 0.45)}, "r": {"mat": M_estira("r", 64, 13, 108, 0.45)}},
                             codos={"l": (40, 50, 88), "r": (-40, 50, 88)}, dedos_=dedos(Id, "estirada", "estirada"))))
    # tiembla tantito en lo más estirado (los dedos)
    poses.append((44, variar(R, cadera_mueve=(0, 0, 3), columna=[(-7, 0, 0), (-7, 0, 0), (-5, 0, 0)],
                             cuello=(-14, 0, 0), cabeza=(-17, 0, 0), quijada=34,
                             manos={"l": {"mat": M_estira("l", 63, 12, 107, 0.42)}, "r": {"mat": M_estira("r", 63, 12, 107, 0.42)}},
                             codos={"l": (40, 50, 88), "r": (-40, 50, 88)},
                             dedos_=dedos(Id, "estirada", "estirada", {("l", "index"): (8, 4, 0), ("r", "middle"): (6, 4, 0), ("l", "pinky"): (6, 0, 0)}))))
    # suelta: cierra la boca con un "mmm" y deja caer los brazos
    poses.append((52, variar(R, cadera_mueve=(0, 0, -1), columna=[(8, 0, 0)] * 3, cabeza=(6, 0, 0), quijada=4,
                             dedos_=dedos(Id, "relajada", "relajada", {("r", "index"): (-6, -4, 0)}))))
    poses.append((58, variar(R, cadera_mueve=(0, 0, -1.5), columna=[(8, 0, 0)] * 3, cabeza=(7, 7, 0), quijada=2,
                             dedos_=dedos(Id, "relajada", "relajada"))))
    # se rasca la panza
    poses.append((62, variar(R, cadera_mueve=(0, 0, -2), columna=[(7, 0, 0)] * 3, cabeza=(5, 4, 0), quijada=2,
                             manos={"r": {"mat": mano_mat((-30, -24, 66), (-0.2, -0.5, -0.8), (-1, 0, 0.2))}},
                             dedos_=dedos(Id, "relajada", "relajada"))))
    rasca0 = variar(R, cadera_mueve=(0, 0, -2), columna=[(6, 0, 0)] * 3, cuello=(0, 0, 0), cabeza=(4, -6, 0),
                    quijada=2, manos={"r": {"mat": mano_mat((-10, -27, 86), (0.45, 0.05, -0.8), (0, -1, 0))}},
                    codos={"r": (-55, -35, 72)}, dedos_=dedos(Id, "relajada", "rasca"))
    rasca_s = tocar(variar(rasca0, dedos_=dedos(Id, "relajada", "panza")), "r", CUERPO, (0, 1, 0), lejos=16, holgura=0.9)

    M_rasca = rasca0["mano_r"]["mat"]
    lejos_de = {}

    def rasca(f, dz, fuerte):
        if dz not in lejos_de:
            peor = None
            for curva in ("panza", "rasca_medio", "rasca"):
                b = variar(rasca0, dedos_=dedos(Id, "relajada", curva),
                           manos={"r": {"mat": Matrix.Translation((0, 0, dz)) @ M_rasca}})
                t = tocar(b, "r", CUERPO, (0, 1, 0), lejos=16, holgura=0.6)
                d = (t["mano_r"]["mat"].translation - b["mano_r"]["mat"].translation).y
                peor = d if peor is None else min(peor, d)
            lejos_de[dz] = peor
        return (f, variar(rasca0, dedos_=dedos(Id, "relajada", "rasca" if fuerte else "panza"),
                          manos={"r": {"mat": Matrix.Translation((0, lejos_de[dz], dz)) @ M_rasca}}), True)
    poses += [rasca(66, 0, False), rasca(69, -2, True), rasca(72, 1, False), rasca(75, -2, True), rasca(78, 0, False)]
    poses.append((82, variar(rasca_s, manos={"r": {"mat": Matrix.Translation((-8, -12, -6)) @ rasca_s["mano_r"]["mat"]}},
                             dedos_=dedos(Id, "relajada", "relajada"))))
    # mira el piso
    poses.append((86, variar(R, cadera_mueve=(0, 0, -2), columna=[(10, 0, 0)] * 3, cuello=(8, 0, 0), cabeza=(16, 0, 0), quijada=2,
                             manos={"l": {"mueve": (5, -3, 3)}, "r": {"mueve": (-5, -3, 3)}},
                             dedos_=dedos(Id, "relajada", "relajada"))))
    poses.append((91, variar(R, cadera_mueve=(0, 4, -8), columna=[(8, 0, 0)] * 3, cuello=(8, 0, 0), cabeza=(14, 0, 0),
                             manos={"l": {"mat": mano_mat((36, 4, 50), (0.5, 0.2, -0.85), (1, 0, 0.3))},
                                    "r": {"mat": mano_mat((-36, 4, 50), (-0.5, 0.2, -0.85), (-1, 0, 0.3))}},
                             dedos_=dedos(Id, "abierta", "abierta"))))
    # se agacha hacia atrás, las manos abiertas buscando el piso
    baja = lambda lado: {"mat": mano_mat(((32 if lado == "l" else -32), 30, 30), ((0.2 if lado == "l" else -0.2), 0.4, -1), ((0.3 if lado == "l" else -0.3), 1, 0.2))}
    poses.append((96, variar(R, cadera_mueve=(0, 14, -24), columna=[(4, 0, 0), (2, 0, 0), (1, 0, 0)],
                             cuello=(8, 0, 0), cabeza=(8, 0, 0), manos={"l": baja("l"), "r": baja("r")},
                             codos={"l": (45, 40, 50), "r": (-45, 40, 50)},
                             rodillas={"l": (46, -50, 40), "r": (-46, -50, 40)}, dedos_=dedos(Id, "abierta", "abierta"))))
    # bajando: echado para atrás, las manos casi en el piso y los pies resbalando al frente
    bajando = cuerpo(R, (0, 16, 24), (-12, 0, 0), columna=[(4, 0, 0)] * 3, cuello=(8, 0, 0), cabeza=(4, 0, 0), quijada=3,
                     manos={"l": M_piso_atras("l", 32), "r": M_piso_atras("r", 32)},
                     pies={"l": ((16, -22, 5), (0, 8, 0)), "r": ((-16, -22, 5), (0, -8, 0))},
                     codos={"l": (45, 50, 40), "r": (-45, 50, 40)}, rodillas={"l": (50, -40, 50), "r": (-50, -40, 50)},
                     dedos_=dedos(Id, "abierta", "abierta"))
    poses.append((101, mover_pies(apoyar_partes(bajando, partes=("pie_l", "pie_r")), 0.8)))
    # sentado: la cadera al piso, las piernas al frente, las manos atrás planas
    sentado = cuerpo(R, (0, 18, 11), (-15, 0, 0), columna=[(4, 0, 0)] * 3, cuello=(6, 0, 0), cabeza=(4, 0, 0), quijada=4,
                     manos={"l": M_piso_atras("l"), "r": M_piso_atras("r")},
                     pies={"l": ((12, -42, 5), (10, 8, 0)), "r": ((-12, -42, 5), (10, -8, 0))},
                     codos={"l": (45, 50, 30), "r": (-45, 50, 30)}, rodillas={"l": (16, -20, 70), "r": (-16, -20, 70)},
                     dedos_=dedos(Id, "apoyada", "apoyada"))
    sentado = mover_pies(apoyar_partes(sentado), 0.6)
    poses.append((106, sentado))
    poses.append((110, variar(a_matrices(sentado), cadera_mueve=(0, 0, 0.8), cabeza=(-3, 0, 0))))
    # se recarga en los codos
    codos = cuerpo(R, (0, 14, 11), (-45, 0, 0), cuello=(14, 0, 0), cabeza=(10, 0, 0), quijada=8,
                   manos={"l": M_piso_atras("l", 46, 26), "r": M_piso_atras("r", 46, 26)},
                   pies={"l": ((12, -55, 5), (25, 8, 0)), "r": ((-12, -55, 5), (25, -8, 0))},
                   codos={"l": (50, 75, 45), "r": (-50, 75, 45)}, rodillas={"l": (16, -30, 60), "r": (-16, -30, 60)},
                   dedos_=dedos(Id, "apoyada", "apoyada", {("l", "index"): (4, 0, 0)}))
    poses.append((114, variar(a_matrices(sentado), cadera_mueve=(0, -1, 0), columna=[(-6, 0, 0)] * 3,
                              manos={"l": {"mueve": (0, 6, 3)}, "r": {"mueve": (0, 6, 3)}})))
    poses.append((118, apoyar_partes(codos, holgura_manos=2.4), True))
    # se acuesta; las manos se deslizan a los lados
    acost = cuerpo(R, (0, -6, 11), (-80, 0, 0), cuello=(10, 0, 0), cabeza=(10, 0, 0), quijada=10,
                   manos={"l": M_piso_lado("l", 2, 30), "r": M_piso_lado("r", 2, 30)},
                   pies={"l": ((12, -64, 5), (30, 10, 0)), "r": ((-12, -64, 5), (30, -10, 0))},
                   codos={"l": (55, 25, 35), "r": (-55, 25, 35)}, rodillas={"l": (16, -40, 50), "r": (-16, -40, 50)},
                   dedos_=dedos(Id, "relajada", "relajada"))
    acost = apoyar_partes(acost, holgura_manos=2.4)
    acostm = a_matrices(acost)
    poses.append((122, variar(acostm, cadera_mueve=(0, 4, 2), manos={"l": {"mueve": (2, 14, 6)}, "r": {"mueve": (-2, 14, 6)}})))
    poses.append((126, acost))
    poses.append((129, variar(acostm, manos={"l": {"mueve": (4, 0, 16)}, "r": {"mueve": (-4, 0, 18)}},
                              dedos_=dedos(Id, "relajada", "relajada"))))
    # las manos suben a la panza (todavía arriba) y cruza los tobillos
    poses.append((133, variar(Sm, quijada=12, manos={"l": {"mueve": (2, 0, 6)}, "r": {"mueve": (-2, 0, 8)}},
                              pies={"r": {"mueve": (-6, 0, 9)}}, dedos_=dedos(Id, "relajada", "relajada")), True))
    # se acomoda con un rebotito
    poses.append((137, variar(mover_todo(Sm, (0, 0, 0.6)), quijada=14), True))
    poses.append((fin, S))
    act = nueva_accion("Dormir_entra", fin)
    poner_animado(poses, fin)
    return act, S


def respira(Sm, Id):
    """Lo más hondo de la respiración dormido (el pecho sube, las manos con él): la usa la cobija (cobija.py)."""
    return variar(Sm, columna=[(0, 0, 0), (-1, 0, 0), (-2, 0, 0)], cabeza=(3, 0, 0), quijada=24,
                  manos={"l": {"mueve": (0, 0.6, 1.4)}, "r": {"mueve": (0, 0.6, 1.6)}},
                  dedos_=dedos(Id, "panza", "panza", {("r", "index"): (2, 2, 0), ("l", "pinky"): (-6, -2, 0), ("l", "index"): (-4, -2, 0)}))


def dormir(S=None, fin=91):
    """Ciclo: respira con el pecho, ronca con la quijada, un dedo y los dedos de los pies se mueven."""
    I = capturar(IDLE, 1)
    if S is None:
        S = pose_dormido(I)
    Sm = a_matrices(S)
    Id = I["dedos"]
    inhala = respira(Sm, Id)
    exhala = variar(Sm, columna=[(0, 0, 0), (0.5, 0, 0), (0.5, 0, 0)], cabeza=(1.5, 0, 1.5), quijada=9,
                    dedos_=dedos(Id, "panza", "panza", {("r", "index"): (8, 6, 2), ("l", "pinky"): (-2, 0, 0)}))
    # el índice de arriba se mueve solo un instante y los dedos de los pies se encogen
    tic = variar(exhala, dedos_=dedos(Id, "panza", "panza", {("r", "index"): (-14, -8, -4), ("l", "pinky"): (-2, 0, 0)}))
    pies = con_libres(exhala, {"toes_01.l": (-18, 0, 0), "toes_01.r": (-14, 0, 0)})
    act = nueva_accion("Dormir", fin)
    poner_animado([(1, Sm), (32, inhala), (58, exhala), (64, tic), (70, pies), (78, exhala), (fin, Sm)], fin)
    return act


def dormir_sale(S=None, fin=82):
    I = capturar(IDLE, 1)
    Id = I["dedos"]
    R = relajado(I)
    if S is None:
        S = pose_dormido(I)
    Sm = a_matrices(S)
    poses = [(1, Sm)]
    poses.append((3, variar(Sm, quijada=6, manos={"l": {"mueve": (10, -1, 8)}, "r": {"mueve": (-11, -2, 9)}},
                            dedos_=dedos(Id, "relajada", "relajada")), True))
    # despierta de golpe: cierra la boca, alza la cabeza y abre las manos
    poses.append((5, variar(Sm, cuello=(6, 0, 0), cabeza=(2, 0, 0), quijada=0,
                            manos={"l": {"mueve": (10, -1, 6)}, "r": {"mueve": (-10, -1, 6)}}, dedos_=dedos(Id, "susto", "susto")), True))
    # ¿dónde estoy?
    poses.append((10, variar(Sm, cuello=(6, 0, 0), cabeza=(2, 16, 0), quijada=2,
                             manos={"l": {"mueve": (14, -4, 6)}, "r": {"mueve": (-14, -4, 6)}}, dedos_=dedos(Id, "abierta", "abierta"))))
    poses.append((15, variar(Sm, cuello=(6, 0, 0), cabeza=(2, -16, 0), quijada=2,
                             manos={"l": {"mueve": (14, -6, 5)}, "r": {"mueve": (-14, -10, 5)}}, dedos_=dedos(Id, "abierta", "relajada"))))
    poses.append((19, variar(Sm, cuello=(8, 0, 0), cabeza=(0, 0, 0), quijada=0, columna=[(4, 0, 0), (4, 0, 0), (2, 0, 0)],
                             manos={"l": {"mueve": (28, -8, 6)}, "r": {"mueve": (-30, -16, 6)}}, dedos_=dedos(Id, "abierta", "abierta"))))
    # se sienta de un jalón, las manos al piso a los lados
    sentado = cuerpo(R, (0, 8, 11), (-18, 0, 0), columna=[(6, 0, 0)] * 3, cuello=(4, 0, 0), cabeza=(-4, 0, 0), quijada=0,
                     manos={"l": M_piso_lado("l", 10, 34), "r": M_piso_lado("r", 10, 34)},
                     pies={"l": ((12, -52, 5), (15, 8, 0)), "r": ((-12, -52, 5), (15, -8, 0))},
                     codos={"l": (50, 30, 30), "r": (-50, 30, 30)}, rodillas={"l": (16, -20, 70), "r": (-16, -20, 70)},
                     dedos_=dedos(Id, "apoyada", "apoyada"))
    sentado = apoyar_partes(sentado, holgura_manos=2.4)
    poses.append((25, sentado))
    poses.append((30, variar(a_matrices(sentado), columna=[(4, 0, 0)] * 3, manos={"l": {"mueve": (0, 8, 6)}, "r": {"mueve": (0, 8, 6)}})))
    # recoge los pies y empuja con las manos atrás
    recoge = cuerpo(R, (0, 10, 11), (-18, 0, 0), columna=[(2, 0, 0), (2, 0, 0), (0, 0, 0)], cuello=(10, 0, 0), cabeza=(6, 0, 0),
                    manos={"l": M_piso_atras("l", 32, 24), "r": M_piso_atras("r", 32, 24)},
                    pies={"l": ((18, -26, 5), (0, 10, 0)), "r": ((-18, -26, 5), (0, -10, 0))},
                    codos={"l": (50, 55, 40), "r": (-50, 55, 40)}, rodillas={"l": (54, -40, 60), "r": (-54, -40, 60)},
                    dedos_=dedos(Id, "apoyada", "apoyada", {("l", "index"): (-4, 0, 0)}))
    poses.append((36, apoyar_partes(recoge, holgura_manos=2.4)))
    poses.append((42, variar(a_matrices(apoyar_partes(recoge, holgura_manos=2.4)), cadera_mueve=(0, -4, 1),
                             manos={"l": {"mat": mano_mat((38, 6, 40), (0.5, -0.3, -0.8), (1, 0, 0.2))},
                                    "r": {"mat": mano_mat((-38, 6, 40), (-0.5, -0.3, -0.8), (-1, 0, 0.2))}},
                             dedos_=dedos(Id, "abierta", "abierta"))))
    # en cuclillas, los brazos al frente para no irse de espaldas
    pies_recoge = {"l": {"mat": a_matrices(recoge)["pie_l"]["mat"]}, "r": {"mat": a_matrices(recoge)["pie_r"]["mat"]}}
    al_frente = lambda lado: {"mat": mano_mat(((20 if lado == "l" else -20), -40, 64), ((0.15 if lado == "l" else -0.15), -1, 0.05), (0, 0, 1))}
    poses.append((48, variar(R, cadera_mueve=(0, -16, -14), columna=[(2, 0, 0), (0, 0, 0), (0, 0, 0)], cabeza=(-2, 0, 0),
                             manos={"l": al_frente("l"), "r": al_frente("r")}, pies=pies_recoge,
                             rodillas={"l": (62, -50, 40), "r": (-62, -50, 40)}, dedos_=dedos(Id, "abierta", "abierta"))))
    # un pasito de cada pie para quedar donde pisa de pie
    recoge_m = a_matrices(recoge)
    poses.append((54, variar(R, cadera_mueve=(0, -8, -6), columna=[(4, 0, 0)] * 3, cabeza=(-4, 0, 0),
                             pies={"l": {"mat": paso_a(recoge_m, R, "l", alto=6, t=0.6)}, "r": pies_recoge["r"]},
                             dedos_=dedos(Id, "relajada", "abierta"))))
    poses.append((57, variar(R, cadera_mueve=(0, -3, -2), columna=[(1, 0, 0)] * 3, cabeza=(-4, 0, 0),
                             pies={"r": {"mat": paso_a(recoge_m, R, "r", alto=5, t=0.6)}}, dedos_=dedos(Id, "relajada", "relajada"))))
    # de pie, se estira tantito
    poses.append((60, variar(R, cadera_mueve=(0, 0, 1.5), columna=[(-3, 0, 0)] * 3, cabeza=(-4, 0, 0),
                             manos={"l": {"mueve": (4, 0, 2)}, "r": {"mueve": (-4, 0, 2)}}, dedos_=dedos(Id, "estirada", "estirada"))))
    # sacude la cabeza
    poses.append((66, variar(R, cabeza=(0, 18, 4), cuello=(0, 6, 0), dedos_=dedos(Id, "relajada", "relajada"))))
    poses.append((72, variar(R, cabeza=(0, -14, -3), cuello=(0, -5, 0), dedos_=dedos(Id, "relajada", "relajada", {("r", "index"): (-4, 0, 0)}))))
    # acaba de pie y suelto, sin el idle: el sitio mezcla de aquí a lo que siga
    poses.append((fin, R))
    act = nueva_accion("Dormir_sale", fin)
    poner_animado(poses, fin)
    return act


# ---------------------------------------------------------------- el solo de guitarra (una Flying V de verdad)
# Oscar, 2026-11-23: primero era guitarra de aire; ahora toca la Flying V azul de guitarra.py, colgada del pecho
# (spine_03.x). Las manos se calculan sobre la guitarra en cada pose: la izquierda pisa en un traste abrazando el
# mástil por abajo y la derecha rasguea con la púa sobre las cuerdas; las dos se acercan hasta tocar sin meterse.
# Parte de la pose relajada: no hereda nada del idle (regla de Oscar). En el sitio la guitarra aparece al agarrarla
# y se va al acabar (GUITARRA_SALE, cuadros de la acción).
_GNS = {}
_REPOS_G = [r"D:\Work\mroscar\Website\new\SkulleyRadPortfolio", r"D:\Work\mroscar\Website\new\Skulley-Rad-Portfolio"]
# dónde va en la pose de tocar (cm, armature): el punto donde se rasguea, hacia dónde va el mástil y hacia dónde la tapa
GUITARRA_S = (-12.0, -33.0, 68.0)  # con la guitarra a 1.5× (más arriba: el ala de abajo bajaba a la espinilla)
GUITARRA_X = (0.93, -0.12, 0.34)
GUITARRA_Z = (0.05, -0.99, 0.12)
CUERPO_G = ("Egg_Torax", "Egg_Pelvis", "Egg_Leg1_L", "Egg_Leg1_R", "Egg_Leg2_L", "Egg_Leg2_R")
GUITARRA_SALE = (36, 214)
COLGADA = {}
AJUSTE_MANOS = {}
# cm de aire entre las yemas y la guitarra en cada llave: entre llaves el torso gira y la mano interpolada se queda
# unos grados atrás de la guitarra (sin aire, las yemas se metían en los cuadros de en medio)
HOLGURA_PUA = 0.6
HOLGURA_TRASTE = 0.6
PUA_HONDO = -0.3   # la punta de la púa, en cada llave, apenas debajo del plano de las cuerdas (cm)
# La mano de la púa como la dejó Oscar en Blender (2026-11-23, cuadro 48: "yo dejo la mano en una pose y tú haces el
# resto"): el control de la mano en los ejes de la guitarra (cm), el polo del codo también en ellos, la púa en el
# espacio del pulgar (thumb3.r) y cada dedo de la derecha (cuaterniones). Su pose es la de arriba del rasgueo
MANO_PUA = {
    "mano": ((-0.60014, 0.79892, 0.03942, -4.40203), (-0.73239, -0.56864, 0.3745, 8.52213), (0.32161, 0.19588, 0.92639, 6.45335), (0.0, 0.0, 0.0, 1.0)),
    "codo": (-33.39827, 18.81523, 6.68489),
    "pua_en_pulgar": ((-0.12706, -0.71659, 0.68583, 0.27818), (0.40161, 0.59505, 0.69615, 4.80932), (-0.90695, 0.36389, 0.21218, 1.15371), (0.0, 0.0, 0.0, 1.0)),
    "dedos": {
        "index1_base.r": (1.0, 0.0, 0.0, 0.0),
        "index1.r": (0.99644, -0.08433, 0.0, 0.0),
        "index2.r": (0.70711, -0.70711, 0.0, 0.0),
        "index3.r": (0.93969, -0.34202, 0.0, 0.0),
        "middle1_base.r": (1.0, 0.0, 0.0, 0.0),
        "middle1.r": (0.99939, -0.0349, 0.0, 0.0),
        "middle2.r": (0.99863, -0.05234, 0.0, 0.0),
        "middle3.r": (0.99939, -0.0349, 0.0, 0.0),
        "pinky1_base.r": (1.0, 0.0, 0.0, 0.0),
        "pinky1.r": (0.99619, -0.08716, 0.0, 0.0),
        "pinky2.r": (0.99452, -0.10453, 0.0, 0.0),
        "pinky3.r": (0.99863, -0.05234, 0.0, 0.0),
        "thumb1.r": (0.93363, -0.23793, -0.01331, -0.26747),
        "thumb2.r": (0.81915, -0.57358, 0.0, 0.0),
        "thumb3.r": (0.93969, -0.34202, 0.0, 0.0),
    },
}
# La mano de los acordes como la dejó Oscar en Blender (2026-11-23, cuadro 48, traste 5: "el brazo debe descansar
# entre el pulgar y el índice"): el control de la mano y el polo del codo en los ejes de la guitarra y cada dedo de la
# izquierda. Para otro traste se desliza por el mástil con la misma forma. `abre_pulgar`: grados que se abren las
# falanges 2 y 3 del pulgar (apretaba el mástil 4.6 mm: el pellizco medía 4.1 cm y el mástil 4.3)
MANO_TRASTE = {
    "mano": ((0.96168, -0.08228, 0.26152, 47.34273), (0.27127, 0.4237, -0.86423, -12.92552), (-0.0397, 0.90206, 0.42979, -6.15483), (0.0, 0.0, 0.0, 1.0)),
    "codo": (42.68899, -29.22383, -49.28076),
    "abre_pulgar": (3.0, 6.0),
    "dedos": {
        "index1_base.l": (1.0, 0.0, 0.0, 0.0),
        "index1.l": (0.96593, -0.25882, 0.0, 0.0),
        "index2.l": (0.9205, -0.39073, 0.0, 0.0),
        "index3.l": (0.96593, -0.25882, 0.0, 0.0),
        "middle1_base.l": (1.0, 0.0, 0.0, 0.0),
        "middle1.l": (0.9985, -0.0547, 0.0, 0.0),
        "middle2.l": (0.88295, -0.46947, 0.0, 0.0),
        "middle3.l": (0.95106, -0.30902, 0.0, 0.0),
        "pinky1_base.l": (1.0, 0.0, 0.0, 0.0),
        "pinky1.l": (0.97815, -0.20791, 0.0, 0.0),
        "pinky2.l": (0.96593, -0.25882, 0.0, 0.0),
        "pinky3.l": (0.98481, -0.17365, 0.0, 0.0),
        "thumb1.l": (0.61921, 0.62886, 0.39012, 0.26253),
        "thumb2.l": (0.98769, -0.15643, 0.0, 0.0),
        "thumb3.l": (0.99756, -0.06976, 0.0, 0.0),
    },
}



def _g():
    """El módulo de la guitarra (guitarra.py), cargado una vez."""
    if not _GNS:
        repo = next((r for r in _REPOS_G if os.path.isdir(os.path.join(r, "public"))), _REPOS_G[-1])
        exec(open(os.path.join(repo, "scripts", "skulley-anim", "guitarra.py"), encoding="utf-8").read(), _GNS)
    return _GNS


def _G_base():
    X = Vector(GUITARRA_X).normalized()
    Z = Vector(GUITARRA_Z)
    Z = (Z - Z.dot(X) * X).normalized()
    Y = Z.cross(X)
    M = Matrix((X, Y, Z)).transposed().to_4x4()
    M.translation = Vector(GUITARRA_S)
    return M


def _en_poligono(x, y, pts):
    dentro = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            dentro = not dentro
        j = i
    return dentro


def _a_orilla(x, y, pts):
    m = 1e9
    for i in range(len(pts)):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % len(pts)]
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy + 1e-12)))
        m = min(m, math.hypot(x - ax - t * dx, y - ay - t * dy))
    return m


def mete_guitarra(v, cuerdas=True):
    """Lo más que se mete un punto (cm, en los ejes de la guitarra) en ella; negativo: afuera. Sin `cuerdas`, el
    espacio entre las cuerdas y el diapasón queda libre (la mano de los acordes las pisa)."""
    g = _g()
    E = g["ESCALA"]
    x, y, z = v.x / E, v.y / E, v.z / E   # en las medidas sin escalar
    peor = -9.0
    # cuerpo y clavijero: placas
    for pts, z0, z1 in ((g["CUERPO"], g["FONDO_Z"], g["TAPA_Z"]), (g["CLAVIJERO"], -2.3, -0.8)):
        if z0 <= z <= z1 and _en_poligono(x, y, pts):
            peor = max(peor, min(z - z0, z1 - z, _a_orilla(x, y, pts)) * E)
    # mástil: el diapasón y la espalda redonda
    if 13.0 <= x <= g["CEJUELA"] + 0.3:
        w = g["ancho_mastil"](x)
        tope, cara = g["DIAP_Z"] - 0.6, g["DIAP_Z"]
        hw = w / 2 + 0.05
        if tope <= z <= cara and abs(y) <= hw:
            peor = max(peor, min(cara - z, z - tope, hw - abs(y)) * E)
        if z <= tope:
            k = (y / (w / 2)) ** 2 + ((z - tope) / 2.25) ** 2
            if k <= 1:
                peor = max(peor, (1 - math.sqrt(k)) * min(w / 2, 2.25) * E)
    # las cuerdas: de lo ancho del puente a lo de la cejuela; debajo de ellas, hasta la tapa o el diapasón, no cabe
    # un dedo (sin esto los dedos pasaban entre las cuerdas)
    P0, C0 = g["PUENTE"], g["CEJUELA"]
    if cuerdas and P0 <= x <= C0:
        hw = 2.6 + (1.85 - 2.6) * (x - P0) / (C0 - P0) + 0.25
        if abs(y) <= hw and (g["TAPA_Z"] if x < 13.0 else g["DIAP_Z"]) <= z <= 0.15:
            peor = max(peor, min(0.15 - z, hw - abs(y)) * E)
    # pastillas, puente y cordal: cajas
    T = g["TAPA_Z"]
    cajas = [((px, 0, T + 0.45), (2.2, 4.2, 0.45)) for px in g["PASTILLAS"]]
    cajas += [((g["PUENTE"], 0, -0.6), (0.6, 4.2, 0.45)), ((-11.6, 0, -1.0), (0.7, 4.0, 0.4))]
    for (cx, cy, cz), (hx, hy, hz) in cajas:
        dx, dy, dz = hx - abs(x - cx), hy - abs(y - cy), hz - abs(z - cz)
        if dx > 0 and dy > 0 and dz > 0:
            peor = max(peor, min(dx, dy, dz) * E)
    return peor


def mete_mano(pose, lado, G, con_antebrazo=False):
    """Lo más que se mete la mano `lado` (o la pieza entera, con el antebrazo) en la guitarra con `pose`."""
    ad = ARM.animation_data
    antes = ad.action
    ad.action = None
    aplicar(pose)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pieza = "Egg_Arm1_L" if lado == "l" else "Egg_Arm1_R"
    vs, _ = _malla(bpy.data.objects[pieza], dg)
    idx = range(len(vs)) if con_antebrazo else _indices_mano(pieza)
    Gi = G.inverted() @ ARM.matrix_world.inverted()
    ad.action = antes
    if antes is not None and len(antes.slots):
        ad.action_slot = antes.slots[0]
    return max(mete_guitarra(Gi @ vs[i], cuerdas=(lado != "l")) for i in idx)


GUITARRA_DESHACE = (206, 214)  # = GUITARRA.deshace en siestaSkulley.js


def escala_guitarra(f):
    """Lo que mide la guitarra en el cuadro f (en el sitio se encoge desde su centro al deshacerse)."""
    a, b = GUITARRA_DESHACE
    u = max(0.0, min(1.0, (f - a) / (b - a)))
    return 1 - u * u * (3 - 2 * u)


def medir_guitarra(cuadros):
    """Cuadro por cuadro de la acción activa: lo más que se mete cada brazo (mano y antebrazo) en la guitarra, con lo
    que mide en ese cuadro."""
    sc = bpy.context.scene
    ob = bpy.data.objects[_g()["NOMBRE"]]
    c = sum((Vector(v) for v in ob.bound_box), Vector()) / 8
    out = []
    for f in cuadros:
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        G = _g()["marco"](ARM)
        Gi = G.inverted() @ ARM.matrix_world.inverted()
        k = escala_guitarra(f)
        fila = {"f": f}
        for lado, piezas in (("l", ("Egg_Arm1_L", "Egg_Arm2_L")), ("r", ("Egg_Arm1_R", "Egg_Arm2_R"))):
            if k < 0.05:
                fila[lado] = -9.0
                continue
            peor = -9.0
            for pieza in piezas:
                vs, _ = _malla(bpy.data.objects[pieza], dg)
                peor = max(peor, max(mete_guitarra(c + (Gi @ v - c) / k, cuerdas=(lado != "l")) * k for v in vs[::2]))
            fila[lado] = round(peor, 2)
        out.append(fila)
    return out


def marco_en(pose):
    """Dónde queda la guitarra (G: de sus cm al espacio del armature) con el cuerpo de `pose`."""
    ad = ARM.animation_data
    antes = ad.action
    ad.action = None
    aplicar(pose)
    bpy.context.view_layer.update()
    G = _g()["marco"](ARM)
    ad.action = antes
    if antes is not None and len(antes.slots):
        ad.action_slot = antes.slots[0]
    return G


def colgar_guitarra(base, holgura=-0.25):
    """La cuelga del pecho en la pose `base` y la despega del cuerpo lo justo, a lo largo de su tapa: con holgura
    negativa la espalda roza el cuerpo (sin hueco en las costillas)."""
    g = _g()
    if not bpy.data.objects.get(g["NOMBRE"]):
        g["modelar"]()
    G0 = _G_base()
    Z = G0.to_3x3() @ Vector((0, 0, 1))
    ad = ARM.animation_data

    def poner(d):
        ad.action = None
        aplicar(base)
        bpy.context.view_layer.update()
        G = G0.copy()
        G.translation = G0.translation + Z * d
        g["colocar"](ARM, G)

    def mete(d):
        poner(d)
        a = _hondura(base, g["NOMBRE"], CUERPO_G)
        b = max(_hondura(base, n, (g["NOMBRE"],)) for n in CUERPO_G)
        return max(a, b)

    lo, hi = -4.0, 14.0
    if mete(lo) <= -holgura:
        d = lo
    else:
        for _ in range(10):
            m = (lo + hi) / 2
            if mete(m) > -holgura:
                lo = m
            else:
                hi = m
        d = hi
    poner(d)
    # (para revisar) qué tanto queda de cada pieza contra la guitarra, en cm (negativo: separada)
    COLGADA.clear()
    COLGADA.update({"despega": round(d, 2), "por": {n: round(max(_hondura(base, g["NOMBRE"], (n,)), _hondura(base, n, (g["NOMBRE"],))), 2) for n in CUERPO_G}})
    return d


def guitarra(fin=216):
    I = capturar(IDLE, 1)
    Id = I["dedos"]
    R = relajado(I)
    g = _g()
    pies_abiertos = {"l": {"mueve": (6, -2, 0)}, "r": {"mueve": (-6, 2, 0)}}
    rod = {"l": (30, -60, 40), "r": (-30, -60, 40)}
    codos_tocar = {"l": (45, 10, 50), "r": (-50, -55, 72)}

    def cuerpo_tocar(cad=0.0, bang=0.0, quij=6, tap=0.0, columna=((4, 0, 4), (2, 0, 2), (0, 0, 0)), rodillas=None, pies=None):
        pp = pies or dict(pies_abiertos)
        if tap:
            pp = {"l": pies_abiertos["l"], "r": {"mueve": (-6, 2, 0), "gira": (tap, 0, 0)}}
        return variar(R, cadera_mueve=(0, 0, -6 + cad), columna=[tuple(c) for c in columna],
                      cuello=(bang * 0.4, 0, 0), cabeza=(bang, 0, 0), quijada=quij, pies=pp,
                      rodillas=rodillas or rod, codos=codos_tocar)

    base = cuerpo_tocar()
    g["modelar"]()          # siempre la de guitarra.py como está ahora
    g["pua_modelar"]()
    colgar_guitarra(base)
    Gb = marco_en(base)

    # la izquierda en el traste n: la muñeca abajo del mástil, la palma hacia arriba y hacia él, los dedos llegan al
    # diapasón por la orilla de abajo y el pulgar queda detrás
    E = g["ESCALA"]

    # la izquierda, como la dejó Oscar (MANO_TRASTE, en el traste 5): para otro traste se desliza por el mástil
    MANO_T = Matrix(MANO_TRASTE["mano"])
    X5 = g["traste_x"](5)
    codos_tocar["l"] = tuple(Gb @ Vector(MANO_TRASTE["codo"]))

    def M_traste(G, n):
        return G @ (Matrix.Translation((g["traste_x"](n) - X5, 0, 0)) @ MANO_T)

    # la derecha con la púa, como la dejó Oscar (MANO_PUA): su pose es la de arriba del rasgueo (la punta de la púa
    # junto a la cuerda gruesa) y para bajar se desliza a lo ancho de las cuerdas `CORRE_PUA` cm, sin girar
    CORRE_PUA = {"arriba": 0.0, "abajo": -9.2, "bajo": -10.5}
    # en el ¡zas! (bajo) el codo va más arriba: con la mano tan abajo, el bíceps rozaba por detrás la orilla del ala
    CODO_MAS = {"bajo": Vector((0, 4, 2))}
    MANO_P = Matrix(MANO_PUA["mano"])
    CODO_PUA = Vector(MANO_PUA["codo"])

    def M_pua0(G, muneca, gira=0.0):
        M = (Matrix.Rotation(math.radians(gira), 3, "X") @ MANO_P.to_3x3()).to_4x4()
        M.translation = muneca
        return G @ M

    def con_pose(pose, que):
        ad = ARM.animation_data
        antes = ad.action
        ad.action = None
        aplicar(pose)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        r = que(ARM.evaluated_get(dg).pose.bones, dg)
        ad.action = antes
        if antes is not None and len(antes.slots):
            ad.action_slot = antes.slots[0]
        return r

    pose_pua = lambda w: variar(base, codos={"l": codos_tocar["l"], "r": Gb @ CODO_PUA}, manos={"r": {"mat": M_pua0(Gb, w)}},
                                dedos_=dedos(Id, "relajada", "pua"))

    # la púa donde la dejó Oscar, en el espacio del pulgar
    PUA_EN_PULGAR = Matrix(MANO_PUA["pua_en_pulgar"])
    punta_pua = lambda pose: Gb.inverted() @ con_pose(pose, lambda ev, dg: ev[g["PUA_HUESO"]].matrix @ PUA_EN_PULGAR @ Vector((0, g["PUA_PUNTA"], 0)))

    # dónde va la muñeca en cada altura (una vez, en la pose base; en los ejes de la guitarra): la de Oscar corrida a
    # lo ancho; solo sube si algo de la mano o del antebrazo se metiera (más su holgura)
    AJUSTE_MANOS.clear()
    aleja = {}
    for donde in CORRE_PUA:
        w = MANO_P.translation + Vector((0, CORRE_PUA[donde], 0))
        z_oscar = w.z

        def mete_en(z):
            v = w.copy()
            v.z = z
            return mete_mano(pose_pua(v), "r", Gb, True)
        lo, hi = z_oscar - 6.0, z_oscar + 14.0
        if mete_en(lo) <= 0:
            z0 = lo
        else:
            for _ in range(11):
                m = (lo + hi) / 2
                if mete_en(m) > 0:
                    lo = m
                else:
                    hi = m
            z0 = hi
        w.z = max(z_oscar, z0 + HOLGURA_PUA)
        aleja[("r", donde)] = w.copy()
        AJUSTE_MANOS[f"pua_{donde}"] = {"muneca": [round(c, 2) for c in w], "sube": round(w.z - z_oscar, 2),
                                        "punta": [round(c, 2) for c in punta_pua(pose_pua(w))]}
    ACORDES_G = {"a": ("acorde_a", 5), "b": ("acorde_b", 3), "c": ("acorde_a", 7)}
    AJUSTE_MANOS.update({f"traste_{n}": round(mete_mano(variar(base, codos={"l": codos_tocar["l"], "r": codos_tocar["r"]}, manos={"l": {"mat": M_traste(Gb, n)}},
                                                             dedos_=dedos(Id, a, "relajada")), "l", Gb), 2)
                         for a, n in ACORDES_G.values()})

    def M_pua(G, donde, gira=0.0, mas=(0, 0, 0)):
        return M_pua0(G, aleja[("r", donde)] + Vector(mas), gira)

    def toca(f, donde, bang, acorde, traste, quij=6, cad=0.0, tap=0.0, gira=0.0, **cuerpo_k):
        c = cuerpo_tocar(cad=cad, bang=bang, quij=quij, tap=tap, **cuerpo_k)
        G = marco_en(c)
        return (f, variar(c, codos={"l": codos_tocar["l"], "r": G @ (CODO_PUA + CODO_MAS.get(donde, Vector()))}, manos={"l": {"mat": M_traste(G, traste)}, "r": {"mat": M_pua(G, donde, gira)}},
                          dedos_=dedos(Id, acorde, "pua")), True)

    con_pose(pose_pua(aleja[("r", "arriba")]), lambda ev, dg: g["pua_colocar"](ARM, ev[g["PUA_HUESO"]].matrix @ PUA_EN_PULGAR))

    poses = [(1, R)]
    # ¿alguien me ve?
    poses.append((12, variar(R, cabeza=(0, 24, 0), cuello=(0, 8, 0))))
    # algo silba arriba: voltea al cielo (en el sitio la guitarra cae desde el cuadro 20, GUITARRA en siestaSkulley.js)
    poses.append((20, variar(R, cuello=(-12, -2, 0), cabeza=(-26, -4, 0), quijada=14, dedos_=dedos(Id, "relajada", "relajada"),
                             manos={"l": {"mueve": (3, -5, 3)}, "r": {"mueve": (-3, -5, 3)}})))
    # levanta las manos para cacharla, siguiéndola con la vista
    cachar = lambda lado: {"mat": mano_mat(((26 if lado == "l" else -26), -30, 90), ((0.3 if lado == "l" else -0.3), -0.85, 0.4), (0, 0.3, -1))}
    poses.append((29, variar(R, cadera_mueve=(0, 0, -2), cuello=(-8, 0, 0), cabeza=(-14, 0, 0), quijada=18,
                             manos={"l": cachar("l"), "r": cachar("r")}, codos={"l": (45, 10, 70), "r": (-45, 10, 70)},
                             dedos_=dedos(Id, "abierta", "abierta"))))
    # ¡la cacha! y el golpe le dobla las rodillas
    poses.append(toca(36, "arriba", 0, "acorde_a", 5, quij=16, cad=-2))
    poses.append(toca(39, "arriba", 6, "acorde_a", 5, quij=8, cad=-9))
    # el primer rasgueo y luego arriba y abajo cada 6 cuadros, rodillas y pie cada 12, headbang; el acorde cambia
    # cada 4 (traste 5, 3 y 7: la mano recorre el mástil)
    poses.append(toca(42, "arriba", 0, "acorde_a", 5))
    f, i = 48, 0
    while f <= 120:
        abajo = i % 2 == 0
        fuerte = (i % 4) in (0, 1)
        acorde, traste = ACORDES_G["abc"[(i // 4) % 3]]
        poses.append(toca(f, "abajo" if abajo else "arriba", 16 if fuerte else -4, acorde, traste,
                          quij=10 if fuerte else 4, cad=-2.5 if fuerte else 0.5, tap=-14 if fuerte else 0))
        f += 6
        i += 1
    # golpe de poder: primero se despega de las cuerdas, luego el brazo arriba a un lado y enfrente de la guitarra
    # (lejos del cráneo), la mano abierta... baja justo encima de las cuerdas y ¡zas!
    c = cuerpo_tocar(cad=1, bang=-4, quij=10)
    G = marco_en(c)
    poses.append((125, variar(c, codos={"l": codos_tocar["l"], "r": (-62, -80, 82)},
                              manos={"l": {"mat": M_traste(G, 5)}, "r": {"mat": M_pua(G, "abajo", mas=(0, 2, 14))}},
                              dedos_=dedos(Id, "acorde_a", "pua")), True))
    c134 = cuerpo_tocar(cad=3, bang=-10, quij=20, columna=((-4, 0, 6), (-4, 0, 4), (-2, 0, 0)))
    G = marco_en(c134)
    poses.append((134, variar(c134, cuello=(-6, 0, 0), codos={"l": codos_tocar["l"], "r": (-62, -60, 100)},
                              manos={"l": {"mat": M_traste(G, 5)}, "r": {"mat": mano_mat((-62, -44, 116), (-0.5, -0.2, 1), (-0.1, 1, 0.1))}},
                              dedos_=dedos(Id, "acorde_a", "abierta")), True))
    c = cuerpo_tocar(cad=-4, bang=-2, quij=26, columna=((0, 0, 5), (0, 0, 3), (0, 0, 0)))
    G = marco_en(c)
    poses.append((138, variar(c, codos={"l": codos_tocar["l"], "r": (-62, -80, 82)},
                              manos={"l": {"mat": M_traste(G, 4)}, "r": {"mat": M_pua(G, "arriba", mas=(0, 4, 16))}},
                              dedos_=dedos(Id, "acorde_b", "pua")), True))
    poses.append(toca(141, "bajo", 6, "acorde_b", 3, quij=30, cad=-10, columna=((5, 0, 4), (3, 0, 2), (0, 0, 0)),
                      rodillas={"l": (30, -60, 30), "r": (-30, -60, 30)}))
    # se endereza del golpe con la mano todavía abajo (sin esta llave, el brazo de arriba rozaba la orilla del ala)
    poses.append(toca(144, "bajo", 12, "acorde_b", 3, quij=22, cad=-6, columna=((3, 0, 2), (2, 0, 1), (0, 0, 0))))
    # rasgueo rápido con headbang
    f, i = 148, 0
    while f <= 168:
        abajo = i % 2 == 0
        acorde, traste = ACORDES_G["bbccaa"[i]]
        poses.append(toca(f, "abajo" if abajo else "arriba", 20 if abajo else -2, acorde, traste, quij=14, cad=-3 if abajo else 0))
        f += 4
        i += 1
    # salto de rockstar con los cuernos (la izquierda no suelta el mástil)
    def entre(a, b, t):
        if isinstance(a, dict):
            return {k: entre(a[k], b[k], t) for k in a}
        if isinstance(a, (tuple, list)):
            return tuple(entre(x, y, t) for x, y in zip(a, b))
        return a + (b - a) * t

    rod30 = {"l": (30, -60, 30), "r": (-30, -60, 30)}
    s174 = dict(cad=-8, bang=6, quij=10, columna=((12, 0, 0), (6, 0, 0), (2, 0, 0)), rodillas=rod30, pies=pies_abiertos)
    s182 = dict(cad=24, bang=-12, quij=32, columna=((-8, 0, 0), (-6, 0, 0), (-4, 0, 0)),
                pies={"l": {"mueve": (8, 8, 14)}, "r": {"mueve": (-8, 10, 14)}}, rodillas={"l": (30, -60, 70), "r": (-30, -60, 70)})
    s190 = dict(cad=-6, bang=10, quij=12, columna=((10, 0, 0), (6, 0, 0), (2, 0, 0)), rodillas=rod30, pies=pies_abiertos)
    cuello_s = {174: (2.4, 0, 0), 182: (-8, 0, 0), 190: (4, 0, 0)}
    codo_r = {174: codos_tocar["r"], 182: (-70, 10, 110), 190: codos_tocar["r"]}
    c174, c190 = cuerpo_tocar(**s174), cuerpo_tocar(**s190)
    G174, G190 = marco_en(c174), marco_en(c190)
    c = cuerpo_tocar(cad=-4, bang=2, quij=12)
    G = marco_en(c)
    poses.append((171, variar(c, manos={"l": {"mat": M_traste(G, 5)}, "r": {"mat": M_pua(G, "arriba", mas=(0, 2, 8))}},
                              dedos_=dedos(Id, "acorde_a", "pua")), True))
    der = {174: M_pua(G174, "arriba", mas=(0, 3, 12)), 182: mano_mat((-58, -16, 140), (-0.2, 0, 1), (0, 1, 0)),
           190: M_pua(G190, "arriba", mas=(0, 3, 8))}
    tramos = ((174, 182, s174, s182, 5, 7), (182, 190, s182, s190, 7, 3))
    for f in range(174, 191, 2):
        a, b, sa, sb, na, nb = tramos[0] if f < 182 else tramos[1]
        t = (f - a) / (b - a)
        t = t * t * (3 - 2 * t)
        c = cuerpo_tocar(**entre(sa, sb, t))
        G = marco_en(c)
        poses.append((f, variar(c, cuello=entre(cuello_s[a], cuello_s[b], t), codos={"l": codos_tocar["l"], "r": entre(codo_r[a], codo_r[b], t)},
                                manos={"l": {"mat": M_traste(G, na + (nb - na) * t)}, "r": {"mat": der[a].lerp(der[b], t)}},
                                dedos_=dedos(Id, "acorde_b" if f == 190 else "acorde_a", "puno" if f <= 178 else "cuernos")), True))
    # el último acorde
    s195 = dict(cad=0, bang=8, quij=8, columna=((4, 0, 4), (2, 0, 2), (0, 0, 0)), rodillas=rod, pies=pies_abiertos)
    c195 = cuerpo_tocar(**s195)
    G195 = marco_en(c195)
    der_g = (G190.inverted() @ der[190], G195.inverted() @ M_pua(G195, "abajo"))
    for f in (192, 194):
        t = (f - 190) / 5
        t = t * t * (3 - 2 * t)
        c = cuerpo_tocar(**entre(s190, s195, t))
        G = marco_en(c)
        sube = Matrix.Translation((0, 0, 1.2 if f == 194 else 0.0))  # cerrando la mano a la púa, un poco arriba
        poses.append((f, variar(c, manos={"l": {"mat": M_traste(G, 3 + 2 * t)}, "r": {"mat": G @ sube @ der_g[0].lerp(der_g[1], t)}},
                                dedos_=dedos(Id, "acorde_a", "cuernos" if f == 192 else "pua")), True))
    poses.append(toca(195, "abajo", 8, "acorde_a", 5, quij=8))
    # la suelta: primero se despegan las dos manos (la izquierda sale del mástil hacia afuera y abajo, por donde lo
    # abraza; subiéndola derecho los dedos lo cruzaban)
    c = cuerpo_tocar(cad=1, bang=0, quij=18, columna=((0, 0, 2), (-2, 0, 1), (-2, 0, 0)))
    G = marco_en(c)
    izq = M_traste(G, 5)
    izq.translation = izq.translation + G.to_3x3() @ Vector((0, -11, 1))  # baja del mástil (el pulgar va detrás)
    poses.append((197, variar(c, codos={"l": codos_tocar["l"], "r": (-62, -80, 82)},
                              manos={"l": {"mat": izq}, "r": {"mat": M_pua(G, "abajo", mas=(0, 2, 10))}},
                              dedos_=dedos(Id, "abierta", "abierta")), True))
    # ¡se prende! suelta la guitarra de golpe, las manos arriba y adelante con las palmas hacia ella (en el sitio arde
    # colgada y se deshace en ceniza, GUITARRA.quema y .deshace): nada baja a donde está hasta que se deshizo
    # (del hombro a la mano el brazo cruza el plano de la guitarra: arriba de ella, no por el mástil ni por el ala;
    #  echándose para atrás el pecho sube la guitarra a la altura de los brazos)
    suelta = lambda lado, y=-40, z=126: {"mat": mano_mat(((38 if lado == "l" else -38), y, z), ((0.35 if lado == "l" else -0.35), -0.2, 0.92), ((0.1 if lado == "l" else -0.1), 1, 0.15))}
    codo_alto = {"l": (62, -40, 108), "r": (-62, -40, 108)}
    atras = dict(cadera_mueve=(0, 3, -2), columna=[(-3, 0, 0)] * 3, cuello=(-6, 0, 0), cabeza=(-8, 0, 0))
    abajo_izq = lambda z=54: {"mat": mano_mat((34, -26, z), (0.15, -0.3, -0.95), (0.95, 0.1, 0.1))}
    poses.append((199, variar(R, **atras, quijada=28, manos={"l": abajo_izq(), "r": suelta("r")}, codos={"l": (45, 10, 40), "r": codo_alto["r"]},
                              dedos_=dedos(Id, "estirada", "estirada"))))
    # sacude la derecha arriba de la guitarra: ¡quema!
    abanico = lambda dz, gira: {"mat": Matrix.Translation((0, 0, dz)) @ mano_mat((-40, -40, 122), (-0.35, -0.25, 0.9), (-0.1, 1, 0.1)) @ Matrix.Rotation(math.radians(gira), 4, "Y")}
    for f, dz, gira, quij in ((203, 4, 30, 20), (206, -3, -30, 16), (209, 3, 25, 18)):
        poses.append((f, variar(R, cabeza=(6, -10, 0), quijada=quij, manos={"l": abajo_izq(56), "r": abanico(dz, gira)},
                                codos={"l": (45, 10, 40), "r": codo_alto["r"]}, dedos_=dedos(Id, "abierta", "abierta"))))
    # ve la ceniza en el piso
    poses.append((213, variar(R, columna=[(4, 0, 0)] * 3, cuello=(8, 0, 0), cabeza=(14, 0, 0), quijada=8,
                              manos={"l": {"mueve": (6, -14, 22)}, "r": {"mueve": (-6, -14, 22)}})))
    poses.append((fin, R))
    act = nueva_accion("Guitarra", fin)
    poner_animado(poses, fin)
    return act


def todo():
    a, S = dormir_entra()
    dormir(S)
    dormir_sale(S)
    guitarra()



_SOLO_MANO = {}


def _indices_mano(pieza):
    """Los vértices de la pieza del brazo que mueve la mano (su peso mayor es la mano o un dedo)."""
    if pieza not in _SOLO_MANO:
        o = bpy.data.objects[pieza]
        nombres = {g.index: g.name for g in o.vertex_groups}
        idx = []
        for v in o.data.vertices:
            if not v.groups:
                continue
            g = max(v.groups, key=lambda g: g.weight)
            n = nombres[g.group]
            if n.startswith(("hand", "thumb", "index", "middle", "pinky")):
                idx.append(v.index)
        _SOLO_MANO[pieza] = idx
    return _SOLO_MANO[pieza]


def _hondura(pose, pieza, contra, solo_mano=False):
    """Lo más que se mete (cm) la pieza en las de `contra` con la pose puesta (negativo: no se toca)."""
    ad = ARM.animation_data
    antes, antes_slot = ad.action, ad.action_slot
    ad.action = None
    aplicar(pose)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    vs, _ = _malla(bpy.data.objects[pieza], dg)
    if solo_mano:
        vs = [vs[i] for i in _indices_mano(pieza)]
    peor = -9.0
    for n in contra:
        vb, tb = _malla(bpy.data.objects[n], dg)
        t = BVHTree.FromPolygons(vb, tb)
        for v in vs[::2]:
            loc, nor, i, d = t.find_nearest(v, 0.12)
            if loc is None:
                continue
            h = (loc - v).dot(nor) * 100
            if h > peor:
                peor = h
    ad.action = antes
    if antes is not None:
        ad.action_slot = antes_slot
    return peor


def _mover_mano(pose, lado, d):
    p = dict(pose)
    M = p[f"mano_{lado}"]["mat"].copy()
    M.translation = M.translation + Vector(d)
    p[f"mano_{lado}"] = {"mat": M}
    return p


def tocar(pose, lado, contra, hacia, lejos=14.0, holgura=0.25, pasos=9):
    """Acerca la mano en la dirección `hacia` (desde `lejos` cm atrás) hasta que toca `contra` sin meterse:
    queda a `holgura` cm. Si ni lejos libra, la deja lejos."""
    h = Vector(hacia).normalized()
    pieza = "Egg_Arm1_L" if lado == "l" else "Egg_Arm1_R"
    a, b = 0.0, lejos  # a: cerca (puede meterse), b: lejos (libre)
    if _hondura(_mover_mano(pose, lado, -h * b), pieza, contra, True) > -holgura:
        print(f"tocar: la mano {lado} no libra ni a {lejos} cm")
        return _mover_mano(pose, lado, -h * b)
    if _hondura(pose, pieza, contra, True) <= -holgura:
        return pose
    for _ in range(pasos):
        m = (a + b) / 2
        if _hondura(_mover_mano(pose, lado, -h * m), pieza, contra, True) > -holgura:
            a = m
        else:
            b = m
    return _mover_mano(pose, lado, -h * b)


CUERPO = ("Egg_Torax", "Egg_Pelvis", "Egg_Head", "Egg_Jaw")



def mover_pies(pose, dz):
    """Sube los dos pies dz cm (un poco de holgura cuando resbalan por el piso)."""
    p = dict(pose)
    for lado in ("l", "r"):
        v = p.get(f"pie_{lado}")
        if not v:
            continue
        v = dict(v)
        if "mat" in v:
            M = v["mat"].copy(); M.translation.z += dz; v = {"mat": M}
        else:
            v["pos"] = (v["pos"][0], v["pos"][1], v["pos"][2] + dz)
        p[f"pie_{lado}"] = v
    return p
