import React, { useEffect } from 'react'
import { playSfx } from '../lib/sfx.js'

// SphereGameModal — instrucciones del juego de esferas de Argus. Lenguaje §14
// (editorial + toon, como la Store) con el acento amarillo de Argus: panel
// plano con borde sólido, display Luckiest Guy, cero glow en el chrome. Los
// orbes neón se quedan con su bloom: son la "foto del producto" (el asset
// real del juego), no decoración del panel.

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

// Ojo toon animado del warning (ver .argus-eye en index.css). Guiño al nombre
// del NPC: Argus Panoptes, el que todo lo ve.
// El parpadeo es un PÁRPADO REAL: una forma amarilla (color del slab, o sea
// "piel") que BAJA sobre el ojo, recortada a la almendra por clipPath, con su
// borde curvo como pliegue. La pupila nunca se escala — el primer intento
// hacía squash del grupo entero y la pupila encogía con él (se veía fatal).
function ArgusEye({ width = 52 }) {
  const clipId = React.useId()
  return (
    <svg className="argus-eye" viewBox="0 0 64 40" style={{ width, height: width * 0.65 }} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d="M4 20 Q 20 3 32 3 Q 44 3 60 20 Q 44 37 32 37 Q 20 37 4 20 Z" />
        </clipPath>
      </defs>
      {/* esclerótica */}
      <path
        d="M4 20 Q 20 3 32 3 Q 44 3 60 20 Q 44 37 32 37 Q 20 37 4 20 Z"
        fill="#fff"
      />
      {/* pupila — solo mira alrededor, jamás se deforma */}
      <circle className="argus-eye-pupil" cx="32" cy="20" r="8" fill="#0a0510" />
      {/* párpado superior: baja, cubre, sube. El borde inferior curvo hace de
          pliegue; el resto de su contorno queda fuera del clip. */}
      <g clipPath={`url(#${clipId})`}>
        <path
          className="argus-eye-lid"
          d="M -8 -24 L 72 -24 L 72 24 Q 52 31 32 31 Q 12 31 -8 24 Z"
          fill="#f5ff00" stroke="#0a0510" strokeWidth="4" strokeLinejoin="round"
        />
      </g>
      {/* contorno de la almendra SIEMPRE encima (párpado incluido) */}
      <path
        d="M4 20 Q 20 3 32 3 Q 44 3 60 20 Q 44 37 32 37 Q 20 37 4 20 Z"
        fill="none" stroke="#0a0510" strokeWidth="4" strokeLinejoin="round"
      />
    </svg>
  )
}

// Última palabra en el acento amarillo (misma firma que el diálogo de Argus).
// Duplicado a propósito: importarlo de ZoidianDialog arrastraría R3F al
// bundle eager — este modal es import estático de App.
function AccentLastWord({ text }) {
  const idx = text.lastIndexOf(' ')
  if (idx < 0) return <span className="text-[#f5ff00]">{text}</span>
  return (
    <>
      {text.slice(0, idx + 1)}
      <span className="text-[#f5ff00]">{text.slice(idx + 1)}</span>
    </>
  )
}

const SCORE_ROWS = [
  { key: 'small', color: '#00bfff', size: 26, pts: '+100' },
  { key: 'medium', color: '#e600ff', size: 38, pts: '+30' },
  { key: 'large', color: '#39ff14', size: 50, pts: '+5' },
]

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
  const handleClose = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
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
      {/* Backdrop — §6.1: con /70 el blur sí se nota */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      {/* Panel §14 — mismo ancho que el diálogo de Argus */}
      <div className="argus-panel relative w-[min(640px,94vw)] max-h-[90vh] overflow-y-auto modal-scroll px-7 sm:px-10 pt-9 pb-9">
        {/* Cerrar */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-5 text-white/35 hover:text-white text-2xl leading-none transition-colors"
          aria-label="Close"
        >
          ×
        </button>

        {/* Título + subtítulo en display */}
        <h1 className="argus-display text-white text-4xl sm:text-5xl mb-2">
          <AccentLastWord text={t('spheresTutorial.title')} />
        </h1>
        <p className="argus-display text-white/50 text-xl sm:text-2xl mb-6">
          {t('spheresTutorial.subtitle')}
        </p>

        {/* Cómo se juega */}
        <p className="text-white/75 text-base sm:text-[1.0625rem] leading-relaxed mb-7">
          {t('spheresTutorial.howToPlay')} {t('spheresTutorial.scoringDesc')}
        </p>

        {/* Puntuación — cards toon planas; el bloom vive en el orbe */}
        <div className="grid grid-cols-3 gap-3 sm:gap-3.5 mb-7">
          {SCORE_ROWS.map(({ key, color, size, pts }) => (
            <div
              key={key}
              className="flex flex-col items-center gap-3 px-3 pt-6 pb-5 rounded-[1.25rem] border-2 border-white/[0.12] bg-[#0d0714]"
            >
              <div className="h-12 flex items-center justify-center">
                <NeonOrbIcon color={color} size={size} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
                {t(`spheresTutorial.${key}`)}
              </span>
              <span className="argus-display text-[2.125rem] leading-none" style={{ color }}>
                {pts}
              </span>
            </div>
          ))}
        </div>

        {/* Warning — slab amarillo plano con el ojo de Argus */}
        <div className="flex items-center gap-4 rounded-2xl bg-[#f5ff00] text-[#0a0510] px-5 py-4 mb-8">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <ArgusEye />
            <span className="argus-display text-[1.3rem] leading-none">{t('spheresTutorial.warning')}</span>
          </div>
          <p className="font-semibold text-sm leading-snug">
            {t('spheresTutorial.warningDesc')}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-3 flex-wrap">
          {gameActive ? (
            <button
              type="button"
              onClick={handleClose}
              className="shop-btn argus-btn--primary h-12 px-8 text-sm"
            >
              {t('spheresTutorial.gotIt')}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePlay}
                className="shop-btn argus-btn--primary h-12 px-8 text-sm"
              >
                {t('spheresTutorial.play')}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="shop-btn shop-btn--ghost h-12 px-6 text-xs"
              >
                {t('spheresTutorial.notNow')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SphereGameModal
