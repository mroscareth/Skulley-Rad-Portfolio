"""Props del grupo senderos: los senderos del bosque y el Mirador (Oscar, 2026-11-24; features.md,
La ofrenda -> El estilo gráfico). Pintados a mano con la librería compartida (scripts/estilo/pintura.py):
poca geometría con biseles grandes, formas gorditas, nada derecho, y la acuarela horneada hace el resto.

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_senderos.py -- todo [carpeta_fotos]

  armar     arma los props y sus materiales y guarda Character/Estilo_senderos.blend
  pintar    hornea el atlas de 2048 (Cycles) a Character/assets/props_senderos.png (el maestro)
  exportar  escribe public/3dmodels/estilo/props_senderos.glb (todos en fila, un material)
  render    fotos de revisión (la fila completa y cada prop de cerca) en la carpeta que se le dé
  todo      los cuatro

Si se retoca el PNG maestro a mano, basta `exportar`.

Los props (cada uno un objeto Prop_<Nombre>, en metros, base en z = 0, el frente hacia -Y):
  Prop_LetreroCruce   poste de 2.2 m con tres flechas; cada flecha es un hijo aparte,
                      Prop_LetreroCruce_Flecha1..3 (el sitio les pone runas encima): su origen va en
                      el centro de la tabla, +X hacia la punta, la cara de enfrente mira a -Y y +Z
                      arriba; su segundo UV (`Runas`) va de 0 a 1 a lo largo (cola -> punta) y a lo
                      alto, y en la cara de atrás va al revés para que se lea bien desde ahí.
  Prop_Banca          banca del Mirador (1.6 m)
  Prop_Barandal       tramo de cerca de 2 m: un poste adelante en x = -1 y uno atrás en x = +1, así
                      repetido cada 2 m los travesaños quedan entre los dos postes de cada unión
  Prop_Farol          farol de 2.2 m; el vidrio es el hijo Prop_Farol_Vidrio (el sitio lo prende)
  Prop_Puente         puente arqueado de 3.6 m (lo que cruza, en X) por 3.2 m (el ancho del sendero)
  Prop_Vado           cuatro piedras planas en fila (2.5 m) para la playa de la laguna
  Prop_PiedraVado1..3 piedras planas sueltas
  Prop_Tocon          tocón de pino con anillos y raíces
  Prop_Tronco         tronco caído de 3 m con un muñón de rama y musgo

Mientras se hornea, todo vive en coordenadas del mundo, cada prop en su lugar de la fila (así los
lavados no se repiten entre props y la luz pintada sabe a qué altura está cada pieza). Al exportar,
cada objeto pasa a su marco (`marco`, guardado en el objeto) y los hijos se cuelgan de su prop.
"""
import math
import os
import random
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import pintura as P  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_senderos.blend')
PNG = os.path.join(REPO, 'Character', 'assets', 'props_senderos.png')
GLB = os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_senderos.glb')
TAM = 2048
SEMILLA = 11
SEPARACION = 0.8

CORTEZA = {'oscura': '#3a2618', 'media': '#4d3221', 'base': '#5c3c27', 'clara': '#7a5437', 'luz': '#977050',
           'linea': '#20130a', 'orilla': '#c7a476', 'astilla': '#1b1008', 'mugre': '#181008',
           'calido': '#73402a', 'frio': '#4e4934'}
VIDRIO = '#ffb03b'
# Piedra un poco más oscura y fría que P.PIEDRA: con la luz pintada arriba la de la librería salía casi blanca.
ROCA = {'oscura': '#474645', 'base': '#6d6b66', 'clara': '#8f8c83', 'orilla': '#d6d1c0', 'musgo': '#4c6a2a', 'mugre': '#2f2c28'}
MUSGO = ('#58782f', '#8dad4b')

MAT = {}


# ---------------------------------------------------------------- ayudantes de geometría

def transformar(o, M):
    o.data.transform(M)


def mover(objs, d):
    for o in objs:
        o.data.transform(Matrix.Translation(d))


def caja_mundo(objs):
    lo = np.array([1e9] * 3)
    hi = np.array([-1e9] * 3)
    for o in objs:
        co = np.empty(len(o.data.vertices) * 3, np.float32)
        o.data.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        lo = np.minimum(lo, co.min(0))
        hi = np.maximum(hi, co.max(0))
    return lo, hi


def doblar(o, f):
    """Sube cada vértice f(x) (coordenadas del mundo: la pieza ya colocada)."""
    for v in o.data.vertices:
        v.co.z += f(v.co.x)


def suavizar(o):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))


def a_euler(x, y, z):
    """Rotación cuyas columnas son los ejes locales x, y, z (vectores del mundo)."""
    return Matrix((x, y, z)).transposed().to_euler('XYZ')


def palo(nombre, largo, radio, material, M=None, lados=11, cortes=6, punta=1.0, chueco=0.008, bisel=0.01, semilla=None):
    """Un palo acostado a lo largo de X (centrado), que se afila a `punta` × radio hacia +X; con 11
    lados queda redondo y liso sin biseles a lo largo."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=radio, radius2=radio * punta, depth=largo)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).z) > largo * 0.5], cuts=cortes)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=bm.verts)
    P._chuequear(bm, chueco, semilla)
    o = P.objeto(nombre, bm, material)
    P.poner_veta(o, 'X', azar=semilla % 1.0)
    if bisel:
        P.biselar(o, min(bisel, radio * 0.4))
    if M is not None:
        transformar(o, M)
    return o


def cono(nombre, r1, r2, alto, material, M=None, lados=8, bisel=0.008, giro=0.0, chueco=0.0, semilla=None):
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=r1, radius2=r2, depth=alto)
    bmesh.ops.translate(bm, vec=(0, 0, alto / 2), verts=bm.verts)
    if giro:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(giro, 3, 'Z'), verts=bm.verts)
    if chueco:
        P._chuequear(bm, chueco, semilla)
    o = P.objeto(nombre, bm, material)
    P.poner_veta(o, 'Z', azar=semilla % 1.0)
    if bisel:
        P.biselar(o, bisel)
    if M is not None:
        transformar(o, M)
    return o


def poste(nombre, alto, radio, material, centro=(0, 0, 0), rot=(0, 0, 0), lados=8, punta=1.0, chueco=0.01, bisel=0.016, cortes=1, semilla=None):
    """P.poste con los cortes a lo alto como parámetro: P.poste parte en 4 tramos y con el bisel de
    las 8 aristas un poste cuesta 364 triángulos; en uno corto 2 tramos bastan (~200)."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=radio, radius2=radio * punta, depth=alto)
    bmesh.ops.translate(bm, vec=(0, 0, alto / 2), verts=bm.verts)
    if cortes:
        bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).z) > alto * 0.5], cuts=cortes)
    P._chuequear(bm, chueco, semilla)
    o = P.objeto(nombre, bm, material)
    P.poner_veta(o, 'Z', azar=semilla % 1.0)
    if bisel:
        P.biselar(o, min(bisel, radio * 0.4))
    P._colocar(o, centro, rot)
    return o


