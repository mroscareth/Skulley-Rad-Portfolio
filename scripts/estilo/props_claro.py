"""Lo que se trae al claro del mapa descartado (Oscar, 2026-11-24): el letrero de neón OPEN parado en
el pasto y el cable de corriente de la Renderbox Nano, para que no sea una computadora flotando en el
campo sin luz.

Mismo estilo y librería que los demás grupos (scripts/estilo/pintura.py) y las piezas del letrero
ESTUDIO (scripts/estilo/props_taller.py: letra_bloque, filas_neon, grapas, tubo_cerrado...). Regla de
Oscar: todo se sostiene y todo está conectado, y se mide (`revisar_letrero`, `revisar_cable`):

- OPEN en runas de SKULLEYGLYPH (scripts/estilo/neon_open.json, de runas_neon.mjs) como letras de
  neón de bloque: lámina honda pintada de azul marino sobre óxido, el frente abierto lleno de filas de
  neón (cada fila con su soporte de tubo hasta el fondo de la lámina) y el tubo oxidado del contorno
  con grapitas. Cada pieza de cada letra va soldada con ménsulas a tres soleras de PTR, atornilladas
  a dos postes de PTR con placa base, cartelas y anclas sobre su dado de concreto. El transformador
  va en el poste derecho a ~1 m, con su tubo conduit bajando al dado; el cable de alta tensión sube
  por el poste hasta la N y de letra en letra van puentes amarrados bajo la solera de en medio.
- El cable de la Renderbox: un tomacorriente IEC en la placa de la fuente (atrás, abajo), la clavija
  metida en él, el cable que cae al piso, se tiende con curvas suaves ~2 m hacia atrás y se mete por la
  muesca (con su pasacables de hule) de un registro de concreto con tapa de lámina, a ras del piso.
- La Wacom Cintiq Pro 27 de Oscar en el piso junto a la Renderbox (Oscar, 2026-11-25: "por ahí a un lado
  en el suelo"): la misma de su escritorio del Estudio (props_taller.py: cintiq, cintiq_pantalla), parada
  en sus patitas y su soporte, recostada 20°, con la pluma acostada enfrente. Va del lado -X (el
  contrario del cable de corriente y su registro), a ~0.45 m de la Renderbox, de frente al centro del
  claro y un poco girada hacia ella. Su cable sale de un conector USB-C en su canto, cae al piso, da la
  vuelta por detrás y sube a un DisplayPort de la placa de la tarjeta de video, en la espalda de la
  Renderbox (`revisar_cintiq` lo mide).

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_claro.py -- todo [carpeta_fotos] [rapido]

  armar          arma todo, lo mide, le da su atlas y guarda Character/Estilo_claro.blend
  pintar         hornea el atlas (Cycles): Character/assets/props_claro.png (el maestro)
  exportar       public/3dmodels/estilo/props_claro.glb (Draco, WebP, un material)
  render         fotos de revisión (Eevee) en la carpeta que se le dé (también las de la Cintiq)
  todo           los cuatro
  cintiq         agrega la Cintiq a lo que ya está armado y pintado sin tocarlo: abre Estilo_claro.blend,
                 la arma, acomoda sus islas en los huecos del atlas (las de antes, fijas), hornea solo sus
                 islas encima de props_claro.png y guarda (así se agregó; después, `exportar`)
  render_cintiq  solo las fotos de la Cintiq con la Renderbox
  `rapido`       hornea a 1024 con pocas muestras (para iterar; con `cintiq`, solo pocas muestras)

props_claro.glb (metros, base en z = 0, el frente hacia -Y de Blender; los nodos con transformación
identidad, cada malla en su propio marco):
  Prop_LetreroOpen                 lo fijo del letrero: letras, tubos oxidados, grapas, soportes de las
                                   filas, ménsulas, soleras, postes, placas, dados, transformador,
                                   conduit, cables y pasacables. Origen al centro de su huella en el piso.
    Prop_LetreroOpen_Neon_Open_0…3 (hijas) las filas de neón de cada letra (O P E N), vidrio apagado
  Prop_RenderboxCable              el cable con su clavija, la placa de la fuente con el tomacorriente
                                   y el registro, en el marco de Prop_Estudio_Computadora (mismo origen
                                   y ejes, su frente en -Y): el sitio lo pone con la transformación de la
                                   Renderbox.
  Prop_RenderboxCintiq             en el mismo marco: el cable de la Cintiq con sus dos conectores, la
                                   placa de la tarjeta de video (puertos y rejilla) en la espalda de la
                                   Renderbox y la pluma acostada en el piso
    Prop_RenderboxCintiq_Cuerpo    (hija) la Cintiq: cuerpo, joroba, patitas y soporte (lo sólido)
    Prop_RenderboxCintiq_Pantalla  (hija) la cara de la pantalla (62 × 37 cm), con la UV `Dibujo` 0–1
                                   en su cara (TEXCOORD_1), como la del escritorio
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
import pintura as P  # noqa: E402
import props_taller as T  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_claro.blend')
PNG = os.path.join(REPO, 'Character', 'assets', 'props_claro.png')
GLB = os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_claro.glb')
TALLER_BLEND = os.path.join(REPO, 'Character', 'Estilo_taller.blend')
TALLER_PNG = os.path.join(REPO, 'Character', 'assets', 'props_taller.png')
NEON_JSON = os.path.join(AQUI, 'neon_open.json')  # node scripts/estilo/runas_neon.mjs OPEN
TAM = 2048
SEMILLA = 31
LETRERO = 'Prop_LetreroOpen'
CABLE = 'Prop_RenderboxCable'
NEONES = [f'{LETRERO}_Neon_Open_{i}' for i in range(4)]
CINTIQ = 'Prop_RenderboxCintiq'
CINTIQ_CUERPO = CINTIQ + '_Cuerpo'
CINTIQ_PANTALLA = CINTIQ + '_Pantalla'
PESOS = {LETRERO: 1.0, CABLE: 2.6, **{n: 0.05 for n in NEONES}, CINTIQ: 2.6, CINTIQ_CUERPO: 1.0, CINTIQ_PANTALLA: 0.25}

# La lámina del letrero: azul marino casi negro sobre óxido (detrás del neón magenta se lee de noche)
LAMINA_AZUL = {'oscura': '#11141f', 'base': '#1b2033', 'clara': '#2a3149', 'orilla': '#6b7491'}
TRANSFORMADOR_GRIS = {'oscuro': '#2b2f33', 'base': '#4a5056', 'claro': '#6c737b', 'orilla': '#aab2ba', 'oxido': '#5e3420'}

# ---------------------------------------------------------------- el letrero (metros)
ANCHO = 1.8                 # ancho de OPEN
BASE = 1.3                  # lo de abajo de las letras
# las letras en unidades de runa, como el ESTUDIO (hondo de la lámina, su pared, qué tan metidas van
# las filas, radios, cada cuánto una grapa, tolerancias, el tubo del contorno delante de la cara)
L = {'hondo': 1.6, 'pared': 0.07, 'metido': 0.25, 'r_fila': 0.085, 'r_marco': 0.07, 'grapa': 2.0, 'tol': 0.05,
     'tol_marco': 0.07, 'marco_atras': -0.06}
POSTES_X = (-0.72, 0.72)    # los dos postes (PTR de 3", 7.5 × 7.5 cm), detrás de la O y de la N
POSTE = 0.075
SOLERAS_Z = (1.42, 1.578, 1.895)  # el centro de cada solera: entre las tres cruzan todas las piezas (medido: la
#                                   de arriba cabe en el cuerpo de la P solo hasta 1.915 y en las gotas desde 1.88)
SOLERA = (0.05, 0.025)      # alto y hondo del PTR de las soleras
HOLGURA = 0.03              # de la espalda de las letras al frente de las soleras (lo que miden las ménsulas)
MENSULA = (0.022, 0.03)     # ancho y alto de una ménsula
DADO = (0.36, 0.06, -0.08)  # el dado de concreto: lado, lo de arriba (sale del piso) y lo de abajo
PLACA = (0.15, 0.008)       # placa base: lado y grueso
TAPA_POSTE = 0.005
CABLE_NEON_R = 0.005        # el cable de alta tensión y los puentes
GLAND_R = 0.009             # los pasacables de hule en la espalda de las letras

# ---------------------------------------------------------------- el cable de la Renderbox (marco de la Renderbox)
RB_ESPALDA = 0.25           # la cara de atrás de la Renderbox (+Y), medida en su malla
RB_PANEL = (-0.223, 0.223, 0.067, 0.558)   # lo plano de esa cara: x0, x1, z0, z1
RB_Z = -0.0011746           # el z de la Renderbox en su GLB (sus rodajas tocan el piso)
FUENTE = (0.10, 0.125, 0.15, 0.086)        # la placa de la fuente en la espalda: centro x, z, ancho, alto
TOMA_X = FUENTE[0] - 0.035  # el tomacorriente IEC, a la izquierda del switch visto desde atrás
CORDON_R = 0.005            # el cable (1 cm de diámetro)
SOBRE_PISO = 0.0025         # lo de abajo del cable tendido, sobre z = 0
REGISTRO = {'centro': (0.30, 2.62), 'lado': 0.30, 'pared': 0.04, 'arriba': 0.018, 'abajo': -0.06}
# el camino del cable en el piso (x, y): curvas flojas hacia atrás hasta la muesca del registro
CAMINO_PISO = [(0.085, 0.52), (0.125, 0.80), (0.215, 1.08), (0.27, 1.34), (0.19, 1.63), (0.175, 1.88), (0.255, 2.12),
               (0.30, 2.30), (0.30, 2.40)]

# ---------------------------------------------------------------- la Cintiq en el piso (marco de la Renderbox)
CINTIQ_LUGAR = (-1.06, -0.03, 15.0)   # el centro de su cuerpo en el piso (x, y) y su giro en grados: del lado -X,
#                                       el frente hacia el centro del claro y un poco hacia la Renderbox
CINTIQ_SEMILLA = 47        # su propio azar: armarla no le mueve el suyo a lo demás
LINK_R = 0.0042            # su cable (8.4 mm), de la familia del de corriente (CORDON_R)
PUERTO_CINTIQ_Z = 0.10     # el USB-C en su canto de la derecha (+X de la Cintiq), a lo alto de la pantalla
TARJETA = (-0.135, 0.215, 0.044, 0.13)   # la placa de la tarjeta de video en la espalda: centro x, z, ancho, alto
PUERTOS_Z = (0.035, 0.005, -0.025)       # sus tres DisplayPort (z sobre el centro de la placa); el cable va al de en medio
# el camino del cable en el piso (x, y): de la tarjeta cae hacia atrás, da la vuelta flojo y llega de lado al canto
CAMINO_CINTIQ = [(-0.15, 0.56), (-0.175, 0.665), (-0.26, 0.71), (-0.375, 0.665), (-0.435, 0.56), (-0.45, 0.43), (-0.475, 0.31),
                 (-0.52, 0.235), (-0.57, 0.205)]


# ---------------------------------------------------------------- ayudantes

def tubo_rmf(nombre, pts, radio, material, lados=6, tapas=True, uv_tramo=None):
    """Un tubo por `pts` con marcos que no se tuercen (transporte paralelo): el cable baja vertical y
    se acuesta sin que el anillo gire. Con `uv_tramo` (metros) lleva su UV en metros: tiras derechas
    (a lo largo y a la vuelta) cortadas cada `uv_tramo`, que caben en los huecos de un atlas ya hecho."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    tg = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    a = tg[0].cross(Vector((0, 0, 1)))
    if a.length < 1e-3:
        a = tg[0].cross(Vector((1, 0, 0)))
    marcos = [a.normalized()]
    for i in range(1, n):
        prev = marcos[-1]
        a = prev - tg[i] * prev.dot(tg[i])
        marcos.append(a.normalized() if a.length > 1e-6 else prev)
    bm = bmesh.new()
    anillos = []
    for i, p in enumerate(pts):
        a = marcos[i]
        b = tg[i].cross(a)
        r = radio[i] if isinstance(radio, (list, tuple)) else radio
        anillos.append([bm.verts.new(p + (a * math.cos(2 * math.pi * j / lados) + b * math.sin(2 * math.pi * j / lados)) * r) for j in range(lados)])
    caras = []
    for i in range(n - 1):
        for j in range(lados):
            k = (j + 1) % lados
            caras.append((i, j, bm.faces.new((anillos[i][j], anillos[i][k], anillos[i + 1][k], anillos[i + 1][j]))))
    if tapas:
        tapa0 = bm.faces.new(list(reversed(anillos[0])))
        tapa1 = bm.faces.new(anillos[-1])
    if uv_tramo:
        capa = bm.loops.layers.uv.new('UVMap')
        s = [0.0]
        for a, b in zip(pts, pts[1:]):
            s.append(s[-1] + (b - a).length)
        tira = [int(x / uv_tramo) for x in s]
        inicio = {}
        for i in range(n):
            inicio.setdefault(tira[i], s[i])
        origen = [inicio[t] for t in tira]           # dónde empieza la tira de la cara que sale de cada anillo
        vuelta = 2 * math.pi * radio / lados
        for i, j, f in caras:
            u0 = origen[i]
            for lp in f.loops:
                ii = i if lp.vert in anillos[i] else i + 1
                jj = anillos[ii].index(lp.vert)
                if jj == 0 and j == lados - 1:
                    jj = lados
                lp[capa].uv = (s[ii] - u0, jj * vuelta)
        if tapas:
            for tapa, sx in ((tapa0, -0.02), (tapa1, -0.04)):
                for lp in tapa.loops:
                    jj = (anillos[0] if tapa is tapa0 else anillos[-1]).index(lp.vert)
                    lp[capa].uv = (sx + radio * math.cos(2 * math.pi * jj / lados) * 0.9, radio * math.sin(2 * math.pi * jj / lados) * 0.9)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    o.data.polygons.foreach_set('use_smooth', np.ones(len(o.data.polygons), bool))
    return o


