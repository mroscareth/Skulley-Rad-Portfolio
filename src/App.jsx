import React, { useRef, useState, useMemo, Suspense, lazy, useEffect } from 'react'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Environment from './components/Environment.jsx'
import { AdaptiveDpr, useGLTF, useAnimations, TransformControls, Html } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import PauseFrameloop from './components/PauseFrameloop.jsx'
import Player from './components/Player.jsx'
import Portal from './components/Portal.jsx'
import CameraController from './components/CameraController.jsx'
import TransitionOverlay from './components/TransitionOverlay.jsx'
import CharacterPortrait from './components/CharacterPortrait.jsx'
import PostFX from './components/PostFX.jsx'
import { getWorkImageUrls } from './components/Section1.jsx'
import FollowLight from './components/FollowLight.jsx'
import PortalParticles from './components/PortalParticles.jsx'
import MusicPlayer from './components/MusicPlayer.jsx'
import MobileJoystick from './components/MobileJoystick.jsx'
import { MusicalNoteIcon, XMarkIcon, Bars3Icon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid'
import GpuStats from './components/GpuStats.jsx'
import FrustumCulledGroup from './components/FrustumCulledGroup.jsx'
import { playSfx, preloadSfx } from './lib/sfx.js'
import { useLanguage } from './i18n/LanguageContext.jsx'
import GlobalCursor from './components/GlobalCursor.jsx'
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
  const { lang, setLang, t } = useLanguage()
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
  const [playerMoving, setPlayerMoving] = useState(false)
  const glRef = useRef(null)
  const [degradedMode, setDegradedMode] = useState(false)
  const [showMusic, setShowMusic] = useState(false)
  const [showGpu, setShowGpu] = useState(false)
  const [tracks, setTracks] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
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
      // Blackout inmediato primero para no mostrar portales ni escena
      setBlackoutImmediate(true)
      setBlackoutVisible(true)
      // Ocultar de inmediato la UI de sección (sin fade) para evitar flashes
      setShowSectionUi(false)
      // Registrar salida
      try { lastExitedSectionRef.current = section } catch {}
      // Al salir, ocultar marquee de forma explícita
      setShowMarquee(false)
      setMarqueeAnimatingOut(false)
      setMarqueeForceHidden(true)
      // Ocultar CTA y limpiar cualquier estado/timer relacionado antes de volver a HOME
      try { if (ctaHideTimerRef.current) { clearTimeout(ctaHideTimerRef.current); ctaHideTimerRef.current = null } } catch {}
      try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch {}
      setShowCta(false)
      setCtaAnimatingOut(false)
      setCtaLoading(false)
      setCtaProgress(0)
      setNearPortalId(null)
      setUiHintPortalId(null)
      setCtaForceHidden(true)
      try { if (ctaForceTimerRef.current) clearTimeout(ctaForceTimerRef.current) } catch {}
      ctaForceTimerRef.current = window.setTimeout(() => { setCtaForceHidden(false); ctaForceTimerRef.current = null }, 800)
      setSectionUiAnimatingOut(false)
      setSectionUiFadeIn(false)
      // Iniciar orb hacia HOME exactamente como en preloader
      try { if (blackoutTimerRef.current) { clearTimeout(blackoutTimerRef.current); blackoutTimerRef.current = null } } catch {}
      // Fallback extra: liberar blackout si por alguna razón no llega onHomeFallStart
      setTimeout(() => { setBlackoutVisible(false); setBlackoutImmediate(false) }, 1400)
      // Iniciar navegación a HOME inmediatamente (igual que preloader)
      setNavTarget('home')
      // Alinear estado de sección y URL con HOME sin usar TransitionOverlay
      setSection('home')
      try { syncUrl('home') } catch {}
    }
  }, [section, transitionState.active])

  // Escuchar click del botón cerrar que emite el retrato
  useEffect(() => {
    const onExit = () => handleExitSection()
    window.addEventListener('exit-section', onExit)
    return () => window.removeEventListener('exit-section', onExit)
  }, [handleExitSection])
  const [eggActive, setEggActive] = useState(false)
  useEffect(() => { try { window.__eggActiveGlobal = eggActive } catch {} }, [eggActive])
  // Toggle glitch font globally when eggActive
  useEffect(() => {
    try {
      const cls = 'glitch-font'
      const root = document.documentElement
      const body = document.body
      if (eggActive) { root.classList.add(cls); body.classList.add(cls) }
      else { root.classList.remove(cls); body.classList.remove(cls) }
    } catch {}
  }, [eggActive])
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
  // Forzar ocultar CTA temporalmente al salir de sección para evitar flash
  const [ctaForceHidden, setCtaForceHidden] = useState(false)
  const ctaForceTimerRef = useRef(null)
  const [showMarquee, setShowMarquee] = useState(false)
  const [marqueeAnimatingOut, setMarqueeAnimatingOut] = useState(false)
  const marqueeHideTimerRef = useRef(null)
  const [marqueeLabelSection, setMarqueeLabelSection] = useState(null)
  const lastExitedSectionRef = useRef(null)
  const [marqueePinned, setMarqueePinned] = useState({ active: false, label: null })
  const [marqueeForceHidden, setMarqueeForceHidden] = useState(false)
  const [landingBannerActive, setLandingBannerActive] = useState(false)
  const [marqueeAnimateIn, setMarqueeAnimateIn] = useState(false)
  const marqueeAnimTimerRef = useRef(null)
  const [scrollbarW, setScrollbarW] = useState(0)
  const [sectionScrollProgress, setSectionScrollProgress] = useState(0)
  // Fade-to-black overlay control
  const [blackoutVisible, setBlackoutVisible] = useState(false)
  const [blackoutImmediate, setBlackoutImmediate] = useState(false)
  const blackoutTimerRef = useRef(null)
  // Preloader global de arranque
  const [bootLoading, setBootLoading] = useState(true)
  const [bootProgress, setBootProgress] = useState(0)
  const [bootAllDone, setBootAllDone] = useState(false)
  const [characterReady, setCharacterReady] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const preloaderPlayerRef = useRef()
  const preloaderHeadRef = useRef()
  const preSunRef = useRef()
  const [preOrbitPaused, setPreOrbitPaused] = useState(false)
  const [preloaderFadingOut, setPreloaderFadingOut] = useState(false)
  const preloaderStartedRef = useRef(false)
  // Exponer controles globales para pausar/continuar cámara del preloader
  useEffect(() => {
    try {
      // eslint-disable-next-line no-underscore-dangle
      window.pausePreloaderCamera = () => setPreOrbitPaused(true)
      // eslint-disable-next-line no-underscore-dangle
      window.resumePreloaderCamera = () => setPreOrbitPaused(false)
    } catch {}
  }, [])

  // Cerrar overlay del menú con Escape
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (e) => {
      try {
        if (e.key === 'Escape') setMenuOpen(false)
      } catch {}
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  // Orquestar pre-carga de assets críticos antes de iniciar animación HOME
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let done = 0
      let total = 0
      const bump = () => {
        done += 1
        if (cancelled) return
        const pct = Math.round((done / Math.max(1, total)) * 100)
        setBootProgress((p) => (pct > p ? pct : p))
      }
      const safe = async (p) => { try { await p } catch {} finally { bump() } }
      const tasks = []
      const addTask = (promiseFactory) => { total += 1; tasks.push(safe(promiseFactory())) }

      try {
        // Listas estáticas conocidas
        const glbList = [
          `${import.meta.env.BASE_URL}character.glb`,
          `${import.meta.env.BASE_URL}characterStone.glb`,
          `${import.meta.env.BASE_URL}grave_lowpoly.glb`,
          `${import.meta.env.BASE_URL}3dmodels/housebird.glb`,
          `${import.meta.env.BASE_URL}3dmodels/housebirdPink.glb`,
          `${import.meta.env.BASE_URL}3dmodels/housebirdWhite.glb`,
        ]
        const hdrList = [
          `${import.meta.env.BASE_URL}light.hdr`,
          `${import.meta.env.BASE_URL}light_.hdr`,
        ]
        const imageList = [
          `${import.meta.env.BASE_URL}Etherean.jpg`,
          `${import.meta.env.BASE_URL}slap.svg`,
        ]
        const fxList = ['hover','click','magiaInicia','sparkleBom','sparkleFall','stepone','stepSoft','steptwo']
        const otherAudio = [
          `${import.meta.env.BASE_URL}punch.mp3`,
          `${import.meta.env.BASE_URL}scratchfail.wav`,
        ]
        const sectionImports = [
          () => import('./components/Section1.jsx'),
          () => import('./components/Section2.jsx'),
          () => import('./components/Section3.jsx'),
          () => import('./components/Section4.jsx'),
        ]
        // Imágenes dinámicas de Work
        const workUrls = (typeof getWorkImageUrls === 'function') ? (getWorkImageUrls() || []) : []

        // GLB via loader (cache de drei)
        glbList.forEach((url) => addTask(() => Promise.resolve().then(() => useGLTF.preload(url))))
        // HDR
        hdrList.forEach((url) => addTask(() => fetch(url, { cache: 'force-cache' }).then((r) => r.blob())))
        // Módulos de secciones
        sectionImports.forEach((fn) => addTask(() => fn()))
        // Imágenes
        const loadImg = (u, ms = 8000) => new Promise((resolve) => {
          const img = new Image()
          let finished = false
          const finish = () => { if (!finished) { finished = true; resolve(true) } }
          const t = setTimeout(finish, ms)
          img.onload = () => { clearTimeout(t); finish() }
          img.onerror = () => { clearTimeout(t); finish() }
          img.src = u
        })
        imageList.forEach((u) => addTask(() => loadImg(u)))
        workUrls.forEach((u) => addTask(() => loadImg(u)))
        // SFX (por util y además cache HTTP directa)
        addTask(() => Promise.resolve().then(() => preloadSfx(fxList)))
        fxList.forEach((name) => addTask(() => fetch(`${import.meta.env.BASE_URL}fx/${name}.wav`, { cache: 'force-cache' }).then((r) => r.blob())))
        // Otros audios
        otherAudio.forEach((u) => addTask(() => fetch(u, { cache: 'force-cache' }).then((r) => r.blob())))
        // Canciones: manifest + archivos
        // Primero el manifest (no prefetch de archivos); tracks se cargarán on‑demand
        addTask(() => fetch(`${import.meta.env.BASE_URL}songs/manifest.json`, { cache: 'no-cache' }).then((r) => r.json()).then(() => {}))

        await Promise.all(tasks)
        if (!cancelled) setBootAllDone(true)
      } catch {
        if (!cancelled) setBootAllDone(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Cerrar preloader y disparar animación HOME cuando TODO + personaje listos + audio desbloqueado
  useEffect(() => {
    if (!bootAllDone || !audioReady) return
    if (preloaderStartedRef.current) return
    preloaderStartedRef.current = true
    setBootProgress(100)
    const t = setTimeout(() => {
      // Cubrir con negro antes de apagar el preloader para evitar T-pose visible
      setBlackoutVisible(true)
      setPreloaderFadingOut(true)
      setNavTarget('home')
      // Esperar 1000ms para desvanecer el preloader antes de desmontarlo
      setTimeout(() => {
        setBootLoading(false)
        setPreloaderFadingOut(false)
      }, 1000)
    }, 180)
    return () => clearTimeout(t)
  }, [bootAllDone, audioReady])
  // Custom scrollbar (Work sections): dynamic thumb + drag support + snap buttons
  const scrollTrackRef = useRef(null)
  const [scrollThumb, setScrollThumb] = useState({ height: 12, top: 0 })
  const isDraggingThumbRef = useRef(false)
  const snapTimerRef = useRef(null)
  const snapInProgressRef = useRef(false)
  const controlledScrollRef = useRef(false)

  const updateScrollbarFromScroll = React.useCallback(() => {
    try {
      const scroller = sectionScrollRef.current
      const track = scrollTrackRef.current
      if (!scroller || !track) return
      const trackRect = track.getBoundingClientRect()
      const trackH = Math.max(0, Math.round(trackRect.height))
      const sh = Math.max(1, scroller.scrollHeight || 1)
      const ch = Math.max(1, scroller.clientHeight || 1)
      const maxScroll = Math.max(1, sh - ch)
      const ratioVisible = Math.max(0, Math.min(1, ch / sh))
      const thumbH = Math.max(12, Math.round(trackH * ratioVisible))
      const ratioTop = Math.max(0, Math.min(1, (scroller.scrollTop || 0) / maxScroll))
      const top = Math.round((trackH - thumbH) * ratioTop)
      setScrollThumb((t) => (t.height !== thumbH || t.top !== top ? { height: thumbH, top } : t))
    } catch {}
  }, [])

  // Detect mobile viewport to avoid positioning offsets that break centering
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(Boolean(mql.matches))
    update()
    try { mql.addEventListener('change', update) } catch { window.addEventListener('resize', update) }
    return () => { try { mql.removeEventListener('change', update) } catch { window.removeEventListener('resize', update) } }
  }, [])

  // Mantener oculto por defecto en mobile; visible sólo cuando el usuario lo abre
  useEffect(() => {
    if (isMobile) setShowMusic(false)
  }, [isMobile])

  useEffect(() => {
    // Recompute on layout/resize and when section UI toggles
    const onResize = () => updateScrollbarFromScroll()
    window.addEventListener('resize', onResize)
    const t = setTimeout(updateScrollbarFromScroll, 80)
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t) }
  }, [updateScrollbarFromScroll, showSectionUi])

  // Snap helper for Work section: center nearest card
  const snapToWorkCard = React.useCallback((dir) => {
    try {
      if (section !== 'section1') return
      const scroller = sectionScrollRef.current
      if (!scroller) return
      const cards = Array.from(scroller.querySelectorAll('[data-work-card]'))
      if (!cards.length) return
      const sRect = scroller.getBoundingClientRect()
      const viewCenter = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2
      const centers = cards.map((el) => {
        const r = el.getBoundingClientRect()
        return (scroller.scrollTop || 0) + (r.top - sRect.top) + (r.height / 2)
      })
      let targetCenter = null
      if (dir === 'next') {
        targetCenter = centers.find((c) => c > viewCenter + 1)
        if (targetCenter == null) targetCenter = centers[0] // wrap to first
      } else if (dir === 'prev') {
        for (let i = centers.length - 1; i >= 0; i--) { if (centers[i] < viewCenter - 1) { targetCenter = centers[i]; break } }
        if (targetCenter == null) targetCenter = centers[centers.length - 1] // wrap to last
      }
      if (targetCenter == null) return
      const targetScroll = Math.max(0, Math.round(targetCenter - (scroller.clientHeight || 0) / 2))
      scroller.scrollTo({ top: targetScroll, behavior: 'smooth' })
    } catch {}
  }, [section])

  const snapToAdjacentCard = React.useCallback((dir) => {
    try {
      if (section !== 'section1') return
      const scroller = sectionScrollRef.current
      if (!scroller) return
      const cards = Array.from(scroller.querySelectorAll('[data-work-card]'))
      if (!cards.length) return
      const sRect = scroller.getBoundingClientRect()
      const viewCenter = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2
      let nearestIdx = 0
      let bestD = Infinity
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect()
        const c = (scroller.scrollTop || 0) + (r.top - sRect.top) + (r.height / 2)
        const d = Math.abs(c - viewCenter)
        if (d < bestD) { bestD = d; nearestIdx = i }
      }
      const step = dir === 'prev' ? -1 : 1
      const targetIdx = (nearestIdx + step + cards.length) % cards.length
      const targetEl = cards[targetIdx]
      const r = targetEl.getBoundingClientRect()
      const c = (scroller.scrollTop || 0) + (r.top - sRect.top) + (r.height / 2)
      const targetScroll = Math.max(0, Math.round(c - (scroller.clientHeight || 0) / 2))
      controlledScrollRef.current = true
      scroller.scrollTo({ top: targetScroll, behavior: 'smooth' })
      setTimeout(() => { controlledScrollRef.current = false }, 450)
    } catch {}
  }, [section])

  // Snap to nearest card in Work when scroll stops
  const snapToNearestWorkCard = React.useCallback(() => {
    try {
      if (section !== 'section1') return
      const scroller = sectionScrollRef.current
      if (!scroller) return
      const cards = Array.from(scroller.querySelectorAll('[data-work-card]'))
      if (!cards.length) return
      const sRect = scroller.getBoundingClientRect()
      const viewCenter = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2
      let best = { d: Infinity, c: null }
      for (const el of cards) {
        const r = el.getBoundingClientRect()
        const c = (scroller.scrollTop || 0) + (r.top - sRect.top) + (r.height / 2)
        const d = Math.abs(c - viewCenter)
        if (d < best.d) best = { d, c }
      }
      if (best.c == null) return
      // Snap suave: si muy cerca, no ajustes; si lejos, smooth scroll
      const delta = best.c - viewCenter
      if (Math.abs(delta) < 26) return
      snapInProgressRef.current = true
      const targetScroll = Math.max(0, Math.round(best.c - (scroller.clientHeight || 0) / 2))
      scroller.scrollTo({ top: targetScroll, behavior: 'smooth' })
      // Liberar flag tras breve tiempo
      setTimeout(() => { snapInProgressRef.current = false }, 340)
    } catch {}
  }, [section])

  // Dragging the thumb
  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingThumbRef.current) return
      try {
        const scroller = sectionScrollRef.current
        const track = scrollTrackRef.current
        if (!scroller || !track) return
        const rect = track.getBoundingClientRect()
        const trackH = Math.max(1, rect.height)
        const clientY = (e.touches && e.touches[0] ? e.touches[0].clientY : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : (e.clientY || 0)))
        const pos = Math.max(0, Math.min(trackH, clientY - rect.top))
        const sh = Math.max(1, scroller.scrollHeight || 1)
        const ch = Math.max(1, scroller.clientHeight || 1)
        const maxScroll = Math.max(1, sh - ch)
        const thumbH = Math.max(12, Math.round(trackH * Math.max(0, Math.min(1, ch / sh))))
        const ratio = Math.max(0, Math.min(1, (pos - thumbH / 2) / Math.max(1, trackH - thumbH)))
        const nextTop = Math.round((trackH - thumbH) * ratio)
        setScrollThumb((t) => (t.height !== thumbH || t.top !== nextTop ? { height: thumbH, top: nextTop } : t))
        scroller.scrollTop = Math.round(maxScroll * ratio)
        if (e.cancelable) e.preventDefault()
      } catch {}
    }
    const onUp = () => { isDraggingThumbRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mouseleave', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    window.addEventListener('touchcancel', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mouseleave', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('touchcancel', onUp)
    }
  }, [])
  const sectionLabel = useMemo(() => ({
    home: t('nav.home'),
    section1: t('nav.section1'),
    section2: t('nav.section2'),
    section3: t('nav.section3'),
    section4: t('nav.section4'),
  }), [t, lang])

  // Medir altura de la nav inferior para posicionar CTA a +40px de separación
  const navRef = useRef(null)
  const [navHeight, setNavHeight] = useState(0)
  const [navBottomOffset, setNavBottomOffset] = useState(0)
  const musicBtnRef = useRef(null)
  const [musicPos, setMusicPos] = useState({ left: 0, bottom: 0 })
  const navInnerRef = useRef(null)
  const navBtnRefs = useRef({})
  const [navHover, setNavHover] = useState({ left: 0, width: 0, visible: false })
  const [pageHidden, setPageHidden] = useState(false)
  // Medir altura del marquee para empujar contenido de secciones y posicionar botón salir
  const marqueeRef = useRef(null)
  const [marqueeHeight, setMarqueeHeight] = useState(0)
  useEffect(() => {
    const measure = () => {
      try {
        const rect = navRef.current ? navRef.current.getBoundingClientRect() : null
        const isHidden = !rect || !isFinite(rect.height) || rect.height <= 0 || !isFinite(rect.bottom)
        if (isHidden) {
          setNavHeight(0)
          setNavBottomOffset(0)
          return
        }
        const h = Math.round(rect.height)
        setNavHeight(h || 0)
        const off = Math.round((window.innerHeight || rect.bottom) - rect.bottom)
        setNavBottomOffset(Math.max(0, off) || 0)
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

  // Pausar animaciones en background
  useEffect(() => {
    const onVis = () => {
      try { setPageHidden(document.visibilityState === 'hidden') } catch { setPageHidden(false) }
    }
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Watchdog de memoria/VRAM: degradación suave sin pausar audio
  useEffect(() => {
    const tick = () => {
      try {
        const info = glRef.current?.info?.memory
        const heap = (typeof performance !== 'undefined' && performance.memory) ? performance.memory.usedJSHeapSize : 0
        const heapMB = heap ? Math.round(heap / (1024 * 1024)) : 0
        // Umbrales conservadores
        const textures = info?.textures || 0
        const geometries = info?.geometries || 0
        const shouldDegrade = (heapMB > 900) || (textures > 3500) || (geometries > 2500)
        setDegradedMode((prev) => prev || shouldDegrade)
      } catch {}
    }
    const id = window.setInterval(tick, 60000)
    return () => window.clearInterval(id)
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

  // Medir ancho de scrollbar del contenedor de secciones y reservar espacio para overlays (marquee/parallax)
  useEffect(() => {
    const measureSb = () => {
      try {
        const el = sectionScrollRef.current
        if (!el) { setScrollbarW(0); return }
        const w = Math.max(0, (el.offsetWidth || 0) - (el.clientWidth || 0))
        setScrollbarW(w)
      } catch { setScrollbarW(0) }
    }
    measureSb()
    window.addEventListener('resize', measureSb)
    return () => window.removeEventListener('resize', measureSb)
  }, [showSectionUi])

  // Infinite scroll feel for Work: when near ends, wrap to opposite end seamlessly
  const ensureInfiniteScroll = React.useCallback(() => {
    try {
      if (section !== 'section1') return
      if (controlledScrollRef.current) return
      const scroller = sectionScrollRef.current
      if (!scroller) return
      const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight)
      const t = scroller.scrollTop || 0
      const margin = Math.max(80, Math.round(scroller.clientHeight * 0.25))
      if (t < margin) {
        // near top -> jump near bottom keeping relative offset
        const newTop = Math.max(0, max - (scroller.clientHeight - t))
        scroller.scrollTop = newTop
      } else if (t > max - margin) {
        // near bottom -> jump near top keeping relative offset
        const newTop = Math.max(0, (t - (max - margin)))
        scroller.scrollTop = newTop
      }
    } catch {}
  }, [section])

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

  // Preload SFX básicos para Nav
  React.useEffect(() => {
    try { preloadSfx(['hover', 'click']) } catch {}
  }, [])

  // Cargar manifest de canciones
  React.useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}songs/manifest.json`, { cache: 'no-cache' })
        const json = await res.json()
        let arr = Array.isArray(json) ? json.slice() : []
        const target = 'songs/Skulley Rad - Speaking in public (The last act of Skulley Rad).mp3'
        const idx = arr.findIndex((t) => (t?.src || '').toLowerCase() === target.toLowerCase())
        if (idx > 0) {
          const speaking = { ...arr[idx] }
          arr.splice(idx, 1)
          arr = [speaking, ...arr]
        }
        if (!canceled) setTracks(arr)
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
      // Ocultar CTA sin animación y limpiar timers al volver a HOME
      try { if (ctaHideTimerRef.current) { clearTimeout(ctaHideTimerRef.current); ctaHideTimerRef.current = null } } catch {}
      setShowCta(false)
      setCtaAnimatingOut(false)
      setCtaLoading(false)
      setCtaProgress(0)
      // Fuerza antirebote: ocultar CTA por unos ms tras aterrizar en HOME para evitar flash
      setCtaForceHidden(true)
      try { if (ctaForceTimerRef.current) clearTimeout(ctaForceTimerRef.current) } catch {}
      ctaForceTimerRef.current = window.setTimeout(() => { setCtaForceHidden(false); ctaForceTimerRef.current = null }, 600)
      setTintFactor(0)
      try { if (mainControlsRef.current) mainControlsRef.current.enabled = true } catch {}
      // Revelar poco después para que se vea la caída del personaje
      setTimeout(() => setBlackoutVisible(false), 80)
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
    if (transitionState.active || blackoutVisible) {
      if (showCta) { setShowCta(false); setCtaAnimatingOut(false) }
      return
    }
    const activeId = nearPortalId || uiHintPortalId
    if (activeId && !ctaForceHidden && !blackoutVisible) {
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
  }, [nearPortalId, uiHintPortalId, transitionState.active, showCta, ctaForceHidden, blackoutVisible])

  // Si hay blackout (salida a HOME o transiciones), ocultar CTA de inmediato sin animación
  React.useEffect(() => {
    if (blackoutVisible) {
      setShowCta(false)
      setCtaAnimatingOut(false)
    }
  }, [blackoutVisible])

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
    // Si estamos en transición activa hacia una sección (CTA o navegación normal), mantener marquee visible con label destino
    if (((transitionState.active && transitionState.to && transitionState.to !== 'home')
      || (ctaLoading && transitionState.to && transitionState.to !== 'home'))) {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(transitionState.to)
      return
    }
    // Puente entre fin de transición y montaje de UI de sección: si ya estamos en una sección, mantener visible
    if (section !== 'home') {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(section)
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

  // Evitar re-entrada innecesaria: animar solo cuando cambia de hidden -> visible
  const prevShowMarqueeRef = useRef(showMarquee)
  React.useEffect(() => {
    if (prevShowMarqueeRef.current !== showMarquee) {
      if (showMarquee) {
        setMarqueeAnimateIn(true)
        if (marqueeAnimTimerRef.current) { clearTimeout(marqueeAnimTimerRef.current); marqueeAnimTimerRef.current = null }
        marqueeAnimTimerRef.current = setTimeout(() => { setMarqueeAnimateIn(false); marqueeAnimTimerRef.current = null }, 220)
      } else {
        setMarqueeAnimateIn(false)
        if (marqueeAnimTimerRef.current) { clearTimeout(marqueeAnimTimerRef.current); marqueeAnimTimerRef.current = null }
      }
      prevShowMarqueeRef.current = showMarquee
    }
    return () => {
      // cleanup on unmount
      if (marqueeAnimTimerRef.current) { clearTimeout(marqueeAnimTimerRef.current); marqueeAnimTimerRef.current = null }
    }
  }, [showMarquee])

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
      {!bootLoading && (
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, degradedMode ? 1.2 : (isMobilePerf ? 1.2 : 1.5)]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, preserveDrawingBuffer: false }}
        camera={{ position: [0, 3, 8], fov: 60, near: 0.1, far: 120 }}
        events={undefined}
        onCreated={({ gl }) => {
          // Pre-warm shaders/pipelines to avoid first interaction jank
          try {
            gl.getContextAttributes()
          } catch {}
          glRef.current = gl
          // Ensure canvas covers viewport but respects scrollbar gutter when sections are open
          try {
            const el = gl.domElement
            el.style.position = 'fixed'
            el.style.top = '0'
            el.style.left = '0'
            el.style.bottom = '0'
            el.style.right = '0'
            // WebGL context lost/restored handlers
            const onLost = (e) => { try { e.preventDefault() } catch {} }
            const onRestored = () => { try { /* no-op; R3F will recover */ } catch {} }
            el.addEventListener('webglcontextlost', onLost, { passive: false })
            el.addEventListener('webglcontextrestored', onRestored)
          } catch {}
        }}
      >
        <Suspense fallback={null}>
          <AdaptiveDpr pixelated />
          <PauseFrameloop paused={(((showSectionUi || sectionUiAnimatingOut) && !transitionState.active) || pageHidden)} />
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
            onCharacterReady={() => { setCharacterReady(true) }}
            onHomeFallStart={() => {
              // Durante toda la caída a HOME, bloquear cualquier CTA/marquee
              setCtaForceHidden(true)
              setShowCta(false)
              setCtaAnimatingOut(false)
              setShowMarquee(false)
              setMarqueeAnimatingOut(false)
              setNearPortalId(null)
              setUiHintPortalId(null)
              if (blackoutVisible) {
                setBlackoutImmediate(false)
                setBlackoutVisible(false)
              }
            }}
            onReachedPortal={(id) => {
              // Guardar último portal alcanzado y detener navegación
              try { lastPortalIdRef.current = id } catch {}
              if (id && id !== 'home') {
                try { setMarqueeLabelSection(id) } catch {}
              }
              setNavTarget(null)
            }}
            onOrbStateChange={(active) => setOrbActiveUi(active)}
            onMoveStateChange={(moving) => {
              try { setPlayerMoving(moving) } catch {}
            }}
            onHomeSplash={() => {
              // Mostrar marquee 4s tras splash en HOME
              // Mostrar HOME como indicador al aterrizar
              if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null }
              setMarqueeLabelSection('home')
              setShowMarquee(true)
              setMarqueeAnimatingOut(false)
              setMarqueeForceHidden(false)
              setLandingBannerActive(true)
              // Revelar ahora (inicio animación HOME)
              if (blackoutVisible) setTimeout(() => setBlackoutVisible(false), 80)
              // Mantener forzado oculto el CTA durante el banner de aterrizaje
              setCtaForceHidden(true)
              try { if (ctaForceTimerRef.current) clearTimeout(ctaForceTimerRef.current) } catch {}
              ctaForceTimerRef.current = setTimeout(() => { setCtaForceHidden(false); ctaForceTimerRef.current = null }, 1400)
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
            shakeActive={(eggActive || Boolean(nearPortalId)) && !playerMoving}
            shakeAmplitude={eggActive ? 0.18 : 0.08}
            shakeFrequencyX={eggActive ? 22.0 : 14.0}
            shakeFrequencyY={eggActive ? 18.0 : 12.0}
            shakeYMultiplier={eggActive ? 1.0 : 0.9}
            enabled={!showSectionUi && !sectionUiAnimatingOut}
            followBehind={isMobile}
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
            maxOpacity={1}
          />
        </Suspense>
      </Canvas>
      )}

      {/* Preloader overlay global */}
      {bootLoading && (
        <div className="fixed inset-0 z-[20000] bg-[#0a0f22] text-white" role="dialog" aria-modal="true" style={{ opacity: preloaderFadingOut ? 0 : 1, transition: 'opacity 1000ms ease' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full">
            {/* Izquierda: personaje caminando (oculto en mobile) */}
            <div className="hidden md:block relative overflow-hidden">
              <div className="absolute inset-0">
                <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.6, 4], fov: 55, near: 0.1, far: 120 }} gl={{ antialias: false, powerPreference: 'high-performance', alpha: true }}>
                  {/* Escenario como en la escena principal (HDRI + fog/color) sin luces */}
                  <Environment overrideColor={effectiveSceneColor} lowPerf={isMobilePerf} noAmbient />
                  {/* Ancla para God Rays en preloader */}
                  {fx.godEnabled && (
                    <mesh ref={preSunRef} position={[0, 8, 0]}> 
                      <sphereGeometry args={[0.35, 12, 12]} />
                      <meshBasicMaterial color={'#ffffff'} transparent opacity={0} depthWrite={false} />
                    </mesh>
                  )}
                  <PreloaderCharacterWalk playerRef={preloaderPlayerRef} />
                  {/* Luz puntual editable (pin light) con UI y botón copiar */}
                  <PreloaderPinLight playerRef={preloaderPlayerRef} />
                  {!preOrbitPaused && (
                  <PreloaderOrbit
                    playerRef={preloaderPlayerRef}
                    outHeadRef={preloaderHeadRef}
                    radius={6.2}
                    startRadius={9.0}
                    rampMs={1400}
                    speed={0.18}
                    targetOffsetY={1.6}
                    startDelayMs={1200}
                  />)}
                  {/* Postprocesado igual al de la escena principal */}
                  <PostFX
                    lowPerf={false}
                    eggActiveGlobal={false}
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
                    godSun={preSunRef}
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
                    dofTargetRef={preloaderHeadRef}
                  />
                </Canvas>
              </div>
            </div>
            {/* Derecha: historia + progreso / entrar (centrado full en mobile) */}
            <div className="flex items-center justify-center p-8 col-span-1 md:col-span-1 md:justify-center">
              <div className="w-full max-w-xl text-center md:text-left">
                <h1 className="font-marquee uppercase text-[2.625rem] sm:text-[3.15rem] md:text-[4.2rem] leading-[0.9] tracking-wide mb-4" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.08)' }}>{t('pre.title') || 'SKULLEY RAD, THE LAST DESIGNER OF HUMAN KIND'}</h1>
                <p className="opacity-90 leading-tight mb-6 text-base sm:text-lg" style={{ whiteSpace: 'pre-line' }}>{t('pre.p1') || 'Skulley Rad was a graphic designer who died of the worst disease of this century: creative unemployment. Machines did his job faster, cheaper, and without asking for endless revisions… and well, no one hired him anymore.'}</p>
                <p className="opacity-90 leading-tight mb-6 text-base sm:text-lg" style={{ whiteSpace: 'pre-line' }}>{t('pre.p2') || 'In his honor (and his Illustrator memes that never saw the light), the same machines that left him jobless decided to pay tribute: they built a digital universe from his memories, corrupted files and poorly named layers.'}</p>
                <p className="opacity-90 leading-tight mb-6 text-base sm:text-lg" style={{ whiteSpace: 'pre-line' }}>{t('pre.p3') || 'Today, Skulley Rad exists between bits and pixels, turned into a wandering punk skull from the digital beyond, condemned to live forever in an ironic tribute to the humans who once believed they controlled the machines.'}</p>
                {!bootAllDone && (
                  <div className="mt-2">
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden" aria-hidden>
                      <div className="h-full bg-red-500" style={{ width: `${bootProgress}%`, transition: 'width 160ms ease-out' }} />
                    </div>
                    <div className="mt-2 text-xs opacity-60" aria-live="polite">{bootProgress}%</div>
                  </div>
                )}
                {bootAllDone && (
                  <div className="mt-6 flex flex-col sm:flex-row items-center sm:justify-start gap-3">
                    <button
                      type="button"
                      onClick={() => { setAudioReady(true) }}
                      className="inline-flex items-center justify-center w-full sm:w-auto max-w-xs sm:max-w-none px-6 py-4 sm:px-8 sm:py-4 md:px-10 md:py-5 rounded-full bg-white text-black font-bold uppercase tracking-wide text-lg sm:text-xl md:text-2xl shadow hover:translate-y-[-1px] active:translate-y-0 transition-transform font-marquee"
                      aria-label={t('common.enterWithSound')}
                    >{t('pre.enter')}</button>
                    <div className="inline-flex items-center gap-2" role="group" aria-label={t('common.switchLanguage') || 'Switch language'}>
                      <button
                        type="button"
                        onClick={() => setLang('es')}
                        aria-pressed={lang === 'es'}
                        className={`h-12 px-5 rounded-full text-sm sm:text-base font-bold uppercase tracking-wide border transition-colors ${lang === 'es' ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/60 hover:bg-white/10'}`}
                        title="ESP"
                      >ESP</button>
                      <button
                        type="button"
                        onClick={() => setLang('en')}
                        aria-pressed={lang === 'en'}
                        className={`h-12 px-5 rounded-full text-sm sm:text-base font-bold uppercase tracking-wide border transition-colors ${lang === 'en' ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/60 hover:bg-white/10'}`}
                        title="ENG"
                      >ENG</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showGpu && <GpuStats sampleMs={1000} gl={glRef.current} />}
      {/* Overlay global negro desactivado para no tapar la animación de HOME */}
      {/* Secciones scrolleables con transición suave y fondo por sección */}
      {(showSectionUi || sectionUiAnimatingOut) && (
        <div
          ref={sectionScrollRef}
          className="fixed inset-0 z-[10] overflow-y-auto no-native-scrollbar"
          style={{
            backgroundColor: sectionColors[section] || '#000000',
            opacity: (sectionUiFadeIn && showSectionUi && !sectionUiAnimatingOut) ? 1 : 0,
            transition: 'opacity 500ms ease',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            touchAction: 'pan-y',
          }}
          onScroll={(e) => {
            try {
              const el = e.currentTarget
              const max = Math.max(1, el.scrollHeight - el.clientHeight)
              setSectionScrollProgress(el.scrollTop / max)
              updateScrollbarFromScroll()
              ensureInfiniteScroll()
              // Debounce para snap tras detenerse el scroll
              if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
              snapTimerRef.current = setTimeout(() => {
                if (!snapInProgressRef.current) snapToNearestWorkCard()
              }, 240)
            } catch {}
          }}
          data-section-scroll
        >
          <div className="min-h-screen w-full" style={{ paddingTop: `${marqueeHeight}px`, overscrollBehavior: 'contain' }}>
            <Suspense fallback={null}>
              <div className="relative max-w-5xl mx-auto px-6 sm:px-8 pt-6 pb-12">
                {section === 'section1' && <Section1 scrollerRef={sectionScrollRef} scrollbarOffsetRight={scrollbarW} />}
                {section === 'section2' && <Section2 />}
                {section === 'section3' && <Section3 />}
                {section === 'section4' && <Section4 />}
              </div>
            </Suspense>
          </div>
          {/* Minimal nav overlay (prev/next only) */}
          {section === 'section1' && (
            <div className="pointer-events-auto fixed top-1/2 -translate-y-1/2 z-[12020] hidden sm:flex flex-col items-center gap-3 select-none"
              onWheel={(e) => {
                try { sectionScrollRef.current?.scrollBy({ top: e.deltaY, behavior: 'auto' }) } catch {}
              }}
              onClick={(e) => e.stopPropagation()}
              aria-hidden
              style={{ right: `${(scrollbarW || 0) + 40}px` }}>
              <button
                type="button"
                className="grid place-items-center w-12 h-12 rounded-full bg-black text-white shadow hover:bg-black/90 active:scale-[0.98] transition-transform"
                aria-label="Anterior (arriba)"
                onClick={() => snapToAdjacentCard('prev')}
              >
                <ChevronUpIcon className="w-6 h-6" />
              </button>
              <button
                type="button"
                className="grid place-items-center w-12 h-12 rounded-full bg-black text-white shadow hover:bg-black/90 active:scale-[0.98] transition-transform"
                aria-label="Siguiente (abajo)"
                onClick={() => snapToAdjacentCard('next')}
              >
                <ChevronDownIcon className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* CTA: Cruza el portal (aparece cuando el jugador está cerca del portal) */}
      {(
        (showCta || ctaAnimatingOut || ctaLoading)
        && (!transitionState.active || ctaLoading)
        && !ctaForceHidden
        && !blackoutVisible
        && (((section === 'home') && !showSectionUi && !sectionUiAnimatingOut) || ctaLoading)
      ) && (
        <div
          className={`pointer-events-none fixed z-[300] ${isMobile ? 'inset-0 grid place-items-center' : 'inset-x-0 flex items-start justify-center pt-2'}`}
          style={isMobile ? undefined : { bottom: `${Math.max(0, (navHeight || 0) + (navBottomOffset || 0) + 30)}px` }}
        >
          <button
            type="button"
            onClick={async () => {
              try { playSfx('click', { volume: 1.0 }) } catch {}
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
              // Preload assets críticos de la sección (imágenes de Work), si aplica
              try {
                if (target === 'section1') {
                  const urls = (typeof getWorkImageUrls === 'function') ? getWorkImageUrls() : []
                  // Ya usamos 6 placeholders; mantener subset por seguridad
                  const subset = urls.slice(0, 6)
                  const loadWithTimeout = (u, ms = 2000) => new Promise((resolve) => {
                    const img = new Image()
                    let done = false
                    const finish = (ok) => { if (!done) { done = true; resolve(ok) } }
                    const t = setTimeout(() => finish(false), ms)
                    img.onload = () => { clearTimeout(t); finish(true) }
                    img.onerror = () => { clearTimeout(t); finish(false) }
                    img.src = u
                  })
                  await Promise.all(subset.map((u) => loadWithTimeout(u)))
                }
              } catch {}
              // completar barra a 100% antes de iniciar transición
              setCtaProgress(100)
              try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch {}
              // Ocultar CTA justo al finalizar la animación visual del preload
              // (la "barra" tiene transition de 150ms)
              window.setTimeout(() => {
                setCtaLoading(false)
              }, 180)
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
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className="pointer-events-auto relative overflow-hidden px-6 py-3 sm:px-10 sm:py-4 md:px-12 md:py-5 rounded-full bg-white text-black font-bold uppercase tracking-wide text-lg sm:text-3xl md:text-4xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:translate-y-[-2px] active:translate-y-[0] transition-transform font-marquee sm:scale-150"
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
            <span className="relative z-[10]">{t('cta.crossPortal')}</span>
          </button>
        </div>
      )}

      {/* Marquee de título de sección (solo visible en HOME) */}
      {(showMarquee || marqueeAnimatingOut) && (
        <div
          ref={marqueeRef}
          className="fixed top-0 left-0 right-0 z-[20] pointer-events-none pt-0 pb-2"
          style={{ animation: `${(marqueeAnimateIn ? 'slidedown 200ms ease-out' : (marqueeAnimatingOut ? 'slidedown-out 200ms ease-in forwards' : 'none'))}`, right: `${scrollbarW}px` }}
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

      {/* Botón cerrar se renderiza dentro de CharacterPortrait para posicionarlo con precisión sobre el retrato */}
      {/* Toggle panel FX */}
      {!showSectionUi && (
      <button
        type="button"
        onClick={() => setShowFxPanel((v) => !v)}
        className="pointer-events-auto fixed right-4 top-16 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md z-[15000]"
        aria-label={t('a11y.toggleFx')}
      >FX</button>
      )}
      {/* Toggle Music Player (movido a la nav principal) */}
      {/* Toggle GPU Stats */}
      {!showSectionUi && (
      <button
        type="button"
        onClick={() => setShowGpu((v) => !v)}
        className="pointer-events-auto fixed right-4 top-28 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md z-[15000] transition-transform hover:translate-y-[-1px]"
        aria-label={t('a11y.toggleGpu')}
      >GPU</button>
      )}
      {/* Floating music + hamburger (≤960px) */}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[16000] hidden max-[960px]:flex flex-col items-end gap-3">
        <button
          type="button"
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setShowMusic((v) => !v) }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          className={`pointer-events-auto h-12 w-12 rounded-full grid place-items-center shadow-md transition-colors ${showMusic ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
          aria-pressed={showMusic ? 'true' : 'false'}
          aria-label="Toggle music player"
          title={showMusic ? t('common.hidePlayer') : t('common.showPlayer')}
          style={{ marginRight: `${(scrollbarW || 0)}px` }}
        >
          <MusicalNoteIcon className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setMenuOpen((v) => !v) }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          className="pointer-events-auto h-12 w-12 rounded-full bg-white/95 text-black grid place-items-center shadow-md"
          aria-expanded={menuOpen ? 'true' : 'false'}
          aria-controls="nav-overlay"
          aria-label="Open navigation menu"
          style={{ marginRight: `${(scrollbarW || 0)}px` }}
        >
          <Bars3Icon className="w-7 h-7" />
        </button>
      </div>

      {/* Desktop nav (>960px) */}
      <div ref={navRef} className="pointer-events-auto fixed inset-x-0 bottom-10 z-[450] hidden min-[961px]:flex items-center justify-center">
        <div ref={navInnerRef} className="relative bg-white/95 backdrop-blur rounded-full shadow-lg p-2.5 flex items-center gap-0 overflow-hidden">
          <div
            className={`absolute rounded-full bg-black/10 transition-all duration-200 ${navHover.visible ? 'opacity-100' : 'opacity-0'}`}
            style={{ left: `${navHover.left}px`, width: `${navHover.width}px`, top: '10px', bottom: '10px' }}
          />
          {['section1','section2','section3','section4'].map((id) => (
            <button
              key={id}
              type="button"
              ref={(el) => { if (el) navBtnRefs.current[id] = el }}
              onMouseEnter={(e) => { updateNavHighlightForEl(e.currentTarget); try { playSfx('hover', { volume: 0.9 }) } catch {} }}
              onFocus={(e) => updateNavHighlightForEl(e.currentTarget)}
              onMouseLeave={() => setNavHover((h) => ({ ...h, visible: false }))}
              onBlur={() => setNavHover((h) => ({ ...h, visible: false }))}
              onClick={() => {
                try { playSfx('click', { volume: 1.0 }) } catch {}
                if (showSectionUi) {
                  if (!transitionState.active && id !== section) {
                    setTransitionState({ active: true, from: section, to: id })
                    setPortraitGlowV((v) => v + 1)
                    // Fallback inmediato por si el overlay no completa
                    setSection(id)
                    try { syncUrl(id) } catch {}
                    window.setTimeout(() => {
                      setTransitionState((s) => (s.active ? { active: false, from: id, to: null } : s))
                    }, 900)
                  }
                } else {
                  if (!orbActiveUi) { setNavTarget(id); setPortraitGlowV((v) => v + 1) }
                }
              }}
              className="relative z-[1] px-2.5 py-2.5 rounded-full bg-transparent text-black text-base sm:text-lg font-marquee uppercase tracking-wide"
            >{sectionLabel[id]}</button>
          ))}
          {/* Language switch */}
          <div className="mx-1 h-7 w-px bg-black/10" />
          <button
            type="button"
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            onMouseEnter={(e) => { updateNavHighlightForEl(e.currentTarget); try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            onFocus={(e) => updateNavHighlightForEl(e.currentTarget)}
            onMouseLeave={() => setNavHover((h) => ({ ...h, visible: false }))}
            onBlur={() => setNavHover((h) => ({ ...h, visible: false }))}
            className="relative z-[1] px-2.5 py-2.5 rounded-full bg-transparent text-black text-base sm:text-lg font-marquee uppercase tracking-wide"
            aria-label="Switch language"
            title="Switch language"
          >{lang === 'es' ? 'ESP' : 'ENG'}</button>
          <button
            type="button"
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setShowMusic((v) => !v) }}
            ref={musicBtnRef}
            onMouseEnter={(e) => { updateNavHighlightForEl(e.currentTarget); try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            onFocus={(e) => updateNavHighlightForEl(e.currentTarget)}
            onMouseLeave={() => setNavHover((h) => ({ ...h, visible: false }))}
            onBlur={() => setNavHover((h) => ({ ...h, visible: false }))}
            className={`relative z-[1] px-2.5 py-2.5 rounded-full grid place-items-center transition-colors ${showMusic ? 'bg-black text-white' : 'bg-transparent text-black'}`}
            aria-pressed={showMusic ? 'true' : 'false'}
            aria-label="Toggle music player"
            title={showMusic ? t('common.hidePlayer') : t('common.showPlayer')}
          >
            <MusicalNoteIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Overlay menu */}
      {menuOpen && (
        <div
          id="nav-overlay"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[14000] flex items-center justify-center"
          onClick={() => setMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative pointer-events-auto grid gap-10 w-full max-w-3xl px-8 place-items-center">
            {['section1','section2','section3','section4'].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  try { playSfx('click', { volume: 1.0 }) } catch {}
                  setMenuOpen(false)
                  if (showSectionUi) {
                    if (!transitionState.active && id !== section) {
                      setTransitionState({ active: true, from: section, to: id })
                      setPortraitGlowV((v) => v + 1)
                      // Fallback inmediato por si el overlay no completa
                      setSection(id)
                      try { syncUrl(id) } catch {}
                      window.setTimeout(() => {
                        setTransitionState((s) => (s.active ? { active: false, from: id, to: null } : s))
                      }, 900)
                    }
                  } else {
                    if (!orbActiveUi) { setNavTarget(id); setPortraitGlowV((v) => v + 1) }
                  }
                }}
                className="text-center text-white font-marquee uppercase leading-[0.9] tracking-wide text-[clamp(40px,10vw,96px)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >{sectionLabel[id]}</button>
            ))}
          </div>
        </div>
      )}
      {/* Single Music Player instance always mounted
          - Mobile: modal centered with backdrop when showMusic; hidden when not
          - Desktop: panel bottom-right; fades in/out but never blocks page when hidden
      */}
      <div className={`fixed inset-0 z-[14050] sm:z-[900] ${showMusic ? 'grid' : 'hidden'} place-items-center sm:pointer-events-none`} role="dialog" aria-modal="true">
        {/* Mobile overlay backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm sm:hidden transition-opacity ${showMusic ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setShowMusic(false)}
        />
        {/* Positioner: centered on mobile; fixed bottom-right on desktop */}
        <div
          className={`relative pointer-events-auto sm:fixed transition-all duration-200 ${showMusic ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'} `}
          onClick={(e) => e.stopPropagation()}
          style={isMobile ? undefined : { right: `${(scrollbarW || 0) + 40}px`, bottom: '40px' }}
        >
          <MusicPlayer tracks={tracks} navHeight={navHeight} autoStart={audioReady} pageHidden={pageHidden} />
        </div>
      </div>
      {/* Panel externo para ajustar postprocesado */}
      {showFxPanel && (
      <div className="pointer-events-auto fixed right-4 top-28 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none z-[500]">
        <div className="text-xs font-semibold opacity-80">{t('fx.title')}</div>
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
        >{copiedFx ? t('common.copied') : t('fx.copyPreset')}</button>
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
      >{t('a11y.toggleLight')}</button>
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
        >{t('light.copyPreset')}</button>
        <div className="text-xs font-semibold opacity-80">{t('light.top.title')}</div>
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
        <div className="h-px bg-white/10 my-2" />
        <div className="text-xs font-semibold opacity-80">Preloader Light</div>
        <button
          type="button"
          className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
          onClick={async () => {
            const preset = JSON.stringify({ intensity: topLight.intensity, angle: topLight.angle, penumbra: topLight.penumbra, relativeFactor: 0.4 }, null, 2)
            try { await navigator.clipboard.writeText(preset) } catch {
              const ta = document.createElement('textarea'); ta.value = preset; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
            }
          }}
        >{t('pre.copyLightPreset') || 'Copy Preloader preset'}</button>
        <button
          type="button"
          className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
          onClick={async () => {
            try {
              // eslint-disable-next-line no-underscore-dangle
              const pos = (window.__preLightPos || []).map((v) => Number(v))
              // eslint-disable-next-line no-underscore-dangle
              const tgt = (window.__preLightTarget || []).map((v) => Number(v))
              const payload = JSON.stringify({ position: pos, target: tgt }, null, 2)
              await navigator.clipboard.writeText(payload)
            } catch {
              const ta = document.createElement('textarea')
              // eslint-disable-next-line no-underscore-dangle
              const payload = JSON.stringify({ position: window.__preLightPos || [], target: window.__preLightTarget || [] }, null, 2)
              ta.value = payload
              document.body.appendChild(ta)
              ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
            }
          }}
        >Copiar posición/target</button>
      </div>
      )}
      {/* Portrait del personaje en cápsula, esquina inferior izquierda */}
      {(section !== 'section2') && (
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
        zIndex={600}
        showExit={section !== 'home' && showSectionUi}
        mode={'overlay'}
      />)}
      {/* Joystick móvil: visible solo en mobile, en HOME y cuando el orbe no está activo */}
      {isMobile && section === 'home' && !orbActiveUi ? (
        <MobileJoystick centerX bottomPx={40} radius={52} />
      ) : null}
      {/* Toggle panel Retrato */}
      <button
        type="button"
        onClick={() => setShowPortraitPanel((v) => !v)}
        className="pointer-events-auto fixed right-4 top-40 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md transition-transform hover:translate-y-[-1px]"
        aria-label={t('a11y.togglePortrait')}
      >Ret</button>
      {/* Blackout overlay for smooth/instant fade to black */}
      <div className="fixed inset-0 z-[50000] pointer-events-none" style={{ background: '#000', opacity: blackoutVisible ? 1 : 0, transition: blackoutImmediate ? 'none' : 'opacity 300ms ease' }} />
    </div>
  )
}

// Personaje en el preloader: reproduce animación de caminar en bucle
function PreloaderCharacterWalk({ playerRef }) {
  const { scene, animations } = useGLTF(`${import.meta.env.BASE_URL}character.glb`, true)
  const groupRef = React.useRef()
  const model = React.useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { actions } = useAnimations(animations, model)
  const headRef = React.useRef(null)
  React.useEffect(() => {
    if (!actions) return
    // Buscar clip de caminar
    const names = Object.keys(actions)
    const explicitWalk = 'root|root|Walking'
    const walkName = names.includes(explicitWalk) ? explicitWalk : (names.find((n) => n.toLowerCase().includes('walk')) || names[1] || names[0])
    const idleName = names.find((n) => n.toLowerCase().includes('idle')) || names[0]
    // Asegurar pesos/loop
    if (idleName && actions[idleName]) { try { actions[idleName].stop() } catch {} }
    if (walkName && actions[walkName]) {
      const a = actions[walkName]
      a.reset().setEffectiveWeight(1).setLoop(THREE.LoopRepeat, Infinity).setEffectiveTimeScale(1.1).play()
    }
  }, [actions])
  // Oscilar suavemente en X para simular avance sin desplazarlo del sitio
  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    const sway = Math.sin(t * 1.2) * 0.25
    groupRef.current.position.x = sway
    groupRef.current.rotation.y = Math.sin(t * 0.8) * 0.15
  })
  // encuentra la cabeza y expón referencia global para otras utilidades si hiciera falta
  useEffect(() => {
    if (!model) return
    let found = null
    try { model.traverse((o) => { if (!found && /head/i.test(o?.name || '')) found = o }) } catch {}
    if (!found) {
      try { const box = new THREE.Box3().setFromObject(model); const c = new THREE.Vector3(); box.getCenter(c); found = new THREE.Object3D(); found.position.copy(c); model.add(found) } catch {}
    }
    headRef.current = found
  }, [model])
  return (
    <group ref={(el) => { groupRef.current = el; if (typeof playerRef?.current !== 'undefined') playerRef.current = el }} position={[0, 0, 0]}>
      <primitive object={model} scale={1.6} raycast={null} />
    </group>
  )
}

// Animación de zoom out de la cámara en el preloader
function PreloaderZoom({ to = [0, 3, 8], duration = 1.4 }) {
  const { camera } = useThree()
  const startRef = React.useRef({ pos: camera.position.clone() })
  const t0Ref = React.useRef((typeof performance !== 'undefined' ? performance.now() : Date.now()))
  useFrame(() => {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const t = Math.min(1, (now - t0Ref.current) / (duration * 1000))
    const ease = t * t * (3 - 2 * t)
    const target = new THREE.Vector3().fromArray(to)
    camera.position.lerpVectors(startRef.current.pos, target, ease)
    camera.updateProjectionMatrix()
  })
  return null
}

// Apunta la cámara a la clavícula (buscando un bone por nombre y con fallback por heurística)
function PreloaderAim({ playerRef }) {
  const { camera } = useThree()
  const clavicleRef = React.useRef(null)
  // localizar un hueso de clavícula por nombre común
  useEffect(() => {
    const root = playerRef?.current
    if (!root) return
    let found = null
    try {
      root.traverse((o) => {
        if (found) return
        const n = (o?.name || '').toLowerCase()
        if (/clav|shoulder/i.test(n)) found = o
      })
    } catch {}
    if (!found) {
      // fallback: estimar punto en el pecho a partir de bbox
      try {
        const box = new THREE.Box3().setFromObject(root)
        const size = new THREE.Vector3(); box.getSize(size)
        const center = new THREE.Vector3(); box.getCenter(center)
        found = new THREE.Object3D()
        found.position.copy(center)
        found.position.y = box.max.y - size.y * 0.35
        root.add(found)
      } catch {}
    }
    clavicleRef.current = found
  }, [playerRef])
  useFrame(() => {
    if (!clavicleRef.current) return
    try {
      const target = new THREE.Vector3()
      clavicleRef.current.getWorldPosition(target)
      // Elevar ligeramente el punto objetivo para evitar apuntar a los pies
      target.y += 0.25
      camera.lookAt(target)
    } catch {}
  })
  return null
}

// Órbita lenta de cámara alrededor del personaje tras el zoom inicial
// Órbita tipo turntable: la cámara rodea al personaje manteniendo el rostro (cabeza) en foco
function PreloaderOrbit({ playerRef, outHeadRef, radius = 6.2, startRadius = 9.0, rampMs = 1400, speed = 0.18, targetOffsetY = 1.6, startDelayMs = 1200 }) {
  const { camera } = useThree()
  const startTsRef = React.useRef((typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const headRef = React.useRef(null)
  // localizar cabeza
  useEffect(() => {
    const root = playerRef?.current
    if (!root) return
    let found = null
    try {
      root.traverse((o) => { if (!found && /head/i.test(o?.name || '')) found = o })
    } catch {}
    if (!found) {
      try {
        const box = new THREE.Box3().setFromObject(root)
        const center = new THREE.Vector3(); box.getCenter(center)
        found = new THREE.Object3D(); found.position.copy(center)
        root.add(found)
      } catch {}
    }
    headRef.current = found
    if (outHeadRef && typeof outHeadRef === 'object') outHeadRef.current = found
  }, [playerRef])
  useFrame(() => {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    if (now - startTsRef.current < startDelayMs) return
    const tSec = (now - startTsRef.current - startDelayMs) / 1000
    const ang = tSec * speed
    const head = new THREE.Vector3()
    try { if (headRef.current) headRef.current.getWorldPosition(head); else playerRef?.current?.getWorldPosition(head) } catch {}
    // Interpolar radio desde startRadius a radius (zoom-out orbital controlado)
    const rampT = Math.max(0, Math.min(1, (now - startTsRef.current) / Math.max(1, rampMs)))
    const ease = rampT * rampT * (3 - 2 * rampT)
    const r = THREE.MathUtils.lerp(startRadius, radius, ease)
    const x = head.x + Math.cos(ang) * r
    const z = head.z + Math.sin(ang) * r
    const y = head.y + (targetOffsetY || 0)
    camera.position.set(x, y, z)
    camera.lookAt(head.x, head.y + (targetOffsetY || 0), head.z)
  })
  return null
}

// Luz editable dedicada al preloader (no sigue al personaje; con gizmo y botón copiar)
function EditablePreloaderLight({ playerRef, color = '#ffffff', intensity = 8, angle = 1.2, penumbra = 0.6 }) {
  const lightRef = React.useRef()
  const targetRef = React.useRef()
  const gizmoRef = React.useRef()
  const lineRef = React.useRef()
  const draggingRef = React.useRef(false)
  const { camera } = useThree()
  React.useEffect(() => {
    if (!playerRef?.current || !lightRef.current) return
    try {
      const pos = playerRef.current.position.clone()
      pos.y += 3.5
      lightRef.current.position.copy(pos)
      if (gizmoRef.current) gizmoRef.current.position.copy(pos)
      const tgt = playerRef.current.position.clone(); tgt.y += 1.6
      targetRef.current.position.copy(tgt)
      if (camera) try { camera.layers.enable(31) } catch {}
      window.__preLightPos = [pos.x, pos.y, pos.z]
      window.__preLightTarget = [tgt.x, tgt.y, tgt.z]
    } catch {}
  }, [playerRef, camera])
  useFrame(() => {
    try {
      if (lineRef.current && lightRef.current && targetRef.current) {
        const geo = lineRef.current.geometry
        const posArr = new Float32Array([
          lightRef.current.position.x, lightRef.current.position.y, lightRef.current.position.z,
          targetRef.current.position.x, targetRef.current.position.y, targetRef.current.position.z,
        ])
        if (!geo.getAttribute('position')) geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
        else { const attr = geo.getAttribute('position'); attr.array.set(posArr); attr.needsUpdate = true }
      }
      window.__preLightPos = [lightRef.current.position.x, lightRef.current.position.y, lightRef.current.position.z]
      window.__preLightTarget = [targetRef.current.position.x, targetRef.current.position.y, targetRef.current.position.z]
    } catch {}
  })
  return (
    <>
      <GlobalCursor />
      <spotLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        angle={angle}
        penumbra={penumbra}
        distance={50}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00006}
        shadow-normalBias={0.02}
        shadow-radius={8}
      />
      <object3D ref={targetRef} />
      <TransformControls mode="translate" onMouseDown={() => { draggingRef.current = true }} onMouseUp={() => { draggingRef.current = false }}>
        <group>
          <mesh layers={31}>
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
          </mesh>
          <mesh ref={gizmoRef} layers={31} onPointerMove={(e) => { if (draggingRef.current && lightRef.current) { lightRef.current.position.copy(e.object.position) }}} onPointerUp={() => { draggingRef.current = false }}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color={'#00ffff'} wireframe />
          </mesh>
        </group>
      </TransformControls>
      <line ref={lineRef}>
        <bufferGeometry />
        <lineBasicMaterial color={'#00ffff'} />
      </line>
      <Html position={[0,0,0]} transform={false} zIndexRange={[20000, 30000]}
        wrapperClass="pointer-events-none"
        style={{ pointerEvents: 'none' }}>
        <div className="pointer-events-auto" style={{ position: 'fixed', left: '12px', top: '12px' }}>
          <button type="button" onClick={async () => { try { const pos = (window.__preLightPos || []); const tgt = (window.__preLightTarget || []); const json = JSON.stringify({ position: pos, target: tgt }, null, 2); await navigator.clipboard.writeText(json) } catch {} }} className="px-3 py-1 rounded bg-white/90 text-black text-xs shadow hover:bg-white">{t('pre.copyLightPreset') || 'Copy Preloader preset'}</button>
        </div>
      </Html>
    </>
  )
}

// Pin Light editable + UI simple (preloader)
function PreloaderPinLight({ playerRef }) {
  const lightRef = React.useRef()
  const [cfg, setCfg] = React.useState({ intensity: 14.4, distance: 21, decay: 0.65, color: '#ff8800', x: 0, y: 1.4, z: 0 })
  React.useEffect(() => {
    try {
      const p = playerRef?.current?.position || new THREE.Vector3(0, 0, 0)
      // mantener valores dados; solo centrar en XZ si el player no está en el origen
      setCfg((c) => ({ ...c, x: p.x, z: p.z }))
    } catch {}
  }, [playerRef])
  useFrame(() => {
    if (!lightRef.current) return
    lightRef.current.position.set(cfg.x, cfg.y, cfg.z)
    // eslint-disable-next-line no-underscore-dangle
    window.__prePinLight = { position: [cfg.x, cfg.y, cfg.z], intensity: cfg.intensity, distance: cfg.distance, decay: cfg.decay, color: cfg.color }
  })
  return (
    <>
      <pointLight ref={lightRef} args={[cfg.color, cfg.intensity, cfg.distance, cfg.decay]} />
      {/* UI de ayuda removida */}
    </>
  )
}