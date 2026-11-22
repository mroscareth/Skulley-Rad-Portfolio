import React, { useState, useEffect } from 'react'
import scoreStore from '../lib/scoreStore'
import { escuchar, juego } from '../lib/juegoEsferas.js'

/**
 * ScoreHUD - Isolated component for displaying the score
 * Junto al puntaje va el multiplicador de la racha (×2, ×3, ×4) cuando hay uno,
 * con los aciertos seguidos que lleva (lib/juegoEsferas.js).
 */
function ScoreHUD({ t, isCompactUi = false }) {
  const [score, setScore] = useState(() => scoreStore.get())
  const [racha, setRacha] = useState(() => ({ mult: juego.mult, n: juego.racha }))

  // Subscribe to store
  useEffect(() => {
    return scoreStore.subscribe(setScore)
  }, [])
  useEffect(() => escuchar((tipo, d) => {
    if (tipo === 'inicio') setRacha({ mult: 1, n: 0 })
    else if (tipo === 'captura') setRacha({ mult: d.mult, n: d.racha })
  }), [])

  // En escritorio toma la esquina de las puertas (que se van al jugar, ver
  // `uiJuego` en App.jsx) y entra cuando ellas ya salieron.
  return (
    <div
      className="fixed z-[999990] pointer-events-none flex items-center gap-2"
      style={isCompactUi
        ? { top: 12, left: 12 }
        : { top: 40, left: 40, animation: 'ui-enter-left 0.5s var(--ease-expo-out) 0.25s both' }}
    >
      <div className="inline-flex items-center gap-2 px-4 pt-2.5 pb-2 rounded-[14px] bg-white border-2 border-[#0a0510] shadow-[0_5px_0_0_#0a0510] -translate-y-[5px] text-[#0a0510] font-marquee uppercase tracking-wide">
        <span className={`leading-none ${isCompactUi ? 'text-xl' : 'text-2xl'}`}>
          {t('hud.score')}:{' '}
          <span className="px-1.5 rounded-md" style={score >= 0 ? { background: '#f5ff00' } : { color: '#e11d48' }}>
            {score >= 0 ? `+${score}` : score}
          </span>
        </span>
      </div>
      {racha.mult > 1 && (
        <span key={racha.mult} className={`juego-mult juego-mult--${racha.mult}`} aria-label={`×${racha.mult}, ${racha.n}`}>
          ×{racha.mult}
          <small>{racha.n}</small>
        </span>
      )}
    </div>
  )
}

export default ScoreHUD
