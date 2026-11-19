"""
Corrige el pie izquierdo (el de atrás) del idle de Skulley (root|root|Iddle en Character/SkulleyRad.blend).

El idle traía la rodilla muy adelante con el talón casi en el piso: el tobillo cerraba a 57° (espinilla–pie;
en reposo 82°, el caminar nunca baja de 73°) y botas y tenis, que doblan en el tobillo, se aplastaban
(Oscar, 2026-11-18). Aquí el talón sube hasta que el tobillo queda en 'objetivo', con la bola del pie 'atras'
cm más atrás (fija en el piso todo el ciclo) y la rodilla por IK en su mismo plano: el muslo y la espinilla
giran lo mínimo y los huesos de giro siguen al pie. Al girar el pie sobre la bola, la planta bajo ella baja,
así que en cada cuadro se busca la altura de la bola y el doblez de los dedos con los que ni el pie, ni las
botas, ni los tenis bajan de su altura de pie (medido con todos sus vértices) y flotan lo menos posible
(el doblez se suaviza en el ciclo). Quedó así: tobillo a 75° todo el ciclo, botas y tenis tocando el piso
(0.01 cm) y el pie desnudo 0.4 cm arriba (sus dedos son más cortos: no pueden tocar los tres).

Se aplicó una vez, con corregir() (objetivo=75, atras=5) sobre la acción y una copia de la pierna izquierda
de antes en «root|root|Iddle (pierna izquierda antes)». Después se exporta con exportar_animaciones.py
(public/animaciones/idle.glb, solo las pistas que cambian). No lo vuelvas a correr sobre el idle ya corregido.
    ns = {}; exec(open(r"<esta ruta>", encoding="utf-8").read(), ns); ns["corregir"](destino="Iddle_prueba")
"""
import bpy, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from bpy_extras import anim_utils

ARM = bpy.data.objects["root"]
LADO = "l"
CADENA = ["thigh_stretch", "leg_stretch", "foot", "toes_01", "leg_twist", "leg_twist_2"]
PISO_MALLAS = ("Egg_Foot_L", "Botas", "Tenis")
ARRIBA = Vector((0, 0, 1))


def _about(R, c):
    return Matrix.Translation(c) @ R @ Matrix.Translation(-c)


def _ik(H, A, K0, L1, L2):
    D = A - H; dist = D.length; u = D / dist
    if dist > L1 + L2 - 1e-5:
        return None
    a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist); h = math.sqrt(max(L1 * L1 - a * a, 0))
    pole = K0 - H; pole = (pole - pole.dot(u) * u).normalized()
    return H + u * a + pole * h


def _ang(a, b):
    return math.degrees(a.angle(b))


def _giro_y(m_padre, m_hijo):
    """Giro alrededor del eje Y del padre (swing-twist) de la orientación del hijo relativa al padre."""
    q = (m_padre.to_quaternion().inverted() @ m_hijo.to_quaternion()).normalized()
    return 2 * math.atan2(q.y, q.w)


def resolver(H, K, A, B, objetivo, atras, alza):
    """Tobillo, rodilla y bola nuevos: la bola atrás y arriba lo pedido, el talón lo justo para el objetivo."""
    L1 = (K - H).length; L2 = (A - K).length; LF = (A - B).length
    hd = A - B; hd.z = 0; hd.normalize()
    B2 = B + hd * atras + ARRIBA * alza

    def en(p):
        A2 = B2 + LF * (hd * math.cos(p) + ARRIBA * math.sin(p))
        return A2, _ik(H, A2, K, L1, L2)
    lo, hi = 0.0, math.radians(85)
    for _ in range(50):
        mid = 0.5 * (lo + hi)
        A2, K2 = en(mid)
        if K2 is None or _ang(K2 - A2, B2 - A2) < objetivo:
            lo = mid
        else:
            hi = mid
    A2, K2 = en(hi)
    return A2, K2, B2, _ang(K2 - A2, B2 - A2)


