"""Pétalos de cempasúchil pintados a mano para el camino escondido del home (2026-11-22).

Un atlas de 4 x 4 celdas: doce pétalos sueltos (abanicos con la orilla rizada,
angostos en la base, con pliegues que salen de ella), dos pétalos doblados, uno
encimado sobre otro y una flor entera vista desde arriba. Es una imagen en grises
con alfa: 0.5 es el naranja del pétalo, abajo oscurece hacia un rojo quemado y
arriba aclara (el color lo pone el sitio, src/components/home/PetalosCamino.jsx).

    chatter-env/Scripts/python scripts/petalos/pintar_petalos.py public/textures/petalos-camino.webp [semilla]
"""
import math
import sys

import numpy as np

CELDA = 256
ATLAS = 4
S = CELDA * ATLAS


def ruido(rng, forma, sigma):
    """Ruido suave, media 0, desviación 1."""
    h, w = forma
    fx, fy = np.meshgrid(np.fft.fftfreq(w).astype(np.float32), np.fft.fftfreq(h).astype(np.float32))
    filtro = np.exp(-((fx * fx * sigma[0] ** 2 + fy * fy * sigma[1] ** 2) * (2 * math.pi) ** 2) / 2)
    out = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((h, w)).astype(np.float32)) * filtro))
    return ((out - out.mean()) / (out.std() + 1e-6)).astype(np.float32)


def difuminar(img, sigma):
    h, w = img.shape
    fx, fy = np.meshgrid(np.fft.fftfreq(w).astype(np.float32), np.fft.fftfreq(h).astype(np.float32))
    filtro = np.exp(-((fx * fx + fy * fy) * (2 * math.pi * sigma) ** 2) / 2)
    return np.real(np.fft.ifft2(np.fft.fft2(img) * filtro)).astype(np.float32)


def rejilla():
    c = np.arange(CELDA, dtype=np.float32) + 0.5
    return np.meshgrid(c, c)


def petalo(rng, valor, alfa, base, ang, largo, abre, doblado=0.0, atras=0.0):
    """Un pétalo de cempasúchil: un abanico desde `base` (x, y en pixeles) hacia
    `ang` (radianes, 0 = arriba), de `largo` pixeles y medio ángulo `abre`.
    La orilla de afuera va rizada en lóbulos y los pliegues salen de la base.
    `doblado` (0 a 1) dobla una mitad debajo de la otra: más angosto y en sombra."""
    X, Y = rejilla()
    dx = X - base[0]
    dy = base[1] - Y
    # Eje del pétalo hacia `ang`.
    ca, sa = math.cos(ang), math.sin(ang)
    lx = dx * ca - dy * sa
    ly = dx * sa + dy * ca
    r = np.hypot(lx, ly) / largo
    th = np.arctan2(lx, ly)
    u = th / abre
    # Doblado: una mitad se esconde debajo de la otra.
    lim_izq = -1.0 + doblado * 0.85
    # Lóbulos de la orilla (de 4 a 7), con el centro un poco más largo.
    lobulos = rng.integers(4, 8)
    fase = rng.random()
    t_lob = (u - lim_izq) / (1 - lim_izq) * lobulos + fase
    muesca = np.sin(np.pi * t_lob) ** 2
    borde = (1 - 0.42 * np.abs(u) ** 2.4) * (1 - 0.1 * muesca) * (1 + 0.018 * ruido(rng, (CELDA, CELDA), (16, 16)))
    # Lados derechos con su orilla de un pixel (medida en pixeles, no en ángulo).
    d_lado = np.minimum(u - lim_izq, 1 - u) * abre * r * largo
    lado = np.clip(d_lado / 1.2 + 0.5, 0, 1)
    dentro_r = np.clip((borde - r) * largo / 1.2 + 0.5, 0, 1)
    base_suave = np.clip(r * largo / 3, 0, 1)
    a = (dentro_r * lado * base_suave).astype(np.float32)
    a *= (r < 1.3)

    # Valor: la base en sombra, el cuerpo en el naranja y las crestas del rizo claras.
    v = -0.55 * np.clip(1 - r * 1.6, 0, 1) ** 1.5
    # Pliegues que salen de la base: crestas claras y valles oscuros que siguen a los lóbulos.
    pliegue = np.sin(np.pi * t_lob * 2 + 0.6 * ruido(rng, (CELDA, CELDA), (10, 10)))
    v += 0.16 * pliegue * np.clip(r * 1.4, 0, 1)
    # La orilla rizada: el filo de cada lóbulo atrapa la luz, la muesca se hunde.
    filo = np.clip(1 - (borde - r) * 6, 0, 1)
    v += filo * (0.42 * (1 - muesca) - 0.3 * muesca)
    # Una mitad un poco más clara: el pétalo se curva.
    v += 0.12 * np.clip(u * 2, -1, 1)
    if doblado > 0:
        # La mitad doblada se va a la sombra junto al doblez.
        v -= 0.35 * doblado * np.clip(1 - (u - lim_izq) * 3, 0, 1)
    # Trazos de pincel a lo largo.
    v += 0.06 * ruido(rng, (CELDA, CELDA), (3, 3))
    v -= 0.3 * atras
    v = np.clip(v, -1, 1).astype(np.float32)
    valor[:] = valor + (v - valor) * a
    alfa[:] = np.maximum(alfa, a)


