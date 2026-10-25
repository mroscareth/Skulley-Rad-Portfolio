import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Trayectoria de la PATADA mientras cargas, como en el billar.
//
// No es una curva inventada: cada frame le pide a HomeOrbs (predictKick) que
// simule, con la misma física del juego, qué esferas golpearías si soltaras
// AHORA con esta carga. Para cada una se dibuja:
//   - el VUELO hasta donde cae: puntos firmes y un aro en el piso. Es lo más
//     exacto (la patada congela la puntería al soltar), así que va marcado.
//   - lo que RUEDA después, hasta detenerse: puntos más finos y espaciados,
//     un aro chico en cada bote que se ve (sube más de FLIGHT_MIN; los
//     brinquitos de 2 cm no se marcan porque no se ven), y al final una ZONA
//     de llegada que crece con lo que rueda. Rodar es lo menos exacto (otras
//     esferas en el camino, la frecuencia de la pantalla): la zona lo dice en
//     vez de fingir un punto, y meterla al portal sigue pidiendo puntería.
//   - si choca con otra esfera, un aro "fantasma" donde se tocan y el
//     recorrido de la otra hasta su propia zona de llegada, en su color.
// Antes la línea enseñaba solo 1.2 s de futuro y se cortaba en un punto que
// no decía nada (Oscar, 2026-10-24).
//
// Todo por refs en el useFrame: cero re-renders.

const COLOR = new THREE.Color('#22d3ee')
const COLOR_FULL = new THREE.Color('#d8fbff')
const WHITE = new THREE.Color('#ffffff')
const MAX_DOTS = 320
const MAX_RINGS = 3         // esferas que se predicen a la vez
const SPACING = 0.34        // vuelo: separación entre puntos, en unidades de mundo
const SPACING_ROLL = 0.55   // rodando: más espaciado, se lee como "aproximado"
const FLOW_SPEED = 1.1      // u/s: los puntos avanzan hacia donde va la esfera
const DOT_SIZE = 0.08
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

