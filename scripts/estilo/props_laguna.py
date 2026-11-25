"""Props de la laguna pintados a mano (Oscar, 2026-11-24; features.md, Los props -> laguna).

Muelle, puesto de Argus con su tablero de récords, lancha, remo, cubeta, caja de carnada, rack de
cañas, caña y letrero, con la acuarela compartida de scripts/estilo/pintura.py: poca geometría con
biseles grandes, formas gorditas, nada derecho y la textura horneada en un solo atlas de 2048 para
todo el grupo. El toon y el contorno los pone el sitio (src/lib/pintado.js).

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_laguna.py -- todo [carpeta_fotos] [rapido]

  armar     arma los props y sus materiales y guarda Character/Estilo_laguna.blend
  pintar    hornea el atlas (Cycles, 1 a 3 min) a Character/assets/props_laguna.png
  exportar  escribe public/3dmodels/estilo/props_laguna.glb (un solo material, Draco, WebP)
  render    fotos de revisión de cada prop, de cerca la caña y el grupo
  todo      los cuatro
  `rapido` hornea a 1024 con pocas muestras (solo para probar formas).

Medidas en metros a tamaño real (el sitio multiplica por ~2.2), base en z = 0 y el frente hacia -Y.
Excepciones: Prop_Muelle tiene z = 0 en el agua (la cubierta a 0.35, los pilotes bajan a -1.2), su
origen en la orilla y la punta en y = -7 (en el GLB su nodo queda en z = 0, no levantado como los
demás); la caña y el remo van de pie, con el mango de la caña y la pala del remo abajo.
Lo que escribe el sitio va aparte, hijo de su prop, con un segundo UV `Escritura` de 0 a 1 de
frente: Prop_PuestoArgus_Pizarra y Prop_LetreroPesca_Cara. Los tubos de neón del puesto también van
aparte (el sitio les cambia el material por nombre): Prop_PuestoArgus_Neon_Pez (el pez del
mostrador) y Prop_PuestoArgus_Neon_Pesca_0 … _4 (PESCA en runas sobre el techo, una letra por
objeto en orden de lectura); salen de scripts/estilo/neon_pesca.json (runas_neon.mjs).
Si se retoca el PNG maestro a mano, basta `exportar`.
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import pintura as P  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_laguna.blend')
PNG = os.path.join(REPO, 'Character', 'assets', 'props_laguna.png')
GLB = os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_laguna.glb')
FOTOS = os.path.join(REPO, 'scripts', 'estilo', 'renders', 'props_laguna')
TAM = 2048
SEMILLA = 11

PROPS = ['Prop_Muelle', 'Prop_PuestoArgus', 'Prop_Lancha', 'Prop_Remo', 'Prop_Cubeta', 'Prop_CajaCarnada',
         'Prop_RackCanas', 'Prop_Cana', 'Prop_LetreroPesca']
NEONES = ['Prop_PuestoArgus_Neon_Pez'] + [f'Prop_PuestoArgus_Neon_Pesca_{i}' for i in range(5)]
HIJOS = {'Prop_PuestoArgus': ['Prop_PuestoArgus_Pizarra'] + NEONES, 'Prop_LetreroPesca': ['Prop_LetreroPesca_Cara']}
ESCRITURA = ('Prop_PuestoArgus_Pizarra', 'Prop_LetreroPesca_Cara')
# Pixeles por metro de cada prop en el atlas, relativos: lo que se ve de cerca o es chico pide más.
PESOS = {'Prop_Muelle': 0.85, 'Prop_PuestoArgus': 1.0, 'Prop_Lancha': 1.15, 'Prop_Remo': 1.4, 'Prop_Cubeta': 1.8,
         'Prop_CajaCarnada': 2.0, 'Prop_RackCanas': 1.3, 'Prop_Cana': 2.8, 'Prop_LetreroPesca': 2.4,
         'Prop_PuestoArgus_Pizarra': 0.35, 'Prop_LetreroPesca_Cara': 0.4, **{n: 0.2 for n in NEONES}}

# Colores propios del grupo (además de las paletas de pintura.py)
BAMBU = {'oscura': '#7d6233', 'media': '#9c7d45', 'base': '#b39256', 'clara': '#cfb070', 'luz': '#e2c98a',
         'linea': '#5e4722', 'orilla': '#f3e5b6', 'astilla': '#43341a', 'mugre': '#352914',
         'calido': '#b47a3c', 'frio': '#8c8656'}
PAPEL = ['#d42a8c', '#ee7a1e', '#4cb23a', '#7d40c8', '#2b8ed6']
# El neón: la lámina (óxido debajo de la pintura), el tubo oxidado y el fierro del bastidor
OXIDO = {'oscura': '#3b1c10', 'media': '#5e2c16', 'base': '#7a3a1c', 'clara': '#a3552a', 'luz': '#c27a44',
         'linea': '#2a140a', 'orilla': '#d79a62', 'astilla': '#24110a', 'mugre': '#1c0e08',
         'calido': '#8e4020', 'frio': '#5a4a3a'}
METAL_OXIDO = {'oscuro': '#2a1a14', 'base': '#5a3424', 'claro': '#8a5a3a', 'orilla': '#c89268', 'oxido': '#7a3416'}
METAL_OSCURO = {'oscuro': '#1b1e23', 'base': '#2a2f37', 'claro': '#48515d', 'orilla': '#8f99a6', 'oxido': '#4a2a1a'}
NEON_PESCA = os.path.join(AQUI, 'neon_pesca.json')  # de scripts/estilo/runas_neon.mjs


# ---------------------------------------------------------------- ayudantes de geometría

def palo(nombre, alto, radio, material, centro=(0, 0, 0), rot=(0, 0, 0), lados=8, punta=1.0, cortes=1,
         chueco=0.002, bisel=0.0, semilla=None):
    """Como P.poste pero para piezas delgadas: sin bisel (o de un segmento) y con pocos cortes."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=radio, radius2=radio * punta, depth=alto)
    bmesh.ops.translate(bm, vec=(0, 0, alto / 2), verts=bm.verts)
    if cortes:
        bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).z) > alto * 0.5], cuts=cortes)
    if chueco:
        P._chuequear(bm, chueco, semilla)
    o = P.objeto(nombre, bm, material)
    P.poner_veta(o, 'Z', azar=semilla % 1.0)
    if bisel:
        P.biselar(o, min(bisel, radio * 0.4), segmentos=1)
    P._colocar(o, centro, rot)
    return o


