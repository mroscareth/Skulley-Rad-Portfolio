"""
Exporta las animaciones de Skulley (Character/SkulleyRad.blend) a GLB para el sitio.

Se corre dentro de Blender (pestaña Scripting → abrir este archivo → Run Script),
o desde Claude con el MCP de Blender. Cada acción de ANIMACIONES sale como
public/animaciones/<archivo>.glb: solo el esqueleto (los 152 huesos de
deformación) con esa animación horneada cuadro por cuadro. Los controles del rig
(ctl_*, mch_*) no se exportan; lo que hacen sus restricciones queda horneado.

El esqueleto es el mismo de public/character.glb (mismas posiciones de reposo),
así que el sitio puede cargar estos clips aparte y reproducirlos sobre el
personaje: three empata las pistas por nombre de hueso ('head.x' llega como
'headx', igual que en character.glb). No re-exportes el personaje entero desde
el .blend: su malla no es la del sitio (las 33 piezas Egg_*/Skull0xx).

Antes de exportar una animación nueva, revisa que su acción tenga llave en
ctl_ajustes["rig"] (1 = controles; las de idle y walk viejas tienen 0 porque
son horneadas). Lo más fácil: duplicar la acción Plantilla_rig.

Los props (lentes, bóxers) también salen de aquí: exportar_prop("Boxers").
Los huesos prop_* (prop_cadera.l/.r, que giran la mitad que el muslo para la
tela de los bóxers) deforman para que el prop los use, pero no van en los
clips: el personaje del sitio no los tiene.
"""
import bpy
import json
import math
import os
import struct

REPO = r"D:\Work\mroscar\Website\new\SkulleyRadPortfolio"
SALIDA = os.path.join(REPO, "public", "animaciones")
ARMATURE = "root"

# acción del .blend -> nombre del archivo en public/animaciones (sin .glb)
ANIMACIONES = {
    "Correr": "correr",   # ciclo de 20 cuadros (0.67 s) en su lugar
}


def exportar(accion, archivo, carpeta=SALIDA, armature=ARMATURE):
    """Exporta UNA acción como <carpeta>/<archivo>.glb y regresa la ruta."""
    arm = bpy.data.objects[armature]
    act = bpy.data.actions[accion]
    ad = arm.animation_data or arm.animation_data_create()
    vl = bpy.context.view_layer
    antes = dict(action=ad.action, slot=getattr(ad, "action_slot", None), use_nla=ad.use_nla,
                 activo=vl.objects.active, seleccion=[o for o in vl.objects if o.select_get()],
                 cuadro=bpy.context.scene.frame_current)
    os.makedirs(carpeta, exist_ok=True)
    ruta = os.path.join(carpeta, archivo + ".glb")
    props = [b for b in arm.data.bones if b.name.startswith("prop_") and b.use_deform]
    try:
        for b in props:
            b.use_deform = False
        # Solo la acción pedida: sin el NLA (idle y walk viven en pistas NLA)
        ad.use_nla = False
        ad.action = act
        if len(act.slots):
            ad.action_slot = act.slots[0]
        for o in vl.objects:
            o.select_set(False)
        arm.select_set(True)
        vl.objects.active = arm
        bpy.ops.export_scene.gltf(
            filepath=ruta, export_format="GLB", use_selection=True,
            export_animations=True, export_animation_mode="ACTIVE_ACTIONS",
            export_nla_strips_merged_animation_name=accion,  # sin esto el clip sale como "Animation"
            export_def_bones=True,            # fuera ctl_* y mch_* (solo funciona con export_skins)
            export_force_sampling=True,       # hornea IK y giros
            export_frame_step=1, export_frame_range=False,
            export_anim_slide_to_zero=False,  # igual que los clips de character.glb (empiezan en 1/30 s)
            export_optimize_animation_size=False,  # cada hueso con sus 3 pistas, como character.glb
            export_reset_pose_bones=True, export_rest_position_armature=True,
            export_anim_single_armature=True, export_leaf_bone=False,
            export_hierarchy_flatten_bones=False, export_armature_object_remove=False,
            export_skins=True, export_morph=False, export_materials="NONE",
            export_cameras=False, export_lights=False, export_extras=False,
            export_yup=True, export_apply=False,
        )
    finally:
        for b in props:
            b.use_deform = True
        ad.action = antes["action"]
        if antes["slot"] is not None:
            try:
                ad.action_slot = antes["slot"]
            except Exception:
                pass
        ad.use_nla = antes["use_nla"]
        for o in vl.objects:
            o.select_set(o in antes["seleccion"])
        vl.objects.active = antes["activo"]
        bpy.context.scene.frame_set(antes["cuadro"])
    return ruta


