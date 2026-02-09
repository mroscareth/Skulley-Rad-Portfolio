import React, { useEffect } from 'react'
import { playSfx } from '../lib/sfx.js'

/**
 * SphereGameModal — Terminal-style tutorial modal explaining the sphere game mechanics.
 */
function SphereGameModal({ t, open, onClose, gameActive = false, onStartGame }) {
  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e?.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handlePlay = () => {
    try { playSfx('click', { volume: 0.8 }) } catch {}
    try { onStartGame?.() } catch {}
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-[9999999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('spheresTutorial.dialogAria')}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none" />

      {/* Terminal styles */}
      <style>{`
        @keyframes terminalScanlines {
          0% { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        @keyframes terminalGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.3), inset 0 0 60px rgba(34, 197, 94, 0.05); }
          50% { box-shadow: 0 0 30px rgba(34, 197, 94, 0.4), inset 0 0 80px rgba(34, 197, 94, 0.08); }
        }
        @keyframes glitchTitle {
          0%, 100% { text-shadow: 0 0 10px rgba(34, 197, 94, 0.8); }
          25% { text-shadow: -2px 0 rgba(255, 0, 128, 0.8), 2px 0 rgba(0, 255, 255, 0.8); }
          50% { text-shadow: 0 0 20px rgba(34, 197, 94, 1); }
          75% { text-shadow: 2px 0 rgba(255, 0, 128, 0.8), -2px 0 rgba(0, 255, 255, 0.8); }
        }
      `}</style>

      {/* Modal content - Terminal style */}
      <div 
        className="relative w-[min(680px,94vw)] max-h-[90vh] overflow-y-auto rounded-lg"
        style={{
          backgroundColor: '#0a0f0a',
          border: '2px solid #22c55e',
          fontFamily: '"Cascadia Code", monospace',
          animation: 'terminalGlow 3s ease-in-out infinite',
        }}
      >
        {/* Scanlines overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03] z-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.8) 2px, rgba(0,0,0,0.8) 4px)',
            animation: 'terminalScanlines 0.5s linear infinite',
          }}
        />

        {/* Terminal header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-green-500/30 bg-green-500/10 relative z-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer z-30"
              onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch {}; onClose?.() }}
              aria-label="Close"
            >
              <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
            </button>
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
          </div>
          <span className="text-green-500/70 text-xs">game@mausoleum:~/spheres</span>
          <div className="w-6" /> {/* Spacer for balance */}
        </div>

        {/* Title section */}
        <div className="px-6 pt-6 pb-4 border-b border-green-500/20">
          <p className="text-cyan-400 text-xs mb-2">{`// ${t('spheresTutorial.subtitle')}`}</p>
          <h1 
            className="text-green-400 text-2xl sm:text-3xl font-bold"
            style={{ animation: 'glitchTitle 4s ease-in-out infinite' }}
          >
            {`> ${t('spheresTutorial.title').toUpperCase()}`}
          </h1>
        </div>

        <div className="px-6 py-6">
          {/* How to play description */}
          <div className="mb-6">
            <p className="text-yellow-400 text-xs mb-2">{`// instructions`}</p>
            <p className="text-gray-300 text-sm leading-relaxed">
              {t('spheresTutorial.howToPlay')} {t('spheresTutorial.scoringDesc')}
            </p>
          </div>

          {/* Scoring visual — Terminal style cards */}
          <div className="mb-6">
            <p className="text-yellow-400 text-xs mb-3">{`// scoring_matrix`}</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Small sphere */}
              <div 
                className="flex flex-col items-center gap-2 px-3 py-4 rounded border border-cyan-500/40 bg-cyan-500/5"
                style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.1)' }}
              >
                <div 
                  className="w-5 h-5 rounded-full" 
                  style={{ 
                    background: 'linear-gradient(135deg, #22d3ee, #0891b2)', 
                    boxShadow: '0 0 15px rgba(34, 211, 238, 0.6)' 
                  }} 
                />
                <span className="text-[10px] text-cyan-400/60 uppercase tracking-wide">{t('spheresTutorial.small')}</span>
                <span className="text-cyan-400 text-2xl font-bold" style={{ textShadow: '0 0 10px rgba(34, 211, 238, 0.5)' }}>+100</span>
              </div>
              {/* Medium sphere */}
              <div 
                className="flex flex-col items-center gap-2 px-3 py-4 rounded border border-pink-500/40 bg-pink-500/5"
                style={{ boxShadow: '0 0 15px rgba(236, 72, 153, 0.1)' }}
              >
                <div 
                  className="w-7 h-7 rounded-full" 
                  style={{ 
                    background: 'linear-gradient(135deg, #f472b6, #db2777)', 
                    boxShadow: '0 0 15px rgba(244, 114, 182, 0.6)' 
                  }} 
                />
                <span className="text-[10px] text-pink-400/60 uppercase tracking-wide">{t('spheresTutorial.medium')}</span>
                <span className="text-pink-400 text-2xl font-bold" style={{ textShadow: '0 0 10px rgba(236, 72, 153, 0.5)' }}>+30</span>
              </div>
              {/* Large sphere */}
              <div 
                className="flex flex-col items-center gap-2 px-3 py-4 rounded border border-green-500/40 bg-green-500/5"
                style={{ boxShadow: '0 0 15px rgba(34, 197, 94, 0.1)' }}
              >
                <div 
                  className="w-10 h-10 rounded-full" 
                  style={{ 
                    background: 'linear-gradient(135deg, #4ade80, #16a34a)', 
                    boxShadow: '0 0 15px rgba(74, 222, 128, 0.6)' 
                  }} 
                />
                <span className="text-[10px] text-green-400/60 uppercase tracking-wide">{t('spheresTutorial.large')}</span>
                <span className="text-green-400 text-2xl font-bold" style={{ textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>+5</span>
              </div>
            </div>
          </div>

          {/* Warning box - Terminal style */}
          <div 
            className="rounded border-2 border-amber-500/50 bg-amber-500/10 px-4 py-3"
            style={{ boxShadow: '0 0 20px rgba(245, 158, 11, 0.1)' }}
          >
            <p className="text-amber-400 font-bold text-sm mb-1">
              {`⚠ ${t('spheresTutorial.warning').toUpperCase()}`}
            </p>
            <p className="text-amber-300/70 text-xs leading-relaxed">
              {t('spheresTutorial.warningDesc')}
            </p>
          </div>
        </div>

        {/* Footer - Terminal style */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-green-500/30 bg-green-500/5">
          {gameActive ? (
            <button
              type="button"
              onClick={() => {
                try { playSfx('click', { volume: 0.8 }) } catch {}
                onClose?.()
              }}
              className="h-11 px-8 rounded border-2 border-green-500 bg-green-500/20 text-green-400 text-sm font-bold hover:bg-green-500/30 hover:text-green-300 transition-all"
              style={{ textShadow: '0 0 8px rgba(34, 197, 94, 0.5)' }}
            >
              {`> ${t('spheresTutorial.gotIt').toUpperCase()}`}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  try { playSfx('click', { volume: 0.8 }) } catch {}
                  onClose?.()
                }}
                className="h-11 px-6 rounded border border-green-500/40 text-green-500/70 text-sm hover:bg-green-500/10 hover:text-green-400 transition-all"
              >
                {`> ${t('spheresTutorial.notNow').toUpperCase()}`}
              </button>
              <button
                type="button"
                onClick={handlePlay}
                className="h-11 px-8 rounded border-2 border-yellow-500 bg-yellow-500/20 text-yellow-400 text-sm font-bold hover:bg-yellow-500/30 hover:text-yellow-300 transition-all"
                style={{ textShadow: '0 0 8px rgba(234, 179, 8, 0.5)', boxShadow: '0 0 15px rgba(234, 179, 8, 0.2)' }}
              >
                {`> ${t('spheresTutorial.play').toUpperCase()}_`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SphereGameModal
