import React from 'react'
import { RUNE_FONT_FAMILY_BOLD } from '../lib/installRuneFont.js'
import { RUNE_LETTER_MS, wordTiming, latinLetterTiming, useRuneSplit, whenRuneFontsReady } from '../lib/runeReveal.js'

// Filtración del nombre civil: cada 3-6 s el título se rompe en bloques
// █▓▒░, tiembla, deja ver OSCAR MOCTEZUMA ~400 ms y regresa. Se cambió por
// un pop toon al quitar el lenguaje terminal (2026-10-23) y Oscar lo pidió
// de vuelta: es el beat de canon de esta pantalla, no adorno de consola.
// Lo usan el preloader de escritorio (PreloaderContent) y la primera pantalla
// de la home de teléfono (MobileScrollHome). El estado vive aquí y no en la
// pantalla que lo monta: cada cambio repinta solo el título.
//
// `runesUntil` (ms; el preloader y la llegada a la home de teléfono): SKULLEY RAD llega escrito en runas de
// SKULLEYGLYPH, de corrido (con sus hilos y la doble L), cada runa sube y se
// desvanece a partir de ese momento (runeReveal) y hasta que ya se lee en
// letras empieza el glitch (pedido de Oscar).
//
// `fit` (solo el preloader): el título mide lo que SKULLEY (el ancho lo pone
// quien lo monta, en em) y una palabra del glitch que no quepa, como
// MOCTE█UMA, se comprime a lo ancho en vez de salirse hacia la cara de
// Skulley. Así el título se mide contra SKULLEY y no contra la palabra más
// ancha, y puede crecer en pantallas grandes (pedido de Oscar, 2026-11-10).
const RUNE_STEP_MS = 70       // entre una runa y la siguiente
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
// `glitchAfter` (ms): cuándo llega el primer glitch si no hay runas.
export default function GlitchName({ as: Tag = 'h1', className = '', runesUntil = 0, fit = false, glitchAfter = 2000, ...rest }) {
  const [glitchName, setGlitchName] = React.useState('SKULLEY RAD')
  const [isGlitching, setIsGlitching] = React.useState(false)
  const runeEnd = runesUntil > 0 ? runesUntil + 'SKULLEYRAD'.length * RUNE_STEP_MS + RUNE_LETTER_MS : 0
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
    cycle(runic ? runeEnd + GLITCH_AFTER_MS : glitchAfter)
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const tagRef = React.useRef(null)
  useRuneSplit(tagRef, [runic])

  // Las runas son ~20 % más angostas que Luckiest Guy a la misma altura: cada
  // palabra en runas se estira a lo ancho (--rt-fit, index.css) hasta medir lo
  // mismo que en letras, y el título en runas ocupa su bloque completo. Se
  // mide otra vez cuando cargan las fuentes de verdad.
  React.useLayoutEffect(() => {
    if (!runic) return undefined
    let alive = true
    const measure = () => {
      if (!alive || !tagRef.current) return
      for (const w of tagRef.current.querySelectorAll('.rt-word')) {
        const latin = w.querySelector('.rt-latin')
        const runes = w.querySelector('.rt-runes')
        if (latin && runes?.offsetWidth) w.style.setProperty('--rt-fit', (latin.offsetWidth / runes.offsetWidth).toFixed(4))
      }
    }
    measure()
    whenRuneFontsReady().then(measure)
    return () => { alive = false }
  }, [runic])

  React.useLayoutEffect(() => {
    if (!fit || runic || !tagRef.current) return
    const box = tagRef.current.clientWidth
    for (const w of tagRef.current.querySelectorAll('.glitch-fit')) {
      const s = w.offsetWidth ? Math.min(1, box / w.offsetWidth) : 1
      w.style.transform = s < 0.999 ? `scaleX(${s.toFixed(4)})` : ''
    }
  }, [fit, runic, glitchName])

  // Las runas: cada palabra en runas es un solo texto (para que salgan sus
  // hilos y la doble L), montada sobre la palabra en letras; cada runa sube,
  // se desvanece y deja su letra.
  if (runic) {
    let n = 0
    return (
      <Tag {...rest} ref={tagRef} className={`glitch-name ${className}`} style={{ color: '#ffffff' }} aria-label="Skulley Rad">
        {'SKULLEY RAD'.split(' ').map((word, wi) => {
          const at = runesUntil + n * RUNE_STEP_MS
          const t = wordTiming(word.length, RUNE_STEP_MS)
          n += word.length
          return (
            <span key={wi} className="block whitespace-nowrap rt-title" aria-hidden>
              <span className="rt-word" style={{ '--at': `${at}ms`, '--dur': `${t.dur}ms` }} data-step={t.step} data-letter={t.letter}>
                <span className="rt-latin">
                  {[...word].map((ch, i) => <span key={i} className="rt-l" style={latinLetterTiming(i, at, t.step)}>{ch}</span>)}
                </span>
                <span className="rt-runes" style={{ fontFamily: RUNE_FONT_FAMILY_BOLD }}>{word}</span>
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
      ref={tagRef}
      className={`glitch-name ${className} ${isGlitching ? 'glitch-name--on' : ''}`}
      style={{ color: glitchName === 'OSCAR MOCTEZUMA' ? '#f472b6' : '#ffffff' }}
      aria-label="Skulley Rad"
    >
      {glitchName.split(' ').map((word, i) => (
        <span key={i} className="block whitespace-nowrap" aria-hidden>
          {fit ? <span className="glitch-fit">{word}</span> : word}
        </span>
      ))}
    </Tag>
  )
}
