"""Props de la pesca pintados a mano (Oscar, 2026-11-24; features.md, La instancia de pesca).

Los cuatro peces (mojarra, carpa, black bass y el black bass boca grande legendario), el señuelo de
madera, el señuelo de calaverita, lo que sale que no es pez (lata, control, calaverita de azúcar) y
la báscula colgante, con la acuarela compartida de scripts/estilo/pintura.py horneada en un solo
atlas de 2048. El toon y el contorno los pone el sitio (src/lib/pintado.js).

    "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup \
        --python scripts/estilo/props_pesca.py -- todo [carpeta_fotos] [rapido]

  armar     arma los props y sus materiales y guarda Character/Estilo_pesca.blend
  pintar    hornea el atlas (Cycles) a Character/assets/props_pesca.png
  exportar  escribe public/3dmodels/estilo/props_pesca.glb (un solo material, Draco, WebP)
  render    fotos de revisión: cada pez de lado y de tres cuartos, los señuelos de cerca, la
            basura, la báscula y el grupo
  todo      los cuatro
  `rapido` hornea a 1024 con pocas muestras (solo para probar formas).

Medidas en metros a tamaño real (el sitio multiplica por ~2.2), base en z = 0 y el frente hacia -Y.
Los peces no: van derechos a lo largo de -Y (la cabeza hacia -Y; en el GLB, que es Y arriba, hacia
+Z) con el origen en su centro de masa (su nodo va levantado para que se vean en fila) y 14 cortes a
lo largo del cuerpo, más las filas de las aletas: el sitio los hace coletear doblándolos con un
vertex shader, sin huesos.
Hijos aparte: Prop_SenueloCalaverita_Luz (los ojos de la calaverita, que brillan tantito en lo
hondo) y Prop_Bascula_Aguja (la aguja con su centro, el origen en su eje). La aguja en reposo apunta
arriba, a 0 kg; la carátula va de 0 a 12 kg en 330° en sentido de las manecillas vista de frente:
GRADOS_POR_KG. En three (frente del dial hacia +z): aguja.rotation.z = -kg * GRADOS_POR_KG.
Las calaveras (el señuelo y la calaverita de azúcar) salen de la cabeza de Skulley de
public/character.glb en reposo (cráneo y quijada, rehechos en una sola pieza y aligerados).
Si se retoca el PNG maestro a mano, basta `exportar`.
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import pintura as P  # noqa: E402

REPO = P.REPO
BLEND = os.path.join(REPO, 'Character', 'Estilo_pesca.blend')
PNG = os.path.join(REPO, 'Character', 'assets', 'props_pesca.png')
GLB = os.path.join(REPO, 'public', '3dmodels', 'estilo', 'props_pesca.glb')
PERSONAJE = os.path.join(REPO, 'public', 'character.glb')
FOTOS = os.path.join(REPO, 'scripts', 'estilo', 'renders', 'props_pesca')
TAM = 2048
SEMILLA = 23
GRADOS_POR_KG = 27.5  # 12 kg en 330°

PECES = ['Prop_Mojarra', 'Prop_Carpa', 'Prop_BlackBass', 'Prop_BassLegendario']
PROPS = PECES + ['Prop_Senuelo', 'Prop_SenueloCalaverita', 'Prop_Lata', 'Prop_Control', 'Prop_Calaverita', 'Prop_Bascula']
HIJOS = {'Prop_SenueloCalaverita': ['Prop_SenueloCalaverita_Luz'], 'Prop_Bascula': ['Prop_Bascula_Aguja']}
# Pixeles por metro de cada prop en el atlas, relativos: lo chico y lo que se ve de cerca pide más.
PESOS = {'Prop_Mojarra': 2.1, 'Prop_Carpa': 1.25, 'Prop_BlackBass': 1.35, 'Prop_BassLegendario': 1.05,
         'Prop_Senuelo': 3.2, 'Prop_SenueloCalaverita': 3.0, 'Prop_SenueloCalaverita_Luz': 2.0,
         'Prop_Lata': 2.0, 'Prop_Control': 1.9, 'Prop_Calaverita': 2.0, 'Prop_Bascula': 1.9, 'Prop_Bascula_Aguja': 2.2}

ACERO = {'oscuro': '#3b4049', 'base': '#7d8692', 'claro': '#b4bcc7', 'orilla': '#eef2f6', 'oxido': '#6a4a30'}
CROMO = {'oscuro': '#4a5059', 'base': '#9aa3ae', 'claro': '#cfd6de', 'orilla': '#ffffff', 'oxido': '#6a5a48'}
OXIDO = {'oscuro': '#2a140c', 'base': '#6a3218', 'claro': '#9a5428', 'orilla': '#c98a52', 'oxido': '#4a1e0c'}
EPS = 0.00025  # holgura entre argollas que se cuelgan una de otra


# ---------------------------------------------------------------- utilidades

def pchip(xs, ys):
    """Curva suave por puntos que no se pasa de largo (Hermite monótona)."""
    xs = np.asarray(xs, float)
    ys = np.asarray(ys, float)
    h = np.diff(xs)
    d = np.diff(ys) / h
    n = len(xs)
    m = np.zeros(n)
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        x = min(max(x, xs[0]), xs[-1])
        i = int(min(max(np.searchsorted(xs, x) - 1, 0), n - 2))
        t = (x - xs[i]) / h[i]
        return ((2 * t ** 3 - 3 * t ** 2 + 1) * ys[i] + (t ** 3 - 2 * t ** 2 + t) * h[i] * m[i]
                + (-2 * t ** 3 + 3 * t ** 2) * ys[i + 1] + (t ** 3 - t ** 2) * h[i] * m[i + 1])
    return f


def activar(o):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)


def aplicar(o, mod):
    activar(o)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def coords(o):
    co = np.empty(len(o.data.vertices) * 3, np.float32)
    o.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def transformar(objs, M):
    for o in objs:
        o.data.transform(M)


def centroide(objs):
    """Centro de masa de mallas cerradas (volumen con signo de los tetraedros)."""
    tot_v, tot_c = 0.0, np.zeros(3)
    for o in objs:
        me = o.data
        me.calc_loop_triangles()
        co = coords(o).astype(np.float64)
        tr = np.empty(len(me.loop_triangles) * 3, np.int32)
        me.loop_triangles.foreach_get('vertices', tr)
        tr = tr.reshape(-1, 3)
        a, b, c = co[tr[:, 0]], co[tr[:, 1]], co[tr[:, 2]]
        vol = np.einsum('ij,ij->i', a, np.cross(b, c)) / 6.0
        tot_v += vol.sum()
        tot_c += (vol[:, None] * (a + b + c) / 4.0).sum(0)
    return Vector(tot_c / tot_v), tot_v


def asentar(o):
    """La base del prop en z = 0, centrado en x e y. Devuelve el corrimiento que se le restó al diseño
    (lo que hay que sumarle a las coordenadas del objeto para volver a las del diseño)."""
    co = coords(o)
    t = Vector((-(co[:, 0].min() + co[:, 0].max()) / 2, -(co[:, 1].min() + co[:, 1].max()) / 2, -co[:, 2].min()))
    o.data.transform(Matrix.Translation(t))
    return -t


def arbol(objs):
    verts, caras = [], []
    for o in objs:
        base = len(verts)
        mw = o.matrix_world
        verts += [mw @ v.co for v in o.data.vertices]
        caras += [[base + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, caras) if caras else None


TRASPASOS = []


def revisar(nombre_a, A, nombre_b, B):
    """Traspasos entre dos grupos de piezas (intersección de mallas, antes de unirlas)."""
    ta, tb = arbol(A), arbol(B)
    n = len(ta.overlap(tb)) if ta and tb else 0
    TRASPASOS.append((nombre_a, nombre_b, n))
    print(f'  traspasos {nombre_a} contra {nombre_b}: {n}')
    return n


# ---------------------------------------------------------------- geometría

def tubo(nombre, puntos, radio, material, lados=6, cerrado=False, radios=None, tapas=True):
    """Un tubo que sigue una línea (alambres, barbillas, cables). `radios` da el radio en cada punto."""
    pts = [Vector(p) for p in puntos]
    n = len(pts)
    tang = []
    for i in range(n):
        if cerrado:
            a, b = pts[(i - 1) % n], pts[(i + 1) % n]
        else:
            a, b = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
        tang.append((b - a).normalized())
    ref = Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = (ref - tang[0] * ref.dot(tang[0])).normalized()
    bm = bmesh.new()
    anillos = []
    for i, p in enumerate(pts):
        t = tang[i]
        nrm = (nrm - t * nrm.dot(t)).normalized()
        bb = t.cross(nrm).normalized()
        r = radios[i] if radios else radio
        anillos.append([bm.verts.new(p + (nrm * math.cos(2 * math.pi * k / lados) + bb * math.sin(2 * math.pi * k / lados)) * r) for k in range(lados)])
    pares = list(zip(anillos, anillos[1:])) + ([(anillos[-1], anillos[0])] if cerrado else [])
    for a, b in pares:
        for k in range(lados):
            kk = (k + 1) % lados
            bm.faces.new((a[k], a[kk], b[kk], b[k]))
    if tapas and not cerrado:
        bm.faces.new(list(reversed(anillos[0])))
        bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def toro(nombre, R, r, material, centro, normal=(0, 0, 1), seg=10, lados=4, escala=(1.0, 1.0)):
    """Un aro (argollas, ojos de anzuelo): círculo de radio R en el plano perpendicular a `normal`."""
    n = Vector(normal).normalized()
    a = Vector((0, 0, 1)).cross(n)
    if a.length < 1e-6:
        a = Vector((1, 0, 0))
    a.normalize()
    b = n.cross(a).normalized()
    c = Vector(centro)
    pts = [c + (a * math.cos(2 * math.pi * i / seg) * escala[0] + b * math.sin(2 * math.pi * i / seg) * escala[1]) * R for i in range(seg)]
    return tubo(nombre, pts, r, material, lados=lados, cerrado=True)


def torno(nombre, perfil, material, lados=10, M=None):
    """Revoluciona un perfil [(r, z), ...] alrededor de Z (desde el eje por abajo, hacia afuera,
    arriba y de regreso). Un punto con r = 0 cierra en el eje. `M` lo acomoda."""
    bm = bmesh.new()
    anillos = []
    for r, z in perfil:
        if r <= 1e-7:
            anillos.append([bm.verts.new((0, 0, z))])
        else:
            anillos.append([bm.verts.new((r * math.cos(2 * math.pi * k / lados), r * math.sin(2 * math.pi * k / lados), z)) for k in range(lados)])
    for a, b in zip(anillos, anillos[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for k in range(lados):
            kk = (k + 1) % lados
            if len(a) == 1:
                bm.faces.new((a[0], b[kk], b[k]))
            elif len(b) == 1:
                bm.faces.new((a[k], a[kk], b[0]))
            else:
                bm.faces.new((a[k], a[kk], b[kk], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    if M is not None:
        o.data.transform(M)
    return o


def esfera(nombre, centro, radio, material, seg=8, anillos=5, escala=(1, 1, 1), polo_x=False):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=anillos, radius=radio)
    if polo_x:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    bmesh.ops.scale(bm, vec=escala, verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(centro), verts=bm.verts)
    return P.objeto(nombre, bm, material)


def bloque(nombre, tam, material, centro=(0, 0, 0), rot=(0, 0, 0), bisel=0.0, segmentos=1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=tam, verts=bm.verts)
    o = P.objeto(nombre, bm, material)
    if bisel:
        P.biselar(o, min(bisel, min(tam) * 0.4), segmentos=segmentos)
    P._colocar(o, centro, rot)
    return o


def placa(nombre, contorno, grueso, material, bisel=0.0, segmentos=1, angulo=40):
    """Un contorno 2D (x, y) extruido en Z de 0 a `grueso`."""
    bm = bmesh.new()
    abajo = [bm.verts.new((a, b, 0.0)) for a, b in contorno]
    arriba = [bm.verts.new((a, b, grueso)) for a, b in contorno]
    bm.faces.new(list(reversed(abajo)))
    bm.faces.new(arriba)
    m = len(contorno)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((abajo[i], abajo[j], arriba[j], arriba[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    if bisel:
        P.biselar(o, bisel, segmentos=segmentos, angulo=angulo)
    return o


def loft(nombre, anillos, material, frente=None, atras=None):
    """Une anillos (listas de puntos del mismo largo) en un cuerpo cerrado; `frente` y `atras` son
    las puntas (o None para tapar con una cara)."""
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in a] for a in anillos]
    K = len(anillos[0])
    for a, b in zip(vs, vs[1:]):
        for k in range(K):
            kk = (k + 1) % K
            bm.faces.new((a[k], a[kk], b[kk], b[k]))
    for anillo, punta in ((vs[0], frente), (vs[-1], atras)):
        if punta is None:
            bm.faces.new(anillo)
        else:
            pv = bm.verts.new(punta)
            for k in range(K):
                bm.faces.new((anillo[k], anillo[(k + 1) % K], pv))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return P.objeto(nombre, bm, material)


def poner_atributo(o, nombre, valores):
    me = o.data
    rgba = np.concatenate([np.asarray(valores, np.float32), np.ones((len(valores), 1), np.float32)], 1)
    at = me.color_attributes.get(nombre) or me.color_attributes.new(nombre, 'FLOAT_COLOR', 'POINT')
    at.data.foreach_set('color', rgba.ravel())


def lamina(nombre, Puv, us, vs, grueso, material, normal=None, rayos=8.0, afila=0.6):
    """Una lámina (aleta, cuchara) sobre una rejilla Puv(u, v), con grosor que se afila hacia v = 1.
    Lleva el atributo `Aleta` (u × rayos, v, azar) para pintar los radios y la orilla. Las filas en
    u y en v le dan vértices a lo largo del pez para que doble con el coleteo."""
    G = [[Vector(Puv(u, v)) for v in vs] for u in us]
    nU, nV = len(us), len(vs)

    def nrm(i, j):
        if normal is not None:
            return Vector(normal)
        du = G[min(i + 1, nU - 1)][j] - G[max(i - 1, 0)][j]
        dv = G[i][min(j + 1, nV - 1)] - G[i][max(j - 1, 0)]
        n = du.cross(dv)
        return n.normalized() if n.length > 1e-12 else Vector((1, 0, 0))
    bm = bmesh.new()
    F = [[None] * nV for _ in range(nU)]
    B = [[None] * nV for _ in range(nU)]
    attr = []
    azar = random.random()
    for i in range(nU):
        for j in range(nV):
            n = nrm(i, j)
            g = grueso * (1 - afila * vs[j])
            F[i][j] = bm.verts.new(G[i][j] + n * g / 2)
            attr.append((us[i] * rayos, vs[j], azar))
            B[i][j] = bm.verts.new(G[i][j] - n * g / 2)
            attr.append((us[i] * rayos, vs[j], azar))
    for i in range(nU - 1):
        for j in range(nV - 1):
            bm.faces.new((F[i][j], F[i + 1][j], F[i + 1][j + 1], F[i][j + 1]))
            bm.faces.new((B[i][j + 1], B[i + 1][j + 1], B[i + 1][j], B[i][j]))
    borde = [(i, 0) for i in range(nU)] + [(nU - 1, j) for j in range(1, nV)] + \
            [(i, nV - 1) for i in range(nU - 2, -1, -1)] + [(0, j) for j in range(nV - 2, 0, -1)]
    for k in range(len(borde)):
        a, b = borde[k], borde[(k + 1) % len(borde)]
        bm.faces.new((F[a[0]][a[1]], F[b[0]][b[1]], B[b[0]][b[1]], B[a[0]][a[1]]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = P.objeto(nombre, bm, material)
    poner_atributo(o, 'Aleta', attr)
    return o


def restar(o, cortador, material_corte=None):
    """Boolean: le quita `cortador` a `o`; las caras nuevas toman el material del cortador."""
    if material_corte is not None:
        cortador.data.materials.clear()
        cortador.data.materials.append(material_corte)
    m = o.modifiers.new('resta', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.solver = 'EXACT'
    m.object = cortador
    try:
        m.material_mode = 'TRANSFER'
    except Exception:
        pass
    aplicar(o, m)
    bpy.data.objects.remove(cortador, do_unlink=True)


def unir(objs, nombre, angulo=40):
    o = P.unir(objs, nombre)
    if angulo != 35:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angulo))
    return o


# ---------------------------------------------------------------- herrajes

def armella(prefijo, base, direccion, R, r, material, normal, entra=0.006):
    """Armella (ojo de tornillo): el aro afuera de la superficie en `direccion` y el vástago metido
    en la pieza. Devuelve las piezas y el centro del aro."""
    d = Vector(direccion).normalized()
    c = Vector(base) + d * (R + r + 0.0003)
    pz = [toro(f'{prefijo}_aro', R, r, material, c, normal=normal, seg=8, lados=4)]
    pz.append(tubo(f'{prefijo}_vastago', [c - d * (R - r * 0.5), Vector(base) - d * entra], r * 1.1, material, lados=5))
    return pz, c


def colgante(c_arriba, R_arriba, r_arriba, R, r):
    """Centro de un aro que cuelga de otro (planos perpendiculares): su alambre de arriba descansa
    sobre el de abajo del otro con una holgura."""
    return Vector(c_arriba) - Vector((0, 0, R_arriba + R - r_arriba - r - EPS))


def anzuelo(prefijo, ojo, normal_ojo, material, puntas=3, R_ojo=0.0022, r=0.00075, largo=0.013,
            curva=0.0036, punta=0.0062, giro=0.0, dir_punta=(0, -1, 0), lados=4):
    """Un anzuelo colgando de su ojo (centro `ojo`): sencillo (la punta hacia `dir_punta`) o
    triple. Devuelve las piezas y lo más bajo."""
    c_ojo = Vector(ojo)
    pz = [toro(f'{prefijo}_ojo', R_ojo, r, material, c_ojo, normal=normal_ojo, seg=8, lados=lados)]
    top = c_ojo - Vector((0, 0, R_ojo))
    fondo = top - Vector((0, 0, largo))
    pz.append(tubo(f'{prefijo}_cana', [top + Vector((0, 0, r * 0.6)), fondo], r * (1.25 if puntas == 3 else 1.0), material, lados=lados + 1))
    if puntas == 3:
        dirs = [Vector((math.cos(giro + k * 2 * math.pi / 3), math.sin(giro + k * 2 * math.pi / 3), 0)) for k in range(3)]
    else:
        dirs = [Vector(dir_punta).normalized()]
    for k, d in enumerate(dirs):
        c = fondo + d * curva
        pts = [c - d * curva * math.cos(s) - Vector((0, 0, curva * math.sin(s))) for s in np.linspace(0, math.pi, 7)]
        fin = c + d * curva * 0.78 + Vector((0, 0, punta))
        pts += [c + d * curva * 0.95 + Vector((0, 0, punta * 0.5)), fin]
        radios = [r] * 7 + [r * 0.85, r * 0.22]
        pz.append(tubo(f'{prefijo}_punta{k}', pts, r, material, lados=lados, radios=radios))
        b0 = fin - Vector((0, 0, punta * 0.36)) - d * curva * 0.02
        b1 = b0 - d * curva * 0.4 - Vector((0, 0, punta * 0.2))
        pz.append(tubo(f'{prefijo}_rebaba{k}', [b0 + d * r * 0.4, b1], r * 0.75, material, lados=3, radios=[r * 0.75, r * 0.15]))
    return pz, fondo.z - curva - r


# ---------------------------------------------------------------- los peces

EST = [0.025, 0.07, 0.13, 0.2, 0.28, 0.37, 0.46, 0.55, 0.64, 0.73, 0.82, 0.9, 0.96, 1.0]  # 14 cortes

PEZ = {
    'mojarra': dict(
        nombre='Prop_Mojarra', L=0.2, lb=0.8, K=10, panza=0.1, cresta=0.3,
        perfil=[(0.0, 0.0, 0.0, 0.0), (0.025, 0.034, -0.03, 0.02), (0.07, 0.078, -0.066, 0.038), (0.13, 0.125, -0.103, 0.052),
                (0.22, 0.176, -0.145, 0.062), (0.34, 0.208, -0.172, 0.067), (0.46, 0.212, -0.176, 0.066), (0.58, 0.19, -0.156, 0.059),
                (0.7, 0.145, -0.115, 0.047), (0.81, 0.096, -0.074, 0.035), (0.91, 0.064, -0.049, 0.026), (1.0, 0.053, -0.041, 0.022)],
        nariz=0.006, boca_t=0.1, boca_z=-0.006, boca_abre=30, mandibula=0.012,
        ojo=dict(t=0.125, z=0.052, r=0.034),
        opercula=dict(t=0.24, z=0.0, r=0.12),
        dorsal=dict(t=(0.3, 0.86), alto=[(0, 0.06), (0.1, 0.1), (0.5, 0.088), (0.66, 0.11), (0.86, 0.125), (1.0, 0.03)],
                    espinas=9, frac=0.52, prof=0.32, inclina=0.35, nu_suave=6, nv=2, rayos=16),
        anal=dict(t=(0.6, 0.87), alto=[(0, 0.05), (0.3, 0.07), (0.72, 0.105), (1.0, 0.03)], espinas=3, frac=0.3, prof=0.3,
                  inclina=0.45, nu_suave=5, nv=2, rayos=10),
        caudal=dict(mete=0.035, base=0.85, borde=[(0, 0.215, 0.125), (0.25, 0.19, 0.06), (0.5, 0.172, 0.0), (0.75, 0.19, -0.06), (1, 0.215, -0.125)],
                    nu=8, nv=3, rayos=14),
        pectoral=dict(t=0.27, z=-0.025, base=0.05, largo=0.15, abre=28, cae=12, abanico=0.6, nu=3, nv=3, rayos=8),
        pelvica=dict(t=0.34, largo=0.11, base=0.04, abre=30, cae=55, nu=2, nv=2, rayos=5),
        grueso=0.0075,
    ),
    'carpa': dict(
        nombre='Prop_Carpa', L=0.6, lb=0.78, K=12, panza=0.12, cresta=0.25,
        perfil=[(0.0, 0.0, 0.0, 0.0), (0.025, 0.032, -0.032, 0.025), (0.07, 0.062, -0.06, 0.045), (0.13, 0.097, -0.083, 0.063),
                (0.22, 0.133, -0.102, 0.077), (0.34, 0.157, -0.113, 0.084), (0.46, 0.156, -0.111, 0.082), (0.58, 0.133, -0.096, 0.072),
                (0.7, 0.099, -0.072, 0.057), (0.81, 0.068, -0.051, 0.041), (0.91, 0.051, -0.04, 0.031), (1.0, 0.046, -0.036, 0.027)],
        nariz=-0.014, boca_t=0.06, boca_z=-0.024, boca_abre=30, mandibula=-0.006, escala_perfil=(1.16, 1.1, 1.06),
        ojo=dict(t=0.105, z=0.03, r=0.024),
        opercula=dict(t=0.2, z=-0.005, r=0.1),
        dorsal=dict(t=(0.4, 0.79), alto=[(0, 0.105), (0.07, 0.125), (0.22, 0.085), (0.6, 0.066), (0.92, 0.055), (1.0, 0.02)],
                    espinas=0, inclina=0.22, nu_suave=12, nv=2, rayos=18),
        anal=dict(t=(0.735, 0.835), alto=[(0, 0.075), (0.3, 0.085), (1.0, 0.02)], espinas=0, inclina=0.45, nu_suave=5, nv=2, rayos=7),
        caudal=dict(mete=0.035, base=0.85, borde=[(0, 0.255, 0.13), (0.2, 0.205, 0.075), (0.5, 0.135, 0.0), (0.8, 0.205, -0.075), (1, 0.255, -0.13)],
                    nu=10, nv=4, rayos=18),
        pectoral=dict(t=0.215, z=-0.065, base=0.035, largo=0.11, abre=32, cae=28, abanico=0.5, nu=3, nv=3, rayos=9),
        pelvica=dict(t=0.44, largo=0.09, base=0.035, abre=30, cae=50, nu=2, nv=2, rayos=6),
        grueso=0.0065, barbillas=True,
    ),
    'bass': dict(
        nombre='Prop_BlackBass', L=0.5, lb=0.8, K=12, panza=0.1, cresta=0.25,
        perfil=[(0.0, 0.0, 0.0, 0.0), (0.025, 0.028, -0.03, 0.02), (0.07, 0.055, -0.056, 0.039), (0.13, 0.084, -0.079, 0.053),
                (0.22, 0.109, -0.095, 0.063), (0.34, 0.121, -0.1, 0.067), (0.46, 0.119, -0.097, 0.065), (0.58, 0.105, -0.084, 0.058),
                (0.7, 0.081, -0.064, 0.046), (0.81, 0.06, -0.047, 0.035), (0.91, 0.048, -0.038, 0.028), (1.0, 0.044, -0.034, 0.025)],
        nariz=0.006, boca_t=0.2, boca_z=-0.014, boca_abre=17, mandibula=0.02, escala_perfil=(1.14, 1.14, 1.06),
        ojo=dict(t=0.125, z=0.038, r=0.025),
        opercula=dict(t=0.25, z=0.0, r=0.1),
        dorsal=dict(t=(0.3, 0.79), alto=[(0, 0.03), (0.07, 0.078), (0.26, 0.07), (0.4, 0.038), (0.46, 0.022), (0.52, 0.064), (0.64, 0.08), (0.88, 0.068), (1.0, 0.02)],
                    espinas=10, frac=0.46, prof=0.36, inclina=0.25, nu_suave=8, nv=2, rayos=13),
        anal=dict(t=(0.66, 0.845), alto=[(0, 0.04), (0.22, 0.066), (0.62, 0.07), (1.0, 0.02)], espinas=3, frac=0.25, prof=0.3,
                  inclina=0.4, nu_suave=5, nv=2, rayos=10),
        caudal=dict(mete=0.035, base=0.85, borde=[(0, 0.232, 0.112), (0.25, 0.2, 0.06), (0.5, 0.186, 0.0), (0.75, 0.2, -0.06), (1, 0.232, -0.112)],
                    nu=10, nv=4, rayos=17),
        pectoral=dict(t=0.25, z=-0.025, base=0.035, largo=0.1, abre=30, cae=18, abanico=0.55, nu=3, nv=3, rayos=9),
        pelvica=dict(t=0.3, largo=0.09, base=0.035, abre=30, cae=55, nu=2, nv=2, rayos=6),
        grueso=0.006,
    ),
}
# El legendario: el black bass viejo y pesado (más panza, más ancho), boca más grande y abierta,
# aletas mordidas y el señuelo viejo colgado del labio.
_bass = PEZ['bass']
PEZ['legendario'] = dict(
    _bass, nombre='Prop_BassLegendario', L=0.9, escala_perfil=(1.22, 1.34, 1.2),
    nariz=0.004, boca_t=0.22, boca_z=-0.02, boca_abre=24, mandibula=0.026,
    ojo=dict(t=0.128, z=0.042, r=0.021),
    dorsal=dict(_bass['dorsal'], mordidas=[(0.33, 0.05, 0.65), (0.78, 0.06, 0.55)]),
    anal=dict(_bass['anal'], mordidas=[(0.55, 0.12, 0.45)]),
    caudal=dict(_bass['caudal'], mordidas=[(0.2, 0.07, 0.4), (0.62, 0.05, 0.55), (0.88, 0.04, 0.3)]),
    pectoral=dict(_bass['pectoral'], mordidas=[(0.6, 0.18, 0.35)]),
    grueso=0.0055, senuelo_viejo=True,
)


class Perfil:
    def __init__(self, cfg):
        p = cfg['perfil']
        ts = [x[0] for x in p]
        L = cfg['L']
        ka, kb, kw = cfg.get('escala_perfil', (1.0, 1.0, 1.0))
        self.L = L
        self.Lb = cfg['lb'] * L
        self._top = pchip(ts, [x[1] * L * ka for x in p])
        self._bot = pchip(ts, [x[2] * L * kb for x in p])
        self._w = pchip(ts, [x[3] * L * kw for x in p])

    def top(self, t):
        return float(self._top(t))

    def bot(self, t):
        return float(self._bot(t))

    def w(self, t):
        return float(self._w(t))


def anillo_pez(y, top, bot, w, K, cresta, panza):
    zc, h = (top + bot) / 2, (top - bot) / 2
    pts = []
    for j in range(K):
        th = 2 * math.pi * j / K
        c, s = math.cos(th), math.sin(th)
        x = w * s * (1 - panza * c) * (1 - cresta * max(c, 0.0) ** 3)
        pts.append(Vector((x, y, zc + h * c)))
    return pts


def aleta_mediana(nombre, a, pf, mat, grueso, abajo=False):
    """Dorsal o anal: base sobre el lomo (o la panza), alto por puntos, espinas y mordidas."""
    L, Lb = pf.L, pf.Lb
    t0, t1 = a['t']
    alto = pchip([x[0] for x in a['alto']], [x[1] * L for x in a['alto']])
    n_esp = a.get('espinas', 0)
    frac = a.get('frac', 0.0) if n_esp else 0.0
    us = []
    if n_esp:
        us += [frac * k / (2 * n_esp) for k in range(2 * n_esp)]
    ns = a.get('nu_suave', 8)
    us += [frac + (1 - frac) * k / ns for k in range(ns + 1)]
    vs = [k / a.get('nv', 2) for k in range(a.get('nv', 2) + 1)]

    def h(u):
        hh = float(alto(u))
        if n_esp and u < frac:
            q = u / frac * n_esp
            hh *= 1 - a.get('prof', 0.3) * (0.5 - 0.5 * math.cos(2 * math.pi * q))
        for u0, an, pr in a.get('mordidas', []):
            x = (u - u0) / an
            if abs(x) < 1:
                hh *= 1 - pr * math.sqrt(1 - x * x)
        return max(hh, 0.002 * L)

    def Puv(u, v):
        t = t0 + (t1 - t0) * u
        y = t * Lb
        if abajo:
            b = Vector((0, y, pf.bot(t) + 0.01 * L))
        else:
            b = Vector((0, y, pf.top(t) - 0.01 * L))
        hh = h(u) + 0.01 * L
        s = -1 if abajo else 1
        return b + Vector((0, a.get('inclina', 0.3) * hh * v, s * hh * v))
    return lamina(nombre, Puv, us, vs, grueso, mat, normal=(1, 0, 0), rayos=a.get('rayos', 10))


def aleta_caudal(nombre, a, pf, mat, grueso):
    L, Lb = pf.L, pf.Lb
    yb = Lb - a.get('mete', 0.03) * L
    tb = yb / Lb
    zc = (pf.top(tb) + pf.bot(tb)) / 2
    hp = (pf.top(tb) - pf.bot(tb)) / 2 * a.get('base', 0.85)
    bu = [x[0] for x in a['borde']]
    dy = pchip(bu, [x[1] * L for x in a['borde']])
    dz = pchip(bu, [x[2] * L for x in a['borde']])
    nu, nv = a.get('nu', 10), a.get('nv', 4)
    us = [k / nu for k in range(nu + 1)]
    vs = [k / nv for k in range(nv + 1)]

    def Puv(u, v):
        base = Vector((0, yb, zc + hp * (1 - 2 * u)))
        borde = Vector((0, yb + float(dy(u)), zc + float(dz(u))))
        f = 1.0
        for u0, an, pr in a.get('mordidas', []):
            x = (u - u0) / an
            if abs(x) < 1:
                f *= 1 - pr * math.sqrt(1 - x * x)
        borde = base + (borde - base) * f
        return base + (borde - base) * v
    return lamina(nombre, Puv, us, vs, grueso, mat, normal=(1, 0, 0), rayos=a.get('rayos', 14))


def superficie_x(bvh, y, z, lado, L):
    """Dónde está la piel del pez a los lados en (y, z)."""
    h = bvh.ray_cast(Vector((lado * L, y, z)), Vector((-lado, 0, 0)))
    return h[0] if h[0] is not None else Vector((0, y, z))


def aleta_par(nombre, a, pf, bvh, lado, mat, grueso, pelvica=False):
    L, Lb = pf.L, pf.Lb
    t = a['t']
    y0 = t * Lb
    nu, nv = a.get('nu', 3), a.get('nv', 3)
    us = [k / nu for k in range(nu + 1)]
    vs = [k / nv for k in range(nv + 1)]
    ab, cae = math.radians(a.get('abre', 30)), math.radians(a.get('cae', 20))
    d = Vector((lado * math.sin(ab), math.cos(ab) * math.cos(cae), -math.sin(cae))).normalized()
    largo = a['largo'] * L
    perfil_largo = pchip([0, 0.35, 1], [0.7, 1.0, 0.75])
    bases = []
    for u in us:
        if pelvica:
            yy = y0 + a.get('base', 0.03) * L * u
            tt = yy / Lb
            p = Vector((lado * pf.w(tt) * 0.28, yy, pf.bot(tt) + 0.006 * L))
        else:
            zz = a['z'] * L + a.get('base', 0.04) * L * (0.5 - u)
            yy = y0 + 0.01 * L * u
            p = superficie_x(bvh, yy, zz, lado, L) - Vector((lado * 0.004 * L, 0, 0))
        bases.append(p)
    arriba = Vector((0, 0, 1)) if not pelvica else Vector((lado, 0, 0))
    eje = (arriba - d * arriba.dot(d)).normalized()

    def Puv(u, v):
        i = min(int(round(u * nu)), nu)
        b = bases[i]
        ll = largo * float(perfil_largo(u))
        for u0, an, pr in a.get('mordidas', []):
            x = (u - u0) / an
            if abs(x) < 1:
                ll *= 1 - pr * math.sqrt(1 - x * x)
        e = b + d * ll + eje * (0.5 - u) * a.get('abanico', 0.15 if pelvica else 0.5) * largo
        return b + (e - b) * v
    return lamina(nombre, Puv, us, vs, grueso, mat, rayos=a.get('rayos', 8))


def pez(clave, M):
    """Arma un pez en coordenadas de diseño (la nariz en y = 0, la cola hacia +y), lo deja con el
    origen en su centro de masa y devuelve (objeto, centro de masa en el diseño, perfil)."""
    cfg = PEZ[clave]
    pf = Perfil(cfg)
    L, Lb, K = pf.L, pf.Lb, cfg['K']
    mats = M[clave]
    anillos = [anillo_pez(t * Lb, pf.top(t), pf.bot(t), pf.w(t), K, cfg['cresta'], cfg['panza']) for t in EST]
    nariz = Vector((0, 0, cfg['nariz'] * L))
    cola = Vector((0, Lb + 0.004 * L, (pf.top(1) + pf.bot(1)) / 2))
    cuerpo = loft(f'{clave}_cuerpo', anillos, mats['cuerpo'], frente=nariz, atras=cola)
    # la quijada de abajo se adelanta (o se queda atrás en la carpa)
    yg, zg, zm = cfg['boca_t'] * Lb, cfg['boca_z'] * L, cfg['nariz'] * L
    me = cuerpo.data
    for v in me.vertices:
        if v.co.y < yg:
            zl = zm + (zg - zm) * (v.co.y / yg)
            if v.co.z < zl:
                v.co.y -= cfg['mandibula'] * L * (1 - v.co.y / yg) ** 1.5
    # la boca: una cuña quitada de la cabeza, abierta
    ang = math.radians(cfg['boca_abre'])
    yf = -0.08 * L
    pend = (zm - zg) / (0 - yg)

    def zc(y, s):
        return zg + (y - yg) * pend + s * math.tan(ang / 2) * (yg - y)
    X = L
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((-X, yg, zg), (X, yg, zg), (-X, yf, zc(yf, 1)), (X, yf, zc(yf, 1)), (-X, yf, zc(yf, -1)), (X, yf, zc(yf, -1)))]
    for f in ((0, 2, 4), (1, 5, 3), (0, 1, 3, 2), (0, 4, 5, 1), (2, 3, 5, 4)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cuna = P.objeto(f'{clave}_cuna', bm, None)
    restar(cuerpo, cuna, M['boca'])
    bpy.context.view_layer.update()
    bvh = arbol([cuerpo])
    pz = [cuerpo]
    # ojos: medio salidos de la piel
    o = cfg['ojo']
    ye, ze, re = o['t'] * Lb, o['z'] * L, o['r'] * L
    for lado in (1, -1):
        hpt = superficie_x(bvh, ye, ze, lado, L)
        c = Vector((hpt.x - lado * re * 0.28, ye, ze))
        pz.append(esfera(f'{clave}_ojo', c, re, mats['ojo'], seg=10 if L > 0.3 else 8, anillos=6 if L > 0.3 else 5,
                         escala=(0.62, 1, 1), polo_x=True))
    g = cfg['grueso'] * L
    aletas = []
    aletas.append(aleta_mediana(f'{clave}_dorsal', cfg['dorsal'], pf, mats['aleta'], g))
    aletas.append(aleta_mediana(f'{clave}_anal', cfg['anal'], pf, mats['aleta'], g * 0.9, abajo=True))
    aletas.append(aleta_caudal(f'{clave}_caudal', cfg['caudal'], pf, mats['aleta'], g))
    pares = {}
    for lado in (1, -1):
        pares.setdefault('pectoral', []).append(aleta_par(f'{clave}_pectoral', cfg['pectoral'], pf, bvh, lado, mats['aleta'], g * 0.8))
        pares.setdefault('pelvica', []).append(aleta_par(f'{clave}_pelvica', cfg['pelvica'], pf, bvh, lado, mats['aleta'], g * 0.8, pelvica=True))
    revisar(f'{clave}: pectorales', pares['pectoral'], 'pélvicas y anal', pares['pelvica'] + [aletas[1]])
    revisar(f'{clave}: pélvicas', pares['pelvica'], 'anal', [aletas[1]])
    pz += aletas + pares['pectoral'] + pares['pelvica']
    if cfg.get('barbillas'):
        pz += barbillas(clave, pf, cfg, mats['barbilla'], bvh)
    if cfg.get('senuelo_viejo'):
        viejo = senuelo_viejo(clave, pf, cfg, M, bvh, cuerpo)
        revisar(f'{clave}: cuchara, argollas y sedal', [x for x in viejo if 'anzuelo' not in x.name], 'cuerpo y aletas', pz)
        revisar(f'{clave}: anzuelo viejo (clavado en el labio, a propósito)', [x for x in viejo if '_anzuelo' in x.name and '_ojo' not in x.name], 'cuerpo', [cuerpo])
        revisar(f'{clave}: ojo del anzuelo viejo', [x for x in viejo if '_anzuelo_ojo' in x.name], 'cuerpo y aletas', pz)
        pz += viejo
    obj = unir(pz, cfg['nombre'], angulo=40)
    c, vol = centroide([obj])
    obj.data.transform(Matrix.Translation(-c))
    print(f'  {cfg["nombre"]}: volumen {vol * 1000:.2f} L, centro de masa en el diseño {tuple(round(x, 4) for x in c)}')
    return obj, c, pf


def barbillas(clave, pf, cfg, mat, bvh):
    """Las barbillas de la carpa: dos pares, en la comisura y en el labio de arriba, que cuelgan."""
    L, Lb = pf.L, pf.Lb
    pz = []
    yg, zg = cfg['boca_t'] * Lb, cfg['boca_z'] * L
    for lado in (1, -1):
        for k, (dy, dz, largo, r) in enumerate(((0.0, 0.006, 0.055, 0.0065), (-0.024, 0.014, 0.034, 0.0055))):
            y0 = yg + dy * L
            z0 = zg + dz * L
            p0 = superficie_x(bvh, y0, z0, lado, L) - Vector((lado * 0.006 * L, 0, 0))
            pts = [p0]
            for s in np.linspace(0.25, 1.0, 4):
                pts.append(p0 + Vector((lado * 0.3 * s * largo * L, (-0.3 * s + 0.65 * s * s) * largo * L, -s * largo * L)))
            radios = [r * L * (1 - 0.6 * i / (len(pts) - 1)) for i in range(len(pts))]
            pz.append(tubo(f'{clave}_barbilla{k}', pts, r * L, mat, lados=4, radios=radios))
    return pz


def senuelo_viejo(clave, pf, cfg, M, bvh, cuerpo):
    """Un señuelo de cuchara viejo y oxidado colgado del labio de abajo: su anzuelo se quedó clavado
    en el labio (de afuera hacia adentro de la boca), la cuchara cuelga de una argolla y de su otra
    punta sale el pedazo de sedal que reventó."""
    L, Lb = pf.L, pf.Lb
    yg, zg, zm = cfg['boca_t'] * Lb, cfg['boca_z'] * L, cfg['nariz'] * L
    # la barbilla y el labio de abajo
    z_boca = zm - 0.004 * L
    h = bvh.ray_cast(Vector((0, -L, z_boca - 0.035 * L)), Vector((0, 1, 0)))
    y_barba = h[0].y
    y_labio = y_barba + 0.03 * L
    pend = (zm - zg) / (0 - yg)
    z_cen = zg + (y_labio - yg) * pend
    h2 = bvh.ray_cast(Vector((0, y_labio, z_cen)), Vector((0, 0, -1)))
    z_labio = h2[0].z if h2[0] is not None else z_cen - 0.01 * L
    ox, mat_c, mat_s = M['oxidado'], M['cuchara'], M['sedal']
    pz = []
    r = 0.0016
    # el anzuelo: el ojo abajo, frente a la barbilla; la caña sube y la curva entra por el labio
    y_s = y_barba - 0.006
    z_curva = z_labio - 0.011
    rb = 0.0105
    R_ojo = 0.0045
    h3 = bvh.ray_cast(Vector((0, y_barba + 0.012, -L)), Vector((0, 0, 1)))
    z_barba = h3[0].z if h3[0] is not None else z_labio - 0.03
    c_ojo = Vector((0, y_s, min(z_barba, z_curva - 0.022) - R_ojo - 0.004))
    pz.append(toro(f'{clave}_anzuelo_ojo', R_ojo, r, ox, c_ojo, normal=(1, 0, 0), seg=8, lados=4))
    camino = [c_ojo + Vector((0, 0, R_ojo - r * 0.5)), Vector((0, y_s, z_curva))]
    centro = Vector((0, y_s + rb, z_curva))
    for s in np.linspace(0, math.pi, 8)[1:]:
        camino.append(centro + Vector((0, -rb * math.cos(s), rb * math.sin(s))))
    fin = centro + Vector((0, rb * 0.85, -0.016))
    camino += [centro + Vector((0, rb * 0.97, -0.008)), fin]
    radios = [r] * (len(camino) - 2) + [r * 0.85, r * 0.25]
    pz.append(tubo(f'{clave}_anzuelo', camino, r, ox, lados=4, radios=radios))
    b0 = fin + Vector((0, -0.0004, 0.006))
    pz.append(tubo(f'{clave}_anzuelo_rebaba', [b0, b0 + Vector((0, -0.003, 0.0035))], r * 0.8, ox, lados=3, radios=[r * 0.8, r * 0.2]))
    # la argolla que une el ojo del anzuelo con la punta de arriba de la cuchara
    R_a, r_a = 0.0062, 0.0011
    c_a = colgante(c_ojo, R_ojo, r, R_a, r_a)
    pz.append(toro(f'{clave}_argolla', R_a, r_a, ox, c_a, normal=(0, 1, 0), seg=10, lados=4))
    # la cuchara: lámina con su panza hacia +x, colgada por su agujero de arriba
    largo, ancho, hondo, gr = 0.085, 0.032, 0.007, 0.0016
    r_hoyo = 0.0026
    z_hoyo = c_a.z - R_a + r_a + EPS - r_hoyo + 0.0002
    z0 = z_hoyo + r_hoyo + 0.004

    def Puv(u, v):
        w = ancho / 2 * math.sin(math.pi * (0.04 + 0.92 * v)) ** 0.65 * (1.12 - 0.5 * v)
        s = 2 * u - 1
        # la panza; plana en las puntas, donde van los agujeros
        x = hondo * (1 - s * s) * math.sin(math.pi * min(1.0, max(0.0, (v - 0.13) / 0.74))) ** 0.8
        return Vector((x, s * w, z0 - largo * v))
    cuchara = lamina(f'{clave}_cuchara', Puv, [k / 6 for k in range(7)], [k / 12 for k in range(13)], gr, mat_c, afila=0.0, rayos=1)
    cuchara.data.attributes.remove(cuchara.data.attributes['Aleta'])
    for zz in (z_hoyo, z0 - largo + 0.0065):
        hoyo = torno('hoyo', [(0, -0.02), (r_hoyo, -0.02), (r_hoyo, 0.02), (0, 0.02)], None, lados=8,
                     M=Matrix.Translation((0, 0, zz)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'))
        restar(cuchara, hoyo, mat_c)
    pz.append(cuchara)
    # abajo: otra argolla y el pedazo de sedal que reventó, con la punta deshilachada
    z_hoyo2 = z0 - largo + 0.0065
    R_b, r_b = 0.006, 0.001
    c_b = Vector((0, 0, z_hoyo2 - r_hoyo + r_b + EPS - R_b + 0.0004))
    pz.append(toro(f'{clave}_argolla2', R_b, r_b, ox, c_b, normal=(0, 1, 0), seg=10, lados=4))
    # el sedal amarrado en un lazo a la argolla, y lo que quedó de él
    R_l, r_l = 0.0024, 0.0007
    c_l = colgante(c_b, R_b, r_b, R_l, r_l)
    lazo = toro(f'{clave}_lazo', R_l, r_l, mat_s, c_l, normal=(1, 0, 0), seg=8, lados=4)
    pz.append(lazo)
    s0 = c_l - Vector((0, 0, R_l - r_l * 0.5))
    sedal = [s0, s0 + Vector((0.003, 0.01, -0.012)), s0 + Vector((0.005, 0.028, -0.019)), s0 + Vector((0.004, 0.048, -0.021)), s0 + Vector((0.0, 0.064, -0.029))]
    pz.append(tubo(f'{clave}_sedal', sedal, 0.0008, mat_s, lados=4))
    for k in range(3):
        a = k * 2.1
        q = sedal[-1]
        pz.append(tubo(f'{clave}_hebra{k}', [q, q + Vector((0.004 * math.cos(a), 0.008, -0.004 + 0.004 * math.sin(a)))], 0.0005, mat_s, lados=3))
    def nom(*pref):
        return [x for x in pz if x.name.split('.')[0].endswith(pref)]
    revisar(f'{clave}: argolla de arriba', nom('_argolla'), 'ojo del anzuelo', nom('_anzuelo_ojo'))
    revisar(f'{clave}: cuchara', [cuchara], 'argollas, anzuelo y lazo', nom('_argolla', '_argolla2', '_anzuelo_ojo', '_lazo'))
    revisar(f'{clave}: lazo del sedal', nom('_lazo'), 'argolla de abajo', nom('_argolla2'))
    return pz


# ---------------------------------------------------------------- la cabeza de Skulley

def cabeza_skulley():
    """La cabeza de Skulley en reposo desde public/character.glb: cráneo y quijada rehechos en una
    sola pieza cerrada (remesh de voxel). Devuelve el objeto (en las medidas del personaje, la
    cara hacia -Y) y los centros de sus ojos."""
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=PERSONAJE)
    nuevos = [o for o in bpy.data.objects if o not in antes]
    arm = next(o for o in nuevos if o.type == 'ARMATURE')
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    piezas = []
    for n in ('Skull071', 'Egg_Jaw'):
        o = bpy.data.objects[n]
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        ob = bpy.data.objects.new('cabeza_' + n, me)
        bpy.context.scene.collection.objects.link(ob)
        piezas.append(ob)
    ojos = []
    for n in ('Skull043', 'Skull044'):
        o = bpy.data.objects[n]
        me = o.evaluated_get(dg).to_mesh()
        pts = [o.matrix_world @ v.co for v in me.vertices]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        r = (hi.x - lo.x) / 2
        ojos.append((Vector(((lo.x + hi.x) / 2, lo.y + r, (lo.z + hi.z) / 2)), r, lo.y))
        o.evaluated_get(dg).to_mesh_clear()
    for o in nuevos:
        bpy.data.objects.remove(o, do_unlink=True)
    # fuera todo lo que trajo el GLB (aquí todavía no hay nada propio)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    for coleccion in (bpy.data.actions, bpy.data.armatures, bpy.data.images, bpy.data.textures):
        for d in list(coleccion):
            coleccion.remove(d)
    for p_ in piezas:
        p_.data.materials.clear()
    for d in list(bpy.data.materials):
        bpy.data.materials.remove(d)
    activar(piezas[0])
    piezas[1].select_set(True)
    bpy.ops.object.join()
    c = bpy.context.view_layer.objects.active
    c.name = 'cabeza_fuente'
    r = c.modifiers.new('voxel', 'REMESH')
    r.mode = 'VOXEL'
    r.voxel_size = 0.0065
    r.adaptivity = 0.0
    aplicar(c, r)
    return c, ojos


def cabeza_copia(fuente, nombre, caras, escala, material):
    """Una copia de la cabeza, aligerada a `caras` triángulos y a su tamaño (centrada en el
    origen del personaje: CENTRO_CABEZA)."""
    me = fuente.data.copy()
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    n0 = len(me.polygons)
    d = o.modifiers.new('aligera', 'DECIMATE')
    d.ratio = caras / (2.0 * n0)
    aplicar(o, d)
    o.data.transform(Matrix.Scale(escala, 4) @ Matrix.Translation(-CENTRO_CABEZA))
    o.data.materials.append(material)
    activar(o)
    bpy.ops.object.shade_smooth()
    return o


CENTRO_CABEZA = Vector((0.0, -0.07, 0.83))


def en_cabeza(p, escala):
    return (Vector(p) - CENTRO_CABEZA) * escala


def ojos_en_cuencas(bvh, ojos, escala, margen, material, nombre, frente=0.004):
    """La esfera más grande que cabe en cada cuenca sin tocar el cráneo y sin salirse más allá del
    frente del ojo del personaje."""
    piezas = []
    for c0, r0, y_frente in ojos:
        c0s = en_cabeza(c0, escala)
        yf = en_cabeza((0, y_frente, 0), escala).y - frente * escala
        mejor = None
        for dy in np.linspace(-0.06, 0.05, 23):
            for dx in np.linspace(-0.02, 0.02, 5):
                for dz in np.linspace(-0.02, 0.02, 5):
                    c = c0s + Vector((dx, dy, dz)) * escala
                    hit = bvh.find_nearest(c)
                    if hit[0] is None or (c - hit[0]).dot(hit[1]) < 0:
                        continue
                    R = hit[3] - margen
                    if c.y - R < yf or R <= 0:
                        continue
                    if mejor is None or R > mejor[1]:
                        mejor = (c, R)
        c, R = mejor
        piezas.append(esfera(nombre, c, R, material, seg=10, anillos=7, polo_x=False))
    return piezas


def sobre(bvh, p, fuera=0.0):
    """El punto de la piel más cercano a `p`, salido `fuera` sobre su normal."""
    hit = bvh.find_nearest(Vector(p))
    return hit[0] + hit[1] * fuera, hit[1]


# ---------------------------------------------------------------- señuelos

SENUELO = dict(Lb=0.074, perfil=[(0.0, 0.0, 0.0, 0.0), (0.05, 0.0068, -0.0066, 0.0062), (0.15, 0.0123, -0.0122, 0.0108),
                                  (0.3, 0.0157, -0.0156, 0.0126), (0.45, 0.0161, -0.0158, 0.0126), (0.6, 0.0146, -0.0141, 0.0111),
                                  (0.75, 0.0112, -0.0105, 0.0086), (0.88, 0.0076, -0.0071, 0.0057), (1.0, 0.0042, -0.004, 0.0032)])


def senuelo(M):
    """Crankbait de madera pintado de ~0.1 m: cuerpo de pececito, babero de lámina metido en la
    barbilla, armella al frente para el hilo y dos armellas con su argolla y su anzuelo triple (en
    la panza y en la cola) que cuelgan."""
    s = SENUELO
    Lb = s['Lb']
    p = s['perfil']
    ts = [x[0] for x in p]
    top, bot, w = pchip(ts, [x[1] for x in p]), pchip(ts, [x[2] for x in p]), pchip(ts, [x[3] for x in p])
    est = [0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.88, 1.0]
    anillos = [anillo_pez(t * Lb, float(top(t)), float(bot(t)), float(w(t)), 12, 0.0, 0.05) for t in est]
    cuerpo = loft('senuelo_cuerpo', anillos, M['senuelo'], frente=Vector((0, -0.0012, 0.0)), atras=Vector((0, Lb + 0.0015, 0.0)))
    pz = []
    # el babero: lámina redondeada metida en la barbilla, hacia adelante y abajo
    cont = []
    for i in range(14):
        a = math.pi * i / 13
        cont.append((0.0105 * math.cos(a), -0.012 - 0.013 * math.sin(a) ** 0.8))
    cont = [(0.0075, 0.004), (0.0105, -0.012)] + cont[1:-1] + [(-0.0105, -0.012), (-0.0075, 0.004)]
    babero = placa('senuelo_babero', cont, 0.0012, M['babero'], bisel=0.0004)
    babero.data.transform(Matrix.Translation((0, 0.006, -0.0045)) @ Matrix.Rotation(math.radians(32), 4, 'X') @ Matrix.Translation((0, 0, -0.0006)))
    pz.append(babero)
    acero = M['acero']
    # armella del hilo, en la nariz arriba del babero
    a_hilo, c_hilo = armella('senuelo_hilo', (0, 0.0012, 0.0022), (0, -1, 0.25), 0.0026, 0.0006, acero, (1, 0, 0), entra=0.006)
    pz += a_hilo
    anzuelos, argollas, armellas = [], [], a_hilo[:]
    for k, (t, direc) in enumerate(((0.38, (0, 0, -1)), (1.0, (0, 1, 0)))):
        y = t * Lb
        base = Vector((0, y, float(bot(t)))) if k == 0 else Vector((0, Lb + 0.0015, 0.0))
        R_e, r_e = 0.0026, 0.0006
        pzs, c_e = armella(f'senuelo_armella{k}', base, direc, R_e, r_e, acero, (1, 0, 0))
        armellas += pzs
        R_a, r_a = 0.0034, 0.0006
        c_a = colgante(c_e, R_e, r_e, R_a, r_a)
        argollas.append(toro(f'senuelo_argolla{k}', R_a, r_a, acero, c_a, normal=(0, 1, 0), seg=10, lados=4))
        R_h, r_h = 0.0021, 0.00065
        c_h = colgante(c_a, R_a, r_a, R_h, r_h)
        hz, _ = anzuelo(f'senuelo_triple{k}', c_h, (1, 0, 0), acero, puntas=3, R_ojo=R_h, r=r_h, largo=0.012, curva=0.0036,
                        punta=0.0062, giro=math.pi / 2 if k == 0 else math.pi / 6)
        anzuelos.append(hz)
    revisar('señuelo: anzuelos', anzuelos[0] + anzuelos[1], 'cuerpo y babero', [cuerpo, babero])
    revisar('señuelo: anzuelo de la panza', anzuelos[0], 'anzuelo de la cola', anzuelos[1])
    revisar('señuelo: argollas', argollas, 'aros de las armellas y ojos de los anzuelos',
            [x for x in armellas if x.name.split('.')[0].endswith('_aro')] + [x for h in anzuelos for x in h if '_ojo' in x.name])
    revisar('señuelo: babero', [babero], 'armella del hilo', a_hilo)
    pz += [cuerpo] + armellas[len(a_hilo):] + argollas + anzuelos[0] + anzuelos[1]
    o = unir(pz, 'Prop_Senuelo', angulo=40)
    return o, asentar(o)


def senuelo_calaverita(M, fuente, ojos):
    """Señuelo tallado de una calaverita de azúcar con la cabeza de Skulley (~0.1 m con el anzuelo):
    armella arriba para el hilo, armella abajo de la quijada con su argolla y un anzuelo sencillo, y
    los ojos aparte (Prop_SenueloCalaverita_Luz) que brillan tantito."""
    esc = 0.118
    cab = cabeza_copia(fuente, 'calaverita_senuelo', 760, esc, M['azucar_senuelo'])
    bvh = arbol([cab])
    luz = ojos_en_cuencas(bvh, ojos, esc, 0.0003, M['luz_ojo'], 'Prop_SenueloCalaverita_Luz')
    acero = M['acero']
    co = coords(cab)
    pz = [cab]
    # arriba: armella en la coronilla, un poco al frente
    top, n_top = sobre(bvh, (0, en_cabeza((0, -0.12, 0), esc).y, co[:, 2].max() + 0.01))
    a_hilo, _ = armella('cala_hilo', top, n_top, 0.0028, 0.0007, acero, (1, 0, 0), entra=0.006)
    pz += a_hilo
    # abajo: armella bajo la quijada, argolla y anzuelo con la punta al frente
    abajo, n_ab = sobre(bvh, (0, en_cabeza((0, -0.17, 0), esc).y, co[:, 2].min() - 0.01))
    a_abajo, c_e = armella('cala_armella', abajo, (0, 0, -1), 0.0028, 0.0007, acero, (1, 0, 0), entra=0.006)
    R_a, r_a = 0.0036, 0.0007
    c_a = colgante(c_e, 0.0028, 0.0007, R_a, r_a)
    argolla = toro('cala_argolla', R_a, r_a, acero, c_a, normal=(0, 1, 0), seg=10, lados=4)
    c_h = colgante(c_a, R_a, r_a, 0.0024, 0.0008)
    hz, _ = anzuelo('cala_anzuelo', c_h, (1, 0, 0), acero, puntas=1, R_ojo=0.0024, r=0.0008, largo=0.019, curva=0.0055,
                    punta=0.011, dir_punta=(0, -1, 0))
    revisar('calaverita: ojos (luz)', luz, 'cráneo', [cab])
    revisar('calaverita: anzuelo y argolla', hz + [argolla], 'cráneo', [cab])
    revisar('calaverita: argolla', [argolla], 'aros de la armella y ojo del anzuelo',
            [a_abajo[0], [x for x in hz if '_ojo' in x.name][0]])
    pz += a_abajo + [argolla] + hz
    o = unir(pz, 'Prop_SenueloCalaverita', angulo=50)
    luz_o = unir(luz, 'Prop_SenueloCalaverita_Luz', angulo=80)
    t = asentar(o)
    luz_o.data.transform(Matrix.Translation(-t))
    # dónde queda la coronilla ya asentada (para la cresta pintada)
    o.data['zmax_craneo'] = float(co[:, 2].max() - t.z)
    return o, t, luz_o


# ---------------------------------------------------------------- lo que sale que no es pez

def lata(M):
    """Lata de refresco aplastada y oxidada (de 0.122 m queda en ~0.075): acordeón, chueca y con la
    tapa ladeada; la anilla y su remache modelados y el hoyo de la tapa hundido. Guarda la
    posición de antes de aplastarla (`Original`) para que la pintura se arrugue con ella."""
    perfil = [(0, 0.006), (0.02, 0.0025), (0.026, 0.0), (0.0312, 0.004), (0.033, 0.012), (0.033, 0.032), (0.033, 0.052),
              (0.033, 0.072), (0.033, 0.09), (0.033, 0.104), (0.0302, 0.1125), (0.027, 0.118), (0.0276, 0.1215),
              (0.0262, 0.1222), (0.0248, 0.1192), (0, 0.1192)]
    o = torno('lata_cuerpo', perfil, M['lata'], lados=14)
    # el hoyo de la tapa (antes de aplastarla): hundido, sus caras nuevas oscuras
    hoyo = bloque('lata_hoyo', (0.017, 0.011, 0.01), None, centro=(0.0, -0.0128, 0.1192), bisel=0.003)
    restar(o, hoyo, M['hoyo'])
    co = coords(o).copy()
    poner_atributo(o, 'Original', co)
    nuevo = co.copy()
    for i, (x, y, z) in enumerate(co):
        th = math.atan2(y, x)
        r = math.hypot(x, y)
        if 0.01 < z < 0.106:
            u = (z - 0.01) / 0.096
            env = math.sin(math.pi * u) ** 0.6
            # pliegues inclinados (en diamante) que salen y entran; de un lado lo apachurraron más
            fase = u * 2.6 * 2 * math.pi + 2.2 * math.cos(th - 0.3) + 1.1 * math.sin(3 * th + 0.5)
            r *= 1 + env * (0.11 * math.sin(fase) + 0.03)
            r *= 1 - 0.2 * env * max(0.0, math.cos(th - 2.2)) ** 2
            z = 0.01 + 0.096 * (u * 0.47) + 0.004 * env * math.cos(fase)
        elif z >= 0.106:
            z = z - 0.106 + 0.0551
        nuevo[i] = (r * math.cos(th), r * math.sin(th), z)
    # ladeada: la tapa se va de lado y se inclina
    for i in range(len(nuevo)):
        x, y, z = nuevo[i]
        k = min(1.0, max(0.0, (z - 0.01) / 0.05))
        ang = math.radians(13) * k
        x2 = x + 0.007 * k
        z2 = z + math.tan(ang) * (x2 - 0.0)
        nuevo[i] = (x2, y, z2)
    o.data.vertices.foreach_set('co', nuevo.ravel())
    o.data.update()
    bvh = arbol([o])
    en_tapa = [i for i, (x, y, z) in enumerate(co) if z > 0.118 and math.hypot(x, y) < 0.026]
    cx = float(np.mean([nuevo[i][0] for i in en_tapa]))
    cy = float(np.mean([nuevo[i][1] for i in en_tapa]))

    def tapa_en(x, y):
        h = bvh.ray_cast(Vector((cx + x, cy + y, 0.3)), Vector((0, 0, -1)))
        return h[0], h[1]
    pz = [o]
    # la anilla: un aro aplanado acostado en la tapa, con el remache del centro de la tapa
    # atravesando su punta (así se sujeta)
    p_c, n_c = tapa_en(0.0, 0.0)
    p_a, n_a = tapa_en(0.0, 0.0062)
    R_an, r_an = 0.0058, 0.0011
    c = p_a + n_a * (r_an * 0.55 + 0.0003)
    an = toro('lata_anilla', R_an, r_an, M['lata_tapa'], c, normal=n_a, seg=10, lados=3, escala=(1.0, 0.72))
    an.data.transform(Matrix.Translation(c) @ Matrix.Scale(0.55, 4, n_a) @ Matrix.Translation(-c))
    pz.append(an)
    rot = n_c.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    pz.append(torno('lata_remache', [(0, -0.0012), (0.0017, -0.0012), (0.0016, 0.0016), (0.0009, 0.0024), (0, 0.0025)], M['lata_tapa'], lados=6,
                    M=Matrix.Translation(p_c) @ rot))
    revisar('lata: anilla', [an], 'tapa', [o])
    obj = unir(pz, 'Prop_Lata', angulo=55)
    return obj, asentar(obj)


def smin(a, b, k):
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def contorno_control(n=40):
    def sdf(x, y):
        c1 = math.hypot(x - 0.047, y + 0.004) - 0.031
        c2 = math.hypot(x + 0.047, y + 0.004) - 0.031
        qx, qy = abs(x) - 0.046, abs(y - 0.005) - 0.02
        caja = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - 0.006
        return smin(smin(c1, c2, 0.01), caja, 0.014)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        lo, hi = 0.0, 0.2
        for _ in range(40):
            mid = (lo + hi) / 2
            if sdf(mid * math.cos(a), mid * math.sin(a)) < 0:
                lo = mid
            else:
                hi = mid
        pts.append((lo * math.cos(a), lo * math.sin(a)))
    return pts


def control(M):
    """Control de videojuegos viejo y genérico (sin marca), acostado con los botones hacia arriba:
    cruceta, dos botones, start y select, gatillos atrás y el cable reventado con sus hilos de
    cobre."""
    g = 0.024
    cuerpo = placa('control_cuerpo', contorno_control(40), g, M['control'], bisel=0.0065, segmentos=2)
    pz = [cuerpo]
    arriba = g
    # la cruceta
    a, b = 0.0042, 0.0125
    cruz = [(a, b), (-a, b), (-a, a), (-b, a), (-b, -a), (-a, -a), (-a, -b), (a, -b), (a, -a), (b, -a), (b, a), (a, a)]
    cr = placa('control_cruz', cruz, 0.0042, M['control_cruz'], bisel=0.0009)
    cr.data.transform(Matrix.Translation((-0.047, -0.004, arriba - 0.0012)))
    pz.append(cr)
    botones = []
    for k, (x, y) in enumerate(((0.04, -0.011), (0.056, 0.004))):
        bt = torno(f'control_boton{k}', [(0, 0), (0.0068, 0), (0.0068, 0.0032), (0.0058, 0.0044), (0, 0.0046)], M[f'control_boton{k}'], lados=12,
                   M=Matrix.Translation((x, y, arriba - 0.0012)))
        botones.append(bt)
    pz += botones
    for k, x in enumerate((-0.0085, 0.0085)):
        pl = bloque(f'control_pastilla{k}', (0.009, 0.0032, 0.003), M['control_cruz'], centro=(x, -0.006, arriba + 0.0003), rot=(0, 0, math.radians(28)), bisel=0.0012)
        pz.append(pl)
    # los gatillos de atrás (asoman del canto de atrás de cada mango)
    for lado in (1, -1):
        gat = bloque(f'control_gatillo{lado}', (0.028, 0.012, 0.011), M['control_cruz'], centro=(lado * 0.05, 0.0285, g * 0.6), rot=(0, 0, -lado * 0.32), bisel=0.0035)
        pz.append(gat)
    # el cable: sale de en medio, atrás, y se acaba reventado con tres hilos de cobre
    c0 = Vector((0.0, 0.0245, g * 0.5))
    cable = [c0 - Vector((0, 0.004, 0)), c0 + Vector((0, 0.008, 0)), c0 + Vector((0.008, 0.022, -0.006)), c0 + Vector((0.024, 0.03, -0.0095)),
             c0 + Vector((0.042, 0.028, -0.0095)), c0 + Vector((0.056, 0.036, -0.0095))]
    pz.append(tubo('control_cable', cable, 0.0021, M['control_cable'], lados=6))
    pz.append(torno('control_funda', [(0, 0), (0.0036, 0), (0.0036, 0.006), (0.0029, 0.012), (0, 0.012)], M['control_cable'], lados=8,
                    M=Matrix.Translation(c0 + Vector((0, -0.002, 0))) @ Matrix.Rotation(-math.pi / 2, 4, 'X')))
    q = cable[-1]
    for k in range(3):
        an = k * 2.2 + 0.4
        pz.append(tubo(f'control_cobre{k}', [q, q + Vector((0.004, 0.0015 * math.cos(an), 0.0015 * math.sin(an))),
                                              q + Vector((0.0085, 0.004 * math.cos(an), 0.003 * math.sin(an) + 0.0005))], 0.00045, M['cobre'], lados=3))
    o = unir(pz, 'Prop_Control', angulo=40)
    return o, asentar(o)


def calaverita(M, fuente, ojos):
    """Calaverita de azúcar decorada con la cabeza de Skulley (~0.14 m): sentada sobre su base
    plana, papel metálico en las cuencas, glaseado alrededor de los ojos, una flor en la frente,
    puntitos en los cachetes, la sonrisa delineada y su mohawk de picos de glaseado azul."""
    esc = 0.255
    cab = cabeza_copia(fuente, 'calaverita_cuerpo', 900, esc, M['azucar'])
    # base plana para que se siente
    bm = bmesh.new()
    bm.from_mesh(cab.data)
    zmin = min(v.co.z for v in bm.verts)
    corte = bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), dist=1e-6,
                                   plane_co=(0, 0, zmin + 0.005), plane_no=(0, 0, 1), clear_inner=True)
    bordes = [e for e in bm.edges if e.is_boundary]
    bmesh.ops.holes_fill(bm, edges=bordes, sides=0)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(cab.data)
    bm.free()
    bvh = arbol([cab])
    pz = [cab]
    deco = []
    papel = ojos_en_cuencas(bvh, ojos, esc, 0.0005, M['papel'], 'calaverita_papel', frente=0.0)
    co = coords(cab)

    def de_frente(x, z, fuera):
        """Dónde pega en la cara un rayo de frente (hacia +Y) en (x, z) del personaje."""
        p = en_cabeza((x, -1.0, z), esc)
        h = bvh.ray_cast(Vector((p.x, -1.0, p.z)), Vector((0, 1, 0)))
        if h[0] is None:
            print(f'    (de frente no pegó en {x:.3f}, {z:.3f}: va al punto más cercano)')
            return sobre(bvh, en_cabeza((x, -0.3, z), esc), fuera)
        return h[0] + h[1] * fuera, h[1]
    # glaseado alrededor de cada cuenca, en florecita (la orilla ondulada)
    for k, (c0, r0, yfr) in enumerate(ojos):
        pts = []
        for i in range(20):
            a = 2 * math.pi * i / 20
            rr = r0 * (1.04 + 0.07 * math.cos(8 * a))
            q, n = de_frente(c0.x + math.cos(a) * rr, c0.z + math.sin(a) * rr, 0.0007)
            pts.append(q)
        deco.append(tubo(f'calaverita_aro{k}', pts, 0.0017, M['glaseado_rosa'], lados=4, cerrado=True))
        # puntitos amarillos por fuera, del lado de afuera de la cara
        lado = 1 if c0.x > 0 else -1
        for i in range(5):
            a = math.radians(-60 + 30 * i)
            q, n = de_frente(c0.x + lado * math.cos(a) * r0 * 1.42, c0.z + math.sin(a) * r0 * 1.42, 0.0009)
            deco.append(esfera(f'calaverita_punto{k}', q, 0.0024, M['glaseado_amarillo'], seg=5, anillos=3))
    # la flor de la frente: cinco pétalos, su centro y dos hojitas
    frente, nf = de_frente(0.0, 1.0, 0.0)
    eje_a = Vector((1, 0, 0))
    eje_b = nf.cross(eje_a).normalized()
    for i in range(5):
        a = math.pi / 2 + 2 * math.pi * i / 5
        p = frente + (eje_a * math.cos(a) + eje_b * math.sin(a)) * 0.0085
        q, n = sobre(bvh, p, 0.0016)
        deco.append(esfera('calaverita_petalo', q, 0.0046, M['glaseado_rosa'], seg=6, anillos=4, escala=(1, 1, 0.75)))
    q, n = sobre(bvh, frente, 0.0022)
    deco.append(esfera('calaverita_centro', q, 0.0034, M['glaseado_amarillo'], seg=5, anillos=3))
    for lado in (1, -1):
        p = frente + eje_a * lado * 0.019 - eje_b * 0.004
        q, n = sobre(bvh, p, 0.0011)
        deco.append(esfera('calaverita_hoja', q, 0.0038, M['glaseado_verde'], seg=5, anillos=3, escala=(1.6, 0.8, 0.6)))
    # puntitos verdes en los cachetes
    for lado in (1, -1):
        for i in range(2):
            q, n = de_frente(lado * (0.165 + 0.03 * i), 0.66 + 0.02 * i, 0.0008)
            deco.append(esfera('calaverita_cachete', q, 0.0026, M['glaseado_verde'], seg=5, anillos=3))
    # la sonrisa: la raya entre el cráneo y la quijada, con sus dientes de glaseado
    sonrisa = []
    for i in range(11):
        u = -1 + 2 * i / 10
        q, n = de_frente(u * 0.128, 0.617 + 0.056 * u * u, 0.0011)
        sonrisa.append(q)
    deco.append(tubo('calaverita_sonrisa', sonrisa, 0.0018, M['glaseado_azul'], lados=4))
    for i in range(7):
        u = -0.75 + 1.5 * i / 6
        zc = 0.617 + 0.056 * u * u
        a, _ = de_frente(u * 0.128, zc + 0.022, 0.0009)
        b, _ = de_frente(u * 0.128, zc - 0.022, 0.0009)
        deco.append(tubo('calaverita_diente', [a, b], 0.0013, M['glaseado_azul'], lados=3))
    # el mohawk: picos de glaseado azul por en medio, de la frente a la nuca, echados para atrás
    for i in range(7):
        u = i / 6
        y_h = -0.2 + 0.34 * u
        hit = bvh.ray_cast(Vector((0, en_cabeza((0, y_h, 0), esc).y, co[:, 2].max() + 0.05)), Vector((0, 0, -1)))
        base, n = hit[0], hit[1]
        alto = (0.017 + 0.007 * math.sin(math.pi * u)) * (1.0 if i % 2 == 0 else 0.8)
        eje = (n + Vector((0, 0.6, 0))).normalized()
        perfil = [(0, -0.002), (0.0055, -0.002), (0.0038, alto * 0.5), (0, alto)]
        rot = eje.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        deco.append(torno('calaverita_pico', perfil, M['glaseado_azul'], lados=6, M=Matrix.Translation(base) @ rot))
    revisar('calaverita: papel de los ojos', papel, 'cráneo', [cab])
    pz += papel + deco
    o = unir(pz, 'Prop_Calaverita', angulo=50)
    return o, asentar(o)


# ---------------------------------------------------------------- la báscula

DIGITOS = {
    '0': [[(0.31, 1.0), (0.12, 0.9), (0.03, 0.62), (0.03, 0.38), (0.12, 0.1), (0.31, 0.0), (0.5, 0.1), (0.59, 0.38), (0.59, 0.62), (0.5, 0.9), (0.31, 1.0)]],
    '1': [[(0.12, 0.78), (0.36, 1.0), (0.36, 0.0)], [(0.14, 0.0), (0.56, 0.0)]],
    '2': [[(0.06, 0.76), (0.16, 0.94), (0.33, 1.0), (0.5, 0.93), (0.57, 0.75), (0.5, 0.55), (0.05, 0.02), (0.6, 0.02)]],
    '4': [[(0.46, 0.0), (0.46, 1.0), (0.02, 0.3), (0.62, 0.3)]],
    '6': [[(0.52, 0.92), (0.34, 1.0), (0.14, 0.9), (0.04, 0.6), (0.05, 0.25), (0.16, 0.05), (0.33, 0.0), (0.5, 0.07), (0.58, 0.25),
           (0.55, 0.43), (0.4, 0.55), (0.22, 0.54), (0.07, 0.42)]],
    '8': [[(0.31, 0.54), (0.13, 0.62), (0.09, 0.8), (0.18, 0.96), (0.31, 1.0), (0.44, 0.96), (0.53, 0.8), (0.49, 0.62), (0.31, 0.54),
           (0.1, 0.44), (0.04, 0.24), (0.14, 0.05), (0.31, 0.0), (0.48, 0.05), (0.58, 0.24), (0.52, 0.44), (0.31, 0.54)]],
    'k': [[(0.06, 1.0), (0.06, 0.0)], [(0.5, 0.6), (0.08, 0.26)], [(0.22, 0.38), (0.54, 0.0)]],
    'g': [[(0.52, 0.62), (0.52, -0.08), (0.42, -0.26), (0.24, -0.3), (0.08, -0.22)],
          [(0.52, 0.48), (0.4, 0.6), (0.24, 0.62), (0.1, 0.5), (0.06, 0.32), (0.12, 0.14), (0.26, 0.06), (0.42, 0.1), (0.52, 0.24)]],
}


def dibujo_caratula(tam=1024):
    """La carátula: marcas cada medio kilo, números pares de 0 a 12 y "kg", pintados a pulso.
    Cuadro de [-1, 1]²; el borde del dial es el radio 1."""
    ys, xs = np.mgrid[0:tam, 0:tam].astype(np.float32)
    x = -1 + 2 * xs / (tam - 1)
    y = -1 + 2 * ys / (tam - 1)
    x = x + 0.004 * np.sin(y * 37 + 1.1)
    y = y + 0.004 * np.sin(x * 29 + 0.3)
    m = np.zeros((tam, tam), np.float32)

    def trazo(a, b, ancho):
        ax, ay = a
        bx, by = b
        x0, x1 = min(ax, bx) - ancho, max(ax, bx) + ancho
        y0, y1 = min(ay, by) - ancho, max(ay, by) + ancho
        i0, i1 = max(0, int((y0 + 1) / 2 * (tam - 1)) - 1), min(tam, int((y1 + 1) / 2 * (tam - 1)) + 2)
        j0, j1 = max(0, int((x0 + 1) / 2 * (tam - 1)) - 1), min(tam, int((x1 + 1) / 2 * (tam - 1)) + 2)
        px, py = x[i0:i1, j0:j1], y[i0:i1, j0:j1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9
        t = np.clip(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1)
        d = np.hypot(px - ax - t * dx, py - ay - t * dy)
        v = np.clip((ancho - d) / (ancho * 0.25) + 0.5, 0, 1)
        m[i0:i1, j0:j1] = np.maximum(m[i0:i1, j0:j1], v)
    for i in range(25):
        kg = i * 0.5
        ang = math.radians(90 - kg * GRADOS_POR_KG)
        largo = 0.15 if i % 2 == 0 else 0.08
        r1 = 0.93
        trazo((math.cos(ang) * (r1 - largo), math.sin(ang) * (r1 - largo)), (math.cos(ang) * r1, math.sin(ang) * r1), 0.018 if i % 2 == 0 else 0.011)
    # el aro de afuera
    n = 96
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        trazo((math.cos(a0) * 0.955, math.sin(a0) * 0.955), (math.cos(a1) * 0.955, math.sin(a1) * 0.955), 0.008)

    def texto(cadena, cx, cy, alto, ancho_trazo):
        ancho = sum(0.62 if ch != '1' else 0.5 for ch in cadena) * alto + 0.12 * alto * (len(cadena) - 1)
        x0 = cx - ancho / 2
        for ch in cadena:
            for linea in DIGITOS[ch]:
                pts = [(x0 + px * alto, cy - alto / 2 + py * alto) for px, py in linea]
                for a, b in zip(pts, pts[1:]):
                    trazo(a, b, ancho_trazo)
            x0 += (0.62 if ch != '1' else 0.5) * alto + 0.12 * alto
    for kg in range(0, 13, 2):
        ang = math.radians(90 - kg * GRADOS_POR_KG)
        texto(str(kg), math.cos(ang) * 0.6, math.sin(ang) * 0.6, 0.15, 0.021)
    texto('kg', 0.0, -0.36, 0.13, 0.019)
    return m


def bascula(M, imagen_caratula):
    """Báscula colgante de reloj (romana) de ~0.45 m: gancho arriba que se cuelga, oreja en la
    caja, caja redonda esmaltada con su bisel, carátula, la aguja aparte (Prop_Bascula_Aguja, el
    origen en su eje) y abajo la varilla con su ojo y el gancho para el pez."""
    esm, cromo = M['bascula'], M['cromo']
    pz = []
    Rc, prof = 0.092, 0.055
    zc = 0.215  # centro del dial (se acomoda al final con asentar)
    # la caja: revolución alrededor de Y (perfil en r, y)
    perfil = [(0, prof / 2), (Rc - 0.006, prof / 2), (Rc, prof / 2 - 0.006), (Rc, -prof / 2 + 0.008), (Rc - 0.004, -prof / 2 + 0.004),
              (Rc - 0.009, -prof / 2 + 0.004), (Rc - 0.009, -prof / 2 + 0.008), (0, -prof / 2 + 0.008)]
    rotY = Matrix.Translation((0, 0, zc)) @ Matrix.Rotation(-math.pi / 2, 4, 'X')
    caja = torno('bascula_caja', perfil, esm, lados=20, M=rotY)
    pz.append(caja)
    y_dial = -prof / 2 + 0.008
    bisel = toro('bascula_bisel', Rc - 0.0075, 0.0052, cromo, (0, -prof / 2 + 0.003, zc), normal=(0, 1, 0), seg=20, lados=5)
    pz.append(bisel)
    Rd = Rc - 0.012
    dial = torno('bascula_dial', [(0, 0.0), (Rd, 0.0), (Rd, 0.0016), (0, 0.0016)], M['caratula'], lados=20,
                 M=Matrix.Translation((0, y_dial - 0.0012, zc)) @ Matrix.Rotation(-math.pi / 2, 4, 'X'))
    pz.append(dial)
    # la aguja: plana, roja, con su contrapeso, y el centro (remache) — todo gira con ella. En su
    # espacio: origen en el eje, apunta a +Z (0 kg) y su cara de atrás en y = 0, hacia -Y
    y_ag = y_dial - 0.0012 - 0.0012  # 1.2 mm delante de la carátula
    largo, cola = Rd * 0.84, 0.016
    cont = [(0, largo), (0.0013, largo - 0.006), (0.0028, 0.006), (0.0042, 0.0), (0.0036, -cola * 0.6), (0.0055, -cola), (-0.0055, -cola),
            (-0.0036, -cola * 0.6), (-0.0042, 0.0), (-0.0028, 0.006), (-0.0013, largo - 0.006)]
    ag = placa('aguja_hoja', cont, 0.0011, M['aguja'], bisel=0.0003)
    ag.data.transform(Matrix.Rotation(math.pi / 2, 4, 'X'))
    co = coords(ag)
    ag.data.transform(Matrix.Translation((0, -co[:, 1].max(), 0)))
    centro = torno('aguja_centro', [(0, 0), (0.0052, 0), (0.0052, 0.0022), (0.0038, 0.0034), (0, 0.0037)], M['remache'], lados=10,
                   M=Matrix.Rotation(math.pi / 2, 4, 'X'))
    aguja_piezas = [ag, centro]
    # oreja de arriba (un aro en el plano XZ metido en la caja) y el gancho para colgarla
    R_o, r_o = 0.012, 0.0042
    c_o = Vector((0, 0, zc + Rc + R_o - 0.003))
    oreja = toro('bascula_oreja', R_o, r_o, cromo, c_o, normal=(0, 1, 0), seg=12, lados=5)
    pz.append(oreja)
    pz.append(torno('bascula_cuello_arriba', [(0, -0.004), (0.009, -0.004), (0.0065, 0.004), (0, 0.006)], esm, lados=10,
                    M=Matrix.Translation((0, 0, zc + Rc - 0.002))))
    # el gancho de arriba: su ojo cuelga de la oreja (planos perpendiculares), sube y se abre en J
    R_g, r_g = 0.0095, 0.0036
    c_g = c_o + Vector((0, 0, R_o + R_g - r_o - r_g - EPS))
    pz_g = [toro('gancho_arriba_ojo', R_g, r_g, cromo, c_g, normal=(1, 0, 0), seg=12, lados=5)]
    p0 = c_g + Vector((0, 0, R_g - r_g * 0.4))
    rj = 0.027
    camino = [p0, p0 + Vector((0, 0, 0.032))]
    cen = p0 + Vector((0, rj, 0.032))
    for s in np.linspace(0, math.pi * 1.12, 10)[1:]:
        camino.append(cen + Vector((0, -rj * math.cos(s), rj * math.sin(s))))
    pz_g.append(tubo('gancho_arriba', camino, r_g, cromo, lados=6))
    pz_g.append(esfera('gancho_arriba_bolita', camino[-1], r_g * 1.5, cromo, seg=8, anillos=5))
    # abajo: el cuello de la caja, la varilla que sale y su ojo
    pz.append(torno('bascula_cuello_abajo', [(0, -0.006), (0.0075, -0.004), (0.0105, 0.004), (0, 0.004)], esm, lados=10,
                    M=Matrix.Translation((0, 0, zc - Rc + 0.002))))
    z_v = zc - Rc - 0.004
    R_v, r_v = 0.0085, 0.0034
    c_v = Vector((0, 0, z_v - 0.042 - R_v))
    varilla = [tubo('varilla', [Vector((0, 0, z_v + 0.012)), c_v + Vector((0, 0, R_v - r_v * 0.3))], 0.0034, cromo, lados=6),
               toro('varilla_ojo', R_v, r_v, cromo, c_v, normal=(0, 1, 0), seg=12, lados=5)]
    pz += varilla
    # el gancho del pez: su ojo cuelga del de la varilla, caña, curva y punta con rebaba
    R_h, r_h = 0.0085, 0.0034
    c_h = colgante(c_v, R_v, r_v, R_h, r_h)
    hz, z_bajo = anzuelo('gancho_pez', c_h, (1, 0, 0), cromo, puntas=1, R_ojo=R_h, r=r_h, largo=0.046, curva=0.023, punta=0.032,
                         dir_punta=(0, -1, 0), lados=6)
    pz += pz_g + hz
    revisar('báscula: gancho de arriba', pz_g, 'oreja y caja', [oreja, caja])
    revisar('báscula: gancho del pez', hz, 'ojo de la varilla y caja', [varilla[1], caja])
    o = unir(pz, 'Prop_Bascula', angulo=45)
    aguja = unir(aguja_piezas, 'Prop_Bascula_Aguja', angulo=45)
    t = asentar(o)
    eje = Vector((0, y_ag, zc)) - t
    # la aguja ya puesta, para revisar que no toque nada
    aguja.data.transform(Matrix.Translation(eje))
    revisar('báscula: aguja (puesta)', [aguja], 'Prop_Bascula', [o])
    aguja.data.transform(Matrix.Translation(-eje))
    return o, t, aguja, eje


# ---------------------------------------------------------------- materiales

def lavado_m(N, col, campo, umbral, ancho, color, mascara, borde=0.3, oscuro=0.7, invertido=False):
    """Como P.lavado, con una máscara (socket) que apaga también la orilla del pigmento: con
    P.lavado la orilla no se multiplica por la opacidad y dejaba rayas donde el patrón va apagado."""
    lleno = P.suave(N, campo, umbral - ancho, umbral + ancho)
    if invertido:
        lleno = N.val('SUBTRACT', 1.0, lleno)
    col = N.mezcla(N.val('MULTIPLY', lleno, mascara), col, color)
    if borde > 0:
        dist = N.val('ABSOLUTE', N.val('SUBTRACT', campo, umbral))
        orilla = N.val('SUBTRACT', 1.0, P.suave(N, dist, 0.0, ancho * 0.7))
        c = P.srgb(color)
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', orilla, borde), mascara), col, (c[0] * oscuro, c[1] * oscuro, c[2] * oscuro, 1.0))
    return col


def _desde(N, pos, origen):
    """Las coordenadas del diseño: las del objeto más lo que se le restó al acomodarlo."""
    a = N.n('ShaderNodeVectorMath', operation='ADD')
    N.l(pos, a.inputs[0])
    a.inputs[1].default_value = tuple(origen)
    return a.outputs[0]


def _xyz(N, v):
    s = N.n('ShaderNodeSeparateXYZ')
    N.l(v, s.inputs[0])
    return s.outputs['X'], s.outputs['Y'], s.outputs['Z']


def _largo2(N, a, b):
    c = N.n('ShaderNodeCombineXYZ')
    N.l(a, c.inputs[0]) if not isinstance(a, (int, float)) else None
    N.l(b, c.inputs[1]) if not isinstance(b, (int, float)) else None
    ln = N.n('ShaderNodeVectorMath', operation='LENGTH')
    N.l(c.outputs[0], ln.inputs[0])
    return ln.outputs['Value']


def _mezcla_si(N, col, fac, color):
    return N.mezcla(fac, col, color)


def _brillo_humedo(N, col, pl, nz, color, fuerza=0.5, ancho=(0.5, 0.6, 0.78, 0.88), estira=(0.6, 3.5, 10.0)):
    """La franja clara mojada en el lomo: donde la cara ve hacia arriba de lado, rota a lo largo."""
    banda = N.val('MULTIPLY', P.suave(N, nz, ancho[0], ancho[1]), N.val('SUBTRACT', 1.0, P.suave(N, nz, ancho[2], ancho[3])))
    rayado = P.suave(N, N.ruido(N.escalar(pl, estira), 1.0, detalle=2.0, distorsion=0.4), 0.5, 0.6)
    f = N.val('MULTIPLY', N.val('MULTIPLY', banda, rayado), fuerza)
    col = N.mezcla(f, col, color)
    filo = N.val('MULTIPLY', N.val('MULTIPLY', banda, N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', rayado, 0.5)), 0.0, 0.2))), fuerza * 0.25)
    c = P.srgb(color)
    return N.mezcla(filo, col, (c[0] * 0.85, c[1] * 0.85, c[2] * 0.85, 1))


def _escamas(N, y, z, sw, sh):
    """Escamas en filas desfasadas: la orilla de cada una es un arco que abre hacia la cola (+y).
    Devuelve la distancia al centro de su arco (1 = orilla) y un azar por escama."""
    sv = N.val('DIVIDE', z, sh)
    fila = N.val('FLOOR', sv)
    fv = N.val('FRACT', sv)
    par = N.val('MULTIPLY', N.val('FRACT', N.val('MULTIPLY', fila, 0.5)), 2.0)
    su = N.val('ADD', N.val('DIVIDE', y, sw), N.val('MULTIPLY', par, 0.5))
    fu = N.val('FRACT', su)
    # media elipse: llega a la orilla de la celda arriba y abajo, así las de la fila de junto
    # (desfasada) se juntan con ella y forman la red
    dy = N.val('DIVIDE', fu, 0.72)
    dz = N.val('DIVIDE', N.val('SUBTRACT', fv, 0.5), 0.5)
    d = _largo2(N, dy, dz)
    wn = N.n('ShaderNodeTexWhiteNoise', noise_dimensions='3D')
    cw = N.n('ShaderNodeCombineXYZ')
    N.l(N.val('FLOOR', su), cw.inputs[0])
    N.l(fila, cw.inputs[1])
    N.l(cw.outputs[0], wn.inputs['Vector'])
    return d, wn.outputs['Value']


def _cicatriz(N, col, y, z, x, a, b, ancho, lado, color, L):
    ay, az = a[0] * L, a[1] * L
    by, bz = b[0] * L, b[1] * L
    dy, dz = by - ay, bz - az
    ln = math.hypot(dy, dz)
    uy, uz = dy / ln, dz / ln
    qy = N.val('SUBTRACT', y, ay)
    qz = N.val('SUBTRACT', z, az)
    p = N.val('ADD', N.val('MULTIPLY', qy, uy), N.val('MULTIPLY', qz, uz))
    pc = N.val('MINIMUM', N.val('MAXIMUM', p, 0.0), ln)
    ry = N.val('SUBTRACT', qy, N.val('MULTIPLY', pc, uy))
    rz = N.val('SUBTRACT', qz, N.val('MULTIPLY', pc, uz))
    d = _largo2(N, ry, rz)
    t = N.val('DIVIDE', pc, ln)
    afila = N.val('SUBTRACT', 1.0, N.val('MULTIPLY', N.val('ABSOLUTE', N.val('SUBTRACT', t, 0.5)), 1.8))
    w = N.val('MULTIPLY', afila, ancho * L)
    m = N.val('SUBTRACT', 1.0, P.suave(N, N.val('DIVIDE', d, N.val('MAXIMUM', w, 1e-5)), 0.55, 1.0))
    lado_m = P.suave(N, N.val('MULTIPLY', x, lado), -0.0005, 0.0005)
    f = N.val('MULTIPLY', m, lado_m)
    col = N.mezcla(N.val('MULTIPLY', f, 0.85), col, color)
    centro = N.val('SUBTRACT', 1.0, P.suave(N, N.val('DIVIDE', d, N.val('MAXIMUM', w, 1e-5)), 0.0, 0.3))
    return N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', centro, lado_m), 0.45), col, '#a86a62')


def material_pez(nombre, origen, pf, c):
    """La piel de un pez en acuarela, en coordenadas de diseño (nariz en y = 0, cola hacia +y): lomo
    oscuro, flanco y panza clara con orilla rota, lavados cálidos y fríos, el patrón de la especie,
    la orilla del opérculo, la línea lateral, la franja mojada del lomo y el grano del papel."""
    m = P._nuevo(nombre)
    N, pos0, geo, nz = P._base(m)
    L = pf.L
    H = max(pf.top(t) - pf.bot(t) for t in np.linspace(0, 1, 30))
    pos = _desde(N, pos0, origen)
    pl = N.escalar(pos, (1 / L, 1 / L, 1 / L))
    x, y, z = _xyz(N, pos)
    nz = _xyz(N, geo.outputs['Normal'])[2]  # la suave: con la de cada cara se veían los triángulos
    zn = N.val('DIVIDE', z, H / 2)
    g = N.val('ADD', N.val('MULTIPLY', zn, 0.6), N.val('MULTIPLY', nz, 0.42))
    g = N.val('ADD', g, N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pl, 7.0, detalle=2.0, distorsion=0.8), 0.5), 0.32))
    col = N.rampa(g, [(0.0, c['panza']), (1.0, c['panza'])])
    col = P.lavado(N, col, g, c.get('corte_flanco', -0.3), 0.06, c['flanco'], 1.0, borde=0.3)
    col = P.lavado(N, col, g, c.get('corte_lomo', 0.32), 0.07, c['lomo'], 0.95, borde=0.35)
    grande = N.ruido(pl, 3.2, detalle=3.0, rugosidad=0.6, distorsion=1.5)
    col = P.lavado(N, col, grande, 0.58, 0.07, c['claro'], 0.32, borde=0.3)
    col = P.lavado(N, col, grande, 0.42, 0.07, c['oscuro'], 0.28, borde=0.3, invertido=True)
    tinte = N.ruido(pl, 1.6, detalle=1.0, distorsion=1.0)
    col = P.lavado(N, col, tinte, 0.6, 0.12, c['calido'], 0.22, borde=0.0)
    col = P.lavado(N, col, tinte, 0.4, 0.12, c['frio'], 0.2, borde=0.0, invertido=True)
    yo, zo, ro = c['opercula']
    cuerpo_y = P.suave(N, y, (yo + 0.02) * L, (yo + 0.07) * L)  # detrás de la cabeza
    patron = c.get('patron')
    if patron == 'barras':
        y0, y1, per = c['barras']
        fase = N.val('ADD', N.val('DIVIDE', N.val('SUBTRACT', y, y0 * L), per * L), N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pl, 5.0, detalle=2.0), 0.5), 0.45))
        d = N.val('ABSOLUTE', N.val('SUBTRACT', N.val('FRACT', fase), 0.5))
        en = N.val('MULTIPLY', P.suave(N, y, (y0 - 0.02) * L, y0 * L), N.val('SUBTRACT', 1.0, P.suave(N, y, y1 * L, (y1 + 0.03) * L)))
        fuerza = N.val('MULTIPLY', N.val('MULTIPLY', en, P.suave(N, g, -0.6, -0.15)), 0.8)
        col = lavado_m(N, col, d, 0.21, 0.05, c['patron_color'], fuerza, borde=0.4, invertido=True)
    elif patron == 'franja':
        a0, a1 = c['franja_z']
        zl = N.val('ADD', a0 * L, N.val('MULTIPLY', y, a1))
        dz = N.val('ABSOLUTE', N.val('SUBTRACT', z, zl))
        onda = N.n('ShaderNodeMath', operation='SINE')
        N.l(N.val('ADD', N.val('DIVIDE', y, 0.045 * L), N.val('MULTIPLY', N.ruido(pl, 3.0), 3.0)), onda.inputs[0])
        ancho = N.val('MULTIPLY', N.val('ADD', 0.75, N.val('MULTIPLY', onda.outputs[0], 0.35)), c['franja_ancho'] * L)
        campo = N.val('ADD', N.val('DIVIDE', dz, ancho), N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pl, 9.0, detalle=2.0), 0.5), 0.6))
        region = N.val('MULTIPLY', P.suave(N, y, (yo - 0.08) * L, (yo + 0.02) * L), N.val('SUBTRACT', 1.0, P.suave(N, y, 0.78 * L, 0.84 * L)))
        col = lavado_m(N, col, campo, 1.0, 0.14, c['patron_color'], N.val('MULTIPLY', region, c.get('franja_fuerza', 0.85)), borde=0.45, invertido=True)
        mot = N.ruido(pl, 8.0, detalle=2.0, distorsion=1.2)
        col = lavado_m(N, col, mot, 0.63, 0.05, c['patron_color'], N.val('MULTIPLY', P.suave(N, g, 0.05, 0.35), 0.45), borde=0.35)
    if 'escamas' in c:
        sw, sh, borde_c, luz_c, fuerza = c['escamas']
        d, azar = _escamas(N, y, z, sw * L, sh * L)
        en = N.val('MULTIPLY', cuerpo_y, N.val('SUBTRACT', 1.0, P.suave(N, y, 0.79 * L, 0.83 * L)))
        dentro_arco = N.val('SUBTRACT', 1.0, P.suave(N, d, 0.86, 0.96))
        tono = N.val('MULTIPLY', N.val('MULTIPLY', N.val('MULTIPLY', P.suave(N, azar, 0.55, 0.95), en), dentro_arco), 0.35 * fuerza)
        col = N.mezcla(tono, col, luz_c)
        dentro = N.val('MULTIPLY', N.val('MULTIPLY', P.suave(N, d, 0.55, 0.9), N.val('SUBTRACT', 1.0, P.suave(N, d, 0.95, 1.02))), en)
        col = N.mezcla(N.val('MULTIPLY', dentro, 0.35 * fuerza), col, borde_c)
        orilla = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', d, 0.94)), 0.0, 0.06)), en)
        col = N.mezcla(N.val('MULTIPLY', orilla, 0.85 * fuerza), col, borde_c)
        luz = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', d, 0.82)), 0.0, 0.05)), en)
        col = N.mezcla(N.val('MULTIPLY', luz, 0.35 * fuerza), col, luz_c)
        if c.get('escama_punto'):
            punto = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, d, 0.28, 0.42)), en)
            col = N.mezcla(N.val('MULTIPLY', punto, 0.55 * fuerza), col, borde_c)
    if 'musgo' in c:
        mus = N.ruido(pl, 4.5, detalle=3.0, distorsion=1.4)
        col = lavado_m(N, col, mus, 0.58, 0.05, c['musgo'], N.val('MULTIPLY', P.suave(N, g, 0.1, 0.45), 0.7), borde=0.45)
    # la línea lateral: rayitas a lo largo
    if 'linea' in c:
        a0, a1 = c['linea']
        zl = N.val('ADD', a0 * L, N.val('MULTIPLY', y, a1))
        dz = N.val('ABSOLUTE', N.val('SUBTRACT', z, zl))
        raya = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, dz, 0.0015 * L, 0.0035 * L)), P.suave(N, N.val('FRACT', N.val('DIVIDE', y, 0.012 * L)), 0.2, 0.32))
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', raya, cuerpo_y), 0.3), col, c['oscuro'])
    # el opérculo: la orilla de la agalla, solo el arco de atrás (abierto hacia la cola)
    dy = N.val('SUBTRACT', y, yo * L)
    dzz = N.val('SUBTRACT', z, zo * L)
    r = _largo2(N, dy, N.val('MULTIPLY', dzz, 0.85))
    alto = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', dzz), 0.5 * ro * L, 0.8 * ro * L))
    atras = N.val('MULTIPLY', P.suave(N, dy, 0.0, 0.035 * L), alto)
    arco = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', r, ro * L)), 0.004 * L, 0.01 * L))
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', arco, atras), 0.55), col, c['opercula_color'])
    tras = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', r, (ro + 0.016) * L)), 0.0, 0.008 * L))
    col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', tras, atras), 0.3), col, c['claro'])
    for cic in c.get('cicatrices', []):
        col = _cicatriz(N, col, y, z, x, cic[0], cic[1], cic[2], cic[3], c['cicatriz'], L)
    col = _brillo_humedo(N, col, pl, nz, c['brillo'], fuerza=c.get('brillo_fuerza', 0.45), estira=(4.0, 0.7, 9.0))
    ao = N.n('ShaderNodeAmbientOcclusion', samples=16)
    ao.inputs['Distance'].default_value = 0.035 * L
    col = P.lavado(N, col, ao.outputs['AO'], 0.62, 0.1, c['oscuro'], 0.5, borde=0.2, invertido=True)
    col = P.grano(N, col, pos, 0.1)
    P._salida(N, col)
    return m


def material_aleta(nombre, c):
    """Aleta en acuarela: radios desde la base, la membrana entre ellos, cerca del cuerpo su color y
    la orilla clara (atributo `Aleta`: u × radios, v de la base a la orilla)."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    at = N.n('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='Aleta')
    u, v, az = _xyz(N, at.outputs['Vector'])
    col = N.rampa(v, [(0.0, c['raiz']), (0.3, c['base']), (1.0, c['base'])])
    grande = N.ruido(N.escalar(pos, (40, 40, 40)), 1.0, detalle=2.0, distorsion=1.2)
    col = P.lavado(N, col, grande, 0.58, 0.07, c['claro'], 0.35, borde=0.3)
    col = P.lavado(N, col, grande, 0.42, 0.07, c['rayo'], 0.25, borde=0.3, invertido=True)
    d = N.val('ABSOLUTE', N.val('SUBTRACT', N.val('FRACT', N.val('ADD', u, 0.5)), 0.5))
    linea = N.val('SUBTRACT', 1.0, P.suave(N, d, 0.05, 0.15))
    col = N.mezcla(N.val('MULTIPLY', linea, N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, v, 0.85, 1.0)), 0.6)), col, c['rayo'])
    entre = N.val('MULTIPLY', P.suave(N, d, 0.18, 0.4), P.suave(N, v, 0.2, 0.5))
    col = N.mezcla(N.val('MULTIPLY', entre, 0.22), col, c['claro'])
    bv = N.val('ADD', v, N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(N.escalar(pos, (60, 60, 60)), 1.0, detalle=2.0), 0.5), 0.14))
    col = P.lavado(N, col, bv, c.get('orilla_v', 0.82), 0.035, c['orilla'], c.get('orilla_op', 0.85), borde=0.3)
    if c.get('manchas'):
        mm = N.celdas(N.escalar(pos, (1, 1, 1)), c['manchas'])
        col = P.lavado(N, col, mm.outputs['Distance'], 0.16, 0.03, c['rayo'], 0.5, borde=0.3, invertido=True)
    col = P.grano(N, col, pos, 0.1)
    P._salida(N, col)
    return m


