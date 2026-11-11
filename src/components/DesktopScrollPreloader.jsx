import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid'
import GlitchName from './GlitchName.jsx'
import useTitulosAjustados from '../hooks/useTitulosAjustados.js'
import { parrafosMadre } from '../lib/vozMadre.js'
import { irisClose, irisOpen, irisWaiting } from '../lib/irisTransition.js'
import { playSfx, preloadSfx, setSfxEnabled, unlockSfx } from '../lib/sfx.js'

// El preloader de escritorio contado con scroll (aprobado por Oscar el
// 2026-11-11; `?preloader=clasico` regresa el de antes). Es la historia de la home de
// teléfono en pantalla ancha: Skulley al centro, SKULLEY RAD de orilla a orilla
// en una línea (en dos renglones se come la cara), la voz de M.A.D.R.E. encima
// con un velo mientras gira, el rayo en una pantalla vacía y, al final, OSCAR
// MOCTEZUMA con dos puertas: la experiencia completa o la versión rápida.
//
// Mismas capas que MobileScrollHome: el color plano, el canvas del rig
// (SkulleyFallRig, el mismo del teléfono, así que también el mismo look), el
// velo, el documento que scrollea y el flash del rayo. El progreso del scroll
// va por un ref y el fondo y el velo se mueven por estilo: nada de estado de
// React por cuadro. El home se sigue precalentando detrás (PreloaderWarmRender
// corre mientras haya preloader encima).

const SkulleyFallRig = React.lazy(() => import('./mobile/SkulleyFallRig.jsx'))

const AZUL_HOME = '#022dd6'
const NOCHE = '#120a1e'
const IRIS_AZUL_OSCURO = [1, 29, 138] // #011d8a, el del Entrar de siempre
// Cuánto oscurece el velo mientras se lee (el mismo del teléfono).
const VELO = 0.7
// En qué parte del tramo quieto del final entran el nombre y las puertas, y
// por debajo de cuál se van otra vez si subes.
const PIE_ENTRA = 0.9
const PIE_SALE = 0.8
const TITULO_EN_RUNAS_MS = 900
// Cuánto después de aparecer el nombre del final llega su primer glitch:
// lo que tarda en entrar (.dsp-final, 500–600 ms) y un respiro.
const GLITCH_FINAL_MS = 900

const clamp01 = (v) => Math.min(1, Math.max(0, v))
function mixHex(a, b, t) {
  const pa = a.replace('#', ''), pb = b.replace('#', '')
  const out = [0, 2, 4].map((i) => {
    const va = parseInt(pa.slice(i, i + 2), 16)
    const vb = parseInt(pb.slice(i, i + 2), 16)
    return Math.round(va + (vb - va) * t).toString(16).padStart(2, '0')
  })
  return `#${out.join('')}`
}

