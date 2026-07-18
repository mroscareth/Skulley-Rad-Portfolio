import React, { useEffect, useState } from 'react'
import { ArrowPathIcon, LockClosedIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'

// Dado (heroicons no tiene dice) — representa randomness para el botón Randomize.
function DiceIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { playSfx } from '../lib/sfx.js'
import {
  getCharacterColors,
  setCharacterColors,
  resetCharacterColors,
  DEFAULT_CHARACTER_COLORS,
  CHARACTER_COLOR_EVENT,
} from '../lib/characterColors.js'
import { localizeSkin } from '../lib/skinRegistry.js'
import SkinSwatch from './SkinSwatch.jsx'
import SkinCarousel from './SkinCarousel.jsx'

// Panel de personalización de color del personaje (lado derecho de la pantalla;
// la cámara del mundo se posa al frente con el personaje a la izquierda, ver
// CameraController `customizeActive`). Escribe en el slot global characterColors
// → todos los renders de Skulley (escena, retrato, hero) se actualizan en vivo.
export default function CharacterCustomizer({
  open = false,
  onClose,
  // Sistema de skins (de useSkinSystem): lista resuelta con {id, owned, active,
  // swatch, label, hint}, la skin activa y el setter. Las owned se seleccionan;
  // las locked muestran candado + tooltip con cómo ganarlas.
  skins = [],
  activeSkinId = 'base',
  onSelectSkin,
  // Altura del marquee (medida en App). Regla DESIGN.md §3.5: la UI anclada arriba
  // va SIEMPRE debajo del marquee (este la empuja). Se usa para el botón Salir.
  marqueeHeight = 0,
  // Mobile: layout distinto (skins en carousel abajo en vez de columna izq).
  compact = false,
}) {
  const { t, lang } = useLanguage()
  const [colors, setColors] = useState(() => getCharacterColors())
  // Keys de color editables según la skin: registry override (ej. void = [],
  // ninguno) o default (base = las 4; otras = ojos + orb).
  const isBase = activeSkinId === 'base'
  const activeSkin = skins.find((s) => s.id === activeSkinId)
  const editableKeys = activeSkin?.editableColors ?? (isBase ? ['eyes', 'head', 'hair', 'orb'] : ['eyes', 'orb'])

  // Re-sync inputs if the store changes elsewhere (e.g. reset, otra pestaña).
  useEffect(() => {
    const onChange = (e) => setColors(e?.detail ? { ...e.detail } : getCharacterColors())
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [])

  // Al abrir, re-lee el slot por si cambió mientras estaba cerrado.
  useEffect(() => { if (open) setColors(getCharacterColors()) }, [open])

  const update = (key, value) => {
    setColors((prev) => ({ ...prev, [key]: value }))
    setCharacterColors({ [key]: value })
  }

  const onReset = () => {
    try { playSfx('click', { volume: 1.0 }) } catch { }
    setColors(resetCharacterColors())
  }

  const onRandomize = () => {
    // Efecto de magia: burst de runas que brota del personaje (lo dispara
    // HomeOrbs vía evento) + sonido de casteo.
    try { window.dispatchEvent(new CustomEvent('character-color-burst')) } catch { }
    try { playSfx('magiaInicia', { volume: 0.9 }) } catch { }
    try { playSfx('sparkleBom', { volume: 0.7 }) } catch { }
    // Vívido vía HSL (saturación/luminosidad altas) → nunca colores lodosos.
    const vivid = () => {
      const h = Math.random() * 360
      const s = 0.82 + Math.random() * 0.18
      const l = 0.46 + Math.random() * 0.14
      const c = (1 - Math.abs(2 * l - 1)) * s
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
      const m = l - c / 2
      const [r, g, b] = (
        h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
          h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
      )
      const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
      return `#${hex(r)}${hex(g)}${hex(b)}`
    }
    // Solo aleatoriza las keys editables según la skin (base = todas; otras =
    // ojos + orb, el cuerpo/pelo los define la skin).
    const next = isBase
      ? { head: vivid(), eyes: vivid(), hair: vivid(), orb: vivid() }
      : { eyes: vivid(), orb: vivid() }
    setColors(setCharacterColors(next))
  }

  const rows = [
    { key: 'eyes', label: t('customizer.eyes'), default: DEFAULT_CHARACTER_COLORS.eyes },
    { key: 'head', label: t('customizer.skeleton'), default: DEFAULT_CHARACTER_COLORS.head },
    { key: 'hair', label: t('customizer.hair'), default: DEFAULT_CHARACTER_COLORS.hair },
    { key: 'orb', label: t('customizer.orb'), default: DEFAULT_CHARACTER_COLORS.orb },
  ]

  const visibleRows = rows.filter((row) => editableKeys.includes(row.key))

  // Chip de skin reusable (columna desktop / carousel mobile). `inCarousel`
  // ajusta el snap y la posición del tooltip.
  const renderSkinChip = (s, inCarousel) => {
    const loc = localizeSkin(s, lang)
    const active = s.id === activeSkinId
    const owned = s.owned
    return (
      <div key={s.id} data-skin-item className={`group relative flex flex-col items-center ${inCarousel ? 'snap-center shrink-0' : ''}`}>
        <button
          type="button"
          disabled={!owned}
          onClick={() => { if (!owned) return; try { playSfx('click', { volume: 1.0 }) } catch { }; onSelectSkin?.(s.id) }}
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
            <SkinSwatch skin={s} active={open && owned} />
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

  return (
    <div
      className={`fixed inset-0 z-[999996] pointer-events-none transition-opacity duration-300 ease-out ${open ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden={!open}
    >
      {/* Salir — pill a la IZQUIERDA, debajo del marquee (ya no se empalma con
          login/CUSTOMIZE arriba-derecha). */}
      <button
        type="button"
        onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; onClose?.() }}
        onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
        style={{ '--mq': marqueeHeight || 0 }}
        className={`absolute left-4 md:left-10 top-[calc(var(--mq)*1px+16px)] md:top-[calc(var(--mq)*1px+40px)] h-11 md:h-12 px-4 flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.16] text-white/90 hover:text-white hover:bg-black/55 transition-colors shadow-elev-sm text-[12px] font-bold uppercase tracking-wide ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-label={lang === 'es' ? 'Salir' : 'Exit'}
        title={lang === 'es' ? 'Salir' : 'Exit'}
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {lang === 'es' ? 'Salir' : 'Exit'}
      </button>

      {/* Stage centrado y acotado (max-w) → los controles flanquean CERCA del
          personaje en pantallas anchas, en vez de tirarse a las orillas. */}
      <div className="absolute inset-0 flex justify-center px-3 md:px-6">
        <div className="relative w-full max-w-4xl h-full">

      {/* SKIN — desktop: columna flotante izquierda. Mobile: carousel abajo
          (drag nativo + flechas con wrap infinito). */}
      {skins && skins.length > 0 && (
        compact ? (
          <div className={`absolute bottom-3 inset-x-0 px-2 text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.9)] transition-all duration-300 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'}`}>
            <h3 className="text-center text-[11px] font-bold uppercase tracking-widest opacity-80 mb-1.5">{lang === 'es' ? 'Skin' : 'Skin'}</h3>
            <SkinCarousel skins={skins} lang={lang} renderChip={(s) => renderSkinChip(s, true)} />
          </div>
        ) : (
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.9)] transition-all duration-300 ${open ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-6 pointer-events-none'}`}>
            <h3 className="text-[11px] font-bold uppercase tracking-widest opacity-80 mb-2 pl-1">{lang === 'es' ? 'Skin' : 'Skin'}</h3>
            <div className="grid grid-cols-2 gap-2.5 md:gap-3">
              {skins.map((s) => renderSkinChip(s, false))}
            </div>
          </div>
        )
      )}

      {/* COLORES + acciones — flotando a la DERECHA. */}
      <div className={`absolute right-0 top-1/2 -translate-y-1/2 text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.9)] transition-all duration-300 ${open ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-6 pointer-events-none'}`}>
        {editableKeys.length > 0 ? (
          <>
            <h3 className="text-[11px] font-bold uppercase tracking-widest opacity-80 mb-2 text-center">{lang === 'es' ? 'Color' : 'Color'}</h3>
            <div className="flex flex-col items-center gap-3">
              {visibleRows.map((row) => (
                <label key={row.key} className="relative flex flex-col items-center gap-1 cursor-pointer">
                  <span className="relative block w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-white/25 hover:border-white/60 transition-all overflow-hidden shadow-elev-sm">
                    <span className="absolute inset-0 rounded-full" style={{ backgroundColor: colors[row.key] }} aria-hidden />
                    <input
                      type="color"
                      value={colors[row.key]}
                      onChange={(e) => update(row.key, e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label={row.label}
                    />
                  </span>
                  <span className="text-[9px] md:text-[10px] opacity-80 leading-none">{row.label}</span>
                </label>
              ))}
            </div>
            {/* Randomize (solo Custom) + Reset — botones circulares flotantes. */}
            <div className="mt-4 flex justify-center gap-2">
              {isBase && (
                <button
                  type="button"
                  onClick={onRandomize}
                  onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                  className="h-11 w-11 rounded-full grid place-items-center bg-sky-400/20 backdrop-blur-md hover:bg-sky-400/30 border border-sky-400/45 text-white transition-colors shadow-elev-sm"
                  aria-label={t('customizer.randomize')}
                  title={t('customizer.randomize')}
                >
                  <DiceIcon className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                onClick={onReset}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                className="h-11 w-11 rounded-full grid place-items-center bg-black/35 backdrop-blur-md hover:bg-black/50 border border-white/[0.14] text-white transition-colors shadow-elev-sm"
                aria-label={t('customizer.reset')}
                title={t('customizer.reset')}
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <p className="text-[11px] leading-snug opacity-55 w-28 text-center">
            {lang === 'es' ? 'Esta skin no es personalizable.' : "This skin isn't customizable."}
          </p>
        )}
      </div>
        </div>
      </div>
    </div>
  )
}
