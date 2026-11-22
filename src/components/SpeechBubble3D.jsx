import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
function suave(x) { return x * x * (3 - 2 * x) }

const SPIKES = 12
const INNER_RATIO = 0.78
const CY = 0.72          // local Y center of the bubble
const TAIL_K = 1.25      // la punta de la colita, en radios del globo
const TAIL_EXTRA = 0.09  // lo que el borde negro de la colita sale de más
const SHADOW_OFF = 0.12  // la sombra va corrida esto a la derecha y abajo
const BORDER = 0.07      // black outline thickness
const INCLINA = -0.04    // el globo va un poco chueco, como dibujado a mano

// Spiky comic "burst/explosion" bubble shape: alternates between an outer
// radius (spike tips) and an inner radius (valleys) around the circle.
// `jitter` breaks the perfect symmetry slightly for a hand-drawn pop-art feel.
function makeBurstGeometry(outerR, innerR, spikes = SPIKES) {
  const shape = new THREE.Shape()
  const total = spikes * 2
  for (let i = 0; i <= total; i++) {
    const ang = (i / total) * Math.PI * 2 - Math.PI / 2
    // Deterministic per-vertex jitter so spikes look irregular but stable.
    const j = i % 2 === 0 ? 1 + 0.06 * Math.sin(i * 12.9898) : 1 + 0.04 * Math.sin(i * 4.137)
    const rad = (i % 2 === 0 ? outerR : innerR) * j
    const x = Math.cos(ang) * rad
    const y = Math.sin(ang) * rad
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geo = new THREE.ShapeGeometry(shape)
  // Al entrar y al salir los picos se recogen y salen: la posición de reposo de
  // cada vértice y el radio de los valles (los picos quedan arriba del umbral).
  geo.userData.picos = { base: Float32Array.from(geo.attributes.position.array), valle: innerR, umbral: (outerR + innerR) / 2, f: 1 }
  return geo
}

// f = 1: los picos en su lugar; 0: recogidos hasta los valles (casi un círculo).
function ponerPicos(geo, f) {
  const p = geo?.userData?.picos
  if (!p || Math.abs(p.f - f) < 1e-4) return
  p.f = f
  const arr = geo.attributes.position.array, b = p.base
  for (let i = 0; i < arr.length; i += 3) {
    const r = Math.hypot(b[i], b[i + 1])
    if (r < p.umbral) continue
    const k = (p.valle + (r - p.valle) * f) / r
    arr[i] = b[i] * k
    arr[i + 1] = b[i + 1] * k
  }
  geo.attributes.position.needsUpdate = true
}

// Simple triangle (used for the comic tail).
function makeTriangle(ax, ay, bx, by, cx, cy) {
  const s = new THREE.Shape()
  s.moveTo(ax, ay)
  s.lineTo(bx, by)
  s.lineTo(cx, cy)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

// La colita se arma apuntando hacia abajo y cada cuadro se gira hacia su
// personaje. La base queda DENTRO del globo (el blanco la tapa); el borde es
// más ancho y más largo, así solo se ve su contorno en lo que sale.
function makeColita(R) {
  const baseY = -0.55 * R
  const half = 0.22 * R
  const tip = -TAIL_K * R
  const bHalf = half + 0.05
  return {
    fill: makeTriangle(-half, baseY, half, baseY, 0, tip),
    border: makeTriangle(-bHalf, baseY, bHalf, baseY, 0, tip - TAIL_EXTRA),
  }
}

// ── Dónde va cada globo (Oscar, 2026-11-22) ──────────────────────────────────
// Los globos (Skulley, Argus, M.A.D.R.E.) y los cuerpos de quienes hablan se
// anotan aquí. Cada cuadro, del globo más viejo al más nuevo, cada uno prueba
// lugares alrededor de su personaje (su diagonal de siempre, más alto, o del
// otro lado) y se queda con el que no tapa ningún cuerpo (el suyo ni el de los
// demás, hablen o no) ni a los globos ya acomodados, no se sale de la pantalla y
// lo aleja menos. Su lugar manda mientras siga libre: cambia si se ocupa o si
// hay uno mucho mejor, y no más de una vez cada CAMBIO_MS. Dentro de un lado se
// desliza; al otro lado se va y renace. Se aparta al instante (nunca se ve
// encimado) y regresa suave. Todo se mide en pixeles de la pantalla.
const GLOBOS = new Set()
const CUERPOS = new Set()
const coordina = { cuadro: -1, orden: 0 }
// desarrollo: window.__globos da los globos y los cuerpos (para medir encimados)
if (import.meta.env.DEV && typeof window !== 'undefined') window.__globos = { GLOBOS, CUERPOS, depurar: () => depurar() }
// Con aire para el rebote de la entrada (se pasa 12 % de tamaño un instante).
const MARGEN_GLOBOS_PX = 16
const MARGEN_CUERPO_PX = 8
const MARGEN_PANTALLA_PX = 14
// Franjas de la interfaz (botones arriba, barra de secciones y retrato abajo):
// meterse ahí cuesta, para que el texto no quede detrás.
const FRANJA_ARRIBA_PX = 80
const FRANJA_ABAJO_PX = 100
const PESO_FRANJA = 1.5
const T_MAX = 5           // lo más que se aleja de su lugar (unidades del mundo)
const ELEV_MAX = (80 * Math.PI) / 180
const PASOS_ELEV = 5
const BAJAR = [20, 40]    // grados por debajo de su diagonal que también prueba
const ELEV_MIN = (-40 * Math.PI) / 180
const PESO_ELEV = 1.2     // px por cada grado que sube de su diagonal
const PESO_BAJA = 2       // y por cada grado que baja (se lee menos natural)
const PESO_LADO = 40      // px por irse del otro lado
const PESO_PANTALLA = 4   // px por cada px que se sale de la pantalla
const PESO_COLA = 60      // la colita encima de otro personaje
const QUEDARSE = 30       // ventaja de su lugar actual, para que no brinque por nada
const CAMBIO_MS = 600
const URGE = 120          // tan peor está su lugar que cambia sin esperar
const REVISAR_MS = 90
const RESORTE = 11        // el deslizamiento a otro lugar del mismo lado
const F = { cam: null, w: 1, h: 1 }
const _pos = new THREE.Vector3(), _c = new THREE.Vector3(), _b = new THREE.Vector3()
const _v = new THREE.Vector3(), _proy = new THREE.Vector3()
const _fwd = new THREE.Vector3(), _der = new THREE.Vector3(), _hz = new THREE.Vector3()
const _q = [0, 0]
const _e0 = {}, _e1 = {}

function crearGlobo() {
  return {
    vivo: false, nacio: 0, porDecidir: false, cuadro: -1, saltar: false, menosMov: false, espera: false,
    quiere: false, listo: false, frase: '',
    g: null, geos: null, cuerpo: null,
    partes: { anim: null, sombra: null, sombraCola: null, colaBorde: null, colaRelleno: null },
    anim: { fase: 'oculto', t: 0, k: 0, w: 0, e: 0, picos: 1, sombra: 1, k0: 0, w0: 0, e0: 0, p0: 1, s0: 1, rapido: false, luego: null, frase: null },
    phi: 0, phiObj: 0, vel: 0, t: 0, objetivo: -1, cambio: 0, revisar: 0, atorado: false,
    candidatos: [], phi0: 0, len: 1,
    circ: { x: 0, y: 0, r: 0, cx: 0, cy: 0 },
    ax: 0, ay: 0, dirX: -0.6, dirY: -0.8,
    ancla: new THREE.Vector3(), derecha: new THREE.Vector3(), frente: new THREE.Vector3(),
    arriba: new THREE.Vector3(), vertical: new THREE.Vector3(0, 1, 0), off: new THREE.Vector3(),
    s: 1, R: 1,
  }
}

function crearCuerpo() {
  return { ancla: new THREE.Vector3(), ev: null, cuadro: -1, vivo: false, ok: false, rect: { x0: 0, y0: 0, x1: 0, y1: 0 } }
}

function aPantalla(v, out) {
  _proy.copy(v).project(F.cam)
  out[0] = (_proy.x + 1) * F.w / 2
  out[1] = (1 - _proy.y) * F.h / 2
  return _proy.z < 1
}

function distRect(x, y, r) {
  return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1))
}

