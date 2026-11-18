"""
Mide los tenis de Skulley (prop "Tenis") y saca fotos, en Character/SkulleyRad.blend.

En Blender:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns)
    ns["medir"]()              # traspasos y piso, cuadro por cuadro, en idle, walk y Correr
    ns["foto"](ruta, ...)      # render con una cámara temporal; deja la escena como estaba
Todo en las coordenadas del armature (cm). El piso es z = 0.

Qué cuenta como traspaso (lo que se vería; con PIE_OCULTO el pie no cuenta, va oculto con los tenis):
- un vértice del pie que queda fuera de la lona y fuera de la suela, o arriba del borde de la boca;
- un vértice de la espinilla que, debajo de la boca, queda fuera de la lona;
- un vértice de la otra pierna o del otro pie metido en este tenis;
- un tenis que cruza al otro.
Además da la holgura mínima (lo que queda del cuerpo a la cara de adentro de la lona).
"""
import bpy, bmesh, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ARM = bpy.data.objects["root"]
ACCIONES = ("root|root|Iddle", "root|root|Walking", "Correr")
GROSOR = 0.3
PIE_OCULTO = True   # con los tenis puestos el pie de Skulley se oculta: no cuenta como traspaso
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


def partes(nombre="Tenis"):
    """Caras de la lona y de la suela de cada tenis, y los vértices de la boca (de la malla en reposo)."""
    o = bpy.data.objects[nombre]
    me = o.data
    mats = [m.name if m else "" for m in me.materials]
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
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
        def mayor(mat):
            c = [i for i in del_lado if mats[i[0].material_index] == mat]
            return max(c, key=len)
        lona = mayor("Tenis_Lona"); suela = mayor("Tenis_Suela")
        boca = sorted({v.index for f in lona for v in f.verts if v.is_boundary and v.co.z > 15.0})
        orilla_baja = sorted({v.index for f in lona for v in f.verts if v.is_boundary and v.co.z < 5.0})
        tope_suela = max(v.co.z for f in suela for v in f.verts)
        banda = sorted({v.index for f in lona for v in f.verts if v.co.z < tope_suela - 0.4})
        out[lado] = dict(lona=[tuple(v.index for v in f.verts) for f in lona],
                         suela=[tuple(v.index for v in f.verts) for f in suela], boca=boca, orilla_baja=orilla_baja, banda=banda,
                         suela_v=sorted({v.index for f in suela for v in f.verts}),
                         todo=sorted({v.index for i in del_lado for f in i for v in f.verts}))
    bm.free()
    return out


def lado_adentro(bvh, p, cerca):
    """(está adentro, distancia a la superficie) contra la cara más cercana; None si está lejos."""
    loc, nrm, _, d = bvh.find_nearest(p, cerca)
    if loc is None:
        return None
    return (p - loc).dot(nrm) < 0, d


def rayos_de(n):
    """Seis direcciones perpendiculares al eje del tenis (la normal de la boca)."""
    a = n.cross(Vector((1, 0, 0)))
    if a.length < 0.1:
        a = n.cross(Vector((0, 1, 0)))
    a.normalize(); b = n.cross(a).normalized()
    return [(a * math.cos(t) + b * math.sin(t)) for t in [k * math.pi / 3 for k in range(6)]]


def dentro_por_rayos(bvhs, p, rayos, largo=40.0):
    """Adentro si todos los rayos de lado (perpendiculares al eje del tenis: la lona está abierta arriba
    y abajo) chocan con alguna de las superficies. No depende de hacia dónde miren las caras: si el
    empeine se arruga y se voltean caras, sigue bien."""
    for d in rayos:
        if not any(b.ray_cast(p, d, largo)[0] is not None for b in bvhs):
            return False
    return True


