import React, { useCallback, useEffect, useRef, useState } from 'react'
import RenglonRunas from './drone/RenglonRunas.jsx'
import GlitchName, { finDeRunas } from './GlitchName.jsx'
import useTitulosAjustados from '../hooks/useTitulosAjustados.js'
import { blipMadre } from '../lib/blipMadre.js'
import { useGlitchSolo, textoGlitch } from '../hooks/useGlitchRunas.js'
import { caminarA, caminata, soltarCaminata } from '../lib/caminataAuto.js'
import { siesta } from '../lib/siestaSkulley.js'
import { dron } from '../lib/droneNpc.js'
import {
  cine, toma, dronHaz, marcarFinalVisto, finalVisto, GUION_FINAL, TOMAS, RAIZ, CAMA_YAW, ARRANCA,
  MADRE_HABLA, MADRE_PORTAL, MADRE_SE_VA, MADRE_ESPERA, PORTAL, CABEZA,
} from '../lib/cinematicaOfrenda.js'

// la música se va al empezar (Oscar: con Skulley acostándose no debe sonar nada) y regresa con el título
const musica = (on, segundos) => {
  try { window.dispatchEvent(new CustomEvent('musica-silencio', { detail: { on, segundos } })) } catch { }
}

// La cinemática del final de la ofrenda (Oscar, 2026-11-26; qué pasa y quién hace qué en
// lib/cinematicaOfrenda.js). Aquí van la línea de tiempo, las barras de cine (las del diálogo de M.A.D.R.E.,
// `.dlg-*`), sus renglones (llegan en runas con su bip y se pasan solos; un clic, Espacio o Enter los
// adelanta), el título del final y Saltar (Esc). App la monta cuando se pone la última ofrenda.
// `onPortal`: el rayo ya pegó en el portal (App abre la sección 6, que lo prende). `onFin`: ya se fue todo.

const TITULO_RUNAS_MS = 250
// los destellos del rayo que se deja caer ella (ms desde el primero)
const RAYO_FINAL = [0, 150, 320, 560, 820]
const TITULO_DURA_MS = 6200
const quietoPreferido = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}
// lo que se queda un renglón ya escrito: lo que se tarda en leerlo
const lectura = (t) => Math.min(6500, 1500 + t.split(/\s+/).length * 300)

