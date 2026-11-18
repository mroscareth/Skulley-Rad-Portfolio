import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ARM = bpy.data.objects["root"]
CUERPO = ["Egg_Torax", "Egg_Arm1_L", "Egg_Arm1_R", "Egg_Arm2_L", "Egg_Arm2_R", "Egg_Pelvis", "Egg_Jaw", "Egg_Head"]


def malla_eval(o, dg, inv):
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    m = inv @ o.matrix_world
    vs = [m @ v.co for v in me.vertices]
    caras = [(tuple(p.vertices), p.material_index) for p in me.polygons]
    oe.to_mesh_clear()
    return vs, caras


def penetracion(nombre="Chamarra", margen_borde=2.0, cerca=3.0):
    """Lo que el cuerpo se mete en la piel de la chamarra (más allá de su cara de adentro), en cm."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    vs, caras = malla_eval(bpy.data.objects[nombre], dg, inv)
    adentro = [c for c, m in caras if m == 1]
    bvh = BVHTree.FromPolygons(vs, adentro)
    # orilla del forro: aristas que solo pertenecen a una cara de forro
    cuenta = {}
    for c in adentro:
        for i in range(len(c)):
            e = tuple(sorted((c[i], c[(i + 1) % len(c)])))
            cuenta[e] = cuenta.get(e, 0) + 1
    orilla = {i for e, n in cuenta.items() if n == 1 for i in e}
    kd = KDTree(len(orilla))
    for i in orilla:
        kd.insert(vs[i], i)
    kd.balance()
    peor = {}
    for n in CUERPO:
        o = bpy.data.objects.get(n)
        if not o:
            continue
        bv, _ = malla_eval(o, dg, inv)
        h = 0.0; cuantos = 0
        for p in bv:
            loc, nrm, _, d = bvh.find_nearest(p, cerca)
            if loc is None:
                continue
            if (p - loc).dot(nrm) < 0:
                if kd.find(loc)[2] < margen_borde:
                    continue
                cuantos += 1
                h = max(h, d)
        peor[n] = (round(h, 2), cuantos)
    return peor


BRAZO = ("arm_", "forearm_")


def zonas(nombre="Chamarra", umbral=0.85):
    """Caras de manga y de torso (por el hueso que manda en cada vértice); lo de en medio no cuenta."""
    o = bpy.data.objects[nombre]
    nombres = {g.index: g.name for g in o.vertex_groups}
    brazo = []
    for v in o.data.vertices:
        b = t = 0.0
        for g in v.groups:
            if nombres[g.group].startswith(BRAZO):
                b += g.weight
            else:
                t += g.weight
        s = (b + t) or 1
        brazo.append(b / s)
    manga, torso = [], []
    for p in o.data.polygons:
        if p.material_index == 3:
            continue
        m = sum(brazo[i] for i in p.vertices) / len(p.vertices)
        if m >= umbral:
            manga.append(p.index)
        elif m <= 1 - umbral:
            torso.append(p.index)
    return manga, torso


def autochoque(nombre="Chamarra", manga=None, torso=None):
    """Pares de triángulos de manga que cruzan el torso (la manga metida en el costado)."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    vs, caras = malla_eval(bpy.data.objects[nombre], dg, inv)
    a = BVHTree.FromPolygons(vs, [caras[i][0] for i in manga])
    b = BVHTree.FromPolygons(vs, [caras[i][0] for i in torso])
    pares = a.overlap(b)
    return len(pares)


