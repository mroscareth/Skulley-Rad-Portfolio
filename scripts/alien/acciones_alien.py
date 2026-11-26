"""
Las acciones del Unemployed Alien, en estilo de caricatura de manguera (rubber
hose): arcos, rebote al ritmo, squash & stretch, anticipación y asentamiento, y
retraso en cadena (el hombro jala al codo, el codo a la muñeca, la muñeca a los
dedos) para que nada se mueva tieso.

Lo usa armar_alien.py (comando `animar`). Cada clip se calcula cuadro por cuadro
con funciones del tiempo (curvas con easing, ondas con desfase, resortes) y se
hornea en una acción con clave en cada cuadro para todos los huesos del cuerpo (en
el sitio un hueso sin pista se queda pegado). La cara (ojos, párpados, quijada y
lengua) no va en los clips: la mueve el sitio (parpadeo, quijada letra por letra).

Reglas de Oscar que se cumplen aquí:
  - cada clip parte y acaba en su propia pose (no hereda la del anterior ni la del
    idle); la mezcla entre clips la hace el sitio;
  - nada atraviesa el cuerpo ni el piso: `medir` revisa cuadro por cuadro.

Convenciones (el reposo es la pose A del modelo):
  tronco(adelante, voltea, ladea): giros en ejes del mundo en reposo (+X del mundo
  es la izquierda del alien; mira a -Y): adelante = se dobla hacia el frente,
  voltea = gira a su izquierda, ladea = sube su lado izquierdo (se inclina a su
  derecha).
  brazo(lado, abre, frente, giro): dirección del brazo desde colgado (0, 0): abre
  lo levanta hacia afuera (90 = horizontal), frente hacia adelante (90 = al frente,
  negativo hacia atrás); giro sobre su eje (positivo = hacia afuera / palma arriba).
  Codo, mano y dedos: +X dobla (el codo hacia adelante, la mano y los dedos hacia
  la palma). Las piernas van con IK (pies plantados).
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

FPS = 30
TAU = 2 * math.pi
IZQ = Vector((1, 0, 0))
ATRAS = Vector((0, 1, 0))
ARRIBA = Vector((0, 0, 1))
FRENTE = -ATRAS
CARA = ("ojo_", "parpado_", "quijada", "lengua_")
DEDOS = ("thumb", "index", "middle", "ring")
I = Quaternion()


# ---------------------------------------------------------------- curvas

def suave(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def suave5(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


def entra(t):     # ease in (arranca lento)
    t = min(1.0, max(0.0, t))
    return t * t * t


def sale(t):      # ease out (frena al llegar)
    t = min(1.0, max(0.0, t))
    return 1 - (1 - t) ** 3


def rebote(fase):
    """Golpe de rebote de 0 a 1 en un ciclo (fase 0..1): baja rápido y sube suave,
    como un resorte; 0 en la fase 0 y casi 0 al final."""
    f = fase % 1.0
    return math.sin(math.pi * f) ** 2 * math.exp(-1.6 * f) / 0.52


def onda(t, periodo, desfase=0.0):
    return math.sin(TAU * (t - desfase) / periodo)


class Claves:
    """Curva por claves [(cuadro, valor, easing)] con easing por tramo (el easing
    de una clave es cómo se llega a ella): 's' suave, 'i' entra, 'o' sale, 'l'
    lineal, 'b' se pasa y regresa (back)."""

    def __init__(self, claves):
        self.k = [(float(c[0]), np.atleast_1d(np.asarray(c[1], float)), c[2] if len(c) > 2 else "s") for c in claves]

    def __call__(self, t):
        k = self.k
        if t <= k[0][0]:
            v = k[0][1]
        elif t >= k[-1][0]:
            v = k[-1][1]
        else:
            for (t0, v0, _), (t1, v1, e) in zip(k, k[1:]):
                if t0 <= t <= t1:
                    u = (t - t0) / max(1e-9, t1 - t0)
                    if e == "i":
                        w = entra(u)
                    elif e == "o":
                        w = sale(u)
                    elif e == "l":
                        w = u
                    elif e == "b":
                        s = 1.7
                        w = 1 + (s + 1) * (u - 1) ** 3 + s * (u - 1) ** 2
                    else:
                        w = suave(u)
                    v = v0 + (v1 - v0) * w
                    break
        return v if len(v) > 1 else float(v[0])


def resorte(serie, frecuencia=3.0, amort=0.35, ciclo=False):
    """Sigue la serie (un valor por cuadro) con un resorte amortiguado: se pasa y
    regresa (seguimiento, follow-through). En un ciclo corre tres vueltas para que
    empate al dar la vuelta."""
    x = np.asarray(serie, float)
    n = len(x)
    w = TAU * frecuencia
    dt = 1.0 / FPS
    pos, vel = x[0].copy() if x.ndim > 1 else float(x[0]), 0.0 * x[0]
    out = np.zeros_like(x)
    vueltas = 3 if ciclo else 1
    for v in range(vueltas):
        for i in range(n):
            for _ in range(4):
                h = dt / 4
                acc = w * w * (x[i] - pos) - 2 * amort * w * vel
                vel = vel + acc * h
                pos = pos + vel * h
            if v == vueltas - 1:
                out[i] = pos
    return out


# ---------------------------------------------------------------- giros

def q(eje, grados):
    return Quaternion(Vector(eje).normalized(), math.radians(grados))


def qs(*giros):
    """Compone giros (eje, grados): el primero se aplica primero."""
    out = Quaternion()
    for eje, g in giros:
        out = q(eje, g) @ out
    return out


def espejo_eje(v, lado):
    return Vector(v) if lado == "L" else Vector((v[0], -v[1], -v[2]))


def tronco(adelante=0.0, voltea=0.0, ladea=0.0):
    return qs((IZQ, adelante), (FRENTE, ladea), (ARRIBA, voltea))


def local(x=0.0, y=0.0, z=0.0):
    """Giro en los ejes del hueso (X dobla, Z de lado, Y sobre su eje)."""
    return qs((Vector((0, 1, 0)), y), (Vector((0, 0, 1)), z), (Vector((1, 0, 0)), x))


# ---------------------------------------------------------------- el rig

class Rig:
    def __init__(self, arm):
        self.arm = arm
        B = arm.data.bones
        self.rest = {b.name: b.matrix_local.copy() for b in B}
        self.qr = {b.name: b.matrix_local.to_quaternion() for b in B}
        self.padre = {b.name: (b.parent.name if b.parent else None) for b in B}
        self.orden = []

        def rec(b):
            self.orden.append(b.name)
            for c in b.children:
                rec(c)
        for b in B:
            if b.parent is None:
                rec(b)
        self.cuerpo = [n for n in self.orden if not n.startswith(CARA)]
        self.cabeza = {n: Vector(B[n].head_local) for n in self.orden}
        self.cola = {n: Vector(B[n].tail_local) for n in self.orden}

    def pose_vacia(self):
        return {n: [Quaternion(), Vector(), Vector((1, 1, 1))] for n in self.cuerpo}

    def mundo(self, nombre, g):
        """Giro g en ejes del mundo en reposo → giro local del hueso."""
        qr = self.qr[nombre]
        return qr.inverted() @ g @ qr

    def fk(self, pose, hasta=None):
        """Matrices posadas (espacio del armature) de cada hueso."""
        M = {}
        for n in self.orden:
            p = self.padre[n]
            qv, lv, sv = pose.get(n, (I, Vector(), Vector((1, 1, 1))))
            base = Matrix.Translation(lv) @ qv.to_matrix().to_4x4() @ Matrix.Diagonal((*sv, 1))
            if p is None:
                M[n] = self.rest[n] @ base
            else:
                M[n] = M[p] @ self.rest[p].inverted() @ self.rest[n] @ base
            if n == hasta:
                break
        return M

    def mundo_padre(self, pose, nombre):
        """Matriz del padre posado por la relación de reposo (el hueso con base identidad)."""
        p = self.padre[nombre]
        M = self.fk(pose)
        return M[p] @ self.rest[p].inverted() @ self.rest[nombre], M

    def poner_mundo(self, pose, nombre, R_des):
        """Pone el giro local de un hueso para que en el mundo quede con R_des (3x3)."""
        base, _ = self.mundo_padre(pose, nombre)
        Rb = base.to_3x3().normalized()
        pose[nombre][0] = (Rb.inverted() @ R_des).to_quaternion()

    def ik2(self, pose, sup, inf, meta, polo, z_sup_es_polo=True, z_inf_es_polo=False):
        """IK de dos huesos: lleva la cola de `inf` a `meta` con la coyuntura de en
        medio hacia `polo` (dirección). Los ejes Z de los huesos quedan como en el
        reposo del rig (piernas: Z del muslo al frente = polo, Z de la espinilla
        atrás; brazos: Z al frente = contra el polo, el codo apunta atrás)."""
        base, M = self.mundo_padre(pose, sup)
        H = base.translation
        l1 = (self.cola[sup] - self.cabeza[sup]).length
        l2 = (self.cola[inf] - self.cabeza[inf]).length
        T = Vector(meta)
        d = (T - H).length
        d = min(max(d, abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995)
        u = (T - H).normalized()
        p = Vector(polo)
        p = (p - p.dot(u) * u).normalized()
        ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
        A = math.acos(max(-1.0, min(1.0, ca)))
        t = u * math.cos(A) + p * math.sin(A)
        K = H + t * l1
        s = (H + u * d - K).normalized()

        def rot(y, z):
            z = (z - z.dot(y) * y).normalized()
            x = y.cross(z)
            return Matrix((x, y, z)).transposed()
        self.poner_mundo(pose, sup, rot(t, p if z_sup_es_polo else -p))
        self.poner_mundo(pose, inf, rot(s, p if z_inf_es_polo else -p))
        return K

    def brazo_q(self, lado, abre, frente, giro=0.0):
        """Giro (ejes del mundo en reposo) del brazo superior para que apunte a la
        dirección (abre, frente) y el codo doble hacia adelante (si el brazo apunta
        al frente, hacia arriba); `giro` voltea hacia afuera hacia dónde dobla."""
        a, f = math.radians(abre), math.radians(frente)
        d = Vector((math.sin(a) * math.cos(f), -math.sin(f), -math.cos(a) * math.cos(f)))
        if lado == "R":
            d.x = -d.x
        z = Vector((0, -1, 0)) + Vector((0, 0, 1)) * max(0.0, -d.y) * 1.2
        z = (z - z.dot(d) * d).normalized()
        # giro: de "al frente" hacia "afuera del cuerpo" (si el brazo ya apunta afuera,
        # afuera es hacia arriba); así no cambia de sentido con el brazo arriba
        fuera = Vector((1 if lado == "L" else -1, 0, 0))
        fuera = fuera - fuera.dot(d) * d - fuera.dot(z) * z
        if fuera.length < 0.35:
            up = Vector((0, 0, 1))
            up = up - up.dot(d) * d - up.dot(z) * z
            fuera = fuera + up * (0.35 - fuera.length) / 0.35
        fuera.normalize()
        g = math.radians(giro)
        z = (z * math.cos(g) + fuera * math.sin(g)).normalized()
        x = d.cross(z)
        R = Matrix((x, d, z)).transposed()
        n = f"upper_arm_{lado}"
        return (R @ self.rest[n].to_3x3().inverted()).to_quaternion()


# ---------------------------------------------------------------- piernas

class Pies:
    """Dónde va cada pie: tobillo, giro del pie (talón arriba = +) y de los dedos."""

    def __init__(self, rig):
        self.r = rig
        self.tob = {l: rig.cabeza[f"foot_{l}"].copy() for l in ("L", "R")}
        self.bola = {l: rig.cabeza[f"toes_{l}"].copy() for l in ("L", "R")}
        self.talon = {l: Vector((self.tob[l].x, self.tob[l].y + 0.06, 0.0)) for l in ("L", "R")}
        self.punta = {l: rig.cola[f"toes_{l}"].copy() for l in ("L", "R")}

    def poner(self, pose, lado, adelante=0.0, alto=0.0, pie=0.0, dedos=0.0, pivote="bola", afuera=0.0, gira=0.0,
              rel=None):
        """adelante: cuánto se corre el pie al frente (m); alto: cuánto se levanta;
        pie: grados de talón arriba (+) o punta arriba (-) en el mundo, girando sobre
        la bola o el talón; dedos: cuánto se doblan los dedos respecto al pie (con
        dedos = pie quedan planos en el piso). rel = (tobillo, peso): en el aire, el
        pie va referido a la espinilla (tobillo = grados de punta abajo respecto a
        ella), así la bota no se dobla de más en el tobillo."""
        r = self.r
        piv = (self.bola if pivote == "bola" else self.talon)[lado].copy()
        Ry = Matrix.Rotation(math.radians(gira if lado == "L" else -gira), 3, "Z")
        mov = Vector((afuera if lado == "L" else -afuera, -adelante, alto))
        rodilla = Ry @ Vector((0, -1, 0))
        p_mundo = pie
        for k in range(4 if rel else 1):
            Rp = Matrix.Rotation(math.radians(pie), 3, "X")
            A = piv + mov + Ry @ (Rp @ (self.tob[lado] - piv))
            if alto > 0.001 or rel:
                # en el aire la suela nunca baja del piso (la línea de los huesos del pie
                # va 3.5 cm arriba de la suela)
                bajo = min(q.z for q in (piv + mov + Ry @ (Rp @ (w - piv)) for w in (self.bola[lado], self.punta[lado],
                                                                                      self.talon[lado] + Vector((0, 0, 0.035)))))
                if bajo < 0.037:
                    A = A + Vector((0, 0, 0.037 - bajo))
            K = r.ik2(pose, f"upper_leg_{lado}", f"lower_leg_{lado}", A, rodilla, True, False)
            if rel and k < 3:
                sd = (A - K).normalized()
                inclina = math.degrees(math.atan2(sd.y, -sd.z))
                pie = (1 - rel[1]) * p_mundo + rel[1] * (rel[0] + inclina)
        R_pie = Ry @ Rp @ r.rest[f"foot_{lado}"].to_3x3()
        r.poner_mundo(pose, f"foot_{lado}", R_pie)
        # los dedos: su giro en el mundo es pie - dedos (con dedos = pie quedan planos
        # en el piso mientras el talón sube; si giraran con el pie, la punta se hundía)
        R_ded = Ry @ Matrix.Rotation(math.radians(pie - dedos), 3, "X") @ r.rest[f"toes_{lado}"].to_3x3()
        r.poner_mundo(pose, f"toes_{lado}", R_ded)


# ---------------------------------------------------------------- manos

FORMAS = {
    "suelta": {"thumb": (8, 6, 4), "index": (14, 16, 10), "middle": (18, 20, 12), "ring": (22, 24, 14)},
    "abierta": {"thumb": (-6, -4, 0), "index": (-6, -4, -2), "middle": (-4, -4, -2), "ring": (-2, -2, 0)},
    "estirada": {"thumb": (-14, -8, -4), "index": (-14, -10, -6), "middle": (-12, -10, -6), "ring": (-10, -8, -4)},
    "puno": {"thumb": (15, 25, 30), "index": (70, 85, 55), "middle": (70, 85, 55), "ring": (70, 85, 55)},
    "senala": {"thumb": (14, 22, 24), "index": (-4, -2, 0), "middle": (64, 78, 50), "ring": (68, 80, 52)},
    "garra": {"thumb": (10, 14, 12), "index": (30, 36, 24), "middle": (32, 38, 26), "ring": (34, 40, 26)},
}


def mano(pose, lado, forma, t=0.0, ola=0.0, ola_periodo=24.0, mezcla=None):
    """Curva cada dedo; `ola` agrega un meneo que corre del índice al anular (y al
    pulgar) con desfase; `mezcla` = (otra forma, peso)."""
    F = FORMAS[forma] if isinstance(forma, str) else forma
    if mezcla:
        G = FORMAS[mezcla[0]] if isinstance(mezcla[0], str) else mezcla[0]
        w = mezcla[1]
        F = {d: tuple(a * (1 - w) + b * w for a, b in zip(F[d], G[d])) for d in DEDOS}
    for i, d in enumerate(DEDOS):
        for k in range(3):
            g = F[d][k] + ola * onda(t, ola_periodo, desfase=3 * i + 2 * k)
            pose[f"{d}_0{k + 1}_{lado}"][0] = local(x=g)


# ---------------------------------------------------------------- clips

class Clip:
    def __init__(self, rig, nombre, cuadros, ciclo):
        self.r, self.nombre, self.n, self.ciclo = rig, nombre, cuadros, ciclo
        self.poses = []

    def tiempos(self):
        return range(self.n + 1)


def _arm(pose, r, lado, abre, frente, giro, codo, mano_x=0.0, mano_z=0.0, mano_y=0.0, hombro=0.0, hombro_atras=0.0,
         antebrazo=0.0):
    """antebrazo: giro del antebrazo entero sobre su eje (+ = palma hacia arriba).
    La muñeca casi no se tuerce (mano_y chico): una mano girada se ve rota."""
    s = 1 if lado == "L" else -1
    pose[f"shoulder_{lado}"][0] = local(x=hombro, z=s * hombro_atras)
    pose[f"upper_arm_{lado}"][0] = r.mundo(f"upper_arm_{lado}", r.brazo_q(lado, abre, frente, giro))
    pose[f"lower_arm_{lado}"][0] = local(x=codo, y=-s * antebrazo)
    pose[f"hand_{lado}"][0] = local(x=mano_x, z=s * mano_z, y=s * mano_y)


def _torso(pose, r, cadera=(0, 0, 0), cad_rot=(0, 0, 0), spine=(0, 0, 0), chest=(0, 0, 0), neck=(0, 0, 0), head=(0, 0, 0),
           squash=1.0):
    pose["hips"][1] = r.qr["hips"].inverted() @ Vector(cadera)
    pose["hips"][0] = r.mundo("hips", tronco(*cad_rot))
    pose["spine"][0] = r.mundo("spine", tronco(*spine))
    pose["chest"][0] = r.mundo("chest", tronco(*chest))
    pose["neck"][0] = r.mundo("neck", tronco(*neck))
    pose["head"][0] = r.mundo("head", tronco(*head))
    s = squash
    pose["spine"][2] = Vector((1 / math.sqrt(s), s, 1 / math.sqrt(s)))


def _serie(fn, n):
    return np.array([fn(t) for t in range(n + 1)], float)


# ---- Idle: rebote suave al ritmo (4 tiempos), cambio de peso, brazos de fideo
def clip_idle(r, P):
    n = 96
    c = Clip(r, "Idle", n, True)
    beat = 24
    for t in c.tiempos():
        pose = r.pose_vacia()
        d = rebote(t / beat)                      # 0..1 en cada tiempo
        d2 = rebote((t - 3) / beat)
        d4 = rebote((t - 5) / beat)
        d6 = rebote((t - 7) / beat)
        lado = onda(t, 2 * beat)                  # peso de un lado a otro
        lado6 = onda(t, 2 * beat, 6)
        mira = onda(t, n, 10)
        _torso(pose, r, cadera=(0.012 * lado, 0.0, -0.009 - 0.011 * d),
               cad_rot=(1.0 * d, 2.0 * onda(t, n), -2.5 * lado),
               spine=(1.5 * d2, -1.0 * onda(t, n, 4), 1.2 * lado6),
               chest=(1.2 * onda(t, beat, 2) - 1.0, -1.5 * onda(t, n, 8), 1.5 * lado6),
               neck=(1.5 * d4, 2.0 * mira, -1.5 * lado6),
               head=(-3.0 + 3.5 * d6, 6.0 * mira, 4.0 * onda(t, 2 * beat, 9)),
               squash=1.0 - 0.03 * d2 + 0.012 * onda(t, beat, 12))
        for L, s in (("L", 1), ("R", -1)):
            sw = onda(t, 2 * beat, 8) * s
            _arm(pose, r, L, abre=25 + 3 * d2 + 2 * sw, frente=7 + 3 * onda(t, n, 5 + 4 * s), giro=4,
                 codo=22 + 10 * d4, mano_x=6 + 12 * d6, mano_z=-4 + 4 * sw, hombro=-2 + 3 * d2)
            mano(pose, L, "suelta", t, ola=6.0, ola_periodo=beat)
        for L in ("L", "R"):
            P.poner(pose, L)
        c.poses.append(pose)
    return c


# ---- Caminar: pavoneo de caricatura en su lugar (el sitio lo mueve a VEL_CAMINAR)
CICLO_CAMINAR = 30
PASO = 0.20
VEL_CAMINAR = PASO / (CICLO_CAMINAR / 2 / FPS)


def _pie_caminar(u, paso=None, alto_max=0.11, k_pie=1.0, rel_fin=0.5):
    """Por fase u (0 = el talón pega al frente): adelante, alto, giro del pie, pivote,
    dedos y el tobillo relativo (ver Pies.poner)."""
    PASO = globals()["PASO"] if paso is None else paso
    u %= 1.0
    if u < 0.5:
        w = u / 0.5
        adelante = PASO / 2 - PASO * w
        if w < 0.16:
            pie = -5 * k_pie * (1 - suave(w / 0.16))
            piv = "talon"
        elif w > 0.74:
            pie = 15 * k_pie * suave((w - 0.74) / 0.26)
            piv = "bola"
        else:
            pie, piv = 0.0, "bola"
        return adelante, 0.0, pie, piv, (pie if piv == "bola" and pie > 0 else 0.0), None
    w = (u - 0.5) / 0.5
    k = suave5(w)
    adelante = -PASO / 2 + PASO * k
    alto = alto_max * math.sin(math.pi * min(1.0, w * 1.15)) ** 1.3 * (1 - 0.25 * w)
    if w < 0.35:
        pie = (15 + 3 * sale(w / 0.35)) * k_pie
    elif w < 0.8:
        pie = (18 - 22 * suave((w - 0.35) / 0.45)) * k_pie
    else:
        pie = (-2 - 3 * suave((w - 0.8) / 0.2)) * k_pie
    piv = "talon" if pie < 0 else "bola"
    # los dedos siguen planos en el piso al despegar y ya en el aire casi no se doblan
    dedos = pie * (1 - suave(w / 0.25)) + 4 * suave(w / 0.25) * (1 - suave((w - 0.6) / 0.3))
    # a media zancada el pie va referido a la espinilla, con la punta apenas abajo
    # (y se suelta antes de pegar: el pie llega con la punta arriba)
    # (en su lugar el pie cae bajo el cuerpo con la rodilla aún arriba: se suelta más tarde)
    peso = suave((w - 0.08) / 0.2) * (1 - suave((w - rel_fin) / min(0.22, 0.98 - rel_fin)))
    return adelante, alto, pie, piv, dedos, (8 * math.sin(math.pi * w) * (1 - suave((w - 0.35) / 0.3)), peso)


def clip_caminar(r, P):
    return _ciclo_pasos(r, P, "Caminar")


def clip_voltear(r, P):
    """Pasitos en su lugar (bucle): el sitio gira al alien mientras suena, así no
    patina al voltear."""
    return _ciclo_pasos(r, P, "Voltear", paso=0.0, alto_max=0.06, k=0.45, k_pie=0.6, agacha=-0.026, rel_fin=0.8)


def _ciclo_pasos(r, P, nombre, paso=None, alto_max=0.11, k=1.0, k_pie=1.0, agacha=-0.042, rel_fin=0.5):
    """Ciclo de dos pasos en su lugar. k escala el rebote, el giro del torso y el
    braceo (1 = caminar)."""
    n = CICLO_CAMINAR
    c = Clip(r, nombre, n, True)
    for t in c.tiempos():
        pose = r.pose_vacia()
        f = t / n
        b = abs(math.sin(TAU * (f - 0.06))) ** 0.8           # alto en el paso, bajo al pegar
        b2 = abs(math.sin(TAU * (f - 0.12))) ** 0.8
        b4 = abs(math.sin(TAU * (f - 0.18))) ** 0.8
        golpe = rebote((f % 0.5) / 0.5)                      # el apachurrón al pegar
        golpe2 = rebote(((f - 0.06) % 0.5) / 0.5)
        lado = math.sin(TAU * f)                             # el peso va al pie de apoyo
        gira = math.sin(TAU * f + 0.4)
        # la pierna izquierda pega al frente en f = 0 y queda atrás en f = 0.5 (su
        # avance va como cos 2πf): la cadera gira con la pierna que avanza, los
        # hombros al revés, y el peso cae en el pie de apoyo (el izquierdo de 0 a 0.5)
        _torso(pose, r, cadera=(0.022 * math.sin(TAU * (f - 0.05)), 0.0,
                                agacha + k * (0.026 * b - 0.012 * golpe)),
               cad_rot=(2.0, -6.0 * k * math.cos(TAU * f - 0.3), 4.0 * math.sin(TAU * (f - 0.1))),
               spine=(0.5 + 2.0 * k * golpe2, 3.0 * k * math.cos(TAU * f - 0.5), -3.0 * math.sin(TAU * (f - 0.12))),
               chest=(-3.0 - 2.0 * k * b2, 7.0 * k * math.cos(TAU * f - 0.7), -2.0 * math.sin(TAU * (f - 0.18))),
               neck=(-1.0 + 3.0 * k * golpe2, -2.0 * k * math.cos(TAU * f - 0.9), 2.0 * math.sin(TAU * (f - 0.22))),
               head=(-1.0 + k * (5.0 * rebote(((f - 0.1) % 0.5) / 0.5) - 2.0 * b4), -2.0 * k * math.cos(TAU * f - 1.1),
                     5.0 * math.sin(TAU * (f - 0.25))),
               squash=1.0 - k * (0.045 * golpe2 - 0.03 * b2))
        # cada brazo contrario a su pierna: el izquierdo al frente cuando la pierna
        # izquierda está atrás (-cos 2πf), con retraso del codo y la mano
        for L, s, ph in (("L", 1, 0.75), ("R", -1, 0.25)):
            # el brazo va contrario a su pierna; codo y mano con retraso (fideo)
            sw = math.sin(TAU * (f + ph) - 0.6)
            sw2 = math.sin(TAU * (f + ph) - 1.2)
            sw3 = math.sin(TAU * (f + ph) - 1.9)
            _arm(pose, r, L, abre=24 + 4 * k * b2, frente=6 + 26 * k * sw, giro=8 + 4 * k * sw2,
                 codo=30 + 18 * k * sw2, mano_x=12 + 20 * k * sw3, mano_z=-4 + 6 * k * sw3, hombro=2 + 4 * k * golpe2,
                 hombro_atras=-6 * k * sw)
            mano(pose, L, "suelta", t, ola=10.0 * k, ola_periodo=n / 2)
        for L, ph in (("L", 0.0), ("R", 0.5)):
            adelante, alto, pie, piv, dedos, rel = _pie_caminar(f + ph, paso, alto_max, k_pie, rel_fin)
            P.poner(pose, L, adelante=adelante, alto=alto, pie=pie, dedos=dedos, pivote=piv, afuera=-0.008, rel=rel)
        c.poses.append(pose)
    return c


DETENER_S = 0.5      # el sitio baja la velocidad de VEL_CAMINAR a 0 en línea recta en este tiempo


def _mezcla_pose(a, b, w):
    """Pose entre a y b (giros con slerp, traslación y escala lineales)."""
    out = {}
    for h in a:
        qa, qb = a[h][0], b[h][0]
        if qa.dot(qb) < 0:
            qb = -qb
        out[h] = [qa.slerp(qb, min(1.25, max(-0.25, w))) if 0 <= w <= 1 else _slerp_ext(qa, qb, w),
                  a[h][1].lerp(b[h][1], w), a[h][2].lerp(b[h][2], w)]
    return out


def _slerp_ext(qa, qb, w):
    """Slerp que se puede pasar de 0..1 (para el rebote de seguimiento)."""
    d = qa.rotation_difference(qb)
    eje, ang = d.to_axis_angle()
    return qa @ Quaternion(eje, ang * w)


def clip_detenerse(r, P, caminar, idle):
    """Arranca en el cuadro 0 de Caminar (el talón izquierdo pega al frente) y acaba
    en el cuadro 0 del Idle. El sitio baja la velocidad de VEL_CAMINAR a 0 en línea
    recta en DETENER_S: así el pie izquierdo, plantado, queda justo bajo la cadera, y
    el derecho da un último pasito y aterriza junto a él. El cuerpo se asienta con
    un apachurrón y los brazos se pasan tantito y regresan (seguimiento)."""
    n = 27
    c = Clip(r, "Detenerse", n, False)
    A, Bf = caminar.poses[0], idle.poses[0]
    T = DETENER_S * FPS
    grupos = {"hips": 0, "spine": 1, "chest": 2, "neck": 4, "head": 6}

    def peso(t, retraso, f=2.4, am=0.33, dura=14.0):
        ser = np.array([suave((u - retraso) / dura) for u in range(n + 1)])
        ser = resorte(ser, f, am)
        fin = np.array([suave((u - (n - 6)) / 6) for u in range(n + 1)])
        return ser * (1 - fin) + fin
    pesos = {}
    for h in r.cuerpo:
        if h in grupos:
            pesos[h] = peso(None or 0, grupos[h], 3.0, 0.5)
        elif h.startswith(("shoulder_", "upper_arm_")):
            pesos[h] = peso(0, 1, 2.2, 0.3)
        elif h.startswith("lower_arm_"):
            pesos[h] = peso(0, 3, 2.2, 0.3)
        elif h.startswith("hand_"):
            pesos[h] = peso(0, 5, 2.2, 0.3)
        elif h.startswith(DEDOS):
            pesos[h] = peso(0, 6, 2.2, 0.35)
        else:
            pesos[h] = peso(0, 0, 3.0, 0.5)
    for t in c.tiempos():
        pose = {}
        for h in r.cuerpo:
            pose[h] = _mezcla_pose({h: A[h]}, {h: Bf[h]}, float(pesos[h][t]))[h]
        # apachurrón al aterrizar el último paso
        aterriza = rebote((t - T) / 12.0) if 0 <= t - T < 12 else 0.0
        pose["hips"][1] = pose["hips"][1] + r.qr["hips"].inverted() @ Vector((0, 0, -0.022 * aterriza))
        sq = 1 - 0.05 * aterriza
        pose["spine"][2] = Vector((pose["spine"][2].x / math.sqrt(sq), pose["spine"][2].y * sq,
                                   pose["spine"][2].z / math.sqrt(sq)))
        # el pie izquierdo plantado: retrocede lo que avanza el alien mientras frena
        ts = min(t, T) / FPS
        atras = VEL_CAMINAR * (ts - ts * ts / (2 * DETENER_S))
        w0 = t / (CICLO_CAMINAR / 2)
        pie_l = -5 * (1 - suave(w0 / 0.16)) if w0 < 0.16 else 0.0
        P.poner(pose, "L", adelante=PASO / 2 - atras, pie=pie_l, pivote="talon" if pie_l < 0 else "bola", afuera=-0.008)
        # el derecho: de despegar atrás a aterrizar junto al izquierdo en T
        w = min(1.0, t / T)
        adelante = -PASO / 2 + PASO / 2 * suave5(w)
        alto = 0.07 * math.sin(math.pi * w) ** 1.3
        if w < 0.35:
            pie = 15 - 5 * sale(w / 0.35)
        elif w < 0.85:
            pie = 10 - 13 * suave((w - 0.35) / 0.5)
        else:
            pie = -3 + 3 * suave((w - 0.85) / 0.15)
        dedos = pie * (1 - suave(w / 0.25))
        peso_rel = suave((w - 0.08) / 0.2) * (1 - suave((w - 0.8) / 0.18))
        P.poner(pose, "R", adelante=adelante, alto=alto, pie=pie, dedos=dedos, pivote="talon" if pie < 0 else "bola",
                afuera=-0.008, rel=(4 * math.sin(math.pi * w), peso_rel) if alto > 0.001 else None)
        c.poses.append(pose)
    return c


def _arm_ik(pose, r, lado, meta, polo, mano_x=0.0, mano_z=0.0, mano_y=0.0, hombro=0.0, hombro_atras=0.0,
            marco="chest"):
    """El brazo con IK: la muñeca a `meta` (coordenadas del reposo, pegadas al hueso
    `marco`: se mueven con él) y el codo hacia `polo`. Del lado derecho, en espejo."""
    s = 1 if lado == "L" else -1
    pose[f"shoulder_{lado}"][0] = local(x=hombro, z=s * hombro_atras)
    M = r.fk(pose)
    pecho = M[marco] @ r.rest[marco].inverted()
    m = Vector(meta) if lado == "L" else Vector((-meta[0], meta[1], meta[2]))
    pl = Vector(polo) if lado == "L" else Vector((-polo[0], polo[1], polo[2]))
    r.ik2(pose, f"upper_arm_{lado}", f"lower_arm_{lado}", pecho @ m, pecho.to_3x3() @ pl, False, False)
    pose[f"hand_{lado}"][0] = local(x=mano_x, z=s * mano_z, y=s * mano_y)


# ---- Hablar: gestos alternados, acentos con la cabeza (bucle de 4 s)
def clip_hablar(r, P):
    n = 120
    c = Clip(r, "Hablar", n, True)
    # (abre, frente, codo, giro, mano_x): la derecha presenta (palma hacia arriba y
    # afuera) en la primera frase, la izquierda en la segunda; en medio las dos
    D = Claves([(0, (24, 8, 22, 6, 6)), (10, (30, 34, 58, 30, -14), "b"), (28, (32, 36, 64, 34, -18)),
                (40, (28, 30, 56, 26, -8)), (56, (26, 22, 40, 16, 0)), (70, (30, 34, 60, 32, -14), "b"),
                (86, (28, 26, 46, 20, -4)), (104, (24, 10, 24, 8, 6)), (120, (24, 8, 22, 6, 6))])
    Iz = Claves([(0, (24, 8, 22, 6, 6)), (20, (24, 10, 26, 8, 6)), (44, (26, 18, 36, 14, 0)),
                 (58, (30, 34, 58, 30, -14), "b"), (74, (32, 36, 64, 34, -18)), (88, (28, 26, 48, 22, -6)),
                 (100, (30, 34, 60, 32, -14), "b"), (112, (24, 10, 26, 8, 6)), (120, (24, 8, 22, 6, 6))])
    acentos = (10, 28, 58, 70, 100)
    serD2 = resorte(np.array([D(t) for t in range(n + 1)]), 2.2, 0.45, ciclo=True)
    serI2 = resorte(np.array([Iz(t) for t in range(n + 1)]), 2.2, 0.45, ciclo=True)

    def acento(t, retraso=0):
        return sum(rebote(((t - a - retraso) % n) / 14.0) if ((t - a - retraso) % n) < 14 else 0.0 for a in acentos)
    for t in c.tiempos():
        pose = r.pose_vacia()
        ac, ac3 = acento(t), acento(t, 3)
        lado = onda(t, n, 15)
        _torso(pose, r, cadera=(0.016 * lado, 0.0, -0.022 - 0.008 * ac),
               cad_rot=(0.5, 2.0 * onda(t, n, 30), -2.5 * lado),
               spine=(1.0 + 1.0 * ac, 1.5 * onda(t, n, 35), 1.5 * lado),
               chest=(0.5 + 1.0 * ac3, 3.0 * onda(t, n, 40), 2.0 * onda(t, n, 20)),
               neck=(0.5 + 1.0 * ac3, 1.5 * onda(t, n, 44), -2.0 * lado),
               head=(-2.0 + 4.0 * ac3, 4.0 * onda(t, n, 48), 5.0 * onda(t, n / 2, 20)),
               squash=1.0 - 0.02 * ac + 0.01 * onda(t, 40))
        for L, ser2 in (("L", serI2), ("R", serD2)):
            abre, frente, codo, giro, mx = ser2[t]
            _arm(pose, r, L, abre=abre, frente=frente, giro=giro, codo=codo, mano_x=mx + 6 * ac3,
                 mano_z=-4 + 4 * onda(t, 30, 5), hombro=1 + 3 * ac, antebrazo=0.6 * giro)
            abierta = min(1.0, max(0.0, (frente - 12) / 20))
            mano(pose, L, "suelta", t, ola=5.0, ola_periodo=30, mezcla=("abierta", abierta))
        for L in ("L", "R"):
            P.poner(pose, L)
        c.poses.append(pose)
    return c


# ---- Saludo: anticipa, sube en arco por un lado, menea la mano tres veces y baja con rebote
def clip_saludo(r, P):
    n = 78
    c = Clip(r, "Saludo", n, False)
    # (abre, frente, giro, codo, mano_x) del brazo izquierdo: al lado y un poco arriba
    # de horizontal, el codo doblado hacia arriba (giro 90): el antebrazo queda
    # parado y la palma ve al frente, como un saludo de verdad
    B = Claves([(0, (24, 8, 6, 22, 6)), (8, (18, -8, 6, 30, 14), "o"),
                (14, (66, -2, 60, 40, 4), "l"), (20, (102, 2, 90, 68, -4), "b"), (66, (102, 2, 90, 68, -4)),
                (71, (66, 0, 60, 46, 4), "i"), (78, (24, 8, 6, 22, 6), "o")])
    serB2 = resorte(np.array([B(t) for t in range(n + 1)]), 2.6, 0.42)
    for t in c.tiempos():
        pose = r.pose_vacia()
        sube = suave((t - 8) / 12) * (1 - suave((t - 64) / 12))
        env = suave((t - 18) / 6) * (1 - suave((t - 60) / 6))
        menea = math.sin(TAU * (t - 20) / 14) * env
        menea2 = math.sin(TAU * (t - 23) / 14) * env
        menea4 = math.sin(TAU * (t - 26) / 14) * env
        anti = suave(t / 8) * (1 - suave((t - 8) / 8))
        rb = sum(rebote((t - a) / 12) for a in (20, 34, 48) if 0 <= t - a < 12)
        _torso(pose, r, cadera=(-0.012 * sube, 0, -0.016 - 0.02 * anti - 0.01 * rb),
               cad_rot=(1.5 * anti, -3 * sube, 3 * sube),
               spine=(2 * anti - 1 * sube, -2 * sube, -3 * sube + 1.5 * menea2),
               chest=(1.5 * anti - 2 * sube, -3 * sube, -3 * sube + 2 * menea2),
               neck=(2 * anti, 3 * sube, 3 * sube),
               head=(3 * anti - 3 * sube + 2 * rb, 6 * sube, 8 * sube + 3 * menea4),
               squash=1 - 0.035 * anti + 0.03 * sube * (1 - suave((t - 26) / 10)) - 0.01 * rb)
        ab, fr, gi, co, mx = serB2[t]
        # el meneo: el antebrazo se mece hacia afuera (abre el codo) y regresa, la
        # muñeca se mece de lado con retraso; nada gira sobre su eje
        _arm(pose, r, "L", abre=ab + 3 * menea, frente=fr, giro=gi, codo=co - 11 * (1 + menea2),
             mano_x=mx, mano_z=18 * menea4, hombro=10 * sube + 2 * rb, hombro_atras=-3 * sube)
        mano(pose, "L", "suelta", t, ola=4.0, mezcla=("abierta", sube))
        _arm(pose, r, "R", abre=24 - 2 * sube, frente=8 + 2 * anti, giro=6, codo=22 + 10 * anti + 6 * rb,
             mano_x=6 + 6 * rb, mano_z=-4, hombro=-2 * sube)
        mano(pose, "R", "suelta", t, ola=5.0)
        for L in ("L", "R"):
            P.poner(pose, L)
        c.poses.append(pose)
    return c


# ---- Encogerse: "¿y yo qué?": hombros arriba, antebrazos afuera, palmas arriba
def clip_encogerse(r, P):
    n = 66
    c = Clip(r, "Encogerse", n, False)
    # (abre, frente, giro, codo, mano_x, mano_y, hombro)
    A = Claves([(0, (24, 8, 6, 22, 6, 0, 0)), (6, (20, 2, 6, 28, 12, 0, -4), "o"),
                (16, (26, 14, 72, 88, -12, 22, 24), "b"), (40, (26, 14, 74, 90, -14, 24, 22)),
                (54, (22, 6, 4, 20, 8, 0, -5), "s"), (66, (24, 8, 6, 22, 6, 0, 0))])
    serA = resorte(np.array([A(t) for t in range(n + 1)]), 3.0, 0.38)
    for t in c.tiempos():
        pose = r.pose_vacia()
        arriba = suave((t - 6) / 10) * (1 - suave((t - 42) / 12))
        anti = suave(t / 6) * (1 - suave((t - 6) / 8))
        rb = rebote((t - 16) / 12) if 0 <= t - 16 < 12 else 0.0
        caida = rebote((t - 50) / 14) if 0 <= t - 50 < 14 else 0.0
        _torso(pose, r, cadera=(0.0, 0.0, -0.016 - 0.016 * anti - 0.012 * caida + 0.004 * arriba),
               cad_rot=(1.5 * anti - 1.5 * arriba, 0, 2 * arriba),
               spine=(2 * anti - 2 * arriba, 0, -2 * arriba),
               chest=(1 * anti - 2 * arriba + 2 * caida, 0, -3 * arriba),
               neck=(-2 * arriba, -3 * arriba, 4 * arriba),
               head=(2 * anti - 3 * arriba + 3 * rb + 3 * caida, -6 * arriba, 12 * arriba + 2 * rb),
               squash=1 - 0.03 * anti + 0.025 * arriba - 0.03 * caida)
        ab, fr, gi, co, mx, my, ho = serA[t]
        for L in ("L", "R"):
            _arm(pose, r, L, abre=ab, frente=fr, giro=gi, codo=co, mano_x=mx, mano_z=-4, hombro=ho, antebrazo=my)
            mano(pose, L, "suelta", t, ola=3.0, mezcla=("estirada", arriba))
            P.poner(pose, L)
        c.poses.append(pose)
    return c


# ---- Risa: se agarra la panza, se echa para atrás riendo a saltitos, se dobla y regresa
def clip_risa(r, P):
    n = 90
    c = Clip(r, "Risa", n, False)
    T = Claves([(0, (0, 0)), (8, (2, -0.6)), (22, (-8, 1)), (48, (-6, 1)), (60, (10, 0.4), "b"), (76, (8, 0.3)),
                (90, (0, 0))])
    serT = resorte(np.array([T(t) for t in range(n + 1)]), 2.0, 0.5)
    for t in c.tiempos():
        pose = r.pose_vacia()
        atras, _ = serT[t]
        env = suave((t - 10) / 6) * (1 - suave((t - 80) / 8))
        ja = (0.5 + 0.5 * math.sin(TAU * t / 8)) * env
        ja2 = (0.5 + 0.5 * math.sin(TAU * (t - 2) / 8)) * env
        _torso(pose, r, cadera=(0, 0.004 * atras, -0.02 - 0.012 * ja - 0.006 * abs(atras) / 8),
               cad_rot=(0.3 * atras, 0, 0),
               spine=(0.5 * atras + 2 * ja, 3 * math.sin(TAU * t / 45), 0),
               chest=(0.6 * atras + 2 * ja2, 4 * math.sin(TAU * t / 45 + 0.5), 0),
               neck=(0.3 * atras + 2 * ja2, 0, 2 * math.sin(TAU * t / 30)),
               head=(0.4 * atras + 4 * ja2, 4 * math.sin(TAU * t / 40), 5 * math.sin(TAU * t / 30)),
               squash=1 - 0.035 * ja)
        agarra = suave((t - 4) / 10) * (1 - suave((t - 78) / 10))
        for L in ("L", "R"):
            # la muñeca al costado de la panza (pegada al pecho, rebota con la risa)
            libre = Vector((0.33, -0.02, 0.62))
            # en jarras (con estos guantes, en la panza las manos se cruzaban al frente)
            # la muñeca afuera: solo los nudillos se apoyan en el costado de la cadera
            cadera = Vector((0.325, 0.0, 0.79 + 0.006 * ja2))
            _arm_ik(pose, r, L, libre.lerp(cadera, agarra), (1.0, 0.35, 0.1), mano_x=6 * agarra + 4 * ja2,
                    mano_z=0.0, hombro=4 * ja + 2 * agarra, marco="hips")
            mano(pose, L, "suelta", t, ola=4.0 * (1 - agarra), mezcla=("puno", agarra))
            P.poner(pose, L)
        c.poses.append(pose)
    return c


# ---- Sorpresa: el "take" de caricatura (se apachurra, se estira con los brazos en V, vibra y se asienta)
def clip_sorpresa(r, P):
    n = 64
    c = Clip(r, "Sorpresa", n, False)
    for t in c.tiempos():
        pose = r.pose_vacia()
        anti = suave(t / 7) * (1 - suave((t - 7) / 3))
        take = suave((t - 7) / 4) * (1 - suave((t - 30) / 16))
        vibra = math.sin(TAU * t / 3.0) * suave((t - 11) / 3) * (1 - suave((t - 26) / 6))
        caida = rebote((t - 38) / 18) if 0 <= t - 38 < 18 else 0.0
        _torso(pose, r, cadera=(0, 0.01 * take, -0.016 - 0.045 * anti + 0.012 * take - 0.02 * caida),
               cad_rot=(5 * anti - 3 * take, 0, 0),
               spine=(6 * anti - 4 * take + 0.6 * vibra + 3 * caida, 0, 0),
               chest=(5 * anti - 4 * take + 0.8 * vibra + 2 * caida, 0, 0),
               neck=(4 * anti - 3 * take, 0, 0),
               head=(6 * anti - 5 * take + 1.2 * vibra + 4 * caida, 0, 2 * vibra),
               squash=1 - 0.08 * anti + 0.1 * take - 0.06 * caida + 0.012 * vibra)
        for L in ("L", "R"):
            # brazos en V, abiertos y lejos de la cabeza, con el antebrazo hacia afuera
            # en V y casi estirados; el codo dobla poquito hacia la cabeza (giro -90),
            # así la palma ve al frente sin torcer nada
            _arm(pose, r, L, abre=24 - 8 * anti + 92 * take, frente=8 + 14 * anti + 4 * take, giro=6 - 96 * take,
                 codo=22 + 20 * anti - 8 * take + 4 * vibra, mano_x=6 + 14 * anti - 16 * take,
                 mano_z=-4 - 12 * take, hombro=-6 * anti + 14 * take)
            mano(pose, L, "suelta", t, ola=2.0, mezcla=("estirada", take))
            P.poner(pose, L, pie=0)
        c.poses.append(pose)
    return c


# ---- Pensar: voltea a un lado, mano a la cadera y dedo a la barbilla ("mmm"), voltea al otro
def clip_pensar(r, P):
    n = 120
    c = Clip(r, "Pensar", n, False)
    V = Claves([(0, (0, 0)), (14, (-16, 4), "b"), (40, (-12, 6)), (54, (6, -4)), (82, (12, -6)), (96, (14, -4)),
                (120, (0, 0))])
    serV = resorte(np.array([V(t) for t in range(n + 1)]), 2.4, 0.5)
    for t in c.tiempos():
        pose = r.pose_vacia()
        voltea, ladea = serV[t]
        barb = suave((t - 30) / 14) * (1 - suave((t - 100) / 14))
        toc = (math.sin(TAU * (t - 60) / 10) * 0.5 + 0.5) * suave((t - 56) / 4) * (1 - suave((t - 80) / 4))
        _torso(pose, r, cadera=(-0.012 * barb, 0, -0.018), cad_rot=(0, 0.2 * voltea, -2 * barb),
               spine=(1, 0.2 * voltea, 1 * barb), chest=(1 + 1.5 * barb, 0.25 * voltea, 1 * barb),
               neck=(1 + 1.5 * barb, 0.3 * voltea, 0.5 * ladea),
               head=(-1 + 3 * barb - 1.5 * toc, 0.8 * voltea, ladea),
               squash=1 - 0.01 * barb)
        # derecha: la muñeca bajo la barbilla, la mano hacia arriba con el índice
        libre_d = Vector((0.33, -0.02, 0.62))
        barbilla = Vector((0.06, -0.30, 0.90 + 0.008 * toc))
        _arm_ik(pose, r, "R", libre_d.lerp(barbilla, barb), (0.7, 0.5, -0.4), mano_x=-50 * barb - 6 * toc,
                mano_z=-10 * barb, hombro=2 * barb)
        mano(pose, "R", "suelta", t, mezcla=("senala", barb))
        # izquierda: a la cadera, con el codo hacia afuera
        libre_i = Vector((0.33, -0.02, 0.62))
        cadera = Vector((0.305, 0.0, 0.78))
        _arm_ik(pose, r, "L", libre_i.lerp(cadera, barb), (1.0, 0.35, 0.1), mano_x=6 * barb, mano_z=0.0,
                hombro=2 * barb, marco="hips")
        mano(pose, "L", "suelta", t, ola=3.0 * (1 - barb), mezcla=("puno", barb))
        for L in ("L", "R"):
            P.poner(pose, L)
        c.poses.append(pose)
    return c


def _giro_eje(qv):
    """Cuánto gira un giro local sobre el eje del hueso (Y), en grados (swing-twist)."""
    g = math.degrees(2 * math.atan2(qv.y, qv.w))
    return (g + 180) % 360 - 180


TORCEDURAS = {"brazo": "upper_arm_", "antebrazo": "lower_arm_", "muneca": "hand_",
              "rodilla": "lower_leg_", "tobillo": "foot_", "dedos_pie": "toes_"}


def torceduras(clip):
    """Lo más que se tuerce cada parte sobre su eje en el clip (grados)."""
    out = {}
    for nombre, pref in TORCEDURAS.items():
        peor = (0.0, None, None)
        for f, p in enumerate(clip.poses):
            for lado in ("L", "R"):
                g = abs(_giro_eje(p[pref + lado][0]))
                if g > peor[0]:
                    peor = (round(g, 1), f, lado)
        out[nombre] = peor
    # cuánto se dobla el tobillo (el pie contra la espinilla) y los dedos de la bota
    for nombre, pref in (("dobla_tobillo", "foot_"), ("dobla_dedos", "toes_")):
        peor = (0.0, None, None)
        for f, p in enumerate(clip.poses):
            for lado in ("L", "R"):
                qv = p[pref + lado][0]
                g = math.degrees(2 * math.acos(min(1.0, abs(qv.w))))
                if g > peor[0]:
                    peor = (round(g, 1), f, lado)
        out[nombre] = peor
    return out


def palma(r, pose, lado):
    """Hacia dónde ve la palma (en el mundo): el eje Z de la mano."""
    M = r.fk(pose)
    return (M[f"hand_{lado}"].to_3x3() @ Vector((0, 0, 1))).normalized()


CLIPS = {"Idle": clip_idle, "Caminar": clip_caminar, "Voltear": clip_voltear, "Hablar": clip_hablar,
         "Saludo": clip_saludo,
         "Encogerse": clip_encogerse, "Risa": clip_risa, "Sorpresa": clip_sorpresa, "Pensar": clip_pensar}


# ---------------------------------------------------------------- hornear

def hornear(arm, clip):
    for a in [a for a in bpy.data.actions if a.name == clip.nombre]:
        bpy.data.actions.remove(a)
    ad = arm.animation_data or arm.animation_data_create()
    acc = bpy.data.actions.new(clip.nombre)
    ad.action = acc
    n = len(clip.poses)
    frames = np.arange(n, dtype=float)
    for h in clip.r.cuerpo:
        qs_ = []
        prev = None
        for p in clip.poses:
            qv = Quaternion(p[h][0])
            if prev is not None and prev.dot(qv) < 0:
                qv = -qv
            prev = qv
            qs_.append(qv)
        canales = [("rotation_quaternion", [list(qv) for qv in qs_]),
                   ("location", [list(p[h][1]) for p in clip.poses])]
        if h == "spine":
            canales.append(("scale", [list(p[h][2]) for p in clip.poses]))
        for ruta, vals in canales:
            vals = np.asarray(vals)
            for i in range(vals.shape[1]):
                fc = acc.fcurve_ensure_for_datablock(arm, f'pose.bones["{h}"].{ruta}', index=i, group_name=h)
                fc.keyframe_points.add(n)
                fc.keyframe_points.foreach_set("co", np.c_[frames, vals[:, i]].ravel())
                fc.keyframe_points.foreach_set("interpolation", [bpy.types.Keyframe.bl_rna.properties["interpolation"].enum_items["LINEAR"].value] * n)
                if clip.ciclo:
                    fc.modifiers.new("CYCLES")
                fc.update()
    acc.use_frame_range = True
    acc.frame_start, acc.frame_end = 0, clip.n
    acc.use_cyclic = clip.ciclo
    acc.use_fake_user = True
    acc["ciclo"] = clip.ciclo
    return acc


def animar(arm, nombres=None):
    r = Rig(arm)
    P = Pies(r)
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    hechos = []
    lista = list(CLIPS) + ["Detenerse"]
    for nombre in lista:
        if nombres and nombre not in nombres:
            continue
        if nombre == "Detenerse":
            c = clip_detenerse(r, P, clip_caminar(r, P), clip_idle(r, P))
        else:
            c = CLIPS[nombre](r, P)
        print("TORCEDURAS", nombre, {k: v for k, v in torceduras(c).items()})
        if nombre == "Saludo":
            for f in (24, 40, 56):
                pv = palma(r, c.poses[f], "L")
                ang = math.degrees(pv.angle(Vector((0, -1, 0))))
                print("PALMA saludo", f, [round(x, 2) for x in pv], "grados del frente", round(ang, 1))
        if nombre == "Sorpresa":
            for f in (16, 24):
                pv = palma(r, c.poses[f], "L")
                print("PALMA sorpresa", f, [round(x, 2) for x in pv], "grados del frente",
                      round(math.degrees(pv.angle(Vector((0, -1, 0)))), 1))
        if nombre == "Encogerse":
            for f in (24, 36):
                print("PALMA encogerse", f, [round(x, 2) for x in palma(r, c.poses[f], "L")])
        hornear(arm, c)
        hechos.append(nombre)
    arm.animation_data.action = bpy.data.actions.get("Idle")
    return hechos
