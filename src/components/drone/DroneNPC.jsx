import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import DroneModel, { INVOCAR_GOLPE_S } from './DroneModel.jsx'
import SpeechBubble3D from '../SpeechBubble3D.jsx'
import SilhouetteShadow from '../SilhouetteShadow.jsx'
import DomeShield from '../fx/DomeShield.jsx'
import HumoDron from './HumoDron.jsx'
import { dron, escucharDron, juntoArgus, picarMadre, madreEnojada, salioDeHome, volvioAHome, cargarProyectos, listaProyectos, recomendo } from '../../lib/droneNpc.js'
import { dialogoMadre, escoger } from '../../lib/dialogoMadre.js'
import { escuchar as escucharJuego } from '../../lib/juegoEsferas.js'
import scoreStore from '../../lib/scoreStore.js'
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
// con cara de duda y dice algo de ella (`CURIOSA`). El rayo de la esfera
// corrupta sí le hace daño: la deja quemada un rato, humeando, mareada y con
// ojos de tache (`QUEMADA`), y eso da el logro de los lentes 3D (App).
//
// En la partida del juego de esferas (Oscar, 2026-11-19) se va junto a Argus
// (`juntoArgus`, desde que se acepta el trato en su escena) y desde ahí ve a
// Skulley y lo juzga en su viñeta cada tanto (`JUEGO`): bien si va bien, mal si
// va mal (aciertos y fallas recientes, rato sin meter nada, puntaje negativo).
// Habla solo si se ve en cámara; si no, espera. Al acabar regresa a pasear.
//
// Se siente viva (Oscar, 2026-11-23): se emociona al ver a Skulley de cerca y lo
// saluda en su viñeta (`SALUDA`, no muy seguido), y al regresar de una sección va
// volando hacia él y le dice cuánto tardó. Tiene humor (lib/droneNpc.js): si la
// cortas a media frase te lo reclama; si la picas mucho o la cortas seguido, no te
// habla un rato, te da la espalda y, si sigues picándola, se va. De vez en cuando
// (`RECOMIENDA`) va hacia Skulley y le cuenta de un proyecto de Trabajo al azar
// (`T.proyectos`, la lista del CMS en lib/droneNpc.js); si la pica en ese rato, la
// charla le ofrece llevarlo (DialogoMadre, `onVerProyecto` en App).
//
// Monta desde el warm-up con Argus (comoHome), así sus programas se compilan
// detrás del preloader. Todo lo que anima va por refs; el estado de React solo
// cambia con la acción del GLB, el contorno del hover y la viñeta.

const TAM = 1.35           // ancho del drone en el mundo (Skulley mide ~2.5)
const ALTO = 2.6           // altura de vuelo, al centro del drone
// Lo que ningún globo debe tapar, desde el ancla de su viñeta (0.35 arriba de su
// centro): alas, pantalla y el fuego de la turbina, medido con los vértices.
const CUERPO_VINETA = { abajo: 1.1, arriba: 0.3, radio: 0.95 }
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
// `aCamara`: cuánto se voltea de Skulley hacia la cámara (0 = a él, 1 = a la cámara).
const DIALOGO = { dist: 3.1, alto: 2.45, aCamara: 0.45 }
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
// El rayo de la esfera corrupta: le pega si cae a menos de `radio` (en el piso,
// bajo ella); queda quemada `dura` segundos, más abajo y meciéndose, y al final
// se sacude (`sacude` segundos) y el hollín se va solo.
const QUEMADA = { radio: 2.3, dura: 11, alto: 1.95, sacude: 0.7 }
// La partida: la primera viñeta y cada cuánto (segundos), cuánto espera si Argus
// acaba de comentar una captura o si ella no sale en cámara (y hasta cuándo deja
// de esperar), y con qué juzga: aciertos y fallas de los últimos `ventana`
// segundos, y `sinAcierto` segundos sin meter nada cuenta como ir mal. Si la
// mandaron y la partida no empieza en `sinPartida` segundos, regresa a pasear.
const JUEGO = { primera: [9, 13], cada: [14, 22], tapaArgus: 1.4, esperaMax: 10, ventana: 15, sinAcierto: 15, sinPartida: 8 }
// El saludo al verlo cerca: cada cuánto a lo más (segundos), cuánto espera después
// de una charla, a qué distancia de él se detiene al ir a recibirlo de una sección
// y cuándo reclama al cortarla (segundos después de cerrar: ya se fueron las barras).
const SALUDA = { cada: [60, 120], trasCharla: 40, recibe: 3.5, reclamo: 0.9 }
// Ofendida: a la tercera insistencia se va lejos (a más de `lejos` de Skulley).
// Los proyectos que recomienda: la primera vez (segundos desde que Skulley cae a la
// home) y cada cuánto después; si Skulley está a menos de `lejos`, va hacia él y lo
// dice ya viéndolo; si no, lo vuelve a intentar en `espera`. Nunca jugando ni enojada.
const RECOMIENDA = { primera: [45, 75], cada: [110, 190], lejos: 16, espera: 10, trasCharla: 40 }
const OFENDIDA = { seVaEn: 3, lejos: 9 }

