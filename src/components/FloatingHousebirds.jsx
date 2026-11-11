import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { extendGLTFLoaderKTX2 } from '../lib/ktx2Setup'
import makeHullOutline from '../lib/makeHullOutline'
import { compileAsyncSafe } from '../lib/compileAsyncSafe.js'
import SlimeSlug3D from './SlimeSlug3D.jsx'
import { isPhoneExperience } from '../lib/mobileExperience.js'

// En la versión de teléfono los pájaros van a la mitad (pedido de Oscar). La
// cámara tiene fov vertical, así que en una pantalla parada cada uno ocupaba
// casi todo el ancho y tapaba el texto. Escala también su radio de choque,
// para que quepan juntos sin empujarse fuera de cuadro.
const PHONE_SCALE = 0.5
// Más chicos en general para que tengan aire para flotar sin estarse empujando
// todo el tiempo (pedido de Oscar, con los choques de globo).
const BIRD_SIZE = 0.75

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

// ─── Física de globos ────────────────────────────────────────────────
// Flotan como globos: nunca se meten uno en otro y al chocar se empujan (pedido
// de Oscar). Cada uno lleva su forma en un puñado de esferas que cubren toda su
// malla (`measureShape`), así que se tocan casi en su orilla real y no en una
// burbuja invisible. Los GLB traen el origen en los pies: giran sobre el centro
// de la malla, porque girando sobre los pies el cuerpo barría el doble.
// Toda la física corre en un solo useFrame (Scene) para que cada cuadro termine
// sin nadie encimado, pase lo que pase con las paredes.
// Los valores están en "por cuadro a 60 Hz" y cada cuadro se escala con su
// tiempo real (`k` en Scene): antes avanzaban por cuadro, y en la pantalla de
// 240 Hz de Oscar flotaban y giraban cuatro veces más rápido (2026-11-11,
// pedido de Oscar: "necesito que floten suave").
const MAX_VEL = 0.035          // Max translational speed
const DAMPING = 0.994          // Ultra-floaty deceleration
const DRIFT_STRENGTH = 0.001   // Barely-there wandering force
const WALL_STIFFNESS = 0.006   // Very soft spring from viewport edges
const SCROLL_STRENGTH = 0.004  // Subtle scroll nudge
const WALL_IN = 0.6            // parte del radio que se queda dentro de la pantalla
const BOUNCE = 0.6             // rebote de un choque: globo, no pelota
// Espacio personal: el vaivén los jala a todos hacia la línea del centro y sin esto
// pasaban pegados. Empieza donde se tocan sus radios completos, así que de lejos no
// hace nada y todavía chocan de verdad.
const CUSHION = 1.0
const CUSHION_STIFFNESS = 0.008
const HIT_SPIN = 5             // cuánto gira un choque que no le pega al centro
const MAX_SPIN = 0.5           // tope del giro en cada eje
// Lo que gira un choque se va apagando hasta el vaivén propio de cada uno (por
// segundo): antes se quedaba, y tras unos choques todos giraban al tope.
const SPIN_SETTLE = 0.25
const PASSES = 4               // vueltas de choques y paredes por cuadro
const SEPARATE_PASSES = 8      // y al final solo choques: estas mandan sobre las paredes
const SHAPE_SPHERES = 12
const SHAPE_MARGIN = 1.03      // el contorno de tinta y un pelo de aire
const CAM_Z = 26               // distancia de la cámara: los choques se miden en pantalla

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

