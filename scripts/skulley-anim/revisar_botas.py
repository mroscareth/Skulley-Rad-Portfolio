"""
Mide las botas de Skulley (prop "Botas") en Character/SkulleyRad.blend, cuadro por cuadro.

En Blender:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns)
    ns["medir"]()       # traspasos y piso en reposo, idle, walk y Correr
Todo en las coordenadas del armature (cm). El piso es z = 0. (Adaptado de revisar_tenis.py.)

Qué cuenta como traspaso (lo que se vería):
- un vértice del pie que queda fuera de la caña y de la suela;
- un vértice de la espinilla que, debajo de la boca, queda fuera de la caña;
- un vértice de la espinilla, arriba de la boca, metido en la lengüeta o en el rollo;
- un vértice del muslo, de la otra pierna o del otro pie metido en esta bota (en cualquier pieza);
- la orilla de abajo de la caña asomada por la banda de la suela;
- una bota que cruza a la otra.
Además da la holgura mínima (lo que queda del cuerpo a la cara de adentro de la caña).
"""
import bpy, bmesh, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ARM = bpy.data.objects["root"]
ACCIONES = ("root|root|Iddle", "root|root|Walking", "Correr")
GROSOR = 0.4
LADOS = {"L": ("Egg_Foot_L", "Egg_Leg1_L", "Egg_Leg2_L", 1), "R": ("Egg_Foot_R", "Egg_Leg1_R", "Egg_Leg2_R", -1)}


def malla_eval(o, dg, inv):
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    m = inv @ o.matrix_world
    vs = [m @ v.co for v in me.vertices]
    oe.to_mesh_clear()
    return vs


def reposo():
    for pb in ARM.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
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


def partes(nombre="Botas"):
    """Por lado: caras de la caña, de la banda y de cada pieza cerrada; vértices de la boca y de la orilla
    de abajo de la caña (de la malla en reposo)."""
    o = bpy.data.objects[nombre]
    me = o.data
    mats = [m.name if m else "" for m in me.materials]
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); bm.normal_update()
    isla = {}; islas = []
    for f in bm.faces:
        if f in isla:
            continue
        pila = [f]; miembros = []; isla[f] = len(islas)
        while pila:
            x = pila.pop(); miembros.append(x)
            for e in x.edges:
                for g in e.link_faces:
                    if g not in isla:
                        isla[g] = len(islas); pila.append(g)
        islas.append(miembros)
    out = {}
    for lado, s in (("L", 1), ("R", -1)):
        del_lado = [i for i in islas if i[0].calc_center_median().x * s > 0]
        def mat(i):
            return mats[i[0].material_index]
        cana = max([i for i in del_lado if mat(i) in ("Botas_Azul", "Botas_Cuello")
                    and any(v.is_boundary for f in i for v in f.verts)], key=len)
        suelas = sorted([i for i in del_lado if mat(i) == "Botas_Suela"], key=len, reverse=True)
        banda = suelas[0]
        # piezas cerradas (los puntitos perforados son discos sueltos, no volúmenes)
        cerradas = [i for i in del_lado if i is not cana and mat(i) not in ("Botas_Forro", "Botas_Perforado")]
        boca = sorted({v.index for f in cana for v in f.verts if v.is_boundary and v.co.z > 15.0})
        orilla_baja = sorted({v.index for f in cana for v in f.verts if v.is_boundary and v.co.z < 5.0})
        # lo de la caña que en reposo queda dentro de la banda (la banda no es pareja: más alta atrás)
        vs_r = [v.co.copy() for v in bm.verts]
        bv_banda = BVHTree.FromPolygons(vs_r, [tuple(v.index for v in f.verts) for f in banda])
        dentro_banda = sorted({v.index for f in cana for v in f.verts
                               if v.co.z < 8.0 and dentro_cerrada(bv_banda, v.co, 3.0) is not None})
        tri = lambda caras: [tuple(v.index for v in f.verts) for f in caras]
        # caras de abajo de la banda (en reposo miran hacia abajo): el pie no puede quedar afuera de ellas
        fondo = [f for f in banda if f.normal.z < -0.6]
        nombres_c = []
        for i in cerradas:
            m = mat(i)
            nombres_c.append((m, len(i)))
        out[lado] = dict(cana=tri(cana), banda=tri(banda), fondo=tri(fondo), contra=tri(suelas[1]) if len(suelas) > 1 else [],
                         cerradas=[tri(i) for i in cerradas], nombres=nombres_c,
                         boca=boca, orilla_baja=orilla_baja, dentro_banda=dentro_banda,
                         todo=sorted({v.index for i in del_lado for f in i for v in f.verts}))
    bm.free()
    return out


