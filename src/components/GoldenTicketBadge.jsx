import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Halo dorado arriba del retrato — visible solo cuando el user tiene un
// golden ticket activo sin quemar. Gira 360° en Y vía CSS 3D (sin Canvas
// extra). Click → abre el cart para que vea el chip del descuento.
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
    const BADGE_W = 88
    const BADGE_H = 54
    const OFFSET_ABOVE_PORTRAIT = 16

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
      className="fixed golden-ticket-badge"
      style={{
        top: pos?.top ?? 16,
        left: pos?.left ?? 0,
        width: 88,
        height: 54,
        perspective: '600px',
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
      <div className="golden-ticket-spinner">
        {/* FRONT — estilo ticket clásico */}
        <div className="golden-ticket-face golden-ticket-front">
          <div className="golden-ticket-serial golden-ticket-serial-l">35%</div>
          <div className="golden-ticket-center">
            <span className="golden-ticket-word">TICKET</span>
          </div>
          <div className="golden-ticket-serial golden-ticket-serial-r">35%</div>
        </div>
        {/* BACK — estrella dorada */}
        <div className="golden-ticket-face golden-ticket-back">
          <span className="golden-ticket-star">★</span>
        </div>
      </div>
    </button>
  )

  return typeof document !== 'undefined' ? createPortal(badge, document.body) : null
}
