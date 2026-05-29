import React, { useEffect } from 'react'
import { playSfx } from '../lib/sfx.js'

// NeonOrbIcon — emula el look del orb in-game (cell-shaded, halo bloom,
// outline negro) usando CSS puro. Sin Canvas/WebGL → barato + escala con DPI.
// El radial-gradient con stops escalonados simula las 3 bandas de
// applyNeonOrb (centro caliente → mid → rim oscuro). El box-shadow externo
// reproduce el Bloom del post-FX. El border negro es el inverted-hull outline.
function NeonOrbIcon({ color = '#39ff14', size = 40 }) {
  const h = color.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const dim = (k) => `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`
  const bright = `rgb(${Math.min(255, r + 70)}, ${Math.min(255, g + 70)}, ${Math.min(255, b + 70)})`
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        // 3 bandas cell-shaded: core brillante → mid color → rim oscuro.
        background: `radial-gradient(circle at 36% 32%,
          ${bright} 0%, ${bright} 16%,
          ${color} 17%, ${color} 52%,
          ${dim(0.55)} 53%, ${dim(0.55)} 86%,
          ${dim(0.3)} 87%, ${dim(0.3)} 100%
        )`,
        // Halo bloom — matches el post-FX Bloom de los orbs reales.
        boxShadow: `0 0 ${Math.round(size * 0.35)}px ${color}cc,
                    0 0 ${Math.round(size * 0.7)}px ${color}77,
                    0 0 ${Math.round(size * 1.1)}px ${color}33`,
        // Outline negro = inverted-hull del orb in-game.
        border: '2px solid #000',
      }}
    />
  )
}

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
    try { playSfx('click', { volume: 0.8 }) } catch { }
    try { onStartGame?.() } catch { }
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
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
        @keyframes terminalGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), inset 0 0 60px rgba(59, 130, 246, 0.05); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.4), inset 0 0 80px rgba(59, 130, 246, 0.08); }
        }
        @keyframes glitchTitle {
          0%, 100% { text-shadow: 0 0 10px rgba(59, 130, 246, 0.8); }
          25% { text-shadow: -2px 0 rgba(255, 0, 128, 0.8), 2px 0 rgba(0, 255, 255, 0.8); }
          50% { text-shadow: 0 0 20px rgba(59, 130, 246, 1); }
          75% { text-shadow: 2px 0 rgba(255, 0, 128, 0.8), -2px 0 rgba(0, 255, 255, 0.8); }
        }
      `}</style>

      {/* Modal content - Terminal style */}
      <div
        className="relative w-[min(680px,94vw)] max-h-[90vh] overflow-y-auto modal-scroll rounded-lg crt-scanlines"
        style={{
          backgroundColor: '#0a0a14',
          border: '2px solid #3b82f6',
          fontFamily: '"Cascadia Code", monospace',
          animation: 'terminalGlow 3s ease-in-out infinite',
        }}
      >

        {/* Terminal header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/30 bg-blue-500/10 relative z-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer z-30"
              onClick={() => { try { playSfx('click', { volume: 0.8 }) } catch { }; onClose?.() }}
              aria-label="Close"
            >
              <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
            </button>
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
          </div>
          <span className="text-blue-500/70 text-xs">M.A.D.R.E.@mausoleum:~/spheres</span>
          <div className="w-6" /> {/* Spacer for balance */}
        </div>

        {/* Title section */}
        <div className="px-6 pt-6 pb-4 border-b border-blue-500/20">
          <p className="text-cyan-400 text-xs mb-2">{`// ${t('spheresTutorial.subtitle')}`}</p>
          <h1
            className="text-blue-400 text-2xl sm:text-3xl font-bold"
            style={{ animation: 'glitchTitle 4s ease-in-out infinite' }}
          >
            {`> ${t('spheresTutorial.title').toUpperCase()}`}
          </h1>
        </div>

        <div className="px-6 py-6">
          {/* How to play description */}
          <div className="mb-6">
            <p className="text-blue-400/70 text-xs mb-2">{`// instructions`}</p>
            <p className="text-gray-300 text-sm leading-relaxed">
              {t('spheresTutorial.howToPlay')} {t('spheresTutorial.scoringDesc')}
            </p>
          </div>

          {/* Scoring visual — orbs neón estilo in-game (cell-shaded + bloom) */}
          <div className="mb-6">
            <p className="text-blue-400/70 text-xs mb-3">{`// scoring_matrix`}</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Small — cyan (work). Mayor score porque chico = más difícil de empujar. */}
              <div
                className="flex flex-col items-center gap-3 px-3 py-5 rounded border border-cyan-500/40 bg-cyan-500/5"
                style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.1)' }}
              >
                <div className="h-12 flex items-center justify-center">
                  <NeonOrbIcon color="#00bfff" size={26} />
                </div>
                <span className="text-[10px] text-cyan-400/60 uppercase tracking-wide">{t('spheresTutorial.small')}</span>
                <span className="text-cyan-400 text-2xl font-bold" style={{ textShadow: '0 0 10px rgba(34, 211, 238, 0.5)' }}>+100</span>
              </div>
              {/* Medium — magenta (quests). */}
              <div
                className="flex flex-col items-center gap-3 px-3 py-5 rounded border border-pink-500/40 bg-pink-500/5"
                style={{ boxShadow: '0 0 15px rgba(236, 72, 153, 0.1)' }}
              >
                <div className="h-12 flex items-center justify-center">
                  <NeonOrbIcon color="#e600ff" size={38} />
                </div>
                <span className="text-[10px] text-pink-400/60 uppercase tracking-wide">{t('spheresTutorial.medium')}</span>
                <span className="text-pink-400 text-2xl font-bold" style={{ textShadow: '0 0 10px rgba(236, 72, 153, 0.5)' }}>+30</span>
              </div>
              {/* Large — green (about). Menor score porque grande = blanco fácil. */}
              <div
                className="flex flex-col items-center gap-3 px-3 py-5 rounded border border-green-500/40 bg-green-500/5"
                style={{ boxShadow: '0 0 15px rgba(57, 255, 20, 0.1)' }}
              >
                <div className="h-12 flex items-center justify-center">
                  <NeonOrbIcon color="#39ff14" size={50} />
                </div>
                <span className="text-[10px] text-green-400/60 uppercase tracking-wide">{t('spheresTutorial.large')}</span>
                <span className="text-green-400 text-2xl font-bold" style={{ textShadow: '0 0 10px rgba(57, 255, 20, 0.5)' }}>+5</span>
              </div>
            </div>
          </div>

          {/* Warning box - Terminal style */}
          <div
            className="rounded border-2 border-red-500/50 bg-red-500/10 px-4 py-3"
            style={{ boxShadow: '0 0 20px rgba(239, 68, 68, 0.1)' }}
          >
            <p className="text-red-400 font-bold text-sm mb-1">
              {`⚠ ${t('spheresTutorial.warning').toUpperCase()}`}
            </p>
            <p className="text-red-300/70 text-xs leading-relaxed">
              {t('spheresTutorial.warningDesc')}
            </p>
          </div>
        </div>

        {/* Footer - Terminal style */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-blue-500/30 bg-blue-500/5">
          {gameActive ? (
            <button
              type="button"
              onClick={() => {
                try { playSfx('click', { volume: 0.8 }) } catch { }
                onClose?.()
              }}
              className="h-11 px-8 rounded border-2 border-blue-400 bg-blue-500 text-black text-sm font-bold hover:bg-blue-400 active:scale-95 transition-all"
              style={{ textShadow: 'none', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' }}
            >
              {`> ${t('spheresTutorial.gotIt').toUpperCase()}`}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  try { playSfx('click', { volume: 0.8 }) } catch { }
                  onClose?.()
                }}
                className="h-11 px-6 rounded border border-blue-700 bg-transparent text-blue-500 text-sm hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400 transition-all"
              >
                {`> ${t('spheresTutorial.notNow').toUpperCase()}`}
              </button>
              <button
                type="button"
                onClick={handlePlay}
                className="h-11 px-8 rounded border-2 border-blue-400 bg-blue-500 text-black text-sm font-bold hover:bg-blue-400 active:scale-95 transition-all"
                style={{ textShadow: 'none', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' }}
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
