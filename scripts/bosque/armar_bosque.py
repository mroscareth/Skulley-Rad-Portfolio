"""El bosque del home: pinos, menhires rúnicos y peñascos (Oscar, 2026-11-22).

La home es un claro en el bosque que M.A.D.R.E. hizo con los recuerdos de Skulley.
Los pinos siguen la referencia de Oscar: pisos de copa con la orilla en ondas
redondas, punta suave y tronco que se angosta, en varios tamaños. Todo va pintado
a mano en grises como el piso (el sitio lo pinta del color de la escena:
src/components/home/BosquePintado.jsx).

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/bosque/armar_bosque.py -- todo [carpeta_renders]

  pintar    pinta el atlas (Character/assets/bosque-atlas.png y public/textures/bosque-atlas.webp)
  webp      solo vuelve a escribir el WebP del sitio desde el PNG maestro (si se pintó encima)
  modelar   arma las piezas y guarda Character/Bosque.blend (con el atlas, para pintarle encima)
  exportar  abre el .blend y escribe public/3dmodels/bosque.glb
  render    renders de revisión en Cycles (a la carpeta que se le dé)
  todo      todo lo anterior

El atlas (2048 x 2048, grises; el 0.5 es el color de la escena):
  arriba            follaje: la vuelta de cada piso de copa (u da la vuelta, cierra en mosaico)
  abajo izquierda   corteza
  abajo derecha     piedra (menhires y peñascos)
Las piezas salen en metros del sitio (Skulley mide 2.85) con la base en el piso.
Los menhires traen un segundo UV ("Runas"): en sus dos caras anchas es la posición
en metros sobre la cara (x a lo ancho, y hacia arriba), y en las demás caras -100
(sin runas). El sitio escribe ahí el nombre de la sección en SKULLEYGLYPH.
Cada pieza guarda en extras su radio de choque en el piso ("choque").
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'scripts', 'piso'))
from pintar_tierra import Lienzo, difuminar, pincelada, ruido_periodico  # noqa: E402

BLEND = os.path.join(REPO, 'Character', 'Bosque.blend')
ATLAS_PNG = os.path.join(REPO, 'Character', 'assets', 'bosque-atlas.png')
ATLAS_WEBP = os.path.join(REPO, 'public', 'textures', 'bosque-atlas.webp')
GLB = os.path.join(REPO, 'public', '3dmodels', 'bosque.glb')
N = 2048
H2 = N // 2

# Perfil de un piso de copa (radio 1, alto 1, del borde de abajo a la punta):
# (radio, altura, t). t es la fila del atlas: 0 = centro de abajo, 1 = la punta.
# Abajo es un paraguas que sube hacia el tronco; la orilla es un labio gordo y
# redondo; arriba, un cono apenas abombado.
PERFIL = [
    (0.00, 0.40, 0.00),
    (0.30, 0.30, 0.07),
    (0.62, 0.17, 0.14),
    (0.88, 0.05, 0.20),
    (1.00, 0.00, 0.235),
    (1.07, 0.05, 0.27),
    (1.06, 0.12, 0.31),
    (0.98, 0.18, 0.345),
    (0.80, 0.36, 0.45),
    (0.60, 0.54, 0.57),
    (0.40, 0.71, 0.70),
    (0.24, 0.85, 0.81),
    (0.13, 0.94, 0.90),
    (0.05, 0.99, 0.96),
    (0.00, 1.00, 1.00),
]
# Cuánto le tocan las ondas de la orilla a cada anillo del perfil.
ONDA = [0, 0, 0.3, 0.75, 1, 1, 1, 0.9, 0.5, 0.18, 0, 0, 0, 0, 0]
T_ORILLA = (0.2, 0.345)  # el labio, en t

# Pinos: (nombre, pisos, alto, radio de abajo, semilla)
PINOS = [
    ('Pino_A', 3, 10.0, 3.7, 11),
    ('Pino_B', 3, 12.5, 3.3, 23),
    ('Pino_C', 2, 7.0, 3.1, 37),
    ('Pino_D', 4, 14.5, 3.8, 41),
]
# Menhires: (nombre, ancho, fondo, alto, semilla)
MENHIRES = [
    ('Menhir_A', 1.55, 0.72, 4.6, 5),
    ('Menhir_B', 1.40, 0.80, 4.2, 9),
    ('Menhir_C', 1.65, 0.66, 4.9, 13),
]
# Peñascos (casco convexo con la cara de arriba plana) y los sólidos perfectos medio
# enterrados (el error de M.A.D.R.E.: la naturaleza no hace icosaedros).
PENASCOS = [
    ('Penasco_A', 2.6, 1.5, 3),
    ('Penasco_B', 1.8, 1.1, 17),
    ('Penasco_C', 3.4, 1.9, 29),
]
SOLIDOS = [('Solido_Ico', 'ico', 1.5), ('Solido_Dodeca', 'dodeca', 1.4), ('Solido_Octa', 'octa', 1.6)]


# ------------------------------------------------------------------ pintar

def _region(forma, valor):
    return Lienzo(valor, forma)


def radio_en(t):
    """El radio del perfil (de 0 a 1.07) en la fila t."""
    for a, b in zip(PERFIL, PERFIL[1:]):
        if a[2] <= t <= b[2]:
            f = (t - a[2]) / max(b[2] - a[2], 1e-6)
            return a[0] + (b[0] - a[0]) * f
    return 0.0


# Pixeles del atlas por metro en un piso típico (radio 3): a lo largo de la vuelta
# (u da una vuelta en 2048 px) y a lo largo de la pendiente (la copa de arriba son
# ~670 px en ~5 m). Las pinceladas se miden en metros y se pasan a pixeles con esto,
# así no salen estiradas como pelo.
PX_VUELTA = N / (2 * math.pi * 3.0)
PX_PENDIENTE = 134.0


def pincel_mundo(lz, rng, x, t, ancho_m, largo_m, valor, seca, curva=0.12, ang=None):
    """Pincelada sobre la copa medida en metros (por omisión, a lo largo de la pendiente)."""
    r = max(radio_en(t), 0.18)
    ancho = ancho_m * PX_VUELTA / r
    largo = largo_m * PX_PENDIENTE
    a = math.pi / 2 + rng.normal(0, 0.2) if ang is None else ang
    pincelada(lz, rng, x, H2 * (1 - t), a, largo, ancho, valor, seca=seca, curva=curva)


def pintar_follaje(rng):
    """La vuelta de un piso de copa: filas = t (0 abajo del atlas, 1 arriba)."""
    lz = _region((H2, N), 0.5)
    flujo = ruido_periodico(rng, 140, forma=(H2, N))
    # Abajo de la copa (en sombra): un poco más oscuro.
    for _ in range(700):
        t = rng.uniform(0.0, T_ORILLA[0] - 0.01)
        pincelada(lz, rng, rng.uniform(0, N), H2 * (1 - t), rng.normal(0, 0.4), rng.uniform(80, 200),
                  rng.uniform(30, 60), rng.uniform(0.42, 0.46), seca=0.3)
    # Manchas de gouache en la copa: tonos casi iguales, pinceladas anchas.
    for _ in range(1800):
        t = rng.uniform(T_ORILLA[0], 0.99)
        x = rng.uniform(0, N)
        v = 0.5 + 0.035 * float(flujo[int(H2 * (1 - t)) % H2, int(x) % N]) + rng.normal(0, 0.01)
        pincel_mundo(lz, rng, x, t, rng.uniform(0.35, 0.7), rng.uniform(0.5, 1.1),
                     float(np.clip(v, 0.46, 0.54)), seca=0.35, ang=math.pi / 2 + rng.normal(0, 0.5))
    # Las rayitas de las hojas (como en la referencia): sueltas, cortas, a lo largo
    # de la pendiente, más juntas cerca de la orilla y nada en la punta.
    puestas = 0
    while puestas < 620:
        t = rng.uniform(0.33, 0.86)
        if rng.uniform() > (1 - (t - 0.33) / 0.53) ** 1.2:
            continue
        x = rng.uniform(0, N)
        ancho, largo = rng.uniform(0.07, 0.11), rng.uniform(0.35, 0.6)
        pincel_mundo(lz, rng, x, t, ancho, largo, rng.uniform(0.36, 0.4), seca=0.4, curva=0.18)
        if rng.uniform() < 0.3:
            # a veces en pareja, una al lado de la otra
            dx = rng.uniform(0.16, 0.26) * PX_VUELTA / max(radio_en(t), 0.18) * (1 if rng.uniform() < 0.5 else -1)
            pincel_mundo(lz, rng, x + dx, t + rng.uniform(-0.01, 0.01), ancho * 0.9, largo * rng.uniform(0.7, 1.0),
                         rng.uniform(0.37, 0.41), seca=0.45, curva=0.18)
        puestas += 1
    return lz.c


def pintar_corteza(rng):
    lz = _region((H2, H2), 0.36)
    for _ in range(700):
        x, y = rng.uniform(0, H2, 2)
        pincelada(lz, rng, x, y, math.pi / 2 + rng.normal(0, 0.08), rng.uniform(150, 420), rng.uniform(14, 34),
                  rng.uniform(0.32, 0.42), seca=0.4, curva=0.06)
    for _ in range(500):
        x, y = rng.uniform(0, H2, 2)
        pincelada(lz, rng, x, y, math.pi / 2 + rng.normal(0, 0.1), rng.uniform(60, 160), rng.uniform(5, 9),
                  rng.uniform(0.28, 0.31), seca=0.5, curva=0.1)
    for _ in range(120):
        x, y = rng.uniform(0, H2, 2)
        pincelada(lz, rng, x, y, math.pi / 2 + rng.normal(0, 0.1), rng.uniform(50, 120), rng.uniform(6, 11),
                  rng.uniform(0.44, 0.48), seca=0.6, curva=0.1)
    return lz.c


def pintar_piedra(rng):
    lz = _region((H2, H2), 0.55)
    flujo = ruido_periodico(rng, 90, forma=(H2, H2))
    for _ in range(900):
        x, y = rng.uniform(0, H2, 2)
        v = 0.55 + 0.05 * float(flujo[int(y) % H2, int(x) % H2])
        pincelada(lz, rng, x, y, rng.uniform(0, math.pi), rng.uniform(70, 200), rng.uniform(26, 60),
                  float(np.clip(v + rng.normal(0, 0.015), 0.48, 0.62)), seca=0.3)
    for _ in range(300):
        x, y = rng.uniform(0, H2, 2)
        pincelada(lz, rng, x, y, rng.uniform(0, math.pi), rng.uniform(12, 34), rng.uniform(5, 10),
                  rng.choice([0.47, 0.6]), seca=0.6, curva=0.2)
    # Grietas finas que cruzan.
    for _ in range(26):
        x, y = rng.uniform(0, H2, 2)
        ang = rng.uniform(0, math.pi)
        for _ in range(int(rng.integers(2, 5))):
            largo = rng.uniform(60, 150)
            pincelada(lz, rng, x, y, ang, largo, rng.uniform(3, 5), 0.43, seca=0.2, curva=0.25)
            x += math.cos(ang) * largo * 0.45
            y += math.sin(ang) * largo * 0.45
            ang += rng.normal(0, 0.6)
    return lz.c


def pintar(semilla=7):
    rng = np.random.default_rng(semilla)
    atlas = np.zeros((N, N), dtype=np.float32)
    atlas[:H2, :] = difuminar(pintar_follaje(rng), 1.6)
    atlas[H2:, :H2] = difuminar(pintar_corteza(rng), 1.6)
    atlas[H2:, H2:] = difuminar(pintar_piedra(rng), 1.6)
    return np.clip(atlas, 0, 1)


def imagen_blender(atlas, nombre='BosqueAtlas'):
    im = bpy.data.images.get(nombre) or bpy.data.images.new(nombre, N, N, alpha=False)
    rgba = np.ones((N, N, 4), dtype=np.float32)
    rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = atlas
    im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(rgba[::-1].ravel())
    im.update()
    return im


def guardar_atlas(im):
    os.makedirs(os.path.dirname(ATLAS_PNG), exist_ok=True)
    im.filepath_raw = ATLAS_PNG
    im.file_format = 'PNG'
    im.save()
    # Una imagen nueva con los mismos pixeles: copy() se queda con el formato PNG.
    pix = np.empty(N * N * 4, dtype=np.float32)
    im.pixels.foreach_get(pix)
    copia = bpy.data.images.new('BosqueAtlas_web', N, N, alpha=False)
    copia.colorspace_settings.name = 'Non-Color'
    copia.pixels.foreach_set(pix)
    copia.filepath_raw = ATLAS_WEBP
    copia.file_format = 'WEBP'
    copia.save(filepath=ATLAS_WEBP, quality=90)
    bpy.data.images.remove(copia)


# ------------------------------------------------------------------ modelar

def _malla(nombre, bm):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _torno(bm, uv, perfil, segs, transformar, uv_u, uv_v):
    """Superficie de revolución sin costura de vértices (la costura va en los UV).
    perfil: lista de puntos; transformar(j, theta) -> Vector del anillo j.
    Los extremos con radio 0 son polos (un solo vértice)."""
    anillos = []
    for j, p in enumerate(perfil):
        if p[0] == 0:
            anillos.append([bm.verts.new(transformar(j, 0.0))])
        else:
            anillos.append([bm.verts.new(transformar(j, 2 * math.pi * i / segs)) for i in range(segs)])
    for j in range(len(anillos) - 1):
        a, b = anillos[j], anillos[j + 1]
        va, vb = uv_v(j), uv_v(j + 1)
        for i in range(segs):
            u0, u1 = uv_u(i / segs), uv_u((i + 1) / segs)
            i1 = (i + 1) % segs
            if len(a) == 1:
                f = bm.faces.new((a[0], b[i], b[i1]))
                uvs = [((u0 + u1) / 2, va), (u0, vb), (u1, vb)]
            elif len(b) == 1:
                f = bm.faces.new((a[i], a[i1], b[0]))
                uvs = [(u0, va), (u1, va), ((u0 + u1) / 2, vb)]
            else:
                f = bm.faces.new((a[i], a[i1], b[i1], b[i]))
                uvs = [(u0, va), (u1, va), (u1, vb), (u0, vb)]
            for loop, c in zip(f.loops, uvs):
                loop[uv].uv = c
    return anillos


def pino(nombre, pisos, alto, radio, semilla):
    rng = np.random.default_rng(semilla)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    bm.loops.layers.uv.new('Runas')
    if pisos == 2:
        bordes, altos, radios = [0.22, 0.52], [0.48, 0.46], [1.0, 0.72]
    elif pisos == 3:
        bordes, altos, radios = [0.2, 0.42, 0.63], [0.42, 0.38, 0.35], [1.0, 0.79, 0.57]
    else:
        bordes, altos, radios = [0.18, 0.36, 0.54, 0.71], [0.36, 0.33, 0.30, 0.28], [1.0, 0.83, 0.66, 0.5]
    # El tronco: se angosta hacia arriba y se abre en el pie; llega adentro del primer piso.
    r_abajo, r_arriba = 0.17 * radio, 0.115 * radio
    y_fin = (bordes[0] + 0.32 * altos[0]) * alto
    perfil_tronco = [(1, -0.35), (1, 0.0)] + [(1, y_fin * s) for s in (0.12, 0.3, 0.55, 0.8, 1.0)]

    def tronco(j, th):
        y = perfil_tronco[j][1]
        s = max(0.0, min(1.0, y / y_fin))
        r = r_abajo + (r_arriba - r_abajo) * s
        r *= 1 + 0.45 * max(0.0, 1 - y / (0.18 * alto)) ** 2
        r *= 1 + 0.05 * math.sin(3 * th + semilla)
        return Vector((math.cos(th) * r, math.sin(th) * r, y))

    _torno(bm, uv, perfil_tronco, 12, tronco, lambda f: 0.5 * f,
           lambda j: 0.01 + 0.47 * max(0.0, perfil_tronco[j][1] + 0.35) / (y_fin + 0.35))
    # Los pisos, cada uno con sus ondas, un poco corrido y ladeado (hecho a mano).
    for k in range(pisos):
        R = radio * radios[k]
        H = alto * altos[k]
        y0 = alto * bordes[k]
        n = int(round(7 + 5 * radios[k]))
        segs = n * 5
        fase = rng.uniform(0, 2 * math.pi)
        tam = np.clip(1 + 0.15 * rng.standard_normal(n), 0.7, 1.3)
        corre = Vector((rng.normal(0, 0.035 * radio), rng.normal(0, 0.035 * radio), 0)) * (k > 0)
        lad = Matrix.Rotation(rng.normal(0, 0.04), 4, 'X') @ Matrix.Rotation(rng.normal(0, 0.04), 4, 'Y')
        rep = max(1, round(2 * math.pi * R * PX_PENDIENTE / N))

        def onda(th):
            # Lóbulo de semicírculo: 1 al centro, 0 en el pico entre dos.
            f = (n * ((th + fase) % (2 * math.pi)) / (2 * math.pi))
            i = int(f) % n
            f -= int(f)
            return math.sqrt(max(0.0, 1 - (2 * f - 1) ** 2)), tam[i]

        def piso(j, th):
            r, y, _ = PERFIL[j]
            w = ONDA[j]
            if w:
                L, a = onda(th)
                y -= 0.2 * a * (L - 0.62) * w
                r *= 1 + 0.1 * a * (L - 0.62) * w
            p = Vector((math.cos(th) * r * R, math.sin(th) * r * R, y * H))
            return lad @ p + Vector((0, 0, y0)) + corre

        _torno(bm, uv, PERFIL, segs, piso, lambda f: rep * f, lambda j: 0.5 + 0.5 * (0.004 + 0.99 * PERFIL[j][2]))
    ob = _malla(nombre, bm)
    ob['choque'] = round(r_abajo * 1.15, 3)
    ob['alto'] = alto
    return ob


def _uv_caja(bm, uv, escala, region, rng):
    """Proyección de caja en la región (u0, v0, ancho) del atlas: cada cara en su
    lugar al azar dentro de la región, sin salirse."""
    u0, v0, ancho = region
    for f in bm.faces:
        n = f.normal
        eje = max(range(3), key=lambda i: abs(n[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][eje]
        cs = [(l.vert.co[a] * escala, l.vert.co[b] * escala) for l in f.loops]
        mu, mv = min(c[0] for c in cs), min(c[1] for c in cs)
        eu = max(c[0] for c in cs) - mu
        ev = max(c[1] for c in cs) - mv
        ou = u0 + 0.01 + rng.uniform(0, max(0.0, ancho - 0.02 - eu))
        ov = v0 + 0.01 + rng.uniform(0, max(0.0, ancho - 0.02 - ev))
        for l, c in zip(f.loops, cs):
            l[uv].uv = (ou + c[0] - mu, ov + c[1] - mv)


def menhir(nombre, ancho, fondo, alto, semilla):
    rng = np.random.default_rng(semilla)
    bm = bmesh.new()
    # Sección de seis lados aplanada (la cara ancha de enfrente y la de atrás llevan
    # las runas) en cuatro anillos: el pie enterrado, la panza, el hombro y la
    # cabeza angosta; cada anillo un poco girado y chueco.
    seccion = [(-0.5, 0), (-0.36, -0.5), (0.36, -0.5), (0.5, 0), (0.36, 0.5), (-0.36, 0.5)]
    anillos = []
    for z, s in ((-0.6, 0.98), (alto * 0.36, 1.05), (alto * 0.74, 0.88), (alto, 0.6)):
        g = Matrix.Rotation(rng.normal(0, 0.05), 3, 'Z')
        anillo = []
        for sx, sy in seccion:
            p = g @ Vector((sx * ancho * s, sy * fondo * s, 0))
            j = Vector(rng.normal(0, 0.03, 3))
            anillo.append(bm.verts.new((p.x + j.x, p.y + j.y, z + j.z * 2 * (z > 0))))
        anillos.append(anillo)
    m = len(seccion)
    for a, b in zip(anillos, anillos[1:]):
        for i in range(m):
            bm.faces.new((a[i], a[(i + 1) % m], b[(i + 1) % m], b[i]))
    bm.faces.new(anillos[0][::-1])
    bm.faces.new(anillos[-1])
    # La cabeza inclinada y una esquina cortada.
    for v in anillos[-1]:
        v.co.z += (v.co.x / ancho) * rng.uniform(-0.7, 0.7) + rng.uniform(0, 0.15)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    corte = Vector((rng.choice([-1, 1]) * 0.7, rng.uniform(-0.3, 0.3), 1)).normalized()
    centro = Vector((corte.x * ancho * 0.42, 0, alto * 0.86))
    geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
    r = bmesh.ops.bisect_plane(bm, geom=geo, plane_co=centro, plane_no=corte, clear_outer=True)
    nuevas = [e for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if nuevas:
        bmesh.ops.edgeloop_fill(bm, edges=nuevas)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Bisel de un segmento: aristas duras con su filo de luz.
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.05, segments=1, affect='EDGES', profile=0.5, clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.new('UVMap')
    runas = bm.loops.layers.uv.new('Runas')
    _uv_caja(bm, uv, 0.1, (0.5, 0.0, 0.5), rng)
    for f in bm.faces:
        cara = abs(f.normal.y) > 0.75
        for l in f.loops:
            # De frente (-Y en Blender, +Z en el sitio) x a lo ancho; atrás, al revés,
            # para que también se lea de ese lado.
            x = l.vert.co.x if f.normal.y < 0 else -l.vert.co.x
            l[runas].uv = (x, l.vert.co.z) if cara else (-100.0, -100.0)
    ob = _malla(nombre, bm)
    for p in ob.data.polygons:
        p.use_smooth = False
    ob['choque'] = round(max(ancho, fondo) * 0.55, 3)
    ob['alto'] = alto
    ob['ancho'] = ancho
    return ob


def _casco(bm, puntos):
    vs = [bm.verts.new(p) for p in puntos]
    r = bmesh.ops.convex_hull(bm, input=vs)
    sobran = list({v for v in r.get('geom_interior', []) + r.get('geom_unused', []) if isinstance(v, bmesh.types.BMVert)})
    if sobran:
        bmesh.ops.delete(bm, geom=sobran, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)


def penasco(nombre, radio, alto, semilla):
    rng = np.random.default_rng(semilla)
    bm = bmesh.new()
    pts = []
    for _ in range(14):
        d = Vector(rng.normal(0, 1, 3)).normalized()
        pts.append(Vector((d.x * radio * rng.uniform(0.75, 1.0), d.y * radio * rng.uniform(0.6, 0.9),
                           max(d.z, -0.4) * alto * rng.uniform(0.8, 1.1))))
    _casco(bm, pts)
    # La cara de arriba plana (como las lozas) y el pie enterrado.
    for co, no in (((0, 0, alto * 0.62), (rng.normal(0, 0.12), rng.normal(0, 0.12), 1)), ((0, 0, -alto * 0.25), (0, 0, -1))):
        geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
        r = bmesh.ops.bisect_plane(bm, geom=geo, plane_co=co, plane_no=Vector(no).normalized(), clear_outer=True)
        nuevas = [e for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if nuevas:
            bmesh.ops.edgeloop_fill(bm, edges=nuevas)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Caras grandes y planas: las casi iguales se juntan en una.
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(12), verts=bm.verts[:], edges=bm.edges[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
    duras = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(20)]
    bmesh.ops.bevel(bm, geom=duras, offset=0.05, segments=1, affect='EDGES', profile=0.5, clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for v in bm.verts:
        v.co.z += alto * 0.25 - 0.15
    uv = bm.loops.layers.uv.new('UVMap')
    bm.loops.layers.uv.new('Runas')
    _uv_caja(bm, uv, 0.1, (0.5, 0.0, 0.5), rng)
    ob = _malla(nombre, bm)
    for p in ob.data.polygons:
        p.use_smooth = False
    ob['choque'] = round(radio * 0.85, 3)
    return ob


def solido(nombre, tipo, radio):
    phi = (1 + 5 ** 0.5) / 2
    if tipo == 'ico':
        pts = [(0, s1, s2 * phi) for s1 in (-1, 1) for s2 in (-1, 1)]
        pts = pts + [(b, c, a) for a, b, c in pts] + [(c, a, b) for a, b, c in pts]
    elif tipo == 'dodeca':
        pts = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        base = [(0, s1 / phi, s2 * phi) for s1 in (-1, 1) for s2 in (-1, 1)]
        pts += base + [(b, c, a) for a, b, c in base] + [(c, a, b) for a, b, c in base]
    else:
        pts = [(s, 0, 0) for s in (-1, 1)] + [(0, s, 0) for s in (-1, 1)] + [(0, 0, s) for s in (-1, 1)]
    m = max(Vector(p).length for p in pts)
    rng = np.random.default_rng(len(nombre))
    giro = Matrix.Rotation(rng.uniform(0, 3), 3, 'X') @ Matrix.Rotation(rng.uniform(0, 3), 3, 'Y')
    bm = bmesh.new()
    _casco(bm, [giro @ (Vector(p) * radio / m) for p in pts])
    # Medio enterrado.
    geo = bm.verts[:] + bm.edges[:] + bm.faces[:]
    r = bmesh.ops.bisect_plane(bm, geom=geo, plane_co=(0, 0, -radio * 0.35), plane_no=(0, 0, -1), clear_outer=True)
    nuevas = [e for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if nuevas:
        bmesh.ops.edgeloop_fill(bm, edges=nuevas)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for v in bm.verts:
        v.co.z += radio * 0.35 - 0.12
    uv = bm.loops.layers.uv.new('UVMap')
    bm.loops.layers.uv.new('Runas')
    _uv_caja(bm, uv, 0.1, (0.5, 0.0, 0.5), rng)
    ob = _malla(nombre, bm)
    for p in ob.data.polygons:
        p.use_smooth = False
    ob['choque'] = round(radio * 0.8, 3)
    return ob


def material_revision(im):
    """El material del .blend y del render: los grises del atlas al azul de la
    escena (#011d8a en el medio), como lo pinta el sitio."""
    m = bpy.data.materials.get('Bosque') or bpy.data.materials.new('Bosque')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    salida = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.9
    rampa = nt.nodes.new('ShaderNodeValToRGB')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = im
    r = rampa.color_ramp
    r.elements[0].position = 0.25
    r.elements[0].color = (0.0, 0.004, 0.09, 1)
    r.elements[1].position = 0.75
    r.elements[1].color = (0.35, 0.4, 0.75, 1)
    medio = r.elements.new(0.5)
    medio.color = (0.0, 0.012, 0.25, 1)
    nt.links.new(tex.outputs['Color'], rampa.inputs['Fac'])
    nt.links.new(rampa.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], salida.inputs['Surface'])
    return m


