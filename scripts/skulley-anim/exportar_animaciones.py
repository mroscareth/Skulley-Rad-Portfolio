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

# La carpeta del repo se llama distinto en cada PC
_REPOS = [r"D:\Work\mroscar\Website\new\SkulleyRadPortfolio", r"D:\Work\mroscar\Website\new\Skulley-Rad-Portfolio"]
REPO = next((r for r in _REPOS if os.path.isdir(os.path.join(r, "public"))), _REPOS[0])
SALIDA = os.path.join(REPO, "public", "animaciones")
ARMATURE = "root"

# acción del .blend -> nombre del archivo en public/animaciones (sin .glb)
ANIMACIONES = {
    "Correr": "correr",   # ciclo de 20 cuadros (0.67 s) en su lugar
    # el idle con el pie izquierdo corregido (2026-11-18): mismo nombre que el de character.glb, el sitio lo reemplaza
    "root|root|Iddle": "idle",
}
# Las que reemplazan a un clip de character.glb llevan solo las pistas que cambian: el sitio las pone encima
# del clip del mismo nombre (conClipsDelBlend en accesoriosEstado.js). El idle completo pesa 262 KB y las seis
# pistas de la pierna izquierda unos KB (la primera pantalla del teléfono espera a este archivo).
PARCIALES = {"root|root|Iddle"}


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
    _solo_huesos(ruta)
    return ruta


def _solo_huesos(ruta):
    """Deja en el clip solo las pistas de los huesos, como los de character.glb. Si la acción también anima
    al objeto del armature (la del idle trae su posición, giro y escala, fijos), su pista tocaría el nodo
    'root' del personaje en cada cuadro."""
    def huesos(j):
        return {i for s in j.get("skins", []) for i in s["joints"]}
    return _quitar_canales(ruta, lambda j, c: c["target"].get("node") in huesos(j))


def solo_lo_que_cambia(ruta, nombre, umbral=1e-3, sitio_glb=os.path.join(REPO, "public", "character.glb")):
    """Deja solo las pistas que difieren (más de 'umbral') de las del clip del mismo nombre en character.glb,
    y limpia lo que queda sin usar (gltf-transform prune). Regresa cuántas quedaron."""
    a, b = _pistas(ruta, nombre), _pistas(sitio_glb, nombre)
    cambian = set()
    for clave, (ta, va) in a.items():
        if clave not in b:
            cambian.add(clave)
            continue
        tb, vb = b[clave]
        for i, t in enumerate(ta):
            x = va[i]
            # character.glb guarda las pistas fijas con menos llaves: se compara contra su valor interpolado
            k = next((k for k in range(1, len(tb)) if tb[k][0] >= t[0] - 1e-6), len(tb) - 1)
            t0, t1 = tb[k - 1][0] if k else tb[0][0], tb[k][0]
            u = 0.0 if t1 <= t0 else min(1.0, max(0.0, (t[0] - t0) / (t1 - t0)))
            y0, y1 = vb[k - 1] if k else vb[0], vb[k]
            if clave[1] == "rotation" and sum(p * q for p, q in zip(y0, y1)) < 0:
                y1 = tuple(-q for q in y1)
            y = tuple(p + (q - p) * u for p, q in zip(y0, y1))
            if clave[1] == "rotation":
                m = math.sqrt(sum(p * p for p in y)) or 1.0
                y = tuple(p / m for p in y)
            if clave[1] == "rotation" and sum(p * q for p, q in zip(x, y)) < 0:
                y = tuple(-q for q in y)
            if max(abs(p - q) for p, q in zip(x, y)) > umbral:
                cambian.add(clave); break
    _quitar_canales(ruta, lambda j, c: (j["nodes"][c["target"]["node"]]["name"].replace(".", ""), c["target"]["path"]) in cambian)
    import subprocess
    tmp = ruta[:-4] + "_tmp.glb"
    npx = "npx.cmd" if os.name == "nt" else "npx"
    r = subprocess.run([npx, "--no-install", "gltf-transform", "prune", ruta, tmp], cwd=REPO, capture_output=True, text=True)
    if r.returncode == 0 and os.path.exists(tmp):
        os.replace(tmp, ruta)
    else:
        print("no se pudo limpiar", ruta, r.stderr[-400:])
    return len(cambian)


