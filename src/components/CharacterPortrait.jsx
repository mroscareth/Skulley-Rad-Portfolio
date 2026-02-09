import React, { useEffect, useMemo, useRef, useState } from 'react'
import { XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { EffectComposer, Bloom, DotScreen, Glitch, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction, GlitchMode } from 'postprocessing'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import PowerBar from './PowerBar.jsx'

function ContextLossGuard({ setOk }) {
  const { gl } = useThree()
  useEffect(() => {
    const el = gl?.domElement
    if (!el) return undefined
    // initial check: if already invalid, avoid mounting composer
    try { setOk(!!gl?.getContextAttributes?.()) } catch { try { setOk(false) } catch {} }
    const onLost = () => { try { setOk(false) } catch {} }
    const onRestored = () => { try { setOk(true) } catch {} }
    try {
      el.addEventListener('webglcontextlost', onLost)
      el.addEventListener('webglcontextrestored', onRestored)
    } catch {}
    return () => {
      try { el.removeEventListener('webglcontextlost', onLost) } catch {}
      try { el.removeEventListener('webglcontextrestored', onRestored) } catch {}
    }
  }, [gl, setOk])
  return null
}

function CharacterModel({ modelRef, glowVersion = 0 }) {
  const { gl } = useThree()
  const threeBasisVersion = useMemo(() => {
    const r = Number.parseInt(THREE.REVISION, 10)
    return Number.isFinite(r) ? `0.${r}.0` : '0.182.0'
  }, [])
  const { scene, animations } = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true,
    true,
    (loader) => {
      try {
        const ktx2 = new KTX2Loader()
        // Keep transcoder version aligned with installed three version
        ktx2.setTranscoderPath(`https://unpkg.com/three@${threeBasisVersion}/examples/jsm/libs/basis/`)
        if (gl) {
          Promise.resolve(gl.init?.()).then(() => {
            try { ktx2.detectSupport(gl) } catch {}
          }).catch(() => {
            try { ktx2.detectSupport(gl) } catch {}
          })
        }
        // @ts-ignore optional API
        if (loader.setKTX2Loader) loader.setKTX2Loader(ktx2)
      } catch {}
    },
  )
  // Deep clone to avoid sharing hierarchies/skin with the player
  // CRITICAL: Also remove any outline meshes that Player.jsx may have added to the cached GLB.
  // This must happen synchronously during clone, not in useEffect (which runs after render).
  const cloned = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    
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
        } catch {}
      })
    } catch {}
    
    return clone
  }, [scene])
  
  // Isolate portrait materials so they don't share instances with the Player
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
  })

  // Position model so the head is visible inside the capsule
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
    } catch {}
    const onMove = (e) => { mouseRef.current = { x: e.clientX || 0, y: e.clientY || 0 }; lastInputTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) }
    const onTouch = (e) => { try { const t = e.touches?.[0]; if (t) { mouseRef.current = { x: t.clientX, y: t.clientY }; lastInputTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) } } catch {} }
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
  }, [modelRef])

  useFrame(() => {
    if (!modelRef.current) return
    const { target, size, box } = tmp.current
    if (headObjRef.current) {
      try {
        const head = headObjRef.current
        const headPos = new THREE.Vector3()
        head.getWorldPosition(headPos)
        // Raycast to camera-perpendicular plane through the head
        const viewportW = (typeof window !== 'undefined' ? window.innerWidth : 1920)
        const viewportH = (typeof window !== 'undefined' ? window.innerHeight : 1080)
        const nx = (mouseRef.current.x / viewportW) * 2 - 1
        const ny = 1 - (mouseRef.current.y / viewportH) * 2
        camDirRef.current.set(0, 0, -1)
        camera.getWorldDirection(camDirRef.current)
        // Mix head forward with -camDir for robustness if forward is not exact
        const headForward = new THREE.Vector3(0, 0, -1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()))
        const mixedNormal = headForward.clone().lerp(camDirRef.current.clone().negate(), 0.35).normalize()
        planeRef.current.setFromNormalAndCoplanarPoint(mixedNormal, headPos)
        rayRef.current.setFromCamera({ x: nx, y: ny }, camera)
        const hit = rayRef.current.ray.intersectPlane(planeRef.current, pWorldRef.current)

        // Convert hit to parent local space for relative yaw/pitch
        const parent = head.parent || modelRef.current
        invParentRef.current.copy(parent.matrixWorld).invert()
        localHeadRef.current.copy(headPos).applyMatrix4(invParentRef.current)
        if (hit) localHitRef.current.copy(hit).applyMatrix4(invParentRef.current)
        else localHitRef.current.copy(localHeadRef.current).add(new THREE.Vector3(0, 0, -1))
        const dir = localHitRef.current.clone().sub(localHeadRef.current)
        // Yaw: right positive; in local space forward is usually -Z
        const yawRaw = Math.atan2(dir.x, -dir.z)
        // Pitch: up positive
        const pitchRaw = Math.atan2(dir.y, Math.hypot(dir.x, dir.z))
        // Calculate NDC deltas for stable cross-attenuation
        headScreenRef.current.copy(headPos).project(camera)
        const dxScr = nx - headScreenRef.current.x
        const dyScr = ny - headScreenRef.current.y
        const ax = Math.tanh(dxScr * 1.0)
        const ay = Math.tanh(dyScr * 1.0)
        // Base clamps and non-linear scales: reduce yaw when cursor is very high/low
        const maxYaw = 0.75
        const maxPitch = 0.6
        const yawScale = 1 - 0.45 * Math.pow(Math.min(1, Math.abs(ay)), 1.15)
        const pitchScale = 1 - 0.20 * Math.pow(Math.min(1, Math.abs(ax)), 1.10)
        let yawTarget = THREE.MathUtils.clamp(yawRaw * 0.85 * yawScale + yawBiasRef.current, -maxYaw, maxYaw)
        let pitchTarget = THREE.MathUtils.clamp(pitchRaw * 0.70 * pitchScale + pitchBiasRef.current, -maxPitch, maxPitch)
        // Capture rig base rotation once to remove intrinsic offset
        if (baseRotRef.current.x === null || baseRotRef.current.y === null) {
          const b = head?.userData?.__portraitBaseRot
          baseRotRef.current = b ? { x: b.x, y: b.y } : { x: head.rotation.x, y: head.rotation.y }
        }
        // Attenuate by portrait proximity: near portrait => less amplitude and more delay
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
              // Influence radius: proportional to portrait height (~18rem ≈ 288px)
              const radius = Math.min(vw, vh) * 0.30 // wider threshold (~30% of screen)
              proximity = Math.max(0, Math.min(1, 1 - dist / Math.max(60, radius)))
              // Player center proximity heuristic: elliptical zone in lower third
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
              const m = 18 // margin to ease activation
              const x = mouseRef.current.x
              const y = mouseRef.current.y
              insideRect = (x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m)
            }
          }
        } catch {}
        // Combined attenuation: portrait + hero (player) on screen
        const proxCombined = Math.max(proximity, heroProx)
        const ampScale = 1 - 0.65 * proxCombined
        yawTarget *= ampScale
        pitchTarget *= ampScale
        // Dead zone near portrait: disables tracking and returns to neutral
        let inner = Math.max(0, Math.min(1, (proxCombined - 0.6) / 0.4))
        if (insideRect) inner = 1
        const innerEase = inner * inner * (3 - 2 * inner) // smoothstep
        yawTarget *= (1 - innerEase)
        pitchTarget *= (1 - innerEase)
        // Smoothing: even slower inside the dead zone
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
    // We don't alter the camera; just rotate the head to follow the cursor
  })
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
      if (Math.abs(x - baseX) + Math.abs(y - baseY) + Math.abs(z - baseZ) < 0.004 && Math.abs(vx)+Math.abs(vy)+Math.abs(vz) < 0.006) {
        anim = false
        head.rotation.x = baseX
        head.rotation.y = baseY
        head.rotation.z = baseZ
        // Force tracker recenter to prevent residue after click spam
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
  // Exit button mode override: 'close' (default) or 'back' (used by project detail)
  const [exitMode, setExitMode] = useState('close')
  useEffect(() => {
    const onMode = (e) => {
      try { if (e && e.detail && (e.detail.mode === 'back' || e.detail.mode === 'close')) setExitMode(e.detail.mode) } catch {}
    }
    window.addEventListener('portrait-exit-mode', onMode)
    return () => window.removeEventListener('portrait-exit-mode', onMode)
  }, [])

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
        } catch {}
        setIsCompactViewport(Boolean(mql.matches || ipadLike || tesla))
      }
      update()
      try { mql.addEventListener('change', update) } catch { window.addEventListener('resize', update) }
      return () => { try { mql.removeEventListener('change', update) } catch { window.removeEventListener('resize', update) } }
    } catch {
      setIsCompactViewport(false)
      return () => {}
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
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ y: 0, camY: CAM_Y_MAX })
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
      try { a.load() } catch {}
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

  // Easter egg: multi-click on the portrait (i18n)
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
    // Fallback to HTMLAudio pool if Web Audio fails
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
    // Head nudge
    setHeadNudgeV((v) => v + 1)
    try { window.dispatchEvent(new CustomEvent('portrait-recenter')) } catch {}
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
      } catch {}
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
    } catch {}
  }, [mode, portalTargetSelector])

  return (
    <div ref={containerRef} className={`${containerClass} ${className}`} style={containerStyle} data-portrait-root>
      {/* Relative wrapper to position button outside portrait without masking */}
      {/* Mobile 20% smaller: 9rem→7.2rem, 13rem→10.4rem */}
      <div className={`relative ${isCompactViewport ? 'w-[7.2rem] h-[10.4rem]' : 'w-[12rem] h-[18rem]'}`}>
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
                  gl.forceContextLoss = () => {}
                  // @ts-ignore
                  gl.forceContextRestore = () => {}
                }
              } catch {}
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
            } catch {}
          }}
        >
          <ContextLossGuard setOk={setPortraitCtxOk} />
          {/* Sync ortho camera; in hero mode we fix it static */}
          <SyncOrthoCamera y={mode === 'hero' ? CAM_Y_MAX : camY} zoom={mode === 'hero' ? ZOOM_MAX : effectiveCamZoom} />
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
          <EffectComposer multisampling={0} disableNormalPass resolutionScale={isLowPerf ? 0.62 : 0.8}>
            {/* Portrait bloom (needed after lowering glow intensity) */}
            <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.72} luminanceSmoothing={0.18} />
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
          const keyDown = () => { try { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })) } catch {} }
          const keyUp = () => { try { window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })) } catch {} }
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
        <div className="pointer-events-auto select-none p-2 rounded-md bg-black/50 text-white w-52 space-y-2">
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

// Model preload
useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`)
