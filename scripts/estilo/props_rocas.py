"""Props del grupo rocas: rocas con musgo, montoncito, hito con runa y el pedestal de los binoculares
(Oscar, 2026-11-24; features.md, La ofrenda -> El estilo gráfico, atlas Rocas). Cargan con la home y
casi todos van muchas veces en instancias, así que cada modelo va ligero y como objeto propio.
Pintados a mano con la librería compartida (scripts/estilo/pintura.py).

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_rocas.py -- todo [carpeta_fotos]

  armar     arma los props y sus materiales, revisa traspasos y guarda Character/Estilo_rocas.blend
  pintar    hornea el atlas de 2048 (Cycles) a Character/assets/props_rocas.png (el maestro)
  exportar  escribe public/3dmodels/estilo/props_rocas.glb (todos en fila, un material)
  render    fotos de revisión en la carpeta que se le dé
  vista     fotos rápidas de la geometría (Workbench, sin hornear)
  todo      armar, pintar, exportar y render

Si se retoca el PNG maestro a mano, basta `exportar`.

Los props (cada uno un objeto Prop_<Nombre>, en metros, base en z = 0, el frente hacia -Y):
  Prop_RocaChica      canto de río de ~0.5 m
  Prop_RocaMediana    roca de cerro de ~1 m
  Prop_RocaGrande     peñasco partido de ~1.6 m (las dos mitades separadas por una grieta)
  Prop_RocaLaja       laja alargada y plana de ~2 m
                      Las cuatro: facetadas, caras planas grandes con biseles suaves (normales
                      endurecidas), musgo arriba, en lo hondo y del lado de atrás (+Y, el de la
                      sombra), liquen y vetas. La base es plana en z = 0 y por arriba de ella la
                      roca se ensancha: el sitio las hunde ~10 % y las gira sin que se vea hueco.
  Prop_Montoncito     seis piedras planas apiladas (~0.4 m): cada una se apoya cara contra cara en
                      la de abajo (1 mm de holgura) con su centro de masa sobre el apoyo
  Prop_Hito           mojonera labrada (~0.5 m) con la runa R de SKULLEYGLYPH en bajorrelieve en la
                      cara de enfrente (la silueta sale de la fuente: scripts/estilo/runas_neon.mjs)
  Prop_PedestalBinoculares
                      pedestal de piedra labrada (~0.92 m) con enredaderas, la brida atornillada, el
                      poste y la rótula del pivote (~1.17 m en total)
    Prop_Binoculares  (hijo) los binoculares de moneda: el origen va en el centro de la rótula, así
                      el sitio los gira en cualquier sentido; el collar los abraza sin tocarla. Las
                      lentes miran a -Y y los oculares y la ranura de la moneda a +Y. Sin choques
                      con el pedestal en cualquier giro y hasta ±30° de cabeceo (revisado al armar).

Mientras se hornea, todo vive en coordenadas del mundo, cada prop en su lugar de la fila. Al exportar,
cada objeto pasa a su marco (`marco`) y el hijo se cuelga de su prop.
"""
import json
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import tessellate_polygon

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import pintura as P  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_rocas.blend')
PNG = os.path.join(REPO, 'Character', 'assets', 'props_rocas.png')
GLB = os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_rocas.glb')
TAM = 2048
SEMILLA = 23
SEPARACION = 0.8
RUNA = 'R'

# Gris cálido, más oscuro que P.PIEDRA (con la luz pintada arriba la de la librería salía casi blanca).
ROCA = {'oscura': '#4f4a44', 'base': '#7a7368', 'clara': '#9c9384', 'orilla': '#dcd3bd', 'mugre': '#2f2b26',
        'calido': '#a68d69', 'frio': '#727c8c', 'veta': '#d9cfb6'}
CANTO = {'oscura': '#55493f', 'base': '#857565', 'clara': '#a89684', 'orilla': '#e2d6c0', 'mugre': '#2f2924',
         'calido': '#ad8a62', 'frio': '#6f7886', 'veta': '#e0d4bb'}
LABRADA = {'oscura': '#686157', 'base': '#958c7d', 'clara': '#b3a996', 'orilla': '#e8e0ca', 'mugre': '#383229',
           'calido': '#ad9572', 'frio': '#888f99'}
MUSGO = {'base': '#4a7d22', 'claro': '#7fb437', 'luz': '#b1d55a'}
LIQUEN = {'claro': '#c6c99b', 'naranja': '#c98a3c'}

MAT = {}


# ---------------------------------------------------------------- geometría

def coords(o):
    co = np.empty(len(o.data.vertices) * 3, np.float32)
    o.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def caja_mundo(objs):
    co = np.concatenate([coords(o) for o in objs])
    return co.min(0), co.max(0)


def mover(objs, d):
    for o in objs:
        o.data.transform(Matrix.Translation(d))


def transformar(objs, M):
    for o in objs:
        o.data.transform(M)


def atributo(o, nombre, valores):
    me = o.data
    rgba = np.concatenate([np.asarray(valores, np.float32), np.ones((len(valores), 1), np.float32)], 1)
    at = me.color_attributes.get(nombre) or me.color_attributes.new(nombre, 'FLOAT_COLOR', 'POINT')
    at.data.foreach_set('color', rgba.ravel())


def casco(nombre, puntos, material, disuelve=7):
    """El casco convexo de unos puntos, con las caras casi planas fundidas en facetas grandes."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in puntos]
    res = bmesh.ops.convex_hull(bm, input=vs)
    sobra = list({g for g in res['geom_interior'] + res['geom_unused'] if isinstance(g, bmesh.types.BMVert)})
    if sobra:
        bmesh.ops.delete(bm, geom=sobra, context='VERTS')
    if disuelve:
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(disuelve), verts=list(bm.verts), edges=list(bm.edges))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def a_medida(o, tam):
    """Escala la malla para que su caja mida `tam`, centrada en x, y, con la base en z = 0."""
    co = coords(o)
    lo, hi = co.min(0), co.max(0)
    s = np.array(tam) / np.maximum(hi - lo, 1e-6)
    co = (co - np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])) * s
    o.data.vertices.foreach_set('co', co.astype(np.float32).ravel())
    o.data.update()


def cortar(o, co=(0, 0, 0), no=(0, 0, 1), quitar_abajo=True):
    """Corta la malla con un plano y tapa el hueco (lo de abajo del plano, o lo de arriba)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=1e-6,
                           plane_co=co, plane_no=no, clear_inner=quitar_abajo, clear_outer=not quitar_abajo)
    orilla = [e for e in bm.edges if e.is_boundary]
    if orilla:
        bmesh.ops.holes_fill(bm, edges=orilla, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()


def copia(o, nombre):
    c = o.copy()
    c.data = o.data.copy()
    c.name = c.data.name = nombre
    bpy.context.scene.collection.objects.link(c)
    return c


def torno(nombre, perfil, material, eje='Z', lados=10, centro=(0, 0, 0), mats=None, cerrado=False, giro=0.0):
    """Un sólido de revolución: `perfil` son (t, r) a lo largo del eje (r = 0 cierra en el eje).
    `mats` da el índice de material de cada tramo del perfil. Con `cerrado`, el último punto se une
    con el primero (un aro)."""
    ejes = {'X': (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
            'Y': (Vector((0, 1, 0)), Vector((0, 0, 1)), Vector((1, 0, 0))),
            'Z': (Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0)))}
    a, b, c = ejes[eje]
    c0 = Vector(centro)
    bm = bmesh.new()
    anillos = []
    for t, r in perfil:
        if r == 0:
            anillos.append([bm.verts.new(c0 + a * t)])
        else:
            anillos.append([bm.verts.new(c0 + a * t + (b * math.cos(giro + 2 * math.pi * k / lados) + c * math.sin(giro + 2 * math.pi * k / lados)) * r)
                            for k in range(lados)])
    tramos = list(range(len(anillos) - 1)) + ([len(anillos) - 1] if cerrado else [])
    for i in tramos:
        A, B = anillos[i], anillos[(i + 1) % len(anillos)]
        caras = []
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            caras = [bm.faces.new((A[0], B[(k + 1) % lados], B[k])) for k in range(lados)]
        elif len(B) == 1:
            caras = [bm.faces.new((A[k], A[(k + 1) % lados], B[0])) for k in range(lados)]
        else:
            caras = [bm.faces.new((A[k], A[(k + 1) % lados], B[(k + 1) % lados], B[k])) for k in range(lados)]
        if mats:
            for f in caras:
                f.material_index = mats[i]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material if not isinstance(material, (list, tuple)) else material[0])
    if isinstance(material, (list, tuple)):
        for m in material[1:]:
            o.data.materials.append(m)
    return o


