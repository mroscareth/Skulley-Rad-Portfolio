"""Pintura a mano en acuarela para los props del bosque (Oscar, 2026-11-24; features.md, La
ofrenda -> El estilo gráfico). Lo comparten todos los scripts de props (scripts/estilo/props_*.py);
la prueba fue scripts/estilo/barril.py.

Cómo se ve: poca geometría con biseles grandes, formas gorditas, y una textura horneada que hace
casi todo: lavados de orilla suave con el pigmento juntado en la orilla, variación cálida y fría,
pinceladas largas a lo largo de cada tabla, vetas, nudos, luz pintada arriba, desportilladuras
orgánicas con el borde claro, orilla clara como pincel seco, suciedad en lo hondo y el grano del
papel. En el sitio va debajo de las bandas toon y el contorno de tinta (src/lib/pintado.js).

Uso desde un script de props (se corre con Blender en segundo plano):

    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import pintura as P

    P.limpiar()
    madera = P.material_madera('Laguna_Madera')                 # vetas a lo largo de cada pieza
    pintada = P.material_madera('Laguna_Turquesa', pintura=P.PINTURAS['turquesa'])
    metal = P.material_metal('Laguna_Metal')
    piedra = P.material_piedra('Laguna_Piedra')
    concreto = P.material_concreto('Estudio_Concreto')          # cimbra, moños, escurrimientos
    tela = P.material_liso('Laguna_Lona', '#c9b48a')            # tela, plástico, pintura lisa
    t = P.tabla('tabla', 2.0, 0.25, 0.05, madera, centro=(0, 0, 0.5), rot=(0, 0, 0.1))
    p = P.poste('poste', 1.2, 0.08, madera, centro=(1, 0, 0))
    prop = P.unir([t, p], 'Prop_Banca')                         # un objeto por prop
    ...
    P.uv_atlas(props)                                           # todas las piezas en una imagen
    P.hornear_atlas(props, png, tam=2048)                       # Cycles; ~1 a 2 min
    P.exportar_glb(props, png, glb)                             # GLB con Draco y textura WebP
    P.render_revision(props, carpeta, 'laguna')                 # fotos para revisar

Reglas:
- Toda pieza de madera necesita el atributo `Veta` (lo ponen tabla(), poste(), caja() y, para
  mallas propias, poner_veta(obj, eje)): x = a lo ancho, y = a lo largo de la veta, z = un azar por
  pieza. Así las pinceladas siguen cada tabla aunque esté girada.
- Toda pieza de concreto necesita el atributo `Concreto` (poner_concreto(obj), antes de biselar):
  de su orilla de arriba bajan los escurrimientos.
- Biseles antes de unir (tabla(), poste() y caja() ya los ponen; biselar() para lo demás).
- Medidas en metros, base en el piso (z = 0), el frente hacia -Y de Blender (en el sitio +z).
- Las calaveras siempre con la forma de Skulley: estencil_skulley() (public/grungeskullley.png).
"""
import math
import os
import random

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector, noise

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..'))
GRUNGE = os.path.join(REPO, 'public', 'grungeskullley.png')


def srgb(h):
    """Hex sRGB -> RGBA lineal (lo que esperan los nodos)."""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, 1.0)


# Paletas (del aserradero de la referencia de Oscar)
MADERA = {'oscura': '#4a2f1f', 'media': '#6b4530', 'base': '#7f5538', 'clara': '#a3754c', 'luz': '#c49466',
          'linea': '#33200f', 'orilla': '#ecd0a0', 'astilla': '#2a1a0e', 'mugre': '#24170d',
          'calido': '#8e5034', 'frio': '#6b5e3e'}
MADERA_CLARA = {'oscura': '#6e4b2e', 'media': '#94683f', 'base': '#a9794a', 'clara': '#c99a63', 'luz': '#ddb682',
                'linea': '#4e3218', 'orilla': '#f3dcae', 'astilla': '#3b2614', 'mugre': '#2e2013',
                'calido': '#b0663e', 'frio': '#8a7a4e'}
METAL = {'oscuro': '#2c3139', 'base': '#454d5a', 'claro': '#6f7a8a', 'orilla': '#c9d2dc', 'oxido': '#5e3420'}
PIEDRA = {'oscura': '#5e5b55', 'base': '#8a867c', 'clara': '#aaa597', 'orilla': '#d6d0bf', 'musgo': '#6e8f3e', 'mugre': '#3e3a33'}
CONCRETO = {'oscuro': '#6b655c', 'base': '#958e82', 'base2': '#a0988b', 'claro': '#b5ae9f', 'luz': '#cbc4b5', 'orilla': '#e4ddcd',
            'junta': '#5a544b', 'mono': '#34302b', 'mugre': '#26231f', 'musgo': '#5c7536', 'calido': '#a5927a', 'frio': '#838a8a'}
PINTURAS = {
    'turquesa': {'oscura': '#2c4a50', 'base': '#3d6870', 'clara': '#55858a', 'orilla': '#8fb8b2'},
    'rojo': {'oscura': '#6e1f1a', 'base': '#9a2f25', 'clara': '#c0473a', 'orilla': '#e8a08a'},
    'amarillo': {'oscura': '#8a7a10', 'base': '#c9b224', 'clara': '#e6d34a', 'orilla': '#f7eca0'},
    'crema': {'oscura': '#a8987a', 'base': '#d4c6a6', 'clara': '#e9dfc6', 'orilla': '#fbf5e6'},
    'negro': {'oscura': '#141418', 'base': '#24252b', 'clara': '#3a3c45', 'orilla': '#7d8090'},
    'magenta': {'oscura': '#6e1470', 'base': '#a32aa6', 'clara': '#c54fc7', 'orilla': '#eba4ec'},
    'azul': {'oscura': '#22305e', 'base': '#33478a', 'clara': '#4c63aa', 'orilla': '#9fb1e3'},
}


def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0  # sin respaldos .blend1 en el repo


