"""Prueba del estilo pintado a mano (Oscar, 2026-11-24; features.md, La ofrenda -> El estilo gráfico).

Un barril de madera con aros de metal: poca geometría con biseles grandes, formas
gorditas y nada perfectamente derecho, y una textura pintada que hace casi todo el
trabajo, con la referencia del aserradero de Oscar: pinceladas largas a lo largo de
cada tabla, líneas de veta y nudos, luz pintada arriba, una orilla clara marcada,
desportilladuras oscuras con el borde claro, escurrimientos bajo los aros, suciedad en
lo hondo, todo en acuarela (lavados de orilla suave con el pigmento juntado en la orilla,
variación cálida y fría y el grano del papel), metal gris pizarra con brillo limpio y el esténcil de la cabeza de Skulley
(public/grungeskullley.png, el dibujo de Oscar: las calaveras siempre con su forma). En el sitio va debajo del
toon (bandas y contorno de tinta medido en pantalla): src/components/estilo/PruebaEstilo.jsx.

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup         --python scripts/estilo/barril.py -- todo [natural|turquesa] [carpeta_renders]

  modelar   arma el barril y guarda Character/Estilo.blend
  pintar    compone la textura de cada variante y la hornea (Cycles) a Character/assets/
            (barril_pintado.png, barril_turquesa.png: los maestros, para retocar a mano)
  exportar  escribe public/3dmodels/estilo/barril.glb y barril_turquesa.glb (Draco, textura WebP)
  render    fotos de revisión con la textura (Eevee) en la carpeta que se le dé
  todo      los cuatro

Variantes: natural (madera) y turquesa (pintura gastada que deja ver la madera, como
el techo del aserradero). Sin variante, las dos. Si se retoca un PNG maestro a mano,
basta `exportar` (lee el PNG, no lo vuelve a hornear).
Medidas en metros, base en el piso (z = 0), centrado; el frente (el esténcil) mira a -Y.
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..'))
BLEND = os.path.join(REPO, 'Character', 'Estilo.blend')
ASSETS = os.path.join(REPO, 'Character', 'assets')
MODELOS = os.path.join(REPO, 'public', '3dmodels', 'estilo')
NOMBRE = 'Estilo_Barril'
TAM = 2048

# Forma: gordito, la panza más ancha que en uno de verdad.
ALTO = 1.05
R_PUNTA = 0.31
R_PANZA = 0.40
DUELAS = 14
GRUESO = 0.05
AROS = (0.1, 0.27, 0.73, 0.9)   # en fracción del alto (entre los de en medio va el esténcil)
ARO_ANCHO = 0.09
ARO_GRUESO = 0.03
TAPA_HONDA = 0.07               # cuánto queda hundida la tapa bajo el canto de las duelas
BISEL = 0.014

SEMILLA = 7


def srgb(h):
    """Hex sRGB -> RGBA lineal (lo que esperan los nodos)."""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, 1.0)


# Paleta (Oscar, 2026-11-24, con su referencia del aserradero pintado a mano: madera café
# apagada con orillas claras marcadas, metal gris pizarra con brillos limpios, pintura
# turquesa gastada que deja ver la madera)
MADERA = {'oscura': '#4a2f1f', 'media': '#6b4530', 'base': '#7f5538', 'clara': '#a3754c', 'luz': '#c49466',
          'linea': '#33200f', 'orilla': '#ecd0a0', 'astilla': '#2a1a0e', 'mugre': '#24170d',
          'calido': '#8e5034', 'frio': '#6b5e3e'}
METAL = {'oscuro': '#2c3139', 'base': '#454d5a', 'claro': '#6f7a8a', 'orilla': '#c9d2dc', 'oxido': '#5e3420'}
ESTENCIL = '#e9dcb8'
VARIANTES = {
    'natural': {'png': 'barril_pintado.png', 'glb': 'barril.glb', 'pintura': None},
    'turquesa': {'png': 'barril_turquesa.png', 'glb': 'barril_turquesa.glb',
                 'pintura': {'oscura': '#2c4a50', 'base': '#3d6870', 'clara': '#55858a', 'orilla': '#8fb8b2'}},
}
# El esténcil: la cabeza de Skulley en grunge que dibujó Oscar (blanco sobre transparente;
# la transparencia dice dónde cae la pintura). Las calaveras siempre con su forma.
GRUNGE = os.path.join(REPO, 'public', 'grungeskullley.png')


def radio(t):
    """Radio exterior del barril a la altura t (0 abajo, 1 arriba)."""
    return R_PUNTA + (R_PANZA - R_PUNTA) * (1 - (2 * t - 1) ** 2)


def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0  # sin respaldos .blend1 en el repo


def _objeto(nombre, bm):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def _material(nombre):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    m.use_nodes = True
    return m


def duela(i, rnd):
    """Una duela: tira curva con grueso, del ancho de su sector menos la junta."""
    paso = 2 * math.pi / DUELAS
    junta = 0.012
    a0 = i * paso + junta / R_PANZA + rnd.uniform(-0.01, 0.01)
    a1 = (i + 1) * paso - junta / R_PANZA + rnd.uniform(-0.01, 0.01)
    alto = ALTO + rnd.uniform(-0.02, 0.012)
    abajo = rnd.uniform(0, 0.012)
    dr = rnd.uniform(-0.008, 0.008)
    inclina = rnd.uniform(-0.012, 0.012)
    filas, cols = 7, 2
    bm = bmesh.new()
    afuera, adentro = [], []
    for f in range(filas + 1):
        t = f / filas
        z = abajo + (alto - abajo) * t
        r = radio(t) + dr
        fila_a, fila_d = [], []
        for c in range(cols + 1):
            a = a0 + (a1 - a0) * c / cols + inclina * (t - 0.5)
            # un poco de chueco a mano
            w = noise.noise(Vector((math.cos(a) * 2.3, math.sin(a) * 2.3, z * 3.1 + i))) * 0.006
            fila_a.append(bm.verts.new((math.cos(a) * (r + w), math.sin(a) * (r + w), z)))
            fila_d.append(bm.verts.new((math.cos(a) * (r - GRUESO), math.sin(a) * (r - GRUESO), z)))
        afuera.append(fila_a)
        adentro.append(fila_d)
    for f in range(filas):
        for c in range(cols):
            bm.faces.new((afuera[f][c], afuera[f][c + 1], afuera[f + 1][c + 1], afuera[f + 1][c]))
            bm.faces.new((adentro[f][c + 1], adentro[f][c], adentro[f + 1][c], adentro[f + 1][c + 1]))
    for f in range(filas):  # cantos de los lados
        bm.faces.new((afuera[f][0], afuera[f + 1][0], adentro[f + 1][0], adentro[f][0]))
        bm.faces.new((afuera[f + 1][cols], afuera[f][cols], adentro[f][cols], adentro[f + 1][cols]))
    for c in range(cols):  # canto de arriba y de abajo
        bm.faces.new((afuera[filas][c], afuera[filas][c + 1], adentro[filas][c + 1], adentro[filas][c]))
        bm.faces.new((afuera[0][c + 1], afuera[0][c], adentro[0][c], adentro[0][c + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _objeto(f'duela_{i}', bm)
    o.data.materials.append(_material('Barril_Madera'))
    return o


def aro(t, rnd, k):
    """Un aro: banda que sigue el perfil, un poco más afuera que las duelas."""
    n = 36
    bm = bmesh.new()
    z0 = ALTO * t - ARO_ANCHO / 2
    z1 = ALTO * t + ARO_ANCHO / 2
    filas = []
    for z, extra in ((z0, 0.0), (z0, ARO_GRUESO), (z1, ARO_GRUESO), (z1, 0.0)):
        r = radio(z / ALTO) + 0.006 + extra
        fila = []
        for j in range(n):
            a = 2 * math.pi * j / n
            r2 = r + noise.noise(Vector((math.cos(a) * 1.7, math.sin(a) * 1.7, k * 4.0))) * 0.004
            fila.append(bm.verts.new((math.cos(a) * r2, math.sin(a) * r2, z + rnd.uniform(-0.002, 0.002))))
        filas.append(fila)
    for f in range(4):
        g = (f + 1) % 4
        for j in range(n):
            jj = (j + 1) % n
            bm.faces.new((filas[f][j], filas[f][jj], filas[g][jj], filas[g][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _objeto(f'aro_{k}', bm)
    o.data.materials.append(_material('Barril_Metal'))
    # remaches
    piezas = [o]
    for j in range(6):
        a = 2 * math.pi * (j + 0.5 * (k % 2)) / 6 + 0.2
        r = radio(t) + 0.006 + ARO_GRUESO
        bmr = bmesh.new()
        bmesh.ops.create_uvsphere(bmr, u_segments=6, v_segments=4, radius=0.017)
        for v in bmr.verts:
            v.co.x *= 0.55
        bmesh.ops.rotate(bmr, verts=bmr.verts, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(a, 3, 'Z'))
        bmesh.ops.translate(bmr, verts=bmr.verts, vec=(math.cos(a) * r, math.sin(a) * r, ALTO * t))
        rem = _objeto(f'remache_{k}_{j}', bmr)
        rem.data.materials.append(_material('Barril_Metal'))
        piezas.append(rem)
    return piezas


def tapa(rnd):
    """Las dos tapas, arriba y abajo: cuatro tablones hundidos bajo el canto de las duelas
    (acostado, el barril enseña la de abajo)."""
    r = radio(1 - TAPA_HONDA / ALTO) - GRUESO + 0.004
    piezas = []
    n = 4
    ancho = 2 * r / n
    for lado, z in (('arriba', ALTO - TAPA_HONDA), ('abajo', TAPA_HONDA - 0.035)):
        for k in range(n):
            x0 = -r + k * ancho + 0.006
            x1 = -r + (k + 1) * ancho - 0.006
            # contorno del tablón: el rectángulo recortado al círculo
            pts = []
            for s in range(9):
                x = x0 + (x1 - x0) * s / 8
                pts.append((x, math.sqrt(max(r * r - x * x, 1e-6))))
            for s in range(9):
                x = x1 - (x1 - x0) * s / 8
                pts.append((x, -math.sqrt(max(r * r - x * x, 1e-6))))
            bm = bmesh.new()
            dz = rnd.uniform(-0.006, 0.006)
            arriba = [bm.verts.new((x, y, z + 0.035 + dz)) for x, y in pts]
            abajo = [bm.verts.new((x, y, z + dz)) for x, y in pts]
            bm.faces.new(arriba)
            bm.faces.new(list(reversed(abajo)))
            m = len(pts)
            for i in range(m):
                j = (i + 1) % m
                bm.faces.new((abajo[i], abajo[j], arriba[j], arriba[i]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            o = _objeto(f'tablon_{lado}_{k}', bm)
            o.data.materials.append(_material('Barril_Madera'))
            piezas.append(o)
    return piezas


def modelar():
    limpiar()
    rnd = random.Random(SEMILLA)
    piezas = [duela(i, rnd) for i in range(DUELAS)]
    for k, t in enumerate(AROS):
        piezas += aro(t, rnd, k)
    piezas += tapa(rnd)
    # biseles en cada pieza (antes de unir: así cada duela conserva sus orillas)
    for o in piezas:
        bpy.context.view_layer.objects.active = o
        b = o.modifiers.new('bisel', 'BEVEL')
        b.width = BISEL if not o.name.startswith('remache') else 0.003
        b.segments = 2
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(40)
        b.harden_normals = True
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.ops.object.modifier_apply(modifier='bisel')
    bpy.ops.object.select_all(action='DESELECT')
    for o in piezas:
        o.select_set(True)
    bpy.context.view_layer.objects.active = piezas[0]
    bpy.ops.object.join()
    barril = bpy.context.view_layer.objects.active
    barril.name = NOMBRE
    barril.data.name = NOMBRE
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    # UV: una sola imagen para todo
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=0.004)
    # acomodar mejor las piezas en la imagen (más pixeles por pieza)
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin=0.003, shape_method='CONCAVE')
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    me = barril.data
    print(f'modelado: {len(me.vertices)} vértices, {len(me.polygons)} caras')


# ---------------------------------------------------------------- la textura pintada

class Nodos:
    def __init__(self, mat):
        self.nt = mat.node_tree
        self.nt.nodes.clear()
        self.x = 0

    def n(self, tipo, **props):
        nodo = self.nt.nodes.new(tipo)
        nodo.location = (self.x, 0)
        self.x += 180
        for k, v in props.items():
            setattr(nodo, k, v)
        return nodo

    def l(self, a, b):
        self.nt.links.new(a, b)

    def val(self, op, a, b=None, c=None):
        m = self.n('ShaderNodeMath', operation=op)
        for i, x in enumerate((a, b, c)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                m.inputs[i].default_value = x
            else:
                self.l(x, m.inputs[i])
        return m.outputs[0]

    def rampa(self, entrada, paradas, constante=True):
        r = self.n('ShaderNodeValToRGB')
        r.color_ramp.interpolation = 'CONSTANT' if constante else 'LINEAR'
        els = r.color_ramp.elements
        while len(els) > 1:
            els.remove(els[-1])
        for i, (pos, col) in enumerate(paradas):
            e = els[0] if i == 0 else els.new(pos)
            e.position = pos
            e.color = srgb(col) if isinstance(col, str) else col
        self.l(entrada, r.inputs['Fac'])
        return r.outputs['Color']

    def mezcla(self, fac, a, b, modo='MIX'):
        m = self.n('ShaderNodeMix', data_type='RGBA', blend_type=modo)
        f = m.inputs['Factor']
        if isinstance(fac, (int, float)):
            f.default_value = fac
        else:
            self.l(fac, f)
        ins = [s for s in m.inputs if s.type == 'RGBA']
        for s, x in zip(ins, (a, b)):
            if isinstance(x, str):
                s.default_value = srgb(x)
            elif isinstance(x, tuple):
                s.default_value = x
            else:
                self.l(x, s)
        return [s for s in m.outputs if s.type == 'RGBA'][0]

    def ruido(self, vector, escala, detalle=2.0, rugosidad=0.5, distorsion=0.0):
        t = self.n('ShaderNodeTexNoise')
        t.inputs['Scale'].default_value = escala
        t.inputs['Detail'].default_value = detalle
        t.inputs['Roughness'].default_value = rugosidad
        t.inputs['Distortion'].default_value = distorsion
        if vector is not None:
            self.l(vector, t.inputs['Vector'])
        return t.outputs['Fac']

    def celdas(self, vector, escala, aleatorio=1.0, metrica='CHEBYCHEV'):
        t = self.n('ShaderNodeTexVoronoi', feature='F1', distance=metrica)
        t.inputs['Scale'].default_value = escala
        t.inputs['Randomness'].default_value = aleatorio
        if vector is not None:
            self.l(vector, t.inputs['Vector'])
        return t


def estencil_skulley():
    """El esténcil de la cabeza de Skulley (public/grungeskullley.png, de Oscar). Devuelve la
    imagen y su proporción ancho / alto."""
    img = bpy.data.images.load(GRUNGE, check_existing=True)
    img.pack()
    w, h = img.size
    return img, w / h


# ---------------------------------------------------------------- acuarela
# (Oscar, 2026-11-24: "un feeling más acuareloso"). Cada capa es un lavado de orilla suave
# con el pigmento acumulado en la orilla (más oscuro justo donde termina), las capas se
# enciman transparentes, el color varía entre cálido y frío, y encima va el grano del papel.

def suave(N, x, a, b):
    """0 antes de `a`, 1 después de `b`, con curva suave en medio."""
    m = N.n('ShaderNodeMapRange', data_type='FLOAT', interpolation_type='SMOOTHSTEP', clamp=True)
    N.l(x, m.inputs['Value'])
    m.inputs['From Min'].default_value = a
    m.inputs['From Max'].default_value = b
    m.inputs['To Min'].default_value = 0.0
    m.inputs['To Max'].default_value = 1.0
    return m.outputs['Result']


def lavado(N, col, campo, umbral, ancho, color, opacidad, borde=0.3, oscuro=0.7, invertido=False):
    """Un lavado donde `campo` pasa de `umbral` (o no llega, con `invertido`), con la orilla
    suave de `ancho` y el pigmento acumulado en la orilla: `borde` es cuánto se nota y
    `oscuro` qué tanto se oscurece el color ahí."""
    lleno = suave(N, campo, umbral - ancho, umbral + ancho)
    if invertido:
        lleno = N.val('SUBTRACT', 1.0, lleno)
    col = N.mezcla(N.val('MULTIPLY', lleno, opacidad), col, color)
    if borde > 0:
        dist = N.val('ABSOLUTE', N.val('SUBTRACT', campo, umbral))
        orilla = N.val('SUBTRACT', 1.0, suave(N, dist, 0.0, ancho * 0.7))
        c = srgb(color)
        oscuro_c = (c[0] * oscuro, c[1] * oscuro, c[2] * oscuro, 1.0)
        col = N.mezcla(N.val('MULTIPLY', orilla, borde), col, oscuro_c)
    return col


def grano(N, col, pos, fuerza=0.12):
    """El grano del papel: un ruido fino que oscurece y aclara tantito, y fibras."""
    g = N.ruido(pos, 340.0, detalle=1.0, rugosidad=0.5)
    f = N.n('ShaderNodeMapRange', data_type='FLOAT', clamp=True)
    N.l(g, f.inputs['Value'])
    f.inputs['From Min'].default_value = 0.3
    f.inputs['From Max'].default_value = 0.7
    f.inputs['To Min'].default_value = 1.0 - fuerza
    f.inputs['To Max'].default_value = 1.0 + fuerza * 0.4
    tono = N.n('ShaderNodeCombineColor')
    for i in range(3):
        N.l(f.outputs['Result'], tono.inputs[i])
    col = N.mezcla(1.0, col, tono.outputs[0], 'MULTIPLY')
    fibra = N.celdas(pos, 120.0, metrica='EUCLIDEAN')
    fino = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, suave(N, fibra.outputs['Distance'], 0.0, 0.06)), fuerza * 0.6)
    return N.mezcla(fino, col, (0.0, 0.0, 0.0, 1.0))


def deformado(N, pos, escala=6.0, fuerza=0.06):
    """La posición corrida con ruido: las manchas salen orgánicas, como agua que se corrió."""
    r = N.n('ShaderNodeTexNoise')
    r.inputs['Scale'].default_value = escala
    r.inputs['Detail'].default_value = 2.0
    N.l(pos, r.inputs['Vector'])
    c = N.n('ShaderNodeVectorMath', operation='SUBTRACT')
    N.l(r.outputs['Color'], c.inputs[0])
    c.inputs[1].default_value = (0.5, 0.5, 0.5)
    s = N.n('ShaderNodeVectorMath', operation='SCALE')
    N.l(c.outputs[0], s.inputs[0])
    s.inputs['Scale'].default_value = fuerza
    a = N.n('ShaderNodeVectorMath', operation='ADD')
    N.l(pos, a.inputs[0])
    N.l(s.outputs[0], a.inputs[1])
    return a.outputs[0]


def _orilla_bisel(N, geo, radio, muestras=12):
    b = N.n('ShaderNodeBevel', samples=muestras)
    b.inputs['Radius'].default_value = radio
    d = N.n('ShaderNodeVectorMath', operation='DOT_PRODUCT')
    N.l(b.outputs['Normal'], d.inputs[0])
    N.l(geo.outputs['Normal'], d.inputs[1])
    return N.val('SUBTRACT', 1.0, d.outputs['Value'])


def nodos_madera(mat, imagen, esten, aspecto, pintura=None):
    """Madera en acuarela: lavados grandes, pinceladas largas a lo largo de cada tabla, vetas
    suaves, nudos, variación cálida y fría, luz pintada arriba, escurrimientos bajo los aros,
    desportilladuras suaves, la orilla clara como pincel seco, suciedad en lo hondo y el
    grano del papel. Con `pintura`, un lavado de color encima que se cae en las orillas y
    deja ver la madera, con el pigmento juntado en su orilla."""
    N = Nodos(mat)
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    pos = tc.outputs['Object']
    sep = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sep.inputs[0])
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(geo.outputs['True Normal'], sn.inputs[0])
    nz = sn.outputs['Z']
    altura = N.val('DIVIDE', sep.outputs['Z'], ALTO)
    # coordenadas de la veta: en las duelas a lo alto (z), en las tapas a lo largo de los tablones (y)
    ang = N.val('MULTIPLY', N.val('ARCTAN2', sep.outputs['Y'], sep.outputs['X']), R_PANZA)
    tapa = N.val('GREATER_THAN', N.val('ABSOLUTE', nz), 0.6)
    a_traves = N.val('ADD', ang, N.val('MULTIPLY', tapa, N.val('SUBTRACT', sep.outputs['X'], ang)))
    a_lo_largo = N.val('ADD', sep.outputs['Z'], N.val('MULTIPLY', tapa, N.val('SUBTRACT', sep.outputs['Y'], sep.outputs['Z'])))
    veta = N.n('ShaderNodeCombineXYZ')
    N.l(a_traves, veta.inputs[0])
    N.l(a_lo_largo, veta.inputs[1])
    isla = geo.outputs['Random Per Island']
    N.l(isla, veta.inputs[2])
    g = veta.outputs[0]

    def estirado(escala_x, escala_y, escala_z=3.0):
        m = N.n('ShaderNodeVectorMath', operation='MULTIPLY')
        N.l(g, m.inputs[0])
        m.inputs[1].default_value = (escala_x, escala_y, escala_z)
        return m.outputs[0]

    col = N.rampa(isla, [(0.0, MADERA['media']), (0.5, MADERA['base'])], constante=False)
    # 1. lavados grandes que se funden: claros y oscuros
    grande = N.ruido(pos, 2.6, detalle=3.0, rugosidad=0.6, distorsion=1.8)
    col = lavado(N, col, grande, 0.56, 0.08, MADERA['clara'], 0.55, borde=0.35)
    col = lavado(N, col, grande, 0.42, 0.07, MADERA['oscura'], 0.45, borde=0.3, invertido=True)
    # 2. variación cálida y fría
    tinte = N.ruido(pos, 1.4, detalle=1.0, distorsion=1.0)
    col = lavado(N, col, tinte, 0.6, 0.12, MADERA['calido'], 0.22, borde=0.0)
    col = lavado(N, col, tinte, 0.4, 0.12, MADERA['frio'], 0.18, borde=0.0, invertido=True)
    # 3. pinceladas largas a lo largo de cada tabla, con el pigmento en su orilla
    trazos = N.ruido(estirado(30, 1.4), 1.0, detalle=2.0, rugosidad=0.55, distorsion=1.2)
    col = lavado(N, col, trazos, 0.4, 0.05, MADERA['oscura'], 0.55, borde=0.45, invertido=True)
    col = lavado(N, col, trazos, 0.62, 0.05, MADERA['clara'], 0.5, borde=0.25)
    # 4. vetas suaves, de opacidad que varía
    ola = N.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='X', wave_profile='SIN')
    ola.inputs['Scale'].default_value = 9.0
    ola.inputs['Distortion'].default_value = 5.0
    ola.inputs['Detail'].default_value = 1.5
    N.l(estirado(1.0, 0.18), ola.inputs['Vector'])
    linea = N.val('SUBTRACT', 1.0, suave(N, ola.outputs['Fac'], 0.04, 0.16))
    varia = suave(N, N.ruido(estirado(4, 0.6), 1.0, detalle=1.0), 0.3, 0.7)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', linea, varia), 0.6), col, MADERA['linea'])
    # 5. nudos: pocos, ovalados, con el anillo claro y el pigmento juntado en el centro
    nudo = N.celdas(estirado(5, 1.6), 1.0, metrica='EUCLIDEAN')
    sc = N.n('ShaderNodeSeparateColor')
    N.l(nudo.outputs['Color'], sc.inputs[0])
    hay = N.val('GREATER_THAN', sc.outputs[0], 0.86)
    d_nudo = N.val('ADD', nudo.outputs['Distance'], N.val('SUBTRACT', 1.0, hay))
    col = lavado(N, col, d_nudo, 0.16, 0.03, MADERA['clara'], 0.6, borde=0.0, invertido=True)
    col = lavado(N, col, d_nudo, 0.09, 0.025, MADERA['linea'], 0.8, borde=0.5, invertido=True)
    # 6. la luz pintada: abajo más oscuro, la cara de arriba más clara
    deg = N.rampa(altura, [(0.0, (0.62, 0.6, 0.6, 1)), (0.3, (0.84, 0.82, 0.82, 1)), (0.65, (1, 1, 1, 1))], constante=False)
    col = N.mezcla(1.0, col, deg, 'MULTIPLY')
    col = N.mezcla(N.val('MULTIPLY', suave(N, nz, 0.4, 0.8), 0.4), col, MADERA['luz'])
    # 7. escurrimientos bajo los aros, como agua sucia que corrió
    bajo = None
    for t in AROS:
        d = N.val('SUBTRACT', t - ARO_ANCHO / ALTO / 2, altura)
        banda = N.val('MULTIPLY', suave(N, d, -0.01, 0.01), N.val('SUBTRACT', 1.0, suave(N, d, 0.06, 0.16)))
        bajo = banda if bajo is None else N.val('MAXIMUM', bajo, banda)
    chorro = N.val('MULTIPLY', bajo, N.ruido(estirado(48, 0.9), 1.0, detalle=1.0))
    col = lavado(N, col, chorro, 0.5, 0.06, MADERA['mugre'], 0.45, borde=0.3)
    # 8. desportilladuras suaves en las orillas, con un halo claro
    cerca = suave(N, _orilla_bisel(N, geo, 0.03, 16), 0.015, 0.05)
    astilla = N.celdas(deformado(N, pos, 9.0, 0.05), 17.0, metrica='EUCLIDEAN')
    d_ast = N.val('ADD', astilla.outputs['Distance'], N.val('SUBTRACT', 1.0, cerca))
    col = lavado(N, col, d_ast, 0.32, 0.05, MADERA['orilla'], 0.55, borde=0.0, invertido=True)
    col = lavado(N, col, d_ast, 0.2, 0.04, MADERA['astilla'], 0.75, borde=0.4, invertido=True)
    # 9. la orilla clara como pincel seco: ancha, suave y dispareja
    fina = suave(N, _orilla_bisel(N, geo, 0.012), 0.01, 0.04)
    seco = suave(N, N.ruido(estirado(60, 3.0), 1.0, detalle=2.0), 0.35, 0.65)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', fina, seco), 0.85), col, MADERA['orilla'])
    # 10. suciedad en lo hondo
    ao = N.n('ShaderNodeAmbientOcclusion', samples=32)
    ao.inputs['Distance'].default_value = 0.08
    sucio = N.val('ADD', ao.outputs['AO'], N.val('MULTIPLY', N.ruido(pos, 12.0, distorsion=1.0), 0.25))
    col = lavado(N, col, sucio, 0.62, 0.08, MADERA['mugre'], 0.6, borde=0.3, invertido=True)
    madera = col
    if pintura:
        p = N.rampa(isla, [(0.0, pintura['oscura']), (0.5, pintura['base'])], constante=False)
        p = lavado(N, p, grande, 0.55, 0.08, pintura['clara'], 0.55, borde=0.3)
        p = lavado(N, p, trazos, 0.4, 0.05, pintura['oscura'], 0.45, borde=0.35, invertido=True)
        p = N.mezcla(1.0, p, deg, 'MULTIPLY')
        p = N.mezcla(N.val('MULTIPLY', suave(N, nz, 0.4, 0.8), 0.3), p, pintura['clara'])
        gotea = N.ruido(estirado(46, 1.2), 1.0, detalle=1.0)
        p = lavado(N, p, gotea, 0.62, 0.05, pintura['oscura'], 0.45, borde=0.3)
        p = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', fina, seco), 0.7), p, pintura['orilla'])
        p = lavado(N, p, sucio, 0.6, 0.08, MADERA['mugre'], 0.5, borde=0.2, invertido=True)
        # dónde se cayó: en las orillas y en manchas; en el filo de lo que queda se junta el pigmento
        ancha = suave(N, _orilla_bisel(N, geo, 0.05, 16), 0.01, 0.04)
        cae = N.celdas(deformado(N, pos, 7.0, 0.07), 11.0, metrica='EUCLIDEAN')
        d_cae = N.val('ADD', cae.outputs['Distance'], N.val('SUBTRACT', 1.0, ancha))
        sueltas = N.val('ADD', N.celdas(deformado(N, pos, 5.0, 0.08), 6.0, metrica='EUCLIDEAN').outputs['Distance'], N.val('MULTIPLY', N.ruido(pos, 9.0), 0.3))
        sin = N.val('MINIMUM', N.val('DIVIDE', d_cae, 0.42), N.val('DIVIDE', sueltas, 0.3))
        queda = suave(N, sin, 0.92, 1.06)
        filo = N.val('SUBTRACT', 1.0, suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', sin, 1.0)), 0.0, 0.12))
        c = srgb(pintura['oscura'])
        p = N.mezcla(N.val('MULTIPLY', filo, 0.6), p, (c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 1))
        col = N.mezcla(queda, madera, p)
    # el esténcil de Skulley al frente (-Y), entre los aros de en medio: pintura clara y aguada
    alto_e = 0.42
    ancho = alto_e * aspecto
    u = N.val('ADD', N.val('DIVIDE', sep.outputs['X'], ancho), 0.5)
    v = N.val('DIVIDE', N.val('SUBTRACT', sep.outputs['Z'], ALTO * 0.5 - alto_e / 2), alto_e)
    uv = N.n('ShaderNodeCombineXYZ')
    N.l(u, uv.inputs[0])
    N.l(v, uv.inputs[1])
    tex = N.n('ShaderNodeTexImage', image=esten, extension='CLIP', interpolation='Cubic')
    N.l(uv.outputs[0], tex.inputs['Vector'])
    # solo la cara de afuera de la mitad de enfrente (por dentro, las duelas de atrás también miran a -Y)
    frente = N.val('MULTIPLY', suave(N, N.val('MULTIPLY', sn.outputs['Y'], -1.0), 0.25, 0.45), suave(N, N.val('MULTIPLY', sep.outputs['Y'], -1.0), 0.15, 0.25))
    aguada = N.val('ADD', 0.72, N.val('MULTIPLY', N.ruido(pos, 7.0, detalle=2.0), 0.3))
    alfa = N.val('MULTIPLY', tex.outputs['Alpha'], frente)
    col = N.mezcla(N.val('MULTIPLY', alfa, aguada), col, ESTENCIL)
    orilla_e = N.val('SUBTRACT', 1.0, suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', tex.outputs['Alpha'], 0.5)), 0.0, 0.45))
    e = srgb(ESTENCIL)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', orilla_e, frente), 0.35), col, (e[0] * 0.75, e[1] * 0.72, e[2] * 0.66, 1))
    col = grano(N, col, pos, 0.12)
    _salida(N, col, imagen)


def nodos_metal(mat, imagen):
    """Metal gris pizarra en acuarela: lavados que se funden, oscuro abajo, la cara de arriba
    más clara, brillo suave en la orilla, un poco de óxido que se corre y el grano del papel."""
    N = Nodos(mat)
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    pos = tc.outputs['Object']
    sep = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sep.inputs[0])
    altura = N.val('DIVIDE', sep.outputs['Z'], ALTO)
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(geo.outputs['True Normal'], sn.inputs[0])
    m = N.n('ShaderNodeVectorMath', operation='MULTIPLY')
    N.l(pos, m.inputs[0])
    m.inputs[1].default_value = (10.0, 10.0, 26.0)
    campo = N.ruido(m.outputs[0], 1.0, detalle=2.0, rugosidad=0.6, distorsion=1.4)
    col = N.rampa(campo, [(0.0, METAL['base']), (1.0, METAL['base'])], constante=False)
    col = lavado(N, col, campo, 0.42, 0.07, METAL['oscuro'], 0.6, borde=0.35, invertido=True)
    col = lavado(N, col, campo, 0.6, 0.07, METAL['claro'], 0.45, borde=0.2)
    deg = N.rampa(altura, [(0.0, (0.72, 0.72, 0.74, 1)), (0.5, (1, 1, 1, 1))], constante=False)
    col = N.mezcla(1.0, col, deg, 'MULTIPLY')
    col = N.mezcla(N.val('MULTIPLY', suave(N, sn.outputs['Z'], 0.3, 0.7), 0.45), col, METAL['claro'])
    # óxido aguado, más abajo, que se corre hacia abajo
    o = N.n('ShaderNodeVectorMath', operation='MULTIPLY')
    N.l(pos, o.inputs[0])
    o.inputs[1].default_value = (9.0, 9.0, 3.0)
    oxido = N.val('ADD', N.ruido(o.outputs[0], 1.0, detalle=2.0, distorsion=1.5), N.val('MULTIPLY', altura, 0.6))
    col = lavado(N, col, oxido, 0.62, 0.06, METAL['oxido'], 0.55, borde=0.4, invertido=True)
    # brillo suave en la orilla, disparejo
    b = suave(N, _orilla_bisel(N, geo, 0.008), 0.01, 0.035)
    seco = suave(N, N.ruido(pos, 22.0, detalle=2.0), 0.35, 0.65)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', b, seco), 0.85), col, METAL['orilla'])
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.05
    col = lavado(N, col, ao.outputs['AO'], 0.55, 0.08, METAL['oscuro'], 0.6, borde=0.2, invertido=True)
    col = grano(N, col, pos, 0.12)
    _salida(N, col, imagen)


def _salida(N, color, imagen):
    em = N.n('ShaderNodeEmission')
    N.l(color, em.inputs['Color'])
    out = N.n('ShaderNodeOutputMaterial')
    N.l(em.outputs[0], out.inputs['Surface'])
    tex = N.n('ShaderNodeTexImage', image=imagen)
    N.nt.nodes.active = tex
    tex.select = True


def pintar(variante='natural'):
    bpy.context.preferences.filepaths.save_version = 0
    cfg = VARIANTES[variante]
    png = os.path.join(ASSETS, cfg['png'])
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    barril = bpy.data.objects[NOMBRE]
    nombre = f'Barril_{variante}'
    img = bpy.data.images.get(nombre) or bpy.data.images.new(nombre, TAM, TAM, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    esten, aspecto = estencil_skulley()
    nodos_madera(bpy.data.materials['Barril_Madera'], img, esten, aspecto, cfg['pintura'])
    nodos_metal(bpy.data.materials['Barril_Metal'], img)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 64
    sc.cycles.device = 'CPU'
    bpy.ops.object.select_all(action='DESELECT')
    barril.select_set(True)
    bpy.context.view_layer.objects.active = barril
    bpy.ops.object.bake(type='EMIT', margin=16, use_clear=True)
    os.makedirs(ASSETS, exist_ok=True)
    img.filepath_raw = png
    img.file_format = 'PNG'
    img.save()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', png)


def _material_final(variante):
    """Un solo material con el PNG maestro de la variante (lo que viaja en el GLB)."""
    png = os.path.join(ASSETS, VARIANTES[variante]['png'])
    img = bpy.data.images.load(png, check_existing=False)
    img.name = f'Barril_{variante}_final'
    m = bpy.data.materials.new(f'Barril_{variante}')
    nt = m.node_tree
    nt.nodes.clear()
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.9
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    return m


def exportar(variante='natural'):
    glb = os.path.join(MODELOS, VARIANTES[variante]['glb'])
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    barril = bpy.data.objects[NOMBRE]
    m = _material_final(variante)
    barril.data.materials.clear()
    barril.data.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT')
    barril.select_set(True)
    bpy.context.view_layer.objects.active = barril
    os.makedirs(MODELOS, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_image_format='WEBP', export_image_quality=88, export_materials='EXPORT',
        export_yup=True,
    )
    print('exportado:', glb, os.path.getsize(glb), 'bytes')


def render(carpeta, variante='natural'):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    barril = bpy.data.objects[NOMBRE]
    m = _material_final(variante)
    barril.data.materials.clear()
    barril.data.materials.append(m)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = 900
    sc.render.resolution_y = 1100
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('fondo')
    w.node_tree.nodes['Background'].inputs['Color'].default_value = srgb('#3a3f52')
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    sc.world = w
    sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
    sol.data.energy = 2.2
    sol.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.collection.objects.link(sol)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 60
    sc.collection.objects.link(cam)
    sc.camera = cam
    os.makedirs(carpeta, exist_ok=True)
    for i, ang in enumerate((-20, 150)):
        a = math.radians(ang - 90)
        cam.location = (math.cos(a) * 3.4, math.sin(a) * 3.4, 1.55)
        d = Vector((0, 0, 0.5)) - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(carpeta, f'barril_{variante}_{i}.png')
        bpy.ops.render.render(write_still=True)
    print('render:', carpeta)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    extra = args[1:]
    variantes = [a for a in extra if a in VARIANTES] or list(VARIANTES)
    carpeta = next((a for a in extra if a not in VARIANTES), os.path.join(REPO, 'scripts', 'estilo', 'renders'))
    if cmd in ('modelar', 'todo'):
        modelar()
    for v in variantes:
        if cmd in ('pintar', 'todo'):
            pintar(v)
        if cmd in ('exportar', 'todo'):
            exportar(v)
        if cmd in ('render', 'todo'):
            render(carpeta, v)
