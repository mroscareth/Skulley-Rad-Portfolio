"""Los fosos de los letreros de los portales (Oscar, 2026-11-25). Durante el juego de las esferas los
letreros de neón (scripts/estilo/props_letreros.py) se meten al piso para no estorbar, y no
atravesándolo: "imagina que debajo de ellas hay una estructura metálica con compuertas y ahí se meten".
Debajo de cada letrero hay una bóveda de acero como elevador de escenario: el letrero va parado en una
plataforma que un pistón hidráulico baja al foso, y dos compuertas se cierran encima; para volver, las
compuertas se abren (quedan colgando adentro, pegadas a sus paredes), la plataforma sube y el letrero sale.
El sitio lo anima; aquí van las piezas. Mismo estilo y librería que los demás props (pintura.py) y la
misma regla: todo se sostiene, todo está conectado, y se mide (`revisar`), no a ojo.

Cómo funciona (cada pieza tiene de qué colgarse):
- El marco: ángulo de acero al ras del piso alrededor de la boca (patín de 9 cm arriba, con franjas
  amarillas #f5ff00 y negras, y su pierna de 10 cm que baja por la orilla de la boca). En las cabeceras
  el patín pasa encima de una bolsa del foso (8 cm más larga que la boca) donde viven los rieles y los
  motores de las compuertas.
- El foso: caja de lámina cerrada (cuatro paredes y fondo, las caras hacia adentro), del piso hasta el
  fondo. Coladera en el fondo.
- Las compuertas: dos hojas largas, cada una con bisagra en una orilla larga de la boca. La bisagra es
  una flecha (el eje) que va por debajo de la hoja, amarrada a ella con mazas y tirantes, y que gira en
  chumaceras soldadas a la pierna del marco (entre maza y maza), pasa por collarines en las piernas de
  las cabeceras y en la cabecera +X entra al motorreductor que la gira (motor colgado, soporte a la
  pared, tubo conduit a la pared). Como el eje va abajo de la hoja, la hoja se abre hacia adentro y
  cuelga pegada a su pared con la cara de arriba viendo al letrero. Las orillas de en medio son arcos
  alrededor de su propio eje: así las dos pueden girar a la vez sin tocarse (al cruzar quedan a 5 mm).
- La plataforma: cubierta de placa antiderrapante donde se apoya el dado de concreto del letrero (con
  grapas de ángulo atornilladas), dos canales C a lo largo, travesaños en las cabeceras y sobre cada
  pistón, una horquilla bajo cada travesaño de pistón donde se atornilla el vástago, y en cada cabecera
  un poste con dos zapatas guía (deslizantes, con forro de nylon) que abrazan el alma del riel T
  atornillado a la pared de la bolsa.
- Los pistones: dos, de émbolo, como los de los elevadores hidráulicos: la camisa va enterrada abajo del
  fondo del foso (en su barreno) y solo asoma su cabeza (brida atornillada al fondo y prensaestopas). El
  vástago está siempre adentro de la camisa (con la plataforma arriba le quedan TRASLAPE metros
  adentro). Del costado de cada cabeza sale su tubo hidráulico, va por el fondo sobre soportes, sube
  por la pared de la cabecera -X y entra a la pared (a la bomba, que no se ve).
- Las lámparas de aviso: una en cada esquina del marco (carcasa fija, lente ámbar aparte).
- La corriente: una caja de conexión de acero parada en el piso junto al marco del lado +Y (la orilla de
  atrás: en el sitio ve hacia afuera del claro), cerca de la cabecera +X, con su oreja atornillada al
  patín. De su prensaestopas sale el cable de la Renderbox (props_claro.py: mismo grosor, material y
  registro de concreto con tapa de lámina), que baja al piso, se tiende unos 6 m hacia +Y con curvas
  flojas y entra por la muesca de su registro, entre los pinos (REGISTRO_Y). Va en lo fijo.

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_fosos.py -- todo [carpeta_fotos] [rapido]

  armar     arma los diez, los mide, les da su atlas y guarda Character/Estilo_fosos.blend
  pintar    hornea el atlas (Cycles): Character/assets/props_fosos.png (el maestro)
  exportar  public/3dmodels/estilo/props_fosos.glb (Draco, WebP, un material) y lo vuelve a leer
  render    fotos de revisión (Eevee) en la carpeta que se le dé
  vista     armar y fotos de la geometría con Workbench (sin hornear, para iterar)
  todo      armar, pintar, exportar y render
  `rapido`  hornea a 1024 con pocas muestras

props_fosos.glb (metros, en el MISMO marco que su letrero: el origen en el piso debajo del centro del
letrero, x a lo largo del letrero, sus caras hacia ±Y de Blender, el piso en z = 0). S = <sección>_<idioma>,
los diez de props_letreros.glb (section1..5 × en/es). Todos los nodos van en la raíz:
  Prop_FosoPortal_S               lo fijo: marco, foso, coladera, rieles, chumaceras, collarines,
                                  motorreductores, cabezas y camisas de los pistones, tubos hidráulicos,
                                  carcasas de las lámparas, caja de conexión, cable y registro.
                                  Transformación identidad.
  Prop_FosoPortal_S_Plataforma    la plataforma con sus zapatas y los vástagos, en la pose de ARRIBA
                                  (lo de arriba de la cubierta en z = -0.10, bajo el dado del letrero).
                                  Identidad. El sitio la baja (con el letrero) en línea recta BAJADA m.
  Prop_FosoPortal_S_PuertaA       la compuerta del lado -Y, CERRADA, con su flecha y sus mazas. Su origen
                                  está en el eje de la bisagra (a lo largo de X). Abierta = girada
                                  GIRO_PUERTA['A'] rad en X (en three: rotation.x, Y arriba).
  Prop_FosoPortal_S_PuertaB       la del lado +Y, igual, GIRO_PUERTA['B'].
  Prop_FosoPortal_S_LuzAviso      los lentes ámbar de las lámparas (el sitio los hace parpadear).
  Prop_FosoPortal_S_Boca          un cuadro plano que tapa justo la boca en z = 0.001 (solo su forma).
Los números de cada foso (boca, bajada, giros, registro) también van como extras del nodo Prop_FosoPortal_S.
Secuencia: bajar = plataforma de 0 a -BAJADA con las puertas abiertas, luego puertas de abierto a cerrado;
subir = puertas de cerrado a abierto, luego la plataforma de -BAJADA a 0.
"""
import math
import os
import random
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.dont_write_bytecode = True
import pintura as P  # noqa: E402
import props_taller as T  # noqa: E402
import props_claro as C  # noqa: E402
import props_letreros as L  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_fosos.blend')
PNG = os.path.join(REPO, 'Character', 'assets', 'props_fosos.png')
GLB = os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_fosos.glb')
TAM = 2048
SEMILLA = 53
RAIZ = 'Prop_FosoPortal'
# abierta = girada esto en X desde cerrada (en Blender y en three es el mismo número: el eje X no cambia)
GIRO_PUERTA = {'A': -math.pi / 2, 'B': math.pi / 2}

ACERO_AZUL = {'oscuro': '#2e3747', 'base': '#4c5b70', 'claro': '#73859d', 'orilla': '#b8c5d6', 'oxido': '#6a3a22'}
FOSO_OSCURO = {'oscuro': '#11151b', 'base': '#1e232c', 'claro': '#2d3440', 'orilla': '#56606e', 'oxido': '#3e2516'}
VASTAGO = {'oscuro': '#596270', 'base': '#7d8794', 'claro': '#a3acb7', 'orilla': '#dde3ea', 'oxido': '#6a4a30'}
MOTOR = {'oscuro': '#1e383b', 'base': '#2d5357', 'claro': '#44767a', 'orilla': '#9cc1c0', 'oxido': '#5e3420'}
AMARILLO = '#f5ff00'
NEGRO_FRANJA = '#17181c'
AMBAR = '#ffa21a'

# ---------------------------------------------------------------- medidas (metros)
Z_MARCO = 0.005             # lo de arriba del marco (y de las compuertas cerradas)
MARCO = {'ancho': 0.09, 'grueso': 0.010, 'pierna': 0.008, 'abajo': -0.10, 'bisel': 0.004}
HOLGURA = 0.05              # del letrero (y de las compuertas colgadas) a lo que tiene junto
BOLSA = 0.08                # el foso sigue esto más allá de la boca en cada cabecera (rieles y motores)
# compuertas: grueso de la hoja; e = del eje a la cara de abajo de la hoja; hx = de la orilla de la boca
# al eje; lado = hueco de la hoja al marco en la bisagra; cabecera = hueco a las cabeceras; cruce = lo
# más cerca que quedan las dos al girar juntas (las orillas de en medio son arcos de su eje)
PU = {'grueso': 0.025, 'e': 0.035, 'hx': 0.022, 'lado': 0.008, 'cabecera': 0.006, 'cruce': 0.0025, 'bisel': 0.003}
EJE_R = 0.010
MAZA = {'r': 0.015, 'largo': 0.05, 'orilla': 0.09}
CHUMACERA = {'medio': 0.016, 'largo': 0.044, 'placa': 0.006, 'placa_alto': 0.020}
COLLARIN = {'r': 0.020, 'largo': 0.010}
PASO_BISAGRA = 0.75         # de maza a maza (entre ellas, una chumacera)
CUBIERTA = {'z1': -0.100, 'grueso': 0.012, 'y': 0.19, 'cabecera': 0.012}
VIGA = {'h': 0.10, 'b': 0.04, 't': 0.006, 'y': 0.14}
TRAVESANO = 0.06
HORQUILLA = {'grueso': 0.020, 'medio': 0.06}
VASTAGO_R = 0.030
CABEZA = {'brida_r': 0.085, 'brida_h': 0.015, 'prensa_r': 0.055, 'alto': 0.10, 'camisa_r': 0.050, 'puerto_z': 0.055}
TRASLAPE = 0.30             # lo que le queda al vástago adentro de la camisa con la plataforma arriba
PISTONES = 0.28             # los pistones a ± esto del largo de la cubierta desde su centro
BAJADA = 1.85               # lo que baja la plataforma (y el letrero)
Z_VIGAS = CUBIERTA['z1'] - CUBIERTA['grueso'] - VIGA['h']
Z_HORQUILLA = Z_VIGAS - HORQUILLA['grueso']
Z_FONDO = math.floor((Z_HORQUILLA - BAJADA - 0.03 - CABEZA['alto']) * 100) / 100
RIEL = {'patin': 0.045, 'patin_g': 0.010, 'alma': 0.008, 'alma_largo': 0.050, 'tope': -0.105, 'pie': 0.010}
ZAPATA = {'z': (-0.16, -0.29), 'medio_alto': 0.04, 'brazo': 0.022, 'hueco': 0.0015, 'forro': 0.001}
POSTE_GUIA = {'grueso': 0.012, 'y': 0.05, 'abajo': -0.33}
TUBO_R = 0.008
LAMPARA = {'r': 0.032, 'alto': 0.012, 'lente_r': 0.026, 'lente_alto': 0.028}
PERIODO_FRANJA = 0.12
CAMARA_CABECEO = 40
# la corriente (Oscar, 2026-11-25: "ponle cables a los anuncios, que se conecten a la base que no se oculta"
# y "que se oculten hacia los pinos"): una caja de conexión atornillada al marco del lado +Y (la orilla de
# atrás, que en el sitio ve hacia afuera del claro), cerca de la cabecera +X; de su prensaestopas sale el
# cable de la Renderbox (props_claro.py: mismo grosor, material y registro) y se tiende hacia +Y hasta su
# registro, entre los pinos. Va en lo fijo: el letrero baja y el cable se queda.
CONEXION = {'x': -0.30, 'ancho': 0.12, 'fondo': 0.07, 'alto': 0.045, 'oreja': 0.04, 'sep': 0.001}   # x desde la cabecera +X
PRENSA_CABLE = {'r': 0.010, 'tuerca': 0.004, 'largo': 0.016, 'z': 0.022}
REGISTRO_Y = 5.75           # el centro del registro, en +Y desde el centro de la fosa
REGISTRO_DX = 0.20          # y corrido esto en +X desde la caja
CORDON_R = C.CORDON_R
SOBRE_PISO = C.SOBRE_PISO

REVISION = []


def anotar(texto):
    print('  ' + texto)
    REVISION.append(texto)


def claves():
    """Las diez, en el orden de props_letreros (inglés primero)."""
    for lang in ('en', 'es'):
        for sec in L.NOMBRES[lang]:
            yield f'{sec}_{lang}'


# ---------------------------------------------------------------- materiales

def _sep(N, v):
    s = N.n('ShaderNodeSeparateXYZ')
    N.l(v, s.inputs[0])
    return s