# ---------------------------------------------------------------- nodos

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

    def rampa(self, entrada, paradas, constante=False):
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

    def celdas(self, vector, escala, aleatorio=1.0, metrica='EUCLIDEAN'):
        t = self.n('ShaderNodeTexVoronoi', feature='F1', distance=metrica)
        t.inputs['Scale'].default_value = escala
        t.inputs['Randomness'].default_value = aleatorio
        if vector is not None:
            self.l(vector, t.inputs['Vector'])
        return t

    def escalar(self, vector, s):
        m = self.n('ShaderNodeVectorMath', operation='MULTIPLY')
        self.l(vector, m.inputs[0])
        m.inputs[1].default_value = s
        return m.outputs[0]


def suave(N, x, a, b):
    m = N.n('ShaderNodeMapRange', data_type='FLOAT', interpolation_type='SMOOTHSTEP', clamp=True)
    N.l(x, m.inputs['Value'])
    m.inputs['From Min'].default_value = a
    m.inputs['From Max'].default_value = b
    m.inputs['To Min'].default_value = 0.0
    m.inputs['To Max'].default_value = 1.0
    return m.outputs['Result']


def lavado(N, col, campo, umbral, ancho, color, opacidad, borde=0.3, oscuro=0.7, invertido=False):
    """Un lavado de acuarela donde `campo` pasa de `umbral` (o no llega, con `invertido`), con la
    orilla suave y el pigmento juntado en la orilla."""
    lleno = suave(N, campo, umbral - ancho, umbral + ancho)
    if invertido:
        lleno = N.val('SUBTRACT', 1.0, lleno)
    col = N.mezcla(N.val('MULTIPLY', lleno, opacidad), col, color)
    if borde > 0:
        dist = N.val('ABSOLUTE', N.val('SUBTRACT', campo, umbral))
        orilla = N.val('SUBTRACT', 1.0, suave(N, dist, 0.0, ancho * 0.7))
        c = srgb(color) if isinstance(color, str) else color
        col = N.mezcla(N.val('MULTIPLY', orilla, borde), col, (c[0] * oscuro, c[1] * oscuro, c[2] * oscuro, 1.0))
    return col


def grano(N, col, pos, fuerza=0.12):
    """El grano del papel."""
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
    fibra = N.celdas(pos, 120.0)
    fino = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, suave(N, fibra.outputs['Distance'], 0.0, 0.06)), fuerza * 0.6)
    return N.mezcla(fino, col, (0.0, 0.0, 0.0, 1.0))


def deformado(N, pos, escala=6.0, fuerza=0.06):
    """La posición corrida con ruido: manchas orgánicas."""
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


def orilla_bisel(N, geo, radio, muestras=12):
    """Qué tanto dobla el bisel aquí: 0 en lo plano, sube en las orillas."""
    b = N.n('ShaderNodeBevel', samples=muestras)
    b.inputs['Radius'].default_value = radio
    d = N.n('ShaderNodeVectorMath', operation='DOT_PRODUCT')
    N.l(b.outputs['Normal'], d.inputs[0])
    N.l(geo.outputs['Normal'], d.inputs[1])
    return N.val('SUBTRACT', 1.0, d.outputs['Value'])


def _base(mat):
    N = Nodos(mat)
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(geo.outputs['True Normal'], sn.inputs[0])
    return N, tc.outputs['Object'], geo, sn.outputs['Z']


def _salida(N, color):
    em = N.n('ShaderNodeEmission')
    N.l(color, em.inputs['Color'])
    out = N.n('ShaderNodeOutputMaterial')
    N.l(em.outputs[0], out.inputs['Surface'])
    tex = N.n('ShaderNodeTexImage')
    tex.name = 'Horneado'
    N.nt.nodes.active = tex


def _nuevo(nombre):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    return m


# ---------------------------------------------------------------- materiales