def bola(nombre, radio, material, centro, aplasta=(1, 1, 1), u=8, v=5):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=radio)
    for p in bm.verts:
        p.co = Vector((p.co.x * aplasta[0], p.co.y * aplasta[1], p.co.z * aplasta[2])) + Vector(centro)
    return P.objeto(nombre, bm, material)


def caja(nombre, tam, material, centro=(0, 0, 0), M=None, bisel=0.01, segmentos=1, angulo=30, ahusado=1.0):
    """Una caja (base en -z/2 de su centro), con la cara de arriba escalada `ahusado` y biseles."""
    ax, ay, az = tam
    pts = [(sx * ax / 2, sy * ay / 2, -az / 2) for sx in (-1, 1) for sy in (-1, 1)]
    pts += [(sx * ax / 2 * ahusado, sy * ay / 2 * ahusado, az / 2) for sx in (-1, 1) for sy in (-1, 1)]
    o = casco(nombre, pts, material, disuelve=1)
    if bisel:
        P.biselar(o, min(bisel, min(tam) * 0.45), segmentos, angulo=angulo)
    transformar([o], Matrix.Translation(centro) @ (M if M is not None else Matrix.Identity(4)))
    return o


def tubo(nombre, puntos, radios, material, lados=5):
    """Un tubo que sigue una línea, con un radio por punto y tapas."""
    pts = [Vector(p) for p in puntos]
    n = len(pts)
    tang = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    ref = Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = (ref - tang[0] * ref.dot(tang[0])).normalized()
    bm = bmesh.new()
    anillos = []
    for i, p in enumerate(pts):
        t = tang[i]
        nrm = (nrm - t * nrm.dot(t)).normalized()
        bb = t.cross(nrm).normalized()
        anillos.append([bm.verts.new(p + (nrm * math.cos(2 * math.pi * k / lados) + bb * math.sin(2 * math.pi * k / lados)) * radios[i])
                        for k in range(lados)])
    for a, b in zip(anillos, anillos[1:]):
        for k in range(lados):
            kk = (k + 1) % lados
            bm.faces.new((a[k], a[kk], b[kk], b[k]))
    bm.faces.new(list(reversed(anillos[0])))
    bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def bisel_suave(o, ancho, angulo=6):
    """Bisel de un segmento en las aristas de más de `angulo`, marcando sus caras (atributo de cara
    `bisel`) para que endurecer() deje planas las caras grandes y suave el bisel."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    lim = math.radians(angulo)
    aristas = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim]
    res = bmesh.ops.bevel(bm, geom=aristas, offset=ancho, offset_type='OFFSET', segments=1, profile=0.5,
                          affect='EDGES', clamp_overlap=True)
    nuevas = set(res['faces'])
    bm.faces.index_update()
    marca = [f in nuevas for f in bm.faces]
    bm.to_mesh(me)
    bm.free()
    at = me.attributes.get('bisel') or me.attributes.new('bisel', 'BOOLEAN', 'FACE')
    at.data.foreach_set('value', marca)


def endurecer(o):
    """Normales a mano: cada vértice toma la normal de la cara grande en que quedó (con un bisel de un
    segmento, cada vértice nuevo es de una sola), así las caras grandes salen planas y el bisel pasa
    suave de una a otra (lo que hace harden normals, que con estas mallas salía redondeado). Se llama
    al final, con la geometría ya en su medida."""
    me = o.data
    at = me.attributes.get('bisel')
    marca = [False] * len(me.polygons)
    if at:
        at.data.foreach_get('value', marca)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    normales = []
    for v in bm.verts:
        suma = Vector()
        for f in v.link_faces:
            if not marca[f.index]:
                suma += f.normal * f.calc_area()
        normales.append(suma.normalized() if suma.length > 1e-12 else v.normal.copy())
    bm.free()
    cn = me.attributes.get('custom_normal')
    if cn:
        me.attributes.remove(cn)
    se = me.attributes.get('sharp_edge')
    if se:
        me.attributes.remove(se)
    for p in me.polygons:
        p.use_smooth = True
    me.normals_split_custom_set_from_vertices(normales)
    if at:
        me.attributes.remove(at)


def booleana(o, cortador, operacion):
    m = o.modifiers.new('bool', 'BOOLEAN')
    m.operation = operacion
    m.object = cortador
    m.solver = 'EXACT'
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cortador, do_unlink=True)


def sin_normales_propias(o, angulo=40):
    """Quita las normales a mano (las de los biseles endurecidos) y marca duras las aristas de más
    de `angulo`: para lo que pasó por booleanas, donde las normales a mano quedan revueltas."""
    me = o.data
    cn = me.attributes.get('custom_normal')
    if cn:
        me.attributes.remove(cn)
    bm = bmesh.new()
    bm.from_mesh(me)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(angulo))
    bm.to_mesh(me)
    bm.free()


def unir(objs, nombre):
    if len(objs) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
    o = objs[0]
    o.name = nombre
    o.data.name = nombre
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    return o


# ---------------------------------------------------------------- revisión de traspasos

def arbol(objs, M=None):
    verts, caras = [], []
    for o in objs:
        base = len(verts)
        mw = o.matrix_world if M is None else M @ o.matrix_world
        verts += [mw @ v.co for v in o.data.vertices]
        caras += [[base + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, caras) if caras else None


def choques(A, B, M=None):
    ta, tb = arbol(A), arbol(B, M)
    return len(ta.overlap(tb)) if ta and tb else 0


REVISION = []


def anotar(texto):
    REVISION.append(texto)
    print('  ' + texto)


# ---------------------------------------------------------------- materiales

def antes_del_grano(mat, capa):
    """Mete una capa de pintura (capa(N, col, pos, geo, nz) -> col) justo antes del grano del papel."""
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


def _liquen(N, col, pos, nz, ny, fuerza):
    """Manchas de liquen: claras con la orilla más oscura del lado del sol (arriba y al frente) y
    unas pocas naranjas."""
    lq = N.celdas(P.deformado(N, pos, 7.0, 0.16), 6.5)
    sc = N.n('ShaderNodeSeparateColor')
    N.l(lq.outputs['Color'], sc.inputs[0])
    sol = P.suave(N, N.val('SUBTRACT', nz, N.val('MULTIPLY', ny, 0.7)), -0.3, 0.4)
    roto = N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pos, 22.0, detalle=2.0), 0.5), 0.14)   # la orilla rota, nada de círculos
    hay = N.val('MULTIPLY', N.val('GREATER_THAN', sc.outputs[0], 0.72), sol)
    d = N.val('ADD', N.val('ADD', lq.outputs['Distance'], roto), N.val('SUBTRACT', 1.0, hay))
    col = P.lavado(N, col, d, 0.17, 0.025, LIQUEN['claro'], 0.6 * fuerza, borde=0.55, oscuro=0.6, invertido=True)
    hay_n = N.val('MULTIPLY', N.val('GREATER_THAN', sc.outputs[1], 0.9), sol)
    d_n = N.val('ADD', N.val('ADD', lq.outputs['Distance'], roto), N.val('SUBTRACT', 1.0, hay_n))
    return P.lavado(N, col, d_n, 0.11, 0.02, LIQUEN['naranja'], 0.7 * fuerza, borde=0.45, invertido=True)


def _musgo(N, col, pos, campo, umbral, fuerza):
    """El musgo jugoso en tres valores: la mancha con su orilla oscura, lo claro y puntitos de luz."""
    fino = N.ruido(pos, 16.0, detalle=2.0)
    campo = N.val('ADD', campo, N.val('MULTIPLY', N.val('SUBTRACT', fino, 0.5), 0.25))
    col = P.lavado(N, col, campo, umbral, 0.035, MUSGO['base'], 0.92 * fuerza, borde=0.55, oscuro=0.55)
    claro = N.val('ADD', campo, N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pos, 7.0, detalle=2.0), 0.5), 0.3))
    col = P.lavado(N, col, claro, umbral + 0.2, 0.035, MUSGO['claro'], 0.7 * fuerza, borde=0.0)
    luz = N.val('ADD', claro, N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pos, 34.0, detalle=1.0), 0.5), 0.4))
    return P.lavado(N, col, luz, umbral + 0.36, 0.025, MUSGO['luz'], 0.55 * fuerza, borde=0.0)


def material_roca(nombre, paleta=ROCA, musgo=1.0, umbral=1.0, liquen=1.0, vetas=1.0, suelo=0.0):
    """Roca facetada en acuarela: cada faceta con su tono (el ruido de su normal, que es constante
    en una cara plana), lavados cálidos y fríos, vetas claras, la cara de arriba más clara, grietas
    finas, la orilla clara en los biseles, liquen, mugre en lo hondo y el musgo arriba, en lo hondo
    y del lado de atrás (+Y, el de la sombra). `suelo` suma musgo cerca del piso."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    nrm = geo.outputs['True Normal']
    sn = N.n('ShaderNodeSeparateXYZ')
    N.l(nrm, sn.inputs[0])
    ny = sn.outputs['Y']
    sz = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sz.inputs[0])
    faceta = N.ruido(nrm, 3.2, detalle=1.0)
    col = N.rampa(faceta, [(0.3, paleta['oscura']), (0.5, paleta['base']), (0.72, paleta['clara'])])
    col = N.mezcla(0.3, col, paleta['base'])
    campo = N.ruido(pos, 2.2, detalle=3.0, rugosidad=0.6, distorsion=1.3)
    col = P.lavado(N, col, campo, 0.4, 0.14, paleta['oscura'], 0.28, borde=0.12, invertido=True)
    col = P.lavado(N, col, campo, 0.6, 0.14, paleta['clara'], 0.24, borde=0.08)
    tinte = N.ruido(pos, 1.1, detalle=1.0, distorsion=1.0)
    col = P.lavado(N, col, tinte, 0.57, 0.13, paleta['calido'], 0.34, borde=0.0)
    col = P.lavado(N, col, tinte, 0.43, 0.13, paleta['frio'], 0.3, borde=0.0, invertido=True)
    trazos = N.ruido(N.escalar(pos, (13.0, 13.0, 4.0)), 1.0, detalle=2.0, distorsion=1.0)
    col = P.lavado(N, col, trazos, 0.36, 0.05, paleta['oscura'], 0.18, borde=0.15, invertido=True)
    if vetas:
        ola = N.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL', wave_profile='SIN')
        ola.inputs['Scale'].default_value = 1.4
        ola.inputs['Distortion'].default_value = 4.0
        ola.inputs['Detail'].default_value = 2.0
        N.l(P.deformado(N, pos, 1.6, 0.18), ola.inputs['Vector'])
        hay = P.suave(N, N.ruido(pos, 0.9, detalle=1.0), 0.47, 0.6)
        linea = N.val('SUBTRACT', 1.0, P.suave(N, ola.outputs['Fac'], 0.002, 0.013))
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', linea, hay), 0.42 * vetas), col, paleta['veta'])
        halo = N.val('SUBTRACT', N.val('SUBTRACT', 1.0, P.suave(N, ola.outputs['Fac'], 0.013, 0.035)), linea)
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', halo, hay), 0.12 * vetas), col, paleta['oscura'])
    col = N.mezcla(N.val('MULTIPLY', P.suave(N, nz, 0.35, 0.85), 0.3), col, paleta['clara'])
    borde_v = N.n('ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE')
    borde_v.inputs['Scale'].default_value = 3.0
    N.l(P.deformado(N, pos, 3.0, 0.18), borde_v.inputs['Vector'])
    mascara = P.suave(N, N.ruido(pos, 1.8, detalle=1.0), 0.55, 0.63)
    d = N.val('ADD', borde_v.outputs['Distance'], N.val('SUBTRACT', 1.0, mascara))
    col = P.lavado(N, col, d, 0.02, 0.006, paleta['orilla'], 0.22, borde=0.0, invertido=True)
    col = P.lavado(N, col, d, 0.007, 0.004, paleta['mugre'], 0.55, borde=0.3, invertido=True)
    b = P.suave(N, P.orilla_bisel(N, geo, 0.04, 16), 0.012, 0.05)
    seco = P.suave(N, N.ruido(pos, 14.0, detalle=2.0), 0.3, 0.7)
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', b, seco), 0.55), col, paleta['orilla'])
    if liquen:
        col = _liquen(N, col, pos, nz, ny, liquen)
    ao = N.n('ShaderNodeAmbientOcclusion', samples=24)
    ao.inputs['Distance'].default_value = 0.18
    aov = ao.outputs['AO']
    col = P.lavado(N, col, aov, 0.62, 0.08, paleta['mugre'], 0.5, borde=0.25, invertido=True)
    if musgo:
        manchas = N.ruido(pos, 2.6, detalle=3.0, rugosidad=0.6, distorsion=1.4)
        campo = N.val('MULTIPLY', manchas, 0.9)
        campo = N.val('ADD', campo, N.val('MULTIPLY', P.suave(N, nz, 0.15, 0.9), 0.5))
        campo = N.val('ADD', campo, N.val('MULTIPLY', P.suave(N, ny, -0.2, 0.8), 0.16))
        campo = N.val('ADD', campo, N.val('MULTIPLY', N.val('SUBTRACT', 1.0, aov), 0.85))
        if suelo:
            campo = N.val('ADD', campo, N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, sz.outputs['Z'], 0.0, 0.12)), suelo))
        col = _musgo(N, col, pos, campo, umbral, musgo)
    col = P.grano(N, col, pos, 0.12)
    P._salida(N, col)
    return m


