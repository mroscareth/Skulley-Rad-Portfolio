import React, { useEffect, useMemo, useRef, useState } from 'react'
import { XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { EffectComposer, DotScreen, Glitch, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction, GlitchMode } from 'postprocessing'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

function CharacterModel({ modelRef, glowVersion = 0 }) {
  const { scene, animations } = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true,
    true,
    (loader) => {
      try {
        const ktx2 = new KTX2Loader()
        ktx2.setTranscoderPath('https://unpkg.com/three@0.179.1/examples/jsm/libs/basis/')
        // @ts-ignore optional API
        if (loader.setKTX2Loader) loader.setKTX2Loader(ktx2)
      } catch {}
    },
  )
  // Clonar profundamente para no compartir jerarquías/skin con el jugador
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene])
  // Aislar materiales del retrato para que no compartan instancia con el Player
  useEffect(() => {
    if (!cloned) return
    try {
      cloned.traverse((obj) => {
        if (obj && obj.isMesh && obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map((m) => {
              const mm = m?.isMaterial ? m.clone() : m
              if (mm && mm.isMaterial) {
                mm.transparent = false
                mm.opacity = 1
                mm.depthWrite = true
                mm.userData = { ...(mm.userData || {}), __portraitMaterial: true }
              }
              return mm
            })
          } else if (obj.material.isMaterial) {
            const mm = obj.material.clone()
            mm.transparent = false
            mm.opacity = 1
            mm.depthWrite = true
            mm.userData = { ...(mm.userData || {}), __portraitMaterial: true }
            obj.material = mm
          }
        }
      })
    } catch {}
  }, [cloned])
  const { actions } = useAnimations(animations, cloned)
  const matUniformsRef = useRef(new Map())
  const materialsRef = useRef(new Set())
  const emissiveBaseRef = useRef(new Map())
  const glowColorRef = useRef(new THREE.Color('#ffd480'))
  const glowAmountRef = useRef(0)
  const PERMA_GLOW = true
  const prevGlowVRef = useRef(glowVersion)

  // Seleccionar clip de idle explícito si existe; si no, usar heurística
  const idleName = useMemo(() => {
    const names = actions ? Object.keys(actions) : []
    const explicitIdle = 'root|root|Iddle'
    if (names.includes(explicitIdle)) return explicitIdle
    return names.find((n) => n.toLowerCase().includes('idle')) || names[0]
  }, [actions])

  useEffect(() => {
    if (!actions || !idleName) return
    Object.values(actions).forEach((a) => a.stop())
    const idle = actions[idleName]
    if (idle) idle.reset().fadeIn(0.1).play()
  }, [actions, idleName])

  // Inject emissive glow uniform into materials and cache base emissive
  useEffect(() => {
    if (!cloned) return
    matUniformsRef.current.clear()
    materialsRef.current.clear()
    try {
      cloned.traverse((obj) => {
        if (!obj || !obj.isMesh || !obj.material) return
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach((mm) => {
          if (!mm || !mm.isMaterial) return
          materialsRef.current.add(mm)
          try {
            if (mm.emissive) {
              emissiveBaseRef.current.set(mm, { color: mm.emissive.clone(), intensity: typeof mm.emissiveIntensity === 'number' ? mm.emissiveIntensity : 1 })
            }
          } catch {}
          const original = mm.onBeforeCompile
          mm.onBeforeCompile = (shader) => {
            try {
              shader.uniforms.uGlow = { value: 0 }
              shader.uniforms.uGlowColor = { value: new THREE.Color('#ffe9b0') }
              const target = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );'
              const repl = `
                vec3 _outGlow = outgoingLight + uGlowColor * (uGlow * 3.0);
                gl_FragColor = vec4(_outGlow, diffuseColor.a );
              `
              if (shader.fragmentShader.includes(target)) {
                shader.fragmentShader = shader.fragmentShader.replace(target, repl)
              }
              matUniformsRef.current.set(mm, shader.uniforms)
            } catch {}
            if (typeof original === 'function') try { original(shader) } catch {}
          }
          mm.needsUpdate = true
        })
      })
    } catch {}
  }, [cloned])

  // Trigger glow on version change
  useEffect(() => {
    if (glowVersion !== prevGlowVRef.current) {
      prevGlowVRef.current = glowVersion
      glowAmountRef.current = 1.0
    }
  }, [glowVersion])

  useFrame((_, delta) => {
    const val = PERMA_GLOW ? 1.0 : glowAmountRef.current
    if (!PERMA_GLOW) {
      if (glowAmountRef.current <= 0) return
      glowAmountRef.current = Math.max(0, glowAmountRef.current * (1 - 2 * delta))
    }
    matUniformsRef.current.forEach((u) => {
      if (u && u.uGlow) u.uGlow.value = val
    })
    // Also drive emissive properties so the whole model glows clearly
    materialsRef.current.forEach((mm) => {
      try {
        const base = emissiveBaseRef.current.get(mm)
        if (!base || !mm.emissive) return
        mm.emissive.copy(glowColorRef.current)
        mm.emissiveIntensity = Math.max(0, (base.intensity || 1) + 8.0 * val)
      } catch {}
    })
  })

  // Posicionar el modelo para que se vea la cabeza dentro de la cápsula
  return (
    <group position={[0, -1.45, 0]}>
      <primitive ref={modelRef} object={cloned} scale={1.65} />
    </group>
  )
}

