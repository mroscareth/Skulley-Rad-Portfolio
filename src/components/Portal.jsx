import React, { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * Portal
 *
 * Represents an interactive glowing ring that the player can enter to
 * transition to another section.  The ring slowly rotates around its
 * local Z axis to create a subtle animation.  The colour and size can be
 * customised via props.
 */
export default function Portal({ position = [0, 0, 0], color = '#8ecae6', targetColor = '#8ecae6', mix = 0, size = 2, flicker = false, flickerKey = null }) {
  const ref = useRef()
  const matRef = useRef()
  // Rotate continuously for a dynamic feel
  // State machine para patrón aleatorio: periodos ON estables y ráfagas OFF/ON cortas
  const flickerRef = useRef({ mode: 'stableOn', nextAt: 0, blinks: 0 })
  React.useEffect(() => {
    if (!flicker) return
    // Forzar que tras cambios de contexto (p.ej., volver a HOME) inicie pronto una ráfaga
    const st = flickerRef.current
    st.mode = 'burstOff'
    st.blinks = Math.floor(4 + Math.random() * 4) // 4–7 blinks
    st.nextAt = -1 // señal para reprogramar inmediatamente en el frame siguiente
  }, [flickerKey, flicker])
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z += 0.01
    }
    if (matRef.current) {
      const base = new THREE.Color(color)
      const tgt = new THREE.Color(targetColor)
      const out = base.clone().lerp(tgt, THREE.MathUtils.clamp(mix, 0, 1))
      if (flicker && state?.clock) {
        const now = state.clock.getElapsedTime()
        const st = flickerRef.current
        // Velocidad aumentada: periodos ON más cortos y blinks más rápidos
        const randStable = () => (0.6 + Math.random() * 1.2) + (Math.random() < 0.12 ? (0.4 + Math.random() * 0.8) : 0) // ~0.6–1.8s (+ocasional 0.4–1.2s)
        const randOffShort = () => (0.03 + Math.random() * 0.05) // 30–80ms
        const randOnShort = () => (0.05 + Math.random() * 0.07) // 50–120ms
        const randOffLong = () => (0.18 + Math.random() * 0.17) // 180–350ms
        if (!st.nextAt || st.nextAt === -1) {
          if (st.nextAt === -1 && st.mode === 'burstOff') {
            // Reset dirigido: arrancar con un apagón breve inmediato
            st.nextAt = now + (0.05 + Math.random() * 0.06)
          } else {
          st.mode = 'stableOn'
          st.nextAt = now + randStable()
          st.blinks = 0
          }
        }
        if (now >= st.nextAt) {
          if (st.mode === 'stableOn') {
            st.mode = 'burstOff'
            st.blinks = Math.floor(4 + Math.random() * 5) // 4–8 blinks
            st.nextAt = now + (Math.random() < 0.25 ? randOffLong() : randOffShort())
          } else if (st.mode === 'burstOff') {
            st.mode = 'burstOn'
            st.nextAt = now + randOnShort()
          } else if (st.mode === 'burstOn') {
            st.blinks -= 1
            if (st.blinks > 0) {
              st.mode = 'burstOff'
              st.nextAt = now + randOffShort()
            } else {
              st.mode = 'stableOn'
              st.nextAt = now + randStable()
            }
          }
        }
        if (st.mode === 'stableOn' || st.mode === 'burstOn') {
          matRef.current.color.copy(out)
          matRef.current.emissive.copy(out)
          matRef.current.emissiveIntensity = 3.2
        } else {
          matRef.current.color.setRGB(0, 0, 0)
          matRef.current.emissive.setRGB(0, 0, 0)
          matRef.current.emissiveIntensity = 0.0
        }
      } else {
        // No flicker: always on, stable
        matRef.current.color.copy(out)
        matRef.current.emissive.copy(out)
        matRef.current.emissiveIntensity = 3.2
      }
    }
  })
  return (
    // El portal es emisivo (glow) y no debe castear sombras: si lo hace, ensucia el suelo con “manchas” extra.
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
      {/* Torus geometry: reduced segments for performance without visible loss */}
      <torusGeometry args={[size, size * 0.1, 16, 32]} />
      {/* Emissive material so the ring appears to glow */}
      <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={3.2} />
    </mesh>
  )
}