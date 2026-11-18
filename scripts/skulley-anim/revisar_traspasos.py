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


# --- Lo que se ve en el render (2026-11-18, axilas de la chamarra) -----------------
# Pliegues de la piel, forro asomado y tela al revés, por zona y en las tres acciones.
# Con los pesos de pesar() salían astillas en el render de Blender; con giro_manga,
# pesos_finos y pesos_forro de chamarra.py casi no queda nada (números en CLAUDE.md).
import math

AXILA = Vector((23.0, 1.5, 104.0))
CODO = Vector((43.1, 2.5, 98.7))
ACCIONES = (("root|root|Iddle", 6), ("root|root|Walking", 2), ("Correr", 2))


def zona(c):
    a = Vector((abs(c.x), c.y, c.z))
    if (a - AXILA).length < 16:
        return "axila"
    if (a - CODO).length < 11:
        return "codo"
    if abs(c.x) > 30:
        return "manga"
    return "hombro_cuello" if c.z > 116 else "torso"


def en_acciones(fn, acciones=ACCIONES):
    """fn() en cada cuadro (cada `paso`, o una lista de cuadros) de cada acción; deja la acción, el slot y el cuadro como estaban."""
    ad = ARM.animation_data; sc = bpy.context.scene
    antes = (ad.action, ad.action_slot, sc.frame_current)
    res = {}
    try:
        for a, cuadros in acciones:
            act = bpy.data.actions[a]; ad.action = act
            if len(act.slots):
                ad.action_slot = act.slots[0]
            if isinstance(cuadros, int):
                f0, f1 = [int(round(x)) for x in act.frame_range]
                cuadros = range(f0, f1 + 1, cuadros)
            for f in cuadros:
                sc.frame_set(f)
                res.setdefault(a, []).append((f, fn()))
    finally:
        ad.action = antes[0]
        if antes[1] is not None:
            ad.action_slot = antes[1]
        sc.frame_set(antes[2])
    return res


def _normal(pts):
    n = Vector()
    for k in range(len(pts)):
        n += pts[k].cross(pts[(k + 1) % len(pts)])
    return n.normalized()


_ARISTAS = {}


def pliegues(nombre="Chamarra", umbral=60.0):
    """Por zona: aristas de la piel de afuera que se doblan `umbral` grados más que en reposo (cuántas, suma de grados de más)."""
    o = bpy.data.objects[nombre]
    if nombre not in _ARISTAS:
        bm = bmesh.new(); bm.from_mesh(o.data)
        ar = []
        for e in bm.edges:
            if len(e.link_faces) == 2 and all(f.material_index in (0, 2) for f in e.link_faces):
                f1, f2 = e.link_faces
                ar.append(([v.index for v in f1.verts], [v.index for v in f2.verts], f1.normal.angle(f2.normal, 0.0),
                           (e.verts[0].co + e.verts[1].co) / 2))
        bm.free(); _ARISTAS[nombre] = ar
    dg = bpy.context.evaluated_depsgraph_get()
    vs, _ = malla_eval(o, dg, ARM.matrix_world.inverted())
    out = {}
    u = math.radians(umbral)
    for a, b, ang0, c in _ARISTAS[nombre]:
        d = _normal([vs[k] for k in a]).angle(_normal([vs[k] for k in b]), 0.0) - ang0
        if d > u:
            n, s = out.get(zona(c), (0, 0.0)); out[zona(c)] = (n + 1, s + math.degrees(d - u))
    return {z: (n, round(s)) for z, (n, s) in out.items()}


_FORRO = {}


def _forro_visible(vs, nr, caras, pareja):
    bvh = BVHTree.FromPolygons(vs, caras)
    out = []
    for i, j in pareja.items():
        d = nr[j]
        if d.length < 0.5:
            continue
        hit = bvh.ray_cast(vs[i] + d * 0.02, d, 80)
        if hit[0] is None or hit[1].dot(d) < 0:
            out.append(i)
    return out