function CameraAim({ modelRef, getPortraitCenter, getPortraitRect }) {
  const { camera } = useThree()
  const headObjRef = useRef(null)
  const tmp = useRef({ target: new THREE.Vector3(), size: new THREE.Vector3(), box: new THREE.Box3() })
  const mouseRef = useRef({ x: 0, y: 0 })
  const headScreenRef = useRef(new THREE.Vector3())
  const yawBiasRef = useRef(0.0)
  const pitchBiasRef = useRef(0.0)
  const baseRotRef = useRef({ x: null, y: null })
  const rayRef = useRef(new THREE.Raycaster())
  const planeRef = useRef(new THREE.Plane())
  const pWorldRef = useRef(new THREE.Vector3())
  const camDirRef = useRef(new THREE.Vector3())
  const invParentRef = useRef(new THREE.Matrix4())
  const localHeadRef = useRef(new THREE.Vector3())
  const localHitRef = useRef(new THREE.Vector3())
  // Track last input to auto recentre when idle
  const lastInputTsRef = useRef((typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const recenterNowRef = useRef(false)

  useEffect(() => {
    if (!modelRef.current) return
    let found = null
    modelRef.current.traverse((o) => {
      if (!found && o.name && /head/i.test(o.name)) found = o
    })
    headObjRef.current = found
    // Capturar pose base REAL inmediatamente (antes de que el tracking aplique offsets)
    // y guardarla en el propio objeto para que otros sistemas (HeadNudge) la reutilicen.
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
    } catch {}
    const onMove = (e) => { mouseRef.current = { x: e.clientX || 0, y: e.clientY || 0 }; lastInputTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) }
    const onTouch = (e) => { try { const t = e.touches?.[0]; if (t) { mouseRef.current = { x: t.clientX, y: t.clientY }; lastInputTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) } } catch {} }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    // (Antes había un "rebase" por timer; eso podía capturar la cabeza ya girada y dejarla chueca.
    //  Ahora la base se captura inmediatamente al detectar la cabeza.)
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
  }, [modelRef])

  useFrame(() => {
    if (!modelRef.current) return
    const { target, size, box } = tmp.current
    if (headObjRef.current) {
      try {
        const head = headObjRef.current
        const headPos = new THREE.Vector3()
        head.getWorldPosition(headPos)
        // Raycast al plano perpendicular a la cámara que pasa por la cabeza
        const viewportW = (typeof window !== 'undefined' ? window.innerWidth : 1920)
        const viewportH = (typeof window !== 'undefined' ? window.innerHeight : 1080)
        const nx = (mouseRef.current.x / viewportW) * 2 - 1
        const ny = 1 - (mouseRef.current.y / viewportH) * 2
        camDirRef.current.set(0, 0, -1)
        camera.getWorldDirection(camDirRef.current)
        // Mezclar forward de cabeza con -camDir para robustez si el forward no es exacto
        const headForward = new THREE.Vector3(0, 0, -1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()))
        const mixedNormal = headForward.clone().lerp(camDirRef.current.clone().negate(), 0.35).normalize()
        planeRef.current.setFromNormalAndCoplanarPoint(mixedNormal, headPos)
        rayRef.current.setFromCamera({ x: nx, y: ny }, camera)
        const hit = rayRef.current.ray.intersectPlane(planeRef.current, pWorldRef.current)

        // Convertir hit a espacio local del padre para medir yaw/pitch relativos al rig
        const parent = head.parent || modelRef.current
        invParentRef.current.copy(parent.matrixWorld).invert()
        localHeadRef.current.copy(headPos).applyMatrix4(invParentRef.current)
        if (hit) localHitRef.current.copy(hit).applyMatrix4(invParentRef.current)
        else localHitRef.current.copy(localHeadRef.current).add(new THREE.Vector3(0, 0, -1))
        const dir = localHitRef.current.clone().sub(localHeadRef.current)
        // Yaw: derecha positiva; en espacio local el forward suele ser -Z
        const yawRaw = Math.atan2(dir.x, -dir.z)
        // Pitch: arriba positivo
        const pitchRaw = Math.atan2(dir.y, Math.hypot(dir.x, dir.z))
        // Calcular deltas en NDC para una atenuación cruzada estable
        headScreenRef.current.copy(headPos).project(camera)
        const dxScr = nx - headScreenRef.current.x
        const dyScr = ny - headScreenRef.current.y
        const ax = Math.tanh(dxScr * 1.0)
        const ay = Math.tanh(dyScr * 1.0)
        // Clamps base y escalas no lineales: reducir yaw cuando el cursor está muy arriba/abajo
        const maxYaw = 0.75
        const maxPitch = 0.6
        const yawScale = 1 - 0.45 * Math.pow(Math.min(1, Math.abs(ay)), 1.15)
        const pitchScale = 1 - 0.20 * Math.pow(Math.min(1, Math.abs(ax)), 1.10)
        let yawTarget = THREE.MathUtils.clamp(yawRaw * 0.85 * yawScale + yawBiasRef.current, -maxYaw, maxYaw)
        let pitchTarget = THREE.MathUtils.clamp(pitchRaw * 0.70 * pitchScale + pitchBiasRef.current, -maxPitch, maxPitch)
        // Capturar rotación base del rig una sola vez para remover offset intrínseco
        if (baseRotRef.current.x === null || baseRotRef.current.y === null) {
          const b = head?.userData?.__portraitBaseRot
          baseRotRef.current = b ? { x: b.x, y: b.y } : { x: head.rotation.x, y: head.rotation.y }
        }
        // Atenuar por proximidad al retrato: cerca del retrato => menos amplitud y más retraso
        let proximity = 0
        let insideRect = false
        let heroProx = 0
        try {
          if (typeof getPortraitCenter === 'function') {
            const c = getPortraitCenter()
            if (c && typeof c.x === 'number' && typeof c.y === 'number') {
              const vw = (typeof window !== 'undefined' ? window.innerWidth : 1920)
              const vh = (typeof window !== 'undefined' ? window.innerHeight : 1080)
              const dxP = (mouseRef.current.x - c.x)
              const dyP = (mouseRef.current.y - c.y)
              const dist = Math.hypot(dxP, dyP)
              // Radio de influencia: proporcional a la altura del retrato (~ 18rem ≈ 288px)
              const radius = Math.min(vw, vh) * 0.30 // umbral más amplio (≈30% pantalla)
              proximity = Math.max(0, Math.min(1, 1 - dist / Math.max(60, radius)))
              // Heurística de proximidad al personaje central (player): zona elíptica en tercio inferior
              const heroX = vw * 0.5
              const heroY = vh * 0.62
              const dxH = (mouseRef.current.x - heroX) / (vw * 0.22)
              const dyH = (mouseRef.current.y - heroY) / (vh * 0.28)
              const dH = Math.sqrt(dxH * dxH + dyH * dyH)
              heroProx = Math.max(0, Math.min(1, 1 - dH))
            }
          }
          if (typeof getPortraitRect === 'function') {
            const r = getPortraitRect()
            if (r) {
              const m = 18 // margen para activar más fácil
              const x = mouseRef.current.x
              const y = mouseRef.current.y
              insideRect = (x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m)
            }
          }
        } catch {}
        // Atenuación combinada: retrato + héroe (player) en pantalla
        const proxCombined = Math.max(proximity, heroProx)
        const ampScale = 1 - 0.65 * proxCombined
        yawTarget *= ampScale
        pitchTarget *= ampScale
        // Zona muerta cercana al retrato: desactiva seguimiento y regresa a neutro
        let inner = Math.max(0, Math.min(1, (proxCombined - 0.6) / 0.4))
        if (insideRect) inner = 1
        const innerEase = inner * inner * (3 - 2 * inner) // smoothstep
        yawTarget *= (1 - innerEase)
        pitchTarget *= (1 - innerEase)
        // Suavizado: aún más lento dentro de la zona muerta
        // Auto-recentre only when explicitly requested (slap/exit)
        if (recenterNowRef.current) {
          const k = recenterNowRef.current ? 0.35 : 0.22
          const ty = (baseRotRef.current.y != null ? baseRotRef.current.y : head.rotation.y)
          const tx = (baseRotRef.current.x != null ? baseRotRef.current.x : head.rotation.x)
          head.rotation.y += (ty - head.rotation.y) * k
          head.rotation.x += (tx - head.rotation.x) * k
          if (recenterNowRef.current && Math.abs(head.rotation.y - ty) < 1e-3 && Math.abs(head.rotation.x - tx) < 1e-3) recenterNowRef.current = false
        } else {
          const lerp = Math.max(0.045, 0.15 * (1 - 0.6 * proxCombined) * (1 - 0.6 * innerEase))
          const targetYaw = (baseRotRef.current.y != null ? baseRotRef.current.y : head.rotation.y) + yawTarget
          const targetPitch = (baseRotRef.current.x != null ? baseRotRef.current.x : head.rotation.x) + (-pitchTarget)
          head.rotation.y += (targetYaw - head.rotation.y) * lerp
          head.rotation.x += (targetPitch - head.rotation.x) * lerp
        }
        target.copy(headPos)
      } catch {
        headObjRef.current.getWorldPosition(target)
      }
    } else {
      box.setFromObject(modelRef.current)
      box.getCenter(target)
      box.getSize(size)
      target.y = box.max.y - size.y * 0.1
    }
    // No alteramos la cámara; sólo rotamos la cabeza para seguir el cursor
  })
  return null
}

function SyncOrthoCamera({ y, zoom }) {
  const { camera } = useThree()
  useFrame(() => {
    if (!camera) return
    // Fijar una pose estable de cámara ortográfica para evitar desviaciones entre recargas
    camera.position.set(0, y, 10)
    camera.rotation.set(0, 0, 0)
    if (typeof camera.zoom === 'number') camera.zoom = zoom
    camera.updateProjectionMatrix()
  })
  return null
}

