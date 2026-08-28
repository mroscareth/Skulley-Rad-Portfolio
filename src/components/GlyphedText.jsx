import React from 'react'
import { ALPHABET_MAP } from '../lib/runeAlphabet.js'
import { RUNE_FONT_FAMILY } from '../lib/installRuneFont.js'

// GlyphedText — renderiza texto en el cual cada caracter con glifo en el
// alfabeto aparece primero como rune SVG, y después de HOLD_MS se resuelve
// a la letra/número normal. Efecto "escritura alienígena → traducción".
// `complete=true` fuerza mostrar todo como texto normal (modo skip intro).
// Compartido: preloader (PreloaderContent) y diálogo del zoidian.
const GLYPH_HOLD_MS = 280
export default function GlyphedText({ text, complete = false }) {
  const firstSeenRef = React.useRef(new Map())
  const [, setTick] = React.useState(0)

  // Registra timestamp la primera vez que cada índice aparece. Si un índice
  // "desaparece" (string se acorta) lo olvidamos para que si regresa tenga
  // glifo de nuevo. En el typewriter no ocurre (solo agrega).
  React.useEffect(() => {
    const now = performance.now()
    const map = firstSeenRef.current
    for (let i = 0; i < text.length; i++) {
      if (!map.has(i)) map.set(i, now)
    }
    // Prune si el texto se acortó
    if (map.size > text.length) {
      for (const key of Array.from(map.keys())) {
        if (key >= text.length) map.delete(key)
      }
    }
  }, [text])

  // Ticker ligero (~60ms) para que los caracteres recién añadidos transiten
  // a latin cuando su edad pasa GLYPH_HOLD_MS. Se apaga cuando complete=true.
  React.useEffect(() => {
    if (complete) return undefined
    const id = setInterval(() => setTick((t) => (t + 1) & 0xffff), 60)
    return () => clearInterval(id)
  }, [complete])

  if (complete) {
    return <>{text}</>
  }

  const now = performance.now()
  const out = []
  let wordChars = []
  const flushWord = (keyBase) => {
    if (wordChars.length === 0) return
    out.push(<span key={`w-${keyBase}`}>{wordChars}</span>)
    wordChars = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === ' ' || ch === ' ') {
      flushWord(i)
      out.push(<span key={`s-${i}`}>{ch}</span>)
      continue
    }
    if (ch === '\n') {
      flushWord(i)
      out.push(<br key={`br-${i}`} />)
      continue
    }
    // Lookup glifo: A-Z, 0-9 y símbolos cubiertos por el codex
    const entry = ALPHABET_MAP[ch] || ALPHABET_MAP[ch.toUpperCase && ch.toUpperCase()]
    if (!entry) {
      wordChars.push(<span key={i}>{ch}</span>)
      continue
    }
    const seen = firstSeenRef.current.get(i) || now
    const age = now - seen
    if (age < GLYPH_HOLD_MS) {
      wordChars.push(<span key={i} style={{ fontFamily: RUNE_FONT_FAMILY }}>{ch}</span>)
    } else {
      wordChars.push(<span key={i}>{ch}</span>)
    }
  }
  flushWord(text.length)

  return <>{out}</>
}
