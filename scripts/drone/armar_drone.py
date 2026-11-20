"""
Rig y animación del drone del imperio Etherean (el modelo de Oscar,
public/3dmodels/madre_etherean_empire_drone.glb, que viene de Sketchfab con las
piezas juntas por material: Base, Metals, Screens, Glows).

Se corre con Blender 5.3 en segundo plano:
  "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --python scripts/drone/armar_drone.py -- todo

  todo      importa el GLB, arma el rig, anima, guarda el .blend y exporta el GLB
  armar     solo importa y arma el rig (sin animación) y guarda el .blend
  animar    abre el .blend, rehace las acciones y lo guarda
  exportar  abre el .blend y exporta el GLB del sitio

El .blend de trabajo vive fuera del repo (BLEND). El GLB del sitio sale aparte
(SALIDA): el original de Oscar no se toca.

Qué hay en el rig (armature DroneRig):
  raiz            en el piso, debajo del drone; el sitio lo mueve entero desde aquí
  deriva          la deriva lenta del flotar (vaivén, alabeo, giro), ciclo de 96 cuadros
  cuerpo          el rebote de cada aleteo y el cabeceo, ciclo de 12 cuadros
  cuerpo_squash   solo deforma el cuerpo: squash and stretch (escala); sin hijos,
                  así la escala no le llega torcida a las alas
  ala_sup.L ...   cuatro alas; su eje X es el perno de la bisagra (la perilla
                  oscura de la cara de afuera), así el aleteo es girar en X.
                  Rotación bloqueada a X. Escala en Y = estirar la cuchilla.
  ala_*.punta     la mitad de afuera de cada ala: se queda atrás y latiguea
                  (follow-through), simulado como resorte y horneado.
.L = +X (la izquierda del drone, que mira a -Y), sup = +Z.
"""
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector, Matrix

_REPOS = [r"D:\Work\mroscar\Website\new\Skulley-Rad-Portfolio", r"D:\Work\mroscar\Website\new\SkulleyRadPortfolio"]
REPO = next((r for r in _REPOS if os.path.isdir(os.path.join(r, "public"))), _REPOS[0])
GLB = os.path.join(REPO, "public", "3dmodels", "madre_etherean_empire_drone.glb")
SALIDA = os.path.join(REPO, "public", "3dmodels", "madre_etherean_empire_drone_rig.glb")
BLEND = r"D:\Work\mroscar\Website\new\Drone\MadreDrone.blend"
FPS = 30
ALAS = ("sup.L", "sup.R", "inf.L", "inf.R")


# ---------------------------------------------------------------- importar

def _islas(bm):
    """Islas por conectividad de vértices: lista de listas de índices."""
    bm.verts.ensure_lookup_table()
    visto, out = set(), []
    for v in bm.verts:
        if v.index in visto:
            continue
        pila, isla = [v], []
        visto.add(v.index)
        while pila:
            x = pila.pop()
            isla.append(x.index)
            for e in x.link_edges:
                w = e.other_vert(x)
                if w.index not in visto:
                    visto.add(w.index)
                    pila.append(w)
        out.append(isla)
    return out


