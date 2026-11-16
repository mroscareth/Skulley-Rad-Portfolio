import React, { useEffect, useState } from 'react'
import { ArrowPathIcon, ArrowLeftIcon, ComputerDesktopIcon } from '@heroicons/react/24/solid'

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
import { PALETAS_INFERNO, varianteInferno } from '../lib/paletaFuego.js'
import { cambiarVarianteInferno } from '../lib/characterSkin.js'
import { ACCESORIOS, ACCESORIOS_EVENT, getAccesorios, setAccesorio } from '../lib/accesoriosEstado.js'

// Llamas rojas o azules de Inferno (Oscar, 2026-11-16): dos círculos del tamaño
// de los de color, cada uno con su fuego (la orilla honda y el centro claro),
// con el nombre abajo. El que está puesto lleva el borde blanco.
function SelectorFuego({ skinId, lang }) {
  const [variante, setVariante] = useState(varianteInferno)
  const opciones = [
    { id: 'rojo', label: lang === 'es' ? 'Rojas' : 'Red' },
    { id: 'azul', label: lang === 'es' ? 'Azules' : 'Blue' },
  ]
  const escoge = (id) => {
    if (id === variante) return
    try { playSfx('click', { volume: 1.0 }) } catch { }
    setVariante(id)
    cambiarVarianteInferno(id, skinId)
  }
  return (
    <div className="flex flex-col items-center gap-1.5" role="group" aria-label={lang === 'es' ? 'Color de las llamas' : 'Flame color'}>
      <div className="flex gap-2">
        {opciones.map((o) => {
          const p = PALETAS_INFERNO[o.id]
          const puesto = o.id === variante
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => escoge(o.id)}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              aria-pressed={puesto}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`block w-12 h-12 md:w-14 md:h-14 rounded-full border-2 transition-all shadow-elev-sm ${puesto ? 'border-white' : 'border-white/25 hover:border-white/60'}`}
                style={{ background: `radial-gradient(circle at 50% 42%, ${p[3]} 0%, ${p[2]} 30%, ${p[1]} 58%, ${p[0]} 100%)` }}
                aria-hidden="true"
              />
              <span className="text-[9px] md:text-[10px] opacity-80 leading-none">{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Lentes (silueta Wayfarer) para el botón del prop.
function LentesIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M2 11.2c0-.9.7-1.5 1.6-1.6 3.9-.3 7.8-.4 11.4.5.6.2 1.4.2 2 0 3.6-.9 7.5-.8 11.4-.5.9.1 1.6.7 1.6 1.6v1.1c0 .6-.4 1-.9 1.2-.4.1-.7.5-.8.9l-1.2 4.9c-.3 1.3-1.5 2.2-2.8 2.2h-3.6c-1.4 0-2.6-1-2.9-2.3l-.6-2.8c-.1-.6-.6-1-1.2-1s-1.1.4-1.2 1l-.6 2.8c-.3 1.3-1.5 2.3-2.9 2.3H7.7c-1.3 0-2.5-.9-2.8-2.2l-1.2-4.9c-.1-.4-.4-.8-.8-.9-.5-.2-.9-.6-.9-1.2z" />
    </svg>
  )
}

// Bóxers (con un corazón calado) para el botón del prop.
function BoxersIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M5.2 6.5h21.6c.7 0 1.2.5 1.2 1.2v1.9c0 .7-.5 1.2-1.2 1.2H5.2c-.7 0-1.2-.5-1.2-1.2V7.7c0-.7.5-1.2 1.2-1.2z" />
      <path d="M4.7 12h22.6l1.4 11.4c.1.7-.4 1.3-1.1 1.4l-9.4.8c-.6.1-1.2-.4-1.3-1L16 17.2l-.9 7.4c-.1.6-.7 1.1-1.3 1l-9.4-.8c-.7-.1-1.2-.7-1.1-1.4zM9.6 20.6l2.3-2.2c.6-.6.6-1.5 0-2-.5-.5-1.4-.5-1.9 0l-.4.4-.4-.4c-.5-.5-1.4-.5-1.9 0-.6.5-.6 1.4 0 2z" />
    </svg>
  )
}

const ICONOS_PROP = { lentes: LentesIcon, boxers: BoxersIcon }