// El cuerpo es un cilindro vertical alrededor del ancla ({ abajo, arriba, radio }
// en unidades del mundo); en pantalla, la caja de sus ocho esquinas.
function rectCuerpo(cu) {
  const { abajo, arriba, radio } = cu.ev
  const r = cu.rect
  r.x0 = Infinity; r.y0 = Infinity; r.x1 = -Infinity; r.y1 = -Infinity
  cu.ok = true
  for (let i = 0; i < 8; i++) {
    _v.copy(cu.ancla)
      .addScaledVector(F.cam.up, i & 1 ? arriba : -abajo)
      .addScaledVector(_der, i & 2 ? radio : -radio)
      .addScaledVector(_hz, i & 4 ? radio : -radio)
    if (!aPantalla(_v, _q)) { cu.ok = false; return }
    if (_q[0] < r.x0) r.x0 = _q[0]
    if (_q[0] > r.x1) r.x1 = _q[0]
    if (_q[1] < r.y0) r.y0 = _q[1]
    if (_q[1] > r.y1) r.y1 = _q[1]
  }
}

// Donde va el grupo del globo en el ángulo `phi` (0 = a la derecha de su
// personaje, π/2 = arriba, π = a la izquierda), alejado `t` más de lo normal.
function basePos(e, phi, t, out) {
  const d = e.len + t
  return out.copy(e.ancla)
    .addScaledVector(e.derecha, Math.cos(phi) * d)
    .addScaledVector(e.vertical, Math.sin(phi) * d)
    .addScaledVector(e.frente, e.off.z)
}

// Su círculo en pantalla: centro y radio hasta las puntas con la sombra, y la
// punta de la colita (hacia su personaje).
function evaluar(e, phi, t, out) {
  basePos(e, phi, t, _pos)
  _c.copy(_pos).addScaledVector(e.arriba, CY * e.s)
  if (!aPantalla(_c, _q)) {
    // Detrás de la cámara: no se ve ni estorba a nadie.
    out.x = out.cx = -1e6; out.y = out.cy = -1e6; out.r = 0
    return out
  }
  const x = _q[0], y = _q[1]
  _b.copy(_c).addScaledVector(e.derecha, e.s)
  aPantalla(_b, _q)
  const ppu = Math.hypot(_q[0] - x, _q[1] - y) // px de una unidad del globo
  const sombra = SHADOW_OFF * 0.5 * ppu
  out.x = x + sombra
  out.y = y + sombra
  out.r = ((e.R + BORDER) * 1.06 + SHADOW_OFF * 0.71) * ppu
  const dx = e.ax - x, dy = e.ay - y
  const dl = Math.hypot(dx, dy) || 1
  const cola = Math.min(dl, (TAIL_K * e.R + TAIL_EXTRA) * ppu)
  out.cx = x + (dx / dl) * cola
  out.cy = y + (dy / dl) * cola
  return out
}

