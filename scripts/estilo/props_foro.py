"""Props del Foro, pintados a mano (Oscar, 2026-11-24; features.md, El Foro y Los props): la terraza
con el escenario punk que M.A.D.R.E. armó con troncos y tablas, donde se juega la tocada. Usa la
pintura compartida (scripts/estilo/pintura.py) con el estilo del barril de prueba.

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_foro.py -- todo [carpeta_fotos]

  armar     arma los props y sus materiales, los acomoda en fila y los desenvuelve en un atlas;
            guarda Character/Estilo_foro.blend
  pintar    hornea el atlas (Cycles, 2048) a Character/assets/props_foro.png (el maestro, para
            retocar a mano)
  exportar  escribe public/3dmodels/estilo/props_foro.glb (Draco, textura WebP, un solo material)
  render    fotos de revisión en la carpeta que se le dé (o en el temporal del sistema)
  todo      los cuatro

Props (un objeto por prop, a tamaño real en metros, base en z = 0, el frente hacia -Y):
  Prop_Escenario          tarima de 5 × 3 × 0.6 sobre cinco troncos, escalones al frente, pared de
                          fondo negra con el esténcil de Skulley (el único del grupo), cinta, calcas y
                          papel picado, y arriba de la pared ESCENARIO en letras de neón de bloque
    Prop_Escenario_Neon_0…8 el neón de ESCENARIO en SKULLEYGLYPH (hijas), en orden de lectura: las filas de
                            tubos de cada letra; el sitio les cambia el material (brillan y parpadean). Las
                            letras de bloque de lámina con óxido, su tubo oxidado con grapas y el bastidor
                            de fierro sobre la pared van en la malla del escenario
    Prop_Escenario_Hojas    las dos hojas de setlist con su cinta (hijo): una tirada en el piso y otra
                            pegada en la pared, láminas de 2 mm con los renglones pintados en su cara
    Prop_Escenario_Cono_<I|D>_<n>  los conos de las dos torres de bocinas (hijos): origen al centro del
                            cono, viendo hacia -Y local; el sitio los hace latir. Las torres (gabinetes,
                            aros amarillos, esquineras, combos y cables) van en la malla del escenario
  Prop_BocinaTocon        tocón hueco con el cono pintado al frente y rejilla
  Prop_PieMicro           pie de micrófono de 1.7 m (el micro apunta hacia +Y, al que canta)
  Prop_Ampli              ampli de bulbos con rejilla crema, perillas y un rayo de logotipo
  Prop_CajaEquipo         caja de transporte turquesa con marco de metal, PUNKS NOT DEAD y calcas
  Prop_Pad                pad del piso (como los del MiniLab), orilla de goma negra
    Prop_Pad_Cara           su cara gris claro (hijo del pad): el sitio la tiñe
  Prop_TamboRayo          tambo amarillo con la calca de rayo y cinta, y otro rayo atrás

La cara del pad lleva su origen en el centro y un segundo UV, `UVCara` (TEXCOORD_1 en el GLB), de 0 a 1
sobre la cara de arriba, para que el sitio la tiña sin depender del atlas. Las letras de neón llevan su
origen en el centro de cada letra.
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
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import pintura as P  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_foro.blend')
PNG = os.path.join(REPO, 'Character', 'assets', 'props_foro.png')
GLB = os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_foro.glb')
TAM = 2048
SEMILLA = 11
TEMP = os.path.join(tempfile.gettempdir(), 'props_foro_calcas')

NEON_JSON = os.path.join(AQUI, 'neon_escenario.json')
# Letras de neón de bloque (referencia de Oscar): medidas en unidades de runa salvo las que dicen m.
# `frente` (m) es el plano del frente abierto; `base` (m) donde se paran, arriba de la pared y su repisa.
NEON = {'ancho': 3.6, 'base': 1.925, 'frente': 1.335, 'hondo': 1.6, 'pared': 0.06, 'metido': 0.25, 'radio_fila': 0.085,
        'radio_marco': 0.07, 'marco_atras': 0.012, 'grapa_cada': 2.0, 'lados': 6, 'tol': 0.05, 'tol_marco': 0.11}
ORDEN = ['Prop_Escenario', 'Prop_BocinaTocon', 'Prop_PieMicro', 'Prop_Ampli', 'Prop_CajaEquipo', 'Prop_Pad', 'Prop_TamboRayo']
CARAS = {'Prop_Pad_Cara': 'Prop_Pad', 'Prop_Escenario_Hojas': 'Prop_Escenario',
         **{f'Prop_Escenario_Neon_{i}': 'Prop_Escenario' for i in range(9)}}
# Cuánta textura le toca a cada prop (densidad lineal relativa): el escenario es enorme y se ve de lejos.
DENSIDAD = {'Prop_Escenario': 0.85, 'Prop_TamboRayo': 1.15, 'Prop_CajaEquipo': 1.1,
            'Prop_Escenario_Hojas': 1.6, **{f'Prop_Escenario_Neon_{i}': 0.05 for i in range(9)},
            **{f'Prop_Escenario_Cono_{l}_{n}': 0.75 for l in 'ID' for n in range(4)}}

FUENTE_ESTENCIL = 'C:/Windows/Fonts/STENCIL.TTF'
FUENTE_RESPALDO = os.path.join(REPO, 'public', 'fonts', 'LuckiestGuy-Regular.ttf')

# Colores propios del Foro
CREMA = '#ece0bf'
TINTA = '#17171b'
MAGENTA = '#c4338f'
CEMPASUCHIL = '#e57a1f'
AMARILLO = '#e8c93a'
GAFFER = '#9fa3a1'
PAPELES = {'magenta': '#c93a92', 'naranja': '#e47b22', 'turquesa': '#2f9e9a', 'amarillo': '#e6c63c',
           'morado': '#7b44b3', 'verde': '#52a03f'}
CORTEZA = {'oscura': '#33241a', 'media': '#4b3425', 'base': '#5c4131', 'clara': '#7c5b43', 'luz': '#9c7858',
           'linea': '#21160e', 'orilla': '#cfae80', 'astilla': '#1c120a', 'mugre': '#1a110a', 'calido': '#70452f', 'frio': '#57513b'}
TAMBO = {'oscura': '#a8761b', 'base': '#e3b52d', 'clara': '#f4d35a', 'orilla': '#fcebaa'}
METAL_CLARO = {'oscuro': '#4d5562', 'base': '#7d8796', 'claro': '#a9b3c0', 'orilla': '#e6ebf0', 'oxido': '#6a4a36'}


# ---------------------------------------------------------------- geometría (ayudantes propios)

def torno(nombre, perfil, lados, material, centro=(0, 0, 0), rot=(0, 0, 0), chueco=0.0, semilla=None,
          fase=0.0, veta='Z', radio_fn=None, cerrado=False):
    """Sólido de revolución alrededor de Z: `perfil` es [(r, z), ...] de abajo hacia arriba. Un r = 0 en
    una punta cierra con abanico; si la primera o la última r no es 0, cierra con una tapa plana. Con
    `cerrado` el perfil es una vuelta (un aro): el último punto se une con el primero, sin tapas.
    `radio_fn(r, z, angulo)` deforma cada vértice (raíces, abolladuras)."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    anillos = []
    for r, z in perfil:
        if r <= 1e-6:
            anillos.append([bm.verts.new((0.0, 0.0, z))])
            continue
        fila = []
        for j in range(lados):
            a = fase + 2 * math.pi * j / lados
            rr = radio_fn(r, z, a) if radio_fn else r
            fila.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z)))
        anillos.append(fila)
    pares = list(zip(anillos, anillos[1:])) + ([(anillos[-1], anillos[0])] if cerrado else [])
    for A, B in pares:
        if len(A) == 1 and len(B) == 1:
            continue
        for j in range(lados):
            k = (j + 1) % lados
            if len(A) == 1:
                bm.faces.new((A[0], B[k], B[j]))
            elif len(B) == 1:
                bm.faces.new((A[j], A[k], B[0]))
            else:
                bm.faces.new((A[j], A[k], B[k], B[j]))
    if len(anillos[0]) > 1 and not cerrado:
        bm.faces.new(list(reversed(anillos[0])))
    if len(anillos[-1]) > 1 and not cerrado:
        bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if chueco:
        P._chuequear(bm, chueco, semilla)
    o = P.objeto(nombre, bm, material)
    if veta:
        P.poner_veta(o, veta, azar=semilla % 1.0)
    P._colocar(o, centro, rot)
    return o


def curva_suave(puntos, pasos=3):
    """Catmull-Rom por los puntos: un cable que cuelga redondo y no en zigzag."""
    pts = [Vector(p) for p in puntos]
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
        for s in range(pasos):
            t = s / pasos
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t))
    out.append(pts[-1])
    return out


def tubo(nombre, puntos, radio, material, lados=6, radio2=None, centro=(0, 0, 0)):
    """Un tubo (cable, asa) por una polilínea, con marcos que no se tuercen y tapas planas."""
    pts = [Vector(p) for p in puntos]
    n = len(pts)
    T = []
    for i in range(n):
        t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        T.append(t.normalized())
    arriba = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    Nn = (arriba - T[0] * arriba.dot(T[0])).normalized()
    bm = bmesh.new()
    anillos = []
    r2 = radio2 or radio
    for i in range(n):
        Nn = (Nn - T[i] * Nn.dot(T[i])).normalized()
        B = T[i].cross(Nn)
        anillos.append([bm.verts.new(pts[i] + Nn * math.cos(2 * math.pi * j / lados) * radio + B * math.sin(2 * math.pi * j / lados) * r2)
                        for j in range(lados)])
    for A, Bf in zip(anillos, anillos[1:]):
        for j in range(lados):
            k = (j + 1) % lados
            bm.faces.new((A[j], A[k], Bf[k], Bf[j]))
    bm.faces.new(list(reversed(anillos[0])))
    bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    P._colocar(o, centro, (0, 0, 0))
    return o


