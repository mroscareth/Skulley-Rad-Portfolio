import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Trayectoria de la PATADA mientras cargas, como en el billar.
//
// No es una curva inventada: cada frame le pide a HomeOrbs (predictKick) que
// simule, con la misma física del juego, qué esferas golpearías si soltaras
// AHORA con esta carga. Todo va PROYECTADO EN EL PISO (la huella del tiro,
// no el arco en el aire). Para cada esfera:
//   - un aro donde CAE (lo más exacto: la patada congela la puntería al
//     soltar), aros chicos en los botes que se ven (sube más de FLIGHT_MIN;
//     los brinquitos de 2 cm no se marcan porque no se ven) y una ZONA de
//     llegada al final, que crece con lo que rueda: rodar es lo menos exacto
//     (otras esferas, la frecuencia de la pantalla) y la zona lo dice en vez
//     de fingir un punto.
//   - si choca con otra, un aro donde se tocan y el recorrido de la otra
//     hasta su propia zona, en su color.
//
// Cómo se enseña (idea de Oscar, 2026-10-24): las marcas aparecen PRIMERO,
// tenues; luego la línea se va PINTANDO desde la esfera hacia cada marca,
// una por una, y cada marca se enciende cuando la línea llega. Al terminar
// se queda un momento y vuelve a pintarse. Así primero se lee dónde cae, y
// la línea va contando hasta dónde llega con la fuerza que llevas.
//
// Todo por refs en el useFrame: cero re-renders.

const COLOR = new THREE.Color('#22d3ee')
const COLOR_FULL = new THREE.Color('#d8fbff')
const WHITE = new THREE.Color('#ffffff')
const MAX_DOTS = 320
const MAX_RINGS = 3         // esferas que se predicen a la vez
const FLOOR_Y = 0.04        // todo va pegado al piso
const SPACING = 0.34        // vuelo: separación entre puntos, en unidades de mundo
const SPACING_ROLL = 0.55   // rodando: más espaciado, se lee como "aproximado"
const DOT_SIZE = 0.075
const DOT_SIZE_ROLL = 0.05
const DOT_SIZE_NEXT = 0.06
const FLIGHT_MIN = 0.3      // u que tiene que subir para que su caída se marque
const MAX_BOUNCES = 3       // caídas visibles que se marcan por esfera
// Cada caída se marca un poco más chica y más tenue: se lee cómo pierde
// fuerza. Blanco y delgado: el cian se perdía en el piso azul y un aro
// grueso con contorno se veía tosco.
const BOUNCE_SCALE = [1.3, 1.0, 0.85]
const BOUNCE_OPACITY = [1, 0.8, 0.65]
const MARK_MIN_R = 0.28     // las esferas chicas también dejan una marca visible
// Zona de llegada: radio = ZONE_BASE + ZONE_K × lo que rueda.
const ZONE_BASE = 0.3
const ZONE_K = 0.07
// Pintado de la línea: cuánto tarda en llegar a la última marca, cuánto se
// queda completa antes de volver a empezar, y qué tan tenue está una marca
// a la que la línea todavía no llega.
const DRAW_TIME = 0.9
const HOLD_TIME = 0.7
const MARK_DIM = 0.3

const easeOut = (x) => 1 - Math.pow(1 - x, 3)

