import React, { useRef, useState, useMemo, Suspense, lazy, useEffect } from 'react'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Environment from './components/Environment.jsx'
import { AdaptiveDpr } from '@react-three/drei'
import PauseFrameloop from './components/PauseFrameloop.jsx'
import Player from './components/Player.jsx'
import Portal from './components/Portal.jsx'
import CameraController from './components/CameraController.jsx'
import TransitionOverlay from './components/TransitionOverlay.jsx'
import CharacterPortrait from './components/CharacterPortrait.jsx'
import PostFX from './components/PostFX.jsx'
import FollowLight from './components/FollowLight.jsx'
import PortalParticles from './components/PortalParticles.jsx'
import MusicPlayer from './components/MusicPlayer.jsx'
import { MusicalNoteIcon, XMarkIcon } from '@heroicons/react/24/solid'
import GpuStats from './components/GpuStats.jsx'
import FrustumCulledGroup from './components/FrustumCulledGroup.jsx'
// (Tumba removida)
const Section1 = lazy(() => import('./components/Section1.jsx'))
const Section2 = lazy(() => import('./components/Section2.jsx'))
const Section3 = lazy(() => import('./components/Section3.jsx'))
const Section4 = lazy(() => import('./components/Section4.jsx'))

function EggMainShake({ active, amplitude = 0.015, rot = 0.004, frequency = 16 }) {
  const { camera } = useThree()
  const base = React.useRef({ pos: camera.position.clone(), rot: camera.rotation.clone() })
  useFrame((state) => {
    if (!active) {
      camera.position.lerp(base.current.pos, 0.18)
      camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, base.current.rot.x, 0.18)
      camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, base.current.rot.y, 0.18)
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, base.current.rot.z, 0.18)
      return
    }
    const t = state.clock.getElapsedTime()
    const ax = Math.sin(t * frequency) * amplitude
    const ay = Math.cos(t * (frequency * 1.13)) * amplitude * 0.75
    const az = (Math.sin(t * (frequency * 0.71)) + Math.sin(t * (frequency * 1.77))) * 0.5 * amplitude * 0.6
    camera.position.x = base.current.pos.x + ax
    camera.position.y = base.current.pos.y + ay
    camera.position.z = base.current.pos.z + az
    camera.rotation.z = base.current.rot.z + Math.sin(t * (frequency * 0.6)) * rot
  })
  return null
}

// Define a colour palette for each section.  These values are used by the
// shader transition material to create a smooth transition between pages.
const sectionColors = {
  home: '#0f172a',
  section1: '#00bfff', // Work
  section2: '#00ff26', // About
  section3: '#e600ff', // Side Quests
  section4: '#decf00',
}