def autochoque_total(nombre="Chamarra"):
    """Triángulos de la tela que se cruzan entre sí (sin contar los que comparten vértice). Regresa (pares, zonas)."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    vs, caras = malla_eval(bpy.data.objects[nombre], dg, inv)
    tela = [c for c, m in caras if m != 3]
    t = BVHTree.FromPolygons(vs, tela)
    pares = [(i, j) for i, j in t.overlap(t) if i < j and not (set(tela[i]) & set(tela[j]))]
    zonas = {}
    for i, j in pares:
        c = sum((vs[k] for k in tela[i]), Vector()) / len(tela[i])
        k = ("L" if c.x > 0 else "R") + ("f" if c.y < 0 else "a") + str(int(c.z // 10) * 10)
        zonas[k] = zonas.get(k, 0) + 1
    return len(pares), zonas


def angulo_brazos():
    """Cuánto baja el brazo (grados bajo la horizontal) en la pose actual."""
    P = ARM.pose.bones
    out = {}
    for lado in ("l", "r"):
        h = P["arm_stretch." + lado].head; t = P["forearm_stretch." + lado].head
        d = (t - h).normalized()
        import math
        out[lado] = round(math.degrees(math.asin(max(-1, min(1, -d.z)))), 1)
    return out


def en_la_piel(nombre="Chamarra", margen_borde=1.5, cerca=2.0):
    """Puntos del cuerpo metidos entre la cara de adentro y la de afuera de la chamarra (cm y cuántos)."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    vs, caras = malla_eval(bpy.data.objects[nombre], dg, inv)
    dentro = BVHTree.FromPolygons(vs, [c for c, m in caras if m == 1])
    fuera = BVHTree.FromPolygons(vs, [c for c, m in caras if m in (0, 2)])
    cuenta = {}
    for c, m in caras:
        if m != 1:
            continue
        for i in range(len(c)):
            e = tuple(sorted((c[i], c[(i + 1) % len(c)])))
            cuenta[e] = cuenta.get(e, 0) + 1
    orilla = {i for e, n in cuenta.items() if n == 1 for i in e}
    kd = KDTree(len(orilla))
    for i in orilla:
        kd.insert(vs[i], i)
    kd.balance()
    out = {}
    for n in CUERPO:
        o = bpy.data.objects.get(n)
        if not o:
            continue
        bv, _ = malla_eval(o, dg, inv)
        h = 0.0; k = 0
        for p in bv:
            li, ni, _, di = dentro.find_nearest(p, cerca)
            if li is None or (p - li).dot(ni) >= 0:
                continue
            lo, no, _, do = fuera.find_nearest(p, cerca)
            if lo is None or (p - lo).dot(no) > 0:
                continue
            if kd.find(li)[2] < margen_borde:
                continue
            k += 1; h = max(h, di)
        if k:
            out[n] = (round(h, 2), k)
    return out


def quijada(angulos=(0, 20, 35)):
    """Distancia mínima de la quijada a la chamarra con la quijada abierta (cm)."""
    import math
    P = ARM.pose.bones
    out = {}
    for ang in angulos:
        P["ctl_quijada"].rotation_euler = (math.radians(ang), 0, 0)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get(); inv = ARM.matrix_world.inverted()
        vs, caras = malla_eval(bpy.data.objects["Chamarra"], dg, inv)
        t = BVHTree.FromPolygons(vs, [c for c, m in caras])
        jv, _ = malla_eval(bpy.data.objects["Egg_Jaw"], dg, inv)
        out[ang] = round(min(t.find_nearest(p)[3] for p in jv), 2)
    P["ctl_quijada"].rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    return out


def reposo():
    for pb in ARM.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    aj = ARM.pose.bones["ctl_ajustes"]
    for k in ("rig", "ik_pierna_l", "ik_pierna_r", "ik_brazo_l", "ik_brazo_r"):
        if k in aj:
            aj[k] = 1
    bpy.context.view_layer.update()


def medir(acciones=("root|root|Iddle", "root|root|Walking", "Correr"), por=8, piel=True):
    ad = ARM.animation_data; sc = bpy.context.scene
    manga, torso = zonas()
    res = {}
    try:
        for a in acciones:
            act = bpy.data.actions[a]; ad.action = act
            if len(act.slots):
                ad.action_slot = act.slots[0]
            f0, f1 = [int(round(x)) for x in act.frame_range]
            peor_pares = (0, None); peor_piel = {}
            for f in range(f0, f1 + 1, max(1, (f1 - f0) // por)):
                sc.frame_set(f)
                n, z = autochoque_total()
                if n > peor_pares[0]:
                    peor_pares = (n, f, dict(sorted(z.items(), key=lambda kv: -kv[1])[:4]))
                if piel:
                    for k, (h, c) in en_la_piel().items():
                        if h > peor_piel.get(k, (0,))[0]:
                            peor_piel[k] = (h, c, f)
            res[a] = dict(pares=peor_pares, piel=peor_piel)
    finally:
        ad.action = None
        reposo()
    return res


def con_accion(nombre_accion, cuadros):
    ad = ARM.animation_data
    antes = (ad.action, bpy.context.scene.frame_current)
    sc = bpy.context.scene
    res = {}
    try:
        if nombre_accion:
            ad.action = bpy.data.actions[nombre_accion]
            if len(ad.action.slots):
                ad.action_slot = ad.action.slots[0]
        for f in cuadros:
            sc.frame_set(f)
            p = penetracion()
            res[f] = {k: v for k, v in p.items() if v[1]}
    finally:
        ad.action = antes[0]
        sc.frame_set(antes[1])
    return res