def material_marco(nombre):
    """El acero del marco con las franjas de seguridad pintadas en lo de arriba: amarillo del sitio y
    negro en diagonal, gastadas y con mugre de pisadas."""
    m = P.material_metal(nombre, paleta=ACERO_AZUL, oxido=0.15)

    def pintar(N, col, pos, geo):
        sp = _sep(N, pos)
        sn = _sep(N, geo.outputs['True Normal'])
        arriba = P.suave(N, sn.outputs['Z'], 0.55, 0.85)
        s = N.val('DIVIDE', N.val('ADD', sp.outputs['X'], sp.outputs['Y']), PERIODO_FRANJA)
        f = N.val('FRACT', N.val('ADD', s, N.val('MULTIPLY', N.ruido(pos, 5.0, detalle=1.0), 0.05)))
        negro = N.val('MULTIPLY', P.suave(N, f, 0.47, 0.53), N.val('SUBTRACT', 1.0, P.suave(N, f, 0.95, 1.0)))
        campo = N.ruido(pos, 4.0, detalle=3.0, rugosidad=0.6, distorsion=1.4)
        amarillo = N.rampa(campo, [(0.0, AMARILLO), (1.0, AMARILLO)])
        amarillo = P.lavado(N, amarillo, campo, 0.62, 0.07, '#fbff9a', 0.4, borde=0.0)
        amarillo = P.lavado(N, amarillo, campo, 0.4, 0.07, '#c4cc00', 0.3, borde=0.25, invertido=True)
        pintura = N.mezcla(negro, amarillo, NEGRO_FRANJA)
        cae = N.val('ADD', N.celdas(P.deformado(N, pos, 6.0, 0.06), 9.0).outputs['Distance'], N.val('MULTIPLY', N.ruido(pos, 11.0), 0.3))
        queda = P.suave(N, cae, 0.15, 0.19)
        filo = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', cae, 0.17)), 0.0, 0.03))
        col = N.mezcla(N.val('MULTIPLY', arriba, queda), col, pintura)
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', arriba, filo), 0.5), col, '#101114')
        pisadas = N.ruido(N.escalar(pos, (3.0, 3.0, 1.0)), 1.0, detalle=2.0, distorsion=1.2)
        return P.lavado(N, col, pisadas, 0.58, 0.08, '#2b2a22', N.val('MULTIPLY', arriba, 0.35), borde=0.2)
    return T.encima(m, pintar)


def material_placa(nombre):
    """Placa antiderrapante (compuertas y cubierta): acero con los gajos en diagonal alternada en lo de
    arriba, cada uno con su luz y su filo oscuro."""
    m = P.material_metal(nombre, paleta=ACERO_AZUL, oxido=0.12)

    def pintar(N, col, pos, geo):
        sp = _sep(N, pos)
        sn = _sep(N, geo.outputs['True Normal'])
        arriba = P.suave(N, sn.outputs['Z'], 0.6, 0.85)
        paso = 0.09
        u = N.val('DIVIDE', sp.outputs['X'], paso)
        v = N.val('DIVIDE', sp.outputs['Y'], paso)
        fu = N.val('SUBTRACT', N.val('FRACT', u), 0.5)
        fv = N.val('SUBTRACT', N.val('FRACT', v), 0.5)
        par = N.val('MODULO', N.val('ADD', N.val('ADD', N.val('FLOOR', u), N.val('FLOOR', v)), 1000.0), 2.0)
        signo = N.val('SUBTRACT', 1.0, N.val('MULTIPLY', par, 2.0))
        sv = N.val('MULTIPLY', fv, signo)
        a = N.val('ABSOLUTE', N.val('MULTIPLY', N.val('ADD', fu, sv), 0.7071))
        b = N.val('ABSOLUTE', N.val('MULTIPLY', N.val('SUBTRACT', fu, sv), 0.7071))
        gajo = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, a, 0.24, 0.29)), N.val('SUBTRACT', 1.0, P.suave(N, b, 0.06, 0.09)))
        aura = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, a, 0.28, 0.35)), N.val('SUBTRACT', 1.0, P.suave(N, b, 0.08, 0.13)))
        filo = N.val('MAXIMUM', N.val('SUBTRACT', aura, gajo), 0.0)
        col = N.mezcla(N.val('MULTIPLY', filo, N.val('MULTIPLY', arriba, 0.55)), col, ACERO_AZUL['oscuro'])
        col = N.mezcla(N.val('MULTIPLY', gajo, N.val('MULTIPLY', arriba, 0.5)), col, ACERO_AZUL['claro'])
        gasto = N.ruido(pos, 2.5, detalle=2.0, distorsion=1.0)
        return P.lavado(N, col, gasto, 0.6, 0.08, '#2a2b26', N.val('MULTIPLY', arriba, 0.3), borde=0.2)
    return T.encima(m, pintar)


def material_foso(nombre):
    """La lámina de adentro del foso: más oscura entre más hondo, juntas de los paneles, escurrimientos
    de mugre y de óxido que bajan, y charcos secos en el fondo."""
    m = P.material_metal(nombre, paleta=FOSO_OSCURO, oxido=0.2)

    def pintar(N, col, pos, geo):
        sp = _sep(N, pos)
        sn = _sep(N, geo.outputs['True Normal'])
        z = sp.outputs['Z']
        vertical = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', sn.outputs['Z']), 0.6, 0.8))
        piso = P.suave(N, sn.outputs['Z'], 0.6, 0.8)
        hondo = N.rampa(P.suave(N, z, Z_FONDO, -0.2), [(0.0, (0.5, 0.5, 0.53, 1)), (1.0, (1, 1, 1, 1))])
        col = N.mezcla(1.0, col, hondo, 'MULTIPLY')
        # juntas de los paneles: cada 0.9 m a lo largo de la pared y cada 0.75 m de alto
        lado = N.val('GREATER_THAN', N.val('ABSOLUTE', sn.outputs['X']), N.val('ABSOLUTE', sn.outputs['Y']))
        u = N.val('ADD', sp.outputs['X'], N.val('MULTIPLY', lado, N.val('SUBTRACT', sp.outputs['Y'], sp.outputs['X'])))
        du = N.val('MULTIPLY', N.val('ABSOLUTE', N.val('SUBTRACT', N.val('FRACT', N.val('DIVIDE', u, 0.9)), 0.5)), 0.9)
        dz = N.val('MULTIPLY', N.val('ABSOLUTE', N.val('SUBTRACT', N.val('FRACT', N.val('DIVIDE', z, 0.75)), 0.5)), 0.75)
        junta = N.val('MAXIMUM', N.val('SUBTRACT', 1.0, P.suave(N, N.val('SUBTRACT', 0.45, du), 0.002, 0.008)),
                      N.val('SUBTRACT', 1.0, P.suave(N, N.val('SUBTRACT', 0.375, dz), 0.002, 0.008)))
        col = N.mezcla(N.val('MULTIPLY', junta, N.val('MULTIPLY', vertical, 0.6)), col, '#06070a')
        # escurrimientos
        chorro = N.ruido(N.escalar(pos, (16.0, 16.0, 0.5)), 1.0, detalle=2.0, distorsion=0.4)
        col = N.mezcla(N.val('MULTIPLY', P.suave(N, chorro, 0.55, 0.62), N.val('MULTIPLY', vertical, 0.55)), col, '#07080a')
        oxido = N.ruido(N.escalar(pos, (9.0, 9.0, 0.7)), 1.0, detalle=2.0, distorsion=0.5)
        col = N.mezcla(N.val('MULTIPLY', P.suave(N, oxido, 0.62, 0.68), N.val('MULTIPLY', vertical, 0.28)), col, '#4a2414')
        charco = N.ruido(pos, 1.6, detalle=3.0, distorsion=1.2)
        return P.lavado(N, col, charco, 0.58, 0.06, '#06080b', N.val('MULTIPLY', piso, 0.6), borde=0.35)
    return T.encima(m, pintar)


def materiales():
    return {
        'marco': material_marco('Fosos_Marco'),
        'acero': P.material_metal('Fosos_Acero', paleta=ACERO_AZUL, oxido=0.18),
        'placa': material_placa('Fosos_Placa'),
        'foso': material_foso('Fosos_Foso'),
        'esmalte': P.material_metal('Fosos_Esmalte', paleta=T.ACERO_NEGRO, oxido=0.15),
        'vastago': P.material_metal('Fosos_Vastago', paleta=VASTAGO, oxido=0.12),
        'motor': P.material_metal('Fosos_Motor', paleta=MOTOR, oxido=0.15),
        'oxido': P.material_metal('Fosos_Oxido', paleta=T.METAL_OXIDO, oxido=0.5),
        'goma': P.material_liso('Fosos_Goma', '#1c1d21', claro='#33353b', oscuro='#0e0f11', orilla='#666a72'),
        'rejilla': T.material_reja('Fosos_Rejilla', paso=0.022),
        'lente': P.material_brillo('Fosos_Lente', AMBAR),
        'boca': P.material_brillo('Fosos_Boca', '#08090b'),
        # los del cable y el registro de la Renderbox (props_claro.materiales), con los mismos parámetros
        'cable': P.material_liso('Fosos_Cable', '#141417', claro='#2a2b31', oscuro='#08080a', orilla='#4c4e55'),
        'goma_cable': P.material_liso('Fosos_GomaCable', '#19191c', claro='#2b2c31', oscuro='#0b0b0d', orilla='#4a4c52'),
        'concreto': P.material_concreto('Fosos_Concreto', musgo=0.15),
        'fierro': P.material_metal('Fosos_Fierro', paleta=T.ACERO, oxido=0.7),
        'tapa': P.material_metal('Fosos_TapaRegistro', paleta=T.ACERO, oxido=0.35),
    }


# ---------------------------------------------------------------- piezas

def caja(nombre, a, b, material, bisel=0.0):
    return T.caja_ab(nombre, a, b, material, bisel=bisel)


def cil_x(nombre, r, x0, x1, y, z, material, lados=8):
    return T.cilindro(nombre, r, x1 - x0, material, lados=lados, centro=(x0, y, z), rot=(0, math.pi / 2, 0))


def cil_y(nombre, r, y0, y1, x, z, material, lados=8):
    return T.cilindro(nombre, r, y1 - y0, material, lados=lados, centro=(x, y0, z), rot=(-math.pi / 2, 0, 0))


def cil_z(nombre, r, z0, z1, x, y, material, lados=10):
    return T.cilindro(nombre, r, z1 - z0, material, lados=lados, centro=(x, y, z0))


def tuerca(nombre, centro, material, r=0.009, alto=0.007):
    """Una tuerca (o cabeza de tornillo) cuadrada, como las de los letreros."""
    return T.cilindro(nombre, r, alto, material, lados=4, centro=centro, rot=(0, 0, math.pi / 4))


def medidas(V):
    """Las medidas de un foso a partir de la malla de su letrero (V: vértices en su marco)."""
    x0, x1 = float(V[:, 0].min()), float(V[:, 0].max())
    hy = float(np.abs(V[:, 1]).max())
    dado = V[V[:, 2] < -0.05]
    wy2 = hy + HOLGURA + PU['hx'] + PU['e'] + PU['grueso']
    xa0, xa1 = x0 - HOLGURA, x1 + HOLGURA
    B = {'x0': x0, 'x1': x1, 'hy': hy, 'tope': float(V[:, 2].max()), 'dx0': float(dado[:, 0].min()), 'dx1': float(dado[:, 0].max()),
         'wy2': wy2, 'xa0': xa0, 'xa1': xa1, 'xc': (xa0 + xa1) / 2, 'xp0': xa0 - BOLSA, 'xp1': xa1 + BOLSA,
         'yp': wy2 + MARCO['pierna'] + 0.001, 'yh': wy2 - PU['hx'], 'zh': Z_MARCO - PU['grueso'] - PU['e'], 'zf': Z_FONDO,
         'xd0': xa0 + PU['cabecera'], 'xd1': xa1 - PU['cabecera']}
    c0, c1 = xa0 + CUBIERTA['cabecera'], xa1 - CUBIERTA['cabecera']
    B['cub'] = (c0, c1)
    B['pistones'] = ((c0 + c1) / 2 - PISTONES * (c1 - c0), (c0 + c1) / 2 + PISTONES * (c1 - c0))
    B['vastago'] = Z_HORQUILLA - (Z_FONDO + CABEZA['alto'] - TRASLAPE)
    n = max(2, round((B['xd1'] - B['xd0'] - 2 * MAZA['orilla']) / PASO_BISAGRA) + 1)
    B['mazas'] = list(np.linspace(B['xd0'] + MAZA['orilla'], B['xd1'] - MAZA['orilla'], n))
    B['chumaceras'] = [(a + b) / 2 for a, b in zip(B['mazas'], B['mazas'][1:])]
    B['flecha'] = (xa0 - 0.014, xa1 + 0.040)
    B['motor_x'] = (xa1 + 0.014, xa1 + 0.064)
    return B


