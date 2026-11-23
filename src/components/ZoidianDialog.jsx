import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { useShopData } from '../lib/shopDataContext.jsx'
import { dialogoArgus } from '../lib/dialogoArgus.js'
import { argus, avisarArgus } from '../lib/argusNpc.js'
import { caminarA, caminata, soltarCaminata } from '../lib/caminataAuto.js'
import { blipArgus } from '../lib/blipArgus.js'
import { blipMadre } from '../lib/blipMadre.js'
import { dron, avisarDron, juntoArgus } from '../lib/droneNpc.js'
import { useGlitchSolo, textoGlitch } from '../hooks/useGlitchRunas.js'
import RenglonRunas from './drone/RenglonRunas.jsx'
import { TicketArt } from './GoldenTicketBadge.jsx'
import { PRIZE_RAYS, Sparkle } from './argusArt.jsx'
import { Tecla, Raton, GlifoTactil } from './TutorialModal.jsx'

// La escena del trato de Argus (Oscar, 2026-11-19: "cinemática, como la de
// M.A.D.R.E."). Mismo lenguaje que su diálogo (DialogoMadre): la UI del sitio se
// va (App), entran las barras de cine, Skulley camina hasta quedar enfrente de
// Argus (lib/caminataAuto.js) y la cámara se pone sobre su hombro viéndolo
// (CameraController `dialogo` con Argus). Abajo el globo con tinta; cada renglón
// llega en SKULLEYGLYPH y se revela con la voz de Argus (blipArgus), y le pide
// clip, cara y mirada (lib/argusNpc.js; los anima ZoidianNPC). Lo que el renglón
// enseña (el boleto, las teclas, el reloj) sale en una tarjeta arriba a la derecha.
//
// La primera vez en la pestaña cuenta el trato completo; después, un saludo.
// Luego el menú: a jugar (arranca la partida al cerrar), cómo se juega, qué
// gano, ahora no. Clic, Espacio o Enter pasan el renglón; flechas y Enter
// eligen; Escape sale en cualquier momento. Al aceptar, el drone de M.A.D.R.E.
// vuela junto a Argus (avisarDron alJuego) y ella dice su renglón: apaga los
// portales y empieza la partida.

const ENTRADA_MS = 700
const SALIDA_MS = 650
// La tarjeta que se va espera su salida antes de que entre la otra.
const MUESTRA_SALE_MS = 220
// Los renglones que cierran (a jugar, ahora no) se pasan solos.
const CIERRE_SOLO_MS = 1100
// El renglón de M.A.D.R.E. espera a que el drone llegue junto a Argus (a esta
// distancia), a lo más este tiempo.
const MADRE_LLEGA = { dist: 2.2, maxMs: 2600 }
const VISTO = 'skulley_argus_trato'
const FIRMA_GLITCH = { primeraMs: 1600, cadaMs: 4600, sostieneMs: 1300 }
// Dónde se para Skulley: enfrente de Argus a esta distancia, dentro de un cono
// alrededor de hacia donde ve Argus (de lado se veía su perfil).
const FRENTE_DIST = 3.6
const FRENTE_CONO = (35 * Math.PI) / 180
const PORTAL_Y = 2.2

const quietoPreferido = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function lugarFrente(px, pz) {
  const fx = Math.sin(argus.rotY)
  const fz = Math.cos(argus.rotY)
  let dx = px - argus.pos.x
  let dz = pz - argus.pos.z
  if (Math.hypot(dx, dz) < 1e-3) { dx = fx; dz = fz }
  const frente = Math.atan2(fx, fz)
  let a = Math.atan2(dx, dz) - frente
  a = Math.atan2(Math.sin(a), Math.cos(a))
  a = Math.max(-FRENTE_CONO, Math.min(FRENTE_CONO, a)) + frente
  return { x: argus.pos.x + Math.sin(a) * FRENTE_DIST, z: argus.pos.z + Math.cos(a) * FRENTE_DIST }
}

