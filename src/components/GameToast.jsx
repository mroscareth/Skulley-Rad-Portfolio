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
    /** @param {{ message: string, type?: 'info'|'success'|'portal', icon?: React.ReactNode, borderColor?: string, duration?: number }} opts */
    (opts) => {
      const id = ++toastIdCounter
      const entry = {
        id,
        message: opts.message || '',
        type: opts.type || 'info',
        icon: opts.icon || null,
        borderColor: opts.borderColor || null,
        exiting: false,
      }
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
      const dur = opts.duration ?? 3000
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
        className="fixed top-6 inset-x-0 z-[9999999] flex flex-col items-center gap-2 pointer-events-none"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {toasts.map((t) => {
          const borderMap = {
            info: 'border-white/[0.12]',
            success: 'border-emerald-400/40',
            portal: '',
          }
          const borderClass = t.borderColor ? '' : (borderMap[t.type] || borderMap.info)
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto px-5 py-2.5 rounded-full bg-black/70 backdrop-blur-xl border shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center gap-3 font-marquee text-white text-sm uppercase tracking-wide ${borderClass} ${t.exiting ? 'animate-toast-exit' : 'animate-toast-enter'}`}
              style={t.borderColor ? { borderColor: `${t.borderColor}55` } : undefined}
              onClick={() => dismiss(t.id)}
            >
              {t.icon && <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-white">{t.icon}</span>}
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </GameToastContext.Provider>
  )
}

/**
 * Hook to fire toasts.
 * @returns {(opts: { message: string, type?: string, icon?: React.ReactNode, borderColor?: string, duration?: number }) => number}
 */
export function useGameToast() {
  const ctx = useContext(GameToastContext)
  if (!ctx) throw new Error('useGameToast must be used within <GameToastProvider>')
  return ctx
}
