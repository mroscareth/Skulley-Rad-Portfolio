"""
Mide los pantalones de Skulley (prop "Pantalones") y saca fotos, en Character/SkulleyRad.blend.

En Blender:
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns)
    ns["medir"]()              # traspasos cuadro por cuadro en idle, walk y Correr (y en reposo)
    ns["foto"](ruta, ...)      # render en una escena temporal con una cámara temporal
Todo en las coordenadas del armature (cm). El piso es z = 0.
"""
import bpy, bmesh, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ARM = bpy.data.objects["root"]
ACCIONES = ("root|root|Iddle", "root|root|Walking", "Correr")


def malla_eval(o, dg, inv):
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    m = inv @ o.matrix_world
    vs = [m @ v.co for v in me.vertices]
    caras = [(tuple(p.vertices), p.material_index) for p in me.polygons]
    oe.to_mesh_clear()
    return vs, caras


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


def foto(ruta, objetivo=(0, -2, 45), direccion=(0, -1, 0.1), distancia=260.0, lente=50.0,
         ancho=1000, alto=1200, accion=None, cuadro=None, orto=None, muestras=24, incluir=("Pantalones",),
         excluir=(), cuerpo=True):
    """Render con una cámara temporal, apuntando a 'objetivo' (cm del armature) desde 'direccion', en una
    escena temporal con el cuerpo de Skulley y lo de 'incluir' (otras sesiones dejan props y temporales en
    la escena de siempre y no se tocan). La escena de siempre queda como estaba."""
    main = bpy.context.scene
    tmp = bpy.data.scenes.new("pnt_foto")
    tmp.world = main.world
    tmp.render.engine = main.render.engine
    tmp.view_settings.view_transform = main.view_settings.view_transform
    tmp.view_settings.look = main.view_settings.look
    tmp.render.film_transparent = False
    if hasattr(tmp, "eevee"):
        tmp.eevee.taa_render_samples = muestras
    objs = [ARM]
    if cuerpo:
        objs += [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith("Egg_")
                 and o.parent is ARM and not o.hide_render and o.name not in excluir]
    objs += [bpy.data.objects[n] for n in incluir if n in bpy.data.objects]
    for o in bpy.data.collections["Studio"].objects:
        if o.type == 'LIGHT':
            objs.append(o)
    for o in objs:
        if o.name not in tmp.collection.objects:
            tmp.collection.objects.link(o)
    mw = ARM.matrix_world
    tgt = mw @ Vector(objetivo)
    d = Vector(direccion).normalized()
    pos = mw @ (Vector(objetivo) + d * distancia)
    cd = bpy.data.cameras.new("pnt_cam")
    cam = bpy.data.objects.new("pnt_cam", cd)
    tmp.collection.objects.link(cam)
    cam.location = pos
    cam.rotation_euler = (tgt - pos).to_track_quat('-Z', 'Y').to_euler()
    cd.lens = lente; cd.clip_start = 0.01; cd.clip_end = 100
    if orto:
        cd.type = 'ORTHO'; cd.ortho_scale = orto * mw.to_scale().x
    antes = main.frame_current
    ocultos = {}
    try:
        for o in objs:
            if o.hide_get() or o.hide_viewport:
                ocultos[o.name] = o.hide_render
        if accion:
            poner_accion(accion, cuadro or 1)
            tmp.frame_set(cuadro or 1)
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


# ---------------------------------------------------------------- medición

PIERNAS = ("Egg_Pelvis", "Egg_Leg1_L", "Egg_Leg2_L", "Egg_Leg1_R", "Egg_Leg2_R")
BRAZOS = ("Egg_Arm1_L", "Egg_Arm1_R", "Egg_Arm2_L", "Egg_Arm2_R")
MEZCLILLA, FORRO, HILOS, METAL = range(4)


