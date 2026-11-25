"""Hitos de los portales (Oscar, 2026-11-24): el Prop_Hito del grupo rocas (scripts/estilo/props_rocas.py)
en alto, para ir detrás de cada portal con el nombre de su sección en SKULLEYGLYPH, como los menhires.
La misma piedra labrada, la misma pintura y el mismo bajorrelieve, con la cartela alargada para una
columna de hasta 8 runas.

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_hitos.py -- todo [carpeta_fotos]

  armar     arma la piedra y las 10 columnas de runas, revisa dónde caen y guarda Character/Estilo_hitos.blend
  pintar    hornea el atlas de 2048 (Cycles) a Character/assets/props_hitos.png (el maestro)
  exportar  escribe public/3dmodels/estilo/props_hitos.glb (un material) y lo vuelve a leer para revisarlo
  render    fotos de revisión en la carpeta que se le dé
  rapido    armar y fotos de la geometría con Workbench (sin hornear)
  todo      armar, pintar, exportar y render

Si se retoca el PNG maestro a mano, basta `exportar`.

Lo que trae el GLB (todo en metros, en el mismo marco: base en z = 0, el origen en el centro del pie,
el frente hacia -Y de Blender; todos los nodos con la transformación identidad, así el sitio pone la
piedra y la columna que toque con una sola matriz):
  Prop_HitoPortal                        la piedra: tronco de pirámide con punta, biseles grandes, musgo
                                         al pie y en la cara de enfrente la cartela rebajada, VACÍA
                                         (sin musgo ni liquen adentro: una mancha suelta se leía como
                                         el punto de una runa)
  Prop_HitoPortal_Runas_<sección>_<idioma>
                                         las runas de un nombre en bajorrelieve, de arriba abajo en el
                                         orden de lectura, centradas en la cartela. Su cara queda 4 mm
                                         abajo de la de la piedra y se hunden 1.5 mm en el fondo de la
                                         cartela (no hay hueco). Pintadas más claras y limpias que la
                                         piedra: el sitio les prende el emisivo del color de su portal.
    en: section1 WORK, section2 ABOUT, section3 STORE, section4 CONTACT, section5 MEMORIES
    es: section1 TRABAJO, section2 SOBREMI, section3 TIENDITA, section4 CONTACTO, section5 MEMORIAS
Todas las runas a la misma escala y con el mismo espacio entre una y otra (de caja a caja); la cartela
mide para 8 runas de alto nominal y los nombres más cortos van centrados.

Mientras se hornea, cada columna vive en su lugar de una fila (marco), sobre una copia de la piedra que
no se hornea: así su sombra de contacto (AO) sale del fondo y las paredes de la cartela de verdad. La
piedra se hornea sola: el fondo de su cartela no lleva la sombra de ningún nombre.
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_line_line_2d

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.dont_write_bytecode = True
import pintura as P  # noqa: E402
import props_rocas as R  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_hitos.blend')
PNG = os.path.join(REPO, 'Character', 'assets', 'props_hitos.png')
GLB = os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_hitos.glb')
TAM = 2048
SEPARACION = 0.8
PIEDRA = 'Prop_HitoPortal'

NOMBRES = {
    'en': {'section1': 'WORK', 'section2': 'ABOUT', 'section3': 'STORE', 'section4': 'CONTACT', 'section5': 'MEMORIES'},
    'es': {'section1': 'TRABAJO', 'section2': 'SOBREMI', 'section3': 'TIENDITA', 'section4': 'CONTACTO', 'section5': 'MEMORIAS'},
}

# La piedra (las proporciones del Prop_Hito, estirado): pie W0 x D0, hombro W1 x D1 a la altura H1, punta
# de pirámide hasta H con una cara plana chiquita (`tope`). La cartela va en la cara de enfrente: `pie` es
# dónde empieza (medido sobre la cara), su ancho y el radio de sus esquinas; su alto sale de las runas.
HITO = {'W0': 0.40, 'D0': 0.28, 'W1': 0.32, 'D1': 0.22, 'H1': 1.50, 'H': 1.67, 'tope': (0.08, 0.055),
        'bisel': 0.024, 'panel_ancho': 0.155, 'panel_r': 0.03, 'pie': 0.12, 'hondo': 0.018}
# Las runas (block letters de runas_neon.mjs, las mismas de la R del hito): `escala` en metros por unidad
# de la runa (una runa mide ~4 x 6 unidades más el grueso del trazo, `alto` = 6.8 la nominal), `cupo` runas
# de `alto`, `separa` entre cajas, `margen` arriba y abajo de la columna. `cara`: la cara de la runa bajo la
# de la piedra; `hunde`: lo que se mete en el fondo; `talud`: el desplazamiento del contorno de la pared
# (adelante adelgaza, atrás engorda, como la R). `limpia` y `simplifica` aligeran los contornos.
RUNAS = {'escala': 0.0205, 'alto': 6.8, 'cupo': 8, 'separa': 0.02, 'margen': 0.03, 'cara': 0.004,
         'hunde': 0.0015, 'talud': 0.0011, 'limpia': 0.0018, 'simplifica': 0.0004}

# La cara de la runa: la piedra labrada más clara y más pareja.
RUNA = {'oscura': '#7a7266', 'base': '#a69d8d', 'clara': '#c4bba7', 'orilla': '#f0e8d3', 'mugre': '#40392f',
        'calido': '#b8a07c', 'frio': '#969ca6'}

MAT = {}
REVISION = []


def anotar(texto):
    REVISION.append(texto)
    print('  ' + texto)


def nombres():
    """(sección, idioma, palabra, nombre del objeto) en orden."""
    out = []
    for lang in ('en', 'es'):
        for sec, palabra in NOMBRES[lang].items():
            out.append((sec, lang, palabra, f'{PIEDRA}_Runas_{sec}_{lang}'))
    return out


# ---------------------------------------------------------------- la cara de enfrente

def panel_alto():
    s = RUNAS['escala']
    return RUNAS['cupo'] * RUNAS['alto'] * s + (RUNAS['cupo'] - 1) * RUNAS['separa'] + 2 * RUNAS['margen']


def marco_cara():
    """Los ejes de la cara de enfrente (que se echa para atrás): ex a lo ancho, up a lo alto sobre la
    cara, n hacia afuera; O en el centro de la cartela, sobre la cara."""
    H = HITO
    ex = Vector((1, 0, 0))
    up = Vector((0, (H['D0'] - H['D1']) / 2, H['H1'])).normalized()
    n = Vector((0, -up.z, up.y))
    O = Vector((0, -H['D0'] / 2, 0)) + up * (H['pie'] + panel_alto() / 2)
    return ex, up, n, O


def mundo(u, v, d):
    ex, up, n, O = marco_cara()
    return O + ex * u + up * v - n * d


def en_cara(co):
    """(u, v, d) de cada punto: d > 0 es hacia adentro de la piedra."""
    ex, up, n, O = marco_cara()
    rel = np.asarray(co, np.float64) - np.array(O)
    return rel @ np.array(ex), rel @ np.array(up), -(rel @ np.array(n))


# ---------------------------------------------------------------- materiales

def material_runa(nombre, paleta=RUNA):
    """La piedra labrada de la runa: los mismos tonos por cara, lavados y cincel que material_labrada
    pero más claros y suaves, la cara de enfrente aclarada, la orilla fina clara (lee el relieve), unas
    pocas desportilladuras, la mugre donde toca el fondo de la cartela, sin musgo ni liquen."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    nrm = geo.outputs['True Normal']
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(nrm, sn.inputs[0])
    ny = sn.outputs['Y']
    faceta = N.ruido(nrm, 2.4, detalle=1.0)
    col = N.rampa(faceta, [(0.32, paleta['oscura']), (0.5, paleta['base']), (0.7, paleta['clara'])])
    col = N.mezcla(0.62, col, paleta['base'])
    campo = N.ruido(pos, 5.0, detalle=3.0, rugosidad=0.6, distorsion=1.3)
    col = P.lavado(N, col, campo, 0.4, 0.12, paleta['oscura'], 0.16, borde=0.1, invertido=True)
    col = P.lavado(N, col, campo, 0.6, 0.12, paleta['clara'], 0.2, borde=0.05)
    tinte = N.ruido(pos, 2.2, detalle=1.0, distorsion=1.0)
    col = P.lavado(N, col, tinte, 0.57, 0.13, paleta['calido'], 0.22, borde=0.0)
    col = P.lavado(N, col, tinte, 0.43, 0.13, paleta['frio'], 0.18, borde=0.0, invertido=True)
    cincel = N.ruido(N.escalar(pos, (48.0, 48.0, 48.0)), 1.0, detalle=2.0, distorsion=2.0)
    col = P.lavado(N, col, cincel, 0.34, 0.04, paleta['oscura'], 0.1, borde=0.15, invertido=True)
    col = P.lavado(N, col, cincel, 0.66, 0.04, paleta['clara'], 0.14, borde=0.0)
    col = N.mezcla(N.val('MULTIPLY', P.suave(N, N.val('MULTIPLY', ny, -1.0), 0.8, 0.97), 0.35), col, paleta['clara'])
    col = N.mezcla(N.val('MULTIPLY', P.suave(N, nz, 0.35, 0.85), 0.3), col, paleta['clara'])
    cerca = P.suave(N, P.orilla_bisel(N, geo, 0.008, 12), 0.015, 0.05)
    ast = N.celdas(P.deformado(N, pos, 14.0, 0.03), 34.0)
    d_ast = N.val('ADD', ast.outputs['Distance'], N.val('SUBTRACT', 1.0, cerca))
    col = P.lavado(N, col, d_ast, 0.2, 0.05, paleta['orilla'], 0.45, borde=0.0, invertido=True)
    col = P.lavado(N, col, d_ast, 0.1, 0.04, paleta['oscura'], 0.4, borde=0.3, invertido=True)
    fina = P.suave(N, P.orilla_bisel(N, geo, 0.004, 12), 0.01, 0.04)
    seco = P.suave(N, N.ruido(pos, 40.0, detalle=2.0), 0.3, 0.6)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', fina, seco), 0.75), col, paleta['orilla'])
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.03
    col = P.lavado(N, col, ao.outputs['AO'], 0.6, 0.08, paleta['mugre'], 0.5, borde=0.25, invertido=True)
    col = P.grano(N, col, pos, 0.1)
    P._salida(N, col)
    return m


