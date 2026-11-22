import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

// ── Context ──
const GameToastContext = createContext(null)

let toastIdCounter = 0

/**
 * Toast provider — wrap the app to enable useGameToast().
 *
 * Toast types: 'info' | 'success' | 'portal'
 * Each toast: { id, message, type, icon?, borderColor? }
 */
export function GameToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const toastsRef = useRef(toasts)
  toastsRef.current = toasts
  const timersRef = useRef({})

  const dismiss = useCallback((id) => {
    // Mark as exiting, then remove after animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      delete timersRef.current[id]
    }, 260)
  }, [])

  const toast = useCallback(
    /** @param {{ message: string, type?: 'info'|'success'|'portal', icon?: React.ReactNode, borderColor?: string, duration?: number, key?: string }} opts */
    (opts) => {
      const dur = opts.duration ?? 3000
      const fields = {
        message: opts.message || '',
        type: opts.type || 'info',
        icon: opts.icon || null,
        borderColor: opts.borderColor || null,
      }
      // Con `key`, un toast visible con la misma llave se actualiza en su
      // lugar (texto nuevo, tiempo de nuevo y un brinquito) en vez de apilar
      // otro: "DJ mode on" → "DJ mode off" es el mismo aviso cambiando.
      const same = opts.key && toastsRef.current.find((t) => t.key === opts.key && !t.exiting)
      if (same) {
        clearTimeout(timersRef.current[same.id])
        setToasts((prev) => prev.map((t) => (t.id === same.id ? { ...t, ...fields, bump: t.bump + 1 } : t)))
        timersRef.current[same.id] = setTimeout(() => dismiss(same.id), dur)
        return same.id
      }
      const id = ++toastIdCounter
      const entry = { id, key: opts.key || null, bump: 0, ...fields, exiting: false }
      setToasts((prev) => {
        // Keep max 3 visible — dismiss oldest if needed
        const next = [...prev, entry]
        if (next.length > 3) {
          const oldest = next[0]
          dismiss(oldest.id)
        }
        return next
      })
      // Auto-dismiss
      timersRef.current[id] = setTimeout(() => dismiss(id), dur)
      return id
    },
    [dismiss],
  )

  return (
    <GameToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div
        className="fixed top-6 inset-x-0 z-toast flex flex-col items-center gap-2 pointer-events-none"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {toasts.map((t) => {
          const punto = t.borderColor || (t.type === 'success' ? '#34d399' : null)
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto px-5 py-2.5 rounded-[14px] bg-white border-2 border-[#0a0510] shadow-[0_5px_0_0_#0a0510] flex items-center gap-3 font-marquee text-[#0a0510] text-sm uppercase tracking-wide ${t.exiting ? 'animate-toast-exit' : 'animate-toast-enter'}`}
              onClick={() => dismiss(t.id)}
            >
              <span key={t.bump} className={`flex items-center gap-3 ${t.bump ? 'animate-toast-bump' : ''}`}>
                {punto && <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 border-[#0a0510]" style={{ background: punto }} aria-hidden="true" />}
                {t.icon && <span className="flex-shrink-0 flex items-center justify-center">{t.icon}</span>}
                <span>{t.message}</span>
              </span>
            </div>
          )
        })}
      </div>
    </GameToastContext.Provider>
  )
}

/**
 * Hook to fire toasts.
 * @returns {(opts: { message: string, type?: string, icon?: React.ReactNode, borderColor?: string, duration?: number, key?: string }) => number}
 */
export function useGameToast() {
  const ctx = useContext(GameToastContext)
  if (!ctx) throw new Error('useGameToast must be used within <GameToastProvider>')
  return ctx
}
