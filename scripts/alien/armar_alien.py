"""
Rig del Unemployed Alien (el personaje nuevo de Oscar), sobre
public/3dmodels/unemployedAlien.glb, con las reglas del de Argus
(scripts/argus/armar_argus.py): esqueleto limpio con el reposo en la pose que se
ve, pesos calculados aquí, cara (párpados agregados, quijada y lengua) y la mochila
rígida en su propio hueso.

Se corre con Blender 5.3 en segundo plano:
  "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --python scripts/alien/armar_alien.py -- todo

  todo      armar + exportar + medir + fotos
  armar     importa el GLB, arma huesos, pesos y cara; guarda el .blend (BLEND)
  exportar  exporta el GLB del sitio (SALIDA) desde el .blend
  medir     cuánto se sale una capa de la que la tapa, en las poses de prueba
  fotos     renders de revisión (carpeta en el argumento, o FOTOS)

unemployedAlien.glb no se toca.

El GLB viene en milímetros, de una sola malla con 73 piezas sueltas y un solo
material: traje y pantalón de dos cascarones (el de adentro con las normales hacia
adentro), guantelete del codo a los dedos, botas con rollo, y la piel verde
completa debajo de todo. La piel escondida (brazos, manos, piernas y el torso bajo
el traje) se quita: nunca se ve y, inflada por el contorno del sitio, se saldría.

Esqueleto (armature Alien, en el origen, escala 1, metros, Z arriba, mira a -Y,
suelas en z = 0). Los nombres no llevan puntos (GLTFLoader los borra: `hand.L`
llega como `handL`); el lado va al final con _L / _R (L = izquierda del alien, +X).

  raiz (no deforma)
    hips
      spine > chest > neck > head > quijada > lengua_1 > lengua_2
                              head > ojo_L > parpado_sup_L_0.._2, parpado_inf_L_0.._2 (y _R)
              chest > mochila
              chest > shoulder_L > upper_arm_L > lower_arm_L > hand_L >
                        thumb_01_L.._03, index_01_L.._03, middle_01_L.._03, ring_01_L.._03
      upper_leg_L > lower_leg_L > foot_L > toes_L

Ejes (Y siempre a lo largo del hueso; girar +X es "doblar"):
  hips, spine, chest, neck, head   Z al frente: +X se dobla hacia adelante.
  shoulder_*                       Z arriba: +X sube el hombro.
  upper_arm_*, lower_arm_*         Z al frente: +X lleva el brazo / dobla el codo hacia adelante.
  hand_*, dedos                    Z hacia la palma: +X cierra la mano / el dedo.
  upper_leg_*                      Z al frente: +X sube la pierna hacia adelante.
  lower_leg_*                      Z atrás: +X dobla la rodilla.
  foot_*, toes_*                   Z arriba: +X levanta la punta.
  quijada                          Y hacia la barbilla, X a la izquierda del alien: +X abre.
  lengua_1, lengua_2               Y de la raíz a la punta, X a su izquierda: +X baja la punta.
  ojo_*                            Y hacia afuera del ojo, X por el eje largo hacia la
                                   izquierda del alien. Solo escala (el ojo es un
                                   elipsoide: girado se saldría de la cuenca).
  parpado_sup_*_0..2               mismos ejes que el ojo: +X cierra (baja). Tres a lo
                                   ancho del ojo, de menor a mayor X del ojo: el 0 es la
                                   punta de adentro en el ojo izquierdo y la de afuera
                                   en el derecho. Cada uno cierra su propio ángulo.
  parpado_inf_*_0..2               X al revés: +X cierra (sube).
  mochila                          Y arriba, Z al frente. Rígida: todo su peso es suyo.

Cierre de los párpados: el ángulo de cada uno queda en la propiedad `cara` del
armature (va en los extras del GLB) y se imprime al armar.
"""
import bpy
import bmesh
import heapq
import json
import math
import os
import sys
import tempfile

import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

_REPOS = [r"D:\Work\mroscar\Website\new\Skulley-Rad-Portfolio"]
REPO = next((r for r in _REPOS if os.path.isdir(os.path.join(r, "public"))), _REPOS[0])
GLB = os.path.join(REPO, "public", "3dmodels", "unemployedAlien.glb")
SALIDA = os.path.join(REPO, "public", "3dmodels", "unemployedAlien_rig.glb")
BLEND = os.path.join(REPO, "Character", "UnemployedAlien.blend")
FOTOS = os.path.join(tempfile.gettempdir(), "revision_alien")

ESCALA = 0.001        # el GLB viene en milímetros
Y0 = 0.04             # se corre el modelo para que la cadera quede en y = 0

# Alturas (z, en metros, suelas en 0) medidas en el modelo. El cinturón va de 0.616
# a 0.727 y es rígido con la cadera; el cuello visible es de 1 cm entre el cuello de
# la chamarra (arriba en 1.066) y la cabeza.
Z_CADERA = 0.586      # articulación de la cadera (debajo del cinturón)
Z_HIPS_SPINE = (0.745, 0.79)
Z_SPINE_CHEST = (0.80, 0.87)
Z_CHEST_NECK = (1.055, 1.068)
Z_NECK_HEAD = (1.072, 1.082)
Y_COLUMNA = 0.01
Y_CUELLO = 0.043
Z_TOBILLO = 0.10
Y_BOLA = -0.10        # bola del pie (donde dobla la punta de la bota)
Y_PUNTA = -0.19
# La quijada: pivote detrás de la boca y el plano que separa el labio de arriba (y
# el paladar) del de abajo, medidos en un corte por x = 0.
QUIJADA_PIVOTE = Vector((0.0, -0.11, 1.171))
QUIJADA_NORMAL = Vector((0.0, -0.312, 0.950))   # arriba del plano: cabeza
# Corte entre brazo y torso: plano por CORTE_HOMBRO con normal (1, 0, 0.3) (en el
# lado izquierdo); baja hacia afuera, del hombro a la axila.
CORTE_HOMBRO = Vector((0.15, 0.0, 0.95))
CORTE_NORMAL = Vector((1.0, 0.0, 0.3)).normalized()
# Párpados
MARGEN_PARPADO = 0.0015   # holgura entre el párpado de abajo y el ojo
PARPADO_HUESOS = (-0.8, 0.0, 0.8)   # dónde va cada hueso del párpado, en semiejes largos
EXTRA_SUP = 0.0015        # el de arriba va un poco más afuera: tapa al de abajo al cerrar
GRUESO_LABIO = 0.003
MARGEN_ABIERTO = 4.0      # grados de más, abiertos, detrás de la orilla de la cuenca
MEZCLA_CIERRE = 0.62      # dónde se juntan (0 = orilla de arriba, 1 = la de abajo)
TRASLAPE = 2.0            # grados que cada párpado pasa de la junta al cerrar
BANDA_CODO = 0.07         # largo de la banda de cada coyuntura (m), centrada en ella
BANDA_RODILLA = 0.06


def ss(x, a, b):
    """smoothstep de a (0) a b (1); con a > b baja."""
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _norm(v):
    v = np.asarray(v, dtype=float)
    return v / max(1e-12, np.linalg.norm(v))


def _espejo(p):
    return np.array([-p[0], p[1], p[2]])


# ---------------------------------------------------------------- piezas

def _islas(me):
    n = len(me.vertices)
    ev = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", ev)
    par = list(range(n))

    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x
    for a, b in ev.reshape(-1, 2):
        ra, rb = find(int(a)), find(int(b))
        if ra != rb:
            par[ra] = rb
    raiz = np.array([find(i) for i in range(n)])
    _, isla = np.unique(raiz, return_inverse=True)
    return isla


def _pixeles(nombre):
    im = bpy.data.images[nombre]
    w, h = im.size
    a = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def _muestrear(T, uv):
    h, w, _ = T.shape
    x = np.clip((uv[:, 0] % 1.0) * w, 0, w - 1).astype(int)
    y = np.clip((uv[:, 1] % 1.0) * h, 0, h - 1).astype(int)
    return T[y, x, :3]


def _uv_vertice(me):
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers[0].data.foreach_get("uv", uv)
    lv = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", lv)
    out = np.zeros((len(me.vertices), 2))
    out[lv] = uv.reshape(-1, 2)
    return out


def _coords(me):
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def clasificar(me):
    """Cada pieza por su color (textura base en sus UV) y su lugar."""
    P = _coords(me)
    isla = _islas(me)
    col = _muestrear(_pixeles("Image_0"), _uv_vertice(me))
    piezas = {}
    for k in range(isla.max() + 1):
        ids = np.where(isla == k)[0]
        c = col[ids].mean(0)
        lo, hi = P[ids].min(0), P[ids].max(0)
        piezas[k] = {"ids": ids, "col": c, "lo": lo, "hi": hi, "c": (lo + hi) / 2}

    def es_verde(c):
        return c[1] > 0.7 and c[0] < 0.6

    def es_lila(c):
        return c[0] > 0.5 and c[2] > 0.9 and 0.38 < c[1] < 0.6
    verdes = [k for k, p in piezas.items() if es_verde(p["col"])]
    cabeza = max(verdes, key=lambda k: len(piezas[k]["ids"]))
    G = {"cabeza": cabeza, "piel_oculta": [], "ojos": {"L": [], "R": []}, "lengua": [],
         "mochila": [], "cinturon": [], "aro_codo": {}, "puno": {}, "rollo": {"L": [], "R": []},
         "mano_piel": {}, "brazo_piel": {}, "pierna_piel": {}}
    for k in verdes:
        if k == cabeza:
            continue
        p = piezas[k]
        G["piel_oculta"].append(k)
        lado = "L" if p["c"][0] > 0 else "R"
        if abs(p["c"][0]) > 0.6:
            G["mano_piel"][lado] = k
        elif abs(p["c"][0]) > 0.25 and p["hi"][0] - p["lo"][0] > 0.3:
            G["brazo_piel"][lado] = k
        elif p["c"][2] < 0.45:
            G["pierna_piel"][lado] = k
    for k, p in piezas.items():
        c, lo, hi, n = p["col"], p["lo"], p["hi"], len(p["ids"])
        lado = "L" if p["c"][0] > 0 else "R"
        if c.max() < 0.06 and lo[2] > 1.1:
            G["ojos"][lado].append(k)
        elif c[0] > 0.8 and c[1] < 0.5 and c[2] > 0.5 and lo[2] > 1.05:
            G["lengua"].append(k)
        elif lo[1] > 0.08:
            G["mochila"].append(k)
        elif lo[2] > 0.57 and hi[2] < 0.76 and abs(p["c"][0]) < 0.2:
            G["cinturon"].append(k)
        elif es_lila(c) and n > 150 and 0.3 < abs(p["c"][0]) < 0.6:
            G["aro_codo" if abs(p["c"][0]) < 0.42 else "puno"].setdefault(lado, []).append(k)
        elif es_lila(c) and 0.28 < p["c"][2] < 0.4 and abs(p["c"][0]) < 0.2:
            G["rollo"][lado].append(k)
    for d in ("aro_codo", "puno"):
        for lado in ("L", "R"):
            assert len(G[d].get(lado, [])) == 1, (d, lado, G[d])
            G[d][lado] = G[d][lado][0]
    return piezas, G


