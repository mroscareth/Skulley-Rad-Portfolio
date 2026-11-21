"""
Rig y animaciones de Argus (el NPC del juego de las esferas), sobre
public/3dmodels/zoidian.glb, que viene de Sketchfab con un esqueleto tipo
metarig de Rigify, transforms raros en la raíz (escalas 0.01 / 100) y un reposo
que no es la pose que se ve.

Se corre con Blender 5.3 en segundo plano:
  "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --python scripts/argus/armar_argus.py -- todo

  todo      limpiar + cara + animar + exportar
  limpiar   importa el GLB y rehace el esqueleto limpio (y guarda el .blend)
  cara      agrega huesos de cara, párpados y antenas, con sus pesos
  animar    rehace las acciones
  exportar  exporta el GLB del sitio (SALIDA)
  revisar   compara el Idle rehorneado contra el original

El .blend de trabajo vive fuera del repo (BLEND). zoidian.glb no se toca.

Esqueleto limpio (armature Argus, en el origen, escala 1, Z arriba, mira a -Y):
el reposo es el cuadro 0 del Idle original, así la malla queda donde se ve.
Los huesos del cuerpo conservan su nombre y sus ejes (ZoidianNPC los busca por
nombre y apunta brazos con su +Y), los _end y los dos "eye" de Sketchfab se van
(sus pesos pasan a head_05: jalaban media cara).
"""
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector, Matrix, Quaternion

_REPOS = [r"D:\Work\mroscar\Website\new\Skulley-Rad-Portfolio"]
REPO = next((r for r in _REPOS if os.path.isdir(os.path.join(r, "public"))), _REPOS[0])
GLB = os.path.join(REPO, "public", "3dmodels", "zoidian.glb")
SALIDA = os.path.join(REPO, "public", "3dmodels", "zoidian_rig.glb")
BLEND = r"D:\Work\mroscar\Website\new\Argus\Argus.blend"
FPS = 30
QUITAR = ("_rootJoint", "root_00", "eye.L_06", "eye.R_07")


def _normal(m):
    loc, rot, _ = m.decompose()
    return Matrix.LocRotScale(loc, rot, None)


def _base_de(m_local, padre_local, padre_pose, m_pose):
    """Matriz basis de un hueso para que quede en m_pose (espacio del armature),
    con su padre ya en padre_pose. Es la inversa de lo que hace Blender:
    pose = padre_pose @ padre_local⁻¹ @ m_local @ basis."""
    if padre_local is None:
        return m_local.inverted() @ m_pose
    return (padre_local.inverted() @ m_local).inverted() @ padre_pose.inverted() @ m_pose


# ---------------------------------------------------------------- limpiar

def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name != "Object_68":
            bpy.data.objects.remove(o)
    viejo = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    malla = bpy.data.objects["Object_68"]
    idle = viejo.animation_data.action
    fps_viejo = sc.render.fps / sc.render.fps_base
    fin_viejo = idle.frame_range[1]

    sc.frame_set(0)
    pose0 = {pb.name: viejo.matrix_world @ pb.matrix for pb in viejo.pose.bones}

    def guardar_bone(pb):
        return pb.name not in QUITAR and "_end" not in pb.name

    vivos = [pb for pb in viejo.pose.bones if guardar_bone(pb)]

    def padre_vivo(pb):
        p = pb.parent
        while p is not None and not guardar_bone(p):
            p = p.parent
        return p

    escala = viejo.matrix_world.to_scale().x
    largos = {}
    for pb in vivos:
        hijos = [c for c in pb.children if guardar_bone(c)]
        h = pose0[pb.name].to_translation()
        if hijos:
            largos[pb.name] = max(0.02, min((pose0[c.name].to_translation() - h).length for c in hijos))
        else:
            # las puntas tienen colas basura (de los _end): largo prudente
            largos[pb.name] = min(pb.length * escala, 0.06 if "distal" in pb.name or "toes" in pb.name else 0.3)

    # malla posada en el cuadro 0, en el mundo, con sus grupos
    dg = bpy.context.evaluated_depsgraph_get()
    ev = malla.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    me.transform(malla.matrix_world)
    me.name = "Argus"
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    nombres_grupos = [g.name for g in malla.vertex_groups]

    # muestras del Idle viejo a 30 fps (para rehornearlo)
    dur = fin_viejo / fps_viejo
    n = int(round(dur * FPS))
    muestras = []
    for k in range(n + 1):
        t = k / FPS * fps_viejo
        sc.frame_set(int(t), subframe=t - int(t))
        muestras.append({pb.name: _normal(viejo.matrix_world @ pb.matrix) for pb in vivos})

    # armature nuevo
    data = bpy.data.armatures.new("ArgusRig")
    arm = bpy.data.objects.new("Argus", data)
    sc.collection.objects.link(arm)
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    arm.select_set(True)
    vl.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = data.edit_bones
    raiz = eb.new("raiz")
    raiz.head = (0, 0, 0)
    raiz.tail = (0, 0, 0.4)
    raiz.use_deform = False
    for pb in vivos:
        b = eb.new(pb.name)
        b.head = (0, 0, 0)
        b.tail = (0, largos[pb.name], 0)
        b.matrix = _normal(pose0[pb.name])
    for pb in vivos:
        p = padre_vivo(pb)
        eb[pb.name].parent = eb[p.name] if p is not None else raiz
    bpy.ops.object.mode_set(mode="OBJECT")

    # malla nueva con los mismos grupos (el índice de cada grupo se conserva)
    nueva = bpy.data.objects.new("Argus_malla", me)
    sc.collection.objects.link(nueva)
    for nm in nombres_grupos:
        nueva.vertex_groups.new(name=nm)
    _fundir_grupo(nueva, "eye.L_06", "head_05")
    _fundir_grupo(nueva, "eye.R_07", "head_05")
    for nm in list(g.name for g in nueva.vertex_groups):
        if nm not in data.bones:
            g = nueva.vertex_groups[nm]
            nueva.vertex_groups.remove(g)
    nueva.parent = arm
    mod = nueva.modifiers.new("Argus", "ARMATURE")
    mod.object = arm

    # fuera lo de Sketchfab
    for o in list(bpy.data.objects):
        if o not in (arm, nueva):
            bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)

    sc.render.fps = FPS
    sc.render.fps_base = 1
    _hornear_muestras(arm, "IdleOriginal", muestras, ciclo=True)
    return arm, nueva


def _fundir_grupo(obj, de, a):
    gd = obj.vertex_groups.get(de)
    ga = obj.vertex_groups.get(a)
    if gd is None or ga is None:
        return
    for v in obj.data.vertices:
        w = 0.0
        for g in v.groups:
            if g.group == gd.index:
                w = g.weight
        if w > 0:
            prev = 0.0
            for g in v.groups:
                if g.group == ga.index:
                    prev = g.weight
            ga.add([v.index], prev + w, "REPLACE")
    obj.vertex_groups.remove(gd)


def _orden(arm):
    """Huesos de padres a hijos."""
    out = []

    def rec(b):
        out.append(b)
        for c in b.children:
            rec(c)
    for b in arm.data.bones:
        if b.parent is None:
            rec(b)
    return out


def _hornear_muestras(arm, nombre, muestras, ciclo):
    """muestras: [{hueso: matriz en el espacio del armature}] cuadro por cuadro."""
    ad = arm.animation_data or arm.animation_data_create()
    accion = bpy.data.actions.new(nombre)
    ad.action = accion
    orden = _orden(arm)
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    for f, m in enumerate(muestras):
        pose = {}
        for b in orden:
            objetivo = m.get(b.name)
            if objetivo is None:
                pose[b.name] = (pose[b.parent.name] @ b.parent.matrix_local.inverted() @ b.matrix_local) if b.parent else b.matrix_local
                continue
            pl = b.parent.matrix_local if b.parent else None
            pp = pose[b.parent.name] if b.parent else None
            basis = _base_de(b.matrix_local, pl, pp, objetivo)
            pose[b.name] = objetivo
            pb = arm.pose.bones[b.name]
            loc, rot, _ = basis.decompose()
            pb.location = loc
            pb.rotation_quaternion = rot
            pb.keyframe_insert("location", frame=f)
            pb.keyframe_insert("rotation_quaternion", frame=f)
    accion.use_frame_range = True
    accion.frame_start, accion.frame_end = 0, len(muestras) - 1
    accion.use_cyclic = ciclo
    accion.use_fake_user = True
    accion["ciclo"] = ciclo
    return accion


