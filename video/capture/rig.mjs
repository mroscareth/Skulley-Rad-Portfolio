// Grabador: Chrome sin ventana con la GPU, reloj falso (vt.js) y cada cuadro
// capturado con CDP y mandado a ffmpeg. Lo usan los guiones de shots.js.
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
export const VIDEO = join(AQUI, '..')
export const RAW = join(VIDEO, 'raw')
export const FF = 'C:/Users/oscar/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
export const BASE = process.env.BASE || 'http://localhost:5174'
const VT = readFileSync(join(AQUI, 'vt.js'), 'utf8')

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function abrir({ width = 1920, height = 1080, dsf = 2, mobile = false, storage = {}, session = {}, ruta = '/', ua = null } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: null,
    args: [
      `--window-size=${width},${height}`,
      '--use-angle=d3d11',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--force_high_performance_gpu',
      '--enable-gpu-rasterization',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })
  const page = await browser.newPage()
  const client = await page.createCDPSession()
  await page.setViewport({ width, height, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile })
  if (ua) await page.setUserAgent(ua)
  await page.evaluateOnNewDocument(VT)
  await page.evaluateOnNewDocument((st, se) => {
    try {
      if (location.origin.startsWith('http')) {
        for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v)
        for (const [k, v] of Object.entries(se)) sessionStorage.setItem(k, v)
      }
    } catch { }
    window.__resolucionForzar = 'holgado'
  }, storage, session)
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 300)))
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)) })
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded', timeout: 120000 })
  return { browser, page, client, errores, width, height, dsf }
}

// Espera (en tiempo real, con el reloj en auto) a que `cond` sea verdad en la página.
export async function esperar(ctx, cond, { timeout = 90000, cada = 250, arg } = {}) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try {
      const ok = await ctx.page.evaluate(cond, arg)
      if (ok) return ok
    } catch { }
    await sleep(cada)
  }
  throw new Error('timeout esperando: ' + String(cond).slice(0, 120))
}

export const evalp = (ctx, fn, arg) => ctx.page.evaluate(fn, arg)

// Adelanta tiempo falso sin capturar.
export async function saltar(ctx, ms, dt = 1000 / 60) {
  const n = Math.max(1, Math.round(ms / dt))
  for (let i = 0; i < n; i += 30) {
    const k = Math.min(30, n - i)
    await ctx.page.evaluate(async (k, dt) => { for (let j = 0; j < k; j++) await window.__vt.step(dt) }, k, dt)
  }
}

export class Grabacion {
  constructor(ctx, nombre, { fps = 60, calidad = 92 } = {}) {
    this.ctx = ctx
    this.fps = fps
    this.dt = 1000 / fps
    this.calidad = calidad
    mkdirSync(RAW, { recursive: true })
    this.archivo = join(RAW, nombre + '.mp4')
    this.n = 0
    this.ff = spawn(FF, [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-threads', '6',
      '-pix_fmt', 'yuv420p', '-r', String(fps), this.archivo,
    ], { stdio: ['pipe', 'inherit', 'inherit'] })
    this.cerrado = new Promise((res) => this.ff.on('close', res))
    this.t0 = Date.now()
  }

  async cuadro(antes) {
    const { page, client } = this.ctx
    await page.evaluate(async (dt) => { await window.__vt.step(dt) }, this.dt)
    if (antes) await antes(this.n)
    const r = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: this.calidad, optimizeForSpeed: true, fromSurface: true })
    const buf = Buffer.from(r.data, 'base64')
    if (!this.ff.stdin.write(buf)) await new Promise((res) => this.ff.stdin.once('drain', res))
    this.n++
    if (this.n % 120 === 0) {
      const s = (Date.now() - this.t0) / 1000
      console.log(`  ${this.archivo.split(/[\\/]/).pop()} ${this.n} cuadros, ${(this.n / s).toFixed(1)} c/s`)
    }
  }

  // Graba `ms` de tiempo falso. `cada(i, t)` corre antes de cada cuadro (para
  // mandar teclas o mover el mouse a su hora).
  async grabar(ms, cada) {
    const n = Math.round(ms / this.dt)
    for (let i = 0; i < n; i++) {
      if (cada) await cada(i, i * this.dt)
      await this.cuadro()
    }
  }

  async cerrar() {
    this.ff.stdin.end()
    await this.cerrado
    console.log(`  listo ${this.archivo} (${this.n} cuadros, ${((Date.now() - this.t0) / 1000).toFixed(0)} s)`)
    return this.archivo
  }
}

// Teclado y mouse por CDP (llegan como eventos de verdad).
const CODIGOS = {
  w: ['KeyW', 87], a: ['KeyA', 65], s: ['KeyS', 83], d: ['KeyD', 68], e: ['KeyE', 69], k: ['KeyK', 75],
  ' ': ['Space', 32], Shift: ['ShiftLeft', 16], Escape: ['Escape', 27], Enter: ['Enter', 13],
  ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39],
}
export async function tecla(ctx, key, tipo) {
  const [code, kc] = CODIGOS[key] || [key, 0]
  const text = key.length === 1 ? key : undefined
  await ctx.client.send('Input.dispatchKeyEvent', {
    type: tipo === 'up' ? 'keyUp' : (text ? 'keyDown' : 'rawKeyDown'),
    key, code, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc, text: tipo === 'up' ? undefined : text,
  })
}
export const mouse = (ctx, x, y, tipo = 'mouseMoved', extra = {}) =>
  ctx.client.send('Input.dispatchMouseEvent', { type: tipo, x, y, button: tipo === 'mouseMoved' ? 'none' : 'left', clickCount: tipo === 'mouseMoved' ? 0 : 1, ...extra })
export async function clic(ctx, x, y) {
  await mouse(ctx, x, y, 'mouseMoved')
  await mouse(ctx, x, y, 'mousePressed')
  await mouse(ctx, x, y, 'mouseReleased')
}
export const rueda = (ctx, x, y, deltaY) =>
  ctx.client.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY })

export async function cerrar(ctx) {
  try { await ctx.browser.close() } catch { }
}

export const existe = existsSync
