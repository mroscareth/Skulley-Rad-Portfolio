import React, { useEffect, useState } from 'react'
import { ArrowPathIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'

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
  randomVividColor,
  DEFAULT_CHARACTER_COLORS,
  CHARACTER_COLOR_EVENT,
} from '../lib/characterColors.js'
import SkinChip from './SkinChip.jsx'
import ColorWell from './ColorWell.jsx'
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
    const vivid = randomVividColor
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

  // Chip de skin (columna desktop / carousel mobile), compartido con el
  // personalizador de teléfono.
  const renderSkinChip = (s, inCarousel) => (
    <SkinChip
      key={s.id}
      skin={s}
      lang={lang}
      active={s.id === activeSkinId}
      owned={s.owned}
      live={open}
      inCarousel={inCarousel}
      onSelect={onSelectSkin}
    />
  )

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
        data-tip={lang === 'es' ? 'Salir' : 'Exit'}
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
                <ColorWell key={row.key} label={row.label} value={colors[row.key]} onChange={(v) => update(row.key, v)} />
              ))}
            </div>
            {/* Reset + Randomize (solo Custom) — botones circulares flotantes.
                Randomize es la acción de color y va al final (DESIGN.md §4.6). */}
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={onReset}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                className="h-11 w-11 rounded-full grid place-items-center bg-black/35 backdrop-blur-md hover:bg-black/50 border border-white/[0.14] text-white transition-colors shadow-elev-sm"
                aria-label={t('customizer.reset')}
                data-tip={t('customizer.reset')}
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
              {isBase && (
                <button
                  type="button"
                  onClick={onRandomize}
                  onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                  className="h-11 w-11 rounded-full grid place-items-center bg-sky-400/20 backdrop-blur-md hover:bg-sky-400/30 border border-sky-400/45 text-white transition-colors shadow-elev-sm"
                  aria-label={t('customizer.randomize')}
                  data-tip={t('customizer.randomize')}
                >
                  <DiceIcon className="w-5 h-5" />
                </button>
              )}
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
