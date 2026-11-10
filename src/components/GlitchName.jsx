import React from 'react'
import { RUNE_FONT_FAMILY_BOLD } from '../lib/installRuneFont.js'

// Filtración del nombre civil: cada 3-6 s el título se rompe en bloques
// █▓▒░, tiembla, deja ver OSCAR MOCTEZUMA ~400 ms y regresa. Se cambió por
// un pop toon al quitar el lenguaje terminal (2026-10-23) y Oscar lo pidió
// de vuelta: es el beat de canon de esta pantalla, no adorno de consola.
// Lo usan el preloader de escritorio (PreloaderContent) y la primera pantalla
// de la home de teléfono (MobileScrollHome). El estado vive aquí y no en la
// pantalla que lo monta: cada cambio repinta solo el título.
//
// `runesUntil` (ms, solo el preloader): SKULLEY RAD llega escrito en runas de
// SKULLEYGLYPH, se revela letra por letra a partir de ese momento y hasta que
// ya se lee en letras empieza el glitch (pedido de Oscar).
const RUNE_STEP_MS = 70       // una letra tras otra
const RUNE_FLIP_MS = 640      // lo que dura el cambio de una runa a su letra
const GLITCH_AFTER_MS = 1400  // respiro entre la revelación y el primer glitch

// [nombre, cuánto se queda]
const SEQUENCE = [
  ['SK█LLEY R█D', 50],
  ['▓▒░SCAR M░▒▓', 80],
  ['OSCAR MOCTE█UMA', 100],
  ['OSCAR MOCTEZUMA', 400],
  ['▓▒░SCAR M░▒▓', 80],
  ['SKU██EY RA█', 60],
  ['SKULLEY RAD', 0],
]

// Cada palabra que llega a pintarse, para medir el título contra la más ancha
// (MOCTE█UMA) y que el glitch nunca se salga de su columna.
export const GLITCH_NAME_WORDS = [...new Set(SEQUENCE.flatMap(([name]) => name.split(' ')))]

// Una palabra por renglón, siempre dos. Los spans van ocultos al lector de
// pantalla: el nombre accesible es el aria-label, no los bloques del glitch.
export default function GlitchName({ as: Tag = 'h1', className = '', runesUntil = 0, ...rest }) {
  const [glitchName, setGlitchName] = React.useState('SKULLEY RAD')
  const [isGlitching, setIsGlitching] = React.useState(false)
  const runeEnd = runesUntil > 0 ? runesUntil + 'SKULLEYRAD'.length * RUNE_STEP_MS + RUNE_FLIP_MS : 0
  const [runic, setRunic] = React.useState(() => runeEnd > 0
    && !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))

  React.useEffect(() => {
    const timers = new Set()
    const later = (fn, ms) => {
      const id = setTimeout(() => { timers.delete(id); fn() }, ms)
      timers.add(id)
    }
    const cycle = (wait) => later(() => {
      setIsGlitching(true)
      let at = 0
      for (const [name, hold] of SEQUENCE) {
        later(() => setGlitchName(name), at)
        at += hold
      }
      later(() => {
        setIsGlitching(false)
        cycle(3000 + Math.random() * 3000)
      }, at + 100)
    }, wait)
    if (runic) later(() => setRunic(false), runeEnd)
    cycle(runic ? runeEnd + GLITCH_AFTER_MS : 2000)
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Las runas: la palabra en runas (con su propio espaciado) va centrada
  // sobre la palabra en letras, y cada letra aparece cuando se va su runa.
  if (runic) {
    let n = 0
    return (
      <Tag {...rest} className={`glitch-name ${className}`} style={{ color: '#ffffff' }} aria-label="Skulley Rad">
        {'SKULLEY RAD'.split(' ').map((word, wi) => {
          const chars = [...word].map((ch) => ({ ch, i: n, flip: `${runesUntil + (n++) * RUNE_STEP_MS}ms` }))
          return (
            <span key={wi} className="block whitespace-nowrap rt-title" aria-hidden>
              <span className="rt-word">
                {chars.map(({ ch, i, flip }) => <span key={i} className="rt-letter" style={{ '--flip': flip }}>{ch}</span>)}
                <span className="rt-runes" style={{ fontFamily: RUNE_FONT_FAMILY_BOLD }}>
                  {chars.map(({ ch, i, flip }) => <span key={i} className="rt-rune" style={{ '--flip': flip }}>{ch}</span>)}
                </span>
              </span>
            </span>
          )
        })}
      </Tag>
    )
  }

  return (
    <Tag
      {...rest}
      className={`glitch-name ${className} ${isGlitching ? 'glitch-name--on' : ''}`}
      style={{ color: glitchName === 'OSCAR MOCTEZUMA' ? '#f472b6' : '#ffffff' }}
      aria-label="Skulley Rad"
    >
      {glitchName.split(' ').map((word, i) => (
        <span key={i} className="block whitespace-nowrap" aria-hidden>{word}</span>
      ))}
    </Tag>
  )
}