def bloque(nombre, tam, material, centro=(0, 0, 0), rot=(0, 0, 0), bisel=0.01, segmentos=1, chueco=0.0, veta=None, semilla=None):
    """Una caja sin subdividir (para lo chico: esquineros, broches, placas), con bisel de pocos segmentos."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=tam, verts=bm.verts)
    if chueco:
        P._chuequear(bm, chueco, semilla)
    o = P.objeto(nombre, bm, material)
    if veta:
        P.poner_veta(o, veta, azar=semilla % 1.0)
    if bisel:
        P.biselar(o, min(bisel, min(tam) * 0.45), segmentos)
    P._colocar(o, centro, rot)
    return o


def contorno_redondo(medio_x, medio_y, radio, segs):
    """Puntos (x, y) de un rectángulo de esquinas redondas, en contra de las manecillas."""
    pts = []
    for cx, cy, a0 in ((medio_x - radio, -medio_y + radio, -90), (medio_x - radio, medio_y - radio, 0),
                       (-medio_x + radio, medio_y - radio, 90), (-medio_x + radio, -medio_y + radio, 180)):
        for s in range(segs + 1):
            a = math.radians(a0 + 90 * s / segs)
            pts.append((cx + math.cos(a) * radio, cy + math.sin(a) * radio))
    return pts


def losa_redonda(nombre, medio, radio, perfil, material, segs=5, tapa_arriba=False, tapa_abajo=False):
    """Un rectángulo de esquinas redondas extruido por anillos: `perfil` es [(desfase, z), ...]; el
    desfase agranda (+) o achica (-) el contorno sin perder lo redondo de las esquinas."""
    bm = bmesh.new()
    anillos = []
    for d, z in perfil:
        r = max(radio + d, 0.004)
        anillos.append([bm.verts.new((x, y, z)) for x, y in contorno_redondo(medio[0] + d, medio[1] + d, r, segs)])
    m = len(anillos[0])
    for A, B in zip(anillos, anillos[1:]):
        for j in range(m):
            k = (j + 1) % m
            bm.faces.new((A[j], A[k], B[k], B[j]))
    if tapa_abajo:
        bm.faces.new(list(reversed(anillos[0])))
    if tapa_arriba:
        bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def bvh_de(objs):
    """Un BVH con las caras de varios objetos, en el mundo (para apoyar lo que se pega)."""
    verts, polys = [], []
    for o in objs:
        base = len(verts)
        mw = o.matrix_world
        verts += [mw @ v.co for v in o.data.vertices]
        polys += [[base + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, polys)


def marco_calca(plano, normal, giro):
    """Los ejes (u, v, n) en el mundo de una calca de `pegar` (mismo giro y mismo espejo que _marco), y los
    índices de los dos ejes del plano."""
    i, j = 'XYZ'.index(plano[0]), 'XYZ'.index(plano[1])
    k = 3 - i - j
    s = normal[k]
    espejo = (plano == 'XZ' and s > 0) or (plano == 'YZ' and s < 0) or (plano == 'XY' and s < 0)
    se = -1.0 if espejo else 1.0
    ei, ej = Vector((0.0, 0.0, 0.0)), Vector((0.0, 0.0, 0.0))
    ei[i] = 1.0
    ej[j] = 1.0
    cg, sg = math.cos(giro), math.sin(giro)
    return ei * (se * cg) + ej * sg, ei * (-se * sg) + ej * cg, Vector(normal).normalized(), i, j


def lamina(nombre, material, objetivos, centro, tam, plano='XZ', normal=(0, -1, 0), giro=0.0, grueso=0.002,
           despegue=0.0006, plana=True, curva=0.0, esquinas=(0.0, 0.0, 0.0, 0.0), cortes=(4, 5), vecindad=0.015,
           puntas=0.0, semilla=1):
    """Algo pegado de verdad (hoja, cinta): una placa de `grueso` despegada `despegue` de lo más alto que
    tenga debajo en `objetivos`, así cruza las ranuras sin hundirse ni cortarse. `plana` la deja a una sola
    altura; si no, sigue la superficie punto por punto (lo más alto a `vecindad`: pasa sobre la ranura y se
    sube a la hoja que tapa). `curva` levanta las dos orillas a lo largo (la curvita del papel), `esquinas`
    cada esquina (abajo izq., abajo der., arriba der., arriba izq.) y `puntas` rompe en zigzag las puntas
    de una cinta. Todo lo que se agrega es hacia afuera: nunca baja de la superficie. Lleva su cara de
    abajo (se ve en las esquinas levantadas). En el plano, centro y giro como `pegar`."""
    u, v, n, i, j = marco_calca(plano, normal, giro)
    w, h = tam
    nu, nv = cortes
    bvh = bvh_de(objetivos)
    lejos = max((o.matrix_world @ Vector(c)).dot(n) for o in objetivos for c in o.bound_box) + 0.1
    c0 = Vector((0.0, 0.0, 0.0))
    c0[i], c0[j] = centro
    rnd = random.Random(semilla)

    def sobre(a, b):
        mejor = None
        pasos = [(0.0, 0.0)] + ([(vecindad, 0.0), (-vecindad, 0.0), (0.0, vecindad), (0.0, -vecindad)] if vecindad else [])
        for da, db in pasos:
            loc = bvh.ray_cast(c0 + u * (a + da) + v * (b + db) + n * lejos, -n, 10.0)[0]
            if loc is not None:
                d = loc.dot(n)
                mejor = d if mejor is None else max(mejor, d)
        return mejor

    muestras = [sobre(-w / 2 + w * x / 6, -h / 2 + h * y / 6) for x in range(7) for y in range(7)]
    base = max(x for x in muestras if x is not None)
    puntos = [[(-w / 2 + w * x / nu, -h / 2 + h * y / nv) for y in range(nv + 1)] for x in range(nu + 1)]
    if puntas:
        for y in range(nv + 1):
            for x in (0, nu):
                a, b = puntos[x][y]
                puntos[x][y] = (a + rnd.uniform(-puntas, puntas), b)
    esq = ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))
    alcance = 0.75 * min(w, h)

    def levanta(a, b):
        sube = curva * (2 * a / w) ** 2
        for (ca, cb), e in zip(esq, esquinas):
            if e:
                sube += e * max(0.0, 1 - math.hypot(a - ca, b - cb) / alcance) ** 2
        return sube

    bm = bmesh.new()
    abajo, arriba = [], []
    for x in range(nu + 1):
        fa, fr = [], []
        for y in range(nv + 1):
            a, b = puntos[x][y]
            d = base
            if not plana:
                aqui = sobre(a, b)
                d = aqui if aqui is not None else base
            d += despegue + levanta(a, b)
            q = c0 + u * a + v * b
            fa.append(bm.verts.new(q + n * d))
            fr.append(bm.verts.new(q + n * (d + grueso)))
        abajo.append(fa)
        arriba.append(fr)
    for x in range(nu):
        for y in range(nv):
            bm.faces.new((arriba[x][y], arriba[x + 1][y], arriba[x + 1][y + 1], arriba[x][y + 1]))
            bm.faces.new((abajo[x][y + 1], abajo[x + 1][y + 1], abajo[x + 1][y], abajo[x][y]))
    vuelta = [(x, 0) for x in range(nu)] + [(nu, y) for y in range(nv)] + [(x, nv) for x in range(nu, 0, -1)] + [(0, y) for y in range(nv, 0, -1)]
    for (x0, y0), (x1, y1) in zip(vuelta, vuelta[1:] + vuelta[:1]):
        bm.faces.new((abajo[x0][y0], abajo[x1][y1], arriba[x1][y1], arriba[x0][y0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def revisar_apoyo(pegado, soporte):
    """Que nada de lo pegado (`pegado`) quede adentro de `soporte`: desde cada vértice, un rayo hacia la
    superficie; si la superficie queda del lado de afuera del vértice, se metió. Imprime cuántos y cuánto."""
    bvh = bvh_de([soporte])
    malos, peor = 0, 0.0
    for vt in pegado.data.vertices:
        p = pegado.matrix_world @ vt.co
        for n in (Vector((0, 0, 1)), Vector((0, -1, 0))):
            loc = bvh.ray_cast(p + n * 0.05, -n, 0.06)[0]
            if loc is not None:
                prof = loc.dot(n) - p.dot(n)
                if prof > 1e-5:
                    malos += 1
                    peor = max(peor, prof)
    print(f'  {pegado.name}: {malos} vértices adentro de {soporte.name} (lo más hondo {peor * 1000:.2f} mm)')
    return malos


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


def tubo_neon(nombre, pts, radio, material, cerrado=False, lados=8, normal=Vector((0, -1, 0))):
    """Un tubo de neón por un camino plano: redondo y liso, con las puntas redondas (media esfera) si es
    abierto, o cerrado sobre sí mismo. El camino va en el plano perpendicular a `normal`."""
    n = len(pts)
    bm = bmesh.new()
    anillos = []
    for i in range(n):
        if cerrado:
            t = pts[(i + 1) % n] - pts[(i - 1) % n]
        else:
            t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        t.normalize()
        b = t.cross(normal).normalized()
        anillos.append([bm.verts.new(pts[i] + normal * (math.cos(2 * math.pi * j / lados) * radio) + b * (math.sin(2 * math.pi * j / lados) * radio))
                        for j in range(lados)])
    pares = list(zip(anillos, anillos[1:])) + ([(anillos[-1], anillos[0])] if cerrado else [])
    for A, B in pares:
        for j in range(lados):
            k = (j + 1) % lados
            bm.faces.new((A[j], A[k], B[k], B[j]))
    if not cerrado:
        for extremo, vecino, ring in ((pts[0], pts[1], anillos[0]), (pts[-1], pts[-2], anillos[-1])):
            afuera = (extremo - vecino).normalized()
            prev = ring
            for ang in (math.radians(45), math.radians(72)):
                nuevo = [bm.verts.new(extremo + afuera * (math.sin(ang) * radio) + (v.co - extremo) * math.cos(ang)) for v in ring]
                for j in range(lados):
                    k = (j + 1) % lados
                    bm.faces.new((prev[j], prev[k], nuevo[k], nuevo[j]))
                prev = nuevo
            polo = bm.verts.new(extremo + afuera * radio)
            for j in range(lados):
                bm.faces.new((prev[j], prev[(j + 1) % lados], polo))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def orientar(pts, antihorario):
    area = sum(p.x * q.y - q.x * p.y for p, q in zip(pts, pts[1:] + pts[:1])) / 2
    return pts if (area > 0) == antihorario else pts[::-1]


def dentro_de(p, lazo):
    """¿El punto 2D `p` está dentro del lazo? (par-impar)."""
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
    """Una letra de bloque de lámina: costados por fuera y por dentro (con su grueso `pared`), el filo del
    frente, el fondo que se ve por el frente abierto y la espalda. `lazos` = [(puntos (x, z) en metros, hueco)]."""
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


def filas_neon(nombre, filas, a_m, y, radio, lados, material):
    """Los tubos de neón de una letra: rectos y horizontales, con la punta en un pico corto (son 270 en la
    palabra: de pocos lados y puntas de un abanico)."""
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
    return P.objeto(nombre, bm, material)


def grapas(nombre, lazo, y, radio, cada, material):
    """Grapitas que sujetan el tubo del contorno a la lámina: una cada `cada` m, del lado de la letra
    (a la izquierda del lazo orientado)."""
    bm = bmesh.new()
    n = len(lazo)
    largo = [0.0]
    for a, b in zip(lazo, lazo[1:] + lazo[:1]):
        largo.append(largo[-1] + (b - a).length)
    total = largo[-1]
    meta = cada * 0.5
    k = 0
    while meta < total:
        while largo[k + 1] < meta:
            k += 1
        a, b = lazo[k], lazo[(k + 1) % n]
        t = (b - a).normalized()
        p = a.lerp(b, (meta - largo[k]) / max(largo[k + 1] - largo[k], 1e-9))
        izq = Vector((-t.y, t.x))
        c = p + izq * (radio * 0.45)
        x_ax, y_ax, z_ax = Vector((izq.x, 0.0, izq.y)), Vector((0.0, 1.0, 0.0)), Vector((t.x, 0.0, t.y))
        M = Matrix((
            (x_ax.x * radio * 2.7, y_ax.x * radio * 2.5, z_ax.x * 0.011, c.x),
            (x_ax.y * radio * 2.7, y_ax.y * radio * 2.5, z_ax.y * 0.011, y),
            (x_ax.z * radio * 2.7, y_ax.z * radio * 2.5, z_ax.z * 0.011, c.y),
            (0.0, 0.0, 0.0, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)
        meta += cada
    return P.objeto(nombre, bm, material)


def letrero_neon(m):
    """ESCENARIO en runas de SKULLEYGLYPH como letras de neón de bloque (Oscar, 2026-11-24, con su referencia):
    letras hondas de lámina pintada con óxido, el frente abierto lleno de filas de tubos de neón y un tubo
    oxidado que sigue el contorno, sujeto con grapas. Se paran solas arriba de la pared del fondo, sobre un
    bastidor de fierro atornillado a los postes. Todo sale de scripts/estilo/neon_escenario.json (runas_neon.mjs,
    unidades de runa con la y hacia abajo). Regresa las filas (un objeto por letra, en orden de lectura) y lo
    que va en la malla pintada."""
    datos = json.load(open(NEON_JSON, encoding='utf-8'))
    esc = NEON['ancho'] / datos['ancho']
    y1 = datos['y1']

    def a_m(x, y):
        return (x * esc, NEON['base'] + (y1 - y) * esc)

    y_f = NEON['frente']
    hondo, pared = NEON['hondo'] * esc, NEON['pared'] * esc
    letras, fijos = [], []
    for i, letra in enumerate(datos['letras']):
        lazos = []
        for c in letra['contornos']:
            pts = simplificar_lazo([Vector(a_m(x, y)) for x, y in c['pts']], NEON['tol'] * esc)
            lazos.append((pts, c['hueco']))
        fijos.append(letra_bloque(f'letra_{i}', lazos, m['lamina'], y_f, hondo, pared))
        exteriores = [pts for pts, hueco in lazos if not hueco]
        for j, lazo in enumerate(letra['marco']):
            pts = simplificar_lazo([Vector(a_m(x, y)) for x, y in lazo], NEON['tol_marco'] * esc)
            hueco = any(dentro_de(pts[0], e) for e in exteriores)
            pts = orientar(pts, not hueco)
            y_m = y_f + NEON['marco_atras']
            fijos.append(tubo_neon(f'marco_{i}_{j}', [Vector((p.x, y_m, p.y)) for p in pts], NEON['radio_marco'] * esc, m['oxido'],
                                   cerrado=True, lados=NEON['lados']))
            fijos.append(grapas(f'grapas_{i}_{j}', pts, y_m, NEON['radio_marco'] * esc, NEON['grapa_cada'] * esc, m['oxido']))
        filas = filas_neon(f'Prop_Escenario_Neon_{i}', letra['filas'], a_m, y_f + NEON['metido'] * esc, NEON['radio_fila'] * esc,
                           NEON['lados'], m['neon'])
        suavizar(filas)
        origen_al_centro(filas)
        letras.append(filas)
    # el bastidor: una repisa de fierro sobre la pared que llega a los cuatro postes, dos soleras atornilladas
    # a los postes de en medio y un travesaño atrás de las letras
    y_atras = y_f + hondo
    fijos.append(bloque('repisa', (4.9, 0.19, 0.008), m['hierro'], centro=(0.0, y_f + 0.09, NEON['base'] - 0.004), bisel=0.002))
    fijos.append(bloque('repisa_ceja', (4.9, 0.008, 0.06), m['hierro'], centro=(0.0, y_atras + 0.016, NEON['base'] + 0.026), bisel=0.002))
    for x in (-0.98, 0.98):
        fijos.append(bloque(f'solera_{x}', (0.05, 0.008, 0.66), m['hierro'], centro=(x, y_atras + 0.025, NEON['base'] + 0.32), bisel=0.002))
        for z in (NEON['base'] + 0.1, NEON['base'] + 0.56):
            fijos.append(torno(f'tornillo_{x}_{z}', [(0.0, 0.0), (0.011, 0.0), (0.011, 0.008), (0.0, 0.008)], 6, m['hierro'],
                               centro=(x, y_atras + 0.021, z), rot=(math.pi / 2, 0, 0), veta=None))
    fijos.append(bloque('travesano', (3.7, 0.02, 0.04), m['hierro'], centro=(0.0, y_atras + 0.012, NEON['base'] + 0.46), bisel=0.002))
    # una sola calca, en el costado derecho de la última letra (sin calavera: la del grupo está en la pared)
    ult = [p for pts, hueco in lazos if not hueco for p in pts]
    der = max(ult, key=lambda p: p.x)
    pegar(m['lamina'], (y_f + hondo * 0.5, der.y), (0.1, 0.1), plano='YZ', normal=(1, 0, 0), fondo=AMARILLO, borde='#f6f1e4',
          imagen=FIG['rayo'], color=TINTA, radio=0.5, giro=0.15, capa=('X', der.x - 0.06, der.x + 0.02))
    print(f'  neón: {datos["ancho"] * esc:.2f} m de ancho, letras de {(datos["y1"] - datos["y0"]) * esc:.2f} m, {hondo * 100:.0f} cm de hondo, '
          f'{sum(len(l["filas"]) for l in datos["letras"])} filas')
    return letras, fijos


def revisar_letrero(letras_lamina, pared_top, postes):
    """Que las letras no atraviesen la pared (todo arriba de su orilla) ni los postes de atrás."""
    bajo = min((o.matrix_world @ v.co).z for o in letras_lamina for v in o.data.vertices)
    choques = 0
    for o in letras_lamina:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            for x, y, r, alto in postes:
                if math.hypot(p.x - x, p.y - y) < r and p.z < alto:
                    choques += 1
    print(f'  letrero: lo más bajo de las letras {bajo:.3f} m (la pared llega a {pared_top:.3f}); {choques} vértices dentro de los postes')


def rayar(mat, color, fuerza=0.35):
    """Rayones finos encima de un material ya armado (el negro de los gabinetes no va plano): líneas
    claras en dos direcciones, cortas y disparejas."""
    N, em, col = _insertar(mat)
    tc = N.n('ShaderNodeTexCoord')
    pos = tc.outputs['Object']
    total = None
    for escala in ((1.2, 70.0, 70.0), (70.0, 70.0, 1.2), (40.0, 1.6, 40.0)):
        linea = P.suave(N, N.ruido(N.escalar(pos, escala), 1.0, detalle=1.0), 0.66, 0.7)
        corta = P.suave(N, N.ruido(N.escalar(pos, (5.0, 5.0, 5.0)), 1.0, detalle=1.0), 0.55, 0.65)
        r = N.val('MULTIPLY', linea, corta)
        total = r if total is None else N.val('MAXIMUM', total, r)
    col = N.mezcla(N.val('MULTIPLY', total, fuerza), col, color)
    N.l(col, em.inputs['Color'])


def cono(nombre, radio, material, tweeter=False, lados=18):
    """Un cono de bocina viendo hacia -Y con el origen al centro de su orilla (el sitio lo hace latir):
    suspensión de hule, el cono hundido y la tapa del centro; el tweeter, un domo. Va enfrente de la cara
    del gabinete (de z 0.004 hacia adelante), dentro del aro amarillo, que es más alto."""
    R = radio
    if tweeter:
        perfil = [(0.0, 0.004), (R, 0.004), (R * 0.96, 0.013), (R * 0.82, 0.014), (R * 0.62, 0.012 + 0.32 * R), (R * 0.32, 0.012 + 0.5 * R), (0.0, 0.012 + 0.56 * R)]
    else:
        perfil = [(0.0, 0.004), (R, 0.004), (R * 0.97, 0.02), (R * 0.9, 0.028), (R * 0.83, 0.02), (R * 0.6, 0.014), (R * 0.31, 0.008),
                  (R * 0.28, 0.01), (R * 0.24, 0.008 + 0.07 * R), (R * 0.14, 0.008 + 0.115 * R), (0.0, 0.008 + 0.13 * R)]
    o = torno(nombre, perfil, lados, material, rot=(math.pi / 2, 0, 0), veta=None)
    suavizar(o)
    return o


def aro_bocina(nombre, radio, ancho, material, lados=18):
    """El aro amarillo grueso de una bocina, de canto redondeado, sobre la cara del gabinete."""
    R, w = radio, ancho
    perfil = [(R - 0.003, 0.0), (R + w, 0.0), (R + w, 0.024), (R + w * 0.5, 0.042), (R - 0.003, 0.03)]
    return torno(nombre, perfil, lados, material, rot=(math.pi / 2, 0, 0), veta=None, cerrado=True)


def gabinete(nombre, ancho, hondo, alto, m, conos_cara, esquinas=True):
    """Un gabinete de bocina en su marco (base al centro en el piso, cara hacia -Y): caja negra de orillas
    muy redondas, esquineras de metal con remache en las cuatro esquinas de enfrente y los aros amarillos.
    Regresa sus piezas y los conos (en su marco, cada uno con su centro)."""
    piezas = [bloque(nombre, (ancho, hondo, alto), m['gabinete'], centro=(0, 0, alto / 2), bisel=min(0.075, alto * 0.12), segmentos=3, chueco=0.004)]
    conos = []
    cara = -hondo / 2
    for k, (x, z, R, tw) in enumerate(conos_cara):
        piezas.append(aro_bocina(f'{nombre}_aro{k}', R, 0.026 if tw else max(0.045, R * 0.22), m['aro']))
        piezas[-1].data.transform(Matrix.Translation((x, cara, z)))
        conos.append(((x, cara, z), R, tw))
    if esquinas:
        e = 0.115
        for sx in (-1, 1):
            for sz in (0, 1):
                c = (sx * (ancho / 2 - e * 0.32), cara + e * 0.32, (alto - e * 0.32) if sz else e * 0.32)
                piezas.append(bloque(f'{nombre}_esq{sx}{sz}', (e, e, e), m['metal_claro'], centro=c, bisel=0.034))
                piezas.append(torno(f'{nombre}_rem{sx}{sz}', [(0.0, 0.0), (0.02, 0.0), (0.017, 0.011), (0.0, 0.015)], 6, m['metal_claro'],
                                    centro=(c[0] + sx * 0.008, cara - e * 0.18, c[2] + (0.008 if sz else -0.008)), rot=(math.pi / 2, 0, 0), veta=None))
    return piezas, conos


def combo(nombre, ancho, hondo, alto, m):
    """El combo chico: caja negra redondeada, rejilla tejida, panel de control amarillo con perillas
    plateadas y esquineras con remache."""
    piezas, _ = gabinete(nombre, ancho, hondo, alto, m, [])
    cara = -hondo / 2
    piezas.append(bloque(f'{nombre}_rejilla', (ancho - 0.13, 0.014, alto * 0.58), m['tela_bocina'], centro=(0, cara - 0.002, alto * 0.37), bisel=0.007))
    piezas.append(bloque(f'{nombre}_panel', (ancho - 0.14, 0.016, alto * 0.2), m['aro'], centro=(0, cara - 0.003, alto * 0.8), bisel=0.008))
    for k, x in enumerate((-0.13, 0.0, 0.13)):
        piezas.append(torno(f'{nombre}_perilla{k}', [(0.0, 0.0), (0.024, 0.0), (0.024, 0.016), (0.018, 0.026), (0.0, 0.028)], 9, m['metal_claro'],
                            centro=(x * ancho / 0.62, cara - 0.011, alto * 0.8), rot=(math.pi / 2, 0, 0), veta=None))
    return piezas


def torre(lado, base, giro, pila, m):
    """Una torre de bocinas parada en el piso: `pila` de abajo hacia arriba, cada uno
    ('gabinete' | 'combo', ancho, hondo, alto, conos, giro propio, dx, dy), o con 'piso' en vez de apilado
    (el combo al pie: dx, dy desde la base). Regresa piezas pintadas y conos (objetos hijos) ya en su lugar."""
    M_torre = Matrix.Translation((base[0], base[1], 0.0)) @ Matrix.Rotation(giro, 4, 'Z')
    piezas, conos, z = [], [], 0.0
    n_cono = 0
    for k, (tipo, ancho, hondo, alto, caras, giro_propio, dx, dy, *resto) in enumerate(pila):
        al_piso = bool(resto and resto[0] == 'piso')
        M = M_torre @ Matrix.Translation((dx, dy, 0.0 if al_piso else z)) @ Matrix.Rotation(giro_propio, 4, 'Z')
        nombre = f'torre{lado}_{k}'
        if tipo == 'combo':
            partes, cs = combo(nombre, ancho, hondo, alto, m), []
        else:
            partes, cs = gabinete(nombre, ancho, hondo, alto, m, caras)
        for o in partes:
            o.data.transform(M)
        piezas += partes
        for (c, R, tw) in cs:
            obj = cono(f'Prop_Escenario_Cono_{lado}_{n_cono}', R, m['cono'], tweeter=tw, lados=14 if tw else 18)
            obj.matrix_world = M @ Matrix.Translation(c)
            conos.append(obj)
            n_cono += 1
        if not al_piso:
            z += alto
    return piezas, conos, z


def torres_bocinas(m):
    """Las dos torres de bocinas a los lados del escenario (concept del hermano de Oscar, 2026-11-24):
    paradas en el piso junto a la tarima, distintas entre sí y giradas hacia el público, cada una con su
    cable que se mete por debajo de la tarima. Regresa las piezas pintadas, los conos y la altura de cada torre."""
    piezas, conos, altos = [], [], {}
    # izquierda: bajos con dos conos, encima un gabinete con cono y tweeter, y el combo hasta arriba
    p, c, altos['I'] = torre('I', (-3.18, -0.78), math.radians(10), [
        ('gabinete', 1.0, 0.78, 1.35, [(0.0, 0.36, 0.205, False), (0.0, 0.98, 0.205, False)], 0.0, 0.0, 0.0),
        ('gabinete', 0.86, 0.7, 0.92, [(0.0, 0.34, 0.19, False), (0.0, 0.73, 0.06, True)], math.radians(3), 0.015, 0.03),
        ('combo', 0.62, 0.4, 0.46, [], math.radians(-7), 0.05, 0.05)], m)
    piezas += p
    conos += c
    # derecha: más girada, de otras proporciones, con el combo en el piso a un lado
    p, c, altos['D'] = torre('D', (3.24, -0.62), math.radians(-16), [
        ('gabinete', 1.05, 0.8, 1.45, [(0.0, 0.39, 0.215, False), (0.0, 1.05, 0.215, False)], 0.0, 0.0, 0.0),
        ('gabinete', 0.9, 0.72, 1.18, [(0.0, 0.42, 0.205, False), (0.0, 0.9, 0.065, True)], math.radians(-2), -0.02, 0.02),
        ('combo', 0.62, 0.4, 0.46, [], math.radians(-14), 0.98, -0.42, 'piso')], m)
    piezas += p
    conos += c
    # los cables por el piso hasta abajo de la tarima (sin tocar los troncos)
    for lado, pts in (('I', [(-3.0, -0.3, 0.2), (-2.98, -0.24, 0.09), (-2.95, -0.16, 0.012), (-2.75, 0.15, 0.012), (-2.58, 0.45, 0.012), (-2.46, 0.72, 0.012)]),
                      ('D', [(3.02, -0.14, 0.22), (3.0, -0.06, 0.09), (2.96, 0.04, 0.012), (2.78, 0.3, 0.012), (2.6, 0.55, 0.012), (2.48, 0.86, 0.012)])):
        piezas.append(tubo(f'cable_torre{lado}', curva_suave(pts, 3), 0.011, m['negro'], lados=5))
    # pegatinas de gira gastadas (dos, sin calavera): una estrella amarilla en el costado de afuera de los
    # bajos de la izquierda y una calca magenta con su rayo en el costado del gabinete de arriba de la derecha
    def en_mundo(base, giro, dx, dy, z0, giro_propio, local):
        M = Matrix.Translation((base[0], base[1], 0.0)) @ Matrix.Rotation(giro, 4, 'Z') @ Matrix.Translation((dx, dy, z0)) @ Matrix.Rotation(giro_propio, 4, 'Z')
        return M @ Vector(local), (M.to_3x3() @ Vector((1.0 if local[0] > 0 else -1.0, 0.0, 0.0))).normalized()

    p, n = en_mundo((-3.18, -0.78), math.radians(10), 0.0, 0.0, 0.0, 0.0, (-0.5, 0.0, 0.85))
    pegar(m['gabinete'], (p.y, p.z), (0.3, None), plano='YZ', normal=tuple(n), imagen=FIG['estrella'], color=AMARILLO,
          gasto=0.45, giro=0.18, capa=('X', p.x - 0.12, p.x + 0.12))
    p, n = en_mundo((3.24, -0.62), math.radians(-16), -0.02, 0.02, 1.45, math.radians(-2), (0.45, 0.0, 0.62))
    pegar(m['gabinete'], (p.y, p.z), (0.17, 0.12), plano='YZ', normal=tuple(n), fondo=MAGENTA, borde='#f6f1e4',
          imagen=FIG['rayo'], color='#f6f1e4', radio=0.25, giro=-0.12, gasto=0.4, capa=('X', p.x - 0.14, p.x + 0.14))
    return piezas, conos, altos


def revisar_choques(a, b, nombre):
    """Intersección de mallas: cuántos triángulos de `a` se cruzan con triángulos de `b`."""
    n = len(bvh_de(a).overlap(bvh_de(b)))
    print(f'  {nombre}: {n} cruces de triángulos')
    return n


def caras_donde(o, prueba):
    """Índices de las caras (normal, centro) que cumplen `prueba`."""
    return [p.index for p in o.data.polygons if prueba(p.normal, p.center)]


def quitar_caras(o, prueba):
    """Borra las caras que nunca se ven (la base contra el piso, lo tapado), en modo edición para
    conservar normales y atributos."""
    malas = set(caras_donde(o, prueba))
    if not malas:
        return 0
    for p in o.data.polygons:
        p.select = p.index in malas
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in o.data.polygons:
        p.select = p.index in malas
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='FACE')
    bpy.ops.object.mode_set(mode='OBJECT')
    return len(malas)


def asignar(o, material, prueba):
    """Pone `material` en las caras que cumplen `prueba` (lo agrega como ranura si hace falta)."""
    mats = o.data.materials
    if material.name not in [m.name for m in mats if m]:
        mats.append(material)
    idx = [m.name if m else '' for m in mats].index(material.name)
    for i in caras_donde(o, prueba):
        o.data.polygons[i].material_index = idx


def poner_anillos(o, eje, centro, radio, azar=None):
    """El atributo `Anillo` de un corte de tronco (lo lee material_corte): x, y = el punto en el plano
    perpendicular a `eje`, desde el centro del tronco y en radios; z = un azar por pieza."""
    me = o.data
    a = 'XYZ'.index(eje)
    otros = [i for i in range(3) if i != a]
    azar = random.random() if azar is None else azar
    datos = []
    for v in me.vertices:
        c = v.co
        datos += [(c[otros[0]] - centro[0]) / radio, (c[otros[1]] - centro[1]) / radio, azar, 1.0]
    at = me.color_attributes.get('Anillo') or me.color_attributes.new('Anillo', 'FLOAT_COLOR', 'POINT')
    at.data.foreach_set('color', datos)


def origen_al_centro(o):
    """Mueve el origen de un objeto al centro de su caja (las caras: el sitio las toma por ahí)."""
    pts = [Vector(c) for c in o.bound_box]
    c = sum(pts, Vector()) / 8
    o.data.transform(Matrix.Translation(-c))
    o.location = o.location + c


def suavizar(o):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))


def uv_cara(o, ejes):
    """Segundo UV (`UVCara`) de 0 a 1 sobre la caja de la cara, en los ejes locales dados ('XZ' o 'XY')."""
    me = o.data
    i, j = ('XYZ'.index(ejes[0]), 'XYZ'.index(ejes[1]))
    co = [v.co for v in me.vertices]
    lo_i, hi_i = min(c[i] for c in co), max(c[i] for c in co)
    lo_j, hi_j = min(c[j] for c in co), max(c[j] for c in co)
    capa = me.uv_layers.get('UVCara') or me.uv_layers.new(name='UVCara')
    for lp in me.loops:
        c = me.vertices[lp.vertex_index].co
        capa.data[lp.index].uv = ((c[i] - lo_i) / (hi_i - lo_i), (c[j] - lo_j) / (hi_j - lo_j))
    me.uv_layers.active_index = 0
    me.uv_layers[0].active_render = True


def escalar_islas(o, factor):
    """Achica en el atlas las islas que casi no se ven: `factor(normal, centro)` por cara (1 = igual),
    promediado por área en cada isla y aplicado desde su centro antes de empacar."""
    me = o.data
    uv = me.uv_layers.active.data
    padre = list(range(len(me.polygons)))

    def raiz(x):
        while padre[x] != x:
            padre[x] = padre[padre[x]]
            x = padre[x]
        return x

    visto = {}
    for p in me.polygons:
        for li in p.loop_indices:
            k = (me.loops[li].vertex_index, round(uv[li].uv.x, 5), round(uv[li].uv.y, 5))
            if k in visto:
                padre[raiz(visto[k])] = raiz(p.index)
            else:
                visto[k] = p.index
    islas = {}
    for p in me.polygons:
        islas.setdefault(raiz(p.index), []).append(p)
    for caras in islas.values():
        area = sum(p.area for p in caras) or 1e-9
        f = sum(factor(p.normal, p.center) * p.area for p in caras) / area
        if abs(f - 1.0) < 1e-3:
            continue
        lis = [li for p in caras for li in p.loop_indices]
        cx = sum(uv[li].uv.x for li in lis) / len(lis)
        cy = sum(uv[li].uv.y for li in lis) / len(lis)
        for li in lis:
            u, v = uv[li].uv
            uv[li].uv = ((u - cx) * f + cx, (v - cy) * f + cy)


def uv_atlas_denso(objs, densidad, islas=None, margen=0.0025, angulo=55):
    """Como P.uv_atlas, pero con más o menos textura por objeto (`densidad`: factor lineal por nombre) y
    por isla (`islas`: nombre -> factor(normal, centro)), con islas más grandes (`angulo`) y un margen
    exacto en fracción del atlas (con el margen escalado de Blender, mil islas se comían el 87 %)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angulo), island_margin=0.002)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in objs:
        if islas and o.name in islas:
            escalar_islas(o, islas[o.name])
        k = densidad.get(o.name, 1.0)
        if k != 1.0:
            for d in o.data.uv_layers.active.data:
                d.uv = d.uv * k
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method='FRACTION', margin=margen, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')


