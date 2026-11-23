import { argus } from './argusNpc.js'

// El drone de M.A.D.R.E. que anda por la home (components/drone/DroneNPC.jsx).
// Estado compartido sin three: App y el diálogo lo leen y van en el chunk de
// entrada. El NPC escribe `pos` cada cuadro (la cámara del diálogo la mira) y
// lee lo demás.
export const dron = {
  montado: false,
  pos: { x: 0, y: 0, z: 0 },
  // el castigo de la tercera trampa: { alGolpe, pedido }
  castigo: null,
  // radio del escudo que la cubre de las bolas de fuego (0 = sin escudo)
  escudo: 0,
  // hasta cuándo (performance.now() / 1000) se planta: viene una bola
  plantada: 0,
}

// Durante la partida del juego de esferas se queda aquí, junto a Argus y a su
// izquierda (la derecha de la cámara del trato), viendo a Skulley: `lado` hacia la
// izquierda de Argus, `adelante` hacia donde ve él, `alto` sobre el piso.
export const JUNTO_ARGUS = { lado: 3.0, adelante: 0.8, alto: 3.4 }
export function juntoArgus() {
  const fx = Math.sin(argus.rotY)
  const fz = Math.cos(argus.rotY)
  // su izquierda: el frente girado 90° (de frente a -z, la izquierda es -x)
  const ix = fz
  const iz = -fx
  return {
    x: argus.pos.x + ix * JUNTO_ARGUS.lado + fx * JUNTO_ARGUS.adelante,
    y: JUNTO_ARGUS.alto,
    z: argus.pos.z + iz * JUNTO_ARGUS.lado + fz * JUNTO_ARGUS.adelante,
  }
}

const oyentes = new Set()
// El diálogo le pide caras y acciones al drone: { cara } | { accion } | { voltear: true }
// La escena de Argus, al aceptar el trato: { alJuego: true } la manda junto a él
// (y { alJuego: false } la regresa si no hubo partida).
export function escucharDron(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}
export function avisarDron(msg) {
  for (const fn of oyentes) {
    try { fn(msg) } catch { }
  }
}

// La tercera trampa (App): si el drone está en la escena, vuela hacia Skulley,
// invoca el rayo y llama `alGolpe` en el cuadro en que azota. Sin drone regresa
// false y App sigue con su tiempo de siempre.
export function castigarConDron(alGolpe) {
  if (!dron.montado) return false
  dron.castigo = { alGolpe, pedido: performance.now() }
  return true
}

// ---- Su humor (Oscar, 2026-11-23: "que a veces se moleste si le haces mucho
// click o hablas con ella y la cortas seguido"). Dos cuentas que se van solas con
// el tiempo (vida media `vidaS`): `cortes` sube si la dejas hablando sola (Esc a
// media frase) o te vas del menú sin despedirte; `molestia` sube con eso y además
// cada vez que le hablas, más si le vuelves a hablar recién despedido. Al saludar:
// con `cortes` pasado `regano` te regaña; con `molestia` pasado `enojo` no te
// habla `enojadaS` segundos y picarla lo alarga. Después, la primera charla es de
// perdón. Vive en memoria: una recarga la contenta.
const ANIMO = {
  abrir: 0.3, seguido: 0.3, cortada: 0.8, sinAdios: 0.4, adios: -0.1,
  vidaS: 60, regano: 0.7, enojo: 3.2,
  enojadaS: 12, insisteS: 3, enojadaMaxS: 25,
  seguidoS: 25,
}
export const animoMadre = {
  molestia: 0,
  cortes: 0,
  t: 0,
  enojadaHasta: 0,
  insiste: 0,
  perdon: false,
  cerro: 0,          // cuándo terminó la última charla
  fueraDesde: 0,     // salió de la home a una sección
  volvio: 0,         // regresó de una sección
  fueraS: 0,         // cuánto estuvo fuera
  saludo: null,      // lo que toca decir al abrir: { tipo, seg }
}
const ahoraS = () => performance.now() / 1000
function decae(a, ahora) {
  if (a.t) {
    const k = 0.5 ** ((ahora - a.t) / ANIMO.vidaS)
    a.molestia *= k
    a.cortes *= k
  }
  a.t = ahora
}
export const madreEnojada = () => ahoraS() < animoMadre.enojadaHasta

