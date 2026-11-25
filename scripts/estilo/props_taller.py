"""El Estudio de Skulley (id `taller`): los props del grupo (Oscar, 2026-11-24; features.md, La
ofrenda -> El estilo gráfico). Donde trabajaba Skulley, el diseñador, que M.A.D.R.E. reconstruyó con
sus fotos: una construcción brutalista de concreto con lo industrial a la vista (vigas I, canaleta,
escalera de reja, tubería, cortina metálica, ventana de fábrica, tinaco), grafitis en SKULLEYGLYPH y,
adentro, un estudio moderno industrial: escritorio de acero negro con cubierta gruesa, la Wacom
Cintiq Pro 27" con su pluma, la Renderbox Nano de Oscar, una silla tipo Steelcase, el atril del iPad,
el café frío, el caballete con la pintura de Skulley, el estante de acero y madera con frascos de
pintura y pinceles, los art toys de Oscar (Skullkid y Housebird) y el tablero con bocetos. Arriba, el
letrero de neón ESTUDIO.

Mismo estilo que el barril (scripts/estilo/barril.py) con la librería compartida
(scripts/estilo/pintura.py; el concreto es su material_concreto): poca geometría con biseles, todo a
90° en el edificio, y la acuarela horneada hace casi todo. Toques de Día de Muertos: papel picado
colgado del techo de la planta baja y una veladora en el estante. La cabeza de Skulley
(estencil_skulley) sale una sola vez y chiquita, quemada en la tabla del atril.

Regla de Oscar: cada pieza tiene razón física (de dónde viene, a dónde va, qué la sostiene). La
escalera se puede subir de verdad (19 peraltes iguales del piso a la azotea, `revisar_escalera` lo mide
con rayos al armar); cada tubo empieza y acaba en algo real (registro, medidor, camisa con brida,
tanque, muro) con sus codos y abrazaderas.

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_taller.py -- todo [carpeta_fotos] [rapido] [muebles]

  armar     arma los dos grupos, les da su atlas, mide la escalera y guarda Character/Estilo_taller.blend
  pintar    hornea los dos atlas (Cycles): Character/assets/props_taller.png (muebles) y
            props_estudio.png (edificio y letrero), los maestros para retocar a mano
  exportar  public/3dmodels/estilo/props_taller.glb y props_estudio.glb (Draco, WebP, un material cada uno)
  render    fotos de revisión (Eevee) en la carpeta que se le dé: el edificio (tres cuartos, frente,
            atrás, cámara del juego), la planta baja con los muebles, el escritorio, el caballete, el
            estante, los grafitis de cada muro, cada zona desde varios ángulos (escalera, azotea,
            tinaco, frente de la torre, atrás, letrero, cajas, voladizo) y el letrero apagado y
            prendido (`muebles`: además cada mueble solo)
  todo      los cuatro
  `rapido`  hornea a 1024 con pocas muestras (para iterar; el bueno es sin él)

props_estudio.glb (medidas en metros, base en z = 0, el frente hacia -Y de Blender; planta de
8.0 × 5.5, 7.5 de alto hasta lo alto del tinaco):
  Prop_Estudio                el bloque: planta baja abierta al frente (vano de 3.55 × 2.92 libres desde
                              el piso, adentro 4.4 × 3.9, piso a z = 0.05), torre ciega con cortina
                              metálica, escalera de reja (sube por la derecha a la azotea), columna y
                              viga I, tubería, cajas de madera, letrero y su bastidor
    Prop_Estudio_Techo        (hija) la losa de la planta baja con sus pretiles y la rejita del hueco por
                              donde se entra de la escalera, la caja de arriba en voladizo (ventana
                              corrida, parasoles, su puerta de acero, tinaco) y lo que cuelga del techo
                              por dentro (papel picado, lámpara): el sitio la trama con Skulley adentro
    Prop_Estudio_Neon_0…6     (hijas) las filas de neón de cada letra de ESTUDIO, en orden de lectura;
                              vidrio apagado en el atlas, el sitio las prende en amarillo
    Lugar_<Prop>              (vacíos hijos) dónde va cada mueble de props_taller.glb, con su giro: el
                              escritorio bajo la ventana de fábrica de la pared de atrás, la silla, el
                              atril del iPad y la taza en el escritorio, la computadora en el piso a
                              su derecha, el estante en la pared izquierda, el caballete junto al vano
                              y el tablero colgado en la pared de atrás
props_taller.glb, los muebles en fila (cada uno su objeto, con sus hijos):
  Prop_Escritorio             1.6 × 0.75 × 0.75 (cubierta de 5 cm), con la Cintiq y su pluma encima
    Prop_Escritorio_Hojas     (hija) tres hojas encima
    Prop_Estudio_Pantalla     (hija) la cara de la pantalla de la Cintiq, 62 × 37 cm, recostada 20°
    Prop_Escritorio_Skullkid  (hija) el art toy Skullkid, blanco, 24 cm, junto a la Cintiq
  Prop_Silla                  1.14 de alto, asiento a 0.525
  Prop_AtrilIpad              0.35 de alto; el iPad (que ya existe) se recarga en la tabla
                              inclinada (68° contra el piso) y se apoya en el tope, a z = 0.045
  Prop_Taza                   0.1, cerámica con el borde despostillado y café adentro
  Prop_Caballete              1.73 de alto, con el bastidor del lienzo
    Prop_Caballete_Lienzo     (hijo) 0.6 × 0.6 × 0.025, con la pintura (public/prtivyImg.png) a sangre
                              en la cara y en espejo en los cantos, horneada en el atlas (≈630 px de lado)
  Prop_Estante                1.2 × 0.35 × 1.4, frascos, pinceles en su bote, veladora
    Prop_Estante_Housebird    (hijas) los art toys: un Housebird rosa (22 cm) en la tercera repisa, otro
    Prop_Estante_Housebird2   en la de abajo y un Skullkid blanco arriba
    Prop_Estante_Skullkid
  Prop_TableroBocetos         1.2 × 0.8 de corcho, con chinchetas y su cordón para colgarlo
    Prop_TableroBocetos_Hojas (hija) seis hojas clavadas
  Prop_Estudio_Computadora    la Renderbox Nano, 0.47 × 0.5 × 0.57, en sus rodajas, de primer nivel y con el
                              origen al centro de su base (en el juego tiembla): dos rejillas al frente
                              con dos ventiladores cada una y una en la tapa con uno enorme (marcos y
                              aros aquí)
    Prop_Estudio_Computadora_LuzBoton        (hija) el aro de luz del botón de encendido
    Prop_Estudio_Computadora_LuzVentiladores (hija) el resplandor detrás de los tres rotores, sin tocarlos
    Prop_Estudio_Computadora_Ventilador_0…4  (hijas) los rotores (7 aspas curvas): 0 y 1 detrás de la malla
                              de arriba del frente (izquierda, derecha), 2 y 3 detrás de la de abajo
                              (124 mm), 4 el enorme de la tapa, del tamaño de su rejilla (≈250 mm);
                              origen en el centro del eje y su medida menor (el
                              grueso) a lo largo del eje: el sitio los gira ahí (giran libres, ≥ 3 mm)
Los art toys (Skullkid y Housebird, de public/3dmodels/, los del About) van en versión ligera (5000 y
4000 triángulos, de ~65 y ~53 mil) y sus copias comparten la malla (el GLB la guarda una vez).

Las hojas, la pantalla y el lienzo llevan, además del atlas (UVMap, TEXCOORD_0), una segunda UV,
`Dibujo` (TEXCOORD_1), para que el sitio les ponga imagen: la cara de enfrente ocupa una celda de una
cuadrícula (lo demás cae en la esquina de su celda):
  Prop_Escritorio_Hojas      3 × 1, de izquierda a derecha (0.23 × 0.31, 0.31 × 0.23, 0.23 × 0.31)
  Prop_Estudio_Pantalla      1 × 1 (0.62 × 0.37)
  Prop_Caballete_Lienzo      1 × 1 (0.6 × 0.6)
  Prop_TableroBocetos_Hojas  3 × 2; arriba de izquierda a derecha (0.30 × 0.22, 0.22 × 0.30,
                             0.26 × 0.26), abajo igual (0.24 × 0.18, 0.32 × 0.22, 0.20 × 0.27);
                             la fila de abajo de la textura (v de 0 a 0.5) es la de abajo
Lo que es objeto pegado (hojas, chinchetas, grapas, papel picado) es geometría; en la textura solo
va pintura (Oscar): los grafitis y el estarcido de una caja.
"""
import json
import math
import os
import random
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import pintura as P  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_taller.blend')
GRUPOS = {
    'taller': {'png': os.path.join(REPO, 'Character', 'assets', 'props_taller.png'),
               'glb': os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_taller.glb')},
    'estudio': {'png': os.path.join(REPO, 'Character', 'assets', 'props_estudio.png'),
                'glb': os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_estudio.glb')},
}
NEON_JSON = os.path.join(AQUI, 'neon_estudio.json')  # de scripts/estilo/runas_neon.mjs
TAM = 2048
SEMILLA = 24
MUEBLES = ['Prop_Escritorio', 'Prop_Silla', 'Prop_AtrilIpad', 'Prop_Taza', 'Prop_Caballete', 'Prop_Estante', 'Prop_TableroBocetos',
           'Prop_Estudio_Computadora']
LIENZO_PNG = os.path.join(REPO, 'public', 'prtivyImg.png')   # la pintura sola (Skulley rojo sobre azul), a sangre en el lienzo

# Densidad de textura relativa (lo chico y lo que se ve de cerca se lleva más pixeles por metro; las
# hojas y la pantalla las tapa lo que pone el sitio; el neón y las luces son un color plano). La cara
# de la pintura del lienzo lleva además su propia densidad (LIENZO_DENSIDAD) para que se lea.
PESOS = {
    'Prop_Escritorio': 1.1, 'Prop_Escritorio_Hojas': 0.4, 'Prop_Estudio_Pantalla': 0.25, 'Prop_Silla': 1.4,
    'Prop_AtrilIpad': 2.4, 'Prop_Taza': 3.6, 'Prop_Caballete': 1.4, 'Prop_Caballete_Lienzo': 1.0, 'Prop_Estante': 1.4,
    'Prop_TableroBocetos': 1.1, 'Prop_TableroBocetos_Hojas': 0.4, 'Prop_Estudio_Computadora': 1.6,
    'Prop_Estudio_Computadora_LuzBoton': 0.4, 'Prop_Estudio_Computadora_LuzVentiladores': 0.15,
    'Prop_Escritorio_Skullkid': 2.4, 'Prop_Estante_Housebird': 2.4,
    **{f'Prop_Estudio_Computadora_Ventilador_{n}': 1.0 for n in range(5)},
}
LIENZO_DENSIDAD = 4.0
PESOS_ESTUDIO = {'Prop_Estudio': 1.0, 'Prop_Estudio_Techo': 1.0, **{f'Prop_Estudio_Neon_{i}': 0.05 for i in range(7)}}

COLORES = {'rosa': '#d6407c', 'naranja': '#ec7b20', 'turquesa': '#2ea89e', 'morado': '#7c4cb2',
           'azul': '#3657b6', 'verde': '#5ca33c', 'rojo': '#c23a2c', 'blanco': '#ebe3cf'}
PAPEL_PICADO = [('rosa', '#e0407e'), ('naranja', '#f08321'), ('turquesa', '#2fb0a6'),
                ('morado', '#8a4fc0'), ('verde', '#69b23a')]
# El edificio: acero gris pizarra, óxido, la lámina del neón en grafito sobre óxido
ACERO = {'oscuro': '#22262c', 'base': '#39404a', 'claro': '#5f6976', 'orilla': '#b6c0cc', 'oxido': '#6a341c'}
METAL_OXIDO = {'oscuro': '#2a1a14', 'base': '#5a3424', 'claro': '#8a5a3a', 'orilla': '#c89268', 'oxido': '#7a3416'}
OXIDO = {'oscura': '#3a1d12', 'media': '#5a2c18', 'base': '#6e3820', 'clara': '#94522c', 'luz': '#b0683a',
         'linea': '#2b140b', 'orilla': '#c98a5a', 'astilla': '#24110a', 'mugre': '#1b0f0a', 'calido': '#8a3f1e', 'frio': '#5a4632'}
GRAFITO = {'oscura': '#17191c', 'base': '#26292e', 'clara': '#3b3f46', 'orilla': '#80868e'}
# Los muebles modernos: acero negro de marco, la lámina negra mate de la Renderbox
ACERO_NEGRO = {'oscuro': '#101114', 'base': '#1e2025', 'claro': '#34373e', 'orilla': '#7c828c', 'oxido': '#3a2418'}
LAMINA_NEGRA = {'oscuro': '#0d0e11', 'base': '#1a1b1f', 'claro': '#2b2d33', 'orilla': '#5f646d', 'oxido': '#1a1b1f'}

# ---------------------------------------------------------------- medidas compartidas
ATRIL_CALCA = (0.0, 0.29)              # atril: arriba del iPad, quemada en la madera (la única calca de Skulley)
REP = [0.0775, 0.4475, 0.8275, 1.2075, 1.4]   # estante: lo de arriba de cada repisa y del tope
BOTE = (-0.33, 0.0)
VELADORA = (0.38, -0.02)
BANDERA = (0.2, 0.22)                  # papel picado: ancho, alto
ESCRITORIO = (1.6, 0.75, 0.75)         # ancho, fondo, alto (lo de arriba de la cubierta)
CINTIQ = {'ancho': 0.66, 'alto': 0.41, 'grueso': 0.024, 'pantalla': (0.62, 0.37), 'inclina': 20.0,
          'centro': (-0.15, 0.03)}     # en el escritorio; la pantalla se recuesta 20° contra la cubierta
RENDERBOX = (0.47, 0.5, 0.57)          # ancho, fondo, alto (con las rodajas)
# Los art toys de Oscar que salen en el About: GLB del sitio, alto de juguete de colección (m) y
# triángulos de la versión ligera (de ~65 y ~53 mil). El Skullkid va teñido de blanco como en el About;
# el Housebird, en su rosa (el color base de su GLB).
TOYS = {
    'Skullkid': ('skullkid.glb', 0.24, 5000),
    'Housebird': ('housebirdPink.glb', 0.22, 4000),
}
# Lo que el colapso de aristas se comía y hay que cuidar: los dos ojos del Skullkid, unos botoncitos en
# su cara (|x|, z y y medidos en la versión a su alto, base al centro; peso = lo que se deja reducir).
TOYS_CUIDA = {'Skullkid': ((0.004, 0.058), (0.15, 0.196), -0.015, 0.4)}
SKULLKID_BLANCO = '#f2efe6'
HOUSEBIRD_ROSA = '#d575de'

# El Estudio (x a lo ancho, y a lo hondo con el frente en -Y, z arriba)
PISO = 0.05                            # lo de arriba del piso de la planta baja
BX0, BX1, BY0, BY1 = -2.45, 2.55, -1.6, 2.6      # planta baja
MURO = 0.3
LOSA0, LOSA1 = 3.2, 3.5                # la losa de la planta baja (abajo, arriba)
VANO_X0 = -1.3                         # el vano de enfrente va de aquí al muro derecho
TX0, TX1, TY0, TY1, TZ1 = -3.85, -2.45, 0.0, 2.9, 6.6  # torre ciega (sale 0.3 detrás de la planta baja)
CX0, CX1, CY0, CY1, CZ1 = -1.95, 1.55, -2.3, 1.0, 6.0  # caja de arriba (de LOSA1 a CZ1)
XC = CX1 - 0.3                         # la columna I y la viga del voladizo que carga
VENTANA_FABRICA = (-1.1, 0.7, 1.25, 2.6)   # en la pared de atrás, sobre el escritorio: x0, x1, z0, z1
PUERTA_TORRE = (-3.5, -2.75)           # la cortina de la torre (x0, x1)
PUERTA_CAJA = (-0.45, 0.45)            # la puerta de acero de la caja de arriba, en su cara derecha (y0, y1)
LAMPARA = (-0.15, 1.5)                 # sobre el escritorio
LETRERO = {'ancho': 2.6, 'x': -2.82, 'base': TZ1 + 0.1, 'frente': TY0 + 0.08, 'hondo': 1.6, 'pared': 0.07,
           'metido': 0.25, 'r_fila': 0.085, 'r_marco': 0.07, 'grapa': 2.0, 'tol': 0.05, 'tol_marco': 0.07,
           'marco_atras': -0.06}       # (lo que no es ancho, x, base ni frente va en unidades de runa)
POSTES_LETRERO = (-3.7, -3.15, -2.6)   # los postes del bastidor, en la azotea de la torre
TINACO = (0.55, 0.25)                  # sobre la caja de arriba (x, y)
TINACO_CAMA = CZ1 + 0.42               # lo de arriba de la cama del tinaco
ENTRADA_AGUA = (2.3, BY1 + 0.065)      # donde la entrada del tinaco sale del piso y sube por la pared de atrás
# La escalera: dos carriles junto al muro derecho. El tramo 1 sube por el de afuera hacia atrás hasta
# el descanso (que cruza los dos), el tramo 2 regresa por el de adentro hasta la llegada, junto al
# hueco del pretil. 19 peraltes iguales del piso a la azotea.
ESCALERA = {'peralte': LOSA1 / 19, 'huella': 0.28, 'n1': 10, 'n2': 9, 'adentro': (2.575, 3.195), 'afuera': (3.235, 3.855),
            'y1': -0.72}
ESCALERA['zl'] = ESCALERA['n1'] * ESCALERA['peralte']
ESCALERA['yl0'] = ESCALERA['y1'] + (ESCALERA['n1'] - 1) * ESCALERA['huella']
ESCALERA['yl1'] = BY1
ESCALERA['yt1'] = ESCALERA['yl0'] - (ESCALERA['n2'] - 1) * ESCALERA['huella']
ESCALERA['yt0'] = ESCALERA['yt1'] - 0.85
# Cajas de madera afuera, contra el pilar a la izquierda de la entrada: x0, y0, z0, ancho, fondo, alto, giro, material
CAJAS = {
    'caja_grande': (-2.4, -2.12, 0.0, 0.62, 0.46, 0.44, 0.0, 'caja_estarcido'),
    'caja_encima': (-2.33, -2.07, 0.44, 0.48, 0.38, 0.34, 0.12, 'caja'),
    'caja_chica': (-1.78, -2.02, 0.0, 0.42, 0.36, 0.3, -0.18, 'caja2'),
}
ESTARCIDO = (-2.09, 0.24, 0.3)         # en el frente de la caja grande: x, z del centro y ancho
# Dónde van las copias de los art toys, en el espacio de su mueble: (toy, nombre, x, y, cara de
# arriba de la tabla, giro, escala). En el escritorio junto a la Cintiq; en el estante un Housebird en
# la tercera repisa, otro en la de abajo y un Skullkid arriba (en la cuarta no caben).
TOYS_LUGAR = {
    'Prop_Escritorio': [('Skullkid', 'Prop_Escritorio_Skullkid', 0.28, 0.19, ESCRITORIO[2], -0.25, 1.0)],
    'Prop_Estante': [('Housebird', 'Prop_Estante_Housebird', 0.36, -0.01, REP[2], -0.15, 1.0),
                     ('Housebird', 'Prop_Estante_Housebird2', 0.0, 0.0, REP[0], 0.2, 1.0),
                     ('Skullkid', 'Prop_Estante_Skullkid', -0.28, 0.0, REP[4], 0.3, 1.0)],
}
# Grafitis en SKULLEYGLYPH Bold (Oscar): polígonos de scripts/estilo/grafitis/*.json (texto_runas.mjs,
# unidades del em, y hacia abajo, línea base en y = 0, relleno par-impar). Cada uno: en qué material
# y cara va, el plano de la cara, el centro del texto (a lo ancho de la cara, z), su ancho en metros,
# qué palabras van en cada renglón, colores (contorno = throw-up), giro en grados y brinco de letras.
# Uno por muro: el tinaco, la espalda de la torre, la pared de atrás de la planta baja y el costado
# izquierdo de la torre.
GRAFITIS = [
    {'json': 'skulley_was_here.json', 'mat': 'tinaco', 'cara': '-Y', 'plano': TINACO[1] - 0.5, 'prof': 0.5,
     'centro': (TINACO[0], TINACO_CAMA + 0.46), 'ancho': 0.66, 'lineas': [[0], [1, 2]],
     'relleno': '#f5ff00', 'contorno': '#e0218a', 'giro': -4, 'brinco': 0.07, 'semilla': 3, 'gotas': 7},
    {'json': 'skulley_loves_bishu.json', 'mat': 'concreto', 'cara': '+Y', 'plano': TY1, 'prof': 0.06,
     'centro': ((TX0 + TX1) / 2, 2.05), 'ancho': 1.18, 'lineas': [[0], [1], [2]],
     'relleno': '#e0218a', 'contorno': '#f2efe6', 'giro': 3, 'brinco': 0.06, 'semilla': 5, 'gotas': 12},
    {'json': 'compren_bitcoin.json', 'mat': 'concreto', 'cara': '+Y', 'plano': BY1, 'prof': 0.06,
     'centro': (1.48, 1.05), 'ancho': 1.2, 'lineas': [[0], [1]],
     'relleno': '#1fb5ad', 'contorno': None, 'giro': -5, 'brinco': 0.05, 'semilla': 8, 'gotas': 10},
    {'json': 'fuck_ai.json', 'mat': 'concreto', 'cara': '-X', 'plano': TX0, 'prof': 0.06,
     'centro': (1.45, 1.6), 'ancho': 1.9, 'lineas': [[0, 1]],
     'relleno': '#151517', 'contorno': None, 'giro': 7, 'brinco': 0.06, 'semilla': 11, 'gotas': 9},
]
LUGARES = {  # mueble: (x, y, z, giro), en el espacio de Prop_Estudio
    'Prop_Escritorio': (-0.15, 1.9, PISO, 0.0),
    'Prop_Silla': (-0.12, 1.22, PISO, math.pi - 0.12),
    'Prop_AtrilIpad': (0.40, 2.02, PISO + ESCRITORIO[2] + 0.002, 0.0),
    'Prop_Taza': (0.42, 1.7, PISO + ESCRITORIO[2] + 0.002, 0.5),
    'Prop_Estudio_Computadora': (0.97, 2.02, PISO, 0.0),
    'Prop_Caballete': (-1.35, -0.42, PISO + 0.004, 0.6),
    'Prop_Estante': (-1.955, 1.2, PISO, math.pi / 2),
    'Prop_TableroBocetos': (1.62, BY1 - MURO - 0.03, 1.0, 0.0),
}


def cuerda_papel(a, b, comba, s):
    a, b = Vector(a), Vector(b)
    return a.lerp(b, s) + Vector((0, 0, -comba * 4 * s * (1 - s)))


# ---------------------------------------------------------------- ayudantes de geometría

def malla(nombre, bm, material, veta=None, bisel=None, segmentos=2, centro=(0, 0, 0), rot=(0, 0, 0), chueco=0.0, semilla=None):
    semilla = random.random() * 100 if semilla is None else semilla
    if chueco:
        P._chuequear(bm, chueco, semilla)
    o = P.objeto(nombre, bm, material)
    if veta:
        P.poner_veta(o, veta, azar=semilla % 1.0)
    if bisel:
        P.biselar(o, bisel, segmentos)
    P._colocar(o, centro, rot)
    return o


def girar_hacia(d):
    return Vector((0, 0, 1)).rotation_difference(Vector(d).normalized()).to_euler()


def pata(nombre, alto, arriba, abajo, material, centro=(0, 0, 0), rot=(0, 0, 0), chueco=0.004, bisel=0.01, cortes=1):
    """Una pata cuadrada que se afila hacia abajo (como la tele de la referencia): base en z = 0."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    for v in bm.verts:
        s = abajo + (arriba - abajo) * v.co.z
        v.co.x *= s
        v.co.y *= s
        v.co.z *= alto
    if cortes:
        bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).z) > alto * 0.5], cuts=cortes, use_grid_fill=True)
    return malla(nombre, bm, material, veta='Z', bisel=min(bisel, abajo * 0.42), centro=centro, rot=rot, chueco=chueco)


def pata_entre(nombre, a, b, arriba, abajo, material, **kw):
    a, b = Vector(a), Vector(b)
    return pata(nombre, (b - a).length, arriba, abajo, material, centro=a, rot=girar_hacia(b - a), **kw)


def tablita(nombre, largo, ancho, grueso, material, centro=(0, 0, 0), rot=(0, 0, 0), chueco=0.006, bisel=0.012, divisiones=1, segmentos=1, semilla=None):
    """Como P.tabla, pero con el número de segmentos del bisel (1 = chaflán): para piezas chicas
    que no aguantan los triángulos de un bisel redondo."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(largo, ancho, grueso), verts=bm.verts)
    if divisiones:
        bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).x) > largo * 0.5], cuts=divisiones, use_grid_fill=True)
    P._chuequear(bm, chueco, semilla)
    o = P.objeto(nombre, bm, material)
    P.poner_veta(o, 'X', azar=semilla % 1.0)
    if bisel:
        P.biselar(o, min(bisel, grueso * 0.45, ancho * 0.45), segmentos)
    P._colocar(o, centro, rot)
    return o