def cobertura_uv(objs):
    """Qué fracción del atlas cubren las islas."""
    total = 0.0
    for o in objs:
        uv = o.data.uv_layers[0].data
        for p in o.data.polygons:
            pts = [uv[i].uv for i in p.loop_indices]
            s = sum(pts[k].x * pts[(k + 1) % len(pts)].y - pts[(k + 1) % len(pts)].x * pts[k].y for k in range(len(pts)))
            total += abs(s) / 2
    return total


def poco_visible_escenario(n, c):
    """Lo del escenario que casi no se ve: los troncos de en medio bajo la tarima, la cara de adentro
    de los de la orilla, los cantos de las tablas del piso (tapados por la de junto) y la espalda de la pared."""
    if c.z < 0.53 and -1.45 < c.y < 1.45 and abs(c.x) < 2.6:
        if abs(c.x) < 1.9:
            return 0.3
        return 1.0 if n.x * c.x > 0.3 else 0.4
    if 0.52 < c.z < 0.6 and abs(n.y) > 0.8 and -1.4 < c.y < 1.4:
        return 0.4
    if n.y > 0.8 and 1.45 < c.y < 1.56 and 0.6 < c.z < 1.95:
        return 0.6
    if c.z > 1.9 and 1.3 < c.y < 1.53 and abs(c.x) < 2.0:
        return 0.55   # las letras de neón: lámina, tubo oxidado y grapas (muchas islas chicas)
    if abs(c.x) > 2.6:
        return 0.72   # las torres de bocinas: grandes y negras
    return 1.0


