"""La voz de M.A.D.R.E. en español: Chatterbox Multilingual (MIT).

El acento sale de la referencia (ref-mx.mp3): unas líneas dichas por la voz
mexicana "claude" de Piper (Apache 2.0). Chatterbox pone la naturalidad y la
referencia el acento de México; con una referencia en inglés sonaba a español
gringo (Oscar, 2026-11-11). Chatterbox cambia de toma a toma, así que por
línea se generan TOMAS tomas y se queda la que Whisper transcribe más
parecida al texto (sin palabras de más, que es como se notan sus fallas).

Entorno (Python 3.11 y PyTorch con CUDA), una vez:
    uv venv chatter-env --python 3.11
    uv pip install --python chatter-env torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
    uv pip install --python chatter-env chatterbox-tts "setuptools<81" accelerate
Correr desde la raíz del repo (necesita node y ffmpeg en el PATH):
    chatter-env/Scripts/python scripts/voz-madre/gen_es.py
"""
import os
import re
import unicodedata

import numpy as np
import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from transformers import pipeline

from lineas import SALIDA, a_mp3, lineas

AQUI = os.path.dirname(os.path.abspath(__file__))
REFERENCIA = os.path.join(AQUI, 'ref-mx.mp3')
CARPETA = os.path.join(SALIDA, 'chatter-mx')
TOMAS = 4
HABLADO = {'M.A.D.R.E.': 'Madre', 'la IA': 'la I-A'}


def palabras(t):
    t = t.lower().replace('m.a.d.r.e.', 'madre')
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    # "IA" la transcribe de mil formas: se compara sin ella.
    return [w for w in re.sub(r"[^a-z0-9' ]+", ' ', t).split() if w not in ('ia', 'i', 'a')]


def distancia(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = cur
    return d[len(b)]


modelo = ChatterboxMultilingualTTS.from_pretrained(device='cuda' if torch.cuda.is_available() else 'cpu')
asr = pipeline('automatic-speech-recognition', model='openai/whisper-small', device=modelo.device)
os.makedirs(CARPETA, exist_ok=True)

for i, texto in enumerate(lineas('es'), 1):
    dicho = texto
    for a, b in HABLADO.items():
        dicho = dicho.replace(a, b)
    esperado = palabras(texto)
    mejor = None
    for semilla in range(1, TOMAS + 1):
        torch.manual_seed(semilla)
        audio = modelo.generate(dicho, language_id='es', audio_prompt_path=REFERENCIA, exaggeration=0.5, cfg_weight=0.5, temperature=0.7)
        a16 = ta.functional.resample(audio, modelo.sr, 16000).squeeze().numpy().astype(np.float32)
        oido = asr({'raw': a16, 'sampling_rate': 16000}, generate_kwargs={'language': 'spanish', 'task': 'transcribe'})['text']
        e = distancia(esperado, palabras(oido))
        if mejor is None or e < mejor[0]:
            mejor = (e, audio, oido)
        if e == 0:
            break
    wav = os.path.join(CARPETA, f'es-{i:02d}.wav')
    ta.save(wav, mejor[1], modelo.sr)
    a_mp3(wav, wav[:-4] + '.mp3')
    print(f'es {i}: {mejor[0]} errores, "{mejor[2].strip()}"', flush=True)
