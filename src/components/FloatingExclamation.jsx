import { useRef, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

/**
 * FloatingExclamation — Floating 3D "!" icon (neon glow, rotating, bobbing)
 * Clickable to open the sphere game tutorial.
 */
export default function FloatingExclamation({
  position = [3, 1.8, 3],
  color = '#decf00',
  onClick,
  visible = true,
}) {
  const groupRef = useRef()
  const lightRef = useRef()
  const [hovered, setHovered] = useState(false)
  const { gl } = useThree()
  const baseY = position[1]

  // Pre-allocate reusable values
  const hoverTarget = useRef(1)

  useFrame((state) => {
    const g = groupRef.current
    if (!g) return
    if (!visible) {
      g.visible = false
      return
    }
    g.visible = true

    const t = state.clock.elapsedTime

    // Bob up and down
    g.position.y = baseY + Math.sin(t * 1.5) * 0.18

    // Billboard: always face the camera
    g.quaternion.copy(state.camera.quaternion)

    // Smooth scale on hover
    const target = hovered ? 1.2 : 1.0
    hoverTarget.current += (target - hoverTarget.current) * 0.1
    g.scale.setScalar(hoverTarget.current)

    // Pulse light intensity
    if (lightRef.current) {
      const base = hovered ? 5 : 3
      lightRef.current.intensity = base + Math.sin(t * 3) * 0.8
    }
  })

  // Don't render at all if not visible (saves raycasting cost)
  if (!visible) return null

  return (
    <group ref={groupRef} position={position}>
      {/* Exclamation mark text */}
      <Text
        font={`${import.meta.env.BASE_URL}fonts/LuckiestGuy-Regular.ttf`}
        fontSize={1.2}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.07}
        outlineColor="#000000"
        onClick={(e) => {
          e.stopPropagation()
          try { onClick?.() } catch {}
        }}
        onPointerOver={() => {
          setHovered(true)
          try { gl.domElement.style.cursor = 'pointer' } catch {}
        }}
        onPointerOut={() => {
          setHovered(false)
          try { gl.domElement.style.cursor = '' } catch {}
        }}
      >
        !
      </Text>

      {/* Neon glow light */}
      <pointLight
        ref={lightRef}
        color={color}
        intensity={3}
        distance={7}
        decay={1.6}
      />
    </group>
  )
}