def palo(nombre, a, b, radio, material, lados=6, punta=1.0, chueco=0.006, bisel=0.012, cortes=1, segmentos=2):
    """Un palo o tronco de `a` a `b` (lados chicos: el bisel lo redondea)."""
    a, b = Vector(a), Vector(b)
    alto = (b - a).length
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=radio, radius2=radio * punta, depth=alto)
    bmesh.ops.translate(bm, vec=(0, 0, alto / 2), verts=bm.verts)
    if cortes:
        bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).z) > alto * 0.5], cuts=cortes)
    return malla(nombre, bm, material, veta='Z', bisel=min(bisel, radio * 0.4) if bisel else None, segmentos=segmentos,
                 centro=a, rot=girar_hacia(b - a), chueco=chueco)


def cilindro(nombre, radio, alto, material, lados=12, centro=(0, 0, 0), rot=(0, 0, 0), radio2=None, bisel=None, segmentos=1):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=radio, radius2=radio if radio2 is None else radio2, depth=alto)
    bmesh.ops.translate(bm, vec=(0, 0, alto / 2), verts=bm.verts)
    return malla(nombre, bm, material, veta='Z', bisel=bisel, segmentos=segmentos, centro=centro, rot=rot)


def torno(nombre, perfil, lados, materiales, tramos=None, centro=(0, 0, 0), rot=(0, 0, 0), deforma=None):
    """Una pieza de torno: `perfil` [(r, z), ...] de abajo hacia arriba, girado `lados` veces; un
    radio 0 cierra con abanico. `tramos[i]` es el material del tramo i (índice en `materiales`)."""
    bm = bmesh.new()
    anillos = []
    for r, z in perfil:
        if r <= 1e-6:
            anillos.append([bm.verts.new((0, 0, z))])
        else:
            anillos.append([bm.verts.new((math.cos(2 * math.pi * j / lados) * r, math.sin(2 * math.pi * j / lados) * r, z)) for j in range(lados)])
    for i in range(len(anillos) - 1):
        a, b = anillos[i], anillos[i + 1]
        caras = []
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            caras = [bm.faces.new((a[0], b[(j + 1) % lados], b[j])) for j in range(lados)]
        elif len(b) == 1:
            caras = [bm.faces.new((a[j], a[(j + 1) % lados], b[0])) for j in range(lados)]
        else:
            caras = [bm.faces.new((a[j], a[(j + 1) % lados], b[(j + 1) % lados], b[j])) for j in range(lados)]
        for f in caras:
            f.material_index = tramos[i] if tramos else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if deforma:
        deforma(bm)
    o = P.objeto(nombre, bm, materiales[0])
    for m in materiales[1:]:
        o.data.materials.append(m)
    P._colocar(o, centro, rot)
    return o


def tubo(nombre, puntos, radio, material, lados=5, ref=(0, 0, 1), tapas=True):
    """Un tubo (cuerda, asa, tubería) que pasa por `puntos`."""
    pts = [Vector(p) for p in puntos]
    bm = bmesh.new()
    anillos = []
    n = len(pts)
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.cross(Vector(ref))
        if a.length < 1e-4:
            a = t.orthogonal()
        a.normalize()
        b = t.cross(a)
        r = radio[i] if isinstance(radio, (list, tuple)) else radio
        anillos.append([bm.verts.new(p + (a * math.cos(2 * math.pi * j / lados) + b * math.sin(2 * math.pi * j / lados)) * r) for j in range(lados)])
    for i in range(n - 1):
        for j in range(lados):
            jj = (j + 1) % lados
            bm.faces.new((anillos[i][j], anillos[i][jj], anillos[i + 1][jj], anillos[i + 1][j]))
    if tapas:
        bm.faces.new(list(reversed(anillos[0])))
        bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return malla(nombre, bm, material)


def hoja(nombre, ancho, alto, material, celda, grueso=0.002, curva=0.0, caida=0.0, centro=(0, 0, 0), rot=(0, 0, 0)):
    """Una hoja de papel (local: x a lo ancho, z a lo alto, la cara del dibujo hacia -Y) con la UV
    `Dibujo`: su cara de enfrente ocupa `celda` (u0, v0, du, dv). `curva` levanta las orillas de los
    lados hacia el frente y `caida` despega la orilla de abajo."""
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    dib = bm.loops.layers.uv.new('Dibujo')
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(ancho, grueso, alto), verts=bm.verts)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).y) < grueso * 0.5], cuts=1, use_grid_fill=True)
    bm.normal_update()
    u0, v0, du, dv = celda
    for f in bm.faces:
        frente = f.normal.y < -0.5
        for lp in f.loops:
            x, _, z = lp.vert.co
            if frente:
                lp[dib].uv = (u0 + (x / ancho + 0.5) * du, v0 + (z / alto + 0.5) * dv)
            else:
                lp[dib].uv = (u0 + du * 0.03, v0 + dv * 0.03)
    for v in bm.verts:
        xn = v.co.x / (ancho / 2)
        zn = v.co.z / alto + 0.5
        v.co.y -= curva * xn * xn + caida * (1 - zn) ** 3
    o = malla(nombre, bm, material, centro=centro, rot=rot)
    o.data.uv_layers.active_index = 0
    o.data.uv_layers['UVMap'].active_render = True
    return o


def bandera(nombre, mat, centro, rot):
    """Una banderita de papel picado: cuelga de su orilla de arriba, abajo en picos."""
    w, h = BANDERA[0] / 2, BANDERA[1]
    perfil = [(-w, 0), (w, 0), (w, -h * 0.8), (w * 0.5, -h), (0, -h * 0.82), (-w * 0.5, -h), (-w, -h * 0.8)]
    bm = bmesh.new()
    fr = [bm.verts.new((x, -0.002, z)) for x, z in perfil]
    at = [bm.verts.new((x, 0.002, z)) for x, z in perfil]
    bm.faces.new(fr)
    bm.faces.new(list(reversed(at)))
    n = len(perfil)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((fr[i], fr[j], at[j], at[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for v in bm.verts:   # un poco ondulada
        v.co.y += math.sin(v.co.x * 22 + v.co.z * 9) * 0.006
    return malla(nombre, bm, mat, centro=centro, rot=rot)


def caja_ab(nombre, a, b, material, bisel=0.0, segmentos=1, veta=None):
    """Una caja de la esquina `a` a la esquina `b`."""
    a, b = Vector(a), Vector(b)
    lo = Vector((min(a.x, b.x), min(a.y, b.y), min(a.z, b.z)))
    hi = Vector((max(a.x, b.x), max(a.y, b.y), max(a.z, b.z)))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=hi - lo, verts=bm.verts)
    bmesh.ops.translate(bm, vec=(lo + hi) / 2, verts=bm.verts)
    o = P.objeto(nombre, bm, material)
    if veta:
        P.poner_veta(o, veta)
    if bisel:
        P.biselar(o, min(bisel, min(hi - lo) * 0.45), segmentos)
    return o


def concreto(nombre, a, b, material, chaflan=0.03):
    """Una pieza colada de la esquina `a` a la `b`: caja con las orillas achaflanadas (el chaflán de
    la cimbra), sin la cara de abajo si se apoya en el piso, con su atributo `Concreto`."""
    a, b = Vector(a), Vector(b)
    lo = Vector((min(a.x, b.x), min(a.y, b.y), min(a.z, b.z)))
    hi = Vector((max(a.x, b.x), max(a.y, b.y), max(a.z, b.z)))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=hi - lo, verts=bm.verts)
    bmesh.ops.translate(bm, vec=(lo + hi) / 2, verts=bm.verts)
    bm.normal_update()
    if lo.z <= 1e-4:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.5], context='FACES_ONLY')
    o = P.objeto(nombre, bm, material)
    P.poner_concreto(o)
    if chaflan:
        P.biselar(o, min(chaflan, min(hi - lo) * 0.3), 1)
    return o


def marco_vano(nombre, plano, cara, u0, u1, z0, z1, sale, marco, mat, vidrio):
    """Un vano cuadrado de caja salida (brutalista): cuatro piezas de concreto que salen `sale` de la
    cara (x = `plano` si `cara` es ±X, y = `plano` si es ±Y) alrededor de un vidrio hundido."""
    s = 1.0 if cara[0] == '+' else -1.0
    en_x = cara[1] == 'X'

    def esquinas(ua, ub, za, zb, d0, d1):
        if en_x:
            return (plano + s * d0, ua, za), (plano + s * d1, ub, zb)
        return (ua, plano + s * d0, za), (ub, plano + s * d1, zb)
    piezas = []
    for k, (ua, ub, za, zb) in enumerate(((u0 - marco, u1 + marco, z1, z1 + marco), (u0 - marco, u1 + marco, z0 - marco, z0),
                                          (u0 - marco, u0, z0, z1), (u1, u1 + marco, z0, z1))):
        piezas.append(concreto(f'{nombre}_{k}', *esquinas(ua, ub, za, zb, 0.0, sale), mat, chaflan=0.02))
    piezas.append(caja_ab(f'{nombre}_vidrio', *esquinas(u0, u1, z0, z1, 0.01, 0.025), vidrio))
    return piezas


def perfil(nombre, puntos, a, b, lado, material):
    """Un perfil de acero (puntos 2D: x hacia `lado`, y a lo alto del alma) extruido de `a` a `b`."""
    a, b = Vector(a), Vector(b)
    ez = (b - a).normalized()
    lado = Vector(lado)
    ex = (lado - ez * lado.dot(ez)).normalized()
    ey = ez.cross(ex)
    bm = bmesh.new()
    va = [bm.verts.new(a + ex * x + ey * y) for x, y in puntos]
    vb = [bm.verts.new(b + ex * x + ey * y) for x, y in puntos]
    n = len(puntos)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((va[i], va[j], vb[j], vb[i]))
    bm.faces.new(list(reversed(va)))
    bm.faces.new(vb)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def perfil_I(h, b, tw, tf):
    return [(-b / 2, -h / 2), (b / 2, -h / 2), (b / 2, -h / 2 + tf), (tw / 2, -h / 2 + tf), (tw / 2, h / 2 - tf), (b / 2, h / 2 - tf),
            (b / 2, h / 2), (-b / 2, h / 2), (-b / 2, h / 2 - tf), (-tw / 2, h / 2 - tf), (-tw / 2, -h / 2 + tf), (-b / 2, -h / 2 + tf)]


def perfil_C(h, b, t):
    return [(0, -h / 2), (b, -h / 2), (b, -h / 2 + t), (t, -h / 2 + t), (t, h / 2 - t), (b, h / 2 - t), (b, h / 2), (0, h / 2)]


def densa(o, k):
    """Más pixeles por metro para esta pieza en el atlas."""
    at = o.data.attributes.get('Densidad') or o.data.attributes.new('Densidad', 'FLOAT', 'FACE')
    at.data.foreach_set('value', np.full(len(o.data.polygons), k, np.float32))
    return o


def al_rincon(o, rincon=1):
    """Esta pieza no se acomoda en el atlas: todas sus caras van encimadas a un rincón (para lo de
    color plano o diminuto, como el neón y las grapas: cientos de islas chiquitas, cada una con su
    margen, se comían el atlas)."""
    at = o.data.attributes.get('Rincon') or o.data.attributes.new('Rincon', 'FLOAT', 'FACE')
    at.data.foreach_set('value', np.full(len(o.data.polygons), rincon, np.float32))
    return o


def unir(piezas, nombre, padre=None):
    if len(piezas) == 1:     # join necesita dos
        o = piezas[0]
        o.name = o.data.name = nombre
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    else:
        o = P.unir(piezas, nombre)
    if o.data.uv_layers:
        o.data.uv_layers.active_index = 0
        o.data.uv_layers[0].active_render = True
    if padre:
        o.parent = padre
    return o


# ---------------------------------------------------------------- materiales

def encima(mat, pintar):
    """Agrega capas a un material ya armado: `pintar(N, col, pos, geo)` recibe el color que llega a
    la emisión (lo de abajo) y regresa el nuevo."""
    nt = mat.node_tree
    em = next(n for n in nt.nodes if n.type == 'EMISSION')
    entrada = em.inputs['Color'].links[0].from_socket
    N = P.Nodos.__new__(P.Nodos)
    N.nt = nt
    N.x = 6000
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    N.l(pintar(N, entrada, tc.outputs['Object'], geo), em.inputs['Color'])
    return mat


def material_reja(nombre, paso=0.04):
    """La rejilla de la escalera: acero con los huecos oscuros en retícula en lo de arriba."""
    m = P.material_metal(nombre, paleta=ACERO, oxido=0.45)

    def pintar(N, col, pos, geo):
        sp = N.n('ShaderNodeSeparateXYZ')
        N.l(pos, sp.inputs[0])
        sn = N.n('ShaderNodeSeparateXYZ')
        N.l(geo.outputs['True Normal'], sn.inputs[0])
        arriba = P.suave(N, N.val('ABSOLUTE', sn.outputs['Z']), 0.5, 0.8)
        fx = N.val('MULTIPLY', N.val('ABSOLUTE', N.val('SUBTRACT', N.val('FRACT', N.val('DIVIDE', sp.outputs['X'], paso)), 0.5)), 2.0)
        fy = N.val('MULTIPLY', N.val('ABSOLUTE', N.val('SUBTRACT', N.val('FRACT', N.val('DIVIDE', sp.outputs['Y'], paso * 0.5)), 0.5)), 2.0)
        hueco = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, fx, 0.6, 0.75)), N.val('SUBTRACT', 1.0, P.suave(N, fy, 0.5, 0.65)))
        return N.mezcla(N.val('MULTIPLY', hueco, N.val('MULTIPLY', arriba, 0.85)), col, '#0d0f11')
    return encima(m, pintar)


def material_franjas(nombre):
    """Franjas de seguridad amarillas y negras, pintadas en diagonal y gastadas."""
    m = P.material_liso(nombre, '#d6b22c', claro='#ecd25a', oscuro='#8a6c14', desgaste=0.55)

    def pintar(N, col, pos, geo):
        sp = N.n('ShaderNodeSeparateXYZ')
        N.l(pos, sp.inputs[0])
        s = N.val('DIVIDE', N.val('ADD', N.val('ADD', sp.outputs['X'], sp.outputs['Y']), sp.outputs['Z']), 0.17)
        f = N.val('FRACT', N.val('ADD', s, N.val('MULTIPLY', N.ruido(pos, 6.0, detalle=1.0), 0.06)))
        negro = N.val('MULTIPLY', P.suave(N, f, 0.46, 0.52), N.val('SUBTRACT', 1.0, P.suave(N, f, 0.94, 0.99)))
        gasto = P.suave(N, N.ruido(pos, 14.0, detalle=2.0), 0.3, 0.42)
        return N.mezcla(N.val('MULTIPLY', negro, N.val('MULTIPLY', gasto, 0.92)), col, '#1b1b1e')
    return encima(m, pintar)


def material_cortina(nombre):
    """La cortina metálica: lámina pintada de turquesa que se cae y deja ver el óxido, con las
    costillas a lo alto pintadas (luz arriba de cada una, sombra abajo)."""
    m = P.material_madera(nombre, paleta=OXIDO, pintura=P.PINTURAS['turquesa'], desgaste=0.7, fino=0.5)

    def pintar(N, col, pos, geo):
        sp = N.n('ShaderNodeSeparateXYZ')
        N.l(pos, sp.inputs[0])
        f = N.val('FRACT', N.val('DIVIDE', sp.outputs['Z'], 0.075))
        sombra = N.val('SUBTRACT', 1.0, P.suave(N, f, 0.0, 0.12))
        luz = N.val('MULTIPLY', P.suave(N, f, 0.18, 0.28), N.val('SUBTRACT', 1.0, P.suave(N, f, 0.36, 0.46)))
        col = N.mezcla(N.val('MULTIPLY', sombra, 0.55), col, '#14201f')
        return N.mezcla(N.val('MULTIPLY', luz, 0.3), col, '#9fc7c0')
    return encima(m, pintar)