# ---------------------------------------------------------------- cara
#
# Todo se mide sobre el reposo (= la pose que se ve). Ejes de los huesos de cara:
#   ojo_*            Y al frente (hacia la pupila), X a la izquierda de Argus (+X del mundo).
#   parpado_sup_*    Y al frente, X a su izquierda: girar +X cierra (baja).
#   parpado_inf_*    Y al frente, X a su derecha: girar +X sube (cierra).
#   (los dos párpados: girar su Y inclina el filo; ver ZoidianNPC)
#   ceja_*           Y arriba, X a su izquierda: trasladar +Y sube la ceja.
#   quijada          Y hacia la barbilla, X a su izquierda: girar +X abre.
#   antena_*_1..3    Y a lo largo de la antena (las mueve un resorte en el sitio).
#   esfera           no deforma: lleva la esfera luminosa del idle de comer.

R_PARPADO = 1.06          # radio del párpado de arriba, en radios del globo
R_PARPADO_INF = 1.045     # el de abajo, un poco adentro: el de arriba lo tapa al cerrar
MARGEN_ABIERTO = 5.0      # grados entre el filo abierto y la orilla de la cuenca
MEZCLA_CIERRE = 0.62      # dónde se juntan al cerrar (0 = orilla de arriba, 1 = la de abajo)
QUIJADA_PIVOTE = Vector((0.0, -0.24, 1.745))
# Las comisuras y el labio de arriba (medidos de frente: la boca abierta va de x -0.11
# a 0.17 y de z 1.665 a 1.77). Sus huesos: Y arriba, X a la izquierda de Argus.
BOCA_PUNTOS = {"comisura_L": Vector((0.185, -0.5, 1.705)), "comisura_R": Vector((-0.125, -0.5, 1.715)),
               "labio_sup": Vector((0.03, -0.585, 1.785))}


