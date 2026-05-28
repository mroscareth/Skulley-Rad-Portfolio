import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Procedural lightning bolt: jagged tube from sky to target, with outer halo
// and one side branch.
//
// PERF / WOW-FACTOR: este componente está pensado para vivir SIEMPRE montado
// (el caller NO debe usar `key` para remontarlo). Razones:
//   1. Montar/desmontar un <pointLight> cambia el conteo de luces de la escena
//      → Three.js recompila TODOS los materiales en el siguiente frame. Si eso
//      pasa en el frame del flash, el rayo se traba. Con la luz persistente
//      (intensity 0 en reposo) la recompilación ocurre una sola vez al load.
//   2. Montar/desmontar los meshes additive recompila sus shaders en el primer
//      strike. Persistentes = se compilan una vez al cargar (pre-warm gratis).
//   3. La geometría se regenera SOLO cuando cambia `seed` (primitivo), no en
//      cada re-render del parent (antes dependía de los arrays-literal
//      top/bottom y se reconstruían las 4 TubeGeometry sin querer).
//
// API:
//   - `seed`: incrementar para re-rolear la geometría y reproducir de nuevo.
//   - `playing`: true mientras el rayo debe animarse; en false todo va a opacity 0.
//   - `onDone`: callback una vez cuando la animación termina (por seed).
//
// Lifecycle (ms): 0–25 raise, 25–140 hold-flicker, 140–260 fade-out.
const BOLT_TOTAL_S = 0.26
const BOLT_RISE_S = 0.025
const BOLT_HOLD_S = 0.115
// remainder → fade

function makeJaggedPath(top, bottom, segments = 14, jitter = 0.35) {
  // Build a list of 3D points from `top` to `bottom` with lateral jitter.
  const pts = []
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const p = new THREE.Vector3().lerpVectors(top, bottom, t)
    if (i !== 0 && i !== segments) {
      // Lateral offset grows slightly toward the middle of the bolt
      const env = Math.sin(t * Math.PI)
      p.x += (Math.random() - 0.5) * jitter * env * 2.0
      p.z += (Math.random() - 0.5) * jitter * env * 2.0
      // Small Y jitter so segments are uneven
      p.y += (Math.random() - 0.5) * 0.2
    }
    pts.push(p)
  }
  return pts
}

