import { useCallback, useEffect, useRef, useState } from 'react'
import { playSfx, setSfxEnabled, unlockSfx } from '../lib/sfx.js'
import { playFocoPrende, playFocoApaga } from '../lib/focoSound.js'
import { lineasMadre } from '../lib/vozMadre.js'
import {
  AMBIENTE_OSCURO, APAGA_MS, CORTE_ENTRA_MS, CORTE_SALE_MS, FOCO_MS, FOCO_PARPADEO, NUMERITO_MS,
  SUB_PRIMERA_MS, SUB_SALE_MS, TOMAS, VOZ_ESPERA_MS, armarHistoria, bufferDeVoz, clamp01,
  contextoVoz, contextoVozActual, esperar, fuenteDeVoz, movimientoReducido, panCara, pedirVoces, suaveSeno,
} from '../lib/historiaMadre.js'

// "Conocer la historia" (lib/historiaMadre.js) sobre el rig de Skulley
// (SkulleyFallRig): las luces y el numerito por `escenaRef`, la cámara por
// `poseRef` (su personalizador: giro, zoom, paneo, ángulo y cortes), los
// subtítulos y la voz. Lo usan el preloader de escritorio y la primera
// pantalla del teléfono, cada uno con sus barras y sus planos.
//
// - `barra`: alto de cada barra de cine, en fracción de la pantalla; el rig
//   centra a Skulley en lo que queda entre las dos.
// - `tomas`: los planos (TOMAS o TOMAS_TELEFONO).
// - `zoomMin`: lo más que puede alejarse la cámara (el teléfono abre el plano
//   del numerito con zoom menor que 1).
// - `sigueX`: cuánto sigue la cámara a Skulley cuando camina en el numerito.
// - `alRegresar`: cuando la cámara ya regresó al primer plano.
//
// fase: inicio → historia → regreso → inicio. Quien la usa puede poner otras
// (el preloader: 'saliendo') con `cambiarFase`.
export default function useHistoriaMadre({ lang, poseRef, barra, tomas = TOMAS, zoomMin = 1, sigueX = 0.5, alRegresar }) {
  const [fase, setFase] = useState('inicio')
  const faseRef = useRef('inicio')
  const cambiarFase = useCallback((f) => { faseRef.current = f; setFase(f) }, [])
  // Cuántas veces se ha regresado al inicio (el preloader la usa de llave del
  // título, para que se vuelva a glitchear).
  const [vueltas, setVueltas] = useState(0)
  const [linea, setLinea] = useState(null)
  const alRegresarRef = useRef(alRegresar)
  alRegresarRef.current = alRegresar

  // El sonido: la historia lo enciende, es para oírse. La bocina también calla
  // la voz.
  const [conSonido, setConSonido] = useState(false)
  const salidaVozRef = useRef(null)
  const encenderSonido = useCallback(() => {
    unlockSfx()
    try { window.dispatchEvent(new CustomEvent('audio-unlock')) } catch { }
    setConSonido(true)
  }, [])
  const alternarSonido = useCallback(() => {
    if (conSonido) {
      setSfxEnabled(false)
      setConSonido(false)
    } else {
      encenderSonido()
    }
  }, [conSonido, encenderSonido])
  useEffect(() => {
    const g = salidaVozRef.current
    const ctx = contextoVozActual()
    if (g && ctx) g.gain.setTargetAtTime(conSonido ? 1 : 0, ctx.currentTime, 0.04)
  }, [conSonido])

  // ── Las luces ────────────────────────────────────────────────────────────
  // El rig lee `escenaRef` por cuadro (LucesEscena). Cada pista es una lista de
  // [ms, valor] que se recorre en línea recta; la que no viene se queda igual.
  const escenaRef = useRef({ ambiente: 1, foco: 0, sigueX })
  escenaRef.current.sigueX = sigueX
  const corteRef = useRef(null)
  const escenaRafRef = useRef(0)
  // La animación de luces en curso: su `t0` se recorre si la historia se pausa.
  const escenaAnimRef = useRef(null)
  const animarEscena = useCallback((pistas) => {
    cancelAnimationFrame(escenaRafRef.current)
    const anim = { t0: performance.now() }
    escenaAnimRef.current = anim
    const valor = (pista, t) => {
      if (t <= pista[0][0]) return pista[0][1]
      for (let i = 1; i < pista.length; i++) {
        const [tb, vb] = pista[i]
        if (t < tb) {
          const [ta, va] = pista[i - 1]
          return va + (vb - va) * ((t - ta) / Math.max(1, tb - ta))
        }
      }
      return pista[pista.length - 1][1]
    }
    const fin = Math.max(...Object.values(pistas).map((p) => p[p.length - 1][0]))
    const paso = () => {
      const t = (escenaRef.current.pausa ?? performance.now()) - anim.t0
      for (const [k, pista] of Object.entries(pistas)) escenaRef.current[k] = valor(pista, t)
      if (t < fin) escenaRafRef.current = requestAnimationFrame(paso)
    }
    paso()
  }, [])
  useEffect(() => () => cancelAnimationFrame(escenaRafRef.current), [])

  // ── El reloj ─────────────────────────────────────────────────────────────
  // Lo que lleva la historia, sin el rato en que la pestaña estuvo oculta o el
  // navegador minimizado: ahí se pausa (Oscar: con el reloj de siempre, el
  // navegador dejaba de dibujar y al regresar todo pasaba amontonado y rápido).
  // `desde`: cuándo se pausó; `pausa`: lo pausado hasta ahora.
  const relojRef = useRef({ t0: 0, pausa: 0, desde: null })
  const reloj = useCallback(() => {
    const r = relojRef.current
    return (r.desde ?? performance.now()) - r.t0 - r.pausa
  }, [])

  // ── Empezar ──────────────────────────────────────────────────────────────
  const planRef = useRef(null)
  const historiaIdRef = useRef(0)
  const prepararVoz = useCallback(() => pedirVoces(lang), [lang])
  const verHistoria = useCallback(() => {
    if (faseRef.current !== 'inicio') return
    encenderSonido()
    try { playSfx('click', { volume: 0.6 }) } catch { }
    const id = ++historiaIdRef.current
    relojRef.current = { t0: performance.now(), pausa: 0, desde: null }
    planRef.current = null
    // La salida de la voz, con la bocina como volumen.
    const ctx = contextoVoz()
    if (ctx && !salidaVozRef.current) {
      salidaVozRef.current = ctx.createGain()
      salidaVozRef.current.connect(ctx.destination)
    }
    if (salidaVozRef.current) salidaVozRef.current.gain.value = 1
    const textos = lineasMadre(lang).flat()
    const tope = esperar(VOZ_ESPERA_MS).then(() => null)
    Promise.all(textos.map((_, n) => (ctx ? Promise.race([bufferDeVoz(lang, n, ctx), tope]) : null))).then((buffers) => {
      if (id !== historiaIdRef.current) return
      const listo = reloj()
      planRef.current = armarHistoria(lang, buffers, Math.max(SUB_PRIMERA_MS, listo + 250), tomas)
    })
    // Se apagan las luces y, a oscuras, se prende el foco (su sonido y la
    // entrada del numerito van con el reloj, en el tick de abajo). Con menos
    // movimiento el foco entra con un fundido, sin parpadear.
    const parpadeo = movimientoReducido()
      ? [[FOCO_MS, 0], [FOCO_MS + 400, 1]]
      : [[FOCO_MS - 1, 0], ...FOCO_PARPADEO.map(([t, v]) => [FOCO_MS + t, v])]
    animarEscena({
      ambiente: [[0, escenaRef.current.ambiente], [APAGA_MS, AMBIENTE_OSCURO]],
      foco: [[0, 0], ...parpadeo],
    })
    Object.assign(poseRef.current, { activo: true, alRegresar: null, giro: 0, vel: 0, zoom: 1, panX: 0, panY: 0, arriba: barra, abajo: barra, zoomMin })
    cambiarFase('historia')
  }, [lang, cambiarFase, encenderSonido, animarEscena, poseRef, barra, tomas, zoomMin, reloj])

  // ── Terminar ─────────────────────────────────────────────────────────────
  // Saltar, Escape o el final: la cámara regresa al primer plano (el rig la
  // acomoda de frente y deshace la mezcla) y entonces vuelve el inicio.
  const terminarHistoria = useCallback(() => {
    if (faseRef.current !== 'historia') return
    historiaIdRef.current += 1
    const pz = poseRef.current
    pz.activo = false
    pz.alRegresar = () => {
      pz.zoomMin = undefined
      setVueltas((n) => n + 1)
      cambiarFase('inicio')
      alRegresarRef.current?.()
    }
    setLinea(null)
    // El foco se apaga y regresan las luces mientras la cámara vuelve.
    const { ambiente, foco } = escenaRef.current
    escenaRef.current.cabeza = null
    if (foco > 0.05) playFocoApaga()
    pz.pitch = undefined
    animarEscena({
      foco: [[0, foco], [500, 0]],
      ambiente: [[0, ambiente], [300, ambiente], [1400, 1]],
    })
    cambiarFase('regreso')
  }, [cambiarFase, animarEscena, poseRef])

  // ── Mientras dura ────────────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== 'historia') return undefined
    const pz = poseRef.current
    const quieta = movimientoReducido()
    const cara = panCara(barra)
    let raf = 0
    let focoSonado = false
    let numeritoListo = false
    let vista = -2
    let sonada = -1
    let planoVisto = -1
    let hablando = false
    const fuentes = new Set()
    const callar = () => {
      for (const f of fuentes) { try { f.stop() } catch { } }
      fuentes.clear()
      if (hablando) { hablando = false; try { window.dispatchEvent(new CustomEvent('tts-stop')) } catch { } }
    }
    const tick = () => {
      // En desarrollo, `window.__historiaT = 23000` congela la historia en ese
      // milisegundo (para revisar los planos).
      const t = import.meta.env.DEV && window.__historiaT != null ? window.__historiaT : reloj()
      // El sonido del foco al prenderse y el numerito (sus sonidos salen de él
      // mismo, lib/numeritoCabeza.js; corre con su propia hora de arranque,
      // que se recorre si la historia se pausa).
      if (!focoSonado && t >= FOCO_MS) {
        focoSonado = true
        playFocoPrende(movimientoReducido() ? [[0, 0.3], [400, 1]] : FOCO_PARPADEO)
      }
      if (!numeritoListo && t >= FOCO_MS + NUMERITO_MS) {
        numeritoListo = true
        escenaRef.current.cabeza = performance.now() - (t - FOCO_MS - NUMERITO_MS)
      }
      // Hasta que llegan los audios (o el tope), la cámara se queda abriéndose.
      const plan = planRef.current
      if (!plan) { raf = requestAnimationFrame(tick); return }
      if (!quieta) {
        const { planos } = plan
        let k = 0
        while (k < planos.length - 1 && t >= planos[k + 1].inicio) k += 1
        const plano = planos[k]
        // Al entrar un plano con corte, la cámara salta al encuadre nuevo
        // (pz.corte) en el cuadro más negro.
        if (k !== planoVisto) {
          if (planoVisto >= 0 && plano.entra === 'corte') pz.corte = true
          // En el primer corte, Skulley regresa al centro (donde lo dejó el
          // numerito) sin que se vea: la pantalla está en negro.
          if (k === 1) escenaRef.current.cabeza = null
          planoVisto = k
        }
        const u = suaveSeno(clamp01((t - plano.inicio) / Math.max(1, plano.fin - plano.inicio)))
        const a = plano.desde
        const b = plano.hasta
        pz.giro = a.g + (b.g - a.g) * u
        // El zoom en escala logarítmica: se acerca parejo, sin acelerar al final.
        pz.zoom = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * u)
        pz.panY = (a.c + (b.c - a.c) * u) * cara
        pz.panX = a.x + (b.x - a.x) * u
        pz.pitch = a.p + (b.p - a.p) * u
        let negro = 0
        for (let q = 1; q < planos.length; q++) {
          if (planos[q].entra !== 'corte') continue
          const d = t - planos[q].inicio
          negro = Math.max(negro, d < 0 ? clamp01(1 + d / CORTE_SALE_MS) : clamp01(1 - d / CORTE_ENTRA_MS))
        }
        if (corteRef.current) corteRef.current.style.opacity = String(negro)
      }
      let i = -1
      let sale = false
      for (let j = 0; j < plan.lineas.length; j++) {
        const l = plan.lineas[j]
        if (t >= l.desde && t < l.hasta) { i = j; sale = t > l.hasta - SUB_SALE_MS; break }
      }
      const clave = i < 0 ? -1 : i * 2 + (sale ? 1 : 0)
      if (clave !== vista) {
        vista = clave
        setLinea(i < 0 ? null : { i, texto: plan.lineas[i].texto, sale })
      }
      // La voz de cada línea, al salir su subtítulo. La música, si sonara, se
      // agacha como con el lector del blog (tts-start / tts-stop).
      const ctx = contextoVozActual()
      if (i > sonada && plan.lineas[i].voz && ctx && salidaVozRef.current) {
        sonada = i
        try {
          const { source, limpiar } = fuenteDeVoz(ctx, plan.lineas[i].voz, salidaVozRef.current)
          source.onended = () => { limpiar(); fuentes.delete(source) }
          source.start()
          fuentes.add(source)
          if (!hablando) { hablando = true; window.dispatchEvent(new CustomEvent('tts-start')) }
        } catch { }
      }
      if (t >= plan.total) { callar(); terminarHistoria(); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const tecla = (e) => { if (e.key === 'Escape') terminarHistoria() }
    window.addEventListener('keydown', tecla)
    // Pestaña oculta o navegador minimizado: el reloj se detiene y la voz se
    // congela a media frase; el numerito y las luces leen la hora de la pausa
    // (`escenaRef.current.pausa`) por si el navegador siguiera dibujando. Al
    // regresar, sus horas de arranque se recorren lo que duró la pausa y todo
    // sigue donde iba.
    const visibilidad = () => {
      const r = relojRef.current
      const ctx = contextoVozActual()
      if (document.hidden) {
        if (r.desde != null) return
        r.desde = performance.now()
        escenaRef.current.pausa = r.desde
        if (ctx?.state === 'running') ctx.suspend().catch(() => { })
      } else if (r.desde != null) {
        const pausa = performance.now() - r.desde
        r.pausa += pausa
        r.desde = null
        escenaRef.current.pausa = null
        if (escenaRef.current.cabeza != null) escenaRef.current.cabeza += pausa
        if (escenaAnimRef.current) escenaAnimRef.current.t0 += pausa
        if (ctx?.state === 'suspended') ctx.resume().catch(() => { })
      }
    }
    document.addEventListener('visibilitychange', visibilidad)
    if (document.hidden) visibilidad()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', tecla)
      document.removeEventListener('visibilitychange', visibilidad)
      // Si se desmonta pausada, la voz no se queda suspendida.
      if (relojRef.current.desde != null) {
        relojRef.current.desde = null
        escenaRef.current.pausa = null
        const ctx = contextoVozActual()
        if (ctx?.state === 'suspended') ctx.resume().catch(() => { })
      }
      callar()
      if (corteRef.current) corteRef.current.style.opacity = '0'
    }
  }, [fase, terminarHistoria, poseRef, barra, reloj])

  return {
    fase, faseRef, cambiarFase, vueltas, linea, escenaRef, corteRef,
    verHistoria, terminarHistoria, prepararVoz, conSonido, encenderSonido, alternarSonido,
  }
}
