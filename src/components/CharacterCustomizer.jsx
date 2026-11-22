import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import IconoTinta from './ui/IconoTinta.jsx'
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
import { ACCESORIOS, ACCESORIOS_EVENT, LOGRO_DE_PROP, getAccesorios, setAccesorio, propDesbloqueado } from '../lib/accesoriosEstado.js'
import { ACHIEVEMENTS } from '../lib/achievementsCatalog.js'

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

// Los íconos de cada prop (lib/iconosTinta.js). Un prop nuevo dibuja el suyo allá.
export const ICONOS_PROP = { lentes: 'lentes', lentes3d: 'lentes3d', boxers: 'boxers', pantalones: 'pantalones', chamarra: 'chamarra', hoodie: 'hoodie', tenis: 'tenis', inflada: 'inflada', botas: 'botas', munequeras: 'munequeras', beanie: 'beanie' }

// Props por parte del cuerpo (Oscar, 2026-11-17): a la izquierda la parte y a
// la derecha lo que hay para ella. Un prop nuevo va en ACCESORIOS (con
// `parte`, o aquí en PARTE_DE) y en ICONOS_PROP.
const PARTES = [
  { id: 'cabeza', es: 'Cabeza', en: 'Head', icono: 'calavera' },
  { id: 'torso', es: 'Torso', en: 'Torso', icono: 'torso' },
  { id: 'munecas', es: 'Muñecas', en: 'Wrists', icono: 'munecas' },
  { id: 'piernas', es: 'Piernas', en: 'Legs', icono: 'piernas' },
  { id: 'pies', es: 'Pies', en: 'Feet', icono: 'pies' },
]
const PARTE_DE = { lentes: 'cabeza', lentes3d: 'cabeza', chamarra: 'torso', hoodie: 'torso', inflada: 'torso', boxers: 'piernas', pantalones: 'piernas', tenis: 'pies', botas: 'pies', munequeras: 'munecas', beanie: 'cabeza' }
const parteDe = (a) => a.parte || PARTE_DE[a.id] || 'torso'

function useAccesorios() {
  const [estado, setEstado] = useState(getAccesorios)
  useEffect(() => {
    const on = (e) => setEstado(e?.detail ? { ...e.detail } : getAccesorios())
    window.addEventListener(ACCESORIOS_EVENT, on)
    return () => window.removeEventListener(ACCESORIOS_EVENT, on)
  }, [])
  return [estado, setEstado]
}

