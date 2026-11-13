import React, { useEffect, useRef } from 'react'
import { PauseIcon, PlayIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid'

// La barra de reproducción de "Conocer la historia" (Oscar: que se pueda
// adelantar y regresar como un video), abajo, en la barra de cine: play/pausa
// y el sonido (Oscar: abajo, como en un reproductor), el tiempo y la barra. Se
// pica o se arrastra:
// mientras se arrastra la historia se ve pero no habla (`voz: false`), y al
// soltar sigue con voz desde ahí. Las flechas del teclado las atiende la
// historia. Se pinta por cuadro con refs, sin estado de React.
const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const limita = (v) => Math.min(1, Math.max(0, v))
// Cada cuánto se pide el salto mientras se arrastra (la voz se recalcula en
// cada uno).
const ARRASTRE_MS = 60

export default function BarraHistoria({ progreso, irA, es, pausada, alternarPausa, conSonido, alternarSonido }) {
  const pistaRef = useRef(null)
  const llenoRef = useRef(null)
  const botonRef = useRef(null)
  const tiempoRef = useRef(null)
  const arrastre = useRef(null)

  useEffect(() => {
    let raf = 0
    let texto = ''
    const paso = () => {
      const p = arrastre.current ? { t: arrastre.current.t, total: arrastre.current.total } : progreso()
      if (p && llenoRef.current) {
        const f = limita(p.t / p.total)
        llenoRef.current.style.transform = `scaleX(${f})`
        botonRef.current.style.left = `${f * 100}%`
        const nuevo = `${mmss(p.t)} / ${mmss(p.total)}`
        if (nuevo !== texto) {
          texto = nuevo
          tiempoRef.current.textContent = nuevo
          pistaRef.current.setAttribute('aria-valuenow', String(Math.round(p.t / 1000)))
          pistaRef.current.setAttribute('aria-valuemax', String(Math.round(p.total / 1000)))
          pistaRef.current.setAttribute('aria-valuetext', nuevo)
        }
      }
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [progreso])

  const enPista = (e) => {
    const r = pistaRef.current.getBoundingClientRect()
    return limita((e.clientX - r.left) / Math.max(1, r.width))
  }
  const abajo = (e) => {
    const p = progreso()
    if (!p) return
    e.preventDefault()
    try { pistaRef.current.setPointerCapture(e.pointerId) } catch { }
    const t = enPista(e) * p.total
    arrastre.current = { t, total: p.total, pedido: performance.now() }
    irA(t, { voz: false })
  }
  const mueve = (e) => {
    const a = arrastre.current
    if (!a) return
    a.t = enPista(e) * a.total
    if (performance.now() - a.pedido >= ARRASTRE_MS) {
      a.pedido = performance.now()
      irA(a.t, { voz: false })
    }
  }
  const suelta = () => {
    const a = arrastre.current
    if (!a) return
    arrastre.current = null
    irA(a.t)
  }

  const pausaTexto = pausada ? (es ? 'Seguir' : 'Play') : (es ? 'Pausar' : 'Pause')
  const sonidoTexto = conSonido ? (es ? 'Quitar el sonido' : 'Mute') : (es ? 'Con sonido' : 'Sound on')
  return (
    <div className="dsp-tiempo">
      <button type="button" className="dsp-tiempo__btn" onClick={alternarPausa} aria-pressed={pausada} aria-label={pausaTexto} data-tip={pausaTexto}>
        {pausada ? <PlayIcon aria-hidden="true" /> : <PauseIcon aria-hidden="true" />}
      </button>
      <button type="button" className="dsp-tiempo__btn" onClick={alternarSonido} aria-pressed={conSonido} aria-label={sonidoTexto} data-tip={sonidoTexto}>
        {conSonido ? <SpeakerWaveIcon aria-hidden="true" /> : <SpeakerXMarkIcon aria-hidden="true" />}
      </button>
      <span ref={tiempoRef} className="dsp-tiempo__texto" aria-hidden="true">0:00 / 0:00</span>
      <div
        ref={pistaRef}
        className="dsp-tiempo__pista"
        role="slider"
        tabIndex={-1}
        aria-label={es ? 'Tiempo de la historia' : 'Story time'}
        aria-valuemin={0}
        onPointerDown={abajo}
        onPointerMove={mueve}
        onPointerUp={suelta}
        onPointerCancel={suelta}
      >
        <div className="dsp-tiempo__riel">
          <div ref={llenoRef} className="dsp-tiempo__lleno" />
        </div>
        <div ref={botonRef} className="dsp-tiempo__boton" />
      </div>
    </div>
  )
}