# ---------------------------------------------------------------- medidas

def _plano(Q, hacia):
    c = Q.mean(0)
    _, _, vt = np.linalg.svd(Q - c, full_matrices=False)
    n = vt[2]
    if n @ hacia < 0:
        n = -n
    return c, n


def _vecinos(me):
    nb = {}
    ev = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", ev)
    for a, b in ev.reshape(-1, 2):
        nb.setdefault(int(a), []).append(int(b))
        nb.setdefault(int(b), []).append(int(a))
    return nb


def _dijkstra(P, nb, src, permitidos):
    D = {s: 0.0 for s in src}
    h = [(0.0, s) for s in src]
    while h:
        d, a = heapq.heappop(h)
        if d > D.get(a, 1e9):
            continue
        for b in nb.get(a, ()):
            if b not in permitidos:
                continue
            nd = d + float(np.linalg.norm(P[a] - P[b]))
            if nd < D.get(b, 1e9):
                D[b] = nd
                heapq.heappush(h, (nd, b))
    return D


def _dedos(P, nb, ids, eje):
    """Pulgar, índice, medio y anular de la mano de piel escondida (malla limpia de
    cuatro dedos): puntas = máximos de la distancia geodésica desde la muñeca; cada
    dedo es la región que se separa de la palma (componente arriba del nivel donde
    se une con otra), y su eje sale de rebanadas a lo largo de esa región."""
    ids_s = set(int(i) for i in ids)
    t = {i: float(P[i] @ eje) for i in ids_s}
    tmin = min(t.values())
    D = _dijkstra(P, nb, [i for i in ids_s if t[i] < tmin + 0.004], ids_s)
    puntas = []
    for i in ids_s:
        anillo, frente = {i}, {i}
        for _ in range(4):
            frente = {b for x in frente for b in nb[x] if b in ids_s} - anillo
            anillo |= frente
        if all(D[i] >= D[j] for j in anillo):
            puntas.append(i)
    # componentes de arriba hacia abajo: dónde se une cada punta
    orden = sorted(ids_s, key=lambda i: -D[i])
    par, de_punta, union, procesados = {}, {}, {}, []

    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x
    for i in orden:
        par[i] = i
        raices = {find(j) for j in nb[i] if j in par}
        con_punta = [r for r in raices if de_punta.get(r)]
        if len(con_punta) >= 2:
            for r in con_punta:
                if len(de_punta[r]) == 1:
                    tp = next(iter(de_punta[r]))
                    if tp not in union:
                        union[tp] = (D[i], [v for v in procesados if find(v) == r])
        ts = set()
        for r in raices:
            ts |= de_punta.get(r, set())
            par[r] = i
        if i in puntas:
            ts.add(i)
        de_punta[i] = ts
        procesados.append(i)
    candidatas = [p for p in puntas if p in union]
    pulgar = min(candidatas, key=lambda p: union[p][0])
    resto = sorted([p for p in candidatas if p != pulgar], key=lambda p: -D[p])[:3]
    resto.sort(key=lambda p: P[p][1])          # de adelante (-y) hacia atrás
    dedos = {}
    for nombre, tp in zip(("thumb", "index", "middle", "ring"), [pulgar] + resto):
        reg = np.array(union[tp][1] + [tp])
        Q = P[reg]
        c = Q.mean(0)
        _, _, vt = np.linalg.svd(Q - c, full_matrices=False)
        a = vt[0] if (P[tp] - c) @ vt[0] > 0 else -vt[0]
        s = (Q - c) @ a
        linea = []
        for b in np.linspace(s.min() + 0.006, s.max() - 0.006, 7):
            m = np.abs(s - b) < 0.008
            if m.sum() >= 3:
                linea.append(Q[m].mean(0))
        linea = np.array(linea)
        base = linea[0] - _norm(linea[1] - linea[0]) * 0.012
        dedos[nombre] = np.vstack([base, linea])
    return dedos


def _repartir(linea, fr=(0.40, 0.72)):
    """Base, dos coyunturas y punta a lo largo de la polilínea."""
    L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(linea, axis=0), axis=1))]

    def en(u):
        k = min(len(L) - 2, int(np.searchsorted(L, u, side="right") - 1))
        t = (u - L[k]) / max(1e-9, L[k + 1] - L[k])
        return linea[k] + (linea[k + 1] - linea[k]) * t
    return [linea[0], en(L[-1] * fr[0]), en(L[-1] * fr[1]), linea[-1]]


def medir_esqueleto(me, G):
    """Articulaciones del lado izquierdo (+x); el derecho es su espejo (el modelo es
    simétrico: las manos son espejo exacto)."""
    P = _coords(me)
    J = {}
    # brazo: eje de la piel escondida del brazo
    A = P[np.where(np.isin(_islas_cache["isla"], [G["brazo_piel"]["L"]]))[0]]
    c = A.mean(0)
    _, _, vt = np.linalg.svd(A - c, full_matrices=False)
    ax = vt[0] if vt[0][0] > 0 else -vt[0]
    t = (A - c) @ ax
    m = np.abs(t - (t.min() + 0.045)) < 0.02
    J["hombro"] = c + ax * ((A[m].mean(0) - c) @ ax)
    J["hombro"][1] = A[m].mean(0)[1]

    def cruce(pc, n):
        return c + ax * (((pc - c) @ n) / (ax @ n))
    aro = P[_ids(G["aro_codo"]["L"])]
    ca, na = _plano(aro, ax)
    # el codo, en el centro del aro (la boca del guantelete)
    J["codo"] = cruce(ca, na)
    pu = P[_ids(G["puno"]["L"])]
    cp, npu = _plano(pu, ax)
    lejos = cp + npu * float(((pu - cp) @ npu).max())
    J["muneca"] = cruce(lejos, npu) + ax * 0.02
    J["plano_puno"] = (lejos, npu)
    J["eje_brazo"] = ax
    # mano y dedos
    dedos = _dedos(P, _vecinos(me), _ids(G["mano_piel"]["L"]), ax)
    J["dedos"] = {k: _repartir(v) for k, v in dedos.items()}
    nud = np.mean([J["dedos"][k][0] for k in ("index", "middle", "ring")], axis=0)
    J["nudillos"] = nud
    dir_mano = _norm(nud - J["muneca"])
    lat = _norm(J["dedos"]["ring"][0] - J["dedos"]["index"][0])
    npalma = _norm(np.cross(dir_mano, lat))
    puntas = np.mean([J["dedos"][k][3] for k in ("index", "middle", "ring")], axis=0)
    v = puntas - nud
    v = v - (v @ dir_mano) * dir_mano
    if npalma @ v < 0:
        npalma = -npalma
    J["palma"] = npalma
    # pierna: piel escondida de la pierna y el rollo de la bota
    L = P[_ids(G["pierna_piel"]["L"])]
    x_pierna = float(np.median(L[:, 0]))
    arriba = L[L[:, 2] > L[:, 2].max() - 0.05]
    J["cadera"] = np.array([x_pierna, float(arriba[:, 1].mean()), Z_CADERA])
    R = P[np.concatenate([_ids(k) for k in G["rollo"]["L"]])]
    cr, nr = _plano(R, np.array([0, 0, -1.0]))
    alto = float(np.abs((R - cr) @ nr).max())
    J["plano_rollo"] = (cr, nr, alto)
    J["rodilla"] = np.array([x_pierna, cr[1], cr[2] + alto + 0.004 + BANDA_RODILLA * 0.45])
    tob = L[np.abs(L[:, 2] - (Z_TOBILLO + 0.02)) < 0.015]
    J["tobillo"] = np.array([x_pierna, float(tob[:, 1].mean()), Z_TOBILLO])
    J["bola"] = np.array([x_pierna, Y_BOLA, 0.035])
    J["punta"] = np.array([x_pierna, Y_PUNTA, 0.035])
    return J


_islas_cache = {}


def _ids(k):
    return np.where(_islas_cache["isla"] == k)[0]


# ---------------------------------------------------------------- importar

def importar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    src = next(o for o in bpy.data.objects if o.type == "MESH")
    me = src.data
    me.transform(src.matrix_world)
    me.transform(Matrix.Scale(ESCALA, 4))
    zmin = min(v.co.z for v in me.vertices)
    me.transform(Matrix.Translation((0.0, -Y0, -zmin)))
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    # las normales del GLB, guardadas por esquina (bmesh conserva el atributo) para
    # ponerlas otra vez al final
    cn = np.empty(len(me.loops) * 3)
    me.corner_normals.foreach_get("vector", cn)
    me.attributes.new("n_glb", "FLOAT_VECTOR", "CORNER").data.foreach_set("vector", cn)
    obj = bpy.data.objects.new("Alien_malla", me)
    bpy.context.scene.collection.objects.link(obj)
    for o in list(bpy.data.objects):
        if o is not obj:
            bpy.data.objects.remove(o)
    me.name = "Alien_malla"
    return obj