def material_lienzo(nombre, png):
    """La pintura del lienzo (la imagen de la tienda) leída por la UV `Dibujo`, tal cual: se hornea
    en el atlas sobre la cara del lienzo."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    img = bpy.data.images.load(png, check_existing=True)
    img.pack()
    uvn = N.n('ShaderNodeUVMap', uv_map='Dibujo')
    tex = N.n('ShaderNodeTexImage', image=img, extension='EXTEND', interpolation='Cubic')
    N.l(uvn.outputs['UV'], tex.inputs['Vector'])
    P._salida(N, tex.outputs['Color'])
    return m


def materiales():
    esten, _ = P.estencil_skulley()
    M = {
        'madera': P.material_madera('Taller_Madera'),
        'cubierta': P.material_madera('Taller_Cubierta', paleta=P.MADERA_CLARA, fino=0.6),
        'fina': P.material_madera('Taller_MaderaFina', fino=0.4),
        'clara': P.material_madera('Taller_MaderaClara', paleta=P.MADERA_CLARA, fino=0.4),
        'atril': P.material_madera('Taller_AtrilTabla', paleta=P.MADERA_CLARA, fino=0.4),
        'tabla_estante': P.material_madera('Taller_TablaEstante', fino=0.6),
        'metal': P.material_metal('Taller_Metal'),
        'acero_negro': P.material_metal('Taller_AceroNegro', paleta=ACERO_NEGRO, oxido=0.1),
        'lamina_negra': P.material_metal('Taller_LaminaNegra', paleta=LAMINA_NEGRA, oxido=0.0),
        'interior': P.material_liso('Taller_Interior', '#0b0c0f', claro='#16181d', oscuro='#050506', orilla='#2a2d33'),
        'plastico': P.material_liso('Taller_Plastico', '#1e1f23', claro='#34363c', oscuro='#0f1012', orilla='#6a6e76'),
        'goma': P.material_liso('Taller_Goma', '#151518', claro='#26272c', oscuro='#0a0a0c', orilla='#46484e'),
        'tela': P.material_liso('Taller_Tela', '#3a4049', claro='#555c67', oscuro='#22262c', orilla='#7e8794'),
        'aluminio': P.material_metal('Taller_Aluminio', paleta={'oscuro': '#3c4148', 'base': '#5e646d', 'claro': '#8a919b',
                                                                 'orilla': '#d2d8de', 'oxido': '#5e646d'}, oxido=0.0),
        'pantalla': P.material_brillo('Taller_Pantalla', '#2a3341'),
        'luz_boton': P.material_brillo('Taller_LuzBoton', '#f2f4f8'),
        'luz_vent': P.material_brillo('Taller_LuzVentiladores', '#3f6fd8'),
        'lienzo_tela': P.material_liso('Taller_LienzoTela', '#e7dfca', claro='#f3ecdb', oscuro='#b9ad92', orilla='#fbf6ea'),
        'lienzo_pintura': material_lienzo('Taller_LienzoPintura', LIENZO_PNG),
        'vinil_Skullkid': material_vinil('Taller_VinilBlanco', SKULLKID_BLANCO, oscuro='#cfc8ba', orilla='#ffffff'),
        'vinil_Housebird': material_vinil('Taller_VinilRosa', HOUSEBIRD_ROSA, orilla='#f7d6f8'),
        'bote': P.material_metal('Taller_Bote', oxido=0.35, paleta=dict(P.METAL, base='#505866')),
        'cuerda': P.material_liso('Taller_Cuerda', '#a68b5b'),
        'corcho': P.material_liso('Taller_Corcho', '#b07c4c', claro='#d29f6c', oscuro='#73492a', desgaste=0.35),
        'papel': P.material_liso('Taller_Papel', '#ece2c8'),
        'ceramica': P.material_liso('Taller_Ceramica', '#e6d7b4', desgaste=0.15),
        'barro': P.material_liso('Taller_Barro', '#a85f3a'),
        'cafe': P.material_liso('Taller_Cafe', '#2b170c', claro='#4d2f1a', oscuro='#160b05', orilla='#6b4a30'),
        'pelo': P.material_liso('Taller_Pelo', '#3d2b1c'),
        'cera': P.material_liso('Taller_Cera', '#efe4c8'),
        'flama': P.material_brillo('Taller_Flama', '#ffb13b'),
        'veladora': P.material_liso('Taller_Veladora', '#c8336e'),
    }
    for c, h in COLORES.items():
        M['frasco_' + c] = P.material_liso(f'Taller_Frasco_{c}', h)
    # la cabeza de Skulley, una sola vez y chiquita (Oscar: no abusar del esténcil)
    P.calca(M['atril'], esten, ATRIL_CALCA, 0.06, color='#3b2416', gasto=0.1)
    return M


def estarcido_flechas(ancho_px=520):
    """El estarcido de la caja: las dos flechas de "este lado arriba" con su raya, con los puentes del
    esténcil (la raya cortada donde la plantilla se sostiene)."""
    W, H = ancho_px, int(ancho_px * 0.62)
    u = W / 10.0
    lazos = []
    for cx in (3.0, 7.0):
        lazos.append([((cx - 0.55) * u, 1.5 * u), ((cx + 0.55) * u, 1.5 * u), ((cx + 0.55) * u, 3.55 * u), ((cx - 0.55) * u, 3.55 * u)])
        lazos.append([((cx - 1.55) * u, 3.85 * u), ((cx + 1.55) * u, 3.85 * u), (cx * u, 5.75 * u)])
    lazos.append([(1.0 * u, 0.35 * u), (9.0 * u, 0.35 * u), (9.0 * u, 1.05 * u), (1.0 * u, 1.05 * u)])
    m = _rellenar(lazos, W, H)
    for xb in (3.0 * u, 7.0 * u):                 # puentes: la raya cortada bajo cada flecha
        m[:int(1.2 * u), int(xb - 0.14 * u):int(xb + 0.14 * u)] = 0.0
    m = _desenfocar(m, 1)
    img = bpy.data.images.new('Estarcido_Flechas', W, H, alpha=True)
    img.pixels.foreach_set(np.stack([m, m, m, m], axis=2).astype(np.float32).ravel())
    img.pack()
    return img


def materiales_estudio():
    E = {
        'concreto': P.material_concreto('Estudio_Concreto'),
        'acero': P.material_metal('Estudio_Acero', paleta=ACERO, oxido=0.5),
        'oxido': P.material_metal('Estudio_Oxido', paleta=METAL_OXIDO, oxido=0.85),
        'fierro': P.material_metal('Estudio_Fierro', paleta=ACERO, oxido=0.7),
        'reja': material_reja('Estudio_Reja'),
        'franjas': material_franjas('Estudio_Franjas'),
        'cortina': material_cortina('Estudio_Cortina'),
        'puerta': P.material_madera('Estudio_Puerta', paleta=OXIDO, pintura=P.PINTURAS['rojo'], desgaste=0.55, fino=0.5),
        'vidrio': P.material_liso('Estudio_Vidrio', '#34424d', claro='#5d7484', oscuro='#1d262d', orilla='#8fa6b4'),
        'oscuro': P.material_liso('Estudio_Oscuro', '#141518', claro='#1f2125', oscuro='#0a0b0c', orilla='#2a2c30'),
        'tinaco': P.material_liso('Estudio_Tinaco', '#2b2d30', claro='#4a4e54', oscuro='#141517', desgaste=0.2, orilla='#7d838b'),
        'gas': P.material_liso('Estudio_TuboGas', '#d9a72a', claro='#efc95a', oscuro='#7d5a12', desgaste=0.35),
        'agua': P.material_liso('Estudio_TuboAgua', '#d8d3c4', claro='#efeadc', oscuro='#8f8a7c', desgaste=0.3),
        'lamina': P.material_madera('Estudio_Lamina', paleta=OXIDO, pintura=GRAFITO, desgaste=0.85, fino=0.6),
        'neon': P.material_brillo('Estudio_NeonVidrio', '#cfd6d4'),
        'cuerda': P.material_liso('Estudio_Cuerda', '#a68b5b'),
        'lampara': P.material_liso('Estudio_Lampara', '#2f5a48', desgaste=0.3),
        'foco': P.material_brillo('Estudio_Foco', '#ffe9a8'),
        'caja': P.material_madera('Estudio_Caja', paleta=P.MADERA_CLARA, fino=0.5),
        'caja2': P.material_madera('Estudio_Caja2', fino=0.5),
        'caja_estarcido': P.material_madera('Estudio_CajaEstarcido', paleta=P.MADERA_CLARA, fino=0.5),
    }
    for c, h in PAPEL_PICADO:
        E['papel_' + c] = P.material_liso(f'Estudio_Papel_{c}', h)
    for g in GRAFITIS:
        pintar_grafiti(E[g['mat']], g)
    x, z, ancho = ESTARCIDO
    P.calca(E['caja_estarcido'], estarcido_flechas(), (x, z), ancho, color='#1c1a17', gasto=0.45)
    return E


# ---------------------------------------------------------------- grafitis

def _rellenar(lazos, W, H):
    """Relleno par-impar de polígonos (en pixeles, con y hacia arriba) en una imagen de H × W."""
    img = np.zeros((H, W), np.float32)
    seg = []
    for l in lazos:
        a = np.asarray(l, np.float64)
        b = np.roll(a, -1, axis=0)
        seg.append(np.concatenate([a, b], axis=1))
    seg = np.concatenate(seg)
    x0, y0, x1, y1 = seg.T
    cols = np.arange(W) + 0.5
    for fila in range(H):
        yc = fila + 0.5
        cruza = (y0 <= yc) != (y1 <= yc)
        if not cruza.any():
            continue
        xs = np.sort(x0[cruza] + (yc - y0[cruza]) / (y1[cruza] - y0[cruza]) * (x1[cruza] - x0[cruza]))
        dentro = np.zeros(W, bool)
        for xa, xb in zip(xs[0::2], xs[1::2]):
            dentro |= (cols >= xa) & (cols < xb)
        img[fila] = dentro
    return img


def _dilatar(m, r):
    out = m.copy()
    for k in range(int(r)):
        p = np.pad(out, 1)
        if k % 2:
            out = np.maximum.reduce([p[1:-1, 1:-1], p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]])
        else:
            out = np.maximum.reduce([p[1:-1, 1:-1], p[:-2, :-2], p[2:, 2:], p[:-2, 2:], p[2:, :-2], p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]])
    return out


def _desenfocar(m, r):
    r = max(1, int(r))
    out = m
    for _ in range(2):
        for eje in (0, 1):
            p = np.pad(out, [(r, r) if e == eje else (0, 0) for e in (0, 1)], mode='edge')
            c = np.cumsum(p, axis=eje, dtype=np.float64)
            c = np.concatenate([np.zeros_like(np.take(c, [0], axis=eje)), c], axis=eje)
            n = out.shape[eje]
            out = ((np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=eje) - np.take(c, np.arange(0, n), axis=eje)) / (2 * r + 1)).astype(np.float32)
    return out


def imagen_grafiti(g, ancho_px=1100):
    """El grafiti como mapa RGBA: R = relleno, G = contorno (throw-up), B = rocío alrededor, A =
    escurrimientos. Las letras van chuecas y con brinco, en renglones, y el texto girado. Regresa la
    imagen, los pixeles por metro y dónde queda el centro del texto (en pixeles)."""
    d = json.load(open(os.path.join(AQUI, 'grafitis', g['json']), encoding='utf-8'))
    rnd = random.Random(g['semilla'])
    lazos = [[(float(x), float(y)) for x, y in l] for l in d['lazos']]
    cajas = sorted((min(p[0] for p in l), max(p[0] for p in l), i) for i, l in enumerate(lazos))
    letras = []
    for x0, x1, i in cajas:                 # lo que se encima a lo ancho es de la misma letra
        if letras and x0 <= letras[-1][1] + 0.01:
            letras[-1][1] = max(letras[-1][1], x1)
            letras[-1][2].append(i)
        else:
            letras.append([x0, x1, [i]])
    palabras = [[letras[0]]]
    for a, b in zip(letras, letras[1:]):
        (palabras.append([b]) if b[0] - a[1] > 0.2 else palabras[-1].append(b))
    renglones = []
    for k, linea in enumerate(g['lineas']):
        ls = [le for w in linea for le in palabras[w]]
        x_ini, x_fin = ls[0][0], ls[-1][1]
        pzs = []
        for x0, x1, idx in ls:
            cx = (x0 + x1) / 2
            dy = rnd.uniform(-g['brinco'], g['brinco'])
            ang = math.radians(rnd.uniform(-5, 5))
            ca, sa = math.cos(ang), math.sin(ang)
            for i in idx:
                pts = []
                for x, y in lazos[i]:
                    xr, yr = x - cx, y + 0.36       # gira sobre el centro de la letra
                    xr, yr = xr * ca - yr * sa, xr * sa + yr * ca
                    pts.append((xr + cx - (x_ini + x_fin) / 2, -(yr - 0.36 + dy) - k * 1.05))
                pzs.append(pts)
        renglones.append(pzs)
    todos = [l for r in renglones for l in r]
    giro = math.radians(g['giro'])
    cg, sg = math.cos(giro), math.sin(giro)
    todos = [[(x * cg - y * sg, x * sg + y * cg) for x, y in l] for l in todos]
    xs = [p[0] for l in todos for p in l]
    ys = [p[1] for l in todos for p in l]
    tx0, tx1, ty0, ty1 = min(xs), max(xs), min(ys), max(ys)
    ppe = ancho_px / (tx1 - tx0)
    margen, abajo = 0.35 * ppe, 0.85 * ppe
    W = int(ancho_px + 2 * margen)
    H = int((ty1 - ty0) * ppe + margen + abajo)
    ox, oy = margen - tx0 * ppe, abajo - ty0 * ppe
    s = 2                                    # con supermuestreo, para la orilla
    relleno = _rellenar([[((ox + x * ppe) * s, (oy + y * ppe) * s) for x, y in l] for l in todos], W * s, H * s)
    relleno = relleno.reshape(H, s, W, s).mean(axis=(1, 3))
    duro = (relleno > 0.5).astype(np.float32)
    contorno = _desenfocar(_dilatar(duro, 0.075 * ppe), 1.5) if g['contorno'] else np.zeros_like(relleno)
    rocio = np.clip(_desenfocar(_dilatar(duro, 0.09 * ppe), 0.13 * ppe) * 1.3, 0, 1)
    gotas = np.zeros_like(relleno)
    filo = (duro[1:] > 0.5) & (duro[:-1] < 0.5)          # orilla de abajo de las letras (y arriba)
    filas, columnas = np.nonzero(filo)
    if len(filas):
        for _ in range(g['gotas']):
            k = rnd.randrange(len(filas))
            y, x = filas[k] + 1, columnas[k]
            largo = int(rnd.uniform(0.15, 0.75) * ppe)
            w0 = rnd.uniform(0.03, 0.055) * ppe
            for j in range(largo):
                t = j / max(largo, 1)
                w = max(1.0, w0 * (1 - 0.55 * t))
                xc = x + math.sin(j * 0.05) * 1.5
                yy = y - j
                if yy < 0:
                    break
                gotas[yy, max(0, int(xc - w / 2)):int(xc + w / 2) + 1] = 1.0
            yy = max(0, y - largo)
            for dy in range(-int(w0), int(w0) + 1):
                ancho_gota = int(math.sqrt(max(w0 * w0 - dy * dy, 0)))
                if 0 <= yy + dy < H:
                    gotas[yy + dy, max(0, x - ancho_gota):x + ancho_gota + 1] = 1.0
        gotas = _desenfocar(gotas, 1)
    img = bpy.data.images.new('Grafiti_' + os.path.splitext(g['json'])[0], W, H, alpha=True)
    img.colorspace_settings.name = 'Non-Color'
    img.alpha_mode = 'CHANNEL_PACKED'
    img.pixels.foreach_set(np.stack([relleno, contorno, rocio, gotas], axis=2).astype(np.float32).ravel())
    img.pack()
    ppm = ancho_px / g['ancho']
    centro_px = ((ox + (tx0 + tx1) / 2 * ppe), (oy + (ty0 + ty1) / 2 * ppe))
    return img, ppm, centro_px


def pintar_grafiti(mat, g):
    """Pinta el grafiti encima del material, proyectado de frente sobre su cara: solo en las caras que
    miran hacia `cara` y a menos de `prof` de su plano. Aerosol en acuarela: rocío de puntitos del
    color alrededor, contorno de otro color si es throw-up, relleno que no cubre parejo con el
    pigmento juntado en la orilla, escurrimientos y el grano del papel encima."""
    img, ppm, (cx, cy) = imagen_grafiti(g)
    W, H = img.size
    der = {'-Y': 1, '+Y': -1, '+X': 1, '-X': -1}[g['cara']]
    signo = 1.0 if g['cara'][0] == '+' else -1.0
    en_y = g['cara'][1] == 'Y'

    def pintar(N, col, pos, geo):
        sp = N.n('ShaderNodeSeparateXYZ')
        N.l(pos, sp.inputs[0])
        sn = N.n('ShaderNodeSeparateXYZ')
        N.l(geo.outputs['True Normal'], sn.inputs[0])
        h, prof, nn = (sp.outputs['X'], sp.outputs['Y'], sn.outputs['Y']) if en_y else (sp.outputs['Y'], sp.outputs['X'], sn.outputs['X'])
        u = N.val('DIVIDE', N.val('ADD', cx, N.val('MULTIPLY', N.val('SUBTRACT', h, g['centro'][0]), der * ppm)), W)
        v = N.val('DIVIDE', N.val('ADD', cy, N.val('MULTIPLY', N.val('SUBTRACT', sp.outputs['Z'], g['centro'][1]), ppm)), H)
        uv = N.n('ShaderNodeCombineXYZ')
        N.l(u, uv.inputs[0])
        N.l(v, uv.inputs[1])
        tex = N.n('ShaderNodeTexImage', image=img, extension='CLIP', interpolation='Linear')
        N.l(uv.outputs[0], tex.inputs['Vector'])
        sc = N.n('ShaderNodeSeparateColor')
        N.l(tex.outputs['Color'], sc.inputs[0])
        R, G, B, A = sc.outputs[0], sc.outputs[1], sc.outputs[2], tex.outputs['Alpha']
        frente = P.suave(N, N.val('MULTIPLY', nn, signo), 0.3, 0.6)
        cerca = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', prof, g['plano'])), g['prof'], g['prof'] * 1.5))
        m = N.val('MULTIPLY', frente, cerca)
        jit = N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pos, 35.0, detalle=2.0), 0.5), 0.3)
        cuerpo = N.val('MAXIMUM', P.suave(N, N.val('ADD', R, jit), 0.42, 0.58), P.suave(N, N.val('ADD', A, N.val('MULTIPLY', jit, 0.5)), 0.35, 0.6))
        puntitos = N.val('ADD', 0.45, N.val('MULTIPLY', P.suave(N, N.ruido(pos, 260.0, detalle=1.0), 0.4, 0.62), 0.55))
        c = P.srgb(g['relleno'])
        oscuro = (c[0] * 0.62, c[1] * 0.62, c[2] * 0.62, 1.0)
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', B, puntitos), N.val('MULTIPLY', m, 0.42)), col, g['relleno'])
        if g['contorno']:
            borde = P.suave(N, N.val('ADD', G, jit), 0.42, 0.58)
            col = N.mezcla(N.val('MULTIPLY', borde, N.val('MULTIPLY', m, 0.95)), col, g['contorno'])
        pintura = N.mezcla(N.val('MULTIPLY', P.suave(N, N.ruido(pos, 5.0, detalle=2.0), 0.55, 0.75), 0.35), g['relleno'], oscuro)
        col = N.mezcla(N.val('MULTIPLY', cuerpo, N.val('MULTIPLY', m, 0.93)), col, pintura)
        orilla = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', N.val('ADD', R, jit), 0.5)), 0.0, 0.1))
        col = N.mezcla(N.val('MULTIPLY', orilla, N.val('MULTIPLY', m, 0.35)), col, oscuro)
        return P.grano(N, col, pos, 0.06)
    encima(mat, pintar)
    print(f'  grafiti "{os.path.splitext(g["json"])[0]}": {W} × {H} px, {g["ancho"]:.2f} m de ancho en {g["cara"]}')


# ---------------------------------------------------------------- el letrero de neón ESTUDIO
# (las letras de bloque como las de la laguna y el foro, con la receta del foro)

def simplificar(pts, tol):
    """Douglas-Peucker: quita los puntos que no cambian la forma más de `tol`."""
    if len(pts) < 3:
        return list(pts)
    a, b = pts[0], pts[-1]
    ab = b - a
    largo2 = ab.length_squared
    peor, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        t = 0.0 if largo2 < 1e-12 else max(0.0, min(1.0, (pts[i] - a).dot(ab) / largo2))
        d = (pts[i] - (a + ab * t)).length
        if d > peor:
            peor, idx = d, i
    if peor <= tol:
        return [a, b]
    return simplificar(pts[:idx + 1], tol)[:-1] + simplificar(pts[idx:], tol)


def simplificar_lazo(pts, tol):
    lejos = max(range(len(pts)), key=lambda k: (pts[k] - pts[0]).length)
    return simplificar(pts[:lejos + 1], tol)[:-1] + simplificar(pts[lejos:] + [pts[0]], tol)[:-1]


def orientar(pts, antihorario):
    area = sum(p.x * q.y - q.x * p.y for p, q in zip(pts, pts[1:] + pts[:1])) / 2
    return pts if (area > 0) == antihorario else pts[::-1]


def dentro_de(p, lazo):
    adentro = False
    for a, b in zip(lazo, lazo[1:] + lazo[:1]):
        if (a.y > p.y) != (b.y > p.y) and p.x < a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y):
            adentro = not adentro
    return adentro


def correr_lazo(pts, d):
    """El lazo corrido `d` hacia su izquierda, con inglete (con los contornos orientados, hacia el cuerpo de la letra)."""
    n = len(pts)
    out = []
    for i in range(n):
        a, p, b = pts[i - 1], pts[i], pts[(i + 1) % n]
        t1, t2 = (p - a).normalized(), (b - p).normalized()
        n1, n2 = Vector((-t1.y, t1.x)), Vector((-t2.y, t2.x))
        m = n1 + n2
        m = n1 if m.length < 1e-6 else m.normalized()
        out.append(p + m * (d / max(m.dot(n1), 0.45)))
    return out


def letra_bloque(nombre, lazos, material, y_f, hondo, pared):
    """Una letra de bloque de lámina: costados por fuera y por dentro (con su grueso `pared`), el filo
    del frente, el fondo que se ve por el frente abierto y la espalda. `lazos` = [(puntos (x, z), hueco)]."""
    bm = bmesh.new()
    y_b, y_i = y_f + hondo, y_f + hondo - pared
    atras, fondo = [], []
    for pts, hueco in lazos:
        L = orientar(pts, not hueco)
        Li = correr_lazo(L, pared)
        vf = [bm.verts.new((p.x, y_f, p.y)) for p in L]
        vb = [bm.verts.new((p.x, y_b, p.y)) for p in L]
        wf = [bm.verts.new((p.x, y_f, p.y)) for p in Li]
        wi = [bm.verts.new((p.x, y_i, p.y)) for p in Li]
        n = len(L)
        for k in range(n):
            m = (k + 1) % n
            bm.faces.new((vf[k], vf[m], vb[m], vb[k]))
            bm.faces.new((wf[k], wi[k], wi[m], wf[m]))
            bm.faces.new((vf[k], wf[k], wf[m], vf[m]))
        atras += [bm.edges.get((vb[k], vb[(k + 1) % n])) for k in range(n)]
        fondo += [bm.edges.get((wi[k], wi[(k + 1) % n])) for k in range(n)]
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=atras)
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=fondo)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def tubo_cerrado(nombre, pts, radio, material, lados=4, normal=Vector((0, -1, 0))):
    """El tubo oxidado del contorno: cerrado sobre sí mismo, en el plano perpendicular a `normal`."""
    n = len(pts)
    bm = bmesh.new()
    anillos = []
    for i in range(n):
        t = (pts[(i + 1) % n] - pts[(i - 1) % n]).normalized()
        b = t.cross(normal).normalized()
        anillos.append([bm.verts.new(pts[i] + normal * (math.cos(2 * math.pi * j / lados + math.pi / 4) * radio)
                                     + b * (math.sin(2 * math.pi * j / lados + math.pi / 4) * radio)) for j in range(lados)])
    for i in range(n):
        A, B = anillos[i], anillos[(i + 1) % n]
        for j in range(lados):
            k = (j + 1) % lados
            bm.faces.new((A[j], A[k], B[k], B[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def filas_neon(nombre, filas, a_m, y, radio, lados, material):
    """Los tubos de neón de una letra: rectos y horizontales, con la punta en un pico corto."""
    bm = bmesh.new()
    for x0, x1, yy in filas:
        (ax, az), (bx, _) = a_m(x0, yy), a_m(x1, yy)
        p0, p1 = Vector((ax, y, az)), Vector((bx, y, az))
        anillos = [[bm.verts.new(p + Vector((0.0, math.cos(2 * math.pi * j / lados), math.sin(2 * math.pi * j / lados))) * radio) for j in range(lados)]
                   for p in (p0, p1)]
        for j in range(lados):
            k = (j + 1) % lados
            bm.faces.new((anillos[0][j], anillos[0][k], anillos[1][k], anillos[1][j]))
        for p, ring, s in ((p0, anillos[0], -1.0), (p1, anillos[1], 1.0)):
            polo = bm.verts.new(p + Vector((s * radio * 0.9, 0.0, 0.0)))
            for j in range(lados):
                bm.faces.new((ring[j], ring[(j + 1) % lados], polo))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    o.data.polygons.foreach_set('use_smooth', np.ones(len(o.data.polygons), bool))
    return o


def grapas(nombre, lazo, y, radio, cada, material):
    """Grapitas que sujetan el tubo del contorno a la lámina, una cada `cada` m, del lado de la letra."""
    bm = bmesh.new()
    n = len(lazo)
    largo = [0.0]
    for a, b in zip(lazo, lazo[1:] + lazo[:1]):
        largo.append(largo[-1] + (b - a).length)
    meta, k = cada * 0.5, 0
    while meta < largo[-1]:
        while largo[k + 1] < meta:
            k += 1
        a, b = lazo[k], lazo[(k + 1) % n]
        t = (b - a).normalized()
        p = a.lerp(b, (meta - largo[k]) / max(largo[k + 1] - largo[k], 1e-9))
        izq = Vector((-t.y, t.x))
        c = p + izq * (radio * 0.45)
        M = Matrix((
            (izq.x * radio * 2.7, 0.0, t.x * 0.011, c.x),
            (0.0, radio * 2.5, 0.0, y),
            (izq.y * radio * 2.7, 0.0, t.y * 0.011, c.y),
            (0.0, 0.0, 0.0, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)
        meta += cada
    return P.objeto(nombre, bm, material)


def letrero(E):
    """ESTUDIO en runas de SKULLEYGLYPH como letras de neón de bloque (Oscar, con su referencia): lámina
    honda pintada de grafito sobre óxido, el frente abierto lleno de filas de neón y un tubo oxidado en
    el contorno con grapitas, sobre un bastidor de fierro arriba de la torre. Regresa (lo fijo, las
    filas de cada letra)."""
    d = json.load(open(NEON_JSON, encoding='utf-8'))
    L_ = LETRERO
    s = L_['ancho'] / d['ancho']

    def a_m(x, y):
        return (L_['x'] + x * s, L_['base'] + (d['y1'] - y) * s)
    y_f = L_['frente']
    hondo, pared = L_['hondo'] * s, L_['pared'] * s
    fijos, neones = [], []
    for i, letra in enumerate(d['letras']):
        lazos = [(simplificar_lazo([Vector(a_m(x, y)) for x, y in c['pts']], L_['tol'] * s), c.get('hueco', False)) for c in letra['contornos']]
        caja = letra_bloque(f'letra_{i}', lazos, E['lamina'], y_f, hondo, pared)
        P.poner_veta(caja, 'Z')
        fijos.append(densa(caja, 1.8))
        exteriores = [pts for pts, hueco in lazos if not hueco]
        y_m = y_f + L_['marco_atras'] * s
        for j, lazo in enumerate(letra['marco']):
            pts = simplificar_lazo([Vector(a_m(x, y)) for x, y in lazo], L_['tol_marco'] * s)
            hueco = any(dentro_de(pts[0], e) for e in exteriores)
            pts = orientar(pts, not hueco)
            fijos.append(tubo_cerrado(f'marco_{i}_{j}', [Vector((p.x, y_m, p.y)) for p in pts], L_['r_marco'] * s, E['oxido']))
            fijos.append(al_rincon(grapas(f'grapas_{i}_{j}', pts, y_m, L_['r_marco'] * s, L_['grapa'] * s, E['fierro']), 2))
        neones.append(al_rincon(filas_neon(f'Prop_Estudio_Neon_{i}', letra['filas'], a_m, y_f + L_['metido'] * s, L_['r_fila'] * s, 6, E['neon']), 1))
    # el bastidor: una repisa de ángulo donde se paran, tres postes en la azotea de la torre, dos
    # soleras detrás de las letras, un tirante para lo que vuela sobre la caja y el transformador
    fie = E['fierro']
    z0 = L_['base']
    y_b = y_f + hondo + 0.025
    x0, x1 = L_['x'] - L_['ancho'] / 2, L_['x'] + L_['ancho'] / 2
    fijos.append(caja_ab('repisa', (x0, y_f - 0.01, z0 - 0.012), (x1, y_f + hondo + 0.04, z0), fie, bisel=0.002))
    fijos.append(caja_ab('repisa_ceja', (x0, y_f - 0.012, z0 - 0.06), (x1, y_f - 0.002, z0), fie, bisel=0.002))
    for x in POSTES_LETRERO:
        fijos.append(caja_ab(f'poste_{x}', (x - 0.025, y_b - 0.025, TZ1), (x + 0.025, y_b + 0.025, z0 + 0.56), fie, bisel=0.004))
        fijos.append(caja_ab(f'placa_{x}', (x - 0.06, y_b - 0.06, TZ1), (x + 0.06, y_b + 0.06, TZ1 + 0.01), fie, bisel=0.002))
        fijos.append(caja_ab(f'pata_repisa_{x}', (x - 0.02, y_f + 0.02, TZ1), (x + 0.02, y_f + 0.06, z0 - 0.012), fie, bisel=0.003))
    for z in (z0 + 0.14, z0 + 0.5):
        fijos.append(caja_ab(f'solera_{z}', (x0 + 0.05, y_b - 0.015, z - 0.02), (x1 - 0.05, y_b + 0.015, z + 0.02), fie, bisel=0.003))
    # lo que vuela a la derecha de la torre lo carga un tirante de la solera de arriba a la azotea
    pie = (TX1 - 0.1, y_b, TZ1 + 0.01)
    fijos.append(palo('tirante', (x1 - 0.12, y_b, z0 + 0.5), pie, 0.014, fie, lados=6, cortes=0, bisel=None, chueco=0.0))
    fijos.append(caja_ab('tirante_placa', (pie[0] - 0.06, y_b - 0.05, TZ1), (pie[0] + 0.06, y_b + 0.05, TZ1 + 0.01), fie))
    # el transformador: le llega la luz por un tubo que sale de la torre y su cable sube por el poste de en medio a la solera
    tx0, tx1, ty0, ty1 = -3.6, -3.22, 0.9, 1.12
    fijos.append(caja_ab('transformador', (tx0, ty0, TZ1), (tx1, ty1, TZ1 + 0.2), fie, bisel=0.012))
    xa = (tx0 + tx1) / 2
    fijos.append(cilindro('transformador_pasamuro', 0.03, 0.02, fie, lados=8, centro=(xa, ty1 + 0.1, TZ1)))
    fijos.append(tubo('transformador_tubo', [(xa, ty1 + 0.1, TZ1 - 0.02), (xa, ty1 + 0.1, TZ1 + 0.06), (xa, ty1 + 0.06, TZ1 + 0.1),
                                            (xa, ty1 - 0.01, TZ1 + 0.1)], 0.018, E['oxido'], lados=8, ref=(1, 0, 0)))
    xp = POSTES_LETRERO[1] - 0.034
    fijos.append(tubo('cable_neon', [(xp, ty0 + 0.01, TZ1 + 0.1), (xp, ty0 - 0.08, TZ1 + 0.02), (xp, y_b + 0.08, TZ1 + 0.012),
                                     (xp, y_b + 0.02, TZ1 + 0.06), (xp, y_b + 0.02, z0 + 0.1), (xp, y_b - 0.01, z0 + 0.13)], 0.009, fie, lados=5,
                      ref=(1, 0, 0)))
    for z in (TZ1 + 0.35, z0 - 0.1):
        fijos.append(caja_ab('cincho', (xp - 0.012, y_b - 0.028, z - 0.008), (POSTES_LETRERO[1] + 0.028, y_b + 0.034, z + 0.008), fie))
    print(f'  letrero: {d["ancho"] * s:.2f} m de ancho, de {z0:.2f} a {z0 + (d["y1"] - d["y0"]) * s:.2f} m, '
          f'{hondo * 100:.0f} cm de hondo, {sum(len(l["filas"]) for l in d["letras"])} filas')
    return fijos, neones


# ---------------------------------------------------------------- el Estudio

def nariz(S, tramo, y):
    """Lo alto de la línea de narices de un tramo de la escalera en `y`."""
    m = S['peralte'] / S['huella']
    if tramo == 1:
        return S['peralte'] + m * (y - S['y1'])
    return S['zl'] + S['peralte'] + m * (S['yl0'] - y)


def escalera(E):
    """La escalera de reja en zigzag junto al muro derecho, en dos carriles para que se pueda subir:
    el tramo 1 arranca en el piso (su primer peralte desde el piso, por donde se llega caminando) y
    sube hacia atrás por el carril de afuera hasta el descanso, que cruza los dos carriles; el tramo 2
    regresa por el carril de adentro (pegado al muro, sin ventanas) hasta la llegada, junto al hueco
    del pretil por donde se entra a la azotea. 19 peraltes iguales (ESCALERA) del piso a la azotea.
    Las zancas de canaleta del tramo 1 se apoyan en placas en el piso y en el marco del descanso; las
    del tramo 2, en la cubierta del descanso y en el marco de la llegada. Los dos descansos van en
    marcos de canaleta sobre postes con placa al piso, los de la llegada con crucetas."""
    p = []
    S = ESCALERA
    pe, hu = S['peralte'], S['huella']
    xb0, xb1 = S['adentro']
    xa0, xa1 = S['afuera']
    y1, yl0, yl1, yt0, yt1, zl = S['y1'], S['yl0'], S['yl1'], S['yt0'], S['yt1'], S['zl']
    ace = E['acero']
    for k in range(1, S['n1']):          # tramo 1: hacia atrás, por afuera
        ya, z = y1 + (k - 1) * hu, k * pe
        p.append(densa(caja_ab(f'huella1_{k}', (xa0, ya, z - 0.03), (xa1, ya + hu - 0.008, z), E['reja']), 1.5))
    for k in range(1, S['n2']):          # tramo 2: hacia el frente, por adentro
        yb, z = yl0 - (k - 1) * hu, zl + k * pe
        p.append(densa(caja_ab(f'huella2_{k}', (xb0, yb - hu + 0.008, z - 0.03), (xb1, yb, z), E['reja']), 1.5))
    p.append(densa(caja_ab('descanso', (xb0, yl0, zl - 0.04), (xa1, yl1, zl), E['reja']), 1.5))
    p.append(densa(caja_ab('llegada', (xb0, yt0, LOSA1 - 0.04), (xb1, yt1, LOSA1), E['reja']), 1.5))
    # narices pintadas de seguridad: el primer escalón y la orilla de la llegada
    p.append(caja_ab('nariz_1', (xa0, y1 - 0.004, pe - 0.05), (xa1, y1 + 0.03, pe + 0.003), E['franjas']))
    p.append(caja_ab('nariz_llegada', (xb0, yt1 - 0.03, LOSA1 - 0.05), (xb1, yt1 + 0.004, LOSA1 + 0.003), E['franjas']))
    # zancas: canaleta de 17 cm, su orilla de arriba 2 cm sobre la línea de narices
    C = perfil_C(0.17, 0.055, 0.008)
    for x, lado in ((xa0 - 0.004, (1, 0, 0)), (xa1 + 0.004, (-1, 0, 0))):
        ya = y1 - 0.02
        p.append(perfil('zanca1', C, (x, ya, nariz(S, 1, ya) - 0.08), (x, yl0, zl - 0.08), lado, ace))
        xc_ = x + lado[0] * 0.025
        p.append(caja_ab('zanca1_placa', (xc_ - 0.035, ya - 0.08, 0.0), (xc_ + 0.035, ya + 0.1, 0.01), ace))
    for x, lado in ((xb0 - 0.004, (1, 0, 0)), (xb1 + 0.004, (-1, 0, 0))):
        ya = yl0 + 0.02
        p.append(perfil('zanca2', C, (x, ya, nariz(S, 2, ya) - 0.08), (x, yt1, LOSA1 - 0.08), lado, ace))
        p.append(caja_ab('zanca2_angulo', (x - 0.03, ya - 0.02, zl), (x + 0.03, ya + 0.12, zl + 0.01), ace))
    # los marcos de los descansos (canaleta en las cuatro orillas, bajo la rejilla)
    for (ya, yb, z, x0, x1) in ((yl0, yl1, zl, xb0, xa1), (yt0, yt1, LOSA1, xb0, xb1)):
        zc = z - 0.04 - 0.085
        p.append(perfil('marco_descanso', C, (x0, ya + 0.004, zc), (x1, ya + 0.004, zc), (0, 1, 0), ace))
        p.append(perfil('marco_descanso', C, (x0, yb - 0.004, zc), (x1, yb - 0.004, zc), (0, -1, 0), ace))
        p.append(perfil('marco_descanso', C, (x0 + 0.004, ya, zc), (x0 + 0.004, yb, zc), (1, 0, 0), ace))
        p.append(perfil('marco_descanso', C, (x1 - 0.004, ya, zc), (x1 - 0.004, yb, zc), (-1, 0, 0), ace))
    # postes de tubo cuadrado bajo las esquinas de los marcos, con placa al piso
    d = 0.06
    postes = [((xa1 - d, yl0 + d), zl), ((xa1 - d, yl1 - d), zl), ((xb0 + d, yl1 - d), zl), ((xb0 + d, yl0 + d), zl),
              ((xb0 + d, yt0 + d), LOSA1), ((xb1 - d, yt0 + d), LOSA1), ((xb1 - d, yt1 - d), LOSA1), ((xb0 + d, yt1 - d), LOSA1)]
    for (x, y), z in postes:
        p.append(caja_ab('poste', (x - 0.035, y - 0.035, 0.01), (x + 0.035, y + 0.035, z - 0.21), ace))
        p.append(caja_ab('placa', (x - 0.06, y - 0.06, 0.0), (x + 0.06, y + 0.06, 0.01), ace))
    # crucetas de la llegada (sus postes son altos): en el frente y en el costado de afuera
    for (xa_, ya_), (xb_, yb_) in (((xb0 + d, yt0 + d), (xb1 - d, yt0 + d)), ((xb1 - d, yt0 + d), (xb1 - d, yt1 - d))):
        for z0, z1 in ((0.25, 1.75), (1.75, LOSA1 - 0.3)):
            p.append(palo('cruceta_llegada', (xa_, ya_, z0), (xb_, yb_, z1), 0.012, ace, lados=4, cortes=0, bisel=None, chueco=0.0))
            p.append(palo('cruceta_llegada', (xb_, yb_, z0), (xa_, ya_, z1), 0.012, ace, lados=4, cortes=0, bisel=None, chueco=0.0))
    # barandales de tubo: los dos lados del tramo 1, el de afuera sigue por el descanso; el de adentro
    # del tramo 2 sigue por la llegada (del lado del muro protege el muro)
    alto = 0.92
    xo, xi1, xi2 = xa1 - 0.012, xa0 + 0.012, xb1 - 0.012
    rieles = [
        ('barandal_afuera', [(xo, y1 + 0.02, nariz(S, 1, y1) + alto), (xo, yl0, zl + alto), (xo, yl1 - 0.012, zl + alto),
                             (xb0 + 0.02, yl1 - 0.012, zl + alto)]),
        ('barandal_tramo1', [(xi1, y1 + 0.02, nariz(S, 1, y1) + alto), (xi1, yl0, zl + alto)]),
        ('barandal_tramo2', [(xi2, yl0, zl + alto), (xi2, yt1, LOSA1 + alto), (xi2, yt0 + 0.012, LOSA1 + alto),
                             (xb0 + 0.02, yt0 + 0.012, LOSA1 + alto)]),
    ]
    for nombre, pts in rieles:
        p.append(tubo(nombre, pts, 0.02, ace, lados=6, ref=(1, 0, 0)))
    barrotes = []
    for x, tramo, ya, yb in ((xo, 1, y1 + 0.02, yl0), (xi1, 1, y1 + 0.02, yl0), (xi2, 2, yl0, yt1)):
        for t in (0.0, 0.5, 1.0):
            y = ya + (yb - ya) * t
            barrotes.append((x, y, (nariz(S, tramo, y) if t < 1.0 else (zl if tramo == 1 else LOSA1)) + (0.02 if t < 1.0 else 0.0)))
    barrotes += [(xo, yl1 - 0.012, zl), (xb0 + 0.02, yl1 - 0.012, zl), ((xo + xb0) / 2, yl1 - 0.012, zl),
                 (xi2, yt0 + 0.012, LOSA1), (xb0 + 0.02, yt0 + 0.012, LOSA1)]
    for x, y, z in barrotes:
        p.append(tubo('barrote', [(x, y, z), (x, y, z + alto)], 0.016, ace, lados=6))
    return p


def caja_madera(nombre, x0, y0, z0, ancho, fondo, alto, mat, giro=0.0):
    """Una caja de tablillas: dos tablas por costado con su rendija, la tapa de tres tablas y cuatro
    esquineros por dentro donde se clavan. Base en z0, girada `giro` sobre su centro."""
    pz = []
    t, g = 0.018, 0.012
    h = (alto - t - g) / 2
    for k in range(2):
        zc = h / 2 + k * (h + g)
        for sy in (-1, 1):
            pz.append(tablita(f'{nombre}_frente{k}{sy}', ancho, h, t, mat, centro=(0, sy * (fondo / 2 - t / 2), zc),
                              rot=(math.pi / 2, 0, 0), bisel=0.0, divisiones=0))
        for sx in (-1, 1):
            pz.append(tablita(f'{nombre}_lado{k}{sx}', fondo - 2 * t, h, t, mat, centro=(sx * (ancho / 2 - t / 2), 0, zc),
                              rot=(math.pi / 2, 0, math.pi / 2), bisel=0.0, divisiones=0))
    w = (fondo - 0.016) / 3
    for k in range(3):
        pz.append(tablita(f'{nombre}_tapa{k}', ancho - 0.008, w - 0.008, t, mat, centro=(0, -fondo / 2 + 0.008 + w * (k + 0.5), alto - t / 2),
                          bisel=0.0, divisiones=0))
    a = 0.04
    for sx in (-1, 1):
        for sy in (-1, 1):
            xa, ya = sx * (ancho / 2 - t), sy * (fondo / 2 - t)
            pz.append(caja_ab(f'{nombre}_esquinero', (xa, ya, 0.0), (xa - sx * a, ya - sy * a, alto - t), mat, veta='Z'))
    M = Matrix.Translation((x0 + ancho / 2, y0 + fondo / 2, z0)) @ Matrix.Rotation(giro, 4, 'Z')
    for o in pz:
        o.data.transform(M)
        densa(o, 3.0)
    return pz


def cajas(E):
    """Cajas de madera afuera, apiladas contra el pilar a la izquierda de la entrada (no tapan el
    vano, la escalera ni el camino). La grande lleva el estarcido gastado de "este lado arriba"."""
    pz = []
    for nombre, (x0, y0, z0, an, fo, al, giro, mat) in CAJAS.items():
        pz += caja_madera(nombre, x0, y0, z0, an, fo, al, E[mat], giro=giro)
    return pz


def tinaco(E, t):
    """El tinaco en la azotea de la caja de arriba: cuatro patas con placas atornilladas a la losa,
    crucetas de pata a pata, el marco de canaleta encima y la cama de rejilla donde se para todo el
    fondo del tanque; la salida baja del fondo y entra a la losa por su camisa con brida. Regresa el
    tubo de la entrada en dos: lo de la pared de atrás (va con el bloque) y lo de arriba (con el
    techo, que el sitio trama); lo que lo sostiene lo pone entrada_agua."""
    ace = E['acero']
    xt, yt = TINACO
    z0 = CZ1
    zc = TINACO_CAMA
    L = 0.45
    for dx in (-L, L):
        for dy in (-L, L):
            x, y = xt + dx, yt + dy
            t.append(caja_ab('tinaco_pata', (x - 0.03, y - 0.03, z0 + 0.012), (x + 0.03, y + 0.03, zc - 0.06), ace))
            t.append(caja_ab('tinaco_placa', (x - 0.08, y - 0.08, z0), (x + 0.08, y + 0.08, z0 + 0.012), ace))
            for ex in (-1, 1):
                for ey in (-1, 1):
                    t.append(cilindro('tinaco_taquete', 0.009, 0.014, ace, lados=5, centro=(x + ex * 0.055, y + ey * 0.055, z0 + 0.012)))
    C = perfil_C(0.06, 0.03, 0.005)
    for y, lado in ((yt - L, 1), (yt + L, -1)):
        t.append(perfil('tinaco_marco', C, (xt - L - 0.03, y, zc - 0.03), (xt + L + 0.03, y, zc - 0.03), (0, lado, 0), ace))
    for x, lado in ((xt - L, 1), (xt + L, -1)):
        t.append(perfil('tinaco_marco', C, (x, yt - L + 0.03, zc - 0.03), (x, yt + L - 0.03, zc - 0.03), (lado, 0, 0), ace))
    t.append(caja_ab('tinaco_cama', (xt - L - 0.03, yt - L - 0.03, zc - 0.006), (xt + L + 0.03, yt + L + 0.03, zc), E['reja']))
    zb, za = z0 + 0.05, zc - 0.08
    for (xa, ya), (xb, yb) in (((xt - L, yt - L), (xt + L, yt - L)), ((xt - L, yt + L), (xt + L, yt + L)),
                               ((xt - L, yt - L), (xt - L, yt + L)), ((xt + L, yt - L), (xt + L, yt + L))):
        t.append(palo('tinaco_cruceta', (xa, ya, zb), (xb, yb, za), 0.009, ace, lados=4, cortes=0, bisel=None, chueco=0.0))
        t.append(palo('tinaco_cruceta', (xb, yb, zb), (xa, ya, za), 0.009, ace, lados=4, cortes=0, bisel=None, chueco=0.0))
    perfil_t = [(0, 0), (0.46, 0), (0.5, 0.05), (0.5, 0.24), (0.47, 0.27), (0.5, 0.3), (0.5, 0.58), (0.47, 0.61), (0.5, 0.64), (0.5, 0.88),
                (0.36, 0.99), (0.17, 1.03), (0.17, 1.08), (0, 1.09)]
    t.append(densa(torno('tinaco', perfil_t, 14, [E['tinaco']], centro=(xt, yt, zc)), 2.6))
    r = 0.022
    xs, xd = xt + 0.22, xt + L + 0.14
    zr = zc - 0.12
    salida = [(xs, yt, zc + 0.02), (xs, yt, zr + 0.04), (xs + 0.04, yt, zr), (xd - 0.04, yt, zr), (xd, yt, zr - 0.04), (xd, yt, z0 - 0.03)]
    t.append(tubo('tinaco_salida', salida, r, E['agua'], lados=8, ref=(0, 1, 0)))
    t.append(cilindro('salida_camisa', 0.036, 0.05, ace, lados=10, centro=(xd, yt, z0)))
    t.append(cilindro('salida_brida', 0.065, 0.012, ace, lados=10, centro=(xd, yt, z0)))
    t.append(cilindro('salida_llave', 0.034, 0.07, ace, lados=8, centro=(xd, yt, z0 + 0.12)))
    # la entrada: sube del registro en el piso por la pared de atrás de la planta baja, pasa sobre el
    # pretil, cruza la losa en sus taquetes, sube por la espalda de la caja y entra arriba al tanque
    xw, yw = ENTRADA_AGUA
    xe = xt - 0.2
    ym = CY1 + 0.06
    yr = BY1 - 0.25
    zp = LOSA1 + 0.07
    zs = LOSA1 + 0.55
    zt = CZ1 + 0.1
    ye = yt + 0.6
    zi = zc + 0.9
    entrada = [(xw, yw, 0.04), (xw, yw, zs - 0.04), (xw, yw - 0.04, zs), (xw, yr + 0.04, zs), (xw, yr, zs - 0.04),
               (xw, yr, zp + 0.04), (xw - 0.04, yr, zp), (xe + 0.04, yr, zp), (xe, yr - 0.04, zp), (xe, ym + 0.04, zp),
               (xe, ym, zp + 0.04), (xe, ym, zt - 0.04), (xe, ym - 0.04, zt), (xe, ye + 0.04, zt), (xe, ye, zt + 0.04),
               (xe, ye, zi - 0.04), (xe, ye - 0.04, zi), (xe, yt + 0.42, zi)]
    # se parte donde acaba la pared de atrás: lo de abajo va con el bloque, lo de arriba con el techo
    abajo = tubo('tinaco_entrada_abajo', [entrada[0], (xw, yw, LOSA0)], r, E['agua'], lados=8, ref=(1, 0, 0))
    arriba = tubo('tinaco_entrada', [(xw, yw, LOSA0)] + entrada[1:], r, E['agua'], lados=8, ref=(1, 0, 0))
    return abajo, arriba


def entrada_agua(E, b, t, t_ent):
    """Lo que sostiene la entrada del tinaco: el registro de donde sale, su llave de paso, las
    abrazaderas en la pared de atrás y en la espalda de la caja y los taquetes en las losas."""
    ace = E['acero']
    xw, yw = ENTRADA_AGUA
    xe = TINACO[0] - 0.2
    b.append(concreto('registro', (xw - 0.17, BY1 + 0.02, 0), (xw + 0.17, BY1 + 0.29, 0.07), E['concreto'], chaflan=0.012))
    b.append(caja_ab('registro_tapa', (xw - 0.13, BY1 + 0.1, 0.07), (xw + 0.13, BY1 + 0.26, 0.078), ace))
    b.append(cilindro('llave_paso', 0.034, 0.08, ace, lados=8, centro=(xw, yw, 0.82)))
    b.append(palo('llave_paso_maneral', (xw, yw, 0.86), (xw, yw + 0.09, 0.86), 0.01, E['franjas'], lados=4, cortes=0, bisel=None, chueco=0.0))
    for z in (0.45, 1.35, 2.25, 2.95):
        b.append(caja_ab('abrazadera_agua', (xw - 0.04, BY1, z - 0.015), (xw + 0.04, yw + 0.03, z + 0.015), ace))
    for (x, y) in ((xw - 0.9, BY1 - 0.25), (xw - 1.7, BY1 - 0.25), (xe, BY1 - 0.85)):
        t.append(concreto('taquete_agua', (x - 0.07, y - 0.07, LOSA1), (x + 0.07, y + 0.07, LOSA1 + 0.045), E['concreto'], chaflan=0.01))
        t.append(caja_ab('taquete_abrazadera', (x - 0.015, y - 0.035, LOSA1 + 0.045), (x + 0.015, y + 0.035, LOSA1 + 0.1), ace))
    for z in (LOSA1 + 0.75, LOSA1 + 1.65):
        t.append(caja_ab('abrazadera_agua', (xe - 0.04, CY1, z - 0.015), (xe + 0.04, CY1 + 0.09, z + 0.015), ace))
    yq = TINACO[1] + 0.6
    t.append(concreto('taquete_agua', (xe - 0.07, yq - 0.07, CZ1), (xe + 0.07, yq + 0.07, CZ1 + 0.06), E['concreto'], chaflan=0.01))
    zc = TINACO_CAMA
    t.append(caja_ab('abrazadera_tanque', (xe - 0.03, TINACO[1] + 0.45, zc + 0.5 - 0.015), (xe + 0.03, yq + 0.03, zc + 0.5 + 0.015), ace))
    b.append(t_ent[0])
    t.append(t_ent[1])


def bajadas(E, b, t):
    """El agua de lluvia: la azotea de la caja escurre por una gárgola a su embudo y por una bajada en
    su espalda hasta la losa de abajo, donde cae por un codo sobre una piedra de concreto; la losa de
    abajo junta en su gárgola del pretil de atrás, que da a otro embudo y a la bajada de la pared de
    atrás hasta su dado en el piso."""
    ox = E['oxido']
    ace = E['acero']
    xg = CX0 + 0.35
    t.append(caja_ab('gargola_caja', (xg - 0.05, CY1 - 0.15, CZ1 - 0.06), (xg + 0.05, CY1 + 0.14, CZ1 - 0.01), ox))
    t.append(caja_ab('embudo_caja', (xg - 0.07, CY1 + 0.0, CZ1 - 0.24), (xg + 0.07, CY1 + 0.15, CZ1 - 0.1), ox, bisel=0.01))
    t.append(tubo('bajada_caja', [(xg, CY1 + 0.07, CZ1 - 0.24), (xg, CY1 + 0.07, LOSA1 + 0.2), (xg, CY1 + 0.11, LOSA1 + 0.13),
                                  (xg, CY1 + 0.26, LOSA1 + 0.1)], 0.038, ox, lados=10, ref=(1, 0, 0)))
    t.append(concreto('piedra_bajada', (xg - 0.12, CY1 + 0.12, LOSA1), (xg + 0.12, CY1 + 0.46, LOSA1 + 0.04), E['concreto'], chaflan=0.01))
    for z in (LOSA1 + 0.8, LOSA1 + 1.7):
        t.append(caja_ab('abrazadera_bajada', (xg - 0.05, CY1, z - 0.015), (xg + 0.05, CY1 + 0.115, z + 0.015), ace))
    xb = BX0 + 0.5
    t.append(caja_ab('gargola_losa', (xb - 0.05, BY1 - 0.16, LOSA1 + 0.005), (xb + 0.05, BY1 + 0.14, LOSA1 + 0.06), ox))
    t.append(caja_ab('embudo_losa', (xb - 0.07, BY1 + 0.0, LOSA1 - 0.2), (xb + 0.07, BY1 + 0.15, LOSA1 - 0.06), ox, bisel=0.01))
    t.append(tubo('bajada_losa_arriba', [(xb, BY1 + 0.07, LOSA1 - 0.2), (xb, BY1 + 0.07, LOSA0)], 0.038, ox, lados=10, ref=(1, 0, 0)))
    b.append(tubo('bajada_losa', [(xb, BY1 + 0.07, LOSA0), (xb, BY1 + 0.07, 0.2), (xb, BY1 + 0.11, 0.13), (xb, BY1 + 0.24, 0.1)],
                  0.038, ox, lados=10, ref=(1, 0, 0)))
    b.append(concreto('dado_bajada', (xb - 0.12, BY1 + 0.05, 0), (xb + 0.12, BY1 + 0.3, 0.06), E['concreto'], chaflan=0.012))
    for z in (0.8, 1.75, 2.7):
        b.append(caja_ab('abrazadera_bajada', (xb - 0.05, BY1, z - 0.015), (xb + 0.05, BY1 + 0.115, z + 0.015), ace))


def instalaciones_torre(E, b, t):
    """En el frente de la torre: el gas sale del piso, pasa por su medidor y entra a la torre; la luz
    sube del piso a su medidor y de ahí el tubo entra a la planta baja por la esquina del muro
    izquierdo y corre bajo la losa hasta la caja de la lámpara."""
    ace = E['acero']
    yt = TY0 - 0.07
    xg = TX0 + 0.13
    b.append(tubo('gas_abajo', [(xg, yt, -0.03), (xg, yt, 0.86)], 0.025, E['gas'], lados=10))
    b.append(caja_ab('medidor_gas', (xg - 0.11, TY0 - 0.16, 0.86), (xg + 0.11, TY0, 1.18), ace, bisel=0.012))
    b.append(cilindro('medidor_gas_caratula', 0.045, 0.012, E['vidrio'], lados=12, centro=(xg, TY0 - 0.166, 1.04), rot=(math.pi / 2, 0, 0)))
    b.append(tubo('gas_arriba', [(xg, yt, 1.18), (xg, yt, 2.08), (xg, yt + 0.04, 2.12), (xg, TY0 + 0.06, 2.12)], 0.025, E['gas'], lados=10, ref=(1, 0, 0)))
    for z in (0.45, 1.6):
        b.append(caja_ab('abrazadera_gas', (xg - 0.045, yt - 0.035, z - 0.015), (xg + 0.045, TY0, z + 0.015), ace))
    xe = PUERTA_TORRE[1] + 0.18
    zc = 3.08
    b.append(tubo('acometida', [(xe, yt, -0.03), (xe, yt, 1.3)], 0.024, E['oxido'], lados=10))
    b.append(caja_ab('medidor_luz', (xe - 0.1, TY0 - 0.15, 1.3), (xe + 0.1, TY0, 1.62), ace, bisel=0.012))
    b.append(cilindro('medidor_luz_ventana', 0.05, 0.012, E['vidrio'], lados=12, centro=(xe, TY0 - 0.156, 1.48), rot=(math.pi / 2, 0, 0)))
    b.append(tubo('conduit_fuera', [(xe, yt, 1.62), (xe, yt, zc - 0.05), (xe + 0.05, yt, zc), (BX0 + 0.03, yt, zc)], 0.022, E['oxido'], lados=10, ref=(0, 1, 0)))
    for z in (0.6, 2.3):
        b.append(caja_ab('abrazadera_conduit', (xe - 0.04, yt - 0.03, z - 0.015), (xe + 0.04, TY0, z + 0.015), ace))
    xl, yl = LAMPARA
    zi = LOSA0 - 0.05
    dentro = [(BX0 + MURO - 0.03, yt, zc), (BX0 + MURO + 0.05, yt, zc), (BX0 + MURO + 0.12, yt, zi), (xl - 0.04, yt, zi),
              (xl, yt + 0.04, zi), (xl, yl - 0.06, zi)]
    t.append(tubo('conduit_dentro', dentro, 0.02, E['oxido'], lados=8, ref=(0, 1, 0)))
    for x, y in ((-1.4, yt), (-0.6, yt), (xl, 0.6)):
        t.append(caja_ab('abrazadera_techo', (x - 0.03, y - 0.03, zi - 0.03), (x + 0.03, y + 0.03, LOSA0), ace))


def compuerta(E, t, S):
    """La rejita del hueco del pretil, abierta 60° hacia la azotea, con sus bisagras en la punta del
    pretil de enfrente y el pasador en la del pretil de atrás."""
    ace = E['acero']
    xh, yh = BX1 - 0.075, S['yt0'] + 0.02
    largo = S['yt1'] - S['yt0'] - 0.06
    ang = math.radians(60)
    piezas = []
    for s in (0.02, largo - 0.02):
        piezas.append(caja_ab('reja_larguero', (s - 0.015, -0.015, 0.03), (s + 0.015, 0.015, 0.9), ace))
    for z in (0.06, 0.87):
        piezas.append(caja_ab('reja_travesano', (0.0, -0.015, z - 0.015), (largo, 0.015, z + 0.015), ace))
    for k in range(1, 6):
        s = largo * k / 6
        piezas.append(caja_ab('reja_barra', (s - 0.006, -0.006, 0.06), (s + 0.006, 0.006, 0.87), ace))
    # local: x a lo largo de la hoja desde la bisagra; cerrada iría hacia +Y, abierta gira hacia -X
    M = Matrix.Translation((xh, yh, LOSA1)) @ Matrix.Rotation(math.pi / 2 + ang, 4, 'Z')
    for o in piezas:
        o.data.transform(M)
    t += piezas
    for z in (0.2, 0.74):
        t.append(cilindro('reja_bisagra', 0.014, 0.07, ace, lados=6, centro=(xh, yh, LOSA1 + z - 0.035)))
        t.append(caja_ab('reja_bisagra_placa', (xh - 0.04, S['yt0'], LOSA1 + z - 0.035), (xh + 0.04, S['yt0'] + 0.008, LOSA1 + z + 0.035), ace))
    t.append(caja_ab('reja_pasador', (xh - 0.03, S['yt1'] - 0.012, LOSA1 + 0.46), (xh + 0.03, S['yt1'], LOSA1 + 0.54), ace))


def estudio(E):
    """La construcción brutalista: una planta baja honda y abierta al frente, una torre ciega a la
    izquierda y una caja de arriba en voladizo con ventana corrida y parasoles, todo a 90°; con lo
    industrial a la vista, y cada pieza cargada o conectada a algo (ver la lista de revisión del
    reporte). Regresa (Prop_Estudio, su techo, las filas de neón)."""
    con, ace, vid = E['concreto'], E['acero'], E['vidrio']
    b, t = [], []
    S = ESCALERA
    # ---- planta baja
    b.append(concreto('piso', (BX0, BY0 - 0.35, 0), (BX1, BY1, PISO), con))
    b.append(concreto('muro_izq', (BX0, BY0, 0), (BX0 + MURO, BY1 - MURO, LOSA0), con))
    # la pared de atrás, con la ventana de fábrica (retícula de acero) sobre el escritorio
    w0, w1, h0, h1 = VENTANA_FABRICA
    ya, yb = BY1 - MURO, BY1
    b += [densa(concreto('atras_abajo', (BX0, ya, 0), (BX1, yb, h0), con), 1.8), concreto('atras_arriba', (BX0, ya, h1), (BX1, yb, LOSA0), con),
          concreto('atras_izq', (BX0, ya, h0), (w0, yb, h1), con), densa(concreto('atras_der', (w1, ya, h0), (BX1, yb, h1), con), 1.8),
          caja_ab('fabrica_vidrio', (w0, yb - 0.13, h0), (w1, yb - 0.11, h1), vid)]
    yr = yb - 0.1
    for k in range(6):
        x = w0 + (w1 - w0) * k / 5
        b.append(caja_ab(f'fabrica_v{k}', (x - 0.022, yr - 0.025, h0), (x + 0.022, yr + 0.025, h1), ace))
    for k in range(4):
        z = h0 + (h1 - h0) * k / 3
        b.append(caja_ab(f'fabrica_h{k}', (w0, yr - 0.025, z - 0.022), (w1, yr + 0.025, z + 0.022), ace))
    # la pared derecha, ciega (por fuera va la escalera)
    b.append(concreto('muro_der', (BX1 - MURO, BY0, 0), (BX1, BY1 - MURO, LOSA0), con))
    # el pilar de enfrente, a la izquierda del vano, con un vano chico de caja salida
    b.append(concreto('pilar', (BX0, BY0, 0), (VANO_X0, BY0 + MURO, LOSA0), con))
    b += marco_vano('vano_pilar', BY0, '-Y', BX0 + 0.3, BX0 + 0.75, 1.55, 2.0, 0.14, 0.08, con, vid)
    # la viga I del vano: se apoya en el pilar y en el muro derecho
    b.append(perfil('viga_vano', perfil_I(0.28, 0.16, 0.012, 0.018), (VANO_X0 - 0.12, BY0 + 0.15, LOSA0 - 0.14),
                    (BX1 - MURO + 0.12, BY0 + 0.15, LOSA0 - 0.14), (0, 1, 0), ace))
    # la columna I en su dado: carga la punta de la viga derecha del voladizo
    yc = CY0 + 0.15
    b.append(concreto('dado', (XC - 0.25, yc - 0.25, 0), (XC + 0.25, yc + 0.25, 0.12), con, chaflan=0.02))
    I_col = perfil_I(0.2, 0.2, 0.012, 0.016)
    b.append(perfil('columna_franjas', I_col, (XC, yc, 0.12), (XC, yc, 1.25), (1, 0, 0), E['franjas']))
    b.append(perfil('columna', I_col, (XC, yc, 1.25), (XC, yc, LOSA1 - 0.295), (1, 0, 0), ace))
    b.append(caja_ab('columna_placa', (XC - 0.13, yc - 0.13, 0.12), (XC + 0.13, yc + 0.13, 0.135), ace))
    b.append(caja_ab('columna_capitel', (XC - 0.12, yc - 0.12, LOSA1 - 0.295), (XC + 0.12, yc + 0.12, LOSA1 - 0.28), ace))
    # ---- la torre ciega: la cortina metálica a medio subir (montada por fuera, en sus guías) y una ranura alta
    t0 = TY0 + 0.3
    p0, p1 = PUERTA_TORRE
    rz0, r0, r1 = 2.3, TX1 - 0.55, TX1 - 0.4
    b += [densa(concreto('torre_abajo', (TX0, t0, 0), (TX1, TY1, LOSA1), con), 1.8), concreto('torre', (TX0, t0, LOSA1), (TX1, TY1, TZ1), con),
          concreto('torre_jamba_izq', (TX0, TY0, 0), (p0, t0, rz0), con), concreto('torre_jamba_der', (p1, TY0, 0), (TX1, t0, rz0), con),
          concreto('torre_frente_izq', (TX0, TY0, rz0), (r0, t0, TZ1), con), concreto('torre_frente_der', (r1, TY0, rz0), (TX1, t0, TZ1), con),
          concreto('torre_ranura_abajo', (r0, TY0, rz0), (r1, t0, 3.3), con), concreto('torre_ranura_arriba', (r0, TY0, 5.9), (r1, t0, TZ1), con),
          caja_ab('torre_ranura_vidrio', (r0, t0 - 0.03, 3.3), (r1, t0 - 0.01, 5.9), vid),
          caja_ab('torre_adentro', (p0, t0 - 0.012, 0.0), (p1, t0, rz0), E['oscuro'])]
    b.append(caja_ab('cortina_caja', (p0 - 0.06, TY0 - 0.2, rz0), (p1 + 0.06, TY0, rz0 + 0.28), ace, bisel=0.01))
    for xa, xb_ in ((p0 - 0.05, p0 + 0.01), (p1 - 0.01, p1 + 0.05)):
        b.append(caja_ab('cortina_guia', (xa, TY0 - 0.12, 0.0), (xb_, TY0, rz0), ace))
    b.append(caja_ab('cortina', (p0 + 0.005, TY0 - 0.1, 1.15), (p1 - 0.005, TY0 - 0.07, rz0 + 0.06), E['cortina'], veta='X'))
    b.append(caja_ab('cortina_barra', (p0 + 0.005, TY0 - 0.115, 1.11), (p1 - 0.005, TY0 - 0.055, 1.17), ace, bisel=0.006))
    b.append(caja_ab('cortina_jaladera', ((p0 + p1) / 2 - 0.05, TY0 - 0.15, 1.12), ((p0 + p1) / 2 + 0.05, TY0 - 0.115, 1.15), ace))
    b += marco_vano('vano_torre_1', TX0, '-X', 0.9, 1.5, 4.4, 5.0, 0.14, 0.08, con, vid)
    b += marco_vano('vano_torre_2', TX0, '-X', 2.0, 2.3, 3.2, 3.5, 0.12, 0.07, con, vid)
    instalaciones_torre(E, b, t)
    b += escalera(E)
    b += cajas(E)
    fijos, neones = letrero(E)
    b += fijos
    # ---- el techo (la losa y la caja de arriba; el sitio lo trama con Skulley adentro)
    t.append(concreto('losa', (BX0, BY0, LOSA0), (BX1, BY1, LOSA1), con))
    pz = LOSA1 + 0.4
    t += [concreto('pretil_atras', (BX0, BY1 - 0.15, LOSA1), (BX1, BY1, pz), con),
          concreto('pretil_der_frente', (BX1 - 0.15, BY0 + 0.15, LOSA1), (BX1, S['yt0'], pz), con),
          concreto('pretil_der_atras', (BX1 - 0.15, S['yt1'], LOSA1), (BX1, BY1 - 0.15, pz), con),
          concreto('pretil_frente_der', (CX1, BY0, LOSA1), (BX1, BY0 + 0.15, pz), con),
          concreto('pretil_frente_izq', (BX0, BY0, LOSA1), (CX0, BY0 + 0.15, pz), con),
          concreto('pretil_izq', (BX0, BY0 + 0.15, LOSA1), (BX0 + 0.15, TY0, pz), con)]
    compuerta(E, t, S)
    # la caja de arriba: cuerpo, ventana corrida con parteluces, gotero y parasoles
    f0 = CY0 + 0.3
    vz0, vz1 = 4.35, 5.1
    t += [concreto('caja', (CX0, f0, LOSA1), (CX1, CY1, CZ1), con),
          concreto('caja_abajo', (CX0, CY0, LOSA1), (CX1, f0, vz0), con), concreto('caja_arriba', (CX0, CY0, vz1), (CX1, f0, CZ1), con),
          concreto('caja_izq', (CX0, CY0, vz0), (CX0 + 0.3, f0, vz1), con), concreto('caja_der', (CX1 - 0.3, CY0, vz0), (CX1, f0, vz1), con),
          caja_ab('corrida_vidrio', (CX0 + 0.3, f0 - 0.03, vz0), (CX1 - 0.3, f0 - 0.01, vz1), vid),
          caja_ab('gotero', (CX0 + 0.3, CY0 - 0.03, vz1 - 0.01), (CX1 - 0.3, f0, vz1 + 0.02), ace)]
    for k in range(1, 5):
        x = CX0 + 0.3 + (CX1 - CX0 - 0.6) * k / 5
        t.append(caja_ab(f'parteluz_{k}', (x - 0.025, f0 - 0.09, vz0), (x + 0.025, f0 - 0.03, vz1), ace))
    for k in range(5):
        x = CX0 + 0.45 + 0.65 * k
        t.append(concreto(f'parasol_{k}', (x - 0.05, CY0 - 0.3, LOSA1 + 0.12), (x + 0.05, CY0, CZ1 - 0.1), con, chaflan=0.02))
    t += marco_vano('vano_caja', CX0, '-X', -1.5, -0.7, 4.3, 5.1, 0.15, 0.08, con, vid)
    # la puerta de acero de la caja, en su cara derecha: da a la azotea, a donde llega la escalera
    d0, d1 = PUERTA_CAJA
    xd = CX1
    t += [caja_ab('puerta_marco_a', (xd, d0 - 0.06, LOSA1), (xd + 0.05, d0, LOSA1 + 2.1), ace),
          caja_ab('puerta_marco_b', (xd, d1, LOSA1), (xd + 0.05, d1 + 0.06, LOSA1 + 2.1), ace),
          caja_ab('puerta_marco_c', (xd, d0 - 0.06, LOSA1 + 2.04), (xd + 0.05, d1 + 0.06, LOSA1 + 2.1), ace),
          caja_ab('puerta_hoja', (xd, d0, LOSA1 + 0.01), (xd + 0.03, d1, LOSA1 + 2.04), E['puerta'], veta='Z'),
          caja_ab('puerta_chapa', (xd + 0.03, d1 - 0.12, LOSA1 + 0.93), (xd + 0.04, d1 - 0.05, LOSA1 + 1.1), ace),
          palo('puerta_manija', (xd + 0.04, d1 - 0.085, LOSA1 + 1.02), (xd + 0.1, d1 - 0.085, LOSA1 + 1.02), 0.011, ace, lados=6, cortes=0, bisel=None, chueco=0.0),
          palo('puerta_manija', (xd + 0.1, d1 - 0.085, LOSA1 + 1.02), (xd + 0.1, d1 - 0.2, LOSA1 + 1.02), 0.011, ace, lados=6, cortes=0, bisel=None, chueco=0.0)]
    for z in (LOSA1 + 0.3, LOSA1 + 1.7):
        t.append(cilindro('puerta_bisagra', 0.013, 0.09, ace, lados=6, centro=(xd + 0.035, d0 + 0.012, z)))
    # las vigas I que cargan el voladizo: la izquierda empotrada en la losa sobre el pilar, la derecha además sobre la columna
    for x in (CX0 + 0.3, XC):
        t.append(perfil(f'viga_voladizo_{x}', perfil_I(0.28, 0.16, 0.012, 0.018), (x, CY0 + 0.05, LOSA1 - 0.14), (x, BY0 + 0.4, LOSA1 - 0.14), (1, 0, 0), ace))
    t_ent = tinaco(E, t)
    entrada_agua(E, b, t, t_ent)
    bajadas(E, b, t)
    # adentro, colgado: dos tiras de papel picado amarradas a armellas en los muros, y la lámpara de su caja
    rnd = random.Random(SEMILLA + 7)
    for c, yq in enumerate((0.45, -0.95)):
        a, bb = (BX0 + MURO + 0.03, yq, 2.97), (BX1 - MURO - 0.03, yq, 2.97)
        t.append(tubo(f'cuerda_papel_{c}', [cuerda_papel(a, bb, 0.1, s / 8) for s in range(9)], 0.006, E['cuerda'], lados=4))
        for x, s in ((BX0 + MURO, 1), (BX1 - MURO, -1)):
            t.append(caja_ab('armella', (x, yq - 0.012, 2.95), (x + s * 0.04, yq + 0.012, 2.99), ace))
        for k in range(9):
            q = cuerda_papel(a, bb, 0.1, (k + 0.5) / 9)
            color = PAPEL_PICADO[(k + 2 * c) % 5][0]
            t.append(densa(bandera(f'papel_{c}_{k}', E['papel_' + color], (q.x, q.y, q.z - 0.005), (rnd.uniform(-0.1, 0.1), 0, rnd.uniform(-0.08, 0.08))), 1.5))
    xl, yl = LAMPARA
    t.append(caja_ab('lampara_caja', (xl - 0.06, yl - 0.06, LOSA0 - 0.05), (xl + 0.06, yl + 0.06, LOSA0), ace))
    t.append(tubo('lampara_cable', [(xl, yl, LOSA0 - 0.05), (xl, yl, 2.55)], 0.006, E['cuerda'], lados=4))
    t.append(torno('lampara', [(0.0, 0.0), (0.21, 0.0), (0.2, 0.025), (0.06, 0.16), (0.035, 0.2), (0.0, 0.205)], 12,
                   [E['lampara'], E['foco']], tramos=[1, 0, 0, 0, 0], centro=(xl, yl, 2.35)))
    prop = unir(b, 'Prop_Estudio')
    techo = unir(t, 'Prop_Estudio_Techo', padre=prop)
    for n in neones:
        n.parent = prop
    for nombre, (x, y, z, giro) in LUGARES.items():
        v = bpy.data.objects.new('Lugar_' + nombre[5:], None)
        v.empty_display_type = 'ARROWS'
        v.empty_display_size = 0.3
        bpy.context.scene.collection.objects.link(v)
        v.parent = prop
        v.location = (x, y, z)
        v.rotation_euler = (0, 0, giro)
    return prop, techo, neones


def revisar_escalera():
    """Mide la escalera ya armada contra todo el Estudio: baja un rayo en cada huella y descanso
    (peralte real de uno a otro), sube rayos desde cada uno (lo libre arriba de la cabeza) y tira
    rayos a lo largo del camino a tres alturas (que nada se atraviese al subir), hasta la puerta."""
    from mathutils.bvhtree import BVHTree
    S = ESCALERA
    dg = bpy.context.evaluated_depsgraph_get()
    arboles = [BVHTree.FromObject(bpy.data.objects[n], dg) for n in ('Prop_Estudio', 'Prop_Estudio_Techo')]

    def rayo(o, d, dist):
        mejor = None
        for arb in arboles:
            h = arb.ray_cast(Vector(o), Vector(d), dist)
            if h[0] is not None and (mejor is None or h[3] < mejor):
                mejor = h[3]
        return mejor
    xa = sum(S['afuera']) / 2
    xb = sum(S['adentro']) / 2
    pe, hu = S['peralte'], S['huella']
    pasos = [(xa, S['y1'] - 0.3, 0.0)]
    pasos += [(xa, S['y1'] + (k - 0.5) * hu, k * pe) for k in range(1, S['n1'])]
    pasos += [(xa, S['yl0'] + 0.4, S['zl']), (xb, S['yl0'] + 0.4, S['zl'])]
    pasos += [(xb, S['yl0'] - (k - 0.5) * hu, S['zl'] + k * pe) for k in range(1, S['n2'])]
    ym = (S['yt0'] + S['yt1']) / 2
    pasos += [(xb, ym, LOSA1), (BX1 - 0.075, ym, LOSA1), (BX1 - 0.5, ym + 0.2, LOSA1), (CX1 + 0.35, sum(PUERTA_CAJA) / 2, LOSA1)]
    alturas, libres, choques = [], [], []
    for i, (x, y, z) in enumerate(pasos):
        piso = rayo((x, y, z + 0.5), (0, 0, -1), 1.0)
        alturas.append(None if piso is None else round(z + 0.5 - piso, 3))
        libres.append(min([rayo((x + dx, y, z + 0.03), (0, 0, 1), 3.0) or 9.0 for dx in (-0.15, 0.0, 0.15)]))
        if i + 1 < len(pasos):
            nx, ny, nz = pasos[i + 1]
            v = Vector((nx - x, ny - y, nz - z))
            for hz in (0.35, 1.0, 1.7):
                golpe = rayo((x, y, z + hz), v.normalized(), v.length)
                if golpe is not None:
                    choques.append((i, hz, round(golpe, 2)))
    zs = [a for a in alturas if a is not None]
    peraltes = [round(bb - aa, 3) for aa, bb in zip(zs, zs[1:]) if abs(bb - aa) > 0.01]
    print('  escalera: alturas medidas', alturas)
    print('  escalera: peraltes', sorted(set(peraltes)), 'en', len(peraltes), 'pasos; huella', hu)
    print('  escalera: lo menos libre arriba de un paso: %.2f m' % min(libres), '; choques en el camino:', choques or 'ninguno')


# ---------------------------------------------------------------- los art toys de Oscar (los del About)

TOY_MALLAS = {}


def material_vinil(nombre, color, oscuro=None, orilla='#ffffff'):
    """Vinil liso en acuarela: el lavado de su color, la sombra de contacto por oclusión, la orilla
    clara y un brillo apenas (una mancha suave de luz arriba y de frente). Sin veta ni concreto."""
    m = P.material_liso(nombre, color, oscuro=oscuro, orilla=orilla)

    def pintar(N, col, pos, geo):
        nd = N.n('ShaderNodeVectorMath', operation='DOT_PRODUCT')
        N.l(geo.outputs['Normal'], nd.inputs[0])
        nd.inputs[1].default_value = Vector((-0.3, -0.45, 0.84)).normalized()
        brillo = P.suave(N, nd.outputs['Value'], 0.9, 0.97)
        return N.mezcla(N.val('MULTIPLY', brillo, 0.35), col, '#ffffff')
    return encima(m, pintar)


def toy_malla(clave, M):
    """La versión ligera de un art toy: el GLB del sitio con su transformación aplicada, a su alto de
    juguete de colección, con la base en z = 0 centrada, reducido (colapso de aristas) a TOYS[clave]
    triángulos y liso. Una sola malla: las copias la comparten."""
    archivo, alto, meta = TOYS[clave]
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(REPO, 'public', '3dmodels', archivo))
    nuevos = [o for o in bpy.data.objects if o not in antes]
    o = next(x for x in nuevos if x.type == 'MESH')
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = o.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    k = alto / (co[:, 2].max() - co[:, 2].min())
    piso = Vector(((co[:, 0].max() + co[:, 0].min()) / 2, (co[:, 1].max() + co[:, 1].min()) / 2, co[:, 2].min()))
    me.transform(Matrix.Scale(k, 4) @ Matrix.Translation(-piso))
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    dec = o.modifiers.new('ligero', 'DECIMATE')
    dec.decimate_type = 'COLLAPSE'
    dec.ratio = meta / tris
    if clave in TOYS_CUIDA:
        (xa, xb), (za, zb), ymax, peso = TOYS_CUIDA[clave]
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        cuida = (np.abs(co[:, 0]) > xa) & (np.abs(co[:, 0]) < xb) & (co[:, 2] > za) & (co[:, 2] < zb) & (co[:, 1] < ymax)
        vg = o.vertex_groups.new(name='reduce')
        for i, c in enumerate(cuida):
            vg.add([i], peso if c else 1.0, 'REPLACE')
        dec.vertex_group = 'reduce'
        dec.vertex_group_factor = 1.0
    bpy.ops.object.modifier_apply(modifier='ligero')
    me = o.data
    for vg in list(o.vertex_groups):
        o.vertex_groups.remove(vg)
    me.materials.clear()
    me.materials.append(M['vinil_' + clave])
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    me.name = 'ArtToy_' + clave
    for x in nuevos:
        bpy.data.objects.remove(x)
    print(f'  {clave}: {tris} -> {sum(len(p.vertices) - 2 for p in me.polygons)} triángulos, {alto * 100:.0f} cm de alto')
    return me


def apoyar_en(o, padre, z_tabla):
    """Acomoda la copia sobre la tabla cuya cara de arriba está cerca de `z_tabla`: rayos hacia abajo
    desde un poco arriba de la tabla en cada punto de sus pies; la sube o la baja hasta que el punto de
    la tabla más alto bajo sus pies la toca."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    arb = BVHTree.FromObject(padre, dg)
    e = o.scale.x
    Mt = Matrix.Translation((o.location.x, o.location.y, 0)) @ Matrix.Rotation(o.rotation_euler.z, 4, 'Z') @ Matrix.Scale(e, 4)
    z = None
    for v in o.data.vertices:
        if v.co.z < 0.004:
            q = Mt @ v.co
            golpe = arb.ray_cast(Vector((q.x, q.y, z_tabla + 0.03)), Vector((0, 0, -1)), 0.08)
            if golpe[0] is not None:
                z = golpe[0].z - q.z if z is None else max(z, golpe[0].z - q.z)
    o.location.z = (z if z is not None else z_tabla) + 0.0005
    return o


