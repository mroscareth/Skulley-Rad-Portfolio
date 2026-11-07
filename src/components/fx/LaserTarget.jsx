import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Mira del LÁSER en el piso, con el lenguaje de KickTrajectory: blanco, fino y
// acostado sobre el piso (el cian se pierde en el piso azul). Va en el piso de verdad,
// redonda como los portales, porque ahí es donde sale la explosión (Oscar).
//
// Un aro fijo marca dónde va a caer y cuatro arcos giran alrededor: arrancan
// lejos y se cierran sobre el aro con la carga, así que la carga se lee en la
// mira y no hace falta bajar la vista a la barra. Con la carga llena late.
//
// Todo por refs en el useFrame: cero re-renders. Se dibuja apagada hasta que la escena
// se pinte de verdad, para que su material no se compile a media partida. Solo se ve
// desde arriba: sin doble cara, three no la dibuja dos veces ni recompila su variante.

const FLOOR_Y = 0.045
const RING_RADIUS = 0.62
const TICKS_OPEN = 0.64     // lo que se abren los arcos sin carga, en veces el radio del aro
const TICKS_GAP = 0.08      // y el aire que les queda con el aro con la carga llena
const TICK_ARC = Math.PI / 4
const FADE_LAMBDA = 18
const CAM_NEAR = 15.5       // profundidad de Skulley en la cámara: de ahí en adelante crece
const SIN_NEAR = 0.62       // qué tan de arriba ve la cámara el piso a esa profundidad
const LINE_NEAR = 0.1       // grosor de la línea de cerca, en parte del radio
const LINE_MAX = 0.4        // y lo más gorda que se pone a lo lejos
const TICK_LINE = 0.7       // los arcos, en veces la línea del aro
const FAR_GLOW = 0.6        // brillo de más a lo lejos: la orilla de la pantalla la oscurece

const flat = (g) => { g.rotateX(-Math.PI / 2); return g }

// Mueve el borde de adentro de un aro acostado para que mida `width` de ancho.
function setLineWidth(geo, width) {
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r > 0.995) continue
    pos.setX(i, x * (1 - width) / r)
    pos.setZ(i, z * (1 - width) / r)
  }
  pos.needsUpdate = true
}

export default function LaserTarget({ aimRef, chargeRef }) {
  const groupRef = useRef(null)
  const ticksRef = useRef(null)
  const dotRef = useRef(null)
  const stateRef = useRef({ show: 0, warmed: false, line: LINE_NEAR })
  const tmp = useMemo(() => ({ forward: new THREE.Vector3(), toMira: new THREE.Vector3() }), [])

  const geos = useMemo(() => {
    const arcs = [0, 1, 2, 3].map((i) => new THREE.RingGeometry(
      0.93, 1, 24, 1, i * Math.PI / 2 - TICK_ARC / 2, TICK_ARC,
    ))
    const ticks = flat(mergeGeometries(arcs))
    arcs.forEach((g) => g.dispose())
    return {
      ring: flat(new THREE.RingGeometry(0.9, 1, 64)),
      disc: flat(new THREE.CircleGeometry(1, 48)),
      dot: flat(new THREE.CircleGeometry(0.08, 20)),
      ticks,
    }
  }, [])
  const mats = useMemo(() => {
    const make = () => new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    })
    return { line: make(), disc: make() }
  }, [])
  useEffect(() => () => {
    try {
      Object.values(geos).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    } catch { }
  }, [geos, mats])

  useFrame((state, delta) => {
    const group = groupRef.current
    const a = aimRef.current
    if (!group || !a) return
    const s = stateRef.current
    s.show += ((a.on ? 1 : 0) - s.show) * (1 - Math.exp(-FADE_LAMBDA * Math.min(delta, 0.05)))
    if (!a.on && s.show < 0.004) s.show = 0
    group.visible = s.show > 0 || !s.warmed
    if (!group.visible) return

    const c = THREE.MathUtils.clamp(chargeRef.current, 0, 1)
    const t = state.clock.getElapsedTime()
    const full = c >= 0.995
    group.position.set(a.x, a.y + FLOOR_Y, a.z)
    // De lejos crece para no perderse. Con la profundidad y no con la distancia: si no,
    // también crecería al irse a los lados de la pantalla.
    const { camera } = state
    camera.getWorldDirection(tmp.forward)
    const depth = tmp.toMira.subVectors(group.position, camera.position).dot(tmp.forward)
    group.scale.setScalar(RING_RADIUS * Math.max(1, depth / CAM_NEAR) * (full ? 1 + 0.05 * Math.sin(t * 11) : 1))
    // El piso visto de lado se come lo alto de las líneas: engordan lo que se aplasta.
    const sin = Math.max(tmp.toMira.y / -tmp.toMira.length(), 0.01)
    const line = THREE.MathUtils.clamp(LINE_NEAR * SIN_NEAR / sin, LINE_NEAR, LINE_MAX)
    if (Math.abs(line - s.line) > 0.004) {
      s.line = line
      setLineWidth(geos.ring, line)
      setLineWidth(geos.ticks, line * TICK_LINE)
      dotRef.current?.scale.setScalar(line / LINE_NEAR)
      mats.line.color.setScalar(1 + FAR_GLOW * (line - LINE_NEAR) / (LINE_MAX - LINE_NEAR))
    }

    const ticks = ticksRef.current
    if (ticks) {
      // Más gorda la línea, más afuera se quedan: si no, se encima con el aro.
      const closed = (1 + TICKS_GAP) / (1 - s.line * TICK_LINE)
      ticks.scale.setScalar(closed + TICKS_OPEN * (1 - Math.pow(c, 0.7)))
      ticks.rotation.y = t * (0.6 + 2.6 * c)
    }
    mats.line.opacity = s.show * (0.75 + 0.25 * c)
    mats.disc.opacity = s.show * (0.06 + 0.08 * c)
  })

  const mesh = { frustumCulled: false, raycast: () => null }

  return (
    <group ref={groupRef}>
      <mesh {...mesh} geometry={geos.disc} material={mats.disc} renderOrder={4} onAfterRender={() => { stateRef.current.warmed = true }} />
      <mesh {...mesh} geometry={geos.ring} material={mats.line} position={[0, 0.002, 0]} renderOrder={5} />
      <mesh {...mesh} ref={ticksRef} geometry={geos.ticks} material={mats.line} position={[0, 0.002, 0]} renderOrder={5} />
      <mesh {...mesh} ref={dotRef} geometry={geos.dot} material={mats.line} position={[0, 0.003, 0]} renderOrder={5} />
    </group>
  )
}