def redondear(pts, radio, pasos=5):
    """Una polilínea con las esquinas redondeadas (curva cuadrática de `radio` en cada esquina)."""
    pts = [Vector(p) for p in pts]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, p, b = pts[i - 1], pts[i], pts[i + 1]
        r = min(radio, (p - a).length * 0.45, (b - p).length * 0.45)
        if r < 1e-5:
            out.append(p)
            continue
        p0 = p + (a - p).normalized() * r
        p1 = p + (b - p).normalized() * r
        for k in range(pasos + 1):
            t = k / pasos
            out.append(p0 * (1 - t) ** 2 + p * 2 * t * (1 - t) + p1 * t * t)
    out.append(pts[-1])
    limpio = [out[0]]
    for q in out[1:]:
        if (q - limpio[-1]).length > 1e-5:
            limpio.append(q)
    return limpio


def bezier(p0, p1, p2, p3, n):
    return [p0 * (1 - t) ** 3 + p1 * 3 * t * (1 - t) ** 2 + p2 * 3 * t * t * (1 - t) + p3 * t ** 3
            for t in (k / n for k in range(n + 1))]


def catmull(pts, paso):
    """Catmull-Rom (uniforme) por puntos 2D, muestreado más o menos cada `paso` metros."""
    pts = [Vector(p) for p in pts]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        n = max(2, int((p2 - p1).length / paso))
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return out


def subcamino(pts, y0, y1, paso):
    """El pedazo del camino entre y0 e y1 (donde y crece a lo largo), muestreado cada `paso`."""
    largo = [0.0]
    for a, b in zip(pts, pts[1:]):
        largo.append(largo[-1] + (b - a).length)

    def en(s_):
        for k in range(len(pts) - 1):
            if largo[k + 1] >= s_:
                t = (s_ - largo[k]) / max(largo[k + 1] - largo[k], 1e-9)
                return pts[k].lerp(pts[k + 1], t)
        return pts[-1]

    def s_de(y):
        for k in range(len(pts) - 1):
            a, b = pts[k], pts[k + 1]
            if (a.y - y) * (b.y - y) <= 0 and abs(b.y - a.y) > 1e-9:
                return largo[k] + (largo[k + 1] - largo[k]) * (y - a.y) / (b.y - a.y)
        raise RuntimeError(f'el camino no pasa por y={y}')
    s0, s1 = s_de(y0), s_de(y1)
    n = max(2, int((s1 - s0) / paso))
    return [en(s0 + (s1 - s0) * k / n) for k in range(n + 1)]


def cortes(lazo, z):
    """Los tramos [x0, x1] de la línea horizontal z que quedan adentro de `lazo` (puntos 2D x, z)."""
    xs = []
    for a, b in zip(lazo, lazo[1:] + lazo[:1]):
        if (a.y > z) != (b.y > z):
            xs.append(a.x + (z - a.y) * (b.x - a.x) / (b.y - a.y))
    xs.sort()
    return list(zip(xs[0::2], xs[1::2]))


def dist_lazo(p, lazo):
    best = 1e9
    for a, b in zip(lazo, lazo[1:] + lazo[:1]):
        ab = b - a
        t = 0.0 if ab.length_squared < 1e-12 else max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        best = min(best, (p - (a + ab * t)).length)
    return best


def adentro(p, lazo, margen):
    return T.dentro_de(p, lazo) and dist_lazo(p, lazo) >= margen


