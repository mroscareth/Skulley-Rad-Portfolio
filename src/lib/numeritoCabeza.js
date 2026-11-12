import * as THREE from 'three'
import { playOrbKick, playOrbHit, playOrbBounce, playFootstep } from './homeSounds.js'
import { playEyePoke, playEyePop, playEyeRespawn } from './eyePokeSound.js'
import { KICK_BONES, KICK_A, KICK_B, KICK_ROOT_A, KICK_ROOT_B } from './kickPose.js'
import { PASO, calcularNube } from './nubePiso.js'

// El numerito de Skulley en la historia del preloader de escritorio (Oscar:
// "algo que lo haga verse un poco tonto"). Con el foco recién prendido, una
// esfera entra volando desde fuera de cuadro y le tumba la cabeza; la cabeza
// rebota, rueda y se queda de lado en lo oscuro. Skulley, sin cabeza, camina
// a tientas con los brazos por delante, primero para el lado equivocado; se
// da la vuelta y llega a ella, y la cabeza se le prende de la espinilla. Del
// dolor brinca, sacude la pierna con la cabeza colgando y la patea lejos (Oscar);
// va por ella con cuidado, se agacha, se la pone al revés, voltea a la cámara
// confundido y se la endereza de un tronido. El foco lo va siguiendo.
//
// Es una capa encima de las animaciones del GLB (el idle y la caminata, que
// aquí se mezclan), hueso por hueso, después del mixer (como la pose del láser
// en Player.jsx). Skulley es un esqueleto de piezas rígidas: mover el hueso
// `headx` despega el cráneo entero (ojos, mandíbula y mohawk cuelgan de él).
// Las manos llegan a donde deben con IK de dos huesos en espacio de mundo, así
// no depende de los ejes locales del rig. La cabeza y la esfera caen con una
// física precalculada al arrancar (paso fijo: igual en cualquier pantalla), y
// sus botes y los pasos suenan desde aquí.
//
// Tiempos en segundos desde que arranca (los nombres dicen qué pasa). Al
// terminar se queda donde acabó, ya con la cabeza bien puesta, hasta que el
// preloader lo suelta en un corte de cámara (ahí regresa al centro).
export const NUMERITO = {
  golpe: 0.42, // la esfera le pega en la cabeza
  sacudida: 1.2, // el cuerpo se sacude del golpe
  despiste: 2.1, // sin cabeza, voltea a los lados
  giro1: 2.55, // se voltea hacia el lado equivocado
  camina1: 3.95, // y camina a tientas
  pausa: 4.25,
  giro2: 4.95, // se da la vuelta
  llega: 7.2, // camina hasta la cabeza y se para junto a ella
  acecha: 7.75, // la cabeza se endereza, voltea a su pierna y abre la boca
  muerde: 7.95, // ¡ñam! se le prende de la espinilla (Oscar)
  patada: 9.05, // brinca y sacude la pierna del dolor... y la patea
  sueltaPierna: 9.5,
  despiste2: 10.2, // se recompone y voltea a ver dónde quedó
  giro3: 10.7,
  camina3: 12.3, // va por ella con cuidado, parándose antes
  laVe: 12.7,
  agachado: 13.4,
  agarra: 13.65,
  enPecho: 14.5, // se endereza con la cabeza en las manos
  puesta: 15.3, // se la pone... al revés
  suelta: 15.7,
  deFrente: 16.25, // voltea a la cámara con la cabeza al revés
  confundido: 16.95,
  manosArriba: 17.3,
  tronido: 17.7, // y se la gira de golpe
  fin: 18.25,
}

// La curva de la patada del juego (Player.jsx), que empieza a dar el latigazo
// en `patada`: recoge la pierna, latigazo, aguanta y regresa. La cabeza sale a
// media patada (`suelta`, segundos después de `patada`).
const PATADA = { antic: 0.16, swing: 0.075, hold: 0.1, dur: 0.78, suelta: 0.04 }
function pesoPatada(t) {
  const k = t - (NUMERITO.patada - PATADA.antic)
  if (k < 0 || k >= PATADA.dur) return { W: 0, P: 0 }
  if (k < PATADA.antic) {
    const r = k / PATADA.antic
    return { W: r < 0.5 ? 2 * r * r : 1 - Math.pow(-2 * r + 2, 2) / 2, P: 0 }
  }
  if (k < PATADA.antic + PATADA.swing) return { W: 1, P: 1 - Math.pow(1 - (k - PATADA.antic) / PATADA.swing, 3) }
  if (k < PATADA.antic + PATADA.swing + PATADA.hold) return { W: 1, P: 1 }
  const r = (k - PATADA.antic - PATADA.swing - PATADA.hold) / (PATADA.dur - PATADA.antic - PATADA.swing - PATADA.hold)
  return { W: 1 - r * r * (3 - 2 * r), P: 1 }
}

// Radio del cráneo (en altos del personaje): a esa altura del piso queda su
// centro, y a esa distancia van las manos a sus lados.
const RADIO_CRANEO = 0.135
// Cuánto se dobla cada vértebra para llegar al piso (radianes, ~80° en total).
const DOBLA = { spine_01x: 0.6, spine_02x: 0.45, spine_03x: 0.35 }
// Hacia dónde apuntan los codos: hacia afuera y un poco atrás.
const CODO = { x: 0.6, y: -0.2, z: -0.35 }
// La caminata del GLB (root|root|Walking, 1.367 s por ciclo): el pie apoyado
// retrocede ~1.15 unidades del rig por segundo a velocidad 1 (medido). El
// cuerpo avanza a esa velocidad por la escala de tiempo, y los pies no patinan.
const PASO_VEL = 1.15
const CICLO = 1.367
// Física en unidades del rig: Skulley mide 2 y representa ~1.7 m.
const G = 11.5
const RADIO_ORBE = 0.13
// De dónde sale la esfera (fuera de cuadro a la izquierda, un poco arriba y
// hacia la cámara) y cómo salen la cabeza y la esfera del golpe (unidades por
// segundo; `giro` es la vuelta de la cabeza alrededor del eje de la cámara).
const ORBE_SALE = new THREE.Vector3(-3.4, 1.95, 0.45)
const CABEZA_SALE = { vx: 1.2, vy: 2.5, vz: 0.25, giro: -8 }
const ORBE_REBOTA = { vx: -2.3, vy: 1.7, vz: 0.4 }
// Hasta dónde camina para el lado equivocado (x del rig) y a qué distancia de
// la cabeza se para (lo que alcanza agachándose).
const IDA = -1.0
const ANTES_DE_CABEZA = 0.55
// La mordida: se para con la cabeza enfrente de su espinilla izquierda (en el
// espacio del cuerpo: `lado` a su izquierda, `adelante` hacia donde mira), la
// cabeza abre la boca (`abre`, radianes de mandíbula) y se le prende. La
// cabeza mordiendo va pegada al hueso de la pierna: así no se atraviesan
// (Oscar: parecía que le mordía la pierna; ahora le muerde de verdad).
const MORDIDA = { lado: 0.12, adelante: 0.36, abre: 0.5 }
// Al patearla sale en arco hacia adelante, arriba y hacia la cámara.
const PATADA_SALE = { adelante: 0.75, vy: 3.1, haciaCamara: 0.8, giro: -10 }
// Qué tan lejos del pecho carga la cabeza (en altos): sin aire, el cráneo se
// metía entre los brazos y las costillas.
const CARGA_ADELANTE = 0.26
// En qué fracción de cada caminata arranca y frena.
const ARRANQUE = 0.22
// Después de la patada la cabeza se acomoda en el aire, en estos segundos, a
// la orientación del primer golpe (de cara a la cámara): así rueda y se
// acuesta de lado como la primera vez. Con la que traía de la pierna se
// quedaba parada sobre la quijada, medio metida en el piso.
const ACOMODO = 0.4
// Contra el piso, la cabeza suelta se asienta en su punto más bajo cuando su
// centro está a menos de esto (en radios del cráneo) de donde reposa; más
// arriba solo se le impide bajar del piso.
const ASIENTA = 0.6
// Holgura contra el piso, en altos del personaje (ver `holgura` en aplicar).
const HOLGURA = 0.001
// Los brincos de dolor mientras lo muerde (medios ciclos por segundo).
const BRINCOS = 3
const BRINCO_HZ = 3.5

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const tramo = (t, a, b) => clamp01((t - a) / Math.max(1e-6, b - a))
const suave = (u) => u * u * (3 - 2 * u)
const sale = (u) => 1 - (1 - u) * (1 - u)
const lerp = (a, b, u) => a + (b - a) * u
// Posición (0..1) y velocidad (por unidad de u) de una caminata que arranca,
// va pareja y frena: velocidad en trapecio.
function trapecio(u, a = ARRANQUE) {
  const vmax = 1 / (1 - a)
  if (u <= 0) return 0
  if (u >= 1) return 1
  if (u < a) return (0.5 * vmax * u * u) / a
  if (u > 1 - a) { const r = 1 - u; return 1 - (0.5 * vmax * r * r) / a }
  return 0.5 * vmax * a + vmax * (u - a)
}
function trapecioVel(u, a = ARRANQUE) {
  const vmax = 1 / (1 - a)
  if (u <= 0 || u >= 1) return 0
  if (u < a) return (vmax * u) / a
  if (u > 1 - a) return (vmax * (1 - u)) / a
  return vmax
}

