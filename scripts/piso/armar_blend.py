"""Arma Character/PisoTierra.blend (en el repo, con los demás .blend del proyecto,
por Git LFS) para pintarle encima a las texturas del piso del home
(src/lib/pisoPintado.js).

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/piso/armar_blend.py

Antes hay que pintar los PNG maestros en Character/assets (lo hacen los pintores:
pintar_tierra.py, pintar_piedras.py y pintar_camino.py; ver IMAGENES). Deja una
imagen por textura (Non-Color), cada una en un plano con el azul aproximado del
sitio (para pintar en Texture Paint) y, la tierra, otro plano 3 × 3 para ver que
cierra sin costura. En Scripting: `Piso_generar` vuelve a pintar una textura con
otra semilla y `Piso_exportar` guarda los PNG y escribe los WebP del sitio en
public/textures.
"""
import os
import sys

import bpy

REPO_AQUI = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
# Dónde va el .blend (los PNG maestros, en su carpeta assets/).
carpeta = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.path.join(REPO_AQUI, 'Character')

# (imagen, PNG maestro, medida en el mundo (ancho, largo), lleva alfa, pintor, semilla, WebP del sitio)
IMAGENES = [
    ('PisoTierra', 'piso-tierra.png', (5.5, 5.5), False, 'pintar_tierra', 7, 'piso-tierra.webp'),
    ('PisoPiedras', 'piso-piedras.png', (26, 26), True, 'pintar_piedras', 11, 'piso-piedras.webp'),
    ('PisoPiedrasGlifo', 'piso-piedras-glifo.png', (26, 26), True, 'pintar_piedras', 23, 'piso-piedras-glifo.webp'),
    ('PisoCamino', 'piso-camino.png', (560 / (2048 / 26), 2520 / (2048 / 26)), True, 'pintar_camino', 5, 'piso-camino.webp'),
]

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)


def material(nombre, img, repetir, alfa):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    salida = nt.nodes.new('ShaderNodeOutputMaterial')
    emision = nt.nodes.new('ShaderNodeEmission')
    rampa = nt.nodes.new('ShaderNodeValToRGB')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.interpolation = 'Linear'
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapeo = nt.nodes.new('ShaderNodeMapping')
    mapeo.inputs['Scale'].default_value = (repetir, repetir, 1)
    # El azul del sitio, aproximado: el gris medio (0.5) es el azul de siempre,
    # abajo se oscurece un poco y arriba se acerca al blanco.
    r = rampa.color_ramp
    r.elements[0].position = 0.3
    r.elements[0].color = (0.0, 0.006, 0.12, 1)
    r.elements[1].position = 0.7
    r.elements[1].color = (0.06, 0.09, 0.42, 1)
    medio = r.elements.new(0.5)
    medio.color = (0.0005, 0.012, 0.25, 1)
    for i, x in enumerate((-900, -700, -450, -150, 100, 300)):
        (coord, mapeo, tex, rampa, emision, salida)[i].location = (x, 0)
    nt.links.new(coord.outputs['UV'], mapeo.inputs['Vector'])
    nt.links.new(mapeo.outputs['Vector'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], rampa.inputs['Fac'])
    color = rampa.outputs['Color']
    if alfa:
        # Fuera de la loza (alfa 0) se ve el azul medio, como la tierra en el sitio.
        mezcla = nt.nodes.new('ShaderNodeMix')
        mezcla.data_type = 'RGBA'
        mezcla.location = (-20, -200)
        mezcla.inputs['A'].default_value = (0.0005, 0.012, 0.25, 1)
        nt.links.new(tex.outputs['Alpha'], mezcla.inputs['Factor'])
        nt.links.new(color, mezcla.inputs['B'])
        color = mezcla.outputs['Result']
    nt.links.new(color, emision.inputs['Color'])
    nt.links.new(emision.outputs['Emission'], salida.inputs['Surface'])
    nt.nodes.active = tex
    return m