def material_labrada(nombre, paleta=LABRADA, musgo=0.9, umbral=1.02):
    """Piedra labrada en acuarela (hito y pedestal): cada cara de su tono, marcas del cincel, la
    cara de arriba más clara, desportilladuras claras con el filo oscuro en las orillas, el fondo
    del bajorrelieve más oscuro y la runa más limpia (atributo `Hondo`: x = qué tan hondo, y = la
    cara de la runa), mugre en lo hondo, liquen y musgo que sube del piso y se mete en lo hondo."""
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
    col = N.mezcla(N.val('MULTIPLY', sa.outputs['Y'], 0.4), col, paleta['clara'])
    col = _liquen(N, col, pos, nz, ny, 0.5)
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
        col = _musgo(N, col, pos, campo, umbral, musgo)
    col = P.grano(N, col, pos, 0.12)
    P._salida(N, col)
    return m


def material_metal_pintado(nombre, pintura=P.PINTURAS['turquesa']):
    """Lámina pintada (la cabeza de los binoculares): el color liso de la librería y, en las orillas,
    la pintura saltada que deja ver el metal, con su filo oscuro, y óxido aguado abajo."""
    m = P.material_liso(nombre, pintura['base'], claro=pintura['clara'], oscuro=pintura['oscura'], desgaste=0.3, orilla=pintura['orilla'])

    def capa(N, col, pos, geo, nz):
        ancha = P.suave(N, P.orilla_bisel(N, geo, 0.02, 12), 0.01, 0.04)
        cae = N.celdas(P.deformado(N, pos, 9.0, 0.05), 18.0)
        d = N.val('ADD', cae.outputs['Distance'], N.val('SUBTRACT', 1.0, ancha))
        col = P.lavado(N, col, d, 0.3, 0.03, P.METAL['claro'], 0.9, borde=0.6, oscuro=0.45, invertido=True)
        ox = N.ruido(N.escalar(pos, (30.0, 30.0, 8.0)), 1.0, detalle=2.0)
        return P.lavado(N, col, ox, 0.3, 0.04, P.METAL['oxido'], 0.35, borde=0.4, invertido=True)
    antes_del_grano(m, capa)
    return m


