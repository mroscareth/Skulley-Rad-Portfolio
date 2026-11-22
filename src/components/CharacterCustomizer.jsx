import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LockClosedIcon, SwatchIcon } from '@heroicons/react/24/solid'
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

// Lentes (silueta Wayfarer) para el botón del prop.
function LentesIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M2 11.2c0-.9.7-1.5 1.6-1.6 3.9-.3 7.8-.4 11.4.5.6.2 1.4.2 2 0 3.6-.9 7.5-.8 11.4-.5.9.1 1.6.7 1.6 1.6v1.1c0 .6-.4 1-.9 1.2-.4.1-.7.5-.8.9l-1.2 4.9c-.3 1.3-1.5 2.2-2.8 2.2h-3.6c-1.4 0-2.6-1-2.9-2.3l-.6-2.8c-.1-.6-.6-1-1.2-1s-1.1.4-1.2 1l-.6 2.8c-.3 1.3-1.5 2.3-2.9 2.3H7.7c-1.3 0-2.5-.9-2.8-2.2l-1.2-4.9c-.1-.4-.4-.8-.8-.9-.5-.2-.9-.6-.9-1.2z" />
    </svg>
  )
}

// Lentes 3D de frente (armazón cuadrado con la muesca de la nariz; una mica llena y la otra con su
// brillo, porque el ícono es de un color y la roja y la azul no se distinguirían) para el botón del prop.
function Lentes3DIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M3.6 9h24.8c.9 0 1.6.7 1.6 1.6v9.8c0 .9-.7 1.6-1.6 1.6h-8.6l-1-3.4c-.3-1-1.3-1.7-2.4-1.7h-.8c-1.1 0-2.1.7-2.4 1.7l-1 3.4H3.6c-.9 0-1.6-.7-1.6-1.6v-9.8C2 9.7 2.7 9 3.6 9zM4.6 11.4h7.6c.4 0 .8.4.8.8v4.6l-.9 2.8H4.6c-.4 0-.8-.4-.8-.8v-6.6c0-.4.4-.8.8-.8zM27.4 11.4h-7.6c-.4 0-.8.4-.8.8v4.6l.9 2.8h7.5c.4 0 .8-.4.8-.8v-6.6c0-.4-.4-.8-.8-.8z" />
      <path d="M26.6 12.4h-6c-.3 0-.6.3-.6.6v3.9l.7 1.7h5.9c.3 0 .6-.3.6-.6v-5c0-.3-.3-.6-.6-.6zM6 17.6l4.4-4.4.9.9-4.4 4.4z" />
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

// Chamarra abierta con sus picos en los hombros para el botón del prop.
function ChamarraIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M8.6 6.2L12.6 5 16 10.5 19.4 5l4 1.2 4.2 2.4c.7.4 1.1 1 1.2 1.8L30 23.6c.1.8-.4 1.4-1.2 1.5l-2.2.3c-.7.1-1.3-.4-1.4-1.1L24 14.5v11.9c0 .7-.6 1.2-1.2 1.2H9.2c-.6 0-1.2-.5-1.2-1.2V14.5l-1.2 9.8c-.1.7-.7 1.2-1.4 1.1l-2.2-.3c-.8-.1-1.3-.7-1.2-1.5l1.2-13.2c.1-.8.5-1.4 1.2-1.8zM15.2 12h1.6v15.6h-1.6z" />
      <path d="M5.6 7.9l.7-2.9 1.4 2.3zM8.4 6.8l.6-2.9 1.5 2.2zM11.1 5.9l.5-2.9 1.6 2.1zM26.4 7.9l-.7-2.9-1.4 2.3zM23.6 6.8l-.6-2.9-1.5 2.2zM20.9 5.9l-.5-2.9-1.6 2.1z" />
    </svg>
  )
}

// Hoodie con la capucha, sus cordones y el resorte de abajo para el botón del prop.
function HoodieIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M11 6.6C11.6 4.4 13.6 3 16 3s4.4 1.4 5 3.6l2.6.8 4 2.2c.7.4 1.1 1 1.2 1.8L30 23.6c.1.8-.4 1.4-1.2 1.5l-2.2.3c-.7.1-1.3-.4-1.4-1.1L24 14.5v11.9c0 .7-.6 1.2-1.2 1.2H9.2c-.6 0-1.2-.5-1.2-1.2V14.5l-1.2 9.8c-.1.7-.7 1.2-1.4 1.1l-2.2-.3c-.8-.1-1.3-.7-1.2-1.5l1.2-13.2c.1-.8.5-1.4 1.2-1.8l4-2.2zM13.2 7.4C13.6 5.8 14.7 5 16 5s2.4.8 2.8 2.4L16 10.2zM14 10.6h1v4.6h-1zM17 10.6h1v4.6h-1zM8 24.2h16v.9H8z" />
    </svg>
  )
}

