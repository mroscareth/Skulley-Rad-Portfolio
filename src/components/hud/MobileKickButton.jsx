import React, { useRef, useState } from 'react'
import KickIcon from '../icons/KickIcon.jsx'

// Botón de patada táctil: mantener = cargar, soltar = patear. Simula la barra
// espaciadora (la escucha Player.jsx), igual que el ⚡ simula la E del poder.
// Pointer capture + touch-action:none para que el press no se "trabe" si el
// dedo se mueve fuera del botón.
const press = (type) => {
  try { window.dispatchEvent(new KeyboardEvent(type, { key: ' ', code: 'Space' })) } catch { }
}

export default function MobileKickButton({ label, style }) {
  const [pressing, setPressing] = useState(false)
  const activeRef = useRef(false)

  const start = (e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { }
    if (activeRef.current) return
    activeRef.current = true
    setPressing(true)
    press('keydown')
  }
  const end = () => {
    if (!activeRef.current) return
    activeRef.current = false
    setPressing(false)
    press('keyup')
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
      className={`fixed z-[12010] grid place-items-center rounded-full bg-[#22d3ee] text-[#0a0510] border-[3px] select-none outline-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${pressing ? 'border-white' : 'border-[#0a0510]/20'}`}
      style={{
        width: 56,
        height: 56,
        touchAction: 'none',
        transform: pressing ? 'scale(1.18)' : 'none',
        transition: 'transform 110ms cubic-bezier(0.16, 1, 0.3, 1), border-color 110ms linear',
        ...style,
      }}
    >
      <KickIcon className="w-7 h-7" />
    </button>
  )
}