def materiales():
    MAT['roca'] = material_roca('Rocas_Roca', umbral=0.97)
    MAT['canto'] = material_roca('Rocas_Canto', paleta=CANTO, musgo=0.8, umbral=1.2, liquen=0.6, vetas=0.7, suelo=0.5)
    MAT['labrada'] = material_labrada('Rocas_Labrada')
    MAT['metal'] = P.material_metal('Rocas_Metal', oxido=0.4)
    MAT['pintado'] = material_metal_pintado('Rocas_MetalPintado')
    MAT['vidrio'] = P.material_liso('Rocas_Vidrio', '#1d3245', claro='#5c8fb3', oscuro='#0d1824', orilla='#a9d0ea')
    MAT['hule'] = P.material_liso('Rocas_Hule', '#26262b', claro='#4d4d56', oscuro='#141417', orilla='#6c6c76')
    MAT['tallo'] = P.material_liso('Rocas_Tallo', '#5e4c2b', claro='#7f6c3f', oscuro='#3a2d17', orilla='#9c8a5a')
    MAT['laton'] = P.material_liso('Rocas_Laton', '#b58e47', claro='#dcb873', oscuro='#6e5222', orilla='#f3dfaa')
    MAT['hoja'] = P.material_liso('Rocas_Hoja', '#4a8a27', claro='#85c046', oscuro='#2a5416', orilla='#b1d96a')


# ---------------------------------------------------------------- rocas

def puntos_roca(semilla, anillos, cimas, inclina=0.14):
    """Anillos de pocos puntos al azar (h, r en fracciones del alto y del radio, n puntos) más unas
    cimas (x, y, z en fracciones): el casco convexo de eso es la roca. Pocos puntos = pocas caras
    grandes."""
    rnd = random.Random(semilla)
    inc = (rnd.uniform(-inclina, inclina), rnd.uniform(-inclina, inclina))
    pts = []
    for h, r, n in anillos:
        off = rnd.uniform(0, 2 * math.pi)
        for k in range(n):
            a = off + 2 * math.pi * k / n + rnd.uniform(-0.28, 0.28)
            rr = r * rnd.uniform(0.84, 1.06)
            x, y = math.cos(a) * rr, math.sin(a) * rr
            z = 0.0 if h == 0 else h * rnd.uniform(0.9, 1.05) + (inc[0] * x + inc[1] * y) * h
            pts.append((x, y, z))
    for fx, fy, fz in cimas:
        pts.append((fx + rnd.uniform(-0.06, 0.06), fy + rnd.uniform(-0.06, 0.06), fz * rnd.uniform(0.95, 1.0)))
    return pts


def roca(nombre, tam, semilla, anillos, cimas, material, bisel, inclina=0.14):
    o = casco(nombre, puntos_roca(semilla, anillos, cimas, inclina), material, disuelve=4)
    a_medida(o, tam)
    bisel_suave(o, bisel, angulo=3)
    a_medida(o, tam)   # el bisel come las puntas: de vuelta a su medida
    endurecer(o)
    return o


def roca_chica():
    """Canto de río: redondito y aplanado, con la panza abajo."""
    o = roca('rch', (0.52, 0.42, 0.29), SEMILLA + 1, ((0.0, 0.8, 5), (0.35, 1.0, 5), (0.76, 0.74, 4)),
             ((0.05, 0.0, 1.0),), MAT['roca'], bisel=0.026)
    return {'piezas': [o], 'hijos': []}


def roca_mediana():
    """Roca de cerro: angulosa, con la cima corrida a un lado."""
    o = roca('rme', (1.02, 0.84, 0.66), SEMILLA + 2, ((0.0, 0.92, 6), (0.3, 1.0, 5), (0.72, 0.68, 4)),
             ((-0.22, 0.1, 1.0),), MAT['roca'], bisel=0.042, inclina=0.2)
    return {'piezas': [o], 'hijos': []}


def roca_grande():
    """Peñasco partido: el casco se corta con un plano chueco y cada mitad se ladea hacia afuera
    sobre una bisagra en el piso, así la grieta abre hacia arriba (ahí se mete el musgo) y abajo
    queda una rendija de 1.2 cm: las mitades no se tocan."""
    o = casco('rgr', puntos_roca(SEMILLA + 3, ((0.0, 0.92, 6), (0.24, 1.0, 6), (0.64, 0.82, 5)),
                                 ((-0.15, 0.1, 1.0), (0.3, -0.1, 0.93))), MAT['roca'], disuelve=4)
    a_medida(o, (1.62, 1.3, 1.05))
    no = Vector((0.93, 0.3, 0.2)).normalized()
    co = Vector((0.12, 0.0, 0.0))
    b = copia(o, 'rgr_b')
    cortar(o, co, no, quitar_abajo=False)   # o: la mitad de -no
    cortar(b, co, no, quitar_abajo=True)    # b: la de +no
    eje = no.cross(Vector((0, 0, 1))).normalized()
    nh = Vector((no.x, no.y, 0))
    gap, ang = 0.012, math.radians(1.9)
    for pieza, s in ((o, -1), (b, 1)):
        q = co + no * (s * gap / 2)
        bisagra = Vector((q.x, q.y, 0)) + nh * (q.z * no.z / nh.length_squared)   # en el plano corrido, a ras del piso
        transformar([pieza], Matrix.Translation(no * (s * gap / 2)))

        def giro(signo):
            return Matrix.Translation(bisagra) @ Matrix.Rotation(signo * ang, 4, eje) @ Matrix.Translation(-bisagra)
        R = giro(1)
        arriba = bisagra + Vector((0, 0, 1))
        if ((R @ arriba) - arriba).dot(no) * s < 0:   # que se ladee hacia afuera, lejos de la otra mitad
            R = giro(-1)
        transformar([pieza], R)
        cortar(pieza)
    for pieza in (o, b):
        bisel_suave(pieza, 0.055)
        endurecer(pieza)
    anotar(f'traspasos RocaGrande mitad contra mitad: {choques([o], [b])}')
    return {'piezas': [o, b], 'hijos': []}


def roca_laja():
    """Laja alargada y plana: costados empinados y la cima casi plana, con una leve inclinación."""
    o = roca('rla', (2.05, 0.96, 0.44), SEMILLA + 4, ((0.0, 0.9, 6), (0.55, 1.0, 6), (0.92, 0.86, 5)),
             ((-0.3, 0.05, 1.0), (0.35, -0.1, 0.98)), MAT['roca'], bisel=0.045, inclina=0.05)
    return {'piezas': [o], 'hijos': []}


# ---------------------------------------------------------------- montoncito

HOLGURA = 0.001


def losa(nombre, ax, ay, h, pendiente, material, semilla, lados=6, bisel=0.012, panza=True):
    """Una piedra plana de canto: la cara de abajo en z = 0, la de arriba plana e inclinada
    (`pendiente`, una cuña) y la panza a media altura. Devuelve la piedra y su cara de arriba
    (punto y normal, en su marco)."""
    rnd = random.Random(semilla)
    sx, sy = pendiente
    pts = []
    anillos = ((0.8, 0.0, lados), (1.0, 0.5, lados + 1), (0.8, 1.0, lados)) if panza else ((0.95, 0.0, lados), (0.95, 1.0, lados))
    for r, f, n in anillos:
        off = rnd.uniform(0, 2 * math.pi)
        for k in range(n):
            a = off + 2 * math.pi * k / n + rnd.uniform(-0.25, 0.25)
            rr = r * rnd.uniform(0.9, 1.05)
            x, y = math.cos(a) * rr * ax / 2, math.sin(a) * rr * ay / 2
            pts.append((x, y, f * (h + sx * x + sy * y)))
    o = casco(nombre, pts, material, disuelve=4)
    bisel_suave(o, bisel)
    endurecer(o)
    return o, Vector((0, 0, h)), Vector((-sx, -sy, 1)).normalized()


