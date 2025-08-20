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
export default function Portal({ position = [0, 0, 0], color = '#8ecae6', targetColor = '#8ecae6', mix = 0, size = 2 }) {
  const ref = useRef()
  const matRef = useRef()
  // Rotate continuously for a dynamic feel
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.z += 0.01
    }
    if (matRef.current) {
      const base = new THREE.Color(color)
      const tgt = new THREE.Color(targetColor)
      const out = base.clone().lerp(tgt, THREE.MathUtils.clamp(mix, 0, 1))
      matRef.current.color.copy(out)
      matRef.current.emissive.copy(out)
    }
  })
  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
      {/* Torus geometry: reduced segments for performance without visible loss */}
      <torusGeometry args={[size, size * 0.1, 16, 32]} />
      {/* Emissive material so the ring appears to glow */}
      <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={3.2} />
    </mesh>
  )
}