// Las partes: mismo tamaño y cuadrícula que los chips de skin, y la escogida
// marcada como la skin activa. El punto amarillo dice que esa parte trae algo puesto.
function SelectorPartes({ lang, parte, onParte, estado, enFila = false }) {
  return (
    <div className={enFila ? 'flex justify-center gap-3' : 'grid grid-cols-2 gap-2.5 md:gap-3'} role="group" aria-label={lang === 'es' ? 'Partes' : 'Body parts'}>
      {PARTES.map((p) => {
        const activa = p.id === parte
        const nombre = lang === 'es' ? p.es : p.en
        const conAlgo = ACCESORIOS.some((a) => parteDe(a) === p.id && estado[a.id])
        return (
          <div key={p.id} className="cc-pieza flex flex-col items-center">
            <button
              type="button"
              onClick={() => { if (activa) return; try { playSfx('click', { volume: 1.0 }) } catch { }; onParte(p.id) }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              aria-pressed={activa}
              aria-label={nombre}
              className={`chip-tinta relative grid place-items-center w-12 h-12 md:w-16 md:h-16${activa ? ' es-elegido' : ''}`}
            >
              <IconoTinta nombre={p.icono} tam={40} className="chip-tinta__icono" />
              {conAlgo && <span className="absolute top-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-amarillo border-2 border-[#0a0510]" aria-hidden="true" />}
            </button>
            <div className="mt-1 w-12 md:w-16 text-[9px] md:text-[10px] text-center leading-tight opacity-80 truncate">{nombre}</div>
          </div>
        )
      })}
    </div>
  )
}

// La pista del logro que desbloquea un prop (achievementsCatalog.js), en el idioma.
function pistaDeProp(id, lang) {
  const a = ACHIEVEMENTS.find((x) => x.key === LOGRO_DE_PROP[id])
  const h = a?.hint
  return h && typeof h === 'object' ? (h[lang] ?? h.en) : h || ''
}

// Los props de una parte: cada uno se pone o se quita; el puesto va en
// amarillo, como los chips marcados del sitio. Los que se ganan con un logro
// (los lentes 3D) salen con candado y su pista hasta tenerlo, como las skins
// bloqueadas (SkinChip).
function PropsDeParte({ lang, parte, estado, setEstado, enFila = false }) {
  const lista = ACCESORIOS.filter((a) => parteDe(a) === parte)
  if (!lista.length) {
    return (
      <p className={`cc-pieza text-[11px] leading-snug opacity-55 text-center ${enFila ? '' : 'w-28'}`}>
        {lang === 'es' ? 'Aún no hay nada aquí.' : 'Nothing here yet.'}
      </p>
    )
  }
  return (
    <div className={enFila ? 'flex justify-center gap-3' : 'flex flex-col items-center gap-3'} role="group" aria-label="Props">
      {lista.map((a) => {
        const puesto = !!estado[a.id]
        const nombre = lang === 'es' ? a.es : a.en
        const accion = puesto ? (lang === 'es' ? `Quitar ${a.es.toLowerCase()}` : `Remove ${a.en.toLowerCase()}`) : (lang === 'es' ? `Poner ${a.es.toLowerCase()}` : `Wear ${a.en.toLowerCase()}`)
        const icono = ICONOS_PROP[a.id] || 'lentes'
        if (!propDesbloqueado(a.id)) {
          const pista = pistaDeProp(a.id, lang)
          return (
            <div key={a.id} className="cc-pieza group relative flex flex-col items-center">
              <button
                type="button"
                disabled
                aria-label={`${nombre}: ${lang === 'es' ? 'bloqueado' : 'locked'}`}
                className="chip-tinta relative grid place-items-center w-12 h-12 md:w-16 md:h-16 cursor-not-allowed"
              >
                <IconoTinta nombre={icono} tam={40} className="chip-tinta__icono opacity-40" />
                <span className="absolute inset-0 rounded-full grid place-items-center">
                  <IconoTinta nombre="candado" tam={24} />
                </span>
              </button>
              <div className="mt-1 w-12 md:w-16 text-[9px] md:text-[10px] text-center leading-tight opacity-80 truncate">{nombre}</div>
              <div className={`chip-tinta__tip pointer-events-none absolute px-2.5 py-1.5 rounded-[10px] bg-white border-2 border-[#0a0510] text-[11px] font-bold text-[#0a0510] w-40 text-center opacity-0 group-hover:opacity-100 transition-opacity z-10 ${enFila ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : 'right-full top-0 mr-2'}`}>
                {lang === 'es' ? 'No has ganado este prop' : "You haven't earned this prop"}
                {pista && <><br /><span className="font-semibold opacity-70">{pista}</span></>}
              </div>
            </div>
          )
        }
        return (
          <div key={a.id} className="cc-pieza flex flex-col items-center">
            <button
              type="button"
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setEstado(setAccesorio(a.id, !puesto)) }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              aria-pressed={puesto}
              aria-label={accion}
              data-tip={accion}
              className={`chip-tinta grid place-items-center w-12 h-12 md:w-16 md:h-16${puesto ? ' es-elegido chip-tinta--amarillo' : ''}`}
            >
              <IconoTinta nombre={icono} tam={40} className="chip-tinta__icono" />
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

// `enBarra`: dentro de la barra de abajo de escritorio, en la placa impresa de
// tinta sólida; la puesta se levanta como tecla (.nav-tinta__item.es-activa).
function Pestanas({ pestana, onPestana, lang, centradas = false, enBarra = false }) {
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
    <div role="tablist" aria-label={lang === 'es' ? 'Guardarropa' : 'Wardrobe'} onKeyDown={onKeyDown} className={`relative flex nav-tinta__placa ${centradas ? 'justify-center' : ''}`}>
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
            className={`nav-tinta__item font-marquee flex items-center gap-2 whitespace-nowrap${enBarra ? '' : ' nav-tinta__item--chico'}${activa ? ' es-activa' : ''}`}
          >
            {enBarra && <IconoTinta nombre={p.id === 'skins' ? 'playera' : 'lentes'} tam={28} />}
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
// El fondo vive en la barra de abajo: su selector se abre hacia arriba.
const LADOS_BARRA = ['top', 'left', 'right', 'bottom']

// Tiempos del cambio entre Skins y Props (ms): la salida, la entrada con su
// rebote, lo que se recorre cada pieza de la ola y cuánto espera la columna de
// la derecha. Van al CSS como variables (`varsCoreo`), así que viven solo aquí.
const CORE = { SALE: 220, SALE_PASO: 20, ENTRA: 620, ENTRA_PASO: 42, DERECHA: 140, FUNDE_SALE: 160, FUNDE_ENTRA: 200 }
const varsCoreo = {
  '--cc-sale': `${CORE.SALE}ms`, '--cc-sale-paso': `${CORE.SALE_PASO}ms`,
  '--cc-entra': `${CORE.ENTRA}ms`, '--cc-entra-paso': `${CORE.ENTRA_PASO}ms`,
}

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
  // La que se ve. Al cambiar de pestaña primero salen en ola las piezas de la
  // que se ve y, ya ida la última, entran las de la otra (Oscar, 2026-11-18:
  // "que entren y salgan majestuosamente"; el relevo no corta lo que vuela).
  const [mostrada, setMostrada] = useState('skins')
  const [fase, setFase] = useState(null)
  const coreoRef = useRef(null)
  const mostradaRef = useRef('skins')
  const faseRef = useRef(null)
  const tiemposRef = useRef([])
  const [parte, setParte] = useState('cabeza')
  const [estadoProps, setEstadoProps] = useAccesorios()
  // Keys de color editables según la skin: registry override (ej. void = [],
  // ninguno) o default (base = las 4; otras = ojos + orb).
  const isBase = activeSkinId === 'base'
  const activeSkin = skins.find((s) => s.id === activeSkinId)
  const editableKeys = activeSkin?.editableColors ?? (isBase ? ['eyes', 'head', 'hair', 'orb'] : ['eyes', 'orb'])

  // Lo que dura cada fase con las piezas de esa pestaña (la columna que más trae).
  const duracion = (f, p) => {
    const menos = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (menos) return f === 'sale' ? CORE.FUNDE_SALE : CORE.FUNDE_ENTRA
    let n = 0
    coreoRef.current?.querySelectorAll(`[data-coreo="${p}"]`).forEach((r) => { n = Math.max(n, r.querySelectorAll('.cc-pieza').length) })
    const k = Math.max(0, n - 1)
    return f === 'sale' ? CORE.SALE + k * CORE.SALE_PASO : CORE.DERECHA + CORE.ENTRA + k * CORE.ENTRA_PASO
  }
  useEffect(() => {
    const ts = tiemposRef.current
    ts.forEach(clearTimeout)
    ts.length = 0
    const ponFase = (f) => { faseRef.current = f; setFase(f) }
    const muestra = (p) => { mostradaRef.current = p; setMostrada(p) }
    // Cada fase arranca desde como se ve cada pieza en ese instante: si se
    // cambia de pestaña a media entrada (o se regresa a media salida), las que
    // aún no llegaban no se asoman antes de irse, ni las que seguían ahí se
    // apagan de golpe antes de volver a entrar (Oscar).
    const piezasDe = (p) => coreoRef.current?.querySelectorAll(`[data-coreo="${p}"] .cc-pieza`) || []
    const congela = (p, sufijo) => piezasDe(p).forEach((el) => {
      const cs = getComputedStyle(el)
      el.style.setProperty(`--de-o${sufijo}`, cs.opacity)
      el.style.setProperty(`--de-t${sufijo}`, cs.transform)
    })
    const entra = (p, desdeAhi) => {
      if (desdeAhi) congela(p, '-e')
      else piezasDe(p).forEach((el) => { el.style.removeProperty('--de-o-e'); el.style.removeProperty('--de-t-e') })
      muestra(p)
      ponFase('entra')
      ts.push(setTimeout(() => ponFase(null), duracion('entra', p)))
    }
    if (pestana === mostradaRef.current) {
      // regresó a la que se ve a media salida: que vuelva a entrar
      if (faseRef.current === 'sale') entra(pestana, true)
      return
    }
    if (compact || !open) { muestra(pestana); ponFase(null); return }
    congela(mostradaRef.current, '')
    ponFase('sale')
    ts.push(setTimeout(() => entra(pestana), duracion('sale', mostradaRef.current)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestana])
  useEffect(() => () => tiemposRef.current.forEach(clearTimeout), [])
  // El orden de cada pieza en su columna (el retraso de la ola).
  useLayoutEffect(() => {
    coreoRef.current?.querySelectorAll('[data-coreo]').forEach((r) => {
      r.querySelectorAll('.cc-pieza').forEach((el, i) => el.style.setProperty('--i', i))
    })
  })

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
        className={`shop-btn burbuja-vidrio h-[52px] px-4 gap-2 text-[13px] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-label={lang === 'es' ? 'Salir' : 'Exit'}
        data-tip={lang === 'es' ? 'Salir' : 'Exit'}
      >
        <IconoTinta nombre="atras" tam={30} />
        {lang === 'es' ? 'Salir' : 'Exit'}
      </button>
      {/* El fondo, en el mismo vidrio de Salir (en escritorio va en la barra de abajo). */}
      {compact && (
        <div className={`cc-fondo burbuja-vidrio h-[52px] pl-1.5 md:pl-2 pr-4 flex items-center ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} inert={!open || undefined}>
          <ColorWell label={t('customizer.wallBg')} value={fondo} onChange={onFondo} />
        </div>
      )}
      </div>

      {/* Stage centrado y acotado (max-w) → los controles flanquean CERCA del
          personaje en pantallas anchas, en vez de tirarse a las orillas. */}
      <div className="absolute inset-0 flex justify-center px-3 md:px-6">
        <div ref={coreoRef} style={varsCoreo} className="relative w-full max-w-4xl h-full">

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
            <div id="cc-panel-skins" role="tabpanel" aria-labelledby="cc-pestana-skins" className={`[grid-area:1/1] self-end ${mostrada === 'skins' ? '' : 'invisible'}`} data-oculta={mostrada !== 'skins' || undefined} inert={mostrada !== 'skins' || undefined}>
              {skins.length > 0 && <SkinCarousel skins={skins} lang={lang} renderChip={(s) => renderSkinChip(s, true)} />}
            </div>
            <div id="cc-panel-props" role="tabpanel" aria-labelledby="cc-pestana-props" className={`[grid-area:1/1] self-end pb-1 flex flex-col gap-3 ${mostrada === 'props' ? '' : 'invisible'}`} data-oculta={mostrada !== 'props' || undefined} inert={mostrada !== 'props' || undefined}>
              <PropsDeParte lang={lang} parte={parte} estado={estadoProps} setEstado={setEstadoProps} enFila />
              <SelectorPartes lang={lang} parte={parte} onParte={setParte} estado={estadoProps} enFila />
            </div>
          </div>
        </div>
      ) : (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.9)] transition-all duration-300 ${open ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-6 pointer-events-none'}`}>
          <div className="grid">
            <div id="cc-panel-skins" role="tabpanel" aria-labelledby="cc-pestana-skins" data-coreo="skins" data-fase={mostrada === 'skins' ? fase || undefined : undefined} className={`[grid-area:1/1] self-start ${mostrada === 'skins' ? '' : 'invisible'}`} data-oculta={mostrada !== 'skins' || undefined} inert={mostrada !== 'skins' || undefined}>
              <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                {skins.map((s) => <div key={s.id} className="cc-pieza">{renderSkinChip(s, false)}</div>)}
              </div>
            </div>
            <div id="cc-panel-props" role="tabpanel" aria-labelledby="cc-pestana-props" data-coreo="props" data-fase={mostrada === 'props' ? fase || undefined : undefined} className={`[grid-area:1/1] self-start ${mostrada === 'props' ? '' : 'invisible'}`} data-oculta={mostrada !== 'props' || undefined} inert={mostrada !== 'props' || undefined}>
              <SelectorPartes lang={lang} parte={parte} onParte={setParte} estado={estadoProps} />
            </div>
          </div>
        </div>
      )}

      {/* PROPS de la parte escogida — a la DERECHA, donde con las skins van
          los colores (Oscar). En compacto van abajo, con las partes. */}
      {!compact && (
        <div
          data-coreo="props"
          data-fase={mostrada === 'props' ? fase || undefined : undefined}
          data-oculta={mostrada !== 'props' || undefined}
          style={{ '--cc-base': `${CORE.DERECHA}ms`, visibility: mostrada === 'props' ? undefined : 'hidden' }}
          className={`absolute right-0 top-1/2 -translate-y-1/2 text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.9)] transition-[opacity,transform] duration-300 ${open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'} ${open && mostrada === 'props' ? 'pointer-events-auto' : 'pointer-events-none'}`}
          inert={!open || mostrada !== 'props' || undefined}
        >
          <h3 className="cc-pieza text-[11px] font-bold uppercase tracking-widest opacity-80 mb-2 text-center">
            {(() => { const p = PARTES.find((x) => x.id === parte); return lang === 'es' ? p?.es : p?.en })()}
          </h3>
          <PropsDeParte lang={lang} parte={parte} estado={estadoProps} setEstado={setEstadoProps} />
        </div>
      )}

      {/* COLORES + acciones — flotando a la DERECHA. Solo con la pestaña de
          skins: los colores son del cuerpo, no de los props (Oscar). */}
      <div
        data-coreo={compact ? undefined : 'skins'}
        data-fase={!compact && mostrada === 'skins' ? fase || undefined : undefined}
        data-oculta={mostrada !== 'skins' || undefined}
        style={{ '--cc-base': `${CORE.DERECHA}ms`, visibility: mostrada === 'skins' ? undefined : 'hidden' }}
        className={`absolute right-0 top-1/2 -translate-y-1/2 text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.9)] transition-[opacity,transform] duration-300 ${open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'} ${open && mostrada === 'skins' ? 'pointer-events-auto' : 'pointer-events-none'}`}
        inert={!open || mostrada !== 'skins' || undefined}
      >
        {editableKeys.length > 0 ? (
          <>
            <h3 className="cc-pieza text-[11px] font-bold uppercase tracking-widest opacity-80 mb-2 text-center">{lang === 'es' ? 'Color' : 'Color'}</h3>
            <div className="flex flex-col items-center gap-3">
              {activeSkin?.variantesFuego && <div className="cc-pieza"><SelectorFuego skinId={activeSkinId} lang={lang} /></div>}
              {visibleRows.map((row) => (
                <div key={row.key} className="cc-pieza">
                  <ColorWell label={row.label} value={colors[row.key]} onChange={(v) => update(row.key, v)} lados={LADOS_COLUMNA} />
                </div>
              ))}
            </div>
            {/* Reset + Randomize (solo Custom) — botones circulares flotantes.
                Randomize es la acción de color y va al final (DESIGN.md §4.6). */}
            <div className="cc-pieza mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={onReset}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                className="h-11 w-11 grid place-items-center burbuja-vidrio"
                aria-label={t('customizer.reset')}
                data-tip={t('customizer.reset')}
              >
                <IconoTinta nombre="reiniciar" tam={32} />
              </button>
              {isBase && (
                <button
                  type="button"
                  onClick={onRandomize}
                  onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                  className="h-11 w-11 grid place-items-center burbuja-vidrio tecla-amarilla"
                  aria-label={t('customizer.randomize')}
                  data-tip={t('customizer.randomize')}
                >
                  <IconoTinta nombre="dado" tam={32} />
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="cc-pieza text-[11px] leading-snug opacity-55 w-28 text-center">
            {lang === 'es' ? 'Esta skin no es personalizable.' : "This skin isn't customizable."}
          </p>
        )}
      </div>
      {/* La barra de abajo (Oscar, 2026-11-18): una sola cápsula al centro con lo
          que cambia la interfaz entera: las pestañas, el fondo y el wallpaper. */}
      {!compact && (
        <div
          className={`cc-barra absolute left-1/2 -translate-x-1/2 bottom-6 md:bottom-10 w-max flex items-end gap-3 text-white transition-all duration-300 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-6 pointer-events-none'}`}
          inert={!open || undefined}
        >
          <Pestanas pestana={pestana} onPestana={setPestana} lang={lang} enBarra />
          <div className="cc-fondo burbuja-vidrio h-[52px] pl-1.5 pr-3 flex items-center">
            <ColorWell label={t('customizer.wallBg')} value={fondo} onChange={onFondo} lados={LADOS_BARRA} />
          </div>
          {onWallpaper && (
            <>
              <button
                type="button"
                onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; onWallpaper() }}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                className="shop-btn shop-btn--primary burbuja-vidrio tecla-amarilla h-[52px] px-5 gap-2 text-[13px] whitespace-nowrap"
              >
                <IconoTinta nombre="pantalla" tam={30} />
                {t('customizer.wallpaper')}
              </button>
            </>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