export default function DesktopScrollPreloader({ lang, setLang, bootAllDone, scenePreMounted, preloaderFadingOut, setAudioReady, exitToHomeLikeExitButton }) {
  const es = lang === 'es'
  const rootRef = useRef(null)
  const scrollerRef = useRef(null)
  const bgRef = useRef(null)
  const veloRef = useRef(null)
  const flashRef = useRef(null)
  const rafRef = useRef(0)
  const progressRef = useRef(0)
  // Cuándo se dibuja y pega el rayo, dónde empieza el final y el hueco de la
  // cabeza: lo mide onScroll en el DOM y lo lee el rig.
  const timingRef = useRef({ hit: null, draw: null })
  const parrafos = parrafosMadre(lang)

  // Cuántas veces ha entrado el final: la llave del nombre de ahí (ver abajo).
  // Cambia solo al cruzar la entrada del final, no en cada cuadro.
  const [vecesFinal, setVecesFinal] = useState(0)
  const enFinalRef = useRef(false)

  // También mide de nuevo el nombre del final cada vez que se vuelve a montar.
  useTitulosAjustados(scrollerRef, [lang, vecesFinal])

  // El trueno del rayo solo suena si se pidió: la rueda del mouse no cuenta
  // como permiso del navegador para sonar, así que hace falta un clic.
  const [conSonido, setConSonido] = useState(false)
  useEffect(() => {
    setSfxEnabled(false)
    try { preloadSfx(['thunder.mp3']) } catch { }
  }, [])
  const alternarSonido = useCallback(() => {
    setConSonido((v) => {
      const nuevo = !v
      if (nuevo) {
        unlockSfx()
        try { window.dispatchEvent(new CustomEvent('audio-unlock')) } catch { }
      } else {
        setSfxEnabled(false)
      }
      return nuevo
    })
  }, [])

  const onStrike = useCallback(() => {
    const el = flashRef.current
    if (!el) return
    el.classList.remove('is-on')
    void el.offsetWidth
    el.classList.add('is-on')
  }, [])

  const onScroll = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const el = scrollerRef.current
      if (!el) return
      const max = Math.max(1, el.scrollHeight - el.clientHeight)
      const st = el.scrollTop
      const H = el.clientHeight
      progressRef.current = clamp01(st / max)

      let color = NOCHE
      const historia = el.querySelector('[data-beat="historia"]')
      const pausa = el.querySelector('[data-beat="pausa"]')
      const fin = el.querySelector('.dsp-fin')
      const pie = el.querySelector('.dsp-final')
      if (historia && pausa) {
        const T1 = historia.offsetTop
        const T3 = pausa.offsetTop
        // El rayo empieza a dibujarse cuando el último texto deja la pantalla
        // y pega cuando la pantalla vacía la llena: nada lo tapa.
        const empiezaRayo = T3 - 0.35 * H
        timingRef.current.hit = Math.min(0.9, T3 / max)
        timingRef.current.draw = Math.max(0, empiezaRayo / max)
        if (fin) timingRef.current.fin = fin.offsetTop / max
        // El hueco de la cabeza en el final: entre el nombre y las puertas.
        const arriba = el.querySelector('.dsp-final-arriba')
        const abajo = el.querySelector('.dsp-puertas')
        if (arriba && abajo && pie && pie.clientHeight) {
          timingRef.current.huecoFinal = {
            arriba: (arriba.offsetTop + arriba.offsetHeight) / pie.clientHeight,
            abajo: abajo.offsetTop / pie.clientHeight,
          }
        }
        if (fin && pie) {
          const enFin = (st - fin.offsetTop) / Math.max(1, max - fin.offsetTop)
          if (enFin >= PIE_ENTRA) {
            pie.classList.add('is-visible')
            rootRef.current?.classList.add('is-final')
            if (!enFinalRef.current) { enFinalRef.current = true; setVecesFinal((n) => n + 1) }
          } else if (enFin < PIE_SALE) {
            pie.classList.remove('is-visible')
            rootRef.current?.classList.remove('is-final')
            enFinalRef.current = false
          }
        }
        // Del azul del home a la noche mientras se lee, como si oscureciera
        // para la tormenta.
        if (st < empiezaRayo) {
          const u = clamp01(st / Math.max(1, empiezaRayo))
          color = mixHex(AZUL_HOME, NOCHE, u * u * (3 - 2 * u))
        }
        const entra = clamp01((st - (T1 - 0.8 * H)) / (0.5 * H))
        const sale = clamp01((st - (T3 - 0.65 * H)) / (0.3 * H))
        if (veloRef.current) veloRef.current.style.opacity = String(VELO * entra * (1 - sale))
      }
      if (bgRef.current) bgRef.current.style.backgroundColor = color
    })
  }, [])

  useEffect(() => {
    onScroll()
    // El teclado (flechas, espacio, AvPág) también lleva la historia.
    try { scrollerRef.current?.focus({ preventScroll: true }) } catch { }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [onScroll])

  // El aviso del principio baja a la pantalla que sigue, centrada.
  const bajarUno = useCallback(() => {
    const el = scrollerRef.current
    const siguiente = el?.querySelector('[data-beat="historia"]')
    if (!el || !siguiente) return
    let quieto = false
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { }
    el.scrollTo({ top: siguiente.offsetTop, behavior: quieto ? 'auto' : 'smooth' })
  }, [])

  // ── Entrar a la experiencia ──────────────────────────────────────────────
  // El mismo de siempre (PreloaderContent): con sonido, el iris se cierra, el
  // home se monta detrás y se abre donde cae el personaje. En el final se
  // cierra sobre la cabeza, que queda en el hueco entre el nombre y las
  // puertas; antes, sobre la cara de Skulley, al centro.
  const [saliendo, setSaliendo] = useState(false)
  const readyRef = useRef(false)
  readyRef.current = Boolean(bootAllDone && scenePreMounted)
  const entrar = useCallback(async () => {
    if (saliendo) return
    setSaliendo(true)
    try { unlockSfx() } catch { }
    try { setAudioReady(true) } catch { }
    try { playSfx('click', { volume: 0.6 }) } catch { }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const W = window.innerWidth
    const H = window.innerHeight
    const hueco = timingRef.current.huecoFinal
    const enFinal = rootRef.current?.classList.contains('is-final')
    const foco = enFinal && hueco
      ? { x: W / 2, y: H * (hueco.arriba + hueco.abajo) / 2, r: H * (hueco.abajo - hueco.arriba) * 0.45 }
      : { x: W / 2, y: H * 0.5, r: H * 0.3 }
    await irisClose({ ...foco, color: IRIS_AZUL_OSCURO })
    const t0 = performance.now()
    while (!readyRef.current && performance.now() - t0 < 4000) {
      if (performance.now() - t0 > 300) irisWaiting(true)
      await wait(50)
    }
    try { exitToHomeLikeExitButton('preloader') } catch { }
    await wait(260)
    irisOpen({ x: window.innerWidth / 2, y: window.innerHeight * 0.55 })
  }, [saliendo, setAudioReady, exitToHomeLikeExitButton])

  // ── La versión rápida ────────────────────────────────────────────────────
  // Por ahora es la versión de teléfono tal cual, arrancando en la primera
  // sección: esta persona ya vio el rayo aquí (MobileApp, `?corta=1`).
  const versionRapida = useCallback(() => {
    try { playSfx('click', { volume: 0.6 }) } catch { }
    const url = new URL(window.location.href)
    url.searchParams.delete('preloader')
    url.searchParams.set('mobile', '1')
    url.searchParams.set('corta', '1')
    window.location.assign(url.toString())
  }, [])

  return (
    <div
      ref={rootRef}
      className={`msh-root dsp-root z-[20000] ${preloaderFadingOut ? 'pointer-events-none' : ''} ${saliendo ? 'is-saliendo' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Skulley Rad"
      style={{ opacity: preloaderFadingOut ? 0 : 1, transition: 'opacity 600ms ease' }}
    >
      <div ref={bgRef} className="msh-bg" style={{ backgroundColor: AZUL_HOME }} />

      <React.Suspense fallback={null}>
        <div className="msh-stage">
          <SkulleyFallRig progressRef={progressRef} timingRef={timingRef} onStrike={onStrike} />
        </div>
      </React.Suspense>

      <div ref={veloRef} className="msh-velo" aria-hidden="true" />

      <div ref={scrollerRef} className="msh-scroller modal-scroll dsp-scroller" onScroll={onScroll} tabIndex={-1}>
        <section data-beat="hero" className="msh-beat msh-beat--hero dsp-hero">
          <GlitchName
            as="h1"
            className="msh-title dsp-titulo"
            runesUntil={TITULO_EN_RUNAS_MS}
            data-texto="SKULLEY RAD"
            data-texto-glitch={'OSCAR MOCTE█UMA\nOSCAR MOCTEZUMA'}
          />
          <p className="msh-sub dsp-sub">{es ? 'El último diseñador de la humanidad' : 'The last designer of humankind'}</p>
          <button type="button" className="msh-scroll-hint dsp-hint" onClick={bajarUno}>
            <span className="msh-scroll-hint__flechas" aria-hidden="true">
              {[0, 1, 2].map((i) => <ChevronDownIcon key={i} style={{ '--i': i }} />)}
            </span>
            {es ? 'Baja para leer' : 'Scroll to read'}
          </button>
        </section>

        <section data-beat="historia" className="msh-beat msh-beat--story">
          <div className="msh-copy dsp-copy"><p>{parrafos[0]}</p></div>
        </section>
        <section data-beat="historia2" className="msh-beat msh-beat--story">
          <div className="msh-copy dsp-copy"><p>{parrafos[1]}</p></div>
        </section>

        {/* Una pantalla sin texto: aquí baja el rayo y se parte. */}
        <section data-beat="pausa" className="msh-beat msh-beat--pausa" aria-hidden="true" />

        {/* El final se queda quieto (sticky) mientras la cabeza termina de
            caer; arriba el nombre, abajo las puertas, y en medio el hueco que
            el rig usa para la cabeza (timingRef.huecoFinal). */}
        <div className="dsp-fin">
          <div className="dsp-final">
            {/* El mismo nombre de la llegada, con su glitch: se vuelve a montar
                cada vez que entra el final, para que el primer glitch (la
                revelación de OSCAR MOCTEZUMA) llegue poco después de verse. */}
            <div className="dsp-final-arriba">
              <GlitchName
                key={vecesFinal}
                as="h2"
                className="msh-title dsp-titulo dsp-titulo-final"
                glitchAfter={GLITCH_FINAL_MS}
                data-texto="SKULLEY RAD"
                data-texto-glitch={'OSCAR MOCTE█UMA\nOSCAR MOCTEZUMA'}
              />
            </div>
            <div className="dsp-puertas">
              <button type="button" className="shop-btn shop-btn--primary msh-btn dsp-puerta" onClick={entrar} disabled={saliendo}>
                {es ? 'Entrar a la experiencia' : 'Enter the experience'}
              </button>
              <button type="button" className="shop-btn msh-btn msh-btn--vidrio dsp-puerta" onClick={versionRapida} disabled={saliendo}>
                {es ? 'Ver la versión rápida' : 'See the quick version'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Siempre a la mano: el sonido y Entrar. Entrar se va cuando aparecen
          las puertas del final. */}
      <div className="dsp-arriba">
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
        {bootAllDone && (
          <button type="button" className="shop-btn shop-btn--primary h-12 px-8 text-sm dsp-entrar" onClick={entrar} disabled={saliendo}>
            {es ? 'Entrar' : 'Enter'}
          </button>
        )}
      </div>

      <div className="dsp-idioma inline-flex h-11 p-1 rounded-full border-2 border-white/20" role="group" aria-label={es ? 'Cambiar idioma' : 'Switch language'}>
        {['en', 'es'].map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            className={`h-full min-w-[3.25rem] px-4 rounded-full text-xs font-bold uppercase tracking-[0.16em] inline-flex items-center justify-center transition-colors ${lang === code ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
          >{code.toUpperCase()}</button>
        ))}
      </div>

      <div ref={flashRef} className="msh-flash" aria-hidden="true" />
    </div>
  )
}
