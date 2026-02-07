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

  // Shared event handlers for the invisible hitbox + text
  const handleClick = (e) => {
    e.stopPropagation()
    try { onClick?.() } catch {}
  }
  const handlePointerOver = () => {
    setHovered(true)
    try { gl.domElement.style.cursor = 'pointer' } catch {}
  }
  const handlePointerOut = () => {
    setHovered(false)
    try { gl.domElement.style.cursor = '' } catch {}
  }

  return (
    <group ref={groupRef} position={position}>
      {/* Invisible hitbox — larger than the text so it's easy to click */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[2.2, 2.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Exclamation mark text */}
      <Text
        font={`${import.meta.env.BASE_URL}fonts/LuckiestGuy-Regular.ttf`}
        fontSize={1.2}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.07}
        outlineColor="#000000"
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
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