def bloque(nombre, tam, material, centro=(0, 0, 0), rot=(0, 0, 0), bisel=0.012, chueco=0.003, segmentos=2, semilla=None):
    """Una caja sin subdividir (P.caja parte cada lado largo en tres): para piezas chicas o de metal,
    donde el chueco a mano no se ve y los triángulos sí cuentan."""
    semilla = random.random() * 100 if semilla is None else semilla
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=tam, verts=bm.verts)
    P._chuequear(bm, chueco, semilla)
    o = P.objeto(nombre, bm, material)
    P.poner_veta(o, 'XYZ'[list(tam).index(max(tam))], azar=semilla % 1.0)
    if bisel:
        P.biselar(o, min(bisel, min(tam) * 0.45), segmentos)
    P._colocar(o, centro, rot)
    return o


def bolita(nombre, radio, material, M, aplasta=(1, 1, 1), u=6, v=4):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=radio)
    for p in bm.verts:
        p.co = Vector((p.co.x * aplasta[0], p.co.y * aplasta[1], p.co.z * aplasta[2]))
    o = P.objeto(nombre, bm, material)
    transformar(o, M)
    return o


def roca(nombre, tam, material, semilla, centro=(0, 0, 0), giro=0.0, lados=6,
         perfil=((0.0, 0.84), (0.42, 1.0), (0.86, 0.74)), cima=1.06, bisel=0.026):
    """Una roca low poly facetada: el casco convexo de unos anillos de pocos puntos al azar, las
    caras casi planas fundidas en facetas grandes, la base plana en z = 0, un chaflán en cada
    arista y todo plano (aristas duras): facetas talladas, como las rocas de la referencia."""
    rnd = random.Random(semilla)
    ax, ay, az = tam
    inc = (rnd.uniform(-0.18, 0.18), rnd.uniform(-0.18, 0.18))
    bm = bmesh.new()
    vs = []
    for h, r in perfil:
        n = lados + rnd.randint(0, 1)
        off = rnd.uniform(0, 2 * math.pi)
        for k in range(n):
            a = off + 2 * math.pi * k / n + rnd.uniform(-0.3, 0.3)
            rr = r * rnd.uniform(0.8, 1.08)
            x = math.cos(a) * rr * ax / 2
            y = math.sin(a) * rr * ay / 2
            z = 0.0 if h == 0 else h * az * rnd.uniform(0.85, 1.08) + (inc[0] * x + inc[1] * y) * h
            vs.append(bm.verts.new((x, y, z)))
    for _ in range(2):
        vs.append(bm.verts.new((rnd.uniform(-0.2, 0.2) * ax, rnd.uniform(-0.2, 0.2) * ay, az * cima * rnd.uniform(0.94, 1.0))))
    res = bmesh.ops.convex_hull(bm, input=vs)
    sobra = list({g for g in res['geom_interior'] + res['geom_unused'] if isinstance(g, bmesh.types.BMVert)})
    if sobra:
        bmesh.ops.delete(bm, geom=sobra, context='VERTS')
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(7), verts=list(bm.verts), edges=list(bm.edges))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    P.biselar(o, bisel, 1, angulo=6)
    facetar(o)
    P._colocar(o, centro, (0, 0, giro))
    return o


def facetar(o, angulo=12):
    """Todo plano: quita las normales a mano del bisel y marca duras las aristas de más de `angulo`
    (shade_smooth_by_angle de P.unir conserva las aristas duras)."""
    me = o.data
    cn = me.attributes.get('custom_normal')
    if cn:
        me.attributes.remove(cn)
    elif me.has_custom_normals:
        bpy.context.view_layer.objects.active = o
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bm = bmesh.new()
    bm.from_mesh(me)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(angulo))
    bm.to_mesh(me)
    bm.free()


