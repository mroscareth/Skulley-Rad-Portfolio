import { useState, useRef, useEffect, useCallback, startTransition } from 'react'
import { sectionColors } from '../lib/appHelpers.js'
import { puedeViajar, viajarConTrama, terminarViaje } from '../lib/wallpaperEscritorio.js'
import { irisCubrir, irisDetras, irisOpen, irisTapar, irisWaiting } from '../lib/irisTransition.js'

const rgbDe = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// De regreso a home el iris se abre con la escena ya pintada. Si tarda, la mascota
// camina sobre el color; el tope es el del Entrar del preloader.
const fondoDe = (el) => {
  const c = el && window.getComputedStyle(el).backgroundColor.match(/[\d.]+/g)
  return c?.length === 3 ? c.map(Number) : undefined
}
const HOME_ESPERA_MS = 500
const HOME_TOPE_MS = 4000
// La barra de sección es honesta: mínimo en pantalla + espera real a que el
// chunk lazy de la sección monte (markSectionReady), con tope para redes lentas.
export const SECTION_PRELOADER_MIN_MS = 1500 // minimum display time for preloader GIF
export const SECTION_PRELOADER_MAX_EXTRA_MS = 4000 // extra máximo esperando readiness

// Consolidates the 3 alive transition flavors + their overlay state:
//  - beginSectionTransition(toId): main transition. Trama → preloader → iris.
//    Used from menu, CTA, auto-enter, section-to-section nav.
//  - beginSimpleFade(toId, opts): section swap with half-duration delay (no visual).
//    Used when player walks physically through a portal.
//  - beginRipple(toId): capture prev-scene texture, animate noise mix, swap.
//    Used from popstate (browser back/forward).
//
// The hook owns transitionState + overlay state (grid, noise, blackout, preloader)
// and exposes the 3 begin* callbacks. App.jsx passes the external state/setters
// the callbacks need to orchestrate (section, UI animation phase, scroll refs, etc.).
export default function useTransitionSystem(deps) {
  const {
    section, setSection,
    setShowSectionUi, setSectionUiAnimatingOut, setSectionUiFadeIn,
    sectionScrollRef,
    // uiAnimApi is a ref-like object filled in later in App render —
    // `uiAnimApi.current` holds { setUiAnimPhase, uiExitTimerRef, setHomeLanded }.
    // Lets us call the hook early without a TDZ on those UI state setters.
    uiAnimApi,
    glRef,
    syncUrl,
    // setFx: merges partial into the fx state — used by beginLiquidWipe to
    // animate psychoEnabled + liquidStrength + chroma offsets during transition.
    setFx,
  } = deps

  // ---- Transition gate ----
  const [transitionState, setTransitionState] = useState({ active: false, from: 'home', to: null })

  // Al montarse el home: dos cuadros después del commit ya se pintó el primero de la
  // escena, que es lo que tarda.
  const homeListoRef = useRef(null)
  useEffect(() => {
    const listo = homeListoRef.current
    if (section !== 'home' || !listo) return
    homeListoRef.current = null
    requestAnimationFrame(() => requestAnimationFrame(listo))
  }, [section])
  const [tramaViaje, setTramaViaje] = useState(false)

  const [preloaderTargetSection, setPreloaderTargetSection] = useState('section1')

  // ---- Section preloader GIF (entre la trama y el iris) ----
  const [showSectionPreloader, setShowSectionPreloader] = useState(false)
  const [sectionPreloaderFading, setSectionPreloaderFading] = useState(false)

  // ---- Readiness real de la sección destino ----
  // App monta <SectionReadySignal> dentro del mismo Suspense boundary que las
  // secciones lazy; cuando el chunk resuelve y React commitea, llama
  // markSectionReady(). El ref lo leen los timers de beginSectionTransition sin
  // re-crear el callback; el state se lo pasa App a <SectionPreloader ready>.
  const sectionReadyRef = useRef(true)
  const [sectionPreloaderReady, setSectionPreloaderReady] = useState(true)
  const markSectionReady = useCallback(() => {
    sectionReadyRef.current = true
    setSectionPreloaderReady(true)
  }, [])

  // ---- Ripple / noise-mask transition ----
  const [prevSceneTex, setPrevSceneTex] = useState(null)
  const [noiseMixEnabled, setNoiseMixEnabled] = useState(false)
  const [noiseMixProgress, setNoiseMixProgress] = useState(0)
  const rippleMixRef = useRef({ v: 0 })

  // ---- Noise overlay (A/B texture mask) — separate from noiseMix ----
  const [noiseOverlayActive, setNoiseOverlayActive] = useState(false)
  const [noisePrevTex, setNoisePrevTex] = useState(null)
  const [noiseNextTex, setNoiseNextTex] = useState(null)
  const [noiseProgress, setNoiseProgress] = useState(0)

  // ---- Blackout overlay (smooth/instant fade-to-black) ----
  const [blackoutVisible, setBlackoutVisible] = useState(false)
  const [blackoutImmediate, setBlackoutImmediate] = useState(false)

  // ---- Failsafe: never let section preloader get stuck ----
  useEffect(() => {
    if (!showSectionPreloader) return undefined
    // Por encima del camino normal (min + espera de readiness) para que solo
    // dispare si la orquestación se rompió de verdad.
    const maxMs = SECTION_PRELOADER_MIN_MS + SECTION_PRELOADER_MAX_EXTRA_MS + 2000
    const id = window.setTimeout(() => {
      try { setShowSectionPreloader(false); setSectionPreloaderFading(false) } catch { }
    }, maxMs)
    return () => { try { window.clearTimeout(id) } catch { } }
  }, [showSectionPreloader])

  // ---- Keep clearAlpha at 0 when using alpha mask (prevSceneTex == null && noiseMixEnabled) ----
  useEffect(() => {
    try {
      const gl = glRef.current
      if (!gl) return
      const useAlphaMask = noiseMixEnabled && prevSceneTex == null
      if (typeof gl.setClearAlpha === 'function') {
        gl.setClearAlpha(useAlphaMask ? 0 : 1)
      }
    } catch { }
  }, [noiseMixEnabled, prevSceneTex, glRef])

  // ---- Simple section swap with timing delay (no visual — overlay was removed) ----
  const beginSimpleFade = useCallback(async (toId, { durationMs = 600 } = {}) => {
    if (!toId || transitionState.active) return
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch { }
    try { setNoiseMixEnabled(false) } catch { }
    try { setNoiseOverlayActive(false); setNoisePrevTex(null); setNoiseNextTex(null) } catch { }
    setTransitionState({ active: true, from: section, to: toId })
    const half = Math.max(0, durationMs / 2)
    await new Promise((r) => window.setTimeout(r, half))
    try {
      if (toId !== section) {
        // Sin overlay que tape: el commit troceado evita congelar el frame en
        // que el jugador cruza el portal.
        startTransition(() => { setSection(toId) })
        const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
        const map = { section1: 'work', section2: 'about', section3: 'store', section4: 'contact' }
        const next = toId !== 'home' ? `${base}${map[toId] || toId}` : base
        if (typeof window !== 'undefined' && window.location.pathname !== next) {
          window.history.pushState({ section: toId }, '', next)
        }
      }
    } catch { }
    if (toId !== 'home') {
      setShowSectionUi(true)
      setSectionUiFadeIn(false)
      setSectionUiAnimatingOut(false)
      try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch { }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setSectionUiFadeIn(true))
        })
      })
    } else {
      setShowSectionUi(false)
      setSectionUiAnimatingOut(false)
      setSectionUiFadeIn(false)
    }
    await new Promise((r) => window.setTimeout(r, half))
    setTransitionState({ active: false, from: toId, to: null })
  }, [section, transitionState.active, setSection, setShowSectionUi, setSectionUiFadeIn, setSectionUiAnimatingOut, sectionScrollRef])

  // ---- Grid reveal: cover with grid → preloader → uncover ----
  const beginSectionTransition = useCallback(async (toId) => {
    if (!toId || transitionState.active) return
    // Saliendo de home Skulley siempre está en el portal: de ahí sale la trama. Entre
    // secciones no hay portal ni escena a la vista, y los puntos cubren en su lugar.
    const conTrama = section === 'home' && toId !== 'home' && puedeViajar()
    if (conTrama) setTramaViaje(true)
    setTransitionState({ active: true, from: section, to: toId })
    // Exit animation for UI when leaving HOME (uiAnimApi filled lazily by App)
    if (section === 'home' && uiAnimApi?.current) {
      const { setUiAnimPhase, uiExitTimerRef, setHomeLanded } = uiAnimApi.current
      try { setUiAnimPhase?.('exiting') } catch { }
      try { if (uiExitTimerRef?.current) clearTimeout(uiExitTimerRef.current) } catch { }
      try {
        if (uiExitTimerRef) uiExitTimerRef.current = setTimeout(() => { try { setUiAnimPhase?.('hidden') } catch { } }, 300)
      } catch { }
      try { setHomeLanded?.(false) } catch { }
    }
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch { }
    setPreloaderTargetSection(toId)
    const termina = () => setTransitionState({ active: false, from: toId, to: null })
    const alCubrir = () => {
      // Ya con la pantalla tapada: hacerlo al dar clic cortaba las tarjetas de Work de
      // golpe. El shader se esconde antes de regresar el scroll, que lo deformaría.
      if (section === 'section1') {
        try { document.querySelector('[data-work-shader]')?.style.setProperty('visibility', 'hidden') } catch { }
      }
      try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch { }
      const preloaderShownAt = Date.now()
      if (toId !== 'home') {
        // Barra honesta: readiness en false hasta que la sección montada
        // (via markSectionReady) lo confirme.
        sectionReadyRef.current = false
        setSectionPreloaderReady(false)
        try { setShowSectionPreloader(true); setSectionPreloaderFading(false) } catch { }
      }
      try {
        if (toId !== section) {
          // startTransition: el swap de sección desmonta media escena de home y
          // monta la sección entera. Como update urgente eso era UN commit de
          // ~2s de main thread bloqueado (el GIF del preloader se congelaba);
          // como transition, React trocea el render y el overlay sigue animando.
          // markSectionReady se dispara al commit igual — la barra lo espera.
          startTransition(() => { setSection(toId) })
          try { syncUrl(toId) } catch { }
        }
        if (toId !== 'home') {
          const startOut = () => {
            const proceed = () => {
              try { setSectionPreloaderFading(true) } catch { }
              window.setTimeout(() => {
                try { setShowSectionPreloader(false); setSectionPreloaderFading(false) } catch { }
                irisOpen({ x: window.innerWidth / 2, y: window.innerHeight / 2 }).then(termina)
              }, 350) // preloader fade-out duration
            }
            // Cierra cuando pasó el mínimo Y la sección está lista (o se agotó
            // el tope de espera — no bloquear en redes lentas).
            const checkId = window.setInterval(() => {
              const elapsed = Date.now() - preloaderShownAt
              const maxed = elapsed >= SECTION_PRELOADER_MIN_MS + SECTION_PRELOADER_MAX_EXTRA_MS
              if (elapsed >= SECTION_PRELOADER_MIN_MS && (sectionReadyRef.current || maxed)) {
                window.clearInterval(checkId)
                proceed()
              }
            }, 100)
          }
          try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch { }
          setShowSectionUi(true)
          setSectionUiFadeIn(true)
          setSectionUiAnimatingOut(false)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => startOut())
              })
            })
          })
        } else {
          setShowSectionUi(false)
          setSectionUiAnimatingOut(false)
          setSectionUiFadeIn(false)
        }
      } catch { }
    }
    if (conTrama) {
      await viajarConTrama(toId, sectionColors[toId])
      // El iris se cierra detrás del preloader, que sale opaco del mismo color que dejó
      // la trama, y al apagarse el preloader se abre sobre la sección.
      irisTapar({ color: rgbDe(sectionColors[toId]) })
      alCubrir()
      requestAnimationFrame(() => {
        terminarViaje()
        startTransition(() => { setTramaViaje(false) })
      })
    } else if (toId === 'home') {
      // De regreso, el fondo de la sección es el iris: lo de encima se deshace en puntos
      // de su color y se abre donde queda Skulley. Abrirlo antes del montaje lo dejaba
      // atorado, y lo que el home deja para el final de la transición espera a que abra.
      await irisCubrir({ color: fondoDe(sectionScrollRef.current) })
      const home = section !== 'home' && new Promise((listo) => { homeListoRef.current = listo })
      alCubrir()
      const mascota = window.setTimeout(() => irisWaiting(true), HOME_ESPERA_MS)
      await Promise.race([home, new Promise((listo) => window.setTimeout(listo, HOME_TOPE_MS))])
      window.clearTimeout(mascota)
      await irisOpen({ x: window.innerWidth / 2, y: window.innerHeight * 0.55 })
      termina()
    } else {
      // Detrás desde el inicio: la barra y el retrato se quedan encima, como en la sección.
      irisDetras()
      await irisCubrir({ color: rgbDe(sectionColors[toId]) })
      alCubrir()
    }
  }, [section, transitionState.active, setSection, setShowSectionUi, setSectionUiAnimatingOut, setSectionUiFadeIn, uiAnimApi, sectionScrollRef, syncUrl])

  // ---- Ripple: capture prev scene, noise-mix crossfade ----
  const beginRipple = useCallback(async (toId) => {
    if (!toId || transitionState.active) return
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch { }
    // Capture A (current canvas frame) — dynamic import keeps `three` off the eager bundle
    const { captureCanvasFrameAsTexture, captureCanvasFrameAsTextureGPU } = await import('../lib/sceneCapture.js')
    let tex = await captureCanvasFrameAsTextureGPU(glRef)
    if (!tex) tex = await captureCanvasFrameAsTexture(glRef)
    if (tex) setPrevSceneTex(tex)
    // Swap section (B will render under the mask)
    try {
      if (toId !== section) {
        // El ripple anima el noise-mix con gsap mientras la sección monta —
        // el commit troceado evita que el mount congele esa animación.
        startTransition(() => { setSection(toId) })
        const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
        const map = { section1: 'work', section2: 'about', section3: 'store', section4: 'contact' }
        const next = toId && toId !== 'home' ? `${base}${map[toId] || toId}` : base
        if (typeof window !== 'undefined' && window.location.pathname !== next) {
          window.history.pushState({ section: toId }, '', next)
        }
      }
      if (toId !== 'home') {
        setShowSectionUi(true)
        setSectionUiAnimatingOut(false)
        setSectionUiFadeIn(false)
      } else {
        // Reset scroll instantly when leaving a section
        try { if (sectionScrollRef.current) sectionScrollRef.current.scrollTop = 0 } catch { }
        setSectionUiFadeIn(false)
        setSectionUiAnimatingOut(true)
        setTimeout(() => { setSectionUiAnimatingOut(false) }, 300)
      }
    } catch { }
    // Animate noise mix 0 → 1
    setNoiseMixEnabled(true)
    rippleMixRef.current.v = 0
    setNoiseMixProgress(0)
    const { default: gsap } = await import('gsap')
    gsap.to(rippleMixRef.current, {
      v: 1,
      duration: 0.9,
      ease: 'sine.inOut',
      onUpdate: () => setNoiseMixProgress(rippleMixRef.current.v),
      onComplete: () => {
        setNoiseMixEnabled(false)
        setPrevSceneTex(null)
        setNoiseMixProgress(0)
        rippleMixRef.current.v = 0
        setTransitionState({ active: false, from: toId, to: null })
      },
    })
    setTransitionState({ active: true, from: section, to: toId })
  }, [section, transitionState.active, setSection, setShowSectionUi, setSectionUiAnimatingOut, setSectionUiFadeIn, sectionScrollRef, glRef])

  // ---- Liquid wipe: isolated shader transition ----
  // Drives PostFX's standalone TransitionWarp effect (fullscreen noise-driven
  // pixel displacement + dreamy magenta tint). Does NOT touch psychoEnabled or
  // any other legacy fx — just animates `transitionWarpStrength` 0 → peak → 0.
  //
  // Phase 1 (warp up, 600ms, power2.in): image dissolves into flowing liquid.
  // Peak (brief hold + 2 RAFs): section swap happens under full warp — invisible.
  // Phase 2 (warp down, 650ms, power2.out): new section solidifies from liquid.
  const beginLiquidWipe = useCallback(async (toId, opts = {}) => {
    const {
      peakStrength = 1.0,
      warpUpMs = 600,
      warpDownMs = 650,
      holdMs = 140,
    } = opts
    if (!toId || transitionState.active) return
    if (!setFx) return // no-op if App didn't wire setFx
    setTransitionState({ active: true, from: section, to: toId })
    if (section === 'section1') {
      try { document.querySelector('[data-work-shader]')?.style.setProperty('visibility', 'hidden') } catch { }
    }
    if (section === 'home' && uiAnimApi?.current) {
      const { setUiAnimPhase, uiExitTimerRef, setHomeLanded } = uiAnimApi.current
      try { setUiAnimPhase?.('exiting') } catch { }
      try { if (uiExitTimerRef?.current) clearTimeout(uiExitTimerRef.current) } catch { }
      try {
        if (uiExitTimerRef) uiExitTimerRef.current = setTimeout(() => { try { setUiAnimPhase?.('hidden') } catch { } }, 300)
      } catch { }
      try { setHomeLanded?.(false) } catch { }
    }
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch { }
    try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch { }

    const { default: gsap } = await import('gsap')
    const warpObj = { s: 0 }

    // Phase 1: warp up 0 → peak
    await new Promise((resolve) => {
      gsap.to(warpObj, {
        s: peakStrength,
        duration: warpUpMs / 1000,
        ease: 'power2.in',
        onUpdate: () => setFx((prev) => ({ ...prev, transitionWarpStrength: warpObj.s })),
        onComplete: resolve,
      })
    })

    // Peak: swap section (fully warped so the swap is invisible)
    try {
      if (toId !== section) {
        setSection(toId)
        try { syncUrl(toId) } catch { }
      }
      if (toId !== 'home') {
        setShowSectionUi(true)
        setSectionUiFadeIn(true)
        setSectionUiAnimatingOut(false)
        try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch { }
      } else {
        setShowSectionUi(false)
        setSectionUiAnimatingOut(false)
        setSectionUiFadeIn(false)
      }
    } catch { }

    // Brief hold at peak so the eye catches the dream-state; let React paint.
    await new Promise((r) => window.setTimeout(r, holdMs))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // Phase 2: warp down peak → 0
    await new Promise((resolve) => {
      gsap.to(warpObj, {
        s: 0,
        duration: warpDownMs / 1000,
        ease: 'power2.out',
        onUpdate: () => setFx((prev) => ({ ...prev, transitionWarpStrength: warpObj.s })),
        onComplete: resolve,
      })
    })

    setFx((prev) => ({ ...prev, transitionWarpStrength: 0 }))
    setTransitionState({ active: false, from: toId, to: null })
  }, [section, transitionState.active, setSection, setShowSectionUi, setSectionUiAnimatingOut, setSectionUiFadeIn, uiAnimApi, sectionScrollRef, syncUrl, setFx])

  return {
    // gate state
    transitionState,
    setTransitionState, // for external panic reset / handoffs

    // begin callbacks
    beginSectionTransition,
    beginSimpleFade,
    beginRipple,
    beginLiquidWipe,

    preloaderTargetSection, setPreloaderTargetSection,
    tramaViaje,

    // preloader render state
    showSectionPreloader, setShowSectionPreloader,
    sectionPreloaderFading, setSectionPreloaderFading,
    sectionPreloaderReady, markSectionReady,

    // ripple / noise-mix state (read by Canvas and overlays)
    prevSceneTex, setPrevSceneTex,
    noiseMixEnabled, setNoiseMixEnabled,
    noiseMixProgress, setNoiseMixProgress,
    rippleMixRef, // exposed for panic-reset (devPanicReset in App)

    // noise A/B overlay state (legacy; currently never triggered but state still rendered)
    noiseOverlayActive, setNoiseOverlayActive,
    noisePrevTex, setNoisePrevTex,
    noiseNextTex, setNoiseNextTex,
    noiseProgress, setNoiseProgress,

    // blackout overlay state
    blackoutVisible, setBlackoutVisible,
    blackoutImmediate, setBlackoutImmediate,
  }
}
