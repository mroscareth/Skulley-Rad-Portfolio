import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { runeCell } from '../../lib/runeAlphabet.js'
import { getRuneAtlas, RUNE_ATLAS_GLSL } from '../../lib/runeAtlas.js'

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
//   - una marca quemada que se queda un rato;
//   - runas del alfabeto del sitio que salen de la nube y se quedan flotando, y una en
//     el piso que parpadea cada vez más rápido hasta apagarse.
// El brillo es falso, sin luces: una luz nueva recompilaría toda la escena.
//
// Las runas sí traen shader: el trazo sale de la distancia a sus cuatro segmentos, igual
// que en el SVG del abecedario, así que queda nítido a cualquier tamaño y con las bandas
// del rayo más el contorno de la nube. Se compila en el precalentado, como lo demás.
//
// Cada disparo ocupa una casilla con sus piezas, su color y su propio reloj, así que uno
// nuevo no le corta la explosión al anterior. Solo el rayo sigue a la esfera: los rayos
// que sigan vivos salen de la palma aunque Skulley ya esté apuntando a otro lado.
//
// Todo por refs en el useFrame: cero re-renders. Se dibuja apagado hasta que la escena
// se pinte de verdad, para que sus materiales no se compilen en el primer disparo. Contar
// cuadros no sirve: al montarse, el preloader todavía tapa la escena y nada se dibuja.
// Solo se ve desde arriba, así que nada lleva doble cara: three dibujaría dos veces cada
// malla transparente y recompilaría su variante.
//
// La nube y las runas tienen programas que nada más en la escena usa, y por eso no se
// ocultan: se quedan con cero instancias, que no dibujan nada. Al entrar al home cambian
// las luces y three recompila lo que está en la escena; lo que estuviera oculto se
// quedaría viejo y se recompilaría en el primer disparo.

const UP = new THREE.Vector3(0, 1, 0)
const WHITE = new THREE.Color('#ffffff')
const FORWARD = new THREE.Vector3(0, 0, 1)
const SLOTS = 8             // disparos que conviven; si se acaban, cede el más viejo
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
const PUFF_DELAY = 0.18     // las bolas no brotan todas juntas
const PUFF_LIFE = [0.7, 1.05]   // cuánto vive cada bola: es lo que dura la explosión
const BLAST_TIME = PUFF_DELAY + PUFF_LIFE[1]
const OUTLINE = 0.05        // grosor del contorno de la nube
const STAR_SPIKES = [1, 0.74, 0.92, 0.68, 1, 0.8, 0.7, 0.96, 0.72, 0.88, 1, 0.7, 0.84]
export const RUNE_WORD = 'SKULLEYRAD'  // el piso la va escribiendo, una letra por disparo
const RUNE_CELLS = [...RUNE_WORD].map(runeCell)   // casilla de cada letra en el atlas
const RUNE_CORE = 0.045     // qué tan adentro del trazo empieza el blanco, con la runa midiendo 1 de alto
const RUNE_INK = 0.05       // contorno negro
const RUNE_QUAD = 1.32      // la runa, sus picos y el contorno caben de sobra
const AIR_RUNES = [5, 13]   // cuántas vuelan, de poca a toda la carga
const AIR_DELAY = 0.16
const AIR_LIFE = [0.9, 1.5]
const AIR_TIME = AIR_DELAY + AIR_LIFE[1]
const AIR_BRAKE = 5         // salen de golpe y se frenan
const FLOOR_RUNE_AT = 0.28  // sale cuando la estrella ya se va
const FLOOR_RUNE_TIME = 3.4
const FLOOR_RUNE_SIZE = 0.9
const FLOOR_STRETCH = 1.6   // como la pintura de los carriles: la cámara ve el piso muy de lado
const FLOOR_RUNE_GLOW = 2   // los portales pintan sus líneas arriba de 1 para que brillen
const FLOOR_RUNE_STEADY = 0.7   // encendida antes de empezar a parpadear
const BLINK_FROM = 2.5      // parpadeos por segundo al empezar
const BLINK_TO = 11         // y al apagarse
const BLINK_LIT = 0.6       // parte de cada parpadeo que va encendida

