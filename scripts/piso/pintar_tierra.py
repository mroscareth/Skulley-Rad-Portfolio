"""Tierra pintada a mano para el piso del home (Oscar, 2026-11-19).

Pinta con pinceladas una textura en grises que cierra en mosaico sin costura.
El sitio la pinta del azul de la escena (src/lib/pisoPintado.js): el gris medio
es el azul de siempre, lo oscuro lo oscurece y lo claro lo acerca al blanco.

Es una sola imagen en grises (pocos valores, como gouache, con la orilla de
cada trazo un poco difuminada). El desgaste lo pone el sitio con un ruido aparte.

Se corre igual con Python (numpy + Pillow) o dentro de Blender, donde también
deja la imagen en el .blend para pintarle encima:
    python scripts/piso/pintar_tierra.py public/textures/piso-tierra.webp [semilla]
"""
import math
import sys

import numpy as np

S = 2048
# Valores de la paleta: el 2 es el azul de siempre.
# Oscar no quiere azules oscuros: lo de abajo del medio es un solo tono, apenas
# más oscuro (el 0 y el 1 son iguales).
PALETA = np.array([0.45, 0.45, 0.5, 0.59, 0.7], dtype=np.float32)
# Cuánto se difumina la orilla de cada trazo, en fracción de su grosor, y el
# blur final de todo el lienzo (en pixeles), que también suaviza las cerdas.
BLUR_TRAZO = 0.22
BLUR_FINAL = 4.5


def ruido_periodico(rng, sigma_px, n=S, forma=None):
    """Ruido suave que cierra en mosaico (filtrado en frecuencia), media 0, desviación 1.
    `forma` (alto, ancho) para un lienzo que no es cuadrado."""
    h, w = forma or (n, n)
    fx, fy = np.meshgrid(np.fft.fftfreq(w).astype(np.float32), np.fft.fftfreq(h).astype(np.float32))
    filtro = np.exp(-((fx * fx + fy * fy) * (2 * math.pi * sigma_px) ** 2) / 2)
    out = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((h, w)).astype(np.float32)) * filtro))
    return ((out - out.mean()) / out.std()).astype(np.float32)


def difuminar(img, sigma_px):
    """Blur gaussiano con vuelta en las orillas (sigue cerrando en mosaico)."""
    h, w = img.shape
    fx, fy = np.meshgrid(np.fft.fftfreq(w).astype(np.float32), np.fft.fftfreq(h).astype(np.float32))
    filtro = np.exp(-((fx * fx + fy * fy) * (2 * math.pi * sigma_px) ** 2) / 2)
    return np.real(np.fft.ifft2(np.fft.fft2(img) * filtro)).astype(np.float32)


def muestrear(img, x, y):
    """Lectura bilineal con vuelta en las orillas."""
    n = img.shape[0]
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    fx = (x - x0).astype(np.float32)
    fy = (y - y0).astype(np.float32)
    x0 %= n
    y0 %= n
    x1 = (x0 + 1) % n
    y1 = (y0 + 1) % n
    a = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    b = img[y1, x0] * (1 - fx) + img[y1, x1] * fx
    return a * (1 - fy) + b * fy


def cuantiles(campo, partes):
    """Índice de la paleta según el reparto pedido (fracciones que suman 1)."""
    cortes = np.quantile(campo, np.cumsum(partes)[:-1])
    return np.searchsorted(cortes, campo).astype(np.int8)


class Lienzo:
    def __init__(self, valor, forma=None):
        self.c = np.full(forma or (S, S), valor, dtype=np.float32)

    def componer(self, x0, y0, alfa, valor):
        h, w = alfa.shape
        ys = (np.arange(h) + y0) % self.c.shape[0]
        xs = (np.arange(w) + x0) % self.c.shape[1]
        idx = np.ix_(ys, xs)
        sub = self.c[idx]
        self.c[idx] = sub + (valor - sub) * alfa

    def leer(self, x, y):
        return self.c[int(y) % self.c.shape[0], int(x) % self.c.shape[1]]


