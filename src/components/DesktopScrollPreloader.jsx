import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ForwardIcon, PlayIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid'
import GlitchName from './GlitchName.jsx'
import useTitulosAjustados from '../hooks/useTitulosAjustados.js'
import { useGlitchRunas, textoGlitch } from '../hooks/useGlitchRunas.js'
import { lineasMadre } from '../lib/vozMadre.js'
import { irisCubrir, irisOpen, irisWaiting } from '../lib/irisTransition.js'
import { cambiarDeVersion } from '../lib/cambioDeVersion.js'
import { entrarARapida } from '../lib/versionRapida.js'
import { playSfx, preloadSfx, setSfxEnabled, unlockSfx } from '../lib/sfx.js'
import { cadenaCyberVox, VOZ_LIGERA } from '../lib/cyberVox.js'

// El preloader de escritorio (Oscar, 2026-11-11; `?preloader=clasico` regresa
// el de antes). Una sola pantalla: Skulley en primer plano, SKULLEY RAD de
// orilla a orilla en una línea (en dos se come la cara) y tres botones.
//
// - Conocer la historia: M.A.D.R.E. la cuenta sola, con su voz (neural,
//   pregrabada, con un filtro robot ligero) y subtítulos, con barras de cine y tres tomas de cámara alrededor de Skulley; al final
//   la cámara regresa al primer plano del principio, con los botones, como un
//   loop. Saltar o Escape regresan desde cualquier punto.
// - Versión simple y Experiencia completa: el rayo parte a Skulley y después
//   corre la cortinilla de puntos hacia esa experiencia.
//
// La cámara es la del personalizador del rig del teléfono (SkulleyFallRig,
// `personalizaRef`): giro, zoom y paneo, con su mezcla de entrada y su regreso
// al cerrar. El rayo es el de la historia del teléfono: el progreso va de 0 al
// impacto y a la caída por reloj. Todo por refs y rAF; React solo cambia de
// fase y de subtítulo. El home se sigue precalentando detrás
// (PreloaderWarmRender corre mientras haya preloader encima).

const SkulleyFallRig = React.lazy(() => import('./mobile/SkulleyFallRig.jsx'))

const AZUL_HOME = '#022dd6'
const NOCHE = '#120a1e'
const IRIS_AZUL_OSCURO = [1, 29, 138] // #011d8a, el del Entrar de siempre
const AZUL_RAPIDA = [2, 45, 214]
const TITULO_EN_RUNAS_MS = 900
// Al regresar de la historia el título se vuelve a montar y su primer glitch
// (la filtración de OSCAR MOCTEZUMA) llega poco después de verse.
const GLITCH_REGRESO_MS = 900

// ── La historia ───────────────────────────────────────────────────────────
// Alto de cada barra de cine, en fracción de la pantalla (= --dsp-barra). El
// rig centra a Skulley en lo que queda entre las dos.
const BARRA = 0.11
// El paneo que deja la cara al centro: el rig pone el primer plano en headY,
// 0.21 del alto del personaje arriba de su centro, y el paneo va en altos del
// cuadro con zoom 1 (Skulley llena el 90 % de lo libre).
const PAN_CARA = 0.21 * 0.9 * (1 - 2 * BARRA)
// Cuándo sale el primer subtítulo (la cámara ya se abrió) y cuánto dura cada
// uno: lo que se tarda en leerse, con un respiro entre uno y otro.
const SUB_PRIMERA_MS = 1400
const SUB_BASE_MS = 1100
const SUB_POR_LETRA_MS = 55
const SUB_HUECO_MS = 320
const SUB_SALE_MS = 280
// Cuánto se queda en runas cada subtítulo antes de glitchearse a letras.
const SUB_RUNAS_MS = 380
// Lo que sigue la última toma después del último subtítulo.
const COLA_MS = 900
// Con voz, cada subtítulo dura lo que su audio más este respiro, y nunca
// menos de VOZ_MIN_MS. Lo más que se espera a que lleguen los audios: la
// línea que no llegue se lee sin voz, con la duración de lectura.
const VOZ_COLA_MS = 300
const VOZ_MIN_MS = 1500
const VOZ_ESPERA_MS = 4000
// La cámara al empezar cada toma y al terminar la última: [giro en radianes,
// zoom, qué tanto de PAN_CARA]. 1) Un paneo lento alrededor de Skulley entero;
// 2) se acerca a la cara mientras regresa al frente; 3) se aleja girando hacia
// el otro lado. Entre una y otra la cámara se detiene, como un corte de plano.
const CAMARA = [
  [0, 1, 0],
  [0.85, 1.12, 0],
  [0.2, 2.9, 1],
  [-0.75, 1.05, 0],
]

