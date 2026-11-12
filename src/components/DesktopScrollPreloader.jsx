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
import { playFocoPrende, playFocoApaga } from '../lib/focoSound.js'
import { NUMERITO } from '../lib/numeritoCabeza.js'

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
// La entrada de la historia es de teatro (Oscar): se apagan las luces y queda
// Skulley a oscuras con su rim (APAGA_MS), un rato así, y en FOCO_MS se prende
// un foco desde arriba con el parpadeo de una lámpara que arranca (FOCO_PARPADEO:
// [ms después de prenderse, intensidad]). La cámara empieza a moverse cuando
// se prende. `AMBIENTE_OSCURO`: lo que queda de las luces; casi nada, para que
// el cuerpo no sea un hoyo negro sino rojo muy oscuro.
const APAGA_MS = 450
const FOCO_MS = 1600
const FOCO_PARPADEO = [[0, 1], [60, 0.25], [130, 1], [200, 0.55], [260, 1]]
const AMBIENTE_OSCURO = 0.05
// Cuánto después de prenderse el foco entra la esfera que le tumba la cabeza
// a Skulley (el numerito, lib/numeritoCabeza.js): primero el silencio del
// foco, luego el chiste.
const NUMERITO_MS = 900
const OSCURO = '#040208'
// Cuándo sale el primer subtítulo (con el foco ya prendido) y cuánto dura cada
// uno: lo que se tarda en leerse, con un respiro entre uno y otro.
const SUB_PRIMERA_MS = 2700
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
// Los planos de la historia, como si hubiera varias cámaras (Oscar): cada uno
// se mueve todo el rato de `desde` a `hasta`. Entra con `corte` (a negro,
// CORTE_SALE_MS + CORTE_ENTRA_MS) o `suave` (sigue desde donde se quedó el
// anterior). g: giro en radianes, z: zoom (1 = cuerpo entero), c: qué tanto
// sube a la cara (de PAN_CARA), x: paneo de lado, p: ángulo (positivo, desde
// arriba; negativo, contrapicado). El primero empieza con el foco y es abierto,
// para todo el numerito de Skulley (la cámara lo sigue cuando camina, en el
// rig); casi no gira porque Skulley se aleja del centro y el giro lo barría.
// Los demás caen después del numerito, al empezar un subtítulo y nunca a menos
// de MIN_PLANO_MS del anterior; si no caben todos (las voces de cada idioma
// duran distinto), se quedan los de menor `prioridad`. Antes iban amarrados a
// renglones fijos y, con el numerito largo, se empalmaban: un plano de 0.35 s
// y cortes a negro a media escena (Oscar: "están rotas").
const PITCH_BASE = (16 * Math.PI / 180) * 0.4
const TOMAS = [
  { prioridad: 0, entra: 'suave', desde: { g: 0, z: 1, c: 0, x: 0, p: PITCH_BASE }, hasta: { g: 0.05, z: 1.06, c: 0.05, x: 0, p: 0.13 } },
  { prioridad: 4, entra: 'corte', desde: { g: 0.95, z: 1.4, c: 0.32, x: 0.04, p: -0.05 }, hasta: { g: 0.55, z: 1.6, c: 0.4, x: 0.02, p: -0.02 } },
  { prioridad: 2, entra: 'corte', desde: { g: 0.18, z: 3.1, c: 1, x: 0, p: 0.1 }, hasta: { g: -0.06, z: 3.6, c: 1, x: 0, p: 0.07 } },
  { prioridad: 3, entra: 'corte', desde: { g: -0.35, z: 1.15, c: 0.05, x: 0, p: 0.52 }, hasta: { g: 0.35, z: 1.3, c: 0.12, x: 0, p: 0.44 } },
  { prioridad: 5, entra: 'suave', hasta: { g: 1.3, z: 2.1, c: 0.65, x: 0.03, p: 0.05 } },
  { prioridad: 1, entra: 'corte', desde: { g: -0.25, z: 1.75, c: 0.42, x: 0, p: 0.09 }, hasta: { g: 0, z: 1, c: 0, x: 0, p: 0.13 } },
]
const MIN_PLANO_MS = 2500
const CORTE_SALE_MS = 150
const CORTE_ENTRA_MS = 260

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