// Tamaño de la nube según la carga: de un chispazo a la altura de Skulley.
const blastSize = (power) => 0.9 + 2.1 * power

const flat = (g) => { g.rotateX(-Math.PI / 2); return g }
const easeOut = (x) => 1 - Math.pow(1 - x, 3)
const easeBack = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2)
const clamp01 = (x) => Math.max(0, Math.min(1, x))

// Vueltas de parpadeo hasta el segundo `u`: la integral de una frecuencia que acelera.
const BLINK_SPAN = FLOOR_RUNE_TIME - FLOOR_RUNE_STEADY
const blinkPhase = (u) => BLINK_FROM * u + (BLINK_TO - BLINK_FROM) * Math.pow(u, 3) / (3 * BLINK_SPAN * BLINK_SPAN)

// Uniforms del material de las runas: el atlas de SKULLEYGLYPH.
export const runeUniforms = () => ({ uRuneAtlas: { value: getRuneAtlas() } })

export const RUNE_VERTEX = /* glsl */`
  attribute vec4 aColor;
  attribute vec2 aInfo;
  varying vec2 vP;
  varying vec4 vColor;
  varying vec2 vInfo;
  void main() {
    vP = position.xy;
    vColor = aColor;
    vInfo = aInfo;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

export const RUNE_FRAGMENT = /* glsl */`
  ${RUNE_ATLAS_GLSL}
  varying vec2 vP;
  varying vec4 vColor;
  varying vec2 vInfo;
  // Borde duro con el antialias justo: el composer no trae multisampling.
  float inside(float d, float r, float aa) { return 1.0 - smoothstep(r - aa, r + aa, d); }
  void main() {
    // La runa mide 1 de alto, centrada; su caja en el atlas es de 4 × 6 con la Y hacia abajo.
    vec2 g = vec2(vP.x * 6.0 + 2.0, (0.5 - vP.y) * 6.0);
    float d = runeDist(vInfo.x, g) / 6.0;
    float aa = fwidth(d) * 0.75;
    // vInfo.y = 1: blanco al centro y contorno negro. 0: la runa lisa de un color, como en los portales.
    float alpha = inside(d, ${RUNE_INK.toFixed(3)} * vInfo.y, aa) * vColor.a;
    if (alpha < 0.01) discard;
    vec3 color = mix(vColor.rgb, vec3(1.6), inside(d, -${RUNE_CORE.toFixed(3)}, aa) * vInfo.y);
    gl_FragColor = vec4(color * mix(1.0, inside(d, 0.0, aa), vInfo.y), alpha);
    #include <colorspace_fragment>
  }
