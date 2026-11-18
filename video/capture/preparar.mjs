// Deja video/ listo en una computadora nueva (después de `npm install`):
// la canción del spot, la liga public/raw → raw (para que Remotion no copie
// gigas) y la fuente de las hojas de contactos. `npm run preparar`
import { existsSync, copyFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { VIDEO, RAW, FF } from './rig.mjs'

const REPO = join(VIDEO, '..')
const pub = join(VIDEO, 'public')
mkdirSync(pub, { recursive: true })
mkdirSync(RAW, { recursive: true })

const cancion = join(pub, 'madre-lobby-remix.mp3')
if (!existsSync(cancion)) {
  copyFileSync(join(REPO, 'public', 'songs', 'MADRE (Lobby Remix).mp3'), cancion)
  console.log('canción copiada')
}

const liga = join(pub, 'raw')
if (!existsSync(liga)) {
  symlinkSync(RAW, liga, 'junction')
  console.log('liga public/raw → raw')
}

const arial = join(VIDEO, 'capture', 'arial.ttf')
if (!existsSync(arial) && existsSync('C:/Windows/Fonts/arial.ttf')) {
  copyFileSync('C:/Windows/Fonts/arial.ttf', arial)
  console.log('arial.ttf copiada')
}

if (!existsSync(FF)) console.log('OJO: no está ffmpeg en', FF, '— corrige FF en capture/rig.mjs')
if (!existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')) console.log('OJO: no está Chrome donde lo busca capture/rig.mjs')
console.log('listo. Las tomas grabadas (raw/) no van en git: cópialas a', RAW)