// Lo menos que hay que alejarlo en ese ángulo para que no tape ningún cuerpo ni
// a los globos ya acomodados (ni su colita a ellos, ni las suyas a él).
// Infinity si no hay lugar antes de T_MAX; entonces _traza dice dónde tapa menos.
const _traza = { t: 0, falta: Infinity }
function trazar(e, phi, hechos, cuerpos) {
  let t = 0
  _traza.t = 0; _traza.falta = Infinity
  for (let it = 0; it < 16; it++) {
    const a = evaluar(e, phi, t, _e0)
    let falta = 0
    for (const cu of cuerpos) falta = Math.max(falta, a.r + MARGEN_CUERPO_PX - distRect(a.x, a.y, cu.rect))
    for (const o of hechos) {
      const c = o.circ
      falta = Math.max(falta,
        a.r + c.r + MARGEN_GLOBOS_PX - Math.hypot(a.x - c.x, a.y - c.y),
        c.r + MARGEN_GLOBOS_PX * 0.5 - Math.hypot(a.cx - c.x, a.cy - c.y),
        a.r + MARGEN_GLOBOS_PX * 0.5 - Math.hypot(a.x - c.cx, a.y - c.cy))
    }
    if (falta <= 0.5) return t
    if (falta < _traza.falta) { _traza.falta = falta; _traza.t = t }
    // Alejarse 1 unidad lo mueve k px y la distancia sube a lo más eso: nunca se pasa.
    const b = evaluar(e, phi, t + 0.25, _e1)
    const k = Math.hypot(b.x - a.x, b.y - a.y) / 0.25
    if (k < 1e-3) return Infinity
    t += falta / k
    if (t > T_MAX) return Infinity
  }
  return Infinity
}

function ladoDe(phi) { return Math.cos(phi) >= 0 ? 1 : -1 }

// Cuánto cuesta ese lugar, en px: lo que se aleja, lo que sube, irse del otro
// lado, salirse de la pantalla y dejar la colita encima de otro personaje.
function puntuar(e, phi, t, ladoPref, cuerpos) {
  if (!isFinite(t)) return Infinity
  const a = evaluar(e, phi, t, _e0)
  const b = evaluar(e, phi, t + 0.25, _e1)
  let s = t * (Math.hypot(b.x - a.x, b.y - a.y) / 0.25)
  const elev = ladoDe(phi) > 0 ? phi : Math.PI - phi
  s += (elev >= e.phi0 ? PESO_ELEV : PESO_BAJA) * Math.abs(elev - e.phi0) * (180 / Math.PI)
  if (ladoDe(phi) !== ladoPref) s += PESO_LADO
  const M = MARGEN_PANTALLA_PX
  s += PESO_PANTALLA * (Math.max(0, M - (a.x - a.r)) + Math.max(0, a.x + a.r - (F.w - M))
    + Math.max(0, M - (a.y - a.r)) + Math.max(0, a.y + a.r - (F.h - M)))
  s += PESO_FRANJA * (Math.max(0, FRANJA_ARRIBA_PX - (a.y - a.r)) + Math.max(0, a.y + a.r - (F.h - FRANJA_ABAJO_PX)))
  for (const cu of cuerpos) {
    if (cu !== e.cuerpo && distRect(a.cx, a.cy, cu.rect) < 1) { s += PESO_COLA; break }
  }
  return s
}

const _mejor = { i: -1, phi: 0, s: Infinity, actual: Infinity, valido: false }
function elegir(e, hechos, cuerpos, ladoPref, actualIdx) {
  _mejor.i = -1; _mejor.s = Infinity; _mejor.actual = Infinity
  const C = e.candidatos
  let menosMalo = 0, faltaMin = Infinity
  for (let i = 0; i < C.length; i++) {
    const t = trazar(e, C[i], hechos, cuerpos)
    if (!isFinite(t) && _traza.falta < faltaMin) { faltaMin = _traza.falta; menosMalo = i }
    const s = puntuar(e, C[i], t, ladoPref, cuerpos)
    if (i === actualIdx) _mejor.actual = s
    if (s < _mejor.s) { _mejor.s = s; _mejor.i = i; _mejor.phi = C[i] }
  }
  _mejor.valido = _mejor.i >= 0
  if (!_mejor.valido) {
    // Sin lugar libre en ningún lado (todos amontonados): donde tapa menos.
    _mejor.i = menosMalo
    _mejor.phi = C[menosMalo]
  }
  return _mejor
}

function visibleEnEscena(o) {
  for (; o; o = o.parent) if (!o.visible) return false
  return true
}