// ── El rayo ───────────────────────────────────────────────────────────────
// Progreso de la historia del rig: se dibuja de `draw` a `hit` y pega en
// `hit`. Antes del impacto el rig abre el plano y da una vuelta completa.
const RAYO = { hit: 0.5, draw: 0.33 }
const RAYO_MS = 2000
// El golpe corre por reloj en el rig (GOLPE_S): ahí el progreso se queda en el
// impacto, y después la caída, hasta LAND (donde reposa el último hueso).
const GOLPE_MS = 300
const CAIDA_MS = 1500
const LAND = 0.93
// En qué parte de la caída arranca la cortinilla: la tapa termina justo
// cuando aterriza lo último (Oscar no quiere animaciones cortadas).
const CORTINA_EN = 0.7

const ease = (t) => t * t * (3 - 2 * t)
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const movimientoReducido = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// ── La voz ────────────────────────────────────────────────────────────────
// Un audio fijo por línea (public/voz/madre/<voz>/<idioma>-NN.mp3, en el orden
// de lineasMadre), generado una vez con motores de voz neural gratis
// (scripts/voz-madre/) y al sonar la cadena robot ligera (VOZ_LIGERA). Inglés:
// Kokoro, voz Heart. Español: Chatterbox con acento mexicano (Oscar escogió
// las dos el 2026-11-11; la voz de Google del blog no pronunciaba bien y las
// otras sonaban torpes o a español gringo). Se piden al acercarse al botón (y
// si no, al picarlo) y se guardan para la siguiente vuelta. El AudioContext se
// crea hasta el clic, que es el gesto que lo deja sonar.
const VOZ_MADRE = { es: 'chatter-mx', en: 'kokoro-heart' }
function urlVoz(lang, n) {
  return `${import.meta.env.BASE_URL}voz/madre/${VOZ_MADRE[lang] || VOZ_MADRE.es}/${lang}-${String(n + 1).padStart(2, '0')}.mp3`
}
function fuenteDeVoz(ctx, buffer, destino) {
  return cadenaCyberVox(ctx, buffer, destino, VOZ_LIGERA)
}

let ctxVoz = null
function contextoVoz() {
  if (!ctxVoz) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) { try { ctxVoz = new Ctx() } catch { } }
  }
  if (ctxVoz?.state === 'suspended') ctxVoz.resume().catch(() => { })
  return ctxVoz
}
const voces = new Map()
function pedirVoz(lang, n) {
  const k = urlVoz(lang, n)
  let v = voces.get(k)
  if (!v) {
    v = {
      bytes: fetch(k).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
      buffer: null,
    }
    voces.set(k, v)
  }
  return v
}
function bufferDeVoz(lang, n, ctx) {
  const k = urlVoz(lang, n)
  const v = pedirVoz(lang, n)
  if (!v.buffer) {
    // Si no llegó, se olvida para pedirla otra vez en la siguiente vuelta.
    v.buffer = v.bytes
      .then((b) => (b ? ctx.decodeAudioData(b.slice(0)) : null))
      .catch(() => null)
      .then((buf) => { if (!buf) voces.delete(k); return buf })
  }
  return v.buffer
}