def densidad_textura(o):
    """Pixeles del atlas por metro (raíz de área UV entre área 3D)."""
    me = o.data
    uv = me.uv_layers[0].data
    a3, au = 0.0, 0.0
    for p in me.polygons:
        a3 += p.area
        pts = [uv[i].uv for i in p.loop_indices]
        s = 0.0
        for k in range(len(pts)):
            x1, y1 = pts[k]
            x2, y2 = pts[(k + 1) % len(pts)]
            s += x1 * y2 - x2 * y1
        au += abs(s) / 2
    return math.sqrt(au / a3) * TAM if a3 else 0


# ---------------------------------------------------------------- materiales (ayudantes propios)

def material_corte(nombre, paleta=P.MADERA_CLARA, corteza='#3b2414'):
    """El corte de un tronco (lee el atributo `Anillo`): anillos que se tambalean con el pigmento en la
    orilla, la médula oscura, dos grietas, la corteza oscura en la orilla y el cambium claro."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    at = N.n('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='Anillo')
    sv = N.n('ShaderNodeSeparateXYZ')
    N.l(at.outputs['Vector'], sv.inputs[0])
    x, y, isla = sv.outputs['X'], sv.outputs['Y'], sv.outputs['Z']
    r = N.val('SQRT', N.val('ADD', N.val('MULTIPLY', x, x), N.val('MULTIPLY', y, y)))
    ang = N.val('ARCTAN2', y, x)
    tambaleo = N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pos, 5.0, detalle=2.0, distorsion=0.8), 0.5), 0.14)
    rr = N.val('ADD', r, tambaleo)
    col = N.rampa(isla, [(0.0, paleta['clara']), (0.5, paleta['luz'])])
    grande = N.ruido(pos, 3.0, detalle=3.0, rugosidad=0.6, distorsion=1.5)
    col = P.lavado(N, col, grande, 0.58, 0.08, paleta['luz'], 0.5, borde=0.3)
    col = P.lavado(N, col, grande, 0.42, 0.07, paleta['base'], 0.45, borde=0.3, invertido=True)
    onda = N.val('SINE', N.val('MULTIPLY', rr, 2 * math.pi * 5.5))
    varia = P.suave(N, N.ruido(pos, 9.0, detalle=1.0), 0.3, 0.7)
    banda = N.val('MULTIPLY', P.suave(N, onda, 0.35, 0.8), N.val('ADD', 0.3, N.val('MULTIPLY', varia, 0.35)))
    col = N.mezcla(banda, col, paleta['base'])
    linea = N.val('MULTIPLY', P.suave(N, onda, 0.86, 0.97), 0.7)
    col = N.mezcla(linea, col, paleta['linea'])
    col = P.lavado(N, col, r, 0.08, 0.03, paleta['oscura'], 0.85, borde=0.4, invertido=True)
    s = N.val('SINE', N.val('ADD', N.val('ADD', ang, N.val('MULTIPLY', isla, 37.0)), N.val('MULTIPLY', N.ruido(pos, 6.0), 1.6)))
    grieta = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', s), 0.0, 0.07)),
                   N.val('MULTIPLY', P.suave(N, r, 0.07, 0.14), N.val('SUBTRACT', 1.0, P.suave(N, r, 0.45, 0.8))))
    col = N.mezcla(N.val('MULTIPLY', grieta, 0.85), col, paleta['astilla'])
    orilla = N.val('ADD', r, N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pos, 14.0, detalle=2.0), 0.5), 0.1))
    claro = N.val('MULTIPLY', P.suave(N, orilla, 0.74, 0.79), N.val('SUBTRACT', 1.0, P.suave(N, orilla, 0.82, 0.86)))
    col = N.mezcla(N.val('MULTIPLY', claro, 0.45), col, paleta['orilla'])
    col = P.lavado(N, col, orilla, 0.86, 0.025, corteza, 0.95, borde=0.4)
    col = N.mezcla(N.val('MULTIPLY', P.suave(N, nz, 0.4, 0.8), 0.2), col, paleta['luz'])
    fina = P.suave(N, P.orilla_bisel(N, geo, 0.012), 0.01, 0.04)
    seco = P.suave(N, N.ruido(pos, 25.0, detalle=2.0), 0.35, 0.65)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', fina, seco), 0.7), col, paleta['orilla'])
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.06
    col = P.lavado(N, col, ao.outputs['AO'], 0.6, 0.08, paleta['mugre'], 0.55, borde=0.25, invertido=True)
    col = P.grano(N, col, pos, 0.12)
    P._salida(N, col)
    return m


def material_metal_pintado(nombre, pintura, desgaste=1.0, paleta=P.METAL, trazos=0.35, oxido=0.0):
    """Metal con una capa de pintura que se descarapela en las orillas y en manchas y deja ver el gris
    pizarra, con el filo oscuro donde se cae, óxido que escurre y la luz pintada arriba."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    campo = N.ruido(N.escalar(pos, (10.0, 10.0, 26.0)), 1.0, detalle=2.0, rugosidad=0.6, distorsion=1.4)
    met = N.rampa(campo, [(0.0, paleta['base']), (1.0, paleta['base'])])
    met = P.lavado(N, met, campo, 0.42, 0.07, paleta['oscuro'], 0.6, borde=0.35, invertido=True)
    met = P.lavado(N, met, campo, 0.6, 0.07, paleta['claro'], 0.45, borde=0.2)
    sz = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sz.inputs[0])
    altura = P.suave(N, sz.outputs['Z'], -0.2, 1.4)
    deg = N.rampa(altura, [(0.0, (0.7, 0.68, 0.68, 1)), (0.5, (0.92, 0.9, 0.9, 1)), (1.0, (1, 1, 1, 1))])
    met = N.mezcla(1.0, met, deg, 'MULTIPLY')
    b = P.suave(N, P.orilla_bisel(N, geo, 0.01), 0.01, 0.035)
    seco = P.suave(N, N.ruido(pos, 22.0, detalle=2.0), 0.35, 0.65)
    met = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', b, seco), 0.85), met, paleta['orilla'])
    grande = N.ruido(pos, 2.6, detalle=3.0, rugosidad=0.6, distorsion=1.8)
    p = N.rampa(grande, [(0.0, pintura['base']), (1.0, pintura['base'])])
    p = P.lavado(N, p, grande, 0.56, 0.08, pintura['clara'], 0.55, borde=0.3)
    p = P.lavado(N, p, grande, 0.42, 0.07, pintura['oscura'], 0.45, borde=0.3, invertido=True)
    rayas = N.ruido(N.escalar(pos, (22.0, 22.0, 2.2)), 1.0, detalle=2.0, rugosidad=0.55, distorsion=1.0)
    p = P.lavado(N, p, rayas, 0.38, 0.05, pintura['oscura'], trazos, borde=0.35, invertido=True)
    p = P.lavado(N, p, rayas, 0.64, 0.05, pintura['clara'], trazos, borde=0.2)
    p = N.mezcla(1.0, p, deg, 'MULTIPLY')
    p = N.mezcla(N.val('MULTIPLY', P.suave(N, nz, 0.4, 0.8), 0.3), p, pintura['clara'])
    p = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', b, seco), 0.75), p, pintura['orilla'])
    ancha = P.suave(N, P.orilla_bisel(N, geo, 0.04, 16), 0.01, 0.04)
    cae = N.celdas(P.deformado(N, pos, 7.0, 0.07), 11.0)
    d_cae = N.val('ADD', cae.outputs['Distance'], N.val('SUBTRACT', 1.0, ancha))
    sueltas = N.val('ADD', N.celdas(P.deformado(N, pos, 5.0, 0.08), 6.0).outputs['Distance'], N.val('MULTIPLY', N.ruido(pos, 9.0), 0.3))
    sin = N.val('MINIMUM', N.val('DIVIDE', d_cae, 0.42 * desgaste + 0.01), N.val('DIVIDE', sueltas, 0.3 * desgaste + 0.01))
    queda = P.suave(N, sin, 0.92, 1.06)
    filo = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', sin, 1.0)), 0.0, 0.12))
    c = P.srgb(pintura['oscura'])
    p = N.mezcla(N.val('MULTIPLY', filo, 0.6), p, (c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 1))
    col = N.mezcla(queda, met, p)
    ox = N.val('ADD', N.ruido(N.escalar(pos, (9.0, 9.0, 2.0)), 1.0, detalle=2.0, distorsion=1.5), N.val('MULTIPLY', altura, 0.7))
    col = P.lavado(N, col, ox, 0.6, 0.06, paleta['oxido'], 0.5, borde=0.4, invertido=True)
    if oxido:
        # manchas de óxido en cualquier altura (la lámina de un letrero viejo) y escurrimientos debajo
        mancha = N.ruido(N.escalar(pos, (7.0, 7.0, 4.0)), 1.0, detalle=3.0, rugosidad=0.6, distorsion=1.6)
        col = P.lavado(N, col, mancha, 0.66 - 0.2 * oxido, 0.05, paleta['oxido'], 0.85, borde=0.45)
        chorro = N.val('MULTIPLY', mancha, N.ruido(N.escalar(pos, (40.0, 40.0, 1.5)), 1.0, detalle=1.0))
        col = P.lavado(N, col, chorro, 0.42 - 0.1 * oxido, 0.04, paleta['oxido'], 0.5 * oxido, borde=0.3)
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.05
    col = P.lavado(N, col, ao.outputs['AO'], 0.55, 0.08, paleta['oscuro'], 0.55, borde=0.2, invertido=True)
    col = P.grano(N, col, pos, 0.12)
    P._salida(N, col)
    return m


def _insertar(mat):
    """Para pintar encima de un material ya armado: el color que llega a la emisión."""
    nt = mat.node_tree
    em = next(n for n in nt.nodes if n.type == 'EMISSION')
    entrada = em.inputs['Color'].links[0].from_socket
    N = P.Nodos.__new__(P.Nodos)
    N.nt = nt
    N.x = 6000
    return N, em, entrada


def aplanar(mat, color, cuanto):
    """Le baja los lavados a un material ya armado (la cara del pad: el sitio la tiñe y con manchas
    fuertes parecía mármol)."""
    N, em, col = _insertar(mat)
    N.l(N.mezcla(cuanto, col, color), em.inputs['Color'])


def material_rejilla(nombre, color, hueco, escala=40.0, tam=0.32, modo='puntos', fuerza=0.85, desgaste=0.0, plano='XZ', **liso):
    """Un color liso con rejilla: 'puntos' (agujeros redondos en triplanar: micro, goma) o 'tela'
    (la tela tejida de un ampli, en `plano`, con la trama que se cruza)."""
    m = P.material_liso(nombre, color, desgaste=desgaste, **liso)
    N, em, col = _insertar(m)
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    sp = N.n('ShaderNodeSeparateXYZ')
    N.l(tc.outputs['Object'], sp.inputs[0])
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(geo.outputs['True Normal'], sn.inputs[0])
    c = {'X': sp.outputs['X'], 'Y': sp.outputs['Y'], 'Z': sp.outputs['Z']}
    nrm = {'X': sn.outputs['X'], 'Y': sn.outputs['Y'], 'Z': sn.outputs['Z']}

    def fr(x):
        return N.val('SUBTRACT', N.val('FRACT', N.val('MULTIPLY', x, escala)), 0.5)

    if modo == 'puntos':
        total = None
        for a, b, k in (('X', 'Y', 'Z'), ('X', 'Z', 'Y'), ('Y', 'Z', 'X')):
            u, v = fr(c[a]), fr(c[b])
            d = N.val('SQRT', N.val('ADD', N.val('MULTIPLY', u, u), N.val('MULTIPLY', v, v)))
            punto = N.val('SUBTRACT', 1.0, P.suave(N, d, tam * 0.5 - 0.05, tam * 0.5 + 0.05))
            peso = P.suave(N, N.val('ABSOLUTE', nrm[k]), 0.55, 0.75)
            t = N.val('MULTIPLY', punto, peso)
            total = t if total is None else N.val('MAXIMUM', total, t)
    else:
        u, v = fr(c[plano[0]]), fr(c[plano[1]])
        sobre = N.val('GREATER_THAN', N.val('MULTIPLY', N.val('SINE', N.val('MULTIPLY', c[plano[0]], escala * math.pi)),
                                                      N.val('SINE', N.val('MULTIPLY', c[plano[1]], escala * math.pi))), 0.0)
        hilo = N.val('ADD', N.val('MULTIPLY', sobre, N.val('ABSOLUTE', v)), N.val('MULTIPLY', N.val('SUBTRACT', 1.0, sobre), N.val('ABSOLUTE', u)))
        total = N.val('MULTIPLY', P.suave(N, hilo, 0.28, 0.48), 0.9)
    col = N.mezcla(N.val('MULTIPLY', total, fuerza), col, hueco)
    N.l(col, em.inputs['Color'])
    return m


def _marco(N, centro, plano, normal, giro, espejo=None):
    """Coordenadas (a, b) en metros de una calca: en `plano`, desde `centro`, giradas `giro` y en espejo
    si se ve desde el lado contrario (así no sale al revés); más la máscara de las caras que la ven."""
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    sp = N.n('ShaderNodeSeparateXYZ')
    N.l(tc.outputs['Object'], sp.inputs[0])
    c = {'X': sp.outputs['X'], 'Y': sp.outputs['Y'], 'Z': sp.outputs['Z']}
    if espejo is None:
        resto = 'XYZ'.replace(plano[0], '').replace(plano[1], '')
        signo = normal['XYZ'.index(resto)]
        espejo = (plano == 'XZ' and signo > 0) or (plano == 'YZ' and signo < 0) or (plano == 'XY' and signo < 0)
    a0 = N.val('SUBTRACT', c[plano[0]], centro[0])
    if espejo:
        a0 = N.val('MULTIPLY', a0, -1.0)
    b0 = N.val('SUBTRACT', c[plano[1]], centro[1])
    cg, sg = math.cos(giro), math.sin(giro)
    a = N.val('ADD', N.val('MULTIPLY', a0, cg), N.val('MULTIPLY', b0, sg))
    b = N.val('SUBTRACT', N.val('MULTIPLY', b0, cg), N.val('MULTIPLY', a0, sg))
    nd = N.n('ShaderNodeVectorMath', operation='DOT_PRODUCT')
    N.l(geo.outputs['True Normal'], nd.inputs[0])
    nd.inputs[1].default_value = normal
    frente = P.suave(N, nd.outputs['Value'], 0.3, 0.5)
    return a, b, frente, tc.outputs['Object']