// Cuánto pide y da cada boleto (catálogo de la tienda) y cuántos dorados quedan
// este mes (profile.php?action=tickets, se pide al abrir: cambia mientras otros juegan).
function useTicketStats() {
  const { tickets } = useShopData()
  const [stats, setStats] = useState(null)
  useEffect(() => {
    let vivo = true
    fetch('/api/profile.php?action=tickets')
      .then((r) => r.json())
      .then((j) => { if (vivo && j?.ok) setStats(j) })
      .catch(() => { })
    return () => { vivo = false }
  }, [])
  const tiers = stats?.tiers || tickets
  return { gold: tiers?.gold || {}, silver: tiers?.silver || {}, resetsAt: stats?.resets_at || null, listo: Boolean(stats) }
}

// La tarjeta de lo que enseña el renglón.
function Muestra({ tipo, D, gold, silver }) {
  if (tipo === 'dorado' || tipo === 'plateado') {
    const tier = tipo === 'dorado' ? 'gold' : 'silver'
    const info = tier === 'gold' ? gold : silver
    return (
      <div className="trato-muestra__premio">
        <svg className="argus-prize-rays" viewBox="-50 -50 100 100" aria-hidden>
          <path d={PRIZE_RAYS} fill="#fff" opacity="0.07" />
        </svg>
        <Sparkle style={{ left: '0.6rem', top: '0.5rem', width: 18 }} />
        <Sparkle style={{ right: '0.8rem', bottom: '0.7rem', width: 22, animationDelay: '-0.7s' }} />
        <TicketArt tier={tier} pct={info.pct || (tier === 'gold' ? 35 : 10)} className="golden-ticket--idle trato-muestra__boleto" />
      </div>
    )
  }
  if (tipo === 'boletos') {
    return (
      <div className="trato-muestra__premio trato-muestra__premio--dos">
        <svg className="argus-prize-rays" viewBox="-50 -50 100 100" aria-hidden>
          <path d={PRIZE_RAYS} fill="#fff" opacity="0.07" />
        </svg>
        <TicketArt tier="silver" pct={silver.pct || 10} className="golden-ticket--idle trato-muestra__boleto" />
        <TicketArt tier="gold" pct={gold.pct || 35} className="golden-ticket--idle trato-muestra__boleto" />
      </div>
    )
  }
  if (tipo === 'stock') {
    const cap = gold.monthly_cap || 10
    const quedan = gold.left_this_month ?? cap
    return (
      <div className="trato-muestra__stock">
        <TicketArt tier="gold" pct={gold.pct || 35} className="golden-ticket--idle trato-muestra__boleto trato-muestra__boleto--chico" />
        <div className="ticket-stock" aria-hidden>
          {Array.from({ length: cap }, (_, i) => (
            <span key={i} className={`ticket-stock__stub ${i >= quedan ? 'ticket-stock__stub--taken' : ''}`} />
          ))}
        </div>
        <p className="trato-muestra__dato">{quedan > 0 ? D.boleto.quedan : D.boleto.agotados}</p>
      </div>
    )
  }
  if (tipo === 'reloj') {
    return (
      <div className="trato-muestra__reloj">
        <svg viewBox="0 0 64 70" aria-hidden className="trato-muestra__cronometro">
          <rect x="26" y="1" width="12" height="9" rx="2" />
          <circle cx="32" cy="40" r="27" />
          <path d="M32 40 L32 22" />
          <path d="M32 40 L44 46" />
        </svg>
        <span className="argus-display trato-muestra__cifra">60<small>{D.segundos}</small></span>
      </div>
    )
  }
  if (tipo === 'racha') {
    return (
      <div className="trato-muestra__racha argus-display">
        <span>×2</span><span>×3</span><span>×4</span>
      </div>
    )
  }
  if (tipo === 'dorada') {
    return (
      <div className="trato-muestra__dorada">
        <span className="trato-muestra__orbe" aria-hidden />
        <span className="argus-display trato-muestra__cifra">500</span>
      </div>
    )
  }
  if (tipo === 'espacio' || tipo === 'raton' || tipo === 'teclaE') {
    return (
      <div className="trato-muestra__glifos">
        {tipo === 'espacio' && <Tecla ancha>{D.espacio}</Tecla>}
        {tipo === 'teclaE' && <Tecla>E</Tecla>}
        {tipo !== 'espacio' && <Raton />}
      </div>
    )
  }
  if (tipo === 'botonPatada' || tipo === 'joystick' || tipo === 'botonRayo') {
    const id = tipo === 'botonPatada' ? 'kick' : tipo === 'botonRayo' ? 'laser' : 'move'
    return <div className="trato-muestra__glifos"><GlifoTactil id={id} /></div>
  }
  return null
}

