// Revelado de las runas letra por letra (pedido de Oscar, 2026-11-10): cada
// runa sube y se apaga, una tras otra, y su letra aparece en su lugar. Lo usan
// el preloader (título y voz de M.A.D.R.E.) y el About (Section2, en versión
// ligera: ahí está por qué).
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

// Parte cada palabra dentro de `root`: sus runas en copias por letra y, si la
// palabra en latín sigue siendo un solo texto (About), le da su tiempo: en
// letras sueltas o, con `latinPerWord`, la palabra entera de una vez (en el
// About cada letra animada costaba tanto como las runas).
// Primero mide todas y luego escribe: medir y escribir palabra por palabra
// obligaba al navegador a recalcular todo el texto cada vez (en el About eran
// ~200 veces seguidas, un tirón de 650 ms).
export function splitRunes(root, { latinPerWord = false } = {}) {
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
    const latin = word.querySelector('.rt-latin')
    if (latin && latinPerWord) {
      latin.classList.add('rt-l')
      const t = latinLetterTiming((latin.textContent.length - 1) / 2, at - elapsed, step, letter)
      for (const [k, v] of Object.entries(t)) latin.style.setProperty(k, v)
    } else if (latin && latin.childNodes.length === 1 && latin.firstChild.nodeType === 3) {
      const text = latin.firstChild.nodeValue
      const frag = document.createDocumentFragment()
      ;[...text].forEach((ch, i) => {
        const l = document.createElement('span')
        l.className = 'rt-l'
        l.textContent = ch
        for (const [k, v] of Object.entries(latinLetterTiming(i, at - elapsed, step, letter))) l.style.setProperty(k, v)
        frag.appendChild(l)
      })
      latin.replaceChildren(frag)
    }
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
// todavía (eso lo hace splitRunes justo antes de revelar el párrafo).
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