// Props de Skulley (Oscar, 2026-11-16): cada uno se pone o se quita. Mismo
// tamaño que los chips de skin, en su misma cuadrícula; el puesto va en
// amarillo, como los chips marcados del sitio.
function SelectorProps({ lang, enFila = false }) {
  const [estado, setEstado] = useState(getAccesorios)
  useEffect(() => {
    const on = (e) => setEstado(e?.detail ? { ...e.detail } : getAccesorios())
    window.addEventListener(ACCESORIOS_EVENT, on)
    return () => window.removeEventListener(ACCESORIOS_EVENT, on)
  }, [])
  return (
    <div className={enFila ? 'flex justify-center gap-3' : 'grid grid-cols-2 gap-2.5 md:gap-3'} role="group" aria-label="Props">
      {ACCESORIOS.map((a) => {
        const puesto = !!estado[a.id]
        const nombre = lang === 'es' ? a.es : a.en
        const accion = puesto ? (lang === 'es' ? `Quitar ${a.es.toLowerCase()}` : `Remove ${a.en.toLowerCase()}`) : (lang === 'es' ? `Poner ${a.es.toLowerCase()}` : `Wear ${a.en.toLowerCase()}`)
        const Icono = ICONOS_PROP[a.id] || LentesIcon
        return (
          <div key={a.id} className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setEstado(setAccesorio(a.id, !puesto)) }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              aria-pressed={puesto}
              aria-label={accion}
              data-tip={accion}
              className={`grid place-items-center w-12 h-12 md:w-16 md:h-16 rounded-full border-2 transition-all shadow-elev-sm ${puesto ? 'bg-amarillo border-amarillo text-black' : 'bg-black/35 backdrop-blur-md border-white/20 hover:border-white/60 text-white/80'}`}
            >
              <Icono className="w-7 h-7 md:w-9 md:h-9" />
            </button>
            <div className="mt-1 w-12 md:w-16 text-[9px] md:text-[10px] text-center leading-tight opacity-80 truncate">{nombre}</div>
          </div>
        )
      })}
    </div>
  )
}

// Pestañas del guardarropa (Oscar, 2026-11-16): lo que Skulley trae puesto se
// escoge por partes y cada parte es una pestaña. Para agregar una, va aquí y
// en el panel de abajo.
const PESTANAS = [
  { id: 'skins', es: 'Skins', en: 'Skins' },
  { id: 'props', es: 'Props', en: 'Props' },
]

function Pestanas({ pestana, onPestana, lang, centradas = false }) {
  const idDe = (id) => `cc-pestana-${id}`
  const onKeyDown = (e) => {
    const i = PESTANAS.findIndex((p) => p.id === pestana)
    let n = null
    if (e.key === 'ArrowRight') n = (i + 1) % PESTANAS.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + PESTANAS.length) % PESTANAS.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = PESTANAS.length - 1
    if (n == null) return
    e.preventDefault()
    onPestana(PESTANAS[n].id)
    document.getElementById(idDe(PESTANAS[n].id))?.focus()
  }
  return (
    <div role="tablist" aria-label={lang === 'es' ? 'Guardarropa' : 'Wardrobe'} onKeyDown={onKeyDown} className={`flex gap-1.5 ${centradas ? 'justify-center' : ''}`}>
      {PESTANAS.map((p) => {
        const activa = p.id === pestana
        return (
          <button
            key={p.id}
            id={idDe(p.id)}
            type="button"
            role="tab"
            aria-selected={activa}
            aria-controls={`cc-panel-${p.id}`}
            tabIndex={activa ? 0 : -1}
            onClick={() => { if (activa) return; try { playSfx('click', { volume: 1.0 }) } catch { }; onPestana(p.id) }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.6 }) } catch { } }}
            className="shop-chip h-9 px-4 text-[10px] whitespace-nowrap bg-black/35 backdrop-blur-md [text-shadow:none]"
          >
            {lang === 'es' ? p.es : p.en}
          </button>
        )
      })}
    </div>
  )
}