def torno(nombre, perfil, material, lados=10, centro=(0, 0, 0), rot=(0, 0, 0), bisel=0.0, segmentos=1, veta='Z', azar=None):
    """Revoluciona un perfil [(r, z), ...] alrededor de Z. Se recorre como contorno en el medio plano
    (r, z): desde el eje por abajo, hacia afuera, arriba y de regreso, así las caras miran afuera.
    Un punto con r = 0 cierra en el eje."""
    bm = bmesh.new()
    anillos = []
    for r, z in perfil:
        if r <= 1e-6:
            anillos.append([bm.verts.new((0, 0, z))])
        else:
            anillos.append([bm.verts.new((r * math.cos(2 * math.pi * k / lados), r * math.sin(2 * math.pi * k / lados), z)) for k in range(lados)])
    for a, b in zip(anillos, anillos[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for k in range(lados):
            kk = (k + 1) % lados
            if len(a) == 1:
                bm.faces.new((a[0], b[kk], b[k]))
            elif len(b) == 1:
                bm.faces.new((a[k], a[kk], b[0]))
            else:
                bm.faces.new((a[k], a[kk], b[kk], b[k]))
    o = P.objeto(nombre, bm, material)
    if veta:
        P.poner_veta(o, veta, azar=random.random() if azar is None else azar)
    if bisel:
        P.biselar(o, bisel, segmentos=segmentos)
    P._colocar(o, centro, rot)
    return o


def tubo(nombre, puntos, radio, material, lados=6, cerrado=False, radios=None, tapas=True, veta=None):
    """Un tubo que sigue una línea (cuerdas, alambres, lombrices). `radios` da el radio en cada punto."""
    pts = [Vector(p) for p in puntos]
    n = len(pts)
    tang = []
    for i in range(n):
        if cerrado:
            a, b = pts[(i - 1) % n], pts[(i + 1) % n]
        else:
            a, b = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
        tang.append((b - a).normalized())
    ref = Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = (ref - tang[0] * ref.dot(tang[0])).normalized()
    bm = bmesh.new()
    anillos = []
    for i, p in enumerate(pts):
        t = tang[i]
        nrm = (nrm - t * nrm.dot(t)).normalized()
        bb = t.cross(nrm).normalized()
        r = radios[i] if radios else radio
        anillos.append([bm.verts.new(p + (nrm * math.cos(2 * math.pi * k / lados) + bb * math.sin(2 * math.pi * k / lados)) * r) for k in range(lados)])
    pares = list(zip(anillos, anillos[1:])) + ([(anillos[-1], anillos[0])] if cerrado else [])
    for a, b in pares:
        for k in range(lados):
            kk = (k + 1) % lados
            bm.faces.new((a[k], a[kk], b[kk], b[k]))
    if tapas and not cerrado:
        bm.faces.new(list(reversed(anillos[0])))
        bm.faces.new(anillos[-1])
    o = P.objeto(nombre, bm, material)
    if veta:
        P.poner_veta(o, veta)
    return o


def toro(nombre, R, r, material, centro, rot=(0, 0, 0), seg=10, lados=4, escala=(1, 1)):
    """Un aro (amarres, guías, bordes): círculo en XY de radio R (o elipse con `escala`)."""
    pts = [(R * escala[0] * math.cos(2 * math.pi * i / seg), R * escala[1] * math.sin(2 * math.pi * i / seg), 0) for i in range(seg)]
    o = tubo(nombre, pts, r, material, lados=lados, cerrado=True)
    P._colocar(o, centro, rot)
    return o


def liston(nombre, puntos, ancho, alto, material, arriba=(0, 0, 1), veta='largo', bisel=0.006, segmentos=1, chueco=0.0):
    """Una tira de sección rectangular que sigue una línea (borda de la lancha, quilla, cuadernas):
    `ancho` a lo largo de tangente × `arriba` y `alto` hacia `arriba`."""
    pts = [Vector(p) for p in puntos]
    up = Vector(arriba)
    bm = bmesh.new()
    anillos = []
    largo = 0.0
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        t = (b - a).normalized()
        s = t.cross(up).normalized()
        u = s.cross(t).normalized()
        anillos.append([bm.verts.new(p + s * sx * ancho / 2 + u * uy * alto / 2) for sx, uy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for a, b in zip(anillos, anillos[1:]):
        for k in range(4):
            kk = (k + 1) % 4
            bm.faces.new((a[k], a[kk], b[kk], b[k]))
    bm.faces.new(list(reversed(anillos[0])))
    bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if chueco:
        P._chuequear(bm, chueco, random.random() * 100)
    o = P.objeto(nombre, bm, material)
    # la veta a lo largo de la línea: y = distancia recorrida
    me = o.data
    dist = []
    for i, p in enumerate(pts):
        if i:
            largo += (p - pts[i - 1]).length
        dist += [largo] * 4
    azar = random.random()
    esquinas = [sx * ancho / 2 + uy * alto / 4 for sx, uy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    rgba = np.array([[esquinas[i % 4], dist[i], azar, 1.0] for i in range(len(dist))], np.float32)
    at = me.color_attributes.new('Veta', 'FLOAT_COLOR', 'POINT')
    at.data.foreach_set('color', rgba.ravel())
    if bisel:
        P.biselar(o, min(bisel, ancho * 0.4, alto * 0.4), segmentos=segmentos)
    return o


def placa(nombre, contorno, grueso, material, centro=(0, 0, 0), rot=(0, 0, 0), plano='XZ', veta='X', bisel=0.01,
          segmentos=2, chueco=0.0, materiales=None, cual=None):
    """Un contorno 2D extruido (pez recortado, espejo de popa, pala del remo). En `plano` 'XZ' el
    grueso va en Y. Con `materiales` y `cual(normal)` -> índice, cada cara toma su material."""
    bm = bmesh.new()

    def v3(a, b, s):
        g = s * grueso / 2
        return {'XZ': (a, g, b), 'YZ': (g, a, b), 'XY': (a, b, g)}[plano]
    frente = [bm.verts.new(v3(a, b, -1)) for a, b in contorno]
    atras = [bm.verts.new(v3(a, b, 1)) for a, b in contorno]
    bm.faces.new(frente)
    bm.faces.new(list(reversed(atras)))
    m = len(contorno)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((frente[i], frente[j], atras[j], atras[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if chueco:
        P._chuequear(bm, chueco, random.random() * 100)
    if cual:
        for f in bm.faces:
            f.material_index = cual(f.normal)
    o = P.objeto(nombre, bm, None)
    for mt in (materiales or [material]):
        o.data.materials.append(mt)
    P.poner_veta(o, veta)
    if bisel:
        P.biselar(o, bisel, segmentos=segmentos)
    P._colocar(o, centro, rot)
    return o


def tabla1(nombre, largo, ancho, grueso, material, centro=(0, 0, 0), rot=(0, 0, 0), bisel=0.01, chueco=0.008, divisiones=1):
    """Una tabla con el bisel de un solo segmento (piezas chicas o que casi no se ven)."""
    o = P.tabla(nombre, largo, ancho, grueso, material, centro=centro, rot=rot, chueco=chueco, bisel=0, divisiones=divisiones)
    P.biselar(o, min(bisel, grueso * 0.45, ancho * 0.45), segmentos=1)
    return o


def caja1(nombre, tam, material, centro=(0, 0, 0), rot=(0, 0, 0), bisel=0.008, chueco=0.004):
    o = P.caja(nombre, tam, material, centro=centro, rot=rot, chueco=chueco, bisel=0)
    if bisel:
        P.biselar(o, min(bisel, min(tam) * 0.4), segmentos=1)
    return o


def bloque(nombre, tam, material, centro=(0, 0, 0), rot=(0, 0, 0), bisel=0.004, chueco=0.0):
    """Un bloque sin subdividir (herrajes, pies, tallos): 12 triángulos, o ~44 con bisel."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=tam, verts=bm.verts)
    if chueco:
        P._chuequear(bm, chueco, random.random() * 100)
    o = P.objeto(nombre, bm, material)
    P.poner_veta(o, 'XYZ'[list(tam).index(max(tam))])
    if bisel:
        P.biselar(o, min(bisel, min(tam) * 0.4), segmentos=1)
    P._colocar(o, centro, rot)
    return o


def transformar(objs, centro, rot, orden='XYZ'):
    M = Matrix.Translation(centro) @ Euler(rot, orden).to_matrix().to_4x4()
    for o in objs:
        o.data.transform(M)


def unir(objs, nombre, angulo=None):
    o = P.unir(objs, nombre)
    if angulo:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angulo))
    return o


# ---------------------------------------------------------------- ayudantes de pintura

def _capa(mat):
    """Para pintar encima de un material ya armado (como P.calca): sus nodos y el color que llega
    a la emisión."""
    nt = mat.node_tree
    em = next(n for n in nt.nodes if n.type == 'EMISSION')
    entrada = em.inputs['Color'].links[0].from_socket
    N = P.Nodos.__new__(P.Nodos)
    N.nt = nt
    N.x = 4000 + 180 * len(nt.nodes)
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    return N, em, entrada, tc.outputs['Object'], geo


def calca_eje(mat, imagen, centro, ancho, cara='-Y', color='#e9dcb8', gasto=0.2, rango=None, opacidad=1.0, borde=0.3):
    """Como P.calca, en cualquiera de las cuatro caras de lado y leída al derecho desde afuera
    (P.calca en una cara +Y sale en espejo). `centro` = (horizontal, z): X en las caras ±Y, Y en
    las ±X. `rango` = (a, b) limita la profundidad (sobre el eje de la cara), para no pintar las
    caras de atrás que miran igual. `borde` junta el pigmento en la orilla."""
    horiz, signo, normal, prof = {'-Y': ('X', 1, (0, -1, 0), 'Y'), '+Y': ('X', -1, (0, 1, 0), 'Y'),
                                  '+X': ('Y', 1, (1, 0, 0), 'X'), '-X': ('Y', -1, (-1, 0, 0), 'X')}[cara]
    N, em, col, pos, geo = _capa(mat)
    sp = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sp.inputs[0])
    w, h = imagen.size
    alto = ancho * h / w
    u = N.val('ADD', N.val('MULTIPLY', N.val('SUBTRACT', sp.outputs[horiz], centro[0]), signo / ancho), 0.5)
    v = N.val('ADD', N.val('DIVIDE', N.val('SUBTRACT', sp.outputs['Z'], centro[1]), alto), 0.5)
    uv = N.n('ShaderNodeCombineXYZ')
    N.l(u, uv.inputs[0])
    N.l(v, uv.inputs[1])
    tex = N.n('ShaderNodeTexImage', image=imagen, extension='CLIP', interpolation='Cubic')
    N.l(uv.outputs[0], tex.inputs['Vector'])
    nd = N.n('ShaderNodeVectorMath', operation='DOT_PRODUCT')
    N.l(geo.outputs['True Normal'], nd.inputs[0])
    nd.inputs[1].default_value = normal
    frente = P.suave(N, nd.outputs['Value'], 0.3, 0.5)
    if rango:
        d = sp.outputs[prof]
        dentro = N.val('MULTIPLY', P.suave(N, d, rango[0] - 0.004, rango[0] + 0.004), N.val('SUBTRACT', 1.0, P.suave(N, d, rango[1] - 0.004, rango[1] + 0.004)))
        frente = N.val('MULTIPLY', frente, dentro)
    aguada = N.val('ADD', 1.0 - gasto, N.val('MULTIPLY', N.ruido(pos, 7.0, detalle=2.0), gasto * 1.5))
    alfa = N.val('MULTIPLY', N.val('MULTIPLY', tex.outputs['Alpha'], frente), N.val('MULTIPLY', aguada, opacidad))
    col = N.mezcla(alfa, col, color)
    if borde:
        orilla = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', tex.outputs['Alpha'], 0.5)), 0.0, 0.45))
        c = P.srgb(color)
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', orilla, frente), borde * opacidad), col, (c[0] * 0.72, c[1] * 0.7, c[2] * 0.66, 1))
    N.l(col, em.inputs['Color'])


def bajo_agua(mat, z_agua=0.0, color='#2c3a25', opacidad=0.72):
    """Lo mojado bajo la línea del agua (pilotes): oscuro verdoso con la orilla ondulada y una
    franja de lama clara justo en la línea."""
    N, em, col, pos, geo = _capa(mat)
    sp = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sp.inputs[0])
    onda = N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pos, 4.0, detalle=2.0), 0.5), 0.14)
    campo = N.val('ADD', sp.outputs['Z'], onda)
    col = P.lavado(N, col, campo, z_agua, 0.02, color, opacidad, borde=0.5, invertido=True)
    banda = N.val('ABSOLUTE', N.val('SUBTRACT', campo, z_agua + 0.035))
    col = P.lavado(N, col, banda, 0.028, 0.01, '#7f8f4c', 0.4, borde=0.0, invertido=True)
    N.l(col, em.inputs['Color'])


def franja_z(mat, z0, z1, color, opacidad=0.85, onda=0.006, borde=0.3):
    """Una franja horizontal pintada entre z0 y z1 (la línea de flotación de la lancha). Con z0
    muy abajo, todo lo de abajo de z1."""
    N, em, col, pos, geo = _capa(mat)
    sp = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sp.inputs[0])
    z = N.val('ADD', sp.outputs['Z'], N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pos, 9.0, detalle=1.0), 0.5), onda * 2))
    campo = N.val('MINIMUM', N.val('SUBTRACT', z, z0), N.val('SUBTRACT', z1, z))
    col = P.lavado(N, col, campo, 0.0, 0.004, color, opacidad, borde=borde)
    N.l(col, em.inputs['Color'])


def ajustar_luz(mat, a, b):
    """La luz pintada de pintura.py va de oscuro en z = -0.2 a claro en z = 1.4: en un prop chico
    todo queda oscuro. Le pone el rango de alturas del prop."""
    for n in mat.node_tree.nodes:
        if n.type == 'MAP_RANGE' and abs(n.inputs['From Min'].default_value + 0.2) < 1e-6 and abs(n.inputs['From Max'].default_value - 1.4) < 1e-6:
            n.inputs['From Min'].default_value = a
            n.inputs['From Max'].default_value = b


def material_cuerda(nombre, color='#b8955f'):
    m = P.material_liso(nombre, color, orilla='#ecd9aa')
    N, em, col, pos, geo = _capa(m)
    ola = N.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL', wave_profile='SIN')
    ola.inputs['Scale'].default_value = 70.0
    ola.inputs['Distortion'].default_value = 1.5
    N.l(pos, ola.inputs['Vector'])
    linea = N.val('SUBTRACT', 1.0, P.suave(N, ola.outputs['Fac'], 0.08, 0.32))
    col = N.mezcla(N.val('MULTIPLY', linea, 0.55), col, '#5b4024')
    N.l(col, em.inputs['Color'])
    return m


def material_corcho(nombre):
    m = P.material_liso(nombre, '#b78a58', claro='#d6ae7a', oscuro='#7a5532')
    N, em, col, pos, geo = _capa(m)
    c = N.celdas(pos, 240.0)
    col = P.lavado(N, col, c.outputs['Distance'], 0.2, 0.05, '#5a391d', 0.6, borde=0.0, invertido=True)
    c2 = N.celdas(pos, 70.0)
    sc = N.n('ShaderNodeSeparateColor')
    N.l(c2.outputs['Color'], sc.inputs[0])
    hay = N.val('GREATER_THAN', sc.outputs[0], 0.7)
    d = N.val('ADD', c2.outputs['Distance'], N.val('SUBTRACT', 1.0, hay))
    col = P.lavado(N, col, d, 0.16, 0.04, '#4a2e16', 0.55, borde=0.3, invertido=True)
    N.l(col, em.inputs['Color'])
    return m


# ---------------------------------------------------------------- dibujos (esténciles hechos aquí)

def _suavizar(a, r):
    for _ in range(2):
        for eje in (0, 1):
            pad = [(r + 1, r) if i == eje else (0, 0) for i in range(2)]
            c = np.cumsum(np.pad(a, pad, mode='edge'), axis=eje)
            a = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1) if eje == 0 else (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)
    return a


def imagen(nombre, alfa):
    """Una calca desde una máscara (fila 0 = abajo). Blanco con la máscara en el alfa, empacada."""
    h, w = alfa.shape
    img = bpy.data.images.get(nombre) or bpy.data.images.new(nombre, w, h, alpha=True)
    px = np.ones((h, w, 4), np.float32)
    px[..., 3] = np.clip(alfa, 0, 1)
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


def _rejilla(w, h, x0, x1, y0, y1, temblor=0.006):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    x = x0 + (x1 - x0) * xs / (w - 1)
    y = y0 + (y1 - y0) * ys / (h - 1)
    # el pulso de la mano: el borde no queda de compás
    x2 = x + temblor * (np.sin(y * 41 + 1.3) + 0.6 * np.sin(y * 97 + 2.1))
    y2 = y + temblor * (np.sin(x * 33 + 0.4) + 0.6 * np.sin(x * 83))
    return x2, y2


def dibujos_pez(w=1024, h=512):
    """El pez del letrero, pintado a la carrera (como el pescado en tabla de la referencia): cuerpo,
    detalles (agalla, escamas, rayas de la cola), ojo grande y pupila con brillo. Cuadro de 2 × 1."""
    x, y = _rejilla(w, h, 0.0, 2.0, 0.0, 1.0)

    def elipse(cx, cy, rx, ry):
        return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1
    cuerpo = elipse(0.9, 0.5, 0.64, 0.29) | elipse(0.62, 0.5, 0.42, 0.31)
    dx = x - 1.42
    cola = (dx > 0) & (x < 1.9) & (np.abs(y - 0.5) < 0.07 + dx * 0.8)
    cola &= ~((x > 1.7) & (np.abs(y - 0.5) < (x - 1.7) * 1.15))
    aleta = (x > 0.6) & (x < 1.26) & (y > 0.6) & (y < 0.84 + 0.05 * np.sin((x - 0.6) / 0.66 * np.pi) - (x - 0.6) * 0.2)
    abajo = (x > 0.95) & (x < 1.26) & (y < 0.4) & (y > 0.15 + (x - 0.95) * 0.4)
    boca = (x < 0.34) & (np.abs(y - 0.44) < 0.022 + (0.34 - x) * 0.28)
    pez = (cuerpo | cola | aleta | abajo) & ~boca
    d_agalla = np.abs(np.hypot(x - 0.2, y - 0.5) - 0.55)
    agalla = (d_agalla < 0.016) & (x > 0.66) & cuerpo
    escamas = np.zeros_like(pez)
    for i, cx in enumerate((0.98, 1.1, 1.22, 1.34)):
        for cy in (0.38, 0.5, 0.62):
            cy2 = cy + (0.06 if i % 2 else 0.0)
            escamas |= (np.abs(np.hypot(x - cx, y - cy2) - 0.06) < 0.011) & (x > cx) & cuerpo
    rayas = np.zeros_like(pez)
    for ang in (-0.5, -0.25, 0.0, 0.25, 0.5):
        px, py = x - 1.44, y - 0.5
        dist = np.abs(px * math.sin(ang) - py * math.cos(ang))
        rayas |= (dist < 0.01) & (px > 0.12) & cola
    ojo = elipse(0.5, 0.57, 0.105, 0.105)
    pupila = elipse(0.53, 0.56, 0.058, 0.058) & ~elipse(0.555, 0.59, 0.02, 0.02)
    r = max(1, w // 400)
    return {k: _suavizar(v.astype(np.float32), r) for k, v in
            (('cuerpo', pez), ('detalles', agalla | escamas | rayas), ('ojo', ojo), ('pupila', pupila))}


def dibujo_papel_picado(w=512, h=512):
    """El recorte del papel picado (cuadro de 1 × 1): una flor de cinco pétalos al centro, rombos
    arriba y puntitos abajo."""
    x, y = _rejilla(w, h, 0.0, 1.0, 0.0, 1.0, temblor=0.004)
    cx, cy = 0.5, 0.5
    flor = np.hypot(x - cx, y - cy) < 0.07
    for k in range(5):
        a = math.pi / 2 + k * 2 * math.pi / 5
        px, py = cx + 0.17 * math.cos(a), cy + 0.17 * math.sin(a)
        flor |= ((x - px) ** 2 / 0.075 ** 2 + (y - py) ** 2 / 0.075 ** 2) < 1
    flor &= ~(np.hypot(x - cx, y - cy) < 0.035)
    rombos = np.zeros_like(flor)
    for k in range(4):
        rx = 0.2 + k * 0.2
        rombos |= (np.abs(x - rx) / 0.055 + np.abs(y - 0.88) / 0.045) < 1
    puntos = np.zeros_like(flor)
    for k in range(5):
        puntos |= np.hypot(x - (0.14 + k * 0.18), y - 0.14) < 0.03
    return _suavizar((flor | rombos | puntos).astype(np.float32), 1)


# ---------------------------------------------------------------- neón en letras de lámina
# Como la referencia de Oscar (2026-11-24): letras de bloque hondas de lámina pintada (turquesa
# descarapelada sobre óxido), con el frente abierto y adentro filas de tubos de neón horizontales
# que llenan la forma; un tubo oxidado sigue el contorno por el frente, sujeto con grapas a los
# costados. Los tubos de neón van solos en los objetos `…_Neon_…` (el sitio les cambia el material
# por nombre: brillan y parpadean); la lámina, el tubo oxidado, las grapas y el bastidor van en la
# malla pintada del prop.

NEON = {'fila_r': 0.007, 'fila_lados': 6, 'marco_r': 0.0058, 'marco_lados': 4, 'lamina': 0.004, 'tol': 0.0025}


def _rdp(pts, tol):
    if len(pts) < 3:
        return list(pts)
    a, b = pts[0], pts[-1]
    ab = b - a
    largo = ab.length or 1e-9
    dmax, imax = 0.0, 0
    for i in range(1, len(pts) - 1):
        d = abs(ab.x * (a.y - pts[i].y) - (a.x - pts[i].x) * ab.y) / largo
        if d > dmax:
            dmax, imax = d, i
    if dmax > tol:
        return _rdp(pts[:imax + 1], tol)[:-1] + _rdp(pts[imax:], tol)
    return [a, b]


def simplificar_lazo(pts, tol):
    pts = [Vector(p) for p in pts]
    if (pts[0] - pts[-1]).length < 1e-6:
        pts = pts[:-1]
    k = max(range(len(pts)), key=lambda i: (pts[i] - pts[0]).length)
    return _rdp(pts[:k + 1], tol)[:-1] + _rdp(pts[k:] + [pts[0]], tol)[:-1]


def area_lazo(pts):
    return sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts))) / 2


def desplazar_lazo(pts, d):
    """El lazo corrido `d` hacia afuera de su relleno (en un hueco, hacia adentro del hueco)."""
    n = len(pts)
    signo = 1.0 if area_lazo(pts) > 0 else -1.0  # antihorario: la normal de afuera es (dy, -dx)
    out = []
    for i in range(n):
        a, p, b = pts[i - 1], pts[i], pts[(i + 1) % n]
        e1, e2 = (p - a).normalized(), (b - p).normalized()
        n1, n2 = Vector((e1.y, -e1.x)) * signo, Vector((e2.y, -e2.x)) * signo
        m = (n1 + n2)
        m = m.normalized() if m.length > 1e-6 else n1
        out.append(p + m * d / max(0.5, m.dot(n1)))
    return out


def dentro(lazos, x, z):
    """Par-impar contra todos los lazos (los huecos y lo que va dentro de ellos salen solos)."""
    c = False
    for lazo in lazos:
        n = len(lazo)
        for i in range(n):
            a, b = lazo[i], lazo[(i + 1) % n]
            if (a.y > z) != (b.y > z) and x < a.x + (z - a.y) / (b.y - a.y) * (b.x - a.x):
                c = not c
    return c


def cortes_fila(lazos, z):
    """Los tramos [x0, x1] de una horizontal z dentro de la forma."""
    xs = []
    for lazo in lazos:
        n = len(lazo)
        for i in range(n):
            a, b = lazo[i], lazo[(i + 1) % n]
            if (a.y > z) != (b.y > z):
                xs.append(a.x + (z - a.y) / (b.y - a.y) * (b.x - a.x))
    xs.sort()
    return [(xs[i], xs[i + 1]) for i in range(0, len(xs) - 1, 2)]


def _interseca(A, B):
    out = []
    for a0, a1 in A:
        for b0, b1 in B:
            lo, hi = max(a0, b0), min(a1, b1)
            if hi > lo:
                out.append((lo, hi))
    return out


def filas_de(lazos, paso, margen, z0=None):
    """Filas horizontales cada `paso` que llenan la forma a `margen` de la orilla."""
    zs = [p.y for l in lazos for p in l]
    lo, hi = min(zs) + margen, max(zs) - margen
    filas = []
    z = lo if z0 is None else z0
    while z <= hi:
        tramos = cortes_fila(lazos, z)
        for dz in (margen, -margen):
            tramos = _interseca(tramos, cortes_fila(lazos, z + dz))
        for x0, x1 in tramos:
            if x1 - x0 - 2 * margen > 0.02:
                filas.append((x0 + margen, x1 - margen, z))
        z += paso
    return filas


def caja_lamina(nombre, lazos, y_frente, hondo, material):
    """La lámina de una letra: la forma rellena (par-impar, así los huecos salen solos) extruida
    hacia atrás desde y_frente, sin la cara de enfrente y con grosor (costados, fondo y filo)."""
    cu = bpy.data.curves.new(nombre, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = hondo / 2
    for lazo in lazos:
        sp = cu.splines.new('POLY')
        sp.points.add(len(lazo) - 1)
        for q, v in zip(sp.points, lazo):
            q.co = (v.x, v.y, 0.0, 1.0)
        sp.use_cyclic_u = True
    tmp = bpy.data.objects.new(nombre + '_curva', cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    me.transform(Matrix.Translation((0, y_frente + hondo / 2, 0)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    frente = [f for f in bm.faces if f.normal.y < -0.9 and f.calc_center_median().y < y_frente + 1e-3]
    bmesh.ops.delete(bm, geom=frente, context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    m = o.modifiers.new('grosor', 'SOLIDIFY')
    m.thickness = NEON['lamina']
    m.offset = -1.0
    m.use_rim = True
    m.use_even_offset = True
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='grosor')
    P.poner_veta(o, 'Z')  # la pintura y el óxido corren a lo alto, como escurrimientos
    return o


def filas_neon(bm, filas, y):
    """Tubos rectos de neón (fila: x0, x1, z) con la punta redonda (un cono corto)."""
    r, lados = NEON['fila_r'], NEON['fila_lados']
    ey, ez = Vector((0, 1, 0)), Vector((0, 0, 1))
    for x0, x1, z in filas:
        anillos = []
        for x in (x0, x1):
            c = Vector((x, y, z))
            anillos.append([bm.verts.new(c + (ey * math.cos(2 * math.pi * k / lados) + ez * math.sin(2 * math.pi * k / lados)) * r) for k in range(lados)])
        a, b = anillos
        for k in range(lados):
            kk = (k + 1) % lados
            bm.faces.new((a[k], a[kk], b[kk], b[k]))
        for anillo, x, sgn in ((a, x0, -1), (b, x1, 1)):
            polo = bm.verts.new((x + sgn * r * 0.9, y, z))
            for k in range(lados):
                bm.faces.new((anillo[k], anillo[(k + 1) % lados], polo))


def objeto_filas(nombre, filas, y, material):
    bm = bmesh.new()
    filas_neon(bm, filas, y)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    o.data.polygons.foreach_set('use_smooth', np.ones(len(o.data.polygons), bool))
    return o


def marco_oxidado(lazos_marco, lazos_letra, y, material, grapa_mat, cada=0.1):
    """El tubo oxidado por el frente (lazos ya corridos hacia afuera) y sus grapas a los costados."""
    pz = []
    r = NEON['marco_r']
    for lazo in lazos_marco:
        pts = simplificar_lazo(lazo, 0.005)
        if len(pts) < 3:
            continue
        pz.append(tubo('tubo_oxidado', [(p.x, y, p.y) for p in pts], r, material, lados=NEON['marco_lados'], cerrado=True))
        largo = sum((pts[(i + 1) % len(pts)] - pts[i]).length for i in range(len(pts)))
        n = max(3, int(largo / cada))
        for j in range(n):
            # el punto a lo largo del lazo y el costado más cercano
            t = largo * (j + 0.5) / n
            for i in range(len(pts)):
                seg = (pts[(i + 1) % len(pts)] - pts[i]).length
                if t <= seg:
                    m = pts[i] + (pts[(i + 1) % len(pts)] - pts[i]) * (t / max(seg, 1e-9))
                    break
                t -= seg
            mejor = None
            for l in lazos_letra:
                for i in range(len(l)):
                    a, b = l[i], l[(i + 1) % len(l)]
                    ab = b - a
                    u = max(0.0, min(1.0, (m - a).dot(ab) / max(ab.length_squared, 1e-12)))
                    c = a + ab * u
                    if mejor is None or (c - m).length < (mejor - m).length:
                        mejor = c
            d = m - mejor
            L = d.length
            if L < 1e-4 or L > 0.05:
                continue
            u = d / L
            ang = math.atan2(-u.y, u.x)
            ctr = (mejor + m) / 2 + u * r * 0.5
            pz.append(bloque('grapa', (L + r * 2.2, 0.012, 0.008), grapa_mat, centro=(ctr.x, y, ctr.y), rot=(0, ang, 0), bisel=0))
    return pz


def lazos_metros(trazos, a_m):
    return [[Vector(a_m(x, y)) for x, y in t] for t in trazos]


def contorno_pez(n=11):
    """La silueta del pez (largo 1, cabeza en x = 0): cuerpo de gota, aleta arriba, cola partida y
    la boca abierta."""
    pts = [(0.0, 0.03)]
    for i in range(1, n + 1):
        a = math.pi - i * (math.pi * 0.84) / n
        x, z = 0.4 + 0.4 * math.cos(a), 0.21 * math.sin(a)
        if 0.28 < x < 0.66:
            z += 0.08 * math.sin((x - 0.28) / 0.38 * math.pi)
        pts.append((x, z))
    pts += [(0.98, 0.22), (0.9, 0.11), (0.86, 0.0), (0.9, -0.11), (0.98, -0.2)]
    for i in range(n + 1):
        a = -math.pi * 0.16 - i * (math.pi * 0.84 - 0.25) / n
        x, z = 0.4 + 0.4 * math.cos(a), 0.2 * math.sin(a)
        if 0.48 < x < 0.68:
            z -= 0.045 * math.sin((x - 0.48) / 0.2 * math.pi)
        pts.append((x, z))
    pts += [(0.02, -0.035), (0.075, -0.005)]
    return pts


def dibujo_calcomania(w=256, h=256):
    """La calcomanía de un costado: un círculo (el pez se pinta encima con su propia calca)."""
    x, y = _rejilla(w, h, -1.0, 1.0, -1.0, 1.0, temblor=0.004)
    return _suavizar((np.hypot(x, y) < 0.9).astype(np.float32), 1)


def rayo(arboles, origen, direccion):
    """El golpe más cercano de un rayo contra varias mallas (BVH)."""
    mejor = None
    for a in arboles:
        h = a.ray_cast(Vector(origen), Vector(direccion))
        if h[0] is not None and (mejor is None or h[3] < mejor[3]):
            mejor = h
    return mejor


def arboles_de(objs):
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    return [BVHTree.FromObject(o, dg) for o in objs]


# ---------------------------------------------------------------- materiales

def materiales():
    M = {}
    M['madera'] = P.material_madera('Laguna_Madera')
    M['fina'] = P.material_madera('Laguna_MaderaFina', fino=0.45)
    M['muelle'] = P.material_madera('Laguna_Muelle')
    bajo_agua(M['muelle'], 0.0)
    M['muelle_nueva'] = P.material_madera('Laguna_MuelleNueva', paleta=P.MADERA_CLARA)
    M['turquesa'] = P.material_madera('Laguna_Turquesa', pintura=P.PINTURAS['turquesa'])
    M['lancha'] = P.material_madera('Laguna_Lancha', pintura=P.PINTURAS['rojo'], desgaste=0.8)
    M['remo'] = P.material_madera('Laguna_RemoPala', pintura=P.PINTURAS['rojo'], desgaste=0.9, fino=0.6)
    M['letrero'] = P.material_madera('Laguna_Letrero', pintura=P.PINTURAS['turquesa'], desgaste=0.7)
    M['caja'] = P.material_madera('Laguna_Caja')
    ajustar_luz(M['caja'], -0.05, 0.5)
    M['bambu'] = P.material_madera('Laguna_Bambu', paleta=BAMBU, fino=0.3)
    M['metal'] = P.material_metal('Laguna_Metal')
    M['cubeta'] = P.material_metal('Laguna_Cubeta', oxido=0.45)
    ajustar_luz(M['cubeta'], -0.04, 0.42)
    M['cuerda'] = material_cuerda('Laguna_Cuerda')
    M['corcho'] = material_corcho('Laguna_Corcho')
    M['goma'] = P.material_liso('Laguna_Goma', '#2b2a31', orilla='#6c6a78')
    M['hilo'] = P.material_liso('Laguna_Hilo', '#b3262e', orilla='#f0a090')
    M['sedal'] = P.material_liso('Laguna_Sedal', '#df4a86', orilla='#f7b8d2')
    M['pizarra'] = P.material_liso('Laguna_Pizarra', '#2b3331', claro='#47524f', oscuro='#1a1f1e', orilla='#5d6662')
    M['cara'] = P.material_liso('Laguna_Cara', '#ddcfa8', desgaste=0.2)
    M['agua'] = P.material_liso('Laguna_Agua', '#23464d', claro='#4f8189', orilla='#9cc7c4')
    M['tierra'] = P.material_liso('Laguna_Tierra', '#3d2a1b', orilla='#6e5236')
    M['lombriz'] = P.material_liso('Laguna_Lombriz', '#d27a86', orilla='#f6c2c8')
    for i, c in enumerate(PAPEL):
        M[f'papel{i}'] = P.material_liso(f'Laguna_Papel{i}', c, orilla='#fff4e0')
    # la lámina del neón: turquesa descarapelada sobre óxido (la capa de pintura de material_madera
    # sobre una paleta de óxido; la veta corre a lo alto como escurrimientos)
    M['lamina'] = P.material_madera('Laguna_Lamina', paleta=OXIDO, pintura=P.PINTURAS['turquesa'], desgaste=0.9, fino=0.6)
    M['oxido'] = P.material_metal('Laguna_TuboOxido', paleta=METAL_OXIDO, oxido=0.85)
    M['fierro'] = P.material_metal('Laguna_Fierro', paleta=METAL_OSCURO, oxido=0.4)
    M['vidrio'] = P.material_brillo('Laguna_NeonVidrio', '#d4dcdc')
    return M


# ---------------------------------------------------------------- los props

def muelle(M, rnd):
    """7 m de tablas sobre pilotes; z = 0 es el agua, el origen en la orilla y la punta en y = -7."""
    pz = []
    n = 20
    paso = 7.0 / n
    nuevas = {2, 8, 9, 15}
    for i in range(n):
        y = -(i + 0.5) * paso + rnd.uniform(-0.012, 0.012)
        ry = rnd.uniform(-0.012, 0.012) + (0.035 if i == 12 else 0.0)
        pz.append(P.tabla(f'cubierta_{i}', 1.5 + rnd.uniform(-0.06, 0.05), 0.3 * rnd.uniform(0.9, 1.03), 0.065,
                          M['muelle_nueva'] if i in nuevas else M['muelle'],
                          centro=(rnd.uniform(-0.035, 0.035), y, 0.3175 + rnd.uniform(-0.006, 0.004)),
                          rot=(rnd.uniform(-0.015, 0.015), ry, rnd.uniform(-0.035, 0.035)), divisiones=1, chueco=0.012))
    for s in (-1, 1):
        pz.append(P.tabla(f'larguero_{s}', 7.1, 0.13, 0.16, M['muelle'], centro=(0.5 * s, -3.5, 0.205),
                          rot=(0, 0, math.pi / 2 + 0.004 * s), divisiones=5, chueco=0.02))
    estaciones = (-0.22, -3.5, -6.78)
    for k, y in enumerate(estaciones):
        pz.append(tabla1(f'travesano_{k}', 1.66, 0.12, 0.13, M['muelle'], centro=(0, y, 0.06),
                         rot=(0, rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02)), chueco=0.012))
    for y in estaciones[:2]:
        for s in (-1, 1):
            pz.append(P.poste('pilote', 1.48, 0.11, M['muelle'], centro=(0.69 * s, y, -1.2),
                              rot=(rnd.uniform(-0.03, 0.03), rnd.uniform(-0.03, 0.03), rnd.uniform(0, 6)), lados=10, punta=0.9, chueco=0.02))
            # el amarre: una vuelta de cuerda alrededor del pilote y el larguero
            pz.append(toro('amarre', 0.17, 0.021, M['cuerda'], centro=(0.62 * s, y, 0.205), rot=(rnd.uniform(-0.12, 0.12), 0.18 * s, 0),
                           seg=12, lados=3, escala=(1.25, 0.78)))
    for s in (-1, 1):
        rx, ry = rnd.uniform(-0.03, 0.03), 0.035 * s
        y0 = estaciones[2]
        pz.append(P.poste('poste_punta', 2.25, 0.12, M['muelle'], centro=(0.88 * s, y0, -1.2),
                          rot=(rx, ry, rnd.uniform(0, 6)), lados=10, punta=0.82, chueco=0.025))

        def sobre_poste(z):
            h = z + 1.2
            return 0.88 * s + h * math.tan(ry), y0 - h * math.tan(rx), 0.12 * (1 - 0.18 * h / 2.25)
        for k in range(2):
            z = 0.62 + 0.055 * k
            x, y, r = sobre_poste(z)
            pz.append(toro('vuelta', r + 0.019, 0.021, M['cuerda'], centro=(x, y, z),
                           rot=(rx + rnd.uniform(-0.08, 0.08), ry + rnd.uniform(-0.08, 0.08), 0), seg=10, lados=3))
        x, y, r = sobre_poste(0.12)
        pz.append(toro('amarre_punta', 0.15, 0.02, M['cuerda'], centro=(x - 0.07 * s, y, 0.12), rot=(0.1, 0.15 * s, 0), seg=10, lados=3, escala=(1.2, 0.85)))
    # la cuerda que cuelga del poste de la izquierda hasta el agua
    pts = [(-0.98, -6.74, 0.66), (-1.06, -6.7, 0.5), (-1.1, -6.62, 0.3), (-1.1, -6.5, 0.12), (-1.06, -6.36, 0.0), (-1.0, -6.2, -0.12)]
    pz.append(tubo('cuerda_suelta', pts, 0.019, M['cuerda'], lados=4))
    # la escalerita al agua en la punta
    inc = -0.1
    yb = -7.19
    for s in (-1, 1):
        pz.append(palo('riel', 1.5, 0.033, M['muelle'], centro=(0.25 * s, yb, -0.8), rot=(inc, 0, 0), lados=10, cortes=2, chueco=0.006, bisel=0.01))
    for k, z in enumerate((-0.55, -0.25, 0.05)):
        y = yb + (z + 0.8) * math.tan(-inc)
        pz.append(palo(f'peldano_{k}', 0.58, 0.025, M['muelle'], centro=(-0.29, y, z), rot=(0, math.pi / 2, rnd.uniform(-0.03, 0.03)), lados=6, cortes=0, chueco=0.004))
    return unir(pz, 'Prop_Muelle')


def puesto(M, rnd, figuras):
    """El puesto de Argus: mostrador de tablas con un pez de neón al frente, techito turquesa sobre
    cuatro postes con el letrero PESCA de neón encima, el tablero de récords colgado de un brazo a
    la izquierda y papel picado."""
    pz = []
    mad = M['madera']
    frente, techo, techo_x = [], [], []
    for k in range(3):
        frente.append(P.tabla(f'frente_{k}', 2.22 + rnd.uniform(-0.03, 0.02), 0.3, 0.045, mad,
                          centro=(rnd.uniform(-0.015, 0.015), -0.4, 0.17 + k * 0.315),
                          rot=(math.pi / 2 + rnd.uniform(-0.025, 0.025), rnd.uniform(-0.012, 0.012), 0), divisiones=1))
    pz += frente
    for s in (-1, 1):
        for k in range(3):
            pz.append(tabla1(f'lado_{k}', 0.82, 0.3, 0.045, mad, centro=(1.1 * s, 0.0, 0.17 + k * 0.315),
                             rot=(math.pi / 2 + rnd.uniform(-0.02, 0.02), rnd.uniform(-0.01, 0.01), math.pi / 2)))
    for k, y in enumerate((-0.36, -0.045, 0.27)):
        pz.append(P.tabla(f'mostrador_{k}', 2.42 + rnd.uniform(-0.04, 0.03), 0.31, 0.07, mad,
                          centro=(rnd.uniform(-0.02, 0.02), y, 0.965 + rnd.uniform(-0.004, 0.004)),
                          rot=(rnd.uniform(-0.01, 0.01), rnd.uniform(-0.008, 0.008), rnd.uniform(-0.012, 0.012)), divisiones=1))
    pz.append(tabla1('repisa', 2.12, 0.62, 0.04, mad, centro=(0, 0.02, 0.42)))
    # postes: los de enfrente de 2.3 m, los de atrás más bajos para que el techo caiga hacia atrás
    for s in (-1, 1):
        pz.append(P.caja('poste_frente', (0.13, 0.13, 2.3), mad, centro=(1.32 * s, -0.62, 1.15), rot=(rnd.uniform(-0.015, 0.015), 0.012 * s, 0.05), chueco=0.012))
        pz.append(P.caja('poste_atras', (0.13, 0.13, 2.0), mad, centro=(1.32 * s, 0.95, 1.0), rot=(rnd.uniform(-0.015, 0.015), 0.01 * s, -0.04), chueco=0.012))
    pz.append(P.tabla('viga_frente', 2.98, 0.12, 0.14, mad, centro=(0, -0.62, 2.37), rot=(0, 0.01, 0.006), divisiones=1, chueco=0.012))
    pz.append(P.tabla('viga_atras', 2.98, 0.12, 0.14, mad, centro=(0, 0.95, 2.07), rot=(0, -0.008, -0.005), divisiones=1, chueco=0.012))
    # el techito: tablas a lo largo de la pendiente, una sin pintar (la que cambiaron)
    th = math.atan2(0.30, 1.57)
    largo = 2.25 / math.cos(th)
    for k in range(10):
        x = -1.35 + k * 0.3 + rnd.uniform(-0.012, 0.012)
        alza = 0.022 if k % 2 else 0.0
        techo_x.append(x)
        techo.append(P.tabla(f'techo_{k}', largo + rnd.uniform(-0.06, 0.04), 0.28 if k % 2 == 0 else 0.25, 0.05,
                          mad if k == 6 else M['turquesa'],
                          centro=(x, 0.155 + rnd.uniform(-0.03, 0.03), 2.317 + alza + rnd.uniform(-0.006, 0.006)),
                          rot=(rnd.uniform(-0.02, 0.02), th + rnd.uniform(-0.012, 0.012), math.pi / 2 + rnd.uniform(-0.02, 0.02)), divisiones=1, chueco=0.01))
    pz += techo
    # el brazo del tablero de récords (izquierda) con una escuadra corta entre el poste y el
    # tablero; el tablero cuelga hacia la punta, así la diagonal no pasa por su marco (Oscar)
    x_poste = 1.385  # la cara de afuera del poste
    largo_b = 1.5
    pz.append(tabla1('brazo', largo_b, 0.08, 0.09, mad, centro=(-(x_poste - 0.01 + largo_b / 2), -0.62, 2.12), rot=(0, rnd.uniform(-0.01, 0.01), 0)))
    a = (x_poste - 0.012, 1.86)
    b = (x_poste + 0.36, 2.086)
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    pz.append(tabla1('escuadra', math.hypot(b[0] - a[0], b[1] - a[1]) + 0.05, 0.07, 0.05, mad,
                     centro=(-(a[0] + b[0]) / 2, -0.62, (a[1] + b[1]) / 2), rot=(0, ang, 0)))
    # el tablero de récords: marco de madera y la pizarra aparte
    cx, cz = -(x_poste + 0.45 + 0.5), 1.57
    for k, z in enumerate((cz + 0.315, cz - 0.315)):
        pz.append(tabla1(f'marco_h{k}', 1.0, 0.07, 0.05, mad, centro=(cx + rnd.uniform(-0.01, 0.01), -0.62, z), rot=(math.pi / 2, rnd.uniform(-0.015, 0.015), 0)))
    for k, x in enumerate((cx - 0.465, cx + 0.465)):
        pz.append(tabla1(f'marco_v{k}', 0.58, 0.07, 0.05, mad, centro=(x, -0.62, cz), rot=(math.pi / 2, math.pi / 2 + rnd.uniform(-0.015, 0.015), 0)))
    for x in (cx - 0.35, cx + 0.35):
        pz.append(tubo('cuerda_tablero', [(x, -0.62, 2.09), (x + 0.004, -0.62, 1.99), (x, -0.62, 1.9)], 0.011, M['cuerda'], lados=4))
    pizarra = P.caja('Prop_PuestoArgus_Pizarra', (0.9, 0.02, 0.6), M['pizarra'], centro=(cx, -0.608, cz), chueco=0.002, bisel=0.006)
    # papel picado entre los postes de enfrente, con su recorte de flor (el esténcil de Skulley va
    # solo en la caja de carnada: Oscar no quiere calaveritas en todo)
    picado = imagen('Laguna_PapelPicado', dibujo_papel_picado())

    def cuelga(x):
        return 2.27 - 0.09 * (1 - (x / 1.3) ** 2)
    pts = [(x, -0.69, cuelga(x)) for x in np.linspace(-1.3, 1.3, 9)]
    pz.append(tubo('hilo_papel', pts, 0.006, M['cuerda'], lados=3))
    fleco = [(-0.1, 0.0), (-0.1, -0.2)] + [(-0.1 + 0.2 * i / 6, -0.25 if i % 2 else -0.2) for i in range(1, 6)] + [(0.1, -0.2), (0.1, 0.0)]
    for i, x in enumerate(np.linspace(-1.05, 1.05, 8)):
        mat = M[f'papel{i % len(PAPEL)}']
        z = cuelga(x) + 0.004
        pz.append(placa('papel', fleco, 0.004, mat, centro=(x, -0.69, z), rot=(rnd.uniform(-0.25, 0.25), 0, rnd.uniform(-0.12, 0.12)), bisel=0))
        P.calca(mat, picado, centro=(x, z - 0.118), ancho=0.17, normal=(0, -1, 0), color='#1d1830', gasto=0.05)
        P.calca(mat, picado, centro=(x, z - 0.118), ancho=0.17, normal=(0, 1, 0), color='#1d1830', gasto=0.05)
    pintadas, neones = neones_puesto(M, frente, techo, techo_x, figuras)
    revisar_puesto(pz + pintadas + [pizarra] + neones)
    o = unir(pz + pintadas, 'Prop_PuestoArgus')
    return o, [pizarra] + neones

def _arbol(objs):
    from mathutils.bvhtree import BVHTree
    verts, caras = [], []
    for o in objs:
        base = len(verts)
        verts += [o.matrix_world @ v.co for v in o.data.vertices]
        caras += [[base + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, caras) if caras else None


def revisar_puesto(objs):
    """Traspasos entre las piezas del puesto (intersección de mallas, antes de unirlas). Lo que se
    toca a propósito (ménsulas en la madera, cuerdas en el brazo, placas en las tablas) no entra."""
    def g(*pref):
        return [o for o in objs if o.name.split('.')[0].startswith(pref)]
    pares = [
        ('tablero (marco, pizarra, cuerdas)', g('marco_h', 'marco_v', 'cuerda_tablero', 'Prop_PuestoArgus_Pizarra'),
         'escuadra, postes, viga y papel picado', g('escuadra', 'poste_frente', 'poste_atras', 'viga_frente', 'papel', 'hilo_papel')),
        ('escuadra', g('escuadra'), 'papel picado', g('papel', 'hilo_papel')),
        ('cable y transformador', g('cable', 'transformador'), 'tablas del frente', g('frente_')),
        ('lámina del pez', g('pez_lamina', 'tubo_oxidado'), 'tablas del frente', g('frente_')),
        ('neón del pez', g('Prop_PuestoArgus_Neon_Pez'), 'lámina, grapas y ménsulas', g('pez_lamina', 'grapa', 'mensula_pez')),
        ('neón de PESCA', g('Prop_PuestoArgus_Neon_Pesca'), 'lámina, grapas y bastidor', g('lamina_', 'grapa', 'barra', 'poste_letras', 'mensula', 'tirante')),
        ('bastidor (barras, postes, tirantes)', g('barra', 'poste_letras', 'tirante'), 'lámina de las letras', g('lamina_')),
        ('letras', g('lamina_', 'tubo_oxidado', 'barra'), 'tablas del techo y viga', g('techo_', 'viga_frente')),
        ('postes del letrero', g('poste_letras'), 'tablas del techo', g('techo_')),
    ]
    for na, A, nb, B in pares:
        ta, tb = _arbol(A), _arbol(B)
        n = len(ta.overlap(tb)) if ta and tb else 0
        print(f'  traspasos {na} contra {nb}: {n}')


def neones_puesto(M, frente, techo, techo_x, figuras):
    """El pez de neón en el frente del mostrador (con su transformador abajo) y PESCA en runas sobre
    el techo, en un bastidor de fierro atornillado a las tablas. Regresa (lo pintado, los tubos)."""
    lam, oxi, fie = M['lamina'], M['oxido'], M['fierro']
    pintadas, neones = [], []
    # --- el pez: bloque de lámina con el frente abierto, filas cada 2.5 cm y su tubo oxidado
    S, zp = 0.68, 0.5
    sil = [Vector(((a - 0.49) * S, zp + (b - 0.045) * S)) for a, b in contorno_pez()]
    ojo = [Vector(((0.15 - 0.49) * S + 0.034 * math.cos(-2 * math.pi * k / 14), zp + (0.06 - 0.045) * S + 0.034 * math.sin(-2 * math.pi * k / 14))) for k in range(14)]
    lazos = [sil, ojo]
    arb = arboles_de(frente)

    def madera_y(x, z):
        for dz in (0.0, 0.03, -0.03, 0.06, -0.06):
            h = rayo(arb, (x, -1.5, z + dz), (0, 1, 0))
            if h and h[0].y < -0.405:
                return h[0].y, z + dz
        return -0.4225, z
    xs = [p.x for p in sil]
    zs = [p.y for p in sil]
    malla = [madera_y(x, z)[0] for x in np.linspace(min(xs) - 0.02, max(xs) + 0.02, 26) for z in np.linspace(min(zs) - 0.02, max(zs) + 0.02, 12)]
    hondo = 0.08
    y_atras = min(malla) - 0.016
    y_frente = y_atras - hondo
    pintadas.append(caja_lamina('pez_lamina', lazos, y_frente, hondo, lam))
    filas = filas_de(lazos, 0.025, 0.02)  # el grosor de la lámina va 4 mm adentro de la orilla
    neones.append(objeto_filas('Prop_PuestoArgus_Neon_Pez', filas, y_frente + 0.021, M['vidrio']))
    marco = [desplazar_lazo(sil, 0.006 + NEON['marco_r']), desplazar_lazo(ojo, 0.004 + NEON['marco_r'])]
    pintadas += marco_oxidado(marco, lazos, y_frente + 0.012, oxi, fie, cada=0.12)
    # ménsulas a la madera, adentro de la silueta
    for a, b in ((0.18, 0.08), (0.18, -0.08), (0.45, 0.12), (0.45, -0.1), (0.72, 0.0), (0.88, 0.14), (0.88, -0.14)):
        x, z = (a - 0.49) * S, zp + (b - 0.045) * S
        if not dentro(lazos, x, z):
            continue
        yw, z2 = madera_y(x, z)
        largo = (yw + 0.003) - (y_atras - 0.003)
        pintadas.append(bloque('mensula_pez', (0.03, largo, 0.022), fie, centro=(x, (yw + 0.003 + y_atras - 0.003) / 2, z2), bisel=0))
    # el cable del pez al transformador, pegado a la madera, y la cajita en el piso
    xc = (0.7 - 0.49) * S
    yw0, _ = madera_y(xc, zp - 0.12)
    # la madera más salida donde va la caja y a lo largo del cable (las tablas van chuecas)
    caja_y = min(madera_y(x, z)[0] for x in (0.33, 0.4, 0.47) for z in (0.03, 0.06, 0.09)) - 0.0415
    pts = [(xc, y_atras + 0.003, zp - 0.07)]
    for z in np.linspace(zp - 0.1, 0.13, 7):
        x = xc + max(0.0, 0.3 - z) * 0.4
        pts.append((x, min(madera_y(x + dx, z)[0] for dx in (-0.01, 0.0, 0.01)) - 0.009, z))
    pts += [(0.36, caja_y + 0.01, 0.103), (0.38, caja_y, 0.093)]
    pintadas.append(tubo('cable', pts, 0.005, fie, lados=4))
    for z in (0.27, 0.17):
        x = xc + (0.3 - z) * 0.4
        pintadas.append(bloque('grapa_cable', (0.02, 0.014, 0.014), fie, centro=(x, madera_y(x, z)[0] - 0.007, z), bisel=0.002))
    pintadas.append(bloque('transformador', (0.15, 0.075, 0.09), fie, centro=(0.4, caja_y, 0.045), bisel=0.008))
    print(f'  pez: lámina a {min(malla) - y_atras:.3f} m de la madera más salida, {len(filas)} filas')
    # --- PESCA en el techo
    d = json.load(open(NEON_PESCA, encoding='utf-8'))
    s = 1.8 / d['ancho']
    hondo = 1.6 * s
    arb_t = arboles_de(techo)

    def techo_en(x, y):
        h = rayo(arb_t, (x, y, 6.0), (0, 0, -1))
        return (h[0], h[1]) if h else (None, None)
    y_frente = -0.72
    y_atras = y_frente + hondo
    huella = [techo_en(x, y)[0] for x in np.linspace(-0.92, 0.92, 40) for y in np.linspace(y_frente, y_atras + 0.05, 4)]
    huella = [h.z for h in huella if h is not None]  # entre tabla y tabla hay rendija
    z_base = max(huella) + 0.07

    def a_m(x, y):
        return (x * s, z_base + (d['y1'] - y) * s)
    piezas_letras = []
    for i, L in enumerate(d['letras']):
        lazos = [simplificar_lazo(l, NEON['tol']) for l in lazos_metros([c['pts'] for c in L['contornos']], a_m)]
        pintadas.append(caja_lamina(f'lamina_{L["letra"]}', lazos, y_frente, hondo, lam))
        filas = [(x0 * s, x1 * s, a_m(0, yy)[1]) for x0, x1, yy in L['filas']]
        neones.append(objeto_filas(f'Prop_PuestoArgus_Neon_Pesca_{i}', filas, y_frente + 0.25 * s, M['vidrio']))
        marco = lazos_metros(L['marco'], a_m)
        pintadas += marco_oxidado(marco, lazos, y_frente + 0.012, oxi, fie, cada=2.0 * s)
        piezas_letras.append((L, lazos))
    # una calcomanía en el costado derecho de la C (Oscar: como mucho una y sin calavera)
    L, lazos = piezas_letras[3]
    x_der = max(p.x for p in lazos[0])
    z_med = sum(p.y for p in lazos[0]) / len(lazos[0])
    yc = y_frente + hondo / 2
    disco = imagen('Laguna_Calcomania', dibujo_calcomania())
    calca_eje(lam, disco, centro=(yc, z_med), ancho=0.085, cara='+X', color='#efe3c4', gasto=0.12, rango=(x_der - 0.02, x_der + 0.02))
    calca_eje(lam, figuras['cuerpo'], centro=(yc, z_med), ancho=0.07, cara='+X', color='#d8602a', gasto=0.15, rango=(x_der - 0.02, x_der + 0.02))
    # el bastidor: postes de fierro sobre cada tabla del techo, tres barras detrás de las letras,
    # ménsulas de cada pieza a la barra o poste que le pasa detrás y dos tirantes hacia atrás
    y_b = y_atras + 0.02 + 0.0125
    xs_postes = [x for x in techo_x if -0.8 < x < 0.8]
    zs_barras = [a_m(0, d['y0'] + 1.0)[1], a_m(0, (d['y0'] + d['y1']) / 2)[1], a_m(0, d['y1'] - 0.8)[1]]
    z_tope = zs_barras[0] + 0.0125
    pintadas.append(bloque('barra', (xs_postes[-1] - xs_postes[0] + 0.1, 0.025, 0.025), fie, centro=((xs_postes[0] + xs_postes[-1]) / 2, y_b, zs_barras[0]), bisel=0.003))
    for z in zs_barras[1:]:
        pintadas.append(bloque('barra', (xs_postes[-1] - xs_postes[0] + 0.1, 0.025, 0.025), fie, centro=((xs_postes[0] + xs_postes[-1]) / 2, y_b, z), bisel=0.003))

    def placa(punto, normal, nombre):
        q = normal.to_track_quat('Z', 'Y')
        ey = q @ Vector((0, 1, 0))
        pintadas.append(bloque(nombre, (0.065, 0.1, 0.006), fie, centro=tuple(punto + normal * 0.003), rot=tuple(q.to_euler()), bisel=0.002))
        for sgn in (-1, 1):
            c = punto + normal * 0.005 + ey * 0.033 * sgn
            pintadas.append(palo('tornillo', 0.006, 0.008, fie, centro=tuple(c), rot=tuple(q.to_euler()), lados=6, cortes=0, chueco=0))
    for x in xs_postes:
        punto, normal = techo_en(x, y_b)
        placa(punto, normal, 'placa_poste')
        alto = z_tope - (punto.z + 0.006)
        pintadas.append(bloque('poste_letras', (0.025, 0.025, alto + 0.004), fie, centro=(x, y_b, punto.z + 0.006 + alto / 2), bisel=0.003))
    for x in (xs_postes[0], xs_postes[-1]):
        punto, normal = techo_en(x, -0.15)
        pintadas.append(liston('tirante', [(x, y_b + 0.012, zs_barras[0]), (x, punto.y, punto.z + 0.012)], 0.01, 0.025, fie, arriba=(1, 0, 0), bisel=0.002))
        placa(punto, normal, 'placa_tirante')
    # ménsulas: donde una barra o un poste pasa detrás de una pieza
    sin_mensula = 0
    largo = (y_b - 0.0125 + 0.003) - (y_atras - 0.003)
    yc_m = (y_atras - 0.003 + y_b - 0.0125 + 0.003) / 2
    for L, lazos in piezas_letras:
        piezas = [l for l, c in zip(lazos, L['contornos']) if not c.get('hueco')]
        for pieza in piezas:
            puntos = []
            for z in zs_barras:
                for x0, x1 in cortes_fila([pieza], z):
                    if x1 - x0 > 0.03:
                        puntos.append(((x0 + x1) / 2, z))
            for x in xs_postes:
                zz = [p.y for p in pieza]
                for z in np.linspace(min(zz), max(zz), 24):
                    if dentro(lazos, x, z) and dentro([pieza], x, z):
                        puntos.append((x, z))
                        break
            puntos = [(x, z) for x, z in puntos if dentro(lazos, x, z)]
            if not puntos:
                # una pieza sin barra detrás: una varilla hasta la barra más cercana
                c = Vector((sum(p.x for p in pieza), sum(p.y for p in pieza))) / len(pieza)
                zb = min(zs_barras, key=lambda z: abs(z - c.y))
                pintadas.append(bloque('varilla', (0.012, 0.012, abs(zb - c.y) + 0.02), fie, centro=(c.x, y_b, (zb + c.y) / 2), bisel=0))
                puntos = [(c.x, c.y)]
                sin_mensula += 1
            for x, z in puntos[:2]:
                pintadas.append(bloque('mensula', (0.022, largo, 0.03), fie, centro=(x, yc_m, z), bisel=0))
    print(f'  PESCA: 1.80 m de ancho, de {z_base:.2f} a {z_base + (d["y1"] - d["y0"]) * s:.2f} m, '
          f'{z_base - max(huella):.3f} m sobre lo más alto del techo, {sin_mensula} piezas con varilla')
    return pintadas, neones


# La lancha: casco de tracas encimadas (a la orilla de cada tabla se ve el escalón), roja por fuera
LARGO_L = 2.5


def _ancho_l(t):
    if t < 0.42:
        return 0.31 + 0.1 * math.sin(t / 0.42 * math.pi / 2)
    s = (t - 0.42) / 0.58
    return 0.398 * max(0.0, 1 - s ** 2.1) ** 0.72 + 0.012


def _quilla_l(t):
    return 0.035 * (2 * t - 1) ** 2 + 0.075 * max(0.0, (t - 0.72) / 0.28) ** 2.2


def _borda_l(t):
    if t < 0.45:
        return 0.47 + 0.05 * ((0.45 - t) / 0.45) ** 2
    return 0.47 + 0.19 * ((t - 0.45) / 0.55) ** 1.8


def _punto_l(t, u):
    """El casco: t de 0 (popa, +Y) a 1 (proa, -Y); u de -1 (borda izquierda) por la quilla (0) a 1."""
    s = 1.0 if u >= 0 else -1.0
    phi = min(abs(u), 1.0) * math.pi / 2
    w = _ancho_l(t)
    zk, zs = _quilla_l(t), _borda_l(t)
    x = w * math.sin(phi) + 0.045 * (w / 0.41) * (1 - math.cos(phi)) ** 2
    z = zk + (zs - zk) * (1 - math.cos(phi))
    return Vector((s * x, LARGO_L / 2 - t * LARGO_L, z))


def _normal_l(t, u):
    e = 1e-3
    du = _punto_l(t, min(u + e, 1.0)) - _punto_l(t, max(u - e, -1.0))
    dt = _punto_l(min(t + e, 1.0), u) - _punto_l(max(t - e, 0.0), u)
    n = du.cross(dt)
    if n.length < 1e-9:
        n = Vector((1 if u >= 0 else -1, 0, 0))
    n.normalize()
    p = _punto_l(t, u)
    if n.dot(p - Vector((0, p.y, _borda_l(t) + 0.4))) < 0:
        n = -n
    return n


def _estaciones_l(n=8, t1=1.0):
    return [t1 * (1 - (1 - j / n) ** 1.45) for j in range(n + 1)]


def traca(nombre, u0, u1, desp, grueso, mats, across=1, n=8):
    """Una traca: tira con grueso que sigue el casco entre u0 y u1, corrida `desp` hacia afuera (la
    de arriba monta sobre la de abajo). Afuera pintada, adentro madera."""
    bm = bmesh.new()
    ts = _estaciones_l(n)
    us = [u0 + (u1 - u0) * a / across for a in range(across + 1)]
    O, I = [], []
    for t in ts:
        fo, fi = [], []
        g = grueso * (0.55 + 0.45 * min(1.0, (1.0 - t) / 0.12))
        for u in us:
            p, nn = _punto_l(t, u), _normal_l(t, u)
            po = p + nn * desp
            fo.append(bm.verts.new(po))
            fi.append(bm.verts.new(po - nn * g))
        O.append(fo)
        I.append(fi)
    fuera = []
    for j in range(len(ts) - 1):
        for a in range(across):
            fuera.append(bm.faces.new((O[j][a], O[j][a + 1], O[j + 1][a + 1], O[j + 1][a])))
            bm.faces.new((I[j][a + 1], I[j][a], I[j + 1][a], I[j + 1][a + 1]))
        fuera.append(bm.faces.new((O[j][0], O[j + 1][0], I[j + 1][0], I[j][0])))
        fuera.append(bm.faces.new((O[j + 1][-1], O[j][-1], I[j][-1], I[j + 1][-1])))
    for j in (0, len(ts) - 1):
        for a in range(across):
            bm.faces.new((O[j][a], O[j][a + 1], I[j][a + 1], I[j][a]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.material_index = 1
    for f in fuera:
        f.material_index = 0
    o = P.objeto(nombre, bm, None)
    for m in mats:
        o.data.materials.append(m)
    P.poner_veta(o, 'Y')
    P.biselar(o, 0.007, segmentos=1)
    return o


def _u_a_altura(t, z):
    lo, hi = 0.0, 1.0
    for _ in range(30):
        mid = (lo + hi) / 2
        if _punto_l(t, mid).z < z:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def lancha(M, rnd):
    """Lancha de remos de 2.6 × 1.0 m: panza redondeada de tracas encimadas, dos bancas, cuadernas,
    roja por fuera con su línea de flotación y madera por dentro."""
    pz = []
    rojo, mad = M['lancha'], M['madera']
    mats = [rojo, mad]
    tracas = [(-0.14, 0.14, 0.0, 2)]
    for s in (-1, 1):
        for k, (a, b, across) in enumerate(((0.11, 0.37, 1), (0.34, 0.61, 1), (0.58, 0.83, 1), (0.8, 1.0, 1))):
            u0, u1 = (a, b) if s > 0 else (-b, -a)
            tracas.append((u0, u1, 0.006 * (k + 1), across))
    for i, (u0, u1, desp, across) in enumerate(tracas):
        pz.append(traca(f'traca_{i}', u0, u1, desp, 0.032, mats, across=across))
    # espejo de popa: el contorno del casco en t = 0, roja por fuera (+Y) y madera por dentro
    us = np.linspace(-1, 1, 15)
    cont = []
    for u in us:
        p = _punto_l(0.0, u) + _normal_l(0.0, u) * 0.03
        cont.append((p.x, p.z))
    cont.append((cont[-1][0] * 0.98, _borda_l(0.0) + 0.035))
    cont.append((cont[0][0] * 0.98, _borda_l(0.0) + 0.035))
    yp = LARGO_L / 2
    pz.append(placa('espejo', cont, 0.05, None, centro=(0, yp + 0.015, 0), veta='X', bisel=0.01, segmentos=1,
                    materiales=mats, cual=lambda nn: 1 if nn.y < -0.5 else 0))
    # roda y quilla por fuera
    roda = [_punto_l(t, 0.0) + Vector((0, 0, -0.012)) for t in (0.8, 0.88, 0.94, 0.98)]
    roda += [_punto_l(1.0, 0.0) + Vector((0, -0.03, 0.02)), Vector((0, -LARGO_L / 2 - 0.045, _borda_l(1.0) * 0.6)),
             Vector((0, -LARGO_L / 2 - 0.05, _borda_l(1.0) + 0.06))]
    pz.append(liston('roda', roda, 0.065, 0.075, rojo, arriba=(1, 0, 0), bisel=0.012))
    quilla = [_punto_l(t, 0.0) + Vector((0, 0, -0.018)) for t in (0.0, 0.2, 0.4, 0.6, 0.8)]
    pz.append(liston('quilla', quilla, 0.055, 0.035, rojo, arriba=(1, 0, 0), bisel=0.01))
    # bordas de madera arriba de la última traca
    ts = _estaciones_l(8, 0.985)
    for s in (-1, 1):
        pts = [_punto_l(t, s) + _normal_l(t, s) * 0.012 + Vector((0, 0, 0.014)) for t in ts]
        pz.append(liston('borda', pts, 0.075, 0.036, mad, arriba=(0, 0, 1), bisel=0.012))
    # cuadernas por dentro
    for t in (0.18, 0.4, 0.62, 0.8):
        pts = []
        for u in np.linspace(-0.93, 0.93, 7):
            pts.append(_punto_l(t, u) + _normal_l(t, u) * (0.024 * abs(u) - 0.032 - 0.016))
        pz.append(liston('cuaderna', pts, 0.032, 0.05, mad, arriba=(0, 1, 0), bisel=0))
    # bancas y piso
    for t in (0.3, 0.62):
        z = 0.33
        x = _punto_l(t, _u_a_altura(t, z)).x - 0.045
        pz.append(P.tabla('banca', 2 * x + 0.02, 0.26, 0.05, mad, centro=(0, _punto_l(t, 0).y, z), rot=(0, rnd.uniform(-0.01, 0.01), rnd.uniform(-0.012, 0.012)), divisiones=1))
    for x, z in ((-0.14, 0.09), (0.0, 0.066), (0.14, 0.09)):
        pz.append(tabla1('piso', 1.25, 0.11, 0.025, mad, centro=(x, 0.12, z + 0.012), rot=(-1.4 * x, 0, math.pi / 2)))
    # chumaceras de metal en la borda: un bloque y la horquilla en U que abre hacia arriba
    for s in (-1, 1):
        p = _punto_l(0.5, s) + _normal_l(0.5, s) * 0.012 + Vector((0, 0, 0.034))
        pz.append(bloque('chumacera', (0.04, 0.11, 0.025), M['metal'], centro=tuple(p), bisel=0.006))
        arco = [(p.x, p.y - 0.035, p.z + 0.09)]
        arco += [(p.x, p.y + 0.035 * math.cos(a), p.z + 0.055 + 0.035 * math.sin(a)) for a in np.linspace(math.pi, 2 * math.pi, 7)]
        arco += [(p.x, p.y + 0.035, p.z + 0.09)]
        pz.append(tubo('horquilla', arco, 0.007, M['metal'], lados=3))
    # argolla de amarre en la roda
    pz.append(toro('argolla', 0.032, 0.007, M['metal'], centro=(0, -LARGO_L / 2 - 0.085, _borda_l(1.0) - 0.04), rot=(0, math.pi / 2, 0), seg=8, lados=3))
    # pintura: línea de flotación y lo de abajo más oscuro
    franja_z(rojo, -1.0, 0.095, '#3b2420', opacidad=0.55)
    franja_z(rojo, 0.095, 0.118, '#b9a37c', opacidad=0.6)
    return unir(pz, 'Prop_Lancha')


def remo(M, rnd):
    """Remo de 1.8 m, de pie: la pala roja abajo y la empuñadura arriba."""
    pz = []
    cont = []
    for i in range(10):
        z = 0.03 + 0.55 * i / 9
        f = (z - 0.03) / 0.55
        hw = 0.088 * (1 - f ** 2.6) + 0.024 * f ** 2.6
        cont.append((hw, z))
    contorno = [(0.03, 0.0), (0.062, 0.009)] + cont + [(-x, z) for x, z in reversed(cont)] + [(-0.062, 0.009), (-0.03, 0.0)]
    pz.append(placa('pala', contorno, 0.024, M['remo'], veta='Z', bisel=0.008, segmentos=1, chueco=0.002))
    pz.append(palo('cana_remo', 1.2, 0.024, M['fina'], centro=(0, 0, 0.46), lados=10, cortes=2, chueco=0.004))
    pz.append(torno('puno', [(0, 1.63), (0.024, 1.63), (0.03, 1.66), (0.031, 1.76), (0.026, 1.795), (0, 1.8)], M['fina'], lados=10, bisel=0))
    pz.append(torno('forro', [(0.0244, 1.0), (0.0305, 1.006), (0.0305, 1.1), (0.0244, 1.106)], M['cuerda'], lados=10, veta=None))
    return unir(pz, 'Prop_Remo', angulo=50)


def cubeta(M, rnd):
    """Cubeta de lámina de 0.3 m con asa de alambre y agarradera de madera; adentro, agua y nada más
    (Oscar: aquí todos los peces se sueltan)."""
    pz = []
    met = M['cubeta']
    perfil = [(0, 0.0), (0.118, 0.0), (0.124, 0.012), (0.152, 0.29), (0.144, 0.292), (0.114, 0.016), (0, 0.016)]
    pz.append(torno('cubeta', perfil, met, lados=14, veta=None))
    pz.append(toro('borde', 0.152, 0.009, met, centro=(0, 0, 0.287), seg=14, lados=4))
    for z, r in ((0.07, 0.1305), (0.2, 0.1432)):
        pz.append(toro('cincho', r, 0.0055, met, centro=(0, 0, z), seg=14, lados=3))
    for s in (-1, 1):
        pz.append(bloque('oreja', (0.012, 0.03, 0.045), met, centro=(0.155 * s, 0, 0.255), bisel=0.004))
    al = 0.45
    arco = []
    for a in np.linspace(0, math.pi, 13):
        x, h = -0.162 * math.cos(a), 0.2 * math.sin(a)
        arco.append((x, -h * math.sin(al), 0.255 + h * math.cos(al)))
    pz.append(tubo('asa', arco, 0.0045, met, lados=4))
    pz.append(palo('agarradera', 0.09, 0.012, M['fina'], centro=(-0.045, -0.2 * math.sin(al), 0.255 + 0.2 * math.cos(al)), rot=(0, math.pi / 2, 0), lados=8, cortes=0))
    pz.append(torno('agua', [(0.137, 0.205), (0, 0.205)], M['agua'], lados=14, veta=None))
    return unir(pz, 'Prop_Cubeta', angulo=50)


def caja_carnada(M, rnd, esten):
    """Caja de carnada de 0.5 × 0.35 × 0.3 m con la tapa entreabierta, tierra con lombrices (una se
    sale), asas de cuerda y Skulley al frente."""
    pz = []
    mat = M['caja']
    g = 0.022
    for k, z in enumerate((0.065, 0.2)):
        pz.append(P.tabla(f'frente_{k}', 0.5, 0.13, g, mat, centro=(rnd.uniform(-0.004, 0.004), -0.175 + g / 2, z), rot=(math.pi / 2 + rnd.uniform(-0.02, 0.02), 0, rnd.uniform(-0.01, 0.01)), divisiones=1, bisel=0.008, chueco=0.004))
        pz.append(tabla1(f'atras_{k}', 0.5, 0.13, g, mat, centro=(0, 0.175 - g / 2, z), rot=(math.pi / 2, 0, rnd.uniform(-0.01, 0.01)), chueco=0.004))
        for s in (-1, 1):
            pz.append(tabla1(f'lado_{k}', 0.306, 0.13, g, mat, centro=((0.25 - g / 2) * s, 0, z), rot=(math.pi / 2, 0, math.pi / 2), chueco=0.004))
    pz.append(tabla1('fondo', 0.46, 0.31, 0.018, mat, centro=(0, 0, 0.012), bisel=0.004))
    for s in (-1, 1):
        pz.append(bloque('esquinero', (0.034, 0.034, 0.27), mat, centro=(0.245 * s, -0.17, 0.135), bisel=0.008, chueco=0.003))
    # la tapa entreabierta: dos tablas y sus travesaños, girada en la bisagra de atrás
    tapa = []
    for k, y in enumerate((-0.092, 0.092)):
        tapa.append(tabla1(f'tapa_{k}', 0.54, 0.183, g, mat, centro=(rnd.uniform(-0.005, 0.005), y, 0.277), chueco=0.004))
    for s in (-1, 1):
        tapa.append(tabla1('travesano_tapa', 0.3, 0.035, 0.02, mat, centro=(0.18 * s, 0, 0.256), rot=(0, 0, math.pi / 2), chueco=0.003))
    tapa.append(bloque('pasador', (0.03, 0.012, 0.055), M['metal'], centro=(0, -0.19, 0.262), bisel=0.003))
    h = Vector((0, 0.175, 0.266))
    giro = Matrix.Translation(h) @ Matrix.Rotation(-0.42, 4, 'X') @ Matrix.Translation(-h)
    for o in tapa:
        o.data.transform(giro)
    pz += tapa
    for s in (-1, 1):
        pz.append(bloque('bisagra', (0.05, 0.01, 0.035), M['metal'], centro=(0.15 * s, 0.181, 0.262), bisel=0.003))
    pz.append(bloque('argolla_frente', (0.026, 0.01, 0.026), M['metal'], centro=(0, -0.18, 0.235), bisel=0.003))
    pz.append(bloque('tierra', (0.44, 0.29, 0.06), M['tierra'], centro=(0, 0, 0.212), chueco=0.01, bisel=0.02))
    gusano = [(0.06, -0.06, 0.232), (0.065, -0.13, 0.27), (0.07, -0.175, 0.285), (0.08, -0.196, 0.262), (0.09, -0.2, 0.222), (0.1, -0.198, 0.19), (0.116, -0.192, 0.172)]
    pz.append(tubo('lombriz', gusano, 0.009, M['lombriz'], lados=5, radios=[0.009, 0.0095, 0.0095, 0.009, 0.0085, 0.008, 0.006]))
    asoma = [(-0.1, 0.04, 0.236), (-0.104, 0.045, 0.268), (-0.09, 0.05, 0.29), (-0.075, 0.052, 0.285)]
    pz.append(tubo('lombriz2', asoma, 0.008, M['lombriz'], lados=5, radios=[0.008, 0.008, 0.0075, 0.006]))
    for s in (-1, 1):
        x = 0.255 * s
        asa = [(x, -0.065, 0.205), (x + 0.03 * s, -0.045, 0.175), (x + 0.038 * s, 0.0, 0.165), (x + 0.03 * s, 0.045, 0.175), (x, 0.065, 0.205)]
        pz.append(tubo('asa', asa, 0.009, M['cuerda'], lados=4))
    calca_eje(mat, esten, centro=(0, 0.135), ancho=0.21, cara='-Y', color='#ecdfbd', gasto=0.22, rango=(-0.2, -0.15))
    return unir(pz, 'Prop_CajaCarnada')


def cana_sencilla(nombre, M):
    """Una caña simplificada (para el rack): mango de corcho, vara de bambú y un carrete chico."""
    pz = [torno(f'{nombre}_mango', [(0, 0), (0.023, 0), (0.027, 0.18), (0.021, 0.36), (0, 0.37)], M['corcho'], lados=6)]
    perfil = [(0, 0.35), (0.015, 0.35)]
    for zn in (0.95, 1.6):
        r = 0.015 - 0.009 * (zn - 0.35) / 2.05
        perfil += [(r, zn - 0.012), (r + 0.003, zn), (r, zn + 0.012)]
    perfil += [(0.0055, 2.39), (0, 2.4)]
    pz.append(torno(f'{nombre}_vara', perfil, M['bambu'], lados=6))
    pz.append(bloque(f'{nombre}_carrete', (0.03, 0.05, 0.05), M['metal'], centro=(0, -0.05, 0.44), bisel=0))
    pz.append(torno(f'{nombre}_bobina', [(0, 0), (0.026, 0), (0.026, 0.04), (0, 0.04)], M['sedal'], lados=6, centro=(0, -0.07, 0.465), veta=None))
    return pz


def rack(M, rnd):
    """Rack de cañas de 1.6 m con tres cañas recargadas en el travesaño de arriba."""
    pz = []
    mad = M['madera']
    for s in (-1, 1):
        pz.append(tabla1('pata', 0.44, 0.09, 0.07, mad, centro=(0.45 * s, 0.0, 0.035), rot=(0, 0, math.pi / 2)))
        pz.append(P.caja('poste', (0.075, 0.075, 1.47), mad, centro=(0.45 * s, 0.08, 0.865), rot=(0, 0.012 * s, 0), chueco=0.008))
    pz.append(P.tabla('base', 1.04, 0.3, 0.06, mad, centro=(0, -0.02, 0.1), divisiones=2))
    for z in (1.45, 0.78):
        pz.append(tabla1('travesano', 1.1, 0.09, 0.05, mad, centro=(0, 0.018, z), rot=(math.pi / 2, rnd.uniform(-0.015, 0.015), 0)))
    for x in (-0.42, -0.14, 0.14, 0.42):
        pz.append(palo('taquete', 0.07, 0.011, mad, centro=(x, -0.006, 1.45), rot=(math.pi / 2, 0, 0), lados=6, cortes=0))
    # recargadas: el centro de la vara toca el frente del travesaño (y = -0.007) a 1.45 m
    a = math.atan2(0.05, 1.32)
    for k, x in enumerate((-0.28, 0.0, 0.28)):
        partes = cana_sencilla(f'cana{k}', M)
        transformar(partes, (x, -0.07, 0.13), (-a, 0, rnd.uniform(-0.3, 0.3)), orden='ZXY')
        pz += partes
    return unir(pz, 'Prop_RackCanas', angulo=48)


def cana(M, rnd):
    """La caña de Skulley, 2.4 m de pie: regatón de goma, mango de corcho, portacarrete, vara de
    bambú con nudos, guías con su amarre de hilo y carrete de metal (un poco más grande que uno de
    verdad, para que se lea de cerca)."""
    pz = []
    pz.append(torno('regaton', [(0, 0.0), (0.022, 0.0), (0.027, 0.01), (0.027, 0.04), (0, 0.04)], M['goma'], lados=10, veta=None))
    pz.append(torno('mango', [(0, 0.038), (0.026, 0.038), (0.03, 0.12), (0.031, 0.24), (0.027, 0.38), (0.022, 0.41), (0, 0.41)], M['corcho'], lados=10))
    pz.append(torno('portacarrete', [(0, 0.405), (0.025, 0.408), (0.025, 0.428), (0.019, 0.434), (0.019, 0.546),
                                     (0.025, 0.552), (0.025, 0.572), (0, 0.575)], M['metal'], lados=10, veta=None))
    pz.append(torno('delantero', [(0, 0.57), (0.022, 0.57), (0.024, 0.62), (0.019, 0.68), (0, 0.68)], M['corcho'], lados=10))

    def r_vara(z):
        return 0.017 - (0.017 - 0.0055) * ((z - 0.67) / 1.73) ** 0.9
    nudos = (1.0, 1.36, 1.7, 2.0, 2.26)
    perfil = [(0, 0.67), (r_vara(0.67), 0.67)]
    for zn in nudos:
        r = r_vara(zn)
        perfil += [(r - 0.0004, zn - 0.014), (r + 0.003, zn), (r - 0.0004, zn + 0.014)]
    perfil += [(0.0055, 2.385), (0.0042, 2.4), (0, 2.4)]
    pz.append(torno('vara', perfil, M['bambu'], lados=8))
    for k, zg in enumerate((0.9, 1.4, 1.7, 1.96, 2.18)):
        r = r_vara(zg)
        R = 0.021 - 0.0028 * k
        yc = -(r + 0.006 + R)
        pz.append(toro('guia', R, 0.0026, M['metal'], centro=(0, yc, zg), seg=7, lados=3))
        pz.append(bloque('pata_guia', (0.004, 0.011, 0.026), M['metal'], centro=(0, -(r + 0.0045), zg - 0.004), bisel=0))
        pz.append(torno('amarre', [(r + 0.0019, zg - 0.017), (r + 0.0019, zg + 0.013)], M['hilo'], lados=6, veta=None))
    pz.append(toro('puntera', 0.0065, 0.0018, M['metal'], centro=(0, -0.0085, 2.403), seg=6, lados=3))
    pz.append(torno('amarre_punta', [(0.0062, 2.37), (0.0062, 2.398)], M['hilo'], lados=8, veta=None))
    # carrete: pie, tallo, caja de engranes, rotor, bobina con sedal, arco y manivela
    met = M['metal']
    yc = -0.098
    pz.append(bloque('pie', (0.014, 0.008, 0.09), met, centro=(0, -0.024, 0.49), bisel=0.003))
    pz.append(bloque('tallo', (0.013, 0.05, 0.016), met, centro=(0, -0.05, 0.47), bisel=0.004))
    pz.append(torno('caja_engranes', [(0, -0.023), (0.029, -0.023), (0.034, -0.012), (0.034, 0.012), (0.029, 0.023), (0, 0.023)], met, lados=10,
                    centro=(0, yc, 0.462), rot=(0, math.pi / 2, 0), veta=None))
    pz.append(torno('rotor', [(0, 0.488), (0.027, 0.488), (0.032, 0.498), (0.032, 0.52), (0, 0.52)], met, lados=10, centro=(0, yc, 0), veta=None))
    pz.append(torno('bobina', [(0, 0.518), (0.028, 0.518), (0.029, 0.548), (0, 0.548)], M['sedal'], lados=10, centro=(0, yc, 0), veta=None))
    pz.append(torno('tapa_bobina', [(0, 0.546), (0.032, 0.546), (0.032, 0.553), (0.021, 0.561), (0, 0.563)], met, lados=10, centro=(0, yc, 0), veta=None))
    arco = [(0.033 * math.cos(a), yc - 0.033 * math.sin(a) * 1.15, 0.508 + 0.02 * math.sin(a)) for a in np.linspace(0, math.pi, 7)]
    pz.append(tubo('arco', arco, 0.0026, met, lados=4))
    pz.append(bloque('manivela', (0.008, 0.009, 0.06), met, centro=(0.039, yc, 0.44), bisel=0.002))
    pz.append(torno('perilla', [(0, 0), (0.009, 0), (0.011, 0.012), (0.009, 0.028), (0, 0.028)], M['fina'], lados=8,
                    centro=(0.043, yc, 0.414), rot=(0, math.pi / 2, 0)))
    return unir(pz, 'Prop_Cana', angulo=55)


def letrero(M, rnd, figuras):
    """Letrero de pesca: tabla turquesa con un pez naranja pintado en un poste de 1.8 m y, abajo,
    otra tabla con la cara para las runas del sitio (aparte)."""
    pz = []
    pz.append(P.poste('poste', 1.8, 0.065, M['madera'], lados=10, punta=0.9, chueco=0.015))
    zt, zb = 1.52, 1.13
    pz.append(P.tabla('tabla_pez', 1.0, 0.44, 0.05, M['letrero'], centro=(0, -0.09, zt), rot=(math.pi / 2, 0.035, 0), divisiones=2))
    pz.append(P.tabla('tabla_texto', 0.86, 0.2, 0.045, M['madera'], centro=(0, -0.09, zb), rot=(math.pi / 2, -0.03, 0), divisiones=1))
    cara = P.caja('Prop_LetreroPesca_Cara', (0.74, 0.012, 0.13), M['cara'], centro=(0, -0.1185, zb), rot=(0, -0.03, 0), chueco=0.001, bisel=0.004)
    for nombre, col, op in (('cuerpo', '#e2702a', 1.0), ('detalles', '#5e2410', 0.85), ('ojo', '#f1e8d2', 1.0), ('pupila', '#17161b', 1.0)):
        calca_eje(M['letrero'], figuras[nombre], centro=(0, zt), ancho=0.84, cara='-Y', color=col, gasto=0.25, rango=(-0.14, -0.1), opacidad=op)
    return unir(pz, 'Prop_LetreroPesca'), [cara]


# ---------------------------------------------------------------- atlas, UV de escritura y fotos

def encoger_islas(o, factor_de):
    """Achica en el atlas las islas que casi no se ven: `factor_de(normal_media, z_max, z_min)` da
    la escala de cada isla (1 = igual). Las islas se juntan por aristas con el mismo UV a los dos
    lados."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.active
    bm.faces.ensure_lookup_table()
    padre = list(range(len(bm.faces)))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i
    for e in bm.edges:
        if len(e.link_faces) != 2:
            continue
        f1, f2 = e.link_faces
        l1 = next(lp for lp in f1.loops if lp.edge == e)
        l2 = next(lp for lp in f2.loops if lp.edge == e)
        a1, b1 = l1[uvl].uv, l1.link_loop_next[uvl].uv
        a2, b2 = l2[uvl].uv, l2.link_loop_next[uvl].uv
        if (a1 - b2).length < 1e-5 and (b1 - a2).length < 1e-5:
            padre[raiz(f1.index)] = raiz(f2.index)
    islas = {}
    for f in bm.faces:
        islas.setdefault(raiz(f.index), []).append(f)
    for caras in islas.values():
        area = sum(f.calc_area() for f in caras) or 1e-9
        n = sum((f.normal * f.calc_area() for f in caras), Vector()) / area
        zs = [v.co.z for f in caras for v in f.verts]
        k = factor_de(n, max(zs), min(zs))
        if k == 1.0:
            continue
        lps = [lp for f in caras for lp in f.loops]
        c = sum((lp[uvl].uv for lp in lps), Vector((0, 0))) / len(lps)
        for lp in lps:
            lp[uvl].uv = c + (lp[uvl].uv - c) * k
    bm.to_mesh(me)
    bm.free()


def poco_visible(nombre):
    """Lo que mira hacia abajo (fondos, panza de la lancha, lo de abajo del techo y de la cubierta)
    y lo que queda bajo el agua en el muelle va con menos pixeles."""
    def f(n, zmax, zmin):
        if nombre == 'Prop_Muelle' and zmax < -0.25:
            return 0.35
        return 0.35 if n.z < -0.6 else 1.0
    return f


def densidad(objs, tam):
    """Pixeles por metro de cada prop en el atlas, y cuánto del atlas se usa."""
    total = 0.0
    for o in objs:
        me = o.data
        uv = me.uv_layers[0].data
        a3 = auv = 0.0
        for p in me.polygons:
            a3 += p.area
            pts = [uv[i].uv for i in p.loop_indices]
            auv += abs(sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts)))) / 2
        total += auv
        print(f'  {o.name:26s} {tam * math.sqrt(auv / a3):6.0f} px/m')
    print(f'  atlas usado: {total * 100:.0f} %')


def uv_atlas_pesos(objs, pesos, margen=0.0025):
    """Como P.uv_atlas, pero con más pixeles por metro para lo que pesa más (la caña, lo chico) y
    menos para lo que no se ve (encoger_islas)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in objs:
        s = pesos.get(o.name, 1.0)
        if s == 1.0:
            continue
        uv = o.data.uv_layers.active.data
        co = np.empty(len(uv) * 2, np.float32)
        uv.foreach_get('uv', co)
        uv.foreach_set('uv', co * s)
    for o in objs:
        encoger_islas(o, poco_visible(o.name))
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    try:
        bpy.ops.uv.select_all(action='SELECT')
    except RuntimeError:
        pass
    # el margen como fracción del atlas: con el de omisión ('SCALED') y ~2,600 islas los márgenes se
    # comían el atlas (8 % usado); así queda en ~42 %
    bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', margin=margen, margin_method='FRACTION', shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')


def uv_escritura(o):
    """Segundo UV (`Escritura`) de 0 a 1 vista de frente (-Y): donde el sitio escribe."""
    me = o.data
    atlas = me.uv_layers[0]
    uv = me.uv_layers.get('Escritura') or me.uv_layers.new(name='Escritura')
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    x0, x1 = co[:, 0].min(), co[:, 0].max()
    z0, z1 = co[:, 2].min(), co[:, 2].max()
    idx = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', idx)
    u = (co[idx, 0] - x0) / (x1 - x0)
    v = (co[idx, 2] - z0) / (z1 - z0)
    uv.data.foreach_set('uv', np.stack([u, v], 1).astype(np.float32).ravel())
    me.uv_layers.active = atlas
    atlas.active_render = True


def objetos():
    props = [bpy.data.objects[n] for n in PROPS]
    hijos = [bpy.data.objects[n] for lista in HIJOS.values() for n in lista]
    return props, hijos


def armar():
    P.limpiar()
    random.seed(SEMILLA)
    rnd = random.Random(SEMILLA)
    esten, _ = P.estencil_skulley()
    M = materiales()
    figuras = {k: imagen(f'Laguna_Pez_{k}', v) for k, v in dibujos_pez().items()}
    props, hijos = [], []
    props.append(muelle(M, rnd))
    o, h = puesto(M, rnd, figuras)
    props.append(o)
    hijos += [(o, x) for x in h]
    props.append(lancha(M, rnd))
    props.append(remo(M, rnd))
    props.append(cubeta(M, rnd))
    props.append(caja_carnada(M, rnd, esten))
    props.append(rack(M, rnd))
    props.append(cana(M, rnd))
    o, h = letrero(M, rnd, figuras)
    props.append(o)
    hijos += [(o, x) for x in h]
    for padre, hijo in hijos:
        hijo.data.name = hijo.name
        hijo.parent = padre
        hijo.matrix_parent_inverse = padre.matrix_world.inverted()
        bpy.context.view_layer.objects.active = hijo
        bpy.ops.object.select_all(action='DESELECT')
        hijo.select_set(True)
        if '_Neon_' in hijo.name:
            bpy.ops.object.shade_smooth()
        else:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    P.fila(props)
    bpy.data.objects['Prop_Muelle'].location.z = 0.0  # z = 0 es el agua
    todos = props + [x for _, x in hijos]
    uv_atlas_pesos(todos, PESOS)
    for _, x in hijos:
        if x.name in ESCRITURA:
            uv_escritura(x)
    densidad(todos, TAM)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    reporte(props)


def reporte(props):
    total = 0
    for o in props:
        objs = [o] + list(o.children)
        t = P.triangulos(objs)
        total += t
        xs = [(o.matrix_world @ Vector(c)) for c in o.bound_box]
        d = [max(p[i] for p in xs) - min(p[i] for p in xs) for i in range(3)]
        print(f'  {o.name:22s} {d[0]:5.2f} x {d[1]:5.2f} x {d[2]:5.2f} m  {t:6d} triángulos')
    print(f'  total {total} triángulos')


def pintar(tam=TAM, muestras=64):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = objetos()
    P.hornear_atlas(props + hijos, PNG, tam=tam, muestras=muestras)
    bpy.context.preferences.filepaths.save_version = 0  # sin respaldo .blend1 en el repo
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', PNG)


def _un_material(objs):
    for o in objs:
        n = len(o.data.polygons)
        o.data.polygons.foreach_set('material_index', np.zeros(n, np.int32))


def exportar():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = objetos()
    _un_material(props + hijos)
    peso = P.exportar_glb(props + hijos, PNG, GLB)
    print(f'exportado: {GLB} {peso} bytes')


def render(carpeta):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = objetos()
    todos = props + hijos
    _un_material(todos)
    m = P.material_final(PNG, 'props_laguna')
    for o in todos:
        o.data.materials.clear()
        o.data.materials.append(m)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('fondo')
    w.node_tree.nodes['Background'].inputs['Color'].default_value = P.srgb('#3a3f52')
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    sc.world = w
    sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
    sol.data.energy = 2.4
    sol.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.collection.objects.link(sol)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 50
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x = 1200
    sc.render.resolution_y = 900
    os.makedirs(carpeta, exist_ok=True)
    vfov = 2 * math.atan(18 / 50 * 900 / 1200)

    def foto(visibles, nombre, vistas=((-30, 22), (150, 22)), centro=None, radio=None):
        for o in todos:
            o.hide_render = o not in visibles
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in visibles for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        c = centro or (lo + hi) / 2
        r = radio or (hi - lo).length / 2
        rutas = []
        for i, (az, el) in enumerate(vistas):
            a, e = math.radians(az - 90), math.radians(el)
            d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
            cam.location = c + d * (r / math.sin(vfov / 2) * 0.85)
            cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
            cam.data.clip_end = 1000
            ruta = os.path.join(carpeta, f'{nombre}_{i}.png')
            sc.render.filepath = ruta
            bpy.ops.render.render(write_still=True)
            rutas.append(ruta)
        return rutas
    for o in props:
        foto([o] + list(o.children), o.name)
    c = bpy.data.objects['Prop_Cana']
    base = c.matrix_world.translation
    foto([c], 'Prop_Cana_carrete', vistas=((-35, 15), (60, 10)), centro=base + Vector((0, -0.05, 0.42)), radio=0.3)
    foto([c], 'Prop_Cana_punta', vistas=((-35, 10),), centro=base + Vector((0, -0.01, 2.0)), radio=0.45)
    foto(todos, 'laguna', vistas=((-25, 28),))
    # el puesto de cerca: el pez del mostrador y el letrero del techo, apagados y encendidos (la
    # emisión es solo para la foto: en el sitio los prende su material)
    pu = bpy.data.objects['Prop_PuestoArgus']
    b = pu.matrix_world.translation
    vis = [pu] + list(pu.children)
    foto(vis, 'Puesto_frente', vistas=((-12, 8), (-42, 14)), centro=b + Vector((0, -0.45, 0.5)), radio=0.5)
    foto(vis, 'Puesto_tablero', vistas=((-14, 8), (-62, 12), (200, 10)), centro=b + Vector((-2.0, -0.62, 1.85)), radio=0.75)
    foto(vis, 'Puesto_letrero', vistas=((-12, 10), (-50, 18), (160, 22)), centro=b + Vector((0, -0.62, 2.9)), radio=1.0)
    em = bpy.data.materials.new('neon_encendido')
    nt = em.node_tree
    nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = P.srgb('#ff8a48')
    e.inputs['Strength'].default_value = 5.0
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    for o in vis:
        if '_Neon_' in o.name:
            o.data.materials.clear()
            o.data.materials.append(em)
    foto(vis, 'Puesto_encendido', vistas=((-15, 12),), centro=b + Vector((0, -0.55, 1.6)), radio=1.75)
    foto(vis, 'Puesto_letrero_encendido', vistas=((-14, 10),), centro=b + Vector((0, -0.62, 2.9)), radio=1.0)
    foto(vis, 'Puesto_frente_encendido', vistas=((-14, 8),), centro=b + Vector((0, -0.45, 0.5)), radio=0.5)
    print('render:', carpeta)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    rapido = 'rapido' in args
    carpeta = next((a for a in args[1:] if a != 'rapido'), FOTOS)
    if cmd in ('armar', 'todo'):
        armar()
    if cmd in ('pintar', 'todo'):
        pintar(1024 if rapido else TAM, 16 if rapido else 64)
    if cmd in ('exportar', 'todo'):
        exportar()
    if cmd in ('render', 'todo'):
        render(carpeta)