def colocar_toys(prop, lugares):
    """Las copias de los art toys de un mueble: (clave, nombre, x, y, z de la tabla, giro, escala)."""
    hechos = []
    for clave, nombre, x, y, zt, giro, escala in lugares:
        o = bpy.data.objects.new(nombre, TOY_MALLAS[clave])
        bpy.context.scene.collection.objects.link(o)
        o.location = (x, y, zt)
        o.rotation_euler = (0, 0, giro)
        o.scale = (escala, escala, escala)
        apoyar_en(o, prop, zt)
        o.parent = prop
        hechos.append(o)
    return hechos


def revisar_toys():
    """Que cada art toy esté apoyado (lo más bajo de sus pies a menos de 3 mm de la tabla) y no se
    meta en nada del mueble (intersección de mallas)."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    for nombre in [t[1] for lista in TOYS_LUGAR.values() for t in lista]:
        o = bpy.data.objects[nombre]
        padre = o.parent
        arb_p = BVHTree.FromObject(padre, dg)
        vs = [o.matrix_basis @ v.co for v in o.data.vertices]
        ps = [list(p.vertices) for p in o.data.polygons]
        arb_t = BVHTree.FromPolygons(vs, ps)
        cruces = len(arb_t.overlap(arb_p))
        bajo = min(v.z for v in vs)
        golpe = arb_p.ray_cast(Vector((o.location.x, o.location.y, bajo + 0.002)), Vector((0, 0, -1)), 0.05)
        hueco = (bajo - golpe[0].z) if golpe[0] is not None else None
        alto = max(v.z for v in vs) - bajo
        print(f'  {nombre}: {alto * 100:.1f} cm de alto, {"se cruza con " + str(cruces) + " caras" if cruces else "no se cruza con nada"}, '
              f'tabla {"no encontrada" if hueco is None else f"a {hueco * 1000:.1f} mm de sus pies"}')


def unicos(objs):
    """Un objeto por malla (las copias ligadas comparten malla y UV: se acomodan y se hornean una vez)."""
    vistas, out = set(), []
    for o in objs:
        if o.data.name not in vistas:
            vistas.add(o.data.name)
            out.append(o)
    return out


# ---------------------------------------------------------------- el escritorio, la Cintiq y la computadora

def en_marco(piezas, M):
    for o in piezas:
        o.data.transform(M)
    return piezas


def escritorio(M):
    """Escritorio industrial: dos marcos de tubo cuadrado de acero negro (patas, travesaño de arriba y
    patín en el piso con sus niveladores), unidos por dos largueros bajo la cubierta, que es gruesa,
    de tres tablones. Encima, la Cintiq en su soporte y su pluma; las hojas y la pantalla van aparte."""
    an, fo, al = ESCRITORIO
    gr = 0.05
    neg = M['acero_negro']
    p = []
    for i in range(3):
        y = -fo / 2 + fo / 6 + i * fo / 3
        p.append(P.tabla(f'esc_cubierta{i}', an, fo / 3 - 0.003, gr, M['cubierta'], centro=(0, y, al - gr / 2),
                         chueco=0.002, bisel=0.012, divisiones=3))
    t = 0.05                                 # el tubo del marco
    zb = al - gr                              # lo de abajo de la cubierta
    xm = an / 2 - 0.09
    ym = fo / 2 - 0.06
    for sx in (-1, 1):
        x = sx * xm
        for sy in (-1, 1):
            y = sy * ym
            p.append(caja_ab('esc_pata', (x - t / 2, y - t / 2, 0.035), (x + t / 2, y + t / 2, zb - t), neg, bisel=0.004))
        p.append(caja_ab('esc_marco_arriba', (x - t / 2, -ym - t / 2, zb - t), (x + t / 2, ym + t / 2, zb), neg, bisel=0.004))
        p.append(caja_ab('esc_patin', (x - t / 2, -ym - t / 2 - 0.03, 0.01), (x + t / 2, ym + t / 2 + 0.03, 0.035), neg, bisel=0.004))
        for sy in (-1, 1):
            p.append(cilindro('esc_nivelador', 0.016, 0.01, M['goma'], lados=8, centro=(x, sy * (ym + 0.01), 0.0)))
    for y in (-ym + 0.06, ym):
        p.append(caja_ab('esc_larguero', (-xm, y - 0.02, zb - 0.06), (xm, y + 0.02, zb), neg, bisel=0.004))
    p += cintiq(M, al)
    prop = unir(p, 'Prop_Escritorio')
    hojas = []
    for i, (w, h, x, y, giro) in enumerate(((0.23, 0.31, -0.64, -0.13, 0.08), (0.31, 0.23, -0.62, 0.2, -0.1), (0.23, 0.31, 0.33, -0.2, 0.2))):
        hojas.append(hoja(f'esc_hoja{i}', w, h, M['papel'], (i / 3, 0.0, 1 / 3, 1.0), curva=0.01,
                          centro=(x, y, al + 0.002 + i * 0.0026), rot=(-math.pi / 2, 0, giro)))
    unir(hojas, 'Prop_Escritorio_Hojas', padre=prop)
    pantalla = cintiq_pantalla(M, al)
    unir([pantalla], 'Prop_Estudio_Pantalla', padre=prop)
    colocar_toys(prop, TOYS_LUGAR['Prop_Escritorio'])
    return prop


def _marco_cintiq(z_top):
    """Del espacio de la Cintiq (x a lo ancho, z hacia arriba de la pantalla, la pantalla hacia -Y, el
    centro del cuerpo en el origen) al del escritorio: recostada `inclina` grados contra la cubierta,
    con su orilla de abajo en dos patitas."""
    C = CINTIQ
    H, T = C['alto'], C['grueso']
    th = math.radians(90 - C['inclina'])
    R = Matrix.Rotation(-th, 4, 'X')
    bajo = min((R @ Vector((0, sy * T / 2, -H / 2))).z for sy in (-1, 1))
    cx, cy = C['centro']
    return Matrix.Translation((cx, cy, z_top + 0.012 - bajo)) @ R


def cintiq(M, z_top):
    """La Wacom Cintiq Pro 27: cuerpo delgado negro de bisel fino, la joroba de atrás, dos patitas de
    goma bajo la orilla de abajo y el soporte de atrás (dos patas a una barra en la cubierta), con la
    pluma acostada al lado."""
    C = CINTIQ
    W, H, T = C['ancho'], C['alto'], C['grueso']
    Mc = _marco_cintiq(z_top)
    p = en_marco([caja_ab('cin_cuerpo', (-W / 2, -T / 2, -H / 2), (W / 2, T / 2, H / 2), M['plastico'], bisel=0.008, segmentos=2),
                  caja_ab('cin_joroba', (-0.25, T / 2 - 0.004, -0.15), (0.25, T / 2 + 0.014, 0.12), M['plastico'], bisel=0.008, segmentos=2)], Mc)
    # las patitas, bajo la orilla de abajo
    for sx in (-1, 1):
        q = Mc @ Vector((sx * 0.26, T / 2 - 0.004, -H / 2))
        p.append(caja_ab('cin_patita', (q.x - 0.03, q.y - 0.012, z_top), (q.x + 0.03, q.y + 0.012, z_top + 0.013), M['goma'], bisel=0.003))
    # el soporte: de la joroba bajan dos patas a una barra apoyada en la cubierta
    for sx in (-1, 1):
        a = Mc @ Vector((sx * 0.2, T / 2 + 0.014, 0.0))
        b_ = Vector((a.x, a.y + 0.07, z_top + 0.014))
        p.append(palo('cin_pata', a, b_, 0.012, M['aluminio'], lados=6, cortes=0, bisel=None, chueco=0.0))
        p.append(cilindro('cin_bisagra', 0.016, 0.03, M['aluminio'], lados=8, centro=(a.x - 0.015, a.y, a.z), rot=(0, math.pi / 2, 0)))
        yb = b_.y
    p.append(caja_ab('cin_barra', (-0.24 + C['centro'][0], yb - 0.02, z_top), (0.24 + C['centro'][0], yb + 0.02, z_top + 0.016), M['aluminio'], bisel=0.004))
    # la pluma, acostada enfrente de la orilla de abajo
    a = Vector((C['centro'][0] - 0.25, C['centro'][1] - 0.265, z_top + 0.0058))
    d = Vector((1.0, 0.06, 0.0)).normalized()
    p.append(palo('pluma', a, a + d * 0.13, 0.0058, M['plastico'], lados=8, punta=0.92, cortes=0, bisel=None, chueco=0.0))
    p.append(palo('pluma_agarre', a + d * 0.025, a + d * 0.07, 0.0064, M['goma'], lados=8, cortes=0, bisel=None, chueco=0.0))
    p.append(palo('pluma_punta', a, a - d * 0.022, 0.0052, M['plastico'], lados=8, punta=0.15, cortes=0, bisel=None, chueco=0.0))
    return p


def cintiq_pantalla(M, z_top):
    """La cara de la pantalla (62 × 37 cm), apenas encima del cuerpo, con la UV `Dibujo` 0–1 en su cara."""
    C = CINTIQ
    w, h = C['pantalla']
    o = hoja('cin_pantalla', w, h, M['pantalla'], (0.0, 0.0, 1.0, 1.0), grueso=0.002)
    o.data.transform(_marco_cintiq(z_top) @ Matrix.Translation((0, -C['grueso'] / 2 - 0.0006, 0.0)))
    return o


def rombos(nombre, xa, xb, za, zb, y, px, pz, ancho, hondo, material):
    """Malla de metal desplegado: tiras planas en dos direcciones que dejan rombos de px × pz,
    recortadas al rectángulo; las de una dirección un poco más atrás (no se pisan)."""
    bm = bmesh.new()

    def tira(p, q, yy):
        d = (q - p).normalized()
        n = Vector((-d.y, d.x)) * (ancho / 2)
        vs = []
        for yv in (yy - hondo / 2, yy + hondo / 2):
            for c in (p - n, q - n, q + n, p + n):
                vs.append(bm.verts.new((c.x, yv, c.y)))
        f, a = vs[:4], vs[4:]
        bm.faces.new(f)
        bm.faces.new(list(reversed(a)))
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((f[i], a[i], a[j], f[j]))
    for fam, yy in ((1, y), (-1, y + hondo * 0.9)):
        u0 = xa / px + fam * za / pz
        u1 = xb / px + fam * zb / pz
        lo, hi = (min(u0, xa / px + fam * zb / pz, xb / px + fam * za / pz, u1), max(u0, xa / px + fam * zb / pz, xb / px + fam * za / pz, u1))
        for k in range(math.floor(lo) - 1, math.ceil(hi) + 2):
            # x/px + fam·z/pz = k  ->  z = fam·pz·(k - x/px)
            if fam == 1:
                x0, x1 = px * (k - zb / pz), px * (k - za / pz)
            else:
                x0, x1 = px * (k + za / pz), px * (k + zb / pz)
            x0, x1 = max(x0, xa), min(x1, xb)
            if x1 - x0 < 1e-4:
                continue
            p = Vector((x0, fam * pz * (k - x0 / px)))
            q = Vector((x1, fam * pz * (k - x1 / px)))
            if (q - p).length > 0.004:
                tira(p, q, yy)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


VENT_HUB = 0.0075        # medio grueso del rotor (su centro) a lo largo del eje
VENT_MARCO = 0.0135      # medio grueso del marco del ventilador


def rotor_ventilador(nombre, r_punta, mat, aspas=7):
    """El rotor de un ventilador, con el eje en Z, el centro del eje en el origen y el frente (lo que
    se ve por la malla) hacia +Z: el cubo, la tapita del eje al frente y siete aspas curvas (más anchas
    en la punta, barridas hacia atrás y con su ángulo de ataque), cada una con su grueso."""
    bm = bmesh.new()
    r_cubo = r_punta * 0.32
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r_cubo, radius2=r_cubo, depth=2 * VENT_HUB)
    tapa = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r_cubo * 0.3, radius2=r_cubo * 0.25, depth=0.002)
    bmesh.ops.translate(bm, vec=(0, 0, VENT_HUB + 0.001), verts=tapa['verts'])
    nr, nc, g = 5, 4, 0.0012
    for k in range(aspas):
        phi = 2 * math.pi * k / aspas
        capas = []
        for lado in (1, -1):
            rej = []
            for i in range(nr):
                s = i / (nr - 1)
                r = r_cubo * 0.95 + s * (r_punta - r_cubo * 0.95)
                ancho = 0.5 + 0.32 * s
                fila = []
                for j in range(nc):
                    c = j / (nc - 1) - 0.5
                    th = phi + c * ancho + 0.45 * s * s
                    fila.append(bm.verts.new((r * math.cos(th), r * math.sin(th), -c * 0.01 + lado * g)))
                rej.append(fila)
            capas.append(rej)
        fr, at = capas
        for i in range(nr - 1):
            for j in range(nc - 1):
                bm.faces.new((fr[i][j], fr[i + 1][j], fr[i + 1][j + 1], fr[i][j + 1]))
                bm.faces.new((at[i][j], at[i][j + 1], at[i + 1][j + 1], at[i + 1][j]))
        borde = [(i, 0) for i in range(nr)] + [(nr - 1, j) for j in range(1, nc)] + [(i, nc - 1) for i in range(nr - 2, -1, -1)] + [(0, j) for j in range(nc - 2, 0, -1)]
        for a, b in zip(borde, borde[1:] + borde[:1]):
            bm.faces.new((fr[a[0]][a[1]], at[a[0]][a[1]], at[b[0]][b[1]], fr[b[0]][b[1]]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, mat)


def marco_ventilador(nombre, lado, r_aro, mat, segs=24):
    """El marco cuadrado del ventilador con su aro (el hueco redondo donde gira el rotor) y, atrás, el
    soporte del motor con sus cuatro brazos a las esquinas. Mismo espacio que el rotor."""
    bm = bmesh.new()
    h = VENT_MARCO
    cuad, circ = {}, {}
    for zz in (h, -h):
        cuad[zz], circ[zz] = [], []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            c, s = math.cos(a), math.sin(a)
            m = (lado / 2) / max(abs(c), abs(s))
            cuad[zz].append(bm.verts.new((c * m, s * m, zz)))
            circ[zz].append(bm.verts.new((c * r_aro, s * r_aro, zz)))
    for k in range(segs):
        n = (k + 1) % segs
        bm.faces.new((cuad[h][k], cuad[h][n], circ[h][n], circ[h][k]))
        bm.faces.new((cuad[-h][k], circ[-h][k], circ[-h][n], cuad[-h][n]))
        bm.faces.new((circ[h][k], circ[h][n], circ[-h][n], circ[-h][k]))
        bm.faces.new((cuad[h][k], cuad[-h][k], cuad[-h][n], cuad[h][n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    marco = P.objeto(nombre, bm, mat)
    z0, z1 = -h, -h + 0.0025
    piezas = [marco, cilindro(nombre + '_motor', r_aro * 0.33, z1 - z0, mat, lados=14, centro=(0, 0, z0))]
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        brazo = caja_ab(nombre + '_brazo', (r_aro * 0.3, -0.003, z0), (lado / 2 * math.sqrt(2) - 0.004, 0.003, z1), mat)
        brazo.data.transform(Matrix.Rotation(a, 4, 'Z'))
        piezas.append(brazo)
    return piezas


def computadora(M):
    """La Renderbox Nano de Oscar (su foto): caja de lámina negra mate un poco más alta que ancha, con
    tornillitos en los costados; al frente, metido entre los costados, tres franjas: dos paneles con
    malla de metal desplegado y abajo uno liso con el botón de encendido de aro; arriba la ceja del
    frente y la rejilla de la tapa, centrada y con su marco; abajo cuatro rodajas. Detrás de las mallas
    del frente, dos ventiladores de verdad lado a lado en cada una (marco cuadrado, aro y rotor de siete
    aspas curvas); bajo la de la tapa, uno solo enorme, del tamaño de la rejilla; y detrás de todos, el
    brillo azul. Es su propio objeto de primer nivel, con el origen al centro de su base (en el juego
    tiembla); el aro del botón, la luz de los ventiladores y cada rotor van como hijos (el sitio prende
    las luces y gira los rotores alrededor de su eje, que es su medida menor)."""
    W, D, Htot = RENDERBOX
    zb, zt = 0.055, Htot
    lam, inte = M['lamina_negra'], M['interior']
    e = 0.012
    yf = -D / 2 + e                           # la cara del frente, metida entre los costados
    p, luces, rotores = [], [], []
    for sx in (-1, 1):
        p.append(caja_ab('rb_costado', (sx * (W / 2 - e), -D / 2, zb), (sx * W / 2, D / 2, zt - e), lam, bisel=0.003))
    # la tapa, con la rejilla al centro (su hueco y su marco)
    tx, ty = 0.15, 0.14
    for a, b_ in (((-W / 2, -D / 2), (-tx, D / 2)), ((tx, -D / 2), (W / 2, D / 2)), ((-tx, -D / 2), (tx, -ty)), ((-tx, ty), (tx, D / 2))):
        p.append(caja_ab('rb_tapa', (a[0], a[1], zt - e), (b_[0], b_[1], zt), lam, bisel=0.002))
    m_ = 0.014
    for a, b_ in (((-tx - m_, -ty - m_), (-tx, ty + m_)), ((tx, -ty - m_), (tx + m_, ty + m_)), ((-tx, -ty - m_), (tx, -ty)), ((-tx, ty), (tx, ty + m_))):
        p.append(caja_ab('rb_tapa_marco', (a[0], a[1], zt), (b_[0], b_[1], zt + 0.004), lam, bisel=0.0015))
    p.append(caja_ab('rb_ceja', (-W / 2 + e, -D / 2, zt - 0.045), (W / 2 - e, yf + 0.004, zt - e), lam, bisel=0.002))
    p.append(caja_ab('rb_fondo', (-W / 2 + e, -D / 2, zb), (W / 2 - e, D / 2, zb + e), lam))
    p.append(caja_ab('rb_espalda', (-W / 2 + e, D / 2 - e, zb + e), (W / 2 - e, D / 2, zt - e), lam))
    d_c, d_luz = 0.0275, 0.05                  # hondo (desde la cara de la malla) del centro del rotor y de la luz

    def ventilador(n, Mv, lado, centro_mundo):
        """Marco y soporte a la malla de la computadora; el rotor, objeto aparte con el origen en el eje."""
        r_aro = lado / 2 - 0.004
        for o in marco_ventilador(f'rb_vent{n}', lado, r_aro, inte):
            o.data.transform(Mv)
            p.append(o)
        # el aro es un polígono de 24 lados: lo que sobra se mide contra el centro de sus lados
        rot = rotor_ventilador(f'rb_rotor{n}', r_aro * math.cos(math.pi / 24) - 0.004, inte)
        rot.data.transform(Mv)
        rotores.append((n, rot, centro_mundo))
    # las tres franjas del frente
    xa0, xa1 = -W / 2 + e, W / 2 - e
    franjas = [(zb + e, zb + e + 0.122, None), (zb + e + 0.128, zb + e + 0.29, 'abajo'), (zb + e + 0.296, zt - 0.045, 'arriba')]
    g = 0.006                                  # grueso del panel
    lado_f = 0.14
    for z0, z1, malla in franjas:
        if malla is None:
            p.append(caja_ab('rb_panel_liso', (xa0, yf, z0), (xa1, yf + g, z1), lam, bisel=0.002))
            zbot = (z0 + z1) / 2
            continue
        wx0, wx1 = -0.155, 0.155
        wz0, wz1 = z0 + 0.024, z1 - 0.024
        for a, b_ in (((xa0, z0), (wx0, z1)), ((wx1, z0), (xa1, z1)), ((wx0, z0), (wx1, wz0)), ((wx0, wz1), (wx1, z1))):
            p.append(caja_ab('rb_panel', (a[0], yf, a[1]), (b_[0], yf + g, b_[1]), lam, bisel=0.0015))
        p.append(rombos(f'rb_malla_{malla}', wx0 - 0.004, wx1 + 0.004, wz0 - 0.004, wz1 + 0.004, yf + g + 0.002, 0.03, 0.017, 0.0035, 0.0018, lam))
        # dos ventiladores lado a lado. El hueco: a los lados hasta la luz; arriba y abajo, donde están
        # los marcos, solo hasta su frente
        yg, ym = yf + d_luz, yf + d_c - VENT_MARCO - 0.0005
        xs_v = (-lado_f / 2 - 0.0075, lado_f / 2 + 0.0075)
        xm = lado_f + 0.0075 + 0.001
        cajas_h = [((wx0, wz0), (wx0 + 0.003, wz1), yg), ((wx1 - 0.003, wz0), (wx1, wz1), yg)]
        for za, zb_ in ((wz0, wz0 + 0.003), (wz1 - 0.003, wz1)):
            cajas_h += [((wx0, za), (-xm, zb_), yg), ((xm, za), (wx1, zb_), yg), ((-xm, za), (xm, zb_), ym)]
        for a, b_, yy in cajas_h:
            p.append(caja_ab('rb_hueco', (a[0], yf + g, a[1]), (b_[0], yy, b_[1]), inte))
        zc = (wz0 + wz1) / 2
        for k, xv in enumerate(xs_v):
            centro = Vector((xv, yf + d_c, zc))
            ventilador((0 if malla == 'arriba' else 2) + k, Matrix.Translation(centro) @ Matrix.Rotation(math.pi / 2, 4, 'X'), lado_f, centro)
        luces.append(caja_ab('rb_luz', (wx0, yg, wz0), (wx1, yg + 0.003, wz1), M['luz_vent']))
    # la rejilla de la tapa: malla, hueco, un ventilador enorme del tamaño de toda la rejilla y la luz,
    # como un panel del frente acostado
    Mt = Matrix.Translation((0, 0, zt)) @ Matrix.Rotation(-math.pi / 2, 4, 'X')
    tapa = [rombos('rb_malla_tapa', -tx - 0.004, tx + 0.004, -ty - 0.004, ty + 0.004, e * 0.5, 0.03, 0.017, 0.0035, 0.0018, lam)]
    for a, b_ in (((-tx, -ty), (-tx + 0.003, ty)), ((tx - 0.003, -ty), (tx, ty)), ((-tx, -ty), (tx, -ty + 0.003)), ((-tx, ty - 0.003), (tx, ty))):
        tapa.append(caja_ab('rb_hueco_tapa', (a[0], e, a[1]), (b_[0], d_luz, b_[1]), inte))
    p += en_marco(tapa, Mt)
    centro = Vector((0, 0, zt - d_c))
    ventilador(4, Matrix.Translation(centro), 2 * ty - 0.01, centro)
    luces += en_marco([caja_ab('rb_luz_tapa', (-tx, d_luz, -ty), (tx, d_luz + 0.003, ty), M['luz_vent'])], Mt)
    # el botón de encendido en el panel liso (el aro es la luz)
    p.append(cilindro('rb_boton', 0.0095, 0.004, M['plastico'], lados=12, centro=(0, yf + 0.001, zbot), rot=(math.pi / 2, 0, 0)))
    aro = tubo('rb_aro', [(math.cos(a) * 0.0125, yf - 0.0015, zbot + math.sin(a) * 0.0125) for a in np.linspace(0, 2 * math.pi, 17)], 0.0024,
               M['luz_boton'], lados=5, ref=(0, 1, 0))
    # tornillitos en los costados
    for sx in (-1, 1):
        for y in (-D / 2 + 0.03, D / 2 - 0.03):
            for z in (zt - 0.03, (zb + zt) / 2, zb + 0.03):
                p.append(cilindro('rb_tornillo', 0.0045, 0.002, lam, lados=6, centro=(sx * W / 2, y, z), rot=(0, sx * math.pi / 2, 0)))
    # rodajas: placa giratoria, horquilla y rueda
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (W / 2 - 0.05), sy * (D / 2 - 0.06)
            p.append(caja_ab('rb_rodaja_placa', (x - 0.025, y - 0.025, zb - 0.006), (x + 0.025, y + 0.025, zb), lam))
            p.append(caja_ab('rb_rodaja_horquilla', (x - 0.016, y - 0.012, 0.024), (x + 0.016, y + 0.02, zb - 0.006), M['goma'], bisel=0.004))
            p.append(cilindro('rb_rodaja', 0.024, 0.024, M['goma'], lados=10, centro=(x - 0.012, y + 0.012, 0.024), rot=(0, math.pi / 2, 0)))
    prop = unir(p, 'Prop_Estudio_Computadora')
    unir([aro], 'Prop_Estudio_Computadora_LuzBoton', padre=prop)
    unir(luces, 'Prop_Estudio_Computadora_LuzVentiladores', padre=prop)
    for n, rot, c in rotores:
        o = unir([rot], f'Prop_Estudio_Computadora_Ventilador_{n}', padre=prop)
        o.data.transform(Matrix.Translation(-c))
        o.location = c
    return prop


def revisar_ventiladores():
    """Que cada rotor gire libre: su volumen de giro (el cilindro que barre), crecido 3 mm, no toca
    nada de la computadora ni la luz; da lo que le sobra al aro, al frente (la malla) y atrás."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    compu = bpy.data.objects['Prop_Estudio_Computadora']
    otros = [BVHTree.FromObject(compu, dg), BVHTree.FromObject(bpy.data.objects['Prop_Estudio_Computadora_LuzVentiladores'], dg)]
    for n in range(5):
        o = bpy.data.objects[f'Prop_Estudio_Computadora_Ventilador_{n}']
        co = np.array([v.co[:] for v in o.data.vertices])
        dims = co.max(0) - co.min(0)
        eje_i = int(np.argmin(dims))
        eje = Vector([1.0 if i == eje_i else 0.0 for i in range(3)])
        a = co[:, eje_i]
        r = np.sqrt((co ** 2).sum(1) - a ** 2)
        r_max, a0, a1 = float(r.max()), float(a.min()), float(a.max())
        c = o.location
        u = eje.orthogonal().normalized()
        w = eje.cross(u)

        def envolvente(m):
            bm = bmesh.new()
            vs = []
            for zz in (a0 - m, a1 + m):
                vs.append([bm.verts.new(c + eje * zz + (u * math.cos(t) + w * math.sin(t)) * (r_max + m)) for t in np.linspace(0, 2 * math.pi, 48, endpoint=False)])
            for k in range(48):
                q = (k + 1) % 48
                bm.faces.new((vs[0][k], vs[0][q], vs[1][q], vs[1][k]))
            bm.faces.new(vs[0])
            bm.faces.new(list(reversed(vs[1])))
            bm.verts.ensure_lookup_table()
            arb = BVHTree.FromBMesh(bm)
            bm.free()
            return arb
        cruces = sum(len(envolvente(0.003).overlap(t)) for t in otros)
        # lo que sobra: en el aro (radial), al frente y atrás (sobre el eje, en la franja del aro)
        def hueco(origenes, d):
            best = 9.0
            for org in origenes:
                for t in otros:
                    h = t.ray_cast(org, d, 0.2)
                    if h[0] is not None:
                        best = min(best, h[3])
            return best
        radial = 9.0
        for t_ in np.linspace(0, 2 * math.pi, 24, endpoint=False):
            dirr = u * math.cos(t_) + w * math.sin(t_)
            for zz in (a0, (a0 + a1) / 2, a1):
                radial = min(radial, hueco([c + eje * zz + dirr * r_max], dirr))
        # el frente es el lado del eje que mira hacia afuera de la caja
        sg = 1.0 if (c - Vector((0, 0, RENDERBOX[2] / 2))).dot(eje) > 0 else -1.0
        cara_f, cara_a = (a1, a0) if sg > 0 else (a0, a1)
        frente, atras = 9.0, 9.0
        for rr in np.linspace(0.0, r_max, 6):
            for t_ in np.linspace(0, 2 * math.pi, 12, endpoint=False):
                base = c + (u * math.cos(t_) + w * math.sin(t_)) * rr
                frente = min(frente, hueco([base + eje * cara_f], eje * sg))
                atras = min(atras, hueco([base + eje * cara_a], -eje * sg))
        print(f'  ventilador {n}: rotor de {r_max * 2000:.0f} mm, {dims[eje_i] * 1000:.0f} mm de grueso a lo largo del eje; '
              f'{"libre" if not cruces else str(cruces) + " cruces con 3 mm de holgura"}; sobra {radial * 1000:.1f} mm al aro, '
              f'{frente * 1000:.1f} mm al frente y {atras * 1000:.1f} mm atrás')


