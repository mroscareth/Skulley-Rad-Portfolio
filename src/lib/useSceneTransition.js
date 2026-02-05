/**
 * useSceneTransition - Sistema unificado de transiciones entre secciones
 * 
 * Arquitectura basada en Render Targets:
 * 1. Captura escena A (actual) → textura
 * 2. Cambia sección internamente (invisible bajo el overlay)
 * 3. Captura escena B (nueva) → textura
 * 4. Shader mezcla A→B con el efecto elegido
 * 5. Al terminar, muestra escena B directamente
 */
import { useState, useRef, useCallback } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'

// Tipos de efectos disponibles
export const TransitionEffect = {
  FADE: 'fade',           // Fade simple a negro y back
  DISSOLVE: 'dissolve',   // Disolución con ruido
  GRID: 'grid',           // Grid de celdas (shader, no CSS)
  WIPE: 'wipe',           // Barrido direccional
  MASK: 'mask',           // Máscara de imagen
}

// Configuración por defecto de cada efecto (duraciones más largas para que se vea la animación)
const defaultConfig = {
  [TransitionEffect.FADE]: { duration: 1.2, color: [0, 0, 0] },
  [TransitionEffect.DISSOLVE]: { duration: 1.4, edge: 0.35, speed: 1.5 },
  [TransitionEffect.GRID]: { duration: 1.6, cellSize: 40, center: [0.5, 0.5] },
  [TransitionEffect.WIPE]: { duration: 1.2, direction: [1, 0], softness: 0.1 },
  [TransitionEffect.MASK]: { duration: 1.4, softness: 0.08 },
}

/**
 * Hook principal para manejar transiciones
 * @param {Object} options
 * @param {React.RefObject} options.glRef - Referencia al renderer de Three.js
 * @param {Function} options.onSectionChange - Callback para cambiar la sección
 * @param {Function} options.onTransitionStart - Callback al iniciar transición
 * @param {Function} options.onTransitionMid - Callback a mitad de transición (pantalla cubierta)
 * @param {Function} options.onTransitionEnd - Callback al terminar transición
 */
export function useSceneTransition({
  glRef,
  onSectionChange,
  onTransitionStart,
  onTransitionMid,
  onTransitionEnd,
} = {}) {
  // Estado del overlay
  const [overlayActive, setOverlayActive] = useState(false)
  const [effect, setEffect] = useState(TransitionEffect.GRID)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('idle') // 'idle' | 'covering' | 'covered' | 'revealing'
  const [textureA, setTextureA] = useState(null)
  const [textureB, setTextureB] = useState(null)
  const [config, setConfig] = useState({})
  
  // Refs para animación
  const animRef = useRef({ progress: 0 })
  const tweenRef = useRef(null)
  const transitionActiveRef = useRef(false)
  const pendingSectionRef = useRef(null)

  /**
   * Captura el frame actual del canvas WebGL como textura
   */
  const captureFrame = useCallback(async () => {
    try {
      const renderer = glRef?.current
      if (!renderer) return null
      
      // Esperar a que el frame esté listo
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
      console.warn('[useSceneTransition] Error capturando frame:', e)
      return null
    }
  }, [glRef])

  /**
   * Limpia texturas y estado
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
   * Cancela la transición actual
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
   * Inicia una transición a una nueva sección
   * @param {string} toSection - ID de la sección destino
   * @param {string} effectType - Tipo de efecto (TransitionEffect.*)
   * @param {Object} effectConfig - Configuración adicional del efecto
   */
  const startTransition = useCallback(async (toSection, effectType = TransitionEffect.GRID, effectConfig = {}) => {
    // Evitar transiciones simultáneas
    if (transitionActiveRef.current) {
      console.warn('[useSceneTransition] Transición ya en progreso')
      return false
    }

    transitionActiveRef.current = true
    pendingSectionRef.current = toSection

    // Configuración del efecto
    const finalConfig = { ...defaultConfig[effectType], ...effectConfig }
    setConfig(finalConfig)
    setEffect(effectType)

    // Notificar inicio
    onTransitionStart?.(toSection, effectType)

    // FASE 1: Capturar escena actual (A)
    const texA = await captureFrame()
    if (!texA) {
      console.warn('[useSceneTransition] No se pudo capturar frame A, haciendo fallback')
      // Fallback: cambiar sección directamente
      onSectionChange?.(toSection)
      onTransitionEnd?.(toSection)
      transitionActiveRef.current = false
      return false
    }
    setTextureA(texA)
    setTextureB(texA) // Inicialmente igual para evitar flash

    // Activar overlay y comenzar fase de cubierta
    setOverlayActive(true)
    setPhase('covering')
    setProgress(0)
    animRef.current.progress = 0

    const halfDuration = finalConfig.duration / 2

    // Animación: cubrir (0 → 1)
    tweenRef.current = gsap.to(animRef.current, {
      progress: 1,
      duration: halfDuration,
      ease: 'power2.inOut',
      onUpdate: () => setProgress(animRef.current.progress),
      onComplete: async () => {
        // FASE 2: Pantalla completamente cubierta
        setPhase('covered')

        // Mantener la pantalla cubierta un momento para que sea visible
        await new Promise(r => setTimeout(r, 100))

        // Cambiar sección (invisible para el usuario)
        onSectionChange?.(toSection)

        // Notificar mitad de transición (configurar UI)
        onTransitionMid?.(toSection)

        // Esperar varios frames para que React renderice completamente la nueva sección
        await new Promise(r => setTimeout(r, 150))
        await new Promise(r => requestAnimationFrame(() => 
          requestAnimationFrame(() => 
            requestAnimationFrame(r)
          )
        ))

        // FASE 3: Capturar nueva escena (B)
        const texB = await captureFrame()
        if (texB) {
          setTextureB(texB)
        }

        // Delay adicional para garantizar que la textura B esté lista
        await new Promise(r => setTimeout(r, 100))

        // FASE 4: Revelar (1 → 2 para todos los efectos)
        // El shader interpreta: 0→1 = cubrir, 1→2 = revelar
        setPhase('revealing')

        // Continuar animación de 1 a 2 (revelar la nueva escena)
        tweenRef.current = gsap.to(animRef.current, {
          progress: 2,
          duration: halfDuration,
          ease: 'power2.inOut',
          onUpdate: () => setProgress(animRef.current.progress),
          onComplete: () => {
            // Transición completa - el overlay hará fade out via CSS
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
   * Verifica si hay una transición activa
   */
  const isTransitioning = useCallback(() => transitionActiveRef.current, [])

  return {
    // Estado del overlay
    overlayActive,
    effect,
    progress,
    phase,
    textureA,
    textureB,
    config,
    
    // Acciones
    startTransition,
    cancel,
    isTransitioning,
    
    // Refs para acceso externo
    transitionActiveRef,
  }
}

export default useSceneTransition