const azar = (a, b) => a + Math.random() * (b - a)
// Parte un texto por frases en trozos de hasta `max` letras (una frase más larga va sola).
const trozos = (texto, max = 100) => {
  const out = []
  for (const f of texto.split(/(?<=[.!?…])\s+/)) {
    if (out.length && (out[out.length - 1] + ' ' + f).length <= max) out[out.length - 1] += ' ' + f
    else out.push(f)
  }
  return out
}
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
  const langRef = useRef(lang)
  langRef.current = lang
  const grupoRef = useRef()
  const caraRef = useRef(null)
  const anclaRef = useRef()
  const escudoRef = useRef(null)
  const escudoGrupoRef = useRef()
  const humoRef = useRef({ pos: new THREE.Vector3(), nivel: 0 })
  const [accion, setAccion] = useState({ nombre: 'IdleTranquilo', n: 0 })
  const [hover, setHover] = useState(false)
  const [vineta, setVineta] = useState({ on: false, texto: '', layout: '' })
  // desarrollo: window.__dronOferta() hace como si Skulley estuviera en el portal
  const [probarOferta, setProbarOferta] = useState(0)
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__dronOferta = () => { est.current.ofertaEspera = 0; setProbarOferta((n) => n + 1) }
    // y window.__dronDice('texto', segundos) le pone una frase (probar los globos)
    window.__dronDice = (texto, dura = 6) => { est.current.dice = { texto, t: 0, dura } }
    return () => { delete window.__dronOferta; delete window.__dronDice }
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
      tQuemada: 0,
      sacudida: 0,
      juegoPedido: 0,           // cuándo la mandaron junto a Argus
      comentaEn: 0,             // cuándo toca la siguiente viñeta de la partida
      esperaDesde: 0,           // desde cuándo espera para decirla
      bolsas: { bien: [], mal: [] },
      saludaEn: 0,              // desde cuándo puede saludarlo otra vez
      regreso: 0,               // regresó de una sección: cuánto estuvo fuera (lo dice al verlo)
      huyeHasta: 0,             // ofendida, se va: hasta entonces no se detiene a verlo
      reclamoHasta: 0,          // reclamando: la cara no cambia sola
      recomiendaEn: Infinity,   // cuándo recomienda un proyecto (lo pone la primera llegada)
      bolsaProyectos: [],       // slugs revueltos: no repite hasta acabarlos
      diceCola: [],             // las viñetas que siguen al acabar la que dice (una recomendación larga va en trozos)
    }
  }
  const pedir = (nombre) => setAccion((a) => ({ nombre, n: a.n + 1 }))
  const juegoActivoRef = useRef(juegoActivo)
  juegoActivoRef.current = juegoActivo
  const cercaPortalRef = useRef(nearPortalId)
  cercaPortalRef.current = nearPortalId

  // el estado compartido: montado solo de verdad en la home
  useEffect(() => {
    dron.montado = Boolean(activo)
    dron.escudo = activo ? ESCUDO.radio : 0
    return () => { dron.montado = false; dron.castigo = null; dron.escudo = 0 }
  }, [activo])

  // Skulley se va a una sección y regresa: al volver se emociona, va hacia él y lo
  // saluda con lo que tardó (la primera llegada no cuenta)
  const estuvoRef = useRef(false)
  useEffect(() => {
    if (!activo) {
      if (estuvoRef.current) salioDeHome()
      return
    }
    if (!estuvoRef.current) {
      estuvoRef.current = true
      cargarProyectos()
      est.current.recomiendaEn = performance.now() / 1000 + azar(RECOMIENDA.primera[0], RECOMIENDA.primera[1])
      return
    }
    const fuera = volvioAHome()
    const e = est.current
    if (!fuera || juegoActivoRef.current || madreEnojada()) return
    e.regreso = fuera
    e.saludaEn = 0
    // lo vuelve a "ver": si ya estaba cerca, lo saluda en el siguiente cuadro
    e.viendo = false
    const s = playerRef?.current?.position
    if (e.modo !== 'deambular' || !s) return
    const dx = e.pos.x - s.x
    const dz = e.pos.z - s.z
    const L = Math.hypot(dx, dz) || 1
    if (L < VER_CERCA) return
    const meta = new THREE.Vector3(s.x + (dx / L) * SALUDA.recibe, ALTO, s.z + (dz / L) * SALUDA.recibe)
    viajar(meta, VEL.prisa, 'skulley')
    e.fase = 'viaje'
    pedir(L > 9 ? 'Arrancar' : 'Avanzar')
    caraRef.current?.poner('feliz')
  }, [activo]) // eslint-disable-line react-hooks/exhaustive-deps

  // dice algo en su viñeta (se escribe letra por letra)
  const decir = (texto, dura) => { est.current.dice = { texto, t: 0, dura }; est.current.diceCola = [] }
  const reclamoRef = useRef(0)
  useEffect(() => () => clearTimeout(reclamoRef.current), [])
  // lo ve llegar cerca: se emociona y lo saluda (no muy seguido); ofendida, se voltea
  const saludar = (ahora, yaQuieta) => {
    const e = est.current
    if (juegoActivoRef.current || e.dice || ahora < e.saludaEn) return
    const cara = caraRef.current
    if (madreEnojada()) { cara?.voltear(); return }
    const T = textosRef.current
    const regreso = e.regreso > 0
    const texto = escoger(regreso ? T.regreso : T.veCerca, regreso ? 'regreso' : 'veCerca', { seg: e.regreso, lang: langRef.current })
    e.regreso = 0
    decir(texto, 2.6 + texto.length / LETRAS)
    cara?.poner('feliz')
    if (yaQuieta) pedir('IdleJugueton')
    e.saludaEn = ahora + azar(SALUDA.cada[0], SALUDA.cada[1])
  }
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
    if (msg.fin) {
      cara?.poner('normal')
      pedir('IdleTranquilo')
      e.saludaEn = Math.max(e.saludaEn, performance.now() / 1000 + SALUDA.trasCharla)
      e.recomiendaEn = Math.max(e.recomiendaEn, performance.now() / 1000 + RECOMIENDA.trasCharla)
      // la dejaste hablando sola (o sin adiós, a veces): te lo reclama ya sin las barras
      const como = msg.como
      if (como === 'cortada' || (como === 'sinAdios' && Math.random() < 0.6)) {
        clearTimeout(reclamoRef.current)
        reclamoRef.current = setTimeout(() => {
          const e2 = est.current
          if (e2.modo !== 'deambular') return
          const texto = escoger(textosRef.current[como], como, { lang: langRef.current })
          decir(texto, 2.4 + texto.length / LETRAS)
          caraRef.current?.poner(como === 'cortada' ? 'enojada' : 'confundida')
          const ahora = performance.now() / 1000
          e2.alertaHasta = ahora + 4
          e2.reclamoHasta = ahora + 4
        }, SALUDA.reclamo * 1000)
      }
    }
    if (msg.alJuego === true && e.modo !== 'castigo' && e.modo !== 'quemada' && e.modo !== 'dialogo') {
      e.juegoPedido = performance.now() / 1000
      if (e.modo !== 'juego') entrarAJuego()
    }
    if (msg.alJuego === false && e.modo === 'juego' && !juegoActivoRef.current) salirDeJuego()
    if (msg.escudo) {
      const { x, y, z, fuerza } = msg.escudo
      escudoRef.current?.hit({ x, y, z }, 0.6 + 0.4 * fuerza)
      ladear(e.pos.x - x, e.pos.z - z, 0.25 + 0.35 * fuerza)
      if (e.modo === 'castigo' || e.modo === 'dialogo' || e.modo === 'quemada') return
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
      // quemada y mareada no castiga: solo se mece del golpe
      if (e.modo === 'quemada') { ladear(msg.patada.dx, msg.patada.dz, 1.2); return }
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

  // el rayo de la esfera corrupta (el que lanza Skulley después de comérsela, o el
  // de la esfera al caer en un portal): si cae cerca de ella, la quema
  useEffect(() => {
    const cerca = (x, z) => Math.hypot(x - est.current.pos.x, z - est.current.pos.z) < QUEMADA.radio
    const onTrueno = (ev) => {
      const pts = ev?.detail?.points || []
      if (pts.some((q) => cerca(q.x, q.z))) quemar('trueno')
    }
    const onAntimateria = (ev) => {
      const d = ev?.detail || {}
      if (Number.isFinite(d.x) && Number.isFinite(d.z) && cerca(d.x, d.z)) quemar('portal')
    }
    window.addEventListener('thunder-strike', onTrueno)
    window.addEventListener('antimatter-orb-strike', onAntimateria)
    return () => {
      window.removeEventListener('thunder-strike', onTrueno)
      window.removeEventListener('antimatter-orb-strike', onAntimateria)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    // window.__dronRecomendar() hace que recomiende un proyecto ya (va hacia Skulley si está a medio camino)
    window.__dronRecomendar = () => { est.current.recomiendaEn = 0; est.current.dice = null }
    // window.__dronQuemar() hace como si le cayera el rayo de la esfera corrupta
    window.__dronQuemar = (fuente = 'portal') => quemar(fuente)
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
    return () => { delete window.__dronCuriosa; delete window.__dronEscudo; delete window.__dronQuemar; delete window.__dronRecomendar }
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

  // le cuenta de un proyecto al azar, sin repetir hasta acabarlos; luego la pista de
  // que si la pica lo lleva (lib/droneNpc.js `recomendo`)
  const recomendar = (ahora) => {
    const e = est.current
    const T = textosRef.current
    const lista = listaProyectos(T.proyectos)
    if (!lista.length) { e.recomiendaEn = ahora + 60; return }
    let p = null
    for (let i = 0; i < 2 && !p; i++) {
      if (!e.bolsaProyectos.length) e.bolsaProyectos = lista.map((x) => x.slug).sort(() => Math.random() - 0.5)
      while (e.bolsaProyectos.length && !p) {
        const slug = e.bolsaProyectos.pop()
        p = lista.find((x) => x.slug === slug) || null
      }
    }
    if (!p) { e.recomiendaEn = ahora + 60; return }
    const propio = T.proyectos?.[p.slug]
    const titulo = propio?.titulo || p.titulo
    const texto = propio?.t || T.proyectoGenerico.replace('{titulo}', titulo)
    // en trozos por frase: un globo de 8 renglones no se lee
    const [primero, ...resto] = trozos(texto)
    decir(primero, 2.4 + primero.length / LETRAS)
    e.diceCola = [...resto, escoger(T.pistaProyecto, 'pistaProyecto', { lang: langRef.current })]
    caraRef.current?.poner('feliz')
    if (e.fase === 'quieto') pedir('IdleJugueton')
    recomendo({ slug: p.slug, titulo })
    e.recomiendaEn = ahora + azar(RECOMIENDA.cada[0], RECOMIENDA.cada[1])
    e.saludaEn = Math.max(e.saludaEn, ahora + 30)
  }

  // un lugar de la plaza lejos de Skulley (ofendida, se va)
  const lejosDe = (s) => {
    if (!s) return null
    for (let i = 0; i < 32; i++) {
      const a = Math.random() * Math.PI * 2
      const r = azar(4, 12.5)
      const x = Math.sin(a) * r
      const z = Math.cos(a) * r
      if (Math.hypot(x - s.x, z - s.z) < OFENDIDA.lejos || !libre(x, z, s)) continue
      return new THREE.Vector3(x, ALTO + azar(-0.2, 0.3), z)
    }
    return null
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

  // ---- el rayo de la esfera corrupta: quemada, humeando y con ojos de tache.
  // `fuente`: 'portal' (la esfera que cae en un portal) o 'trueno' (el que lanza
  // Skulley); Argus solo se burla del de portal.
  function quemar(fuente) {
    const e = est.current
    if (!dron.montado || e.modo === 'dialogo') return
    if (e.modo === 'curiosa') terminarCuriosa(false)
    // el rayo le gana a todo, hasta a su castigo (el de las trampas lo remata App a su tiempo)
    e.modo = 'quemada'
    e.tQuemada = 0
    e.sacudida = 0
    e.golpe = null
    e.meta = null
    e.mirar = null
    e.ofertaTexto = ''
    e.dice = null
    e.diceCola = []
    e.v.set(0, 0, 0)
    e.pos.y -= 0.35
    e.ladeo.vx += (Math.random() - 0.5) * 9
    e.ladeo.vz += (Math.random() < 0.5 ? -1 : 1) * 7
    const cara = caraRef.current
    cara?.poner('tache')
    cara?.quemar(1)
    pedir('Detenerse')
    try { window.dispatchEvent(new CustomEvent('madre-quemada', { detail: { fuente } })) } catch { }
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

  // ---- la partida: lo que va metiendo el jugador, para juzgarlo
  const partidaRef = useRef({ capturas: [], ultimaCaptura: 0, ultimoAcierto: 0 })
  useEffect(() => escucharJuego((tipo, d) => {
    const P = partidaRef.current
    const ahora = performance.now() / 1000
    if (tipo === 'inicio') {
      P.capturas = []
      P.ultimaCaptura = 0
      P.ultimoAcierto = ahora
      est.current.comentaEn = ahora + azar(JUEGO.primera[0], JUEGO.primera[1])
      est.current.esperaDesde = 0
    } else if (tipo === 'captura') {
      P.capturas.push({ t: ahora, bien: d.puntos > 0 })
      if (P.capturas.length > 40) P.capturas.shift()
      P.ultimaCaptura = ahora
      if (d.puntos > 0) P.ultimoAcierto = ahora
    }
  }), [])
  // > 0: va bien
  const comoVa = (ahora) => {
    const P = partidaRef.current
    let bien = 0
    let mal = 0
    for (const c of P.capturas) {
      if (ahora - c.t > JUEGO.ventana) continue
      if (c.bien) bien += 1
      else mal += 1
    }
    let n = bien - mal * 1.5
    if (ahora - P.ultimoAcierto > JUEGO.sinAcierto) n -= 2
    if (scoreStore.get() < 0) n -= 2
    return n
  }
  // de una bolsa revuelta, sin repetir hasta que se acabe
  const sacar = (tipo) => {
    const e = est.current
    const lista = textosRef.current.juego[tipo]
    if (!e.bolsas[tipo].length) e.bolsas[tipo] = lista.map((_, i) => i).sort(() => Math.random() - 0.5)
    return lista[e.bolsas[tipo].pop()] || lista[0]
  }
  const _enCuadro = useMemo(() => new THREE.Vector3(), [])
  const enCuadro = () => {
    const e = est.current
    _enCuadro.set(e.pos.x, e.pos.y, e.pos.z).project(camera)
    return _enCuadro.z < 1 && Math.abs(_enCuadro.x) < 0.85 && Math.abs(_enCuadro.y) < 0.85
  }
  // junto a Argus, de prisa; se queda ahí viendo a Skulley
  function entrarAJuego() {
    const e = est.current
    if (e.modo === 'curiosa') terminarCuriosa(false)
    e.modo = 'juego'
    e.ofertaTexto = ''
    const j = juntoArgus()
    const meta = new THREE.Vector3(j.x, j.y, j.z)
    viajar(meta, VEL.oferta, 'skulley')
    e.fase = 'viaje'
    pedir(e.pos.distanceTo(meta) > 6 ? 'Arrancar' : 'Avanzar')
    caraRef.current?.poner('feliz')
  }
  function salirDeJuego() {
    const e = est.current
    e.modo = 'deambular'
    e.juegoPedido = 0
    caraRef.current?.poner('normal')
    caraRef.current?.mirar(0, 0)
    quieto(azar(1.5, 3), 'IdleTranquilo')
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
      e.diceCola = []
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

    // el castigo manda sobre todo, menos quemada: ahí no puede (el de las trampas lo remata App)
    if (dron.castigo && e.modo === 'quemada') dron.castigo = null
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
      if (!e.viendo && (dS < VER_CERCA || alerta) && ahora > e.huyeHasta) {
        e.viendo = true
        const yaQuieta = e.fase === 'quieto'
        if (yaQuieta) e.hasta = Infinity
        else quieto(Infinity, 'IdleTranquilo')
        if (!alerta) saludar(ahora, yaQuieta)
      } else if (e.viendo && dS > VER_CERCA + VER_SUELTA && !alerta) {
        e.viendo = false
        e.hasta = e.t + azar(0.8, 1.6)
        cara?.mirar(0, 0)
      }
    }
    // de vez en cuando le recomienda un proyecto: viéndolo lo dice; a medio camino va hacia él
    if (e.modo === 'deambular' && s && !juegoActivo && !e.dice && ahora > e.recomiendaEn && ahora > e.huyeHasta && !madreEnojada()) {
      const dS = Math.hypot(s.x - e.pos.x, s.z - e.pos.z)
      if (e.viendo && dS < VER_CERCA + VER_SUELTA) recomendar(ahora)
      else if (dS < RECOMIENDA.lejos && e.fase === 'quieto') {
        const L = dS || 1
        e.viendo = false
        e.saludaEn = Math.max(e.saludaEn, ahora + 20)
        viajar(new THREE.Vector3(s.x + ((e.pos.x - s.x) / L) * SALUDA.recibe, ALTO, s.z + ((e.pos.z - s.z) / L) * SALUDA.recibe), VEL.prisa * 0.6, 'skulley')
        e.recomiendaEn = ahora + 3
      } else e.recomiendaEn = ahora + (e.fase === 'quieto' ? RECOMIENDA.espera : 3)
    }
    // la partida: desde pasear (o al acabar un castigo o la quemada) se va junto a Argus
    if (juegoActivo && e.modo === 'deambular') entrarAJuego()
    let corrupta = null
    if (e.modo === 'juego') {
      if (!juegoActivo && ahora - e.juegoPedido > JUEGO.sinPartida) salirDeJuego()
      else if (juegoActivo && e.fase === 'quieto' && !e.dice && ahora > e.comentaEn) {
        const P = partidaRef.current
        // Argus acaba de comentar una captura, o ella no sale en cámara: espera
        if (!e.esperaDesde) e.esperaDesde = ahora
        const tapa = ahora - P.ultimaCaptura < JUEGO.tapaArgus
        if (!P.capturas.length && ahora - P.ultimoAcierto < JUEGO.sinAcierto) {
          // todavía no hay con qué juzgarlo (nada metido y poco rato)
          e.comentaEn = ahora + 1.5
          e.esperaDesde = 0
        } else if (ahora - e.esperaDesde > JUEGO.esperaMax) {
          e.esperaDesde = 0
          e.comentaEn = ahora + azar(JUEGO.cada[0], JUEGO.cada[1]) * 0.5
        } else if (!tapa && enCuadro()) {
          const bien = comoVa(ahora) > 0
          const texto = sacar(bien ? 'bien' : 'mal')
          decir(texto, 3.2 + texto.length / LETRAS)
          if (bien) { cara?.poner('feliz'); pedir('IdleJugueton') }
          else if (Math.random() < 0.5) cara?.poner('confundida')
          else { cara?.poner('normal'); cara?.voltear() }
          e.esperaDesde = 0
          e.comentaEn = ahora + azar(JUEGO.cada[0], JUEGO.cada[1])
        }
      }
    } else if (e.modo === 'deambular') {
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
      } else if (e.fase === 'quieto' && cara && e.t > 0.9 && e.t - dt <= 0.9 && ahora > e.reclamoHasta && !madreEnojada()) {
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
    } else if (e.modo === 'quemada') {
      e.tQuemada += dt
      if (e.tQuemada > QUEMADA.dura) {
        // se sacude como perro mojado y vuelve a lo suyo; el hollín se va solo
        if (e.sacudida === 0) { cara?.poner('normal'); cara?.quemar(0) }
        const antes = e.sacudida
        e.sacudida += dt
        const paso = 0.09
        if (Math.floor(e.sacudida / paso) !== Math.floor(antes / paso)) {
          e.ladeo.vz += (Math.floor(e.sacudida / paso) % 2 ? 1 : -1) * 5
        }
        if (e.sacudida > QUEMADA.sacude) {
          e.modo = 'deambular'
          quieto(azar(1.5, 2.5), 'IdleTranquilo')
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
    const altoMeta = e.modo === 'quemada' && e.sacudida === 0
      ? QUEMADA.alto + 0.12 * Math.sin(e.tQuemada * 2.4)
      : (e.meta ? e.meta.y : ALTO)
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
    if (e.mirar === 'skulley' && s && quietoEnSitio) {
      // en el diálogo se abre un poco a la cámara, como en el teatro: la cámara la
      // ve desde un lado de Skulley y de frente a él se le veía la cara de perfil
      const k = e.modo === 'dialogo' ? DIALOGO.aCamara : 0
      const mx = s.x + (camera.position.x - s.x) * k
      const mz = s.z + (camera.position.z - s.z) * k
      yawMeta = Math.atan2(mx - e.pos.x, mz - e.pos.z)
    }
    // detenida por Skulley (o pregonando): lo sigue con el cuerpo, y los ojos se adelantan al giro
    const loSigue = (e.modo === 'deambular' && e.viendo) || ((e.modo === 'oferta' || e.modo === 'juego') && e.fase === 'quieto')
    if (loSigue && s && cara) {
      const hacia = Math.atan2(s.x - e.pos.x, s.z - e.pos.z)
      yawMeta = hacia
      cara.mirar(THREE.MathUtils.clamp(angulo(hacia - e.yaw) / 0.9, -1, 1), -0.35)
    }
    // ofendida: le da la espalda mientras no le habla
    if (e.modo === 'deambular' && e.viendo && s && cara && quietoEnSitio && madreEnojada()) {
      yawMeta = Math.atan2(e.pos.x - s.x, e.pos.z - s.z)
      cara.mirar(0, -0.5)
    }
    // quemada y mareada: gira despacio sobre sí misma
    if (e.modo === 'quemada' && e.sacudida === 0) yawMeta = e.yaw + 0.35
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
    const mareo = e.modo === 'quemada' && e.sacudida === 0 ? 0.16 : 0
    const ox = mareo * Math.sin(e.tQuemada * 2.2)
    const oz = mareo * Math.cos(e.tQuemada * 2.2)
    L.vx += (-70 * (L.x - ox) - 7 * L.vx) * dt
    L.vz += (-70 * (L.z - oz) - 7 * L.vz) * dt
    L.x = THREE.MathUtils.clamp(L.x + L.vx * dt, -0.7, 0.7)
    L.z = THREE.MathUtils.clamp(L.z + L.vz * dt, -0.7, 0.7)

    if (g) {
      g.position.copy(e.pos)
      g.rotation.order = 'YXZ'
      g.rotation.set(L.x, e.yaw, L.z)
    }
    if (escudoGrupoRef.current) escudoGrupoRef.current.position.copy(e.pos)
    // humea fuerte al principio y menos con el tiempo; ya sacudida, lo que quede de hollín
    const H = humoRef.current
    H.pos.set(e.pos.x, e.pos.y + 0.2, e.pos.z)
    H.nivel = e.modo === 'quemada' && e.sacudida === 0
      ? Math.max(0.35, 1 - 0.65 * (e.tQuemada / QUEMADA.dura))
      : (cara ? cara.estado.quemado * 0.35 : 0)

    // la viñeta: lo que esté diciendo manda sobre el pregón de la tienda
    let texto = ''
    let layout = ''
    if (e.dice) {
      e.dice.t += dt
      if (e.dice.t < e.dice.dura) {
        texto = e.dice.texto.slice(0, Math.min(e.dice.texto.length, Math.floor(e.dice.t * LETRAS)))
        layout = e.dice.texto
      } else if (e.diceCola.length && e.modo === 'deambular') {
        const sigue = e.diceCola.shift()
        e.dice = { texto: sigue, t: 0, dura: 2.4 + sigue.length / LETRAS }
      } else {
        e.dice = null
        e.diceCola = []
      }
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
    if (!puedeHablar || e.modo === 'castigo' || e.modo === 'quemada' || dialogo) return
    const r = picarMadre()
    if (r.tipo === 'charla') {
      try { onHablar?.() } catch { }
      return
    }
    // no te habla: te lo dice en su viñeta, enojada, y a la tercera insistencia se va
    const T = textosRef.current
    const clave = r.tipo === 'rechazo' ? (r.por === 'clics' ? 'harta' : 'rechazo') : 'insiste'
    const texto = escoger(T[clave], clave, { lang: langRef.current })
    decir(texto, 2.4 + texto.length / LETRAS)
    caraRef.current?.poner('enojada')
    e.reclamoHasta = performance.now() / 1000 + 4
    if (r.tipo === 'insiste' && r.n === OFENDIDA.seVaEn && e.modo === 'deambular') {
      const meta = lejosDe(playerRef?.current?.position)
      if (meta) {
        e.viendo = false
        e.huyeHasta = performance.now() / 1000 + 5
        viajar(meta, VEL.prisa)
      }
    }
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
        caraAuto={false}
        accion={accion.nombre}
        accionN={accion.n}
        onAccion={(n) => { est.current.sonando = n }}
        contornoColor={hover && !dialogo ? '#ffffff' : '#000000'}
        fuegoEscala={est.current.modo === 'deambular' || est.current.modo === 'quemada' || est.current.modo === 'juego' ? 0.55 : 1}
      >
        {/* el área para picarlo: más grande que el drone, barata de raycastear */}
        <mesh onClick={clic} onPointerOver={sobre} onPointerOut={fuera} raycast={puedeHablar ? THREE.Mesh.prototype.raycast : () => null}>
          <sphereGeometry args={[TAM * 0.62, 10, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </DroneModel>
      {/* sombra en el piso: la silueta vista desde arriba, como la de Argus */}
      <SilhouetteShadow playerRef={grupoRef} enabled={Boolean(activo)} size={2.4} opacity={0.4} resolution={128} blur={1.2} height={6} />
      {/* el humo de cuando la quema el rayo de la esfera corrupta */}
      <HumoDron fuenteRef={humoRef} />
      {/* el escudo: no gira ni se ladea con ella; solo se ve donde pega una bola */}
      <group ref={escudoGrupoRef}>
        <DomeShield ref={escudoRef} esfera radius={ESCUDO.radio} celda={ESCUDO.celda} alcance={ESCUDO.alcance} />
      </group>
      {/* la viñeta va fuera del grupo girado: SpeechBubble3D mira a cámara con padre sin rotación */}
      <object3D ref={anclaRef} />
      <SpeechBubble3D anchorRef={anclaRef} visible={vineta.on} displayText={vineta.texto} layoutText={vineta.layout || textos.portal} offset={[1.3, 0.6, 0]} evitar={CUERPO_VINETA} />
    </>
  )
}
