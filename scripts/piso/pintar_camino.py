"""La tira de lozas del camino escondido (Oscar, 2026-11-19): del portal de Work
al de SKULLEYGLYPH, con tramos que tapa la tierra. El sitio la dobla a lo largo
de la curva del camino (src/lib/pisoPintado.js); aquí solo se pinta la tira, que
cierra de arriba a abajo (se repite a lo largo) y se deshace hacia los lados.

Mismas lozas que las del centro (pintar_piedras.py: lados rectos, bisel, junta de
grueso variable, grietas), a la misma escala, pero más chicas para un camino de
hasta unas 5.5 unidades de ancho. Gris = valor, alfa = dónde hay loza o junta.

    python scripts/piso/pintar_camino.py public/textures/piso-camino.webp [semilla]
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pintar_piedras import E, JUNTA, guardar, pintar_lozas  # noqa: E402
from pintar_tierra import ruido_periodico  # noqa: E402

# Pixeles por unidad del mundo: los mismos que la mancha del centro.
PX = 2048 / 26
ANCHO, LARGO = 560, 2520            # pixeles; ~7.1 × 32 unidades
# Medio ancho con lozas, en pixeles (~2.8 unidades). Cuánto se ve en cada tramo lo
# decide el sitio (Oscar: que el ancho no sea regular), sin estirar las lozas.
MEDIO = 220
# (intentos, radio mínimo, radio máximo) en pixeles.
TAMANOS = ((260, 50, 72), (900, 30, 46))
SEPARA = 0.72


def pintar(semilla=5):
    rng = np.random.default_rng(semilla)
    junta = max(JUNTA * E, 3.0)
    semillas = []
    for intentos, rmin, rmax in TAMANOS:
        for _ in range(intentos):
            rad = rng.uniform(rmin, rmax)
            x = ANCHO / 2 + rng.normal(0, MEDIO * 0.65)
            y = rng.uniform(0, LARGO)
            lado = abs(x - ANCHO / 2)
            # Hacia los lados se van perdiendo.
            if lado > MEDIO * 1.25 or rng.uniform() > np.clip((MEDIO * 1.2 - lado) / (MEDIO * 0.5), 0, 1):
                continue
            if any(math.hypot(x - q[0], min(abs(y - q[1]), LARGO - abs(y - q[1]))) < (rad + q[2]) * SEPARA + junta
                   for q in semillas):
                continue
            semillas.append((x, y, rad, rng.uniform(-0.035, 0.035)))

    gris, alfa = pintar_lozas(rng, semillas, (LARGO, ANCHO), junta, envolver_y=True)
    # La orilla del camino: un medio ancho que cambia a lo largo y un ruido que la
    # rompe, para que se deshaga en lozas sueltas y no en una línea.
    # (Los tramos que tapa la tierra los pone el sitio; aquí la tira es continua.)
    medio = MEDIO * (1 + 0.06 * ruido_periodico(rng, 60, forma=(LARGO, ANCHO))[:, :1])
    xx = np.arange(ANCHO, dtype=np.float32)[None, :]
    llega = (medio - np.abs(xx - ANCHO / 2)) / (MEDIO * 0.3) + ruido_periodico(rng, 18, forma=(LARGO, ANCHO)) * 0.22
    llega = np.clip(llega, 0, 1)
    alfa = alfa * llega * llega * (3 - 2 * llega)
    return gris, alfa, len(semillas)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ruta = args[0] if args else 'piso-camino.png'
    semilla = int(args[1]) if len(args) > 1 else 5
    gris, alfa, n = pintar(semilla)
    guardar(gris, alfa, ruta)
    print('listo', ruta, n, 'lozas', f'{ANCHO / PX:.3f} x {LARGO / PX:.3f} unidades')
