// Iris de caricatura: la transición de escena del sitio, la del "That's all
// folks". Un hoyo redondo con su línea de tinta blanca (el contorno toon del
// personaje, DESIGN.md §7.8) que se cierra sobre un punto y se vuelve a abrir
// sobre otro. La primera escena que lo usa: al dar Entrar en el preloader se
// cierra sobre la cara de Skulley y se abre donde cae el personaje en el
// home. Cualquier otro cambio de escena puede llamar irisClose() /
// irisOpen() con sus propios puntos.
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

const INK = 5 // grosor de la línea de tinta, px (el mismo que en el CSS)

const TIMING = {
  close: 950,
  hold: 340,
  anticipate: 130,
  snap: 230,
  open: 1050,
}

let layer = null
let focusProvider = null
let runId = 0

export function registerIrisLayer(node) { layer = node }

// Quien sabe dónde está el foco de la escena actual lo registra (p. ej. el
// Skulley del preloader: su cara). Devuelve { x, y, r } en px de pantalla.
export function setIrisFocus(fn) { focusProvider = fn }
export function getIrisFocus() {
  try { return focusProvider?.() || null } catch { return null }
}

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
}

// Radio que deja ver la pantalla completa desde (x, y): la esquina más lejana
// y la línea de tinta afuera.
function fullRadius(x, y) {
  const w = window.innerWidth, h = window.innerHeight
  return Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y)) + INK + 4
}

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
    && (await tween(id, paint, at, frame * 1.12, 0, TIMING.snap, EASE.in))
}

/**
 * Cierra el iris sobre (x, y). Sin punto, cierra al centro. Resuelve cuando
 * la pantalla ya está cubierta.
 */
export async function irisClose(opts = {}) {
  if (!layer) return
  if (reducedMotion()) {
    const id = ++runId
    setMode('fading-in')
    await wait(320)
    if (id === runId) setMode('closed')
    return
  }
  setMode('closing')
  if (await runClose(paintLayer, opts)) setMode('closed')
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
    if (id === runId) setMode('off')
    return
  }

  paintLayer(cx, cy, 0)
  setMode('opening')
  if (!(await tween(id, paintLayer, () => ({ x: cx, y: cy }), 0, fullRadius(cx, cy), TIMING.open, EASE.outExpo))) return
  setMode('off')
}

// Con el iris cerrado y la escena siguiente todavía cargando: la mascota
// camina en el centro del negro en vez de otra pantalla de carga.
export function irisWaiting(on) {
  if (!layer) return
  layer.classList.toggle('is-waiting', !!on)
}