def _caja_redonda(N, a, b, mx, my, r):
    """Distancia con signo a un rectángulo de esquinas redondas (negativa adentro)."""
    qx = N.val('SUBTRACT', N.val('ABSOLUTE', a), mx - r)
    qy = N.val('SUBTRACT', N.val('ABSOLUTE', b), my - r)
    ex, ey = N.val('MAXIMUM', qx, 0.0), N.val('MAXIMUM', qy, 0.0)
    fuera = N.val('SQRT', N.val('ADD', N.val('MULTIPLY', ex, ex), N.val('MULTIPLY', ey, ey)))
    dentro = N.val('MINIMUM', N.val('MAXIMUM', qx, qy), 0.0)
    return N.val('SUBTRACT', N.val('ADD', fuera, dentro), r)


def _ruido1(N, x, escala, semilla):
    v = N.n('ShaderNodeCombineXYZ')
    N.l(N.val('MULTIPLY', x, escala), v.inputs[0])
    v.inputs[1].default_value = semilla * 7.3
    v.inputs[2].default_value = semilla * 3.1
    return N.ruido(v.outputs[0], 1.0, detalle=2.0)


def _oscuro(h, k=0.62):
    c = P.srgb(h)
    return (c[0] * k, c[1] * k, c[2] * k, 1.0)


def pegar(mat, centro, tam, plano='XZ', normal=(0, -1, 0), giro=0.0, imagen=None, color=CREMA,
          fondo=None, borde=None, ancho_borde=0.012, radio=0.2, gasto=0.2, escala_img=0.78, espejo=None, capa=None):
    """Una calca en cualquier plano del objeto. Con `fondo`, una calcomanía de esquinas redondas
    (`radio` en fracción del lado corto) con su orilla de color `borde`; con `imagen` (esténcil por su
    transparencia), la imagen de `color` (dentro de la calcomanía, si la hay). `tam` = (ancho, alto);
    alto None = lo que pida la imagen."""
    N, em, col = _insertar(mat)
    a, b, frente, pos = _marco(N, centro, plano, normal, giro, espejo)
    if capa:
        sep = N.n('ShaderNodeSeparateXYZ')
        N.l(pos, sep.inputs[0])
        q = sep.outputs['XYZ'.index(capa[0])]
        frente = N.val('MULTIPLY', frente, N.val('MULTIPLY', P.suave(N, q, capa[1] - 0.004, capa[1]), N.val('SUBTRACT', 1.0, P.suave(N, q, capa[2], capa[2] + 0.004))))
    w, h = tam
    if h is None:
        iw, ih = imagen.size
        h = w * ih / iw
    aguada = N.val('MINIMUM', N.val('ADD', 1.0 - gasto, N.val('MULTIPLY', N.ruido(pos, 7.0, detalle=2.0), gasto * 1.5)), 1.0)
    if fondo or borde:
        r = radio * min(w, h)
        d = _caja_redonda(N, a, b, w / 2, h / 2, r)
        dentro = N.val('SUBTRACT', 1.0, P.suave(N, d, -0.0012, 0.0012))
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', dentro, frente), aguada), col, borde or fondo)
        if borde and fondo:
            d2 = N.val('ADD', d, ancho_borde)
            dentro2 = N.val('SUBTRACT', 1.0, P.suave(N, d2, -0.0012, 0.0012))
            col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', dentro2, frente), aguada), col, fondo)
        orilla = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', d), 0.0, 0.004)), frente)
        col = N.mezcla(N.val('MULTIPLY', orilla, 0.4), col, _oscuro(borde or fondo, 0.55))
    if imagen:
        iw, ih = imagen.size
        if fondo:
            bw, bh = (w - 2 * ancho_borde) * escala_img, (h - 2 * ancho_borde) * escala_img
            if iw / ih > bw / bh:
                ancho_i, alto_i = bw, bw * ih / iw
            else:
                ancho_i, alto_i = bh * iw / ih, bh
        else:
            ancho_i, alto_i = w, h
        uv = N.n('ShaderNodeCombineXYZ')
        N.l(N.val('ADD', N.val('DIVIDE', a, ancho_i), 0.5), uv.inputs[0])
        N.l(N.val('ADD', N.val('DIVIDE', b, alto_i), 0.5), uv.inputs[1])
        tex = N.n('ShaderNodeTexImage', image=imagen, extension='CLIP', interpolation='Cubic')
        N.l(uv.outputs[0], tex.inputs['Vector'])
        alfa = N.val('MULTIPLY', N.val('MULTIPLY', tex.outputs['Alpha'], frente), aguada)
        col = N.mezcla(alfa, col, color)
        filo = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', tex.outputs['Alpha'], 0.5)), 0.0, 0.45))
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', filo, frente), 0.3), col, _oscuro(color, 0.7))
    N.l(col, em.inputs['Color'])


def pegar_cinta(mat, centro, largo, ancho, plano='XZ', normal=(0, -1, 0), giro=0.0, color=GAFFER, roto=0.012, semilla=1.0):
    """Un pedazo de cinta pegado: orillas largas derechas, puntas rotas en zigzag, brillo a lo largo y
    el pigmento juntado en la orilla."""
    N, em, col = _insertar(mat)
    a, b, frente, pos = _marco(N, centro, plano, normal, giro, False)
    fin = N.val('ADD', N.val('SUBTRACT', N.val('ABSOLUTE', a), largo / 2), N.val('MULTIPLY', N.val('SUBTRACT', _ruido1(N, b, 90.0, semilla), 0.5), 2.4 * roto))
    lado = N.val('SUBTRACT', N.val('ABSOLUTE', b), ancho / 2)
    d = N.val('MAXIMUM', fin, lado)
    dentro = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, d, -0.001, 0.001)), frente)
    c = P.srgb(color)
    claro = (min(1, c[0] * 1.5), min(1, c[1] * 1.5), min(1, c[2] * 1.5), 1)
    brillo = P.suave(N, _ruido1(N, b, 260.0, semilla + 3), 0.55, 0.75)
    arruga = P.suave(N, _ruido1(N, N.val('ADD', a, N.val('MULTIPLY', b, 0.4)), 40.0, semilla + 7), 0.62, 0.7)
    tono = N.mezcla(N.val('ADD', N.val('MULTIPLY', brillo, 0.35), N.val('MULTIPLY', arruga, 0.3)), color, claro)
    col = N.mezcla(N.val('MULTIPLY', dentro, 0.94), col, tono)
    orilla = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', d), 0.0, 0.003)), frente)
    col = N.mezcla(N.val('MULTIPLY', orilla, 0.45), col, _oscuro(color, 0.5))
    N.l(col, em.inputs['Color'])


def pegar_renglones(mat, centro, tam, plano='XZ', normal=(0, -1, 0), giro=0.0, semilla=2.0):
    """Los renglones garabateados a mano de una hoja (setlist), pintados en la cara de la hoja modelada."""
    N, em, col = _insertar(mat)
    a, b, frente, pos = _marco(N, centro, plano, normal, giro, False)
    w, h = tam
    v = N.val('DIVIDE', N.val('ADD', b, h / 2), h)
    u = N.val('DIVIDE', N.val('ADD', a, w / 2), w)
    dentro = N.val('MULTIPLY', N.val('MULTIPLY', P.suave(N, u, 0.0, 0.02), N.val('SUBTRACT', 1.0, P.suave(N, u, 0.98, 1.0))), frente)
    renglon = N.val('FLOOR', N.val('MULTIPLY', v, 9.0))
    t = N.val('SUBTRACT', N.val('FRACT', N.val('MULTIPLY', v, 9.0)), 0.5)
    trazo = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('ADD', t, N.val('MULTIPLY', N.val('SUBTRACT', _ruido1(N, a, 70.0, semilla), 0.5), 0.5))), 0.06, 0.13))
    largo = N.val('ADD', 0.45, N.val('MULTIPLY', _ruido1(N, renglon, 3.1, semilla + 5), 0.5))
    corto = N.val('MULTIPLY', P.suave(N, u, 0.08, 0.12), N.val('SUBTRACT', 1.0, P.suave(N, N.val('SUBTRACT', u, largo), 0.0, 0.02)))
    zona = N.val('MULTIPLY', P.suave(N, v, 0.06, 0.1), N.val('SUBTRACT', 1.0, P.suave(N, v, 0.76, 0.8)))
    tinta = N.val('MULTIPLY', N.val('MULTIPLY', N.val('MULTIPLY', trazo, corto), zona), dentro)
    col = N.mezcla(N.val('MULTIPLY', tinta, 0.85), col, '#26314f')
    N.l(col, em.inputs['Color'])


def pintar_cono(mat, centro, radio, normal=(0, -1, 0)):
    """El cono de una bocina pintado de frente: aro de metal, suspensión de hule, el cono con su brillo y
    la tapa del centro, cada uno con el pigmento juntado en su orilla."""
    N, em, col = _insertar(mat)
    a, b, frente, pos = _marco(N, centro, 'XZ', normal, 0.0, False)
    r = N.val('DIVIDE', N.val('SQRT', N.val('ADD', N.val('MULTIPLY', a, a), N.val('MULTIPLY', b, b))), radio)
    luz = N.val('DIVIDE', N.val('ADD', N.val('MULTIPLY', a, -0.6), N.val('MULTIPLY', b, 0.8)), N.val('MAXIMUM', N.val('MULTIPLY', r, radio), 0.001))
    capas = ((1.0, '#59616e', 0.97), (0.86, '#1a1a1f', 0.97), (0.72, '#2c2d34', 0.97), (0.27, '#e6dabb', 0.97))
    for lim, color, op in capas:
        dentro = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, r, lim - 0.012, lim + 0.012)), frente)
        col = N.mezcla(N.val('MULTIPLY', dentro, op), col, color)
        filo = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', r, lim)), 0.0, 0.03)), frente)
        col = N.mezcla(N.val('MULTIPLY', filo, 0.55), col, _oscuro(color, 0.45))
    anillo_sus = N.val('MULTIPLY', N.val('MULTIPLY', P.suave(N, r, 0.74, 0.79), N.val('SUBTRACT', 1.0, P.suave(N, r, 0.8, 0.85))), P.suave(N, luz, 0.2, 0.7))
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', anillo_sus, frente), 0.6), col, '#6c6d78')
    cono = N.val('MULTIPLY', P.suave(N, r, 0.28, 0.33), N.val('SUBTRACT', 1.0, P.suave(N, r, 0.68, 0.72)))
    destello = N.val('MULTIPLY', N.val('MULTIPLY', cono, P.suave(N, luz, 0.55, 0.85)), P.suave(N, N.ruido(pos, 12.0, detalle=2.0), 0.35, 0.6))
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', destello, frente), 0.55), col, '#5b5d6a')
    rayas = N.val('MULTIPLY', N.val('MULTIPLY', cono, P.suave(N, N.val('SINE', N.val('MULTIPLY', r, 60.0)), 0.7, 0.95)), 0.25)
    col = N.mezcla(N.val('MULTIPLY', rayas, frente), col, '#101014')
    tapa = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, r, 0.12, 0.22)), P.suave(N, luz, 0.3, 0.8))
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', tapa, frente), 0.7), col, '#fbf4de')
    N.l(col, em.inputs['Color'])


# ---------------------------------------------------------------- calcas dibujadas (texto, rayo)

def _render_calca(nombre, poner, ancho_px=1400):
    """Dibuja figuras planas (lo que `poner(coleccion)` ligue, en el plano XY) en blanco sobre
    transparente y devuelve la imagen empacada: así salen los textos de esténcil y el rayo. Usa la
    escena principal (en segundo plano otra escena no tiene depsgraph) y deja sus ajustes como estaban."""
    os.makedirs(TEMP, exist_ok=True)
    sc = bpy.context.scene
    obs = poner(sc.collection)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in obs:
        ev = ob.evaluated_get(dg)
        pts += [ev.matrix_world @ Vector(c) for c in ev.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), 0))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), 0))
    w, h = hi.x - lo.x, hi.y - lo.y
    m = 0.03 * max(w, h)
    cam = bpy.data.objects.new('cam_' + nombre, bpy.data.cameras.new('cam_' + nombre))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(w, h) + 2 * m
    cam.location = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 10)
    sc.collection.objects.link(cam)
    r = sc.render
    antes = (sc.camera, r.engine, r.resolution_x, r.resolution_y, r.film_transparent, r.filepath,
             r.image_settings.file_format, r.image_settings.color_mode, sc.view_settings.view_transform)
    sc.camera = cam
    r.engine = 'BLENDER_WORKBENCH'
    if w >= h:
        r.resolution_x, r.resolution_y = ancho_px, max(8, int(ancho_px * (h + 2 * m) / (w + 2 * m)))
    else:
        r.resolution_x, r.resolution_y = max(8, int(ancho_px * (w + 2 * m) / (h + 2 * m))), ancho_px
    r.film_transparent = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sh = sc.display.shading
    sh.light = 'FLAT'
    sh.color_type = 'SINGLE'
    sh.single_color = (1.0, 1.0, 1.0)
    sh.show_object_outline = False
    sh.show_cavity = False
    sh.show_shadows = False
    sh.show_specular_highlight = False
    sc.display.render_aa = '16'
    ruta = os.path.join(TEMP, nombre + '.png')
    r.filepath = ruta
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(ruta, check_existing=False)
    img.name = 'calca_' + nombre
    img.pack()
    (sc.camera, r.engine, r.resolution_x, r.resolution_y, r.film_transparent, r.filepath,
     r.image_settings.file_format, r.image_settings.color_mode, sc.view_settings.view_transform) = antes
    for ob in obs + [cam]:
        bpy.data.objects.remove(ob, do_unlink=True)
    return img


def imagen_texto(nombre, texto, renglones_sep=1.0):
    fuente = FUENTE_ESTENCIL if os.path.exists(FUENTE_ESTENCIL) else FUENTE_RESPALDO

    def poner(col):
        cu = bpy.data.curves.new('txt_' + nombre, 'FONT')
        cu.body = texto
        cu.font = bpy.data.fonts.load(fuente, check_existing=True)
        cu.align_x = 'CENTER'
        cu.align_y = 'CENTER'
        cu.space_line = renglones_sep
        ob = bpy.data.objects.new('txt_' + nombre, cu)
        col.objects.link(ob)
        return [ob]
    return _render_calca(nombre, poner)


