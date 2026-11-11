// Revelado de las runas letra por letra (pedido de Oscar, 2026-11-10): cada
// runa sube y se apaga, una tras otra, y su letra aparece en su lugar. Lo usan
// el preloader (título y voz de M.A.D.R.E.) y el About (Section2), que lo hace
// en canvas (revealRunesCanvas, al final: ahí está por qué).
//
// Estructura de cada palabra (index.css, bloque .rt-word):
//   <span class="rt-word" style="--at" data-step data-letter>
//     <span class="rt-latin"><span class="rt-l" style="--rt-at; --rt-len">p</span>…</span>
//     <span class="rt-runes">palabra</span>   ← la misma, en SKULLEYGLYPH
//   </span>
// La palabra en runas es UN texto para que la fuente le ponga la doble L.
// Para que cada runa se vaya sola, ya con la fuente cargada se mide la caja
// de cada letra con Range y se hace una copia de la palabra recortada
// a esa caja (.rt-clone): cada copia sube y se apaga en su turno.
// Antes era una máscara por letra sobre una sola palabra y se veían cuadros.
// Sin copias (fuente aún cargando) la palabra entera sube y se apaga.
import React from 'react'
import { RUNE_FONT_FAMILY, RUNE_FONT_FAMILY_BOLD } from './installRuneFont.js'

export const RUNE_LETTER_MS = 700   // lo que tarda en irse una runa

// Tiempos de una palabra: cada letra arranca `step` después de la anterior.
export function wordTiming(count, step, letterMs = RUNE_LETTER_MS) {
  return { dur: Math.max(1, count - 1) * step + letterMs, step, letter: letterMs }
}

// La letra en latín aparece cuando su runa ya va subiendo.
export function latinLetterTiming(i, at, step, letterMs = RUNE_LETTER_MS) {
  return { '--rt-at': `${at + i * step + letterMs * 0.3}ms`, '--rt-len': `${letterMs * 0.6}ms` }
}

// La única ligadura de la fuente: LL / ll. Es UNA runa, pero Range le reparte su
// caja mitad y mitad a las dos letras, y cada mitad se iba a su tiempo (Oscar la
// vio partirse en SKULLEYRAD, 2026-11-10). Las dos letras comparten una caja: la
// primera lleva la runa entera y la segunda queda vacía (no hace copia).
const LIGADURA = /^(LL|ll)$/

// La caja en pantalla de cada letra; la segunda de la doble L queda en null.
function letterRects(el) {
  const node = el.firstChild
  if (!node || node.nodeType !== 3) return null
  const text = node.nodeValue
  const range = document.createRange()
  const out = []
  for (let i = 0; i < node.length; i++) {
    const liga = LIGADURA.test(text.slice(i, i + 2))
    range.setStart(node, i)
    range.setEnd(node, i + (liga ? 2 : 1))
    out.push(range.getBoundingClientRect())
    if (liga) { out.push(null); i += 1 }
  }
  return out
}

function letterBoxes(el) {
  const box = el.getBoundingClientRect()
  if (!box.width) return null
  const rects = letterRects(el)
  return rects && rects.map((r) => (r ? [(r.left - box.left) / box.width, r.width / box.width] : [0, 0]))
}

// Copias de una palabra en runas recortadas a cada letra, con su índice. Las
// usan splitRunes y el arranque del preloader (PreloaderIntro).
export function runeLetterClones(el, boxes = letterBoxes(el)) {
  if (!boxes) return null
  const out = []
  boxes.forEach(([x, w], i) => {
    if (w <= 0) return
    const c = el.cloneNode(true)
    c.style.clipPath = `inset(0 ${Math.max(0, (1 - x - w) * 100).toFixed(3)}% 0 ${Math.max(0, x * 100).toFixed(3)}%)`
    out.push([c, i])
  })
  return out
}

// Parte en copias por letra las runas de cada palabra dentro de `root`.
// Primero mide todas y luego escribe: medir y escribir palabra por palabra
// obligaba al navegador a recalcular todo el texto cada vez (en el About eran
// ~200 veces seguidas, un tirón de 650 ms).
export function splitRunes(root) {
  const words = [...root.querySelectorAll('.rt-word:not([data-rt-split])')]
  if (!words.length) return
  // Si la animación ya corre (las letras se montaron antes que esto, como en
  // el preloader), las copias se recorren lo que ya pasó para no desfasarse.
  const anim = root.querySelector('.rt-l')?.getAnimations?.()[0]
  const elapsed = anim && anim.currentTime != null ? +anim.currentTime : 0
  const jobs = words.map((word) => {
    const runes = word.querySelector('.rt-runes')
    return { word, runes, boxes: runes ? letterBoxes(runes) : null }
  })
  for (const { word, runes, boxes } of jobs) {
    if (runes && !boxes) continue
    const step = +word.dataset.step || 0
    const letter = +word.dataset.letter || RUNE_LETTER_MS
    const at = parseFloat(word.style.getPropertyValue('--at')) || 0
    if (runes) {
      const frag = document.createDocumentFragment()
      for (const [c, i] of runeLetterClones(runes, boxes)) {
        c.classList.add('rt-clone')
        c.style.setProperty('--rt-at', `${at + i * step - elapsed}ms`)
        c.style.setProperty('--rt-len', `${letter}ms`)
        frag.appendChild(c)
      }
      runes.after(frag)
      runes.classList.add('rt-split')
    }
    word.dataset.rtSplit = '1'
  }
}

