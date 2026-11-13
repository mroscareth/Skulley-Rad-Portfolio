import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CameraIcon, ForwardIcon, PlayIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid'
import BarraHistoria from './BarraHistoria.jsx'
import { fotoDeHistoria } from '../lib/fotoHistoria.js'
import GlitchName, { finDeRunas } from './GlitchName.jsx'
import useTitulosAjustados from '../hooks/useTitulosAjustados.js'
import useHistoriaMadre from '../hooks/useHistoriaMadre.js'
import SubtituloMadre from './SubtituloMadre.jsx'
import { OSCURO, clamp01, esperar, movimientoReducido } from '../lib/historiaMadre.js'
import { irisCubrir, irisOpen, irisWaiting } from '../lib/irisTransition.js'
import { cambiarDeVersion } from '../lib/cambioDeVersion.js'
import { entrarARapida } from '../lib/versionRapida.js'
import { playSfx, preloadSfx, setSfxEnabled, unlockSfx } from '../lib/sfx.js'
import { despedirMusica, esperarSilencio, llegaConSonido, sonarLobby } from '../lib/musicaLobby.js'

// El preloader de escritorio (Oscar, 2026-11-11). Una sola pantalla: Skulley en primer plano, SKULLEY RAD de
// orilla a orilla en una línea (en dos se come la cara) y tres botones.
//
// - Conocer la historia: M.A.D.R.E. la cuenta sola, con su voz (neural,
//   pregrabada, con un filtro robot ligero) y subtítulos, con barras de cine
//   y planos de cámara alrededor de Skulley (hooks/useHistoriaMadre.js, que
//   comparte con el teléfono); al final la cámara regresa al primer plano del
//   principio, con los botones, como un loop. Saltar o Escape regresan desde
//   cualquier punto.
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
// El subtítulo se escribe ya revelado el título en letras (Oscar): la primera
// vez, al terminar las runas; de regreso de la historia, poco después.
const SUB_ENTRA_MS = finDeRunas(TITULO_EN_RUNAS_MS) + 150
const SUB_REGRESO_MS = 450

// ── La historia (lib/historiaMadre.js, hooks/useHistoriaMadre.js) ─────────
// Alto de cada barra de cine, en fracción de la pantalla (= --dsp-barra). El
// rig centra a Skulley en lo que queda entre las dos.
const BARRA = 0.11

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

// La canción del lobby (lib/musicaLobby.js, Oscar): suena en la pantalla
// principal con el sonido encendido y se baja hasta entonces. Se va con fundido
// al empezar la historia, que trae su propio fondo, y regresa al volver. Al
// picar una de las dos experiencias se va con fundido desde el clic
// (despedirMusica) y la carga ya es en silencio; la del sitio entra con
// fundido cuando se abre la experiencia (MusicPlayer). De regreso de una
// experiencia con música, la bocina llega encendida y la canción entra al
// abrirse el iris. `entra` / `sale`: s.
const LOBBY_FUNDIDO = { entra: 1.5, sale: 0.9 }
// Lo que dura el trueno del rayo (thunder.mp3): la versión simple recarga la
// página y lo cortaba; espera a que acabe, hasta `truenoEspera` ms de más.
const TRUENO_MS = 5800
const TRUENO_ESPERA_MAX_MS = 3500

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

// Lo más que espera la pantalla principal, tapada por la cortinilla de quien
// regresó a ella, a que Skulley esté antes de abrirse.
const LLEGADA_TOPE_MS = 5000