// Tenis de bota de lado (caña, agujetas y suela con su línea) para el botón del prop.
function TenisIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M5 22V6.4C5 5.6 5.6 5 6.4 5h6.2c.8 0 1.4.6 1.4 1.4v5l4 2.6 7.2 2.4c2.3.8 3.8 2.9 3.8 5.3V22zM15.2 12.4h1.6v1.4h-1.6zM17.8 14.2h1.6v1.4h-1.6zM20.4 16h1.6v1.4h-1.6z" />
      <path d="M3 23.2h26c.6 0 1 .4 1 1v1.4c0 1.3-1.1 2.4-2.4 2.4H4.4C3.1 28 2 26.9 2 25.6v-1.4c0-.6.4-1 1-1zM4 25.2v.9h24v-.9z" />
    </svg>
  )
}

// Chamarra inflada (gajos, cierre, cuello de rollo y los picos de las mangas) para el botón del prop.
function InfladaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M8.6 6.6L12 5.4c1 1.2 2.4 1.8 4 1.8s3-.6 4-1.8l3.4 1.2 4.2 2.4c.7.4 1.1 1 1.2 1.8L30 23.6c.1.8-.4 1.4-1.2 1.5l-2.2.3c-.7.1-1.3-.4-1.4-1.1L24 14.5v11.9c0 .7-.6 1.2-1.2 1.2H9.2c-.6 0-1.2-.5-1.2-1.2V14.5l-1.2 9.8c-.1.7-.7 1.2-1.4 1.1l-2.2-.3c-.8-.1-1.3-.7-1.2-1.5l1.2-13.2c.1-.8.5-1.4 1.2-1.8zM15.6 8.4h.8v19.2h-.8zM8 12.6h7v.8H8zM17 12.6h7v.8h-7zM8 17h7v.8H8zM17 17h7v.8h-7zM8 21.4h7v.8H8zM17 21.4h7v.8h-7z" />
      <path d="M11.4 4.6c1 1.5 2.7 2.4 4.6 2.4s3.6-.9 4.6-2.4l1.3.6c-1.3 2.1-3.4 3.3-5.9 3.3s-4.6-1.2-5.9-3.3zM4.4 9.4L1.7 9.9l2.3 1.6zM3.9 13.4l-2.6.5 2.2 1.6zM3.4 17.4l-2.4.6 2.1 1.4zM27.6 9.4l2.7.5-2.3 1.6zM28.1 13.4l2.6.5-2.2 1.6zM28.6 17.4l2.4.6-2.1 1.4z" />
    </svg>
  )
}

// Bota de lado (punta afilada, correa del tobillo con su hebilla, correa del empeine y suela gruesa) para el botón del prop.
function BotasIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M7 21.6V5.2C7 4.5 7.5 4 8.2 4h6.2c.7 0 1.2.5 1.2 1.2v8.2l5.2 2.4 6.8 3c1 .5 1.6 1.4 1.6 2.5v.3z" />
      <path d="M5.6 8.6h11.6v3.2H5.6zM12.8 9.5h2.2v1.4h-2.2zM15.2 13.4l2.4-1.3 3.8 6.6-2.4 1.3z" />
      <path d="M3.6 22.8h26.6c.5 0 .8.5.6 1l-1.2 2.6c-.5 1-1.5 1.6-2.6 1.6H5c-1.1 0-2-.9-2-2v-2.6c0-.3.3-.6.6-.6zM4.6 25h23.6v.8H4.6z" />
    </svg>
  )
}

