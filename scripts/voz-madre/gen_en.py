"""La voz de M.A.D.R.E. en inglés: Kokoro (Apache 2.0), voz af_heart.

Las líneas que van por pedazos (TROZOS en lineas.py) se dicen a su velocidad
y se unen con sus silencios. Con números (gen_en.py 1 7) solo se rehacen esas
líneas.

Entorno (Python 3.12; spaCy, que pide Kokoro, no compila en 3.14), una vez:
    uv venv kokoro-env --python 3.12
    uv pip install --python kokoro-env torch --index-url https://download.pytorch.org/whl/cpu
    uv pip install --python kokoro-env kokoro soundfile pip
Correr desde la raíz del repo (necesita node y ffmpeg en el PATH):
    kokoro-env/Scripts/python scripts/voz-madre/gen_en.py
"""
import glob
import os
import sys

import numpy as np
import soundfile as sf
from kokoro import KPipeline

from lineas import SALIDA, a_mp3, con_eco, lineas, trozos, unir

VOZ = 'af_heart'
SR = 24000
CARPETA = os.path.join(SALIDA, 'kokoro-heart')
# Se dicen como palabra, con los fonemas en línea de Kokoro (si no, M.A.D.R.E.
# lo deletrea o dice "mad-ree").
HABLADO = {
    'M.A.D.R.E.': '[Madre](/mˈɑdɹeɪ/)',
    'Skulley': '[Skulley](/skˈʌli/)',
}
# Un "Ah" suelto Kokoro lo vuelve otra palabra ("Zaywa"): esos pedazos se dicen
# dentro de una frase y se recorta su parte con el tiempo de cada palabra que da
# Kokoro. Así el "Ah" largo de la primera línea sale de Kokoro hablando lento,
# que sostiene la vocal (estirado con atempo sonaba falso), y el "forever" del
# eco se separa sin perder la entonación de la frase completa.
DICHO_EN = {
    'Ah,': 'Ah, yes.',
    'yes.': 'Ah, yes.',
    "I'll keep it in my data center": "I'll keep it in my data center forever.",
    'forever.': "I'll keep it in my data center forever.",
}
SOLO = {int(a) for a in sys.argv[1:]}


def recortar(audio, tokens, pedazo):
    objetivo = pedazo.replace(' ', '')
    for k in range(len(tokens)):
        dicho = ''
        for j in range(k, len(tokens)):
            dicho += tokens[j].text
            if dicho == objetivo:
                fin = int(tokens[j + 1].start_ts * SR) if j + 1 < len(tokens) else len(audio)
                return audio[int(tokens[k].start_ts * SR):fin]
            if not objetivo.startswith(dicho):
                break
    raise ValueError(f'"{pedazo}" no está en "{DICHO_EN[pedazo]}"')


def decir(pedazo, velocidad):
    dicho = DICHO_EN.get(pedazo, pedazo)
    for a, b in HABLADO.items():
        dicho = dicho.replace(a, b)
    rs = list(tub(dicho, voice=VOZ, speed=velocidad))
    audio = np.concatenate([np.asarray(r.audio) for r in rs])
    return recortar(audio, rs[0].tokens, pedazo) if pedazo in DICHO_EN else audio


tub = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')
os.makedirs(CARPETA, exist_ok=True)
textos = lineas('en')
# Sin audios viejos de más (si el guion se acortó).
for viejo in glob.glob(os.path.join(CARPETA, 'en-*.mp3')):
    if int(os.path.basename(viejo)[3:5]) > len(textos):
        os.remove(viejo)

for i, texto in enumerate(textos):
    if SOLO and i + 1 not in SOLO:
        continue
    partes = []
    for pedazo, velocidad, silencio, eco in trozos('en', i, texto):
        audio = decir(pedazo, velocidad)
        partes.append((con_eco(audio, SR) if eco else audio, silencio))
    wav = os.path.join(CARPETA, f'en-{i + 1:02d}.wav')
    sf.write(wav, unir(partes, SR), SR)
    a_mp3(wav, wav[:-4] + '.mp3')
    print('en', i + 1, flush=True)