def cortar_piso(o):
    """Corta lo que queda bajo el piso (z < 0) y tapa el hueco: la punta de una raíz se mete en la
    tierra sin asomarse por debajo."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=1e-5,
                           plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
    orilla = [e for e in bm.edges if e.is_boundary]
    if orilla:
        bmesh.ops.holes_fill(bm, edges=orilla, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()


def atributo(o, nombre, valores):
    """Un atributo de color por vértice (x, y, z) que leen los materiales."""
    me = o.data
    rgba = np.concatenate([np.asarray(valores, np.float32), np.ones((len(valores), 1), np.float32)], 1)
    at = me.color_attributes.get(nombre) or me.color_attributes.new(nombre, 'FLOAT_COLOR', 'POINT')
    at.data.foreach_set('color', rgba.ravel())


def coords(o):
    co = np.empty(len(o.data.vertices) * 3, np.float32)
    o.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def poner_anillo(o, radio, eje='Z', azar=0.3):
    """El atributo `Anillo` (para material_anillos): la posición local perpendicular al eje de la
    pieza, dividida entre su radio; el material saca de ahí la distancia al centro de los anillos."""
    co = coords(o)
    a = {'X': 0, 'Y': 1, 'Z': 2}[eje]
    u, v = [i for i in range(3) if i != a]
    atributo(o, 'Anillo', np.stack([co[:, u] / radio, co[:, v] / radio, np.full(len(co), azar)], 1))


# ---------------------------------------------------------------- ayudantes de material

def antes_del_grano(mat, capa):
    """Mete una capa de pintura (capa(N, col, pos, geo, nz) -> col) en un material de pintura.py
    justo antes del grano del papel, que así le queda encima."""
    nt = mat.node_tree
    comb = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeCombineColor')
    mix = comb.outputs[0].links[0].to_node
    a = [s for s in mix.inputs if s.type == 'RGBA'][0]
    entrada = a.links[0].from_socket
    N = P.Nodos.__new__(P.Nodos)
    N.nt = nt
    N.x = 6000
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(geo.outputs['True Normal'], sn.inputs[0])
    N.l(capa(N, entrada, tc.outputs['Object'], geo, sn.outputs['Z']), a)


def musgo_encima(mat, umbral=0.99, arriba=0.45, suelo=0.1, colores=MUSGO):
    """Musgo en manchas sobre lo que mira arriba y en lenguas que suben desde el piso, con el
    pigmento juntado en su orilla y puntitos más claros encima."""
    def capa(N, col, pos, geo, nz):
        sz = N.n('ShaderNodeSeparateXYZ')
        N.l(pos, sz.inputs[0])
        manchas = N.ruido(pos, 2.4, detalle=3.0, rugosidad=0.6, distorsion=1.4)
        lenguas = N.ruido(pos, 5.0, detalle=2.0, distorsion=1.2)
        piso = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, sz.outputs['Z'], 0.0, suelo)), N.val('MULTIPLY', lenguas, 0.9))
        campo = N.val('ADD', N.val('MULTIPLY', manchas, 0.9), N.val('MULTIPLY', P.suave(N, nz, 0.2, 0.9), arriba))
        campo = N.val('ADD', campo, piso)
        col = P.lavado(N, col, campo, umbral, 0.04, colores[0], 0.85, borde=0.5)
        fino = N.val('ADD', campo, N.val('MULTIPLY', N.ruido(pos, 16.0, detalle=2.0), 0.3))
        fino = N.val('ADD', fino, N.val('MULTIPLY', P.suave(N, nz, 0.3, 0.9), 0.1))
        return P.lavado(N, col, fino, umbral + 0.24, 0.04, colores[1], 0.5, borde=0.0)
    antes_del_grano(mat, capa)


def corteza_surcos(mat, color=CORTEZA['linea'], cresta=CORTEZA['luz']):
    """Surcos de corteza a lo largo de la veta (atributo `Veta`): rayas oscuras chuecas y la cresta
    entre ellas más clara, para que un tronco no se lea como madera cepillada."""
    def capa(N, col, pos, geo, nz):
        at = N.n('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='Veta')
        ola = N.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='X', wave_profile='SIN')
        ola.inputs['Scale'].default_value = 6.5
        ola.inputs['Distortion'].default_value = 7.0
        ola.inputs['Detail'].default_value = 2.0
        N.l(N.escalar(at.outputs['Vector'], (1.0, 0.22, 3.0)), ola.inputs['Vector'])
        varia = P.suave(N, N.ruido(N.escalar(at.outputs['Vector'], (3.0, 0.8, 3.0)), 1.0, detalle=1.0), 0.25, 0.65)
        surco = N.val('SUBTRACT', 1.0, P.suave(N, ola.outputs['Fac'], 0.08, 0.3))
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', surco, varia), 0.85), col, color)
        alto = P.suave(N, ola.outputs['Fac'], 0.82, 0.97)
        return N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', alto, varia), 0.3), col, cresta)
    antes_del_grano(mat, capa)


def material_piedra_musgo(nombre, alto=0.08, musgo=0.85, paleta=ROCA):
    """Piedra facetada en acuarela, a partir de material_piedra de pintura.py: cada faceta con su
    tono (el ruido de su normal, que es constante en una cara plana), lavados cálidos y fríos, la
    cara de arriba más clara, grietas finas con su halo claro, la orilla clara en los chaflanes y
    musgo en lenguas que suben desde abajo hasta unos `alto` metros (el de la librería sube unos
    23 cm y tapaba entera una piedra plana de vado), con su orilla oscura y la punta más clara."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    faceta = N.ruido(geo.outputs['True Normal'], 3.2, detalle=1.0)
    col = N.rampa(faceta, [(0.3, paleta['oscura']), (0.5, paleta['base']), (0.72, paleta['clara'])])
    col = N.mezcla(0.25, col, paleta['base'])
    campo = N.ruido(pos, 3.0, detalle=3.0, rugosidad=0.6, distorsion=1.2)
    col = P.lavado(N, col, campo, 0.4, 0.16, paleta['oscura'], 0.25, borde=0.08, invertido=True)
    col = P.lavado(N, col, campo, 0.6, 0.16, paleta['clara'], 0.22, borde=0.05)
    tinte = N.ruido(pos, 1.5, detalle=1.0, distorsion=1.0)
    col = P.lavado(N, col, tinte, 0.58, 0.14, '#9d8e74', 0.28, borde=0.0)
    col = P.lavado(N, col, tinte, 0.42, 0.14, '#77839a', 0.28, borde=0.0, invertido=True)
    trazos = N.ruido(N.escalar(pos, (14.0, 14.0, 4.0)), 1.0, detalle=2.0, distorsion=1.0)
    col = P.lavado(N, col, trazos, 0.36, 0.05, paleta['oscura'], 0.18, borde=0.15, invertido=True)
    col = N.mezcla(N.val('MULTIPLY', P.suave(N, nz, 0.35, 0.8), 0.3), col, paleta['clara'])
    borde_v = N.n('ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE')
    borde_v.inputs['Scale'].default_value = 3.2
    N.l(P.deformado(N, pos, 3.0, 0.18), borde_v.inputs['Vector'])
    mascara = P.suave(N, N.ruido(pos, 1.8, detalle=1.0), 0.48, 0.58)
    d = N.val('ADD', borde_v.outputs['Distance'], N.val('SUBTRACT', 1.0, mascara))
    col = P.lavado(N, col, d, 0.026, 0.008, paleta['orilla'], 0.32, borde=0.0, invertido=True)
    col = P.lavado(N, col, d, 0.01, 0.005, '#34312d', 0.85, borde=0.3, invertido=True)
    b = P.suave(N, P.orilla_bisel(N, geo, 0.03, 16), 0.012, 0.05)
    seco = P.suave(N, N.ruido(pos, 14.0, detalle=2.0), 0.3, 0.7)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', b, seco), 0.55), col, paleta['orilla'])
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.1
    col = P.lavado(N, col, ao.outputs['AO'], 0.6, 0.08, paleta['mugre'], 0.55, borde=0.25, invertido=True)
    sz = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sz.inputs[0])
    n1 = N.ruido(pos, 3.2, detalle=3.0, rugosidad=0.6, distorsion=1.6)
    n2 = N.ruido(pos, 13.0, detalle=2.0)
    sube = N.val('ADD', N.val('MULTIPLY', sz.outputs['Z'], 0.25 / alto), N.val('MULTIPLY', N.val('SUBTRACT', n1, 0.5), 0.9))
    sube = N.val('ADD', sube, N.val('MULTIPLY', N.val('SUBTRACT', n2, 0.5), 0.2))
    col = P.lavado(N, col, sube, 0.25, 0.025, paleta['musgo'], musgo, borde=0.5, invertido=True)
    claro = N.val('SUBTRACT', sube, N.val('MULTIPLY', P.suave(N, nz, -0.2, 0.7), 0.08))
    col = P.lavado(N, col, claro, 0.12, 0.03, '#7f9f42', 0.6, borde=0.0, invertido=True)
    col = P.grano(N, col, pos, 0.12)
    P._salida(N, col)
    return m