def pincelada(lienzo, rng, cx, cy, ang, largo, ancho, valor, seca=0.35, curva=0.12):
    """Una pincelada de pincel redondo: cabeza redonda, cola que se adelgaza, cerdas
    que se acaban cada una a su largo (pincel seco) y el trazo un poco curvo."""
    r = int(largo / 2 + ancho + 3)
    x0, y0 = int(cx) - r, int(cy) - r
    ys, xs = np.mgrid[0:2 * r + 1, 0:2 * r + 1].astype(np.float32)
    dx = xs + x0 - cx
    dy = ys + y0 - cy
    ca, sa = math.cos(ang), math.sin(ang)
    u = dx * ca + dy * sa
    v = -dx * sa + dy * ca
    t = u / largo + 0.5
    v = v - curva * rng.uniform(-1, 1) * largo * (1 - (2 * t - 1) ** 2)
    # Perfil: cabeza redonda y cola que se adelgaza.
    cabeza = 0.16
    perfil = np.sqrt(np.clip(1 - ((cabeza - np.clip(t, 0, cabeza)) / cabeza) ** 2, 0, 1))
    perfil *= 1 - 0.55 * np.clip((t - 0.45) / 0.55, 0, 1) ** 1.5
    medio = ancho / 2 * perfil
    s = np.clip(v / np.maximum(medio, 1e-3), -1, 1)
    # Cerdas: cada una se seca a su largo; las de las orillas antes.
    nb = int(np.clip(ancho / 3, 4, 28))
    k = np.clip(((s + 1) / 2 * nb).astype(np.int32), 0, nb - 1)
    orilla = np.abs(np.linspace(-1, 1, nb))
    fin = 1 - seca * (rng.uniform(0, 1, nb) ** 1.5 + 0.6 * orilla ** 2)
    fin = np.clip(fin, 0.25, 1.0)
    inicio = rng.uniform(0, 0.06, nb) * (orilla > 0.5)
    hueco = rng.uniform(0, 1, nb) < 0.12 * seca
    # Orilla difuminada según el grosor (Oscar: con un poco de blur, que no se vean duros).
    blur = max(1.0, ancho * BLUR_TRAZO)
    a_ancho = np.clip((medio - np.abs(v)) / blur + 0.5, 0, 1)
    a_largo = np.clip((fin[k] - t) * largo / blur + 0.5, 0, 1) * np.clip((t - inicio[k]) * largo / blur + 0.5, 0, 1)
    alfa = a_ancho * a_largo
    alfa[hueco[k] & (t > 0.3)] = 0
    lienzo.componer(x0, y0, alfa, valor)


def piedrita(lienzo, rng, cx, cy, radio, cuerpo):
    """Piedra plana pintada, como las del camino de la referencia: cuerpo de un
    tono, una sombra fina abajo y un filo de luz arriba."""
    r = int(radio * 1.8 + 3)
    x0, y0 = int(cx) - r, int(cy) - r
    ys, xs = np.mgrid[0:2 * r + 1, 0:2 * r + 1].astype(np.float32)
    dx = xs + x0 - cx
    dy = ys + y0 - cy
    giro = rng.uniform(-0.5, 0.5)
    dx, dy = dx * math.cos(giro) + dy * math.sin(giro), -dx * math.sin(giro) + dy * math.cos(giro)
    th = np.arctan2(dy, dx)
    forma = np.ones_like(th)
    for armonico in (2, 3, 4):
        forma += rng.uniform(0.03, 0.12) / armonico * 2 * np.cos(armonico * th + rng.uniform(0, 6.3))
    aplasta = rng.uniform(0.55, 0.8)
    d = np.sqrt(dx * dx + (dy / aplasta) ** 2) / (radio * forma)
    blur = max(1.0, radio * BLUR_TRAZO)
    dentro = np.clip((1 - d) * radio / blur + 0.5, 0, 1)
    # Sombra: la misma forma corrida hacia abajo (las filas crecen hacia abajo).
    ds = np.sqrt(dx * dx + ((dy - radio * 0.16) / aplasta) ** 2) / (radio * forma * 1.03)
    sombra = np.clip((1 - ds) * radio / blur + 0.5, 0, 1)
    lienzo.componer(x0, y0, sombra, PALETA[max(cuerpo - 1, 0)])
    lienzo.componer(x0, y0, dentro, PALETA[cuerpo])
    # Filo de luz: lo de arriba que no tapa la forma corrida hacia arriba.
    dl = np.sqrt(dx * dx + ((dy + radio * 0.2) / aplasta) ** 2) / (radio * forma * 0.97)
    luz = dentro * np.clip((dl - 1) * radio / blur + 0.5, 0, 1)
    lienzo.componer(x0, y0, luz, PALETA[min(cuerpo + 1, 4)])


