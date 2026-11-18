"""
Mide el beanie de Skulley (prop "Beanie") en Character/SkulleyRad.blend.

En Blender (o en segundo plano con blender -b):
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns)
    ns["reposo"]()     # holguras y cruces en reposo; la orilla de la copa adentro del dobladillo
    ns["medir"]()      # cada cuadro de idle, caminar y correr: cruces con cada pieza del cuerpo y los lentes
Todo en las coordenadas del armature (cm). El pelo no cuenta: va oculto mientras trae el beanie (Oscar,
2026-11-18). Un cruce es un par de triángulos (beanie, cuerpo) que se atraviesan.
"""
import bpy, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ARM = bpy.data.objects["root"]
NOMBRE = "Beanie"
ACCIONES = ("root|root|Iddle", "root|root|Walking", "Correr")
TEJIDO, DOBLADILLO, ETIQUETA = range(3)


def piezas_cuerpo():
    return sorted(o.name for o in bpy.data.objects
                  if o.type == 'MESH' and o.name.startswith("Egg_") and o.parent is ARM and o.name != "Egg_EnergyBall")


def malla_eval(o, dg, inv, sin_pelo=True):
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    m = inv @ o.matrix_world
    vs = [m @ v.co for v in me.vertices]
    pelo = {i for i, s in enumerate(o.material_slots) if s.material and s.material.name == "Hair"} if sin_pelo else set()
    caras = [(tuple(p.vertices), p.material_index) for p in me.polygons if p.material_index not in pelo]
    oe.to_mesh_clear()
    return vs, caras


def reposo_pose():
    for pb in ARM.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    aj = ARM.pose.bones.get("ctl_ajustes")
    if aj:
        for k in ("rig", "ik_pierna_l", "ik_pierna_r", "ik_brazo_l", "ik_brazo_r"):
            if k in aj:
                aj[k] = 1
    bpy.context.view_layer.update()


def poner_accion(nombre, cuadro):
    ad = ARM.animation_data or ARM.animation_data_create()
    act = bpy.data.actions[nombre]; ad.action = act
    if len(act.slots):
        ad.action_slot = act.slots[0]
    bpy.context.scene.frame_set(cuadro)


def quitar_accion():
    if ARM.animation_data:
        ARM.animation_data.action = None
    reposo_pose()


def cuadro(cuerpo=None, lentes=True):
    """Cruces y holguras del beanie contra el cuerpo (y los lentes) en la pose actual."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    bv, bc = malla_eval(bpy.data.objects[NOMBRE], dg, inv, sin_pelo=False)
    beanie = BVHTree.FromPolygons(bv, [c for c, _ in bc])
    res = {}
    nombres = list(cuerpo or piezas_cuerpo()) + (["Lentes"] if lentes and "Lentes" in bpy.data.objects else [])
    for n in nombres:
        o = bpy.data.objects[n]
        vs, caras = malla_eval(o, dg, inv)
        if not caras:
            continue
        t = BVHTree.FromPolygons(vs, [c for c, _ in caras])
        pares = beanie.overlap(t)
        usados = {i for c, _ in caras for i in c}
        # lo más cerca que queda un vértice de la pieza de la superficie del beanie
        cerca = min((beanie.find_nearest(vs[i], 40.0)[3] or 99.0) for i in usados) if usados else 99.0
        res[n] = (len(pares), round(cerca, 2))
    return res


def dentro_cerrada(t, p, rayos=((0, 0, 1), (0, 0, -1), (1, 0.3, 0.1), (-1, 0.2, -0.3), (0.2, 1, 0.4), (-0.3, -1, 0.2))):
    """Si p queda adentro de la malla cerrada t (por paridad, mayoría de 6 rayos)."""
    votos = 0
    for d in rayos:
        d = Vector(d).normalized()
        n = 0; o = p.copy()
        for _ in range(20):
            hit = t.ray_cast(o, d, 200.0)
            if hit[0] is None:
                break
            n += 1
            o = hit[0] + d * 1e-4
        votos += n % 2
    return votos * 2 > len(rayos)


def reposo():
    """En reposo: cruces y holguras con el cuerpo y los lentes; que la orilla de abajo de la copa (abierta)
    quede adentro del dobladillo; que la etiqueta no toque el dobladillo; lo que se sale del plano del
    borde por abajo."""
    quitar_accion()
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    out = {"cruces": cuadro()}
    bv, bc = malla_eval(bpy.data.objects[NOMBRE], dg, inv, sin_pelo=False)
    dob = BVHTree.FromPolygons(bv, [c for c, m in bc if m == DOBLADILLO])
    # orilla de la copa: aristas de una sola cara de tejido
    cuenta = {}
    for c, m in bc:
        if m != TEJIDO:
            continue
        for i in range(len(c)):
            e = tuple(sorted((c[i], c[(i + 1) % len(c)])))
            cuenta[e] = cuenta.get(e, 0) + 1
    orilla = sorted({i for e, n in cuenta.items() if n == 1 for i in e})
    fuera = [i for i in orilla if not dentro_cerrada(dob, bv[i])]
    out["orilla_copa"] = dict(vertices=len(orilla), fuera_del_dobladillo=len(fuera))
    et = BVHTree.FromPolygons(bv, [c for c, m in bc if m == ETIQUETA])
    out["etiqueta_cruza_dobladillo"] = len(et.overlap(dob))
    copa = BVHTree.FromPolygons(bv, [c for c, m in bc if m == TEJIDO])
    out["copa_cruza_dobladillo"] = len(copa.overlap(dob))
    zs = [v.z for v in bv]
    out["alto"] = (round(min(zs), 2), round(max(zs), 2))
    out["y"] = (round(min(v.y for v in bv), 2), round(max(v.y for v in bv), 2))
    out["x"] = round(max(abs(v.x) for v in bv), 2)
    return out


def medir(acciones=ACCIONES, paso=1):
    """Cada cuadro de cada acción: por pieza, el peor número de cruces (y en qué cuadro) y la menor holgura."""
    sc = bpy.context.scene
    antes = sc.frame_current
    res = {}
    try:
        for a in acciones:
            act = bpy.data.actions[a]
            f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
            peor = {}
            limpios = 0; total = 0
            for f in range(f0, f1 + 1, paso):
                poner_accion(a, f)
                c = cuadro()
                total += 1
                if all(v[0] == 0 for v in c.values()):
                    limpios += 1
                for n, (k, d) in c.items():
                    p = peor.get(n, (0, None, 99.0))
                    peor[n] = (max(p[0], k), f if k > p[0] else p[1], min(p[2], d))
            res[a] = dict(limpios=f"{limpios}/{total}", piezas={n: v for n, v in peor.items() if v[0] or v[2] < 5})
    finally:
        quitar_accion()
        sc.frame_set(antes)
    return res