export default function LightningBolt({
  // Top of the bolt in local space (relative to parent group).
  top = [0, 20, 0],
  // Bottom of the bolt (impact point — usually the character's head).
  bottom = [0, 2.2, 0],
  // Visual radius of the inner "core".
  coreRadius = 0.06,
  // Halo radius (wider, softer).
  haloRadius = 0.22,
  // Increment to re-roll the jagged pattern and replay.
  seed = 0,
  // Animate while true; opacity 0 when false.
  playing = false,
  // Fired once when the bolt finishes its animation (per seed).
  onDone,
}) {
  const startRef = useRef(performance.now())
  const coreMatRef = useRef(null)
  const haloMatRef = useRef(null)
  const branchCoreMatRef = useRef(null)
  const branchHaloMatRef = useRef(null)
  const impactLightRef = useRef(null)
  const doneRef = useRef(false)
  const idleRef = useRef(true)
  // Whether we've already started the animation for the current strike. Starts
  // false (even across remounts), so the bolt fires as soon as it sees
  // playing=true — independent of seed comparison or mount lifecycle.
  const activeRef = useRef(false)
  const lastSeedRef = useRef(seed)

  // Serialize array props so identity changes from the parent don't re-trigger
  // the geometry rebuild; only the actual values (and `seed`) matter.
  const topKey = top.join(',')
  const botKey = bottom.join(',')

  // Rebuild geometry ONLY when seed (or the actual top/bottom/radii) changes.
  const { mainGeomCore, mainGeomHalo, branchGeomCore, branchGeomHalo, impact } = useMemo(() => {
    const topV = new THREE.Vector3().fromArray(top)
    const botV = new THREE.Vector3().fromArray(bottom)
    const pathPts = makeJaggedPath(topV, botV, 14, 0.45)
    const curve = new THREE.CatmullRomCurve3(pathPts)
    const mainCore = new THREE.TubeGeometry(curve, 28, coreRadius, 6, false)
    const mainHalo = new THREE.TubeGeometry(curve, 28, haloRadius, 8, false)
    // Side branch: from a random mid-point down-outward.
    const branchIdx = 5 + Math.floor(Math.random() * 4)
    const branchStart = pathPts[branchIdx].clone()
    const branchEnd = branchStart.clone()
    branchEnd.x += (Math.random() - 0.5) * 3.2
    branchEnd.z += (Math.random() - 0.5) * 3.2
    branchEnd.y -= 2.2 + Math.random() * 1.8
    const branchPts = makeJaggedPath(branchStart, branchEnd, 7, 0.35)
    const branchCurve = new THREE.CatmullRomCurve3(branchPts)
    const branchCore = new THREE.TubeGeometry(branchCurve, 14, coreRadius * 0.75, 5, false)
    const branchHalo = new THREE.TubeGeometry(branchCurve, 14, haloRadius * 0.7, 6, false)
    return {
      mainGeomCore: mainCore,
      mainGeomHalo: mainHalo,
      branchGeomCore: branchCore,
      branchGeomHalo: branchHalo,
      impact: botV,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, topKey, botKey, coreRadius, haloRadius])

  // Dispose the previous geometry set when it gets replaced (seed change) or on
  // unmount. Persisting materials/light is intentional; geometry is not pooled.
  useEffect(() => {
    return () => {
      try { mainGeomCore.dispose() } catch { }
      try { mainGeomHalo.dispose() } catch { }
      try { branchGeomCore.dispose() } catch { }
      try { branchGeomHalo.dispose() } catch { }
    }
  }, [mainGeomCore, mainGeomHalo, branchGeomCore, branchGeomHalo])

  useFrame(() => {
    // Start (or restart) a strike when playing turns on or the seed changes.
    // activeRef starts false even across remounts, so this can't be missed.
    if (playing && (!activeRef.current || lastSeedRef.current !== seed)) {
      activeRef.current = true
      lastSeedRef.current = seed
      startRef.current = performance.now()
      doneRef.current = false
      idleRef.current = false
    }
    if (!playing) {
      // Zero everything once, then skip work while idle.
      activeRef.current = false
      lastSeedRef.current = seed
      if (idleRef.current) return
      idleRef.current = true
      if (coreMatRef.current) coreMatRef.current.opacity = 0
      if (haloMatRef.current) haloMatRef.current.opacity = 0
      if (branchCoreMatRef.current) branchCoreMatRef.current.opacity = 0
      if (branchHaloMatRef.current) branchHaloMatRef.current.opacity = 0
      if (impactLightRef.current) impactLightRef.current.intensity = 0
      return
    }
    const t = (performance.now() - startRef.current) / 1000
    let coreA = 0
    let haloA = 0
    if (t < BOLT_RISE_S) {
      const k = t / BOLT_RISE_S
      coreA = k
      haloA = k * 0.9
    } else if (t < BOLT_RISE_S + BOLT_HOLD_S) {
      // Flicker during hold
      const flick = 0.75 + 0.25 * Math.sin(t * 140)
      coreA = flick
      haloA = 0.7 * flick
    } else if (t < BOLT_TOTAL_S) {
      const k = 1 - (t - BOLT_RISE_S - BOLT_HOLD_S) / (BOLT_TOTAL_S - BOLT_RISE_S - BOLT_HOLD_S)
      coreA = Math.max(0, k)
      haloA = Math.max(0, k * 0.65)
    } else {
      coreA = 0
      haloA = 0
      if (!doneRef.current) {
        doneRef.current = true
        try { onDone?.() } catch { }
      }
    }
    if (coreMatRef.current) coreMatRef.current.opacity = coreA
    if (haloMatRef.current) haloMatRef.current.opacity = haloA
    if (branchCoreMatRef.current) branchCoreMatRef.current.opacity = coreA * 0.85
    if (branchHaloMatRef.current) branchHaloMatRef.current.opacity = haloA * 0.7
    if (impactLightRef.current) impactLightRef.current.intensity = coreA * 14
  })

  return (
    <group>
      {/* Outer halo — softer blue-white, additive */}
      <mesh geometry={mainGeomHalo} renderOrder={49} frustumCulled={false}>
        <meshBasicMaterial
          ref={haloMatRef}
          color={'#9fdcff'}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Inner core — bright white */}
      <mesh geometry={mainGeomCore} renderOrder={50} frustumCulled={false}>
        <meshBasicMaterial
          ref={coreMatRef}
          color={'#ffffff'}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Side branch halo + core */}
      <mesh geometry={branchGeomHalo} renderOrder={49} frustumCulled={false}>
        <meshBasicMaterial
          ref={branchHaloMatRef}
          color={'#9fdcff'}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={branchGeomCore} renderOrder={50} frustumCulled={false}>
        <meshBasicMaterial
          ref={branchCoreMatRef}
          color={'#ffffff'}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Point-light impact flash — persistent (intensity 0 idle) to avoid the
          full-scene material recompile that mounting a light triggers. */}
      <pointLight
        ref={impactLightRef}
        position={impact.toArray()}
        color={'#cfeaff'}
        intensity={0}
        distance={18}
        decay={1.6}
      />
    </group>
  )
}
