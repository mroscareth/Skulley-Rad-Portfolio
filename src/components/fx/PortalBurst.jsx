import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  RUNE_VERTEX, RUNE_FRAGMENT, RUNE_WORD, runeUniforms, runeGeometry, setRune, flushRunes, starGeometry,
} from './LaserBeam.jsx'

// El estallido cuando una esfera entra a un portal (opción B que escogió Oscar, en
// lugar del humo de puntitos): el mismo idioma que la explosión del láser, en chico.
// También donde el relámpago pega en el piso (esfera corrupta, rayos del easter egg
// y el rayo que despedaza a Skulley), más grande y en el azul del rayo.
//   - una estrella de impacto acostada en el portal;
//   - bolitas con contorno de tinta que salen hacia los lados, suben un poco y pasan
//     por blanco, claro, color y oscuro en saltos duros;
//   - un aro que se abre por el portal;
//   - runas del alfabeto del sitio que salen volando y parpadean al irse.
// Las piezas que comparte con LaserBeam (runas, estrella) vienen de ahí, con el mismo
// shader: su programa ya está compilado.
//
// Cada estallido ocupa una casilla con su color y su reloj. Sin estallidos vivos, las
// mallas instanciadas se quedan en cero instancias en vez de ocultarse, para que el
// primero no compile nada a media partida.

const WHITE = new THREE.Color('#ffffff')
const FORWARD = new THREE.Vector3(0, 0, 1)
const SLOTS = 6
const PUFFS = 12
const PUFF_DELAY = 0.08
const PUFF_LIFE = [0.5, 0.78]
const RUNES = 5
const RUNE_DELAY = 0.06
const RUNE_LIFE = [0.75, 1.1]
const RUNE_BRAKE = 5
const STAR_TIME = 0.3
const RING_TIME = 0.5
const OUTLINE = 0.045
const FLOOR_Y = 0.06
const DONE = Math.max(PUFF_DELAY + PUFF_LIFE[1], RUNE_DELAY + RUNE_LIFE[1], RING_TIME)

const easeOut = (x) => 1 - Math.pow(1 - x, 3)
const easeBack = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2)
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const flat = (g) => { g.rotateX(-Math.PI / 2); return g }

function flatMaterial() {
  return new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  })
}

function makeSlot() {
  return {
    on: false,
    live: false,
    t: 0,
    x: 0,
    y: 0,
    z: 0,
    size: 1,
    reach: 2,
    seeds: Array.from({ length: PUFFS }, () => ({ dx: 0, dz: 0, up: 0, r: 0, delay: 0, life: 1 })),
    runes: Array.from({ length: RUNES }, () => ({
      dx: 0, dz: 0, up: 0, size: 0, delay: 0, life: 1, roll: 0, spin: 0, glyph: 0,
    })),
    palette: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()],
    mats: { ring: flatMaterial(), star: flatMaterial(), starCore: flatMaterial() },
    refs: { group: null, ring: null, star: null },
  }
}

