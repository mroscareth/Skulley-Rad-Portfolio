import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Procedural lightning bolt: jagged tube from sky to target, with outer halo
// and one side branch. Generated on mount — caller remounts to re-roll pattern.
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
  // Optional: callback fired once when the bolt finishes its animation.
  onDone,
}) {
  const startRef = useRef(performance.now())
  const coreMatRef = useRef(null)
  const haloMatRef = useRef(null)
  const branchCoreMatRef = useRef(null)
  const branchHaloMatRef = useRef(null)
  const impactLightRef = useRef(null)
  const doneRef = useRef(false)

  // Build geometry once — regenerated per mount (caller remounts to re-roll).
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
  }, [top, bottom, coreRadius, haloRadius])

  useEffect(() => {
    startRef.current = performance.now()
    doneRef.current = false
    return () => {
      try { mainGeomCore.dispose() } catch { }
      try { mainGeomHalo.dispose() } catch { }
      try { branchGeomCore.dispose() } catch { }
      try { branchGeomHalo.dispose() } catch { }
    }
  }, [mainGeomCore, mainGeomHalo, branchGeomCore, branchGeomHalo])

  useFrame(() => {
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
      {/* Point-light impact flash */}
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