def material_madera(nombre, paleta=MADERA, pintura=None, desgaste=1.0, fino=1.0):
    """Madera en acuarela que sigue la veta de cada pieza (atributo `Veta`). Con `pintura` (una de
    PINTURAS o un dict igual), una capa de color que se cae en las orillas y deja ver la madera.
    `desgaste` (0 a 1) cuánto se cae la pintura. `fino` (< 1) para piezas delgadas (patas, palos,
    barandales): achica las orillas y las astillas, que si no se comen la pieza."""
    m = _nuevo(nombre)
    N, pos, geo, nz = _base(m)
    at = N.n('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='Veta')
    g = at.outputs['Vector']
    sv = N.n('ShaderNodeSeparateXYZ')
    N.l(g, sv.inputs[0])
    isla = sv.outputs['Z']
    col = N.rampa(isla, [(0.0, paleta['media']), (0.5, paleta['base'])])
    grande = N.ruido(pos, 2.6, detalle=3.0, rugosidad=0.6, distorsion=1.8)
    col = lavado(N, col, grande, 0.56, 0.08, paleta['clara'], 0.55, borde=0.35)
    col = lavado(N, col, grande, 0.42, 0.07, paleta['oscura'], 0.45, borde=0.3, invertido=True)
    tinte = N.ruido(pos, 1.4, detalle=1.0, distorsion=1.0)
    col = lavado(N, col, tinte, 0.6, 0.12, paleta['calido'], 0.22, borde=0.0)
    col = lavado(N, col, tinte, 0.4, 0.12, paleta['frio'], 0.18, borde=0.0, invertido=True)
    trazos = N.ruido(N.escalar(g, (30, 1.4, 3.0)), 1.0, detalle=2.0, rugosidad=0.55, distorsion=1.2)
    col = lavado(N, col, trazos, 0.4, 0.05, paleta['oscura'], 0.55, borde=0.45, invertido=True)
    col = lavado(N, col, trazos, 0.62, 0.05, paleta['clara'], 0.5, borde=0.25)
    ola = N.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='X', wave_profile='SIN')
    ola.inputs['Scale'].default_value = 9.0
    ola.inputs['Distortion'].default_value = 5.0
    ola.inputs['Detail'].default_value = 1.5
    N.l(N.escalar(g, (1.0, 0.18, 3.0)), ola.inputs['Vector'])
    linea = N.val('SUBTRACT', 1.0, suave(N, ola.outputs['Fac'], 0.04, 0.16))
    varia = suave(N, N.ruido(N.escalar(g, (4, 0.6, 3.0)), 1.0, detalle=1.0), 0.3, 0.7)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', linea, varia), 0.6), col, paleta['linea'])
    nudo = N.celdas(N.escalar(g, (5, 1.6, 3.0)), 1.0)
    sc = N.n('ShaderNodeSeparateColor')
    N.l(nudo.outputs['Color'], sc.inputs[0])
    hay = N.val('GREATER_THAN', sc.outputs[0], 0.88)
    d_nudo = N.val('ADD', nudo.outputs['Distance'], N.val('SUBTRACT', 1.0, hay))
    col = lavado(N, col, d_nudo, 0.16, 0.03, paleta['clara'], 0.6, borde=0.0, invertido=True)
    col = lavado(N, col, d_nudo, 0.09, 0.025, paleta['linea'], 0.8, borde=0.5, invertido=True)
    sz = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sz.inputs[0])
    deg = N.rampa(suave(N, sz.outputs['Z'], -0.2, 1.4), [(0.0, (0.66, 0.64, 0.64, 1)), (0.5, (0.9, 0.88, 0.88, 1)), (1.0, (1, 1, 1, 1))])
    col = N.mezcla(1.0, col, deg, 'MULTIPLY')
    col = N.mezcla(N.val('MULTIPLY', suave(N, nz, 0.4, 0.8), 0.4), col, paleta['luz'])
    cerca = suave(N, orilla_bisel(N, geo, 0.03 * fino, 16), 0.015, 0.05)
    astilla = N.celdas(deformado(N, pos, 9.0 / fino, 0.05 * fino), 17.0 / fino)
    d_ast = N.val('ADD', astilla.outputs['Distance'], N.val('SUBTRACT', 1.0, cerca))
    col = lavado(N, col, d_ast, 0.32, 0.05, paleta['orilla'], 0.55, borde=0.0, invertido=True)
    col = lavado(N, col, d_ast, 0.2, 0.04, paleta['astilla'], 0.75, borde=0.4, invertido=True)
    fina = suave(N, orilla_bisel(N, geo, 0.012 * fino), 0.01, 0.04)
    seco = suave(N, N.ruido(N.escalar(g, (60, 3.0, 3.0)), 1.0, detalle=2.0), 0.35, 0.65)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', fina, seco), 0.85), col, paleta['orilla'])
    ao = N.n('ShaderNodeAmbientOcclusion', samples=32)
    ao.inputs['Distance'].default_value = 0.08 * max(fino, 0.5)
    sucio = N.val('ADD', ao.outputs['AO'], N.val('MULTIPLY', N.ruido(pos, 12.0, distorsion=1.0), 0.25))
    col = lavado(N, col, sucio, 0.62, 0.08, paleta['mugre'], 0.6, borde=0.3, invertido=True)
    madera = col
    if pintura:
        p = N.rampa(isla, [(0.0, pintura['oscura']), (0.5, pintura['base'])])
        p = lavado(N, p, grande, 0.55, 0.08, pintura['clara'], 0.55, borde=0.3)
        p = lavado(N, p, trazos, 0.4, 0.05, pintura['oscura'], 0.45, borde=0.35, invertido=True)
        p = N.mezcla(1.0, p, deg, 'MULTIPLY')
        p = N.mezcla(N.val('MULTIPLY', suave(N, nz, 0.4, 0.8), 0.3), p, pintura['clara'])
        gotea = N.ruido(N.escalar(g, (46, 1.2, 3.0)), 1.0, detalle=1.0)
        p = lavado(N, p, gotea, 0.62, 0.05, pintura['oscura'], 0.45, borde=0.3)
        p = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', fina, seco), 0.7), p, pintura['orilla'])
        p = lavado(N, p, sucio, 0.6, 0.08, paleta['mugre'], 0.5, borde=0.2, invertido=True)
        ancha = suave(N, orilla_bisel(N, geo, 0.05 * fino, 16), 0.01, 0.04)
        cae = N.celdas(deformado(N, pos, 7.0, 0.07), 11.0)
        d_cae = N.val('ADD', cae.outputs['Distance'], N.val('SUBTRACT', 1.0, ancha))
        sueltas = N.val('ADD', N.celdas(deformado(N, pos, 5.0, 0.08), 6.0).outputs['Distance'], N.val('MULTIPLY', N.ruido(pos, 9.0), 0.3))
        lim_o = 0.42 * desgaste + 0.01
        lim_s = 0.3 * desgaste + 0.01
        sin = N.val('MINIMUM', N.val('DIVIDE', d_cae, lim_o), N.val('DIVIDE', sueltas, lim_s))
        queda = suave(N, sin, 0.92, 1.06)
        filo = N.val('SUBTRACT', 1.0, suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', sin, 1.0)), 0.0, 0.12))
        c = srgb(pintura['oscura'])
        p = N.mezcla(N.val('MULTIPLY', filo, 0.6), p, (c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 1))
        col = N.mezcla(queda, madera, p)
    col = grano(N, col, pos, 0.12)
    _salida(N, col)
    return m


def material_metal(nombre, paleta=METAL, oxido=0.55):
    """Metal gris pizarra en acuarela: lavados, oscuro abajo, la cara de arriba más clara, brillo
    suave en la orilla y óxido aguado que se corre hacia abajo."""
    m = _nuevo(nombre)
    N, pos, geo, nz = _base(m)
    campo = N.ruido(N.escalar(pos, (10.0, 10.0, 26.0)), 1.0, detalle=2.0, rugosidad=0.6, distorsion=1.4)
    col = N.rampa(campo, [(0.0, paleta['base']), (1.0, paleta['base'])])
    col = lavado(N, col, campo, 0.42, 0.07, paleta['oscuro'], 0.6, borde=0.35, invertido=True)
    col = lavado(N, col, campo, 0.6, 0.07, paleta['claro'], 0.45, borde=0.2)
    sz = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sz.inputs[0])
    altura = suave(N, sz.outputs['Z'], -0.2, 1.4)
    deg = N.rampa(altura, [(0.0, (0.72, 0.72, 0.74, 1)), (0.5, (1, 1, 1, 1))])
    col = N.mezcla(1.0, col, deg, 'MULTIPLY')
    col = N.mezcla(N.val('MULTIPLY', suave(N, nz, 0.3, 0.7), 0.45), col, paleta['claro'])
    ox = N.val('ADD', N.ruido(N.escalar(pos, (9.0, 9.0, 3.0)), 1.0, detalle=2.0, distorsion=1.5), N.val('MULTIPLY', altura, 0.6))
    col = lavado(N, col, ox, 0.62, 0.06, paleta['oxido'], oxido, borde=0.4, invertido=True)
    b = suave(N, orilla_bisel(N, geo, 0.008), 0.01, 0.035)
    seco = suave(N, N.ruido(pos, 22.0, detalle=2.0), 0.35, 0.65)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', b, seco), 0.85), col, paleta['orilla'])
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.05
    col = lavado(N, col, ao.outputs['AO'], 0.55, 0.08, paleta['oscuro'], 0.6, borde=0.2, invertido=True)
    col = grano(N, col, pos, 0.12)
    _salida(N, col)
    return m