def material_ojo(nombre, origen, centro, r, c):
    """El ojo del pez: aro oscuro, iris de dos tonos, pupila grande y el brillo (el reflejo)."""
    m = P._nuevo(nombre)
    N, pos0, geo, nz = P._base(m)
    pos = _desde(N, pos0, origen)
    x, y, z = _xyz(N, pos)
    ye, ze = centro
    d = N.val('DIVIDE', _largo2(N, N.val('SUBTRACT', y, ye), N.val('SUBTRACT', z, ze)), r)
    col = N.rampa(d, [(0.0, c['iris2']), (0.55, c['iris2']), (0.82, c['iris']), (0.9, c['iris']), (0.94, c['aro']), (1.0, c['aro'])])
    col = P.lavado(N, col, N.ruido(N.escalar(pos, (300, 300, 300)), 1.0, detalle=1.0), 0.6, 0.08, c['iris2'], 0.3, borde=0.2)
    pupila = N.val('SUBTRACT', 1.0, P.suave(N, d, c.get('pupila', 0.5) - 0.03, c.get('pupila', 0.5) + 0.02))
    col = N.mezcla(pupila, col, '#0c0a10')
    b1 = N.val('DIVIDE', _largo2(N, N.val('SUBTRACT', y, ye - 0.24 * r), N.val('SUBTRACT', z, ze + 0.26 * r)), r)
    col = N.mezcla(N.val('SUBTRACT', 1.0, P.suave(N, b1, 0.17, 0.21)), col, '#ffffff')
    b2 = N.val('DIVIDE', _largo2(N, N.val('SUBTRACT', y, ye + 0.17 * r), N.val('SUBTRACT', z, ze - 0.2 * r)), r)
    col = N.mezcla(N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, b2, 0.06, 0.09)), 0.85), col, '#ffffff')
    P._salida(N, col)
    return m


