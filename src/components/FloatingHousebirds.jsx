import React, { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { extendGLTFLoaderKTX2 } from '../lib/ktx2Setup'
import makeHullOutline from '../lib/makeHullOutline'

// Gradient map (rampa de N escalones) para MeshToonMaterial. Banda la
// ILUMINACIÓN (N·L), no el albedo → toon parejo en negro/blanco/rosa.
function makeToonGradient(steps = 4) {
  const data = new Uint8Array(steps)
  for (let i = 0; i < steps; i += 1) data[i] = Math.round(((i + 1) / steps) * 255)
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}
// 2 escalones = solo iluminado + una banda de sombra (corte toon simple).
const TOON_GRADIENT = makeToonGradient(2)

// ─── Smooth physics constants ────────────────────────────────────────
const BIRD_RADIUS = 8.0        // Collision radius per bird (models are scale 11-14)
const MAX_VEL = 0.045          // Max translational speed (un poco más para resolver overlaps)
const DAMPING = 0.994          // Ultra-floaty deceleration
const DRIFT_STRENGTH = 0.001   // Barely-there wandering force
const WALL_STIFFNESS = 0.006   // Very soft spring from viewport edges
const BIRD_STIFFNESS = 0.008   // Push between overlapping birds (más firme → no se atraviesan)
const SCROLL_STRENGTH = 0.004  // Subtle scroll nudge

// Clamp helper
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

// ─── Single floating bird ────────────────────────────────────────────
// Approximate visual radius of a bird model (tuned to avoid any part going offscreen)
const MODEL_VISUAL_RADIUS = 3.5

function FloatingBird({ url, scale, scaleMul = 1, tint = null, index, birdsRef, scrollVelRef }) {
  const groupRef = useRef()
  const { scene } = useGLTF(url, true, true, extendGLTFLoaderKTX2)
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    // Cel-shading toon (mismo banding que el personaje). Materiales clonados
    // para no afectar otras instancias; envMap bajo para que el corte se note.
    try {
      c.traverse((o) => {
        if (!o || !o.isMesh || !o.material) return
        const list = Array.isArray(o.material) ? o.material : [o.material]
        const cloned = list.map((m) => {
          if (!m || !m.isMaterial) return m
          // MeshToonMaterial: banda la iluminación vía gradientMap (parejo en
          // cualquier albedo) y es mate (sin reflejos). Copiamos color/map/emissive.
          try {
            // Si el pool define `tint`, ignoramos color/map del GLB y forzamos
            // ese color plano (ej. pig blanco → el banding toon hace toda la
            // forma sin textura).
            let baseColor
            let useMap = m.map || null
            if (tint != null) {
              baseColor = new THREE.Color(tint)
              useMap = null
            } else {
              baseColor = m.color ? m.color.clone() : new THREE.Color(0xffffff)
              // El bird negro casi no se ve: si el albedo es muy oscuro, lo
              // levantamos un pelín hacia gris.
              const lum = 0.299 * baseColor.r + 0.587 * baseColor.g + 0.114 * baseColor.b
              if (lum < 0.12) baseColor.lerp(new THREE.Color(0x5a5a5a), 0.4)
            }
            const toon = new THREE.MeshToonMaterial({
              color: baseColor,
              map: useMap,
              gradientMap: TOON_GRADIENT,
              emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
              emissiveMap: tint != null ? null : (m.emissiveMap || null),
              transparent: false,
              side: m.side,
            })
            return toon
          } catch { return m }
        })
        o.material = Array.isArray(o.material) ? cloned : cloned[0]
      })
      // Outline = casco invertido por mesh, modo OBJECT-space (igual que el
      // personaje principal en Player.jsx:5289). El object-space evita el
      // poke-through interior en mallas cóncavas — la inflación sigue la
      // normal local y respeta los pliegues.
      //
      // Grosor: fracción del bounding sphere LOCAL de cada mesh. Esto es
      // self-contained — no depende de matrices ni de la escala mundial. Si
      // un mesh tiene verts en [0, 100000] (caso skullkid con node-scale
      // 0.0000059), su radio local es enorme y la fracción 0.5% da un offset
      // proporcional → outline visible en pantalla. Para meshes pequeños la
      // fracción da offset chico. Resultado: el rim en pantalla es siempre
      // ~0.5% del tamaño del mesh en pantalla — consistente y a prueba de
      // explosiones.
      const toAdd = []
      c.traverse((o) => {
        if (o && o.isMesh && o.geometry) toAdd.push(o)
      })
      toAdd.forEach((o) => {
        if (!o.geometry.boundingSphere) {
          try { o.geometry.computeBoundingSphere() } catch { }
        }
        const r = o.geometry.boundingSphere?.radius || 1
        const localThickness = r * 0.005
        const outlineMat = makeHullOutline({ color: 0x000000, thickness: localThickness, objectSpace: true })
        const hull = new THREE.Mesh(o.geometry, outlineMat)
        hull.name = `${o.name || 'bird'}_outline` // excluido del normal-pass del ink
        hull.renderOrder = -1
        hull.raycast = () => null
        o.add(hull)
      })
    } catch { }
    return c
  }, [scene, tint])

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
    const vizR = MODEL_VISUAL_RADIUS * (effScale / 10) // scale-adjusted visual radius
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

  const effScale = scale * scaleMul
  return (
    <group ref={registerRef}>
      <primitive object={cloned} scale={[effScale, effScale, effScale]} />
    </group>
  )
}

