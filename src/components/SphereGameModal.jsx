import React, { useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

// SphereGameModal — las reglas del juego de esferas de Argus. Modal estándar
// del sitio (.site-modal) con la anatomía de Mi Cuenta y de la card de la
// tienda: nombre + una línea de detalle arriba, el contenido en medio y una
// barra fija abajo con la acción de color al final. El acento es el amarillo
// de Argus. Los orbes neón se
// quedan con su bloom: son la "foto del producto" (el asset real del juego),
// no decoración del panel.

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

const SCORE_ROWS = [
  { key: 'small', color: '#00bfff', size: 26, pts: '+100' },
  { key: 'medium', color: '#e600ff', size: 38, pts: '+30' },
  { key: 'large', color: '#39ff14', size: 50, pts: '+5' },
]

function SphereGameModal({ t, open, onClose, gameActive = false, onStartGame }) {
  const { lang } = useLanguage()
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
  const steps = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6']

  return (
    <div
      className="fixed inset-0 z-modal flex items-stretch sm:items-center justify-center p-0 sm:p-4 lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={t('spheresTutorial.dialogAria')}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      {/* Backdrop — §6.1: con /70 el blur sí se nota */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      <div className="site-modal site-modal--fit text-white" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 z-[10] w-11 h-11 grid place-items-center rounded-full border-2 border-white/40 bg-black/50 text-white hover:bg-white hover:text-black hover:border-white active:scale-90 transition-all"
          aria-label={lang === 'es' ? 'Cerrar' : 'Close'}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <header className="px-5 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-5 border-b-2 border-white/10 pr-16">
          <h2 className="shop-detail__title">{t('spheresTutorial.title')}</h2>
          <p className="shop-meta shop-meta--lg mt-1">{t('spheresTutorial.subtitle')}</p>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 sm:px-8 lg:px-10 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-10 lg:gap-14 items-start">
            {/* Cómo se juega: pasos numerados (H10, ayuda donde surge la duda). */}
            <section aria-labelledby="sphere-how">
              <h3 id="sphere-how" className="text-sm font-bold text-white mb-4">{t('spheresTutorial.howTitle')}</h3>
              <ol className="space-y-4">
                {steps.map((key, i) => (
                  <li key={key} className="flex gap-4">
                    <span className="argus-display shrink-0 w-8 h-8 grid place-items-center rounded-full bg-[#f5ff00] text-[#0a0510] text-base leading-none" aria-hidden>
                      {i + 1}
                    </span>
                    <p className="text-white/80 text-[0.9375rem] sm:text-base leading-relaxed pt-0.5">{t(`spheresTutorial.${key}`)}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="sphere-points">
              <h3 id="sphere-points" className="text-sm font-bold text-white mb-1">{t('spheresTutorial.scoring')}</h3>
              <p className="text-white/65 text-sm leading-relaxed mb-5">{t('spheresTutorial.scoringDesc')}</p>
              {/* Las tres esferas en un renglón, separadas por divisores: sin
                  tarjetas (nada de caja dentro de caja). */}
              <ul className="grid grid-cols-3 divide-x-2 divide-white/10 border-y-2 border-white/10">
                {SCORE_ROWS.map(({ key, color, size, pts }) => (
                  <li key={key} className="flex flex-col items-center gap-3 py-5">
                    <div className="h-12 flex items-center justify-center">
                      <NeonOrbIcon color={color} size={size} />
                    </div>
                    <span className="text-sm text-white/60">{t(`spheresTutorial.${key}`)}</span>
                    <span className="argus-display text-[2rem] leading-none" style={{ color }}>{pts}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Warning — la pleca amarilla con el ojo de Argus, al fondo y a todo
              lo ancho: cierra las reglas antes de la barra de la acción. */}
          <div className="mt-8 flex items-center gap-5 rounded-2xl bg-[#f5ff00] text-[#0a0510] px-5 sm:px-6 py-4">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <ArgusEye />
              <span className="argus-display text-[1.3rem] leading-none">{t('spheresTutorial.warning')}</span>
            </div>
            <p className="font-semibold text-sm sm:text-[0.9375rem] leading-snug">
              {t('spheresTutorial.warningDesc')}
            </p>
          </div>
        </div>

        {/* Barra fija con la acción de color al final, a la derecha
            (DESIGN.md §4.6). */}
        <div className="shrink-0 border-t-2 border-white/10 px-5 sm:px-8 lg:px-10 py-4 flex items-center justify-end gap-4">
          <div className="flex items-center gap-3 shrink-0">
            {gameActive ? (
              <button
                type="button"
                onClick={handleClose}
                className="shop-btn argus-btn--primary min-h-[44px] px-6 text-xs"
              >
                {t('spheresTutorial.gotIt')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="shop-btn shop-btn--ghost min-h-[44px] px-5 text-xs"
                >
                  {t('spheresTutorial.notNow')}
                </button>
                <button
                  type="button"
                  onClick={handlePlay}
                  className="shop-btn argus-btn--primary min-h-[44px] px-6 text-xs"
                >
                  {t('spheresTutorial.play')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SphereGameModal
