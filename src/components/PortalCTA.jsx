import React, { useEffect, useMemo, useRef, useState } from 'react'
import { playSfx } from '../lib/sfx.js'
import { sectionColors } from '../lib/appHelpers.js'
import { hash21, runeSegments } from '../lib/runes.js'
import { ALPHABET_MAP } from '../lib/runeAlphabet.js'

// RuneGlyph: SVG inline que dibuja una runa procedural. Mismo patrón que
// las runas del disco interior del portal — 4 líneas en grid 4x4.
function RuneGlyph({ seed, color = 'currentColor' }) {
  const segs = useMemo(() => runeSegments(seed), [seed])
  // 30x30 viewBox con padding interno de 4 → endpoints viven en [4, 26].
  const mapX = (v) => 4 + v * 22
  const mapY = (v) => 4 + v * 22
  return (
    <svg
      viewBox="0 0 30 30"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{
        width: '0.72em',
        height: '1em',
        display: 'inline-block',
        verticalAlign: '-0.14em',
        overflow: 'visible',
      }}
    >
      {segs.map((s, i) => (
        <line
          key={i}
          x1={mapX(s.x1)} y1={mapY(s.y1)}
          x2={mapX(s.x2)} y2={mapY(s.y2)}
          stroke={color}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

// useRuneResolve: cada letra del texto tiene UNA runa base estable derivada
// de su charCode + posición. La runa ocasionalmente se "glitchea" (salta a
// otra forma brevemente, ~60ms, cada ~300ms con ~20% probabilidad). Al
// resolverse, la runa es reemplazada por la letra final. Esto da una lectura
// mucho más calmada que el scramble continuo — ves un glifo estable por
// posición con bursts esporádicos de glitch.
function useRuneResolve(text, { revealMs = 1200, glitchPeriodMs = 300, key = '' } = {}) {
  const initialItems = useMemo(() =>
    Array.from(text || '').map((c) => ({ type: 'char', value: c })),
    [text]
  )
  const [items, setItems] = useState(initialItems)
  const rafRef = useRef(null)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    const start = performance.now()
    const chars = Array.from(text || '')
    const n = chars.length
    // Base seed por posición. Si la letra existe en el alfabeto, usamos SU
    // seed canónico (el mismo que aparece en el Codex y en la runa central
    // de los portales) → las runas del CTA "son" las letras del mensaje.
    // Chars no-alfa (números, puntuación, espacios con carácter extraño)
    // caen al hash posicional.
    const keyOffset = Array.from(String(key)).reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const baseSeeds = chars.map((c, i) => {
      const entry = ALPHABET_MAP[c.toUpperCase()]
      if (entry) return entry.seed
      return (c.charCodeAt(0) * 17 + i * 41 + i * i * 5 + keyOffset * 13) % 10000
    })
    const tick = () => {
      const now = performance.now()
      const elapsed = now - start
      const progress = Math.min(1, elapsed / revealMs)
      const revealed = Math.floor(progress * n)
      const gTick = Math.floor(elapsed / glitchPeriodMs)
      const gPhase = (elapsed % glitchPeriodMs) / glitchPeriodMs
      const out = new Array(n)
      for (let i = 0; i < n; i++) {
        if (i < revealed) {
          out[i] = { type: 'char', value: chars[i] }
        } else if (chars[i] === ' ') {
          out[i] = { type: 'char', value: ' ' }
        } else {
          // Glitch: 20% de probabilidad por tick, dura 20% del período.
          // Durante glitch, el seed jitterea → la runa salta a otra.
          const gRoll = hash21(gTick, i * 7 + 3.0)
          const gActive = gRoll > 0.80 && gPhase < 0.20
          const seed = gActive
            ? baseSeeds[i] + Math.floor(hash21(gTick, i * 11 + 7.0) * 800)
            : baseSeeds[i]
          out[i] = { type: 'rune', seed }
        }
      }
      setItems(out)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [text, revealMs, glitchPeriodMs, key])
  return items
}

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
  // Portal bloqueado (ej. section6 sin ofrenda): muestra "?" y en click
  // llama a onRejected en vez de onEnter → castigo visual, no transición.
  locked = false,
  onRejected,
}) {
  if (!show) return null
  const targetId = nearPortalId || uiHintPortalId
  const sectionColor = sectionColors[targetId] || '#00bfff'
  // Label: locked → "?", normal → "cross the portal" (i18n).
  const ctaLabel = locked ? (t('cta.locked') || '?') : t('cta.crossPortal')
  // En locked no animamos el resolve: mostrar "?" estático, no runas.
  const items = useRuneResolve(ctaLabel, {
    revealMs: locked ? 0 : 1200,
    glitchPeriodMs: 300,
    key: (targetId || 'none') + (locked ? ':locked' : ''),
  })
  const handleClick = () => {
    if (locked) {
      try { onRejected?.() } catch {}
      return
    }
    try { onEnter?.() } catch {}
  }
  return (
    <div
      // Always centered on screen (like mobile) at all sizes
      className="pointer-events-none fixed inset-0 z-[300] grid place-items-center"
    >
      <button
        type="button"
        onClick={handleClick}
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
          {items.map((it, i) => (
            it.type === 'char'
              ? <span key={i}>{it.value === ' ' ? ' ' : it.value}</span>
              : <RuneGlyph key={i} seed={it.seed} />
          ))}
        </span>
      </button>
    </div>
  )
}