def perfil_puerta(B):
    """La sección de una hoja en (dy, dz) desde su eje (dy hacia el centro de la boca). La orilla de en
    medio es un arco de radio R alrededor del eje (así nada de la hoja pasa de R al girar) y la esquina
    de arriba del lado de la bisagra se redondea con radio h (así al girar no sube del marco)."""
    e, h = PU['e'], PU['e'] + PU['grueso']
    R = B['yh'] - PU['cruce']
    dyh = -(PU['hx'] - PU['lado'])
    a0 = math.atan2(e, math.sqrt(R * R - e * e))
    a1 = math.atan2(h, math.sqrt(R * R - h * h))
    pts = [(dyh, e)]
    for k in range(4):
        a = a0 + (a1 - a0) * k / 3
        pts.append((R * math.cos(a), R * math.sin(a)))
    pts.append((0.0, h))
    for dy in (-0.007, dyh):
        pts.append((dy, math.sqrt(h * h - dy * dy)))
    return pts


def puerta(B, E, s):
    """Una compuerta (s = -1: A, del lado -Y; s = +1: B) cerrada, en el marco del foso: la hoja, sus
    mazas con tirantes y la flecha. Regresa las piezas por grupo (para medir antes de unir)."""
    yh, zh = s * B['yh'], B['zh']

    def a_mundo(dy, dz):
        return s * (B['yh'] - dy), zh + dz
    pf = perfil_puerta(B)
    bm = bmesh.new()
    v0 = [bm.verts.new((B['xd0'], *a_mundo(dy, dz))) for dy, dz in pf]
    v1 = [bm.verts.new((B['xd1'], *a_mundo(dy, dz))) for dy, dz in pf]
    n = len(pf)
    for k in range(n):
        m = (k + 1) % n
        bm.faces.new((v0[k], v0[m], v1[m], v1[k]))
    bm.faces.new(v0)
    bm.faces.new(list(reversed(v1)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    hoja = P.objeto('hoja', bm, E['placa'])
    P.biselar(hoja, PU['bisel'], 1)
    T.densa(hoja, 1.9)
    G = {'hoja': [hoja], 'mazas': [], 'tirantes': [], 'flecha': []}
    for x in B['mazas']:
        G['mazas'].append(T.densa(cil_x('maza', MAZA['r'], x - MAZA['largo'] / 2, x + MAZA['largo'] / 2, yh, zh, E['acero'], lados=6), 0.6))
        G['tirantes'].append(T.densa(caja('tirante', (x - 0.018, yh - 0.007, zh + 0.010), (x + 0.018, yh + 0.007, zh + PU['e'] + 0.004), E['acero']), 0.6))
    G['flecha'].append(T.densa(cil_x('flecha', EJE_R, *B['flecha'], yh, zh, E['vastago']), 0.4))
    return G


def marco(G, E, B):
    """El ángulo del marco: patines al ras del piso (largos de punta a punta, los de las cabeceras entre
    ellos) y sus piernas que bajan por la orilla de la boca."""
    M = MARCO
    za, zb = Z_MARCO - M['grueso'], Z_MARCO
    for s in (-1, 1):
        y0, y1 = sorted((s * B['wy2'], s * (B['wy2'] + M['ancho'])))
        G['marco'].append(T.densa(caja('patin', (B['xa0'] - M['ancho'], y0, za), (B['xa1'] + M['ancho'], y1, zb), E['marco'], bisel=M['bisel']), 2.6))
        y0, y1 = sorted((s * B['wy2'], s * (B['wy2'] + M['pierna'])))
        G['marco'].append(T.densa(caja('pierna', (B['xa0'] - M['pierna'], y0, M['abajo']), (B['xa1'] + M['pierna'], y1, za), E['acero']), 0.5))
    for sx, xe in ((-1, B['xa0']), (1, B['xa1'])):
        x0, x1 = sorted((xe, xe + sx * M['ancho']))
        G['marco'].append(T.densa(caja('patin_cabecera', (x0, -B['wy2'], za), (x1, B['wy2'], zb), E['marco'], bisel=M['bisel']), 2.6))
        x0, x1 = sorted((xe, xe + sx * M['pierna']))
        G['marco'].append(T.densa(caja('pierna_cabecera', (x0, -B['wy2'], M['abajo']), (x1, B['wy2'], za), E['acero']), 0.5))


def foso(G, E, B):
    """La caja del foso (cerrada, las caras hacia adentro) y su coladera."""
    x0, x1, y, z0 = B['xp0'], B['xp1'], B['yp'], B['zf']
    bm = bmesh.new()
    v = {(i, j, k): bm.verts.new((x, yy, z)) for i, x in enumerate((x0, x1)) for j, yy in enumerate((-y, y)) for k, z in enumerate((z0, 0.0))}
    caras = [[v[0, 0, 0], v[1, 0, 0], v[1, 1, 0], v[0, 1, 0]],
             [v[0, 0, 0], v[0, 0, 1], v[1, 0, 1], v[1, 0, 0]], [v[0, 1, 0], v[1, 1, 0], v[1, 1, 1], v[0, 1, 1]],
             [v[0, 0, 0], v[0, 1, 0], v[0, 1, 1], v[0, 0, 1]], [v[1, 0, 0], v[1, 0, 1], v[1, 1, 1], v[1, 1, 0]]]
    centro = Vector(((x0 + x1) / 2, 0.0, z0 / 2))
    for c in caras:
        f = bm.faces.new(c)
        f.normal_update()
        if f.normal.dot(centro - f.calc_center_median()) < 0:
            f.normal_flip()
    o = P.objeto('foso', bm, E['foso'])
    G['foso'].append(T.densa(o, 0.16))
    xd, yd = (B['pistones'][1] + B['xa1']) / 2, -0.15
    G['rejilla'].append(T.densa(caja('coladera', (xd - 0.07, yd - 0.07, z0), (xd + 0.07, yd + 0.07, z0 + 0.012), E['rejilla'], bisel=0.003), 0.6))


def rieles(G, E, B):
    """Un riel T en la pared de cada cabecera (el alma hacia adentro), con su pie en el fondo y grapas
    a la pared."""
    R = RIEL
    for sx, xw in ((-1, B['xp0']), (1, B['xp1'])):
        xf = xw - sx * R['patin_g']
        xt = xf - sx * R['alma_largo']
        pts = [(xw, -R['patin']), (xw, R['patin']), (xf, R['patin']), (xf, R['alma']), (xt, R['alma']), (xt, -R['alma']), (xf, -R['alma']), (xf, -R['patin'])]
        o = T.perfil('riel', pts, (0, 0, B['zf'] + R['pie']), (0, 0, R['tope']), (1, 0, 0), E['acero'])
        G['rieles'].append(T.densa(o, 0.35))
        x0, x1 = sorted((xw, xw - sx * 0.07))
        G['rieles'].append(caja('pie_riel', (x0, -0.05, B['zf']), (x1, 0.05, B['zf'] + R['pie']), E['acero']))
        x0, x1 = sorted((xw, xw - sx * (R['patin_g'] + 0.006)))
        for z in np.linspace(B['zf'] + 0.35, -0.3, 3):
            for sy in (-1, 1):
                y0, y1 = sorted((sy * (R['patin'] - 0.005), sy * (R['patin'] + 0.017)))
                G['rieles'].append(caja('grapa_riel', (x0, y0, z - 0.02), (x1, y1, z + 0.02), E['acero']))


def chumaceras(G, E, B):
    """Las chumaceras de las flechas (entre maza y maza, con su placa a la pierna del marco), los
    collarines en las piernas de las cabeceras y la tapa de afuera en la cabecera -X."""
    C_ = CHUMACERA
    zh = B['zh']
    for s in (-1, 1):
        yh = s * B['yh']
        for x in B['chumaceras']:
            G['chumaceras'].append(caja('chumacera', (x - C_['largo'] / 2, yh - C_['medio'], zh - C_['medio']), (x + C_['largo'] / 2, yh + C_['medio'], zh + C_['medio']), E['acero']))
            y0, y1 = sorted((s * (B['yh'] + C_['medio']), s * B['wy2']))
            G['chumaceras'].append(caja('placa_chumacera', (x - 0.03, y0, zh - C_['placa_alto']), (x + 0.03, y1, zh + C_['placa_alto']), E['acero']))
        G['chumaceras'].append(cil_x('collarin', COLLARIN['r'], B['xa0'], B['xa0'] + COLLARIN['largo'], yh, zh, E['acero']))
        G['chumaceras'].append(cil_x('collarin', COLLARIN['r'], B['xa1'] - COLLARIN['largo'], B['xa1'], yh, zh, E['acero']))
        G['chumaceras'].append(cil_x('tapa_flecha', 0.018, B['xa0'] - 0.020, B['xa0'] - MARCO['pierna'], yh, zh, E['acero']))


def motores(G, E, B):
    """El motorreductor de cada flecha en la bolsa de la cabecera +X: caja de engranes, motor colgado,
    soporte a la pared y conduit a la pared."""
    zh = B['zh']
    gx0, gx1 = B['motor_x']
    for s in (-1, 1):
        yh = s * B['yh']
        G['motores'].append(T.densa(caja('reductor', (gx0, yh - 0.024, zh - 0.030), (gx1, yh + 0.024, zh + 0.030), E['motor'], bisel=0.004), 0.8))
        xm = (gx0 + gx1) / 2
        G['motores'].append(cil_z('motor', 0.022, zh - 0.030 - 0.11, zh - 0.030, xm, yh, E['motor'], lados=8))
        G['motores'].append(cil_z('tapa_motor', 0.024, zh - 0.030 - 0.12, zh - 0.030 - 0.10, xm, yh, E['esmalte'], lados=8))
        G['motores'].append(caja('soporte_reductor', (gx1, yh - 0.018, zh - 0.022), (B['xp1'], yh + 0.018, zh + 0.022), E['acero']))
        zc = zh - 0.10
        G['motores'].append(cil_x('conduit_motor', 0.007, xm + 0.018, B['xp1'] + 0.01, yh, zc, E['oxido'], lados=6))
        G['motores'].append(cil_x('conector_motor', 0.012, xm + 0.016, xm + 0.026, yh, zc, E['acero'], lados=6))
        G['motores'].append(cil_x('boquilla_pared', 0.014, B['xp1'] - 0.008, B['xp1'], yh, zc, E['acero'], lados=6))


def pistones(G, E, B):
    """Las cabezas de los pistones en el fondo (brida con tornillos y prensaestopas), su camisa abajo
    del fondo, el puerto y el tubo hidráulico de cada uno hasta la pared de la cabecera -X."""
    zf = B['zf']
    K = CABEZA
    for i, xr in enumerate(B['pistones']):
        G['pistones'].append(cil_z('brida', K['brida_r'], zf, zf + K['brida_h'], xr, 0.0, E['esmalte'], lados=10))
        G['pistones'].append(T.densa(cil_z('prensa', K['prensa_r'], zf + K['brida_h'], zf + K['alto'], xr, 0.0, E['esmalte'], lados=10), 0.6))
        for a in np.linspace(0, 2 * math.pi, 5)[:-1] + math.pi / 4:
            G['pistones'].append(tuerca('tornillo_brida', (xr + math.cos(a) * 0.07, math.sin(a) * 0.07, zf + K['brida_h']), E['acero']))
        G['pistones'].append(T.al_rincon(cil_z('camisa', K['camisa_r'], zf - BAJADA - 0.45, zf, xr, 0.0, E['esmalte'], lados=6), 3))
        zp = zf + K['puerto_z']
        G['pistones'].append(cil_y('puerto', 0.012, K['prensa_r'] - 0.004, K['prensa_r'] + 0.026, xr, zp, E['acero']))
        yl = (0.21, 0.25)[i]
        camino = C.redondear([(xr, K['prensa_r'] + 0.02, zp), (xr, yl, zp), (B['xp0'] + 0.03, yl, zp), (B['xp0'] + 0.03, yl, -0.75), (B['xp0'] - 0.012, yl, -0.75)], 0.04, pasos=2)
        G['tubos'].append(T.densa(C.tubo_rmf('tubo_hidraulico', camino, TUBO_R, E['oxido'], lados=5), 0.22))
        G['tubos'].append(cil_x('manga_pared', 0.02, B['xp0'], B['xp0'] + 0.012, yl, -0.75, E['acero'], lados=6))
        # soportes en el fondo y abrazaderas en la pared
        largo = xr - (B['xp0'] + 0.03)
        for x in np.linspace(B['xp0'] + 0.03 + 0.25, xr - 0.15, max(1, int(largo / 0.9))):
            G['tubos'].append(caja('soporte_tubo', (x - 0.012, yl - 0.012, zf), (x + 0.012, yl + 0.012, zp - TUBO_R * 0.8), E['acero']))
        for z in (zf + 0.6, -1.2):
            G['tubos'].append(caja('abrazadera_tubo', (B['xp0'], yl - 0.014, z - 0.012), (B['xp0'] + 0.03 + TUBO_R, yl + 0.014, z + 0.012), E['acero']))


def lamparas(G, E, B):
    """Una lámpara de aviso en cada esquina del marco: la carcasa (fija) y el lente (aparte)."""
    lentes = []
    zl = Z_MARCO + LAMPARA['alto']
    r, h = LAMPARA['lente_r'], LAMPARA['lente_alto']
    perfil = [(r, 0.0), (r * 0.9, h * 0.45), (r * 0.55, h * 0.85), (0.0, h)]
    for x in (B['xa0'] - MARCO['ancho'] / 2, B['xa1'] + MARCO['ancho'] / 2):
        for s in (-1, 1):
            y = s * (B['wy2'] + MARCO['ancho'] / 2)
            G['carcasas'].append(cil_z('carcasa', LAMPARA['r'], Z_MARCO, zl, x, y, E['esmalte'], lados=8))
            lentes.append(T.torno('lente', perfil, 6, [E['lente']], centro=(x, y, zl)))
    return lentes


def plataforma(E, B):
    """La plataforma en su pose de arriba: cubierta, canales, travesaños, horquillas y vástagos, postes
    guía con sus zapatas, y las grapas que amarran el dado del letrero."""
    G = {k: [] for k in ('cubierta', 'vigas', 'travesanos', 'horquillas', 'vastagos', 'postes', 'zapatas', 'forros', 'grapas')}
    c0, c1 = B['cub']
    z1 = CUBIERTA['z1']
    z0 = z1 - CUBIERTA['grueso']
    G['cubierta'].append(T.densa(caja('cubierta', (c0, -CUBIERTA['y'], z0), (c1, CUBIERTA['y'], z1), E['placa'], bisel=0.003), 1.2))
    # canales C a lo largo (el alma afuera, los patines hacia adentro), entre los travesaños de las cabeceras
    zc = z0 - VIGA['h'] / 2
    xv0, xv1 = c0 + POSTE_GUIA['grueso'], c1 - POSTE_GUIA['grueso']
    for s in (-1, 1):
        G['vigas'].append(T.densa(T.perfil('canal', T.perfil_C(VIGA['h'], VIGA['b'], VIGA['t']), (xv0, s * VIGA['y'], zc), (xv1, s * VIGA['y'], zc), (0, -s, 0), E['acero']), 0.35))
    yt = VIGA['y'] - VIGA['t']
    for xe, sx in ((c0, -1), (c1, 1)):
        x0, x1 = sorted((xe - sx * POSTE_GUIA['grueso'], xe - sx * (POSTE_GUIA['grueso'] + TRAVESANO)))
        G['travesanos'].append(T.densa(caja('travesano', (x0, -yt, Z_VIGAS), (x1, yt, z0), E['acero']), 0.4))
    for xr in B['pistones']:
        G['travesanos'].append(T.densa(caja('travesano', (xr - TRAVESANO / 2, -yt, Z_VIGAS), (xr + TRAVESANO / 2, yt, z0), E['acero']), 0.4))
        H = HORQUILLA['medio']
        G['horquillas'].append(caja('horquilla', (xr - H, -H, Z_HORQUILLA), (xr + H, H, Z_VIGAS), E['acero']))
        for dx in (-0.04, 0.04):
            for dy in (-0.04, 0.04):
                G['horquillas'].append(tuerca('tornillo_horquilla', (xr + dx, dy, Z_HORQUILLA - 0.007), E['acero'], r=0.009, alto=0.007))
        G['vastagos'].append(T.densa(cil_z('vastago', VASTAGO_R, Z_HORQUILLA - B['vastago'], Z_HORQUILLA, xr, 0.0, E['vastago'], lados=10), 0.45))
    # postes guía y zapatas en cada cabecera
    Z = ZAPATA
    for xe, sx in ((B['xa0'], -1), (B['xa1'], 1)):
        def X(d):
            return xe + sx * d
        x0, x1 = sorted((X(-POSTE_GUIA['grueso'] - CUBIERTA['cabecera']), X(-CUBIERTA['cabecera'])))
        G['postes'].append(caja('poste_guia', (x0, -POSTE_GUIA['y'], POSTE_GUIA['abajo']), (x1, POSTE_GUIA['y'], z0), E['acero']))
        tip = X(BOLSA - RIEL['patin_g'] - RIEL['alma_largo'])     # la punta del alma
        for zz in Z['z']:
            a, b = sorted((X(-CUBIERTA['cabecera']), tip - sx * 0.002))
            G['zapatas'].append(caja('zapata', (a, -Z['brazo'], zz - Z['medio_alto']), (b, Z['brazo'], zz + Z['medio_alto']), E['acero']))
            a, b = sorted((tip - sx * 0.002, X(BOLSA - RIEL['patin_g'] - 0.008)))
            for sy in (-1, 1):
                y0, y1 = sorted((sy * (RIEL['alma'] + Z['hueco']), sy * Z['brazo']))
                G['zapatas'].append(caja('mejilla', (a, y0, zz - Z['medio_alto']), (b, y1, zz + Z['medio_alto']), E['acero']))
                y0, y1 = sorted((sy * (RIEL['alma'] + Z['hueco'] - Z['forro']), sy * (RIEL['alma'] + Z['hueco'])))
                fa, fb = sorted((tip, X(BOLSA - RIEL['patin_g'] - 0.010)))
                G['forros'].append(caja('forro', (fa, y0, zz - Z['medio_alto'] + 0.005), (fb, y1, zz + Z['medio_alto'] - 0.005), E['goma']))
    # grapas de ángulo que amarran el dado del letrero a la cubierta
    # (a 0.5 mm del dado: un ancla entra al concreto por la pata parada y un tornillo a la cubierta por la acostada)
    Ld = B['dx1'] - B['dx0']
    h0 = B['hy'] + 0.0005
    for x in (B['dx0'] + 0.2 * Ld, B['dx1'] - 0.2 * Ld):
        for s in (-1, 1):
            y0, y1 = sorted((s * h0, s * (h0 + 0.006)))
            G['grapas'].append(caja('grapa_dado', (x - 0.03, y0, z1), (x + 0.03, y1, z1 + 0.055), E['acero']))
            y0, y1 = sorted((s * h0, s * (h0 + 0.018)))
            G['grapas'].append(caja('grapa_dado', (x - 0.03, y0, z1), (x + 0.03, y1, z1 + 0.006), E['acero']))
            G['grapas'].append(tuerca('tornillo_grapa', (x, s * (h0 + 0.012), z1 + 0.006), E['acero'], r=0.0065, alto=0.005))
            G['grapas'].append(T.cilindro('ancla_grapa', 0.0065, 0.005, E['acero'], lados=4, centro=(x, s * (h0 + 0.006), z1 + 0.032),
                                          rot=(-s * math.pi / 2, 0, 0)))
    return G


def registro_cable(E, cx, cy, pts, piezas):
    """El registro del cable de la Renderbox (props_claro.cable_renderbox, copiado con su centro como
    parámetro): brocal de concreto con la muesca por donde entra el cable desde -Y, contramarco de ángulo,
    tapa de lámina con jaladeras y el pasacables de hule en la muesca."""
    R = C.REGISTRO
    h, e = R['lado'] / 2, R['pared']
    za, zb = R['arriba'], R['abajo']
    brocal = T.caja_ab('registro_brocal', (cx - h, cy - h, zb), (cx + h, cy + h, za), E['concreto'])
    for nombre, a, b in (('hueco', (cx - h + e, cy - h + e, zb - 0.05), (cx + h - e, cy + h - e, za + 0.05)),
                         ('muesca', (cx - 0.0098, cy - h - 0.02, -0.03), (cx + 0.0098, cy - h + e + 0.02, za + 0.05))):
        cort = T.caja_ab('cortador_' + nombre, a, b, E['concreto'])
        mod = brocal.modifiers.new(nombre, 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = cort
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = brocal
        brocal.select_set(True)
        bpy.ops.object.modifier_apply(modifier=nombre)
        bpy.data.objects.remove(cort)
    me = brocal.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.5 and f.calc_center_median().z < zb + 1e-4], context='FACES_ONLY')
    bm.to_mesh(me)
    bm.free()
    P.poner_concreto(brocal)
    P.biselar(brocal, 0.007, 1)
    piezas.append(T.densa(brocal, 0.8))
    ce, cl = h - e, 0.012                       # cara de adentro del brocal; ala horizontal del ángulo
    for sx, sy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        if sy:
            a = (cx - ce, cy + sy * (ce - 0.0028), 0.006)
            b = (cx + ce, cy + sy * ce, za)
            a2 = (cx - ce, cy + sy * (ce - cl), 0.009)
            b2 = (cx + ce, cy + sy * ce, 0.012)
        else:
            a = (cx + sx * (ce - 0.0028), cy - ce + 0.0028, 0.006)
            b = (cx + sx * ce, cy + ce - 0.0028, za)
            a2 = (cx + sx * (ce - cl), cy - ce + 0.0028, 0.009)
            b2 = (cx + sx * ce, cy + ce - 0.0028, 0.012)
        piezas.append(T.caja_ab('registro_angulo', a, b, E['fierro']))
        piezas.append(T.caja_ab('registro_ala', a2, b2, E['fierro']))
    lt = ce - 0.0028 - 0.0012
    piezas.append(T.densa(T.caja_ab('registro_tapa', (cx - lt, cy - lt, 0.012), (cx + lt, cy + lt, za), E['tapa']), 1.0))
    for sy in (-1, 1):
        piezas.append(T.caja_ab('registro_jaladera', (cx - 0.016, cy + sy * 0.07 - 0.004, za), (cx + 0.016, cy + sy * 0.07 + 0.004, za + 0.0025), E['fierro']))
    yo, yi = cy - h, cy - h + e
    tramo = C.subcamino(pts, yo - 0.008, yi + 0.006, 0.012)
    piezas.append(C.tubo_rmf('registro_pasacables', tramo, 0.0088, E['goma_cable'], lados=6))
    return yo


def cable_corriente(G, E, B, k):
    """La caja de conexión en el marco +Y (cerca de la cabecera +X), su prensaestopas, el cable tendido
    hacia +Y con curvas flojas y el registro. Todo a G['cable']; regresa lo que se mide."""
    K, PC = CONEXION, PRENSA_CABLE
    xj = B['xa1'] + K['x']
    yb0 = B['wy2'] + MARCO['ancho'] + K['sep']           # la caja se para en el piso junto a la orilla del marco
    yb1 = yb0 + K['fondo']
    piezas = G['cable']
    piezas.append(T.densa(caja('caja_conexion', (xj - K['ancho'] / 2, yb0, 0.0), (xj + K['ancho'] / 2, yb1, K['alto']), E['acero'], bisel=0.005), 1.0))
    # la oreja: una solera soldada a la cara de la caja, que se apoya en el patín y se atornilla a él
    yo0 = B['wy2'] + MARCO['ancho'] - K['oreja']
    piezas.append(caja('oreja_conexion', (xj - 0.035, yo0, Z_MARCO), (xj + 0.035, yb0 + 0.004, Z_MARCO + 0.004), E['acero']))
    for dx in (-0.022, 0.022):
        piezas.append(tuerca('tornillo_conexion', (xj + dx, yo0 + 0.016, Z_MARCO + 0.004), E['acero'], r=0.006, alto=0.004))
    # el prensaestopas en la cara +Y: tuerca hexagonal y su cuerpo que se afila hacia el cable
    zg = PC['z']
    piezas.append(T.cilindro('prensa_cable_tuerca', PC['r'] + 0.002, PC['tuerca'], E['goma_cable'], lados=6, centro=(xj, yb1 - 0.001, zg), rot=(-math.pi / 2, 0, 0)))
    piezas.append(T.cilindro('prensa_cable', PC['r'], PC['largo'], E['goma_cable'], lados=8, radio2=0.0062,
                             centro=(xj, yb1 - 0.001 + PC['tuerca'], zg), rot=(-math.pi / 2, 0, 0)))
    y_punta = yb1 - 0.001 + PC['tuerca'] + PC['largo']
    # el camino: del prensaestopas baja al piso y se tiende hacia +Y con curvas flojas hasta la muesca del registro
    zc = CORDON_R + SOBRE_PISO
    cx, cy = xj + REGISTRO_DX, REGISTRO_Y
    h = C.REGISTRO['lado'] / 2
    ya = cy - h - 0.12
    p0 = Vector((xj, y_punta - 0.006, zg))
    y3 = y_punta + 0.17
    p3 = Vector((xj, y3, zc))
    caida = C.bezier(p0, p0 + Vector((0, 0.06, 0)), p3 - Vector((0, 0.09, 0)), p3, 10)
    rng = random.Random(911 + 37 * k)
    n = 4
    ctrl = [Vector((xj, y3))]
    for i in range(1, n + 1):
        t = i / (n + 1)
        y = y3 + (ya - 0.35 - y3) * t + rng.uniform(-0.12, 0.12)
        x = xj + (cx - xj) * t + (1 if i % 2 else -1) * rng.uniform(0.12, 0.26)
        ctrl.append(Vector((x, y)))
    ctrl += [Vector((cx, ya - 0.3)), Vector((cx, ya))]
    piso = [Vector((q.x, q.y, zc)) for q in C.catmull(ctrl, 0.05)]
    yo, yi = cy - h, cy - h + C.REGISTRO['pared']
    entra = C.redondear([(cx, ya, zc), (cx, yo, zc), (cx, yi, zc - 0.012), (cx, yi + 0.03, -0.04), (cx, yi + 0.04, -0.07)], 0.025, pasos=4)
    pts = T.simplificar(caida + piso[1:] + [Vector(q) for q in entra[1:]], 0.015)
    piezas.append(T.densa(C.tubo_rmf('cordon', pts, CORDON_R, E['cable'], lados=5), 0.3))
    yo = registro_cable(E, cx, cy, pts, piezas)
    return {'pts': pts, 'xj': xj, 'yb': (yb0, yb1), 'punta': (xj, yb1 - 0.001 + PC['tuerca'], zg), 'registro': (cx, cy), 'yo': yo, 'yi': yi}


def boca(E, B):
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0.001)) for x, y in ((B['xa0'], -B['wy2']), (B['xa1'], -B['wy2']), (B['xa1'], B['wy2']), (B['xa0'], B['wy2']))]
    bm.faces.new(vs)
    o = P.objeto('boca', bm, E['boca'])
    return T.al_rincon(o, 2)