def _islas_de(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    isla = [-1] * len(bm.verts)
    k = 0
    for v in bm.verts:
        if isla[v.index] >= 0:
            continue
        pila = [v]
        isla[v.index] = k
        while pila:
            x = pila.pop()
            for e in x.link_edges:
                w = e.other_vert(x)
                if isla[w.index] < 0:
                    isla[w.index] = k
                    pila.append(w)
        k += 1
    bm.free()
    miembros = {}
    for i, s in enumerate(isla):
        miembros.setdefault(s, []).append(i)
    return isla, miembros


def _caja(P, ids):
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for i in ids:
        lo = Vector(map(min, lo, P[i]))
        hi = Vector(map(max, hi, P[i]))
    return lo, hi


def _suave(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def _analizar(malla):
    me = malla.data
    P = [v.co.copy() for v in me.vertices]
    isla, miembros = _islas_de(me)
    caja = {s: _caja(P, ids) for s, ids in miembros.items()}

    def donde(cond):
        out = []
        for s, ids in miembros.items():
            lo, hi = caja[s]
            if cond(len(ids), lo, hi, (lo + hi) / 2):
                out.append(s)
        return out

    cabeza = max((s for s in miembros if caja[s][1].z > 2.0), key=lambda s: len(miembros[s]))
    ojos = donde(lambda n, lo, hi, c: n == 242 and c.z > 1.8)
    pupilas = donde(lambda n, lo, hi, c: n == 21 and c.z > 1.8)
    dientes_inf = donde(lambda n, lo, hi, c: n in (93, 33) and c.z < 1.7 and c.y < -0.4 and abs(c.x) < 0.15)
    encias = donde(lambda n, lo, hi, c: n == 123)
    encia_inf = min(encias, key=lambda s: caja[s][0].z)
    antenas = donde(lambda n, lo, hi, c: n in (104, 33) and c.z > 2.0)
    assert len(ojos) == 2 and len(pupilas) == 2 and len(dientes_inf) == 8 and len(antenas) == 6, (ojos, pupilas, dientes_inf, antenas)
    info = {"P": P, "isla": isla, "miembros": miembros, "caja": caja, "cabeza": cabeza,
            "dientes_inf": dientes_inf, "encia_inf": encia_inf, "ojos": {}, "antenas": {}}
    cL = (lambda s: (caja[s][0] + caja[s][1]) / 2)
    lateral = (cL(max(ojos, key=lambda s: cL(s).x)) - cL(min(ojos, key=lambda s: cL(s).x))).normalized()
    frente = Vector((0, -1, 0))
    frente = (frente - frente.dot(lateral) * lateral).normalized()
    arriba = frente.cross(lateral)
    info["ejes"] = (lateral, frente, arriba)
    for s in ojos:
        lo, hi = caja[s]
        c = (lo + hi) / 2
        lado = "L" if c.x > 0 else "R"
        pup = min(pupilas, key=lambda p: (caja[p][0] - c).length)
        info["ojos"][lado] = {"isla": s, "pupila": pup, "c": c, "r": (hi.x - lo.x) / 2}
    for s in antenas:
        lado = "L" if cL(s).x > 0 else "R"
        info["antenas"].setdefault(lado, []).append(s)
    return info


def _bvh_cabeza(info, me):
    from mathutils.bvhtree import BVHTree
    P = info["P"]
    cab = set(info["miembros"][info["cabeza"]])
    caras = [list(p.vertices) for p in me.polygons if p.vertices[0] in cab]
    return BVHTree.FromPolygons(P, caras, all_triangles=False)


def _dir_ojo(ejes, beta, gamma):
    """β gira sobre el eje lateral (0 = arriba, 90 = al frente, 180 = abajo);
    γ es el ángulo desde el eje lateral (90 = la línea del centro)."""
    X, F, U = ejes
    b, g = math.radians(beta), math.radians(gamma)
    return (math.cos(g) * X + math.sin(g) * (math.cos(b) * U + math.sin(b) * F)).normalized()


def _contorno(info, bvh, ojo):
    """Para cada γ, la orilla de arriba y la de abajo de lo que se ve del globo (un
    punto del párpado a R_PARPADO es visible si la piel no lo tapa desde el centro)."""
    c, r = ojo["c"], ojo["r"]
    ejes = info["ejes"]
    gammas = list(range(8, 173, 4))
    top, bot = {}, {}
    for g in gammas:
        vis = []
        for b in range(0, 181):
            d = _dir_ojo(ejes, b, g)
            hit = bvh.ray_cast(c, d, r * R_PARPADO * 1.02)
            if hit[0] is None:
                vis.append(b)
        if vis:
            top[g], bot[g] = min(vis), max(vis)
    # donde no se ve nada, el filo se queda donde el vecino más cercano
    con = sorted(top)
    for g in gammas:
        if g not in top:
            v = min(con, key=lambda x: abs(x - g))
            mid = (top[v] + bot[v]) / 2
            top[g], bot[g] = mid, mid
    # suavizar
    def suav(d):
        out = {}
        for i, g in enumerate(gammas):
            vec = [d[gammas[j]] for j in range(max(0, i - 1), min(len(gammas), i + 2))]
            out[g] = sum(vec) / len(vec)
        return out
    return gammas, suav(top), suav(bot)


def _uv_piel(info, me, punto):
    """UV de la piel de la cabeza más cerca de `punto` (para pintar los párpados)."""
    cab = set(info["miembros"][info["cabeza"]])
    uvl = me.uv_layers[0].data
    mejor, dmin = None, 1e9
    for p in me.polygons:
        if p.vertices[0] not in cab:
            continue
        d = (p.center - punto).length
        if d < dmin:
            mejor, dmin = p, d
    return uvl[mejor.loop_indices[0]].uv.copy()


# Cada párpado lleva tres huesos repartidos a lo ancho del ojo (0, 1, 2 = de gamma
# chica a gamma grande; en el ojo izquierdo la chica es la orilla de afuera, en el
# derecho la de adentro). Cada uno cierra hasta la línea medida de la cuenca en su
# lugar, así el filo sigue la almendra inclinada del ojo a cualquier altura.
PARPADO_HUESOS = (0.12, 0.5, 0.88)


def _parpados(info, me, bvh):
    """Geometría de los cuatro párpados, agregada a la malla. Regresa, por párpado,
    [(vértice, peso de cada uno de sus tres huesos)], y los ángulos de cierre de cada
    hueso."""
    ejes = info["ejes"]
    nuevos = {}
    cierres = {}
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv[0]
    for lado, ojo in info["ojos"].items():
        c, r = ojo["c"], ojo["r"]
        gammas, top, bot = _contorno(info, bvh, ojo)
        abiertas = [g for g in gammas if bot[g] - top[g] > 1.0]
        ga, gb = min(abiertas), max(abiertas)
        g_hueso = [ga + (gb - ga) * t for t in PARPADO_HUESOS]

        def contorno_en(d, g):
            k = min(range(len(gammas) - 1), key=lambda i: abs((gammas[i] + gammas[i + 1]) / 2 - g))
            g0, g1 = gammas[k], gammas[k + 1]
            t = max(0.0, min(1.0, (g - g0) / (g1 - g0)))
            return d[g0] * (1 - t) + d[g1] * t
        cierres[lado] = {"sup": [], "inf": [], "gamma": g_hueso}
        for g in g_hueso:
            tp, bt = contorno_en(top, g), contorno_en(bot, g)
            junta = tp + MEZCLA_CIERRE * (bt - tp)
            cierres[lado]["sup"].append(junta - (tp - MARGEN_ABIERTO) + 3.0)
            cierres[lado]["inf"].append((bt + MARGEN_ABIERTO) - junta + 3.0)

        def pesos(g):
            t = max(0.0, min(1.0, (g - g_hueso[0]) / (g_hueso[2] - g_hueso[0])))
            if t <= 0.5:
                w1 = _suave(t / 0.5)
                return (1 - w1, w1, 0.0)
            w2 = _suave((t - 0.5) / 0.5)
            return (0.0, 1 - w2, w2)
        piel = _uv_piel(info, me, Vector((0.027, -0.5, 2.02)))
        X, F, U = ejes
        for cual in ("sup", "inf"):
            R = r * (R_PARPADO if cual == "sup" else R_PARPADO_INF)
            filas = []
            pasos = 12
            for k in range(pasos + 1):
                fila = []
                for g in gammas:
                    if cual == "sup":
                        filo = top[g] - MARGEN_ABIERTO
                        b = filo - 95.0 * (1 - k / pasos)
                    else:
                        filo = bot[g] + MARGEN_ABIERTO
                        b = filo + 70.0 * (1 - k / pasos)
                    fila.append((bm.verts.new(c + _dir_ojo(ejes, b, g) * R), g))
                filas.append(fila)
            # labio del filo: le da grueso al verlo de canto
            filas.append([(bm.verts.new(c + (v.co - c).normalized() * r * 0.97), g) for v, g in filas[-1]])
            caras = []
            for k in range(len(filas) - 1):
                for j in range(len(gammas) - 1):
                    q = (filas[k][j][0], filas[k][j + 1][0], filas[k + 1][j + 1][0], filas[k + 1][j][0])
                    if cual == "inf":
                        q = tuple(reversed(q))
                    caras.append(bm.faces.new(q))
            for f in caras:
                f.material_index = 0
                f.smooth = True
                for lp in f.loops:
                    # UV casi fijo (color plano de la piel) pero no degenerado: con UV
                    # constante las tangentes del mapa de normales salen en cero
                    d = lp.vert.co - c
                    lp[uv].uv = piel + Vector((d.dot(X), d.dot(U))) * 0.02
            nuevos[f"parpado_{cual}_{lado}"] = ([(v, pesos(g)) for fila in filas for v, g in fila], c)
    bm.verts.index_update()
    idx = {k: [(v.index, w) for v, w in vs] for k, (vs, _) in nuevos.items()}
    centro_de = {v.index: c for k, (vs, c) in nuevos.items() for v, _ in vs}
    bm.to_mesh(me)
    bm.free()
    me.update()
    # la malla trae normales propias (las del GLB): se conservan, y las del párpado
    # salen del centro del globo
    normales = [tuple(cn.vector) for cn in me.corner_normals]
    for lp in me.loops:
        c = centro_de.get(lp.vertex_index)
        if c is not None:
            normales[lp.index] = tuple((me.vertices[lp.vertex_index].co - c).normalized())
    me.normals_split_custom_set(normales)
    return idx, cierres


def _antena(info, lado):
    P = info["P"]
    islas = info["antenas"][lado]
    tapa = min(islas, key=lambda s: len(info["miembros"][s]))
    tubo = [i for s in islas if s != tapa for i in info["miembros"][s]]
    base = sum((P[i] for i in info["miembros"][tapa]), Vector()) / len(info["miembros"][tapa])
    dist = {i: (P[i] - base).length for i in tubo}
    dmax = max(dist.values())

    def centro(a, b):
        sel = [P[i] for i in tubo if a * dmax <= dist[i] <= b * dmax]
        return sum(sel, Vector()) / len(sel)
    juntas = [base, centro(0.30, 0.36), centro(0.63, 0.69), centro(0.95, 1.0)]
    return {"tapa": tapa, "tubo": tubo, "dist": dist, "dmax": dmax, "juntas": juntas}


def cara(arm=None, malla=None):
    arm = arm or bpy.data.objects["Argus"]
    malla = malla or bpy.data.objects["Argus_malla"]
    sc = bpy.context.scene
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
    # antes que todo: los índices de vértices de aquí en adelante ya son sin ellas
    print("OCULTAS", _quitar_ocultas(malla))
    info = _analizar(malla)
    me = malla.data
    bvh = _bvh_cabeza(info, me)
    lids, cierres = _parpados(info, me, bvh)
    X, F, U = info["ejes"]
    antenas = {lado: _antena(info, lado) for lado in ("L", "R")}

    # huesos
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    arm.select_set(True)
    vl.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    head = eb["head_05"]

    def hueso(nombre, h, y, x, largo, padre, deforma=True):
        if nombre in eb:
            eb.remove(eb[nombre])
        b = eb.new(nombre)
        y = y.normalized()
        x = (x - x.dot(y) * y).normalized()
        z = x.cross(y)
        m = Matrix((x, y, z)).transposed().to_4x4()
        m.translation = h
        b.head = (0, 0, 0)
        b.tail = (0, largo, 0)
        b.matrix = m
        b.parent = padre
        b.use_deform = deforma
        return b

    for lado, ojo in info["ojos"].items():
        c, r = ojo["c"], ojo["r"]
        pup = info["P"]
        pc = sum((pup[i] for i in info["miembros"][ojo["pupila"]]), Vector()) / len(info["miembros"][ojo["pupila"]])
        hueso(f"ojo_{lado}", c, pc - c, X, r, head)
        for k in range(3):
            hueso(f"parpado_sup_{lado}_{k}", c, F, X, r * (0.7 + 0.05 * k), head)
            hueso(f"parpado_inf_{lado}_{k}", c, F, -X, r * (0.7 + 0.05 * k), head)
        sgn = 1 if lado == "L" else -1
        # cejas: arriba de la orilla de la cuenca, adentro y afuera
        g_in, g_out = (90 - 38 * sgn), (90 + 38 * sgn)
        for nombre, g in (("int", g_in), ("ext", g_out)):
            d = _dir_ojo(info["ejes"], 48, g)
            hit = bvh.ray_cast(c, d, r * 3)
            p = hit[0] if hit[0] is not None else c + d * r
            ojo[f"ceja_{nombre}"] = p
            hueso(f"ceja_{nombre}_{lado}", p, U, X, r * 0.6, head)
    hueso("quijada", QUIJADA_PIVOTE, Vector((0, -0.26, -0.12)), X, 0.25, head)
    for nombre, p in BOCA_PUNTOS.items():
        hueso(nombre, p, U, X, 0.06, head)
    for lado, a in antenas.items():
        j = a["juntas"]
        padre = head
        for k in range(3):
            b = hueso(f"antena_{lado}_{k + 1}", j[k], j[k + 1] - j[k], X, (j[k + 1] - j[k]).length, padre)
            if k > 0:
                b.use_connect = True
            padre = b
    hueso("esfera", Vector((0.3, -0.5, 1.2)), U, X, 0.15, eb["raiz"], deforma=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"

    _pesar_cara(malla, info, lids, antenas)
    _giro_antebrazo(arm, malla)
    soldados = _soldar_costuras(malla)
    print("COSTURAS", len(soldados))
    print("CAPAS", _pesar_capas(malla, fijos=soldados))
    # al final: la soldadura con el collar le promediaba peso del cuello a la cara
    print("CARA_SIN_CUELLO", _cara_sin_cuello(malla))
    _separar_parpados(malla)
    print("PANTALLA", _separar_pantalla(malla))
    arm["cara"] = json.dumps({
        "cierres": cierres,
        "ojos": {l: {"c": list(o["c"]), "r": o["r"]} for l, o in info["ojos"].items()},
    })
    return info, cierres


GIRO_ANTEBRAZO = {"L": ("lower_arm.L_010", "hand.L_011"), "R": ("lower_arm.R_026", "hand.R_027")}


def _giro_antebrazo(arm, malla):
    """Un hueso de giro en cada antebrazo (hijo del antebrazo, mismos ejes): se lleva
    la mitad de la muñeca hacia el codo del peso del antebrazo, así la palma puede
    voltear arriba girando el antebrazo entero y no solo la muñeca (que se retuerce
    como envoltura de dulce)."""
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    arm.select_set(True)
    vl.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    for lado, (ante, mano) in GIRO_ANTEBRAZO.items():
        nombre = f"antebrazo_giro_{lado}"
        if nombre in eb:
            eb.remove(eb[nombre])
        b = eb.new(nombre)
        b.head = eb[ante].head.copy()
        b.tail = eb[ante].tail.copy()
        b.roll = eb[ante].roll
        b.parent = eb[ante]
        b.use_deform = True
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    B = arm.data.bones
    for lado, (ante, mano) in GIRO_ANTEBRAZO.items():
        codo, muneca = B[ante].head_local, B[mano].head_local
        eje = muneca - codo
        g_a = malla.vertex_groups[ante]
        g_g = malla.vertex_groups.get(f"antebrazo_giro_{lado}") or malla.vertex_groups.new(name=f"antebrazo_giro_{lado}")
        for v in malla.data.vertices:
            w = 0.0
            for g in v.groups:
                if g.group == g_a.index:
                    w = g.weight
            if w <= 0.0:
                continue
            t = (v.co - codo).dot(eje) / eje.length_squared
            f = _suave((t - 0.2) / 0.7)
            if f <= 0.0:
                continue
            g_a.add([v.index], w * (1 - f), "REPLACE")
            g_g.add([v.index], w * f, "REPLACE")


COSTURA_PREF = ("shoulder", "upper_arm", "lower_arm", "antebrazo_giro", "chest", "spine", "neck", "hand")


def _soldar_costuras(malla, radio=0.012, suavizar=0.05, pasadas=4):
    """La malla de Sketchfab es de piezas sueltas (manga, hombrera, torso, guante...)
    con pesos distintos en sus orillas: al levantar el brazo la orilla de una pieza se
    separa de la otra y se ve el fondo por el hueco. Cada vértice de una orilla abierta
    toma los mismos pesos que el vértice más cercano de la otra pieza (el promedio de
    los dos), así se mueven juntos, y alrededor (SUAVIZAR) los pesos se suavizan para
    que no quede un pliegue."""
    from mathutils.kdtree import KDTree
    me = malla.data
    isla, _ = _islas_de(me)
    gn = {g.index: g.name for g in malla.vertex_groups}
    dom = {v.index: gn[max(v.groups, key=lambda g: g.weight).group] for v in me.vertices if v.groups}
    region = [i for i, n in dom.items() if n.startswith(COSTURA_PREF)]
    caras_arista = {}
    for p in me.polygons:
        for k in p.edge_keys:
            caras_arista[k] = caras_arista.get(k, 0) + 1
    orilla = set()
    for (a_, b_), n in caras_arista.items():
        if n == 1:
            orilla.update((a_, b_))
    kd = KDTree(len(region))
    for k, i in enumerate(region):
        kd.insert(me.vertices[i].co, k)
    kd.balance()

    def pesos(i):
        return {g.group: g.weight for g in me.vertices[i].groups}

    def poner(i, w):
        top = sorted(w.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(x for _, x in top) or 1.0
        for g in list(me.vertices[i].groups):
            malla.vertex_groups[g.group].remove([i])
        for gi, x in top:
            if x / tot > 1e-4:
                malla.vertex_groups[gi].add([i], x / tot, "REPLACE")
    # racimos: cada vértice de orilla con su vecino más cercano de otra pieza; todo el
    # racimo toma el promedio (si no, un vértice que es pareja de dos queda con el
    # promedio de solo uno y la costura se abre igual)
    padre = {}

    def raiz(x):
        while padre.get(x, x) != x:
            padre[x] = padre.get(padre[x], padre[x])
            x = padre[x]
        return x
    for i in region:
        if i not in orilla:
            continue
        mejor = None
        for _, k, d in kd.find_range(me.vertices[i].co, radio):
            j = region[k]
            if isla[j] != isla[i] and (mejor is None or d < mejor[1]):
                mejor = (j, d)
        if mejor:
            ri, rj = raiz(i), raiz(mejor[0])
            padre.setdefault(i, i)
            padre.setdefault(mejor[0], mejor[0])
            if ri != rj:
                padre[ri] = rj
    racimos = {}
    for x in list(padre):
        racimos.setdefault(raiz(x), []).append(x)
    soldados = {}
    for miembros in racimos.values():
        acc = {}
        for i in miembros:
            for g, x in pesos(i).items():
                acc[g] = acc.get(g, 0.0) + x
        prom = {g: x / len(miembros) for g, x in acc.items()}
        for i in miembros:
            soldados[i] = prom
    for i, w in soldados.items():
        poner(i, w)
    # suavizado alrededor de las costuras (los soldados no se mueven)
    vecinos = {}
    for e in me.edges:
        a_, b_ = e.vertices
        vecinos.setdefault(a_, []).append(b_)
        vecinos.setdefault(b_, []).append(a_)
    sold = list(soldados)
    kd2 = KDTree(len(sold))
    for k, i in enumerate(sold):
        kd2.insert(me.vertices[i].co, k)
    kd2.balance()
    cerca = [i for i in region if i not in soldados and kd2.find(me.vertices[i].co)[2] < suavizar]
    for _ in range(pasadas):
        nuevos = {}
        for i in cerca:
            acc = pesos(i)
            n = 1
            for j in vecinos.get(i, []):
                for g, x in pesos(j).items():
                    acc[g] = acc.get(g, 0.0) + x
                n += 1
            nuevos[i] = {g: x / n for g, x in acc.items()}
        for i, w in nuevos.items():
            poner(i, w)
    return set(soldados)


CAPA_PREF = ("shoulder", "upper_arm", "lower_arm", "antebrazo_giro", "chest", "spine", "neck", "hips", "upper_leg")


def _normales_vertice(me, co_n=None):
    """Normal de cada vértice, promedio de las normales de esquina (las del modelo; el
    orden de los vértices de las caras de este GLB no es confiable)."""
    import numpy as np
    nv = len(me.vertices)
    cn = np.empty(len(me.loops) * 3)
    me.corner_normals.foreach_get("vector", cn)
    lv = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", lv)
    vn = np.zeros((nv, 3))
    np.add.at(vn, lv, cn.reshape(-1, 3))
    return vn / np.maximum(1e-9, np.linalg.norm(vn, axis=1))[:, None]


def _cubiertos(malla, alcance=0.05):
    """Vértices que tienen otra pieza encima (la piel bajo la chamarra, la chamarra bajo
    otra capa): {vértice: (cara, vértices de la cara, pesos baricéntricos, distancia)}.
    Se busca con un rayo hacia afuera; la cara que tapa tiene que ver hacia el mismo lado."""
    import numpy as np
    from mathutils.bvhtree import BVHTree
    from mathutils.interpolate import poly_3d_calc
    me = malla.data
    isla, _ = _islas_de(me)
    gn = {g.index: g.name for g in malla.vertex_groups}
    region = {v.index for v in me.vertices if v.groups and gn[max(v.groups, key=lambda g: g.weight).group].startswith(CAPA_PREF)}
    vn = _normales_vertice(me)
    co = [v.co.copy() for v in me.vertices]
    bvh = BVHTree.FromPolygons(co, [list(p.vertices) for p in me.polygons])
    res = {}
    for i in region:
        n = Vector(vn[i])
        hit = bvh.ray_cast(co[i] + n * 0.0015, n, alcance)
        if hit[0] is None:
            continue
        vs = list(me.polygons[hit[2]].vertices)
        if isla[vs[0]] == isla[i] or not all(j in region for j in vs):
            continue
        if Vector(vn[vs].sum(0)).normalized().dot(n) < 0.3:
            continue
        res[i] = (hit[2], vs, list(poly_3d_calc([co[j] for j in vs], hit[0])), hit[3] + 0.0015)
    return res


def _pesar_capas(malla, pasadas=3, banda=0.03, suaves=4, fijos=()):
    """La malla trae capas encimadas (la piel debajo de la chamarra, la chamarra debajo
    de otra) con pesos distintos: al subir el brazo la de abajo se salía por la de
    arriba (la mancha en la espalda, junto a la hombrera). Cada vértice tapado toma los
    pesos del punto de la capa que lo tapa (interpolados en su cara), así se mueven
    juntas; varias pasadas para la capa de abajo de la de abajo, y en la orilla de lo
    tapado los pesos se suavizan para que no quede pliegue. Va después de soldar las
    costuras (su suavizado deshacía la copia) y no toca los vértices soldados (`fijos`):
    copiarles los pesos de la capa de encima volvía a abrir las costuras."""
    from mathutils.kdtree import KDTree
    me = malla.data
    fijos = set(fijos)
    cub = {i: c for i, c in _cubiertos(malla).items() if i not in fijos}

    def pesos(i):
        return {g.group: g.weight for g in me.vertices[i].groups}

    def poner(i, w):
        top = sorted(w.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(x for _, x in top) or 1.0
        for g in list(me.vertices[i].groups):
            malla.vertex_groups[g.group].remove([i])
        for gi, x in top:
            if x / tot > 1e-4:
                malla.vertex_groups[gi].add([i], x / tot, "REPLACE")
    def copiar():
        for _ in range(pasadas):
            nuevos = {}
            for i, (_, vs, w, _) in cub.items():
                acc = {}
                for j, b in zip(vs, w):
                    for g, x in pesos(j).items():
                        acc[g] = acc.get(g, 0.0) + x * b
                nuevos[i] = acc
            for i, acc in nuevos.items():
                poner(i, acc)
    copiar()
    vecinos = {}
    for e in me.edges:
        a_, b_ = e.vertices
        vecinos.setdefault(a_, []).append(b_)
        vecinos.setdefault(b_, []).append(a_)
    tap = list(cub)
    kd = KDTree(len(tap))
    for k, i in enumerate(tap):
        kd.insert(me.vertices[i].co, k)
    kd.balance()
    gn = {g.index: g.name for g in malla.vertex_groups}
    orilla = [v.index for v in me.vertices if v.index not in cub and v.index not in fijos and v.groups
              and gn[max(v.groups, key=lambda g: g.weight).group].startswith(CAPA_PREF) and kd.find(v.co)[2] < banda]
    for _ in range(suaves):
        nuevos = {}
        for i in orilla:
            acc = pesos(i)
            n = 1
            for j in vecinos.get(i, []):
                for g, x in pesos(j).items():
                    acc[g] = acc.get(g, 0.0) + x
                n += 1
            nuevos[i] = {g: x / n for g, x in acc.items()}
        for i, w in nuevos.items():
            poner(i, w)
    # el suavizado también toca la capa de encima (queda a menos de BANDA): se copia
    # otra vez para que la de abajo la siga exacto
    copiar()
    return len(cub), len(orilla)


def medir_capas(nombres, cada=2):
    """Cuánto se sale una capa de la que la tapa (cm), cuadro por cuadro."""
    import numpy as np
    sc = bpy.context.scene
    arm = bpy.data.objects["Argus"]
    malla = bpy.data.objects["Argus_malla"]
    cub = _cubiertos(malla)
    idx = np.array(list(cub))
    vs = [cub[i][1] for i in idx]
    ws = [cub[i][2] for i in idx]
    res = {}
    for nombre in nombres:
        arm.animation_data.action = bpy.data.actions[nombre]
        fin = int(bpy.data.actions[nombre].frame_end)
        peor, donde, malos = 0.0, None, 0
        for f in range(0, fin + 1, cada):
            sc.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            m = malla.evaluated_get(dg).to_mesh()
            co = np.empty(len(m.vertices) * 3)
            m.vertices.foreach_get("co", co)
            co = co.reshape(-1, 3)
            vn = _normales_vertice(m)
            malla.evaluated_get(dg).to_mesh_clear()
            for k, i in enumerate(idx):
                w = np.array(ws[k])[:, None]
                pout = (co[vs[k]] * w).sum(0)
                nout = (vn[vs[k]] * w).sum(0)
                fuera = float(np.dot(co[i] - pout, nout / max(1e-9, np.linalg.norm(nout))))
                if fuera > 0.003:
                    malos += 1
                if fuera > peor:
                    peor, donde = fuera, (f, int(i))
        res[nombre] = {"asoma_cm": round(peor * 100, 2), "donde": donde, "vertices_cuadro": malos}
    return res


def _separar_parpados(malla):
    """Los párpados van en su propia malla: en el sitio no llevan contorno (el contorno
    de un párpado escondido en la cuenca se salía de la piel como mancha negra)."""
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    malla.select_set(True)
    vl.objects.active = malla
    grupos = {g.index for g in malla.vertex_groups if g.name.startswith("parpado_")}
    for v in malla.data.vertices:
        v.select = any(g.group in grupos and g.weight > 0 for g in v.groups)
    for e in malla.data.edges:
        e.select = all(malla.data.vertices[i].select for i in e.vertices)
    for p in malla.data.polygons:
        p.select = all(malla.data.vertices[i].select for i in p.vertices)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    nuevo = next(o for o in bpy.data.objects if o.type == "MESH" and o is not malla and o.name.startswith("Argus_malla"))
    nuevo.name = nuevo.data.name = "Argus_parpados"
    return nuevo


def _quitar_ocultas(malla, imagen="Image_0"):
    """Piezas internas sin pintar (en la textura son el azul marino de relleno): dos
    capas bajo las hombreras de la chamarra que, con el brazo arriba, se salían por
    la espalda como manchas azules. Nunca se ven (comparado con y sin ellas desde 11
    ángulos en 6 acciones: solo cambian las manchas), así que se quitan."""
    import bmesh
    me = malla.data
    isla, miembros = _islas_de(me)
    img = bpy.data.images[imagen]
    W, H = img.size
    px = img.pixels[:]
    uv = me.uv_layers.active.data
    acc = {}
    for p in me.polygons:
        k = isla[p.vertices[0]]
        if len(miembros[k]) < 100:
            continue
        for li in p.loop_indices:
            u, v = uv[li].uv
            o = (min(H - 1, max(0, int(v * H))) * W + min(W - 1, max(0, int(u * W)))) * 4
            a_ = acc.setdefault(k, [0.0, 0.0, 0.0, 0])
            a_[0] += px[o]; a_[1] += px[o + 1]; a_[2] += px[o + 2]; a_[3] += 1
    quitar = set()
    for k, (r, g, b_, n) in acc.items():
        r, g, b_ = r / n, g / n, b_ / n
        if b_ > 1.8 * r and b_ > 1.8 * g and b_ > 0.27:
            quitar.update(miembros[k])
    if quitar:
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in quitar], context="VERTS")
        bm.to_mesh(me)
        bm.free()
    return len(quitar)


def _separar_pantalla(malla):
    """La carita de la mochila (el disco plano de enfrente, negro con las pastillas
    cian) va en su propia malla: en el sitio la dibuja un shader que mueve la mirada
    (src/components/argus/pantallaMochila.js)."""
    me = malla.data
    isla, miembros = _islas_de(me)
    P = [v.co for v in me.vertices]
    mejor = None
    for k, ids in miembros.items():
        lo, hi = _caja(P, ids)
        c, d = (lo + hi) / 2, hi - lo
        if c.y > 0.4 and abs(c.x) < 0.05 and d.y < 0.03 and 0.3 < d.x < 0.6 and (mejor is None or c.y > mejor[1]):
            mejor = (k, c.y)
    sel = set(miembros[mejor[0]])
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    malla.select_set(True)
    vl.objects.active = malla
    for v in me.vertices:
        v.select = v.index in sel
    for e in me.edges:
        e.select = all(i in sel for i in e.vertices)
    for p in me.polygons:
        p.select = all(i in sel for i in p.vertices)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    nuevo = next(o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("Argus_malla") and o is not malla)
    nuevo.name = nuevo.data.name = "Argus_pantalla"
    return len(sel)


def _poner_peso(obj, i, nuevos):
    """nuevos: {grupo: peso}. Los grupos que ya tenía el vértice se escalan para
    que todo sume 1."""
    total = min(1.0, sum(nuevos.values()))
    if total <= 0:
        return
    v = obj.data.vertices[i]
    viejos = [(g.group, g.weight) for g in v.groups]
    for gi, w in viejos:
        obj.vertex_groups[gi].add([i], w * (1 - total), "REPLACE")
    esc = total / max(1e-9, sum(nuevos.values()))
    for nombre, w in nuevos.items():
        g = obj.vertex_groups.get(nombre) or obj.vertex_groups.new(name=nombre)
        prev = 0.0
        for gg in obj.data.vertices[i].groups:
            if gg.group == g.index:
                prev = gg.weight
        g.add([i], prev + w * esc, "REPLACE")


def _quitar_pesos(obj, i):
    for g in list(obj.data.vertices[i].groups):
        obj.vertex_groups[g.group].remove([i])


def _cara_sin_cuello(malla, abajo=1.47, arriba=1.6):
    """La barbilla y los lados de la quijada acababan con la mitad de su peso en el
    cuello (la soldadura de costuras promedia la orilla de la cabeza con el collar,
    que va con el cuello): al girar la cabeza esa parte se quedaba con el cuello y
    la boca se veía torcida (Oscar). Va después de soldar y de las capas. En la pieza de la cabeza, arriba del collar
    (`arriba`) el peso del cuello pasa a la cabeza y a la quijada (en la proporción
    que ya tenía cada vértice); adentro del collar se queda (para que el cuello
    doble suave) y en medio se reparte en rampa."""
    me = malla.data
    isla, miembros = _islas_de(me)
    gi = {g.name: g.index for g in malla.vertex_groups}
    gn = {g.index: g.name for g in malla.vertex_groups}
    cuello, cabeza, quijada = gi.get("neck_04"), gi.get("head_05"), gi.get("quijada")
    if cuello is None or cabeza is None:
        return 0
    # las piezas de la cabeza (piel, dientes, boca por dentro): las que en su mayoría
    # van con la cabeza o la cara; las del cuello adentro del collar no se tocan
    DE_CABEZA = ("head", "quijada", "ojo_", "parpado", "ceja", "comisura", "labio", "antena")
    piezas = []
    for k, ids in miembros.items():
        dom = [gn[max(me.vertices[i].groups, key=lambda g: g.weight).group] for i in ids if me.vertices[i].groups]
        if dom and sum(1 for d in dom if d.startswith(DE_CABEZA)) > 0.5 * len(dom):
            piezas.extend(ids)
    n = 0
    for i in piezas:
        v = me.vertices[i]
        w = {g.group: g.weight for g in v.groups}
        wc = w.get(cuello, 0.0)
        if wc <= 0.0:
            continue
        t = _suave((v.co.z - abajo) / (arriba - abajo))
        if t <= 0.0:
            continue
        pasa = wc * t
        wh, wq = w.get(cabeza, 0.0), w.get(quijada, 0.0) if quijada is not None else 0.0
        fq = wq / (wh + wq) if wh + wq > 1e-6 else 0.0
        malla.vertex_groups[cuello].add([i], wc - pasa, "REPLACE")
        malla.vertex_groups[cabeza].add([i], wh + pasa * (1 - fq), "REPLACE")
        if quijada is not None and fq > 0:
            malla.vertex_groups[quijada].add([i], wq + pasa * fq, "REPLACE")
        n += 1
    return n


def _pesar_cara(malla, info, lids, antenas):
    P = info["P"]
    mi = info["miembros"]
    # párpados (vértices nuevos, sin pesos todavía)
    for nombre, ids in lids.items():
        grupos = [malla.vertex_groups.get(f"{nombre}_{k}") or malla.vertex_groups.new(name=f"{nombre}_{k}") for k in range(3)]
        for i, w in ids:
            for k in range(3):
                if w[k] > 0.001:
                    grupos[k].add([i], w[k], "REPLACE")
    # globos y pupilas: rígidos con su hueso
    for lado, ojo in info["ojos"].items():
        for s in (ojo["isla"], ojo["pupila"]):
            for i in mi[s]:
                _quitar_pesos(malla, i)
            g = malla.vertex_groups.get(f"ojo_{lado}") or malla.vertex_groups.new(name=f"ojo_{lado}")
            g.add(mi[s], 1.0, "REPLACE")
    # quijada: dientes y encía de abajo rígidos; el labio de abajo con caída
    rig = [i for s in info["dientes_inf"] + [info["encia_inf"]] for i in mi[s]]
    for i in rig:
        _quitar_pesos(malla, i)
    malla.vertex_groups.get("quijada") or malla.vertex_groups.new(name="quijada")
    malla.vertex_groups["quijada"].add(rig, 1.0, "REPLACE")
    for i in mi[info["cabeza"]]:
        p = P[i]
        if p.y > -0.05:
            continue
        # toda la barbilla, no solo el labio: lleno abajo de la boca y al frente
        w = _suave((1.705 - p.z) / 0.045) * _suave((-0.05 - p.y) / 0.2) * _suave((0.44 - abs(p.x - 0.03)) / 0.14)
        if p.z < 1.5:
            w *= _suave((p.z - 1.38) / 0.12)
        if w > 0.002:
            _poner_peso(malla, i, {"quijada": w})
    # comisuras y labio de arriba (sobre lo que ya pesa la quijada)
    for i in mi[info["cabeza"]]:
        p = P[i]
        if p.y > -0.35:
            continue
        ws = {}
        for nombre in ("comisura_L", "comisura_R"):
            d = (p - BOCA_PUNTOS[nombre]).length / 0.085
            w = 0.85 * _suave(1 - d)
            if w > 0.002:
                ws[nombre] = w
        c = BOCA_PUNTOS["labio_sup"]
        if p.z > 1.752 and p.y < -0.45:
            k = math.hypot((p.x - c.x) / 0.19, (p.z - 1.79) / 0.05)
            w = 0.8 * _suave(1 - k)
            if w > 0.002:
                ws["labio_sup"] = w
        if ws:
            _poner_peso(malla, i, ws)
    # cejas: caída redonda alrededor de cada punto, solo en la piel de la cabeza
    for lado, ojo in info["ojos"].items():
        r = ojo["r"]
        for i in mi[info["cabeza"]]:
            p = P[i]
            if p.y > ojo["c"].y + 0.06:
                continue
            ws = {}
            for nombre in ("int", "ext"):
                d = (p - ojo[f"ceja_{nombre}"]).length / (r * 1.25)
                w = _suave(1 - d)
                # nada del labio de arriba para abajo
                w *= _suave((p.z - (ojo["c"].z - r * 0.2)) / (r * 0.6))
                if w > 0.002:
                    ws[f"ceja_{nombre}_{lado}"] = w * 0.85
            if ws:
                _poner_peso(malla, i, ws)
    # antenas: a lo largo de la cadena; la base se queda con la cabeza
    for lado, a in antenas.items():
        for i in a["tubo"]:
            t = a["dist"][i] / a["dmax"]
            w2 = _suave((t - 0.28) / 0.1) * (1 - _suave((t - 0.61) / 0.1))
            w3 = _suave((t - 0.61) / 0.1)
            w1 = (1 - _suave((t - 0.28) / 0.1)) * _suave(t / 0.1)
            _quitar_pesos(malla, i)
            hd = max(0.0, 1 - (w1 + w2 + w3))
            for nombre, w in ((f"antena_{lado}_1", w1), (f"antena_{lado}_2", w2), (f"antena_{lado}_3", w3), ("head_05", hd)):
                if w > 0.001:
                    g = malla.vertex_groups.get(nombre) or malla.vertex_groups.new(name=nombre)
                    g.add([i], w, "REPLACE")


# ---------------------------------------------------------------- revisar

def revisar_rehorneado():
    """Compara vértice por vértice el Idle rehorneado contra el GLB original."""
    import numpy as np
    sc = bpy.context.scene
    arm = bpy.data.objects["Argus"]
    malla = bpy.data.objects["Argus_malla"]
    arm.animation_data.action = bpy.data.actions["IdleOriginal"]
    nuevos = []
    cuadros = list(range(0, int(bpy.data.actions["IdleOriginal"].frame_end) + 1, 15))
    for f in cuadros:
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        m = malla.evaluated_get(dg).to_mesh()
        nuevos.append(np.array([list(malla.matrix_world @ v.co) for v in m.vertices]))
        malla.evaluated_get(dg).to_mesh_clear()
    # el original, en otra escena
    bpy.ops.scene.new(type="EMPTY")
    sc2 = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=GLB)
    vieja = bpy.data.objects["Object_68.001"] if "Object_68.001" in bpy.data.objects else next(o for o in sc2.objects if o.type == "MESH" and len(o.data.vertices) > 1000)
    fps_viejo = sc2.render.fps / sc2.render.fps_base
    errores = []
    for f, P in zip(cuadros, nuevos):
        t = f / FPS * fps_viejo
        sc2.frame_set(int(t), subframe=t - int(t))
        dg = bpy.context.evaluated_depsgraph_get()
        m = vieja.evaluated_get(dg).to_mesh()
        Q = np.array([list(vieja.matrix_world @ v.co) for v in m.vertices])
        vieja.evaluated_get(dg).to_mesh_clear()
        d = np.linalg.norm(P - Q, axis=1)
        errores.append((f, float(d.max()), float(np.percentile(d, 99)), float(d.mean())))
    bpy.ops.scene.delete()
    return errores


def _camara_fotos():
    sc = bpy.context.scene
    cam = bpy.data.objects.get("cam_fotos")
    if cam is None:
        cd = bpy.data.cameras.new("cam_fotos")
        cd.type = "ORTHO"
        cam = bpy.data.objects.new("cam_fotos", cd)
        sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "TEXTURE"
    sh.show_object_outline = True
    sh.object_outline_color = (0, 0, 0)
    sh.show_cavity = False
    sh.show_specular_highlight = False
    sc.view_settings.view_transform = "Standard"
    sc.world = sc.world or bpy.data.worlds.new("w")
    sc.world.color = (0.02, 0.12, 0.55)
    for m in bpy.data.materials:
        if m.node_tree:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and n.image.name == "Image_0":
                    m.node_tree.nodes.active = n
    return cam


def foto(ruta, target=(0.03, -0.4, 1.87), d=(0.35, -1, 0.12), escala=0.85, res=(700, 700)):
    sc = bpy.context.scene
    cam = _camara_fotos()
    t, d = Vector(target), Vector(d).normalized()
    cam.location = t + d * 6
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam.data.ortho_scale = escala
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)


def posar_cara(arm, v):
    """v: sup/inf (0..1), sup_int/sup_ext (extra adentro/afuera), cejas (m, +arriba),
    ceja_int, ceja_L/ceja_R, quijada (grados), mirada (yaw, pitch)."""
    cara_info = json.loads(arm["cara"])
    pb = arm.pose.bones
    for b in pb:
        b.location = (0, 0, 0)
        b.rotation_quaternion = (1, 0, 0, 0)
    for lado in ("L", "R"):
        ci = cara_info["cierres"][lado]
        # hueso 0 = gamma chica: afuera en el ojo izquierdo, adentro en el derecho
        adentro = 2 if lado == "L" else 0
        for cual in ("sup", "inf"):
            base = v.get(cual, 0.0)
            for k in range(3):
                extra = 0.0
                if cual == "sup":
                    w_in = 1.0 if k == adentro else (0.5 if k == 1 else 0.0)
                    extra = v.get("sup_int", 0.0) * w_in + v.get("sup_ext", 0.0) * (1 - w_in)
                c = max(0.0, min(1.0, base + extra))
                pb[f"parpado_{cual}_{lado}_{k}"].rotation_quaternion = Quaternion((1, 0, 0), math.radians(ci[cual][k] * c))
        ce = v.get("cejas", 0.0)
        pb[f"ceja_int_{lado}"].location = (0, ce + v.get("ceja_int", 0.0) + v.get(f"ceja_{lado}", 0.0), 0)
        pb[f"ceja_ext_{lado}"].location = (0, ce + v.get(f"ceja_{lado}", 0.0), 0)
        yaw, pitch = v.get("mirada", (0.0, 0.0))
        pb[f"ojo_{lado}"].rotation_quaternion = Quaternion((0, 0, 1), math.radians(yaw)) @ Quaternion((1, 0, 0), math.radians(pitch))
    pb["quijada"].rotation_quaternion = Quaternion((1, 0, 0), math.radians(v.get("quijada", 0.0)))


def fotos_cara(carpeta):
    os.makedirs(carpeta, exist_ok=True)
    arm = bpy.data.objects["Argus"]
    arm.animation_data.action = None
    poses = {
        "00_reposo": {},
        "01_parpadeo": {"sup": 1, "inf": 1},
        "02_medio": {"sup": 0.5},
        "03_aburrido": {"sup": 0.36},
        "04_furia": {"sup": 0.15, "sup_int": 0.25, "sup_ext": -0.15, "cejas": -0.02, "ceja_int": -0.025},
        "05_triste": {"sup": 0.1, "sup_ext": 0.25, "cejas": 0.02, "ceja_int": 0.03},
        "06_feliz": {"inf": 0.4, "cejas": 0.02},
        "07_carcajada": {"sup": 0.3, "inf": 0.55, "quijada": 20},
        "08_sospecha": {"sup": 0.28, "ceja_L": 0.05, "ceja_R": -0.02},
        "09_casi": {"sup": 0.9, "inf": 0.9},
    }
    for nombre, v in poses.items():
        posar_cara(arm, v)
        bpy.context.view_layer.update()
        foto(os.path.join(carpeta, nombre + ".png"))
    posar_cara(arm, {})


def esfera_de_muestra():
    """Una esfera de color en el hueso `esfera`, solo para ver las acciones en Blender
    (no se exporta: en el sitio la pone ZoidianNPC)."""
    import acciones_lista as AL
    arm = bpy.data.objects["Argus"]
    ob = bpy.data.objects.get("Esfera_muestra")
    if ob is None:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=AL.ESFERA_R, segments=24, ring_count=12)
        ob = bpy.context.active_object
        ob.name = "Esfera_muestra"
        m = bpy.data.materials.new("Esfera_muestra")
        m.diffuse_color = (0.2, 1.0, 0.9, 1)
        ob.data.materials.append(m)
    ad = arm.animation_data
    accion = ad.action
    ad.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    ob.parent = arm
    ob.parent_type = "BONE"
    ob.parent_bone = "esfera"
    ob.matrix_world = Matrix.Translation(arm.data.bones["esfera"].head_local)
    ad.action = accion
    return ob


