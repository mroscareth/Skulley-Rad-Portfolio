"""
Mide las muñequeras de Skulley (prop "Munequeras") en Character/SkulleyRad.blend, cuadro por cuadro.

En Blender:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns)
    ns["medir"]()                 # cruces en reposo, idle, walk y Correr
    ns["apertura_necesaria"]()    # grados que hay que abrir cada brazo para que no cruce (por cuadro)
Todo en las coordenadas del armature (cm).

La muñequera es rígida (todo su peso en forearm_twist), así que se lleva la malla en reposo (con el bisel)
a cada cuadro con la matriz del hueso. Cuenta como traspaso cualquier par de triángulos que se cruzan
(BVHTree.overlap) entre una muñequera y:
- cada pieza del cuerpo (tórax, pelvis, piernas, cabeza, quijada, brazos; la mano y el antebrazo propios
  aparte: la mano no puede tocarla y el antebrazo tiene que quedar dentro del hueco);
- cada prenda (la chamarra separada en manga y cuerpo; pantalones, bóxers, botas, tenis, lentes);
- la otra muñequera.
Además da la holgura: lo más cerca que llega cada cosa (cm), para saber cuánto margen queda.

Con el hoodie y la inflada, las mangas van ceñidas (munequeras.py, copia_cenida): para medirlas se cambia
ROPA por las copias antes de medir, p. ej. ns["ROPA"] = ("mq_Hoodie_cenida", "mq_Inflada_cenida").
"""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ARM = bpy.data.objects["root"]
ACCIONES = ("root|root|Iddle", "root|root|Walking", "Correr")
HUESO = "forearm_twist"
CUERPO = ("Egg_Torax", "Egg_Pelvis", "Egg_Leg1_L", "Egg_Leg1_R", "Egg_Leg2_L", "Egg_Leg2_R", "Egg_Head", "Egg_Jaw",
          "Egg_Arm2_L", "Egg_Arm2_R", "Egg_Foot_L", "Egg_Foot_R")
ROPA = ("Chamarra", "Pantalones", "Boxers", "Botas", "Tenis", "Lentes", "Hoodie", "Inflada")
# hasta qué distancia del eje del antebrazo y a lo largo de él se buscan vecinos (cm, marco del hueso)
CERCA_R = 22.0
CERCA_Y = (-6.0, 12.0)


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


def malla(o, dg, inv):
    """Vértices evaluados (cm del armature) y caras (triángulos) de un objeto."""
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    n = len(me.vertices); a = np.empty(n * 3); me.vertices.foreach_get("co", a)
    me.calc_loop_triangles()
    t = np.empty(len(me.loop_triangles) * 3, dtype=np.int64); me.loop_triangles.foreach_get("vertices", t)
    oe.to_mesh_clear()
    m = np.array(inv @ o.matrix_world)
    return a.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3], t.reshape(-1, 3)


def pesos_brazo(o):
    """Por vértice, el peso de huesos del brazo (arm_*, forearm_*, hand, dedos) y de qué lado."""
    gn = {g.index: g.name for g in o.vertex_groups}
    out = np.zeros((len(o.data.vertices), 2))
    for v in o.data.vertices:
        for g in v.groups:
            n = gn[g.group]
            base = n.split(".")[0]
            if base.startswith(("arm", "forearm", "hand", "index", "middle", "pinky", "thumb")):
                if n.endswith(".l"):
                    out[v.index, 0] += g.weight
                elif n.endswith(".r"):
                    out[v.index, 1] += g.weight
    return out


def dominante(o):
    gn = {g.index: g.name for g in o.vertex_groups}
    return [max(((g.weight, gn[g.group]) for g in v.groups), default=(0, ""))[1] for v in o.data.vertices]


def preparar(nombre="Munequeras"):
    """La muñequera en reposo (con bisel) partida por lado, y cómo partir lo que hay que partir.
    nombre: el objeto de las muñequeras (otro, para medir una prueba sin tocar el de verdad)."""
    quitar_accion()
    dg = bpy.context.evaluated_depsgraph_get(); inv = ARM.matrix_world.inverted()
    vs, tri = malla(bpy.data.objects[nombre], dg, inv)
    lado = np.where(vs[tri[:, 0], 0] > 0, 0, 1)
    R = dict(vs=vs, tri={"l": tri[lado == 0], "r": tri[lado == 1]})
    R["reposo_hueso"] = {s: np.array(ARM.data.bones[HUESO + "." + s].matrix_local) for s in ("l", "r")}
    # la mano y el antebrazo propios (Egg_Arm1_*), por hueso dominante del vértice
    R["arm1"] = {}
    for S in ("L", "R"):
        o = bpy.data.objects["Egg_Arm1_" + S]
        d = np.array([not x.startswith("forearm") for x in dominante(o)])
        R["arm1"][S] = d
    R["brazo"] = {n: pesos_brazo(bpy.data.objects[n]) for n in ROPA if n in bpy.data.objects}
    return R