# ---------------------------------------------------------------- la silla

def silla(M):
    """Silla de oficina tipo Steelcase (Gesture / Leap): base de cinco patas con rodajas dobles,
    pistón, mecanismo bajo el asiento, asiento de tela, respaldo flexible de tela sobre una espina que
    sale del mecanismo, y descansabrazos."""
    neg, pl, tela = M['aluminio'], M['plastico'], M['tela']
    p = [cilindro('sil_centro', 0.045, 0.06, pl, lados=12, centro=(0, 0, 0.075), bisel=0.008)]
    for k in range(5):
        a = 2 * math.pi * k / 5 + math.pi / 2
        c, s = math.cos(a), math.sin(a)
        p.append(palo(f'sil_pata{k}', (c * 0.03, s * 0.03, 0.105), (c * 0.31, s * 0.31, 0.08), 0.022, pl, lados=5, punta=0.65, cortes=0, bisel=0.006))
        x, y = c * 0.31, s * 0.31
        p.append(cilindro(f'sil_vastago{k}', 0.008, 0.03, neg, lados=6, centro=(x, y, 0.06)))
        p.append(caja_ab(f'sil_capucha{k}', (x - 0.03, y - 0.02, 0.045), (x + 0.03, y + 0.02, 0.064), pl, bisel=0.006))
        for sx in (-1, 1):
            p.append(cilindro(f'sil_rueda{k}', 0.025, 0.016, M['goma'], lados=8, centro=(x + sx * 0.012 - 0.008, y, 0.025), rot=(0, math.pi / 2, 0)))
    p.append(cilindro('sil_funda', 0.03, 0.16, pl, lados=10, centro=(0, 0, 0.135)))
    p.append(cilindro('sil_piston', 0.02, 0.11, neg, lados=10, centro=(0, 0, 0.29)))
    p.append(caja_ab('sil_mecanismo', (-0.11, -0.12, 0.4), (0.11, 0.14, 0.45), pl, bisel=0.01))
    p.append(caja_ab('sil_asiento', (-0.25, -0.25, 0.45), (0.25, 0.23, 0.525), tela, bisel=0.03, segmentos=2))
    # la espina del respaldo y el respaldo curvo
    p.append(tubo('sil_espina', [(0, 0.12, 0.425), (0, 0.27, 0.43), (0, 0.345, 0.52), (0, 0.372, 0.64), (0, 0.395, 0.78)],
                  [0.022, 0.024, 0.022, 0.02, 0.02], pl, lados=6, ref=(1, 0, 0)))
    p.append(respaldo('sil_respaldo', tela, pl))
    for sx in (-1, 1):
        p.append(caja_ab(f'sil_brazo_soporte{sx}', (sx * 0.1, -0.03, 0.405), (sx * 0.29, 0.03, 0.43), pl, bisel=0.006))
        p.append(palo(f'sil_brazo_poste{sx}', (sx * 0.272, 0.0, 0.42), (sx * 0.272, 0.03, 0.64), 0.017, pl, lados=6, cortes=0, bisel=None, chueco=0.0))
        p.append(caja_ab(f'sil_brazo{sx}', (sx * 0.272 - 0.045, -0.1, 0.635), (sx * 0.272 + 0.045, 0.15, 0.665), M['goma'], bisel=0.012))
    return unir(p, 'Prop_Silla')