function EggCameraShake({ active, amplitude = 0.012, rot = 0.005, frequency = 18, burstUntilRef }) {
  const { camera } = useThree()
  const base = useRef({ pos: camera.position.clone(), rot: camera.rotation.clone() })
  useEffect(() => {
    return () => {
      // restaurar cámara al desmontar
      camera.position.copy(base.current.pos)
      camera.rotation.copy(base.current.rot)
    }
  }, [camera])
  useFrame((state) => {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const burstActive = Boolean(burstUntilRef?.current && now < burstUntilRef.current)
    const isActive = active || burstActive
    if (!isActive) {
      camera.position.lerp(base.current.pos, 0.2)
      camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, base.current.rot.x, 0.2)
      camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, base.current.rot.y, 0.2)
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, base.current.rot.z, 0.2)
      return
    }
    const t = state.clock.getElapsedTime()
    const ampNow = burstActive ? amplitude * 4 : amplitude
    const rotNow = burstActive ? rot * 3 : rot
    const freqNow = burstActive ? frequency * 1.25 : frequency
    const ax = Math.sin(t * freqNow) * ampNow
    const ay = Math.cos(t * (freqNow * 1.27)) * ampNow * 0.75
    const az = (Math.sin(t * (freqNow * 0.83)) + Math.sin(t * (freqNow * 1.91))) * 0.5 * ampNow * 0.6
    camera.position.x = base.current.pos.x + ax
    camera.position.y = base.current.pos.y + ay
    camera.position.z = base.current.pos.z + az
    camera.rotation.z = base.current.rot.z + Math.sin(t * (freqNow * 0.6)) * rotNow
  })
  return null
}

function PinBackLight({ modelRef, intensity, angle, penumbra, posY, posZ, color }) {
  const lightRef = useRef(null)
  const targetRef = useRef(null)
  const headObjRef = useRef(null)
  const tmp = useRef({ target: new THREE.Vector3(), size: new THREE.Vector3(), box: new THREE.Box3() })

  useEffect(() => {
    if (!modelRef.current) return
    let found = null
    modelRef.current.traverse((o) => {
      if (!found && o.name && /head/i.test(o.name)) found = o
    })
    headObjRef.current = found
  }, [modelRef])

  useFrame(() => {
    if (!lightRef.current || !targetRef.current || !modelRef.current) return
    const { target, size, box } = tmp.current
    if (headObjRef.current) {
      headObjRef.current.getWorldPosition(target)
    } else {
      box.setFromObject(modelRef.current)
      box.getCenter(target)
      box.getSize(size)
      target.y = box.max.y - size.y * 0.1
    }
    // Colocar target en la cabeza y apuntar el foco
    targetRef.current.position.copy(target)
    lightRef.current.target = targetRef.current
    lightRef.current.target.updateMatrixWorld()
  })

  return (
    <>
      {/* Luz puntual/spot detrás del modelo para rim light */}
      <spotLight
        ref={lightRef}
        position={[0, posY, posZ]}
        angle={angle}
        penumbra={penumbra}
        intensity={intensity}
        color={color}
      />
      <object3D ref={targetRef} />
    </>
  )
}

