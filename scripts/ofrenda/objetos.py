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
    'Leica_Vidrio': (0.10, 0.14, 0.22), 'Leica_Rojo': (0.85, 0.05, 0.06), 'Leica_Ventana': (0.20, 0.24, 0.30),
    'Leica_Correa': (0.35, 0.18, 0.08),
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


# ---------------------------------------------------------------- 2. su cámara Leica

def leica():
    W, D = 0.138, 0.034          # cuerpo de M: de lado a lado y de fondo (puntas redondas)
    h_cuerpo, h_tapa = 0.058, 0.018
    partes = []
    # el cuerpo: el contorno visto desde arriba es un rectángulo de puntas redondas; de pie (z arriba)
    base = losa('leica_base', W, D, 0.004, D / 2 - 0.0005, 0.0012, mat_canto='Leica_Metal')
    cuerpo = poner(losa('leica_cuerpo', W - 0.002, D - 0.002, h_cuerpo, D / 2 - 0.0015, 0.0, mat_canto='Leica_Piel'), (0, 0, 0.004))
    tapa = poner(losa('leica_tapa', W, D, h_tapa, D / 2 - 0.0005, 0.0018, mat_canto='Leica_Metal'), (0, 0, 0.004 + h_cuerpo))
    partes += [base, cuerpo, tapa]
    top = 0.004 + h_cuerpo + h_tapa
    # arriba: perilla de velocidades con disparador, palanca de avance, perilla de rebobinado y zapata
    partes.append(poner(cilindro('leica_dial', 0.0105, 0.006, 'Leica_Metal', 28, bisel=0.0008), (0.034, 0.002, top)))
    partes.append(poner(cilindro('leica_disparo', 0.0045, 0.006, 'Leica_Metal', 16, bisel=0.0008), (0.046, -0.006, top)))
    partes.append(poner(cilindro('leica_disparo2', 0.0026, 0.002, 'Leica_Piel', 12), (0.046, -0.006, top + 0.006)))
    palanca = poner(caja('leica_palanca', (0.024, 0.004, 0.002), 'Leica_Metal', 0.0006), (0.058, 0.006, top + 0.0035), (0, 0, 25))
    partes.append(palanca)
    partes.append(poner(cilindro('leica_rebobina', 0.0085, 0.009, 'Leica_Metal', 24, bisel=0.0008), (-0.045, 0.002, top)))
    partes.append(poner(caja('leica_zapata', (0.018, 0.017, 0.003), 'Leica_Metal', 0.0005), (-0.005, 0.002, top)))
    # enfrente (-Y): ventanas del telémetro y del visor, la de luz y el punto rojo
    frente = -D / 2 - 0.0004
    zv = 0.004 + h_cuerpo + h_tapa / 2
    for nombre, x, w, h, mat in (('leica_telemetro', -0.042, 0.011, 0.008, 'Leica_Ventana'),
                                 ('leica_luz', -0.012, 0.012, 0.0075, 'Album_Marco'),
                                 ('leica_visor', 0.041, 0.017, 0.0105, 'Leica_Ventana')):
        partes.append(poner(plano(nombre, w, h, mat), (x, frente, zv), (90, 0, 0)))
    partes.append(poner(cilindro('leica_punto', 0.0052, 0.0012, 'Leica_Rojo', 20), (0.016, frente + 0.0002, zv), (90, 0, 0)))
    # el lente de 50 mm: montura, anillo de enfoque con su uña, anillo de diafragma y el vidrio
    zl = 0.004 + h_cuerpo * 0.52
    x_l = 0.004
    capas = (('leica_montura', 0.025, 0.004, 'Leica_Metal'), ('leica_enfoque', 0.0235, 0.011, 'Leica_Lente'),
             ('leica_diafragma', 0.0225, 0.010, 'Leica_Metal'), ('leica_frente', 0.0215, 0.011, 'Leica_Lente'))
    y = -D / 2
    for nombre, r, largo, mat in capas:
        c = cilindro(nombre, r, largo, mat, 32, bisel=0.0008)
        poner(c, (0, 0, 0), (90, 0, 0))
        poner(c, (x_l, y, zl))
        y -= largo
        partes.append(c)
    vidrio = poner(cilindro('leica_vidrio', 0.017, 0.002, 'Leica_Vidrio', 32), (0, 0, 0), (90, 0, 0))
    poner(vidrio, (x_l, y + 0.0018, zl))
    partes.append(vidrio)
    una = poner(caja('leica_una', (0.008, 0.006, 0.006), 'Leica_Metal', 0.0012), (x_l, -D / 2 - 0.008, zl - 0.026))
    partes.append(una)
    # los ojillos de la correa en las puntas
    for s in (-1, 1):
        partes.append(poner(cilindro('leica_ojillo', 0.003, 0.004, 'Leica_Metal', 12), (0, 0, 0), (0, 90 * s, 0)))
        poner(partes[-1], (s * (W / 2 + 0.0015), 0, 0.004 + h_cuerpo + 0.006))
    # la correa de piel, enroscada en el piso detrás
    t = bmesh.new()
    bmesh.ops.create_circle(t, cap_ends=False, segments=48, radius=1)
    curva = []
    for k in range(40):
        a = k / 39 * math.pi * 1.6
        curva.append(Vector((0.05 * math.cos(a) + 0.01, 0.045 + 0.04 * math.sin(a), 0.0025)))
    t.free()
    bmc = bmesh.new()
    ancho, grueso = 0.012, 0.0025
    prev = None
    for i, p in enumerate(curva):
        d = (curva[min(i + 1, len(curva) - 1)] - curva[max(i - 1, 0)]).normalized()
        lado = Vector((-d.y, d.x, 0)) * ancho / 2
        anillo = [bmc.verts.new(p + lado + Vector((0, 0, grueso / 2))), bmc.verts.new(p - lado + Vector((0, 0, grueso / 2))),
                  bmc.verts.new(p - lado - Vector((0, 0, grueso / 2))), bmc.verts.new(p + lado - Vector((0, 0, grueso / 2)))]
        if prev:
            for a in range(4):
                b = (a + 1) % 4
                bmc.faces.new((prev[a], prev[b], anillo[b], anillo[a]))
        prev = anillo
    correa = _con_material(_objeto('leica_correa', bmc), 'Leica_Correa')
    partes.append(correa)
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
