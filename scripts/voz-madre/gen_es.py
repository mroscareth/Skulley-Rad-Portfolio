"""La voz de M.A.D.R.E. en español: Chatterbox Multilingual (MIT).

El acento sale de la referencia (ref-mx.mp3): unas líneas dichas por la voz
mexicana "claude" de Piper (Apache 2.0). Chatterbox pone la naturalidad y la
referencia el acento de México; con una referencia en inglés sonaba a español
gringo (Oscar, 2026-11-11). Chatterbox cambia de toma a toma, así que por
pedazo se generan TOMAS tomas y se queda la que Whisper transcribe más
parecida al texto (sin palabras de más, que es como se notan sus fallas). Las
líneas que van por pedazos (TROZOS en lineas.py) se estiran con ffmpeg y se
unen con sus silencios. Con números (gen_es.py 1 7) solo se rehacen esas
líneas.

Entorno (Python 3.11 y PyTorch con CUDA), una vez:
    uv venv chatter-env --python 3.11
    uv pip install --python chatter-env torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
    uv pip install --python chatter-env chatterbox-tts "setuptools<81" accelerate soundfile
Correr desde la raíz del repo (necesita node y ffmpeg en el PATH):
    chatter-env/Scripts/python scripts/voz-madre/gen_es.py
"""
import glob
import os
import re
import sys
import unicodedata

import numpy as np
import soundfile as sf
import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from transformers import pipeline

from lineas import SALIDA, a_mp3, con_eco, estirar, lineas, trozos, unir

AQUI = os.path.dirname(os.path.abspath(__file__))
REFERENCIA = os.path.join(AQUI, 'ref-mx.mp3')
CARPETA = os.path.join(SALIDA, 'chatter-mx')
TOMAS = 4
HABLADO = {'M.A.D.R.E.': 'Madre', 'la IA': 'la I-A'}
# Cómo puede escribir Whisper lo que no es español (para no castigar la toma).
IGUALES = {'scully': 'skulley', 'skully': 'skulley', 'skully': 'skulley', 'escali': 'skulley', 'aah': 'ah', 'aaah': 'ah', 'ahh': 'ah', 'datacenter': 'data'}


def palabras(t):
    t = t.lower().replace('m.a.d.r.e.', 'madre')
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    salida = []
    for w in re.sub(r"[^a-z0-9' ]+", ' ', t).split():
        w = IGUALES.get(w, w)
        # "IA" la transcribe de mil formas: se compara sin ella.
        if w not in ('ia', 'i', 'a'):
            salida.append(w)
    return salida


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
textos = lineas('es')
# Sin audios viejos de más (si el guion se acortó).
for viejo in glob.glob(os.path.join(CARPETA, 'es-*.mp3')):
    if int(os.path.basename(viejo)[3:5]) > len(textos):
        os.remove(viejo)


def tramos_con_voz(audio, sr):
    # Tramos con voz (ventanas de 10 ms a menos de 30 dB de la más fuerte),
    # juntando huecos de menos de 120 ms: [inicio, fin, pico en dB].
    w = int(sr * 0.01)
    n = len(audio) // w
    e = np.sqrt(np.mean(audio[:n * w].reshape(n, w) ** 2, axis=1)) + 1e-9
    db = 20 * np.log10(e / e.max())
    tramos = []
    for k in np.flatnonzero(db > -30):
        t = k * w / sr
        if tramos and t - tramos[-1][1] < 0.12:
            tramos[-1][1] = t + w / sr
            tramos[-1][2] = max(tramos[-1][2], db[k])
        else:
            tramos.append([t, t + w / sr, db[k]])
    return tramos


def ruido(tramo, hueco):
    # Separado por un silencio y corto (un "ah", un golpe) o bajito (un murmullo).
    return hueco > 0.15 and (tramo[1] - tramo[0] < 0.45 or tramo[2] < -14)


def limpiar(audio, sr):
    """Chatterbox a veces suelta un "ah" o un golpe de voz después de acabar la
    frase (o antes de empezarla), separado por un silencio: se corta. Regresa
    el audio y cuántos tramos sueltos así quedan por dentro, que castigan la
    toma (Whisper no los ve: tira las muletillas)."""
    t = tramos_con_voz(audio, sr)
    if not t:
        return audio, 0
    while len(t) > 1 and ruido(t[-1], t[-1][0] - t[-2][1]):
        t.pop()
    while len(t) > 1 and ruido(t[0], t[1][0] - t[0][1]):
        t.pop(0)
    sueltos = sum(1 for k in range(1, len(t) - 1)
                  if t[k][1] - t[k][0] < 0.2 and t[k][0] - t[k - 1][1] > 0.2 and t[k + 1][0] - t[k][1] > 0.2)
    a = int(max(0.0, t[0][0] - 0.05) * sr)
    b = int(min(len(audio) / sr, t[-1][1] + 0.12) * sr)
    salida = audio[a:b].copy()
    fade = min(len(salida), int(sr * 0.03))
    salida[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    return salida, sueltos


def mejor_toma(texto, lento):
    dicho = texto
    for a, b in HABLADO.items():
        dicho = dicho.replace(a, b)
    esperado = palabras(texto)
    mejor = None
    for semilla in range(1, TOMAS + 1):
        torch.manual_seed(semilla)
        # Para lo que va lento, menos cfg: Chatterbox habla más pausado.
        audio = modelo.generate(dicho, language_id='es', audio_prompt_path=REFERENCIA,
                                exaggeration=0.5, cfg_weight=0.3 if lento else 0.5, temperature=0.7)
        audio, sueltos = limpiar(audio.squeeze().numpy().astype(np.float32), modelo.sr)
        a16 = ta.functional.resample(torch.from_numpy(audio), modelo.sr, 16000).numpy()
        oido = asr({'raw': a16, 'sampling_rate': 16000}, generate_kwargs={'language': 'spanish', 'task': 'transcribe'})['text']
        # M.A.D.R.E. no exclama: si Whisper le pone "¡!", la toma sonó entusiasta.
        e = distancia(esperado, palabras(oido)) + sueltos + ('!' in oido)
        if mejor is None or e < mejor[0]:
            mejor = (e, audio, oido)
        if e == 0:
            break
    return mejor


SOLO = {int(a) for a in sys.argv[1:]}
for i, texto in enumerate(textos):
    if SOLO and i + 1 not in SOLO:
        continue
    partes = []
    informe = []
    for pedazo, velocidad, silencio, eco in trozos('es', i, texto):
        e, audio, oido = mejor_toma(pedazo, velocidad < 1)
        audio = estirar(audio, modelo.sr, velocidad)
        partes.append((con_eco(audio, modelo.sr) if eco else audio, silencio))
        informe.append(f'{e} errores "{oido.strip()}"')
    wav = os.path.join(CARPETA, f'es-{i + 1:02d}.wav')
    sf.write(wav, unir(partes, modelo.sr), modelo.sr)
    a_mp3(wav, wav[:-4] + '.mp3')
    print(f'es {i + 1}: ' + ' | '.join(informe), flush=True)