// Pantalones de mezclilla con la pretina y su botón, el roto de cada rodilla y los rollos de abajo para el botón del prop.
function PantalonesIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M8.6 3h14.8c.4 0 .7.3.7.7v2.6c0 .4-.3.7-.7.7H8.6c-.4 0-.7-.3-.7-.7V3.7c0-.4.3-.7.7-.7zM16 4.1a.9.9 0 1 0 0 1.8.9.9 0 1 0 0-1.8z" />
      <path d="M8 7.8h16l1.5 17.2h-6.3L16 12.6 12.8 25H6.5zM9.2 16c.6-.8 2.8-.8 3.4 0-.6.8-2.8.8-3.4 0zM19.4 16c.6-.8 2.8-.8 3.4 0-.6.8-2.8.8-3.4 0z" />
      <path d="M6.2 25.6h6.8v2.6c0 .4-.3.7-.7.7H6.9c-.4 0-.7-.3-.7-.7zM19 25.6h6.8v2.6c0 .4-.3.7-.7.7h-5.4c-.4 0-.7-.3-.7-.7z" />
    </svg>
  )
}

// Muñequera de frente (el aro con su hueco y los picos del lado de afuera, cada uno con su tornillo) para el botón del prop.
function MunequerasIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M16 9.2a8.4 8.4 0 1 0 0 16.8a8.4 8.4 0 1 0 0-16.8zM16 12.7a4.9 4.9 0 1 1 0 9.8a4.9 4.9 0 1 1 0-9.8z" />
      <path d="M23.8 18.1L29.3 12.7 21.7 12.2zM21.9 12.4L22 4.7 16.2 9.8zM16.5 9.8L11.1 4.3 10.6 11.9zM10.8 11.7L3.1 11.6 8.2 17.4zM8.2 17.1L2.7 22.5 10.3 23zM26.25 14.18a.85.85 0 1 0-1.7 0 .85.85 0 1 0 1.7 0zM21.08 8.54a.85.85 0 1 0-1.7 0 .85.85 0 1 0 1.7 0zM13.43 8.2a.85.85 0 1 0-1.7 0 .85.85 0 1 0 1.7 0zM7.79 13.37a.85.85 0 1 0-1.7 0 .85.85 0 1 0 1.7 0zM7.45 21.02a.85.85 0 1 0-1.7 0 .85.85 0 1 0 1.7 0z" />
    </svg>
  )
}

// Beanie largo de lado (la copa aguada que cae hacia atrás, el dobladillo acanalado y su etiqueta) para el botón del prop.
function BeanieIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M6.4 17.6C6.4 10.4 10.4 5 16.6 5c4.8 0 8.6 2.4 11 6.2 1.6 2.6 1.4 5.2-.4 6.4z" />
      <path d="M5.4 18.8h21.2c.8 0 1.4.6 1.4 1.4v4.4c0 .8-.6 1.4-1.4 1.4H5.4c-.8 0-1.4-.6-1.4-1.4v-4.4c0-.8.6-1.4 1.4-1.4zM7.6 20.2h.9v4.4h-.9zM10.2 20.2h.9v4.4h-.9zM12.8 20.2h.9v4.4h-.9zM15.4 20.2h.9v4.4h-.9zM18.4 20.6h5.4v3.4h-5.4z" />
    </svg>
  )
}

export const ICONOS_PROP = { lentes: LentesIcon, lentes3d: Lentes3DIcon, boxers: BoxersIcon, pantalones: PantalonesIcon, chamarra: ChamarraIcon, hoodie: HoodieIcon, tenis: TenisIcon, inflada: InfladaIcon, botas: BotasIcon, munequeras: MunequerasIcon, beanie: BeanieIcon }

// Íconos de las partes del cuerpo (pestaña Props).
function CabezaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M16 3C9.4 3 5 7.4 5 13.2c0 3.4 1.6 6.1 4.2 7.6V24c0 1.1.9 2 2 2h1.3v-2.2h1.6V26h3.8v-2.2h1.6V26H21c1.1 0 2-.9 2-2v-3.2c2.6-1.5 4.2-4.2 4.2-7.6C27 7.4 22.6 3 16 3zM11.6 12.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zM20.4 12.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zM16 17.6l-1.3 2.3h2.6z" />
    </svg>
  )
}
function TorsoIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M11 4.5L4.6 7.4 2 13.6l4.5 2L8 14.2v12.3c0 .6.4 1 1 1h14c.6 0 1-.4 1-1V14.2l1.5 1.4 4.5-2-2.6-6.2L21 4.5c-.6 1.8-2.6 3-5 3s-4.4-1.2-5-3z" />
    </svg>
  )
}
function MunecasIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M12.5 3h7l.8 6.2A7 7 0 0 1 23 15a7 7 0 0 1-2.7 5.8L19.5 29h-7l-.8-8.2A7 7 0 0 1 9 15a7 7 0 0 1 2.7-5.8zM16 10.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2z" />
      <path d="M15.4 12h1.2v3.3l2.2 1.3-.6 1-2.8-1.6z" />
    </svg>
  )
}
function PiernasIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M8.6 3h14.8c.5 0 .9.4 1 .9l2 23.9c0 .6-.4 1.2-1 1.2h-5c-.5 0-.9-.3-1-.8L16 13.6l-3.4 14.6c-.1.5-.5.8-1 .8h-5c-.6 0-1-.6-1-1.2l2-23.9c.1-.5.5-.9 1-.9z" />
    </svg>
  )
}
function PiesIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M9 5h6c.6 0 1 .4 1 1v8.4l8.3 3c2.2.8 3.7 2.9 3.7 5.2V24H4v-2.6c0-1 .3-2 .9-2.8L8 14.2V6c0-.6.4-1 1-1z" />
      <path d="M4 25.4h24V27c0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1z" />
    </svg>
  )
}

