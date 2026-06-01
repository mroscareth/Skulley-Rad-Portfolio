import React, { useEffect, useMemo, useRef, useState } from 'react'
import { XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { extendGLTFLoaderKTX2, detectKTX2Support } from '../lib/ktx2Setup.js'
import { EffectComposer, Bloom, DotScreen, Glitch, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction, GlitchMode } from 'postprocessing'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import PowerBar from './PowerBar.jsx'
import { applyToonBanding } from '../lib/toonBanding.js'
import { applyCharacterColorsToScene, CHARACTER_COLOR_EVENT } from '../lib/characterColors.js'
import CharacterNormalPass from './fx/CharacterNormalPass.jsx'
import EdgeInkEffect from './fx/EdgeInkEffect.jsx'
import { portraitNormalTexture } from '../lib/toonInkBuffer.js'

function ContextLossGuard({ setOk }) {
  const { gl } = useThree()
  useEffect(() => {
    const el = gl?.domElement
    if (!el) return undefined
    // initial check: if already invalid, avoid mounting composer
    try { setOk(!!gl?.getContextAttributes?.()) } catch { try { setOk(false) } catch { } }
    const onLost = () => { try { setOk(false) } catch { } }
    const onRestored = () => { try { setOk(true) } catch { } }
    try {
      el.addEventListener('webglcontextlost', onLost)
      el.addEventListener('webglcontextrestored', onRestored)
    } catch { }
    return () => {
      try { el.removeEventListener('webglcontextlost', onLost) } catch { }
      try { el.removeEventListener('webglcontextrestored', onRestored) } catch { }
    }
  }, [gl, setOk])
  return null
}

function CharacterModel({ modelRef, glowVersion = 0, goldSkinActive = false }) {
  const { gl } = useThree()
  // Detect GPU compressed-texture support once per renderer
  useEffect(() => { detectKTX2Support(gl) }, [gl])

  // Always load base model (for animations)
  const baseGltf = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true, true, extendGLTFLoaderKTX2,
  )
  // Load gold model WITHOUT KTX2 (re-exported with standard JPEG textures)
  const goldGltf = useGLTF(`${import.meta.env.BASE_URL}skins/characterGold.glb`)

  const activeScene = goldSkinActive ? goldGltf.scene : baseGltf.scene
  const baseAnimations = baseGltf.animations
  // Deep clone to avoid sharing hierarchies/skin with the player
  // CRITICAL: Also remove any outline meshes that Player.jsx may have added to the cached GLB.
  // This must happen synchronously during clone, not in useEffect (which runs after render).
  const cloned = useMemo(() => {
    const clone = SkeletonUtils.clone(activeScene)

    // Remove outline meshes immediately after cloning (before first render)
    // Detect by multiple criteria: name suffix, material properties, or renderOrder
    try {
      const toRemove = []
      clone.traverse((obj) => {
        if (!obj) return

        // Method 1: Check name suffix
        const hasOutlineName = obj.name && obj.name.endsWith('_outline')

        // Method 2: Check material properties (outline uses BackSide + MeshBasicMaterial)
        let hasOutlineMaterial = false
        if (obj.material) {
          const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material
          hasOutlineMaterial = mat && mat.side === THREE.BackSide && mat.type === 'MeshBasicMaterial'
        }

        // Method 3: Check renderOrder (outlines use -1)
        const hasOutlineRenderOrder = obj.renderOrder === -1 && obj.isSkinnedMesh

        if (hasOutlineName || hasOutlineMaterial || hasOutlineRenderOrder) {
          toRemove.push(obj)
        }
      })

      toRemove.forEach((obj) => {
        try {
          if (obj.parent) obj.parent.remove(obj)
          // Dispose geometry and material (these are cloned, not shared)
          if (obj.geometry) obj.geometry.dispose()
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m?.dispose?.())
            else obj.material.dispose?.()
          }
        } catch { }
      })
    } catch { }

    return clone
  }, [activeScene])

  // Clone animation clips per scene swap to avoid stale PropertyBinding cache (T-pose)
  const animations = useMemo(
    () => baseAnimations.map((clip) => clip.clone()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseAnimations, activeScene],
  )

  // Isolate portrait materials so they don't share instances with the Player
  useEffect(() => {
    if (!cloned) return
    try {
      cloned.traverse((obj) => {
        if (obj && obj.isMesh && obj.material) {
          // Cel-shading toon (mismo banding que Player) para que el retrato
          // matchee el look del personaje. Ver DESIGN.md §7.8.
          const toonify = (mm) => {
            if (!mm || !mm.isMaterial) return mm
            // Pupilas full toon: negro plano sin brillo (igual que Player).
            if (mm.name && /pupil/i.test(mm.name)) {
              return new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })
            }
            mm.transparent = false
            mm.opacity = 1
            mm.depthWrite = true
            mm.userData = { ...(mm.userData || {}), __portraitMaterial: true }
            try {
              if ('metalness' in mm) {
                if ('envMapIntensity' in mm) mm.envMapIntensity = 0.5
                applyToonBanding(mm, { steps: 2, minBand: 0.04, bandIndirect: true })
              }
            } catch { }
            return mm
          }
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map((m) => toonify(m?.isMaterial ? m.clone() : m))
          } else if (obj.material.isMaterial) {
            obj.material = toonify(obj.material.clone())
          }
        }
      })
    } catch { }

    // Boost metalness on gold model (same values as Player.jsx)
    if (goldSkinActive) {
      try {
        const _hsl = { h: 0, s: 0, l: 0 }
        cloned.traverse((obj) => {
          if (!obj || (!obj.isMesh && !obj.isSkinnedMesh) || !obj.material) return
          if (obj.name === 'Egg_EnergyBall') return
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          mats.forEach((m) => {
            if (!m || !m.isMaterial) return
            // Skip pink/magenta materials (hair)
            if (m.color) {
              m.color.getHSL(_hsl)
              const hDeg = _hsl.h * 360
              if (hDeg >= 270 && hDeg <= 350) return
            }
            if ('metalness' in m) m.metalness = Math.max(m.metalness, 0.4)
            if ('roughness' in m) m.roughness = Math.min(m.roughness, 0.65)
            if ('envMapIntensity' in m) m.envMapIntensity = 1.8
            m.needsUpdate = true
          })
        })
      } catch { }
    }
  }, [cloned, goldSkinActive])

  // Personalización de color del personaje — mismo slot que la escena principal.
  // No se toca la skin dorada.
  useEffect(() => {
    if (!cloned || goldSkinActive) return
    const apply = (detail) => { try { applyCharacterColorsToScene(cloned, detail) } catch { } }
    apply()
    const onChange = (e) => apply(e?.detail)
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [cloned, goldSkinActive])

  const { actions } = useAnimations(animations, cloned)
  const matUniformsRef = useRef(new Map())
  const glowColorRef = useRef(new THREE.Color('#ffd480'))
  const glowAmountRef = useRef(0)
  const PERMA_GLOW = true
  // Additive fragment glow: if too high, burns materials (appears white) with some GLBs.
  const GLOW_ADD_MULT = 0.35
  const prevGlowVRef = useRef(glowVersion)

  // Select explicit idle clip if available; otherwise use heuristic
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
    try {
      cloned.traverse((obj) => {
        if (!obj || !obj.isMesh || !obj.material) return
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach((mm) => {
          if (!mm || !mm.isMaterial) return
          const original = mm.onBeforeCompile
          mm.onBeforeCompile = (shader) => {
            try {
              shader.uniforms.uGlow = { value: 0 }
              shader.uniforms.uGlowColor = { value: new THREE.Color('#ffe9b0') }
              const target = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );'
              const repl = `
                vec3 _outGlow = outgoingLight + uGlowColor * (uGlow * ${GLOW_ADD_MULT.toFixed(3)});
                gl_FragColor = vec4(_outGlow, diffuseColor.a );
              `
              if (shader.fragmentShader.includes(target)) {
                shader.fragmentShader = shader.fragmentShader.replace(target, repl)
              }
              matUniformsRef.current.set(mm, shader.uniforms)
            } catch { }
            if (typeof original === 'function') try { original(shader) } catch { }
          }
          mm.needsUpdate = true
        })
      })
    } catch { }
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
  })

  // Position model so the head is visible inside the capsule
  return (
    <group position={[0, -1.45, 0]}>
      <primitive ref={modelRef} object={cloned} scale={1.65} />
    </group>
  )
}

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
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 }
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