const _v1 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _q3 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _s = new THREE.Vector3()
const IDENTIDAD = new THREE.Quaternion()
const EJE_X = new THREE.Vector3(1, 0, 0)
const EJE_Y = new THREE.Vector3(0, 1, 0)
const EJE_Z = new THREE.Vector3(0, 0, 1)

// Gira un hueso para que su dirección `desde` (mundo) apunte a `hacia`, con
// peso: la diferencia se aplica en mundo y se regresa a su espacio local.
function apuntar(hueso, desde, hacia, peso) {
  _q1.setFromUnitVectors(desde.normalize(), hacia.normalize())
  if (peso < 1) _q1.slerp(IDENTIDAD, 1 - peso)
  hueso.getWorldQuaternion(_q2)
  hueso.parent.getWorldQuaternion(_q3).invert()
  hueso.quaternion.copy(_q3.multiply(_q1.multiply(_q2)))
  hueso.updateMatrixWorld(true)
}

// IK de dos huesos: el brazo y el antebrazo llevan la mano a `objetivo`, con
// el codo hacia `polo` (todo en mundo).
function ik(brazo, antebrazo, mano, objetivo, polo, peso) {
  const A = brazo.getWorldPosition(new THREE.Vector3())
  const B = antebrazo.getWorldPosition(new THREE.Vector3())
  const C = mano.getWorldPosition(new THREE.Vector3())
  const l1 = A.distanceTo(B)
  const l2 = B.distanceTo(C)
  const haciaT = objetivo.clone().sub(A)
  const d = Math.min(Math.max(haciaT.length(), 1e-4), (l1 + l2) * 0.999)
  haciaT.normalize()
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
  const sinA = Math.sqrt(1 - cosA * cosA)
  const doblez = polo.clone().sub(A)
  doblez.sub(_v1.copy(haciaT).multiplyScalar(doblez.dot(haciaT))).normalize()
  const codo = A.clone().addScaledVector(haciaT, l1 * cosA).addScaledVector(doblez, l1 * sinA)
  apuntar(brazo, B.clone().sub(A), codo.sub(A), peso)
  const B2 = antebrazo.getWorldPosition(new THREE.Vector3())
  const C2 = mano.getWorldPosition(new THREE.Vector3())
  apuntar(antebrazo, C2.sub(B2), objetivo.clone().sub(B2), peso)
}

// ── La física ─────────────────────────────────────────────────────────────
// Paso fijo, muestras cada 1/120 s: [x, y, z, ángulo] en el espacio del rig.
const DT = 1 / 240
function muestra(sim, t) {
  const n = sim.datos.length / 4
  const f = Math.max(0, Math.min(n - 1, t / sim.paso))
  const i = Math.floor(f)
  const j = Math.min(n - 1, i + 1)
  const u = f - i
  const d = sim.datos
  return {
    x: lerp(d[i * 4], d[j * 4], u),
    y: lerp(d[i * 4 + 1], d[j * 4 + 1], u),
    z: lerp(d[i * 4 + 2], d[j * 4 + 2], u),
    a: lerp(d[i * 4 + 3], d[j * 4 + 3], u),
  }
}

// La cabeza sale del golpe: vuela girando, rebota perdiendo fuerza, rueda sin
// patinar (lo que gira es lo que avanza) y, ya lenta, se mece hasta quedar de
// lado, que es como se acuesta un cráneo con mohawk.
function simularCabeza(p0, suelo, radio, salida = CABEZA_SALE, a0 = 0) {
  const datos = []
  const botes = []
  let x = p0.x, y = p0.y, z = p0.z
  let vx = salida.vx, vy = salida.vy, vz = salida.vz
  let a = a0, w = salida.giro
  let enPiso = false
  let meciendo = false
  let objetivo = 0
  for (let i = 0, t = 0; t < 3.4; i++, t += DT) {
    if (!enPiso) {
      vy -= G * DT
      x += vx * DT; y += vy * DT; z += vz * DT; a += w * DT
      if (y <= suelo && vy < 0) {
        y = suelo
        const fuerza = -vy
        if (fuerza > 0.3) botes.push({ t, fuerza: Math.min(1, fuerza / 4) })
        vy = fuerza > 1 ? fuerza * 0.42 : 0
        vx *= 0.78; vz *= 0.7
        w = w * 0.4 + (-vx / radio) * 0.6
        if (vy === 0) enPiso = true
      }
    } else if (!meciendo) {
      const f = Math.exp(-2.4 * DT)
      vx *= f; vz *= f
      w = -vx / radio
      a += w * DT; x += vx * DT; z += vz * DT
      if (Math.hypot(vx, vz) < 0.35) {
        meciendo = true
        const k1 = Math.round((a - Math.PI / 2) / (Math.PI * 2))
        const k2 = Math.round((a + Math.PI / 2) / (Math.PI * 2))
        const de1 = Math.PI / 2 + Math.PI * 2 * k1
        const de2 = -Math.PI / 2 + Math.PI * 2 * k2
        objetivo = Math.abs(de1 - a) < Math.abs(de2 - a) ? de1 : de2
      }
    } else {
      w += (-70 * (a - objetivo) - 7 * w) * DT
      const da = w * DT
      a += da
      x -= da * radio
      vz *= Math.exp(-4 * DT); z += vz * DT
    }
    if (i % 2 === 0) datos.push(x, y, z, a)
  }
  return { datos, paso: DT * 2, botes }
}

// La esfera: de fuera de cuadro a la cabeza en `golpe` segundos, con un poco
// de arco, y del golpe hacia atrás, rebotando hasta salir de cuadro.
function simularOrbe(golpe, impacto, suelo) {
  const datos = []
  const botes = []
  const pasos = Math.round(golpe / DT)
  for (let i = 0; i <= pasos; i++) {
    const s = i / pasos
    if (i % 2 === 0) {
      datos.push(
        lerp(ORBE_SALE.x, impacto.x, s),
        lerp(ORBE_SALE.y, impacto.y, s) + 0.3 * 4 * s * (1 - s),
        lerp(ORBE_SALE.z, impacto.z, s),
        0,
      )
    }
  }
  let x = impacto.x, y = impacto.y, z = impacto.z
  let vx = ORBE_REBOTA.vx, vy = ORBE_REBOTA.vy, vz = ORBE_REBOTA.vz
  for (let i = pasos + 1, t = 0; t < 3; i++, t += DT) {
    vy -= G * DT
    x += vx * DT; y += vy * DT; z += vz * DT
    if (y <= suelo && vy < 0) {
      y = suelo
      const fuerza = -vy
      if (fuerza > 0.4) botes.push({ t: golpe + t, fuerza: Math.min(1, fuerza / 4) })
      vy = fuerza > 0.8 ? fuerza * 0.55 : 0
      vx *= 0.85; vz *= 0.85
    }
    if (y <= suelo + 1e-4 && vy === 0) { const f = Math.exp(-0.9 * DT); vx *= f; vz *= f }
    if (i % 2 === 0) datos.push(x, y, z, 0)
  }
  return { datos, paso: DT * 2, botes }
}

