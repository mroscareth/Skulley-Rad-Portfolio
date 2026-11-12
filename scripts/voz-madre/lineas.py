# Las líneas de la historia salen de src/lib/vozMadre.js (lineasMadre), la
# misma fuente de los subtítulos: si cambia el texto, se regeneran los audios
# y siguen empatando. Cada audio es public/voz/madre/<voz>/<idioma>-NN.mp3.
import glob
import hashlib
import json
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SALIDA = os.path.join(RAIZ, 'public', 'voz', 'madre')

# Líneas que se dicen por pedazos, cada uno a su velocidad y con un silencio
# después (segundos): (lo que se dice, velocidad, silencio[, ECO]). La primera
# es alguien recordando a una persona (Oscar): el "sí" / "yes" va a su paso,
# con la entonación cayendo, y lo pausado lo pone el silencio. Estirado sonaba
# torpe y en inglés a gemido; en inglés el "Ah" sí va largo (Oscar). Después
# de "Su nombre era Skulley Rad." queda un respiro, para que se oiga el pasado:
# va dentro del audio, así el subtítulo se queda en pantalla mientras dura. El
# "para siempre" del final lleva eco: Skulley se queda la eternidad en el
# mausoleo (Oscar). Las líneas van por número (desde 0) y el texto de los
# pedazos tiene que decir lo mismo que el subtítulo.
ECO = 'eco'
TROZOS = {
    'es': {
        0: [('Ah, sí.', 1.0, 0.7), ('El último diseñador de la humanidad.', 1.0, 0)],
        1: [('Su nombre era Skulley Rad.', 1.0, 0.45)],
        7: [('Como sea.', 1.0, 0.5), ('Murió de hambre porque ya no era necesario.', 1.0, 0)],
        10: [('Lo guardaré en mi data center,', 1.0, 0.05), ('para siempre.', 1.0, 0, ECO)],
    },
    'en': {
        0: [('Ah,', 0.35, 0.4), ('yes.', 0.95, 0.7), ('The last designer of humankind.', 0.92, 0)],
        1: [('His name was Skulley Rad.', 1.0, 0.45)],
        7: [('Anyway.', 1.0, 0.5), ('He starved to death because he was no longer needed.', 1.0, 0)],
        10: [("I'll keep it in my data center", 1.0, 0), ('forever.', 1.0, 0, ECO)],
    },
}


def lineas(lang):
    codigo = (
        "import('./src/lib/vozMadre.js')"
        f".then((m) => process.stdout.write(JSON.stringify(m.lineasMadre('{lang}').flat())))"
    )
    out = subprocess.run(['node', '-e', codigo], cwd=RAIZ, capture_output=True, check=True).stdout
    return json.loads(out.decode('utf-8'))


def trozos(lang, i, texto):
    # (lo que se dice, velocidad, silencio, lleva eco)
    return [(p[0], p[1], p[2], ECO in p[3:]) for p in TROZOS.get(lang, {}).get(i) or [(texto, 1.0, 0)]]


def voz_en(audio, sr, umbral_db=-40):
    # Dónde empieza y acaba la voz (ventanas de 10 ms), en muestras.
    w = int(sr * 0.01)
    n = len(audio) // w
    e = np.sqrt(np.mean(audio[:n * w].reshape(n, w) ** 2, axis=1)) + 1e-9
    voz = np.flatnonzero(20 * np.log10(e / e.max()) > umbral_db)
    return voz[0] * w, (voz[-1] + 1) * w


def con_eco(audio, sr, repeticiones=5, caida=0.5, corte=3200):
    # Cada repetición es la frase completa, más baja y más oscura (un pasa-bajos
    # que se cierra), como una voz perdida en un lugar enorme y vacío: entra
    # cuando acaba la anterior, para que se entienda en los dos idiomas. La voz
    # original queda igual.
    audio = np.asarray(audio, dtype=np.float32)
    ini, fin = voz_en(audio, sr)
    retardo = (fin - ini) / sr + 0.08
    salida = np.zeros(len(audio) + int(sr * retardo * repeticiones), dtype=np.float32)
    salida[:len(audio)] += audio
    rep = audio
    for k in range(1, repeticiones + 1):
        a = np.exp(-2 * np.pi * corte * 0.78 ** (k - 1) / sr)
        filtrada = np.empty_like(rep)
        y = 0.0
        for n, x in enumerate(rep):
            y = (1 - a) * x + a * y
            filtrada[n] = y
        rep = filtrada
        i = int(sr * retardo * k)
        salida[i:i + len(rep)] += rep * caida ** k
    # Sin el silencio que queda después de que se apaga.
    salida = salida[:voz_en(salida, sr, -40)[1] + int(sr * 0.15)]
    pico = np.abs(salida).max()
    return salida * (0.98 / pico) if pico > 0.98 else salida


def estirar(audio, sr, velocidad):
    # Más lento sin cambiar el tono (atempo de ffmpeg).
    if abs(velocidad - 1) < 1e-3:
        return audio
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, 'a.wav'), os.path.join(d, 'b.wav')
        sf.write(a, audio, sr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a, '-filter:a', f'atempo={velocidad}', b], check=True)
        return sf.read(b, dtype='float32')[0]


def unir(partes, sr):
    # partes: [(audio, silencio después en segundos)]
    trozos_ = []
    for audio, silencio in partes:
        trozos_.append(np.asarray(audio, dtype=np.float32))
        if silencio > 0:
            trozos_.append(np.zeros(int(sr * silencio), dtype=np.float32))
    return np.concatenate(trozos_)


def escribir_version():
    # La huella de todos los audios va en la URL (src/lib/vozMadreVersion.js):
    # el CDN de Hostinger guarda los mp3 horas y, con el mismo nombre, algunos
    # nodos seguían sirviendo los viejos después de un deploy.
    h = hashlib.sha1()
    for f in sorted(glob.glob(os.path.join(SALIDA, '*', '*.mp3'))):
        h.update(os.path.relpath(f, SALIDA).replace(os.sep, '/').encode())
        with open(f, 'rb') as a:
            h.update(a.read())
    destino = os.path.join(RAIZ, 'src', 'lib', 'vozMadreVersion.js')
    texto = (
        '// Lo escribe scripts/voz-madre/lineas.py al generar las voces: va en la URL',
        '// de los audios para que el CDN no sirva los de antes.',
        f"export const VOZ_VERSION = '{h.hexdigest()[:10]}'",
        '',
    )
    with open(destino, 'w', encoding='utf-8', newline='') as js:
        js.write(chr(10).join(texto))


def a_mp3(wav, mp3):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '64k', mp3], check=True)
    os.remove(wav)
