import React, { useEffect, useRef, useState } from 'react'
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
function isES() {
  try { return (document.documentElement.lang || 'en').toLowerCase().startsWith('es') } catch { return false }
}

export default function ThunderEatMenu() {
  const [menu, setMenu] = useState(null) // { x, y, color }
  const [armed, setArmed] = useState(false)
  const [toast, setToast] = useState(null) // { text }
  const toastTimerRef = useRef(null)

  useEffect(() => {
    const onOffer = (e) => {
      const d = e?.detail || {}
      setMenu({ x: d.screenX || 0, y: d.screenY || 0, color: d.color || '#a855f7' })
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

  // Click fuera del menú = cerrar sin comer. Delay 0 para no atrapar el mismo
  // gesto de click derecho que lo abrió.
  useEffect(() => {
    if (!menu) return
    const onDown = (e) => {
      if (e.target?.closest?.('[data-thunder-menu]')) return
      setMenu(null)
      try { window.dispatchEvent(new CustomEvent('thunder:cancel')) } catch { }
    }
    const id = setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0)
    return () => { clearTimeout(id); window.removeEventListener('pointerdown', onDown, true) }
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
  const accent = menu?.color || '#a855f7'
  const vw = typeof window !== 'undefined' ? window.innerWidth : 9999
  const vh = typeof window !== 'undefined' ? window.innerHeight : 9999

  return (
    <>
      {menu && (
        <div
          data-thunder-menu
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: 'fixed',
            left: Math.max(8, Math.min(menu.x, vw - 232)),
            top: Math.max(8, Math.min(menu.y, vh - 150)),
            zIndex: 100000,
            width: 224,
            padding: '14px 14px 12px',
            borderRadius: 10,
            backgroundColor: 'rgba(10, 10, 20, 0.96)',
            border: `2px solid ${accent}`,
            boxShadow: `0 0 28px ${accent}66, inset 0 0 18px ${accent}22`,
            fontFamily: "'Cascadia Code', ui-monospace, monospace",
            userSelect: 'none',
            backdropFilter: 'blur(3px)',
          }}
        >
          <p style={{ margin: 0, fontSize: 10, letterSpacing: 1, color: `${accent}aa`, textTransform: 'uppercase' }}>
            {'// forbidden_ritual'}
          </p>
          <p style={{ margin: '8px 0 14px', fontSize: 15, fontWeight: 700, color: '#fff', textShadow: `0 0 12px ${accent}` }}>
            {es ? '¿Comer el orbe?' : 'Eat the orb?'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={eat}
              style={{
                flex: 1,
                padding: '8px 0',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#0a0a14',
                background: accent,
                border: `1px solid ${accent}`,
                borderRadius: 6,
                boxShadow: `0 0 14px ${accent}99`,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {es ? 'Sí' : 'Yes'}
            </button>
            <button
              onClick={decline}
              style={{
                flex: 1,
                padding: '8px 0',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#cbd5e1',
                background: 'transparent',
                border: '1px solid #475569',
                borderRadius: 6,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {es ? 'No' : 'No'}
            </button>
          </div>
        </div>
      )}

      {armed && (
        <div
          style={{
            position: 'fixed',
            bottom: 'clamp(80px, 14vh, 170px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            pointerEvents: 'none',
            padding: '8px 18px',
            borderRadius: 999,
            backgroundColor: 'rgba(10, 10, 20, 0.82)',
            border: '1px solid #a855f7',
            boxShadow: '0 0 22px #a855f766',
            color: '#f3e8ff',
            fontFamily: "'Cascadia Code', ui-monospace, monospace",
            fontSize: 12,
            letterSpacing: 0.5,
            whiteSpace: 'nowrap',
            animation: 'thunderHintPulse 1.4s ease-in-out infinite',
          }}
        >
          {es ? '⚡ Click para invocar el rayo · ESC para cancelar' : '⚡ Click to call the lightning · ESC to cancel'}
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 'clamp(70px, 12vh, 120px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            pointerEvents: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            backgroundColor: 'rgba(10, 10, 20, 0.9)',
            border: '1px solid #64748b',
            color: '#e2e8f0',
            fontFamily: "'Cascadia Code', ui-monospace, monospace",
            fontSize: 12,
          }}
        >
          {toast.text}
        </div>
      )}

      <style>{`@keyframes thunderHintPulse { 0%,100% { opacity: 0.78 } 50% { opacity: 1 } }`}</style>
    </>
  )
}