def material_piedra(nombre, paleta=R.LABRADA, musgo=0.9, umbral=1.02):
    """material_labrada() de props_rocas tal cual, salvo que el liquen y el musgo no entran a la
    cartela (atributo `Hondo` > 0): en el fondo vacío una mancha suelta se leía como el punto de una
    runa, y ahí van a brillar las del nombre."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    nrm = geo.outputs['True Normal']
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(nrm, sn.inputs[0])
    ny = sn.outputs['Y']
    sz = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sz.inputs[0])
    faceta = N.ruido(nrm, 2.4, detalle=1.0)
    col = N.rampa(faceta, [(0.32, paleta['oscura']), (0.5, paleta['base']), (0.7, paleta['clara'])])
    col = N.mezcla(0.5, col, paleta['base'])
    campo = N.ruido(pos, 3.0, detalle=3.0, rugosidad=0.6, distorsion=1.3)
    col = P.lavado(N, col, campo, 0.4, 0.12, paleta['oscura'], 0.25, borde=0.12, invertido=True)
    col = P.lavado(N, col, campo, 0.6, 0.12, paleta['clara'], 0.22, borde=0.08)
    tinte = N.ruido(pos, 1.6, detalle=1.0, distorsion=1.0)
    col = P.lavado(N, col, tinte, 0.57, 0.13, paleta['calido'], 0.3, borde=0.0)
    col = P.lavado(N, col, tinte, 0.43, 0.13, paleta['frio'], 0.26, borde=0.0, invertido=True)
    cincel = N.ruido(N.escalar(pos, (26.0, 26.0, 26.0)), 1.0, detalle=2.0, distorsion=2.0)
    col = P.lavado(N, col, cincel, 0.36, 0.04, paleta['oscura'], 0.16, borde=0.2, invertido=True)
    col = P.lavado(N, col, cincel, 0.64, 0.04, paleta['clara'], 0.18, borde=0.0)
    col = N.mezcla(N.val('MULTIPLY', P.suave(N, nz, 0.35, 0.85), 0.3), col, paleta['clara'])
    cerca = P.suave(N, P.orilla_bisel(N, geo, 0.025, 16), 0.015, 0.05)
    ast = N.celdas(P.deformado(N, pos, 8.0, 0.05), 13.0)
    d_ast = N.val('ADD', ast.outputs['Distance'], N.val('SUBTRACT', 1.0, cerca))
    col = P.lavado(N, col, d_ast, 0.3, 0.05, paleta['orilla'], 0.55, borde=0.0, invertido=True)
    col = P.lavado(N, col, d_ast, 0.17, 0.04, paleta['oscura'], 0.6, borde=0.4, invertido=True)
    fina = P.suave(N, P.orilla_bisel(N, geo, 0.01), 0.01, 0.04)
    seco = P.suave(N, N.ruido(pos, 24.0, detalle=2.0), 0.35, 0.65)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', fina, seco), 0.7), col, paleta['orilla'])
    at = N.n('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='Hondo')
    sa = N.n('ShaderNodeSeparateXYZ')
    N.l(at.outputs['Vector'], sa.inputs[0])
    col = P.lavado(N, col, sa.outputs['X'], 0.009, 0.003, paleta['oscura'], 0.6, borde=0.3)
    cartela = P.suave(N, sa.outputs['X'], 0.0005, 0.003)
    limpio = col
    col = N.mezcla(cartela, R._liquen(N, col, pos, nz, ny, 0.5), limpio)
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.08
    aov = ao.outputs['AO']
    col = P.lavado(N, col, aov, 0.62, 0.08, paleta['mugre'], 0.55, borde=0.25, invertido=True)
    if musgo:
        manchas = N.ruido(pos, 3.4, detalle=3.0, rugosidad=0.6, distorsion=1.4)
        campo = N.val('MULTIPLY', manchas, 0.9)
        campo = N.val('ADD', campo, N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, sz.outputs['Z'], 0.0, 0.2)), 0.75))
        campo = N.val('ADD', campo, N.val('MULTIPLY', N.val('SUBTRACT', 1.0, aov), 0.7))
        campo = N.val('ADD', campo, N.val('MULTIPLY', P.suave(N, ny, -0.2, 0.8), 0.2))
        campo = N.val('SUBTRACT', campo, N.val('MULTIPLY', cartela, 2.0))
        col = R._musgo(N, col, pos, campo, umbral, musgo)
    col = P.grano(N, col, pos, 0.12)
    P._salida(N, col)
    return m


def materiales():
    MAT['labrada'] = material_piedra('Hitos_Labrada')
    MAT['runa'] = material_runa('Hitos_Runa')


# ---------------------------------------------------------------- la piedra

def piedra():
    """Como hito() de props_rocas: casco de tronco de pirámide con punta, biseles de dos segmentos, la
    cartela rebajada con booleana exacta (paredes en talud, el fondo `hondo` abajo de la cara) y el
    atributo `Hondo` (x = qué tan hondo, solo en la cartela) que oscurece el fondo. Sin runa."""
    H = HITO
    pts = [(sx * H['W0'] / 2, sy * H['D0'] / 2, 0.0) for sx in (-1, 1) for sy in (-1, 1)]
    pts += [(sx * H['W1'] / 2, sy * H['D1'] / 2, H['H1']) for sx in (-1, 1) for sy in (-1, 1)]
    pts += [(sx * H['tope'][0] / 2, sy * H['tope'][1] / 2, H['H']) for sx in (-1, 1) for sy in (-1, 1)]
    cuerpo = R.casco(PIEDRA, pts, MAT['labrada'], disuelve=1)
    P.biselar(cuerpo, H['bisel'], 2, angulo=20)
    pw, ph, pr = H['panel_ancho'], panel_alto(), H['panel_r']
    cartela = R.orientar(R.rect_redondo(pw, ph, pr, 6), True)
    cort = R.relieve('hito_cartela', [[cartela]], mundo, -0.02, H['hondo'], -0.0036, 0.0025, MAT['labrada'])
    R.booleana(cuerpo, cort, 'DIFFERENCE')
    R.sin_normales_propias(cuerpo, 40)
    uu, vv, dd = en_cara(R.coords(cuerpo))
    dentro = (np.abs(uu) < pw / 2 + 0.006) & (np.abs(vv) < ph / 2 + 0.006) & (dd > -0.001) & (dd < 0.03)
    hondo = np.where(dentro, np.clip(dd, 0, None), 0.0)
    R.atributo(cuerpo, 'Hondo', np.stack([hondo, np.zeros(len(dd)), np.zeros(len(dd))], 1))
    return cuerpo


# ---------------------------------------------------------------- las runas

def leer_glifos(letras):
    """Los contornos de cada letra (block letters de grosor parejo, runas_neon.mjs)."""
    node = shutil.which('node') or 'C:/Program Files/nodejs/node.exe'
    r = subprocess.run([node, os.path.join(AQUI, 'runas_neon.mjs'), letras], cwd=REPO, capture_output=True, text=True, check=True)
    return {l['letra']: l['contornos'] for l in json.loads(r.stdout)['letras']}


def _dp(a, tol):
    guarda = [False] * len(a)
    guarda[0] = guarda[-1] = True
    pila = [(0, len(a) - 1)]
    while pila:
        i, j = pila.pop()
        (x1, y1), (x2, y2) = a[i], a[j]
        L = math.hypot(x2 - x1, y2 - y1) or 1e-12
        mx, mi = -1.0, -1
        for q in range(i + 1, j):
            d = abs((x2 - x1) * (y1 - a[q][1]) - (x1 - a[q][0]) * (y2 - y1)) / L
            if d > mx:
                mx, mi = d, q
        if mi >= 0 and mx > tol:
            guarda[mi] = True
            pila += [(i, mi), (mi, j)]
    return [p for p, g in zip(a, guarda) if g]


def simplificar(pts, tol):
    """Douglas-Peucker de un lazo cerrado, partido en el punto más lejano del primero."""
    if len(pts) < 5:
        return pts
    x0, y0 = pts[0]
    k = max(range(len(pts)), key=lambda i: (pts[i][0] - x0) ** 2 + (pts[i][1] - y0) ** 2)
    a = _dp(pts[:k + 1], tol)
    b = _dp(pts[k:] + [pts[0]], tol)
    return a[:-1] + b[:-1]


def cruces(lazo, otro=None):
    """Cuántas veces se cruzan los segmentos de un lazo consigo mismo (o con `otro`)."""
    A = [Vector(p) for p in lazo]
    B = A if otro is None else [Vector(p) for p in otro]
    n, m = len(A), len(B)
    c = 0
    for i in range(n):
        a0, a1 = A[i], A[(i + 1) % n]
        for j in range(m):
            if otro is None and (j <= i + 1 or (i == 0 and j == n - 1)):
                continue
            if intersect_line_line_2d(a0, a1, B[j], B[(j + 1) % m]):
                c += 1
    return c


def glifo(contornos):
    """Una letra en metros: x centrada, v de 0 (lo más alto) hacia abajo. Figuras = exterior en
    sentido contrario al reloj + sus huecos en el del reloj (como hito())."""
    s = RUNAS['escala']
    xs = [x for c in contornos for x, _ in c['pts']]
    ys = [y for c in contornos for _, y in c['pts']]
    xc, y0 = (max(xs) + min(xs)) / 2, min(ys)
    conv = []
    for c in contornos:
        pts = [((x - xc) * s, -(y - y0) * s) for x, y in c['pts']]
        pts = R.limpiar_lazo(simplificar(pts, RUNAS['simplifica']), RUNAS['limpia'])
        if len(pts) >= 3 and abs(R.area_lazo(pts)) > 1e-7:
            conv.append((pts, c['hueco']))
    figuras = [[R.orientar(p, True)] for p, hueco in conv if not hueco]
    for p, hueco in conv:
        if hueco:
            for fig in figuras:
                if R.dentro_lazo(p[0], fig[0]):
                    fig.append(R.orientar(p, False))
                    break
    return {'figuras': figuras, 'alto': (max(ys) - y0) * s, 'ancho': (max(xs) - min(xs)) * s}


def columna(palabra, glifos):
    """Las figuras de un nombre en coordenadas de la cartela (u, v; v = 0 en su centro), de arriba
    abajo, con `separa` entre las cajas de dos runas seguidas y la columna centrada."""
    gs = [glifos[c] for c in palabra]
    total = sum(g['alto'] for g in gs) + (len(gs) - 1) * RUNAS['separa']
    v = total / 2
    figuras = []
    for g in gs:
        for fig in g['figuras']:
            figuras.append([[(x, y + v) for x, y in lazo] for lazo in fig])
        v -= g['alto'] + RUNAS['separa']
    return figuras, total


def runas(palabra, nombre, glifos):
    figuras, total = columna(palabra, glifos)
    t = RUNAS['talud']
    # revisión de los contornos: ninguno se cruza consigo mismo ni con otro, al frente ni atrás
    malos = 0
    for ins in (t, -t):
        lazos = [R.desplazar(L, ins) for fig in figuras for L in fig]
        malos += sum(cruces(L) for L in lazos)
        for i in range(len(lazos)):
            for j in range(i + 1, len(lazos)):
                malos += cruces(lazos[i], lazos[j])
    o = R.relieve(nombre, figuras, mundo, RUNAS['cara'], HITO['hondo'] + RUNAS['hunde'], t, -t, MAT['runa'])
    o = R.unir([o], nombre)
    return o, total, malos


# ---------------------------------------------------------------- revisión de dónde caen

def malla_bvh(o):
    me = o.data
    return BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [list(p.vertices) for p in me.polygons])


def abiertas(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    n = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    return n


def revisar(o, roca, total, malos):
    """Las runas (en el marco de la piedra) contra la cartela: la cara bajo la de la piedra, el fondo
    cruzado (hundidas, sin hueco), dentro del fondo con holgura, y que lo único que tocan de la piedra
    sea el fondo de la cartela."""
    H = HITO
    ex, up, n, O = marco_cara()
    uu, vv, dd = en_cara(R.coords(o))
    fw, fh = H['panel_ancho'] / 2 - 0.0025, panel_alto() / 2 - 0.0025      # el fondo (la cartela menos el talud)
    holgura_lado = fw - np.abs(uu).max()
    holgura_alto = fh - np.abs(vv).max()
    arbol_r, arbol_p = malla_bvh(o), malla_bvh(roca)
    pares = arbol_r.overlap(arbol_p)
    me = roca.data
    ajenas = set()
    for _, ip in pares:
        p = me.polygons[ip]
        c = p.center
        d = -((c - O).dot(n))
        if not (abs(d - H['hondo']) < 2e-4 and p.normal.dot(n) > 0.99):
            ajenas.add(ip)
    zmin = R.coords(o)[:, 2].min()
    tris = P.triangulos([o])
    ok = (holgura_lado > 0.005 and holgura_alto > 0.005 and not ajenas and dd.min() > 0 and dd.max() > H['hondo']
          and not malos and zmin > 0 and abiertas(o) == 0)
    anotar(f'{o.name:40s} {o["palabra"]:9s} columna {total * 100:5.1f} cm, holgura al fondo {holgura_lado * 100:.1f} cm de lado '
           f'y {holgura_alto * 100:.1f} cm arriba/abajo, cara {dd.min() * 1000:.1f} mm bajo la piedra, hundida '
           f'{(dd.max() - H["hondo"]) * 1000:.1f} mm; toca {len({ip for _, ip in pares})} caras del fondo y {len(ajenas)} '
           f'de otra cosa; {malos} cruces de contorno; {abiertas(o)} aristas abiertas; {tris} triángulos  '
           f'{"OK" if ok else "REVISAR"}')
    return ok


# ---------------------------------------------------------------- atlas

DENSIDAD_PIEDRA = 1.0
DENSIDAD_RUNAS = 1.4
ABAJO = 0.06   # lo que no se ve (el pie de la piedra, la cara de atrás de las runas, hundida): a esta escala


def escalar_islas(o, peso, oculta, abajo=ABAJO):
    """escalar_islas() de props_rocas, con la cara que no se ve en la dirección `oculta`."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.active
    bm.faces.ensure_lookup_table()
    padre = list(range(len(bm.faces)))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i

    for e in bm.edges:
        if len(e.link_loops) != 2:
            continue
        pares = []
        for lp in e.link_loops:
            if lp.vert == e.verts[0]:
                pares.append((lp[uv].uv.copy(), lp.link_loop_next[uv].uv.copy()))
            else:
                pares.append((lp.link_loop_next[uv].uv.copy(), lp[uv].uv.copy()))
        (a1, b1), (a2, b2) = pares
        if (a1 - a2).length < 1e-5 and (b1 - b2).length < 1e-5:
            ra, rb = raiz(e.link_loops[0].face.index), raiz(e.link_loops[1].face.index)
            if ra != rb:
                padre[ra] = rb
    islas = {}
    for f in bm.faces:
        islas.setdefault(raiz(f.index), []).append(f)
    for caras in islas.values():
        area = sum(f.calc_area() for f in caras) or 1.0
        nd = sum(f.normal.dot(oculta) * f.calc_area() for f in caras) / area
        esc = peso * (abajo if nd > 0.5 else 1.0)
        if abs(esc - 1.0) < 1e-6:
            continue
        loops = [lp for f in caras for lp in f.loops]
        c = sum((lp[uv].uv for lp in loops), Vector((0, 0))) / len(loops)
        for lp in loops:
            lp[uv].uv = c + (lp[uv].uv - c) * esc
    bm.to_mesh(o.data)
    bm.free()


