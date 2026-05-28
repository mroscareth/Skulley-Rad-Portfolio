import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { playSfx, preloadSfx } from '../lib/sfx.js'

/**
 * CameraController
 *
 * Smoothly follows the player by lerping the camera towards a target
 * position offset from the player's location.  The camera always looks
 * slightly above the player's head to keep them centred in view.  When
 * the player turns, the camera orbits around them rather than spinning
 * independently, creating a more natural third-person perspective.
 *
 * Supports two modes:
 * - 'third-person': Classic third-person camera with OrbitControls
 * - 'top-down': Fixed overhead camera (like Diablo, Enter the Gungeon)
 */
export default function CameraController({
  playerRef,
  controlsRefExternal,
  shakeActive = false,
  shakeAmplitude = 0.12,
  shakeFrequencyX = 18.0,
  shakeFrequencyY = 15.0,
  shakeYMultiplier = 0.9,
  // If the user is rotating the camera while the player moves (joystick),
  // smooth the target to avoid jumps from abrupt pivot changes.
  playerMoving = false,
  enabled = true,
  followBehind = false,
  // Camera mode: 'third-person' (default) or 'top-down'
  mode = 'third-person',
  // Top-down camera settings (Angle: 0° = directly above, 90° = horizon)
  topDownHeight = 10,        // Height above player
  topDownAngle = 50,         // Angle in degrees (10° = almost directly above)
}) {
  const { camera, gl } = useThree()
  const controlsRef = useRef()
  const followOffset = useMemo(() => new THREE.Vector3(0, 2.4, -5.2), [])
  const targetOffset = useMemo(() => new THREE.Vector3(0, 1.6, 0), [])
  
  // Camera mode/settings are now stable - debug logging removed for performance
  // Top-down camera offset (calculated from angle and height)
  // Angle: 0° = directly above, 90° = horizon
  const topDownOffset = useMemo(() => {
    const angleRad = topDownAngle * (Math.PI / 180)
    const horizontalDist = topDownHeight * Math.tan(angleRad)
    return new THREE.Vector3(0, topDownHeight, -horizontalDist)
  }, [topDownHeight, topDownAngle])

  // ── Top-down mouse-wheel zoom ───────────────────────────────────────────
  // Stores a multiplier applied to topDownOffset (1 = default, <1 = zoom in)
  const topDownZoomRef = useRef(1.0)
  const topDownZoomTargetRef = useRef(1.0)
  const TOP_DOWN_ZOOM_MIN = 0.60   // max zoom-in  (closer)
  const TOP_DOWN_ZOOM_MAX = 1   // max zoom-out (farther)
  const TOP_DOWN_ZOOM_STEP = 0.06  // per wheel tick
  const TOP_DOWN_ZOOM_LERP = 0.08  // smoothing speed

  // ── Top-down drag-to-rotate (snap a 90°) ─────────────────────────────
  // El usuario arrastra horizontalmente; al soltar, si pasó el threshold,
  // la cámara rota ±90° alrededor del player (azimuth). Snap discreto.
  const topDownYawRef = useRef(0)        // ángulo actual (interpolado)
  const topDownYawTargetRef = useRef(0)  // múltiplo de π/2 (snap)
  const TOP_DOWN_YAW_LERP = 0.18         // velocidad de easing del snap
  const TOP_DOWN_DRAG_THRESHOLD_PX = 50  // px horizontales para commit del giro

  const isInteractingRef = useRef(false)
  const smoothTargetRef = useRef(new THREE.Vector3())
  const smoothCamPosRef = useRef(new THREE.Vector3())
  const prevModeRef = useRef(mode)
  // Reuse temp objects to avoid allocations in useFrame
  const tmpRef = useRef({
    camPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    desiredTarget: new THREE.Vector3(),
    desired: new THREE.Vector3(),
    target: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    euler: new THREE.Euler(),
  })

  // Hardening: during transitions (preloader/overlays) pointerup can be lost and OrbitControls
  // gets stuck (stops rotating). Forward global pointerup/cancel to the control
  // ONLY if that pointerId is active in the control.
  useEffect(() => {
    const forwardPointerUp = (e) => {
      try {
        const c = controlsRef.current
        // @ts-ignore OrbitControls internals
        const pointers = c?._pointers
        // @ts-ignore
        const onUp = c?._onPointerUp
        if (!c || !pointers || !Array.isArray(pointers) || typeof onUp !== 'function') return
        const pid = e?.pointerId
        if (pid == null) return
        if (!pointers.includes(pid)) return
        try { onUp(e) } catch {}
      } catch {}
    }
    const onBlur = () => {
      try {
        const c = controlsRef.current
        // @ts-ignore
        const pointers = c?._pointers
        // @ts-ignore
        const onUp = c?._onPointerUp
        if (!c || !pointers || !Array.isArray(pointers) || typeof onUp !== 'function') return
        // Release all active pointers
        const ids = pointers.slice()
        for (const pid of ids) {
          try { onUp({ pointerId: pid, pointerType: 'mouse' }) } catch {}
        }
      } catch {}
    }
    window.addEventListener('pointerup', forwardPointerUp, true)
    window.addEventListener('pointercancel', forwardPointerUp, true)
    window.addEventListener('blur', onBlur, true)
    document.addEventListener('visibilitychange', onBlur, true)
    return () => {
      window.removeEventListener('pointerup', forwardPointerUp, true)
      window.removeEventListener('pointercancel', forwardPointerUp, true)
      window.removeEventListener('blur', onBlur, true)
      document.removeEventListener('visibilitychange', onBlur, true)
    }
  }, [])

  // Allow running with Shift WITHOUT breaking mouse rotation:
  // OrbitControls treats shiftKey as "PAN" (left mouse + shift => pan).
  // Since enablePan=false here, holding Shift made the camera appear "stuck".
  // Patch: ignore shiftKey in the internal mouseDown handler.
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    try {
      // @ts-ignore flag to avoid double-patching
      if (c.__ignoreShiftForMouseDown) return
      // @ts-ignore
      c.__ignoreShiftForMouseDown = true
      // OrbitControls defines _onMouseDown already bound to the instance
      // @ts-ignore
      const orig = c._onMouseDown
      if (typeof orig === 'function') {
        // @ts-ignore
        c._onMouseDown = (event) => {
          try {
            if (event && event.shiftKey) {
              // Clone wrapper with shiftKey=false without mutating the real event (read-only)
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

  // Expose ref externally if requested (for external effects)
  useEffect(() => {
    if (controlsRefExternal) {
      controlsRefExternal.current = controlsRef.current
    }
  }, [controlsRefExternal])

  // Detect active OrbitControls interaction (touch/mouse drag)
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return () => {}
    const onStart = () => {
      isInteractingRef.current = true
      try { window.__cameraInteracting = true } catch {}
    }
    const onEnd = () => {
      isInteractingRef.current = false
      try { window.__cameraInteracting = false } catch {}
    }
    try { c.addEventListener('start', onStart) } catch {}
    try { c.addEventListener('end', onEnd) } catch {}
    return () => {
      try { c.removeEventListener('start', onStart) } catch {}
      try { c.removeEventListener('end', onEnd) } catch {}
    }
  }, [])

  // Top-down wheel zoom: listen for wheel events on the canvas / gl.domElement
  useEffect(() => {
    if (mode !== 'top-down') {
      // Reset zoom when leaving top-down mode
      topDownZoomRef.current = 1.0
      topDownZoomTargetRef.current = 1.0
      return
    }
    const onWheel = (e) => {
      // Prevent page scroll while zooming
      e.preventDefault()
      const dir = e.deltaY > 0 ? 1 : -1 // positive = scroll down = zoom out
      topDownZoomTargetRef.current = THREE.MathUtils.clamp(
        topDownZoomTargetRef.current + dir * TOP_DOWN_ZOOM_STEP,
        TOP_DOWN_ZOOM_MIN,
        TOP_DOWN_ZOOM_MAX,
      )
    }
    // Attach to the canvas so it only captures wheel when hovering the 3D view
    const canvas = camera?.domElement ?? document.querySelector('canvas')
    const target = canvas || window
    target.addEventListener('wheel', onWheel, { passive: false })
    return () => target.removeEventListener('wheel', onWheel)
  }, [mode, camera])

  // Top-down drag-to-rotate: pointerdown captura X, pointerup commitea ±90°
  // según el signo del delta horizontal si pasó el threshold. Convención:
  // drag derecha → yaw += π/2 (cámara orbita CCW vista desde arriba, el
  // "mundo" se siente girando a la derecha, como agarrar y arrastrar).
  // SFX de zoom (rueda del mouse) — funciona en AMBOS modos. En third-person
  // OrbitControls maneja el zoom internamente; en top-down nuestro handler de
  // wheel ajusta el zoom multiplier. El wheel event llega al canvas en ambos
  // casos, así que un solo listener cubre los dos. Dedup interno de playSfx
  // (~80ms) limita a un sonido por tick de scroll. No cubre pinch-zoom en
  // mobile third-person (touch, no wheel) — agregar después si se necesita.
  useEffect(() => {
    const canvas = gl?.domElement ?? document.querySelector('canvas')
    if (!canvas) return
    try { preloadSfx(['zoom.wav']) } catch { }
    const onWheel = () => { try { playSfx('zoom.wav') } catch { } }
    canvas.addEventListener('wheel', onWheel, { passive: true })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [gl])

  useEffect(() => {
    if (mode !== 'top-down') return
    // Preload del sonido de swipe — evita latencia la primera vez que rota.
    try { preloadSfx(['Swipe.wav']) } catch { }
    const canvas = gl?.domElement ?? document.querySelector('canvas')
    if (!canvas) return

    let dragging = false
    let hovering = false
    let startX = 0
    let activePointerId = null

    const setCursor = (state) => {
      try { window.dispatchEvent(new CustomEvent('camera-grab', { detail: { state } })) } catch { }
    }
    const updateCursor = () => {
      if (dragging) setCursor('grabbing')
      else if (hovering) setCursor('grab')
      else setCursor('')
    }

    const onEnter = () => { hovering = true; updateCursor() }
    const onLeave = () => { hovering = false; if (!dragging) updateCursor() }
    const onDown = (e) => {
      if (e.button !== 0) return // solo click izquierdo
      // Si la escena ya capturó este drag (ej. user agarró una esfera de
      // HomeOrbs), NO iniciamos rotación de cámara. R3F dispatchea sus
      // onPointerDown sintéticos antes que este listener nativo, así que la
      // bandera ya está actualizada cuando llegamos aquí.
      if (window.__r3fSceneDragActive) return
      dragging = true
      startX = e.clientX
      activePointerId = e.pointerId
      try { canvas.setPointerCapture(e.pointerId) } catch { }
      updateCursor()
    }
    const onUp = (e) => {
      if (!dragging) return
      // Doble-check: si la escena está dragueando algo (orb agarrado), abortar
      // el commit de rotación. Esto cubre el caso donde el listener nativo de
      // pointerdown corrió ANTES del onPointerDown sintético de R3F (orden
      // de mount: efectos de hijos corren antes que los del Canvas padre, así
      // que mi onDown setea dragging=true antes de que HomeOrbs ponga la
      // bandera). En el pointerup el orden es favorable: canvas-listener
      // (este) corre antes que window-listener (HomeOrbs onUp), así que la
      // bandera SIGUE en true aquí cuando user soltó una esfera.
      if (window.__r3fSceneDragActive) {
        dragging = false
        try {
          if (activePointerId != null) canvas.releasePointerCapture(activePointerId)
        } catch { }
        activePointerId = null
        updateCursor()
        return
      }
      const dx = e.clientX - startX
      if (Math.abs(dx) > TOP_DOWN_DRAG_THRESHOLD_PX) {
        // Drag derecha → cámara CW (yaw negativo); drag izquierda → CCW.
        // Invertido vs versión inicial.
        topDownYawTargetRef.current -= Math.sign(dx) * (Math.PI / 2)
        try { playSfx('Swipe.wav') } catch { }
      }
      dragging = false
      try {
        if (activePointerId != null) canvas.releasePointerCapture(activePointerId)
      } catch { }
      activePointerId = null
      updateCursor()
    }
    const onCancel = () => {
      if (!dragging) return
      dragging = false
      activePointerId = null
      updateCursor()
    }

    canvas.addEventListener('pointerenter', onEnter)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
    return () => {
      canvas.removeEventListener('pointerenter', onEnter)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      setCursor('') // reset al salir de top-down
    }
  }, [mode, gl])

  // Place the camera behind the player on mount
  useEffect(() => {
    if (!playerRef.current) return
    const base = playerRef.current.position
    
    if (mode === 'top-down') {
      // Top-down: position camera above and slightly behind player
      const camPos = base.clone().add(topDownOffset)
      camera.position.copy(camPos)
      const target = base.clone().add(new THREE.Vector3(0, 0.5, 0))
      camera.lookAt(target)
      smoothTargetRef.current.copy(target)
      smoothCamPosRef.current.copy(camPos)
    } else {
      // Third-person: position camera behind player based on yaw
      const yaw = playerRef.current.rotation.y
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0))
      const rotatedOffset = followOffset.clone().applyQuaternion(q)
      const target = base.clone().add(targetOffset)
      camera.position.copy(base).add(rotatedOffset)
      camera.lookAt(target)
      smoothTargetRef.current.copy(target)
      smoothCamPosRef.current.copy(camera.position)
    }
  }, [camera, playerRef, followOffset, targetOffset, topDownOffset, mode])

  // Handle mode transitions smoothly
  useEffect(() => {
    if (prevModeRef.current !== mode && playerRef.current) {
      // Mode changed - initialize smooth position for transition
      const base = playerRef.current.position
      if (mode === 'top-down') {
        const camPos = base.clone().add(topDownOffset)
        smoothCamPosRef.current.copy(camera.position)
        const target = base.clone().add(new THREE.Vector3(0, 0.5, 0))
        smoothTargetRef.current.copy(target)
      } else {
        smoothCamPosRef.current.copy(camera.position)
      }
    }
    prevModeRef.current = mode
  }, [mode, playerRef, topDownOffset, camera])

  // Keep camera following the player — reuse temp vectors
  useFrame((state, delta) => {
    if (!playerRef.current) return
    if (!enabled) return
    
    const dt = Math.min(delta, 0.1) // cap to avoid jumps on tab-out
    const base = playerRef.current.position
    const tmp = tmpRef.current
    
    if (mode === 'top-down') {
      // TOP-DOWN MODE: Fixed overhead camera following player
      // Smoothly interpolate zoom factor
      topDownZoomRef.current += (topDownZoomTargetRef.current - topDownZoomRef.current) * TOP_DOWN_ZOOM_LERP
      const zoom = topDownZoomRef.current

      // Easing del yaw hacia el target (snap a múltiplo de π/2). Esto produce
      // la animación de rotación cuando el usuario suelta el drag.
      topDownYawRef.current += (topDownYawTargetRef.current - topDownYawRef.current) * TOP_DOWN_YAW_LERP
      const yaw = topDownYawRef.current
      const cy = Math.cos(yaw)
      const sy = Math.sin(yaw)

      // Rotar el offset XZ alrededor del player por el yaw actual.
      // (X' = X·cos + Z·sin, Z' = -X·sin + Z·cos) Y queda intacto.
      const ox = topDownOffset.x * zoom
      const oz = topDownOffset.z * zoom
      const rotX = ox * cy + oz * sy
      const rotZ = -ox * sy + oz * cy

      // Use temp vectors instead of clone(); apply zoom multiplier to offset
      const camPos = tmp.camPos.set(
        base.x + rotX,
        base.y + topDownOffset.y * zoom,
        base.z + rotZ,
      )
      const targetPos = tmp.targetPos.set(base.x, base.y + 0.5, base.z)
      
      // Apply shake if active
      if (shakeActive) {
        const t = state.clock.getElapsedTime()
        const amp = shakeAmplitude * 0.5
        targetPos.x += Math.sin(t * shakeFrequencyX) * amp
        targetPos.z += Math.cos(t * shakeFrequencyY) * amp
      }
      
      // FORCE camera position directly
      camera.position.set(camPos.x, camPos.y, camPos.z)
      camera.lookAt(targetPos)
      
      // Update OrbitControls target
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetPos)
      }
    } else {
      // THIRD-PERSON MODE: Original OrbitControls behavior
      if (!controlsRef.current) return
      
      // Use temp vector
      const desiredTarget = tmp.desiredTarget.copy(base).add(targetOffset)
      
      // Auto-follow camera behind player on demand (mobile)
      if (followBehind) {
        const yaw = playerRef.current.rotation.y
        // Reuse quaternion/euler
        tmp.euler.set(0, yaw, 0)
        tmp.quat.setFromEuler(tmp.euler)
        tmp.desired.copy(followOffset).applyQuaternion(tmp.quat)
        tmp.desired.add(base)
        const k = 1 - Math.exp(-8.0 * dt)
        camera.position.lerp(tmp.desired, k)
        camera.lookAt(desiredTarget)
      }
      
      // Smooth pivot — FRAME-RATE INDEPENDENT with damp()
      const isInteracting = Boolean(isInteractingRef.current)
      const useSmoothing = Boolean(isInteracting && playerMoving)
      const lambda = useSmoothing ? 6.0 : 12.0
      const dampK = 1 - Math.exp(-lambda * dt)
      smoothTargetRef.current.lerp(desiredTarget, dampK)
      // Use temp vector instead of clone()
      const target = tmp.target.copy(smoothTargetRef.current)

      if (shakeActive) {
        const t = state.clock.getElapsedTime()
        const amp = shakeAmplitude
        target.x += Math.sin(t * shakeFrequencyX) * amp
        target.y += Math.cos(t * shakeFrequencyY) * amp * shakeYMultiplier
      }
      controlsRef.current.target.copy(target)
      controlsRef.current.update()
    }
  })

  // In top-down mode, disable user rotation but keep OrbitControls mounted
  // so the camera system remains consistent
  const isTopDown = mode === 'top-down'

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={enabled && !isTopDown}
      // Touch: allow "look" with 1 finger while another finger uses the joystick.
      touches={{
        ONE: 0, // ROTATE
        TWO: 2, // DOLLY_PAN
      }}
      enablePan={!isTopDown}
      enableRotate={!isTopDown}
      enableZoom={!isTopDown}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.75}
      mouseButtons={{
        LEFT: 0,   // ROTATE
        MIDDLE: 1, // DOLLY
        RIGHT: 2,  // PAN
      }}
      minDistance={2.2}
      maxDistance={8}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.49}
    />
  )
}