function SyncOrthoCamera({ y, zoom }) {
  const { camera } = useThree()
  useFrame(() => {
    if (!camera) return
    // Fix a stable ortho camera pose to avoid drift between reloads
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
      // restore camera on unmount
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
    // Place target at head and aim the spotlight
    targetRef.current.position.copy(target)
    lightRef.current.target = targetRef.current
    lightRef.current.target.updateMatrixWorld()
  })

  return (
    <>
      {/* Spot light behind the model for rim light */}
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
  // elastic damper that returns to neutral after the hit
  React.useEffect(() => {
    if (!modelRef.current) return
    // locate head by name or heuristic
    let head = null
    modelRef.current.traverse((o) => { if (!head && o.name && /head/i.test(o.name)) head = o })
    if (!head) return
    // IMPORTANT: always return to portrait base pose (not momentary state)
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
    // Faster adjustments with higher damping to shorten duration
    const stiffness = 28
    const damping = 1.8
    let last = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    let anim = true
    const loop = () => {
      if (!anim) return
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // spring toward base
      vx += (-(x - baseX) * stiffness - vx * damping) * dt
      vy += (-(y - baseY) * stiffness - vy * damping) * dt
      vz += (-(z - baseZ) * stiffness - vz * damping) * dt
      x += vx * dt
      y += vy * dt
      z += vz * dt
      head.rotation.x = x
      head.rotation.y = y
      head.rotation.z = z
      // More aggressive stop criterion; on finish, set exactly the base pose
      if (Math.abs(x - baseX) + Math.abs(y - baseY) + Math.abs(z - baseZ) < 0.004 && Math.abs(vx) + Math.abs(vy) + Math.abs(vz) < 0.006) {
        anim = false
        head.rotation.x = baseX
        head.rotation.y = baseY
        head.rotation.z = baseZ
        // Force tracker recenter to prevent residue after click spam
        try { window.dispatchEvent(new CustomEvent('portrait-recenter')) } catch { }
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
  // Optional override: force compact layout (small portrait) from App
  forceCompact,
  // Hero mode: re-parent UI into a target container and change layout/scale
  mode = 'overlay', // 'overlay' | 'hero'
  portalTargetSelector = '#about-hero-anchor',
  actionCooldown = 0,
  eggEnabled = true,
  eggClicksRequired = 5,
  // Extra CSS class for enter/exit animations
  className = '',
  // Pause rendering when hidden (performance optimization)
  paused = false,
  // Optional: show gold skin in portrait
  goldSkinActive = false,
}) {
  const { lang, t } = useLanguage()
  const modelRef = useRef()
  const containerRef = useRef(null)
  const portraitRef = useRef(null)
  const [portraitCtxOk, setPortraitCtxOk] = useState(true)
  // Camera limits: user-defined maximums
  const CAM_Y_MAX = 0.8
  const CAM_Y_MIN = -1.0
  const ZOOM_MAX = 160
  const ZOOM_MIN = 15
  const clickShakeUntilRef = useRef(0)
  // Compact UI breakpoint (aligned with App: ≤1100px)
  const COMPACT_UI_BP_PX = 1100
  const COMPACT_ZOOM_OUT_MULT = 0.7
  // Local mobile/low-perf profile detection to optimize the portrait
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
  // Light controls (user-adjustable)
  const [lightIntensity, setLightIntensity] = useState(20)
  const [lightAngle, setLightAngle] = useState(1)
  const [lightPenumbra, setLightPenumbra] = useState(0.28)
  const [lightPosY, setLightPosY] = useState(2.7)
  const [lightPosZ, setLightPosZ] = useState(-0.2)
  const [lightColor, setLightColor] = useState('#ffffff')
  const [copied, setCopied] = useState(false)
  // Exit button ya no vive en este componente — se movió a App.jsx para
  // integrarse con el marquee-push wrapper del top-right-group. El event
  // 'portrait-exit-mode' lo escucha App.jsx ahora.

  // Custom cursor (slap.svg) inside the portrait
  const [cursorVisible, setCursorVisible] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [cursorScale, setCursorScale] = useState(1)
  // Free vertical camera (no forced lookAt) and distortion-free zoom
  const [camY, setCamY] = useState(CAM_Y_MAX)
  const [camZoom, setCamZoom] = useState(ZOOM_MAX)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  useEffect(() => {
    // In hero mode, do not apply overlay viewport rules.
    if (mode === 'hero') { setIsCompactViewport(false); return }
    // If App forces compact mode, respect it without listening to viewport.
    if (typeof forceCompact === 'boolean') { setIsCompactViewport(forceCompact); return }
    try {
      const mql = window.matchMedia(`(max-width: ${COMPACT_UI_BP_PX}px)`)
      const update = () => {
        // Force compact on iPad/Tesla even if viewport is large (iPad Pro / Tesla browser)
        let ipadLike = false
        let tesla = false
        try {
          const ua = navigator.userAgent || ''
          const isIpadUa = /iPad/i.test(ua)
          const isIpadOs = (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
          ipadLike = Boolean(isIpadUa || isIpadOs)
          tesla = Boolean(/Tesla\/\S+/i.test(ua) || /QtCarBrowser/i.test(ua))
        } catch { }
        setIsCompactViewport(Boolean(mql.matches || ipadLike || tesla))
      }
      update()
      try { mql.addEventListener('change', update) } catch { window.addEventListener('resize', update) }
      return () => { try { mql.removeEventListener('change', update) } catch { window.removeEventListener('resize', update) } }
    } catch {
      setIsCompactViewport(false)
      return () => { }
    }
  }, [mode, forceCompact])
  const effectiveCamZoom = useMemo(() => {
    if (mode === 'hero') return ZOOM_MAX
    if (!isCompactViewport) return camZoom
    const next = camZoom * COMPACT_ZOOM_OUT_MULT
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next))
  }, [camZoom, isCompactViewport, mode])
  // On hero mode entry, fix stable camera and lock interactions
  useEffect(() => {
    if (mode !== 'hero') return
    setCamY(CAM_Y_MAX)
    setCamZoom(ZOOM_MAX)
    // Extra: recenter camera briefly after entry to avoid initial drift
    let t = 0
    const id = setInterval(() => {
      setCamY((v) => (t < 6 ? CAM_Y_MAX : v))
      setCamZoom((z) => (t < 6 ? ZOOM_MAX : z))
      t += 1
      if (t >= 6) clearInterval(id)
    }, 32)
    return () => clearInterval(id)
  }, [mode])
  const [headNudgeV, setHeadNudgeV] = useState(0)

  // Click audio (punch) with polyphony: instance pool
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
      try { a.load() } catch { }
      return a
    })
    clickAudioPoolRef.current = pool
    return () => {
      clickAudioPoolRef.current = []
    }
  }, [])

  // Web Audio: preload and decode audio for near-zero latency
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    audioCtxRef.current = ctx
    let cancelled = false
      ; (async () => {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}punch.mp3`, { cache: 'force-cache' })
          const arr = await res.arrayBuffer()
          const buf = await ctx.decodeAudioData(arr)
          if (!cancelled) audioBufferRef.current = buf
        } catch { }
      })()
    return () => {
      cancelled = true
      try { ctx.close() } catch { }
    }
  }, [])

  // Easter egg: multi-click on the portrait (i18n)
  const eggPhrases = useMemo(() => {
    try {
      const arr = t('portrait.eggPhrases')
      if (Array.isArray(arr) && arr.length) return arr
    } catch { }
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
  const eggTimerRef = useRef(null)
  const clickCountRef = useRef(0)
  const lastClickTsRef = useRef(0)

  async function handlePortraitClick() {
    // Portrait camera shake burst (~480ms)
    const nowTs = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    clickShakeUntilRef.current = nowTs + 480
    // Larger cursor animation with slight bounce on click
    setCursorScale(1.9)
    window.setTimeout(() => setCursorScale(0.96), 110)
    window.setTimeout(() => setCursorScale(1.08), 200)
    window.setTimeout(() => setCursorScale(1), 280)
    // Punch sound (Web Audio preferred for low latency)
    let played = false
    const ctx = audioCtxRef.current
    const buffer = audioBufferRef.current
    if (ctx && buffer) {
      try { if (ctx.state !== 'running') await ctx.resume() } catch { }
      try {
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = 0.9
        src.connect(gain).connect(ctx.destination)
        src.start(0)
        played = true
      } catch { }
    }
    // Fallback to HTMLAudio pool if Web Audio fails
    if (!played) {
      const pool = clickAudioPoolRef.current
      if (pool && pool.length) {
        const i = clickAudioIdxRef.current % pool.length
        clickAudioIdxRef.current += 1
        const a = pool[i]
        try { a.currentTime = 0 } catch { }
        try { a.play() } catch { }
      }
    }
    // Head nudge
    setHeadNudgeV((v) => v + 1)
    try { window.dispatchEvent(new CustomEvent('portrait-recenter')) } catch { }
    const now = Date.now()
    const delta = now - lastClickTsRef.current
    // More permissive window for fast clicks (mouse/trackpad/touch)
    if (delta > 1200) {
      clickCountRef.current = 0
    }
    lastClickTsRef.current = now
    clickCountRef.current += 1
    // Easter-egg: when activated, ONLY triggers the 3D speech bubble (portrait speech bubble is deprecated)
    const clicksNeeded = Math.max(4, Math.round(Number(eggClicksRequired) || 4))
    if (eggEnabled && clickCountRef.current >= clicksNeeded && !eggActive) {
      const idx = Math.floor(Math.random() * Math.max(1, eggPhrases.length))
      setEggActive(true)
      // Easter egg controlled via `eggActive` (no character disassembly).
      if (typeof onEggActiveChange === 'function') onEggActiveChange(true)
      // Fire easter egg phrase to 3D speech bubble (if present)
      try {
        window.dispatchEvent(new CustomEvent('speech-bubble-override', { detail: { phrasesKey: 'portrait.eggPhrases', idx, durationMs: 7000 } }))
      } catch { }
      clickCountRef.current = 0
      if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current)
      const EGG_MS = 7000
      eggTimerRef.current = window.setTimeout(() => {
        setEggActive(false)
        if (typeof onEggActiveChange === 'function') onEggActiveChange(false)
      }, EGG_MS)
    }
  }

  function handleMouseEnter() {
    setCursorVisible(true)
    const ctx = audioCtxRef.current
    if (ctx && ctx.state !== 'running') {
      // Try resuming on first user gesture to eliminate first-click latency
      ctx.resume().catch(() => { })
    }
  }
  function handleMouseLeave() { setCursorVisible(false) }
  function handleMouseMove(e) {
    const el = portraitRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCursorPos({ x: e.clientX - r.left, y: e.clientY - r.top })
  }
  // Nota: el drag vertical para mover camY y el wheel para zoom se quitaron
  // porque sacaban al personaje del encuadre. El encuadre ahora es fijo.

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
  // Compute dynamic container classes depending on mode (iPad/Tesla should force compact layout)
  const containerClass = mode === 'hero'
    ? 'relative mx-auto flex items-center justify-center pt-1 min-[1101px]:pt-2 scale-[1.06] min-[1101px]:scale-[1.12] min-[1200px]:scale-[1.18] transition-transform duration-300 w-[min(86vw,780px)] aspect-square'
    : `fixed ${isCompactViewport ? 'left-4 bottom-4' : 'left-10 bottom-10'} flex gap-3 items-end`
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
    } catch { }
  }, [mode, portalTargetSelector])

  return (
    <div ref={containerRef} className={`${containerClass} ${className}`} style={containerStyle} data-portrait-root>
      {/* Relative wrapper to position button outside portrait without masking */}
      {/* Mobile 20% smaller: 9rem→7.2rem, 13rem→10.4rem */}
      <div className={`relative ${isCompactViewport ? 'w-[7.2rem] h-[10.4rem]' : 'w-[12rem] h-[18rem]'}`}>
        <div
          ref={portraitRef}
          className={`pointer-events-auto cursor-pointer absolute inset-0 rounded-full overflow-hidden border-[3px] border-white/[0.12] shadow-[0_4px_20px_rgba(0,0,0,0.4)] transform-gpu will-change-transform transition-transform duration-200 ease-out ${lockCamera ? '' : 'hover:scale-105'} ${eggActive ? 'bg-red-600' : 'bg-[#06061D]'}`}
          onClick={handlePortraitClick}
          onMouseEnter={lockCamera ? undefined : handleMouseEnter}
          onMouseLeave={lockCamera ? undefined : handleMouseLeave}
          onMouseMove={lockCamera ? undefined : handleMouseMove}
          aria-label={t('a11y.characterPortrait')}
          title=""
          style={{ cursor: 'none' }}
        >
          <Canvas
            // Reduce VRAM pressure without losing postFX: lower DPR and use composer at lower resolution.
            dpr={[1, isLowPerf ? 1.1 : 1.25]}
            orthographic
            camera={{ position: [0, camY, 10], zoom: effectiveCamZoom, near: -100, far: 100 }}
            // Pause rendering when hidden to save GPU resources
            frameloop={paused ? 'never' : 'always'}
            gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false, preserveDrawingBuffer: false }}
            onCreated={({ gl }) => {
              // Robust fallback: prevent getContextAttributes() === null (alpha null in postprocessing)
              try {
                // Avoid warning if WEBGL_lose_context doesn't exist
                try {
                  const ctx = gl?.getContext?.()
                  const ext = ctx?.getExtension?.('WEBGL_lose_context')
                  if (!ext) {
                    // @ts-ignore
                    gl.forceContextLoss = () => { }
                    // @ts-ignore
                    gl.forceContextRestore = () => { }
                  }
                } catch { }
                const orig = gl.getContextAttributes?.bind(gl)
                const cached = (typeof orig === 'function') ? orig() : null
                const safe = cached || {
                  alpha: true,
                  antialias: false,
                  depth: true,
                  stencil: false,
                  premultipliedAlpha: true,
                  preserveDrawingBuffer: false,
                  powerPreference: 'high-performance',
                  failIfMajorPerformanceCaveat: false,
                  desynchronized: false,
                }
                if (typeof orig === 'function') {
                  // @ts-ignore
                  gl.__cachedContextAttributes = safe
                  // @ts-ignore
                  gl.getContextAttributes = () => {
                    try {
                      const cur = orig()
                      return cur || safe
                    } catch {
                      return safe
                    }
                  }
                }
              } catch { }
            }}
          >
            <ContextLossGuard setOk={setPortraitCtxOk} />
            {/* Sync ortho camera; in hero mode we fix it static */}
            <SyncOrthoCamera y={mode === 'hero' ? CAM_Y_MAX : camY} zoom={mode === 'hero' ? ZOOM_MAX : effectiveCamZoom} />
            {/* Ambient bajo + key direccional fuerte → el banding toon muestra
                el corte luz/sombra (igual que la escena principal). */}
            <ambientLight intensity={0.45} />
            <directionalLight intensity={1.5} position={[2, 4, 3]} />
            <CharacterModel modelRef={modelRef} glowVersion={glowVersion} goldSkinActive={goldSkinActive} />
            {/* Normal-render exclusivo del personaje del retrato → EdgeInk. */}
            <CharacterNormalPass playerRef={modelRef} target={portraitNormalTexture} fixedScale />
            {mode !== 'hero' && (
              <CameraAim
                modelRef={modelRef}
                goldSkinActive={goldSkinActive}
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
            {/* Keep ortho camera facing forward */}
            <group position={[0, 0, 0]} />
            {/* Free camera: no forced lookAt; no shake for framing precision */}
            <PinBackLight
              modelRef={modelRef}
              intensity={lightIntensity}
              angle={lightAngle}
              penumbra={lightPenumbra}
              posY={lightPosY}
              posZ={lightPosZ}
              color={lightColor}
            />
            {/* Portrait post-processing composer */}
            {portraitCtxOk ? (
              <EffectComposer multisampling={0} resolutionScale={isLowPerf ? 0.62 : 0.8}>
                {/* Portrait bloom (needed after lowering glow intensity) */}
                <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.72} luminanceSmoothing={0.18} />
                {/* Toon ink lines de crease (mismo look que la escena principal). */}
                <EdgeInkEffect bufferRef={portraitNormalTexture} thickness={1.1} strength={0.9} threshold={0.3} soft={0.16} color={[0, 0, 0]} />
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
            ) : null}
          </Canvas>
          {/* Custom slap cursor that follows the mouse inside the portrait */}
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
          {/* Easter egg phrase overlay (text now lives in speech bubble; removed from portrait) */}
        </div>
      </div>
      {/* Cooldown bar (to the right of the portrait) */}
      {mode !== 'hero' && (
        (() => {
          if (isCompactViewport) return null
          const fill = Math.max(0, Math.min(1, 1 - actionCooldown))
          const glowOn = fill >= 0.98
          const keyDown = () => { try { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })) } catch { } }
          const keyUp = () => { try { window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })) } catch { } }
          return (
            <PowerBar
              orientation="vertical"
              fill={fill}
              glowOn={glowOn}
              pressScale={1.3}
              pressStroke
              pressStrokeWidth={5}
              onPressStart={keyDown}
              onPressEnd={keyUp}
              className="self-center"
            />
          )
        })()
      )}
      {/* Light controls (interactive) */}
      {showUI && (
        <div className="pointer-events-auto select-none p-2 rounded-md bg-black/50 backdrop-blur-md border border-white/[0.08] text-white w-52 space-y-2">
          <div className="text-xs font-semibold opacity-90">{t('portrait.uiTitle')}</div>
          {/* Camera */}
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

// Model preload (with KTX2 support)
useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`, true, true, extendGLTFLoaderKTX2)