// Piezas rígidas en el cuello. Hay vértices que reparten su peso entre el
// cuello y la cabeza; al despegar la cabeza, esa vértebra se estiraba como
// chicle hasta el piso (Oscar). Cada pieza (vértices unidos por triángulos o
// por estar en el mismo lugar, como en las costuras) se va completa con la
// cabeza o con el cuello, según de cuál tenga más peso: lo mismo que hace el
// desarme del rayo (characterPieces.js). Se calcula una vez, al crear el
// numerito, y se pone solo mientras dura.
function piezasRigidas(personaje, cabeza, cuello) {
  const enCabeza = new Set()
  cabeza.traverse((o) => { if (o.isBone) enCabeza.add(o) })
  const cambios = []
  personaje.traverse((m) => {
    if (!m.isSkinnedMesh) return
    const g = m.geometry
    const si = g.getAttribute('skinIndex')
    const sw = g.getAttribute('skinWeight')
    const pos = g.getAttribute('position')
    const huesosMalla = m.skeleton?.bones
    if (!si || !sw || !pos || !huesosMalla) return
    const esCabeza = huesosMalla.map((b) => enCabeza.has(b))
    const iCabeza = huesosMalla.indexOf(cabeza)
    const iCuello = huesosMalla.indexOf(cuello)
    const n = si.count
    const pesoCabeza = new Float32Array(n)
    let mixtos = false
    for (let v = 0; v < n; v++) {
      let w = 0
      for (let k = 0; k < 4; k++) if (esCabeza[si.getComponent(v, k)]) w += sw.getComponent(v, k)
      pesoCabeza[v] = w
      if (w > 0.001 && w < 0.999) mixtos = true
    }
    if (!mixtos || iCabeza < 0 || iCuello < 0) return

    const padre = new Int32Array(n)
    for (let v = 0; v < n; v++) padre[v] = v
    const raiz = (v) => { while (padre[v] !== v) { padre[v] = padre[padre[v]]; v = padre[v] } return v }
    const une = (a, b) => { a = raiz(a); b = raiz(b); if (a !== b) padre[a] = b }
    const idx = g.getIndex()
    if (idx) {
      for (let t = 0; t < idx.count; t += 3) { une(idx.getX(t), idx.getX(t + 1)); une(idx.getX(t), idx.getX(t + 2)) }
    } else {
      for (let t = 0; t + 2 < n; t += 3) { une(t, t + 1); une(t, t + 2) }
    }
    const enSitio = new Map()
    for (let v = 0; v < n; v++) {
      const clave = `${Math.round(pos.getX(v) * 1e4)},${Math.round(pos.getY(v) * 1e4)},${Math.round(pos.getZ(v) * 1e4)}`
      const otro = enSitio.get(clave)
      if (otro === undefined) enSitio.set(clave, v)
      else une(v, otro)
    }
    const suma = new Map()
    const cuenta = new Map()
    const conMixtos = new Set()
    for (let v = 0; v < n; v++) {
      const rz = raiz(v)
      suma.set(rz, (suma.get(rz) || 0) + pesoCabeza[v])
      cuenta.set(rz, (cuenta.get(rz) || 0) + 1)
      if (pesoCabeza[v] > 0.001 && pesoCabeza[v] < 0.999) conMixtos.add(rz)
    }
    if (!conMixtos.size) return

    // La geometría es la del GLB, compartida con los demás Skulleys (el del
    // home, detrás): no se toca. Se arma una aparte que comparte todo menos
    // los pesos, y se intercambia en la malla mientras dura el numerito.
    const siR = si.clone()
    const swR = sw.clone()
    for (let v = 0; v < n; v++) {
      const rz = raiz(v)
      if (!conMixtos.has(rz)) continue
      const aCabeza = suma.get(rz) / cuenta.get(rz) >= 0.5
      let total = 0
      for (let k = 0; k < 4; k++) {
        if (esCabeza[siR.getComponent(v, k)] === aCabeza) total += swR.getComponent(v, k)
        else swR.setComponent(v, k, 0)
      }
      if (total > 1e-4) {
        for (let k = 0; k < 4; k++) swR.setComponent(v, k, swR.getComponent(v, k) / total)
      } else {
        siR.setComponent(v, 0, aCabeza ? iCabeza : iCuello)
        swR.setComponent(v, 0, 1)
        for (let k = 1; k < 4; k++) swR.setComponent(v, k, 0)
      }
    }
    const rigida = new THREE.BufferGeometry()
    for (const [nombre, attr] of Object.entries(g.attributes)) {
      rigida.setAttribute(nombre, nombre === 'skinIndex' ? siR : nombre === 'skinWeight' ? swR : attr)
    }
    rigida.morphAttributes = g.morphAttributes
    rigida.morphTargetsRelative = g.morphTargetsRelative
    rigida.setIndex(g.getIndex())
    for (const gr of g.groups) rigida.addGroup(gr.start, gr.count, gr.materialIndex)
    rigida.boundingBox = g.boundingBox
    rigida.boundingSphere = g.boundingSphere
    cambios.push({ malla: m, original: g, rigida })
  })
  return {
    poner: () => { for (const c of cambios) c.malla.geometry = c.rigida },
    quitar: () => { for (const c of cambios) c.malla.geometry = c.original },
    piezas: cambios.length,
    geometria: (m) => cambios.find((c) => c.malla === m)?.rigida || m.geometry,
  }
}

// ── La forma real contra el piso ──────────────────────────────────────────
// Nada atraviesa el piso (Oscar, 2026-11-12: "es muy obvio para el espectador
// que eso es un error"). La cabeza como esfera y las poses encima del mixer
// metían los pies, la quijada y el cráneo entero bajo el charco del foco. La
// forma real sale de lib/nubePiso.js: el contorno de cada hueso, en su propio
// espacio, armado en un Worker al montar (son ~146 mil vértices). Mientras
// llega, el numerito no ha empezado: arranca segundos después de montar.
//
// Entrega { cabeza, brazoL, brazoR, piernaL, cuerpo, cuerpoYPierna }: listas
// de { huesos, datos, usados, filas } (los registros de nubePiso.js de una
// malla y su esqueleto). `cuerpo` es todo lo demás (con la pierna derecha).
function pedirNube(personaje, { cabeza, hombroL, hombroR, musloL }, geometria, listo) {
  const desciende = (o, raiz) => { for (let x = o; x; x = x.parent) if (x === raiz) return true; return false }
  const plano = (a) => {
    if (!a) return null
    if (a.isInterleavedBufferAttribute) {
      const out = new Float32Array(a.count * a.itemSize)
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k)
      return { array: out, itemSize: a.itemSize, normalized: false }
    }
    // Una vista sobre el binario del GLB se copiaría entero: solo su tramo.
    const vista = a.array.byteOffset !== 0 || a.array.byteLength !== a.array.buffer.byteLength
    return { array: vista ? a.array.slice() : a.array, itemSize: a.itemSize, normalized: a.normalized }
  }
  const objs = []
  const mallas = []
  personaje.traverse((m) => {
    if (!m.isMesh) return
    const g = m.isSkinnedMesh ? geometria(m) : m.geometry
    const pos = g.getAttribute('position')
    if (!pos) return
    const si = g.getAttribute('skinIndex')
    const sw = g.getAttribute('skinWeight')
    const piel = Boolean(m.isSkinnedMesh && m.skeleton && si && sw)
    let inversos = null
    if (piel) {
      inversos = new Float64Array(m.skeleton.boneInverses.length * 16)
      m.skeleton.boneInverses.forEach((mi, i) => inversos.set(mi.elements, i * 16))
    }
    objs.push(m)
    mallas.push({
      pos: plano(pos),
      si: piel ? plano(si) : null,
      sw: piel ? plano(sw) : null,
      bind: piel ? Float64Array.from(m.bindMatrix.elements) : null,
      inversos,
    })
  })
  const armar = (res) => {
    const nube = { cabeza: [], brazoL: [], brazoR: [], piernaL: [], cuerpo: [] }
    res.forEach(({ datos, dominante }, i) => {
      const m = objs[i]
      const huesos = m.isSkinnedMesh && m.skeleton ? m.skeleton.bones : [m]
      const porLista = new Map()
      for (let k = 0; k < dominante.length; k++) {
        const obj = dominante[k] < 0 ? m : huesos[dominante[k]]
        if (!obj) continue
        const lista = desciende(obj, cabeza) ? 'cabeza'
          : hombroL && desciende(obj, hombroL) ? 'brazoL'
            : hombroR && desciende(obj, hombroR) ? 'brazoR'
              : desciende(obj, musloL) ? 'piernaL' : 'cuerpo'
        let regs = porLista.get(lista)
        if (!regs) porLista.set(lista, (regs = []))
        regs.push(k)
      }
      // Un grupo por hueso dominante, con su cota: cada punto está a no más
      // de `radio` del origen de cada hueso que lo mueve, así que en cualquier
      // pose ningún punto del grupo baja de min(origen.y − escala · radio).
      const filas = new Float64Array(huesos.length * 4)
      for (const [lista, regs] of porLista) {
        const porDom = new Map()
        for (const k of regs) {
          const d = dominante[k] < 0 ? 0 : dominante[k]
          let arr = porDom.get(d)
          if (!arr) porDom.set(d, (arr = []))
          arr.push(k)
        }
        for (const ks of porDom.values()) {
          const sub = new Float32Array(ks.length * PASO)
          const radios = new Map()
          ks.forEach((k, j) => {
            sub.set(datos.subarray(k * PASO, (k + 1) * PASO), j * PASO)
            for (let c = 0, o = j * PASO + 1; c < sub[j * PASO]; c++, o += 5) {
              if (sub[o] < 0) sub[o] = 0 // sin piel: la malla misma
              const r = Math.hypot(sub[o + 2], sub[o + 3], sub[o + 4])
              radios.set(sub[o], Math.max(radios.get(sub[o]) || 0, r))
            }
          })
          nube[lista].push({
            huesos,
            datos: sub,
            filas,
            usados: Int32Array.from(radios.keys()),
            radios: Float64Array.from(radios.values()),
            cota: 0,
          })
        }
      }
    })
    // Una lista aparte (bajoDe la reordena): mismos grupos.
    nube.cuerpoYPierna = nube.cuerpo.concat(nube.piernaL)
    listo(nube)
  }
  const enEsteHilo = () => {
    const correr = () => { try { armar(calcularNube(mallas)) } catch { } }
    if ('requestIdleCallback' in window) window.requestIdleCallback(correr, { timeout: 3000 })
    else setTimeout(correr, 0)
  }
  try {
    const w = new Worker(new URL('./nubePiso.worker.js', import.meta.url), { type: 'module' })
    w.onmessage = (e) => { w.terminate(); armar(e.data) }
    w.onerror = () => { w.terminate(); enEsteHilo() }
    w.postMessage({ mallas })
  } catch { enEsteHilo() }
}