def _quitar_ocultas(obj, G, z_corte=1.03, direcciones=120):
    """Quita la piel que nunca se ve: las piezas verdes escondidas (brazos, manos,
    piernas) si ningún vértice se ve desde ninguna dirección, y del torso de la
    pieza de la cabeza las caras escondidas debajo de z_corte (el cuello, dentro
    del cuello de la chamarra, se queda)."""
    me = obj.data
    P = _coords(me)
    caras = [list(p.vertices) for p in me.polygons]
    bvh = BVHTree.FromPolygons([Vector(p) for p in P], caras)
    k = np.arange(direcciones) + 0.5
    phi = np.arccos(1 - 2 * k / direcciones)
    th = np.pi * (1 + 5 ** 0.5) * k
    dirs = [Vector(d) for d in np.c_[np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)]]

    def visible(i):
        o = Vector(P[i])
        for d in dirs:
            if bvh.ray_cast(o + d * 0.0015, d, 5.0)[0] is None:
                return True
        return False
    quitar = set()
    for k in G["piel_oculta"]:
        ids = _ids(k)
        vis = sum(1 for i in ids if visible(int(i)))
        print("PIEL_OCULTA", k, len(ids), "visibles", vis)
        # un vértice suelto que se asoma por una rendija no cuenta
        if vis <= 0.01 * len(ids):
            quitar.update(int(i) for i in ids)
    torso = [int(i) for i in _ids(G["cabeza"]) if P[i][2] < z_corte]
    # todo el torso de piel bajo el traje: los pocos vértices que se asoman por una
    # rendija quedaban como pedacitos sueltos que el traje no tapaba al doblarse
    escondidos = set(torso)
    print("TORSO_PIEL", len(torso), "visibles", sum(1 for i in torso if visible(i)))
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    fuera = [f for f in bm.faces if all(v.index in quitar or v.index in escondidos for v in f.verts)]
    bmesh.ops.delete(bm, geom=fuera, context="FACES_ONLY")
    sueltos = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=sueltos, context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.update()
    return len(fuera)


def _materiales(obj):
    """Un solo material con un mapa emisivo naranja en la hebilla y en la tira de la
    mochila: esas caras pasan a sus propios materiales emisivos (Alien_Hebilla y
    Alien_MochilaLuz) para que el sitio los trate como luces, y el resto
    (Alien) se queda sin emisión."""
    me = obj.data
    base = me.materials[0]
    base.name = "Alien"
    E = _pixeles("Image_2")
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers[0].data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    P = _coords(me)
    emis, color = [], []
    for p in me.polygons:
        li = list(p.loop_indices)
        e = _muestrear(E, uv[li]).mean(0)
        if e.max() > 0.3:
            emis.append(p.index)
            color.append(e)
    color = np.mean(color, axis=0)
    color = color / color.max()
    mats = {}
    for nombre in ("Alien_Hebilla", "Alien_MochilaLuz"):
        m = bpy.data.materials.new(nombre)
        m.use_nodes = True
        b = m.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = (*color, 1)
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = 6.0
        b.inputs["Roughness"].default_value = 0.5
        m.diffuse_color = (*color, 1)
        me.materials.append(m)
        mats[nombre] = len(me.materials) - 1
    n_heb = n_moch = 0
    for i in emis:
        p = me.polygons[i]
        c = P[list(p.vertices)].mean(0)
        if c[1] > 0.08:
            p.material_index = mats["Alien_MochilaLuz"]
            n_moch += 1
        else:
            p.material_index = mats["Alien_Hebilla"]
            n_heb += 1
    # el material base ya no emite
    nt = base.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    for l in list(b.inputs["Emission Color"].links):
        nt.links.remove(l)
    b.inputs["Emission Strength"].default_value = 0.0
    b.inputs["Emission Color"].default_value = (0, 0, 0, 1)
    for n in list(nt.nodes):
        if n.type == "TEX_IMAGE" and n.image and n.image.name == "Image_2":
            nt.nodes.remove(n)
    print("EMISIVOS hebilla", n_heb, "mochila", n_moch, "color", color.round(3).tolist())
    return color


# ---------------------------------------------------------------- huesos

def _definir_huesos(J, G, P):
    H = {}

    def hueso(nombre, cabeza, cola, z, padre, deforma=True):
        H[nombre] = (np.asarray(cabeza, float), np.asarray(cola, float), _norm(z), padre, deforma)
    hueso("raiz", (0, 0, 0), (0, 0, 0.25), (0, -1, 0), None, False)
    yc = J["cadera"][1]
    hueso("hips", (0, Y_COLUMNA, 0.60), (0, Y_COLUMNA, 0.765), (0, -1, 0), "raiz")
    hueso("spine", (0, Y_COLUMNA, 0.765), (0, Y_COLUMNA, 0.835), (0, -1, 0), "hips")
    hueso("chest", (0, Y_COLUMNA, 0.835), (0, Y_CUELLO, 1.06), (0, -1, 0), "spine")
    hueso("neck", (0, Y_CUELLO, 1.06), (0, Y_CUELLO, 1.077), (0, -1, 0), "chest")
    zmax = float(P[:, 2].max())
    hueso("head", (0, Y_CUELLO, 1.077), (0, Y_CUELLO, zmax), (0, -1, 0), "neck")
    mo = P[np.concatenate([_ids(k) for k in G["mochila"]])]
    mc = np.array([0.0, float(mo[:, 1].min()), float((mo[:, 2].min() + mo[:, 2].max()) / 2)])
    hueso("mochila", mc, mc + (0, 0, 0.15), (0, -1, 0), "chest")
    for lado, s in (("L", 1), ("R", -1)):
        def m(p):
            return np.asarray(p, float) if s > 0 else _espejo(p)
        fw = np.array([0, -1.0, 0])
        hueso(f"shoulder_{lado}", m((0.035, 0.03, 1.0)), m(J["hombro"]), (0, 0, 1), "chest")
        hueso(f"upper_arm_{lado}", m(J["hombro"]), m(J["codo"]), fw, f"shoulder_{lado}")
        hueso(f"lower_arm_{lado}", m(J["codo"]), m(J["muneca"]), fw, f"upper_arm_{lado}")
        palma = m(J["palma"])
        hueso(f"hand_{lado}", m(J["muneca"]), m(J["nudillos"]), palma, f"lower_arm_{lado}")
        anular = m(J["dedos"]["ring"][0])
        for dedo, pts in J["dedos"].items():
            pts = [m(p) for p in pts]
            z = palma
            if dedo == "thumb":
                z = palma + _norm(anular - pts[0])
            padre = f"hand_{lado}"
            for k in range(3):
                nombre = f"{dedo}_0{k + 1}_{lado}"
                hueso(nombre, pts[k], pts[k + 1], z, padre)
                padre = nombre
        hueso(f"upper_leg_{lado}", m(J["cadera"]), m(J["rodilla"]), fw, "hips")
        hueso(f"lower_leg_{lado}", m(J["rodilla"]), m(J["tobillo"]), -fw, f"upper_leg_{lado}")
        hueso(f"foot_{lado}", m(J["tobillo"]), m(J["bola"]), (0, 0, 1), f"lower_leg_{lado}")
        hueso(f"toes_{lado}", m(J["bola"]), m(J["punta"]), (0, 0, 1), f"foot_{lado}")
    return H


def _armar_armature(H):
    data = bpy.data.armatures.new("AlienRig")
    arm = bpy.data.objects.new("Alien", data)
    bpy.context.scene.collection.objects.link(arm)
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    arm.select_set(True)
    vl.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = data.edit_bones
    for nombre, (h, t, z, padre, deforma) in H.items():
        b = eb.new(nombre)
        b.head = Vector(h)
        b.tail = Vector(t)
        b.align_roll(Vector(z))
        b.use_deform = deforma
    for nombre, (h, t, z, padre, deforma) in H.items():
        if padre:
            eb[nombre].parent = eb[padre]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return arm


def _hueso_extra(arm, nombre, cabeza, y, x, largo, padre, deforma=True):
    """Hueso con ejes dados: Y a lo largo, X hacia `x` (Z = X × Y)."""
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    arm.select_set(True)
    vl.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    if nombre in eb:
        eb.remove(eb[nombre])
    b = eb.new(nombre)
    y = _norm(y)
    x = _norm(np.asarray(x, float) - (np.asarray(x, float) @ y) * y)
    z = np.cross(x, y)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = Vector(cabeza)
    b.head = (0, 0, 0)
    b.tail = (0, largo, 0)
    b.matrix = m
    b.parent = eb[padre]
    b.use_deform = deforma
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.pose.bones[nombre].rotation_mode = "QUATERNION"


# ---------------------------------------------------------------- pesos

def _seg(P, a, b, extender=False):
    ab = b - a
    t = ((P - a) @ ab) / max(1e-12, ab @ ab)
    tc = np.clip(t, -np.inf if extender else 0.0, 1.0)
    return np.linalg.norm(P - (a + np.outer(tc, ab)), axis=1), tc


def _polilinea(P, pts):
    """Distancia a la polilínea y posición a lo largo (negativa detrás del primer punto)."""
    mejor = np.full(len(P), np.inf)
    u = np.zeros(len(P))
    acum = 0.0
    for k in range(len(pts) - 1):
        a, b = np.asarray(pts[k]), np.asarray(pts[k + 1])
        L = float(np.linalg.norm(b - a))
        d, t = _seg(P, a, b, extender=(k == 0))
        m = d < mejor
        mejor[m] = d[m]
        u[m] = acum + t[m] * L
        acum += L
    return mejor, u


