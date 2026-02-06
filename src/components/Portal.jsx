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
  // State machine for random pattern: stable ON periods and short DIM/ON bursts.
  // IMPORTANT: "off" never goes to pure black — it dims to ~20% so the portal
  // always looks alive and never appears "stuck off".
  const flickerRef = useRef({ mode: 'stableOn', nextAt: 0, blinks: 0 })
  // Pre-allocate colors to avoid per-frame allocations
  const flickerTmpRef = useRef({ base: new THREE.Color(), tgt: new THREE.Color(), out: new THREE.Color() })
  React.useEffect(() => {
    if (!flicker) return
    // Force a burst soon after context changes (e.g. returning to HOME)
    const st = flickerRef.current
    st.mode = 'burstOff'
    st.blinks = Math.floor(3 + Math.random() * 3) // 3–5 blinks (reduced)
    st.nextAt = -1 // signal to reschedule immediately on the next frame
  }, [flickerKey, flicker])
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z += 0.01
    }
    if (matRef.current) {
      const tmp = flickerTmpRef.current
      tmp.base.set(color)
      tmp.tgt.set(targetColor)
      tmp.out.copy(tmp.base).lerp(tmp.tgt, THREE.MathUtils.clamp(mix, 0, 1))
      if (flicker && state?.clock) {
        const now = state.clock.getElapsedTime()
        const st = flickerRef.current
        // Tuned timings: shorter stable periods and capped off durations
        const randStable = () => 0.6 + Math.random() * 1.0 // ~0.6–1.6s (no extra long tails)
        const randOffShort = () => 0.03 + Math.random() * 0.04 // 30–70ms
        const randOnShort = () => 0.06 + Math.random() * 0.06 // 60–120ms
        const randOffLong = () => 0.10 + Math.random() * 0.10 // 100–200ms (capped from 350ms)
        if (!st.nextAt || st.nextAt === -1) {
          if (st.nextAt === -1 && st.mode === 'burstOff') {
            // Directed reset: start with a brief immediate dim
            st.nextAt = now + (0.04 + Math.random() * 0.04)
          } else {
            st.mode = 'stableOn'
            st.nextAt = now + randStable()
            st.blinks = 0
          }
        }
        if (now >= st.nextAt) {
          if (st.mode === 'stableOn') {
            st.mode = 'burstOff'
            st.blinks = Math.floor(3 + Math.random() * 3) // 3–5 blinks (was 4–8)
            st.nextAt = now + (Math.random() < 0.2 ? randOffLong() : randOffShort())
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
          // Full brightness
          matRef.current.color.copy(tmp.out)
          matRef.current.emissive.copy(tmp.out)
          matRef.current.emissiveIntensity = 3.2
        } else {
          // Dim to ~20% instead of pure black — portal stays visible
          matRef.current.color.copy(tmp.out).multiplyScalar(0.15)
          matRef.current.emissive.copy(tmp.out).multiplyScalar(0.20)
          matRef.current.emissiveIntensity = 0.6
        }
      } else {
        // No flicker: always on, stable
        matRef.current.color.copy(tmp.out)
        matRef.current.emissive.copy(tmp.out)
        matRef.current.emissiveIntensity = 3.2
      }
    }
  })
  return (
    // The portal is emissive and should not cast shadows to avoid staining the ground.
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
      {/* Torus geometry: reduced segments for performance without visible loss */}
      <torusGeometry args={[size, size * 0.1, 16, 32]} />
      {/* Emissive material so the ring appears to glow */}
      <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={3.2} />
    </mesh>
  )
}