def _quitar_canales(ruta, conservar):
    """Reescribe el GLB con solo los canales de animación para los que conservar(json, canal) es verdadero."""
    b = open(ruta, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    quitadas = 0
    for a in j.get("animations", []):
        canales = [c for c in a["channels"] if conservar(j, c)]
        quitadas += len(a["channels"]) - len(canales)
        usados = sorted({c["sampler"] for c in canales})
        nuevo = {v: i for i, v in enumerate(usados)}
        a["samplers"] = [a["samplers"][i] for i in usados]
        for c in canales:
            c["sampler"] = nuevo[c["sampler"]]
        a["channels"] = canales
    if not quitadas:
        return 0
    js = json.dumps(j, separators=(",", ":")).encode("utf-8")
    js += b" " * (-len(js) % 4)
    resto = b[20 + n:]
    total = 12 + 8 + len(js) + len(resto)
    with open(ruta, "wb") as f:
        f.write(b[:8] + struct.pack("<I", total) + struct.pack("<I", len(js)) + b"JSON" + js + resto)
    return quitadas


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
    rutas = []
    for a, f in ANIMACIONES.items():
        r = aligerar(exportar(a, f))
        if a in PARCIALES:
            solo_lo_que_cambia(r, a)
        rutas.append(r)
    return rutas


# --- Props -----------------------------------------------------------------
# Salen en la pose de reposo, en las coordenadas del personaje. Los lentes van
# sin piel (el sitio los pega a la cabeza); los bóxers con la suya (pelvis,
# prop_cadera y muslos), y el sitio les pone la física de tela.
# imagenes=False: el .blend lleva la textura para verla, pero el sitio pinta la
# suya en un canvas (accesorios.js) y no hace falta que viaje en el GLB.
PROPS = {
    "Lentes": dict(archivo="lentes", piel=False),
    "Boxers": dict(archivo="boxers", piel=True, imagenes=False),
    # con su imagen: el estampado de la espalda (Chamarra_Estampado) viaja en el GLB
    "Chamarra": dict(archivo="chamarra", piel=True, imagenes=True),
    # el hoodie sí lleva su textura: el SKULLEYRAD de las mangas (hoodie.py, estampado_mangas)
    "Hoodie": dict(archivo="hoodie", piel=True, imagenes=True),
    # los dos tenis en un objeto (tenis.py); el sitio los parte en izquierdo y derecho
    "Tenis": dict(archivo="tenis", piel=True, imagenes=False),
    # la chamarra inflada con picos (inflada.py), con su imagen: la X de la espalda y el pecho (Inflada_Estampado)
    "Inflada": dict(archivo="inflada", piel=True, imagenes=True),
    # las dos botas en un objeto (botas.py); el sitio las parte en izquierda y derecha, como los tenis
    "Botas": dict(archivo="botas", piel=True, imagenes=False),
    # los pantalones de mezclilla (pantalones.py), con su textura deslavada en JPEG (con ruido, en PNG pesa ~2 MB)
    "Pantalones": dict(archivo="pantalones", piel=True, imagenes=True, formato="JPEG"),
    # las dos muñequeras de picos en un objeto (munequeras.py), rígidas en forearm_twist; el sitio las parte en dos
    "Munequeras": dict(archivo="munequeras", piel=True, imagenes=False),
    # el beanie (beanie.py), todo en head.x, con sus dos imágenes: las costillas del tejido y la etiqueta
    "Beanie": dict(archivo="beanie", piel=True, imagenes=True),
    # los lentes 3D de cartón (lentes3d.py): sin piel, colgados de head.x como los Lentes
    "Lentes3D": dict(archivo="lentes3d", piel=False),
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
    antes = dict(pose=arm.data.pose_position, oculto=arm.hide_get(), prop_oculto=ob.hide_get(), seg=bisel.segments if bisel else None,
                 activo=vl.objects.active, seleccion=[o for o in vl.objects if o.select_get()])
    try:
        arm.data.pose_position = "REST"
        arm.hide_set(False)
        # oculto no se puede seleccionar y saldría solo el esqueleto (otras sesiones esconden props para ver los suyos)
        ob.hide_set(False)
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
            export_image_format=cfg.get("formato", "AUTO") if cfg.get("imagenes", True) else "NONE",
            export_cameras=False, export_lights=False, export_extras=False,
            export_texcoords=cfg["piel"], export_normals=True, export_tangents=False,
            export_vertex_color="NONE",
        )
    finally:
        arm.data.pose_position = antes["pose"]
        arm.hide_set(antes["oculto"])
        ob.hide_set(antes["prop_oculto"])
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