// Props por parte del cuerpo (Oscar, 2026-11-17): a la izquierda la parte y a
// la derecha lo que hay para ella. Un prop nuevo va en ACCESORIOS (con
// `parte`, o aquí en PARTE_DE) y en ICONOS_PROP.
const PARTES = [
  { id: 'cabeza', es: 'Cabeza', en: 'Head', Icono: CabezaIcon },
  { id: 'torso', es: 'Torso', en: 'Torso', Icono: TorsoIcon },
  { id: 'munecas', es: 'Muñecas', en: 'Wrists', Icono: MunecasIcon },
  { id: 'piernas', es: 'Piernas', en: 'Legs', Icono: PiernasIcon },
  { id: 'pies', es: 'Pies', en: 'Feet', Icono: PiesIcon },
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
              className={`relative grid place-items-center w-12 h-12 md:w-16 md:h-16 rounded-full border-2 transition-all bg-black/35 backdrop-blur-md ${activa ? 'border-white shadow-[0_0_14px_rgba(255,255,255,0.5)] scale-105 text-white' : 'border-white/20 hover:border-white/60 text-white/80 shadow-elev-sm'}`}
            >
              <p.Icono className="w-7 h-7 md:w-9 md:h-9" />
              {conAlgo && <span className="absolute top-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-amarillo border-2 border-black/70" aria-hidden="true" />}
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
        const Icono = ICONOS_PROP[a.id] || LentesIcon
        if (!propDesbloqueado(a.id)) {
          const pista = pistaDeProp(a.id, lang)
          return (
            <div key={a.id} className="cc-pieza group relative flex flex-col items-center">
              <button
                type="button"
                disabled
                aria-label={`${nombre}: ${lang === 'es' ? 'bloqueado' : 'locked'}`}
                className="relative grid place-items-center w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-white/[0.08] bg-black/35 backdrop-blur-md text-white/35 cursor-not-allowed shadow-elev-sm"
              >
                <Icono className="w-7 h-7 md:w-9 md:h-9" />
                <span className="absolute inset-0 rounded-full grid place-items-center bg-black/45">
                  <LockClosedIcon className="w-4 h-4 text-white/85" />
                </span>
              </button>
              <div className="mt-1 w-12 md:w-16 text-[9px] md:text-[10px] text-center leading-tight opacity-80 truncate">{nombre}</div>
              <div className={`pointer-events-none absolute px-2.5 py-1.5 rounded-lg bg-black/90 border border-white/10 text-[10px] text-white/85 w-40 text-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 ${enFila ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : 'right-full top-0 mr-2'}`}>
                {lang === 'es' ? 'No has ganado este prop' : "You haven't earned this prop"}
                {pista && <><br /><span className="opacity-60">{pista}</span></>}
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
  { id: 'skins', es: 'Skins', en: 'Skins', Icono: SwatchIcon },
  { id: 'props', es: 'Props', en: 'Props', Icono: TorsoIcon },
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
    <div role="tablist" aria-label={lang === 'es' ? 'Guardarropa' : 'Wardrobe'} onKeyDown={onKeyDown} className={`relative flex ${enBarra ? 'nav-tinta__placa' : 'gap-1.5'} ${centradas ? 'justify-center' : ''}`}>
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
            className={enBarra
              ? `nav-tinta__item font-marquee flex items-center gap-2 whitespace-nowrap${activa ? ' es-activa' : ''}`
              : 'shop-chip h-9 px-4 text-[10px] whitespace-nowrap bg-black/35 backdrop-blur-md [text-shadow:none]'}
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