def uv_atlas(roca, columnas, margen=0.004):
    objs = [roca] + columnas
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.0)
    bpy.ops.uv.select_all(action='SELECT')
    try:
        bpy.ops.uv.average_islands_scale()
    except Exception:
        pass
    bpy.ops.object.mode_set(mode='OBJECT')
    _, _, n, _ = marco_cara()
    escalar_islas(roca, DENSIDAD_PIEDRA, Vector((0, 0, -1)))
    for o in columnas:
        escalar_islas(o, DENSIDAD_RUNAS, -n)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=margen, shape_method='CONCAVE')
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=margen)
    bpy.ops.object.mode_set(mode='OBJECT')


# ---------------------------------------------------------------- comandos

def escribir_revision():
    with open(os.path.join(tempfile.gettempdir(), 'props_hitos_revision.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(REVISION))


def armar():
    P.limpiar()
    materiales()
    roca = R.unir([piedra()], PIEDRA)
    R.marco(roca, Matrix.Identity(4))
    roca['orden'] = 0
    H = HITO
    ph = panel_alto()
    ex, up, n, O = marco_cara()
    uu, vv, dd = en_cara(R.coords(roca))
    fondo = int(((np.abs(dd - H['hondo']) < 1e-4) & (np.abs(uu) < H['panel_ancho'] / 2) & (np.abs(vv) < ph / 2)).sum())
    lo, hi = R.caja_mundo([roca])
    anotar(f'{PIEDRA}: {hi[0] - lo[0]:.3f} x {hi[1] - lo[1]:.3f} x {hi[2] - lo[2]:.3f} m (z de {lo[2]:.4f} a {hi[2]:.4f}), '
           f'{P.triangulos([roca])} triángulos, {abiertas(roca)} aristas abiertas tras la booleana')
    anotar(f'cartela {H["panel_ancho"] * 100:.1f} x {ph * 100:.1f} cm, {H["hondo"] * 1000:.0f} mm de hondo, del {H["pie"] * 100:.0f} '
           f'al {(H["pie"] + ph) * 100:.1f} cm sobre la cara (hombro a {H["H1"] * 100:.0f} cm); {fondo} vértices en el fondo')
    letras = ''.join(sorted({c for lang in NOMBRES.values() for p in lang.values() for c in p}))
    glifos = {k: glifo(v) for k, v in leer_glifos(letras).items()}
    altos = {k: g['alto'] for k, g in glifos.items()}
    anotar(f'runas a {RUNAS["escala"] * 1000:.1f} mm por unidad: nominal {RUNAS["alto"] * RUNAS["escala"] * 100:.1f} cm; '
           f'de {min(altos.values()) * 100:.1f} ({min(altos, key=altos.get)}) a {max(altos.values()) * 100:.1f} cm '
           f'({max(altos, key=altos.get)}) de alto y hasta {max(g["ancho"] for g in glifos.values()) * 100:.1f} cm de ancho; '
           f'relieve {(H["hondo"] - RUNAS["cara"]) * 1000:.0f} mm')
    columnas = []
    todo_ok = True
    for k, (sec, lang, palabra, nombre) in enumerate(nombres()):
        o, total, malos = runas(palabra, nombre, glifos)
        o['palabra'] = palabra
        o['seccion'] = sec
        o['idioma'] = lang
        todo_ok &= revisar(o, roca, total, malos)
        x = (k + 1) * SEPARACION
        R.mover([o], (x, 0, 0))
        R.marco(o, Matrix.Translation((x, 0, 0)))
        o['orden'] = k + 1
        columnas.append(o)
    anotar('revisión de las columnas: ' + ('todas OK' if todo_ok else 'HAY QUE REVISAR'))
    uv_atlas(roca, columnas)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    anotar(f'guardado {BLEND}')
    escribir_revision()


def listar():
    objs = sorted([o for o in bpy.data.objects if 'orden' in o], key=lambda o: o['orden'])
    return objs[0], objs[1:]


def pintar():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    roca, columnas = listar()
    ayudantes = []
    for o in columnas:
        c = R.copia(roca, 'ayuda_' + o.name)
        for k in ('orden', 'marco'):
            if k in c:
                del c[k]
        c.data.transform(R.leer_marco(o))
        ayudantes.append(c)
    P.hornear_atlas([roca] + columnas, PNG, tam=TAM)
    for c in ayudantes:
        me = c.data
        bpy.data.objects.remove(c, do_unlink=True)
        bpy.data.meshes.remove(me)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', PNG)


def a_identidad(objs):
    """Cada objeto de regreso al marco de la piedra, con la transformación identidad."""
    for o in objs:
        o.data.transform(R.leer_marco(o).inverted())
        o.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()


def exportar():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    roca, columnas = listar()
    objs = [roca] + columnas
    a_identidad(objs)
    for o in objs:
        o.data.polygons.foreach_set('material_index', [0] * len(o.data.polygons))
    n = P.exportar_glb(objs, PNG, GLB)
    print(f'exportado: {GLB} {n} bytes')
    # de vuelta: se lee el GLB en una escena vacía y se revisa lo que el sitio va a encontrar
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    lineas = [f'GLB {os.path.getsize(GLB)} bytes, materiales: {sorted(m.name for m in bpy.data.materials)}, '
              f'imágenes: {sorted((i.name, tuple(i.size)) for i in bpy.data.images)}']
    for o in sorted([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: o.name):
        co = np.array([o.matrix_world @ v.co for v in o.data.vertices])
        lineas.append(f'  {o.name:40s} padre={o.parent.name if o.parent else "-"} identidad={o.matrix_world == Matrix.Identity(4)} '
                      f'x {co[:, 0].min():.3f}..{co[:, 0].max():.3f} y {co[:, 1].min():.3f}..{co[:, 1].max():.3f} '
                      f'z {co[:, 2].min():.4f}..{co[:, 2].max():.4f} {P.triangulos([o])} tri, {len(o.data.materials)} mat')
    print('\n'.join(lineas))
    with open(os.path.join(tempfile.gettempdir(), 'props_hitos_glb.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas))


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
    w.node_tree.nodes['Background'].inputs['Color'].default_value = P.srgb(fondo)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    sc.world = w
    sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
    sol.data.energy = 2.4
    sol.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.collection.objects.link(sol)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.clip_end = 200
    sc.collection.objects.link(cam)
    sc.camera = cam
    return sc, cam


def _direccion(az, el):
    a, e = math.radians(az - 90), math.radians(el)
    return Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))


def _foto(sc, ruta, res):
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)
    return ruta


def hoja(carpeta, rutas, nombre, columnas=5):
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
    return out.filepath_raw


def _tomas(carpeta, roca, columnas, ext, sc, cam, piso=None, brillo=None):
    """Las fotos (con todo ya en el marco de la piedra): de un nombre de 8 runas de frente, a tres
    cuartos, con la cámara del juego (perspectiva, 60° de campo vertical, 35° de cabeceo, a 7 m: los
    15.5 m del sitio entre 2.2) y de cerca; la hoja con los 10 nombres de frente."""
    os.makedirs(carpeta, exist_ok=True)
    todos = [roca] + columnas
    rutas = []

    def solo(grupo):
        for o in todos + ([piso] if piso else []):
            o.hide_render = o not in grupo

    ejemplo = next(o for o in columnas if o['palabra'] == 'MEMORIES')
    grupo = [roca, ejemplo]
    solo(grupo)
    cam.data.type = 'ORTHO'
    R._encuadrar(cam, grupo, az=0, el=4, margen=1.08)
    rutas.append(_foto(sc, os.path.join(carpeta, f'hito_frente.{ext}'), (700, 1500)))
    R._encuadrar(cam, grupo, az=-35, el=18, margen=1.08)
    rutas.append(_foto(sc, os.path.join(carpeta, f'hito_tres_cuartos.{ext}'), (900, 1500)))
    pts = [v.co.copy() for v in ejemplo.data.vertices if v.co.z > 0.95]
    R._encuadrar(cam, grupo, az=-14, el=10, margen=1.6, puntos=pts)
    rutas.append(_foto(sc, os.path.join(carpeta, f'hito_cerca.{ext}'), (1100, 1100)))
    R._encuadrar(cam, grupo, az=150, el=22, margen=1.08)
    rutas.append(_foto(sc, os.path.join(carpeta, f'hito_atras.{ext}'), (900, 1500)))
    if piso:
        solo(grupo + [piso])
        cam.data.type = 'PERSP'
        cam.data.sensor_fit = 'VERTICAL'
        cam.data.angle_y = math.radians(60)
        objetivo = Vector((0, 0, 0.8))
        d = _direccion(0, 35)
        cam.location = objetivo + d * 7.0
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        rutas.append(_foto(sc, os.path.join(carpeta, f'hito_camara_juego.{ext}'), (1920, 1080)))
        d = _direccion(-30, 35)
        cam.location = objetivo + d * 7.0
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        cam.data.angle_y = math.radians(14)
        rutas.append(_foto(sc, os.path.join(carpeta, f'hito_camara_juego_zoom.{ext}'), (1200, 1200)))
        cam.data.type = 'ORTHO'
        solo(grupo)
    if brillo:
        antes = list(ejemplo.data.materials)
        brillo(ejemplo)
        R._encuadrar(cam, grupo, az=-35, el=18, margen=1.08)
        rutas.append(_foto(sc, os.path.join(carpeta, f'hito_brillo_ejemplo.{ext}'), (900, 1500)))
        ejemplo.data.materials.clear()
        for mat in antes:
            ejemplo.data.materials.append(mat)
    frentes = []
    for o in columnas:
        solo([roca, o])
        R._encuadrar(cam, [roca], az=0, el=4, margen=1.08)
        frentes.append(_foto(sc, os.path.join(carpeta, f'nombre_{o["seccion"]}_{o["idioma"]}.{ext}'), (420, 1000)))
    for o in todos:
        o.hide_render = False
    rutas.append(hoja(carpeta, frentes, f'hitos_hoja.{ext}', columnas=5))
    return rutas


def render(carpeta):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    roca, columnas = listar()
    a_identidad([roca] + columnas)
    m = P.material_final(PNG, 'Hitos_Final')
    for o in [roca] + columnas:
        o.data.polygons.foreach_set('material_index', [0] * len(o.data.polygons))
        o.data.materials.clear()
        o.data.materials.append(m)
    sc, cam = _escena()
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    piso = bpy.context.active_object
    mp = bpy.data.materials.new('piso')
    mp.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = P.srgb('#1f2f7a')
    mp.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    piso.data.materials.append(mp)

    def brillo(o):
        """Como lo va a hacer el sitio: el emisivo de las runas en el color de un portal."""
        mb = m.copy()
        nt = mb.node_tree
        bsdf = nt.nodes['Principled BSDF']
        bsdf.inputs['Emission Color'].default_value = P.srgb('#36d9ff')
        bsdf.inputs['Emission Strength'].default_value = 1.2
        o.data.materials.clear()
        o.data.materials.append(mb)

    rutas = _tomas(carpeta, roca, columnas, 'png', sc, cam, piso=piso, brillo=brillo)
    print('render:', carpeta)
    for r in rutas:
        print('  ', r)


def vista(carpeta):
    """Fotos rápidas de la geometría con Workbench (sin hornear)."""
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    roca, columnas = listar()
    a_identidad([roca] + columnas)
    sc, cam = _escena()
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_cavity = True
    for mat in bpy.data.materials:
        mat.diffuse_color = {'Hitos_Labrada': (0.55, 0.51, 0.45, 1), 'Hitos_Runa': (0.8, 0.76, 0.68, 1)}.get(mat.name, (0.6, 0.6, 0.6, 1))
    _tomas(carpeta, roca, columnas, 'png', sc, cam)
    print('vista:', carpeta)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    carpeta = args[1] if len(args) > 1 else os.path.join(tempfile.gettempdir(), 'props_hitos')
    if cmd in ('armar', 'todo', 'rapido'):
        armar()
    if cmd == 'rapido':
        vista(carpeta)
    if cmd in ('pintar', 'todo'):
        pintar()
    if cmd in ('exportar', 'todo'):
        exportar()
    if cmd in ('render', 'todo'):
        render(carpeta)