// Forma de choque de un modelo, en sus unidades: el centro de su caja (el pivote
// nuevo), el radio que lo envuelve todo (paredes y descarte rápido) y esferas
// sacadas por k-means que entre todas cubren cada vértice.
const shapeCache = new WeakMap()
function measureShape(root) {
  if (shapeCache.has(root)) return shapeCache.get(root)
  root.updateMatrixWorld(true)
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const m = new THREE.Matrix4()
  const v = new THREE.Vector3()
  const pts = []
  root.traverse((o) => {
    const pos = o.isMesh && o.geometry?.attributes?.position
    if (!pos) return
    m.multiplyMatrices(toRoot, o.matrixWorld)
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m)
      pts.push(v.x, v.y, v.z)
    }
  })
  const n = pts.length / 3
  const box = new THREE.Box3()
  for (let i = 0; i < n; i += 1) box.expandByPoint(v.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]))
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3())
  for (let i = 0; i < n; i += 1) {
    pts[i * 3] -= center.x
    pts[i * 3 + 1] -= center.y
    pts[i * 3 + 2] -= center.z
  }
  const d2 = (i, c) => {
    const dx = pts[i * 3] - c[0]
    const dy = pts[i * 3 + 1] - c[1]
    const dz = pts[i * 3 + 2] - c[2]
    return dx * dx + dy * dy + dz * dz
  }
  const origin = [0, 0, 0]
  let pick = 0
  let radius = 0
  for (let i = 0; i < n; i += 1) {
    const d = d2(i, origin)
    if (d > radius) { radius = d; pick = i }
  }
  radius = Math.sqrt(radius)

  // Semillas lo más separadas posible y unas vueltas de k-means sobre una muestra.
  const step = Math.max(1, Math.floor(n / 4000))
  const seeds = []
  const near = new Float32Array(n).fill(Infinity)
  for (let k = 0; k < SHAPE_SPHERES && n > 0; k += 1) {
    const c = [pts[pick * 3], pts[pick * 3 + 1], pts[pick * 3 + 2]]
    seeds.push(c)
    let far = 0
    for (let i = 0; i < n; i += step) {
      near[i] = Math.min(near[i], d2(i, c))
      if (near[i] > far) { far = near[i]; pick = i }
    }
    if (far === 0) break
  }
  const owner = new Int32Array(n)
  const assign = (stride) => {
    for (let i = 0; i < n; i += stride) {
      let best = 0
      let bestD = Infinity
      for (let k = 0; k < seeds.length; k += 1) {
        const d = d2(i, seeds[k])
        if (d < bestD) { bestD = d; best = k }
      }
      owner[i] = best
    }
  }
  for (let it = 0; it < 8; it += 1) {
    assign(step)
    const sum = seeds.map(() => [0, 0, 0, 0])
    for (let i = 0; i < n; i += step) {
      const s = sum[owner[i]]
      s[0] += pts[i * 3]; s[1] += pts[i * 3 + 1]; s[2] += pts[i * 3 + 2]; s[3] += 1
    }
    sum.forEach((s, k) => { if (s[3]) seeds[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]] })
  }
  assign(1)
  const r2 = new Float32Array(seeds.length).fill(-1)
  for (let i = 0; i < n; i += 1) r2[owner[i]] = Math.max(r2[owner[i]], d2(i, seeds[owner[i]]))
  const spheres = []
  seeds.forEach((c, k) => { if (r2[k] >= 0) spheres.push([c[0], c[1], c[2], Math.sqrt(r2[k])]) })
  if (!spheres.length) spheres.push([0, 0, 0, radius || 0.5])
  const shape = { center, radius: radius || 0.5, spheres }
  shapeCache.set(root, shape)
  return shape
}

