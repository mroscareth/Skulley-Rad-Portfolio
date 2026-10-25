import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Trayectoria de la PATADA mientras cargas, como en el billar.
//
// No es una curva inventada: cada frame le pide a HomeOrbs (predictKick) que
// simule, con la misma física del juego, qué esferas golpearías si soltaras
// AHORA con esta carga. Se dibuja:
//   - el recorrido de cada esfera golpeada: puntos que fluyen hacia donde va,
//     con sus rebotes (por eso ondula),
//   - un aro "fantasma" donde chocaría con otra esfera,
//   - y la salida de esa otra esfera, con puntos de su color.
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

export default function KickTrajectory({ chargeRef, anchorRef, yawRef, reachRef, predictRef, strengthFor, halfAngle }) {
  const dotsRef = useRef(null)
  const ringRefs = useRef([])
  const ringMatRefs = useRef([])
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
  useEffect(() => () => { try { dotGeo.dispose(); ringGeo.dispose() } catch { } }, [dotGeo, ringGeo])
  // Colores por punto desde el montaje: si el atributo nace en la primera
  // carga, el material se recompila justo ahí y se nota un tirón.
  useEffect(() => {
    const dots = dotsRef.current
    if (dots && !dots.instanceColor) {
      dots.setColorAt(0, COLOR)
      dots.count = 0
    }
  }, [])

  // Coloca puntos a lo largo de una polilínea, cada `spacing` de recorrido,
  // desfasados por `phase` para que parezca que fluyen.
  const placeDots = (pts, spacing, phase, size, color, startIdx, mesh) => {
    let idx = startIdx
    if (!pts || pts.length < 6) return idx
    let total = 0
    for (let i = 3; i < pts.length; i += 3) {
      total += Math.hypot(pts[i] - pts[i - 3], pts[i + 1] - pts[i - 2], pts[i + 2] - pts[i - 1])
    }
    if (total < 1e-3) return idx
    let target = phase
    let walked = 0
    for (let i = 3; i < pts.length && idx < MAX_DOTS; i += 3) {
      const ax = pts[i - 3], ay = pts[i - 2], az = pts[i - 1]
      const bx = pts[i], by = pts[i + 1], bz = pts[i + 2]
      const seg = Math.hypot(bx - ax, by - ay, bz - az)
      while (target <= walked + seg && idx < MAX_DOTS) {
        const t = seg > 1e-6 ? (target - walked) / seg : 0
        tmp.p.set(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)
        // Se adelgazan hacia el final: se lee la dirección sin flecha.
        const k = size * (1 - 0.5 * (target / total))
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
      n = placeDots(r.points, SPACING, (t * FLOW_SPEED) % SPACING, DOT_SIZE, mainColor, n, dots)
      if (r.next) {
        tmp.c.set(r.next.color || '#ffffff')
        n = placeDots(r.next.points, SPACING_NEXT, (t * FLOW_SPEED) % SPACING_NEXT, DOT_SIZE_NEXT, tmp.c, n, dots)
      }
    }
    dots.count = n
    dots.instanceMatrix.needsUpdate = true
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true

    // Aros fantasma: dónde se tocarían las esferas, de frente a la cámara.
    const cam = state.camera
    for (let i = 0; i < MAX_RINGS; i += 1) {
      const ring = ringRefs.current[i]
      if (!ring) continue
      const c = res[i]?.contact
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
