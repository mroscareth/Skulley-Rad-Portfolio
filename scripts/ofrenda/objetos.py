"""Los objetos de la ofrenda del Día de los Skulleys (Oscar, 2026-11-24; features.md).

Seis cosas importantes para Oscar que el jugador lleva al portal de SKULLEYGLYPH:
el iPad donde dibuja, su cámara Leica, el álbum de fotos de su gente, su teclado
MIDI (tipo Arturia MiniLab 3: 25 teclas, 8 perillas, 8 pads de colores, 4 faders
y pantallita), la caja de cerillos que le regaló su novia y la almohada que lo
deja soñar. Procedurales, de caricatura (cantos redondeados, pocas piezas, colores
planos) para el toon del sitio (src/components/home/ObjetosOfrenda.jsx).

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/ofrenda/objetos.py -- todo [carpeta_renders]

  modelar   arma los seis y guarda Character/Ofrendas.blend
  exportar  abre el .blend y escribe public/3dmodels/ofrendas.glb (Draco)
  render    hoja de revisión (Workbench con contorno) en la carpeta que se le dé
  todo      los tres

Cada objeto es un solo objeto `Ofrenda_<id>` (los ids de lib/ofrendas.js), a su
tamaño real en metros, con la base en el piso (z = 0), centrado, y el frente hacia
-Y de Blender (en el sitio +z, lo que mira al portal). El sitio le da su escala a
cada uno (a tamaño real la caja de cerillos sería un punto). Los materiales van por
nombre (`<Objeto>_<parte>`); el sitio pone sus colores. Lo que lleva dibujo (la
pantalla del iPad, las fotos del álbum, la etiqueta de los cerillos) trae UV de 0 a
1 en su cara y el sitio lo pinta en canvas.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(AQUI, '..', '..'))
BLEND = os.path.join(REPO, 'Character', 'Ofrendas.blend')
GLB = os.path.join(REPO, 'public', '3dmodels', 'ofrendas.glb')
IDS = ('ipad', 'leica', 'album', 'teclado', 'cerillos', 'almohada')

# Colores solo para verlos en Blender y en la hoja de revisión (el sitio pone los suyos).
COLORES = {
    'Ipad_Aluminio': (0.30, 0.31, 0.34), 'Ipad_Bisel': (0.02, 0.02, 0.025), 'Ipad_Pantalla': (0.95, 0.93, 0.85),
    'Ipad_Funda': (0.10, 0.14, 0.30), 'Ipad_Lente': (0.05, 0.05, 0.06),
    'Lapiz_Blanco': (0.95, 0.95, 0.94), 'Lapiz_Punta': (0.55, 0.55, 0.57),
    'Leica_Piel': (0.04, 0.04, 0.045), 'Leica_Metal': (0.78, 0.79, 0.80), 'Leica_Lente': (0.05, 0.05, 0.055),
    'Leica_Vidrio': (0.10, 0.14, 0.22), 'Leica_Ventana': (0.20, 0.24, 0.30), 'Leica_Tapa': (0.13, 0.135, 0.15),
    'Leica_Rojo': (0.75, 0.007, 0.013), 'Leica_Pantalla': (0.10, 0.12, 0.15),
    'Album_Piel': (0.38, 0.12, 0.08), 'Album_Hojas': (0.93, 0.89, 0.78), 'Album_Marco': (0.98, 0.98, 0.96),
    'Album_Fotos': (0.60, 0.70, 0.80), 'Album_Esquina': (0.08, 0.08, 0.08),
    'Teclado_Cuerpo': (0.10, 0.10, 0.11), 'Teclado_Blanca': (0.96, 0.96, 0.95), 'Teclado_Negra': (0.03, 0.03, 0.03),
    'Teclado_Perilla': (0.15, 0.15, 0.16), 'Teclado_Marca': (0.95, 0.95, 0.95), 'Teclado_Pantalla': (0.30, 0.75, 1.0),
    'Teclado_Fader': (0.85, 0.85, 0.86), 'Teclado_Tira': (0.20, 0.20, 0.22), 'Teclado_Pads': (1, 1, 1),
    'Cerillos_Caja': (0.88, 0.80, 0.62), 'Cerillos_Etiqueta': (0.85, 0.15, 0.15), 'Cerillos_Lija': (0.32, 0.18, 0.10),
    'Cerillos_Palo': (0.93, 0.80, 0.55), 'Cerillos_Cabeza': (0.80, 0.08, 0.06), 'Cerillos_Quemado': (0.06, 0.05, 0.05),
    'Almohada_Tela': (0.95, 0.93, 0.88), 'Almohada_Ribete': (0.20, 0.35, 0.75),
}


# ---------------------------------------------------------------- herramientas

def material(nombre):
    m = bpy.data.materials.get(nombre)
    if not m:
        m = bpy.data.materials.new(nombre)
        c = COLORES.get(nombre, (0.8, 0.8, 0.8))
        m.diffuse_color = (*c, 1)
        m.use_nodes = True
        b = m.node_tree.nodes.get('Principled BSDF')
        if b:
            b.inputs['Base Color'].default_value = (*c, 1)
            b.inputs['Roughness'].default_value = 0.6
    return m


def _objeto(nombre, bm):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def _con_material(o, nombre):
    o.data.materials.clear()
    o.data.materials.append(material(nombre))
    return o


def _redondo(pts_n, ancho, alto, r):
    """Contorno de un rectángulo de esquinas redondas (ancho en x, alto en y), en sentido antihorario."""
    r = min(r, ancho / 2 - 1e-5, alto / 2 - 1e-5)
    pts = []
    for cx, cy, a0 in ((ancho / 2 - r, alto / 2 - r, 0), (-ancho / 2 + r, alto / 2 - r, 90),
                       (-ancho / 2 + r, -alto / 2 + r, 180), (ancho / 2 - r, -alto / 2 + r, 270)):
        for k in range(pts_n + 1):
            a = math.radians(a0 + 90 * k / pts_n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def losa(nombre, ancho, alto, grueso, radio, bisel=0.0, mat_cara=None, mat_canto=None, mat_dorso=None, segs=6):
    """Una losa de esquinas redondas: ancho en x, alto en y, grueso en z (de 0 a grueso). Cara de arriba (+z)
    `mat_cara`, cantos `mat_canto`, dorso `mat_dorso`; con `bisel` las orillas de arriba y abajo se redondean."""
    pts = _redondo(segs, ancho, alto, radio)
    bm = bmesh.new()
    abajo = [bm.verts.new((x, y, 0)) for x, y in pts]
    arriba = [bm.verts.new((x, y, grueso)) for x, y in pts]
    nombres = [mat_cara or mat_canto, mat_canto, mat_dorso or mat_canto]
    nombres = [n for i, n in enumerate(nombres) if n not in nombres[:i]]
    idx = lambda n: nombres.index(n)
    f = bm.faces.new(arriba)
    f.material_index = idx(mat_cara or mat_canto)
    f = bm.faces.new(list(reversed(abajo)))
    f.material_index = idx(mat_dorso or mat_canto)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((abajo[i], abajo[j], arriba[j], arriba[i]))
        f.material_index = idx(mat_canto)
    if bisel > 0:
        orilla = [e for e in bm.edges if all(v in arriba for v in e.verts) or all(v in abajo for v in e.verts)]
        r = bmesh.ops.bevel(bm, geom=orilla, offset=bisel, segments=3, profile=0.5, affect='EDGES', clamp_overlap=True)
        for f in r['faces']:
            f.material_index = idx(mat_canto)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _objeto(nombre, bm)
    for nm in nombres:
        o.data.materials.append(material(nm))
    return o


def caja(nombre, tam, mat, bisel=0.0):
    """Caja de tamaño tam (x, y, z) con la base en z = 0, centrada en x y y."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=tam, verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, tam[2] / 2), verts=bm.verts)
    if bisel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bisel, segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    return _con_material(_objeto(nombre, bm), mat)