# ---------------------------------------------------------------- medir

def malla(objs, local=False):
    V, F = [], []
    for o in objs:
        mw = Matrix.Identity(4) if local else o.matrix_world
        b = len(V)
        V += [tuple(mw @ v.co) for v in o.data.vertices]
        F += [[b + i for i in p.vertices] for p in o.data.polygons]
    return np.array(V, dtype=np.float64).reshape(-1, 3), F


def arbol(V, F):
    return BVHTree.FromPolygons([tuple(p) for p in V], F) if F else None


def girar(V, yh, zh, ang):
    c, s = math.cos(ang), math.sin(ang)
    out = V.copy()
    dy, dz = V[:, 1] - yh, V[:, 2] - zh
    out[:, 1] = yh + dy * c - dz * s
    out[:, 2] = zh + dy * s + dz * c
    return out


def bajar(V, d):
    out = V.copy()
    out[:, 2] -= d
    return out


def cerca(Va, ta, Vb, tb, lim=0.3, fa=None, fb=None):
    """Lo más cerca que llega un vértice de A a la superficie de B y al revés (hasta `lim`)."""
    best = lim
    for V, t, f in ((Va, tb, fa), (Vb, ta, fb)):
        if t is None or not len(V):
            continue
        pts = V if f is None else V[f]
        for p in pts:
            hit = t.find_nearest(Vector(p), best)
            if hit[0] is not None and hit[3] < best:
                best = hit[3]
    return best


