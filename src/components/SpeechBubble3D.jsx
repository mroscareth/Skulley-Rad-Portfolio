import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

// Spiky comic "burst/explosion" bubble shape: alternates between an outer
// radius (spike tips) and an inner radius (valleys) around the circle.
// `jitter` breaks the perfect symmetry slightly for a hand-drawn pop-art feel.
function makeBurstGeometry(outerR, innerR, spikes = 12) {
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
  return new THREE.ShapeGeometry(shape)
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

const CY = 0.72          // local Y center of the bubble
const TAIL_K = 1.25      // la punta de la colita, en radios del globo
const TAIL_EXTRA = 0.09  // lo que el borde negro de la colita sale de más
const SHADOW_OFF = 0.12  // la sombra va corrida esto a la derecha y abajo

function distCaja(x, y, x0, x1, y0, y1) {
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1))
}

// Cuánto alejar el globo en su diagonal (dx, dy: x a la derecha de la cámara,
// y vertical del mundo) para que no toque el cuerpo. Se mide en el plano del
// globo (y = arriba en pantalla): el cuerpo es un cilindro vertical alrededor
// del ancla (`abajo` / `arriba` desde ella, `radio`) visto desde la cámara, que
// la pendiente de la cámara aplasta (ux) y engorda con su profundidad (uh).
const HOLGURA = 0.08
function cuantoApartar({ ox, oy, dx, dy, ux, uh, cy, rPuntas, sombra, colaX, colaY, cuerpo }) {
  const x0 = -cuerpo.radio, x1 = cuerpo.radio
  const y0 = -cuerpo.abajo * ux - cuerpo.radio * uh
  const y1 = cuerpo.arriba * ux + cuerpo.radio * uh
  let t = 0
  for (let i = 0; i < 32; i++) {
    const cx = ox + dx * t
    const cyy = (oy + dy * t) * ux + cy
    const falta = Math.max(
      rPuntas + HOLGURA - distCaja(cx, cyy, x0, x1, y0, y1),
      rPuntas + HOLGURA - distCaja(cx + sombra, cyy - sombra, x0, x1, y0, y1),
      HOLGURA - distCaja(cx + colaX, cyy + colaY, x0, x1, y0, y1),
    )
    if (falta <= 1e-4) break
    // Alejarse t sube la distancia a lo más t (y a veces menos): nunca se pasa.
    t += falta
  }
  return t
}

const BORDER = 0.07 // black outline thickness

// ── Globos que no se enciman (Oscar, 2026-11-19) ─────────────────────────────
// Todos los SpeechBubble3D (Skulley, Argus, M.A.D.R.E.) se anotan aquí. Cada
// cuadro, ya con su lugar propio calculado (prioridad 0.5), coordinarGlobos
// (0.6) los revisa en pantalla del más viejo al más nuevo: el nuevo le cede el
// lugar al que ya estaba. Al nacer escoge el lado de su personaje (derecha o
// izquierda) donde estorba menos; si luego se acercan, se aleja en su diagonal
// (la colita sigue apuntando a su personaje). Se aparta al instante y regresa
// suave cuando el otro se va.
const GLOBOS = new Set()
const coordina = { cuadro: -1, orden: 0 }
const MARGEN_GLOBOS_PX = 10
const EMPUJE_MAX = 8
const _pos = new THREE.Vector3(), _borde = new THREE.Vector3(), _proy = new THREE.Vector3()
const _ca = { x: 0, y: 0, r: 0 }, _cb = { x: 0, y: 0, r: 0 }

function crearGlobo() {
  return {
    lado: 1, empuje: 0, vivo: false, nacio: 0, porDecidir: false, cuadro: -1, pop: null, cambio: 0,
    g: null, geos: null, colas: { sombra: null, borde: null, relleno: null },
    circ: { x: 0, y: 0, r: 0 },
    ancla: new THREE.Vector3(), derecha: new THREE.Vector3(), frente: new THREE.Vector3(),
    arriba: new THREE.Vector3(), vertical: new THREE.Vector3(0, 1, 0), off: new THREE.Vector3(),
    s: 1, R: 1, tEvita: 0,
    ponLado(l) {
      this.lado = l
      const G = this.geos, c = this.colas
      if (!G) return
      if (c.sombra) c.sombra.geometry = l < 0 ? G.tailBorderIzq : G.tailBorder
      if (c.borde) c.borde.geometry = l < 0 ? G.tailBorderIzq : G.tailBorder
      if (c.relleno) c.relleno.geometry = l < 0 ? G.tailFillIzq : G.tailFill
    },
  }
}