def forro_asomado(nombre="Chamarra"):
    """Por zona: vértices del forro que quedan afuera de su piel (el rayo hacia afuera no la cruza), sin los que ya se ven en reposo."""
    o = bpy.data.objects[nombre]; me = o.data
    if nombre not in _FORRO:
        caras = [tuple(p.vertices) for p in me.polygons if p.material_index != 3]
        fv = {i for p in me.polygons if p.material_index in (0, 2) for i in p.vertices}
        dv = {i for p in me.polygons if p.material_index == 1 for i in p.vertices}
        afuera = sorted(fv - dv)
        kd = KDTree(len(afuera))
        for i in afuera:
            kd.insert(me.vertices[i].co, i)
        kd.balance()
        pareja = {}
        for i in dv - fv:
            p = me.vertices[i].co
            for q, j, d in kd.find_n(p, 8):
                if d > 1e-6 and (q - p).dot(me.vertices[j].normal) > 0.7 * d:
                    pareja[i] = j
                    break
        rest = [v.co.copy() for v in me.vertices]
        ya = set(_forro_visible(rest, [v.normal.copy() for v in me.vertices], caras, pareja))
        _FORRO[nombre] = (caras, pareja, ya, rest)
    caras, pareja, ya, rest = _FORRO[nombre]
    dg = bpy.context.evaluated_depsgraph_get(); inv = ARM.matrix_world.inverted()
    oe = o.evaluated_get(dg); em = oe.to_mesh(); m = inv @ o.matrix_world; m3 = m.to_3x3()
    vs = [m @ v.co for v in em.vertices]; nr = [(m3 @ v.normal).normalized() for v in em.vertices]
    oe.to_mesh_clear()
    out = {}
    for i in _forro_visible(vs, nr, caras, pareja):
        if i not in ya:
            out[zona(rest[i])] = out.get(zona(rest[i]), 0) + 1
    return out


def _vistas(elevaciones=(-25, 10)):
    out = []
    for e in elevaciones:
        for a in range(0, 360, 45):
            ra, re = math.radians(a), math.radians(e)
            out.append(Vector((math.cos(re) * math.sin(ra), -math.cos(re) * math.cos(ra), math.sin(re))))
    return out


def tela_al_reves(nombre="Chamarra", paso=0.7, medio=18.0, radio=14.0):
    """Rayos desde 16 vistas a cada axila, con el cuerpo tapando: cuántos pegan primero en el forro o en el revés de la piel.
    Ojo: el forro también se ve de verdad por la bastilla y los puños; sirve para comparar dos versiones."""
    o = bpy.data.objects[nombre]
    dg = bpy.context.evaluated_depsgraph_get(); inv = ARM.matrix_world.inverted()
    vs, cs = malla_eval(o, dg, inv)
    rest = [v.co for v in o.data.vertices]
    tri = [c for c, m in cs]; info = [(m, k) for k, (c, m) in enumerate(cs)]; todos = list(vs)
    for n in CUERPO:
        b = bpy.data.objects.get(n)
        if b:
            bv, bc = malla_eval(b, dg, inv); off = len(todos); todos += bv
            for c, m in bc:
                tri.append(tuple(off + i for i in c)); info.append((-1, -1))
    bvh = BVHTree.FromPolygons(todos, tri)
    out = {}
    for s in (1, -1):
        A = Vector((AXILA.x * s, AXILA.y, AXILA.z))
        idx = [i for i, p in enumerate(rest) if (p - A).length < 6]
        C = sum((vs[i] for i in idx), Vector()) / len(idx)
        for d in _vistas():
            u = d.cross(Vector((0, 0, 1))).normalized(); w = u.cross(d).normalized(); n = int(medio / paso)
            for i in range(-n, n + 1):
                for j in range(-n, n + 1):
                    hit = bvh.ray_cast(C + u * (i * paso) + w * (j * paso) - d * 60, d, 200)
                    if hit[0] is None or info[hit[2]][0] in (-1, 3):
                        continue
                    mat, k = info[hit[2]]
                    if (sum((rest[q] for q in cs[k][0]), Vector()) / len(cs[k][0]) - A).length > radio:
                        continue
                    if mat == 1 or hit[1].dot(d) > 0:
                        key = ("L" if s > 0 else "R") + ("_forro" if mat == 1 else "_reves")
                        out[key] = out.get(key, 0) + 1
    return out