function coordinarGlobos(state, delta) {
  const cuadro = state.clock.elapsedTime
  if (coordina.cuadro === cuadro) return
  coordina.cuadro = cuadro
  F.cam = state.camera; F.w = state.size.width; F.h = state.size.height
  const activos = [], esperan = []
  for (const e of GLOBOS) {
    const enEscena = e.g && e.cuadro === cuadro && visibleEnEscena(e.g.parent)
    if (enEscena && e.espera && e.quiere && e.anim.fase === 'oculto') esperan.push(e)
    if (!enEscena || e.anim.fase === 'oculto') { e.vivo = false; continue }
    if (!e.vivo) { e.vivo = true; e.nacio = ++coordina.orden; e.porDecidir = true }
    activos.push(e)
  }
  if (!activos.length && !esperan.length) return
  F.cam.getWorldDirection(_fwd)
  _der.crossVectors(_fwd, F.cam.up).normalize()
  _hz.set(_fwd.x, 0, _fwd.z)
  if (_hz.lengthSq() < 1e-8) _hz.set(0, 0, -1)
  _hz.normalize()
  const cuerpos = []
  for (const cu of CUERPOS) {
    if (cu.cuadro !== cuadro || !cu.vivo || !cu.ev) continue
    rectCuerpo(cu)
    if (cu.ok) cuerpos.push(cu)
  }
  activos.sort((p, q) => p.nacio - q.nacio)
  const dt = Math.min(delta, 0.1)
  const ahora = performance.now()
  const hechos = []
  for (const e of activos) {
    const enCuadro = aPantalla(e.ancla, _q) && _q[0] >= 0 && _q[0] <= F.w && _q[1] >= 0 && _q[1] <= F.h
    e.ax = _q[0]; e.ay = _q[1]
    if (e.saltar) {
      // Ya se encogió del lado de antes: renace en el nuevo.
      e.saltar = false
      e.phi = e.phiObj; e.vel = 0; e.t = 0
    }
    const enPop = e.anim.luego != null
    if (e.porDecidir) {
      e.porDecidir = false
      const m = elegir(e, hechos, cuerpos, 1, -1)
      if (!m.valido || !enCuadro) {
        // No cabe sin tapar a alguien (o su personaje no se ve): espera su turno.
        e.espera = true; e.vivo = false
        e.anim.fase = 'oculto'; e.anim.k = 0; e.g.visible = false
        continue
      }
      e.phi = e.phiObj = m.phi; e.vel = 0; e.t = 0
      e.objetivo = m.i; e.cambio = ahora; e.revisar = ahora + REVISAR_MS
    } else if (!enPop && e.anim.fase !== 'sale' && (ahora >= e.revisar || e.atorado)) {
      // Los demás lugares se revisan cada REVISAR_MS (o ya, si en el suyo no cabe).
      e.revisar = ahora + REVISAR_MS
      const m = elegir(e, hechos, cuerpos, ladoDe(e.phiObj), e.objetivo)
      if (e.atorado) {
        // Lo encerraron (quieto o deslizándose): nunca se queda ni cruza encima
        // de nadie. Se va y renace en el mejor lugar libre, o espera a que haya uno.
        if (m.valido) { e.objetivo = m.i; e.phiObj = m.phi; e.cambio = ahora }
        iniciarAnim(e.anim, 'sale', { rapido: true, luego: m.valido ? 'salta' : 'espera' })
      } else if (m.i !== e.objetivo && (!isFinite(m.actual)
        || (m.s + QUEDARSE < m.actual && (ahora - e.cambio > CAMBIO_MS || m.actual - m.s > URGE)))) {
        e.objetivo = m.i; e.phiObj = m.phi; e.cambio = ahora
        // Al otro lado se va y renace allá; del mismo lado se desliza.
        if (ladoDe(m.phi) !== ladoDe(e.phi)) iniciarAnim(e.anim, 'sale', { rapido: true, luego: 'salta' })
      }
    }
    const phiAntes = e.phi
    if (e.anim.luego == null && e.phi !== e.phiObj) {
      // Resorte crítico exacto: no se pasa de largo con ningún dt (a pocos
      // cuadros por segundo el de Euler cruzaba por encima de la cabeza).
      const x0 = e.phi - e.phiObj, v0 = e.vel
      const ex = Math.exp(-RESORTE * dt), c = v0 + RESORTE * x0
      e.phi = e.phiObj + (x0 + c * dt) * ex
      e.vel = (v0 - RESORTE * c * dt) * ex
      // Nunca cruza al otro lado deslizándose (eso es con pop).
      const lado = ladoDe(e.phiObj)
      if (ladoDe(e.phi) !== lado) { e.phi = lado > 0 ? Math.PI / 2 : Math.PI / 2 + 1e-4; e.vel = 0 }
      if (Math.abs(e.phi - e.phiObj) < 1e-4 && Math.abs(e.vel) < 1e-3) { e.phi = e.phiObj; e.vel = 0 }
    }
    let falta = trazar(e, e.phi, hechos, cuerpos)
    e.atorado = !isFinite(falta)
    if (e.atorado && e.phi !== phiAntes) {
      // El paso del deslizamiento cae encima de alguien: no lo da (se queda
      // donde sí cabe) y en el siguiente cuadro se va y renace en su lugar.
      const antes = trazar(e, phiAntes, hechos, cuerpos)
      if (isFinite(antes)) { e.phi = phiAntes; e.vel = 0; falta = antes }
      else falta = trazar(e, e.phi, hechos, cuerpos)
    }
    if (!isFinite(falta)) e.t = _traza.t
    else e.t = falta >= e.t ? falta : e.t + (falta - e.t) * (1 - Math.exp(-6 * dt))
    evaluar(e, e.phi, e.t, e.circ)
    hechos.push(e)
  }
  for (const e of hechos) aplicarGlobo(e)
  // Los que esperan turno entran en cuanto hay un lugar libre.
  for (const e of esperan) {
    if (ahora < e.revisar) continue
    e.revisar = ahora + REVISAR_MS
    const enCuadro = aPantalla(e.ancla, _q) && _q[0] >= 0 && _q[0] <= F.w && _q[1] >= 0 && _q[1] <= F.h
    e.ax = _q[0]; e.ay = _q[1]
    if (enCuadro && elegir(e, hechos, cuerpos, 1, -1).valido) e.espera = false
  }
  if (import.meta.env.DEV) coordina.ultimo = { activos: hechos, cuerpos }
}

// desarrollo: window.__globos.depurar() da, por globo, cada lugar que prueba
// (ángulo, cuánto se aleja, lo que le falta si no cabe, su costo).
function depurar() {
  const u = coordina.ultimo
  if (!u) return null
  return u.activos.map((e, i) => {
    const hechos = u.activos.slice(0, i)
    return {
      fase: e.anim.fase, phi: Math.round(e.phi * 57.3), t: +e.t.toFixed(2), atorado: e.atorado,
      circ: [Math.round(e.circ.x), Math.round(e.circ.y), Math.round(e.circ.r)],
      lugares: e.candidatos.map((phi) => {
        const t = trazar(e, phi, hechos, u.cuerpos)
        const falta = isFinite(t) ? 0 : Math.round(_traza.falta)
        const c = evaluar(e, phi, isFinite(t) ? t : _traza.t, {})
        return { phi: Math.round(phi * 57.3), t: isFinite(t) ? +t.toFixed(2) : null, falta, costo: Math.round(puntuar(e, phi, t, ladoDe(e.phiObj), u.cuerpos)), c: [Math.round(c.x), Math.round(c.y), Math.round(c.r)] }
      }),
    }
  })
}

