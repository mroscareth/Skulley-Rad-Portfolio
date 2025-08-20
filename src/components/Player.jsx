import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import useKeyboard from './useKeyboard.js'

// Interpolación de ángulos con wrapping (evita saltos al cruzar ±π)
function lerpAngleWrapped(current, target, t) {
  const TAU = Math.PI * 2
  let delta = ((target - current + Math.PI) % TAU) - Math.PI
  return current + delta * t
}

/**
 * Player
 *
 * Loads and animates a 3D character model.  Movement is controlled via the
 * WASD or arrow keys.  The player rotates to face the direction of
 * movement and transitions between idle and walking animations.
 * When the player comes within a small radius of a portal, the
 * onPortalEnter callback is invoked.  A ref to the player group is
 * forwarded so the camera controller can follow it.
 */
export default function Player({ playerRef, portals = [], onPortalEnter, onProximityChange }) {
  // Load the GLB character; preloading ensures the asset is cached when
  // imported elsewhere.  The model contains two animations: idle and walk.
  const { scene, animations } = useGLTF('/character.glb')
  const { actions } = useAnimations(animations, scene)
  const { camera } = useThree()

  // Keyboard state
  const keyboard = useKeyboard()

  // Log available animation clip names and action keys once loaded
  useEffect(() => {
    if (!animations || !actions) return
    const clipNames = animations.map((clip) => clip.name)
    const actionKeys = Object.keys(actions)
    // Helpful debug output to identify exact names
    console.log('[Player] Animation clips:', clipNames)
    console.log('[Player] Action keys:', actionKeys)
    // Debug orientation: check forward vector in model space (Z- expected)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(scene.quaternion)
    console.log('[Player] Forward world dir (expect ~Z-):', forward.toArray())
  }, [animations, actions])

  // Derive animation names once. Prefer explicit names if present.
  const [idleName, walkName] = useMemo(() => {
    const names = actions ? Object.keys(actions) : []
    const explicitIdle = 'root|root|Iddle'
    const explicitWalk = 'root|root|Walking'
    const idle = names.includes(explicitIdle)
      ? explicitIdle
      : names.find((n) => n.toLowerCase().includes('idle')) || names[0]
    const walk = names.includes(explicitWalk)
      ? explicitWalk
      : names.find((n) => n.toLowerCase().includes('walk')) || names[1]
    if (names.length) {
      console.log('[Player] Using idle clip:', idle)
      console.log('[Player] Using walk clip:', walk)
    }
    return [idle, walk]
  }, [actions])

  // Smooth blending between idle and walk using effective weights
  const walkWeightRef = useRef(0)
  useEffect(() => {
    if (!actions) return
    const idleAction = idleName && actions[idleName]
    const walkAction = walkName && actions[walkName]
    if (idleAction) {
      idleAction.reset().setEffectiveWeight(1).play()
    }
    if (walkAction) {
      walkAction.reset().setEffectiveWeight(0).play()
    }
  }, [actions, idleName, walkName])

  // Movement parameters
  const BASE_SPEED = 5 // baseline used to sync animation playback
  const SPEED = 6.2 // slightly faster movement (kept in sync with walk animation)
  const threshold = 3 // distance threshold for portal activation
  const PROXIMITY_RADIUS = 12 // radius within which we start tinting the scene

  // Per‑frame update: handle movement, rotation, animation blending and portal
  // proximity detection.
  useFrame((state, delta) => {
    if (!playerRef.current) return

    // Build input vector (camera-relative)
    const xInput = (keyboard.left ? -1 : 0) + (keyboard.right ? 1 : 0)
    const zInput = (keyboard.forward ? 1 : 0) + (keyboard.backward ? -1 : 0)

    // Compute camera-relative basis on XZ plane
    const camForward = new THREE.Vector3()
    camera.getWorldDirection(camForward)
    camForward.y = 0
    if (camForward.lengthSq() > 0) camForward.normalize()
    // Derecha de cámara: forward × up (no up × forward, que da izquierda)
    const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize()

    // Desired move direction relative to where the camera looks
    const direction = new THREE.Vector3()
      .addScaledVector(camForward, zInput)
      .addScaledVector(camRight, xInput)

    const hasInput = direction.lengthSq() > 1e-6
    // If there is input, normalise the direction and update position
    if (hasInput) {
      direction.normalize()
      // Rotar el jugador hacia la dirección con suavizado temporal y wrapping
      const targetAngle = Math.atan2(direction.x, direction.z)
      const smoothing = 1 - Math.pow(0.001, delta)
      playerRef.current.rotation.y = lerpAngleWrapped(
        playerRef.current.rotation.y,
        targetAngle,
        smoothing,
      )
      // Move forwards
      const velocity = direction.clone().multiplyScalar(SPEED * delta)
      playerRef.current.position.add(velocity)
    }

    // Blend animations based on input intensity
    if (actions) {
      const idleAction = idleName && actions[idleName]
      const walkAction = walkName && actions[walkName]
      if (idleAction && walkAction) {
        const target = hasInput ? 1 : 0
        const smoothing = 1 - Math.pow(0.001, delta)
        walkWeightRef.current = THREE.MathUtils.clamp(
          THREE.MathUtils.lerp(walkWeightRef.current, target, smoothing),
          0,
          1,
        )
        const walkW = walkWeightRef.current
        const idleW = 1 - walkW
        walkAction.enabled = true
        idleAction.enabled = true
        walkAction.setEffectiveWeight(walkW)
        idleAction.setEffectiveWeight(idleW)
        // Mantener la animación de caminata sincronizada con la velocidad real
        const animScale = THREE.MathUtils.lerp(1, SPEED / BASE_SPEED, walkW)
        walkAction.setEffectiveTimeScale(animScale)
        idleAction.setEffectiveTimeScale(1)
      }
    }

    // Check proximity to each portal. Trigger enter callback within
    // a small threshold, and compute a proximity factor for scene tinting.
    let minDistance = Infinity
    portals.forEach((portal) => {
      const portalPos = new THREE.Vector3().fromArray(portal.position)
      const distance = portalPos.distanceTo(playerRef.current.position)
      if (distance < minDistance) minDistance = distance
      if (distance < threshold) {
        onPortalEnter(portal.id)
      }
    })
    if (onProximityChange && isFinite(minDistance)) {
      const factor = THREE.MathUtils.clamp(1 - minDistance / PROXIMITY_RADIUS, 0, 1)
      onProximityChange(factor)
    }
  })

  return (
    <group ref={playerRef} position={[0, 0, 0]}>
      <primitive object={scene} scale={1.5} />
    </group>
  )
}

// Preload the model for faster subsequent loading
useGLTF.preload('/character.glb')