def cartela(nombre, base, dir_, largo, alto, grueso, material):
    """Una cartela triangular (refuerzo de la placa base): en el plano vertical de `dir_`."""
    base, d = Vector(base), Vector(dir_).normalized()
    nrm = Vector((-d.y, d.x, 0.0))
    tri = [base, base + d * largo, base + Vector((0, 0, alto))]
    bm = bmesh.new()
    a = [bm.verts.new(p - nrm * grueso / 2) for p in tri]
    b = [bm.verts.new(p + nrm * grueso / 2) for p in tri]
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for k in range(3):
        m = (k + 1) % 3
        bm.faces.new((a[k], a[m], b[m], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def placa_con_hueco(nombre, ext, hueco, y0, y1, material):
    """Un marco plano (de y0 a y1) con el contorno `ext` y el hueco `hueco` (mismo número de puntos, x z)."""
    bm = bmesh.new()
    ef = [bm.verts.new((x, y1, z)) for x, z in ext]
    eb = [bm.verts.new((x, y0, z)) for x, z in ext]
    hf = [bm.verts.new((x, y1, z)) for x, z in hueco]
    hb = [bm.verts.new((x, y0, z)) for x, z in hueco]
    n = len(ext)
    for k in range(n):
        m = (k + 1) % n
        bm.faces.new((ef[k], ef[m], hf[m], hf[k]))
        bm.faces.new((eb[k], hb[k], hb[m], eb[m]))
        bm.faces.new((ef[k], eb[k], eb[m], ef[m]))
        bm.faces.new((hf[k], hf[m], hb[m], hb[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def prisma(nombre, perfil, y0, y1, material, bisel=0.0):
    """Un prisma de perfil (x, z) extruido de y0 a y1."""
    bm = bmesh.new()
    f = [bm.verts.new((x, y1, z)) for x, z in perfil]
    b = [bm.verts.new((x, y0, z)) for x, z in perfil]
    bm.faces.new(f)
    bm.faces.new(list(reversed(b)))
    n = len(perfil)
    for k in range(n):
        m = (k + 1) % n
        bm.faces.new((f[k], b[k], b[m], f[m]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    if bisel:
        P.biselar(o, bisel, 1)
    return o


def perfil_iec(ancho, alto, chaflan, dx=0.0, dz=0.0):
    """La forma del tomacorriente IEC (C14/C13): rectángulo con las esquinas de arriba cortadas."""
    w, h, c = ancho / 2, alto / 2, chaflan
    return [(dx - w, dz - h), (dx + w, dz - h), (dx + w, dz + h - c), (dx + w - c, dz + h), (dx - w + c, dz + h), (dx - w, dz + h - c)]


def anillo_amarre(nombre, x0, x1, y0, y1, z, radio, material, plano='z'):
    """Un cincho (amarre) que da la vuelta a un rectángulo: en el plano z (x0..x1, y0..y1) o en el
    plano x (con x0..x1 = y0..y1 e y0..y1 = z0..z1, en la x = `z`)."""
    c = 0.004
    esq = [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]
    if plano == 'z':
        pts = [Vector((a, b, z)) for a, b in esq]
        nrm = Vector((0, 0, 1))
    else:
        pts = [Vector((z, a, b)) for a, b in esq]
        nrm = Vector((1, 0, 0))
    return T.tubo_cerrado(nombre, pts, radio, material, lados=4, normal=nrm)


def arbol(objs):
    verts, caras = [], []
    for o in objs:
        base = len(verts)
        verts += [o.matrix_world @ v.co for v in o.data.vertices]
        caras += [[base + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, caras) if caras else None


def traspasos(A, B):
    ta, tb = arbol(A), arbol(B)
    return len(ta.overlap(tb)) if ta and tb else 0


def distancia(A, B):
    """Lo más cerca que llega un vértice de A a la superficie de B (y al revés)."""
    best = 1e9
    for X, Y in ((A, B), (B, A)):
        t = arbol(Y)
        for o in X:
            for v in o.data.vertices:
                hit = t.find_nearest(o.matrix_world @ v.co)
                if hit[0] is not None:
                    best = min(best, hit[3])
    return best


def materiales():
    return {
        'lamina': P.material_madera('Claro_Lamina', paleta=T.OXIDO, pintura=LAMINA_AZUL, desgaste=0.6, fino=0.6),
        'oxido': P.material_metal('Claro_Oxido', paleta=T.METAL_OXIDO, oxido=0.85),
        'fierro': P.material_metal('Claro_Fierro', paleta=T.ACERO, oxido=0.7),
        'acero': P.material_metal('Claro_Acero', paleta=T.ACERO, oxido=0.45),
        'transformador': P.material_metal('Claro_Transformador', paleta=TRANSFORMADOR_GRIS, oxido=0.35),
        'tapa': P.material_metal('Claro_TapaRegistro', paleta=T.ACERO, oxido=0.35),
        'lamina_negra': P.material_metal('Claro_LaminaNegra', paleta=T.LAMINA_NEGRA, oxido=0.0),
        'concreto': P.material_concreto('Claro_Concreto', musgo=0.15),
        'neon': P.material_brillo('Claro_NeonVidrio', '#d9d2dc'),
        'cable': P.material_liso('Claro_Cable', '#141417', claro='#2a2b31', oscuro='#08080a', orilla='#4c4e55'),
        'plastico': P.material_liso('Claro_Plastico', '#1c1d21', claro='#33353b', oscuro='#0e0f11', orilla='#666a72'),
        'goma': P.material_liso('Claro_Goma', '#19191c', claro='#2b2c31', oscuro='#0b0b0d', orilla='#4a4c52'),
    }


# ---------------------------------------------------------------- el letrero OPEN

def letrero(E):
    """Arma el letrero y lo mide. Regresa (lo fijo, las filas de cada letra)."""
    d = json.load(open(NEON_JSON, encoding='utf-8'))
    s = ANCHO / d['ancho']

    def a_m(x, y):
        return (x * s, BASE + (d['y1'] - y) * s)
    y_f = 0.0                                   # se centra al final
    hondo, pared = L['hondo'] * s, L['pared'] * s
    y_back = y_f + hondo                        # la espalda de las letras
    y_s0 = y_back + HOLGURA                     # el frente de las soleras
    y_s1 = y_s0 + SOLERA[1]
    yp = y_s1 + POSTE / 2                       # el eje de los postes
    y_i = y_back - pared                        # el fondo de la lámina por dentro
    r_fila = L['r_fila'] * s
    y_fila = y_f + L['metido'] * s
    G = {k: [] for k in ('letras', 'marcos', 'grapas', 'soportes', 'mensulas', 'soleras', 'postes', 'placas', 'dados',
                         'trafo', 'conduit', 'cables', 'glands', 'cinchos')}
    neones, piezas = [], []
    for i, letra in enumerate(d['letras']):
        lazos = [(T.simplificar_lazo([Vector(a_m(x, y)) for x, y in c['pts']], L['tol'] * s), c.get('hueco', False)) for c in letra['contornos']]
        caja = T.letra_bloque(f'letra_{i}', lazos, E['lamina'], y_f, hondo, pared)
        P.poner_veta(caja, 'Z')
        G['letras'].append(T.densa(caja, 1.8))
        exteriores = [pts for pts, hueco in lazos if not hueco]
        y_m = y_f + L['marco_atras'] * s
        for j, lazo in enumerate(letra['marco']):
            pts = T.simplificar_lazo([Vector(a_m(x, y)) for x, y in lazo], L['tol_marco'] * s)
            hueco = any(T.dentro_de(pts[0], e) for e in exteriores)
            pts = T.orientar(pts, not hueco)
            G['marcos'].append(T.tubo_cerrado(f'marco_{i}_{j}', [Vector((p.x, y_m, p.y)) for p in pts], L['r_marco'] * s, E['oxido']))
            G['grapas'].append(T.al_rincon(T.grapas(f'grapas_{i}_{j}', pts, y_m, L['r_marco'] * s, L['grapa'] * s, E['fierro']), 2))
        neon = T.al_rincon(T.filas_neon(NEONES[i], letra['filas'], a_m, y_fila, r_fila, 6, E['neon']), 1)
        neones.append(neon)
        # los soportes de tubo: de cada fila al fondo de la lámina (uno a la mitad, dos si es larga)
        bm = bmesh.new()
        n_sop = 0
        for x0, x1, yy in letra['filas']:
            (ax, az), (bx, _) = a_m(x0, yy), a_m(x1, yy)
            largo = bx - ax
            for t in ((0.5,) if largo < 0.2 else (0.25, 0.75)):
                x = ax + largo * t
                M = Matrix.Translation((x, (y_fila + r_fila * 0.5 + y_i + 0.001) / 2, az)) @ Matrix.Diagonal((0.0026, y_i + 0.001 - y_fila - r_fila * 0.5, 0.0026, 1))
                bmesh.ops.create_cube(bm, size=1.0, matrix=M)
                n_sop += 1
        G['soportes'].append(T.al_rincon(P.objeto(f'soportes_{i}', bm, E['fierro']), 2))
        for pts in exteriores:
            piezas.append({'letra': i, 'nombre': letra['letra'], 'lazo': pts, 'mensulas': []})
    fie, ace = E['fierro'], E['acero']
    # ---- ménsulas: donde una solera pasa detrás de una pieza (dos por pieza si caben, lo más separadas)
    mw, mh = MENSULA
    for pz in piezas:
        cand = []
        for zs in SOLERAS_Z:
            for x0, x1 in cortes(pz['lazo'], zs):
                w = x1 - x0
                if w < 0.04:
                    continue
                for t in ((0.5,) if w < 0.16 else (0.25, 0.75)):
                    x = x0 + w * t
                    esquinas = [Vector((x + sx * mw / 2, zs + sz * mh / 2)) for sx in (-1, 1) for sz in (-1, 1)]
                    if all(adentro(c, pz['lazo'], 0.004) for c in esquinas):
                        cand.append((x, zs))
        if not cand:
            raise RuntimeError(f'la pieza de la {pz["nombre"]} no tiene solera detrás: mover SOLERAS_Z')
        if len(cand) > 2:
            par = max(((a, b) for a in cand for b in cand if a != b), key=lambda ab: (Vector(ab[0]) - Vector(ab[1])).length)
            cand = list(par)
        for x, zs in cand:
            G['mensulas'].append(T.caja_ab('mensula', (x - mw / 2, y_back, zs - mh / 2), (x + mw / 2, y_s0, zs + mh / 2), fie))
            pz['mensulas'].append((x, zs))
    # ---- soleras sobre los dos postes, cada una hasta sus ménsulas más afuera
    for zs in SOLERAS_Z:
        xs_m = [x for pz in piezas for x, z in pz['mensulas'] if z == zs]
        sx0 = min(min(xs_m) - mw / 2, POSTES_X[0] - POSTE / 2) - 0.03
        sx1 = max(max(xs_m) + mw / 2, POSTES_X[1] + POSTE / 2) + 0.03
        G['soleras'].append(T.caja_ab(f'solera_{zs}', (sx0, y_s0, zs - SOLERA[0] / 2), (sx1, y_s1, zs + SOLERA[0] / 2), fie, bisel=0.003))
    # ---- postes, placas base, cartelas, anclas y dados
    zd = DADO[1]
    z_top = max(SOLERAS_Z) + SOLERA[0] / 2 + 0.015
    hp = PLACA[0] / 2
    for xp in POSTES_X:
        G['dados'].append(T.concreto(f'dado_{xp}', (xp - DADO[0] / 2, yp - DADO[0] / 2, DADO[2]), (xp + DADO[0] / 2, yp + DADO[0] / 2, zd), E['concreto'], chaflan=0.025))
        G['placas'].append(T.caja_ab(f'placa_{xp}', (xp - hp, yp - hp, zd), (xp + hp, yp + hp, zd + PLACA[1]), fie, bisel=0.002))
        zb = zd + PLACA[1]
        G['postes'].append(T.caja_ab(f'poste_{xp}', (xp - POSTE / 2, yp - POSTE / 2, zb), (xp + POSTE / 2, yp + POSTE / 2, z_top), fie, bisel=0.004))
        G['postes'].append(T.caja_ab(f'tapa_poste_{xp}', (xp - POSTE / 2 - 0.005, yp - POSTE / 2 - 0.005, z_top), (xp + POSTE / 2 + 0.005, yp + POSTE / 2 + 0.005, z_top + TAPA_POSTE), fie, bisel=0.0015))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            base = Vector((xp + dx * POSTE / 2, yp + dy * POSTE / 2, zb))
            G['placas'].append(cartela('cartela', base, (dx, dy, 0), hp - POSTE / 2, 0.085, 0.006, fie))
        for ax in (-1, 1):
            for ay in (-1, 1):
                c = (xp + ax * 0.056, yp + ay * 0.056)
                G['placas'].append(T.cilindro('tuerca', 0.009, 0.008, fie, lados=6, centro=(c[0], c[1], zb)))
                G['placas'].append(T.cilindro('ancla', 0.0055, 0.016, fie, lados=6, centro=(c[0], c[1], zb)))
    # ---- el transformador en el poste derecho (por detrás, a ~1 m), su conduit al dado
    xp = POSTES_X[1]
    yb_p = yp + POSTE / 2                       # la cara de atrás del poste
    tz0, tz1 = 0.85, 1.15
    ty0, ty1 = yb_p + 0.005, yb_p + 0.085
    G['trafo'].append(T.caja_ab('trafo_placa', (xp - 0.07, yb_p, 0.80), (xp + 0.07, ty0, 1.20), fie, bisel=0.0015))
    G['trafo'].append(T.caja_ab('transformador', (xp - 0.06, ty0, tz0), (xp + 0.06, ty1, tz1), E['transformador'], bisel=0.008))
    for z in (0.825, 1.175):
        for sx in (-1, 1):
            G['trafo'].append(T.cilindro('trafo_tornillo', 0.006, 0.004, fie, lados=6, centro=(xp + sx * 0.05, ty0, z), rot=(-math.pi / 2, 0, 0)))
    xc, yc_c, rc = xp + 0.025, ty1 - 0.017, 0.011
    G['conduit'].append(T.cilindro('conduit_conector', 0.016, 0.02, ace, lados=10, centro=(xc, yc_c, tz0 - 0.02)))
    G['conduit'].append(T.cilindro('conduit', rc, tz0 - 0.02 - 0.03, E['oxido'], lados=8, centro=(xc, yc_c, 0.03)))
    G['conduit'].append(T.cilindro('conduit_boquilla', 0.017, 0.012, ace, lados=10, centro=(xc, yc_c, zd)))
    za = 0.45
    G['conduit'].append(T.caja_ab('conduit_abrazadera', (xc - 0.01, yb_p, za - 0.012), (xc + 0.01, yc_c - rc, za + 0.012), fie))
    G['conduit'].append(T.tubo_cerrado('conduit_aro', [Vector((xc + math.cos(a) * (rc + 0.0016), yc_c + math.sin(a) * (rc + 0.0016), za)) for a in np.linspace(0, 2 * math.pi, 11)[:-1]],
                                       0.0016, fie, lados=4, normal=Vector((0, 0, 1))))
    # ---- el cable de alta tensión sube del transformador por el costado del poste hasta la N, y de
    # letra en letra van puentes amarrados bajo la solera de en medio
    z_mid = SOLERAS_Z[1]
    r = CABLE_NEON_R
    z_h = z_mid - SOLERA[0] / 2 - 0.003 - r     # colgado bajo la solera
    y_c = y_s0 + SOLERA[1] / 2
    x_lado = xp - POSTE / 2 - r - 0.0015        # pegado al costado del poste

    def gland(letra, x_meta):
        """Dónde va un pasacables en la espalda de una letra: adentro de una pieza, abajo de la solera de
        en medio (lejos de sus ménsulas y de las de abajo), lo más cerca de x_meta."""
        mejor = None
        for pz in (p for p in piezas if p['letra'] == letra):
            for z in np.arange(SOLERAS_Z[0] + MENSULA[1] / 2 + GLAND_R + 0.012, z_h - 0.004, 0.003):
                for x in np.arange(min(p.x for p in pz['lazo']), max(p.x for p in pz['lazo']), 0.004):
                    q = Vector((x, z))
                    if adentro(q, pz['lazo'], GLAND_R + 0.006):
                        costo = (x - x_meta) ** 2 + 0.3 * (z - z_h) ** 2
                        if mejor is None or costo < mejor[0]:
                            mejor = (costo, x, z)
        if mejor is None:
            raise RuntimeError(f'la letra {letra} no tiene dónde llevar su pasacables')
        return mejor[1], mejor[2]
    rango = {i: (min(p.x for pz in piezas if pz['letra'] == i for p in pz['lazo']), max(p.x for pz in piezas if pz['letra'] == i for p in pz['lazo'])) for i in range(4)}
    entra, sale = {}, {}
    entra[3] = gland(3, x_lado - 0.02)
    sale[3] = gland(3, rango[3][0] + 0.05)
    for i in (2, 1):
        entra[i] = gland(i, rango[i][1] - 0.05)
        sale[i] = gland(i, rango[i][0] + 0.05)
    entra[0] = gland(0, rango[0][1] - 0.06)
    glands = [entra[3], sale[3], entra[2], sale[2], entra[1], sale[1], entra[0]]
    for gx, gz in glands:
        G['glands'].append(T.al_rincon(T.cilindro('pasacables', GLAND_R, 0.012, E['plastico'], lados=8, centro=(gx, y_back - 0.0005, gz), rot=(-math.pi / 2, 0, 0)), 3))

    def a_letra(x, z):
        return [(x, y_back + 0.016, z), (x, y_back + 0.005, z)]
    ft = (xp - 0.04, yb_p + 0.045)
    G['cables'].append(T.cilindro('trafo_salida', 0.009, 0.015, ace, lados=8, centro=(ft[0], ft[1], tz1)))
    gx, gz = entra[3]
    gto = [(ft[0], ft[1], tz1 + 0.008), (ft[0], ft[1], 1.19), (x_lado, yp + 0.012, 1.27), (x_lado, yp + 0.012, z_h), (x_lado, y_c, z_h)]
    if abs(gx - x_lado) > 0.03:
        gto.append((gx + 0.025 * (1 if gx < x_lado else -1), y_c, z_h))
    gto += a_letra(gx, gz)
    gto = redondear(gto, 0.02)
    G['cables'].append(tubo_rmf('cable_alta', gto, r, E['cable'], lados=6))
    caminos = {}

    def en_gland(p):
        return min((punta_en_cilindro(p, r, (x, y_back - 0.0005, z), (0, 1, 0), 0.012, GLAND_R) for x, z in glands),
                   key=lambda t: t != 'adentro')
    caminos['cable alto'] = (f"en la salida del transformador: {punta_en_cilindro(gto[0], r, (ft[0], ft[1], tz1), (0, 0, 1), 0.015, 0.009)}",
                             f'en el pasacables de la N: {en_gland(gto[-1])}')
    # los puentes: de la salida de una letra a la entrada de la siguiente (a la izquierda)
    tramos = [(sale[3], entra[2]), (sale[2], entra[1]), (sale[1], entra[0])]
    for k, ((xa, za_), (xb, zb_)) in enumerate(tramos):
        camino = list(reversed(a_letra(xa, za_))) + [(xa - 0.025, y_c, z_h), (xb + 0.025, y_c, z_h)] + a_letra(xb, zb_)
        camino = redondear(camino, 0.016)
        G['cables'].append(tubo_rmf(f'puente_{k}', camino, r, E['cable'], lados=6))
        caminos[f'puente {"NEPO"[k]}-{"NEPO"[k + 1]}'] = (f'en el pasacables: {en_gland(camino[0])}', f'en el pasacables: {en_gland(camino[-1])}')
    # cinchos: el cable alto al poste, y los puentes a la solera (lejos de ménsulas y postes)
    for z in (1.30, 1.48):
        G['cinchos'].append(anillo_amarre('cincho_poste', x_lado - r - 0.0022, xp + POSTE / 2 + 0.0022, yp - POSTE / 2 - 0.0022, yp + POSTE / 2 + 0.0022, z, 0.0018, E['plastico']))
    libres = []
    for (xa, _), (xb, _) in tramos + [((x_lado, 0), (entra[3][0], 0))]:
        lo, hi = min(xa, xb) + 0.06, max(xa, xb) - 0.06
        n = max(1, int((hi - lo) / 0.22))
        for t in np.linspace(0, 1, n + 2)[1:-1] if hi > lo else []:
            libres.append(lo + (hi - lo) * t)
    obst = [x for pz in piezas for x, zs in pz['mensulas'] if zs == z_mid] + list(POSTES_X)
    for x in libres:
        while any(abs(x - o) < 0.035 for o in obst):
            x += 0.01
        G['cinchos'].append(anillo_amarre('cincho_solera', y_s0 - 0.0022, y_s1 + 0.0022, z_h - r - 0.0022, z_mid + SOLERA[0] / 2 + 0.0022, x, 0.0018,
                                          E['plastico'], plano='x'))
    for o in G['cinchos']:
        T.al_rincon(o, 3)
    revisar_letrero(G, neones, piezas, y_back, y_s0, y_s1, zd, caminos)
    fijos = [o for k in G for o in G[k]]
    print(f'  letrero: {d["ancho"] * s:.3f} m de ancho, letras de {BASE:.3f} a {BASE + (d["y1"] - d["y0"]) * s:.3f} m, '
          f'lámina de {hondo * 100:.1f} cm de hondo, {sum(len(l["filas"]) for l in d["letras"])} filas, postes hasta {z_top + TAPA_POSTE:.3f} m')
    return fijos, neones


def revisar_letrero(G, neones, piezas, y_back, y_s0, y_s1, zd, caminos):
    """Que todo se sostenga y esté conectado: cada pieza de cada letra con sus ménsulas a una solera,
    las soleras en los dos postes, los postes en su placa y su dado, el transformador en el poste, el
    conduit entrando al dado, los cables de punta a punta, y nada atravesando lo que no debe."""
    print('  revisar letrero (juntas: hueco entre las cajas en mm y área de contacto en cm²):')
    for pz in piezas:
        print(f'    pieza de la {pz["nombre"]}: {len(pz["mensulas"])} ménsula(s) en ' +
              ', '.join(f'x={x:+.3f} z={z:.3f}' for x, z in pz['mensulas']) + ' (la cara de la ménsula, adentro de la pieza a ≥ 4 mm de su orilla)')

    def de(m):
        return sum((m.matrix_world @ v.co).z for v in m.data.vertices) / len(m.data.vertices)
    for zs, sol in zip(SOLERAS_Z, G['soleras']):
        j = [junta(sol, p) for p in G['postes'][0::2]]
        ms = [m for m in G['mensulas'] if abs(de(m) - zs) < 0.01]
        jm = [junta(m, sol) for m in ms]
        print(f'    solera z={zs:.3f}: postes {fmt(j[0])} y {fmt(j[1])}; sus {len(ms)} ménsulas: peor hueco {max(g for g, _ in jm) * 1000:.2f} mm, '
              f'menor contacto {min(a_ for _, a_ in jm) * 1e4:.1f} cm²')
    ym = [min((m.matrix_world @ v.co).y for v in m.data.vertices) for m in G['mensulas']]
    print(f'    ménsulas contra la espalda de las letras (y={y_back:.4f}): de {min(ym) - y_back:+.5f} a {max(ym) - y_back:+.5f} m')
    for k, xp in enumerate(POSTES_X):
        poste = G['postes'][2 * k]
        placa = next(o for o in G['placas'] if o.name.startswith(f'placa_{xp}'))
        print(f'    poste x={xp:+.2f}: en su placa {fmt(junta(poste, placa))}, placa en el dado {fmt(junta(placa, G["dados"][k]))}, '
              f'tapa {fmt(junta(G["postes"][2 * k + 1], poste))}')
    trafo_placa, trafo = G['trafo'][0], G['trafo'][1]
    print(f'    transformador: placa en el poste {fmt(junta(trafo_placa, G["postes"][2]))}, caja en la placa {fmt(junta(trafo, trafo_placa))}')
    con = {o.name.split('.')[0]: o for o in G['conduit']}
    zmin = min((con['conduit'].matrix_world @ v.co).z for v in con['conduit'].data.vertices)
    print(f'    conduit: conector en la caja {fmt(junta(con["conduit_conector"], trafo))}, conduit en el conector {fmt(junta(con["conduit"], con["conduit_conector"]))}, '
          f'abajo en z={zmin:.3f} (el dado sale hasta z={zd:.3f}: {"adentro del dado" if zmin < zd else "AFUERA"}), '
          f'abrazadera en el poste {fmt(junta(con["conduit_abrazadera"], G["postes"][2]))} y en el conduit {fmt(junta(con["conduit_abrazadera"], con["conduit"]))}')
    cab = {o.name.split('.')[0]: o for o in G['cables']}
    print(f'    salida del transformador en la caja {fmt(junta(cab["trafo_salida"], trafo))}')
    for nombre, (inicio, fin) in caminos.items():
        print(f'    {nombre}: empieza {inicio}, acaba {fin}')
    print(f'    pasacables metidos en la espalda de las letras: {min(min((g.matrix_world @ v.co).y for v in g.data.vertices) for g in G["glands"]) - y_back:+.4f} m')
    print(f'    soportes de las filas: traspasos con el neón {traspasos(G["soportes"], neones)} y con el fondo de la lámina {traspasos(G["soportes"], G["letras"])} (los dos > 0: se tocan)')
    cables = [o for o in G['cables'] if not o.name.startswith('trafo_salida')]
    pares = [
        ('cables', cables, 'postes, soleras, ménsulas, letras, transformador y su placa', G['postes'] + G['soleras'] + G['mensulas'] + G['letras'] + G['trafo']),
        ('cables', cables, 'placas, cartelas, dados y conduit', G['placas'] + G['dados'] + G['conduit']),
        ('cinchos', G['cinchos'], 'postes, soleras y cables (abrazan con 0.4 mm de holgura)', G['postes'] + G['soleras'] + cables),
        ('neón', neones, 'letras, tubos oxidados, grapas y ménsulas', G['letras'] + G['marcos'] + G['grapas'] + G['mensulas']),
        ('soleras', G['soleras'], 'letras', G['letras']),
        ('postes', G['postes'], 'letras, ménsulas', G['letras'] + G['mensulas']),
        ('conduit', G['conduit'], 'placa base, cartelas, anclas', G['placas']),
        ('cinchos', G['cinchos'], 'ménsulas y letras', G['mensulas'] + G['letras']),
        ('pasacables', G['glands'], 'ménsulas y soleras', G['mensulas'] + G['soleras']),
    ]
    for na, A, nb, B in pares:
        print(f'    traspasos {na} contra {nb}: {traspasos(A, B)}')
    zmin = min((o.matrix_world @ v.co).z for k in G for o in G[k] if k != 'dados' for v in o.data.vertices)
    print(f'    lo más bajo que no es dado: z={zmin:.4f} (la punta del conduit, adentro del dado)')


def junta(a, b):
    """Para piezas de caja: el hueco entre sus cajas (negativo = se meten) y el área donde se tocan."""
    def caja(o):
        co = np.array([(o.matrix_world @ v.co)[:] for v in o.data.vertices])
        return co.min(0), co.max(0)
    (la, ha), (lb, hb) = caja(a), caja(b)
    hueco = np.maximum(la - hb, lb - ha)
    k = int(np.argmax(hueco))
    otros = [i for i in range(3) if i != k]
    area = float(np.prod([max(0.0, min(ha[i], hb[i]) - max(la[i], lb[i])) for i in otros]))
    return float(hueco[k]), area


def fmt(j):
    return f'{j[0] * 1000:+.2f} mm / {j[1] * 1e4:.1f} cm²'


def punta_en_cilindro(p, r, base, eje, largo, radio):
    """Si la punta de un cable (centro `p`, radio `r`) queda adentro de un cilindro."""
    p, base, eje = Vector(p), Vector(base), Vector(eje).normalized()
    t = (p - base).dot(eje)
    lejos = (p - base - eje * t).length
    return 'adentro' if 0 <= t <= largo and lejos + r <= radio + 1e-6 else f'AFUERA (t={t:.4f}, a {lejos:.4f} del eje)'


# ---------------------------------------------------------------- el cable de la Renderbox

def camino_cable(y_boquilla):
    """El camino del cable, en el marco de la Renderbox: de la boquilla de la clavija (que acaba en
    `y_boquilla`) baja al piso, se tiende con curvas flojas hacia atrás y entra por la muesca del registro."""
    zc = CORDON_R + SOBRE_PISO
    cx, cy = REGISTRO['centro']
    p0 = Vector((TOMA_X, y_boquilla - 0.008, FUENTE[1]))
    x3, y3 = CAMINO_PISO[0]
    p3 = Vector((x3, y3, zc))
    caida = bezier(p0, p0 + Vector((0, 0.085, 0)), p3 - Vector((0, 0.13, 0)), p3, 22)
    piso = [Vector((q.x, q.y, zc)) for q in catmull([Vector(c) for c in CAMINO_PISO], 0.02)]
    yo, yi = cy - REGISTRO['lado'] / 2, cy - REGISTRO['lado'] / 2 + REGISTRO['pared']
    entra = redondear([(cx, CAMINO_PISO[-1][1], zc), (cx, yo, zc), (cx, yi, zc - 0.012), (cx, yi + 0.03, -0.04), (cx, yi + 0.04, -0.07)], 0.025, pasos=6)
    pts = caida + piso[1:] + [Vector(q) for q in entra[1:]]
    return T.simplificar(pts, 0.0008)


def cable_renderbox(E):
    """La placa de la fuente con su tomacorriente IEC y el switch en la espalda de la Renderbox, la
    clavija metida, el cable y el registro con su tapa. Regresa el objeto unido."""
    piezas = {k: [] for k in ('fuente', 'clavija', 'cable', 'registro')}
    lam, pla = E['lamina_negra'], E['plastico']
    fx, fz, fw, fh = FUENTE
    y0 = RB_ESPALDA + 0.0002                   # la placa se asienta en la espalda (2 décimas de holgura)
    y1 = y0 + 0.003
    piezas['fuente'].append(T.caja_ab('fuente_placa', (fx - fw / 2, y0, fz - fh / 2), (fx + fw / 2, y1, fz + fh / 2), lam, bisel=0.0012))
    for sx in (-1, 1):
        for sz in (-1, 1):
            piezas['fuente'].append(T.cilindro('fuente_tornillo', 0.0032, 0.0018, lam, lados=6, centro=(fx + sx * (fw / 2 - 0.007), y1, fz + sz * (fh / 2 - 0.007)), rot=(-math.pi / 2, 0, 0)))
    for k in range(5):   # la rejilla de la fuente
        z = fz - 0.025 + k * 0.0125
        piezas['fuente'].append(T.caja_ab('fuente_rejilla', (fx + 0.022, y1, z - 0.0022), (fx + 0.064, y1 + 0.0012, z + 0.0022), E['goma']))
    # el tomacorriente IEC C14: marco con su hueco
    y2 = y1 + 0.004
    hueco = perfil_iec(0.0245, 0.0185, 0.0048, TOMA_X, fz)
    piezas['fuente'].append(placa_con_hueco('toma', perfil_iec(0.031, 0.025, 0.007, TOMA_X, fz), hueco, y1, y2, pla))
    # el switch
    piezas['fuente'].append(T.caja_ab('switch_marco', (fx + 0.001, y1, fz - 0.012), (fx + 0.017, y1 + 0.0035, fz + 0.012), pla, bisel=0.001))
    piezas['fuente'].append(T.caja_ab('switch', (fx + 0.003, y1 + 0.0035, fz - 0.009), (fx + 0.015, y1 + 0.0065, fz + 0.009), E['goma'], bisel=0.001))
    # la clavija C13: la nariz metida en el hueco, el cuerpo y la boquilla de hule
    nariz = perfil_iec(0.0245 - 0.0008, 0.0185 - 0.0008, 0.0046, TOMA_X, fz)
    piezas['clavija'].append(prisma('clavija_nariz', nariz, y1, y2, pla))
    yb1 = y2 + 0.034
    piezas['clavija'].append(T.caja_ab('clavija_cuerpo', (TOMA_X - 0.0145, y2, fz - 0.0115), (TOMA_X + 0.0145, yb1, fz + 0.0115), pla, bisel=0.0035, segmentos=2))
    piezas['clavija'].append(T.cilindro('clavija_boquilla', 0.0085, 0.026, E['goma'], lados=8, radio2=0.006, centro=(TOMA_X, yb1 - 0.001, fz), rot=(-math.pi / 2, 0, 0)))
    Y_BOQUILLA[0] = yb1 - 0.001
    pts = camino_cable(yb1 - 0.001 + 0.026)
    piezas['cable'].append(tubo_rmf('cordon', pts, CORDON_R, E['cable'], lados=6))
    # el registro: brocal de concreto con la muesca, contramarco de ángulo, tapa de lámina y el pasacables
    cx, cy = REGISTRO['centro']
    h, e = REGISTRO['lado'] / 2, REGISTRO['pared']
    za, zb = REGISTRO['arriba'], REGISTRO['abajo']
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
    piezas['registro'].append(brocal)
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
        piezas['registro'].append(T.caja_ab('registro_angulo', a, b, E['fierro']))
        piezas['registro'].append(T.caja_ab('registro_ala', a2, b2, E['fierro']))
    lt = ce - 0.0028 - 0.0012
    piezas['registro'].append(T.caja_ab('registro_tapa', (cx - lt, cy - lt, 0.012), (cx + lt, cy + lt, za), E['tapa'], bisel=0.0015))
    for sy in (-1, 1):
        piezas['registro'].append(T.caja_ab('registro_jaladera', (cx - 0.016, cy + sy * 0.07 - 0.004, za), (cx + 0.016, cy + sy * 0.07 + 0.004, za + 0.0025), E['fierro'], bisel=0.0008))
    # el pasacables: la parte del cable que pasa por la pared, un poco más gorda
    yo, yi = cy - h, cy - h + e
    tramo = subcamino(pts, yo - 0.008, yi + 0.006, 0.004)
    piezas['registro'].append(tubo_rmf('registro_pasacables', tramo, 0.0088, E['goma'], lados=8))
    revisar_cable(piezas, pts)
    todas = [o for k in piezas for o in piezas[k]]
    return T.unir(todas, CABLE), pts


def malla_renderbox():
    """La malla de Prop_Estudio_Computadora (de Estilo_taller.blend) en un objeto temporal, en su marco.
    Regresa el objeto y una función que lo borra con todo lo que trajo (materiales, imágenes)."""
    antes = {k: set(getattr(bpy.data, k).keys()) for k in ('materials', 'images', 'node_groups', 'meshes')}
    with bpy.data.libraries.load(TALLER_BLEND, link=False) as (src, dst):
        dst.meshes = ['Prop_Estudio_Computadora']
    me = dst.meshes[0]
    o = bpy.data.objects.new('_renderbox_medir', me)
    bpy.context.scene.collection.objects.link(o)

    def borrar():
        bpy.data.objects.remove(o)
        for k in ('meshes', 'materials', 'images', 'node_groups'):
            col = getattr(bpy.data, k)
            for n in set(col.keys()) - antes[k]:
                col.remove(col[n])
    return o, borrar


def revisar_cable(piezas, pts):
    print('  revisar cable:')
    rb, borrar = malla_renderbox()
    co = np.array([v.co[:] for v in rb.data.vertices])
    print(f'    Renderbox: espalda en y={co[:, 1].max():.4f}, piso de sus rodajas z={co[:, 2].min():.4f} (en su GLB va a z={RB_Z:.5f})')
    todo = [o for k in piezas for o in piezas[k]]
    print(f'    traspasos con la Renderbox: {traspasos(todo, [rb])}')
    print(f'    placa de la fuente a la espalda: {distancia(piezas["fuente"][:1], [rb]) * 1000:.2f} mm')
    ys = [(o.matrix_world @ v.co).y for o in todo for v in o.data.vertices]
    print(f'    lo más cerca de la Renderbox: y={min(ys):.4f} (su espalda: {RB_ESPALDA})')
    clav = {o.name.split('.')[0]: o for o in piezas['clavija']}
    fue = {o.name.split('.')[0]: o for o in piezas['fuente']}
    print(f'    nariz de la clavija a la placa (metida en el hueco): {distancia([clav["clavija_nariz"]], [fue["fuente_placa"]]) * 1000:.2f} mm, '
          f'traspasos nariz contra el marco del tomacorriente: {traspasos([clav["clavija_nariz"]], [fue["toma"]])}')
    print(f'    cuerpo de la clavija al tomacorriente: {distancia([clav["clavija_cuerpo"]], [fue["toma"]]) * 1000:.2f} mm, '
          f'el cable empieza en la boquilla: {punta_en_cilindro(pts[0], CORDON_R, (TOMA_X, Y_BOQUILLA[0], FUENTE[1]), (0, 1, 0), 0.026, 0.0062)}')
    cx, cy = REGISTRO['centro']
    yo = cy - REGISTRO['lado'] / 2
    afuera = [p for p in pts if p.y < yo]
    zmin = min(p.z for p in afuera) - CORDON_R
    print(f'    el cable afuera del registro: lo más bajo z={zmin:.4f}; tendido en el piso de y={CAMINO_PISO[0][1]:.2f} a y={yo:.2f} '
          f'({sum((b - a).length for a, b in zip(afuera, afuera[1:]) if a.z < 0.02):.2f} m de cable en el piso), total {sum((b - a).length for a, b in zip(pts, pts[1:])):.2f} m')
    reg = {o.name.split('.')[0]: o for o in piezas['registro']}
    print(f'    traspasos cable contra el brocal: {traspasos(piezas["cable"], [reg["registro_brocal"]])}, pasacables contra el brocal: '
          f'{traspasos([reg["registro_pasacables"]], [reg["registro_brocal"]])}, cable contra tapa y ángulos: '
          f'{traspasos(piezas["cable"] + [reg["registro_pasacables"]], [o for o in piezas["registro"] if o.name.startswith(("registro_tapa", "registro_angulo", "registro_ala"))])}')
    print(f'    tapa sobre las alas del ángulo: {distancia([reg["registro_tapa"]], [o for o in piezas["registro"] if o.name.startswith("registro_ala")]) * 1000:.2f} mm, '
          f'brocal: arriba z={REGISTRO["arriba"]:.3f}, abajo z={REGISTRO["abajo"]:.3f}')
    zr = min((o.matrix_world @ v.co).z for o in piezas['fuente'] + piezas['clavija'] for v in o.data.vertices)
    print(f'    la clavija y la placa: lo más bajo z={zr:.3f}')
    borrar()


Y_BOQUILLA = [0.0]   # donde empieza la boquilla de la clavija (para medir)


# ---------------------------------------------------------------- la Cintiq en el piso

def materiales_cintiq():
    """Los de la Cintiq, con los de su escritorio (props_taller.materiales) y, para el cable, sus
    conectores y la tarjeta, los del cable de corriente: nombres propios, así agregarla a un .blend ya
    pintado no toca los materiales de lo demás."""
    return {
        'plastico': P.material_liso('Claro_Cintiq_Plastico', '#1e1f23', claro='#34363c', oscuro='#0f1012', orilla='#6a6e76'),
        'goma': P.material_liso('Claro_Cintiq_Goma', '#151518', claro='#26272c', oscuro='#0a0a0c', orilla='#46484e'),
        'aluminio': P.material_metal('Claro_Cintiq_Aluminio', paleta={'oscuro': '#3c4148', 'base': '#5e646d', 'claro': '#8a919b',
                                                                       'orilla': '#d2d8de', 'oxido': '#5e646d'}, oxido=0.0),
        'pantalla': P.material_brillo('Claro_Cintiq_Pantalla', '#2a3341'),
        'cable': P.material_liso('Claro_Cintiq_Cable', '#141417', claro='#2a2b31', oscuro='#08080a', orilla='#4c4e55'),
        'conector': P.material_liso('Claro_Cintiq_Conector', '#1c1d21', claro='#33353b', oscuro='#0e0f11', orilla='#666a72'),
        'boquilla': P.material_liso('Claro_Cintiq_Boquilla', '#19191c', claro='#2b2c31', oscuro='#0b0b0d', orilla='#4a4c52'),
        'lamina_negra': P.material_metal('Claro_Cintiq_LaminaNegra', paleta=T.LAMINA_NEGRA, oxido=0.0),
    }


def camino_cintiq(p_rb, p_ci, sale_ci):
    """El camino del cable: de la boquilla del DisplayPort (`p_rb`, sale hacia +Y) cae al piso, se
    tiende por CAMINO_CINTIQ y sube a la boquilla del USB-C (`p_ci`, que sale hacia `sale_ci`)."""
    zc = LINK_R + SOBRE_PISO
    piso = [Vector((q.x, q.y, zc)) for q in catmull([Vector(c) for c in CAMINO_CINTIQ], 0.02)]
    d0 = (piso[1] - piso[0]).normalized()
    d1 = (piso[-1] - piso[-2]).normalized()
    cae = bezier(p_rb, p_rb + Vector((0, 0.09, 0)), piso[0] - d0 * 0.11, piso[0], 22)
    sube = bezier(piso[-1], piso[-1] + d1 * 0.07, p_ci + sale_ci * 0.10, p_ci, 18)
    return T.simplificar(cae + piso[1:-1] + sube, 0.0006)


def cintiq_piso(corriente):
    """La Cintiq parada en el piso con su pluma y su cable a la Renderbox (en el marco de la Renderbox).
    `corriente` es Prop_RenderboxCable (para medir que no se crucen). Regresa (raíz, cuerpo, pantalla)."""
    estado = random.getstate()
    random.seed(CINTIQ_SEMILLA)
    M = materiales_cintiq()
    C = T.CINTIQ
    W = C['ancho']
    cx, cy, giro = CINTIQ_LUGAR
    lugar = Matrix.Translation((cx, cy, 0.0)) @ Matrix.Rotation(math.radians(giro), 4, 'Z') @ \
        Matrix.Translation((-C['centro'][0], -C['centro'][1], 0.0))
    # la del escritorio con la cubierta en z = 0: sus patitas y la barra del soporte quedan en el piso
    piezas = T.en_marco(T.cintiq(M, 0.0), lugar)
    pantalla = T.en_marco([T.cintiq_pantalla(M, 0.0)], lugar)[0]
    pluma = [o for o in piezas if o.name.startswith('pluma')]
    cuerpo = [o for o in piezas if o not in pluma]
    asentar_patitas(cuerpo)
    # la pluma descansa en lo más gordo (el agarre de hule): en la cubierta el agarre se metía 0.6 mm
    zp = min((o.matrix_world @ v.co).z for o in pluma for v in o.data.vertices)
    T.en_marco(pluma, Matrix.Translation((0, 0, -zp)))
    # el marco de la Cintiq: x a lo ancho, z a lo alto de la pantalla, la pantalla hacia -Y, centro del cuerpo
    Mc = lugar @ T._marco_cintiq(0.0)
    con = {}
    # ---- el USB-C en el canto: el cuerpo del conector pegado al canto (dentro de lo plano entre los
    # biseles) y la boquilla de hule hacia afuera
    xs = W / 2 + 0.0002
    zc_ = PUERTO_CINTIQ_Z
    con['usb_cuerpo'] = T.caja_ab('usb_cuerpo', (xs, -0.0034, zc_ - 0.006), (xs + 0.021, 0.0034, zc_ + 0.006), M['conector'], bisel=0.0018, segmentos=2)
    con['usb_boquilla'] = T.cilindro('usb_boquilla', 0.0052, 0.016, M['boquilla'], lados=8, radio2=LINK_R + 0.0006,
                                     centro=(xs + 0.020, 0.0, zc_), rot=(0, math.pi / 2, 0))
    T.en_marco([con['usb_cuerpo'], con['usb_boquilla']], Mc)
    p_ci = Mc @ Vector((xs + 0.036 - 0.006, 0.0, zc_))
    sale_ci = (Mc.to_3x3() @ Vector((1, 0, 0))).normalized()
    # ---- la placa de la tarjeta de video en la espalda de la Renderbox: tres DisplayPort y la rejilla
    tx, tz, tw, th = TARJETA
    y0 = RB_ESPALDA + 0.0002
    y1 = y0 + 0.002
    lam = M['lamina_negra']
    tarjeta = [T.caja_ab('tarjeta_placa', (tx - tw / 2, y0, tz - th / 2), (tx + tw / 2, y1, tz + th / 2), lam, bisel=0.0008)]
    for sx in (-1, 1):
        tarjeta.append(T.cilindro('tarjeta_tornillo', 0.0032, 0.0018, lam, lados=6, centro=(tx + sx * (tw / 2 - 0.0055), y1, tz + th / 2 - 0.0065),
                                  rot=(-math.pi / 2, 0, 0)))
    for k in range(8):
        z = tz - th / 2 + 0.014 + k * 0.0125
        tarjeta.append(T.caja_ab('tarjeta_rejilla', (tx + 0.005, y1, z - 0.0018), (tx + 0.018, y1 + 0.0008, z + 0.0018), M['boquilla']))
    xp = tx - 0.0085
    y2 = y1 + 0.0018
    for dz in PUERTOS_Z:
        tarjeta.append(placa_con_hueco('puerto', perfil_iec(0.0195, 0.0085, 0.0024, xp, tz + dz), perfil_iec(0.0165, 0.0055, 0.0014, xp, tz + dz),
                                       y1, y2, M['conector']))
    # ---- el DisplayPort metido en el de en medio
    pz = tz + PUERTOS_Z[1]
    con['dp_nariz'] = prisma('dp_nariz', perfil_iec(0.0165 - 0.0008, 0.0055 - 0.0008, 0.0012, xp, pz), y1, y2, M['conector'])
    yb1 = y2 + 0.026
    con['dp_cuerpo'] = T.caja_ab('dp_cuerpo', (xp - 0.0105, y2, pz - 0.0048), (xp + 0.0105, yb1, pz + 0.0048), M['conector'], bisel=0.0025, segmentos=2)
    con['dp_boquilla'] = T.cilindro('dp_boquilla', 0.006, 0.018, M['boquilla'], lados=8, radio2=LINK_R + 0.0006,
                                    centro=(xp, yb1 - 0.001, pz), rot=(-math.pi / 2, 0, 0))
    p_rb = Vector((xp, yb1 - 0.001 + 0.018 - 0.006, pz))
    pts = camino_cintiq(p_rb, p_ci, sale_ci)
    cable = tubo_rmf('cintiq_cable', pts, LINK_R, M['cable'], lados=6, uv_tramo=0.22)
    random.setstate(estado)
    medidas = {'pts': pts, 'p_rb': p_rb, 'p_ci': p_ci, 'sale_ci': sale_ci, 'boquillas': ((xp, yb1 - 0.001, pz), Mc)}
    revisar_cintiq(cuerpo, pantalla, pluma, con, tarjeta, cable, corriente, medidas)
    raiz = T.unir([cable] + list(con.values()) + tarjeta + pluma, CINTIQ)
    cuerpo_o = T.unir(cuerpo, CINTIQ_CUERPO, padre=raiz)
    pantalla_o = T.unir([pantalla], CINTIQ_PANTALLA, padre=raiz)
    return raiz, cuerpo_o, pantalla_o


def asentar_patitas(cuerpo):
    """Las patitas de hule hasta el cuerpo: con el bisel, la orilla de abajo del cuerpo queda 1.7 mm arriba
    de ellas (en el escritorio también) y la Cintiq flotaba de enfrente. Sube la cara de arriba de cada
    patita lo que mide el rayo más corto hacia el cuerpo, más 0.2 mm para que se toquen."""
    caja = next(o for o in cuerpo if o.name.startswith('cin_cuerpo'))
    arbol_c = arbol([caja])
    for o in (p for p in cuerpo if p.name.startswith('cin_patita')):
        co = np.array([v.co[:] for v in o.data.vertices])
        lo, hi = co.min(0), co.max(0)
        hueco = min((arbol_c.ray_cast(Vector((x, y, hi[2] - 1e-4)), Vector((0, 0, 1)))[3] or 1.0)
                    for x in np.linspace(lo[0], hi[0], 9) for y in np.linspace(lo[1], hi[1], 9))
        sube = hueco - 1e-4 + 0.0002
        arriba = [v for v in o.data.vertices if v.co.z > hi[2] - 0.004]
        for v in arriba:
            v.co.z += sube
        print(f'    {o.name}: subida {sube * 1000:.2f} mm hasta el cuerpo')


def huella_cintiq(cuerpo):
    """La huella del cuerpo de la Cintiq en el piso: centro (x, y) de su caja y el radio que lo encierra."""
    co = np.array([(o.matrix_world @ v.co)[:2] for o in cuerpo for v in o.data.vertices])
    c = (co.min(0) + co.max(0)) / 2
    return c, float(np.linalg.norm(co - c, axis=1).max()), co


def revisar_cintiq(cuerpo, pantalla, pluma, con, tarjeta, cable, corriente, m):
    print('  revisar Cintiq:')
    rb, borrar = malla_renderbox()
    ci = cuerpo + [pantalla]

    def zmin(objs):
        return min((o.matrix_world @ v.co).z for o in objs for v in o.data.vertices)
    for nombre in ('cin_patita', 'cin_barra', 'cin_pata', 'cin_cuerpo'):
        ps = [o for o in cuerpo if o.name.startswith(nombre)]
        print(f'    {nombre}: lo más bajo z={zmin(ps):+.4f}')
    print(f'    pluma: lo más bajo z={zmin(pluma):+.5f} (acostada en el piso), Cintiq entera: z={zmin(ci + pluma):+.5f}')

    def de(nombre):
        return [o for o in cuerpo if o.name.startswith(nombre)]
    print(f'    se tocan (traspasos > 0): patitas con el cuerpo {traspasos(de("cin_patita"), de("cin_cuerpo"))}, patas del soporte con la '
          f'joroba {traspasos(de("cin_pata"), de("cin_joroba"))} y con la barra {traspasos(de("cin_pata"), de("cin_barra"))}')
    c, r, co = huella_cintiq(cuerpo)
    # el piso entre las dos: de cada vértice (cuerpo, pantalla, pluma y el USB-C de su canto) a la caja de la Renderbox
    rbx, rby = 0.237, 0.25

    def a_caja(p):
        return math.hypot(max(abs(p[0]) - rbx, 0.0), max(abs(p[1]) - rby, 0.0))
    todo_ci = np.array([(o.matrix_world @ v.co)[:2] for o in ci + pluma + [con['usb_cuerpo'], con['usb_boquilla']] for v in o.data.vertices])
    atras = [a_caja(p) for p in co if p[1] > c[1]]
    print(f'    huella del cuerpo: centro x={c[0]:+.3f} y={c[1]:+.3f}, x de {co[:, 0].min():+.3f} a {co[:, 0].max():+.3f}, '
          f'y de {co[:, 1].min():+.3f} a {co[:, 1].max():+.3f}, radio que lo encierra {r:.3f} m')
    print(f'    piso entre la Cintiq y la Renderbox: lo más cerca {min(a_caja(p) for p in todo_ci):.3f} m, '
          f'de su mitad de atrás {min(atras):.3f} m')
    frente = [p for p in todo_ci if abs(p[0]) < rbx and p[1] < -rby]
    print(f'    vértices de la Cintiq enfrente de la cara de la Renderbox: {len(frente)}')
    print(f'    traspasos con la Renderbox: Cintiq y pluma {traspasos(ci + pluma, [rb])}, conectores y tarjeta '
          f'{traspasos(list(con.values()) + tarjeta, [rb])}, cable {traspasos([cable], [rb])}')
    print(f'    tarjeta a la espalda: {distancia(tarjeta[:1], [rb]) * 1000:.2f} mm; USB-C al canto de la Cintiq: '
          f'{distancia([con["usb_cuerpo"]], [o for o in cuerpo if o.name.startswith("cin_cuerpo")]) * 1000:.2f} mm')
    print(f'    traspasos: cable contra la Cintiq {traspasos([cable], ci)}, contra la pluma {traspasos([cable], pluma)}, '
          f'contra la tarjeta {traspasos([cable], tarjeta)}, contra los cuerpos de los conectores '
          f'{traspasos([cable], [con["usb_cuerpo"], con["dp_cuerpo"], con["dp_nariz"]])}; '
          f'conectores contra la Cintiq {traspasos([con["usb_boquilla"]], ci)}, nariz del DP contra su puerto '
          f'{traspasos([con["dp_nariz"]], [o for o in tarjeta if o.name.startswith("puerto")])}')
    print(f'    contra el cable de corriente, su clavija, la fuente y el registro: traspasos {traspasos([cable] + list(con.values()) + tarjeta + ci + pluma, [corriente])}, '
          f'lo más cerca {distancia([cable], [corriente]):.3f} m (el cable), {distancia(tarjeta, [corriente]) * 1000:.1f} mm (la tarjeta a la fuente)')
    pts = m['pts']
    (bx, by, bz), Mc = m['boquillas']
    print(f'    el cable empieza en la boquilla del DP: {punta_en_cilindro(pts[0], LINK_R, (bx, by, bz), (0, 1, 0), 0.018, LINK_R + 0.0006)}, '
          f'acaba en la del USB-C: {punta_en_cilindro(pts[-1], LINK_R, Mc @ Vector((T.CINTIQ['ancho'] / 2 + 0.0202, 0, PUERTO_CINTIQ_Z)), m["sale_ci"], 0.016, LINK_R + 0.0006)}')
    largo = sum((b - a).length for a, b in zip(pts, pts[1:]))
    en_piso = sum((b - a).length for a, b in zip(pts, pts[1:]) if a.z < LINK_R + SOBRE_PISO + 1e-4 and b.z < LINK_R + SOBRE_PISO + 1e-4)
    print(f'    cable: lo más bajo z={min(p.z for p in pts) - LINK_R:+.4f} (su cara de abajo), {en_piso:.2f} m tendido en el piso de {largo:.2f} m, '
          f'lo más cerca de la Renderbox en el piso {min(a_caja(p) for p in pts if p.z < 0.01):.3f} m')
    borrar()


# ---- agregarla sin tocar lo de antes: sus islas en los huecos del atlas y su pintura encima

def uvs(o):
    uv = o.data.uv_layers[0].data
    co = np.empty(len(uv) * 2, np.float64)
    uv.foreach_get('uv', co)
    return co.reshape(-1, 2)


def mascara_uv(objs, tam, islas=False):
    """Los pixeles del atlas cuyo centro cae en alguna cara de `objs` (como los marca el horneado). Con
    `islas`, cuántas islas de `objs` caen en cada pixel (para ver si se enciman)."""
    if islas:
        cuenta = np.zeros((tam, tam), np.int32)
        for o in objs:
            co = uvs(o) * tam
            for _, tris in islas_uv(o):
                cuenta += raster(co[tris], tam, tam)
        return cuenta
    m = np.zeros((tam, tam), bool)
    for o in objs:
        me = o.data
        co = uvs(o) * tam
        me.calc_loop_triangles()
        tri = np.empty(len(me.loop_triangles) * 3, np.int32)
        me.loop_triangles.foreach_get('loops', tri)
        m |= raster(co[tri.reshape(-1, 3)], tam, tam)
    return m


def raster(tris, alto, ancho, ensancha=0.0):
    """Los pixeles (alto × ancho) cuyo centro cae en alguno de los triángulos `tris` (n × 3 × 2, en pixeles).
    Con `ensancha`, también los que quedan a esa distancia de un triángulo (0.71 = todo pixel que toca)."""
    m = np.zeros((alto, ancho), bool)
    r = ensancha
    for a, b, c in tris:
        x0 = max(int(math.ceil(min(a[0], b[0], c[0]) - r - 0.5)), 0)
        x1 = min(int(math.floor(max(a[0], b[0], c[0]) + r - 0.5)), ancho - 1)
        y0 = max(int(math.ceil(min(a[1], b[1], c[1]) - r - 0.5)), 0)
        y1 = min(int(math.floor(max(a[1], b[1], c[1]) + r - 0.5)), alto - 1)
        if x1 < x0 or y1 < y0:
            continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        if abs(d) < 1e-12:
            if r <= 0:
                continue
            d = 1e-12
        sg = 1.0 if d > 0 else -1.0
        dentro = np.ones(X.shape, bool)
        for p, q in ((b, c), (c, a), (a, b)):
            largo = math.hypot(q[0] - p[0], q[1] - p[1])
            e = ((p[0] - X) * (q[1] - Y) - (p[1] - Y) * (q[0] - X)) * sg
            dentro &= e >= -max(r * largo, 1e-6 * max(largo, 1.0))
        if r > 0:   # un triángulo flaquito: lo de cerca de sus esquinas también
            for p in (a, b, c):
                dentro |= (X - p[0]) ** 2 + (Y - p[1]) ** 2 <= r * r
        m[y0:y1 + 1, x0:x1 + 1] |= dentro
    return m


def islas_uv(o):
    """Las islas de la UV de `o`: [(sus loops, sus triángulos como loops n × 3)], caras unidas por aristas con la misma UV."""
    me = o.data
    co = uvs(o)
    vi = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get('vertex_index', vi)
    padre = list(range(len(me.polygons)))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i
    aristas = {}
    for p in me.polygons:
        ls = list(p.loop_indices)
        for k, li in enumerate(ls):
            lj = ls[(k + 1) % len(ls)]
            va, vb = vi[li], vi[lj]
            ua, ub = (co[li], co[lj]) if va < vb else (co[lj], co[li])
            clave = (min(va, vb), max(va, vb))
            for q, qa, qb in aristas.get(clave, []):
                if np.abs(qa - ua).max() < 1e-7 and np.abs(qb - ub).max() < 1e-7:
                    padre[raiz(p.index)] = raiz(q)
            aristas.setdefault(clave, []).append((p.index, ua, ub))
    me.calc_loop_triangles()
    tri = np.empty(len(me.loop_triangles) * 3, np.int32)
    me.loop_triangles.foreach_get('loops', tri)
    tri = tri.reshape(-1, 3)
    tp = np.empty(len(me.loop_triangles), np.int32)
    me.loop_triangles.foreach_get('polygon_index', tp)
    raices = np.array([raiz(i) for i in range(len(me.polygons))])
    ini = np.empty(len(me.polygons), np.int32)
    tot = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('loop_start', ini)
    me.polygons.foreach_get('loop_total', tot)
    out = []
    for r in np.unique(raices):
        polys = np.nonzero(raices == r)[0]
        loops = np.concatenate([np.arange(ini[i], ini[i] + tot[i]) for i in polys])
        out.append((loops, tri[raices[tp] == r]))
    return out


def girar_a_caja(pts):
    """El giro (radianes) que deja la caja más chica alrededor de `pts` (calibres sobre su casco)."""
    from mathutils.geometry import convex_hull_2d
    casco = pts[convex_hull_2d([tuple(p) for p in pts])]
    mejor = (1e18, 0.0)
    for a, b in zip(casco, np.roll(casco, -1, axis=0)):
        d = b - a
        if math.hypot(d[0], d[1]) < 1e-9:
            continue
        ang = -math.atan2(d[1], d[0])
        c, s_ = math.cos(ang), math.sin(ang)
        q = casco @ np.array([[c, s_], [-s_, c]])
        area = float(np.prod(q.max(0) - q.min(0)))
        if area < mejor[0]:
            mejor = (area, ang)
    return mejor[1]


def acomodar_en_huecos(nuevos, viejo, margen_px):
    """Pone cada isla de `nuevos` (ya a su escala, en UV) en un hueco del atlas: lo ocupado es `viejo` más
    `margen_px` alrededor (y la orilla del atlas). Trabaja a la mitad de resolución con máscaras que cubren de
    más; de la isla más grande a la más chica, cada una en el primer lugar libre de abajo hacia arriba (busca
    con FFT dónde no se enciman), derecha o girada 90°."""
    N = viejo.shape[0]
    n = N // 2
    ocu = viejo.copy()
    for _ in range(margen_px):
        ocu = crecer(ocu)
    ocu = ocu.reshape(n, 2, n, 2).any(axis=(1, 3))
    borde = 3
    ocu[:borde, :] = True
    ocu[-borde:, :] = True
    ocu[:, :borde] = True
    ocu[:, -borde:] = True
    paso_margen = int(math.ceil(margen_px / 2)) + 1
    islas = []
    for o in nuevos:
        co = uvs(o)
        for loops, tris in islas_uv(o):
            v1, v2 = co[tris[:, 1]] - co[tris[:, 0]], co[tris[:, 2]] - co[tris[:, 0]]
            area = 0.5 * np.abs(v1[:, 0] * v2[:, 1] - v1[:, 1] * v2[:, 0]).sum() * N * N
            islas.append((area, o, loops, tris))
    islas.sort(key=lambda t: -t[0])
    nuevas = {o.name: uvs(o).copy() for o in nuevos}
    for area, o, loops, tris in islas:
        co = uvs(o) * N
        ang = girar_a_caja(co[loops])
        F = np.fft.rfft2(ocu.astype(np.float64))
        mejor = None
        for extra in (0.0, math.pi / 2):
            c, s_ = math.cos(ang + extra), math.sin(ang + extra)
            R = np.array([[c, s_], [-s_, c]])
            todos = co @ R
            lo = todos[loops].min(0)
            local = (todos - lo) / 2 + 1.0       # a la mitad, con una celda de orilla
            h, w = int(math.ceil(local[loops, 1].max())) + 2, int(math.ceil(local[loops, 0].max())) + 2
            if h >= n or w >= n:
                continue
            K = crecer(raster(local[tris], h, w, ensancha=0.75))
            Kp = np.zeros((n, n))
            Kp[:h, :w] = K
            enc = np.fft.irfft2(F * np.conj(np.fft.rfft2(Kp)), s=(n, n))
            libre = enc[:n - h + 1, :n - w + 1] < 0.5
            ys, xs = np.nonzero(libre)
            if not len(ys):
                continue
            k = np.lexsort((xs, ys))[0]
            cand = (int(ys[k]), int(xs[k]), R, lo, K)
            if mejor is None or (cand[0], cand[1]) < (mejor[0], mejor[1]):
                mejor = cand
        if mejor is None:
            raise RuntimeError(f'una isla de {o.name} ({area:.0f} px) no cabe en ningún hueco del atlas')
        y, x, R, lo, K = mejor
        # la celda (x, y) de la mitad es el pixel (2x, 2y); la celda de orilla son 2 px
        nuevas[o.name][loops] = ((co[loops] @ R - lo) + 2.0 + np.array([2.0 * x, 2.0 * y])) / N
        marca = K.copy()
        for _ in range(paso_margen):
            marca = crecer(np.pad(marca, 1))
        y0, x0 = y - paso_margen, x - paso_margen
        hh, ww = marca.shape
        ya, xa = max(y0, 0), max(x0, 0)
        yb, xb = min(y0 + hh, n), min(x0 + ww, n)
        ocu[ya:yb, xa:xb] |= marca[ya - y0:yb - y0, xa - x0:xb - x0]
    for o in nuevos:
        o.data.uv_layers[0].data.foreach_set('uv', nuevas[o.name].ravel())
    print(f'  acomodadas {len(islas)} islas de la Cintiq en los huecos del atlas')



def mover(a, dy, dx):
    """Como np.roll, pero sin dar la vuelta (lo de P.hornear_atlas)."""
    b = np.zeros_like(a)
    n0, n1 = a.shape[:2]
    b[max(dy, 0):n0 + min(dy, 0), max(dx, 0):n1 + min(dx, 0)] = a[max(-dy, 0):n0 + min(-dy, 0), max(-dx, 0):n1 + min(-dx, 0)]
    return b


def crecer(mask):
    g = mask.copy()
    g[1:, :] |= mask[:-1, :]
    g[:-1, :] |= mask[1:, :]
    g[:, 1:] |= mask[:, :-1]
    g[:, :-1] |= mask[:, 1:]
    g[1:, 1:] |= mask[:-1, :-1]
    g[:-1, :-1] |= mask[1:, 1:]
    g[1:, :-1] |= mask[:-1, 1:]
    g[:-1, 1:] |= mask[1:, :-1]
    return g


def distancia_px(mask, maximo):
    """A cuántos pixeles (vecinos de 8) está cada pixel de `mask`, hasta `maximo` (más lejos: maximo + 1)."""
    d = np.full(mask.shape, maximo + 1, np.int16)
    d[mask] = 0
    cur = mask
    for k in range(1, maximo + 1):
        g = crecer(cur)
        d[g & ~cur] = k
        cur = g
    return d


_TIRAS = {}   # la UV en metros del cable de la Cintiq (loops, uv), para volver a empezar si no cupo


def uv_en_huecos(nuevos, fijos, densidad, margen=0.0022):
    """Las islas de `nuevos` (con su densidad en px/m) en los huecos del atlas, sin mover las de `fijos`."""
    antes = {o.name: uvs(o).copy() for o in fijos}
    for o in nuevos:
        if o.data.uv_layers:
            o.data.uv_layers.active_index = 0
    # el cable de la Cintiq ya trae su UV en metros (tiras derechas, tubo_rmf con uv_tramo): no pasa por
    # smart_project, que lo partía en tiras curvas que no caben en los huecos
    tiras = {}
    for o in nuevos:
        idx = [i for i, m in enumerate(o.data.materials) if m and m.name == 'Claro_Cintiq_Cable']
        if not idx:
            continue
        mi = np.empty(len(o.data.polygons), np.int32)
        o.data.polygons.foreach_get('material_index', mi)
        caras = np.isin(mi, idx)
        if o.name not in _TIRAS:
            loops = np.concatenate([list(o.data.polygons[i].loop_indices) for i in np.nonzero(caras)[0]])
            _TIRAS[o.name] = (loops, uvs(o)[loops].copy())
        tiras[o.name] = (caras, idx) + _TIRAS[o.name]
    bpy.ops.object.select_all(action='DESELECT')
    for o in nuevos:
        o.select_set(True)
    bpy.context.view_layer.objects.active = nuevos[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    for o in nuevos:
        if o.name in tiras:
            bm = bmesh.from_edit_mesh(o.data)
            for f in bm.faces:
                if f.material_index in tiras[o.name][1]:
                    f.select_set(False)
            bmesh.update_edit_mesh(o.data)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in nuevos:
        me = o.data
        uv = me.uv_layers.active.data
        co = uvs(o)
        caras = tiras[o.name][0] if o.name in tiras else np.zeros(len(me.polygons), bool)
        a3, auv = 0.0, 0.0
        for poly in me.polygons:
            if caras[poly.index]:
                continue
            a3 += poly.area
            idx = list(poly.loop_indices)
            xs, ys = co[idx, 0], co[idx, 1]
            auv += 0.5 * abs(np.dot(xs, np.roll(ys, 1)) - np.dot(ys, np.roll(xs, 1)))
        k = math.sqrt(auv / max(a3, 1e-9))
        co *= densidad[o.name] / TAM / max(k, 1e-9)
        if o.name in tiras:
            _, _, loops, metros = tiras[o.name]
            co[loops] = metros * densidad[o.name] / TAM
        uv.foreach_set('uv', co.ravel())
    # el acomodo de Blender no respeta las islas fijadas (con pin LOCKED las encima desde la esquina):
    # se acomodan a mano en los huecos de la máscara de lo de antes
    viejo = mascara_uv(fijos, TAM)
    acomodar_en_huecos(nuevos, viejo, round(margen * TAM))
    movidas = [o.name for o in fijos if not np.array_equal(antes[o.name], uvs(o))]
    if movidas:
        raise RuntimeError(f'se movieron UV de lo de antes: {movidas}')
    co = np.concatenate([uvs(o) for o in nuevos])
    nuevo = mascara_uv(nuevos, TAM)
    suma = sum(mascara_uv([o], TAM, islas=True) for o in nuevos)
    holgura = int(distancia_px(viejo, 12)[nuevo].min())
    print(f'  islas de la Cintiq: UV de {co.min(0).round(4)} a {co.max(0).round(4)}, {nuevo.sum()} px; '
          f'encimadas con las de antes: {(viejo & nuevo).sum()} px, entre ellas: {int((suma > 1).sum())} px; '
          f'lo más cerca de una isla de antes: {holgura} px; las de antes: sin mover')
    if co.min() < 0 or co.max() > 1 or (viejo & nuevo).any() or (suma > 1).any():
        raise RuntimeError('las islas de la Cintiq no cupieron en los huecos del atlas')
    return viejo


def hornear_encima(nuevos, fijos, viejo, png, tam=TAM, muestras=64, margen=16):
    """Hornea solo `nuevos` (lo de antes no se dibuja: hide_render) y pone sus islas en el atlas que ya
    existe: cada pixel que está más cerca de una isla nueva que de una vieja (y a ≤ `margen`) toma lo
    nuevo, con el mismo margen que hace P.hornear_atlas; todo lo demás se queda como estaba."""
    img = bpy.data.images.new('cintiq_horno', tam, tam, alpha=True)
    img.colorspace_settings.name = 'sRGB'
    img.pixels.foreach_set(np.tile(np.array([1.0, 0.0, 1.0, 0.0], np.float32), tam * tam))
    mats = {m for o in nuevos for m in o.data.materials if m}
    for m in mats:
        n = m.node_tree.nodes.get('Horneado')
        n.image = img
        m.node_tree.nodes.active = n
    ocultos = [o for o in bpy.data.objects if o not in nuevos and not o.hide_render]
    for o in ocultos:
        o.hide_render = True
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = muestras
    sc.cycles.device = 'CPU'
    bpy.ops.object.select_all(action='DESELECT')
    for o in nuevos:
        o.select_set(True)
    bpy.context.view_layer.objects.active = nuevos[0]
    bpy.ops.object.bake(type='EMIT', margin=0, use_clear=False)
    for o in ocultos:
        o.hide_render = False
    px = np.empty(tam * tam * 4, np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(tam, tam, 4)
    lleno = (px[..., 3] > 0.5) | (np.abs(px[..., :3] - (1.0, 0.0, 1.0)).max(axis=2) > 0.02)
    if (lleno & viejo).any():
        raise RuntimeError(f'lo horneado de la Cintiq cae en {(lleno & viejo).sum()} px de las islas de antes')
    col = np.where(lleno[..., None], px[..., :3], 0.0).astype(np.float32)
    hay = lleno.astype(np.float32)
    for _ in range(margen):   # el margen de P.hornear_atlas, solo desde las islas nuevas
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
    d_nuevo, d_viejo = distancia_px(lleno, margen), distancia_px(viejo, margen + 1)
    toma = (d_nuevo <= margen) & (d_nuevo < d_viejo) & (hay > 0)
    base = bpy.data.images.load(png, check_existing=False)
    if tuple(base.size) != (tam, tam):
        raise RuntimeError(f'{png} mide {tuple(base.size)}, no {tam}')
    viejo_px = np.empty(tam * tam * 4, np.float32)
    base.pixels.foreach_get(viejo_px)
    viejo_px = viejo_px.reshape(tam, tam, 4)
    out = viejo_px[..., :3].copy()
    out[toma] = col[toma]
    final = bpy.data.images.new(os.path.splitext(os.path.basename(png))[0] + '_con_cintiq', tam, tam, alpha=False)
    final.colorspace_settings.name = 'sRGB'
    final.pixels.foreach_set(np.concatenate([out, np.ones((tam, tam, 1), np.float32)], axis=2).ravel())
    final.filepath_raw = png
    final.file_format = 'PNG'
    final.save()
    # que lo de antes se quedó igual: se vuelve a leer el PNG guardado y se compara fuera de lo que tomó la Cintiq
    rel = bpy.data.images.load(png, check_existing=False)
    rel_px = np.empty(tam * tam * 4, np.float32)
    rel.pixels.foreach_get(rel_px)
    rel_px = rel_px.reshape(tam, tam, 4)
    cambio = np.abs(rel_px[..., :3] - viejo_px[..., :3]).max(axis=2) > 1e-6
    print(f'  horneado de la Cintiq: {int(lleno.sum())} px pintados, {int(toma.sum())} px del atlas tomados (con su margen); '
          f'pixeles que cambiaron fuera de eso: {int((cambio & ~toma).sum())}, adentro de las islas de antes: {int((cambio & viejo).sum())}')
    for m in mats:
        m.node_tree.nodes['Horneado'].image = rel
    for i in (img, base, final):
        bpy.data.images.remove(i)


def agregar_cintiq(tam=TAM, muestras=64):
    abrir()
    t0 = os.path.getmtime(BLEND)
    p0 = os.path.getmtime(PNG)
    for n in (CINTIQ_PANTALLA, CINTIQ_CUERPO, CINTIQ):   # por si se vuelve a correr
        if n in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[n])
    for m in [m for m in bpy.data.materials if m.name.startswith('Claro_Cintiq_')]:
        bpy.data.materials.remove(m)
    fijos = [bpy.data.objects[LETRERO]] + [bpy.data.objects[n] for n in NEONES] + [bpy.data.objects[CABLE]]
    raiz, cuerpo, pantalla = cintiq_piso(bpy.data.objects[CABLE])
    nuevos = [raiz, cuerpo, pantalla]
    # la misma densidad que lo de antes con su peso: lo del cable como el cable, lo demás por el letrero
    base = T.densidad(bpy.data.objects[LETRERO]) / PESOS[LETRERO]
    densidad = {CINTIQ: T.densidad(bpy.data.objects[CABLE]), CINTIQ_CUERPO: base * PESOS[CINTIQ_CUERPO],
                CINTIQ_PANTALLA: base * PESOS[CINTIQ_PANTALLA]}
    # el hueco libre más grande del atlas es de ~150 px: si las caras grandes del cuerpo no caben, se le
    # bajan los pixeles por metro al cuerpo y a la pantalla (plástico negro y un color plano)
    for factor in (1.0, 0.85, 0.72, 0.6, 0.5, 0.42):
        d = dict(densidad, **{n: densidad[n] * factor for n in (CINTIQ_CUERPO, CINTIQ_PANTALLA)})
        try:
            viejo = uv_en_huecos(nuevos, fijos, d)
            break
        except RuntimeError as e:
            print(f'  {e}: con {factor:.2f} de la densidad del cuerpo no cupo')
    else:
        raise RuntimeError('la Cintiq no cabe en los huecos del atlas')
    print('  densidad de la Cintiq (px/m): ' + ', '.join(f'{k} {v:.0f}' for k, v in d.items()))
    if os.path.getmtime(PNG) != p0:
        raise RuntimeError(f'{PNG} cambió mientras se armaba: no se pinta encima')
    hornear_encima(nuevos, fijos, viejo, PNG, tam=tam, muestras=muestras)
    reporte(nuevos)
    if os.path.getmtime(BLEND) != t0:
        raise RuntimeError(f'{BLEND} cambió mientras se armaba: no se guarda')
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('Cintiq agregada:', BLEND)


# ---------------------------------------------------------------- comandos

def objetos():
    nombres = [LETRERO] + NEONES + [CABLE, CINTIQ, CINTIQ_CUERPO, CINTIQ_PANTALLA]
    return [bpy.data.objects[n] for n in nombres]


def reporte(objs):
    total = 0
    for o in objs:
        bpy.context.view_layer.update()
        n = P.triangulos([o])
        total += n
        dd = o.dimensions
        print(f'  {o.name:32s} {dd.x:5.3f} x {dd.y:5.3f} x {dd.z:5.3f} m  {n:6d} tri  {T.densidad(o):5.0f} px/m')
    return total


def armar():
    P.limpiar()
    random.seed(SEMILLA)
    E = materiales()
    fijos, neones = letrero(E)
    prop = T.unir(fijos, LETRERO)
    # el origen al centro de la huella del letrero en el piso
    co = np.array([v.co[:] for v in prop.data.vertices])
    dy = -(co[:, 1].min() + co[:, 1].max()) / 2
    for o in [prop] + neones:
        o.data.transform(Matrix.Translation((0, dy, 0)))
    for n in neones:
        n.parent = prop
    co = np.array([v.co[:] for v in prop.data.vertices])
    print(f'  huella del letrero: x {co[:, 0].min():+.3f} a {co[:, 0].max():+.3f}, y {co[:, 1].min():+.3f} a {co[:, 1].max():+.3f}, '
          f'z {co[:, 2].min():+.3f} a {co[:, 2].max():+.3f} (corrido {dy:+.3f} en y)')
    cable, _ = cable_renderbox(E)
    cintiq = cintiq_piso(cable)    # al final y con su propio azar: lo de antes sale igual que sin ella
    objs = objetos()
    T.uv_atlas_ponderado(objs, PESOS)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    total = reporte(objs)
    print(f'armado: {total} triángulos ({P.triangulos(objs[:5])} el letrero, {P.triangulos([cable])} el cable, '
          f'{P.triangulos(list(cintiq))} la Cintiq)')


def abrir():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    bpy.context.preferences.filepaths.save_version = 0


APARTE = 12.0   # el letrero se hornea apartado: la Cintiq queda donde está su dado izquierdo (los dos van en el origen)


def pintar(tam=TAM, muestras=64):
    abrir()
    let = bpy.data.objects[LETRERO]
    let.location.x += APARTE
    P.hornear_atlas(objetos(), PNG, tam=tam, muestras=muestras)
    let.location.x -= APARTE
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', PNG)


def exportar():
    abrir()
    objs = objetos()
    m = P.material_final(PNG, 'props_claro')
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB, export_format='GLB', use_selection=True, export_apply=True,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_image_format='WEBP', export_image_quality=88, export_materials='EXPORT', export_yup=True,
        **P._sin_colores(),
    )
    print(f'exportado: {GLB} {os.path.getsize(GLB) / 1024:.0f} KB')


def traer_renderbox(loc):
    """La Renderbox (con sus hijos) de Estilo_taller.blend, solo para las fotos."""
    nombres = ['Prop_Estudio_Computadora', 'Prop_Estudio_Computadora_LuzBoton', 'Prop_Estudio_Computadora_LuzVentiladores'] + \
              [f'Prop_Estudio_Computadora_Ventilador_{n}' for n in range(5)]
    with bpy.data.libraries.load(TALLER_BLEND, link=False) as (src, dst):
        dst.objects = [n for n in nombres if n in src.objects]
    m = P.material_final(TALLER_PNG, 'revision_taller')
    raiz = None
    for o in dst.objects:
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.clear()
        o.data.materials.append(m)
        if o.name.startswith('Prop_Estudio_Computadora') and o.parent is None:
            raiz = o
    raiz.location = loc
    return raiz


def render(carpeta):
    abrir()
    objs = objetos()
    m = P.material_final(PNG, 'revision_claro')
    for o in objs:
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
    relleno = bpy.data.objects.new('relleno', bpy.data.lights.new('relleno', 'SUN'))   # para lo de atrás
    relleno.data.energy = 1.3
    relleno.data.use_shadow = False
    relleno.rotation_euler = (math.radians(60), 0, math.radians(150))
    sc.collection.objects.link(relleno)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    # el piso (azul de la escena) para ver lo que se apoya
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    piso = bpy.context.active_object
    mp = bpy.data.materials.new('piso')
    mp.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = P.srgb('#27306a')
    mp.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    piso.data.materials.append(mp)
    # la Renderbox y su cable, a un lado del letrero, con la misma transformación
    RBX = 3.2
    traer_renderbox((RBX, 0.0, RB_Z))
    bpy.data.objects[CABLE].location = (RBX, 0.0, RB_Z)
    bpy.data.objects[CINTIQ].location = (RBX + 0.0, 0.0, RB_Z)   # en el mismo marco (sus hijas lo siguen)
    os.makedirs(carpeta, exist_ok=True)
    rutas = []
    let = [bpy.data.objects[LETRERO]] + [bpy.data.objects[n] for n in NEONES]
    piso.hide_render = True
    T._foto(sc, cam, let, os.path.join(carpeta, 'letrero_frente.png'), 0, 0, res=(1400, 1500), escala=1.08)
    T._foto(sc, cam, let, os.path.join(carpeta, 'letrero_lado.png'), 90, 0, res=(1000, 1500), escala=1.08)
    T._foto(sc, cam, let, os.path.join(carpeta, 'letrero_atras_orto.png'), 180, 0, res=(1400, 1500), escala=1.08)
    rutas += [os.path.join(carpeta, f) for f in ('letrero_frente.png', 'letrero_lado.png', 'letrero_atras_orto.png')]
    piso.hide_render = False
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'letrero_34.png'), (-2.6, -3.6, 2.3), (0.0, 0.0, 1.15), lente=35))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'letrero_atras.png'), (2.4, 3.3, 1.9), (0.1, 0.0, 1.05), lente=35))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'letrero_camara.png'), (0.6, -6.5, 6.0), (0.0, 0.0, 1.0), lente=38))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'letrero_transformador.png'), (1.45, 1.25, 1.2), (0.72, 0.2, 0.7), lente=35))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'letrero_bastidor.png'), (0.1, 1.15, 1.95), (0.15, 0.0, 1.55), lente=30))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'letrero_base.png'), (-0.25, -0.9, 0.45), (-0.72, 0.15, 0.08), lente=35))
    # el cable desde atrás de la Renderbox, de lado, la clavija y el registro
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cable_atras.png'), (RBX + 1.1, 3.9, 1.5), (RBX + 0.15, 1.1, 0.1), lente=35))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cable_desde_renderbox.png'), (RBX - 0.35, -0.55, 0.95), (RBX + 0.2, 1.4, 0.0), lente=30))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cable_lado.png'), (RBX + 1.3, 0.45, 0.25), (RBX + 0.05, 0.42, 0.1), lente=40))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cable_clavija.png'), (RBX + 0.2, 0.62, 0.3), (RBX + 0.08, 0.25, 0.12), lente=45))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cable_registro.png'), (RBX + 0.55, 2.1, 0.45), (RBX + 0.3, 2.6, 0.0), lente=40))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cable_arriba.png'), (RBX + 0.2, 1.35, 4.2), (RBX + 0.2, 1.35, 0.0), lente=35, res=(1100, 1500)))
    # de noche, con el neón prendido en magenta
    neon = bpy.data.materials.new('neon_prendido')
    nt = neon.node_tree
    nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = P.srgb('#ff2bd6')
    em.inputs['Strength'].default_value = 7.0
    sal = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], sal.inputs['Surface'])
    for n in NEONES:
        o = bpy.data.objects[n]
        o.data.materials.clear()
        o.data.materials.append(neon)
    fondo.inputs['Color'].default_value = P.srgb('#0c1030')
    fondo.inputs['Strength'].default_value = 0.5
    sol.data.energy = 0.35
    relleno.data.energy = 0.12
    mp.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = P.srgb('#0a1450')
    T._brillo(sc)
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'letrero_noche.png'), (-1.3, -4.4, 1.9), (0.0, 0.0, 1.45), lente=40))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'letrero_noche_camara.png'), (0.6, -6.5, 6.0), (0.0, 0.0, 1.0), lente=38))
    print('render:', *rutas, sep='\n  ')