// Dónde va el globo de ese lado, alejado `t` más en su diagonal.
function posicionGlobo(e, lado, t, out) {
  const len = Math.hypot(e.off.x, e.off.y) || 1
  const k = e.tEvita + t
  return out.copy(e.ancla)
    .addScaledVector(e.derecha, lado * (e.off.x + (e.off.x / len) * k))
    .addScaledVector(e.vertical, e.off.y + (e.off.y / len) * k)
    .addScaledVector(e.frente, e.off.z)
}

function aPantalla(v, cam, w, h) {
  _proy.copy(v).project(cam)
  return [(_proy.x + 1) * w / 2, (1 - _proy.y) * h / 2]
}

// Su círculo en pantalla (pixeles): centro del globo y hasta sus puntas (que
// salen hasta 6 % de más), con la sombra; y la punta de su colita (cx, cy).
function circuloGlobo(e, lado, t, cam, w, h, out) {
  posicionGlobo(e, lado, t, _pos).addScaledVector(e.arriba, CY * e.s)
  _borde.copy(_pos).addScaledVector(e.derecha, ((e.R + BORDER) * 1.06 + SHADOW_OFF * 1.42) * e.s)
  const [x, y] = aPantalla(_pos, cam, w, h)
  const [bx, by] = aPantalla(_borde, cam, w, h)
  const len = Math.hypot(e.off.x, e.off.y) || 1
  const cola = (TAIL_K * e.R + TAIL_EXTRA) * e.s
  _borde.copy(_pos)
    .addScaledVector(e.derecha, (-lado * e.off.x / len) * cola)
    .addScaledVector(e.arriba, (-e.off.y / len) * cola)
  const [tx, ty] = aPantalla(_borde, cam, w, h)
  out.x = x; out.y = y; out.r = Math.hypot(bx - x, by - y)
  out.cx = tx; out.cy = ty
  return out
}

// Cuánto alejarlo en su diagonal (unidades del mundo) para librar a los ya
// acomodados: su globo contra los suyos y cada colita contra el otro globo.
// `bloqueado`: algún otro le queda adelante en esa diagonal y la única salida
// sería atravesarlo (el empuje brincaría al otro lado de él).
const _emp = { t: 0, bloqueado: false }
function empujeNecesario(e, lado, hechos, cam, w, h) {
  const a = circuloGlobo(e, lado, 0, cam, w, h, _ca)
  const b = circuloGlobo(e, lado, 1, cam, w, h, _cb)
  _emp.t = 0; _emp.bloqueado = false
  let ux = b.x - a.x, uy = b.y - a.y
  const k = Math.hypot(ux, uy)
  if (k < 1e-3) return _emp
  ux /= k; uy /= k
  const colaX = a.cx - a.x, colaY = a.cy - a.y
  let t = 0
  const choque = (cx, cy, qx, qy, rs, mas) => {
    const dx = cx - qx, dy = cy - qy
    const d2 = dx * dx + dy * dy
    if (d2 >= rs * rs) return mas
    const bd = dx * ux + dy * uy
    if (bd < 0) _emp.bloqueado = true
    return Math.max(mas, -bd + Math.sqrt(Math.max(0, bd * bd - (d2 - rs * rs))))
  }
  for (let it = 0; it < 6; it++) {
    const cx = a.x + ux * k * t, cy = a.y + uy * k * t
    let mas = 0
    for (const o of hechos) {
      const c = o.circ
      mas = choque(cx, cy, c.x, c.y, a.r + c.r + MARGEN_GLOBOS_PX, mas)
      mas = choque(cx + colaX, cy + colaY, c.x, c.y, c.r + MARGEN_GLOBOS_PX * 0.5, mas)
      mas = choque(cx, cy, c.cx, c.cy, a.r + MARGEN_GLOBOS_PX * 0.5, mas)
    }
    if (mas <= 0.5) break
    t += mas / k
  }
  _emp.t = Math.min(t, EMPUJE_MAX)
  return _emp
}

function visibleEnEscena(o) {
  for (; o; o = o.parent) if (!o.visible) return false
  return true
}