def render_comparar(tomas, salida, versiones=(("antes", "Chamarra"),), lado=440, muestras=32, lente=50):
    """Render en Cycles fuera de pantalla (no depende de que la ventana se dibuje): una fila por toma, una columna por objeto.
    tomas: (acción, cuadro, centro en reposo en cm, azimut, elevación, distancia en m). Deja la escena como estaba."""
    import numpy as np, os
    from mathutils import Matrix
    sc = bpy.context.scene; r = sc.render; ad = ARM.animation_data
    antes = (r.resolution_x, r.resolution_y, r.resolution_percentage, sc.camera, r.filepath, sc.cycles.samples,
             ad.action, ad.action_slot, sc.frame_current, r.image_settings.file_format)
    ocultos = {n: bpy.data.objects[n].hide_render for _, n in versiones}
    cd = bpy.data.cameras.new("_cam_revision"); cd.lens = lente; cd.clip_start = 0.01
    cam = bpy.data.objects.new("_cam_revision", cd); sc.collection.objects.link(cam)
    filas = []
    try:
        r.resolution_x = r.resolution_y = lado; r.resolution_percentage = 100
        sc.cycles.samples = muestras; sc.camera = cam; r.image_settings.file_format = 'PNG'
        for acc, fr, centro, az, el, dist in tomas:
            act = bpy.data.actions[acc]; ad.action = act
            if len(act.slots):
                ad.action_slot = act.slots[0]
            sc.frame_set(fr)
            o = bpy.data.objects[versiones[0][1]]
            dg = bpy.context.evaluated_depsgraph_get(); oe = o.evaluated_get(dg); em = oe.to_mesh()
            c0 = Vector(centro); radio = 6.0; idx = []
            while not idx:
                idx = [i for i, v in enumerate(o.data.vertices) if (v.co - c0).length < radio]
                radio *= 1.5
            c = o.matrix_world @ (sum((em.vertices[i].co for i in idx), Vector()) / len(idx))
            oe.to_mesh_clear()
            a, e = math.radians(az), math.radians(el)
            dv = Vector((math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e)))
            x = Vector((0, 0, 1)).cross(dv).normalized(); y = dv.cross(x)
            cam.matrix_world = Matrix.Translation(c + dv * dist) @ Matrix((x, y, dv)).transposed().to_4x4()
            fila = []
            for _, n in versiones:
                for _, m2 in versiones:
                    bpy.data.objects[m2].hide_render = (m2 != n)
                ruta = os.path.join(os.path.dirname(salida), "_render_tmp.png"); r.filepath = ruta
                bpy.ops.render.render(write_still=True)
                im = bpy.data.images.load(ruta, check_existing=False); w, h = im.size
                fila.append(np.array(im.pixels[:]).reshape(h, w, 4)); bpy.data.images.remove(im)
            filas.append(np.concatenate(fila, axis=1))
    finally:
        r.resolution_x, r.resolution_y, r.resolution_percentage, sc.camera, r.filepath, sc.cycles.samples = antes[:6]
        ad.action = antes[6]
        if antes[7] is not None:
            ad.action_slot = antes[7]
        sc.frame_set(antes[8]); r.image_settings.file_format = antes[9]
        for n, h in ocultos.items():
            bpy.data.objects[n].hide_render = h
        bpy.data.objects.remove(cam, do_unlink=True); bpy.data.cameras.remove(cd)
    m = np.concatenate(filas[::-1], axis=0); H, W = m.shape[:2]
    img = bpy.data.images.new("_revision", W, H); img.pixels = m.ravel()
    img.filepath_raw = salida; img.file_format = 'PNG'; img.save(); bpy.data.images.remove(img)
    return salida
