import { useEffect } from 'react'

// Closes a popover-ish thing on Escape or pointerdown outside the provided refs.
// No-op while `open` is false, so you can safely attach it regardless of state.
//
// Usage:
//   useOutsideClickClose(socialsOpen, setSocialsOpen, [socialsWrapMobileRef, socialsWrapDesktopRef])
export default function useOutsideClickClose(open, onClose, refs) {
  useEffect(() => {
    if (!open) return undefined
    const close = () => { try { onClose(false) } catch { } }
    const onKey = (e) => {
      try { if (e.key === 'Escape') close() } catch { }
    }
    const onDown = (e) => {
      try {
        const target = e?.target
        for (const r of refs || []) {
          const el = r?.current
          if (el && typeof el.contains === 'function' && el.contains(target)) return
        }
        close()
      } catch { }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
