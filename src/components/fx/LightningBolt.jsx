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
//   3. La geometría NO se reconstruye en el frame del strike: al montar se
//      pre-generan GEOM_POOL_SIZE sets en espacio LOCAL y el `seed` solo SELECCIONA
//      uno (la x/z de impacto se aplica como offset del grupo, no horneada). El
//      pool depende del SPAN local (constante 22→0), no de la posición → estable.
//   4. La luz de impacto es OPCIONAL (`withImpactLight`). Para pools de varios
//      bolts (antimatter/thunder), el caller usa una sola luz compartida y pasa
//      `withImpactLight={false}` → el conteo de luces de la escena no cambia por
//      bolt y nunca recompila mid-game.
//
// API:
//   - `seed`: incrementar para elegir otro patrón del pool y reproducir de nuevo.
//   - `playing`: true mientras el rayo debe animarse; en false todo va a opacity 0.
//   - `onDone`: callback una vez cuando la animación termina (por seed).
//   - `withImpactLight`: false para delegar el flash a una luz compartida externa.
//
// Lifecycle (ms): 0–25 raise, 25–140 hold-flicker, 140–260 fade-out.
export const BOLT_TOTAL_S = 0.26
const BOLT_RISE_S = 0.025
const BOLT_HOLD_S = 0.115
// remainder → fade

// Cuántas geometrías pre-generadas por instancia (P1). El strike elige una por
// `seed % POOL_SIZE` en vez de reconstruir 4 TubeGeometry en el frame caliente.
// 5 patrones distintos = suficiente variedad para que no se note repetición en
// un flash de 260ms.
const GEOM_POOL_SIZE = 5

// Envolvente de alpha del CORE compartida con el driver de la luz de impacto
// (HomeScene). Mantener en sync con la animación inline del useFrame de abajo.
export function boltCoreAlpha(t) {
  if (t < 0) return 0
  if (t < BOLT_RISE_S) return t / BOLT_RISE_S
  if (t < BOLT_RISE_S + BOLT_HOLD_S) return 0.75 + 0.25 * Math.sin(t * 140)
  if (t < BOLT_TOTAL_S) {
    return Math.max(0, 1 - (t - BOLT_RISE_S - BOLT_HOLD_S) / (BOLT_TOTAL_S - BOLT_RISE_S - BOLT_HOLD_S))
  }
  return 0
}

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

// Construye un set completo de geometría (core + halo principal + core + halo de
// la rama) en ESPACIO LOCAL (la x/z de impacto se aplica como offset del grupo,
// no horneada en los vértices) → el set es reutilizable en cualquier posición de
// strike. Segmentos reducidos vs la versión original (P1): 16 tubular / 4-5
// radial en el principal, 10 / 4 en la rama. ~45% menos vértices y evals de
// curva, sin pérdida visible para un tubo delgado.
function makeGeometrySet(topV, botV, coreRadius, haloRadius) {
  const pathPts = makeJaggedPath(topV, botV, 14, 0.45)
  const curve = new THREE.CatmullRomCurve3(pathPts)
  const mainCore = new THREE.TubeGeometry(curve, 16, coreRadius, 4, false)
  const mainHalo = new THREE.TubeGeometry(curve, 16, haloRadius, 5, false)
  const branchIdx = 5 + Math.floor(Math.random() * 4)
  const branchStart = pathPts[branchIdx].clone()
  const branchEnd = branchStart.clone()
  branchEnd.x += (Math.random() - 0.5) * 3.2
  branchEnd.z += (Math.random() - 0.5) * 3.2
  branchEnd.y -= 2.2 + Math.random() * 1.8
  const branchPts = makeJaggedPath(branchStart, branchEnd, 7, 0.35)
  const branchCurve = new THREE.CatmullRomCurve3(branchPts)
  const branchCore = new THREE.TubeGeometry(branchCurve, 10, coreRadius * 0.75, 4, false)
  const branchHalo = new THREE.TubeGeometry(branchCurve, 10, haloRadius * 0.7, 4, false)
  return { mainCore, mainHalo, branchCore, branchHalo }
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
  // Si false, NO renderiza su propio <pointLight> (el conteo de luces lo
  // gobierna un light compartido en el caller → sin recompilación de escena).
  // El easter egg lo deja en true (su luz ya es persistente desde el load).
  withImpactLight = true,
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

  // Origen de impacto (x/z) aplicado como offset del GRUPO — la geometría se
  // construye en espacio local con ese origen en 0,0 → el pool es independiente
  // de la posición del strike y no se reconstruye cuando cambia x/z.
  const originX = top[0]
  const originZ = top[2]
  // Posición local del impacto (relativa al origen del grupo) — para la luz.
  const impactLocal = useMemo(
    () => [bottom[0] - top[0], bottom[1], bottom[2] - top[2]],
    [top[0], top[1], top[2], bottom[0], bottom[1], bottom[2]],
  )
  // Clave del SPAN local (alto + offset relativo + radios). Estable entre
  // strikes (siempre 22→0) → el pool se construye UNA vez al montar, no por
  // strike ni por re-render del parent.
  const spanKey = `${top[1]},${bottom[0] - top[0]},${bottom[1]},${bottom[2] - top[2]},${coreRadius},${haloRadius}`

  // Pool de geometría: GEOM_POOL_SIZE sets pre-generados al montar. El strike
  // selecciona uno por `seed` — sin reconstrucción en el frame caliente (P1).
  const pool = useMemo(() => {
    const topL = new THREE.Vector3(0, top[1], 0)
    const botL = new THREE.Vector3(bottom[0] - top[0], bottom[1], bottom[2] - top[2])
    const sets = []
    for (let i = 0; i < GEOM_POOL_SIZE; i += 1) {
      sets.push(makeGeometrySet(topL, botL, coreRadius, haloRadius))
    }
    return sets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spanKey])

  const set = pool[((seed % GEOM_POOL_SIZE) + GEOM_POOL_SIZE) % GEOM_POOL_SIZE]
  const { mainCore: mainGeomCore, mainHalo: mainGeomHalo, branchCore: branchGeomCore, branchHalo: branchGeomHalo } = set

  // Dispose del pool entero al reemplazarlo (cambio de span/radios) o al
  // desmontar. Materiales/luz persisten (intencional); la geometría sí se libera.
  useEffect(() => {
    return () => {
      for (const s of pool) {
        try { s.mainCore.dispose() } catch { }
        try { s.mainHalo.dispose() } catch { }
        try { s.branchCore.dispose() } catch { }
        try { s.branchHalo.dispose() } catch { }
      }
    }
  }, [pool])

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
    <group position={[originX, 0, originZ]}>
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
          full-scene material recompile that mounting a light triggers. Solo si
          `withImpactLight`: los bolts pooled lo delegan a una luz compartida del
          caller para mantener estable el conteo de luces de la escena. */}
      {withImpactLight && (
        <pointLight
          ref={impactLightRef}
          position={impactLocal}
          color={'#cfeaff'}
          intensity={0}
          distance={18}
          decay={1.6}
        />
      )}
    </group>
  )
}