// La columna de colores va a la derecha y Skulley a la izquierda: el selector
// se abre hacia el hueco que queda entre los dos, no encima de los otros colores.
const LADOS_COLUMNA = ['left', 'bottom', 'top', 'right']

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
  // Abre el marco del wallpaper (solo con el layout de escritorio).
  onWallpaper,
  // El color del fondo infinito sobre el que queda Skulley.
  fondo = '#022dd6',
  onFondo,
}) {
  const { t, lang } = useLanguage()
  const [colors, setColors] = useState(() => getCharacterColors())
  const [pestana, setPestana] = useState('skins')
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
      <div
        style={{ '--mq': marqueeHeight || 0 }}
        className="absolute left-4 md:left-10 top-[calc(var(--mq)*1px+16px)] md:top-[calc(var(--mq)*1px+40px)] flex items-center gap-2"
      >
      <button
        type="button"
        onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; onClose?.() }}
        onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
        className={`h-11 md:h-12 px-4 flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.16] text-white/90 hover:text-white hover:bg-black/55 transition-colors shadow-elev-sm text-[12px] font-bold uppercase tracking-wide ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-label={lang === 'es' ? 'Salir' : 'Exit'}
        data-tip={lang === 'es' ? 'Salir' : 'Exit'}
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {lang === 'es' ? 'Salir' : 'Exit'}
      </button>
      {/* El fondo, en el mismo vidrio de Salir. */}
      <div className={`cc-fondo h-11 md:h-12 pl-1.5 md:pl-2 pr-4 flex items-center rounded-full bg-black/40 backdrop-blur-md border border-white/[0.16] shadow-elev-sm ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} inert={!open || undefined}>
        <ColorWell label={t('customizer.wallBg')} value={fondo} onChange={onFondo} />
      </div>
      </div>

      {/* Stage centrado y acotado (max-w) → los controles flanquean CERCA del
          personaje en pantallas anchas, en vez de tirarse a las orillas. */}
      <div className="absolute inset-0 flex justify-center px-3 md:px-6">
        <div className="relative w-full max-w-4xl h-full">

      {/* GUARDARROPA — pestañas (skins, props) y lo de la pestaña. Desktop:
          columna flotante izquierda. Mobile: carousel abajo (drag nativo +
          flechas con wrap infinito). Los dos paneles ocupan la misma celda
          y el oculto solo se vuelve invisible: la caja mide lo del más alto
          y las pestañas no brincan al cambiar. */}
      {compact ? (
        <div className={`absolute bottom-3 inset-x-0 px-2 text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.9)] transition-all duration-300 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'}`}>
          <div className="mb-2"><Pestanas pestana={pestana} onPestana={setPestana} lang={lang} centradas /></div>
          {/* minmax(0, 1fr): el carrusel no ensancha la columna (los props se iban a la derecha) */}
          <div className="grid grid-cols-[minmax(0,1fr)]">
            <div id="cc-panel-skins" role="tabpanel" aria-labelledby="cc-pestana-skins" className={`[grid-area:1/1] self-end ${pestana === 'skins' ? '' : 'invisible'}`} inert={pestana !== 'skins' || undefined}>
              {skins.length > 0 && <SkinCarousel skins={skins} lang={lang} renderChip={(s) => renderSkinChip(s, true)} />}
            </div>
            <div id="cc-panel-props" role="tabpanel" aria-labelledby="cc-pestana-props" className={`[grid-area:1/1] self-end pb-1 ${pestana === 'props' ? '' : 'invisible'}`} inert={pestana !== 'props' || undefined}>
              <SelectorProps lang={lang} enFila />
            </div>
          </div>
        </div>
      ) : (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.9)] transition-all duration-300 ${open ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-6 pointer-events-none'}`}>
          <div className="mb-3"><Pestanas pestana={pestana} onPestana={setPestana} lang={lang} /></div>
          <div className="grid">
            <div id="cc-panel-skins" role="tabpanel" aria-labelledby="cc-pestana-skins" className={`[grid-area:1/1] self-start ${pestana === 'skins' ? '' : 'invisible'}`} inert={pestana !== 'skins' || undefined}>
              <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                {skins.map((s) => renderSkinChip(s, false))}
              </div>
            </div>
            <div id="cc-panel-props" role="tabpanel" aria-labelledby="cc-pestana-props" className={`[grid-area:1/1] self-start ${pestana === 'props' ? '' : 'invisible'}`} inert={pestana !== 'props' || undefined}>
              <SelectorProps lang={lang} />
            </div>
          </div>
        </div>
      )}

      {/* COLORES + acciones — flotando a la DERECHA. Solo con la pestaña de
          skins: los colores son del cuerpo, no de los props (Oscar). */}
      <div
        className={`absolute right-0 top-1/2 -translate-y-1/2 text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.9)] transition-all duration-300 ${open && pestana === 'skins' ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-6 pointer-events-none'}`}
        inert={!open || pestana !== 'skins' || undefined}
      >
        {editableKeys.length > 0 ? (
          <>
            <h3 className="text-[11px] font-bold uppercase tracking-widest opacity-80 mb-2 text-center">{lang === 'es' ? 'Color' : 'Color'}</h3>
            <div className="flex flex-col items-center gap-3">
              {activeSkin?.variantesFuego && <SelectorFuego skinId={activeSkinId} lang={lang} />}
              {visibleRows.map((row) => (
                <ColorWell key={row.key} label={row.label} value={colors[row.key]} onChange={(v) => update(row.key, v)} lados={LADOS_COLUMNA} />
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
      {/* Wallpaper 4K, al centro y abajo de Skulley: no se mueve con la skin. */}
      {!compact && onWallpaper && (
        <button
          type="button"
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; onWallpaper() }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          className={`shop-btn shop-btn--primary absolute left-1/2 -translate-x-1/2 bottom-6 md:bottom-10 h-11 px-5 gap-2 text-[13px] transition-all duration-300 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'}`}
          tabIndex={open ? 0 : -1}
        >
          <ComputerDesktopIcon className="w-4 h-4" aria-hidden="true" />
          {t('customizer.wallpaper')}
        </button>
      )}
        </div>
      </div>
    </div>
  )
}