// ─── Single floating bird ────────────────────────────────────────────
function FloatingBird({ url, scale, scaleMul = 1, tint = null, index, birdsRef }) {
  const fit = isPhoneExperience() ? PHONE_SCALE : 1
  const effScale = scale * scaleMul * fit * BIRD_SIZE
  const { scene } = useGLTF(url, true, true, extendGLTFLoaderKTX2)
  const shape = useMemo(() => measureShape(scene), [scene])
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

  // La física vive en Scene: aquí solo se registra el globo con su forma a escala.
  // `off` guarda dónde queda cada esfera ya girada, respecto al centro.
  const registerRef = useCallback((node) => {
    if (!birdsRef.current) return
    birdsRef.current[index] = node ? {
      node,
      s: state.current,
      radius: shape.radius * effScale * SHAPE_MARGIN,
      spheres: shape.spheres.map(([x, y, z, r]) => [x * effScale, y * effScale, z * effScale, r * effScale * SHAPE_MARGIN]),
      off: new Float32Array(shape.spheres.length * 3),
    } : null
  }, [birdsRef, index, shape, effScale])

  const c = shape.center
  return (
    <group ref={registerRef}>
      <group position={[-c.x * effScale, -c.y * effScale, -c.z * effScale]}>
        <primitive object={cloned} scale={[effScale, effScale, effScale]} />
        {/* Babosa de slime oculta (#2) — pegada a UN housebird (el primer slot).
            Reto: no se anuncia cuál. Cabalga con el ave. */}
        {index === 0 && <SlimeSlug3D id="about" position={[2.4 * fit, -0.2 * fit, 1.1 * fit]} scale={0.6} />}
      </group>
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
  { scale: 14 },
  { scale: 12 },
  { scale: 11 },
  { scale: 13 },
]

// Gira al globo cuando el choque no le pega al centro: torque = brazo × empuje,
// con el brazo en partes de su radio para que no dependa del tamaño.
function spinFromHit(bird, rx, ry, rz, fx, fy, fz) {
  const s = bird.s
  const k = HIT_SPIN / bird.radius
  s.baseRotX = clamp(s.baseRotX + (ry * fz - rz * fy) * k, -MAX_SPIN, MAX_SPIN)
  s.baseRotY = clamp(s.baseRotY + (rz * fx - rx * fz) * k, -MAX_SPIN, MAX_SPIN)
  s.baseRotZ = clamp(s.baseRotZ + (rx * fy - ry * fx) * k, -MAX_SPIN, MAX_SPIN)
}

// Choque entre dos globos con el par de esferas más encimado. Se mide en la
// pantalla y no en 3D: con la profundidad que traen, uno pasaba por delante de otro
// sin tocarlo y se veían encimados. Cada esfera se proyecta con la perspectiva de la
// cámara (lo cercano se ve más grande y más afuera). `respond` reparte el rebote
// (solo si se acercan); siempre los separa lo encimado, por masa.
function collide(a, b, respond) {
  const pa = a.node.position
  const pb = b.node.position
  const fa0 = CAM_Z / (CAM_Z - pa.z)
  const fb0 = CAM_Z / (CAM_Z - pb.z)
  const gx = pb.x * fb0 - pa.x * fa0
  const gy = pb.y * fb0 - pa.y * fa0
  const reach = (a.radius * fa0 + b.radius * fb0) * 1.1
  if (gx * gx + gy * gy >= reach * reach) return false
  let over = 0
  let scale = 1
  let nx = 1, ny = 0
  let ri = 0, rj = 0
  for (let i = 0; i < a.spheres.length; i += 1) {
    const fa = CAM_Z / (CAM_Z - pa.z - a.off[i * 3 + 2])
    const ax = (pa.x + a.off[i * 3]) * fa
    const ay = (pa.y + a.off[i * 3 + 1]) * fa
    const ar = a.spheres[i][3] * fa
    for (let j = 0; j < b.spheres.length; j += 1) {
      const fb = CAM_Z / (CAM_Z - pb.z - b.off[j * 3 + 2])
      const dx = (pb.x + b.off[j * 3]) * fb - ax
      const dy = (pb.y + b.off[j * 3 + 1]) * fb - ay
      const rr = ar + b.spheres[j][3] * fb
      const dd = dx * dx + dy * dy
      if (dd >= rr * rr) continue
      const d = Math.sqrt(dd)
      if (rr - d <= over) continue
      over = rr - d
      scale = Math.min(fa, fb)
      ri = i
      rj = j
      const g = Math.hypot(gx, gy)
      if (d > 1e-6) { nx = dx / d; ny = dy / d } else if (g > 1e-6) { nx = gx / g; ny = gy / g }
    }
  }
  if (over <= 0) return false
  const wa = 1 / (a.radius * a.radius)
  const wb = 1 / (b.radius * b.radius)
  const w = wa + wb
  if (respond) {
    const sa = a.s
    const sb = b.s
    const vn = (sb.vx - sa.vx) * nx + (sb.vy - sa.vy) * ny
    if (vn < 0) {
      const j = -(1 + BOUNCE) * vn / w
      sa.vx -= nx * j * wa; sa.vy -= ny * j * wa
      sb.vx += nx * j * wb; sb.vy += ny * j * wb
      const ar = a.spheres[ri][3]
      const br = b.spheres[rj][3]
      spinFromHit(a, a.off[ri * 3] + nx * ar, a.off[ri * 3 + 1] + ny * ar, a.off[ri * 3 + 2], -nx * j, -ny * j, 0)
      spinFromHit(b, b.off[rj * 3] - nx * br, b.off[rj * 3 + 1] - ny * br, b.off[rj * 3 + 2], nx * j, ny * j, 0)
    }
  }
  // Lo encimado está en la pantalla; en el mundo hace falta un poco más.
  const push = over / scale + 1e-4
  pa.x -= nx * push * wa / w; pa.y -= ny * push * wa / w
  pb.x += nx * push * wb / w; pb.y += ny * push * wb / w
  return true
}

// ─── Warm-up ─────────────────────────────────────────────────────────
// Los shaders se calientan antes del primer cuadro, como en el home
// (rendimiento.md, 2026-11-11). Este canvas nace en cada entrada al About y su
// primer cuadro compilaba todo de golpe (toon, contorno, la babosa y el PMREM
// del HDR): ~150 ms de hilo bloqueado en visita repetida y hasta ~500 ms en
// primera visita, encima del primer párrafo. Con el loop apagado, compileAsync
// los linkea en paralelo; luego un cuadro con el canvas invisible sube la
// geometría, y hasta entonces arranca el loop y aparecen los personajes. Monta
// junto a los modelos y el Environment, así que corre cuando ya llegaron.
function WarmUp({ onReady }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let alive = true
    ;(async () => {
      try { await compileAsyncSafe(gl, scene, camera, 8000) } catch { }
      if (!alive) return
      await new Promise((r) => requestAnimationFrame(r))
      if (!alive) return
      try { gl.render(scene, camera) } catch { }
      onReady()
    })()
    return () => { alive = false }
  }, [gl, scene, camera, onReady])
  return null
}

