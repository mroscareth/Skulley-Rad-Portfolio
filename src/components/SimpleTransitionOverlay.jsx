/**
 * SimpleTransitionOverlay - Overlay de transición simple y eficiente
 * 
 * Usa CSS puro para el efecto de grid, sin Three.js ni captura de frames.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

/**
 * Hook para manejar transiciones simples
 */
export function useSimpleTransition({
  onSectionChange,
  onTransitionStart,
  onTransitionMid,
  onTransitionEnd,
} = {}) {
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState('idle')
  const activeRef = useRef(false)
  const pendingSectionRef = useRef(null)
  const configRef = useRef({})

  const startTransition = useCallback((toSection, config = {}) => {
    if (activeRef.current) return false
    
    activeRef.current = true
    pendingSectionRef.current = toSection
    configRef.current = {
      coverDuration: config.coverDuration ?? 400,
      revealDuration: config.revealDuration ?? 500,
      holdDuration: config.holdDuration ?? 100,
      cellSize: config.cellSize ?? 50,
      ...config,
    }
    
    setActive(true)
    setPhase('covering')
    onTransitionStart?.(toSection)
    
    return true
  }, [onTransitionStart])

  const onCoverComplete = useCallback(() => {
    if (!activeRef.current) return
    
    setPhase('covered')
    
    const toSection = pendingSectionRef.current
    onSectionChange?.(toSection)
    onTransitionMid?.(toSection)
    
    setTimeout(() => {
      setPhase('revealing')
    }, configRef.current.holdDuration)
  }, [onSectionChange, onTransitionMid])

  const onRevealComplete = useCallback(() => {
    if (!activeRef.current) return
    
    const toSection = pendingSectionRef.current
    setActive(false)
    setPhase('idle')
    activeRef.current = false
    pendingSectionRef.current = null
    onTransitionEnd?.(toSection)
  }, [onTransitionEnd])

  const isTransitioning = useCallback(() => activeRef.current, [])

  return {
    active,
    phase,
    config: configRef.current,
    startTransition,
    onCoverComplete,
    onRevealComplete,
    isTransitioning,
  }
}

/**
 * Componente de overlay - versión simplificada con fade
 */
export default function SimpleTransitionOverlay({
  active = false,
  phase = 'idle',
  cellSize = 50,
  coverDuration = 400,
  revealDuration = 500,
  onCoverComplete,
  onRevealComplete,
}) {
  // Estado para controlar la animación
  const [showBlack, setShowBlack] = useState(false)
  const coverTimerRef = useRef(null)
  const revealTimerRef = useRef(null)

  // Limpiar timers
  useEffect(() => {
    return () => {
      if (coverTimerRef.current) clearTimeout(coverTimerRef.current)
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    }
  }, [])

  // Manejar fase covering
  useEffect(() => {
    if (phase === 'covering' && active) {
      // Fade a negro
      setShowBlack(true)
      
      // Después de la animación, llamar callback
      coverTimerRef.current = setTimeout(() => {
        onCoverComplete?.()
      }, coverDuration)
    }
  }, [phase, active, coverDuration, onCoverComplete])

  // Manejar fase revealing
  useEffect(() => {
    if (phase === 'revealing' && active) {
      // Fade desde negro
      setShowBlack(false)
      
      // Después de la animación, llamar callback
      revealTimerRef.current = setTimeout(() => {
        onRevealComplete?.()
      }, revealDuration)
    }
  }, [phase, active, revealDuration, onRevealComplete])

  // Manejar desactivación
  useEffect(() => {
    if (!active) {
      setShowBlack(false)
    }
  }, [active])

  if (!active) return null

  // Determinar duración de la transición CSS
  const transitionMs = phase === 'covering' ? coverDuration : revealDuration

  return (
    <div
      className="fixed inset-0 z-[200000] pointer-events-none"
      aria-hidden
      data-phase={phase}
      style={{
        backgroundColor: '#000',
        opacity: showBlack ? 1 : 0,
        transition: `opacity ${transitionMs}ms ease-in-out`,
      }}
    />
  )
}