def respaldo(nombre, tela, plastico):
    """El respaldo flexible: una lámina curva (cóncava al frente, más ancha arriba, echada para atrás),
    tela al frente y el casco de plástico atrás y en el canto."""
    bm = bmesh.new()
    nu, nv = 7, 7
    grueso = 0.028
    filas = []
    for j in range(nv):
        v = j / (nv - 1)
        z = 0.6 + 0.54 * v
        yb = 0.3 + 0.1 * v + 0.03 * math.sin(math.pi * v)
        ancho = 0.42 + 0.06 * math.sin(math.pi * min(1.0, v * 1.3))
        fila = []
        for i in range(nu):
            u = i / (nu - 1) * 2 - 1
            x = u * ancho / 2
            y = yb - 0.05 * u * u
            fila.append((x, y, z))
        filas.append(fila)
    fr = [[bm.verts.new(p_) for p_ in fila] for fila in filas]
    at = [[bm.verts.new((p_[0], p_[1] + grueso, p_[2])) for p_ in fila] for fila in filas]
    for j in range(nv - 1):
        for i in range(nu - 1):
            f = bm.faces.new((fr[j][i], fr[j][i + 1], fr[j + 1][i + 1], fr[j + 1][i]))
            f.material_index = 0
            g = bm.faces.new((at[j][i], at[j + 1][i], at[j + 1][i + 1], at[j][i + 1]))
            g.material_index = 1
    borde = [(j, 0) for j in range(nv)] + [(nv - 1, i) for i in range(nu)] + [(j, nu - 1) for j in reversed(range(nv))] + [(0, i) for i in reversed(range(nu))]
    vistos = []
    for (j, i) in borde:
        if not vistos or vistos[-1] != (j, i):
            vistos.append((j, i))
    for k in range(len(vistos)):
        (j0, i0), (j1, i1) = vistos[k], vistos[(k + 1) % len(vistos)]
        if (j0, i0) == (j1, i1):
            continue
        f = bm.faces.new((fr[j0][i0], at[j0][i0], at[j1][i1], fr[j1][i1]))
        f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, tela)
    o.data.materials.append(plastico)
    P.biselar(o, 0.008, 1)
    return o


