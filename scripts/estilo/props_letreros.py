"""Letreros de neón de doble cara detrás de los portales (Oscar, 2026-11-25: "se va a ver más
cyberpunk"; reemplazan a los hitos labrados). El nombre de cada sección en runas de SKULLEYGLYPH, con
la receta del letrero OPEN (scripts/estilo/props_claro.py): letras de bloque de lámina honda pintada,
filas de neón, el tubo oxidado del contorno con grapitas, fierro de PTR, concreto, el transformador
con su conduit. Aquí de DOS caras, como un letrero de calle: la cámara del juego ve algunos por
detrás y ninguno tiene espalda sin terminar.

Las letras miden 80 cm (Oscar, 2026-11-25, al verlas en el juego: "las puras letras, no la base";
la cámara las ve desde arriba, a ~40° y 20 a 30 m del sitio). Cada letra es una caja con los costados
de lado a lado y dos fondos espalda con espalda (uno por cara, a ±FONDO del centro); en el hueco de
6.4 cm entre ellos entra el fierro. El neón es grueso (radio de 1.5 cm) y asoma ~9 mm de la cara,
para que se lea desde arriba y no lo tape la orilla de la lámina: un tubo a lo largo de cada trazo, en
las dos caras (con ese grueso, las filas horizontales del OPEN solo cabían como píldoras; con
NEON_EN_FILAS = True vuelven, con su paso escalado). Sobre el filo de cada cara va el tubo oxidado con
grapas. Como monumento bajo: un
dado corrido de concreto, encima un gabinete de lámina de 53 cm con su zoclo, cejas y anclas, puertas
de registro en las dos caras y una tapa; el gabinete solo es tan largo como pide el fierro (las letras
de las orillas vuelan sobre él, cargadas por su poste). De la tapa suben postes de PTR (con su placa y
dos tornillos) que entran por abajo a cada cuerpo de letra, y las piezas sueltas (las gotas de arriba
y de abajo) van con una pata de PTR a la pieza que tienen abajo o al gabinete. Todo el fierro va en el
plano de en medio, así las dos caras se ven iguales. El transformador va atornillado en la cabecera derecha del
gabinete (+X), con su conduit bajando al dado; su cable de alta tensión entra al gabinete por un
pasacables y de ahí sube por los postes huecos a las letras (los puentes de letra a letra van por
adentro del gabinete y de los postes: escondidos en medio). Se mide (`revisar`), no a ojo.

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_letreros.py -- todo [carpeta_fotos] [rapido]

  armar     arma los diez, los mide, les da su atlas y guarda Character/Estilo_letreros.blend
  pintar    hornea el atlas (Cycles): Character/assets/props_letreros.png (el maestro)
  exportar  public/3dmodels/estilo/props_letreros.glb (Draco, WebP, un material) y lo vuelve a leer
  render    fotos de revisión (Eevee) en la carpeta que se le dé
  vista     armar y fotos de la geometría con Workbench (sin hornear, para iterar)
  todo      armar, pintar, exportar y render
  `rapido`  hornea a 1024 con pocas muestras

Las palabras salen de scripts/estilo/neon_<palabra>.json (node scripts/estilo/runas_neon.mjs PALABRA).

props_letreros.glb (metros; cada letrero en su propio marco: el origen en el piso al centro, debajo
del letrero; el plano de las letras en y = 0 con sus caras hacia -Y y +Y de Blender; el piso en z = 0,
el dado de concreto se entierra 10 cm; todos los nodos con la transformación identidad, encimados):
  Prop_LetreroPortal_<sección>_<idioma>          lo fijo: cajas de las letras, tubos oxidados y grapas
                                                 de las dos caras, soportes de las filas, postes, patas,
                                                 placas, gabinete, dado, transformador, conduit, cables
    Prop_LetreroPortal_<sección>_<idioma>_Neon_<n>   (hijas) las filas de neón de la letra n (en orden
                                                 de lectura desde 0), de las dos caras; vidrio apagado
    en: section1 WORK, section2 ABOUT, section3 STORE, section4 CONTACT, section5 MEMORIES
    es: section1 TRABAJO, section2 SOBREMI, section3 TIENDITA, section4 CONTACTO, section5 MEMORIAS
Todas las runas a la misma escala, con el mismo espacio entre una y otra y sobre la misma línea.
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
from mathutils.bvhtree import BVHTree

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.dont_write_bytecode = True
import pintura as P  # noqa: E402
import props_taller as T  # noqa: E402
import props_claro as C  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_letreros.blend')
PNG = os.path.join(REPO, 'Character', 'assets', 'props_letreros.png')
GLB = os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_letreros.glb')
TAM = 2048
SEMILLA = 41
RAIZ = 'Prop_LetreroPortal'
NOMBRES = {
    'en': {'section1': 'WORK', 'section2': 'ABOUT', 'section3': 'STORE', 'section4': 'CONTACT', 'section5': 'MEMORIES'},
    'es': {'section1': 'TRABAJO', 'section2': 'SOBREMI', 'section3': 'TIENDITA', 'section4': 'CONTACTO', 'section5': 'MEMORIAS'},
}
# el color de cada portal (src/lib/appHelpers.js), solo para las fotos de noche
COLOR_PORTAL = {'section1': '#00bfff', 'section2': '#39ff14', 'section3': '#e600ff', 'section4': '#f5ff00', 'section5': '#ff6b00'}

LAMINA_AZUL = {'oscura': '#11141f', 'base': '#1b2033', 'clara': '#2a3149', 'orilla': '#6b7491'}   # la del OPEN
GABINETE_GRAFITO = {'oscura': '#15171b', 'base': '#23262c', 'clara': '#363a42', 'orilla': '#7a8089'}
TRANSFORMADOR_GRIS = {'oscuro': '#2b2f33', 'base': '#4a5056', 'claro': '#6c737b', 'orilla': '#aab2ba', 'oxido': '#5e3420'}

# ---------------------------------------------------------------- las letras (metros)
ESCALA = 0.80 / 6.9666      # metros por unidad de runa: 6.9666 = de y0 a y1 de casi todas las palabras (80 cm)
Y_BASE = 6.4589             # la y de runa que cae en Z_LETRAS (lo de abajo de la mayoría de las runas)
PASO_FILA = 0.6 * ESCALA    # el paso entre filas (una de cada dos de runas_neon.mjs: 6.9 cm)
TOL = 0.010                 # simplificación del contorno de la lámina
TOL_CHICO = 0.011           # la de los lazos chicos (gotas, huecos): ahí casi no se nota y son la mayoría
AREA_CHICA = 0.024          # m²: lo que cuenta como lazo chico (una gota mide ~0.016)
CARA = 0.132                # las caras en y = ±CARA (26.4 cm de hondo)
FONDO = 0.032               # los dos fondos en y = ±FONDO: entre ellos, el hueco del fierro
PARED = 0.008               # el grueso de la lámina
R_NEON = 0.015              # el neón, grueso para que se lea desde la cámara del juego
NEON_Y = CARA - 0.006       # su eje: asoma R_NEON - 6 mm de la cara (no lo tapa la orilla de la lámina)
LADOS_NEON = 4
MARCO_LADOS = 3
R_MARCO = 0.008             # el tubo oxidado sobre el filo de cada cara (0.07 de runa, como el OPEN)
HOLGURA_NEON = 0.002
# lo más cerca que llega el eje del neón a la orilla de la letra: libra el tubo oxidado (y la pared)
D_NEON = PARED / 2 + math.sqrt((R_NEON + R_MARCO + HOLGURA_NEON) ** 2 - (CARA - NEON_Y) ** 2)
FILA_MIN = 0.04             # una fila o un tubo más corto no va
# Con tubos de 3 cm al ras de la cara, en un trazo de 9 cm las filas horizontales solo caben como
# píldoras de ~4 cm (y en los trazos acostados ni eso): el neón va a lo largo de cada trazo, como en las
# letras de neón de verdad (en un trazo acostado es justo la fila del centro). True vuelve a las filas
# con el paso de las del OPEN y deja el tubo a lo largo para lo que no alcanzan.
NEON_EN_FILAS = False
SOPORTE_CADA = 0.25         # un soporte cada tanto a lo largo de un tubo (al menos uno)
CUBIERTO = 0.3              # un trazo con menos de esto de su largo junto a filas lleva un tubo a lo largo
GRAPA_CADA = 1.40           # una grapa cada tanto (una sola en las gotas y en las piezas chicas)
SOPORTE = 0.005             # lado de los soportes del neón

# ---------------------------------------------------------------- la base
DADO = {'z0': -0.10, 'z1': 0.05, 'y': 0.17, 'sale': 0.16}   # sale = cuánto pasa de cada cabecera del gabinete
ZOCLO = {'z0': 0.05, 'z1': 0.10, 'y': 0.107, 'sale': 0.012}
CEJA = {'y': 0.137, 'grueso': 0.006}                       # la ceja del zoclo con las anclas, en las dos caras
GABINETE = {'z0': 0.10, 'z1': 0.52, 'y': 0.095}
TAPA = {'z0': 0.52, 'z1': 0.532, 'y': 0.112, 'vuelo': 0.016}
Z_TAPA = TAPA['z1']
PLACA_POSTE = 0.010
PLACA = {'y': 0.05, 'sale': 0.035, 'tornillo': 0.010}   # la placa de cada poste: medio fondo, lo que sale del poste
Z_LETRAS = Z_TAPA + 0.10
MARGEN_X = 0.10             # de la placa de poste más afuera a la cabecera del gabinete
PUERTA = {'z0': 0.16, 'z1': 0.46, 'sale': 0.0035, 'orilla': 0.11}
DENSIDAD_BASE = 0.45        # pixeles por metro del gabinete y el dado contra los de las letras (1.8): lo liso cede atlas
# postes (los cuerpos) y patas (lo suelto): ancho en x, fondo en y (cabe en el hueco de 3.2 cm), lo
# que se meten en la pieza, y el margen a la pared de la lámina
POSTE = {'w': 0.060, 'd': 0.048, 'mete': 0.060, 'm': PARED + 0.004}
PATA = {'w': 0.024, 'd': 0.040, 'mete': 0.024, 'm': PARED + 0.002}
PATA_FINA = {'w': 0.020, 'd': 0.036, 'mete': 0.018, 'm': PARED + 0.0016}
CUERPO = 0.35               # una pieza con este tanto del área de la más grande de su letra es cuerpo (lleva poste)
DOS_POSTES = 0.30           # un cuerpo más ancho que esto lleva dos
CAMARA_CABECEO = 40         # la cámara del juego ve los letreros desde arriba, a ~40°

# ---------------------------------------------------------------- el transformador (en la cabecera +X)
TRAFO = {'placa': (0.16, 0.46, 0.075, 0.005), 'caja': (0.18, 0.44, 0.065, 0.09)}   # z0, z1, medio ancho, hondo
TRAFO_X = 0.05              # el eje del conduit, desde la cabecera
CABLE_R = 0.005
GLAND = {'r': 0.009, 'z': 0.488}

REVISION = []


def anotar(texto):
    print('  ' + texto)
    REVISION.append(texto)


def nombres():
    for lang in ('en', 'es'):
        for sec, palabra in NOMBRES[lang].items():
            yield sec, lang, palabra, f'{RAIZ}_{sec}_{lang}'


def materiales():
    return {
        'lamina': P.material_madera('Letreros_Lamina', paleta=T.OXIDO, pintura=LAMINA_AZUL, desgaste=0.6, fino=0.6),
        'gabinete': P.material_madera('Letreros_Gabinete', paleta=T.OXIDO, pintura=GABINETE_GRAFITO, desgaste=0.45, fino=0.7),
        'oxido': P.material_metal('Letreros_Oxido', paleta=T.METAL_OXIDO, oxido=0.85),
        'fierro': P.material_metal('Letreros_Fierro', paleta=T.ACERO, oxido=0.6),
        'acero': P.material_metal('Letreros_Acero', paleta=T.ACERO, oxido=0.35),
        'transformador': P.material_metal('Letreros_Transformador', paleta=TRANSFORMADOR_GRIS, oxido=0.35),
        'concreto': P.material_concreto('Letreros_Concreto', musgo=0.15),
        'neon': P.material_brillo('Letreros_NeonVidrio', '#d9d2dc'),
        'cable': P.material_liso('Letreros_Cable', '#141417', claro='#2a2b31', oscuro='#08080a', orilla='#4c4e55'),
        'plastico': P.material_liso('Letreros_Plastico', '#1c1d21', claro='#33353b', oscuro='#0e0f11', orilla='#666a72'),
    }


# ---------------------------------------------------------------- geometría 2D (x, z)

def dentro(p, lazo):
    return T.dentro_de(p, lazo)


def material(p, pieza, margen=0.0):
    """Si el punto (x, z) cae en la lámina de la pieza (adentro de su contorno y fuera de sus huecos),
    a `margen` o más de cualquier orilla."""
    if not dentro(p, pieza['ext']) or any(dentro(p, h) for h in pieza['huecos']):
        return False
    return margen <= 0 or min(C.dist_lazo(p, l) for l in [pieza['ext']] + pieza['huecos']) >= margen


def holgura(p, pieza):
    return min(C.dist_lazo(p, l) for l in [pieza['ext']] + pieza['huecos'])


def area(lazo):
    return abs(sum(p.x * q.y - q.x * p.y for p, q in zip(lazo, lazo[1:] + lazo[:1]))) / 2


def agrupar(lazos):
    """Los lazos de una letra en piezas: cada lazo de profundidad par es un contorno de afuera y se
    queda con los de profundidad impar que tiene adentro (la gota adentro del hueco de la C es otra
    pieza: profundidad 2)."""
    prof = [sum(1 for j, o in enumerate(lazos) if j != i and dentro(l[0], o)) for i, l in enumerate(lazos)]
    piezas = []
    for i, l in enumerate(lazos):
        if prof[i] % 2 == 0:
            huecos = [o for j, o in enumerate(lazos) if prof[j] == prof[i] + 1 and dentro(o[0], l)]
            piezas.append({'ext': T.orientar(l, True), 'huecos': [T.orientar(h, False) for h in huecos]})
    for pz in piezas:
        pz['area'] = area(pz['ext']) - sum(area(h) for h in pz['huecos'])
        xs = [p.x for p in pz['ext']]
        zs = [p.y for p in pz['ext']]
        pz['x0'], pz['x1'], pz['z0'], pz['z1'] = min(xs), max(xs), min(zs), max(zs)
        pz['cx'] = sum(xs) / len(xs)
    return piezas


def intervalos(pieza, x):
    """Los tramos de z en que la línea vertical x pasa por la lámina de la pieza."""
    zs = []
    for lazo in [pieza['ext']] + pieza['huecos']:
        for a, b in zip(lazo, lazo[1:] + lazo[:1]):
            if (a.x > x) != (b.x > x):
                zs.append(a.y + (x - a.x) * (b.y - a.y) / (b.x - a.x))
    zs.sort()
    return list(zip(zs[0::2], zs[1::2]))


def densificar(pts, paso):
    """La polilínea con un punto cada `paso` (más o menos), con sus puntas."""
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int((b - a).length / paso))
        out += [a.lerp(b, k / n) for k in range(1, n + 1)]
    return out


def cruzar(A, B):
    out = []
    for a0, a1 in A:
        for b0, b1 in B:
            lo, hi = max(a0, b0), min(a1, b1)
            if hi > lo:
                out.append((lo, hi))
    return sorted(out)


def lineas(x, w, m):
    return [x - w / 2 - m, x - w / 4, x, x + w / 4, x + w / 2 + m]


def embebido(pieza, x, w, m):
    """Dónde cabe una barra de ancho w (en x) con margen m adentro de la lámina de la pieza."""
    E = None
    for xx in lineas(x, w, m):
        I = [(a + m, b - m) for a, b in intervalos(pieza, xx) if b - a > 2 * m]
        E = I if E is None else cruzar(E, I)
        if not E:
            return []
    return E


# ---------------------------------------------------------------- piezas 3D

def letra_doble(nombre, piezas, material_):
    """Una letra de lámina de dos caras: costados de -CARA a +CARA, la pared por dentro hasta su fondo
    y los dos fondos (en ±FONDO). El filo de cada cara (el grueso de la lámina) no va: lo tapa el tubo
    oxidado. Entre los fondos es hueca por dentro, pero eso no se ve (ahí entra el fierro)."""
    bm = bmesh.new()
    filos = []
    for pz in piezas:
        bordes = {-1: [], 1: []}
        for lazo, hueco in [(pz['ext'], False)] + [(h, True) for h in pz['huecos']]:
            L = T.orientar(lazo, not hueco)
            Li = T.correr_lazo(L, PARED)
            n = len(L)
            v = {s: [bm.verts.new((p.x, s * CARA, p.y)) for p in L] for s in (-1, 1)}
            w = {s: [bm.verts.new((p.x, s * CARA, p.y)) for p in Li] for s in (-1, 1)}
            f = {s: [bm.verts.new((p.x, s * FONDO, p.y)) for p in Li] for s in (-1, 1)}
            for k in range(n):
                m = (k + 1) % n
                bm.faces.new((v[-1][k], v[-1][m], v[1][m], v[1][k]))
                for s in (-1, 1):
                    filos.append(bm.faces.new((v[s][k], w[s][k], w[s][m], v[s][m])))
                    bm.faces.new((w[s][k], f[s][k], f[s][m], w[s][m]))
            for s in (-1, 1):
                bordes[s] += [bm.edges.get((f[s][k], f[s][(k + 1) % n])) for k in range(n)]
        for s in (-1, 1):
            bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=bordes[s])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.delete(bm, geom=filos, context='FACES_ONLY')
    return P.objeto(nombre, bm, material_)


def tubos_neon(nombre, filas, material_):
    """Las filas de neón de una letra en las dos caras: tubos rectos de punta plana (prendidos, la
    punta no se distingue)."""
    bm = bmesh.new()
    for x0, x1, z in filas:
        for s in (-1, 1):
            y = s * NEON_Y
            p0, p1 = Vector((x0, y, z)), Vector((x1, y, z))
            ang = [2 * math.pi * j / LADOS_NEON + math.pi / LADOS_NEON for j in range(LADOS_NEON)]
            anillos = [[bm.verts.new(p + Vector((0.0, math.cos(a), math.sin(a))) * R_NEON) for a in ang] for p in (p0, p1)]
            for j in range(LADOS_NEON):
                k = (j + 1) % LADOS_NEON
                bm.faces.new((anillos[0][j], anillos[0][k], anillos[1][k], anillos[1][j]))
            bm.faces.new(list(reversed(anillos[0])))
            bm.faces.new(anillos[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material_)
    o.data.polygons.foreach_set('use_smooth', np.ones(len(o.data.polygons), bool))
    return o


def soportes_filas(nombre, puntos, material_):
    """De cada tubo a su fondo, un soporte en (x, z) en las dos caras: un ángulo (dos caras, abierto
    hacia abajo) cuyas puntas quedan dentro del tubo y del fondo."""
    bm = bmesh.new()
    n = 0
    for x, z in puntos:
        if True:
            for s in (-1, 1):
                ya, yb = s * NEON_Y, s * (FONDO - 0.001)
                tri = [Vector((x + math.cos(a) * SOPORTE * 0.6, 0.0, z + math.sin(a) * SOPORTE * 0.6)) for a in (math.pi * 7 / 6, math.pi / 2, math.pi * 11 / 6)]
                A = [bm.verts.new((p.x, ya, p.z)) for p in tri]
                B = [bm.verts.new((p.x, yb, p.z)) for p in tri]
                for k in range(2):
                    m = k + 1
                    f = bm.faces.new((A[k], A[m], B[m], B[k]))
                    f.normal_update()
                    c = f.calc_center_median()
                    if f.normal.dot(Vector((c.x - x, 0.0, c.z - z))) < 0:   # hacia afuera del prisma
                        f.normal_flip()
                n += 1
    o = P.objeto(nombre, bm, material_)
    return o, n


def caja(nombre, a, b, material_, bisel=0.0, veta=None, segmentos=1):
    return T.caja_ab(nombre, a, b, material_, bisel=bisel, segmentos=segmentos, veta=veta)


def tuerca(nombre, centro, material_, r=0.0085, alto=0.008, eje='z'):
    """Una tuerca (o cabeza de tornillo) cuadrada."""
    rot = {'z': (0, 0, math.pi / 4), 'x': (0, math.pi / 2, 0), '-y': (math.pi / 2, 0, 0), 'y': (-math.pi / 2, 0, 0)}[eje]
    return T.cilindro(nombre, r, alto, material_, lados=4, centro=centro, rot=rot)


# ---------------------------------------------------------------- un letrero

def letrero(sec, lang, palabra, nombre, E):
    d = json.load(open(os.path.join(AQUI, f'neon_{palabra.lower()}.json'), encoding='utf-8'))
    if d['palabra'] != palabra:
        raise RuntimeError(f'neon_{palabra.lower()}.json es de {d["palabra"]}')
    s = ESCALA

    def a_m(x, y):
        return Vector((x * s, Z_LETRAS + (Y_BASE - y) * s))

    G = {k: [] for k in ('letras', 'marcos', 'grapas', 'soportes', 'postes', 'patas', 'placas', 'base', 'trafo', 'conduit', 'cables')}
    neones, letras = [], []
    n_filas, n_sop, recortadas, quitadas, sin_fila = 0, 0, 0, 0, 0
    for i, letra in enumerate(d['letras']):
        lazos = []
        for c in letra['contornos']:
            crudo = [a_m(x, y) for x, y in c['pts']]
            lazos.append(T.simplificar_lazo(crudo, TOL_CHICO if area(crudo) < AREA_CHICA else TOL))
        piezas = agrupar(lazos)
        caja_l = letra_doble(f'letra_{i}', piezas, E['lamina'])
        P.poner_veta(caja_l, 'Z')
        G['letras'].append(T.densa(caja_l, 1.8))
        for j, (lazo, hueco) in enumerate((l, h) for pz in piezas for l, h in [(pz['ext'], False)] + [(q, True) for q in pz['huecos']]):
            lz = T.correr_lazo(T.orientar(lazo, not hueco), PARED / 2)   # al centro del grueso de la lámina
            perim = sum((b - a).length for a, b in zip(lz, lz[1:] + lz[:1]))
            cada = perim / max(1, round(perim / GRAPA_CADA))
            for sg in (-1, 1):
                # sus caras miden menos de un pixel del atlas: van a un rincón de color (como las grapas)
                G['marcos'].append(T.al_rincon(T.tubo_cerrado(f'marco_{i}_{j}', [Vector((p.x, sg * CARA, p.y)) for p in lz], R_MARCO, E['oxido'], lados=MARCO_LADOS), 4))
                G['grapas'].append(T.al_rincon(T.grapas(f'grapas_{i}_{j}', lz, sg * CARA, R_MARCO, cada, E['fierro']), 2))
        # las filas: las candidatas son todas las de runas_neon.mjs (cada 3.4 cm); cada una se recorta
        # para librar el tubo oxidado y la pared, y de cada pieza se quedan las más metidas en su trazo
        # que no queden a menos de PASO_FILA de otra (en un trazo parado, una de cada dos; en uno
        # acostado, la del centro). Las gotas no llevan filas: a lo largo, abajo.
        filas = []
        for k, pz in enumerate(piezas):
            if pz['area'] < AREA_CHICA or not NEON_EN_FILAS:
                continue
            validas = []
            for x0, x1, yy in letra['filas']:
                (ax, az), (bx, _) = a_m(x0, yy), a_m(x1, yy)
                if not material(Vector(((ax + bx) / 2, az)), pz):
                    continue
                ok = lambda x: material(Vector((x, az)), pz, D_NEON)
                a0, b0 = ax, bx
                while ax < bx and not ok(ax):
                    ax += 0.002
                while bx > ax and not ok(bx):
                    bx -= 0.002
                if bx - ax < FILA_MIN or not all(ok(x) for x in np.linspace(ax, bx, max(2, int((bx - ax) / 0.01) + 1))):
                    quitadas += 1
                    continue
                if (ax, bx) != (a0, b0):
                    recortadas += 1
                validas.append((ax, bx, az, holgura(Vector(((ax + bx) / 2, az)), pz)))
            validas.sort(key=lambda f: -f[3])
            mias = []
            for f in validas:
                if all(abs(f[2] - g[2]) >= PASO_FILA * 0.95 or f[1] < g[0] - 0.02 or f[0] > g[1] + 0.02 for g in mias):
                    mias.append(f)
            filas += [(a, b, z) for a, b, z, _ in mias]
        # los trazos a los que no les tocaron filas llevan un tubo a lo largo, recortado para librar
        # las filas, los otros tubos, el tubo oxidado y la pared
        espinas = []
        trazos = [[a_m(x, y) for x, y in t['pts']] for t in letra['trazos']]
        libre_tubo = 2 * R_NEON + 0.004

        def a_filas(q):
            return min((math.hypot(max(f[0] - q.x, 0.0, q.x - f[1]), q.y - f[2]) for f in filas), default=9.0)

        def a_espinas(q):
            return min(((q - r).length for e in espinas for r in densificar(e, 0.01)), default=9.0)
        for k, pz in enumerate(piezas):
            for t in trazos:
                if sum(material(q, pz) for q in t) < 0.6 * len(t):
                    continue
                pts = densificar(t, 0.01)
                cerca = sum(1 for q in pts if a_filas(q) <= PASO_FILA / 2 + R_NEON)
                if cerca >= CUBIERTO * len(pts):
                    continue
                tramo = []
                for q in pts + [None]:
                    if q is not None and material(q, pz, D_NEON) and a_filas(q) >= libre_tubo and a_espinas(q) >= libre_tubo:
                        tramo.append(q)
                        continue
                    if len(tramo) >= 2 and sum((b - a).length for a, b in zip(tramo, tramo[1:])) >= FILA_MIN:
                        espinas.append(T.simplificar(tramo, 0.004))
                    tramo = []
        n_filas += len(filas)
        partes = [tubos_neon(f'{nombre}_Neon_{i}', filas, E['neon'])]
        for e in espinas:
            for sg in (-1, 1):
                partes.append(C.tubo_rmf('espina', [Vector((p.x, sg * NEON_Y, p.y)) for p in e], R_NEON, E['neon'], lados=LADOS_NEON))
        neon = T.al_rincon(T.unir(partes, f'{nombre}_Neon_{i}'), 1)
        neones.append(neon)
        puntos = [((x0 + x1) / 2, z) for x0, x1, z in filas]
        for e in espinas:
            largo = [0.0]
            for a, b in zip(e, e[1:]):
                largo.append(largo[-1] + (b - a).length)
            n_s = max(1, round(largo[-1] / SOPORTE_CADA))
            for t in ((j + 0.5) / n_s for j in range(n_s)):
                meta = largo[-1] * t
                k = next(j for j in range(len(e) - 1) if largo[j + 1] >= meta)
                q = e[k].lerp(e[k + 1], (meta - largo[k]) / max(largo[k + 1] - largo[k], 1e-9))
                puntos.append((q.x, q.y))
        sop, ns = soportes_filas(f'soportes_{i}', puntos, E['fierro'])
        n_sop += ns
        G['soportes'].append(T.al_rincon(sop, 2))
        sin_fila += sum(1 for pz in piezas if not any(material(Vector(((f[0] + f[1]) / 2, f[2])), pz) for f in filas)
                        and not any(material(q, pz) for e in espinas for q in e))
        letras.append({'letra': letra['letra'], 'piezas': piezas, 'filas': filas, 'espinas': espinas})
    # ---- el fierro: postes y patas; el gabinete mide lo que piden sus placas
    soporte = fierro(G, E, letras)
    xg0, xg1 = min(a for a, b in soporte['placas']) - MARGEN_X, max(b for a, b in soporte['placas']) + MARGEN_X
    base(G, E, xg0, xg1)
    # ---- el transformador
    trafo(G, E, xg1)
    revisar(nombre, palabra, G, neones, letras, soporte, xg0, xg1)
    anotar('  triángulos: ' + ', '.join(f'{k} {P.triangulos(G[k])}' for k in G) + f', neón {P.triangulos(neones)}')
    fijos = [o for k in G for o in G[k]]
    raiz = T.unir(fijos, nombre)
    for n_ in neones:
        n_.parent = raiz
    zs_l = [p.y for l in letras for pz in l['piezas'] for p in pz['ext']]
    xs_l = [p.x for l in letras for pz in l['piezas'] for p in pz['ext']]
    co = np.array([v.co[:] for v in raiz.data.vertices])
    raiz['palabra'] = palabra
    raiz['seccion'] = sec
    raiz['idioma'] = lang
    info = {'ancho': co[:, 0].max() - co[:, 0].min(), 'x': (co[:, 0].min(), co[:, 0].max()), 'y': (co[:, 1].min(), co[:, 1].max()),
            'alto': co[:, 2].max(), 'letras_ancho': max(xs_l) - min(xs_l), 'letras_z': (min(zs_l), max(zs_l)),
            'gabinete': (xg0, xg1), 'filas': n_filas, 'soportes': n_sop}
    anotar(f'{nombre} ({palabra}): {len(letras)} letras, {sum(len(l["piezas"]) for l in letras)} piezas, {n_filas} filas por cara '
           f'+ {sum(len(l["espinas"]) for l in letras)} tubos a lo largo de un trazo ({n_sop} soportes), filas recortadas en la punta {recortadas}, '
           f'quitadas {quitadas}, piezas sin neón {sin_fila}')
    return raiz, neones, info


def base(G, E, xg0, xg1):
    """El dado corrido, el zoclo con sus cejas y anclas, el gabinete con sus puertas y la tapa."""
    D, Z, K, B, TP = DADO, ZOCLO, CEJA, GABINETE, TAPA
    G['base'].append(T.densa(T.concreto('dado', (xg0 - D['sale'], -D['y'], D['z0']), (xg1 + D['sale'], D['y'], D['z1']), E['concreto'], chaflan=0.022), DENSIDAD_BASE))
    G['base'].append(T.densa(caja('zoclo', (xg0 - Z['sale'], -Z['y'], Z['z0']), (xg1 + Z['sale'], Z['y'], Z['z1']), E['fierro'], bisel=0.003), DENSIDAD_BASE))
    for sg in (-1, 1):
        y0, y1 = sorted((sg * Z['y'], sg * K['y']))
        G['base'].append(caja('ceja', (xg0 - Z['sale'], y0, Z['z0']), (xg1 + Z['sale'], y1, Z['z0'] + K['grueso']), E['fierro'], bisel=0.0015))
        n = max(2, int(round((xg1 - xg0) / 0.55)) + 1)
        for x in np.linspace(xg0 + 0.07, xg1 - 0.07, n):
            G['base'].append(tuerca('ancla', (x, sg * (Z['y'] + K['y']) / 2, Z['z0'] + K['grueso']), E['fierro'], r=0.0085, alto=0.011))
    gab = caja('gabinete', (xg0, -B['y'], B['z0']), (xg1, B['y'], B['z1']), E['gabinete'], bisel=0.006, veta='X')
    G['base'].append(T.densa(gab, DENSIDAD_BASE))
    G['base'].append(T.densa(caja('tapa', (xg0 - TP['vuelo'], -TP['y'], TP['z0']), (xg1 + TP['vuelo'], TP['y'], TP['z1']), E['gabinete'], bisel=0.003, veta='X'), DENSIDAD_BASE))
    # puertas de registro en las dos caras, con su chapa (dos si el gabinete es largo)
    ancho = xg1 - xg0
    n_p = max(1, round((ancho - 2 * PUERTA['orilla']) / 1.3))
    paso = (ancho - 2 * PUERTA['orilla'] + 0.05) / n_p
    tramos = [(xg0 + PUERTA['orilla'] + k * paso, xg0 + PUERTA['orilla'] + (k + 1) * paso - 0.05) for k in range(n_p)]
    for sg in (-1, 1):
        for k, (u0, u1) in enumerate(tramos):
            y0, y1 = sorted((sg * B['y'], sg * (B['y'] + PUERTA['sale'])))
            G['base'].append(T.densa(caja('puerta', (u0, y0, PUERTA['z0']), (u1, y1, PUERTA['z1']), E['gabinete'], bisel=0.0015, veta='X'), DENSIDAD_BASE))
            xc = u1 - 0.035 if k == len(tramos) - 1 or len(tramos) == 1 else u0 + 0.035
            G['base'].append(T.cilindro('chapa', 0.0075, 0.005, E['acero'], lados=8, centro=(xc, sg * (B['y'] + PUERTA['sale']), (PUERTA['z0'] + PUERTA['z1']) / 2),
                                        rot=(-sg * math.pi / 2, 0, 0)))


def candidatos(pz, piezas, w, mete, m, cuerpo):
    """Dónde puede ir la barra de una pieza: (costo, x, z_abajo, z_arriba, destino) con destino None
    (poste desde la tapa) o el índice de la pieza de abajo (pata)."""
    out = []
    xs = np.arange(pz['x0'] + w / 2 + m, pz['x1'] - w / 2 - m, 0.003)
    cerca = [(k, q) for k, q in enumerate(piezas) if q['x1'] >= pz['x0'] - 0.02 and q['x0'] <= pz['x1'] + 0.02]
    for x in xs:
        E_ = [(a, b) for a, b in embebido(pz, x, w, m) if b - a >= mete]
        if not E_:
            continue
        a = E_[0][0]
        # lo que hay abajo, en todas las líneas
        tope, quien = None, set()
        for xx in lineas(x, w, m):
            mejor = None
            for k, q in cerca:
                for z0, z1 in intervalos(q, xx):
                    if z1 <= a - 1e-6 and (mejor is None or z1 > mejor[0]):
                        mejor = (z1, k)
            if mejor:
                quien.add(mejor[1])
                tope = mejor[0] if tope is None else max(tope, mejor[0])
        if tope is None:
            out.append(((a - Z_TAPA) + 0.4 * abs(x - pz['cx']), x, Z_TAPA + PLACA_POSTE, a + mete, None))
            continue
        if cuerpo or len(quien) != 1:
            continue
        k = quien.pop()
        q = piezas[k]
        Eq = [(c, e) for c, e in embebido(q, x, w, m) if e - c >= mete and e <= tope + 1e-6]
        if not Eq:
            continue
        dq = Eq[-1][1]
        z_bajo = dq - mete
        # nada más en el camino
        limpio = True
        for xx in lineas(x, w, m):
            for j, r in cerca:
                for z0, z1 in intervalos(r, xx):
                    if z1 <= z_bajo or z0 >= a + mete:
                        continue
                    if r is pz and z0 <= a <= z1:
                        continue
                    if j == k and z0 <= dq <= z1:
                        continue
                    limpio = False
        if limpio:
            out.append(((a - dq) + 0.2 * abs(x - pz['cx']), x, z_bajo, a + mete, k))
    return out


def fierro(G, E, letras):
    """Un poste de PTR desde la tapa a cada cuerpo (dos si es ancho) y una pata a lo suelto: a la pieza
    de abajo o a la tapa. Todo en el plano de en medio (y = 0), entre los dos fondos."""
    piezas = [pz for l in letras for pz in l['piezas']]
    for li, l in enumerate(letras):
        for pz in l['piezas']:
            pz['letra'] = li
    maximo = {li: max(pz['area'] for pz in l['piezas']) for li, l in enumerate(letras)}
    barras, ocupado = [], []

    def libres(cand, w):
        """Las que no se enciman con una barra ya puesta (3 mm de aire)."""
        return [c for c in cand if not any(c[1] - w / 2 - 0.003 < x1 and c[1] + w / 2 + 0.003 > x0 and c[2] < z1 and c[3] > z0
                                           for x0, x1, z0, z1 in ocupado)]
    cuerpos = [pz['area'] >= CUERPO * maximo[pz['letra']] for pz in piezas]
    for pi in sorted(range(len(piezas)), key=lambda k: cuerpos[k]):   # lo suelto primero: los postes se hacen a un lado
        pz = piezas[pi]
        cuerpo = cuerpos[pi]
        elegidas = []
        if cuerpo:
            for tipo in (POSTE, PATA):
                cand = libres(sorted(candidatos(pz, piezas, tipo['w'], tipo['mete'], tipo['m'], True)), tipo['w'])
                if cand:
                    elegidas = [(cand[0], tipo)]
                    ancho = pz['x1'] - pz['x0']
                    if ancho > DOS_POSTES:
                        lejos = [c for c in cand if abs(c[1] - cand[0][1]) >= max(0.45 * ancho, tipo['w'] + 0.05)]
                        if lejos:
                            elegidas.append((lejos[0], tipo))
                    break
        if not elegidas:
            for tipo in (PATA, PATA_FINA):
                cand = libres(sorted(candidatos(pz, piezas, tipo['w'], tipo['mete'], tipo['m'], False)), tipo['w'])
                if cand:
                    elegidas = [(cand[0], tipo)]
                    break
        if not elegidas:
            raise RuntimeError(f'la pieza {pi} de la letra {letras[pz["letra"]]["letra"]} no tiene cómo sostenerse')
        for (costo, x, z0, z1, destino), tipo in elegidas:
            ocupado.append((x - tipo['w'] / 2, x + tipo['w'] / 2, z0, z1))
            barras.append({'pieza': pi, 'x': x, 'z0': z0, 'z1': z1, 'destino': destino, 'tipo': tipo,
                           'w': tipo['w'], 'd': tipo['d'], 'mete': tipo['mete']})
    for b in barras:
        o = caja('poste' if b['destino'] is None else 'pata', (b['x'] - b['w'] / 2, -b['d'] / 2, b['z0']), (b['x'] + b['w'] / 2, b['d'] / 2, b['z1']), E['fierro'])
        b['obj'] = o
        G['postes' if b['destino'] is None else 'patas'].append(o)
    # las placas de los postes en la tapa (las que se encimen, una sola), con dos tornillos
    tramos = sorted((b['x'] - b['w'] / 2 - PLACA['sale'], b['x'] + b['w'] / 2 + PLACA['sale']) for b in barras if b['destino'] is None)
    juntas = []
    for a, b_ in tramos:
        if juntas and a <= juntas[-1][1] + 0.01:
            juntas[-1][1] = max(juntas[-1][1], b_)
        else:
            juntas.append([a, b_])
    for a, b_ in juntas:
        G['placas'].append(caja('placa_poste', (a, -PLACA['y'], Z_TAPA), (b_, PLACA['y'], Z_TAPA + PLACA_POSTE), E['fierro']))
        for x in (a + PLACA['sale'] / 2, b_ - PLACA['sale'] / 2):
            G['placas'].append(tuerca('tornillo_poste', (x, 0.0, Z_TAPA + PLACA_POSTE), E['fierro'], r=PLACA['tornillo'], alto=0.008))
    return {'piezas': piezas, 'barras': barras, 'placas': juntas}


def trafo(G, E, xg1):
    """El transformador atornillado en la cabecera +X del gabinete, su conduit al dado y el cable de
    alta tensión que entra al gabinete por un pasacables."""
    pz0, pz1, py, ph = TRAFO['placa']
    cz0, cz1, cy, ch = TRAFO['caja']
    fie, ace = E['fierro'], E['acero']
    G['trafo'].append(caja('trafo_placa', (xg1, -py, pz0), (xg1 + ph, py, pz1), fie, bisel=0.0015))
    G['trafo'].append(caja('transformador', (xg1 + ph, -cy, cz0), (xg1 + ph + ch, cy, cz1), E['transformador'], bisel=0.008))
    for z in (pz0 + 0.01, pz1 - 0.01):
        for sy in (-1, 1):
            G['trafo'].append(tuerca('trafo_tornillo', (xg1 + ph, sy * (py - 0.005), z), fie, r=0.006, alto=0.004, eje='x'))
    xc, rc = xg1 + TRAFO_X, 0.011
    G['conduit'].append(T.cilindro('conduit_conector', 0.016, 0.02, ace, lados=10, centro=(xc, 0.0, cz0 - 0.02)))
    G['conduit'].append(T.cilindro('conduit', rc, cz0 - 0.02 - 0.02, E['oxido'], lados=8, centro=(xc, 0.0, 0.02)))
    G['conduit'].append(T.cilindro('conduit_boquilla', 0.017, 0.012, ace, lados=10, centro=(xc, 0.0, DADO['z1'])))
    za = 0.13
    G['conduit'].append(caja('conduit_abrazadera', (xg1, -0.01, za - 0.012), (xc - rc, 0.01, za + 0.012), fie))
    G['conduit'].append(T.tubo_cerrado('conduit_aro', [Vector((xc + math.cos(a) * (rc + 0.0016), math.sin(a) * (rc + 0.0016), za)) for a in np.linspace(0, 2 * math.pi, 11)[:-1]],
                                       0.0016, fie, lados=4, normal=Vector((0, 0, 1))))
    # la salida de alta tensión arriba del transformador y el cable al pasacables de la cabecera
    xb = xg1 + 0.062
    G['cables'].append(T.cilindro('trafo_salida', 0.009, 0.016, ace, lados=8, centro=(xb, 0.0, cz1)))
    G['cables'].append(T.al_rincon(T.cilindro('pasacables', GLAND['r'], 0.014, E['plastico'], lados=8, centro=(xg1 - 0.002, 0.0, GLAND['z']), rot=(0, math.pi / 2, 0)), 3))
    camino = C.redondear([(xb, 0.0, cz1 + 0.006), (xb, 0.0, 0.497), (xg1 + 0.026, 0.0, 0.497), (xg1 + 0.004, 0.0, GLAND['z'])], 0.014)
    G['cables'].append(C.tubo_rmf('cable_alta', camino, CABLE_R, E['cable'], lados=6))
    G['_cable'] = [camino, (xb, cz1), xg1]


# ---------------------------------------------------------------- revisar

def revisar(nombre, palabra, G, neones, letras, soporte, xg0, xg1):
    """Que todo se sostenga y esté conectado, y que el neón se vea de las dos caras."""
    piezas, barras = soporte['piezas'], soporte['barras']
    malos = []
    # cada pieza con su barra, cada barra metida en su pieza (y en la de abajo) con margen a la pared
    holg_min, vis_max = 1e9, 0.0
    for b in barras:
        pz = piezas[b['pieza']]
        za = b['z1'] - b['mete']
        for z in np.linspace(za, b['z1'], 6):
            for x in (b['x'] - b['w'] / 2, b['x'] + b['w'] / 2):
                p = Vector((x, z))
                if not material(p, pz):
                    malos.append(f'barra de la pieza {b["pieza"]} fuera de su lámina en x={x:.3f} z={z:.3f}')
                holg_min = min(holg_min, holgura(p, pz))
        if b['destino'] is not None:
            q = piezas[b['destino']]
            for z in np.linspace(b['z0'], b['z0'] + b['mete'], 5):
                for x in (b['x'] - b['w'] / 2, b['x'] + b['w'] / 2):
                    p = Vector((x, z))
                    if not material(p, q):
                        malos.append(f'pata de la pieza {b["pieza"]} fuera de la pieza {b["destino"]} en z={z:.3f}')
                    holg_min = min(holg_min, holgura(p, q))
        # lo que se ve de la barra: de lo de abajo a su pieza, sin pasar por otra
        otras = [(k, q) for k, q in enumerate(piezas) if k not in (b['pieza'], b['destino'])
                 and q['x1'] >= b['x'] - b['w'] and q['x0'] <= b['x'] + b['w'] and q['z0'] <= b['z1'] and q['z1'] >= b['z0']]
        for z in np.arange(b['z0'] + 0.0005, b['z1'], 0.002):
            for x in (b['x'] - b['w'] / 2, b['x'], b['x'] + b['w'] / 2):
                p = Vector((x, z))
                for k, q in otras:
                    if material(p, q):
                        malos.append(f'la barra de la pieza {b["pieza"]} pasa por la pieza {k} en z={z:.3f}')
        bajo = Z_TAPA if b['destino'] is None else max(z1 for z0, z1 in intervalos(piezas[b['destino']], b['x']) if z0 <= b['z0'] + b['mete'] <= z1 + 1e-6)
        arriba = min(z0 for z0, z1 in intervalos(pz, b['x']) if z0 <= za + 1e-6 <= z1 + 1e-6)
        b['visible'] = arriba - bajo
        vis_max = max(vis_max, b['visible'])
    # que cada pieza llegue a la tapa siguiendo sus barras (solo bajan: no hay vueltas)
    por_pieza = {}
    for b in barras:
        por_pieza.setdefault(b['pieza'], []).append(b)
    for k in range(len(piezas)):
        cadena, actual = [], k
        while True:
            bs = por_pieza.get(actual)
            if not bs:
                malos.append(f'la pieza {k} no tiene barra')
                break
            if any(b['destino'] is None for b in bs):
                break
            actual = bs[0]['destino']
            cadena.append(actual)
            if len(cadena) > 10:
                malos.append(f'la pieza {k} da vueltas')
                break
    postes = [b for b in barras if b['destino'] is None]
    patas = [b for b in barras if b['destino'] is not None]
    anotar(f'  fierro: {len(postes)} postes desde la tapa ({sum(1 for b in postes if b["w"] == POSTE["w"])} de {POSTE["w"] * 1000:.0f} mm, '
           f'{sum(1 for b in postes if b["w"] < POSTE["w"])} de {PATA_FINA["w"] * 1000:.0f}–{PATA["w"] * 1000:.0f} mm), {len(patas)} patas a la pieza de abajo; '
           f'lo más que se ve de una barra {vis_max * 100:.1f} cm; holgura mínima de lo metido a la orilla de la lámina '
           f'{holg_min * 1000:.1f} mm (la lámina mide {PARED * 1000:.0f}); {len(soporte["placas"])} placas en la tapa')
    # juntas de la base (hueco entre cajas, negativo = se meten; área de contacto)
    base_ = {o.name.split('.')[0]: o for o in G['base'] if not o.name.startswith(('ancla', 'puerta', 'chapa', 'ceja'))}
    j = [('zoclo en el dado', C.junta(base_['zoclo'], base_['dado'])), ('gabinete en el zoclo', C.junta(base_['gabinete'], base_['zoclo'])),
         ('tapa en el gabinete', C.junta(base_['tapa'], base_['gabinete']))]
    placas = [o for o in G['placas'] if o.name.startswith('placa_poste')]
    jp = [C.junta(pl, base_['tapa']) for pl in placas]
    jpp = []
    for b in postes:
        pl = min(placas, key=lambda o: abs(C.junta(b['obj'], o)[0]))
        jpp.append(C.junta(b['obj'], pl))
    anotar('  base: ' + ', '.join(f'{n} {C.fmt(v)}' for n, v in j) +
           f'; placas en la tapa: peor hueco {max(g for g, _ in jp) * 1000:+.2f} mm; postes en su placa: peor hueco {max(g for g, _ in jpp) * 1000:+.2f} mm, '
           f'menor contacto {min(a_ for _, a_ in jpp) * 1e4:.1f} cm²')
    tr = {o.name.split('.')[0]: o for o in G['trafo']}
    con = {o.name.split('.')[0]: o for o in G['conduit']}
    cab = {o.name.split('.')[0]: o for o in G['cables']}
    zmin = min((con['conduit'].matrix_world @ v.co).z for v in con['conduit'].data.vertices)
    camino, (xb, cz1), _ = G['_cable']
    gx0 = xg1 - 0.002
    anotar(f'  transformador: placa en la cabecera {C.fmt(C.junta(tr["trafo_placa"], base_["gabinete"]))}, caja en la placa {C.fmt(C.junta(tr["transformador"], tr["trafo_placa"]))}; '
           f'conduit: conector en la caja {C.fmt(C.junta(con["conduit_conector"], tr["transformador"]))}, tubo en el conector {C.fmt(C.junta(con["conduit"], con["conduit_conector"]))}, '
           f'boquilla en el dado {C.fmt(C.junta(con["conduit_boquilla"], base_["dado"]))}, abajo en z={zmin:.3f} '
           f'({"adentro del dado" if zmin < DADO["z1"] else "AFUERA"}), abrazadera en el gabinete {C.fmt(C.junta(con["conduit_abrazadera"], base_["gabinete"]))} '
           f'y en el conduit {C.fmt(C.junta(con["conduit_abrazadera"], con["conduit"]))}')
    anotar(f'  cable de alta: salida en la caja {C.fmt(C.junta(cab["trafo_salida"], tr["transformador"]))}; empieza '
           f'{C.punta_en_cilindro(camino[0], CABLE_R, (xb, 0, cz1), (0, 0, 1), 0.016, 0.009)} de la salida, acaba '
           f'{C.punta_en_cilindro(camino[-1], CABLE_R, (gx0, 0, GLAND["z"]), (1, 0, 0), 0.014, GLAND["r"])} del pasacables; '
           f'pasacables metido en la cabecera {C.fmt(C.junta(cab["pasacables"], base_["gabinete"]))}')
    cables =[o for o in G['cables'] if o.name.startswith('cable_alta')]
    fierro_ = G['postes'] + G['patas']
    pares = [
        ('neón', neones, 'letras, tubos oxidados, grapas y fierro', G['letras'] + G['marcos'] + G['grapas'] + fierro_ + G['placas']),
        ('soportes de las filas', G['soportes'], 'fierro y tubos oxidados', fierro_ + G['marcos']),
        ('fierro', fierro_, 'tubos oxidados y grapas', G['marcos'] + G['grapas']),
        ('postes', G['postes'], 'patas', G['patas']),
        ('cable', cables, 'transformador, tapa, conduit y placa', [tr['transformador'], tr['trafo_placa'], base_['tapa']] + G['conduit']),
        ('conduit', G['conduit'], 'zoclo, ceja y anclas', [base_['zoclo']] + [o for o in G['base'] if o.name.startswith(('ceja', 'ancla'))]),
        ('transformador', G['trafo'], 'zoclo y tapa', [base_['zoclo'], base_['tapa']]),
        ('letras', G['letras'] + G['marcos'], 'tapa, placas y tornillos', [base_['tapa']] + G['placas']),
    ]
    for na, A, nb, B in pares:
        n = C.traspasos(A, B)
        anotar(f'  traspasos {na} contra {nb}: {n}')
        if n:
            malos.append(f'traspasos {na} contra {nb}: {n}')
    n_sl = C.traspasos(G['soportes'], neones)
    n_sf = C.traspasos(G['soportes'], G['letras'])
    anotar(f'  soportes de las filas: tocan el neón {n_sl > 0} y su fondo {n_sf > 0}')
    if not (n_sl and n_sf):
        malos.append('soportes de las filas sueltos')
    # las barras entran por la lámina (la ranura en el costado), no por los fondos: se quedan en el hueco
    dmax = max(max(b['d'] for b in barras) / 2, 0.0)
    anotar(f'  el fierro vive entre los fondos: medio fondo de la barra más gruesa {dmax * 1000:.0f} mm, fondos a ±{FONDO * 1000:.0f} mm')
    # el neón visible de las dos caras: un rayo desde cada cara a cada fila, ¿le pega al neón primero?
    fijos = arbol(G['letras'] + G['marcos'] + G['grapas'] + G['soportes'] + fierro_)
    vista = {}
    for i, l in enumerate(letras):   # los tubos a lo largo también cuentan como filas para el rayo de frente
        l['filas_rayo'] = l['filas'] + [(q.x - 0.001, q.x + 0.001, q.y) for e in l['espinas'] for q in densificar(e, 0.05)[1:-1] or e[:1]]
    for sg in (-1, 1):
        ok = tot = 0
        for i, l in enumerate(letras):
            tn = arbol([neones[i]])
            for x0, x1, z in l['filas_rayo']:
                for t in (0.3, 0.5, 0.7):
                    x = x0 + (x1 - x0) * t
                    o = Vector((x, sg * 3.0, z))
                    dr = Vector((0, -sg, 0))
                    hn = tn.ray_cast(o, dr)
                    hf = fijos.ray_cast(o, dr)
                    tot += 1
                    if hn[0] is not None and (hf[0] is None or hn[3] < hf[3]) and sg * hn[0].y > 0:
                        ok += 1
        vista[sg] = (ok, tot)
    anotar(f'  neón a la vista (rayos de frente a cada fila): cara -Y {vista[-1][0]}/{vista[-1][1]}, cara +Y {vista[1][0]}/{vista[1][1]}')
    if vista[-1][0] < vista[-1][1] or vista[1][0] < vista[1][1]:
        malos.append('hay filas tapadas')
    # desde la cámara del juego: rayos a CAMARA_CABECEO° hacia abajo, de frente y de espaldas, a puntos
    # de cada tubo (filas y tubos a lo largo); un tubo se ve si la mayoría de sus puntos se ven
    todo_fijo = arbol([o for k in G if not k.startswith('_') for o in G[k]])
    cab = math.radians(CAMARA_CABECEO)
    juego = {}
    for sg in (-1, 1):
        tubos_ok = tubos = pts_ok = pts = 0
        dr = Vector((0.0, -sg * math.cos(cab), -math.sin(cab)))
        for i, l in enumerate(letras):
            tn = arbol([neones[i]])
            muestras = [[Vector((x0 + (x1 - x0) * t, z)) for t in (0.2, 0.5, 0.8)] for x0, x1, z in l['filas']]
            muestras += [densificar(e, max(0.03, sum((b - a).length for a, b in zip(e, e[1:])) / 4))[:5] for e in l['espinas']]
            for ms in muestras:
                vis = 0
                for q in ms:
                    obj = Vector((q.x, sg * (NEON_Y + R_NEON * 0.5), q.y + R_NEON * 0.5))
                    o = obj - dr * 4.0
                    hn = tn.ray_cast(o, dr)
                    hf = todo_fijo.ray_cast(o, dr)
                    if hn[0] is not None and (hf[0] is None or hn[3] < hf[3]) and sg * hn[0].y > 0:
                        vis += 1
                pts += len(ms)
                pts_ok += vis
                tubos += 1
                tubos_ok += vis * 2 > len(ms)
        juego[sg] = (tubos_ok, tubos, pts_ok, pts)
    anotar(f'  neón desde la cámara del juego ({CAMARA_CABECEO}° hacia abajo): de frente se ven {juego[-1][0]}/{juego[-1][1]} tubos '
           f'({juego[-1][2]}/{juego[-1][3]} puntos), de espaldas {juego[1][0]}/{juego[1][1]} ({juego[1][2]}/{juego[1][3]} puntos)')
    for sg in (-1, 1):
        if juego[sg][0] < 0.8 * juego[sg][1]:
            malos.append(f'desde la cámara del juego se ven pocos tubos ({juego[sg][0]}/{juego[sg][1]})')
    zmin = min((o.matrix_world @ v.co).z for k in G if not k.startswith('_') for o in G[k] if not o.name.startswith(('dado', 'conduit'))
               for v in o.data.vertices)
    anotar(f'  lo más bajo que no es el dado ni el conduit: z={zmin:.4f}')
    if malos:
        anotar('  REVISAR: ' + '; '.join(malos[:12]) + (f' (y {len(malos) - 12} más)' if len(malos) > 12 else ''))
    else:
        anotar('  todo se sostiene y está conectado')
    del G['_cable']


def arbol(objs):
    verts, caras = [], []
    for o in objs:
        base_ = len(verts)
        verts += [o.matrix_world @ v.co for v in o.data.vertices]
        caras += [[base_ + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, caras)


# ---------------------------------------------------------------- comandos

def raices():
    return sorted([o for o in bpy.data.objects if o.get('orden') is not None], key=lambda o: o['orden'])


def todos(rs):
    return [o for r in rs for o in [r] + sorted(r.children, key=lambda c: c.name)]


def acomodar(rs):
    """Cada letrero en su lugar de una cuadrícula (inglés arriba, español abajo) para hornear: la sombra
    de contacto de uno no le cae al otro. La malla sigue en su marco: solo cambia la ubicación."""
    for r in rs:
        k = r['orden']
        r.location = ((k % 5) * 5.5, (k // 5) * 2.0, 0.0)
    bpy.context.view_layer.update()


def a_identidad(rs):
    for r in rs:
        r.location = (0.0, 0.0, 0.0)
        r.rotation_euler = (0.0, 0.0, 0.0)
        r.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()


def armar():
    P.limpiar()
    random.seed(SEMILLA)
    REVISION.clear()
    E = materiales()
    rs, infos = [], {}
    for k, (sec, lang, palabra, nombre) in enumerate(nombres()):
        r, neones, info = letrero(sec, lang, palabra, nombre, E)
        r['orden'] = k
        rs.append(r)
        infos[nombre] = info
    objs = todos(rs)
    T.uv_atlas_ponderado(objs, {r.name: 1.0 for r in rs}, margen=0.0016)
    acomodar(rs)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    anotar('medidas (m) y triángulos:')
    for r in rs:
        i = infos[r.name]
        tri = P.triangulos([r] + list(r.children))
        z0, z1 = i['letras_z']
        anotar(f'  {r.name:34s} {r["palabra"]:9s} ancho {i["ancho"]:.3f} (x {i["x"][0]:+.3f} a {i["x"][1]:+.3f}, letras {i["letras_ancho"]:.3f}, '
               f'gabinete {i["gabinete"][1] - i["gabinete"][0]:.3f}), fondo {i["y"][1] - i["y"][0]:.3f}, alto {i["alto"]:.3f}; letras de z={z0:.3f} a {z1:.3f} '
               f'({z1 - z0:.3f}); {tri} tri ({P.triangulos([r])} fijo + {P.triangulos(list(r.children))} neón), {T.densidad(r):.0f} px/m')
    anotar(f'total: {P.triangulos(objs)} triángulos; guardado {BLEND}')
    with open(os.path.join(tempfile.gettempdir(), 'props_letreros_revision.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(REVISION))


def abrir():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.open_mainfile(filepath=BLEND)


def pintar(tam=TAM, muestras=64):
    abrir()
    rs = raices()
    acomodar(rs)
    P.hornear_atlas(todos(rs), PNG, tam=tam, muestras=muestras)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', PNG)


def exportar():
    abrir()
    rs = raices()
    a_identidad(rs)
    objs = todos(rs)
    n = P.exportar_glb(objs, PNG, GLB)
    print(f'exportado: {GLB} {n / 1024:.0f} KB')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    lineas_ = [f'GLB {os.path.getsize(GLB)} bytes, materiales: {sorted(m.name for m in bpy.data.materials)}, '
               f'imágenes: {sorted((i.name, tuple(i.size)) for i in bpy.data.images)}']
    for o in sorted([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: o.name):
        co = np.array([o.matrix_world @ v.co for v in o.data.vertices])
        lineas_.append(f'  {o.name:44s} padre={o.parent.name if o.parent else "-":32s} identidad={o.matrix_world == Matrix.Identity(4)} '
                       f'x {co[:, 0].min():+.3f}..{co[:, 0].max():+.3f} y {co[:, 1].min():+.3f}..{co[:, 1].max():+.3f} '
                       f'z {co[:, 2].min():+.3f}..{co[:, 2].max():+.3f} {P.triangulos([o])} tri')
    print('\n'.join(lineas_))
    with open(os.path.join(tempfile.gettempdir(), 'props_letreros_glb.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas_))


# ---------------------------------------------------------------- fotos

def _escena(fondo='#3a3f52'):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'Standard'
    try:
        sc.eevee.taa_render_samples = 48
    except AttributeError:
        pass
    w = bpy.data.worlds.new('fondo')
    fondo_n = w.node_tree.nodes['Background']
    fondo_n.inputs['Color'].default_value = P.srgb(fondo)
    fondo_n.inputs['Strength'].default_value = 0.9
    sc.world = w
    sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
    sol.data.energy = 2.4
    sol.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.collection.objects.link(sol)
    relleno = bpy.data.objects.new('relleno', bpy.data.lights.new('relleno', 'SUN'))   # para la cara de atrás
    relleno.data.energy = 1.3
    relleno.data.use_shadow = False
    relleno.rotation_euler = (math.radians(60), 0, math.radians(150))
    sc.collection.objects.link(relleno)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.clip_end = 200
    sc.collection.objects.link(cam)
    sc.camera = cam
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    piso = bpy.context.active_object
    mp = bpy.data.materials.new('piso')
    mp.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = P.srgb('#27306a')
    mp.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    piso.data.materials.append(mp)
    return sc, cam, fondo_n, sol, relleno, piso, mp


def _ortho(sc, cam, ruta, centro, tam, az, el, res):
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = tam
    a, e = math.radians(az - 90), math.radians(el)
    d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    cam.location = Vector(centro) + d * 12
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    return ruta


def _juego(sc, cam, ruta, az, res=(1600, 1000), mira=(0, 0, 0.8), dist=11.4, fov=60):
    """La cámara del juego: perspectiva, 60° de campo vertical, CAMARA_CABECEO° de cabeceo, a 11.4 m
    (25 del sitio entre 2.2), viendo al letrero desde `az` (0 = desde -Y)."""
    cam.data.type = 'PERSP'
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.angle_y = math.radians(fov)
    a, e = math.radians(az - 90), math.radians(CAMARA_CABECEO)
    d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    cam.location = Vector(mira) + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    return ruta


def _neon_prendido(color, fuerza=7.0):
    m = bpy.data.materials.new('neon_' + color)
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = P.srgb(color)
    em.inputs['Strength'].default_value = fuerza
    sal = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], sal.inputs['Surface'])
    return m


def _tomas(carpeta, rs, sc, cam, fondo, sol, relleno, piso, mp, ext='png', noche=True):
    os.makedirs(carpeta, exist_ok=True)
    rutas = []
    objs = todos(rs)

    def solo(r):
        for o in objs:
            o.hide_render = o is not r and o.parent is not r

    ancho_max = max(r.dimensions.x for r in rs)
    for clave in ('MEMORIAS', 'WORK'):
        r = next(x for x in rs if x['palabra'] == clave)
        solo(r)
        bpy.context.view_layer.update()
        cx = (r.bound_box[0][0] + r.bound_box[6][0]) / 2
        n = clave.lower()
        piso.hide_render = True
        rutas.append(_ortho(sc, cam, os.path.join(carpeta, f'{n}_frente.{ext}'), (cx, 0, 0.75), max(r.dimensions.x * 1.08, 1.75 * 1600 / 760), 0, 0, (1600, 760)))
        rutas.append(_ortho(sc, cam, os.path.join(carpeta, f'{n}_atras.{ext}'), (cx, 0, 0.75), max(r.dimensions.x * 1.08, 1.75 * 1600 / 760), 180, 0, (1600, 760)))
        rutas.append(_ortho(sc, cam, os.path.join(carpeta, f'{n}_lado.{ext}'), (0, 0, 0.75), 1.7, 90, 0, (700, 800)))
        piso.hide_render = False
        rutas.append(_ortho(sc, cam, os.path.join(carpeta, f'{n}_tres_cuartos.{ext}'), (cx, 0, 0.75), max(r.dimensions.x, 2.9), -35, 18, (1600, 1000)))
        rutas.append(_ortho(sc, cam, os.path.join(carpeta, f'{n}_tres_cuartos_atras.{ext}'), (cx, 0, 0.75), max(r.dimensions.x, 2.9), 145, 18, (1600, 1000)))
        rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_camara_juego.{ext}'), 0))
        rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_camara_juego_atras.{ext}'), 180))
        if clave == 'MEMORIAS':
            xg1 = max(v.co.x for v in r.data.vertices if abs(v.co.z - 0.3) < 0.2)
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_transformador.{ext}'), (xg1 + 0.65, -0.75, 0.75), (xg1 - 0.05, 0.0, 0.35), lente=40))
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_postes.{ext}'), (0.4, -1.3, 0.8), (0.0, 0.0, 0.7), lente=35))
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_entre_caras.{ext}'), (1.5, -0.4, 1.5), (0.2, 0.0, 1.0), lente=30))
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_letras_cerca.{ext}'), (-0.9, -1.5, 1.6), (-0.9, 0.0, 1.05), lente=45))
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_base.{ext}'), (-0.9, -1.1, 0.45), (-1.3, 0.0, 0.25), lente=35))
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_orilla.{ext}'), (-2.9, -1.6, 1.5), (-1.6, 0.0, 0.8), lente=35))
    # la hoja con los diez de frente y con la cámara del juego, a la misma escala
    frentes, juegos = [], []
    for r in rs:
        solo(r)
        piso.hide_render = True
        frentes.append(_ortho(sc, cam, os.path.join(carpeta, f'hoja_{r.name}.{ext}'), (0.05, 0, 0.75), ancho_max * 1.05, 0, 0, (900, 400)))
        piso.hide_render = False
        juegos.append(_juego(sc, cam, os.path.join(carpeta, f'hojajuego_{r.name}.{ext}'), -25, res=(900, 560), dist=11.4, fov=26))
    rutas.append(_hoja(carpeta, frentes, f'letreros_hoja.{ext}'))
    rutas.append(_hoja(carpeta, juegos, f'letreros_hoja_camara.{ext}'))
    if noche:
        fondo.inputs['Color'].default_value = P.srgb('#0c1030')
        fondo.inputs['Strength'].default_value = 0.5
        sol.data.energy = 0.35
        relleno.data.energy = 0.12
        mp.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = P.srgb('#0a1450')
        T._brillo(sc)
        for r in rs:
            m = _neon_prendido(COLOR_PORTAL[r['seccion']])
            for c in r.children:
                c.data.materials.clear()
                c.data.materials.append(m)
        noches = []
        for r in rs:
            solo(r)
            noches.append(_juego(sc, cam, os.path.join(carpeta, f'hojanoche_{r.name}.{ext}'), -25, res=(900, 560), dist=11.4, fov=26))
        rutas.append(_hoja(carpeta, noches, f'letreros_hoja_noche.{ext}'))
        for clave in ('MEMORIAS', 'TIENDITA', 'WORK'):
            r = next(x for x in rs if x['palabra'] == clave)
            solo(r)
            n = clave.lower()
            ancho = r.dimensions.x
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_noche.{ext}'), (-1.6, -1.25 * ancho - 1.5, 1.9), (0.0, 0.0, 1.0), lente=40))
            rutas.append(T._toma(sc, cam, os.path.join(carpeta, f'{n}_noche_atras.{ext}'), (1.6, 1.25 * ancho + 1.5, 1.9), (0.0, 0.0, 1.0), lente=40))
            rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_noche_camara_juego.{ext}'), 0))
            # la cámara del juego más cerca: el letrero llena un tercio del ancho del cuadro (16:9, 60°
            # de campo vertical: el cuadro mide 2.05 veces la distancia)
            cerca = 3 * ancho / (2 * math.tan(math.atan(math.tan(math.radians(30)) * 16 / 9)))
            rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_noche_camara_juego_cerca.{ext}'), 0, res=(1920, 1080), dist=cerca))
            rutas.append(_juego(sc, cam, os.path.join(carpeta, f'{n}_noche_camara_juego_cerca_atras.{ext}'), 180, res=(1920, 1080), dist=cerca))
    for o in objs:
        o.hide_render = False
    return rutas


def _hoja(carpeta, rutas, nombre, columnas=5):
    imgs = []
    for r in rutas:
        img = bpy.data.images.load(r, check_existing=False)
        w, h = img.size
        imgs.append((np.array(img.pixels[:], np.float32).reshape(h, w, 4), w, h))
        bpy.data.images.remove(img)
    w, h = imgs[0][1], imgs[0][2]
    filas = math.ceil(len(imgs) / columnas)
    lienzo = np.zeros((filas * h, columnas * w, 4), np.float32)
    for i, (px, _, _) in enumerate(imgs):
        f, c = filas - 1 - i // columnas, i % columnas
        lienzo[f * h:(f + 1) * h, c * w:(c + 1) * w] = px
    out = bpy.data.images.new('hoja', columnas * w, filas * h, alpha=True)
    out.pixels.foreach_set(lienzo.ravel())
    out.filepath_raw = os.path.join(carpeta, nombre)
    out.file_format = 'PNG'
    out.save()
    for r in rutas:
        os.remove(r)
    return out.filepath_raw


def render(carpeta):
    abrir()
    rs = raices()
    a_identidad(rs)
    m = P.material_final(PNG, 'revision_letreros')
    for o in todos(rs):
        o.data.materials.clear()
        o.data.materials.append(m)
    sc, cam, fondo, sol, relleno, piso, mp = _escena()
    rutas = _tomas(carpeta, rs, sc, cam, fondo, sol, relleno, piso, mp)
    print('render:', *rutas, sep='\n  ')


def vista(carpeta):
    """Fotos rápidas de la geometría con Workbench (sin hornear)."""
    abrir()
    rs = raices()
    a_identidad(rs)
    sc, cam, fondo, sol, relleno, piso, mp = _escena()
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_cavity = True
    colores = {'Letreros_Lamina': (0.07, 0.09, 0.16, 1), 'Letreros_Gabinete': (0.12, 0.13, 0.15, 1), 'Letreros_Oxido': (0.45, 0.22, 0.12, 1),
               'Letreros_Fierro': (0.3, 0.34, 0.4, 1), 'Letreros_Acero': (0.45, 0.5, 0.56, 1), 'Letreros_Transformador': (0.35, 0.37, 0.4, 1),
               'Letreros_Concreto': (0.6, 0.58, 0.54, 1), 'Letreros_NeonVidrio': (0.95, 0.4, 0.9, 1), 'Letreros_Cable': (0.05, 0.05, 0.06, 1),
               'Letreros_Plastico': (0.1, 0.1, 0.12, 1)}
    for mat in bpy.data.materials:
        mat.diffuse_color = colores.get(mat.name, (0.4, 0.4, 0.5, 1))
    rutas = _tomas(carpeta, rs, sc, cam, fondo, sol, relleno, piso, mp, noche=False)
    print('vista:', *rutas, sep='\n  ')


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    rapido = 'rapido' in args[1:]
    resto = [a for a in args[1:] if a != 'rapido']
    carpeta = resto[0] if resto else os.path.join(tempfile.gettempdir(), 'props_letreros')
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