export default function CinematicaOfrenda({ lang = 'es', onPortal, onFin }) {
  const G = GUION_FINAL[lang === 'en' ? 'en' : 'es']
  const [fase, setFase] = useState('entra')      // entra | texto | pausa | titulo | sale
  const [linea, setLinea] = useState(null)       // { t, n }
  const [completo, setCompleto] = useState(false)
  const [titulo, setTitulo] = useState(false)
  const nombreRef = useRef(null)
  const firma = useGlitchSolo(nombreRef, { primeraMs: 1400, cadaMs: 4200, sostieneMs: 1300 })
  const tituloRef = useRef(null)
  useTitulosAjustados(tituloRef, [titulo, lang], { tope: 0.16 })

  const vivo = useRef(true)
  const avanzarRef = useRef(null)     // el clic: completa el renglón o lo pasa
  const terminoRef = useRef(null)     // RenglonRunas avisa que ya se escribió
  const portalRef = useRef(false)
  const finRef = useRef(false)
  const nRef = useRef(0)
  const calladaRef = useRef(false)
  // la primera vez no se salta (Oscar, 2026-11-26); ya vista, Saltar y Esc la terminan
  const [saltable] = useState(() => finalVisto())
  const regresaMusica = (segundos) => {
    if (!calladaRef.current) return
    calladaRef.current = false
    musica(false, segundos)
  }

  const esperar = (ms) => new Promise((ok) => {
    const t0 = performance.now()
    const id = setInterval(() => { if (!vivo.current || performance.now() - t0 >= ms) { clearInterval(id); ok() } }, 50)
  })
  const esperarQue = (cond, tope) => new Promise((ok) => {
    const t0 = performance.now()
    const id = setInterval(() => {
      let listo = false
      try { listo = cond() } catch { listo = true }
      if (!vivo.current || listo || performance.now() - t0 >= tope) { clearInterval(id); ok() }
    }, 100)
  })
  // un renglón: se escribe (un clic lo completa), se queda lo que se tarda en leerse (un clic lo pasa)
  const decir = (t) => new Promise((ok) => {
    nRef.current += 1
    setLinea({ t, n: nRef.current })
    setCompleto(false)
    setFase('texto')
    let escrito = false
    let id = 0
    const pasa = () => { clearTimeout(id); avanzarRef.current = null; terminoRef.current = null; ok() }
    const yaEscrito = () => {
      if (escrito) return
      escrito = true
      setCompleto(true)
      avanzarRef.current = pasa
      id = setTimeout(pasa, lectura(t))
    }
    terminoRef.current = yaEscrito
    avanzarRef.current = () => yaEscrito()
  })

  const abrirPortal = useCallback(() => {
    if (portalRef.current) return
    portalRef.current = true
    try { onPortal?.() } catch { }
  }, [onPortal])

  const terminar = useCallback(() => {
    if (finRef.current) return
    finRef.current = true
    vivo.current = false
    abrirPortal()
    marcarFinalVisto()
    regresaMusica(2)
    soltarCaminata()
    cine.dron = null
    cine.cam = null
    cine.dormir = null
    cine.aplasta = 0
    cine.activo = false
    cine.fase = 'nada'
    setFase('sale')
    setTimeout(() => { cine.despertar = true }, 900)
    setTimeout(() => onFin?.(), quietoPreferido() ? 50 : 1100)
  }, [abrirPortal, onFin])

  // la línea de tiempo
  useEffect(() => {
    vivo.current = true
    cine.activo = true
    cine.fase = 'camina'
    cine.dron = null
    cine.aplasta = 0
    calladaRef.current = true
    musica(true, 1.6)
    const correr = async () => {
      // 1. camina a la cama y se acuesta con la cabeza en la almohada; en el corte de la primera toma aparece a
      // unos pasos de ella, venga de donde venga
      toma(TOMAS.abre)
      cine.salta = { x: ARRANCA.x, z: ARRANCA.z }
      caminarA(RAIZ.x, RAIZ.z, RAIZ.x, RAIZ.z + 5)
      // ella espera fuera de cuadro, detrás de las cámaras, para llegar volando en la toma de arriba: aparece
      // ahí en el corte de la primera toma (volando hasta ahí se veía cruzar antes de su turno; Oscar)
      dronHaz({ pos: MADRE_ESPERA, salta: MADRE_ESPERA, mira: 'skulley', cara: 'feliz', vel: 7 })
      await esperar(400)
      await esperarQue(() => caminata.llego, 5000)
      if (!vivo.current) return
      soltarCaminata()
      cine.fase = 'duerme'
      cine.dormir = { yaw: CAMA_YAW, x: RAIZ.x, z: RAIZ.z }
      toma(TOMAS.duerme)
      await esperarQue(() => siesta.estado === 'dormido', 6000)
      // la almohada se aplasta con el cráneo
      const t0 = performance.now()
      await esperarQue(() => { cine.aplasta = Math.min(1, (performance.now() - t0) / 350); return cine.aplasta >= 1 }, 1000)
      if (!vivo.current) return
      // 2. M.A.D.R.E. llega y lo tapa (su rutina de la siesta): desde arriba la vemos llegar volando y, cuando
      // suelta la cobija, close up a él tapándose
      cine.fase = 'cobija'
      toma(TOMAS.llega)
      // la suelta: con él dormido, su rutina de la siesta lo tapa
      cine.dron = null
      // (la de la vez anterior puede seguir tirada o yéndose: esa no cuenta)
      await esperarQue(() => ['aparece', 'cae', 'puesta'].includes(siesta.cobija.fase), 12000)
      if (!vivo.current) return
      toma(TOMAS.tapa)
      await esperarQue(() => siesta.cobija.fase === 'puesta', 16000)
      await esperar(2200)
      if (!vivo.current) return
      // 3. el soliloquio, sobre su cabeza, con close ups a ella y a él
      cine.fase = 'soliloquio'
      // ve su cabeza (en la almohada): su raíz le queda justo abajo y de ahí salía de perfil
      const aLaCabeza = [CABEZA.x, CABEZA.y, CABEZA.z]
      dronHaz({ pos: MADRE_HABLA, mira: aLaCabeza, ojos: [0, -0.7], cara: 'feliz', vel: 2.2 })
      await esperar(1800)
      // la toma cambia solo si el renglón trae otra: pedir la misma otra vez la cortaba a su inicio y la
      // cámara brincaba entre renglones seguidos de ella (Oscar, 2026-11-26)
      let tomaVa = null
      for (const l of G.soliloquio) {
        if (!vivo.current) return
        const t = l.toma || 'dos'
        if (t !== tomaVa) { tomaVa = t; toma(TOMAS[t] || TOMAS.dos) }
        dronHaz({ mira: aLaCabeza, ojos: l.toma === 'madre' ? [0, -0.5] : [0, -0.75], cara: l.cara })
        await decir(l.t)
      }
      if (!vivo.current) return
      // 4. al portal: se deja caer un rayo encima y lo prende
      cine.fase = 'portal'
      setFase('pausa')
      toma(TOMAS.portal)
      dronHaz({ pos: MADRE_PORTAL, mira: 'camara', ojos: [0, 0], cara: 'normal', vel: 3.2 })
      await esperarQue(() => Math.hypot(dron.pos.x - MADRE_PORTAL[0], dron.pos.z - MADRE_PORTAL[2]) < 0.6, 7000)
      await esperar(700)
      if (!vivo.current) return
      dronHaz({ mira: 'camara', cara: 'feliz', accion: 'Invocar' })
      await esperar(1150)
      if (!vivo.current) return
      // cinco destellos con un solo trueno, como el que le cae a Argus (`repite` no vuelve a tronar); uno solo
      // duraba un cuarto de segundo y no se alcanzaba a ver (Oscar)
      RAYO_FINAL.forEach((ms, k) => setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent('madre-castigo-strike', { detail: { x: PORTAL.x, y: 0, z: PORTAL.z, y0: MADRE_PORTAL[1], blanco: 'madre', repite: k > 0 } }))
          if (k === 0 || k === 3) window.dispatchEvent(new CustomEvent('bolt-strike', { detail: { at: performance.now() } }))
        } catch { }
      }, ms))
      await esperar(330)
      if (!vivo.current) return
      // le pega: el portal prende y ella se queda achicharrada un par de segundos
      abrirPortal()
      dronHaz({ quema: 2.6 })
      try {
        window.dispatchEvent(new CustomEvent('estallido-piso', { detail: { x: PORTAL.x, z: PORTAL.z, color: '#ff7a1a', orb: 1.1, radio: 3.4 } }))
        window.dispatchEvent(new CustomEvent('camera-temblor', { detail: { fuerza: 1.4 } }))
      } catch { }
      await esperar(700)
      if (!vivo.current) return
      cine.fase = 'achicharrada'
      toma(TOMAS.despide)
      await esperar(3300)
      if (!vivo.current) return
      // 5. se despide, de frente
      cine.fase = 'despedida'
      dronHaz({ mira: 'camara', ojos: [0, 0], cara: 'feliz' })
      await esperar(500)
      for (const l of G.despedida) {
        if (!vivo.current) return
        dronHaz({ mira: 'camara', ojos: [0, 0], cara: l.cara })
        await decir(l.t)
      }
      if (!vivo.current) return
      // 6. se va hacia los portales, borrosa; el título
      cine.fase = 'seVa'
      setFase('pausa')
      toma(TOMAS.seVa)
      dronHaz({ pos: MADRE_SE_VA, mira: null, cara: 'feliz', vel: 5 })
      await esperar(3400)
      if (!vivo.current) return
      setTitulo(true)
      setFase('titulo')
      regresaMusica(3)
      await esperar(TITULO_DURA_MS)
      if (!vivo.current) return
      terminar()
    }
    correr()
    return () => {
      // si App la quita a media escena (salir de la home), que nada se quede pegado
      if (!finRef.current) {
        vivo.current = false
        regresaMusica(1)
        soltarCaminata()
        cine.dron = null
        cine.cam = null
        cine.dormir = null
        cine.aplasta = 0
        cine.activo = false
        cine.fase = 'nada'
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // teclado: va en captura y no deja pasar nada al juego mientras dura
  useEffect(() => {
    const tecla = (e) => {
      if (e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); return }
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.key === 'Escape') { if (saltable) terminar(); return }
      if (e.key === ' ' || e.key === 'Enter') avanzarRef.current?.()
    }
    const suelta = (e) => { e.preventDefault(); e.stopImmediatePropagation() }
    window.addEventListener('keydown', tecla, true)
    window.addEventListener('keyup', suelta, true)
    return () => {
      window.removeEventListener('keydown', tecla, true)
      window.removeEventListener('keyup', suelta, true)
    }
  }, [terminar, saltable])

  const clase = `dlg-raiz cin-raiz is-${fase === 'texto' ? 'texto' : fase === 'sale' ? 'sale' : 'entra'}${quietoPreferido() ? ' is-quieto' : ''}`
  const es = lang !== 'en'
  return (
    <div className={clase} role="dialog" aria-modal="true" aria-label="M.A.D.R.E." onClick={() => avanzarRef.current?.()}>
      <div className="dlg-barra dlg-barra--arriba">
        {saltable && (
          <button type="button" className="dlg-salir" onClick={(e) => { e.stopPropagation(); terminar() }}>
            <span className="dlg-tecla">Esc</span>{G.saltar}
          </button>
        )}
      </div>
      <div className="dlg-barra dlg-barra--abajo" />
      <div className="dlg-globo">
        <span ref={nombreRef} className={`dlg-nombre${firma?.letras ? ' display-title--runas' : ''}${firma?.tiembla ? ' glitch-runas' : ''}`}>{textoGlitch('M.A.D.R.E.', firma)}</span>
        {linea && (
          <RenglonRunas
            key={linea.n}
            texto={linea.t}
            completo={completo}
            bip={blipMadre}
            alTerminar={() => terminoRef.current?.()}
          />
        )}
      </div>
      {titulo && (
        <div ref={tituloRef} className="msh-beat--hero cin-titulo" aria-live="polite">
          <GlitchName
            as="h2"
            className="msh-title cin-titulo__nombre"
            runesUntil={TITULO_RUNAS_MS}
            glitchAfter={2200}
            descripcion="Skulley Rad"
            data-texto="SKULLEY RAD"
            data-texto-glitch={'OSCAR MOCTE█UMA\nOSCAR MOCTEZUMA'}
          />
          <p className="msh-sub cin-titulo__sub">
            <span className="dsp-sub-escribe" style={{ animationDelay: `${finDeRunas(TITULO_RUNAS_MS)}ms` }}>
              {es ? GUION_FINAL.es.titulo : GUION_FINAL.en.titulo}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