const PortalBurst = forwardRef(function PortalBurst(_, ref) {
  const puffsRef = useRef(null)
  const outlineRef = useRef(null)
  const runesRef = useRef(null)
  const stateRef = useRef({ letter: 0 })
  const slots = useMemo(() => Array.from({ length: SLOTS }, makeSlot), [])
  const tmp = useMemo(() => ({
    pos: new THREE.Vector3(),
    size: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    face: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    matrix: new THREE.Matrix4(),
    color: new THREE.Color(),
  }), [])

  const geos = useMemo(() => ({
    puff: new THREE.IcosahedronGeometry(1, 2),
    star: starGeometry(),
    ring: flat(new THREE.RingGeometry(0.9, 1, 96)),
    runes: runeGeometry(SLOTS * RUNES),
  }), [])
  const mats = useMemo(() => ({
    puff: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    outline: new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide, toneMapped: false }),
    rune: new THREE.ShaderMaterial({
      vertexShader: RUNE_VERTEX,
      fragmentShader: RUNE_FRAGMENT,
      uniforms: runeUniforms(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  }), [])
  useEffect(() => () => {
    try {
      Object.values(geos).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
      slots.forEach((slot) => Object.values(slot.mats).forEach((m) => m.dispose()))
    } catch { }
  }, [geos, mats, slots])

  // Colores por bola desde el montaje: si el atributo nace en el primer estallido, el
  // material se recompila justo ahí. Arrancan en tamaño cero.
  useEffect(() => {
    const puffs = puffsRef.current
    const outline = outlineRef.current
    if (!puffs || !outline) return
    tmp.matrix.compose(tmp.pos.set(0, -1000, 0), tmp.quat, tmp.size.setScalar(0))
    for (let i = 0; i < SLOTS * PUFFS; i += 1) {
      puffs.setMatrixAt(i, tmp.matrix)
      outline.setMatrixAt(i, tmp.matrix)
      puffs.setColorAt(i, WHITE)
    }
  }, [tmp])

  useImperativeHandle(ref, () => ({
    // `at` es el centro del portal ([x, y, z] o {x, y, z}); `orbRadius` lo agranda un poco.
    burst(at, color, orbRadius = 0.35, portalRadius = 2) {
      if (!at) return
      const slot = slots.find((s) => !s.on) ?? slots.reduce((a, b) => (b.t > a.t ? b : a))
      const x = Array.isArray(at) ? at[0] : at.x
      const y = Array.isArray(at) ? at[1] : at.y
      const z = Array.isArray(at) ? at[2] : at.z
      try { tmp.color.set(color || '#ffffff') } catch { tmp.color.set('#ffffff') }
      slot.on = true
      slot.live = true
      slot.t = 0
      slot.x = x
      slot.y = y
      slot.z = z
      slot.size = 0.75 + orbRadius * 1.2
      slot.reach = portalRadius
      const { palette, mats: m } = slot
      palette[0].copy(WHITE).multiplyScalar(1.6)
      palette[1].copy(tmp.color).lerp(WHITE, 0.28).multiplyScalar(1.1)
      palette[2].copy(tmp.color).multiplyScalar(1.15)
      palette[3].copy(tmp.color).multiplyScalar(0.28)
      m.ring.color.copy(tmp.color).lerp(WHITE, 0.5).multiplyScalar(1.5)
      m.star.color.copy(tmp.color).multiplyScalar(1.3)
      m.starCore.color.copy(tmp.color).lerp(WHITE, 0.75).multiplyScalar(1.5)
      if (slot.refs.star) slot.refs.star.rotation.y = Math.random() * Math.PI * 2
      slot.seeds.forEach((seed, i) => {
        // Repartidas alrededor y hacia afuera: es un estallido, no una nube quieta.
        const a = (i / PUFFS) * Math.PI * 2 + Math.random() * 0.5
        const d = portalRadius * (0.45 + Math.random() * 0.5)
        seed.dx = Math.cos(a) * d
        seed.dz = Math.sin(a) * d
        seed.up = 0.4 + Math.random() * 0.7
        seed.r = 0.2 + Math.random() * 0.16
        seed.delay = Math.random() * PUFF_DELAY
        seed.life = PUFF_LIFE[0] + Math.random() * (PUFF_LIFE[1] - PUFF_LIFE[0])
      })
      const s = stateRef.current
      slot.runes.forEach((rune, i) => {
        const a = (i / RUNES) * Math.PI * 2 + Math.random() * 0.8
        const reach = portalRadius * (0.7 + Math.random() * 0.5)
        rune.dx = Math.cos(a) * reach
        rune.dz = Math.sin(a) * reach
        rune.up = 1 + Math.random() * 0.9
        rune.size = 0.38 + Math.random() * 0.18
        rune.delay = Math.random() * RUNE_DELAY
        rune.life = RUNE_LIFE[0] + Math.random() * (RUNE_LIFE[1] - RUNE_LIFE[0])
        rune.roll = Math.random() * Math.PI * 2
        rune.spin = (Math.random() - 0.5) * 2.4
        rune.glyph = (s.letter + i) % RUNE_WORD.length
      })
      s.letter = (s.letter + RUNES) % RUNE_WORD.length
    },
  }), [slots, tmp])

  useFrame((state, delta) => {
    const puffs = puffsRef.current
    const outline = outlineRef.current
    const runes = runesRef.current
    if (!puffs || !outline || !runes) return
    const step = Math.min(delta, 0.05)
    let dirty = false

    slots.forEach((slot, n) => {
      const { refs, mats: m, seeds, palette } = slot
      if (slot.on) slot.t += step
      const t = slot.t
      const live = slot.on && t < DONE

      // Una vuelta más al terminar: deja sus bolas y runas en cero antes de soltar la casilla.
      if (live || slot.live) {
        for (let i = 0; i < PUFFS; i += 1) {
          const seed = seeds[i]
          const local = (t - seed.delay) / seed.life
          let radius = 0
          let out = 0
          if (live && local > 0 && local < 1) {
            const grow = easeOut(clamp01(local / 0.25))
            const shrink = local > 0.5 ? 1 - Math.pow((local - 0.5) / 0.5, 2) : 1
            radius = seed.r * slot.size * grow * shrink
            out = easeOut(clamp01(local / 0.7))
            const tone = local < 0.1 ? 0 : local < 0.24 ? 1 : local < 0.75 ? 2 : 3
            puffs.setColorAt(n * PUFFS + i, palette[tone])
          }
          tmp.pos.set(
            slot.x + seed.dx * out,
            slot.y + 0.25 + seed.up * Math.sin(Math.PI * clamp01(local)) * 0.8 + 0.2 * out,
            slot.z + seed.dz * out,
          )
          tmp.matrix.compose(tmp.pos, tmp.quat, tmp.size.setScalar(radius))
          puffs.setMatrixAt(n * PUFFS + i, tmp.matrix)
          tmp.matrix.compose(tmp.pos, tmp.quat, tmp.size.setScalar(radius > 0 ? radius + OUTLINE : 0))
          outline.setMatrixAt(n * PUFFS + i, tmp.matrix)
        }
        for (let i = 0; i < RUNES; i += 1) {
          const rune = slot.runes[i]
          const age = t - rune.delay
          const local = age / rune.life
          let scale = 0
          if (live && local > 0 && local < 1) {
            const leaving = local > 0.7 && Math.floor(age * 20) % 2 === 1
            scale = leaving ? 0 : rune.size * easeBack(clamp01(age / 0.16))
            const out = 1 - Math.exp(-RUNE_BRAKE * age)
            tmp.pos.set(slot.x + rune.dx * out, slot.y + 0.3 + rune.up * out, slot.z + rune.dz * out)
            tmp.face.copy(state.camera.quaternion)
              .multiply(tmp.roll.setFromAxisAngle(FORWARD, rune.roll + rune.spin * age))
          }
          tmp.matrix.compose(tmp.pos, tmp.face, tmp.size.setScalar(scale))
          setRune(runes, n * RUNES + i, tmp.matrix, palette[local < 0.1 ? 0 : 2], 1, rune.glyph, 1)
        }
        slot.live = live
        dirty = true
      }

      if (refs.group) refs.group.visible = live
      if (live) {
        refs.group.position.set(slot.x, slot.y + FLOOR_Y, slot.z)
        const k = clamp01(t / RING_TIME)
        refs.ring?.scale.setScalar(slot.reach * (0.5 + 1.2 * easeOut(k)))
        m.ring.opacity = 1 - k
        refs.star?.scale.setScalar(slot.size * 1.5 * easeOut(clamp01(t / 0.1)))
        const fade = clamp01((1 - clamp01(t / STAR_TIME)) / 0.4)
        m.star.opacity = fade
        m.starCore.opacity = fade
      }
      if (slot.on && t >= DONE + 0.05) slot.on = false
    })

    puffs.count = dirty ? SLOTS * PUFFS : 0
    outline.count = puffs.count
    runes.count = dirty ? SLOTS * RUNES : 0
    if (dirty) {
      puffs.instanceMatrix.needsUpdate = true
      outline.instanceMatrix.needsUpdate = true
      if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true
      flushRunes(runes)
    }
  })

  const mesh = { frustumCulled: false, raycast: () => null }
  return (
    <>
      <instancedMesh {...mesh} ref={outlineRef} args={[geos.puff, mats.outline, SLOTS * PUFFS]} count={0} />
      <instancedMesh {...mesh} ref={puffsRef} args={[geos.puff, mats.puff, SLOTS * PUFFS]} count={0} />
      <instancedMesh {...mesh} ref={runesRef} args={[geos.runes, mats.rune, SLOTS * RUNES]} renderOrder={9} count={0} />
      {slots.map((slot, n) => (
        <group key={n} ref={(el) => { slot.refs.group = el }} visible={false}>
          <mesh {...mesh} ref={(el) => { slot.refs.ring = el }} geometry={geos.ring} material={slot.mats.ring} position={[0, 0.004, 0]} renderOrder={5} />
          <group ref={(el) => { slot.refs.star = el }}>
            <mesh {...mesh} geometry={geos.star} material={slot.mats.star} position={[0, 0.006, 0]} renderOrder={5} />
            <mesh {...mesh} geometry={geos.star} material={slot.mats.starCore} position={[0, 0.008, 0]} scale={0.56} renderOrder={5} />
          </group>
        </group>
      ))}
    </>
  )
})

export default PortalBurst
