import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import useKeyboard from './useKeyboard.js'
import { playSfx, preloadSfx } from '../lib/sfx.js'
import SpeechBubble3D from './SpeechBubble3D.jsx'
import ChargeBar3D from './ChargeBar3D.jsx'
import useSpeechBubbles from './useSpeechBubbles.js'
import { extendGLTFLoaderKTX2, detectKTX2Support } from '../lib/ktx2Setup.js'
import LightningBolt from './fx/LightningBolt.jsx'
import makeHullOutline from '../lib/makeHullOutline.js'
import { applyToonBanding } from '../lib/toonBanding.js'
import { applyCharacterColorsToScene, getCharacterColors, CHARACTER_COLOR_EVENT, EYES_ORB_ONLY } from '../lib/characterColors.js'
import { applyCharacterSkinShader, materialTakesSkin, skinLineColor, SKIN_LINE_COLOR_EVENT, getSkinForcedColors, getCurrentSkinMode } from '../lib/skinShaders.js'

// Stable refs for the lightning bolt endpoints — module-level so they don't
// allocate a new array each render (the bolt geometry keys off these values).
const LIGHTNING_TOP = [0, 22, 0]
const LIGHTNING_BOTTOM = [0, 0.05, 0]

// Expose a module-level global helper so it runs even if the component never mounts.
// This avoids the case where a render/Canvas error prevents useEffect from running.
try {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__playerDisassemble = window.__playerDisassemble || {
      trigger: () => { try { window.dispatchEvent(new Event('player-disassemble')) } catch { } },
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
} catch { }

// Angle interpolation with wrapping (avoids jumps when crossing ±π)
function lerpAngleWrapped(current, target, t) {
  const TAU = Math.PI * 2
  let delta = ((target - current + Math.PI) % TAU) - Math.PI
  return current + delta * t
}

// Frame-rate independent angle interpolation using damp()
// lambda: higher = faster convergence (typical 5-30)
function dampAngleWrapped(current, target, lambda, dt) {
  const TAU = Math.PI * 2
  let delta = ((target - current + Math.PI) % TAU) - Math.PI
  // damp formula: current + (target - current) * (1 - exp(-lambda * dt))
  // here target-current = delta (already normalized)
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
  // Prewarm: mount Player during preloader (warm up CPU/JS) without rendering or running per-frame logic
  prewarm = false,
  visible = true,
  // Callback to expose meshes (used for outline postprocessing)
  onMeshesReady,
  // Geometric outline (can be disabled for better performance)
  outlineEnabled = true,
  // When true, applies gold material tint to the existing character model
  goldSkinActive = false,
  // When true, triggers a voxel shatter→rebuild animation with gold particles for the skin swap
  goldSkinTransformActive = false,
  // When true, the character customizer is open: freeze locomotion (idle keeps
  // playing) so the posed front camera can frame the character.
  customizeActive = false,
  // True cuando el usuario ya entró a la escena (pasó el boot terminal). Player se
  // monta en prewarm detrás del preloader; sin esto el reloj de viñetas correría oculto.
  homeLanded = true,
}) {
  // Synced ref so the per-frame loop reads the latest value without re-subscribing.
  const customizeActiveRef = useRef(false)
  useEffect(() => { customizeActiveRef.current = !!customizeActive }, [customizeActive])
  // Disassembly (easter egg) DISABLED: caused intermittent material/visibility states.
  // New workaround: instanced fragment FX + brief character hide (no reparenting, no material mutation).
  const DISASSEMBLE_ENABLED = false
  // Load the GLB character; preloading ensures the asset is cached when
  // imported elsewhere.  The model contains two animations: idle and walk.
  const { gl } = useThree()
  // Detect GPU compressed-texture support once per renderer
  useEffect(() => { detectKTX2Support(gl) }, [gl])

  // ALWAYS load the base model for its animations (gold GLB may not embed clips)
  const baseGltf = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true, true, extendGLTFLoaderKTX2,
  )

  // Gold ya NO es un GLB aparte — es un shader (modo 6 en skinShaders.js) sobre
  // el modelo base. Siempre usamos la escena base; el shader dorado se activa por
  // uniform (uSkinMode) → el rig/huesos no cambian (la viñeta sigue la cabeza).
  const originalScene = baseGltf.scene
  const baseAnimations = baseGltf.animations

  // CRITICAL: Clone the scene so we don't pollute the cached GLB with outline meshes.
  const scene = useMemo(() => SkeletonUtils.clone(originalScene), [originalScene])

  // CRITICAL: Clone animation clips per scene swap. Three.js AnimationClips cache
  // PropertyBinding objects that reference specific skeleton nodes. When the scene
  // changes, stale bindings prevent animations from playing → T-pose.
  const animations = useMemo(
    () => baseAnimations.map((clip) => clip.clone()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseAnimations, originalScene],
  )

  const { actions, mixer } = useAnimations(animations, scene)
  const walkDurationRef = useRef(1)
  const idleDurationRef = useRef(1)
  const { camera } = useThree()
  const emissiveBaseRef = useRef(new WeakMap())
  // IMPORTANT: Do NOT boost emissive globally. The GLB is cached by useGLTF and materials
  // may be shared between Player and CharacterPortrait; mutating them here makes all characters glow.
  // We only capture the base for possible local effects (without altering the default look).
  const seedEmissiveBase = useCallback((m) => {
    try {
      if (!m || !m.emissive) return
      const map = emissiveBaseRef.current
      if (map.get(m)) return
      map.set(m, {
        color: m.emissive?.clone?.() || new THREE.Color(0, 0, 0),
        intensity: typeof m.emissiveIntensity === 'number' ? m.emissiveIntensity : 1,
      })
    } catch { }
  }, [])

  // Clone materials per Player instance to avoid cross-bleed with other uses of the same cached GLB.
  const clonedMaterialsOnceRef = useRef(false)
  // Track previous scene identity to re-clone materials on model swap
  const prevSceneIdRef = useRef(null)

  const meshesCollectedRef = useRef(false)
  useEffect(() => {
    if (!scene) return
    // Reset flags when the scene identity changes (model swap)
    const sceneId = originalScene?.uuid || null
    if (prevSceneIdRef.current !== null && prevSceneIdRef.current !== sceneId) {
      clonedMaterialsOnceRef.current = false
      meshesCollectedRef.current = false
      // Reset opacity cache so applyModelOpacity(1) always runs after swap
      lastAppliedOpacityRef.current = -1
      // Reset outline refs so the outline effect re-runs for the new scene
      try { outlineAddedRef.current = false } catch { }
      try {
        // Remove old outline meshes that belong to the previous scene
        outlineMeshesRef.current.forEach((m) => { try { if (m?.parent) m.parent.remove(m) } catch { } })
        outlineMeshesRef.current = []
      } catch { }
    }
    prevSceneIdRef.current = sceneId
    if (clonedMaterialsOnceRef.current) return
    clonedMaterialsOnceRef.current = true
    const collectedMeshes = []
    try {
      scene.traverse((obj) => {
        // @ts-ignore
        if (!obj || (!obj.isMesh && !obj.isSkinnedMesh) || !obj.material) return

        collectedMeshes.push(obj)
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        // Se detecta dentro del map de materiales pero el flag se guarda en el
        // MESH (obj), no en el material — applyModelOpacity necesita decidir
        // por mesh (obj.visible), no por material.
        let isPupilMesh = false
        const cloned = mats.map((m) => {
          try {
            const mm = (m && m.isMaterial && typeof m.clone === 'function') ? m.clone() : m
            // preserve skinning if applicable
            // @ts-ignore
            if (obj.isSkinnedMesh && mm && mm.isMaterial && 'skinning' in mm) mm.skinning = true

            try { seedEmissiveBase(mm) } catch { }
            // Pupilas full toon: negro plano sin brillo (el material "Pupils" del
            // GLB tiene roughness 0 → reflejo especular). MeshBasic = unlit, negro
            // puro, cero highlight. Skinning se aplica solo en SkinnedMesh.
            if (mm && mm.name && /pupil/i.test(mm.name)) {
              isPupilMesh = true
              const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })
              // Preserva el nombre "Pupils" en el material reemplazado — el
              // clasificador de despiece (Eye_cluster) lo usa como señal
              // primaria, independiente del color negro (que sí se reusa
              // como fallback pero no debe ser la única señal).
              pupilMat.name = mm.name
              return pupilMat
            }
            // Cel-shading: para que el corte luz/sombra se note, la luz
            // direccional (key light) debe DOMINAR sobre el IBL. Bajamos el
            // envMapIntensity (el IBL queda como relleno tenue) y bandeamos el
            // difuso total → el gradiente N·L de la key light se cuantiza en
            // bandas nítidas. minBand evita que la sombra caiga a negro.
            try {
              if (mm && mm.isMaterial && 'metalness' in mm) {
                // Personaje DESACOPLADO del HDRI: el IBL omnidireccional lavaba
                // las sombras del toon (la cara en sombra caía en la banda media
                // en vez de la negra). Casi sin IBL, la iluminación la define la
                // key+fill cámara-relativas (ToonKeyLight) → bandas profundas y
                // consistentes como el retrato. El HDRI se conserva para el
                // ESCENARIO (orbes/portales/ambiente), solo el personaje lo ignora.
                if ('envMapIntensity' in mm) mm.envMapIntensity = 0.08
                // Skins animadas por shader (oil/hologram/void/lava/slime/gold)
                // sobre el modelo base — solo Head/Hair. ANTES del banding para
                // que module el albedo aguas arriba (skinShaders.js). Gold ahora
                // también es shader (modo 6) → se aplica igual.
                if (materialTakesSkin(mm)) {
                  try { applyCharacterSkinShader(mm) } catch { }
                }
                // Look toon: banding plano + ink lines internas por derivada de
                // la normal GEOMÉTRICA (vNormal, sin el normal-map de grunge) →
                // capta pliegues de la malla (costillas/nariz) sin ruido.
                // Normalizado por distancia → invariante al zoom.
                // Ink runtime por fwidth desactivado (revelaba los triángulos de
                // la malla low-poly). Las líneas estilo planetono/Hi-Fi Rush son
                // inverted-hull (geometría) por silueta + bordes de pieza.
                applyToonBanding(mm, { steps: 2, minBand: 0.04, bandIndirect: true })
              }
            } catch { }
            return mm
          } catch {
            return m
          }
        })
        // @ts-ignore
        obj.material = Array.isArray(obj.material) ? cloned : cloned[0]
        // Marca el mesh dueño de las pupilas: applyModelOpacity lo trata igual
        // que los `_outline` (visible=opacity>0.01) para que un material de
        // pupilas revivido/recreado fuera del useFrame (ej. con el frameloop
        // pausado al aterrizar en una sección) no quede visible para siempre —
        // el mesh.visible manda sin depender de un traverse por frame.
        if (isPupilMesh) obj.userData.__isPupilMesh = true
      })
    } catch { }
    // Notify meshes for outline (only once)
    if (!meshesCollectedRef.current && collectedMeshes.length > 0 && onMeshesReady) {
      meshesCollectedRef.current = true
      try { onMeshesReady(collectedMeshes) } catch { }
    }

  }, [scene, seedEmissiveBase, onMeshesReady])

  // Personalización de color (ojos / esqueleto / pelo). Se aplica al montar y
  // en cada cambio del menú. Cambiar .color/.emissive es un uniform → no
  // recompila el shader (el banding reescala por luminancia, conserva el look
  // toon). La skin dorada NO se recolorea (tiene su propia lógica de metalness).
  useEffect(() => {
    if (!scene) return
    const apply = () => {
      try {
        const forced = getSkinForcedColors() // ej. void → ojos/orb blancos; slime → ojos morados
        const stored = getCharacterColors()
        const colors = forced ? { ...stored, ...forced } : stored
        // gold / skins shader → solo ojos+orb (el cuerpo lo define la skin). Si la
        // skin fuerza keys (void/slime), forced sobreescribe esas; el resto de
        // ojos/orb queda editable (ej. slime: ojos morados forzados + orb del user).
        const allow = (forced || goldSkinActive) ? EYES_ORB_ONLY : null
        applyCharacterColorsToScene(scene, colors, allow)
      } catch { }
    }
    apply() // estado inicial (cubre re-clone tras swap de modelo)
    window.addEventListener(CHARACTER_COLOR_EVENT, apply)
    window.addEventListener(SKIN_LINE_COLOR_EVENT, apply) // re-aplica al cambiar skin
    return () => {
      window.removeEventListener(CHARACTER_COLOR_EVENT, apply)
      window.removeEventListener(SKIN_LINE_COLOR_EVENT, apply)
    }
  }, [scene, goldSkinActive])

  // ── Precompilación de shaders del personaje (anti-hitch del "ENTER") ──
  //
  // El grupo del jugador se monta con `visible={visible && !prewarm}`, o sea
  // INVISIBLE durante todo el preloader. three salta los objetos invisibles al
  // renderizar (projectObject hace `if (object.visible === false) return`), así
  // que los programas GPU reales del personaje —PBR + toon banding + skin
  // shader + los hulls de outline— no se compilaban NUNCA hasta el primer
  // frame en que aparece, que es exactamente el momento del ENTER. De ahí el
  // tirón al entrar.
  //
  // Los `gl.compile()` que ya existían (CharacterNormalPass, SilhouetteShadow)
  // no cubren esto: cambian el material por uno descartable (MeshNormalMaterial
  // / MeshBasicMaterial) ANTES de compilar, así que calientan otros programas.
  //
  // `compile()` recorre con `scene.traverse`, NO con `traverseVisible`, así que
  // compila aunque el grupo esté oculto. `compileAsync` usa la extensión
  // KHR_parallel_shader_compile cuando existe → no bloquea el hilo principal.
  // DESACTIVADO: compilar el grupo entero acá rompe el material de outline.
  // Ver nota abajo antes de reintentar.
  // const r3fScene = useThree((s) => s.scene)
  // const prewarmCompiledRef = useRef(false)
  // useEffect(() => { ... gl.compileAsync(root, camera, r3fScene) ... }, [...])

  // (Gold ya no es un GLB con metalness forzado: ahora es un shader procedural
  // —modo 6 en skinShaders.js— sobre el modelo base. El look dorado lo define el
  // fragment; no hace falta lock de metalness/env por material.)

  // ----------------------------
  // Workaround: Voxel Shatter + Rebuild (game-style, without touching rig/model)
  // ----------------------------
  const EGG_VOXEL_MAX = 620
  const EGG_VOXEL_SCALE_BASE = 0.06
  const EGG_VOXEL_SCALE_RAND = 0.07
  // Randomness for the burst (so it never looks the same twice)
  const EGG_VOXEL_EXPLODE_RAND_DIR = 0.88 // 0..1 blend toward random direction
  const EGG_VOXEL_EXPLODE_UP_BIAS = 0.55  // 0..1 upward bias (spray cone)
  // FX timings (single source-of-truth so fallback does not cut the animation)
  // Faster timings (feeling of "never finishes" is usually due to perceived excessive duration)
  const EGG_VOXEL_EXPLODE_S = 0.65
  const EGG_VOXEL_DRIFT_S = 0.45
  const EGG_VOXEL_REBUILD_S = 1.15
  // Cinematic after-snap: hold (fully assembled) first, then dissolve + reveal the model
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
  // IMPORTANT: avoid a setTimeout fallback that could cut the animation when the tab is paused.
  // To guarantee it ALWAYS finishes, we rely solely on the useFrame timeline.
  const eggVoxelHideTimerRef = useRef(null)

  const eggVoxelPiecesRef = useRef([])
  // Freeze movement while the body is not reassembled
  const eggFreezeActiveRef = useRef(false)
  const eggFreezePosRef = useRef(new THREE.Vector3())
  // Hard visibility lock: while active, the model must NOT appear (even if other flows call applyModelOpacity(1))
  const eggHideLockRef = useRef(false)
  // Force-hide the character until the reveal starts (prevents appearing before reassembly)
  const eggHideForceRef = useRef(false)
  // If the easter egg ends while the FX is running, do NOT interrupt: let it finish, then restore.
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
    try { m.depthWrite = false } catch { }
    return m
  }, [])

  const buildVoxelTargetsProcedural = useCallback((N) => {
    // Fallback: procedural humanoid (in player local space)
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
    // Preferred: targets based on real rig bones (in player local space).
    // This makes the reconstruction match the actual avatar size.
    const out = []
    const p = playerRef?.current
    if (!scene || !p) return null
    try {
      p.updateMatrixWorld?.(true)
      scene.updateMatrixWorld?.(true)
    } catch { }
    const bones = []
    const wp = new THREE.Vector3()
    try {
      scene.traverse((o) => {
        if (!o || !o.isBone) return
        bones.push(o)
      })
    } catch { }
    if (bones.length < 6) return null

    // Cache bone positions in player local space
    const boneLocal = []
    for (let i = 0; i < bones.length; i += 1) {
      try {
        bones[i].getWorldPosition(wp)
        const lp = wp.clone()
        p.worldToLocal(lp)

        if (Number.isFinite(lp.x) && Number.isFinite(lp.y) && Number.isFinite(lp.z)) boneLocal.push(lp)
      } catch { }
    }
    if (boneLocal.length < 6) return null

    // Per-voxel jitter around the bone (for volume)
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

  // Init once: material ref + offscreen matrices + DynamicDrawUsage
  useEffect(() => {
    try { eggVoxelMatRef.current = eggVoxelMat } catch { }
    const mesh = eggVoxelRef.current
    if (!mesh || eggVoxelInitRef.current) return
    eggVoxelInitRef.current = true
    try { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage) } catch { }
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
    } catch { }
  }, [eggVoxelMat])

  const startEggVoxelFx = useCallback(() => {
    const mesh = eggVoxelRef.current
    if (!mesh) return
    // Freeze the player in place (no walking during dis/reassembly)
    try {
      if (playerRef?.current?.position) eggFreezePosRef.current.copy(playerRef.current.position)
      eggFreezeActiveRef.current = true
      eggHideLockRef.current = true
      eggHideForceRef.current = true
    } catch { }
    const N = EGG_VOXEL_MAX
    const targets = buildVoxelTargetsFromBones(N) || buildVoxelTargetsProcedural(N)
    const pieces = []
    // Global random burst per activation so the pattern never repeats identically
    const burstQ = new THREE.Quaternion()
    try {
      const yaw = Math.random() * Math.PI * 2
      const tilt = (Math.random() - 0.5) * 0.7
      burstQ.setFromEuler(new THREE.Euler(tilt, yaw, 0))
    } catch { burstQ.identity() }
    const tmpV = new THREE.Vector3()
    const tmpAxis = new THREE.Vector3()
    // Spawn already assembled, then explode
    for (let i = 0; i < N; i += 1) {
      const target = targets[i] || new THREE.Vector3(0, 1, 0)
      const pos = target.clone()
      // radial impulse from torso center
      const center = new THREE.Vector3(0, 1.05, 0)
      const radial = pos.clone().sub(center).applyQuaternion(burstQ)
      if (radial.lengthSq() < 1e-6) radial.set(0, 0.5, 1)
      radial.normalize()
      // random direction (with upward bias for explosion look)
      const r = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5)
      if (r.lengthSq() < 1e-6) r.set(0, 1, 0)
      r.normalize()
      r.y = THREE.MathUtils.lerp(r.y, Math.abs(r.y), EGG_VOXEL_EXPLODE_UP_BIAS)
      r.applyQuaternion(burstQ).normalize()
      // blend radial + random so it is not always symmetric
      const mixK = THREE.MathUtils.clamp(EGG_VOXEL_EXPLODE_RAND_DIR + (Math.random() - 0.5) * 0.25, 0, 1)
      const dir = radial.clone().lerp(r, mixK).normalize()
      // extra per-voxel jitter (small) to break banding at the same angle
      try {
        tmpAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        if (tmpAxis.lengthSq() > 1e-6) {
          tmpAxis.normalize()
          const ang = (Math.random() - 0.5) * 0.55
          tmpV.copy(dir).applyAxisAngle(tmpAxis, ang).normalize()
          dir.copy(tmpV)
        }
      } catch { }
      // variable speed (with some spread)
      // bias toward medium/high speeds, with a few slow bits
      const u = Math.random()
      const speed = 2.6 + Math.pow(u, 0.55) * 5.2
      const vel = dir.multiplyScalar(speed)
      vel.y += 1.6 + Math.random() * 1.8

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
    } catch { }
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
    // Reset opacity cache so the next applyModelOpacity(1) is never skipped
    lastAppliedOpacityRef.current = -1
    try {
      if (eggVoxelMatRef.current) {
        eggVoxelMatRef.current.opacity = 0
        eggVoxelMatRef.current.needsUpdate = true
      }
    } catch { }
  }, [])
  // Orb navigation state (transform into luminous sphere and move to target portal)
  const orbActiveRef = useRef(false)
  const [orbActive, setOrbActive] = useState(false)
  const orbTargetPosRef = useRef(new THREE.Vector3())
  const lastPosRef = useRef(new THREE.Vector3())
  const sparksRef = useRef([]) // [{pos:Vector3, vel:Vector3, life:number}]
  const explosionBoostRef = useRef(0)
  const explosionQueueRef = useRef({ sphere: 0, ring: 0, splash: 0, pos: new THREE.Vector3() })
  // Aggressive optimization: reduce max sparks for better performance
  const MAX_SPARKS = 1000
  // Smoothed delta time to avoid visible oscillations in interpolation/blending
  const dtSmoothRef = useRef(1 / 60)
  // Raw movement delta to preserve real-time distance even under FPS drops
  const dtMoveRef = useRef(1 / 60)
  // Fixed timestep for movement + animation (deterministic, no speed wobble in dev)
  const FIXED_DT = 1 / 60
  const simAccRef = useRef(0)
  const simInitRef = useRef(false)
  const simPosRef = useRef(new THREE.Vector3())
  const simPrevPosRef = useRef(new THREE.Vector3())
  const simYawRef = useRef(0)
  const simPrevYawRef = useRef(0)
  const simWasOrbRef = useRef(false)
  // Adaptive speed when FPS is very low
  const avgStepsRef = useRef(0)
  const adaptiveSpeedMultRef = useRef(1.0)
  // Joystick smoothing (mobile): avoids abrupt direction changes
  const joyMoveRef = useRef(new THREE.Vector3(0, 0, 0))
  // When the user rotates the camera while holding the joystick, lock the movement basis
  // to avoid sudden jumps/direction changes.
  const joyBasisLockedRef = useRef(false)
  const joyBasisForwardRef = useRef(new THREE.Vector3())
  const joyBasisRightRef = useRef(new THREE.Vector3())
  // Reuse temporaries to avoid GC spikes (intermittent laggy walking)
  // Massively expanded to eliminate allocations in useFrame
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

    orbDir: new THREE.Vector3(),
    orbSteerDir: new THREE.Vector3(),
    orbUp: new THREE.Vector3(),
    orbSide1: new THREE.Vector3(),
    orbSide2: new THREE.Vector3(),
    orbWobble: new THREE.Vector3(),
    orbWorldPos: new THREE.Vector3(),
    orbMoveVec: new THREE.Vector3(),
    orbForward: new THREE.Vector3(),
    orbBackDir: new THREE.Vector3(),
    orbT1: new THREE.Vector3(),
    orbT2: new THREE.Vector3(),
    orbOffset: new THREE.Vector3(),
    orbBasePos: new THREE.Vector3(),
    orbVel: new THREE.Vector3(),
    orbExplodePos: new THREE.Vector3(),
    orbDirExp: new THREE.Vector3(),
    orbDirRing: new THREE.Vector3(),
    orbDirXZ: new THREE.Vector3(),
    orbVelRing: new THREE.Vector3(),
    orbSparkPos: new THREE.Vector3(),
    orbHeightOffset: new THREE.Vector3(0, 1.0, 0), // ORB_HEIGHT = 1.0

    orbTempColor: new THREE.Color(),
    orbTempColor2: new THREE.Color(),

    disQuat: new THREE.Quaternion(),
    disEuler: new THREE.Euler(),

    dummy: new THREE.Object3D(),
  })

  // CRITICAL: useAnimations (drei) advances the mixer with raw `delta`.
  // To eliminate speed-ups/variations from spikes, we freeze it before drei's frame
  // and advance it manually with our stable dt inside the main loop.
  useFrame(() => {
    try { if (mixer) mixer.timeScale = 0 } catch { }
  }, -1000)
  // Floor glitter effect will be rendered as a separate instanced mesh
  const ORB_SPEED = 22
  const PORTAL_STOP_DIST = 0.9
  const ORB_HEIGHT = 1.0 // visual height of the orb above the player origin
  const ORB_RADIUS = 0.6 // must match the orb sphere (see sphereGeometry args)
  const FALL_STOP_Y = ORB_RADIUS - ORB_HEIGHT // stop fall when the sphere touches the ground
  const HOME_FALL_HEIGHT = 22 // initial height when returning to HOME (moderate fall)
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
  const wobblePhaseRef = useRef(Math.random() * Math.PI * 2)
  const wobblePhase2Ref = useRef(Math.random() * Math.PI * 2)
  const nearTimerRef = useRef(0)
  const lastDistRef = useRef(Infinity)
  const hasExplodedRef = useRef(false)
  // Footstep detection based on walk animation time
  const prevWalkNormRef = useRef(0)
  const nextIsRightRef = useRef(true)
  const footCooldownSRef = useRef(0)
  // Movement state (input) to expose externally
  const hadInputPrevRef = useRef(false)

  // Speech bubble scheduler: uses existing i18n phrases (portrait.phrases)
  // Paused in orb mode to avoid a floating bubble with no character.
  const bubble = useSpeechBubbles({
    // El reloj de viñetas arranca al aterrizar (homeLanded), no detrás del preloader:
    // si no, la primera viñeta (firstDelayMs) expira oculta y el user cae en el gap largo.
    enabled: homeLanded && !orbActive && !customizeActive, // pausa también en orb mode y customize
    phrasesKey: 'portrait.phrases',
    typingCps: 14,
    firstDelayMs: 350,
    // Gap de silencio 18-40s entre viñetas ambient (~8x menos frecuente); la primera sigue saliendo rápido al aterrizar.
    delayMinMs: 18000,
    delayRandMs: 22000,
  })

  // Robust anchor for the speech bubble: prefer bones (Head/Neck), NOT the mesh (which is usually at (0,0,0)).
  const bubbleAnchorRef = useRef(null)
  const bubbleFallbackObjRef = useRef(new THREE.Object3D())
  useEffect(() => {
    // Fallback: an empty attached to the player, above the torso.
    const p = playerRef?.current
    const fallback = bubbleFallbackObjRef.current
    if (!p || !fallback) return
    try {
      if (!fallback.parent) p.add(fallback)
      fallback.position.set(0, 1.85, 0)
      fallback.updateMatrixWorld(true)
      if (!bubbleAnchorRef.current) bubbleAnchorRef.current = fallback
    } catch { }
  }, [playerRef])

  // Anchor de la barra de carga 3D: mismo patrón que bubbleFallbackObjRef pero
  // más arriba (encima de la cabeza, por encima de la viñeta en 1.85).
  const chargeBarAnchorObjRef = useRef(new THREE.Object3D())
  useEffect(() => {
    const p = playerRef?.current
    const anchor = chargeBarAnchorObjRef.current
    if (!p || !anchor) return
    try {
      if (!anchor.parent) p.add(anchor)
      // 2.9: libra el mohawk/pelo — a 2.35 la barra cruzaba la cabeza.
      anchor.position.set(0, 2.9, 0)
      anchor.updateMatrixWorld(true)
    } catch { }
  }, [playerRef])

  useEffect(() => {
    if (!scene) return
    // Anchor to the STABLE empty (root-attached at a fixed height), NOT to the
    // head/neck bone. The bone bobs/sways with the walk cycle, and that periodic
    // motion leaks through the smoothing and makes the bubble vibrate while the
    // character moves — unreadable. The empty follows the player's translation
    // but not the per-bone animation, and sits on the rotation axis (x=z=0) so it
    // doesn't swing when the character turns.
    bubbleAnchorRef.current = bubbleFallbackObjRef.current || null
  }, [scene])

  // Preload basic sfx once
  useEffect(() => {
    preloadSfx(['magiaInicia', 'sparkleBom', 'sparkleFall', 'stepone', 'steptwo'])
  }, [])

  // Simple crossfade: fadeOut when starting orb, fadeIn when finishing
  const fadeOutTRef = useRef(0)
  const fadeInTRef = useRef(1) // Starts at 1 so the character is opaque from the beginning
  const showOrbRef = useRef(false)
  const FADE_OUT = 0.06
  const FADE_IN = 0.06
  // Preserve/restore original material flags during fades.
  // Problem: some "glow" meshes (hand) depend on transparent/blending/depthWrite=false.
  // If we force transparent=false and depthWrite=true when returning to opacity=1, they can disappear.
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

  // Seed materialBaseRef: capture the actual model state on load, before any fade.
  // Prevents the intermittent bug where the first snapshot is taken at opacity=0 and never recovers.
  useEffect(() => {
    if (!scene) return
    try {
      scene.traverse((obj) => {
        // @ts-ignore
        if (!obj || !obj.material) return
        // @ts-ignore
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => { try { rememberMaterialBase(m) } catch { } })
      })
    } catch { }
  }, [scene, rememberMaterialBase])

  // Cache the last applied opacity to avoid unnecessary traversals
  const lastAppliedOpacityRef = useRef(-1)
  const applyModelOpacity = (opacity) => {
    // ALWAYS run the full traversal when opacity >= 1 so material flags
    // (transparent, depthWrite) are unconditionally restored to their base
    // values. Without this, a near-1 value (e.g. 0.997) from the previous
    // frame causes the diff check to skip the restore, leaving materials in
    // a semi-transparent state with depthWrite=false.
    const isFullRestore = opacity >= 1
    if (!isFullRestore) {
      const diff = Math.abs(opacity - lastAppliedOpacityRef.current)
      if (diff < 0.01) return // No significant change for intermediate values
    }
    lastAppliedOpacityRef.current = opacity

    try {
      scene.traverse((obj) => {
        // @ts-ignore
        if (obj.material) {
          // Hide/show outline meshes based on opacity
          if (obj.name && obj.name.endsWith('_outline')) {
            obj.visible = opacity > 0.01
            return
          }
          // Mismo trato para el mesh de pupilas (ver flag en el clonado de
          // materiales, ~línea 205): mesh.visible es la fuente de verdad, no
          // el opacity del material. Si algo revive/recrea el material de
          // pupilas fuera de este traverse (ej. con el frameloop pausado tras
          // aterrizar en una sección), sigue oculto porque visible=false gana
          // sobre cualquier opacity=1 que ese material traiga por default.
          if (obj.userData && obj.userData.__isPupilMesh) {
            obj.visible = opacity > 0.01
            return
          }
          const m = obj.material
          if (Array.isArray(m)) {
            m.forEach((mm) => {
              const base = rememberMaterialBase(mm)
              if (!base) return
              if (isFullRestore) {
                // Restore original flags (critical for emissive/transparent materials)
                mm.transparent = base.transparent
                mm.opacity = base.opacity
                mm.depthWrite = base.depthWrite
              } else {
                mm.transparent = true
                mm.opacity = base.opacity * opacity
                // avoid clipping/artifacts during fade, but respect materials that already skip depth write (glows)
                mm.depthWrite = false
              }
            })
          } else {
            const base = rememberMaterialBase(m)
            if (base) {
              if (isFullRestore) {
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
    } catch { }
  }

  // ----------------------------
  // Easter egg: character disassembly (WITHOUT a second model)
  // Approach: bake SkinnedMesh to rigid meshes at runtime.
  // ----------------------------
  const modelRootRef = useRef(null) // wrapper (same scale as the model)
  const piecesRootRef = useRef(null) // where we mount rigid meshes
  const disassembleActiveRef = useRef(false)
  const eggActiveRef = useRef(false)
  const disassembleRef = useRef({
    phase: 'idle', // 'idle' | 'fall' | 'assemble'
    t: 0,
    floorDelayS: 0.6,
    floorLocalY: 0,
    fallS: 2.2,
    assembleS: 1.4, // reassemble duration — pieces float back to body smoothly
    holdExternal: false, // used by easter egg (keep on the ground until finished)
    maxDelayS: 0, // to sync end of fall when there is stagger
    pieces: [],
    detached: [], // [{ obj, parent }]
    hiddenSkinned: [], // SkinnedMesh originals hidden-in-place when replaced by a rigid bake
  })
  const disassembleDebugRef = useRef({
    enabled: false,
    hold: false, // do not proceed to assemble/cleanup
    normalMaterial: false, // force MeshNormalMaterial for visibility
    noDepthTest: false, // render on top
    axes: false, // show axes on the pieces root
    proxy: false, // replace each piece with a box (geometry debug)
    wire: false, // wireframe unlit to confirm tris
  })

  const readDisassembleDebugFlags = useCallback(() => {
    // Flags via localStorage (can be toggled without redeploy):
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
    // These flags do NOT depend on enabled (we want them to work even without logging)
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
      } catch { }
      try {
        if (camera) {
          const cw = new THREE.Vector3()
          camera.getWorldPosition(cw)
          out.cameraWorld = { x: cw.x, y: cw.y, z: cw.z }
        }
      } catch { }
      if (!root) return out
      try { out.piecesChildren = piecesRootRef.current?.children?.length || 0 } catch { }
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

  // Expose debug helpers for console (cannot reference startDisassemble here; TDZ).
  // The direct trigger is hooked below, after startDisassemble is declared.
  useEffect(() => {
    try {
      // @ts-ignore
      window.__playerDisassemble = {
        snapshot: () => snapshotDisassemble(),
        flags: () => readDisassembleDebugFlags(),

        trigger: () => { try { window.dispatchEvent(new Event('player-disassemble')) } catch { } },
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
    } catch { }
  }, [readDisassembleDebugFlags, snapshotDisassemble])

  const createRigidMaterial = useCallback((src) => {
    try {
      if (!src) return new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff') })
      if (Array.isArray(src)) return src.map((m) => createRigidMaterial(m))
      const m = src
      // Prefer cloning the original material to preserve the look (toon, etc.)
      if (m && m.isMaterial && typeof m.clone === 'function') {
        const out = m.clone()

        try { if ('skinning' in out) out.skinning = false } catch { }
        try { if ('morphTargets' in out) out.morphTargets = false } catch { }
        try { if ('morphNormals' in out) out.morphNormals = false } catch { }

        // CRITICAL: scrub any residual shader injections from the gold-reveal
        // wipe, the outline hull, etc. The clone inherits onBeforeCompile
        // and userData by reference; if a stale uRevealY uniform is at the
        // start-of-wipe value (-0.5), the fragment shader `discard`s every
        // vertex above that Y → rigids render as invisible / black patches.
        try { out.onBeforeCompile = () => {} } catch { }
        try { out.customProgramCacheKey = () => 'rigid_piece' } catch { }
        try { out.userData = {} } catch { }

        try { out.transparent = false } catch { }
        try { out.opacity = 1 } catch { }
        try { out.depthWrite = true } catch { }
        try { out.depthTest = true } catch { }
        try { out.colorWrite = true } catch { }
        // FrontSide with backface reveal leaves black "inside tube" patches on
        // hollow pieces (humerus, femur, etc.). Force DoubleSide so the
        // interior walls are lit from both directions.
        try { out.side = THREE.DoubleSide } catch { }
        // Preserve the gold skin's emissive pop; no tone mapping on rigids.
        try { out.toneMapped = false } catch { }
        // Lock metalness/roughness to values that keep the gold look on rigid
        // fragments (the gold-skin enforcement loop targets the original
        // materials by reference; rigids use clones that bypass it).
        try { if ('metalness' in out) out.metalness = Math.max(out.metalness || 0, 0.4) } catch { }
        try { if ('roughness' in out) out.roughness = Math.min(out.roughness != null ? out.roughness : 1, 0.65) } catch { }
        // envMap bajo + banding → las piezas conservan el look toon (el scrub de
        // onBeforeCompile arriba quitó el banding; lo re-inyectamos limpio aquí).
        // Mismo valor reducido que el cuerpo (0.08) — personaje desacoplado del HDRI.
        try { if ('envMapIntensity' in out) out.envMapIntensity = 0.08 } catch { }
        // Skin shader (oil/hologram/void/lava): el scrub de onBeforeCompile + el
        // userData={} arriba lo borraron → lo re-inyectamos a las piezas Head/Hair
        // para que el desarme conserve la skin. Solo si hay una skin SHADER activa
        // (mode>0); base/gold = mode 0 → sin shader (las piezas usan su look propio).
        // ANTES del banding para que module el albedo aguas arriba.
        try {
          if ('metalness' in out && getCurrentSkinMode() > 0 && materialTakesSkin(out)) {
            applyCharacterSkinShader(out)
          }
        } catch { }
        try { if ('metalness' in out) applyToonBanding(out, { steps: 2, minBand: 0.04, bandIndirect: true }) } catch { }
        try { out.needsUpdate = true } catch { }
        return out
      }

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
    const srcPos = srcGeo.attributes?.position
    if (!srcPos) return srcGeo.clone()
    // CRITICAL: clone the geometry but REPLACE the position attribute with a
    // fresh Float32Array. The source is stored as normalized Int16 (KHR_mesh_
    // quantization). Writing skinned float values back into an Int16 typed
    // array truncates them to 0/±1 integers → every vertex collapses to the
    // origin and pieces render as an overlapping blob at (0,0,0).
    const geo = srcGeo.clone()
    try { geo.deleteAttribute('skinIndex') } catch { }
    try { geo.deleteAttribute('skinWeight') } catch { }
    const count = srcPos.count
    const floatArr = new Float32Array(count * 3)
    const floatAttr = new THREE.BufferAttribute(floatArr, 3, false)
    geo.setAttribute('position', floatAttr)

    const applyBone = typeof skinnedMesh.applyBoneTransform === 'function'
      ? skinnedMesh.applyBoneTransform.bind(skinnedMesh)
      : (typeof skinnedMesh.boneTransform === 'function'
          ? skinnedMesh.boneTransform.bind(skinnedMesh)
          : null)
    try { skinnedMesh.skeleton?.update?.() } catch { }
    try { skinnedMesh.updateMatrixWorld(true) } catch { }
    const mw = skinnedMesh.matrixWorld
    const tmpV = new THREE.Vector3()
    if (applyBone) {
      for (let i = 0; i < count; i += 1) {
        // fromBufferAttribute on a normalized Int16 attribute returns the
        // denormalized [-1, 1] float value — correct input for skinning math.
        tmpV.fromBufferAttribute(srcPos, i)
        applyBone(i, tmpV)     // mesh-local deformed
        tmpV.applyMatrix4(mw)  // → world space
        floatArr[i * 3 + 0] = tmpV.x
        floatArr[i * 3 + 1] = tmpV.y
        floatArr[i * 3 + 2] = tmpV.z
      }
    } else {
      for (let i = 0; i < count; i += 1) {
        tmpV.fromBufferAttribute(srcPos, i).applyMatrix4(mw)
        floatArr[i * 3 + 0] = tmpV.x
        floatArr[i * 3 + 1] = tmpV.y
        floatArr[i * 3 + 2] = tmpV.z
      }
    }
    floatAttr.needsUpdate = true

    // Bake NORMALS too — preserve the original smooth shading the GLB had.
    // computeVertexNormals produces facet normals that give metallic materials
    // dark patches; transforming the source normals by the same matrixWorld
    // rotation (no scale/translation) keeps the smooth look.
    const srcNormal = srcGeo.attributes?.normal
    if (srcNormal) {
      const normalArr = new Float32Array(count * 3)
      const normalAttr = new THREE.BufferAttribute(normalArr, 3, false)
      // Rotation-only matrix from mw (discards translation + scale).
      const normalMat = new THREE.Matrix3().getNormalMatrix(mw)
      const tmpN = new THREE.Vector3()
      for (let i = 0; i < count; i += 1) {
        tmpN.fromBufferAttribute(srcNormal, i)
        tmpN.applyMatrix3(normalMat).normalize()
        normalArr[i * 3 + 0] = tmpN.x
        normalArr[i * 3 + 1] = tmpN.y
        normalArr[i * 3 + 2] = tmpN.z
      }
      geo.setAttribute('normal', normalAttr)
    } else {
      try { geo.computeVertexNormals() } catch { }
    }

    try { geo.computeBoundingSphere() } catch { }
    try { geo.computeBoundingBox() } catch { }
    return geo
  }, [])

  const getEggTagFromAncestors = useCallback((obj) => {
    try {
      let p = obj
      let hops = 0
      // Note: in complex rigs the mesh can be 10+ levels deep from the Egg_ group.
      while (p && hops < 30) {
        const pn = (p?.name || '').toString()
        if (pn && (pn.startsWith('Egg_') || pn.includes('Egg_'))) return pn
        p = p.parent
        hops += 1
      }
    } catch { }
    return ''
  }, [])

  const collectAuthoredRigidPieces = useCallback((root) => {
    // Support for a more robust approach: rigid pieces already baked in Blender,
    // exported INSIDE the same character.glb.
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
    } catch { }
    return out
  }, [])

  const splitGeometryByGroupsOrIslands = useCallback((geo, material) => {
    // Returns: [{ geo, materialIndex }]
    // - If groups exist, materialIndex is respected (multi-material)
    // - Otherwise, attempts to separate by islands (disconnected components)
    try {
      const out = []
      const groups = Array.isArray(geo?.groups) ? geo.groups : []
      const hasIndex = !!geo?.index?.array

      const pushSubset = (subsetGeo, materialIndex = 0) => {
        out.push({ geo: subsetGeo, materialIndex })
      }

      // Helper: extract subset by indices (remapping used vertices)
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
        try { dst.computeBoundingSphere() } catch { }
        try { dst.computeBoundingBox() } catch { }
        // Normals: keep if present, otherwise recompute
        if (!dst.getAttribute('normal')) {
          try { dst.computeVertexNormals() } catch { }
        }
        return dst
      }

      // Helper: partition triangles into chunks by centroid (avoids single-triangle pieces from seams)
      const chunkByCentroid = (srcGeo, chunkCount = 14) => {
        try {
          if (!srcGeo?.index?.array) return [{ geo: srcGeo, materialIndex: 0 }]
          const idx = srcGeo.index.array
          const pos = srcGeo.getAttribute('position')
          if (!pos || pos.count < 3) return [{ geo: srcGeo, materialIndex: 0 }]
          const triCount = Math.floor(idx.length / 3)
          if (triCount < 120) return [{ geo: srcGeo, materialIndex: 0 }]

          // Choose primary axis by bbox extent
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
          } catch { }

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

      // 1) Prefer groups (multi-material or natural export pieces)
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

      // 2) If no groups, prefer chunks by centroid (visible large pieces)
      // This prevents seams/vertex duplication from turning the mesh into hundreds of tiny islands.
      if (hasIndex) {
        const centroidChunks = chunkByCentroid(geo, 14)
        if (centroidChunks.length > 1) return centroidChunks
      }

      // 3) If no groups, separate by islands (only if indexed)
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

      // Union-Find over vertices (islands = disconnected components)
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

      // Sort by size and limit pieces to avoid drawcall explosion
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

      // If all were small, at least keep some large islands
      if (!kept.length) {
        for (let i = 0; i < Math.min(MAX_PIECES, comps.length); i += 1) kept.push(comps[i])
      }

      // Build geometries per component (and merge spill into the last one)
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
        // Merge spill into the last piece to avoid losing too much volume
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

  // Bone-group disassembly split — produces one rigid piece per limb group
  // (head, torso, arms, forearms, hands, thighs, shins, feet). Uses skin weights
  // to partition triangles by their dominant bone, so pieces match natural body
  // parts rather than spatial chunks. Returns [{ geo, materialIndex, groupId }]
  // or null if the mesh lacks skin attributes or produced <2 groups.
  const splitGeometryByBoneGroups = useCallback((skinnedMesh, bakedGeo) => {
    try {
      if (!skinnedMesh || !bakedGeo) return null
      const srcSkinGeo = skinnedMesh.geometry
      const siAttr = srcSkinGeo?.getAttribute('skinIndex')
      const swAttr = srcSkinGeo?.getAttribute('skinWeight')
      const idxAttr = bakedGeo.getIndex()
      const posAttr = bakedGeo.getAttribute('position')
      const bones = skinnedMesh.skeleton?.bones
      if (!siAttr || !swAttr || !idxAttr || !posAttr || !bones || !bones.length) return null
      // Vertex counts must match (bakeSkinnedGeometry preserves vertex order).
      if (siAttr.count !== posAttr.count) return null

      // Grouping: head + hair + eyes stay together as a single piece. Every
      // other bone becomes its own individual piece (granular split, like the
      // golden character version). This prevents the torso from coming apart
      // as a single large chunk.
      const limbOf = (name) => {
        const n = (name || '').toLowerCase()
        if (!n) return 'bone:__unnamed__'
        // Head cluster: skull, face features, eyes, hair — everything visually
        // attached to the head should fly together.
        if (
          n === 'headx' ||
          n.startsWith('c_') ||
          /^(head|skull|jaw|teeth|tongue|eye|brow|lip|lash|nose|ear|chin|hair|mohawk|crest|horn|mask|helmet|hat)/.test(n)
        ) return 'head'
        // Everything else: one piece per bone.
        return `bone:${n}`
      }

      // Precompute group for each bone index — cheap lookup during the vertex pass.
      const boneGroup = new Array(bones.length)
      for (let i = 0; i < bones.length; i += 1) boneGroup[i] = limbOf(bones[i]?.name)

      // For each vertex, pick the group of the bone with the highest skin weight.
      const vCount = posAttr.count
      const groupPerVertex = new Array(vCount)
      for (let v = 0; v < vCount; v += 1) {
        let bestBone = -1
        let bestW = -1
        for (let k = 0; k < 4; k += 1) {
          const w = swAttr.getComponent(v, k)
          if (w > bestW) { bestW = w; bestBone = siAttr.getComponent(v, k) }
        }
        groupPerVertex[v] = (bestBone >= 0 && bestBone < boneGroup.length) ? boneGroup[bestBone] : 'torso'
      }

      // Bucket triangles by majority group (2 of 3 vertices wins; ties → first).
      const idxArr = idxAttr.array
      const triCount = Math.floor(idxArr.length / 3)
      const buckets = new Map()
      for (let t = 0; t < triCount; t += 1) {
        const a = idxArr[t * 3 + 0]
        const b = idxArr[t * 3 + 1]
        const c = idxArr[t * 3 + 2]
        const ga = groupPerVertex[a]
        const gb = groupPerVertex[b]
        const gc = groupPerVertex[c]
        const group = (ga === gb || ga === gc) ? ga : (gb === gc ? gb : ga)
        let arr = buckets.get(group)
        if (!arr) { arr = []; buckets.set(group, arr) }
        arr.push(a, b, c)
      }
      if (buckets.size < 2) return null

      // Build a subset BufferGeometry per bucket, remapping vertex indices.
      const IdxCtor = idxArr.constructor
      const attrs = bakedGeo.attributes || {}
      const out = []
      buckets.forEach((triIdx, groupId) => {
        if (triIdx.length < 3) return
        const oldToNew = new Map()
        const newIdx = new IdxCtor(triIdx.length)
        let newCount = 0
        for (let i = 0; i < triIdx.length; i += 1) {
          const old = triIdx[i]
          let nv = oldToNew.get(old)
          if (nv === undefined) { nv = newCount; oldToNew.set(old, newCount); newCount += 1 }
          newIdx[i] = nv
        }
        const dst = new THREE.BufferGeometry()
        Object.keys(attrs).forEach((k) => {
          // Skin attributes are meaningless on a rigid piece — skip them.
          if (k === 'skinIndex' || k === 'skinWeight') return
          const a = attrs[k]
          if (!a || !a.array || typeof a.itemSize !== 'number') return
          const itemSize = a.itemSize
          const Ctor = a.array.constructor
          const na = new Ctor(newCount * itemSize)
          for (const [oldIdx2, newIdx2] of oldToNew.entries()) {
            const so = oldIdx2 * itemSize
            const doff = newIdx2 * itemSize
            for (let j = 0; j < itemSize; j += 1) na[doff + j] = a.array[so + j]
          }
          dst.setAttribute(k, new THREE.BufferAttribute(na, itemSize, a.normalized))
        })
        dst.setIndex(new THREE.BufferAttribute(newIdx, 1))
        try { dst.computeBoundingSphere() } catch { }
        try { dst.computeBoundingBox() } catch { }
        if (!dst.getAttribute('normal')) {
          try { dst.computeVertexNormals() } catch { }
        }
        out.push({ geo: dst, materialIndex: 0, groupId })
      })

      // Post-process: any non-head piece that is significantly larger than
      // the average gets subdivided along its longest axis by centroid. This
      // prevents the torso/spine from exploding as one huge chunk when the
      // rig only uses a couple of spine bones.
      try {
        const subdivideGeoByCentroid = (srcGeo, nChunks) => {
          try {
            const idx2 = srcGeo.index?.array
            const pos2 = srcGeo.getAttribute('position')
            if (!idx2 || !pos2) return [srcGeo]
            const triC = Math.floor(idx2.length / 3)
            if (triC < 60 || nChunks < 2) return [srcGeo]
            let ax = 0
            try {
              srcGeo.computeBoundingBox()
              const bb = srcGeo.boundingBox
              if (bb) {
                const sx = bb.max.x - bb.min.x
                const sy = bb.max.y - bb.min.y
                const sz = bb.max.z - bb.min.z
                ax = sy > sx && sy > sz ? 1 : (sz > sx && sz > sy ? 2 : 0)
              }
            } catch { }
            const v0 = new THREE.Vector3(); const v1 = new THREE.Vector3(); const v2 = new THREE.Vector3()
            const tris = new Array(triC)
            for (let t = 0; t < triC; t += 1) {
              const a = idx2[t * 3 + 0]; const b = idx2[t * 3 + 1]; const c = idx2[t * 3 + 2]
              v0.fromBufferAttribute(pos2, a); v1.fromBufferAttribute(pos2, b); v2.fromBufferAttribute(pos2, c)
              const cx = (v0.x + v1.x + v2.x) / 3; const cy = (v0.y + v1.y + v2.y) / 3; const cz = (v0.z + v1.z + v2.z) / 3
              tris[t] = { t, key: ax === 0 ? cx : (ax === 1 ? cy : cz) }
            }
            tris.sort((p, q) => p.key - q.key)
            const per = Math.ceil(triC / nChunks)
            const res = []
            for (let ci = 0; ci < nChunks; ci += 1) {
              const start = ci * per; const end = Math.min(triC, start + per)
              if (end - start < 1) continue
              const sub = new (idx2.constructor)((end - start) * 3)
              for (let i = start; i < end; i += 1) {
                const tt = tris[i].t
                sub[(i - start) * 3 + 0] = idx2[tt * 3 + 0]
                sub[(i - start) * 3 + 1] = idx2[tt * 3 + 1]
                sub[(i - start) * 3 + 2] = idx2[tt * 3 + 2]
              }
              const oldToNew2 = new Map()
              const newIdx2 = new (idx2.constructor)(sub.length)
              let newCount2 = 0
              for (let i = 0; i < sub.length; i += 1) {
                const o = sub[i]
                let nv = oldToNew2.get(o)
                if (nv === undefined) { nv = newCount2; oldToNew2.set(o, newCount2); newCount2 += 1 }
                newIdx2[i] = nv
              }
              const subGeo = new THREE.BufferGeometry()
              Object.keys(srcGeo.attributes || {}).forEach((k) => {
                const a = srcGeo.attributes[k]
                if (!a || !a.array || typeof a.itemSize !== 'number') return
                const itemSize = a.itemSize
                const Ctor = a.array.constructor
                const na = new Ctor(newCount2 * itemSize)
                for (const [oldI, newI] of oldToNew2.entries()) {
                  const so = oldI * itemSize; const doff = newI * itemSize
                  for (let j = 0; j < itemSize; j += 1) na[doff + j] = a.array[so + j]
                }
                subGeo.setAttribute(k, new THREE.BufferAttribute(na, itemSize, a.normalized))
              })
              subGeo.setIndex(new THREE.BufferAttribute(newIdx2, 1))
              try { subGeo.computeBoundingSphere() } catch { }
              try { subGeo.computeBoundingBox() } catch { }
              if (!subGeo.getAttribute('normal')) { try { subGeo.computeVertexNormals() } catch { } }
              res.push(subGeo)
            }
            return res.length ? res : [srcGeo]
          } catch {
            return [srcGeo]
          }
        }

        let totalTris = 0
        const triCounts = out.map((o) => {
          const c = o.geo.index ? Math.floor(o.geo.index.count / 3) : 0
          totalTris += c
          return c
        })
        const avgTri = totalTris / Math.max(1, out.length)
        const final = []
        for (let i = 0; i < out.length; i += 1) {
          const p = out[i]
          const tc = triCounts[i]
          // Head stays whole. Anything else that is significantly above
          // average gets subdivided spatially.
          if (p.groupId === 'head' || tc <= Math.max(220, avgTri * 1.4)) {
            final.push(p)
            continue
          }
          const nChunks = THREE.MathUtils.clamp(Math.round(tc / Math.max(180, avgTri * 0.9)), 2, 6)
          const subs = subdivideGeoByCentroid(p.geo, nChunks)
          if (subs.length <= 1) { final.push(p); continue }
          for (let j = 0; j < subs.length; j += 1) {
            final.push({ geo: subs[j], materialIndex: 0, groupId: `${p.groupId}_${j}` })
          }
        }
        return final.length >= 2 ? final : (out.length >= 2 ? out : null)
      } catch { }

      return out.length >= 2 ? out : null
    } catch {
      return null
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
        // Only dispose if the geometry/material were created by the effect (not if they are original detached meshes)
        const owned = !!c?.userData?.__disassembleOwned
        if (owned) {
          try { c.geometry?.dispose?.() } catch { }
        }
        try {
          const mat = c.material
          if (Array.isArray(mat)) {
            mat.forEach((mm) => {
              if (!mm || disposed.has(mm)) return
              disposed.add(mm)
              if (owned) {
                try { mm.dispose?.() } catch { }
              }
            })
          } else if (mat && !disposed.has(mat)) {
            disposed.add(mat)
            if (owned) {
              try { mat.dispose?.() } catch { }
            }
          }
        } catch { }
      }
    } catch { }
  }, [])

  const hardResetDisassemble = useCallback(() => {
    // Re-show any skinned originals that were hidden-in-place for rigid replacement.
    try {
      const hidden = disassembleRef.current.hiddenSkinned
      if (Array.isArray(hidden) && hidden.length) {
        for (let i = 0; i < hidden.length; i += 1) {
          const n = hidden[i]
          try { if (n) n.visible = true } catch { }
          try { if (n?.userData) delete n.userData.__disassembleRestoreVisibleOnly } catch { }
        }
        disassembleRef.current.hiddenSkinned = []
      }
    } catch { }
    // Restore any detached meshes (if that mode was enabled)
    try {
      const root = piecesRootRef.current
      if (root) {
        for (let i = root.children.length - 1; i >= 0; i -= 1) {
          const obj = root.children[i]
          const restore = obj?.userData?.__disassembleRestore
          if (!restore?.parent) continue
          try { root.remove(obj) } catch { }
          try { restore.parent.add(obj) } catch { }
          // Restore ORIGINAL local transform (relative to origParent), not
          // the physics-sim transform that was left in piecesRoot space.
          try {
            if (restore.localPos) obj.position.copy(restore.localPos)
            if (restore.localQuat) obj.quaternion.copy(restore.localQuat)
            if (restore.localScale) obj.scale.copy(restore.localScale)
            obj.updateMatrix?.()
          } catch { }
          // Restore original materials (per mesh) if we cloned them for the disassembly
          try {
            obj.traverse?.((n) => {
              const m0 = n?.userData?.__disassembleRestoreMaterial
              if (m0) {
                try { n.material = m0 } catch { }
                try { delete n.userData.__disassembleRestoreMaterial } catch { }
              }
            })
          } catch { }
          try { if (restore.material) obj.material = restore.material } catch { }
          try { obj.visible = true } catch { }
          try { delete obj.userData.__disassembleRestore } catch { }
        }
      }
    } catch { }
    // Stop disassemble state and clear owned meshes
    try {
      disassembleActiveRef.current = false
      disassembleRef.current.phase = 'idle'
      disassembleRef.current.t = 0
      disassembleRef.current.holdExternal = false
      disassembleRef.current.maxDelayS = 0
      disassembleRef.current.pieces = []
      disassembleRef.current.detached = []
    } catch { }
    try { clearDisassemblePieces() } catch { }
    // Ensure orb is OFF and character visible
    try { orbActiveRef.current = false } catch { }
    try { showOrbRef.current = false } catch { }
    try { setOrbActive(false) } catch { }
    try { if (typeof onOrbStateChange === 'function') onOrbStateChange(false) } catch { }
    try { applyModelOpacity(1) } catch { }
    try { setCharacterShadowEnabled(true) } catch { }
  }, [applyModelOpacity, clearDisassemblePieces, onOrbStateChange])

  const startDisassemble = useCallback((opts = {}) => {
    // Reset reason
    try {
      // @ts-ignore
      window.__playerDisassembleLastFailReason = null
    } catch { }
    if (disassembleActiveRef.current) {
      try { window.__playerDisassembleLastFailReason = 'already_active' } catch { }
      return false
    }
    if (!scene) {
      try { window.__playerDisassembleLastFailReason = 'no_scene' } catch { }
      return false
    }
    if (!playerRef?.current) {
      try { window.__playerDisassembleLastFailReason = 'no_playerRef_current' } catch { }
      return false
    }
    if (!modelRootRef.current) {
      try { window.__playerDisassembleLastFailReason = 'no_modelRootRef_current' } catch { }
      return false
    }
    if (!piecesRootRef.current) {
      try { window.__playerDisassembleLastFailReason = 'no_piecesRootRef_current' } catch { }
      return false
    }
    // If the orb is visible/active, turn it off so it does not obstruct the viewport.
    try {
      if (orbActiveRef.current || showOrbRef.current) {
        orbActiveRef.current = false
        showOrbRef.current = false
        setOrbActive(false)
        try { if (typeof onOrbStateChange === 'function') onOrbStateChange(false) } catch { }
        // Make the human the focus again (even though we hide it during disassembly)
        fadeInTRef.current = 1
        fadeOutTRef.current = 0
      }
    } catch { }

    const dbg = readDisassembleDebugFlags()
    // Force visibility in easter egg (without depending on lights/textures).

    if (opts?.forceVisible) {
      try { dbg.noDepthTest = true } catch { }
    }
    // In easter egg we keep the character disassembled until it finishes.
    disassembleRef.current.holdExternal = !!opts?.hold

    // Prepare updated matrices (current pose) — order matters (parents first)
    try { playerRef.current.updateMatrixWorld?.(true) } catch { }
    try { playerRef.current.updateWorldMatrix?.(true, true) } catch { }
    try { modelRootRef.current.updateMatrixWorld?.(true) } catch { }
    try { modelRootRef.current.updateWorldMatrix?.(true, true) } catch { }
    try { scene.updateMatrixWorld(true) } catch { }

    // Floor: use the same ground as the player (world Y) so pieces fall from their real position.
    // (Auto-calibration by minimum Y looked fine sometimes, but here it ends up floating for large radii.)
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

    clearDisassemblePieces()
    disassembleRef.current.pieces = []
    disassembleRef.current.detached = []
    disassembleRef.current.hiddenSkinned = []
    const pieces = []
    const candidates = []

    // 0) Ultra-robust mode: if Egg_* nodes exist in the scene,
    // do NOT bake (avoids Context Lost). Detach Egg_* meshes in their current pose.
    // This preserves materials/textures and exact proportions (no file duplication).
    // Egg pieces: 1 piece per Egg_* node (group), NOT per individual mesh.

    const eggDetachList = [] // root Egg_* nodes to detach (Object3D)
    let eggNodesSeen = 0
    let eggMeshesFound = 0
    try {
      const eggNodes = []
      scene.traverse((o) => {
        if (!o) return
        const n = (o?.name || '').toString()
        if (!n) return
        // Skip outline meshes — they're visual effects tied to the original
        // skinned meshes, not body pieces. Letting them into the detach list
        // creates ghost "stretched yellow tubes" alongside the real body.
        if (n.endsWith('_outline')) return
        // Include Egg_* body pieces AND Skull_* cranium/face pieces — the head
        // (skull, hair, facial bones) is authored as separate Skull_* meshes,
        // not under any Egg_* tag. Without this the head vanishes.
        if (n.startsWith('Egg_') || n.includes('Egg_') || /^Skull\d/i.test(n)) eggNodes.push(o)
      })
      eggNodesSeen = eggNodes.length

      // keep only top-level Egg_ nodes (if an Egg_ is inside another Egg_, skip it)
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
        } catch { }
        return false
      }
      const topEggNodes = eggNodes.filter((n) => !isUnderEgg(n))

      // Only accept Egg_ nodes that contain at least 1 renderable mesh.
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
        } catch { }
        if (hasMesh) eggDetachList.push(node)
      }

      // Count total meshes inside Egg_ pieces (console diagnostics only)
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
        } catch { }
      }
    } catch { }

    // If real Egg_ pieces exist, this is the MOST robust path:
    // - does not bake geometry for non-skinned pieces
    // - DOES bake skinned Egg_* pieces into rigid meshes (SkinnedMesh renders
    //   pinned to its skeleton, ignoring its own transform; baking is required)
    // - avoids Context Lost
    const MIN_EGG_DETACH = 6
    if (eggDetachList.length >= MIN_EGG_DETACH) {
      const parentInv = new THREE.Matrix4()
      const rel = new THREE.Matrix4()
      const p = new THREE.Vector3()
      const q = new THREE.Quaternion()
      const s = new THREE.Vector3()
      try { parentInv.copy(modelRootRef.current.matrixWorld).invert() } catch { parentInv.identity() }

      // Debug opt-in: localStorage 'player_disassemble_bright'='1' paints each
      // rigid with a unique vibrant HSL color so broken pieces are impossible
      // to miss even if their original material is dark.
      const FORCE_BRIGHT = (() => {
        try { return window?.localStorage?.getItem('player_disassemble_bright') === '1' } catch { return false }
      })()
      // Diagnostic buffer for the current run — exposed via
      // window.__playerDisassembleDebugLastRun so you can inspect which nodes
      // actually became physics pieces and where they landed in world.
      const dbgRunBuf = []

      // Head grouping: all Skull_* meshes belong to the cranium/face/hair and
      // should fall as a single unit (not as disconnected fragments). We
      // collect their rigid children into a shared `headGroup` and push only
      // that group as a single piece at the end of the loop.
      const headGroup = new THREE.Group()
      headGroup.name = 'Head_rigid_group'
      headGroup.matrixAutoUpdate = true
      headGroup.userData.__disassembleOwned = true
      const headChildren = [] // rigids that should end up inside the group
      // Head-group classification: Skull_N siblings + any face features
      // (eyes, pupils, iris, hair, horns, mohawk, etc.) regardless of whether
      // they were named Egg_* or Skull_*. This guarantees the pupil stays
      // attached to its eye and the hair stays on the skull.
      // Face features ONLY — do NOT include generic 'skull'/'head' here,
      // because the rig names the whole upper body Skull_N and that would
      // send the ribcage back into the head group.
      const isHeadFeatureName = (name) => {
        const s = String(name || '').toLowerCase()
        if (!s) return false
        return /(eye|pupil|iris|lens|eyeball|cornea|lash|brow|hair|mohawk|horn|crest|mask|helmet|hat|feather|tooth|teeth|tongue|scalp|jaw_|spike|plume|crown|antler|antenna|fringe|tuft|bang|beard|comb|ridge|fin|cap|earring|fur|cowlick|ponytail|quiff)/.test(s)
      }
      const isSkullName = (name) => {
        const s = String(name || '')
        if (/^Skull\d/i.test(s)) return true
        return isHeadFeatureName(s)
      }

      // Detach + prepare pieces
      for (let i = 0; i < eggDetachList.length; i += 1) {
        const obj = eggDetachList[i]
        const origParent = obj.parent
        if (!origParent) { try { dbgRunBuf.push({ name: obj?.name, skip: 'no_parent' }) } catch { } ; continue }
        try { obj.updateMatrixWorld(true) } catch { }
        try { modelRootRef.current.updateMatrixWorld(true) } catch { }

        // Detect skinned mesh (the node itself or a descendant). SkinnedMesh
        // renders pinned to its skeleton, ignoring its own position/quaternion,
        // so for physics we need a BAKED rigid replacement instead of moving
        // the original.
        let skinnedTarget = null
        try {
          if (obj.isSkinnedMesh) skinnedTarget = obj
          else obj.traverse?.((c) => { if (!skinnedTarget && c?.isSkinnedMesh) skinnedTarget = c })
        } catch { }

        // `physicsObj` is what receives transforms in the fall/assemble phases.
        // For skinned nodes it's a new baked rigid mesh; for non-skinned it's
        // the original moved under piecesRoot.
        let physicsObj = obj

        if (skinnedTarget) {
          // Build a rigid replacement at the skinned mesh's current world pose.
          // This GLB uses KHR_mesh_quantization + KHR_draco_mesh_compression +
          // Auto-Rig Pro stretch-IK — vertices are stored in a normalized
          // int16 space whose dequantization scale lives in the skinning
          // shader, not the geometry. We use `applyBoneTransform` (CPU
          // skinning path) to resolve vertices into a space that, combined
          // with `parentInv`, renders at world-like size. Known trade-off:
          // stretch-IK bones can produce one-off asymmetric pieces
          // (e.g. one arm longer than the other). Acceptable for a shatter.
          try {
            try { skinnedTarget.skeleton?.update?.() } catch { }
            try { skinnedTarget.updateMatrixWorld(true) } catch { }
            const baked = bakeSkinnedGeometry(skinnedTarget)
            try { baked.applyMatrix4(parentInv) } catch { }
            try { baked.computeBoundingBox() } catch { }
            try { baked.computeBoundingSphere() } catch { }
            // Shift geometry so the mesh's position represents its center —
            // important for natural rotation under angular velocity.
            const pieceCenter = new THREE.Vector3()
            try { baked.boundingBox?.getCenter?.(pieceCenter) } catch { }
            if (!Number.isFinite(pieceCenter.x)) pieceCenter.set(0, 0, 0)
            try {
              baked.translate(-pieceCenter.x, -pieceCenter.y, -pieceCenter.z)
              baked.computeBoundingBox()
              baked.computeBoundingSphere()
              baked.computeVertexNormals()
            } catch { }

            const srcMat = Array.isArray(skinnedTarget.material) ? skinnedTarget.material[0] : skinnedTarget.material
            let rigidMat
            if (FORCE_BRIGHT) {
              const h = ((i * 0.61803398875) % 1 + 1) % 1
              rigidMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(h, 0.95, 0.55),
                side: THREE.DoubleSide,
                toneMapped: false,
              })
              // Preserva el nombre del material original aunque el color se
              // pinte HSL aleatorio — sin esto, en modo debug bright el
              // clasificador Eye_cluster pierde AMBAS señales (nombre Y color)
              // y las pupilas siempre caen al fallback standalone.
              rigidMat.name = srcMat?.name || ''
            } else {
              rigidMat = createRigidMaterial(srcMat)
            }
            const rigid = new THREE.Mesh(baked, rigidMat)
            rigid.castShadow = true
            rigid.receiveShadow = true
            rigid.frustumCulled = false
            rigid.matrixAutoUpdate = true
            rigid.position.copy(pieceCenter)
            rigid.quaternion.identity()
            rigid.scale.set(1, 1, 1)
            rigid.userData.__disassembleOwned = true
            rigid.name = (obj.name || 'egg') + '_rigid'

            // Yellow outline hull: second mesh sharing the baked geometry,
            // rendered with the scene's outline material (BackSide + shader
            // expansion along normals). It's added as a CHILD of the rigid
            // so it inherits position/rotation automatically — no extra
            // physics bookkeeping needed.
            if (!FORCE_BRIGHT && outlineEnabled && outlineMaterial) {
              try {
                const outlineMesh = new THREE.Mesh(baked, outlineMaterial)
                outlineMesh.castShadow = false
                outlineMesh.receiveShadow = false
                outlineMesh.frustumCulled = false
                outlineMesh.name = rigid.name + '_outline'
                outlineMesh.renderOrder = -1
                outlineMesh.userData.__disassembleOwned = false // shared material
                rigid.add(outlineMesh)
              } catch { }
            }

            // Head merge: Skull_* rigids go into headGroup (a single piece);
            // every other body part stays as its own piece.
            const goesToHead = isSkullName(obj.name)
            if (goesToHead) {
              headChildren.push({ rigid, centerPieceLocal: pieceCenter.clone() })
            } else {
              try { piecesRootRef.current.add(rigid) } catch { }
            }
            // Hide the original skinned node in place so it stops contributing
            // visually. On restore we'll set it back to visible.
            try { obj.visible = false } catch { }
            try { obj.userData.__disassembleRestoreVisibleOnly = true } catch { }
            try { disassembleRef.current.hiddenSkinned.push(obj) } catch { }
            physicsObj = rigid
            // Skip the per-piece data push for skull rigids — head aggregated below.
            if (goesToHead) { continue }
            try {
              const bb = baked.boundingBox
              const sz = bb ? new THREE.Vector3().subVectors(bb.max, bb.min) : null
              const triC = baked.index ? Math.floor(baked.index.count / 3) : 0
              // Sample vertex 0 raw value (BEFORE bake — from the source geo)
              const srcPosAttr = skinnedTarget.geometry.getAttribute('position')
              let v0 = null
              let v0norm = null
              try {
                if (srcPosAttr) {
                  v0 = [srcPosAttr.array[0], srcPosAttr.array[1], srcPosAttr.array[2]]
                  v0norm = !!srcPosAttr.normalized
                }
              } catch { }
              // Compute WORLD-SPACE bbox of the ORIGINAL skinned mesh (before hiding)
              let skinnedWorldBox = null
              try {
                const box = new THREE.Box3().setFromObject(skinnedTarget)
                const sz2 = new THREE.Vector3().subVectors(box.max, box.min)
                skinnedWorldBox = [+sz2.x.toFixed(3), +sz2.y.toFixed(3), +sz2.z.toFixed(3)]
              } catch { }
              dbgRunBuf.push({
                name: obj?.name || '(no-name)',
                path: 'rigid_bake',
                tri: triC,
                bakedSize: sz ? [+sz.x.toFixed(3), +sz.y.toFixed(3), +sz.z.toFixed(3)] : null,
                skinnedWorldBox,
                v0Raw: v0,
                v0normalized: v0norm,
                posAttrType: srcPosAttr?.array?.constructor?.name,
                center: [+pieceCenter.x.toFixed(3), +pieceCenter.y.toFixed(3), +pieceCenter.z.toFixed(3)],
              })
            } catch (err) {
              dbgRunBuf.push({ name: obj?.name, path: 'dbg_err', err: String(err) })
            }
          } catch (err) {
            try { dbgRunBuf.push({ name: obj?.name, path: 'bake_error', err: err?.message || String(err) }) } catch { }
            skinnedTarget = null // fall back to the non-skinned path below
          }
        }

        if (!skinnedTarget) {
          // Non-skinned path (e.g. Egg_EnergyBall): detach and move into piecesRoot.
          // Save the ORIGINAL local transform (relative to origParent) so we can
          // restore it on reassemble — otherwise the piece ends up at a wrong
          // offset when reparented (the animated hand bone has a very different
          // transform than modelRoot).
          const origLocalPos = obj.position.clone()
          const origLocalQuat = obj.quaternion.clone()
          const origLocalScale = obj.scale.clone()
          try {
            rel.multiplyMatrices(parentInv, obj.matrixWorld)
            rel.decompose(p, q, s)
          } catch {
            p.set(0, 0, 0); q.identity(); s.set(1, 1, 1)
          }
          try { origParent.remove(obj) } catch { }
          try { piecesRootRef.current.add(obj) } catch { }
          try {
            obj.traverse?.((n) => { try { n.matrixAutoUpdate = true } catch { } })
            obj.position.copy(p)
            obj.quaternion.copy(q)
            obj.scale.copy(s)
            obj.traverse?.((n) => {
              try { n.frustumCulled = false } catch { }
              try {
                if (n && (n.isMesh || n.isSkinnedMesh) && n.material) {
                  if (!n.userData.__disassembleRestoreMaterial) n.userData.__disassembleRestoreMaterial = n.material
                  const mats = Array.isArray(n.material) ? n.material : [n.material]
                  const cloned = mats.map((m) => {
                    try {
                      const mm = (m && m.isMaterial && typeof m.clone === 'function') ? m.clone() : m
                      if (mm && mm.isMaterial) {
                        if (n.isSkinnedMesh && 'skinning' in mm) mm.skinning = true
                        mm.transparent = false
                        mm.opacity = 1
                        mm.depthWrite = true
                        mm.depthTest = true
                        mm.side = THREE.DoubleSide
                        mm.needsUpdate = true
                      }
                      return mm
                    } catch { return m }
                  })
                  n.material = Array.isArray(n.material) ? cloned : cloned[0]
                }
              } catch { }
            })
            try { obj.updateMatrix?.() } catch { }
            try { obj.updateMatrixWorld?.(true) } catch { }
          } catch { }
          try {
            obj.userData.__disassembleRestore = {
              parent: origParent,
              localPos: origLocalPos,
              localQuat: origLocalQuat,
              localScale: origLocalScale,
            }
          } catch { }
          physicsObj = obj
        }

        // Physics data (bbox collision) — computed on physicsObj (rigid or original).
        let bottom = 0.12
        let radius = 0.12
        try {
          const wBox = new THREE.Box3().setFromObject(physicsObj)
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
          // bottom offset: distance from node pivot (physicsObj.position.y) to actual minY
          const b = physicsObj.position.y - localMinY
          if (Number.isFinite(b) && b > 1e-6) bottom = b
          const sz = new THREE.Vector3()
          localBox.getSize(sz)
          const maxDim = Math.max(Math.abs(sz.x), Math.abs(sz.y), Math.abs(sz.z))
          if (Number.isFinite(maxDim) && maxDim > 1e-6) radius = Math.max(0.12, maxDim * 0.5)

          radius = THREE.MathUtils.clamp(radius, 0.12, 2.2)
          // if the box is empty, fallback
          if (!(Number.isFinite(localMaxY) && Number.isFinite(localMinY))) {
            bottom = 0.12; radius = 0.35
          }
        } catch { }

        const homePos = physicsObj.position.clone()
        const homeQuat = physicsObj.quaternion.clone()
        const data = {
          mesh: physicsObj,
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

      // Consolidate TOP Skull_* rigids into a single head piece so the
      // cranium + eyes + hair fall as one object instead of scattered shards.
      // This rig names the whole upper body (ribcage, spine, arms...) as
      // Skull_N meshes, not just the head — so we filter by Y position and
      // only merge the top cluster into the head. The rest become individual
      // pieces so the torso actually breaks apart.
      if (headChildren.length > 0) {
        // Compute Y range of all skull children to find the real head cluster.
        let minY = Infinity
        let maxY = -Infinity
        for (let i = 0; i < headChildren.length; i += 1) {
          const y = headChildren[i].centerPieceLocal.y
          if (Number.isFinite(y)) {
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
        // Head = pieces within the top ~40% of the Y range. The rest go to
        // piecesRoot as their own individual rigid pieces. A larger cutoff
        // keeps the eyes/pupils/hair safely attached to the head even when
        // their baked center sits a bit below the skull crown.
        const rangeY = (Number.isFinite(minY) && Number.isFinite(maxY)) ? (maxY - minY) : 0
        const headCutoff = rangeY > 1e-4 ? (maxY - rangeY * 0.40) : -Infinity
        const realHeadChildren = []
        const bodyShards = []
        const eyeballShards = [] // yellow emissive — one per eyeball
        const pupilShards = []   // near-black — pupils (attach to nearest eyeball)
        const isEyeName = (name) => /(eye|eyeball|cornea|lens|iris)/i.test(String(name || ''))
        const isPupilName = (name) => /(pupil)/i.test(String(name || ''))
        // Classify by the ORIGINAL MATERIAL NAME (glTF materials "Eyes" /
        // "Pupils" — stable, independent of user color customization and of
        // skin shaders). This is the primary signal: characterColors.js lets
        // the user recolor "Eyes" to ANY hex (default #ffc500 amarillo, void
        // skin lo fuerza a #ffffff), lo que rompe cualquier heurística de
        // color ("emissive amarillo"). El nombre del material NUNCA cambia.
        const isEyeMaterialName = (name) => /^eyes?$/i.test(String(name || '').trim())
        const isPupilMaterialName = (name) => /^pupils?$/i.test(String(name || '').trim())
        const classifyByMaterialName = (rigid) => {
          try {
            const mat = Array.isArray(rigid?.material) ? rigid.material[0] : rigid?.material
            const n = mat?.name
            if (isPupilMaterialName(n)) return 'pupil'
            if (isEyeMaterialName(n)) return 'eye'
          } catch { }
          return null
        }
        // Classify a rigid's material: 'eye' (yellow emissive), 'pupil'
        // (near-black) or null. Using material instead of names because the
        // rig names every face shard generically (Skull_N). FALLBACK ONLY —
        // se rompe si el color de "Eyes" no es amarillo (custom / skin void).
        const classifyByMaterial = (rigid) => {
          try {
            const mat = Array.isArray(rigid?.material) ? rigid.material[0] : rigid?.material
            if (!mat) return null
            const col = mat.color
            const em = mat.emissive
            const emI = typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1
            if (em && emI > 0.05) {
              const er = em.r || 0; const eg = em.g || 0; const eb = em.b || 0
              const emSum = er + eg + eb
              if (emSum > 0.25) {
                const yellowish = (er > 0.35 && eg > 0.28 && eb < Math.max(er, eg) * 0.55)
                if (yellowish) return 'eye'
              }
            }
            if (col) {
              const cr = col.r || 0; const cg = col.g || 0; const cb = col.b || 0
              const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb
              if (lum < 0.08) return 'pupil'
            }
          } catch { }
          return null
        }
        for (let i = 0; i < headChildren.length; i += 1) {
          const hc = headChildren[i]
          const rname = hc.rigid?.name || ''
          // Prioridad: (1) nombre del material original (Eyes/Pupils, estable
          // ante color custom/skins), (2) nombre del nodo/mesh (legacy, casi
          // nunca dispara en este GLB porque los shards se llaman Skull_N),
          // (3) heurística de color (fallback si el material perdió el name).
          let kind = classifyByMaterialName(hc.rigid)
          if (!kind) {
            if (isEyeName(rname)) kind = 'eye'
            else if (isPupilName(rname)) kind = 'pupil'
          }
          if (!kind) kind = classifyByMaterial(hc.rigid)
          if (kind === 'eye') { eyeballShards.push(hc); continue }
          if (kind === 'pupil') { pupilShards.push(hc); continue }
          // Face features stuck to the bone (hair/mohawk/teeth/jaw/etc.)
          // ALWAYS stay in head, regardless of Y position.
          const isFace = isHeadFeatureName(rname)
          if (isFace || hc.centerPieceLocal.y >= headCutoff) realHeadChildren.push(hc)
          else bodyShards.push(hc)
        }

        // Collapse old eyeShards concept into a proximity grouping: for each
        // pupil, attach it to the closest eyeball. Each eyeball (with its
        // attached pupils) becomes one Eye_cluster piece.
        const eyeShards = [] // legacy — kept for compatibility with stats below
        const eyeClusterMap = new Map() // eyeballIndex -> array of shards
        for (let i = 0; i < eyeballShards.length; i += 1) {
          eyeClusterMap.set(i, [eyeballShards[i]])
          eyeShards.push(eyeballShards[i])
        }
        if (eyeballShards.length > 0 && pupilShards.length > 0) {
          for (let pi = 0; pi < pupilShards.length; pi += 1) {
            const pShard = pupilShards[pi]
            let bestI = 0
            let bestD = Infinity
            for (let ei = 0; ei < eyeballShards.length; ei += 1) {
              const d2 = pShard.centerPieceLocal.distanceToSquared(eyeballShards[ei].centerPieceLocal)
              if (d2 < bestD) { bestD = d2; bestI = ei }
            }
            eyeClusterMap.get(bestI).push(pShard)
            eyeShards.push(pShard)
          }
        } else if (pupilShards.length > 0) {
          // No eyeballs detected — emit pupils standalone (rare).
          for (let pi = 0; pi < pupilShards.length; pi += 1) {
            eyeClusterMap.set(`p${pi}`, [pupilShards[pi]])
            eyeShards.push(pupilShards[pi])
          }
        }

        // Build eye pieces: each eyeball (with its nearest pupils) becomes one
        // Eye_cluster. Grouping by 3D proximity instead of X sign guarantees
        // the pupil stays with the correct eye even if the character is
        // rotated at disassemble time.
        if (eyeShards.length > 0) {
          const eyeClusters = Array.from(eyeClusterMap.values()).filter((a) => a.length > 0)
          for (let c = 0; c < eyeClusters.length; c += 1) {
            const cluster = eyeClusters[c]
            const eyeGroup = new THREE.Group()
            eyeGroup.name = `Eye_cluster_${c}`
            eyeGroup.userData.__disassembleOwned = true
            eyeGroup.matrixAutoUpdate = true
            const eCenter = new THREE.Vector3()
            for (let j = 0; j < cluster.length; j += 1) eCenter.add(cluster[j].centerPieceLocal)
            eCenter.multiplyScalar(1 / cluster.length)
            for (let j = 0; j < cluster.length; j += 1) {
              const { rigid, centerPieceLocal } = cluster[j]
              rigid.position.copy(centerPieceLocal).sub(eCenter)
              rigid.quaternion.identity()
              rigid.scale.set(1, 1, 1)
              eyeGroup.add(rigid)
            }
            eyeGroup.position.copy(eCenter)
            eyeGroup.quaternion.identity()
            eyeGroup.scale.set(1, 1, 1)
            try { piecesRootRef.current.add(eyeGroup) } catch { }

            let eBottom = 0.08; let eRadius = 0.12
            try {
              const wBox = new THREE.Box3().setFromObject(eyeGroup)
              const pts2 = [
                new THREE.Vector3(wBox.min.x, wBox.min.y, wBox.min.z),
                new THREE.Vector3(wBox.max.x, wBox.max.y, wBox.max.z),
              ]
              const lb = new THREE.Box3()
              for (let pi = 0; pi < pts2.length; pi += 1) {
                pts2[pi].applyMatrix4(parentInv)
                lb.expandByPoint(pts2[pi])
              }
              const b = eyeGroup.position.y - lb.min.y
              if (Number.isFinite(b) && b > 1e-6) eBottom = b
              const sz = new THREE.Vector3(); lb.getSize(sz)
              const maxDim = Math.max(Math.abs(sz.x), Math.abs(sz.y), Math.abs(sz.z))
              if (Number.isFinite(maxDim) && maxDim > 1e-6) eRadius = THREE.MathUtils.clamp(maxDim * 0.5, 0.08, 0.4)
            } catch { }

            const ehp = eyeGroup.position.clone()
            const ehq = eyeGroup.quaternion.clone()
            pieces.push({
              mesh: eyeGroup,
              v: new THREE.Vector3(),
              w: new THREE.Vector3(),
              homePos: ehp,
              homeQuat: ehq,
              assembleStartPos: ehp.clone(),
              assembleStartQuat: ehq.clone(),
              centerLocal: ehp.clone(),
              bottom: eBottom,
              radius: eRadius,
              delayS: 0,
              started: false,
              releasePos: null,
              impulseV: null,
              impulseW: null,
            })
          }
          try { dbgRunBuf.push({ name: 'eye_clusters', count: eyeClusters.length, eyeballs: eyeballShards.length, pupils: pupilShards.length }) } catch { }
        }

        // Cluster body shards (ribcage/spine tagged as Skull_*) into a small
        // number of Y-bands so the torso breaks apart into a handful of
        // chunks instead of ~20 tiny shards.
        const BODY_BAND_COUNT = 4
        if (bodyShards.length > 0) {
          let bMinY = Infinity
          let bMaxY = -Infinity
          for (let i = 0; i < bodyShards.length; i += 1) {
            const y = bodyShards[i].centerPieceLocal.y
            if (Number.isFinite(y)) { if (y < bMinY) bMinY = y; if (y > bMaxY) bMaxY = y }
          }
          const bRange = Math.max(1e-5, bMaxY - bMinY)
          const bands = []
          for (let i = 0; i < BODY_BAND_COUNT; i += 1) bands.push([])
          for (let i = 0; i < bodyShards.length; i += 1) {
            const hc = bodyShards[i]
            const t = THREE.MathUtils.clamp((hc.centerPieceLocal.y - bMinY) / bRange, 0, 0.99999)
            const b = Math.min(BODY_BAND_COUNT - 1, Math.floor(t * BODY_BAND_COUNT))
            bands[b].push(hc)
          }
          // Drop empty bands, merge tiny bands into neighbours.
          const filledBands = bands.filter((b) => b.length > 0)
          for (let i = 0; i < filledBands.length; i += 1) {
            const band = filledBands[i]
            // Build a Group holding all shards of this band so they fly as one chunk.
            const bandGroup = new THREE.Group()
            bandGroup.name = `Body_band_${i}`
            bandGroup.userData.__disassembleOwned = true
            bandGroup.matrixAutoUpdate = true
            const bandCenter = new THREE.Vector3()
            for (let j = 0; j < band.length; j += 1) bandCenter.add(band[j].centerPieceLocal)
            bandCenter.multiplyScalar(1 / band.length)
            for (let j = 0; j < band.length; j += 1) {
              const { rigid, centerPieceLocal } = band[j]
              rigid.position.copy(centerPieceLocal).sub(bandCenter)
              rigid.quaternion.identity()
              rigid.scale.set(1, 1, 1)
              bandGroup.add(rigid)
            }
            bandGroup.position.copy(bandCenter)
            bandGroup.quaternion.identity()
            bandGroup.scale.set(1, 1, 1)
            try { piecesRootRef.current.add(bandGroup) } catch { }

            // Physics data for this band.
            let bBottom = 0.12; let bRadius = 0.25
            try {
              const wBox = new THREE.Box3().setFromObject(bandGroup)
              const pts = [
                new THREE.Vector3(wBox.min.x, wBox.min.y, wBox.min.z),
                new THREE.Vector3(wBox.max.x, wBox.max.y, wBox.max.z),
              ]
              const localBox = new THREE.Box3()
              for (let pi = 0; pi < pts.length; pi += 1) {
                pts[pi].applyMatrix4(parentInv)
                localBox.expandByPoint(pts[pi])
              }
              const localMinY = localBox.min.y
              const bb = bandGroup.position.y - localMinY
              if (Number.isFinite(bb) && bb > 1e-6) bBottom = bb
              const sz = new THREE.Vector3()
              localBox.getSize(sz)
              const maxDim = Math.max(Math.abs(sz.x), Math.abs(sz.y), Math.abs(sz.z))
              if (Number.isFinite(maxDim) && maxDim > 1e-6) bRadius = THREE.MathUtils.clamp(maxDim * 0.5, 0.12, 2.2)
            } catch { }

            const bHomePos = bandGroup.position.clone()
            const bHomeQuat = bandGroup.quaternion.clone()
            pieces.push({
              mesh: bandGroup,
              v: new THREE.Vector3(),
              w: new THREE.Vector3(),
              homePos: bHomePos,
              homeQuat: bHomeQuat,
              assembleStartPos: bHomePos.clone(),
              assembleStartQuat: bHomeQuat.clone(),
              centerLocal: bHomePos.clone(),
              bottom: bBottom,
              radius: bRadius,
              delayS: 0,
              started: false,
              releasePos: null,
              impulseV: null,
              impulseW: null,
            })
          }
          try { dbgRunBuf.push({ name: 'body_bands', bands: filledBands.length, shards: bodyShards.length, headCutoffY: headCutoff, maxY, minY }) } catch { }
        }

        // Build the head group from the TOP-cluster skull rigids only.
        if (realHeadChildren.length === 0) {
          // Unexpected: nothing qualified as head; fall back to original behavior.
          for (let i = 0; i < headChildren.length; i += 1) realHeadChildren.push(headChildren[i])
        }
        const headCenter = new THREE.Vector3()
        for (let i = 0; i < realHeadChildren.length; i += 1) {
          headCenter.add(realHeadChildren[i].centerPieceLocal)
        }
        headCenter.multiplyScalar(1 / realHeadChildren.length)
        for (let i = 0; i < realHeadChildren.length; i += 1) {
          const { rigid, centerPieceLocal } = realHeadChildren[i]
          rigid.position.copy(centerPieceLocal).sub(headCenter)
          headGroup.add(rigid)
        }
        headGroup.position.copy(headCenter)
        headGroup.quaternion.identity()
        headGroup.scale.set(1, 1, 1)
        try { piecesRootRef.current.add(headGroup) } catch { }

        // Physics data for the head as a single piece.
        let hBottom = 0.12
        let hRadius = 0.35
        try {
          const wBox = new THREE.Box3().setFromObject(headGroup)
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
          const b = headGroup.position.y - localBox.min.y
          if (Number.isFinite(b) && b > 1e-6) hBottom = b
          const sz = new THREE.Vector3()
          localBox.getSize(sz)
          const maxDim = Math.max(Math.abs(sz.x), Math.abs(sz.y), Math.abs(sz.z))
          if (Number.isFinite(maxDim) && maxDim > 1e-6) hRadius = THREE.MathUtils.clamp(maxDim * 0.5, 0.12, 2.2)
        } catch { }

        const hHomePos = headGroup.position.clone()
        const hHomeQuat = headGroup.quaternion.clone()
        pieces.push({
          mesh: headGroup,
          v: new THREE.Vector3(),
          w: new THREE.Vector3(),
          homePos: hHomePos,
          homeQuat: hHomeQuat,
          assembleStartPos: hHomePos.clone(),
          assembleStartQuat: hHomeQuat.clone(),
          centerLocal: hHomePos.clone(),
          bottom: hBottom,
          radius: hRadius,
          delayS: 0,
          started: false,
          releasePos: null,
          impulseV: null,
          impulseW: null,
        })
        try { dbgRunBuf.push({ name: 'Head_merged', path: 'head_group', childCount: headChildren.length }) } catch { }
      }

      try {
        window.__playerDisassembleDebugLastRun = { eggNodesSeen, eggDetachList: eggDetachList.length, piecesMade: pieces.length, entries: dbgRunBuf }
        // Also print a readable table to the console for easy copy/paste.
        try { console.table(dbgRunBuf) } catch { }
        try { console.log('[disassemble] dbgRunBuf JSON:', JSON.stringify(dbgRunBuf, null, 2)) } catch { }
      } catch { }

      if (!pieces.length) {
        try { window.__playerDisassembleLastFailReason = 'egg_detach_empty' } catch { }
        return false
      }

      // Post-process: subdivide oversized rigid pieces (torso/ribcage) so they
      // break apart as multiple chunks instead of flying as one large block.
      // Head group is identified by name and always kept intact.
      // Disabled — the Skull_* Y-band clustering already gives the right
      // number of torso chunks, further subdivision produces too much debris.
      if (false) try {
        const sliceGeometry = (srcGeo, nChunks) => {
          try {
            const idx2 = srcGeo.index?.array
            const pos2 = srcGeo.getAttribute('position')
            if (!idx2 || !pos2) return null
            const triC = Math.floor(idx2.length / 3)
            if (triC < 60 || nChunks < 2) return null
            let ax = 0
            try {
              srcGeo.computeBoundingBox()
              const bb = srcGeo.boundingBox
              if (bb) {
                const sx = bb.max.x - bb.min.x
                const sy = bb.max.y - bb.min.y
                const sz = bb.max.z - bb.min.z
                ax = sy > sx && sy > sz ? 1 : (sz > sx && sz > sy ? 2 : 0)
              }
            } catch { }
            const v0 = new THREE.Vector3(); const v1 = new THREE.Vector3(); const v2 = new THREE.Vector3()
            const tris = new Array(triC)
            for (let t = 0; t < triC; t += 1) {
              const a = idx2[t * 3 + 0]; const b = idx2[t * 3 + 1]; const c = idx2[t * 3 + 2]
              v0.fromBufferAttribute(pos2, a); v1.fromBufferAttribute(pos2, b); v2.fromBufferAttribute(pos2, c)
              const cx = (v0.x + v1.x + v2.x) / 3; const cy = (v0.y + v1.y + v2.y) / 3; const cz = (v0.z + v1.z + v2.z) / 3
              tris[t] = { t, key: ax === 0 ? cx : (ax === 1 ? cy : cz) }
            }
            tris.sort((p0, q0) => p0.key - q0.key)
            const per = Math.ceil(triC / nChunks)
            const attrs = srcGeo.attributes || {}
            const res = []
            for (let ci = 0; ci < nChunks; ci += 1) {
              const start = ci * per; const end = Math.min(triC, start + per)
              if (end - start < 1) continue
              const oldToNew2 = new Map()
              const newIdx2 = new (idx2.constructor)((end - start) * 3)
              let newCount2 = 0
              for (let i = start; i < end; i += 1) {
                const tt = tris[i].t
                for (let k = 0; k < 3; k += 1) {
                  const o = idx2[tt * 3 + k]
                  let nv = oldToNew2.get(o)
                  if (nv === undefined) { nv = newCount2; oldToNew2.set(o, newCount2); newCount2 += 1 }
                  newIdx2[(i - start) * 3 + k] = nv
                }
              }
              const subGeo = new THREE.BufferGeometry()
              Object.keys(attrs).forEach((k) => {
                const a = attrs[k]
                if (!a || !a.array || typeof a.itemSize !== 'number') return
                const itemSize = a.itemSize
                const Ctor = a.array.constructor
                const na = new Ctor(newCount2 * itemSize)
                for (const [oldI, newI] of oldToNew2.entries()) {
                  const so = oldI * itemSize; const doff = newI * itemSize
                  for (let j = 0; j < itemSize; j += 1) na[doff + j] = a.array[so + j]
                }
                subGeo.setAttribute(k, new THREE.BufferAttribute(na, itemSize, a.normalized))
              })
              subGeo.setIndex(new THREE.BufferAttribute(newIdx2, 1))
              try { subGeo.computeBoundingBox() } catch { }
              try { subGeo.computeBoundingSphere() } catch { }
              if (!subGeo.getAttribute('normal')) { try { subGeo.computeVertexNormals() } catch { } }
              res.push(subGeo)
            }
            return res.length ? res : null
          } catch { return null }
        }

        // Compute threshold based on average triangle count across pieces.
        let total = 0
        const triCounts = pieces.map((pp) => {
          try {
            const g = pp?.mesh?.geometry
            const c = g?.index ? Math.floor(g.index.count / 3) : 0
            total += c
            return c
          } catch { return 0 }
        })
        const avg = total / Math.max(1, pieces.length)
        const thresh = Math.max(400, avg * 1.6)
        const newPieces = []
        for (let i = 0; i < pieces.length; i += 1) {
          const p = pieces[i]
          const m = p?.mesh
          const tc = triCounts[i]
          const isHead = !!(m && (m.name === 'Head_rigid_group' || /head/i.test(m.name || '')))
          if (isHead || tc <= thresh || !m?.geometry) {
            newPieces.push(p)
            continue
          }
          const nChunks = THREE.MathUtils.clamp(Math.round(tc / Math.max(300, avg)), 2, 6)
          const subs = sliceGeometry(m.geometry, nChunks)
          if (!subs || subs.length < 2) { newPieces.push(p); continue }
          // Build a rigid mesh per sub-geometry, reusing the original material.
          const srcMat = Array.isArray(m.material) ? m.material[0] : m.material
          const parent = m.parent || piecesRootRef.current
          const worldPos = m.position.clone()
          const worldQuat = m.quaternion.clone()
          try { parent.remove(m) } catch { }
          for (let sj = 0; sj < subs.length; sj += 1) {
            const subGeo = subs[sj]
            // Recenter geometry so rotation is natural.
            let subCenter = new THREE.Vector3()
            try { subGeo.boundingBox?.getCenter?.(subCenter) } catch { }
            if (!Number.isFinite(subCenter.x)) subCenter.set(0, 0, 0)
            try {
              subGeo.translate(-subCenter.x, -subCenter.y, -subCenter.z)
              subGeo.computeBoundingBox()
              subGeo.computeBoundingSphere()
            } catch { }
            const subMesh = new THREE.Mesh(subGeo, srcMat)
            subMesh.castShadow = true
            subMesh.receiveShadow = true
            subMesh.frustumCulled = false
            subMesh.matrixAutoUpdate = true
            subMesh.userData.__disassembleOwned = true
            subMesh.name = (m.name || 'piece') + '_s' + sj
            // Apply original mesh world offset + local sub-center offset rotated by original quat.
            const offset = subCenter.clone().applyQuaternion(worldQuat)
            subMesh.position.copy(worldPos).add(offset)
            subMesh.quaternion.copy(worldQuat)
            try { parent.add(subMesh) } catch { }

            // Radius/bottom from sub geometry.
            let sBottom = 0.12; let sRadius = 0.12
            try {
              const bb = subGeo.boundingBox
              if (bb) {
                const b = -bb.min.y
                if (Number.isFinite(b) && b > 1e-6) sBottom = b
              }
              const bs = subGeo.boundingSphere
              if (bs && Number.isFinite(bs.radius) && bs.radius > 1e-6) sRadius = bs.radius
            } catch { }

            const homePos = subMesh.position.clone()
            const homeQuat = subMesh.quaternion.clone()
            newPieces.push({
              mesh: subMesh,
              v: new THREE.Vector3(),
              w: new THREE.Vector3(),
              homePos,
              homeQuat,
              assembleStartPos: homePos.clone(),
              assembleStartQuat: homeQuat.clone(),
              centerLocal: homePos.clone(),
              bottom: sBottom,
              radius: sRadius,
              delayS: 0,
              started: false,
              releasePos: null,
              impulseV: null,
              impulseW: null,
            })
          }
        }
        if (newPieces.length > pieces.length) {
          try { console.log('[disassemble] subdivided', pieces.length, '->', newPieces.length, 'pieces') } catch { }
          pieces.length = 0
          for (let i = 0; i < newPieces.length; i += 1) pieces.push(newPieces[i])
        }
      } catch { }

      disassembleActiveRef.current = true
      disassembleRef.current.phase = 'fall'
      disassembleRef.current.t = 0
      disassembleRef.current.pieces = pieces

      const center = new THREE.Vector3()
      for (let i = 0; i < pieces.length; i += 1) center.add(pieces[i].homePos)
      center.multiplyScalar(1 / Math.max(1, pieces.length))

      // Instant simultaneous release: every piece drops from its rest pose at
      // the same moment and gravity takes over. Small random angular and
      // lateral kicks prevent pieces from falling in a perfectly aligned
      // stack, but NO upward impulse — the effect is "character suddenly
      // comes apart", not "pieces launched into the air".
      try {
        for (let i = 0; i < pieces.length; i += 1) {
          const it = pieces[i]
          it.delayS = 0
          it.started = false
          try { it.mesh.visible = true } catch { }
          try { it.mesh.position.copy(it.homePos) } catch { }
          try { it.mesh.quaternion.copy(it.homeQuat) } catch { }
          it.v.set(0, 0, 0)
          it.w.set(0, 0, 0)

          // Release at the rest pose — no upward push, no outward offset.
          const releasePos = it.homePos.clone()

          // Explosive radial burst — pieces fly outward and upward before gravity pulls them down.
          const dir = it.homePos.clone().sub(center)
          dir.y = 0
          if (dir.lengthSq() < 1e-6) {
            const a = i * 2.399963229728653
            dir.set(Math.cos(a), 0, Math.sin(a))
          }
          dir.normalize()
          const lateralKick = 1.4 + Math.random() * 0.8
          const impulseV = new THREE.Vector3().addScaledVector(dir, lateralKick)
          impulseV.y = 2.5 + Math.random() * 1.8
          const impulseW = new THREE.Vector3(
            (Math.random() - 0.5) * 6.0,
            (Math.random() - 0.5) * 6.0,
            (Math.random() - 0.5) * 6.0,
          )

          it.releasePos = releasePos
          it.impulseV = impulseV
          it.impulseW = impulseW
        }
        disassembleRef.current.maxDelayS = 0
      } catch {
        disassembleRef.current.maxDelayS = 0
      }

      applyModelOpacity(0)

      // Save stats/snapshot for console (same as the bake path)
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
      } catch { }
      return true
    }
    // If we did not reach the minimum, save diagnostics for console.
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
    } catch { }

    // 0) Prefer pre-baked rigid pieces (if they exist in the GLB).
    // This avoids ALL Skinning/Armature and micro-mesh problems.
    // BUT: if the asset has only 1-2 meshes tagged Rigid_ (e.g. a sphere),
    // using it would make the character disappear leaving only that piece.
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

        let geo
        try { geo = src.geometry.clone() } catch { continue }
        let mat
        try { mat = createRigidMaterial(src.material) } catch { mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff') }) }

        // Bake mesh transform into geometry (root local space)
        try {
          rel.multiplyMatrices(parentInv, src.matrixWorld)
          geo.applyMatrix4(rel)
        } catch { }
        try { geo.computeBoundingBox() } catch { }
        try { geo.computeBoundingSphere() } catch { }

        const pieceCenter = new THREE.Vector3()
        try { geo.boundingBox?.getCenter?.(pieceCenter) } catch { }
        try {
          geo.translate(-pieceCenter.x, -pieceCenter.y, -pieceCenter.z)
          try { geo.computeVertexNormals() } catch { }
          geo.computeBoundingBox()
          geo.computeBoundingSphere()
        } catch { }

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
        } catch { }
        let radius = 0.12
        try {
          const bs = geo.boundingSphere
          if (bs && Number.isFinite(bs.radius) && bs.radius > 1e-6) radius = bs.radius
        } catch { }

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
        try { piecesRootRef.current.add(rigid) } catch { }
      }

      if (pieces.length) {
        if (centerCount > 0) center.multiplyScalar(1 / centerCount)
        // Reuse the same spawn/impulse logic

      }

      try {
        // @ts-ignore
        window.__playerDisassembleMeshStats = { ...(window.__playerDisassembleMeshStats || {}), path: 'authoredRigid', authoredRigid: authoredRigid.length }
      } catch { }
    }

    // Debug: axes to visualize the pieces root (if invisible, the problem is render/canvas)
    if (dbg.axes) {
      try {
        const axes = new THREE.AxesHelper(2.0)
        axes.renderOrder = 1000
        axes.frustumCulled = false
        piecesRootRef.current.add(axes)
      } catch { }
    }

    // If no authored baked pieces exist, use the runtime bake pipeline
    const parentInv = new THREE.Matrix4()
    try { parentInv.copy(modelRootRef.current.matrixWorld).invert() } catch { parentInv.identity() }
    const rel = new THREE.Matrix4()
    const tmpCenter = new THREE.Vector3()
    const tmpSize = new THREE.Vector3()

    // Approximate center for radial push (in root space)
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

    // Prepass: count renderable meshes + detect the primary SkinnedMesh.
    // Many rigs pack the entire body in a single SkinnedMesh even if it looks like separate pieces.
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
          } catch { }
          if (tri > bestSkinnedTri) { bestSkinnedTri = tri; bestSkinned = o }
        }
      })
    } catch { }

    // Cheap prepass (no bake): if the GLB has Egg_ pieces, use ONLY those.
    // This avoids baking 100+ meshes (main cause of Context Lost).
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
      } catch { }
      // Important: some GLBs have only 1-2 Egg_* nodes (e.g. an accessory).
      // If we activate Egg_ mode with too few pieces, the character disappears
      // and only those piece(s) remain. That is why we require a minimum.
      eggSeen = eggMeshes.length
      const MIN_EGG_MESHES = 6
      hasEggPrefix = eggMeshes.length >= MIN_EGG_MESHES
    }

    // Build candidates:
    // - If Egg_ exists: iterate only over eggMeshes.
    // - If no Egg_: full traverse.
    const buildCandidateFrom = (o, eggTag = '') => {

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

      // For SkinnedMesh: ensure bone matrices are updated before baking
      if (isSkinned) {
        try { srcMesh.visible = true } catch { }
        try { srcMesh.updateMatrixWorld(true) } catch { }
        try { srcMesh.skeleton?.update?.() } catch { }
      }

      // Bake geometry if skinned; otherwise clone
      let geo
      try {
        geo = isSkinned ? bakeSkinnedGeometry(srcMesh) : srcMesh.geometry.clone()
        try { geo.computeBoundingSphere() } catch { }
      } catch {
        return
      }

      // If the character is a single (or few) skinned mesh(es), we need to split it into pieces.
      // Many rigs export the entire body as a single SkinnedMesh even if it looks like parts.
      const forceSplit = (() => {
        try { return window?.localStorage?.getItem('player_disassemble_force_split') === '1' } catch { return false }
      })()
      const isPrimarySkinned = !!(isSkinned && bestSkinned && (bestSkinned === srcMesh) && bestSkinnedTri >= 800)
      // Split the primary skinned mesh almost always (cap at 18) to guarantee multiple pieces.
      const shouldSplitThisMesh = !!(isPrimarySkinned && (forceSplit || true))

      const emitCandidateFromGeo = (geoIn, srcMatIn, suffix = '') => {
        // We want real pieces from the model:
        // - if no split: 1 piece per mesh
        // - if split: multiple pieces by islands/chunks
        const mat = createRigidMaterial(srcMatIn)

        // Robust transform: bake mesh matrixWorld into geometry (root local space)
        let pieceGeo = geoIn
        try {
          rel.multiplyMatrices(parentInv, srcMesh.matrixWorld)
          pieceGeo.applyMatrix4(rel)
        } catch { }
        // Robust bounds: some skinned meshes may produce invalid bbox (NaN/Inf).
        try { pieceGeo.computeBoundingSphere() } catch { }
        try { pieceGeo.computeBoundingBox() } catch { }
        // Recenter geometry to mesh center so the pivot is correct.
        let pieceCenter = new THREE.Vector3(0, 0, 0)
        let centerOk = false
        try {
          const bb = pieceGeo.boundingBox
          if (bb) {
            bb.getCenter(pieceCenter)
            centerOk = [pieceCenter.x, pieceCenter.y, pieceCenter.z].every((v) => Number.isFinite(v))
          }
        } catch { }
        if (!centerOk) {
          try {
            const bs = pieceGeo.boundingSphere
            if (bs?.center) {
              pieceCenter.copy(bs.center)
              centerOk = [pieceCenter.x, pieceCenter.y, pieceCenter.z].every((v) => Number.isFinite(v))
            }
          } catch { }
        }
        try {
          pieceGeo.translate(-pieceCenter.x, -pieceCenter.y, -pieceCenter.z)
          if (!dbg.proxy) {
            // applyMatrix4 already bakes the full scale/rot/pos
            try { pieceGeo.computeVertexNormals() } catch { }
          }
          pieceGeo.computeBoundingSphere()
          pieceGeo.computeBoundingBox()
        } catch { }

        // Triangle metric (for discarding micro meshes)
        let triCount = 0
        try {
          if (pieceGeo.index?.array) triCount = Math.floor(pieceGeo.index.array.length / 3)
          else if (pieceGeo.attributes?.position?.count) triCount = Math.floor(pieceGeo.attributes.position.count / 3)
        } catch { }

        let finalMat = mat
        // Auto-proxy: if geometry ended up with invalid/ultra-small bounds, use a cube.
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
          try { pieceGeo = new THREE.BoxGeometry(s, s, s) } catch { }
          try {
            const id = (pieces.length + 1) * 0.61803398875
            const hue = id - Math.floor(id)
            finalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.95, 0.6), transparent: false, opacity: 1, side: THREE.DoubleSide })
            finalMat.toneMapped = false
            try { finalMat.depthTest = false; finalMat.depthWrite = false } catch { }
          } catch { }
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
          try { finalMat.depthTest = false; finalMat.depthWrite = false } catch { }
        } else if (dbg.proxy) {
          const id = (pieces.length + 1) * 0.61803398875
          const hue = id - Math.floor(id)
          finalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.95, 0.6), transparent: false, opacity: 1, side: THREE.DoubleSide })
          finalMat.toneMapped = false
          try { finalMat.depthTest = false; finalMat.depthWrite = false } catch { }
        }

        const rigid = new THREE.Mesh(pieceGeo, finalMat)
        rigid.userData.__disassembleOwned = true
        rigid.castShadow = true
        rigid.receiveShadow = true
        rigid.frustumCulled = false
        rigid.renderOrder = (dbg.noDepthTest || dbg.proxy) ? 999 : 0
        try { rigid.name = `${nameRaw || '(no-name)'}${suffix}` } catch { }

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
        } catch { }
        let radius = 0.12
        try {
          const bs = pieceGeo.boundingSphere
          if (bs && Number.isFinite(bs.radius) && bs.radius > 1e-6) radius = bs.radius
        } catch { }

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
        } catch { }
        const name = `${nameRaw}${suffix}`
        candidates.push({ data, maxDim, vol, triCount, name, eggTag, skinned: !!isSkinned })

        if (dbg.enabled) {
          try { dbgList.push({ name: name || '(no-name)', skinned: !!isSkinned, maxDim, vol, triCount }) } catch { }
        }
      }

      if (shouldSplitThisMesh) {
        // Prefer bone-group split (one piece per limb) — yields clean ragdoll
        // chunks instead of spatial slices. Falls back to islands/chunks if
        // the mesh lacks skin attributes or the split produced <2 groups.
        let parts = []
        try {
          if (isSkinned) {
            const bonePartsTry = splitGeometryByBoneGroups(srcMesh, geo)
            if (bonePartsTry && bonePartsTry.length >= 2) parts = bonePartsTry
          }
        } catch {
          parts = []
        }
        if (!parts || parts.length < 2) {
          try {
            parts = splitGeometryByGroupsOrIslands(geo, srcMesh.material) || []
          } catch {
            parts = []
          }
        }
        if (parts && parts.length > 1) {
          // Cap to avoid cost explosion
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
        // If split failed, fall through to the normal path
      }

      // Normal path: 1 piece per mesh
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
        try { scene.traverse((o) => buildCandidateFrom(o, '')) } catch { }
      }
    }

    if (!pieces.length && !candidates.length) return false

    // If Egg_-prefixed pieces already exist, use ONLY those.
    // This makes the effect deterministic and prevents micro-meshes or volume filters
    // from leaving only 1 visible piece.
    const eggCandidates = hasEggPrefix ? candidates.filter((c) => !!c.eggTag) : []
    if (!pieces.length && eggCandidates.length) {
      // Keep the name order for stability.
      eggCandidates.sort((a, b) => (a.eggTag || '').localeCompare(b.eggTag || ''))
      const MAX_EGG_PIECES = 64
      const keptEgg = eggCandidates.slice(0, MAX_EGG_PIECES)
      for (let i = 0; i < keptEgg.length; i += 1) {
        const it = keptEgg[i].data
        pieces.push(it)
        meshKept += 1
        center.add(it.homePos)
        centerCount += 1
        try { piecesRootRef.current.add(it.mesh) } catch { }
      }
      if (!pieces.length) return false
      if (centerCount > 0) center.multiplyScalar(1 / centerCount)
    } else if (!pieces.length) {
      // Robust selection: prioritize important pieces even if bbox/vol fails.
      // Reason: if bbox/maxDim is NaN/0 (common in skinned), the previous filter left only 1 piece.
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
        // score: volume (if available) > triCount > size
        return vol * 1e6 + tri * 10 + maxDim
      }

      const sorted = [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a))
      let kept = sorted.slice(0, MAX_PIECES)
      if (kept.length < MIN_KEEP) kept = sorted.slice(0, Math.min(sorted.length, MIN_KEEP))
      if (kept.length > TARGET_PIECES) kept = kept.slice(0, TARGET_PIECES)

      for (let i = 0; i < kept.length; i += 1) {
        const it = kept[i].data
        pieces.push(it)
        meshKept += 1
        center.add(it.homePos)
        centerCount += 1
        try { piecesRootRef.current.add(it.mesh) } catch { }
      }
      if (!pieces.length) return false
      if (centerCount > 0) center.multiplyScalar(1 / centerCount)
    }

    // Instant simultaneous release — see matching block above for rationale.
    try {
      for (let i = 0; i < pieces.length; i += 1) {
        const it = pieces[i]
        it.delayS = 0
        it.started = false
        try { it.mesh.visible = true } catch { }
        try { it.mesh.position.copy(it.homePos) } catch { }
        try { it.mesh.quaternion.copy(it.homeQuat) } catch { }
        try { it.mesh.scale.set(1, 1, 1) } catch { }
        it.v.set(0, 0, 0)
        it.w.set(0, 0, 0)

        const releasePos = it.homePos.clone()

        const dir = it.homePos.clone().sub(center)
        dir.y = 0
        if (dir.lengthSq() < 1e-6) {
          const a = i * 2.399963229728653
          dir.set(Math.cos(a), 0, Math.sin(a))
        }
        dir.normalize()
        const lateralKick = 1.4 + Math.random() * 0.8
        const impulseV = new THREE.Vector3().addScaledVector(dir, lateralKick)
        impulseV.y = 2.5 + Math.random() * 1.8
        const impulseW = new THREE.Vector3(
          (Math.random() - 0.5) * 6.0,
          (Math.random() - 0.5) * 6.0,
          (Math.random() - 0.5) * 6.0,
        )

        it.releasePos = releasePos
        it.impulseV = impulseV
        it.impulseW = impulseW
      }
      disassembleRef.current.maxDelayS = 0
    } catch {
      disassembleRef.current.maxDelayS = 0
    }

    disassembleActiveRef.current = true
    disassembleRef.current.phase = 'fall'
    disassembleRef.current.t = 0
    disassembleRef.current.pieces = pieces
    // Always save stats (so stats() does not depend on debug).
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
    } catch { }

    // Hide the skinned character using the existing mechanism
    applyModelOpacity(0)
    return true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyModelOpacity, bakeSkinnedGeometry, clearDisassemblePieces, createRigidMaterial, playerRef, readDisassembleDebugFlags, scene, splitGeometryByGroupsOrIslands, splitGeometryByBoneGroups])

  const requestAssemble = useCallback(() => {
    if (!disassembleActiveRef.current) return
    const dis = disassembleRef.current
    // release easter egg hold
    dis.holdExternal = false
    const pieces = dis.pieces || []
    // if pieces have not started falling yet, force a full fall before assembling
    try { dis.phase = 'assemble' } catch { }
    dis.t = 0
    for (let i = 0; i < pieces.length; i += 1) {
      const it = pieces[i]
      try { it.mesh.visible = true } catch { }
      it.assembleStartPos.copy(it.mesh.position)
      it.assembleStartQuat.copy(it.mesh.quaternion)
      it.v.set(0, 0, 0)
      it.w.set(0, 0, 0)
    }
  }, [])

  // Global listener (triggered by the easter egg from UI)
  useEffect(() => {
    if (!DISASSEMBLE_ENABLED) return undefined
    const onDis = () => startDisassemble({ forceVisible: true })
    try { window.addEventListener('player-disassemble', onDis) } catch { }
    return () => {
      try { window.removeEventListener('player-disassemble', onDis) } catch { }
    }
  }, [startDisassemble])

  // Now that startDisassemble exists (no TDZ), update trigger to be direct.
  useEffect(() => {
    try {
      // @ts-ignore
      if (!window.__playerDisassemble) return
      // @ts-ignore
      window.__playerDisassemble.trigger = () => { try { startDisassemble() } catch { } }
    } catch { }
  }, [startDisassemble])

  // Integration with the global easter egg state:
  // - if activated before the model is ready, we retry on load.
  // - lightning bolt plays ~240ms before the disassemble fires.
  const eggPrevActiveRef = useRef(false)
  const eggPendingStartRef = useRef(false)
  const boltTimerRef = useRef(null)
  const [boltVisible, setBoltVisible] = useState(false)
  const [boltSeed, setBoltSeed] = useState(0)
  // Delay between bolt spawn and impact/disassemble. Bolt itself animates ~220ms,
  // we fire the shatter at ~230ms so the voxel burst coincides with the flash peak.
  const BOLT_STRIKE_DELAY_MS = 230
  useEffect(() => {
    const prev = eggPrevActiveRef.current
    const next = !!eggActive
    eggPrevActiveRef.current = next
    eggActiveRef.current = next
    if (next && !prev) {
      eggEndRequestedRef.current = false
      eggPendingStartRef.current = false
      try { console.log('[easter-egg] ACTIVATE — bolt → startDisassemble') } catch { }
      // NOTE: no usamos eggFreezeActiveRef — es del sistema voxel viejo y su
      // branch en useFrame hace `return` antes de correr la física rigid-piece.
      // El startDisassemble (rigid-piece) trae su propio hold vía holdExternal.
      // Spawn the bolt (unique seed triggers remount to re-roll geometry)
      setBoltSeed((s) => s + 1)
      setBoltVisible(true)
      try { playSfx('thunder.mp3', { volume: 0.9 }) } catch { }
      // Notify UI (flash overlay + postfx boost)
      try { window.dispatchEvent(new CustomEvent('bolt-strike', { detail: { at: performance.now() } })) } catch { }
      // Fire the disassemble at flash peak.
      if (boltTimerRef.current) clearTimeout(boltTimerRef.current)
      boltTimerRef.current = setTimeout(() => {
        boltTimerRef.current = null
        try { startDisassemble({ hold: true, forceVisible: true }) } catch { }
        // Radial impulse from ground impact — sells the force of the strike.
        // Run on the next frame so pieces have been created by startDisassemble.
        try {
          requestAnimationFrame(() => {
            try {
              const dis = disassembleRef.current
              if (!dis || !Array.isArray(dis.pieces)) return
              const playerPos = new THREE.Vector3()
              try { playerRef?.current?.getWorldPosition(playerPos) } catch { }
              // Impact point ~at character's feet — impulse radiates up-and-out.
              const impact = playerPos.clone()
              impact.y += 0.2
              // Push nearby spheres (orbs) outward from the impact.
              try {
                if (typeof onPulse === 'function') {
                  onPulse(impact.clone(), 12, 6)
                }
              } catch { }
              const tmp = new THREE.Vector3()
              for (let i = 0; i < dis.pieces.length; i += 1) {
                const it = dis.pieces[i]
                if (!it || !it.mesh) continue
                // World position of the piece (detached pieces live under piecesRootRef).
                try { it.mesh.getWorldPosition(tmp) } catch { continue }
                // Radial direction from impact to piece, with guaranteed upward bias.
                const dir = tmp.clone().sub(impact)
                if (dir.lengthSq() < 1e-4) dir.set((Math.random() - 0.5), 0.5, (Math.random() - 0.5))
                dir.normalize()
                // Force more outward (horizontal) + strong upward kick.
                const horiz = 6.5 + Math.random() * 4.0
                const vert = 4.5 + Math.random() * 3.5
                // Prefer the existing impulse direction when available, else apply ours.
                if (it.impulseV) {
                  it.impulseV.x += dir.x * horiz
                  it.impulseV.z += dir.z * horiz
                  it.impulseV.y += vert
                }
                // Also stamp current v so pieces already in motion get kicked.
                if (it.v) {
                  it.v.x += dir.x * horiz
                  it.v.z += dir.z * horiz
                  it.v.y += vert
                }
                // Extra spin from the blast.
                if (it.w) {
                  it.w.x += (Math.random() - 0.5) * 14
                  it.w.y += (Math.random() - 0.5) * 14
                  it.w.z += (Math.random() - 0.5) * 14
                }
                if (it.impulseW) {
                  it.impulseW.x += (Math.random() - 0.5) * 14
                  it.impulseW.y += (Math.random() - 0.5) * 14
                  it.impulseW.z += (Math.random() - 0.5) * 14
                }
              }
            } catch { }
          })
        } catch { }
      }, BOLT_STRIKE_DELAY_MS)
    } else if (!next && prev) {
      eggPendingStartRef.current = false
      try { window.__cheatEggExtendedDrift = false } catch { }
      try { console.log('[easter-egg] DEACTIVATE — disassembleActive=', disassembleActiveRef.current) } catch { }
      // Cancel any pending bolt→disassemble timer (edge case: egg toggled fast)
      if (boltTimerRef.current) { clearTimeout(boltTimerRef.current); boltTimerRef.current = null }
      setBoltVisible(false)
      // Rewind effect: notify UI for VHS overlay + postfx boost + whirr sfx
      try { window.dispatchEvent(new CustomEvent('egg-rewind-start', { detail: { at: performance.now() } })) } catch { }
      try { playSfx('rewind.wav', { volume: 0.75 }) } catch { }
      if (disassembleActiveRef.current) {
        try { requestAssemble() } catch { }
      } else {
        try { applyModelOpacity(1) } catch { }
      }
    }
  }, [eggActive, startDisassemble, requestAssemble, applyModelOpacity, playerRef])

  // Antimatter strike → si el rayo del portal equivocado cae encima o muy cerca
  // del personaje, lo desarmamos con el mismo sistema de piezas rígidas del
  // easter egg y lo re-armamos solo tras un beat. El shockwave a las esferas ya
  // lo aplica HomeOrbs; acá solo empujamos las piezas del personaje.
  const ANTIMATTER_DISASSEMBLE_RADIUS = 4.0
  const antimatterStrikeTimerRef = useRef(null)
  const antimatterReassembleTimerRef = useRef(null)
  // Refs a las funciones para que el listener se monte UNA sola vez (`[]`). Si
  // el effect dependiera de startDisassemble/requestAssemble, un re-render
  // durante el strike re-ejecutaría el effect y su cleanup CANCELARÍA el
  // setTimeout pendiente (230ms) → el desarme nunca dispara.
  const startDisassembleRef = useRef(startDisassemble)
  startDisassembleRef.current = startDisassemble
  const requestAssembleRef = useRef(requestAssemble)
  requestAssembleRef.current = requestAssemble
  useEffect(() => {
    // NOTE: no gateamos con DISASSEMBLE_ENABLED — ese flag solo desactiva el
    // listener legacy `player-disassemble`. El easter egg y este strike llaman
    // a startDisassemble directo, igual que el effect de eggActive.
    const onStrike = (e) => {
      try {
        const d = e?.detail || {}
        const sx = Number.isFinite(d.x) ? d.x : 0
        const sz = Number.isFinite(d.z) ? d.z : 0
        const playerPos = new THREE.Vector3()
        try { playerRef?.current?.getWorldPosition(playerPos) } catch { return }
        const dist = Math.hypot(playerPos.x - sx, playerPos.z - sz)
        if (dist > ANTIMATTER_DISASSEMBLE_RADIUS) return
        if (disassembleActiveRef.current) return
        // Shatter at the bolt's flash peak (same delay the easter egg uses).
        if (antimatterStrikeTimerRef.current) clearTimeout(antimatterStrikeTimerRef.current)
        antimatterStrikeTimerRef.current = setTimeout(() => {
          antimatterStrikeTimerRef.current = null
          const ok = startDisassembleRef.current?.({ hold: true, forceVisible: true })
          if (!ok) return
          // El rayo de la esfera corrupta SÍ despiezó al personaje → desbloquea
          // la skin Molten Lava (el listener vive en App.jsx).
          try { window.dispatchEvent(new CustomEvent('character-disassembled-by-bolt')) } catch { }
          // Radial impulse from the strike point — pieces blast up-and-out.
          requestAnimationFrame(() => {
            try {
              const dis = disassembleRef.current
              if (!dis || !Array.isArray(dis.pieces)) return
              const impact = new THREE.Vector3(sx, 0.2, sz)
              const tmp = new THREE.Vector3()
              for (let i = 0; i < dis.pieces.length; i += 1) {
                const it = dis.pieces[i]
                if (!it || !it.mesh) continue
                try { it.mesh.getWorldPosition(tmp) } catch { continue }
                const dir = tmp.clone().sub(impact)
                if (dir.lengthSq() < 1e-4) dir.set((Math.random() - 0.5), 0.5, (Math.random() - 0.5))
                dir.normalize()
                const horiz = 6.5 + Math.random() * 4.0
                const vert = 4.5 + Math.random() * 3.5
                if (it.impulseV) { it.impulseV.x += dir.x * horiz; it.impulseV.z += dir.z * horiz; it.impulseV.y += vert }
                if (it.v) { it.v.x += dir.x * horiz; it.v.z += dir.z * horiz; it.v.y += vert }
                if (it.w) { it.w.x += (Math.random() - 0.5) * 14; it.w.y += (Math.random() - 0.5) * 14; it.w.z += (Math.random() - 0.5) * 14 }
                if (it.impulseW) { it.impulseW.x += (Math.random() - 0.5) * 14; it.impulseW.y += (Math.random() - 0.5) * 14; it.impulseW.z += (Math.random() - 0.5) * 14 }
              }
            } catch { }
          })
          // Auto-reassemble after a beat (the strike is a punishment, not death).
          if (antimatterReassembleTimerRef.current) clearTimeout(antimatterReassembleTimerRef.current)
          antimatterReassembleTimerRef.current = setTimeout(() => {
            antimatterReassembleTimerRef.current = null
            // Mismo "rewind" que la desactivación del easter egg: overlay VHS +
            // boost de postfx + whirr, sincronizado con el requestAssemble.
            try { window.dispatchEvent(new CustomEvent('egg-rewind-start', { detail: { at: performance.now() } })) } catch { }
            try { playSfx('rewind.wav', { volume: 0.75 }) } catch { }
            try { if (disassembleActiveRef.current) requestAssembleRef.current?.() } catch { }
          }, 1700)
        }, BOLT_STRIKE_DELAY_MS)
      } catch { }
    }
    window.addEventListener('antimatter-orb-strike', onStrike)
    return () => {
      window.removeEventListener('antimatter-orb-strike', onStrike)
      if (antimatterStrikeTimerRef.current) { clearTimeout(antimatterStrikeTimerRef.current); antimatterStrikeTimerRef.current = null }
      if (antimatterReassembleTimerRef.current) { clearTimeout(antimatterReassembleTimerRef.current); antimatterReassembleTimerRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Disassembly disabled: do not retry startDisassemble.
    if (!eggActive) return
  }, [eggActive, scene, startDisassemble])

  // ---- GOLD SKIN TRANSFORM FX (Shader-based, no voxel explode) ----
  // Activation: flash + dissolve particles (handled by App.jsx components)
  // Here we manage: hide model on start, reveal wipe on end, freeze player.
  const goldTransformPrevRef = useRef(false)
  const goldRevealActiveRef = useRef(false)
  const goldRevealTRef = useRef(0)
  const goldRevealMaterialsRef = useRef([])
  const GOLD_REVEAL_DURATION = 1.7 // seconds for the wipe
  const GOLD_REVEAL_START_Y = -0.5 // below feet
  const GOLD_REVEAL_END_Y = 2.5   // above head

  useEffect(() => {
    const prev = goldTransformPrevRef.current
    const next = !!goldSkinTransformActive
    goldTransformPrevRef.current = next
    if (next && !prev) {
      // Activation: hide model, freeze player
      try {
        if (playerRef?.current?.position) eggFreezePosRef.current.copy(playerRef.current.position)
        eggFreezeActiveRef.current = true
      } catch { }
      try { applyModelOpacity(0) } catch { }
    } else if (!next && prev) {
      // Deactivation: start the reveal wipe animation
      try { eggFreezeActiveRef.current = false } catch { }
      goldRevealActiveRef.current = true
      goldRevealTRef.current = 0
      // Ensure model is fully visible for the wipe to work on
      lastAppliedOpacityRef.current = -1
      try { applyModelOpacity(1) } catch { }
      // Inject reveal wipe shader into all model materials
      try {
        const mats = []
        scene.traverse((obj) => {
          if (!obj || (!obj.isMesh && !obj.isSkinnedMesh) || !obj.material) return
          if (obj.name && obj.name.endsWith('_outline')) return
          const matList = Array.isArray(obj.material) ? obj.material : [obj.material]
          matList.forEach((m) => {
            if (!m || !m.isMaterial || mats.includes(m)) return
            // Store original onBeforeCompile so we can restore it
            m.userData.__origOnBeforeCompile = m.onBeforeCompile || null
            m.userData.__goldRevealY = { value: GOLD_REVEAL_START_Y }
            m.onBeforeCompile = (shader) => {
              // Call original if exists
              if (m.userData.__origOnBeforeCompile) {
                m.userData.__origOnBeforeCompile(shader)
              }
              // Inject reveal uniform
              shader.uniforms.uRevealY = m.userData.__goldRevealY
              // Inject into vertex shader: pass world Y to fragment
              shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                varying float vWorldY;`
              )
              shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                vWorldY = worldPosition.y;`
              )
              // Inject into fragment shader: discard above wipe line + gold rim
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform float uRevealY;
                varying float vWorldY;`
              )
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>
                if (vWorldY > uRevealY) discard;
                float rimDist = uRevealY - vWorldY;
                if (rimDist < 0.15) {
                  float rimT = 1.0 - rimDist / 0.15;
                  vec3 rimGold = vec3(1.0, 0.75, 0.2);
                  gl_FragColor.rgb += rimGold * rimT * 2.0;
                  gl_FragColor.a = max(gl_FragColor.a, rimT * 0.8);
                }`
              )
            }
            m.needsUpdate = true
            mats.push(m)
          })
        })
        goldRevealMaterialsRef.current = mats
      } catch (e) {
        console.error('[GoldReveal] Shader injection error:', e)
      }
    }
  }, [goldSkinTransformActive, scene])

  // Reveal wipe animation loop (runs only during the wipe)
  useFrame((_, dtRaw) => {
    if (!goldRevealActiveRef.current) return
    const dt = Math.min(0.05, dtRaw || 0.016)
    goldRevealTRef.current += dt
    const t = Math.min(goldRevealTRef.current / GOLD_REVEAL_DURATION, 1)
    // easeOutCubic for smooth deceleration
    const ease = 1 - Math.pow(1 - t, 3)
    const revealY = THREE.MathUtils.lerp(GOLD_REVEAL_START_Y, GOLD_REVEAL_END_Y, ease)

    // Update all injected materials
    const mats = goldRevealMaterialsRef.current
    for (let i = 0; i < mats.length; i++) {
      try {
        if (mats[i].userData.__goldRevealY) {
          mats[i].userData.__goldRevealY.value = revealY
        }
      } catch { }
    }

    // Finished: clean up shader injection
    if (t >= 1) {
      goldRevealActiveRef.current = false
      for (let i = 0; i < mats.length; i++) {
        try {
          const m = mats[i]
          m.onBeforeCompile = m.userData.__origOnBeforeCompile || null
          delete m.userData.__origOnBeforeCompile
          delete m.userData.__goldRevealY
          m.needsUpdate = true
        } catch { }
      }
      goldRevealMaterialsRef.current = []
    }
  })

  // Voxel FX animation: explode -> drift -> rebuild (snap) + sync with character reveal.
  useFrame((state, dtRaw) => {
    if (!eggVoxelActiveRef.current) return
    const mesh = eggVoxelRef.current
    if (!mesh) return
    // Separate wall-clock dt (for timings) from simulation dt (for physics) so the FX
    // ALWAYS finishes, even with low FPS/hitches (clamp only for physics stability).
    // To guarantee completion after returning from a hidden tab, allow larger timeline catch-up.
    const dtWall = Math.min(2.0, Math.max(0, dtRaw || 0))
    const dt = Math.min(0.05, dtWall)
    eggVoxelTRef.current += dtWall
    const t = eggVoxelTRef.current
    const phase = eggVoxelPhaseRef.current
    const pieces = eggVoxelPiecesRef.current
    const dummy = tmpRef.current.dummy // reuse instead of new Object3D()

    // timings (source-of-truth)
    // Extended drift for cheat easter egg (voxels float longer before reassembling)
    const EXPLODE_S = EGG_VOXEL_EXPLODE_S
    const DRIFT_S = (typeof window !== 'undefined' && window.__cheatEggExtendedDrift) ? 3.0 : EGG_VOXEL_DRIFT_S
    const REBUILD_S = EGG_VOXEL_REBUILD_S
    const DONE_S = EGG_VOXEL_DONE_S
    const DONE_HOLD_S = EGG_VOXEL_DONE_HOLD_S
    const DONE_REVEAL_DELAY = EGG_VOXEL_DONE_REVEAL_DELAY_S
    const DONE_REVEAL_S = EGG_VOXEL_DONE_REVEAL_S

    // forces (more fall / more weight)
    const GRAV = -18.0
    const LIN_DAMP = Math.pow(0.22, dt)
    const ANG_DAMP = Math.pow(0.35, dt)

    if (phase === 'explode' && t >= EXPLODE_S) {
      eggVoxelPhaseRef.current = 'drift'
      eggVoxelTRef.current = 0
    } else if (phase === 'drift' && t >= DRIFT_S) {
      eggVoxelPhaseRef.current = 'rebuild'
      eggVoxelTRef.current = 0
      // initial pull toward targets: brake slightly to avoid hard overshoot
      for (let i = 0; i < pieces.length; i += 1) {
        pieces[i].vel.multiplyScalar(0.35)
        pieces[i].ang.multiplyScalar(0.5)
      }
    } else if (phase === 'rebuild' && t >= REBUILD_S) {
      eggVoxelPhaseRef.current = 'done'
      eggVoxelTRef.current = 0
      // snap to targets (hold a few frames so the final assembly is visible)
      for (let i = 0; i < pieces.length; i += 1) {
        const p = pieces[i]
        p.pos.copy(p.target)
        p.vel.set(0, 0, 0)
      }
      // NOW allow revealing the character (post-snap), but with fade-in within DONE_S.
      // Keep freeze active during DONE so it does not move while finishing assembly.
      try { eggHideLockRef.current = false } catch { }
    }

    const nextPhase = eggVoxelPhaseRef.current
    const tt = eggVoxelTRef.current

    // Centralized hide control: keep hidden until the exact instant the reveal starts.
    try {
      if (nextPhase !== 'done') eggHideForceRef.current = true
      else {
        const revealStart = DONE_HOLD_S + DONE_REVEAL_DELAY
        eggHideForceRef.current = tt < revealStart
      }
    } catch { }

    // global opacity: ramps up quickly, drops at end of rebuild (to reveal the model)
    try {
      const mat = eggVoxelMatRef.current
      if (mat) {
        let op = 0.95
        if (nextPhase === 'rebuild') {
          const a = THREE.MathUtils.clamp(tt / REBUILD_S, 0, 1)
          // easeInOutCubic (more cinematic)
          const ease = a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2
          // during rebuild, do NOT show the character (only lower voxel opacity)
          op = THREE.MathUtils.lerp(0.95, 0.12, ease)
        } else if (nextPhase === 'done') {
          // after-snap:
          // 1) HOLD: voxels fully assembled (no character reveal)
          // 2) DISSOLVE + REVEAL: dissolve cubes and smoothly reveal character
          const doneA = (tt <= DONE_HOLD_S)
            ? 0
            : THREE.MathUtils.clamp((tt - DONE_HOLD_S) / Math.max(1e-4, (DONE_S - DONE_HOLD_S)), 0, 1)
          const doneEase = 1 - Math.pow(1 - doneA, 3) // easeOutCubic
          // keep a bit of presence at the start so the assembly reads visually
          op = (tt <= DONE_HOLD_S) ? 0.24 : THREE.MathUtils.lerp(0.24, 0.0, doneEase)

          // Reveal the model ONLY after the snap is visible (post-hold)
          try {
            if (!orbActiveRef.current) {
              const tStart = DONE_HOLD_S + DONE_REVEAL_DELAY
              const tIn = THREE.MathUtils.clamp((tt - tStart) / Math.max(1e-4, DONE_REVEAL_S), 0, 1)
              const inEase = 1 - Math.pow(1 - tIn, 3) // easeOutCubic
              // If still in hold, keep at 0
              applyModelOpacity((tt <= DONE_HOLD_S) ? 0 : inEase)
            }
          } catch { }

          // Deterministic end (does not depend on local variables or FPS)
          if (tt >= DONE_S) {
            try { if (!orbActiveRef.current) applyModelOpacity(1) } catch { }
            try { stopEggVoxelFx() } catch { }
            return
          }
        }
        mat.opacity = op
        mat.needsUpdate = true
      }
    } catch { }

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

        if (p.pos.y < 0.03) {
          p.pos.y = 0.03
          // Much less bounce and more friction so it settles quickly
          p.vel.y = Math.abs(p.vel.y) * 0.05
          p.vel.x *= 0.5
          p.vel.z *= 0.5
          p.ang.multiplyScalar(0.6)
        }
      } else if (nextPhase === 'rebuild') {
        const a = THREE.MathUtils.clamp(tt / REBUILD_S, 0, 1)
        const ease = a * a * (3 - 2 * a)
        // spring-type attraction + swirl for a game-like look
        const toT = p.target.clone().sub(p.pos)
        const dist = Math.max(1e-4, toT.length())
        toT.multiplyScalar(1 / dist)
        // perpendicular XZ swirl
        const swirl = new THREE.Vector3(-toT.z, 0, toT.x).multiplyScalar(1.2 * (1 - ease))
        const kPull = 22 + 38 * ease
        const accel = toT.multiplyScalar(kPull * dist).add(swirl.multiplyScalar(6.5))

        p.vel.addScaledVector(accel, dt)
        p.vel.multiplyScalar(Math.pow(0.08, dt))
        p.pos.addScaledVector(p.vel, dt)
        // orient toward rest
        p.ang.multiplyScalar(Math.pow(0.15, dt))
        p.rot.x *= Math.pow(0.08, dt)
        p.rot.y *= Math.pow(0.08, dt)
        p.rot.z *= Math.pow(0.08, dt)
        // soft snap at the end to avoid vibration
        if (ease > 0.96) {
          p.pos.lerp(p.target, 0.35)
        }
        // Progressive snap so the full assembly is ALWAYS visible before moving to done
        if (ease > 0.84) {
          const k = THREE.MathUtils.clamp((ease - 0.84) / 0.16, 0, 1)
          const snap = 0.10 + 0.70 * k
          p.pos.lerp(p.target, snap)
          // kill residual velocity to prevent trembling that looks incomplete
          p.vel.multiplyScalar(0.35)
        }
      } else if (nextPhase === 'done') {
        // keep assembled voxel during after-snap + dissolve (shrink)
        const a = (tt <= DONE_HOLD_S)
          ? 0
          : THREE.MathUtils.clamp((tt - DONE_HOLD_S) / Math.max(1e-4, (DONE_S - DONE_HOLD_S)), 0, 1)
        const ease = 1 - Math.pow(1 - a, 3) // easeOutCubic
        p.pos.copy(p.target)
        // progressively shrink for a more polished ending
        p._doneScale = Math.max(0.0001, p.scale * (1 - 0.92 * ease))
      }
      dummy.position.copy(p.pos)
      dummy.rotation.copy(p.rot)
      // Apply normal scale or the done-dissolve scale
      // @ts-ignore
      const s = (nextPhase === 'done' && typeof p._doneScale === 'number') ? p._doneScale : p.scale
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, 20)

  // Seed emissive base (without changing look)
  useEffect(() => {
    if (!scene) return
    try {
      scene.traverse((obj) => {
        if (!obj || !obj.isMesh || !obj.material) return
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => seedEmissiveBase(m))
      })
    } catch { }
  }, [scene, seedEmissiveBase])

  // Notify the container that the character is ready (only once)
  const readyOnceRef = useRef(false)
  useEffect(() => {
    if (!scene) return
    if (readyOnceRef.current) return
    readyOnceRef.current = true
    if (typeof onCharacterReady === 'function') {
      try { onCharacterReady() } catch { }
    }
  }, [scene, onCharacterReady])

  // When navigateToPortalId changes, arm orb mode (supports synthetic 'home' center)
  const lastHandledNavRef = useRef(null)
  // Guard: el effect re-corre cuando `portals`/`onHomeFallStart` cambian de
  // identidad. Sin esto, si eso pasa tras aterrizar (orbActive=false) pero antes
  // de que navTarget vuelva a null, la caída se dispara DOS VECES (la 2da deja el
  // modelo en transición orb = casi negro). lastHandledNavRef asegura un solo
  // disparo por target; se resetea al volver a null.
  useEffect(() => {
    if (!navigateToPortalId) { lastHandledNavRef.current = null; return }
    if (!playerRef.current) return
    if (orbActiveRef.current) return
    if (lastHandledNavRef.current === navigateToPortalId) return
    lastHandledNavRef.current = navigateToPortalId
    let portal = portals.find((p) => p.id === navigateToPortalId)
    if (!portal && navigateToPortalId === 'home') {
      // synthetic target at center with a high fall
      orbTargetPosRef.current.set(0, 0, 0)
      try { playerRef.current.position.set(0, HOME_FALL_HEIGHT, 0) } catch { }
      fallFromAboveRef.current = true
      if (typeof onHomeFallStart === 'function') { try { onHomeFallStart() } catch { } }
    } else if (portal) {
      orbTargetPosRef.current.fromArray(portal.position)
      fallFromAboveRef.current = false
    } else {
      return
    }
    // keep flight at ground height (the sphere is drawn with a visual offset)
    orbTargetPosRef.current.y = playerRef.current.position.y
    // start orb now, and begin fading out model
    fadeOutTRef.current = 0
    fadeInTRef.current = 0
    showOrbRef.current = true
    // hide human immediately while the orb is visible
    try { applyModelOpacity(0) } catch { }
    orbActiveRef.current = true
    setOrbActive(true)
    if (typeof onOrbStateChange === 'function') onOrbStateChange(true)
    // SFX: orb start
    if (fallFromAboveRef.current) {
      // home mode: fall
      playSfx('sparkleFall', { volume: 0.9 })
    } else {
      playSfx('magiaInicia', { volume: 0.9 })
    }
    // No splash on orb-mode enter — explosion fires only on arrival.
    // Discard any residual queued particles from a prior arrival: otherwise
    // the tail of a previous explosion would drain mid-trip, and in
    // fall-from-above mode (home) it would rain down from sky height.
    explosionQueueRef.current.sphere = 0
    explosionQueueRef.current.ring = 0
    explosionQueueRef.current.splash = 0
    // Boost trail size/opacity so the orb leaves a visible wake during travel
    // (without this, trail sparks render at base uSize=0.28 / uOpacity=0.2 and
    // are practically invisible). Decays naturally in TrailSparks.
    explosionBoostRef.current = Math.max(explosionBoostRef.current, 1.25)
    // new random phase for wobble variation per trip
    wobblePhaseRef.current = Math.random() * Math.PI * 2
    wobblePhase2Ref.current = Math.random() * Math.PI * 2
    nearTimerRef.current = 0
    lastDistRef.current = Infinity
    hasExplodedRef.current = false
    // Disable character shadow during orb mode
    setCharacterShadowEnabled(false)
    // Nuke ALL residual sparks from any prior arrival — otherwise their tail
    // (lifespan up to ~5s) stays alive invisibly and becomes visible again when
    // the next explosion boosts opacity, making it look like leftover debris.
    try { sparksRef.current.length = 0 } catch { }
    lastPosRef.current.copy(playerRef.current.position)
    // set target color if provided by portal
    try {
      if (portal?.color) orbTargetColorRef.current = new THREE.Color(portal.color)
      else orbTargetColorRef.current = new THREE.Color('#9ec6ff')
    } catch { }
    // capture start distance to target for progressive tint
    const startPos = playerRef.current.position.clone()
    const groundTarget = orbTargetPosRef.current.clone()
    orbStartDistRef.current = Math.max(1e-3, groundTarget.distanceTo(startPos))
  }, [navigateToPortalId, portals, playerRef, onHomeFallStart])

  // Disable shadow.autoUpdate by default on the orb light
  useEffect(() => {
    try {
      if (orbLightRef.current && orbLightRef.current.shadow) {
        orbLightRef.current.shadow.autoUpdate = false
      }
    } catch { }
  }, [])

  // Compute model center once to place the initial glow at character center
  useEffect(() => {
    try {
      const box = new THREE.Box3().setFromObject(scene)
      const center = new THREE.Vector3()
      box.getCenter(center)
      orbOriginOffsetRef.current.copy(center)
    } catch { }
  }, [scene])

  // Keyboard state
  const keyboard = useKeyboard()
  const actionPrevRef = useRef(false)
  // Power charge (0..1)
  const chargeRef = useRef(0)
  // UI charge throttle (avoids 60fps re-renders on mobile)
  const lastChargeUiRef = useRef(-1)
  const lastChargeUiTsRef = useRef(0)

  const triggerManualExplosion = React.useCallback((power = 1) => {
    if (!playerRef.current) return
    const k = Math.max(0.0, Math.min(1.0, power))
    try { playSfx('sparkleBom', { volume: 0.8 }) } catch { }
    const explodePos = explosionQueueRef.current.pos
    try { playerRef.current.getWorldPosition(explodePos) } catch { }
    explodePos.add(new THREE.Vector3(0, ORB_HEIGHT, 0))
    // Particle queue (capped to avoid prolonged saturation)
    const MAX_QUEUE_SPHERE = 360
    const MAX_QUEUE_RING = 220
    const MAX_QUEUE_SPLASH = 260
    const mult = 0.3 + 1.2 * k
    explosionQueueRef.current.sphere = Math.min(MAX_QUEUE_SPHERE, explosionQueueRef.current.sphere + Math.round(80 * mult))
    explosionQueueRef.current.ring = Math.min(MAX_QUEUE_RING, explosionQueueRef.current.ring + Math.round(40 * mult))
    explosionQueueRef.current.splash = Math.min(MAX_QUEUE_SPLASH, explosionQueueRef.current.splash + Math.round(60 * mult))
    // Partial immediate burst for instant feedback
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
    // shorter visual impulse
    explosionBoostRef.current = Math.min(1.6, Math.max(explosionBoostRef.current, 0.8 + 1.2 * k))
    // Radial push to nearby orbs (HOME)
    try {
      if (typeof onPulse === 'function') {
        const strength = 6 + 10 * k
        const radius = 4 + 4 * k
        onPulse(explodePos.clone(), strength, radius)
      }
    } catch { }
  }, [onPulse, playerRef])

  // Utility to enable/disable the full character shadow
  const setCharacterShadowEnabled = React.useCallback((enabled) => {
    if (!scene) return
    try {
      scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = !!enabled
          // avoid self-shadowing on the character itself
          o.receiveShadow = false
        }
      })
    } catch { }
  }, [scene])

  // Real shadows disabled (we prefer an abstract/stable shadow in App.jsx).
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
  // MOVEMENT AND ANIMATION CONSTANTS (CENTRALIZED)
  // ============================================================
  // --- SPEEDS ---
  // Low BASE_SPEED + high SPEED = faster animation
  // The original clip is slow, so we need to speed it up
  const BASE_SPEED = 5.5  // baseline tuned to sync animation with movement
  const SPEED = 9.0       // actual character speed (reduced from 11.5)

  // --- ANIMATION CONSTANTS ---
  const IDLE_TIMESCALE = 1.6
  // Fixed multiplier to speed up the animation clip
  const WALK_TIMESCALE_MULT = 1.0
  // Fixed range to avoid variations - timeScale will be ~2x constant
  const WALK_SCALE_MIN = 1.95
  const WALK_SCALE_MAX = 2.0

  // --- BLEND WITH damp() (frame-rate independent) ---
  // Lambda for damp(): higher = faster convergence (5-30 typical)
  // 8 = very smooth transition ~0.4s (avoids jitter)
  const BLEND_LAMBDA = 8.0

  // --- PORTALS AND PROXIMITY ---
  const threshold = 3 // distance threshold for portal "inside" (for CTA)
  const EXIT_THRESHOLD = 4 // must leave this distance to rearm
  const REENTER_COOLDOWN_S = 1.2 // minimum time before re-entry
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
      try { idleDurationRef.current = idleAction.getClip()?.duration || idleDurationRef.current } catch { }
    }
    if (walkAction) {
      // Initial timeScale synced with speed
      const baseWalkScale = THREE.MathUtils.clamp((SPEED / BASE_SPEED) * WALK_TIMESCALE_MULT, WALK_SCALE_MIN, WALK_SCALE_MAX)
      walkAction.reset().setEffectiveWeight(0).setEffectiveTimeScale(baseWalkScale).play()
      walkAction.setLoop(THREE.LoopRepeat, Infinity)
      walkAction.clampWhenFinished = false
      try { walkDurationRef.current = walkAction.getClip()?.duration || walkDurationRef.current } catch { }
    }
  }, [actions, idleName, walkName])

  // Rising-edge detector per portal + cooldown to avoid instant re-entries
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
    // Power charge system (spacebar): hold to charge, release to fire
    const pressed = !!keyboard?.action
    // --- IMPROVED DELTA SMOOTHING ---
    // Wider limits: 1/144 (high refresh) to 1/10 (100ms, very low FPS)
    // Raised from 1/20 to 1/10 for better catch-up on slow GPUs
    const dtBlend = THREE.MathUtils.clamp(dtRaw, 1 / 144, 1 / 10)
    // Faster smoothing factor (~0.45) for immediate response
    // but still filters occasional GC/hitch spikes
    const DT_SMOOTH_FACTOR = 0.45
    dtSmoothRef.current = THREE.MathUtils.lerp(dtSmoothRef.current, dtBlend, DT_SMOOTH_FACTOR)
    dtMoveRef.current = dtRaw
    const dt = dtSmoothRef.current
    // Footstep cooldown
    footCooldownSRef.current = Math.max(0, footCooldownSRef.current - dt)

    // During easter egg, the orb must NOT activate or hide the character.
    if (eggActiveRef.current) {
      try { orbActiveRef.current = false } catch { }
      try { showOrbRef.current = false } catch { }
      // Functional bail: en egg mode esto corre cada frame; sin el `p ? false : p`
      // React re-renderiza por frame. Devolver el mismo valor cuando ya es false
      // hace que React haga bail (no re-render).
      try { setOrbActive((p) => (p ? false : p)) } catch { }
    }

    // Freeze the character while the voxel FX is active (until reconstruction).
    // Keeps the avatar still and prevents inputs/portal logic during the animation.
    if (eggFreezeActiveRef.current) {
      try {
        const p = playerRef.current.position
        p.copy(eggFreezePosRef.current)
        // Keep internal simulator coherent to avoid a jump when returning
        simPosRef.current.copy(p)
        simPrevPosRef.current.copy(p)
      } catch { }
      // Ensure the model stays hidden until the reveal starts (post-hold).
      if (eggHideForceRef.current || eggHideLockRef.current) {
        try { applyModelOpacity(0) } catch { }
      }
      return
    }

    // If disassembling, run only physics/assembly and freeze the rest of the loop.
    if (disassembleActiveRef.current) {
      const dis = disassembleRef.current
      dis.t += dtMoveRef.current || dt
      const pieces = dis.pieces || []
      const GRAV = -14.5
      const LIN_DAMP = 0.992
      const ANG_DAMP = 0.985
      const BOUNCE_Y = 0.42        // vertical restitution (0 = no bounce, 1 = perfect)
      const BOUNCE_STOP_V = 0.9    // below this |vy| at floor contact, stop bouncing
      const FLOOR_FRICTION = 0.82  // horizontal friction applied on bounce
      const ANG_BOUNCE = 0.78      // angular velocity retained on bounce
      const dbg = disassembleDebugRef.current
      const hold = !!(dbg.hold || dis.holdExternal)
      const FLOOR_EPS = 0.015

      if (dis.phase === 'fall') {
        const allowFloor = dis.t >= dis.floorDelayS
        for (let i = 0; i < pieces.length; i += 1) {
          const it = pieces[i]
          const delayS = (typeof it.delayS === 'number' && Number.isFinite(it.delayS)) ? it.delayS : 0
          // Staggered release: stays assembled until its turn arrives.
          if (!it.started) {
            if (dis.t < delayS) continue
            it.started = true
            try { it.mesh.visible = true } catch { }
            // Apply release position and initial impulse
            try {
              if (it.releasePos) it.mesh.position.copy(it.releasePos)
            } catch { }
            try {
              if (it.impulseV) it.v.copy(it.impulseV)
            } catch { }
            try {
              if (it.impulseW) it.w.copy(it.impulseW)
            } catch { }
          }
          it.v.y += GRAV * (dtMoveRef.current || dt)
          it.v.multiplyScalar(LIN_DAMP)
          it.w.multiplyScalar(ANG_DAMP)
          it.mesh.position.addScaledVector(it.v, (dtMoveRef.current || dt))
          // Simple angular integration - reuse quaternion/euler
          const dtMove = dtMoveRef.current || dt
          tmpRef.current.disEuler.set(it.w.x * dtMove, it.w.y * dtMove, it.w.z * dtMove)
          tmpRef.current.disQuat.setFromEuler(tmpRef.current.disEuler)
          it.mesh.quaternion.multiply(tmpRef.current.disQuat).normalize()

          if (allowFloor) {
            const floorY = (typeof dis.floorLocalY === 'number' ? dis.floorLocalY : 0)
            const yMin = floorY + (Number.isFinite(it.bottom) ? it.bottom : it.radius) + FLOOR_EPS
            if (it.mesh.position.y < yMin) {
              it.mesh.position.y = yMin
              if (it.v.y < -BOUNCE_STOP_V) {
                // Bounce with energy loss — realistic impact.
                it.v.y = -it.v.y * BOUNCE_Y
                it.v.x *= FLOOR_FRICTION
                it.v.z *= FLOOR_FRICTION
                // Slight angular perturbation from the impact, then damp rotation.
                it.w.multiplyScalar(ANG_BOUNCE)
                it.w.x += (Math.random() - 0.5) * Math.abs(it.v.y) * 0.6
                it.w.z += (Math.random() - 0.5) * Math.abs(it.v.y) * 0.6
              } else {
                // Too slow to bounce — settle on the floor.
                it.v.y = 0
                it.v.x *= 0.65
                it.v.z *= 0.65
                it.w.multiplyScalar(0.55)
              }
            }
          }
        }

        const maxDelay = (typeof dis.maxDelayS === 'number' && Number.isFinite(dis.maxDelayS)) ? dis.maxDelayS : 0
        if (!hold && dis.t >= (dis.fallS + maxDelay)) {
          dis.phase = 'assemble'
          dis.t = 0
          for (let i = 0; i < pieces.length; i += 1) {
            const it = pieces[i]
            try { it.mesh.visible = true } catch { }
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
          try { it.mesh.visible = true } catch { }
          it.mesh.position.lerpVectors(it.assembleStartPos, it.homePos, tEase)
          it.mesh.quaternion.slerpQuaternions(it.assembleStartQuat, it.homeQuat, tEase)
        }

        if (!hold && a >= 1) {
          try { console.log('[disassemble] REASSEMBLE complete — running full cleanup') } catch { }
          // End: clean up and re-show the animated model
          disassembleActiveRef.current = false
          dis.phase = 'idle'
          dis.t = 0
          // Restore detached meshes (if applicable) before cleanup.
          try {
            const root = piecesRootRef.current
            if (root) {
              // Only reparent those with restore info
              for (let i = root.children.length - 1; i >= 0; i -= 1) {
                const obj = root.children[i]
                const restore = obj?.userData?.__disassembleRestore
                if (!restore?.parent) continue
                try { root.remove(obj) } catch { }
                try { restore.parent.add(obj) } catch { }
                // Restore ORIGINAL local transform (relative to origParent), not
                // the last piecesRoot-space transform from the physics sim.
                try {
                  if (restore.localPos) obj.position.copy(restore.localPos)
                  if (restore.localQuat) obj.quaternion.copy(restore.localQuat)
                  if (restore.localScale) obj.scale.copy(restore.localScale)
                  obj.updateMatrix?.()
                } catch { }
                // Restore original materials (per mesh) if we cloned them for the disassembly
                try {
                  obj.traverse?.((n) => {
                    const m0 = n?.userData?.__disassembleRestoreMaterial
                    if (m0) {
                      try { n.material = m0 } catch { }
                      try { delete n.userData.__disassembleRestoreMaterial } catch { }
                    }
                  })
                } catch { }
                try { obj.visible = true } catch { }
                try { delete obj.userData.__disassembleRestore } catch { }
              }
            }
          } catch { }
          // Re-show skinned originals that were hidden for rigid-bake replacement.
          try {
            const hidden = dis.hiddenSkinned
            if (Array.isArray(hidden) && hidden.length) {
              for (let i = 0; i < hidden.length; i += 1) {
                const n = hidden[i]
                try { if (n) n.visible = true } catch { }
                try { if (n?.userData) delete n.userData.__disassembleRestoreVisibleOnly } catch { }
              }
              dis.hiddenSkinned = []
            }
          } catch { }
          dis.pieces = []
          clearDisassemblePieces()
          applyModelOpacity(1)
          // Full restoration after a reassemble so the character can move
          // and render correctly again.
          try {
            // Re-enable character shadow (disabled elsewhere during FX paths).
            setCharacterShadowEnabled(true)
          } catch { }
          try {
            // Force outlines visible: applyModelOpacity(1) should already do
            // this via the traverse, but an explicit pass guarantees it even
            // if the scene was mutated during the disassemble.
            scene?.traverse?.((obj) => {
              if (obj?.name && obj.name.endsWith?.('_outline')) {
                try { obj.visible = true } catch { }
              }
            })
          } catch { }
          // Re-sync the movement simulator so input resumes cleanly from the
          // character's current position (no jump from a stale cached pose).
          try {
            if (playerRef?.current) {
              simPosRef.current.copy(playerRef.current.position)
              simPrevPosRef.current.copy(playerRef.current.position)
              simYawRef.current = playerRef.current.rotation.y
              simPrevYawRef.current = playerRef.current.rotation.y
              simInitRef.current = true
              simAccRef.current = 0
            }
          } catch { }
        }
      }

      return
    }

    // Ensure the orb light only updates the shadow map when active
    try {
      if (orbLightRef.current && orbLightRef.current.shadow) {
        orbLightRef.current.shadow.autoUpdate = !!orbActiveRef.current
      }
    } catch { }

    // If orb is active, character must be fully hidden
    if (orbActiveRef.current) {
      applyModelOpacity(0)
    }
    // Crossfade in when finishing orb
    if (!orbActiveRef.current && showOrbRef.current) {
      // While the orb is visible, the human must stay hidden
      applyModelOpacity(0)
    } else if (!orbActiveRef.current && !showOrbRef.current && fadeInTRef.current < 1) {
      // Only begin the fade-in when the orb is no longer visible
      fadeInTRef.current = Math.min(1, fadeInTRef.current + dt / FADE_IN)
      applyModelOpacity(fadeInTRef.current)
      if (fadeInTRef.current >= 1) {
        if (typeof onOrbStateChange === 'function') onOrbStateChange(false)
        // Re-enable character shadow when returning to human form
        setCharacterShadowEnabled(true)
      }
    }

    // Move only while orb is active
    if (orbActiveRef.current) {
      // Mark that we came from orb mode to re-sync on exit
      simWasOrbRef.current = true
      const pos = playerRef.current.position
      const dir = tmpRef.current.orbDir.subVectors(orbTargetPosRef.current, pos)
      let dist = dir.length()
      let crossedIn = false
      if (fallFromAboveRef.current) {
        const fallSpeed = 16
        pos.y = pos.y - fallSpeed * (dtMoveRef.current || dt)
        // smooth XZ re-centering toward origin
        const k = 1 - Math.pow(0.001, (dtMoveRef.current || dt))
        pos.x = THREE.MathUtils.lerp(pos.x, 0, k)
        pos.z = THREE.MathUtils.lerp(pos.z, 0, k)
      } else {
        // Subtle wobble: adds lateral oscillation - reuse vectors
        const steerDir = tmpRef.current.orbSteerDir.copy(dir)
        if (dist > 1e-6) {
          const tNow = state.clock.getElapsedTime()
          const progress = THREE.MathUtils.clamp(1 - dist / Math.max(1e-3, orbStartDistRef.current), 0, 1)
          const farFactor = THREE.MathUtils.smoothstep(dist, 0, PORTAL_STOP_DIST * 2.5)
          const amplitude = WOBBLE_BASE * 0.6 * Math.pow(1 - progress, 1.2) * farFactor

          const up = tmpRef.current.orbUp.set(Math.abs(dir.y) > 0.9 ? 1 : 0, Math.abs(dir.y) > 0.9 ? 0 : 1, 0)
          const side1 = tmpRef.current.orbSide1.crossVectors(dir, up).normalize()
          const side2 = tmpRef.current.orbSide2.crossVectors(dir, side1).normalize()

          const wobbleX = side1.x * Math.sin(tNow * WOBBLE_FREQ1 + wobblePhaseRef.current) * amplitude + side2.x * Math.cos(tNow * WOBBLE_FREQ2 + wobblePhase2Ref.current) * amplitude * 0.85
          const wobbleY = side1.y * Math.sin(tNow * WOBBLE_FREQ1 + wobblePhaseRef.current) * amplitude + side2.y * Math.cos(tNow * WOBBLE_FREQ2 + wobblePhase2Ref.current) * amplitude * 0.85
          const wobbleZ = side1.z * Math.sin(tNow * WOBBLE_FREQ1 + wobblePhaseRef.current) * amplitude + side2.z * Math.cos(tNow * WOBBLE_FREQ2 + wobblePhase2Ref.current) * amplitude * 0.85
          steerDir.x += wobbleX
          steerDir.y += wobbleY
          steerDir.z += wobbleZ
          steerDir.normalize()
        } else {
          steerDir.set(0, 0, 0)
        }
        const step = Math.min(dist, ORB_SPEED * (dtMoveRef.current || dt))
        pos.addScaledVector(steerDir, step)
        // Recalculate distance after moving for robust arrival criteria
        const distAfter = orbTargetPosRef.current.distanceTo(pos)
        // Detect threshold crossing (from >stop to <=stop) so we do not rely only on time/position
        crossedIn = lastDistRef.current > PORTAL_STOP_DIST && distAfter <= PORTAL_STOP_DIST
        lastDistRef.current = distAfter
        // Soft hysteresis on the proximity timer to avoid losing the splash due to wobble
        if (distAfter < ARRIVAL_NEAR_DIST) nearTimerRef.current += (dtMoveRef.current || dt)
        else nearTimerRef.current = Math.max(0, nearTimerRef.current - (dtMoveRef.current || dt) * 0.5)
        // Update dir so the rotation faces the oscillating direction
        dir.copy(steerDir)
        // Soft snap if extremely close to avoid infinite loop
        if (distAfter <= 0.02) {
          pos.copy(orbTargetPosRef.current)
        }
        // Override dist for the arrival check
        // Note: the arrival condition uses 'dist' below, we update it here
        // (will not affect the fall branch)
        // eslint-disable-next-line no-param-reassign
        // @ts-ignore
        dist = distAfter
      }
      // Progressive tint of orb material based on approach
      if (orbMatRef.current) {
        const distNow = orbTargetPosRef.current.distanceTo(pos)
        const k = THREE.MathUtils.clamp(1 - distNow / orbStartDistRef.current, 0, 1)

        const col = tmpRef.current.orbTempColor.copy(orbBaseColorRef.current).lerp(orbTargetColorRef.current, k)
        orbMatRef.current.emissive.copy(col)
        tmpRef.current.orbTempColor2.copy(col).multiplyScalar(0.9)
        orbMatRef.current.color.copy(tmpRef.current.orbTempColor2)
        orbMatRef.current.emissiveIntensity = 5 + 2 * k
        orbMatRef.current.needsUpdate = true
        if (orbLightRef.current) {
          orbLightRef.current.color.copy(col)
          // Pre-mounted light: ramp intensity only when active
          orbLightRef.current.intensity = 6 + 6 * k
          // covers more ground
          orbLightRef.current.distance = 12
          orbLightRef.current.decay = 1.6
          // update shadow only while active to avoid extra passes
          if (orbLightRef.current.shadow) {
            orbLightRef.current.shadow.autoUpdate = true
          }
        }
      }
      // spawn sparks in a wide cone/disk behind the orb
      const worldPos = tmpRef.current.orbWorldPos
      playerRef.current.getWorldPosition(worldPos)
      worldPos.y += ORB_HEIGHT // avoid allocating a new Vector3
      // Skip trail spawn when falling from sky and still high above ground —
      // otherwise sparks spawn at sky height and look like "particles raining down".
      // Below ~6 units we resume trail so the landing impact still has flair.
      const suppressTrail = fallFromAboveRef.current && (pos.y - FALL_STOP_Y) > 6
      const moveVec = tmpRef.current.orbMoveVec.subVectors(worldPos, lastPosRef.current)
      const speed = moveVec.length() / Math.max((dtMoveRef.current || dt), 1e-4)

      const forward = tmpRef.current.orbForward
      if (moveVec.lengthSq() > 1e-8) {
        forward.copy(moveVec).normalize()
      } else {
        forward.copy(dir).normalize()
      }
      const backDir = tmpRef.current.orbBackDir.copy(forward).multiplyScalar(-1)
      // Build an orthonormal basis (backDir, t1, t2)
      const upSparks = tmpRef.current.orbUp.set(Math.abs(backDir.y) > 0.9 ? 1 : 0, Math.abs(backDir.y) > 0.9 ? 0 : 1, 0)
      const t1 = tmpRef.current.orbT1.crossVectors(backDir, upSparks).normalize()
      const t2 = tmpRef.current.orbT2.crossVectors(backDir, t1).normalize()
      const diskRadius = 0.5
      const backOffset = 0.28
      const count = suppressTrail ? 0 : 8
      const kOverride = THREE.MathUtils.clamp(1 - orbTargetPosRef.current.distanceTo(pos) / orbStartDistRef.current, 0, 1)
      for (let i = 0; i < count; i++) {
        const r = diskRadius * Math.sqrt(Math.random())
        const a = Math.random() * Math.PI * 2
        const cosA = Math.cos(a)
        const sinA = Math.sin(a)

        const offX = t1.x * r * cosA + t2.x * r * sinA
        const offY = t1.y * r * cosA + t2.y * r * sinA
        const offZ = t1.z * r * cosA + t2.z * r * sinA
        // basePos = worldPos + backDir*backOffset + offset
        const bpX = worldPos.x + backDir.x * backOffset + offX
        const bpY = worldPos.y + backDir.y * backOffset + offY
        const bpZ = worldPos.z + backDir.z * backOffset + offZ
        // velocity mainly backwards with wide cone spread
        const spread = 1.6
        const velMag = Math.min(5, 0.22 * speed) + Math.random() * 0.6
        const spreadX = (Math.random() - 0.5) * spread
        const spreadY = (Math.random() - 0.5) * spread
        const velX = backDir.x * velMag + t1.x * spreadX + t2.x * spreadY
        const velY = backDir.y * velMag + t1.y * spreadX + t2.y * spreadY + Math.random() * 0.6
        const velZ = backDir.z * velMag + t1.z * spreadX + t2.z * spreadY
        // Only create new objects for sparks that persist (necessary)
        sparksRef.current.push({
          pos: new THREE.Vector3(bpX, bpY, bpZ),
          vel: new THREE.Vector3(velX, velY, velZ),
          life: 0.4 + Math.random() * 0.6,
          kOverride,
          t: 'trail'
        })
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
        // Assign queues
        explosionQueueRef.current.sphere = 200
        explosionQueueRef.current.ring = 100
        explosionQueueRef.current.splash = 120
        // Partial immediate burst to ensure visibility even if the Canvas pauses soon
        try {
          const immediateSphere = 140
          const immediateRing = 70
          const immediateSplash = 90

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

          for (let i = 0; i < immediateRing; i++) {
            const a = Math.random() * Math.PI * 2
            const dirRing = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
            const velRing = dirRing.multiplyScalar(12 + Math.random() * 10).add(new THREE.Vector3(0, (Math.random() - 0.5) * 2, 0))
            if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explodePos.clone(), vel: velRing, life: 2.0 + Math.random() * 2.0, _life0: 2.0 })
          }
          explosionQueueRef.current.ring = Math.max(0, explosionQueueRef.current.ring - immediateRing)

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
        } catch { }
        // Boost spark size/opacity briefly (stronger, single assignment)
        explosionBoostRef.current = 1.6
        // SFX: arrival (portal or floor with splash)
        playSfx('sparkleBom', { volume: 1.0 })
        // Radial push to nearby orbs (HOME, landing splash)
        try {
          if (typeof onPulse === 'function') {
            // Moderate push similar to the base pulse
            onPulse(explodePos.clone(), 6, 4)
          }
        } catch { }
        // Clear trailing sparks to avoid pile-up on ground
        try {
          const arr = sparksRef.current
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i] && arr[i].t === 'trail') arr.splice(i, 1)
          }
        } catch { }
        // Transform back: snap to ground level
        playerRef.current.position.y = 0
        fallFromAboveRef.current = false
        // hide orb, then start fade‑in to human
        showOrbRef.current = false
        fadeInTRef.current = 0
        if (typeof onReachedPortal === 'function') onReachedPortal(navigateToPortalId)
        // Explicit callback for HOME splash
        if (arrivedFall && typeof onHomeSplash === 'function') {
          try { onHomeSplash() } catch { }
        }
        // stop orb movement but keep orb visible while fading in
        orbActiveRef.current = false
        setOrbActive(false)
      }
      return // skip normal movement
    }
    // If we just exited orb mode, the simulator must snap to the real position,
    // otherwise the fixed-step render overwrites and moves back to the previous point.
    if (simWasOrbRef.current) {
      simWasOrbRef.current = false
      try {
        simInitRef.current = true
        simAccRef.current = 0
        simPosRef.current.copy(playerRef.current.position)
        simPrevPosRef.current.copy(playerRef.current.position)
        simYawRef.current = playerRef.current.rotation.y
        simPrevYawRef.current = playerRef.current.rotation.y
      } catch { }
    }

    // (animation-based footstep detection is done after input calculation)

    // Build input vector (camera-relative).
    // Mobile: ARCADE-style joystick (near-instant direction change).
    const joy = (typeof window !== 'undefined' && window.__joystick) ? window.__joystick : null
    const isCoarse = (() => {
      try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches } catch { return false }
    })()
    const joyMag = joy && joy.active ? Math.max(0, Math.min(1, joy.mag || Math.hypot(joy.x || 0, joy.y || 0))) : 0
    // Small deadzone for responsiveness
    const JOY_DEAD = 0.05
    // Sensitivity curve ( >1 = more gradual; <1 = more sensitive at the start )
    const JOY_SPEED_CURVE = 1.2
    // Only use joystick on touch/coarse-pointer devices (mobile/tablet)
    const hasJoy = isCoarse && joy && joy.active && (joyMag > JOY_DEAD)
    // Axes: joystick x right+, y down+ -> zInput uses -y (screen-up = forward)
    const joyX = hasJoy ? (joy.x || 0) : 0
    const joyZ = hasJoy ? (-(joy.y || 0)) : 0

    const xKey = (keyboard.left ? -1 : 0) + (keyboard.right ? 1 : 0)
    const zKey = (keyboard.forward ? 1 : 0) + (keyboard.backward ? -1 : 0)

    // Joystick: direct analog input for maximum responsiveness
    let xInputRaw = xKey
    let zInputRaw = zKey
    let inputMag = Math.min(1, Math.abs(xKey) + Math.abs(zKey))
    if (hasJoy) {
      const rawMag = Math.min(1, Math.hypot(joyX, joyZ))
      const dz = JOY_DEAD
      const norm = rawMag > dz ? ((rawMag - dz) / (1 - dz)) : 0
      if (norm > 0) {
        // Direct analog input - no smoothing for instant response
        // Use raw values directly (already normalized by joystick)
        xInputRaw = joyX
        zInputRaw = joyZ
        // Analog speed based on distance from center
        inputMag = Math.max(0, Math.min(1, Math.pow(norm, JOY_SPEED_CURVE)))
      } else {
        xInputRaw = 0
        zInputRaw = 0
        inputMag = 0
      }
    }

    // Camera basis (no smoothing) to avoid extra latency
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

    // Customizer abierto: congela la locomoción (sin early-return → idle y el
    // simulador siguen vivos; solo se anula el input para que no camine).
    if (customizeActiveRef.current) { xInputRaw = 0; zInputRaw = 0; inputMag = 0 }

    // Desired move direction relative to direct camera
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
    // clear memory to avoid interfering with previous behaviors
    try {

      // @ts-ignore
      if (!playerRef.current._lastDir) playerRef.current._lastDir = new THREE.Vector3()
      // @ts-ignore
      playerRef.current._lastDir.copy(desiredDir)
    } catch { }

    const hasInput = moveMag > 0.02
    // Notify movement state change
    if (hadInputPrevRef.current !== hasInput) {
      hadInputPrevRef.current = hasInput
      try { if (typeof onMoveStateChange === 'function') onMoveStateChange(hasInput) } catch { }
    }
    // =========================
    // Deterministic movement + animation (fixed timestep + interpolation)
    // =========================
    try {
      if (!simInitRef.current) {
        simInitRef.current = true
        simPosRef.current.copy(playerRef.current.position)
        simPrevPosRef.current.copy(playerRef.current.position)
        simYawRef.current = playerRef.current.rotation.y
        simPrevYawRef.current = playerRef.current.rotation.y
      }
    } catch { }

    // Frozen inputs for this frame (applied to all substeps)
    const speedMultiplier = keyboard.shift ? 1.5 : 1.0
    // Apply adaptive multiplier when FPS is low
    // (calculated at the end of the previous frame based on average steps)
    const effectiveSpeed = SPEED * speedMultiplier * adaptiveSpeedMultRef.current
    // Analog joystick: speed proportional to magnitude
    const effectiveMoveSpeed = effectiveSpeed * Math.max(0, Math.min(1, moveMag))
    // TimeScale with limited range so the animation does not look unnatural
    // With SPEED = BASE_SPEED, this value will be ~1.0 under normal conditions
    const baseWalkScale = THREE.MathUtils.clamp((Math.max(1e-4, effectiveMoveSpeed) / BASE_SPEED) * WALK_TIMESCALE_MULT, WALK_SCALE_MIN, WALK_SCALE_MAX)
    const targetAngle = hasInput && direction.lengthSq() > 1e-8 ? Math.atan2(direction.x, direction.z) : simYawRef.current

    // Simulation accumulator (classic fixed timestep)
    // - Keeps movement/animation stable at 60Hz
    // - Allows moderate catch-up when render runs at 45-55fps
    // - Avoids giant catch-up after extreme hitches (GC/tab out)
    const MAX_ACCUM = 12 * FIXED_DT // ~200ms max accumulation (was 6)
    const dtForAcc = Math.min(dtRaw, MAX_ACCUM)
    simAccRef.current = Math.min(simAccRef.current + dtForAcc, MAX_ACCUM)

    const idleAction = actions && idleName ? actions[idleName] : null
    const walkAction = actions && walkName ? actions[walkName] : null

    let steps = 0
    let animAccum = 0 // accumulate time to update mixer once per frame
    const MAX_STEPS = 12 // was 6, allows recovering up to 200ms of lag on slow GPUs
    while (simAccRef.current >= FIXED_DT && steps < MAX_STEPS) {
      const stepDt = FIXED_DT

      // Save prev EXACTLY before the step (key for smooth interpolation)
      simPrevPosRef.current.copy(simPosRef.current)
      simPrevYawRef.current = simYawRef.current

      if (hasInput) {
        // Rotation with damp() frame-rate independent
        // Lambda ~20 = smooth turn, ~30 = more immediate, ~50+ = very snappy
        const ROT_LAMBDA = 50.0
        simYawRef.current = dampAngleWrapped(simYawRef.current, targetAngle, ROT_LAMBDA, stepDt)
        // Desktop-style movement: no analog acceleration
        simPosRef.current.addScaledVector(direction, effectiveMoveSpeed * stepDt)
      }

      // Blend animation with substeps (stable) using damp() frame-rate independent
      if (idleAction && walkAction) {
        // Guard: ensure infinite loop
        if (idleAction.loop !== THREE.LoopRepeat) idleAction.setLoop(THREE.LoopRepeat, Infinity)
        if (walkAction.loop !== THREE.LoopRepeat) walkAction.setLoop(THREE.LoopRepeat, Infinity)
        idleAction.clampWhenFinished = false
        walkAction.clampWhenFinished = false
        idleAction.enabled = true
        walkAction.enabled = true

        // Target weight: 1 when there is input, 0 when idle
        const targetWeight = hasInput ? Math.max(0, Math.min(1, moveMag)) : 0
        // damp() is frame-rate independent by design
        // BLEND_LAMBDA ~10 = smooth transition (~0.3s), ~15 = faster (~0.2s)
        walkWeightRef.current = THREE.MathUtils.damp(
          walkWeightRef.current,
          targetWeight,
          BLEND_LAMBDA,
          stepDt,
        )
        // Clamp to prevent out-of-range values from numerical errors
        walkWeightRef.current = THREE.MathUtils.clamp(walkWeightRef.current, 0, 1)

        const walkW = walkWeightRef.current
        const idleW = 1 - walkW
        walkAction.setEffectiveWeight(walkW)
        idleAction.setEffectiveWeight(idleW)

        // Walk timeScale proportional to weight for smooth transition
        const animScale = THREE.MathUtils.lerp(1, baseWalkScale, walkW)
        walkAction.setEffectiveTimeScale(animScale)
        idleAction.setEffectiveTimeScale(IDLE_TIMESCALE)

        // Accumulate animation time instead of updating per substep
        animAccum += stepDt
      }

      simAccRef.current -= stepDt
      steps += 1
    }

    // Update mixer once per frame (not per substep)
    // This significantly reduces CPU cost when there are many substeps
    if (animAccum > 0 && mixer) {
      try {
        mixer.timeScale = 1
        mixer.update(animAccum)
        mixer.timeScale = 0
      } catch { }
    }

    // Calculate adaptive speed multiplier for the NEXT frame
    // If we consistently use many steps, it means FPS is low
    // and we compensate by increasing base speed so the character does not feel slow
    avgStepsRef.current = avgStepsRef.current * 0.92 + steps * 0.08 // EMA suavizado
    if (avgStepsRef.current > 4) {
      // Medium-low FPS (~45 or less), compensate with extra speed (up to 1.6x)
      const boost = Math.min(1.6, 1 + (avgStepsRef.current - 4) * 0.1)
      adaptiveSpeedMultRef.current = THREE.MathUtils.lerp(adaptiveSpeedMultRef.current, boost, 0.25)
    } else {
      // High FPS, return VERY gradually to normal speed (avoids sudden drops)
      adaptiveSpeedMultRef.current = THREE.MathUtils.lerp(adaptiveSpeedMultRef.current, 1.0, 0.04)
    }

    // Debug dev-only: expose metrics in overlay (GpuStats)
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

          avgSteps: avgStepsRef.current,
          adaptiveSpeedMult: adaptiveSpeedMultRef.current,
        }
      }
    } catch { }

    // Render: canonical interpolation (as in games)
    // alpha = how far we have advanced from the last step toward the next one.
    const alpha = THREE.MathUtils.clamp(simAccRef.current / FIXED_DT, 0, 1)
    tmp.renderPos.lerpVectors(simPrevPosRef.current, simPosRef.current, alpha)
    playerRef.current.position.copy(tmp.renderPos)
    playerRef.current.rotation.y = lerpAngleWrapped(simPrevYawRef.current, simYawRef.current, alpha)

    // Post-sim adjustments (seam + footsteps) with final frame state
    if (idleAction && walkAction) {
      try {
        const d = Math.max(1e-3, walkDurationRef.current)
        const t = walkAction.time % d
        const eps = 1e-3
        if (t < eps) walkAction.time = eps
        else if (d - t < eps) walkAction.time = d - eps
      } catch { }

      // Footstep detection: only when there is input and walk weight is high
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
      } catch { }
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
      // "enter" is no longer triggered automatically; we only mark inside for CTA and exit control
      if (!wasInside && isInside) {
        const blocked = cooldownRef.current.portalId === portal.id && nowS < cooldownRef.current.untilS
        if (!blocked) {
          insideMapRef.current[portal.id] = true
          // We do not invoke onPortalEnter here; the CTA button does
        }
      }
      // Near proximity for progressive color change of portal/particles
      const nearFactor = smoothstep(NEAR_OUTER, NEAR_INNER, distance)
      perPortal[portal.id] = THREE.MathUtils.clamp(nearFactor, 0, 1)
    })
    // (optional) persist distance if used in other UX; not required for movement
    if (onProximityChange && isFinite(minDistance)) {
      const factor = THREE.MathUtils.clamp(1 - minDistance / PROXIMITY_RADIUS, 0, 1)
      onProximityChange(factor)
    }
    if (onPortalsProximityChange) {
      onPortalsProximityChange(perPortal)
    }
    // Power charge: hold space to raise charge (0..1); release to fire
    try {
      const nearK = smoothstep(NEAR_OUTER, NEAR_INNER, minDistance) // 0 = far, 1 = very close
      const rate = (0.65 + 1.8 * nearK) // base + boost by proximity
      if (pressed) {
        chargeRef.current = Math.min(1, chargeRef.current + (dtMoveRef.current || dt) * rate)
      } else if (actionPrevRef.current && chargeRef.current > 0.02) {
        // Fire on release
        const power = chargeRef.current
        triggerManualExplosion(power)
        chargeRef.current = 0
      }
      // Real-time channel (non-React): for fluid UI on mobile without App re-render
      try { window.__powerFillLive = THREE.MathUtils.clamp(chargeRef.current, 0, 1) } catch { }
      if (typeof onActionCooldown === 'function') {
        // Reuse channel for UI: send (1 - charge) so the fill shows charge
        // IMPORTANT: throttle to avoid App re-rendering 60 times/sec (sluggish on mobile).
        const v = 1 - THREE.MathUtils.clamp(chargeRef.current, 0, 1)
        const now = state.clock.getElapsedTime()
        const lastV = lastChargeUiRef.current
        const lastT = lastChargeUiTsRef.current
        const minHz = 30 // 30Hz is enough for fluid feel
        const minDt = 1 / minHz
        const minStep = 0.015 // minimum change threshold
        if (lastV < 0 || Math.abs(v - lastV) >= minStep || (now - lastT) >= minDt) {
          lastChargeUiRef.current = v
          lastChargeUiTsRef.current = now
          onActionCooldown(v)
        }
      }
    } catch { }
    // Update edge detector for next frame
    actionPrevRef.current = pressed
    // Emit nearest portal to show CTA
    if (onNearPortalChange) {
      const showId = nearestDist < threshold ? nearestId : null
      onNearPortalChange(showId, nearestDist)
    }
  })

  // Trail as a luminous tube following the path (continuous trail)
  // Sparks trail (small residual sparks fading quickly)
  const TrailSparks = () => {
    const geoRef = useRef()
    // Reduced particle capacity for performance
    const CAP = 1500
    const positionsRef = useRef(new Float32Array(CAP * 3))
    const uniformsRef = useRef({
      uBaseColor: { value: orbBaseColorRef.current.clone() },
      uTargetColor: { value: orbTargetColorRef.current.clone() },
      uMix: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uSize: { value: 0.28 },
      uOpacity: { value: 0.2 },
    })
    // Reuse temporary objects to avoid GC
    const sparkTmpRef = useRef({
      sceneCol: new THREE.Color(),
      baseCol: new THREE.Color(),
      dirExp: new THREE.Vector3(),
      dirRing: new THREE.Vector3(),
      dirXZ: new THREE.Vector3(),
      velUp: new THREE.Vector3(),
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
      // Spawn queued explosion particles BEFORE the empty-array check,
      // otherwise queued particles would never be emitted when the array
      // starts empty (e.g. right after a departure splash wipe).
      const BATCH = 30
      if (explosionQueueRef.current.sphere > 0) {
        const n = Math.min(BATCH, explosionQueueRef.current.sphere)
        for (let i = 0; i < n; i++) {
          const u = Math.random() * 2 - 1
          const phi = Math.random() * Math.PI * 2
          const sqrt1u2 = Math.sqrt(1 - u * u)
          // Create objects only when needed for the array
          const speedExp = 8 + Math.random() * 14
          const vel = new THREE.Vector3(sqrt1u2 * Math.cos(phi) * speedExp, u * speedExp, sqrt1u2 * Math.sin(phi) * speedExp)
          if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explosionQueueRef.current.pos.clone(), vel, life: 2.2 + Math.random() * 2.4, _life0: 2.2 })
        }
        explosionQueueRef.current.sphere -= n
      }
      if (explosionQueueRef.current.ring > 0) {
        const n = Math.min(BATCH, explosionQueueRef.current.ring)
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2
          const speedRing = 12 + Math.random() * 10
          const vel = new THREE.Vector3(Math.cos(a) * speedRing, (Math.random() - 0.5) * 2, Math.sin(a) * speedRing)
          if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explosionQueueRef.current.pos.clone(), vel, life: 2.0 + Math.random() * 2.0, _life0: 2.0 })
        }
        explosionQueueRef.current.ring -= n
      }
      if (explosionQueueRef.current.splash > 0) {
        const n = Math.min(BATCH, explosionQueueRef.current.splash)
        const GROUND_Y = 0.0
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2
          const r = Math.random() * 0.25
          const speedXZ = 8 + Math.random() * 10
          const vel = new THREE.Vector3(Math.cos(a) * speedXZ + (Math.random() - 0.5) * 2, 0, Math.sin(a) * speedXZ + (Math.random() - 0.5) * 2)
          const pos = new THREE.Vector3(explosionQueueRef.current.pos.x + Math.cos(a) * r, GROUND_Y + 0.06, explosionQueueRef.current.pos.z + Math.sin(a) * r)
          if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos, vel, life: 2.2 + Math.random() * 2.8, _life0: 2.2, _grounded: true, _groundT: 0 })
        }
        explosionQueueRef.current.splash -= n
      }
      // Now check if there are any sparks to process (after queue processing)
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
      // Reuse temporary objects
      const tmp = sparkTmpRef.current
      const pos = playerRef.current?.position
      if (!pos) return
      const distNow = orbTargetPosRef.current.distanceTo(pos)
      const kDist = THREE.MathUtils.clamp(1 - distNow / Math.max(1e-3, orbStartDistRef.current), 0, 1)
      tmp.sceneCol.set(sceneColor || '#ffffff')
      tmp.baseCol.copy(orbBaseColorRef.current).lerp(tmp.sceneCol, 0.3)
      uniformsRef.current.uBaseColor.value.copy(tmp.baseCol)
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
      // Explosion boost makes sparks clearly visible; base is subtle trail glow
      uniformsRef.current.uOpacity.value = 0.2 + 0.35 * boost
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

  // Outline material (inverted hull) - optimized for performance
  // Expansion happens AFTER skinning in model-space so bone transforms don't
  // distort the thickness.  objectNormal is the skinned normal (from
  // skinnormal_vertex) and transformed is the skinned position (from
  // skinning_vertex) — both in the same coordinate space.
  const outlineMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      // depthWrite:false es intencional — el modelo tiene múltiples skinned
      // meshes (body exterior + esqueleto interno) y cada uno recibe outline;
      // si el outline escribiera depth, los outlines internos (costillas,
      // articulaciones) atraviesan el body exterior porque su material usa
      // transparencia (halftone/dots) y no bloquea. Tradeoff conocido: objetos
      // detrás del halo amarillo pueden traspasarlo; resolverlo requiere un
      // stencil pass o identificar cuál es el mesh outermost.
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.outlineThickness = { value: 0.012 }
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        uniform float outlineThickness;`
      )
      // Inject expansion AFTER skinning_vertex (which skins `transformed`)
      // but BEFORE project_vertex (which computes gl_Position).
      // At this point objectNormal is the bone-transformed normal and
      // transformed is the bone-transformed position — same space.
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `transformed += normalize(objectNormal) * outlineThickness;
        #include <project_vertex>`
      )
    }
    return mat
  }, [])

  // Color del stroke según la skin: void usa BLANCO (la superficie es casi
  // negra), el resto negro. Escucha el evento de skinShaders y actualiza el
  // material singleton del outline (.color es uniform → no recompila).
  useEffect(() => {
    const apply = (rgb) => { try { outlineMaterial.color.setRGB(rgb[0], rgb[1], rgb[2]) } catch { } }
    apply(skinLineColor)
    const onColor = (e) => apply(e?.detail?.color || skinLineColor)
    window.addEventListener(SKIN_LINE_COLOR_EVENT, onColor)
    return () => window.removeEventListener(SKIN_LINE_COLOR_EVENT, onColor)
  }, [outlineMaterial])

  // ── Precalentado de los shaders del DESARME (anti-congelón del rayo) ──
  //
  // Medido: primer disparo del rayo = 1670ms de peor bloqueo y ~3.6s de hilo
  // principal trabado en total. Segundo disparo = CERO long tasks. O sea que
  // todo el costo es de PRIMERA VEZ: compilación de programas GPU, no el
  // baking de geometría por CPU (ese se repetiría cada vez).
  //
  // Los dos programas que faltan por compilar cuando cae el rayo:
  //   1. El material de pieza rígida — `createRigidMaterial` fuerza
  //      `customProgramCacheKey = 'rigid_piece'`, un programa propio.
  //   2. La variante NO-SKINNED del outline. El outline del personaje solo
  //      existe como SkinnedMesh; las piezas del desarme son `THREE.Mesh`
  //      planos, y three llavea los programas por defines (USE_SKINNING) →
  //      es otro programa distinto.
  //
  // Se calientan renderizando dos meshes desechables microscópicos por unos
  // frames. Va DESPUÉS de entrar (no en el prewarm): ahí el Environment ya
  // existe y los materiales tienen su set de defines definitivo — compilar
  // antes produce la variante equivocada, y de hecho rompía el outline.
  const warmedRef = useRef(false)
  useEffect(() => {
    if (prewarm || warmedRef.current) return
    if (!scene || !outlineMaterial || typeof createRigidMaterial !== 'function') return
    warmedRef.current = true

    let probes = []
    let raf = 0
    // Damos aire tras el ENTER para no competir con la entrada del personaje.
    const start = window.setTimeout(() => {
      try {
        // Material fuente = el primer skinned mesh real del personaje.
        let srcMat = null
        let srcGeo = null
        scene.traverse((o) => {
          if (srcMat || !o.isSkinnedMesh || !o.material) return
          srcMat = Array.isArray(o.material) ? o.material[0] : o.material
          srcGeo = o.geometry
        })
        if (!srcMat || !srcGeo) return

        const rigidMat = createRigidMaterial(srcMat)
        const mk = (mat) => {
          const m = new THREE.Mesh(srcGeo, Array.isArray(mat) ? mat[0] : mat)
          // frustumCulled=false para que three NO lo descarte: si no se
          // rasteriza, no compila. Escala microscópica → invisible en la
          // práctica (sub-pixel) durante los pocos frames que vive.
          m.frustumCulled = false
          m.scale.setScalar(1e-4)
          m.position.set(0, -9999, 0)
          m.renderOrder = -1
          return m
        }
        probes = [mk(rigidMat), mk(outlineMaterial)]
        probes.forEach((m) => scene.add(m))

        // Tres frames: montar → rasterizar → compilar. Luego se van.
        let n = 0
        const tick = () => {
          if (++n < 3) { raf = requestAnimationFrame(tick); return }
          probes.forEach((m) => { try { scene.remove(m) } catch { } })
          try { rigidMat.dispose?.() } catch { }
          probes = []
        }
        raf = requestAnimationFrame(tick)
      } catch { }
    }, 2500)

    return () => {
      window.clearTimeout(start)
      if (raf) cancelAnimationFrame(raf)
      probes.forEach((m) => { try { scene.remove(m) } catch { } })
    }
  }, [prewarm, scene, outlineMaterial, createRigidMaterial])

  // Black inverted-hull outline for the transformation orb (convex sphere, so
  // the hull works cleanly all around). Matched to the character thickness.
  const orbOutlineMat = useMemo(() => makeHullOutline({ color: 0x000000, thickness: 0.03 }), [])
  useEffect(() => () => { try { orbOutlineMat.dispose() } catch { } }, [orbOutlineMat])

  // Outline: add outline meshes directly as siblings of the originals
  // This avoids any manual sync - they inherit transformations automatically
  const outlineAddedRef = useRef(false)
  const outlineMeshesRef = useRef([])
  useEffect(() => {
    if (!outlineEnabled || !scene || outlineAddedRef.current) return
    outlineAddedRef.current = true

    try {

      const skinnedMeshes = []
      scene.traverse((obj) => {
        if (obj.isSkinnedMesh && obj.geometry && obj.skeleton) {
          skinnedMeshes.push(obj)
        }
      })

      skinnedMeshes.forEach((original) => {
        // Create outline mesh that SHARES geometry and skeleton
        const outlineMesh = new THREE.SkinnedMesh(original.geometry, outlineMaterial)
        outlineMesh.name = `${original.name}_outline`
        outlineMesh.skeleton = original.skeleton
        outlineMesh.bindMatrix.copy(original.bindMatrix)
        outlineMesh.bindMatrixInverse.copy(original.bindMatrixInverse)

        outlineMesh.frustumCulled = false
        outlineMesh.castShadow = false
        outlineMesh.receiveShadow = false
        outlineMesh.renderOrder = -1

        // Add as sibling of the original (inherits transformations automatically)
        if (original.parent) {
          original.parent.add(outlineMesh)
          outlineMeshesRef.current.push(outlineMesh)
        }
      })
    } catch (e) {
      console.error('[Outline] Error:', e)
    }

    // CLEANUP: Remove outline meshes when scene changes or on unmount.
    // Do NOT dispose the shared outlineMaterial here — it's a useMemo singleton
    // that gets reused when the scene swaps (gold skin toggle). Disposing it would
    // make the re-created outlines invisible.
    return () => {
      try {
        const meshes = outlineMeshesRef.current
        meshes.forEach((m) => {
          if (m && m.parent) {
            m.parent.remove(m)
          }
          // Note: We don't dispose geometry (shared with original) or material
          // (shared outlineMaterial reused across scene swaps)
        })
        outlineMeshesRef.current = []
        outlineAddedRef.current = false
      } catch { }
    }
  }, [outlineEnabled, scene, outlineMaterial])

  // Hide/show outlines based on orb mode (no traverse, just iterate array)
  useEffect(() => {
    const meshes = outlineMeshesRef.current
    if (!meshes.length) return
    const shouldShow = !orbActive
    meshes.forEach((m) => { m.visible = shouldShow })
  }, [orbActive])

  // ═══════════════════════════════════════════════════════════════════
  // CLEANUP: Dispose all cloned materials, geometries, and GPU resources
  // on unmount.  The SkeletonUtils.clone() creates deep copies of the
  // scene and materials (line 102), and the outline/voxel effects create
  // additional GPU-side objects.  Without this, every section transition
  // that re-mounts Player leaks VRAM.
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    return () => {
      // 1. Dispose all cloned materials and geometries from the scene clone
      try {
        if (scene) {
          scene.traverse((child) => {
            // Dispose geometries (cloned by SkeletonUtils.clone)
            if (child.geometry) {
              child.geometry.dispose()
            }
            // Dispose materials (cloned per-instance in lines 140-154)
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material]
              mats.forEach((m) => {
                if (!m || !m.isMaterial) return
                // Dispose any associated textures
                try {
                  if (m.map) m.map.dispose()
                  if (m.normalMap) m.normalMap.dispose()
                  if (m.roughnessMap) m.roughnessMap.dispose()
                  if (m.metalnessMap) m.metalnessMap.dispose()
                  if (m.emissiveMap) m.emissiveMap.dispose()
                  if (m.aoMap) m.aoMap.dispose()
                } catch { }
                try { m.dispose() } catch { }
              })
            }
          })
        }
      } catch { }

      // 2. Dispose egg voxel instanced mesh resources
      try { eggVoxelGeo.dispose() } catch { }
      try { eggVoxelMat.dispose() } catch { }

      // 3. Dispose outline material
      try { outlineMaterial.dispose() } catch { }

      // 4. Clean up bubble fallback object
      try {
        const fb = bubbleFallbackObjRef.current
        if (fb && fb.parent) fb.parent.remove(fb)
      } catch { }

      // 4b. Clean up charge bar anchor object
      try {
        const cb = chargeBarAnchorObjRef.current
        if (cb && cb.parent) cb.parent.remove(cb)
      } catch { }

      // 5. Clear refs to help GC
      sparksRef.current = []
      eggVoxelPiecesRef.current = []
    }
  }, [scene, eggVoxelGeo, eggVoxelMat, outlineMaterial])

  return (
    <>
      <group ref={playerRef} position={[0, 0, 0]} visible={Boolean(visible && !prewarm)}>
        {/* Character model is always mounted; opacity is controlled via applyModelOpacity */}
        <group ref={modelRootRef} scale={1.5}>
          <primitive object={scene} />
          {/* Geometric outline is now part of the scene (siblings of the original meshes) */}
          {/* Rigid pieces for the easter egg (dynamically mounted) */}
          <group ref={piecesRootRef} />
        </group>
        {/* Workaround: voxel shatter + rebuild (simulates disassembly) */}
        <instancedMesh
          ref={eggVoxelRef}
          args={[eggVoxelGeo, eggVoxelMat, EGG_VOXEL_MAX]}
          frustumCulled={false}
          renderOrder={50}
          position={[0, 0, 0]}
        />
        {/* Easter egg: lightning bolt that disassembles the character.
            Mounted as a child of playerRef so it follows world position.
            SIEMPRE montado (sin `key`) para que materiales + luz se compilen
            una vez al load y no provoquen recompilación de escena en el strike.
            `seed` re-rolea la geometría; `playing` dispara la animación. */}
        <LightningBolt
          top={LIGHTNING_TOP}
          bottom={LIGHTNING_BOTTOM}
          seed={boltSeed}
          playing={boltVisible}
          onDone={() => setBoltVisible(false)}
        />
        {/* Orb sphere + inner sparkles to convey "ser de luz" */}
        <group position={[0, ORB_HEIGHT, 0]}>
          {/* Point light: always mounted to warm up the pipeline; intensity 0 when inactive */}
          {/* NOTE: this light is glow/accent; if it casts shadows, it produces a duplicate shadow */}
          <pointLight ref={orbLightRef} intensity={showOrbRef.current ? 6 : 0} distance={12} decay={1.6} />
          {showOrbRef.current && (
            <>
              <mesh>
                <sphereGeometry args={[0.6, 24, 24]} />
                <meshStandardMaterial ref={orbMatRef} emissive={new THREE.Color('#aee2ff')} emissiveIntensity={6.5} color={new THREE.Color('#f5fbff')} transparent opacity={0.9} />
                <mesh material={orbOutlineMat} raycast={() => null} renderOrder={-1}>
                  <sphereGeometry args={[0.6, 24, 24]} />
                </mesh>
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
        // Camera-relative offset: x=right, y=up, z=toward camera
        // Pushed further right and higher so it does not overlap the character
        offset={[1.95, 1.20, 0]}
      />
      {/* Barra de carga 3D sobre la cabeza: visibilidad la controla su propio
          useFrame vía chargeRef (0 = oculta), no montar en prewarm. */}
      {!prewarm && (
        <ChargeBar3D anchorRef={chargeBarAnchorObjRef} chargeRef={chargeRef} />
      )}
      {/* World-space sparks trail (not parented to player) */}
      {/* Mount spark shader always (drawRange 0 when idle) to avoid first-use jank */}
      <TrailSparks />
    </>
  )
}

// Preload the model for faster subsequent loading (with KTX2 support)
useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`, true, true, extendGLTFLoaderKTX2)