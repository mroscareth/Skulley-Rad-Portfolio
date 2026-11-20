"""
Las acciones de Argus (las escribe el Autor de acciones_argus.py).

Giros en ejes del mundo en reposo: +IZQ = agacharse hacia el frente, -IZQ =
echarse para atrás; +ARRIBA = voltear a su izquierda; +FRENTE = ladearse a su
derecha. Hombro izquierdo arriba = +FRENTE, el derecho = -FRENTE.
La quijada abre con giro de +IZQ (quijada()).
La cara (párpados, cejas, ojos) y las antenas no van en los clips: las pone el sitio.
"""
import bpy
import math
from mathutils import Vector, Matrix, Quaternion
from acciones_argus import (Autor, IZQ, ATRAS, ARRIBA, FRENTE, BRAZO, PIERNA, DEDOS, FPS, q, _suave, forma_cuerpo)

ACCIONES = {
    "Idle": dict(cuadros=240, ciclo=True),
    "IdleMirar": dict(cuadros=165, ciclo=False),
    "IdleImpaciente": dict(cuadros=180, ciclo=False),
    "IdleComer": dict(cuadros=300, ciclo=False),
    "Saludo": dict(cuadros=80, ciclo=False),
    "Risa": dict(cuadros=96, ciclo=False),
    "Impresionado": dict(cuadros=78, ciclo=False),
    "Hablar": dict(cuadros=120, ciclo=True),
    "Empujon": dict(cuadros=26, ciclo=False),
    "Trato": dict(cuadros=84, ciclo=False),
    "Senalar": dict(cuadros=66, ciclo=False),
    "Presumir": dict(cuadros=72, ciclo=False),
    "Encogerse": dict(cuadros=54, ciclo=False),
    "Celebrar": dict(cuadros=54, ciclo=False),
}

# Del idle de comer (lo usa ZoidianNPC: la cara de cada momento)
COMER = dict(aparece=38, juega=(78, 96), lanza=124, muerde=138, mastica=(140, 176), trago=184, palmadas=(200, 214), eructo=248)
ESFERA_R = 0.09
BOCA = Vector((0.02, -0.53, 1.70))
I = Quaternion()


def onda(f0, f1, paso, fn):
    return [(f, fn(f)) for f in range(f0, f1 + 1, paso)]


def mano_q(y, palma):
    """Giro de una mano en el mundo: su +Y (hacia los dedos) en y y la palma (su -Z)
    viendo hacia `palma`."""
    y = Vector(y).normalized()
    z = -Vector(palma)
    z = (z - z.dot(y) * y).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed().to_quaternion()


def dedo_local(a, lado, dedo):
    """Hacia dónde apunta un dedo en el espacio de su mano (de la base a la punta)."""
    B = a.arm.data.bones
    h = DEDOS[lado][dedo]
    m = B[BRAZO[lado][3]].matrix_local.to_3x3().inverted()
    return (m @ (B[h[2]].head_local - B[h[0]].head_local)).normalized()


def mano_q_local(a, lado, loc_a, mundo_a, loc_b, mundo_b):
    """Giro de la mano que lleva su vector local loc_a a mundo_a (y loc_b lo más cerca
    posible de mundo_b)."""
    def base(u, v):
        u = Vector(u).normalized()
        v = Vector(v)
        v = (v - v.dot(u) * u).normalized()
        return Matrix((u, v, u.cross(v))).transposed()
    return (base(mundo_a, mundo_b) @ base(loc_a, loc_b).transposed()).to_quaternion()


def en_cabeza(arm, p):
    """Punto p (reposo) pegado a la cabeza: f(ev) da su lugar posado."""
    loc = arm.data.bones["head_05"].matrix_local.inverted() @ p
    return lambda ev: ev["head_05"] @ loc


def piernas(a, f0=None, f1=None):
    for lado in ("L", "R"):
        a.ik_pierna(lado, 0 if f0 is None else f0, a.cuadros if f1 is None else f1)


def quijada(a, claves):
    """claves: [(cuadro, grados de abierta, ...interp)]."""
    # la quijada apunta a la barbilla con su X a la izquierda de Argus: +IZQ abre
    a.rot("quijada", [(c[0], [(IZQ, c[1])], *c[2:]) for c in claves])


def accion_idle(a, sup):
    L = 240
    piernas(a)
    tau = 2 * math.pi
    sway = lambda f: math.sin(tau * f / L)
    resp = lambda f: math.sin(tau * f / 80)
    a.loc("hips_01", onda(0, L, 12, lambda f: (0.028 * sway(f), 0.006 * math.sin(tau * f / L * 2), -0.006 * (0.5 + 0.5 * resp(f)))))
    a.rot("hips_01", onda(0, L, 12, lambda f: [(FRENTE, 1.6 * sway(f)), (ARRIBA, 1.2 * math.sin(tau * f / L + 0.6))]))
    a.rot("spine_02", onda(0, L, 12, lambda f: [(FRENTE, -0.8 * sway(f)), (IZQ, -0.8 * resp(f))]))
    a.rot("chest_03", onda(0, L, 12, lambda f: [(FRENTE, -1.0 * math.sin(tau * f / L - 0.4)), (IZQ, -1.7 * resp(f)),
                                                  (ARRIBA, -1.5 * math.sin(tau * f / L + 0.6))]))
    a.rot("shoulder.L_08", onda(0, L, 10, lambda f: [(FRENTE, 2.0 * resp(f - 4))]))
    a.rot("shoulder.R_024", onda(0, L, 10, lambda f: [(FRENTE, -2.0 * resp(f - 4))]))
    a.rot("neck_04", onda(0, L, 12, lambda f: [(FRENTE, 0.9 * math.sin(tau * f / L - 0.4)), (IZQ, 0.8 * resp(f - 6))]))
    a.rot("head_05", onda(0, L, 12, lambda f: [(ARRIBA, 4.5 * math.sin(tau * f / L * 2 + 1.1)),
                                                 (IZQ, 1.4 * math.sin(tau * f / 120 + 0.3) + 0.6 * resp(f - 10)),
                                                 (FRENTE, 2.0 * math.sin(tau * f / L + 2.0))]))
    for lado, s in (("L", 1), ("R", -1)):
        sh, up, lo, ha = BRAZO[lado]
        a.rot(up, onda(0, L, 12, lambda f, s=s: [(FRENTE, s * 1.5 - 2.2 * sway(f - 16)), (IZQ, 1.8 * math.sin(tau * f / L * 2 + s))]))
        a.rot(lo, onda(0, L, 12, lambda f, s=s: [(IZQ, -2.5 * (0.5 + 0.5 * resp(f - 10)) - 1.0 * math.sin(tau * f / L * 2 + s + 0.8))]))
        a.rot(ha, onda(0, L, 12, lambda f, s=s: [(FRENTE, 2.5 * s * math.sin(tau * f / L * 2 + s + 1.4))]))
        a.mano(lado, [(f, ("suelta", {"index": 6 * math.sin(tau * f / L * 3 + s), "ring": 5 * math.sin(tau * f / L * 3 + s + 1.5),
                                      "middle": 4 * math.sin(tau * f / L * 3 + s + 0.7)})) for f in range(0, L + 1, 20)])
    quijada(a, [(0, 0), (L, 0)])


def reposo(a, lado, f):
    return (f, a.reposo_mano[lado], 0, None, True)