def importar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    vl = bpy.context.view_layer
    mallas = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in mallas:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in [o for o in bpy.data.objects if o.type == "EMPTY"]:
        bpy.data.objects.remove(o)
    for o in bpy.data.objects:
        o.select_set(o in mallas)
    vl.objects.active = mallas[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in mallas:
        o.name = o.name.replace("_0", "")
        o.data.name = o.name
        # Sketchfab duplica el UV en varias capas; el material solo usa la primera
        while len(o.data.uv_layers) > 1:
            o.data.uv_layers.remove(o.data.uv_layers[-1])
    _separar_pantalla()


def _separar_pantalla():
    """El domo de enfrente (donde están los ojos) va en su propio objeto y material,
    para que el sitio le ponga el shader de pantalla sin tocar las otras pantallas."""
    scr = bpy.data.objects["Drone_Screens"]
    copia = scr.copy()
    copia.data = scr.data.copy()
    copia.name = copia.data.name = "Drone_Pantalla"
    bpy.context.scene.collection.objects.link(copia)
    mat = scr.data.materials[0].copy()
    mat.name = "Pantalla"
    copia.data.materials[0] = mat

    def es_domo(f):
        return f.calc_center_median().y < -0.93

    for obj, quitar in ((scr, True), (copia, False)):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        caras = [f for f in bm.faces if es_domo(f) == quitar]
        bmesh.ops.delete(bm, geom=caras, context="FACES")
        bm.to_mesh(obj.data)
        bm.free()


# ---------------------------------------------------------------- medir las alas

def _clasificar():
    """Para cada malla: a qué ala pertenece cada vértice (o None = cuerpo).
    Un ala es toda isla cuyo centro cae en una esquina (|x|, |z| > 0.4), lejos del
    centro (radial > 0.95) y no adelante (y > -0.3): cuchilla, franja de luz,
    perilla y tapas de la raíz. Los conos oscuros de los hombros y los tornillos
    del frente se quedan con el cuerpo."""
    asignacion = {}
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.verts.ensure_lookup_table()
        ala_de = [None] * len(bm.verts)
        for isla in _islas(bm):
            c = sum((bm.verts[i].co for i in isla), Vector()) / len(isla)
            radial = (abs(c.x) + abs(c.z)) / math.sqrt(2)
            if abs(c.x) > 0.4 and abs(c.z) > 0.4 and radial > 0.95 and c.y > -0.3:
                nombre = ("sup" if c.z > 0 else "inf") + "." + ("L" if c.x > 0 else "R")
                for i in isla:
                    ala_de[i] = nombre
        asignacion[o.name] = ala_de
        bm.free()
    return asignacion


def _medir_alas(asignacion):
    """Bisagra y punta de cada ala. La perilla oscura (Metals) es un disco en la cara
    de afuera de la cuchilla: su normal es el eje del perno."""
    import numpy as np
    alas = {}
    metals = bpy.data.objects["Drone_Metals"]
    base = bpy.data.objects["Drone_Base"]
    for ala in ALAS:
        bm = bmesh.new()
        bm.from_mesh(metals.data)
        bm.verts.ensure_lookup_table()
        pts = np.array([list(v.co) for v in bm.verts if asignacion["Drone_Metals"][v.index] == ala])
        bm.free()
        k = pts.mean(0)
        q = pts - k
        w, v = np.linalg.eigh(q.T @ q / len(pts))
        eje = Vector(v[:, 0])
        radial = Vector((math.copysign(1, k[0]), 0, math.copysign(1, k[2]))).normalized()
        if eje.dot(radial) < 0:
            eje = -eje
        K = Vector(k)
        bpts = [Vector(x.co) for x in base.data.vertices if asignacion["Drone_Base"][x.index] == ala]
        T = max(bpts, key=lambda p: (p - K).length)
        y = (T - K).normalized()
        x = (eje - eje.dot(y) * y).normalized()
        # ¿girar +X sube la punta? (+Z del mundo)
        sube = x.cross(T - K).z > 0
        alas[ala] = {"K": K, "T": T, "x": x, "signo": 1 if sube else -1}
    return alas


# ---------------------------------------------------------------- armar

CENTRO = Vector((0.0, -0.167, 0.0))   # centro del cuerpo (la isla grande de Base)
PISO_Z = -1.6
CORTE_PUNTA = 0.42                     # dónde empieza la punta, en fracción del ala
MEZCLA = (0.30, 0.60)                  # tramo en que el peso pasa del ala a la punta


def armar():
    importar()
    asignacion = _clasificar()
    alas = _medir_alas(asignacion)

    data = bpy.data.armatures.new("DroneRig")
    arm = bpy.data.objects.new("DroneRig", data)
    bpy.context.scene.collection.objects.link(arm)
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    arm.select_set(True)
    vl.objects.active = arm
    data.display_type = "OCTAHEDRAL"
    arm.show_in_front = True
    bpy.ops.object.mode_set(mode="EDIT")
    eb = data.edit_bones

    raiz = eb.new("raiz")
    raiz.head = (CENTRO.x, CENTRO.y, PISO_Z)
    raiz.tail = (CENTRO.x, CENTRO.y + 0.8, PISO_Z)
    raiz.use_deform = False

    deriva = eb.new("deriva")
    deriva.head = CENTRO
    deriva.tail = CENTRO + Vector((0, 0, 0.5))
    deriva.parent = raiz
    deriva.use_deform = False

    cuerpo = eb.new("cuerpo")
    cuerpo.head = CENTRO
    cuerpo.tail = CENTRO + Vector((0, 0, 0.8))
    cuerpo.parent = deriva
    cuerpo.use_deform = False

    sq = eb.new("cuerpo_squash")
    sq.head = CENTRO
    sq.tail = CENTRO + Vector((0, 0, 0.65))
    sq.parent = cuerpo

    for ala, d in alas.items():
        K, T, x = d["K"], d["T"], d["x"]
        y = (T - K).normalized()
        largo = (T - K).length
        mid = K + y * (largo * CORTE_PUNTA)
        b = eb.new("ala_" + ala)
        b.head, b.tail = K, mid
        b.align_roll(x.cross(y))
        b.parent = cuerpo
        p = eb.new("ala_" + ala + ".punta")
        p.head, p.tail = mid, T
        p.align_roll(x.cross(y))
        p.parent = b
        p.use_connect = True
    bpy.ops.object.mode_set(mode="OBJECT")

    # comprobar que el eje X de cada ala quedó en el perno
    for ala, d in alas.items():
        bx = (data.bones["ala_" + ala].matrix_local.to_3x3() @ Vector((1, 0, 0)))
        d["error_eje_grados"] = math.degrees(bx.angle(d["x"]))

    # colecciones de huesos y colores (para animar a mano en Blender)
    ctl = data.collections.new("Controles")
    alas_col = data.collections.new("Alas")
    for b in data.bones:
        (alas_col if b.name.startswith("ala_") else ctl).assign(b)
        b.color.palette = "THEME04" if b.name.startswith("ala_") else ("THEME09" if b.name == "cuerpo_squash" else "THEME03")

    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
        if pb.name.startswith("ala_"):
            pb.lock_rotation = (False, True, True)   # bisagra: solo X
            if pb.name.endswith(".punta"):
                pb.lock_location = (True, True, True)
        if pb.name == "cuerpo_squash":
            pb.lock_location = (True, True, True)
            pb.lock_rotation = (True, True, True)

    _pesar(arm, asignacion, alas)
    arm["alas"] = json.dumps({a: {"K": list(d["K"]), "T": list(d["T"]), "signo": d["signo"]} for a, d in alas.items()})
    bpy.context.scene.render.fps = FPS
    return arm, alas


def _pesar(arm, asignacion, alas):
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        o.vertex_groups.clear()
        g_cuerpo = o.vertex_groups.new(name="cuerpo_squash")
        grupos = {}
        for ala in ALAS:
            grupos[ala] = (o.vertex_groups.new(name="ala_" + ala), o.vertex_groups.new(name="ala_" + ala + ".punta"))
        a0, a1 = MEZCLA
        for v in o.data.vertices:
            ala = asignacion[o.name][v.index]
            if ala is None:
                g_cuerpo.add([v.index], 1.0, "REPLACE")
                continue
            K, T = alas[ala]["K"], alas[ala]["T"]
            t = (v.co - K).dot((T - K).normalized()) / (T - K).length
            s = min(1.0, max(0.0, (t - a0) / (a1 - a0)))
            s = s * s * (3 - 2 * s)
            g_raiz, g_punta = grupos[ala]
            if s < 1.0:
                g_raiz.add([v.index], 1.0 - s, "REPLACE")
            if s > 0.0:
                g_punta.add([v.index], s, "REPLACE")
        mod = o.modifiers.new("DroneRig", "ARMATURE")
        mod.object = arm
        mw = o.matrix_world.copy()
        o.parent = arm
        o.matrix_world = mw


# ---------------------------------------------------------------- animar
#
# Cada acción se escribe como poses clave con su easing (como se animaría a
# mano, así se puede editar en el Graph Editor) y lo único horneado cuadro por
# cuadro es la punta de las alas (simulada) y lo que el squash mueve las alas.
# Ejes de `deriva` y `cuerpo` (y de su location): X = la izquierda del drone
# (+X del mundo), Y = arriba, Z = adelante (-Y del mundo). Rotación en ZXY: primero
# el alabeo (Z, sobre el eje de avance), luego el cabeceo (X, + = nariz abajo) y
# al último el giro (Y, + = voltea a su izquierda).

# Resorte de la punta: frecuencia natural, amortiguamiento y latigazo más grande y tope (grados)
PUNTA = dict(hz=6.0, zeta=0.32, pico=11.0, tope=16.0)

# Duración de cada acción (cuadros a 30 fps) y si se repite.
ACCIONES = {
    "IdleTranquilo": dict(cuadros=96, ciclo=True),
    "IdleJugueton": dict(cuadros=96, ciclo=True),
    "Arrancar": dict(cuadros=30, ciclo=False),
    "Avanzar": dict(cuadros=40, ciclo=True),
    "Detenerse": dict(cuadros=36, ciclo=False),
    "Invocar": dict(cuadros=54, ciclo=False),
}


def _canal(accion, slot):
    from bpy_extras import anim_utils
    return anim_utils.action_get_channelbag_for_slot(accion, slot)


class Autor:
    """Escribe las claves de una acción y al final les pone su interpolación."""

    def __init__(self, arm, nombre, cuadros, ciclo, alas):
        self.arm, self.alas = arm, alas
        self.cuadros, self.ciclo = cuadros, ciclo
        for a in [a for a in bpy.data.actions if a.name == nombre]:
            bpy.data.actions.remove(a)
        ad = arm.animation_data or arm.animation_data_create()
        ad.action = None
        for pb in arm.pose.bones:
            pb.location = (0, 0, 0)
            pb.rotation_euler = (0, 0, 0)
            pb.scale = (1, 1, 1)
            pb.rotation_mode = "ZXY" if pb.name in ("cuerpo", "deriva") else "XYZ"
        self.accion = bpy.data.actions.new(nombre)
        ad.action = self.accion
        self.marcas = {}

    def k(self, hueso, ruta, i, f, v, interp="BEZIER", easing="AUTO", back=None):
        pb = self.arm.pose.bones[hueso]
        getattr(pb, ruta)[i] = v
        pb.keyframe_insert(data_path=ruta, index=i, frame=f)
        self.marcas[(hueso, ruta, i, round(f, 3))] = (interp, easing, back)

    def canal(self, hueso, ruta, i, claves, grados=False, interp="BEZIER"):
        """claves: [(cuadro, valor)] o [(cuadro, valor, interp, easing, back)]."""
        for c in claves:
            f, v = c[0], c[1]
            it, es, bk = (c[2], c[3] if len(c) > 3 else "AUTO", c[4] if len(c) > 4 else None) if len(c) > 2 else (interp, "AUTO", None)
            self.k(hueso, ruta, i, f, math.radians(v) if grados else v, it, es, bk)

    # -- el cuerpo
    def altura(self, claves, hueso="cuerpo"):
        self.canal(hueso, "location", 1, claves)

    def avance(self, claves, hueso="cuerpo"):
        self.canal(hueso, "location", 2, claves)

    def lado(self, claves, hueso="cuerpo"):
        self.canal(hueso, "location", 0, claves)

    def cabeceo(self, claves, hueso="cuerpo"):
        self.canal(hueso, "rotation_euler", 0, claves, grados=True)

    def giro(self, claves, hueso="cuerpo"):
        self.canal(hueso, "rotation_euler", 1, claves, grados=True)

    def alabeo(self, claves, hueso="cuerpo"):
        self.canal(hueso, "rotation_euler", 2, claves, grados=True)

    def squash(self, claves):
        """[(cuadro, vertical, avance)]: escala del cuerpo arriba-abajo y adelante-atrás;
        el resto conserva el volumen."""
        for (f, v, a) in claves:
            sx = 1 / math.sqrt(v * a)
            for i, s in enumerate((sx, v / math.sqrt(a), a / math.sqrt(v))):
                self.k("cuerpo_squash", "scale", i, f, s)

    # -- las alas
    def aleteo(self, f0, n, periodo, arriba, abajo, back=2.2, desfase_inf=1, cerrar=False, estira=1.0):
        """n aleteos desde f0. Arriba se cuelga (anticipación), baja de golpe en un
        tercio del aleteo con sobrepaso (BACK) y sube lenta el resto. Las de abajo
        siguen a las de arriba `desfase_inf` cuadros. `cerrar`: la última pose
        arriba de un ciclo (que empata con la primera)."""
        p = periodo
        for ala in ALAS:
            s = self.alas[ala]["signo"]
            off = desfase_inf if ala.startswith("inf") else 0
            h = "ala_" + ala
            for j in range(n + (1 if cerrar else 0)):
                arr = f0 + j * p + p / 6 + off
                self.k(h, "rotation_euler", 0, arr, math.radians(arriba * s), "BACK", "EASE_OUT", back)
                if j < n:
                    self.k(h, "rotation_euler", 0, arr + p / 3, math.radians(abajo * s), "SINE", "EASE_IN_OUT")
                    # estirar la cuchilla en lo rápido y aplastarla en el golpe
                    for (df, y) in ((-p / 12, 0.97), (p / 12, 1 + 0.15 * estira), (p / 4, 1 - 0.1 * estira), (5 * p / 12, 1.03), (7 * p / 12, 1.0)):
                        self._estira(h, arr + df, y)
                elif cerrar:
                    self._estira(h, arr - p / 12, 0.97)

    def pose_alas(self, f, ang, interp="BEZIER", easing="AUTO", back=None, desfase_inf=0, y=1.0):
        for ala in ALAS:
            s = self.alas[ala]["signo"]
            off = desfase_inf if ala.startswith("inf") else 0
            self.k("ala_" + ala, "rotation_euler", 0, f + off, math.radians(ang * s), interp, easing, back)
            self._estira("ala_" + ala, f + off, y)

    def _estira(self, h, f, y):
        xz = 1.0 / math.sqrt(y)
        for i, v in enumerate((xz, y, xz)):
            self.k(h, "scale", i, f, v)

    # -- cerrar
    def terminar(self):
        cb = _canal(self.accion, self.arm.animation_data.action_slot)
        for fc in cb.fcurves:
            hueso = fc.data_path.split('"')[1]
            ruta = fc.data_path.split(".")[-1]
            for kp in fc.keyframe_points:
                m = self.marcas.get((hueso, ruta, fc.array_index, round(kp.co.x, 3)))
                if m:
                    kp.interpolation = m[0]
                    if m[1] != "AUTO":
                        kp.easing = m[1]
                    if m[2] is not None:
                        kp.back = m[2]
                kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
            if self.ciclo:
                fc.modifiers.new("CYCLES")
            fc.update()
        self._compensar_squash(cb)
        self._simular_puntas(cb)
        self.accion.use_frame_range = True
        self.accion.frame_start, self.accion.frame_end = 0, self.cuadros
        self.accion.use_cyclic = self.ciclo
        self.accion.use_fake_user = True
        self.accion["ciclo"] = self.ciclo
        return self.accion

    def _hornear(self, cb, hueso, ruta, i, valores, interp):
        """valores: {cuadro: valor} de 0 a cuadros."""
        pb = self.arm.pose.bones[hueso]
        for f, v in valores.items():
            getattr(pb, ruta)[i] = v
            pb.keyframe_insert(data_path=ruta, index=i, frame=f)
        fc = next(x for x in cb.fcurves if x.data_path == f'pose.bones["{hueso}"].{ruta}' and x.array_index == i)
        for kp in fc.keyframe_points:
            kp.interpolation = interp
            kp.handle_left_type = kp.handle_right_type = "AUTO"
        if self.ciclo and not fc.modifiers:
            fc.modifiers.new("CYCLES")
        fc.update()

    def _compensar_squash(self, cb):
        """Que el squash del cuerpo no despegue las alas de sus hombros: cada ala se
        mueve lo que el squash mueve su bisagra (las alas no heredan la escala)."""
        fcs = [next((f for f in cb.fcurves if f.data_path.endswith('"cuerpo_squash"].scale') and f.array_index == i), None) for i in range(3)]
        if not any(fcs):
            return
        m_sq = self.arm.data.bones["cuerpo_squash"].matrix_local.to_3x3()
        for ala in ALAS:
            h = "ala_" + ala
            rel = self.alas[ala]["K"] - CENTRO
            rot = self.arm.data.bones[h].matrix_local.to_3x3().inverted()
            vals = [{}, {}, {}]
            for f in range(0, self.cuadros + 1):
                s = Matrix.Diagonal([fcs[i].evaluate(f) if fcs[i] else 1.0 for i in range(3)])
                d = rot @ (m_sq @ (s - Matrix.Identity(3)) @ m_sq.inverted() @ rel)
                for i in range(3):
                    vals[i][f] = d[i]
            for i in range(3):
                self._hornear(cb, h, "location", i, vals[i], "LINEAR")

    def _simular_puntas(self, cb):
        """La punta como un resorte rotacional colgado del ala: en el marco del ala
        sufre -θ'' (la inercia), se queda atrás, latiguea y se asienta. En un ciclo
        se simulan muchas vueltas (converge, es periódico) y se hornea la última; en
        una acción de una vez, desde el reposo."""
        w = 2 * math.pi * PUNTA["hz"]
        z = PUNTA["zeta"]
        L = self.cuadros
        vueltas = 6 if self.ciclo else 1
        for ala in ALAS:
            fc = next(f for f in cb.fcurves if f.data_path == f'pose.bones["ala_{ala}"].rotation_euler' and f.array_index == 0)
            dt = 1.0 / (FPS * 40)
            th = lambda t: fc.evaluate(t * FPS)
            phi = dphi = 0.0
            T = L / FPS
            pasos = int(round(vueltas * T / dt))
            muestras = {}
            prev_v = (th(dt) - th(0)) / dt
            for k in range(pasos + 1):
                t = k * dt
                v = (th(t + dt) - th(t)) / dt
                acc = (v - prev_v) / dt
                prev_v = v
                dphi += (-w * w * phi - 2 * z * w * dphi - acc) * dt
                phi += dphi * dt
                if k % 40 == 0 and t >= (vueltas - 1) * T - 1e-9:
                    muestras[int(round((t - (vueltas - 1) * T) * FPS))] = phi
            if self.ciclo:
                muestras[L] = muestras.get(0, 0.0)
            pico = max((abs(p) for p in muestras.values()), default=0) or 1.0
            escala = math.radians(PUNTA["pico"]) / PICO_REF.setdefault(ala, pico)
            tope = math.radians(PUNTA["tope"])
            vals = {f: tope * math.tanh(muestras.get(f, 0.0) * escala / tope) for f in range(0, L + 1)}
            self._hornear(cb, f"ala_{ala}.punta", "rotation_euler", 0, vals, "BEZIER")


# La respuesta de la punta se escala igual en todas las acciones: con la del
# idle tranquilo (su latigazo más grande = PUNTA["pico"]), así el aleteo rápido
# de avanzar latiguea más y el calmado menos, y no todo mide lo mismo.
PICO_REF = {}


def accion_idle_tranquilo(a):
    L = 96
    a.aleteo(0, 6, 16, 26, -18, back=1.8, desfase_inf=2, cerrar=True)
    for j in range(6):
        b = j * 16
        a.altura([(b + 3, -0.03), (b + 10, 0.035)])
        a.cabeceo([(b + 4, 1.5), (b + 12, -1.0)])
        a.squash([(b + 2, 0.96, 1.0), (b + 6, 1.035, 1.0), (b + 10, 1.0, 1.0)])
    a.altura([(L + 3, -0.03)])
    a.cabeceo([(L + 4, 1.5)])
    a.squash([(L + 2, 0.96, 1.0)])
    a.lado([(0, 0.0), (24, 0.05), (48, 0.0), (72, -0.05), (96, 0.0)], hueso="deriva")
    a.altura([(0, 0.0), (32, 0.035), (64, -0.025), (96, 0.0)], hueso="deriva")
    a.alabeo([(0, 3.0), (48, -3.0), (96, 3.0)], hueso="deriva")
    a.giro([(12, 5.0), (60, -5.0), (108, 5.0)], hueso="deriva")
    a.cabeceo([(20, 1.5), (68, -1.5), (116, 1.5)], hueso="deriva")


def accion_idle_jugueton(a):
    """Rebota, se ladea con curiosidad a un lado y al otro, menea el cuerpo como
    cola de perro y remata con una pirueta. Aletea rápido todo el rato."""
    L = 96
    a.aleteo(0, 9, 10, 32, -22, back=2.6, desfase_inf=1, cerrar=False, estira=1.3)
    # el aleteo de 10 no cabe exacto en 96: el último cierra en la pose de arriba del primero
    for ala in ALAS:
        s = a.alas[ala]["signo"]
        off = 1 if ala.startswith("inf") else 0
        a.k("ala_" + ala, "rotation_euler", 0, L + 10 / 6 + off, math.radians(32 * s), "BACK", "EASE_OUT", 2.6)
        a._estira("ala_" + ala, L + 10 / 6 + off - 10 / 12, 0.97)
    # dos brincos: despega estirado, arriba normal, cae aplastado
    a.altura([(0, 0.0), (5, 0.17), (11, -0.05), (16, 0.13), (22, -0.04), (28, 0.02),
              # se ladea y se queda viendo, con un saltito de curiosidad
              (36, 0.05), (42, 0.03), (48, 0.0),
              (60, 0.04), (72, 0.0),
              # la pirueta: sube, gira y cae
              (78, -0.05), (84, 0.22), (90, -0.06), (96, 0.0)])
    a.squash([(0, 1.0, 1.0), (3, 1.1, 1.0), (6, 1.0, 1.0), (10, 0.88, 1.0), (13, 1.08, 1.0), (17, 1.0, 1.0),
              (21, 0.9, 1.0), (25, 1.03, 1.0), (30, 1.0, 1.0),
              (77, 0.88, 1.0), (81, 1.12, 1.0), (86, 1.0, 1.0), (89, 0.86, 1.0), (93, 1.04, 1.0), (96, 1.0, 1.0)])
    # ladeos de curiosidad (alabeo) con su anticipación y sobrepaso
    a.alabeo([(0, 0.0), (26, 0.0), (29, -4.0), (34, 19.0, "BACK", "EASE_OUT", 2.0), (44, 16.0),
              (48, -4.0), (53, -19.0, "BACK", "EASE_OUT", 2.0), (58, -16.0), (70, -2.0), (74, 0.0), (96, 0.0)])
    # meneo de cola (giro) y la pirueta
    a.giro([(0, 0.0), (30, 0.0), (36, 9.0), (46, 6.0),
            (56, -12.0), (59, 12.0), (62, -10.0), (65, 8.0), (68, -4.0), (72, 0.0),
            (79, -14.0), (88, 360.0, "BACK", "EASE_OUT", 1.6), (96, 360.0)])
    a.cabeceo([(0, 0.0), (5, -6.0), (11, 5.0), (16, -5.0), (22, 4.0), (30, 0.0),
               (36, -4.0), (44, -3.0), (53, -4.0), (72, 0.0), (79, 6.0), (85, -8.0), (90, 5.0), (96, 0.0)])


def accion_arrancar(a):
    """Anticipación (se echa para atrás, nariz arriba, se aplasta, alas arriba
    colgadas), sale disparado estirado y da un giro completo sobre su eje de
    avance; termina en la pose de crucero de Avanzar."""
    # alas: arriba colgadas en la anticipación, golpe al salir, aleteo rápido
    a.pose_alas(0, 0.0, "SINE", "EASE_OUT")
    a.pose_alas(7, 38.0, "BACK", "EASE_OUT", 2.8, desfase_inf=1, y=0.94)
    a.pose_alas(11, -26.0, "SINE", "EASE_IN_OUT", desfase_inf=1, y=1.18)
    a.aleteo(13, 1, 6, 16, -16, back=2.0, desfase_inf=1)
    a.aleteo(19, 1, 6, 16, -16, back=2.0, desfase_inf=1)
    a.aleteo(25, 1, 10, 24, -24, back=2.0, desfase_inf=1)
    a.avance([(0, 0.0), (7, -0.15), (10, 0.13, "BACK", "EASE_OUT", 1.4), (18, 0.03), (30, 0.0)])
    a.altura([(0, 0.0), (7, -0.04), (12, 0.05), (22, 0.0), (30, 0.0)])
    a.cabeceo([(0, 0.0), (7, -15.0), (11, 17.0, "BACK", "EASE_OUT", 1.6), (22, 11.0), (30, 9.0)])
    a.alabeo([(0, 0.0), (10, 0.0, "BACK", "EASE_OUT", 1.3), (23, 360.0), (30, 360.0)])
    a.squash([(0, 1.0, 1.0), (7, 1.04, 0.84), (9, 0.98, 1.2), (13, 1.0, 1.14), (20, 1.0, 1.05), (30, 1.0, 1.04)])


def accion_avanzar(a):
    """Crucero: nariz abajo, aleteo rápido, un poco estirado hacia adelante y un
    vaivén lento."""
    L = 40
    a.aleteo(0, 4, 10, 24, -24, back=2.0, desfase_inf=1, cerrar=True)
    for j in range(4):
        b = j * 10
        a.altura([(b + 2, -0.02), (b + 6, 0.02)])
        a.cabeceo([(b + 3, 10.5), (b + 8, 8.0)])
        a.squash([(b + 2, 1.0, 1.02), (b + 4, 1.0, 1.08), (b + 8, 1.0, 1.04)])
    a.altura([(L + 2, -0.02)])
    a.cabeceo([(L + 3, 10.5)])
    a.squash([(L + 2, 1.0, 1.02)])
    a.alabeo([(0, 4.0), (20, -4.0), (40, 4.0)], hueso="deriva")
    a.giro([(10, 3.0), (30, -3.0), (50, 3.0)], hueso="deriva")
    a.lado([(10, 0.03), (30, -0.03), (50, 0.03)], hueso="deriva")


def accion_detenerse(a):
    """Frena: nariz arriba de golpe, el cuerpo se sigue de largo y se aplasta de
    frente, las alas se abren arriba como freno de aire; luego se mece hasta
    quedar en reposo (oscilación amortiguada) y retoma el aleteo tranquilo."""
    a.pose_alas(0, 0.0, "SINE", "EASE_OUT", y=1.0)
    a.pose_alas(5, 40.0, "BACK", "EASE_OUT", 2.2, desfase_inf=1, y=1.06)
    a.pose_alas(12, 34.0, "SINE", "EASE_IN_OUT", desfase_inf=1)
    a.aleteo(12, 1, 12, 34, -20, back=2.0, desfase_inf=1)
    a.aleteo(24, 1, 16, 26, -18, back=1.8, desfase_inf=2)
    a.avance([(0, 0.0), (6, 0.17, "BACK", "EASE_OUT", 1.2), (13, -0.05), (20, 0.02), (27, 0.0), (36, 0.0)])
    a.altura([(0, 0.0), (6, 0.04), (14, -0.03), (22, 0.01), (36, 0.0)])
    a.cabeceo([(0, 9.0), (6, -24.0, "BACK", "EASE_OUT", 1.2), (13, 10.0), (19, -5.0), (25, 2.0), (31, 0.0), (36, 0.0)])
    a.squash([(0, 1.0, 1.04), (5, 1.06, 0.84), (11, 0.97, 1.07), (17, 1.0, 0.98), (24, 1.0, 1.0), (36, 1.0, 1.0)])


# El cuadro en que azota en Invocar: ahí cae el rayo del castigo (DroneNPC lo
# arranca INVOCAR_GOLPE / 30 s antes del rayo).
INVOCAR_GOLPE = 36


def accion_invocar(a):
    """Invoca el rayo del castigo (Oscar, 2026-11-19: "como si ella provocara el
    relámpago"). Se agacha juntando fuerza, sube mirando al cielo con las alas
    arriba temblando cada vez más, se sostiene tensa un instante y azota hacia
    el jugador (nariz abajo, se lanza, alas abajo de golpe) en INVOCAR_GOLPE;
    después rebota y se queda viéndolo con aleteo rápido."""
    g = INVOCAR_GOLPE
    # alas: abajo en la anticipación, arriba temblando, golpe abajo, aleteo enojado
    a.pose_alas(0, 0.0, "SINE", "EASE_IN_OUT")
    a.pose_alas(7, -14.0, "BACK", "EASE_OUT", 1.6, y=0.96)
    a.pose_alas(16, 40.0, "SINE", "EASE_OUT", y=1.04)
    # temblor de las alas: cada vez más rápido y más fuerte hasta el golpe
    f, j = 17, 0
    while f < g - 2:
        amp = 2.5 + 6.0 * (f - 17) / (g - 19)
        a.pose_alas(f, 40.0 + (amp if j % 2 == 0 else -amp), "LINEAR")
        f += 2 if f < 27 else 1
        j += 1
    a.pose_alas(g - 2, 46.0, "BACK", "EASE_OUT", 2.6, y=0.95)
    a.pose_alas(g + 1, -30.0, "SINE", "EASE_IN_OUT", y=1.2)
    a.pose_alas(g + 4, -20.0, "SINE", "EASE_IN_OUT", y=0.92)
    a.aleteo(g + 6, 1, 8, 30, -22, back=2.4, desfase_inf=1)
    a.aleteo(g + 14, 1, 8, 30, -22, back=2.4, desfase_inf=1)
    # cuerpo: se agacha, sube mirando arriba, azota hacia adelante y abajo
    a.altura([(0, 0.0), (7, -0.12), (24, 0.32), (g - 2, 0.36), (g + 1, 0.1, "BACK", "EASE_OUT", 1.5), (g + 8, 0.16), (54, 0.12)])
    a.cabeceo([(0, 0.0), (7, 8.0), (24, -32.0), (g - 2, -36.0), (g + 1, 30.0, "BACK", "EASE_OUT", 1.4), (g + 9, 9.0), (54, 10.0)])
    a.avance([(0, 0.0), (7, -0.06), (g - 2, -0.14), (g + 1, 0.3, "BACK", "EASE_OUT", 1.3), (g + 10, 0.06), (54, 0.04)])
    # temblor del cuerpo en la carga (de lado), creciendo
    temblor = [(0, 0.0), (17, 0.0)]
    f, j = 18, 0
    while f < g - 1:
        amp = 0.006 + 0.022 * (f - 18) / (g - 19)
        temblor.append((f, amp if j % 2 == 0 else -amp, "LINEAR"))
        f += 1
        j += 1
    temblor += [(g - 1, 0.0), (54, 0.0)]
    a.lado(temblor)
    a.squash([(0, 1.0, 1.0), (7, 0.88, 1.0), (14, 1.1, 1.0), (24, 1.04, 1.0), (g - 2, 1.06, 0.92),
              (g, 0.82, 1.2), (g + 3, 1.08, 0.95), (g + 7, 0.97, 1.02), (g + 12, 1.0, 1.0), (54, 1.0, 1.0)])


ESCRIBIR = {
    "IdleTranquilo": accion_idle_tranquilo,
    "IdleJugueton": accion_idle_jugueton,
    "Arrancar": accion_arrancar,
    "Avanzar": accion_avanzar,
    "Detenerse": accion_detenerse,
    "Invocar": accion_invocar,
}


def animar(arm=None, alas=None, solo=None):
    if arm is None:
        arm = bpy.data.objects["DroneRig"]
    if alas is None:
        alas = {a: {"K": Vector(d["K"]), "T": Vector(d["T"]), "signo": d["signo"]} for a, d in json.loads(arm["alas"]).items()}
    sc = bpy.context.scene
    sc.render.fps = FPS
    for a in [a for a in bpy.data.actions if a.name == "Flotar"]:
        bpy.data.actions.remove(a)
    hechas = []
    for nombre, cfg in ACCIONES.items():
        if solo and nombre not in solo:
            continue
        aut = Autor(arm, nombre, cfg["cuadros"], cfg["ciclo"], alas)
        ESCRIBIR[nombre](aut)
        hechas.append(aut.terminar())
    arm.animation_data.action = bpy.data.actions["IdleTranquilo"]
    sc.frame_start, sc.frame_end = 0, ACCIONES["IdleTranquilo"]["cuadros"]
    return hechas


# ---------------------------------------------------------------- guardar y exportar

def guardar():
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


def exportar(ruta=SALIDA, comprimir=True):
    """Todas las acciones, cada una como su clip con su rango manual de cuadros
    (los ciclos empatan su primer y su último cuadro). Después, Draco."""
    arm = bpy.data.objects["DroneRig"]
    arm.animation_data.action = bpy.data.actions["IdleTranquilo"]
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(o.type in ("MESH", "ARMATURE"))
    vl.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format="GLB", use_selection=True,
        export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_step=1, export_frame_range=False,
        export_anim_slide_to_zero=True, export_optimize_animation_size=True,
        export_reset_pose_bones=True, export_rest_position_armature=True,
        export_skins=True, export_def_bones=False, export_leaf_bone=False,
        export_morph=False, export_materials="EXPORT", export_image_format="AUTO",
        export_cameras=False, export_lights=False, export_extras=False,
        export_yup=True, export_apply=False, export_texcoords=True, export_normals=True,
        export_tangents=False,
    )
    if comprimir:
        import subprocess
        npx = "npx.cmd" if os.name == "nt" else "npx"
        subprocess.run([npx, "gltf-transform", "draco", ruta, ruta], cwd=REPO, check=True)
    return ruta


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["todo"]
    cmd = argv[0]
    if cmd in ("todo", "armar"):
        arm, alas = armar()
        info = {a: {"error_eje_grados": d["error_eje_grados"], "signo": d["signo"], "K": list(d["K"]), "T": list(d["T"])} for a, d in alas.items()}
        print("ALAS", json.dumps(info))
        if cmd == "todo":
            animar(arm, alas)
        guardar()
    elif cmd == "animar":
        bpy.ops.wm.open_mainfile(filepath=BLEND)
        animar()
        guardar()
    if cmd in ("todo", "exportar"):
        if cmd == "exportar":
            bpy.ops.wm.open_mainfile(filepath=BLEND)
        print("GLB", exportar())


if __name__ == "__main__":
    main()