def _pesos_cuerpo(P, J, H, mochila=None):
    """Pesos como campo del espacio (una función suave de la posición): las capas
    encimadas (piel, cascarón de adentro y de afuera, la manga dentro del
    guantelete) quedan casi con los mismos pesos y se mueven juntas. Cada coyuntura
    es una banda suave; donde hay una pieza rígida (aro del codo, puño, rollo de la
    bota, cinturón) la banda queda fuera de ella."""
    N = len(P)
    W = {n: np.zeros(N) for n, v in H.items() if v[4]}
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    # torso: cadera > columna > pecho > cuello > cabeza por alturas; la cabeza
    # también es lo que está lejos del eje del cuello (la barbilla cuelga hasta la
    # altura del cuello de la chamarra, por delante)
    r_cuello = np.hypot(x, y - Y_CUELLO)
    h = np.maximum(ss(z, *Z_NECK_HEAD), ss(r_cuello, 0.072, 0.09) * ss(z, 1.035, 1.05))
    s3 = ss(z, *Z_CHEST_NECK)
    s2 = ss(z, *Z_SPINE_CHEST)
    s1 = ss(z, *Z_HIPS_SPINE)
    torso = {"head": h, "neck": (1 - h) * s3, "chest": (1 - h) * (1 - s3) * s2,
             "spine": (1 - h) * (1 - s3) * (1 - s2) * s1, "hips": (1 - h) * (1 - s3) * (1 - s2) * (1 - s1)}
    queda = np.ones(N)
    for lado, s in (("L", 1.0), ("R", -1.0)):
        Pm = P * np.array([s, 1, 1])            # el lado derecho se mide en espejo
        lado_x = ss(s * x, -0.01, 0.01)
        # ---- brazo
        dedos = J["dedos"]
        cadena = [J["hombro"], J["codo"], J["muneca"], J["nudillos"]]
        d_brazo = _polilinea(Pm, cadena)[0]
        for pts in dedos.values():
            d_brazo = np.minimum(d_brazo, _polilinea(Pm, [J["muneca"]] + list(pts))[0])
        a = ss((Pm - np.asarray(CORTE_HOMBRO)) @ np.asarray(CORTE_NORMAL), -0.015, 0.03)
        # (la cabeza nunca es brazo: por cercanía alcanzaba la parte de abajo)
        a *= (1 - ss(d_brazo, 0.10, 0.13)) * lado_x * (1 - h)
        # codo: banda centrada en la articulación. El aro y la boca del guantelete
        # caen en ella y se doblan poquito con la manga, como hule: rígidos con el
        # antebrazo, la banda quedaba corrida de la articulación y el pliegue salía
        # con pico (y la orilla del aro, que va debajo de la manga, se asomaba)
        e = ss((Pm - J["codo"]) @ J["eje_brazo"], -BANDA_CODO / 2, BANDA_CODO / 2)
        lejos, npu = J["plano_puno"]
        hw = ss((Pm - lejos) @ npu, 0.004, 0.049)
        W[f"upper_arm_{lado}"] += a * (1 - e)
        W[f"lower_arm_{lado}"] += a * e * (1 - hw)
        mano = a * e * hw
        # dedos: el más cercano manda (suave en las membranas) y cada uno se reparte
        # en sus tres falanges con bandas en las coyunturas
        dist, us, gs, largos = {}, {}, {}, {}
        for dedo, pts in dedos.items():
            d, u = _polilinea(Pm, pts)
            dist[dedo], us[dedo] = d, u
            gs[dedo] = ss(u, -0.022, 0.006)
            seg = np.linalg.norm(np.diff(np.asarray(pts), axis=0), axis=1)
            largos[dedo] = (seg[0], seg[0] + seg[1])
        dmin = np.min(np.vstack(list(dist.values())), axis=0)
        ex = {k: np.exp(-(d - dmin) / 0.005) for k, d in dist.items()}
        tot = sum(ex.values())
        total_dedos = np.zeros(N)
        for dedo in dedos:
            share = mano * ex[dedo] / tot * gs[dedo]
            total_dedos += ex[dedo] / tot * gs[dedo]
            L1, L2 = largos[dedo]
            u = us[dedo]
            b = 0.008
            f2 = ss(u, L1 - b, L1 + b)
            f3 = ss(u, L2 - b, L2 + b)
            W[f"{dedo}_01_{lado}"] += share * (1 - f2)
            W[f"{dedo}_02_{lado}"] += share * f2 * (1 - f3)
            W[f"{dedo}_03_{lado}"] += share * f3
        W[f"hand_{lado}"] += mano * (1 - total_dedos)
        # ---- pierna
        d_pierna = _polilinea(Pm, [J["cadera"], J["rodilla"], J["tobillo"], J["bola"], J["punta"]])[0]
        l = ss(Z_CADERA - z, 0.0, 0.055) * lado_x * (1 - ss(d_pierna, 0.12, 0.15))
        cr, nr, alto = J["plano_rollo"]
        offr = alto + 0.004
        k = ss((Pm - cr) @ nr, -offr - BANDA_RODILLA, -offr)
        ft = 1 - ss(z, Z_TOBILLO - 0.02, Z_TOBILLO + 0.04)
        tt = ss(Y_BOLA - y, -0.005, 0.03)
        W[f"upper_leg_{lado}"] += l * (1 - k)
        W[f"lower_leg_{lado}"] += l * k * (1 - ft)
        W[f"foot_{lado}"] += l * k * ft * (1 - tt)
        W[f"toes_{lado}"] += l * k * ft * tt
        queda -= a + l
        # ---- clavícula: lo de arriba del hombro que queda en el torso
        g = ss(s * x, 0.06, 0.12) * ss(z, 0.92, 0.97) * (1 - ss(z, 1.035, 1.05)) * lado_x
        torso[f"shoulder_{lado}"] = torso["chest"] * g
        torso["chest"] = torso["chest"] * (1 - g)
    # la espalda bajo la mochila va rígida con el pecho, como la mochila (su placa
    # va metida en el traje: al doblar la columna se salía de él)
    if mochila is not None:
        mx, mz0, mz1 = mochila
        bp = (1 - ss(np.abs(x), mx - 0.01, mx + 0.03)) * ss(z, 0.728, max(0.75, mz0 + 0.01)) \
            * (1 - ss(z, mz1 - 0.02, mz1)) * ss(y, 0.0, 0.06)
        no_cabeza = 1 - torso["head"]
        for n in torso:
            if n != "head":
                torso[n] = torso[n] * (1 - bp)
        torso["chest"] = torso["chest"] + bp * no_cabeza
    queda = np.clip(queda, 0, 1)
    for n, w in torso.items():
        W[n] += w * queda
    return W


def _soldados(P, tol=1e-5):
    """El GLB trae vértices repetidos en las costuras de UV (el importador no los
    suelda): id del grupo de cada vértice (los que están en el mismo punto)."""
    k = np.round(P / tol).astype(np.int64)
    _, g = np.unique(k, axis=0, return_inverse=True)
    return g.ravel()


def _soldar(me, W):
    """Los vértices repetidos de una costura llevan exactamente los mismos pesos (si
    no, la costura se abre al deformar)."""
    g = _soldados(_coords(me))
    n = g.max() + 1
    cuenta = np.bincount(g, minlength=n)
    for k in W:
        W[k] = (np.bincount(g, weights=W[k], minlength=n) / cuenta)[g]


def _pegar_a_base(me, W, pegar, base):
    """Las piezas montadas sobre otra (el aro del codo sobre la boca del guante y la
    manga) copian los pesos del punto de la superficie que las carga: viajan pegadas
    a ella y no se encajan al doblar (con su propio peso, a 1 o 2 cm de la
    superficie a lo largo de la banda, el aro se metía en el guante)."""
    from mathutils.interpolate import poly_3d_calc
    P = _coords(me)
    base = set(int(i) for i in base)
    caras = [list(p.vertices) for p in me.polygons if all(v in base for v in p.vertices)]
    bvh = BVHTree.FromPolygons([Vector(q) for q in P], caras)
    nombres = list(W)
    M = np.vstack([W[n] for n in nombres]).T
    nuevo = M.copy()
    for i in pegar:
        loc, _, f, _ = bvh.find_nearest(Vector(P[i]))
        vs = caras[f]
        b = np.array(poly_3d_calc([Vector(P[j]) for j in vs], loc))
        nuevo[i] = b @ M[vs]
    for j, n in enumerate(nombres):
        W[n] = nuevo[:, j]


def _simetrizar(me, W):
    """El modelo es simétrico pero su triangulación no: lo que se calcula sobre la
    malla (el suavizado de la quijada, lo pegado) salía distinto de cada lado (una
    comisura se pellizcaba al abrir la boca y la otra no). Cada punto promedia sus
    pesos con los de su espejo, con los huesos _L y _R cambiados."""
    P = _coords(me)
    _soldar(me, W)
    g = _soldados(P)
    rep_ = np.zeros(g.max() + 1, dtype=np.int64)
    rep_[g] = np.arange(len(P))
    Q = P[rep_]
    kd = KDTree(len(Q))
    for i, q in enumerate(Q):
        kd.insert(Vector(q), i)
    kd.balance()
    espejo = np.full(len(Q), -1)
    for i, q in enumerate(Q):
        _, j, d = kd.find(Vector((-q[0], q[1], q[2])))
        if d < 2e-5:
            espejo[i] = j
    ok = np.where(espejo >= 0)[0]

    def cambia(n):
        return n[:-2] + ("_R" if n.endswith("_L") else "_L") if n.endswith(("_L", "_R")) else n
    viejo = {n: w[rep_].copy() for n, w in W.items()}
    for n in W:
        m = cambia(n)
        if m not in viejo:
            continue
        nuevo = viejo[n].copy()
        nuevo[ok] = 0.5 * (viejo[n][ok] + viejo[m][espejo[ok]])
        W[n] = nuevo[g]
    print("SIMETRIA puntos con espejo", len(ok), "de", len(Q))


def _poner_pesos(obj, W, rigidos):
    """W: {hueso: pesos}; rigidos: {hueso: índices} (todo su peso a ese hueso).
    Hasta 4 huesos por vértice (como los lee three)."""
    nombres = list(W)
    M = np.vstack([W[n] for n in nombres]).T
    for n, ids in rigidos.items():
        M[ids] = 0
        M[ids, nombres.index(n)] = 1
    orden = np.argsort(-M, axis=1)
    fuera = orden[:, 4:]
    np.put_along_axis(M, fuera, 0, axis=1)
    M[M < 1e-3] = 0
    M /= np.maximum(1e-9, M.sum(1, keepdims=True))
    for g in list(obj.vertex_groups):
        obj.vertex_groups.remove(g)
    for j, n in enumerate(nombres):
        col = M[:, j]
        ids = np.nonzero(col)[0]
        if not len(ids):
            continue
        g = obj.vertex_groups.new(name=n)
        for i in ids:
            g.add([int(i)], float(col[i]), "REPLACE")
    return M