def poner_cuadro(P, nb, M, objetivo, atras, alza, doblez):
    """Pone la pierna izquierda del cuadro (M: matrices originales) y regresa lo que resolvió."""
    H = M["thigh_stretch"].translation; K = M["leg_stretch"].translation
    A = M["foot"].translation; B = M["toes_01"].translation
    A2, K2, B2, a2 = resolver(H, K, A, B, objetivo, atras, alza)
    R1 = (K - H).normalized().rotation_difference((K2 - H).normalized()).to_matrix().to_4x4()
    thigh = _about(R1, H) @ M["thigh_stretch"]
    shin1 = _about(R1, H) @ M["leg_stretch"]
    d1 = (R1.to_3x3() @ (A - K)).normalized(); d2 = (A2 - K2).normalized()
    shin = _about(d1.rotation_difference(d2).to_matrix().to_4x4(), K2) @ shin1
    Rf = (B - A).normalized().rotation_difference((B2 - A2).normalized()).to_matrix().to_4x4()
    foot = Matrix.Translation(A2) @ Rf @ Matrix.Translation(-A) @ M["foot"]
    # los dedos: misma orientación que tenían, llevados a la bola nueva; si la bola subió, giran para que su
    # punta regrese a su altura, y luego se doblan 'doblez' más hacia el piso
    toes = Matrix.Translation(B2 - B) @ M["toes_01"]
    largo = P[nb["toes_01"]].bone.length
    d = toes.to_3x3() @ Vector((0, largo, 0))
    d_new = Vector((d.x, d.y, d.z - alza)); d_new = d_new.normalized() * d.length
    toes = _about(d.normalized().rotation_difference(d_new.normalized()).to_matrix().to_4x4(), B2) @ toes
    if doblez:
        # positivo dobla la punta hacia el piso, negativo la levanta
        eje = d_new.cross(ARRIBA).normalized()
        if (Quaternion(eje, 0.1) @ d_new).z > d_new.z:
            eje = -eje
        q = Quaternion(eje, doblez)
        toes = _about(q.to_matrix().to_4x4(), B2) @ toes
    dgiro = _giro_y(shin, foot) - _giro_y(M["leg_stretch"], M["foot"])
    dgiro = (dgiro + math.pi) % (2 * math.pi) - math.pi
    for k, m in (("thigh_stretch", thigh), ("leg_stretch", shin), ("foot", foot), ("toes_01", toes)):
        P[nb[k]].matrix = m
        bpy.context.view_layer.update()
    # los huesos de giro de la espinilla siguen el giro del pie alrededor de ella (completo y la mitad)
    eje = (shin.to_3x3() @ Vector((0, 1, 0))).normalized()
    for k, peso in (("leg_twist", 1.0), ("leg_twist_2", 0.5)):
        pb = P[nb[k]]; m = pb.matrix.copy()
        pb.matrix = _about(Quaternion(eje, peso * dgiro).to_matrix().to_4x4(), m.translation) @ m
        bpy.context.view_layer.update()
    return A2, K2, B2, a2, dgiro


def _min_izq(o, dg, inv):
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    co = np.empty(len(me.vertices) * 3, dtype=np.float64); me.vertices.foreach_get("co", co)
    oe.to_mesh_clear()
    m = np.array(inv @ o.matrix_world); co = co.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3]
    return float(co[co[:, 0] > 0, 2].min())


def piso_reposo():
    """Lo más bajo del pie izquierdo de cada malla con Skulley de pie, en reposo: su piso."""
    arm = ARM.data; antes = arm.pose_position; arm.pose_position = "REST"
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); inv = ARM.matrix_world.inverted()
    r = {n: _min_izq(bpy.data.objects[n], dg, inv) for n in PISO_MALLAS if n in bpy.data.objects}
    arm.pose_position = antes; bpy.context.view_layer.update()
    return r


def holguras(piso0):
    dg = bpy.context.evaluated_depsgraph_get(); inv = ARM.matrix_world.inverted()
    return {n: _min_izq(bpy.data.objects[n], dg, inv) - piso0[n] for n in piso0}


def apoyar(P, nb, M, objetivo, atras, piso0, doblez, alza=0.0):
    """Altura de la bola con la que la malla más baja toca su piso (las demás quedan arriba)."""
    for _ in range(6):
        poner_cuadro(P, nb, M, objetivo, atras, alza, doblez)
        h = holguras(piso0)
        m = min(h.values())
        if abs(m) < 0.003:
            break
        alza -= m
    return alza, h