function HeadNudge({ modelRef, version }) {
  const rndRef = React.useRef({})
  // amortiguador elástico que vuelve a neutro tras el golpe
  React.useEffect(() => {
    if (!modelRef.current) return
    // localizar cabeza por nombre o heurística
    let head = null
    modelRef.current.traverse((o) => { if (!head && o.name && /head/i.test(o.name)) head = o })
    if (!head) return
    // IMPORTANT: volver siempre a la pose base del retrato (no al estado momentáneo)
    const base = (head.userData && head.userData.__portraitBaseRot)
      ? head.userData.__portraitBaseRot
      : { x: head.rotation.x, y: head.rotation.y, z: head.rotation.z }
    const baseX = base.x
    const baseY = base.y
    const baseZ = base.z
    const kickX = (Math.random() * 0.7 - 0.35)
    const kickY = (Math.random() * 1.4 - 0.7)
    const kickZ = (Math.random() * 0.7 - 0.35)
    let vx = 0, vy = 0, vz = 0
    let x = head.rotation.x + kickX
    let y = head.rotation.y + kickY
    let z = head.rotation.z + kickZ
    // Ajustes más rápidos y con amortiguación mayor para acortar la duración
    const stiffness = 28
    const damping = 1.8
    let last = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    let anim = true
    const loop = () => {
      if (!anim) return
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // muelle hacia base
      vx += (-(x - baseX) * stiffness - vx * damping) * dt
      vy += (-(y - baseY) * stiffness - vy * damping) * dt
      vz += (-(z - baseZ) * stiffness - vz * damping) * dt
      x += vx * dt
      y += vy * dt
      z += vz * dt
      head.rotation.x = x
      head.rotation.y = y
      head.rotation.z = z
      // Criterio de parada más agresivo; al finalizar, fijar exactamente la pose base
      if (Math.abs(x - baseX) + Math.abs(y - baseY) + Math.abs(z - baseZ) < 0.004 && Math.abs(vx)+Math.abs(vy)+Math.abs(vz) < 0.006) {
        anim = false
        head.rotation.x = baseX
        head.rotation.y = baseY
        head.rotation.z = baseZ
        // Forzar recentrado del tracker para evitar que quede un residuo tras spam de clicks
        try { window.dispatchEvent(new CustomEvent('portrait-recenter')) } catch {}
        return
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }, [modelRef, version])
  return null
}

export default function CharacterPortrait({
  dotEnabled = true,
  dotScale = 1,
  dotAngle = Math.PI / 4,
  dotCenterX = 0.38,
  dotCenterY = 0.44,
  dotOpacity = 0.04,
  dotBlend = 'screen',
  showUI = true,
  onEggActiveChange,
  glowVersion = 0,
  zIndex = 600,
  showExit = false,
  // Hero mode: re-parent UI into a target container and change layout/scale
  mode = 'overlay', // 'overlay' | 'hero'
  portalTargetSelector = '#about-hero-anchor',
  actionCooldown = 0,
  bubblesEnabled = true,
  eggEnabled = true,
}) {
  const { lang, t } = useLanguage()
  const modelRef = useRef()
  const containerRef = useRef(null)
  const portraitRef = useRef(null)
  // Límites de cámara: maximos dados por el usuario
  const CAM_Y_MAX = 0.8
  const CAM_Y_MIN = -1.0
  const ZOOM_MAX = 160
  const ZOOM_MIN = 15
  const clickShakeUntilRef = useRef(0)
  // Detección local de perfil móvil/low‑perf para optimizar el retrato
  const isLowPerf = React.useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer:coarse)').matches
    const saveData = navigator.connection && (navigator.connection.saveData || (navigator.connection.effectiveType && /2g/.test(navigator.connection.effectiveType)))
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4
    const lowThreads = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
    const highDPR = window.devicePixelRatio && window.devicePixelRatio > 2
    return Boolean(isMobileUA || coarse || saveData || lowMemory || lowThreads || highDPR)
  }, [])
  useEffect(() => {
    return () => { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current) }
  }, [])
  // Controles de luz (ajustables por el usuario)
  const [lightIntensity, setLightIntensity] = useState(20)
  const [lightAngle, setLightAngle] = useState(1)
  const [lightPenumbra, setLightPenumbra] = useState(0.28)
  const [lightPosY, setLightPosY] = useState(2.7)
  const [lightPosZ, setLightPosZ] = useState(-0.2)
  const [lightColor, setLightColor] = useState('#ffffff')
  const [copied, setCopied] = useState(false)
  // Exit button mode override: 'close' (default) or 'back' (used by project detail)
  const [exitMode, setExitMode] = useState('close')
  useEffect(() => {
    const onMode = (e) => {
      try { if (e && e.detail && (e.detail.mode === 'back' || e.detail.mode === 'close')) setExitMode(e.detail.mode) } catch {}
    }
    window.addEventListener('portrait-exit-mode', onMode)
    return () => window.removeEventListener('portrait-exit-mode', onMode)
  }, [])

  // Cursor personalizado (slap.svg) dentro del retrato
  const [cursorVisible, setCursorVisible] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [cursorScale, setCursorScale] = useState(1)
  // Cámara libre vertical (sin lookAt forzado) y zoom sin distorsión
  const [camY, setCamY] = useState(CAM_Y_MAX)
  const [camZoom, setCamZoom] = useState(ZOOM_MAX)
  // Al entrar en hero mode, fijar cámara estable y bloquear interacciones
  useEffect(() => {
    if (mode !== 'hero') return
    setCamY(CAM_Y_MAX)
    setCamZoom(ZOOM_MAX)
    // Bloque extra: recentrar cámara cada frame breve tras entrar para evitar drift inicial
    let t = 0
    const id = setInterval(() => {
      setCamY((v) => (t < 6 ? CAM_Y_MAX : v))
      setCamZoom((z) => (t < 6 ? ZOOM_MAX : z))
      t += 1
      if (t >= 6) clearInterval(id)
    }, 32)
    return () => clearInterval(id)
  }, [mode])
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ y: 0, camY: CAM_Y_MAX })
  const [headNudgeV, setHeadNudgeV] = useState(0)

  // Audio de click (punch) con polifonía: pool de instancias
  const clickAudioPoolRef = useRef([])
  const clickAudioIdxRef = useRef(0)
  const audioCtxRef = useRef(null)
  const audioBufferRef = useRef(null)
  useEffect(() => {
    const POOL_SIZE = 8
    const pool = new Array(POOL_SIZE).fill(null).map(() => {
      const a = new Audio(`${import.meta.env.BASE_URL}punch.mp3`)
      a.preload = 'auto'
      a.volume = 0.5
      try { a.load() } catch {}
      return a
    })
    clickAudioPoolRef.current = pool
    return () => {
      clickAudioPoolRef.current = []
    }
  }, [])

  // Web Audio: precargar y decodificar el audio para latencia casi cero
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    audioCtxRef.current = ctx
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}punch.mp3`, { cache: 'force-cache' })
        const arr = await res.arrayBuffer()
        const buf = await ctx.decodeAudioData(arr)
        if (!cancelled) audioBufferRef.current = buf
      } catch {}
    })()
    return () => {
      cancelled = true
      try { ctx.close() } catch {}
    }
  }, [])

  // Easter egg: multi‑click en el retrato (i18n)
  const eggPhrases = useMemo(() => {
    try {
      const arr = t('portrait.eggPhrases')
      if (Array.isArray(arr) && arr.length) return arr
    } catch {}
    return [
      "Even after life, you poke my very soul to make your logo bigger? Let me rest…",
      "Yeah, a graphic designer's job is also to entertain you, right?",
      "Fuck off, I'm tired of you…",
      "Did you know that this is considered bullying, right?",
      "Everything OK at home?",
      "So this is what it feels like not being registered in social security?",
      "“Let me rest… go away, dude!”",
      "If you keep poking my soul, I will not make your logo bigger.",
      "I'm sending you an invoice for this, OK?",
      "I will report you for using pirate software.",
      "¡Deja de chingar! …That's what my uncle says when he's mad.",
    ]
  }, [lang])
  const [eggActive, setEggActive] = useState(false)
  const [eggPhrase, setEggPhrase] = useState('')
  const eggTimerRef = useRef(null)
  const eggStyleTimerRef = useRef(null)
  const clickCountRef = useRef(0)
  const lastClickTsRef = useRef(0)
  const eggActiveRef = useRef(false)
  useEffect(() => { eggActiveRef.current = eggActive }, [eggActive])

  async function handlePortraitClick() {
    // Burst de shake de cámara del retrato (≈ 480ms)
    const nowTs = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    clickShakeUntilRef.current = nowTs + 480
    // Animación de cursor más grande con ligero rebote al hacer click
    setCursorScale(1.9)
    window.setTimeout(() => setCursorScale(0.96), 110)
    window.setTimeout(() => setCursorScale(1.08), 200)
    window.setTimeout(() => setCursorScale(1), 280)
    // Sonido punch (Web Audio preferido para baja latencia)
    let played = false
    const ctx = audioCtxRef.current
    const buffer = audioBufferRef.current
    if (ctx && buffer) {
      try { if (ctx.state !== 'running') await ctx.resume() } catch {}
      try {
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = 0.9
        src.connect(gain).connect(ctx.destination)
        src.start(0)
        played = true
      } catch {}
    }
    // Fallback a HTMLAudio pool si Web Audio falla
    if (!played) {
      const pool = clickAudioPoolRef.current
      if (pool && pool.length) {
        const i = clickAudioIdxRef.current % pool.length
        clickAudioIdxRef.current += 1
        const a = pool[i]
        try { a.currentTime = 0 } catch {}
        try { a.play() } catch {}
      }
    }
    // Nudge de cabeza
    setHeadNudgeV((v) => v + 1)
    try { window.dispatchEvent(new CustomEvent('portrait-recenter')) } catch {}
    const now = Date.now()
    const delta = now - lastClickTsRef.current
    if (delta > 600) {
      clickCountRef.current = 0
    }
    lastClickTsRef.current = now
    clickCountRef.current += 1
    // Glitch/Easter‑egg debe poder activarse aunque las viñetas del retrato estén apagadas
    if (eggEnabled && clickCountRef.current > 3 && !eggActive) {
      const idx = Math.floor(Math.random() * Math.max(1, eggPhrases.length))
      eggIdxRef.current = idx
      const phrase = eggPhrases[idx] || eggPhrases[0]
      setEggPhrase(phrase)
      setEggActive(true)
      schedulerPausedRef.current = true
      if (typeof onEggActiveChange === 'function') onEggActiveChange(true)
      // Disparar frase del easter egg hacia la viñeta 3D (si existe)
      try {
        window.dispatchEvent(new CustomEvent('speech-bubble-override', { detail: { phrasesKey: 'portrait.eggPhrases', idx, durationMs: 7000 } }))
      } catch {}

      // Si las viñetas del retrato están habilitadas, mostrar la frase egg aquí también.
      if (bubblesEnabled) {
        setBubbleText(phrase)
        setShowBubble(true)
        setBubbleTheme('egg')
      }
      // Cancelar timers de viñetas normales
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)

      // Posicionar como en flujo normal (solo si hay viñeta del retrato)
      if (bubblesEnabled) {
        requestAnimationFrame(() => {
          const contEl = containerRef.current
          const bubbleEl = bubbleRef.current
          if (contEl && bubbleEl) {
            const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
            const c = contEl.getBoundingClientRect()
            const b = bubbleEl.getBoundingClientRect()
            const marginRight = -18
            const marginTop = -18
            let rightTop = clamp(c.top + c.height * 0.25 - b.height * 0.3, 8, window.innerHeight - b.height - 8)
            let rightLeft = c.right + marginRight
            const fitsRight = rightLeft + b.width <= window.innerWidth - 8
            let topTop = c.top - b.height - marginTop
            let topLeft = clamp(c.left + c.width / 2 - b.width / 2, 8, window.innerWidth - b.width - 8)
            const fitsTop = topTop >= 8
            let placedTop = 0
            let placedLeft = 0
            if (fitsRight) {
              setBubbleSide('right')
              placedTop = rightTop
              placedLeft = rightLeft
            } else if (fitsTop) {
              setBubbleSide('top')
              placedTop = topTop
              placedLeft = topLeft
            } else {
              setBubbleSide('right')
              rightLeft = clamp(rightLeft, 8, window.innerWidth - b.width - 8)
              placedTop = rightTop
              placedLeft = rightLeft
            }
            // Evitar solaparse con el joystick móvil (centrado abajo)
            try {
              const JOY_RADIUS = 52
              const JOY_BOTTOM = 40
              const pad = 16
              const joyCenterX = window.innerWidth / 2
              const joyCenterY = window.innerHeight - (JOY_BOTTOM + JOY_RADIUS)
              const joyRect = {
                left: joyCenterX - JOY_RADIUS - pad,
                right: joyCenterX + JOY_RADIUS + pad,
                top: joyCenterY - JOY_RADIUS - pad,
                bottom: joyCenterY + JOY_RADIUS + pad,
              }
              const bubbleRect = { left: placedLeft, top: placedTop, right: placedLeft + b.width, bottom: placedTop + b.height }
              const intersects = !(bubbleRect.right < joyRect.left || bubbleRect.left > joyRect.right || bubbleRect.bottom < joyRect.top || bubbleRect.top > joyRect.bottom)
              if (intersects) {
                if (fitsTop) {
                  setBubbleSide('top')
                  placedTop = topTop
                  placedLeft = topLeft
                } else {
                  placedTop = Math.max(8, joyRect.top - b.height - 8)
                  placedLeft = clamp(placedLeft, 8, window.innerWidth - b.width - 8)
                }
              }
            } catch {}
            setBubblePos({ top: placedTop, left: placedLeft })
            const bCenterX = placedLeft + b.width / 2
            const bCenterY = placedTop + b.height / 2
            // Punto objetivo aproximado (zona del personaje)
            const targetX = c.left + c.width * 0.1
            const targetY = c.top + c.height * 0.35
            const ang = Math.atan2(targetY - bCenterY, targetX - bCenterX)
            // Anclar en el borde de la viñeta con padding interior
            const padEdge = 10
            const rx = Math.max(8, b.width / 2 - padEdge)
            const ry = Math.max(8, b.height / 2 - padEdge)
            const axLocal = b.width / 2 + Math.cos(ang) * rx
            const ayLocal = b.height / 2 + Math.sin(ang) * ry
            // Empujar la cola ligeramente hacia afuera para que salga de la viñeta
            const pushOut = 12
            const cx = axLocal + Math.cos(ang) * pushOut
            const cy = ayLocal + Math.sin(ang) * pushOut
            setTail({ x: axLocal, y: ayLocal, cx, cy, angleDeg: (ang * 180) / Math.PI })
          }
        })
      }

      // Unificar fin del egg y viñeta (SIEMPRE, aunque bubblesEnabled=false)
      const EGG_MS = 7000
      if (eggStyleTimerRef.current) window.clearTimeout(eggStyleTimerRef.current)
      eggStyleTimerRef.current = window.setTimeout(() => {
        setBubbleTheme('normal')
      }, EGG_MS)
      clickCountRef.current = 0
      if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current)
      const myEggEpoch = (eggStyleTimerRef.current ? eggStyleTimerRef.current : 0) + 1
      eggStyleTimerRef.current = myEggEpoch
      eggTimerRef.current = window.setTimeout(() => {
        if (eggStyleTimerRef.current !== myEggEpoch) return
        setShowBubble(false)
        setEggActive(false)
        setEggPhrase('')
        setBubbleTheme('normal')
        if (typeof onEggActiveChange === 'function') onEggActiveChange(false)
        // reanudar normal tras breve pausa
        const delayBack = 800
        window.setTimeout(() => {
          schedulerPausedRef.current = false
          if (!eggActiveRef.current) scheduleNextRef.current()
        }, delayBack)
      }, EGG_MS)
    }
  }

  function handleMouseEnter() {
    setCursorVisible(true)
    const ctx = audioCtxRef.current
    if (ctx && ctx.state !== 'running') {
      // Intentar reanudar en primer gesto del usuario para eliminar latencia del primer click
      ctx.resume().catch(() => {})
    }
  }
  function handleMouseLeave() { setCursorVisible(false); draggingRef.current = false }
  function handleMouseMove(e) {
    const el = portraitRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCursorPos({ x: e.clientX - r.left, y: e.clientY - r.top })
    if (draggingRef.current) {
      const dy = e.clientY - dragStartRef.current.y
      const next = dragStartRef.current.camY - dy * 0.01
      setCamY(Math.max(CAM_Y_MIN, Math.min(CAM_Y_MAX, next)))
    }
  }
  function handleMouseDown(e) {
    draggingRef.current = true
    dragStartRef.current = { y: e.clientY, camY }
  }
  function handleMouseUp() { draggingRef.current = false }
  function handleWheel(e) {
    const next = camZoom - e.deltaY * 0.06
    setCamZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next)))
  }

  // Frases estilo cómic (i18n)
  const phrases = useMemo(() => {
    try {
      const arr = t('portrait.phrases')
      if (Array.isArray(arr) && arr.length) return arr
    } catch {}
    return [
      `Yeah, well, AI killed graphic designers and here i am, fucking entertaining you...`,
      `I didn’t starve, I was just doing intermittent fasting… forever.`,
      `Turns out my portfolio wasn’t compatible with ChatGPT.`,
      `I asked MidJourney for food, it gave me a moodboard.`,
      `AI ate my job, so I ate… nothing.`,
      `They said design feeds the soul. Pity it doesn’t feed the stomach.`,
      `At least my hunger pangs come in a nice minimalist grid.`,
      `I died in Helvetica Bold, not Comic Sans.`,
      `Clients still ghosted me… now permanently.`,
      `AI doesn’t sleep, but apparently I don’t eat.`,
      `At my funeral, please kerning the flowers properly.`,
      `I asked DALL·E for bread… it gave me a surrealist painting of toast.`,
      `Even my gravestone has better alignment than my old invoices.`,
      `AI doesn’t get paid, but neither did I.`,
      `Starving for art was supposed to be metaphorical.`,
      `At least my hunger made me pixel-perfect thin.`,
      `My last meal was RGB soup with a side of CMYK crumbs.`,
      `No one wanted to pay for logos, but hey, I died branded.`,
      `AI makes logos in 5 seconds. I made one in 5 days… then died.`,
      `My obituary will be in Arial, because I wasn’t worth a typeface license.`,
      `I thought I was irreplaceable. AI thought otherwise.`,
      `Hungry, but at least my color palette was vibrant.`,
      `They asked for unlimited revisions. I gave them unlimited silence.`,
      `I went from freelancing to free starving.`,
      `AI doesn’t complain about exposure. I just died from it.`,
      `Design used to keep me alive. Now it’s just keeping my Behance alive.`,
      `I tried to barter my Photoshop skills for tacos. Didn’t work.`,
      `The only thing left aligned in my life was my coffin.`,
      `I asked for a client brief. Life gave me a death brief.`,
      `AI makes mistakes too… but at least it doesn’t need lunch.`,
      `I’m not gone, I’m just on the ultimate creative break.`,
      `I used to design posters. Now I’m the poster child of unemployment.`,
      `My diet? Strictly vector-based.`,
      `Clients said: ‘Can you make it pop?’ — my stomach did.`,
      `I always wanted to be timeless. Death helped.`,
      `I finally reached negative space: my fridge.`,
      `I exported myself… as a ghost.`,
      `They paid me in exposure. Turns out exposure kills.`,
      `At least AI can’t feel hunger… lucky bastard.`,
      `I designed my own tombstone. Minimalist. No budget.`,
      `I was 99% caffeine, 1% hope.`,
      `Starved, but hey—my resume is still responsive.`,
      `I left life on draft mode.`,
      `They said design is forever. Guess rent isn’t.`,
      `No more clients asking for ‘one last change’… finally.`,
      `My life was low budget, but high resolution.`,
      `I aligned everything… except my destiny.`,
      `AI took my clients. Hunger took my soul.`,
      `I’m trending now… in the obituary section.`,
      `I wanted to go viral. Ended up going vital… signs flat.`,
      `I kerning-ed myself into the grave.`,
      `The only thing scalable now is my skeleton.`,
      `I asked life for balance. It gave me imbalance and starvation.`,
      `They’ll miss me when AI starts using Comic Sans.`,
      `I worked for peanuts… wish I had actual peanuts.`,
      `Dead, but at least I’m vector — infinitely scalable.`,
      `They automated design. Can they automate tacos too?`,
      `Death was my final deadline.`,
      `AI makes perfect gradients. Mine was starvation to extinction.`,
      `I asked the universe for feedback. It replied: ‘Looks good, but you’re gone.’`,
      `I didn’t lose my job. I just Ctrl+Z’d out of existence.`,
    ]
  }, [lang])

  // Actualizar viñeta activa cuando cambia el idioma
  // Al cambiar idioma, re-traducir el texto mostrado y reiniciar SOLO su tiempo visible
  useEffect(() => {
    if (!bubblesEnabled) return
    try {
      if (eggActive && eggPhrase && eggIdxRef.current != null) {
        const fresh = t && typeof t === 'function' ? t('portrait.eggPhrases') : null
        const arr = (Array.isArray(fresh) && fresh.length) ? fresh : (eggPhrasesRef.current || eggPhrases)
        const idx = eggIdxRef.current
        const next = arr[idx] || arr[0] || ''
        setEggPhrase(next)
        setBubbleText(next)
        // Reiniciar sólo el tiempo visible de la viñeta actual (egg)
        bumpEpoch()
        const myEpochEgg = timersEpochRef.current
        const visibleFor = Math.max(8000, computeVisibleMs(next))
        hideDueAtRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + visibleFor
        hideTimerRef.current = window.setTimeout(() => {
          if (myEpochEgg !== timersEpochRef.current) return
          setShowBubble(false)
          setBubbleTheme('normal')
          if (typeof scheduleNextRef.current === 'function') scheduleNextRef.current()
        }, visibleFor)
      } else if (showBubble && bubbleText && bubbleIdxRef.current != null) {
        const fresh = t && typeof t === 'function' ? t('portrait.phrases') : null
        const arr = (Array.isArray(fresh) && fresh.length) ? fresh : (phrasesRef.current || phrases)
        const idx = bubbleIdxRef.current
        const next = arr[idx] || arr[0] || ''
        setBubbleText(next)
        // Reiniciar sólo el tiempo visible de la viñeta actual (normal)
        bumpEpoch()
        const myEpoch = timersEpochRef.current
        const visibleFor = Math.max(8000, computeVisibleMs(next))
        hideDueAtRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + visibleFor
        hideTimerRef.current = window.setTimeout(() => {
          if (myEpoch !== timersEpochRef.current) return
          setShowBubble(false)
          setBubbleTheme('normal')
          if (typeof scheduleNextRef.current === 'function') scheduleNextRef.current()
        }, visibleFor)
      } else if (!showBubble) {
        // No hay viñeta visible; mantener timers y dejar que la siguiente aparezca en el nuevo idioma
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const [showBubble, setShowBubble] = useState(false)
  const [bubbleText, setBubbleText] = useState('')
  const bubbleRef = useRef(null)
  const [bubblePos, setBubblePos] = useState({ top: -9999, left: -9999 })
  const [bubbleSide, setBubbleSide] = useState('right')
  const [tail, setTail] = useState({ x: 0, y: 0, cx: 0, cy: 0, angleDeg: 0 })
  const [posReady, setPosReady] = useState(false)
  const [bubbleTheme, setBubbleTheme] = useState('normal')
  const showTimerRef = useRef(null)
  const hideTimerRef = useRef(null)
  const scheduleNextRef = useRef(() => {})
  const phrasesRef = useRef([])
  const eggPhrasesRef = useRef([])
  const bubbleIdxRef = useRef(null)
  const eggIdxRef = useRef(null)
  const schedulerPausedRef = useRef(false)
  // Timing config (más responsivo)
  const TYPING_CPS = 14
  const BUBBLE_FIRST_DELAY_MS = 150
  const BUBBLE_DELAY_MIN_MS = 1800
  const BUBBLE_DELAY_RAND_MS = 2200
  const BUBBLE_VISIBLE_MIN_MS = 5000
  const BUBBLE_VISIBLE_RAND_MS = 2000
  const firstShownRef = useRef(false)
  const hideDueAtRef = useRef(0)
  const timersEpochRef = useRef(0)
  const USE_RAF_SCHED = true
  const rafIdRef = useRef(null)
  const nextAtRef = useRef(0)

  function computeVisibleMs(txt) {
    try {
      const text = String(txt || '')
      const len = text.length
      const typingMs = Math.ceil((len / Math.max(1, TYPING_CPS)) * 1000)
      const readingMs = 1500 + len * 35
      const total = typingMs + readingMs
      return Math.max(6500, Math.min(18000, total))
    } catch { return 6000 }
  }

  function bumpEpoch() {
    try {
      timersEpochRef.current += 1
      if (showTimerRef.current) { window.clearTimeout(showTimerRef.current); showTimerRef.current = null }
      if (hideTimerRef.current) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
    } catch {}
  }

  function bumpEpoch() {
    try {
      timersEpochRef.current += 1
      if (showTimerRef.current) { window.clearTimeout(showTimerRef.current); showTimerRef.current = null }
      if (hideTimerRef.current) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
    } catch {}
  }

  useEffect(() => { phrasesRef.current = phrases }, [phrases])
  useEffect(() => { eggPhrasesRef.current = eggPhrases }, [eggPhrases])

  useEffect(() => {
    if (!bubblesEnabled) return
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
    function scheduleNext() {
      const delay = firstShownRef.current
        ? (BUBBLE_DELAY_MIN_MS + Math.random() * BUBBLE_DELAY_RAND_MS)
        : BUBBLE_FIRST_DELAY_MS
      const scheduleAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + delay
      nextAtRef.current = scheduleAt
      const myEpochPlan = timersEpochRef.current
      const tick = () => {
        if (myEpochPlan !== timersEpochRef.current) { rafIdRef.current = null; return }
        if (eggActiveRef.current || schedulerPausedRef.current) { rafIdRef.current = null; return }
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
        if (now < nextAtRef.current - 4) { rafIdRef.current = requestAnimationFrame(tick); return }
        // disparar
        const arr = phrasesRef.current || []
        const idx = Math.floor(Math.random() * Math.max(1, arr.length))
        bubbleIdxRef.current = idx
        const next = arr[idx] || arr[0] || ''
        setBubbleText(next)
        setShowBubble(true)
        setPosReady(false)
        requestAnimationFrame(() => {
          const contEl = containerRef.current
          const bubbleEl = bubbleRef.current
          if (!contEl || !bubbleEl) return
          const c = contEl.getBoundingClientRect()
          const b = bubbleEl.getBoundingClientRect()
          const pad = 12
          // Mover la viñeta más a la derecha (fuera del contenedor) para no empalmar con el retrato
          const extraRight = 24
          let placedLeft = clamp(c.width + extraRight, 8, Math.max(8, window.innerWidth - b.width - 8))
          let placedTop = clamp(c.height * 0.18, 8, Math.max(8, c.height - b.height - 8))
          setBubbleSide('right')
          try {
            const JOY_RADIUS = 52
            const JOY_BOTTOM = 40
            const pad = 16
            const cx = window.innerWidth / 2
            const cy = window.innerHeight - (JOY_BOTTOM + JOY_RADIUS)
            const joyRect = { left: cx - JOY_RADIUS - pad, right: cx + JOY_RADIUS + pad, top: cy - JOY_RADIUS - pad, bottom: cy + JOY_RADIUS + pad }
            const bubbleRect = { left: placedLeft, top: placedTop, right: placedLeft + b.width, bottom: placedTop + b.height }
            const intersects = !(bubbleRect.right < joyRect.left || bubbleRect.left > joyRect.right || bubbleRect.bottom < joyRect.top || bubbleRect.top > joyRect.bottom)
            if (intersects) {
              if (fitsTop) { setBubbleSide('top'); placedTop = topTop; placedLeft = topLeft }
              else { placedTop = Math.max(8, joyRect.top - b.height - 8); placedLeft = clamp(placedLeft, 8, window.innerWidth - b.width - 8) }
            }
          } catch {}
          setBubblePos({ top: placedTop, left: placedLeft })
          const bCenterX = placedLeft + b.width / 2
          const bCenterY = placedTop + b.height / 2
          const targetX = c.width * 0.1
          const targetY = c.height * 0.35
          const ang = Math.atan2(targetY - bCenterY, targetX - bCenterX)
          const padEdge = 10
          const rx = Math.max(8, b.width / 2 - padEdge)
          const ry = Math.max(8, b.height / 2 - padEdge)
          const axLocal = b.width / 2 + Math.cos(ang) * rx
          const ayLocal = b.height / 2 + Math.sin(ang) * ry
          const pushOut = 12
          const cx2 = axLocal + Math.cos(ang) * pushOut
          const cy2 = ayLocal + Math.sin(ang) * pushOut
          setTail({ x: axLocal, y: ayLocal, cx: cx2, cy: cy2, angleDeg: (ang * 180) / Math.PI })
          setPosReady(true)
        })
        firstShownRef.current = true
        const visibleFor = Math.max(8000, computeVisibleMs(next))
        hideDueAtRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + visibleFor
        const myHideEpoch = timersEpochRef.current
        hideTimerRef.current = window.setTimeout(() => {
          if (myHideEpoch !== timersEpochRef.current) return
          setShowBubble(false)
          setBubbleTheme('normal')
          scheduleNext()
        }, visibleFor)
        rafIdRef.current = null
      }
      rafIdRef.current = requestAnimationFrame(tick)
    }
    scheduleNextRef.current = scheduleNext
    scheduleNext()
    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      scheduleNextRef.current = () => {}
    }
  }, [bubblesEnabled])

  const handleCopy = async () => {
    const snippet = `{
  "intensity": ${lightIntensity},
  "angle": ${lightAngle},
  "penumbra": ${lightPenumbra},
  "posY": ${lightPosY},
  "posZ": ${lightPosZ},
  "color": "${lightColor}"
}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet)
      } else {
        const ta = document.createElement('textarea')
        ta.value = snippet
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch (e) {
      console.warn(t('errors.copyFailed'), e)
    }
  }
  // Compute dynamic container classes depending on mode
  const containerClass = mode === 'hero'
    ? 'relative mx-auto flex items-center justify-center pt-1 min-[961px]:pt-2 scale-[1.06] min-[961px]:scale-[1.12] min-[1200px]:scale-[1.18] transition-transform duration-300 w-[min(86vw,780px)] aspect-square'
    : 'fixed left-4 bottom-4 min-[961px]:left-10 min-[961px]:bottom-10 flex gap-3 items-end'
  const containerStyle = mode === 'hero' ? { zIndex: 10 } : { zIndex }
  const lockCamera = mode === 'hero'

  // If in hero mode and a portal target exists, render into that container via DOM move
  useEffect(() => {
    if (mode !== 'hero') return
    try {
      const target = document.querySelector(portalTargetSelector)
      const el = containerRef.current
      if (!target || !el) return
      target.appendChild(el)
    } catch {}
  }, [mode, portalTargetSelector])

  return (
    <div ref={containerRef} className={containerClass} style={containerStyle} data-portrait-root>
      {bubblesEnabled && showBubble && (
        <div
          ref={bubbleRef}
          className={`pointer-events-none absolute z-50 max-w-56 px-3 py-2.5 rounded-[18px] border-[3px] text-[15px] leading-snug shadow-[6px_6px_0_#000] rotate-[-1.5deg] ${bubbleTheme === 'egg' ? 'bg-black border-black text-white' : 'bg-white border-black text-black'}`}
          style={{ top: bubblePos.top, left: bubblePos.left }}
        >
          {/* Overlay halftone suave para estética cómic */}
          {bubbleTheme === 'normal' && (
            <div
              className="pointer-events-none absolute inset-0 opacity-10 mix-blend-multiply rounded-[16px]"
              style={{
                backgroundImage:
                  'radial-gradient(currentColor 1px, transparent 1px), radial-gradient(currentColor 1px, transparent 1px)',
                backgroundSize: '10px 10px, 10px 10px',
                backgroundPosition: '0 0, 5px 5px',
                color: '#111',
              }}
            />
          )}
          {/* Borde interior sutil */}
          <div className="absolute inset-0 rounded-[16px] border border-black/20 pointer-events-none" />
          {/* Texto */}
          <div className={bubbleTheme === 'egg' ? 'text-white' : 'text-black'} style={{ fontSize: '16px' }}>
            <TypingText text={bubbleText} />
          </div>

          {/* Sin cola: globo limpio para evitar desalineaciones */}
        </div>
      )}
      {/* Wrapper relativo para posicionar botón por fuera del retrato sin enmascararse */}
      {/* Mobile 20% más pequeño: 9rem→7.2rem, 13rem→10.4rem */}
      <div className="relative w-[7.2rem] h-[10.4rem] min-[961px]:w-[12rem] min-[961px]:h-[18rem]">
        {(typeof window !== 'undefined') && showExit && (
          <button
            type="button"
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            onClick={(e) => {
              try { playSfx('click', { volume: 1.0 }) } catch {}
              e.stopPropagation()
              try {
                if (exitMode === 'back') window.dispatchEvent(new CustomEvent('detail-close'))
                else window.dispatchEvent(new CustomEvent('exit-section'))
              } catch {}
            }}
            className="absolute -top-[56px] left-1/2 -translate-x-1/2 h-11 w-11 rounded-full bg-white text-black grid place-items-center shadow-md z-[5]"
            aria-label={exitMode === 'back' ? t('common.back') : t('portrait.closeSection')}
            title={exitMode === 'back' ? t('common.back') : t('portrait.closeSection')}
          >
            {exitMode === 'back' ? (
              <ArrowLeftIcon className="w-6 h-6" />
            ) : (
              <XMarkIcon className="w-6 h-6" />
            )}
          </button>
        )}
        <div
          ref={portraitRef}
          className={`pointer-events-auto cursor-pointer absolute inset-0 rounded-full overflow-hidden border-[5px] border-white shadow-lg transform-gpu will-change-transform transition-transform duration-200 ease-out ${lockCamera ? '' : 'hover:scale-105'} ${eggActive ? 'bg-red-600' : 'bg-[#06061D]'}`}
          onClick={handlePortraitClick}
          onMouseEnter={lockCamera ? undefined : handleMouseEnter}
          onMouseLeave={lockCamera ? undefined : handleMouseLeave}
          onMouseMove={lockCamera ? undefined : handleMouseMove}
          onMouseDown={lockCamera ? undefined : handleMouseDown}
          onMouseUp={lockCamera ? undefined : handleMouseUp}
          onWheel={lockCamera ? undefined : handleWheel}
          aria-label={t('a11y.characterPortrait')}
          title=""
          style={{ cursor: 'none' }}
        >
        <Canvas
          dpr={[1, isLowPerf ? 1.2 : 1.5]}
          orthographic
          camera={{ position: [0, camY, 10], zoom: camZoom, near: -100, far: 100 }}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false }}
        >
          {/* Sincronizar cámara ortográfica; en hero la fijamos estática */}
          <SyncOrthoCamera y={mode === 'hero' ? CAM_Y_MAX : camY} zoom={mode === 'hero' ? ZOOM_MAX : camZoom} />
          <ambientLight intensity={0.8} />
          <directionalLight intensity={0.7} position={[2, 3, 3]} />
          <CharacterModel modelRef={modelRef} glowVersion={glowVersion} />
          {mode !== 'hero' && (
          <CameraAim
            modelRef={modelRef}
            getPortraitCenter={() => {
              try {
                const el = portraitRef.current
                if (!el) return null
                const r = el.getBoundingClientRect()
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
              } catch { return null }
            }}
            getPortraitRect={() => {
              try {
                const el = portraitRef.current
                if (!el) return null
                return el.getBoundingClientRect()
              } catch { return null }
            }}
          />)}
          <HeadNudge modelRef={modelRef} version={headNudgeV} />
          {/* Mantener cámara ortográfica apuntando al frente */}
          <group position={[0, 0, 0]} />
          {/* Cámara libre: sin lookAt forzado; sin shake para precisión de encuadre */}
          <PinBackLight
            modelRef={modelRef}
            intensity={lightIntensity}
            angle={lightAngle}
            penumbra={lightPenumbra}
            posY={lightPosY}
            posZ={lightPosZ}
            color={lightColor}
          />
          {/* Composer de postproceso del retrato */}
          <EffectComposer multisampling={0} disableNormalPass>
            {dotEnabled && (
              <DotScreen
                blendFunction={{
                  normal: BlendFunction.NORMAL,
                  multiply: BlendFunction.MULTIPLY,
                  screen: BlendFunction.SCREEN,
                  overlay: BlendFunction.OVERLAY,
                  softlight: BlendFunction.SOFT_LIGHT,
                  add: BlendFunction.ADD,
                  darken: BlendFunction.DARKEN,
                  lighten: BlendFunction.LIGHTEN,
                }[(dotBlend || 'normal').toLowerCase()] || BlendFunction.NORMAL}
                angle={dotAngle}
                scale={dotScale}
                center={[dotCenterX, dotCenterY]}
                opacity={dotOpacity}
              />
            )}
            {eggActive && (
              <>
                <ChromaticAberration offset={[0.012, 0.009]} />
                <Glitch
                  delay={[0.02, 0.06]}
                  duration={[0.6, 1.4]}
                  strength={[1.0, 1.8]}
                  mode={GlitchMode.CONSTANT}
                  active
                  columns={0.006}
                />
              </>
            )}
          </EffectComposer>
        </Canvas>
        {/* Cursor personalizado tipo slap que sigue al mouse dentro del retrato */}
        <img
          src={`${import.meta.env.BASE_URL}slap.svg`}
          alt=""
          aria-hidden
          draggable="false"
          className="pointer-events-none select-none absolute"
          style={{
            left: `${cursorPos.x}px`,
            top: `${cursorPos.y}px`,
            width: '80px',
            height: '80px',
            transform: `translate(-50%, -50%) scale(${cursorScale})`,
            opacity: cursorVisible ? 1 : 0,
            transition: 'transform 90ms ease-out, opacity 120ms ease-out',
          }}
        />
        {/* Overlay de frase del easter egg (el texto ahora vive en la viñeta; retirado del retrato) */}
        </div>
      </div>
      {/* Barra de cooldown (a la derecha del retrato) */}
      {mode !== 'hero' && (
        (() => {
          const fill = Math.max(0, Math.min(1, 1 - actionCooldown))
          const glowOn = fill >= 0.98
          const glow = glowOn ? '0 0 12px 3px rgba(59,130,246,0.85), 0 0 30px 8px rgba(59,130,246,0.55)' : 'none'
          return (
            <div
              className="block self-center h-[110px] w-[12px] min-[961px]:h-[150px] min-[961px]:w-[15px] rounded-full bg-white/10 border border-white/20 overflow-hidden relative"
              aria-hidden
              style={{ boxShadow: glow, transition: 'box-shadow 180ms ease', willChange: 'box-shadow' }}
            >
              <div
                className="absolute left-0 right-0 bottom-0"
                style={{
                  backgroundColor: '#3b82f6',
                  height: `${Math.round(fill * 100)}%`,
                  transition: 'height 120ms linear',
                }}
              />
            </div>
          )
        })()
      )}
      {/* Controles de luz (interactivos) */}
      {showUI && (
        <div className="pointer-events-auto select-none p-2 rounded-md bg-black/50 text-white w-52 space-y-2">
          <div className="text-xs font-semibold opacity-90">{t('portrait.uiTitle')}</div>
          {/* Cámara */}
          <div className="text-[11px] font-medium opacity-80 mt-1">{t('portrait.labels.camera')}</div>
          <label className="block text-[11px] opacity-80">{t('portrait.labels.heightY')}: {camY.toFixed(2)}
            <input
              className="w-full"
              type="range"
              min={CAM_Y_MIN}
              max={CAM_Y_MAX}
              step="0.01"
              value={camY}
              onChange={(e) => setCamY(parseFloat(e.target.value))}
            />
          </label>
          <label className="block text-[11px] opacity-80">{t('portrait.labels.zoom')}: {Math.round(camZoom)}
            <input
              className="w-full"
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step="1"
              value={camZoom}
              onChange={(e) => setCamZoom(parseFloat(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
            onClick={async () => {
              const preset = JSON.stringify({ camY: parseFloat(camY.toFixed(2)), camZoom: Math.round(camZoom) }, null, 2)
              try { await navigator.clipboard.writeText(preset) } catch {
                const ta = document.createElement('textarea'); ta.value = preset; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
              }
            }}
          >{t('portrait.copyCameraPreset')}</button>
          <div className="h-px bg-white/10 my-1" />
          <div className="text-[11px] font-medium opacity-80">{t('portrait.labels.light')}</div>
          <label className="block text-[11px] opacity-80">{t('portrait.labels.intensity')}: {lightIntensity.toFixed(1)}
            <input
              className="w-full"
              type="range"
              min="0"
              max="20"
              step="0.1"
              value={lightIntensity}
              onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
            />
          </label>
          <label className="block text-[11px] opacity-80">{t('portrait.labels.angle')}: {lightAngle.toFixed(2)}
            <input
              className="w-full"
              type="range"
              min="0.1"
              max="1.0"
              step="0.01"
              value={lightAngle}
              onChange={(e) => setLightAngle(parseFloat(e.target.value))}
            />
          </label>
          <label className="block text-[11px] opacity-80">{t('portrait.labels.penumbra')}: {lightPenumbra.toFixed(2)}
            <input
              className="w-full"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={lightPenumbra}
              onChange={(e) => setLightPenumbra(parseFloat(e.target.value))}
            />
          </label>
          <div className="flex gap-2">
            <label className="flex-1 block text-[11px] opacity-80">{t('portrait.labels.heightY')}
              <input
                className="w-full"
                type="range"
                min="1.0"
                max="3.5"
                step="0.05"
                value={lightPosY}
                onChange={(e) => setLightPosY(parseFloat(e.target.value))}
              />
            </label>
            <label className="flex-1 block text-[11px] opacity-80">{t('portrait.labels.distZ')}
              <input
                className="w-full"
                type="range"
                min="-3.0"
                max="-0.2"
                step="0.02"
                value={lightPosZ}
                onChange={(e) => setLightPosZ(parseFloat(e.target.value))}
              />
            </label>
          </div>
          <div className="flex items-center justify-between text-[11px] opacity-80">
            <span>{t('portrait.labels.color')}</span>
            <input
              type="color"
              value={lightColor}
              onChange={(e) => setLightColor(e.target.value)}
              className="h-6 w-10 bg-transparent border-0 outline-none cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
          >
            {copied ? t('common.copied') : t('portrait.copyValues')}
          </button>
        </div>
      )}
    </div>
  )
}

// Preload del modelo
useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`)

function TypingText({ text }) {
  const [display, setDisplay] = useState('')
  const [dots, setDots] = useState(0)
  const idxRef = useRef(0)
  useEffect(() => {
    setDisplay('')
    idxRef.current = 0
    const speed = 14 // cps
    const t = setInterval(() => {
      idxRef.current += 1
      setDisplay(text.slice(0, idxRef.current))
      if (idxRef.current >= text.length) {
        clearInterval(t)
      }
    }, Math.max(10, 1000 / speed))
    return () => clearInterval(t)
  }, [text])
  // Burbujas animadas sutiles
  useEffect(() => {
    const anim = setInterval(() => setDots((d) => (d + 1) % 3), 800)
    return () => clearInterval(anim)
  }, [])
  return (
    <div className="relative font-marquee tracking-wide px-2 text-center uppercase text-[14px] min-[961px]:text-[15px]">
      {display}
      {display.length < text.length && (
        <span className="inline-block w-[0.9em] text-center animate-[bubbleDotPulse_1.4s_ease-in-out_infinite]">•</span>
      )}
    </div>
  )
}