def accion_mirar(a, sup):
    """Voltea a su derecha, luego a su izquierda, se rasca la barbilla pensando y
    regresa con un encogimiento de hombros."""
    L = 165
    piernas(a)
    cab = lambda giros: [(0, I)] + giros + [(L, I)]
    a.loc("hips_01", [(0, (0, 0, 0)), (14, (-0.012, 0, -0.01)), (60, (-0.018, 0, -0.004)), (78, (0.02, 0, -0.01)), (120, (0.016, 0, -0.006)),
                      (146, (0, 0, -0.016), "BACK", "EASE_OUT", 1.6), (L, (0, 0, 0))])
    a.rot("chest_03", cab([(10, [(IZQ, 1.5)]), (26, [(ARRIBA, -11), (IZQ, -1)]), (56, [(ARRIBA, -9), (IZQ, -1)]),
                           (82, [(ARRIBA, 13), (FRENTE, -2)], "BACK", "EASE_OUT", 1.4), (118, [(ARRIBA, 9), (FRENTE, -3), (IZQ, 3)]),
                           (138, [(IZQ, -2)]), (148, [(IZQ, 1.5)])]))
    a.rot("spine_02", cab([(28, [(ARRIBA, -4)]), (56, [(ARRIBA, -3)]), (84, [(ARRIBA, 5)]), (118, [(ARRIBA, 4)])]))
    a.rot("neck_04", cab([(20, [(ARRIBA, -10)]), (56, [(ARRIBA, -8), (FRENTE, 3)]), (76, [(ARRIBA, 12)], "BACK", "EASE_OUT", 1.6),
                          (118, [(ARRIBA, 6), (FRENTE, -4)])]))
    a.rot("head_05", cab([(8, [(IZQ, 2)]), (18, [(ARRIBA, -16), (IZQ, -2)], "BACK", "EASE_OUT", 1.5), (40, [(ARRIBA, -14), (FRENTE, 6), (IZQ, -3)]),
                          (56, [(ARRIBA, -15), (FRENTE, 4)]), (63, [(ARRIBA, -12), (IZQ, 3)]),
                          (74, [(ARRIBA, 20), (IZQ, -2)], "BACK", "EASE_OUT", 1.6), (96, [(ARRIBA, 12), (FRENTE, -8), (IZQ, -6)]),
                          (118, [(ARRIBA, 10), (FRENTE, -9), (IZQ, -7)]), (134, [(ARRIBA, -2), (IZQ, 2)])]))
    for lado, s in (("L", 1), ("R", -1)):
        a.rot(BRAZO[lado][0], [(0, I), (138, I), (146, [(FRENTE, 9 * s)], "BACK", "EASE_OUT", 1.8), (156, [(FRENTE, -1 * s)]), (L, I)])
    # la derecha a la barbilla: sube en arco, se rasca y baja; al final se encoge
    rep = a.reposo_mano["R"]
    # la muñeca abajo de la barbilla: los dedos le llegan a ella sin tapar la boca
    barb = Vector((-0.17, -0.86, 1.36))
    qb = mano_q((0.25, -0.35, 0.9), (0.6, 0.6, 0.0))
    rasca = [(106 + 4 * k, barb + Vector((0.012 * (1 if k % 2 else -1), 0, 0.008 * (1 if k % 2 else -1))), None, qb, False) for k in range(5)]
    a.brazo("R", [reposo(a, "R", 0), reposo(a, "R", 84), (93, Vector((-0.68, -0.62, 1.12)), None, None, False),
                  (102, barb, None, qb, True)] + rasca + [(128, barb, None, qb, True), (138, Vector((-0.7, -0.52, 1.02)), None, None, False),
                  (147, rep + Vector((-0.07, -0.06, 0.07)), None, None, True), reposo(a, "R", 157), reposo(a, "R", L)])
    a.mano("R", [(0, "suelta"), (90, "suelta"), (100, ("garra", {"index": -20})), (106, ("garra", {"index": 10})), (110, ("garra", {"index": -20})),
                 (114, ("garra", {"index": 10})), (118, ("garra", {"index": -15})), (126, "garra"), (136, "suelta"), (L, "suelta")])
    a.mano("L", [(0, "suelta"), (80, ("suelta", {"index": 10})), (146, "abierta"), (156, "suelta"), (L, "suelta")])
    a.rot("upper_arm.L_09", [(0, I), (140, I), (147, [(FRENTE, 6), (IZQ, -4)]), (158, I), (L, I)])
    a.rot("lower_arm.L_010", [(0, I), (60, [(IZQ, -3)]), (100, [(IZQ, -5)]), (140, I), (147, [(IZQ, -14)]), (158, I), (L, I)])
    quijada(a, [(0, 0), (L, 0)])


def accion_impaciente(a, sup):
    """Alza la muñequera y la ve como si fuera reloj, suspira, golpetea el pie,
    tamborilea los dedos y menea la cabeza (los ojos en blanco los pone el sitio)."""
    L = 180
    taps = [22, 32, 42, 52, 104, 114, 124, 134]
    B = a.arm.data.bones
    tob = B["foot.R_046"].head_local.copy()
    qp = a.qr["foot.R_046"]

    def golpe(f):
        g = 0.0
        for t in taps:
            d = f - t
            if -4 <= d < 0:
                g = max(g, _suave((d + 4) / 4))
            elif 0 <= d <= 3:
                g = max(g, 1 - d / 3)
        return g
    talon = tob + Vector((0, 0.05, -0.08))
    a.ik_pierna("L", 0, L)
    a.ik_pierna("R", 0, L, objetivo=lambda f, ev: talon + q(IZQ, -16 * golpe(f)) @ (tob - talon),
                orient=lambda f, ev: q(IZQ, -16 * golpe(f)) @ qp)
    a.loc("hips_01", [(0, (0, 0, 0)), (14, (0.02, 0, -0.008)), (66, (0.02, 0, -0.006)), (78, (0.02, 0, 0.012)), (94, (0.018, 0, -0.018), "BACK", "EASE_OUT", 1.5),
                      (150, (0.02, 0, -0.008)), (L, (0, 0, 0))])
    a.rot("hips_01", [(0, I), (14, [(FRENTE, 1.5)]), (150, [(FRENTE, 1.5)]), (L, I)])
    # el "reloj": la muñeca izquierda frente al pecho, abajo de la barbilla, con el
    # antebrazo cruzado y el dorso (la muñequera) hacia sus ojos; el codo dobla ~70°
    # (más doblado, sus brazos gruesos se aplastan en el codo)
    # lo ve (18-32), lo sacude como si no sirviera (34-46: la muñeca sube y baja desde
    # el codo y la mano va floja detrás), lo vuelve a ver de cerca (48-58) y deja caer
    # el brazo con un columpio (60-84)
    reloj = Vector((0.26, -0.79, 1.34))
    qr_ = mano_q((-0.9, -0.3, 0.15), (0.2, -0.36, -0.91))
    lado_mano = qr_ @ Vector((1, 0, 0))
    cerca = reloj + Vector((-0.03, 0.05, 0.05))
    claves = [reposo(a, "L", 0), (9, Vector((0.62, -0.5, 1.12)), None, None, False), (16, reloj + Vector((0.01, 0, 0.02)), None, qr_, False),
              (20, reloj, None, qr_, True), (32, reloj + Vector((0, 0, 0.012)), None, qr_, True)]
    for k, f in enumerate(range(35, 47, 3)):
        s_ = 1 if k % 2 == 0 else -1
        claves.append((f, reloj + Vector((0.01 * s_, 0, 0.04 * s_)), None, Quaternion(lado_mano, math.radians(-16 * s_)) @ qr_, False))
    claves += [(49, cerca + Vector((0, 0, -0.01)), None, qr_, False), (52, cerca, None, qr_, True), (58, cerca + Vector((0, 0, 0.006)), None, qr_, True),
               (66, Vector((0.62, -0.5, 1.08)), None, None, False), (74, a.reposo_mano["L"] + Vector((0, -0.04, -0.02)), None, None, False),
               (80, a.reposo_mano["L"] + Vector((0, 0.03, 0.01)), None, None, False), reposo(a, "L", 88), reposo(a, "L", L)]
    a.brazo("L", claves)
    a.mano("L", [(0, "suelta"), (14, ("suelta", {"index": 6, "middle": 8, "ring": 10})), (34, ("suelta", {"index": 6, "middle": 8, "ring": 10})),
                 (38, ("suelta", {"index": -4, "middle": -2, "ring": 0})), (41, ("suelta", {"index": 14, "middle": 16, "ring": 18})),
                 (44, ("suelta", {"index": -2, "middle": 0, "ring": 2})), (48, ("suelta", {"index": 6, "middle": 8, "ring": 10})),
                 (60, ("suelta", {"index": 6, "middle": 8, "ring": 10})), (72, "suelta"), (L, "suelta")])
    a.rot("chest_03", [(0, I), (16, [(IZQ, 5), (ARRIBA, 4)]), (58, [(IZQ, 5), (ARRIBA, 3)]), (70, I), (80, [(IZQ, -6)]),
                       (96, [(IZQ, 4)], "BACK", "EASE_OUT", 1.3), (150, [(IZQ, 2)]), (L, I)])
    for lado, s_ in (("L", 1), ("R", -1)):
        a.rot(BRAZO[lado][0], [(0, I), (66, I), (80, [(FRENTE, 8 * s_)]), (96, [(FRENTE, -3 * s_)], "BACK", "EASE_OUT", 1.3), (110, I), (L, I)])
    a.rot("neck_04", [(0, I), (16, [(IZQ, 6), (ARRIBA, 4)]), (58, [(IZQ, 6), (ARRIBA, 3)]), (70, I), (82, [(IZQ, -8)]), (98, [(IZQ, 6)]), (150, [(IZQ, 3)]), (L, I)])
    a.rot("head_05", [(0, I), (16, [(IZQ, 12), (ARRIBA, 7), (FRENTE, -4)]), (32, [(IZQ, 13), (ARRIBA, 6), (FRENTE, -6)]), (40, [(IZQ, 9), (ARRIBA, 4), (FRENTE, 4)]),
                      (52, [(IZQ, 17), (ARRIBA, 6), (FRENTE, -3)], "BACK", "EASE_OUT", 1.3), (58, [(IZQ, 16), (ARRIBA, 7)]),
                      (70, [(IZQ, -2)]), (82, [(IZQ, -12)]), (98, [(IZQ, 8)], "BACK", "EASE_OUT", 1.4),
                      (140, [(IZQ, 5), (ARRIBA, 9)]), (148, [(IZQ, 5), (ARRIBA, -9)]), (156, [(IZQ, 5), (ARRIBA, 7)]), (164, [(IZQ, 3), (ARRIBA, -3)]), (L, I)])
    # la derecha cuelga y tamborilea
    dedos = []
    for f in range(0, L + 1, 3):
        ph = f * 0.9
        if 18 <= f <= 150:
            dedos.append((f, ("suelta", {"index": 26 * max(0, math.sin(ph)), "middle": 26 * max(0, math.sin(ph - 0.8)), "ring": 26 * max(0, math.sin(ph - 1.6))}), "LINEAR"))
        else:
            dedos.append((f, "suelta"))
    a.mano("R", dedos)
    a.rot("lower_arm.R_026", [(0, I), (16, [(IZQ, -8)]), (150, [(IZQ, -8)]), (L, I)])
    a.rot("upper_arm.R_025", [(0, I), (16, [(FRENTE, 3)]), (150, [(FRENTE, 3)]), (L, I)])
    a.rot("hand.R_027", [(0, I), (16, [(IZQ, -6)]), (150, [(IZQ, -6)]), (L, I)])
    quijada(a, [(0, 0), (L, 0)])