function coordinarGlobos(state, delta) {
  const cuadro = state.clock.elapsedTime
  if (coordina.cuadro === cuadro) return
  coordina.cuadro = cuadro
  const cam = state.camera, w = state.size.width, h = state.size.height
  const activos = []
  for (const e of GLOBOS) {
    if (!e.g || e.cuadro !== cuadro || !visibleEnEscena(e.g)) { e.vivo = false; e.empuje = 0; continue }
    if (!e.vivo) { e.vivo = true; e.nacio = ++coordina.orden; e.porDecidir = true }
    activos.push(e)
  }
  if (!activos.length) return
  activos.sort((p, q) => p.nacio - q.nacio)
  const dt = Math.min(delta, 0.1)
  const k = 1 - Math.exp(-6 * dt)
  const ahora = performance.now()
  const hechos = []
  for (const e of activos) {
    let escala = 1
    if (e.porDecidir) {
      // Al nacer: del lado donde no lo bloquean y que menos lo aleja (derecha si empatan).
      e.porDecidir = false
      e.pop = null
      let lado = 1
      e.empuje = 0
      if (hechos.length) {
        const der = { ...empujeNecesario(e, 1, hechos, cam, w, h) }
        const izq = { ...empujeNecesario(e, -1, hechos, cam, w, h) }
        if ((der.bloqueado && !izq.bloqueado) || (der.bloqueado === izq.bloqueado && izq.t + 0.25 < der.t)) lado = -1
        e.empuje = lado < 0 ? izq.t : der.t
      }
      if (lado !== e.lado) e.ponLado(lado)
      e.cambio = ahora
    } else if (e.pop) {
      // Cambio de lado en dos tiempos: se encoge, cambia y renace (pop de cómic).
      e.pop.t += dt
      if (!e.pop.cambiado && e.pop.t >= POP_ENCOGE) {
        e.pop.cambiado = true
        e.ponLado(e.pop.lado)
        e.empuje = hechos.length ? empujeNecesario(e, e.lado, hechos, cam, w, h).t : 0
      }
      escala = e.pop.cambiado
        ? suave(Math.min(1, (e.pop.t - POP_ENCOGE) / POP_CRECE))
        : 1 - suave(e.pop.t / POP_ENCOGE)
      if (e.pop.t >= POP_ENCOGE + POP_CRECE) { e.pop = null; escala = 1; e.cambio = ahora }
    } else if (hechos.length || e.empuje > 0) {
      const r = hechos.length ? empujeNecesario(e, e.lado, hechos, cam, w, h) : _emp
      const necesita = hechos.length ? r.t : 0
      if (hechos.length && r.bloqueado && ahora - e.cambio > 1000) {
        const otro = empujeNecesario(e, -e.lado, hechos, cam, w, h)
        if (!otro.bloqueado || otro.t + 0.25 < necesita) e.pop = { t: 0, lado: -e.lado, cambiado: false }
      }
      if (!e.pop) {
        // Se aparta al instante; regresa suave cuando el otro se va o se aleja.
        e.empuje = necesita >= e.empuje ? necesita : e.empuje + (necesita - e.empuje) * k
        if (e.empuje < 1e-3) e.empuje = 0
      }
    }
    posicionGlobo(e, e.lado, e.empuje, e.g.position)
    e.g.scale.setScalar(e.s * Math.max(0.001, escala))
    circuloGlobo(e, e.lado, e.empuje, cam, w, h, e.circ)
    hechos.push(e)
  }
}

