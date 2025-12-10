import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import * as THREE from 'three'
import useKeyboard from './useKeyboard.js'
import { playSfx, preloadSfx } from '../lib/sfx.js'

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
export default function Player({ playerRef, portals = [], onPortalEnter, onProximityChange, onPortalsProximityChange, onNearPortalChange, navigateToPortalId = null, onReachedPortal, onOrbStateChange, onHomeSplash, onHomeFallStart, onCharacterReady, sceneColor, onMoveStateChange, onPulse, onActionCooldown }) {
  // Load the GLB character; preloading ensures the asset is cached when
  // imported elsewhere.  The model contains two animations: idle and walk.
  const { gl } = useThree()
  const { scene, animations } = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true,
    true,
    (loader) => {
      try {
        const ktx2 = new KTX2Loader()
        ktx2.setTranscoderPath('https://unpkg.com/three@0.179.1/examples/jsm/libs/basis/')
        if (gl) ktx2.detectSupport(gl)
        // @ts-ignore optional API
        if (loader.setKTX2Loader) loader.setKTX2Loader(ktx2)
      } catch {}
    },
  )
  const { actions, mixer } = useAnimations(animations, scene)
  const walkDurationRef = useRef(1)
  const idleDurationRef = useRef(1)
  const { camera } = useThree()
  // Orb navigation state (transform into luminous sphere and move to target portal)
  const orbActiveRef = useRef(false)
  const [orbActive, setOrbActive] = useState(false)
  const [showChargeFx, setShowChargeFx] = useState(false)
  const orbTargetPosRef = useRef(new THREE.Vector3())
  const orbTrailRef = useRef([]) // array of THREE.Vector3 (legacy, may use for direction)
  const lastPosRef = useRef(new THREE.Vector3())
  const sparksRef = useRef([]) // [{pos:Vector3, vel:Vector3, life:number}]
  const explosionBoostRef = useRef(0)
  const explosionQueueRef = useRef({ sphere: 0, ring: 0, splash: 0, pos: new THREE.Vector3() })
  const MAX_SPARKS = 1800
  // Smoothed delta time to avoid visible oscillations in interpolation/blending
  const dtSmoothRef = useRef(1 / 60)
  // Raw movement delta to preserve real-time distance even under FPS drops
  const dtMoveRef = useRef(1 / 60)
  // Floor glitter effect will be rendered as a separate instanced mesh
  const ORB_SPEED = 22
  const PORTAL_STOP_DIST = 0.9
  const ORB_HEIGHT = 1.0 // altura visual del orbe sobre el origen del jugador
  const ORB_RADIUS = 0.6 // debe coincidir con la esfera del orbe (ver sphereGeometry args)
  const FALL_STOP_Y = ORB_RADIUS - ORB_HEIGHT // detener caída cuando la esfera toque el piso
  const HOME_FALL_HEIGHT = 22 // altura inicial al volver a HOME (caída moderada)
  const WOBBLE_BASE = 1.5
  const WOBBLE_FREQ1 = 2.1
  const WOBBLE_FREQ2 = 1.7
  const ARRIVAL_NEAR_DIST = 1.4
  const ENABLE_FOOT_SFX = false
  const orbOriginOffsetRef = useRef(new THREE.Vector3(0, 0.8, 0))
  const orbMatRef = useRef(null)
  const orbLightRef = useRef(null)
  const orbBaseColorRef = useRef(new THREE.Color('#aee2ff'))
  const orbTargetColorRef = useRef(new THREE.Color('#9ec6ff'))
  const orbStartDistRef = useRef(1)
  const fallFromAboveRef = useRef(false)
  const fallStartTimeRef = useRef(0)
  const orbStartTimeRef = useRef(0)
  const wobblePhaseRef = useRef(Math.random() * Math.PI * 2)
  const wobblePhase2Ref = useRef(Math.random() * Math.PI * 2)
  const nearTimerRef = useRef(0)
  const lastDistRef = useRef(Infinity)
  const hasExplodedRef = useRef(false)
  // Detección de pasos basada en tiempo de la animación de caminar
  const prevWalkNormRef = useRef(0)
  const nextIsRightRef = useRef(true)
  const footCooldownSRef = useRef(0)
  // Estado de movimiento (input) para exponer hacia fuera
  const hadInputPrevRef = useRef(false)

  // Preload básicos de sfx una vez
  useEffect(() => {
    preloadSfx(['magiaInicia', 'sparkleBom', 'sparkleFall', 'stepone', 'steptwo'])
  }, [])

  // Simple crossfade: fadeOut when starting orb, fadeIn when finishing
  const fadeOutTRef = useRef(0)
  const fadeInTRef = useRef(0)
  const showOrbRef = useRef(false)
  const FADE_OUT = 0.06
  const FADE_IN = 0.06
  const applyModelOpacity = (opacity) => {
    try {
      scene.traverse((obj) => {
        // @ts-ignore
        if (obj.material) {
          const m = obj.material
          if (Array.isArray(m)) {
            m.forEach((mm) => {
              mm.transparent = opacity < 1
              mm.opacity = opacity
              // evitar recortes/artefactos al hacer fade
              mm.depthWrite = opacity >= 1
              // Emisivo permanente suave
              try {
                if (mm.emissive) {
                  mm.emissive = new THREE.Color('#ffd480')
                  mm.emissiveIntensity = 1.6
                }
              } catch {}
            })
          } else {
            m.transparent = opacity < 1
            m.opacity = opacity
            m.depthWrite = opacity >= 1
            try {
              if (m.emissive) {
                m.emissive = new THREE.Color('#ffd480')
                m.emissiveIntensity = 1.6
              }
            } catch {}
          }
        }
      })
    } catch {}
  }

  // Asegurar emisivo permanente por defecto al montar el modelo
  useEffect(() => {
    if (!scene) return
    try {
      scene.traverse((obj) => {
        if (!obj || !obj.isMesh || !obj.material) return
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => {
          try {
            if (m && m.emissive) {
              m.emissive = new THREE.Color('#ffd480')
              m.emissiveIntensity = 1.6
            }
          } catch {}
        })
      })
    } catch {}
  }, [scene])

  // Avisar al contenedor que el personaje está listo (solo una vez)
  const readyOnceRef = useRef(false)
  useEffect(() => {
    if (!scene) return
    if (readyOnceRef.current) return
    readyOnceRef.current = true
    if (typeof onCharacterReady === 'function') {
      try { onCharacterReady() } catch {}
    }
  }, [scene, onCharacterReady])


  // When navigateToPortalId changes, arm orb mode (supports synthetic 'home' center)
  useEffect(() => {
    if (!navigateToPortalId || !playerRef.current) return
    if (orbActiveRef.current) return
    let portal = portals.find((p) => p.id === navigateToPortalId)
    if (!portal && navigateToPortalId === 'home') {
      // objetivo sintético al centro y caída desde muy alto
      orbTargetPosRef.current.set(0, 0, 0)
      try { playerRef.current.position.set(0, HOME_FALL_HEIGHT, 0) } catch {}
      fallFromAboveRef.current = true
      try { fallStartTimeRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) } catch { fallStartTimeRef.current = Date.now() }
      if (typeof onHomeFallStart === 'function') { try { onHomeFallStart() } catch {} }
    } else if (portal) {
      orbTargetPosRef.current.fromArray(portal.position)
      fallFromAboveRef.current = false
    } else {
      return
    }
    // mantener vuelo a la altura del suelo (la esfera se dibuja con offset visual)
    orbTargetPosRef.current.y = playerRef.current.position.y
    // start orb now, and begin fading out model
    fadeOutTRef.current = 0
    fadeInTRef.current = 0
    showOrbRef.current = true
    // ocultar humano inmediatamente mientras el orbe esté visible
    try { applyModelOpacity(0) } catch {}
    orbActiveRef.current = true
    setOrbActive(true)
    if (typeof onOrbStateChange === 'function') onOrbStateChange(true)
    // SFX: inicio de orbe
    if (fallFromAboveRef.current) {
      // modo home: caída
      playSfx('sparkleFall', { volume: 0.9 })
    } else {
      playSfx('magiaInicia', { volume: 0.9 })
    }
    // Partículas: splash inicial en el punto de partida del orbe
    try {
      const startPos = new THREE.Vector3()
      playerRef.current.getWorldPosition(startPos)
      startPos.add(new THREE.Vector3(0, ORB_HEIGHT, 0))
      const groundY = playerRef.current ? playerRef.current.position.y : 0.0
      const initialSplash = fallFromAboveRef.current ? 80 : 140
      for (let i = 0; i < initialSplash; i++) {
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * 0.22
        const dirXZ = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
        const speedXZ = (fallFromAboveRef.current ? 7 : 9) + Math.random() * (fallFromAboveRef.current ? 7 : 9)
        const velXZ = dirXZ.multiplyScalar(speedXZ)
        const p = startPos.clone()
        p.y = groundY + 0.06
        p.x += Math.cos(a) * r
        p.z += Math.sin(a) * r
        const s = { pos: p, vel: velXZ, life: 2.0 + Math.random() * 2.6, _life0: 2.0, _grounded: true, _groundT: 0 }
        s.vel.x += (Math.random() - 0.5) * 1.8
        s.vel.z += (Math.random() - 0.5) * 1.8
        if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push(s)
      }
      // refuerzo visual/alpha por ~1-1.5s y una pequeña cola para asegurar visibilidad
      explosionBoostRef.current = Math.max(explosionBoostRef.current, 1.25)
      // Encolar emisiones adicionales, incluyendo un toque de esfera y anillo para visibilidad inmediata
      explosionQueueRef.current.splash += 80
      explosionQueueRef.current.sphere += 40
      explosionQueueRef.current.ring += 30
      // Disparo inmediato ligero de esfera/anillo para que se vea aunque el viaje sea corto
      const immediateSphere = 30
      const immediateRing = 20
      for (let i = 0; i < immediateSphere; i++) {
        const u = Math.random() * 2 - 1
        const phi = Math.random() * Math.PI * 2
        const sqrt1u2 = Math.sqrt(1 - u * u)
        const dirExp = new THREE.Vector3(sqrt1u2 * Math.cos(phi), u, sqrt1u2 * Math.sin(phi))
        const speedExp = 6 + Math.random() * 10
        const velExp = dirExp.multiplyScalar(speedExp)
        if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: startPos.clone().setY(groundY + 0.06), vel: velExp, life: 1.6 + Math.random() * 2.0, _life0: 1.6 })
      }
      for (let i = 0; i < immediateRing; i++) {
        const a = Math.random() * Math.PI * 2
        const dirRing = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
        const velRing = dirRing.multiplyScalar(9 + Math.random() * 8).add(new THREE.Vector3(0, (Math.random() - 0.5) * 1.2, 0))
        if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: startPos.clone().setY(groundY + 0.06), vel: velRing, life: 1.4 + Math.random() * 1.8, _life0: 1.4 })
      }
      // SFX explícito del splash inicial
      playSfx('sparkleBom', { volume: 0.85 })
    } catch {}
    // nueva fase aleatoria para variación del revoloteo por viaje
    wobblePhaseRef.current = Math.random() * Math.PI * 2
    wobblePhase2Ref.current = Math.random() * Math.PI * 2
    nearTimerRef.current = 0
    lastDistRef.current = Infinity
    hasExplodedRef.current = false
    // Desactivar sombra del personaje durante el modo orbe
    setCharacterShadowEnabled(false)
    // reset trail
    orbTrailRef.current = []
    sparksRef.current = []
    // no explosion fragments anymore
    lastPosRef.current.copy(playerRef.current.position)
    // set target color if provided by portal
    try {
      if (portal?.color) orbTargetColorRef.current = new THREE.Color(portal.color)
      else orbTargetColorRef.current = new THREE.Color('#9ec6ff')
    } catch {}
    // capture start distance to target for progressive tint
    const startPos = playerRef.current.position.clone()
    const groundTarget = orbTargetPosRef.current.clone()
    orbStartDistRef.current = Math.max(1e-3, groundTarget.distanceTo(startPos))
  }, [navigateToPortalId, portals, playerRef, onHomeFallStart])

  // Desactivar shadow.autoUpdate por defecto en la luz del orbe
  useEffect(() => {
    try {
      if (orbLightRef.current && orbLightRef.current.shadow) {
        orbLightRef.current.shadow.autoUpdate = false
      }
    } catch {}
  }, [])

  // Compute model center once to place the initial glow at character center
  useEffect(() => {
    try {
      const box = new THREE.Box3().setFromObject(scene)
      const center = new THREE.Vector3()
      box.getCenter(center)
      orbOriginOffsetRef.current.copy(center)
    } catch {}
  }, [scene])

  // Keyboard state
  const keyboard = useKeyboard()
  const actionPrevRef = useRef(false)
  const actionCooldownSRef = useRef(0)
  const ACTION_COOLDOWN_S = 2.0
  // Carga del poder (0..1)
  const chargeRef = useRef(0)

  const triggerManualExplosion = React.useCallback((power = 1) => {
    if (!playerRef.current) return
    const k = Math.max(0.0, Math.min(1.0, power))
    try { playSfx('sparkleBom', { volume: 0.8 }) } catch {}
    const explodePos = explosionQueueRef.current.pos
    try { playerRef.current.getWorldPosition(explodePos) } catch {}
    explodePos.add(new THREE.Vector3(0, ORB_HEIGHT, 0))
    // Cola de partículas (limitada para evitar saturación prolongada)
    const MAX_QUEUE_SPHERE = 360
    const MAX_QUEUE_RING = 220
    const MAX_QUEUE_SPLASH = 260
    const mult = 0.3 + 1.2 * k
    explosionQueueRef.current.sphere = Math.min(MAX_QUEUE_SPHERE, explosionQueueRef.current.sphere + Math.round(80 * mult))
    explosionQueueRef.current.ring = Math.min(MAX_QUEUE_RING, explosionQueueRef.current.ring + Math.round(40 * mult))
    explosionQueueRef.current.splash = Math.min(MAX_QUEUE_SPLASH, explosionQueueRef.current.splash + Math.round(60 * mult))
    // Disparo inmediato parcial para feedback instantáneo
    const immediateSphere = Math.round(40 * mult)
    const immediateRing = Math.round(22 * mult)
    const immediateSplash = Math.round(30 * mult)
    for (let i = 0; i < immediateSphere; i++) {
      const u = Math.random() * 2 - 1
      const phi = Math.random() * Math.PI * 2
      const sqrt1u2 = Math.sqrt(1 - u * u)
      const dirExp = new THREE.Vector3(sqrt1u2 * Math.cos(phi), u, sqrt1u2 * Math.sin(phi))
      const speedExp = 8 + Math.random() * 14
      const velExp = dirExp.multiplyScalar(speedExp)
      if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explodePos.clone(), vel: velExp, life: 2.0 + Math.random() * 2.4, _life0: 2.0 })
    }
    for (let i = 0; i < immediateRing; i++) {
      const a = Math.random() * Math.PI * 2
      const dirRing = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
      const velRing = dirRing.multiplyScalar(12 + Math.random() * 10).add(new THREE.Vector3(0, (Math.random() - 0.5) * 2, 0))
      if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explodePos.clone(), vel: velRing, life: 2.0 + Math.random() * 2.0, _life0: 2.0 })
    }
    for (let i = 0; i < immediateSplash; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 0.22
      const dirXZ = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
      const speedXZ = 7 + Math.random() * 9
      const velXZ = dirXZ.multiplyScalar(speedXZ)
      const p = explodePos.clone()
      p.x += Math.cos(a) * r
      p.z += Math.sin(a) * r
      p.y = (playerRef.current ? playerRef.current.position.y : 0.0) + 0.06
      const s = { pos: p, vel: velXZ, life: 1.6 + Math.random() * 2.0, _life0: 1.6, _grounded: true, _groundT: 0 }
      s.vel.x += (Math.random() - 0.5) * 1.2
      s.vel.z += (Math.random() - 0.5) * 1.2
      if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push(s)
    }
    // impulso visual más corto
    explosionBoostRef.current = Math.min(1.6, Math.max(explosionBoostRef.current, 0.8 + 1.2 * k))
    // Empuje radial a las orbes cercanas (HOME)
    try {
      if (typeof onPulse === 'function') {
        const strength = 6 + 10 * k
        const radius = 4 + 4 * k
        onPulse(explodePos.clone(), strength, radius)
      }
    } catch {}
  }, [onPulse, playerRef])

  // Log available animation clip names and action keys once loaded
  useEffect(() => {
    if (!animations || !actions) return
    // Silenciar logs de debug en producción para evitar jank en main thread
    if (import.meta.env.DEV) {
      const clipNames = animations.map((clip) => clip.name)
      const actionKeys = Object.keys(actions)
      // eslint-disable-next-line no-console
      console.log('[Player] clips:', clipNames, 'actions:', actionKeys)
    }
  }, [animations, actions])

  // Utilidad para habilitar/deshabilitar sombra del personaje completo
  const setCharacterShadowEnabled = React.useCallback((enabled) => {
    if (!scene) return
    try {
      scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = !!enabled
          // evitar self-shadowing en el propio personaje
          o.receiveShadow = false
        }
      })
    } catch {}
  }, [scene])

  // Habilitar sombras por defecto al montar
  useEffect(() => { setCharacterShadowEnabled(true) }, [setCharacterShadowEnabled])

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
  const IDLE_TIMESCALE = 1.65
  const WALK_TIMESCALE_MULT = 1.35
  useEffect(() => {
    if (!actions) return
    const idleAction = idleName && actions[idleName]
    const walkAction = walkName && actions[walkName]
    if (idleAction) {
      idleAction.reset().setEffectiveWeight(1).setEffectiveTimeScale(IDLE_TIMESCALE).play()
      idleAction.setLoop(THREE.LoopRepeat, Infinity)
      idleAction.clampWhenFinished = false
      try { idleDurationRef.current = idleAction.getClip()?.duration || idleDurationRef.current } catch {}
    }
    if (walkAction) {
      const baseWalkScale = Math.max(1, (SPEED / BASE_SPEED) * WALK_TIMESCALE_MULT)
      walkAction.reset().setEffectiveWeight(0).setEffectiveTimeScale(baseWalkScale).play()
      walkAction.setLoop(THREE.LoopRepeat, Infinity)
      walkAction.clampWhenFinished = false
      try { walkDurationRef.current = walkAction.getClip()?.duration || walkDurationRef.current } catch {}
    }
  }, [actions, idleName, walkName])

  // Movement parameters
  const BASE_SPEED = 5 // baseline used to sync animation playback
  // Velocidad reducida para que la caminata sea más lenta y controlada
  const SPEED = 8.5
  const threshold = 3 // distance threshold for portal "inside" (for CTA)
  const EXIT_THRESHOLD = 4 // must leave this distance to rearm
  const REENTER_COOLDOWN_S = 1.2 // tiempo mínimo antes de poder re-entrar
  const PROXIMITY_RADIUS = 12 // radius within which we start tinting the scene
  // Blend rapidez entre idle/walk (k alto = transición más veloz)
  const BLEND_K = 22.0

  // Rising-edge detector por portal + cooldown para evitar re-entradas instantáneas
  const insideMapRef = useRef({})
  const cooldownRef = useRef({ portalId: null, untilS: 0 })
  const NEAR_INNER = 1.6 // very close to portal
  const NEAR_OUTER = 9.0 // start blending color near this distance
  const smoothstep = (edge0, edge1, x) => {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
  }

  // Per‑frame update: handle movement, rotation, animation blending and portal
  // proximity detection.
  useFrame((state, delta) => {
    if (!playerRef.current) return
    // Sistema de carga del poder (barra espaciadora): mantener presionado para cargar, soltar para disparar
    const pressed = !!keyboard?.action
    // Preserve movement distance with raw delta (clamped to avoid giant steps),
    // and use a smoothed delta only for interpolation/blending
    const dtRaw = Math.min(delta, 1 / 15)
    const dtClamped = THREE.MathUtils.clamp(dtRaw, 1 / 120, 1 / 30)
    dtSmoothRef.current = THREE.MathUtils.lerp(dtSmoothRef.current, dtClamped, 0.18)
    dtMoveRef.current = dtRaw
    const dt = dtSmoothRef.current
    // Mantener mixer a timeScale 1 para que los clips se reproduzcan completos y cíclicos
    if (mixer) mixer.timeScale = 1
    // Cooldown de pasos
    footCooldownSRef.current = Math.max(0, footCooldownSRef.current - dt)


    // Asegurar que la luz del orbe solo actualice shadow map cuando está activa
    try {
      if (orbLightRef.current && orbLightRef.current.shadow) {
        orbLightRef.current.shadow.autoUpdate = !!orbActiveRef.current
      }
    } catch {}

    // If orb is active, character must be fully hidden
    if (orbActiveRef.current) {
      applyModelOpacity(0)
    }
    // Crossfade in when finishing orb
    if (!orbActiveRef.current && showOrbRef.current) {
      // Mientras el orbe esté visible, el humano debe permanecer oculto
      applyModelOpacity(0)
    } else if (!orbActiveRef.current && !showOrbRef.current && fadeInTRef.current < 1) {
      // Sólo comenzar el fade-in cuando el orbe ya no es visible
      fadeInTRef.current = Math.min(1, fadeInTRef.current + dt / FADE_IN)
      applyModelOpacity(fadeInTRef.current)
      if (fadeInTRef.current >= 1) {
        if (typeof onOrbStateChange === 'function') onOrbStateChange(false)
        // Rehabilitar sombra del personaje al volver a forma humana
        setCharacterShadowEnabled(true)
      }
    }

    // Move only while orb is active
    if (orbActiveRef.current) {
      const pos = playerRef.current.position
      // record trail (for direction helper)
      orbTrailRef.current.push(pos.clone())
      if (orbTrailRef.current.length > 120) orbTrailRef.current.shift()
      const dir = new THREE.Vector3().subVectors(orbTargetPosRef.current, pos)
      let dist = dir.length()
      let crossedIn = false
      if (fallFromAboveRef.current) {
        const fallSpeed = 16
        pos.y = pos.y - fallSpeed * (dtMoveRef.current || dt)
        // recentrado suave en XZ hacia el origen
        const k = 1 - Math.pow(0.001, (dtMoveRef.current || dt))
        pos.x = THREE.MathUtils.lerp(pos.x, 0, k)
        pos.z = THREE.MathUtils.lerp(pos.z, 0, k)
      } else {
        // Revoloteo sutil: añade oscilación lateral que se atenúa al acercarse y se reduce al llegar
        let steerDir = dir.clone()
        if (dist > 1e-6) {
          const tNow = state.clock.getElapsedTime()
          const progress = THREE.MathUtils.clamp(1 - dist / Math.max(1e-3, orbStartDistRef.current), 0, 1)
          const farFactor = THREE.MathUtils.smoothstep(dist, 0, PORTAL_STOP_DIST * 2.5)
          const amplitude = WOBBLE_BASE * 0.6 * Math.pow(1 - progress, 1.2) * farFactor
          const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
          const side1 = new THREE.Vector3().crossVectors(dir, up).normalize()
          const side2 = new THREE.Vector3().crossVectors(dir, side1).normalize()
          const wobble = side1.multiplyScalar(Math.sin(tNow * WOBBLE_FREQ1 + wobblePhaseRef.current) * amplitude)
            .add(side2.multiplyScalar(Math.cos(tNow * WOBBLE_FREQ2 + wobblePhase2Ref.current) * amplitude * 0.85))
          steerDir.add(wobble)
          steerDir.normalize()
        } else {
          steerDir.set(0, 0, 0)
        }
        const step = Math.min(dist, ORB_SPEED * (dtMoveRef.current || dt))
        pos.addScaledVector(steerDir, step)
        // Recalcular distancia tras mover para criterios de llegada robustos
        const distAfter = orbTargetPosRef.current.distanceTo(pos)
        // Detectar cruce de umbral (de >stop a <=stop) para no depender solo de tiempo/posición
        crossedIn = lastDistRef.current > PORTAL_STOP_DIST && distAfter <= PORTAL_STOP_DIST
        lastDistRef.current = distAfter
        // Histeresis suave del temporizador de cercanía para no perder splash con revoloteo
        if (distAfter < ARRIVAL_NEAR_DIST) nearTimerRef.current += (dtMoveRef.current || dt)
        else nearTimerRef.current = Math.max(0, nearTimerRef.current - (dtMoveRef.current || dt) * 0.5)
        // Actualizar dir para que la rotación mire hacia la dirección oscilante
        dir.copy(steerDir)
        // Snap suave si estamos extremadamente cerca para evitar bucle infinito
        if (distAfter <= 0.02) {
          pos.copy(orbTargetPosRef.current)
        }
        // Sobrescribir dist para la comprobación de llegada
        // Nota: la condición de llegada usa 'dist' más abajo, lo actualizamos aquí
        // (no afectará la rama de caída)
        // eslint-disable-next-line no-param-reassign
        // @ts-ignore
        dist = distAfter
      }
      // Progressive tint of orb material based on approach
      if (orbMatRef.current) {
        const distNow = orbTargetPosRef.current.distanceTo(pos)
        const k = THREE.MathUtils.clamp(1 - distNow / orbStartDistRef.current, 0, 1)
        const col = orbBaseColorRef.current.clone().lerp(orbTargetColorRef.current, k)
        orbMatRef.current.emissive.copy(col)
        orbMatRef.current.color.copy(col.clone().multiplyScalar(0.9))
        orbMatRef.current.emissiveIntensity = 5 + 2 * k
        orbMatRef.current.needsUpdate = true
        if (orbLightRef.current) {
          orbLightRef.current.color.copy(col)
          // Pre-mounted light: ramp intensity only when active
          const active = true
          orbLightRef.current.intensity = (active ? (6 + 6 * k) : 0)
          // cubre más suelo
          orbLightRef.current.distance = 12
          orbLightRef.current.decay = 1.6
          // update shadow only while active to avoid extra passes
          if (orbLightRef.current.shadow) {
            orbLightRef.current.shadow.autoUpdate = true
          }
        }
      }
      // spawn sparks in a wide cone/disk behind the orb (occupy more space)
      const worldPos = new THREE.Vector3()
      playerRef.current.getWorldPosition(worldPos)
      worldPos.add(new THREE.Vector3(0, ORB_HEIGHT, 0))
      const moveVec = new THREE.Vector3().subVectors(worldPos, lastPosRef.current)
      const speed = moveVec.length() / Math.max((dtMoveRef.current || dt), 1e-4)
      const forward = moveVec.lengthSq() > 1e-8 ? moveVec.clone().normalize() : dir.clone()
      const backDir = forward.clone().multiplyScalar(-1)
      // Build an orthonormal basis (backDir, t1, t2)
      const up = Math.abs(backDir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
      const t1 = new THREE.Vector3().crossVectors(backDir, up).normalize()
      const t2 = new THREE.Vector3().crossVectors(backDir, t1).normalize()
      const diskRadius = 0.5
      const backOffset = 0.28
      const count = 8
      for (let i = 0; i < count; i++) {
        const r = diskRadius * Math.sqrt(Math.random())
        const a = Math.random() * Math.PI * 2
        const offset = t1.clone().multiplyScalar(r * Math.cos(a)).add(t2.clone().multiplyScalar(r * Math.sin(a)))
        const basePos = worldPos.clone().addScaledVector(backDir, backOffset).add(offset)
        // velocity mainly backwards with wide cone spread
        const spread = 1.6
        const vel = backDir.clone().multiplyScalar(Math.min(5, 0.22 * speed) + Math.random() * 0.6)
          .add(t1.clone().multiplyScalar((Math.random() - 0.5) * spread))
          .add(t2.clone().multiplyScalar((Math.random() - 0.5) * spread))
          .add(new THREE.Vector3(0, Math.random() * 0.6, 0))
        // tint spark color by progress (store k now)
        sparksRef.current.push({ pos: basePos, vel, life: 0.4 + Math.random() * 0.6, kOverride: THREE.MathUtils.clamp(1 - orbTargetPosRef.current.distanceTo(pos) / orbStartDistRef.current, 0, 1), t: 'trail' })
      }
      lastPosRef.current.copy(worldPos)
      // Smoothly face direction
      if (!fallFromAboveRef.current) {
        const targetAngle = Math.atan2(dir.x, dir.z)
        const smoothing = 1 - Math.pow(0.0001, dt)
        playerRef.current.rotation.y = lerpAngleWrapped(playerRef.current.rotation.y, targetAngle, smoothing)
      }
      // reached?
      const arrivedPortal = (!fallFromAboveRef.current && (dist <= PORTAL_STOP_DIST || nearTimerRef.current > 0.06 || crossedIn))
      const arrivedFall = (fallFromAboveRef.current && pos.y <= FALL_STOP_Y)
      if (arrivedPortal || arrivedFall) {
        if (hasExplodedRef.current) return
        hasExplodedRef.current = true
        // Defer explosion spawning across frames to avoid stutter
        const explodePos = explosionQueueRef.current.pos
        playerRef.current.getWorldPosition(explodePos)
        explodePos.add(new THREE.Vector3(0, ORB_HEIGHT, 0))
        // Asignar colas
        explosionQueueRef.current.sphere = 200
        explosionQueueRef.current.ring = 100
        explosionQueueRef.current.splash = 120
        // Disparo inmediato parcial para asegurar visibilidad incluso si el Canvas se pausa pronto
        try {
          const immediateSphere = 140
          const immediateRing = 70
          const immediateSplash = 90
          // esfera inmediata
          for (let i = 0; i < immediateSphere; i++) {
            const u = Math.random() * 2 - 1
            const phi = Math.random() * Math.PI * 2
            const sqrt1u2 = Math.sqrt(1 - u * u)
            const dirExp = new THREE.Vector3(sqrt1u2 * Math.cos(phi), u, sqrt1u2 * Math.sin(phi))
            const speedExp = 8 + Math.random() * 14
            const velExp = dirExp.multiplyScalar(speedExp)
            if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explodePos.clone(), vel: velExp, life: 2.2 + Math.random() * 2.4, _life0: 2.2 })
          }
          explosionQueueRef.current.sphere = Math.max(0, explosionQueueRef.current.sphere - immediateSphere)
          // anillo inmediato
          for (let i = 0; i < immediateRing; i++) {
            const a = Math.random() * Math.PI * 2
            const dirRing = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
            const velRing = dirRing.multiplyScalar(12 + Math.random() * 10).add(new THREE.Vector3(0, (Math.random() - 0.5) * 2, 0))
            if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explodePos.clone(), vel: velRing, life: 2.0 + Math.random() * 2.0, _life0: 2.0 })
          }
          explosionQueueRef.current.ring = Math.max(0, explosionQueueRef.current.ring - immediateRing)
          // splash inmediato
          const GROUND_Y = 0.0
          for (let i = 0; i < immediateSplash; i++) {
            const a = Math.random() * Math.PI * 2
            const r = Math.random() * 0.25
            const dirXZ = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
            const speedXZ = 8 + Math.random() * 10
            const velXZ = dirXZ.multiplyScalar(speedXZ)
            const p = explodePos.clone()
            p.y = GROUND_Y + 0.06
            p.x += Math.cos(a) * r
            p.z += Math.sin(a) * r
            const s = { pos: p, vel: velXZ, life: 2.2 + Math.random() * 2.8, _life0: 2.2, _grounded: true, _groundT: 0 }
            s.vel.x += (Math.random() - 0.5) * 2
            s.vel.z += (Math.random() - 0.5) * 2
            if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push(s)
          }
          explosionQueueRef.current.splash = Math.max(0, explosionQueueRef.current.splash - immediateSplash)
        } catch {}
        // Boost spark size/opacity briefly (stronger, single assignment)
        explosionBoostRef.current = 1.6
        // SFX: llegada (portal o piso con splash)
        playSfx('sparkleBom', { volume: 1.0 })
        // Empuje radial a las orbes cercanas (HOME, splash de aterrizaje)
        try {
          if (typeof onPulse === 'function') {
            // Empuje moderado similar al pulso base
            onPulse(explodePos.clone(), 6, 4)
          }
        } catch {}
        // Clear trailing sparks to avoid pile-up on ground
        try {
          const arr = sparksRef.current
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i] && arr[i].t === 'trail') arr.splice(i, 1)
          }
        } catch {}
        // Transform back: snap to ground level
        playerRef.current.position.y = 0
        fallFromAboveRef.current = false
        // hide orb, then start fade‑in to human
        showOrbRef.current = false
        fadeInTRef.current = 0
        // clear trail path to avoid residual tube influence (sparks persist)
        orbTrailRef.current = []
        if (typeof onReachedPortal === 'function') onReachedPortal(navigateToPortalId)
        // Callback explícito para splash de HOME
        if (arrivedFall && typeof onHomeSplash === 'function') {
          try { onHomeSplash() } catch {}
        }
        // stop orb movement but keep orb visible while fading in
        orbActiveRef.current = false
        setOrbActive(false)
      }
      return // skip normal movement
    }

    // (la detección de pasos basada en animación se realiza después del cálculo de input)

    // Build input vector (camera-relative). Usar joystick analógico si presente
    const joy = (typeof window !== 'undefined' && window.__joystick) ? window.__joystick : null
    const isCoarse = (() => {
      try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches } catch { return false }
    })()
    const joyMag = joy && joy.active ? Math.max(0, Math.min(1, joy.mag || Math.hypot(joy.x || 0, joy.y || 0))) : 0
    const JOY_DEAD = 0.06
    // Solo usar joystick en dispositivos táctiles/puntero "coarse" (mobile/tablet)
    const hasJoy = isCoarse && joy && joy.active && (joyMag > JOY_DEAD)
    // Ejes: joystick x derecha+, y abajo+ → zInput utiliza -y (arriba en pantalla = adelante)
    const xInputRaw = hasJoy ? (joy.x || 0) : ((keyboard.left ? -1 : 0) + (keyboard.right ? 1 : 0))
    const zInputRaw = hasJoy ? (-(joy.y || 0)) : ((keyboard.forward ? 1 : 0) + (keyboard.backward ? -1 : 0))
    // magnitud analógica (prioriza joystick si activo)
    const inputMag = hasJoy ? Math.max(0, Math.min(1, Math.hypot(xInputRaw, zInputRaw))) : Math.min(1, Math.abs(xInputRaw) + Math.abs(zInputRaw))

    // Base de cámara (sin suavizado) para evitar latencias extra
    const camForward = new THREE.Vector3()
    camera.getWorldDirection(camForward)
    camForward.y = 0
    if (camForward.lengthSq() > 0) camForward.normalize()
    const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize()

    // Desired move direction relative to cámara directa (con suavizado para joystick)
    const xInput = xInputRaw
    const zInput = zInputRaw
    const desiredDir = new THREE.Vector3()
      .addScaledVector(camForward, zInput)
      .addScaledVector(camRight, xInput)
    if (desiredDir.lengthSq() > 1e-6) desiredDir.normalize()
    // Suavizado solo para joystick; en desktop (teclado) mantener respuesta inmediata
    let direction = desiredDir
    if (hasJoy) {
      const prevDir = (playerRef.current._lastDir || new THREE.Vector3())
      const dirSmoothK = (1 - Math.pow(0.0015, dt))
      direction = new THREE.Vector3().copy(prevDir).lerp(desiredDir, dirSmoothK)
      if (direction.lengthSq() > 1e-4) direction.normalize()
      playerRef.current._lastDir = direction.clone()
    } else {
      // limpiar memoria para no interferir
      playerRef.current._lastDir = desiredDir.clone()
    }

    const hasInput = hasJoy ? (inputMag > 0.001) : ((Math.abs(xInput) + Math.abs(zInput)) > 0)
    // Notificar cambio de estado de movimiento
    if (hadInputPrevRef.current !== hasInput) {
      hadInputPrevRef.current = hasInput
      try { if (typeof onMoveStateChange === 'function') onMoveStateChange(hasInput) } catch {}
    }
    // Movimiento original con rotación hacia dirección relativa a cámara
    if (hasInput) {
      direction.normalize()
      const targetAngle = Math.atan2(direction.x, direction.z)
      const smoothing = 1 - Math.pow(0.001, dt)
      playerRef.current.rotation.y = lerpAngleWrapped(
        playerRef.current.rotation.y,
        targetAngle,
        smoothing,
      )
      // Aceleración progresiva y fricción con joystick
      const accel = THREE.MathUtils.lerp(1.0, 1.25, inputMag)
      const speedMultiplier = keyboard.shift ? 1.5 : 1.0
      const effectiveSpeed = SPEED * speedMultiplier
      // Intensidad analógica controla velocidad: mínimo 30% para no quedarse corto
      const magFactor = hasJoy ? THREE.MathUtils.clamp(0.3 + 0.7 * inputMag, 0.3, 1.0) : 1.0
      const velocity = direction.clone().multiplyScalar(effectiveSpeed * accel * magFactor * (dtMoveRef.current || dt))
      playerRef.current.position.add(velocity)
    }

    // Blend animations based on input intensity
    if (actions) {
      const idleAction = idleName && actions[idleName]
      const walkAction = walkName && actions[walkName]
      if (idleAction && walkAction) {
        // Guardia: asegurar loop infinito y no clamp al finalizar por si otro código lo cambia
        if (idleAction.loop !== THREE.LoopRepeat) idleAction.setLoop(THREE.LoopRepeat, Infinity)
        if (walkAction.loop !== THREE.LoopRepeat) walkAction.setLoop(THREE.LoopRepeat, Infinity)
        idleAction.clampWhenFinished = false
        walkAction.clampWhenFinished = false
        const target = hasInput ? 1 : 0
        const smoothing = 1 - Math.exp(-22.0 * dt)
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
        // Mantener la animación sincronizada con velocidad real (Shift y magnitud analógica)
        const speedMultiplier = keyboard.shift ? 1.5 : 1.0
        const effectiveSpeed = SPEED * speedMultiplier
        const baseWalkScale = Math.max(1, (effectiveSpeed / BASE_SPEED) * WALK_TIMESCALE_MULT)
        const magScale = hasJoy ? (0.75 + 0.25 * inputMag) : 1.0
        const animScale = THREE.MathUtils.lerp(1, baseWalkScale * magScale, walkW)
        // Timescales fijos por acción
        walkAction.setEffectiveTimeScale(animScale)
        idleAction.setEffectiveTimeScale(IDLE_TIMESCALE)
        // Evitar micro-parón en el seam del loop (cuando time cae exactamente en 0 o duration)
        try {
          const d = Math.max(1e-3, walkDurationRef.current)
          const t = walkAction.time % d
          const eps = 1e-3
          if (t < eps) walkAction.time = eps
          else if (d - t < eps) walkAction.time = d - eps
        } catch {}

        // Detección de pasos: sólo cuando hay input y el peso de caminar es alto
        try {
          const hasInputNow = hasInput
          const walkWeight = walkWeightRef.current
          if (hasInputNow && walkWeight > 0.5) {
            const d = Math.max(1e-3, walkDurationRef.current)
            const t = (walkAction?.time || 0) % d
            const tNorm = t / d
            const prev = prevWalkNormRef.current
            const beats = [0.18, 0.68]
            const crossed = (a, b, p) => (a <= b ? (a < p && b >= p) : (a < p || b >= p))
            const hit = beats.some((p) => crossed(prev, tNorm, p))
            if (hit && footCooldownSRef.current <= 0) {
              if (ENABLE_FOOT_SFX) {
                const vol = 0.35
                if (nextIsRightRef.current) playSfx('stepone', { volume: vol })
                else playSfx('steptwo', { volume: vol })
              }
              nextIsRightRef.current = !nextIsRightRef.current
              footCooldownSRef.current = 0.12
            }
            prevWalkNormRef.current = tNorm
          } else {
            // resync para evitar disparos al reanudar desde quieto
            const d = Math.max(1e-3, walkDurationRef.current)
            const t = (walkAction?.time || 0) % d
            prevWalkNormRef.current = t / d
          }
        } catch {}
      }
    }

    // Check proximity to each portal. Trigger enter callback within
    // a small threshold, and compute a proximity factor for scene tinting.
    let minDistance = Infinity
    const perPortal = {}
    const nowS = state.clock.getElapsedTime()
    let nearestId = null
    let nearestDist = Infinity
    portals.forEach((portal) => {
      const portalPos = new THREE.Vector3().fromArray(portal.position)
      const distance = portalPos.distanceTo(playerRef.current.position)
      if (distance < minDistance) minDistance = distance
      if (distance < nearestDist) { nearestDist = distance; nearestId = portal.id }
      const wasInside = !!insideMapRef.current[portal.id]
      const isInside = distance < threshold
      const isOutside = distance > EXIT_THRESHOLD
      if (isOutside) insideMapRef.current[portal.id] = false
      // Ya no se lanza "enter" automáticamente; solo marcamos inside para CTA y control de salida
      if (!wasInside && isInside) {
        const blocked = cooldownRef.current.portalId === portal.id && nowS < cooldownRef.current.untilS
        if (!blocked) {
          insideMapRef.current[portal.id] = true
          // No invocamos onPortalEnter aquí; será el botón del CTA quien lo haga
        }
      }
      // Proximidad "cercana" para cambio de color progresivo del portal/partículas
      const nearFactor = smoothstep(NEAR_OUTER, NEAR_INNER, distance)
      perPortal[portal.id] = THREE.MathUtils.clamp(nearFactor, 0, 1)
    })
    // (opcional) persistir distancia si se usa en otras UX; no requerida para movimiento
    if (onProximityChange && isFinite(minDistance)) {
      const factor = THREE.MathUtils.clamp(1 - minDistance / PROXIMITY_RADIUS, 0, 1)
      onProximityChange(factor)
    }
    if (onPortalsProximityChange) {
      onPortalsProximityChange(perPortal)
    }
    // Carga del poder: mantener presionado espacio para subir 'charge' (0..1); soltar para disparar
    try {
      const nearK = smoothstep(NEAR_OUTER, NEAR_INNER, minDistance) // 0 lejos, 1 muy cerca
      const rate = (0.65 + 1.8 * nearK) // base + boost por cercanía
      if (pressed) {
        chargeRef.current = Math.min(1, chargeRef.current + (dtMoveRef.current || dt) * rate)
      } else if (actionPrevRef.current && chargeRef.current > 0.02) {
        // Disparo al soltar
        const power = chargeRef.current
        triggerManualExplosion(power)
        chargeRef.current = 0
      }
      if (typeof onActionCooldown === 'function') {
        // Reusar canal para UI: enviar (1 - charge) para que el fill muestre 'charge'
        onActionCooldown(1 - THREE.MathUtils.clamp(chargeRef.current, 0, 1))
      }
    } catch {}
    // Actualizar flanco para siguiente frame
    actionPrevRef.current = pressed
    // Emitir portal cercano para mostrar CTA
    if (onNearPortalChange) {
      const showId = nearestDist < threshold ? nearestId : null
      onNearPortalChange(showId, nearestDist)
    }
  })

  // Trail as a luminous tube following the path (estela continua)
  // Sparks trail (small residual sparks fading quickly)
  const TrailSparks = () => {
    const geoRef = useRef()
    const CAP = 3000
    const positionsRef = useRef(new Float32Array(CAP * 3))
    const uniformsRef = useRef({
      uBaseColor: { value: orbBaseColorRef.current.clone() },
      uTargetColor: { value: orbTargetColorRef.current.clone() },
      uMix: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uSize: { value: 0.28 },
      uOpacity: { value: 0.2 },
    })
    // Init geometry once with max capacity
    useEffect(() => {
      if (!geoRef.current) return
      const geo = geoRef.current
      if (!geo.getAttribute('position')) {
        geo.setAttribute('position', new THREE.BufferAttribute(positionsRef.current, 3))
      }
      geo.setDrawRange(0, 0)
    }, [])
    useFrame((state, delta) => {
      // update sparks
      const arr = sparksRef.current
      if (!arr.length) {
        if (geoRef.current) {
          geoRef.current.setDrawRange(0, 0)
        }
        // reset uniforms
        uniformsRef.current.uMix.value = 0
        uniformsRef.current.uBaseColor.value.copy(orbBaseColorRef.current)
        uniformsRef.current.uTargetColor.value.copy(orbTargetColorRef.current)
        return
      }
      // Spawn queued explosion particles in small batches to avoid spikes
      const BATCH = 60
      if (explosionQueueRef.current.sphere > 0) {
        const n = Math.min(BATCH, explosionQueueRef.current.sphere)
        for (let i = 0; i < n; i++) {
          const u = Math.random() * 2 - 1
          const phi = Math.random() * Math.PI * 2
          const sqrt1u2 = Math.sqrt(1 - u * u)
          const dirExp = new THREE.Vector3(sqrt1u2 * Math.cos(phi), u, sqrt1u2 * Math.sin(phi))
          const speedExp = 8 + Math.random() * 14
          const velExp = dirExp.multiplyScalar(speedExp)
          if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explosionQueueRef.current.pos.clone(), vel: velExp, life: 2.2 + Math.random() * 2.4, _life0: 2.2 })
        }
        explosionQueueRef.current.sphere -= n
      }
      if (explosionQueueRef.current.ring > 0) {
        const n = Math.min(BATCH, explosionQueueRef.current.ring)
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2
          const dirRing = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
          const velRing = dirRing.multiplyScalar(12 + Math.random() * 10).add(new THREE.Vector3(0, (Math.random() - 0.5) * 2, 0))
          if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explosionQueueRef.current.pos.clone(), vel: velRing, life: 2.0 + Math.random() * 2.0, _life0: 2.0 })
        }
        explosionQueueRef.current.ring -= n
      }
      if (explosionQueueRef.current.splash > 0) {
        const n = Math.min(BATCH, explosionQueueRef.current.splash)
        const GROUND_Y = 0.0
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2
          const r = Math.random() * 0.25
          const dirXZ = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
          const speedXZ = 8 + Math.random() * 10
          const velXZ = dirXZ.multiplyScalar(speedXZ)
          const p = explosionQueueRef.current.pos.clone()
          p.y = GROUND_Y + 0.06
          p.x += Math.cos(a) * r
          p.z += Math.sin(a) * r
          const s = { pos: p, vel: velXZ, life: 2.2 + Math.random() * 2.8, _life0: 2.2, _grounded: true, _groundT: 0 }
          s.vel.x += (Math.random() - 0.5) * 2
          s.vel.z += (Math.random() - 0.5) * 2
          if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push(s)
        }
        explosionQueueRef.current.splash -= n
      }
      // physics parameters (compute ground at player's feet)
      const GRAVITY = 9.8 * 1.0
      const GROUND_Y = (playerRef.current ? playerRef.current.position.y : 0.0)
      const RESTITUTION = 0.38
      const FRICTION = 0.94
      // use smoothed dt from outer scope if available
      const dt = dtSmoothRef.current ?? Math.min(delta, 1 / 60)
      for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i]
        // gravity
        s.vel.y -= GRAVITY * dt
        // integrate
        s.pos.addScaledVector(s.vel, dt)
        // ground collision (simple plane)
        if (s.pos.y <= GROUND_Y) {
          s.pos.y = GROUND_Y
          // bounce and then slide with friction
          s.vel.y = Math.abs(s.vel.y) * RESTITUTION
          s._grounded = true
          s._groundT = (s._groundT || 0) + dt
          s.vel.x *= FRICTION
          s.vel.z *= FRICTION
          // progressive death: after a few bounces/slides, start reducing life slower
          if (s._groundT > 1.2) s.life -= dt * 0.18
        }
        // air drag
        if (!s._grounded) {
          s.vel.x *= 0.9985
          s.vel.z *= 0.9985
          s.life -= dt * 0.04
        } else {
          s.life -= dt * 0.03
        }
        if (s.life <= 0) arr.splice(i, 1)
      }
      // Hard cap to avoid runaway particle counts
      if (arr.length > MAX_SPARKS) {
        arr.splice(0, arr.length - MAX_SPARKS)
      }
      const len = Math.min(arr.length, CAP)
      const buf = positionsRef.current
      for (let i = 0; i < len; i++) {
        buf[i * 3 + 0] = arr[i].pos.x
        buf[i * 3 + 1] = arr[i].pos.y
        buf[i * 3 + 2] = arr[i].pos.z
      }
      if (geoRef.current) {
        const geo = geoRef.current
        if (!geo.getAttribute('position')) {
          geo.setAttribute('position', new THREE.BufferAttribute(positionsRef.current, 3))
        }
        geo.setDrawRange(0, len)
        const attr = geo.attributes?.position
        if (attr) attr.needsUpdate = true
      }
      // tint sparks to match current orb color progression (portal/scene aware)
      const pos = playerRef.current?.position || new THREE.Vector3()
      const distNow = orbTargetPosRef.current.distanceTo(pos)
      const kDist = THREE.MathUtils.clamp(1 - distNow / Math.max(1e-3, orbStartDistRef.current), 0, 1)
      const sceneCol = new THREE.Color(sceneColor || '#ffffff')
      const baseCol = orbBaseColorRef.current.clone().lerp(sceneCol, 0.3)
      uniformsRef.current.uBaseColor.value.copy(baseCol)
      uniformsRef.current.uTargetColor.value.copy(orbTargetColorRef.current)
      uniformsRef.current.uMix.value = kDist
      // Apply explosion boost to size/opacity decay
      if (explosionBoostRef.current > 0) {
        // keep the boost visible ~1.2-1.6s
        explosionBoostRef.current = Math.max(0, explosionBoostRef.current - dt * 0.6)
      }
      const boost = explosionBoostRef.current
      // Larger, brighter right after the explosion, then decay (keep a higher base)
      uniformsRef.current.uSize.value = 0.28 + 0.9 * boost
      // much dimmer sparks: similar glow to portal particles
      uniformsRef.current.uOpacity.value = 0.2 + 0.06 * boost
    })
    return (
      <points frustumCulled={false}>
        <bufferGeometry ref={geoRef} />
        <shaderMaterial
          transparent
          depthWrite={false}
          depthTest={true}
          blending={THREE.AdditiveBlending}
          uniforms={uniformsRef.current}
          vertexShader={`
            uniform float uPixelRatio;
            uniform float uSize;
            void main() {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              gl_PointSize = uSize * (180.0 / max(1.0, -mvPosition.z)) * uPixelRatio;
            }
          `}
          fragmentShader={`
            precision highp float;
            uniform vec3 uBaseColor;
            uniform vec3 uTargetColor;
            uniform float uMix;
            uniform float uOpacity;
            void main() {
              vec2 uv = gl_PointCoord * 2.0 - 1.0;
              float d = length(uv);
              if (d > 1.0) discard;
              float core = pow(1.0 - d, 5.0);
              float halo = pow(1.0 - d, 2.0) * 0.2;
              float alpha = clamp(core + halo, 0.0, 1.0) * uOpacity;
              vec3 col = mix(uBaseColor, uTargetColor, clamp(uMix, 0.0, 1.0)) * 0.6;
              gl_FragColor = vec4(col, alpha);
            }
          `}
        />
      </points>
    )
  }

  // (ChargeParticles removido)

  // (GroundChargeRing removido)

  // (removed) Fragments component; replaced by persistent floor glitter

  return (
    <>
      <group ref={playerRef} position={[0, 0, 0]}>
        {/* Character model is always mounted; opacity is controlled via applyModelOpacity */}
        <primitive object={scene} scale={1.5} />
        {/* Orb sphere + inner sparkles to convey "ser de luz" */}
        <group position={[0, ORB_HEIGHT, 0]}>
          {/* Luz puntual: montada siempre para precalentar pipeline; intensidad 0 cuando no activo */}
          <pointLight ref={orbLightRef} intensity={showOrbRef.current ? 6 : 0} distance={12} decay={1.6} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} shadow-bias={-0.00006} shadow-normalBias={0.02} shadow-radius={8} />
          {showOrbRef.current && (
            <>
              <mesh>
                <sphereGeometry args={[0.6, 24, 24]} />
                <meshStandardMaterial ref={orbMatRef} emissive={new THREE.Color('#aee2ff')} emissiveIntensity={6.5} color={new THREE.Color('#f5fbff')} transparent opacity={0.9} />
              </mesh>
            </>
          )}
        </group>
      </group>
      {/* World-space sparks trail (not parented to player) */}
      {/* Mount spark shader always (drawRange 0 when idle) to avoid first-use jank */}
      <TrailSparks />
    </>
  )
}

// Preload the model for faster subsequent loading
useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`)