x = 0.0
for nombre, png, (ancho, largo), alfa, _, _, _ in IMAGENES:
    img = bpy.data.images.load(os.path.join(carpeta, 'assets', png))
    img.name = nombre
    img.colorspace_settings.name = 'Non-Color'
    if alfa:
        img.alpha_mode = 'STRAIGHT'
    x += ancho / 2
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, -largo / 2, 0))
    plano = bpy.context.active_object
    plano.name = f'{nombre}_Pintar'
    plano.scale = (ancho, largo, 1)
    plano.data.materials.append(material(nombre, img, 1, alfa))
    x += ancho / 2 + 2
    if nombre == 'PisoTierra':
        x += ancho * 1.5
        bpy.ops.mesh.primitive_plane_add(size=ancho * 3, location=(x, -ancho * 1.5, 0))
        mosaico = bpy.context.active_object
        mosaico.name = 'PisoTierra_Mosaico3x3'
        mosaico.data.materials.append(material('PisoTierra_Mosaico', img, 3, False))
        x += ancho * 1.5 + 2

bpy.ops.object.camera_add(location=(x / 2, -16, 80))
cam = bpy.context.active_object
cam.data.type = 'ORTHO'
cam.data.ortho_scale = x * 1.05
bpy.context.scene.camera = cam

LISTA = repr([(n, p, a, pintor, semilla, web) for n, p, _, a, pintor, semilla, web in IMAGENES])

GENERAR = f'''# Vuelve a pintar una de las texturas (CUAL) con otra semilla y la deja en su
# imagen. Los pintores viven en el repo: scripts/piso/. Para que el sitio la use,
# después corre Piso_exportar.
import importlib, os, sys
import numpy as np
import bpy
CUAL = 'PisoPiedras'
SEMILLA = None  # None = la de siempre
IMAGENES = {LISTA}
REPO = bpy.path.abspath('//..')
sys.path.insert(0, os.path.join(REPO, 'scripts', 'piso'))
nombre, png, alfa, pintor, semilla, web = next(i for i in IMAGENES if i[0] == CUAL)
mod = importlib.reload(importlib.import_module(pintor))
r = mod.pintar(semilla if SEMILLA is None else SEMILLA)
if pintor == 'pintar_tierra':
    gris, a = r, None
elif pintor == 'pintar_piedras':
    (gris, a), _ = r
else:
    gris, a, _ = r
h, w = gris.shape
img = bpy.data.images[nombre]
if tuple(img.size) != (w, h):
    img.scale(w, h)
rgba = np.ones((h, w, 4), np.float32)
rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = gris
if a is not None:
    rgba[..., 3] = a
img.pixels.foreach_set(rgba[::-1].ravel())
img.update()
print('listo', nombre)
'''

EXPORTAR = f'''# Guarda los PNG maestros y escribe los WebP que usa el sitio (public/textures).
import os
import bpy
IMAGENES = {LISTA}
REPO = bpy.path.abspath('//..')
for nombre, png, alfa, pintor, semilla, web in IMAGENES:
    img = bpy.data.images[nombre]
    img.save()
    destino = os.path.join(REPO, 'public', 'textures', web)
    # Una copia nueva con los mismos pixeles (copy() de una imagen de archivo sale vacía).
    w, h = img.size
    pix = [0.0] * (w * h * 4)
    img.pixels.foreach_get(pix)
    copia = bpy.data.images.new(nombre + '_web', w, h, alpha=alfa)
    copia.colorspace_settings.name = 'Non-Color'
    copia.alpha_mode = 'STRAIGHT'
    copia.pixels.foreach_set(pix)
    copia.filepath_raw = destino
    copia.file_format = 'WEBP'
    copia.save(filepath=destino, quality=90)
    bpy.data.images.remove(copia)
    print('listo', destino)
'''

for viejo in ('PisoTierra_generar', 'PisoTierra_exportar'):
    if viejo in bpy.data.texts:
        bpy.data.texts.remove(bpy.data.texts[viejo])
for nombre, texto in (('Piso_generar', GENERAR), ('Piso_exportar', EXPORTAR)):
    t = bpy.data.texts.get(nombre) or bpy.data.texts.new(nombre)
    t.clear()
    t.write(texto)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(carpeta, 'PisoTierra.blend'), relative_remap=True)
for nombre, png, *_ in IMAGENES:
    bpy.data.images[nombre].filepath = '//assets/' + png
bpy.ops.wm.save_mainfile()
print('blend listo')
