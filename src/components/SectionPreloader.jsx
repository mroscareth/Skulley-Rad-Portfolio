import { useEffect, useState, useRef } from 'react'

/**
 * SectionPreloader - Animated preloader with progressive loading bar
 * 
 * Features:
 * - Progress bar that fills from 0% to 100%
 * - GIF mascot that moves along with the progress
 * - Background color matches the target section
 * - Smooth fade-out animation
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

// Calculate contrasting bar color for visibility
function getContrastBarColor(bgColor) {
  // Parse hex color
  const hex = bgColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return a contrasting semi-transparent white or dark bar track
  return luminance > 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)'
}

// Get a lighter/brighter version of the section color for the progress fill
function getProgressFillColor(bgColor) {
  const hex = bgColor.replace('#', '')
  const r = Math.min(255, parseInt(hex.substring(0, 2), 16) + 60)
  const g = Math.min(255, parseInt(hex.substring(2, 4), 16) + 60)
  const b = Math.min(255, parseInt(hex.substring(4, 6), 16) + 60)
  return `rgb(${r}, ${g}, ${b})`
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
  const [progress, setProgress] = useState(0)
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
      className="fixed inset-0 z-[200001] flex flex-col items-center justify-center pointer-events-none"
      style={{
        backgroundColor: bgColor,
        opacity: fading ? 0 : 1,
        transition: 'opacity 350ms ease-out',
      }}
      aria-hidden
    >
      {/* Progress bar with mascot riding along it */}
      <div className="w-[85vw] max-w-[560px] px-4">
        {/* Progress bar track - flat design, responsive */}
        <div
          className="relative overflow-visible rounded-full w-full h-4 sm:h-5 md:h-6 border-2 sm:border-[3px] md:border-4 border-white"
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}
        >
          {/* Progress bar fill - flat red with smooth CSS transition */}
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: '#ff3333',
              transition: 'width 300ms ease-out',
            }}
          />

          {/* GIF mascot - rides along the progress bar */}
          <img
            src={`${import.meta.env.BASE_URL}preloader.gif`}
            alt=""
            className="absolute select-none w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] md:w-[100px] md:h-[100px]"
            style={{
              left: `${progress}%`,
              top: '50%',
              transform: 'translate(-50%, calc(-50% - 9px))',
              transition: 'left 300ms ease-out',
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}