def corregir(origen="root|root|Iddle", destino=None, objetivo=75.0, atras=5.0, piso=True, doblez_rango=(-14.0, 4.0), suavizar=3):
    src = bpy.data.actions[origen]
    act = src.copy() if destino else src
    if destino:
        act.name = destino
    ad = ARM.animation_data; ad.use_nla = False; ad.action = act; ad.action_slot = act.slots[0]
    cb = anim_utils.action_get_channelbag_for_slot(act, act.slots[0])
    P = ARM.pose.bones
    nb = {k: f"{k}.{LADO}" for k in CADENA}
    f0, f1 = map(int, act.frame_range)
    sc = bpy.context.scene
    ocultos = {n: bpy.data.objects[n].hide_get() for n in PISO_MALLAS if n in bpy.data.objects}
    for n in ocultos:
        bpy.data.objects[n].hide_set(False)
    # mientras resuelve, solo se evalúan el esqueleto y las mallas del piso (cada pose recalculaba todas las prendas)
    apagados = [o for o in bpy.data.objects if o.type == "MESH" and o.name not in PISO_MALLAS and not o.hide_viewport
                and any(m.type == "ARMATURE" for m in o.modifiers)]
    for o in apagados:
        o.hide_viewport = True
    piso0 = piso_reposo() if piso else None
    gr = (math.sqrt(5) - 1) / 2
    cuadros = list(range(f0, f1 + 1))
    # 1) por cuadro, el doblez de los dedos que deja todo lo más cerca del piso (lo más que flota la que más flota)
    doblez = {}
    for f in cuadros:
        if not piso0:
            doblez[f] = 0.0
            continue
        sc.frame_set(f)
        M = {k: P[n].matrix.copy() for k, n in nb.items()}
        cache = {}
        def costo(t):
            if t not in cache:
                cache[t] = max(apoyar(P, nb, M, objetivo, atras, piso0, t)[1].values())
            return cache[t]
        lo, hi = math.radians(doblez_rango[0]), math.radians(doblez_rango[1])
        c, d = hi - gr * (hi - lo), lo + gr * (hi - lo)
        for _ in range(9):
            if costo(c) < costo(d):
                hi = d
            else:
                lo = c
            c, d = hi - gr * (hi - lo), lo + gr * (hi - lo)
        doblez[f] = min(cache, key=cache.get)
    # 2) suavizado en el ciclo (el último cuadro es el primero), para que los dedos no tiemblen
    n_ciclo = len(cuadros) - 1
    base = [doblez[f] for f in cuadros[:-1]]
    suave = [sum(base[(i + k) % n_ciclo] for k in range(-suavizar, suavizar + 1)) / (2 * suavizar + 1) for i in range(n_ciclo)]
    doblez = {f: suave[i % n_ciclo] for i, f in enumerate(cuadros)}
    # 3) con ese doblez, la altura de la bola y la pose final de cada cuadro
    nuevos = {}; info = []
    for f in cuadros:
        sc.frame_set(f)
        M = {k: P[n].matrix.copy() for k, n in nb.items()}
        A = M["foot"].translation; B = M["toes_01"].translation; K = M["leg_stretch"].translation
        t = doblez[f]
        alza, h = apoyar(P, nb, M, objetivo, atras, piso0, t) if piso0 else (0.0, {})
        A2, K2, B2, a2, dgiro = poner_cuadro(P, nb, M, objetivo, atras, alza, t)
        nuevos[f] = {k: (P[n].location.copy(), P[n].rotation_quaternion.copy()) for k, n in nb.items()}
        info.append(dict(f=f, tobillo=(round(_ang(K - A, B - A), 1), round(a2, 1)), rodilla_cm=round((K2 - K).length, 1),
                         giro=round(math.degrees(dgiro), 2), alza=round(alza, 2), doblez=round(math.degrees(t), 1),
                         holgura={n: round(v, 3) for n, v in h.items()}))
    # una llave por cuadro (lineales, como las horneadas), con el cuaternión continuo
    for k, n in nb.items():
        prev = None
        for f in range(f0, f1 + 1):
            loc, q = nuevos[f][k]
            if prev is not None and q.dot(prev) < 0:
                q = -q
            prev = q
            for path, vals in (("location", loc), ("rotation_quaternion", q)):
                for i, v in enumerate(vals):
                    fc = cb.fcurves.find(f'pose.bones["{n}"].{path}', index=i)
                    kp = next(kp for kp in fc.keyframe_points if abs(kp.co[0] - f) < 1e-4)
                    dv = v - kp.co[1]
                    kp.co[1] = v; kp.handle_left[1] += dv; kp.handle_right[1] += dv
        for path, nn in (("location", 3), ("rotation_quaternion", 4)):
            for i in range(nn):
                cb.fcurves.find(f'pose.bones["{n}"].{path}', index=i).update()
    for n, hdn in ocultos.items():
        bpy.data.objects[n].hide_set(hdn)
    for o in apagados:
        o.hide_viewport = False
    return act, info
