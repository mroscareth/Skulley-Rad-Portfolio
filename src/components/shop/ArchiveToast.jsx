import React, { useEffect, useRef, useState } from 'react'

// Toast de confirmación al agregar al carrito.
// Se dispara vía CustomEvent('shop-toast', { detail: { product } }).
//
// Lenguaje SHOP v2 (DESIGN.md §14): superficie plana, sin glow, sin scanline
// sweep y sin monoespaciado. Muestra la miniatura del producto para que la
// confirmación se lea de un vistazo sin tener que leer un ID.
//
// Un toast por pieza (pedido de Oscar, 2026-11-10): agregar otra de la misma
// solo le reinicia el tiempo al que ya está; una pieza distinta sí saca otro.

const TOAST_MS = 2400

export default function ArchiveToast({ lang = 'en' }) {
  const [toasts, setToasts] = useState([]) // { id (= product.id), label, title, image }
  const timers = useRef(new Map())

  useEffect(() => {
    const onToast = (e) => {
      const { product } = e.detail || {}
      if (!product) return
      const id = product.id
      const isEn = lang === 'en'
      setToasts((prev) => (prev.some(t => t.id === id) ? prev : [...prev, {
        id,
        label: isEn ? 'Added to cart' : 'Agregado al carrito',
        title: isEn ? product.title_en : product.title_es,
        image: product.image,
      }]))
      clearTimeout(timers.current.get(id))
      timers.current.set(id, setTimeout(() => {
        timers.current.delete(id)
        setToasts((prev) => prev.filter(t => t.id !== id))
      }, TOAST_MS))
    }
    window.addEventListener('shop-toast', onToast)
    return () => window.removeEventListener('shop-toast', onToast)
  }, [lang])

  useEffect(() => () => {
    for (const t of timers.current.values()) clearTimeout(t)
  }, [])

  return (
    // Main nav vive en bottom-10 con z-index 999991 → el toast va ARRIBA del
    // nav (bottom-28 ≈ 112px deja aire limpio) y con z-index por encima.
    <div
      className="fixed bottom-28 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none px-4 w-full max-w-sm"
      style={{ zIndex: 999993 }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 p-2 pr-5 rounded-full border-2 border-white/15 bg-[#0d0714] shop-toast-in"
        >
          {t.image && (
            <img
              src={t.image}
              alt=""
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              draggable={false}
            />
          )}
          {/* El producto es el sujeto y el estado va debajo. Al revés
              (label chico arriba del título) sería un eyebrow — §0.7. */}
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate leading-snug">{t.title}</p>
            <p className="text-white/50 text-xs leading-snug mt-0.5">{t.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
