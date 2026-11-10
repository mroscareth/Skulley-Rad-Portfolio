// Revelado de las runas letra por letra (pedido de Oscar, 2026-11-10): cada
// runa se desvanece hacia arriba, una tras otra, como humo, y su letra aparece
// en su lugar. Lo usa el preloader (título y voz de M.A.D.R.E.). En el About
// se probó y se quitó (Oscar, 2026-11-10): con los personajes 3D detrás bajaba
// a ~21 cuadros por segundo, contra ~52 sin runas.
//
// Estructura de cada palabra (index.css, bloque .rt-word):
//   <span class="rt-word" style="--at" data-step data-letter>
//     <span class="rt-latin"><span class="rt-l" style="--rt-at; --rt-len">p</span>…</span>
//     <span class="rt-runes">palabra</span>   ← la misma, en SKULLEYGLYPH
//   </span>
// La palabra en runas es UN texto para que la fuente le ponga sus hilos y la
// doble L. Para que cada runa se vaya sola, ya con la fuente cargada se mide
// la caja de cada letra con Range y se hace una copia de la palabra recortada
// a esa caja (.rt-clone): cada copia sube y se apaga en su turno.
// Se recorta justo donde se juntan dos runas, que es donde empiezan sus hilos.
// Antes era una máscara por letra sobre una sola palabra y se veían cuadros.
// Sin copias (fuente aún cargando) la palabra entera sube y se desvanece.
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

function letterBoxes(el) {
  const node = el.firstChild
  if (!node || node.nodeType !== 3) return null
  const box = el.getBoundingClientRect()
  if (!box.width) return null
  const range = document.createRange()
  const out = []
  for (let i = 0; i < node.length; i++) {
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    const r = range.getBoundingClientRect()
    out.push([(r.left - box.left) / box.width, r.width / box.width])
  }
  return out
}

// Parte en copias las runas de cada palabra dentro de `root`.
export function splitRunes(root) {
  root.querySelectorAll('.rt-word:not([data-rt-split])').forEach((word) => {
    const runes = word.querySelector('.rt-runes')
    if (!runes) { word.dataset.rtSplit = '1'; return }
    const boxes = letterBoxes(runes)
    if (!boxes) return
    const step = +word.dataset.step || 0
    const letter = +word.dataset.letter || RUNE_LETTER_MS
    // Si la animación ya corre (las letras se montaron antes que esto), las
    // copias se recorren lo que ya pasó para no quedar desfasadas.
    const anim = word.querySelector('.rt-l')?.getAnimations?.()[0]
    const elapsed = anim && anim.currentTime != null ? +anim.currentTime : 0
    const at = parseFloat(word.style.getPropertyValue('--at')) || 0
    const frag = document.createDocumentFragment()
    boxes.forEach(([x, w], i) => {
      if (w <= 0) return
      const c = runes.cloneNode(true)
      c.classList.add('rt-clone')
      c.style.clipPath = `inset(0 ${Math.max(0, (1 - x - w) * 100).toFixed(3)}% 0 ${Math.max(0, x * 100).toFixed(3)}%)`
      c.style.setProperty('--rt-at', `${at + i * step - elapsed}ms`)
      c.style.setProperty('--rt-len', `${letter}ms`)
      frag.appendChild(c)
    })
    runes.after(frag)
    runes.classList.add('rt-split')
    word.dataset.rtSplit = '1'
  })
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
