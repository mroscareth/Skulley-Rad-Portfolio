import React, { useRef, useState } from 'react'
import { useShopData } from '../../lib/shopDataContext.jsx'
import { playSfx } from '../../lib/sfx.js'
import useOutsideClickClose from '../../hooks/useOutsideClickClose.js'

// Destino de envío, y con él la moneda.
//
// No es un selector de moneda a secas: la región decide también las tarifas de
// envío y qué piezas están a la venta, y el checkout cobra en la moneda de la
// región. Enseñar USD a quien va a pagar en pesos sería mentirle, así que se
// elige el destino y la moneda viene con él. La elección se recuerda en
// localStorage (lo hace setRegion).
//
// Vive como chip fijo junto al carrito: el precio cambia con esto, así que el
// control tiene que seguir alcanzable con el grid scrolleado. El chip enseña
// solo la moneda — es lo que el usuario busca cuando mira un precio; el nombre
// del destino vive en el panel.
export default function RegionChip({ lang }) {
  const { regions, region, setRegion } = useShopData()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const isEn = lang === 'en'

  // El chip vive en la barra fixed sobre el canvas 3D: un panel abierto que no
  // se cierre tapa UI.
  useOutsideClickClose(open, setOpen, [wrapRef])

  if (regions.length < 2 || !region) return null

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setOpen(o => !o) }}
        onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
        aria-haspopup="true"
        aria-expanded={open}
        className={`h-11 md:h-12 px-3.5 rounded-full grid place-items-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-3xl border transition-colors ${open ? 'bg-white border-white text-black' : 'bg-black/40 border-white/[0.08] text-white hover:bg-white/[0.15]'}`}
        aria-label={isEn
          ? `Shipping destination and currency — ${region.name_en}, ${region.currency}`
          : `Destino de envío y moneda — ${region.name_es}, ${region.currency}`}
        title={isEn
          ? `Ship to ${region.name_en} — prices in ${region.currency}`
          : `Enviar a ${region.name_es} — precios en ${region.currency}`}
      >
        <span className="text-[11px] md:text-[12px] font-black tracking-[0.12em] leading-none">
          {region.currency}
        </span>
      </button>

      {open && (
        <div
          role="group"
          aria-label={isEn ? 'Shipping destination and currency' : 'Destino de envío y moneda'}
          className="absolute top-full right-0 mt-3 min-w-[218px] p-2 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/[0.1] shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
        >
          <p className="px-2.5 pt-1 pb-2 text-[10px] tracking-[0.16em] uppercase text-white/45 font-bold">
            {isEn ? 'Ship to' : 'Enviar a'}
          </p>
          {regions.map((r) => {
            const isActive = region.code === r.code
            return (
              <button
                key={r.code}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  try { playSfx('click', { volume: 0.8 }) } catch { }
                  setRegion(r.code)
                  setOpen(false)
                }}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.6 }) } catch { } }}
                className={`w-full flex items-center justify-between gap-4 px-2.5 py-2 rounded-xl text-left transition-colors ${isActive ? 'bg-[#e600ff] text-[#0a0510]' : 'text-white/70 hover:text-white hover:bg-white/[0.08]'}`}
              >
                <span className="text-[11px] font-bold tracking-[0.1em] uppercase">
                  {isEn ? r.name_en : r.name_es}
                </span>
                <span className={`text-[11px] font-black tracking-[0.1em] ${isActive ? '' : 'text-white/45'}`}>
                  {r.currency}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