def modelar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    im = bpy.data.images.get('BosqueAtlas')
    if im is None:
        im = bpy.data.images.load(ATLAS_PNG)
        im.name = 'BosqueAtlas'
        im.colorspace_settings.name = 'Non-Color'
    im.pack()
    mat = material_revision(im)
    obs = []
    x = 0.0
    for args in PINOS:
        ob = pino(*args)
        ob.location.x = x
        x += args[3] * 2.4
        obs.append(ob)
    x = 0.0
    for args in MENHIRES:
        ob = menhir(*args)
        ob.location = (x, -9, 0)
        x += 3
        obs.append(ob)
    for args in PENASCOS:
        ob = penasco(*args)
        ob.location = (x, -9, 0)
        x += args[1] * 2.5
        obs.append(ob)
    for args in SOLIDOS:
        ob = solido(*args)
        ob.location = (x, -9, 0)
        x += 3.5
        obs.append(ob)
    for ob in obs:
        ob.data.materials.append(mat)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    return obs


def exportar():
    if not bpy.data.filepath:
        bpy.ops.wm.open_mainfile(filepath=BLEND)
    piezas = [o for o in bpy.data.objects if o.type == 'MESH']
    guardado = {o.name: o.location.copy() for o in piezas}
    for o in piezas:
        o.location = (0, 0, 0)
    bpy.ops.object.select_all(action='DESELECT')
    for o in piezas:
        o.select_set(True)
    bpy.context.view_layer.objects.active = piezas[0]
    bpy.ops.export_scene.gltf(
        filepath=GLB, export_format='GLB', use_selection=True, export_apply=True,
        export_texcoords=True, export_normals=True, export_materials='PLACEHOLDER',
        export_extras=True, export_yup=True, export_animations=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_texcoord_quantization=14,
    )
    for o in piezas:
        o.location = guardado[o.name]
    print('GLB', GLB, os.path.getsize(GLB))


