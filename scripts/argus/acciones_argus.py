"""
Las acciones de Argus, escritas como poses clave con su easing (como se animaría
a mano) más una pasada de cinemática inversa para lo que tiene que caer exacto:
los pies plantados, la mano en la boca, en la panza o con la esfera.

Lo usa armar_argus.py. Convenciones (el reposo es la pose que se ve):
  IZQ = +X del mundo (la izquierda de Argus), ATRAS = +Y (Argus mira a -Y), ARRIBA = +Z.
  rot(): giros en ejes del MUNDO en reposo, aplicados al hueso; los hijos los heredan.
  loc(): traslación en ejes del mundo en reposo.
"""
import bpy
import math
from mathutils import Vector, Matrix, Quaternion

FPS = 30
IZQ = Vector((1, 0, 0))
ATRAS = Vector((0, 1, 0))
ARRIBA = Vector((0, 0, 1))
FRENTE = -ATRAS

BRAZO = {"L": ("shoulder.L_08", "upper_arm.L_09", "lower_arm.L_010", "hand.L_011"),
         "R": ("shoulder.R_024", "upper_arm.R_025", "lower_arm.R_026", "hand.R_027")}
PIERNA = {"L": (None, "upper_leg.L_040", "lower_leg.L_041", "foot.L_042"),
          "R": (None, "upper_leg.R_044", "lower_leg.R_045", "foot.R_046")}
DEDOS = {"L": {"thumb": ("thumb_proximal.L_012", "thumb_intermediate.L_013", "thumb_distal.L_014"),
               "index": ("index_proximal.L_015", "index_intermediate.L_016", "index_distal.L_017"),
               "middle": ("middle_proximal.L_018", "middle_intermediate.L_019", "middle_distal.L_020"),
               "ring": ("ring_proximal.L_021", "ring_intermediate.L_022", "ring_distal.L_023")},
         "R": {"thumb": ("thumb_proximal.R_028", "thumb_intermediate.R_029", "thumb_distal.R_030"),
               "index": ("index_proximal.R_031", "index_intermediate.R_032", "index_distal.R_033"),
               "middle": ("middle_proximal.R_034", "middle_intermediate.R_035", "middle_distal.R_036"),
               "ring": ("ring_proximal.R_037", "ring_intermediate.R_038", "ring_distal.R_039")}}
CARA = ("ojo_", "parpado_", "ceja_", "antena_")


def q(eje, grados):
    return Quaternion(Vector(eje).normalized(), math.radians(grados))


def qs(*giros):
    """Compone giros (eje, grados) en orden: el primero se aplica primero."""
    out = Quaternion()
    for eje, g in giros:
        out = q(eje, g) @ out
    return out


def _base(u, n):
    u = u.normalized()
    n = (n - n.dot(u) * u).normalized()
    return Matrix((u, n, u.cross(n))).transposed()


def _canal(accion, slot):
    from bpy_extras import anim_utils
    return anim_utils.action_get_channelbag_for_slot(accion, slot)