def aligerar(ruta):
    """Quita las llaves que sobran (gltf-transform resample): conserva las 456 pistas y los valores;
    el idle pasa de 640 a 260 KB. Necesita las dependencias del repo (npm install)."""
    import subprocess
    tmp = ruta[:-4] + "_tmp.glb"
    npx = "npx.cmd" if os.name == "nt" else "npx"
    r = subprocess.run([npx, "--no-install", "gltf-transform", "resample", ruta, tmp],
                       cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(tmp):
        print("no se pudo aligerar", ruta, r.stderr[-400:])
        return ruta
    os.replace(tmp, ruta)
    return ruta


def exportar_todas():
    return [aligerar(exportar(a, f)) for a, f in ANIMACIONES.items()]


# --- Props -----------------------------------------------------------------
# Salen en la pose de reposo, en las coordenadas del personaje. Los lentes van
# sin piel (el sitio los pega a la cabeza); los bóxers con la suya (pelvis,
# prop_cadera y muslos), y el sitio les pone la física de tela.
PROPS = {
    "Lentes": dict(archivo="lentes", piel=False),
    "Boxers": dict(archivo="boxers", piel=True),
}
SALIDA_PROPS = os.path.join(REPO, "public", "props")


def exportar_prop(nombre, carpeta=SALIDA_PROPS, armature=ARMATURE):
    """Exporta un prop a <carpeta>/<archivo>.glb, con Draco, y regresa la ruta."""
    cfg = PROPS[nombre]
    arm = bpy.data.objects[armature]
    ob = bpy.data.objects[nombre]
    vl = bpy.context.view_layer
    os.makedirs(carpeta, exist_ok=True)
    crudo = os.path.join(carpeta, cfg["archivo"] + "_raw.glb")
    ruta = os.path.join(carpeta, cfg["archivo"] + ".glb")
    bisel = ob.modifiers.get("Bisel")
    antes = dict(pose=arm.data.pose_position, oculto=arm.hide_get(), seg=bisel.segments if bisel else None,
                 activo=vl.objects.active, seleccion=[o for o in vl.objects if o.select_get()])
    try:
        arm.data.pose_position = "REST"
        arm.hide_set(False)
        if bisel:
            bisel.segments = 3
        vl.update()
        for o in vl.objects:
            o.select_set(False)
        ob.select_set(True)
        if cfg["piel"]:
            arm.select_set(True)
        vl.objects.active = ob
        bpy.ops.export_scene.gltf(
            filepath=crudo, export_format="GLB", use_selection=True, export_apply=True,
            export_animations=False, export_skins=cfg["piel"], export_def_bones=cfg["piel"],
            export_morph=False, export_materials="EXPORT", export_yup=True,
            export_cameras=False, export_lights=False, export_extras=False,
            export_texcoords=cfg["piel"], export_normals=True, export_tangents=False,
            export_vertex_color="NONE",
        )
    finally:
        arm.data.pose_position = antes["pose"]
        arm.hide_set(antes["oculto"])
        if bisel:
            bisel.segments = antes["seg"]
        for o in vl.objects:
            o.select_set(o in antes["seleccion"])
        vl.objects.active = antes["activo"]
    import subprocess
    npx = "npx.cmd" if os.name == "nt" else "npx"
    r = subprocess.run([npx, "--no-install", "gltf-transform", "draco", crudo, ruta], cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(ruta):
        print("no se pudo comprimir", crudo, r.stderr[-400:])
        return crudo
    os.remove(crudo)
    return ruta


# --- Comprobación contra el GLB del sitio -------------------------------------

_COMP = {5120: ("b", 127.0), 5121: ("B", 255.0), 5122: ("h", 32767.0), 5123: ("H", 65535.0), 5125: ("I", None), 5126: ("f", None)}
_NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def _leer_glb(ruta):
    b = open(ruta, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    off = 20 + n
    binlen = struct.unpack("<I", b[off:off + 4])[0]
    return j, b[off + 8:off + 8 + binlen]


def _accessor(j, binc, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    fmt, norm = _COMP[a["componentType"]]
    k = _NCOMP[a["type"]]
    size = struct.calcsize(fmt)
    stride = bv.get("byteStride", size * k)
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    out = []
    for e in range(a["count"]):
        vals = struct.unpack_from("<" + fmt * k, binc, base + e * stride)
        if a.get("normalized") and norm:
            vals = tuple(max(v / norm, -1.0) for v in vals)
        out.append(vals)
    return out


def _pistas(ruta, nombre):
    j, binc = _leer_glb(ruta)
    anim = next(a for a in j["animations"] if a["name"] == nombre)
    pistas = {}
    for ch in anim["channels"]:
        s = anim["samplers"][ch["sampler"]]
        nodo = j["nodes"][ch["target"]["node"]]["name"].replace(".", "")
        pistas[(nodo, ch["target"]["path"])] = (_accessor(j, binc, s["input"]), _accessor(j, binc, s["output"]))
    return pistas


def comparar(clip_glb, nombre, sitio_glb=os.path.join(REPO, "public", "character.glb")):
    """Compara las pistas de un clip exportado contra las del mismo clip en el GLB del sitio."""
    a, b = _pistas(clip_glb, nombre), _pistas(sitio_glb, nombre)
    peor = (0.0, None)
    faltan = sorted(set(b) - set(a))
    for clave, (ta, va) in a.items():
        if clave not in b:
            continue
        tb, vb = b[clave]
        idx = {round(t[0], 4): i for i, t in enumerate(tb)}
        for i, t in enumerate(ta):
            k = idx.get(round(t[0], 4))
            if k is None:
                continue
            x, y = va[i], vb[k]
            if clave[1] == "rotation" and sum(p * q for p, q in zip(x, y)) < 0:
                y = tuple(-q for q in y)
            d = max(abs(p - q) for p, q in zip(x, y))
            if d > peor[0]:
                peor = (d, clave, round(t[0], 4))
    return dict(pistas_clip=len(a), pistas_sitio=len(b), faltan_en_clip=faltan[:10], peor=peor)


if __name__ == "__main__":
    for r in exportar_todas():
        print("exportado:", r)