def accion_comer(a, sup):
    """Ve algo arriba, atrapa una esfera luminosa en el aire, la avienta y la cacha,
    se la avienta a la boca, mastica, traga, se soba la panza satisfecho y eructa."""
    L = 300
    c = COMER
    piernas(a)
    a.loc("hips_01", [(0, (0, 0, 0)), (16, (0, 0.01, -0.012)), (34, (0, 0.0, 0.01)), (40, (0, 0, 0.03), "BACK", "EASE_OUT", 2.0), (48, (0, 0, -0.012)),
                      (58, (0, 0, 0)), (120, (0, 0.012, -0.006)), (128, (0, 0.02, -0.02)), (136, (0, -0.012, 0.004), "BACK", "EASE_OUT", 1.5),
                      (176, (0, 0, -0.008)), (190, (0, 0.006, -0.02)), (200, (0, 0, 0)), (238, (0, 0.012, -0.01)), (246, (0, 0.02, 0.01)),
                      (252, (0, 0.01, -0.012), "BACK", "EASE_OUT", 1.5), (270, (0, 0, 0)), (L, (0, 0, 0))])
    a.rot("chest_03", [(0, I), (16, [(IZQ, -4)]), (34, [(IZQ, -5), (ARRIBA, -6)]), (48, [(IZQ, 1)]), (70, [(IZQ, 4), (ARRIBA, -3)]),
                       (106, [(IZQ, 4), (ARRIBA, 2)]), (124, [(IZQ, -7)]), (136, [(IZQ, 6)], "BACK", "EASE_OUT", 1.4), (176, [(IZQ, 2)]),
                       (186, [(IZQ, -4)]), (194, [(IZQ, 5)]), (204, [(IZQ, 3)]), (236, [(IZQ, -3)]), (246, [(IZQ, -9)]), (252, [(IZQ, 2)], "BACK", "EASE_OUT", 1.6),
                       (270, [(IZQ, -2)]), (L, I)])
    a.rot("spine_02", [(0, I), (16, [(IZQ, -3)]), (48, I), (124, [(IZQ, -3)]), (136, [(IZQ, 3)]), (200, I),
                       (246, [(IZQ, -4)]), (262, I), (L, I)])
    a.rot("neck_04", [(0, I), (14, [(IZQ, -5)]), (36, [(IZQ, -7), (ARRIBA, -6)]), (52, [(IZQ, 4), (ARRIBA, -2)]), (106, [(IZQ, 5)]),
                      (126, [(IZQ, -6)]), (138, [(IZQ, 8)]), (176, [(IZQ, 3)]), (184, [(IZQ, -5)]), (190, [(IZQ, 6)]), (240, [(IZQ, -3)]),
                      (248, [(IZQ, -10)]), (256, [(IZQ, 2)]), (L, I)])
    a.rot("head_05", [(0, I), (6, [(IZQ, 3)]), (16, [(IZQ, -9), (FRENTE, 4)], "BACK", "EASE_OUT", 1.5), (34, [(IZQ, -12), (ARRIBA, -8), (FRENTE, 6)]),
                      (44, [(IZQ, -6), (ARRIBA, -6)]), (56, [(IZQ, 9), (ARRIBA, -8), (FRENTE, 8)]), (70, [(IZQ, 12), (ARRIBA, -4), (FRENTE, -6)]),
                      (80, [(IZQ, 0), (ARRIBA, -6)]), (87, [(IZQ, -8), (ARRIBA, -6)]), (96, [(IZQ, 10), (ARRIBA, -5)], "BACK", "EASE_OUT", 1.4),
                      (106, [(IZQ, 10), (ARRIBA, -4), (FRENTE, 4)]), (122, [(IZQ, -14)]),
                      (132, [(IZQ, -12)]), (138, [(IZQ, 10)], "BACK", "EASE_OUT", 1.6), (146, [(IZQ, 4)]),
                      (154, [(IZQ, 7), (FRENTE, 3)]), (162, [(IZQ, 3), (FRENTE, -3)]), (170, [(IZQ, 7), (FRENTE, 2)]), (178, [(IZQ, 2)]),
                      (184, [(IZQ, -8)]), (190, [(IZQ, 10)], "BACK", "EASE_OUT", 1.5), (204, [(IZQ, 6), (FRENTE, -3)]), (232, [(IZQ, 2), (FRENTE, -4)]),
                      (244, [(IZQ, -6)]), (249, [(IZQ, -18)], "BACK", "EASE_OUT", 1.8), (258, [(IZQ, 2)]), (272, [(IZQ, -3), (FRENTE, 3)]), (L, I)])
    qj = [(0, 0), (118, 0), (126, 27), (134, 29), (138, -2, "BACK", "EASE_OUT", 1.2)]
    f = c["mastica"][0]
    for k in range(4):
        qj += [(f + 4, 10), (f + 9, -1)]
        f += 9
    qj += [(184, 0), (186, 4), (190, 0), (244, 0), (248, 22, "BACK", "EASE_OUT", 1.4), (258, 18), (264, 0), (L, 0)]
    quijada(a, qj)
    # ---- la mano derecha: arriba, atrapa, la acerca, juega, la avienta a la boca,
    # palmadas en la panza. La mano nunca va a la cara: la esfera vuela sola.
    alto = Vector((-0.42, -0.42, 2.08))
    frente_cara = Vector((-0.28, -0.98, 1.2))
    rep = a.reposo_mano["R"]
    palma_arriba = mano_q((0.15, -0.95, 0.15), (0.0, 0.2, 1.0))
    arriba_q = mano_q((0.0, -0.2, 1.0), (0.0, -1.0, 0.0))
    mano_panza = mano_q((0.85, -0.12, -0.5), (0.05, 1.0, 0.15))
    en_panza = sup(-0.08, 1.04) + Vector((-0.1, -0.075, 0.05))
    despega = en_panza + Vector((-0.01, -0.07, 0.015))
    off = a.esfera_off.to_translation()
    lanza = c["lanza"]
    quieta = frente_cara - palma_arriba @ off
    j0, j1 = c["juega"]
    a.brazo("R", [
        reposo(a, "R", 0), (14, rep + Vector((0.0, 0.02, -0.03)), 0, None, True),
        # al atrapar la mano va natural; de ahí gira hacia la palma arriba (pedir la palma
        # al frente arriba la dejaba a media vuelta de la palma arriba y brincaba)
        (28, Vector((-0.6, -0.42, 1.6)), None, None, False),
        (37, alto, None, None, True),
        (42, alto + Vector((0, -0.02, -0.07)), None, None, False),
        (51, alto.lerp(quieta, 0.55) + Vector((-0.07, -0.04, 0.06)), None, None, False),
        (61, quieta, None, palma_arriba, True),
        (j0 - 5, quieta + Vector((0, 0, -0.04)), None, palma_arriba, True),
        (j0 + 1, quieta + Vector((0, -0.01, 0.07)), None, palma_arriba, False),
        (j0 + 7, quieta, None, palma_arriba, True),
        (j1 - 1, quieta, None, palma_arriba, True),
        (j1 + 3, quieta + Vector((0, 0, -0.05)), None, palma_arriba, False),
        (j1 + 9, quieta, None, palma_arriba, True),
        (lanza - 4, quieta + Vector((0.02, 0.02, -0.06)), None, palma_arriba, True),
        (lanza + 1, quieta + Vector((0, -0.05, 0.13)), None, q(IZQ, -25) @ palma_arriba, False),
        (lanza + 8, quieta + Vector((0, -0.03, 0.08)), None, palma_arriba, True),
        # ya sin la esfera, la mano baja floja y se apoya en la panza (dedos de lado,
        # palma contra la panza) mientras mastica; al tragar aprieta tantito, da tres
        # palmadas y baja con su columpio
        (lanza + 16, quieta + Vector((-0.04, 0.02, -0.12)), None, None, False),
        (150, en_panza + Vector((-0.02, -0.05, 0.03)), None, mano_panza, False),
        (156, en_panza, None, mano_panza, True), (176, en_panza + Vector((0, 0, -0.01)), None, mano_panza, True),
        (184, en_panza + Vector((0.004, 0.008, 0.0)), None, mano_panza, True), (190, en_panza, None, mano_panza, True),
        (195, despega, None, mano_panza, False), (198, en_panza, None, mano_panza, False),
        (203, despega, None, mano_panza, False), (206, en_panza, None, mano_panza, False),
        (211, despega, None, mano_panza, False), (214, en_panza, None, mano_panza, True),
        (226, en_panza + Vector((-0.01, -0.01, -0.03)), None, mano_panza, True),
        (236, rep + Vector((0.03, -0.07, 0.07)), None, None, False), (242, rep + Vector((-0.01, 0.025, -0.01)), None, None, False),
        reposo(a, "R", 250), reposo(a, "R", L)])
    plana = ("suelta", {"index": -6, "middle": -6, "ring": -4})
    a.mano("R", [(0, "suelta"), (24, "abierta"), (36, "abierta"), (40, "garra", "BACK", "EASE_OUT", 1.5), (lanza - 4, "garra"),
                 (lanza, "abierta"), (lanza + 14, "suelta"), (152, plana), (194, plana),
                 (196, ("suelta", {"index": 4, "middle": 4, "ring": 6})), (198, plana), (204, ("suelta", {"index": 4, "middle": 4, "ring": 6})),
                 (206, plana), (212, ("suelta", {"index": 4, "middle": 4, "ring": 6})), (214, plana), (228, plana), (240, "suelta"), (L, "suelta")])
    # ---- la izquierda se soba la panza mientras juega con la esfera
    repL = a.reposo_mano["L"]
    # plana sobre la panza: la palma contra la panza (su normal en ese punto) y los
    # dedos de lado hacia el otro costado siguiendo la curva, un poco abajo; la muñeca
    # queda a su izquierda, afuera de la panza
    p0, px, pz = sup(0.12, 1.08), sup(0.16, 1.08), sup(0.12, 1.12)
    normal = (px - p0).cross(pz - p0).normalized()
    if normal.y > 0:
        normal = -normal
    dedos_L = ((p0 - px).normalized() * 0.88 + Vector((0, 0, -0.47))).normalized()
    dedos_L = (dedos_L - dedos_L.dot(normal) * normal).normalized()
    # la palma ve tantito hacia abajo (medido: así se mete menos en la panza)
    q_rub = mano_q(dedos_L, (-normal + Vector((0, 0, -0.3))).normalized())
    panza_L = p0 + normal * 0.12 - dedos_L * 0.1
    # la sobada sale de la mano, no del brazo (como el saludo): la palma gira sobre sí
    # misma en círculos chicos (se abanica), la muñeca la acompaña y los dedos van
    # sueltos detrás; el brazo solo se mueve lo que la mano lo arrastra. Hacia el
    # centro (-t1) la panza sale más: de ese lado el círculo es más chico y se despega.
    # Los círculos van en el plano tangente de la panza, no en el del mundo.
    t1, t2 = (px - p0).normalized(), (pz - p0).normalized()
    eje_palma = q_rub @ Vector((0, 0, 1))
    S0, S1, PER = 64, 114, 22.0

    def env_s(f):
        return _suave((f - S0) / 6) * _suave((S1 - f) / 6)

    def ang(f, atraso=0.0):
        return 2 * math.pi * (f - S0 - atraso) / PER
    sobada = []
    for f in range(S0, S1 + 1, 2):
        e = env_s(f)
        co, si = math.cos(ang(f)), math.sin(ang(f))
        pos = panza_L + (t1 * ((0.028 if co > 0 else 0.014) * co) + t2 * (0.022 * si) + normal * (0.01 * max(0.0, -co))) * e
        giro = Quaternion(eje_palma, math.radians(13 * math.sin(ang(f, 2.5)) * e))
        prensa = Quaternion(dedos_L, math.radians(5 * math.cos(ang(f, 1.5)) * e))
        sobada.append((f, pos, None, prensa @ giro @ q_rub, f in (S0, S1)))
    a.brazo("L", [reposo(a, "L", 0), reposo(a, "L", 52), (59, panza_L + normal * 0.08 + Vector((0.03, 0, 0)), None, q_rub, False)] + sobada +
                 [(119, panza_L + normal * 0.06, None, q_rub, False), (125, Vector((0.7, -0.45, 0.95)), None, None, False),
                  reposo(a, "L", 134), reposo(a, "L", 238), (247, repL + Vector((0.05, -0.05, 0.06)), None, None, True), reposo(a, "L", 260), reposo(a, "L", L)])
    dedos_s = [(0, "suelta"), (60, ("suelta", {"index": -6, "middle": -6, "ring": -4, "thumb": -22}))]
    for f in range(S0, S1 + 1, 2):
        e = env_s(f)
        fl = lambda atraso: 7 * math.sin(ang(f, atraso)) * e
        dedos_s.append((f, ("suelta", {"index": -6 + fl(4.0), "middle": -6 + fl(4.8), "ring": -4 + fl(5.6), "thumb": -22}), "LINEAR"))
    dedos_s += [(118, ("suelta", {"index": -6, "middle": -6, "ring": -4, "thumb": -22})), (127, "suelta"), (236, "suelta"), (244, "abierta"), (258, "suelta"), (L, "suelta")]
    a.mano("L", dedos_s)
    # ---- la esfera: aparece en la mano, la avienta para arriba y la cacha, luego
    # vuela en arco a la boca abierta y se encoge al entrar
    a.pegar("esfera", 0, j0, "hand.R_027", a.esfera_off)

    def juega(f, ev):
        p0 = (a.ev_en(j0)["hand.R_027"] @ a.esfera_off).to_translation()
        p1 = (a.ev_en(j1)["hand.R_027"] @ a.esfera_off).to_translation()
        t = (f - j0) / (j1 - j0)
        return Matrix.Translation(p0.lerp(p1, t) + Vector((0, 0, 0.42 * 4 * t * (1 - t))))
    a.seguir("esfera", j0 + 1, j1 - 1, juega)
    a.pegar("esfera", j1, lanza, "hand.R_027", a.esfera_off)
    entra_boca = c["muerde"] - 3
    boca_dentro = BOCA + Vector((0, 0.04, 0))

    def vuelo(f, ev):
        p0 = (a.ev_en(lanza)["hand.R_027"] @ a.esfera_off).to_translation()
        p1 = en_cabeza(a.arm, boca_dentro)(a.ev_en(entra_boca))
        t = min(1.0, (f - lanza) / (entra_boca - lanza))
        p = p0.lerp(p1, t) + Vector((0, 0, 0.16 * 4 * t * (1 - t)))
        if f > entra_boca:
            p = en_cabeza(a.arm, boca_dentro)(ev)
        return Matrix.Translation(p)
    a.seguir("esfera", lanza + 1, c["muerde"] + 2, vuelo)
    ap = c["aparece"]
    a.esc("esfera", [(0, 0.0, "CONSTANT"), (ap - 1, 0.0, "LINEAR"), (ap + 3, 1.3, "SINE", "EASE_OUT"), (ap + 7, 0.9), (ap + 10, 1.0),
                     (entra_boca, 1.0), (entra_boca + 2, 0.55), (c["muerde"], 0.0, "CONSTANT"), (L, 0.0, "CONSTANT")])


