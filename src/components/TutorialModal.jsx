import React, { useEffect, useId, useRef, useState } from 'react'
import { BoltIcon, MusicalNoteIcon, PaintBrushIcon, VideoCameraIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useGlitchRunas, textoGlitch } from '../hooks/useGlitchRunas.js'
import { useTituloOrilla } from '../hooks/useTituloOrilla.js'
import KickIcon from './icons/KickIcon.jsx'

const STORAGE_KEY = 'tutorial_shown'

// Los controles del juego (rediseño de Oscar, 2026-11-13). Una sola caja que se
// arma por piezas como el trato de Argus (argus-arma / argus-sale en
// index.css): CONTROLES de orilla a orilla, que llega en runas y se glitchea a
// letras, y debajo los controles en dos columnas, cada uno con su tecla. Las
// teclas se encienden si las presionas de verdad. Se cierra con ¡Entendido!,
// Escape o clic afuera: en el bloque del título no cabe una X.
// En pantallas táctiles (el iPad juega con joystick) los renglones son los del
// mando táctil; en el teléfono no se juega.

const SALIDA_MS = 420
// Las runas del título se azotan una por una (300 ms + 80 ms por letra) y
// luego se glitchean a letras, solo de ida.
const GLITCH_TITULO_MS = 1500
const SIN_REGRESO_MS = 864e5

// e.code → la tecla que se enciende.
const CODIGOS = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e',
  ShiftLeft: 'shift', ShiftRight: 'shift', Space: 'espacio',
}

// Dos columnas parejas de alto: lo que hace Skulley y lo que hay alrededor.
const COLUMNAS = [
  [{ id: 'move' }, { id: 'kick' }, { id: 'laser' }],
  [{ id: 'camera' }, { id: 'portals' }, { id: 'argus' }, { id: 'portrait', soloTeclado: true }],
]