def muneca_en(R, s):
    """Vértices de la muñequera del lado s en la pose actual (matriz del hueso · reposo⁻¹)."""
    T = np.array(ARM.pose.bones[HUESO + "." + s].matrix) @ np.linalg.inv(R["reposo_hueso"][s])
    return R["vs"] @ T[:3, :3].T + T[:3, 3]


def vecinos(vs, tri, M, sel_tri=None):
    """Triángulos cerca de la muñequera (en el marco del hueso M = inversa de su matriz)."""
    l = vs @ M[:3, :3].T + M[:3, 3]
    r = np.hypot(l[:, 0], l[:, 2])
    cerca = (r < CERCA_R) & (l[:, 1] > CERCA_Y[0]) & (l[:, 1] < CERCA_Y[1])
    t = tri if sel_tri is None else tri[sel_tri]
    return t[cerca[t].any(axis=1)]


def bvh(vs, tri):
    return BVHTree.FromPolygons([tuple(v) for v in vs], [tuple(t) for t in tri], all_triangles=True)


def holgura(bv_m, vs_o, tri_o, idx_tri):
    """Distancia mínima de la muñequera a los vértices de esos triángulos (cm)."""
    if not len(idx_tri):
        return 99.0
    ids = np.unique(idx_tri)
    return min(bv_m.find_nearest(Vector(vs_o[i]))[3] for i in ids)


def medir_cuadro(R, dg=None, inv=None, que=None):
    """Por lado: {cosa: (pares de triángulos que se cruzan, holgura cm)}. `que`: solo esas cosas."""
    dg = dg or bpy.context.evaluated_depsgraph_get(); inv = inv or ARM.matrix_world.inverted()
    piezas = {}
    for n in CUERPO + ("Egg_Arm1_L", "Egg_Arm1_R"):
        o = bpy.data.objects.get(n)
        if o and (que is None or any(n.startswith(q) or q in n for q in que)):
            piezas[n] = malla(o, dg, inv)
    for n in ROPA:
        o = bpy.data.objects.get(n)
        if o and (que is None or n in que):
            piezas[n] = malla(o, dg, inv)
    res = {}
    mv = {s: muneca_en(R, s) for s in ("l", "r")}
    bvm = {s: bvh(mv[s], R["tri"][s]) for s in ("l", "r")}
    for s, S, k in (("l", "L", 0), ("r", "R", 1)):
        M = np.array(ARM.pose.bones[HUESO + "." + s].matrix.inverted())
        out = {}
        for n, (vs, tri) in piezas.items():
            grupos = {}
            if n.startswith("Egg_Arm1_"):
                mano = R["arm1"][n[-1]]
                mt = mano[tri].sum(axis=1) >= 2
                if n[-1] == S:
                    grupos = {"mano_propia": mt, "antebrazo_propio": ~mt}
                else:
                    grupos = {"otro_" + n: None}
            elif n in R["brazo"]:
                w = R["brazo"][n][:, k]
                manga = w[tri].mean(axis=1) > 0.5
                otra = R["brazo"][n][:, 1 - k][tri].mean(axis=1) > 0.5
                grupos = {n + "_manga": manga, n + "_cuerpo": ~manga & ~otra, n + "_otra_manga": otra}
            else:
                grupos = {n: None}
            for g, sel in grupos.items():
                t = vecinos(vs, tri, M, sel)
                if not len(t):
                    continue
                pares = len(bvm[s].overlap(bvh(vs, t)))
                out[g] = (pares, round(holgura(bvm[s], vs, t, t), 2))
        res[s] = out
    res["entre_munequeras"] = len(bvm["l"].overlap(bvm["r"]))
    return res