const suaveSeno = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t)
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
  const lineas = []
  let t = inicio
  lineasMadre(lang).flat().forEach((texto, n) => {
    const voz = vocesPlan[n] || null
    const dura = voz
      ? Math.max(VOZ_MIN_MS, (voz.duration / VOZ_LIGERA.velocidad) * 1000 + VOZ_COLA_MS)
      : SUB_BASE_MS + texto.length * SUB_POR_LETRA_MS
    lineas.push({ texto, desde: t, hasta: t + dura, voz })
    t += dura + SUB_HUECO_MS
  })
  const total = t - SUB_HUECO_MS + COLA_MS
  // Cada plano empieza en el hueco antes de su línea; el primero, con el foco.
  const arranque = Math.max(0, inicio - SUB_PRIMERA_MS) + FOCO_MS
  // El primer corte, en cuanto acaba el numerito (arranca a reloj desde el
  // clic, no con la voz); los demás, al empezar un subtítulo.
  const huecos = [FOCO_MS + NUMERITO_MS + NUMERITO.fin * 1000 + 400]
  for (const l of lineas) {
    const c = l.desde - SUB_HUECO_MS / 2
    if (c >= huecos[huecos.length - 1] + MIN_PLANO_MS && c <= total - MIN_PLANO_MS * 0.6) huecos.push(c)
  }
  const resto = TOMAS.slice(1)
  const quedan = new Set([...resto].sort((a, b) => a.prioridad - b.prioridad).slice(0, huecos.length))
  const elegidos = resto.filter((toma) => quedan.has(toma))
  // El primer elegido entra al acabar el numerito y los demás en los últimos
  // huecos: así el abierto final siempre cierra la historia.
  const inicios = [huecos[0], ...huecos.slice(1).slice(-(elegidos.length - 1) || huecos.length)]
  const planos = [
    { ...TOMAS[0], inicio: arranque },
    ...elegidos.map((toma, i) => ({ ...toma, inicio: inicios[i] })),
  ]
  planos.forEach((plano, k) => {
    plano.fin = k + 1 < planos.length ? planos[k + 1].inicio : total
    if (k > 0 && plano.entra === 'suave') plano.desde = planos[k - 1].hasta
  })
  return { lineas, planos, total }
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

  // ── Las luces de la historia ─────────────────────────────────────────────
  // El rig lee `escenaRef` por cuadro (LucesEscena). Cada pista es una lista de
  // [ms, valor] que se recorre en línea recta; la que no viene se queda igual.
  const escenaRef = useRef({ ambiente: 1, foco: 0 })
  const corteRef = useRef(null)
  const focoSonidoRef = useRef(0)
  const numeritoTimersRef = useRef([])
  const escenaRafRef = useRef(0)
  const animarEscena = useCallback((pistas) => {
    cancelAnimationFrame(escenaRafRef.current)
    const t0 = performance.now()
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
      const t = performance.now() - t0
      for (const [k, pista] of Object.entries(pistas)) escenaRef.current[k] = valor(pista, t)
      if (t < fin) escenaRafRef.current = requestAnimationFrame(paso)
    }
    paso()
  }, [])
  useEffect(() => () => {
    cancelAnimationFrame(escenaRafRef.current)
    window.clearTimeout(focoSonidoRef.current)
    numeritoTimersRef.current.forEach(window.clearTimeout)
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
    // Se apagan las luces y, a oscuras, se prende el foco. Con menos movimiento
    // el foco entra con un fundido, sin parpadear.
    const parpadeo = movimientoReducido()
      ? [[FOCO_MS, 0], [FOCO_MS + 400, 1]]
      : [[FOCO_MS - 1, 0], ...FOCO_PARPADEO.map(([t, v]) => [FOCO_MS + t, v])]
    animarEscena({
      ambiente: [[0, escenaRef.current.ambiente], [APAGA_MS, AMBIENTE_OSCURO]],
      foco: [[0, 0], ...parpadeo],
    })
    window.clearTimeout(focoSonidoRef.current)
    focoSonidoRef.current = window.setTimeout(() => {
      playFocoPrende(movimientoReducido() ? [[0, 0.3], [400, 1]] : FOCO_PARPADEO)
    }, FOCO_MS)
    // El numerito (sus sonidos salen de él mismo, lib/numeritoCabeza.js).
    numeritoTimersRef.current.forEach(window.clearTimeout)
    const empieza = FOCO_MS + NUMERITO_MS
    numeritoTimersRef.current = [
      window.setTimeout(() => { escenaRef.current.cabeza = performance.now() }, empieza),
    ]
    Object.assign(poseRef.current, { activo: true, alRegresar: null, giro: 0, vel: 0, zoom: 1, panX: 0, panY: 0, arriba: BARRA, abajo: BARRA })
    cambiarFase('historia')
  }, [lang, cambiarFase, encenderSonido, animarEscena])

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
    // El foco se apaga y regresan las luces mientras la cámara vuelve.
    const { ambiente, foco } = escenaRef.current
    window.clearTimeout(focoSonidoRef.current)
    numeritoTimersRef.current.forEach(window.clearTimeout)
    escenaRef.current.cabeza = null
    if (foco > 0.05) playFocoApaga()
    pz.pitch = undefined
    animarEscena({
      foco: [[0, foco], [500, 0]],
      ambiente: [[0, ambiente], [300, ambiente], [1400, 1]],
    })
    cambiarFase('regreso')
  }, [cambiarFase, animarEscena])

  useEffect(() => {
    if (fase !== 'historia') return undefined
    const pz = poseRef.current
    const quieta = movimientoReducido()
    const t0 = clicRef.current
    let raf = 0
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
      // Hasta que llegan los audios (o el tope), la cámara se queda abriéndose.
      const plan = planRef.current
      if (!plan) { raf = requestAnimationFrame(tick); return }
      // En desarrollo, `window.__historiaT = 23000` congela la historia en ese
      // milisegundo (para revisar los planos).
      const t = import.meta.env.DEV && window.__historiaT != null ? window.__historiaT : performance.now() - t0
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
        pz.panY = (a.c + (b.c - a.c) * u) * PAN_CARA
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
      if (corteRef.current) corteRef.current.style.opacity = '0'
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
  const fondo = fase === 'historia' ? OSCURO : fase === 'saliendo' ? NOCHE : AZUL_HOME

  return (
    <div
      ref={rootRef}
      className={`msh-root dsp-root z-[20000] is-${fase} ${preloaderFadingOut ? 'pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Skulley Rad"
      style={{ opacity: preloaderFadingOut ? 0 : 1, transition: 'opacity 600ms ease' }}
    >
      {/* El azul del home; a oscuras en la historia (se apaga junto con las
          luces) y de noche antes del rayo. */}
      <div className="msh-bg" style={{ backgroundColor: fondo }} />

      <React.Suspense fallback={null}>
        <div className="msh-stage">
          <SkulleyFallRig progressRef={progressRef} timingRef={timingRef} onStrike={onStrike} personalizaRef={poseRef} escenaRef={escenaRef} />
        </div>
      </React.Suspense>

      <div ref={corteRef} className="dsp-corte" aria-hidden="true" />
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
