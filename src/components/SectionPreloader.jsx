import { useEffect, useState, useRef } from 'react'
import CargandoAnillo from './ui/CargandoAnillo.jsx'

/**
 * SectionPreloader — el preloader entre secciones: el color de la sección de
 * destino y, al centro, el loading del sitio (CargandoAnillo: la mascota y
 * LOADING / CARGANDO en runas alrededor; antes era una barra con la mascota
 * encima, Oscar la cambió). El progreso ya no se dibuja, pero sigue marcando
 * cuándo se cumple el mínimo y cuándo avisar (onComplete).
 */

// Section color mapping (should match sectionColors in App.jsx)
const sectionColors = {
  home: '#0f172a',
  section1: '#00bfff', // Work - cyan
  section2: '#39ff14', // About - neon green
  section3: '#e600ff', // Side Quests - magenta
  section4: '#f5ff00', // Contact - neon yellow
  section5: '#ff6b00', // Blog - orange neon
  section6: '#ff2200', // Runic Codex - lava red / antimatter
}

// El texto del loading en tinta sobre los colores claros (el amarillo de
// Contacto), como sus marquees; blanco en los demás.
function colorDeTexto(bgColor) {
  const hex = bgColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0a0510' : '#ffffff'
}

export default function SectionPreloader({
  visible = false,
  fading = false,
  targetSection = 'section1',
  durationMs = 2000,
  // Modo "ready" (opcional): en vez de duración fija, la barra avanza hasta
  // 90% en durationMs y solo completa cuando `ready` es true (o al agotar
  // maxWaitMs para no bloquear en redes lentas). Con ready === undefined el
  // comportamiento es el clásico de duración fija.
  ready,
  maxWaitMs = 4000,
  onComplete,
}) {
  const [, setProgress] = useState(0)
  const rafRef = useRef(null)
  const onCompleteRef = useRef(onComplete)
  const hasCompletedRef = useRef(false)
  const readyRef = useRef(ready)

  // Keep onComplete ref updated without triggering effect
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    readyRef.current = ready
  }, [ready])

  // Get colors based on target section
  const bgColor = sectionColors[targetSection] || sectionColors.section1

  // Progress animation with visible increments
  useEffect(() => {
    if (!visible) {
      setProgress(0)
      hasCompletedRef.current = false
      if (rafRef.current) {
        clearInterval(rafRef.current)
        rafRef.current = null
      }
      return
    }

    // Prevent re-running if already completed
    if (hasCompletedRef.current) return

    // Reset to 0 when starting
    setProgress(0)

    // Update every 80ms with small increments for visible movement
    const stepMs = 80
    const readyMode = ready !== undefined
    const totalSteps = durationMs / stepMs
    const increment = 100 / totalSteps
    let current = 0
    let elapsed = 0

    const finish = () => {
      setProgress(100)
      clearInterval(rafRef.current)
      rafRef.current = null
      hasCompletedRef.current = true
      if (onCompleteRef.current) onCompleteRef.current()
    }

    rafRef.current = setInterval(() => {
      elapsed += stepMs
      if (readyMode) {
        if (elapsed >= durationMs && (readyRef.current || elapsed >= maxWaitMs)) {
          finish()
        } else if (elapsed < durationMs) {
          current = Math.min(90, (elapsed / durationMs) * 90)
          setProgress(current)
        } else {
          // Esperando assets: avance lento 90 → 97 para que no se sienta congelada
          current = Math.min(97, current + 0.4)
          setProgress(current)
        }
        return
      }
      current += increment
      if (current >= 100) {
        finish()
      } else {
        setProgress(current)
      }
    }, stepMs)

    return () => {
      if (rafRef.current) {
        clearInterval(rafRef.current)
        rafRef.current = null
      }
    }
  }, [visible, durationMs])

  if (!visible) return null

  return (
    <div
      data-section-preloader
      className="fixed inset-0 z-[200001] flex flex-col items-center justify-center pointer-events-none"
      style={{
        backgroundColor: bgColor,
        opacity: fading ? 0 : 1,
        transition: 'opacity 350ms ease-out',
      }}
      aria-hidden
    >
      <div style={{ animation: 'irisFade 280ms ease-out both' }}>
        <CargandoAnillo color={colorDeTexto(bgColor)} tam={320} />
      </div>
    </div>
  )
}
