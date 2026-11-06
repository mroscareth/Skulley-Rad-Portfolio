import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// El RAYO del láser y la explosión donde cae.
//
// El rayo va de la esfera a la mira en tres bandas duras, sin degradados: afuera el
// color de la esfera, en medio ese color aclarado y al centro blanco. Son cilindros
// planos (MeshBasicMaterial): sin shader propio no hay nada que compilar a media
// partida, y el resplandor lo pone el Bloom del sitio, porque van por encima de 1.
//
// Al llegar al piso explota, como nube de cómic y no como partículas (en el piso azul
// las chispas verdes se pierden):
//   - una nube de bolas con contorno negro, como las esferas del juego. Cada una brota,
//     pasa por blanco, claro, color y oscuro en saltos duros, y se encoge;
//   - una estrella de impacto acostada en el piso, de un cuadro de historieta;
//   - un aro que llega justo hasta donde alcanza el empujón a las esferas;
//   - una marca quemada que se queda un rato.
// El brillo es falso, sin luces: una luz nueva recompilaría toda la escena.
//
// Todo por refs en el useFrame: cero re-renders. Se dibuja apagado hasta que la escena
// se pinte de verdad, para que sus materiales no se compilen en el primer disparo. Contar
// cuadros no sirve: al montarse, el preloader todavía tapa la escena y nada se dibuja.
// Solo se ve desde arriba, así que nada lleva doble cara: three dibujaría dos veces cada
// malla transparente y recompilaría su variante.

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
const STAR_TIME = 0.34
const PUFFS = 16
const PUFF_DELAY = 0.14     // las bolas no brotan todas juntas
const PUFF_LIFE = [0.42, 0.62]
const BLAST_TIME = PUFF_DELAY + PUFF_LIFE[1]
const OUTLINE = 0.05        // grosor del contorno de la nube
const STAR_SPIKES = [1, 0.74, 0.92, 0.68, 1, 0.8, 0.7, 0.96, 0.72, 0.88, 1, 0.7, 0.84]

// Tamaño de la nube según la carga: de un chispazo a la altura de Skulley.
const blastSize = (power) => 0.9 + 2.1 * power

const flat = (g) => { g.rotateX(-Math.PI / 2); return g }
const easeOut = (x) => 1 - Math.pow(1 - x, 3)
const clamp01 = (x) => Math.max(0, Math.min(1, x))