function TutorialModal({ t, open, onClose, tactil = false }) {
  const tituloId = useId()
  const cajaRef = useRef(null)

  const [saliendo, setSaliendo] = useState(false)
  const salidaRef = useRef(0)
  const salir = (despues) => {
    if (salidaRef.current) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { despues?.(); return }
    setSaliendo(true)
    salidaRef.current = setTimeout(() => {
      salidaRef.current = 0
      setSaliendo(false)
      try { despues?.() } catch { }
    }, SALIDA_MS)
  }
  const salirRef = useRef(salir)
  salirRef.current = salir
  useEffect(() => () => clearTimeout(salidaRef.current), [])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => { if (e?.key === 'Escape') salirRef.current(onClose) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // El foco entra a la caja y no al botón: así probar la barra espaciadora no
  // pica ¡Entendido!.
  useEffect(() => {
    if (!open) return
    try { cajaRef.current?.focus({ preventScroll: true }) } catch { }
  }, [open])

  const [armando, setArmando] = useState(true)
  useEffect(() => {
    if (!open) return undefined
    setArmando(true)
    const id = setTimeout(() => setArmando(false), 1900)
    return () => clearTimeout(id)
  }, [open])

  // El título: llega en runas y se glitchea a letras (solo de ida); ya en
  // letras, un clic lo regresa un rato a las runas con el hechizo, como el
  // nombre de Argus pero al revés (en `clic`, la fase `letras` es la otra
  // fuente: las runas).
  const titulo = t('tutorial.title')
  const orilla = useTituloOrilla(titulo)
  const llegada = useGlitchRunas(open, { sonido: false, sostieneMs: SIN_REGRESO_MS })
  const yaEnLetras = Boolean(llegada.fase?.letras && !llegada.fase?.tiembla)
  const clic = useGlitchRunas(open && yaEnLetras)
  useEffect(() => {
    if (!open) return undefined
    const id = setTimeout(llegada.disparar, GLITCH_TITULO_MS)
    return () => clearTimeout(id)
  }, [open, llegada.disparar])
  const fase = clic.fase || llegada.fase
  const enRunas = clic.fase ? clic.fase.letras : !llegada.fase?.letras

  // Las teclas que estás presionando, el botón del mouse y la rueda.
  const [presionadas, setPresionadas] = useState(() => new Set())
  useEffect(() => {
    if (!open) return undefined
    setPresionadas(new Set())
    if (tactil) return undefined
    const cambia = (id, si) => setPresionadas((s) => {
      if (s.has(id) === si) return s
      const n = new Set(s)
      if (si) n.add(id); else n.delete(id)
      return n
    })
    const onDown = (e) => { const id = CODIGOS[e.code]; if (id && !e.repeat) cambia(id, true) }
    const onUp = (e) => { const id = CODIGOS[e.code]; if (id) cambia(id, false) }
    const onPointerDown = (e) => { if (e.button === 0) cambia('clic', true) }
    const onPointerUp = () => cambia('clic', false)
    let ruedaId = 0
    const onWheel = () => {
      cambia('rueda', true)
      clearTimeout(ruedaId)
      ruedaId = setTimeout(() => cambia('rueda', false), 260)
    }
    const suelta = () => setPresionadas(new Set())
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('blur', suelta)
    return () => {
      clearTimeout(ruedaId)
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('blur', suelta)
    }
  }, [open, tactil])

  if (!open) return null

  const encendida = (id) => presionadas.has(id)
  const cerrar = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
    salir(onClose)
  }
  let n = 0

  return (
    <div
      className={`fixed inset-0 z-tutorial flex items-stretch sm:items-center justify-center p-0 sm:p-4 lg:p-8${armando ? ' argus-arma' : ''}${saliendo ? ' argus-sale pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      onPointerDown={(e) => { if (e.target === e.currentTarget) salir(onClose) }}
    >
      <div className="argus-arma__fondo absolute inset-0 bg-black/70 backdrop-blur-xl pointer-events-none" />

      <div
        ref={cajaRef}
        tabIndex={-1}
        className="site-modal site-modal--fit text-white outline-none"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="@container argus-linea argus-linea--abajo shrink-0 px-5 sm:px-8 lg:px-10 py-8 sm:py-10">
          <h2
            id={tituloId}
            className={`display-title select-none cursor-pointer ${orilla ? 'titulo-orilla' : 'display-title--lg'}${enRunas ? ' display-title--runas' : ''}${fase?.tiembla ? ' glitch-runas' : ''}`}
            style={orilla || undefined}
            onClick={clic.disparar}
            aria-label={titulo}
          >
            <span aria-hidden>
              {armando && !llegada.fase
                ? [...titulo].map((c, i) => <span key={i} className="argus-arma__runa" style={{ '--i': i }}>{c}</span>)
                : textoGlitch(titulo, fase)}
            </span>
          </h2>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-5 sm:px-8 lg:px-10 py-1 lg:py-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-14">
            {COLUMNAS.map((col, c) => (
              <ul key={c} className="tuto-columna">
                {col.filter((f) => !(tactil && f.soloTeclado)).map((f) => (
                  <li key={f.id} className="tuto-fila" style={{ '--i': n++ }}>
                    <div className="tuto-fila__cabeza">
                      <h3 className="argus-display tuto-fila__nombre">{t(`tutorial.${f.id}.title`)}</h3>
                      <div className="tuto-fila__glifo" aria-hidden>
                        {tactil ? <GlifoTactil id={f.id} /> : <GlifoTeclado id={f.id} t={t} encendida={encendida} />}
                      </div>
                    </div>
                    <p className="tuto-fila__texto">{t(`tutorial.${f.id}.${tactil && f.id !== 'portrait' ? 'touch' : 'desc'}`)}</p>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>

        <div className="argus-linea argus-linea--arriba shrink-0 px-5 sm:px-8 lg:px-10 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-white/55 min-w-0 leading-snug">{t(tactil ? 'tutorial.replayHintTouch' : 'tutorial.replayHint')}</p>
          <button
            type="button"
            onClick={cerrar}
            className="shop-btn shop-btn--primary shrink-0 min-h-[44px] px-6 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t('tutorial.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Una tecla de verdad: cara blanca, filo de tinta y su costado abajo; presionada se hunde en amarillo. */
function Tecla({ children, on = false, ancha = false }) {
  return (
    <span className={`tecla${ancha ? ' tecla--ancha' : ''}${on ? ' is-on' : ''}`}>
      <span className="tecla__cara">{children}</span>
    </span>
  )
}

/** El mouse toon: el botón izquierdo (arrastrar) y la rueda (zoom) se encienden al usarlos. */
function Raton({ encendida }) {
  const on = (id) => (encendida(id) ? 'is-on' : '')
  return (
    <svg className="raton" viewBox="0 0 64 96" aria-hidden>
      <rect className="raton__cuerpo" x="3" y="3" width="58" height="90" rx="29" />
      <path className={`raton__boton ${on('clic')}`} d="M32 3 A29 29 0 0 0 3 32 L3 40 L32 40 Z" />
      <line className="raton__linea" x1="32" y1="3" x2="32" y2="40" />
      <line className="raton__linea" x1="3" y1="40" x2="61" y2="40" />
      <rect className={`raton__rueda ${on('rueda')}`} x="26" y="13" width="12" height="20" rx="6" />
    </svg>
  )
}

function GlifoTeclado({ id, t, encendida }) {
  if (id === 'move') {
    return (
      <>
        {['w', 'a', 's', 'd'].map((k) => <Tecla key={k} on={encendida(k)}>{k}</Tecla>)}
        <Tecla on={encendida('shift')} ancha>Shift</Tecla>
      </>
    )
  }
  if (id === 'kick') return <><Tecla on={encendida('espacio')} ancha>{t('tutorial.space')}</Tecla><Raton encendida={encendida} /></>
  if (id === 'laser') return <><Tecla on={encendida('e')}>E</Tecla><Raton encendida={encendida} /></>
  if (id === 'camera') return <Raton encendida={encendida} />
  if (id === 'portrait') {
    return (
      <>
        <span className="tuto-boton"><PaintBrushIcon /></span>
        <span className="tuto-boton tuto-boton--amarillo"><MusicalNoteIcon /></span>
        <span className="tuto-boton"><VideoCameraIcon /></span>
      </>
    )
  }
  return null
}

function GlifoTactil({ id }) {
  if (id === 'move') return <span className="tuto-joystick"><span /></span>
  if (id === 'kick') return <span className="tuto-boton"><KickIcon /></span>
  if (id === 'laser') return <span className="tuto-boton tuto-boton--amarillo"><BoltIcon /></span>
  return null
}

/** Hook to manage whether the tutorial has been shown */
export function useTutorialShown() {
  const [shown, setShown] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const markAsShown = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
      setShown(true)
    } catch { }
  }

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setShown(false)
    } catch { }
  }

  return { shown, markAsShown, reset }
}

export default TutorialModal
