"""Lozas de piedra pintadas para el piso del home (Oscar, 2026-11-19): una
calcomanía que el sitio pone al centro, donde cae Skulley (src/lib/pisoPintado.js).

Es una mancha de lozas grandes de lados rectos (como su referencia de lozas de
piedra), más grandes al centro, que se sueltan y se desvanecen hacia la orilla
hasta perderse en la tierra. Cada loza de un tono, casi plana, con un bisel de
luz y sombra en la orilla, juntas finas como grietas y algunas partidas por una
grieta que las cruza. Gris = el valor (0.5 es el azul de siempre), alfa = dónde
hay piedra o junta (fuera de eso se ve la tierra).

    python scripts/piso/pintar_piedras.py public/textures/piso-piedras.webp [semilla]

La del claro entero (hasta la orilla del bosque), en dos grises:
    python scripts/piso/pintar_piedras.py --claro public/textures/piso-claro-gris.webp public/textures/piso-claro-alfa.webp [semilla]
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pintar_tierra import Lienzo, difuminar, pincelada, ruido_periodico  # noqa: E402

S = 2048
# Lo que mide la calcomanía en el mundo (PLAZA en pisoPintado.js). Las medidas
# de abajo están pensadas para 11 unidades; E las lleva a los pixeles de ahora,
# así un área más grande no agranda las piedras.
MUNDO = 26
E = (S / MUNDO) / (2048 / 11)
# Tamaños de piedra: (intentos, radio mínimo, radio máximo) en pixeles a 11
# unidades; las grandes se acomodan primero y las chicas llenan huecos.
# Lozas grandes, sin piedritas alrededor (Oscar, su referencia 2 de lozas de piedra).
TAMANOS = ((200, 240, 360), (420, 150, 220))
# Qué tanto se pueden encimar sus círculos al acomodarlas (menos de 1: se tocan).
SEPARA = 0.72
# Cuánto pesa el tamaño al repartir el espacio: con peso los lados salen curvos;
# las lozas de la referencia los tienen rectos.
PESO = 0.0
JUNTA = 6              # ancho de la junta entre piedras (Oscar: fina)
CUERPO = 0.6           # tono de las piedras (más claro que la tierra)
JUNTA_TONO = 0.45
# El grueso de la junta va de JUNTA_MIN a JUNTA_MAX veces el de base.
JUNTA_MIN = 0.45
JUNTA_MAX = 2.6
LUZ = 0.07             # la cara que mira a la luz, sobre el cuerpo
SOMBRA = 0.06          # la cara contraria, bajo el cuerpo
SOMBRA_HONDA = 0.04    # lo más inclinado de la sombra (se suma)
BRILLO = 0.03          # el toque claro pintado del lado de la luz
RELIEVE = 3.0          # qué tan marcado el bisel: escala de la pendiente
BLUR = 2.5
# Desde qué fracción del radio de la mancha empiezan a desvanecerse las piedras.
DESVANECE = 0.65
# Esquinas del polígono de cada piedra y cuántas piedras llevan grieta.
ESQUINAS = 8
CON_GRIETA = 0.6
# Cuánto crecen las piedras al centro de la mancha y cuánto se encogen en la orilla.
CENTRO_GRANDE = 1.25
ORILLA_CHICA = 0.75


def pintar(semilla=11, radio=0.4, onda=(0.04, 0.12), suelta=0.45, desvanece=None):
    """radio: el de la mancha, en fracción del lienzo; onda: qué tanto ondula su
    orilla; suelta: en qué fracción del radio se empiezan a soltar las piedras;
    desvanece: en qué fracción se desvanecen (DESVANECE si no se da)."""
    rng = np.random.default_rng(semilla)
    cx = cy = S / 2
    radio_mancha = radio * S
    # Orilla de la mancha irregular: un radio que cambia con el ángulo.
    armonicos = [(k, rng.uniform(*onda) / k ** 0.6, rng.uniform(0, 6.3)) for k in range(2, 8)]

    def radio_en(th):
        return radio_mancha * (1 + sum(a * math.cos(k * th + f) for k, a, f in armonicos))

    # Con el área grande la junta escalada quedaba de 2.5 px y el redondeo la cerraba.
    junta = max(JUNTA * E, 3.0)
    # Piedras de varios tamaños (Oscar: unas grandes y otras chicas, para que no
    # sean tantas). Hacia la orilla de la mancha se van perdiendo.
    semillas = []
    for intentos, rmin, rmax in TAMANOS:
        for _ in range(int(intentos / (E * E))):
            ang = rng.uniform(0, 2 * math.pi)
            dist = radio_mancha * 1.05 * math.sqrt(rng.uniform())
            # Más grandes al centro y más chicas hacia la orilla (Oscar).
            rad = rng.uniform(rmin, rmax) * E * (CENTRO_GRANDE + (ORILLA_CHICA - CENTRO_GRANDE) * min(dist / radio_mancha, 1))
            px, py = cx + dist * math.cos(ang), cy + dist * math.sin(ang)
            borde = radio_en(ang)
            queda = np.clip((borde * 1.02 - dist) / (borde * suelta), 0, 1)
            if rng.uniform() > queda ** 1.2:
                continue
            if any(math.hypot(px - q[0], py - q[1]) < (rad + q[2]) * SEPARA + junta for q in semillas):
                continue
            semillas.append((px, py, rad, rng.uniform(-0.035, 0.035)))

    gris, alfa = pintar_lozas(rng, semillas, (S, S), junta)
    return desvanecer_mancha(rng, gris, alfa, cx, cy, radio_mancha, armonicos, desvanece or DESVANECE), len(semillas)


def pintar_lozas(rng, semillas, forma, junta, envolver_y=False):
    """Pinta lozas desde semillas [(x, y, radio, tono)] en un lienzo `forma` (alto,
    ancho). Con `envolver_y` cierra de arriba a abajo (la tira del camino).
    Devuelve (gris, alfa) sin desvanecer."""
    H, W = forma
    n = len(semillas)
    sem = np.array(semillas, np.float32)
    # Cada piedra es un polígono de esquinas a distinto radio, un poco alargado:
    # Oscar las quería menos circulares.
    huecos = rng.uniform(0.35, 1.65, (n, ESQUINAS))
    angulos = np.cumsum(huecos, 1) / huecos.sum(1, keepdims=True) * 2 * np.pi + rng.uniform(0, 6.3, (n, 1))
    angulos = np.sort(np.mod(angulos, 2 * np.pi), 1)
    # Más grande que su lugar: la celda de Voronoi lo recorta y quedan juntas.
    radios = sem[:, 2:3] * rng.uniform(1.7, 2.2, (n, ESQUINAS))
    alarga = rng.uniform(0.68, 1.0, n)
    giro = rng.uniform(0, np.pi, n)
    vx = radios * np.cos(angulos)
    vy = radios * np.sin(angulos)
    # Alargar a lo largo de `giro` (encoger el eje perpendicular).
    cg, sg = np.cos(giro)[:, None], np.sin(giro)[:, None]
    u = vx * cg + vy * sg
    w = (-vx * sg + vy * cg) * alarga[:, None]
    vx, vy = u * cg - w * sg, u * sg + w * cg
    angulos = np.mod(np.arctan2(vy, vx), 2 * np.pi)
    orden = np.argsort(angulos, 1)
    angulos = np.take_along_axis(angulos, orden, 1)
    vx = np.take_along_axis(vx, orden, 1)
    vy = np.take_along_axis(vy, orden, 1)

    # Voronoi con peso (la distancia menos el radio de cada piedra, así las grandes
    # se quedan con su lugar): la más cercana (F1), la segunda (F2) y de quién es.
    f1 = np.full((H, W), 1e9, np.float32)
    f2 = np.full((H, W), 1e9, np.float32)
    ide = np.full((H, W), -1, np.int32)
    # Qué copia de la semilla ganó (desplazamiento en y), para la tira que cierra.
    corrida = np.zeros((H, W), np.float32)
    for i, (px0, py0, rad, _) in enumerate(semillas):
        caja = int(rad * 1.7 + 24)
        for oy in ((0.0, -H, H) if envolver_y else (0.0,)):
            px, py = px0, py0 + oy
            x0, y0 = max(int(px) - caja, 0), max(int(py) - caja, 0)
            x1, y1 = min(int(px) + caja, W), min(int(py) + caja, H)
            if x1 <= x0 or y1 <= y0:
                continue
            ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)
            d = np.hypot(xs - px, ys - py) - PESO * rad
            a1, a2, ai, ac = f1[y0:y1, x0:x1], f2[y0:y1, x0:x1], ide[y0:y1, x0:x1], corrida[y0:y1, x0:x1]
            mas_cerca = d < a1
            a2[:] = np.where(mas_cerca, a1, np.minimum(a2, d))
            a1[:] = np.where(mas_cerca, d, a1)
            ai[:] = np.where(mas_cerca, i, ai)
            ac[:] = np.where(mas_cerca, oy, ac)

    valido = ide >= 0
    k = np.clip(ide, 0, None)
    propia = f1 + PESO * sem[k, 2]
    # El radio del polígono en la dirección de cada pixel: el lado que cruza ese
    # ángulo, intersectado con el rayo desde el centro. Por bandas de renglones:
    # con la calcomanía del claro (4096 px) los arreglos de (alto, ancho, esquinas)
    # no cabían en memoria.
    r_px = np.zeros((H, W), np.float32)
    banda = 256
    xx = np.arange(W, dtype=np.float32)[None, :]
    for y0 in range(0, H, banda):
        y1 = min(y0 + banda, H)
        kb = k[y0:y1]
        yy = np.arange(y0, y1, dtype=np.float32)[:, None]
        dx = xx - sem[kb, 0]
        dy = yy - (sem[kb, 1] + corrida[y0:y1])
        th = np.mod(np.arctan2(dy, dx), 2 * np.pi)
        ang_k = angulos[kb]
        j = (ang_k <= th[..., None]).sum(-1) % ESQUINAS
        ja = (j - 1) % ESQUINAS
        ax = np.take_along_axis(vx[kb], ja[..., None], -1)[..., 0]
        ay = np.take_along_axis(vy[kb], ja[..., None], -1)[..., 0]
        bx = np.take_along_axis(vx[kb], j[..., None], -1)[..., 0]
        by = np.take_along_axis(vy[kb], j[..., None], -1)[..., 0]
        ux, uy = np.cos(th), np.sin(th)
        ex, ey = bx - ax, by - ay
        den = ux * ey - uy * ex
        rb = (ax * ey - ay * ex) / np.where(np.abs(den) < 1e-6, 1e-6, den)
        r_px[y0:y1] = np.where(valido[y0:y1], np.abs(rb), 0)
    del corrida
    # Piedra: dentro de su celda (lejos de la junta) y dentro de su polígono.
    # La junta cambia de grueso a lo largo (Oscar: que no se sienta como un trazo
    # del mismo grueso): un ruido la abre y la cierra, y cada loza va un poco más o
    # menos retraída que su vecina.
    abre = np.clip(ruido_periodico(rng, 22, forma=forma) * 0.5 + 0.5, 0, 1) ** 1.6
    junta_campo = junta * (JUNTA_MIN + (JUNTA_MAX - JUNTA_MIN) * abre)
    retrae = rng.uniform(0, 1, n).astype(np.float32) ** 2 * junta * 0.9
    dentro = np.minimum((f2 - f1) / 2 - junta_campo / 2 - np.where(valido, retrae[k], 0), r_px - propia)
    piedra = difuminar((dentro > 0).astype(np.float32), 0.9) > 0.5  # esquinas casi vivas
    piedra &= valido
    # Junta: lo que rodea a las piedras dentro de la mancha.
    juntas = difuminar(((r_px - propia + junta) > 0).astype(np.float32) * valido, 3 * E) > 0.5
    alfa = (juntas | piedra).astype(np.float32)

    # Volumen (Oscar: en la referencia no son planas, tienen profundidad, sombras
    # y algo de luz). La altura de cada piedra sale de su forma difuminada a varias
    # escalas: las grandes quedan más abombadas y las chicas más planas. Con su
    # pendiente se sombrea contra una luz de arriba a la izquierda de la imagen
    # (arriba a la derecha en pantalla, como la luz principal de la escena), en
    # bandas suaves y sin salir de los tonos del piso.
    pf = piedra.astype(np.float32)
    # Lozas casi planas: el volumen es un bisel en la orilla (escalas chicas).
    alto = sum(difuminar(pf, sg) for sg in (1.2, 2.5, 5.0)) / 3 * pf
    gx = (np.roll(alto, -1, 1) - np.roll(alto, 1, 1)) * RELIEVE
    gyy = (np.roll(alto, -1, 0) - np.roll(alto, 1, 0)) * RELIEVE
    nz = 1 / np.sqrt(gx * gx + gyy * gyy + 1)
    luz_dir = np.array([-0.5, -0.7, 0.75], np.float32)
    luz_dir /= np.linalg.norm(luz_dir)
    cara = (-gx * luz_dir[0] - gyy * luz_dir[1] + luz_dir[2]) * nz - luz_dir[2]
    del gx, gyy, nz
    claro = np.clip((cara - 0.05) / 0.05, 0, 1)
    sombra = np.clip((-cara - 0.05) / 0.05, 0, 1)
    honda = np.clip((-cara - 0.2) / 0.06, 0, 1)
    orilla = piedra & (alto < 0.55)

    lienzo = Lienzo(0.5, forma)
    c = lienzo.c
    c[juntas] = JUNTA_TONO
    cuerpo = CUERPO + np.where(valido, sem[k, 3], 0)
    c[piedra] = cuerpo[piedra]
    c += pf * (LUZ * claro - SOMBRA * sombra - SOMBRA_HONDA * honda)
    del claro, sombra, honda

    # Pinceladas suaves, brillos pintados y motitas, como diferencias sobre el
    # volumen (pintarlas con un tono fijo lo aplanaba).
    capa = Lienzo(0.0, forma)
    for (px, py, rad, _) in semillas:
        for _ in range(int(rng.integers(1, 3))):
            ox, oy = rng.normal(0, rad * 0.3, 2)
            pincelada(capa, rng, px + ox, py + oy, rng.normal(0.1, 0.5), rng.uniform(rad * 0.5, rad * 1.0),
                      rng.uniform(rad * 0.15, rad * 0.28), 0.025 if rng.uniform() < 0.5 else -0.022, seca=0.5)
        if rad > 35 * E and rng.uniform() < 0.5:
            # Brillo: un toque claro del lado de la luz.
            pincelada(capa, rng, px - rad * 0.32, py - rad * 0.38, -0.6 + rng.normal(0, 0.25),
                      rad * rng.uniform(0.4, 0.65), rad * rng.uniform(0.12, 0.18), BRILLO, seca=0.3)
        if rng.uniform() < 0.3:
            pincelada(capa, rng, px + rng.normal(0, rad * 0.3), py + rng.normal(0, rad * 0.3), 0.0,
                      rng.uniform(2.5, 4.0), rng.uniform(2.5, 3.5), -0.06, seca=0.0, curva=0.0)
    c += capa.c * (piedra & ~orilla)
    del capa

    # Grietas estilizadas, como se pintan a mano (Oscar: las de pasos al azar se
    # veían feas): dos o tres tramos rectos en zigzag, gruesa donde nace en la
    # orilla y afilada en la punta, a veces con una rama; oscura y con un filo de
    # luz abajo.
    grieta = np.zeros((H, W), np.float32)
    labio = np.zeros((H, W), np.float32)

    def tramo_quebrado(x, y, ang, largo, ancho, duena):
        puntos = [(x, y)]
        n_tramos = int(rng.integers(2, 4))
        for i in range(n_tramos):
            if i:
                ang += rng.choice((-1, 1)) * rng.uniform(0.35, 0.75)
            paso = largo / n_tramos * rng.uniform(0.8, 1.2)
            x, y = x + math.cos(ang) * paso, y + math.sin(ang) * paso
            puntos.append((x, y))
        pts = np.array(puntos, np.float32)
        largos = np.hypot(*(pts[1:] - pts[:-1]).T)
        total = largos.sum()
        m = int(ancho + 4)
        x0, y0 = int(pts[:, 0].min()) - m, int(pts[:, 1].min()) - m
        x1, y1 = int(pts[:, 0].max()) + m + 2, int(pts[:, 1].max()) + m + 4
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
        if x1 <= x0 or y1 <= y0:
            return pts, ang
        ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)

        def forma(dy):
            mejor = np.zeros_like(xs)
            acumulado = 0.0
            for (ax, ay), (bx, by), lg in zip(pts[:-1], pts[1:], largos):
                ex, ey = bx - ax, by - ay
                t = np.clip(((xs - ax) * ex + (ys - dy - ay) * ey) / max(lg * lg, 1e-6), 0, 1)
                dist = np.hypot(xs - (ax + ex * t), ys - dy - (ay + ey * t))
                a_lo_largo = (acumulado + t * lg) / total
                medio = (ancho * (1 - a_lo_largo) ** 0.9 + 0.5) / 2
                mejor = np.maximum(mejor, np.clip(medio - dist + 0.5, 0, 1))
                acumulado += lg
            return mejor

        suya = (ide[y0:y1, x0:x1] == duena).astype(np.float32)  # no pasa a la piedra vecina
        g = forma(0.0) * suya
        sube = forma(-1.8) * suya  # la misma grieta corrida hacia abajo: su filo de luz
        grieta[y0:y1, x0:x1] = np.maximum(grieta[y0:y1, x0:x1], g)
        labio[y0:y1, x0:x1] = np.maximum(labio[y0:y1, x0:x1], np.clip(sube - g, 0, 1))
        return pts, ang

    for i, (px, py, rad, _) in enumerate(semillas):
        if rad < 50 * E or rng.uniform() > CON_GRIETA:
            continue
        if envolver_y and (py < rad * 2.5 or py > H - rad * 2.5):
            continue  # junto a la costura de la tira la grieta saldría cortada
        a0 = rng.uniform(0, 2 * math.pi)
        x, y = px + math.cos(a0) * rad * 1.1, py + math.sin(a0) * rad * 1.1
        hacia = math.atan2(py - y, px - x) + rng.normal(0, 0.3)
        # Grietas finas que cruzan la loza de orilla a orilla, como en la referencia.
        ancho = rng.uniform(1.8, 2.6)
        pts, ang = tramo_quebrado(x, y, hacia, rad * rng.uniform(1.8, 2.4), ancho, i)
        if rng.uniform() < 0.45:
            bx, by = pts[1]
            tramo_quebrado(bx, by, ang + rng.choice((-1, 1)) * rng.uniform(0.7, 1.1), rad * rng.uniform(0.35, 0.6), ancho * 0.6, i)
    dentro_piedra = (piedra & ~orilla).astype(np.float32)
    grieta *= dentro_piedra
    labio *= dentro_piedra * 0.8
    c[:] = c + (np.maximum(c, CUERPO + LUZ * 0.7) - c) * labio
    c[:] = c + (JUNTA_TONO - c) * grieta

    gris = np.clip(difuminar(c, BLUR * E), 0, 1)
    alfa = np.clip(difuminar(alfa, BLUR * 0.8 * E), 0, 1)
    return gris, alfa


def desvanecer_mancha(rng, gris, alfa, cx, cy, radio_mancha, armonicos, desvanece=DESVANECE):
    """Hacia la orilla de la mancha las piedras se desvanecen hasta perderse en la
    tierra (Oscar), siguiendo la orilla irregular y con un poco de ruido."""
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    th = np.arctan2(yy - cy, xx - cx)
    borde = radio_mancha * (1 + sum(a * np.cos(kk * th + f) for kk, a, f in armonicos))
    llega = (borde - np.hypot(xx - cx, yy - cy)) / (borde * desvanece) + ruido_periodico(rng, 90 * E, forma=(S, S)) * 0.18
    llega = np.clip(llega, 0, 1)
    alfa *= llega * llega * (3 - 2 * llega)
    return gris, alfa


def guardar(gris, alfa, ruta):
    from PIL import Image
    g = np.round(gris * 255).astype(np.uint8)
    a = np.round(alfa * 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([g, g, g, a]), 'RGBA')
    if ruta.lower().endswith('.webp'):
        # El alfa con pérdida (calidad 70) baja el archivo a la mitad sin que se note.
        im.save(ruta, quality=85, alpha_quality=70, method=6)
    else:
        im.save(ruta)


# Las lozas del claro (Oscar, 2026-11-25: que el piso de piedra de los portales
# llegue hasta la orilla, antes de los pinos, pero no pegado a ellos). Una mancha
# de 25 unidades de radio (el bosque empieza en 30: quedan ~5 de tierra) con la
# orilla casi redonda, que se suelta y se desvanece en sus últimas ~4 unidades. En
# 54 unidades a 4096 px quedan 76 px por unidad (la del centro de antes, 79). Va en dos imágenes de un solo canal (gris y alfa), así en la
# GPU son R8 y no un RGBA de 4096 (89 MB con mipmaps): el alfa casi no tiene
# detalle fino y va a la mitad.
CLARO = dict(lienzo=4096, mundo=54, radio=25.0, onda=(0.012, 0.035), suelta=0.2, desvanece=0.17)


def pintar_claro(semilla=31):
    global S, MUNDO, E
    S, MUNDO = CLARO['lienzo'], CLARO['mundo']
    E = (S / MUNDO) / (2048 / 11)
    return pintar(semilla, radio=CLARO['radio'] / MUNDO, onda=CLARO['onda'],
                  suelta=CLARO['suelta'], desvanece=CLARO['desvanece'])


def guardar_claro(gris, alfa, ruta_gris, ruta_alfa):
    """El gris a lienzo completo y el alfa a la mitad, cada uno en un canal."""
    from PIL import Image
    g = Image.fromarray(np.round(np.clip(gris, 0, 1) * 255).astype(np.uint8), 'L')
    a = Image.fromarray(np.round(np.clip(alfa, 0, 1) * 255).astype(np.uint8), 'L')
    a = a.resize((a.width // 2, a.height // 2), Image.LANCZOS)
    for im, ruta, q in ((g, ruta_gris, 85), (a, ruta_alfa, 80)):
        if ruta.lower().endswith('.webp'):
            im.save(ruta, quality=q, method=6)
        else:
            im.save(ruta)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    if args and args[0] == '--claro':
        # python scripts/piso/pintar_piedras.py --claro gris.webp alfa.webp [semilla]
        semilla = int(args[3]) if len(args) > 3 else 31
        (gris, alfa), n = pintar_claro(semilla)
        guardar_claro(gris, alfa, args[1], args[2])
        print('listo', args[1], args[2], n, 'piedras')
        sys.exit(0)
    ruta = args[0] if args else 'piso-piedras.png'
    semilla = int(args[1]) if len(args) > 1 else 11
    (gris, alfa), n = pintar(semilla)
    guardar(gris, alfa, ruta)
    print('listo', ruta, n, 'piedras')
