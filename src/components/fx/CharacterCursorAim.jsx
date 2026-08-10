import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

// Seguimiento de cabeza y ojos con el cursor.
//
// Vivía dentro de CharacterPortrait.jsx. Se extrajo tal cual —sin cambiar una
// línea de su lógica— para poder reusarlo en el personaje del preloader sin
// arrastrar el módulo del retrato completo, que importa todo
// @react-three/postprocessing (Bloom, Glitch, EdgeInk) y engordaría el chunk
// del arranque, justo lo que estamos tratando de aligerar.
//
// Los props del retrato (getPortraitCenter / getPortraitRect, para la dead
// zone del cursor) son OPCIONALES: el código los checa con typeof, así que
// montarlo solo con modelRef funciona y simplemente no aplica dead zone.

// Tuning constants — la mirada en screen-space.
// REACH = fracción de la diagonal del viewport que equivale a "yaw máximo".
// Cursor a esa distancia pixel del head → rotación saturada. Valores bajos
// (0.25-0.35) hacen que la mirada "cubra" gran parte del viewport rápido;
// valores altos (0.5-0.7) hacen que la mirada sea más sutil y requiera
// movimientos grandes. 0.45 es un punto medio natural.
const GAZE_REACH_FRAC = 0.45
// Curve < 1 = ease-out (reacción rápida cerca del head, saturación lenta).
// Curve > 1 = ease-in. 0.7 da una sensación "atenta" sin caricatura.
const GAZE_CURVE = 0.7
const MAX_YAW = 0.55      // ~32° — el personaje mira de frente, no perfil
const MAX_PITCH = 0.45    // ~26°
const EYE_MAX_YAW = 0.50  // ~29° — ojos lideran la lectura perceptual
const EYE_MAX_PITCH = 0.38
const EYE_CURVE = 0.55    // ojos reaccionan antes que la cabeza
const DEAD_ZONE_RADIUS = 0.18 // fracción de min(vw,vh) alrededor del retrato
const HEAD_LERP = 0.18
const EYE_LERP = 0.35

function isEyeBoneName(name) {
  if (!name) return false
  if (!/eye/i.test(name)) return false
  if (/eyelid|eyebrow|eyelash|eyeball_cover/i.test(name)) return false
  return true
}