def material_laca(nombre, origen, pintar, fondo=P.MADERA_CLARA, desgaste=0.55, escala=0.1, metal=False, brillo=None):
    """Pintura de laca o esmalte sobre madera (o metal) que se descarapela: `pintar(N, pos_diseño,
    pl, geo, nz)` da el color de la pintura; lo de abajo asoma en las orillas y en desportilladuras
    sueltas, con el filo oscuro de la pintura."""
    m = P._nuevo(nombre)
    N, pos0, geo, nz = P._base(m)
    pos = _desde(N, pos0, origen)
    pl = N.escalar(pos, (1 / escala, 1 / escala, 1 / escala))
    if metal:
        abajo = N.rampa(N.ruido(N.escalar(pl, (4, 4, 4)), 1.0, detalle=2.0), [(0.0, '#5a616c'), (1.0, '#9aa2ad')])
        abajo = P.lavado(N, abajo, N.ruido(pl, 6.0, detalle=2.0, distorsion=1.0), 0.6, 0.05, '#6a3a1e', 0.7, borde=0.4)
    else:
        abajo = N.rampa(N.ruido(N.escalar(pl, (3, 3, 30)), 1.0, detalle=2.0), [(0.0, fondo['media']), (1.0, fondo['clara'])])
    pintura = pintar(N, pos, pl, geo, nz)
    ancha = P.suave(N, P.orilla_bisel(N, geo, 0.035 * escala, 12), 0.01, 0.04)
    cae = N.celdas(P.deformado(N, pl, 7.0, 0.07), 11.0)
    d_cae = N.val('ADD', cae.outputs['Distance'], N.val('SUBTRACT', 1.0, ancha))
    sueltas = N.val('ADD', N.celdas(P.deformado(N, pl, 5.0, 0.08), 6.0).outputs['Distance'], N.val('MULTIPLY', N.ruido(pl, 9.0), 0.3))
    sin = N.val('MINIMUM', N.val('DIVIDE', d_cae, 0.42 * desgaste + 0.01), N.val('DIVIDE', sueltas, 0.3 * desgaste + 0.01))
    queda = P.suave(N, sin, 0.92, 1.06)
    filo = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', sin, 1.0)), 0.0, 0.12))
    pintura = N.mezcla(N.val('MULTIPLY', filo, 0.5), pintura, '#1e1812')
    col = N.mezcla(queda, abajo, pintura)
    if brillo:
        col = _brillo_humedo(N, col, pl, nz, brillo, fuerza=0.5, estira=(2.0, 2.0, 12.0))
    ao = N.n('ShaderNodeAmbientOcclusion', samples=16)
    ao.inputs['Distance'].default_value = 0.08 * escala
    col = P.lavado(N, col, ao.outputs['AO'], 0.6, 0.1, '#1b1612', 0.5, borde=0.2, invertido=True)
    col = P.grano(N, col, pos, 0.1)
    P._salida(N, col)
    return m


