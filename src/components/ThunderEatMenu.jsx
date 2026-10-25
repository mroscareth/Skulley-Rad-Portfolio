import React, { useEffect, useRef, useState } from 'react'
import { BoltIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'

// ThunderEatMenu — overlay HTML del easter egg "comer el orbe maldito".
// Self-contained: escucha eventos window que dispara HomeOrbs y emite de vuelta
// la decisión del usuario. No recibe props → se monta una vez en App.
//
// Protocolo de eventos:
//   thunder:offer    {screenX, screenY, color}  HomeOrbs → aquí (abre menú)
//   thunder:eat                                  aquí → HomeOrbs (confirmó)
//   thunder:cancel                               aquí → HomeOrbs (declinó/cerró)
//   thunder:armed                                HomeOrbs → aquí (modo apuntado)
//   thunder:cast                                 HomeOrbs → aquí (rayo lanzado)
//   thunder:cooldown {remMs}                     HomeOrbs → aquí (en recarga)
//
// Idioma: lee document.documentElement.lang (LanguageProvider lo sincroniza),
// sin acoplar al hook → cero dependencias.
//
// Lenguaje toon (§14): superficie plana #0d0714, borde sólido 2px, Outfit,
// botones pill. El color del orbe maldito entra solo como borde/fill plano.
function isES() {
  try { return (document.documentElement.lang || 'en').toLowerCase().startsWith('es') } catch { return false }
}

const CURSED_DEFAULT = '#a855f7'
const MENU_W = 240
const MENU_H = 140
const SURFACE = '#0d0714'
const INK = '#0a0510'

// Última palabra en el color del orbe (misma firma que los diálogos de Argus).
function AccentLastWord({ text, color }) {
  const idx = text.lastIndexOf(' ')
  if (idx < 0) return <span style={{ color }}>{text}</span>
  return (
    <>
      {text.slice(0, idx + 1)}
      <span style={{ color }}>{text.slice(idx + 1)}</span>
    </>
  )
}

export default function ThunderEatMenu() {
  const [menu, setMenu] = useState(null) // { x, y, color }
  const [armed, setArmed] = useState(false)
  const [toast, setToast] = useState(null) // { text }
  const toastTimerRef = useRef(null)
  // El hint de apuntado sale después de cerrar el menú: guarda el color del
  // orbe que se comió para seguir hablando en ese acento.
  const colorRef = useRef(CURSED_DEFAULT)

  useEffect(() => {
    const onOffer = (e) => {
      const d = e?.detail || {}
      const color = d.color || CURSED_DEFAULT
      colorRef.current = color
      setMenu({ x: d.screenX || 0, y: d.screenY || 0, color })
      try { playSfx('hover', { volume: 0.5 }) } catch { }
    }
    const onArmed = () => { setMenu(null); setArmed(true) }
    const onCast = () => setArmed(false)
    const onCooldown = (e) => {
      const remMs = e?.detail?.remMs || 0
      const total = Math.ceil(remMs / 1000)
      const mm = Math.floor(total / 60)
      const ss = total % 60
      const time = `${mm}:${String(ss).padStart(2, '0')}`
      setToast({ text: isES() ? `Poder en recarga — ${time}` : `Power recharging — ${time}` })
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setToast(null), 2200)
    }
    window.addEventListener('thunder:offer', onOffer)
    window.addEventListener('thunder:armed', onArmed)
    window.addEventListener('thunder:cast', onCast)
    window.addEventListener('thunder:cooldown', onCooldown)
    return () => {
      window.removeEventListener('thunder:offer', onOffer)
      window.removeEventListener('thunder:armed', onArmed)
      window.removeEventListener('thunder:cast', onCast)
      window.removeEventListener('thunder:cooldown', onCooldown)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Click fuera del menú (o Escape) = cerrar sin comer. Delay 0 para no
  // atrapar el mismo gesto de click derecho que lo abrió.
  useEffect(() => {
    if (!menu) return
    const cancel = () => {
      setMenu(null)
      try { window.dispatchEvent(new CustomEvent('thunder:cancel')) } catch { }
    }
    const onDown = (e) => {
      if (e.target?.closest?.('[data-thunder-menu]')) return
      cancel()
    }
    const onKey = (e) => { if (e.key === 'Escape') cancel() }
    const id = setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0)
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(id)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const eat = () => {
    setMenu(null)
    try { playSfx('click', { volume: 0.85 }) } catch { }
    try { window.dispatchEvent(new CustomEvent('thunder:eat')) } catch { }
  }
  const decline = () => {
    setMenu(null)
    try { playSfx('click', { volume: 0.5 }) } catch { }
    try { window.dispatchEvent(new CustomEvent('thunder:cancel')) } catch { }
  }

  const es = isES()
  const accent = menu?.color || colorRef.current
  const vw = typeof window !== 'undefined' ? window.innerWidth : 9999
  const vh = typeof window !== 'undefined' ? window.innerHeight : 9999
  const question = es ? '¿Comer el orbe?' : 'Eat the orb?'
  const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

  return (
    <>
      {menu && (
        <div
          data-thunder-menu
          role="dialog"
          aria-label={question}
          onContextMenu={(e) => e.preventDefault()}
          className="argus-beat"
          style={{
            position: 'fixed',
            left: Math.max(8, Math.min(menu.x, vw - MENU_W - 8)),
            top: Math.max(8, Math.min(menu.y, vh - MENU_H - 8)),
            zIndex: 100000,
            width: MENU_W,
            padding: '16px 16px 14px',
            borderRadius: 20,
            backgroundColor: SURFACE,
            border: `2px solid ${accent}`,
            fontFamily: 'var(--font-body)',
            userSelect: 'none',
          }}
        >
          <p className="argus-display text-white text-xl mb-3.5">
            <AccentLastWord text={question} color={accent} />
          </p>
          {/* El "Sí" de color va al final, a la derecha (DESIGN.md §4.6) */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={decline}
              className={`shop-btn shop-btn--ghost flex-1 h-11 text-sm ${focusRing}`}
            >
              No
            </button>
            <button
              type="button"
              onClick={eat}
              className={`shop-btn flex-1 h-11 text-sm ${focusRing}`}
              style={{ background: accent, borderColor: accent, color: INK }}
            >
              {es ? 'Sí' : 'Yes'}
            </button>
          </div>
        </div>
      )}

      {/* Wrappers a lo ancho para centrar sin translateX: así la entrada
          (.argus-beat, que anima transform) no pelea con el centrado. */}
      {armed && (
        <div
          role="status"
          className="fixed inset-x-0 flex justify-center px-4 pointer-events-none"
          style={{ bottom: 'clamp(80px, 14vh, 170px)', zIndex: 99999 }}
        >
          <div
            className="argus-beat flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-2xl sm:rounded-full text-white/90 text-xs sm:text-sm font-semibold text-center"
            style={{ backgroundColor: SURFACE, border: `2px solid ${colorRef.current}` }}
          >
            <BoltIcon className="w-4 h-4 shrink-0" style={{ color: colorRef.current }} aria-hidden />
            <span>{es ? 'Click para invocar el rayo · Esc para cancelar' : 'Click to call the lightning · Esc to cancel'}</span>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 flex justify-center px-4 pointer-events-none"
          style={{ top: 'clamp(70px, 12vh, 120px)', zIndex: 99999 }}
        >
          <div
            className="argus-beat flex items-center min-h-[40px] px-5 rounded-full border-2 border-white/[0.12] text-white/85 text-sm font-semibold tabular-nums"
            style={{ backgroundColor: SURFACE }}
          >
            {toast.text}
          </div>
        </div>
      )}
    </>
  )
}
