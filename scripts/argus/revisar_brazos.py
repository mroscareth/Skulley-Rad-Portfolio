"""
Revisa los brazos de cada acción de Argus cuadro a cuadro (Blender 5.3 en segundo plano):

  "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --python scripts/argus/revisar_brazos.py -- [acciones|todas]

Por hueso (hombro, brazo, antebrazo, mano) y lado:
  vel   giro en el mundo de un cuadro al siguiente (grados por cuadro a 30 fps)
  brinco  un cuadro que gira mucho más que sus vecinos (aceleración angular): eso se
          ve como teletransportación
  torsion  cuánto se tuerce la mano sobre el eje del antebrazo, y el antebrazo sobre el
          del brazo (la malla se retuerce como envoltura de dulce)
"""
import bpy
import json
import math
import os
import sys
from mathutils import Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import armar_argus as G  # noqa: E402
import acciones_lista as AL  # noqa: E402
from acciones_argus import BRAZO  # noqa: E402


def torsion(q_padre, q_hijo):
    """Giro del hijo sobre su eje Y respecto al padre (grados)."""
    r = q_padre.inverted() @ q_hijo
    tw = Quaternion((r.w, 0.0, r.y, 0.0))
    if tw.magnitude < 1e-8:
        return 180.0
    tw.normalize()
    a = math.degrees(2 * math.atan2(tw.y, tw.w))
    return (a + 180) % 360 - 180


def revisar(nombres):
    sc = bpy.context.scene
    arm = bpy.data.objects["Argus"]
    malla = bpy.data.objects["Argus_malla"]
    malla.modifiers["Argus"].show_viewport = False
    B = arm.data.bones
    out = {}
    for nombre in nombres:
        accion = bpy.data.actions[nombre]
        arm.animation_data.action = accion
        L = int(accion.frame_end)
        qs = {}
        for f in range(0, L + 1):
            sc.frame_set(f)
            for lado, cad in BRAZO.items():
                for h in cad:
                    qs.setdefault(h, []).append(arm.pose.bones[h].matrix.to_quaternion())
        r = {}
        for lado, cad in BRAZO.items():
            for h in cad:
                q = qs[h]
                vel = [math.degrees(q[i].rotation_difference(q[i + 1]).angle) for i in range(len(q) - 1)]
                vel = [v if v <= 180 else 360 - v for v in vel]
                brincos = []
                for i in range(1, len(vel) - 1):
                    vecinos = (vel[i - 1] + vel[i + 1]) / 2
                    if vel[i] > 6 and vel[i] > 2.5 * vecinos + 2:
                        brincos.append((i, round(vel[i], 1)))
                r[h] = {"vel_max": round(max(vel), 1), "en": vel.index(max(vel)), "brincos": brincos[:8]}
            sup, inf, mano = cad[1], cad[2], cad[3]
            tm = [abs(torsion(qs[inf][i], qs[mano][i]) - torsion(arm.data.bones[inf].matrix_local.to_quaternion(), arm.data.bones[mano].matrix_local.to_quaternion())) for i in range(L + 1)]
            ta = [abs(torsion(qs[sup][i], qs[inf][i]) - torsion(arm.data.bones[sup].matrix_local.to_quaternion(), arm.data.bones[inf].matrix_local.to_quaternion())) for i in range(L + 1)]
            tm = [t if t <= 180 else 360 - t for t in tm]
            ta = [t if t <= 180 else 360 - t for t in ta]
            r[f"torsion_mano_{lado}"] = (round(max(tm), 1), tm.index(max(tm)))
            r[f"torsion_antebrazo_{lado}"] = (round(max(ta), 1), ta.index(max(ta)))
        out[nombre] = r
    malla.modifiers["Argus"].show_viewport = True
    return out


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["todas"]
    bpy.ops.wm.open_mainfile(filepath=G.BLEND)
    nombres = list(AL.ACCIONES) if argv[0] == "todas" else argv[0].split(",")
    for n, r in revisar(nombres).items():
        print("BRAZOS", n, json.dumps(r))


if __name__ == "__main__":
    main()