def choques(ta, tb):
    return len(ta.overlap(tb)) if ta and tb else 0


def revisar(S, B, G, GP, GD, Vs, Fs, lentes):
    """Que las compuertas giren sin tocar nada, que el letrero y la plataforma pasen sin tocar las
    compuertas abiertas ni lo fijo, que el vástago no se salga de la camisa, que las zapatas abracen el
    riel en las dos poses y que todo esté apoyado en algo."""
    malos = []
    fijo_objs = [o for k in G for o in G[k]]
    Vf, Ff = malla(fijo_objs)
    tf = arbol(Vf, Ff)
    # lo fijo sin lo que la flecha atraviesa a propósito (chumaceras, collarines, tapas, piernas de las
    # cabeceras, reductores): contra eso se mide la hoja con sus mazas y tirantes
    Vp, Fp = malla([o for k in GP for o in GP[k]])
    Vs_ab = bajar(Vs, BAJADA)
    ts_ab = arbol(Vs_ab, Fs)
    Vp_ab = bajar(Vp, BAJADA)
    tp_ab = arbol(Vp_ab, Fp)
    hojas = {}
    flechas = {}
    for lado, s in (('A', -1), ('B', 1)):
        hojas[lado] = malla(GD[lado]['hoja'] + GD[lado]['mazas'] + GD[lado]['tirantes'])
        flechas[lado] = malla(GD[lado]['flecha'])
    yA, yB, zh = -B['yh'], B['yh'], B['zh']
    # ---- cerradas
    tA, tB = arbol(*hojas['A']), arbol(*hojas['B'])
    junta_c = cerca(hojas['A'][0], tA, hojas['B'][0], tB, 0.05)
    marco_objs = G['marco']
    Vm, Fm = malla(marco_objs)
    tm = arbol(Vm, Fm)
    a_marco = min(cerca(hojas[k][0], arbol(*hojas[k]), Vm, tm, 0.05) for k in 'AB')
    ztop = max(hojas[k][0][:, 2].max() for k in 'AB')
    under = min(malla(GD[k]['hoja'])[0][:, 2].min() for k in 'AB')
    lo_bajo = min(np.concatenate([hojas[k][0] for k in 'AB'] + [flechas[k][0] for k in 'AB'])[:, 2])
    anotar(f'  cerradas: entre las dos hojas {junta_c * 1000:.1f} mm (en la orilla de abajo; arriba la ranura en V mide '
           f'{2 * (B["yh"] - math.sqrt((B["yh"] - PU["cruce"]) ** 2 - (PU["e"] + PU["grueso"]) ** 2)) * 1000:.1f} mm), al marco {a_marco * 1000:.1f} mm, '
           f'arriba en z={ztop:.4f} (el marco en {Z_MARCO}), choques entre ellas {choques(tA, tB)}, contra el marco {choques(tA, tm) + choques(tB, tm)}')
    if choques(tA, tB) or choques(tA, tm) or choques(tB, tm) or ztop > Z_MARCO + 1e-4:
        malos.append('compuertas cerradas: chocan o sobresalen')
    tope_ab = B['tope'] - BAJADA
    anotar(f'  letrero abajo: lo más alto en z={tope_ab:.3f}; {under - tope_ab:.3f} m abajo de la cara de abajo de las hojas cerradas '
           f'(z={under:.3f}) y {lo_bajo - tope_ab:.3f} m abajo de lo más bajo de las compuertas (flechas y mazas, z={lo_bajo:.3f})')
    if under - tope_ab < 0.12:
        malos.append('el letrero abajo queda a menos de 0.12 m de las compuertas')
    # ---- el giro: las dos a la vez, de cerradas a abiertas, cada 3°
    peor = {'fijo': 0.3, 'entre': 0.3, 'letrero': 0.3, 'plataforma': 0.3}
    n_choques = {'fijo': 0, 'entre': 0, 'letrero': 0, 'plataforma': 0}
    zmax_giro = -9.0
    filtro_s = Vs_ab[:, 2] > -0.9
    filtro_f = (np.abs(Vf[:, 1]) > B['yh'] - 0.1) & (Vf[:, 2] > -0.5)
    for k in range(31):
        f = k / 30
        VA = girar(hojas['A'][0], yA, zh, GIRO_PUERTA['A'] * f)
        VB = girar(hojas['B'][0], yB, zh, GIRO_PUERTA['B'] * f)
        ta_, tb_ = arbol(VA, hojas['A'][1]), arbol(VB, hojas['B'][1])
        zmax_giro = max(zmax_giro, VA[:, 2].max(), VB[:, 2].max())
        for V_, t_ in ((VA, ta_), (VB, tb_)):
            n_choques['fijo'] += choques(t_, tf)
            peor['fijo'] = min(peor['fijo'], cerca(V_, t_, Vf, tf, peor['fijo'], fb=filtro_f))
            n_choques['letrero'] += choques(t_, ts_ab)
            peor['letrero'] = min(peor['letrero'], cerca(V_, t_, Vs_ab, ts_ab, peor['letrero'], fb=filtro_s))
            n_choques['plataforma'] += choques(t_, tp_ab)
            peor['plataforma'] = min(peor['plataforma'], cerca(V_, t_, Vp_ab, tp_ab, peor['plataforma']))
        n_choques['entre'] += choques(ta_, tb_)
        peor['entre'] = min(peor['entre'], cerca(VA, ta_, VB, tb_, peor['entre']))
    anotar('  giro de las compuertas (las dos a la vez, cada 3°, con la plataforma abajo): ' +
           ', '.join(f'contra {k} {n_choques[k]} choques y {peor[k] * 1000:.1f} mm' for k in peor) +
           f'; lo más alto que llegan {zmax_giro:.4f}')
    if any(n_choques.values()) or zmax_giro > Z_MARCO + 5e-4:
        malos.append('las compuertas tocan algo al girar o suben del marco')
    # la flecha: atraviesa sus chumaceras, collarines, la tapa, las piernas de las cabeceras y el reductor
    pasa = {}
    for lado in 'AB':
        tfl = arbol(*flechas[lado])
        n_pasa = sum(1 for o in G['chumaceras'] + G['marco'] + G['motores'] if choques(tfl, arbol(*malla([o]))) > 0)
        pasa[lado] = n_pasa
    anotar(f'  flechas: cada una pasa por {pasa["A"]} y {pasa["B"]} piezas fijas (chumaceras, collarines, tapa, pierna de cada '
           f'cabecera y su reductor: se esperan {len(B["chumaceras"]) + 3 + 2 + 1})')
    # ---- abiertas: el letrero y la plataforma suben y bajan junto a ellas
    VA90 = girar(hojas['A'][0], yA, zh, GIRO_PUERTA['A'])
    VB90 = girar(hojas['B'][0], yB, zh, GIRO_PUERTA['B'])
    abiertas = np.concatenate([VA90, VB90])
    Fab = hojas['A'][1] + [[i + len(VA90) for i in f] for f in hojas['B'][1]]
    tab = arbol(abiertas, Fab)
    ts = arbol(Vs, Fs)
    tp = arbol(Vp, Fp)
    fs_l = np.abs(Vs[:, 1]) > 0.08
    fp_l = np.abs(Vp[:, 1]) > 0.08
    peor_s = peor_p = peor_sf = peor_pf = 0.3
    ch_s = ch_p = ch_sf = ch_pf = ch_v = 0
    # la plataforma sin los vástagos contra todo lo fijo; los vástagos (que bajan por su eje, por la
    # prensaestopas, la brida, el fondo y la camisa) contra lo demás
    Vp2, Fp2 = malla([o for k in GP if k != 'vastagos' for o in GP[k]])
    tp2 = arbol(Vp2, Fp2)
    tv = arbol(*malla(GP['vastagos']))
    Vf3, Ff3 = malla([o for k in G if k not in ('foso', 'pistones') for o in G[k]] +
                     [o for o in G['pistones'] if o.name.startswith(('tornillo', 'puerto'))])
    for d in np.linspace(0.0, BAJADA, 38):
        Vd = bajar(abiertas, -d)            # en vez de bajar el letrero, se suben las compuertas (y lo fijo)
        td = arbol(Vd, Fab)
        ch_s += choques(td, ts)
        peor_s = min(peor_s, cerca(Vd, td, Vs, ts, peor_s, fb=fs_l))
        ch_p += choques(td, tp)
        peor_p = min(peor_p, cerca(Vd, td, Vp, tp, peor_p, fb=fp_l))
        Vfd = bajar(Vf, -d)
        tfd = arbol(Vfd, Ff)
        ch_sf += choques(tfd, ts)
        peor_sf = min(peor_sf, cerca(Vfd, tfd, Vs, ts, peor_sf))
        ch_pf += choques(tfd, tp2)
        peor_pf = min(peor_pf, cerca(Vfd, tfd, Vp2, tp2, peor_pf))
        ch_v += choques(arbol(bajar(Vf3, -d), Ff3), tv)
    anotar(f'  abiertas, con el letrero y la plataforma subiendo y bajando (cada {BAJADA / 37 * 100:.0f} cm): letrero {ch_s} choques y '
           f'{peor_s * 1000:.0f} mm, plataforma {ch_p} choques y {peor_p * 1000:.0f} mm; contra lo fijo: letrero {ch_sf} choques '
           f'({peor_sf * 1000:.0f} mm), plataforma {ch_pf} choques ({peor_pf * 1000:.1f} mm), vástagos contra lo que no es su pistón {ch_v}')
    if ch_s or ch_p or ch_sf or ch_pf or ch_v:
        malos.append('al subir o bajar algo toca')
    cab = [o for o in G['pistones'] if o.name.startswith('prensa')]
    anotar(f'  vástagos: atraviesan su prensaestopas {choques(tv, arbol(*malla(cab))) > 0} y bajan por el fondo dentro de su camisa '
           f'(mismo eje: x={", ".join(f"{x:+.3f}" for x in B["pistones"])}, y=0)')
    zv_ar = Z_HORQUILLA - B['vastago']
    z_prensa = B['zf'] + CABEZA['alto']
    z_camisa = B['zf'] - BAJADA - 0.45
    anotar(f'  vástago: punta de abajo con la plataforma arriba en z={zv_ar:.3f}, {z_prensa - zv_ar:.3f} m adentro de la camisa (prensaestopas '
           f'en z={z_prensa:.3f}); abajo en z={zv_ar - BAJADA:.3f}, {zv_ar - BAJADA - z_camisa:.3f} m antes del fondo de la camisa '
           f'(z={z_camisa:.3f}); la horquilla abajo queda {Z_HORQUILLA - BAJADA - z_prensa:.3f} m sobre la prensaestopas')
    if z_prensa - zv_ar < 0.2 or zv_ar - BAJADA - z_camisa < 0.05:
        malos.append('el vástago se sale de la camisa')
    # zapatas en los rieles
    zr0, zr1 = B['zf'] + RIEL['pie'], RIEL['tope']
    zs = [(zz - ZAPATA['medio_alto'], zz + ZAPATA['medio_alto']) for zz in ZAPATA['z']]
    arriba_ok = all(zr0 <= a and b <= zr1 for a, b in zs)
    abajo_ok = all(zr0 <= a - BAJADA and b - BAJADA <= zr1 for a, b in zs)
    t_r = arbol(*malla([o for o in G['rieles'] if o.name.startswith('riel')]))
    t_z = arbol(*malla(GP['zapatas']))
    t_fo = arbol(*malla(GP['forros']))
    d_z = cerca(malla(GP['zapatas'])[0], t_z, malla([o for o in G['rieles'] if o.name.startswith('riel')])[0], t_r, 0.05)
    d_f = cerca(malla(GP['forros'])[0], t_fo, malla([o for o in G['rieles'] if o.name.startswith('riel')])[0], t_r, 0.05)
    anotar(f'  zapatas: dentro del riel arriba {arriba_ok} y abajo {abajo_ok} (riel de z={zr0:.3f} a {zr1:.3f}; zapatas de '
           f'{zs[1][0]:.3f} a {zs[0][1]:.3f}, abajo de {zs[1][0] - BAJADA:.3f} a {zs[0][1] - BAJADA:.3f}); mejillas al alma {d_z * 1000:.1f} mm, '
           f'forros al alma {d_f * 1000:.1f} mm, choques {choques(t_z, t_r) + choques(t_fo, t_r)}')
    if not (arriba_ok and abajo_ok):
        malos.append('zapatas fuera del riel')
    # apoyos (cajas que se tocan: hueco en mm, negativo = se meten; área)
    nom = lambda grupo, pref: [o for o in grupo if o.name.startswith(pref)]
    j = []
    pierna = {round(np.sign(malla([o])[0][:, 1].mean())): o for o in nom(G['marco'], 'pierna.') + nom(G['marco'], 'pierna') if not o.name.startswith('pierna_cab')}
    for o in nom(G['chumaceras'], 'placa_chumacera'):
        s = round(np.sign(malla([o])[0][:, 1].mean()))
        j.append(('placas de chumacera en la pierna', C.junta(o, pierna[s])))
    for o in nom(G['chumaceras'], 'chumacera'):
        pl = min(nom(G['chumaceras'], 'placa_chumacera'), key=lambda p: abs(C.junta(o, p)[0]) + (0 if C.junta(o, p)[1] > 0 else 1))
        j.append(('chumaceras en su placa', C.junta(o, pl)))
    cabeceras = nom(G['marco'], 'pierna_cabecera')
    for o in nom(G['chumaceras'], 'collarin') + nom(G['chumaceras'], 'tapa_flecha'):
        pc = min(cabeceras, key=lambda p: abs(C.junta(o, p)[0]))
        j.append(('collarines y tapas en la pierna de la cabecera', C.junta(o, pc)))
    for o in nom(G['motores'], 'soporte_reductor'):
        rd = min(nom(G['motores'], 'reductor'), key=lambda p: abs(C.junta(o, p)[0]))
        j.append(('soporte en su reductor', C.junta(o, rd)))
        j.append(('soporte en la pared', (B['xp1'] - malla([o])[0][:, 0].max(), 0.0)))
    for o in nom(G['motores'], 'motor'):
        rd = min(nom(G['motores'], 'reductor'), key=lambda p: abs(C.junta(o, p)[0]))
        j.append(('motor colgado del reductor', C.junta(o, rd)))
    for o in nom(G['rieles'], 'riel'):
        V_ = malla([o])[0]
        xw = B['xp1'] if V_[:, 0].mean() > B['xc'] else B['xp0']
        j.append(('rieles en la pared', (min(abs(V_[:, 0] - xw)), 0.0)))
        pie = min(nom(G['rieles'], 'pie_riel'), key=lambda p: abs(C.junta(o, p)[0]))
        j.append(('riel en su pie', C.junta(o, pie)))
    for o in nom(G['rieles'], 'pie_riel') + nom(G['pistones'], 'brida'):
        j.append(('pies de riel y bridas en el fondo', (malla([o])[0][:, 2].min() - B['zf'], 0.0)))
    for o in nom(G['pistones'], 'prensa'):
        br = min(nom(G['pistones'], 'brida'), key=lambda p: abs(C.junta(o, p)[0]))
        j.append(('prensaestopas en su brida', C.junta(o, br)))
    for o in G['carcasas']:
        j.append(('carcasas sobre el marco', (malla([o])[0][:, 2].min() - Z_MARCO, 0.0)))
    cub = GP['cubierta'][0]
    for o in GP['vigas'] + nom(GP['travesanos'], 'travesano'):
        j.append(('canales y travesaños bajo la cubierta', C.junta(o, cub)))
    for o in GP['postes']:
        j.append(('postes guía bajo la cubierta', C.junta(o, cub)))
        tr = min(nom(GP['travesanos'], 'travesano'), key=lambda p: abs(C.junta(o, p)[0]))
        j.append(('postes guía contra su travesaño', C.junta(o, tr)))
    for o in nom(GP['zapatas'], 'zapata'):
        po = min(GP['postes'], key=lambda p: abs(C.junta(o, p)[0]))
        j.append(('zapatas en su poste', C.junta(o, po)))
    for o in nom(GP['horquillas'], 'horquilla'):
        tr = min(nom(GP['travesanos'], 'travesano'), key=lambda p: abs(C.junta(o, p)[0]))
        j.append(('horquillas bajo su travesaño', C.junta(o, tr)))
    for o in GP['vastagos']:
        ho = min(nom(GP['horquillas'], 'horquilla'), key=lambda p: abs(C.junta(o, p)[0]))
        j.append(('vástagos en su horquilla', C.junta(o, ho)))
    for o in nom(GP['grapas'], 'grapa_dado'):
        j.append(('grapas sobre la cubierta', (malla([o])[0][:, 2].min() - CUBIERTA['z1'], 0.0)))
    grupos = {}
    for n_, (g, a_) in j:
        grupos.setdefault(n_, []).append((g, a_))
    lineas_ = []
    for n_, vs in grupos.items():
        g = max(abs(v[0]) for v in vs)
        a_ = min(v[1] for v in vs)
        lineas_.append(f'{n_} {g * 1000:.2f} mm' + (f' / {a_ * 1e4:.1f} cm²' if a_ > 0 else ''))
        if g > 0.0006:
            malos.append(f'{n_}: hueco de {g * 1000:.1f} mm')
    anotar('  apoyos (peor hueco y menor contacto): ' + '; '.join(lineas_))
    d_gr = cerca(malla(GP['grapas'])[0], arbol(*malla(GP['grapas'])), Vs, ts, 0.05)
    anotar(f'  grapas del dado: lo más cerca del dado {d_gr * 1000:.1f} mm, choques con el letrero {choques(arbol(*malla(GP["grapas"])), ts)}')
    tubos = [o for o in G['tubos'] if o.name.startswith('tubo_hidraulico')]
    anotar(f'  tubos hidráulicos: salen de su puerto {choques(arbol(*malla(tubos)), arbol(*malla(nom(G["pistones"], "puerto")))) > 0}, '
           f'entran a la pared (punta en x={min(malla(tubos)[0][:, 0]):.3f}, pared en {B["xp0"]:.3f}), sobre sus soportes '
           f'{choques(arbol(*malla(tubos)), arbol(*malla(nom(G["tubos"], "soporte_tubo")))) > 0}')
    zmax_f = max(malla([o for k in G if k not in ('carcasas', 'cable') for o in G[k]])[0][:, 2])
    anotar(f'  lo más alto de lo fijo sin las lámparas: z={zmax_f:.4f}; carcasas hasta {max(malla(G["carcasas"])[0][:, 2]):.3f}, lentes hasta '
           f'{max(malla(lentes)[0][:, 2]):.3f}')
    if zmax_f > Z_MARCO + 1e-4:
        malos.append('algo del foso sube del marco')
    if malos:
        anotar('  REVISAR: ' + '; '.join(malos))
    else:
        anotar('  todo se sostiene, gira y pasa sin tocar')
    return not malos


