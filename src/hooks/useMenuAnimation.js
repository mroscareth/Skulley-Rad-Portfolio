import { useState, useRef, useCallback, useEffect } from 'react'

// Two-phase mobile menu overlay animation.
// - `menuOpen` gates the mount (overlay is in the tree).
// - `menuVisible` drives opacity/translate for enter/exit (CSS keyframes + fill-mode).
// On close, we flip `menuVisible` immediately and keep the overlay mounted until
// the longest exit animation finishes (staggered item exits dominate).
//
// Params:
//   itemCount: number of staggered items inside the overlay (for exit duration).
//   config?: tweakable timings.
export default function useMenuAnimation(itemCount, config = {}) {
  const {
    overlayMs = 260,
    itemOutMs = 200,
    itemStepMs = 100,
  } = config

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const timerRef = useRef(null)

  const open = useCallback(() => {
    try { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } } catch { }
    setMenuOpen(true)
    setMenuVisible(true)
  }, [])

  const close = useCallback(() => {
    setMenuVisible(false)
    try { if (timerRef.current) clearTimeout(timerRef.current) } catch { }
    const totalOutMs = itemOutMs + Math.max(0, (itemCount - 1)) * itemStepMs
    timerRef.current = window.setTimeout(() => {
      setMenuOpen(false)
      timerRef.current = null
    }, Math.max(overlayMs, totalOutMs) + 80)
  }, [itemCount, overlayMs, itemOutMs, itemStepMs])

  useEffect(() => () => { try { if (timerRef.current) clearTimeout(timerRef.current) } catch { } }, [])

  return { menuOpen, menuVisible, open, close }
}