def accion_saludo(a, sup):
    L = 80
    piernas(a)
    a.loc("hips_01", [(0, (0, 0, 0)), (8, (0.01, 0, -0.014)), (18, (0.016, 0, 0.006), "BACK", "EASE_OUT", 1.6), (58, (0.012, 0, 0.0)), (L, (0, 0, 0))])
    a.rot("chest_03", [(0, I), (8, [(IZQ, 3)]), (18, [(IZQ, -5), (FRENTE, 4), (ARRIBA, -5)], "BACK", "EASE_OUT", 1.5), (58, [(IZQ, -3), (FRENTE, 3), (ARRIBA, -4)]), (L, I)])
    a.rot("head_05", [(0, I), (8, [(IZQ, 4)]), (18, [(IZQ, -6), (FRENTE, 8)], "BACK", "EASE_OUT", 1.6), (32, [(IZQ, -4), (FRENTE, 4)]), (44, [(IZQ, -6), (FRENTE, 8)]),
                      (58, [(IZQ, -4), (FRENTE, 4)]), (L, I)])
    # el saludo sale de la muñeca: el antebrazo queda casi derecho hacia arriba y se
    # mece poquito desde el codo; la mano se abanica de lado sobre la muñeca, en el
    # plano de la palma, siguiéndolo con retraso (latigazo), y los dedos van sueltos
    # y llegan todavía después
    rep = a.reposo_mano["R"]
    ante = Vector((0.1, -0.15, 0.98)).normalized()
    alto = Vector((-0.83, -0.32, 1.77))
    qw = mano_q(ante, (0.0, -1.0, 0.15))
    T, F0, F1 = 13.0, 20, 56

    def env(f):
        return _suave((f - F0 + 2) / 6) * _suave((F1 + 2 - f) / 6)

    def fase(f, atraso=0.0):
        return math.sin(2 * math.pi * (f - F0 - atraso) / T)
    claves = [reposo(a, "R", 0), (7, rep + Vector((0, 0.02, -0.04)), 0, None, True),
              (14, alto + Vector((0.02, -0.02, 0.06)), None, q(FRENTE, 10) @ qw, False), (17, alto, None, q(FRENTE, -4) @ qw, False)]
    for f in range(F0 - 2, F1 + 3):
        e = env(f)
        ph = fase(f, -2.5)
        claves.append((f, alto + Vector((0.055 * ph * e, 0, -0.018 * ph * ph * e)), None, q(FRENTE, -30 * fase(f) * e) @ qw, False))
    claves += [(F1 + 6, alto + Vector((0.01, 0, -0.01)), None, q(FRENTE, 6) @ qw, False),
               (F1 + 12, rep + Vector((-0.08, -0.12, 0.3)), None, None, False), reposo(a, "R", 74), reposo(a, "R", L)]
    a.brazo("R", claves)
    dedos = [(0, "suelta"), (10, "abierta")]
    for f in range(F0 - 2, F1 + 3, 2):
        flojo = 9 * fase(f, 3.5) * env(f)
        dedos.append((f, ("abierta", {"index": 4 + flojo, "middle": 5 + flojo, "ring": 6 + flojo}), "LINEAR"))
    dedos += [(F1 + 6, "abierta"), (L - 4, "suelta"), (L, "suelta")]
    a.mano("R", dedos)
    a.rot("upper_arm.L_09", [(0, I), (18, [(FRENTE, 4)]), (30, [(FRENTE, 2)]), (58, [(FRENTE, 3)]), (L, I)])
    quijada(a, [(0, 0), (12, 0), (20, 9), (54, 7), (66, 0), (L, 0)])