def ajustar_luz(mat, a, b):
    """La luz pintada de pintura.py va de oscuro en z = -0.2 a claro en z = 1.4: en un prop chico
    todo queda oscuro. Le pone el rango de alturas del prop."""
    for n in mat.node_tree.nodes:
        if n.type == 'MAP_RANGE' and abs(n.inputs['From Min'].default_value + 0.2) < 1e-6 and abs(n.inputs['From Max'].default_value - 1.4) < 1e-6:
            n.inputs['From Min'].default_value = a
            n.inputs['From Max'].default_value = b


def _capa(mat):
    nt = mat.node_tree
    em = next(n for n in nt.nodes if n.type == 'EMISSION')
    entrada = em.inputs['Color'].links[0].from_socket
    N = P.Nodos.__new__(P.Nodos)
    N.nt = nt
    N.x = 4000 + 180 * len(nt.nodes)
    tc = N.n('ShaderNodeTexCoord')
    geo = N.n('ShaderNodeNewGeometry')
    return N, em, entrada, tc.outputs['Object'], geo


def material_azucar(nombre, color='#f3eee2', destellos=True, detalle=None):
    """Azúcar: blanco con el grano grueso, granitos que brillan y lo hondo cremoso."""
    m = P.material_liso(nombre, color, claro='#ffffff', oscuro='#cbbd9e', orilla='#ffffff')
    N, em, col, pos, geo = _capa(m)
    gr = N.celdas(N.escalar(pos, (1, 1, 1)), 900.0)
    col = P.lavado(N, col, gr.outputs['Distance'], 0.18, 0.05, '#d9ceb4', 0.35, borde=0.0, invertido=True)
    if destellos:
        sc = N.n('ShaderNodeSeparateColor')
        N.l(gr.outputs['Color'], sc.inputs[0])
        brilla = N.val('MULTIPLY', N.val('GREATER_THAN', sc.outputs[0], 0.93), N.val('SUBTRACT', 1.0, P.suave(N, gr.outputs['Distance'], 0.05, 0.12)))
        col = N.mezcla(brilla, col, '#ffffff')
    ao = N.n('ShaderNodeAmbientOcclusion', samples=16)
    ao.inputs['Distance'].default_value = 0.012
    col = P.lavado(N, col, ao.outputs['AO'], 0.7, 0.1, '#b7a27e', 0.45, borde=0.2, invertido=True)
    if detalle:
        col = detalle(N, col, pos, geo)
    N.l(col, em.inputs['Color'])
    return m