def revisar_cable(B, G, GD, lentes, info):
    """La caja de conexión apoyada en el piso y atornillada al patín, el cable que empieza adentro del
    prensaestopas, tendido sin hundirse en el piso hasta el registro, y nada que choque con el marco,
    las lámparas ni las compuertas (cerradas, girando o abiertas)."""
    malos = []
    nom = lambda pref: [o for o in G['cable'] if o.name.startswith(pref)]
    pts = info['pts']
    yo = info['yo']
    afuera = [p for p in pts if p.y < yo - 0.002]
    z_afuera = min(p.z for p in afuera) - CORDON_R
    largo = sum((b - a).length for a, b in zip(pts, pts[1:]))
    en_piso = sum((b - a).length for a, b in zip(afuera, afuera[1:]) if a.z < 0.02)
    caja_ = nom('caja_conexion') + nom('oreja_conexion') + nom('tornillo_conexion') + nom('prensa_cable')
    z_caja = min(malla(caja_)[0][:, 2])
    punta = C.punta_en_cilindro(pts[0], CORDON_R, info['punta'], (0, 1, 0), PRENSA_CABLE['largo'], 0.0076)
    patin = max((o for o in G['marco'] if o.name.startswith('patin') and not o.name.startswith('patin_cab')),
                key=lambda o: malla([o])[0][:, 1].mean())
    j_oreja = C.junta(nom('oreja_conexion')[0], patin)
    Vc, Fc = malla(nom('caja_conexion') + nom('prensa_cable') + nom('cordon'))
    tc = arbol(Vc, Fc)
    Vm, Fm = malla(G['marco'])
    tm = arbol(Vm, Fm)
    Vl, Fl = malla(G['carcasas'] + lentes)
    tl = arbol(Vl, Fl)
    ch_marco = choques(tc, tm)
    d_marco = cerca(Vc, tc, Vm, tm, 0.05)
    ch_lamp = choques(tc, tl) + choques(arbol(*malla(caja_)), tl)
    Vq, Fq = malla(caja_ + nom('cordon'))
    d_lamp = cerca(Vq, arbol(Vq, Fq), Vl, tl, 0.5)
    # contra las compuertas: cerradas, girando y abiertas
    Vt, Ft = malla(G['cable'])
    tt = arbol(Vt, Ft)
    ch_p, d_p = 0, 0.5
    for lado, s in (('A', -1), ('B', 1)):
        Vd, Fd = malla([o for g in GD[lado].values() for o in g])
        for f in np.linspace(0.0, 1.0, 11):
            Vr = girar(Vd, s * B['yh'], B['zh'], GIRO_PUERTA[lado] * f)
            tr = arbol(Vr, Fd)
            ch_p += choques(tr, tt)
            d_p = min(d_p, cerca(Vr, tr, Vt, tt, d_p, fb=Vt[:, 1] < B['wy2'] + 0.5))
    reg = {o.name.split('.')[0]: o for o in G['cable'] if o.name.startswith('registro')}
    t_cord = arbol(*malla(nom('cordon')))
    ch_brocal = choques(t_cord, arbol(*malla([reg['registro_brocal']])))
    ch_pasa = choques(arbol(*malla([reg['registro_pasacables']])), arbol(*malla([reg['registro_brocal']])))
    ch_tapa = choques(arbol(*malla(nom('cordon') + [reg['registro_pasacables']])),
                      arbol(*malla([o for o in G['cable'] if o.name.startswith(('registro_tapa', 'registro_angulo', 'registro_ala'))])))
    cx, cy = info['registro']
    anotar(f'  cable: caja de conexión en x={info["xj"]:+.3f}, y de {info["yb"][0]:.3f} a {info["yb"][1]:.3f} (z de {z_caja:.3f} a {CONEXION["alto"]:.3f}), '
           f'oreja sobre el patín {C.fmt(j_oreja)}; empieza {punta} del prensaestopas; registro en x={cx:+.3f}, y={cy:+.3f}; '
           f'{largo:.2f} m de cable ({en_piso:.2f} m tendido en el piso), lo más bajo afuera del registro z={z_afuera:.4f}; '
           f'choques con el marco {ch_marco} ({d_marco * 1000:.1f} mm), con las lámparas {ch_lamp} ({d_lamp * 1000:.0f} mm), con las compuertas '
           f'(cerradas a abiertas) {ch_p} ({d_p * 1000:.0f} mm); en el registro: cable contra el brocal {ch_brocal}, pasacables contra el brocal {ch_pasa}, '
           f'contra tapa y ángulos {ch_tapa}; {P.triangulos(G["cable"])} triángulos')
    if z_afuera < -1e-4 or z_caja < -1e-4:
        malos.append('el cable o la caja se hunden en el piso')
    if not punta.startswith('adentro'):
        malos.append('el cable no sale del prensaestopas')
    if ch_marco or ch_lamp or ch_p or ch_brocal or ch_pasa or ch_tapa:
        malos.append('el cable o la caja chocan')
    if abs(j_oreja[0]) > 0.0006 or j_oreja[1] <= 0:
        malos.append('la oreja no se apoya en el patín')
    if malos:
        anotar('  REVISAR (cable): ' + '; '.join(malos))
    return not malos