// ─── Scene ───────────────────────────────────────────────────────────
function Scene({ scrollVelocityRef, onReady }) {
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

  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock, viewport }, delta) => {
    const list = birdsRef.current
    if (!list || list.some((b) => !b)) return
    // Cuántos cuadros de 60 Hz duró este cuadro (tope para cuando la pestaña regresa).
    const dt = Math.min(delta, 0.1)
    const step = dt * 60
    const damp = Math.pow(DAMPING, step)
    const settle = 1 - Math.exp(-SPIN_SETTLE * dt)
    const halfW = viewport.width / 2
    const halfH = viewport.height / 2
    const limitW = (b) => Math.max(0, halfW - b.radius * WALL_IN)
    const limitH = (b) => Math.max(0, halfH - b.radius * WALL_IN)

    if (!initialized.current) {
      // Arrancan en zigzag a lo largo de la pantalla; los choques acomodan el resto.
      // En una pantalla parada cada uno se mece en su propia altura (`homeU`): si todos
      // regresan a la mitad, en el teléfono no caben sin estarse empujando.
      const wide = viewport.width >= viewport.height
      list.forEach((b, i) => {
        const u = (i / (list.length - 1)) * 2 - 1
        const side = i % 2 ? -0.6 : 0.6
        b.s.homeU = wide ? 0 : u * 0.75
        b.s.rest = [b.s.baseRotX, b.s.baseRotY, b.s.baseRotZ]
        if (wide) b.node.position.set(u * limitW(b), side * limitH(b), 0)
        else b.node.position.set(side * limitW(b), u * limitH(b), 0)
      })
      initialized.current = true
    }

    const t = clock.getElapsedTime()
    const sv = clamp(scrollVelocityRef?.current || 0, -600, 600)

    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]
        const b = list[j]
        const dx = b.node.position.x - a.node.position.x
        const dy = b.node.position.y - a.node.position.y
        const reach = (a.radius + b.radius) * CUSHION
        const dd = dx * dx + dy * dy
        if (dd >= reach * reach || dd < 1e-6) continue
        const d = Math.sqrt(dd)
        const f = CUSHION_STIFFNESS * (1 - d / reach) * step
        a.s.vx -= (dx / d) * f; a.s.vy -= (dy / d) * f
        b.s.vx += (dx / d) * f; b.s.vy += (dy / d) * f
      }
    }

    // 1. Cada uno con sus fuerzas, paredes suaves y su giro, igual que antes.
    for (const b of list) {
      const g = b.node
      const s = b.s
      const lw = limitW(b)
      const lh = limitH(b)

      s.vx += Math.sin(t * 0.07 + s.px) * DRIFT_STRENGTH * step
      s.vy += Math.sin(t * 0.05 + s.py) * DRIFT_STRENGTH * step
      s.vz += Math.cos(t * 0.04 + s.pz) * DRIFT_STRENGTH * 0.15 * step

      const bobTarget = (s.homeU || 0) * lh + Math.sin(t * 0.12 + s.bobPhase) * 1.2
      s.vy += (bobTarget - g.position.y) * 0.0004 * step

      if (sv) {
        s.vy -= sv * SCROLL_STRENGTH * 0.001 * step
        s.vx += sv * SCROLL_STRENGTH * 0.0002 * Math.sin(t * 0.5 + s.px) * step
        s.baseRotX = clamp(s.baseRotX + sv * 0.000003 * step, -MAX_SPIN, MAX_SPIN)
        s.baseRotZ = clamp(s.baseRotZ - sv * 0.000002 * step, -MAX_SPIN, MAX_SPIN)
      }
      if (s.rest) {
        s.baseRotX += (s.rest[0] - s.baseRotX) * settle
        s.baseRotY += (s.rest[1] - s.baseRotY) * settle
        s.baseRotZ += (s.rest[2] - s.baseRotZ) * settle
      }

      const softW = Math.max(0, lw - 1)
      const softH = Math.max(0, lh - 1)
      const wall = WALL_STIFFNESS * step
      if (g.position.x > softW) s.vx -= (g.position.x - softW) * wall
      if (g.position.x < -softW) s.vx -= (g.position.x + softW) * wall
      if (g.position.y > softH) s.vy -= (g.position.y - softH) * wall
      if (g.position.y < -softH) s.vy -= (g.position.y + softH) * wall
      if (g.position.z > 1.0) s.vz -= (g.position.z - 1.0) * wall
      if (g.position.z < -1.0) s.vz -= (g.position.z + 1.0) * wall

      s.vx = clamp(s.vx * damp, -MAX_VEL, MAX_VEL)
      s.vy = clamp(s.vy * damp, -MAX_VEL, MAX_VEL)
      s.vz = clamp(s.vz * damp, -MAX_VEL * 0.3, MAX_VEL * 0.3)
      g.position.x += s.vx * step
      g.position.y += s.vy * step
      g.position.z += s.vz * step

      if (g.position.x > lw) { g.position.x = lw; s.vx = -Math.abs(s.vx) * 0.5 }
      if (g.position.x < -lw) { g.position.x = -lw; s.vx = Math.abs(s.vx) * 0.5 }
      if (g.position.y > lh) { g.position.y = lh; s.vy = -Math.abs(s.vy) * 0.5 }
      if (g.position.y < -lh) { g.position.y = -lh; s.vy = Math.abs(s.vy) * 0.5 }
      if (g.position.z > 2.0) { g.position.z = 2.0; s.vz = -Math.abs(s.vz) * 0.5 }
      if (g.position.z < -2.0) { g.position.z = -2.0; s.vz = Math.abs(s.vz) * 0.5 }

      g.rotation.x += s.baseRotX * 0.008 * step
      g.rotation.y += s.baseRotY * 0.008 * step
      g.rotation.z += s.baseRotZ * 0.008 * step
      // Las esferas giran con el modelo; en lo que resta del cuadro solo se mueve el centro.
      b.spheres.forEach((sp, k) => {
        tmp.set(sp[0], sp[1], sp[2]).applyQuaternion(g.quaternion)
        b.off[k * 3] = tmp.x
        b.off[k * 3 + 1] = tmp.y
        b.off[k * 3 + 2] = tmp.z
      })
    }

    // 2. Choques: el rebote una vez por par y luego acomodo con las paredes. Las
    // últimas vueltas son solo de choques, así que si no caben todos, alguno se
    // sale tantito de la pantalla antes que encimarse.
    for (let p = 0; p < PASSES; p += 1) {
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) collide(list[i], list[j], p === 0)
      }
      for (const b of list) {
        const pos = b.node.position
        pos.x = clamp(pos.x, -limitW(b), limitW(b))
        pos.y = clamp(pos.y, -limitH(b), limitH(b))
        pos.z = clamp(pos.z, -2, 2)
      }
    }
    for (let p = 0; p < SEPARATE_PASSES; p += 1) {
      let any = false
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) if (collide(list[i], list[j], false)) any = true
      }
      if (!any) break
    }
  })

  return (
    <>
      {/* Ambient bajo + key fuerte → el banding toon muestra el corte. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, 4]} intensity={1.5} />
      <directionalLight position={[-4, 3, -2]} intensity={0.3} />
      {/* Solo la babosa refleja el entorno (el toon no lo usa). Antes era el
          preset "city": 1024×512 desde un CDN externo y un cuadro de ~140 ms al
          leerlo. Es el HDR del home a 256×128 (se regenera con
          `node scripts/gen-mobile-hdr.mjs public/light.hdr public/light-about.hdr 4`),
          con URL propia porque Environment desecha su textura al desmontarse
          y compartirla con el home le borraría el suyo. */}
      <Environment files={`${BASE}light-about.hdr`} background={false} />

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
          />
        ))}
      </group>

      {/* Solo hull outline + toon banding. El EdgeInk (Laplaciano o gradiente)
          pelea con este mesh smooth de una sola pieza — ver respuesta sobre por
          qué el mesh es la causa. */}
      <WarmUp onReady={onReady} />
    </>
  )
}

// ─── Fullscreen overlay ──────────────────────────────────────────────
// El loop no arranca hasta que WarmUp termina; mientras, el canvas va invisible
// y luego aparece con un fundido.
export default function FloatingHousebirds({ scrollVelocityRef }) {
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{ width: '100vw', height: '100vh', opacity: ready ? 1 : 0, transition: 'opacity 600ms ease-out' }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, CAM_Z], fov: 50 }}
        style={{ background: 'transparent' }}
        raycaster={{ enabled: false }}
        frameloop={ready ? 'always' : 'never'}
      >
        <Scene scrollVelocityRef={scrollVelocityRef} onReady={onReady} />
      </Canvas>
    </div>
  )
}
