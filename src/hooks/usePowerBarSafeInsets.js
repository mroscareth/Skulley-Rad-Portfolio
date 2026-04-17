import { useState, useEffect } from 'react'

// Compute safe horizontal insets for the mobile power bar so it doesn't overlap
// with the character portrait (left) or the compact controls cluster (right).
// Measures the actual DOM rects with fallbacks, re-measures for a few frames
// after layout stabilizes, and listens for resize/orientation changes.
//
// Params:
//   isCompactUi: whether mobile/compact UI is active (else returns defaults).
//   compactControlsRef: ref pointing at the right-side controls column.
//   section: re-measure when section changes (portrait moves between sections).
export default function usePowerBarSafeInsets({ isCompactUi, compactControlsRef, section }) {
  const [insets, setInsets] = useState({ left: 16, right: 16 })

  useEffect(() => {
    if (!isCompactUi) return undefined
    const compute = () => {
      try {
        const vw = Math.max(0, window.innerWidth || 0)
        if (!vw) return
        let left = 16
        let right = 16
        const margin = 14
        // Fallbacks (if DOM isn't stable yet): portrait ~ 7.2rem + left-4, controls ~ 48px + right-4
        const rem = (() => {
          try {
            const fs = parseFloat((window.getComputedStyle?.(document.documentElement)?.fontSize) || '')
            return (isFinite(fs) && fs > 0) ? fs : 16
          } catch { return 16 }
        })()
        const portraitFallbackRight = 16 + Math.round(rem * 7.2)
        const controlsFallbackLeft = vw - (16 + 48)
        // Portrait (left)
        try {
          const portraitEl = document.querySelector('[data-portrait-root]')
          if (portraitEl && typeof portraitEl.getBoundingClientRect === 'function') {
            const r = portraitEl.getBoundingClientRect()
            if (isFinite(r.right)) left = Math.max(left, Math.round(r.right + margin))
          } else {
            left = Math.max(left, Math.round(portraitFallbackRight + margin))
          }
        } catch { }
        // Compact controls (right)
        try {
          const controlsEl = compactControlsRef?.current
          if (controlsEl && typeof controlsEl.getBoundingClientRect === 'function') {
            const r = controlsEl.getBoundingClientRect()
            if (isFinite(r.left)) right = Math.max(right, Math.round((vw - r.left) + margin))
          } else {
            right = Math.max(right, Math.round((vw - controlsFallbackLeft) + margin))
          }
        } catch { }
        // Clamp: don't let left+right consume all the width
        const maxTotal = Math.max(0, vw - 60)
        if (left + right > maxTotal) {
          const overflow = (left + right) - maxTotal
          left = Math.max(16, Math.round(left - overflow / 2))
          right = Math.max(16, Math.round(right - overflow / 2))
        }
        setInsets((p) => ((p.left === left && p.right === right) ? p : { left, right }))
      } catch { }
    }
    // Wait for layout and re-measure several frames for stabilized portrait/controls
    let rafId = 0
    let n = 0
    const tick = () => {
      compute()
      n += 1
      if (n < 24) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(() => requestAnimationFrame(tick))
    window.addEventListener('resize', compute)
    window.addEventListener('orientationchange', compute)
    return () => {
      try { cancelAnimationFrame(rafId) } catch { }
      window.removeEventListener('resize', compute)
      window.removeEventListener('orientationchange', compute)
    }
  }, [isCompactUi, section, compactControlsRef])

  return insets
}
