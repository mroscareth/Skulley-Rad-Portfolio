import { useCallback, useEffect, useRef, useState } from 'react'
import { playSfx, preloadSfx, setSfxEnabled, unlockSfx } from '../lib/sfx.js'
import { playFocoPrende, playFocoApaga } from '../lib/focoSound.js'
import { playRearme, prepararRearme, rearmeAdelantoMs } from '../lib/rearmeSound.js'
import { iniciarAmbiente, prepararAmbiente } from '../lib/ambienteHistoria.js'
import { VOZ_LIGERA } from '../lib/cyberVox.js'
import { lineasMadre } from '../lib/vozMadre.js'
import { NUMERITO, INSPECCION } from '../lib/numeritoCabeza.js'
import {
  AMBIENTE_OSCURO, APAGA_MS, CORTE_ENTRA_MS, CORTE_SALE_MS, DESARME, FOCO_MS, FOCO_PARPADEO, NUMERITO_MS,
  OJOS_FURIA, OJOS_MADRE_LINEA, SUB_PRIMERA_MS, SUB_SALE_MS, TOMAS, VOZ_ESPERA_MS, armarHistoria, bufferDeVoz, clamp01,
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
// - `zoomMin`: lo más que puede alejarse la cámara (el plano del numerito
//   abre con zoom menor que 1, para que se vean los pies).
// - `alRegresar`: cuando la cámara ya regresó al primer plano.
//
// fase: inicio → historia → regreso → inicio. Quien la usa puede poner otras
// (el preloader: 'saliendo') con `cambiarFase`.
export default function useHistoriaMadre({ lang, poseRef, barra, tomas = TOMAS, zoomMin = 1, alRegresar, sonidoInicial = false }) {
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
  // la voz. `sonidoInicial`: llegando de una experiencia que sonaba.
  const [conSonido, setConSonido] = useState(sonidoInicial)
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
  const escenaRef = useRef({ ambiente: 1, foco: 0 })
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

  // ── La pausa ─────────────────────────────────────────────────────────────
  // El botón de pausa (Oscar) y la pestaña oculta paran lo mismo: el reloj, la
  // voz a media frase, el numerito, las luces y las animaciones del rig (todo
  // lee `escenaRef.current.pausa`). Al seguir, las horas de arranque se
  // recorren lo que duró y todo sigue donde iba.
  const [pausada, setPausada] = useState(false)
  const pausadaRef = useRef(false)
  const aplicarPausa = useCallback(() => {
    const r = relojRef.current
    const ctx = contextoVozActual()
    if (faseRef.current === 'historia' && (document.hidden || pausadaRef.current)) {
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
  }, [])
  const ponerPausada = useCallback((v) => {
    pausadaRef.current = v
    setPausada(v)
    aplicarPausa()
  }, [aplicarPausa])
  const alternarPausa = useCallback(() => {
    if (faseRef.current !== 'historia') return
    ponerPausada(!pausadaRef.current)
  }, [ponerPausada])

  // ── Empezar ──────────────────────────────────────────────────────────────
  const planRef = useRef(null)
  const historiaIdRef = useRef(0)
  const prepararVoz = useCallback(() => { pedirVoces(lang); prepararAmbiente(); prepararRearme() }, [lang])
  // La entrada de teatro: se apagan las luces y, a oscuras, se prende el foco
  // (su sonido y la entrada del numerito van con el reloj, en el tick de
  // abajo); la película se va a blanco y negro (`bn`, PeliculaBN del rig). Con
  // menos movimiento el foco entra con un fundido, sin parpadear. También la
  // usa el salto a un momento de la entrada.
  const pistasEntrada = useCallback((ambiente0 = 1, bn0 = 0) => {
    const parpadeo = movimientoReducido()
      ? [[FOCO_MS, 0], [FOCO_MS + 400, 1]]
      : [[FOCO_MS - 1, 0], ...FOCO_PARPADEO.map(([t, v]) => [FOCO_MS + t, v])]
    return {
      ambiente: [[0, ambiente0], [APAGA_MS, AMBIENTE_OSCURO]],
      foco: [[0, 0], ...parpadeo],
      bn: [[0, bn0], [APAGA_MS + 900, 1]],
    }
  }, [])
  // El fondo (notas al revés y vacío, lib/ambienteHistoria.js): en el contexto
  // de la voz y por su salida, así la pausa lo congela y la bocina lo calla.
  const ambienteRef = useRef(null)
  useEffect(() => () => { ambienteRef.current?.detener(); ambienteRef.current = null }, [])
  const verHistoria = useCallback(() => {
    if (faseRef.current !== 'inicio') return
    encenderSonido()
    try { playSfx('click', { volume: 0.6 }) } catch { }
    // El trueno del rayo de M.A.D.R.E. (en el teléfono no estaba cargado).
    try { preloadSfx(['thunder.mp3']) } catch { }
    const id = ++historiaIdRef.current
    relojRef.current = { t0: performance.now(), pausa: 0, desde: null }
    pausadaRef.current = false
    setPausada(false)
    planRef.current = null
    // La salida de la voz, con la bocina como volumen.
    const ctx = contextoVoz()
    if (ctx && !salidaVozRef.current) {
      salidaVozRef.current = ctx.createGain()
      salidaVozRef.current.connect(ctx.destination)
    }
    if (salidaVozRef.current) salidaVozRef.current.gain.value = 1
    // El fondo arranca con las luces apagadas.
    ambienteRef.current?.detener()
    ambienteRef.current = ctx && salidaVozRef.current ? iniciarAmbiente(ctx, salidaVozRef.current) : null
    // La esfera verde de la mano se encoge mientras dura y se le pueden picar
    // los ojos (el rig lee las dos).
    escenaRef.current.sinEsfera = true
    escenaRef.current.enHistoria = true
    const textos = lineasMadre(lang).flat()
    const tope = esperar(VOZ_ESPERA_MS).then(() => null)
    Promise.all(textos.map((_, n) => (ctx ? Promise.race([bufferDeVoz(lang, n, ctx), tope]) : null))).then((buffers) => {
      if (id !== historiaIdRef.current) return
      const listo = reloj()
      planRef.current = armarHistoria(lang, buffers, Math.max(SUB_PRIMERA_MS, listo + 250), tomas)
      // Cada historia nueva (y cada plan, que cambia con el idioma) estrena lo
      // que graban los ojos del rig para repetirse igual al regresar.
      escenaRef.current.historiaId = (escenaRef.current.historiaId || 0) + 1
      // En desarrollo, el plan a la mano (tiempos de líneas, planos y el rayo).
      if (import.meta.env.DEV) { window.__historiaPlan = planRef.current; window.__escena = escenaRef.current; window.__pose = poseRef.current }
    })
    animarEscena(pistasEntrada(escenaRef.current.ambiente, escenaRef.current.bn || 0))
    Object.assign(poseRef.current, { activo: true, alRegresar: null, giro: 0, vel: 0, zoom: 1, panX: 0, panY: 0, arriba: barra, abajo: barra, zoomMin })
    cambiarFase('historia')
  }, [lang, cambiarFase, encenderSonido, animarEscena, poseRef, barra, tomas, zoomMin, reloj, pistasEntrada])

  // ── Adelantar y regresar ─────────────────────────────────────────────────
  // Oscar: que se pueda mover como un video. `irA(ms)` lo pide y el tick lo
  // aplica (ahí viven la voz, el numerito y la cámara); con `voz: false` (al
  // arrastrar la barra) se ve pero no habla, y al soltar se pide con voz.
  // `progreso()`: dónde va y cuánto dura, para la barra.
  const saltoRef = useRef(null)
  const irA = useCallback((ms, { voz = true } = {}) => {
    const plan = planRef.current
    if (faseRef.current !== 'historia' || !plan) return
    saltoRef.current = { ms: Math.max(0, Math.min(ms, plan.total - 300)), voz }
  }, [])
  const progreso = useCallback(() => {
    const plan = planRef.current
    if (faseRef.current !== 'historia' || !plan) return null
    return { t: Math.min(plan.total, saltoRef.current?.ms ?? reloj()), total: plan.total }
  }, [reloj])

  // ── Terminar ─────────────────────────────────────────────────────────────
  // Saltar, Escape o el final: la cámara regresa al primer plano (el rig la
  // acomoda de frente y deshace la mezcla) y entonces vuelve el inicio.
  const terminarHistoria = useCallback(() => {
    if (faseRef.current !== 'historia') return
    // Si estaba en pausa, primero sigue: las luces del regreso corren con el
    // reloj de siempre.
    if (pausadaRef.current) ponerPausada(false)
    historiaIdRef.current += 1
    const pz = poseRef.current
    pz.activo = false
    // Si estaba en piezas, el rig rebobina la caída solo.
    pz.desarme = null
    pz.tornado = null
    escenaRef.current.inspeccion = null
    pz.pieza = null
    pz.temblor = 0
    pz.alRegresar = () => {
      pz.zoomMin = undefined
      setVueltas((n) => n + 1)
      cambiarFase('inicio')
      alRegresarRef.current?.()
    }
    setLinea(null)
    ambienteRef.current?.detener()
    ambienteRef.current = null
    // El foco se apaga y regresan las luces mientras la cámara vuelve.
    const { ambiente, foco, bn = 0 } = escenaRef.current
    escenaRef.current.cabeza = null
    escenaRef.current.madreT = null
    escenaRef.current.furiaT = null
    escenaRef.current.sinEsfera = false
    escenaRef.current.enHistoria = false
    if (foco > 0.05) playFocoApaga()
    pz.pitch = undefined
    animarEscena({
      foco: [[0, foco], [500, 0]],
      ambiente: [[0, ambiente], [300, ambiente], [1400, 1]],
      bn: [[0, bn], [300, bn], [1400, 0]],
    })
    cambiarFase('regreso')
  }, [cambiarFase, animarEscena, poseRef, ponerPausada])

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
    let rearmeSonado = false
    let hablando = false
    const fuentes = new Set()
    const callar = () => {
      for (const f of fuentes) { try { f.stop() } catch { } }
      fuentes.clear()
      if (hablando) { hablando = false; try { window.dispatchEvent(new CustomEvent('tts-stop')) } catch { } }
    }
    // El salto (irA): el reloj se pone en `ms` y todo lo que lleva su propio
    // tiempo se acomoda a él. La voz que iba se calla y, si cae a media línea,
    // esa línea sigue desde donde va; el numerito y las luces de la entrada se
    // ponen en su hora (con la historia en pausa, contra la hora de la pausa);
    // la cámara salta al plano de ese momento y el subtítulo se vuelve a poner.
    // El rayo y los ojos ya van con el reloj.
    const aplicarSalto = ({ ms, voz }) => {
      const plan = planRef.current
      const r = relojRef.current
      r.t0 = (r.desde ?? performance.now()) - r.pausa - ms
      const ahora = escenaRef.current.pausa ?? performance.now()
      for (const f of fuentes) { try { f.stop() } catch { } }
      fuentes.clear()
      sonada = -1
      while (sonada + 1 < plan.lineas.length && plan.lineas[sonada + 1].vozDesde <= ms) sonada++
      const l = plan.lineas[sonada]
      const ctx = contextoVozActual()
      if (voz && l?.voz && ctx && salidaVozRef.current && ms < l.hasta) {
        try {
          const { source, limpiar } = fuenteDeVoz(ctx, l.voz, salidaVozRef.current)
          source.onended = () => { limpiar(); fuentes.delete(source) }
          source.start(0, Math.max(0, ((ms - l.vozDesde) / 1000) * VOZ_LIGERA.velocidad))
          fuentes.add(source)
          if (!hablando) { hablando = true; window.dispatchEvent(new CustomEvent('tts-start')) }
        } catch { }
      }
      const tn = ms - FOCO_MS - NUMERITO_MS
      const primerCorte = plan.planos.find((p, k) => k > 0)?.inicio ?? Infinity
      focoSonado = ms >= FOCO_MS
      numeritoListo = tn >= 0
      escenaRef.current.cabeza = tn >= 0 && ms < primerCorte ? ahora - tn : null
      if (ms >= FOCO_MS + 400) {
        cancelAnimationFrame(escenaRafRef.current)
        escenaAnimRef.current = null
        Object.assign(escenaRef.current, { ambiente: AMBIENTE_OSCURO, foco: 1, bn: 1 })
      } else {
        animarEscena(pistasEntrada())
        if (escenaAnimRef.current) escenaAnimRef.current.t0 = ahora - ms
      }
      planoVisto = -1
      pz.corte = true
      pz.saltoEn = performance.now()
      escenaRef.current.luzSalta = performance.now() + 200
      vista = -2
      rearmeSonado = plan.desarme ? ms >= plan.desarme.fin - rearmeAdelantoMs() : false
    }
    const tick = () => {
      if (saltoRef.current && planRef.current) {
        const salto = saltoRef.current
        saltoRef.current = null
        aplicarSalto(salto)
      }
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
      // El rayo de M.A.D.R.E. (DESARME): el rig parte a Skulley y lo rearma
      // con lo que diga `pz.desarme`; el trueno sale del rayo y el rearmado
      // suena con "Como sea". Con menos movimiento no hay rayo.
      const d = plan.desarme
      if (d && !quieta) {
        let des = null
        if (t >= d.dibuja && t < d.rayo) des = { fase: 'rayo', s: (t - d.dibuja) / (d.rayo - d.dibuja) }
        else if (t >= d.rayo && t < d.rearma) des = { fase: 'caida', s: (t - d.rayo - DESARME.golpe) / DESARME.caida, golpeS: (t - d.rayo) / 1000 }
        else if (t >= d.rearma && t < d.rearma + DESARME.rearme) des = { fase: 'rearme', s: Math.pow((t - d.rearma) / DESARME.rearme, 1.4) }
        pz.desarme = des
        // El tornado del rearmado: de que empieza a rearmarse a que queda armado.
        pz.tornado = t >= d.rearma && t < d.fin ? (t - d.rearma) / (d.fin - d.rearma) : null
        // Y ya armado se revisa las manos (el rig lo cuenta desde aquí).
        escenaRef.current.inspeccion = t >= d.fin && t < d.fin + INSPECCION.dura * 1000
          ? (escenaRef.current.pausa ?? performance.now()) - (t - d.fin)
          : null
        // El rearmado suena al revés: crece desde antes y su corte cae cuando
        // Skulley queda armado (d.fin).
        if (!rearmeSonado && t >= d.fin - rearmeAdelantoMs() && t < d.fin) { rearmeSonado = true; playRearme(d.fin - t) }
        // El coraje: mientras dice la frase la cámara tiembla cada vez más y
        // el golpe la sacude.
        const l = plan.lineas[DESARME.linea]
        let temblor = 0
        if (t >= l.desde && t < d.rayo) temblor = DESARME.temblor[0] + (DESARME.temblor[1] - DESARME.temblor[0]) * clamp01((t - l.desde) / Math.max(1, d.rayo - l.desde))
        else if (t >= d.rayo) temblor = DESARME.temblorGolpe * Math.exp(-(t - d.rayo) / DESARME.temblorGolpeMs)
        pz.temblor = temblor > 0.01 ? temblor : 0
      }
      // Los ojos de M.A.D.R.E. en lo oscuro: el rig los abre con su línea y se
      // quedan hasta que acaba el acercamiento a la cabeza (Oscar), apagándose
      // justo antes del primer corte; con el acercamiento se desenfocan.
      const lo = plan.lineas[OJOS_MADRE_LINEA]
      const primerCorte = plan.planos.find((p, k) => k > 0)?.inicio
      const hastaOjos = lo ? Math.max(lo.hasta, (primerCorte ?? lo.hasta) - CORTE_SALE_MS) : 0
      const enOjos = lo && t >= lo.desde && t < hastaOjos
      escenaRef.current.madreT = enOjos ? t - lo.desde : null
      escenaRef.current.madreDura = enOjos ? hastaOjos - lo.desde : 0
      // Los rojos de la furia: con la frase enojada y el rayo (sin rayo, nada).
      const lf = plan.lineas[DESARME.linea]
      const furiaDesde = lf && d && !quieta ? lf.desde + OJOS_FURIA.desde : null
      const furiaHasta = furiaDesde != null ? d.rayo + OJOS_FURIA.despues : 0
      const enFuria = furiaDesde != null && t >= furiaDesde && t < furiaHasta
      escenaRef.current.furiaT = enFuria ? t - furiaDesde : null
      escenaRef.current.furiaDura = enFuria ? furiaHasta - furiaDesde : 0
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
        // Los close-ups del rayo encuadran una pieza (el rig la busca).
        pz.pieza = plano.pieza || null
        pz.giro = a.g + (b.g - a.g) * u
        // El zoom en escala logarítmica: se acerca parejo, sin acelerar al final.
        pz.zoom = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * u)
        pz.panY = (a.c + (b.c - a.c) * u) * cara
        pz.panX = a.x + (b.x - a.x) * u
        pz.pitch = a.p + (b.p - a.p) * u
        // Cuando Skulley se pone la cabeza, el plano abierto se acerca a ella
        // (Oscar) y se queda ahí para el remate: voltea, se confunde y se la
        // endereza. Va con el reloj del numerito, no con el del plano.
        if (plano.cabeza) {
          const tn = (t - FOCO_MS - NUMERITO_MS) / 1000
          const w = suaveSeno(clamp01((tn - NUMERITO.puesta + 0.3) / (NUMERITO.deFrente - NUMERITO.puesta + 0.3)))
          if (w > 0) {
            const c = plano.cabeza
            pz.zoom = Math.exp(Math.log(pz.zoom) + (Math.log(c.z) - Math.log(pz.zoom)) * w)
            pz.panY += (c.c * cara - pz.panY) * w
            pz.pitch += (c.p - pz.pitch) * w
          }
        }
        // `tapado`: lo negro de después del corte, cuando ya cambió la escena.
        // Ahí el foco salta a donde va (LucesEscena) y no se ve deslizarse.
        let negro = 0
        let tapado = 0
        for (let q = 1; q < planos.length; q++) {
          if (planos[q].entra !== 'corte') continue
          const d = t - planos[q].inicio
          negro = Math.max(negro, d < 0 ? clamp01(1 + d / CORTE_SALE_MS) : clamp01(1 - d / CORTE_ENTRA_MS))
          if (d >= 0) tapado = Math.max(tapado, clamp01(1 - d / CORTE_ENTRA_MS))
        }
        if (corteRef.current) corteRef.current.style.opacity = String(negro)
        escenaRef.current.tapado = tapado
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
        // La frase del rayo va en rojo: el enojo de M.A.D.R.E. (Oscar).
        setLinea(i < 0 ? null : { i, texto: plan.lineas[i].texto, sale, enojo: Boolean(plan.desarme) && i === DESARME.linea })
      }
      // La voz de cada línea arranca un poco antes que su subtítulo
      // (`vozDesde`): primero crece su reverb al revés y la palabra entra con
      // el subtítulo. Una línea que ya pasó (al regresar de una pausa larga)
      // no suena. La música, si sonara, se agacha como con el lector del blog
      // (tts-start / tts-stop).
      const ctx = contextoVozActual()
      while (sonada + 1 < plan.lineas.length && t >= plan.lineas[sonada + 1].vozDesde) {
        sonada++
        const l = plan.lineas[sonada]
        if (!l.voz || !ctx || !salidaVozRef.current || t >= l.hasta) continue
        try {
          const { source, limpiar } = fuenteDeVoz(ctx, l.voz, salidaVozRef.current)
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
    // Escape la termina; la barra espaciadora (o K, como en los reproductores)
    // la pausa, salvo encima de un botón, que ya responde a la barra.
    const tecla = (e) => {
      if (e.key === 'Escape') { terminarHistoria(); return }
      // Las flechas adelantan y regresan 5 s, como en los reproductores.
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target?.closest?.('input, textarea, select')) {
        const p = progreso()
        if (p) { e.preventDefault(); irA(p.t + (e.key === 'ArrowRight' ? 5000 : -5000)) }
        return
      }
      if ((e.key === ' ' || e.key === 'k' || e.key === 'K') && !e.target?.closest?.('button, a, input, textarea, select')) {
        e.preventDefault()
        alternarPausa()
      }
    }
    window.addEventListener('keydown', tecla)
    // Pestaña oculta o navegador minimizado: la misma pausa que el botón (antes,
    // al regresar, todo pasaba amontonado y rápido).
    const visibilidad = aplicarPausa
    document.addEventListener('visibilitychange', visibilidad)
    if (document.hidden) visibilidad()
    return () => {
      cancelAnimationFrame(raf)
      pz.desarme = null
      pz.tornado = null
      escenaRef.current.inspeccion = null
      pz.pieza = null
        pz.temblor = 0
      escenaRef.current.madreT = null
      escenaRef.current.furiaT = null
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
      escenaRef.current.tapado = 0
    }
  }, [fase, terminarHistoria, poseRef, barra, reloj, aplicarPausa, alternarPausa, animarEscena, pistasEntrada, irA, progreso])

  return {
    fase, faseRef, cambiarFase, vueltas, linea, escenaRef, corteRef,
    verHistoria, terminarHistoria, prepararVoz, conSonido, encenderSonido, alternarSonido,
    pausada, alternarPausa, irA, progreso,
  }
}
