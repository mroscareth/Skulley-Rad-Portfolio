import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import * as THREE from 'three'
import useKeyboard from './useKeyboard.js'
import { playSfx, preloadSfx } from '../lib/sfx.js'
import SpeechBubble3D from './SpeechBubble3D.jsx'
import useSpeechBubbles from './useSpeechBubbles.js'

// Exponer un helper global a nivel de módulo (se ejecuta aunque el componente no llegue a montarse).
// Esto evita el caso donde un error en render/Canvas impide que corran los useEffect.
try {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__playerDisassemble = window.__playerDisassemble || {
      trigger: () => { try { window.dispatchEvent(new Event('player-disassemble')) } catch {} },
      snapshot: () => {
        // @ts-ignore
        return window.__playerDisassembleLastStart || null
      },
      stats: () => {
        // @ts-ignore
        return window.__playerDisassembleMeshStats || null
      },
    }
  }
} catch {}

// Interpolación de ángulos con wrapping (evita saltos al cruzar ±π)
function lerpAngleWrapped(current, target, t) {
  const TAU = Math.PI * 2
  let delta = ((target - current + Math.PI) % TAU) - Math.PI
  return current + delta * t
}

// Versión frame-rate independent de interpolación de ángulos usando damp()
// lambda: higher = faster convergence (típico 5-30)
function dampAngleWrapped(current, target, lambda, dt) {
  const TAU = Math.PI * 2
  let delta = ((target - current + Math.PI) % TAU) - Math.PI
  // damp formula: current + (target - current) * (1 - exp(-lambda * dt))
  // pero aquí target-current = delta (ya normalizado)
  return current + delta * (1 - Math.exp(-lambda * dt))
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
export default function Player({
  playerRef,
  portals = [],
  onPortalEnter,
  onProximityChange,
  onPortalsProximityChange,
  onNearPortalChange,
  navigateToPortalId = null,
  onReachedPortal,
  onOrbStateChange,
  onHomeSplash,
  onHomeFallStart,
  onCharacterReady,
  sceneColor,
  onMoveStateChange,
  onPulse,
  onActionCooldown,
  eggActive = false,
  // Prewarm: permite montar el Player durante preloader (cargar CPU/JS) sin dibujarlo ni correr lógica por-frame
  prewarm = false,
  visible = true,
}) {
  // Desarmado (easter egg) DESHABILITADO por workaround: causaba estados intermitentes de materiales/visibilidad.
  // Workaround nuevo: FX de “fragmentos” (instanced) + hide breve del personaje (sin reparent, sin tocar materiales).
  const DISASSEMBLE_ENABLED = false
  // Load the GLB character; preloading ensures the asset is cached when
  // imported elsewhere.  The model contains two animations: idle and walk.
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
        // Mantener la versión del transcoder alineada a la versión de three instalada
        ktx2.setTranscoderPath(`https://unpkg.com/three@${threeBasisVersion}/examples/jsm/libs/basis/`)
        if (gl) {
          // r180+ moderniza init/feature detection: si init existe, esperar a que termine
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
  const { actions, mixer } = useAnimations(animations, scene)
  const walkDurationRef = useRef(1)
  const idleDurationRef = useRef(1)
  const { camera } = useThree()
  // Anchor (head) para viñeta en mundo 3D
  const headObjRef = useRef(null)
  // Evitar "blancos" / quemado: NO forzar emissive en todo el modelo.
  // Sólo tocamos materiales que ya traen emissive (color no negro) o emissiveMap.
  const glowEmissiveColor = useMemo(() => new THREE.Color('#ffd480'), [])
  const emissiveBaseRef = useRef(new WeakMap())
  const shouldTouchEmissive = useCallback((m) => {
    try {
      if (!m || !m.emissive) return false
      if (m.emissiveMap) return true
      const c = m.emissive
      return (c?.r + c?.g + c?.b) > 1e-3
    } catch {
      return false
    }
  }, [])
  // IMPORTANTE: NO “boostear” emissive globalmente. El GLB se cachea por useGLTF y los materiales
  // pueden compartirse entre Player y CharacterPortrait; mutarlos aquí hace que “todos los personajes” brillen.
  // Solo capturamos base para posibles efectos locales (sin tocar el look por defecto).
  const seedEmissiveBase = useCallback((m) => {
    try {
      if (!m || !m.emissive) return
      const map = emissiveBaseRef.current
      if (map.get(m)) return
      map.set(m, {
        color: m.emissive?.clone?.() || new THREE.Color(0, 0, 0),
        intensity: typeof m.emissiveIntensity === 'number' ? m.emissiveIntensity : 1,
      })
    } catch {}
  }, [])

  // Clonar materiales por instancia del Player para evitar “cross‑bleed” con otros usos del mismo GLB (cache).
  const clonedMaterialsOnceRef = useRef(false)
  useEffect(() => {
    if (!scene) return
    if (clonedMaterialsOnceRef.current) return
    clonedMaterialsOnceRef.current = true
    try {
      scene.traverse((obj) => {
        // @ts-ignore
        if (!obj || (!obj.isMesh && !obj.isSkinnedMesh) || !obj.material) return
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        const cloned = mats.map((m) => {
          try {
            const mm = (m && m.isMaterial && typeof m.clone === 'function') ? m.clone() : m
            // preservar skinning si aplica
            // @ts-ignore
            if (obj.isSkinnedMesh && mm && mm.isMaterial && 'skinning' in mm) mm.skinning = true
            // capturar base emissive sin mutar
            try { seedEmissiveBase(mm) } catch {}
            return mm
          } catch {
            return m
          }
        })
        // @ts-ignore
        obj.material = Array.isArray(obj.material) ? cloned : cloned[0]
      })
    } catch {}
  }, [scene, seedEmissiveBase])

  // ----------------------------
  // Workaround: “Voxel Shatter + Rebuild” (nivel videojuego, sin tocar rig/modelo)
  // ----------------------------
  const EGG_VOXEL_MAX = 620
  const EGG_VOXEL_SCALE_BASE = 0.06
  const EGG_VOXEL_SCALE_RAND = 0.07
  // Randomness del “boom” (para que no se vea siempre igual)
  const EGG_VOXEL_EXPLODE_RAND_DIR = 0.88 // 0..1 mezcla hacia dirección aleatoria
  const EGG_VOXEL_EXPLODE_UP_BIAS = 0.55  // 0..1 sesgo hacia arriba (spray cone)
  // Timings del FX (usar un solo source-of-truth para que el fallback no corte la animación)
  // Timings más rápidos (si se siente “no termina”, suele ser por duración excesiva percibida)
  const EGG_VOXEL_EXPLODE_S = 0.65
  const EGG_VOXEL_DRIFT_S = 0.45
  const EGG_VOXEL_REBUILD_S = 1.15
  // After-snap cinematográfico: primero hold (full assembled), luego dissolve + reveal del modelo
  const EGG_VOXEL_DONE_HOLD_S = 0.22
  const EGG_VOXEL_DONE_S = 0.78
  const EGG_VOXEL_DONE_REVEAL_DELAY_S = 0.05
  const EGG_VOXEL_DONE_REVEAL_S = 0.45
  const EGG_VOXEL_FALLBACK_MS = Math.ceil(
    (EGG_VOXEL_EXPLODE_S + EGG_VOXEL_DRIFT_S + EGG_VOXEL_REBUILD_S + EGG_VOXEL_DONE_S + 0.8) * 1000,
  )
  const eggVoxelRef = useRef(null)
  const eggVoxelMatRef = useRef(null)
  const eggVoxelInitRef = useRef(false)
  const eggVoxelActiveRef = useRef(false)
  const eggVoxelPhaseRef = useRef('idle') // 'idle' | 'explode' | 'drift' | 'rebuild' | 'done'
  const eggVoxelTRef = useRef(0)
  // IMPORTANTE: evitamos un setTimeout de “fallback” que pueda cortar la animación cuando la pestaña se pausa.
  // Para garantizar que SIEMPRE termine, dependemos solo del timeline del useFrame.
  const eggVoxelHideTimerRef = useRef(null)
  // piezas: {pos, vel, rot, ang, scale, target}
  const eggVoxelPiecesRef = useRef([])
  // Freeze de movimiento mientras el cuerpo no está rearmado
  const eggFreezeActiveRef = useRef(false)
  const eggFreezePosRef = useRef(new THREE.Vector3())
  // Lock duro de visibilidad: mientras esté activo, el modelo NO debe aparecer (aunque otros flows llamen applyModelOpacity(1))
  const eggHideLockRef = useRef(false)
  // Forzar ocultar al personaje hasta que empiece el reveal (evita “aparece antes de armarse”)
  const eggHideForceRef = useRef(false)
  // Si el easter egg termina mientras el FX está corriendo, NO interrumpir: dejar que termine y luego restaurar.
  const eggEndRequestedRef = useRef(false)

  const eggVoxelGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const eggVoxelMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 2.2,
      roughness: 0.55,
      metalness: 0,
      transparent: true,
      opacity: 0,
    })
    m.toneMapped = false
    try { m.depthWrite = false } catch {}
    return m
  }, [])

  const buildVoxelTargetsProcedural = useCallback((N) => {
    // Fallback: humanoide procedural (en espacio local del jugador)
    const out = []
    const pushBox = (cx, cy, cz, sx, sy, sz, count) => {
      for (let i = 0; i < count; i += 1) {
        out.push(new THREE.Vector3(
          cx + (Math.random() - 0.5) * sx,
          cy + (Math.random() - 0.5) * sy,
          cz + (Math.random() - 0.5) * sz,
        ))
      }
    }
    const pushSphere = (cx, cy, cz, r, count) => {
      for (let i = 0; i < count; i += 1) {
        const u = Math.random()
        const v = Math.random()
        const th = 2 * Math.PI * u
        const ph = Math.acos(2 * v - 1)
        const rr = r * Math.cbrt(Math.random())
        out.push(new THREE.Vector3(
          cx + rr * Math.sin(ph) * Math.cos(th),
          cy + rr * Math.cos(ph),
          cz + rr * Math.sin(ph) * Math.sin(th),
        ))
      }
    }
    const headC = Math.floor(N * 0.16)
    const torsoC = Math.floor(N * 0.30)
    const armC = Math.floor(N * 0.18)
    const legC = Math.floor(N * 0.26)
    const extra = Math.max(0, N - (headC + torsoC + armC + legC))
    pushBox(0, 1.05, 0, 0.55, 0.75, 0.35, torsoC)
    pushSphere(0, 1.72, 0, 0.26, headC)
    pushBox(-0.42, 1.15, 0, 0.32, 0.55, 0.30, Math.floor(armC * 0.5))
    pushBox(0.42, 1.15, 0, 0.32, 0.55, 0.30, Math.floor(armC * 0.5))
    pushBox(-0.18, 0.42, 0, 0.26, 0.85, 0.30, Math.floor(legC * 0.5))
    pushBox(0.18, 0.42, 0, 0.26, 0.85, 0.30, Math.floor(legC * 0.5))
    pushBox(0, 1.05, 0, 0.95, 0.95, 0.95, extra)
    return out.slice(0, N)
  }, [])

  const buildVoxelTargetsFromBones = useCallback((N) => {
    // Preferido: targets basados en huesos reales del rig (en espacio local del player).
    // Esto hace que la reconstrucción coincida con el tamaño real del avatar.
    const out = []
    const p = playerRef?.current
    if (!scene || !p) return null
    try {
      p.updateMatrixWorld?.(true)
      scene.updateMatrixWorld?.(true)
    } catch {}
    const bones = []
    const wp = new THREE.Vector3()
    try {
      scene.traverse((o) => {
        if (!o || !o.isBone) return
        bones.push(o)
      })
    } catch {}
    if (bones.length < 6) return null

    // Cache de posiciones de huesos en local del player
    const boneLocal = []
    for (let i = 0; i < bones.length; i += 1) {
      try {
        bones[i].getWorldPosition(wp)
        const lp = wp.clone()
        p.worldToLocal(lp)
        // ignorar huesos absurdos
        if (Number.isFinite(lp.x) && Number.isFinite(lp.y) && Number.isFinite(lp.z)) boneLocal.push(lp)
      } catch {}
    }
    if (boneLocal.length < 6) return null

    // Jitter por voxel alrededor del hueso (para “volumen”)
    const jitterR = 0.09
    const randSphere = () => {
      const u = Math.random()
      const v = Math.random()
      const th = 2 * Math.PI * u
      const ph = Math.acos(2 * v - 1)
      const rr = jitterR * Math.cbrt(Math.random())
      return new THREE.Vector3(
        rr * Math.sin(ph) * Math.cos(th),
        rr * Math.cos(ph),
        rr * Math.sin(ph) * Math.sin(th),
      )
    }
    for (let i = 0; i < N; i += 1) {
      const b = boneLocal[Math.floor(Math.random() * boneLocal.length)]
      out.push(b.clone().add(randSphere()))
    }
    return out
  }, [scene, playerRef])

  // Init una sola vez: material ref + matrices offscreen + DynamicDrawUsage
  useEffect(() => {
    try { eggVoxelMatRef.current = eggVoxelMat } catch {}
    const mesh = eggVoxelRef.current
    if (!mesh || eggVoxelInitRef.current) return
    eggVoxelInitRef.current = true
    try { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage) } catch {}
    try {
      const dummy = new THREE.Object3D()
      for (let i = 0; i < EGG_VOXEL_MAX; i += 1) {
        dummy.position.set(0, -9999, 0)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(0.0001)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    } catch {}
  }, [eggVoxelMat])

  const startEggVoxelFx = useCallback(() => {
    const mesh = eggVoxelRef.current
    if (!mesh) return
    // Congelar el player donde está (no caminar mientras se des/arma)
    try {
      if (playerRef?.current?.position) eggFreezePosRef.current.copy(playerRef.current.position)
      eggFreezeActiveRef.current = true
      eggHideLockRef.current = true
      eggHideForceRef.current = true
    } catch {}
    const N = EGG_VOXEL_MAX
    const targets = buildVoxelTargetsFromBones(N) || buildVoxelTargetsProcedural(N)
    const pieces = []
    // Random global “burst” por activación para que el patrón nunca se repita igual
    const burstQ = new THREE.Quaternion()
    try {
      const yaw = Math.random() * Math.PI * 2
      const tilt = (Math.random() - 0.5) * 0.7
      burstQ.setFromEuler(new THREE.Euler(tilt, yaw, 0))
    } catch { burstQ.identity() }
    const tmpV = new THREE.Vector3()
    const tmpAxis = new THREE.Vector3()
    // Spawn: ya “ensamblado” y luego explota
    for (let i = 0; i < N; i += 1) {
      const target = targets[i] || new THREE.Vector3(0, 1, 0)
      const pos = target.clone()
      // impulso radial desde centro del torso
      const center = new THREE.Vector3(0, 1.05, 0)
      const radial = pos.clone().sub(center).applyQuaternion(burstQ)
      if (radial.lengthSq() < 1e-6) radial.set(0, 0.5, 1)
      radial.normalize()
      // dirección aleatoria (con bias hacia arriba para look “explosión”)
      const r = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5)
      if (r.lengthSq() < 1e-6) r.set(0, 1, 0)
      r.normalize()
      r.y = THREE.MathUtils.lerp(r.y, Math.abs(r.y), EGG_VOXEL_EXPLODE_UP_BIAS)
      r.applyQuaternion(burstQ).normalize()
      // mezclar radial + random para que no sea siempre simétrico
      const mixK = THREE.MathUtils.clamp(EGG_VOXEL_EXPLODE_RAND_DIR + (Math.random() - 0.5) * 0.25, 0, 1)
      const dir = radial.clone().lerp(r, mixK).normalize()
      // jitter extra por voxel (pequeño) para romper “bandas” en el mismo ángulo
      try {
        tmpAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        if (tmpAxis.lengthSq() > 1e-6) {
          tmpAxis.normalize()
          const ang = (Math.random() - 0.5) * 0.55
          tmpV.copy(dir).applyAxisAngle(tmpAxis, ang).normalize()
          dir.copy(tmpV)
        }
      } catch {}
      // velocidad variable (con algo de spread)
      // bias a velocidades medias/altas, con algunos “slow bits”
      const u = Math.random()
      const speed = 2.6 + Math.pow(u, 0.55) * 5.2
      const vel = dir.multiplyScalar(speed)
      vel.y += 1.6 + Math.random() * 1.8
      // rotación/ang
      const rot = new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      const ang = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10)
      const scale = EGG_VOXEL_SCALE_BASE + Math.random() * EGG_VOXEL_SCALE_RAND
      pieces.push({ pos, vel, rot, ang, scale, target })
    }
    eggVoxelPiecesRef.current = pieces
    eggVoxelActiveRef.current = true
    eggVoxelPhaseRef.current = 'explode'
    eggVoxelTRef.current = 0
    try {
      if (eggVoxelMatRef.current) {
        eggVoxelMatRef.current.opacity = 0.95
        eggVoxelMatRef.current.needsUpdate = true
      }
    } catch {}
  }, [
    EGG_VOXEL_SCALE_BASE,
    EGG_VOXEL_SCALE_RAND,
    buildVoxelTargetsFromBones,
    buildVoxelTargetsProcedural,
    playerRef,
    EGG_VOXEL_EXPLODE_RAND_DIR,
    EGG_VOXEL_EXPLODE_UP_BIAS,
  ])

  const stopEggVoxelFx = useCallback(() => {
    eggVoxelActiveRef.current = false
    eggVoxelPhaseRef.current = 'idle'
    eggVoxelTRef.current = 0
    eggVoxelPiecesRef.current = []
    eggFreezeActiveRef.current = false
    eggHideLockRef.current = false
    eggHideForceRef.current = false
    eggEndRequestedRef.current = false
    try {
      if (eggVoxelMatRef.current) {
        eggVoxelMatRef.current.opacity = 0
        eggVoxelMatRef.current.needsUpdate = true
      }
    } catch {}
  }, [])
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
  // Fixed timestep para movimiento + animación (determinista y sin “speed wobble” en dev)
  const FIXED_DT = 1 / 60
  const simAccRef = useRef(0)
  const simInitRef = useRef(false)
  const simPosRef = useRef(new THREE.Vector3())
  const simPrevPosRef = useRef(new THREE.Vector3())
  const simYawRef = useRef(0)
  const simPrevYawRef = useRef(0)
  const simWasOrbRef = useRef(false)
  // Suavizado del joystick (mobile): evita cambios bruscos de dirección
  const joyMoveRef = useRef(new THREE.Vector3(0, 0, 0))
  // Cuando el usuario rota la cámara mientras mantiene joystick, bloquear base de movimiento
  // para evitar “brincos”/cambios bruscos de dirección.
  const joyBasisLockedRef = useRef(false)
  const joyBasisForwardRef = useRef(new THREE.Vector3())
  const joyBasisRightRef = useRef(new THREE.Vector3())
  // Reusar temporales para evitar GC spikes (caminata “laggy” intermitente)
  const tmpRef = useRef({
    up: new THREE.Vector3(0, 1, 0),
    camForward: new THREE.Vector3(),
    camRight: new THREE.Vector3(),
    desiredDir: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    portalPos: new THREE.Vector3(),
    renderPos: new THREE.Vector3(),
    deltaPos: new THREE.Vector3(),
    joyTarget: new THREE.Vector3(),
  })

  // CRÍTICO: useAnimations (drei) avanza el mixer con `delta` real.
  // Para eliminar acelerones/variaciones por spikes, lo “congelamos” antes del frame de drei
  // y lo avanzamos manualmente con nuestro dt estable dentro del loop principal.
  useFrame(() => {
    try { if (mixer) mixer.timeScale = 0 } catch {}
  }, -1000)
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

  // Scheduler de viñetas: usa frases i18n existentes (portrait.phrases)
  // Se pausa en modo orbe para evitar viñeta flotando sin personaje.
  const bubble = useSpeechBubbles({
    enabled: !orbActive,
    phrasesKey: 'portrait.phrases',
    typingCps: 14,
    firstDelayMs: 350,
    delayMinMs: 2200,
    delayRandMs: 2600,
  })

  // Anchor robusto para la viñeta: preferir huesos (Head/Neck) y NO el mesh (que suele estar en (0,0,0)).
  const bubbleAnchorRef = useRef(null)
  const bubbleFallbackObjRef = useRef(new THREE.Object3D())
  useEffect(() => {
    // Fallback: un empty pegado al jugador, arriba del torso.
    const p = playerRef?.current
    const fallback = bubbleFallbackObjRef.current
    if (!p || !fallback) return
    try {
      if (!fallback.parent) p.add(fallback)
      fallback.position.set(0, 1.85, 0)
      fallback.updateMatrixWorld(true)
      if (!bubbleAnchorRef.current) bubbleAnchorRef.current = fallback
    } catch {}
  }, [playerRef])

  useEffect(() => {
    if (!scene) return
    let best = null
    let bestY = -Infinity
    const tmpP = new THREE.Vector3()
    const preferRe = /(mixamorig.*head|head|neck)/i
    try {
      scene.traverse((o) => {
        if (!o) return
        // Preferir huesos (isBone) para que el punto siga la animación.
        const isBone = !!o.isBone
        if (!isBone) return
        const n = (o?.name || '').toString()
        if (!n) return
        if (!preferRe.test(n)) return
        try { o.getWorldPosition(tmpP) } catch { return }
        if (tmpP.y > bestY) { bestY = tmpP.y; best = o }
      })
    } catch {}
    // Fallback: si no encontramos bone por nombre, elegir el bone más alto
    if (!best) {
      try {
        scene.traverse((o) => {
          if (!o || !o.isBone) return
          try { o.getWorldPosition(tmpP) } catch { return }
          if (tmpP.y > bestY) { bestY = tmpP.y; best = o }
        })
      } catch {}
    }
    headObjRef.current = best
    bubbleAnchorRef.current = best || bubbleFallbackObjRef.current || null
  }, [scene])

  // Preload básicos de sfx una vez
  useEffect(() => {
    preloadSfx(['magiaInicia', 'sparkleBom', 'sparkleFall', 'stepone', 'steptwo'])
  }, [])

  // Simple crossfade: fadeOut when starting orb, fadeIn when finishing
  const fadeOutTRef = useRef(0)
  const fadeInTRef = useRef(1) // Empieza en 1 para que el personaje sea opaco desde el inicio
  const showOrbRef = useRef(false)
  const FADE_OUT = 0.06
  const FADE_IN = 0.06
  // Preservar/restaurar flags originales de materiales al hacer fades.
  // Problema que vimos: algunos meshes “glow” (mano) suelen depender de transparent/blending/depthWrite=false.
  // Si los forzamos a transparent=false y depthWrite=true al volver a opacity=1, pueden “desaparecer”.
  const materialBaseRef = useRef(new WeakMap()) // material -> { transparent, opacity, depthWrite }

  const rememberMaterialBase = useCallback((m) => {
    try {
      if (!m || !m.isMaterial) return null
      const map = materialBaseRef.current
      let base = map.get(m)
      if (!base) {
        base = {
          transparent: !!m.transparent,
          opacity: (typeof m.opacity === 'number' ? m.opacity : 1),
          depthWrite: (typeof m.depthWrite === 'boolean' ? m.depthWrite : true),
        }
        map.set(m, base)
      }
      return base
    } catch {
      return null
    }
  }, [])

  // Seed de materialBaseRef: capturar el estado “real” del modelo al cargar, antes de cualquier fade.
  // Evita el bug intermitente donde el primer snapshot se toma ya con opacity=0 y luego nunca se recupera.
  useEffect(() => {
    if (!scene) return
    try {
      scene.traverse((obj) => {
        // @ts-ignore
        if (!obj || !obj.material) return
        // @ts-ignore
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => { try { rememberMaterialBase(m) } catch {} })
      })
    } catch {}
  }, [scene, rememberMaterialBase])

  const applyModelOpacity = (opacity) => {
    try {
      scene.traverse((obj) => {
        // @ts-ignore
        if (obj.material) {
          const m = obj.material
          if (Array.isArray(m)) {
            m.forEach((mm) => {
              const base = rememberMaterialBase(mm)
              if (!base) return
              if (opacity >= 1) {
                // Restaurar flags originales (crítico para materiales emissive/transparencia)
                mm.transparent = base.transparent
                mm.opacity = base.opacity
                mm.depthWrite = base.depthWrite
              } else {
                // Fade: mantener transparencia para permitir interpolación
                mm.transparent = true
                mm.opacity = base.opacity * opacity
                // evitar recortes/artefactos al hacer fade, pero respetar materiales que ya no escriben depth (glows)
                mm.depthWrite = false
              }
            })
          } else {
            const base = rememberMaterialBase(m)
            if (base) {
              if (opacity >= 1) {
                m.transparent = base.transparent
                m.opacity = base.opacity
                m.depthWrite = base.depthWrite
              } else {
                m.transparent = true
                m.opacity = base.opacity * opacity
                m.depthWrite = false
              }
            }
          }
        }
      })
    } catch {}
  }

  // ----------------------------
  // Easter egg: desarme del personaje (SIN segundo modelo)
  // Approach: bake de SkinnedMesh a meshes rígidas en runtime.
  // ----------------------------
  const modelRootRef = useRef(null) // wrapper (mismo scale que el modelo)
  const piecesRootRef = useRef(null) // donde montamos meshes rígidas
  const disassembleActiveRef = useRef(false)
  const eggActiveRef = useRef(false)
  const disassembleRef = useRef({
    phase: 'idle', // 'idle' | 'fall' | 'assemble'
    t: 0,
    floorDelayS: 0.6,
    floorLocalY: 0,
    fallS: 2.2,
    assembleS: 1.05,
    holdExternal: false, // usado por easter egg (mantener en el piso hasta que termine)
    maxDelayS: 0, // para sincronizar fin de caída cuando hay stagger
    pieces: [],
    detached: [], // [{ obj, parent }]
  })
  const disassembleDebugRef = useRef({
    enabled: false,
    hold: false, // no pasar a assemble/cleanup
    normalMaterial: false, // forzar MeshNormalMaterial para visibilidad
    noDepthTest: false, // render por encima
    axes: false, // mostrar ejes en el root de piezas
    proxy: false, // reemplazar cada pieza por una caja (debug de geometría)
    wire: false, // wireframe unlit para confirmar tris
  })

  const readDisassembleDebugFlags = useCallback(() => {
    // Flags via localStorage para poder activarlas sin redeploy:
    // - player_disassemble_debug=1
    // - player_disassemble_hold=1
    // - player_disassemble_normal=1
    // - player_disassemble_nodepth=1
    // - player_disassemble_axes=1
    // - player_disassemble_proxy=1
    // - player_disassemble_wire=1
    const get = (k) => {
      try { return (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem(k) : null } catch { return null }
    }
    const enabled = get('player_disassemble_debug') === '1'
    disassembleDebugRef.current.enabled = enabled
    // Estos flags NO dependen de enabled (queremos que funcionen aunque no haya logging)
    disassembleDebugRef.current.hold = get('player_disassemble_hold') === '1'
    disassembleDebugRef.current.normalMaterial = get('player_disassemble_normal') === '1'
    disassembleDebugRef.current.noDepthTest = get('player_disassemble_nodepth') === '1'
    disassembleDebugRef.current.axes = get('player_disassemble_axes') === '1'
    disassembleDebugRef.current.proxy = get('player_disassemble_proxy') === '1'
    disassembleDebugRef.current.wire = get('player_disassemble_wire') === '1'
    return { ...disassembleDebugRef.current }
  }, [])

  const snapshotDisassemble = useCallback(() => {
    try {
      const dis = disassembleRef.current
      const pieces = dis.pieces || []
      const root = modelRootRef.current
      const out = {
        active: !!disassembleActiveRef.current,
        phase: dis.phase,
        t: dis.t,
        pieces: pieces.length,
        floorLocalY: dis.floorLocalY,
        playerWorld: null,
        cameraWorld: null,
        piecesChildren: 0,
        sampleLocal: null,
        sampleScale: null,
        uniquePos: 0,
        min: { x: Infinity, y: Infinity, z: Infinity },
        max: { x: -Infinity, y: -Infinity, z: -Infinity },
        sampleWorld: null,
      }
      try {
        if (playerRef?.current) {
          const pw = new THREE.Vector3()
          playerRef.current.getWorldPosition(pw)
          out.playerWorld = { x: pw.x, y: pw.y, z: pw.z }
        }
      } catch {}
      try {
        if (camera) {
          const cw = new THREE.Vector3()
          camera.getWorldPosition(cw)
          out.cameraWorld = { x: cw.x, y: cw.y, z: cw.z }
        }
      } catch {}
      if (!root) return out
      try { out.piecesChildren = piecesRootRef.current?.children?.length || 0 } catch {}
      const wp = new THREE.Vector3()
      const min = new THREE.Vector3(Infinity, Infinity, Infinity)
      const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
      const rootMW = root.matrixWorld
      const uniq = new Set()
      for (let i = 0; i < pieces.length; i += 1) {
        const m = pieces[i]?.mesh
        if (!m) continue
        if (!out.sampleLocal) out.sampleLocal = { x: m.position.x, y: m.position.y, z: m.position.z }
        if (!out.sampleScale) out.sampleScale = { x: m.scale.x, y: m.scale.y, z: m.scale.z }
        wp.copy(m.position).applyMatrix4(rootMW)
        min.min(wp)
        max.max(wp)
        if (!out.sampleWorld) out.sampleWorld = { x: wp.x, y: wp.y, z: wp.z }
        // quantize a 2cm to detect overlap
        const qx = Math.round(wp.x * 50)
        const qy = Math.round(wp.y * 50)
        const qz = Math.round(wp.z * 50)
        uniq.add(`${qx},${qy},${qz}`)
      }
      out.uniquePos = uniq.size
      out.min = { x: min.x, y: min.y, z: min.z }
      out.max = { x: max.x, y: max.y, z: max.z }
      return out
    } catch {
      return { active: false, phase: 'idle', t: 0, pieces: 0 }
    }
  }, [])

  // Exponer helpers para debug desde consola (NO puede referenciar startDisassemble aquí; TDZ).
  // El trigger directo se engancha más abajo, después de declarar startDisassemble.
  useEffect(() => {
    try {
      // @ts-ignore
      window.__playerDisassemble = {
        snapshot: () => snapshotDisassemble(),
        flags: () => readDisassembleDebugFlags(),
        // Trigger seguro por evento (siempre disponible)
        trigger: () => { try { window.dispatchEvent(new Event('player-disassemble')) } catch {} },
        stats: () => {
          try {
            // @ts-ignore
            return window.__playerDisassembleMeshStats || null
          } catch {
            return null
          }
        },
        lastFail: () => {
          try {
            // @ts-ignore
            return window.__playerDisassembleLastFailReason || null
          } catch {
            return null
          }
        },
      }
    } catch {}
  }, [readDisassembleDebugFlags, snapshotDisassemble])

  const createRigidMaterial = useCallback((src) => {
    try {
      if (!src) return new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff') })
      if (Array.isArray(src)) return src.map((m) => createRigidMaterial(m))
      const m = src
      // Preferir clonar el material original para mantener el look (toon, etc.)
      if (m && m.isMaterial && typeof m.clone === 'function') {
        const out = m.clone()
        // Quitar flags de skinning/morph del shader
        try { if ('skinning' in out) out.skinning = false } catch {}
        try { if ('morphTargets' in out) out.morphTargets = false } catch {}
        try { if ('morphNormals' in out) out.morphNormals = false } catch {}
        // Forzar opaco/visible
        try { out.transparent = false } catch {}
        try { out.opacity = 1 } catch {}
        try { out.depthWrite = true } catch {}
        try { out.depthTest = true } catch {}
        try { out.colorWrite = true } catch {}
        try { out.side = THREE.DoubleSide } catch {}
        try { out.needsUpdate = true } catch {}
        return out
      }
      // Fallback conservador
      const out = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff') })
      out.transparent = false
      out.opacity = 1
      out.depthWrite = true
      out.depthTest = true
      out.colorWrite = true
      out.side = THREE.DoubleSide
      return out
    } catch {
      return new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff') })
    }
  }, [])

  const bakeSkinnedGeometry = useCallback((skinnedMesh) => {
    const srcGeo = skinnedMesh.geometry
    const geo = srcGeo.clone()
    const pos = geo.attributes.position
    if (!pos) return geo
    const tmpV = new THREE.Vector3()
    for (let i = 0; i < pos.count; i += 1) {
      tmpV.fromBufferAttribute(pos, i)
      // boneTransform escribe el vertex ya "skinned" en el espacio local del mesh
      skinnedMesh.boneTransform(i, tmpV)
      pos.setXYZ(i, tmpV.x, tmpV.y, tmpV.z)
    }
    pos.needsUpdate = true
    try { geo.computeVertexNormals() } catch {}
    try { geo.computeBoundingSphere() } catch {}
    try { geo.computeBoundingBox() } catch {}
    return geo
  }, [])

  const getEggTagFromAncestors = useCallback((obj) => {
    try {
      let p = obj
      let hops = 0
      // Nota: en rigs complejos el mesh puede estar a >10 niveles del group Egg_.
      while (p && hops < 30) {
        const pn = (p?.name || '').toString()
        // Aceptar prefijo y también "contains" por si el export agrega prefijos/sufijos.
        if (pn && (pn.startsWith('Egg_') || pn.includes('Egg_'))) return pn
        p = p.parent
        hops += 1
      }
    } catch {}
    return ''
  }, [])

  const collectAuthoredRigidPieces = useCallback((root) => {
    // Soporte para un approach más robusto: piezas rígidas ya horneadas en Blender,
    // exportadas DENTRO del mismo character.glb.
    // Convención: nombres con prefijo "Rigid_" o parent que contenga "RigidPieces".
    const out = []
    try {
      root?.traverse?.((o) => {
        // @ts-ignore
        if (!o || !o.isMesh) return
        // @ts-ignore
        if (o.isSkinnedMesh) return
        const n = (o.name || '').toString()
        const pn = (o.parent?.name || '').toString()
        const isTagged =
          n.startsWith('Rigid_') ||
          n.includes('Rigid_') ||
          pn.includes('RigidPieces') ||
          pn.includes('Rigid_Pieces') ||
          pn.includes('RigidPieces_')
        if (!isTagged) return
        // @ts-ignore
        if (!o.geometry || !o.material) return
        out.push(o)
      })
    } catch {}
    return out
  }, [])

  const splitGeometryByGroupsOrIslands = useCallback((geo, material) => {
    // Devuelve: [{ geo, materialIndex }]
    // - Si hay grupos, se respeta materialIndex (multi-material)
    // - Si no, intenta separar por islas (componentes desconectados)
    try {
      const out = []
      const groups = Array.isArray(geo?.groups) ? geo.groups : []
      const hasIndex = !!geo?.index?.array

      const pushSubset = (subsetGeo, materialIndex = 0) => {
        out.push({ geo: subsetGeo, materialIndex })
      }

      // Helper: extraer subset por índices (remapeando vértices usados)
      const buildSubsetFromIndexArray = (srcGeo, subsetIndexArray) => {
        const srcIndex = subsetIndexArray
        const attrs = srcGeo.attributes || {}
        const map = new Map() // oldIdx -> newIdx
        const newIndices = new (srcIndex.constructor)(srcIndex.length)
        let newCount = 0

        for (let i = 0; i < srcIndex.length; i += 1) {
          const oldV = srcIndex[i]
          let nv = map.get(oldV)
          if (nv === undefined) {
            nv = newCount
            map.set(oldV, newCount)
            newCount += 1
          }
          newIndices[i] = nv
        }

        const dst = new THREE.BufferGeometry()
        // Copiar atributos usados
        Object.keys(attrs).forEach((k) => {
          const a = attrs[k]
          if (!a || !a.array || typeof a.itemSize !== 'number') return
          const itemSize = a.itemSize
          const ArrayCtor = a.array.constructor
          const newArr = new ArrayCtor(newCount * itemSize)
          const tmp = []
          for (let i = 0; i < itemSize; i += 1) tmp.push(0)
          for (const [oldIdx, newIdx] of map.entries()) {
            const srcOff = oldIdx * itemSize
            const dstOff = newIdx * itemSize
            for (let j = 0; j < itemSize; j += 1) newArr[dstOff + j] = a.array[srcOff + j]
          }
          const na = new THREE.BufferAttribute(newArr, itemSize, a.normalized)
          dst.setAttribute(k, na)
        })
        dst.setIndex(new THREE.BufferAttribute(newIndices, 1))
        try { dst.computeBoundingSphere() } catch {}
        try { dst.computeBoundingBox() } catch {}
        // Normales: si ya vienen, ok; si no, recomputar
        if (!dst.getAttribute('normal')) {
          try { dst.computeVertexNormals() } catch {}
        }
        return dst
      }

      // Helper: particionar triángulos en chunks por centroid (evita "piezas = 1 tri" por seams)
      const chunkByCentroid = (srcGeo, chunkCount = 14) => {
        try {
          if (!srcGeo?.index?.array) return [{ geo: srcGeo, materialIndex: 0 }]
          const idx = srcGeo.index.array
          const pos = srcGeo.getAttribute('position')
          if (!pos || pos.count < 3) return [{ geo: srcGeo, materialIndex: 0 }]
          const triCount = Math.floor(idx.length / 3)
          if (triCount < 120) return [{ geo: srcGeo, materialIndex: 0 }]

          // Elegir eje principal por extensión bbox
          let axis = 0 // 0=x,1=y,2=z
          try {
            srcGeo.computeBoundingBox()
            const bb = srcGeo.boundingBox
            if (bb) {
              const sx = bb.max.x - bb.min.x
              const sy = bb.max.y - bb.min.y
              const sz = bb.max.z - bb.min.z
              axis = sy > sx && sy > sz ? 1 : (sz > sx && sz > sy ? 2 : 0)
            }
          } catch {}

          const v0 = new THREE.Vector3()
          const v1 = new THREE.Vector3()
          const v2 = new THREE.Vector3()
          const tris = new Array(triCount)
          for (let t = 0; t < triCount; t += 1) {
            const a = idx[t * 3 + 0]
            const b = idx[t * 3 + 1]
            const c = idx[t * 3 + 2]
            v0.fromBufferAttribute(pos, a)
            v1.fromBufferAttribute(pos, b)
            v2.fromBufferAttribute(pos, c)
            const cx = (v0.x + v1.x + v2.x) / 3
            const cy = (v0.y + v1.y + v2.y) / 3
            const cz = (v0.z + v1.z + v2.z) / 3
            const key = axis === 0 ? cx : (axis === 1 ? cy : cz)
            tris[t] = { t, key }
          }
          tris.sort((p, q) => p.key - q.key)

          const chunks = Math.max(2, Math.min(chunkCount, Math.floor(triCount / 220)))
          const per = Math.ceil(triCount / chunks)
          const res = []
          for (let ci = 0; ci < chunks; ci += 1) {
            const start = ci * per
            const end = Math.min(triCount, start + per)
            if (end - start < 1) continue
            const sub = new (idx.constructor)((end - start) * 3)
            for (let i = start; i < end; i += 1) {
              const tt = tris[i].t
              sub[(i - start) * 3 + 0] = idx[tt * 3 + 0]
              sub[(i - start) * 3 + 1] = idx[tt * 3 + 1]
              sub[(i - start) * 3 + 2] = idx[tt * 3 + 2]
            }
            const subset = buildSubsetFromIndexArray(srcGeo, sub)
            res.push({ geo: subset, materialIndex: 0 })
          }
          return res.length ? res : [{ geo: srcGeo, materialIndex: 0 }]
        } catch {
          return [{ geo: srcGeo, materialIndex: 0 }]
        }
      }

      // 1) Preferir groups (multi-material o piezas “naturales” del export)
      if (groups.length > 1 && hasIndex) {
        for (let gi = 0; gi < groups.length; gi += 1) {
          const g = groups[gi]
          const start = Math.max(0, g.start | 0)
          const count = Math.max(0, g.count | 0)
          if (count < 3) continue
          const sub = geo.index.array.slice(start, start + count)
          const subset = buildSubsetFromIndexArray(geo, sub)
          pushSubset(subset, typeof g.materialIndex === 'number' ? g.materialIndex : 0)
        }
        if (out.length) return out
      }

      // 2) Si no hay groups, preferir chunks por centroid (piezas "grandes" visibles)
      // Esto evita que seams/duplicación de vértices conviertan la malla en cientos de “islas” minúsculas.
      if (hasIndex) {
        const centroidChunks = chunkByCentroid(geo, 14)
        if (centroidChunks.length > 1) return centroidChunks
      }

      // 3) Si no hay groups, separar por islas (solo si indexado)
      if (!hasIndex) {
        pushSubset(geo, 0)
        return out
      }

      const idx = geo.index.array
      const triCount = Math.floor(idx.length / 3)
      if (triCount < 2) {
        pushSubset(geo, 0)
        return out
      }

      // Union-Find por vértices (islas = componentes desconectados)
      const pos = geo.getAttribute('position')
      const vCount = pos?.count || 0
      if (!vCount) {
        pushSubset(geo, 0)
        return out
      }

      const parent = new Int32Array(vCount)
      for (let i = 0; i < vCount; i += 1) parent[i] = i
      const find = (x) => {
        let r = x
        while (parent[r] !== r) r = parent[r]
        // path compression
        while (parent[x] !== x) {
          const p = parent[x]
          parent[x] = r
          x = p
        }
        return r
      }
      const unite = (a, b) => {
        const ra = find(a)
        const rb = find(b)
        if (ra !== rb) parent[rb] = ra
      }

      for (let t = 0; t < triCount; t += 1) {
        const a = idx[t * 3 + 0]
        const b = idx[t * 3 + 1]
        const c = idx[t * 3 + 2]
        unite(a, b); unite(b, c); unite(c, a)
      }

      const compToTris = new Map()
      for (let t = 0; t < triCount; t += 1) {
        const a = idx[t * 3 + 0]
        const root = find(a)
        let arr = compToTris.get(root)
        if (!arr) {
          arr = []
          compToTris.set(root, arr)
        }
        arr.push(t)
      }

      // Ordenar por tamaño y limitar piezas para evitar explosión de drawcalls
      const comps = Array.from(compToTris.entries())
        .map(([root, tris]) => ({ root, tris, n: tris.length }))
        .sort((x, y) => y.n - x.n)

      const MAX_PIECES = 28
      const MIN_TRIS = 120
      const kept = []
      const spill = []
      for (let i = 0; i < comps.length; i += 1) {
        const c = comps[i]
        if (kept.length < MAX_PIECES && c.n >= MIN_TRIS) kept.push(c)
        else spill.push(c)
      }

      // Si todo fue “chico”, al menos quedarnos con algunas islas grandes
      if (!kept.length) {
        for (let i = 0; i < Math.min(MAX_PIECES, comps.length); i += 1) kept.push(comps[i])
      }

      // Construir geometrías por componente (y merge de spill al último)
      const buildComp = (tris) => {
        const sub = new (idx.constructor)(tris.length * 3)
        for (let i = 0; i < tris.length; i += 1) {
          const t = tris[i]
          sub[i * 3 + 0] = idx[t * 3 + 0]
          sub[i * 3 + 1] = idx[t * 3 + 1]
          sub[i * 3 + 2] = idx[t * 3 + 2]
        }
        return buildSubsetFromIndexArray(geo, sub)
      }

      for (let i = 0; i < kept.length; i += 1) {
        pushSubset(buildComp(kept[i].tris), 0)
      }

      if (spill.length && out.length) {
        // Agregar spill al último para no perder demasiado volumen
        const all = []
        spill.forEach((c) => all.push(...c.tris))
        const merged = buildComp(all)
        out.push({ geo: merged, materialIndex: 0 })
      }

      if (!out.length) pushSubset(geo, 0)
      return out
    } catch {
      return [{ geo, materialIndex: 0 }]
    }
  }, [])

  const clearDisassemblePieces = useCallback(() => {
    const root = piecesRootRef.current
    if (!root) return
    try {
      const disposed = new WeakSet()
      for (let i = root.children.length - 1; i >= 0; i -= 1) {
        const c = root.children[i]
        root.remove(c)
        // Sólo dispose si la geometría/material fueron creados por el efecto (no si son meshes originales "detached")
        const owned = !!c?.userData?.__disassembleOwned
        if (owned) {
          try { c.geometry?.dispose?.() } catch {}
        }
        try {
          const mat = c.material
          if (Array.isArray(mat)) {
            mat.forEach((mm) => {
              if (!mm || disposed.has(mm)) return
              disposed.add(mm)
              if (owned) {
                try { mm.dispose?.() } catch {}
              }
            })
          } else if (mat && !disposed.has(mat)) {
            disposed.add(mat)
            if (owned) {
              try { mat.dispose?.() } catch {}
            }
          }
        } catch {}
      }
    } catch {}
  }, [])

  const hardResetDisassemble = useCallback(() => {
    // Restore any detached meshes (if that mode was enabled)
    try {
      const root = piecesRootRef.current
      if (root) {
        for (let i = root.children.length - 1; i >= 0; i -= 1) {
          const obj = root.children[i]
          const restore = obj?.userData?.__disassembleRestore
          if (!restore?.parent) continue
          try { root.remove(obj) } catch {}
          try { restore.parent.add(obj) } catch {}
          // Restaurar materiales originales (por mesh) si los clonamos para el despiece
          try {
            obj.traverse?.((n) => {
              const m0 = n?.userData?.__disassembleRestoreMaterial
              if (m0) {
                try { n.material = m0 } catch {}
                try { delete n.userData.__disassembleRestoreMaterial } catch {}
              }
            })
          } catch {}
          try { if (restore.material) obj.material = restore.material } catch {}
          try { obj.visible = true } catch {}
          try { delete obj.userData.__disassembleRestore } catch {}
        }
      }
    } catch {}
    // Stop disassemble state and clear owned meshes
    try {
      disassembleActiveRef.current = false
      disassembleRef.current.phase = 'idle'
      disassembleRef.current.t = 0
      disassembleRef.current.holdExternal = false
      disassembleRef.current.maxDelayS = 0
      disassembleRef.current.pieces = []
      disassembleRef.current.detached = []
    } catch {}
    try { clearDisassemblePieces() } catch {}
    // Ensure orb is OFF and character visible
    try { orbActiveRef.current = false } catch {}
    try { showOrbRef.current = false } catch {}
    try { setOrbActive(false) } catch {}
    try { if (typeof onOrbStateChange === 'function') onOrbStateChange(false) } catch {}
    try { applyModelOpacity(1) } catch {}
    try { setCharacterShadowEnabled(true) } catch {}
  }, [applyModelOpacity, clearDisassemblePieces, onOrbStateChange])

  const startDisassemble = useCallback((opts = {}) => {
    // Reset reason
    try {
      // @ts-ignore
      window.__playerDisassembleLastFailReason = null
    } catch {}
    if (disassembleActiveRef.current) {
      try { window.__playerDisassembleLastFailReason = 'already_active' } catch {}
      return false
    }
    if (!scene) {
      try { window.__playerDisassembleLastFailReason = 'no_scene' } catch {}
      return false
    }
    if (!playerRef?.current) {
      try { window.__playerDisassembleLastFailReason = 'no_playerRef_current' } catch {}
      return false
    }
    if (!modelRootRef.current) {
      try { window.__playerDisassembleLastFailReason = 'no_modelRootRef_current' } catch {}
      return false
    }
    if (!piecesRootRef.current) {
      try { window.__playerDisassembleLastFailReason = 'no_piecesRootRef_current' } catch {}
      return false
    }
    // Si el orbe está visible/activo, lo apagamos para que no tape el viewport.
    // (Esto también evita que el usuario confunda el orbe con "una pieza".)
    try {
      if (orbActiveRef.current || showOrbRef.current) {
        orbActiveRef.current = false
        showOrbRef.current = false
        setOrbActive(false)
        try { if (typeof onOrbStateChange === 'function') onOrbStateChange(false) } catch {}
        // Hacer que el humano vuelva a ser el foco (aunque lo ocultamos durante el desarme)
        fadeInTRef.current = 1
        fadeOutTRef.current = 0
      }
    } catch {}

    const dbg = readDisassembleDebugFlags()
    // Forzar visibilidad en easter egg (sin depender de luces/texturas).
    // Nota: `dbg` es un snapshot; las ramas de creación leen este objeto.
    if (opts?.forceVisible) {
      try { dbg.noDepthTest = true } catch {}
    }
    // En easter egg queremos mantener el personaje despiezado hasta que termine.
    disassembleRef.current.holdExternal = !!opts?.hold

    // Preparar matrices actualizadas (pose actual) — orden importa (padres primero)
    try { playerRef.current.updateMatrixWorld?.(true) } catch {}
    try { playerRef.current.updateWorldMatrix?.(true, true) } catch {}
    try { modelRootRef.current.updateMatrixWorld?.(true) } catch {}
    try { modelRootRef.current.updateWorldMatrix?.(true, true) } catch {}
    try { scene.updateMatrixWorld(true) } catch {}

    // Piso: usar el mismo “ground” del jugador (world Y) para que las piezas caigan desde su posición real.
    // (El auto-calibrado por mínimo Y se veía bien en algunos casos, pero aquí termina “flotando” por radios grandes.)
    try {
      const rootWP = new THREE.Vector3()
      const rootWS = new THREE.Vector3(1, 1, 1)
      modelRootRef.current.getWorldPosition(rootWP)
      modelRootRef.current.getWorldScale(rootWS)
      const sy = Math.max(1e-6, Math.abs(rootWS.y) || 1)
      const floorWorldY = (() => {
        try {
          const pw = new THREE.Vector3()
          playerRef.current.getWorldPosition(pw)
          return pw.y
        } catch {
          return 0
        }
      })()
      disassembleRef.current.floorLocalY = (floorWorldY - rootWP.y) / sy
    } catch {
      disassembleRef.current.floorLocalY = 0
    }

    // Crear piezas rígidas
    clearDisassemblePieces()
    disassembleRef.current.pieces = []
    disassembleRef.current.detached = []
    const pieces = []
    const candidates = []

    // 0) Modo ultra-robusto para tu caso: si existen Egg_* en el scene,
    // NO hacemos bake (evita Context Lost). Detach de los meshes Egg_* en su pose actual.
    // Esto conserva materiales/texturas y proporciones exactas (sin duplicar archivos).
    // Egg pieces: 1 pieza por nodo Egg_* (grupo), NO por mesh individual.
    // Esto es lo que tú necesitas: 17 piezas -> 17 cuerpos rígidos.
    const eggDetachList = [] // lista de nodos raíz Egg_* a detachear (Object3D)
    let eggNodesSeen = 0
    let eggMeshesFound = 0
    try {
      const eggNodes = []
      scene.traverse((o) => {
        if (!o) return
        const n = (o?.name || '').toString()
        if (!n) return
        if (n.startsWith('Egg_') || n.includes('Egg_')) eggNodes.push(o)
      })
      eggNodesSeen = eggNodes.length

      // quedarnos solo con Egg_ "top-level" (si un Egg_ está dentro de otro Egg_, no duplicar)
      const isUnderEgg = (o) => {
        try {
          let p = o?.parent
          let hops = 0
          while (p && hops < 40) {
            const pn = (p?.name || '').toString()
            if (pn && (pn.startsWith('Egg_') || pn.includes('Egg_'))) return true
            p = p.parent
            hops += 1
          }
        } catch {}
        return false
      }
      const topEggNodes = eggNodes.filter((n) => !isUnderEgg(n))

      // Solo aceptar Egg_ que realmente contenga al menos 1 mesh renderizable.
      for (let i = 0; i < topEggNodes.length; i += 1) {
        const node = topEggNodes[i]
        let hasMesh = false
        try {
          node.traverse?.((c) => {
            if (hasMesh) return
            // @ts-ignore
            if (!c || (!c.isMesh && !c.isSkinnedMesh)) return
            // @ts-ignore
            if (!c.geometry || !c.material) return
            hasMesh = true
          })
        } catch {}
        if (hasMesh) eggDetachList.push(node)
      }

      // Conteo de meshes totales dentro de las piezas Egg_ (solo para consola)
      for (let i = 0; i < eggDetachList.length; i += 1) {
        const node = eggDetachList[i]
        try {
          node.traverse?.((c) => {
            // @ts-ignore
            if (!c || (!c.isMesh && !c.isSkinnedMesh)) return
            // @ts-ignore
            if (!c.geometry || !c.material) return
            eggMeshesFound += 1
          })
        } catch {}
      }
    } catch {}

    // Si existen piezas Egg_ reales, este es el camino MÁS robusto:
    // - no bakea geometría
    // - no crea materiales/meshes nuevos
    // - evita Context Lost
    // Requiere que tus piezas Egg_ sean Mesh/SkinnedMesh renderizables (con geometry+material).
    const MIN_EGG_DETACH = 6
    if (eggDetachList.length >= MIN_EGG_DETACH) {
      const parentInv = new THREE.Matrix4()
      const rel = new THREE.Matrix4()
      const p = new THREE.Vector3()
      const q = new THREE.Quaternion()
      const s = new THREE.Vector3()
      try { parentInv.copy(modelRootRef.current.matrixWorld).invert() } catch { parentInv.identity() }

      // Detach + preparar piezas
      for (let i = 0; i < eggDetachList.length; i += 1) {
        const obj = eggDetachList[i]
        const origParent = obj.parent
        if (!origParent) continue
        try { obj.updateMatrixWorld(true) } catch {}
        try { modelRootRef.current.updateMatrixWorld(true) } catch {}

        // World -> local del root (para animar físico en este espacio)
        try {
          rel.multiplyMatrices(parentInv, obj.matrixWorld)
          rel.decompose(p, q, s)
        } catch {
          p.set(0, 0, 0); q.identity(); s.set(1, 1, 1)
        }

        // Mover bajo piecesRootRef (fuera del `scene` para que applyModelOpacity(0) no lo afecte)
        try { origParent.remove(obj) } catch {}
        try { piecesRootRef.current.add(obj) } catch {}
        try {
          // Importante: muchos nodos GLTF vienen con matrixAutoUpdate=false.
          // Si no lo activamos, los cambios de position/quaternion NO se reflejan en pantalla.
          obj.traverse?.((n) => { try { n.matrixAutoUpdate = true } catch {} })
          obj.position.copy(p)
          obj.quaternion.copy(q)
          obj.scale.copy(s)
          // Desactivar culling para evitar “no se ve” por bounds stale
          obj.traverse?.((n) => {
            try { n.frustumCulled = false } catch {}
            // Asegurar visibilidad/material separado del original (evita que applyModelOpacity(0) apague estas piezas por materiales compartidos)
            try {
              // @ts-ignore
              if (n && (n.isMesh || n.isSkinnedMesh) && n.material) {
                // Guardar original (para restaurar al rearmar)
                // @ts-ignore
                if (!n.userData.__disassembleRestoreMaterial) n.userData.__disassembleRestoreMaterial = n.material
                const mats = Array.isArray(n.material) ? n.material : [n.material]
                const cloned = mats.map((m) => {
                  try {
                    const mm = (m && m.isMaterial && typeof m.clone === 'function') ? m.clone() : m
                    if (mm && mm.isMaterial) {
                      // preservar skinning si aplica
                      // @ts-ignore
                      if (n.isSkinnedMesh && 'skinning' in mm) mm.skinning = true
                      mm.transparent = false
                      mm.opacity = 1
                      mm.depthWrite = true
                      mm.depthTest = true
                      mm.side = THREE.DoubleSide
                      mm.needsUpdate = true
                    }
                    return mm
                  } catch {
                    return m
                  }
                })
                // @ts-ignore
                n.material = Array.isArray(n.material) ? cloned : cloned[0]
              }
            } catch {}
          })
          try { obj.updateMatrix?.() } catch {}
          try { obj.updateMatrixWorld?.(true) } catch {}
        } catch {}

        // Guardar restore info:
        // IMPORTANTE: NO guardar `material` aquí. En el flujo Egg_ clonamos materiales para evitar
        // sharing y luego restauramos el material original por nodo vía `__disassembleRestoreMaterial`.
        // Si guardamos `material` después del clonado, al restaurar terminamos sobrescribiendo con el clonado
        // (y algunos materiales emisivos/transparencias quedan “rotos” o negros).
        try { obj.userData.__disassembleRestore = { parent: origParent } } catch {}

        // Datos físicos (colisión por bbox)
        let bottom = 0.12
        let radius = 0.12
        try {
          // bounding box del OBJETO COMPLETO (grupo) en world, luego a local del root
          const wBox = new THREE.Box3().setFromObject(obj)
          const pts = [
            new THREE.Vector3(wBox.min.x, wBox.min.y, wBox.min.z),
            new THREE.Vector3(wBox.min.x, wBox.min.y, wBox.max.z),
            new THREE.Vector3(wBox.min.x, wBox.max.y, wBox.min.z),
            new THREE.Vector3(wBox.min.x, wBox.max.y, wBox.max.z),
            new THREE.Vector3(wBox.max.x, wBox.min.y, wBox.min.z),
            new THREE.Vector3(wBox.max.x, wBox.min.y, wBox.max.z),
            new THREE.Vector3(wBox.max.x, wBox.max.y, wBox.min.z),
            new THREE.Vector3(wBox.max.x, wBox.max.y, wBox.max.z),
          ]
          const localBox = new THREE.Box3()
          for (let pi = 0; pi < pts.length; pi += 1) {
            pts[pi].applyMatrix4(parentInv)
            localBox.expandByPoint(pts[pi])
          }
          const localMinY = localBox.min.y
          const localMaxY = localBox.max.y
          // bottom offset: distancia desde el pivot del nodo (obj.position.y) hasta el minY real
          const b = obj.position.y - localMinY
          if (Number.isFinite(b) && b > 1e-6) bottom = b
          const sz = new THREE.Vector3()
          localBox.getSize(sz)
          const maxDim = Math.max(Math.abs(sz.x), Math.abs(sz.y), Math.abs(sz.z))
          if (Number.isFinite(maxDim) && maxDim > 1e-6) radius = Math.max(0.12, maxDim * 0.5)
          // clamp para estabilidad
          radius = THREE.MathUtils.clamp(radius, 0.12, 2.2)
          // si el box está vacío, fallback
          if (!(Number.isFinite(localMaxY) && Number.isFinite(localMinY))) {
            bottom = 0.12; radius = 0.35
          }
        } catch {}

        const homePos = obj.position.clone()
        const homeQuat = obj.quaternion.clone()
        const data = {
          mesh: obj,
          v: new THREE.Vector3(),
          w: new THREE.Vector3(),
          homePos,
          homeQuat,
          assembleStartPos: homePos.clone(),
          assembleStartQuat: homeQuat.clone(),
          centerLocal: homePos.clone(),
          bottom,
          radius,
          delayS: 0,
          started: false,
          releasePos: null,
          impulseV: null,
          impulseW: null,
        }
        pieces.push(data)
      }

      if (!pieces.length) {
        try { window.__playerDisassembleLastFailReason = 'egg_detach_empty' } catch {}
        return false
      }

      // Guardar piezas en estado
      disassembleActiveRef.current = true
      disassembleRef.current.phase = 'fall'
      disassembleRef.current.t = 0
      disassembleRef.current.pieces = pieces

      // Center para empuje
      const center = new THREE.Vector3()
      for (let i = 0; i < pieces.length; i += 1) center.add(pieces[i].homePos)
      center.multiplyScalar(1 / Math.max(1, pieces.length))

      // Release escalonado (igual que el camino "rigid"): arrancan ensambladas y se sueltan una por una.
      try {
        const STAGGER_S = 0.075
        let maxDelay = 0
        const floorY = (typeof disassembleRef.current.floorLocalY === 'number' ? disassembleRef.current.floorLocalY : 0)
        for (let i = 0; i < pieces.length; i += 1) {
          const it = pieces[i]
          const delayS = Math.min(2.0, i * STAGGER_S)
          it.delayS = delayS
          it.started = false
          if (delayS > maxDelay) maxDelay = delayS

          // Mantener ensamblado al inicio
          try { it.mesh.visible = true } catch {}
          try { it.mesh.position.copy(it.homePos) } catch {}
          try { it.mesh.quaternion.copy(it.homeQuat) } catch {}
          it.v.set(0, 0, 0)
          it.w.set(0, 0, 0)

          const dir = it.homePos.clone().sub(center)
          if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1)
          dir.normalize()

          const bottom = Number.isFinite(it.bottom) ? it.bottom : it.radius
          const spawnMinY = floorY + bottom + 0.035
          const releasePos = it.homePos.clone()
          if (releasePos.y < spawnMinY) releasePos.y = spawnMinY
          releasePos.addScaledVector(dir, 0.12)
          releasePos.y += 0.32

          const impulseV = new THREE.Vector3().addScaledVector(dir, 0.75 + (i % 5) * 0.04)
          impulseV.y += 1.35
          const ga = i * 2.399963229728653
          const jr = 0.06 + (i % 7) * 0.004
          impulseV.x += Math.cos(ga) * jr
          impulseV.z += Math.sin(ga) * jr
          const impulseW = new THREE.Vector3((i % 3) * 0.8, ((i + 1) % 4) * 0.7, ((i + 2) % 5) * 0.6).multiplyScalar(0.35)

          it.releasePos = releasePos
          it.impulseV = impulseV
          it.impulseW = impulseW
        }
        disassembleRef.current.maxDelayS = maxDelay
      } catch {
        disassembleRef.current.maxDelayS = 0
      }

      // Ocultar el resto del personaje
      applyModelOpacity(0)

      // Guardar stats/snapshot para consola (igual que el camino bake)
      try {
        // @ts-ignore
        window.__playerDisassembleLastStart = snapshotDisassemble()
        // @ts-ignore
        window.__playerDisassembleMeshStats = {
          path: 'egg_detach',
          eggDetach: pieces.length,
          eggSeen: eggDetachList.length,
          eggNodesSeen,
          eggMeshesFound,
          nameSamples: eggDetachList.slice(0, 24).map((o) => o?.name || '(no-name)'),
        }
      } catch {}
      return true
    }
    // Si no alcanzamos el mínimo, guardar diagnóstico para consola.
    try {
      // @ts-ignore
      window.__playerDisassembleMeshStats = {
        path: 'egg_detach_missing',
        eggSeen: eggDetachList.length,
        eggNodesSeen,
        eggMeshesFound,
        nameSamples: eggDetachList.slice(0, 24).map((o) => o?.name || '(no-name)'),
      }
      // @ts-ignore
      window.__playerDisassembleLastFailReason = 'egg_detach_missing'
    } catch {}

    // 0) Preferir piezas rígidas ya horneadas (si existen en el GLB).
    // Esto evita TODOS los problemas de Skinning/Armature y micro-meshes.
    // PERO: si el asset trae 1-2 meshes marcados Rigid_ (ej. una esfera),
    // usarlo haría que el personaje “desaparezca” y quede solo esa pieza.
    const authoredRigid = collectAuthoredRigidPieces(scene)
    const allowAuthoredRigid = (() => {
      try { return window?.localStorage?.getItem('player_disassemble_use_rigid') !== '0' } catch { return true }
    })()
    const MIN_RIGID_PIECES = 6
    if (allowAuthoredRigid && authoredRigid && authoredRigid.length >= MIN_RIGID_PIECES) {
      const parentInv = new THREE.Matrix4()
      try { parentInv.copy(modelRootRef.current.matrixWorld).invert() } catch { parentInv.identity() }
      const rel = new THREE.Matrix4()
      const center = new THREE.Vector3()
      let centerCount = 0

      for (let i = 0; i < authoredRigid.length; i += 1) {
        const src = authoredRigid[i]
        // Clonar geometría + material rígido
        let geo
        try { geo = src.geometry.clone() } catch { continue }
        let mat
        try { mat = createRigidMaterial(src.material) } catch { mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff') }) }

        // Hornear transform del mesh en geometría (espacio local del root)
        try {
          rel.multiplyMatrices(parentInv, src.matrixWorld)
          geo.applyMatrix4(rel)
        } catch {}
        try { geo.computeBoundingBox() } catch {}
        try { geo.computeBoundingSphere() } catch {}

        // Recentrar + pivot
        const pieceCenter = new THREE.Vector3()
        try { geo.boundingBox?.getCenter?.(pieceCenter) } catch {}
        try {
          geo.translate(-pieceCenter.x, -pieceCenter.y, -pieceCenter.z)
          try { geo.computeVertexNormals() } catch {}
          geo.computeBoundingBox()
          geo.computeBoundingSphere()
        } catch {}

        const rigid = new THREE.Mesh(geo, mat)
        rigid.castShadow = true
        rigid.receiveShadow = true
        rigid.frustumCulled = false
        rigid.position.copy(pieceCenter)
        rigid.quaternion.identity()
        rigid.scale.set(1, 1, 1)

        // bottom/radius
        let bottom = 0.12
        try {
          const bb = geo.boundingBox
          if (bb) {
            const b = -bb.min.y
            if (Number.isFinite(b) && b > 1e-6) bottom = b
          }
        } catch {}
        let radius = 0.12
        try {
          const bs = geo.boundingSphere
          if (bs && Number.isFinite(bs.radius) && bs.radius > 1e-6) radius = bs.radius
        } catch {}

        const homePos = rigid.position.clone()
        const homeQuat = rigid.quaternion.clone()
        const data = {
          mesh: rigid,
          v: new THREE.Vector3(),
          w: new THREE.Vector3(),
          homePos,
          homeQuat,
          assembleStartPos: homePos.clone(),
          assembleStartQuat: homeQuat.clone(),
          centerLocal: pieceCenter.clone(),
          bottom,
          radius,
        }
        pieces.push(data)
        center.add(homePos); centerCount += 1
        try { piecesRootRef.current.add(rigid) } catch {}
      }

      if (pieces.length) {
        if (centerCount > 0) center.multiplyScalar(1 / centerCount)
        // Reusar el mismo spawn/impulsos existentes
        // (nota: el bloque de empuje está más abajo y usa `pieces` ya poblado)
      }
      // Marcar ruta para diagnóstico
      try {
        // @ts-ignore
        window.__playerDisassembleMeshStats = { ...(window.__playerDisassembleMeshStats || {}), path: 'authoredRigid', authoredRigid: authoredRigid.length }
      } catch {}
    }

    // Debug: ejes para visualizar el root de piezas (si no se ve esto, el problema es render/canvas)
    if (dbg.axes) {
      try {
        const axes = new THREE.AxesHelper(2.0)
        axes.renderOrder = 1000
        axes.frustumCulled = false
        piecesRootRef.current.add(axes)
      } catch {}
    }

    // Si no hay piezas horneadas por autor, usamos el pipeline actual (bake runtime)
    const parentInv = new THREE.Matrix4()
    try { parentInv.copy(modelRootRef.current.matrixWorld).invert() } catch { parentInv.identity() }
    const rel = new THREE.Matrix4()
    const tmpCenter = new THREE.Vector3()
    const tmpSize = new THREE.Vector3()

    // Centro aproximado para empuje radial (en espacio del root)
    const center = new THREE.Vector3()
    let centerCount = 0
    let meshSeen = 0
    let meshBuilt = 0
    let meshKept = 0
    let meshSkippedTiny = 0
    let meshSkippedTris = 0
    let meshSkippedName = 0
    let meshDroppedCap = 0
    const dbgList = []
    let hasEggPrefix = false
    let eggSeen = 0
    const nameSamples = []

    // Prepass: contar meshes renderizables + detectar el SkinnedMesh "principal".
    // Muchos rigs traen TODO el cuerpo en un solo SkinnedMesh aunque “se vea por piezas”.
    let renderableMeshCount = 0
    let bestSkinned = null
    let bestSkinnedTri = 0
    try {
      scene.traverse((o) => {
        // @ts-ignore
        if (!o || (!o.isMesh && !o.isSkinnedMesh)) return
        // @ts-ignore
        if (!o.geometry || !o.material) return
        renderableMeshCount += 1
        // @ts-ignore
        if (o.isSkinnedMesh) {
          let tri = 0
          try {
            const g = o.geometry
            if (g?.index?.array) tri = Math.floor(g.index.array.length / 3)
            else if (g?.attributes?.position?.count) tri = Math.floor(g.attributes.position.count / 3)
          } catch {}
          if (tri > bestSkinnedTri) { bestSkinnedTri = tri; bestSkinned = o }
        }
      })
    } catch {}

    // PREPASS BARATO (sin bake): si el GLB trae piezas Egg_, usar SOLO esas.
    // Esto evita hornear 100+ meshes (causa principal del Context Lost).
    const eggMeshes = []
    if (!pieces.length) {
      try {
        scene.traverse((o) => {
          // @ts-ignore
          if (!o || (!o.isMesh && !o.isSkinnedMesh)) return
          // @ts-ignore
          if (!o.geometry || !o.material) return
          const tag = getEggTagFromAncestors(o)
          if (tag) eggMeshes.push({ o, tag })
        })
      } catch {}
      // Importante: algunos GLB tienen 1-2 nodos Egg_* (ej. un accesorio).
      // Si activamos el modo Egg_ con tan pocas piezas, el personaje “desaparece”
      // y solo queda esa(s) pieza(s). Por eso exigimos un mínimo.
      eggSeen = eggMeshes.length
      const MIN_EGG_MESHES = 6
      hasEggPrefix = eggMeshes.length >= MIN_EGG_MESHES
    }

    // Construcción de candidates:
    // - Si hay Egg_: iteramos solo sobre eggMeshes.
    // - Si no hay Egg_: traverse completo.
    const buildCandidateFrom = (o, eggTag = '') => {
      // Sólo meshes con geometría y material
      // @ts-ignore
      if (!o || (!o.isMesh && !o.isSkinnedMesh)) return
      // @ts-ignore
      if (!o.geometry || !o.material) return
      // @ts-ignore
      const isSkinned = !!o.isSkinnedMesh
      const srcMesh = o
      meshSeen += 1
      const nameRaw = (srcMesh?.name || '').toString()
      if (nameSamples.length < 24) nameSamples.push({ name: nameRaw || '(no-name)', eggTag: eggTag || null })

      // Para SkinnedMesh: asegurar matrices de huesos actualizadas antes del bake
      if (isSkinned) {
        try { srcMesh.visible = true } catch {}
        try { srcMesh.updateMatrixWorld(true) } catch {}
        try { srcMesh.skeleton?.update?.() } catch {}
      }

      // Bake geometry (si es skinned); si no, clonar
      let geo
      try {
        geo = isSkinned ? bakeSkinnedGeometry(srcMesh) : srcMesh.geometry.clone()
        try { geo.computeBoundingSphere() } catch {}
      } catch {
        return
      }

      // Si el personaje viene como 1 (o pocos) skinned mesh(es), hay que partirlo en piezas.
      // Muchos rigs exportan TODO el cuerpo como un solo SkinnedMesh aunque “se vea por partes”.
      const forceSplit = (() => {
        try { return window?.localStorage?.getItem('player_disassemble_force_split') === '1' } catch { return false }
      })()
      const isPrimarySkinned = !!(isSkinned && bestSkinned && (bestSkinned === srcMesh) && bestSkinnedTri >= 800)
      // Splittear el skinned principal casi siempre (cap a 18), para garantizar múltiples piezas.
      const shouldSplitThisMesh = !!(isPrimarySkinned && (forceSplit || true))

      const emitCandidateFromGeo = (geoIn, srcMatIn, suffix = '') => {
        // Queremos "piezas reales" del modelo:
        // - si no split: 1 pieza por mesh
        // - si split: varias piezas por islas/chunks
        const mat = createRigidMaterial(srcMatIn)

        // Transform robusto: hornear la matrixWorld del mesh en la geometría (espacio local del root)
        let pieceGeo = geoIn
        try {
          rel.multiplyMatrices(parentInv, srcMesh.matrixWorld)
          pieceGeo.applyMatrix4(rel)
        } catch {}
        // Bounds robustos: algunos skinned meshes pueden dejar bbox inválido (NaN/Inf).
        try { pieceGeo.computeBoundingSphere() } catch {}
        try { pieceGeo.computeBoundingBox() } catch {}
        // Recentrar la geometría al centro del mesh para que el pivot sea correcto.
        let pieceCenter = new THREE.Vector3(0, 0, 0)
        let centerOk = false
        try {
          const bb = pieceGeo.boundingBox
          if (bb) {
            bb.getCenter(pieceCenter)
            centerOk = [pieceCenter.x, pieceCenter.y, pieceCenter.z].every((v) => Number.isFinite(v))
          }
        } catch {}
        if (!centerOk) {
          try {
            const bs = pieceGeo.boundingSphere
            if (bs?.center) {
              pieceCenter.copy(bs.center)
              centerOk = [pieceCenter.x, pieceCenter.y, pieceCenter.z].every((v) => Number.isFinite(v))
            }
          } catch {}
        }
        try {
          pieceGeo.translate(-pieceCenter.x, -pieceCenter.y, -pieceCenter.z)
          if (!dbg.proxy) {
            // al aplicarMatrix4 ya horneamos el scale/rot/pos completos
            try { pieceGeo.computeVertexNormals() } catch {}
          }
          pieceGeo.computeBoundingSphere()
          pieceGeo.computeBoundingBox()
        } catch {}

        // Métrica de triángulos (para descartar “micro meshes”)
        let triCount = 0
        try {
          if (pieceGeo.index?.array) triCount = Math.floor(pieceGeo.index.array.length / 3)
          else if (pieceGeo.attributes?.position?.count) triCount = Math.floor(pieceGeo.attributes.position.count / 3)
        } catch {}

        let finalMat = mat
        // Auto-proxy: si la geometría quedó con bounds inválidos/ultra pequeños, usar cubo.
        let autoProxy = false
        let sizeHintAuto = 0.45
        try {
          const bb = pieceGeo.boundingBox
          if (bb) {
            const sz = new THREE.Vector3()
            bb.getSize(sz)
            const m = Math.max(Math.abs(sz.x), Math.abs(sz.y), Math.abs(sz.z))
            if (Number.isFinite(m) && m > 1e-6) sizeHintAuto = m
            if (!Number.isFinite(m) || m < 0.02) autoProxy = true
          } else {
            autoProxy = true
          }
        } catch {
          autoProxy = true
        }
        if (!autoProxy) {
          if (!centerOk) autoProxy = true
        }
        if (autoProxy && !dbg.proxy) {
          const s = THREE.MathUtils.clamp(sizeHintAuto || 0.45, 0.12, 1.6)
          try { pieceGeo = new THREE.BoxGeometry(s, s, s) } catch {}
          try {
            const id = (pieces.length + 1) * 0.61803398875
            const hue = id - Math.floor(id)
            finalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.95, 0.6), transparent: false, opacity: 1, side: THREE.DoubleSide })
            finalMat.toneMapped = false
            try { finalMat.depthTest = false; finalMat.depthWrite = false } catch {}
          } catch {}
        }

        if (dbg.normalMaterial) {
          finalMat = new THREE.MeshNormalMaterial({ transparent: false, opacity: 1, side: THREE.DoubleSide })
          finalMat.toneMapped = false
        } else if (dbg.wire) {
          finalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#00ff88'), wireframe: true, transparent: false, opacity: 1, side: THREE.DoubleSide })
          finalMat.toneMapped = false
        } else if (dbg.noDepthTest) {
          finalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: false, opacity: 1, side: THREE.DoubleSide })
          finalMat.toneMapped = false
          try { finalMat.depthTest = false; finalMat.depthWrite = false } catch {}
        } else if (dbg.proxy) {
          const id = (pieces.length + 1) * 0.61803398875
          const hue = id - Math.floor(id)
          finalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.95, 0.6), transparent: false, opacity: 1, side: THREE.DoubleSide })
          finalMat.toneMapped = false
          try { finalMat.depthTest = false; finalMat.depthWrite = false } catch {}
        }

        const rigid = new THREE.Mesh(pieceGeo, finalMat)
        rigid.userData.__disassembleOwned = true
        rigid.castShadow = true
        rigid.receiveShadow = true
        rigid.frustumCulled = false
        rigid.renderOrder = (dbg.noDepthTest || dbg.proxy) ? 999 : 0
        try { rigid.name = `${nameRaw || '(no-name)'}${suffix}` } catch {}

        rigid.position.copy(pieceCenter)
        rigid.quaternion.identity()
        rigid.scale.set(1, 1, 1)

        const homePos = rigid.position.clone()
        const homeQuat = rigid.quaternion.clone()

        let bottom = 0.12
        try {
          const bb = pieceGeo.boundingBox
          if (bb) {
            const b = -bb.min.y
            if (Number.isFinite(b) && b > 1e-6) bottom = b
          }
        } catch {}
        let radius = 0.12
        try {
          const bs = pieceGeo.boundingSphere
          if (bs && Number.isFinite(bs.radius) && bs.radius > 1e-6) radius = bs.radius
        } catch {}

        const data = {
          mesh: rigid,
          v: new THREE.Vector3(),
          w: new THREE.Vector3(),
          homePos,
          homeQuat,
          assembleStartPos: homePos.clone(),
          assembleStartQuat: homeQuat.clone(),
          centerLocal: pieceCenter.clone(),
          bottom,
          radius,
        }

        meshBuilt += 1
        let maxDim = 0
        let vol = 0
        try {
          pieceGeo.computeBoundingBox()
          if (pieceGeo.boundingBox) {
            pieceGeo.boundingBox.getSize(tmpSize)
            maxDim = Math.max(Math.abs(tmpSize.x), Math.abs(tmpSize.y), Math.abs(tmpSize.z))
            vol = Math.abs(tmpSize.x * tmpSize.y * tmpSize.z)
          }
        } catch {}
        const name = `${nameRaw}${suffix}`
        candidates.push({ data, maxDim, vol, triCount, name, eggTag, skinned: !!isSkinned })

        if (dbg.enabled) {
          try { dbgList.push({ name: name || '(no-name)', skinned: !!isSkinned, maxDim, vol, triCount }) } catch {}
        }
      }

      if (shouldSplitThisMesh) {
        // Splittear por islas/grupos/chunks para garantizar múltiples piezas.
        let parts = []
        try {
          parts = splitGeometryByGroupsOrIslands(geo, srcMesh.material) || []
        } catch {
          parts = []
        }
        if (parts && parts.length > 1) {
          // Cap para evitar explotar el costo
          const CAP = 18
          const used = parts.slice(0, CAP)
          for (let i = 0; i < used.length; i += 1) {
            const p = used[i]
            const mi = typeof p.materialIndex === 'number' ? p.materialIndex : 0
            const srcMatIn = Array.isArray(srcMesh.material) ? (srcMesh.material[mi] || srcMesh.material[0]) : srcMesh.material
            emitCandidateFromGeo(p.geo, srcMatIn, `#${i}`)
          }
          return
        }
        // Si split falló, caer al camino normal
      }

      // Camino normal: 1 pieza por mesh
      const srcMatIn = Array.isArray(srcMesh.material) ? (srcMesh.material[0] || srcMesh.material) : srcMesh.material
      emitCandidateFromGeo(geo, srcMatIn, '')
      return

    }

    if (!pieces.length) {
      if (hasEggPrefix) {
        for (let i = 0; i < eggMeshes.length; i += 1) {
          buildCandidateFrom(eggMeshes[i].o, eggMeshes[i].tag)
        }
      } else {
        try { scene.traverse((o) => buildCandidateFrom(o, '')) } catch {}
      }
    }

    if (!pieces.length && !candidates.length) return false

    // Si el usuario ya preparó piezas con prefijo Egg_, usar SOLO esas.
    // Esto hace el efecto determinista y evita que “micro-meshes” o filtros de volumen
    // terminen dejando 1 sola pieza visible.
    const eggCandidates = hasEggPrefix ? candidates.filter((c) => !!c.eggTag) : []
    if (!pieces.length && eggCandidates.length) {
      // Mantener el orden por nombre para que sea estable.
      eggCandidates.sort((a, b) => (a.eggTag || '').localeCompare(b.eggTag || ''))
      const MAX_EGG_PIECES = 64
      const keptEgg = eggCandidates.slice(0, MAX_EGG_PIECES)
      for (let i = 0; i < keptEgg.length; i += 1) {
        const it = keptEgg[i].data
        pieces.push(it)
        meshKept += 1
        center.add(it.homePos)
        centerCount += 1
        try { piecesRootRef.current.add(it.mesh) } catch {}
      }
      if (!pieces.length) return false
      if (centerCount > 0) center.multiplyScalar(1 / centerCount)
    } else if (!pieces.length) {
    // Selección robusta: priorizar piezas "importantes" aunque bbox/vol falle.
    // Motivo: si bbox/maxDim sale NaN/0 (común en skinned), el filtro anterior dejaba solo 1 pieza.
    const TARGET_PIECES = 14
    const MAX_PIECES = 22
    const MIN_KEEP = 10

    meshSkippedTiny = 0
    meshSkippedTris = 0
    meshSkippedName = 0
    meshDroppedCap = 0

    const scoreOf = (c) => {
      const vol = Number.isFinite(c.vol) ? c.vol : 0
      const maxDim = Number.isFinite(c.maxDim) ? c.maxDim : 0
      const tri = Number.isFinite(c.triCount) ? c.triCount : 0
      // score: volumen (si existe) > triCount > tamaño
      return vol * 1e6 + tri * 10 + maxDim
    }

    const sorted = [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a))
    let kept = sorted.slice(0, MAX_PIECES)
    if (kept.length < MIN_KEEP) kept = sorted.slice(0, Math.min(sorted.length, MIN_KEEP))
    if (kept.length > TARGET_PIECES) kept = kept.slice(0, TARGET_PIECES)

    // Montar piezas seleccionadas
    for (let i = 0; i < kept.length; i += 1) {
      const it = kept[i].data
      pieces.push(it)
      meshKept += 1
      center.add(it.homePos)
      centerCount += 1
      try { piecesRootRef.current.add(it.mesh) } catch {}
    }
    if (!pieces.length) return false
    if (centerCount > 0) center.multiplyScalar(1 / centerCount)
    }

    // Stagger (release): las piezas arrancan “ensambladas” (visibles) y se van soltando una por una.
    // Esto evita el efecto “desaparece y luego aparecen piezas”.
    try {
      const STAGGER_S = 0.075
      let maxDelay = 0
      const floorY = (typeof disassembleRef.current.floorLocalY === 'number' ? disassembleRef.current.floorLocalY : 0)
      for (let i = 0; i < pieces.length; i += 1) {
        const it = pieces[i]
        const delayS = Math.min(2.0, i * STAGGER_S)
        it.delayS = delayS
        it.started = false
        if (delayS > maxDelay) maxDelay = delayS

        // Mantener ensamblado al inicio
        try { it.mesh.visible = true } catch {}
        try { it.mesh.position.copy(it.homePos) } catch {}
        try { it.mesh.quaternion.copy(it.homeQuat) } catch {}
        try { it.mesh.scale.set(1, 1, 1) } catch {}
        it.v.set(0, 0, 0)
        it.w.set(0, 0, 0)

        // Impulso + offset a aplicar cuando “se suelte”
        const dir = it.homePos.clone().sub(center)
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1)
        dir.normalize()

        // Posición de salida: asegurar que no nazca bajo el piso + pequeño offset
        const bottom = Number.isFinite(it.bottom) ? it.bottom : it.radius
        const spawnMinY = floorY + bottom + 0.035
        const releasePos = it.homePos.clone()
        if (releasePos.y < spawnMinY) releasePos.y = spawnMinY
        releasePos.addScaledVector(dir, 0.12)
        try {
          const cl = it.centerLocal ? it.centerLocal.clone() : null
          if (cl && cl.lengthSq() > 1e-8) {
            cl.normalize()
            releasePos.addScaledVector(cl, 0.06)
          }
        } catch {}
        releasePos.y += 0.32

        const impulseV = new THREE.Vector3().addScaledVector(dir, 0.75 + (i % 5) * 0.04)
        impulseV.y += 1.35
        const ga = i * 2.399963229728653 // golden angle
        const jr = 0.06 + (i % 7) * 0.004
        impulseV.x += Math.cos(ga) * jr
        impulseV.z += Math.sin(ga) * jr
        const impulseW = new THREE.Vector3((i % 3) * 0.8, ((i + 1) % 4) * 0.7, ((i + 2) % 5) * 0.6).multiplyScalar(0.35)

        it.releasePos = releasePos
        it.impulseV = impulseV
        it.impulseW = impulseW
      }
      disassembleRef.current.maxDelayS = maxDelay
    } catch {
      disassembleRef.current.maxDelayS = 0
    }

    disassembleActiveRef.current = true
    disassembleRef.current.phase = 'fall'
    disassembleRef.current.t = 0
    disassembleRef.current.pieces = pieces
    // Guardar stats SIEMPRE (para que stats() no dependa de debug).
    try {
      // @ts-ignore
      window.__playerDisassembleLastStart = snapshotDisassemble()
      // @ts-ignore
      window.__playerDisassembleMeshStats = {
        meshSeen,
        eggSeen,
        hasEggPrefix,
        eggCandidates: eggCandidates.length,
        nameSamples,
        meshBuilt,
        meshKept,
        meshSkippedTiny,
        meshSkippedTris,
        meshSkippedName,
        meshDroppedCap,
        thresholds: { minMaxDim: MIN_MAXDIM, volRatio: VOL_RATIO, minKeep: MIN_KEEP, target: TARGET_PIECES, cap: MAX_PIECES },
        list: dbgList.slice(0, 60),
      }
      if (dbg.enabled) {
        // eslint-disable-next-line no-console
        console.log('[player-disassemble] start snapshot:', window.__playerDisassembleLastStart)
        // eslint-disable-next-line no-console
        console.log('[player-disassemble] mesh stats:', window.__playerDisassembleMeshStats)
      }
    } catch {}

    // Ocultar el personaje “skinned” usando el mecanismo existente
    applyModelOpacity(0)
    return true
  }, [applyModelOpacity, bakeSkinnedGeometry, clearDisassemblePieces, createRigidMaterial, playerRef, readDisassembleDebugFlags, scene, splitGeometryByGroupsOrIslands])

  const requestAssemble = useCallback(() => {
    if (!disassembleActiveRef.current) return
    const dis = disassembleRef.current
    // liberar hold del easter egg
    dis.holdExternal = false
    const pieces = dis.pieces || []
    // si todavía no llegaron a caer, forzar a "fall" completo antes de ensamblar
    try { dis.phase = 'assemble' } catch {}
    dis.t = 0
    for (let i = 0; i < pieces.length; i += 1) {
      const it = pieces[i]
      try { it.mesh.visible = true } catch {}
      it.assembleStartPos.copy(it.mesh.position)
      it.assembleStartQuat.copy(it.mesh.quaternion)
      it.v.set(0, 0, 0)
      it.w.set(0, 0, 0)
    }
  }, [])

  // Listener global (lo dispara el easter egg desde UI)
  useEffect(() => {
    if (!DISASSEMBLE_ENABLED) return undefined
    const onDis = () => startDisassemble({ forceVisible: true })
    try { window.addEventListener('player-disassemble', onDis) } catch {}
    return () => {
      try { window.removeEventListener('player-disassemble', onDis) } catch {}
    }
  }, [startDisassemble])

  // Ahora que startDisassemble existe (sin TDZ), actualizar trigger para que sea directo.
  useEffect(() => {
    try {
      // @ts-ignore
      if (!window.__playerDisassemble) return
      // @ts-ignore
      window.__playerDisassemble.trigger = () => { try { startDisassemble() } catch {} }
    } catch {}
  }, [startDisassemble])

  // Integración con el estado global del easter egg:
  // - si se activa antes de que el modelo esté listo, lo reintentamos al cargar.
  const eggPrevActiveRef = useRef(false)
  const eggPendingStartRef = useRef(false)
  useEffect(() => {
    const prev = eggPrevActiveRef.current
    const next = !!eggActive
    eggPrevActiveRef.current = next
    eggActiveRef.current = next
    if (next && !prev) {
      eggEndRequestedRef.current = false
      eggPendingStartRef.current = false
      // Workaround “desarmado”: voxeles explotan y se reconstruyen.
      try { startEggVoxelFx() } catch {}
      // Ocultar modelo al inicio; lo re-mostramos cerca del “snap” final en rebuild.
      try { applyModelOpacity(0) } catch {}
      // No setTimeout fallback: si el tab se pausa, el timer cortaba el FX “a la mitad”.
    } else if (!next && prev) {
      eggPendingStartRef.current = false
      // Si el FX está corriendo, NO lo cortamos: que termine y luego quedará visible.
      if (eggVoxelActiveRef.current) {
        eggEndRequestedRef.current = true
        return
      }
      // Salida: asegurar visibilidad + apagar FX (si no está corriendo)
      try { if (eggVoxelHideTimerRef.current) window.clearTimeout(eggVoxelHideTimerRef.current) } catch {}
      eggVoxelHideTimerRef.current = null
      try { stopEggVoxelFx() } catch {}
      try { applyModelOpacity(1) } catch {}
    }
  }, [eggActive, startEggVoxelFx, stopEggVoxelFx])
  useEffect(() => {
    // Desarmado deshabilitado: no reintentar startDisassemble.
    if (!eggActive) return
  }, [eggActive, scene, startDisassemble])

  // Animación del voxel FX: explode -> drift -> rebuild (snap) + sincronía con mostrar personaje.
  useFrame((state, dtRaw) => {
    if (!eggVoxelActiveRef.current) return
    const mesh = eggVoxelRef.current
    if (!mesh) return
    // Separar dt “de reloj” (para timings) del dt de simulación (para física) para que el FX
    // SIEMPRE termine, incluso con FPS bajos/hitches (clamp sólo para estabilidad de la física).
    // Para garantizar término tras volver de tab hidden, permitir catch-up mayor en el timeline.
    const dtWall = Math.min(2.0, Math.max(0, dtRaw || 0))
    const dt = Math.min(0.05, dtWall)
    eggVoxelTRef.current += dtWall
    const t = eggVoxelTRef.current
    const phase = eggVoxelPhaseRef.current
    const pieces = eggVoxelPiecesRef.current
    const dummy = new THREE.Object3D()

    // timings (source-of-truth)
    const EXPLODE_S = EGG_VOXEL_EXPLODE_S
    const DRIFT_S = EGG_VOXEL_DRIFT_S
    const REBUILD_S = EGG_VOXEL_REBUILD_S
    const DONE_S = EGG_VOXEL_DONE_S
    const DONE_HOLD_S = EGG_VOXEL_DONE_HOLD_S
    const DONE_REVEAL_DELAY = EGG_VOXEL_DONE_REVEAL_DELAY_S
    const DONE_REVEAL_S = EGG_VOXEL_DONE_REVEAL_S

    // fuerzas (más caída / más “peso”)
    const GRAV = -18.0
    const LIN_DAMP = Math.pow(0.22, dt)
    const ANG_DAMP = Math.pow(0.35, dt)

    // transición de fase
    if (phase === 'explode' && t >= EXPLODE_S) {
      eggVoxelPhaseRef.current = 'drift'
      eggVoxelTRef.current = 0
    } else if (phase === 'drift' && t >= DRIFT_S) {
      eggVoxelPhaseRef.current = 'rebuild'
      eggVoxelTRef.current = 0
      // “pull” inicial hacia targets: frenar un poco para evitar overshoot duro
      for (let i = 0; i < pieces.length; i += 1) {
        pieces[i].vel.multiplyScalar(0.35)
        pieces[i].ang.multiplyScalar(0.5)
      }
    } else if (phase === 'rebuild' && t >= REBUILD_S) {
      eggVoxelPhaseRef.current = 'done'
      eggVoxelTRef.current = 0
      // snap a targets (mantener unos frames para que “se vea” el armado final)
      for (let i = 0; i < pieces.length; i += 1) {
        const p = pieces[i]
        p.pos.copy(p.target)
        p.vel.set(0, 0, 0)
      }
      // AHORA sí: permitir revelar al personaje (post-snap), pero con fade-in dentro de DONE_S.
      // Mantener freeze activo durante DONE para que no se mueva mientras “termina de armarse”.
      try { eggHideLockRef.current = false } catch {}
    }

    const nextPhase = eggVoxelPhaseRef.current
    const tt = eggVoxelTRef.current

    // Control centralizado de ocultamiento: mantener oculto hasta el instante exacto donde empieza el reveal.
    try {
      if (nextPhase !== 'done') eggHideForceRef.current = true
      else {
        const revealStart = DONE_HOLD_S + DONE_REVEAL_DELAY
        eggHideForceRef.current = tt < revealStart
      }
    } catch {}

    // opacidad global: sube rápido, baja al final del rebuild (para revelar al modelo)
    try {
      const mat = eggVoxelMatRef.current
      if (mat) {
        let op = 0.95
        if (nextPhase === 'rebuild') {
          const a = THREE.MathUtils.clamp(tt / REBUILD_S, 0, 1)
          // easeInOutCubic (más cinematográfico)
          const ease = a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2
          // durante rebuild, NO mostrar al personaje (solo bajar opacidad de voxels)
          op = THREE.MathUtils.lerp(0.95, 0.12, ease)
        } else if (nextPhase === 'done') {
          // “after-snap”:
          // 1) HOLD: voxeles totalmente armados (sin reveal del personaje)
          // 2) DISSOLVE + REVEAL: disolver cubos y revelar personaje, suave
          const doneA = (tt <= DONE_HOLD_S)
            ? 0
            : THREE.MathUtils.clamp((tt - DONE_HOLD_S) / Math.max(1e-4, (DONE_S - DONE_HOLD_S)), 0, 1)
          const doneEase = 1 - Math.pow(1 - doneA, 3) // easeOutCubic
          // mantener un poquito de presencia al inicio para que “se lea” el armado
          op = (tt <= DONE_HOLD_S) ? 0.24 : THREE.MathUtils.lerp(0.24, 0.0, doneEase)

          // Reveal del modelo SOLO después de que se vea el snap (post-hold)
          try {
            if (!orbActiveRef.current) {
              const tStart = DONE_HOLD_S + DONE_REVEAL_DELAY
              const tIn = THREE.MathUtils.clamp((tt - tStart) / Math.max(1e-4, DONE_REVEAL_S), 0, 1)
              const inEase = 1 - Math.pow(1 - tIn, 3) // easeOutCubic
              // Si todavía estamos en hold, mantener 0
              applyModelOpacity((tt <= DONE_HOLD_S) ? 0 : inEase)
            }
          } catch {}

          // Fin determinista (no depende de variables locales ni de FPS)
          if (tt >= DONE_S) {
            try { if (!orbActiveRef.current) applyModelOpacity(1) } catch {}
            try { stopEggVoxelFx() } catch {}
            return
          }
        }
        mat.opacity = op
        mat.needsUpdate = true
      }
    } catch {}

    for (let i = 0; i < pieces.length; i += 1) {
      const p = pieces[i]
      if (nextPhase === 'explode' || nextPhase === 'drift') {
        p.vel.y += GRAV * dt
        p.vel.multiplyScalar(LIN_DAMP)
        p.ang.multiplyScalar(ANG_DAMP)
        p.pos.addScaledVector(p.vel, dt)
        p.rot.x += p.ang.x * dt
        p.rot.y += p.ang.y * dt
        p.rot.z += p.ang.z * dt
        // piso local
        if (p.pos.y < 0.03) {
          p.pos.y = 0.03
          // Mucho menos rebote y más fricción para que “caiga rápido” y asiente
          p.vel.y = Math.abs(p.vel.y) * 0.05
          p.vel.x *= 0.5
          p.vel.z *= 0.5
          p.ang.multiplyScalar(0.6)
        }
      } else if (nextPhase === 'rebuild') {
        const a = THREE.MathUtils.clamp(tt / REBUILD_S, 0, 1)
        const ease = a * a * (3 - 2 * a)
        // fuerza de atracción tipo spring + swirl para look “game”
        const toT = p.target.clone().sub(p.pos)
        const dist = Math.max(1e-4, toT.length())
        toT.multiplyScalar(1 / dist)
        // swirl perpendicular en XZ
        const swirl = new THREE.Vector3(-toT.z, 0, toT.x).multiplyScalar(1.2 * (1 - ease))
        const kPull = 22 + 38 * ease
        const accel = toT.multiplyScalar(kPull * dist).add(swirl.multiplyScalar(6.5))
        // integrar
        p.vel.addScaledVector(accel, dt)
        p.vel.multiplyScalar(Math.pow(0.08, dt))
        p.pos.addScaledVector(p.vel, dt)
        // orientar hacia “calma”
        p.ang.multiplyScalar(Math.pow(0.15, dt))
        p.rot.x *= Math.pow(0.08, dt)
        p.rot.y *= Math.pow(0.08, dt)
        p.rot.z *= Math.pow(0.08, dt)
        // snap suave al final para no vibrar
        if (ease > 0.96) {
          p.pos.lerp(p.target, 0.35)
        }
        // Snap progresivo para que SIEMPRE se “lea” el armado completo antes de pasar a done
        if (ease > 0.84) {
          const k = THREE.MathUtils.clamp((ease - 0.84) / 0.16, 0, 1)
          const snap = 0.10 + 0.70 * k
          p.pos.lerp(p.target, snap)
          // matar velocidad residual para evitar que “tiemble” y parezca incompleto
          p.vel.multiplyScalar(0.35)
        }
      } else if (nextPhase === 'done') {
        // mantener voxel ya ensamblado durante el after-snap + disolver (shrink)
        const a = (tt <= DONE_HOLD_S)
          ? 0
          : THREE.MathUtils.clamp((tt - DONE_HOLD_S) / Math.max(1e-4, (DONE_S - DONE_HOLD_S)), 0, 1)
        const ease = 1 - Math.pow(1 - a, 3) // easeOutCubic
        p.pos.copy(p.target)
        // encoger progresivamente para que el final sea más “premium”
        p._doneScale = Math.max(0.0001, p.scale * (1 - 0.92 * ease))
      }
      dummy.position.copy(p.pos)
      dummy.rotation.copy(p.rot)
      // Aplicar escala “normal” o la del dissolve de done
      // @ts-ignore
      const s = (nextPhase === 'done' && typeof p._doneScale === 'number') ? p._doneScale : p.scale
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, 20)

  // Seed de emissive base (sin cambiar look)
  useEffect(() => {
    if (!scene) return
    try {
      scene.traverse((obj) => {
        if (!obj || !obj.isMesh || !obj.material) return
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => seedEmissiveBase(m))
      })
    } catch {}
  }, [scene, seedEmissiveBase])

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
  // Throttle de UI de carga (evita re-render 60fps en mobile)
  const lastChargeUiRef = useRef(-1)
  const lastChargeUiTsRef = useRef(0)

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

  // Sombras “reales” deshabilitadas (preferimos sombra abstracta/estable en App.jsx).
  useEffect(() => { setCharacterShadowEnabled(false) }, [setCharacterShadowEnabled])

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
    return [idle, walk]
  }, [actions])

  // Smooth blending between idle and walk using effective weights
  const walkWeightRef = useRef(0)

  // ============================================================
  // CONSTANTES DE MOVIMIENTO Y ANIMACIÓN (CENTRALIZADAS)
  // ============================================================
  // --- VELOCIDADES ---
  // BASE_SPEED bajo + SPEED alto = animación más rápida
  // El clip original es lento, así que necesitamos acelerarlo
  const BASE_SPEED = 4.8  // baseline bajo para acelerar animación
  const SPEED = 9.5       // velocidad real del personaje

  // --- CONSTANTES DE ANIMACIÓN ---
  const IDLE_TIMESCALE = 1.6
  // Multiplicador fijo para acelerar la animación del clip
  const WALK_TIMESCALE_MULT = 1.0
  // Rango FIJO para evitar variaciones - timeScale será ~2x constante
  const WALK_SCALE_MIN = 1.95
  const WALK_SCALE_MAX = 2.0

  // --- BLEND CON damp() (frame-rate independent) ---
  // Lambda para damp(): higher = faster convergence (5-30 típico)
  // 8 = transición muy suave ~0.4s (evita temblor)
  const BLEND_LAMBDA = 8.0

  // --- PORTALES Y PROXIMIDAD ---
  const threshold = 3 // distance threshold for portal "inside" (for CTA)
  const EXIT_THRESHOLD = 4 // must leave this distance to rearm
  const REENTER_COOLDOWN_S = 1.2 // tiempo mínimo antes de poder re-entrar
  const PROXIMITY_RADIUS = 12 // radius within which we start tinting the scene
  // ============================================================

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
      // TimeScale inicial sincronizado con velocidad
      const baseWalkScale = THREE.MathUtils.clamp((SPEED / BASE_SPEED) * WALK_TIMESCALE_MULT, WALK_SCALE_MIN, WALK_SCALE_MAX)
      walkAction.reset().setEffectiveWeight(0).setEffectiveTimeScale(baseWalkScale).play()
      walkAction.setLoop(THREE.LoopRepeat, Infinity)
      walkAction.clampWhenFinished = false
      try { walkDurationRef.current = walkAction.getClip()?.duration || walkDurationRef.current } catch {}
    }
  }, [actions, idleName, walkName])

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
    if (prewarm) return
    if (!playerRef.current) return
    const tmp = tmpRef.current
    const dtRaw = Math.min(Math.max(delta || 0, 0), 0.1) // 100ms cap anti-freeze/alt-tab/GC
    // Sistema de carga del poder (barra espaciadora): mantener presionado para cargar, soltar para disparar
    const pressed = !!keyboard?.action
    // --- SUAVIZADO DEL DELTA MEJORADO ---
    // Límites más amplios: 1/144 (alto refresco) hasta 1/20 (50ms, frames lentos)
    const dtBlend = THREE.MathUtils.clamp(dtRaw, 1 / 144, 1 / 20)
    // Factor de suavizado más rápido (~0.45) para respuesta inmediata
    // pero aún filtra spikes ocasionales de GC/hitch
    const DT_SMOOTH_FACTOR = 0.45
    dtSmoothRef.current = THREE.MathUtils.lerp(dtSmoothRef.current, dtBlend, DT_SMOOTH_FACTOR)
    dtMoveRef.current = dtRaw
    const dt = dtSmoothRef.current
    // Cooldown de pasos
    footCooldownSRef.current = Math.max(0, footCooldownSRef.current - dt)

    // Durante easter egg, el orbe NO debe activarse ni ocultar al personaje.
    if (eggActiveRef.current) {
      try { orbActiveRef.current = false } catch {}
      try { showOrbRef.current = false } catch {}
      try { setOrbActive(false) } catch {}
    }

    // Freeze del personaje mientras el FX de vóxeles está activo (hasta reconstrucción).
    // Mantiene el avatar inmóvil y evita inputs/portal logic durante la animación.
    if (eggFreezeActiveRef.current) {
      try {
        const p = playerRef.current.position
        p.copy(eggFreezePosRef.current)
        // Mantener coherencia del simulador interno para evitar “salto” al volver
        simPosRef.current.copy(p)
        simPrevPosRef.current.copy(p)
      } catch {}
      // Asegurar que el modelo permanezca oculto hasta que empiece el reveal (post-hold).
      if (eggHideForceRef.current || eggHideLockRef.current) {
        try { applyModelOpacity(0) } catch {}
      }
      return
    }

    // Si estamos en desarme, correr solo física/ensamble y congelar el resto del loop.
    if (disassembleActiveRef.current) {
      const dis = disassembleRef.current
      dis.t += dtMoveRef.current || dt
      const pieces = dis.pieces || []
      const GRAV = -8.6
      const LIN_DAMP = 0.985
      const ANG_DAMP = 0.97
      const dbg = disassembleDebugRef.current
      const hold = !!(dbg.hold || dis.holdExternal)
      const FLOOR_EPS = 0.015

      if (dis.phase === 'fall') {
        const allowFloor = dis.t >= dis.floorDelayS
        for (let i = 0; i < pieces.length; i += 1) {
          const it = pieces[i]
          const delayS = (typeof it.delayS === 'number' && Number.isFinite(it.delayS)) ? it.delayS : 0
          // Release escalonado: hasta que llegue su turno, se queda ensamblada.
          if (!it.started) {
            if (dis.t < delayS) continue
            it.started = true
            try { it.mesh.visible = true } catch {}
            // Aplicar “salida” e impulso inicial
            try {
              if (it.releasePos) it.mesh.position.copy(it.releasePos)
            } catch {}
            try {
              if (it.impulseV) it.v.copy(it.impulseV)
            } catch {}
            try {
              if (it.impulseW) it.w.copy(it.impulseW)
            } catch {}
          }
          it.v.y += GRAV * (dtMoveRef.current || dt)
          it.v.multiplyScalar(LIN_DAMP)
          it.w.multiplyScalar(ANG_DAMP)
          it.mesh.position.addScaledVector(it.v, (dtMoveRef.current || dt))
          // Integración angular simple
          const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(it.w.x * (dtMoveRef.current || dt), it.w.y * (dtMoveRef.current || dt), it.w.z * (dtMoveRef.current || dt)))
          it.mesh.quaternion.multiply(dq).normalize()

          if (allowFloor) {
            const floorY = (typeof dis.floorLocalY === 'number' ? dis.floorLocalY : 0)
            const yMin = floorY + (Number.isFinite(it.bottom) ? it.bottom : it.radius) + FLOOR_EPS
            if (it.mesh.position.y < yMin) {
              it.mesh.position.y = yMin
              // Sin rebote: matar Y, fricción en XZ
              it.v.y = 0
              it.v.x *= 0.72
              it.v.z *= 0.72
              it.w.multiplyScalar(0.65)
            }
          }
        }

        const maxDelay = (typeof dis.maxDelayS === 'number' && Number.isFinite(dis.maxDelayS)) ? dis.maxDelayS : 0
        if (!hold && dis.t >= (dis.fallS + maxDelay)) {
          dis.phase = 'assemble'
          dis.t = 0
          for (let i = 0; i < pieces.length; i += 1) {
            const it = pieces[i]
            try { it.mesh.visible = true } catch {}
            it.assembleStartPos.copy(it.mesh.position)
            it.assembleStartQuat.copy(it.mesh.quaternion)
            it.v.set(0, 0, 0)
            it.w.set(0, 0, 0)
          }
        }
      } else if (dis.phase === 'assemble') {
        const a = THREE.MathUtils.clamp(dis.t / Math.max(1e-3, dis.assembleS), 0, 1)
        // easeInOut
        const tEase = a * a * (3 - 2 * a)
        for (let i = 0; i < pieces.length; i += 1) {
          const it = pieces[i]
          try { it.mesh.visible = true } catch {}
          it.mesh.position.lerpVectors(it.assembleStartPos, it.homePos, tEase)
          it.mesh.quaternion.slerpQuaternions(it.assembleStartQuat, it.homeQuat, tEase)
        }

        if (!hold && a >= 1) {
          // Fin: limpiar y volver a mostrar modelo animado
          disassembleActiveRef.current = false
          dis.phase = 'idle'
          dis.t = 0
          // Restaurar meshes detached (si aplica) antes del cleanup.
          try {
            const root = piecesRootRef.current
            if (root) {
              // Solo reparentear los que tienen restore info
              for (let i = root.children.length - 1; i >= 0; i -= 1) {
                const obj = root.children[i]
                const restore = obj?.userData?.__disassembleRestore
                if (!restore?.parent) continue
                try { root.remove(obj) } catch {}
                try { restore.parent.add(obj) } catch {}
                // Restaurar materiales originales (por mesh) si los clonamos para el despiece
                try {
                  obj.traverse?.((n) => {
                    const m0 = n?.userData?.__disassembleRestoreMaterial
                    if (m0) {
                      try { n.material = m0 } catch {}
                      try { delete n.userData.__disassembleRestoreMaterial } catch {}
                    }
                  })
                } catch {}
                try { obj.visible = true } catch {}
                try { delete obj.userData.__disassembleRestore } catch {}
              }
            }
          } catch {}
          dis.pieces = []
          clearDisassemblePieces()
          applyModelOpacity(1)
        }
      }

      return
    }

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
      // Marcar que venimos de modo orbe para re-sincronizar al salir
      simWasOrbRef.current = true
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
    // Si acabamos de salir del modo orbe, el simulador debe “snapear” a la posición real,
    // o si no el fixed-step render sobreescribe y te regresa al punto anterior.
    if (simWasOrbRef.current) {
      simWasOrbRef.current = false
      try {
        simInitRef.current = true
        simAccRef.current = 0
        simPosRef.current.copy(playerRef.current.position)
        simPrevPosRef.current.copy(playerRef.current.position)
        simYawRef.current = playerRef.current.rotation.y
        simPrevYawRef.current = playerRef.current.rotation.y
      } catch {}
    }

    // (la detección de pasos basada en animación se realiza después del cálculo de input)

    // Build input vector (camera-relative).
    // Mobile: joystick estilo ARCADE (cambio de dirección casi instantáneo).
    const joy = (typeof window !== 'undefined' && window.__joystick) ? window.__joystick : null
    const isCoarse = (() => {
      try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches } catch { return false }
    })()
    const joyMag = joy && joy.active ? Math.max(0, Math.min(1, joy.mag || Math.hypot(joy.x || 0, joy.y || 0))) : 0
    // Deadzone moderada: evita drift
    const JOY_DEAD = 0.08
    // Curva de sensibilidad ( >1 = más gradual; <1 = más sensible al inicio )
    const JOY_SPEED_CURVE = 1.6
    // Solo usar joystick en dispositivos táctiles/puntero "coarse" (mobile/tablet)
    const hasJoy = isCoarse && joy && joy.active && (joyMag > JOY_DEAD)
    // Ejes: joystick x derecha+, y abajo+ → zInput utiliza -y (arriba en pantalla = adelante)
    const joyX = hasJoy ? (joy.x || 0) : 0
    const joyZ = hasJoy ? (-(joy.y || 0)) : 0
    // Keyboard (digital)
    const xKey = (keyboard.left ? -1 : 0) + (keyboard.right ? 1 : 0)
    const zKey = (keyboard.forward ? 1 : 0) + (keyboard.backward ? -1 : 0)

    // Joystick (ARCADE): snap de dirección + velocidad analógica (según cuánto empujas)
    let xInputRaw = xKey
    let zInputRaw = zKey
    let inputMag = Math.min(1, Math.abs(xKey) + Math.abs(zKey))
    if (hasJoy) {
      const rawMag = Math.min(1, Math.hypot(joyX, joyZ))
      const dz = JOY_DEAD
      const norm = rawMag > dz ? ((rawMag - dz) / (1 - dz)) : 0
      const inv = rawMag > 1e-6 ? (1 / rawMag) : 0
      if (norm > 0) {
        // Dirección pura (unit) y snap directo (arcade)
        tmp.joyTarget.set(joyX * inv, 0, joyZ * inv)
        joyMoveRef.current.copy(tmp.joyTarget)
        // Velocidad analógica (0..1) fuera de deadzone, con curva gradual
        inputMag = Math.max(0, Math.min(1, Math.pow(norm, JOY_SPEED_CURVE)))
      } else {
        tmp.joyTarget.set(0, 0, 0)
        joyMoveRef.current.copy(tmp.joyTarget)
        inputMag = 0
      }
      // Aplicar magnitud al input para que moveMag refleje velocidad analógica
      xInputRaw = joyMoveRef.current.x * inputMag
      zInputRaw = joyMoveRef.current.z * inputMag
    } else {
      // Al soltar joystick, volver al centro suave para evitar drift/brusquedad
      tmp.joyTarget.set(0, 0, 0)
      joyMoveRef.current.copy(tmp.joyTarget)
    }

    // Base de cámara (sin suavizado) para evitar latencias extra
    const cameraInteracting = (() => { try { return Boolean(window.__cameraInteracting) } catch { return false } })()
    const camForward = tmp.camForward
    const camRight = tmp.camRight
    if (hasJoy && cameraInteracting) {
      if (!joyBasisLockedRef.current) {
        joyBasisLockedRef.current = true
        camera.getWorldDirection(joyBasisForwardRef.current)
        joyBasisForwardRef.current.y = 0
        if (joyBasisForwardRef.current.lengthSq() > 0) joyBasisForwardRef.current.normalize()
        joyBasisRightRef.current.crossVectors(joyBasisForwardRef.current, tmp.up).normalize()
      }
      camForward.copy(joyBasisForwardRef.current)
      camRight.copy(joyBasisRightRef.current)
    } else {
      joyBasisLockedRef.current = false
      camera.getWorldDirection(camForward)
      camForward.y = 0
      if (camForward.lengthSq() > 0) camForward.normalize()
      camRight.crossVectors(camForward, tmp.up).normalize()
    }

    // Desired move direction relative to cámara directa
    const xInput = xInputRaw
    const zInput = zInputRaw
    const desiredDir = tmp.desiredDir
    desiredDir.set(0, 0, 0)
    desiredDir.addScaledVector(camForward, zInput)
    desiredDir.addScaledVector(camRight, xInput)
    const dirLen = Math.sqrt(desiredDir.x * desiredDir.x + desiredDir.z * desiredDir.z)
    const moveMag = Math.min(1, dirLen)
    if (dirLen > 1e-6) desiredDir.multiplyScalar(1 / dirLen) // unit direction
    const direction = desiredDir // unit
    // limpiar memoria para no interferir con comportamientos previos
    try {
      // No alocar por frame: crear una vez y copiar
      // @ts-ignore
      if (!playerRef.current._lastDir) playerRef.current._lastDir = new THREE.Vector3()
      // @ts-ignore
      playerRef.current._lastDir.copy(desiredDir)
    } catch {}

    const hasInput = moveMag > 0.02
    // Notificar cambio de estado de movimiento
    if (hadInputPrevRef.current !== hasInput) {
      hadInputPrevRef.current = hasInput
      try { if (typeof onMoveStateChange === 'function') onMoveStateChange(hasInput) } catch {}
    }
    // =========================
    // Movimiento + animación deterministas (fixed timestep + interpolación)
    // =========================
    try {
      if (!simInitRef.current) {
        simInitRef.current = true
        simPosRef.current.copy(playerRef.current.position)
        simPrevPosRef.current.copy(playerRef.current.position)
        simYawRef.current = playerRef.current.rotation.y
        simPrevYawRef.current = playerRef.current.rotation.y
      }
    } catch {}

    // Inputs “congelados” para este frame (se aplican a todos los substeps)
    const speedMultiplier = keyboard.shift ? 1.5 : 1.0
    const effectiveSpeed = SPEED * speedMultiplier
    // Joystick analógico: velocidad proporcional a la magnitud
    const effectiveMoveSpeed = effectiveSpeed * Math.max(0, Math.min(1, moveMag))
    // TimeScale con rango limitado para que la animación no se vea antinatural
    // Con SPEED = BASE_SPEED, este valor será ~1.0 en condiciones normales
    const baseWalkScale = THREE.MathUtils.clamp((Math.max(1e-4, effectiveMoveSpeed) / BASE_SPEED) * WALK_TIMESCALE_MULT, WALK_SCALE_MIN, WALK_SCALE_MAX)
    const targetAngle = hasInput && direction.lengthSq() > 1e-8 ? Math.atan2(direction.x, direction.z) : simYawRef.current

    // Acumulador de simulación (fixed timestep clásico)
    // - Mantiene movimiento/animación estables a 60Hz
    // - Permite “catch-up” moderado cuando el render va a 45–55fps
    // - Evita catch-up gigante tras hitches extremos (GC/tab out)
    const MAX_ACCUM = 6 * FIXED_DT // ~100ms máx acumulable
    const dtForAcc = Math.min(dtRaw, MAX_ACCUM)
    simAccRef.current = Math.min(simAccRef.current + dtForAcc, MAX_ACCUM)

    // Preparar acciones una vez por frame
    const idleAction = actions && idleName ? actions[idleName] : null
    const walkAction = actions && walkName ? actions[walkName] : null

    let steps = 0
    const MAX_STEPS = 6
    while (simAccRef.current >= FIXED_DT && steps < MAX_STEPS) {
      const stepDt = FIXED_DT

      // Guardar “prev” EXACTAMENTE antes del step (clave para interpolación fluida)
      simPrevPosRef.current.copy(simPosRef.current)
      simPrevYawRef.current = simYawRef.current

      // Rotación y movimiento
      if (hasInput) {
        // Rotación con damp() frame-rate independent
        // Lambda ~20 = giro suave, ~30 = más inmediato
        const ROT_LAMBDA = 22.0
        simYawRef.current = dampAngleWrapped(simYawRef.current, targetAngle, ROT_LAMBDA, stepDt)
        // Movimiento tipo desktop: sin aceleración analógica
        simPosRef.current.addScaledVector(direction, effectiveMoveSpeed * stepDt)
      }

      // Blend animación con substeps (estable) usando damp() frame-rate independent
      if (idleAction && walkAction) {
        // Guardia: asegurar loop infinito
        if (idleAction.loop !== THREE.LoopRepeat) idleAction.setLoop(THREE.LoopRepeat, Infinity)
        if (walkAction.loop !== THREE.LoopRepeat) walkAction.setLoop(THREE.LoopRepeat, Infinity)
        idleAction.clampWhenFinished = false
        walkAction.clampWhenFinished = false
        idleAction.enabled = true
        walkAction.enabled = true

        // Target weight: 1 cuando hay input, 0 cuando idle
        const targetWeight = hasInput ? Math.max(0, Math.min(1, moveMag)) : 0
        // damp() es frame-rate independent por diseño
        // BLEND_LAMBDA ~10 = transición suave (~0.3s), ~15 = más rápida (~0.2s)
        walkWeightRef.current = THREE.MathUtils.damp(
          walkWeightRef.current,
          targetWeight,
          BLEND_LAMBDA,
          stepDt,
        )
        // Clamp para evitar valores fuera de rango por errores numéricos
        walkWeightRef.current = THREE.MathUtils.clamp(walkWeightRef.current, 0, 1)

        const walkW = walkWeightRef.current
        const idleW = 1 - walkW
        walkAction.setEffectiveWeight(walkW)
        idleAction.setEffectiveWeight(idleW)

        // TimeScale de walk proporcional al peso para transición fluida
        const animScale = THREE.MathUtils.lerp(1, baseWalkScale, walkW)
        walkAction.setEffectiveTimeScale(animScale)
        idleAction.setEffectiveTimeScale(IDLE_TIMESCALE)

        // Avanzar el mixer manualmente con timestep fijo (el auto-update está congelado)
        try {
          if (mixer) {
            mixer.timeScale = 1
            mixer.update(stepDt)
            mixer.timeScale = 0
          }
        } catch {}
      }

      simAccRef.current -= stepDt
      steps += 1
    }

    // Debug dev-only: exponer métricas en overlay (GpuStats)
    try {
      if (import.meta.env && import.meta.env.DEV && typeof window !== 'undefined') {
        // @ts-ignore
        window.__playerDebug = {
          dtRaw,
          dtUsed: dtForAcc,
          steps,
          acc: simAccRef.current,
          alpha: THREE.MathUtils.clamp(simAccRef.current / FIXED_DT, 0, 1),
          hasInput,
          walkW: walkWeightRef.current,
        }
      }
    } catch {}

    // Render: interpolación canónica (como en videojuegos)
    // alpha = cuánto hemos avanzado desde el último step hacia el siguiente.
    const alpha = THREE.MathUtils.clamp(simAccRef.current / FIXED_DT, 0, 1)
    tmp.renderPos.lerpVectors(simPrevPosRef.current, simPosRef.current, alpha)
    playerRef.current.position.copy(tmp.renderPos)
    playerRef.current.rotation.y = lerpAngleWrapped(simPrevYawRef.current, simYawRef.current, alpha)

    // Ajustes post-sim (seam + footsteps) con estado final del frame
    if (idleAction && walkAction) {
      try {
        const d = Math.max(1e-3, walkDurationRef.current)
        const t = walkAction.time % d
        const eps = 1e-3
        if (t < eps) walkAction.time = eps
        else if (d - t < eps) walkAction.time = d - eps
      } catch {}

      // Detección de pasos: sólo cuando hay input y el peso de caminar es alto
      try {
        const walkWeight = walkWeightRef.current
        if (hasInput && walkWeight > 0.5) {
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
          const d = Math.max(1e-3, walkDurationRef.current)
          const t = (walkAction?.time || 0) % d
          prevWalkNormRef.current = t / d
        }
      } catch {}
    }

    // Check proximity to each portal. Trigger enter callback within
    // a small threshold, and compute a proximity factor for scene tinting.
    let minDistance = Infinity
    const perPortal = {}
    const nowS = state.clock.getElapsedTime()
    let nearestId = null
    let nearestDist = Infinity
    portals.forEach((portal) => {
      const portalPos = tmp.portalPos
      portalPos.fromArray(portal.position)
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
      // Canal en tiempo real (no-React): para UI fluida en mobile sin re-render del App
      try { window.__powerFillLive = THREE.MathUtils.clamp(chargeRef.current, 0, 1) } catch {}
      if (typeof onActionCooldown === 'function') {
        // Reusar canal para UI: enviar (1 - charge) para que el fill muestre 'charge'
        // IMPORTANT: throttlear para evitar que App re-renderice 60 veces/seg (sloppy en mobile).
        const v = 1 - THREE.MathUtils.clamp(chargeRef.current, 0, 1)
        const now = state.clock.getElapsedTime()
        const lastV = lastChargeUiRef.current
        const lastT = lastChargeUiTsRef.current
        const minHz = 30 // 30Hz suficiente para sensación fluida
        const minDt = 1 / minHz
        const minStep = 0.015 // umbral de cambio mínimo
        if (lastV < 0 || Math.abs(v - lastV) >= minStep || (now - lastT) >= minDt) {
          lastChargeUiRef.current = v
          lastChargeUiTsRef.current = now
          onActionCooldown(v)
        }
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
      if (prewarm) return
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
      <group ref={playerRef} position={[0, 0, 0]} visible={Boolean(visible && !prewarm)}>
        {/* Character model is always mounted; opacity is controlled via applyModelOpacity */}
        <group ref={modelRootRef} scale={1.5}>
          <primitive object={scene} />
          {/* Piezas rígidas para el easter egg (montadas dinámicamente) */}
          <group ref={piecesRootRef} />
        </group>
        {/* Workaround: voxel shatter + rebuild (simula desarmado) */}
        <instancedMesh
          ref={eggVoxelRef}
          args={[eggVoxelGeo, eggVoxelMat, EGG_VOXEL_MAX]}
          frustumCulled={false}
          renderOrder={50}
          position={[0, 0, 0]}
        />
        {/* Orb sphere + inner sparkles to convey "ser de luz" */}
        <group position={[0, ORB_HEIGHT, 0]}>
          {/* Luz puntual: montada siempre para precalentar pipeline; intensidad 0 cuando no activo */}
          {/* NOTA: esta luz es “glow”/acento; si castea sombras, genera una segunda sombra (duplicada) */}
          <pointLight ref={orbLightRef} intensity={showOrbRef.current ? 6 : 0} distance={12} decay={1.6} />
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
      <SpeechBubble3D
        anchorRef={bubbleAnchorRef}
        visible={prewarm ? false : bubble.visible}
        displayText={bubble.text}
        layoutText={bubble.fullText}
        theme={bubble.theme}
        // Offset relativo a cámara: x=derecha, y=arriba, z=hacia delante de cámara
        // Queremos: al lado derecho del personaje y no tan arriba
        // Más separación horizontal para que jamás toque el personaje
        offset={[1.55, 0.88, 0]}
      />
      {/* World-space sparks trail (not parented to player) */}
      {/* Mount spark shader always (drawRange 0 when idle) to avoid first-use jank */}
      <TrailSparks />
    </>
  )
}

// Preload the model for faster subsequent loading
useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`)