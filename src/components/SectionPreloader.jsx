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
  section2: '#00ff26', // About - green
  section3: '#e600ff', // Side Quests - magenta
  section4: '#decf00', // Contact - yellow
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
  onComplete,
}) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(null)
  const onCompleteRef = useRef(onComplete)
  const hasCompletedRef = useRef(false)

  // Keep onComplete ref updated without triggering effect
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

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
    const totalSteps = durationMs / stepMs
    const increment = 100 / totalSteps
    let current = 0

    rafRef.current = setInterval(() => {
      current += increment
      if (current >= 100) {
        current = 100
        setProgress(100)
        clearInterval(rafRef.current)
        rafRef.current = null
        hasCompletedRef.current = true
        if (onCompleteRef.current) onCompleteRef.current()
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
      {/* Container for GIF and progress bar - responsive widths */}
      <div className="flex flex-col items-center gap-2 sm:gap-3 w-[85vw] max-w-[560px] px-4">
        {/* GIF mascot - moves with progress */}
        <div className="relative w-full h-20 sm:h-24 md:h-28">
          <img
            src={`${import.meta.env.BASE_URL}preloader.gif`}
            alt=""
            className="absolute select-none w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] md:w-[100px] md:h-[100px] bottom-0"
            style={{
              left: `${progress}%`,
              transition: 'left 300ms ease-out',
              transform: 'translateX(-50%)',
            }}
            draggable={false}
          />
        </div>

        {/* Progress bar track - flat design, responsive */}
        <div
          className="relative overflow-hidden rounded-full w-full h-4 sm:h-5 md:h-6 border-2 sm:border-[3px] md:border-4 border-white"
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
        </div>
      </div>
    </div>
  )
}
