// Iris de caricatura: la transición de escena del sitio, la del "That's all
// folks". Un hoyo redondo con su línea de tinta blanca (el contorno toon del
// personaje, DESIGN.md §7.8) que se cierra sobre un punto y se vuelve a abrir
// sobre otro. La primera escena que lo usa: al dar Entrar en el preloader se
// cierra sobre la cara de Skulley y se abre donde cae el personaje en el
// home. Cualquier otro cambio de escena puede llamar irisClose() /
// irisOpen() con sus propios puntos.
//
// Se pinta con la trama de las secciones (irisTrama.js, pedido de Oscar:
// homologar las transiciones), en el azul del home. El círculo de CSS se
// queda de respaldo para quien no tenga WebGL. De regreso a home el iris es el
// fondo de la sección (idea de Oscar): irisCubrir() deshace lo que hay encima en
// puntos de ese mismo color, así que el color no cambia, e irisOpen() lo abre
// sobre Skulley. Las secciones se revelan igual, con irisOpen() desde el color de
// su preloader: irisTapar() deja el iris cerrado detrás de él.
//
// La capa la monta <IrisOverlay/> una sola vez en App.jsx, arriba de todo:
// tiene que seguir cubriendo mientras la escena de abajo se desmonta. Aquí
// vive el motor: rAF + variables CSS, sin re-renders.
//
// Ritmo del cierre (los principios de animación de caricatura):
//   1. se cierra sobre el foco con curva lenta-rápida-lenta y FRENA ahí;
//   2. se sostiene un instante enmarcando el foco (el gag clásico);
//   3. anticipación: se abre un poco, como tomando aire…
//   4. …y se cierra de golpe.
// La apertura es un solo movimiento que arranca rápido y se asienta suave.

import { crearIrisTrama } from './irisTrama.js'

const INK = 5 // grosor de la línea de tinta, px (el mismo que en el CSS)

const TIMING = {
  close: 950,
  hold: 340,
  anticipate: 130,
  snap: 230,
  open: 1050,
  cubre: 480,
}

let layer = null
let runId = 0
let trama = null

export function registerIrisLayer(node) { layer = node }

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// Curva cúbica de Bézier como las de CSS (x en función del tiempo, resuelta
// por Newton con respaldo de bisección).
function bezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by
  const sx = (t) => ((ax * t + bx) * t + cx) * t
  const sy = (t) => ((ay * t + by) * t + cy) * t
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i += 1) {
      const err = sx(t) - x
      if (Math.abs(err) < 1e-5) return sy(t)
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0, hi = 1
    t = x
    for (let i = 0; i < 20; i += 1) {
      const v = sx(t)
      if (Math.abs(v - x) < 1e-5) break
      if (v < x) lo = t; else hi = t
      t = (lo + hi) / 2
    }
    return sy(t)
  }
}

const EASE = {
  inOut: bezier(0.7, 0, 0.3, 1),
  out: bezier(0.33, 1, 0.68, 1),
  in: bezier(0.55, 0, 1, 0.45),
  outExpo: bezier(0.16, 1, 0.3, 1),
  sine: bezier(0.37, 0, 0.63, 1),
}

function paintLayer(x, y, r) {
  if (!layer) return
  layer.style.setProperty('--ix', `${x}px`)
  layer.style.setProperty('--iy', `${y}px`)
  layer.style.setProperty('--ir', `${Math.max(0, r)}px`)
  trama?.dibuja(x, y, r)
}

function ponerTrama(color) {
  if (trama) return
  try { trama = crearIrisTrama(layer, color) } catch { trama = null }
  layer.classList.toggle('con-trama', !!trama)
}

function quitarTrama() {
  trama?.suelta()
  trama = null
  layer?.classList.remove('con-trama')
}

// Sin trama (movimiento reducido) el color lo da el fondo de la capa.
function ponerFondo(color) {
  if (color) layer.style.setProperty('--iris-fondo', `rgb(${color.join(',')})`)
}

function limpia() {
  setMode('off')
  quitarTrama()
  layer?.classList.remove('detras')
  layer?.style.removeProperty('--iris-fondo')
}

// El radio con el que ya no queda hoyo: con la trama los puntos todavía tienen que
// crecer hasta tocarse.
const radioCerrado = () => (trama ? -trama.banda() : 0)

// Radio que deja ver la pantalla completa desde (x, y): la esquina más lejana
// y la línea de tinta afuera.
function fullRadius(x, y) {
  const w = window.innerWidth, h = window.innerHeight
  return Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y)) + INK + 4
}

/** Sin iris en pantalla: ni cerrándose, ni cerrado, ni abriéndose. */
export const irisIdle = () => !layer || !layer.dataset.mode || layer.dataset.mode === 'off'

function setMode(mode) {
  if (!layer) return
  layer.dataset.mode = mode // off | closing | closed | opening | fading-in | fading-out
}