export function whenRuneFontsReady() {
  const f = typeof document !== 'undefined' ? document.fonts : null
  if (!f) return Promise.resolve()
  return Promise.all([f.load(`500 1em ${RUNE_FONT_FAMILY}`), f.load(`500 1em ${RUNE_FONT_FAMILY_BOLD}`)])
    .catch(() => {})
    .then(() => f.ready)
}

// Mide cuando ya cargaron las fuentes (las runas y las letras): medir con la
// de respaldo daría cajas de otro tamaño.
export function useRuneSplit(ref, deps) {
  React.useEffect(() => {
    let alive = true
    whenRuneFontsReady().then(() => requestAnimationFrame(() => {
      if (alive && ref.current) splitRunes(ref.current)
    }))
    return () => { alive = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

// El About viene del CMS como HTML: envuelve cada palabra de sus textos en la
// estructura de arriba, sin tocar enlaces ni negritas, pero sin partir nada
// todavía (eso lo hace revealRunesCanvas justo antes de revelar el párrafo).
// Devuelve lo que dura el revelado del párrafo desde que se suelta.
export function runifyElement(el, { perSecond = 120, letterMs = RUNE_LETTER_MS, fontFamily = RUNE_FONT_FAMILY } = {}) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('.rt-word') || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  const step = 1000 / perSecond
  let index = 0, end = 0
  for (const node of nodes) {
    const frag = document.createDocumentFragment()
    for (const part of node.nodeValue.split(/(\s+)/)) {
      if (!part) continue
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue }
      const t = wordTiming(part.length, step, letterMs)
      const at = index * step
      index += part.length
      end = Math.max(end, at + t.dur)
      const word = document.createElement('span')
      word.className = 'rt-word'
      word.style.setProperty('--at', `${at}ms`)
      word.style.setProperty('--dur', `${t.dur}ms`)
      word.dataset.step = t.step
      word.dataset.letter = t.letter
      const latin = document.createElement('span')
      latin.className = 'rt-latin'
      latin.textContent = part
      const runes = document.createElement('span')
      runes.className = 'rt-runes'
      runes.setAttribute('aria-hidden', 'true')
      runes.style.fontFamily = fontFamily
      runes.textContent = part
      word.append(latin, runes)
      frag.appendChild(word)
    }
    node.parentNode.replaceChild(frag, node)
  }
  return end
}

// Revelado del About en canvas (2026-11-11). Con una copia por letra
// (splitRunes), Chrome le daba capa propia a cada copia desde que se soltaba
// el párrafo, también durante su retraso: cientos de capas de texto con
// contorno nacían en un solo cuadro (175 ms congelado en el Brave de Oscar) y,
// mientras duraba el revelado, el About bajaba de 240 a 56–108 cuadros por
// segundo. Aquí la runa quieta se queda en el DOM, tal cual, y cuando arranca
// la primera letra de una palabra, la palabra entera pasa a un solo canvas
// encima del párrafo, que copia cada letra desde una hoja donde cada palabra
// se pintó una vez: una capa en vez de cientos. El párrafo esperando no pasa
// al canvas porque Chrome le pone otro antialias al texto del canvas (más
// suave) y el relevo se notaba; una palabra que ya arrancó se va en unos 30 ms
// y ahí no se ve. Recortar la palabra del DOM letra por letra repintaba el
// párrafo en cada cuadro y bajaba a la mitad los cuadros por segundo; así es
// un repintado por palabra. Cada copia cae en píxeles enteros con el mismo
// sobrante subpixel que la palabra en pantalla. Las palabras en latín reciben
// su animación hasta que les toca, así que nunca hay más de unas cuantas a la
// vez. Devuelve con qué cortarlo; onEnd llega cuando termina.
// rendimiento.md, 2026-11-11.
const RISE_EM = 0.42   // lo que sube una runa (rtRise)
const SHEET_W = 4096

// Del tope del texto (la caja de Range) a la línea base, por fuente: la caja no
// dice dónde se apoya la letra. Se mide una vez con una sonda en la línea base
// (solo con las fuentes ya cargadas: revealRunesCanvas corre después de
// whenRuneFontsReady) y sirve para todos los párrafos.
const baselines = new Map()
function measureBaselines(items, dpr) {
  const probes = new Map()
  for (const it of items) {
    const key = `${it.font}@${dpr}`
    if (!it.rects || baselines.has(key) || probes.has(key)) continue
    const s = document.createElement('span')
    s.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
    it.runes.appendChild(s)
    probes.set(key, { s, node: it.runes.firstChild })
  }
  if (!probes.size) return
  const range = document.createRange()
  for (const [key, { s, node }] of probes) {
    range.setStart(node, 0)
    range.setEnd(node, node.length)
    baselines.set(key, s.getBoundingClientRect().top - range.getBoundingClientRect().top)
  }
  for (const { s } of probes.values()) s.remove()
}

// ease-out de CSS, cubic-bezier(0, 0, 0.58, 1), la curva de rtRise.
const easeOut = (() => {
  const n = 256, lut = new Float32Array(n + 1)
  const bez = (t, p2) => 3 * (1 - t) * t * t * p2 + t * t * t
  let t = 0
  for (let i = 0; i <= n; i++) {
    while (t < 1 && bez(t, 0.58) < i / n) t = Math.min(1, t + 1 / 2048)
    lut[i] = bez(t, 1)
  }
  return (k) => { const f = k * n, i = f | 0; return i >= n ? 1 : lut[i] + (lut[i + 1] - lut[i]) * (f - i) }
})()

// También lo usa la voz de M.A.D.R.E. en el preloader (`porLetra`: ahí la letra
// normal aparece letra por letra, cada `.rt-l.rt-jit` con su animación hasta
// que le toca; tenía el mismo tirón al entrar, ~150 ms). `t0` es el cero del
// reloj de `--at`, por si se llama después de montar el texto.
export function revealRunesCanvas(root, { onEnd, t0 = performance.now(), porLetra = false } = {}) {
  const items = [...root.querySelectorAll('.rt-word')].map((word) => {
    const runes = word.querySelector('.rt-runes')
    const cs = runes && runes.firstChild ? getComputedStyle(runes) : null
    return {
      runes,
      latin: word.querySelector('.rt-latin'),
      at: parseFloat(word.style.getPropertyValue('--at')) || 0,
      step: +word.dataset.step || 0,
      letter: +word.dataset.letter || RUNE_LETTER_MS,
      font: cs?.font,
      size: cs ? parseFloat(cs.fontSize) : 0,
      fill: cs?.color,
      strokeW: cs ? parseFloat(cs.webkitTextStrokeWidth) || 0 : 0,
      stroke: cs?.webkitTextStrokeColor,
    }
  })

  // Primero lee, con el layout que ya había: escribir antes obligaba al
  // navegador a recalcular el párrafo al soltarlo (~16 ms).
  const dpr = window.devicePixelRatio || 1
  const rr = root.getBoundingClientRect()
  const em = parseFloat(getComputedStyle(root).fontSize) || 16
  for (const it of items) it.rects = it.font ? letterRects(it.runes) : null
  measureBaselines(items, dpr)
  // El canvas cubre el párrafo con margen para lo que suben las runas, y cae
  // justo en la rejilla de píxeles midiendo lo mismo que su imagen: con medio
  // píxel de más el compositor lo reescalaría y las runas saldrían suaves.
  const ox = Math.round((rr.left - 0.75 * em) * dpr), oy = Math.round((rr.top - em) * dpr)
  const cw = Math.max(1, Math.round((rr.right + 0.75 * em) * dpr) - ox)
  const ch = Math.max(1, Math.round((rr.bottom + 0.75 * em) * dpr) - oy)

  // Acomoda cada palabra en la hoja con margen para contorno, hilos y colas.
  const words = []
  let cx = 0, cy = 0, rowH = 0, sheetW = 1
  for (const it of items) {
    const first = it.rects?.[0]
    if (!first || !first.width) continue
    const last = it.rects.reduce((a, r) => r || a, first)
    const fs = it.size * dpr
    const pad = Math.ceil(fs * 0.6), up = Math.ceil(fs * 1.25), down = Math.ceil(fs * 0.6)
    const xd = first.left * dpr - ox, yd = (first.top + baselines.get(`${it.font}@${dpr}`)) * dpr - oy
    const bx = Math.floor(xd), by = Math.floor(yd)
    const w = Math.ceil((last.right - first.left) * dpr) + 2 * pad + 1, h = up + down
    if (cx + w > SHEET_W && cx > 0) { cx = 0; cy += rowH; rowH = 0 }
    words.push({ it, first, sx: cx, sy: cy, w, h, textX: cx + pad + xd - bx, textY: cy + up + yd - by, dx: bx - pad - cx, dy: by - up - cy, start: Infinity, inCanvas: false })
    cx += w
    rowH = Math.max(rowH, h)
    sheetW = Math.max(sheetW, cx)
  }

  const sheet = document.createElement('canvas')
  sheet.width = sheetW
  sheet.height = Math.max(1, cy + rowH)
  const sc = sheet.getContext('2d')
  sc.lineJoin = 'miter'
  sc.miterLimit = 4
  const letters = []
  for (const wd of words) {
    const { it } = wd
    const text = it.runes.firstChild.nodeValue
    sc.setTransform(dpr, 0, 0, dpr, wd.textX, wd.textY)
    sc.font = it.font
    if (it.strokeW > 0) {
      sc.lineWidth = it.strokeW
      sc.strokeStyle = it.stroke
      sc.strokeText(text, 0, 0)
    }
    sc.fillStyle = it.fill
    sc.fillText(text, 0, 0)
    // Cada letra se lleva su tramo de la hoja, sin traslaparse con la vecina;
    // la primera y la última, hasta la orilla de la palabra.
    const idx = it.rects.flatMap((r, i) => (r ? [i] : []))
    const edge = (j) => Math.round(wd.textX + (it.rects[idx[j]].left - wd.first.left) * dpr)
    idx.forEach((i, j) => {
      const x0 = j === 0 ? wd.sx : edge(j)
      const x1 = j === idx.length - 1 ? wd.sx + wd.w : edge(j + 1)
      if (x1 <= x0) return
      const l = { wd, sx: x0, sy: wd.sy, sw: x1 - x0, sh: wd.h, dx: wd.dx, dy: wd.dy, start: it.at + i * it.step, len: it.letter, rise: RISE_EM * it.size * dpr }
      letters.push(l)
      wd.start = Math.min(wd.start, l.start)
    })
    it.runes.classList.add('rt-still')
  }

  const latins = []
  let end = 0
  for (const l of letters) end = Math.max(end, l.start + l.len)
  for (const it of items) {
    if (!it.latin) continue
    const piezas = porLetra ? [...it.latin.querySelectorAll('.rt-l')] : [it.latin]
    piezas.forEach((el, i) => {
      const t = latinLetterTiming(porLetra ? i : (it.latin.textContent.length - 1) / 2, it.at, it.step, it.letter)
      el.style.setProperty('--rt-len', t['--rt-len'])
      const start = parseFloat(t['--rt-at'])
      latins.push({ el, start, on: false })
      end = Math.max(end, start + it.letter * 0.6)
    })
  }
  const canvas = document.createElement('canvas')
  canvas.className = 'rt-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.width = cw
  canvas.height = ch
  canvas.style.left = `${ox / dpr - rr.left}px`
  canvas.style.top = `${oy / dpr - rr.top}px`
  canvas.style.width = `${cw / dpr}px`
  canvas.style.height = `${ch / dpr}px`
  root.classList.add('rt-reveal')
  if (!porLetra) root.classList.add('rt-reveal-words')
  root.appendChild(canvas)
  // Las palabras cuyas runas no se pudieron medir se van enteras (rtRise).
  root.classList.remove('rt-hold')
  const ctx = canvas.getContext('2d')
  const draw = (t) => {
    for (const wd of words) {
      if (wd.inCanvas || t <= wd.start) continue
      wd.inCanvas = true
      wd.it.runes.classList.add('rt-split')
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const l of letters) {
      const k = (t - l.start) / l.len
      if (k >= 1 || !l.wd.inCanvas) continue
      const e = k > 0 ? easeOut(k) : 0
      ctx.globalAlpha = 1 - e
      ctx.drawImage(sheet, l.sx, l.sy, l.sw, l.sh, l.sx + l.dx, l.sy + l.dy - l.rise * e, l.sw, l.sh)
    }
    for (const l of latins) {
      if (l.on || t < l.start) continue
      l.on = true
      l.el.style.setProperty('--rt-at', `${(l.start - t).toFixed(1)}ms`)
      l.el.classList.add('rt-on')
    }
  }

  let raf = 0, done = false
  const stop = () => {
    if (done) return
    done = true
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', finish)
    canvas.remove()
    canvas.width = canvas.height = sheet.width = sheet.height = 0
  }
  // Si cambia el tamaño de la ventana las copias quedan fuera de lugar: se
  // termina ya, con todo el texto en letras.
  const finish = () => {
    if (done) return
    for (const l of latins) if (!l.on) l.el.classList.add(porLetra ? 'rt-shown' : 'rt-on')
    for (const it of items) it.runes?.classList.add('rt-split')
    stop()
    onEnd?.()
  }
  const tick = () => {
    const t = performance.now() - t0
    if (t >= end) return finish()
    draw(t)
    raf = requestAnimationFrame(tick)
  }
  draw(performance.now() - t0)
  raf = requestAnimationFrame(tick)
  window.addEventListener('resize', finish)
  return stop
}