// El punto más bajo (y en mundo) de una lista de la nube: por cada punto,
// Σ peso · (fila y de la matriz de su hueso · su posición en ese hueso). Los
// grupos van de la cota más baja a la más alta y se deja de buscar cuando la
// cota ya no puede ganarle al mínimo: en el cuerpo solo se revisan los pies.
function bajoDe(lista) {
  for (const g of lista) {
    let cota = Infinity
    for (let u = 0; u < g.usados.length; u++) {
      const e = g.huesos[g.usados[u]].matrixWorld.elements
      // La norma de Frobenius acota cuánto estira la matriz cualquier vector,
      // aun con escalas desiguales (los huesos _stretch) que la deforman.
      const escala = Math.sqrt(
        e[0] * e[0] + e[1] * e[1] + e[2] * e[2]
        + e[4] * e[4] + e[5] * e[5] + e[6] * e[6]
        + e[8] * e[8] + e[9] * e[9] + e[10] * e[10],
      )
      cota = Math.min(cota, e[13] - escala * g.radios[u])
    }
    g.cota = cota
  }
  lista.sort((a, b) => a.cota - b.cota)
  let min = Infinity
  for (const g of lista) {
    if (g.cota >= min) break
    const { huesos, datos, usados, filas } = g
    for (let u = 0; u < usados.length; u++) {
      const b = usados[u]
      const e = huesos[b].matrixWorld.elements
      const o = b * 4
      filas[o] = e[1]; filas[o + 1] = e[5]; filas[o + 2] = e[9]; filas[o + 3] = e[13]
    }
    for (let r = 0; r < datos.length; r += PASO) {
      let y = 0
      for (let k = 0, o = r + 1; k < datos[r]; k++, o += 5) {
        const f = datos[o] * 4
        y += datos[o + 1] * (filas[f] * datos[o + 2] + filas[f + 1] * datos[o + 3] + filas[f + 2] * datos[o + 4] + filas[f + 3])
      }
      if (y < min) min = y
    }
  }
  return min
}


