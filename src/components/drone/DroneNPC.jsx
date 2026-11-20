import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import DroneModel, { INVOCAR_GOLPE_S } from './DroneModel.jsx'
import SpeechBubble3D from '../SpeechBubble3D.jsx'
import SilhouetteShadow from '../SilhouetteShadow.jsx'
import DomeShield from '../fx/DomeShield.jsx'
import { dron, escucharDron } from '../../lib/droneNpc.js'
import { dialogoMadre } from '../../lib/dialogoMadre.js'
import { useLanguage } from '../../i18n/LanguageContext.jsx'

// El drone de M.A.D.R.E. como NPC de la home (Oscar, 2026-11-19). Anda por ahí
// feliz y despacio entre los portales; al picarlo se abre su diálogo
// (DialogoMadre en App) y se pone enfrente de Skulley, a la altura de su cara,
// para que la cámara lo vea por encima del hombro. Cuando Skulley se para en el
// portal de Work se le acerca con su viñeta de la tienda. En la tercera trampa
// del juego (castigarConDron, App) vuela enojada hacia él, lo ve e invoca el
// rayo: el rayo cae en el cuadro en que azota (INVOCAR_GOLPE_S).
//
// Skulley le puede tirar bolas de fuego (Player, lib/droneNpc.js): nunca la tocan,
// las para un escudo con el efecto del domo (DomeShield en esfera); a la tercera
// se enoja y lo castiga con el rayo. Una patada la empuja un poco y el castigo es
// inmediato (Oscar, 2026-11-19). Muy de vez en cuando va a ver la esfera corrupta
// con cara de duda y dice algo de ella (`CURIOSA`).
//
// Monta desde el warm-up con Argus (comoHome), así sus programas se compilan
// detrás del preloader. Todo lo que anima va por refs; el estado de React solo
// cambia con la acción del GLB, el contorno del hover y la viñeta.

const TAM = 1.35           // ancho del drone en el mundo (Skulley mide ~2.5)
const ALTO = 2.6           // altura de vuelo, al centro del drone
const VEL = { paseo: 1.4, prisa: 8, oferta: 13, castigo: 15 }
const ARGUS = { x: 0, z: 12.9 }
// El portal donde ofrece la tienda: el de Store (Oscar, 2026-11-19; primero lo
// pidió en el de Work). Va de prisa, se queda junto al portal mientras Skulley
// siga ahí (a `junto` del centro hacia la plaza y `lado` a un lado) y lo
// pregona en ciclos: la viñeta `dice` segundos de cada `ciclo`.
const PORTAL_OFERTA = 'section3'
const OFERTA = { espera: 6, letras: 34, junto: 2.7, lado: 2.2, ciclo: 8, dice: 5 }
// Cuando Skulley pasa así de cerca se detiene donde va y lo sigue con el cuerpo y
// los ojos desde ahí (Oscar); retoma su paseo cuando él se aleja `+ VER_SUELTA`.
const VER_CERCA = 5
const VER_SUELTA = 1.5
// Diálogo: enfrente de Skulley, a esta distancia y altura (la cámara va detrás de él).
const DIALOGO = { dist: 3.1, alto: 2.45 }
// Castigo: frente a Skulley, un poco arriba, viéndolo; vuela a lo más tanto antes de invocar.
const CASTIGO = { dist: 3.4, alto: 3.1, vueloMax: 1.1, despues: 2.6 }
// El escudo: radio (cubre las alas), celda y alcance de la onda a su medida.
const ESCUDO = { radio: 1.15, celda: 0.24, alcance: 1.5 }
// La patada: el empujón (se frena solo) y en cuánto empieza a invocar el rayo.
const PATADA = { empuje: 4.5, sube: 0.3, invoca: 0.3 }
// La esfera corrupta: la primera visita y cada cuánto (segundos), a qué distancia
// y altura sobre ella se queda, cuánto la mira y cuánto dura su viñeta.
const CURIOSA = { primera: [55, 100], cada: [160, 280], dist: 2.3, alto: 1.7, vel: 3, mira: 7.5, dice: 5.5 }
// Las viñetas se escriben a este paso (letras por segundo).
const LETRAS = 34

