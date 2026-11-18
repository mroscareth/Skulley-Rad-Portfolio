// Hoja de contactos de una toma: un cuadro cada `cada` segundos, con la hora
// encima. `node capture/hoja.mjs intro 1 [desde] [hasta]`
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FF, RAW } from './rig.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const [nombre, cada = '1', desde = '0', hasta = '9999', cols = '5'] = process.argv.slice(2)
const out = join(process.env.SCRATCH || '.', `hoja-${nombre}-${desde}.jpg`)
const vf = [
  `select='between(t,${desde},${hasta})*not(mod(n,${Math.round(Number(cada) * 60)}))'`,
  'scale=480:-1',
  "drawtext=fontfile=arial.ttf:text='%{pts}':x=6:y=6:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6",
  `tile=${cols}x6:padding=4`,
].join(',')
const r = spawnSync(FF, ['-y', '-loglevel', 'error', '-i', join(RAW, nombre + '.mp4'), '-vf', vf, '-frames:v', '1', '-fps_mode', 'vfr', out], { encoding: 'utf8', cwd: AQUI })
console.log(r.stderr || out)
