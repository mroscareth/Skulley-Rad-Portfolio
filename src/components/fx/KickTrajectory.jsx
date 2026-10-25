import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Trayectoria de la PATADA mientras cargas, como en el billar.
//
// No es una curva inventada: cada frame le pide a HomeOrbs (predictKick) que
// simule, con la misma física del juego, qué esferas golpearías si soltaras
// AHORA con esta carga. Se dibuja el FUTURO INMEDIATO, no el tiro entero:
//   - por dónde va cada esfera golpeada durante los próximos HORIZON
//     segundos (puntos que fluyen hacia donde va). Con poca carga casi
//     siempre se ve hasta dónde llega; con mucha, solo el arranque y la
//     dirección, y el resto lo calcula quien juega. Ese número es la
//     dificultad: ayudar sin regalar el tiro (Oscar, 2026-10-24).
//   - un aro en el piso donde CAE, solo si de verdad iba volando (subió más
//     de FLIGHT_MIN). Antes se marcaba cualquier toque de piso y la mayoría
//     eran brinquitos de 2 cm que no se ven: el indicador decía "rebota"
//     y la esfera parecía rodar.
//   - si choca dentro del horizonte, un aro "fantasma" donde se tocan y la
//     salida de la otra esfera, con puntos de su color.
// Lo que se mueva entre que la ves y sueltas (otras esferas rodando, la
// maldita) puede cambiar el resultado: es una guía, como en el billar.
//
// Todo por refs en el useFrame: cero re-renders.

const COLOR = new THREE.Color('#22d3ee')
const COLOR_FULL = new THREE.Color('#d8fbff')
const MAX_DOTS = 240
const MAX_RINGS = 3
const SPACING = 0.34        // separación entre puntos, en unidades de mundo
const SPACING_NEXT = 0.3
const FLOW_SPEED = 1.1      // u/s: los puntos avanzan hacia donde va la esfera
const DOT_SIZE = 0.08
const DOT_SIZE_NEXT = 0.065
const HORIZON = 1.2         // s de futuro que enseña la línea: la perilla de dificultad
const NEXT_HORIZON = 0.6    // s de la otra esfera tras el choque: solo hacia dónde sale
const FLIGHT_MIN = 0.3      // u que tiene que subir para que su caída se marque
const MAX_BOUNCES = 3       // caídas visibles que se marcan por esfera
// Cada caída se marca un poco más chica y más tenue: se lee cómo pierde
// fuerza. Blanco y delgado: el cian se perdía en el piso azul y un aro
// grueso con contorno se veía tosco.
const BOUNCE_SCALE = [1.3, 1.1, 0.92]
const BOUNCE_OPACITY = [1, 0.85, 0.7]
const MARK_MIN_R = 0.28     // las esferas chicas también dejan una marca visible