function CameraAim({ modelRef, getPortraitCenter, getPortraitRect, goldSkinActive }) {
  const { camera, gl } = useThree()
  const headObjRef = useRef(null)
  const eyeBonesRef = useRef([])
  const tmp = useRef({
    target: new THREE.Vector3(),
    size: new THREE.Vector3(),
    box: new THREE.Box3(),
    headWorld: new THREE.Vector3(),
    headNDC: new THREE.Vector3(),
  })
  const mouseRef = useRef({ x: 0, y: 0 })
  const canvasRectRef = useRef({ t: 0, rect: null })
  const baseRotRef = useRef({ x: null, y: null })
  // Track last input to auto recentre when idle
  const lastInputTsRef = useRef((typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const recenterNowRef = useRef(false)

  useEffect(() => {
    // Reset refs so head bone is re-discovered on model swap (e.g. gold skin)
    headObjRef.current = null
    eyeBonesRef.current = []
    baseRotRef.current = { x: null, y: null }
    if (!modelRef.current) return
    let found = null
    const eyes = []
    modelRef.current.traverse((o) => {
      if (!o || !o.name) return
      // Head: primero el nombre que contenga "head" y NO "eye" (evita "eye_head_*").
      if (!found && /head/i.test(o.name) && !/eye/i.test(o.name)) found = o
      // Eye bones: detección flexible, excluye párpados/cejas/pestañas.
      if (isEyeBoneName(o.name)) eyes.push(o)
    })
    headObjRef.current = found
    eyeBonesRef.current = eyes
    // Capture REAL base pose immediately (before tracking applies offsets)
    // and store it on the object so other systems (HeadNudge) can reuse it.
    try {
      if (headObjRef.current) {
        const h = headObjRef.current
        if (!h.userData) h.userData = {}
        if (!h.userData.__portraitBaseRot) {
          h.userData.__portraitBaseRot = { x: h.rotation.x, y: h.rotation.y, z: h.rotation.z }
        }
        if (baseRotRef.current.x === null || baseRotRef.current.y === null) {
          baseRotRef.current = { x: h.userData.__portraitBaseRot.x, y: h.userData.__portraitBaseRot.y }
        }
      }
      for (const eye of eyes) {
        if (!eye.userData) eye.userData = {}
        if (!eye.userData.__portraitBaseRot) {
          eye.userData.__portraitBaseRot = { x: eye.rotation.x, y: eye.rotation.y, z: eye.rotation.z }
        }
      }
    } catch { }
    const onMove = (e) => { mouseRef.current = { x: e.clientX || 0, y: e.clientY || 0 }; lastInputTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) }
    const onTouch = (e) => { try { const t = e.touches?.[0]; if (t) { mouseRef.current = { x: t.clientX, y: t.clientY }; lastInputTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) } } catch { } }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    // (Previously there was a timer-based rebase; it could capture the already-rotated head.
    //  Now the base is captured immediately when the head is detected.)
    const onInput = () => { lastInputTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) }
    window.addEventListener('pointerdown', onInput, { passive: true })
    window.addEventListener('touchstart', onInput, { passive: true })
    // Recentre on exit-section signal
    const onExit = () => { recenterNowRef.current = true; yawBiasRef.current = 0; pitchBiasRef.current = 0; lastInputTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) }
    const onRecenter = () => { recenterNowRef.current = true; lastInputTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) }
    window.addEventListener('exit-section', onExit)
    window.addEventListener('portrait-recenter', onRecenter)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('pointerdown', onInput)
      window.removeEventListener('touchstart', onInput)
      window.removeEventListener('exit-section', onExit)
      window.removeEventListener('portrait-recenter', onRecenter)
    }
  // goldSkinActive triggers re-discovery when model clone changes
  }, [modelRef, goldSkinActive])

  // Priority 1: corre DESPUÉS del mixer de animaciones para que la rotación
  // del head/eyes no sea pisada por el idle clip (si es que lo toca).
  useFrame(() => {
    const model = modelRef.current
    if (!model) return
    const { target, size, box, headWorld, headNDC } = tmp.current
    const head = headObjRef.current
    if (!head) {
      box.setFromObject(model)
      box.getCenter(target)
      box.getSize(size)
      target.y = box.max.y - size.y * 0.1
      return
    }

    try {
      // 1. Posición del head en PIXELES DE VENTANA (screen space real).
      //    Proyectamos con el ortho del retrato → NDC del canvas → pixels
      //    sumando el rect del canvas DOM. Mismo sistema de coordenadas que
      //    el mouse → la diferencia es intuitiva y libre de sesgos.
      head.getWorldPosition(headWorld)
      headNDC.copy(headWorld).project(camera)
      const canvas = gl?.domElement
      // Rect del canvas cacheado ~250ms: leerlo cada frame era un reflow
      // sincrónico continuo (este canvas no se pausa dentro de las secciones).
      // El canvas es `fixed` y solo se mueve al hacer resize o al animar la
      // escala del retrato, y esto alimenta la mirada del personaje — unos ms
      // de desfase son imperceptibles.
      const nowMs = performance.now()
      if (canvas && (!canvasRectRef.current.rect || nowMs - canvasRectRef.current.t > 250)) {
        canvasRectRef.current = { t: nowMs, rect: canvas.getBoundingClientRect() }
      }
      const rect = canvasRectRef.current.rect || { left: 0, top: 0, width: 1, height: 1 }
      const headPxX = rect.left + (headNDC.x * 0.5 + 0.5) * rect.width
      const headPxY = rect.top + (1 - (headNDC.y * 0.5 + 0.5)) * rect.height

      // 2. Vector cursor ← head en pixels de ventana, normalizado por "reach".
      const vw = (typeof window !== 'undefined' ? window.innerWidth : 1920)
      const vh = (typeof window !== 'undefined' ? window.innerHeight : 1080)
      const dx = mouseRef.current.x - headPxX
      const dy = mouseRef.current.y - headPxY
      const reach = Math.max(1, Math.hypot(vw, vh) * GAZE_REACH_FRAC)
      const nx2 = THREE.MathUtils.clamp(dx / reach, -1, 1)
      const ny2 = THREE.MathUtils.clamp(dy / reach, -1, 1)

      // 3. Mapping no-lineal separado para head y eyes. sign(x)*|x|^curve
      //    da una reacción rápida cerca del centro y saturación suave en bordes.
      // NOTE de convención del rig: en este GLB, rotation.x positiva hace
      // que la cabeza apunte HACIA ABAJO (chin down). dy positivo significa
      // cursor debajo del head (window y crece hacia abajo). Entonces cursor
      // abajo → queremos pitch positivo → shape(ny2) sin negar. Si tu rig
      // fuera al revés, agregar `const PITCH_SIGN = -1` y multiplicar.
      const shape = (n, curve) => Math.sign(n) * Math.pow(Math.abs(n), curve)
      const yawHead = shape(nx2, GAZE_CURVE) * MAX_YAW
      const pitchHead = shape(ny2, GAZE_CURVE) * MAX_PITCH
      const yawEye = shape(nx2, EYE_CURVE) * EYE_MAX_YAW
      const pitchEye = shape(ny2, EYE_CURVE) * EYE_MAX_PITCH

      // 4. Dead zone alrededor del retrato — cuando el cursor está encima
      //    del avatar, fadeo a neutral para no "bizquear" en auto-interacción.
      let proximity = 0
      let insideRect = false
      if (typeof getPortraitCenter === 'function') {
        const c = getPortraitCenter()
        if (c && typeof c.x === 'number' && typeof c.y === 'number') {
          const dxp = mouseRef.current.x - c.x
          const dyp = mouseRef.current.y - c.y
          const dist = Math.hypot(dxp, dyp)
          const radius = Math.max(60, Math.min(vw, vh) * DEAD_ZONE_RADIUS)
          proximity = Math.max(0, Math.min(1, 1 - dist / radius))
        }
      }
      if (typeof getPortraitRect === 'function') {
        const r = getPortraitRect()
        if (r) {
          const m = 18
          const x = mouseRef.current.x
          const y = mouseRef.current.y
          insideRect = (x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m)
        }
      }
      if (insideRect) proximity = 1
      const deadZone = proximity * proximity * (3 - 2 * proximity) // smoothstep
      const activeAmp = 1 - deadZone
      const yawTarget = yawHead * activeAmp
      const pitchTarget = pitchHead * activeAmp

      // Capturar base del rig una sola vez (no sobreescribir si ya está).
      if (baseRotRef.current.x === null || baseRotRef.current.y === null) {
        const b = head.userData?.__portraitBaseRot
        baseRotRef.current = b ? { x: b.x, y: b.y } : { x: head.rotation.x, y: head.rotation.y }
      }

      // 5. Apply a head: recentre si hay trigger explícito (click/exit), si
      //    no, lerp a base + delta de mirada.
      if (recenterNowRef.current) {
        const k = 0.35
        const ty = baseRotRef.current.y != null ? baseRotRef.current.y : head.rotation.y
        const tx = baseRotRef.current.x != null ? baseRotRef.current.x : head.rotation.x
        head.rotation.y += (ty - head.rotation.y) * k
        head.rotation.x += (tx - head.rotation.x) * k
        if (Math.abs(head.rotation.y - ty) < 1e-3 && Math.abs(head.rotation.x - tx) < 1e-3) {
          recenterNowRef.current = false
        }
      } else {
        // Lerp ligeramente más lento dentro de la dead zone (sensación pausada).
        const lerp = Math.max(0.05, HEAD_LERP * (1 - 0.6 * deadZone))
        const targetYaw = baseRotRef.current.y + yawTarget
        const targetPitch = baseRotRef.current.x + pitchTarget
        head.rotation.y += (targetYaw - head.rotation.y) * lerp
        head.rotation.x += (targetPitch - head.rotation.x) * lerp
      }

      // 6. Eye bones (si el rig los tiene): lideran la mirada — rotan antes
      //    y más que la cabeza, es lo que el ojo humano lee como "me miró".
      const eyes = eyeBonesRef.current
      if (eyes && eyes.length > 0) {
        const tYaw = yawEye * activeAmp
        const tPitch = pitchEye * activeAmp
        for (const eye of eyes) {
          const eb = eye.userData?.__portraitBaseRot || { x: 0, y: 0 }
          const baseY = eb.y || 0
          const baseX = eb.x || 0
          if (recenterNowRef.current) {
            eye.rotation.y += (baseY - eye.rotation.y) * 0.45
            eye.rotation.x += (baseX - eye.rotation.x) * 0.45
          } else {
            const tY = baseY + tYaw
            const tX = baseX + tPitch
            eye.rotation.y += (tY - eye.rotation.y) * EYE_LERP
            eye.rotation.x += (tX - eye.rotation.x) * EYE_LERP
          }
        }
      }
    } catch { }
  }, 1)
  return null
}

export default CameraAim
export { isEyeBoneName }