def render(carpeta):
    if not bpy.data.filepath:
        bpy.ops.wm.open_mainfile(filepath=BLEND)
    os.makedirs(carpeta, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    mundo = bpy.data.worlds.new('Noche')
    mundo.use_nodes = True
    mundo.node_tree.nodes['Background'].inputs['Color'].default_value = (0.0, 0.012, 0.25, 1)
    mundo.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    sc.world = mundo
    bpy.ops.mesh.primitive_plane_add(size=200, location=(10, 0, 0))
    piso = bpy.context.active_object
    mp = bpy.data.materials.new('PisoRev')
    mp.use_nodes = True
    mp.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.0, 0.012, 0.25, 1)
    piso.data.materials.append(mp)
    sol = bpy.data.lights.new('Sol', 'SUN')
    sol.energy = 3.2
    so = bpy.data.objects.new('Sol', sol)
    so.rotation_euler = (math.radians(50), 0, math.radians(30))
    sc.collection.objects.link(so)
    cam = bpy.data.cameras.new('Cam')
    co = bpy.data.objects.new('Cam', cam)
    sc.collection.objects.link(co)
    sc.camera = co

    def toma(nombre, objetivo, dist, alto_cam, lente=50):
        cam.lens = lente
        o = Vector(objetivo)
        co.location = o + Vector((0, -dist, alto_cam))
        d = o - co.location
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(carpeta, nombre)
        bpy.ops.render.render(write_still=True)

    toma('pinos_frente.png', (12, 0, 5.5), 46, 8)
    toma('pinos_juego.png', (12, 0, 2), 34, 30)
    toma('piedras.png', (13, -9, 1.5), 26, 9)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    paso = args[0] if args else 'todo'
    carpeta = args[1] if len(args) > 1 else os.path.join(REPO, 'Character', 'renders-bosque')
    if paso in ('pintar', 'todo') and '--sin-pintar' not in args:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        guardar_atlas(imagen_blender(pintar()))
    if paso == 'webp':
        # Solo vuelve a escribir el WebP del sitio desde el PNG maestro.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        im = bpy.data.images.load(ATLAS_PNG)
        im.colorspace_settings.name = 'Non-Color'
        guardar_atlas(im)
    if paso in ('modelar', 'todo'):
        modelar()
    if paso in ('exportar', 'todo'):
        exportar()
    if paso in ('render', 'todo'):
        render(carpeta)