// ─── 3 floating slots; cada uno pickea al azar entre housebirdWhite y
//     skullkid en cada carga de página. ──────────────────────────────
const BASE = import.meta.env.BASE_URL || '/'
// scaleMul: factor sobre el scale del slot (para normalizar modelos de tamaños
// raros). tint: si está, sobreescribe color y QUITA texturas → look blanco
// plano (toon banding lo va a sombrear).
const OFFWHITE = 0xf2efe6
// 4 entradas para 4 slots → 2 housebirds + 2 skullkids por carga, distribuidos
// aleatoriamente entre los slots vía shuffle.
const HOUSEBIRD = { url: `${BASE}3dmodels/housebirdWhite.glb`, scaleMul: 1.0, tint: OFFWHITE }
const SKULLKID = { url: `${BASE}3dmodels/skullkid.glb`, scaleMul: 1.0, tint: OFFWHITE }
const MODEL_POOL = [HOUSEBIRD, SKULLKID, HOUSEBIRD, SKULLKID]
// Preload de los tres → switch instantáneo y sin pop-in en el render inicial.
MODEL_POOL.forEach((m) => { try { useGLTF.preload(m.url) } catch { } })

const BIRDS = [
  { scale: 14, startPos: [-6.0, 5.0, -3] },
  { scale: 12, startPos: [6.0, -4.0, -3] },
  { scale: 11, startPos: [-4.0, -3.5, -3] },
  { scale: 13, startPos: [4.5, 3.5, -3] },
]

// ─── Scene ───────────────────────────────────────────────────────────
function Scene({ scrollVelocityRef }) {
  const birdsRef = useRef([null, null, null, null])
  const birdsGroupRef = useRef()
  const initialized = useRef(false)

  // Shuffle de los 4 modelos a los 4 slots → cada modelo aparece EXACTAMENTE
  // una vez por carga. Combinaciones: 24 (4!).
  const birdPicks = useMemo(() => {
    const pool = MODEL_POOL.slice()
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp
    }
    return pool
  }, [])

  useFrame(() => {
    if (initialized.current) return
    const all = birdsRef.current
    if (!all || all.some((n) => !n)) return
    BIRDS.forEach((b, i) => all[i].position.set(...b.startPos))
    initialized.current = true
  })

  return (
    <>
      {/* Ambient bajo + key fuerte → el banding toon muestra el corte. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, 4]} intensity={1.5} />
      <directionalLight position={[-4, 3, -2]} intensity={0.3} />
      <Environment preset="city" background={false} />

      <group ref={birdsGroupRef}>
        {BIRDS.map((b, i) => (
          <FloatingBird
            key={`${i}-${birdPicks[i].url}`}
            url={birdPicks[i].url}
            scale={b.scale}
            scaleMul={birdPicks[i].scaleMul}
            tint={birdPicks[i].tint}
            index={i}
            birdsRef={birdsRef}
            scrollVelRef={scrollVelocityRef}
          />
        ))}
      </group>

      {/* Solo hull outline + toon banding. El EdgeInk (Laplaciano o gradiente)
          pelea con este mesh smooth de una sola pieza — ver respuesta sobre por
          qué el mesh es la causa. */}
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