def material_anillos(nombre, paleta=P.MADERA_CLARA, anillos=2.5, grieta=0.6):
    """La cara cortada de un tronco: anillos chuecos en acuarela alrededor del centro que da el
    atributo `Anillo` (poner_anillo), la médula oscura, una grieta que sale del centro, la albura
    oscura junto a la corteza, la orilla clara y la suciedad en lo hondo."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    at = N.n('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='Anillo')
    sa = N.n('ShaderNodeSeparateXYZ')
    N.l(at.outputs['Vector'], sa.inputs[0])
    plano = N.n('ShaderNodeCombineXYZ')
    N.l(sa.outputs['X'], plano.inputs[0])
    N.l(sa.outputs['Y'], plano.inputs[1])
    largo = N.n('ShaderNodeVectorMath', operation='LENGTH')
    N.l(plano.outputs[0], largo.inputs[0])
    r = largo.outputs['Value']
    col = N.rampa(r, [(0.0, paleta['luz']), (0.5, paleta['clara']), (0.84, paleta['base']), (0.95, paleta['media'])])
    grande = N.ruido(pos, 3.0, detalle=3.0, rugosidad=0.6, distorsion=1.6)
    col = P.lavado(N, col, grande, 0.56, 0.08, paleta['clara'], 0.4, borde=0.3)
    col = P.lavado(N, col, grande, 0.42, 0.07, paleta['media'], 0.35, borde=0.3, invertido=True)
    ola = N.n('ShaderNodeTexWave', wave_type='RINGS', rings_direction='SPHERICAL', wave_profile='SIN')
    ola.inputs['Scale'].default_value = anillos
    ola.inputs['Distortion'].default_value = 3.0
    ola.inputs['Detail'].default_value = 1.5
    N.l(plano.outputs[0], ola.inputs['Vector'])
    col = P.lavado(N, col, ola.outputs['Fac'], 0.32, 0.12, paleta['base'], 0.4, borde=0.0, invertido=True)
    linea = N.val('SUBTRACT', 1.0, P.suave(N, ola.outputs['Fac'], 0.03, 0.14))
    varia = P.suave(N, N.ruido(pos, 6.0, detalle=1.0), 0.25, 0.7)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', linea, varia), 0.7), col, paleta['linea'])
    col = P.lavado(N, col, r, 0.05, 0.02, paleta['linea'], 0.8, borde=0.4, invertido=True)
    ang = N.val('ARCTAN2', sa.outputs['Y'], sa.outputs['X'])
    arco = N.val('MULTIPLY', N.val('ABSOLUTE', N.val('SUBTRACT', ang, grieta)), r)
    g = N.val('SUBTRACT', arco, N.val('ADD', 0.006, N.val('MULTIPLY', r, 0.035)))
    g = N.val('ADD', g, N.val('SUBTRACT', 1.0, P.suave(N, r, 0.12, 0.22)))
    col = P.lavado(N, col, g, 0.014, 0.008, paleta['orilla'], 0.55, borde=0.0, invertido=True)
    col = P.lavado(N, col, g, 0.0, 0.006, paleta['astilla'], 0.85, borde=0.4, invertido=True)
    col = P.lavado(N, col, r, 0.9, 0.03, paleta['oscura'], 0.65, borde=0.3)
    col = N.mezcla(N.val('MULTIPLY', P.suave(N, nz, 0.4, 0.8), 0.22), col, paleta['luz'])
    fina = P.suave(N, P.orilla_bisel(N, geo, 0.012), 0.01, 0.04)
    seco = P.suave(N, N.ruido(pos, 30.0, detalle=2.0), 0.35, 0.65)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', fina, seco), 0.8), col, paleta['orilla'])
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.06
    col = P.lavado(N, col, ao.outputs['AO'], 0.6, 0.08, paleta['mugre'], 0.5, borde=0.2, invertido=True)
    col = P.grano(N, col, pos, 0.12)
    P._salida(N, col)
    return m


def materiales():
    MAT['madera'] = P.material_madera('Senderos_Madera')
    MAT['fina'] = P.material_madera('Senderos_MaderaFina', fino=0.4)
    MAT['clara'] = P.material_madera('Senderos_MaderaClara', paleta=P.MADERA_CLARA, fino=0.6)
    MAT['corteza'] = P.material_madera('Senderos_Corteza', paleta=CORTEZA, fino=0.6)
    MAT['musgosa'] = P.material_madera('Senderos_CortezaMusgo', paleta=CORTEZA, fino=0.8)
    musgo_encima(MAT['musgosa'])
    MAT['tocon'] = P.material_madera('Senderos_CortezaTocon', paleta=CORTEZA, fino=0.8)
    musgo_encima(MAT['tocon'], umbral=1.12, suelo=0.04)
    for k in ('corteza', 'musgosa', 'tocon'):
        corteza_surcos(MAT[k])
    MAT['anillos'] = material_anillos('Senderos_Anillos')
    for c in ('crema', 'rojo', 'turquesa'):
        MAT[c] = P.material_madera(f'Senderos_Flecha_{c}', pintura=P.PINTURAS[c], desgaste=0.85)
    MAT['metal'] = P.material_metal('Senderos_Metal')
    MAT['piedra'] = material_piedra_musgo('Senderos_Piedra', alto=0.09)
    MAT['vidrio'] = P.material_brillo('Senderos_Vidrio', VIDRIO)


# ---------------------------------------------------------------- props
# Cada constructor arma su prop centrado en el origen (base en z = 0) y devuelve
# {piezas, hijos: [(objeto, marco)], calcas: [(material, x, z, ancho)]} (calcas con estencil_skulley; hoy ninguna).

def letrero():
    piezas, hijos = [], []
    alto, r = 2.2, 0.078
    giro = Euler((0.025, -0.018, 0.0))
    R = giro.to_matrix().to_4x4()
    piezas.append(P.poste('let_poste', alto, r, MAT['madera'], rot=giro, lados=8, punta=0.86, chueco=0.012, bisel=0.016))
    piezas.append(cono('let_tapa', r * 0.86 + 0.022, 0.012, 0.085, MAT['metal'], M=R @ Matrix.Translation((0, 0, alto - 0.01)), giro=math.pi / 8))
    # (nombre, pintura, altura, hacia dónde apunta (grados), largo, alto, ladeo de la punta (grados), cola)
    flechas = [
        ('Flecha1', 'crema', 1.9, 20, 1.0, 0.25, 5, False),
        ('Flecha2', 'rojo', 1.5, 158, 0.9, 0.24, -7, True),
        ('Flecha3', 'turquesa', 1.1, -56, 0.94, 0.25, 3, False),
    ]
    g, sobra = 0.062, 0.12
    for k, (nom, color, z, yaw, largo, alto_f, ladeo, cola) in enumerate(flechas):
        rz = r * (1 - 0.14 * z / alto) * 0.93
        F = Matrix.Translation(R @ Vector((0, 0, z))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
        M = F @ Matrix.Translation((0, -(rz + g / 2), 0)) @ Matrix.Rotation(math.radians(-ladeo), 4, 'Y') @ Matrix.Translation((largo / 2 - sobra, 0, 0))
        f = flecha(f'Prop_LetreroCruce_{nom}', largo, alto_f, g, MAT[color], cola=cola, semilla=SEMILLA + k)
        transformar(f, M)
        hijos.append((f, M))
        for dz in (-0.055, 0.055):
            piezas.append(bolita(f'let_clavo_{k}_{dz}', 0.017, MAT['metal'], M @ Matrix.Translation((-(largo / 2 - sobra), -g / 2 - 0.002, dz)), aplasta=(1, 0.45, 1)))
    rocas = [(0.35, 0.2, (0.36, 0.3, 0.22)), (1.55, 0.22, (0.3, 0.26, 0.17)), (2.75, 0.19, (0.38, 0.31, 0.25)),
             (3.95, 0.22, (0.28, 0.25, 0.15)), (5.15, 0.2, (0.33, 0.28, 0.2))]
    for k, (a, d, tam) in enumerate(rocas):
        piezas.append(roca(f'let_roca_{k}', tam, MAT['piedra'], SEMILLA * 10 + k, centro=(math.cos(a) * d, math.sin(a) * d, 0), giro=a,
                           lados=5, perfil=((0.0, 0.8), (0.45, 1.0), (0.85, 0.72)), cima=1.0, bisel=0.02))
    return {'piezas': piezas, 'hijos': hijos, 'calcas': []}


def flecha(nombre, largo, alto, grueso, material, cola=False, punta=0.2, semilla=0):
    """Una tabla en flecha en su marco: +X hacia la punta, la cara de enfrente hacia -Y, centrada.
    Lleva el UV `Runas` (0 a 1 de la cola a la punta y de abajo arriba; al revés en la cara de atrás)."""
    rnd = random.Random(semilla)
    x0, x1, h = -largo / 2, largo / 2, alto / 2
    xs = [x0 + (x1 - punta - x0) * k / 3 for k in range(4)]
    contorno = [(x, -h) for x in xs] + [(x1, 0.0)] + [(x, h) for x in reversed(xs)]
    if cola:
        contorno.append((x0 + 0.08, 0.0))
    contorno = [(x + rnd.uniform(-0.007, 0.007), z + rnd.uniform(-0.007, 0.007)) for x, z in contorno]
    bm = bmesh.new()
    frente = [bm.verts.new((x, -grueso / 2, z)) for x, z in contorno]
    atras = [bm.verts.new((x, grueso / 2 + rnd.uniform(-0.003, 0.003), z)) for x, z in contorno]
    bm.faces.new(frente)
    bm.faces.new(list(reversed(atras)))
    n = len(contorno)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((frente[i], frente[j], atras[j], atras[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    P.poner_veta(o, 'X', azar=rnd.random())
    P.biselar(o, 0.016)
    me = o.data
    me.uv_layers.new(name='UVMap')
    runas = me.uv_layers.new(name='Runas')
    uv = np.zeros((len(me.loops), 2), np.float32)
    for p in me.polygons:
        atras_cara = p.normal.y > 0.3
        for li in p.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            u = (c.x - x0) / largo
            uv[li] = (1 - u if atras_cara else u, (c.z + h) / alto)
    runas.data.foreach_set('uv', uv.ravel())
    me.uv_layers.active = me.uv_layers['UVMap']
    me.uv_layers['UVMap'].active_render = True
    suavizar(o)
    return o


def banca():
    piezas = []
    L = 1.6
    for x in (-0.62, 0.62):
        piezas.append(poste('ban_pata', 0.37, 0.068, MAT['corteza'], centro=(x, -0.16, 0), rot=(0.05, x * 0.05, 0), lados=8, chueco=0.01, bisel=0.016))
        piezas.append(poste('ban_trasera', 1.0, 0.07, MAT['corteza'], centro=(x, 0.15, 0), rot=(-0.13, x * 0.03, 0), lados=8, punta=0.9, chueco=0.01, bisel=0.016))
        piezas.append(bloque('ban_travesano', (0.1, 0.56, 0.075), MAT['madera'], centro=(x, 0.0, 0.405), rot=(0, 0, x * 0.02), bisel=0.016))
    for k, y in enumerate((-0.165, 0.0, 0.165)):
        piezas.append(P.tabla(f'ban_asiento_{k}', L + random.uniform(-0.03, 0.03), 0.155, 0.065, MAT['madera'],
                              centro=(random.uniform(-0.02, 0.02), y, 0.475), rot=(random.uniform(-0.02, 0.02), 0, random.uniform(-0.015, 0.015)), bisel=0.015, divisiones=3))
    inclina = 0.13
    for k, (z, ancho) in enumerate(((0.63, 0.13), (0.83, 0.19))):
        y = 0.15 + z * math.tan(inclina) - 0.07 - 0.028
        piezas.append(P.tabla(f'ban_respaldo_{k}', L + 0.06, ancho, 0.055, MAT['madera'], centro=(0, y, z),
                              rot=(math.pi / 2 - inclina, 0, random.uniform(-0.02, 0.02)), bisel=0.015, divisiones=3))
    return {'piezas': piezas, 'hijos': [], 'calcas': []}


def barandal():
    piezas = []
    for k, (x, y) in enumerate(((-1.0, -0.105), (1.0, 0.105))):
        piezas.append(poste(f'bar_poste_{k}', 1.12, 0.068, MAT['corteza'], centro=(x, y, 0), rot=(random.uniform(-0.03, 0.03), random.uniform(-0.03, 0.03), 0),
                              lados=8, punta=0.9, chueco=0.012, bisel=0.016))
    for k, (z, comba, lado) in enumerate(((0.5, -0.035, 0.012), (0.95, 0.025, -0.014))):
        p = palo(f'bar_travesano_{k}', 2.0, 0.046, MAT['fina'], M=Matrix.Translation((0, 0, z)), cortes=8, punta=0.88, chueco=0.008, bisel=0.012)
        for v in p.data.vertices:
            s = math.sin(math.pi * (min(max(v.co.x, -1.0), 1.0) + 1) / 2)
            v.co.z += comba * s
            v.co.y += lado * s
        piezas.append(p)
    return {'piezas': piezas, 'hijos': [], 'calcas': []}


def farol():
    piezas, hijos = [], []
    alto_poste = 1.66
    piezas.append(bloque('far_pie', (0.28, 0.28, 0.13), MAT['madera'], centro=(0, 0, 0.065), rot=(0, 0, 0.12), bisel=0.02))
    piezas.append(poste('far_poste', alto_poste, 0.082, MAT['madera'], lados=8, punta=0.86, chueco=0.008, bisel=0.016, cortes=2))
    piezas.append(cono('far_collar', 0.098, 0.098, 0.07, MAT['metal'], M=Matrix.Translation((0, 0, alto_poste - 0.07)), lados=8, giro=math.pi / 8))
    z0 = alto_poste
    piezas.append(bloque('far_base', (0.34, 0.34, 0.045), MAT['metal'], centro=(0, 0, z0 + 0.0225), bisel=0.012))
    vz0 = z0 + 0.045
    alto_v = 0.29
    for sx in (-1, 1):
        for sy in (-1, 1):
            piezas.append(bloque('far_barra', (0.036, 0.036, alto_v), MAT['metal'], centro=(sx * 0.132, sy * 0.132, vz0 + alto_v / 2), bisel=0.008, segmentos=1))
    piezas.append(bloque('far_tapa', (0.33, 0.33, 0.035), MAT['metal'], centro=(0, 0, vz0 + alto_v + 0.0175), bisel=0.01))
    tz = vz0 + alto_v + 0.035
    piezas.append(cono('far_techo', 0.29, 0.03, 0.13, MAT['metal'], M=Matrix.Translation((0, 0, tz - 0.005)), lados=4, giro=math.pi / 4, bisel=0.012))
    piezas.append(bolita('far_perilla', 0.034, MAT['metal'], Matrix.Translation((0, 0, tz + 0.15)), aplasta=(1, 1, 0.85), u=8, v=5))
    vidrio = bloque('Prop_Farol_Vidrio', (0.25, 0.25, alto_v), MAT['vidrio'], centro=(0, 0, vz0 + alto_v / 2), chueco=0.002, bisel=0.01)
    suavizar(vidrio)
    # la cabeza un poco ladeada sobre el poste: nada derecho
    cabeza = Matrix.Translation((0, 0, z0)) @ Matrix.Rotation(0.035, 4, 'X') @ Matrix.Rotation(-0.028, 4, 'Y') @ Matrix.Rotation(0.06, 4, 'Z') @ Matrix.Translation((0, 0, -z0))
    for o in piezas[3:] + [vidrio]:
        transformar(o, cabeza)
    hijos.append((vidrio, cabeza @ Matrix.Translation((0, 0, vz0 + alto_v / 2))))
    return {'piezas': piezas, 'hijos': hijos, 'calcas': []}


PUENTE_LARGO, PUENTE_ANCHO, PUENTE_SUBE = 3.6, 3.2, 0.26


def arco_puente(x):
    m = PUENTE_LARGO / 2 + 0.12
    return PUENTE_SUBE * max(0.0, 1 - (x / m) ** 2)


def pendiente_puente(x):
    m = PUENTE_LARGO / 2 + 0.12
    return -2 * PUENTE_SUBE * x / (m * m)


def puente():
    """Lo que cruza va en X (3.6 m) y el ancho del sendero en Y (3.2 m): tres largueros gruesos
    arqueados, tablas transversales encima y barandales a los lados con postes gordos, pasamanos,
    travesaño y una diagonal en cada tramo para que se vea robusto."""
    piezas = []
    alto_l = 0.26
    for k, (y, ancho) in enumerate(((-1.38, 0.17), (0.0, 0.15), (1.38, 0.17))):
        lg = P.tabla(f'pue_larguero_{k}', PUENTE_LARGO + 0.26, ancho, alto_l, MAT['madera'], centro=(0, y, alto_l / 2), divisiones=8, chueco=0.012, bisel=0.024)
        doblar(lg, arco_puente)
        piezas.append(lg)
    n = 14
    grueso = 0.09
    for i in range(n):
        x = -PUENTE_LARGO / 2 + 0.13 + (PUENTE_LARGO - 0.26) * i / (n - 1) + random.uniform(-0.012, 0.012)
        s = pendiente_puente(x)
        t = Vector((1, 0, s)).normalized()
        rot = a_euler(Vector((0, 1, 0)), -t, Vector((-s, 0, 1)).normalized())
        z = arco_puente(x) + alto_l + grueso / 2
        largo = PUENTE_ANCHO + random.uniform(-0.05, 0.08)
        tb = P.tabla(f'pue_tabla_{i}', largo, 0.235, grueso, MAT['madera'], centro=(x, random.uniform(-0.04, 0.04), z),
                     rot=rot, divisiones=2, chueco=0.012, bisel=0.022)
        piezas.append(tb)

    def cubierta(x):
        return arco_puente(x) + alto_l + grueso

    alto_b = 0.92
    for lado in (-1, 1):
        y = lado * 1.56
        for k, x in enumerate((-1.62, 0.0, 1.62)):
            zb = arco_puente(x) - 0.02
            zt = cubierta(x) + alto_b + 0.07
            piezas.append(poste(f'pue_poste_{lado}_{k}', zt - zb, 0.1, MAT['madera'], centro=(x, y, zb), rot=(lado * 0.025, random.uniform(-0.02, 0.02), 0),
                                lados=8, punta=0.9, chueco=0.01, bisel=0.02))
        for k, (dz, radio) in enumerate(((alto_b, 0.068), (alto_b * 0.45, 0.052))):
            p = palo(f'pue_pasamanos_{lado}_{k}', 3.56, radio, MAT['fina'], M=Matrix.Translation((0, y - lado * 0.012, 0)), cortes=8, chueco=0.01, bisel=0.014)
            doblar(p, lambda x, dz=dz: cubierta(x) + dz - 0.018 * abs(math.sin(math.pi * x / 1.62)))
            piezas.append(p)
        for k, (xa, xb) in enumerate(((-1.52, -0.1), (1.52, 0.1))):
            a = Vector((xa, y - lado * 0.03, cubierta(xa) + 0.08))
            b = Vector((xb, y - lado * 0.03, cubierta(xb) + alto_b - 0.07))
            d = (b - a).normalized()
            ejes = Matrix((d, Vector((0, 1, 0)), d.cross(Vector((0, 1, 0))))).transposed().to_4x4()
            piezas.append(palo(f'pue_diagonal_{lado}_{k}', (b - a).length, 0.048, MAT['fina'], M=Matrix.Translation((a + b) / 2) @ ejes,
                               cortes=2, chueco=0.008, bisel=0.012))
    return {'piezas': piezas, 'hijos': [], 'calcas': []}


def vado():
    piezas = []
    plan = [(-0.95, 0.04, (0.66, 0.56, 0.19), 0.3), (-0.3, -0.07, (0.6, 0.52, 0.17), -0.4),
            (0.33, 0.06, (0.64, 0.5, 0.18), 0.9), (0.94, -0.03, (0.58, 0.5, 0.16), 2.0)]
    for k, (x, y, tam, giro) in enumerate(plan):
        piezas.append(roca(f'vad_{k}', tam, MAT['piedra'], SEMILLA * 30 + k, centro=(x, y, 0), giro=giro,
                           lados=6, perfil=((0.0, 0.86), (0.4, 1.0), (0.8, 0.84), (1.0, 0.5)), cima=1.05, bisel=0.024))
    return {'piezas': piezas, 'hijos': [], 'calcas': []}


def piedra_vado(k):
    tam = [(0.9, 0.72, 0.23), (0.74, 0.6, 0.2), (0.6, 0.5, 0.18)][k]
    o = roca(f'pv_{k}', tam, MAT['piedra'], SEMILLA * 20 + k, giro=0.3 * k, lados=6 + (k % 2),
             perfil=((0.0, 0.86), (0.4, 1.0), (0.8, 0.84), (1.0, 0.5)), cima=1.05, bisel=0.028)
    return {'piezas': [o], 'hijos': [], 'calcas': []}


def tocon():
    piezas = []
    lados = 14
    filas = [(0.0, 0.37), (0.06, 0.345), (0.16, 0.322), (0.32, 0.308), (0.5, 0.3)]
    bm = bmesh.new()
    anillos = []
    for z, r in filas:
        anillo = []
        for k in range(lados):
            a = 2 * math.pi * k / lados
            zz = z + (0.03 * math.cos(a - 1.0) if z == filas[-1][0] else 0.0)
            anillo.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, zz)))
        anillos.append(anillo)
    for f in range(len(filas) - 1):
        for k in range(lados):
            j = (k + 1) % lados
            bm.faces.new((anillos[f][k], anillos[f][j], anillos[f + 1][j], anillos[f + 1][k]))
    bm.faces.new(list(reversed(anillos[0])))
    arriba = bm.faces.new(anillos[-1])
    arriba.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    P._chuequear(bm, 0.014, 4.2)
    cuerpo = P.objeto('toc_cuerpo', bm, MAT['tocon'])
    cuerpo.data.materials.append(MAT['anillos'])
    P.poner_veta(cuerpo, 'Z', azar=0.37)
    P.biselar(cuerpo, 0.022)
    poner_anillo(cuerpo, 0.3, 'Z')
    piezas.append(cuerpo)
    # la astilla que queda de pie cuando el árbol cae
    bm = bmesh.new()
    base = [(-0.08, -0.03), (0.08, -0.03), (0.07, 0.03), (-0.07, 0.03)]
    abajo = [bm.verts.new((x, y, 0)) for x, y in base]
    cima = [bm.verts.new((x * 0.3 + 0.02, y * 0.6 - 0.01, 0.15 + (0.025 if x > 0 else 0))) for x, y in base]
    bm.faces.new(list(reversed(abajo)))
    bm.faces.new(cima)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((abajo[i], abajo[j], cima[j], cima[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ast = P.objeto('toc_astilla', bm, MAT['clara'])
    P.poner_veta(ast, 'Z', azar=0.71)
    P.biselar(ast, 0.008)
    a = 2.5
    zt = 0.5 + 0.03 * math.cos(a - 1.0) - 0.02
    transformar(ast, Matrix.Translation((math.cos(a) * 0.255, math.sin(a) * 0.255, zt)) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z') @ Matrix.Rotation(0.12, 4, 'X'))
    piezas.append(ast)
    # raíces aplanadas que nacen del ensanche, bajan pronto y se hunden en la tierra (sin punta al aire)
    for k, (a, largo, grueso, tuerce) in enumerate(((0.3, 0.72, 0.15, 0.06), (1.55, 0.62, 0.13, -0.08), (2.75, 0.78, 0.16, 0.05),
                                                   (3.95, 0.6, 0.125, -0.06), (5.1, 0.68, 0.14, 0.08))):
        rr = palo(f'toc_raiz_{k}', largo, grueso, MAT['tocon'], lados=11, cortes=5, punta=0.3, chueco=0.014, bisel=0, semilla=SEMILLA + k * 3.1)
        z0, zf = 0.18, -0.06
        for v in rr.data.vertices:
            t = min(max(v.co.x / largo + 0.5, 0.0), 1.0)
            v.co.z = v.co.z * 0.8 + zf + (z0 - zf) * (1 - t) ** 1.8
            v.co.y = v.co.y * 1.1 + tuerce * math.sin(math.pi * t) * largo
        transformar(rr, Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((0.08 + largo / 2, 0, 0)))
        cortar_piso(rr)
        piezas.append(rr)
    return {'piezas': piezas, 'hijos': [], 'calcas': []}


def tronco():
    piezas = []
    lados, n = 14, 11
    largo = 3.0
    xs = [-largo / 2 + largo * i / (n - 1) for i in range(n)]

    def radio(x):
        return 0.225 * (1.07 - 0.12 * (x + largo / 2) / largo + 0.035 * math.sin(x * 2.3 + 1.0))

    def yc(x):
        return 0.06 * math.sin(math.pi * x / largo)

    bm = bmesh.new()
    anillos = []
    for x in xs:
        rr = radio(x)
        anillos.append([bm.verts.new((x, yc(x) + math.cos(2 * math.pi * k / lados) * rr, rr + math.sin(2 * math.pi * k / lados) * rr)) for k in range(lados)])
    for f in range(n - 1):
        for k in range(lados):
            j = (k + 1) % lados
            bm.faces.new((anillos[f][k], anillos[f][j], anillos[f + 1][j], anillos[f + 1][k]))
    corte = bm.faces.new(list(reversed(anillos[0])))
    corte.material_index = 1
    roto = bm.faces.new(anillos[-1])
    roto.material_index = 2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    res = bmesh.ops.poke(bm, faces=[roto])
    centro = res['verts'][0]
    centro.co.x -= 0.05
    dientes = [0.13, -0.02, 0.07, -0.05, 0.17, 0.02, -0.04, 0.1, -0.03, 0.05, 0.15, -0.01, 0.04, -0.04]
    for k, v in enumerate(anillos[-1]):
        v.co.x += dientes[k % len(dientes)]
    P._chuequear(bm, 0.012, 7.7)
    o = P.objeto('tro_tronco', bm, MAT['musgosa'])
    o.data.materials.append(MAT['anillos'])
    o.data.materials.append(MAT['clara'])
    P.poner_veta(o, 'X', azar=0.53)
    P.biselar(o, 0.02)
    co = coords(o)
    r = np.array([radio(x) for x in co[:, 0]], np.float32)
    ycs = np.array([yc(x) for x in co[:, 0]], np.float32)
    atributo(o, 'Anillo', np.stack([(co[:, 1] - ycs) / r, (co[:, 2] - r) / r, np.full(len(co), 0.2)], 1))
    piezas.append(o)
    # el muñón de una rama
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=9, radius1=0.085, radius2=0.066, depth=0.42)
    bmesh.ops.translate(bm, vec=(0, 0, 0.21), verts=bm.verts)
    for f in bm.faces:
        if f.normal.z > 0.9:
            f.material_index = 1
    P._chuequear(bm, 0.008, 2.9)
    mu = P.objeto('tro_munon', bm, MAT['musgosa'])
    mu.data.materials.append(MAT['anillos'])
    P.poner_veta(mu, 'Z', azar=0.13)
    P.biselar(mu, 0.012)
    poner_anillo(mu, 0.066, 'Z', azar=0.6)
    x = 0.42
    transformar(mu, Matrix.Translation((x, yc(x), radio(x))) @ Matrix.Rotation(0.4, 4, 'Z') @ Matrix.Rotation(0.8, 4, 'X'))
    piezas.append(mu)
    return {'piezas': piezas, 'hijos': [], 'calcas': []}


PROPS = [
    ('Prop_LetreroCruce', letrero),
    ('Prop_Banca', banca),
    ('Prop_Barandal', barandal),
    ('Prop_Farol', farol),
    ('Prop_Puente', puente),
    ('Prop_Vado', vado),
    ('Prop_PiedraVado1', lambda: piedra_vado(0)),
    ('Prop_PiedraVado2', lambda: piedra_vado(1)),
    ('Prop_PiedraVado3', lambda: piedra_vado(2)),
    ('Prop_Tocon', tocon),
    ('Prop_Tronco', tronco),
]


# ---------------------------------------------------------------- atlas

# Cuánto del atlas le toca a cada prop respecto a los demás (1 = la misma densidad): el puente es la
# mitad de toda la superficie del grupo y se ve de lejos.
DENSIDAD = {'Prop_Puente': 0.7, 'Prop_Tronco': 0.85}
ABAJO = 0.3   # lo que mira al piso casi no se ve: sus islas van a esta escala


def escalar_islas(o, peso, abajo=ABAJO):
    """Escala cada isla del UV activo alrededor de su centro: `peso` en todas y además `abajo` en
    las que miran hacia el piso. Después el empaque reparte el atlas con esas proporciones."""
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
        for l in e.link_loops:
            if l.vert == e.verts[0]:
                pares.append((l[uv].uv.copy(), l.link_loop_next[uv].uv.copy()))
            else:
                pares.append((l.link_loop_next[uv].uv.copy(), l[uv].uv.copy()))
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
        nz = sum(f.normal.z * f.calc_area() for f in caras) / area
        esc = peso * (abajo if nz < -0.5 else 1.0)
        if abs(esc - 1.0) < 1e-6:
            continue
        loops = [l for f in caras for l in f.loops]
        c = sum((l[uv].uv for l in loops), Vector((0, 0))) / len(loops)
        for l in loops:
            l[uv].uv = c + (l[uv].uv - c) * esc
    bm.to_mesh(o.data)
    bm.free()


def uv_atlas(objs, margen=0.004):
    """Como P.uv_atlas (densidad pareja y margen como fracción de la imagen), pero antes de empacar
    achica lo que mira al piso y reparte la densidad según DENSIDAD."""
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
    for o in objs:
        escalar_islas(o, DENSIDAD.get(o.get('padre', o.name), 1.0))
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=margen, shape_method='CONCAVE')
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=margen)
    bpy.ops.object.mode_set(mode='OBJECT')


# ---------------------------------------------------------------- comandos

def marco(o, M):
    o['marco'] = [M[i][j] for i in range(4) for j in range(4)]


def leer_marco(o):
    m = list(o['marco'])
    return Matrix([m[i * 4:(i + 1) * 4] for i in range(4)])


def armar():
    P.limpiar()
    random.seed(SEMILLA)
    materiales()
    esten = None
    cursor = 0.0
    props, hijos = [], []
    for k, (nombre, hacer) in enumerate(PROPS):
        d = hacer()
        prop = P.unir(d['piezas'], nombre)
        sus = [h for h, _ in d['hijos']]
        lo, hi = caja_mundo([prop] + sus)
        x0 = cursor - lo[0]
        mover([prop] + sus, (x0, 0, 0))
        cursor += (hi[0] - lo[0]) + SEPARACION
        marco(prop, Matrix.Translation((x0, 0, 0)))
        prop['orden'] = k
        for h, M in d['hijos']:
            marco(h, Matrix.Translation((x0, 0, 0)) @ M)
            h['padre'] = nombre
            hijos.append(h)
        for mat, cx, cz, ancho in d['calcas']:
            esten = esten or P.estencil_skulley()[0]
            P.calca(mat, esten, centro=(x0 + cx, cz), ancho=ancho, normal=(0, -1, 0))
        props.append(prop)
    todos = props + hijos
    uv_atlas(todos)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    total = 0
    for p in props:
        grupo = [p] + [h for h in hijos if h['padre'] == p.name]
        lo, hi = caja_mundo(grupo)
        t = P.triangulos(grupo)
        total += t
        print(f'  {p.name:22s} {hi[0] - lo[0]:.2f} x {hi[1] - lo[1]:.2f} x {hi[2] - lo[2]:.2f} m   {t} triángulos')
    print(f'armado: {total} triángulos en total')


def listar():
    props = sorted([o for o in bpy.data.objects if 'orden' in o], key=lambda o: o['orden'])
    hijos = [o for o in bpy.data.objects if 'padre' in o]
    return props, hijos


def pintar():
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = listar()
    P.hornear_atlas(props + hijos, PNG, tam=TAM)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', PNG)


def a_marcos(props, hijos):
    for o in props + hijos:
        M = leer_marco(o)
        o.data.transform(M.inverted())
        o.matrix_world = M
    for h in hijos:
        M = h.matrix_world.copy()
        h.parent = bpy.data.objects[h['padre']]
        h.matrix_world = M
    bpy.context.view_layer.update()


def exportar():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = listar()
    a_marcos(props, hijos)
    for o in props + hijos:
        o.data.polygons.foreach_set('material_index', [0] * len(o.data.polygons))
    n = P.exportar_glb(props + hijos, PNG, GLB)
    print(f'exportado: {GLB} {n} bytes')


def _encuadrar(cam, objs, az=-28, el=22, margen=1.1):
    pts = []
    for o in objs:
        pts += [o.matrix_world @ v.co for v in o.data.vertices]
    a, e = math.radians(az - 90), math.radians(el)
    d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    rot = (-d).to_track_quat('-Z', 'Y')
    der, arr = rot @ Vector((1, 0, 0)), rot @ Vector((0, 1, 0))
    pr = [p.dot(der) for p in pts]
    pu = [p.dot(arr) for p in pts]
    centro = sum(pts, Vector()) / len(pts)
    c = centro + der * ((max(pr) + min(pr)) / 2 - centro.dot(der)) + arr * ((max(pu) + min(pu)) / 2 - centro.dot(arr))
    cam.data.ortho_scale = max(max(pr) - min(pr), max(pu) - min(pu)) * margen
    cam.location = c + d * 30
    cam.rotation_euler = rot.to_euler()


def render(carpeta):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = listar()
    todos = props + hijos
    m = P.material_final(PNG, 'Senderos_Final')
    for o in todos:
        o.data.polygons.foreach_set('material_index', [0] * len(o.data.polygons))
        o.data.materials.clear()
        o.data.materials.append(m)
    rutas = P.render_revision(todos, carpeta, 'senderos')
    sc = bpy.context.scene
    cam = sc.camera
    cam.data.clip_end = 200
    sc.render.resolution_x = 900
    sc.render.resolution_y = 900
    for p in props:
        grupo = [p] + [h for h in hijos if h['padre'] == p.name]
        for o in todos:
            o.hide_render = o not in grupo
        for i, az in enumerate((-28, 150)):
            _encuadrar(cam, grupo, az=az)
            ruta = os.path.join(carpeta, f'{p.name[5:].lower()}_{i}.png')
            sc.render.filepath = ruta
            bpy.ops.render.render(write_still=True)
            rutas.append(ruta)
    for o in todos:
        o.hide_render = False
    hoja(carpeta, [r for r in rutas if r.endswith('_0.png') and 'senderos_' not in r])
    print('render:', carpeta)


def hoja(carpeta, rutas, columnas=4, lado=450):
    """Una hoja de contacto con la primera foto de cada prop."""
    filas = math.ceil(len(rutas) / columnas)
    lienzo = np.zeros((filas * lado, columnas * lado, 4), np.float32)
    for i, r in enumerate(rutas):
        img = bpy.data.images.load(r, check_existing=False)
        w, h = img.size
        px = np.array(img.pixels[:], np.float32).reshape(h, w, 4)
        paso = max(1, w // lado)
        px = px[::paso, ::paso][:lado, :lado]
        f, c = filas - 1 - i // columnas, i % columnas
        lienzo[f * lado:f * lado + px.shape[0], c * lado:c * lado + px.shape[1]] = px
        bpy.data.images.remove(img)
    out = bpy.data.images.new('hoja', columnas * lado, filas * lado, alpha=True)
    out.pixels.foreach_set(lienzo.ravel())
    out.filepath_raw = os.path.join(carpeta, 'senderos_hoja.png')
    out.file_format = 'PNG'
    out.save()


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    carpeta = args[1] if len(args) > 1 else os.path.join(tempfile.gettempdir(), 'props_senderos')
    if cmd in ('armar', 'todo'):
        armar()
    if cmd in ('pintar', 'todo'):
        pintar()
    if cmd in ('exportar', 'todo'):
        exportar()
    if cmd in ('render', 'todo'):
        render(carpeta)