def montoncito():
    """Seis piedras planas apiladas en equilibrio, como las de los caminos. Cada piedra se apoya
    cara contra cara en la de abajo (la cara de arriba de cada una es plana e inclinada; la de abajo
    de la siguiente se alinea con ella a 1 mm), así no se cruzan y no hay apoyos en una esquina."""
    plan = [  # (ancho, fondo, alto, pendiente de la cara de arriba, corrimiento en su plano, giro)
        (0.31, 0.25, 0.085, (0.06, -0.03), (0.0, 0.0), 0.2),
        (0.25, 0.19, 0.072, (-0.07, 0.05), (0.02, -0.012), 1.3),
        (0.22, 0.16, 0.07, (0.05, 0.06), (-0.022, 0.014), 2.4),
        (0.16, 0.135, 0.062, (-0.06, -0.05), (0.016, 0.016), 0.6),
        (0.135, 0.1, 0.056, (0.08, -0.03), (-0.012, -0.012), 1.9),
        (0.085, 0.075, 0.052, (0.0, 0.0), (0.008, 0.006), 2.9),
    ]
    piezas, caras = [], []
    W = Matrix.Identity(4)
    for k, (ax, ay, h, pend, (ox, oy), giro) in enumerate(plan):
        o, c, n = losa(f'mon_{k}', ax, ay, h, pend, MAT['canto'], SEMILLA * 7 + k, lados=5,
                       bisel=0.012 if k < 3 else 0.011, panza=k < 3)
        if k:
            W = W @ Matrix.Translation(caras[-1][0]) @ Vector((0, 0, 1)).rotation_difference(caras[-1][1]).to_matrix().to_4x4() \
                @ Matrix.Translation((ox, oy, HOLGURA))
        M = W @ Matrix.Rotation(giro, 4, 'Z')
        transformar([o], M)
        W = M
        caras.append((c, n))
        piezas.append(o)
    pares = [(i, j) for i in range(len(piezas)) for j in range(i + 1, len(piezas))]
    n = sum(choques([piezas[i]], [piezas[j]]) for i, j in pares)
    anotar(f'traspasos Montoncito entre sus {len(piezas)} piedras: {n}')
    revisar_equilibrio(piezas)
    return {'piezas': piezas, 'hijos': []}


def _centro_masa(objs):
    """Centro de masa de mallas cerradas (por tetraedros desde el origen)."""
    total, suma = 0.0, Vector()
    for o in objs:
        me = o.data
        me.calc_loop_triangles()
        for t in me.loop_triangles:
            a, b, c = (me.vertices[i].co for i in t.vertices)
            v = a.dot(b.cross(c)) / 6
            total += v
            suma += (a + b + c) / 4 * v
    return suma / total


def revisar_equilibrio(piedras):
    """Que el centro de masa de lo que va encima de cada piedra caiga (en vertical) dentro de la
    cara en que se apoya: la de arriba de la piedra de abajo y la de abajo de la que sigue."""
    def cara(o, hacia):
        me = o.data
        mejor = max(me.polygons, key=lambda p: p.normal.dot(hacia) * (p.area if p.normal.dot(hacia) > 0.97 else 0))
        return [me.vertices[i].co.copy() for i in mejor.vertices], mejor.normal.copy()

    def margen(pt, poli, n):
        # distancia del punto (proyectado en vertical sobre el plano) a la orilla del polígono, negativa si cae fuera
        o = poli[0]
        t = (o - pt).dot(n) / n.z
        p = pt + Vector((0, 0, t))
        u = (poli[1] - poli[0]).normalized()
        v = n.cross(u)
        q = [((x - o).dot(u), (x - o).dot(v)) for x in poli]
        px, py = (p - o).dot(u), (p - o).dot(v)
        dmin = 1e9
        for (x0, y0), (x1, y1) in zip(q, q[1:] + q[:1]):
            ex, ey = x1 - x0, y1 - y0
            dmin = min(dmin, (ex * (py - y0) - ey * (px - x0)) / math.hypot(ex, ey))
        area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(q, q[1:] + q[:1]))
        return dmin if area > 0 else -dmin

    peor = 1e9
    for k in range(len(piedras)):
        cm = _centro_masa(piedras[k:])
        abajo, nb = cara(piedras[k], Vector((0, 0, -1)))
        m1 = margen(cm, abajo, -nb)
        if k:
            arriba, na = cara(piedras[k - 1], Vector((0, 0, 1)))
            m1 = min(m1, margen(cm, arriba, na))
        peor = min(peor, m1)
    anotar(f'equilibrio Montoncito: el centro de masa queda a {peor * 1000:.0f} mm o más dentro de cada apoyo')


# ---------------------------------------------------------------- hito

HITO = {'W0': 0.27, 'D0': 0.19, 'W1': 0.23, 'D1': 0.16, 'H1': 0.40, 'H': 0.50,
        'panel': (0.155, 0.30, 0.034), 'centro': 0.215, 'hondo': 0.014, 'runa_ancho': 0.125}


def leer_runa(letra=RUNA):
    node = shutil.which('node') or 'C:/Program Files/nodejs/node.exe'
    r = subprocess.run([node, os.path.join(AQUI, 'runas_neon.mjs'), letra], cwd=REPO, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)['letras'][0]['contornos']


def area_lazo(pts):
    return 0.5 * sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))


def orientar(pts, ccw):
    return pts if (area_lazo(pts) > 0) == ccw else list(reversed(pts))


def dentro_lazo(pt, pts):
    x, y = pt
    c = False
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            c = not c
    return c


def limpiar_lazo(pts, minimo):
    """Quita los puntos a menos de `minimo` del anterior: con dos puntos casi encimados, al correr
    el contorno se cruzaban (el hueco de la R tiene un tramo de 0.4 mm) y la tapa se cruzaba sola."""
    out = [pts[0]]
    for p in pts[1:]:
        if math.dist(p, out[-1]) >= minimo:
            out.append(p)
    if len(out) > 3 and math.dist(out[0], out[-1]) < minimo:
        out.pop()
    return out


def desplazar(pts, d):
    """Corre cada punto `d` hacia la izquierda de su lazo: con los exteriores en sentido contrario al
    reloj y los huecos en el del reloj, d > 0 adelgaza lo sólido."""
    n = len(pts)
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        e1, e2 = (p1 - p0).normalized(), (p2 - p1).normalized()
        n1, n2 = Vector((-e1.y, e1.x)), Vector((-e2.y, e2.x))
        m = n1 + n2
        m = m.normalized() if m.length > 1e-6 else n1
        out.append(tuple(p1 + m * (d / max(m.dot(n1), 0.4))))
    return out