// Las líneas de M.A.D.R.E. repartidas en las tres tomas y en el tiempo. Con
// voz, cada línea dura lo que su audio (`vocesPlan`, buffers o null).
// `inicio`: cuándo sale la primera desde el clic (más tarde si los audios
// tardaron); la cámara empieza a moverse SUB_PRIMERA_MS antes.
function armarHistoria(lang, vocesPlan = [], inicio = SUB_PRIMERA_MS) {
  const [p1, p2] = lineasMadre(lang)
  const tomas = [p1.slice(0, 3), p1.slice(3), p2]
  const lineas = []
  const cortes = [Math.max(0, inicio - SUB_PRIMERA_MS)]
  let t = inicio
  let n = 0
  for (const toma of tomas) {
    for (const texto of toma) {
      const voz = vocesPlan[n] || null
      const dura = voz
        ? Math.max(VOZ_MIN_MS, (voz.duration / VOZ_LIGERA.velocidad) * 1000 + VOZ_COLA_MS)
        : SUB_BASE_MS + texto.length * SUB_POR_LETRA_MS
      lineas.push({ texto, desde: t, hasta: t + dura, voz })
      t += dura + SUB_HUECO_MS
      n += 1
    }
    cortes.push(t - SUB_HUECO_MS / 2)
  }
  const total = t - SUB_HUECO_MS + COLA_MS
  cortes[cortes.length - 1] = total
  return { lineas, cortes, total }
}

// Cada subtítulo llega en SKULLEYGLYPH y se glitchea a letras (el glitch de
// los títulos, solo de ida).
function Subtitulo({ texto, sale }) {
  const { fase, disparar } = useGlitchRunas(true, { sonido: false, sostieneMs: 864e5 })
  useEffect(() => {
    const id = window.setTimeout(disparar, SUB_RUNAS_MS)
    return () => window.clearTimeout(id)
  }, [disparar])
  return (
    <p className={`dsp-subtitulo${fase?.letras ? '' : ' dsp-subtitulo--runas'}${fase?.tiembla ? ' glitch-runas' : ''}${sale ? ' is-sale' : ''}`}>
      {textoGlitch(texto, fase)}
    </p>
  )
}

// El idioma, como la burbuja de la versión simple: dice el idioma al que
// cambia (ENG / ESP). Al picarla revienta —se estira, desaparece y salpica
// gotas— y nace otra con el otro idioma (Oscar).
const REVIENTA_MS = 200
const RENACE_MS = 430
const GOTAS_MS = 720
// [ángulo en grados, hasta dónde llega en px, tamaño en px]
const GOTAS = [
  [8, 40, 6], [47, 33, 4], [83, 44, 7], [126, 36, 5], [161, 42, 6],
  [203, 31, 4], [238, 45, 7], [279, 35, 5], [318, 41, 6], [347, 30, 4],
]

function BurbujaIdioma({ lang, setLang, inert }) {
  const es = lang === 'es'
  const [fase, setFase] = useState('quieta') // quieta → revienta → vacia → quieta
  const [vuelta, setVuelta] = useState(0)
  const [gotas, setGotas] = useState(false)
  const timers = useRef([])
  const botonRef = useRef(null)
  const conFocoRef = useRef(false)
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  // La burbuja nueva es otro botón: si la vieja tenía el foco del teclado, lo hereda.
  useEffect(() => {
    if (vuelta && conFocoRef.current) {
      conFocoRef.current = false
      try { botonRef.current?.focus({ preventScroll: true }) } catch { }
    }
  }, [vuelta])

  const cambiar = (e) => {
    if (fase !== 'quieta') return
    const otro = es ? 'en' : 'es'
    if (movimientoReducido()) { setLang(otro); return }
    conFocoRef.current = document.activeElement === e.currentTarget
    setFase('revienta')
    setGotas(true)
    timers.current.forEach(clearTimeout)
    timers.current = [
      setTimeout(() => { setLang(otro); setFase('vacia') }, REVIENTA_MS),
      setTimeout(() => { setVuelta((v) => v + 1); setFase('quieta') }, RENACE_MS),
      setTimeout(() => setGotas(false), GOTAS_MS),
    ]
  }

  return (
    <div className="dsp-idioma" inert={inert}>
      <span className="qh-burbuja-flota">
        {fase !== 'vacia' && (
          <button
            key={vuelta}
            ref={botonRef}
            type="button"
            onClick={cambiar}
            className={`burbuja-vidrio rounded-full grid place-items-center qh-burbuja-idioma dsp-idioma-burbuja${fase === 'revienta' ? ' is-revienta' : ''}`}
            aria-label={es ? 'Cambiar a inglés' : 'Switch to Spanish'}
            data-tip={es ? 'English' : 'Español'}
          >
            {es ? 'ENG' : 'ESP'}
          </button>
        )}
        {gotas && (
          <span className="dsp-gotas" aria-hidden="true">
            <b className="dsp-onda" />
            {GOTAS.map(([a, d, s], i) => <i key={i} style={{ '--a': `${a}deg`, '--d': `${d}px`, '--s': `${s}px` }} />)}
          </span>
        )}
      </span>
    </div>
  )
}