def accion_risa(a, sup):
    """Se ríe a carcajadas: se agarra la panza con la izquierda y señala con la derecha."""
    L = 96
    piernas(a)
    alt = lambda f: (f // 6) % 2 == 1
    a.loc("hips_01", [(0, (0, 0, 0)), (8, (0, -0.012, -0.012)), (18, (0, 0.03, 0.008), "BACK", "EASE_OUT", 1.5)] +
          [(f, (0, 0.03, 0.008 if alt(f) else -0.006), "SINE") for f in range(24, 72, 6)] + [(80, (0, 0.015, -0.004)), (L, (0, 0, 0))])
    a.rot("chest_03", [(0, I), (8, [(IZQ, 6)]), (18, [(IZQ, -8)], "BACK", "EASE_OUT", 1.4)] +
          [(f, [(IZQ, -7 + (3 if alt(f) else -2))], "SINE") for f in range(24, 72, 6)] + [(80, [(IZQ, -3)]), (L, I)])
    a.rot("spine_02", [(0, I), (8, [(IZQ, 3)]), (18, [(IZQ, -3)]), (70, [(IZQ, -3)]), (L, I)])
    a.rot("neck_04", [(0, I), (8, [(IZQ, 6)]), (18, [(IZQ, -5)]), (70, [(IZQ, -4)]), (84, I), (L, I)])
    a.rot("head_05", [(0, I), (8, [(IZQ, 10)]), (18, [(IZQ, -10), (FRENTE, -5)], "BACK", "EASE_OUT", 1.6)] +
          [(f, [(IZQ, -9 + (4 if alt(f) else -3)), (FRENTE, -5)], "SINE") for f in range(24, 72, 6)] + [(84, [(IZQ, 3)]), (L, I)])
    for lado, s in (("L", 1), ("R", -1)):
        a.rot(BRAZO[lado][0], [(0, I), (8, [(FRENTE, 6 * s)])] + [(f, [(FRENTE, (6 if alt(f) else 1) * s)], "SINE") for f in range(24, 72, 6)] +
              [(80, I), (L, I)])
    quijada(a, [(0, 0), (8, 6), (18, 26)] + [(f, 24 if alt(f) else 13, "SINE") for f in range(24, 72, 6)] + [(80, 8), (88, 0), (L, 0)])
    panza = sup(0.14, 0.92) + Vector((0.04, -0.12, 0.02))
    q_panza = mano_q((-0.6, -0.1, -0.6), (0.0, 1.0, 0.0))
    a.brazo("L", [reposo(a, "L", 0), (8, Vector((0.64, -0.45, 0.95)), None, None, False), (16, panza, None, q_panza, True)] +
            [(f, panza + Vector((0, 0, 0.015 if alt(f) else -0.01)), None, q_panza, False) for f in range(24, 72, 6)] +
            [(76, panza, None, q_panza, True), reposo(a, "L", 87), reposo(a, "L", L)])
    a.mano("L", [(0, "suelta"), (14, "abierta"), (80, "abierta"), (L, "suelta")])
    repR = a.reposo_mano["R"]
    adelante = Vector((-0.42, -1.0, 1.42))
    q_senala = mano_q((0.15, -1.0, 0.0), (0.9, 0.0, 0.1))
    a.brazo("R", [reposo(a, "R", 0), (8, repR + Vector((0, 0.03, -0.02)), 0, None, True), (17, adelante, None, q_senala, True)] +
            [(f, adelante + Vector((0.0, 0.03 if alt(f) else -0.02, 0.01 if alt(f) else 0.0)), None, q_senala, False) for f in range(24, 72, 6)] +
            [(78, adelante, None, q_senala, True), reposo(a, "R", 89), reposo(a, "R", L)])
    a.mano("R", [(0, "suelta"), (16, "senala"), (80, "senala"), (L, "suelta")])


def accion_impresionado(a, sup):
    """¡Eso!: se sorprende, sube el puño y lo jala dos veces, rebotando."""
    L = 78
    piernas(a)
    a.loc("hips_01", [(0, (0, 0, 0)), (8, (0, 0.012, 0.012)), (14, (0, 0, 0.004)), (20, (0, 0, -0.022), "BACK", "EASE_OUT", 1.6), (26, (0, 0, -0.004)),
                      (32, (0, 0, -0.024), "BACK", "EASE_OUT", 1.6), (42, (0, 0, -0.006)), (60, (0, 0, -0.004)), (L, (0, 0, 0))])
    a.rot("chest_03", [(0, I), (8, [(IZQ, -6)], "BACK", "EASE_OUT", 1.6), (14, [(IZQ, -4), (ARRIBA, -6)]), (20, [(IZQ, 5), (ARRIBA, -8)], "BACK", "EASE_OUT", 1.5),
                       (26, [(IZQ, -1), (ARRIBA, -7)]), (32, [(IZQ, 6), (ARRIBA, -8)], "BACK", "EASE_OUT", 1.5), (44, [(IZQ, 1), (ARRIBA, -5)]), (60, [(ARRIBA, -4)]), (L, I)])
    a.rot("head_05", [(0, I), (8, [(IZQ, -9)], "BACK", "EASE_OUT", 1.6), (14, [(IZQ, -5)]), (20, [(IZQ, 8)], "BACK", "EASE_OUT", 1.5), (26, [(IZQ, -2)]),
                      (32, [(IZQ, 8)], "BACK", "EASE_OUT", 1.5), (44, [(IZQ, -3), (FRENTE, 5)]), (60, [(FRENTE, 6)]), (L, I)])
    rep = a.reposo_mano["R"]
    arriba_p = Vector((-0.6, -0.5, 1.72))
    abajo_p = Vector((-0.5, -0.6, 1.24))
    a.brazo("R", [reposo(a, "R", 0), (6, rep + Vector((0, 0, -0.03)), 0, None, True), (12, arriba_p, None, None, True),
                  (16, arriba_p + Vector((0, 0, 0.03)), None, None, False), (20, abajo_p, None, None, True),
                  (25, arriba_p + Vector((0, 0, -0.1)), None, None, False), (31, abajo_p, None, None, True),
                  (44, abajo_p + Vector((0, 0, 0.02)), None, None, False), (56, abajo_p + Vector((0, 0, 0.03)), None, None, True),
                  reposo(a, "R", 67), reposo(a, "R", L)])
    a.mano("R", [(0, "suelta"), (10, "puno", "BACK", "EASE_OUT", 1.6), (60, "puno"), (L, "suelta")])
    a.mano("L", [(0, "suelta"), (20, "puno"), (60, "puno"), (L, "suelta")])
    a.rot("lower_arm.L_010", [(0, I), (20, [(IZQ, -18)]), (32, [(IZQ, -22)]), (60, [(IZQ, -14)]), (L, I)])
    quijada(a, [(0, 0), (6, 8), (14, 4), (20, 14), (26, 6), (32, 16), (44, 6), (60, 3), (L, 0)])


def accion_hablar(a, sup):
    """Gesticula mientras habla, sin repetir el mismo trazo: la derecha lleva el ritmo
    (golpes cortos hacia abajo en los acentos, la palma que voltea al explicar), la
    izquierda acompaña a destiempo y al final las dos se abren encogiendo los hombros.
    La quijada la mueve el sitio con las letras."""
    L = 120
    piernas(a)
    p_arriba = lambda s_: mano_q((0.25 * s_, -0.9, 0.3), (0.3 * s_, 0.1, 1.0))
    p_fuera = lambda s_: mano_q((0.1 * s_, -0.7, 0.7), (-0.6 * s_, -0.5, 0.6))
    rR, rL = a.reposo_mano["R"], a.reposo_mano["L"]
    A = Vector((-0.46, -0.8, 1.2))
    B_ = Vector((-0.56, -0.7, 1.32))
    C = Vector((-0.64, -0.44, 1.02))
    D = Vector((-0.42, -0.84, 1.28))
    E = Vector((-0.5, -0.8, 1.26))
    a.brazo("R", [reposo(a, "R", 0), (6, rR + Vector((0, -0.03, 0.04)), None, None, False),
                  (12, A, None, p_arriba(-1), True), (16, A + Vector((0, 0, -0.045)), None, p_arriba(-1), True),
                  (21, A + Vector((0.03, -0.02, 0.03)), None, p_fuera(-1), False),
                  (28, B_, None, p_fuera(-1), True), (33, B_ + Vector((0, 0, -0.05)), None, p_fuera(-1), True),
                  (40, B_ + Vector((-0.03, 0.02, 0.0)), None, p_fuera(-1), False),
                  (50, C, None, None, True), (62, C + Vector((0.01, 0, 0.01)), None, None, False),
                  (71, D, None, None, True), (76, D + Vector((0, 0, -0.05)), None, None, True), (80, D + Vector((0, 0.01, 0.01)), None, None, False),
                  (87, E, None, p_arriba(-1), True), (92, E + Vector((-0.03, 0, -0.035)), None, p_arriba(-1), True),
                  (101, E + Vector((-0.08, 0.02, 0.05)), None, p_fuera(-1), True), reposo(a, "R", 112), reposo(a, "R", L)])
    F = Vector((0.48, -0.74, 1.14))
    G = Vector((0.56, -0.64, 1.3))
    H = Vector((0.5, -0.8, 1.26))
    a.brazo("L", [reposo(a, "L", 0), reposo(a, "L", 18), (30, F, None, p_arriba(1), True), (36, F + Vector((0, 0, -0.04)), None, p_arriba(1), True),
                  (44, F + Vector((0.03, -0.01, 0.03)), None, p_fuera(1), False), (54, G, None, p_fuera(1), True),
                  (60, G + Vector((0, 0, -0.04)), None, p_fuera(1), True), (69, Vector((0.62, -0.46, 1.02)), None, None, False),
                  (87, H, None, p_arriba(1), True), (93, H + Vector((0.03, 0, -0.03)), None, p_arriba(1), True),
                  (101, H + Vector((0.08, 0.02, 0.05)), None, p_fuera(1), True), reposo(a, "L", 113), reposo(a, "L", L)])
    a.mano("R", [(0, "suelta"), (10, "abierta"), (16, ("abierta", {"index": 12, "middle": 10})), (22, "abierta"), (33, ("abierta", {"index": 10})),
                 (44, "abierta"), (52, "suelta"), (70, ("suelta", {"index": -8})), (76, ("suelta", {"index": 8})), (86, "abierta"), (101, "abierta"),
                 (112, "suelta"), (L, "suelta")])
    a.mano("L", [(0, "suelta"), (26, "abierta"), (36, ("abierta", {"middle": 10, "ring": 10})), (50, "abierta"), (66, "suelta"),
                 (86, "abierta"), (101, "abierta"), (113, "suelta"), (L, "suelta")])
    for lado, s_ in (("L", 1), ("R", -1)):
        a.rot(BRAZO[lado][0], [(0, I), (92, I), (101, [(FRENTE, 8 * s_)], "BACK", "EASE_OUT", 1.5), (110, I), (L, I)])
    a.rot("chest_03", [(0, I), (12, [(ARRIBA, -5), (IZQ, 2)]), (16, [(ARRIBA, -5), (IZQ, 4)]), (30, [(ARRIBA, -2)]), (36, [(ARRIBA, 4), (IZQ, 3)]),
                       (54, [(ARRIBA, 5)]), (71, [(ARRIBA, -4), (IZQ, 2)]), (76, [(ARRIBA, -4), (IZQ, 4)]), (92, [(IZQ, 3)]), (101, [(IZQ, -4)]), (L, I)])
    a.rot("spine_02", [(0, I), (16, [(IZQ, 2)]), (36, [(IZQ, 2)]), (76, [(IZQ, 2)]), (101, [(IZQ, -2)]), (L, I)])
    a.rot("head_05", [(0, I), (10, [(IZQ, -3), (ARRIBA, -4)]), (16, [(IZQ, 6), (ARRIBA, -5)], "BACK", "EASE_OUT", 1.4), (24, [(IZQ, 0), (ARRIBA, -3), (FRENTE, 3)]),
                      (33, [(IZQ, 6), (ARRIBA, -4)], "BACK", "EASE_OUT", 1.4), (44, [(IZQ, -2), (ARRIBA, 4), (FRENTE, -3)]), (60, [(IZQ, 4), (ARRIBA, 5)]),
                      (76, [(IZQ, 7), (ARRIBA, -3)], "BACK", "EASE_OUT", 1.4), (86, [(IZQ, -2), (FRENTE, 4)]), (92, [(IZQ, 5)]),
                      (101, [(IZQ, -6), (FRENTE, -5)]), (112, [(IZQ, 1)]), (L, I)])
    a.loc("hips_01", [(0, (0, 0, 0)), (16, (-0.012, 0, -0.008)), (36, (0.012, 0, -0.006)), (60, (0.01, 0, -0.002)), (76, (-0.01, 0, -0.008)),
                      (101, (0, 0, 0.006)), (L, (0, 0, 0))])
    quijada(a, [(0, 0), (L, 0)])


def accion_empujon(a, sup):
    """El empujón: se hace para atrás juntando fuerza y avienta los brazos rectos al
    frente, cada uno desde su hombro, con las palmas al frente. Va con el tiempo del
    empujón de ZoidianNPC (el golpe cae a los 0.13 s)."""
    L = 26
    piernas(a)
    a.loc("hips_01", [(0, (0, 0, 0)), (3, (0, 0.03, -0.012)), (6, (0, -0.05, -0.02), "BACK", "EASE_OUT", 1.6), (12, (0, -0.03, -0.012)), (L, (0, 0, 0))])
    a.rot("chest_03", [(0, I), (3, [(IZQ, -6)]), (6, [(IZQ, 10)], "BACK", "EASE_OUT", 1.5), (12, [(IZQ, 7)]), (L, I)])
    a.rot("spine_02", [(0, I), (3, [(IZQ, -3)]), (6, [(IZQ, 4)]), (12, [(IZQ, 3)]), (L, I)])
    a.rot("head_05", [(0, I), (3, [(IZQ, -5)]), (6, [(IZQ, 7)], "BACK", "EASE_OUT", 1.5), (12, [(IZQ, 4)]), (L, I)])
    palma = mano_q((0.0, -0.15, 1.0), (0.0, -1.0, 0.0))
    for lado, s_ in (("L", 1), ("R", -1)):
        a.brazo(lado, [reposo(a, lado, 0), (3, Vector((0.6 * s_, -0.3, 1.2)), None, None, True),
                       (6, Vector((0.5 * s_, -1.2, 1.45)), None, palma, True), (11, Vector((0.5 * s_, -1.18, 1.43)), None, palma, True),
                       (17, Vector((0.62 * s_, -0.7, 1.15)), None, None, False), reposo(a, lado, L)])
        a.mano(lado, [(0, "suelta"), (3, ("suelta", {"index": 20, "middle": 20, "ring": 20})), (6, "abierta", "BACK", "EASE_OUT", 1.6),
                      (12, "abierta"), (L, "suelta")])
    quijada(a, [(0, 0), (3, -3), (6, 12), (12, 8), (L, 0)])


def _gira(eje, grados):
    return Quaternion(Vector(eje).normalized(), math.radians(grados))


def accion_trato(a, sup):
    """Propone el trato: se frota las manos, maquinando, y extiende la derecha para
    cerrarlo de mano. Las manos se frotan solas (cada una se mueve y gira poquito
    sobre la palma, a destiempo de la otra) y los dedos van sueltos detrás."""
    L = 84
    piernas(a)
    a.loc("hips_01", [(0, (0, 0, 0)), (8, (0, 0.01, -0.012)), (40, (0, 0.01, -0.014)), (50, (0, -0.012, -0.004), "BACK", "EASE_OUT", 1.4),
                      (74, (0, -0.008, -0.004)), (L, (0, 0, 0))])
    a.rot("chest_03", [(0, I), (8, [(IZQ, 6), (ARRIBA, 3)]), (40, [(IZQ, 7), (ARRIBA, 2)]), (50, [(IZQ, 3), (ARRIBA, -6)], "BACK", "EASE_OUT", 1.4),
                       (74, [(IZQ, 2), (ARRIBA, -5)]), (L, I)])
    a.rot("head_05", [(0, I), (8, [(IZQ, 6), (FRENTE, 7)]), (24, [(IZQ, 5), (FRENTE, 9)]), (40, [(IZQ, 6), (FRENTE, 7)]),
                      (50, [(IZQ, -4), (FRENTE, -3)], "BACK", "EASE_OUT", 1.5), (62, [(IZQ, 2), (FRENTE, 2)]), (74, [(IZQ, -1)]), (L, I)])
    for lado, s_ in (("L", 1), ("R", -1)):
        a.rot(BRAZO[lado][0], [(0, I), (8, [(FRENTE, 6 * s_)]), (40, [(FRENTE, 7 * s_)]), (50, I), (L, I)])
    # las manos juntas frente al pecho, palma con palma, los dedos al frente y arriba
    qL = mano_q((-0.25, -0.75, 0.6), (-1.0, 0.0, 0.0))
    qR = mano_q((0.25, -0.75, 0.6), (1.0, 0.0, 0.0))
    # arriba de la panza y adelante: más abajo los antebrazos se metían en ella
    cL, cR = Vector((0.135, -0.86, 1.28)), Vector((-0.135, -0.86, 1.28))
    F0, F1, T = 12, 40, 9.0

    def env(f):
        return _suave((f - F0 + 2) / 5) * _suave((F1 + 2 - f) / 5)
    # el codo fijo mientras se frota (el que escoge el solucionador para esta pose,
    # afuera y atrás): resuelto clave por clave cambiaba unos grados y brincaba
    CODO_L, CODO_R = 38, -28
    clL = [reposo(a, "L", 0), (8, cL + Vector((0.02, 0.02, -0.02)), CODO_L, qL, False)]
    clR = [reposo(a, "R", 0), (8, cR + Vector((-0.02, 0.02, -0.02)), CODO_R, qR, False)]
    for f in range(F0 - 2, F1 + 3, 2):
        e = env(f)
        ph = 2 * math.pi * (f - F0) / T
        clL.append((f, cL + Vector((0, 0.035 * math.sin(ph), 0.014 * math.cos(ph))) * e, CODO_L, _gira((-1, 0, 0), 9 * math.sin(ph - 0.9) * e) @ qL, False))
        clR.append((f, cR + Vector((0, -0.035 * math.sin(ph), -0.014 * math.cos(ph))) * e, CODO_R, _gira((1, 0, 0), 9 * math.sin(ph - 0.9) * e) @ qR, False))
    # la derecha se extiende para cerrar el trato (de mano: palma hacia su izquierda,
    # pulgar arriba); la izquierda regresa
    ofrece = Vector((-0.3, -1.08, 1.12))
    q_mano = mano_q((0.1, -1.0, 0.05), (1.0, 0.0, -0.1))
    clR += [(46, ofrece + Vector((0.03, 0.12, 0.05)), CODO_R * 0.5, q_mano, False), (51, ofrece + Vector((0, -0.03, 0)), None, q_mano, False),
            (55, ofrece, None, q_mano, True), (62, ofrece + Vector((0, 0, -0.03)), None, _gira((1, 0, 0), -8) @ q_mano, False),
            (66, ofrece + Vector((0, -0.01, 0.01)), None, q_mano, True), (71, ofrece, None, q_mano, True),
            (77, a.reposo_mano["R"] + Vector((0.04, -0.2, 0.14)), None, None, False), reposo(a, "R", 84)]
    clL += [(48, a.reposo_mano["L"] + Vector((-0.06, -0.06, 0.08)), CODO_L * 0.4, None, False), reposo(a, "L", 57), reposo(a, "L", L)]
    a.brazo("L", clL)
    a.brazo("R", clR)
    for lado in ("L", "R"):
        dd = [(0, "suelta"), (8, ("suelta", {"index": -4, "middle": -4, "ring": -2}))]
        for f in range(F0, F1 + 1, 2):
            e = env(f)
            fl = [7 * math.sin(2 * math.pi * (f - F0 - at) / T) * e for at in (2.5, 3.2, 3.9)]
            dd.append((f, ("suelta", {"index": -4 + fl[0], "middle": -4 + fl[1], "ring": -2 + fl[2]}), "LINEAR"))
        if lado == "R":
            dd += [(46, ("suelta", {"index": -2, "middle": 0, "ring": 2, "thumb": -18})), (72, ("suelta", {"index": -2, "middle": 0, "ring": 2, "thumb": -18})),
                   (L, "suelta")]
        else:
            dd += [(52, "suelta"), (L, "suelta")]
        a.mano(lado, dd)
    quijada(a, [(0, 0), (10, 3), (40, 3), (48, 9), (56, 4), (L, 0)])


def accion_senalar(a, sup):
    """Señala allá (arriba a su derecha): se echa tantito para atrás, avienta el
    brazo con el índice, se pasa y se asienta, y da dos piquetes de énfasis. La
    cabeza la voltea el sitio hacia el portal que toque."""
    L = 66
    piernas(a)
    d = Vector((-0.62, -0.6, 0.3)).normalized()
    punta = Vector((-0.92, -0.66, 1.56))
    q_p = mano_q(d, (0.15, 0.1, -1.0))
    eje_flick = q_p @ Vector((1, 0, 0))
    rep = a.reposo_mano["R"]
    a.brazo("R", [reposo(a, "R", 0), (6, rep + Vector((0.04, 0.05, 0.02)), 0, None, True),
                  (12, punta + d * 0.06, None, _gira(eje_flick, -12) @ q_p, False), (17, punta - d * 0.015, None, _gira(eje_flick, 5) @ q_p, False),
                  (21, punta, None, q_p, True),
                  (25, punta + d * 0.045, None, _gira(eje_flick, -10) @ q_p, False), (29, punta, None, _gira(eje_flick, 4) @ q_p, False),
                  (33, punta + d * 0.045, None, _gira(eje_flick, -10) @ q_p, False), (37, punta, None, _gira(eje_flick, 4) @ q_p, False),
                  (41, punta, None, q_p, True), (48, punta + Vector((0, 0, -0.02)), None, q_p, True),
                  (56, rep + Vector((-0.06, -0.08, 0.1)), None, None, False), reposo(a, "R", 63), reposo(a, "R", L)])
    a.mano("R", [(0, "suelta"), (9, "senala", "BACK", "EASE_OUT", 1.5), (50, "senala"), (58, "suelta"), (L, "suelta")])
    a.loc("hips_01", [(0, (0, 0, 0)), (6, (0, 0.012, -0.006)), (14, (-0.01, -0.012, 0.006), "BACK", "EASE_OUT", 1.5), (48, (-0.008, -0.008, 0.002)), (L, (0, 0, 0))])
    a.rot("chest_03", [(0, I), (6, [(IZQ, -4), (ARRIBA, 4)]), (14, [(IZQ, 4), (ARRIBA, -10)], "BACK", "EASE_OUT", 1.5), (25, [(IZQ, 5), (ARRIBA, -10)]),
                       (33, [(IZQ, 5), (ARRIBA, -10)]), (48, [(IZQ, 3), (ARRIBA, -8)]), (L, I)])
    a.rot("head_05", [(0, I), (6, [(IZQ, -4)]), (14, [(IZQ, 3), (ARRIBA, -8)], "BACK", "EASE_OUT", 1.4), (25, [(IZQ, 5), (ARRIBA, -8)]),
                      (29, [(IZQ, 2), (ARRIBA, -8)]), (33, [(IZQ, 5), (ARRIBA, -8)]), (48, [(ARRIBA, -6)]), (L, I)])
    a.rot(BRAZO["R"][0], [(0, I), (14, [(FRENTE, -6)]), (48, [(FRENTE, -5)]), (58, I), (L, I)])
    quijada(a, [(0, 0), (12, 8), (20, 4), (25, 7), (29, 3), (33, 7), (37, 3), (48, 0), (L, 0)])


def accion_presumir(a, sup):
    """Presume: saca el pecho, presenta con la derecha (palma arriba, como quien
    enseña el premio) y se da dos palmadas en el pecho con la izquierda: "yo"."""
    L = 72
    piernas(a)
    a.loc("hips_01", [(0, (0, 0, 0)), (8, (0, 0.012, -0.008)), (16, (0, 0.02, 0.014), "BACK", "EASE_OUT", 1.5), (50, (0, 0.016, 0.008)), (L, (0, 0, 0))])
    a.rot("chest_03", [(0, I), (8, [(IZQ, 4), (ARRIBA, 4)]), (16, [(IZQ, -8), (ARRIBA, -5)], "BACK", "EASE_OUT", 1.5), (50, [(IZQ, -7), (ARRIBA, -4)]), (L, I)])
    a.rot("spine_02", [(0, I), (16, [(IZQ, -3)]), (50, [(IZQ, -3)]), (L, I)])
    a.rot("head_05", [(0, I), (8, [(IZQ, 4)]), (16, [(IZQ, -9), (FRENTE, -4)], "BACK", "EASE_OUT", 1.5), (28, [(IZQ, -7), (FRENTE, -6)]),
                      (36, [(IZQ, -3), (FRENTE, -5)]), (50, [(IZQ, -8), (FRENTE, -5)]), (L, I)])
    # la derecha: cruza tantito (anticipación) y abre hacia su lado con la palma arriba
    presenta = Vector((-0.88, -0.58, 1.3))
    q_pres = mano_q((-0.75, -0.55, 0.15), (0.05, 0.1, 1.0))
    eje = q_pres @ Vector((0, 0, 1))
    clR = [reposo(a, "R", 0), (8, Vector((-0.32, -0.8, 1.12)), None, None, False), (15, presenta + Vector((-0.03, -0.03, 0.04)), None, _gira(eje, 12) @ q_pres, False),
           (20, presenta, None, q_pres, True)]
    for k, f in enumerate(range(24, 50, 4)):
        clR.append((f, presenta + Vector((0, 0, 0.01 * math.sin(k * 1.6))), None, _gira(eje, 7 * math.sin(k * 1.6 - 0.8)) @ q_pres, False))
    clR += [(50, presenta, None, q_pres, True), (60, a.reposo_mano["R"] + Vector((-0.06, -0.08, 0.1)), None, None, False), reposo(a, "R", 68), reposo(a, "R", L)]
    a.brazo("R", clR)
    a.mano("R", [(0, "suelta"), (12, ("abierta", {"index": 4, "middle": 6, "ring": 8})), (20, "abierta")] +
           [(f, ("abierta", {"index": 5 * math.sin(k * 1.6 - 2.0), "middle": 5 * math.sin(k * 1.6 - 2.4), "ring": 5 * math.sin(k * 1.6 - 2.8)}), "LINEAR")
            for k, f in enumerate(range(24, 50, 4))] + [(54, "abierta"), (62, "suelta"), (L, "suelta")])
    # la izquierda: dos palmadas en el pecho (plana, los dedos hacia su derecha)
    p0, px, pz = sup(0.17, 1.3), sup(0.21, 1.3), sup(0.17, 1.34)
    normal = (px - p0).cross(pz - p0).normalized()
    if normal.y > 0:
        normal = -normal
    dedos = ((p0 - px).normalized() * 0.9 + Vector((0, 0, 0.3))).normalized()
    dedos = (dedos - dedos.dot(normal) * normal).normalized()
    # la palma ve tantito hacia abajo (el anular, el filo de abajo de la mano, rozaba)
    q_pecho = mano_q(dedos, (-normal + Vector((0, 0, -0.35))).normalized())
    en_pecho = p0 + normal * 0.145 - dedos * 0.1
    lejos = en_pecho + normal * 0.07
    a.brazo("L", [reposo(a, "L", 0), reposo(a, "L", 16), (24, lejos, None, q_pecho, False), (28, en_pecho, None, q_pecho, False), (32, lejos, None, q_pecho, False),
                  (36, en_pecho, None, q_pecho, False), (42, lejos + normal * 0.02, None, q_pecho, False),
                  (52, a.reposo_mano["L"] + Vector((0.04, -0.06, 0.08)), None, None, False), reposo(a, "L", 60), reposo(a, "L", L)])
    plana = ("suelta", {"index": -6, "middle": -6, "ring": -4, "thumb": -18})
    a.mano("L", [(0, "suelta"), (22, plana), (40, plana), (50, "suelta"), (L, "suelta")])
    quijada(a, [(0, 0), (16, 2), (50, 2), (L, 0)])


def accion_encogerse(a, sup):
    """Se encoge de hombros, "ni modo": los hombros suben, los codos se pegan, las
    palmas se abren hacia arriba y la cabeza se ladea; al soltarlo todo cae con su
    columpio."""
    L = 54
    piernas(a)
    a.loc("hips_01", [(0, (0, 0, 0)), (4, (0, 0, -0.01)), (10, (0, 0.006, 0.012), "BACK", "EASE_OUT", 1.5), (30, (0, 0.006, 0.008)), (40, (0, 0, -0.008)), (L, (0, 0, 0))])
    for lado, s_ in (("L", 1), ("R", -1)):
        a.rot(BRAZO[lado][0], [(0, I), (4, [(FRENTE, -2 * s_)]), (10, [(FRENTE, 13 * s_)], "BACK", "EASE_OUT", 1.6), (30, [(FRENTE, 12 * s_)]),
                               (38, [(FRENTE, -2 * s_)], "BACK", "EASE_OUT", 1.3), (46, I), (L, I)])
        q_ab = mano_q((0.35 * s_, -0.92, 0.12), (0.3 * s_, 0.0, 1.0))
        w = Vector((0.72 * s_, -0.62, 1.0))
        a.brazo(lado, [reposo(a, lado, 0), (5, a.reposo_mano[lado] + Vector((0, 0.02, 0.02)), None, None, False), (10, w + Vector((0.02 * s_, -0.02, 0.03)), None, q_ab, False),
                       (14, w, None, q_ab, True), (22, w + Vector((0, 0, 0.012)), None, q_ab, False), (30, w, None, q_ab, True),
                       (38, a.reposo_mano[lado] + Vector((0.02 * s_, -0.04, 0.03)), None, None, False), (44, a.reposo_mano[lado] + Vector((0, 0.02, -0.01)), None, None, False),
                       reposo(a, lado, 50), reposo(a, lado, L)])
        a.mano(lado, [(0, "suelta"), (9, ("abierta", {"index": 6, "middle": 8, "ring": 10})), (13, "abierta"), (30, "abierta"),
                      (36, ("suelta", {"index": -6, "middle": -4, "ring": -2})), (42, ("suelta", {"index": 8, "middle": 10, "ring": 12})), (L, "suelta")])
    a.rot("chest_03", [(0, I), (10, [(IZQ, -4)], "BACK", "EASE_OUT", 1.5), (30, [(IZQ, -3)]), (40, [(IZQ, 2)]), (L, I)])
    a.rot("head_05", [(0, I), (10, [(IZQ, -3), (FRENTE, 11)], "BACK", "EASE_OUT", 1.5), (22, [(IZQ, -2), (FRENTE, 9)]), (30, [(IZQ, -3), (FRENTE, 10)]),
                      (40, [(IZQ, 3), (FRENTE, -2)]), (L, I)])
    quijada(a, [(0, 0), (10, 5), (30, 4), (40, 0), (L, 0)])


def accion_celebrar(a, sup):
    """Trato hecho: se agacha, brinca con los puños arriba en V y los jala dos
    veces, riéndose."""
    L = 54
    piernas(a)
    a.loc("hips_01", [(0, (0, 0, 0)), (5, (0, 0.01, -0.035)), (11, (0, -0.005, 0.06), "SINE", "EASE_OUT"), (16, (0, 0, -0.03)), (20, (0, 0, 0.0)),
                      (24, (0, 0, -0.018), "BACK", "EASE_OUT", 1.6), (30, (0, 0, -0.004)), (34, (0, 0, -0.02), "BACK", "EASE_OUT", 1.6), (44, (0, 0, 0)), (L, (0, 0, 0))])
    a.rot("chest_03", [(0, I), (5, [(IZQ, 7)]), (11, [(IZQ, -9)], "BACK", "EASE_OUT", 1.4), (16, [(IZQ, -2)]), (24, [(IZQ, 5)]), (30, [(IZQ, -4)]), (34, [(IZQ, 5)]),
                       (44, I), (L, I)])
    a.rot("head_05", [(0, I), (5, [(IZQ, 6)]), (11, [(IZQ, -13)], "BACK", "EASE_OUT", 1.5), (18, [(IZQ, -9)]), (24, [(IZQ, 4)]), (30, [(IZQ, -6)]), (34, [(IZQ, 5)]),
                      (44, [(IZQ, -2)]), (L, I)])
    for lado, s_ in (("L", 1), ("R", -1)):
        arriba = Vector((0.8 * s_, -0.32, 1.98))
        abajo = Vector((0.62 * s_, -0.58, 1.5))
        a.brazo(lado, [reposo(a, lado, 0), (5, a.reposo_mano[lado] + Vector((0, 0.03, -0.02)), None, None, False), (11, arriba + Vector((0.02 * s_, 0, 0.04)), None, None, False),
                       (15, arriba, None, None, True), (21, abajo, None, None, False), (26, arriba + Vector((0, -0.02, -0.03)), None, None, False),
                       (31, abajo, None, None, False), (36, arriba + Vector((0, -0.04, -0.08)), None, None, False),
                       (44, a.reposo_mano[lado] + Vector((0.03 * s_, -0.05, 0.08)), None, None, False), reposo(a, lado, 50), reposo(a, lado, L)])
        a.mano(lado, [(0, "suelta"), (8, "puno", "BACK", "EASE_OUT", 1.6), (38, "puno"), (46, "suelta"), (L, "suelta")])
    quijada(a, [(0, 0), (5, 4), (11, 26), (16, 20), (21, 26), (26, 16), (31, 26), (38, 14), (46, 0), (L, 0)])


ESCRIBIR = {
    "Idle": accion_idle,
    "IdleMirar": accion_mirar,
    "IdleImpaciente": accion_impaciente,
    "IdleComer": accion_comer,
    "Saludo": accion_saludo,
    "Risa": accion_risa,
    "Impresionado": accion_impresionado,
    "Hablar": accion_hablar,
    "Empujon": accion_empujon,
    "Trato": accion_trato,
    "Senalar": accion_senalar,
    "Presumir": accion_presumir,
    "Encogerse": accion_encogerse,
    "Celebrar": accion_celebrar,
}


def superficie(malla):
    """sup(x, z): el punto de enfrente del cuerpo (en reposo) a esa altura."""
    from mathutils.bvhtree import BVHTree
    me = malla.data
    bvh = BVHTree.FromPolygons([v.co for v in me.vertices], [list(p.vertices) for p in me.polygons], all_triangles=False)

    def sup(x, z):
        hit = bvh.ray_cast(Vector((x, -3.0, z)), Vector((0, 1, 0)), 6.0)
        return hit[0].copy() if hit[0] is not None else Vector((x, -0.45, z))
    return sup


def esfera_en_mano(arm):
    """Dónde va la esfera en el espacio de la mano derecha: en la palma (-Z), cerca de
    los nudillos."""
    B = arm.data.bones
    mano = B["hand.R_027"]
    nud = sum((B[d[0]].head_local for k, d in DEDOS["R"].items() if k != "thumb"), Vector()) / 3
    loc_nud = mano.matrix_local.inverted() @ nud
    return Matrix.Translation(Vector((loc_nud.x * 0.5, loc_nud.y * 0.72, -ESFERA_R * 1.2)))


def animar(arm, malla, solo=None):
    sc = bpy.context.scene
    sc.render.fps = FPS
    sup = superficie(malla)
    cuerpo_forma = forma_cuerpo(arm, malla)
    B = arm.data.bones
    hechas = []
    for nombre, cfg in ACCIONES.items():
        if solo and nombre not in solo:
            continue
        a = Autor(arm, nombre, cfg["cuadros"], cfg["ciclo"])
        a.reposo_mano = {l: B[BRAZO[l][3]].head_local.copy() for l in ("L", "R")}
        a.esfera_off = esfera_en_mano(arm)
        a.cuerpo_forma = cuerpo_forma
        a.qmano_reposo = lambda lado, ev: ev[BRAZO[lado][3]].to_quaternion()
        ESCRIBIR[nombre](a, sup)
        hechas.append(a.terminar())
    arm.animation_data.action = bpy.data.actions["Idle"]
    return hechas