def boca_plano(vs, boca, suela=None):
    """Centro, normal y radio de la boca. La normal es la dirección de menos varianza del borde (PCA):
    ordenando por ángulo visto desde arriba, con la boca inclinada y el pie girado salía chueca.
    Apunta lejos de la suela."""
    import numpy as np
    c = sum((vs[i] for i in boca), Vector()) / len(boca)
    A = np.array([tuple(vs[i] - c) for i in boca])
    w, V = np.linalg.eigh(A.T @ A)
    n = Vector(V[:, 0]).normalized()
    if suela:
        cs = sum((vs[i] for i in suela), Vector()) / len(suela)
        if n.dot(c - cs) < 0:
            n = -n
    elif n.z < 0:
        n = -n
    r = max((vs[i] - c).length for i in boca)
    return c, n, r


DIRECCIONES = [Vector(d).normalized() for d in (
    (1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1),
    (1, 1, 1), (1, 1, -1), (1, -1, 1), (1, -1, -1), (-1, 1, 1), (-1, 1, -1), (-1, -1, 1), (-1, -1, -1))]


def tapa_boca(vs, boca, suela=None):
    """Tapa imaginaria de la boca: abanico desde su centro por el borde real (ya deformado)."""
    c = sum((vs[i] for i in boca), Vector()) / len(boca)
    _, n, _ = boca_plano(vs, boca, suela)
    a = n.cross(Vector((1, 0, 0)))
    if a.length < 0.1:
        a = n.cross(Vector((0, 1, 0)))
    a.normalize(); b = n.cross(a)
    orden = sorted(boca, key=lambda i: math.atan2((vs[i] - c).dot(b), (vs[i] - c).dot(a)))
    pts = [c] + [vs[i] for i in orden]
    m = len(orden)
    return BVHTree.FromPolygons(pts, [(0, 1 + k, 1 + (k + 1) % m) for k in range(m)])


def dentro_cerrado(bvhs, p, largo=60.0):
    """Adentro si en todas las direcciones (arriba incluido) choca con la lona, la suela o la tapa de la
    boca. Así un punto bajo el borde de la boca cuenta como adentro aunque el borde ya no sea un plano, y
    uno que se sale por la pared o por arriba del borde cuenta como afuera."""
    for d in DIRECCIONES:
        if not any(b.ray_cast(p, d, largo)[0] is not None for b in bvhs):
            return False
    return True


def medir_cuadro(nombre="Tenis", P=None, cerca=12.0, dentro_reposo=None):
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    vs = malla_eval(bpy.data.objects[nombre], dg, inv)
    cuerpo = {n: malla_eval(bpy.data.objects[n], dg, inv) for l in LADOS.values() for n in l[:3]}
    res = {}
    bvhs = {}
    for lado, d in P.items():
        bvhs[lado] = (BVHTree.FromPolygons(vs, d["lona"]), BVHTree.FromPolygons(vs, d["suela"]))
    for lado, d in P.items():
        pie, pierna, muslo, s = LADOS[lado]
        lona, suela = bvhs[lado]
        c, n, r = boca_plano(vs, d["boca"], d["suela_v"])
        rayos = rayos_de(n)
        tapa = tapa_boca(vs, d["boca"], d["suela_v"])
        fuera = {}; holg = 99.0
        def anota(k, h):
            a, b = fuera.get(k, (0.0, 0))
            fuera[k] = (max(a, h), b + 1)
        # su pie (todo) y su espinilla (lo que en reposo va dentro del tenis): no se pueden salir
        for nom in ((pierna,) if PIE_OCULTO else (pie, pierna)):
            pts = cuerpo[nom]
            idx = dentro_reposo.get(nom) if dentro_reposo else None
            for k in (range(len(pts)) if idx is None else idx):
                p = pts[k]
                if nom != pie and ((p - c).dot(n) > -0.3 or tapa.ray_cast(p, -n, 60.0)[0] is not None):
                    continue      # salió por la boca (arriba de su tapa): está bien
                en_suela = lado_adentro(suela, p, cerca)
                if en_suela and en_suela[0]:
                    continue
                loc, nrm, _, dist = lona.find_nearest(p)
                del_lado_de_afuera = (p - loc).dot(nrm) > 0
                # fuera = del lado de afuera de la lona Y sin quedar encerrado (rayos a la lona, la suela
                # o la tapa de la boca). Cada prueba sola se engaña: la de la cara más cercana con un
                # pliegue del empeine, la de rayos con un rayo rasante que sale por la boca baja.
                if del_lado_de_afuera and not dentro_cerrado((lona, suela, tapa), p):
                    anota(nom, dist)
                elif not del_lado_de_afuera:
                    holg = min(holg, dist - GROSOR)
        # su muslo, la otra pierna y el otro pie: no se pueden meter en este tenis
        otro = "R" if lado == "L" else "L"
        for nom in (muslo,) + tuple(LADOS[otro][1 if PIE_OCULTO else 0:3]):
            for p in cuerpo[nom]:
                loc, nrm, _, dist = lona.find_nearest(p, 1.5)
                en_suela = lado_adentro(suela, p, 1.5)
                metido = (loc is not None and (p - loc).dot(nrm) < 0) or (en_suela is not None and en_suela[0])
                if metido and dentro_cerrado((lona, suela, tapa), p):
                    anota(nom + "_en_" + lado, dist if loc is not None else en_suela[1])
        # la orilla de abajo de la lona no se puede asomar por la banda de hule
        for k in d["banda"]:
            loc, nrm, _, dist = suela.find_nearest(vs[k])
            if (vs[k] - loc).dot(nrm) > 0:
                anota("lona_fuera_de_suela", dist)
        zs = [vs[i].z for i in d["todo"]]
        res[lado] = dict(fuera={k: (round(h, 3), k2) for k, (h, k2) in fuera.items()},
                         holgura=round(holg, 3), suela_z=round(min(zs), 3),
                         pie_z=round(min(p.z for p in cuerpo[pie]), 3))
    # un tenis contra el otro
    a = BVHTree.FromPolygons(vs, P["L"]["lona"] + P["L"]["suela"])
    b = BVHTree.FromPolygons(vs, P["R"]["lona"] + P["R"]["suela"])
    res["cruces"] = len(a.overlap(b))
    return res