def rayos_de(n):
    a = n.cross(Vector((1, 0, 0)))
    if a.length < 0.1:
        a = n.cross(Vector((0, 1, 0)))
    a.normalize(); b = n.cross(a).normalized()
    return [(a * math.cos(t) + b * math.sin(t)) for t in [k * math.pi / 3 for k in range(6)]]


def dentro_por_rayos(bvhs, p, rayos, largo=40.0):
    """Adentro si todos los rayos de lado chocan con alguna superficie (la caña está abierta arriba y abajo)."""
    for d in rayos:
        if not any(b.ray_cast(p, d, largo)[0] is not None for b in bvhs):
            return False
    return True


RAYOS_PARIDAD = (Vector((0.0123, 1.0, 0.0071)).normalized(), Vector((0.71, -0.03, 0.70)).normalized())


def paridad(bvh, p, d, largo=300.0):
    n = 0; o = p.copy()
    while n < 50:
        h = bvh.ray_cast(o + d * 1e-4, d, largo)
        if h[0] is None:
            break
        n += 1; o = h[0]
    return n % 2 == 1


def dentro_cerrada(bvh, p, cerca=3.0):
    """En una pieza cerrada: adentro si la cara más cercana le da la espalda y además dos rayos cruzan un
    número impar de caras (la cara más cercana sola se equivoca junto a una arista). Da la profundidad."""
    loc, nrm, _, d = bvh.find_nearest(p, cerca)
    if loc is None or (p - loc).dot(nrm) >= 0:
        return None
    return d if all(paridad(bvh, p, r) for r in RAYOS_PARIDAD) else None


def boca_plano(vs, boca):
    c = sum((vs[i] for i in boca), Vector()) / len(boca)
    pts = sorted((vs[i] for i in boca), key=lambda p: math.atan2(p.y - c.y, p.x - c.x))
    n = Vector()
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n += (a - c).cross(b - c)
    n.normalize()
    if n.z < 0:
        n = -n
    return c, n