export default function DesktopScrollPreloader({ lang, setLang, bootAllDone, scenePreMounted, preloaderFadingOut, setAudioReady, exitToHomeLikeExitButton, cortinaLlegada = null }) {
  const es = lang === 'es'

  // De regreso desde una versión (Volver al inicio o atrás del navegador):
  // App la monta tapada en el color con que la otra se fue, y abre cuando el
  // rig ya midió a Skulley, como el regreso a la home desde una sección.
  const llegadaAbiertaRef = useRef(!cortinaLlegada)
  const [llegadaAbierta, setLlegadaAbierta] = useState(!cortinaLlegada)
  const abrirLlegada = useCallback(() => {
    if (llegadaAbiertaRef.current) return
    llegadaAbiertaRef.current = true
    setLlegadaAbierta(true)
    irisOpen({ x: window.innerWidth / 2, y: window.innerHeight * 0.55 })
  }, [])
  // Llegando de una experiencia que sonaba, con la bocina encendida.
  const [sonidoAlLlegar] = useState(() => Boolean(cortinaLlegada) && llegaConSonido())
  useEffect(() => {
    if (!cortinaLlegada) return undefined
    const tope = window.setTimeout(abrirLlegada, LLEGADA_TOPE_MS)
    return () => window.clearTimeout(tope)
  }, [cortinaLlegada, abrirLlegada])
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

  // La historia (hooks/useHistoriaMadre.js). fase: inicio → historia →
  // regreso → inicio, o inicio → saliendo (el rayo, abajo).
  const {
    fase, faseRef, cambiarFase, vueltas, linea, escenaRef, corteRef,
    verHistoria, terminarHistoria, prepararVoz, conSonido, alternarSonido, pausada, alternarPausa, irA, progreso,
  } = useHistoriaMadre({ lang, poseRef, barra: BARRA, zoomMin: 0.85, sonidoInicial: sonidoAlLlegar })
  const conSonidoRef = useRef(conSonido)
  conSonidoRef.current = conSonido
  // Saliendo a una versión, la canción ya se fue en `salir`. Llegando tapada,
  // espera a que se abra el iris: la carga es en silencio.
  useEffect(() => {
    if (fase === 'saliendo') return
    const suena = conSonido && fase === 'inicio' && llegadaAbierta
    sonarLobby(suena, suena ? LOBBY_FUNDIDO.entra : LOBBY_FUNDIDO.sale)
  }, [conSonido, fase, llegadaAbierta])
  useEffect(() => () => sonarLobby(false, 0.3), [])
  // La foto de la historia en PNG, para wallpaper (Oscar).
  const [fotografiando, setFotografiando] = useState(false)
  const tomarFoto = useCallback(() => {
    setFotografiando(true)
    fotoDeHistoria(poseRef, { fondo: OSCURO, t: progreso()?.t || 0 }).finally(() => setFotografiando(false))
  }, [progreso])

  useTitulosAjustados(rootRef, [lang, vueltas])
  // Los botones de abajo, a la misma distancia del borde que la tinta del
  // título de arriba (Oscar). La caja del título deja aire sobre las letras,
  // así que se mide la tinta con las métricas de la fuente, y se vuelve a medir
  // cuando el título cambia de tamaño (crece con la pantalla) o de contenido
  // (entra en runas y pasa a letras; en runas no hay texto que medir).
  useEffect(() => {
    const raiz = rootRef.current
    const titulo = raiz?.querySelector('.dsp-titulo')
    if (!raiz || !titulo) return undefined
    const ctx = document.createElement('canvas').getContext('2d')
    const medir = () => {
      // Durante el glitch (OSCAR MOCTEZUMA, en otro cuerpo) no: los botones brincarían.
      if (titulo.classList.contains('glitch-name--on')) return
      const linea = [...titulo.querySelectorAll('span')].find((e) => e.firstChild?.nodeType === 3 && /[A-Z]/.test(e.textContent) && !e.closest('.rt-runes'))
      const texto = linea?.firstChild
      if (!ctx || !texto) return
      const cs = getComputedStyle(linea)
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      const m = ctx.measureText(linea.textContent)
      const rango = document.createRange()
      rango.selectNodeContents(texto)
      const tinta = rango.getBoundingClientRect().top - raiz.getBoundingClientRect().top + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent
      if (tinta > 0) raiz.style.setProperty('--dsp-orilla', `${tinta.toFixed(1)}px`)
    }
    const ro = new ResizeObserver(medir)
    ro.observe(titulo)
    const mo = new MutationObserver(medir)
    mo.observe(titulo, { childList: true, subtree: true, characterData: true })
    document.fonts?.ready?.then(medir)
    medir()
    return () => { ro.disconnect(); mo.disconnect() }
  }, [lang, vueltas])

  // El trueno del rayo solo suena si se pidió (la bocina) o al entrar a la
  // experiencia completa, que enciende el audio del sitio como siempre.
  useEffect(() => {
    if (sonidoAlLlegar) unlockSfx()
    else setSfxEnabled(false)
    try { preloadSfx(['thunder.mp3']) } catch { }
  }, [])

  // Cuándo pegó el rayo (si sonó el trueno), para no cortarlo al recargar.
  const truenoEnRef = useRef(0)
  const onStrike = useCallback(() => {
    if (conSonidoRef.current) truenoEnRef.current = performance.now()
    const el = flashRef.current
    if (!el) return
    el.classList.remove('is-on')
    void el.offsetWidth
    el.classList.add('is-on')
  }, [])

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
    // Desde el clic, la canción del lobby se va (Oscar): la carga es en
    // silencio y la del sitio entra al abrirse la experiencia.
    despedirMusica()
    // Entrar a la completa enciende el audio del sitio (el Entrar de siempre),
    // así que el trueno ya suena; la simple solo con la bocina encendida.
    if (completa) {
      try { unlockSfx() } catch { }
      try { setAudioReady(true) } catch { }
    }
    try { playSfx('click', { volume: 0.6 }) } catch { }
    if (!movimientoReducido()) await rayo()

    if (!completa) {
      cambiarDeVersion(AZUL_RAPIDA, async () => {
        const trueno = truenoEnRef.current ? TRUENO_MS - (performance.now() - truenoEnRef.current) : 0
        await esperar(Math.min(TRUENO_ESPERA_MAX_MS, Math.max(450, trueno)))
        entrarARapida()
      })
      return
    }
    // La completa no recarga: el home ya se montó detrás. Se tapa, se espera
    // a que esté listo y se abre donde cae el personaje.
    await irisCubrir({ color: IRIS_AZUL_OSCURO })
    await esperarSilencio()
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
          <SkulleyFallRig progressRef={progressRef} timingRef={timingRef} onStrike={onStrike} personalizaRef={poseRef} escenaRef={escenaRef} onListo={abrirLlegada} miraCursor={fase === 'inicio'} picarEnInicio={fase === 'inicio'} />
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
        <p className="msh-sub dsp-sub">
          <span key={vueltas} className="dsp-sub-escribe" style={{ animationDelay: `${vueltas === 0 ? SUB_ENTRA_MS : SUB_REGRESO_MS}ms` }}>
            {es ? 'El último diseñador de la humanidad' : 'The last designer of humankind'}
          </span>
        </p>
        {/* La completa al centro y en amarillo; las otras dos, de vidrio
            líquido como las burbujas de la versión simple (Oscar). El idioma y
            el sonido, en el mismo renglón: uno en cada orilla (Oscar). */}
        <div className="dsp-botones">
          <BurbujaIdioma lang={lang} setLang={setLang} inert={!enInicio} />
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
          <span className="dsp-sonido">
            <span className="qh-burbuja-flota">
              <button
                type="button"
                className="burbuja-vidrio rounded-full grid place-items-center dsp-sonido-burbuja"
                onClick={alternarSonido}
                aria-pressed={conSonido}
                aria-label={conSonido ? (es ? 'Quitar el sonido' : 'Mute') : (es ? 'Con sonido' : 'Sound on')}
                data-tip={conSonido ? (es ? 'Quitar el sonido' : 'Mute') : (es ? 'Con sonido' : 'Sound on')}
              >
                {conSonido ? <SpeakerWaveIcon aria-hidden="true" /> : <SpeakerXMarkIcon aria-hidden="true" />}
              </button>
            </span>
          </span>
        </div>
      </div>

      {/* Los subtítulos, en la barra de abajo. El lector de pantalla lee el
          texto limpio: el visible pasa por runas y bloques. */}
      <div className="dsp-subtitulos" aria-hidden="true">
        {linea && <SubtituloMadre key={linea.i} texto={linea.texto} sale={linea.sale} enojo={linea.enojo} />}
      </div>
      <div className="sr-only" aria-live="polite">{linea?.texto || ''}</div>
      {fase === 'historia' && (
        <BarraHistoria
          progreso={progreso}
          irA={irA}
          es={es}
          pausada={pausada}
          alternarPausa={alternarPausa}
          conSonido={conSonido}
          alternarSonido={alternarSonido}
        />
      )}
      {fase === 'historia' && pausada && (
        <button type="button" className="dsp-pausa-centro" onClick={alternarPausa} aria-label={es ? 'Seguir' : 'Play'}>
          <PlayIcon aria-hidden="true" />
        </button>
      )}

      <div className="dsp-arriba">
        {fase === 'historia' && (
          <>
            <button
              type="button"
              className="h-12 w-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.08] text-white hover:bg-white/[0.15] grid place-items-center shadow-elev-lg transition-colors disabled:opacity-50"
              onClick={tomarFoto}
              disabled={fotografiando}
              aria-label={es ? 'Tomar foto (PNG para wallpaper)' : 'Take a photo (PNG wallpaper)'}
              data-tip={es ? 'Foto en PNG para wallpaper' : 'PNG wallpaper photo'}
              data-tip-side="bottom"
            >
              <CameraIcon className="w-5 h-5" aria-hidden="true" />
            </button>
            <button type="button" className="shop-btn msh-btn msh-btn--vidrio dsp-saltar" onClick={terminarHistoria}>
              {es ? 'Saltar' : 'Skip'}
              <ForwardIcon aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <div ref={flashRef} className="msh-flash" aria-hidden="true" />
    </div>
  )
}