def medir(nombre="Tenis", acciones=ACCIONES, paso=1, cuadros=None):
    """Cada cuadro de cada acción. Por lado: lo peor que se sale cada pieza (cm, cuántos vértices, cuadro),
    la holgura mínima, lo más bajo del tenis y del pie, y si los tenis se cruzan."""
    sc = bpy.context.scene
    antes = sc.frame_current
    P = partes(nombre)
    res = {}
    try:
        quitar_accion()
        # lo de la espinilla que en reposo va dentro del tenis (debajo de la boca)
        dg = bpy.context.evaluated_depsgraph_get(); inv = ARM.matrix_world.inverted()
        vs0 = malla_eval(bpy.data.objects[nombre], dg, inv)
        dentro_reposo = {}
        for lado, d in P.items():
            c, n, r = boca_plano(vs0, d["boca"], d["suela_v"])
            pts = malla_eval(bpy.data.objects[LADOS[lado][1]], dg, inv)
            dentro_reposo[LADOS[lado][1]] = [k for k, p in enumerate(pts) if (p - c).dot(n) < -0.5]
        res["reposo"] = medir_cuadro(nombre, P, dentro_reposo=dentro_reposo)
        for a in acciones:
            act = bpy.data.actions[a]
            f0, f1 = [int(round(x)) for x in act.frame_range]
            lista = cuadros or range(f0, f1 + 1, paso)
            peor = {"L": {}, "R": {}}; holg = {"L": (99, 0), "R": (99, 0)}
            suela = []; pie = []; dif = []; cruces = (0, None); de_mas = (0.0, None, None)
            for f in lista:
                poner_accion(a, f)
                r = medir_cuadro(nombre, P, dentro_reposo=dentro_reposo)
                for lado in ("L", "R"):
                    for k, (h, c) in r[lado]["fuera"].items():
                        if h > peor[lado].get(k, (0,))[0]:
                            peor[lado][k] = (h, c, f)
                    if r[lado]["holgura"] < holg[lado][0]:
                        holg[lado] = (r[lado]["holgura"], f)
                    suela.append(r[lado]["suela_z"]); pie.append(r[lado]["pie_z"])
                    dif.append(r[lado]["suela_z"] - r[lado]["pie_z"])
                    # lo que el tenis se mete bajo el piso de más que el pie desnudo
                    extra = min(0.0, r[lado]["suela_z"]) - min(0.0, r[lado]["pie_z"])
                    if extra < de_mas[0]:
                        de_mas = (round(extra, 2), f, lado)
                if r["cruces"] > cruces[0]:
                    cruces = (r["cruces"], f)
            res[a] = dict(fuera=peor, holgura=holg, suela_min=round(min(suela), 2), pie_min=round(min(pie), 2),
                          suela_menos_pie=(round(min(dif), 2), round(max(dif), 2)), cruces=cruces,
                          bajo_piso_de_mas=de_mas)
    finally:
        quitar_accion()
        sc.frame_set(antes)
    return res


