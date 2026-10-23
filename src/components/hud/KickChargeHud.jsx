import React, { useEffect, useRef, useState } from 'react'
import KickIcon from '../icons/KickIcon.jsx'
import { kickChargeLive, KICK_CHARGE_EVENT } from '../../lib/kickChargeLive.js'

// Medidor de la patada sobre la main nav. Es el mismo valor que la barra cian
// sobre la cabeza del personaje, pero en la UI y más grande: ahí se lee con
// precisión dónde va la carga para soltar en el punto que quieres.
//
// Solo re-renderiza al empezar y al terminar la carga; el relleno y el
// porcentaje se mutan en el DOM desde un rAF que corre únicamente mientras
// se carga (patrón de MusicPlayer / PowerBar).
export default function KickChargeHud({ label }) {
  const [active, setActive] = useState(kickChargeLive.active)
  const fillRef = useRef(null)
  const pctRef = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => {
    const onChange = (e) => setActive(!!e?.detail?.active)
    window.addEventListener(KICK_CHARGE_EVENT, onChange)
    return () => window.removeEventListener(KICK_CHARGE_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!active) return undefined
    let raf = 0
    let prev = -1
    const tick = () => {
      const c = Math.max(0, Math.min(1, kickChargeLive.charge || 0))
      if (Math.abs(c - prev) > 0.001) {
        prev = c
        const pct = Math.round(c * 100)
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${c})`
        if (pctRef.current) pctRef.current.textContent = `${pct}%`
        if (rootRef.current) {
          rootRef.current.setAttribute('aria-valuenow', String(pct))
          rootRef.current.toggleAttribute('data-full', c >= 0.98)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active])

  return (
    <div
      ref={rootRef}
      className="kick-hud"
      data-active={active ? '' : undefined}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      aria-hidden={active ? undefined : 'true'}
    >
      <KickIcon className="kick-hud__icon" />
      <div className="kick-hud__track">
        <div ref={fillRef} className="kick-hud__fill" />
        {/* Cuartos marcados con corte duro (ink lines, §14.2): referencia
            para soltar a media o a un cuarto de potencia sin adivinar. */}
        <span className="kick-hud__tick" style={{ left: '25%' }} />
        <span className="kick-hud__tick" style={{ left: '50%' }} />
        <span className="kick-hud__tick" style={{ left: '75%' }} />
      </div>
      <span ref={pctRef} className="kick-hud__pct">0%</span>
    </div>
  )
}