function starGeometry() {
  const shape = new THREE.Shape()
  const n = STAR_SPIKES.length
  for (let i = 0; i < n * 2; i += 1) {
    const a = (i / (n * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? STAR_SPIKES[i / 2] : 0.44
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return flat(new THREE.ShapeGeometry(shape))
}

export default function LaserBeam({ shotRef, aimRef, travel }) {
  const beamRef = useRef(null)
  const bandRefs = useRef([])
  const markRef = useRef(null)
  const scorchRef = useRef(null)
  const discRef = useRef(null)
  const ringRef = useRef(null)
  const starRef = useRef(null)
  const puffsRef = useRef(null)
  const outlineRef = useRef(null)
  const stateRef = useRef({ warmed: false, id: -1 })
  const seeds = useMemo(() => Array.from({ length: PUFFS }, () => ({ x: 0, y: 0, z: 0, r: 0, delay: 0, life: 1 })), [])
  const tmp = useMemo(() => ({
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    size: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    matrix: new THREE.Matrix4(),
    palette: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()],
  }), [])

  const geos = useMemo(() => {
    const beam = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true)
    beam.translate(0, 0.5, 0)
    return {
      beam,
      puff: new THREE.IcosahedronGeometry(1, 2),
      star: starGeometry(),
      disc: flat(new THREE.CircleGeometry(1, 48)),
      ring: flat(new THREE.RingGeometry(0.93, 1, 96)),
    }
  }, [])
  const mats = useMemo(() => {
    const make = (color = '#ffffff') => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    })
    return {
      bands: BANDS.map(() => make()),
      scorch: make('#000000'),
      disc: make(),
      ring: make(),
      star: make(),
      starCore: make(),
      puff: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      outline: new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide, toneMapped: false }),
    }
  }, [])
  useEffect(() => () => {
    try {
      Object.values(geos).forEach((g) => g.dispose())
      Object.values(mats).flat().forEach((m) => m.dispose())
    } catch { }
  }, [geos, mats])

  // Colores por bola desde el montaje: si el atributo nace en el primer disparo, el
  // material se recompila justo ahí. Arrancan en tamaño cero.
  useEffect(() => {
    const puffs = puffsRef.current
    const outline = outlineRef.current
    if (!puffs || !outline) return
    tmp.size.setScalar(0)
    tmp.matrix.compose(tmp.pos.set(0, 0, 0), tmp.quat, tmp.size)
    for (let i = 0; i < PUFFS; i += 1) {
      puffs.setMatrixAt(i, tmp.matrix)
      outline.setMatrixAt(i, tmp.matrix)
      puffs.setColorAt(i, WHITE)
    }
    puffs.onAfterRender = () => { stateRef.current.warmed = true }
  }, [tmp])

  useFrame((state, delta) => {
    const beam = beamRef.current
    const mark = markRef.current
    const puffs = puffsRef.current
    const outline = outlineRef.current
    const shot = shotRef.current
    const aim = aimRef.current
    if (!beam || !mark || !puffs || !outline || !shot || !aim) return
    const s = stateRef.current
    const warming = !s.warmed
    if (shot.on) shot.t += Math.min(delta, 0.05)
    const t = shot.t
    const firing = shot.on && t < shot.dur

    // Cada disparo fija su color, el de la esfera en ese momento, y su propia nube.
    if (shot.id !== s.id) {
      s.id = shot.id
      BANDS.forEach((band, i) => {
        mats.bands[i].color.copy(shot.color).lerp(WHITE, band.white).multiplyScalar(band.hdr)
      })
      mats.disc.color.copy(shot.color).multiplyScalar(1.3)
      mats.ring.color.copy(shot.color).lerp(WHITE, 0.5).multiplyScalar(1.5)
      mats.star.color.copy(shot.color).multiplyScalar(1.3)
      mats.starCore.color.copy(shot.color).lerp(WHITE, 0.75).multiplyScalar(1.5)
      tmp.palette[0].copy(WHITE).multiplyScalar(1.6)
      tmp.palette[1].copy(shot.color).lerp(WHITE, 0.28).multiplyScalar(1.1)
      tmp.palette[2].copy(shot.color).multiplyScalar(1.15)
      tmp.palette[3].copy(shot.color).multiplyScalar(0.28)
      if (starRef.current) starRef.current.rotation.y = Math.random() * Math.PI * 2
      seeds.forEach((seed, i) => {
        // La primera va al centro: sin ella la nube sale hueca con pocas bolas.
        const a = Math.random() * Math.PI * 2
        const d = i === 0 ? 0 : Math.sqrt(Math.random()) * 0.78
        seed.x = Math.cos(a) * d
        seed.z = Math.sin(a) * d
        seed.y = i === 0 ? 0.2 : 0.08 + Math.random() * 0.6
        seed.r = i === 0 ? 0.62 : 0.24 + Math.random() * 0.3
        seed.delay = i === 0 ? 0 : Math.random() * PUFF_DELAY
        seed.life = PUFF_LIFE[0] + Math.random() * (PUFF_LIFE[1] - PUFF_LIFE[0])
      })
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
    const size = blastSize(shot.power)

    const blasting = shot.on && since >= 0 && since < BLAST_TIME
    puffs.visible = blasting || warming
    outline.visible = blasting || warming
    if (blasting) {
      for (let i = 0; i < PUFFS; i += 1) {
        const seed = seeds[i]
        const local = (since - seed.delay) / seed.life
        let radius = 0
        let grow = 0
        if (local > 0 && local < 1) {
          grow = easeOut(clamp01(local / 0.3))
          const shrink = local > 0.55 ? 1 - Math.pow((local - 0.55) / 0.45, 2) : 1
          radius = seed.r * size * grow * shrink
          // El blanco es solo el destello: casi toda la vida va del color de la esfera.
          const step = local < 0.08 ? 0 : local < 0.2 ? 1 : local < 0.76 ? 2 : 3
          puffs.setColorAt(i, tmp.palette[step])
        }
        // Las bolas se abren desde el centro y suben un poco al apagarse.
        const open = 0.35 + 0.65 * grow
        tmp.pos.set(
          shot.x + seed.x * size * open,
          shot.y + seed.y * size * open + 0.25 * size * clamp01(local),
          shot.z + seed.z * size * open,
        )
        tmp.matrix.compose(tmp.pos, tmp.quat, tmp.size.setScalar(radius))
        puffs.setMatrixAt(i, tmp.matrix)
        tmp.matrix.compose(tmp.pos, tmp.quat, tmp.size.setScalar(radius > 0 ? radius + OUTLINE : 0))
        outline.setMatrixAt(i, tmp.matrix)
      }
      puffs.instanceMatrix.needsUpdate = true
      outline.instanceMatrix.needsUpdate = true
      if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true
    }

    const marking = shot.on && since >= 0
    mark.visible = marking || warming
    if (marking) {
      const after = t - shot.dur
      const p = shot.power
      mark.position.set(shot.x, shot.y + FLOOR_Y, shot.z)
      // La marca sale debajo de la nube, no antes que ella.
      scorchRef.current?.scale.setScalar(size * 0.9 * easeOut(clamp01(since / 0.2)))
      mats.scorch.opacity = 0.42 * clamp01((MARK_TIME - after) / 0.8)
      discRef.current?.scale.setScalar((0.4 + 0.55 * p) * (firing ? 1 + 0.1 * Math.sin(t * 60) : 1))
      mats.disc.opacity = firing ? 0.8 : 0.8 * clamp01(1 - after / 0.14)
      const k = clamp01(since / RING_TIME)
      ringRef.current?.scale.setScalar(0.5 + (shot.radius - 0.5) * easeOut(k))
      mats.ring.opacity = 1 - k
      const kStar = clamp01(since / STAR_TIME)
      starRef.current?.scale.setScalar(size * 1.55 * easeOut(clamp01(since / 0.1)))
      const starFade = clamp01((1 - kStar) / 0.4)
      mats.star.opacity = starFade
      mats.starCore.opacity = starFade
    } else if (warming) {
      mats.scorch.opacity = 0
      mats.disc.opacity = 0
      mats.ring.opacity = 0
      mats.star.opacity = 0
      mats.starCore.opacity = 0
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
      <instancedMesh {...mesh} ref={outlineRef} args={[geos.puff, mats.outline, PUFFS]} />
      <instancedMesh {...mesh} ref={puffsRef} args={[geos.puff, mats.puff, PUFFS]} />
      <group ref={markRef}>
        <mesh {...mesh} ref={scorchRef} geometry={geos.disc} material={mats.scorch} renderOrder={3} />
        <mesh {...mesh} ref={discRef} geometry={geos.disc} material={mats.disc} position={[0, 0.002, 0]} renderOrder={4} />
        <mesh {...mesh} ref={ringRef} geometry={geos.ring} material={mats.ring} position={[0, 0.004, 0]} renderOrder={5} />
        <group ref={starRef}>
          <mesh {...mesh} geometry={geos.star} material={mats.star} position={[0, 0.006, 0]} renderOrder={5} />
          <mesh {...mesh} geometry={geos.star} material={mats.starCore} position={[0, 0.008, 0]} scale={0.56} renderOrder={5} />
        </group>
      </group>
    </>
  )
}
