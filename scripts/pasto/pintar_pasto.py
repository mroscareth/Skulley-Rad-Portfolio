"""Matas de pasto pintadas a mano para el home (Oscar, 2026-11-19).

Un atlas de 2 x 2 matas, cada una de 3 a 7 hojas largas y afiladas como las de
su referencia: anchas abajo, punta filosa, orilla aserrada, una mitad de la hoja
más clara que la otra y trazos a lo largo. Es una imagen en grises con alfa: el
gris es el valor (0 = el color del piso, 1 = lo más claro que pinta el sitio) y
el alfa dice dónde hay hoja (el gris 0.2 es el piso: abajo oscurece, arriba aclara). El color lo pone el sitio (src/lib/pastoPintado.js),
así sale del color del piso de noche o de día.

    python scripts/pasto/pintar_pasto.py public/textures/pasto-matas.webp [semilla]
"""
import math
import sys

import numpy as np

CELDA = 512
# Gris guardado que es el color del piso: abajo oscurece, arriba aclara.
PISO = 0.2
ATLAS = 2  # matas por lado
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


def hoja(rng, valor, alfa, bx, alto, ancho, lean, atras):
    """Pinta una hoja sobre la celda (valor y alfa, compuestas encima).
    bx: x de la base; alto y ancho en pixeles; lean: cuánto se va la punta de lado
    (fracción del alto); atras: 0 al frente, 1 hasta atrás (más apagada)."""
    n = valor.shape[0]
    base_y = n - 6
    ys = np.arange(n, dtype=np.float32)
    xs = np.arange(n, dtype=np.float32)
    X, Y = np.meshgrid(xs, ys)
    t = (base_y - Y) / alto  # 0 en la base, 1 en la punta
    curva = 1.4 + rng.random() * 0.8
    centro = bx + lean * alto * np.clip(t, 0, 1) ** curva
    # Ancha casi hasta la mitad y se afila a una punta filosa; abajo se angosta un poco.
    tt = np.clip(t, 0, 1)
    medio = ancho * 0.5 * (1 - tt ** 1.7) ** 1.1 * (0.78 + 0.22 * np.clip(tt / 0.12, 0, 1))
    # Orilla aserrada: dientes chicos que muerden hacia adentro, proporcionales al ancho.
    dientes = np.abs(ruido(rng, (n, 1), (1, 2.2))[:, 0][:, None])
    medio = medio * (1 - 0.07 * dientes * (0.5 + tt))
    s = (X - centro) / np.maximum(medio, 0.5)
    dentro = (t >= 0) & (t <= 1) & (np.abs(s) < 1)
    # Antialias de un pixel en la orilla.
    orilla = np.clip((medio - np.abs(X - centro)) / 1.2, 0, 1)
    a = np.where((t >= 0) & (t <= 1), orilla, 0).astype(np.float32)
    # Abajo se corta con un poco de irregularidad (nace del piso).
    a *= np.clip((base_y + 3 - Y) / 3, 0, 1)

    # Valor relativo al piso: 0 es el color del piso, 1 lo más claro, -1 lo más
    # oscuro (el sitio oscurece poco: Oscar no quiere azules oscuros). La raíz va
    # en sombra (un poco más oscura que el piso, como sombra de contacto), el cuerpo
    # se separa del piso y la punta se aclara.
    v = -0.6 * (1 - tt) ** 2.2 + 0.6 * tt ** 1.1 + 0.12
    # Una mitad de la hoja más clara (el doblez del centro, como la referencia).
    lado = 1 if rng.random() < 0.5 else -1
    doblez = 0.05 * np.sin(t * 3 + rng.random() * 6)
    luz = np.clip((s * lado - doblez) * 6 + 0.5, 0, 1)
    v = v + 0.2 * luz * np.clip(tt * 3, 0, 1)
    # Trazos a lo largo de la hoja.
    trazos = ruido(rng, (n, n), (2.5, 40))
    v = v + 0.05 * trazos * (0.3 + tt)
    # La orilla del lado de la sombra se oscurece: separa las hojas encimadas.
    filo = np.clip(np.abs(s) * 5 - 4, 0, 1) * (1 - luz)
    v = v - 0.35 * atras
    v = v - (0.5 + v) * filo * 0.8
    v = np.clip(v, -1, 1).astype(np.float32)

    valor[:] = valor + (v - valor) * a
    alfa[:] = np.maximum(alfa, a)


def mata(rng, chicas=False):
    valor = np.zeros((CELDA, CELDA), np.float32)
    alfa = np.zeros((CELDA, CELDA), np.float32)
    cuantas = rng.integers(4, 7) if chicas else rng.integers(3, 6)
    hojas = []
    for i in range(cuantas):
        bx = CELDA * (0.3 + 0.4 * rng.random())
        if chicas:
            alto = CELDA * (0.4 + 0.35 * rng.random())
            ancho = CELDA * (0.12 + 0.05 * rng.random())
        else:
            alto = CELDA * (0.55 + 0.4 * rng.random())
            ancho = CELDA * (0.17 + 0.09 * rng.random())
        # Se abren hacia afuera, como abanico, con algo de azar.
        lean = (bx / CELDA - 0.5) * 0.9 + (rng.random() - 0.5) * 0.35
        hojas.append((rng.random(), bx, alto, ancho, lean))
    # Las de atrás primero (más apagadas), las de enfrente encima.
    hojas.sort(key=lambda h: -h[0])
    for atras, bx, alto, ancho, lean in hojas:
        # Que la punta no se salga de la celda.
        alto = min(alto, CELDA - 20)
        punta = bx + lean * alto
        if punta < 12:
            lean = (12 - bx) / alto
        if punta > CELDA - 12:
            lean = (CELDA - 12 - bx) / alto
        hoja(rng, valor, alfa, bx, alto, ancho, lean, atras * 0.8)
    # Pinceladas suaves: un poco de blur por dentro, sin halo oscuro de lo vacío.
    pre = difuminar(valor * alfa, 1.2)
    den = difuminar(alfa, 1.2)
    valor = np.where(den > 1e-3, pre / np.maximum(den, 1e-3), valor)
    return np.clip(valor, -1, 1), alfa


def pintar(semilla=3):
    rng = np.random.default_rng(semilla)
    valor = np.zeros((S, S), np.float32)
    alfa = np.zeros((S, S), np.float32)
    for j in range(ATLAS):
        for i in range(ATLAS):
            v, a = mata(rng, chicas=(i == ATLAS - 1 and j == ATLAS - 1))
            valor[j * CELDA:(j + 1) * CELDA, i * CELDA:(i + 1) * CELDA] = v
            alfa[j * CELDA:(j + 1) * CELDA, i * CELDA:(i + 1) * CELDA] = a
    return valor, alfa


def guardar(ruta, valor, alfa):
    from PIL import Image
    enc = np.where(valor >= 0, PISO + valor * (1 - PISO), PISO + valor * PISO)
    v8 = (np.clip(enc, 0, 1) * 255 + 0.5).astype(np.uint8)
    a8 = (np.clip(alfa, 0, 1) * 255 + 0.5).astype(np.uint8)
    rgba = np.dstack([v8, v8, v8, a8])
    img = Image.fromarray(rgba, 'RGBA')
    if ruta.lower().endswith('.webp'):
        img.save(ruta, 'WEBP', quality=90, alpha_quality=90, method=6)
    else:
        img.save(ruta)


if __name__ == '__main__':
    ruta = sys.argv[1] if len(sys.argv) > 1 else 'pasto-matas.png'
    semilla = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    v, a = pintar(semilla)
    guardar(ruta, v, a)
    print(ruta, v.shape)