class Autor:
    def __init__(self, arm, nombre, cuadros, ciclo):
        self.arm, self.nombre, self.cuadros, self.ciclo = arm, nombre, cuadros, ciclo
        for a in [a for a in bpy.data.actions if a.name == nombre]:
            bpy.data.actions.remove(a)
        ad = arm.animation_data or arm.animation_data_create()
        ad.action = None
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"
            pb.location = (0, 0, 0)
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.scale = (1, 1, 1)
        self.accion = bpy.data.actions.new(nombre)
        ad.action = self.accion
        B = arm.data.bones
        self.qr = {b.name: b.matrix_local.to_quaternion() for b in B}
        self.claves = {}       # (hueso, ruta) -> {cuadro: (valor, interp, easing, back)}
        self.ik = []           # pedidos para la segunda pasada, en orden
        self.cuerpo = [b.name for b in B if not b.name.startswith(CARA)]

    # ---- claves en ejes del mundo
    def _poner(self, hueso, ruta, f, valor, interp="BEZIER", easing="AUTO", back=None):
        self.claves.setdefault((hueso, ruta), {})[round(f, 3)] = (valor, interp, easing, back)

    def rot(self, hueso, claves):
        """claves: [(cuadro, giro)] o [(cuadro, giro, interp, easing, back)]; giro es un
        Quaternion o (eje, grados) o una lista de (eje, grados)."""
        qr = self.qr[hueso]
        for c in claves:
            f, g = c[0], c[1]
            if isinstance(g, tuple) and len(g) == 2 and not isinstance(g[0], tuple):
                g = q(*g)
            elif isinstance(g, list):
                g = qs(*g)
            base = qr.inverted() @ g @ qr
            self._poner(hueso, "rotation_quaternion", f, base, *c[2:])

    def loc(self, hueso, claves):
        qr = self.qr[hueso]
        for c in claves:
            f, v = c[0], Vector(c[1])
            self._poner(hueso, "location", f, qr.inverted() @ v, *c[2:])

    def esc(self, hueso, claves):
        for c in claves:
            f, s = c[0], c[1]
            s = Vector((s, s, s)) if isinstance(s, (int, float)) else Vector(s)
            self._poner(hueso, "scale", f, s, *c[2:])

    def pose(self, f, giros, interp="BEZIER", easing="AUTO", back=None):
        """giros: {hueso: giro} en el cuadro f."""
        for h, g in giros.items():
            self.rot(h, [(f, g, interp, easing, back)])

    # ---- manos: curvatura de cada dedo (+ = cierra hacia la palma, - = estira),
    # sobre los grados que ya trae el reposo (la mano en reposo va medio cerrada)
    FORMAS = {
        "suelta": {"thumb": (4, 4, 2), "index": (4, 6, 4), "middle": (6, 8, 5), "ring": (8, 10, 6)},
        "abierta": {"thumb": (-8, -6, -2), "index": (-14, -12, -8), "middle": (-12, -12, -8), "ring": (-10, -10, -6)},
        "puno": {"thumb": (24, 30, 20), "index": (62, 70, 45), "middle": (65, 72, 45), "ring": (66, 72, 45)},
        "garra": {"thumb": (10, 12, 8), "index": (24, 28, 18), "middle": (26, 30, 20), "ring": (28, 32, 20)},
        "pinza": {"thumb": (22, 18, 10), "index": (30, 30, 20), "middle": (55, 60, 40), "ring": (60, 66, 42)},
        "pulgar": {"thumb": (-20, -10, 0), "index": (62, 70, 45), "middle": (65, 72, 45), "ring": (66, 72, 45)},
        "senala": {"thumb": (22, 26, 18), "index": (-10, -8, -4), "middle": (62, 70, 45), "ring": (66, 72, 45)},
    }

    def _eje_dedo(self, lado, dedo, h):
        """Bisagra de una falange en su espacio local: perpendicular al dedo y a la
        dirección en que cierra (la palma, que es el -Z de la mano; el pulgar cierra
        cruzando la palma hacia el dedo medio). Girar + mueve la punta hacia allá."""
        cache = self.__dict__.setdefault("_ejes", {})
        if h in cache:
            return cache[h]
        B = self.arm.data.bones
        mano = B[BRAZO[lado][3]]
        palma = (mano.matrix_local.to_3x3() @ Vector((0, 0, -1))).normalized()
        cierra = palma
        if dedo == "thumb":
            hacia = (B[DEDOS[lado]["middle"][0]].head_local - B[DEDOS[lado]["thumb"][0]].head_local).normalized()
            cierra = (palma * 0.55 + hacia * 0.45).normalized()
        m = B[h].matrix_local.to_3x3().inverted()
        c_local = (m @ cierra).normalized()
        eje = Vector((0, 1, 0)).cross(c_local)
        if eje.length < 1e-4:
            eje = Vector((1, 0, 0))
        cache[h] = eje.normalized()
        return cache[h]

    def mano(self, lado, claves):
        """claves: [(cuadro, forma)] o [(cuadro, forma, interp, easing)]; forma es un
        nombre de FORMAS o un dict con el mismo formato, o (forma, {dedo: extra})."""
        for c in claves:
            f, forma = c[0], c[1]
            extra = {}
            if isinstance(forma, tuple):
                forma, extra = forma
            curv = dict(self.FORMAS[forma] if isinstance(forma, str) else forma)
            for dedo, huesos in DEDOS[lado].items():
                ang = curv[dedo]
                ex = extra.get(dedo, 0)
                for k, h in enumerate(huesos):
                    base = Quaternion(self._eje_dedo(lado, dedo, h), math.radians(ang[k] + ex))
                    self._poner(h, "rotation_quaternion", f, base, *c[2:])

    # ---- cinemática inversa (segunda pasada)
    def ik_brazo(self, lado, f0, f1, objetivo, polo, orient=None, entra=0, sale=0):
        """objetivo(f, ev) -> Vector de la muñeca; polo(f, ev) -> Vector hacia donde va
        el codo; orient(f, ev) -> Quaternion de la mano en el mundo (o None: la mano
        conserva su giro de FK). entra/sale: cuadros de mezcla con el FK."""
        self.ik.append(("ik", BRAZO[lado], f0, f1, objetivo, polo, orient, entra, sale))

    def ik_pierna(self, lado, f0, f1, objetivo=None, polo=None, orient=None, entra=0, sale=0):
        """Sin objetivo: el tobillo se queda en su lugar de reposo y el pie plano."""
        cad = PIERNA[lado]
        B = self.arm.data.bones
        tob = B[cad[3]].head_local.copy()
        qp = self.qr[cad[3]]
        objetivo = objetivo or (lambda f, ev: tob)
        polo = polo or (lambda f, ev, t=tob: t + FRENTE * 1.0 + ARRIBA * 0.5)
        orient = orient or (lambda f, ev: qp)
        self.ik.append(("ik", cad, f0, f1, objetivo, polo, orient, entra, sale))

    def brazo(self, lado, claves, ref="chest_03"):
        """Un brazo con IK en TODO el clip, por poses clave interpoladas con curvas
        suaves (sin brincos: nada se decide cuadro por cuadro).
        claves: [(cuadro, muñeca, codo, mano, para)]
          muñeca  Vector en el mundo del reposo; se mueve pegada a `ref` (el pecho)
          codo    giro del codo alrededor de la línea hombro-muñeca, en grados desde su
                  reposo; None = el que menos se mete en el cuerpo y menos tuerce la mano
          mano    Quaternion de la mano en el mundo, o None = sigue al antebrazo
          para    True = llega frenando y sale acelerando (si no, pasa de largo)
        """
        self.ik.append(("brazo", BRAZO[lado], claves, ref, lado, None, None, 0, 0))

    def seguir(self, hueso, f0, f1, fn):
        """El hueso va a donde diga fn(f, ev) -> Matrix en el mundo (fn puede usar
        self.ev_en(f) para ver otro cuadro)."""
        self.ik.append(("seguir", hueso, f0, f1, fn, None, None, 0, 0))

    def ev_en(self, f):
        cache = self.__dict__.setdefault("_ev_cache", {})
        if f not in cache:
            actual = bpy.context.scene.frame_current
            cache[f] = self._ev(f)
            bpy.context.scene.frame_set(actual)
        return cache[f]

    def pegar(self, hueso, f0, f1, a_hueso, desfase, entra=0, sale=0):
        """El hueso sigue a otro (con desfase: Matrix en el espacio de a_hueso)."""
        self.ik.append(("pegar", hueso, f0, f1, a_hueso, desfase, None, entra, sale))

    # ---- cerrar
    def terminar(self):
        L = self.cuadros
        # todos los huesos del cuerpo con clave al inicio y al final, para que el clip
        # escriba la pose completa (en el sitio, un hueso sin pista se queda pegado)
        for h in self.cuerpo:
            for ruta, neutro in (("rotation_quaternion", Quaternion()), ("location", Vector()), ("scale", Vector((1, 1, 1)))):
                if ruta == "scale" and h != "esfera":
                    continue
                d = self.claves.setdefault((h, ruta), {})
                if h == "esfera" and ruta == "scale" and not d:
                    neutro = Vector((0, 0, 0))
                if not d:
                    d[0.0] = (neutro, "BEZIER", "AUTO", None)
                if self.ciclo:
                    primero = d[min(d)]
                    d[float(L)] = primero
                else:
                    if 0.0 not in d:
                        d[0.0] = d[min(d)]
                    if float(L) not in d:
                        d[float(L)] = d[max(d)]
        self._escribir()
        for pedido in self.ik:
            if pedido[0] == "brazo":
                self._resolver_brazo(pedido)
            else:
                self._resolver(pedido)
        self.accion.use_frame_range = True
        self.accion.frame_start, self.accion.frame_end = 0, L
        self.accion.use_cyclic = self.ciclo
        self.accion.use_fake_user = True
        self.accion["ciclo"] = self.ciclo
        return self.accion

    def _escribir(self):
        pb = self.arm.pose.bones
        marcas = {}
        for (h, ruta), d in self.claves.items():
            prev = None
            for f in sorted(d):
                v, interp, easing, back = d[f]
                if ruta == "rotation_quaternion":
                    v = Quaternion(v)
                    if prev is not None and prev.dot(v) < 0:
                        v = -v
                    prev = v
                setattr(pb[h], ruta, v)
                pb[h].keyframe_insert(ruta, frame=f)
                marcas[(h, ruta, f)] = (interp, easing, back)
        cb = _canal(self.accion, self.arm.animation_data.action_slot)
        for fc in cb.fcurves:
            h = fc.data_path.split('"')[1]
            ruta = fc.data_path.split(".")[-1]
            for kp in fc.keyframe_points:
                m = marcas.get((h, ruta, round(kp.co.x, 3)))
                kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
                if m:
                    kp.interpolation = m[0]
                    if m[1] != "AUTO":
                        kp.easing = m[1]
                    if m[2] is not None:
                        kp.back = m[2]
            if self.ciclo:
                fc.modifiers.new("CYCLES")
            fc.update()

    def _ev(self, f):
        sc = bpy.context.scene
        sc.frame_set(int(f))
        return {p.name: p.matrix.copy() for p in self.arm.pose.bones}

    def _resolver(self, pedido):
        tipo = pedido[0]
        B = self.arm.data.bones
        pb = self.arm.pose.bones
        cb = _canal(self.accion, self.arm.animation_data.action_slot)
        _, cad, f0, f1, objetivo, polo, orient, entra, sale = pedido
        resultados = {}
        phi_prev = None
        separaciones = None
        if tipo == "ik" and cad[0] is not None and getattr(self, "cuerpo_forma", None) is not None:
            separaciones = self._separaciones(cad, f0, f1, objetivo, polo, orient)
        for f in range(int(f0), int(f1) + 1):
            ev = self._ev(f)
            w = 1.0
            if entra and f < f0 + entra:
                w = _suave((f - f0) / entra)
            if sale and f > f1 - sale:
                w = min(w, _suave((f1 - f) / sale))
            if tipo == "pegar":
                h, a_h, desfase = cad, objetivo, polo
                meta = ev[a_h] @ desfase
                resultados[f] = {h: self._mezclar(h, ev, {h: meta}, w)}
                continue
            if tipo == "seguir":
                h = cad
                meta = objetivo(f, ev)
                ev = self._ev(f)
                resultados[f] = {h: self._mezclar(h, ev, {h: meta}, 1.0)}
                continue
            hombro, sup, inf, extremo = cad
            S = ev[sup].to_translation()
            T = objetivo(f, ev)
            P = polo(f, ev)
            qo = orient(f, ev) if orient is not None else None
            if hombro is not None:
                # Brazos: se busca hacia dónde abrir el codo (girándolo alrededor de la
                # línea hombro-muñeca) para que (1) antebrazo y mano no se metan en la
                # cabeza ni en el cuerpo y (2) la mano llegue casi derecha, sin torcer la
                # muñeca. Si ningún codo libra el cuerpo, la mano se separa de él lo que
                # haga falta (ver _separaciones). Lo que le falte a la mano se recorta a
                # lo que aguanta la muñeca (TOPE_GIRO, TOPE_DOBLEZ).
                cuerpo = getattr(self, "cuerpo_forma", None)
                if cuerpo is not None:
                    ev_con_inversas(ev, self.arm)
                sep = separaciones.get(f, 0.0) if separaciones is not None else 0.0
                if sep > 0:
                    T = T + _fuera(T, ev) * sep
                mejor = self._mejor_codo(cad, S, T, P, qo, cuerpo, ev, phi_prev)
                phi_prev = mejor[2]
                E, Tn, q1, q2 = self._dos_huesos(cad, S, T, mejor[1])
                if qo is not None:
                    nat = q2 @ (self.qr[inf].inverted() @ self.qr[extremo])
                    qo = nat @ _recortar(nat.inverted() @ qo)
            else:
                E, Tn, q1, q2 = self._dos_huesos(cad, S, T, P)
            metas = {sup: Matrix.Translation(S) @ q1.to_matrix().to_4x4(),
                     inf: Matrix.Translation(E) @ q2.to_matrix().to_4x4()}
            if qo is not None:
                metas[extremo] = Matrix.Translation(Tn) @ qo.to_matrix().to_4x4()
            resultados[f] = self._mezclar_cadena([sup, inf, extremo], ev, metas, w)
        # reemplazar las claves del tramo por las calculadas, cuadro por cuadro
        huesos = set(k for r in resultados.values() for k in r)
        for h in huesos:
            for ruta in ("rotation_quaternion", "location"):
                for fc in [fc for fc in cb.fcurves if fc.data_path == f'pose.bones["{h}"].{ruta}']:
                    for kp in reversed(list(fc.keyframe_points)):
                        if f0 - 1e-3 <= kp.co.x <= f1 + 1e-3:
                            fc.keyframe_points.remove(kp)
        prev = {}
        for f in sorted(resultados):
            for h, (loc, rot) in resultados[f].items():
                if h in prev and prev[h].dot(rot) < 0:
                    rot = -rot
                prev[h] = rot
                pb[h].rotation_quaternion = rot
                pb[h].keyframe_insert("rotation_quaternion", frame=f)
                if loc is not None:
                    pb[h].location = loc
                    pb[h].keyframe_insert("location", frame=f)
        for fc in cb.fcurves:
            h = fc.data_path.split('"')[1]
            if h in huesos:
                for kp in fc.keyframe_points:
                    if f0 - 1e-3 <= kp.co.x <= f1 + 1e-3:
                        kp.interpolation = "LINEAR"
                fc.update()

    def _polo_ref(self, cad, lado, ev):
        """Dirección de referencia del codo (afuera, abajo y atrás), girada con el pecho,
        y el giro que tiene el codo en reposo respecto a ella."""
        B = self.arm.data.bones
        s = 1 if lado == "L" else -1
        d_rest = Vector((0.8 * s, 0.35, -0.5)).normalized()
        d_loc = B["chest_03"].matrix_local.to_3x3().inverted() @ d_rest
        d = ev["chest_03"].to_3x3().normalized() @ d_loc
        return d

    def _codo_reposo(self, cad, lado):
        B = self.arm.data.bones
        _, sup, inf, ext = cad
        S0, E0, T0 = B[sup].head_local, B[inf].head_local, B[ext].head_local
        s = 1 if lado == "L" else -1
        d = Vector((0.8 * s, 0.35, -0.5)).normalized()
        return _giro_alrededor((T0 - S0).normalized(), d, E0 - S0)

    def _resolver_brazo(self, pedido):
        _, cad, claves, ref, lado, _, _, _, _ = pedido
        B = self.arm.data.bones
        pb = self.arm.pose.bones
        cb = _canal(self.accion, self.arm.animation_data.action_slot)
        hombro, sup, inf, ext = cad
        cuerpo = getattr(self, "cuerpo_forma", None)
        claves = sorted(claves, key=lambda c: c[0])
        inv_ref = B[ref].matrix_local.inverted()
        fs = [c[0] for c in claves]
        locs = [inv_ref @ Vector(c[1]) for c in claves]
        manos = [c[3] for c in claves]
        para = [bool(c[4]) for c in claves]
        phi0 = self._codo_reposo(cad, lado)
        # el codo de cada pose clave: el pedido, o el que mejor libra el cuerpo
        codos = []
        for i, c in enumerate(claves):
            if c[2] is not None:
                codos.append(phi0 + c[2])
                continue
            ev = ev_con_inversas(self._ev(fs[i]), self.arm) if cuerpo else self._ev(fs[i])
            S = ev[sup].to_translation()
            T = ev[ref] @ locs[i]
            d = self._polo_ref(cad, lado, ev)
            m = self._mejor_codo(cad, S, T, S + d, manos[i], cuerpo, ev, codos[-1] if codos else phi0)
            # si ni el mejor codo libra el cuerpo, la pose se separa de él
            sep = 0.0
            while cuerpo is not None and m[3] > 0.003 and sep < 0.3:
                sep += 0.02
                T2 = T + _fuera(T, ev) * sep
                m = self._mejor_codo(cad, S, T2, S + d, manos[i], cuerpo, ev, codos[-1] if codos else phi0)
            if sep > 0:
                locs[i] = ev[ref].inverted() @ (T + _fuera(T, ev) * sep)
            codos.append(m[2])

        def tangentes(vals):
            out = []
            for i in range(len(vals)):
                if para[i] or i == 0 or i == len(vals) - 1:
                    out.append(vals[i] * 0)
                else:
                    out.append((vals[i + 1] - vals[i - 1]) / (fs[i + 1] - fs[i - 1]))
            return out
        tl = tangentes(locs)
        tc = tangentes(codos)

        def en(f, vals, tans):
            if f <= fs[0]:
                return vals[0]
            if f >= fs[-1]:
                return vals[-1]
            i = max(k for k in range(len(fs) - 1) if fs[k] <= f)
            dur = fs[i + 1] - fs[i]
            t = (f - fs[i]) / dur
            h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
            return vals[i] * h00 + tans[i] * (h10 * dur) + vals[i + 1] * h01 + tans[i + 1] * (h11 * dur)

        resultados = {}
        memoria = {}
        memorias = {}
        rel = self.qr[inf].inverted() @ self.qr[ext]
        giro_h = f"antebrazo_giro_{lado}" if f"antebrazo_giro_{lado}" in B else None
        loc_sup = B[hombro].matrix_local.inverted() @ B[sup].head_local
        for f in range(int(fs[0]), int(fs[-1]) + 1):
            ev = self._ev(f)
            S = ev[sup].to_translation()
            T = ev[ref] @ en(f, locs, tl)
            phi = en(f, codos, tc)
            d = self._polo_ref(cad, lado, ev)
            u = (T - S).normalized()
            E, Tn, q1, q2 = self._dos_huesos(cad, S, T, S + Quaternion(u, math.radians(phi)) @ d)
            # el hombro acompaña una parte de lo que gira el brazo (si no, la manga se
            # separa de la hombrera y se abre la malla por detrás)
            E_fk = ev[inf].to_translation()
            giro_b = (E_fk - S).rotation_difference(E - S)
            ang = min(giro_b.angle * HOMBRO_SIGUE, math.radians(HOMBRO_TOPE))
            q_h = Quaternion(giro_b.axis, ang) if giro_b.angle > 1e-5 else Quaternion()
            H = ev[hombro].to_translation()
            M_h = Matrix.Translation(H) @ q_h.to_matrix().to_4x4() @ Matrix.Translation(-H) @ ev[hombro]
            S = M_h @ loc_sup
            u = (T - S).normalized()
            E, Tn, q1, q2 = self._dos_huesos(cad, S, T, S + Quaternion(u, math.radians(phi)) @ d)
            nat = q2 @ rel
            # la mano: de una pose clave a la otra (None = la natural de ese cuadro)
            i = max([k for k in range(len(fs)) if fs[k] <= f] or [0])
            j = min(i + 1, len(fs) - 1)
            a_, b_ = manos[i], manos[j]
            qo = None
            if a_ is not None or b_ is not None:
                t = 0.0 if j == i else _suave((f - fs[i]) / (fs[j] - fs[i]))
                # se interpola la diferencia contra la mano natural de este cuadro (la
                # que sigue al antebrazo): entre dos giros a casi media vuelta el camino
                # corto cambiaba de lado de un cuadro a otro y la mano brincaba
                ra = nat.inverted() @ a_ if a_ is not None else Quaternion()
                rb = nat.inverted() @ b_ if b_ is not None else Quaternion()
                # cada pose clave recuerda su giro de un cuadro al siguiente (cerca de
                # media vuelta el signo es ambiguo)
                ra = _recortar(ra, memorias.setdefault(i, {}), TOPE_GIRO_BRAZO)
                rb = _recortar(rb, memorias.setdefault(j, {}), TOPE_GIRO_BRAZO)
                if ra.dot(rb) < 0:
                    rb = -rb
                qo = nat @ _recortar(ra.slerp(rb, t), None, TOPE_GIRO_BRAZO)
            else:
                memoria.pop("giro", None)
            metas = {hombro: M_h,
                     sup: Matrix.Translation(S) @ q1.to_matrix().to_4x4(),
                     inf: Matrix.Translation(E) @ q2.to_matrix().to_4x4()}
            if qo is not None:
                metas[ext] = Matrix.Translation(Tn) @ qo.to_matrix().to_4x4()
            resultados[f] = self._mezclar_cadena([hombro, sup, inf, ext], ev, metas, 1.0)
            if giro_h:
                # el antebrazo se lleva parte del giro de la mano sobre su eje
                tw = _giro_y_doblez(nat.inverted() @ qo)[0] if qo is not None else 0.0
                resultados[f][giro_h] = (None, Quaternion((0, 1, 0), math.radians(tw * GIRO_REPARTO)))
        f0, f1 = fs[0], fs[-1]
        huesos = set(k for r in resultados.values() for k in r)
        for h in huesos:
            for fc in [fc for fc in cb.fcurves if fc.data_path == f'pose.bones["{h}"].rotation_quaternion']:
                for kp in reversed(list(fc.keyframe_points)):
                    if f0 - 1e-3 <= kp.co.x <= f1 + 1e-3:
                        fc.keyframe_points.remove(kp)
        prev = {}
        for f in sorted(resultados):
            for h, (_, rot) in resultados[f].items():
                if h in prev and prev[h].dot(rot) < 0:
                    rot = -rot
                prev[h] = rot
                pb[h].rotation_quaternion = rot
                pb[h].keyframe_insert("rotation_quaternion", frame=f)
        for fc in cb.fcurves:
            h = fc.data_path.split('"')[1]
            if h in huesos:
                for kp in fc.keyframe_points:
                    if f0 - 1e-3 <= kp.co.x <= f1 + 1e-3:
                        kp.interpolation = "LINEAR"
                fc.update()

    def _mejor_codo(self, cad, S, T, P, qo, cuerpo, ev, phi_prev):
        """(costo, polo, ángulo, hundido): el giro del codo con menos traspaso y menos
        muñeca torcida, cerca del del cuadro anterior."""
        _, sup, inf, extremo = cad
        mejor = None
        u = (T - S).normalized()
        for phi in range(-110, 111, 5):
            Pp = S + Quaternion(u, math.radians(phi)) @ (P - S)
            E, Tn, q1, q2 = self._dos_huesos(cad, S, T, Pp)
            nat = q2 @ (self.qr[inf].inverted() @ self.qr[extremo])
            qm = nat
            costo = 0.1 * abs(phi)
            # un codo apunta abajo, afuera o atrás; hacia arriba se ve dislocado
            # (Oscar). Lo que sube sobre la línea hombro-muñeca cuesta mucho.
            fuera_linea = (E - S) - (E - S).dot(u) * u
            if fuera_linea.length > 1e-6:
                costo += 400.0 * max(0.0, fuera_linea.normalized().z - 0.15)
            if qo is not None:
                giro, doblez = _giro_y_doblez(nat.inverted() @ qo)
                costo += 0.4 * abs(giro) + 0.6 * max(0.0, abs(doblez) - TOPE_DOBLEZ)
                qm = nat @ _recortar(nat.inverted() @ qo, None, TOPE_GIRO_BRAZO)
            hondo = 0.0
            if cuerpo is not None:
                for t, r in RADIO_ANTEBRAZO:
                    hondo += _hundido(E.lerp(Tn, t), r, cuerpo, ev)
                hondo += _hundido(Tn + qm @ Vector((0, 0.12, 0)), RADIO_MANO, cuerpo, ev)
            costo += 3000.0 * hondo
            if phi_prev is not None:
                costo += 0.5 * abs(phi - phi_prev)
            if mejor is None or costo < mejor[0]:
                mejor = (costo, Pp, phi, hondo)
        return mejor

    def _separaciones(self, cad, f0, f1, objetivo, polo, orient):
        """Cuánto hay que separar la mano del cuerpo en cada cuadro para que ningún
        codo meta el brazo, sin brincos: lo necesario, ensanchado y suavizado."""
        cuerpo = self.cuerpo_forma
        S_de = cad[1]
        nec = {}
        for f in range(int(f0), int(f1) + 1):
            ev = ev_con_inversas(self._ev(f), self.arm)
            S = ev[S_de].to_translation()
            T0 = objetivo(f, ev)
            P = polo(f, ev)
            qo = orient(f, ev) if orient is not None else None
            d = 0.0
            while d < 0.5:
                T = T0 + _fuera(T0, ev) * d
                if self._mejor_codo(cad, S, T, P, qo, cuerpo, ev, None)[3] < 0.003:
                    break
                d += 0.025
            nec[f] = d
        fs = sorted(nec)
        anch = {f: max(nec[g] for g in fs if abs(g - f) <= 5) for f in fs}
        return {f: sum(anch[g] for g in fs if abs(g - f) <= 4) / len([g for g in fs if abs(g - f) <= 4]) for f in fs}

    def _dos_huesos(self, cad, S, T, P):
        """IK de dos huesos: codo E, muñeca alcanzable Tn y giros en el mundo del
        hueso de arriba y del de abajo (conservan el plano en que doblan en reposo)."""
        B = self.arm.data.bones
        _, sup, inf, extremo = cad
        L1 = (B[inf].head_local - B[sup].head_local).length
        L2 = (B[extremo].head_local - B[inf].head_local).length
        d = T - S
        dist = max(abs(L1 - L2) * 1.001, min(d.length, (L1 + L2) * 0.9995))
        u = d.normalized()
        a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist)
        hh = math.sqrt(max(0.0, L1 * L1 - a * a))
        pv = P - S
        pv = (pv - pv.dot(u) * u).normalized()
        E = S + u * a + pv * hh
        Tn = S + u * dist
        S0, E0, W0 = B[sup].head_local, B[inf].head_local, B[extremo].head_local
        n0 = (E0 - S0).cross(W0 - E0)
        n1 = (E - S).cross(Tn - E)
        R1 = _base(E - S, n1) @ _base(E0 - S0, n0).transposed()
        R2 = _base(Tn - E, n1) @ _base(W0 - E0, n0).transposed()
        return E, Tn, R1.to_quaternion() @ self.qr[sup], R2.to_quaternion() @ self.qr[inf]

    def _mezclar(self, h, ev, metas, w):
        """Basis (loc, rot) que lleva el hueso h a metas[h], mezclado con su FK."""
        B = self.arm.data.bones
        b = B[h]
        pl = b.parent.matrix_local if b.parent else None
        pp = ev[b.parent.name] if b.parent else None
        basis = _base_de(b.matrix_local, pl, pp, metas[h])
        loc, rot, _ = basis.decompose()
        fk = self.arm.pose.bones[h]
        loc0, rot0 = fk.location.copy(), fk.rotation_quaternion.copy()
        if rot0.dot(rot) < 0:
            rot = -rot
        return (loc0.lerp(loc, w), rot0.slerp(rot, w))

    def _mezclar_cadena(self, cadena, ev, metas, w):
        """Como _mezclar, para una cadena: cada hijo parte de su padre ya resuelto."""
        B = self.arm.data.bones
        out = {}
        pose_padre = None
        for h in cadena:
            b = B[h]
            pp = pose_padre if pose_padre is not None else ev[b.parent.name]
            fk = self.arm.pose.bones[h]
            if h in metas:
                basis = _base_de(b.matrix_local, b.parent.matrix_local, pp, metas[h])
                _, rot, _ = basis.decompose()
                rot0 = fk.rotation_quaternion.copy()
                if rot0.dot(rot) < 0:
                    rot = -rot
                rot = rot0.slerp(rot, w)
            else:
                rot = fk.rotation_quaternion.copy()
            out[h] = (None, rot)
            basis = Matrix.Translation(fk.location) @ rot.to_matrix().to_4x4()
            pose_padre = pp @ b.parent.matrix_local.inverted() @ b.matrix_local @ basis
        return out