def partes(nombre="Pantalones"):
    """Islas de la malla en reposo: la tela (la más grande), su lado izquierdo y derecho, y las demás piezas
    (pretina, presillas, rollos, metales, hilos) con su material."""
    o = bpy.data.objects[nombre]
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    isla = {}; islas = []
    for f in bm.faces:
        if f in isla:
            continue
        pila = [f]; miembros = []; isla[f] = len(islas)
        while pila:
            x = pila.pop(); miembros.append(x.index)
            for e in x.edges:
                for g in e.link_faces:
                    if g not in isla:
                        isla[g] = len(islas); pila.append(g)
        islas.append(miembros)
    bm.free()
    tela = max(islas, key=len)
    otras = [i for i in islas if i is not tela]
    caras = [tuple(p.vertices) for p in me.polygons]
    mats = [p.material_index for p in me.polygons]
    adentro = [i for i in tela if mats[i] == FORRO]
    afuera = [i for i in tela if mats[i] == MEZCLILLA]
    cuenta = {}
    for i in adentro:
        c = caras[i]
        for k in range(len(c)):
            e = tuple(sorted((c[k], c[(k + 1) % len(c)])))
            cuenta[e] = cuenta.get(e, 0) + 1
    orilla = sorted({v for e, n in cuenta.items() if n == 1 for v in e})
    # lazos de la orilla (cintura, bastillas, rotos), en orden: para taparlos al medir
    vec = {}
    for e, n in cuenta.items():
        if n == 1:
            vec.setdefault(e[0], []).append(e[1]); vec.setdefault(e[1], []).append(e[0])
    lazos = []; vistos = set()
    for v0 in vec:
        if v0 in vistos:
            continue
        lazo = [v0]; vistos.add(v0); prev = None; v = v0
        while True:
            sig = [w for w in vec[v] if w != prev and w not in vistos]
            if not sig:
                break
            prev, v = v, sig[0]; vistos.add(v); lazo.append(v)
        lazos.append(lazo)
    co = [v.co for v in me.vertices]
    def es_roto(v):
        return 35.5 < co[v].z < 47.5 and co[v].y < -4
    lados = {"L": [i for i in tela if sum(co[v].x for v in caras[i]) > 0],
             "R": [i for i in tela if sum(co[v].x for v in caras[i]) < 0]}
    solidas = [isl for isl in otras if mats[isl[0]] in (MEZCLILLA, FORRO)]   # pretina, presillas, rollos
    return dict(caras=caras, adentro=adentro, afuera=afuera, orilla=orilla, lazos=lazos,
                roto_set={v for v in orilla if es_roto(v)},
                lados=lados, solidas=solidas, todas=list(range(len(caras))))


def _tris(caras, idx):
    out = []
    for i in idx:
        c = caras[i]
        for k in range(1, len(c) - 1):
            out.append((c[0], c[k], c[k + 1]))
    return out


def _kd(vs, idx):
    kd = KDTree(max(len(idx), 1))
    for i in idx:
        kd.insert(vs[i], i)
    kd.balance()
    return kd


def zona(p):
    if p.z < 31:
        return "espinilla"
    if p.z < 48:
        return "rodilla"
    if p.z < 57:
        return "muslo"
    return "cadera"


def lado_de(n):
    return "L" if n.endswith("_L") else ("R" if n.endswith("_R") else None)


DIRECCIONES = [Vector(d).normalized() for d in (
    (1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1),
    (1, 1, 1), (1, 1, -1), (1, -1, 1), (1, -1, -1), (-1, 1, 1), (-1, 1, -1), (-1, -1, 1), (-1, -1, -1))]


def encerrado(bvh, p, largo=80.0):
    """Adentro si en todas las direcciones choca con la ropa (o con la tapa de una abertura)."""
    for d in DIRECCIONES:
        if bvh.ray_cast(p, d, largo)[0] is None:
            return False
    return True


