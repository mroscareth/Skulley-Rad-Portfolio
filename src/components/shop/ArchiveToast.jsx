import React, { useEffect, useState } from 'react'

// Toast tipo "LOST ITEM ARCHIVED" con sweep scanline + beep.
// Se dispara vía emit('shop-toast', { message }) en un CustomEvent.

let _nextId = 1

export default function ArchiveToast({ lang = 'en' }) {
  const [toasts, setToasts] = useState([]) // { id, message, archiveId }

  useEffect(() => {
    const onToast = (e) => {
      const { product } = e.detail || {}
      if (!product) return
      const id = _nextId++
      const msg = lang === 'en'
        ? `ADDED TO CART: ${product.archiveId}`
        : `AGREGADO AL CARRITO: ${product.archiveId}`
      setToasts((prev) => [...prev, { id, message: msg, archiveId: product.archiveId }])
      setTimeout(() => {
        setToasts((prev) => prev.filter(t => t.id !== id))
      }, 2400)
    }
    window.addEventListener('shop-toast', onToast)
    return () => window.removeEventListener('shop-toast', onToast)
  }, [lang])

  return (
    // Main nav vive en bottom-10 con z-index 999991 → el toast va ARRIBA del
    // nav (bottom-28 ≈ 112px deja aire limpio) y con z-index por encima.
    <div
      className="fixed bottom-28 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none"
      style={{ zIndex: 999993 }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="relative px-5 py-3 border-2 border-green-400 bg-black text-green-400 font-bold uppercase text-xs sm:text-sm tracking-widest shadow-[0_0_24px_rgba(34,197,94,0.5)] shop-toast-in overflow-hidden"
          style={{ fontFamily: '"Cascadia Code", monospace' }}
        >
          {/* sweep scanline */}
          <span className="absolute inset-0 pointer-events-none shop-scan-sweep" />
          <span className="relative z-[2] inline-flex items-center gap-2">
            <span className="shop-blink">●</span>
            <span>&gt;_ {t.message}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