def cilindro(nombre, radio, alto, mat, segs=24, radio2=None, bisel=0.0):
    """Cilindro (o cono) en z de 0 a alto, centrado."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radio,
                          radius2=radio if radio2 is None else radio2, depth=alto)
    bmesh.ops.translate(bm, vec=(0, 0, alto / 2), verts=bm.verts)
    if bisel > 0:
        tapas = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(bm, geom=tapas, offset=bisel, segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    return _con_material(_objeto(nombre, bm), mat)


def esfera(nombre, radio, mat, escala=(1, 1, 1), segs=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(6, segs // 2), radius=radio)
    bmesh.ops.scale(bm, vec=escala, verts=bm.verts)
    return _con_material(_objeto(nombre, bm), mat)


def plano(nombre, ancho, alto, mat, uv=(0, 0, 1, 1)):
    """Plano en xy (normal +z) con UV de (u0, v0) a (u1, v1)."""
    bm = bmesh.new()
    capa = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new((x * ancho / 2, y * alto / 2, 0)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs)
    u0, v0, u1, v1 = uv
    for loop, (u, v) in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        loop[capa].uv = (u, v)
    return _con_material(_objeto(nombre, bm), mat)


def poner(o, pos=(0, 0, 0), rot=(0, 0, 0)):
    """Rota (grados, XYZ) y mueve, aplicado a la malla."""
    M = Matrix.Translation(pos) @ Matrix.Rotation(math.radians(rot[2]), 4, 'Z') @ Matrix.Rotation(math.radians(rot[1]), 4, 'Y') \
        @ Matrix.Rotation(math.radians(rot[0]), 4, 'X')
    o.data.transform(M)
    return o


def unir(nombre, partes):
    """Une las partes en un solo objeto `nombre` (materiales por cara)."""
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for p in partes:
        p.select_set(True)
    bpy.context.view_layer.objects.active = partes[0]
    bpy.ops.object.join()
    o = partes[0]
    o.name = nombre
    o.data.name = nombre
    # sin materiales repetidos
    vistos = {}
    for i, m in enumerate(o.data.materials):
        vistos.setdefault(m.name, i)
    if len(vistos) < len(o.data.materials):
        mapa = {i: list(vistos).index(m.name) for i, m in enumerate(o.data.materials)}
        for p in o.data.polygons:
            p.material_index = mapa[p.material_index]
        mats = [bpy.data.materials[n] for n in vistos]
        o.data.materials.clear()
        for m in mats:
            o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    try:
        o.data.set_sharp_from_angle(angle=math.radians(40))
    except Exception:
        pass
    return o


def asentar(o):
    """La base en el piso y centrado en x, y."""
    vs = [v.co for v in o.data.vertices]
    mx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
    my = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
    mz = min(v.z for v in vs)
    o.data.transform(Matrix.Translation((-mx, -my, -mz)))
    return o


# ---------------------------------------------------------------- 1. el iPad donde dibuja

def ipad():
    W, H, T = 0.248, 0.179, 0.0064          # iPad de 11", acostado (horizontal)
    inclina = 68                             # grados contra el piso, recargado en su funda
    a = math.radians(inclina)
    partes = []
    cuerpo = losa('ipad_cuerpo', W, H, T, 0.016, 0.0018, mat_cara='Ipad_Bisel', mat_canto='Ipad_Aluminio')
    pantalla = poner(plano('ipad_pantalla', W - 0.018, H - 0.018, 'Ipad_Pantalla'), (0, 0, T + 0.0002))
    lente = poner(cilindro('ipad_lente', 0.006, 0.0012, 'Ipad_Lente', 16), (-W / 2 + 0.02, H / 2 - 0.02, -0.0012))
    # de pie: el canto de abajo en el piso (y = 0) y la pantalla hacia -Y, recargado hacia atrás (+Y)
    for p in (cuerpo, pantalla, lente):
        poner(p, (0, H / 2, 0))
        poner(p, (0, 0, 0), (inclina, 0, 0))
    partes += [cuerpo, pantalla, lente]
    # la funda doblada en triángulo: una tabla que baja del dorso al piso y otra en el piso
    f = 0.62
    P = Vector((0, f * H * math.cos(a) + T * math.sin(a), f * H * math.sin(a) - T * math.cos(a)))
    d = P.z / math.tan(math.radians(58))
    Q = Vector((0, P.y + d, 0))
    largo = (P - Q).length
    phi = math.degrees(math.atan2(P.z, -d))
    pata = losa('ipad_funda_pata', W * 0.94, largo, 0.005, 0.01, 0.0015, mat_canto='Ipad_Funda')
    poner(pata, (0, largo / 2, 0))
    poner(pata, (0, 0, 0), (phi, 0, 0))
    poner(pata, (0, Q.y, 0))
    piso = losa('ipad_funda_piso', W * 0.94, Q.y - 0.004, 0.005, 0.01, 0.0015, mat_canto='Ipad_Funda')
    poner(piso, (0, (Q.y + 0.004) / 2, 0))
    partes += [pata, piso]
    # el Apple Pencil, en el piso enfrente, de lado
    lapiz = cilindro('lapiz', 0.0045, 0.148, 'Lapiz_Blanco', 16, bisel=0.001)
    punta = poner(cilindro('lapiz_punta', 0.0045, 0.018, 'Lapiz_Punta', 16, radio2=0.0009), (0, 0, 0.148))
    for p in (lapiz, punta):
        poner(p, (0, 0, 0), (0, 90, 0))
        poner(p, (-0.05, -0.05, 0.0045), (0, 0, -18))
    partes += [lapiz, punta]
    return asentar(unir('Ofrenda_ipad', partes))


# ---------------------------------------------------------------- 2. su cámara (la compacta que usa, sin marcas)

def leica():
    """La compacta que usa Oscar (una Leica D-Lux 8: 130 × 73 × 62 mm con el lente), sin marcas ni correa.
    Cuerpo negro mate; tapa plana gris oscuro con dos perillas moleteadas, el disparador plateado, un botón
    chico y la zapata con sus dos rieles; la joroba del visor en la esquina de atrás del otro lado, con el
    ocular de hule abajo; el lente grande con anillo estriado, anillo de diafragma con rayitas blancas y el
    vidrio oscuro; el punto rojo liso (sin letras) y el foco de enfoque. Atrás, la pantalla con su marco,
    PLAY, la cruceta, MENU, dos botones arriba, la rueda del visor y el descanso del pulgar. Donde la de
    verdad trae letras van runas de SKULLEYGLYPH (Oscar, 2026-11-25), planas para que no lleven tinta."""
    import json
    import shutil
    import subprocess
    from mathutils.geometry import tessellate_polygon

    W, D = 0.127, 0.036              # cuerpo de lado a lado (x) y de fondo (y), sin el lente ni el ocular
    h_cuerpo, h_tapa = 0.0575, 0.0085
    top = h_cuerpo + h_tapa
    atras = D / 2                    # la cara de atrás del cuerpo (+y)
    sobre = 0.00015                  # lo que flotan las runas y los planos sobre su cara
    partes = []

    def estriado(nombre, r, alto, n, prof, mat):
        """Anillo moleteado en z de 0 a alto: n estrías de `prof` sobre el radio r, con tapas."""
        fr, sube = (0.0, 0.15, 0.5, 0.65), (0, prof, prof, 0)
        bm = bmesh.new()
        anillos = []
        for z in (0, alto):
            vs = []
            for k in range(n):
                for f, d in zip(fr, sube):
                    a = 2 * math.pi * (k + f) / n
                    vs.append(bm.verts.new(((r + d) * math.cos(a), (r + d) * math.sin(a), z)))
            anillos.append(vs)
        A, B = anillos
        m = len(A)
        for k in range(m):
            bm.faces.new((A[k], A[(k + 1) % m], B[(k + 1) % m], B[k]))
        for vs, z in ((A, 0), (B, alto)):
            c = bm.verts.new((0, 0, z))
            for k in range(m):
                bm.faces.new((c, vs[k], vs[(k + 1) % m]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return _con_material(_objeto(nombre, bm), mat)

    def torno(nombre, perfil, mats, segs=48):
        """Sólido de revolución alrededor de z: perfil [(radio, z)] cerrado en el eje, un material por tramo."""
        nombres = list(dict.fromkeys(mats))
        bm = bmesh.new()
        anillos = []
        for r, z in perfil:
            if r < 1e-7:
                anillos.append([bm.verts.new((0, 0, z))])
            else:
                anillos.append([bm.verts.new((r * math.cos(2 * math.pi * k / segs), r * math.sin(2 * math.pi * k / segs), z))
                                for k in range(segs)])
        for i, mat in enumerate(mats):
            A, B = anillos[i], anillos[i + 1]
            for k in range(segs):
                k2 = (k + 1) % segs
                if len(A) == 1:
                    vs = (A[0], B[k], B[k2])
                elif len(B) == 1:
                    vs = (A[k], A[k2], B[0])
                else:
                    vs = (A[k], A[k2], B[k2], B[k])
                bm.faces.new(vs).material_index = nombres.index(mat)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = _objeto(nombre, bm)
        for n in nombres:
            o.data.materials.append(material(n))
        return o

    def caja_redonda(nombre, ancho, fondo, alto, radio, abajo, arriba, mat, segs=8, pasos=4):
        """Caja de esquinas redondas (vista desde arriba) con la orilla de abajo y la de arriba redondeadas cada
        una con su radio. Se arma con anillos (cada uno es el contorno metido hacia adentro), no con bevel: con
        esquinas chicas el bevel se recorta en los tramos cortos y deja muescas."""
        perfil = []                                  # (cuánto se mete, z) de abajo hacia arriba
        if abajo > 0:
            perfil += [(abajo * (1 - math.sin(math.pi / 2 * i / pasos)), abajo * (1 - math.cos(math.pi / 2 * i / pasos)))
                       for i in range(pasos + 1)]
        else:
            perfil.append((0.0, 0.0))
        if arriba > 0:
            perfil += [(arriba * (1 - math.cos(math.pi / 2 * i / pasos)), alto - arriba + arriba * math.sin(math.pi / 2 * i / pasos))
                       for i in range(pasos + 1)]
        else:
            perfil.append((0.0, alto))
        bm = bmesh.new()
        anillos = [[bm.verts.new((x, y, z)) for x, y in _redondo(segs, ancho - 2 * m, fondo - 2 * m, radio - m)]
                   for m, z in perfil]
        n = len(anillos[0])
        for A, B in zip(anillos, anillos[1:]):
            for k in range(n):
                bm.faces.new((A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]))
        bm.faces.new(list(reversed(anillos[0])))
        bm.faces.new(anillos[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return _con_material(_objeto(nombre, bm), mat)

    def plano_redondo(nombre, ancho, alto, radio, mat, segs=6):
        """Una sola cara de esquinas redondas en xy (normal +z): sin grueso, así no lleva tinta."""
        bm = bmesh.new()
        bm.faces.new([bm.verts.new((x, y, 0)) for x, y in _redondo(segs, ancho, alto, radio)])
        return _con_material(_objeto(nombre, bm), mat)

    def atras_de(o, x, z, sale=0.0):
        """Gira lo que se armó mirando a +z para que mire hacia atrás (+y) y lo pone en (x, z), con su base
        `sale` detrás de la cara de atrás (negativo: metido en el cuerpo)."""
        return poner(o, (x, atras + sale, z), (-90, 0, 0))

    # ---- las runas: las block letters de scripts/estilo/runas_hito.mjs (las de los hitos; la LL es una runa)
    ALTO_RUNA = 7.2                  # alto nominal de una runa en sus unidades (y de -0.6 a 6.6)
    ESPACIO = 2.2                    # un espacio entre palabras, en las mismas unidades
    SIMPLIFICA = 0.03                # tolerancia de Douglas-Peucker en unidades de la runa (a 4 mm de alto, 0.02 mm)
    node = shutil.which('node') or 'C:/Program Files/nodejs/node.exe'

    def simplificar(pts):
        """Douglas-Peucker de un lazo cerrado, partido en el punto más lejano del primero."""
        def dp(a):
            guarda = [True] + [False] * (len(a) - 2) + [True]
            pila = [(0, len(a) - 1)]
            while pila:
                i, j = pila.pop()
                (x1, y1), (x2, y2) = a[i], a[j]
                L = math.hypot(x2 - x1, y2 - y1) or 1e-12
                d, q = max(((abs((x2 - x1) * (y1 - a[k][1]) - (x1 - a[k][0]) * (y2 - y1)) / L, k) for k in range(i + 1, j)),
                           default=(0.0, -1))
                if q >= 0 and d > SIMPLIFICA:
                    guarda[q] = True
                    pila += [(i, q), (q, j)]
            return [p for p, g in zip(a, guarda) if g]
        if len(pts) < 6:
            return pts
        x0, y0 = pts[0]
        k = max(range(len(pts)), key=lambda i: (pts[i][0] - x0) ** 2 + (pts[i][1] - y0) ** 2)
        return dp(pts[:k + 1])[:-1] + dp(pts[k:] + [pts[0]])[:-1]

    def leer_runas(texto):
        """Un renglón en runas: cada glifo con su centro en x (el renglón centrado en 0) y sus figuras
        (exterior + huecos) alrededor de ese centro, con la y hacia arriba. Devuelve (glifos, ancho)."""
        glifos, cursor = [], 0.0
        for palabra in texto.split():
            r = subprocess.run([node, os.path.join(REPO, 'scripts', 'estilo', 'runas_hito.mjs'), palabra.replace('LL', '#')],
                               cwd=REPO, capture_output=True, text=True, encoding='utf-8', check=True)
            d = json.loads(r.stdout)
            for l in d['letras']:
                lazos = []
                for c in l['contornos']:
                    pts = []
                    for x, y in c['pts']:
                        if not pts or abs(pts[-1][0] - x) + abs(pts[-1][1] - y) > 1e-6:
                            pts.append((x, y))
                    if len(pts) > 2 and abs(pts[0][0] - pts[-1][0]) + abs(pts[0][1] - pts[-1][1]) < 1e-6:
                        pts.pop()
                    pts = simplificar(pts)
                    if len(pts) >= 3:
                        lazos.append((pts, c['hueco']))
                xs = [x for pts, _ in lazos for x, _ in pts]
                cx = (min(xs) + max(xs)) / 2

                def dentro(p, lazo):
                    c = False
                    for i in range(len(lazo)):
                        (xi, yi), (xj, yj) = lazo[i], lazo[i - 1]
                        if (yi > p[1]) != (yj > p[1]) and p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi:
                            c = not c
                    return c
                figuras = [[pts] for pts, hueco in lazos if not hueco]
                for pts, hueco in lazos:
                    if hueco:
                        for fig in figuras:
                            if dentro(pts[0], fig[0]):
                                fig.append(pts)
                                break
                # y hacia arriba, centrado en x en su glifo y en y en la caja nominal (3.0 = el medio de 0..6)
                figuras = [[[(x - cx, 3.0 - y) for x, y in lazo] for lazo in fig] for fig in figuras]
                glifos.append({'cx': cursor + d['ancho'] / 2 + cx, 'figuras': figuras})
            cursor += d['ancho'] + ESPACIO
        ancho = cursor - ESPACIO
        for g in glifos:
            g['cx'] -= ancho / 2
        return glifos, ancho

    def armar_runas(nombre, piezas, s):
        """piezas: [(glifo, P, R, U)]: cada glifo con su centro en P, su derecha R y su arriba U (la cara mira
        a R × U), a `s` metros por unidad. Un solo objeto plano de Album_Marco."""
        bm = bmesh.new()
        for g, P, R, U in piezas:
            for fig in g['figuras']:
                pts = [p for lazo in fig for p in lazo]
                tris = tessellate_polygon([[Vector((x, y, 0)) for x, y in lazo] for lazo in fig])
                vs = [bm.verts.new(P + R * (x * s) + U * (y * s)) for x, y in pts]
                for a, b, c in tris:
                    (x1, y1), (x2, y2), (x3, y3) = pts[a], pts[b], pts[c]
                    area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)
                    if abs(area) < 1e-9:
                        continue
                    if area < 0:
                        b, c = c, b
                    try:
                        bm.faces.new((vs[a], vs[b], vs[c]))
                    except ValueError:
                        pass
        sueltos = [v for v in bm.verts if not v.link_faces]
        bmesh.ops.delete(bm, geom=sueltos, context='VERTS')
        return _con_material(_objeto(nombre, bm), 'Album_Marco')

    def renglon_recto(texto, alto, origen, R, U, alinea=0.0):
        """Un renglón derecho: `origen` es su centro (alinea 0), su orilla de inicio (alinea -1) o la de fin (1)."""
        s = alto / ALTO_RUNA
        glifos, ancho = leer_runas(texto)
        origen = Vector(origen) - R * (alinea * ancho / 2 * s)
        return [(g, origen + R * (g['cx'] * s), R, U) for g in glifos], s, ancho * s

    def renglon_arco(texto, alto, r, z, abajo):
        """Un renglón sobre un arco de radio r en el plano z (el de enfrente de un aro que mira a +z), centrado
        abajo (se lee de izquierda a derecha con la cabeza hacia el centro) o arriba (cabeza hacia afuera)."""
        s = alto / ALTO_RUNA
        glifos, ancho = leer_runas(texto)
        piezas = []
        for g in glifos:
            if abajo:
                th = -math.pi / 2 + g['cx'] * s / r
                R, U = Vector((-math.sin(th), math.cos(th), 0)), Vector((-math.cos(th), -math.sin(th), 0))
            else:
                th = math.pi / 2 - g['cx'] * s / r
                R, U = Vector((math.sin(th), -math.cos(th), 0)), Vector((math.cos(th), math.sin(th), 0))
            piezas.append((g, Vector((r * math.cos(th), r * math.sin(th), z)), R, U))
        return piezas, s, math.degrees(ancho * s / r)

    def perilla(nombre, x, y, r, alto, n):
        aro = poner(estriado(nombre, r, alto, n, 0.0007, 'Leica_Piel'), (x, y, top))
        cara = poner(cilindro(nombre + '_cara', r - 0.0003, 0.0009, 'Leica_Piel', 32, bisel=0.0004), (x, y, top + alto))
        return [aro, cara]

    # ---- el cuerpo de piel negra y la tapa encima, del mismo contorno (la junta queda como una ranura chica)
    partes.append(caja_redonda('leica_cuerpo', W, D, h_cuerpo, 0.0065, 0.0025, 0.0012, 'Leica_Piel'))
    partes.append(poner(caja_redonda('leica_tapa', W, D, h_tapa, 0.0065, 0.0012, 0.0028, 'Leica_Tapa'), (0, 0, h_cuerpo)))
    # la joroba del visor: atrás, del lado contrario a las perillas (+x); llega hasta encima del ocular
    jw = 0.031
    jx = W / 2 - jw / 2 - 0.0004
    j0, j1 = -0.002, atras + 0.0045
    partes.append(poner(caja_redonda('leica_visor', jw, j1 - j0, top + 0.0075 - 0.058, 0.006, 0.001, 0.003, 'Leica_Tapa'),
                        (jx, (j0 + j1) / 2, 0.058)))
    # ---- arriba, del otro lado (-x, a la izquierda vista de frente): la perilla de compensación atrás en la
    # punta, el disparador plateado en su anillo moleteado adelante, el botón chico en la esquina y la de velocidades
    partes += perilla('leica_compensa', -0.050, 0.0055, 0.0088, 0.0058, 24)
    partes += perilla('leica_velocidad', -0.0145, 0.0015, 0.0108, 0.006, 28)
    partes.append(poner(estriado('leica_disparo_aro', 0.0068, 0.0048, 20, 0.0006, 'Leica_Piel'), (-0.036, -0.008, top)))
    partes.append(poner(cilindro('leica_disparo', 0.0042, 0.0022, 'Leica_Metal', 24, bisel=0.0006), (-0.036, -0.008, top + 0.0036)))
    partes.append(poner(cilindro('leica_boton', 0.0034, 0.0014, 'Leica_Piel', 20, bisel=0.0004), (-0.0555, -0.0105, top)))
    # la zapata al centro, con sus dos rieles plateados de adelante hacia atrás
    zx = 0.0125
    partes.append(poner(caja('leica_zapata', (0.020, 0.019, 0.0022), 'Leica_Tapa', 0.0005), (zx, 0, top)))
    for s in (-1, 1):
        partes.append(poner(caja('leica_riel', (0.003, 0.0185, 0.0009), 'Leica_Metal', 0.0003), (zx + s * 0.0078, 0, top + 0.0022)))
    # el nombre del modelo, entre la zapata y la joroba, para leerse desde atrás (como en la de verdad)
    piezas, s_tapa, ancho_tapa = renglon_recto('SKULLEY', 0.0045, (0.0415, -0.0086, top + sobre), Vector((-1, 0, 0)), Vector((0, -1, 0)))
    partes.append(armar_runas('leica_runas_tapa', piezas, s_tapa))

    # ---- enfrente: el punto rojo liso (arriba a la derecha, junto a la tapa) y el foco de enfoque
    frente = -D / 2
    partes.append(poner(cilindro('leica_punto', 0.005, 0.0013, 'Leica_Rojo', 32, bisel=0.0003), (0.046, frente + 0.0005, 0.0508), (90, 0, 0)))
    partes.append(poner(plano_redondo('leica_foco', 0.0042, 0.0042, 0.0021, 'Leica_Vidrio', 8), (-0.0235, frente - sobre, 0.061), (90, 0, 0)))

    # ---- el lente: perfil (radio, distancia al frente del cuerpo) en mm, del centro del vidrio hacia afuera y
    # de regreso. El aro de adentro (donde van las runas) y el aro del frente, con las proporciones de la foto.
    mm = 0.001
    perfil = [(0.0, 19.6), (7.0, 19.45), (11.5, 19.1), (14.0, 18.7),                     # vidrio, un poco abombado
              (14.4, 19.2), (19.9, 19.2),                                                 # el aro de adentro
              (20.2, 21.4), (20.8, 22.0), (25.0, 22.0), (25.9, 21.6), (26.25, 20.8), (26.25, 16.8),   # el aro del frente
              (25.75, 16.5), (25.75, 16.1),                                               # ranura
              (26.5, 15.8), (26.6, 15.3), (26.6, 10.4), (26.3, 9.9), (25.75, 9.7),        # anillo de diafragma
              (25.75, 3.0), (25.45, 2.8), (25.45, 0.6), (26.1, 0.2), (26.1, -1.0), (0.0, -1.0)]   # base (el estriado va encima)
    mats = ['Leica_Vidrio'] * 3 + ['Leica_Lente'] * (len(perfil) - 4)
    lente = [torno('leica_lente', [(r * mm, t * mm) for r, t in perfil], mats)]
    lente.append(poner(estriado('leica_anillo', 25.85 * mm, 6.3 * mm, 36, 0.75 * mm, 'Leica_Lente'), (0, 0, 3.2 * mm)))
    # las rayitas blancas del diafragma en el arco de arriba (planos: no meten tinta)
    for i in range(9):
        a = math.radians(30 + 15 * i)
        r = 26.6 * mm + 0.00025
        lente.append(poner(plano('leica_raya', 3.4 * mm, 1.1 * mm, 'Album_Marco'),
                           (r * math.cos(a), r * math.sin(a), 12.85 * mm), (0, 90, math.degrees(a))))
    # las runas del aro de adentro: SKULLEYGLYPH abajo (donde la de verdad dice el nombre del lente) y SKULLEY
    # arriba (donde dice la marca)
    r_aro, z_aro, alto_aro = 17.15 * mm, 19.2 * mm + sobre, 0.004
    abajo, s_aro, grados_abajo = renglon_arco('SKULLEYGLYPH', alto_aro, r_aro, z_aro, True)
    arriba, _, grados_arriba = renglon_arco('SKULLEY', alto_aro, r_aro, z_aro, False)
    lente.append(armar_runas('leica_runas_lente', abajo + arriba, s_aro))
    x_l, z_l = -0.004, h_cuerpo - 26.6 * mm - 0.0008
    for p in lente:
        poner(p, (0, 0, 0), (90, 0, 0))
        poner(p, (x_l, frente, z_l))
    partes += lente

    # ---- atrás. El ocular: una caja de hule debajo de la joroba que sale un poco más que ella, con su vidrio
    oc_z = 0.061
    partes.append(atras_de(caja_redonda('leica_ocular_hule', jw - 0.001, 0.017, 0.0065, 0.004, 0.0, 0.0012, 'Leica_Piel'), jx, oc_z, -0.001))
    partes.append(atras_de(plano_redondo('leica_ocular', 0.023, 0.011, 0.002, 'Leica_Ventana'), jx, oc_z, 0.0055 + sobre))
    # la rueda de dioptrías junto al ocular, de canto
    partes.append(poner(estriado('leica_dioptria', 0.0042, 0.003, 12, 0.0006, 'Leica_Piel'), (jx - jw / 2 - 0.0044, atras + 0.0005, 0.0605), (0, 90, 0)))
    # la pantalla con su marco (del lado del visor)
    px, pz = 0.0135, 0.0255
    partes.append(atras_de(caja_redonda('leica_marco', 0.068, 0.042, 0.0017, 0.003, 0.0, 0.0005, 'Leica_Tapa'), px, pz, -0.0005))
    partes.append(atras_de(plano_redondo('leica_pantalla', 0.062, 0.036, 0.0015, 'Leica_Pantalla'), px, pz, 0.0012 + sobre))
    # a la derecha (vista desde atrás, -x): PLAY arriba, la cruceta con su botón al centro y MENU abajo
    bx = -0.042
    for nombre, z in (('play', 0.0435), ('menu', 0.0105)):
        partes.append(atras_de(caja_redonda(f'leica_{nombre}', 0.011, 0.008, 0.0018, 0.0022, 0.0, 0.0006, 'Leica_Tapa'), bx, z, -0.0005))
    partes.append(atras_de(cilindro('leica_cruceta', 0.0085, 0.0017, 'Leica_Tapa', 40, bisel=0.0005), bx, 0.026, -0.0005))
    partes.append(atras_de(cilindro('leica_cruceta_centro', 0.0033, 0.0024, 'Leica_Piel', 24, bisel=0.0006), bx, 0.026, -0.0005))
    # los dos botones redondos de arriba, bajo las perillas, y el descanso del pulgar en la orilla
    for x in (-0.0145, -0.0265):
        partes.append(atras_de(cilindro('leica_boton_atras', 0.0025, 0.0018, 'Leica_Piel', 20, bisel=0.0005), x, 0.0607, -0.0005))
    partes.append(atras_de(caja_redonda('leica_pulgar', 0.0048, 0.026, 0.0019, 0.0024, 0.0, 0.0009, 'Leica_Tapa'), -0.0555, 0.028, -0.0005))
    # las runas de atrás: dos renglones arriba a la izquierda (junto a la rueda) y las de PLAY y MENU
    izq, arr = Vector((-1, 0, 0)), Vector((0, 0, 1))      # la derecha y el arriba de quien la ve por detrás
    x0, alto_atras = jx - jw / 2 - 0.0062, 0.0037
    r1, s_atras, ancho1 = renglon_recto('SKULLEY CAMERA', alto_atras, (x0, atras + sobre, 0.0540), izq, arr, -1)
    r2, _, ancho2 = renglon_recto('HECHO EN MEXICO', alto_atras, (x0, atras + sobre, 0.04935), izq, arr, -1)
    partes.append(armar_runas('leica_runas_atras', r1 + r2, s_atras))
    cara_boton = atras + 0.0013 + sobre
    rp, s_boton, ancho_play = renglon_recto('PLAY', 0.0033, (bx, cara_boton, 0.0435), izq, arr)
    rm, _, ancho_menu = renglon_recto('MENU', 0.0033, (bx, cara_boton, 0.0105), izq, arr)
    partes.append(armar_runas('leica_runas_botones', rp + rm, s_boton))
    print('leica, runas (mm):', {'tapa': round(ancho_tapa * 1000, 1), 'lente_abajo_grados': round(grados_abajo),
                                 'lente_arriba_grados': round(grados_arriba), 'atras': (round(ancho1 * 1000, 1), round(ancho2 * 1000, 1)),
                                 'play': round(ancho_play * 1000, 1), 'menu': round(ancho_menu * 1000, 1)})

    # ---- los ojillos plateados de la correa a los lados (la correa no va)
    for s in (-1, 1):
        poste = cilindro('leica_ojillo', 0.0022, 0.0024, 'Leica_Metal', 16)
        cabeza = poner(cilindro('leica_ojillo_cabeza', 0.0032, 0.0013, 'Leica_Metal', 20, bisel=0.0004), (0, 0, 0.0022))
        for p in (poste, cabeza):
            poner(p, (0, 0, 0), (0, 90 * s, 0))
            poner(p, (s * (W / 2 - 0.0005), 0, 0.051))
        partes += [poste, cabeza]
    return asentar(unir('Ofrenda_leica', partes))


# ---------------------------------------------------------------- 3. el álbum de fotos de su gente

def album():
    W, H = 0.30, 0.31            # cada tapa
    partes = []
    for s in (-1, 1):
        tapa = losa(f'album_tapa{s}', W, H, 0.006, 0.01, 0.002, mat_canto='Album_Piel')
        poner(tapa, (s * (W / 2 + 0.006), 0, 0))
        hojas = losa(f'album_hojas{s}', W - 0.016, H - 0.016, 0.014, 0.004, 0.0015, mat_canto='Album_Hojas')
        # las hojas suben un poco hacia el lomo
        poner(hojas, (s * (W / 2 + 0.002), 0, 0.006), (0, -4 * s, 0))
        partes += [tapa, hojas]
    lomo = cilindro('album_lomo', 0.011, H, 'Album_Piel', 20)
    poner(lomo, (0, 0, 0), (90, 0, 0))
    poner(lomo, (0, H / 2, 0.004))
    partes.append(lomo)
    # las fotos: marco blanco, foto (una celda del atlas de 4 x 2) y esquineros
    fotos = [(-0.22, 0.07, 6, 0), (-0.09, 0.075, -4, 1), (-0.155, -0.075, 3, 2),
             (0.09, 0.07, -5, 3), (0.215, 0.05, 7, 4), (0.15, -0.08, -3, 5)]
    for x, y, gira, celda in fotos:
        s = 1 if x > 0 else -1
        z = 0.0205 + (abs(x) - (W / 2 + 0.002)) * math.sin(math.radians(4)) + 0.0004
        cu, cv = celda % 4, celda // 4
        marco = poner(plano(f'album_marco{celda}', 0.105, 0.125, 'Album_Marco'), (0, 0, 0), (0, 0, gira))
        foto = poner(plano(f'album_foto{celda}', 0.089, 0.093, 'Album_Fotos', (cu / 4, cv / 2, (cu + 1) / 4, (cv + 1) / 2)), (0, 0.009, 0.0004), (0, 0, gira))
        piezas = [marco, foto]
        for ex, ey in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            e = poner(caja('album_esquina', (0.014, 0.014, 0.0012), 'Album_Esquina'), (ex * 0.05, ey * 0.06, 0), (0, 0, 45 + gira))
            piezas.append(e)
        for p in piezas:
            poner(p, (0, 0, 0), (0, -4 * s, 0))
            poner(p, (x, y, z))
        partes += piezas
    # dos fotos sueltas en el piso, enfrente
    for k, (x, y, gira) in enumerate(((-0.12, -0.24, 14), (0.06, -0.22, -9))):
        celda = 6 + k
        cu, cv = celda % 4, celda // 4
        marco = poner(caja(f'album_suelta{k}', (0.105, 0.125, 0.0015), 'Album_Marco'), (0, 0, 0), (0, 0, gira))
        foto = poner(plano(f'album_suelta_foto{k}', 0.089, 0.093, 'Album_Fotos', (cu / 4, cv / 2, (cu + 1) / 4, (cv + 1) / 2)), (0, 0.009, 0.0016), (0, 0, gira))
        for p in (marco, foto):
            poner(p, (x, y, 0))
        partes += [marco, foto]
    return asentar(unir('Ofrenda_album', partes))


# ---------------------------------------------------------------- 4. su teclado MIDI (tipo MiniLab 3)

def teclado():
    W, H, T = 0.355, 0.22, 0.026
    partes = [losa('teclado_cuerpo', W, H, T, 0.012, 0.004, mat_canto='Teclado_Cuerpo')]
    # 25 teclas (15 blancas) al frente (-Y)
    n_bl = 15
    ancho_teclado = W - 0.03
    wb = ancho_teclado / n_bl
    y0 = -H / 2 + 0.012                       # frente de las teclas
    largo_b, largo_n = 0.088, 0.054
    x0 = -ancho_teclado / 2
    for i in range(n_bl):
        t = caja(f'tecla_b{i}', (wb - 0.0012, largo_b, 0.010), 'Teclado_Blanca', 0.0012)
        poner(t, (x0 + (i + 0.5) * wb, y0 + largo_b / 2, T - 0.003))
        partes.append(t)
    negras = [i for i in range(n_bl - 1) if (i % 7) not in (2, 6)]
    for i in negras:
        t = caja(f'tecla_n{i}', (wb * 0.58, largo_n, 0.008), 'Teclado_Negra', 0.0012)
        poner(t, (x0 + (i + 1) * wb, y0 + largo_b - largo_n / 2, T + 0.006))
        partes.append(t)
    zc = T
    ya = y0 + largo_b + 0.008                 # donde empiezan los controles
    # 8 pads en una fila (UV a lo largo: el sitio les pone un color a cada uno)
    pad, hueco = 0.02, 0.0045
    xp0 = -0.016
    for k in range(8):
        p = losa(f'pad{k}', pad, pad, 0.004, 0.003, 0.001, mat_canto='Teclado_Pads')
        x = xp0 + k * (pad + hueco)
        poner(p, (x, ya + pad / 2 + 0.004, zc))
        # UV de toda la pieza en la celda k de 8 (el sitio pinta un color por celda)
        partes.append(p)
        p['celda'] = k
    # 8 perillas (dos filas de 4) arriba de los pads y 4 faders a la derecha
    for fila in range(2):
        for k in range(4):
            x = xp0 + 0.004 + k * 0.032
            y = ya + pad + 0.03 + fila * 0.032
            per = cilindro(f'perilla{fila}{k}', 0.0085, 0.011, 'Teclado_Perilla', 24, radio2=0.0078, bisel=0.0012)
            poner(per, (x, y, zc))
            marca = poner(caja('perilla_marca', (0.0015, 0.006, 0.001), 'Teclado_Marca'), (x, y + 0.004, zc + 0.011))
            partes += [per, marca]
    for k in range(4):
        x = xp0 + 4 * 0.032 + 0.012 + k * 0.012
        ranura = poner(caja(f'ranura{k}', (0.003, 0.058, 0.0008), 'Teclado_Negra'), (x, ya + pad + 0.046, zc))
        y_cap = ya + pad + 0.03 + [0.03, 0.012, 0.042, 0.022][k]
        cap = poner(caja(f'fader{k}', (0.009, 0.006, 0.008), 'Teclado_Fader', 0.0012), (x, y_cap, zc))
        partes += [ranura, cap]
    # a la izquierda: dos tiras táctiles, la pantallita y la perilla grande
    for k in range(2):
        tira = losa(f'tira{k}', 0.012, 0.075, 0.0015, 0.004, 0.0005, mat_canto='Teclado_Tira')
        poner(tira, (-W / 2 + 0.018 + k * 0.018, ya + 0.042, zc))
        partes.append(tira)
    pantalla = losa('pantalla', 0.046, 0.017, 0.0012, 0.002, 0.0, mat_canto='Teclado_Pantalla')
    poner(pantalla, (-0.085, ya + 0.068, zc))
    perilla = cilindro('perilla_grande', 0.0115, 0.012, 'Teclado_Perilla', 28, radio2=0.0105, bisel=0.0015)
    poner(perilla, (-0.085, ya + 0.034, zc))
    partes += [pantalla, perilla]
    for k in range(4):
        boton = losa(f'boton{k}', 0.011, 0.007, 0.003, 0.0018, 0.0006, mat_canto='Teclado_Perilla')
        poner(boton, (-0.122 + k * 0.016, ya + 0.008, zc))
        partes.append(boton)
    # UV de los pads: cada uno en su celda
    for p in partes:
        if 'celda' in p.keys():
            k = p['celda']
            me = p.data
            capa = me.uv_layers.new(name='UVMap') if not me.uv_layers else me.uv_layers[0]
            for loop in me.loops:
                capa.data[loop.index].uv = ((k + 0.5) / 8, 0.5)
    for p in partes:
        if not p.data.uv_layers:
            p.data.uv_layers.new(name='UVMap')
    return asentar(unir('Ofrenda_teclado', partes))


# ---------------------------------------------------------------- 5. la caja de cerillos que le regaló su novia

def cerillos():
    L, W, T = 0.053, 0.036, 0.016            # largo (x), ancho (y), alto (z)
    pared = 0.0012
    partes = []
    # la funda: arriba con su etiqueta, abajo, y a los lados la lija
    arriba = poner(caja('funda_arriba', (L, W, pared), 'Cerillos_Caja'), (0, 0, T - pared))
    etiqueta = poner(plano('etiqueta', L - 0.004, W - 0.004, 'Cerillos_Etiqueta'), (0, 0, T + 0.0002))
    abajo = caja('funda_abajo', (L, W, pared), 'Cerillos_Caja')
    lados = [poner(caja(f'funda_lado{s}', (L, pared, T), 'Cerillos_Lija'), (0, s * (W / 2 - pared / 2), 0)) for s in (-1, 1)]
    partes += [arriba, etiqueta, abajo] + lados
    # el cajoncito, medio salido hacia +x, con los cerillos adentro
    sale = 0.026
    cw, ct = W - 2 * pared - 0.0006, T - 2 * pared - 0.0006
    fondo = poner(caja('cajon_fondo', (L - 0.002, cw, 0.001), 'Cerillos_Caja'), (sale, 0, pared + 0.0003))
    paredes = [poner(caja(f'cajon_lado{s}', (L - 0.002, 0.001, ct), 'Cerillos_Caja'), (sale, s * (cw / 2 - 0.0005), pared + 0.0003)) for s in (-1, 1)]
    puntas = [poner(caja(f'cajon_punta{s}', (0.001, cw, ct), 'Cerillos_Caja'), (sale + s * (L / 2 - 0.0015), 0, pared + 0.0003)) for s in (-1, 1)]
    partes += [fondo] + paredes + puntas

    def cerillo(nombre, quemado=False):
        palo = caja(nombre, (0.042, 0.0022, 0.0022), 'Cerillos_Palo')
        cab = poner(esfera(nombre + '_cab', 0.0026, 'Cerillos_Quemado' if quemado else 'Cerillos_Cabeza', (1.5, 1, 1), 12), (0.022, 0, 0.0011))
        if quemado:
            tizne = poner(caja(nombre + '_tizne', (0.012, 0.0023, 0.0023), 'Cerillos_Quemado'), (0.0155, 0, 0))
            return [palo, cab, tizne]
        return [palo, cab]

    # Todos adentro del cajón (Oscar: las cabezas salían por el frente): la punta de la cabeza
    # llega a 0.0259 del centro del cerillo y queda a medio milímetro de la cara de adentro del
    # frente; a los lados, la cabeza más afuera (con el abanico) queda dentro de las paredes, y la
    # cabeza, más gorda que el palo, apoya arriba del fondo (antes se metía en él).
    adentro_frente = sale + L / 2 - 0.0015 - 0.0005
    x_cerillo = adentro_frente - 0.0259 - 0.0006
    fondo_arriba = pared + 0.0003 + 0.001
    z_cerillo = fondo_arriba + (0.0026 - 0.0011) + 0.0002
    for k in range(7):
        for p in cerillo(f'cerillo{k}'):
            poner(p, (0, 0, 0), (0, 0, (k - 3) * 0.6))
            poner(p, (x_cerillo, (k - 3) * 0.0038, z_cerillo + (k % 2) * 0.0018))
            partes.append(p)
    # cuánto se sale el cerillo más salido de la cara de adentro de cada pared del cajón (negativo: holgura)
    adentro = (sale - L / 2 + 0.002, adentro_frente, -(cw / 2 - 0.001), cw / 2 - 0.001, fondo_arriba)
    vs = [v.co for p in partes if p.name.startswith('cerillo') for v in p.data.vertices]
    sale_de = {'atras': max(adentro[0] - v.x for v in vs), 'frente': max(v.x - adentro[1] for v in vs),
               'lados': max(max(adentro[2] - v.y, v.y - adentro[3]) for v in vs), 'fondo': max(adentro[4] - v.z for v in vs)}
    print('cerillos, se salen del cajón (mm):', {k: round(d * 1000, 2) for k, d in sale_de.items()})
    # dos afuera, en el piso (la cabeza apoyada): uno nuevo y uno quemado
    for p in cerillo('suelto0'):
        poner(p, (0, 0, 0), (0, 0, 35))
        poner(p, (0.02, -0.035, 0.0015))
        partes.append(p)
    for p in cerillo('suelto1', True):
        poner(p, (0, 0, 0), (0, 0, -150))
        poner(p, (-0.032, -0.033, 0.0015))
        partes.append(p)
    return asentar(unir('Ofrenda_cerillos', partes))


# ---------------------------------------------------------------- 6. la almohada que lo deja soñar

def almohada():
    A, B, H = 0.62, 0.42, 0.075              # medio largo, medio ancho... (ancho total, fondo total, media altura)
    nu, nv = 48, 32
    bm = bmesh.new()

    def alto(u, v):
        # infla al centro y cierra en la costura de la orilla, con las esquinas que se pellizcan
        f = (1 - abs(u) ** 2.6) ** 0.55 * (1 - abs(v) ** 2.6) ** 0.55
        return H * f

    def punto(u, v, lado):
        # las orillas se meten un poco hacia el centro de cada lado (la tela jala)
        x = u * A / 2 * (1 - 0.06 * (1 - abs(v) ** 2))
        y = v * B / 2 * (1 - 0.06 * (1 - abs(u) ** 2))
        return Vector((x, y, H + lado * alto(u, v)))

    caras = {}
    for lado in (1, -1):
        rej = [[bm.verts.new(punto(-1 + 2 * i / nu, -1 + 2 * j / nv, lado)) for i in range(nu + 1)] for j in range(nv + 1)]
        caras[lado] = rej
        for j in range(nv):
            for i in range(nu):
                q = (rej[j][i], rej[j][i + 1], rej[j + 1][i + 1], rej[j + 1][i])
                bm.faces.new(q if lado == 1 else tuple(reversed(q)))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    tela = _con_material(_objeto('almohada_tela', bm), 'Almohada_Tela')
    # el ribete de la costura: un tubito por la orilla
    orilla = []
    for k in range(4 * nu):
        t = k / (4 * nu)
        if t < 0.25:
            u, v = -1 + 8 * t, -1
        elif t < 0.5:
            u, v = 1, -1 + 8 * (t - 0.25)
        elif t < 0.75:
            u, v = 1 - 8 * (t - 0.5), 1
        else:
            u, v = -1, 1 - 8 * (t - 0.75)
        orilla.append(punto(u, v, 1))
    bmr = bmesh.new()
    r = 0.006
    anillos = []
    n = len(orilla)
    for k, p in enumerate(orilla):
        d = (orilla[(k + 1) % n] - orilla[k - 1]).normalized()
        a = Vector((0, 0, 1))
        b = d.cross(a).normalized()
        anillos.append([bmr.verts.new(p + (a * math.cos(2 * math.pi * s / 8) + b * math.sin(2 * math.pi * s / 8)) * r) for s in range(8)])
    for k in range(n):
        A0, A1 = anillos[k], anillos[(k + 1) % n]
        for s in range(8):
            t2 = (s + 1) % 8
            bmr.faces.new((A0[s], A0[t2], A1[t2], A1[s]))
    ribete = _con_material(_objeto('almohada_ribete', bmr), 'Almohada_Ribete')
    o = asentar(unir('Ofrenda_almohada', [tela, ribete]))
    # la tela se ve redonda: sin cantos duros
    try:
        o.data.set_sharp_from_angle(angle=math.radians(80))
    except Exception:
        pass
    return o


# ---------------------------------------------------------------- armar, exportar y revisar

def modelar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    hechos = {}
    for i, (nombre, f) in enumerate((('ipad', ipad), ('leica', leica), ('album', album), ('teclado', teclado),
                                     ('cerillos', cerillos), ('almohada', almohada))):
        o = f()
        for p in o.data.polygons:
            p.use_smooth = True
        o['id'] = nombre
        vs = [v.co for v in o.data.vertices]
        hechos[nombre] = {'tam_cm': [round((max(v[k] for v in vs) - min(v[k] for v in vs)) * 100, 1) for k in range(3)],
                          'caras': len(o.data.polygons), 'materiales': [m.name for m in o.data.materials]}
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    return hechos


def exportar():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    for o in bpy.context.view_layer.objects:
        o.select_set(o.name.startswith('Ofrenda_'))
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB, export_format='GLB', use_selection=True, export_apply=True,
        export_animations=False, export_skins=False, export_morph=False, export_materials='EXPORT',
        export_image_format='NONE', export_cameras=False, export_lights=False, export_extras=True,
        export_yup=True, export_texcoords=True, export_normals=True,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    )
    return {'glb': GLB, 'kb': round(os.path.getsize(GLB) / 1024, 1)}


def render(carpeta):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_object_outline = True
    sh.object_outline_color = (0, 0, 0)
    sh.show_cavity = True
    sh.cavity_type = 'WORLD'
    sc.render.resolution_x = 640
    sc.render.resolution_y = 520
    sc.render.film_transparent = False
    sh.background_type = 'VIEWPORT'
    sh.background_color = (0.13, 0.17, 0.42)
    os.makedirs(carpeta, exist_ok=True)
    cam_d = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    objetos = [o for o in bpy.data.objects if o.name.startswith('Ofrenda_')]
    rutas = []
    for o in objetos:
        for x in objetos:
            x.hide_render = x is not o
        vs = [o.matrix_world @ v.co for v in o.data.vertices]
        c = sum(vs, Vector()) / len(vs)
        r = max((v - c).length for v in vs)
        for vista, d in (('frente', Vector((0.55, -1.0, 0.75))), ('arriba', Vector((0.15, -0.6, 1.4)))):
            d = d.normalized()
            cam.location = c + d * r * 3.1
            cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
            cam_d.lens = 50
            ruta = os.path.join(carpeta, f'{o.name}_{vista}.png')
            sc.render.filepath = ruta
            bpy.ops.render.render(write_still=True)
            rutas.append(ruta)
    return rutas


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    modo = args[0]
    out = {}
    if modo in ('modelar', 'todo'):
        out['modelar'] = modelar()
    if modo in ('exportar', 'todo'):
        out['exportar'] = exportar()
    if modo in ('render', 'todo'):
        out['render'] = render(args[1] if len(args) > 1 else os.path.join(REPO, 'scripts', 'ofrenda', 'renders'))
    print('RESULTADO', out)


if __name__ == '__main__':
    main()