// Al picar al drone (DroneNPC). { tipo: 'charla' } abre el diálogo (y deja en
// `saludo` qué saludo toca); 'rechazo' (con `por`: 'cortes' o 'clics') e 'insiste'
// no lo abren: lo dice en su viñeta.
export function picarMadre() {
  const a = animoMadre
  const ahora = ahoraS()
  decae(a, ahora)
  if (ahora < a.enojadaHasta) {
    a.insiste += 1
    a.enojadaHasta = Math.min(a.enojadaHasta + ANIMO.insisteS, ahora + ANIMO.enojadaMaxS)
    return { tipo: 'insiste', n: a.insiste }
  }
  const desdeCerro = a.cerro ? ahora - a.cerro : 0
  const seguido = a.cerro && desdeCerro < ANIMO.seguidoS
  a.molestia += ANIMO.abrir + (seguido ? ANIMO.seguido : 0)
  if (a.molestia >= ANIMO.enojo) {
    const por = a.cortes >= ANIMO.regano ? 'cortes' : 'clics'
    a.enojadaHasta = ahora + ANIMO.enojadaS
    a.insiste = 0
    a.perdon = true
    a.molestia = ANIMO.enojo * 0.4
    a.cortes = 0
    return { tipo: 'rechazo', por }
  }
  let tipo = 'normal'
  let seg = desdeCerro
  if (a.perdon) { tipo = 'perdon'; a.perdon = false }
  else if (a.cortes >= ANIMO.regano) tipo = 'regano'
  else if (a.volvio > a.cerro && a.fueraS > 0) { tipo = 'vuelta'; seg = a.fueraS }
  else if (seguido) tipo = 'seguido'
  a.saludo = { tipo, seg }
  return { tipo: 'charla' }
}
// El diálogo lo toma al empezar (una vez).
export function tomarSaludo() {
  const s = animoMadre.saludo || { tipo: 'normal', seg: animoMadre.cerro ? ahoraS() - animoMadre.cerro : 0 }
  animoMadre.saludo = null
  return s
}
// Al cerrar el diálogo: 'cortada' | 'sinAdios' | 'adios' (null: no cuenta, la bienvenida).
export function cerrarConMadre(como) {
  const a = animoMadre
  const ahora = ahoraS()
  decae(a, ahora)
  if (como && ANIMO[como] !== undefined) a.molestia = Math.max(0, a.molestia + ANIMO[como])
  if (como === 'cortada' || como === 'sinAdios') a.cortes += ANIMO[como]
  a.cerro = ahora
}
// Skulley sale de la home y regresa (DroneNPC, con `activo`).
export function salioDeHome() { animoMadre.fueraDesde = ahoraS() }
export function volvioAHome() {
  const a = animoMadre
  if (!a.fueraDesde) return 0
  a.volvio = ahoraS()
  a.fueraS = a.volvio - a.fueraDesde
  a.fueraDesde = 0
  return a.fueraS
}

// ---- Skulley contra M.A.D.R.E. (Oscar, 2026-11-19): sus bolas de fuego nunca la
// tocan, las para su escudo; tres y se enoja. Una patada la empuja y se castiga
// en el acto. Player y HomeScene preguntan aquí; el NPC reacciona por `avisarDron`.

// ¿El rayo del cursor (origen y dirección, de la cámara) pasa por el escudo?
export function rayoTocaDron(o, d) {
  const R = dron.escudo
  if (!dron.montado || !R || !o || !d) return false
  const cx = dron.pos.x - o.x
  const cy = dron.pos.y - o.y
  const cz = dron.pos.z - o.z
  const dl = Math.hypot(d.x, d.y, d.z) || 1
  const t = (cx * d.x + cy * d.y + cz * d.z) / dl
  if (t < 0) return false
  const d2 = cx * cx + cy * cy + cz * cz - t * t
  // un poco más ancho que el escudo: el drone se mueve y no hay que atinarle al pixel
  return d2 <= R * R * 1.44
}