def medir(acciones=ACCIONES, paso=1, cuadros=None, que=None, nombre="Munequeras"):
    """Cada cuadro de cada acción: por lado y cosa, en cuántos cuadros se cruza, lo peor (pares de
    triángulos, cuadro) y la holgura mínima (cm, cuadro)."""
    sc = bpy.context.scene; antes = sc.frame_current
    R = preparar(nombre)
    res = {}
    try:
        res["reposo"] = medir_cuadro(R, que=que)
        for a in acciones:
            act = bpy.data.actions[a]
            f0, f1 = [int(round(x)) for x in act.frame_range]
            lista = cuadros or range(f0, f1 + 1, paso)
            tab = {"l": {}, "r": {}}; limpios = 0; entre = 0
            for f in lista:
                poner_accion(a, f)
                r = medir_cuadro(R, que=que)
                sucio = False
                for s in ("l", "r"):
                    for g, (pares, h) in r[s].items():
                        d = tab[s].setdefault(g, dict(cuadros=0, peor=(0, None), holgura=(99.0, None)))
                        if pares:
                            d["cuadros"] += 1; sucio = True
                            if pares > d["peor"][0]:
                                d["peor"] = (pares, f)
                        if h < d["holgura"][0]:
                            d["holgura"] = (h, f)
                if r["entre_munequeras"]:
                    entre += 1; sucio = True
                limpios += 0 if sucio else 1
            res[a] = dict(cuadros=len(lista), limpios=limpios, entre_munequeras=entre, por_lado=tab)
    finally:
        quitar_accion(); sc.frame_set(antes)
    return res


def resumen(res, solo_cruces=False):
    """Texto corto: por acción y lado, lo que se cruza (cuadros, peor) y la holgura de lo que no."""
    out = []
    for a, d in res.items():
        if a == "reposo":
            for s in ("l", "r"):
                cr = {g: v for g, v in d[s].items() if v[0]}
                out.append(f"reposo {s}: cruces={cr} entre={d['entre_munequeras']}")
            continue
        out.append(f"{a}: {d['limpios']}/{d['cuadros']} limpios, entre muñequeras {d['entre_munequeras']}")
        for s in ("l", "r"):
            for g, v in sorted(d["por_lado"][s].items(), key=lambda kv: kv[1]["holgura"][0]):
                if solo_cruces and not v["cuadros"]:
                    continue
                out.append(f"   {s} {g:24s} cruza {v['cuadros']:3d} cuadros (peor {v['peor']}), holgura {v['holgura']}")
    return "\n".join(out)


# ------------------------------------------------------------ apertura de brazos (como apartaManos)
def abrir_brazo(lado, grados):
    """Abre un brazo desde el hombro (arm_stretch lleva el giro, el antebrazo y la mano) en el plano del
    frente del torso, como apartaManos y hoodie.py. Se aplica sobre el cuadro ya puesto."""
    P = ARM.pose.bones
    rs = ARM.data.bones["spine_03.x"].matrix_local.to_3x3()
    frente = (P["spine_03.x"].matrix.to_3x3() @ rs.inverted()) @ Vector((0, -1, 0))
    s = 1 if lado == "l" else -1
    pb = P["arm_stretch." + lado]
    p = pb.head.copy()
    Rm = Matrix.Rotation(math.radians(grados) * s, 4, frente)
    pb.matrix = Matrix.Translation(p) @ Rm @ Matrix.Translation(-p) @ pb.matrix
    bpy.context.view_layer.update()


def apertura_necesaria(acciones=ACCIONES, que=None, tope=30, paso=1, cuadros=None, ignorar=("antebrazo_propio",), nombre="Munequeras"):
    """Por acción, cuadro y lado: los grados mínimos de apertura para que la muñequera no cruce nada de
    `que` (None = cuerpo y todas las prendas visibles). Regresa además el máximo por lado."""
    sc = bpy.context.scene; antes = sc.frame_current
    R = preparar(nombre)
    res = {}
    try:
        for a in acciones:
            act = bpy.data.actions[a]
            f0, f1 = [int(round(x)) for x in act.frame_range]
            por = {}; peor = {"l": (0, None), "r": (0, None)}
            for f in (cuadros or range(f0, f1 + 1)):
                falta = {}
                for s in ("l", "r"):
                    for g in range(0, tope + 1, paso):
                        poner_accion(a, f)
                        if g:
                            abrir_brazo(s, g)
                        r = medir_cuadro(R, que=que)[s]
                        malos = {k: v[0] for k, v in r.items() if v[0] and k not in ignorar}
                        if not malos:
                            falta[s] = g
                            break
                    else:
                        falta[s] = None
                    if falta[s] is None or falta[s] > (peor[s][0] or 0):
                        peor[s] = (falta[s], f)
                por[f] = falta
            res[a] = dict(por_cuadro={f: v for f, v in por.items() if v["l"] or v["r"]}, peor=peor)
    finally:
        quitar_accion(); sc.frame_set(antes)
    return res