`

export function runeGeometry(count) {
  const geo = new THREE.PlaneGeometry(RUNE_QUAD, RUNE_QUAD)
  const instanced = (itemSize) => new THREE.InstancedBufferAttribute(new Float32Array(count * itemSize), itemSize)
    .setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('aColor', instanced(4))
  geo.setAttribute('aInfo', instanced(2))
  return geo
}

export function setRune(el, i, matrix, color, alpha, glyph, sticker) {
  el.setMatrixAt(i, matrix)
  el.geometry.attributes.aColor.setXYZW(i, color.r, color.g, color.b, alpha)
  // `glyph` es la letra de RUNE_WORD; el shader quiere su casilla del atlas.
  el.geometry.attributes.aInfo.setXY(i, RUNE_CELLS[glyph] ?? 0, sticker)
}

export function flushRunes(el) {
  el.instanceMatrix.needsUpdate = true
  el.geometry.attributes.aColor.needsUpdate = true
  el.geometry.attributes.aInfo.needsUpdate = true
}

export function starGeometry() {
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

function flatMaterial(color = '#ffffff') {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  })
}

function makeSlot() {
  return {
    on: false,
    puffing: false,
    flying: false,
    burning: false,
    t: 0,
    dur: 0,
    power: 0,
    radius: 4,
    x: 0,
    y: 0,
    z: 0,
    seeds: Array.from({ length: PUFFS }, () => ({ x: 0, y: 0, z: 0, r: 0, delay: 0, life: 1 })),
    air: Array.from({ length: AIR_RUNES[1] }, () => ({
      dx: 0, dz: 0, up: 0, drift: 0, size: 0, delay: 0, life: 1, roll: 0, spin: 0, glyph: 0,
    })),
    airCount: 0,
    floorGlyph: 0,
    floorColor: new THREE.Color(),
    floorQuat: new THREE.Quaternion(),
    palette: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()],
    mats: {
      bands: BANDS.map(() => flatMaterial()),
      scorch: flatMaterial('#000000'),
      disc: flatMaterial(),
      ring: flatMaterial(),
      star: flatMaterial(),
      starCore: flatMaterial(),
    },
    refs: { beam: null, bands: [], mark: null, scorch: null, disc: null, ring: null, star: null },
  }
}

// Cada disparo fija su color, el de la esfera en ese momento, y su propia nube.
function fire(slot, shot, letter, camera) {
  const { mats, palette, refs } = slot
  slot.on = true
  slot.puffing = true
  slot.t = 0
  slot.dur = shot.dur
  slot.power = shot.power
  slot.radius = shot.radius
  slot.x = shot.x
  slot.y = shot.y
  slot.z = shot.z
  BANDS.forEach((band, i) => {
    mats.bands[i].color.copy(shot.color).lerp(WHITE, band.white).multiplyScalar(band.hdr)
  })
  mats.disc.color.copy(shot.color).multiplyScalar(1.3)
  mats.ring.color.copy(shot.color).lerp(WHITE, 0.5).multiplyScalar(1.5)
  mats.star.color.copy(shot.color).multiplyScalar(1.3)
  mats.starCore.color.copy(shot.color).lerp(WHITE, 0.75).multiplyScalar(1.5)
  palette[0].copy(WHITE).multiplyScalar(1.6)
  palette[1].copy(shot.color).lerp(WHITE, 0.28).multiplyScalar(1.1)
  palette[2].copy(shot.color).multiplyScalar(1.15)
  palette[3].copy(shot.color).multiplyScalar(0.28)
  if (refs.star) refs.star.rotation.y = Math.random() * Math.PI * 2
  slot.seeds.forEach((seed, i) => {
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

  const size = blastSize(shot.power)
  slot.airCount = Math.round(AIR_RUNES[0] + (AIR_RUNES[1] - AIR_RUNES[0]) * shot.power)
  slot.air.forEach((rune, i) => {
    // Repartidas alrededor para que no se amontonen de un lado.
    const a = (i / slot.airCount) * Math.PI * 2 + Math.random() * 0.7
    const reach = size * (0.85 + Math.random() * 0.75)
    rune.dx = Math.cos(a) * reach
    rune.dz = Math.sin(a) * reach
    rune.up = size * (0.35 + Math.random() * 0.8)
    rune.drift = 0.2 + Math.random() * 0.35
    rune.size = (0.42 + Math.random() * 0.3) * (0.8 + 0.5 * shot.power)
    rune.delay = Math.random() * AIR_DELAY
    rune.life = AIR_LIFE[0] + Math.random() * (AIR_LIFE[1] - AIR_LIFE[0])
    rune.roll = Math.random() * Math.PI * 2
    rune.spin = (Math.random() - 0.5) * 2.4
    rune.glyph = (letter + 1 + i) % RUNE_WORD.length
  })
  slot.floorGlyph = letter
  slot.floorColor.copy(shot.color).multiplyScalar(FLOOR_RUNE_GLOW)
  // Acostada y derecha para quien la está viendo: es una letra, se puede leer.
  slot.floorQuat.setFromEuler(new THREE.Euler(
    -Math.PI / 2, Math.atan2(camera.position.x - shot.x, camera.position.z - shot.z), 0, 'YXZ',
  ))
}

export default function LaserBeam({ shotRef, aimRef, travel }) {
  const puffsRef = useRef(null)
  const outlineRef = useRef(null)
  const runeAirRef = useRef(null)
  const runeFloorRef = useRef(null)
  const stateRef = useRef({ warmed: false, id: 0, letter: 0 })
  const slots = useMemo(() => Array.from({ length: SLOTS }, makeSlot), [])
  const tmp = useMemo(() => ({
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    size: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    face: new THREE.Quaternion(),
    roll: new THREE.Quaternion(),
    matrix: new THREE.Matrix4(),
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
      runeAir: runeGeometry(SLOTS * AIR_RUNES[1]),
      runeFloor: runeGeometry(SLOTS),
    }
  }, [])
  const puffMats = useMemo(() => ({
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
      Object.values(puffMats).forEach((m) => m.dispose())
      slots.forEach((slot) => Object.values(slot.mats).flat().forEach((m) => m.dispose()))
    } catch { }
  }, [geos, puffMats, slots])

  // Colores por bola desde el montaje: si el atributo nace en el primer disparo, el
  // material se recompila justo ahí. Arrancan en tamaño cero.
  useEffect(() => {
    const puffs = puffsRef.current
    const outline = outlineRef.current
    if (!puffs || !outline) return
    tmp.size.setScalar(0)
    tmp.matrix.compose(tmp.pos.set(0, 0, 0), tmp.quat, tmp.size)
    for (let i = 0; i < SLOTS * PUFFS; i += 1) {
      puffs.setMatrixAt(i, tmp.matrix)
      outline.setMatrixAt(i, tmp.matrix)
      puffs.setColorAt(i, WHITE)
    }
    puffs.onAfterRender = () => { stateRef.current.warmed = true }
  }, [tmp])

  useFrame((state, delta) => {
    const puffs = puffsRef.current
    const outline = outlineRef.current
    const runeAir = runeAirRef.current
    const runeFloor = runeFloorRef.current
    const shot = shotRef.current
    const aim = aimRef.current
    if (!puffs || !outline || !runeAir || !runeFloor || !shot || !aim) return
    const s = stateRef.current
    const warming = !s.warmed
    const step = Math.min(delta, 0.05)
    // Player espera este reloj para saber cuándo llegó el rayo al piso.
    if (shot.on) shot.t += step

    if (shot.id !== s.id) {
      s.id = shot.id
      fire(slots.find((x) => !x.on) ?? slots.reduce((a, b) => (b.t > a.t ? b : a)), shot, s.letter, state.camera)
      s.letter = (s.letter + 1) % RUNE_WORD.length
    }

    const time = state.clock.getElapsedTime()
    let dirty = false
    let airDirty = false
    let floorDirty = false
    let alive = 0
    slots.forEach((slot, n) => {
      const { refs, mats, seeds, palette } = slot
      if (slot.on) slot.t += step
      const t = slot.t
      const firing = slot.on && t < slot.dur
      const since = t - travel
      const size = blastSize(slot.power)
      if (slot.on) alive += 1

      if (refs.beam) refs.beam.visible = firing || warming
      if (firing && refs.beam) {
        const { from, to, dir } = tmp
        from.set(aim.ex, aim.ey, aim.ez)
        to.set(slot.x, slot.y + FLOOR_Y, slot.z)
        dir.subVectors(to, from)
        const len = dir.length()
        if (len > 1e-3) {
          dir.multiplyScalar(1 / len)
          refs.beam.position.copy(from)
          refs.beam.quaternion.setFromUnitVectors(UP, dir)
          // Entra pasado de ancho, se asienta y al final se adelgaza hasta apagarse.
          const punch = 1 + 0.35 * (1 - clamp01(t / 0.12))
          const fade = clamp01((slot.dur - t) / (slot.dur * 0.4))
          const width = (RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * slot.power) * punch * (0.15 + 0.85 * fade)
          const reach = len * clamp01(t / travel)
          BANDS.forEach((band, i) => {
            const el = refs.bands[i]
            if (!el) return
            const r = width * band.radius * (1 + 0.1 * Math.sin(time * 70 + i * 2.1 + n))
            el.scale.set(r, reach, r)
            mats.bands[i].opacity = 1
          })
        }
      }

      // Una vuelta más al terminar: deja sus bolas en cero antes de soltar la casilla.
      const puffing = slot.on && since < BLAST_TIME
      if (puffing || slot.puffing) {
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
            const tone = local < 0.08 ? 0 : local < 0.2 ? 1 : local < 0.76 ? 2 : 3
            puffs.setColorAt(n * PUFFS + i, palette[tone])
          }
          // Las bolas se abren desde el centro y suben un poco al apagarse.
          const open = 0.35 + 0.65 * grow
          tmp.pos.set(
            slot.x + seed.x * size * open,
            slot.y + seed.y * size * open + 0.25 * size * clamp01(local),
            slot.z + seed.z * size * open,
          )
          tmp.matrix.compose(tmp.pos, tmp.quat, tmp.size.setScalar(radius))
          puffs.setMatrixAt(n * PUFFS + i, tmp.matrix)
          tmp.matrix.compose(tmp.pos, tmp.quat, tmp.size.setScalar(radius > 0 ? radius + OUTLINE : 0))
          outline.setMatrixAt(n * PUFFS + i, tmp.matrix)
        }
        slot.puffing = puffing
        dirty = true
      }

      // Igual que las bolas: una vuelta más para dejar sus runas en cero.
      const flying = slot.on && since >= 0 && since < AIR_TIME
      if (flying || slot.flying) {
        for (let i = 0; i < AIR_RUNES[1]; i += 1) {
          const rune = slot.air[i]
          const age = since - rune.delay
          const local = age / rune.life
          let scale = 0
          if (flying && i < slot.airCount && local > 0 && local < 1) {
            const leaving = local > 0.7 && Math.floor(age * 20) % 2 === 1
            scale = leaving ? 0 : rune.size * easeBack(clamp01(age / 0.16))
            const out = 1 - Math.exp(-AIR_BRAKE * age)
            tmp.pos.set(
              slot.x + rune.dx * out,
              slot.y + 0.2 + rune.up * out + rune.drift * age,
              slot.z + rune.dz * out,
            )
            tmp.face.copy(state.camera.quaternion)
              .multiply(tmp.roll.setFromAxisAngle(FORWARD, rune.roll + rune.spin * age))
          }
          tmp.matrix.compose(tmp.pos, tmp.face, tmp.size.setScalar(scale))
          setRune(runeAir, n * AIR_RUNES[1] + i, tmp.matrix, palette[local < 0.1 ? 0 : 2], 1, rune.glyph, 1)
        }
        slot.flying = flying
        airDirty = true
      }

      const u = since - FLOOR_RUNE_AT
      const burning = slot.on && u >= 0
      if (burning || slot.burning) {
        let scale = 0
        if (burning) {
          const blink = u - FLOOR_RUNE_STEADY
          if (blink <= 0 || blinkPhase(blink) % 1 <= BLINK_LIT) scale = FLOOR_RUNE_SIZE
        }
        tmp.pos.set(slot.x, slot.y + FLOOR_Y + 0.01, slot.z)
        tmp.matrix.compose(tmp.pos, slot.floorQuat, tmp.size.set(scale, scale * FLOOR_STRETCH, scale))
        setRune(runeFloor, n, tmp.matrix, slot.floorColor, 1, slot.floorGlyph, 0)
        slot.burning = burning
        floorDirty = true
      }

      const marking = slot.on && since >= 0 && t < slot.dur + MARK_TIME
      if (refs.mark) refs.mark.visible = marking || warming
      if (marking) {
        const after = t - slot.dur
        refs.mark.position.set(slot.x, slot.y + FLOOR_Y, slot.z)
        // La marca sale debajo de la nube, no antes que ella.
        refs.scorch?.scale.setScalar(size * 0.9 * easeOut(clamp01(since / 0.2)))
        mats.scorch.opacity = 0.42 * clamp01((MARK_TIME - after) / 0.8)
        refs.disc?.scale.setScalar((0.4 + 0.55 * slot.power) * (firing ? 1 + 0.1 * Math.sin(t * 60) : 1))
        mats.disc.opacity = firing ? 0.8 : 0.8 * clamp01(1 - after / 0.14)
        const k = clamp01(since / RING_TIME)
        refs.ring?.scale.setScalar(0.5 + (slot.radius - 0.5) * easeOut(k))
        mats.ring.opacity = 1 - k
        refs.star?.scale.setScalar(size * 1.55 * easeOut(clamp01(since / 0.1)))
        const starFade = clamp01((1 - clamp01(since / STAR_TIME)) / 0.4)
        mats.star.opacity = starFade
        mats.starCore.opacity = starFade
      }

      if (slot.on && u >= FLOOR_RUNE_TIME) slot.on = false
    })

    puffs.count = dirty ? SLOTS * PUFFS : 0
    outline.count = puffs.count
    runeAir.count = airDirty ? SLOTS * AIR_RUNES[1] : 0
    runeFloor.count = floorDirty ? SLOTS : 0
    if (dirty) {
      puffs.instanceMatrix.needsUpdate = true
      outline.instanceMatrix.needsUpdate = true
      if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true
    }
    if (airDirty) flushRunes(runeAir)
    if (floorDirty) flushRunes(runeFloor)
    shot.alive = alive
    if (shot.on && shot.t >= shot.dur + MARK_TIME) shot.on = false
  })

  const mesh = { frustumCulled: false, raycast: () => null }

  return (
    <>
      <instancedMesh {...mesh} ref={outlineRef} args={[geos.puff, puffMats.outline, SLOTS * PUFFS]} />
      <instancedMesh {...mesh} ref={puffsRef} args={[geos.puff, puffMats.puff, SLOTS * PUFFS]} />
      <instancedMesh {...mesh} ref={runeFloorRef} args={[geos.runeFloor, puffMats.rune, SLOTS]} renderOrder={4} />
      <instancedMesh {...mesh} ref={runeAirRef} args={[geos.runeAir, puffMats.rune, SLOTS * AIR_RUNES[1]]} renderOrder={9} />
      {slots.map((slot, n) => (
        <group key={n}>
          <group ref={(el) => { slot.refs.beam = el }}>
            {BANDS.map((_, i) => (
              <mesh
                {...mesh}
                key={i}
                ref={(el) => { slot.refs.bands[i] = el }}
                geometry={geos.beam}
                material={slot.mats.bands[i]}
                scale={[0.001, 0.001, 0.001]}
                renderOrder={6 + i}
              />
            ))}
          </group>
          <group ref={(el) => { slot.refs.mark = el }}>
            <mesh {...mesh} ref={(el) => { slot.refs.scorch = el }} geometry={geos.disc} material={slot.mats.scorch} renderOrder={3} />
            <mesh {...mesh} ref={(el) => { slot.refs.disc = el }} geometry={geos.disc} material={slot.mats.disc} position={[0, 0.002, 0]} renderOrder={4} />
            <mesh {...mesh} ref={(el) => { slot.refs.ring = el }} geometry={geos.ring} material={slot.mats.ring} position={[0, 0.004, 0]} renderOrder={5} />
            <group ref={(el) => { slot.refs.star = el }}>
              <mesh {...mesh} geometry={geos.star} material={slot.mats.star} position={[0, 0.006, 0]} renderOrder={5} />
              <mesh {...mesh} geometry={geos.star} material={slot.mats.starCore} position={[0, 0.008, 0]} scale={0.56} renderOrder={5} />
            </group>
          </group>
        </group>
      ))}
    </>
  )
}