export default function ZoidianDialog({ onClose, onPlay, playerRef, portals, tactil = false }) {
  const { lang } = useLanguage()
  const tickets = useTicketStats()
  // lo que recuerda de la última vez y la semilla de las variantes: fijos mientras dura la escena
  const [memoria] = useState(() => ({ ...(argus.memoria || {}) }))
  const [semilla] = useState(() => Math.random())
  const D = useMemo(() => dialogoArgus(lang, { gold: tickets.gold, silver: tickets.silver, resetsAt: tickets.resetsAt, tactil, memoria, semilla }), [lang, tickets.gold, tickets.silver, tickets.resetsAt, tactil, memoria, semilla])
  const [fase, setFase] = useState('entra') // entra | texto | menu | sale
  const [cola, setCola] = useState(null)   // { clave, i, despues: 'menu' | 'salir' | 'jugar', n }
  const [completo, setCompleto] = useState(false)
  const [sel, setSel] = useState(0)
  const [vistos, setVistos] = useState(() => new Set())
  const nombreRef = useRef(null)
  const firma = useGlitchSolo(nombreRef, FIRMA_GLITCH)
  const renglonesRef = useRef(0)
  const salidaRef = useRef(null)

  // Los renglones se leen del guion vivo (el conteo de dorados llega después de abrir).
  const linea = cola ? D[cola.clave]?.[cola.i] : null
  const opciones = useMemo(() => ['jugar', 'como', 'premios', 'adios'].map((id) => ({ id, label: D.opciones[id] })), [D])

  // El portal al que señala: el más cercano a Skulley.
  const portalRef = useRef(null)
  useEffect(() => {
    const p = playerRef?.current?.position
    let mejor = null
    let dMin = Infinity
    for (const o of portals || []) {
      if (!o?.position || o.antimatter) continue
      const d = p ? Math.hypot(o.position[0] - p.x, o.position[2] - p.z) : Math.hypot(o.position[0] - argus.pos.x, o.position[2] - argus.pos.z)
      if (d < dMin) { dMin = d; mejor = o }
    }
    portalRef.current = mejor ? [mejor.position[0], PORTAL_Y, mejor.position[2]] : null
  }, [playerRef, portals])

  const empezar = useCallback((clave, despues) => {
    renglonesRef.current += 1
    setCola({ clave, i: 0, despues, n: renglonesRef.current })
    setCompleto(false)
    setFase('texto')
  }, [])

  const cerrar = useCallback((despues = null) => {
    if (salidaRef.current) return
    avisarArgus({ dialogo: false })
    // sin partida, el drone regresa a lo suyo
    if (despues !== 'jugar') avisarDron({ alJuego: false })
    soltarCaminata()
    setFase('sale')
    salidaRef.current = setTimeout(() => {
      if (despues === 'jugar') onPlay?.()
      else onClose?.()
    }, quietoPreferido() ? 1 : SALIDA_MS)
  }, [onClose, onPlay])
  useEffect(() => () => clearTimeout(salidaRef.current), [])

  // Entrada: Argus voltea a verlo, Skulley camina hasta enfrente de él y, ya
  // llegado (y con las barras puestas), empieza a hablar.
  useEffect(() => {
    avisarArgus({ dialogo: true, cara: null, mirar: 'skulley' })
    const p = playerRef?.current?.position
    if (p) {
      const l = lugarFrente(p.x, p.z)
      caminarA(l.x, l.z, argus.pos.x, argus.pos.z)
    }
    let primera = true
    try { primera = !sessionStorage.getItem(VISTO); sessionStorage.setItem(VISTO, '1') } catch { }
    const t0 = performance.now()
    let raf = 0
    const espera = () => {
      const listo = !caminata.activa || caminata.llego
      if (performance.now() - t0 >= ENTRADA_MS && listo) {
        empezar(primera ? 'trato' : 'otraVez', 'menu')
        return
      }
      raf = requestAnimationFrame(espera)
    }
    raf = requestAnimationFrame(espera)
    return () => {
      cancelAnimationFrame(raf)
      // si se desmonta sin pasar por cerrar (App lo quitó), que nada se quede pegado
      avisarArgus({ dialogo: false })
      soltarCaminata()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cada renglón le pide a Argus su clip, su cara y a dónde ve.
  const lineaId = cola ? `${cola.n}` : ''
  useEffect(() => {
    if (!linea) return
    if (linea.quien === 'madre') {
      // habla ella: su cara y Argus la voltea a ver
      avisarDron({ cara: linea.cara || 'feliz', accion: 'IdleJugueton' })
      avisarArgus({ cara: 'feliz', mirar: [dron.pos.x, dron.pos.y, dron.pos.z] })
      return
    }
    const mirar = linea.mirar === 'portal' ? (portalRef.current || 'skulley') : (linea.mirar || 'skulley')
    const msg = { cara: linea.cara || null, mirar }
    if (linea.accion) msg.accion = linea.accion
    avisarArgus(msg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineaId])

  const avanzar = useCallback(() => {
    if (fase !== 'texto' || !linea) return
    if (!completo) { setCompleto(true); return }
    const lista = D[cola.clave] || []
    if (cola.i + 1 < lista.length) {
      renglonesRef.current += 1
      setCola({ ...cola, i: cola.i + 1, n: renglonesRef.current })
      setCompleto(false)
      return
    }
    if (cola.despues === 'salir' || cola.despues === 'jugar') { cerrar(cola.despues); return }
    avisarArgus({ cara: null, mirar: 'skulley' })
    setFase('menu')
  }, [fase, linea, completo, cola, cerrar, D])

  // Los renglones que cierran se pasan solos al terminar de leerse; antes del de
  // M.A.D.R.E. se espera a que el drone llegue junto a Argus.
  const avanzarRef = useRef(avanzar)
  avanzarRef.current = avanzar
  useEffect(() => {
    if (fase !== 'texto' || !completo || !cola || cola.despues === 'menu') return undefined
    const lista = D[cola.clave] || []
    const sigue = lista[cola.i + 1]
    let raf = 0
    const id = setTimeout(() => {
      if (!sigue) { cerrar(cola.despues); return }
      if (sigue.quien !== 'madre') { avanzarRef.current(); return }
      const t0 = performance.now()
      const j = juntoArgus()
      const espera = () => {
        const llego = Math.hypot(dron.pos.x - j.x, dron.pos.z - j.z) < MADRE_LLEGA.dist
        if (llego || !dron.montado || performance.now() - t0 > MADRE_LLEGA.maxMs) { avanzarRef.current(); return }
        raf = requestAnimationFrame(espera)
      }
      espera()
    }, CIERRE_SOLO_MS)
    return () => { clearTimeout(id); cancelAnimationFrame(raf) }
  }, [fase, completo, cola, D, cerrar])

  const elegir = useCallback((i) => {
    const o = opciones[i]
    if (!o) return
    try { blipArgus(1.3) } catch { }
    setSel(i)
    if (o.id === 'jugar') {
      // el drone de M.A.D.R.E. sale ya hacia Argus: llega mientras él celebra
      avisarDron({ alJuego: true })
      empezar('jugar', 'jugar')
      return
    }
    if (o.id === 'adios') {
      if (argus.memoria) argus.memoria.ultimo = 'adios'
      empezar('adios', 'salir')
      return
    }
    setVistos((v) => new Set(v).add(o.id))
    empezar(o.id, 'menu')
  }, [opciones, empezar])

  // teclado: va en captura y no deja pasar nada al juego mientras dura
  useEffect(() => {
    const tecla = (e) => {
      const k = e.key
      if (!['Escape', ' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd', 'W', 'S', 'A', 'D'].includes(k)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (k === 'Escape') { cerrar(); return }
      if (fase === 'texto' && (k === ' ' || k === 'Enter')) { avanzar(); return }
      if (fase === 'menu') {
        // el menú va en dos columnas (una en pantalla angosta): ←→ en el renglón, ↑↓ entre renglones
        const n = opciones.length
        let cols = 2
        try { if (window.matchMedia('(max-width: 700px)').matches) cols = 1 } catch { }
        const paso = ['ArrowUp', 'w', 'W'].includes(k) ? -cols
          : ['ArrowDown', 's', 'S'].includes(k) ? cols
            : ['ArrowLeft', 'a', 'A'].includes(k) ? -1
              : ['ArrowRight', 'd', 'D'].includes(k) ? 1 : 0
        if (paso) setSel((s) => (s + paso + n) % n)
        else if (k === ' ' || k === 'Enter') elegir(sel)
      }
    }
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [fase, avanzar, elegir, sel, opciones.length, cerrar])

  // La tarjeta: la que pide el renglón; si cambia, la de antes sale primero.
  const pedida = fase === 'texto' ? (linea?.muestra || null) : null
  const [muestra, setMuestra] = useState({ tipo: null, sale: false })
  useEffect(() => {
    if (pedida === muestra.tipo && !muestra.sale) return undefined
    if (!muestra.tipo) { setMuestra({ tipo: pedida, sale: false }); return undefined }
    if (!muestra.sale) setMuestra((m) => ({ ...m, sale: true }))
    const id = setTimeout(() => setMuestra({ tipo: pedida, sale: false }), MUESTRA_SALE_MS)
    return () => clearTimeout(id)
  }, [pedida, muestra.tipo, muestra.sale])

  const quieto = quietoPreferido()
  const clase = `dlg-raiz dlg-raiz--argus is-${fase}${quieto ? ' is-quieto' : ''}`
  const enojo = fase === 'texto' && linea?.cara === 'furia'
  const habla = fase === 'texto' && linea?.quien === 'madre' ? 'madre' : 'argus'
  const nombre = habla === 'madre' ? 'M.A.D.R.E.' : D.nombre
  const pregunta = vistos.size ? D.preguntaOtra : D.pregunta

  return (
    <div className={clase} role="dialog" aria-modal="true" aria-label={D.nombre} onClick={() => { if (fase === 'texto') avanzar() }}>
      <div className="dlg-barra dlg-barra--arriba">
        <button type="button" className="dlg-salir" onClick={(e) => { e.stopPropagation(); cerrar() }}>
          <span className="dlg-tecla">Esc</span>{D.saltar}
        </button>
      </div>
      <div className="dlg-barra dlg-barra--abajo" />
      {muestra.tipo && (
        <div key={muestra.tipo} className={`trato-muestra${muestra.sale ? ' is-sale' : ''}`} aria-hidden="true">
          <Muestra tipo={muestra.tipo} D={D} gold={tickets.gold} silver={tickets.silver} />
        </div>
      )}
      <div className={`dlg-globo${enojo ? ' is-enojo' : ''}`}>
        <span ref={nombreRef} className={`dlg-nombre${firma?.letras ? ' display-title--runas' : ''}${firma?.tiembla ? ' glitch-runas' : ''}`}>{textoGlitch(nombre, firma)}</span>
        {fase === 'menu' ? (
          <div className="dlg-menu">
            <RenglonRunas key={`pregunta-${renglonesRef.current}`} texto={pregunta} completo={false} className="dlg-texto--pregunta" bip={blipArgus} alBip={() => { argus.hablaUltimo = performance.now() }} />
            <ul role="listbox" aria-label={pregunta}>
              {opciones.map((o, i) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sel === i}
                    className={`dlg-opcion${vistos.has(o.id) ? ' is-visto' : ''}`}
                    onMouseEnter={() => setSel(i)}
                    onClick={(e) => { e.stopPropagation(); elegir(i) }}
                  >
                    <span className="dlg-cursor" aria-hidden="true">▶</span>
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          linea && (
            <RenglonRunas
              key={cola.n}
              texto={linea.t}
              completo={completo}
              alTerminar={() => setCompleto(true)}
              bip={habla === 'madre' ? blipMadre : blipArgus}
              alBip={habla === 'madre' ? undefined : () => { argus.hablaUltimo = performance.now() }}
            />
          )
        )}
        {fase === 'texto' && completo && <span className="dlg-sigue" aria-label={D.continuar}>▼</span>}
      </div>
    </div>
  )
}