def _suave(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def _giro_alrededor(u, d, v):
    """Ángulo con signo (grados) de v respecto a d, alrededor del eje u (los dos
    proyectados en el plano perpendicular a u)."""
    a = (d - d.dot(u) * u).normalized()
    b = (v - v.dot(u) * u).normalized()
    return math.degrees(math.atan2(u.dot(a.cross(b)), a.dot(b)))


def _hundido(p, r, cuerpo, ev):
    """Qué tanto se mete una esfera (centro p, radio r) en la cabeza o el cuerpo.
    El cuerpo son cortes horizontales del reposo (una elipse cada CORTE de altura),
    cada uno pegado al hueso que lo mueve; la cabeza, un elipsoide en su hueso."""
    total = 0.0
    cortes, cabeza = cuerpo
    # el punto, llevado al reposo con el hueso del corte más cercano en altura
    hueso = "chest_03"
    for _ in range(2):
        pr = ev[hueso + "#inv"] @ p
        c = min(cortes, key=lambda c: abs(c["z"] - pr.z))
        if c["hueso"] == hueso:
            break
        hueso = c["hueso"]
    if cortes[0]["z"] - r <= pr.z <= cortes[-1]["z"] + r:
        k = math.hypot((pr.x - c["cx"]) / (c["ax"] + r), (pr.y - c["cy"]) / (c["ay"] + r))
        if k < 1.0:
            total += (1.0 - k) * (min(c["ax"], c["ay"]) + r)
    h, m, s = cabeza
    l = (ev[h] @ m).inverted() @ p
    k = Vector((l.x / (s.x + r), l.y / (s.y + r), l.z / (s.z + r))).length
    if k < 1.0:
        total += (1.0 - k) * (min(s) + r)
    return total


CORTE = 0.05
TORSO = ("hips_01", "spine_02", "chest_03", "neck_04")


def forma_cuerpo(arm, malla):
    """Los cortes del torso (con el hueso que mueve cada altura) y el elipsoide de la
    cabeza, del reposo."""
    B = arm.data.bones
    gn = {g.index: g.name for g in malla.vertex_groups}
    torso, cab = [], []
    for v in malla.data.vertices:
        if not v.groups:
            continue
        g = max(v.groups, key=lambda g: g.weight)
        n = gn[g.group]
        if n in TORSO:
            torso.append((v.co.copy(), n))
        elif n in ("head_05", "quijada"):
            cab.append(B["head_05"].matrix_local.inverted() @ v.co)
    z0 = min(p.z for p, _ in torso)
    z1 = max(p.z for p, _ in torso)
    cortes = []
    z = z0 + CORTE / 2
    while z < z1:
        sel = [(p, n) for p, n in torso if abs(p.z - z) <= CORTE * 0.75]
        if len(sel) > 20:
            xs = [p.x for p, _ in sel]
            ys = [p.y for p, _ in sel]
            cuenta = {}
            for _, n in sel:
                cuenta[n] = cuenta.get(n, 0) + 1
            cortes.append({"z": z, "cx": (min(xs) + max(xs)) / 2, "cy": (min(ys) + max(ys)) / 2,
                           "ax": (max(xs) - min(xs)) / 2, "ay": (max(ys) - min(ys)) / 2,
                           "hueso": max(cuenta, key=cuenta.get)})
        z += CORTE
    lo = Vector((min(p.x for p in cab), min(p.y for p in cab), min(p.z for p in cab)))
    hi = Vector((max(p.x for p in cab), max(p.y for p in cab), max(p.z for p in cab)))
    return cortes, ("head_05", Matrix.Translation((lo + hi) / 2), (hi - lo) / 2 * 1.02)


def _fuera(T, ev):
    """Hacia dónde se separa una mano del cuerpo: afuera del pecho y un poco al frente."""
    d = T - ev["chest_03"].to_translation()
    d.z = 0
    if d.length < 1e-6:
        d = Vector((0, -1, 0))
    return (d.normalized() + Vector((0, -1.0, 0))).normalized()


def ev_con_inversas(ev, arm):
    """Agrega a ev, para cada hueso del torso, la matriz que lleva del posado al reposo."""
    B = arm.data.bones
    for h in TORSO:
        ev[h + "#inv"] = (ev[h] @ B[h].matrix_local.inverted()).inverted()
    return ev


# Radio del brazo de Argus a lo largo del antebrazo (medido en la malla: el guante es
# gordo) y de la mano
RADIO_ANTEBRAZO = ((-0.15, 0.195), (0.0, 0.195), (0.25, 0.185), (0.5, 0.175), (0.75, 0.165), (1.0, 0.155))
RADIO_MANO = 0.13


# Lo que aguanta la muñeca de Argus (grados): girar sobre el eje del antebrazo
# (la malla se tuerce como envoltura de dulce) y doblar.
TOPE_GIRO = 22.0
TOPE_DOBLEZ = 70.0
# Con el hueso de giro del antebrazo (que se lleva GIRO_REPARTO del giro) la mano
# puede voltear mucho más sin que la muñeca se retuerza.
TOPE_GIRO_BRAZO = 130.0
GIRO_REPARTO = 0.65
# El hombro acompaña esta parte de lo que gira el brazo, hasta HOMBRO_TOPE grados.
HOMBRO_SIGUE = 0.35
HOMBRO_TOPE = 22.0


def _giro_y_doblez(qr):
    """Separa un giro de la mano (en su espacio) en el giro sobre su eje Y (el del
    antebrazo) y el doblez que queda. Devuelve grados con signo."""
    tw = Quaternion((qr.w, 0.0, qr.y, 0.0))
    if tw.magnitude < 1e-8:
        return 180.0, 0.0
    tw.normalize()
    sw = qr @ tw.inverted()
    giro = math.degrees(2 * math.atan2(tw.y, tw.w))
    giro = (giro + 180) % 360 - 180
    return giro, math.degrees(sw.angle) if sw.angle <= math.pi else math.degrees(2 * math.pi - sw.angle)


def _recortar(qr, memoria=None, tope_giro=None):
    """El giro de la mano recortado a lo que aguanta la muñeca. `memoria` (dict) guarda
    el giro del cuadro anterior: sin ella, un giro pedido cerca de media vuelta salta
    de +180 a -180 y el tope cambia de lado de golpe."""
    tw = Quaternion((qr.w, 0.0, qr.y, 0.0))
    if tw.magnitude < 1e-8:
        return Quaternion()
    tw.normalize()
    sw = qr @ tw.inverted()
    giro = 2 * math.atan2(tw.y, tw.w)
    giro = (giro + math.pi) % (2 * math.pi) - math.pi
    if memoria is not None:
        prev = memoria.get("giro")
        if prev is not None:
            while giro - prev > math.pi:
                giro -= 2 * math.pi
            while giro - prev < -math.pi:
                giro += 2 * math.pi
        memoria["giro"] = giro
    tg = math.radians(TOPE_GIRO if tope_giro is None else tope_giro)
    giro = max(-tg, min(tg, giro))
    ang = sw.angle
    if ang > math.pi:
        ang -= 2 * math.pi
    eje = sw.axis
    ang = max(-math.radians(TOPE_DOBLEZ), min(math.radians(TOPE_DOBLEZ), ang))
    return Quaternion(eje, ang) @ Quaternion((0, 1, 0), giro)


def _base_de(m_local, padre_local, padre_pose, m_pose):
    if padre_local is None:
        return m_local.inverted() @ m_pose
    return (padre_local.inverted() @ m_local).inverted() @ padre_pose.inverted() @ m_pose
