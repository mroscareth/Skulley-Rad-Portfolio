# Las líneas de la historia salen de src/lib/vozMadre.js (lineasMadre), la
# misma fuente de los subtítulos: si cambia el texto, se regeneran los audios
# y siguen empatando. Cada audio es public/voz/madre/<voz>/<idioma>-NN.mp3.
import json
import os
import subprocess

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SALIDA = os.path.join(RAIZ, 'public', 'voz', 'madre')


def lineas(lang):
    codigo = (
        "import('./src/lib/vozMadre.js')"
        f".then((m) => process.stdout.write(JSON.stringify(m.lineasMadre('{lang}').flat())))"
    )
    out = subprocess.run(['node', '-e', codigo], cwd=RAIZ, capture_output=True, check=True).stdout
    return json.loads(out.decode('utf-8'))


def a_mp3(wav, mp3):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '64k', mp3], check=True)
    os.remove(wav)