def material_plastico(nombre, color, sucio=0.6, rayones=True):
    """Plástico viejo de fondo de laguna: color liso, lodo abajo, manchas de agua, verdín y rayones."""
    m = P.material_liso(nombre, color, desgaste=0.1)
    N, em, col, pos, geo = _capa(m)
    sp = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sp.inputs[0])
    lodo = N.val('ADD', N.val('MULTIPLY', sp.outputs['Z'], 60.0), N.val('MULTIPLY', N.ruido(pos, 90.0, detalle=2.0, distorsion=1.0), 1.4))
    col = P.lavado(N, col, lodo, 0.75, 0.12, '#5a4a32', 0.75 * sucio, borde=0.4, invertido=True)
    verde = N.ruido(pos, 55.0, detalle=3.0, distorsion=1.5)
    col = P.lavado(N, col, verde, 0.64, 0.04, '#5f7a2c', 0.6 * sucio, borde=0.45)
    agua = N.celdas(P.deformado(N, N.escalar(pos, (40, 40, 40)), 3.0, 0.15), 1.6)
    aro = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', agua.outputs['Distance'], 0.32)), 0.0, 0.02))
    aro = N.val('MULTIPLY', aro, P.suave(N, N.ruido(pos, 25.0), 0.5, 0.6))
    col = N.mezcla(N.val('MULTIPLY', aro, 0.22 * sucio), col, '#e8e2cc')
    if rayones:
        ray = N.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL', wave_profile='SIN')
        ray.inputs['Scale'].default_value = 900.0
        ray.inputs['Distortion'].default_value = 12.0
        N.l(pos, ray.inputs['Vector'])
        fino = N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, ray.outputs['Fac'], 0.0, 0.04)), P.suave(N, N.ruido(pos, 30.0), 0.55, 0.62))
        col = N.mezcla(N.val('MULTIPLY', fino, 0.6), col, '#f2eee6')
    N.l(col, em.inputs['Color'])
    return m