def material_piedra(nombre, paleta=PIEDRA, musgo=0.6):
    """Piedra en acuarela: lavados, grietas claras siguiendo las orillas, musgo que sube desde abajo
    y suciedad en lo hondo (como las rocas de la referencia)."""
    m = _nuevo(nombre)
    N, pos, geo, nz = _base(m)
    campo = N.ruido(pos, 3.0, detalle=3.0, rugosidad=0.6, distorsion=1.2)
    col = N.rampa(campo, [(0.0, paleta['base']), (1.0, paleta['base'])])
    col = lavado(N, col, campo, 0.4, 0.08, paleta['oscura'], 0.55, borde=0.35, invertido=True)
    col = lavado(N, col, campo, 0.6, 0.08, paleta['clara'], 0.5, borde=0.25)
    col = N.mezcla(N.val('MULTIPLY', suave(N, nz, 0.35, 0.8), 0.45), col, paleta['clara'])
    grieta = N.celdas(deformado(N, pos, 4.0, 0.12), 5.0)
    borde_c = N.val('SUBTRACT', 1.0, suave(N, grieta.outputs['Distance'], 0.0, 0.05))
    col = N.mezcla(N.val('MULTIPLY', borde_c, 0.35), col, paleta['oscura'])
    b = suave(N, orilla_bisel(N, geo, 0.03, 16), 0.012, 0.05)
    seco = suave(N, N.ruido(pos, 14.0, detalle=2.0), 0.3, 0.7)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', b, seco), 0.8), col, paleta['orilla'])
    sz = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sz.inputs[0])
    sube = N.val('ADD', N.val('MULTIPLY', N.ruido(pos, 5.0, detalle=2.0, distorsion=1.0), 0.35), N.val('MULTIPLY', sz.outputs['Z'], 1.2))
    col = lavado(N, col, sube, 0.45, 0.07, paleta['musgo'], musgo, borde=0.35, invertido=True)
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.1
    col = lavado(N, col, ao.outputs['AO'], 0.6, 0.08, paleta['mugre'], 0.55, borde=0.25, invertido=True)
    col = grano(N, col, pos, 0.12)
    _salida(N, col)
    return m


def poner_concreto(o, arriba=None, azar=None):
    """El atributo `Concreto` de una pieza colada (antes de biselar): x = cuánto falta para su orilla
    de arriba (de ahí bajan los escurrimientos), y = su alto, z = un azar por pieza. Una pared con un
    vano se arma en piezas, así la de abajo del vano tiene ahí su orilla y le escurre."""
    me = o.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    z1 = co[:, 2].max() if arriba is None else arriba
    alto = max(float(z1 - co[:, 2].min()), 1e-3)
    azar = random.random() if azar is None else azar
    rgba = np.stack([z1 - co[:, 2], np.full(len(co), alto), np.full(len(co), azar), np.ones(len(co))], 1).astype(np.float32)
    at = me.color_attributes.get('Concreto') or me.color_attributes.new('Concreto', 'FLOAT_COLOR', 'POINT')
    at.data.foreach_set('color', rgba.ravel())


