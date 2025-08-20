import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

/**
 * Portal
 *
 * Represents an interactive glowing ring that the player can enter to
 * transition to another section.  The ring slowly rotates around its
 * local Z axis to create a subtle animation.  The colour and size can be
 * customised via props.
 */
export default function Portal({ position = [0, 0, 0], color = '#8ecae6', size = 2 }) {
  const ref = useRef()
  // Rotate continuously for a dynamic feel
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.z += 0.01
    }
  })
  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
      {/* Torus geometry: main radius and tube radius control ring size and thickness */}
      <torusGeometry args={[size, size * 0.1, 32, 64]} />
      {/* Emissive material so the ring appears to glow */}
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} />
    </mesh>
  )
}