def medir_cuadro(nombre="Botas", P=None, dentro_reposo=None):
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    vs = malla_eval(bpy.data.objects[nombre], dg, inv)
    cuerpo = {n: malla_eval(bpy.data.objects[n], dg, inv) for l in LADOS.values() for n in l[:3]}
    res = {}
    for lado, d in P.items():
        pie, pierna, muslo, s = LADOS[lado]
        cana = BVHTree.FromPolygons(vs, d["cana"]); banda = BVHTree.FromPolygons(vs, d["banda"])
        contra = BVHTree.FromPolygons(vs, d["contra"]) if d["contra"] else None
        cerr = [BVHTree.FromPolygons(vs, c) for c in d["cerradas"]]
        c, n = boca_plano(vs, d["boca"])
        rayos = rayos_de(n)
        fuera = {}; holg = 99.0
        def anota(k, h):
            a, b = fuera.get(k, (0.0, 0))
            fuera[k] = (max(a, h), b + 1)
        sup = [cana, banda] + ([contra] if contra else [])
        for nom in (pie, pierna):
            pts = cuerpo[nom]
            idx = dentro_reposo.get(nom) if dentro_reposo else None
            for k in (range(len(pts)) if idx is None else idx):
                p = pts[k]
                if nom != pie and (p - c).dot(n) > -0.3:
                    continue      # arriba de la boca: lo mide la lengüeta y el rollo
                if dentro_cerrada(banda, p, 4.0) is not None:
                    continue
                dist = cana.find_nearest(p)[3]
                if not dentro_por_rayos(sup, p, rayos):
                    # lo que se sale: a la superficie de la bota más cercana (caña, banda o contrafuerte)
                    anota(nom, min(b.find_nearest(p)[3] for b in sup))
                else:
                    holg = min(holg, dist - GROSOR)
        # la espinilla arriba de la boca no se puede meter en la lengüeta ni en el rollo
        for p in cuerpo[pierna]:
            if (p - c).dot(n) <= -0.3:
                continue
            for b, (m, _) in zip(cerr, d["nombres"]):
                h = dentro_cerrada(b, p)
                if h is not None:
                    anota(pierna + "_en_" + m, h)
        # el muslo, la otra pierna y el otro pie: en ninguna pieza de esta bota
        otro = "R" if lado == "L" else "L"
        for nom in (muslo,) + tuple(LADOS[otro][:3]):
            for p in cuerpo[nom]:
                for b, (m, _) in zip(cerr, d["nombres"]):
                    h = dentro_cerrada(b, p)
                    if h is not None:
                        anota(nom + "_en_" + m + "_" + lado, h)
                if cana.find_nearest(p, 1.5)[0] is not None and (p - c).dot(n) < 0 and dentro_por_rayos(sup, p, rayos):
                    anota(nom + "_en_cana_" + lado, cana.find_nearest(p)[3])
        # el pie no se sale por el fondo de la suela (la prueba de rayos de lado no lo ve si la suela va inclinada)
        bv_fondo = BVHTree.FromPolygons(vs, d["fondo"])
        for p in cuerpo[pie]:
            loc, nrm, _, dist = bv_fondo.find_nearest(p, 1.5)
            if loc is not None and (p - loc).dot(nrm) > 0:
                anota("pie_sale_por_la_suela", dist)
        # la orilla de abajo de la caña no se asoma por la banda
        for k in d["dentro_banda"]:
            loc, nrm, _, dist = banda.find_nearest(vs[k])
            if (vs[k] - loc).dot(nrm) > 0:
                anota("cana_fuera_de_banda", dist)
        zs = [vs[i].z for i in d["todo"]]
        res[lado] = dict(fuera={k: (round(h, 3), k2) for k, (h, k2) in fuera.items()},
                         holgura=round(holg, 3), bota_z=round(min(zs), 3),
                         pie_z=round(min(p.z for p in cuerpo[pie]), 3))
    tris = lambda d: d["cana"] + d["banda"] + d["contra"] + [f for c in d["cerradas"] for f in c]
    a = BVHTree.FromPolygons(vs, tris(P["L"])); b = BVHTree.FromPolygons(vs, tris(P["R"]))
    res["cruces"] = len(a.overlap(b))
    return res