def material_concreto(nombre, paleta=CONCRETO, tabla=0.2, modulo=0.6, escurre=1.0, musgo=0.5):
    """Concreto aparente en acuarela (el Estudio, Oscar, 2026-11-24): gris cálido con lavados, las
    marcas de las tablas de la cimbra (cada tabla de su tono, la junta fina que se corta a ratos y la
    veta de la madera marcada), los agujeros de moño en retícula, escurrimientos negros que bajan de
    la orilla de arriba de cada pieza (atributo `Concreto`, ver poner_concreto), musgo que sube del
    piso, orilla clara en los chaflanes y mugre en lo hondo. Las marcas siguen la cara: en las que
    miran a ±Y corren con x, en las que miran a ±X con y; las de arriba van lisas (allanadas)."""
    m = _nuevo(nombre)
    N, pos, geo, nz = _base(m)
    sp = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sp.inputs[0])
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(geo.outputs['True Normal'], sn.inputs[0])
    lado = N.val('GREATER_THAN', N.val('ABSOLUTE', sn.outputs['X']), N.val('ABSOLUTE', sn.outputs['Y']))
    vertical = N.val('SUBTRACT', 1.0, suave(N, N.val('ABSOLUTE', nz), 0.6, 0.8))
    cimbra = N.val('SUBTRACT', 1.0, suave(N, nz, 0.6, 0.8))       # todo menos lo de arriba
    u = N.val('ADD', sp.outputs['X'], N.val('MULTIPLY', lado, N.val('SUBTRACT', sp.outputs['Y'], sp.outputs['X'])))
    v = N.val('ADD', sp.outputs['Y'], N.val('MULTIPLY', vertical, N.val('SUBTRACT', sp.outputs['Z'], sp.outputs['Y'])))
    at = N.n('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='Concreto')
    sa = N.n('ShaderNodeSeparateXYZ')
    N.l(at.outputs['Vector'], sa.inputs[0])
    falta, azar = sa.outputs['X'], sa.outputs['Z']
    cuv = N.n('ShaderNodeCombineXYZ')
    N.l(u, cuv.inputs[0])
    N.l(v, cuv.inputs[1])
    N.l(N.val('MULTIPLY', azar, 7.0), cuv.inputs[2])
    q = cuv.outputs[0]
    col = N.rampa(azar, [(0.0, paleta['base']), (1.0, paleta['base2'])])
    grande = N.ruido(pos, 0.9, detalle=3.0, rugosidad=0.6, distorsion=1.5)
    col = lavado(N, col, grande, 0.57, 0.08, paleta['claro'], 0.5, borde=0.3)
    col = lavado(N, col, grande, 0.42, 0.07, paleta['oscuro'], 0.4, borde=0.3, invertido=True)
    tinte = N.ruido(pos, 0.5, detalle=1.0, distorsion=1.0)
    col = lavado(N, col, tinte, 0.6, 0.12, paleta['calido'], 0.25, borde=0.0)
    col = lavado(N, col, tinte, 0.4, 0.12, paleta['frio'], 0.2, borde=0.0, invertido=True)
    # las tablas de la cimbra: cada una de su tono, la junta fina y la veta de la madera
    onda = N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(N.escalar(q, (0.7, 0.0, 1.0)), 1.0, detalle=1.0), 0.5), 0.03)
    vb = N.val('DIVIDE', N.val('ADD', v, onda), tabla)
    f = N.val('FRACT', vb)
    wn = N.n('ShaderNodeTexWhiteNoise', noise_dimensions='3D')
    cw = N.n('ShaderNodeCombineXYZ')
    N.l(N.val('FLOOR', vb), cw.inputs[0])
    N.l(N.val('FLOOR', N.val('DIVIDE', u, 2.4)), cw.inputs[1])
    N.l(azar, cw.inputs[2])
    N.l(cw.outputs[0], wn.inputs['Vector'])
    tono = wn.outputs['Value']
    col = lavado(N, col, tono, 0.72, 0.08, paleta['claro'], N.val('MULTIPLY', cimbra, 0.3), borde=0.0)
    col = lavado(N, col, tono, 0.28, 0.08, paleta['oscuro'], N.val('MULTIPLY', cimbra, 0.25), borde=0.0, invertido=True)
    dist = N.val('MULTIPLY', N.val('MINIMUM', f, N.val('SUBTRACT', 1.0, f)), tabla)
    junta = N.val('SUBTRACT', 1.0, suave(N, dist, 0.002, 0.009))
    corta = suave(N, N.ruido(N.escalar(q, (1.6, 6.0, 1.0)), 1.0, detalle=1.0), 0.32, 0.5)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', junta, corta), N.val('MULTIPLY', cimbra, 0.55)), col, paleta['junta'])
    veta = N.ruido(N.escalar(q, (1.2, 26.0, 1.0)), 1.0, detalle=2.0, distorsion=0.6)
    col = lavado(N, col, veta, 0.62, 0.04, paleta['claro'], N.val('MULTIPLY', cimbra, 0.22), borde=0.0)
    col = lavado(N, col, veta, 0.36, 0.04, paleta['oscuro'], N.val('MULTIPLY', cimbra, 0.15), borde=0.0, invertido=True)
    # los agujeros de moño, en retícula (a media tabla, solo en lo vertical)
    du = N.val('MULTIPLY', N.val('SUBTRACT', N.val('FRACT', N.val('DIVIDE', u, modulo)), 0.5), modulo)
    dv = N.val('MULTIPLY', N.val('SUBTRACT', N.val('FRACT', N.val('DIVIDE', sp.outputs['Z'], modulo)), 0.5), modulo)
    cd = N.n('ShaderNodeCombineXYZ')
    N.l(du, cd.inputs[0])
    N.l(dv, cd.inputs[1])
    largo = N.n('ShaderNodeVectorMath', operation='LENGTH')
    N.l(cd.outputs[0], largo.inputs[0])
    d = largo.outputs['Value']
    hueco = N.val('SUBTRACT', 1.0, suave(N, d, 0.017, 0.024))
    aro = N.val('SUBTRACT', 1.0, suave(N, d, 0.026, 0.04))
    col = N.mezcla(N.val('MULTIPLY', aro, N.val('MULTIPLY', vertical, 0.35)), col, paleta['claro'])
    col = N.mezcla(N.val('MULTIPLY', hueco, N.val('MULTIPLY', vertical, 0.9)), col, paleta['mono'])
    col = N.mezcla(N.val('MULTIPLY', suave(N, nz, 0.4, 0.8), 0.3), col, paleta['luz'])
    # escurrimientos negros que bajan de la orilla de arriba de cada pieza (la orilla del pigmento
    # se apaga con ellos: con lavado() quedaba una raya vertical en toda la pared)
    chorro = N.ruido(N.escalar(q, (7.0, 0.45, 1.0)), 1.0, detalle=2.0, distorsion=0.4)
    alcance = N.val('ADD', 0.2, N.val('MULTIPLY', N.ruido(N.escalar(q, (3.0, 0.05, 1.0)), 1.0, detalle=1.0), 1.3))
    cae = N.val('SUBTRACT', 1.0, suave(N, N.val('DIVIDE', falta, alcance), 0.0, 1.0))
    sucio = N.val('MULTIPLY', N.val('MULTIPLY', cae, vertical), escurre)
    col = N.mezcla(N.val('MULTIPLY', suave(N, chorro, 0.53, 0.6), N.val('MULTIPLY', sucio, 0.55)), col, paleta['mugre'])
    filo_chorro = N.val('SUBTRACT', 1.0, suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', chorro, 0.565)), 0.0, 0.03))
    col = N.mezcla(N.val('MULTIPLY', filo_chorro, N.val('MULTIPLY', sucio, 0.3)), col, paleta['mugre'])
    filo = N.val('SUBTRACT', 1.0, suave(N, falta, 0.02, 0.14))
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', filo, vertical), 0.3 * escurre), col, paleta['mugre'])
    # musgo que sube del piso
    zpie = N.val('ADD', sp.outputs['Z'], N.val('MULTIPLY', N.ruido(deformado(N, pos, 3.0, 0.1), 2.5), 0.45))
    col = lavado(N, col, zpie, 0.45, 0.08, paleta['musgo'], 0.75 * musgo, borde=0.3, invertido=True)
    b = suave(N, orilla_bisel(N, geo, 0.03, 12), 0.015, 0.05)
    seco = suave(N, N.ruido(pos, 9.0, detalle=2.0), 0.35, 0.65)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', b, seco), 0.7), col, paleta['orilla'])
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.4
    sombra = N.val('ADD', ao.outputs['AO'], N.val('MULTIPLY', N.ruido(pos, 4.0, distorsion=1.0), 0.2))
    col = lavado(N, col, sombra, 0.62, 0.08, paleta['mugre'], 0.55, borde=0.25, invertido=True)
    col = grano(N, col, pos, 0.1)
    _salida(N, col)
    return m


def material_liso(nombre, color, claro=None, oscuro=None, desgaste=0.0, orilla='#f3e6c8'):
    """Un color liso en acuarela (tela, plástico, pintura, papel): lavados, luz pintada arriba,
    orilla clara suave y, con `desgaste` (0 a 1), manchas que se caen con su borde."""
    m = _nuevo(nombre)
    N, pos, geo, nz = _base(m)
    c = srgb(color)
    claro = claro or '#%02x%02x%02x' % tuple(min(255, int(((x ** (1 / 2.2)) * 1.25) * 255)) for x in c[:3])
    oscuro = oscuro or '#%02x%02x%02x' % tuple(int(((x ** (1 / 2.2)) * 0.6) * 255) for x in c[:3])
    campo = N.ruido(pos, 3.2, detalle=3.0, rugosidad=0.6, distorsion=1.6)
    col = N.rampa(campo, [(0.0, color), (1.0, color)])
    col = lavado(N, col, campo, 0.42, 0.07, oscuro, 0.5, borde=0.35, invertido=True)
    col = lavado(N, col, campo, 0.6, 0.07, claro, 0.45, borde=0.25)
    col = N.mezcla(N.val('MULTIPLY', suave(N, nz, 0.4, 0.8), 0.35), col, claro)
    b = suave(N, orilla_bisel(N, geo, 0.015), 0.01, 0.04)
    seco = suave(N, N.ruido(pos, 20.0, detalle=2.0), 0.35, 0.65)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', b, seco), 0.6), col, orilla)
    if desgaste > 0:
        cae = N.celdas(deformado(N, pos, 6.0, 0.08), 8.0)
        col = lavado(N, col, cae.outputs['Distance'], 0.25 * desgaste, 0.04, oscuro, 0.6, borde=0.4, invertido=True)
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.06
    col = lavado(N, col, ao.outputs['AO'], 0.6, 0.08, oscuro, 0.55, borde=0.2, invertido=True)
    col = grano(N, col, pos, 0.1)
    _salida(N, col)
    return m


def material_brillo(nombre, color):
    """Lo que brilla solo (el vidrio de un farol, una pantalla): color plano sin lavados. En el sitio
    se le pone emisivo; aquí solo se hornea su color."""
    m = _nuevo(nombre)
    N, pos, geo, nz = _base(m)
    col = N.rampa(N.ruido(pos, 4.0), [(0.0, color), (1.0, color)])
    _salida(N, col)
    return m


def estencil_skulley():
    """La cabeza de Skulley en grunge (public/grungeskullley.png, de Oscar): las calaveras siempre
    con su forma. Devuelve la imagen y su proporción ancho / alto."""
    img = bpy.data.images.load(GRUNGE, check_existing=True)
    img.pack()
    w, h = img.size
    return img, w / h


def calca(mat, imagen, centro, ancho, normal=(0, -1, 0), color='#e9dcb8', gasto=0.2):
    """Pinta una calca (esténcil por su transparencia) sobre un material ya armado, proyectada de
    frente en el espacio del objeto: `centro` (x, z) del cuadro, `ancho` en metros, solo en las
    caras que miran hacia `normal`. Pinta encima de todo lo del material (también del grano)."""
    nt = mat.node_tree
    em = next(n for n in nt.nodes if n.type == 'EMISSION')
    entrada = em.inputs['Color'].links[0].from_socket
    N = Nodos.__new__(Nodos)
    N.nt = nt
    N.x = 4000
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    sp = N.n('ShaderNodeSeparateXYZ')
    N.l(tc.outputs['Object'], sp.inputs[0])
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(geo.outputs['True Normal'], sn.inputs[0])
    w, h = imagen.size
    alto = ancho * h / w
    u = N.val('ADD', N.val('DIVIDE', N.val('SUBTRACT', sp.outputs['X'], centro[0]), ancho), 0.5)
    v = N.val('ADD', N.val('DIVIDE', N.val('SUBTRACT', sp.outputs['Z'], centro[1]), alto), 0.5)
    uv = N.n('ShaderNodeCombineXYZ')
    N.l(u, uv.inputs[0])
    N.l(v, uv.inputs[1])
    tex = N.n('ShaderNodeTexImage', image=imagen, extension='CLIP', interpolation='Cubic')
    N.l(uv.outputs[0], tex.inputs['Vector'])
    nd = N.n('ShaderNodeVectorMath', operation='DOT_PRODUCT')
    N.l(geo.outputs['True Normal'], nd.inputs[0])
    nd.inputs[1].default_value = normal
    frente = suave(N, nd.outputs['Value'], 0.3, 0.5)
    aguada = N.val('ADD', 1.0 - gasto, N.val('MULTIPLY', N.ruido(tc.outputs['Object'], 7.0, detalle=2.0), gasto * 1.5))
    alfa = N.val('MULTIPLY', N.val('MULTIPLY', tex.outputs['Alpha'], frente), aguada)
    col = N.mezcla(alfa, entrada, color)
    N.l(col, em.inputs['Color'])


# ---------------------------------------------------------------- geometría

def objeto(nombre, bm, material=None):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    if material:
        o.data.materials.append(material)
    return o


def poner_veta(o, eje='X', azar=None):
    """El atributo `Veta` de una pieza de madera: y = a lo largo de `eje` (local), x = a lo ancho
    (la suma de los otros dos ejes), z = un azar por pieza."""
    me = o.data
    a = {'X': 0, 'Y': 1, 'Z': 2}[eje]
    otros = [i for i in range(3) if i != a]
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    azar = random.random() if azar is None else azar
    veta = np.stack([co[:, otros[0]] + co[:, otros[1]], co[:, a], np.full(len(co), azar)], 1)
    rgba = np.concatenate([veta, np.ones((len(co), 1))], 1).astype(np.float32)
    at = me.color_attributes.get('Veta') or me.color_attributes.new('Veta', 'FLOAT_COLOR', 'POINT')
    at.data.foreach_set('color', rgba.ravel())


def biselar(o, ancho=0.012, segmentos=2, angulo=40):
    b = o.modifiers.new('bisel', 'BEVEL')
    b.width = ancho
    b.segments = segmentos
    b.limit_method = 'ANGLE'
    b.angle_limit = math.radians(angulo)
    b.harden_normals = True
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='bisel')