# ---------------------------------------------------------------- el atril del iPad

def atril(M):
    p = []
    inclina = math.radians(68)
    p.append(P.tabla('atr_base', 0.33, 0.21, 0.024, M['clara'], centro=(0, 0.03, 0.012), bisel=0.008, divisiones=2))
    # la tabla inclinada: su orilla de abajo en el frente de la base
    largo = 0.355
    y0, z0 = -0.035, 0.024
    c = Vector((0, y0 + largo / 2 * math.cos(inclina) + 0.011 * math.sin(inclina), z0 + largo / 2 * math.sin(inclina) - 0.011 * math.cos(inclina)))
    p.append(densa(P.tabla('atr_tabla', 0.31, largo, 0.022, M['atril'], centro=c, rot=(inclina, 0, 0), bisel=0.008, divisiones=2), 1.4))
    # el tope donde se apoya el iPad
    p.append(P.tabla('atr_repisa', 0.33, 0.06, 0.02, M['clara'], centro=(0, -0.062, 0.034), bisel=0.007, divisiones=2))
    p.append(tablita('atr_tope', 0.33, 0.034, 0.016, M['clara'], centro=(0, -0.088, 0.058), rot=(math.pi / 2, 0, 0), bisel=0.006))
    # el puntal de atrás
    p.append(pata_entre('atr_puntal', (0, 0.118, 0.022), (0, 0.075, 0.2), 0.034, 0.042, M['clara'], bisel=0.008))
    return unir(p, 'Prop_AtrilIpad')


# ---------------------------------------------------------------- la taza de café frío

def taza(M):
    R = 0.047
    perfil_t = [(0, 0.0), (R - 0.009, 0.0), (R - 0.002, 0.003), (R, 0.012), (R + 0.001, 0.05), (R + 0.0015, 0.09),
                (R, 0.0985), (R - 0.0035, 0.1), (R - 0.007, 0.0975), (R - 0.0085, 0.088), (R - 0.009, 0.05),
                (R - 0.011, 0.018), (R - 0.02, 0.0125), (0, 0.012)]
    golpe = math.radians(-55)    # al frente, a la derecha

    def despostillar(bm):
        bajo = set()
        for v in bm.verts:
            if v.co.z > 0.095 and v.co.xy.length > 0.01:
                d = abs((math.atan2(v.co.y, v.co.x) - golpe + math.pi) % (2 * math.pi) - math.pi)
                if d < 0.34:
                    f = 1 - d / 0.34
                    v.co.z -= 0.011 * f * (0.7 + 0.3 * math.sin(d * 37))
                    bajo.add(v)
        for f in bm.faces:
            if sum(v in bajo for v in f.verts) >= 2:
                f.material_index = 1

    p = [torno('taza_cuerpo', perfil_t, 20, [M['ceramica'], M['barro']], deforma=despostillar)]
    p.append(cilindro('taza_cafe', R - 0.0086, 0.004, M['cafe'], lados=20, centro=(0, 0, 0.07)))
    c = Vector((R + 0.013, 0, 0.055))
    arco = [c + Vector((math.cos(a), 0, math.sin(a))) * 0.027 for a in np.radians(np.linspace(-128, 128, 10))]
    p.append(tubo('taza_asa', arco, 0.0088, M['ceramica'], lados=12, ref=(0, 1, 0)))
    return unir(p, 'Prop_Taza')


# ---------------------------------------------------------------- el caballete

def lienzo_cuadrado(M, lado=0.6, hondo=0.025):
    """El lienzo (espacio propio: x a lo ancho, z a lo alto, la pintura hacia -Y, centrado): la tela
    del frente con la pintura a sangre (UV `Dibujo` 0–1 en su cara) y en los cantos la tela doblada,
    con la orilla de la imagen en espejo, como se imprime un lienzo de galería; la espalda y lo de
    adentro son tela cruda (los listones del bastidor van con el caballete)."""
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    dib = bm.loops.layers.uv.new('Dibujo')
    h, w = lado / 2, 0.0025
    y0 = -hondo / 2

    def caja(lo, hi):
        vs = bmesh.ops.create_cube(bm, size=1.0)['verts']
        bmesh.ops.scale(bm, vec=Vector(hi) - Vector(lo), verts=vs)
        bmesh.ops.translate(bm, vec=(Vector(lo) + Vector(hi)) / 2, verts=vs)
    caja((-h, y0, -h), (h, y0 + w, h))                   # la tela del frente
    caja((-h, y0 + w, h - w), (h, -y0, h))               # la que da la vuelta: arriba, abajo, a los lados
    caja((-h, y0 + w, -h), (h, -y0, -h + w))
    caja((-h, y0 + w, -h + w), (-h + w, -y0, h - w))
    caja((h - w, y0 + w, -h + w), (h, -y0, h - w))
    bm.normal_update()
    t = 1e-4
    for f in bm.faces:
        c, n = f.calc_center_median(), f.normal
        cara = None
        if n.y < -0.5 and abs(c.y - y0) < t:
            cara = 'frente'
        elif n.x > 0.5 and abs(c.x - h) < t:
            cara = 'der'
        elif n.x < -0.5 and abs(c.x + h) < t:
            cara = 'izq'
        elif n.z > 0.5 and abs(c.z - h) < t:
            cara = 'arriba'
        elif n.z < -0.5 and abs(c.z + h) < t:
            cara = 'abajo'
        f.material_index = 1 if cara is None else 0
        for lp in f.loops:
            x, y, z = lp.vert.co
            u, v, d = x / lado + 0.5, z / lado + 0.5, (y - y0) / lado
            lp[dib].uv = {'frente': (u, v), 'der': (1 - d, v), 'izq': (d, v), 'arriba': (u, 1 - d), 'abajo': (u, d),
                          None: (0.02, 0.02)}[cara]
    o = P.objeto('cab_lienzo', bm, M['lienzo_pintura'])
    o.data.materials.append(M['lienzo_tela'])
    o.data.uv_layers.active_index = 0
    o.data.uv_layers['UVMap'].active_render = True
    # la pintura se lleva más pixeles que el resto del lienzo
    at = o.data.attributes.new('Densidad', 'FLOAT', 'FACE')
    mi = np.empty(len(o.data.polygons), np.int32)
    o.data.polygons.foreach_get('material_index', mi)
    at.data.foreach_set('value', np.where(mi == 0, LIENZO_DENSIDAD, 0.6).astype(np.float32))
    return o


def bastidor(M, lado=0.6, hondo=0.025):
    """Los listones del bastidor detrás de la tela, con su travesaño (mismo espacio que el lienzo),
    medio milímetro adentro de la tela para no tocarla."""
    h, a = lado / 2 - 0.0025 - 0.0005, 0.04
    y0, y1 = -hondo / 2 + 0.003, hondo / 2 - 0.001
    mad = M['clara']
    return [caja_ab('cab_liston_arriba', (-h, y0, h - a), (h, y1, h), mad, veta='X'),
            caja_ab('cab_liston_abajo', (-h, y0, -h), (h, y1, -h + a), mad, veta='X'),
            caja_ab('cab_liston_izq', (-h, y0, -h + a), (-h + a, y1, h - a), mad, veta='Z'),
            caja_ab('cab_liston_der', (h - a, y0, -h + a), (h, y1, h - a), mad, veta='Z'),
            caja_ab('cab_travesano_lienzo', (-h + a, y0, -0.017), (h - a, y1, 0.017), mad, veta='X')]


CABALLETE_LEAN = 0.12           # cuánto se van para atrás las patas de enfrente por metro de alto


def caballete(M):
    """El caballete de tres patas: dos de enfrente que se juntan arriba, el mástil y la de atrás. El
    lienzo se para en la repisa (detrás de su tope), se recarga en el frente de las patas de enfrente
    (a 4 mm, medido contra sus vértices) y la prensa del mástil baja hasta su orilla de
    arriba y la detiene por delante; no se mete en ningún palo (`revisar_caballete`)."""
    lean = CABALLETE_LEAN

    def y_frente(z):
        return -0.1 + lean * z

    p = []
    for sx in (-1, 1):
        p.append(pata_entre(f'cab_pata{sx}', (sx * 0.3, y_frente(0), 0), (sx * 0.055, y_frente(1.63), 1.63), 0.034, 0.046, M['clara'], bisel=0.01))
    p.append(tablita('cab_travesano', 0.5, 0.05, 0.026, M['clara'], centro=(0, y_frente(0.42) + 0.004, 0.42), rot=(math.pi / 2 - math.atan(lean), 0, 0), bisel=0.009))
    p.append(pata_entre('cab_mastil', (0, y_frente(0.4) + 0.034, 0.4), (0, y_frente(1.72) + 0.034, 1.72), 0.04, 0.046, M['clara'], bisel=0.01))
    p.append(pata_entre('cab_pata_atras', (0, 0.64, 0), (0, y_frente(1.5) + 0.06, 1.5), 0.036, 0.04, M['clara'], bisel=0.009))
    # la repisa, atornillada al frente de las patas, con su tope
    p.append(P.tabla('cab_repisa', 0.78, 0.118, 0.032, M['clara'], centro=(0, -0.085, 0.72), bisel=0.011, divisiones=3))
    p.append(tablita('cab_tope', 0.78, 0.034, 0.018, M['clara'], centro=(0, -0.136, 0.75), rot=(math.pi / 2, 0, 0), bisel=0.007, divisiones=2))
    # el lienzo: su orilla de atrás abajo en la repisa, su cara detrás del tope, recostado lo más que
    # se pueda sin llegar a 4 mm de las patas (medido contra puntos a lo largo de sus aristas: van
    # giradas y chuecas, y sus vértices solo están en las puntas y a la mitad)
    lado, hondo = 0.6, 0.025
    yb = -0.1255
    repisa = next(o for o in p if o.name.startswith('cab_repisa'))
    zr = max(v.co.z for v in repisa.data.vertices if abs(v.co.x) < lado / 2 + 0.01) + 0.0015
    patas = []
    for o in p[:2]:
        for e_ in o.data.edges:
            va, vb = o.data.vertices[e_.vertices[0]].co, o.data.vertices[e_.vertices[1]].co
            n_ = max(1, int((vb - va).length / 0.01))
            patas += [va.lerp(vb, k / n_) for k in range(n_ + 1)]

    def libre(a):
        sube_ = Vector((0, math.sin(a), math.cos(a)))
        atras_ = Vector((0, math.cos(a), -math.sin(a)))
        b_atras = Vector((0, yb, zr + hondo * math.sin(a))) + atras_ * hondo
        dist = [(v - b_atras).dot(atras_) for v in patas
                if abs(v.x) <= lado / 2 + 0.005 and -0.01 <= (v - b_atras).dot(sube_) <= lado + 0.01]
        return min(dist) if dist else 1.0
    a0, a1 = 0.0, 0.6
    for _ in range(40):
        am = (a0 + a1) / 2
        a0, a1 = (am, a1) if libre(am) > 0.004 else (a0, am)
    a2 = a0
    sube = Vector((0, math.sin(a2), math.cos(a2)))
    atras = Vector((0, math.cos(a2), -math.sin(a2)))
    base = Vector((0, yb, zr + hondo * math.sin(a2)))       # la orilla de enfrente, abajo
    centro = base + sube * (lado / 2) + atras * (hondo / 2)
    Ml = Matrix.Translation(centro) @ Matrix.Rotation(-a2, 4, 'X')
    p += en_marco(bastidor(M, lado, hondo), Ml)
    # la prensa: corre en el mástil y baja hasta la orilla de arriba del lienzo, con su ceja enfrente
    arriba = base + sube * lado
    zt = arriba.z + 0.002
    p.append(caja_ab('cab_prensa', (-0.065, arriba.y - 0.012, zt), (0.065, y_frente(zt) + 0.062, zt + 0.045), M['clara'], bisel=0.01))
    p.append(caja_ab('cab_prensa_ceja', (-0.065, arriba.y - 0.024, zt - 0.022), (0.065, arriba.y - 0.012, zt + 0.045), M['clara'], bisel=0.004))
    prop = unir(p, 'Prop_Caballete')
    lienzo = lienzo_cuadrado(M, lado, hondo)
    lienzo.data.transform(Ml)
    unir([lienzo], 'Prop_Caballete_Lienzo', padre=prop)
    print(f'  caballete: lienzo recostado {math.degrees(a2):.1f}°, orilla de arriba a {arriba.z:.3f} m')
    return prop


def asentar_lugar(nombre, soporte):
    """Sube o baja el lugar de un mueble que va encima de otro (el atril y la taza en el escritorio)
    hasta que lo más alto de la cubierta bajo su base lo toca: las tablas son chuecas a mano."""
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    ls, lm = bpy.data.objects['Lugar_' + soporte[5:]], bpy.data.objects['Lugar_' + nombre[5:]]
    sop, mue = bpy.data.objects[soporte], bpy.data.objects[nombre]
    Ms, Mm = ls.matrix_world, lm.matrix_world
    arb = BVHTree.FromPolygons([Ms @ v.co for v in sop.data.vertices], [list(p.vertices) for p in sop.data.polygons])
    vs = [Mm @ v.co for v in mue.data.vertices]
    bajo = min(v.z for v in vs)
    dz = None
    for v in vs:
        if v.z < bajo + 0.012:
            h = arb.ray_cast(Vector((v.x, v.y, v.z + 0.05)), Vector((0, 0, -1)), 0.1)
            if h[0] is not None:
                dz = h[0].z - v.z if dz is None else max(dz, h[0].z - v.z)
    if dz is not None:
        lm.location.z += dz + 0.0005
        print(f'  {nombre}: su lugar se movió {dz * 1000:+.1f} mm para quedar apoyado en {soporte}')