export default function App() {
  // Detección de perfil móvil/low‑perf (heurística simple, sin UI)
  const isMobilePerf = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer:coarse)').matches
    const saveData = navigator.connection && (navigator.connection.saveData || (navigator.connection.effectiveType && /2g/.test(navigator.connection.effectiveType)))
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4
    const lowThreads = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
    const highDPR = window.devicePixelRatio && window.devicePixelRatio > 2
    return Boolean(isMobileUA || coarse || saveData || lowMemory || lowThreads || highDPR)
  }, [])
  // Estado para sliders de postprocesado (UI fuera del Canvas)
  const [fx, setFx] = useState(() => ({
    bloom: 0.78,
    vignette: 0.4,
    noise: 0,
    dotEnabled: true,
    dotScale: 0.76,
    dotAngle: 0.06,
    dotCenterX: 0.38,
    dotCenterY: 0.44,
    dotOpacity: 0.05,
    dotBlend: 'screen',
    godEnabled: false,
    godDensity: 0.35,
    godDecay: 0.62,
    godWeight: 0.5,
    godExposure: 0.22,
    godClampMax: 0.56,
    godSamples: 28,
    dofEnabled: false,
    dofProgressive: false,
    dofFocusDistance: 0.375,
    dofFocalLength: 0.005,
    dofBokehScale: 2.1,
    dofFocusSpeed: 0.12,
  }))
  const [topLight, setTopLight] = useState({ height: 3.35, intensity: 8, angle: 1.2, penumbra: 0.6 })
  const [showFxPanel, setShowFxPanel] = useState(false)
  const [showLightPanel, setShowLightPanel] = useState(false)
  const [showPortraitPanel, setShowPortraitPanel] = useState(false)
  const [portraitGlowV, setPortraitGlowV] = useState(0)
  const [copiedFx, setCopiedFx] = useState(false)
  const [navTarget, setNavTarget] = useState(null)
  const [orbActiveUi, setOrbActiveUi] = useState(false)
  const glRef = useRef(null)
  const [showMusic, setShowMusic] = useState(false)
  const [showGpu, setShowGpu] = useState(false)
  const [tracks, setTracks] = useState([])
  // UI de secciones scrolleables
  const [showSectionUi, setShowSectionUi] = useState(false)
  const [sectionUiAnimatingOut, setSectionUiAnimatingOut] = useState(false)
  const [sectionUiFadeIn, setSectionUiFadeIn] = useState(false)
  const sectionScrollRef = useRef(null)
  // Hint temporal para reactivar CTA/marquee al volver a HOME
  const [uiHintPortalId, setUiHintPortalId] = useState(null)
  const uiHintTimerRef = useRef(null)
  // Track which section is currently active (home by default)
  const [section, setSection] = useState('home')
  // Track transition state; when active we animate the shader and then switch sections
  const [transitionState, setTransitionState] = useState({ active: false, from: 'home', to: null })
  const handleExitSection = React.useCallback(() => {
    if (transitionState.active) return
    if (section !== 'home') {
      // Simular click a sección HOME con navegación por orbe al centro
      try { lastExitedSectionRef.current = section } catch {}
      setShowMarquee(false)
      setMarqueeAnimatingOut(false)
      setMarqueeForceHidden(true)
      setShowSectionUi(false)
      setSectionUiAnimatingOut(false)
      setNavTarget('home')
      setTransitionState({ active: true, from: section, to: 'home' })
      setSection('home')
      try {
        const base = import.meta.env.BASE_URL || '/'
        if (typeof window !== 'undefined' && window.location.pathname !== base) {
          window.history.pushState({ section: 'home' }, '', base)
        }
      } catch {}
    }
  }, [section, transitionState.active])
  const [eggActive, setEggActive] = useState(false)
  const mainControlsRef = useRef(null)
  const [nearPortalId, setNearPortalId] = useState(null)
  const [showSectionBanner, setShowSectionBanner] = useState(false)
  const bannerTimerRef = useRef(null)
  // CTA y Marquee con animación de salida
  const [showCta, setShowCta] = useState(false)
  const [ctaAnimatingOut, setCtaAnimatingOut] = useState(false)
  const ctaHideTimerRef = useRef(null)
  // CTA preloader state
  const [ctaLoading, setCtaLoading] = useState(false)
  const [ctaProgress, setCtaProgress] = useState(0)
  const [ctaColor, setCtaColor] = useState('#ffffff')
  const ctaProgTimerRef = useRef(null)
  const [showMarquee, setShowMarquee] = useState(false)
  const [marqueeAnimatingOut, setMarqueeAnimatingOut] = useState(false)
  const marqueeHideTimerRef = useRef(null)
  const [marqueeLabelSection, setMarqueeLabelSection] = useState(null)
  const lastExitedSectionRef = useRef(null)
  const [marqueePinned, setMarqueePinned] = useState({ active: false, label: null })
  const [marqueeForceHidden, setMarqueeForceHidden] = useState(false)
  const [landingBannerActive, setLandingBannerActive] = useState(false)
  const sectionLabel = useMemo(() => ({
    home: 'HOME',
    section1: 'WORK',
    section2: 'ABOUT',
    section3: 'SIDE QUESTS',
    section4: 'CONTACT',
  }), [])

  // Medir altura de la nav inferior para posicionar CTA a +40px de separación
  const navRef = useRef(null)
  const [navHeight, setNavHeight] = useState(0)
  const musicBtnRef = useRef(null)
  const [musicPos, setMusicPos] = useState({ left: 0, bottom: 0 })
  const navInnerRef = useRef(null)
  const navBtnRefs = useRef({})
  const [navHover, setNavHover] = useState({ left: 0, width: 0, visible: false })
  // Medir altura del marquee para empujar contenido de secciones y posicionar botón salir
  const marqueeRef = useRef(null)
  const [marqueeHeight, setMarqueeHeight] = useState(0)
  useEffect(() => {
    const measure = () => {
      try {
        const h = navRef.current ? Math.round(navRef.current.getBoundingClientRect().height) : 0
        setNavHeight(h || 0)
      } catch {}
    }
    measure()
    const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(measure) : null
    if (ro && navRef.current) ro.observe(navRef.current)
    window.addEventListener('resize', measure)
    const t = setTimeout(measure, 60)
    return () => {
      window.removeEventListener('resize', measure)
      if (ro && navRef.current) ro.unobserve(navRef.current)
      clearTimeout(t)
    }
  }, [])

  const marqueeObserverRef = useRef(null)
  useEffect(() => {
    const measureMarquee = () => {
      try {
        const h = marqueeRef.current ? Math.round(marqueeRef.current.getBoundingClientRect().height) : 0
        setMarqueeHeight(h || 0)
      } catch {}
    }
    measureMarquee()
    if (typeof ResizeObserver !== 'undefined') {
      if (marqueeObserverRef.current) {
        try { marqueeObserverRef.current.disconnect() } catch {}
      }
      marqueeObserverRef.current = new ResizeObserver(measureMarquee)
      if (marqueeRef.current) marqueeObserverRef.current.observe(marqueeRef.current)
    }
    window.addEventListener('resize', measureMarquee)
    const t2 = setTimeout(measureMarquee, 60)
    return () => {
      window.removeEventListener('resize', measureMarquee)
      if (marqueeObserverRef.current) {
        try { marqueeObserverRef.current.disconnect() } catch {}
      }
      clearTimeout(t2)
    }
  }, [showMarquee, showSectionUi])

  // Posicionar panel de música justo encima de su botón en la nav
  useEffect(() => {
    const measureMusicPos = () => {
      try {
        if (!musicBtnRef.current) return
        const r = musicBtnRef.current.getBoundingClientRect()
        const left = Math.round(r.left + r.width / 2)
        const gap = 12 // separación sobre el botón
        const bottom = Math.max(0, Math.round(window.innerHeight - (r.top - gap)))
        setMusicPos({ left, bottom })
      } catch {}
    }
    measureMusicPos()
    const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(measureMusicPos) : null
    if (ro && musicBtnRef.current) ro.observe(musicBtnRef.current)
    window.addEventListener('resize', measureMusicPos)
    const t = setTimeout(measureMusicPos, 60)
    return () => {
      window.removeEventListener('resize', measureMusicPos)
      if (ro && musicBtnRef.current) ro.unobserve(musicBtnRef.current)
      clearTimeout(t)
    }
  }, [showMusic])

  // Medir highlight líquido en nav
  const updateNavHighlightForEl = (el) => {
    try {
      if (!el || !navInnerRef.current) return
      const PAD = 10 // padding interior deseado
      const c = navInnerRef.current.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      // Medir el padding real del contenedor para alinear exactamente
      const styles = window.getComputedStyle(navInnerRef.current)
      const padL = parseFloat(styles.paddingLeft) || PAD
      const padR = parseFloat(styles.paddingRight) || PAD
      // Queremos 10px exactos entre highlight y borde del contenedor y 10px exactos entre botones
      let left = Math.round(r.left - c.left) - (PAD - padL)
      let width = Math.round(r.width) + (PAD - padL) + (PAD - padR)
      if (left < 0) { width += left; left = 0 }
      const maxW = Math.round(c.width)
      if (left + width > maxW) width = Math.max(0, maxW - left)
      // redondeo a enteros para evitar jitter subpixel y asegurar simetría
      left = Math.round(left)
      width = Math.round(width)
      setNavHover({ left, width, visible: true })
    } catch {}
  }

  // Routing sencillo por History API: mapear sección <-> URL sin romper UX actual
  const baseUrl = import.meta.env.BASE_URL || '/'
  const sectionSlug = useMemo(() => ({ section1: 'work', section2: 'about', section3: 'side-quests', section4: 'contact' }), [])
  const slugToSection = useMemo(() => ({ work: 'section1', about: 'section2', 'side-quests': 'section3', contact: 'section4' }), [])
  const sectionToPath = (s) => (s && s !== 'home' ? `${baseUrl}${sectionSlug[s] || s}` : baseUrl)
  const pathToSection = (path) => {
    try {
      const base = new URL(baseUrl, window.location.origin)
      const full = new URL(path, window.location.origin)
      let rel = full.pathname
      const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`
      if (rel.startsWith(basePath)) rel = rel.slice(basePath.length)
      rel = rel.replace(/^\//, '')
      if (rel === '' || rel === '/') return 'home'
      if (slugToSection[rel]) return slugToSection[rel]
      if (['section1', 'section2', 'section3', 'section4'].includes(rel)) return rel
      return 'home'
    } catch {
      return 'home'
    }
  }

  // Inicializar sección desde la URL al cargar
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const initial = pathToSection(window.location.pathname)
    if (initial) setSection(initial)
  }, [])

  // Pre-cargar módulos de secciones para evitar descarga/parseo en primer uso de clic
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const preload = () => {
      try { import('./components/Section1.jsx') } catch {}
      try { import('./components/Section2.jsx') } catch {}
      try { import('./components/Section3.jsx') } catch {}
      try { import('./components/Section4.jsx') } catch {}
    }
    if ('requestIdleCallback' in window) {
      // @ts-ignore
      window.requestIdleCallback(preload, { timeout: 2000 })
    } else {
      setTimeout(preload, 0)
    }
  }, [])

  // Cargar manifest de canciones
  React.useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}songs/manifest.json`, { cache: 'no-cache' })
        const json = await res.json()
        if (!canceled) setTracks(Array.isArray(json) ? json : [])
      } catch {
        if (!canceled) setTracks([])
      }
    })()
    return () => { canceled = true }
  }, [])

  // Control de visibilidad y transición suave del contenedor de secciones
  useEffect(() => {
    if (transitionState.active) return
    if (section !== 'home') {
      setShowSectionUi(true)
      setSectionUiAnimatingOut(false)
      setSectionUiFadeIn(false)
      // Reset scroll al entrar
      requestAnimationFrame(() => {
        try { if (sectionScrollRef.current) sectionScrollRef.current.scrollTop = 0 } catch {}
        // disparar fade in tras montar
        setTimeout(() => setSectionUiFadeIn(true), 10)
      })
    } else if (showSectionUi) {
      setSectionUiAnimatingOut(true)
      setSectionUiFadeIn(false)
      const t = setTimeout(() => {
        setShowSectionUi(false)
        setSectionUiAnimatingOut(false)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [section, transitionState.active, showSectionUi])

  // Bloquear scroll del body cuando la UI de sección está visible
  useEffect(() => {
    const lock = showSectionUi || sectionUiAnimatingOut
    const prev = document.body.style.overflow
    if (lock) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [showSectionUi, sectionUiAnimatingOut])

  // Salir con Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && showSectionUi && !transitionState.active) {
        handleExitSection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSectionUi, transitionState.active, handleExitSection])

  // Sincronizar URL al completar transición
  const syncUrl = (s) => {
    if (typeof window === 'undefined') return
    const next = sectionToPath(s)
    if (window.location.pathname !== next) {
      window.history.pushState({ section: s }, '', next)
    }
  }

  // Responder a navegación del usuario (back/forward)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => {
      const target = pathToSection(window.location.pathname)
      if (!target) return
      if (target === 'home') {
        // Restaurar inmediatamente estados HOME
        setShowSectionUi(false)
        setSectionUiAnimatingOut(false)
        if (!transitionState.active && section !== 'home') {
          setTransitionState({ active: true, from: section, to: 'home' })
        }
        setSection('home')
        return
      }
      if (target !== section && !transitionState.active) {
        setTransitionState({ active: true, from: section, to: target })
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [section, transitionState.active])

  // Keep a ref to the player so the camera controller can follow it
  const playerRef = useRef()
  const sunRef = useRef()
  const dofTargetRef = playerRef // enfocamos al jugador
  const prevPlayerPosRef = useRef(new THREE.Vector3(0, 0, 0))
  const lastPortalIdRef = useRef(null)
  // Nota: evitamos crear un WebGLRenderer extra aquí para detectSupport (coste GPU innecesario)
  // La detección de soporte KTX2 se realiza en componentes que ya tienen acceso al renderer real.

  // Define portal locations once.  Each portal leads to a specific section.
  const portals = useMemo(
    () => [
      { id: 'section1', position: [0, 0, -16], color: sectionColors['section1'] },
      { id: 'section2', position: [16, 0, 0], color: sectionColors['section2'] },
      { id: 'section3', position: [-16, 0, 0], color: sectionColors['section3'] },
      { id: 'section4', position: [0, 0, 16], color: sectionColors['section4'] },
    ],
    [],
  )

  // Handler called when the player collides with a portal.  We initiate a transition
  // to the target section if we are not already transitioning.
  const handlePortalEnter = (target) => {
    if (!transitionState.active && target !== section) {
      setTransitionState({ active: true, from: section, to: target })
    }
  }

  // Called by the TransitionOverlay after the shader animation finishes.  We then
  // update the current section and reset the transition state.
  const handleTransitionComplete = () => {
    setSection(transitionState.to)
    setTransitionState({ active: false, from: transitionState.to || section, to: null })
    if (transitionState.to) syncUrl(transitionState.to)
    // Stop CTA preloader when transition completes
    try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch {}
    setCtaLoading(false)
    setCtaProgress(0)
    // Al volver a HOME, reestablecer jugador/cámara a estado por defecto y ocultar UI de sección
    if (transitionState.to === 'home') {
      try {
        if (playerRef.current) {
          // Reposicionar al centro de la escena al volver a HOME
          playerRef.current.position.set(0, 0, 0)
          playerRef.current.rotation.set(0, 0, 0)
        }
      } catch {}
      // Restaurar UI/controles a estado por defecto de HOME
      setShowSectionUi(false)
      setSectionUiAnimatingOut(false)
      setUiHintPortalId(null)
      setNearPortalId(null)
      setShowCta(false)
      setShowMarquee(false)
      setTintFactor(0)
      try { if (mainControlsRef.current) mainControlsRef.current.enabled = true } catch {}
    }
    // Mostrar banner de la sección activa durante 1.8s
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = null
    }
    setShowSectionBanner(true)
    bannerTimerRef.current = setTimeout(() => {
      setShowSectionBanner(false)
      bannerTimerRef.current = null
    }, 1800)
  }

  // Control de CTA con animación de salida
  React.useEffect(() => {
    if (transitionState.active) return
    const activeId = nearPortalId || uiHintPortalId
    if (activeId) {
      setShowCta(true)
      setCtaAnimatingOut(false)
      if (ctaHideTimerRef.current) {
        clearTimeout(ctaHideTimerRef.current)
        ctaHideTimerRef.current = null
      }
    } else {
      if (showCta) {
        setCtaAnimatingOut(true)
        if (ctaHideTimerRef.current) clearTimeout(ctaHideTimerRef.current)
        ctaHideTimerRef.current = window.setTimeout(() => {
          setShowCta(false)
          setCtaAnimatingOut(false)
          ctaHideTimerRef.current = null
        }, 220)
      }
    }
  }, [nearPortalId, uiHintPortalId, transitionState.active, showCta])

  // Control de Marquee conforme a checklist (persistente en transición a secciones)
  React.useEffect(() => {
    if (marqueeForceHidden) {
      setShowMarquee(false)
      setMarqueeAnimatingOut(false)
      return
    }
    if (landingBannerActive) {
      setShowMarquee(true)
      // Bloquear animación de salida mientras dura el banner de aterrizaje
      setMarqueeAnimatingOut(false)
      return
    }
    // Si estamos iniciando transición hacia una sección (desde HOME por CTA), pinear marquee con label de destino
    if (ctaLoading && transitionState.to && transitionState.to !== 'home') {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(transitionState.to)
      return
    }
    // En secciones (UI visible), marquee fijo con label de la sección
    if (showSectionUi) {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(section)
      return
    }
    // En HOME: solo cuando estamos parados en un portal (near/uiHint)
    const shouldShowHome = Boolean(section === 'home' && (nearPortalId || uiHintPortalId))
    if (shouldShowHome) {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(nearPortalId || uiHintPortalId || section)
      if (marqueeHideTimerRef.current) { clearTimeout(marqueeHideTimerRef.current); marqueeHideTimerRef.current = null }
      return
    }
    // Si no se cumple, ocultar (sin rebotes)
    if (showMarquee) {
      setMarqueeAnimatingOut(true)
      if (marqueeHideTimerRef.current) clearTimeout(marqueeHideTimerRef.current)
      marqueeHideTimerRef.current = window.setTimeout(() => {
        // Si entra un banner de aterrizaje, no dispares salida
        if (!landingBannerActive) {
          setShowMarquee(false)
          setMarqueeAnimatingOut(false)
        }
        marqueeHideTimerRef.current = null
      }, 200)
    }
  }, [marqueeForceHidden, landingBannerActive, ctaLoading, transitionState.to, showSectionUi, section, nearPortalId, uiHintPortalId, showMarquee])

  // Forzar fade a negro rápido al salir de sección para ocultar parpadeos
  useEffect(() => {
    if (!transitionState.active) return
    if (transitionState.from !== 'home' && transitionState.to === 'home') {
      // cambiar temporalmente el color 'to' a negro durante 200ms
      // aprovechamos forceOnceKey para recrear el overlay si fuera necesario
    }
  }, [transitionState])

  const [tintFactor, setTintFactor] = useState(0)
  // Reduce la frecuencia de recomputar el color de escena, amortiguando cambios bruscos
  const sceneColor = useMemo(() => {
    const baseBg = '#204580'
    const nearColor = '#0a132b'
    return lerpColor(baseBg, nearColor, tintFactor)
  }, [tintFactor])
  const [portalMixMap, setPortalMixMap] = useState({})
  function lerpColor(hex1, hex2, t) {
    const c1 = parseInt(hex1.slice(1), 16)
    const c2 = parseInt(hex2.slice(1), 16)
    const r = Math.round(((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t)
    const g = Math.round(((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t)
    const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t)
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  }
  const redEgg = '#7a0b0b'
  // Prioriza huevo, en caso contrario aplica el color amortiguado
  const effectiveSceneColor = eggActive ? redEgg : sceneColor

  

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* The main WebGL canvas */}
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, isMobilePerf ? 1.2 : 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, preserveDrawingBuffer: false }}
        camera={{ position: [0, 3, 8], fov: 60, near: 0.1, far: 120 }}
        onCreated={({ gl }) => {
          // Pre-warm shaders/pipelines to avoid first interaction jank
          try {
            gl.getContextAttributes()
          } catch {}
          glRef.current = gl
        }}
      >
        <Suspense fallback={null}>
          <AdaptiveDpr pixelated />
          <PauseFrameloop paused={(showSectionUi || sectionUiAnimatingOut) && !transitionState.active} />
          <Environment overrideColor={effectiveSceneColor} lowPerf={isMobilePerf} />
          {/* Ancla para God Rays (oculta cuando no está activo y sin escribir depth) */}
          {fx.godEnabled && (
            <mesh ref={sunRef} position={[0, 8, 0]}>
              <sphereGeometry args={[0.35, 12, 12]} />
              <meshBasicMaterial color={'#ffffff'} transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          <Player
            playerRef={playerRef}
            portals={portals}
            onPortalEnter={handlePortalEnter}
            onProximityChange={(f) => {
              // amortiguar cambios de tinte para evitar updates en cada frame
              const smooth = (prev, next, k = 0.22) => prev + (next - prev) * k
              setTintFactor((prev) => smooth(prev ?? 0, f))
            }}
            onPortalsProximityChange={setPortalMixMap}
            onNearPortalChange={(id) => {
              setNearPortalId(id)
              // Si durante el banner de aterrizaje pisamos un portal, mantener marquee activo sin animaciones de salida
              if (id && section === 'home') {
                if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null }
                setLandingBannerActive(false)
                setMarqueeAnimatingOut(false)
                setShowMarquee(true)
                setMarqueeLabelSection(id)
              }
            }}
            navigateToPortalId={navTarget}
            sceneColor={effectiveSceneColor}
            onReachedPortal={(id) => {
              // Guardar último portal alcanzado y detener navegación
              try { lastPortalIdRef.current = id } catch {}
              if (id && id !== 'home') {
                try { setMarqueeLabelSection(id) } catch {}
              }
              setNavTarget(null)
            }}
            onOrbStateChange={(active) => setOrbActiveUi(active)}
            onHomeSplash={() => {
              // Mostrar marquee 4s tras splash en HOME
              // Mostrar HOME como indicador al aterrizar
              if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null }
              setMarqueeLabelSection('home')
              setShowMarquee(true)
              setMarqueeAnimatingOut(false)
              setMarqueeForceHidden(false)
              setLandingBannerActive(true)
              bannerTimerRef.current = setTimeout(() => {
                // Iniciar animación de salida
                setLandingBannerActive(false)
                setMarqueeAnimatingOut(true)
                // Tras la duración de la animación, ocultar completamente
                window.setTimeout(() => {
                  setShowMarquee(false)
                  setMarqueeAnimatingOut(false)
                }, 220)
                bannerTimerRef.current = null
              }, 2000)
              lastExitedSectionRef.current = null
            }}
          />
          {/* Tumba removida */}
          <FollowLight playerRef={playerRef} height={topLight.height} intensity={topLight.intensity} angle={topLight.angle} penumbra={topLight.penumbra} color={'#fff'} />
          {portals.map((p) => {
            const mix = portalMixMap[p.id] || 0
            const targetColor = sectionColors[p.id] || '#ffffff'
            return (
            <FrustumCulledGroup key={p.id} position={p.position} radius={4.5} maxDistance={64} sampleEvery={4}>
              <Portal position={[0,0,0]} color={p.color} targetColor={targetColor} mix={mix} size={2} />
              <PortalParticles center={[0,0,0]} radius={4} count={isMobilePerf ? 120 : 220} color={'#9ec6ff'} targetColor={targetColor} mix={mix} playerRef={playerRef} frenzyRadius={10} />
            </FrustumCulledGroup>
            )
          })}
          <CameraController
            playerRef={playerRef}
            controlsRefExternal={mainControlsRef}
            shakeActive={eggActive || Boolean(nearPortalId)}
            shakeAmplitude={eggActive ? 0.18 : 0.08}
            shakeFrequencyX={eggActive ? 22.0 : 14.0}
            shakeFrequencyY={eggActive ? 18.0 : 12.0}
            shakeYMultiplier={eggActive ? 1.0 : 0.9}
            enabled={!showSectionUi && !sectionUiAnimatingOut}
          />
          {/* Mantengo sólo el shake vía target para no interferir con OrbitControls */}
          {/* Perf can be used during development to monitor FPS; disabled by default. */}
          {/* <Perf position="top-left" /> */}
          {/* Postprocessing effects */}
          <PostFX
            lowPerf={false}
            eggActiveGlobal={eggActive}
            bloom={fx.bloom}
            vignette={fx.vignette}
            noise={fx.noise}
            dotEnabled={fx.dotEnabled}
            dotScale={fx.dotScale}
            dotAngle={fx.dotAngle}
            dotCenterX={fx.dotCenterX}
            dotCenterY={fx.dotCenterY}
            dotOpacity={fx.dotOpacity}
            dotBlend={fx.dotBlend}
            godEnabled={fx.godEnabled}
            godSun={sunRef}
            godDensity={fx.godDensity}
            godDecay={fx.godDecay}
            godWeight={fx.godWeight}
            godExposure={fx.godExposure}
            godClampMax={fx.godClampMax}
            godSamples={fx.godSamples}
            dofEnabled={fx.dofEnabled}
            dofProgressive={fx.dofProgressive}
            dofFocusDistance={fx.dofFocusDistance}
            dofFocalLength={fx.dofFocalLength}
            dofBokehScale={fx.dofBokehScale}
            dofFocusSpeed={fx.dofFocusSpeed}
            dofTargetRef={dofTargetRef}
          />
          <TransitionOverlay
            active={transitionState.active}
            fromColor={sectionColors[transitionState.from]}
            toColor={sectionColors[transitionState.to || section]}
            duration={0.8}
            onComplete={handleTransitionComplete}
            forceOnceKey={`${transitionState.from}->${transitionState.to}`}
            maxOpacity={(transitionState.from !== 'home' && (transitionState.to || section) === 'home') ? 0 : 1}
          />
        </Suspense>
      </Canvas>
      {showGpu && <GpuStats sampleMs={1000} gl={glRef.current} />}
      {/* Overlay global negro desactivado para no tapar la animación de HOME */}
      {/* Secciones scrolleables con transición suave y fondo por sección */}
      {(showSectionUi || sectionUiAnimatingOut) && (
        <div
          ref={sectionScrollRef}
          className="fixed inset-0 z-[12000] pointer-events-auto overflow-y-auto"
          style={{
            backgroundColor: sectionColors[section] || '#000000',
            opacity: (sectionUiFadeIn && showSectionUi && !sectionUiAnimatingOut) ? 1 : 0,
            transition: 'opacity 500ms ease',
          }}
        >
          {/* Gradiente superior para simular desaparición bajo el marquee */}
          <div
            className="pointer-events-none fixed left-0 right-0"
            style={{
              top: `${marqueeHeight}px`,
              height: '56px',
              background: `linear-gradient(to bottom, ${sectionColors[section] || '#000000'} 0%, rgba(0,0,0,0) 100%)`,
              zIndex: 12500,
            }}
            aria-hidden
          />
          <div className="min-h-screen w-full" style={{ paddingTop: `${marqueeHeight + 56}px` }}>
            <Suspense fallback={null}>
              <div className="max-w-5xl mx-auto p-6 sm:p-8">
                {section === 'section1' && <Section1 />}
                {section === 'section2' && <Section2 />}
                {section === 'section3' && <Section3 />}
                {section === 'section4' && <Section4 />}
              </div>
            </Suspense>
          </div>
        </div>
      )}

      {/* CTA: Cruza el portal (aparece cuando el jugador está cerca del portal) */}
      {((showCta || ctaAnimatingOut || ctaLoading) && (!transitionState.active || ctaLoading)) && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[10000] flex items-center justify-center"
          style={{ bottom: `${(navHeight || 0) + 80}px` }}
        >
          <button
            type="button"
            onClick={async () => {
              const target = nearPortalId || uiHintPortalId
              if (!target) return
              if (transitionState.active) return
              if (target === section) return
              if (ctaLoading) return
              // Preloader CTA: iniciar barra de progreso y color por sección
              try { setCtaColor(sectionColors[target] || '#ffffff') } catch {}
              setCtaLoading(true)
              setCtaProgress(0)
              if (ctaProgTimerRef.current) clearInterval(ctaProgTimerRef.current)
              ctaProgTimerRef.current = setInterval(() => {
                setCtaProgress((p) => Math.min(100, p + 4))
              }, 60)
              // Preload sección destino sin bloquear UI
              try {
                const preloadMap = {
                  section1: () => import('./components/Section1.jsx'),
                  section2: () => import('./components/Section2.jsx'),
                  section3: () => import('./components/Section3.jsx'),
                  section4: () => import('./components/Section4.jsx'),
                }
                const f = preloadMap[target]
                if (typeof f === 'function') {
                  try { await f() } catch {}
                }
              } catch {}
              // completar barra a 100% antes de iniciar transición
              setCtaProgress(100)
              try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch {}
              // Inicia transición visual
              try { if (playerRef.current) prevPlayerPosRef.current.copy(playerRef.current.position) } catch {}
              try { lastPortalIdRef.current = target } catch {}
              setTransitionState({ active: true, from: section, to: target })
              // trigger glow in portrait on nav click
              setPortraitGlowV((v) => v + 1)
              // Fallback inmediato de navegación por si el overlay no dispara onComplete en algún navegador
              setSection(target)
              if (typeof window !== 'undefined') {
                const base = import.meta.env.BASE_URL || '/'
                const map = { section1: 'work', section2: 'about', section3: 'side-quests', section4: 'contact' }
                const next = target && target !== 'home' ? `${base}${map[target] || target}` : base
                if (window.location.pathname !== next) {
                  window.history.pushState({ section: target }, '', next)
                }
              }
              // Fallback extra: completar transición si por alguna razón no se resetea el overlay
              window.setTimeout(() => {
                setTransitionState((s) => (s.active ? { active: false, from: target, to: null } : s))
              }, 900)
            }}
            className="pointer-events-auto relative overflow-hidden px-8 py-4 sm:px-10 sm:py-4 md:px-12 md:py-5 rounded-full bg-white text-black font-bold uppercase tracking-wide text-xl sm:text-3xl md:text-4xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:translate-y-[-2px] active:translate-y-[0] transition-transform font-marquee scale-150"
            style={{ fontFamily: '\'Luckiest Guy\', Archivo Black, system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif', animation: `${(nearPortalId || uiHintPortalId) ? 'slideup 220ms ease-out forwards' : 'slideup-out 220ms ease-in forwards'}` }}
          
          >
            {/* Fondo de preloader como relleno del botón */}
            <span
              aria-hidden
              className="absolute left-0 top-0 bottom-0 z-0 rounded-full"
              style={{
                width: `${ctaLoading ? ctaProgress : 0}%`,
                backgroundColor: ctaColor,
                transition: 'width 150ms ease-out',
              }}
            />
            <span className="relative z-[10]">Cruza el portal</span>
          </button>
        </div>
      )}

      {/* Marquee de título de sección (solo visible en HOME) */}
      {(showMarquee || marqueeAnimatingOut) && (
        <div
          ref={marqueeRef}
          className="fixed top-0 left-0 right-0 z-[13000] pointer-events-none pt-0 pb-2"
          style={{ animation: `${(landingBannerActive || nearPortalId || showSectionUi) ? 'slidedown 200ms ease-out' : (marqueeAnimatingOut ? 'slidedown-out 200ms ease-in forwards' : 'none')}` }}
        >
          <div className="overflow-hidden w-full">
            <div className="whitespace-nowrap opacity-95 will-change-transform" style={{ animation: 'marquee 18s linear infinite', transform: 'translateZ(0)' }}>
              {[0, 1].map((seq) => (
                <React.Fragment key={seq}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span
                      key={`${seq}-${i}`}
                      className="title-banner"
                      style={{ fontFamily: '\'Luckiest Guy\', Archivo Black, system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif', WebkitTextStroke: '1px rgba(255,255,255,0.08)' }}
                    >
                      {(sectionLabel[marqueeLabelSection || nearPortalId || uiHintPortalId || section] || ((marqueeLabelSection || nearPortalId || uiHintPortalId || section || '').toUpperCase()))}
                    </span>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Botón salir debajo del marquee, alineado a la izquierda (visible en secciones) */}
      {!transitionState.active && showSectionUi && (
        <button
          type="button"
          onClick={handleExitSection}
          className="pointer-events-auto fixed left-4 z-[13050] h-10 w-10 rounded-full bg-white text-black grid place-items-center shadow-md transition-transform hover:translate-y-[-1px]"
          style={{ top: `${marqueeHeight + 40}px` }}
          aria-label="Cerrar sección"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      )}
      {/* Toggle panel FX */}
      <button
        type="button"
        onClick={() => setShowFxPanel((v) => !v)}
        className="pointer-events-auto fixed right-4 top-16 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md z-[15000]"
        aria-label="Toggle panel FX"
      >FX</button>
      {/* Toggle Music Player (movido a la nav principal) */}
      {/* Toggle GPU Stats */}
      <button
        type="button"
        onClick={() => setShowGpu((v) => !v)}
        className="pointer-events-auto fixed right-4 top-28 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md z-[15000] transition-transform hover:translate-y-[-1px]"
        aria-label="Toggle GPU stats"
      >GPU</button>
      {/* Nav rápida a secciones */}
      <div ref={navRef} className="pointer-events-auto fixed inset-x-0 bottom-10 z-[450] flex items-center justify-center">
        <div ref={navInnerRef} className="relative bg-white/95 backdrop-blur rounded-full shadow-lg p-2.5 flex items-center gap-0 overflow-hidden">
          {/* Highlight líquido */}
          <div
            className={`absolute rounded-full bg-black/10 transition-all duration-200 ${navHover.visible ? 'opacity-100' : 'opacity-0'}`}
            style={{ left: `${navHover.left}px`, width: `${navHover.width}px`, top: '10px', bottom: '10px' }}
          />
          {['section1','section2','section3','section4'].map((id) => (
            <button
              key={id}
              type="button"
              ref={(el) => { if (el) navBtnRefs.current[id] = el }}
              onMouseEnter={(e) => updateNavHighlightForEl(e.currentTarget)}
              onFocus={(e) => updateNavHighlightForEl(e.currentTarget)}
              onMouseLeave={() => setNavHover((h) => ({ ...h, visible: false }))}
              onBlur={() => setNavHover((h) => ({ ...h, visible: false }))}
              onClick={() => { if (!orbActiveUi) { setNavTarget(id); setPortraitGlowV((v) => v + 1) } }}
              className="relative z-[1] px-2.5 py-2.5 rounded-full bg-transparent text-black text-base sm:text-lg font-marquee uppercase tracking-wide"
            >{sectionLabel[id]}</button>
          ))}
          <button
            type="button"
            onClick={() => setShowMusic((v) => !v)}
            ref={musicBtnRef}
            onMouseEnter={(e) => updateNavHighlightForEl(e.currentTarget)}
            onFocus={(e) => updateNavHighlightForEl(e.currentTarget)}
            onMouseLeave={() => setNavHover((h) => ({ ...h, visible: false }))}
            onBlur={() => setNavHover((h) => ({ ...h, visible: false }))}
            className="relative z-[1] px-2.5 py-2.5 rounded-full bg-transparent text-black grid place-items-center"
            aria-label="Toggle music player"
          >
            <MusicalNoteIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div
        className={`fixed z-[900] transition-all duration-200 ${showMusic ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none invisible'}`}
        aria-hidden={!showMusic}
        style={{ left: `${musicPos.left}px`, bottom: `${musicPos.bottom}px`, transform: 'translateX(-50%)' }}
      >
        <MusicPlayer tracks={tracks} />
      </div>
      {/* Panel externo para ajustar postprocesado */}
      {showFxPanel && (
      <div className="pointer-events-auto fixed right-4 top-28 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none z-[500]">
        <div className="text-xs font-semibold opacity-80">Post‑Processing</div>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>GodRays</span>
          <input
            type="checkbox"
            checked={fx.godEnabled}
            onChange={(e) => {
              const enabled = e.target.checked
              // Si se activa y seguimos en los valores por defecto suaves, aplicar un preset más evidente
              const looksDefault = fx.godDensity === 0.9 && fx.godDecay === 0.95 && fx.godWeight === 0.6 && fx.godExposure === 0.3 && fx.godClampMax === 1.0 && fx.godSamples === 60
              setFx({
                ...fx,
                godEnabled: enabled,
                ...(enabled && looksDefault
                  ? { godDensity: 1.1, godDecay: 0.94, godWeight: 1.0, godExposure: 0.6, godClampMax: 1.2, godSamples: 80 }
                  : {}),
              })
            }}
          />
        </div>
        {fx.godEnabled && (
          <>
            <label className="block text-[11px] opacity-80">Density: {fx.godDensity.toFixed(2)}
              <input className="w-full" type="range" min="0.1" max="1.5" step="0.01" value={fx.godDensity} onChange={(e) => setFx({ ...fx, godDensity: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">Decay: {fx.godDecay.toFixed(2)}
              <input className="w-full" type="range" min="0.5" max="1.0" step="0.01" value={fx.godDecay} onChange={(e) => setFx({ ...fx, godDecay: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">Weight: {fx.godWeight.toFixed(2)}
              <input className="w-full" type="range" min="0.1" max="1.5" step="0.01" value={fx.godWeight} onChange={(e) => setFx({ ...fx, godWeight: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">Exposure: {fx.godExposure.toFixed(2)}
              <input className="w-full" type="range" min="0.0" max="1.0" step="0.01" value={fx.godExposure} onChange={(e) => setFx({ ...fx, godExposure: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">ClampMax: {fx.godClampMax.toFixed(2)}
              <input className="w-full" type="range" min="0.2" max="2.0" step="0.01" value={fx.godClampMax} onChange={(e) => setFx({ ...fx, godClampMax: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">Samples: {fx.godSamples}
              <input className="w-full" type="range" min="16" max="120" step="1" value={fx.godSamples} onChange={(e) => setFx({ ...fx, godSamples: parseInt(e.target.value, 10) })} />
            </label>
          </>
        )}
        <label className="block text-[11px] opacity-80">Bloom: {fx.bloom.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1.5" step="0.01" value={fx.bloom} onChange={(e) => setFx({ ...fx, bloom: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Vignette: {fx.vignette.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.vignette} onChange={(e) => setFx({ ...fx, vignette: parseFloat(e.target.value) })} />
        </label>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>Halftone (DotScreen)</span>
          <input type="checkbox" checked={fx.dotEnabled} onChange={(e) => setFx({ ...fx, dotEnabled: e.target.checked })} />
        </div>
        <label className="block text-[11px] opacity-80">Dot scale: {fx.dotScale.toFixed(2)}
          <input className="w-full" type="range" min="0" max="3" step="0.01" value={fx.dotScale} onChange={(e) => setFx({ ...fx, dotScale: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
        </label>
        <label className="block text-[11px] opacity-80">Dot angle: {fx.dotAngle.toFixed(2)}
          <input className="w-full" type="range" min="0" max="3.1416" step="0.01" value={fx.dotAngle} onChange={(e) => setFx({ ...fx, dotAngle: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 block text-[11px] opacity-80">Center X: {fx.dotCenterX.toFixed(2)}
            <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.dotCenterX} onChange={(e) => setFx({ ...fx, dotCenterX: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
          </label>
          <label className="flex-1 block text-[11px] opacity-80">Center Y: {fx.dotCenterY.toFixed(2)}
            <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.dotCenterY} onChange={(e) => setFx({ ...fx, dotCenterY: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
          </label>
        </div>
        <label className="block text-[11px] opacity-80">Dot opacity: {fx.dotOpacity.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.dotOpacity} onChange={(e) => setFx({ ...fx, dotOpacity: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
        </label>
        <label className="block text-[11px] opacity-80">Dot blend
          <select
            className="w-full bg-black/30 border border-white/10 rounded mt-1"
            value={fx.dotBlend}
            onChange={(e) => setFx({ ...fx, dotBlend: e.target.value })}
            disabled={!fx.dotEnabled}
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
            <option value="softlight">SoftLight</option>
            <option value="add">Add</option>
            <option value="darken">Darken</option>
            <option value="lighten">Lighten</option>
          </select>
        </label>
        <button
          type="button"
          className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors transition-transform hover:translate-y-[-1px]"
          onClick={async () => {
            const preset = JSON.stringify(fx, null, 2)
            try {
              await navigator.clipboard.writeText(preset)
            } catch {
              const ta = document.createElement('textarea')
              ta.value = preset
              document.body.appendChild(ta)
              ta.select()
              document.execCommand('copy')
              document.body.removeChild(ta)
            }
            setCopiedFx(true)
            setTimeout(() => setCopiedFx(false), 1200)
          }}
        >{copiedFx ? '¡Copiado!' : 'Copiar preset FX'}</button>
        <label className="block text-[11px] opacity-80">Noise: {fx.noise.toFixed(2)}
          <input className="w-full" type="range" min="0" max="0.6" step="0.01" value={fx.noise} onChange={(e) => setFx({ ...fx, noise: parseFloat(e.target.value) })} />
        </label>
        <div className="h-px bg-white/10 my-2" />
        <div className="text-xs font-semibold opacity-80">Depth of Field</div>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>Activar</span>
          <input type="checkbox" checked={fx.dofEnabled} onChange={(e) => setFx({ ...fx, dofEnabled: e.target.checked })} />
        </div>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>Progresivo</span>
          <input type="checkbox" checked={fx.dofProgressive} onChange={(e) => setFx({ ...fx, dofProgressive: e.target.checked })} />
        </div>
        {!fx.dofProgressive && (
          <label className="block text-[11px] opacity-80">Focus distance: {fx.dofFocusDistance.toFixed(2)}
            <input className="w-full" type="range" min="0" max="1" step="0.005" value={fx.dofFocusDistance} onChange={(e) => setFx({ ...fx, dofFocusDistance: parseFloat(e.target.value) })} />
          </label>
        )}
        <label className="block text-[11px] opacity-80">Focal length: {fx.dofFocalLength.toFixed(3)}
          <input className="w-full" type="range" min="0.001" max="0.06" step="0.001" value={fx.dofFocalLength} onChange={(e) => setFx({ ...fx, dofFocalLength: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Bokeh scale: {fx.dofBokehScale.toFixed(1)}
          <input className="w-full" type="range" min="0.5" max="6" step="0.1" value={fx.dofBokehScale} onChange={(e) => setFx({ ...fx, dofBokehScale: parseFloat(e.target.value) })} />
        </label>
        {fx.dofProgressive && (
          <label className="block text-[11px] opacity-80">Focus speed: {fx.dofFocusSpeed.toFixed(2)}
            <input className="w-full" type="range" min="0.02" max="0.5" step="0.01" value={fx.dofFocusSpeed} onChange={(e) => setFx({ ...fx, dofFocusSpeed: parseFloat(e.target.value) })} />
          </label>
        )}
      </div>
      )}
      {/* Panel externo para ajustar la luz superior */}
      <button
        type="button"
        onClick={() => setShowLightPanel((v) => !v)}
        className="pointer-events-auto fixed right-4 top-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md transition-transform hover:translate-y-[-1px]"
        aria-label="Toggle panel Luz"
      >Luz</button>
      {showLightPanel && (
      <div className="pointer-events-auto fixed right-4 top-16 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none">
        <button
          type="button"
          className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors transition-transform hover:translate-y-[-1px]"
          onClick={async () => {
            const preset = JSON.stringify(topLight, null, 2)
            try {
              await navigator.clipboard.writeText(preset)
            } catch {
              const ta = document.createElement('textarea')
              ta.value = preset
              document.body.appendChild(ta)
              ta.select()
              document.execCommand('copy')
              document.body.removeChild(ta)
            }
          }}
        >Copiar preset Luz</button>
        <div className="text-xs font-semibold opacity-80">Luz superior</div>
        <label className="block text-[11px] opacity-80">Altura: {topLight.height.toFixed(2)}
          <input className="w-full" type="range" min="2" max="12" step="0.05" value={topLight.height} onChange={(e) => setTopLight({ ...topLight, height: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Intensidad: {topLight.intensity.toFixed(2)}
          <input className="w-full" type="range" min="0" max="8" step="0.05" value={topLight.intensity} onChange={(e) => setTopLight({ ...topLight, intensity: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Ángulo: {topLight.angle.toFixed(2)}
          <input className="w-full" type="range" min="0.1" max="1.2" step="0.01" value={topLight.angle} onChange={(e) => setTopLight({ ...topLight, angle: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Penumbra: {topLight.penumbra.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1" step="0.01" value={topLight.penumbra} onChange={(e) => setTopLight({ ...topLight, penumbra: parseFloat(e.target.value) })} />
        </label>
      </div>
      )}
      {/* Portrait del personaje en cápsula, esquina inferior izquierda */}
      <CharacterPortrait
        showUI={showPortraitPanel}
        dotEnabled={fx.dotEnabled}
        dotScale={fx.dotScale}
        dotAngle={fx.dotAngle}
        dotCenterX={fx.dotCenterX}
        dotCenterY={fx.dotCenterY}
        dotOpacity={fx.dotOpacity}
        dotBlend={fx.dotBlend}
        glowVersion={portraitGlowV}
        onEggActiveChange={setEggActive}
      />
      {/* Toggle panel Retrato */}
      <button
        type="button"
        onClick={() => setShowPortraitPanel((v) => !v)}
        className="pointer-events-auto fixed right-4 top-40 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md transition-transform hover:translate-y-[-1px]"
        aria-label="Toggle panel Retrato"
      >Ret</button>
    </div>
  )
}