def _colocar(o, centro, rot):
    o.location = centro
    o.rotation_euler = rot
    bpy.context.view_layer.update()
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)


def _chuequear(bm, fuerza, semilla):
    for v in bm.verts:
        p = v.co * 1.7 + Vector((semilla * 3.1, semilla * 1.7, semilla * 2.3))
        v.co += Vector((noise.noise(p), noise.noise(p + Vector((5.2, 1.3, 2.8))), noise.noise(p + Vector((1.7, 9.2, 3.1))))) * fuerza


def tabla(nombre, largo, ancho, grueso, material, centro=(0, 0, 0), rot=(0, 0, 0), chueco=0.008, bisel=0.012, divisiones=4, semilla=None):
    """Una tabla: largo en X, ancho en Y, grueso en Z (centrada), con la veta a lo largo, un leve
    chueco a mano y biseles. `centro` y `rot` la acomodan (rot en radianes, XYZ)."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(largo, ancho, grueso), verts=bm.verts)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).x) > largo * 0.5], cuts=divisiones, use_grid_fill=True)
    _chuequear(bm, chueco, semilla)
    o = objeto(nombre, bm, material)
    poner_veta(o, 'X', azar=(semilla % 1.0))
    if bisel:
        biselar(o, min(bisel, grueso * 0.45, ancho * 0.45))
    _colocar(o, centro, rot)
    return o


def caja(nombre, tam, material, centro=(0, 0, 0), rot=(0, 0, 0), chueco=0.006, bisel=0.015, semilla=None):
    """Una caja de tamaño (x, y, z), centrada, con la veta a lo largo de su lado más largo."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=tam, verts=bm.verts)
    largo = max(tam)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if (e.verts[0].co - e.verts[1].co).length > largo * 0.5], cuts=2, use_grid_fill=True)
    _chuequear(bm, chueco, semilla)
    o = objeto(nombre, bm, material)
    poner_veta(o, 'XYZ'[list(tam).index(largo)], azar=(semilla % 1.0))
    if bisel:
        biselar(o, min(bisel, min(tam) * 0.45))
    _colocar(o, centro, rot)
    return o