def fotos_accion(nombre, carpeta, cada=10, vista="cuerpo"):
    """Cuadros de una acción (para revisar) en carpeta/nombre_NNN.png."""
    os.makedirs(carpeta, exist_ok=True)
    arm = bpy.data.objects["Argus"]
    arm.animation_data.action = bpy.data.actions[nombre]
    sc = bpy.context.scene
    fin = int(bpy.data.actions[nombre].frame_end)
    rutas = []
    for f in list(range(0, fin + 1, cada)):
        sc.frame_set(f)
        r = os.path.join(carpeta, f"{nombre}_{f:03d}.png")
        if vista == "cuerpo":
            foto(r, target=(0, -0.2, 1.2), d=(0.45, -1, 0.12), escala=2.8, res=(360, 360))
        else:
            foto(r, target=(0.03, -0.4, 1.8), d=(0.35, -1, 0.1), escala=1.2, res=(360, 360))
        rutas.append(r)
    return rutas


BRAZO_PREF = ("lower_arm", "hand", "thumb", "index", "middle", "ring")
CUERPO_PREF = ("head", "neck", "chest", "spine", "hips", "upper_leg", "lower_leg", "quijada", "ojo_", "parpado", "ceja")


def medir_traspasos(nombres, cada=2, umbral=0.006):
    """Cuánto se meten antebrazos, manos y dedos en la cabeza y el cuerpo, cuadro
    por cuadro (con la malla deformada de verdad). Un vértice está adentro si queda
    del lado de atrás de la cara más cercana del cuerpo; lo que ya está adentro en
    reposo no cuenta (contactos de la malla o caras al revés)."""
    import numpy as np
    from mathutils.bvhtree import BVHTree
    sc = bpy.context.scene
    arm = bpy.data.objects["Argus"]
    malla = bpy.data.objects["Argus_malla"]
    me = malla.data
    gn = {g.index: g.name for g in malla.vertex_groups}
    brazo = {"L": [], "R": []}
    cuerpo = set()
    for v in me.vertices:
        if not v.groups:
            continue
        n = gn[max(v.groups, key=lambda g: g.weight).group]
        lado = "L" if ".L_" in n else ("R" if ".R_" in n else None)
        if lado and n.startswith(BRAZO_PREF):
            brazo[lado].append(v.index)
        elif n.startswith(CUERPO_PREF):
            cuerpo.add(v.index)
    sel = [p.index for p in me.polygons if all(i in cuerpo for i in p.vertices)]
    caras = [list(me.polygons[i].vertices) for i in sel]

    def posiciones():
        """Posiciones deformadas y la normal de cada cara del cuerpo, sacada de las
        normales del modelo (las de la malla, que apuntan afuera; el orden de los
        vértices de las caras de este GLB no es confiable)."""
        dg = bpy.context.evaluated_depsgraph_get()
        m = malla.evaluated_get(dg).to_mesh()
        n = len(m.vertices)
        co = np.empty(n * 3, dtype=np.float32)
        m.vertices.foreach_get("co", co)
        cn = np.empty(len(m.loops) * 3, dtype=np.float32)
        m.corner_normals.foreach_get("vector", cn)
        cn = cn.reshape(-1, 3)
        ls = np.empty(len(m.polygons), dtype=np.int32)
        m.polygons.foreach_get("loop_start", ls)
        sumas = np.add.reduceat(cn, ls)
        malla.evaluated_get(dg).to_mesh_clear()
        P = [Vector(x) for x in co.reshape(-1, 3)]
        N = sumas[sel]
        N = N / np.maximum(1e-9, np.linalg.norm(N, axis=1))[:, None]
        return P, N

    # pieza (isla) de cada cara del cuerpo: el conteo de cruces se hace por pieza,
    # así una capa encima de otra no se cancela
    isla_v, _ = _islas_de(me)
    isla_cara = [isla_v[c[0]] for c in caras]
    RAYOS = (Vector((1, 0.013, 0.007)).normalized(), Vector((0.011, 1, 0.017)).normalized(), Vector((0.009, 0.014, 1)).normalized())

    def cruces(bvh, p, d):
        cuenta = {}
        o = p.copy()
        for _ in range(16):
            hit = bvh.ray_cast(o, d, 10.0)
            if hit[0] is None:
                break
            k = isla_cara[hit[2]]
            cuenta[k] = cuenta.get(k, 0) + 1
            o = hit[0] + d * 1e-4
        return {k for k, c in cuenta.items() if c % 2 == 1}

    def adentro(PN):
        P, N = PN
        bvh = BVHTree.FromPolygons(P, caras, all_triangles=False)
        out = {}
        for lado, ids in brazo.items():
            d = {}
            for i in ids:
                loc, _, k, dist = bvh.find_nearest(P[i])
                if loc is None or (P[i] - loc).dot(Vector(N[k])) >= 0:
                    continue
                # confirmar: adentro de la misma pieza en al menos dos de tres rayos
                votos = {}
                for r in RAYOS:
                    for s in cruces(bvh, P[i], r):
                        votos[s] = votos.get(s, 0) + 1
                if any(v >= 2 for v in votos.values()):
                    d[i] = dist
            out[lado] = d
        return out

    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
    sc.frame_set(0)
    base = adentro(posiciones())
    resultado = {}
    for nombre in nombres:
        accion = bpy.data.actions[nombre]
        arm.animation_data.action = accion
        peor = {"L": (0.0, None, 0), "R": (0.0, None, 0)}
        malos = []
        for f in range(0, int(accion.frame_end) + 1, cada):
            sc.frame_set(f)
            ad = adentro(posiciones())
            for lado in ("L", "R"):
                vals = [dist for i, dist in ad[lado].items() if i not in base[lado] and dist > umbral]
                if vals:
                    mx = max(vals)
                    malos.append((f, lado, round(mx, 3), len(vals)))
                    if mx > peor[lado][0]:
                        peor[lado] = (round(mx, 3), f, len(vals))
        resultado[nombre] = {"peor": peor, "cuadros": malos}
    return resultado