// Una bola de fuego sale de (ex, ey, ez) hacia (tx, ty, tz). Si el cursor estaba
// sobre el drone (`apuntado`) va hacia ella; si no, solo si su camino la cruza.
// Regresa dónde pega en el escudo, o null. Con una bola en camino, se planta para
// que el golpe caiga donde está el escudo.
export function bolaAlEscudo(ex, ey, ez, tx, ty, tz, apuntado = false) {
  const R = dron.escudo
  if (!dron.montado || !R) return null
  const c = dron.pos
  let hx
  let hy
  let hz
  if (apuntado) {
    const vx = c.x - ex
    const vy = c.y - ey
    const vz = c.z - ez
    const L = Math.hypot(vx, vy, vz)
    if (L <= R) return null
    hx = ex + (vx / L) * (L - R)
    hy = ey + (vy / L) * (L - R)
    hz = ez + (vz / L) * (L - R)
  } else {
    const dx = tx - ex
    const dy = ty - ey
    const dz = tz - ez
    const a = dx * dx + dy * dy + dz * dz
    if (a < 1e-8) return null
    const fx = ex - c.x
    const fy = ey - c.y
    const fz = ez - c.z
    const b = 2 * (fx * dx + fy * dy + fz * dz)
    const cc = fx * fx + fy * fy + fz * fz - R * R
    const disc = b * b - 4 * a * cc
    if (cc <= 0 || disc < 0) return null
    const t = (-b - Math.sqrt(disc)) / (2 * a)
    if (t < 0 || t > 1) return null
    hx = ex + dx * t
    hy = ey + dy * t
    hz = ez + dz * t
  }
  dron.plantada = performance.now() / 1000 + 0.45
  // revienta un poco antes del escudo: la explosión no la tapa y el golpe se ve en él
  const nx = (hx - c.x) / R
  const ny = (hy - c.y) / R
  const nz = (hz - c.z) / R
  return { x: hx + nx * FUERA, y: hy + ny * FUERA, z: hz + nz * FUERA }
}
const FUERA = 0.45

// La bola llegó al escudo (Player, en el cuadro del impacto).
export function golpeEscudo(x, y, z, fuerza = 0.5) {
  avisarDron({ escudo: { x, y, z, fuerza } })
}

// La patada de Skulley (HomeScene, cada cuadro de la ventana de golpe): el mismo
// abanico que patea las esferas, medido desde el cuerpo (`base`), con la altura
// holgada porque ella flota. `skip` es el de la patada: le pega una vez.
const CUERPO = 0.62
export function patadaAlDron(pie, dir, radio, skip, base, mitad) {
  if (!dron.montado || !dir || (skip && skip.has('dron'))) return null
  const b = base || pie
  const fx = dron.pos.x - b.x
  const fz = dron.pos.z - b.z
  const d = Math.hypot(fx, fz)
  if (d - CUERPO > radio) return null
  const dy = dron.pos.y - (pie?.y ?? 0)
  if (dy > 2.6 || dy < -1.5) return null
  if (d > CUERPO) {
    const ang = Math.acos(Math.max(-1, Math.min(1, (fx * dir.x + fz * dir.z) / d)))
    if (ang - Math.asin(Math.min(1, CUERPO / d)) > (mitad ?? 1.31)) return null
  }
  if (skip) skip.add('dron')
  avisarDron({ patada: { dx: dir.x, dz: dir.z } })
  const k = d > 1e-4 ? CUERPO / d : 0
  return { x: dron.pos.x - fx * k, y: dron.pos.y - 0.25, z: dron.pos.z - fz * k, power: 0.9, color: '' }
}