def construir(P, vs):
    """BVH de la ropa ya deformada: cara de adentro y de afuera (por lado y toda), tapas de las aberturas
    (abanico desde el centro de cada lazo de la orilla: cintura, bastillas, rotos) y todo cerrado (la ropa
    entera más las tapas, para saber si un punto queda encerrado)."""
    caras = P["caras"]
    lado_cara = {}
    for k in ("L", "R"):
        for i in P["lados"][k]:
            lado_cara[i] = k
    def bvh(idx):
        return BVHTree.FromPolygons(vs, _tris(caras, idx))
    B = {"dentro": {k: bvh([i for i in P["adentro"] if lado_cara.get(i) == k]) for k in ("L", "R")},
         "fuera": {k: bvh([i for i in P["afuera"] if lado_cara.get(i) == k]) for k in ("L", "R")}}
    B["dentro"]["T"] = bvh(P["adentro"]); B["fuera"]["T"] = bvh(P["afuera"])
    tv = []; tt = []; es_roto = []
    for lazo in P["lazos"]:
        c = sum((vs[i] for i in lazo), Vector()) / len(lazo)
        i0 = len(tv); tv.append(c)
        for i in lazo:
            tv.append(vs[i])
        m = len(lazo)
        for k in range(m):
            tt.append((i0, i0 + 1 + k, i0 + 1 + (k + 1) % m))
            es_roto.append(lazo[0] in P["roto_set"])
    B["tapas"] = BVHTree.FromPolygons(tv, tt); B["es_roto"] = es_roto
    n0 = len(vs)
    B["toda"] = bvh(P["todas"])
    B["cerrado"] = BVHTree.FromPolygons(list(vs) + tv, _tris(caras, P["todas"]) + [(a + n0, b + n0, c + n0) for a, b, c in tt])
    B["solidas"] = [bvh(isl) for isl in P["solidas"]]
    return B


def zonas_reposo(P, nombre="Pantalones"):
    """En reposo: la zona de cada vértice del cuerpo (así 'rodilla' es la rodilla aunque la pose la mueva) y
    si va cubierto por los pantalones (encerrado) o descubierto."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    vs, _ = malla_eval(bpy.data.objects[nombre], dg, inv)
    B = construir(P, vs)
    P["zonas"] = {}; P["cubierto"] = {}
    for n in PIERNAS:
        pts = malla_eval(bpy.data.objects[n], dg, inv)[0]
        P["zonas"][n] = [zona(p) for p in pts]
        P["cubierto"][n] = [encerrado(B["cerrado"], p) for p in pts]


def medir_cuadro(P, nombre="Pantalones", cerca=4.0, otros=("Boxers", "Tenis", "Botas")):
    """Un cuadro. Lo del cuerpo que en reposo va cubierto no se puede salir; lo descubierto no se puede meter.
    fuera: vértices cubiertos que ya no quedan encerrados por la ropa y no salieron por una abertura (más
    cerca de una tela que de una tapa): se ven atravesando la tela (cm a la cara de afuera, cuántos), por
    pieza y zona en reposo. asoma_roto: los que salieron por un roto (se busca). entra: vértices descubiertos
    (espinilla de abajo, manos) metidos en la ropa. traspasos: cubiertos más allá de la cara de adentro pero
    todavía encerrados (dentro de la tela o en un pliegue: no se ven). en_piezas: vértices del cuerpo adentro
    de las piezas cerradas (pretina, presillas, rollos). Choques: triángulos que se cruzan entre las dos
    piernas (sin contar los que comparten vértice, en la costura del centro) y contra los otros props."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ARM.matrix_world.inverted()
    vs, _ = malla_eval(bpy.data.objects[nombre], dg, inv)
    caras = P["caras"]
    B = construir(P, vs)
    res = {"traspasos": {}, "fuera": {}, "entra": {}, "en_piezas": {}, "asoma_roto": 0}
    def anota(dic, k, h):
        a, b = dic.get(k, (0.0, 0))
        dic[k] = (max(a, h), b + 1)
    for n in PIERNAS:
        bv, _ = malla_eval(bpy.data.objects[n], dg, inv)
        lado = lado_de(n) or "T"
        for p, zn, cub in zip(bv, P["zonas"][n], P["cubierto"][n]):
            k = n + ":" + zn
            if cub:
                loc, nrm, _, d = B["dentro"][lado].find_nearest(p, cerca)
                if loc is None or (p - loc).dot(nrm) < 0:
                    # primero: ¿está en una abertura? (más cerca de su tapa que de la tela)
                    lt, _, it, dt = B["tapas"].find_nearest(p, 60.0)
                    lo, _, _, do = B["toda"].find_nearest(p, 60.0)
                    if lt is not None and (lo is None or dt < do + 0.3):
                        if B["es_roto"][it] and not encerrado(B["cerrado"], p):
                            res["asoma_roto"] += 1
                    elif encerrado(B["cerrado"], p):
                        if loc is not None:
                            anota(res["traspasos"], k, d)
                    else:
                        lf, _, _, df = B["fuera"]["T"].find_nearest(p, 60.0)
                        anota(res["fuera"], k, df if lf is not None else do)
            else:
                # descubierto metido en la ropa, lejos de una abertura (por la cintura puede entrar: la cresta
                # de la pelvis baja corriendo hacia adentro de la pretina, por dentro)
                lo, no, _, do = B["fuera"]["T"].find_nearest(p, 3.0)
                if lo is not None and (p - lo).dot(no) < 0 and encerrado(B["cerrado"], p):
                    lt, _, _, dt = B["tapas"].find_nearest(p, 60.0)
                    if lt is None or dt > do + 0.3:
                        anota(res["entra"], k, do)
            for b in B["solidas"]:
                l2, n2, _, d2 = b.find_nearest(p, 2.0)
                # las presillas son tiras delgadas: el lado de la cara más cercana engaña; adentro de verdad
                # es quedar encerrado por la pieza
                if l2 is not None and (p - l2).dot(n2) < 0 and encerrado(b, p, largo=20.0):
                    anota(res["en_piezas"], n, d2)
    # brazos (las manos pasan junto a la cadera al caminar)
    for n in BRAZOS:
        bv, _ = malla_eval(bpy.data.objects[n], dg, inv)
        for p in bv:
            lo, no, _, do = B["fuera"]["T"].find_nearest(p, 4.0)
            if lo is not None and (p - lo).dot(no) < 0 and encerrado(B["cerrado"], p):
                anota(res["entra"], n, do)
    tl = _tris(caras, P["lados"]["L"]); tr = _tris(caras, P["lados"]["R"])
    pares = BVHTree.FromPolygons(vs, tl).overlap(BVHTree.FromPolygons(vs, tr))
    res["piernas_se_cruzan"] = sum(1 for a, b in pares if not (set(tl[a]) & set(tr[b])))
    for n in otros:
        o = bpy.data.objects.get(n)
        if not o:
            continue
        ov, oc = malla_eval(o, dg, inv)
        b = BVHTree.FromPolygons(ov, _tris([c for c, _ in oc], range(len(oc))))
        res["choca_" + n] = len(B["toda"].overlap(b))
    return res


