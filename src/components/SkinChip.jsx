import React from 'react'
import { playSfx } from '../lib/sfx.js'
import { localizeSkin } from '../lib/skinRegistry.js'
import SkinSwatch from './SkinSwatch.jsx'
import IconoTinta from './ui/IconoTinta.jsx'

// Chip de skin: la vista previa animada (SkinSwatch) en un círculo y el nombre
// abajo. Lo comparten el personalizador de escritorio (columna o carousel) y
// el de teléfono, para que las skins se vean igual en los dos. Las clases
// `skin-chip*` son para que el teléfono lo mida a su escala (.mcz-skins).
//   live      — anima la vista previa (solo con el panel abierto)
//   owned     — false: gris + candado + tooltip con cómo ganarla
//   inCarousel — ajusta el snap y dónde sale ese tooltip
export default function SkinChip({ skin, lang = 'en', active = false, owned = true, live = false, inCarousel = false, onSelect }) {
  const loc = localizeSkin(skin, lang)
  return (
    <div data-skin-item className={`skin-chip group relative flex flex-col items-center ${inCarousel ? 'snap-center shrink-0' : ''}`}>
      <button
        type="button"
        disabled={!owned}
        onClick={() => { if (!owned) return; try { playSfx('click', { volume: 1.0 }) } catch { }; onSelect?.(skin.id) }}
        onMouseEnter={() => { if (owned) { try { playSfx('hover', { volume: 0.9 }) } catch { } } }}
        aria-pressed={active}
        aria-label={loc.label}
        className={`skin-chip__swatch chip-tinta relative w-12 h-12 md:w-16 md:h-16 overflow-hidden grid place-items-center${active ? ' es-elegido' : ''}${owned ? '' : ' cursor-not-allowed'}`}
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
          <span className="absolute inset-0 rounded-full grid place-items-center bg-[#0a0510]/45">
            <IconoTinta nombre="candado" tam={34} />
          </span>
        )}
      </button>
      <div className="skin-chip__label mt-1 w-12 md:w-16 text-[9px] md:text-[10px] text-center leading-tight opacity-80 truncate">{loc.label}</div>
      {!owned && (
        <div className={`chip-tinta__tip pointer-events-none absolute px-2.5 py-1.5 rounded-[10px] bg-white border-2 border-[#0a0510] text-[11px] font-bold text-[#0a0510] w-40 text-center opacity-0 group-hover:opacity-100 transition-opacity z-10 ${inCarousel ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : 'left-full top-0 ml-2'}`}>
          {lang === 'es' ? 'No has ganado este skin' : "You haven't earned this skin"}
          {loc.hint && <><br /><span className="font-semibold opacity-70">{loc.hint}</span></>}
        </div>
      )}
    </div>
  )
}