export default function KickTrajectory({ chargeRef, anchorRef, yawRef, reachRef, predictRef, strengthFor, halfAngle }) {
  const dotsRef = useRef(null)
  const ringRefs = useRef([])
  const ringMatRefs = useRef([])
  const landRefs = useRef([])
  const landMatRefs = useRef([]) // por marca: [aro, punto]
  const zoneRefs = useRef([])
  const zoneMatRefs = useRef([]) // por zona: [aro, relleno]
  const groupRef = useRef(null)
  const tmp = useMemo(() => ({
    base: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    m: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    p: new THREE.Vector3(),
    s: new THREE.Vector3(),
    c: new THREE.Color(),
    cum: [],
  }), [])

  const dotGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.86, 1, 48), [])
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
      dotGeo.dispose(); ringGeo.dispose()
      Object.values(floorGeos).forEach((g) => g.dispose())
    } catch { }
  }, [dotGeo, ringGeo, floorGeos])
  // Colores por punto desde el montaje: si el atributo nace en la primera
  // carga, el material se recompila justo ahí y se nota un tirón.
  useEffect(() => {
    const dots = dotsRef.current
    if (dots && !dots.instanceColor) {
      dots.setColorAt(0, COLOR)
      dots.count = 0
    }
  }, [])

  // Puntos a lo largo de la polilínea entre los puntos `from` y `to`, cada
  // `spacing` de recorrido, desfasados por `phase` para que parezca que
  // fluyen. Se adelgazan hacia el final: se lee la dirección sin flecha.
  const placeDots = (pts, from, to, spacing, phase, size, color, startIdx, mesh) => {
    let idx = startIdx
    const nPts = pts ? pts.length / 3 : 0
    if (nPts < 2) return idx
    const last = to < 0 || to > nPts - 1 ? nPts - 1 : to
    const first = Math.max(0, Math.min(from, last))
    const cum = tmp.cum
    cum.length = 0
    cum.push(0)
    for (let i = 1; i < nPts; i += 1) {
      const a = (i - 1) * 3
      const b = i * 3
      cum.push(cum[i - 1] + Math.hypot(pts[b] - pts[a], pts[b + 1] - pts[a + 1], pts[b + 2] - pts[a + 2]))
    }
    const fromLen = cum[first]
    const toLen = cum[last]
    const segLen = toLen - fromLen
    if (segLen < 1e-3) return idx
    let target = fromLen + phase
    let i = Math.max(1, first + 1)
    while (target <= toLen && idx < MAX_DOTS && i <= last) {
      while (i <= last && cum[i] < target) i += 1
      if (i > last) break
      const a = (i - 1) * 3
      const b = i * 3
      const seg = cum[i] - cum[i - 1]
      const t = seg > 1e-6 ? (target - cum[i - 1]) / seg : 0
      tmp.p.set(pts[a] + (pts[b] - pts[a]) * t, pts[a + 1] + (pts[b + 1] - pts[a + 1]) * t, pts[a + 2] + (pts[b + 2] - pts[a + 2]) * t)
      const k = size * (1 - 0.35 * Math.min(1, (target - fromLen) / segLen))
      tmp.s.set(k, k, k)
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      mesh.setMatrixAt(idx, tmp.m)
      mesh.setColorAt(idx, color)
      idx += 1
      target += spacing
    }
    return idx
  }

  const placeZone = (slot, x, z, radius, color, opacity) => {
    const zg = zoneRefs.current[slot]
    if (!zg) return
    zg.visible = true
    zg.position.set(x, 0.025, z)
    zg.scale.setScalar(radius)
    const mats = zoneMatRefs.current[slot]
    if (mats) {
      if (mats[0]) { mats[0].color.copy(color); mats[0].opacity = opacity }
      if (mats[1]) { mats[1].color.copy(color); mats[1].opacity = opacity * 0.14 }
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
    if (!visible) return

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
    const t = state.clock.elapsedTime
    let n = 0
    for (const zg of zoneRefs.current) if (zg) zg.visible = false

    for (let i = 0; i < res.length && i < MAX_RINGS; i += 1) {
      const r = res[i]
      const pts = r.points
      const lastIdx = pts.length / 3 - 1
      // Caídas que se ven (venía volando). La primera parte el tiro en vuelo
      // y rodada; si no hay, todo el tiro va rodando.
      const landings = (r.landings || []).filter((L) => L.apex >= FLIGHT_MIN)
      const firstLand = landings[0] || null
      const splitIdx = firstLand ? firstLand.i : 0

      if (firstLand) {
        n = placeDots(pts, 0, splitIdx, SPACING, (t * FLOW_SPEED) % SPACING, DOT_SIZE, mainColor, n, dots)
      }
      n = placeDots(pts, splitIdx, lastIdx, firstLand ? SPACING_ROLL : SPACING, (t * FLOW_SPEED) % (firstLand ? SPACING_ROLL : SPACING), firstLand ? DOT_SIZE_ROLL : DOT_SIZE, mainColor, n, dots)

      // Zona de llegada: solo si se detiene sola (sin choque ni salirse).
      if (!r.contact && !r.out && r.end) {
        const sx = firstLand ? firstLand.x : pts[0]
        const sz = firstLand ? firstLand.z : pts[2]
        const roll = Math.hypot(r.end.x - sx, r.end.z - sz)
        placeZone(i * 2, r.end.x, r.end.z, Math.max(r.radius * 1.3, ZONE_BASE + ZONE_K * roll), WHITE, 0.85)
      }

      // La otra esfera, si hay choque: su recorrido y su zona, en su color.
      if (r.next) {
        tmp.c.set(r.next.color || '#ffffff')
        n = placeDots(r.next.points, 0, -1, SPACING_ROLL, (t * FLOW_SPEED) % SPACING_ROLL, DOT_SIZE_NEXT, tmp.c, n, dots)
        if (!r.next.out && r.next.end) {
          const np = r.next.points
          const roll = Math.hypot(r.next.end.x - np[0], r.next.end.z - np[2])
          placeZone(i * 2 + 1, r.next.end.x, r.next.end.z, Math.max(r.next.radius * 1.3, ZONE_BASE + ZONE_K * roll), tmp.c, 0.9)
        }
      }

      // Dónde cae y dónde rebota: aros acostados en el piso.
      for (let b = 0; b < MAX_BOUNCES; b += 1) {
        const lr = landRefs.current[i * MAX_BOUNCES + b]
        if (!lr) continue
        const L = landings[b]
        lr.visible = !!L
        if (!L) continue
        lr.position.set(L.x, 0.03, L.z)
        const pulse = b === 0 ? 0.08 * Math.sin(t * 7 + i) : 0
        lr.scale.setScalar(Math.max(r.radius, MARK_MIN_R) * (BOUNCE_SCALE[b] + pulse))
        const mats = landMatRefs.current[i * MAX_BOUNCES + b]
        if (mats) for (const m of mats) if (m) m.opacity = BOUNCE_OPACITY[b]
      }
    }
    for (let k = Math.min(res.length, MAX_RINGS) * MAX_BOUNCES; k < MAX_RINGS * MAX_BOUNCES; k += 1) {
      const lr = landRefs.current[k]
      if (lr) lr.visible = false
    }
    dots.count = n
    dots.instanceMatrix.needsUpdate = true
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true

    // Aros fantasma: dónde se tocarían las esferas, de frente a la cámara.
    const cam = state.camera
    for (let i = 0; i < MAX_RINGS; i += 1) {
      const ring = ringRefs.current[i]
      if (!ring) continue
      const c = res[i]?.contact || null
      ring.visible = !!c
      if (!c) continue
      ring.position.set(c.x, c.y, c.z)
      ring.quaternion.copy(cam.quaternion)
      const pulse = 1 + 0.06 * Math.sin(t * 9 + i)
      ring.scale.setScalar(c.radius * pulse)
      const mat = ringMatRefs.current[i]
      if (mat) mat.color.copy(mainColor)
    }
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
          key={i}
          ref={(el) => { ringRefs.current[i] = el }}
          geometry={ringGeo}
          visible={false}
          frustumCulled={false}
          renderOrder={6}
        >
          <meshBasicMaterial
            ref={(el) => { ringMatRefs.current[i] = el }}
            color="#22d3ee"
            transparent
            opacity={0.9}
            depthWrite={false}
            depthTest={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}
