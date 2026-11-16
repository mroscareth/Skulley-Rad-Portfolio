import React, { useRef, useState } from 'react'
import { playSfx } from '../lib/sfx.js'
import SelectorColor from './ui/SelectorColor.jsx'

// Un color del personaje: círculo con el color que tiene y el nombre de la
// parte abajo; tocarlo abre el selector del sitio (ui/SelectorColor.jsx).
// Lo comparten el personalizador de escritorio, el de teléfono y el wallpaper;
// las clases `color-well*` son para que cada uno lo mida a su escala
// (.mcz-colores, .cc-fondo, .dwp-fondo) y para los vuelos de lib/vueloColores.
// `titulo` es el nombre que lleva el selector cuando la etiqueta no sirve
// (en el wallpaper la etiqueta del fondo es su hex); `lados`, hacia dónde
// prefiere abrirse el globo en escritorio.
export default function ColorWell({ label, value, onChange, titulo, lados }) {
  const [abierto, setAbierto] = useState(false)
  const botonRef = useRef(null)
  const circuloRef = useRef(null)

  const alternar = () => {
    if (!abierto) { try { playSfx('click', { volume: 1.0 }) } catch { } }
    setAbierto((a) => !a)
  }

  const cerrar = (devolverFoco) => {
    setAbierto(false)
    if (devolverFoco) botonRef.current?.focus({ preventScroll: true })
  }

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className="color-well relative flex flex-col items-center gap-1"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`${titulo || label}, ${String(value || '').toUpperCase()}`}
      >
        <span ref={circuloRef} className="color-well__swatch relative block w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-white/25 hover:border-white/60 transition-all overflow-hidden shadow-elev-sm">
          <span className="absolute inset-0 rounded-full" style={{ backgroundColor: value }} aria-hidden />
        </span>
        <span className="color-well__label text-[9px] md:text-[10px] opacity-80 leading-none" aria-hidden="true">{label}</span>
      </button>
      <SelectorColor
        abierto={abierto}
        anclaRef={circuloRef}
        valor={value}
        titulo={titulo || label}
        onCambio={onChange}
        onCerrar={cerrar}
        lados={lados}
      />
    </>
  )
}