def imagen_figura(nombre, puntos):
    def poner(col):
        bm = bmesh.new()
        vs = [bm.verts.new((x, y, 0)) for x, y in puntos]
        bm.faces.new(vs)
        me = bpy.data.meshes.new('fig_' + nombre)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new('fig_' + nombre, me)
        col.objects.link(ob)
        return [ob]
    return _render_calca(nombre, poner, ancho_px=900)


RAYO = [(0.32, 1.0), (0.70, 1.0), (0.52, 0.6), (0.78, 0.6), (0.2, -0.08), (0.37, 0.43), (0.12, 0.43)]
ESTRELLA = [((1.0 if k % 2 == 0 else 0.45) * math.cos(math.pi / 2 + k * math.pi / 5), (1.0 if k % 2 == 0 else 0.45) * math.sin(math.pi / 2 + k * math.pi / 5)) for k in range(10)]
CORAZON = [(16 * math.sin(t) ** 3, 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
           for t in (2 * math.pi * k / 48 for k in range(48))]
FLOR = [((1 + 0.32 * math.cos(8 * a)) * math.cos(a), (1 + 0.32 * math.cos(8 * a)) * math.sin(a)) for a in (2 * math.pi * k / 96 for k in range(96))]
# Las figuras de las calcas: la calaverita de Skulley va UNA vez en todo el Foro, el esténcil grande de la
# pared del escenario (Oscar, 2026-11-24: no abusar de ella); lo demás lleva rayos, estrellas, corazones y flores.
FIG = {}


# ---------------------------------------------------------------- materiales del grupo

def materiales(img):
    m = {}
    m['tronco'] = P.material_madera('Foro_Tronco', paleta=CORTEZA)
    m['corte'] = material_corte('Foro_Corte')
    m['tabla'] = P.material_madera('Foro_Tabla')
    m['bloque'] = P.material_madera('Foro_Bloque', paleta=CORTEZA)
    m['pared'] = P.material_madera('Foro_ParedNegra', pintura=P.PINTURAS['negro'], desgaste=0.75)
    m['neon'] = P.material_brillo('Foro_NeonApagado', '#b8c0c6')
    # lámina verde gastada como la referencia (el neón es magenta: se llevan bien), con óxido
    m['lamina'] = material_metal_pintado('Foro_LaminaNeon', {'oscura': '#1d4438', 'base': '#2e6a56', 'clara': '#4b8b70', 'orilla': '#a3cdb5'},
                                         desgaste=0.9, trazos=0.22, oxido=0.7)
    m['oxido'] = P.material_metal('Foro_TuboOxido', paleta={'oscuro': '#3a2015', 'base': '#5a3220', 'claro': '#8a5334', 'orilla': '#d29464',
                                                             'oxido': '#2e170c'}, oxido=0.7)
    m['hierro'] = P.material_metal('Foro_Hierro', oxido=0.5)
    # las torres de bocinas (concept): negro de juguete de vinil con rayones, aros amarillos, conos negros
    m['gabinete'] = P.material_liso('Foro_Gabinete', '#202026', claro='#3b3c46', oscuro='#121216', desgaste=0.35, orilla='#9a9daa')
    rayar(m['gabinete'], '#8a8d99', 0.3)
    m['aro'] = P.material_liso('Foro_AroAmarillo', AMARILLO, orilla='#fff5c6', desgaste=0.2)
    m['cono'] = P.material_liso('Foro_Cono', '#1b1b20', claro='#34353e', oscuro='#0e0e11', orilla='#6a6c78')
    m['tela_bocina'] = material_rejilla('Foro_TelaBocina', '#2b2b31', '#121215', escala=42.0, modo='tela', fuerza=0.6, claro='#3b3b44', oscuro='#1d1d23')
    m['poste'] = P.material_madera('Foro_Poste', paleta=CORTEZA, fino=0.6)
    m['metal'] = P.material_metal('Foro_Metal', oxido=0.3)
    m['metal_claro'] = P.material_metal('Foro_MetalClaro', paleta=METAL_CLARO, oxido=0.25)
    m['cinta'] = P.material_liso('Foro_Cinta', GAFFER, desgaste=0.25)
    m['cuerda'] = P.material_liso('Foro_Cuerda', '#d8c9a3')
    m['hoja'] = P.material_liso('Foro_Hoja', '#efe6cc', claro='#f8f2e2', oscuro='#dccfae')
    m['negro'] = P.material_liso('Foro_NegroMate', '#202024', desgaste=0.3, orilla='#5c5d66')
    for k, c in PAPELES.items():
        m['papel_' + k] = P.material_liso('Foro_Papel_' + k, c)
    # bocina
    m['tocon'] = P.material_madera('Foro_TroncoBocina')
    m['hueco'] = P.material_liso('Foro_Hueco', '#2a1c12', oscuro='#130c07')
    # ampli
    m['tolex'] = P.material_liso('Foro_Tolex', '#232328', desgaste=0.45)
    m['tela'] = material_rejilla('Foro_TelaAmpli', '#dccca4', '#9c8b66', escala=34.0, modo='tela', fuerza=0.45, claro='#ece0c2', oscuro='#c2b18a')
    m['perilla'] = P.material_liso('Foro_Perilla', '#e7dcc0')
    m['foco'] = P.material_brillo('Foro_FocoRojo', '#ff4a35')
    # micro
    m['micro_rejilla'] = material_rejilla('Foro_MicroRejilla', '#aab3bf', '#3a3f48', escala=70.0, tam=0.42, fuerza=0.75)
    # caja
    m['caja'] = P.material_madera('Foro_CajaTurquesa', pintura=P.PINTURAS['turquesa'], desgaste=0.85)
    # pad
    m['goma'] = material_rejilla('Foro_PadGoma', '#1e1e23', '#3c3d46', escala=30.0, tam=0.38, fuerza=0.7, desgaste=0.2)
    m['pad'] = P.material_liso('Foro_PadCara', '#cfcfca', claro='#dcdcd8', oscuro='#bcbcb6', desgaste=0.1, orilla='#f4f4f0')
    aplanar(m['pad'], '#cfcfca', 0.55)
    # tambo
    m['tambo'] = material_metal_pintado('Foro_TamboAmarillo', TAMBO, desgaste=0.75, trazos=0.16)
    return m


# ---------------------------------------------------------------- props

def tronco_acostado(nombre, x, y, r, largo, m, rnd):
    """Un tronco acostado a lo largo de Y, con su corte de anillos en las puntas."""
    perfil = [(0.0, 0.0), (r * 0.97, 0.0), (r * 1.0, 0.03), (r * 1.02, largo * 0.3), (r * 0.99, largo * 0.7), (r * 0.98, largo - 0.03), (r * 0.95, largo), (0.0, largo)]
    o = torno(nombre, perfil, 11, m['tronco'], centro=(x, y - largo / 2, r), rot=(-math.pi / 2, 0, rnd.uniform(-0.02, 0.02)),
              chueco=0.012, semilla=rnd.random() * 100, fase=rnd.random())
    poner_anillos(o, 'Y', (x, r), r, azar=rnd.random())
    P.biselar(o, 0.03, 2, 40)
    asignar(o, m['corte'], lambda n, c: abs(n.y) > 0.55)
    return o


def poste_parado(nombre, x, y, r, alto, m, rnd, material=None):
    perfil = [(0.0, 0.0), (r, 0.0), (r * 1.03, alto * 0.4), (r * 0.97, alto - 0.02), (r * 0.92, alto), (0.0, alto)]
    o = torno(nombre, perfil, 8, material or m['poste'], centro=(x, y, 0), rot=(rnd.uniform(-0.015, 0.015), rnd.uniform(-0.015, 0.015), 0),
              chueco=0.008, semilla=rnd.random() * 100, fase=rnd.random())
    poner_anillos(o, 'Z', (x, y), r, azar=rnd.random())
    P.biselar(o, 0.02, 2, 40)
    asignar(o, m['corte'], lambda n, c: n.z > 0.55 and c.z > alto * 0.5)
    return o


def escenario(m, img, txt_punks):
    rnd = random.Random(21)
    random.seed(21)
    piezas = []
    # cinco troncos acostados de frente a atrás (sus cortes se ven al frente)
    for i, x in enumerate((-2.18, -1.1, 0.02, 1.08, 2.2)):
        r = 0.258 + rnd.uniform(-0.006, 0.006)
        piezas.append(tronco_acostado(f'tronco_{i}', x + rnd.uniform(-0.03, 0.03), rnd.uniform(-0.04, 0.04), r, 3.2 + rnd.uniform(-0.05, 0.05), m, rnd))
    # el piso: diez hileras de tablas atravesadas sobre los troncos, con las juntas encima de un tronco
    filas = 10
    paso = 3.0 / filas
    juntas = (-1.1, 0.02, 1.08, -1.1, 0.02, 1.08, 0.02, -1.1, 1.08, 0.02)
    for k in range(filas):
        y = -1.5 + paso * (k + 0.5)
        j = juntas[k] + rnd.uniform(-0.02, 0.02)
        for lado, (a, b) in enumerate(((-2.5 + rnd.uniform(-0.03, 0.02), j - 0.007), (j + 0.007, 2.5 + rnd.uniform(-0.02, 0.03)))):
            piezas.append(P.tabla(f'piso_{k}_{lado}', b - a, paso - 0.024, 0.07, m['tabla'],
                                  centro=((a + b) / 2, y + rnd.uniform(-0.006, 0.006), 0.565 + rnd.uniform(-0.003, 0.004)),
                                  rot=(rnd.uniform(-0.012, 0.012), rnd.uniform(-0.006, 0.006), rnd.uniform(-0.007, 0.007)),
                                  chueco=0.01, bisel=0.026, divisiones=2, semilla=rnd.random() * 100))
    # escalones al frente: dos bloques con su huella encima
    for k, (alto, y) in enumerate(((0.14, -1.98), (0.34, -1.68))):
        piezas.append(P.caja(f'bloque_{k}', (1.28, 0.3, alto), m['bloque'], centro=(rnd.uniform(-0.02, 0.02), y, alto / 2),
                             rot=(0, 0, rnd.uniform(-0.015, 0.015)), bisel=0.02, semilla=rnd.random() * 100))
        piezas.append(P.tabla(f'huella_{k}', 1.38, 0.34, 0.06, m['tabla'], centro=(rnd.uniform(-0.02, 0.02), y - 0.01, alto + 0.03),
                              rot=(rnd.uniform(-0.01, 0.01), rnd.uniform(-0.01, 0.01), rnd.uniform(-0.02, 0.02)), bisel=0.018, divisiones=2,
                              semilla=rnd.random() * 100))
    # pared de fondo: cinco hileras de tablas negras, cada una partida en dos
    juntas_p = (-0.62, 0.48, -0.18, 0.86, -0.95)
    for k in range(5):
        z = 0.6 + 0.13 + k * 0.26
        j = juntas_p[k]
        for lado, (a, b) in enumerate(((-2.5 + rnd.uniform(-0.02, 0.03), j - 0.006), (j + 0.006, 2.5 + rnd.uniform(-0.03, 0.02)))):
            piezas.append(P.tabla(f'pared_{k}_{lado}', b - a, 0.25, 0.05, m['pared'], centro=((a + b) / 2, 1.485 + rnd.uniform(-0.004, 0.004), z + rnd.uniform(-0.004, 0.004)),
                                  rot=(math.pi / 2 + rnd.uniform(-0.01, 0.01), rnd.uniform(-0.008, 0.008), rnd.uniform(-0.004, 0.004)),
                                  chueco=0.012, bisel=0.018, divisiones=2, semilla=rnd.random() * 100))
    # postes atrás: los de las orillas hasta arriba de la pared, los de en medio cargan el bastidor del neón
    for k, (x, alto) in enumerate(((-2.42, 2.02), (-0.98, 2.74), (0.98, 2.72), (2.42, 2.0))):
        piezas.append(poste_parado(f'poste_{k}', x, 1.615, 0.1, alto, m, rnd))
    # papel picado: una guirnalda colgada del filo de la repisa del neón, enfrente de la tabla de arriba
    # (ni tapa el neón ni cruza la pared)
    colores = list(PAPELES)
    banderas = []
    amarres = (-2.3, -1.15, 0.0, 1.15, 2.3)
    y_g, z_g, caida = 1.36, 1.912, 0.06
    curva = []
    for a, b in zip(amarres, amarres[1:]):
        for k in range(6):
            u = k / 6
            curva.append(Vector((a + (b - a) * u, y_g, z_g - caida * 4 * u * (1 - u))))
    curva.append(Vector((amarres[-1], y_g, z_g)))
    piezas.append(tubo('cuerda', curva, 0.006, m['cuerda'], lados=4))
    f = 0
    for a, b in zip(amarres, amarres[1:]):
        for u in (0.2, 0.5, 0.8):
            x = a + (b - a) * u
            z = z_g - caida * 4 * u * (1 - u)
            col = colores[f % len(colores)]
            ancho, alto = 0.17, 0.2
            piezas.append(bloque(f'papel_{f}', (ancho, 0.004, alto), m['papel_' + col], centro=(x, y_g + rnd.uniform(0.0, 0.008), z - alto / 2 - 0.006),
                                 rot=(rnd.uniform(-0.1, 0.1), rnd.uniform(-0.06, 0.06), 0), bisel=0))
            banderas.append((col, (x, z - alto / 2 - 0.006), (ancho, alto)))
            f += 1
    for i, (col, c, (w, h)) in enumerate(banderas):
        figura = FIG[('flor', 'estrella', 'corazon')[i % 3]]
        for nrm in ((0, -1, 0), (0, 1, 0)):
            pegar(m['papel_' + col], c, (w * 0.6, None), normal=nrm, imagen=figura, color=_hex(_oscuro(PAPELES[col], 0.42)), gasto=0.1)
    # lo que se pinta en la pared (calcas en el espacio del escenario: x, z)
    pegar(m['pared'], (-1.3, 1.22), (0.78, None), imagen=img, color=CREMA, gasto=0.28)
    pegar(m['pared'], (1.72, 0.98), (0.26, None), imagen=FIG['rayo'], color=MAGENTA, giro=0.14, gasto=0.25)
    pegar(m['pared'], (0.95, 1.51), (1.55, None), imagen=txt_punks, color=CREMA, giro=-0.02, gasto=0.32)
    # las calcas de la pared, cada una dentro de una sola tabla (centros de las hileras: z 0.73, 0.99, 1.25, 1.51, 1.77)
    pegar(m['pared'], (0.12, 0.99), (0.26, 0.18), fondo=AMARILLO, borde='#f6f1e4', imagen=FIG['rayo'], color=TINTA, giro=0.12, radio=0.25)
    pegar(m['pared'], (-0.42, 1.51), (0.2, 0.2), fondo=MAGENTA, borde='#f6f1e4', imagen=FIG['estrella'], color='#f6f1e4', radio=0.5, giro=-0.3)
    pegar(m['pared'], (2.18, 1.51), (0.22, 0.15), fondo='#2f9e9a', borde='#f6f1e4', imagen=FIG['corazon'], color=TINTA, giro=-0.12, radio=0.3)
    pegar_cinta(m['pared'], (-2.15, 1.7), 0.42, 0.06, giro=0.72, semilla=4)
    pegar_cinta(m['pared'], (-2.15, 1.7), 0.42, 0.06, giro=-0.72, semilla=5)
    pegar_cinta(m['pared'], (2.02, 0.73), 0.5, 0.06, giro=0.08, color='#d8b23a', semilla=6)
    # marcas de cinta en el piso (donde se para cada quien)
    pegar_cinta(m['tabla'], (-0.05, -0.3), 0.36, 0.055, plano='XY', normal=(0, 0, 1), giro=0.78, color=AMARILLO, semilla=8)
    pegar_cinta(m['tabla'], (-0.05, -0.3), 0.36, 0.055, plano='XY', normal=(0, 0, 1), giro=-0.78, color=AMARILLO, semilla=9)
    pegar_cinta(m['tabla'], (1.45, 0.1), 0.3, 0.055, plano='XY', normal=(0, 0, 1), giro=0.6, color=MAGENTA, semilla=10)
    pegar_cinta(m['tabla'], (1.45, 0.1), 0.3, 0.055, plano='XY', normal=(0, 0, 1), giro=-0.95, color=MAGENTA, semilla=12)
    # el letrero de neón arriba de la pared: las filas van aparte; la lámina, el tubo oxidado y el bastidor, en la malla
    letras_neon, fijos = letrero_neon(m)
    pared_top = max((o.matrix_world @ v.co).z for o in piezas if o.name.startswith('pared_') for v in o.data.vertices)
    revisar_letrero([o for o in fijos if o.name.startswith('letra_')], pared_top,
                    [(-2.42, 1.615, 0.1, 2.02), (-0.98, 1.615, 0.1, 2.74), (0.98, 1.615, 0.1, 2.72), (2.42, 1.615, 0.1, 2.0)])
    piezas += fijos
    # las torres de bocinas a los lados, en el piso: que nada se meta en la tarima, la escalera, los postes,
    # el neón ni el papel picado (intersección de mallas)
    torres, conos, altos = torres_bocinas(m)
    revisar_choques(torres + conos, piezas, 'torres contra el escenario')
    print(f"  torres: izquierda {altos['I']:.2f} m, derecha {altos['D']:.2f} m de alto")
    piezas += torres
    prop = P.unir(piezas, 'Prop_Escenario')
    # nunca se ven: la cara de abajo de las tablas del piso y de la pared, y lo que pisa el suelo
    quitar_caras(prop, lambda n, c: n.z < -0.9 and (0.45 < c.z < 0.57 or 0.58 < c.z < 0.62 or c.z < 0.01))
    # las hojas de setlist (una tirada en el piso, otra pegada en la pared) con su cinta: láminas de verdad,
    # no pintura (pintadas se cortaban en las ranuras de las tablas)
    piezas_h = []
    for k, (c, plano, nrm, giro, esquinas, curva) in enumerate((
            ((-1.55, -0.85), 'XY', (0, 0, 1), 0.5, (0.006, 0.018, 0.0, 0.0), 0.006),
            ((0.42, 1.12), 'XZ', (0, -1, 0), 0.05, (0.012, 0.005, 0.0, 0.0), 0.004))):
        w, h = 0.21, 0.29
        hoja = lamina(f'hoja_{k}', m['hoja'], [prop], c, (w, h), plano, nrm, giro, curva=curva, esquinas=esquinas, cortes=(6, 8))
        pegar_renglones(m['hoja'], c, (w, h), plano, nrm, giro, semilla=7 + k)
        u, v, n, i, j = marco_calca(plano, nrm, giro)
        arriba = Vector((0.0, 0.0, 0.0))
        arriba[i], arriba[j] = c
        arriba += v * (h / 2 - 0.012)
        cinta = lamina(f'cinta_hoja_{k}', m['cinta'], [prop, hoja], (arriba[i], arriba[j]), (w * 0.72, 0.045), plano, nrm, giro + 0.06,
                       grueso=0.0012, despegue=0.0004, plana=False, cortes=(8, 2), puntas=0.007, semilla=20 + k)
        piezas_h += [hoja, cinta]
    hojas = P.unir(piezas_h, 'Prop_Escenario_Hojas')
    hojas.parent = prop
    for hijo in letras_neon + conos:
        hijo.parent = prop
    return prop, hojas, letras_neon + conos


def _hex(c):
    """RGBA lineal -> hex sRGB."""
    def g(x):
        return x * 12.92 if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(g(v) * 255)))) for v in c[:3])


