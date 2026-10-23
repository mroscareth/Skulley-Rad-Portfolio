import React, { useEffect, useRef, useState } from 'react'
import { SparklesIcon } from '@heroicons/react/24/solid'

// Skin toggle button — mirrors the cart button layout (ShopCart.jsx) but
// sits on the UPPER-LEFT of the portrait (θ = 60° from vertical, mirrored).
// Only visible once the user has unlocked the gold skin. Clicking flips the
// character between gold and base appearance, persisting via useGoldSkinSystem.
//
// Hit-target 48px (DESIGN.md §4.3). Z order above the portrait glass but
// below modal dialogs.
export default function SkinToggleButton({ unlocked, preference, onToggle, label }) {
  const [buttonPos, setButtonPos] = useState(null)
  const [visible, setVisible] = useState(false)
  const [portraitOpacity, setPortraitOpacity] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const BTN = 48
    const tick = () => {
      try {
        const outer = document.querySelector('[data-portrait-root]')
        const inner = outer?.querySelector(':scope > div')
        if (outer && inner) {
          const r = inner.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            // Mirrored from the cart button: θ=60° on the LEFT curve.
            // x = r.left + W/2*(1 - sin θ), y = r.top + W/2*(1 - cos θ)
            //   = r.left + W * 0.067,      y = r.top + W * 0.25
            const centerX = r.left + r.width * 0.067
            const centerY = r.top  + r.width * 0.25
            const next = {
              top: Math.round(centerY - BTN / 2),
              left: Math.round(centerX - BTN / 2),
            }
            setButtonPos((prev) => (
              prev && prev.top === next.top && prev.left === next.left ? prev : next
            ))
            const op = parseFloat(window.getComputedStyle(outer).opacity)
            setPortraitOpacity(Number.isFinite(op) ? op : 1)
            setVisible(true)
          } else {
            setVisible(false)
          }
        } else {
          setVisible(false)
        }
      } catch { }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  if (!unlocked || !visible) return null

  const isGold = preference === 'gold'
  // Dorada activa = relleno dorado plano con ícono oscuro; base = vidrio con
  // borde blanco. Sin glow (DESIGN.md §14.2).
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={isGold}
      title={label}
      className={`fixed rounded-full w-12 h-12 grid place-items-center border-2 transition-colors ${isGold ? 'bg-[#facc15] border-[#facc15] text-[#0a0510] hover:bg-[#fde047] hover:border-[#fde047]' : 'bg-black/40 hover:bg-black/60 backdrop-blur-xl border-white/25 text-white hover:border-white'}`}
      style={{
        top: `${buttonPos?.top ?? 16}px`,
        left: `${buttonPos?.left ?? 0}px`,
        zIndex: 999995,
        opacity: portraitOpacity,
        pointerEvents: portraitOpacity < 0.1 ? 'none' : 'auto',
        transition: 'opacity 200ms ease-out, background-color 160ms, border-color 160ms',
      }}
    >
      <SparklesIcon className="w-6 h-6" />
    </button>
  )
}
