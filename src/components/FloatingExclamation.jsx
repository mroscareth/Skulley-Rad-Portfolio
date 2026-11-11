import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'

/**
 * FloatingExclamation — Floating 3D "!" icon (neon glow, rotating, bobbing)
 * Clickable to open the sphere game tutorial.
 *
 * Se monta desde el warm-up del preloader aunque todavía no se vea. Su luz
 * cuenta para todos los materiales iluminados (agregarla al aterrizar los
 * recompilaba) y el texto genera su fuente SDF al montarse (~450 ms en el
 * aterrizaje, medido el 2026-11-10). Oculto: grupo invisible, luz en 0 y los
 * handlers no hacen nada, así el clic sigue de largo a lo que haya detrás.
 */
export default function FloatingExclamation({
  position = [3, 1.8, 3],
  color = '#f5ff00',
  onClick,
  visible = true,
}) {
  const groupRef = useRef()
  const lightRef = useRef()
  const [hovered, setHovered] = useState(false)
  const { gl } = useThree()
  const baseY = position[1]
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  // Pre-allocate reusable values
  const hoverTarget = useRef(1)

  useEffect(() => {
    if (visible || !hovered) return
    setHovered(false)
    try { gl.domElement.style.cursor = '' } catch {}
  }, [visible, hovered, gl])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const y = baseY + Math.sin(t * 1.5) * 0.18

    if (lightRef.current) {
      const base = hovered ? 5 : 3
      lightRef.current.intensity = visible ? base + Math.sin(t * 3) * 0.8 : 0
      lightRef.current.position.y = y
    }

    const g = groupRef.current
    if (!g) return
    g.visible = visible
    if (!visible) return

    // Bob up and down
    g.position.y = y

    // Billboard: always face the camera
    g.quaternion.copy(state.camera.quaternion)

    // Smooth scale on hover
    const target = hovered ? 1.2 : 1.0
    hoverTarget.current += (target - hoverTarget.current) * 0.1
    g.scale.setScalar(hoverTarget.current)
  })

  // Shared event handlers for the invisible hitbox + text
  const handleClick = (e) => {
    if (!visibleRef.current) return
    e.stopPropagation()
    try { onClick?.() } catch {}
  }
  const handlePointerOver = () => {
    if (!visibleRef.current) return
    setHovered(true)
    try { gl.domElement.style.cursor = 'pointer' } catch {}
  }
  const handlePointerOut = () => {
    if (!visibleRef.current) return
    setHovered(false)
    try { gl.domElement.style.cursor = '' } catch {}
  }

  return (
    <>
      {/* Neon glow light: fuera del grupo para que ocultarlo no la saque del conteo */}
      <pointLight
        ref={lightRef}
        position={position}
        color={color}
        intensity={0}
        distance={7}
        decay={1.6}
      />
      <group ref={groupRef} position={position} visible={visible}>
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
      </group>
    </>
  )
}
