import React from 'react'
import { playSfx } from '../lib/sfx.js'
import { sectionColors } from '../lib/appHelpers.js'

// "Cross the portal" CTA shown when the player is near a portal in HOME.
// Pure presentational — App.jsx owns the state and passes an `onEnter` handler
// that runs the preload + transition sequence.
export default function PortalCTA({
  show,
  compact,
  nearPortalId,
  uiHintPortalId,
  ctaLoading,
  ctaProgress,
  ctaColor,
  t,
  onEnter,
}) {
  if (!show) return null
  const targetId = nearPortalId || uiHintPortalId
  const sectionColor = sectionColors[targetId] || '#00bfff'
  const ctaLabel = (targetId === 'section3') ? t('cta.comingSoon') : t('cta.crossPortal')
  return (
    <div
      // Always centered on screen (like mobile) at all sizes
      className="pointer-events-none fixed inset-0 z-[300] grid place-items-center"
    >
      <button
        type="button"
        onClick={onEnter}
        onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
        className={`pointer-events-auto relative overflow-hidden rounded-full bg-black/60 backdrop-blur-xl text-white font-bold uppercase tracking-wide hover:translate-y-[-2px] active:translate-y-[0] transition-transform font-marquee crt-scanlines ${compact ? '' : 'scale-150'} w-[350px] h-[60px] px-[30px] flex items-center justify-center ${targetId ? 'animate-portal-glow' : ''}`}
        style={{
          '--portal-color': sectionColor,
          fontFamily: '\'Luckiest Guy\', Archivo Black, system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif',
          animation: `${targetId ? 'slideup 220ms ease-out forwards' : 'slideup-out 220ms ease-in forwards'}`,
          border: `2px solid ${sectionColor}44`,
          boxShadow: `0 0 24px ${sectionColor}33, 0 8px 32px rgba(0,0,0,0.4)`,
          textShadow: `0 0 12px ${sectionColor}88`,
        }}
      >
        {/* Preloader background as button fill */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 z-0 rounded-full"
          style={{
            width: `${ctaLoading ? ctaProgress : 0}%`,
            backgroundColor: ctaColor,
            opacity: 0.4,
            transition: 'width 150ms ease-out',
          }}
        />
        <span className="relative z-[10] w-full flex items-center justify-center whitespace-nowrap text-[34px] leading-[1.2] pt-[4px] pb-[4px]">
          {ctaLabel}
        </span>
      </button>
    </div>
  )
}