def _junta(peor, r, f):
    for clave in ("traspasos", "fuera", "entra", "en_piezas"):
        for k, (h, c) in r[clave].items():
            if h > peor[clave].get(k, (0,))[0]:
                peor[clave][k] = (round(h, 2), c, f)
    for k in [k for k in r if k.startswith("choca_")] + ["piernas_se_cruzan", "asoma_roto"]:
        if r.get(k, 0) > peor[k][0]:
            peor[k] = (r[k], f)
    peor["cuadros"] += 1
    if r["traspasos"]:
        peor["con_traspaso"].append(f)
    if r["fuera"]:
        peor["se_ve"].append(f)
    if any(k.startswith("Egg_Arm") for k in r["entra"]):
        peor["manos"].append(f)


def medir(acciones=ACCIONES, paso=1, nombre="Pantalones", cuadros=None, otros=("Boxers", "Tenis", "Botas")):
    """Cuadro por cuadro. Por acción: lo peor de cada cosa (cm, cuántos vértices, cuadro) y en qué cuadros
    hubo traspaso. 'reposo' es la pose de armado."""
    sc = bpy.context.scene
    antes = sc.frame_current
    P = partes(nombre)
    res = {}
    def nuevo():
        d = {"traspasos": {}, "fuera": {}, "entra": {}, "en_piezas": {}, "cuadros": 0, "con_traspaso": [],
             "se_ve": [], "manos": [],
             "piernas_se_cruzan": (0, None), "asoma_roto": (0, None)}
        for n in otros:
            d["choca_" + n] = (0, None)
        return d
    try:
        quitar_accion()
        zonas_reposo(P)
        res["reposo"] = medir_cuadro(P, nombre, otros=otros)
        for a in acciones:
            act = bpy.data.actions[a]
            f0, f1 = [int(round(x)) for x in act.frame_range]
            peor = nuevo()
            for f in (cuadros or range(f0, f1 + 1, paso)):
                poner_accion(a, f)
                _junta(peor, medir_cuadro(P, nombre, otros=otros), f)
            res[a] = peor
    finally:
        quitar_accion()
        sc.frame_set(antes)
    return res