// Lugar, colita, sombra, picos y la animación (escala, estirón y giro alrededor
// de la punta de la colita: sale de la boca de su personaje y regresa a ella).
function aplicarGlobo(e) {
  const g = e.g, an = e.anim, P = e.partes
  basePos(e, e.phi, e.t, g.position)
  g.scale.setScalar(e.s)
  _v.copy(e.ancla).sub(g.position)
  const lx = _v.dot(e.derecha) / e.s, ly = _v.dot(e.arriba) / e.s - CY
  const dl = Math.hypot(lx, ly)
  if (dl > 1e-3) { e.dirX = lx / dl; e.dirY = ly / dl }
  const giro = Math.atan2(e.dirY, e.dirX) - INCLINA + Math.PI / 2
  const so = SHADOW_OFF * an.sombra
  if (P.colaBorde) P.colaBorde.rotation.z = giro
  if (P.colaRelleno) P.colaRelleno.rotation.z = giro
  if (P.sombra) P.sombra.position.set(so, -so, -0.02)
  if (P.sombraCola) { P.sombraCola.position.set(so, -so, -0.021); P.sombraCola.rotation.z = giro }
  ponerPicos(e.geos?.fill, an.picos)
  ponerPicos(e.geos?.border, an.picos)
  if (!P.anim) return
  const L = TAIL_K * e.R
  const px = e.dirX * L, py = CY + e.dirY * L
  const k = Math.max(an.k, 0.001)
  const sa = k * (1 + an.e), sp = k * (1 - 0.6 * an.e)
  const cb = -e.dirX, sb = -e.dirY // eje: de la punta de la colita al centro
  const m00 = sa * cb * cb + sp * sb * sb, m01 = (sa - sp) * cb * sb, m11 = sa * sb * sb + sp * cb * cb
  const cw = Math.cos(an.w), sw = Math.sin(an.w)
  const l00 = cw * m00 - sw * m01, l01 = cw * m01 - sw * m11
  const l10 = sw * m00 + cw * m01, l11 = sw * m01 + cw * m11
  P.anim.matrix.set(
    l00, l01, 0, px - (l00 * px + l01 * py),
    l10, l11, 0, py - (l10 * px + l11 * py),
    0, 0, 1, 0,
    0, 0, 0, 1,
  )
  P.anim.matrixWorldNeedsUpdate = true
}

// ── Cómo entra y sale (Oscar, 2026-11-22: "no solo un fade in and out") ─────
// Entra: sale disparado de la punta de la colita, se pasa de tamaño y regresa
// con rebote, estirado hacia afuera al principio y aplastado en el rebote; los
// picos brotan, se mece hasta su lugar y la sombra se despega del piso.
// Frase nueva con el globo puesto: rebote chico (tapa el cambio de tamaño).
// Sale: se infla un poquito, la sombra se pega, y lo chupa la colita girando.
const ENTRA = 0.5, REBOTE = 0.42, SALE_A = 0.07, SALE_B = 0.19
const TAU = Math.PI * 2

function iniciarAnim(an, fase, extra) {
  an.k0 = an.k; an.w0 = an.w; an.e0 = an.e; an.p0 = an.picos; an.s0 = an.sombra
  an.fase = fase; an.t = 0; an.rapido = false; an.luego = null
  if (extra) Object.assign(an, extra)
}

function quieto(an) { an.k = 1; an.w = 0; an.e = 0; an.picos = 1; an.sombra = 1 }

function terminarSalida(e) {
  const an = e.anim
  if (an.luego === 'espera') e.espera = true
  if (an.luego === 'salta') {
    iniciarAnim(an, 'entra', { rapido: true })
    an.k = 0
    e.saltar = true
  } else {
    an.fase = 'oculto'
    an.k = 0
  }
}

function avanzarAnim(e, dt) {
  const an = e.anim
  const enPie = an.fase === 'entra' || an.fase === 'visible' || an.fase === 'rebote'
  if (!e.quiere) e.espera = false
  if (e.quiere) {
    if ((an.fase === 'oculto' || (an.fase === 'sale' && !an.luego)) && e.listo && !e.espera) {
      iniciarAnim(an, 'entra')
      an.frase = e.frase
    } else if (enPie && e.listo && e.frase !== an.frase) {
      an.frase = e.frase
      if (an.fase !== 'entra') iniciarAnim(an, 'rebote')
    }
  } else if (enPie) iniciarAnim(an, 'sale')
  else if (an.fase === 'sale' && an.luego) an.luego = null
  if (an.fase === 'oculto') return
  an.t += dt
  // desarrollo: window.__globoAnimT = 0.12 congela la animación en ese segundo
  if (import.meta.env.DEV && typeof window !== 'undefined' && window.__globoAnimT != null) an.t = window.__globoAnimT
  const t = an.t
  const lado = ladoDe(e.phi)

  if (e.menosMov) {
    an.w = 0; an.e = 0; an.picos = 1; an.sombra = 1
    if (an.fase === 'entra') {
      an.k = suave(Math.min(1, t / 0.14))
      if (t >= 0.14) an.fase = 'visible'
    } else if (an.fase === 'sale') {
      an.k = an.k0 * (1 - suave(Math.min(1, t / 0.12)))
      if (t >= 0.12) terminarSalida(e)
    } else {
      an.fase = 'visible'
      an.k = 1
    }
    return
  }

  if (an.fase === 'entra') {
    const T = t * (an.rapido ? 1.4 : 1)
    an.k = 1 - Math.exp(-T / 0.085) * Math.cos(TAU * 2.7 * T)
    an.e = 0.3 * Math.exp(-T / 0.09) * Math.cos(TAU * 3.4 * T)
    an.w = -lado * 0.2 * Math.exp(-T / 0.11) * Math.cos(TAU * 2.2 * T)
    an.picos = 1 - Math.exp(-T / 0.07) * Math.cos(TAU * 3 * T)
    an.sombra = suave(clamp((T - 0.06) / 0.24, 0, 1))
    if (T >= ENTRA) { an.fase = 'visible'; quieto(an) }
  } else if (an.fase === 'rebote') {
    an.k = 1 - 0.13 * Math.exp(-t / 0.09) * Math.cos(TAU * 2.8 * t)
    an.e = -0.12 * Math.exp(-t / 0.08) * Math.cos(TAU * 3.4 * t)
    an.w = -lado * 0.07 * Math.exp(-t / 0.1) * Math.sin(TAU * 2.4 * t)
    an.picos = 1 - 0.6 * Math.exp(-t / 0.07) * Math.cos(TAU * 3 * t)
    an.sombra = 1
    if (t >= REBOTE) { an.fase = 'visible'; quieto(an) }
  } else if (an.fase === 'sale') {
    // Si se quita porque lo encerraron (luego): sin inflarse y el doble de rápido,
    // para que no se quede encima de quien se le metió.
    const T = t * (an.luego ? 2.2 : an.rapido ? 1.5 : 1)
    const A = an.luego ? 0 : SALE_A
    if (T < A) {
      const u = suave(T / A)
      an.k = an.k0 * (1 + 0.07 * u)
      an.sombra = an.s0 * (1 - u)
      an.picos = an.p0 + (1.12 - an.p0) * u
      an.e = an.e0 * (1 - u)
      an.w = an.w0
    } else {
      const u = Math.min(1, (T - A) / SALE_B)
      an.k = an.k0 * (A ? 1.07 : 1) * (1 - u * u)
      an.sombra = A ? 0 : an.s0 * (1 - u)
      an.picos = (A ? 1.12 : an.p0) * (1 - 0.75 * u)
      an.e = 0.25 * u
      an.w = an.w0 + lado * 0.3 * u * u
      if (u >= 1) terminarSalida(e)
    }
  } else quieto(an)
}