# ---------------------------------------------------------------- cara

def _ejes_ojo(Q, cabeza_c):
    c = Q.mean(0)
    _, _, vt = np.linalg.svd(Q - c, full_matrices=False)
    fuera = _norm(c - cabeza_c)
    k = int(np.argmax(np.abs(vt @ fuera)))
    Y = vt[k] if vt[k] @ fuera > 0 else -vt[k]
    otros = [vt[i] for i in range(3) if i != k]
    ext = [float(np.abs((Q - c) @ v).max()) for v in otros]
    X = otros[int(np.argmax(ext))]
    X = X if X[0] > 0 else -X
    X = _norm(X - (X @ Y) * Y)
    Z = np.cross(X, Y)
    # elipsoide con centro libre, en estos ejes: a x² + b z² + g y² + d x + e z + f y = 1
    x, z, y = (Q - c) @ X, (Q - c) @ Z, (Q - c) @ Y
    a, b, g, d, e, f = np.linalg.lstsq(np.c_[x * x, z * z, y * y, x, z, y], np.ones(len(Q)), rcond=None)[0]
    x0, z0, y0 = -d / (2 * a), -e / (2 * b), -f / (2 * g)
    k = 1 + a * x0 * x0 + b * z0 * z0 + g * y0 * y0
    A, B, C = math.sqrt(k / a), math.sqrt(k / b), math.sqrt(k / g)
    c = c + x0 * X + z0 * Z + y0 * Y
    return c, X, Y, Z, A, B, C


def _parpados(malla, G, lado):
    """Dos párpados por ojo, cada uno con tres huesos a lo ancho (PARPADO_HUESOS).
    El ojo es un elipsoide (eje largo inclinado, B arriba, C de fondo) metido en una
    copa de la piel que lo abraza muy de cerca: el párpado tiene que quedar casi
    pegado al ojo o se esconde detrás de la copa. Cada rebanada del párpado es un
    círculo alrededor de un eje paralelo al largo, corrido hacia adentro lo justo
    para que el círculo pase por el frente, arriba y abajo de esa rebanada del ojo
    (k·d, con d = (B² - C²) / 2C y k lo que mide la rebanada); cada hueso gira sobre
    su pivote y entre huesos el pivote se interpola (girar dos huesos el mismo
    ángulo sobre ejes paralelos es girar sobre el eje de en medio), así el párpado
    gira sobre sí mismo sin meterse en el ojo. La ventana (lo que se ve del ojo) se
    mide con rayos contra la piel de la cabeza: abierto, el párpado queda todo
    escondido; cerrado, el filo de cada hueso llega a la junta en su rebanada."""
    me = malla.data
    P = _coords(me)
    cab = _ids(G["cabeza"])
    cab_set = set(int(i) for i in cab)
    caras = [list(p.vertices) for p in me.polygons if all(v in cab_set for v in p.vertices)]
    bvh = BVHTree.FromPolygons([Vector(p) for p in P], caras)
    # el ojo es un elipsoide en dos piezas: la grande y una tapita en la punta de adentro
    Q = P[np.concatenate([_ids(k) for k in G["ojos"][lado]])]
    c, X, Y, Z, A, B, C = _ejes_ojo(Q, np.array([0.0, Y_CUELLO, 1.33]))
    U = -Z
    d = max(0.0, (B * B - C * C) / (2 * C))
    s_h = np.array(PARPADO_HUESOS) * A
    k_h = np.sqrt(1 - (s_h / A) ** 2)

    def pesos_s(s):
        w = np.zeros(3)
        if s <= s_h[0]:
            w[0] = 1
        elif s >= s_h[2]:
            w[2] = 1
        else:
            j = 0 if s < s_h[1] else 1
            t = (s - s_h[j]) / (s_h[j + 1] - s_h[j])
            w[j], w[j + 1] = 1 - t, t
        return w

    def delta(s):
        return float(pesos_s(s) @ (k_h * d))

    def eje(s):
        return c + s * X - delta(s) * Y
    th = np.linspace(-np.pi, np.pi, 361)

    def radio(s):
        k = math.sqrt(max(0.0, 1 - (s / A) ** 2))
        return float(np.max(np.hypot(B * k * np.sin(th), delta(s) + C * k * np.cos(th))))
    # el elipsoide ajustado contra los vértices: lo que alguno se sale en su rebanada
    s_v = (Q - c) @ X
    rel = Q - np.array([eje(s) for s in s_v])
    r_v = np.hypot(rel @ Y, rel @ Z)
    sale = np.maximum(0.0, r_v - np.array([radio(s) for s in s_v]))
    sobra = float(sale.max())

    def R(s):
        cerca = np.abs(s_v - s) < 0.012
        local = float(sale[cerca].max()) if cerca.any() else sobra
        return radio(s) + local + MARGEN_PARPADO

    # ventana. El ojo está en una copa abierta de la piel: del eje al punto del
    # párpado, un número impar de cruces con la piel es que el punto quedó dentro de
    # la cabeza (escondido); si no, se ve si lo alcanza una cámara al frente.
    def cruces(p0, dv, largo):
        n, p, queda = 0, p0, largo
        while queda > 0:
            h = bvh.ray_cast(p, dv, queda)
            if h[0] is None:
                break
            n += 1
            queda -= h[3] + 1e-5
            p = h[0] + dv * 1e-5
        return n
    # el frente y un cono de 55° alrededor, y el eje del ojo
    frente = np.array([0.0, -1.0, 0.0])
    b1 = _norm(np.cross(frente, [0, 0, 1.0]))
    b2 = np.cross(b1, frente)
    vistas = [frente, Y] + [_norm(frente + math.tan(math.radians(a)) * (math.cos(t) * b1 + math.sin(t) * b2))
                            for a in (30, 55) for t in np.linspace(0, 2 * np.pi, 8, endpoint=False)]
    vistas = [Vector(v) for v in vistas]

    def se_ve(p):
        return any(bvh.ray_cast(p + v * 1e-4, v, 2.0)[0] is None for v in vistas)
    ss_ = np.arange(-A * 0.97, A * 0.97 + 1e-6, 0.004)
    phis = np.radians(np.arange(-150, 151, 2))
    estado = np.zeros((len(ss_), len(phis)), dtype=int)   # 0 tapado, 1 visible, 2 dentro de la cabeza
    for i, s in enumerate(ss_):
        ax0 = Vector(eje(s))
        r = R(s)
        for j, ph in enumerate(phis):
            dv = Vector(np.cos(ph) * Y + np.sin(ph) * U)
            if cruces(ax0, dv, r) % 2:
                estado[i, j] = 2
            elif se_ve(ax0 + dv * r):
                estado[i, j] = 1
    for i in range(0, len(ss_), 2):
        print("VENTANA", lado, "%+.3f" % ss_[i], "".join(".ox"[estado[i, j]] for j in range(0, len(phis), 3)))
    deg = np.degrees(phis)
    con_ventana = [i for i in range(len(ss_)) if (estado[i] == 1).any()]
    abre_sup = max(deg[estado[i] == 1].max() for i in con_ventana) + MARGEN_ABIERTO
    abre_inf = min(deg[estado[i] == 1].min() for i in con_ventana) - MARGEN_ABIERTO
    juntas = []
    for sh in s_h:
        filas = [i for i in con_ventana if abs(ss_[i] - sh) < 0.013] or con_ventana
        top = float(np.mean([deg[estado[i] == 1].max() for i in filas]))
        bot = float(np.mean([deg[estado[i] == 1].min() for i in filas]))
        juntas.append(top + MEZCLA_CIERRE * (bot - top))
    juntas = np.array(juntas)
    cierre_sup = abre_sup - juntas + TRASLAPE
    cierre_inf = juntas - abre_inf + TRASLAPE
    print("PARPADO", lado, json.dumps({"A": round(A, 4), "B": round(B, 4), "C": round(C, 4), "d": round(d, 4),
          "sobra": round(sobra, 4), "abre": [round(abre_inf, 1), round(abre_sup, 1)],
          "juntas": np.round(juntas, 1).tolist(), "cierre_sup": np.round(cierre_sup, 1).tolist(),
          "cierre_inf": np.round(cierre_inf, 1).tolist()}))
    return {"c": c, "X": X, "Y": Y, "Z": Z, "U": U, "eje": eje, "R": R, "pesos_s": pesos_s, "s_h": s_h,
            "s": (float(ss_[0]), float(ss_[-1])), "abre_sup": abre_sup, "abre_inf": abre_inf, "juntas": juntas,
            "cierre_sup": cierre_sup, "cierre_inf": cierre_inf, "A": A, "B": B, "C": C}


def _malla_parpado(bm, info, cual, uv_piel, uvl):
    """Superficie del párpado (de su filo hacia adentro de la cabeza) con un labio
    redondo en el filo, de cara a afuera. Regresa [(vértice, pesos de sus 3 huesos)]."""
    X, Y, U, eje, R = info["X"], info["Y"], info["U"], info["eje"], info["R"]
    s0, s1 = info["s"]
    extra = EXTRA_SUP if cual == "sup" else 0.0
    if cual == "sup":
        filo = info["abre_sup"]
        ancho = info["abre_sup"] - float(info["juntas"].min()) + 12.0
        sentido = 1.0
    else:
        filo = info["abre_inf"]
        ancho = float(info["juntas"].max()) - info["abre_inf"] + 12.0
        sentido = -1.0
    cols = np.linspace(s0, s1, 31)
    n_f = max(8, int(ancho / 5))
    # (ángulo desde el filo, encogimiento del radio): superficie de afuera, labio, adentro
    perfil = [(ancho * (1 - k / n_f), 0.0) for k in range(n_f)] + \
             [(0.0, 0.0), (-0.9, GRUESO_LABIO * 0.35), (-0.6, GRUESO_LABIO * 0.85), (0.6, GRUESO_LABIO), (4.0, GRUESO_LABIO)]
    rejilla = []
    for a_, enc in perfil:
        ph = math.radians(filo + sentido * a_)
        fila = []
        for s in cols:
            r = R(s) + extra - enc
            p = eje(s) + r * (math.cos(ph) * Y + math.sin(ph) * U)
            fila.append((bm.verts.new(Vector(p)), info["pesos_s"](s)))
        rejilla.append(fila)
    caras = []
    for k in range(len(rejilla) - 1):
        for j in range(len(cols) - 1):
            q = [rejilla[k][j][0], rejilla[k][j + 1][0], rejilla[k + 1][j + 1][0], rejilla[k + 1][j][0]]
            if cual == "sup":
                q.reverse()
            caras.append(bm.faces.new(q))
    for f in caras:
        f.smooth = True
        for lp in f.loops:
            dv = np.asarray(lp.vert.co) - info["c"]
            lp[uvl].uv = Vector(uv_piel) + Vector((dv @ X, dv @ U)) * 0.02
    return [vw for fila in rejilla for vw in fila]


