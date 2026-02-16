import React, { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import { extendGLTFLoaderKTX2 } from '../lib/ktx2Setup'

// ─── Smooth physics constants ────────────────────────────────────────
const BIRD_RADIUS = 6.0        // Collision radius per bird (models are scale 11-14)
const MAX_VEL = 0.03           // Slow max translational speed
const DAMPING = 0.994          // Ultra-floaty deceleration
const DRIFT_STRENGTH = 0.001   // Barely-there wandering force
const WALL_STIFFNESS = 0.006   // Very soft spring from viewport edges
const BIRD_STIFFNESS = 0.002   // Very soft push between overlapping birds
const SCROLL_STRENGTH = 0.004  // Subtle scroll nudge

// Clamp helper
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

// ─── Single floating bird ────────────────────────────────────────────
// Approximate visual radius of a bird model (tuned to avoid any part going offscreen)
const MODEL_VISUAL_RADIUS = 3.5

function FloatingBird({ url, scale, index, birdsRef, scrollVelRef }) {
  const groupRef = useRef()
  const { scene } = useGLTF(url, true, true, extendGLTFLoaderKTX2)
  const cloned = useMemo(() => scene.clone(true), [scene])

  const state = useRef({
    vx: 0, vy: 0, vz: 0,
    // Unique phase offsets for organic drift
    px: Math.random() * 100,
    py: Math.random() * 100,
    pz: Math.random() * 100,
    // Continuous base rotation speeds (different per bird, per axis) — zero-gravity tumble
    baseRotX: (0.15 + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1),
    baseRotY: (0.2 + Math.random() * 0.25) * (Math.random() > 0.5 ? 1 : -1),
    baseRotZ: (0.1 + Math.random() * 0.15) * (Math.random() > 0.5 ? 1 : -1),
    // Bob phase offset so they don't all sync
    bobPhase: Math.random() * Math.PI * 2,
  })

  const registerRef = useCallback((node) => {
    groupRef.current = node
    if (birdsRef.current) birdsRef.current[index] = node
  }, [birdsRef, index])

  useFrame(({ clock, viewport }) => {
    const g = groupRef.current
    if (!g) return
    const s = state.current
    const t = clock.getElapsedTime()

    // Viewport bounds accounting for the visual size of the model
    const vizR = MODEL_VISUAL_RADIUS * (scale / 10) // scale-adjusted visual radius
    const limitW = viewport.width / 2 - vizR
    const limitH = viewport.height / 2 - vizR

    // ── 1. Accumulate forces ─────────────────────────────────────────

    // Organic sinusoidal drift (very slow)
    s.vx += Math.sin(t * 0.07 + s.px) * DRIFT_STRENGTH
    s.vy += Math.sin(t * 0.05 + s.py) * DRIFT_STRENGTH
    s.vz += Math.cos(t * 0.04 + s.pz) * DRIFT_STRENGTH * 0.15

    // Slow vertical bobbing (zero-gravity sway)
    const bobTarget = Math.sin(t * 0.12 + s.bobPhase) * 1.2
    s.vy += (bobTarget - g.position.y) * 0.0004

    // Scroll nudge (gentle, clamped)
    if (scrollVelRef && scrollVelRef.current) {
      const sv = clamp(scrollVelRef.current, -600, 600)
      s.vy -= sv * SCROLL_STRENGTH * 0.001
      s.vx += sv * SCROLL_STRENGTH * 0.0002 * Math.sin(t * 0.5 + s.px)
      s.baseRotX += sv * 0.000003
      s.baseRotZ -= sv * 0.000002
    }

    // Soft wall spring (pushes gently before reaching the hard limit)
    const softZone = 1.0 // start pushing 1 unit before the hard limit
    const softLimitW = limitW - softZone
    const softLimitH = limitH - softZone
    if (g.position.x > softLimitW) s.vx -= (g.position.x - softLimitW) * WALL_STIFFNESS
    if (g.position.x < -softLimitW) s.vx -= (g.position.x + softLimitW) * WALL_STIFFNESS
    if (g.position.y > softLimitH) s.vy -= (g.position.y - softLimitH) * WALL_STIFFNESS
    if (g.position.y < -softLimitH) s.vy -= (g.position.y + softLimitH) * WALL_STIFFNESS
    if (g.position.z > 1.0) s.vz -= (g.position.z - 1.0) * WALL_STIFFNESS
    if (g.position.z < -1.0) s.vz -= (g.position.z + 1.0) * WALL_STIFFNESS

    // Bird-to-bird soft spring
    const others = birdsRef.current
    if (others) {
      for (let i = 0; i < others.length; i++) {
        if (i === index || !others[i]) continue
        const dx = others[i].position.x - g.position.x
        const dy = others[i].position.y - g.position.y
        const dz = others[i].position.z - g.position.z
        const distSq = dx * dx + dy * dy + dz * dz
        const minDist = BIRD_RADIUS * 2
        if (distSq < minDist * minDist && distSq > 0.001) {
          const dist = Math.sqrt(distSq)
          const nx = dx / dist, ny = dy / dist, nz = dz / dist
          const ratio = 1 - dist / minDist
          const force = BIRD_STIFFNESS * ratio
          s.vx -= nx * force
          s.vy -= ny * force
          s.vz -= nz * force
          s.baseRotX += (Math.random() - 0.5) * force * 0.3
          s.baseRotY += (Math.random() - 0.5) * force * 0.3
        }
      }
    }

    // ── 2. Damping + velocity clamp ──────────────────────────────────
    s.vx *= DAMPING
    s.vy *= DAMPING
    s.vz *= DAMPING
    s.vx = clamp(s.vx, -MAX_VEL, MAX_VEL)
    s.vy = clamp(s.vy, -MAX_VEL, MAX_VEL)
    s.vz = clamp(s.vz, -MAX_VEL * 0.3, MAX_VEL * 0.3)

    // ── 3. Integrate position ────────────────────────────────────────
    g.position.x += s.vx
    g.position.y += s.vy
    g.position.z += s.vz

    // ── 4. Hard wall bounce (AFTER integration — nothing escapes) ────
    // If past the limit, clamp position and reverse velocity (soft bounce)
    if (g.position.x > limitW) { g.position.x = limitW; s.vx = -Math.abs(s.vx) * 0.5 }
    if (g.position.x < -limitW) { g.position.x = -limitW; s.vx = Math.abs(s.vx) * 0.5 }
    if (g.position.y > limitH) { g.position.y = limitH; s.vy = -Math.abs(s.vy) * 0.5 }
    if (g.position.y < -limitH) { g.position.y = -limitH; s.vy = Math.abs(s.vy) * 0.5 }
    if (g.position.z > 2.0) { g.position.z = 2.0; s.vz = -Math.abs(s.vz) * 0.5 }
    if (g.position.z < -2.0) { g.position.z = -2.0; s.vz = Math.abs(s.vz) * 0.5 }

    // ── 5. Hard bird-to-bird separation (AFTER integration) ──────────
    if (others) {
      for (let i = 0; i < others.length; i++) {
        if (i === index || !others[i]) continue
        const dx = others[i].position.x - g.position.x
        const dy = others[i].position.y - g.position.y
        const dz = others[i].position.z - g.position.z
        const distSq = dx * dx + dy * dy + dz * dz
        const minDist = BIRD_RADIUS * 2
        if (distSq < minDist * minDist && distSq > 0.001) {
          const dist = Math.sqrt(distSq)
          const overlap = minDist - dist
          const nx = dx / dist, ny = dy / dist, nz = dz / dist
          // Push this bird away by half the overlap
          g.position.x -= nx * overlap * 0.5
          g.position.y -= ny * overlap * 0.5
          g.position.z -= nz * overlap * 0.5
        }
      }
    }

    // ── 6. Continuous zero-gravity tumble ─────────────────────────────
    g.rotation.x += s.baseRotX * 0.008
    g.rotation.y += s.baseRotY * 0.008
    g.rotation.z += s.baseRotZ * 0.008
  })

  return (
    <group ref={registerRef}>
      <primitive object={cloned} scale={[scale, scale, scale]} />
    </group>
  )
}

// ─── 3 birds, one per color, MASSIVE ─────────────────────────────────
const BASE = import.meta.env.BASE_URL || '/'
const BIRDS = [
  { url: `${BASE}3dmodels/housebird.glb`, scale: 14, startPos: [-6.0, 5.0, -3] },
  { url: `${BASE}3dmodels/housebirdPink.glb`, scale: 12, startPos: [6.0, -4.0, -3] },
  { url: `${BASE}3dmodels/housebirdWhite.glb`, scale: 11, startPos: [1.5, 0.5, -3] },
]

// ─── Scene ───────────────────────────────────────────────────────────
function Scene({ scrollVelocityRef }) {
  const birdsRef = useRef([null, null, null])
  const initialized = useRef(false)

  useFrame(() => {
    if (initialized.current) return
    const all = birdsRef.current
    if (!all || !all[0] || !all[1] || !all[2]) return
    BIRDS.forEach((b, i) => all[i].position.set(...b.startPos))
    initialized.current = true
  })

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1.0} />
      <directionalLight position={[-4, 3, -2]} intensity={0.3} />
      <Environment preset="city" background={false} />

      {BIRDS.map((b, i) => (
        <FloatingBird
          key={i}
          url={b.url}
          scale={b.scale}
          index={i}
          birdsRef={birdsRef}
          scrollVelRef={scrollVelocityRef}
        />
      ))}
    </>
  )
}

// ─── Fullscreen overlay ──────────────────────────────────────────────
export default function FloatingHousebirds({ scrollVelocityRef }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{ width: '100vw', height: '100vh' }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 26], fov: 50 }}
        style={{ background: 'transparent' }}
        raycaster={{ enabled: false }}
        frameloop="always"
      >
        <Scene scrollVelocityRef={scrollVelocityRef} />
      </Canvas>
    </div>
  )
}