def rect_redondo(w, h, r, por_esquina=5):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(por_esquina):
            a = math.radians(a0 + 90 * k / (por_esquina - 1))
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def relieve(nombre, figuras, mundo, d_frente, d_atras, ins_frente, ins_atras, material):
    """Un prisma de lazos (figura = exterior + sus huecos, en coordenadas de la cara) entre dos
    profundidades, con las paredes en talud (cada profundidad con su desplazamiento del contorno)."""
    bm = bmesh.new()
    for fig in figuras:
        Lf = [desplazar(L, ins_frente) for L in fig]
        Lb = [desplazar(L, ins_atras) for L in fig]
        F = [[bm.verts.new(mundo(u, v, d_frente)) for u, v in L] for L in Lf]
        B = [[bm.verts.new(mundo(u, v, d_atras)) for u, v in L] for L in Lb]
        # cada tapa con su propia triangulación: con la del frente, el talud volteaba triángulos
        # delgados de la de atrás y la malla se cruzaba consigo misma (la booleana dejaba caras dobles)
        pf = [v for lazo in F for v in lazo]
        pb = [v for lazo in B for v in lazo]
        for a, b, c in tessellate_polygon([[Vector((u, v, 0)) for u, v in L] for L in Lf]):
            bm.faces.new((pf[a], pf[b], pf[c]))
        for a, b, c in tessellate_polygon([[Vector((u, v, 0)) for u, v in L] for L in Lb]):
            bm.faces.new((pb[c], pb[b], pb[a]))
        for lf, lb in zip(F, B):
            n = len(lf)
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((lf[i], lb[i], lb[j], lf[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def hito():
    """Mojonera labrada: tronco de pirámide con punta de pirámide, biseles grandes, y en la cara de
    enfrente una cartela rebajada con la runa en bajorrelieve (paredes en talud; la cara de la runa
    queda 3 mm abajo de la de la piedra y 11 mm arriba del fondo). Booleanas exactas: una sola malla
    cerrada, nada encimado."""
    H = HITO
    pts = [(sx * H['W0'] / 2, sy * H['D0'] / 2, 0.0) for sx in (-1, 1) for sy in (-1, 1)]
    pts += [(sx * H['W1'] / 2, sy * H['D1'] / 2, H['H1']) for sx in (-1, 1) for sy in (-1, 1)]
    pts += [(sx * 0.032, sy * 0.022, H['H']) for sx in (-1, 1) for sy in (-1, 1)]
    cuerpo = casco('Prop_Hito', pts, MAT['labrada'], disuelve=1)
    P.biselar(cuerpo, 0.018, 2, angulo=20)
    ex = Vector((1, 0, 0))
    up = Vector((0, (H['D0'] - H['D1']) / 2, H['H1'])).normalized()
    n = Vector((0, -up.z, up.y))
    O = Vector((0, -H['D0'] / 2, 0)) + up * H['centro']

    def mundo(u, v, d):
        return O + ex * u + up * v - n * d

    pw, ph, pr = H['panel']
    cartela = orientar(rect_redondo(pw, ph, pr), True)
    cort = relieve('hito_cartela', [[cartela]], mundo, -0.02, H['hondo'], -0.0036, 0.0025, MAT['labrada'])
    booleana(cuerpo, cort, 'DIFFERENCE')
    lazos = leer_runa()
    xs = [x for c in lazos for x, _ in c['pts']]
    ys = [y for c in lazos for _, y in c['pts']]
    s = H['runa_ancho'] / (max(xs) - min(xs))
    xc, yc = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    conv = [(limpiar_lazo([((x - xc) * s, -(y - yc) * s) for x, y in c['pts']], 0.003), c['hueco']) for c in lazos]
    figuras = []
    for pts2, hueco in conv:
        if not hueco:
            figuras.append([orientar(pts2, True)])
    for pts2, hueco in conv:
        if hueco:
            for fig in figuras:
                if dentro_lazo(pts2[0], fig[0]):
                    fig.append(orientar(pts2, False))
    runa = relieve('hito_runa', figuras, mundo, 0.003, H['hondo'] + 0.007, 0.0012, -0.0012, MAT['labrada'])
    booleana(cuerpo, runa, 'UNION')
    sin_normales_propias(cuerpo, 40)
    # Hondo: x = qué tan hondo bajo la cara (solo dentro de la cartela), y = la cara de la runa
    co = coords(cuerpo)
    rel = co - np.array(O)
    uu, vv, dd = rel @ np.array(ex), rel @ np.array(up), -(rel @ np.array(n))
    dentro = (np.abs(uu) < pw / 2 + 0.006) & (np.abs(vv) < ph / 2 + 0.006) & (dd > -0.001) & (dd < 0.03)
    hondo = np.where(dentro, np.clip(dd, 0, None), 0.0)
    cara_runa = (dentro & (dd > 0.0015) & (dd < 0.006)).astype(np.float32)
    atributo(cuerpo, 'Hondo', np.stack([hondo, cara_runa, np.zeros(len(co))], 1))
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    abiertas = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    anotar(f'Hito: una sola malla, {abiertas} aristas abiertas tras las booleanas; runa {RUNA} de {H["runa_ancho"] * 100:.1f} cm de ancho')
    return {'piezas': [cuerpo], 'hijos': []}


# ---------------------------------------------------------------- pedestal y binoculares

PIVOTE_Z = 1.12
BOLA_R = 0.045
CABECEO = 30


def pedestal():
    """Pedestal de piedra labrada (plinto, fuste ahusado y capitel en dos tiempos, sillares con
    junta de 1 mm), dos enredaderas que trepan pegadas a la piedra, la brida atornillada con cuatro
    pernos, el poste y la rótula; los binoculares son el hijo, con el origen en la rótula."""
    lab = MAT['labrada']
    piedra = [
        caja('ped_plinto', (0.5, 0.5, 0.14), lab, centro=(0, 0, 0.07), bisel=0.03, segmentos=2),
        caja('ped_fuste', (0.3, 0.3, 0.659), lab, centro=(0, 0, 0.141 + 0.3295), M=Matrix.Rotation(0.03, 4, 'Z'), bisel=0.035, segmentos=2, ahusado=0.84),
        caja('ped_capitel', (0.36, 0.36, 0.05), lab, centro=(0, 0, 0.801 + 0.025), M=Matrix.Rotation(-0.02, 4, 'Z'), bisel=0.015, segmentos=2),
        caja('ped_corona', (0.44, 0.44, 0.07), lab, centro=(0, 0, 0.852 + 0.035), M=Matrix.Rotation(0.015, 4, 'Z'), bisel=0.025, segmentos=2),
    ]
    tope = 0.922
    metal = [
        torno('ped_brida', [(tope + 0.0005, 0), (tope + 0.0005, 0.085), (tope + 0.016, 0.085), (tope + 0.016, 0.0)], MAT['metal'], lados=12),
        torno('ped_poste', [(tope + 0.01, 0), (tope + 0.01, 0.034), (1.045, 0.034), (1.06, 0.026), (1.06, 0.021), (1.1, 0.021), (1.1, 0)], MAT['metal'], lados=10),
        bola('ped_rotula', BOLA_R, MAT['metal'], (0, 0, PIVOTE_Z), u=10, v=6),
    ]
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        metal.append(torno(f'ped_perno_{k}', [(tope + 0.014, 0), (tope + 0.014, 0.011), (tope + 0.023, 0.011), (tope + 0.026, 0.007), (tope + 0.026, 0)],
                           MAT['metal'], lados=6, centro=(math.cos(a) * 0.062, math.sin(a) * 0.062, 0), giro=a))
    pares = [(i, j) for i in range(len(piedra)) for j in range(i + 1, len(piedra))]
    anotar(f'traspasos Pedestal entre sillares: {sum(choques([piedra[i]], [piedra[j]]) for i, j in pares)}; brida contra piedra: {choques(metal[:1], piedra)}')
    vida = enredaderas(piedra)
    cabeza = binoculares()
    transformar([cabeza], Matrix.Translation((0, 0, PIVOTE_Z)))
    fijo = piedra + metal + vida
    peor = 0
    for yaw in range(0, 360, 30):
        for pitch in (-CABECEO, -15, 0, 15, CABECEO):
            M = Matrix.Translation((0, 0, PIVOTE_Z)) @ Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Rotation(math.radians(pitch), 4, 'X') \
                @ Matrix.Translation((0, 0, -PIVOTE_Z))
            peor = max(peor, choques(fijo, [cabeza], M))
    anotar(f'traspasos Binoculares contra el pedestal en 12 giros × 5 cabeceos (±{CABECEO}°): {peor}')
    return {'piezas': fijo, 'hijos': [(cabeza, Matrix.Translation((0, 0, PIVOTE_Z)))]}


def catmull(guia, paso):
    pts = [Vector(p) for p in guia]
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
        n = max(1, int((p2 - p1).length / paso))
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return out


def afuera(p, loc, nrm):
    """La dirección de la piedra hacia el punto; si el punto quedó adentro, la normal de la cara."""
    v = p - loc
    return v.normalized() if v.length > 1e-6 and v.dot(nrm) > 0 else nrm.normalized()


def pegar(pts, arb, dist, vueltas=8):
    """Pega cada punto a la piedra a `dist[i]` de su superficie (el más cercano), suavizando entre
    vueltas; al final solo empuja hacia afuera lo que quedó más cerca (esquinas cóncavas)."""
    pts = [p.copy() for p in pts]
    fijo = [p.z < 0.004 for p in pts]
    for _ in range(vueltas):
        for i, p in enumerate(pts):
            if fijo[i]:
                continue
            loc, nrm, _, _ = arb.find_nearest(p)
            pts[i] = loc + afuera(p, loc, nrm) * dist[i]
        pts = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 if not fijo[i] else pts[i] for i in range(1, len(pts) - 1)] + [pts[-1]]
    for _ in range(8):
        for i, p in enumerate(pts):
            loc, nrm, _, d = arb.find_nearest(p)
            if d < dist[i] or (p - loc).dot(nrm) < 0:
                pts[i] = loc + afuera(p, loc, nrm) * dist[i]
    return pts


def refinar(pts, radios, arb, holgura=0.004, vueltas=5):
    """Donde un tramo recto corta una esquina de la piedra (su punto medio queda a menos del radio),
    mete ahí un punto pegado: solo junto a las esquinas, así el tallo no gasta triángulos de más."""
    pts, radios = list(pts), list(radios)
    for _ in range(vueltas):
        nuevos, nr, metio = [pts[0]], [radios[0]], False
        for i in range(len(pts) - 1):
            m = (pts[i] + pts[i + 1]) / 2
            rm = (radios[i] + radios[i + 1]) / 2
            loc, nrm, _, d = arb.find_nearest(m)
            if m.z > 0.004 and (d < rm + holgura * 0.6 or (m - loc).dot(nrm) < 0):
                nuevos.append(loc + afuera(m, loc, nrm) * (rm + holgura))
                nr.append(rm)
                metio = True
            nuevos.append(pts[i + 1])
            nr.append(radios[i + 1])
        pts, radios = nuevos, nr
        if not metio:
            break
    return pts, radios


def hoja(nombre, base, eje, normal, largo, ancho, material, grueso=0.0035):
    """Una hoja ovalada con punta: seis puntos de contorno, la vena en lomo por los dos lados y la
    punta levantada (se curva hacia afuera de la piedra)."""
    s = eje.cross(normal).normalized()
    nn = s.cross(eje).normalized()
    if nn.dot(normal) < 0:
        nn = -nn
    contorno = [(0.0, 0.0, 0.0), (0.33, 0.5, 0.03), (0.72, 0.36, 0.1), (1.0, 0.0, 0.2), (0.72, -0.36, 0.1), (0.33, -0.5, 0.03)]
    pts = [base + eje * (t * largo) + s * (w * ancho) + nn * (h * largo) for t, w, h in contorno]
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    arriba = bm.verts.new(base + eje * largo * 0.45 + nn * (grueso + largo * 0.05))
    abajo = bm.verts.new(base + eje * largo * 0.45 + nn * (largo * 0.05 - grueso * 0.6))
    n = len(vs)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vs[i], vs[j], arriba))
        bm.faces.new((vs[j], vs[i], abajo))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def enredaderas(piedra):
    """Dos enredaderas que salen del piso y trepan pegadas al pedestal (a su radio + 4 mm de la
    piedra), con hojas alternadas acostadas sobre la piedra. Las hojas que tocarían la piedra, la
    otra enredadera u otra hoja no se ponen."""
    arb = arbol(piedra)
    rnd = random.Random(SEMILLA * 5)
    planes = [  # (ángulo en grados, z, radio de la guía)
        [(-112, -0.03, 0.29), (-108, 0.06, 0.28), (-104, 0.15, 0.24), (-100, 0.17, 0.19), (-106, 0.27, 0.17), (-125, 0.38, 0.17),
         (-148, 0.5, 0.17), (-165, 0.6, 0.17), (-180, 0.68, 0.16), (-188, 0.72, 0.15)],
        [(38, -0.03, 0.34), (42, 0.07, 0.31), (48, 0.155, 0.23), (55, 0.2, 0.18), (68, 0.3, 0.17), (84, 0.42, 0.17), (96, 0.52, 0.16), (100, 0.56, 0.15)],
        # la tercera sube por atrás hasta el capitel, pasa la orilla de la corona y se acuesta arriba
        [(120, -0.03, 0.36), (122, 0.07, 0.31), (126, 0.15, 0.24), (130, 0.17, 0.19), (134, 0.3, 0.17), (128, 0.42, 0.17), (137, 0.55, 0.16),
         (133, 0.68, 0.15), (140, 0.78, 0.16), (143, 0.84, 0.2), (145, 0.88, 0.24), (146, 0.935, 0.235), (150, 0.95, 0.2), (158, 0.95, 0.175)],
    ]
    tallos, hojas = [], []
    for k, plan in enumerate(planes):
        guia = [(math.cos(math.radians(a)) * r, math.sin(math.radians(a)) * r, z) for a, z, r in plan]
        pts = catmull(guia, 0.04)
        n = len(pts)
        radios = [0.0115 - 0.0072 * (i / (n - 1)) ** 0.8 for i in range(n)]
        pts = pegar(pts, arb, [r + 0.004 for r in radios])
        pts, radios = refinar(pts, radios, arb)
        t = tubo(f'ped_tallo_{k}', pts, radios, MAT['tallo'], lados=5)
        cortar(t)
        tallos.append((t, pts, radios))
    arb_hojas = []
    for k, (t, pts, radios) in enumerate(tallos):
        otros = [tt for j, (tt, _, _) in enumerate(tallos) if j != k]
        largo = 0.0
        lado = 1 if k % 2 == 0 else -1
        proxima = 0.1
        for i in range(1, len(pts) - 1):
            largo += (pts[i] - pts[i - 1]).length
            if largo < proxima or pts[i].z < 0.03:
                continue
            tg = (pts[i + 1] - pts[i - 1]).normalized()
            loc, nrm, _, _ = arb.find_nearest(pts[i])
            s = tg.cross(nrm).normalized() * lado
            eje = (s * 0.8 + tg * 0.55)
            eje = (eje - nrm * eje.dot(nrm)).normalized()
            f = 1 - 0.4 * i / len(pts)
            h = hoja(f'ped_hoja_{k}_{i}', pts[i] + s * radios[i] * 0.4, eje, nrm, rnd.uniform(0.08, 0.105) * f, rnd.uniform(0.05, 0.065) * f, MAT['hoja'])
            if choques([h], piedra) or choques([h], otros) or any(choques([h], [o]) for o in arb_hojas):
                bpy.data.objects.remove(h, do_unlink=True)
                proxima = largo + 0.02
                continue
            arb_hojas.append(h)
            hojas.append(h)
            lado = -lado
            proxima = largo + rnd.uniform(0.035, 0.05)
    tal = [t for t, _, _ in tallos]
    anotar(f'traspasos Enredaderas: tallos contra piedra {choques(tal, piedra)}, entre tallos {sum(choques([a], [b]) for i, a in enumerate(tal) for b in tal[i + 1:])}, '
           f'{len(hojas)} hojas contra piedra {choques(hojas, piedra)}')
    return tal + hojas