def pintar(semilla=7):
    rng = np.random.default_rng(semilla)
    # Plan de valores: manchas grandes torcidas, con una capa media encima.
    grande = ruido_periodico(rng, 150)
    media = ruido_periodico(rng, 45)
    fina = ruido_periodico(rng, 14)
    wx = ruido_periodico(rng, 110) * 70
    wy = ruido_periodico(rng, 110) * 70
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    plan = muestrear(grande, xx + wx, yy + wy) + 0.45 * muestrear(media, xx - wy * 0.6, yy + wx * 0.6)
    del xx, yy
    # Casi todo es el tono medio, con algunas manchas apenas más oscuras. Sin
    # manchas claras grandes (Oscar: "sigo viendo unos claros que no me gustan"):
    # lo claro queda en toques chicos y en el filo de las piedras.
    nivel = cuantiles(plan, [0.03, 0.27, 0.70, 0.0, 0.0])
    # Distancia a la orilla de las manchas (en unidades del plan): ahí se trabaja.
    cortes = np.quantile(plan, [0.30, 1.0])
    orilla = np.minimum(np.abs(plan - cortes[0]), np.abs(plan - cortes[1]))
    flujo = ruido_periodico(rng, 300)
    lienzo = Lienzo(PALETA[2])

    def angulo(x, y, extra=0.4):
        # Toques en varias direcciones, con un rumbo que cambia despacio por el
        # piso: acostados y largos se leían como agua.
        return 0.1 + 0.7 * flujo[int(y) % S, int(x) % S] + rng.normal(0, extra)

    def nivel_en(x, y):
        return int(nivel[int(y) % S, int(x) % S])

    def cerca_de_orilla(x, y, ancho):
        return orilla[int(y) % S, int(x) % S] < ancho

    area = S * S
    # 1) Manchas con pinceladas grandes: la orilla de cada mancha sale de pincel.
    for _ in range(int(2.4 * area / (210 * 100))):
        x, y = rng.uniform(0, S, 2)
        pincelada(lienzo, rng, x, y, angulo(x, y, 0.5), rng.uniform(130, 290), rng.uniform(75, 135),
                  PALETA[nivel_en(x, y)], seca=0.22, curva=0.1)
    # 2) Pinceladas medias, casi todas en las orillas: mezclan un tono con el vecino.
    puestas, meta = 0, int(0.6 * area / (80 * 28))
    while puestas < meta:
        x, y = rng.uniform(0, S, 2)
        if not cerca_de_orilla(x, y, 0.22) and rng.uniform() > 0.12:
            continue
        i = nivel_en(x, y)
        vecino = 1 if i == 2 else 2
        if rng.uniform() < 0.5:
            vecino = i
        pincelada(lienzo, rng, x, y, angulo(x, y), rng.uniform(40, 120), rng.uniform(18, 38),
                  PALETA[int(np.clip(vecino, 0, 4))], seca=0.5)
        puestas += 1
    # 3) Toques chicos y sueltos de luz y de sombra, pocos.
    for _ in range(int(0.08 * area / (36 * 10))):
        x, y = rng.uniform(0, S, 2)
        actual = int(np.argmin(np.abs(PALETA - lienzo.leer(x, y))))
        i = int(np.clip(actual + (1 if rng.uniform() < 0.3 else -1), 0, 3))
        pincelada(lienzo, rng, x, y, angulo(x, y, 0.3), rng.uniform(18, 55), rng.uniform(6, 13),
                  PALETA[i], seca=0.65, curva=0.18)
    # 4) Piedras planas, pocas y en grupitos.
    puestas = 0
    while puestas < 150:
        x, y = rng.uniform(0, S, 2)
        if media[int(y) % S, int(x) % S] < 0.8 and rng.uniform() > 0.05:
            continue
        radio = rng.uniform(5, 13) if rng.uniform() < 0.8 else rng.uniform(13, 24)
        piedrita(lienzo, rng, x, y, radio, int(rng.choice((1, 2, 3), p=(0.3, 0.4, 0.3))))
        puestas += 1
    # 5) Motitas.
    for _ in range(260):
        x, y = rng.uniform(0, S, 2)
        i = int(rng.choice((1, 3), p=(0.6, 0.4)))
        pincelada(lienzo, rng, x, y, rng.uniform(0, 6.3), rng.uniform(3, 7), rng.uniform(2.5, 5),
                  PALETA[i], seca=0.0, curva=0.0)

    return np.clip(difuminar(lienzo.c, BLUR_FINAL), 0, 1)


def guardar(img, ruta):
    """PNG o WebP según la extensión (el WebP del sitio, con pérdida y calidad 90)."""
    from PIL import Image
    im = Image.fromarray(np.round(img * 255).astype(np.uint8), 'L')
    if ruta.lower().endswith('.webp'):
        im.convert('RGB').save(ruta, quality=90, method=6)
    else:
        im.save(ruta)


def en_blender(img, nombre='PisoTierra'):
    import bpy
    im = bpy.data.images.get(nombre) or bpy.data.images.new(nombre, S, S, alpha=False)
    if tuple(im.size) != (S, S):
        im.scale(S, S)
    rgba = np.ones((S, S, 4), dtype=np.float32)
    rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = img
    im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(rgba[::-1].ravel())
    im.update()
    return im


if __name__ == '__main__':
    args = [a for a in sys.argv[sys.argv.index('--') + 1:]] if '--' in sys.argv else sys.argv[1:]
    ruta = args[0] if args else 'piso-tierra.png'
    semilla = int(args[1]) if len(args) > 1 else 7
    resultado = pintar(semilla)
    guardar(resultado, ruta)
    print('listo', ruta)