// `at` da el centro de cada cuadro: fijo, o pegado a un foco que se mueve.
function tween(id, paint, at, from, to, ms, ease) {
  return new Promise((resolve) => {
    const start = performance.now()
    const step = (now) => {
      if (id !== runId) { resolve(false); return }
      const k = Math.min(1, (now - start) / ms)
      const p = at()
      paint(p.x, p.y, from + (to - from) * ease(k))
      if (k < 1) requestAnimationFrame(step)
      else resolve(true)
    }
    requestAnimationFrame(step)
  })
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)) }

// El cierre con su ritmo completo. `r` es el radio con el que enmarca el
// foco antes del cierre final. Con `follow` (una función que devuelve
// { x, y }), el iris persigue al foco cuadro por cuadro: el foco de una
// escena viva se mueve mientras el iris se cierra (Skulley mira al cursor y
// luego se recentra) y un centro fijo lo dejaba descuadrado. Resuelve true si
// llegó a cerrar (false si otra transición lo interrumpió).
async function runClose(paint, { x, y, r, follow } = {}) {
  const id = ++runId
  const w = window.innerWidth, h = window.innerHeight
  let cx = Number.isFinite(x) ? x : w / 2
  let cy = Number.isFinite(y) ? y : h / 2
  const at = () => {
    if (follow) {
      try {
        const p = follow()
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) { cx = p.x; cy = p.y }
      } catch { }
    }
    return { x: cx, y: cy }
  }
  const frame = Number.isFinite(r) && r > 0 ? r : Math.min(w, h) * 0.18
  // Holgura para que el inicio cubra las esquinas aunque el foco se mueva.
  const full = fullRadius(cx, cy) + Math.min(w, h) * 0.1
  paint(cx, cy, full)
  return (await tween(id, paint, at, full, frame, TIMING.close, EASE.inOut))
    && (await tween(id, paint, at, frame, frame * 1.03, TIMING.hold, EASE.sine))
    && (await tween(id, paint, at, frame * 1.03, frame * 1.12, TIMING.anticipate, EASE.out))
    && (await tween(id, paint, at, frame * 1.12, radioCerrado(), TIMING.snap, EASE.in))
}

/**
 * Cierra el iris sobre (x, y). Sin punto, cierra al centro. `color` ([r, g, b]
 * en 0-255) es el de la trama; sin él, el azul del home. Resuelve cuando la
 * pantalla ya está cubierta.
 */
export async function irisClose(opts = {}) {
  if (!layer) return
  ponerFondo(opts.color)
  if (reducedMotion()) {
    const id = ++runId
    setMode('fading-in')
    await wait(320)
    if (id === runId) setMode('closed')
    return
  }
  ponerTrama(opts.color)
  setMode('closing')
  if (await runClose(paintLayer, opts)) setMode('closed')
}

/**
 * Tapa la pantalla con la trama del `color` dado ([r, g, b] en 0-255), todos los puntos
 * creciendo a la vez. Con movimiento reducido o sin WebGL, un fundido. Resuelve al cubrir.
 */
export async function irisCubrir({ color } = {}) {
  if (!layer) return
  const id = ++runId
  ponerFondo(color)
  if (!reducedMotion()) ponerTrama(color)
  if (!trama) {
    setMode('fading-in')
    await wait(320)
    if (id === runId) setMode('closed')
    return
  }
  const pinta = (x, y, lleno) => trama?.dibuja(x, y, fullRadius(x, y), lleno)
  pinta(0, 0, 0)
  setMode('closing')
  if (await tween(id, pinta, () => ({ x: 0, y: 0 }), 0, 1, TIMING.cubre, EASE.inOut)) setMode('closed')
}

/** El iris ya cerrado, sin animación y detrás del preloader de sección. */
export function irisTapar({ color } = {}) {
  if (!layer) return
  runId += 1
  ponerFondo(color)
  if (!reducedMotion()) ponerTrama(color)
  trama?.dibuja(0, 0, fullRadius(0, 0), 1)
  irisDetras()
  setMode('closed')
}

/** Manda el iris detrás del preloader de sección, que lo va a tapar. */
export function irisDetras() {
  layer?.classList.add('detras')
}

/** Lo apaga de golpe, para el reset de emergencia. */
export function irisSoltar() {
  runId += 1
  limpia()
}

/** Abre el iris desde (x, y) hasta dejar ver toda la pantalla. */
export async function irisOpen({ x, y } = {}) {
  if (!layer) return
  const id = ++runId
  const w = window.innerWidth, h = window.innerHeight
  const cx = Number.isFinite(x) ? x : w / 2
  const cy = Number.isFinite(y) ? y : h / 2
  irisWaiting(false)

  if (reducedMotion()) {
    setMode('fading-out')
    await wait(320)
    if (id === runId) limpia()
    return
  }

  const desde = radioCerrado()
  paintLayer(cx, cy, desde)
  setMode('opening')
  if (!(await tween(id, paintLayer, () => ({ x: cx, y: cy }), desde, fullRadius(cx, cy), TIMING.open, EASE.outExpo))) return
  limpia()
}

// Con el iris cerrado y la escena siguiente todavía cargando: la mascota
// camina en el centro del negro en vez de otra pantalla de carga.
export function irisWaiting(on) {
  if (!layer) return
  layer.classList.toggle('is-waiting', !!on)
}
