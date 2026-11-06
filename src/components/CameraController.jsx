import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { wallpaperEstado } from '../lib/wallpaperEscritorio.js'
import { playSfx, preloadSfx } from '../lib/sfx.js'
import { playCameraZoom, playCameraZoomStop } from '../lib/homeSounds.js'

const ORBIT_DIST_MIN = 2.2
const ORBIT_DIST_MAX = 8
// El temblor contra el tope del zoom: proporcional a la distancia para que se vea
// igual de cerca que de lejos.
const TEMBLOR_MS = 320
const TEMBLOR_AMP = 0.009
const CAMBIO_CAMARA_S = 1.1

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
  // Customizer mode: pose a fixed FRONT camera, character biased to screen-left
  // (UI panel lives on the right). Overrides follow + disables OrbitControls.
  customizeActive = false,
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
  const TOP_DOWN_ZOOM_MIN = 0.42   // max zoom-in  (closer)
  const TOP_DOWN_ZOOM_MAX = 1.3   // max zoom-out (farther)
  const TOP_DOWN_ZOOM_STEP = 0.06  // per wheel tick
  const TOP_DOWN_ZOOM_LERP = 0.08  // smoothing speed
  // Mientras hay un pinch de 2 dedos en curso, el drag-rotate de 1 dedo se
  // suprime para que separar/juntar los dedos no dispare un giro de cámara.
  const topDownPinchActiveRef = useRef(false)

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

  // ── Customizer front pose (player-local offsets, rotated by the player yaw) ──
  // The camera sits IN FRONT of the player's face (local +Z). A shared local-X
  // offset on BOTH the camera and the look target is a pure lateral truck → the
  // character renders toward screen-left without perspective skew. Flip the sign
  // of CUSTOMIZE_LATERAL if the character ends up on the wrong side.
  const CUSTOMIZE_FRONT_DIST = 4.5  // distance in front of the player (desktop) — zoom-out para que no se amontone con el panel
  const CUSTOMIZE_FRONT_DIST_MOBILE = 5.3 // zoom out on narrow viewports so the
  // full body fits and isn't clipped at the left edge (tall portrait aspect).
  const CUSTOMIZE_CAM_HEIGHT = 1.7  // camera height (~eye level)
  const CUSTOMIZE_TARGET_Y = 1.45   // look at upper torso / head
  const CUSTOMIZE_LATERAL = 0       // 0 = personaje CENTRADO (layout game-like: controles flanqueando izq/der)
  const CUSTOMIZE_LATERAL_MOBILE = 0
  const CUSTOMIZE_LERP_LAMBDA = 3.6 // graceful sweep speed (lower = more majestic)
  const CUSTOMIZE_SALIDA_S = 1.25 // el regreso a la vista de arriba: arranca y llega suave
  const custTmpRef = useRef({
    quat: new THREE.Quaternion(),
    euler: new THREE.Euler(),
    camOff: new THREE.Vector3(),
    tgtOff: new THREE.Vector3(),
    camTarget: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
  })
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

  const temblorRef = useRef({ desde: 0, fuerza: 1, aplicado: new THREE.Vector3() })
  // Cualquiera puede pedir el temblor con el evento: hoy, el disparo del láser.
  useEffect(() => {
    const onTemblor = (e) => {
      temblorRef.current.desde = performance.now()
      temblorRef.current.fuerza = e?.detail?.fuerza ?? 1
    }
    window.addEventListener('camera-temblor', onTemblor)
    return () => window.removeEventListener('camera-temblor', onTemblor)
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

  // Top-down pinch-to-zoom (mobile): el spread de 2 dedos ajusta el mismo
  // multiplicador que la rueda del mouse. El wheel no se dispara en touch, así
  // que sin esto el zoom era inalcanzable en celular (y el copy del HUD ya
  // prometía "pellizca para zoom"). Se mide la distancia entre dedos al inicio
  // del gesto y se escala el zoom por la razón inicial/actual: separar = acercar.
  useEffect(() => {
    if (mode !== 'top-down') {
      topDownPinchActiveRef.current = false
      return
    }
    const canvas = gl?.domElement ?? document.querySelector('canvas')
    if (!canvas) return
    let startDist = 0
    let startZoom = 1
    const dist = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.hypot(dx, dy)
    }
    const onTouchStart = (e) => {
      if (e.touches.length !== 2) return
      topDownPinchActiveRef.current = true
      startDist = dist(e.touches)
      startZoom = topDownZoomTargetRef.current
    }
    const onTouchMove = (e) => {
      if (!topDownPinchActiveRef.current || e.touches.length !== 2) return
      // Bloquea el scroll/zoom nativo de la página durante el gesto.
      e.preventDefault()
      if (startDist <= 0) return
      const ratio = startDist / dist(e.touches) // separar dedos → <1 → zoom-in
      topDownZoomTargetRef.current = THREE.MathUtils.clamp(
        startZoom * ratio,
        TOP_DOWN_ZOOM_MIN,
        TOP_DOWN_ZOOM_MAX,
      )
    }
    const onTouchEnd = (e) => {
      // Mantener suprimido el rotate hasta que se levanten TODOS los dedos,
      // para no rotar con el dedo que queda al terminar el pinch.
      if (e.touches.length === 0) topDownPinchActiveRef.current = false
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    canvas.addEventListener('touchcancel', onTouchEnd)
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
      topDownPinchActiveRef.current = false
    }
  }, [mode, gl])

  // Top-down drag-to-rotate: pointerdown captura X, pointerup commitea ±90°
  // según el signo del delta horizontal si pasó el threshold. Convención:
  // drag derecha → yaw += π/2 (cámara orbita CCW vista desde arriba, el
  // "mundo" se siente girando a la derecha, como agarrar y arrastrar).
  // Sonido del zoom (rueda del mouse), en los dos modos: en third-person lo mueve
  // OrbitControls y en top-down nuestro handler. Va un pip por cada tramo de rueda,
  // medido en lo que se avanza y no en eventos: un trackpad manda decenas por gesto.
  // Contra el tope suena una vez, hasta que sueltes la rueda o cambies de sentido.
  // En captura, para leer el zoom de antes de que este mismo evento lo mueva.
  useEffect(() => {
    const canvas = gl?.domElement ?? document.querySelector('canvas')
    if (!canvas) return
    const QUIET_MS = 250
    const RUEDA_POR_PIP = 40
    let ultimoEvento = 0
    let ultimoAcerca = false
    let acumulado = 0
    let enTope = false
    // 0 = lo más lejos, 1 = lo más cerca.
    const nivelZoom = () => {
      if (mode === 'top-down') {
        return (TOP_DOWN_ZOOM_MAX - topDownZoomTargetRef.current) / (TOP_DOWN_ZOOM_MAX - TOP_DOWN_ZOOM_MIN)
      }
      const d = camera.position.distanceTo(controlsRef.current.target)
      return THREE.MathUtils.clamp(Math.log(ORBIT_DIST_MAX / d) / Math.log(ORBIT_DIST_MAX / ORBIT_DIST_MIN), 0, 1)
    }
    const onWheel = (e) => {
      if (!e.deltaY || customizeActive) return
      if (mode !== 'top-down' && (!enabled || !controlsRef.current)) return
      const ahora = performance.now()
      const acerca = e.deltaY < 0
      const seguido = ahora - ultimoEvento < QUIET_MS && acerca === ultimoAcerca
      ultimoEvento = ahora
      ultimoAcerca = acerca
      const nivel = nivelZoom()
      if (acerca ? nivel > 0.99 : nivel < 0.01) {
        if (!seguido || !enTope) {
          playCameraZoomStop(acerca)
          temblorRef.current.desde = ahora
          temblorRef.current.fuerza = 1
        }
        enTope = true
        return
      }
      enTope = false
      acumulado = seguido ? acumulado + Math.abs(e.deltaY) : RUEDA_POR_PIP
      if (acumulado < RUEDA_POR_PIP) return
      acumulado = 0
      playCameraZoom(nivel)
    }
    canvas.addEventListener('wheel', onWheel, { passive: true, capture: true })
    return () => canvas.removeEventListener('wheel', onWheel, { capture: true })
  }, [gl, camera, mode, enabled, customizeActive])

  useEffect(() => {
    if (mode !== 'top-down') return
    // Preload del sonido de swipe — evita latencia la primera vez que rota.
    try { preloadSfx(['Swipe.mp3']) } catch { }
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
      // Si ya hay un pinch de 2 dedos en curso, no iniciar drag-rotate.
      if (topDownPinchActiveRef.current) return
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
      // Si hubo pinch durante esta secuencia, no commitear rotación.
      if (!topDownPinchActiveRef.current && Math.abs(dx) > TOP_DOWN_DRAG_THRESHOLD_PX) {
        // Drag derecha → cámara CW (yaw negativo); drag izquierda → CCW.
        // Invertido vs versión inicial.
        topDownYawTargetRef.current -= Math.sign(dx) * (Math.PI / 2)
        try { playSfx('Swipe.mp3') } catch { }
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

  // Place the camera behind the player on mount. Solo al inicio: en cada cambio de
  // modo la teletransportaba antes de que empezara el barrido.
  const colocadaRef = useRef(false)
  useEffect(() => {
    if (!playerRef.current || colocadaRef.current) return
    colocadaRef.current = true
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

  // Seed the smoothing refs from the live camera when entering customize mode,
  // so the transition into the front pose eases from wherever the camera was.
  useEffect(() => {
    if (!customizeActive || !playerRef.current) return
    smoothCamPosRef.current.copy(camera.position)
    const b = playerRef.current.position
    smoothTargetRef.current.set(b.x, b.y + CUSTOMIZE_TARGET_Y, b.z)
  }, [customizeActive, camera, playerRef, CUSTOMIZE_TARGET_Y])

  // Al salir de customize la cámara regresa por la misma órbita por la que llegó.
  // Se detecta aquí y no en un efecto: un solo cuadro de la vista de arriba se
  // vería como un corte.
  const enCustomizeRef = useRef(false)
  const saliendoRef = useRef(null)
  const modoRef = useRef(mode)

  // El barrido en órbita hacia otra vista: nunca cruza al personaje, y arranca y llega
  // suave. Lo usan la salida de customize y el cambio entre las dos cámaras.
  const iniciaBarrido = (base, mira, dur) => {
    const p = camera.position
    saliendoRef.current = {
      t: 0,
      dur,
      a: Math.atan2(p.x - base.x, p.z - base.z),
      r: Math.hypot(p.x - base.x, p.z - base.z),
      y: p.y,
      mira,
      yaw: playerRef.current.rotation.y,
    }
  }
  const barre = (sale, dt, base, destino, mira) => {
    sale.t = Math.min(1, sale.t + dt / sale.dur)
    const e = sale.t < 0.5 ? 4 * sale.t ** 3 : 1 - ((-2 * sale.t + 2) ** 3) / 2
    const r1 = Math.hypot(destino.x - base.x, destino.z - base.z)
    const a1 = Math.atan2(destino.x - base.x, destino.z - base.z)
    const dA = Math.atan2(Math.sin(a1 - sale.a), Math.cos(a1 - sale.a))
    const ang = sale.a + dA * e
    const rad = sale.r + (r1 - sale.r) * e
    camera.position.set(base.x + rad * Math.sin(ang), sale.y + (destino.y - sale.y) * e, base.z + rad * Math.cos(ang))
    smoothTargetRef.current.lerpVectors(sale.mira, mira, e)
    camera.lookAt(smoothTargetRef.current)
    if (controlsRef.current) controlsRef.current.target.copy(smoothTargetRef.current)
    if (sale.t >= 1) saliendoRef.current = null
  }

  // Keep camera following the player — reuse temp vectors
  useFrame((state, delta) => {
    if (!playerRef.current) return
    if (!enabled && !customizeActive) return

    const dt = Math.min(delta, 0.1) // cap to avoid jumps on tab-out
    const base = playerRef.current.position
    const tmp = tmpRef.current

    if (enCustomizeRef.current && !customizeActive) {
      iniciaBarrido(base, smoothTargetRef.current.clone(), CUSTOMIZE_SALIDA_S)
    }
    enCustomizeRef.current = customizeActive

    // CUSTOMIZE MODE: fixed front pose, character biased to screen-left.
    if (customizeActive) {
      const c = custTmpRef.current
      saliendoRef.current = null
      // En el modo wallpaper el que gira es Skulley: la cámara no lo sigue.
      const yaw = wallpaperEstado.fase !== 'off' ? wallpaperEstado.yawBase : playerRef.current.rotation.y
      c.euler.set(0, yaw, 0)
      c.quat.setFromEuler(c.euler)
      // Narrow viewports (mobile): pull the camera back so the whole body fits.
      const compact = (typeof window !== 'undefined' && window.innerWidth <= 1100)
      const frontDist = compact ? CUSTOMIZE_FRONT_DIST_MOBILE : CUSTOMIZE_FRONT_DIST
      const lateral = compact ? CUSTOMIZE_LATERAL_MOBILE : CUSTOMIZE_LATERAL
      // Camera in front of the face (+Z local) + lateral truck (+X local).
      c.camOff.set(lateral, CUSTOMIZE_CAM_HEIGHT, frontDist).applyQuaternion(c.quat)
      c.camTarget.copy(base).add(c.camOff)
      // Look target shares the same lateral offset → pure sideways framing.
      c.tgtOff.set(lateral, CUSTOMIZE_TARGET_Y, 0).applyQuaternion(c.quat)
      c.lookTarget.copy(base).add(c.tgtOff)

      const k = 1 - Math.exp(-CUSTOMIZE_LERP_LAMBDA * dt)
      // ORBIT transition: interpolate the camera around the player's vertical
      // axis in polar coords (azimuth + radius + height) instead of a straight
      // line. A linear lerp from behind would cut THROUGH the character and
      // snap the lookAt 180° — this sweeps a graceful arc and keeps the camera
      // facing the character the whole way. Majestic, no fly-through.
      const cur = smoothCamPosRef.current
      const curR = Math.hypot(cur.x - base.x, cur.z - base.z)
      const curA = Math.atan2(cur.x - base.x, cur.z - base.z)
      const tgtR = Math.hypot(c.camTarget.x - base.x, c.camTarget.z - base.z)
      const tgtA = Math.atan2(c.camTarget.x - base.x, c.camTarget.z - base.z)
      // Shortest signed arc (normalized to [-π, π]) so it never spins the long way.
      const dA = Math.atan2(Math.sin(tgtA - curA), Math.cos(tgtA - curA))
      const newA = curA + dA * k
      const newR = curR + (tgtR - curR) * k
      const newY = cur.y + (c.camTarget.y - cur.y) * k
      cur.set(base.x + newR * Math.sin(newA), newY, base.z + newR * Math.cos(newA))
      camera.position.copy(cur)
      // Look point eases linearly — it stays near the player center, so the
      // camera turns smoothly inward as it orbits (no flip).
      smoothTargetRef.current.lerp(c.lookTarget, k)
      camera.lookAt(smoothTargetRef.current)
      return
    }

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
      
      // Hacia donde va la vista de arriba en este cuadro: el personaje se puede mover.
      if (saliendoRef.current) {
        barre(saliendoRef.current, dt, base, camPos, targetPos)
        return
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

      // Llega a espaldas de como estaba Skulley al cambiar, aunque luego gire.
      if (saliendoRef.current) {
        const sale = saliendoRef.current
        tmp.euler.set(0, sale.yaw, 0)
        tmp.quat.setFromEuler(tmp.euler)
        tmp.desired.copy(followOffset).applyQuaternion(tmp.quat).add(base)
        barre(sale, dt, base, tmp.desired, desiredTarget)
        return
      }
      
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

  // El temblor se suma al final del cuadro y se quita al empezar el siguiente: así nada
  // de lo que sigue a la cámara o la acomoda (OrbitControls, los lerps) lo acumula.
  // El cambio de cámara se detecta en este mismo paso, antes que OrbitControls: al
  // encenderse jala la cámara a su distancia máxima y el barrido saldría de ahí.
  useFrame(() => {
    const { aplicado } = temblorRef.current
    camera.position.sub(aplicado)
    aplicado.set(0, 0, 0)
    if (modoRef.current === mode) return
    modoRef.current = mode
    if (enabled && !customizeActive && playerRef.current && controlsRef.current) {
      iniciaBarrido(playerRef.current.position, controlsRef.current.target.clone(), CAMBIO_CAMARA_S)
    }
  }, -2)
  useFrame(() => {
    const t = temblorRef.current
    const k = 1 - (performance.now() - t.desde) / TEMBLOR_MS
    if (k <= 0 || k > 1 || !controlsRef.current) return
    const amp = camera.position.distanceTo(controlsRef.current.target) * TEMBLOR_AMP * k * k * t.fuerza
    const s = performance.now() / 1000
    t.aplicado.set(Math.sin(s * 95) * amp, Math.sin(s * 73 + 1.3) * amp, 0).applyQuaternion(camera.quaternion)
    camera.position.add(t.aplicado)
  })

  // In top-down mode, disable user rotation but keep OrbitControls mounted
  // so the camera system remains consistent
  const isTopDown = mode === 'top-down'

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={enabled && !isTopDown && !customizeActive}
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
      minDistance={ORBIT_DIST_MIN}
      maxDistance={ORBIT_DIST_MAX}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.49}
    />
  )
}