def piso(nombre="Botas", acciones=ACCIONES):
    """Solo el piso: por acción, lo más bajo de la bota y del pie y lo más que la bota baja de más que el pie
    desnudo (en el cuadro y lado donde pasa)."""
    sc = bpy.context.scene; antes = sc.frame_current
    o = bpy.data.objects[nombre]; inv = ARM.matrix_world.inverted()
    lado_de = [1 if v.co.x > 0 else -1 for v in o.data.vertices]
    res = {}
    try:
        for a in acciones:
            act = bpy.data.actions[a]
            f0, f1 = [int(round(x)) for x in act.frame_range]
            peor = (0.0, None, None); bmin = 99; pmin = 99
            for f in range(f0, f1 + 1):
                poner_accion(a, f)
                dg = bpy.context.evaluated_depsgraph_get()
                vs = malla_eval(o, dg, inv)
                for lado, s_ in (("L", 1), ("R", -1)):
                    bz = min(vs[i].z for i in range(len(vs)) if lado_de[i] == s_)
                    pz = min(p.z for p in malla_eval(bpy.data.objects["Egg_Foot_" + lado], dg, inv))
                    bmin = min(bmin, bz); pmin = min(pmin, pz)
                    extra = min(0.0, bz) - min(0.0, pz)
                    if extra < peor[0]:
                        peor = (round(extra, 2), f, lado)
            res[a] = dict(bota_min=round(bmin, 2), pie_min=round(pmin, 2), bajo_piso_de_mas=peor)
    finally:
        quitar_accion(); sc.frame_set(antes)
    return res


def medir(nombre="Botas", acciones=ACCIONES, paso=1, cuadros=None):
    """Cada cuadro de cada acción: por lado, lo peor que se sale o se mete cada cosa (cm, cuántos vértices,
    cuadro), la holgura mínima, lo más bajo de la bota y del pie, y si las botas se cruzan."""
    sc = bpy.context.scene
    antes = sc.frame_current
    P = partes(nombre)
    res = {}
    try:
        quitar_accion()
        dg = bpy.context.evaluated_depsgraph_get(); inv = ARM.matrix_world.inverted()
        vs0 = malla_eval(bpy.data.objects[nombre], dg, inv)
        dentro_reposo = {}
        for lado, d in P.items():
            c, n = boca_plano(vs0, d["boca"])
            pts = malla_eval(bpy.data.objects[LADOS[lado][1]], dg, inv)
            dentro_reposo[LADOS[lado][1]] = [k for k, p in enumerate(pts) if (p - c).dot(n) < -0.5]
        res["piezas"] = {l: P[l]["nombres"] for l in P}
        res["reposo"] = medir_cuadro(nombre, P, dentro_reposo=dentro_reposo)
        for a in acciones:
            act = bpy.data.actions[a]
            f0, f1 = [int(round(x)) for x in act.frame_range]
            lista = cuadros or range(f0, f1 + 1, paso)
            peor = {"L": {}, "R": {}}; holg = {"L": (99, 0), "R": (99, 0)}
            bota = []; pie = []; dif = []; cruces = (0, None); de_mas = (0.0, None, None)
            limpios = 0
            for f in lista:
                poner_accion(a, f)
                r = medir_cuadro(nombre, P, dentro_reposo=dentro_reposo)
                if not r["L"]["fuera"] and not r["R"]["fuera"] and not r["cruces"]:
                    limpios += 1
                for lado in ("L", "R"):
                    for k, (h, c) in r[lado]["fuera"].items():
                        if h > peor[lado].get(k, (0,))[0]:
                            peor[lado][k] = (h, c, f)
                    if r[lado]["holgura"] < holg[lado][0]:
                        holg[lado] = (r[lado]["holgura"], f)
                    bota.append(r[lado]["bota_z"]); pie.append(r[lado]["pie_z"])
                    dif.append(r[lado]["bota_z"] - r[lado]["pie_z"])
                    extra = min(0.0, r[lado]["bota_z"]) - min(0.0, r[lado]["pie_z"])
                    if extra < de_mas[0]:
                        de_mas = (round(extra, 2), f, lado)
                if r["cruces"] > cruces[0]:
                    cruces = (r["cruces"], f)
            res[a] = dict(cuadros=len(lista), limpios=limpios, fuera=peor, holgura=holg,
                          bota_min=round(min(bota), 2), pie_min=round(min(pie), 2),
                          bota_menos_pie=(round(min(dif), 2), round(max(dif), 2)), cruces=cruces,
                          bajo_piso_de_mas=de_mas)
    finally:
        quitar_accion()
        sc.frame_set(antes)
    return res