def binoculares():
    """Los binoculares de moneda, armados alrededor del pivote (el origen, centro de la rótula):
    collar que abraza la rótula sin tocarla (hueco de 8 mm), cuerpo de lámina pintada, dos cubrelentes
    al frente (-Y) con la lente hundida, dos oculares con copa de hule atrás (+Y), la caja de la
    moneda arriba con la placa y su ranura de cara a quien mira, y dos manijas a los lados."""
    pz = MAT['pintado']
    piezas = [
        torno('bin_collar', [(-0.03, 0.053), (-0.03, 0.068), (0.062, 0.068), (0.062, 0.053)], pz, lados=10, cerrado=True),
        caja('bin_cuerpo', (0.27, 0.21, 0.15), pz, centro=(0, 0, 0.13), bisel=0.032, segmentos=2),
    ]
    for sx in (-1, 1):
        piezas.append(torno(f'bin_cubrelente_{sx}', [(-0.095, 0), (-0.095, 0.05), (-0.165, 0.055), (-0.185, 0.06), (-0.185, 0.046), (-0.166, 0.043), (-0.166, 0)],
                            [MAT['metal'], MAT['vidrio']], eje='Y', lados=10, centro=(sx * 0.068, 0, 0.135), mats=[0, 0, 0, 0, 0, 1]))
        piezas.append(torno(f'bin_ocular_{sx}', [(0.095, 0), (0.095, 0.026), (0.15, 0.026), (0.153, 0.031), (0.19, 0.035), (0.19, 0.022), (0.179, 0.018), (0.179, 0)],
                            [MAT['metal'], MAT['hule'], MAT['vidrio']], eje='Y', lados=8, centro=(sx * 0.056, 0, 0.145), mats=[0, 0, 1, 1, 1, 1, 2]))
        piezas.append(torno(f'bin_manija_{sx}', [(sx * 0.125, 0), (sx * 0.125, 0.015), (sx * 0.18, 0.015), (sx * 0.18, 0)], MAT['metal'], eje='X', lados=6,
                            centro=(0, 0.04, 0.12)))
        piezas.append(bola(f'bin_perilla_{sx}', 0.024, MAT['hule'], (sx * 0.195, 0.04, 0.12), u=7, v=5))
    # la caja de la moneda: cuña con la espalda inclinada hacia quien mira
    zb, zt = 0.2, 0.262
    cuna = [(sx * 0.065, y, zb) for sx in (-1, 1) for y in (-0.02, 0.085)] + [(sx * 0.06, y, zt) for sx in (-1, 1) for y in (-0.015, 0.045)]
    caja_m = casco('bin_caja', cuna, pz, disuelve=1)
    P.biselar(caja_m, 0.012, 1, angulo=30)
    piezas.append(caja_m)
    a, b = Vector((0, 0.085, zb)), Vector((0, 0.045, zt))
    upf = (b - a).normalized()
    nf = Vector((0, -upf.z, upf.y))
    if nf.y < 0:
        nf = -nf
    cf = (a + b) / 2
    base = Matrix((Vector((1, 0, 0)), nf.cross(Vector((1, 0, 0))), nf)).transposed().to_4x4()   # de mano derecha: con un espejo las cajas quedaban al revés
    placa = caja('bin_placa', (0.075, 0.044, 0.01), MAT['laton'], bisel=0.003, segmentos=1)
    transformar([placa], Matrix.Translation(cf + nf * 0.004) @ base)
    ranura = caja('bin_ranura', (0.046, 0.0095, 0.03), MAT['metal'], bisel=0)
    transformar([ranura], Matrix.Translation(cf + nf * 0.018) @ base)   # 6 mm de hondo, sin atravesar la placa
    antes = len(placa.data.polygons)
    booleana(placa, ranura, 'DIFFERENCE')
    anotar(f'Binoculares: la ranura de la moneda {"cortada" if len(placa.data.polygons) > antes else "NO se cortó"} en la placa')
    sin_normales_propias(placa, 40)
    piezas.append(placa)
    cabeza = unir(piezas, 'Prop_Binoculares')
    return cabeza