DESGARRE_PREF = ("shoulder", "upper_arm", "lower_arm", "antebrazo_giro", "chest", "spine", "neck", "hips")


def medir_desgarres(nombres, cada=2, umbral=0.025):
    """La malla de Sketchfab es de piezas sueltas (manga, hombrera, torso...): donde dos
    piezas se tocan en reposo y se separan al moverse, se abre un hueco y se ve el
    fondo. Se toman los pares de vértices de piezas distintas a menos de 1.2 cm en
    reposo y se mide cuánto se separan cuadro por cuadro."""
    import numpy as np
    from mathutils.kdtree import KDTree
    sc = bpy.context.scene
    arm = bpy.data.objects["Argus"]
    malla = bpy.data.objects["Argus_malla"]
    me = malla.data
    isla, _ = _islas_de(me)
    gn = {g.index: g.name for g in malla.vertex_groups}
    # solo las orillas abiertas de cada pieza (aristas con una sola cara): ahí se abre
    # el hueco; una pieza que se aleja de otra por su superficie no deja ver el fondo
    caras_arista = {}
    for p in me.polygons:
        for k in p.edge_keys:
            caras_arista[k] = caras_arista.get(k, 0) + 1
    orilla = set()
    for (a_, b_), n in caras_arista.items():
        if n == 1:
            orilla.add(a_)
            orilla.add(b_)
    region = [v.index for v in me.vertices if v.groups and gn[max(v.groups, key=lambda g: g.weight).group].startswith(DESGARRE_PREF)]
    cand = [i for i in region if i in orilla]
    kd = KDTree(len(region))
    for k, i in enumerate(region):
        kd.insert(me.vertices[i].co, k)
    kd.balance()
    pares = set()
    for i in cand:
        # el vecino más cercano de otra pieza
        mejor = None
        for _, k, d in kd.find_range(me.vertices[i].co, 0.012):
            j = region[k]
            if isla[j] != isla[i] and (mejor is None or d < mejor[1]):
                mejor = (j, d)
        if mejor:
            pares.add((i, mejor[0]))
    pares = np.array(sorted(pares), dtype=np.int64)
    rest = np.array([list(v.co) for v in me.vertices])
    d0 = np.linalg.norm(rest[pares[:, 0]] - rest[pares[:, 1]], axis=1)

    def posiciones():
        dg = bpy.context.evaluated_depsgraph_get()
        m = malla.evaluated_get(dg).to_mesh()
        co = np.empty(len(m.vertices) * 3, dtype=np.float64)
        m.vertices.foreach_get("co", co)
        malla.evaluated_get(dg).to_mesh_clear()
        return co.reshape(-1, 3)
    out = {}
    for nombre in nombres:
        accion = bpy.data.actions[nombre]
        arm.animation_data.action = accion
        peor, en, malos = 0.0, None, 0
        for f in range(0, int(accion.frame_end) + 1, cada):
            sc.frame_set(f)
            P = posiciones()
            crece = np.linalg.norm(P[pares[:, 0]] - P[pares[:, 1]], axis=1) - d0
            mx = float(crece.max())
            if mx > umbral:
                malos += 1
            if mx > peor:
                peor, en = mx, f
        out[nombre] = {"peor_cm": round(peor * 100, 1), "cuadro": en, "cuadros_malos": malos, "pares": len(pares)}
    return out


