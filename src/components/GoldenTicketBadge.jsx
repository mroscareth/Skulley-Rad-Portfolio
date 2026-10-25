import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Boleto dorado arriba del retrato — visible solo cuando el user tiene un
// golden ticket activo sin quemar. Click → abre el cart para que vea el chip
// del descuento.
//
// Se posiciona midiendo el retrato en cada frame (raf) igual que ShopCart
// y SkinToggleButton para mantenerse fijo aunque se scrollee o resizee.
// Clona la opacity computada del portrait para fade-sync con la UI.
export default function GoldenTicketBadge({ active, onClick, lang = 'en' }) {
  const [pos, setPos] = useState(null)
  const [visible, setVisible] = useState(false)
  const [portraitOpacity, setPortraitOpacity] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const BADGE_W = 110
    const BADGE_H = 64
    const OFFSET_ABOVE_PORTRAIT = 14

    const tick = () => {
      try {
        const outer = document.querySelector('[data-portrait-root]')
        const inner = outer?.querySelector(':scope > div')
        if (outer && inner) {
          const r = inner.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            const centerX = r.left + r.width / 2
            const topY = r.top - BADGE_H - OFFSET_ABOVE_PORTRAIT
            const next = {
              top: Math.round(topY),
              left: Math.round(centerX - BADGE_W / 2),
            }
            setPos((prev) =>
              prev && prev.top === next.top && prev.left === next.left ? prev : next,
            )
            const op = parseFloat(window.getComputedStyle(outer).opacity)
            setPortraitOpacity(Number.isFinite(op) ? op : 1)
            setVisible(true)
          } else {
            setVisible(false)
          }
        } else {
          setVisible(false)
        }
      } catch { /* ignore */ }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  if (!active) return null

  const tr = {
    aria: lang === 'es' ? 'Golden Ticket activo — 35% de descuento' : 'Golden Ticket active — 35% off',
    title: lang === 'es' ? 'Tienes un Golden Ticket (35% OFF)' : 'You have a Golden Ticket (35% OFF)',
  }

  const badge = (
    <button
      type="button"
      onClick={onClick}
      aria-label={tr.aria}
      title={tr.title}
      className="fixed"
      style={{
        top: pos?.top ?? 16,
        left: pos?.left ?? 0,
        width: 110,
        height: 64,
        zIndex: 999994,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        opacity: visible ? portraitOpacity : 0,
        pointerEvents: portraitOpacity < 0.1 ? 'none' : 'auto',
        transition: 'opacity 200ms ease-out',
      }}
    >
      <GoldenTicketArt className="golden-ticket--idle w-full" />
    </button>
  )

  return typeof document !== 'undefined' ? createPortal(badge, document.body) : null
}

// El boleto dorado, en el lenguaje toon del sitio (DESIGN.md §7.8, §14.2):
// dorado PLANO con una banda de sombra de corte duro (el banding del
// cel-shading) y una franja de brillo, contorno de tinta grueso como el de
// Skulley, letras en Luckiest Guy, talón perforado con el porcentaje y un
// destello toon en la esquina, y un borde blanco de sticker por fuera para
// que despegue sobre fondo oscuro. Sin degradados, sin resplandor. SVG: escala
// limpio a cualquier tamaño (`className` le da el ancho).
// Lo usan este badge y el trato de Argus; `golden-ticket--idle` le da un
// vaivén suave, como un boleto que alguien sostiene.
//
// Hay dos niveles (game-tickets.php): Golden (35 %) y Silver (10 %). Es el
// mismo boleto con otro metal: plano, misma banda de sombra dura y misma
// franja de brillo, solo cambia la paleta y la palabra.
const TICKET_PATH = 'M16 4 H149 A9 9 0 0 0 167 4 H204 A12 12 0 0 1 216 16 V104 A12 12 0 0 1 204 116 H167 A9 9 0 0 0 149 116 H16 A12 12 0 0 1 4 104 V16 A12 12 0 0 1 16 4 Z'
const SPARKLE = 'M0 -11 C2 -3 3 -2 11 0 C3 2 2 3 0 11 C-2 3 -3 2 -11 0 C-3 -2 -2 -3 0 -11 Z'
const INK = '#0a0510'

const TICKET_PALETTES = {
  gold: { word: 'GOLDEN', base: '#FFC21A', shade: '#E89D00', shine: '#FFF2B0' },
  silver: { word: 'SILVER', base: '#DCE2EA', shade: '#A3ADBB', shine: '#FFFFFF' },
}

export function GoldenTicketArt(props) {
  return <TicketArt tier="gold" {...props} />
}

export function SilverTicketArt(props) {
  return <TicketArt tier="silver" pct={10} {...props} />
}

export function TicketArt({ tier = 'gold', pct = 35, className = '', label }) {
  const clipId = useId()
  const p = TICKET_PALETTES[tier] || TICKET_PALETTES.gold
  return (
    <svg
      viewBox="-4 -4 228 128"
      className={`golden-ticket ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}><path d={TICKET_PATH} /></clipPath>
      </defs>
      {/* Borde de sticker: sobre los fondos oscuros del sitio la tinta sola
          se pierde; el blanco por fuera lo despega sin usar resplandor. */}
      <path d={TICKET_PATH} fill="none" stroke="#fff" strokeWidth="13" strokeLinejoin="round" />
      <g clipPath={`url(#${clipId})`}>
        <rect width="220" height="120" fill={p.base} />
        {/* Banda de sombra con corte duro (curva: el boleto se arquea). */}
        <path d="M0 84 Q110 70 220 84 V120 H0 Z" fill={p.shade} />
        {/* El talón, un tono abajo. */}
        <rect x="158" width="62" height="120" fill={INK} opacity="0.1" />
        {/* Brillo: franja dura arriba, como el rim del personaje. */}
        <path d="M18 18 Q70 9 132 12" stroke={p.shine} strokeWidth="6" strokeLinecap="round" fill="none" />
      </g>
      {/* Marco interior, grabado */}
      <rect x="16" y="16" width="130" height="88" rx="8" fill="none" stroke={INK} strokeWidth="2" opacity="0.35" />
      {/* Perforación del talón */}
      <line x1="158" y1="22" x2="158" y2="98" stroke={INK} strokeWidth="4" strokeDasharray="0.1 9" strokeLinecap="round" />
      {/* Contorno de tinta */}
      <path d={TICKET_PATH} fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <text x="81" y="52" textAnchor="middle" className="golden-ticket__word" fontSize="21">{p.word}</text>
      <text x="81" y="90" textAnchor="middle" className="golden-ticket__word" fontSize="35">TICKET</text>
      <text
        x="0"
        y="0"
        transform="translate(190 60) rotate(-90)"
        textAnchor="middle"
        dominantBaseline="central"
        className="golden-ticket__word"
        fontSize="28"
      >
        {pct}%
      </text>
      {/* Destello toon */}
      <path d={SPARKLE} transform="translate(144 22)" fill="#fff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}
