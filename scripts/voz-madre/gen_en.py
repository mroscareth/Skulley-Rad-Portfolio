"""La voz de M.A.D.R.E. en inglés: Kokoro (Apache 2.0), voz af_heart.

Entorno (Python 3.12; spaCy, que pide Kokoro, no compila en 3.14), una vez:
    uv venv kokoro-env --python 3.12
    uv pip install --python kokoro-env torch --index-url https://download.pytorch.org/whl/cpu
    uv pip install --python kokoro-env kokoro soundfile pip
Correr desde la raíz del repo (necesita node y ffmpeg en el PATH):
    kokoro-env/Scripts/python scripts/voz-madre/gen_en.py
"""
import os

import numpy as np
import soundfile as sf
from kokoro import KPipeline

from lineas import SALIDA, a_mp3, lineas

VOZ = 'af_heart'
CARPETA = os.path.join(SALIDA, 'kokoro-heart')
# M.A.D.R.E. se dice como palabra, con los fonemas en línea de Kokoro (si no,
# lo deletrea o dice "mad-ree").
HABLADO = {'M.A.D.R.E.': '[Madre](/mˈɑdɹeɪ/)', 'the AI': 'the A.I.'}

tub = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')
os.makedirs(CARPETA, exist_ok=True)
for i, texto in enumerate(lineas('en'), 1):
    for a, b in HABLADO.items():
        texto = texto.replace(a, b)
    audio = np.concatenate([np.asarray(a) for _, _, a in tub(texto, voice=VOZ, speed=1.0)])
    wav = os.path.join(CARPETA, f'en-{i:02d}.wav')
    sf.write(wav, audio, 24000)
    a_mp3(wav, wav[:-4] + '.mp3')
    print('en', i, flush=True)