def materiales_base():
    """Los materiales que no dependen del acomodo de su prop."""
    M = {}
    M['boca'] = P.material_liso('Pesca_Boca', '#4a141a', claro='#7a2a32', oscuro='#1c0609', orilla='#b05a5e')
    M['acero'] = P.material_metal('Pesca_Acero', paleta=ACERO, oxido=0.12)
    ajustar_luz(M['acero'], -0.02, 0.12)
    M['babero'] = P.material_metal('Pesca_Babero', paleta=CROMO, oxido=0.2)
    ajustar_luz(M['babero'], -0.02, 0.06)
    M['oxidado'] = P.material_metal('Pesca_Oxidado', paleta=OXIDO, oxido=0.95)
    ajustar_luz(M['oxidado'], -0.2, 0.05)
    M['sedal'] = P.material_liso('Pesca_Sedal', '#7d8a5a', orilla='#d8e2b8')
    M['luz_ojo'] = P.material_brillo('Pesca_LuzOjo', '#9ff7e4')
    M['papel'] = P.material_liso('Pesca_Papel', '#17b6c4', claro='#8af4ff', oscuro='#0a5a70', orilla='#ffffff')
    for k, cc, ori in (('glaseado_rosa', '#ff3f96', '#ff9cc8'), ('glaseado_azul', '#2459ff', '#8eacff'), ('glaseado_amarillo', '#ffc81e', '#ffe68a'),
                       ('glaseado_verde', '#34c84e', '#9cf0a8')):
        M[k] = P.material_liso('Pesca_' + k.title().replace('_', ''), cc, orilla=ori)
    M['azucar'] = material_azucar('Pesca_Azucar')
    M['control'] = material_plastico('Pesca_Control', '#9d97ad')
    M['control_cruz'] = material_plastico('Pesca_ControlCruz', '#2c2a33', sucio=0.4)
    M['control_boton0'] = material_plastico('Pesca_ControlBoton0', '#d2353f', sucio=0.35, rayones=False)
    M['control_boton1'] = material_plastico('Pesca_ControlBoton1', '#e6b42a', sucio=0.35, rayones=False)
    M['control_cable'] = material_plastico('Pesca_ControlCable', '#26252b', sucio=0.5, rayones=False)
    M['cobre'] = P.material_metal('Pesca_Cobre', paleta={'oscuro': '#5a2a12', 'base': '#b0602c', 'claro': '#e0904a', 'orilla': '#ffd2a0', 'oxido': '#3e6a4a'}, oxido=0.4)
    ajustar_luz(M['cobre'], -0.02, 0.04)
    M['lata_tapa'] = P.material_metal('Pesca_LataTapa', paleta=ACERO, oxido=0.55)
    ajustar_luz(M['lata_tapa'], 0.0, 0.09)
    M['hoyo'] = P.material_liso('Pesca_LataHoyo', '#18120e', claro='#2e2218', oscuro='#0a0806', orilla='#3a2a1e')
    M['cromo'] = P.material_metal('Pesca_Cromo', paleta=CROMO, oxido=0.25)
    ajustar_luz(M['cromo'], 0.0, 0.45)
    M['caratula'] = P.material_liso('Pesca_Caratula', '#f1e6c6', claro='#fff8e4', oscuro='#c9b78c', orilla='#fffaf0')
    M['aguja'] = P.material_liso('Pesca_Aguja', '#d42a24', claro='#ff6a52', oscuro='#7a1210', orilla='#ffb4a0')
    M['remache'] = P.material_metal('Pesca_Remache', paleta={'oscuro': '#4a3a18', 'base': '#a88a3e', 'claro': '#d8bc6a', 'orilla': '#fff0b8', 'oxido': '#4a3a18'}, oxido=0.2)
    ajustar_luz(M['remache'], 0.0, 0.01)
    return M