def cara(arm, malla, G):
    me = malla.data
    P = _coords(me)
    # UV de la piel verde de la frente (para pintar los párpados)
    cab = _ids(G["cabeza"])
    q = np.array([0.0, -0.3, 1.47])
    i_frente = int(cab[np.argmin(np.linalg.norm(P[cab] - q, axis=1))])
    uv_v = _uv_vertice(me)
    uv_piel = uv_v[i_frente]
    print("UV_PIEL", uv_piel.round(4).tolist(), _muestrear(_pixeles("Image_0"), uv_piel[None])[0].round(3).tolist())
    infos = {lado: _parpados(malla, G, lado) for lado in ("L", "R")}
    # el modelo es simétrico (la piel no, al milímetro): juntas y aperturas de los dos
    # ojos se promedian en espejo (el hueso 0 de un ojo es el 2 del otro)
    j = (infos["L"]["juntas"] + infos["R"]["juntas"][::-1]) / 2
    a_sup = (infos["L"]["abre_sup"] + infos["R"]["abre_sup"]) / 2
    a_inf = (infos["L"]["abre_inf"] + infos["R"]["abre_inf"]) / 2
    for lado, jj in (("L", j), ("R", j[::-1])):
        inf = infos[lado]
        inf.update(juntas=jj, abre_sup=a_sup, abre_inf=a_inf,
                   cierre_sup=a_sup - jj + TRASLAPE, cierre_inf=jj - a_inf + TRASLAPE)
    # huesos de la cara
    for lado, inf in infos.items():
        _hueso_extra(arm, f"ojo_{lado}", inf["c"], inf["Y"], inf["X"], inf["C"], "head")
        for b, sh in enumerate(inf["s_h"]):
            piv = inf["eje"](sh)
            _hueso_extra(arm, f"parpado_sup_{lado}_{b}", piv, inf["Y"], inf["X"], inf["C"] * 0.8, f"ojo_{lado}")
            _hueso_extra(arm, f"parpado_inf_{lado}_{b}", piv, inf["Y"], -inf["X"], inf["C"] * 0.8, f"ojo_{lado}")
    barbilla = np.array([0.0, -0.21, 1.075])
    piv = np.asarray(QUIJADA_PIVOTE)
    _hueso_extra(arm, "quijada", piv, barbilla - piv, (1, 0, 0), float(np.linalg.norm(barbilla - piv)), "head")
    # lengua: dos huesos de la raíz (atrás y arriba) a la punta (adelante y abajo)
    T = P[np.concatenate([_ids(k) for k in G["lengua"]])]
    tc = T.mean(0)
    _, _, vt = np.linalg.svd(T - tc, full_matrices=False)
    plano = [v for v in vt[:2]]
    eje = max(plano, key=lambda v: abs(v[1]))
    eje = eje if eje[1] < 0 else -eje
    eje = _norm(eje - eje[0] * np.array([1.0, 0, 0]))
    st = (T - tc) @ eje
    raiz_l = tc + eje * st.min() * 0.85
    punta_l = tc + eje * st.max() * 0.9
    medio = (raiz_l + punta_l) / 2
    _hueso_extra(arm, "lengua_1", raiz_l, medio - raiz_l, (1, 0, 0), float(np.linalg.norm(medio - raiz_l)), "quijada")
    _hueso_extra(arm, "lengua_2", medio, punta_l - medio, (1, 0, 0), float(np.linalg.norm(punta_l - medio)), "lengua_1")
    # párpados: su propia malla
    pm = bpy.data.meshes.new("Alien_parpados")
    po = bpy.data.objects.new("Alien_parpados", pm)
    bpy.context.scene.collection.objects.link(po)
    pm.materials.append(bpy.data.materials["Alien"])
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    grupos = {}
    for lado, inf in infos.items():
        for cual in ("sup", "inf"):
            grupos[(cual, lado)] = _malla_parpado(bm, inf, cual, uv_piel, uvl)
    bm.verts.index_update()
    idx = {k: [(v.index, w) for v, w in vs] for k, vs in grupos.items()}
    bm.to_mesh(pm)
    bm.free()
    for (cual, lado), vs in idx.items():
        for b in range(3):
            g = po.vertex_groups.new(name=f"parpado_{cual}_{lado}_{b}")
            for i, w in vs:
                if w[b] > 1e-4:
                    g.add([i], float(w[b]), "REPLACE")
    po.parent = arm
    po.modifiers.new("Alien", "ARMATURE").object = arm
    return infos, (raiz_l, punta_l, eje)


def _pesos_cara(malla, G, infos, lengua, W):
    """Quijada (de la cabeza a la barbilla y el labio de abajo), ojos y lengua."""
    P = _coords(malla.data)
    cab = np.zeros(len(P), bool)
    cab[_ids(G["cabeza"])] = True
    sd = (P - np.asarray(QUIJADA_PIVOTE)) @ np.asarray(QUIJADA_NORMAL)
    # en el centro los labios están separados (la boca abierta) y la transición
    # puede ser corta; hacia las comisuras se une la piel y se ensancha, para que al
    # cerrar la boca el pliegue quede suave (Oscar)
    ax_ = np.abs(P[:, 0])
    ancho = 0.010 + 0.028 * ss(ax_, 0.015, 0.07)
    jw = (1 - ss(sd / ancho, -1.0, 1.0)) * (1 - ss(ax_, 0.06, 0.16)) * (1 - ss(P[:, 1], -0.08, 0.0))
    jw *= cab * (P[:, 2] > 1.05)
    # y un suavizado sobre la piel de la cabeza (lo que queda de pliegue se reparte),
    # por puntos soldados: si no, no cruza las costuras de UV
    g = _soldados(P)
    n = g.max() + 1
    cuenta = np.bincount(g, minlength=n)
    ev = np.empty(len(malla.data.edges) * 2, dtype=np.int64)
    malla.data.edges.foreach_get("vertices", ev)
    ev = ev.reshape(-1, 2)
    ev = ev[cab[ev[:, 0]] & cab[ev[:, 1]]]
    a_, b_ = g[ev[:, 0]], g[ev[:, 1]]
    zona = np.zeros(n, bool)
    zona[g[np.where(cab & (P[:, 2] > 1.05) & (P[:, 1] < 0.05))[0]]] = True
    jg = np.bincount(g, weights=jw, minlength=n) / cuenta
    for _ in range(8):
        suma = np.bincount(a_, weights=jg[b_], minlength=n) + np.bincount(b_, weights=jg[a_], minlength=n)
        grado = np.bincount(a_, minlength=n) + np.bincount(b_, minlength=n)
        prom = np.where(grado > 0, suma / np.maximum(1, grado), jg)
        jg = np.where(zona, 0.5 * jg + 0.5 * prom, jg)
    jw = jg[g]
    W["quijada"] = W["head"] * jw
    W["head"] = W["head"] * (1 - jw)
    rig = {}
    for lado in ("L", "R"):
        rig[f"ojo_{lado}"] = np.concatenate([_ids(k) for k in G["ojos"][lado]])
        W.setdefault(f"ojo_{lado}", np.zeros(len(P)))
    raiz_l, punta_l, eje = lengua
    ids = np.concatenate([_ids(k) for k in G["lengua"]])
    u = (P[ids] - raiz_l) @ eje / max(1e-9, (punta_l - raiz_l) @ eje)
    w2 = ss(u, 0.35, 0.65)
    W["lengua_1"] = np.zeros(len(P))
    W["lengua_2"] = np.zeros(len(P))
    for n in W:
        if n not in ("lengua_1", "lengua_2"):
            W[n][ids] = 0
    W["lengua_1"][ids] = 1 - w2
    W["lengua_2"][ids] = w2
    for n in (f"parpado_{c}_{l}_{b}" for c in ("sup", "inf") for l in ("L", "R") for b in range(3)):
        W.setdefault(n, np.zeros(len(P)))
    return rig


def _separar_ojos(malla):
    me = malla.data
    gi = {g.index for g in malla.vertex_groups if g.name.startswith("ojo_")}
    sel = {v.index for v in me.vertices if any(g.group in gi and g.weight > 0.5 for g in v.groups)}
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(False)
    malla.select_set(True)
    vl.objects.active = malla
    for v in me.vertices:
        v.select = v.index in sel
    for e in me.edges:
        e.select = all(i in sel for i in e.vertices)
    for p in me.polygons:
        p.select = all(i in sel for i in p.vertices)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    nuevo = next(o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("Alien_malla") and o is not malla)
    nuevo.name = nuevo.data.name = "Alien_ojos"
    return nuevo


def _normales_glb(obj):
    me = obj.data
    a = me.attributes.get("n_glb")
    if a is None:
        return
    n = np.empty(len(me.loops) * 3)
    a.data.foreach_get("vector", n)
    n = n.reshape(-1, 3)
    n /= np.maximum(1e-9, np.linalg.norm(n, axis=1))[:, None]
    me.normals_split_custom_set([tuple(v) for v in n])
    me.attributes.remove(me.attributes["n_glb"])


# ---------------------------------------------------------------- armar