export default function DesktopScrollPreloader({ lang, setLang, bootAllDone, scenePreMounted, preloaderFadingOut, setAudioReady, exitToHomeLikeExitButton }) {
  const es = lang === 'es'
  const rootRef = useRef(null)
  const flashRef = useRef(null)
  const botonHistoriaRef = useRef(null)
  const progressRef = useRef(0)
  const timingRef = useRef({ ...RAYO })
  const poseRef = useRef({
    activo: false, alRegresar: null, giro: 0, giroVisto: 0, vel: 0, arrastrando: false,
    zoom: 1, panX: 0, panY: 0, pellizcando: false, mezcla: 0, m: 0, arriba: BARRA, abajo: BARRA,
    cerrando: false, wall: false, wallVisto: false, marco: null, plano: null, quieto: false, captura: null,
  })

  // inicio → historia → regreso → inicio, o inicio → saliendo.
  const [fase, setFase] = useState('inicio')
  const faseRef = useRef('inicio')
  const cambiarFase = useCallback((f) => { faseRef.current = f; setFase(f) }, [])
  // Cuántas veces se ha regresado al inicio: la llave del título.
  const [vueltas, setVueltas] = useState(0)
  const [linea, setLinea] = useState(null)

  useTitulosAjustados(rootRef, [lang, vueltas])

  // El trueno del rayo solo suena si se pidió (la bocina) o al entrar a la
  // experiencia completa, que enciende el audio del sitio como siempre.
  // La historia lo enciende: es para oírse. La bocina también calla la voz.
  const [conSonido, setConSonido] = useState(false)
  const salidaVozRef = useRef(null)
  useEffect(() => {
    setSfxEnabled(false)
    try { preloadSfx(['thunder.mp3']) } catch { }
  }, [])
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
    if (g && ctxVoz) g.gain.setTargetAtTime(conSonido ? 1 : 0, ctxVoz.currentTime, 0.04)
  }, [conSonido])

  const onStrike = useCallback(() => {
    const el = flashRef.current
    if (!el) return
    el.classList.remove('is-on')
    void el.offsetWidth
    el.classList.add('is-on')
  }, [])

  // ── Conocer la historia ──────────────────────────────────────────────────
  const planRef = useRef(null)
  const clicRef = useRef(0)
  const historiaIdRef = useRef(0)
  const prepararVoz = useCallback(() => {
    lineasMadre(lang).flat().forEach((_, n) => pedirVoz(lang, n))
  }, [lang])
  const verHistoria = useCallback(() => {
    if (faseRef.current !== 'inicio') return
    encenderSonido()
    try { playSfx('click', { volume: 0.6 }) } catch { }
    const id = ++historiaIdRef.current
    clicRef.current = performance.now()
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
      const listo = performance.now() - clicRef.current
      planRef.current = armarHistoria(lang, buffers, Math.max(SUB_PRIMERA_MS, listo + 250))
    })
    Object.assign(poseRef.current, { activo: true, alRegresar: null, giro: 0, vel: 0, zoom: 1, panX: 0, panY: 0, arriba: BARRA, abajo: BARRA })
    cambiarFase('historia')
  }, [lang, cambiarFase, encenderSonido])

  // Saltar, Escape o el final: la cámara regresa al primer plano (el rig la
  // acomoda de frente y deshace la mezcla) y entonces vuelven los botones.
  const terminarHistoria = useCallback(() => {
    if (faseRef.current !== 'historia') return
    historiaIdRef.current += 1
    const pz = poseRef.current
    pz.activo = false
    pz.alRegresar = () => {
      setVueltas((n) => n + 1)
      cambiarFase('inicio')
    }
    setLinea(null)
    cambiarFase('regreso')
  }, [cambiarFase])

  useEffect(() => {
    if (fase !== 'historia') return undefined
    const pz = poseRef.current
    const quieta = movimientoReducido()
    const t0 = clicRef.current
    let raf = 0
    let vista = -2
    let sonada = -1
    let hablando = false
    const fuentes = new Set()
    const callar = () => {
      for (const f of fuentes) { try { f.stop() } catch { } }
      fuentes.clear()
      if (hablando) { hablando = false; try { window.dispatchEvent(new CustomEvent('tts-stop')) } catch { } }
    }
    const tick = () => {
      // Hasta que llegan los audios (o el tope), la cámara se queda abriéndose.
      const plan = planRef.current
      if (!plan) { raf = requestAnimationFrame(tick); return }
      const t = performance.now() - t0
      if (!quieta) {
        const { cortes } = plan
        let k = 0
        while (k < cortes.length - 2 && t >= cortes[k + 1]) k += 1
        const u = ease(clamp01((t - cortes[k]) / Math.max(1, cortes[k + 1] - cortes[k])))
        const [g0, z0, c0] = CAMARA[k]
        const [g1, z1, c1] = CAMARA[k + 1]
        pz.giro = g0 + (g1 - g0) * u
        // El zoom en escala logarítmica: se acerca parejo, sin acelerar al final.
        pz.zoom = Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * u)
        pz.panY = (c0 + (c1 - c0) * u) * PAN_CARA
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
      if (i > sonada && plan.lineas[i].voz && ctxVoz && salidaVozRef.current) {
        sonada = i
        try {
          const { source, limpiar } = fuenteDeVoz(ctxVoz, plan.lineas[i].voz, salidaVozRef.current)
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
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', tecla)
      callar()
    }
  }, [fase, terminarHistoria])

  // De regreso, el foco vuelve al botón de la historia (Saltar ya no existe).
  useEffect(() => {
    if (fase === 'inicio' && vueltas > 0) {
      try { botonHistoriaRef.current?.focus({ preventScroll: true }) } catch { }
    }
  }, [fase, vueltas])

  // ── Las experiencias: el rayo y la cortinilla ────────────────────────────
  const readyRef = useRef(false)
  readyRef.current = Boolean(bootAllDone && scenePreMounted)

  // El progreso del rig del primer plano al impacto y a la caída. Resuelve
  // cuando toca arrancar la cortinilla; la caída sigue debajo de ella.
  const rayo = useCallback(() => new Promise((resolve) => {
    const t0 = performance.now()
    const fin = RAYO_MS + GOLPE_MS + CAIDA_MS
    const corte = RAYO_MS + GOLPE_MS + CAIDA_MS * CORTINA_EN
    let avisado = false
    const tick = () => {
      const t = performance.now() - t0
      progressRef.current = t < RAYO_MS
        ? RAYO.hit * (t / RAYO_MS)
        : RAYO.hit + 1e-4 + (LAND - RAYO.hit) * clamp01((t - RAYO_MS - GOLPE_MS) / CAIDA_MS)
      if (!avisado && t >= corte) { avisado = true; resolve() }
      if (t < fin) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }), [])

  const salir = useCallback(async (destino) => {
    if (faseRef.current !== 'inicio') return
    cambiarFase('saliendo')
    const completa = destino === 'completa'
    // Entrar a la completa enciende el audio del sitio (el Entrar de siempre),
    // así que el trueno ya suena; la simple solo con la bocina encendida.
    if (completa) {
      try { unlockSfx() } catch { }
      try { setAudioReady(true) } catch { }
    }
    try { playSfx('click', { volume: 0.6 }) } catch { }
    if (!movimientoReducido()) await rayo()

    if (!completa) {
      cambiarDeVersion(AZUL_RAPIDA, () => entrarARapida(import.meta.env.BASE_URL))
      return
    }
    // La completa no recarga: el home ya se montó detrás. Se tapa, se espera
    // a que esté listo y se abre donde cae el personaje.
    await irisCubrir({ color: IRIS_AZUL_OSCURO })
    const t0 = performance.now()
    while (!readyRef.current && performance.now() - t0 < 4000) {
      if (performance.now() - t0 > 300) irisWaiting(true)
      await esperar(50)
    }
    try { exitToHomeLikeExitButton('preloader') } catch { }
    await esperar(260)
    irisOpen({ x: window.innerWidth / 2, y: window.innerHeight * 0.55 })
  }, [cambiarFase, rayo, setAudioReady, exitToHomeLikeExitButton])

  const enInicio = fase === 'inicio'
  const oscuro = fase === 'historia' || fase === 'saliendo'

  return (
    <div
      ref={rootRef}
      className={`msh-root dsp-root z-[20000] is-${fase} ${preloaderFadingOut ? 'pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Skulley Rad"
      style={{ opacity: preloaderFadingOut ? 0 : 1, transition: 'opacity 600ms ease' }}
    >
      {/* Del azul del home a la noche en la historia y antes del rayo. */}
      <div className="msh-bg" style={{ backgroundColor: oscuro ? NOCHE : AZUL_HOME }} />

      <React.Suspense fallback={null}>
        <div className="msh-stage">
          <SkulleyFallRig progressRef={progressRef} timingRef={timingRef} onStrike={onStrike} personalizaRef={poseRef} />
        </div>
      </React.Suspense>

      <div className="dsp-barra dsp-barra--arriba" aria-hidden="true" />
      <div className="dsp-barra dsp-barra--abajo" aria-hidden="true" />

      <div className="msh-beat msh-beat--hero dsp-hero dsp-inicio" inert={!enInicio}>
        <GlitchName
          key={vueltas}
          as="h1"
          className="msh-title dsp-titulo"
          runesUntil={vueltas === 0 ? TITULO_EN_RUNAS_MS : 0}
          glitchAfter={GLITCH_REGRESO_MS}
          data-texto="SKULLEY RAD"
          data-texto-glitch={'OSCAR MOCTE█UMA\nOSCAR MOCTEZUMA'}
        />
        <p className="msh-sub dsp-sub">{es ? 'El último diseñador de la humanidad' : 'The last designer of humankind'}</p>
        {/* La completa al centro y en amarillo; las otras dos, de vidrio
            líquido como las burbujas de la versión simple (Oscar). */}
        <div className="dsp-botones">
          <button ref={botonHistoriaRef} type="button" className="shop-btn msh-btn dsp-boton burbuja-vidrio" onClick={verHistoria} onPointerEnter={prepararVoz} onFocus={prepararVoz}>
            <PlayIcon aria-hidden="true" />
            {es ? 'Conocer la historia' : 'Watch the story'}
          </button>
          <button type="button" className="shop-btn shop-btn--primary msh-btn dsp-boton" onClick={() => salir('completa')}>
            {es ? 'Experiencia completa' : 'Full experience'}
          </button>
          <button type="button" className="shop-btn msh-btn dsp-boton burbuja-vidrio" onClick={() => salir('simple')}>
            {es ? 'Versión simple' : 'Simple version'}
          </button>
        </div>
      </div>

      {/* Los subtítulos, en la barra de abajo. El lector de pantalla lee el
          texto limpio: el visible pasa por runas y bloques. */}
      <div className="dsp-subtitulos" aria-hidden="true">
        {linea && <Subtitulo key={linea.i} texto={linea.texto} sale={linea.sale} />}
      </div>
      <div className="sr-only" aria-live="polite">{linea?.texto || ''}</div>

      <div className="dsp-arriba">
        {fase === 'historia' && (
          <button type="button" className="shop-btn msh-btn msh-btn--vidrio dsp-saltar" onClick={terminarHistoria}>
            {es ? 'Saltar' : 'Skip'}
            <ForwardIcon aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="h-12 w-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.08] text-white hover:bg-white/[0.15] grid place-items-center shadow-elev-lg transition-colors"
          onClick={alternarSonido}
          aria-pressed={conSonido}
          aria-label={conSonido ? (es ? 'Quitar el sonido' : 'Mute') : (es ? 'Con sonido' : 'Sound on')}
          data-tip={conSonido ? (es ? 'Quitar el sonido' : 'Mute') : (es ? 'Con sonido' : 'Sound on')}
          data-tip-side="bottom"
        >
          {conSonido ? <SpeakerWaveIcon className="w-5 h-5" aria-hidden="true" /> : <SpeakerXMarkIcon className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>

      <BurbujaIdioma lang={lang} setLang={setLang} inert={!enInicio} />

      <div ref={flashRef} className="msh-flash" aria-hidden="true" />
    </div>
  )
}
