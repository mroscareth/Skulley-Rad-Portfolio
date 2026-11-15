import React, { useState, useEffect } from 'react'
import scoreStore from '../lib/scoreStore'

/**
 * ScoreHUD - Isolated component for displaying the score
 */
function ScoreHUD({ t, isCompactUi = false }) {
  const [score, setScore] = useState(() => scoreStore.get())

  // Subscribe to store
  useEffect(() => {
    return scoreStore.subscribe(setScore)
  }, [])

  // En escritorio toma la esquina de las puertas (que se van al jugar, ver
  // `uiJuego` en App.jsx) y entra cuando ellas ya salieron.
  return (
    <div
      className="fixed z-[999990] pointer-events-none"
      style={isCompactUi
        ? { top: 12, left: 12 }
        : { top: 40, left: 40, animation: 'ui-enter-left 0.5s var(--ease-expo-out) 0.25s both' }}
    >
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.08] text-white shadow-md font-marquee uppercase tracking-wide">
        <span className={`leading-none ${isCompactUi ? 'text-xl' : 'text-2xl'}`}>
          {t('hud.score')}:{' '}
          <span style={{ color: score >= 0 ? '#f5ff00' : '#ef4444' }}>
            {score >= 0 ? `+${score}` : score}
          </span>
        </span>
      </div>
    </div>
  )
}

export default ScoreHUD