def armar():
    obj = importar()
    me = obj.data
    _islas_cache["isla"] = _islas(me)
    piezas, G = clasificar(me)
    print("PIEZAS", json.dumps(G, default=int))
    J = medir_esqueleto(me, G)
    for k in ("hombro", "codo", "muneca", "nudillos", "cadera", "rodilla", "tobillo", "palma"):
        print("J", k, np.round(J[k], 4).tolist())
    for k, v in J["dedos"].items():
        print("J dedo", k, np.round(v, 4).tolist())
    print("QUITADAS", _quitar_ocultas(obj, G))
    _islas_cache["isla"] = _islas(me)
    piezas, G = clasificar(me)
    _materiales(obj)
    P = _coords(me)
    H = _definir_huesos(J, G, P)
    arm = _armar_armature(H)
    obj.parent = arm
    obj.modifiers.new("Alien", "ARMATURE").object = arm
    infos, lengua = cara(arm, obj, G)
    mo = P[np.concatenate([_ids(k) for k in G["mochila"]])]
    W = _pesos_cuerpo(P, J, H, (float(np.abs(mo[:, 0]).max()), float(mo[:, 2].min()), float(mo[:, 2].max())))
    rig = _pesos_cara(obj, G, infos, lengua, W)
    for k in G["mochila"]:
        rig.setdefault("mochila", []).extend(_ids(k).tolist())
    for k in G["cinturon"]:
        rig.setdefault("hips", []).extend(_ids(k).tolist())
    for lado in ("L", "R"):
        rig[f"lower_arm_{lado}"] = _ids(G["puno"][lado])
        rig[f"lower_leg_{lado}"] = np.concatenate([_ids(k) for k in G["rollo"][lado]])
    rig = {k: np.asarray(v, dtype=np.int64) for k, v in rig.items()}
    # el aro del codo y las piezas chicas junto a él van pegados a lo que los carga
    pegar, base = [], []
    for k, pz in piezas.items():
        n = len(pz["ids"])
        cerca = min(np.linalg.norm(pz["c"] - J["codo"] * np.array([s_, 1, 1])) for s_ in (1, -1))
        if k in G["aro_codo"].values() or (n < 200 and cerca < 0.06):
            pegar.extend(pz["ids"].tolist())
        elif n >= 500 and k != G["cabeza"] and k not in G["mochila"]:
            base.extend(pz["ids"].tolist())
    print("PEGADOS", len(pegar))
    _pegar_a_base(me, W, pegar, base)
    _simetrizar(me, W)
    _soldar(me, W)
    _poner_pesos(obj, W, rig)
    _separar_ojos(obj)
    for o in (obj, bpy.data.objects["Alien_ojos"]):
        _normales_glb(o)
    cerrada = _cierre_quijada(arm, obj)
    arm["cara"] = json.dumps({
        "parpados": {l: {"sup": np.round(i["cierre_sup"], 2).tolist(), "inf": np.round(i["cierre_inf"], 2).tolist()}
                     for l, i in infos.items()},
        "quijada": {"cerrada": cerrada},
        "nota": "grados de +X de parpado_sup_*_0..2 / parpado_inf_*_0..2 para cerrar; quijada en grados (negativo cierra)",
    })
    print("QUIJADA_CERRADA", cerrada)
    for l, i in infos.items():
        print("CIERRE", l, np.round(i["cierre_sup"], 2).tolist(), np.round(i["cierre_inf"], 2).tolist())
    return arm


def _cierre_quijada(arm, malla):
    """Grados de quijada (negativos) en que la boca queda cerrada: de frente (y un
    poco de arriba y de abajo) ya no se ve la lengua. El labio de abajo no llega a
    tocar el de arriba: se mete debajo del hocico."""
    gl = {g.index for g in malla.vertex_groups if g.name.startswith("lengua_")}
    lengua = {v.index for v in malla.data.vertices if sum(g.weight for g in v.groups if g.group in gl) > 0.5}
    caras_l = {p.index for p in malla.data.polygons if any(v in lengua for v in p.vertices)}
    pb = arm.pose.bones["quijada"]
    rayos = [(Vector((x, -1.0, z)), Vector(d).normalized()) for x in np.arange(-0.05, 0.051, 0.01)
             for z in np.arange(1.09, 1.18, 0.006) for d in ((0, 1, 0), (0, 1, -0.25), (0, 1, 0.25))]
    try:
        for g in range(0, -21, -1):
            pb.rotation_quaternion = _q((1, 0, 0), g)
            bpy.context.view_layer.update()
            dg = bpy.context.evaluated_depsgraph_get()
            ev = malla.evaluated_get(dg)
            m = ev.to_mesh()
            co = _coords(m)
            bvh = BVHTree.FromPolygons([Vector(q) for q in co], [list(p.vertices) for p in m.polygons])
            ev.to_mesh_clear()
            ve = sum(1 for o, d in rayos if (h := bvh.ray_cast(o + d * 0.0, d, 3.0))[0] is not None and h[2] in caras_l)
            if ve == 0:
                return g
        return -20
    finally:
        pb.rotation_quaternion = (1, 0, 0, 0)
        bpy.context.view_layer.update()


# ---------------------------------------------------------------- exportar

def exportar(ruta=SALIDA, comprimir=True):
    vl = bpy.context.view_layer
    for o in bpy.data.objects:
        o.select_set(o.name in ("Alien", "Alien_malla", "Alien_ojos", "Alien_parpados"))
    arm = bpy.data.objects["Alien"]
    vl.objects.active = arm
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format="GLB", use_selection=True,
        export_animations=False, export_reset_pose_bones=True, export_rest_position_armature=True,
        export_skins=True, export_def_bones=False, export_leaf_bone=False,
        export_morph=False, export_materials="EXPORT", export_image_format="AUTO",
        export_cameras=False, export_lights=False, export_extras=True,
        export_yup=True, export_apply=False, export_texcoords=True, export_normals=True,
        export_tangents=True,
    )
    if comprimir:
        import subprocess
        npx = "npx.cmd" if os.name == "nt" else "npx"
        subprocess.run([npx, "gltf-transform", "draco", ruta, ruta], cwd=REPO, check=True)
    return ruta


# ---------------------------------------------------------------- poses de prueba

def _q(eje, grados):
    return Quaternion(Vector(eje), math.radians(grados))


def _puno(lado, f=1.0, dedos=("index", "middle", "ring"), pulgar=True):
    """Puño: nudillo 70°, medio 85°, punta 55°; el pulgar, suave."""
    out = {}
    for dedo in dedos:
        for k, g in zip((1, 2, 3), (70, 85, 55)):
            out[f"{dedo}_0{k}_{lado}"] = [("X", g * f)]
    if pulgar:
        for k, g in zip((1, 2, 3), (15, 25, 30)):
            out[f"thumb_0{k}_{lado}"] = [("X", g * f)]
    return out


def _poses():
    P = {"reposo": {}}
    P["brazos"] = {"upper_arm_L": [("X", 35), ("Z", -20)], "lower_arm_L": [("X", 95)], "hand_L": [("X", 30)],
                   "upper_arm_R": [("X", -25), ("Z", 50)], "lower_arm_R": [("X", 60)], "hand_R": [("X", -35)],
                   "shoulder_L": [("X", 10)]}
    P["brazos"].update(_puno("L"))
    P["brazos"].update({f"{d}_0{k}_R": [("X", -12)] for d in ("index", "middle", "ring") for k in (1, 2, 3)})
    P["arriba"] = {"upper_arm_L": [("Z", -75)], "upper_arm_R": [("X", 80)], "lower_arm_R": [("X", 30)],
                   "shoulder_L": [("X", 15)]}
    P["piernas"] = {"upper_leg_L": [("X", 75)], "lower_leg_L": [("X", 95)], "foot_L": [("X", -20)],
                    "upper_leg_R": [("X", -25)], "lower_leg_R": [("X", 40)], "foot_R": [("X", 15)], "toes_R": [("X", 25)]}
    P["torso"] = {"spine": [("X", 18)], "chest": [("X", 10), ("Y", 15)], "neck": [("X", 6), ("Y", 15)],
                  "head": [("X", 8), ("Z", 10), ("Y", 15)], "upper_arm_L": [("X", 20)], "upper_arm_R": [("X", 20)]}
    P["torso_atras"] = {"spine": [("X", -15)], "chest": [("X", -10), ("Z", -12)], "head": [("X", -12)],
                        "neck": [("X", -6)]}
    P["mano"] = dict(_puno("L"))
    P["mano"].update({"hand_L": [("X", 40)]})
    P["mano"].update(_puno("R", dedos=("middle", "ring")))     # señala con el índice
    P["mano"].update({"hand_R": [("X", -40), ("Z", 25)]})
    return P


def _cara_pose(arm, parp=(0.0, 0.0, 0.0, 0.0), quijada=0.0, lengua=(0.0, 0.0)):
    cara = json.loads(arm["cara"])
    pb = arm.pose.bones
    for (lado, cual), k in zip((("L", "sup"), ("L", "inf"), ("R", "sup"), ("R", "inf")), parp):
        for b in range(3):
            pb[f"parpado_{cual}_{lado}_{b}"].rotation_quaternion = _q((1, 0, 0), cara["parpados"][lado][cual][b] * k)
    pb["quijada"].rotation_quaternion = _q((1, 0, 0), quijada)
    pb["lengua_1"].rotation_quaternion = _q((1, 0, 0), lengua[0])
    pb["lengua_2"].rotation_quaternion = _q((1, 0, 0), lengua[1])


def posar(arm, pose):
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    ejes = {"X": (1, 0, 0), "Y": (0, 1, 0), "Z": (0, 0, 1)}
    for nombre, giros in pose.items():
        q = Quaternion()
        for e, g in giros:
            q = q @ _q(ejes[e], g)
        arm.pose.bones[nombre].rotation_quaternion = q
    bpy.context.view_layer.update()


# ---------------------------------------------------------------- medir