const azar = (a, b) => a + Math.random() * (b - a)
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a))

export default function DroneNPC({
  playerRef,
  portals = [],
  nearPortalId = null,
  activo = true,
  juegoActivo = false,
  dialogo = false,
  puedeHablar = true,
  onHablar,
  buscarCorrupta = null,
}) {
  const { gl, camera } = useThree()
  const { lang } = useLanguage()
  const textos = dialogoMadre(lang)
  const textosRef = useRef(textos)
  textosRef.current = textos
  const grupoRef = useRef()
  const caraRef = useRef(null)
  const anclaRef = useRef()
  const escudoRef = useRef(null)
  const escudoGrupoRef = useRef()
  const [accion, setAccion] = useState({ nombre: 'IdleTranquilo', n: 0 })
  const [hover, setHover] = useState(false)
  const [vineta, setVineta] = useState({ on: false, texto: '', layout: '' })
  // desarrollo: window.__dronOferta() hace como si Skulley estuviera en el portal
  const [probarOferta, setProbarOferta] = useState(0)
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__dronOferta = () => { est.current.ofertaEspera = 0; setProbarOferta((n) => n + 1) }
    return () => { delete window.__dronOferta }
  }, [])
  const onHablarRef = useRef(onHablar)
  onHablarRef.current = onHablar
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__dronHablar = () => onHablarRef.current?.()
    return () => { delete window.__dronHablar }
  }, [])

  const portalesXZ = useMemo(() => portals.filter((p) => p.id !== 'section6').map((p) => ({ id: p.id, x: p.position[0], z: p.position[2] })), [portals])
  const est = useRef(null)
  if (!est.current) {
    est.current = {
      modo: 'deambular',        // deambular | oferta | dialogo | castigo
      fase: 'quieto',           // quieto | girar | viaje
      t: 0,
      hasta: azar(1.5, 3),
      pos: new THREE.Vector3(-6, ALTO, 4),
      v: new THREE.Vector3(),
      yaw: Math.PI * 0.8,
      meta: null,
      alto: ALTO,
      vel: VEL.paseo,
      mirar: null,
      sonando: 'IdleTranquilo',
      tOferta: -1,
      ofertaEspera: 0,
      probandoHasta: 0,
      viendo: false,
      golpe: null,
      ofertaTexto: '',
      dice: null,               // viñeta que está diciendo: { texto, t, dura }
      golpesEscudo: 0,
      alertaHasta: 0,           // después de un golpe al escudo lo sigue viendo
      ladeo: { x: 0, z: 0, vx: 0, vz: 0 },
      curiosaCuando: performance.now() / 1000 + azar(CURIOSA.primera[0], CURIOSA.primera[1]),
      tCur: -1,
      dijoCur: false,
      ultimaCur: -1,
    }
  }
  const pedir = (nombre) => setAccion((a) => ({ nombre, n: a.n + 1 }))
  const cercaPortalRef = useRef(nearPortalId)
  cercaPortalRef.current = nearPortalId

  // el estado compartido: montado solo de verdad en la home
  useEffect(() => {
    dron.montado = Boolean(activo)
    dron.escudo = activo ? ESCUDO.radio : 0
    return () => { dron.montado = false; dron.castigo = null; dron.escudo = 0 }
  }, [activo])

  // dice algo en su viñeta (se escribe letra por letra)
  const decir = (texto, dura) => { est.current.dice = { texto, t: 0, dura } }
  // un golpe la ladea hacia donde la empujan (resorte en su marco)
  const ladear = (dx, dz, fuerza) => {
    const e = est.current
    const L = Math.hypot(dx, dz) || 1
    const fx = dx / L
    const fz = dz / L
    const sy = Math.sin(e.yaw)
    const cy = Math.cos(e.yaw)
    e.ladeo.vx += (fx * sy + fz * cy) * fuerza * 6
    e.ladeo.vz -= (fx * cy - fz * sy) * fuerza * 6
  }
  // su rayo, sin las reglas del juego: el mismo del castigo, sin -9999
  const rayoASkulley = () => {
    const p = playerRef?.current?.position
    try {
      window.dispatchEvent(new CustomEvent('madre-castigo-strike', { detail: { x: p?.x || 0, y: 0, z: p?.z || 0 } }))
      window.dispatchEvent(new CustomEvent('bolt-strike', { detail: { at: performance.now() } }))
    } catch { }
  }

  // lo que pide el diálogo, y los golpes de Skulley (lib/droneNpc.js)
  useEffect(() => escucharDron((msg) => {
    const cara = caraRef.current
    const e = est.current
    const T = textosRef.current
    if (msg.cara && cara) cara.poner(msg.cara)
    if (msg.voltear && cara) cara.voltear()
    if (msg.accion) pedir(msg.accion)
    if (msg.fin) { cara?.poner('normal'); pedir('IdleTranquilo') }
    if (msg.escudo) {
      const { x, y, z, fuerza } = msg.escudo
      escudoRef.current?.hit({ x, y, z }, 0.6 + 0.4 * fuerza)
      ladear(e.pos.x - x, e.pos.z - z, 0.25 + 0.35 * fuerza)
      if (e.modo === 'castigo' || e.modo === 'dialogo') return
      e.golpesEscudo += 1
      const n = e.golpesEscudo
      if (n >= 3) {
        // la tercera: se enoja y va por él
        e.golpesEscudo = 0
        decir(T.escudo[2], 2.6)
        if (e.modo === 'curiosa') terminarCuriosa(false)
        dron.castigo = { alGolpe: rayoASkulley, pedido: performance.now() }
        return
      }
      decir(T.escudo[n - 1], 4.6)
      cara?.poner(n === 1 ? 'feliz' : 'enojada')
      e.alertaHasta = performance.now() / 1000 + 6
      if (e.modo === 'curiosa') terminarCuriosa(false)
    }
    if (msg.patada) {
      if (e.modo === 'castigo' || e.modo === 'dialogo') return
      // el empujón y, en el acto, el rayo
      if (e.modo === 'curiosa') terminarCuriosa(false)
      e.modo = 'castigo'
      e.fase = 'empujada'
      e.t = 0
      e.meta = null
      e.mirar = 'skulley'
      e.golpe = rayoASkulley
      e.ofertaTexto = ''
      e.v.set(msg.patada.dx * PATADA.empuje, 0, msg.patada.dz * PATADA.empuje)
      e.pos.y += PATADA.sube
      ladear(msg.patada.dx, msg.patada.dz, 1.4)
      cara?.poner('enojada')
      decir(T.patada, 2.8)
      pedir('Detenerse')
    }
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  // desarrollo: window.__dronCuriosa() la manda a ver la esfera corrupta
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__dronCuriosa = () => {
      const e = est.current
      e.curiosaCuando = 0
      if (e.modo === 'deambular') {
        e.viendo = false
        e.alertaHasta = 0
        if (e.fase === 'quieto') e.hasta = 0
        else quieto(0, 'IdleTranquilo')
      }
    }
    // y window.__dronEscudo(fuerza) enciende el escudo del lado de Skulley, sin contar
    window.__dronEscudo = (fuerza = 1) => {
      const e = est.current
      const s = playerRef?.current?.position
      if (!s) return
      const dx = s.x - e.pos.x
      const dz = s.z - e.pos.z
      const L = Math.hypot(dx, dz) || 1
      escudoRef.current?.hit({ x: e.pos.x + (dx / L) * ESCUDO.radio, y: e.pos.y - 0.25, z: e.pos.z + (dz / L) * ESCUDO.radio }, 0.6 + 0.4 * fuerza)
    }
    return () => { delete window.__dronCuriosa; delete window.__dronEscudo }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- metas
  const libre = (x, z, s) => {
    if (Math.hypot(x - ARGUS.x, z - ARGUS.z) < 4.2) return false
    for (const p of portalesXZ) if (Math.hypot(x - p.x, z - p.z) < 4.5) return false
    if (s && Math.hypot(x - s.x, z - s.z) < 3.2) return false
    return true
  }
  const elegirMeta = (s) => {
    const e = est.current
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2
      // jugando, ronda a Skulley (lo está viendo); si no, la plaza de los portales
      const r = juegoActivo ? azar(5, 8) : azar(3, 12.5)
      const cx = juegoActivo && s ? s.x : 0
      const cz = juegoActivo && s ? s.z : 0
      const x = cx + Math.sin(a) * r
      const z = cz + Math.cos(a) * r
      if (Math.hypot(x - e.pos.x, z - e.pos.z) < 3) continue
      if (!libre(x, z, s)) continue
      return new THREE.Vector3(x, ALTO + azar(-0.25, 0.35), z)
    }
    return new THREE.Vector3(e.pos.x * 0.5, ALTO, e.pos.z * 0.5)
  }

  // ir a un lugar: si es lejos, arranca con el giro; si no, solo avanza
  const viajar = (meta, vel, mirar = null) => {
    const e = est.current
    e.meta = meta
    e.vel = vel
    e.mirar = mirar
    e.fase = 'girar'
    e.t = 0
  }
  const quieto = (seg, nombre = Math.random() < 0.35 ? 'IdleJugueton' : 'IdleTranquilo') => {
    const e = est.current
    e.fase = 'quieto'
    e.t = 0
    e.hasta = seg
    e.meta = null
    if (e.sonando === 'Avanzar' || e.sonando === 'Arrancar') pedir('Detenerse')
    else pedir(nombre)
    if (nombre === 'IdleJugueton') caraRef.current?.poner('feliz')
  }

  // ---- la esfera corrupta: se queda a un lado y arriba de ella, viéndola
  const puntoCurioso = (c) => {
    const e = est.current
    let dx = e.pos.x - c.pos.x
    let dz = e.pos.z - c.pos.z
    const L = Math.hypot(dx, dz)
    if (L < 1e-3) { dx = 1; dz = 0 } else { dx /= L; dz /= L }
    return new THREE.Vector3(c.pos.x + dx * CURIOSA.dist, Math.max(1.7, c.pos.y + CURIOSA.alto), c.pos.z + dz * CURIOSA.dist)
  }
  const empezarCuriosa = (c) => {
    const e = est.current
    e.modo = 'curiosa'
    e.tCur = -1
    e.dijoCur = false
    caraRef.current?.poner('normal')
    viajar(puntoCurioso(c), CURIOSA.vel)
  }
  function terminarCuriosa(descansa = true) {
    const e = est.current
    e.modo = 'deambular'
    e.tCur = -1
    e.dijoCur = false
    e.curiosaCuando = performance.now() / 1000 + azar(CURIOSA.cada[0], CURIOSA.cada[1])
    caraRef.current?.mirar(0, 0)
    if (descansa) {
      caraRef.current?.poner('normal')
      quieto(azar(1.5, 2.5), 'IdleTranquilo')
    }
  }

  // ---- la viñeta de la tienda
  useEffect(() => {
    const e = est.current
    if (!activo || juegoActivo || dialogo || e.modo !== 'deambular') return
    if (nearPortalId !== PORTAL_OFERTA && !probarOferta) return
    if (performance.now() / 1000 < e.ofertaEspera) return
    const s = playerRef?.current?.position
    if (!s) return
    e.modo = 'oferta'
    e.tOferta = -1
    e.probandoHasta = probarOferta && nearPortalId !== PORTAL_OFERTA ? performance.now() + 9000 : 0
    // junto al portal, del lado de la plaza, viendo a Skulley; de prisa y sin
    // voltear antes de salir (con el arrancón si está lejos)
    const P = portalesXZ.find((q) => q.id === PORTAL_OFERTA)
    const base = P ? new THREE.Vector3(P.x, 0, P.z) : new THREE.Vector3(s.x, 0, s.z)
    const haciaCentro = new THREE.Vector3(-base.x, 0, -base.z).normalize()
    const lado = new THREE.Vector3(haciaCentro.z, 0, -haciaCentro.x)
    const meta = new THREE.Vector3(base.x, ALTO + 0.2, base.z).addScaledVector(haciaCentro, OFERTA.junto).addScaledVector(lado, OFERTA.lado)
    viajar(meta, VEL.oferta, 'skulley')
    e.fase = 'viaje'
    pedir(e.pos.distanceTo(meta) > 6 ? 'Arrancar' : 'Avanzar')
  }, [nearPortalId, activo, juegoActivo, dialogo, playerRef, probarOferta])

  // ---- el diálogo
  useEffect(() => {
    const e = est.current
    if (dialogo) {
      e.modo = 'dialogo'
      e.ofertaTexto = ''
      e.dice = null
      const p = playerRef?.current
      if (!p) return
      const fy = p.rotation.y
      const meta = new THREE.Vector3(p.position.x + Math.sin(fy) * DIALOGO.dist, DIALOGO.alto, p.position.z + Math.cos(fy) * DIALOGO.dist)
      viajar(meta, VEL.prisa, 'skulley')
    } else if (e.modo === 'dialogo') {
      e.modo = 'deambular'
      caraRef.current?.poner('normal')
      quieto(azar(1.5, 3))
    }
  }, [dialogo, playerRef])

  useFrame((_, dtReal) => {
    const dt = Math.min(dtReal, 1 / 20)
    const e = est.current
    const g = grupoRef.current
    const p = playerRef?.current
    const s = p?.position
    const cara = caraRef.current
    e.t += dt

    // el castigo manda sobre todo
    if (dron.castigo && e.modo !== 'castigo' && s) {
      e.modo = 'castigo'
      e.golpe = dron.castigo.alGolpe
      dron.castigo = null
      e.ofertaTexto = ''
      cara?.poner('enojada')
      const desde = new THREE.Vector3(e.pos.x - s.x, 0, e.pos.z - s.z)
      if (desde.lengthSq() < 0.01) desde.set(0, 0, 1)
      desde.normalize()
      const meta = new THREE.Vector3(s.x, CASTIGO.alto, s.z).addScaledVector(desde, CASTIGO.dist)
      viajar(meta, VEL.castigo, 'skulley')
      e.fase = 'viaje'
      pedir(e.pos.distanceTo(meta) > 6 ? 'Arrancar' : 'Avanzar')
    }

    // ---- decidir
    const ahora = performance.now() / 1000
    if (e.modo !== 'deambular') e.viendo = false
    if (e.modo === 'deambular' && s) {
      const dS = Math.hypot(s.x - e.pos.x, s.z - e.pos.z)
      const alerta = ahora < e.alertaHasta
      if (!e.viendo && (dS < VER_CERCA || alerta)) {
        e.viendo = true
        if (e.fase === 'quieto') e.hasta = Infinity
        else quieto(Infinity, 'IdleTranquilo')
      } else if (e.viendo && dS > VER_CERCA + VER_SUELTA && !alerta) {
        e.viendo = false
        e.hasta = e.t + azar(0.8, 1.6)
        cara?.mirar(0, 0)
      }
    }
    let corrupta = null
    if (e.modo === 'deambular') {
      if (e.fase === 'quieto' && e.t > e.hasta) {
        // muy de vez en cuando, en lugar de pasear, va a ver la esfera corrupta
        if (!juegoActivo && ahora > e.curiosaCuando) {
          corrupta = buscarCorrupta?.() || null
          if (corrupta) empezarCuriosa(corrupta)
          else e.curiosaCuando = ahora + 20
        }
        if (e.modo === 'deambular') {
          viajar(elegirMeta(s), VEL.paseo)
          if (Math.random() < 0.25) cara?.poner('normal')
        }
      } else if (e.fase === 'quieto' && cara && e.t > 0.9 && e.t - dt <= 0.9) {
        const r = Math.random()
        if (r < 0.3) cara.poner('feliz')
        else if (r < 0.5) cara.voltear()
      }
    } else if (e.modo === 'oferta') {
      // se queda mientras Skulley siga en el portal; lo pregona en ciclos
      const sigue = cercaPortalRef.current === PORTAL_OFERTA || performance.now() < e.probandoHasta
      if (e.fase === 'quieto') {
        if (e.tOferta < 0) {
          e.tOferta = 0
          cara?.poner('feliz')
          pedir('IdleJugueton')
        }
        const antes = e.tOferta
        e.tOferta += dt
        if (antes < OFERTA.ciclo * 0.8 && e.tOferta >= OFERTA.ciclo * 0.8) pedir('IdleTranquilo')
        const c = e.tOferta % OFERTA.ciclo
        e.ofertaTexto = c < OFERTA.dice ? textos.portal.slice(0, Math.min(textos.portal.length, Math.floor(c * OFERTA.letras))) : ''
      }
      if (!sigue) {
        e.ofertaTexto = ''
        e.modo = 'deambular'
        e.ofertaEspera = performance.now() / 1000 + OFERTA.espera
        cara?.poner('normal')
        quieto(azar(1, 2), 'IdleTranquilo')
      }
    } else if (e.modo === 'curiosa') {
      corrupta = buscarCorrupta?.() || null
      if (!corrupta || juegoActivo) terminarCuriosa()
      else if (e.fase === 'girar' || e.fase === 'viaje') {
        // la esfera se mueve: la meta la sigue
        if (e.meta) e.meta.copy(puntoCurioso(corrupta))
      } else if (e.fase === 'quieto') {
        if (e.tCur < 0) {
          e.tCur = 0
          cara?.poner('confundida')
        }
        e.tCur += dt
        if (e.tCur > 0.8 && !e.dijoCur) {
          e.dijoCur = true
          const lista = textos.corrupta
          let i = Math.floor(Math.random() * lista.length)
          if (i === e.ultimaCur) i = (i + 1) % lista.length
          e.ultimaCur = i
          decir(lista[i], CURIOSA.dice)
        }
        if (e.tCur > CURIOSA.mira) terminarCuriosa()
        else if (Math.hypot(corrupta.pos.x - e.pos.x, corrupta.pos.z - e.pos.z) > CURIOSA.dist + 2.5) {
          // se le fue rodando: se le vuelve a acercar
          viajar(puntoCurioso(corrupta), CURIOSA.vel)
        }
      }
    } else if (e.modo === 'castigo') {
      if (e.fase === 'empujada' && e.t > PATADA.invoca) {
        e.fase = 'invocar'
        e.t = 0
        pedir('Invocar')
      }
      if (e.fase === 'viaje' && e.t > CASTIGO.vueloMax) {
        // se acabó el tiempo de vuelo: llega de un jalón para no atrasar el rayo
        e.pos.lerp(e.meta, 1 - Math.exp(-dt * 14))
      }
      if (e.fase === 'invocar') {
        if (e.golpe && e.t >= INVOCAR_GOLPE_S) {
          const golpe = e.golpe
          e.golpe = null
          try { golpe() } catch { }
        }
        if (e.t > INVOCAR_GOLPE_S + CASTIGO.despues) {
          e.modo = 'deambular'
          cara?.poner('normal')
          quieto(azar(1.5, 2.5), 'IdleTranquilo')
        }
      }
    }

    // ---- moverse
    let yawMeta = e.yaw
    if (e.meta) {
      const dx = e.meta.x - e.pos.x
      const dz = e.meta.z - e.pos.z
      const d = Math.hypot(dx, dz)
      if (e.fase === 'girar') {
        // primero voltea hacia donde va, luego sale
        yawMeta = Math.atan2(dx, dz)
        if (Math.abs(angulo(yawMeta - e.yaw)) < 0.35 || e.vel > VEL.paseo) {
          e.fase = 'viaje'
          e.t = 0
          if (e.sonando !== 'Avanzar' && e.sonando !== 'Arrancar') pedir(d > 9 ? 'Arrancar' : 'Avanzar')
        }
      }
      if (e.fase === 'viaje') {
        const frena = Math.min(1, d / Math.max(1.2, e.vel * 0.5))
        const vx = d > 1e-3 ? (dx / d) * e.vel * frena : 0
        const vz = d > 1e-3 ? (dz / d) * e.vel * frena : 0
        const k = 1 - Math.exp(-dt * (e.vel > VEL.paseo ? 5 : 2.2))
        e.v.x += (vx - e.v.x) * k
        e.v.z += (vz - e.v.z) * k
        if (Math.hypot(e.v.x, e.v.z) > 0.3) yawMeta = Math.atan2(e.v.x, e.v.z)
        if (d < 0.35 && Math.hypot(e.v.x, e.v.z) < 0.6) {
          e.v.set(0, 0, 0)
          if (e.modo === 'castigo') {
            e.fase = 'invocar'
            e.t = 0
            pedir('Invocar')
          } else {
            const seg = e.modo === 'deambular' ? azar(2.5, 6) : 9999
            quieto(seg, e.modo === 'deambular' && Math.random() < 0.4 ? 'IdleJugueton' : 'IdleTranquilo')
            e.meta = null
          }
        }
      }
    } else {
      e.v.multiplyScalar(Math.exp(-dt * 3))
    }
    e.pos.x += e.v.x * dt
    e.pos.z += e.v.z * dt
    const altoMeta = e.meta ? e.meta.y : ALTO
    e.pos.y += (altoMeta - e.pos.y) * (1 - Math.exp(-dt * 2.5))

    // si Skulley se le mete encima, se hace apenas a un lado (si no, se queda donde se detuvo)
    if (s && e.modo === 'deambular') {
      const ax = e.pos.x - s.x
      const az = e.pos.z - s.z
      const d = Math.hypot(ax, az)
      if (d < 1.6 && d > 1e-3) {
        e.pos.x += (ax / d) * (1.6 - d) * Math.min(1, dt * 6)
        e.pos.z += (az / d) * (1.6 - d) * Math.min(1, dt * 6)
      }
    }

    // a quién ve: a Skulley cuando habla, ofrece o castiga y ya no viaja
    const quietoEnSitio = !e.meta || e.fase === 'quieto' || e.fase === 'invocar' || (e.fase === 'viaje' && Math.hypot(e.v.x, e.v.z) < 0.8)
    if (e.mirar === 'skulley' && s && quietoEnSitio) yawMeta = Math.atan2(s.x - e.pos.x, s.z - e.pos.z)
    // detenida por Skulley (o pregonando): lo sigue con el cuerpo, y los ojos se adelantan al giro
    const loSigue = (e.modo === 'deambular' && e.viendo) || (e.modo === 'oferta' && e.fase === 'quieto')
    if (loSigue && s && cara) {
      const hacia = Math.atan2(s.x - e.pos.x, s.z - e.pos.z)
      yawMeta = hacia
      cara.mirar(THREE.MathUtils.clamp(angulo(hacia - e.yaw) / 0.9, -1, 1), -0.35)
    }
    // viendo la esfera corrupta: de frente y con los ojos abajo, hacia ella
    if (e.modo === 'curiosa' && corrupta && quietoEnSitio && cara) {
      const hacia = Math.atan2(corrupta.pos.x - e.pos.x, corrupta.pos.z - e.pos.z)
      yawMeta = hacia
      cara.mirar(THREE.MathUtils.clamp(angulo(hacia - e.yaw) / 0.9, -1, 1), -0.75)
    }
    const giro = e.modo === 'castigo' ? 9 : e.fase === 'girar' ? 3.2 : 4
    e.yaw += angulo(yawMeta - e.yaw) * (1 - Math.exp(-dt * giro))

    // el ladeo de los golpes: resorte que se mece y se asienta
    const L = e.ladeo
    L.vx += (-70 * L.x - 7 * L.vx) * dt
    L.vz += (-70 * L.z - 7 * L.vz) * dt
    L.x = THREE.MathUtils.clamp(L.x + L.vx * dt, -0.7, 0.7)
    L.z = THREE.MathUtils.clamp(L.z + L.vz * dt, -0.7, 0.7)

    if (g) {
      g.position.copy(e.pos)
      g.rotation.order = 'YXZ'
      g.rotation.set(L.x, e.yaw, L.z)
    }
    if (escudoGrupoRef.current) escudoGrupoRef.current.position.copy(e.pos)

    // la viñeta: lo que esté diciendo manda sobre el pregón de la tienda
    let texto = ''
    let layout = ''
    if (e.dice) {
      e.dice.t += dt
      if (e.dice.t < e.dice.dura) {
        texto = e.dice.texto.slice(0, Math.min(e.dice.texto.length, Math.floor(e.dice.t * LETRAS)))
        layout = e.dice.texto
      } else e.dice = null
    }
    if (!e.dice && e.modo === 'oferta' && e.ofertaTexto) {
      texto = e.ofertaTexto
      layout = textos.portal
    }
    if (e.modo === 'dialogo') texto = ''
    setVineta((v) => (v.on === Boolean(texto) && v.texto === texto && (v.layout === layout || !layout) ? v : { on: Boolean(texto), texto, layout: layout || v.layout }))
    if (anclaRef.current) anclaRef.current.position.set(e.pos.x, e.pos.y + 0.35, e.pos.z)
    dron.pos.x = e.pos.x
    dron.pos.y = e.pos.y
    dron.pos.z = e.pos.z
    if (import.meta.env.DEV) { dron.debug = e; dron.debugObj = { grupo: g, camara: camera, player: p, cara } }
  })

  const clic = (ev) => {
    ev.stopPropagation()
    const e = est.current
    if (!puedeHablar || e.modo === 'castigo' || dialogo) return
    try { onHablar?.() } catch { }
  }
  const sobre = (ev) => {
    ev.stopPropagation()
    if (!puedeHablar) return
    setHover(true)
    try { gl.domElement.style.cursor = 'pointer' } catch { }
  }
  const fuera = () => {
    setHover(false)
    try { gl.domElement.style.cursor = '' } catch { }
  }
  useEffect(() => { if (!puedeHablar && hover) fuera() }, [puedeHablar]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <DroneModel
        ref={grupoRef}
        caraRef={caraRef}
        size={TAM}
        outlineWorld={0.02}
        caraAuto={false}
        accion={accion.nombre}
        accionN={accion.n}
        onAccion={(n) => { est.current.sonando = n }}
        contornoColor={hover && !dialogo ? '#ffffff' : '#000000'}
        fuegoEscala={est.current.modo === 'deambular' ? 0.55 : 1}
      >
        {/* el área para picarlo: más grande que el drone, barata de raycastear */}
        <mesh onClick={clic} onPointerOver={sobre} onPointerOut={fuera} raycast={puedeHablar ? THREE.Mesh.prototype.raycast : () => null}>
          <sphereGeometry args={[TAM * 0.62, 10, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </DroneModel>
      {/* sombra en el piso: la silueta vista desde arriba, como la de Argus */}
      <SilhouetteShadow playerRef={grupoRef} enabled={Boolean(activo)} size={2.4} opacity={0.4} resolution={128} blur={1.2} height={6} />
      {/* el escudo: no gira ni se ladea con ella; solo se ve donde pega una bola */}
      <group ref={escudoGrupoRef}>
        <DomeShield ref={escudoRef} esfera radius={ESCUDO.radio} celda={ESCUDO.celda} alcance={ESCUDO.alcance} />
      </group>
      {/* la viñeta va fuera del grupo girado: SpeechBubble3D mira a cámara con padre sin rotación */}
      <object3D ref={anclaRef} />
      <SpeechBubble3D anchorRef={anclaRef} visible={vineta.on} displayText={vineta.texto} layoutText={vineta.layout || textos.portal} offset={[1.3, 0.6, 0]} />
    </>
  )
}
