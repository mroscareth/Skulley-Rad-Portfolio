import React from 'react'
import { SignalIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../../lib/sfx.js'

// Botón redondo que abre la terminal de M.A.D.R.E. Diseñado para montarse
// inline dentro del grupo top-right del App (junto al botón de login), no
// como floating button. El padre se encarga del positioning y las animaciones
// de entrada/salida del UI.
//
// Matches el estilo de los otros botones del top-right group:
//   h-11 w-11 md:h-12 md:w-12 rounded-full bg-black/40 backdrop-blur-3xl
//
// Lo que lo diferencia visualmente del resto: un ring azul sutil + un dot
// pulsante en esquina que indica "presencia" de M.A.D.R.E. Es el único botón
// del grupo con acento azul — firma canónica de M.A.D.R.E.

export default function MadreTerminalButton({ onOpen, available = true, hasUnread = false }) {
  const handleClick = () => {
    try { playSfx('click', { volume: 1.0 }) } catch { }
    onOpen?.()
  }

  const handleHover = () => {
    try { playSfx('hover', { volume: 0.9 }) } catch { }
  }

  return (
    <>
      <style>{`
        @keyframes madreButtonPresence {
          0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(96, 165, 250, 0.25), 0 0 14px rgba(59, 130, 246, 0.18); }
          50% { box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(96, 165, 250, 0.45), 0 0 22px rgba(59, 130, 246, 0.32); }
        }
        @keyframes madreDotPulse {
          0%, 100% { opacity: 0.95; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.75); }
        }
        .madre-btn-present { animation: madreButtonPresence 2.4s ease-in-out infinite; }
        .madre-btn-dot { animation: madreDotPulse 1.6s ease-in-out infinite; }
      `}</style>

      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          onMouseEnter={handleHover}
          aria-label={available ? 'Open secure channel with M.A.D.R.E.' : 'M.A.D.R.E. channel currently unavailable'}
          title={available ? 'M.A.D.R.E. — secure channel' : 'M.A.D.R.E. — not now'}
          className={`h-11 w-11 md:h-12 md:w-12 rounded-full grid place-items-center backdrop-blur-3xl border transition-colors ${
            available
              ? 'bg-black/40 border-blue-400/40 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200 hover:border-blue-400/60 madre-btn-present'
              : 'bg-black/40 border-white/[0.08] text-slate-600 opacity-60'
          }`}
        >
          <SignalIcon className="w-5 h-5" />
        </button>
        {/* Dot pulsante de presencia, esquina top-right del botón */}
        {available && (
          <div
            className="madre-btn-dot absolute -top-0.5 -right-0.5 w-[9px] h-[9px] rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.9)] ring-2 ring-[#0a0a14] pointer-events-none"
          />
        )}
        {/* Badge unread (rojo) — si hay mensaje pendiente, sobrepone al dot azul */}
        {hasUnread && (
          <div
            className="absolute -top-0.5 -right-0.5 w-[10px] h-[10px] rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] ring-2 ring-[#0a0a14] pointer-events-none"
          />
        )}
      </div>
    </>
  )
}
