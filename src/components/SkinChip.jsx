import React from 'react'
import { LockClosedIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { localizeSkin } from '../lib/skinRegistry.js'
import SkinSwatch from './SkinSwatch.jsx'

// Chip de skin: la vista previa animada (SkinSwatch) en un círculo y el nombre
// abajo. Lo comparten el personalizador de escritorio (columna o carousel) y
// el de teléfono, para que las skins se vean igual en los dos.
//   live      — anima la vista previa (solo con el panel abierto)
//   owned     — false: gris + candado + tooltip con cómo ganarla
//   inCarousel — ajusta el snap y dónde sale ese tooltip
export default function SkinChip({ skin, lang = 'en', active = false, owned = true, live = false, inCarousel = false, onSelect }) {
  const loc = localizeSkin(skin, lang)
  return (
    <div data-skin-item className={`group relative flex flex-col items-center ${inCarousel ? 'snap-center shrink-0' : ''}`}>
      <button
        type="button"
        disabled={!owned}
        onClick={() => { if (!owned) return; try { playSfx('click', { volume: 1.0 }) } catch { }; onSelect?.(skin.id) }}
        onMouseEnter={() => { if (owned) { try { playSfx('hover', { volume: 0.9 }) } catch { } } }}
        aria-pressed={active}
        aria-label={loc.label}
        className={`relative w-12 h-12 md:w-16 md:h-16 rounded-full border-2 overflow-hidden grid place-items-center transition-all ${
          active
            ? 'border-white shadow-[0_0_14px_rgba(255,255,255,0.5)] scale-105'
            : owned
              ? 'border-white/20 hover:border-white/60'
              : 'border-white/[0.08] cursor-not-allowed'
        }`}
      >
        {/* Locked: gris (grayscale) + candado, como el Golden. Pasamos
            active=false a los locked → caen al gradiente estático y los
            teñimos en gris. Todas las skins OWNED animan su preview: es
            seguro porque SkinSwatch ya no abre un contexto WebGL por
            swatch — comparten UN singleton de módulo (1 contexto GL total,
            72x72, nunca destruido) y cada swatch solo es un canvas 2D que
            blitea el frame ya dibujado. N skins = 1 contexto, no N. */}
        <span className={`absolute inset-0 rounded-full overflow-hidden ${owned ? '' : 'grayscale brightness-[0.7]'}`}>
          <SkinSwatch skin={skin} active={live && owned} />
        </span>
        {!owned && (
          <span className="absolute inset-0 rounded-full grid place-items-center bg-black/45">
            <LockClosedIcon className="w-4 h-4 text-white/85" />
          </span>
        )}
      </button>
      <div className="mt-1 w-12 md:w-16 text-[9px] md:text-[10px] text-center leading-tight opacity-80 truncate">{loc.label}</div>
      {!owned && (
        <div className={`pointer-events-none absolute px-2.5 py-1.5 rounded-lg bg-black/90 border border-white/10 text-[10px] text-white/85 w-40 text-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 ${inCarousel ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : 'left-full top-0 ml-2'}`}>
          {lang === 'es' ? 'No has ganado este skin' : "You haven't earned this skin"}
          {loc.hint && <><br /><span className="opacity-60">{loc.hint}</span></>}
        </div>
      )}
    </div>
  )
}