def _dir(az, el):
    """De dónde se ve: azimut 0 = desde el frente de la Renderbox (-Y), positivo hacia +X; elevación en grados."""
    a, e = math.radians(az), math.radians(el)
    return Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))


def render_cintiq(carpeta):
    """La Cintiq con la Renderbox (en su marco, sin el letrero), su cable y el de corriente: desde arriba
    (de cerca y con el registro), alta a ~55° en tres cuartos de frente desde el lado de la Cintiq, desde
    donde la ve la cámara del juego (que mira hacia +z del mundo: en este marco, desde +X y un poco del
    frente, azimut 72°), el cable por detrás, de frente a ras del piso, de perfil y el USB-C."""
    abrir()
    objs = objetos()
    m = P.material_final(PNG, 'revision_claro')
    for o in objs:
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
    relleno = bpy.data.objects.new('relleno', bpy.data.lights.new('relleno', 'SUN'))
    relleno.data.energy = 1.3
    relleno.data.use_shadow = False
    relleno.rotation_euler = (math.radians(60), 0, math.radians(150))
    sc.collection.objects.link(relleno)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    piso = bpy.context.active_object
    mp = bpy.data.materials.new('piso')
    mp.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = P.srgb('#27306a')
    mp.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    piso.data.materials.append(mp)
    for o in [bpy.data.objects[LETRERO]] + [bpy.data.objects[n] for n in NEONES]:   # también va en el origen
        o.hide_render = True
    traer_renderbox((0.0, 0.0, RB_Z))
    os.makedirs(carpeta, exist_ok=True)
    rutas = []

    def arriba(nombre, centro, lado, res):
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = lado
        cam.data.clip_end = 50
        cam.location = (centro[0], centro[1], 10.0)
        cam.rotation_euler = (0, 0, 0)
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.render.filepath = os.path.join(carpeta, nombre)
        bpy.ops.render.render(write_still=True)
        rutas.append(sc.render.filepath)
    arriba('cintiq_arriba.png', (-0.42, 0.18), 2.1, (1600, 1200))
    arriba('cintiq_arriba_registro.png', (-0.45, 1.22), 3.45, (1150, 1500))
    mira = Vector((-0.45, 0.12, 0.12))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cintiq_camara.png'), mira + _dir(-35, 55) * 4.6, mira, lente=45))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cintiq_camara_juego.png'), mira + _dir(72, 55) * 4.6, mira, lente=45))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cintiq_cable.png'), (-0.95, 1.55, 0.95), (-0.3, 0.38, 0.08), lente=35))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cintiq_frente_bajo.png'), (-0.85, -1.6, 0.22), (-0.8, 0.0, 0.07), lente=40))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cintiq_perfil.png'), (-2.45, 0.05, 0.16), (-1.0, 0.0, 0.08), lente=45))
    rutas.append(T._toma(sc, cam, os.path.join(carpeta, 'cintiq_conector.png'), (-0.42, -0.14, 0.3), (-0.70, 0.16, 0.10), lente=50))
    print('render:', *rutas, sep='\n  ')


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    rapido = 'rapido' in args[1:]
    resto = [a for a in args[1:] if a != 'rapido']
    carpeta = resto[0] if resto else os.path.join(tempfile.gettempdir(), 'props_claro')
    if cmd in ('armar', 'todo'):
        armar()
    if cmd in ('pintar', 'todo'):
        pintar(1024, 16) if rapido else pintar()
    if cmd in ('exportar', 'todo'):
        exportar()
    if cmd == 'cintiq':
        agregar_cintiq(TAM, 16) if rapido else agregar_cintiq()
    if cmd in ('render', 'todo'):
        render(carpeta)
    if cmd in ('render', 'todo', 'render_cintiq'):
        render_cintiq(carpeta)