def flor(rng, valor, alfa):
    """Una flor entera vista desde arriba: anillos de pétalos rizados que se
    enciman, de afuera (abajo) hacia el centro (encima)."""
    X, Y = rejilla()
    cx = cy = CELDA / 2
    dx, dy = X - cx, Y - cy
    r = np.hypot(dx, dy)
    th = np.arctan2(dy, dx)
    R0 = CELDA * 0.41
    anillos = 6
    for k in range(anillos):
        Rk = R0 * (1 - k / (anillos + 0.6))
        n = 9 + 4 * k
        fase = rng.random() * 2 * math.pi
        t = th * n / (2 * math.pi) + fase
        f = t - np.floor(t)
        # Cada lóbulo es un festón redondo, con algo de azar por lóbulo.
        azar = 1 + 0.08 * np.sin(np.floor(t) * 12.9898 + k * 78.233)
        Rth = Rk * azar * (1 - 0.13 * (2 * f - 1) ** 2) * (1 + 0.035 * ruido(rng, (CELDA, CELDA), (5, 5)))
        a = np.clip((Rth - r) / 1.3, 0, 1).astype(np.float32)
        rr = r / np.maximum(Rth, 1)
        # Claro en el filo de cada festón, sombra en el pliegue entre festones y
        # hacia adentro, donde lo tapa el anillo siguiente.
        v = -0.5 + 0.95 * np.clip(rr, 0, 1) ** 2.2
        v -= 0.28 * np.abs(2 * f - 1) ** 3
        v += 0.12 * np.sin(np.pi * 2 * t) * rr
        v += 0.06 * ruido(rng, (CELDA, CELDA), (3, 3))
        # Los anillos de afuera, un poco más oscuros (quedan abajo).
        v -= 0.12 * (1 - k / anillos)
        v = np.clip(v, -1, 1).astype(np.float32)
        valor[:] = valor + (v - valor) * a
        alfa[:] = np.maximum(alfa, a)
    # El centro, apretado y en sombra.
    a = np.clip((CELDA * 0.07 - r) / 1.5, 0, 1).astype(np.float32)
    v = -0.35 + 0.1 * ruido(rng, (CELDA, CELDA), (2, 2))
    valor[:] = valor + (v - valor) * a


def celda(rng, i):
    valor = np.zeros((CELDA, CELDA), np.float32)
    alfa = np.zeros((CELDA, CELDA), np.float32)
    if i == 15:
        flor(rng, valor, alfa)
    elif i == 14:
        # Uno encima del otro, cruzados.
        petalo(rng, valor, alfa, (CELDA * 0.44, CELDA * 0.84), -0.35, CELDA * 0.6, 0.6, atras=0.25)
        petalo(rng, valor, alfa, (CELDA * 0.58, CELDA * 0.8), 0.45, CELDA * 0.56, 0.55)
    else:
        largo = CELDA * (0.68 + 0.12 * rng.random())
        abre = 0.55 + 0.25 * rng.random()
        doblado = 0.55 + 0.25 * rng.random() if i in (12, 13) else 0.0
        petalo(rng, valor, alfa, (CELDA * 0.5, CELDA * (0.5 + largo / CELDA * 0.48)), (rng.random() - 0.5) * 0.3, largo, abre, doblado)
    # Pinceladas suaves: un poco de blur por dentro, sin halo de lo vacío.
    pre = difuminar(valor * alfa, 0.9)
    den = difuminar(alfa, 0.9)
    valor = np.where(den > 1e-3, pre / np.maximum(den, 1e-3), valor)
    return np.clip(valor, -1, 1), alfa


def pintar(semilla=11):
    rng = np.random.default_rng(semilla)
    valor = np.zeros((S, S), np.float32)
    alfa = np.zeros((S, S), np.float32)
    for j in range(ATLAS):
        for i in range(ATLAS):
            v, a = celda(rng, j * ATLAS + i)
            valor[j * CELDA:(j + 1) * CELDA, i * CELDA:(i + 1) * CELDA] = v
            alfa[j * CELDA:(j + 1) * CELDA, i * CELDA:(i + 1) * CELDA] = a
    return valor, alfa


def guardar(ruta, valor, alfa):
    from PIL import Image
    v8 = (np.clip(0.5 + 0.5 * valor, 0, 1) * 255 + 0.5).astype(np.uint8)
    a8 = (np.clip(alfa, 0, 1) * 255 + 0.5).astype(np.uint8)
    img = Image.fromarray(np.dstack([v8, v8, v8, a8]), 'RGBA')
    if ruta.lower().endswith('.webp'):
        img.save(ruta, 'WEBP', quality=90, alpha_quality=90, method=6)
    else:
        img.save(ruta)


if __name__ == '__main__':
    ruta = sys.argv[1] if len(sys.argv) > 1 else 'petalos-camino.png'
    semilla = int(sys.argv[2]) if len(sys.argv) > 2 else 11
    v, a = pintar(semilla)
    guardar(ruta, v, a)
    print(ruta, v.shape)