COLORES = {
    'mojarra': dict(
        lomo='#3c5379', flanco='#9aaec8', panza='#eef1f4', claro='#d6e2f0', oscuro='#27344d', calido='#b0a0b8', frio='#6f94b8',
        patron='barras', barras=(0.24, 0.82, 0.09), patron_color='#2b3a5a', corte_flanco=-0.35, corte_lomo=0.38,
        opercula=(0.15, 0.0, 0.1), opercula_color='#2b3a5a', brillo='#f4f9ff',
        aleta=dict(raiz='#6f84a6', base='#8597b4', claro='#c2d0e2', rayo='#3c4b6c', orilla='#f2f7fc', orilla_v=0.8, orilla_op=0.95),
        ojo=dict(iris='#c8a24a', iris2='#7a5a2a', aro='#1d2234', pupila=0.52)),
    'carpa': dict(
        lomo='#6a4c14', flanco='#cc9530', panza='#f0d896', claro='#f4cf6a', oscuro='#4a300c', calido='#d4782a', frio='#9a8a42',
        patron=None, escamas=(0.042, 0.034, '#6a4512', '#f6d27a', 1.0), linea=(-0.002, 0.0), corte_flanco=-0.42, corte_lomo=0.36,
        opercula=(0.14, -0.005, 0.1), opercula_color='#5a3a10', brillo='#fff6d0',
        aleta=dict(raiz='#a86e30', base='#a55a30', claro='#d99460', rayo='#5e3216', orilla='#e8a070', orilla_v=0.85, orilla_op=0.6),
        ojo=dict(iris='#e0b040', iris2='#9a6a1e', aro='#2a1e10', pupila=0.5),
        barbilla='#b07a3a'),
    'bass': dict(
        lomo='#344418', flanco='#7c8c3a', panza='#f1ebcc', claro='#b8c46a', oscuro='#1f2a0e', calido='#9a8a3a', frio='#4f7a4a',
        patron='franja', franja_z=(0.004, -0.04), franja_ancho=0.03, franja_fuerza=0.95, patron_color='#1c260b', corte_flanco=-0.38, corte_lomo=0.3,
        linea=(0.034, -0.03), opercula=(0.19, 0.0, 0.1), opercula_color='#1f2a0e', brillo='#f4f8dc',
        aleta=dict(raiz='#5e6c2c', base='#6e7a38', claro='#a8b466', rayo='#323c18', orilla='#c4cc8a', orilla_v=0.84, orilla_op=0.7),
        ojo=dict(iris='#d2782a', iris2='#7a2e12', aro='#1a1a0e', pupila=0.5)),
    'legendario': dict(
        lomo='#1b230e', flanco='#445226', panza='#c6bd94', claro='#6e7a40', oscuro='#0e1309', calido='#6a5226', frio='#2c4a40',
        patron='franja', franja_z=(0.004, -0.04), franja_ancho=0.028, franja_fuerza=0.6, patron_color='#0a0f06',
        escamas=(0.03, 0.026, '#0a0e05', '#65733a', 0.9), escama_punto=True, musgo='#5e7428',
        corte_flanco=-0.45, corte_lomo=0.18, linea=(0.04, -0.03), opercula=(0.19, 0.0, 0.11), opercula_color='#080c04',
        brillo='#cfdcb0', brillo_fuerza=0.35, cicatriz='#e0bcae',
        cicatrices=[((0.3, 0.07), (0.44, 0.02), 0.008, 1), ((0.33, 0.085), (0.46, 0.04), 0.006, 1), ((0.55, -0.06), (0.62, 0.03), 0.007, 1),
                    ((0.16, 0.06), (0.21, 0.005), 0.005, 1),
                    ((0.38, -0.03), (0.5, 0.06), 0.009, -1), ((0.6, 0.06), (0.7, 0.0), 0.006, -1), ((0.24, -0.04), (0.3, 0.03), 0.005, -1)],
        aleta=dict(raiz='#2c3416', base='#38421e', claro='#6a7444', rayo='#161c0a', orilla='#7d8456', orilla_v=0.86, orilla_op=0.55, manchas=40.0),
        ojo=dict(iris='#b8521e', iris2='#5a1a0a', aro='#0e0e08', pupila=0.55)),
}


def pintar_crank(N, pos, pl, geo, nz):
    """El crankbait: lomo verde oscuro, flancos chartreuse con barras de tigre, panza naranja, el ojo
    amarillo pintado y la agalla roja."""
    x, y, z = _xyz(N, pos)
    zn = N.val('DIVIDE', z, 0.016)
    g = N.val('ADD', N.val('MULTIPLY', zn, 0.6), N.val('MULTIPLY', nz, 0.4))
    g = N.val('ADD', g, N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pl, 5.0, detalle=2.0), 0.5), 0.25))
    col = N.rampa(g, [(0.0, '#ff6a14'), (1.0, '#ff6a14')])
    col = P.lavado(N, col, g, -0.3, 0.06, '#c6dc28', 1.0, borde=0.3)
    col = P.lavado(N, col, g, 0.45, 0.07, '#2e5a1c', 0.95, borde=0.35)
    fase = N.val('ADD', N.val('DIVIDE', y, 0.011), N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pl, 4.0), 0.5), 0.6))
    d = N.val('ABSOLUTE', N.val('SUBTRACT', N.val('FRACT', fase), 0.5))
    en = N.val('MULTIPLY', P.suave(N, y, 0.02, 0.026), P.suave(N, g, -0.15, 0.15))
    col = lavado_m(N, col, d, 0.16, 0.04, '#1a2a10', N.val('MULTIPLY', en, 0.85), borde=0.4, invertido=True)
    grande = N.ruido(pl, 3.0, detalle=3.0, distorsion=1.3)
    col = P.lavado(N, col, grande, 0.6, 0.07, '#f4ff8a', 0.25, borde=0.3)
    # la agalla roja
    r = _largo2(N, N.val('SUBTRACT', y, 0.004), N.val('MULTIPLY', z, 0.9))
    arco = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', r, 0.0165)), 0.0007, 0.0016))
    col = N.mezcla(N.val('MULTIPLY', arco, P.suave(N, z, -0.01, -0.004)), col, '#c8202a')
    # el ojo pintado
    d = N.val('DIVIDE', _largo2(N, N.val('SUBTRACT', y, 0.0105), N.val('SUBTRACT', z, 0.0035)), 0.0042)
    col = N.mezcla(N.val('SUBTRACT', 1.0, P.suave(N, d, 0.95, 1.05)), col, '#141016')
    col = N.mezcla(N.val('SUBTRACT', 1.0, P.suave(N, d, 0.8, 0.88)), col, '#ffd21a')
    col = N.mezcla(N.val('SUBTRACT', 1.0, P.suave(N, d, 0.42, 0.5)), col, '#0c0a10')
    b = N.val('DIVIDE', _largo2(N, N.val('SUBTRACT', y, 0.0095), N.val('SUBTRACT', z, 0.0046)), 0.0042)
    col = N.mezcla(N.val('SUBTRACT', 1.0, P.suave(N, b, 0.14, 0.2)), col, '#ffffff')
    return col


def pintar_esmalte(color, claro, oscuro):
    def f(N, pos, pl, geo, nz):
        col = N.rampa(N.ruido(pl, 3.0), [(0.0, color), (1.0, color)])
        grande = N.ruido(pl, 2.6, detalle=3.0, distorsion=1.4)
        col = P.lavado(N, col, grande, 0.58, 0.07, claro, 0.45, borde=0.3)
        col = P.lavado(N, col, grande, 0.42, 0.07, oscuro, 0.4, borde=0.3, invertido=True)
        col = N.mezcla(N.val('MULTIPLY', P.suave(N, nz, 0.4, 0.8), 0.3), col, claro)
        return col
    return f