def bocina(m, img):
    rnd = random.Random(31)
    raices = [rnd.uniform(0, 2 * math.pi) for _ in range(5)]

    def radio_fn(r, z, a):
        if z > 0.2 or r < 0.3:
            return r
        bulto = sum(max(0.0, math.cos(a - b)) ** 18 for b in raices)
        return r + 0.075 * bulto * (1 - z / 0.2) ** 1.6

    perfil = [(0.0, 0.0), (0.42, 0.0), (0.395, 0.05), (0.362, 0.14), (0.35, 0.32), (0.345, 0.52), (0.335, 0.672), (0.316, 0.7),
              (0.243, 0.7), (0.222, 0.668), (0.212, 0.52), (0.0, 0.52)]
    o = torno('tocon', perfil, 12, m['tocon'], chueco=0.01, semilla=7.7, fase=0.13, radio_fn=radio_fn)
    # la cara de enfrente aserrada: plana, donde va pintado el cono
    for v in o.data.vertices:
        if v.co.y < -0.272:
            v.co.y = -0.272 + (v.co.y + 0.272) * 0.04
    poner_anillos(o, 'Z', (0, 0), 0.335, azar=0.37)
    P.biselar(o, 0.022, 2, 38)
    asignar(o, m['corte'], lambda n, c: n.z > 0.5 and c.z > 0.64 and math.hypot(c.x, c.y) > 0.226)
    asignar(o, m['hueco'], lambda n, c: c.z > 0.5 and math.hypot(c.x, c.y) < 0.226)
    pintar_cono(m['tocon'], (0.0, 0.37), 0.19)
    pegar(m['tocon'], (0.04, 0.36), (0.13, 0.1), plano='YZ', normal=(1, 0, 0), fondo=AMARILLO, borde='#f6f1e4', imagen=FIG['rayo'], color=TINTA, giro=0.1, radio=0.3)
    pegar_cinta(m['tocon'], (0.0, 0.42), 0.26, 0.05, plano='YZ', normal=(-1, 0, 0), giro=-0.5, semilla=3)
    piezas = [o]
    # la rejilla: aro de metal y barras, salida un poco del frente
    y_r = -0.272 - 0.016
    aro = torno('aro', [(0.188, -0.012), (0.214, -0.012), (0.214, 0.012), (0.188, 0.012)], 18, m['metal'], centro=(0, y_r, 0.37), rot=(math.pi / 2, 0, 0), veta=None, cerrado=True)
    P.biselar(aro, 0.004, 1, 40)
    piezas.append(aro)
    for k, dz in enumerate((-0.12, -0.04, 0.04, 0.12)):
        largo = 2 * math.sqrt(0.2 ** 2 - dz ** 2)
        piezas.append(bloque(f'barra_{k}', (largo, 0.014, 0.016), m['metal'], centro=(0, y_r, 0.37 + dz), rot=(0, rnd.uniform(-0.02, 0.02), 0), bisel=0.004))
    for k, a in enumerate((0.6, 2.2, 3.8, 5.3)):
        piezas.append(bloque(f'tornillo_{k}', (0.022, 0.02, 0.022), m['metal_claro'], centro=(math.cos(a) * 0.201, y_r - 0.012, 0.37 + math.sin(a) * 0.201), bisel=0.006))
    # el cable que sale por atrás
    pts = [(0.12, 0.3, 0.2), (0.16, 0.42, 0.12), (0.2, 0.55, 0.02), (0.32, 0.7, 0.008), (0.5, 0.74, 0.008), (0.62, 0.66, 0.008)]
    piezas.append(tubo('cable', curva_suave(pts, 3), 0.012, m['negro'], lados=5))
    prop = P.unir(piezas, 'Prop_BocinaTocon')
    quitar_caras(prop, lambda n, c: n.z < -0.9 and c.z < 0.005)
    return prop


def pie_micro(m, img):
    piezas = []
    base = torno('base', [(0.0, 0.0), (0.2, 0.0), (0.203, 0.024), (0.182, 0.047), (0.1, 0.07), (0.046, 0.082), (0.0, 0.084)], 14, m['metal'], veta=None, semilla=1.1)
    P.biselar(base, 0.007, 1, 40)
    piezas.append(base)
    piezas.append(torno('tubo_bajo', [(0.0, 0.07), (0.026, 0.07), (0.026, 1.03), (0.0, 1.03)], 8, m['metal'], veta=None, chueco=0.002, semilla=2.2))
    garra = torno('garra', [(0.0, 1.01), (0.038, 1.01), (0.048, 1.034), (0.048, 1.1), (0.038, 1.125), (0.0, 1.125)], 10, m['negro'], veta=None)
    P.biselar(garra, 0.006, 1, 40)
    piezas.append(garra)
    piezas.append(torno('tubo_alto', [(0.0, 1.1), (0.018, 1.1), (0.018, 1.49), (0.0, 1.49)], 8, m['metal_claro'], veta=None))
    piezas.append(torno('cinta_tubo', [(0.0, 0.56), (0.0295, 0.56), (0.031, 0.62), (0.0, 0.62)], 8, m['cinta'], veta=None))
    # el micro: apunta hacia +Y (al que canta) y hacia arriba
    e = 1.18
    d = Vector((0, math.cos(math.radians(35)), math.sin(math.radians(35))))
    clip = Vector((0, 0, 1.545))
    inicio = clip - d * 0.09 * e
    perfil = [(0.0, 0.0), (0.014, 0.0), (0.018, 0.02), (0.024, 0.13), (0.03, 0.148), (0.037, 0.155), (0.047, 0.172), (0.051, 0.2),
              (0.047, 0.226), (0.035, 0.246), (0.018, 0.258), (0.0, 0.262)]
    perfil = [(r * e, z * e) for r, z in perfil]
    rot = (-math.radians(55), 0, 0)
    micro = torno('micro', perfil, 12, m['negro'], veta=None)
    asignar(micro, m['micro_rejilla'], lambda n, c: c.z > 0.152 * e)
    micro.data.transform(Matrix.Translation(inicio) @ Euler_xyz(rot))
    piezas.append(micro)
    abraza = torno('abrazadera', [(0.0, 0.0), (0.035, 0.0), (0.035, 0.055), (0.0, 0.055)], 10, m['metal'], veta=None)
    abraza.data.transform(Matrix.Translation(inicio + d * 0.06 * e) @ Euler_xyz(rot))
    piezas.append(abraza)
    piezas.append(bloque('brazo', (0.038, 0.038, 0.08), m['metal'], centro=(0, 0.0, 1.5), bisel=0.008))
    # el cable: del micro baja enredado flojito en el tubo y se va por el piso
    pts = [inicio + d * 0.005, inicio - d * 0.05, Vector((0.03, -0.12, 1.41))]
    for k in range(7):
        a = -1.0 + k * 1.75
        pts.append(Vector((math.cos(a) * 0.065, math.sin(a) * 0.065, 1.27 - k * 0.19)))
    pts += [Vector((0.15, -0.14, 0.04)), Vector((0.28, -0.16, 0.01)), Vector((0.44, -0.06, 0.01)), Vector((0.5, 0.14, 0.01)), Vector((0.4, 0.3, 0.01))]
    piezas.append(tubo('cable', curva_suave(pts, 3), 0.01, m['negro'], lados=5))
    pegar(m['metal'], (0.09, -0.07), (0.075, 0.075), plano='XY', normal=(0, 0, 1), fondo=MAGENTA, borde='#f6f1e4', imagen=FIG['estrella'], color='#f6f1e4', radio=0.5, ancho_borde=0.007)
    prop = P.unir(piezas, 'Prop_PieMicro')
    quitar_caras(prop, lambda n, c: n.z < -0.9 and c.z < 0.005)
    return prop


def Euler_xyz(rot):
    from mathutils import Euler
    return Euler(rot, 'XYZ').to_matrix().to_4x4()


def ampli(m, img):
    piezas = []
    caja_ = P.caja('mueble', (0.7, 0.35, 0.55), m['tolex'], centro=(0, 0, 0.275), bisel=0.035, chueco=0.004, semilla=4.1)
    piezas.append(caja_)
    piezas.append(P.caja('tela', (0.61, 0.02, 0.32), m['tela'], centro=(0, -0.172, 0.215), bisel=0.008, chueco=0.002, semilla=4.2))
    piezas.append(bloque('placa', (0.6, 0.012, 0.085), m['metal_claro'], centro=(0, -0.176, 0.455), bisel=0.004))
    for k, x in enumerate((-0.23, -0.13, -0.03, 0.07, 0.17)):
        perilla = torno(f'perilla_{k}', [(0.0, 0.0), (0.027, 0.0), (0.027, 0.02), (0.02, 0.034), (0.0, 0.037)], 9, m['perilla'], veta=None,
                        centro=(x, -0.181, 0.455), rot=(math.pi / 2, 0, 0), fase=0.3 * k)
        piezas.append(perilla)
    foco = torno('foco', [(0.0, 0.0), (0.018, 0.0), (0.02, 0.012), (0.014, 0.024), (0.0, 0.028)], 8, m['foco'], veta=None, centro=(0.25, -0.181, 0.455), rot=(math.pi / 2, 0, 0))
    piezas.append(foco)
    asa = [(-0.12, 0, 0.548), (-0.105, 0, 0.592), (-0.05, 0, 0.616), (0.05, 0, 0.616), (0.105, 0, 0.592), (0.12, 0, 0.548)]
    piezas.append(tubo('asa', asa, 0.02, m['tolex'], lados=6, radio2=0.01))
    for k, x in enumerate((-0.12, 0.12)):
        piezas.append(bloque(f'tope_{k}', (0.05, 0.05, 0.022), m['metal_claro'], centro=(x, 0, 0.552), bisel=0.007))
    # esquineros de abajo al frente
    for k, x in enumerate((-0.335, 0.335)):
        piezas.append(bloque(f'esquinero_{k}', (0.06, 0.06, 0.06), m['metal'], centro=(x, -0.16, 0.03), bisel=0.016))
    pegar(m['tela'], (0.225, 0.105), (0.07, None), imagen=FIG['rayo'], color=TINTA, gasto=0.15)
    pegar(m['tolex'], (-0.18, 0.06), (0.15, 0.1), plano='XY', normal=(0, 0, 1), fondo=MAGENTA, borde='#f6f1e4', imagen=FIG['estrella'], color='#f6f1e4', giro=0.35, radio=0.3)
    pegar_cinta(m['tolex'], (0.2, -0.05), 0.24, 0.05, plano='XY', normal=(0, 0, 1), giro=-0.4, color='#7c807e', semilla=21)
    prop = P.unir(piezas, 'Prop_Ampli')
    quitar_caras(prop, lambda n, c: n.z < -0.9 and c.z < 0.005)
    return prop