PROPS = [
    ('Prop_RocaChica', roca_chica),
    ('Prop_RocaMediana', roca_mediana),
    ('Prop_RocaGrande', roca_grande),
    ('Prop_RocaLaja', roca_laja),
    ('Prop_Montoncito', montoncito),
    ('Prop_Hito', hito),
    ('Prop_PedestalBinoculares', pedestal),
]


# ---------------------------------------------------------------- atlas

# Cuánto del atlas le toca a cada prop respecto a los demás (1 = la misma densidad): las rocas son
# casi toda la superficie y se ven de lejos; lo chico y lo que se ve de cerca, más.
DENSIDAD = {'Prop_RocaChica': 0.95, 'Prop_RocaMediana': 0.8, 'Prop_RocaGrande': 0.7, 'Prop_RocaLaja': 0.7,
            'Prop_Montoncito': 1.5, 'Prop_Hito': 1.7, 'Prop_PedestalBinoculares': 1.15, 'Prop_Binoculares': 2.0}
ABAJO = 0.06   # lo que mira al piso va enterrado o apoyado: sus islas van a esta escala


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
        nz = sum(f.normal.z * f.calc_area() for f in caras) / area
        esc = peso * (abajo if nz < -0.5 else 1.0)
        if abs(esc - 1.0) < 1e-6:
            continue
        loops = [lp for f in caras for lp in f.loops]
        c = sum((lp[uv].uv for lp in loops), Vector((0, 0))) / len(loops)
        for lp in loops:
            lp[uv].uv = c + (lp[uv].uv - c) * esc
    bm.to_mesh(o.data)
    bm.free()


def uv_atlas(objs, margen=0.004):
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
        escalar_islas(o, DENSIDAD.get(o.name, 1.0))
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
    cursor = 0.0
    props, hijos = [], []
    for k, (nombre, hacer) in enumerate(PROPS):
        d = hacer()
        prop = unir(d['piezas'], nombre)
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
        props.append(prop)
    uv_atlas(props + hijos)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    total = 0
    for o in props + hijos:
        lo, hi = caja_mundo([o])
        t = P.triangulos([o])
        total += t
        anotar(f'{o.name:26s} {hi[0] - lo[0]:.2f} x {hi[1] - lo[1]:.2f} x {hi[2] - lo[2]:.2f} m   {t} triángulos')
    anotar(f'armado: {total} triángulos en total')
    with open(os.path.join(tempfile.gettempdir(), 'props_rocas_revision.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(REVISION))


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


def _encuadrar(cam, objs, az=-28, el=22, margen=1.1, puntos=None):
    pts = puntos or []
    if not pts:
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


def _tomas(carpeta, todos, props, hijos, nombre, ext='png'):
    sc = bpy.context.scene
    cam = sc.camera
    cam.data.clip_end = 200
    sc.render.resolution_x = 900
    sc.render.resolution_y = 900
    rutas = []

    def foto(nom, grupo, az, el, margen=1.1, puntos=None):
        for o in todos:
            o.hide_render = o not in grupo
        _encuadrar(cam, grupo, az=az, el=el, margen=margen, puntos=puntos)
        ruta = os.path.join(carpeta, f'{nom}.{ext}')
        sc.render.filepath = ruta
        bpy.ops.render.render(write_still=True)
        rutas.append(ruta)

    for p in props:
        grupo = [p] + [h for h in hijos if h['padre'] == p.name]
        for i, az in enumerate((-28, 150)):
            foto(f'{p.name[5:].lower()}_{i}', grupo, az, 22)
    hito = bpy.data.objects['Prop_Hito']
    pts = [hito.matrix_world @ v.co for v in hito.data.vertices if 0.05 < (hito.matrix_world @ v.co).z < 0.43]
    foto('hito_runa_cerca', [hito], -10, 9, margen=1.0, puntos=pts)
    foto('hito_runa_lado', [hito], -42, 16, margen=0.9)
    ped = bpy.data.objects['Prop_PedestalBinoculares']
    bino = bpy.data.objects['Prop_Binoculares']
    pts = [bino.matrix_world @ v.co for v in bino.data.vertices]
    foto('binoculares_cerca', [ped, bino], -35, 24, margen=1.25, puntos=pts)
    foto('binoculares_atras', [ped, bino], 150, 30, margen=1.25, puntos=pts)
    for o in todos:
        o.hide_render = False
    return rutas


def render(carpeta):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = listar()
    todos = props + hijos
    m = P.material_final(PNG, 'Rocas_Final')
    for o in todos:
        o.data.polygons.foreach_set('material_index', [0] * len(o.data.polygons))
        o.data.materials.clear()
        o.data.materials.append(m)
    rutas = P.render_revision(todos, carpeta, 'rocas')
    rutas += _tomas(carpeta, todos, props, hijos, 'rocas')
    hoja_contacto(carpeta, [r for r in rutas if r.endswith('_0.png') and 'rocas_' not in r], 'rocas_hoja.png')
    print('render:', carpeta)


def vista(carpeta):
    """Fotos rápidas de la geometría con Workbench (sin hornear), para revisar formas."""
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = listar()
    todos = props + hijos
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_cavity = True
    for mat in bpy.data.materials:
        mat.diffuse_color = {'Rocas_Roca': (0.5, 0.47, 0.42, 1), 'Rocas_Canto': (0.55, 0.48, 0.4, 1), 'Rocas_Labrada': (0.62, 0.58, 0.5, 1),
                             'Rocas_Metal': (0.3, 0.33, 0.38, 1), 'Rocas_MetalPintado': (0.15, 0.4, 0.42, 1), 'Rocas_Vidrio': (0.05, 0.1, 0.18, 1),
                             'Rocas_Hule': (0.05, 0.05, 0.06, 1), 'Rocas_Tallo': (0.3, 0.22, 0.1, 1), 'Rocas_Hoja': (0.2, 0.5, 0.1, 1)}.get(mat.name, (0.6, 0.6, 0.6, 1))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    sc.collection.objects.link(cam)
    sc.camera = cam
    rutas = _tomas(carpeta, todos, props, hijos, 'vista')
    hoja_contacto(carpeta, [r for r in rutas if r.endswith('_0.png')], 'vista_hoja.png')
    print('vista:', carpeta)


def hoja_contacto(carpeta, rutas, nombre, columnas=4, lado=450):
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
    out.filepath_raw = os.path.join(carpeta, nombre)
    out.file_format = 'PNG'
    out.save()


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    carpeta = args[1] if len(args) > 1 else os.path.join(tempfile.gettempdir(), 'props_rocas')
    if cmd in ('armar', 'todo'):
        armar()
    if cmd == 'vista':
        vista(carpeta)
    if cmd in ('pintar', 'todo'):
        pintar()
    if cmd in ('exportar', 'todo'):
        exportar()
    if cmd in ('render', 'todo'):
        render(carpeta)
