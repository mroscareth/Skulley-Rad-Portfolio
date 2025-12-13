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
  followBehind = false,
}) {
  const { camera } = useThree()
  const controlsRef = useRef()
  const followOffset = useMemo(() => new THREE.Vector3(0, 2.4, -5.2), [])
  const targetOffset = useMemo(() => new THREE.Vector3(0, 1.6, 0), [])

  // Permitir correr con Shift SIN romper rotación con mouse:
  // OrbitControls trata shiftKey como "PAN" (left mouse + shift => pan).
  // Como aquí enablePan=false, al mantener Shift parecía que la cámara "se bloqueaba".
  // Parche: ignorar shiftKey en el handler interno de mouseDown del control.
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    try {
      // @ts-ignore marca para no parchear dos veces
      if (c.__ignoreShiftForMouseDown) return
      // @ts-ignore
      c.__ignoreShiftForMouseDown = true
      // OrbitControls define _onMouseDown ya bindeado al instance
      // @ts-ignore
      const orig = c._onMouseDown
      if (typeof orig === 'function') {
        // @ts-ignore
        c._onMouseDown = (event) => {
          try {
            if (event && event.shiftKey) {
              // Clonar “wrapper” con shiftKey=false sin mutar el evento real (read-only)
              const e2 = Object.create(event)
              try { Object.defineProperty(e2, 'shiftKey', { value: false }) } catch { e2.shiftKey = false }
              return orig(e2)
            }
          } catch {}
          return orig(event)
        }
      }
    } catch {}
  }, [])

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
    // Auto-follow camera behind player on demand (mobile)
    if (followBehind) {
      const yaw = playerRef.current.rotation.y
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0))
      const desired = playerRef.current.position.clone().add(followOffset.clone().applyQuaternion(q))
      const k = 0.12
      camera.position.lerp(desired, k)
      camera.lookAt(target)
    }
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
      // Mantener pan disponible (ej: botón derecho) sin “romper” rotación al correr con Shift.
      enablePan
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.8}
      // Mapeo explícito estilo videojuego:
      // - Left drag: rotate
      // - Right drag: pan
      // - Middle: zoom
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      minDistance={2.2}
      maxDistance={8}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.49}
    />
  )
}