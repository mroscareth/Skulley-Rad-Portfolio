import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// El RAYO del láser y lo que deja en el piso.
//
// Va de la esfera a la mira en tres bandas duras, sin degradados: afuera el color de
// la esfera, en medio ese color aclarado y al centro blanco. Son tres cilindros planos
// (MeshBasicMaterial): sin shader propio no hay nada que compilar a media partida, y
// el resplandor lo pone el Bloom del sitio, porque van por encima de 1.
//
// El brillo del impacto también es falso, un disco y un aro en el piso: una luz nueva
// recompilaría todos los materiales de la escena.
//
// Todo por refs en el useFrame: cero re-renders. Los primeros cuadros se dibuja
// apagado para que sus materiales no se compilen en el primer disparo.

const UP = new THREE.Vector3(0, 1, 0)
const WHITE = new THREE.Color('#ffffff')
const RADIUS_MIN = 0.07
const RADIUS_MAX = 0.24
// Radio de cada banda respecto al rayo, cuánto va hacia el blanco y cuánto pasa de 1.
const BANDS = [
  { radius: 1, white: 0, hdr: 1.3 },
  { radius: 0.56, white: 0.22, hdr: 1.25 },
  { radius: 0.2, white: 1, hdr: 1.6 },
]
const FLOOR_Y = 0.05
const MARK_TIME = 1.6       // cuánto se queda la marca después del rayo
const RING_TIME = 0.5

const flat = (g) => { g.rotateX(-Math.PI / 2); return g }
const easeOut = (x) => 1 - Math.pow(1 - x, 3)
const clamp01 = (x) => Math.max(0, Math.min(1, x))

export default function LaserBeam({ shotRef, aimRef, travel }) {
  const beamRef = useRef(null)
  const bandRefs = useRef([])
  const markRef = useRef(null)
  const scorchRef = useRef(null)
  const discRef = useRef(null)
  const ringRef = useRef(null)
  const stateRef = useRef({ frames: 0, id: -1 })
  const tmp = useMemo(() => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), dir: new THREE.Vector3() }), [])

  const geos = useMemo(() => {
    const beam = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true)
    beam.translate(0, 0.5, 0)
    return {
      beam,
      disc: flat(new THREE.CircleGeometry(1, 48)),
      ring: flat(new THREE.RingGeometry(0.86, 1, 72)),
    }
  }, [])
  const mats = useMemo(() => {
    const make = (color = '#ffffff') => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    })
    return { bands: BANDS.map(() => make()), scorch: make('#000000'), disc: make(), ring: make() }
  }, [])
  useEffect(() => () => {
    try {
      Object.values(geos).forEach((g) => g.dispose())
      mats.bands.forEach((m) => m.dispose())
      ;[mats.scorch, mats.disc, mats.ring].forEach((m) => m.dispose())
    } catch { }
  }, [geos, mats])

  useFrame((state, delta) => {
    const beam = beamRef.current
    const mark = markRef.current
    const shot = shotRef.current
    const aim = aimRef.current
    if (!beam || !mark || !shot || !aim) return
    const s = stateRef.current
    s.frames += 1
    const warming = s.frames < 3
    if (shot.on) shot.t += Math.min(delta, 0.05)
    const t = shot.t
    const firing = shot.on && t < shot.dur

    // El color se fija en cada disparo: es el de la esfera en ese momento.
    if (shot.id !== s.id) {
      s.id = shot.id
      BANDS.forEach((band, i) => {
        mats.bands[i].color.copy(shot.color).lerp(WHITE, band.white).multiplyScalar(band.hdr)
      })
      mats.disc.color.copy(shot.color).multiplyScalar(1.3)
      mats.ring.color.copy(shot.color).lerp(WHITE, 0.5).multiplyScalar(1.5)
    }

    beam.visible = firing || warming
    if (firing) {
      const { from, to, dir } = tmp
      from.set(aim.ex, aim.ey, aim.ez)
      to.set(shot.x, shot.y + FLOOR_Y, shot.z)
      dir.subVectors(to, from)
      const len = dir.length()
      if (len > 1e-3) {
        dir.multiplyScalar(1 / len)
        beam.position.copy(from)
        beam.quaternion.setFromUnitVectors(UP, dir)
        // Entra pasado de ancho, se asienta y al final se adelgaza hasta apagarse.
        const punch = 1 + 0.35 * (1 - clamp01(t / 0.12))
        const fade = clamp01((shot.dur - t) / (shot.dur * 0.4))
        const width = (RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * shot.power) * punch * (0.15 + 0.85 * fade)
        const time = state.clock.getElapsedTime()
        const reach = len * clamp01(t / travel)
        BANDS.forEach((band, i) => {
          const el = bandRefs.current[i]
          if (!el) return
          const r = width * band.radius * (1 + 0.1 * Math.sin(time * 70 + i * 2.1))
          el.scale.set(r, reach, r)
          mats.bands[i].opacity = 1
        })
      }
    } else if (warming) {
      mats.bands.forEach((m) => { m.opacity = 0 })
    }

    const since = t - travel
    const marking = shot.on && since >= 0
    mark.visible = marking || warming
    if (marking) {
      const after = t - shot.dur
      const p = shot.power
      mark.position.set(shot.x, shot.y + FLOOR_Y, shot.z)
      scorchRef.current?.scale.setScalar(0.7 + 0.9 * p)
      mats.scorch.opacity = 0.42 * clamp01((MARK_TIME - after) / 0.8)
      discRef.current?.scale.setScalar((0.4 + 0.55 * p) * (firing ? 1 + 0.1 * Math.sin(t * 60) : 1))
      mats.disc.opacity = firing ? 0.8 : 0.8 * clamp01(1 - after / 0.14)
      const k = clamp01(since / RING_TIME)
      ringRef.current?.scale.setScalar(0.5 + (0.5 + 3.5 * p) * easeOut(k))
      mats.ring.opacity = 1 - k
    } else if (warming) {
      mats.scorch.opacity = 0
      mats.disc.opacity = 0
      mats.ring.opacity = 0
    }

    if (shot.on && t >= shot.dur + MARK_TIME) shot.on = false
  })

  const mesh = { frustumCulled: false, raycast: () => null }

  return (
    <>
      <group ref={beamRef}>
        {BANDS.map((_, i) => (
          <mesh
            {...mesh}
            key={i}
            ref={(el) => { bandRefs.current[i] = el }}
            geometry={geos.beam}
            material={mats.bands[i]}
            scale={[0.001, 0.001, 0.001]}
            renderOrder={6 + i}
          />
        ))}
      </group>
      <group ref={markRef}>
        <mesh {...mesh} ref={scorchRef} geometry={geos.disc} material={mats.scorch} renderOrder={3} />
        <mesh {...mesh} ref={discRef} geometry={geos.disc} material={mats.disc} position={[0, 0.002, 0]} renderOrder={4} />
        <mesh {...mesh} ref={ringRef} geometry={geos.ring} material={mats.ring} position={[0, 0.004, 0]} renderOrder={5} />
      </group>
    </>
  )
}