export default function KickTrajectory({ chargeRef, anchorRef, yawRef, reachRef, predictRef, strengthFor, halfAngle }) {
  const dotsRef = useRef(null)
  const hitRefs = useRef([])
  const hitMatRefs = useRef([])
  const landRefs = useRef([])
  const landMatRefs = useRef([]) // por marca: [aro, punto]
  const zoneRefs = useRef([])
  const zoneMatRefs = useRef([]) // por zona: [aro, relleno]
  const groupRef = useRef(null)
  const cycleRef = useRef({ start: 0, wasVisible: false })
  const tmp = useMemo(() => ({
    base: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    m: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    p: new THREE.Vector3(),
    s: new THREE.Vector3(),
    c: new THREE.Color(),
  }), [])

  const dotGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  // Marcas acostadas en el piso: aro blanco fino, un punto chico al centro
  // ("aquí pega") y, para la zona, un relleno muy tenue.
  const floorGeos = useMemo(() => {
    const flat = (g) => { g.rotateX(-Math.PI / 2); return g }
    return {
      ring: flat(new THREE.RingGeometry(0.88, 1, 64)),
      zoneRing: flat(new THREE.RingGeometry(0.95, 1, 72)),
      dot: flat(new THREE.CircleGeometry(0.09, 20)),
      disc: flat(new THREE.CircleGeometry(1, 48)),
    }
  }, [])
  useEffect(() => () => {
    try {
      dotGeo.dispose()
      Object.values(floorGeos).forEach((g) => g.dispose())
    } catch { }
  }, [dotGeo, floorGeos])
  // Colores por punto desde el montaje: si el atributo nace en la primera
  // carga, el material se recompila justo ahí y se nota un tirón.
  useEffect(() => {
    const dots = dotsRef.current
    if (dots && !dots.instanceColor) {
      dots.setColorAt(0, COLOR)
      dots.count = 0
    }
  }, [])

  // Largo acumulado de la huella en el piso (solo X,Z) de cada punto.
  const groundCum = (pts) => {
    const cum = []
    const nPts = pts ? pts.length / 3 : 0
    if (!nPts) return cum
    cum.push(0)
    for (let i = 1; i < nPts; i += 1) {
      const a = (i - 1) * 3
      const b = i * 3
      cum.push(cum[i - 1] + Math.hypot(pts[b] - pts[a], pts[b + 2] - pts[a + 2]))
    }
    return cum
  }

  // Puntos sobre la huella entre los puntos `from` y `to`, cada `spacing`,
  // hasta `limit` de recorrido desde `from` (lo que ya se pintó). Se
  // adelgazan hacia el final: se lee la dirección sin flecha.
  const placeDots = (pts, cum, from, to, limit, spacing, size, color, startIdx, mesh) => {
    let idx = startIdx
    const nPts = cum.length
    if (nPts < 2 || limit <= 0) return idx
    const last = to < 0 || to > nPts - 1 ? nPts - 1 : to
    const first = Math.max(0, Math.min(from, last))
    const fromLen = cum[first]
    const segLen = cum[last] - fromLen
    if (segLen < 1e-3) return idx
    const endLen = fromLen + Math.min(segLen, limit)
    let target = fromLen + spacing * 0.5
    let i = Math.max(1, first + 1)
    while (target <= endLen && idx < MAX_DOTS && i <= last) {
      while (i <= last && cum[i] < target) i += 1
      if (i > last) break
      const a = (i - 1) * 3
      const b = i * 3
      const seg = cum[i] - cum[i - 1]
      const t = seg > 1e-6 ? (target - cum[i - 1]) / seg : 0
      tmp.p.set(pts[a] + (pts[b] - pts[a]) * t, FLOOR_Y, pts[a + 2] + (pts[b + 2] - pts[a + 2]) * t)
      const k = size * (1 - 0.35 * Math.min(1, (target - fromLen) / segLen))
      tmp.s.set(k, k * 0.35, k) // aplanados: puntos pintados en el piso
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      mesh.setMatrixAt(idx, tmp.m)
      mesh.setColorAt(idx, color)
      idx += 1
      target += spacing
    }
    return idx
  }

  const setOpacity = (mats, value) => {
    if (mats) for (const m of mats) if (m) m.opacity = value
  }

  const placeZone = (slot, x, z, radius, color, lit) => {
    const zg = zoneRefs.current[slot]
    if (!zg) return
    zg.visible = true
    zg.position.set(x, FLOOR_Y - 0.015, z)
    zg.scale.setScalar(radius)
    const mats = zoneMatRefs.current[slot]
    const o = lit ? 0.85 : 0.85 * MARK_DIM
    if (mats) {
      if (mats[0]) { mats[0].color.copy(color); mats[0].opacity = o }
      if (mats[1]) { mats[1].color.copy(color); mats[1].opacity = o * 0.16 }
    }
  }

  useFrame((state) => {
    const g = groupRef.current
    const dots = dotsRef.current
    if (!g || !dots) return
    const charge = chargeRef?.current || 0
    const predict = predictRef?.current
    const visible = charge > 0.01 && typeof predict === 'function'
    if (g.visible !== visible) g.visible = visible
    const cyc = cycleRef.current
    const t = state.clock.elapsedTime
    if (!visible) { cyc.wasVisible = false; return }
    // Empieza a cargar: la línea arranca a pintarse desde cero.
    if (!cyc.wasVisible) { cyc.start = t; cyc.wasVisible = true }

    const anchor = anchorRef?.current
    if (!anchor) return
    anchor.getWorldPosition(tmp.base)
    const yaw = (yawRef && typeof yawRef.current === 'number') ? yawRef.current : 0
    tmp.dir.set(Math.sin(yaw), 0, Math.cos(yaw))
    const strength = strengthFor ? strengthFor(charge) : 10
    const reach = (reachRef && reachRef.current) || 2.2

    let res = []
    // A la altura del pie: es la que usa la patada real para el margen vertical.
    try { res = predict(tmp.base, tmp.dir, strength, reach, halfAngle, tmp.base.y + 0.35) || [] } catch { res = [] }

    const full = charge > 0.995
    const mainColor = full ? COLOR_FULL : COLOR
    // Cuánto del tiro ya se pintó, de 0 a 1, en ciclos.
    const phase = (t - cyc.start) % (DRAW_TIME + HOLD_TIME)
    const progress = easeOut(Math.min(1, phase / DRAW_TIME))
    let n = 0
    for (const zg of zoneRefs.current) if (zg) zg.visible = false

    for (let i = 0; i < res.length && i < MAX_RINGS; i += 1) {
      const r = res[i]
      const pts = r.points
      const cum = groundCum(pts)
      const lastIdx = cum.length - 1
      const mainLen = cum[lastIdx] || 0
      const nextCum = r.next ? groundCum(r.next.points) : null
      const nextLen = nextCum && nextCum.length ? nextCum[nextCum.length - 1] : 0
      // La línea de esta esfera y luego la de la que golpea, en orden.
      const painted = progress * (mainLen + nextLen)

      const landings = (r.landings || []).filter((L) => L.apex >= FLIGHT_MIN)
      const firstLand = landings[0] || null
      const splitIdx = firstLand ? firstLand.i : 0
      const splitLen = cum[splitIdx] || 0

      if (firstLand) {
        n = placeDots(pts, cum, 0, splitIdx, painted, SPACING, DOT_SIZE, mainColor, n, dots)
      }
      n = placeDots(pts, cum, splitIdx, lastIdx, painted - splitLen,
        firstLand ? SPACING_ROLL : SPACING, firstLand ? DOT_SIZE_ROLL : DOT_SIZE, mainColor, n, dots)

      // Dónde cae y dónde rebota: se encienden cuando la línea llega.
      for (let b = 0; b < MAX_BOUNCES; b += 1) {
        const lr = landRefs.current[i * MAX_BOUNCES + b]
        if (!lr) continue
        const L = landings[b]
        lr.visible = !!L
        if (!L) continue
        const lit = painted >= (cum[L.i] || 0)
        lr.position.set(L.x, FLOOR_Y - 0.01, L.z)
        const pulse = b === 0 && lit ? 0.08 * Math.sin(t * 7 + i) : 0
        lr.scale.setScalar(Math.max(r.radius, MARK_MIN_R) * (BOUNCE_SCALE[b] + pulse))
        setOpacity(landMatRefs.current[i * MAX_BOUNCES + b], BOUNCE_OPACITY[b] * (lit ? 1 : MARK_DIM))
      }

      // Zona de llegada: solo si se detiene sola (sin choque ni salirse).
      if (!r.contact && !r.out && r.end) {
        const sx = firstLand ? firstLand.x : pts[0]
        const sz = firstLand ? firstLand.z : pts[2]
        const roll = Math.hypot(r.end.x - sx, r.end.z - sz)
        placeZone(i * 2, r.end.x, r.end.z, Math.max(r.radius * 1.3, ZONE_BASE + ZONE_K * roll), WHITE, painted >= mainLen - 1e-3)
      }

      // Dónde se tocan con otra esfera: aro en el piso bajo el contacto.
      const hit = hitRefs.current[i]
      if (hit) {
        const c = r.contact
        hit.visible = !!c
        if (c) {
          const lit = painted >= mainLen - 1e-3
          hit.position.set(c.x, FLOOR_Y - 0.005, c.z)
          hit.scale.setScalar(c.radius * (1 + (lit ? 0.06 * Math.sin(t * 9 + i) : 0)))
          const hm = hitMatRefs.current[i]
          if (hm) { hm.color.copy(mainColor); hm.opacity = lit ? 0.95 : 0.95 * MARK_DIM }
        }
      }

      // La otra esfera, si hay choque: se pinta después, en su color.
      if (r.next && nextCum) {
        tmp.c.set(r.next.color || '#ffffff')
        n = placeDots(r.next.points, nextCum, 0, -1, painted - mainLen, SPACING_ROLL, DOT_SIZE_NEXT, tmp.c, n, dots)
        if (!r.next.out && r.next.end) {
          const np = r.next.points
          const roll = Math.hypot(r.next.end.x - np[0], r.next.end.z - np[2])
          placeZone(i * 2 + 1, r.next.end.x, r.next.end.z, Math.max(r.next.radius * 1.3, ZONE_BASE + ZONE_K * roll), tmp.c, progress >= 0.999)
        }
      }
    }
    for (let k = Math.min(res.length, MAX_RINGS) * MAX_BOUNCES; k < MAX_RINGS * MAX_BOUNCES; k += 1) {
      const lr = landRefs.current[k]
      if (lr) lr.visible = false
    }
    for (let k = Math.min(res.length, MAX_RINGS); k < MAX_RINGS; k += 1) {
      const hit = hitRefs.current[k]
      if (hit) hit.visible = false
    }
    dots.count = n
    dots.instanceMatrix.needsUpdate = true
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true
  })

  const matProps = { transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }
  const collect = (store, i, k) => (el) => {
    if (!store.current[i]) store.current[i] = []
    store.current[i][k] = el
  }

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh ref={dotsRef} args={[dotGeo, undefined, MAX_DOTS]} frustumCulled={false} renderOrder={5}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.92} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {Array.from({ length: MAX_RINGS * MAX_BOUNCES }).map((_, i) => (
        <group key={`land-${i}`} ref={(el) => { landRefs.current[i] = el }} visible={false}>
          <mesh geometry={floorGeos.ring} frustumCulled={false} renderOrder={5}>
            <meshBasicMaterial ref={collect(landMatRefs, i, 0)} color="#ffffff" {...matProps} />
          </mesh>
          <mesh geometry={floorGeos.dot} position={[0, 0.003, 0]} frustumCulled={false} renderOrder={5}>
            <meshBasicMaterial ref={collect(landMatRefs, i, 1)} color="#ffffff" {...matProps} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: MAX_RINGS * 2 }).map((_, i) => (
        <group key={`zone-${i}`} ref={(el) => { zoneRefs.current[i] = el }} visible={false}>
          <mesh geometry={floorGeos.disc} frustumCulled={false} renderOrder={4}>
            <meshBasicMaterial ref={collect(zoneMatRefs, i, 1)} color="#ffffff" {...matProps} />
          </mesh>
          <mesh geometry={floorGeos.zoneRing} position={[0, 0.002, 0]} frustumCulled={false} renderOrder={5}>
            <meshBasicMaterial ref={collect(zoneMatRefs, i, 0)} color="#ffffff" {...matProps} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: MAX_RINGS }).map((_, i) => (
        <mesh
          key={`hit-${i}`}
          ref={(el) => { hitRefs.current[i] = el }}
          geometry={floorGeos.ring}
          visible={false}
          frustumCulled={false}
          renderOrder={6}
        >
          <meshBasicMaterial
            ref={(el) => { hitMatRefs.current[i] = el }}
            color="#22d3ee"
            {...matProps}
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  )
}