export default function SpeechBubble3D({
  anchorRef,
  visible = false,
  // displayText: what is shown (typing)
  // layoutText: full text to measure size (avoids jitter during typing)
  displayText = '',
  layoutText = '',
  // theme: enables special styles (easter egg)
  theme = 'normal', // 'normal' | 'egg'
  // Comic-style offset: to the right and above the character.
  // Note: applied relative to camera (right/up), not world.
  offset = [1.05, 0.85, 0],
  // El cuerpo de su personaje, que ningún globo debe tapar: cilindro vertical
  // alrededor del ancla, { abajo, arriba, radio } en unidades del mundo. Se
  // anota aunque este globo no hable.
  evitar = null,
}) {
  const { camera } = useThree()
  const groupRef = useRef(null)
  const isEgg = theme === 'egg'
  const glob = useMemo(() => crearGlobo(), [])
  const cuerpo = useMemo(() => crearCuerpo(), [])
  const evitarRef = useRef(evitar)
  evitarRef.current = evitar
  useEffect(() => {
    GLOBOS.add(glob)
    CUERPOS.add(cuerpo)
    glob.cuerpo = cuerpo
    return () => { GLOBOS.delete(glob); CUERPOS.delete(cuerpo) }
  }, [glob, cuerpo])
  useEffect(() => {
    const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    if (!mq) return undefined
    const f = () => { glob.menosMov = mq.matches }
    f()
    mq.addEventListener?.('change', f)
    return () => mq.removeEventListener?.('change', f)
  }, [glob])

  // ── SIZING MODEL (two simple knobs) ─────────────────────────────────────
  // 1) FONT: the text size is FIXED and readable (never shrinks → no tiny text).
  // 2) The bubble GROWS to fit the text. Sin tope: con el de 2.4 la frase más
  //    larga quedaba a 0.02 del tope y una más larga se desbordaba.
  // maxWidth is a constant (not tied to R), so R converges once per phrase and
  // never oscillates → no trembling. Short phrases → small bubble; long ones →
  // bigger bubble, but text stays the same readable size.
  const FONT = 0.27         // ← text size (fixed)
  const MAX_WIDTH = 2.2     // ← wrap width (wider = fewer lines = squarer bubble)
  const PAD = 0.20          // inner margin (text ↔ spike valleys)
  const MIN_R = 0.62
  const BASE_R = 0.82
  // La medida va con el texto que se midió. Antes cada frase nueva regresaba el
  // globo a BASE_R y esperaba el onSync del texto de medida; si la frase se
  // repetía, troika no tenía nada que sincronizar, no llegaba onSync y el globo
  // se quedaba chico con el texto desbordado (o "cortado": el texto oscuro que
  // cae fuera del blanco casi no se ve sobre el azul).
  const [medida, setMedida] = useState({ texto: null, R: BASE_R })
  const R = medida.R

  const tmp = useMemo(() => ({
    p: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    fwd: new THREE.Vector3(),
    off: new THREE.Vector3(...offset),
    zAxis: new THREE.Vector3(),
    basisMat: new THREE.Matrix4(),
    smoothScale: 1,
    initialized: false,
    // IMPORTANT: deps must be [] so this object (and its smoothing state) is
    // created ONCE. `offset` arrives as a fresh array literal every parent
    // render; tmp.off is refreshed in useFrame instead.
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Nace ya en su escala (arrancando en 1 se encogía el primer segundo).
  useEffect(() => {
    if (visible) tmp.initialized = false
  }, [visible, tmp])

  // Los lugares que prueba: su diagonal de siempre (offset) y más alto, de los
  // dos lados de su personaje.
  const ox = offset?.[0] ?? 1.05
  const oy = offset?.[1] ?? 0.85
  useMemo(() => {
    glob.len = Math.hypot(ox, oy) || 1
    glob.phi0 = Math.atan2(oy, Math.abs(ox))
    const C = []
    const pasos = glob.phi0 < ELEV_MAX ? PASOS_ELEV : 0
    for (let i = 0; i <= pasos; i++) {
      const elev = glob.phi0 + (ELEV_MAX - glob.phi0) * (i / Math.max(1, pasos))
      C.push(elev, Math.PI - elev)
    }
    C.push(Math.PI / 2) // justo arriba
    for (const g of BAJAR) {
      const elev = glob.phi0 - (g * Math.PI) / 180
      if (elev >= ELEV_MIN) C.push(elev, Math.PI - elev)
    }
    glob.candidatos = C
  }, [glob, ox, oy])

  // Burst geometries (regenerated when the auto-fit radius R changes).
  const burstGeos = useMemo(() => {
    const cola = makeColita(R)
    return {
      fill: makeBurstGeometry(R, R * INNER_RATIO),
      border: makeBurstGeometry(R + BORDER, R * INNER_RATIO + BORDER),
      tailFill: cola.fill,
      tailBorder: cola.border,
    }
  }, [R])
  glob.geos = burstGeos
  useEffect(() => () => {
    try {
      burstGeos.fill.dispose(); burstGeos.border.dispose()
      burstGeos.tailFill.dispose(); burstGeos.tailBorder.dispose()
    } catch { }
  }, [burstGeos])

  const halftoneTex = useMemo(() => {
    // Comic-style dot texture (procedural, no assets)
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const ctx = c.getContext('2d')
    if (!ctx) return null

    ctx.clearRect(0, 0, c.width, c.height)
    // Transparent background
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, c.width, c.height)

    // Dots
    const step = 16
    for (let y = 0; y < c.height + step; y += step) {
      for (let x = 0; x < c.width + step; x += step) {
        // radial gradient: denser at bottom-right
        const nx = x / c.width
        const ny = y / c.height
        const k = Math.pow(clamp((nx * 0.85 + ny * 1.05) * 0.62, 0, 1), 1.8)
        const r = 1 + k * 4.6
        const a = 0.05 + k * 0.35
        ctx.beginPath()
        ctx.fillStyle = `rgba(0,0,0,${a})`
        ctx.arc(x + (y / step % 2 ? step * 0.5 : 0), y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 1)
    tex.needsUpdate = true
    return tex
  }, [])

  // Force always-visible (no occlusion) for readability. En cada render y no al
  // montar: al montar el componente regresa null (el grupo nace con la primera
  // frase) y nunca se aplicaba; así también alcanza al halftone que regresa al
  // salir del tema egg. Layout effect para que corra antes del primer cuadro.
  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return
    try {
      g.traverse((o) => {
        o.renderOrder = 9999
        if (!o.material) return
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          if (!m || (m.depthTest === false && m.transparent)) continue
          m.depthTest = false
          m.depthWrite = false
          m.transparent = true
        }
      })
    } catch {}
  })

  useFrame((state, delta) => {
    const a = anchorRef?.current
    if (!a) return
    try {
      const dt = Math.min(delta, 0.1) // cap for tab-out
      const cuadro = state.clock.elapsedTime
      if (offset) tmp.off.set(offset[0] || 0, offset[1] || 0, offset[2] || 0)
      a.getWorldPosition(tmp.p)
      // La cámara sin suavizar: con retraso el globo se mecía al orbitarla.
      camera.getWorldDirection(tmp.fwd).normalize()
      tmp.right.crossVectors(tmp.fwd, camera.up).normalize()

      // El cuerpo de su personaje, para que ningún globo lo tape (hable o no).
      const ev = evitarRef.current
      cuerpo.ev = ev
      if (ev) {
        cuerpo.ancla.copy(tmp.p)
        cuerpo.cuadro = cuadro
        cuerpo.vivo = visibleEnEscena(a)
      }

      const g = groupRef.current
      if (!g) return
      if (!tmp.initialized) { tmp.smoothScale = -1; tmp.initialized = true }

      // Mira a la cámara con una base ortonormal (sin cizalla al inclinarla).
      tmp.zAxis.copy(tmp.fwd).negate()
      tmp.up.crossVectors(tmp.zAxis, tmp.right).normalize()
      tmp.basisMat.makeBasis(tmp.right, tmp.up, tmp.zAxis)
      g.quaternion.setFromRotationMatrix(tmp.basisMat)

      // Escala por distancia, medida en su lugar de siempre: mide lo mismo en
      // pantalla (de lejos se achica un poco). Con el tope de 0.5 de antes, un
      // personaje cerca de la cámara traía un globo enorme que tapaba todo.
      _v.copy(tmp.p).addScaledVector(tmp.right, tmp.off.x).addScaledVector(camera.up, tmp.off.y)
      const targetScale = clamp(camera.position.distanceTo(_v) * 0.048, 0.12, 1.12)
      tmp.smoothScale = tmp.smoothScale < 0 ? targetScale : THREE.MathUtils.lerp(tmp.smoothScale, targetScale, 1 - Math.exp(-8 * dt))

      // Pegado al ancla, sin suavizar: el ancla es un empty fijo al personaje y
      // este paso corre después de moverse él y la cámara (prioridad 0.5).
      glob.g = g
      glob.cuadro = cuadro
      glob.ancla.copy(tmp.p)
      glob.derecha.copy(tmp.right)
      glob.frente.copy(tmp.fwd)
      glob.arriba.copy(tmp.up)
      glob.vertical.copy(camera.up).normalize()
      glob.off.copy(tmp.off)
      glob.s = tmp.smoothScale
      glob.R = R
      avanzarAnim(glob, dt)
      g.visible = glob.anim.fase !== 'oculto'
    } catch {}
  }, 0.5) // después de todo lo de prioridad 0 (jugador, cámara), antes del composer (1)
  // Ya con todos en su escala y su animación, cada uno en su lugar.
  useFrame((state, delta) => { try { coordinarGlobos(state, delta) } catch {} }, 0.6)

  const shouldRender = Boolean(visible && (displayText || layoutText))
  // Después de su primera frase el globo se queda montado y solo se oculta: al
  // desmontarse, la siguiente frase creaba Text nuevos de troika y three
  // compilaba 2 programas cada vez que alguien hablaba (medido el 2026-11-15 con
  // las reacciones de Argus en el juego de esferas; a Skulley le pasaba igual).
  // Lo que se ve es la última frase ya medida: una frase nueva espera su medida
  // (un par de cuadros) con la anterior puesta, y al irse se va con la suya.
  const fraseNueva = shouldRender ? (layoutText || displayText) : null
  const medido = shouldRender && medida.texto === fraseNueva
  const mostradoRef = useRef({ display: '', frase: '' })
  if (medido) mostradoRef.current = { display: displayText, frase: fraseNueva }
  const mostrado = mostradoRef.current
  glob.quiere = shouldRender
  glob.listo = medido
  glob.frase = mostrado.frase
  if (!shouldRender && !mostrado.frase) return null
  const textoMedir = fraseNueva || mostrado.frase

  // Avoid any interference with controls/clicks: no raycast
  const noRaycast = () => null

  return (
    <group ref={groupRef} raycast={noRaycast}>
      <group ref={(o) => { glob.partes.anim = o }} matrixAutoUpdate={false}>
        <group position={[0, CY, 0]} rotation={[0, 0, INCLINA]}>
          {/* Shadow: hard offset black burst + tail (pop-art drop). Su lugar lo
              pone aplicarGlobo (se despega al entrar). */}
          <mesh ref={(m) => { glob.partes.sombra = m }} geometry={burstGeos.border} frustumCulled={false} raycast={noRaycast}>
            <meshBasicMaterial color={'#000000'} opacity={0.9} />
          </mesh>
          <mesh ref={(m) => { glob.partes.sombraCola = m }} geometry={burstGeos.tailBorder} frustumCulled={false} raycast={noRaycast}>
            <meshBasicMaterial color={'#000000'} opacity={0.9} />
          </mesh>

          {/* Tail border (black) — drawn BEFORE the burst so its base is hidden by
              the white fill; only the protruding part keeps its black outline. */}
          <mesh ref={(m) => { glob.partes.colaBorde = m }} geometry={burstGeos.tailBorder} position-z={-0.001} frustumCulled={false} raycast={noRaycast}>
            <meshBasicMaterial color={isEgg ? '#ff2a2a' : '#000000'} opacity={0.98} />
          </mesh>

          {/* Border (thick black outline burst) */}
          <mesh geometry={burstGeos.border} frustumCulled={false} raycast={noRaycast}>
            <meshBasicMaterial color={isEgg ? '#ff2a2a' : '#000000'} opacity={0.98} />
          </mesh>

          {/* Fill (white burst) — covers the tail border's base → connected look */}
          <mesh geometry={burstGeos.fill} position-z={0.002} frustumCulled={false} raycast={noRaycast}>
            <meshBasicMaterial color={isEgg ? '#000000' : '#fbfbfb'} opacity={0.98} />
          </mesh>

          {/* Halftone overlay clipped to the burst — reduced opacity for readability */}
          {halftoneTex && !isEgg && (
            <mesh geometry={burstGeos.fill} position-z={0.003} frustumCulled={false} raycast={noRaycast}>
              <meshBasicMaterial map={halftoneTex} transparent opacity={0.30} />
            </mesh>
          )}

          {/* Tail fill (white) — on top; its base merges with the burst's white. */}
          <mesh ref={(m) => { glob.partes.colaRelleno = m }} geometry={burstGeos.tailFill} position-z={0.0035} frustumCulled={false} raycast={noRaycast}>
            <meshBasicMaterial color={isEgg ? '#000000' : '#fbfbfb'} opacity={0.98} />
          </mesh>

          {/* MEASUREMENT text (invisible): always renders the FULL phrase so the
              bubble is sized for the complete text — not the partial string being
              typed. This is what makes the bubble grow with the text reliably. */}
          <Text
            position={[0, 0, 0.009]}
            fontSize={FONT}
            maxWidth={MAX_WIDTH}
            font={`${import.meta.env.BASE_URL}fonts/LuckiestGuy-Regular.ttf`}
            lineHeight={1.30}
            letterSpacing={0.025}
            anchorX="center"
            anchorY="middle"
            textAlign="center"
            fillOpacity={0}
            visible={false}
            raycast={noRaycast}
            onSync={(troika) => {
              try {
                const info = troika?.textRenderInfo
                const bb = info?.blockBounds
                if (!bb || bb.length < 4) return
                // Grow the bubble to fit the FULL text: the block's farthest corner
                // plus PAD must reach the valley circle (R*INNER_RATIO). Con la tinta
                // (visibleBounds) por si una palabra sola mide más que MAX_WIDTH.
                const vb = info.visibleBounds?.length === 4 ? info.visibleBounds : bb
                const x = Math.max(Math.abs(bb[0]), Math.abs(bb[2]), Math.abs(vb[0]), Math.abs(vb[2]))
                const y = Math.max(Math.abs(bb[1]), Math.abs(bb[3]), Math.abs(vb[1]), Math.abs(vb[3]))
                const desired = Math.max(MIN_R, (Math.hypot(x, y) + PAD) / INNER_RATIO)
                // El texto que midió este resultado: si cambió a media medición,
                // troika.text ya es el nuevo y su onSync llega después.
                const texto = info.parameters?.text ?? troika.text
                setMedida((m) => (m.texto === texto && m.R === desired ? m : { texto, R: desired }))
              } catch {}
            }}
          >
            {textoMedir}
          </Text>

          {/* VISIBLE text: lo tecleado (vacío al empezar: antes salía la frase
              completa un instante). No onSync: no cambia el tamaño. */}
          <Text
            position={[0, 0, 0.01]}
            fontSize={FONT}
            maxWidth={MAX_WIDTH}
            font={`${import.meta.env.BASE_URL}fonts/LuckiestGuy-Regular.ttf`}
            lineHeight={1.30}
            letterSpacing={0.025}
            color={isEgg ? '#ff2a2a' : '#111111'}
            anchorX="center"
            anchorY="middle"
            textAlign="center"
            outlineWidth={0.003}
            outlineColor={isEgg ? '#000000' : '#fbfbfb'}
            raycast={noRaycast}
          >
            {mostrado.display}
          </Text>
        </group>
      </group>
    </group>
  )
}
