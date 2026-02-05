/**
 * useSceneTransition - Unified transition system between sections
 * 
 * Render Target-based architecture:
 * 1. Capture scene A (current) → texture
 * 2. Switch section internally (invisible under the overlay)
 * 3. Capture scene B (new) → texture
 * 4. Shader blends A→B with chosen effect
 * 5. On completion, shows scene B directly
 */
import { useState, useRef, useCallback } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'

// Available effect types
export const TransitionEffect = {
  FADE: 'fade',           // Simple fade to black and back
  DISSOLVE: 'dissolve',   // Noise dissolution
  GRID: 'grid',           // Cell grid (shader, not CSS)
  WIPE: 'wipe',           // Directional wipe
  MASK: 'mask',           // Image mask
}

// Default config per effect (longer durations so animation is visible)
const defaultConfig = {
  [TransitionEffect.FADE]: { duration: 1.2, color: [0, 0, 0] },
  [TransitionEffect.DISSOLVE]: { duration: 1.4, edge: 0.35, speed: 1.5 },
  [TransitionEffect.GRID]: { duration: 1.6, cellSize: 40, center: [0.5, 0.5] },
  [TransitionEffect.WIPE]: { duration: 1.2, direction: [1, 0], softness: 0.1 },
  [TransitionEffect.MASK]: { duration: 1.4, softness: 0.08 },
}

/**
 * Main hook for managing scene transitions
 * @param {Object} options
 * @param {React.RefObject} options.glRef - Reference to the Three.js renderer
 * @param {Function} options.onSectionChange - Callback to change the section
 * @param {Function} options.onTransitionStart - Callback when transition starts
 * @param {Function} options.onTransitionMid - Callback at mid-transition (screen covered)
 * @param {Function} options.onTransitionEnd - Callback when transition ends
 */
export function useSceneTransition({
  glRef,
  onSectionChange,
  onTransitionStart,
  onTransitionMid,
  onTransitionEnd,
} = {}) {
  // Overlay state
  const [overlayActive, setOverlayActive] = useState(false)
  const [effect, setEffect] = useState(TransitionEffect.GRID)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('idle') // 'idle' | 'covering' | 'covered' | 'revealing'
  const [textureA, setTextureA] = useState(null)
  const [textureB, setTextureB] = useState(null)
  const [config, setConfig] = useState({})
  
  // Refs for animation
  const animRef = useRef({ progress: 0 })
  const tweenRef = useRef(null)
  const transitionActiveRef = useRef(false)
  const pendingSectionRef = useRef(null)

  /**
   * Captures the current WebGL canvas frame as a texture
   */
  const captureFrame = useCallback(async () => {
    try {
      const renderer = glRef?.current
      if (!renderer) return null
      
      // Wait for the frame to be ready
      await new Promise(r => requestAnimationFrame(r))
      
      const size = renderer.getDrawingBufferSize(new THREE.Vector2())
      const w = Math.max(1, size.x)
      const h = Math.max(1, size.y)
      const gl = renderer.getContext()
      const pixels = new Uint8Array(w * h * 4)
      
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      
      const tex = new THREE.DataTexture(pixels, w, h, THREE.RGBAFormat)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.flipY = false
      tex.needsUpdate = true
      
      return tex
    } catch (e) {
      console.warn('[useSceneTransition] Error capturing frame:', e)
      return null
    }
  }, [glRef])

  /**
   * Cleans up textures and state
   */
  const cleanup = useCallback(() => {
    try { textureA?.dispose?.() } catch {}
    try { textureB?.dispose?.() } catch {}
    setTextureA(null)
    setTextureB(null)
    setProgress(0)
    setPhase('idle')
    animRef.current.progress = 0
    transitionActiveRef.current = false
    pendingSectionRef.current = null
  }, [textureA, textureB])

  /**
   * Cancels the current transition
   */
  const cancel = useCallback(() => {
    if (tweenRef.current) {
      tweenRef.current.kill()
      tweenRef.current = null
    }
    setOverlayActive(false)
    cleanup()
  }, [cleanup])

  /**
   * Starts a transition to a new section
   * @param {string} toSection - Target section ID
   * @param {string} effectType - Effect type (TransitionEffect.*)
   * @param {Object} effectConfig - Additional effect configuration
   */
  const startTransition = useCallback(async (toSection, effectType = TransitionEffect.GRID, effectConfig = {}) => {
    // Prevent simultaneous transitions
    if (transitionActiveRef.current) {
      console.warn('[useSceneTransition] Transition already in progress')
      return false
    }

    transitionActiveRef.current = true
    pendingSectionRef.current = toSection

    // Effect configuration
    const finalConfig = { ...defaultConfig[effectType], ...effectConfig }
    setConfig(finalConfig)
    setEffect(effectType)

    // Notify start
    onTransitionStart?.(toSection, effectType)

    // PHASE 1: Capture current scene (A)
    const texA = await captureFrame()
    if (!texA) {
      console.warn('[useSceneTransition] Could not capture frame A, falling back')
      // Fallback: change section directly
      onSectionChange?.(toSection)
      onTransitionEnd?.(toSection)
      transitionActiveRef.current = false
      return false
    }
    setTextureA(texA)
    setTextureB(texA) // Initially the same to avoid flash

    // Activate overlay and start cover phase
    setOverlayActive(true)
    setPhase('covering')
    setProgress(0)
    animRef.current.progress = 0

    const halfDuration = finalConfig.duration / 2

    // Animation: cover (0 → 1)
    tweenRef.current = gsap.to(animRef.current, {
      progress: 1,
      duration: halfDuration,
      ease: 'power2.inOut',
      onUpdate: () => setProgress(animRef.current.progress),
      onComplete: async () => {
        // PHASE 2: Screen fully covered
        setPhase('covered')

        // Keep screen covered briefly so it's visible
        await new Promise(r => setTimeout(r, 100))

        // Switch section (invisible to user)
        onSectionChange?.(toSection)

        // Notify mid-transition (configure UI)
        onTransitionMid?.(toSection)

        // Wait several frames for React to fully render the new section
        await new Promise(r => setTimeout(r, 150))
        await new Promise(r => requestAnimationFrame(() => 
          requestAnimationFrame(() => 
            requestAnimationFrame(r)
          )
        ))

        // PHASE 3: Capture new scene (B)
        const texB = await captureFrame()
        if (texB) {
          setTextureB(texB)
        }

        // Extra delay to ensure texture B is ready
        await new Promise(r => setTimeout(r, 100))

        // PHASE 4: Reveal (1 → 2 for all effects)
        // The shader interprets: 0→1 = cover, 1→2 = reveal
        setPhase('revealing')

        // Continue animation 1 to 2 (reveal the new scene)
        tweenRef.current = gsap.to(animRef.current, {
          progress: 2,
          duration: halfDuration,
          ease: 'power2.inOut',
          onUpdate: () => setProgress(animRef.current.progress),
          onComplete: () => {
            // Transition complete — overlay will fade out via CSS
            setOverlayActive(false)
            cleanup()
            onTransitionEnd?.(toSection)
          },
        })
      },
    })

    return true
  }, [captureFrame, cleanup, onSectionChange, onTransitionStart, onTransitionMid, onTransitionEnd])

  /**
   * Checks if there is an active transition
   */
  const isTransitioning = useCallback(() => transitionActiveRef.current, [])

  return {
    // Overlay state
    overlayActive,
    effect,
    progress,
    phase,
    textureA,
    textureB,
    config,
    
    // Actions
    startTransition,
    cancel,
    isTransitioning,
    
    // Refs for external access
    transitionActiveRef,
  }
}

export default useSceneTransition