def caja_equipo(m, img, txt_punks):
    piezas = []
    piezas.append(bloque('cuerpo', (0.86, 0.56, 0.43), m['caja'], centro=(0, 0, 0.215), bisel=0.022, segmentos=2, chueco=0.003, veta='X', semilla=5.1))
    piezas.append(bloque('tapa', (0.86, 0.56, 0.135), m['caja'], centro=(0, 0, 0.5125), bisel=0.022, segmentos=2, chueco=0.003, veta='X', semilla=5.2))
    # el marco de metal en todas las aristas y en la junta de la tapa
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.88, 0.58, 0.565), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, 0.3), verts=bm.verts)
    verticales = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 0.3]
    res = bmesh.ops.subdivide_edges(bm, edges=verticales, cuts=1)
    for v in res['geom_inner']:
        if isinstance(v, bmesh.types.BMVert):
            v.co.z = 0.4375
    marco = P.objeto('marco', bm, m['metal'])
    w = marco.modifiers.new('alambre', 'WIREFRAME')
    w.thickness = 0.034
    w.offset = 0.0
    w.use_even_offset = True
    w.use_replace = True
    w.use_boundary = False
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = marco
    marco.select_set(True)
    bpy.ops.object.modifier_apply(modifier='alambre')
    P.biselar(marco, 0.005, 1, 40)
    piezas.append(marco)
    for sx in (-1, 1):
        for sy in (-1, 1):
            for z in (0.0175, 0.5825):
                piezas.append(bloque(f'esquina_{sx}{sy}{z}', (0.07, 0.07, 0.07), m['metal_claro'], centro=(sx * 0.44, sy * 0.29, 0.035 if z < 0.1 else 0.57), bisel=0.02))
    for k, x in enumerate((-0.22, 0.22)):
        piezas.append(bloque(f'broche_{k}', (0.085, 0.018, 0.075), m['metal_claro'], centro=(x, -0.3, 0.4375), bisel=0.008))
    for k, sx in enumerate((-1, 1)):
        piezas.append(bloque(f'agarradera_{k}', (0.016, 0.17, 0.085), m['metal'], centro=(sx * 0.438, 0, 0.3), bisel=0.006))
        piezas.append(tubo(f'asa_{k}', [(sx * 0.447, -0.06, 0.28), (sx * 0.47, -0.055, 0.262), (sx * 0.476, 0, 0.255), (sx * 0.47, 0.055, 0.262), (sx * 0.447, 0.06, 0.28)], 0.011, m['negro'], lados=5))
    pegar(m['caja'], (0.0, 0.215), (0.72, None), imagen=txt_punks, color=CREMA, gasto=0.3, giro=0.015)
    pegar(m['caja'], (0.26, 0.513), (0.13, 0.095), fondo=MAGENTA, borde='#f6f1e4', imagen=FIG['estrella'], color='#f6f1e4', radio=0.3, giro=-0.08, ancho_borde=0.008)
    pegar(m['caja'], (0.13, 0.04), (0.24, 0.24), plano='XY', normal=(0, 0, 1), fondo=TINTA, borde='#f6f1e4', imagen=FIG['rayo'], color=AMARILLO, radio=0.5)
    pegar(m['caja'], (-0.24, 0.12), (0.16, 0.11), plano='XY', normal=(0, 0, 1), fondo=AMARILLO, borde='#f6f1e4', imagen=FIG['corazon'], color=TINTA, radio=0.25, giro=0.5)
    pegar_cinta(m['caja'], (-0.15, -0.12), 0.5, 0.06, plano='XY', normal=(0, 0, 1), giro=0.3, semilla=31)
    pegar_cinta(m['caja'], (-0.36, 0.3), 0.22, 0.055, giro=1.1, semilla=32)
    pegar(m['caja'], (-0.1, 0.32), (0.13, 0.1), plano='YZ', normal=(1, 0, 0), fondo='#2f2f36', borde='#f6f1e4', imagen=FIG['rayo'], color=AMARILLO, radio=0.25, giro=-0.1, ancho_borde=0.008)
    prop = P.unir(piezas, 'Prop_CajaEquipo')
    quitar_caras(prop, lambda n, c: n.z < -0.9 and c.z < 0.005)
    return prop


def pad(m, img):
    medio = (0.6, 0.6)
    radio = 0.17
    perfil = [(0.0, 0.0), (-0.012, 0.05), (-0.035, 0.1), (-0.05, 0.116), (-0.07, 0.12), (-0.098, 0.12), (-0.112, 0.112), (-0.118, 0.096), (-0.118, 0.08)]
    prop = losa_redonda('Prop_Pad', medio, radio, perfil, m['goma'], segs=5)
    suavizar(prop)
    pegar(m['goma'], (-0.43, -0.53), (0.06, None), plano='XY', normal=(0, 0, 1), imagen=FIG['estrella'], color='#8f9099', gasto=0.25)
    cara = losa_redonda('Prop_Pad_Cara', (0.6 - 0.124, 0.6 - 0.124), radio - 0.124, [(0.0, 0.085), (0.0, 0.103), (-0.007, 0.112), (-0.02, 0.116)], m['pad'], segs=5, tapa_arriba=True)
    suavizar(cara)
    origen_al_centro(cara)
    cara.parent = prop
    return prop, cara


def tambo(m, img, img_rayo):
    rnd = random.Random(41)
    k = 1.07
    perfil = [(0.0, 0.0), (0.3, 0.0), (0.312, 0.012), (0.312, 0.03), (0.3, 0.042), (0.3, 0.27), (0.316, 0.285), (0.316, 0.3), (0.3, 0.315),
              (0.304, 0.45), (0.3, 0.585), (0.316, 0.6), (0.316, 0.615), (0.3, 0.63), (0.3, 0.858), (0.313, 0.87), (0.313, 0.892), (0.302, 0.9),
              (0.284, 0.9), (0.279, 0.88), (0.0, 0.88)]
    perfil = [(r * k, z) for r, z in perfil]
    abolla = (math.radians(35), 0.2)

    def radio_fn(r, z, a):
        d = math.hypot((a - abolla[0]) * 0.32, z - abolla[1])
        return r - 0.03 * max(0.0, 1 - d / 0.13) ** 2 if 0.05 < z < 0.86 else r

    o = torno('tambo', perfil, 18, m['tambo'], chueco=0.004, semilla=9.9, fase=0.1, radio_fn=radio_fn, veta=None)
    piezas = [o]
    for nombre, (x, y, r) in (('tapon_g', (0.17, 0.05, 0.042)), ('tapon_c', (-0.15, -0.12, 0.026))):
        t = torno(nombre, [(0.0, 0.0), (r, 0.0), (r, 0.018), (r * 0.8, 0.026), (0.0, 0.026)], 8, m['metal'], centro=(x, y, 0.876), veta=None)
        P.biselar(t, 0.004, 1, 40)
        piezas.append(t)
    pegar(m['tambo'], (0.0, 0.45), (0.3, 0.3), fondo='#f2ead2', borde=TINTA, ancho_borde=0.02, imagen=img_rayo, color=TINTA, giro=math.pi / 4, radio=0.14, gasto=0.15, escala_img=0.6)
    pegar_cinta(m['tambo'], (-0.12, 0.6), 0.2, 0.05, giro=-0.6, semilla=41)
    pegar_cinta(m['tambo'], (0.12, 0.3), 0.2, 0.05, giro=-0.6, semilla=42)
    pegar(m['tambo'], (0.0, 0.45), (0.26, None), normal=(0, 1, 0), imagen=FIG['rayo'], color=TINTA, gasto=0.25)
    pegar_cinta(m['tambo'], (0.0, 0.18), 0.34, 0.055, normal=(0, 1, 0), giro=0.1, semilla=43)
    pegar(m['tambo'], (0.07, 0.75), (0.15, 0.1), plano='YZ', normal=(1, 0, 0), fondo=MAGENTA, borde='#f6f1e4', imagen=FIG['estrella'], color='#f6f1e4', radio=0.3, giro=0.12, ancho_borde=0.008)
    prop = P.unir(piezas, 'Prop_TamboRayo')
    quitar_caras(prop, lambda n, c: n.z < -0.9 and c.z < 0.005)
    return prop


# ---------------------------------------------------------------- comandos

def _todos():
    return [bpy.data.objects[n] for n in ORDEN] + [c for n in ORDEN for c in bpy.data.objects[n].children]


def info(objs):
    total = 0
    filas = []
    for n in ORDEN:
        o = bpy.data.objects[n]
        grupo = [o] + [c for c in o.children]
        t = P.triangulos(grupo)
        total += t
        pts = [g.matrix_world @ Vector(c) for g in grupo for c in g.bound_box]
        dim = [max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3)]
        dens = densidad_textura(o) if o.data.uv_layers else 0
        filas.append(f'  {n:<20} {dim[0]:.2f} x {dim[1]:.2f} x {dim[2]:.2f} m   {t:>6} triángulos   {dens:.0f} px/m')
    print('\n'.join(filas))
    print(f'  total: {total} triángulos')
    return total


def armar():
    P.limpiar()
    random.seed(SEMILLA)
    img, _ = P.estencil_skulley()
    txt_punks = imagen_texto('punks', 'PUNKS NOT DEAD')
    img_rayo = imagen_figura('rayo', RAYO)
    FIG.update(rayo=img_rayo, estrella=imagen_figura('estrella', ESTRELLA), corazon=imagen_figura('corazon', CORAZON), flor=imagen_figura('flor', FLOR))
    m = materiales(img)
    esc, hojas, neones = escenario(m, img, txt_punks)
    props = [esc, bocina(m, img), pie_micro(m, img), ampli(m, img), caja_equipo(m, img, txt_punks)]
    pd, cara = pad(m, img)
    props += [pd, tambo(m, img, img_rayo)]
    P.fila(props, separacion=0.8)
    todos = props + [cara, hojas] + neones
    revisar_apoyo(hojas, esc)
    pts = [g.matrix_world @ Vector(c) for g in [esc] + list(esc.children) for c in g.bound_box]
    print(f'  huella del escenario con las torres: x {min(q.x for q in pts) - esc.location.x:.2f} a {max(q.x for q in pts) - esc.location.x:.2f} m, '
          f'y {min(q.y for q in pts):.2f} a {max(q.y for q in pts):.2f} m ({max(q.x for q in pts) - min(q.x for q in pts):.2f} × '
          f'{max(q.y for q in pts) - min(q.y for q in pts):.2f} m), {max(q.z for q in pts):.2f} m de alto')
    uv_atlas_denso(todos, DENSIDAD, {'Prop_Escenario': poco_visible_escenario})
    uv_cara(cara, 'XY')
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    info(todos)
    print(f'  atlas cubierto: {cobertura_uv(todos) * 100:.0f} %')


def pintar():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    todos = _todos()
    P.hornear_atlas(todos, PNG, tam=TAM)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', PNG)


def exportar():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    todos = _todos()
    # `Veta` y `Anillo` son de la pintura: en el GLB saldrían como COLOR_n y three prende vertexColors con COLOR_0
    for o in todos:
        for nombre in [a.name for a in o.data.color_attributes]:
            o.data.color_attributes.remove(o.data.color_attributes[nombre])
    peso = P.exportar_glb(todos, PNG, GLB)
    info(todos)
    print(f'exportado: {GLB} {peso} bytes ({peso / 1024 / 1024:.2f} MB)')


def render(carpeta):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    todos = _todos()
    m = P.material_final(PNG, 'props_foro_revision')
    for o in todos:
        o.data.materials.clear()
        o.data.materials.append(m)
    rutas = P.render_revision(todos, carpeta, 'foro')
    sc = bpy.context.scene
    cam = sc.camera
    sc.render.resolution_x = 1200
    sc.render.resolution_y = 1000
    for n in ORDEN:
        o = bpy.data.objects[n]
        grupo = [o] + list(o.children)
        for x in todos:
            x.hide_render = x not in grupo
        pts = [g.matrix_world @ Vector(c) for g in grupo for c in g.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        centro = (lo + hi) / 2
        tam = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
        cam.data.ortho_scale = tam * 1.25
        vistas = ((-30, 24), (150, 24), (-8, 52)) if n == 'Prop_Escenario' else ((-30, 24), (150, 24))
        for i, (az, el) in enumerate(vistas):
            a, e = math.radians(az - 90), math.radians(el)
            d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
            cam.location = centro + d * tam * 3
            cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
            ruta = os.path.join(carpeta, f'{n[5:].lower()}_{i}.png')
            sc.render.filepath = ruta
            bpy.ops.render.render(write_still=True)
            rutas.append(ruta)
    # de cerca: las hojas del piso y de la pared (que no se hundan ni crucen la junta)
    esc = bpy.data.objects['Prop_Escenario']
    grupo = [esc] + list(esc.children)
    for x in todos:
        x.hide_render = x not in grupo
    for nombre, punto, escala, vistas in (('hoja_piso', (-1.55, -0.85, 0.6), 0.75, ((-30, 38), (-75, 9))),
                                          ('hoja_pared', (0.42, 1.46, 1.12), 0.7, ((-15, 14), (-72, 4))),
                                          ('letrero', (0.0, 1.42, 2.25), 4.3, ((-4, 6), (-38, 18), (160, 14))),
                                          ('letrero_cerca', (-1.3, 1.4, 2.25), 1.15, ((-22, 10), (-60, 28))),
                                          ('torre_I', (-3.2, -0.8, 1.36), 3.3, ((-38, 12), (-110, 20))),
                                          ('torre_D', (3.45, -0.75, 1.32), 3.3, ((32, 12),)),
                                          ('desde_arriba', (0.3, -0.2, 0.9), 9.6, ((-4, 44),))):
        centro = esc.matrix_world @ Vector(punto)
        cam.data.ortho_scale = escala
        for i, (az, el) in enumerate(vistas):
            a, e = math.radians(az - 90), math.radians(el)
            d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
            cam.location = centro + d * 6
            cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
            ruta = os.path.join(carpeta, f'escenario_{nombre}_{i}.png')
            sc.render.filepath = ruta
            bpy.ops.render.render(write_still=True)
            rutas.append(ruta)
    for x in todos:
        x.hide_render = False
    print('render:', '\n  '.join(rutas))


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    carpeta = args[1] if len(args) > 1 else os.path.join(tempfile.gettempdir(), 'props_foro')
    if cmd in ('armar', 'todo'):
        armar()
    if cmd in ('pintar', 'todo'):
        pintar()
    if cmd in ('exportar', 'todo'):
        exportar()
    if cmd in ('render', 'todo'):
        render(carpeta)
