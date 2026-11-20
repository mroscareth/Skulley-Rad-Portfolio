import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import DroneModel, { INVOCAR_GOLPE_S } from './DroneModel.jsx'
import SpeechBubble3D from '../SpeechBubble3D.jsx'
import SilhouetteShadow from '../SilhouetteShadow.jsx'
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
}) {
  const { gl, camera } = useThree()
  const { lang } = useLanguage()
  const textos = dialogoMadre(lang)
  const grupoRef = useRef()
  const caraRef = useRef(null)
  const anclaRef = useRef()
  const [accion, setAccion] = useState({ nombre: 'IdleTranquilo', n: 0 })
  const [hover, setHover] = useState(false)
  const [oferta, setOferta] = useState({ on: false, texto: '' })
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
    }
  }
  const pedir = (nombre) => setAccion((a) => ({ nombre, n: a.n + 1 }))
  const cercaPortalRef = useRef(nearPortalId)
  cercaPortalRef.current = nearPortalId

  // el estado compartido: montado solo de verdad en la home
  useEffect(() => {
    dron.montado = Boolean(activo)
    return () => { dron.montado = false; dron.castigo = null }
  }, [activo])

  // lo que pide el diálogo
  useEffect(() => escucharDron((msg) => {
    const cara = caraRef.current
    if (msg.cara && cara) cara.poner(msg.cara)
    if (msg.voltear && cara) cara.voltear()
    if (msg.accion) pedir(msg.accion)
    if (msg.fin) { cara?.poner('normal'); pedir('IdleTranquilo') }
  }), [])

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
      setOferta((o) => (o.on ? { on: false, texto: '' } : o))
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
      setOferta((o) => (o.on ? { on: false, texto: '' } : o))
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
    if (e.modo !== 'deambular') e.viendo = false
    if (e.modo === 'deambular' && s) {
      const dS = Math.hypot(s.x - e.pos.x, s.z - e.pos.z)
      if (!e.viendo && dS < VER_CERCA) {
        e.viendo = true
        if (e.fase === 'quieto') e.hasta = Infinity
        else quieto(Infinity, 'IdleTranquilo')
      } else if (e.viendo && dS > VER_CERCA + VER_SUELTA) {
        e.viendo = false
        e.hasta = e.t + azar(0.8, 1.6)
        cara?.mirar(0, 0)
      }
    }
    if (e.modo === 'deambular') {
      if (e.fase === 'quieto' && e.t > e.hasta) {
        viajar(elegirMeta(s), VEL.paseo)
        if (Math.random() < 0.25) cara?.poner('normal')
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
        const texto = c < OFERTA.dice ? textos.portal.slice(0, Math.min(textos.portal.length, Math.floor(c * OFERTA.letras))) : ''
        setOferta((o) => (o.on === Boolean(texto) && o.texto === texto ? o : { on: Boolean(texto), texto }))
      }
      if (!sigue) {
        setOferta((o) => (o.on ? { on: false, texto: '' } : o))
        e.modo = 'deambular'
        e.ofertaEspera = performance.now() / 1000 + OFERTA.espera
        cara?.poner('normal')
        quieto(azar(1, 2), 'IdleTranquilo')
      }
    } else if (e.modo === 'castigo') {
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
    const giro = e.modo === 'castigo' ? 9 : e.fase === 'girar' ? 3.2 : 4
    e.yaw += angulo(yawMeta - e.yaw) * (1 - Math.exp(-dt * giro))

    if (g) {
      g.position.copy(e.pos)
      g.rotation.set(0, e.yaw, 0)
    }
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
      {/* la viñeta va fuera del grupo girado: SpeechBubble3D mira a cámara con padre sin rotación */}
      <object3D ref={anclaRef} />
      <SpeechBubble3D anchorRef={anclaRef} visible={oferta.on} displayText={oferta.texto} layoutText={textos.portal} offset={[1.3, 0.6, 0]} />
    </>
  )
}