const POP_ENCOGE = 0.09
const POP_CRECE = 0.16
function suave(x) { return x * x * (3 - 2 * x) }

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
  // Cuerpo que el globo no debe tapar, como cilindro vertical alrededor del
  // ancla: { abajo, arriba, radio } en unidades del mundo. Sin él, no se aparta.
  evitar = null,
}) {
  const { camera } = useThree()
  const groupRef = useRef(null)
  const isEgg = theme === 'egg'
  const glob = useMemo(() => crearGlobo(), [])
  useEffect(() => {
    GLOBOS.add(glob)
    return () => { GLOBOS.delete(glob) }
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
    // For frame-rate independent smoothing
    smoothPos: new THREE.Vector3(),
    smoothAnchorPos: new THREE.Vector3(), // smoothed anchor position
    smoothCamFwd: new THREE.Vector3(0, 0, -1), // smoothed camera direction
    zAxis: new THREE.Vector3(),
    basisMat: new THREE.Matrix4(),
    smoothScale: 1,
    initialized: false,
    // IMPORTANT: deps must be [] so this object (and its smoothing state) is
    // created ONCE. `offset` arrives as a fresh array literal every parent
    // render; depending on it here re-created `tmp` each render, resetting the
    // smoothing every frame → the bubble snapped to the raw jittery pose and
    // trembled. tmp.off is refreshed in useFrame instead.
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset smoothing when bubble appears/disappears
  useEffect(() => {
    if (visible) {
      // Force re-init of smoothing to avoid "jump" from previous position
      tmp.initialized = false
    }
  }, [visible, tmp])

  // Burst geometries (regenerated when the auto-fit radius R changes).
  const SPIKES = 12
  const INNER_RATIO = 0.78
  // Tail points toward the character = OPPOSITE of the screen offset (the bubble
  // is placed offset.x right / offset.y up from the character). Extract as
  // primitives so a fresh `offset` array each render doesn't rebuild geometry.
  const ox = offset?.[0] ?? 1.05
  const oy = offset?.[1] ?? 0.85
  const burstGeos = useMemo(() => {
    // `lado` -1: el globo del otro lado del personaje, con la colita en espejo.
    const colita = (lado) => {
      // Unit direction from bubble center toward the character.
      const dlen = Math.hypot(ox, oy) || 1
      const dx = -lado * ox / dlen, dy = -oy / dlen
      const px = -dy, py = dx              // perpendicular (base spread axis)
      const baseR = 0.55 * R               // base midpoint, INSIDE the burst (hidden)
      const halfBase = 0.22 * R            // half-width of the tail base
      const tailLen = TAIL_K * R           // how far the tip sticks out
      const bmx = dx * baseR, bmy = dy * baseR
      const tipX = dx * tailLen, tipY = dy * tailLen
      // Fill base corners (perpendicular to the tail direction).
      const aLx = bmx + px * halfBase, aLy = bmy + py * halfBase
      const aRx = bmx - px * halfBase, aRy = bmy - py * halfBase
      // Border: same base midpoint (stays hidden) but wider + longer toward the tip.
      const bHalf = halfBase + 0.05
      const bLx = bmx + px * bHalf, bLy = bmy + py * bHalf
      const bRx = bmx - px * bHalf, bRy = bmy - py * bHalf
      const bTipX = dx * (tailLen + TAIL_EXTRA), bTipY = dy * (tailLen + TAIL_EXTRA)
      return {
        fill: makeTriangle(aLx, aLy, aRx, aRy, tipX, tipY),
        border: makeTriangle(bLx, bLy, bRx, bRy, bTipX, bTipY),
      }
    }
    const der = colita(1), izq = colita(-1)
    return {
      fill: makeBurstGeometry(R, R * INNER_RATIO, SPIKES),
      border: makeBurstGeometry(R + BORDER, R * INNER_RATIO + BORDER, SPIKES),
      tailFill: der.fill,
      tailBorder: der.border,
      tailFillIzq: izq.fill,
      tailBorderIzq: izq.border,
    }
  }, [R, ox, oy])
  glob.geos = burstGeos
  useEffect(() => () => {
    try {
      burstGeos.fill.dispose(); burstGeos.border.dispose()
      burstGeos.tailFill.dispose(); burstGeos.tailBorder.dispose()
      burstGeos.tailFillIzq.dispose(); burstGeos.tailBorderIzq.dispose()
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
    const g = groupRef.current
    const a = anchorRef?.current
    if (!g || !a) return

    try {
      const dt = Math.min(delta, 0.1) // cap for tab-out

      // Keep the offset current without recreating tmp (preserves smoothing).
      if (offset) tmp.off.set(offset[0] || 0, offset[1] || 0, offset[2] || 0)

      // Get raw anchor position
      a.getWorldPosition(tmp.p)

      // Get raw camera direction
      camera.getWorldDirection(tmp.fwd)

      // --- INITIALIZATION ---
      if (!tmp.initialized) {
        tmp.smoothAnchorPos.copy(tmp.p)
        tmp.smoothCamFwd.copy(tmp.fwd)
        // Nace ya en su escala: arrancando en 1 se encogía el primer segundo y,
        // como lo que se aparta del personaje depende de la escala, se deslizaba.
        tmp.smoothScale = -1
        tmp.initialized = true
      }

      // Pegado al ancla, sin suavizar: el ancla es un empty fijo al jugador (no
      // el hueso de la cabeza, que se mece al caminar) y este paso corre después
      // de moverse él y la cámara (prioridad 0.5), así que no hay temblor que
      // esconder. Suavizado (lambda 4) se quedaba atrás hasta 130 px al caminar
      // (Oscar, 2026-11-19); sin él, el globo queda a la misma distancia en
      // pantalla en cada cuadro (medido).
      tmp.smoothAnchorPos.copy(tmp.p)

      // Camera direction is NOT smoothed: any lag here makes the bubble
      // visibly swing/animate while the user orbits the camera. Snapping to
      // the raw forward locks the bubble to screen-space → it stays "facing
      // front" of the camera at all times with no sway.
      tmp.smoothCamFwd.copy(tmp.fwd).normalize()

      // --- COMPUTE FINAL POSITION WITH SMOOTHED VALUES ---
      tmp.right.crossVectors(tmp.smoothCamFwd, camera.up).normalize()
      tmp.up.copy(camera.up).normalize()

      // Final position = smoothed anchor + offset relative to smoothed camera
      // (`lado` -1: del otro lado del personaje, lo escoge coordinarGlobos).
      const lado = glob.lado
      tmp.smoothPos.copy(tmp.smoothAnchorPos)
      tmp.smoothPos.addScaledVector(tmp.right, lado * tmp.off.x)
      tmp.smoothPos.addScaledVector(tmp.up, tmp.off.y)
      tmp.smoothPos.addScaledVector(tmp.smoothCamFwd, tmp.off.z)

      // Smoothed scale (capped tighter so the bubble stays compact)
      const d = camera.position.distanceTo(tmp.smoothPos)
      const targetScale = clamp(d * 0.048, 0.50, 1.12)
      const scaleLambda = 2.0
      const scaleK = 1 - Math.exp(-scaleLambda * dt)
      tmp.smoothScale = tmp.smoothScale < 0 ? targetScale : THREE.MathUtils.lerp(tmp.smoothScale, targetScale, scaleK)
      const s = tmp.smoothScale
      g.scale.setScalar(s)

      // Orient from the SMOOTHED camera basis (not the raw camera quaternion):
      // copying camera.quaternion directly leaks the camera's per-frame jitter
      // while following the walking character, making the text plane vibrate.
      // The bubble's +Z must face the camera, i.e. opposite the view direction.
      tmp.zAxis.copy(tmp.smoothCamFwd).negate().normalize()
      // Re-orthonormalize up from (zAxis × right) so the text plane never shears
      // when the camera tilts (camera.up isn't perpendicular to the view dir).
      tmp.up.crossVectors(tmp.zAxis, tmp.right).normalize()
      tmp.basisMat.makeBasis(tmp.right, tmp.up, tmp.zAxis)
      g.quaternion.setFromRotationMatrix(tmp.basisMat)

      // Que no se encime en el personaje (Oscar, 2026-11-19): con frases largas
      // el globo crece y tapaba la cabeza. Se aleja en su misma diagonal lo
      // justo para que puntas, sombra y colita libren el cuerpo visto desde la
      // cámara. Sale de R, la escala y la cámara, que cambian suave: no tiembla.
      let tEvita = 0
      if (evitar) {
        const ux = camera.up.dot(tmp.up)
        const len = Math.hypot(tmp.off.x, tmp.off.y) || 1
        const dx = tmp.off.x / len, dy = tmp.off.y / len
        const largoCola = (TAIL_K * R + TAIL_EXTRA) * s
        tEvita = cuantoApartar({
          ox: lado * tmp.off.x, oy: tmp.off.y, dx: lado * dx, dy, ux,
          uh: Math.sqrt(Math.max(0, 1 - ux * ux)),
          cy: CY * s,
          rPuntas: (R + BORDER) * s,
          sombra: SHADOW_OFF * s,
          colaX: (-lado * ox / (Math.hypot(ox, oy) || 1)) * largoCola,
          colaY: (-oy / (Math.hypot(ox, oy) || 1)) * largoCola,
          cuerpo: evitar,
        })
      }
      // Lo que coordinarGlobos necesita para acomodarlo junto a los demás.
      glob.g = g
      glob.cuadro = state.clock.elapsedTime
      glob.ancla.copy(tmp.smoothAnchorPos)
      glob.derecha.copy(tmp.right)
      glob.frente.copy(tmp.smoothCamFwd)
      glob.arriba.copy(tmp.up)
      glob.vertical.copy(camera.up).normalize()
      glob.off.copy(tmp.off)
      glob.s = s
      glob.R = R
      glob.tEvita = tEvita
      posicionGlobo(glob, lado, glob.empuje, g.position)
    } catch {}
  }, 0.5) // después de todo lo de prioridad 0 (jugador, cámara), antes del composer (1)
  // Ya con todos los globos en su lugar propio, que no se encimen entre ellos.
  useFrame((state, delta) => { try { coordinarGlobos(state, delta) } catch {} }, 0.6)

  const shouldRender = Boolean(visible && (displayText || layoutText))
  // Después de su primera frase el globo se queda montado y solo se oculta: al
  // desmontarse, la siguiente frase creaba Text nuevos de troika y three
  // compilaba 2 programas cada vez que alguien hablaba (medido el 2026-11-15 con
  // las reacciones de Argus en el juego de esferas; a Skulley le pasaba igual).
  const ultimoRef = useRef({ display: '', layout: '' })
  if (shouldRender) ultimoRef.current = { display: displayText, layout: layoutText }
  if (!shouldRender && !ultimoRef.current.display && !ultimoRef.current.layout) return null
  const textoVisible = shouldRender ? displayText : ultimoRef.current.display
  const textoMedida = shouldRender ? layoutText : ultimoRef.current.layout
  const textoMedir = textoMedida || textoVisible
  // Una frase nueva no sale hasta que su medida llega (un par de cuadros): así
  // nunca se ve con el tamaño de la anterior.
  const medido = medida.texto === textoMedir

  const SEG = 64

  // Avoid any interference with controls/clicks: no raycast
  const noRaycast = () => null

  return (
    <group ref={groupRef} rotation={[0, 0, -0.04]} raycast={noRaycast} visible={shouldRender && medido}>
      {/* Shadow: hard offset black burst + tail (pop-art drop) */}
      <mesh geometry={burstGeos.border} position={[SHADOW_OFF, CY - SHADOW_OFF, -0.02]} raycast={noRaycast}>
        <meshBasicMaterial color={'#000000'} opacity={0.9} />
      </mesh>
      <mesh ref={(m) => { glob.colas.sombra = m }} geometry={glob.lado < 0 ? burstGeos.tailBorderIzq : burstGeos.tailBorder} position={[SHADOW_OFF, CY - SHADOW_OFF, -0.021]} raycast={noRaycast}>
        <meshBasicMaterial color={'#000000'} opacity={0.9} />
      </mesh>

      {/* Tail border (black) — drawn BEFORE the burst so its base is hidden by
          the white fill; only the protruding part keeps its black outline. */}
      <mesh ref={(m) => { glob.colas.borde = m }} geometry={glob.lado < 0 ? burstGeos.tailBorderIzq : burstGeos.tailBorder} position={[0, CY, -0.001]} raycast={noRaycast}>
        <meshBasicMaterial color={isEgg ? '#ff2a2a' : '#000000'} opacity={0.98} />
      </mesh>

      {/* Border (thick black outline burst) */}
      <mesh geometry={burstGeos.border} position={[0, CY, 0]} raycast={noRaycast}>
        <meshBasicMaterial color={isEgg ? '#ff2a2a' : '#000000'} opacity={0.98} />
      </mesh>

      {/* Fill (white burst) — covers the tail border's base → connected look */}
      <mesh geometry={burstGeos.fill} position={[0, CY, 0.002]} raycast={noRaycast}>
        <meshBasicMaterial color={isEgg ? '#000000' : '#fbfbfb'} opacity={0.98} />
      </mesh>

      {/* Halftone overlay clipped to the burst — reduced opacity for readability */}
      {halftoneTex && !isEgg && (
        <mesh geometry={burstGeos.fill} position={[0, CY, 0.003]} raycast={noRaycast}>
          <meshBasicMaterial map={halftoneTex} transparent opacity={0.30} />
        </mesh>
      )}

      {/* Tail fill (white) — on top; its base merges with the burst's white. */}
      <mesh ref={(m) => { glob.colas.relleno = m }} geometry={glob.lado < 0 ? burstGeos.tailFillIzq : burstGeos.tailFill} position={[0, CY, 0.0035]} raycast={noRaycast}>
        <meshBasicMaterial color={isEgg ? '#000000' : '#fbfbfb'} opacity={0.98} />
      </mesh>

      {/* MEASUREMENT text (invisible): always renders the FULL phrase so the
          bubble is sized for the complete text — not the partial string being
          typed. This is what makes the bubble grow with the text reliably. */}
      <Text
        position={[0, CY, 0.009]}
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

      {/* VISIBLE text: shows the typed-in characters. No onSync (doesn't drive
          size) so the bubble doesn't resize per keystroke. */}
      <Text
        position={[0, CY, 0.01]}
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
        {textoVisible || textoMedida}
      </Text>
    </group>
  )
}