// `idle` y `camina`: las acciones del mixer (se mezclan aquí). `orbe`: la
// malla de la esfera, hija del contenedor del rig (se mueve en su espacio).
export function crearNumerito(personaje, { idle, camina, orbe } = {}) {
  const h = (n) => personaje.getObjectByName(n)
  const huesos = {
    cuello: h('neckx'),
    cabeza: h('headx'),
    quijada: h('c_jawbonex'),
    spine_01x: h('spine_01x'),
    spine_02x: h('spine_02x'),
    spine_03x: h('spine_03x'),
    brazoL: h('arm_stretchl'), antebrazoL: h('forearm_stretchl'), manoL: h('handl'),
    brazoR: h('arm_stretchr'), antebrazoR: h('forearm_stretchr'), manoR: h('handr'),
    musloL: h('thigh_stretchl'), piernaL: h('leg_stretchl'), pieL: h('footl'),
    rootx: h('rootx'),
  }
  if (Object.values(huesos).some((b) => !b)) return null
  const rigidas = piezasRigidas(personaje, huesos.cabeza, huesos.cuello)
  let nube = null
  const t0Nube = performance.now()
  pedirNube(personaje, { cabeza: huesos.cabeza, hombroL: h('shoulderl'), hombroR: h('shoulderr'), musloL: huesos.musloL }, rigidas.geometria, (n) => {
    nube = n
    if (import.meta.env.DEV) {
      const cuenta = (l) => l.reduce((k, x) => k + x.datos.length / PASO, 0)
      console.debug('[numerito] nube', { ms: Math.round(performance.now() - t0Nube), cabeza: cuenta(n.cabeza), cuerpo: cuenta(n.cuerpoYPierna), brazos: cuenta(n.brazoL) + cuenta(n.brazoR) })
    }
  })
  const patadaHuesos = KICK_BONES.filter((n) => n !== 'headx')
    .map((n) => [h(n), KICK_A[n], KICK_B[n]])
    .filter(([b]) => b)

  // La pose del mixer, hueso por hueso. three solo reescribe un hueso cuando
  // el valor de la animación cambia de un cuadro a otro: lo que se le pone
  // encima se queda pegado si la pista no se mueve (así se quedó la cabeza de
  // lado al saltar la historia, Oscar). Cada cuadro se compara con lo que se
  // escribió en el anterior: si sigue igual, el mixer no pasó y se regresa a
  // su pose antes de volver a mover; al terminar, igual.
  const tocados = [
    huesos.cabeza, huesos.quijada, huesos.spine_01x, huesos.spine_02x, huesos.spine_03x,
    huesos.brazoL, huesos.antebrazoL, huesos.brazoR, huesos.antebrazoR, huesos.musloL, huesos.piernaL,
  ]
  for (const [b] of patadaHuesos) if (!tocados.includes(b)) tocados.push(b)
  if (!tocados.includes(huesos.rootx)) tocados.push(huesos.rootx)
  const nuevaPose = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() })
  const delMixer = tocados.map(nuevaPose)
  const escrita = tocados.map(nuevaPose)
  let hayEscrita = false
  const igual = (b, e) => b.position.equals(e.p) && b.quaternion.equals(e.q) && b.scale.equals(e.s)
  const copiar = (e, b) => { e.p.copy(b.position); e.q.copy(b.quaternion); e.s.copy(b.scale) }
  const poner = (b, e) => { b.position.copy(e.p); b.quaternion.copy(e.q); b.scale.copy(e.s) }
  function partirDelMixer() {
    tocados.forEach((b, i) => {
      if (hayEscrita && igual(b, escrita[i])) poner(b, delMixer[i])
      else copiar(delMixer[i], b)
    })
  }
  function reponer() {
    if (!hayEscrita) return
    tocados.forEach((b, i) => { if (igual(b, escrita[i])) poner(b, delMixer[i]) })
    hayEscrita = false
  }

  let centroLocal = null // el centro del cráneo, en el espacio del hueso de la cabeza
  let derechaCabeza = null // la derecha de la cara, en el espacio del hueso de la cabeza
  let estado = null // la física, el camino y los sonidos de esta función
  let activo = false
  let tPrevio = 0
  let faseCamina = 0

  // Dónde va el cuerpo (en el espacio del rig), hacia dónde mira (giro sobre
  // su eje; 0 = a la cámara) y cuánto camina y a qué paso.
  function cuerpoEn(t) {
    const N = NUMERITO
    const e = estado
    const llega = e?.llega || { x: IDA, z: 0 }
    const parada = e?.parada || llega
    const psi1 = e?.psi1 ?? Math.PI / 2
    const psi2 = e?.psi2 ?? psi1
    let x = 0, z = 0, y = 0, psi = 0, vel = 0, paso = 0
    const enSitio = (u) => 0.5 * Math.sin(Math.PI * u)
    if (t >= N.golpe && t < N.despiste) {
      // El golpe lo empuja hacia donde iba la esfera y regresa.
      x = 0.1 * Math.sin(Math.PI * tramo(t, N.golpe, N.sacudida))
    } else if (t >= N.despiste && t < N.giro1) {
      const u = tramo(t, N.despiste, N.giro1)
      psi = -Math.PI / 2 * suave(u)
      paso = enSitio(u)
    } else if (t >= N.giro1 && t < N.camina1) {
      const u = tramo(t, N.giro1, N.camina1)
      x = IDA * trapecio(u)
      psi = -Math.PI / 2
      vel = (Math.abs(IDA) * trapecioVel(u)) / (N.camina1 - N.giro1)
    } else if (t >= N.camina1 && t < N.pausa) {
      x = IDA
      psi = -Math.PI / 2
    } else if (t >= N.pausa && t < N.giro2) {
      const u = tramo(t, N.pausa, N.giro2)
      x = IDA
      psi = lerp(-Math.PI / 2, psi1, suave(u))
      paso = enSitio(u)
    } else if (t >= N.giro2 && t < N.llega) {
      const u = tramo(t, N.giro2, N.llega)
      const f = trapecio(u)
      x = lerp(IDA, llega.x, f)
      z = lerp(0, llega.z, f)
      psi = psi1
      vel = (Math.hypot(llega.x - IDA, llega.z) * trapecioVel(u)) / (N.llega - N.giro2)
    } else if (t >= N.llega && t < N.giro3) {
      x = llega.x
      z = llega.z
      psi = psi1
      // Brinca en un pie del dolor mientras lo muerde: tres brincos que
      // terminan en el piso (cortado a media subida, caía de golpe).
      if (t >= N.muerde && t < N.muerde + BRINCOS / BRINCO_HZ) y = 0.035 * Math.abs(Math.sin(Math.PI * BRINCO_HZ * (t - N.muerde)))
    } else if (t >= N.giro3 && t < N.camina3) {
      const u = tramo(t, N.giro3, N.camina3)
      const f = trapecio(u)
      x = lerp(llega.x, parada.x, f)
      z = lerp(llega.z, parada.z, f)
      psi = lerp(psi1, psi2, suave(clamp01(u * 3)))
      vel = (Math.hypot(parada.x - llega.x, parada.z - llega.z) * trapecioVel(u)) / (N.camina3 - N.giro3)
    } else if (t >= N.camina3) {
      x = parada.x
      z = parada.z
      const u = tramo(t, N.suelta, N.deFrente)
      psi = lerp(psi2, 0, suave(u))
      if (u > 0 && u < 1) paso = enSitio(u)
    }
    let escala = 0.8
    if (vel > 0) {
      paso = suave(clamp01(vel / 0.35))
      escala = Math.min(1.4, Math.max(0.4, vel / PASO_VEL))
    }
    return { x, y, z, psi, paso, escala }
  }

  function arrancar(rig, fit, idleCentro) {
    rigidas.poner()
    if (camina) {
      camina.reset()
      camina.setEffectiveWeight(0)
      camina.play()
    }
    const radio = fit.alto * RADIO_CRANEO
    const centroRig = rig.worldToLocal(idleCentro.clone())
    // La esfera llega por la izquierda: toca el cráneo por ese lado.
    const lado = ORBE_SALE.clone().sub(centroRig).normalize()
    const impacto = centroRig.clone().addScaledVector(lado, radio + RADIO_ORBE)
    const orbeSim = simularOrbe(NUMERITO.golpe, impacto, fit.piso + RADIO_ORBE)
    const N = NUMERITO
    estado = {
      radio,
      orbeSim,
      cabezaSim: null,
      cabezaSim2: null,
      q0: null,
      relPierna: null,
      eventos: [
        { t: 0.02, hacer: () => playOrbKick(0.7) },
        { t: N.golpe, hacer: () => { playOrbHit(1, 0.18); playEyePop() } },
        // El ñam y los quejidos de hule mientras lo muerde.
        { t: N.muerde + 0.06, hacer: () => { playOrbHit(0.9, 0.1); playEyePoke(0) } },
        { t: N.muerde + 0.3, hacer: () => playEyePoke(1) },
        { t: N.muerde + 0.55, hacer: () => playEyePoke(2) },
        { t: N.muerde + 0.8, hacer: () => playEyePoke(3) },
        { t: N.patada + PATADA.suelta, hacer: () => { playOrbKick(1); playEyePop() } },
        { t: N.tronido - 0.08, hacer: () => playEyeRespawn() },
        ...orbeSim.botes.map((b) => ({ t: b.t, hacer: () => playOrbBounce(b.fuerza * 0.8, 0.18) })),
      ],
    }
  }

  // `t`: segundos desde que arrancó. `rig`: el contenedor que gira con la
  // cámara. `fit`: medidas del personaje (alto, piso, headY). Devuelve a dónde
  // debe apuntar el foco (en mundo).
  function aplicar(t, rig, fit) {
    const N = NUMERITO
    partirDelMixer()
    const alto = fit.alto

    // ── El cuerpo: dónde va y hacia dónde mira ────────────────────────────
    const cuerpo = cuerpoEn(t)
    personaje.position.set(cuerpo.x, cuerpo.y, cuerpo.z)
    personaje.rotation.set(0, cuerpo.psi, 0)
    rig.updateMatrixWorld(true)
    const rigQ = rig.getWorldQuaternion(new THREE.Quaternion())
    const rigQi = rigQ.clone().invert()
    const cuerpoQ = personaje.getWorldQuaternion(new THREE.Quaternion())
    const derecha = EJE_X.clone().applyQuaternion(cuerpoQ)
    const arriba = EJE_Y.clone().applyQuaternion(cuerpoQ)
    const adelante = EJE_Z.clone().applyQuaternion(cuerpoQ)
    const delCuerpo = (x, y, z) => personaje.localToWorld(new THREE.Vector3(x, y, z))

    // ── La cabeza puesta según el idle de este cuadro ─────────────────────
    const cab = huesos.cabeza
    const idleLocal = new THREE.Matrix4().compose(cab.position, cab.quaternion, cab.scale)
    const idleMundo = new THREE.Matrix4().multiplyMatrices(huesos.cuello.matrixWorld, idleLocal)
    const idleQ = new THREE.Quaternion()
    idleMundo.decompose(_v1, idleQ, _s)
    const escala = _s.clone()
    if (!centroLocal) {
      // El centro del cráneo, entre el cuello y la cara, y la derecha de la
      // cara, medidos una vez en el espacio del cuerpo (así no importa dónde
      // esté parado).
      const origen = personaje.worldToLocal(new THREE.Vector3().setFromMatrixPosition(idleMundo))
      centroLocal = delCuerpo(0, fit.headY + alto * 0.02, origen.z).applyMatrix4(idleMundo.clone().invert())
      derechaCabeza = derecha.clone().applyQuaternion(idleQ.clone().invert())
    }
    const idleCentro = centroLocal.clone().applyMatrix4(idleMundo)

    if (!activo) { activo = true; arrancar(rig, fit, idleCentro) }
    const e = estado
    if (!e.cabezaSim && t >= N.golpe) {
      // La cabeza sale volando desde donde está justo al golpe.
      const p0 = rig.worldToLocal(idleCentro.clone())
      e.q0 = rigQi.clone().multiply(idleQ)
      e.cabezaSim = simularCabeza(p0, fit.piso + e.radio, e.radio)
      for (const b of e.cabezaSim.botes) e.eventos.push({ t: N.golpe + b.t, hacer: () => playOrbBounce(b.fuerza, 0.45) })
      // Se para con la cabeza enfrente de su espinilla izquierda.
      const fin = muestra(e.cabezaSim, 99)
      e.psi1 = Math.atan2(fin.x - IDA, fin.z)
      const fx = Math.sin(e.psi1), fz = Math.cos(e.psi1) // hacia donde mira
      const ix = Math.cos(e.psi1), iz = -Math.sin(e.psi1) // su izquierda
      e.llega = {
        x: fin.x - fx * MORDIDA.adelante - ix * MORDIDA.lado,
        z: fin.z - fz * MORDIDA.adelante - iz * MORDIDA.lado,
      }
    }

    // ── La pierna: del dolor la sacude con la cabeza colgando… ────────────
    // Con la cabeza colgando, la pierna no regresa al piso: la sacudida la
    // sostiene hasta que la patada ya la tomó completa.
    const pesoPierna = suave(tramo(t, N.muerde, N.muerde + 0.15)) * (1 - suave(tramo(t, N.patada, N.patada + 0.1)))
    if (pesoPierna > 0.001) {
      const sacude = delCuerpo(
        0.14 + 0.05 * Math.sin(Math.PI * 2 * 7 * t),
        0.24 + 0.04 * Math.sin(Math.PI * 2 * 9 * t),
        0.14 + 0.05 * Math.sin(Math.PI * 2 * 7 * t + 1),
      )
      const cadera = huesos.musloL.getWorldPosition(new THREE.Vector3())
      const rodilla = cadera.addScaledVector(adelante, 0.6 * alto).addScaledVector(arriba, -0.1 * alto)
      ik(huesos.musloL, huesos.piernaL, huesos.pieL, sacude, rodilla, pesoPierna)
    }

    // …y la patea con la patada del juego (kickPose.js, posada en el Pose
    // Studio; Oscar: la de IK se veía chafa). Patea con la izquierda, la misma
    // que muerde. Igual que en Player.jsx: recoge, latigazo, aguanta y regresa,
    // con el peso de la cadera. La cabeza no entra: va suelta.
    const patada = pesoPatada(t)
    if (patada.W > 0.001) {
      for (const [hueso, a, b] of patadaHuesos) {
        _q1.copy(a).slerp(b, patada.P)
        hueso.quaternion.slerp(_q1, patada.W)
      }
      if (huesos.rootx) huesos.rootx.position.add(_v1.copy(KICK_ROOT_A).lerp(KICK_ROOT_B, patada.P).multiplyScalar(patada.W))
      personaje.updateMatrixWorld(true)
    }

    // ── La columna: el susto, la búsqueda, el dolor, agacharse ────────────
    const susto = t > N.golpe ? -0.55 * Math.exp(-5 * (t - N.golpe)) * Math.sin(Math.min(1, (t - N.golpe) * 10) * Math.PI / 2) : 0
    const tantea = 0.12 * Math.max(
      suave(tramo(t, N.despiste, N.giro1)) * (1 - suave(tramo(t, N.llega - 0.3, N.acecha))),
      suave(tramo(t, N.despiste2, N.giro3)) * (1 - suave(tramo(t, N.camina3 - 0.3, N.laVe))),
    )
    const dobla = suave(tramo(t, N.camina3, N.agachado)) * (1 - suave(tramo(t, N.agarra, N.enPecho)))
    const inclina = Math.max(tantea, dobla) + susto
    let voltea = 0
    if (t < N.despiste) voltea = Math.sin(tramo(t, N.sacudida, N.despiste) * Math.PI * 2) * 0.32
    else if (t >= N.muerde && t < N.patada) voltea = 0.14 * Math.sin(Math.PI * 2 * 6 * t)
    else if (t >= N.sueltaPierna && t < N.giro3) voltea = Math.sin(tramo(t, N.sueltaPierna, N.despiste2) * Math.PI * 2) * 0.3
    else voltea = Math.sin(tramo(t, N.deFrente, N.confundido) * Math.PI * 2) * 0.3
    for (const n of ['spine_01x', 'spine_02x', 'spine_03x']) {
      const b = huesos[n]
      b.getWorldQuaternion(_q1).invert()
      if (inclina) b.quaternion.multiply(_q2.setFromAxisAngle(_v1.copy(derecha).applyQuaternion(_q1), DOBLA[n] * inclina))
      if (n === 'spine_03x' && voltea) b.quaternion.multiply(_q2.setFromAxisAngle(_v1.copy(arriba).applyQuaternion(_q1), voltea))
      b.updateMatrixWorld(true)
    }

    // ── Los pies en el piso ───────────────────────────────────────────────
    // El punto más bajo del cuerpo (sin la cabeza ni los brazos) toca el piso
    // en cada cuadro, más el brinco: la caminata mezclada con el idle, los
    // giros en su lugar y la cadera de la patada lo enterraban o lo dejaban
    // flotando. En lo fuerte de la patada cuenta solo el pie de apoyo: con los
    // dos, el pie que patea pasaba bajo la cadera y levantaba a Skulley entero
    // 0.26. De regreso, ya cerca del piso, vuelve a contar como al caminar.
    const pateando = patada.W > 0.5
    const pisoY = fit.piso
    // Lo que separa la forma del piso: el contorno de cada pieza se toma en
    // direcciones de muestra, y entre una y otra puede quedar un pelo por
    // debajo. Una milésima del alto (menos de un pixel) lo absorbe.
    const holgura = alto * HOLGURA
    const aterriza = () => {
      if (!nube) return
      personaje.updateMatrixWorld(true)
      const dy = pisoY + holgura + cuerpo.y - bajoDe(pateando ? nube.cuerpo : nube.cuerpoYPierna)
      if (Math.abs(dy) < 1e-6) return
      personaje.position.y += dy
      personaje.updateMatrixWorld(true)
    }
    aterriza()
    // Y el pie que patea, si roza el piso, dobla la rodilla lo justo (IK de la
    // pierna hacia arriba, la rodilla hacia adelante).
    if (nube && pateando) {
      const poloRodilla = huesos.musloL.getWorldPosition(new THREE.Vector3())
        .addScaledVector(adelante, 0.6 * alto)
        .addScaledVector(arriba, -0.1 * alto)
      for (let k = 0; k < 4; k++) {
        const falta = pisoY + holgura - bajoDe(nube.piernaL)
        if (falta <= 1e-5) break
        const p = huesos.pieL.getWorldPosition(new THREE.Vector3())
        p.y += falta
        ik(huesos.musloL, huesos.piernaL, huesos.pieL, p, poloRodilla, 1)
      }
    }
    // El cuello ya está donde quedó (la columna, la patada y los pies en el
    // piso lo movieron): de ahí sale a dónde regresa la cabeza.
    idleMundo.multiplyMatrices(huesos.cuello.matrixWorld, idleLocal)
    idleMundo.decompose(_v1, idleQ, _s)
    idleCentro.copy(centroLocal).applyMatrix4(idleMundo)

    // ── La cabeza ─────────────────────────────────────────────────────────
    const ejeLocal = arriba.clone().applyQuaternion(idleQ.clone().invert())
    const giroPuesta = t < N.manosArriba ? Math.PI : (() => {
      const u = tramo(t, N.manosArriba + 0.05, N.tronido)
      // De golpe, se pasa un poco y regresa.
      return Math.PI * (1 - sale(u)) - 0.28 * Math.sin(u * Math.PI)
    })()
    const puestaQ = idleQ.clone().multiply(_q1.setFromAxisAngle(ejeLocal, giroPuesta))
    let mundo = null // la matriz de la cabeza en mundo, si va suelta
    let fase = null // 'suelta' (vuela, rueda, reposa o va en las manos) o 'pegada' (a la pierna)
    let crearRel = false
    const aMatriz = (centroRig, q) => _m2.compose(rig.localToWorld(centroRig.clone()), q, escala)
      .multiply(new THREE.Matrix4().makeTranslation(-centroLocal.x, -centroLocal.y, -centroLocal.z))
    if (e.cabezaSim && t < N.puesta) {
      const fin1 = muestra(e.cabezaSim, 99)
      const reposo1 = new THREE.Vector3(fin1.x, fin1.y, fin1.z)
      const acostada1 = rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Z, fin1.a).multiply(e.q0))
      // Donde muerde: abajo de la espinilla, y la cabeza enfrente, de cara a
      // la pierna y apoyada en el piso.
      const rodilla = huesos.piernaL.getWorldPosition(new THREE.Vector3())
      const tobillo = huesos.pieL.getWorldPosition(new THREE.Vector3())
      const mordida = rodilla.lerp(tobillo, 0.55)
      const haciaCab = rig.localToWorld(reposo1.clone()).sub(mordida).setY(0).normalize()
      const deCara = rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Y, Math.atan2(-haciaCab.x, -haciaCab.z)).multiply(e.q0))
      fase = 'suelta'
      if (t < N.acecha) {
        const m = muestra(e.cabezaSim, t - N.golpe)
        mundo = aMatriz(new THREE.Vector3(m.x, m.y, m.z), rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Z, m.a).multiply(e.q0)))
      } else if (t < N.muerde + 0.1) {
        // Se endereza en el piso de cara a la pierna, con un brinquito, y se lanza.
        const u = suave(tramo(t, N.acecha, N.muerde))
        const q = acostada1.clone().slerp(deCara, u)
        const lanza = sale(tramo(t, N.muerde, N.muerde + 0.1))
        const objetivo = rig.worldToLocal(mordida.clone().addScaledVector(haciaCab, e.radio * 0.85))
        objetivo.y = Math.max(objetivo.y, fit.piso + e.radio * 0.92)
        const c = reposo1.clone().lerp(objetivo, lanza)
        c.y += alto * 0.025 * Math.sin(Math.PI * tramo(t, N.acecha, N.muerde))
        mundo = aMatriz(c, q)
      } else if (t < N.patada + PATADA.suelta) {
        // Prendida de la espinilla: va pegada al hueso de la pierna. El primer
        // cuadro es el último del salto; ya asentada en el piso, se guarda
        // dónde quedó respecto a la pierna (abajo, con `crearRel`).
        if (!e.relPierna) {
          const objetivo = rig.worldToLocal(mordida.clone().addScaledVector(haciaCab, e.radio * 0.85))
          objetivo.y = Math.max(objetivo.y, fit.piso + e.radio * 0.92)
          mundo = aMatriz(objetivo, deCara)
          crearRel = true
        } else {
          mundo = huesos.piernaL.matrixWorld.clone().multiply(e.relPierna)
          fase = 'pegada'
        }
      } else {
        if (!e.cabezaSim2) {
          // La patada: sale desde donde iba, en arco, hacia la cámara.
          const suelta = huesos.piernaL.matrixWorld.clone().multiply(e.relPierna || new THREE.Matrix4())
          const q = new THREE.Quaternion()
          suelta.decompose(_v1, q, _s)
          const centro = rig.worldToLocal(centroLocal.clone().applyMatrix4(suelta))
          e.q0b = rigQi.clone().multiply(q)
          const fwd = adelante.clone().applyQuaternion(rigQi)
          e.cabezaSim2 = simularCabeza(centro, fit.piso + e.radio, e.radio, {
            vx: fwd.x * PATADA_SALE.adelante,
            vy: PATADA_SALE.vy,
            vz: fwd.z * PATADA_SALE.adelante + PATADA_SALE.haciaCamara,
            giro: PATADA_SALE.giro,
          })
          for (const b of e.cabezaSim2.botes) e.eventos.push({ t: N.patada + PATADA.suelta + b.t, hacer: () => playOrbBounce(b.fuerza, 0.45) })
          // Va por ella: se para a lo que alcanza agachándose.
          const fin2 = muestra(e.cabezaSim2, 99)
          const dx = fin2.x - cuerpo.x
          const dz = fin2.z - cuerpo.z
          const largo = Math.max(1e-3, Math.hypot(dx, dz))
          e.parada = { x: fin2.x - (dx / largo) * ANTES_DE_CABEZA, z: fin2.z - (dz / largo) * ANTES_DE_CABEZA }
          e.psi2 = Math.atan2(dx, dz)
        }
        const fin2 = muestra(e.cabezaSim2, 99)
        const acostada2 = rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Z, fin2.a).multiply(e.q0))
        if (t < N.agarra) {
          const vuela = t - N.patada - PATADA.suelta
          const m = muestra(e.cabezaSim2, vuela)
          const base = e.q0b.clone().slerp(e.q0, suave(tramo(vuela, 0, ACOMODO)))
          mundo = aMatriz(new THREE.Vector3(m.x, m.y, m.z), rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Z, m.a).multiply(base)))
        } else {
          // En las manos: del piso al pecho y del pecho al cuello.
          const reposo = new THREE.Vector3(fin2.x, fin2.y, fin2.z)
          const pecho = rig.worldToLocal(delCuerpo(0, fit.piso + alto * 0.47, alto * CARGA_ADELANTE))
          const cuello = rig.worldToLocal(idleCentro.clone())
          let c
          if (t < N.enPecho) {
            c = reposo.lerp(pecho, suave(tramo(t, N.agarra, N.enPecho)))
          } else {
            const s = suave(tramo(t, N.enPecho, N.puesta))
            c = pecho.lerp(cuello, s)
            c.y += alto * 0.05 * Math.sin(s * Math.PI)
          }
          mundo = aMatriz(c, acostada2.slerp(puestaQ, suave(tramo(t, N.agarra, N.puesta - 0.25))))
        }
      }
    }
    const ponerCabeza = (m) => {
      new THREE.Matrix4().multiplyMatrices(huesos.cuello.matrixWorld.clone().invert(), m)
        .decompose(cab.position, cab.quaternion, _s)
      cab.updateMatrixWorld(true)
    }
    if (mundo) {
      ponerCabeza(mundo)
    } else if (t >= N.puesta && giroPuesta !== 0) {
      // Puesta (al revés y luego derecha): su pose local con el giro encima.
      cab.quaternion.multiply(_q1.setFromAxisAngle(ejeLocal, giroPuesta))
    }
    cab.updateMatrixWorld(true)

    // La boca: se abre al acechar, se cierra de golpe al morder y va abierta
    // del grito mientras vuela de la patada.
    let boca = 0
    if (t >= N.acecha && t < N.muerde + 0.06) boca = sale(tramo(t, N.acecha, N.muerde)) * (1 - tramo(t, N.muerde, N.muerde + 0.06))
    else if (t >= N.patada) boca = 0.8 * Math.sin(Math.PI * tramo(t, N.patada, N.patada + 0.9))
    if (boca > 0.001) {
      const q = huesos.quijada
      const derechaMundo = derechaCabeza.clone().applyQuaternion(cab.getWorldQuaternion(new THREE.Quaternion()))
      q.getWorldQuaternion(_q1).invert()
      q.quaternion.multiply(_q2.setFromAxisAngle(derechaMundo.applyQuaternion(_q1), MORDIDA.abre * boca))
      q.updateMatrixWorld(true)
    }

    // ── La cabeza contra el piso ──────────────────────────────────────────
    // Suelta: nunca más abajo del piso y, ya cerca de donde reposa, apoyada en
    // su punto más bajo de verdad (el mohawk, la quijada abierta, un lado del
    // cráneo), no en la esfera de la física. Así rueda sobre su forma.
    const subirCabeza = (dy) => {
      if (Math.abs(dy) < 1e-6) return
      const p = cab.getWorldPosition(new THREE.Vector3())
      p.y += dy
      cab.position.copy(huesos.cuello.worldToLocal(p))
      cab.updateMatrixWorld(true)
    }
    if (nube && (fase === 'suelta' || crearRel)) {
      const falta = pisoY + holgura - bajoDe(nube.cabeza)
      const centroY = _v1.copy(centroLocal).applyMatrix4(cab.matrixWorld).y
      const cerca = 1 - clamp01((centroY - (pisoY + e.radio)) / (e.radio * ASIENTA))
      subirCabeza(falta > 0 ? falta : falta * cerca)
    } else if (nube && fase === 'pegada') {
      // Mordiendo la espinilla: al pasar la pierna de la sacudida (adelante) a
      // la patada (atrás) la espinilla cruza por abajo y la cabeza rozaba el
      // piso unos 40 ms. Sube derecho lo que le falta: es lo que menos se
      // mueve (girarla sobre la mordida, como péndulo, la barría 38° de golpe,
      // y subir la rodilla metía al piso el pie de atrás).
      subirCabeza(Math.max(0, pisoY + holgura - bajoDe(nube.cabeza)))
    }
    if (crearRel) e.relPierna = huesos.piernaL.matrixWorld.clone().invert().multiply(cab.matrixWorld)

    // ── Las manos ─────────────────────────────────────────────────────────
    // Del susto y del dolor, arriba; caminando, por delante a tientas; con la
    // cabeza, a los lados del cráneo. Gana la que pese más en este momento.
    const pesoSusto = (1 - patada.W) * Math.max(
      0.8 * suave(tramo(t, N.golpe + 0.03, N.golpe + 0.25)) * (1 - suave(tramo(t, N.sacudida - 0.2, N.despiste - 0.3))),
      0.85 * suave(tramo(t, N.muerde + 0.03, N.muerde + 0.2)) * (1 - suave(tramo(t, N.patada + 0.15, N.sueltaPierna + 0.2))),
    )
    const pesoTantea = 0.9 * Math.max(
      suave(tramo(t, N.despiste, N.giro1)) * (1 - suave(tramo(t, N.llega - 0.25, N.acecha))),
      suave(tramo(t, N.despiste2, N.giro3)) * (1 - suave(tramo(t, N.camina3 - 0.25, N.laVe))),
    )
    const pesoCabeza = Math.max(
      suave(tramo(t, N.laVe, N.agachado - 0.1)) * (1 - suave(tramo(t, N.puesta, N.suelta))),
      suave(tramo(t, N.confundido, N.manosArriba)) * (1 - suave(tramo(t, N.tronido, N.fin))),
    )
    const centroCab = centroLocal.clone().applyMatrix4(cab.matrixWorld)
    const aleteo = t >= N.muerde && t < N.sueltaPierna ? 0.1 * Math.sin(Math.PI * 2 * 5 * t) : 0
    for (const [s, brazo, antebrazo, mano] of [
      [1, huesos.brazoL, huesos.antebrazoL, huesos.manoL],
      [-1, huesos.brazoR, huesos.antebrazoR, huesos.manoR],
    ]) {
      let peso = 0
      let objetivo = null
      if (pesoCabeza >= pesoTantea && pesoCabeza >= pesoSusto && pesoCabeza > 0.001) {
        peso = pesoCabeza
        objetivo = centroCab.clone().addScaledVector(derecha, s * alto * RADIO_CRANEO * 1.05)
      } else if (pesoTantea >= pesoSusto && pesoTantea > 0.001) {
        peso = pesoTantea
        const vaiven = 0.08 * Math.sin(Math.PI * 2 * 0.8 * t + (s > 0 ? 0 : Math.PI))
        const sube = 0.04 * Math.sin(Math.PI * 2 * 1.6 * t + (s > 0 ? 0 : Math.PI))
        objetivo = delCuerpo(s * 0.16 + vaiven, 1.0 + sube, 0.5)
      } else if (pesoSusto > 0.001) {
        peso = pesoSusto
        objetivo = delCuerpo(s * 0.38, 1.42 + aleteo * s, 0.16)
      }
      const polo = brazo.getWorldPosition(new THREE.Vector3())
        .addScaledVector(derecha, s * CODO.x * alto)
        .addScaledVector(arriba, CODO.y * alto)
        .addScaledVector(adelante, CODO.z * alto)
      if (objetivo) ik(brazo, antebrazo, mano, objetivo, polo, peso)
      // Agachado por la cabeza, la punta de los dedos se metía en el piso:
      // la mano sube lo que falte. Solo se revisa con la mano cerca del piso.
      if (nube && mano.getWorldPosition(_v1).y - pisoY < alto * 0.35) {
        const lista = s > 0 ? nube.brazoL : nube.brazoR
        for (let k = 0; k < 3; k++) {
          const falta = pisoY + holgura - bajoDe(lista)
          if (falta <= 1e-5) break
          const p = mano.getWorldPosition(new THREE.Vector3())
          p.y += falta
          ik(brazo, antebrazo, mano, p, polo, 1)
        }
      }
    }

    // ── La esfera ─────────────────────────────────────────────────────────
    if (orbe) {
      if (t < N.golpe + 3) {
        const m = muestra(e.orbeSim, t)
        orbe.position.set(m.x, m.y, m.z)
      } else {
        orbe.position.set(0, -100, 0)
      }
    }

    // ── La caminata del GLB, mezclada con el idle, y sus pasos ────────────
    if (camina && idle) {
      camina.setEffectiveWeight(cuerpo.paso)
      idle.setEffectiveWeight(1 - cuerpo.paso)
      camina.setEffectiveTimeScale(cuerpo.escala)
      // El pie izquierdo apoya al empezar el ciclo y el derecho a la mitad.
      const fase = (camina.time % CICLO) / CICLO
      if (cuerpo.paso > 0.3 && Math.floor(fase * 2) !== Math.floor(faseCamina * 2)) playFootstep(fase >= 0.5)
      faseCamina = fase
    }

    // ── Los sonidos que tocan en este cuadro ──────────────────────────────
    if (t < tPrevio) for (const ev of e.eventos) if (ev.t > t) ev.hecho = false
    for (const ev of e.eventos) {
      if (!ev.hecho && ev.t <= t && ev.t > tPrevio - 0.25) { ev.hecho = true; try { ev.hacer() } catch { } }
    }
    tPrevio = t

    tocados.forEach((b, i) => copiar(escrita[i], b))
    hayEscrita = true

    // El foco sigue al cuerpo; cuando va por la cabeza, alumbra a los dos.
    const enCuerpo = personaje.getWorldPosition(new THREE.Vector3()).setY(0)
    if (e.cabezaSim2 && t >= N.camina3 - 0.6 && t < N.suelta) {
      const juntos = suave(tramo(t, N.camina3 - 0.6, N.laVe)) * (1 - suave(tramo(t, N.enPecho, N.puesta)))
      enCuerpo.lerp(centroCab.clone().setY(0), juntos * 0.5)
    }
    return enCuerpo
  }

  // Regresa todo: la pose del mixer, el cuerpo al centro, sin caminata, sin
  // piezas rígidas y la esfera fuera de cuadro.
  function soltar() {
    if (!activo) return
    activo = false
    estado = null
    tPrevio = 0
    reponer()
    rigidas.quitar()
    personaje.position.set(0, 0, 0)
    personaje.rotation.set(0, 0, 0)
    if (camina) { camina.setEffectiveWeight(0); camina.stop() }
    if (idle) idle.setEffectiveWeight(1)
    if (orbe) orbe.position.set(0, -100, 0)
  }

  // Diagnóstico de desarrollo: el punto más bajo del cuerpo y de la cabeza con
  // TODOS los vértices (caro: solo para medir).
  const enCabezaDx = new Set()
  huesos.cabeza.traverse((o) => { if (o.isBone) enCabezaDx.add(o) })
  function medirTodo() {
    personaje.updateMatrixWorld(true)
    const r = { cuerpo: Infinity, cabeza: Infinity, huesoCuerpo: '', huesoCabeza: '' }
    const v = new THREE.Vector3()
    personaje.traverse((m) => {
      if (!m.isMesh || !m.visible) return
      const g = m.geometry
      const pos = g.getAttribute('position')
      if (!pos) return
      const si = g.getAttribute('skinIndex')
      const sw = g.getAttribute('skinWeight')
      let ancestroCabeza = false
      for (let o = m.parent; o; o = o.parent) if (o === huesos.cabeza) { ancestroCabeza = true; break }
      for (let i = 0; i < pos.count; i++) {
        let hueso = null
        if (m.isSkinnedMesh && si && sw) {
          let k = 0
          for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, k)) k = j
          hueso = m.skeleton.bones[si.getComponent(i, k)]
          m.getVertexPosition(i, v)
        } else {
          v.fromBufferAttribute(pos, i)
        }
        v.applyMatrix4(m.matrixWorld)
        const esCabeza = hueso ? enCabezaDx.has(hueso) : ancestroCabeza
        if (esCabeza) { if (v.y < r.cabeza) { r.cabeza = v.y; r.huesoCabeza = hueso?.name || m.name } }
        else if (v.y < r.cuerpo) { r.cuerpo = v.y; r.huesoCuerpo = hueso?.name || m.name }
      }
    })
    return r
  }

  return { aplicar, soltar, piezas: rigidas.piezas, medirTodo }
}