def animar():
    import acciones_lista as AL
    arm = bpy.data.objects["Argus"]
    malla = bpy.data.objects["Argus_malla"]
    # la pasada de IK evalúa cuadro por cuadro: sin deformar la malla va mucho más rápido
    mod = malla.modifiers["Argus"]
    mod.show_viewport = False
    try:
        return AL.animar(arm, malla)
    finally:
        mod.show_viewport = True


def exportar(ruta=SALIDA, comprimir=True):
    """Todas las acciones, cada una su clip. Después, Draco y menos claves."""
    arm = bpy.data.objects["Argus"]
    m = bpy.data.objects.get("Esfera_muestra")
    if m:
        bpy.data.objects.remove(m)
    arm.animation_data.action = bpy.data.actions["Idle"]
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(o.name in ("Argus", "Argus_malla", "Argus_parpados", "Argus_pantalla"))
    vl.objects.active = arm
    # la acción del original solo sirve de referencia
    viejo = bpy.data.actions.get("IdleOriginal")
    if viejo:
        viejo.use_fake_user = False
        bpy.data.actions.remove(viejo)
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format="GLB", use_selection=True,
        export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_step=1, export_frame_range=False,
        export_anim_slide_to_zero=True, export_optimize_animation_size=False,
        export_reset_pose_bones=True, export_rest_position_armature=True,
        export_skins=True, export_def_bones=False, export_leaf_bone=False,
        export_morph=False, export_materials="EXPORT", export_image_format="AUTO",
        export_cameras=False, export_lights=False, export_extras=False,
        export_yup=True, export_apply=False, export_texcoords=True, export_normals=True,
        export_tangents=True,
    )
    if comprimir:
        import subprocess
        npx = "npx.cmd" if os.name == "nt" else "npx"
        subprocess.run([npx, "gltf-transform", "resample", ruta, ruta, "--tolerance", "0.0004"], cwd=REPO, check=True)
        subprocess.run([npx, "gltf-transform", "draco", ruta, ruta], cwd=REPO, check=True)
    return ruta