def _signo_islas(me, P, isla, bvh, muestras=60):
    """+1 si las normales de la pieza ven hacia afuera, -1 si hacia adentro (el
    cascarón de adentro del traje): un rayo por la normal de adentro choca con la
    misma pieza."""
    vn = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("normal", vn)
    vn = vn.reshape(-1, 3)
    caras_isla = np.array([isla[p.vertices[0]] for p in me.polygons])
    signo = {}
    rng = np.random.default_rng(0)
    for k in range(isla.max() + 1):
        ids = np.where(isla == k)[0]
        sel = rng.choice(ids, min(muestras, len(ids)), replace=False)
        mas = menos = 0
        for i in sel:
            o, n = Vector(P[i]), Vector(vn[i])
            h = bvh.ray_cast(o + n * 0.0008, n, 1.0)
            mas += h[0] is not None and caras_isla[h[2]] == k
            h = bvh.ray_cast(o - n * 0.0008, -n, 1.0)
            menos += h[0] is not None and caras_isla[h[2]] == k
        signo[k] = -1 if mas > menos else 1
    return signo, vn


def _cubiertos(obj, alcance=0.035):
    """Vértices con otra pieza encima: {vértice: (vértices de la cara que lo tapa,
    pesos baricéntricos)}."""
    from mathutils.interpolate import poly_3d_calc
    me = obj.data
    P = _coords(me)
    isla = _islas(me)
    caras = [list(p.vertices) for p in me.polygons]
    bvh = BVHTree.FromPolygons([Vector(p) for p in P], caras)
    signo, vn = _signo_islas(me, P, isla, bvh)
    res = {}
    for i in range(len(P)):
        n = Vector(vn[i] * signo[isla[i]])
        h = bvh.ray_cast(Vector(P[i]) + n * 0.0015, n, alcance)
        if h[0] is None:
            continue
        vs = caras[h[2]]
        if isla[vs[0]] == isla[i]:
            continue
        nf = Vector(vn[vs].sum(0) * signo[isla[vs[0]]]).normalized()
        if nf.dot(n) < 0.3:
            continue
        res[i] = (vs, list(poly_3d_calc([Vector(P[j]) for j in vs], h[0])), int(isla[vs[0]]))
    return res, isla, signo


def medir(nombres=None):
    """Cuánto se sale cada vértice tapado de la cara que lo tapa (cm), por pose."""
    arm = bpy.data.objects["Alien"]
    malla = bpy.data.objects["Alien_malla"]
    cub, isla, signo = _cubiertos(malla)
    idx = np.array(list(cub))
    print("CUBIERTOS", len(idx))
    poses = _poses()
    res = {}
    for nombre in (nombres or list(poses)):
        posar(arm, poses[nombre])
        dg = bpy.context.evaluated_depsgraph_get()
        ev = malla.evaluated_get(dg)
        m = ev.to_mesh()
        co = _coords(m)
        ev.to_mesh_clear()
        peor = {}
        P0 = _coords(malla.data)
        for i in idx:
            vs, w, k_out = cub[i]
            Q = co[vs]
            p = (Q * np.array(w)[:, None]).sum(0)
            nf = np.cross(Q[1] - Q[0], Q[2] - Q[0])
            nf /= max(1e-12, np.linalg.norm(nf))
            # orientación hacia afuera, igual que en reposo
            Q0 = P0[vs]
            n0 = np.cross(Q0[1] - Q0[0], Q0[2] - Q0[0])
            n0 /= max(1e-12, np.linalg.norm(n0))
            p0 = (Q0 * np.array(w)[:, None]).sum(0)
            ref = P0[i] - p0
            if n0 @ ref > 0:
                nf, n0 = -nf, -n0
            fuera = float((co[i] - p) @ nf)
            par = (int(isla[i]), k_out)
            if fuera > peor.get(par, (0.0,))[0]:
                peor[par] = (fuera, int(i))
        malos = {f"{a}>{b}": (round(v * 100, 2), j) for (a, b), (v, j) in peor.items() if v > 0.002}
        res[nombre] = dict(sorted(malos.items(), key=lambda kv: -kv[1][0])[:12])
        print("CAPAS", nombre, json.dumps(res[nombre]))
    posar(arm, {})
    return res


# ---------------------------------------------------------------- fotos

def _camara():
    sc = bpy.context.scene
    cam = bpy.data.objects.get("cam_fotos")
    if cam is None:
        cd = bpy.data.cameras.new("cam_fotos")
        cd.type = "ORTHO"
        cd.clip_start = 0.01
        cd.clip_end = 30
        cam = bpy.data.objects.new("cam_fotos", cd)
        sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "TEXTURE"
    sh.show_object_outline = True
    sh.object_outline_color = (0, 0, 0)
    sh.show_cavity = False
    sh.show_specular_highlight = False
    sc.view_settings.view_transform = "Standard"
    sc.world = sc.world or bpy.data.worlds.new("w")
    sc.world.color = (0.02, 0.12, 0.55)
    m = bpy.data.materials["Alien"]
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image and n.image.name == "Image_0":
            m.node_tree.nodes.active = n
    return cam


def foto(ruta, target, d, escala, res=(800, 800)):
    sc = bpy.context.scene
    cam = _camara()
    t, d = Vector(target), Vector(d).normalized()
    cam.location = t + d * 8
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam.data.ortho_scale = escala
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)


def fotos(carpeta=FOTOS):
    os.makedirs(carpeta, exist_ok=True)
    arm = bpy.data.objects["Alien"]
    cuerpo = (0, 0, 0.8)
    for nombre, pose in _poses().items():
        posar(arm, pose)
        foto(os.path.join(carpeta, f"{nombre}_frente.png"), cuerpo, (0, -1, 0.05), 1.75)
        foto(os.path.join(carpeta, f"{nombre}_34.png"), cuerpo, (0.8, -1, 0.15), 1.75)
    # acercamientos, encuadrados en el hueso ya posado
    def en(n, cola=False):
        pb = arm.pose.bones[n]
        return tuple(arm.matrix_world @ (pb.tail if cola else pb.head))

    def z(nombre, target, d, escala):
        foto(os.path.join(carpeta, f"zoom_{nombre}.png"), target, d, escala)
    posar(arm, _poses()["brazos"])
    z("codo", en("lower_arm_L"), (0.3, -1, 0.4), 0.32)
    z("codo_atras", en("lower_arm_L"), (0.4, 1, 0.3), 0.32)
    z("codo_der", en("lower_arm_R"), (-0.5, -1, 0.3), 0.32)
    posar(arm, _poses()["mano"])
    z("puno", en("hand_L", True), (0.3, -1, 0.2), 0.24)
    z("puno_abajo", en("hand_L", True), (0.3, -0.4, -1), 0.24)
    z("mano_der", en("hand_R", True), (-0.3, -1, 0.2), 0.24)
    posar(arm, _poses()["reposo"])
    z("mano_reposo", en("hand_L", True), (0.3, -1, 0.2), 0.24)
    posar(arm, _poses()["arriba"])
    z("hombro", en("upper_arm_L"), (0.6, -1, 0.2), 0.4)
    z("hombro_der", en("upper_arm_R"), (-0.3, -1, 0.6), 0.4)
    z("hombro_atras", en("upper_arm_R"), (-0.5, 1, 0.3), 0.4)
    posar(arm, _poses()["piernas"])
    z("rodilla", en("lower_leg_L"), (1, -0.4, 0.1), 0.4)
    z("rodilla_atras", en("lower_leg_L"), (0.6, 1, 0.1), 0.4)
    z("cadera_atras", en("hips"), (0.4, 1, 0.1), 0.55)
    z("tobillo", en("foot_R"), (1, -0.5, 0.2), 0.35)
    posar(arm, _poses()["torso"])
    z("cuello", en("neck"), (0.7, -1, 0.1), 0.45)
    z("mochila", en("chest"), (0.6, 1, 0.2), 0.6)
    posar(arm, _poses()["torso_atras"])
    z("mochila_atras", en("spine"), (1, 0.5, 0.1), 0.6)
    # cara
    posar(arm, {})
    cabeza, de_frente, de_lado = (0, -0.2, 1.27), (0.15, -1, 0.05), (0.8, -1, 0.05)
    for nombre, kw in (("abierto", {}),
                       ("medio", {"parp": (0.5, 0.5, 0.5, 0.5)}),
                       ("parpadeo", {"parp": (1, 1, 1, 1)}),
                       ("guino", {"parp": (1, 1, 0, 0)}),
                       ("boca_abierta", {"quijada": 14, "lengua": (-10, 15)}),
                       ("boca_cerrada", {"quijada": json.loads(arm["cara"]).get("quijada", {}).get("cerrada", -8)})):
        posar(arm, {})
        _cara_pose(arm, **kw)
        bpy.context.view_layer.update()
        foto(os.path.join(carpeta, f"cara_{nombre}.png"), cabeza, de_frente, 0.62)
        foto(os.path.join(carpeta, f"cara_{nombre}_lado.png"), cabeza, de_lado, 0.62)
    posar(arm, {})


# ---------------------------------------------------------------- guardar

_MTIME = {}


def _recordar_mtime():
    _MTIME["blend"] = os.path.getmtime(BLEND) if os.path.exists(BLEND) else None


def guardar():
    """No pisa el .blend si otra sesión lo cambió desde que empezó este proceso."""
    ahora = os.path.getmtime(BLEND) if os.path.exists(BLEND) else None
    if ahora != _MTIME.get("blend"):
        raise RuntimeError(f"{BLEND} cambió mientras corría (mtime {ahora} != {_MTIME.get('blend')})")
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    _recordar_mtime()


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["todo"]
    cmd = argv[0]
    _recordar_mtime()
    if cmd in ("todo", "armar"):
        armar()
        guardar()
    else:
        bpy.ops.wm.open_mainfile(filepath=BLEND)
        _recordar_mtime()
    if cmd in ("todo", "exportar"):
        print("GLB", exportar())
    if cmd == "medir":
        medir(argv[1].split(",") if len(argv) > 1 else None)
    if cmd == "todo":
        medir()
    if cmd in ("todo", "fotos"):
        fotos(argv[1] if len(argv) > 1 else FOTOS)


if __name__ == "__main__":
    main()