export default function KickTrajectory({ chargeRef, anchorRef, yawRef, reachRef, predictRef, strengthFor, halfAngle }) {
  const dotsRef = useRef(null)
  const ringRefs = useRef([])
  const ringMatRefs = useRef([])
  const landRefs = useRef([])
  const landMatRefs = useRef([]) // por marca: [aro, punto]
  const groupRef = useRef(null)
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
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.86, 1, 48), [])
  // Marca de caída, acostada en el piso: aro blanco fino y un punto chico
  // al centro ("aquí pega").
  const landGeos = useMemo(() => {
    const flat = (g) => { g.rotateX(-Math.PI / 2); return g }
    return {
      ring: flat(new THREE.RingGeometry(0.88, 1, 64)),
      dot: flat(new THREE.CircleGeometry(0.09, 20)),
    }
  }, [])
  useEffect(() => () => {
    try {
      dotGeo.dispose(); ringGeo.dispose()
      landGeos.ring.dispose(); landGeos.dot.dispose()
    } catch { }
  }, [dotGeo, ringGeo, landGeos])
  // Colores por punto desde el montaje: si el atributo nace en la primera
  // carga, el material se recompila justo ahí y se nota un tirón.
  useEffect(() => {
    const dots = dotsRef.current
    if (dots && !dots.instanceColor) {
      dots.setColorAt(0, COLOR)
      dots.count = 0
    }
  }, [])

  // Último punto que cae dentro de los primeros `limit` segundos.
  const indexAtTime = (times, limit) => {
    if (!times || !times.length) return -1
    let lo = 0
    let hi = times.length - 1
    if (times[hi] <= limit) return hi
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (times[mid] <= limit) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  // Coloca puntos a lo largo de una polilínea, cada `spacing` de recorrido,
  // desfasados por `phase` para que parezca que fluyen.
  const placeDots = (pts, spacing, phase, size, color, startIdx, mesh, cutIdx = -1, maxLen = Infinity) => {
    let idx = startIdx
    if (!pts || pts.length < 6) return idx
    // Largo hasta el corte (la caída) y largo total que se dibuja.
    let total = 0
    let cutLen = -1
    for (let i = 3; i < pts.length; i += 3) {
      total += Math.hypot(pts[i] - pts[i - 3], pts[i + 1] - pts[i - 2], pts[i + 2] - pts[i - 1])
      if (cutIdx >= 0 && i / 3 === cutIdx) cutLen = total
    }
    const drawn = Math.min(total, cutLen >= 0 ? cutLen : maxLen)
    if (drawn < 1e-3) return idx
    let target = phase
    let walked = 0
    for (let i = 3; i < pts.length && idx < MAX_DOTS && target <= drawn; i += 3) {
      const ax = pts[i - 3], ay = pts[i - 2], az = pts[i - 1]
      const bx = pts[i], by = pts[i + 1], bz = pts[i + 2]
      const seg = Math.hypot(bx - ax, by - ay, bz - az)
      while (target <= walked + seg && target <= drawn && idx < MAX_DOTS) {
        const t = seg > 1e-6 ? (target - walked) / seg : 0
        tmp.p.set(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)
        // Se adelgazan hacia el final: se lee la dirección sin flecha.
        const k = size * (1 - 0.35 * Math.min(1, target / Math.max(1e-3, drawn)))
        tmp.s.set(k, k, k)
        tmp.m.compose(tmp.p, tmp.q, tmp.s)
        mesh.setMatrixAt(idx, tmp.m)
        mesh.setColorAt(idx, color)
        idx += 1
        target += spacing
      }
      walked += seg
    }
    return idx
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
    for (let i = 0; i < res.length; i += 1) {
      const r = res[i]
      // La línea enseña los próximos HORIZON segundos (o hasta el choque o
      // hasta que se detiene, si pasa antes).
      n = placeDots(r.points, SPACING, (t * FLOW_SPEED) % SPACING, DOT_SIZE, mainColor, n, dots, indexAtTime(r.times, HORIZON))
      const hitInView = r.contact && r.contactT >= 0 && r.contactT <= HORIZON
      if (r.next && hitInView) {
        tmp.c.set(r.next.color || '#ffffff')
        n = placeDots(r.next.points, SPACING_NEXT, (t * FLOW_SPEED) % SPACING_NEXT, DOT_SIZE_NEXT, tmp.c, n, dots, indexAtTime(r.next.times, NEXT_HORIZON))
      }
      // Solo las caídas que se ven: venía volando y pasa dentro del horizonte.
      const landings = (r.landings || []).filter((L) => L.apex >= FLIGHT_MIN && L.t <= HORIZON)
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
    for (let k = res.length * MAX_BOUNCES; k < MAX_RINGS * MAX_BOUNCES; k += 1) {
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
      const ri = res[i]
      const c = ri && ri.contact && ri.contactT >= 0 && ri.contactT <= HORIZON ? ri.contact : null
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

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh ref={dotsRef} args={[dotGeo, undefined, MAX_DOTS]} frustumCulled={false} renderOrder={5}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.92} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {Array.from({ length: MAX_RINGS * MAX_BOUNCES }).map((_, i) => {
        const setMat = (k) => (el) => {
          if (!landMatRefs.current[i]) landMatRefs.current[i] = []
          landMatRefs.current[i][k] = el
        }
        const matProps = { transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }
        return (
          <group key={`land-${i}`} ref={(el) => { landRefs.current[i] = el }} visible={false}>
            <mesh geometry={landGeos.ring} frustumCulled={false} renderOrder={5}>
              <meshBasicMaterial ref={setMat(0)} color="#ffffff" {...matProps} />
            </mesh>
            <mesh geometry={landGeos.dot} position={[0, 0.003, 0]} frustumCulled={false} renderOrder={5}>
              <meshBasicMaterial ref={setMat(1)} color="#ffffff" {...matProps} />
            </mesh>
          </group>
        )
      })}
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