# ---------------------------------------------------------------- guardar

def guardar():
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


def main():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["todo"]
    cmd = argv[0]
    if cmd in ("todo", "limpiar"):
        limpiar()
        guardar()
    if cmd in ("todo", "cara"):
        if cmd == "cara":
            limpiar()
        _, cierres = cara()
        print("CIERRES", json.dumps(cierres))
        guardar()
    if cmd in ("todo", "animar"):
        if cmd == "animar":
            bpy.ops.wm.open_mainfile(filepath=BLEND)
        animar()
        guardar()
    if cmd in ("todo", "exportar"):
        if cmd == "exportar":
            bpy.ops.wm.open_mainfile(filepath=BLEND)
        print("GLB", exportar())
    if cmd == "traspasos":
        bpy.ops.wm.open_mainfile(filepath=BLEND)
        import acciones_lista as AL
        nombres = argv[1].split(",") if len(argv) > 1 and argv[1] != "todas" else list(AL.ACCIONES)
        r = medir_traspasos(nombres, cada=int(argv[2]) if len(argv) > 2 else 2)
        for n, d in r.items():
            print("TRASPASO", n, json.dumps(d["peor"]), "cuadros:", len(d["cuadros"]), json.dumps(d["cuadros"][:40]))
    if cmd == "desgarres":
        bpy.ops.wm.open_mainfile(filepath=BLEND)
        import acciones_lista as AL
        nombres = argv[1].split(",") if len(argv) > 1 and argv[1] != "todas" else list(AL.ACCIONES)
        for n, d in medir_desgarres(nombres, cada=int(argv[2]) if len(argv) > 2 else 2).items():
            print("DESGARRE", n, json.dumps(d))
    if cmd == "capas":
        bpy.ops.wm.open_mainfile(filepath=BLEND)
        import acciones_lista as AL
        nombres = argv[1].split(",") if len(argv) > 1 and argv[1] != "todas" else list(AL.ACCIONES)
        for n, d in medir_capas(nombres, cada=int(argv[2]) if len(argv) > 2 else 2).items():
            print("CAPA", n, json.dumps(d))
    if cmd == "fotos_accion":
        bpy.ops.wm.open_mainfile(filepath=BLEND)
        esfera_de_muestra()
        for nombre in argv[2].split(","):
            fotos_accion(nombre, argv[1], cada=int(argv[3]) if len(argv) > 3 else 10, vista=argv[4] if len(argv) > 4 else "cuerpo")
    if cmd == "fotos_cara":
        bpy.ops.wm.open_mainfile(filepath=BLEND)
        fotos_cara(argv[1])
    if cmd == "revisar":
        bpy.ops.wm.open_mainfile(filepath=BLEND)
        print("ERRORES", json.dumps(revisar_rehorneado()))


if __name__ == "__main__":
    main()