def foto(ruta, objetivo=(0, -8, 8), direccion=(0, -1, 0.25), distancia=90.0, lente=50.0,
         ancho=1200, alto=1200, accion=None, cuadro=None, orto=None, muestras=32, incluir=None,
         excluir=("Egg_Foot_L", "Egg_Foot_R")):
    """Render con una cámara temporal, apuntando a 'objetivo' (cm del armature) desde 'direccion'.
    Se renderiza en una escena temporal con el cuerpo de Skulley y lo de 'incluir' (por defecto el
    objeto Tenis y lo de la colección Tenis_tmp): otras sesiones dejan sus props y piezas temporales
    en la escena y no se tocan. La escena de siempre queda como estaba."""
    main = bpy.context.scene
    tmp = bpy.data.scenes.new("tmp_foto_tenis")
    tmp.world = main.world
    tmp.render.engine = main.render.engine
    tmp.view_settings.view_transform = main.view_settings.view_transform
    tmp.view_settings.look = main.view_settings.look
    tmp.render.film_transparent = main.render.film_transparent
    if hasattr(tmp, "eevee") and hasattr(main, "eevee"):
        tmp.eevee.taa_render_samples = muestras
    if incluir is None:
        incluir = ["Tenis"] + ([o.name for o in bpy.data.collections["Tenis_tmp"].objects]
                               if bpy.data.collections.get("Tenis_tmp") else [])
    # el pie va oculto cuando trae los tenis
    cuerpo = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(("Egg_", "Skull"))
              and o.parent is ARM and not o.hide_render and o.name not in excluir]
    for o in [ARM] + cuerpo + [bpy.data.objects[n] for n in incluir if n in bpy.data.objects]:
        tmp.collection.objects.link(o)
    mw = ARM.matrix_world
    tgt = mw @ Vector(objetivo)
    d = Vector(direccion).normalized()
    pos = mw @ (Vector(objetivo) + d * distancia)
    cd = bpy.data.cameras.new("tmp_cam_tenis")
    cam = bpy.data.objects.new("tmp_cam_tenis", cd)
    tmp.collection.objects.link(cam)
    cam.location = pos
    cam.rotation_euler = (tgt - pos).to_track_quat('-Z', 'Y').to_euler()
    cd.lens = lente; cd.clip_start = 0.01; cd.clip_end = 100
    if orto:
        cd.type = 'ORTHO'; cd.ortho_scale = orto * mw.to_scale().x
    antes = main.frame_current
    try:
        if accion:
            poner_accion(accion, cuadro or 1)
            tmp.frame_set(cuadro or 1)
        else:
            quitar_accion()
        tmp.camera = cam
        r = tmp.render
        r.resolution_x = ancho; r.resolution_y = alto; r.resolution_percentage = 100
        r.filepath = ruta; r.image_settings.file_format = 'PNG'
        bpy.ops.render.render(write_still=True, scene=tmp.name)
    finally:
        if accion:
            quitar_accion()
        main.frame_set(antes)
        bpy.data.objects.remove(cam, do_unlink=True)
        bpy.data.cameras.remove(cd)
        bpy.data.scenes.remove(tmp)
    return ruta