# ---------------------------------------------------------------- los letreros (para medir y para las fotos)

def traer_letreros(material=None):
    """Los diez letreros de Estilo_letreros.blend (raíz e hijas), con su raíz en el origen."""
    with bpy.data.libraries.load(L.BLEND, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n.startswith(L.RAIZ)]
    out = {}
    for o in dst.objects:
        if o is None:
            continue
        bpy.context.scene.collection.objects.link(o)
        if material:
            o.data.materials.clear()
            o.data.materials.append(material)
    for o in dst.objects:
        if o is not None and o.parent is None:
            o.location = (0.0, 0.0, 0.0)
            S = o.name[len(L.RAIZ) + 1:]
            out[S] = [o] + list(o.children)
    bpy.context.view_layer.update()
    return out


def soltar(objs):
    for o in objs:
        me = o.data
        bpy.data.objects.remove(o)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    bpy.data.orphans_purge(do_recursive=True)


# ---------------------------------------------------------------- un foso

def un_foso(S, E, letrero, k):
    Vs, Fs = malla(letrero, local=True)
    B = medidas(Vs)
    G = {k_: [] for k_ in ('marco', 'foso', 'rejilla', 'rieles', 'chumaceras', 'motores', 'pistones', 'tubos', 'carcasas', 'cable')}
    marco(G, E, B)
    foso(G, E, B)
    rieles(G, E, B)
    chumaceras(G, E, B)
    motores(G, E, B)
    pistones(G, E, B)
    lentes = lamparas(G, E, B)
    cab = cable_corriente(G, E, B, k)
    GP = plataforma(E, B)
    GD = {'A': puerta(B, E, -1), 'B': puerta(B, E, 1)}
    nombre = f'{RAIZ}_{S}'
    anotar(f'{nombre}: boca x {B["xa0"]:+.3f} a {B["xa1"]:+.3f} ({B["xa1"] - B["xa0"]:.3f}) × y ±{B["wy2"]:.3f} ({2 * B["wy2"]:.3f}); foso '
           f'{B["xp1"] - B["xp0"]:.3f} × {2 * B["yp"]:.3f} × {-B["zf"]:.3f} de hondo; bajada {BAJADA}; ejes de las bisagras en y=±{B["yh"]:.3f}, '
           f'z={B["zh"]:.3f}; {len(B["mazas"])} mazas y {len(B["chumaceras"])} chumaceras por compuerta; pistones en x={B["pistones"][0]:+.3f} '
           f'y {B["pistones"][1]:+.3f}, vástago de {B["vastago"]:.3f}')
    ok = revisar(S, B, G, GP, GD, Vs, Fs, lentes)
    ok &= revisar_cable(B, G, GD, lentes, cab)
    tri = {'fijo': P.triangulos([o for k_, g in G.items() if k_ != 'cable' for o in g]), 'cable': P.triangulos(G['cable']),
           'plataforma': P.triangulos([o for g in GP.values() for o in g]),
           'puertas': P.triangulos([o for d in GD.values() for g in d.values() for o in g]), 'lentes': P.triangulos(lentes)}
    fijo = T.unir([o for g in G.values() for o in g], nombre)
    plat = T.unir([o for g in GP.values() for o in g], f'{nombre}_Plataforma')
    puertas = {}
    for lado, s in (('A', -1), ('B', 1)):
        o = T.unir([o for g in GD[lado].values() for o in g], f'{nombre}_Puerta{lado}')
        eje = Vector((B['xc'], s * B['yh'], B['zh']))
        o.data.transform(Matrix.Translation(-eje))
        o.location = eje
        puertas[lado] = o
    luz = T.al_rincon(T.unir(lentes, f'{nombre}_LuzAviso'), 1)
    bo = boca(E, B)
    bo.name = bo.data.name = f'{nombre}_Boca'
    objs = [fijo, plat, puertas['A'], puertas['B'], luz, bo]
    for o in objs:
        o['orden'] = k
        o['foso'] = S
        o['base'] = list(o.location)
    fijo['bajada'] = BAJADA
    fijo['boca'] = [B['xa0'], B['xa1'], -B['wy2'], B['wy2']]
    fijo['giro_puerta_a'] = GIRO_PUERTA['A']
    fijo['giro_puerta_b'] = GIRO_PUERTA['B']
    fijo['fondo'] = B['zf']
    tri_t = sum(tri.values()) + 2
    fijo['registro'] = list(cab['registro'])
    anotar(f'  triángulos: {tri_t} (fijo {tri["fijo"]} + cable con caja y registro {tri["cable"]}, plataforma {tri["plataforma"]}, '
           f'compuertas {tri["puertas"]}, lentes {tri["lentes"]}, boca 2)')
    return objs, B, ok


# ---------------------------------------------------------------- comandos

def fosos():
    """Los objetos de cada foso, por orden: {orden: [fijo, plataforma, puertaA, puertaB, luz, boca]}."""
    out = {}
    for o in bpy.data.objects:
        if o.get('orden') is not None and o.get('foso'):
            out.setdefault(o['orden'], []).append(o)
    suf = ['', '_Plataforma', '_PuertaA', '_PuertaB', '_LuzAviso', '_Boca']
    for k in out:
        S = out[k][0]['foso']
        nombres_ = {o.name: o for o in out[k]}
        out[k] = [nombres_[f'{RAIZ}_{S}{x}'] for x in suf]
    return dict(sorted(out.items()))


def todos(fs):
    return [o for k in fs for o in fs[k]]


