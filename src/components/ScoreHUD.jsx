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

  return (
    <div
      className="fixed z-[999990] pointer-events-none"
      style={{ top: isCompactUi ? 12 : 24, left: isCompactUi ? 12 : 24 }}
    >
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 text-white shadow-md font-marquee uppercase tracking-wide">
        <span className={`leading-none ${isCompactUi ? 'text-xl' : 'text-2xl'}`}>
          {t('hud.score')}:{' '}
          <span style={{ color: score >= 0 ? '#3b82f6' : '#ef4444' }}>
            {score >= 0 ? `+${score}` : score}
          </span>
        </span>
      </div>
    </div>
  )
}

export default ScoreHUD
