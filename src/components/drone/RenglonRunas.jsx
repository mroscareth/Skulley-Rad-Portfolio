import React, { useEffect, useMemo, useRef } from 'react'
import { blipMadre } from '../../lib/blipMadre.js'
import { wordTiming, latinLetterTiming, useRuneSplit } from '../../lib/runeReveal.js'
import { RUNE_FONT_FAMILY } from '../../lib/installRuneFont.js'

// Un renglón de M.A.D.R.E. que llega en SKULLEYGLYPH y se revela letra por
// letra, como el título del preloader y el About (lib/runeReveal.js), con un
// bip cada dos letras cuando aparecen. Lo usan su diálogo (DialogoMadre) y sus
// avisos del juego (AvisoMadre), y la escena del trato de Argus con su propia
// voz (`bip`; `alBip` avisa en cada bip, para su quijada). `completo` se salta
// el revelado; `alTerminar` avisa cuando ya se leen todas las letras.

const LETRAS_POR_S = 46
const RUNA_MS = 560          // lo que tarda en irse cada runa
const PAUSA_PUNTO_MS = 170   // respiro después de una palabra con punto o coma

export default function RenglonRunas({ texto, completo = false, alTerminar, className = '', bip = blipMadre, alBip }) {
  const ref = useRef(null)
  useRuneSplit(ref, [texto])
  const { partes, fin, tiempos } = useMemo(() => {
    const step = 1000 / LETRAS_POR_S
    const out = []
    const t = []
    let at = 0
    for (const parte of texto.split(/(\s+)/)) {
      if (!parte) continue
      if (/^\s+$/.test(parte)) { out.push(parte); continue }
      const w = wordTiming(parte.length, step, RUNA_MS)
      out.push({ parte, at, w })
      for (let i = 0; i < parte.length; i++) t.push(at + i * step + RUNA_MS * 0.3)
      at += parte.length * step + (/[.,…?!:;]$/.test(parte) ? PAUSA_PUNTO_MS : 0)
    }
    return { partes: out, fin: (t[t.length - 1] || 0) + RUNA_MS * 0.6, tiempos: t }
  }, [texto])

  const alTerminarRef = useRef(alTerminar)
  alTerminarRef.current = alTerminar
  const bipRef = useRef(bip)
  bipRef.current = bip
  const alBipRef = useRef(alBip)
  alBipRef.current = alBip
  useEffect(() => {
    if (completo) { alTerminarRef.current?.(); return undefined }
    const t0 = performance.now()
    let raf = 0
    let k = 0
    const paso = () => {
      const ms = performance.now() - t0
      let sono = false
      while (k < tiempos.length && tiempos[k] <= ms) {
        if (!sono && k % 2 === 0) { bipRef.current?.(); alBipRef.current?.(); sono = true }
        k += 1
      }
      if (ms >= fin) { alTerminarRef.current?.(); return }
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [texto, completo, fin, tiempos])

  return (
    <p ref={ref} className={`dlg-texto${completo ? ' is-completo' : ''} ${className}`} aria-label={texto}>
      {partes.map((p, i) => (typeof p === 'string' ? p : (
        <span key={i} className="rt-word" aria-hidden="true" style={{ '--at': `${p.at}ms`, '--dur': `${p.w.dur}ms` }} data-step={p.w.step} data-letter={p.w.letter}>
          <span className="rt-latin">
            {[...p.parte].map((ch, j) => <span key={j} className="rt-l" style={latinLetterTiming(j, p.at, p.w.step, RUNA_MS)}>{ch}</span>)}
          </span>
          <span className="rt-runes" style={{ fontFamily: RUNE_FONT_FAMILY }}>{p.parte}</span>
        </span>
      )))}
    </p>
  )
}