def acomodar(fs):
    """Cada foso en su lugar de una cuadrícula para hornear (el AO de uno no le cae al otro). Las
    compuertas se hornean cerradas: los materiales buscan la cara de arriba con la normal del mundo."""
    for k, objs in fs.items():
        off = Vector(((k % 5) * 6.5, (k // 5) * 8.0, 0.0))     # el cable llega a ~6 m en +Y
        for o in objs:
            o.location = Vector(o['base']) + off
            o.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()


def a_base(fs):
    for objs in fs.values():
        for o in objs:
            o.location = Vector(o['base'])
            o.rotation_euler = (0.0, 0.0, 0.0)
            o.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()


def armar():
    P.limpiar()
    random.seed(SEMILLA)
    REVISION.clear()
    E = materiales()
    letreros = traer_letreros()
    todo_ok = True
    for k, S in enumerate(claves()):
        _, _, ok = un_foso(S, E, letreros[S], k)
        todo_ok &= ok
    soltar([o for objs in letreros.values() for o in objs])
    fs = fosos()
    objs = todos(fs)
    T.uv_atlas_ponderado(objs, {o.name: 1.0 for o in objs}, margen=0.0016)
    acomodar(fs)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    anotar(f'total: {P.triangulos(objs)} triángulos en {len(fs)} fosos; {"todo bien" if todo_ok else "HAY QUE REVISAR"}; guardado {BLEND}')
    for objs_ in fs.values():
        anotar(f'  {objs_[0].name}: ' + ', '.join(f'{o.name[len(objs_[0].name):] or "fijo"} {P.triangulos([o])}' for o in objs_) +
               f' = {P.triangulos(objs_)} tri; {T.densidad(objs_[2]):.0f} px/m en las compuertas, {T.densidad(objs_[0]):.0f} en lo fijo')
    with open(os.path.join(tempfile.gettempdir(), 'props_fosos_revision.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(REVISION))


def abrir():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.open_mainfile(filepath=BLEND)


def pintar(tam=TAM, muestras=64):
    abrir()
    fs = fosos()
    acomodar(fs)
    P.hornear_atlas(todos(fs), PNG, tam=tam, muestras=muestras)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', PNG)


def exportar(calidad=88):
    abrir()
    fs = fosos()
    a_base(fs)
    objs = todos(fs)
    m = P.material_final(PNG, os.path.splitext(os.path.basename(GLB))[0])
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(m)
        for k_ in list(o.keys()):
            if k_ in ('orden', 'base'):
                del o[k_]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB, export_format='GLB', use_selection=True, export_apply=True, export_extras=True,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_image_format='WEBP', export_image_quality=calidad, export_materials='EXPORT', export_yup=True,
        **P._sin_colores(),
    )
    print(f'exportado: {GLB} {os.path.getsize(GLB) / 1024:.0f} KB')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    lineas_ = [f'GLB {os.path.getsize(GLB)} bytes, materiales: {sorted(m.name for m in bpy.data.materials)}, '
               f'imágenes: {sorted((i.name, tuple(i.size)) for i in bpy.data.images)}']
    for o in sorted([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: o.name):
        co = np.array([o.matrix_world @ v.co for v in o.data.vertices])
        lineas_.append(f'  {o.name:44s} loc=({o.location.x:+.3f}, {o.location.y:+.3f}, {o.location.z:+.3f}) rot={tuple(round(a, 4) for a in o.rotation_euler)} '
                       f'x {co[:, 0].min():+.3f}..{co[:, 0].max():+.3f} y {co[:, 1].min():+.3f}..{co[:, 1].max():+.3f} '
                       f'z {co[:, 2].min():+.3f}..{co[:, 2].max():+.3f} {P.triangulos([o])} tri'
                       + (f' extras bajada={o.get("bajada")}' if o.get('bajada') is not None else ''))
    print('\n'.join(lineas_))
    with open(os.path.join(tempfile.gettempdir(), 'props_fosos_glb.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas_))


# ---------------------------------------------------------------- fotos

def _piso_con_boca(objs_foso, mp):
    """Un piso de 40 m con el hueco de la boca de este foso."""
    bo = objs_foso[5]
    co = [bo.matrix_world @ v.co for v in bo.data.vertices]
    x0, x1 = min(p.x for p in co), max(p.x for p in co)
    y0, y1 = min(p.y for p in co), max(p.y for p in co)
    bm = bmesh.new()
    a = [bm.verts.new(p) for p in ((-20, -20, 0), (20, -20, 0), (20, 20, 0), (-20, 20, 0))]
    b = [bm.verts.new(p) for p in ((x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0))]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    o = P.objeto('piso_revision', bm, mp)
    return o


def _escena():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'Standard'
    try:
        sc.eevee.taa_render_samples = 48
    except AttributeError:
        pass
    w = bpy.data.worlds.new('fondo')
    fondo = w.node_tree.nodes['Background']
    fondo.inputs['Color'].default_value = P.srgb('#3a3f52')
    fondo.inputs['Strength'].default_value = 0.9
    sc.world = w
    sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
    sol.data.energy = 2.4
    sol.data.use_shadow = False     # sin sombras: el foso es un hoyo hondo y saldría negro (en el sitio va con su toon)
    sol.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.collection.objects.link(sol)
    relleno = bpy.data.objects.new('relleno', bpy.data.lights.new('relleno', 'SUN'))
    relleno.data.energy = 1.3
    relleno.data.use_shadow = False
    relleno.rotation_euler = (math.radians(60), 0, math.radians(150))
    sc.collection.objects.link(relleno)
    frente = bpy.data.objects.new('frente', bpy.data.lights.new('frente', 'SUN'))   # para los cortes
    frente.data.energy = 0.0
    frente.data.use_shadow = False
    frente.rotation_euler = (math.radians(85), 0, math.radians(-10))
    sc.collection.objects.link(frente)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.clip_end = 200
    sc.collection.objects.link(cam)
    sc.camera = cam
    mp = bpy.data.materials.new('piso')
    mp.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = P.srgb('#27306a')
    mp.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    return sc, cam, fondo, sol, relleno, frente, mp


def _posar(objs, letrero, t_baja, t_abre):
    objs[1].location = Vector(objs[1]['base']) + Vector((0, 0, -BAJADA * t_baja))
    objs[2].rotation_euler.x = GIRO_PUERTA['A'] * t_abre
    objs[3].rotation_euler.x = GIRO_PUERTA['B'] * t_abre
    if letrero:
        letrero[0].location = (0.0, 0.0, -BAJADA * t_baja)
    bpy.context.view_layer.update()


def _cortar(o, cond):
    """Una copia de `o` sin las caras cuyo centro cumple `cond(centro)` (para los cortes)."""
    c = o.copy()
    c.data = o.data.copy()
    bpy.context.scene.collection.objects.link(c)
    bm = bmesh.new()
    bm.from_mesh(c.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if cond(o.matrix_world @ f.calc_center_median())], context='FACES')
    bm.to_mesh(c.data)
    bm.free()
    return c


def _ortho(sc, cam, ruta, centro, tam, az, el, res, clip=None, dist=12.0):
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = tam
    a, e = math.radians(az - 90), math.radians(el)
    d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    cam.location = Vector(centro) + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cam.data.clip_start = clip if clip is not None else 0.1
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    cam.data.clip_start = 0.1
    return ruta


def _juego(sc, cam, ruta, centro, az=-25, res=(1600, 1000), dist=11.4, fov=60):
    """La cámara del juego (perspectiva, CAMARA_CABECEO°, a 11.4 m: 25 del sitio entre 2.2)."""
    cam.data.type = 'PERSP'
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.angle_y = math.radians(fov)
    a, e = math.radians(az - 90), math.radians(CAMARA_CABECEO)
    d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    cam.location = Vector(centro) + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    return ruta


def _tomas(carpeta, fs, letreros, sc, cam, fondo, sol, relleno, frente, mp, ext='png', fotos=('section1_en', 'section5_es')):
    os.makedirs(carpeta, exist_ok=True)
    rutas = []
    todos_ = todos(fs) + [o for v in letreros.values() for o in v]

    def solo(objs, letrero):
        for o in todos_:
            o.hide_render = not (o in objs or o in letrero)
        objs[5].hide_render = True      # la boca es solo una forma para el sitio
    por_clave = {fs[k][0]['foso']: fs[k] for k in fs}
    for S in fotos:
        objs, letrero = por_clave[S], letreros[S]
        B = {'xc': (objs[5].bound_box[0][0] + objs[5].bound_box[6][0]) / 2, 'largo': objs[0].dimensions.x}
        solo(objs, letrero)
        piso = _piso_con_boca(objs, mp)
        n = S
        xc, largo = B['xc'], B['largo']
        for nombre_pose, tb, ta in (('arriba', 0.0, 1.0), ('medio', 0.5, 1.0), ('abajo', 1.0, 0.0), ('puertas45', 1.0, 0.5)):
            _posar(objs, letrero, tb, ta)
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_{nombre_pose}_34.{ext}'), (xc - 0.55 * largo - 1.2, -2.6 - 0.35 * largo, 2.4),
                                 (xc, 0.0, 0.0 if tb else 0.55), lente=32))
        for nombre_pose, tb, ta in (('arriba', 0.0, 1.0), ('abajo', 1.0, 0.0)):
            _posar(objs, letrero, tb, ta)
            rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_juego_{nombre_pose}.{ext}'), (xc, 0.0, 0.3), az=-25))
            rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_juego_{nombre_pose}_cerca.{ext}'), (xc, 0.0, 0.3), az=-25, fov=26))
        _posar(objs, letrero, 0.0, 1.0)
        rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_juego_arriba_atras.{ext}'), (xc, 0.0, 0.3), az=155, fov=26))
        # el cable: de la caja en el marco +Y, tendido hacia +Y (hacia los pinos) hasta su registro
        xe = objs[5].bound_box[6][0]
        ye = objs[5].bound_box[6][1]
        xj = xe + CONEXION['x']
        cx, cy = objs[0]['registro']
        rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_cable_34.{ext}'), (xe + 2.3, -0.9, 1.7), (xj, 1.9, 0.0), lente=26))
        rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_cable_caja.{ext}'), (xj + 0.55, ye + 0.95, 0.42), (xj, ye + 0.12, 0.02), lente=35))
        rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_cable_registro.{ext}'), (cx + 0.75, cy - 1.0, 0.65), (cx, cy - 0.12, 0.0), lente=35))
        rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_juego_cable.{ext}'), (xc, 2.2, 0.2), az=-25))
        rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_juego_cable_cerca.{ext}'), (xj, 1.6, 0.1), az=-25, fov=34))
        rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_juego_cable_atras.{ext}'), (xc, 2.2, 0.2), az=155, fov=40))
        # cortes: sin el piso, con luz de frente
        piso.hide_render = True
        frente.data.energy = 1.6
        for nombre_pose, tb, ta in (('arriba', 0.0, 1.0), ('medio', 0.5, 1.0), ('abajo', 1.0, 0.0)):
            _posar(objs, letrero, tb, ta)
            # a lo largo, desde -Y, cortado en y = -0.05 (se ve la compuerta B, la plataforma, los pistones y los rieles)
            rutas.append(_ortho(sc, cam, os.path.join(carpeta, f'{n}_corte_largo_{nombre_pose}.{ext}'), (xc, 0.0, -0.45), max(largo * 1.06, 4.4), 0, 0,
                                (1800, 1250), clip=12.0 - 0.05))
            # de través, desde +X, cortado a la mitad (la sección: compuertas, letrero, plataforma, chumaceras)
            rutas.append(_ortho(sc, cam, os.path.join(carpeta, f'{n}_corte_traves_{nombre_pose}.{ext}'), (xc, 0.0, -0.5), 3.1, 90, 0, (1000, 1250),
                                clip=12.0))
            if nombre_pose != 'medio':
                rutas.append(_ortho(sc, cam, os.path.join(carpeta, f'{n}_corte_traves_{nombre_pose}_cerca.{ext}'), (xc, 0.0, -0.2), 0.95, 90, 0,
                                    (1200, 1000), clip=12.0))
        _posar(objs, letrero, 1.0, 0.5)
        rutas.append(_ortho(sc, cam, os.path.join(carpeta, f'{n}_corte_traves_puertas45.{ext}'), (xc, 0.0, -0.15), 1.3, 90, 0, (1100, 1000), clip=12.0))
        # tres cuartos cortado: sin el lado -Y del foso y sin la compuerta A
        corte = _cortar(objs[0], lambda c: c.y < -0.1)
        objs[0].hide_render = True
        objs[2].hide_render = True
        corte.hide_render = False
        for nombre_pose, tb, ta in (('arriba', 0.0, 1.0), ('abajo', 1.0, 0.0)):
            _posar(objs, letrero, tb, ta)
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_corte_34_{nombre_pose}.{ext}'), (xc - 0.4 * largo - 1.0, -3.2 - 0.3 * largo, 0.9),
                                 (xc, 0.0, -0.9), lente=28, res=(1700, 1250)))
        _posar(objs, letrero, 0.0, 1.0)
        xe = objs[5].bound_box[6][0]
        # adentro del foso cortado: la cabecera +X (riel, zapatas, poste guía, motorreductor, collarín) con la
        # plataforma arriba, la bisagra (mazas, tirantes, flecha, chumaceras) con las puertas a 45° y el fondo
        objs[3].hide_render = True      # sin la compuerta B, que tapa su motorreductor
        rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_corte_cabecera.{ext}'), (xe - 0.8, -0.32, -0.62), (xe + 0.03, 0.12, -0.17), lente=20))
        objs[3].hide_render = False
        _posar(objs, letrero, 1.0, 0.5)
        for o in letrero:               # las puertas giran con el letrero abajo: se quita para ver la bisagra
            o.hide_render = True
        rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_corte_bisagra.{ext}'), (xc + 0.55, 0.02, -0.36), (xc - 0.3, 0.27, -0.07), lente=24))
        for o in letrero:
            o.hide_render = False
        _posar(objs, letrero, 0.0, 1.0)
        rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_corte_fondo.{ext}'), (xc - 0.6, -1.3, -1.0), (xc + 0.3, 0.05, -2.0), lente=26))
        bpy.data.objects.remove(corte)
        objs[0].hide_render = False
        objs[2].hide_render = False
        frente.data.energy = 0.0
        bpy.data.objects.remove(piso)
        _posar(objs, letrero, 0.0, 0.0)
    # la hoja: los diez con la cámara del juego, arriba (abiertas) y abajo (cerradas)
    for nombre_pose, tb, ta in (('arriba', 0.0, 1.0), ('abajo', 1.0, 0.0)):
        cuadros = []
        for k, objs in fs.items():
            S = objs[0]['foso']
            solo(objs, letreros[S])
            piso = _piso_con_boca(objs, mp)
            _posar(objs, letreros[S], tb, ta)
            xc = (objs[5].bound_box[0][0] + objs[5].bound_box[6][0]) / 2
            cuadros.append(_juego(sc, cam, os.path.join(carpeta, f'hoja_{nombre_pose}_{S}.{ext}'), (xc, 0.0, 0.3), az=-25, res=(900, 560), fov=30))
            bpy.data.objects.remove(piso)
            _posar(objs, letreros[S], 0.0, 0.0)
        rutas.append(L._hoja(carpeta, cuadros, f'fosos_hoja_{nombre_pose}.{ext}'))
    for o in todos_:
        o.hide_render = False
    return rutas


def render(carpeta):
    abrir()
    fs = fosos()
    a_base(fs)
    m = P.material_final(PNG, 'revision_fosos')
    for o in todos(fs):
        o.data.materials.clear()
        o.data.materials.append(m)
    letreros = traer_letreros(P.material_final(L.PNG, 'revision_letreros'))
    sc, cam, fondo, sol, relleno, frente, mp = _escena()
    rutas = _tomas(carpeta, fs, letreros, sc, cam, fondo, sol, relleno, frente, mp)
    print('render:', *rutas, sep='\n  ')


def vista(carpeta):
    """Fotos rápidas de la geometría con Workbench (sin hornear)."""
    abrir()
    fs = fosos()
    a_base(fs)
    letreros = traer_letreros()
    sc, cam, fondo, sol, relleno, frente, mp = _escena()
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_cavity = True
    colores = {'Fosos_Marco': (0.85, 0.9, 0.05, 1), 'Fosos_Acero': (0.25, 0.3, 0.38, 1), 'Fosos_Placa': (0.32, 0.37, 0.45, 1),
               'Fosos_Foso': (0.1, 0.11, 0.13, 1), 'Fosos_Esmalte': (0.08, 0.08, 0.1, 1), 'Fosos_Vastago': (0.6, 0.63, 0.67, 1),
               'Fosos_Motor': (0.15, 0.35, 0.36, 1), 'Fosos_Oxido': (0.45, 0.22, 0.12, 1), 'Fosos_Goma': (0.05, 0.05, 0.06, 1),
               'Fosos_Rejilla': (0.3, 0.32, 0.35, 1), 'Fosos_Lente': (1.0, 0.55, 0.05, 1), 'Fosos_Boca': (0.02, 0.02, 0.02, 1)}
    for mat in bpy.data.materials:
        mat.diffuse_color = colores.get(mat.name, (0.55, 0.5, 0.6, 1))
    rutas = _tomas(carpeta, fs, letreros, sc, cam, fondo, sol, relleno, frente, mp)
    print('vista:', *rutas, sep='\n  ')


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    rapido = 'rapido' in args[1:]
    resto = [a for a in args[1:] if a != 'rapido']
    carpeta = resto[0] if resto else os.path.join(tempfile.gettempdir(), 'props_fosos')
    if cmd in ('armar', 'todo', 'vista'):
        armar()
    if cmd == 'vista':
        vista(carpeta)
    if cmd in ('pintar', 'todo'):
        pintar(1024, 16) if rapido else pintar()
    if cmd in ('exportar', 'todo'):
        exportar()
    if cmd in ('render', 'todo'):
        render(carpeta)