def poste(nombre, alto, radio, material, centro=(0, 0, 0), rot=(0, 0, 0), lados=8, punta=1.0, chueco=0.01, bisel=0.012, semilla=None):
    """Un poste o tronco: cilindro de `lados` caras a lo alto (Z), base en z = 0, que se afila a
    `punta` × radio arriba, con la veta a lo largo."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=radio, radius2=radio * punta, depth=alto)
    bmesh.ops.translate(bm, vec=(0, 0, alto / 2), verts=bm.verts)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).z) > alto * 0.5], cuts=3)
    _chuequear(bm, chueco, semilla)
    o = objeto(nombre, bm, material)
    poner_veta(o, 'Z', azar=(semilla % 1.0))
    if bisel:
        biselar(o, min(bisel, radio * 0.4))
    _colocar(o, centro, rot)
    return o


def unir(objs, nombre):
    """Une piezas en un solo objeto (conserva `Veta` y materiales)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = nombre
    o.data.name = nombre
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    return o


def uv_atlas(objs, margen=0.004):
    """Desenvuelve todos los props juntos en una sola imagen (sin encimarse), con la misma
    densidad de pixeles en todos y el margen como fracción de la imagen: con el margen escalado,
    las cientos de islas chiquitas de los biseles se comían el atlas (cubrían ~13 %; así ~40 %)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.0)
    try:
        bpy.ops.uv.average_islands_scale()
    except Exception:
        pass
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=margen, shape_method='CONCAVE')
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=margen)
    bpy.ops.object.mode_set(mode='OBJECT')


def hornear_atlas(objs, png, tam=2048, muestras=64, margen=16):
    """Hornea los colores de todos los props en una sola imagen (Cycles) y la guarda como PNG
    (el maestro, para retocar a mano en Character/assets/).

    Con varios objetos en una imagen, Blender hace el margen de cada objeto por separado y el de uno
    pisa las orillas de las islas de otro (rayas de otro color en las costuras). Aquí se hornea sin
    margen sobre un color centinela y el margen se hace al final, de una vez para todo el atlas: cada
    pixel vacío junto a una isla toma el promedio de sus vecinos ya pintados, así las islas crecen
    parejo y se encuentran a la mitad del hueco (lo encontró la sesión del Taller)."""
    nombre = os.path.splitext(os.path.basename(png))[0]
    img = bpy.data.images.new(nombre + '_horno', tam, tam, alpha=True)
    img.colorspace_settings.name = 'sRGB'
    img.pixels.foreach_set(np.tile(np.array([1.0, 0.0, 1.0, 0.0], np.float32), tam * tam))
    mats = {m for o in objs for m in o.data.materials if m}
    for m in mats:
        n = m.node_tree.nodes.get('Horneado')
        n.image = img
        m.node_tree.nodes.active = n
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = muestras
    sc.cycles.device = 'CPU'
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='EMIT', margin=0, use_clear=False)
    px = np.empty(tam * tam * 4, np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(tam, tam, 4)
    lleno = (px[..., 3] > 0.5) | (np.abs(px[..., :3] - (1.0, 0.0, 1.0)).max(axis=2) > 0.02)
    col = np.where(lleno[..., None], px[..., :3], 0.0).astype(np.float32)
    hay = lleno.astype(np.float32)

    def mover(a, dy, dx):
        # como np.roll, pero sin dar la vuelta: lo de la orilla opuesta no se cuela
        b = np.zeros_like(a)
        ys = slice(max(dy, 0), tam + min(dy, 0))
        yo = slice(max(-dy, 0), tam + min(-dy, 0))
        xs = slice(max(dx, 0), tam + min(dx, 0))
        xo = slice(max(-dx, 0), tam + min(-dx, 0))
        b[ys, xs] = a[yo, xo]
        return b

    for _ in range(margen):
        suma = np.zeros_like(col)
        cuenta = np.zeros_like(hay)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    suma += mover(col, dy, dx)
                    cuenta += mover(hay, dy, dx)
        nuevo = (hay == 0) & (cuenta > 0)
        if not nuevo.any():
            break
        col[nuevo] = suma[nuevo] / cuenta[nuevo][:, None]
        hay[nuevo] = 1.0
    if (hay == 0).any() and (hay > 0).any():
        col[hay == 0] = col[hay > 0].mean(axis=0)
    final = bpy.data.images.new(nombre, tam, tam, alpha=False)
    final.colorspace_settings.name = 'sRGB'
    final.pixels.foreach_set(np.concatenate([col, np.ones((tam, tam, 1), np.float32)], axis=2).ravel())
    os.makedirs(os.path.dirname(png), exist_ok=True)
    final.filepath_raw = png
    final.file_format = 'PNG'
    final.save()
    for m in mats:
        m.node_tree.nodes['Horneado'].image = final
    bpy.data.images.remove(img)
    print('horneado: %d pixeles pintados (%.0f %% del atlas)' % (int(lleno.sum()), lleno.mean() * 100))
    return final


def material_final(png, nombre):
    img = bpy.data.images.load(png, check_existing=False)
    m = bpy.data.materials.new(nombre)
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


def exportar_glb(objs, png, glb, calidad=88):
    """Un GLB con todos los props del grupo (cada uno su objeto, con su nombre) y un solo material
    con el atlas (Draco, textura WebP). Los props van separados en x para verlos; el sitio los toma
    por nombre."""
    m = material_final(png, os.path.splitext(os.path.basename(glb))[0])
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    os.makedirs(os.path.dirname(glb), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_image_format='WEBP', export_image_quality=calidad, export_materials='EXPORT', export_yup=True,
        **_sin_colores(),
    )
    return os.path.getsize(glb)


def _sin_colores():
    """Que la veta (atributo de color) no viaje en el GLB: pesa y, como COLOR_0, el GLTFLoader de
    three prende vertexColors."""
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    if 'export_vertex_color' in props:
        return {'export_vertex_color': 'NONE'}
    if 'export_colors' in props:
        return {'export_colors': False}
    return {}


def fila(objs, separacion=0.6):
    """Acomoda los props en fila sobre X (para el GLB y las fotos), cada uno con su base en z = 0."""
    x = 0.0
    for o in objs:
        bpy.context.view_layer.update()
        xs = [(o.matrix_world @ Vector(c)).x for c in o.bound_box]
        zs = [(o.matrix_world @ Vector(c)).z for c in o.bound_box]
        ancho = max(xs) - min(xs)
        o.location.x += x - min(xs)
        o.location.z -= min(zs)
        x += ancho + separacion
    bpy.context.view_layer.update()


def render_revision(objs, carpeta, nombre, fondo='#3a3f52'):
    """Fotos de revisión con el atlas (Eevee): de frente a tres cuartos y por detrás."""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('fondo')
    w.node_tree.nodes['Background'].inputs['Color'].default_value = srgb(fondo)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    sc.world = w
    sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
    sol.data.energy = 2.4
    sol.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.collection.objects.link(sol)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centro = (lo + hi) / 2
    tam = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = tam * 1.15
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x = 1800
    sc.render.resolution_y = 1000
    os.makedirs(carpeta, exist_ok=True)
    rutas = []
    for i, (az, el) in enumerate(((-28, 24), (152, 24))):
        a, e = math.radians(az - 90), math.radians(el)
        d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
        cam.location = centro + d * tam * 3
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        ruta = os.path.join(carpeta, f'{nombre}_{i}.png')
        sc.render.filepath = ruta
        bpy.ops.render.render(write_still=True)
        rutas.append(ruta)
    return rutas


def triangulos(objs):
    total = 0
    for o in objs:
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    return total
