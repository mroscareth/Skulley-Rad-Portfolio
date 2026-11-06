import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Mira del LÁSER en el piso, con el lenguaje de KickTrajectory: blanco, fino y
// acostado sobre el piso (el cian se pierde en el piso azul).
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
const TICKS_FROM = 1.8      // radio de los arcos sin carga, en veces el del aro
const TICKS_TO = 1.16       // y con la carga llena
const TICK_ARC = Math.PI / 4
const FADE_LAMBDA = 18

const flat = (g) => { g.rotateX(-Math.PI / 2); return g }

export default function LaserTarget({ aimRef, chargeRef }) {
  const groupRef = useRef(null)
  const ticksRef = useRef(null)
  const stateRef = useRef({ show: 0, warmed: false })

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
    group.scale.setScalar(RING_RADIUS * (full ? 1 + 0.05 * Math.sin(t * 11) : 1))

    const ticks = ticksRef.current
    if (ticks) {
      ticks.scale.setScalar(TICKS_FROM + (TICKS_TO - TICKS_FROM) * Math.pow(c, 0.7))
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
      <mesh {...mesh} geometry={geos.dot} material={mats.line} position={[0, 0.003, 0]} renderOrder={5} />
    </group>
  )
}
