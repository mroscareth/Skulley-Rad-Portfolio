import React from 'react'

// Un color del personaje: círculo con el color que tiene y, encima, el
// selector nativo invisible (tocarlo lo abre). El nombre de la parte abajo.
// Lo comparten el personalizador de escritorio y el de teléfono.
export default function ColorWell({ label, value, onChange }) {
  return (
    <label className="relative flex flex-col items-center gap-1 cursor-pointer">
      <span className="relative block w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-white/25 hover:border-white/60 transition-all overflow-hidden shadow-elev-sm">
        <span className="absolute inset-0 rounded-full" style={{ backgroundColor: value }} aria-hidden />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={label}
        />
      </span>
      <span className="text-[9px] md:text-[10px] opacity-80 leading-none">{label}</span>
    </label>
  )
}