def pintar_cuchara(N, pos, pl, geo, nz):
    """La cuchara: lo de enfrente (+x) rojo con una franja blanca en zigzag, casi toda caída."""
    x, y, z = _xyz(N, pos)
    col = N.rampa(N.ruido(pl, 3.0), [(0.0, '#b8261e'), (1.0, '#b8261e')])
    onda = N.n('ShaderNodeMath', operation='SINE')
    N.l(N.val('DIVIDE', z, 0.006), onda.inputs[0])
    zz = N.val('ADD', N.val('MULTIPLY', onda.outputs[0], 0.004), y)
    blanco = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', zz), 0.004, 0.0055))
    col = N.mezcla(blanco, col, '#f2ead6')
    frente = P.suave(N, x, 0.0, 0.002)
    return N.mezcla(N.val('SUBTRACT', 1.0, frente), col, '#8e959e')


def material_lata(nombre):
    """La lata: pintura roja deslavada con una ola amarilla, que se arruga con ella (atributo
    `Original`), óxido donde se cayó, lodo abajo y la tapa de lámina."""
    m = P._nuevo(nombre)
    N, pos, geo, nz = P._base(m)
    at = N.n('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='Original')
    o = at.outputs['Vector']
    ox, oy, oz = _xyz(N, o)
    pl = N.escalar(o, (10, 10, 10))
    th = N.n('ShaderNodeMath', operation='ARCTAN2')
    N.l(oy, th.inputs[0])
    N.l(ox, th.inputs[1])
    col = N.rampa(N.ruido(pl, 3.0), [(0.0, '#b8342c'), (1.0, '#b8342c')])
    onda = N.n('ShaderNodeMath', operation='SINE')
    N.l(N.val('MULTIPLY', th.outputs[0], 2.0), onda.inputs[0])
    zz = N.val('SUBTRACT', N.val('ADD', oz, N.val('MULTIPLY', onda.outputs[0], 0.009)), 0.062)
    banda = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', zz), 0.011, 0.0135))
    col = N.mezcla(banda, col, '#f0c22e')
    linea = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('SUBTRACT', N.val('ABSOLUTE', zz), 0.0165)), 0.0, 0.0018))
    col = N.mezcla(linea, col, '#f6efe0')
    col = P.lavado(N, col, N.ruido(pl, 2.5, detalle=3.0, distorsion=1.2), 0.55, 0.08, '#e8d6c6', 0.45, borde=0.3)
    # la tapa y el fondo son lámina
    lamina_m = N.val('MAXIMUM', P.suave(N, oz, 0.11, 0.113), N.val('SUBTRACT', 1.0, P.suave(N, oz, 0.006, 0.01)))
    col = N.mezcla(lamina_m, col, '#9ba3ad')
    oxid = N.val('ADD', N.ruido(pl, 4.0, detalle=3.0, distorsion=1.6), N.val('MULTIPLY', N.val('SUBTRACT', 1.0, P.suave(N, oz, 0.0, 0.05)), 0.3))
    col = P.lavado(N, col, oxid, 0.6, 0.05, '#7a3a18', 0.85, borde=0.45)
    col = P.lavado(N, col, oxid, 0.7, 0.04, '#4a200c', 0.7, borde=0.3)
    sp = N.n('ShaderNodeSeparateXYZ')
    N.l(pos, sp.inputs[0])
    lodo = N.val('ADD', N.val('MULTIPLY', sp.outputs['Z'], 45.0), N.val('MULTIPLY', N.ruido(pl, 6.0, detalle=2.0), 1.2))
    col = P.lavado(N, col, lodo, 0.6, 0.1, '#4e3e28', 0.7, borde=0.4, invertido=True)
    b = P.suave(N, P.orilla_bisel(N, geo, 0.003), 0.01, 0.04)
    col = N.mezcla(N.val('MULTIPLY', b, 0.6), col, '#e8dcc8')
    ao = N.n('ShaderNodeAmbientOcclusion', samples=16)
    ao.inputs['Distance'].default_value = 0.01
    col = P.lavado(N, col, ao.outputs['AO'], 0.65, 0.1, '#20140c', 0.6, borde=0.2, invertido=True)
    col = P.grano(N, col, pos, 0.1)
    P._salida(N, col)
    return m


def detalle_senuelo_cala(zmax):
    """El señuelo de calaverita: lacado, con la cresta de Skulley pintada de azul por en medio de la
    coronilla, gastada."""
    def f(N, col, pos, geo):
        x, y, z = _xyz(N, pos)
        cresta = N.val('SUBTRACT', 1.0, P.suave(N, N.val('ABSOLUTE', N.val('ADD', x, N.val('MULTIPLY', N.val('SUBTRACT', N.ruido(pos, 120.0), 0.5), 0.003))), 0.0032, 0.0044))
        arriba = P.suave(N, z, zmax - 0.02, zmax - 0.012)
        gasto = P.suave(N, N.ruido(pos, 180.0, detalle=2.0), 0.3, 0.42)
        col = N.mezcla(N.val('MULTIPLY', N.val('MULTIPLY', cresta, arriba), N.val('MULTIPLY', gasto, 0.92)), col, '#2b5cff')
        col = _brillo_humedo(N, col, N.escalar(pos, (30, 30, 30)), _xyz(N, geo.outputs['Normal'])[2], '#ffffff', fuerza=0.45, estira=(2.0, 2.0, 10.0))
        return col
    return f


def materiales_props(M, origenes, pf, aguja_eje, img_caratula, centro_dial):
    """Los materiales que dependen de dónde quedó cada prop (sus coordenadas de diseño)."""
    for clave in ('mojarra', 'carpa', 'bass', 'legendario'):
        c = COLORES[clave]
        org, perfil = origenes[clave], pf[clave]
        cfg = PEZ[clave]
        L, Lb = perfil.L, perfil.Lb
        cc = dict(c)
        yo, zo, ro = c['opercula']
        cc['opercula'] = (yo, zo, ro)
        material_pez(f'Pesca_{clave.title()}', org, perfil, cc)
        material_aleta(f'Pesca_{clave.title()}Aleta', c['aleta'])
        o = cfg['ojo']
        material_ojo(f'Pesca_{clave.title()}Ojo', org, (o['t'] * Lb, o['z'] * L), o['r'] * L, c['ojo'])
    P.material_liso('Pesca_CarpaBarbilla', COLORES['carpa']['barbilla'], orilla='#f0c890')
    material_laca('Pesca_Senuelo', origenes['senuelo'], pintar_crank, desgaste=0.45, escala=0.06, brillo='#ffffff')
    material_laca('Pesca_Cuchara', origenes['legendario'], pintar_cuchara, desgaste=1.1, escala=0.05, metal=True)
    material_laca('Pesca_Bascula', origenes['bascula'], pintar_esmalte('#1f8a7c', '#4fc0ae', '#0e4a44'), desgaste=0.35, escala=0.25, metal=True)
    zmax = bpy.data.objects['Prop_SenueloCalaverita'].data['zmax_craneo']
    material_azucar('Pesca_AzucarSenuelo', '#f2e4c4', detalle=detalle_senuelo_cala(zmax))
    material_lata('Pesca_Lata')
    P.calca(bpy.data.materials['Pesca_Caratula'], img_caratula, centro=centro_dial, ancho=2 * (0.092 - 0.012), normal=(0, -1, 0), color='#1c1813', gasto=0.12)


def crear_vacios():
    """Los materiales que se pintan después de acomodar su prop: se crean con nombre para armar."""
    M = {}
    for clave in ('mojarra', 'carpa', 'bass', 'legendario'):
        t = clave.title()
        M[clave] = {'cuerpo': bpy.data.materials.new(f'Pesca_{t}'), 'aleta': bpy.data.materials.new(f'Pesca_{t}Aleta'),
                    'ojo': bpy.data.materials.new(f'Pesca_{t}Ojo')}
    M['carpa']['barbilla'] = bpy.data.materials.new('Pesca_CarpaBarbilla')
    for k, n in (('senuelo', 'Pesca_Senuelo'), ('cuchara', 'Pesca_Cuchara'), ('bascula', 'Pesca_Bascula'),
                 ('azucar_senuelo', 'Pesca_AzucarSenuelo'), ('lata', 'Pesca_Lata')):
        M[k] = bpy.data.materials.new(n)
    return M


# ---------------------------------------------------------------- atlas

def encoger_islas(o, factor_de):
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.active
    bm.faces.ensure_lookup_table()
    padre = list(range(len(bm.faces)))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i
    for e in bm.edges:
        if len(e.link_faces) != 2:
            continue
        f1, f2 = e.link_faces
        l1 = next(lp for lp in f1.loops if lp.edge == e)
        l2 = next(lp for lp in f2.loops if lp.edge == e)
        a1, b1 = l1[uvl].uv, l1.link_loop_next[uvl].uv
        a2, b2 = l2[uvl].uv, l2.link_loop_next[uvl].uv
        if (a1 - b2).length < 1e-5 and (b1 - a2).length < 1e-5:
            padre[raiz(f1.index)] = raiz(f2.index)
    islas = {}
    for f in bm.faces:
        islas.setdefault(raiz(f.index), []).append(f)
    for caras in islas.values():
        area = sum(f.calc_area() for f in caras) or 1e-9
        n = sum((f.normal * f.calc_area() for f in caras), Vector()) / area
        k = factor_de(n)
        if k == 1.0:
            continue
        lps = [lp for f in caras for lp in f.loops]
        c = sum((lp[uvl].uv for lp in lps), Vector((0, 0))) / len(lps)
        for lp in lps:
            lp[uvl].uv = c + (lp[uvl].uv - c) * k
    bm.to_mesh(me)
    bm.free()


def uv_atlas_pesos(objs, pesos, margen=0.0025):
    activar(objs[0])
    for o in objs:
        o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in objs:
        s = pesos.get(o.name, 1.0)
        uv = o.data.uv_layers.active.data
        co = np.empty(len(uv) * 2, np.float32)
        uv.foreach_get('uv', co)
        uv.foreach_set('uv', co * s)
    for o in objs:
        if o.name in ('Prop_Lata', 'Prop_Control', 'Prop_Bascula', 'Prop_Calaverita'):
            encoger_islas(o, lambda n: 0.4 if n.z < -0.6 else 1.0)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    try:
        bpy.ops.uv.select_all(action='SELECT')
    except RuntimeError:
        pass
    bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', margin=margen, margin_method='FRACTION', shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')


def densidad(objs, tam):
    total = 0.0
    for o in objs:
        me = o.data
        uv = me.uv_layers[0].data
        a3 = auv = 0.0
        for p in me.polygons:
            a3 += p.area
            pts = [uv[i].uv for i in p.loop_indices]
            auv += abs(sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts)))) / 2
        total += auv
        print(f'  {o.name:28s} {tam * math.sqrt(auv / a3):6.0f} px/m')
    print(f'  atlas usado: {total * 100:.0f} %')


# ---------------------------------------------------------------- comandos

def objetos():
    props = [bpy.data.objects[n] for n in PROPS]
    hijos = [bpy.data.objects[n] for lista in HIJOS.values() for n in lista]
    return props, hijos


def armar():
    P.limpiar()
    random.seed(SEMILLA)
    fuente, ojos = cabeza_skulley()
    M = materiales_base()
    M.update(crear_vacios())
    origenes, perfiles = {}, {}
    props = []
    for clave in ('mojarra', 'carpa', 'bass', 'legendario'):
        o, c, pf = pez(clave, M)
        origenes[clave], perfiles[clave] = c, pf
        props.append(o)
    o, t = senuelo(M)
    origenes['senuelo'] = t
    props.append(o)
    o, t, luz = senuelo_calaverita(M, fuente, ojos)
    origenes['calaverita_senuelo'] = t
    props.append(o)
    o, t = lata(M)
    props.append(o)
    o, t = control(M)
    props.append(o)
    o, t = calaverita(M, fuente, ojos)
    props.append(o)
    caratula = dibujo_caratula()
    h, w = caratula.shape
    img = bpy.data.images.new('Pesca_Caratula_Dibujo', w, h, alpha=True)
    px = np.ones((h, w, 4), np.float32)
    px[..., 3] = caratula
    img.pixels.foreach_set(px.ravel())
    img.pack()
    o, t, aguja, eje = bascula(M, img)
    origenes['bascula'] = t
    props.append(o)
    bpy.data.objects.remove(fuente, do_unlink=True)
    centro_dial = (eje.x, eje.z)
    materiales_props(M, origenes, perfiles, eje, img, centro_dial)
    # los hijos: la luz de los ojos con el origen del señuelo; la aguja con el origen en su eje
    for padre_n, hijo, loc in (('Prop_SenueloCalaverita', luz, Vector()), ('Prop_Bascula', aguja, eje)):
        padre = bpy.data.objects[padre_n]
        hijo.data.name = hijo.name
        hijo.parent = padre
        hijo.matrix_parent_inverse = Matrix.Identity(4)
        hijo.location = loc
    P.fila(props, separacion=0.12)
    # los peces se ven en fila apoyados, pero su origen es su centro de masa
    bpy.context.view_layer.update()
    todos = props + [luz, aguja]
    uv_atlas_pesos(todos, PESOS)
    densidad(todos, TAM)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    reporte(props)


def reporte(props):
    total = 0
    for o in props:
        objs = [o] + list(o.children)
        t = P.triangulos(objs)
        total += t
        xs = [(o.matrix_world @ Vector(c)) for oo in objs for c in oo.bound_box]
        d = [max(p[i] for p in xs) - min(p[i] for p in xs) for i in range(3)]
        hijos = ', '.join(f'{h.name} {P.triangulos([h])}' for h in o.children)
        print(f'  {o.name:24s} {d[0]:5.3f} x {d[1]:5.3f} x {d[2]:5.3f} m  {t:6d} triángulos {hijos}')
    print(f'  total {total} triángulos')
    print('  traspasos:')
    for a, b, n in TRASPASOS:
        print(f'    {n:4d}  {a} / {b}')


def pintar(tam=TAM, muestras=64):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = objetos()
    P.hornear_atlas(props + hijos, PNG, tam=tam, muestras=muestras)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('pintado:', PNG)


def _un_material(objs):
    for o in objs:
        n = len(o.data.polygons)
        o.data.polygons.foreach_set('material_index', np.zeros(n, np.int32))


def exportar():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = objetos()
    _un_material(props + hijos)
    peso = P.exportar_glb(props + hijos, PNG, GLB)
    print(f'exportado: {GLB} {peso} bytes')


def render(carpeta, con_atlas=True):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    props, hijos = objetos()
    todos = props + hijos
    if con_atlas and os.path.exists(PNG):
        _un_material(todos)
        m = P.material_final(PNG, 'props_pesca')
        for o in todos:
            o.data.materials.clear()
            o.data.materials.append(m)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('fondo')
    w.node_tree.nodes['Background'].inputs['Color'].default_value = P.srgb('#3a3f52')
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.5
    sc.world = w
    sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN'))
    sol.data.energy = 2.6
    sol.rotation_euler = (math.radians(45), 0, math.radians(35))
    sc.collection.objects.link(sol)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 50
    cam.data.clip_start = 0.002
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x = 1200
    sc.render.resolution_y = 900
    os.makedirs(carpeta, exist_ok=True)
    vfov = 2 * math.atan(18 / 50 * 900 / 1200)

    def foto(visibles, nombre, vistas=((-30, 22), (150, 22)), centro=None, radio=None):
        for o in todos:
            o.hide_render = o not in visibles
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in visibles for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        c = centro or (lo + hi) / 2
        r = radio or (hi - lo).length / 2
        rutas = []
        for i, (az, el) in enumerate(vistas):
            a, e = math.radians(az - 90), math.radians(el)
            d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
            cam.location = c + d * (r / math.sin(vfov / 2) * 0.85)
            cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
            cam.data.clip_end = 100
            ruta = os.path.join(carpeta, f'{nombre}_{i}.png')
            sc.render.filepath = ruta
            bpy.ops.render.render(write_still=True)
            rutas.append(ruta)
        return rutas
    for n in PECES:
        o = bpy.data.objects[n]
        foto([o], n, vistas=((90, 4), (48, 22), (-60, 18)))
    for n in ('Prop_Senuelo',):
        o = bpy.data.objects[n]
        foto([o], n, vistas=((90, 6), (40, 24), (-35, 30)))
    o = bpy.data.objects['Prop_SenueloCalaverita']
    foto([o] + list(o.children), 'Prop_SenueloCalaverita', vistas=((0, 8), (-35, 20), (90, 6)))
    for n in ('Prop_Lata', 'Prop_Control', 'Prop_Calaverita'):
        o = bpy.data.objects[n]
        foto([o] + list(o.children), n, vistas=((-30, 30), (0, 10), (150, 30)))
    b = bpy.data.objects['Prop_Bascula']
    foto([b] + list(b.children), 'Prop_Bascula', vistas=((0, 4), (-35, 15), (90, 4)))
    ag = bpy.data.objects['Prop_Bascula_Aguja']
    ag.rotation_euler = (0, math.radians(7.4 * GRADOS_POR_KG), 0)
    bpy.context.view_layer.update()
    foto([b] + list(b.children), 'Prop_Bascula_740kg', vistas=((0, 4),), centro=(ag.matrix_world.translation), radio=0.1)
    ag.rotation_euler = (0, 0, 0)
    foto([o for o in todos], 'grupo', vistas=((-20, 30),))
    print('render:', carpeta)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['todo']
    cmd = args[0]
    rapido = 'rapido' in args
    carpeta = next((a for a in args[1:] if a not in ('rapido',)), FOTOS)
    if cmd in ('armar', 'todo'):
        armar()
    if cmd in ('pintar', 'todo'):
        pintar(1024 if rapido else TAM, 16 if rapido else 64)
    if cmd in ('exportar', 'todo'):
        exportar()
    if cmd in ('render', 'todo'):
        render(carpeta)
    if cmd == 'formas':
        render(carpeta, con_atlas=False)