def revisar_caballete():
    """Que el lienzo no se meta en ningún palo del caballete (intersección de mallas)."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    a = BVHTree.FromObject(bpy.data.objects['Prop_Caballete_Lienzo'], dg)
    b = BVHTree.FromObject(bpy.data.objects['Prop_Caballete'], dg)
    pares = a.overlap(b)
    print('  caballete: el lienzo contra la madera:', f'{len(pares)} caras se cruzan' if pares else 'no se cruza con nada')


# ---------------------------------------------------------------- el estante

def frasco(nombre, R, h, mat, tapa, centro):
    perfil_f = [(0, 0), (R - 0.006, 0), (R, 0.008), (R, h * 0.8), (R * 0.8, h * 0.92), (R * 0.86, h * 0.92), (R * 0.86, h + 0.018), (R * 0.78, h + 0.024), (0, h + 0.024)]
    return torno(nombre, perfil_f, 9, [mat, tapa], tramos=[0, 0, 0, 0, 1, 1, 1, 1], centro=centro, rot=(0, 0, random.uniform(0, 1)))


def pincel(nombre, base, dirc, mango, pelo, M, largo=0.21):
    d = Vector(dirc).normalized()
    b = Vector(base)
    p = [palo(nombre + '_mango', b, b + d * largo, 0.0075, mango, lados=6, punta=0.85, cortes=0, bisel=None, chueco=0.0)]
    p.append(palo(nombre + '_casquillo', b + d * largo, b + d * (largo + 0.028), 0.0085, M['metal'], lados=6, cortes=0, bisel=None, chueco=0.0))
    p.append(palo(nombre + '_pelo', b + d * (largo + 0.026), b + d * (largo + 0.07), 0.0098, pelo, lados=6, punta=0.25, cortes=0, bisel=None, chueco=0.0))
    return p


def estante(M):
    """Estante industrial: cuatro postes de ángulo de acero negro con sus niveladores, largueros y
    costados de ángulo bajo cada tabla, tablas de madera y la cruz de solera atrás. Encima, lo de
    siempre: frascos, libretas, el rollo de papel, el bote de pinceles y la veladora."""
    rnd = random.Random(SEMILLA + 5)
    neg = M['acero_negro']
    tab = M['tabla_estante']
    p = []
    X, Y = 0.6, 0.175
    a = 0.035
    abajo = [REP[0] - 0.035, REP[1] - 0.035, REP[2] - 0.035, REP[3] - 0.035, REP[4] - 0.045]
    for sx in (-1, 1):
        for sy in (-1, 1):
            x0, y0 = sx * X, sy * Y
            p.append(caja_ab('est_poste', (x0, y0, 0.012), (x0 - sx * a, y0 - sy * a, abajo[4]), neg, bisel=0.003))
            p.append(cilindro('est_nivelador', 0.014, 0.012, M['goma'], lados=8, centro=(x0 - sx * a / 2, y0 - sy * a / 2, 0.0)))
    # en cada nivel: los largueros de enfrente y de atrás al ras de la tabla, los costados abajo de
    # ella (ahí se apoya); la tabla va entre los postes
    for k, z in enumerate(abajo):
        zl = z if k == 4 else REP[k]
        for sy in (-1, 1):
            p.append(caja_ab('est_larguero', (-X + a, sy * Y, zl - 0.03), (X - a, sy * (Y - 0.03), zl), neg))
        for sx in (-1, 1):
            p.append(caja_ab('est_costado', (sx * X, -Y + a, z - 0.03), (sx * (X - 0.03), Y - a, z), neg))
    for k, z in enumerate(REP[:4]):
        p.append(P.tabla(f'est_tabla{k}', 2 * X - 0.004, 2 * (Y - 0.031), 0.035, tab, centro=(rnd.uniform(-0.002, 0.002), 0, z - 0.0175),
                         chueco=0.002, bisel=0.01, divisiones=2))
    p.append(P.tabla('est_tope', 2 * X + 0.02, 2 * Y + 0.02, 0.045, tab, centro=(0, 0, REP[4] - 0.0225), chueco=0.002, bisel=0.012, divisiones=3))
    # la cruz de atrás: dos soleras de poste a poste, por fuera de los largueros de atrás
    for (xa, za), (xb, zb) in (((-X + 0.02, abajo[0] - 0.01), (X - 0.02, abajo[4] - 0.03)), ((X - 0.02, abajo[0] - 0.01), (-X + 0.02, abajo[4] - 0.03))):
        p.append(perfil('est_cruz', [(-0.014, -0.003), (0.014, -0.003), (0.014, 0.003), (-0.014, 0.003)],
                        (xa, Y + 0.004, za), (xb, Y + 0.004, zb), (0, 0, 1), neg))
    F = {c: M['frasco_' + c] for c in COLORES}
    met = M['metal']
    # repisa de abajo: dos frascos grandes y dos libretas
    p.append(frasco('est_frasco0', 0.065, 0.13, F['naranja'], met, (-0.38, -0.01, REP[0])))
    p.append(frasco('est_frasco1', 0.058, 0.15, F['azul'], met, (-0.2, 0.02, REP[0])))
    p.append(tablita('est_libreta0', 0.31, 0.23, 0.036, F['rojo'], centro=(0.3, 0.0, REP[0] + 0.0185), rot=(0, 0, 0.05), chueco=0.0015, bisel=0.01, divisiones=0))
    p.append(tablita('est_libreta1', 0.28, 0.21, 0.03, F['azul'], centro=(0.29, -0.01, REP[0] + 0.0525), rot=(0, 0, -0.12), chueco=0.0015, bisel=0.01, divisiones=0))
    # segunda: tres frascos y un rollo de papel
    for i, (x, R, h, c) in enumerate(((-0.4, 0.045, 0.09, 'rosa'), (-0.26, 0.05, 0.105, 'turquesa'), (-0.12, 0.04, 0.08, 'morado'))):
        p.append(frasco(f'est_frasco_b{i}', R, h, F[c], met, (x, rnd.uniform(-0.03, 0.03), REP[1])))
    p.append(cilindro('est_rollo', 0.03, 0.4, M['papel'], lados=12, centro=(0.08, 0.02, REP[1] + 0.03), rot=(0, math.pi / 2, 0.08), bisel=0.006))
    # tercera: el bote de pinceles y dos frascos
    bote = [(0, 0), (0.05, 0), (0.054, 0.006), (0.054, 0.128), (0.051, 0.135), (0.047, 0.128), (0.047, 0.014), (0, 0.014)]
    p.append(torno('est_bote', bote, 12, [M['bote']], centro=(BOTE[0], BOTE[1], REP[2])))
    for i, (dx, dy, mango, pelo) in enumerate(((-0.018, -0.012, M['fina'], M['pelo']), (0.02, -0.01, F['rojo'], F['rosa']),
                                               (0.0, 0.018, M['fina'], M['pelo']), (-0.022, 0.016, F['azul'], F['turquesa']),
                                               (0.024, 0.02, M['fina'], F['naranja']))):
        p += pincel(f'est_pincel{i}', (BOTE[0] + dx, BOTE[1] + dy, REP[2] + 0.0155), (dx * 5, dy * 5, 1), mango, pelo, M, largo=0.19 + 0.02 * (i % 3))
    p.append(frasco('est_frasco_c0', 0.045, 0.1, F['rojo'], met, (-0.13, 0.0, REP[2])))
    p.append(frasco('est_frasco_c1', 0.04, 0.08, F['blanco'], met, (0.0, 0.03, REP[2])))
    # la cuarta va vacía (su hueco es de 12 cm: ahí no cabía el frasco verde). Arriba: la veladora
    vel = [(0, 0), (0.033, 0), (0.036, 0.006), (0.036, 0.128), (0.031, 0.131), (0.031, 0.114), (0, 0.114)]
    p.append(torno('est_veladora', vel, 12, [M['veladora'], M['cera']], tramos=[0, 0, 0, 0, 0, 1], centro=(VELADORA[0], VELADORA[1], REP[4])))
    flama = [(0, 0), (0.0065, 0.007), (0.008, 0.016), (0.0045, 0.027), (0, 0.038)]
    p.append(torno('est_flama', flama, 8, [M['flama']], centro=(VELADORA[0], VELADORA[1], REP[4] + 0.116)))
    revisar_repisas(p)
    prop = unir(p, 'Prop_Estante')
    colocar_toys(prop, TOYS_LUGAR['Prop_Estante'])
    return prop


def revisar_repisas(piezas):
    """Que lo que va en cada repisa del estante quepa en su altura (con 1 cm libre bajo la tabla de
    arriba) y esté apoyado: en su tabla, en la libreta de abajo o, los pinceles, en el fondo del bote."""
    techos = [REP[1] - 0.035, REP[2] - 0.035, REP[3] - 0.035, REP[4] - 0.045, None]
    malos, n = [], 0
    for o in piezas:
        if not o.name.startswith(('est_frasco', 'est_libreta', 'est_rollo', 'est_bote', 'est_pincel', 'est_veladora', 'est_flama')):
            continue
        zs = [v.co.z for v in o.data.vertices]
        lo, hi = min(zs), max(zs)
        k = max(i for i, r in enumerate(REP) if r <= lo + 0.006)
        n += 1
        if techos[k] is not None and hi > techos[k] - 0.01:
            malos.append(f'{o.name} llega a {hi:.3f} y la tabla de arriba empieza en {techos[k]:.3f}')
        apoyo = REP[k]
        if o.name == 'est_libreta1':
            apoyo = REP[0] + 0.0365
        elif o.name.startswith('est_pincel'):
            apoyo = REP[2] + 0.014 if o.name.endswith('_mango') else lo
        elif o.name == 'est_flama':
            apoyo = REP[4] + 0.114
        if abs(lo - apoyo) > 0.004 and not o.name.endswith(('_casquillo', '_pelo')):
            malos.append(f'{o.name} queda a {(lo - apoyo) * 1000:+.0f} mm de donde se apoya')
    print('  estante:', '; '.join(malos) if malos else f'las {n} piezas caben en su repisa y están apoyadas')


# ---------------------------------------------------------------- el tablero de bocetos

HOJAS_TABLERO = [  # ancho, alto, x, z, giro
    (0.30, 0.22, -0.36, 0.555, 0.06), (0.22, 0.30, -0.05, 0.52, -0.045), (0.26, 0.26, 0.3, 0.545, 0.08),
    (0.24, 0.18, -0.37, 0.235, -0.07), (0.32, 0.22, 0.02, 0.2, 0.03), (0.20, 0.27, 0.37, 0.225, -0.1),
]


def tablero(M):
    rnd = random.Random(SEMILLA + 6)
    mad = M['madera']
    p = []
    for z in (0.0375, 0.7625):
        p.append(P.tabla(f'tab_marco{z}', 1.2, 0.075, 0.046, mad, centro=(rnd.uniform(-0.004, 0.004), 0, z), rot=(math.pi / 2, 0, 0), bisel=0.014, divisiones=4))
    for sx in (-1, 1):
        p.append(P.tabla(f'tab_marco_lado{sx}', 0.66, 0.075, 0.046, mad, centro=(sx * 0.5625, 0, 0.4), rot=(math.pi / 2, -math.pi / 2, 0), bisel=0.014, divisiones=3))
    p.append(P.caja('tab_corcho', (1.09, 0.024, 0.69), M['corcho'], centro=(0, 0.007, 0.4), bisel=0.006))
    colores = ['rojo', 'turquesa', 'rosa', 'morado', 'verde', 'azul']
    hojas = []
    for i, (w, h, x, z, giro) in enumerate(HOJAS_TABLERO):
        fila_v = 0.5 if i < 3 else 0.0
        y = -0.0065 - i * 0.0007
        hojas.append(hoja(f'tab_hoja{i}', w, h, M['papel'], ((i % 3) / 3, fila_v, 1 / 3, 0.5), curva=0.006, caida=0.014,
                          centro=(x, y, z), rot=(0, giro, 0)))
        # la chincheta, arriba al centro de la hoja
        arr = Vector((math.sin(giro) * (h / 2 - 0.028), 0, math.cos(giro) * (h / 2 - 0.028)))
        p.append(cilindro(f'tab_chincheta{i}', 0.013, 0.01, M['frasco_' + colores[i]], lados=8,
                          centro=(x + arr.x, y - 0.0025, z + arr.z), rot=(math.pi / 2, 0, 0), radio2=0.01))
    # el cordón para colgarlo
    p.append(tubo('tab_cordon', [(-0.43, 0.0, 0.785), (-0.2, 0.0, 0.86), (0.0, 0.0, 0.925), (0.2, 0.0, 0.86), (0.43, 0.0, 0.785)], 0.006, M['cuerda'], lados=5, ref=(0, 1, 0)))
    for sx in (-1, 1):
        p.append(cilindro(f'tab_armella{sx}', 0.012, 0.016, M['metal'], lados=6, centro=(sx * 0.43, 0.0, 0.776)))
    prop = unir(p, 'Prop_TableroBocetos')
    unir(hojas, 'Prop_TableroBocetos_Hojas', padre=prop)
    return prop


# ---------------------------------------------------------------- atlas

def uv_atlas_ponderado(objs, pesos, margen=0.0022):
    """Como P.uv_atlas, pero cada objeto se lleva pixeles por metro según su peso y cada pieza
    marcada con densa() según el suyo. Mide y empareja la densidad de cada objeto antes de acomodar
    las islas, así no depende de cómo las escale smart_project."""
    for o in objs:
        if o.data.uv_layers:
            o.data.uv_layers.active_index = 0
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # a 66° el chaflán se queda con su cara (a 50° cada chaflán era una tira con su margen y el
    # atlas del Estudio usaba 29 %; así, 56 %)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in objs:
        me = o.data
        uv = me.uv_layers.active.data
        co = np.empty(len(uv) * 2, np.float64)
        uv.foreach_get('uv', co)
        co = co.reshape(-1, 2)
        a3, auv = 0.0, 0.0
        for poly in me.polygons:
            a3 += poly.area
            idx = list(poly.loop_indices)
            xs, ys = co[idx, 0], co[idx, 1]
            auv += 0.5 * abs(np.dot(xs, np.roll(ys, 1)) - np.dot(ys, np.roll(xs, 1)))
        k = math.sqrt(auv / max(a3, 1e-9))
        co *= pesos.get(o.name, 1.0) / max(k, 1e-9)
        at = me.attributes.get('Densidad')
        if at:
            d = np.empty(len(me.polygons), np.float32)
            at.data.foreach_get('value', d)
            d[d <= 0] = 1.0
            tot = np.empty(len(me.polygons), np.int32)
            me.polygons.foreach_get('loop_total', tot)
            co *= np.repeat(d, tot)[:, None]
            me.attributes.remove(at)
        uv.foreach_set('uv', co.ravel())
    # lo marcado con al_rincon() no se acomoda: se esconde mientras se acomoda lo demás
    rincones = {}
    for o in objs:
        at = o.data.attributes.get('Rincon')
        if at:
            r = np.empty(len(o.data.polygons), np.float32)
            at.data.foreach_get('value', r)
            rincones[o.name] = r
            o.data.attributes.remove(at)
    bpy.ops.object.mode_set(mode='EDIT')
    for o in objs:
        if o.name in rincones:
            bm = bmesh.from_edit_mesh(o.data)
            bm.faces.ensure_lookup_table()
            for f in bm.faces:
                f.hide_set(bool(rincones[o.name][f.index] > 0))
            bmesh.update_edit_mesh(o.data)
    bpy.ops.mesh.select_all(action='SELECT')
    try:
        bpy.ops.uv.select_all(action='SELECT')
    except RuntimeError:
        pass
    bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method='FRACTION', margin=margen, shape_method='CONCAVE')
    bpy.ops.mesh.reveal(select=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    if rincones:
        # deja libre una franja arriba y a la derecha, y ahí los rincones (uno por número)
        for o in objs:
            uv = o.data.uv_layers.active.data
            co = np.empty(len(uv) * 2, np.float64)
            uv.foreach_get('uv', co)
            co = co.reshape(-1, 2) * 0.975
            if o.name in rincones:
                tot = np.empty(len(o.data.polygons), np.int32)
                o.data.polygons.foreach_get('loop_total', tot)
                r = np.repeat(rincones[o.name], tot)
                for k in np.unique(r[r > 0]):
                    sel = r == k
                    lo, hi = co[sel].min(axis=0), co[sel].max(axis=0)
                    lado = 0.016
                    base = np.array([0.98, 0.98 - (k - 1) * 0.022])
                    co[sel] = base + (co[sel] - lo) / np.maximum(hi - lo, 1e-9) * lado
            uv.foreach_set('uv', co.ravel())


def densidad(o, tam=TAM):
    me = o.data
    uv = me.uv_layers[0].data
    co = np.empty(len(uv) * 2, np.float64)
    uv.foreach_get('uv', co)
    co = co.reshape(-1, 2)
    a3, auv = 0.0, 0.0
    for poly in me.polygons:
        a3 += poly.area
        idx = list(poly.loop_indices)
        xs, ys = co[idx, 0], co[idx, 1]
        auv += 0.5 * abs(np.dot(xs, np.roll(ys, 1)) - np.dot(ys, np.roll(xs, 1)))
    return math.sqrt(auv / max(a3, 1e-9)) * tam


# ---------------------------------------------------------------- comandos

def descendientes(o):
    out = [o]
    for c in o.children:
        out += descendientes(c)
    return out


def grupo(nombre):
    """Los objetos con malla de un grupo, por jerarquía ('taller': cada mueble con sus hijos;
    'estudio': Prop_Estudio con los suyos). La pantalla y la computadora se llaman Prop_Estudio_* pero
    son muebles."""
    raices = ['Prop_Estudio'] if nombre == 'estudio' else MUEBLES
    objs = []
    for n in raices:
        o = bpy.data.objects.get(n)
        if o:
            objs += [d for d in descendientes(o) if d.type == 'MESH']
    return sorted(objs, key=lambda o: o.name)


def lugares():
    return sorted((o for o in bpy.data.objects if o.type == 'EMPTY' and o.name.startswith('Lugar_')), key=lambda o: o.name)


def abrir():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    bpy.context.preferences.filepaths.save_version = 0


def reporte(objs):
    total = 0
    for o in objs:
        bpy.context.view_layer.update()
        n = P.triangulos([o])
        total += n
        d = o.dimensions
        print(f'  {o.name:28s} {d.x:5.2f} x {d.y:5.2f} x {d.z:5.2f} m  {n:6d} tri  {densidad(o):5.0f} px/m')
    return total


def armar():
    P.limpiar()
    random.seed(SEMILLA)
    M = materiales()
    for clave in TOYS:
        TOY_MALLAS[clave] = toy_malla(clave, M)
    muebles = [escritorio(M), silla(M), atril(M), taza(M), caballete(M), estante(M), tablero(M), computadora(M)]
    revisar_caballete()
    revisar_toys()
    revisar_ventiladores()
    P.fila(muebles, separacion=0.8)
    E = materiales_estudio()
    estudio(E)
    revisar_escalera()
    for n in ('Prop_AtrilIpad', 'Prop_Taza'):
        asentar_lugar(n, 'Prop_Escritorio')
    taller, edificio = grupo('taller'), grupo('estudio')
    uv_atlas_ponderado(unicos(taller), PESOS)
    uv_atlas_ponderado(edificio, PESOS_ESTUDIO, margen=0.0018)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    reporte(taller)
    a = sum(P.triangulos([o]) for o in unicos(taller))
    b = reporte(edificio)
    print(f'armado: muebles {a} triángulos guardados (las copias de los art toys comparten malla), estudio {b}, total {a + b}')
    me = bpy.data.objects['Prop_Caballete_Lienzo'].data
    uv = me.uv_layers['UVMap'].data
    co = np.empty(len(uv) * 2, np.float64)
    uv.foreach_get('uv', co)
    co = co.reshape(-1, 2)
    cara = max((pl for pl in me.polygons if pl.material_index == 0), key=lambda pl: pl.area)
    idx = list(cara.loop_indices)
    a_uv = 0.5 * abs(np.dot(co[idx, 0], np.roll(co[idx, 1], 1)) - np.dot(co[idx, 1], np.roll(co[idx, 0], 1)))
    print(f'  la pintura del lienzo: {math.sqrt(a_uv / cara.area) * TAM * 0.6:.0f} px de lado en el atlas')


def pintar(tam=TAM, muestras=64):
    abrir()
    for nombre, g in GRUPOS.items():
        P.hornear_atlas(unicos(grupo(nombre)), g['png'], tam=tam, muestras=muestras)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', *[g['png'] for g in GRUPOS.values()])


def exportar_grupo(objs, extras, png, glb, calidad=88):
    """Como P.exportar_glb, pero con los vacíos (`extras`) adentro."""
    m = P.material_final(png, os.path.splitext(os.path.basename(glb))[0])
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs + extras:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    os.makedirs(os.path.dirname(glb), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_image_format='WEBP', export_image_quality=calidad, export_materials='EXPORT', export_yup=True,
        **P._sin_colores(),
    )
    return os.path.getsize(glb)


def exportar():
    abrir()
    for nombre, g in GRUPOS.items():
        n = exportar_grupo(grupo(nombre), lugares() if nombre == 'estudio' else [], g['png'], g['glb'])
        print(f'exportado: {g["glb"]} {n / 1024:.0f} KB')


def _foto(sc, cam, objs, ruta, az, el, res=(1200, 1000), escala=1.15):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centro = (lo + hi) / 2
    tam = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = tam * escala
    a, e = math.radians(az - 90), math.radians(el)
    d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    cam.location = centro + d * tam * 3
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cam.data.clip_end = tam * 10
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)


def _toma(sc, cam, ruta, loc, mira, lente=35, res=(1600, 1100)):
    cam.data.type = 'PERSP'
    cam.data.lens = lente
    cam.data.clip_end = 200
    cam.location = loc
    cam.rotation_euler = (Vector(mira) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    return ruta


def _brillo(sc):
    """Un bloom en el compositor para la foto del letrero prendido (si no se puede, sin él)."""
    try:
        arbol = bpy.data.node_groups.new('brillo', 'CompositorNodeTree')
        arbol.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        capa = arbol.nodes.new('CompositorNodeRLayers')
        gl = arbol.nodes.new('CompositorNodeGlare')
        sal = arbol.nodes.new('NodeGroupOutput')
        for k, v in (('Type', 'Bloom'), ('Quality', 'High'), ('Threshold', 1.0), ('Strength', 0.8), ('Size', 0.6)):
            try:
                gl.inputs[k].default_value = v
            except Exception:
                pass
        arbol.links.new(capa.outputs['Image'], gl.inputs['Image'])
        arbol.links.new(gl.outputs['Image'], sal.inputs[0])
        sc.compositing_node_group = arbol
        sc.render.use_compositing = True
    except Exception as e:  # el compositor cambia de una versión a otra
        print('  sin brillo:', e)


# Zonas de revisión: (nombre, a dónde mira, distancia, [(azimut, elevación)]); azimut 0 = desde -Y
ZONAS = [
    ('escalera', (3.25, 0.65, 1.8), 9.5, [(60, 18), (100, 12), (150, 22), (10, 40)]),
    ('azotea', (1.9, -0.4, 3.9), 5.0, [(70, 30), (130, 35), (20, 50), (0, 80)]),
    ('tinaco', (0.55, 0.25, 6.7), 3.6, [(-20, 18), (60, 22), (160, 25), (0, 75)]),
    ('torre_frente', (-3.15, -0.1, 1.7), 4.6, [(-40, 12), (0, 8), (40, 15), (0, 55)]),
    ('atras', (-0.6, 2.7, 2.0), 9.0, [(180, 10), (140, 18), (220, 18), (180, 55)]),
    ('letrero', (-2.8, 0.4, 6.95), 4.0, [(-15, 10), (40, 25), (150, 25), (0, 70)]),
    ('cajas', (-1.95, -1.9, 0.4), 2.6, [(-30, 20), (20, 25), (-80, 15), (0, 70)]),
    ('voladizo', (0.0, -1.9, 3.1), 6.5, [(10, -8), (-40, 5), (40, 10), (0, 45)]),
]


def _desde(mira, dist, az, el):
    a, e = math.radians(az - 90), math.radians(el)
    return Vector(mira) + Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e))) * dist


def render(carpeta, muebles=False):
    abrir()
    for nombre, g in GRUPOS.items():
        m = P.material_final(g['png'], f'revision_{nombre}')
        for o in grupo(nombre):
            o.data.materials.clear()
            o.data.materials.append(m)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('fondo')
    fondo = w.node_tree.nodes['Background']
    fondo.inputs['Color'].default_value = P.srgb('#3a3f52')
    fondo.inputs['Strength'].default_value = 0.9
    sc.world = w
    sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
    sol.data.energy = 2.4
    sol.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.collection.objects.link(sol)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    os.makedirs(carpeta, exist_ok=True)
    rutas = []
    taller, edificio = grupo('taller'), grupo('estudio')
    padres = [bpy.data.objects[n] for n in MUEBLES]
    # cada mueble solo (de tres cuartos y por detrás) y la fila
    for o in edificio:
        o.hide_render = True
    if muebles:
        for pr in padres:
            g = [d for d in descendientes(pr) if d.type == 'MESH']
            for o in taller:
                o.hide_render = o not in g
            for i, (az, el) in enumerate(((-30, 22), (150, 26), (0, 70))):
                ruta = os.path.join(carpeta, f'mueble_{pr.name[5:].lower()}_{i}.png')
                _foto(sc, cam, g, ruta, az, el, escala=1.45)
                rutas.append(ruta)
    for o in taller:
        o.hide_render = False
    ruta = os.path.join(carpeta, 'taller_fila.png')
    _foto(sc, cam, padres, ruta, -20, 22, res=(2200, 800), escala=1.04)
    rutas.append(ruta)
    # los muebles en sus lugares, adentro del Estudio
    bpy.context.view_layer.update()
    for pr in padres:
        pr.matrix_world = bpy.data.objects['Lugar_' + pr.name[5:]].matrix_world.copy()
    for o in edificio:
        o.hide_render = False
    techo = bpy.data.objects['Prop_Estudio_Techo']
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'estudio_34.png'), (-8.5, -11.5, 6.0), (0.0, 0.2, 2.9), lente=30))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'estudio_34_der.png'), (10.0, -10.5, 6.0), (0.3, 0.2, 2.9), lente=30))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'estudio_atras.png'), (9.5, 11.0, 6.5), (0.0, 0.3, 2.9), lente=30))
    _foto(sc, cam, edificio, os.path.join(carpeta, 'estudio_frente.png'), 0, 0, res=(1600, 1400), escala=1.1)
    rutas.append(os.path.join(carpeta, 'estudio_frente.png'))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'camara_juego.png'), (1.0, -15.5, 14.5), (0.2, 0.3, 1.8), lente=38))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'planta_baja.png'), (0.6, -5.6, 1.7), (0.1, 1.1, 1.0), lente=24))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'escritorio.png'), (0.9, 0.35, 1.55), (0.2, 2.0, 0.85), lente=30))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'escritorio_compu.png'), (1.75, 0.9, 1.0), (0.95, 2.0, 0.4), lente=35))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'caballete.png'), (-0.55, -1.75, 1.35), (-1.35, -0.42, 1.0), lente=35))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'estante.png'), (-0.4, 0.6, 1.2), (-1.95, 1.2, 0.75), lente=35))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'estante_cerca.png'), (-1.05, 0.95, 1.05), (-1.95, 1.2, 0.8), lente=32))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'escritorio_skullkid.png'), (0.62, 1.35, 1.12), (0.12, 2.08, 0.88), lente=40))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'compu_tapa.png'), (1.35, 1.3, 1.05), (0.97, 2.02, 0.5), lente=40))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'escalera_pie.png'), (4.9, -2.3, 0.95), (3.5, -0.55, 0.35), lente=35))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'escalera_descanso.png'), (5.3, 3.9, 2.9), (3.2, 1.9, 1.9), lente=35))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'escalera_llegada.png'), (2.25, -3.3, 5.3), (2.6, -0.85, 3.75), lente=32))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'puerta_caja.png'), (2.35, -1.2, 4.6), (1.55, 0.0, 4.4), lente=30))
    techo.hide_render = True
    for n in techo.children:
        n.hide_render = True
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'planta_baja_sin_techo.png'), (0.0, -3.0, 9.5), (0.0, 0.6, 0.4), lente=28))
    techo.hide_render = False
    # los grafitis, de frente a cada muro, y el tinaco
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'grafiti_torre_espalda.png'), (-3.15, 6.2, 2.1), (-3.15, 2.9, 2.05), lente=40, res=(1200, 1200)))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'grafiti_pared_atras.png'), (0.6, 6.4, 1.6), (0.6, 2.6, 1.4), lente=32))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'grafiti_torre_costado.png'), (-7.6, 1.45, 1.8), (-3.85, 1.45, 1.6), lente=38))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'grafiti_tinaco.png'), (0.75, -2.4, 7.4), (0.55, 0.25, 6.9), lente=40, res=(1200, 1200)))
    # cada zona desde varios ángulos, una desde arriba
    for nombre, mira, dist, vistas in ZONAS:
        for i, (az, el) in enumerate(vistas):
            rutas.append(_toma(sc, cam, os.path.join(carpeta, f'zona_{nombre}_{i}.png'), _desde(mira, dist, az, el), mira, lente=35, res=(1300, 1000)))
    # el letrero, apagado y prendido
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'letrero_apagado.png'), (-2.3, -4.4, 7.9), (-2.8, 0.1, 7.0), lente=45, res=(1600, 900)))
    neon = bpy.data.materials.new('neon_prendido')
    nt = neon.node_tree
    nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = P.srgb('#f5ff00')
    em.inputs['Strength'].default_value = 7.0
    sal = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], sal.inputs['Surface'])
    for i in range(7):
        o = bpy.data.objects[f'Prop_Estudio_Neon_{i}']
        o.data.materials.clear()
        o.data.materials.append(neon)
    for nombre, color, fuerza in (('Prop_Estudio_Computadora_LuzBoton', '#ffffff', 6.0), ('Prop_Estudio_Computadora_LuzVentiladores', '#3f7bff', 3.0)):
        m = bpy.data.materials.new(nombre + '_prendida')
        m.node_tree.nodes.clear()
        e2 = m.node_tree.nodes.new('ShaderNodeEmission')
        e2.inputs['Color'].default_value = P.srgb(color)
        e2.inputs['Strength'].default_value = fuerza
        s2 = m.node_tree.nodes.new('ShaderNodeOutputMaterial')
        m.node_tree.links.new(e2.outputs[0], s2.inputs['Surface'])
        o = bpy.data.objects[nombre]
        o.data.materials.clear()
        o.data.materials.append(m)
    fondo.inputs['Color'].default_value = P.srgb('#101320')
    fondo.inputs['Strength'].default_value = 0.5
    sol.data.energy = 0.35
    _brillo(sc)
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'letrero_prendido.png'), (-2.3, -4.4, 7.9), (-2.8, 0.1, 7.0), lente=45, res=(1600, 900)))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'estudio_noche.png'), (-8.5, -11.5, 6.0), (0.0, 0.2, 2.9), lente=30))
    rutas.append(_toma(sc, cam, os.path.join(carpeta, 'compu_prendida.png'), (1.45, 1.05, 0.62), (0.97, 2.0, 0.33), lente=40))
    print('render:', *rutas, sep='\n  ')


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    rapido = 'rapido' in args[1:]
    con_muebles = 'muebles' in args[1:]
    resto = [a for a in args[1:] if a not in ('rapido', 'muebles')]
    carpeta = resto[0] if resto else os.path.join(tempfile.gettempdir(), 'props_taller')
    if cmd in ('armar', 'todo'):
        armar()
    if cmd in ('pintar', 'todo'):
        pintar(1024, 16) if rapido else pintar()
    if cmd in ('exportar', 'todo'):
        exportar()
    if cmd in ('render', 'todo'):
        render(carpeta, con_muebles)
