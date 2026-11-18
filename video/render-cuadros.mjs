// Cuadros sueltos del spot para revisar el montaje sin renderizar todo.
// node render-cuadros.mjs SpotX 1.0 3.3 16.4 ...   (segundos de la canción)
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const [id, ...tiempos] = process.argv.slice(2)
const out = process.env.SCRATCH || './out'
mkdirSync(out, { recursive: true })
const serveUrl = await bundle({ entryPoint: join(process.cwd(), 'remotion/index.jsx'), publicDir: join(process.cwd(), 'public') })
const comp = await selectComposition({ serveUrl, id })
const archivos = []
for (const t of tiempos) {
  const frame = Math.min(comp.durationInFrames - 1, Math.round(Number(t) * 60))
  const f = join(out, `c-${id}-${t}.png`)
  await renderStill({ composition: comp, serveUrl, frame, output: f, scale: comp.width > comp.height ? 0.5 : 0.35, timeoutInMilliseconds: 120000 })
  archivos.push(f)
  process.stdout.write('.')
}
const FF = 'C:/Users/oscar/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe'
const cols = comp.width > comp.height ? 4 : 6
const hoja = join(out, `hoja-${id}-${tiempos[0]}.jpg`)
const args = ['-y', '-loglevel', 'error']
for (const a of archivos) args.push('-i', a)
const n = archivos.length
const filas = Math.ceil(n / cols)
const pads = []
let fc = ''
for (let i = 0; i < n; i++) fc += `[${i}:v]scale=${comp.width > comp.height ? 480 : 180}:-1[v${i}];`
for (let i = n; i < filas * cols; i++) { fc += `[v0]drawbox=c=black:t=fill[x${i}];`; pads.push(i) }
const etiquetas = []
for (let i = 0; i < filas * cols; i++) etiquetas.push(i < n ? `[v${i}]` : `[x${i}]`)
// Repite v0 si hace falta relleno: usa split.
if (pads.length) {
  fc = fc.replace(`[0:v]scale=${comp.width > comp.height ? 480 : 180}:-1[v0];`, `[0:v]scale=${comp.width > comp.height ? 480 : 180}:-1,split=${pads.length + 1}[v0]${pads.map((p) => `[y${p}]`).join('')};`)
  fc = fc.replace(/\[v0\]drawbox=c=black:t=fill\[x(\d+)\];/g, '[y$1]drawbox=c=black:t=fill[x$1];')
}
fc += `${etiquetas.join('')}xstack=inputs=${filas * cols}:layout=${Array.from({ length: filas * cols }, (_, i) => `${(i % cols) === 0 ? '0' : Array.from({ length: i % cols }, () => 'w0').join('+')}_${Math.floor(i / cols) === 0 ? '0' : Array.from({ length: Math.floor(i / cols) }, () => 'h0').join('+')}`).join('|')}`
args.push('-filter_complex', fc, '-frames:v', '1', hoja)
const r = spawnSync(FF, args, { encoding: 'utf8' })
console.log('\n' + (r.stderr || hoja))
