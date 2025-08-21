import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * CameraController
 *
 * Smoothly follows the player by lerping the camera towards a target
 * position offset from the player's location.  The camera always looks
 * slightly above the player's head to keep them centred in view.  When
 * the player turns, the camera orbits around them rather than spinning
 * independently, creating a more natural third‑person perspective.
 */
export default function CameraController({
  playerRef,
  controlsRefExternal,
  shakeActive = false,
  shakeAmplitude = 0.12,
  shakeFrequencyX = 18.0,
  shakeFrequencyY = 15.0,
  shakeYMultiplier = 0.9,
  enabled = true,
}) {
  const { camera } = useThree()
  const controlsRef = useRef()
  const followOffset = useMemo(() => new THREE.Vector3(0, 2.4, -5.2), [])
  const targetOffset = useMemo(() => new THREE.Vector3(0, 1.6, 0), [])

  // Exponer ref hacia fuera si se solicita (para efectos externos)
  useEffect(() => {
    if (controlsRefExternal) {
      controlsRefExternal.current = controlsRef.current
    }
  }, [controlsRefExternal])

  // Place the camera behind the player on mount
  useEffect(() => {
    if (!playerRef.current) return
    const yaw = playerRef.current.rotation.y
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0))
    const rotatedOffset = followOffset.clone().applyQuaternion(q)
    const base = playerRef.current.position
    const target = base.clone().add(targetOffset)
    camera.position.copy(base).add(rotatedOffset)
    camera.lookAt(target)
  }, [camera, playerRef, followOffset, targetOffset])

  // Keep OrbitControls target locked to the player
  useFrame((state) => {
    if (!playerRef.current || !controlsRef.current) return
    if (!enabled) return
    const target = playerRef.current.position.clone().add(targetOffset)
    if (shakeActive) {
      const t = state.clock.getElapsedTime()
      const amp = shakeAmplitude
      target.x += Math.sin(t * shakeFrequencyX) * amp
      target.y += Math.cos(t * shakeFrequencyY) * amp * shakeYMultiplier
    }
    controlsRef.current.target.copy(target)
    controlsRef.current.update()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={enabled}
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.8}
      minDistance={2.2}
      maxDistance={8}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.49}
    />
  )
}