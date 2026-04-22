import React, { useRef, useState, useMemo, useCallback, Suspense, lazy, useEffect } from 'react'
// three / @react-three/* live inside HomeCanvas (lazy-loaded below).
// `three` itself is dynamic-imported via src/lib/sceneCapture.js at transition time.
// @react-three/drei is dynamic-imported where needed (preloadGlb helper below).
// html2canvas se dynamic-importa bajo demanda en el punto de uso (~500KB).
import ScoreHUD from './components/ScoreHUD.jsx'
import Portal from './components/Portal.jsx'
// CharacterPortrait y PostFX cargan @react-three/postprocessing.
// Los lazy-cargamos para sacar esa librería del bundle inicial — Suspense
// con fallback null no causa flicker porque ambos usos ya están condicionados
// a un estado posterior al first paint (fxWarm / !bootLoading).
const CharacterPortrait = lazy(() => import('./components/CharacterPortrait.jsx'))
// PostFX is lazy-imported inside HomeScene.jsx (scene-only).
// HomeCanvas bundles <Canvas> + HomeScene + canvasSetup; lazy so the full
// 3D stack (three / @react-three/* / postprocessing) loads in parallel with
// the HTML boot preloader instead of blocking first paint.
//
// Warm-up import fires at module load (not waiting for App to render), so
// the chunk downloads in parallel with the boot terminal — otherwise shader
// compilation happens mid-fall and the character's first seconds feel laggy.
const homeCanvasImport = import('./components/home/HomeCanvas.jsx')
const HomeCanvas = lazy(() => homeCanvasImport)
const Section1 = lazy(() => import('./components/Section1.jsx'))
import CheatTerminal from './components/CheatTerminal.jsx'
import { MusicalNoteIcon, XMarkIcon, Bars3Icon, ChevronUpIcon, ChevronDownIcon, HeartIcon, Cog6ToothIcon, ArrowPathIcon, VideoCameraIcon, InformationCircleIcon, CommandLineIcon, UserIcon, UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/solid'
import { playSfx, preloadSfx } from './lib/sfx.js'
import useGlobalSfx from './hooks/useGlobalSfx.js'
import scoreStore from './lib/scoreStore.js'
import NoiseTransitionOverlay from './components/NoiseTransitionOverlay.jsx'
import GridRevealOverlay from './components/GridRevealOverlay.jsx'
import { useLanguage } from './i18n/LanguageContext.jsx'
import GlobalCursor from './components/GlobalCursor.jsx'
const GlobalShopCart = lazy(() => import('./components/shop/ShopCart.jsx'))
const SkinToggleButton = lazy(() => import('./components/SkinToggleButton.jsx'))
import TutorialModal, { useTutorialShown } from './components/TutorialModal.jsx'
import SphereGameModal from './components/SphereGameModal.jsx'
import GameOverModal from './components/GameOverModal.jsx'
import SectionPreloader from './components/SectionPreloader.jsx'
import { GameToastProvider, useGameToast } from './components/GameToast.jsx'
import { extendGLTFLoaderKTX2 } from './lib/ktx2Setup.js'
const Section2 = lazy(() => import('./components/Section2.jsx'))
const Section3 = lazy(() => import('./components/Section3.jsx'))
const Section4 = lazy(() => import('./components/Section4.jsx'))
import { useAuth } from './auth/authContext.js'
import useUserProfile from './hooks/useUserProfile.js'
const Section5 = lazy(() => import('./components/Section5.jsx'))

// Admin Dashboard (lazy loaded)
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

import GamepadIcon from './components/icons/GamepadIcon.jsx'
import {
  sectionColors,
  sectionBgOverrides,
  getWorkImageUrls,
} from './lib/appHelpers.js'
import PreloaderContent from './components/PreloaderContent.jsx'
import PortalCTA from './components/PortalCTA.jsx'
import NavOverlay from './components/NavOverlay.jsx'
import MobileJoystickPower from './components/hud/MobileJoystickPower.jsx'
import MusicModal from './components/MusicModal.jsx'
import DesktopNav from './components/hud/DesktopNav.jsx'
import useTransitionSystem, { GRID_IN_MS, GRID_OUT_MS, GRID_DELAY_MS, SECTION_PRELOADER_MIN_MS } from './transitions/useTransitionSystem.js'
// canvasSetup helpers now live inside HomeCanvas (lazy).
import useGoldSkinSystem from './game/useGoldSkinSystem.js'
import { useActiveDiscount } from './lib/useActiveDiscount.js'
import useDwellTimeTracking from './hooks/useDwellTimeTracking.js'
import useOutsideClickClose from './hooks/useOutsideClickClose.js'
import useMenuAnimation from './hooks/useMenuAnimation.js'
import usePowerBarSafeInsets from './hooks/usePowerBarSafeInsets.js'
import useMemoryWatchdog from './hooks/useMemoryWatchdog.js'
import { baseUrl, sectionToPath, pathToSection, extractBlogSlug, extractWorkSlug } from './lib/sectionRouting.js'

export default function App() {
  const { login, logout, authenticated, user } = useAuth()
  const userProfile = useUserProfile()
  const { t } = useLanguage()
  // Detect /admin route to render the admin dashboard
  const isAdminRoute = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname.startsWith('/admin')
  }, [])

  // Global hover/click SFX for all interactive elements
  useGlobalSfx()

  // If on /admin, render only the AdminApp
  if (isAdminRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <AdminApp />
      </Suspense>
    )
  }

  const { lang, setLang } = useLanguage()
  const gameToast = useGameToast()
  // Enhanced mobile/low-perf detection (includes integrated GPUs)
  const isMobilePerf = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer:coarse)').matches
    const saveData = navigator.connection && (navigator.connection.saveData || (navigator.connection.effectiveType && /2g/.test(navigator.connection.effectiveType)))
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4
    const lowThreads = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
    const highDPR = window.devicePixelRatio && window.devicePixelRatio > 2

    // Detect integrated GPU via WebGL debug info
    let isIntegratedGPU = false
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2')
      if (gl) {
        const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info')
        if (dbgInfo) {
          const renderer = (gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) || '').toLowerCase()
          // Known integrated GPUs with typically low WebGL performance
          isIntegratedGPU = (
            renderer.includes('intel') ||
            renderer.includes('mali') ||
            renderer.includes('adreno') ||
            renderer.includes('powervr') ||
            renderer.includes('apple gpu') ||
            renderer.includes('mesa') ||
            renderer.includes('swiftshader') ||
            renderer.includes('llvmpipe')
          )
          if (import.meta.env?.DEV) {
            console.log('[Perf] GPU detected:', renderer, '| Integrated:', isIntegratedGPU)
          }
        }
      }
    } catch { }

    return Boolean(isMobileUA || coarse || saveData || lowMemory || lowThreads || highDPR || isIntegratedGPU)
  }, [])
  // Post-processing FX state (UI outside Canvas)
  const [fx, setFx] = useState(() => ({
    bloom: 0.78,
    vignette: 0.7,
    noise: 0,
    dotEnabled: true,
    dotScale: 0.76,
    dotAngle: 0.06,
    dotCenterX: 0.38,
    dotCenterY: 0.44,
    dotOpacity: 0.02,
    dotBlend: 'screen',
    psychoEnabled: false,
    chromaOffsetX: 0.0,
    chromaOffsetY: 0.0,
    glitchActive: false,
    glitchStrengthMin: 0.2,
    glitchStrengthMax: 0.6,
    brightness: 0.0,
    contrast: 0.0,
    saturation: 0.0,
    hue: 0.0,
    // Liquid warp (legacy, gated by psychoEnabled)
    liquidStrength: 0.0,
    liquidScale: 3.0,
    liquidSpeed: 1.2,
    // Transition warp — isolated dreamy shader wipe for section transitions.
    transitionWarpStrength: 0.0,
    maskCenterX: 0.5,
    maskCenterY: 0.5,
    maskRadius: 0.6,
    maskFeather: 0.35,
    edgeBoost: 0.0,
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
  const [portraitGlowV, setPortraitGlowV] = useState(0)
  const [navTarget, setNavTarget] = useState(null)
  // When set, the character auto-enters the section on arrival (no CTA tap needed).
  // Populated by menu clicks; consumed/cleared by onReachedPortal.
  const autoEnterOnArrivalRef = useRef(null)
  const [orbActiveUi, setOrbActiveUi] = useState(false)
  const [playerMoving, setPlayerMoving] = useState(false)
  // Character meshes for outline postprocessing
  const [playerMeshes, setPlayerMeshes] = useState([])
  const glRef = useRef(null)
  // Start in degraded (lowPerf) mode by default — this was the previously-working
  // default. Full-quality ground (MeshReflectorMaterial) + Environment frames + DPR
  // at startup drops FPS enough that the character walk *feels* slow until the GPU
  // catches up. The gold-skin metallic boost is applied directly on the character
  // materials (Player.jsx:203), so it survives lowPerf.
  const [degradedMode, setDegradedMode] = useState(true)
  // Post FX warm-up: start with lowPerf profile, scale to full after preloader
  // disappears (avoids Context Lost without losing FX).
  const [fxWarm, setFxWarm] = useState(false)
  const [showMusic, setShowMusic] = useState(false)
  // Camera mode: 'third-person' (OrbitControls) or 'top-down' (fixed overhead view, default)
  const initialCameraMode = useMemo(() => {
    try { return localStorage.getItem('cameraMode') || 'top-down' } catch { return 'top-down' }
  }, [])
  const [cameraMode, setCameraMode] = useState(initialCameraMode)
  // Persist camera mode preference
  useEffect(() => {
    try { localStorage.setItem('cameraMode', cameraMode) } catch { }
  }, [cameraMode])
  const initialForceCompactUi = useMemo(() => {
    try { return localStorage.getItem('forceCompactUi') === '1' } catch { return false }
  }, [])
  const [forceCompactUi, setForceCompactUi] = useState(initialForceCompactUi)
  const [socialsOpen, setSocialsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [spheresTutorialOpen, setSpheresTutorialOpen] = useState(false)
  const [sphereGameActive, setSphereGameActive] = useState(false)
  const [gameOverOpen, setGameOverOpen] = useState(false)
  const [gameOverScore, setGameOverScore] = useState(0)

  // Gold skin unlock system (localStorage + server profile sync + sphere minigame).
  // Extracted to src/game/useGoldSkinSystem.js — see there for mechanics.
  const {
    goldSkinUnlocked,
    goldSkinModelActive,
    goldSkinTransformActive,
    triggerGoldSkinUnlock,
    skinPreference,
    toggleSkin,
  } = useGoldSkinSystem({ userProfile, sphereGameActive, gameToast })

  // Cheat terminal modal
  const [cheatTerminalOpen, setCheatTerminalOpen] = useState(false)
  const [authMenuOpen, setAuthMenuOpen] = useState(false)
  // Active cart discount (localStorage-backed). Not stackable — one code at a time.
  // App.jsx only writes (on cheat redeem); ShopCart/useActiveDiscount reads independently.
  const { replaceWithConfirm: applyDiscountWithConfirm } = useActiveDiscount()
  const pendingCheatRef = useRef(null)
  const handleCheatCode = useCallback((payload) => {
    // Store the full validation payload (code + pct + action + rarity) and
    // close the modal — FX triggers after modal closes.
    pendingCheatRef.current = payload
    setCheatTerminalOpen(false)
  }, [])
  // Execute pending cheat action AFTER modal closes so the visual FX is visible
  useEffect(() => {
    if (cheatTerminalOpen || !pendingCheatRef.current) return
    const payload = pendingCheatRef.current
    pendingCheatRef.current = null
    // 1) Always try to apply the discount (with confirm if something else was active).
    if (payload && payload.code && payload.discount_pct > 0) {
      setTimeout(() => {
        applyDiscountWithConfirm({
          code: payload.code,
          discount_pct: payload.discount_pct,
          rarity: payload.rarity,
          label: payload.label,
          action: payload.action,
        })
      }, 300)
    }
    // 2) Optional cosmetic perk (e.g. goldSkin). Decoupled from the discount.
    if (payload && payload.action === 'goldSkin' && !goldSkinUnlocked) {
      // Small delay so the modal fade-out completes
      setTimeout(() => { triggerGoldSkinUnlock() }, 300)
    }
  }, [cheatTerminalOpen, goldSkinUnlocked, triggerGoldSkinUnlock, applyDiscountWithConfirm])


  const { shown: tutorialShown, markAsShown: markTutorialShown } = useTutorialShown()
  const [tracks, setTracks] = useState([])
  const mobileMenuIds = ['section1', 'section2', 'section3', 'section4', 'section5'] // Work, About, Store, Contact, Blog
  // Menu overlay animation — see src/hooks/useMenuAnimation.js
  const MENU_ITEM_IN_MS = 260
  const MENU_ITEM_OUT_MS = 200
  const MENU_ITEM_STEP_MS = 100 // delay between each button start
  const {
    menuOpen,
    menuVisible,
    open: openMenuAnimated,
    close: closeMenuAnimated,
  } = useMenuAnimation(mobileMenuIds.length, {
    overlayMs: 260,
    itemOutMs: MENU_ITEM_OUT_MS,
    itemStepMs: MENU_ITEM_STEP_MS,
  })

  // Socials fan: close on outside click or Escape
  const socialsWrapMobileRef = useRef(null)
  const socialsWrapDesktopRef = useRef(null)
  // Settings fan (mobile/compact & desktop): close on outside click or Escape
  const settingsWrapMobileRef = useRef(null)
  const settingsWrapDesktopRef = useRef(null)
  // Right-side compact controls column: used to compute power bar safe area
  const compactControlsRef = useRef(null)
  useOutsideClickClose(socialsOpen, setSocialsOpen, [socialsWrapMobileRef, socialsWrapDesktopRef])
  useOutsideClickClose(settingsOpen, setSettingsOpen, [settingsWrapMobileRef, settingsWrapDesktopRef])
  // Forward-ref for UI animation setters that the transition system reads on
  // transition-start (they're declared later in the component). Written each
  // render so the hook's begin* callbacks always see current values.
  const uiAnimApi = useRef({})

  // URL sync helper — standalone (only needs sectionToPath from ./lib/sectionRouting.js).
  // Pulled above the hook call so beginGridReveal can use it at transition time.
  const syncUrl = (s) => {
    if (typeof window === 'undefined') return
    const next = sectionToPath(s)
    if (window.location.pathname !== next) {
      window.history.pushState({ section: s }, '', next)
    }
  }

  // Stop psychedelic effects (defensive cleanup)
  const stopPsycho = React.useCallback(() => {
    setFx((v) => ({
      ...v,
      psychoEnabled: false,
      glitchActive: false,
      chromaOffsetX: 0,
      chromaOffsetY: 0,
      liquidStrength: 0.0,
      edgeBoost: 0.0,
    }))
  }, [setFx])
  const [isMobile, setIsMobile] = useState(false)
  // Compact UI breakpoint (same as hamburger menu threshold)
  const [isHamburgerViewport, setIsHamburgerViewport] = useState(false)
  // iPad: show joystick even if viewport > 1100 (e.g. landscape 1024px)
  const [isIpadDevice, setIsIpadDevice] = useState(false)
  // Tesla in-car browser: treat as iPad-like for joystick/power UI
  const [isTeslaBrowser, setIsTeslaBrowser] = useState(false)
  // Mobile/compact UI: small portrait + joystick + horizontal power bar
  const isMobileUi = Boolean(forceCompactUi || isHamburgerViewport || isIpadDevice || isTeslaBrowser)
  // Alias used throughout layout
  const isCompactUi = isMobileUi
  useEffect(() => {
    try { localStorage.setItem('forceCompactUi', forceCompactUi ? '1' : '0') } catch { }
  }, [forceCompactUi])
  // Dynamic safe insets for horizontal power bar (avoids overlapping portrait and buttons)
  // Power-bar safe insets (avoid overlapping portrait-left and controls-right on mobile)
  // see src/hooks/usePowerBarSafeInsets.js
  // Scrollable section UI
  // Scrollable section UI — start visible if landing on a section URL
  const [showSectionUi, setShowSectionUi] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const base = import.meta.env.BASE_URL || '/'
      const baseObj = new URL(base, window.location.origin)
      let rel = window.location.pathname
      const basePath = baseObj.pathname.endsWith('/') ? baseObj.pathname : `${baseObj.pathname}/`
      if (rel.startsWith(basePath)) rel = rel.slice(basePath.length)
      rel = rel.replace(/^\//, '')
      return rel !== '' && rel !== '/'
    } catch { return false }
  })
  const [sectionUiAnimatingOut, setSectionUiAnimatingOut] = useState(false)
  const [sectionUiFadeIn, setSectionUiFadeIn] = useState(false)
  const sectionScrollRef = useRef(null)
  // Lenis smooth scroll instance ref
  const lenisRef = useRef(null)
  // Scroll velocity ref passed to Section1 for shader deformation
  const scrollVelocityRef = useRef(0)
  // Temporary hint to reactivate CTA/marquee when returning to HOME
  const [uiHintPortalId, setUiHintPortalId] = useState(null)
  const uiHintTimerRef = useRef(null)
  // Track which section is currently active — initialize from URL to avoid flash-of-home
  const [section, setSection] = useState(() => {
    if (typeof window === 'undefined') return 'home'
    try {
      const base = import.meta.env.BASE_URL || '/'
      const baseObj = new URL(base, window.location.origin)
      let rel = window.location.pathname
      const basePath = baseObj.pathname.endsWith('/') ? baseObj.pathname : `${baseObj.pathname}/`
      if (rel.startsWith(basePath)) rel = rel.slice(basePath.length)
      rel = rel.replace(/^\//, '')
      if (rel === '' || rel === '/') return 'home'
      if (rel.startsWith('work/')) return 'section1'
      if (rel.startsWith('blog')) return 'section5'
      const map = { work: 'section1', about: 'section2', 'lost-and-found-shop': 'section3', 'side-quests': 'section3', contact: 'section4', blog: 'section5' }
      if (map[rel]) return map[rel]
      return 'home'
    } catch { return 'home' }
  })

  // Section dwell-time tracking + analytics flushing (see src/hooks/useDwellTimeTracking.js)
  useDwellTimeTracking(section)

  // Unified transition system — owns transitionState + grid/noise/blackout overlay
  // state + the 3 begin* callbacks (grid reveal, simple fade, ripple).
  // See src/transitions/useTransitionSystem.js.
  const {
    transitionState,
    setTransitionState,
    beginGridReveal: beginGridRevealTransition,
    beginSimpleFade: beginSimpleFadeTransition,
    beginRipple: beginRippleTransition,
    beginLiquidWipe,
    // grid overlay render state (consumed by <GridRevealOverlay />)
    gridOverlayActive, setGridOverlayActive,
    gridPhase, setGridPhase,
    gridCenter, setGridCenter,
    gridKey, setGridKey,
    preloaderTargetSection, setPreloaderTargetSection,
    onGridPhaseEnd,
    gridOutTimerRef,
    // section preloader (<SectionPreloader />)
    showSectionPreloader, setShowSectionPreloader,
    sectionPreloaderFading, setSectionPreloaderFading,
    // ripple / noise-mix (consumed by PostFX inside HomeScene)
    prevSceneTex, setPrevSceneTex,
    noiseMixEnabled, setNoiseMixEnabled,
    noiseMixProgress, setNoiseMixProgress,
    rippleMixRef,
    // A/B noise overlay (currently not triggered)
    noiseOverlayActive, setNoiseOverlayActive,
    noisePrevTex, setNoisePrevTex,
    noiseNextTex, setNoiseNextTex,
    noiseProgress, setNoiseProgress,
    // blackout overlay
    blackoutVisible, setBlackoutVisible,
    blackoutImmediate, setBlackoutImmediate,
  } = useTransitionSystem({
    section, setSection,
    setShowSectionUi, setSectionUiAnimatingOut, setSectionUiFadeIn,
    sectionScrollRef,
    uiAnimApi,
    glRef,
    syncUrl,
    setFx,
  })

  // (Unified + simple transition systems removed — they were built but never triggered;
  //  active transitions are beginGridRevealTransition + beginSimpleFadeTransition + beginRippleTransition.)

  // Unified exit-to-HOME for both the section exit button and the preloader "ENTER" button
  const exitToHomeLikeExitButton = React.useCallback((source = 'section') => {
    if (transitionState.active) return
    const shouldExit = (section !== 'home') || (source === 'preloader')
    if (!shouldExit) return

    // Preloader source: unique flow (skip overlay, show landing animation).
    // Keeps the current behavior where the boot preloader dissolves and the
    // character drops into HOME — not a section transition.
    if (source === 'preloader') {
      if (preloaderStartedRef.current) return
      preloaderStartedRef.current = true
      setBootProgress(100)
      try { setPreloaderFadingOut(true) } catch { }
      try { setShowPreloaderOverlay(false) } catch { }
      try { setBootLoading(false) } catch { }
      try { setNavTarget('home') } catch { }
      try { setSection('home') } catch { }
      try { syncUrl('home') } catch { }
      preloaderHideTimerRef.current = window.setTimeout(() => {
        setPreloaderFadingOut(false)
        preloaderHideTimerRef.current = null
      }, 5000)
      return
    }

    // Section → HOME: shader image wipe (honeycomb glass reveal).
    try { lastExitedSectionRef.current = section } catch { }
    // UI exit animation (portrait etc. slide out while snapshot covers)
    setUiAnimPhase('exiting')
    if (uiExitTimerRef.current) clearTimeout(uiExitTimerRef.current)
    uiExitTimerRef.current = setTimeout(() => setUiAnimPhase('hidden'), 400)
    // Pre-cleanup state that should be hidden when the user arrives at HOME.
    try { setShowSectionPreloader(false); setSectionPreloaderFading(false) } catch { }
    setShowMarquee(false)
    setMarqueeAnimatingOut(false)
    setMarqueeForceHidden(true)
    try { if (ctaHideTimerRef.current) { clearTimeout(ctaHideTimerRef.current); ctaHideTimerRef.current = null } } catch { }
    try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch { }
    setShowCta(false)
    setCtaAnimatingOut(false)
    setCtaLoading(false)
    setCtaProgress(0)
    setNearPortalId(null)
    setUiHintPortalId(null)
    setCtaForceHidden(true)
    try { if (ctaForceTimerRef.current) clearTimeout(ctaForceTimerRef.current) } catch { }
    ctaForceTimerRef.current = window.setTimeout(() => { setCtaForceHidden(false); ctaForceTimerRef.current = null }, 800)
    try { setHomeLanded(false) } catch { }
    try { setNavTarget('home') } catch { }

    // Hand off the actual section swap + reveal to the grid transition system.
    beginGridRevealTransition('home')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, transitionState.active])

  const handleExitSection = React.useCallback(() => {
    exitToHomeLikeExitButton('section')
  }, [exitToHomeLikeExitButton])

  // Listen for close-button click emitted by the portrait
  useEffect(() => {
    const onExit = () => handleExitSection()
    window.addEventListener('exit-section', onExit)
    return () => window.removeEventListener('exit-section', onExit)
  }, [handleExitSection])
  const [eggActive, setEggActive] = useState(false)
  useEffect(() => { try { window.__eggActiveGlobal = eggActive } catch { } }, [eggActive])
  // Toggle glitch font globally when eggActive
  useEffect(() => {
    try {
      const cls = 'glitch-font'
      const root = document.documentElement
      const body = document.body
      if (eggActive) { root.classList.add(cls); body.classList.add(cls) }
      else { root.classList.remove(cls); body.classList.remove(cls) }
    } catch { }
  }, [eggActive])

  // Lightning bolt → white flash overlay + brief postfx boost.
  // Rewind (egg end) → VHS OSD + glitch/chromatic/noise boost for ~1.6s.
  const [boltFlashActive, setBoltFlashActive] = useState(false)
  const [vhsRewindActive, setVhsRewindActive] = useState(false)
  const boltFlashTimerRef = useRef(null)
  const vhsRewindTimerRef = useRef(null)
  const VHS_REWIND_MS = 1600
  useEffect(() => {
    const onBolt = () => {
      setBoltFlashActive(true)
      if (boltFlashTimerRef.current) clearTimeout(boltFlashTimerRef.current)
      // Flash peaks almost instantly and fades over ~420ms (CSS transition handles curve)
      boltFlashTimerRef.current = setTimeout(() => {
        setBoltFlashActive(false)
        boltFlashTimerRef.current = null
      }, 420)
    }
    const onRewind = () => {
      setVhsRewindActive(true)
      if (vhsRewindTimerRef.current) clearTimeout(vhsRewindTimerRef.current)
      vhsRewindTimerRef.current = setTimeout(() => {
        setVhsRewindActive(false)
        vhsRewindTimerRef.current = null
      }, VHS_REWIND_MS)
    }
    window.addEventListener('bolt-strike', onBolt)
    window.addEventListener('egg-rewind-start', onRewind)
    return () => {
      window.removeEventListener('bolt-strike', onBolt)
      window.removeEventListener('egg-rewind-start', onRewind)
      if (boltFlashTimerRef.current) clearTimeout(boltFlashTimerRef.current)
      if (vhsRewindTimerRef.current) clearTimeout(vhsRewindTimerRef.current)
    }
  }, [])

  // ============= CHEAT DRAG EASTER EGG =============
  const cheatCountRef = useRef(0)
  const [cheatAlertVisible, setCheatAlertVisible] = useState(false)
  const [cheatAlertText, setCheatAlertText] = useState('')
  const [cheatDragEnabled, setCheatDragEnabled] = useState(true)
  const cheatScoreAnimRef = useRef(null)
  const cheatBlockedShownRef = useRef(false)

  // Alert queue system — guarantees each alert is visible for its full duration
  const cheatAlertQueueRef = useRef([]) // Array of { text, durationMs }
  const cheatAlertDismissTimerRef = useRef(null)
  const cheatAlertProcessingRef = useRef(false) // Prevents re-entrant processing

  // Process the next alert in the queue (or hide if empty)
  const processCheatAlertQueue = useCallback(() => {
    const queue = cheatAlertQueueRef.current
    if (queue.length === 0) {
      // Queue empty — dismiss current alert
      cheatAlertProcessingRef.current = false
      setCheatAlertVisible(false)
      return
    }
    cheatAlertProcessingRef.current = true
    const next = queue.shift()
    setCheatAlertText(next.text)
    setCheatAlertVisible(true)
    // Schedule dismissal / next-in-queue after this alert's guaranteed duration
    if (cheatAlertDismissTimerRef.current) clearTimeout(cheatAlertDismissTimerRef.current)
    cheatAlertDismissTimerRef.current = setTimeout(() => {
      processCheatAlertQueue()
    }, next.durationMs)
  }, [])

  // Enqueue a cheat alert with guaranteed minimum display time
  const enqueueCheatAlert = useCallback((text, durationMs) => {
    cheatAlertQueueRef.current.push({ text, durationMs })
    // If no alert is currently being processed, start immediately
    if (!cheatAlertProcessingRef.current) {
      processCheatAlertQueue()
    }
    // If an alert IS showing, the new one waits in the queue
    // and will be shown after the current one's timer expires.
  }, [processCheatAlertQueue])

  // User tries to drag a sphere after being penalized
  const handleBlockedDragAttempt = () => {
    if (cheatBlockedShownRef.current) return // Show only once
    cheatBlockedShownRef.current = true
    enqueueCheatAlert(t('cheat.alertBlocked'), 6000)
  }

  const handleCheatCapture = () => {
    cheatCountRef.current += 1
    const count = cheatCountRef.current

    if (count === 1) {
      // 1st cheat: character speech bubble
      try {
        window.dispatchEvent(new CustomEvent('speech-bubble-override', {
          detail: { phrasesKey: 'cheat.phrases', idx: 0, durationMs: 5000 }
        }))
      } catch { }
    } else if (count === 2) {
      // 2nd cheat: system alert (queued)
      enqueueCheatAlert(t('cheat.alert2'), 6000)
    } else if (count === 3) {
      // 3rd cheat: easter egg scene + system alert + score penalty + disable drag
      // Side effects happen immediately regardless of alert queue
      try { window.__cheatEggExtendedDrift = true } catch { }
      setEggActive(true)
      setCheatDragEnabled(false) // Disable drag permanently

      // Animate score to -9999 after a brief pause
      cheatScoreAnimRef.current = setTimeout(() => {
        const start = scoreStore.get()
        const target = -9999
        const duration = 2500
        const startTime = performance.now()
        const step = () => {
          const elapsed = performance.now() - startTime
          const progress = Math.min(1, elapsed / duration)
          const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
          scoreStore.set(Math.round(start + (target - start) * eased))
          if (progress < 1) {
            requestAnimationFrame(step)
          }
        }
        requestAnimationFrame(step)
      }, 1500)

      // Enqueue the critical alert (9s — longer to let the user absorb the penalty)
      enqueueCheatAlert(t('cheat.alert3'), 9000)
      // Deactivate easter egg scene 12s after triggering
      setTimeout(() => setEggActive(false), 12000)
    }
  }

  // Hide/show marquee when a project detail opens/closes (Work)
  useEffect(() => {
    const onOpen = () => { try { setMarqueeForceHidden(true) } catch { } }
    const onClose = () => { try { setMarqueeForceHidden(false) } catch { } }
    window.addEventListener('detail-open', onOpen)
    window.addEventListener('detail-close', onClose)
    return () => {
      window.removeEventListener('detail-open', onOpen)
      window.removeEventListener('detail-close', onClose)
    }
  }, [])
  const mainControlsRef = useRef(null)
  const [nearPortalId, setNearPortalId] = useState(null)
  const [showSectionBanner, setShowSectionBanner] = useState(false)
  const bannerTimerRef = useRef(null)
  // CTA and Marquee with exit animation
  const [showCta, setShowCta] = useState(false)
  const [ctaAnimatingOut, setCtaAnimatingOut] = useState(false)
  const ctaHideTimerRef = useRef(null)
  // CTA preloader state
  const [ctaLoading, setCtaLoading] = useState(false)
  const [ctaProgress, setCtaProgress] = useState(0)
  const [ctaColor, setCtaColor] = useState('#ffffff')
  const ctaProgTimerRef = useRef(null)
  // Force-hide CTA temporarily when exiting a section to prevent flash
  const [ctaForceHidden, setCtaForceHidden] = useState(false)

  // Nav overlay → section select. Behaves differently in-section vs HOME (auto-enter queue).
  const handleMenuSectionSelect = useCallback((id) => {
    closeMenuAnimated()
    if (showSectionUi) {
      if (!transitionState.active && id !== section) {
        beginGridRevealTransition(id)
        setPortraitGlowV((v) => v + 1)
      }
    } else {
      if (!orbActiveUi) {
        // Signal that arriving at this portal should auto-enter the section (consumed by onReachedPortal)
        if (id !== 'home') autoEnterOnArrivalRef.current = id
        setNavTarget(id)
        setPortraitGlowV((v) => v + 1)
      }
    }
    // beginGridRevealTransition is a stable useCallback; omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeMenuAnimated, showSectionUi, transitionState.active, section, orbActiveUi])

  // CTA onClick: preload target section + assets, animate progress bar, then fire grid transition.
  // (Extracted from inline handler when PortalCTA became its own component.)
  const handleCTAEnter = useCallback(async () => {
    try { playSfx('click', { volume: 1.0 }) } catch { }
    const target = nearPortalId || uiHintPortalId
    if (!target) return
    if (transitionState.active) return
    if (target === section) return
    if (ctaLoading) return
    try { setCtaColor(sectionColors[target] || '#ffffff') } catch { }
    setCtaLoading(true)
    setCtaProgress(0)
    if (ctaProgTimerRef.current) clearInterval(ctaProgTimerRef.current)
    ctaProgTimerRef.current = setInterval(() => {
      setCtaProgress((p) => Math.min(100, p + 4))
    }, 60)
    // Preload target section chunk (best-effort)
    try {
      const preloadMap = {
        section1: () => import('./components/Section1.jsx'),
        section2: () => import('./components/Section2.jsx'),
        section3: () => import('./components/Section3.jsx'),
        section4: () => import('./components/Section4.jsx'),
        section5: () => import('./components/Section5.jsx'),
      }
      const f = preloadMap[target]
      if (typeof f === 'function') { try { await f() } catch { } }
    } catch { }
    // Preload critical Work images (subset with timeout)
    try {
      if (target === 'section1') {
        const urls = (typeof getWorkImageUrls === 'function') ? getWorkImageUrls() : []
        const subset = urls.slice(0, 6)
        const loadWithTimeout = (u, ms = 2000) => new Promise((resolve) => {
          const img = new Image()
          let done = false
          const finish = (ok) => { if (!done) { done = true; resolve(ok) } }
          const to = setTimeout(() => finish(false), ms)
          img.onload = () => { clearTimeout(to); finish(true) }
          img.onerror = () => { clearTimeout(to); finish(false) }
          img.src = u
        })
        await Promise.all(subset.map((u) => loadWithTimeout(u)))
      }
    } catch { }
    setCtaProgress(100)
    try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch { }
    window.setTimeout(() => setCtaLoading(false), 180)
    try { if (playerRef.current) prevPlayerPosRef.current?.copy(playerRef.current.position) } catch { }
    try { lastPortalIdRef.current = target } catch { }
    beginGridRevealTransition(target)
    setPortraitGlowV((v) => v + 1)
    // beginGridRevealTransition is a stable useCallback; omitted from deps to avoid thrashing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearPortalId, uiHintPortalId, transitionState.active, section, ctaLoading])
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
  // Fade-to-black overlay state lives in useTransitionSystem now (blackoutVisible,
  // setBlackoutVisible, blackoutImmediate, setBlackoutImmediate are destructured above).
  const blackoutTimerRef = useRef(null)

  // Failsafe: never allow a stuck blackout overlay.
  useEffect(() => {
    if (!blackoutVisible) return undefined
    const id = window.setTimeout(() => {
      try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch { }
    }, 1500)
    return () => { try { window.clearTimeout(id) } catch { } }
  }, [blackoutVisible])
  // Global boot preloader
  const [bootLoading, setBootLoading] = useState(true)
  // Main scene warm-up after "Enter": avoids hitch from mounting everything in a single frame
  const [mainWarmStage, setMainWarmStage] = useState(0) // 0=min, 1=env/lights, 2=particles/orbs/post/shadows
  const [bootProgress, setBootProgress] = useState(0)
  const [bootAllDone, setBootAllDone] = useState(false)
  const [characterReady, setCharacterReady] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [preloaderFadingOut, setPreloaderFadingOut] = useState(false)
  const [showPreloaderOverlay, setShowPreloaderOverlay] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      if (window.location.search.includes('privy_') || sessionStorage.getItem('skip_preloader') === '1') {
        return false
      }
      const base = import.meta.env.BASE_URL || '/'
      const baseObj = new URL(base, window.location.origin)
      let rel = window.location.pathname
      const basePath = baseObj.pathname.endsWith('/') ? baseObj.pathname : `${baseObj.pathname}/`
      if (rel.startsWith(basePath)) rel = rel.slice(basePath.length)
      rel = rel.replace(/^\//, '')
      // Only show preloader on home page
      return rel === '' || rel === '/'
    } catch { return true }
  })
  // Whether the character has landed (show UI afterwards)
  // If preloader was skipped (OAuth return), character is already in scene
  const [homeLanded, setHomeLanded] = useState(!showPreloaderOverlay)
  // UI animation system: controls menu and portrait enter/exit
  // 'hidden' | 'entering' | 'visible' | 'exiting'
  const [uiAnimPhase, setUiAnimPhase] = useState(!showPreloaderOverlay ? 'visible' : 'hidden')
  const uiEnterTimerRef = useRef(null)  // Timer for entering -> visible
  const uiExitTimerRef = useRef(null)   // Timer for exiting -> hidden (do NOT clear in useEffect)

  // Fill the forward-ref used by useTransitionSystem (declared earlier in render).
  // Written on every render so begin* callbacks always read current setters.
  uiAnimApi.current.setUiAnimPhase = setUiAnimPhase
  uiAnimApi.current.uiExitTimerRef = uiExitTimerRef
  uiAnimApi.current.setHomeLanded = setHomeLanded

  // UI animation logic
  useEffect(() => {
    const inHome = section === 'home'

    if (inHome) {
      // In HOME: UI enters when homeLanded is true
      if (homeLanded && uiAnimPhase !== 'visible' && uiAnimPhase !== 'entering' && uiAnimPhase !== 'exiting') {
        setUiAnimPhase('entering')
        // After enter animation, mark as visible
        if (uiEnterTimerRef.current) clearTimeout(uiEnterTimerRef.current)
        uiEnterTimerRef.current = setTimeout(() => setUiAnimPhase('visible'), 500)
      } else if (!homeLanded && uiAnimPhase !== 'hidden' && uiAnimPhase !== 'exiting') {
        // Character hasn't landed, hide UI (but don't interrupt exiting)
        setUiAnimPhase('hidden')
      }
    } else {
      // In sections: UI enters animated after grid finishes
      // Small delay (150ms) to ensure the grid has visually completed
      if (!gridOverlayActive && uiAnimPhase === 'hidden') {
        if (uiEnterTimerRef.current) clearTimeout(uiEnterTimerRef.current)
        uiEnterTimerRef.current = setTimeout(() => {
          setUiAnimPhase('entering')
          uiEnterTimerRef.current = setTimeout(() => setUiAnimPhase('visible'), 500)
        }, 150)
      }
    }

    // Only clear the enter timer in cleanup (exit timer must always complete)
    return () => {
      if (uiEnterTimerRef.current) {
        clearTimeout(uiEnterTimerRef.current)
      }
    }
  }, [section, homeLanded, gridOverlayActive, uiAnimPhase])

  // Auto-show tutorial when the character lands for the first time
  const tutorialTriggeredRef = useRef(false)
  useEffect(() => {
    if (homeLanded && !tutorialShown && !tutorialTriggeredRef.current) {
      tutorialTriggeredRef.current = true
      // Small delay to let the UI finish appearing
      const timer = setTimeout(() => {
        setTutorialOpen(true)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [homeLanded, tutorialShown])

  const preloaderStartedRef = useRef(false)
  const preloaderHideTimerRef = useRef(null)
  // Timer to disable bootLoading + unmount overlay (prevents full-screen preloader flash)
  const preloaderBootSwapTimerRef = useRef(null)
  const preloaderGridOutPendingRef = useRef(false)
  // gridOutTimerRef is now owned by useTransitionSystem and exposed via destructuring above.
  // Expose global controls (no 3D preloader camera anymore)
  useEffect(() => {
    try {
      // eslint-disable-next-line no-underscore-dangle
      window.pausePreloaderCamera = () => { }
      // eslint-disable-next-line no-underscore-dangle
      window.resumePreloaderCamera = () => { }
    } catch { }
  }, [])

  // Close menu overlay with Escape
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (e) => {
      try {
        if (e.key === 'Escape') setMenuOpen(false)
      } catch { }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  // Minimal preload: only the main character for fast entry
  // Remaining assets load in background after entering
  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          // Only load the character model (critical for HOME)
          setBootProgress(30)
          const { useGLTF } = await import('@react-three/drei')
          useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`, true, true, extendGLTFLoaderKTX2)
          if (cancelled) return
          setBootProgress(100)
          setBootAllDone(true)
        } catch {
          if (!cancelled) { setBootProgress(100); setBootAllDone(true) }
        }
      })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('skip_preloader') === '1') {
      sessionStorage.removeItem('skip_preloader')
    }
  }, [])

  // Load secondary assets in background AFTER entering (non-blocking)
  useEffect(() => {
    if (showPreloaderOverlay) return // Only after entering
    const loadInBackground = async () => {
      try {
        // Secondary GLBs
        const glbList = [
          `${import.meta.env.BASE_URL}characterStone.glb`,
          `${import.meta.env.BASE_URL}skins/characterGold.glb`,
          `${import.meta.env.BASE_URL}grave_lowpoly.glb`,
          `${import.meta.env.BASE_URL}3dmodels/housebird.glb`,
          `${import.meta.env.BASE_URL}3dmodels/housebirdPink.glb`,
          `${import.meta.env.BASE_URL}3dmodels/housebirdWhite.glb`,
        ]
        try {
          const { useGLTF } = await import('@react-three/drei')
          glbList.forEach((url) => { try { useGLTF.preload(url, true, true, extendGLTFLoaderKTX2) } catch { } })
        } catch { }
        // HDR
        fetch(`${import.meta.env.BASE_URL}light.hdr`, { cache: 'force-cache' }).catch(() => { })
        // Lazy-loaded sections
        import('./components/Section1.jsx').catch(() => { })
        import('./components/Section2.jsx').catch(() => { })
        import('./components/Section3.jsx').catch(() => { })
        import('./components/Section4.jsx').catch(() => { })
        // SFX
        const fxList = ['hover', 'click', 'magiaInicia', 'sparkleBom', 'sparkleFall', 'stepone', 'stepSoft', 'steptwo', 'thunder.mp3', 'rewind.wav']
        try { preloadSfx(fxList) } catch { }
      } catch { }
    }
    // Small delay to avoid competing with the enter animation
    const timer = setTimeout(loadInBackground, 500)
    return () => clearTimeout(timer)
  }, [showPreloaderOverlay])

  // Pre-mount the scene when the character is loaded
  const [scenePreMounted, setScenePreMounted] = React.useState(false)
  useEffect(() => {
    if (!bootAllDone) return
    // Scene ready immediately - no unnecessary delays
    setBootLoading(false)
    setScenePreMounted(true)
  }, [bootAllDone])

  // Activate full FX after the preloader is no longer on screen
  useEffect(() => {
    if (showPreloaderOverlay) { setFxWarm(false); return undefined }
    // Extended delay to give the GPU time to compile all shaders
    // before enabling full FX (prevents user-visible lag)
    const id = window.setTimeout(() => { try { setFxWarm(true) } catch { } }, 800)
    return () => window.clearTimeout(id)
  }, [showPreloaderOverlay])

  // Stage warm-up to reduce stutter on "Enter" - delays optimized for shader compilation
  useEffect(() => {
    if (bootLoading) { setMainWarmStage(0); return undefined }
    // Stage 1: Environment and lights (immediate) - lets shaders start compiling
    setMainWarmStage(1)
    // Stage 2: particles, orbs, post-processing - extended delay for GPU
    // 600ms allows most shaders to finish compiling before adding more work
    const t2 = window.setTimeout(() => { try { setMainWarmStage(2) } catch { } }, 600)
    return () => { try { window.clearTimeout(t2) } catch { } }
  }, [bootLoading])

  // Shader pre-compilation: force compile the scene before the user sees it
  const shaderCompileTriggeredRef = useRef(false)
  useEffect(() => {
    // Only run once when the scene is mounted but before activating FX
    if (!scenePreMounted || fxWarm || shaderCompileTriggeredRef.current) return
    shaderCompileTriggeredRef.current = true
    // Give 1 frame for components to mount
    requestAnimationFrame(() => {
      try {
        const gl = glRef.current
        if (!gl || !gl.render) return
        // Force a full render to compile all shaders
        gl.setRenderTarget(null)
        // The real render happens in the frameloop, this just ensures
        // requestIdleCallback doesn't block the GPU during compilation
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => {
            // Give the GPU extra time to finish compilation
            console.debug('[Perf] Shader compilation triggered')
          }, { timeout: 200 })
        }
      } catch { }
    })
  }, [scenePreMounted, fxWarm])
  // Custom scrollbar (Work sections): dynamic thumb + drag support + snap buttons
  const scrollTrackRef = useRef(null)
  const [scrollThumb, setScrollThumb] = useState({ height: 12, top: 0 })
  const isDraggingThumbRef = useRef(false)
  const navHeightRef = useRef(0) // Ref for callbacks before navHeight state is declared

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
    } catch { }
  }, [])

  // Detect mobile viewport to avoid positioning offsets that break centering
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(Boolean(mql.matches))
    update()
    try { mql.addEventListener('change', update) } catch { window.addEventListener('resize', update) }
    return () => { try { mql.removeEventListener('change', update) } catch { window.removeEventListener('resize', update) } }
  }, [])

  // Detect hamburger breakpoint (<=1100px) for UI alignment (music + language)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1100px)')
    const update = () => setIsHamburgerViewport(Boolean(mql.matches))
    update()
    try { mql.addEventListener('change', update) } catch { window.addEventListener('resize', update) }
    return () => { try { mql.removeEventListener('change', update) } catch { window.removeEventListener('resize', update) } }
  }, [])

  // Detect iPad (includes iPadOS reporting MacIntel + touch)
  useEffect(() => {
    try {
      const ua = (navigator.userAgent || '')
      const isIpadUa = /iPad/i.test(ua)
      const isIpadOs = (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
      setIsIpadDevice(Boolean(isIpadUa || isIpadOs))
    } catch {
      setIsIpadDevice(false)
    }
  }, [])

  // Detect Tesla browser (UA typically includes "Tesla/..." or "QtCarBrowser")
  useEffect(() => {
    try {
      const ua = (navigator.userAgent || '')
      const isTeslaUa = /Tesla\/\S+/i.test(ua) || /QtCarBrowser/i.test(ua)
      setIsTeslaBrowser(Boolean(isTeslaUa))
    } catch {
      setIsTeslaBrowser(false)
    }
  }, [])

  // Hidden by default on mobile; visible only when the user opens it
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

  // Horizontal power bar: keep it within the gap between portrait (left) and controls (right)
  const powerSafeInsets = usePowerBarSafeInsets({ isCompactUi, compactControlsRef, section })

  // On entering WORK, just show the UI (no more centering/snapping needed)
  useEffect(() => {
    if (section === 'section1') {
      try { setSectionUiFadeIn(true) } catch { }
    }
  }, [section])

  // Initialize/destroy Lenis smooth scroll when section UI is active.
  // Lenis is dynamic-imported so it stays out of the eager vendor chunk —
  // it's only needed once the user lands inside a section.
  useEffect(() => {
    const wrapper = sectionScrollRef.current
    if (!wrapper || !showSectionUi) {
      if (lenisRef.current) {
        try { lenisRef.current.destroy() } catch { }
        lenisRef.current = null
      }
      return
    }
    let cancelled = false
    let lenis = null
    let raf = 0
    ;(async () => {
      const { default: Lenis } = await import('lenis')
      if (cancelled || !sectionScrollRef.current) return
      lenis = new Lenis({
        wrapper,
        content: wrapper.firstElementChild || wrapper,
        lerp: 0.18,
        smoothWheel: true,
        syncTouch: true,
      })
      lenisRef.current = lenis
      const tick = (time) => {
        try {
          lenis.raf(time)
          scrollVelocityRef.current = lenis.velocity || 0
        } catch { }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })()
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      if (lenis) { try { lenis.destroy() } catch { } }
      lenisRef.current = null
      scrollVelocityRef.current = 0
    }
  }, [showSectionUi, section])

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
      } catch { }
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
    section5: t('nav.section5'),
  }), [t, lang])

  // Label específico del marquee — puede ser más largo/expresivo que el nav.
  // Fallback a sectionLabel cuando no hay override.
  const marqueeLabel = useMemo(() => ({
    ...sectionLabel,
    section3: 'LOST AND FOUND ITEMS SHOP',
  }), [sectionLabel])

  // Measure bottom nav height to position CTA with +40px spacing
  const navRef = useRef(null)
  const [navHeight, setNavHeight] = useState(0)
  const [navBottomOffset, setNavBottomOffset] = useState(0)
  const musicBtnRef = useRef(null)
  const [musicPos, setMusicPos] = useState({ left: 0, bottom: 0 })
  const navInnerRef = useRef(null)
  const navBtnRefs = useRef({})
  const [navHover, setNavHover] = useState({ left: 0, width: 0, visible: false })
  const [pageHidden, setPageHidden] = useState(false)
  // Measure marquee height to push section content and position exit button
  const marqueeRef = useRef(null)
  const [marqueeHeight, setMarqueeHeight] = useState(0)
  useEffect(() => {
    const measure = () => {
      try {
        const rect = navRef.current ? navRef.current.getBoundingClientRect() : null
        const isHidden = !rect || !isFinite(rect.height) || rect.height <= 0 || !isFinite(rect.bottom)
        if (isHidden) {
          setNavHeight(0)
          navHeightRef.current = 0
          setNavBottomOffset(0)
          return
        }
        const h = Math.round(rect.height)
        setNavHeight(h || 0)
        navHeightRef.current = h || 0
        const off = Math.round((window.innerHeight || rect.bottom) - rect.bottom)
        setNavBottomOffset(Math.max(0, off) || 0)
      } catch { }
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

  // (Re-centering on WORK entry removed — using natural scroll)

  // Pause animations when page is in background
  useEffect(() => {
    const onVis = () => {
      try { setPageHidden(document.visibilityState === 'hidden') } catch { setPageHidden(false) }
    }
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Memory/VRAM watchdog: graceful degradation without pausing audio
  // Memory/resource watchdog — see src/hooks/useMemoryWatchdog.js
  useMemoryWatchdog({ glRef, setDegradedMode })

  const marqueeObserverRef = useRef(null)
  useEffect(() => {
    const measureMarquee = () => {
      try {
        // Only update when we can actually measure — never reset to 0
        // so the padding stays correct during transitions when the marquee
        // is temporarily unmounted
        if (!marqueeRef.current) return
        const h = Math.round(marqueeRef.current.getBoundingClientRect().height)
        if (h > 0) setMarqueeHeight(h)
      } catch { }
    }
    measureMarquee()
    if (typeof ResizeObserver !== 'undefined') {
      if (marqueeObserverRef.current) {
        try { marqueeObserverRef.current.disconnect() } catch { }
      }
      marqueeObserverRef.current = new ResizeObserver(measureMarquee)
      if (marqueeRef.current) marqueeObserverRef.current.observe(marqueeRef.current)
    }
    window.addEventListener('resize', measureMarquee)
    const t2 = setTimeout(measureMarquee, 60)
    return () => {
      window.removeEventListener('resize', measureMarquee)
      if (marqueeObserverRef.current) {
        try { marqueeObserverRef.current.disconnect() } catch { }
      }
      clearTimeout(t2)
    }
  }, [showMarquee, showSectionUi])

  // Measure section container scrollbar width and reserve space for overlays (marquee/parallax)
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

  // (Infinite scroll removed — using natural scroll with Lenis inertia)

  // Position music panel just above its nav button
  useEffect(() => {
    const measureMusicPos = () => {
      try {
        if (!musicBtnRef.current) return
        const r = musicBtnRef.current.getBoundingClientRect()
        const left = Math.round(r.left + r.width / 2)
        const gap = 12 // spacing above the button
        const bottom = Math.max(0, Math.round(window.innerHeight - (r.top - gap)))
        setMusicPos({ left, bottom })
      } catch { }
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

  // Measure liquid highlight in nav
  const updateNavHighlightForEl = (el) => {
    try {
      if (!el || !navInnerRef.current) return
      const PAD = 10 // desired inner padding
      const c = navInnerRef.current.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      // Measure actual container padding for exact alignment
      const styles = window.getComputedStyle(navInnerRef.current)
      const padL = parseFloat(styles.paddingLeft) || PAD
      const padR = parseFloat(styles.paddingRight) || PAD
      // Target exactly 10px between highlight and container edge, and 10px between buttons
      let left = Math.round(r.left - c.left) - (PAD - padL)
      let width = Math.round(r.width) + (PAD - padL) + (PAD - padR)
      if (left < 0) { width += left; left = 0 }
      const maxW = Math.round(c.width)
      if (left + width > maxW) width = Math.max(0, maxW - left)
      // Round to integers to avoid subpixel jitter and ensure symmetry
      left = Math.round(left)
      width = Math.round(width)
      setNavHover({ left, width, visible: true })
    } catch { }
  }

  // History API routing helpers extracted to src/lib/sectionRouting.js
  // (baseUrl, sectionSlug, slugToSection, sectionToPath, pathToSection, extractBlogSlug, extractWorkSlug)

  // Blog post slug state (for deep linking to individual posts)
  const [blogPostSlug, setBlogPostSlug] = useState(() => {
    if (typeof window === 'undefined') return null
    return extractBlogSlug(window.location.pathname)
  })

  // Callback for Section5 to update URL when a post is selected/deselected
  const handleBlogPostSlugChange = useCallback((slug) => {
    setBlogPostSlug(slug)
    if (typeof window === 'undefined') return
    const next = slug ? `${baseUrl}blog/${slug}` : `${baseUrl}blog`
    if (window.location.pathname !== next) {
      window.history.pushState({ section: 'section5', blogSlug: slug || null }, '', next)
    }
  }, [baseUrl])

  // Work project slug state (for deep linking to individual projects)
  const [workProjectSlug, setWorkProjectSlug] = useState(() => {
    if (typeof window === 'undefined') return null
    return extractWorkSlug(window.location.pathname)
  })

  // Callback for Section1 to update URL when a project detail is opened/closed
  const handleWorkSlugChange = useCallback((slug) => {
    setWorkProjectSlug(slug)
    if (typeof window === 'undefined') return
    const next = slug ? `${baseUrl}work/${slug}` : `${baseUrl}work`
    if (window.location.pathname !== next) {
      window.history.pushState({ section: 'section1', workSlug: slug || null }, '', next)
    }
  }, [baseUrl])

  // Pre-load section modules to avoid download/parse on first click
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const preload = () => {
      try { import('./components/Section1.jsx') } catch { }
      try { import('./components/Section2.jsx') } catch { }
      try { import('./components/Section3.jsx') } catch { }
      try { import('./components/Section4.jsx') } catch { }
      try { import('./components/Section5.jsx') } catch { }
    }
    if ('requestIdleCallback' in window) {
      // @ts-ignore
      window.requestIdleCallback(preload, { timeout: 2000 })
    } else {
      setTimeout(preload, 0)
    }
  }, [])

  // Preload basic SFX for Nav
  React.useEffect(() => {
    try { preloadSfx(['hover', 'click']) } catch { }
  }, [])

  // Load songs manifest
  React.useEffect(() => {
    let canceled = false
      ; (async () => {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}songs/manifest.json`, { cache: 'no-cache' })
          const json = await res.json()
          let arr = Array.isArray(json) ? json.slice() : []
          // Manifest order is managed by the CMS Music Editor (set first / drag reorder)
          if (!canceled) setTracks(arr)
        } catch {
          if (!canceled) setTracks([])
        }
      })()
    return () => { canceled = true }
  }, [])

  // Section container visibility and smooth transition control
  // NOTE: This effect must NOT run during active transitions
  useEffect(() => {
    // Skip during any active transition
    if (transitionState.active) return

    if (section !== 'home') {
      setShowSectionUi(true)
      setSectionUiAnimatingOut(false)
      setSectionUiFadeIn(false)
      // Reset scroll on enter (all sections including WORK — first project on top)
      requestAnimationFrame(() => {
        try {
          if (sectionScrollRef.current) {
            sectionScrollRef.current.scrollTop = 0
          }
        } catch { }
        // trigger fade in after mount (slight delay for layout stability)
        setTimeout(() => setSectionUiFadeIn(true), 10)
      })
    } else if (showSectionUi) {
      // Reset scroll instantly before hiding to avoid visible scroll animation
      try { if (sectionScrollRef.current) sectionScrollRef.current.scrollTop = 0 } catch { }
      setSectionUiAnimatingOut(true)
      setSectionUiFadeIn(false)
      const t = setTimeout(() => {
        setShowSectionUi(false)
        setSectionUiAnimatingOut(false)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [section, transitionState.active, showSectionUi])

  // Lock body scroll when section UI is visible
  useEffect(() => {
    const lock = showSectionUi || sectionUiAnimatingOut
    const prev = document.body.style.overflow
    if (lock) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [showSectionUi, sectionUiAnimatingOut])

  // Exit with Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && showSectionUi && !transitionState.active) {
        handleExitSection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSectionUi, transitionState.active, handleExitSection])

  // syncUrl was moved above the transition-system hook call (same function, same behavior).

  // Handle user navigation (back/forward)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => {
      const target = pathToSection(window.location.pathname)
      if (!target) return

      // Update blog post slug from URL
      const blogSlug = extractBlogSlug(window.location.pathname)
      setBlogPostSlug(blogSlug)

      // Update work project slug from URL
      const workSlug = extractWorkSlug(window.location.pathname)
      setWorkProjectSlug(workSlug)

      if (target === 'home') {
        // Immediately restore HOME states
        setShowSectionUi(false)
        setSectionUiAnimatingOut(false)
        if (!transitionState.active && section !== 'home') {
          beginRippleTransition('home')
        }
        return
      }
      if (target !== section && !transitionState.active) {
        beginRippleTransition(target)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [section, transitionState.active])

  // Keep a ref to the player so the camera controller can follow it
  const playerRef = useRef()
  const homeOrbsRef = useRef()
  const [actionCooldown, setActionCooldown] = useState(0)
  const [homeFalling, setHomeFalling] = useState(false)
  const sunRef = useRef()
  const dofTargetRef = playerRef // focus on the player
  // Lazy-init: Vector3 is created on first use (keeps `three` off the eager bundle).
  // Callers must guard with `?.copy(...)` since this starts as null.
  const prevPlayerPosRef = useRef(null)
  const lastPortalIdRef = useRef(null)
  // Avoid creating an extra WebGLRenderer here for detectSupport (unnecessary GPU cost).
  // KTX2 support detection is done in components that already have access to the real renderer.

  // Define portal locations once.  Each portal leads to a specific section.
  // Portals evenly distributed in a circle (5 portals, 72° apart, radius 16)
  const portals = useMemo(
    () => [
      { id: 'section1', position: [0, 0, -16], color: sectionColors['section1'] },                               // 0° (north)
      { id: 'section2', position: [Math.round(16 * Math.sin(2 * Math.PI / 5) * 100) / 100, 0, Math.round(-16 * Math.cos(2 * Math.PI / 5) * 100) / 100], color: sectionColors['section2'] },  // 72°
      { id: 'section3', position: [Math.round(16 * Math.sin(4 * Math.PI / 5) * 100) / 100, 0, Math.round(-16 * Math.cos(4 * Math.PI / 5) * 100) / 100], color: sectionColors['section3'] },  // 144°
      { id: 'section4', position: [Math.round(16 * Math.sin(6 * Math.PI / 5) * 100) / 100, 0, Math.round(-16 * Math.cos(6 * Math.PI / 5) * 100) / 100], color: sectionColors['section4'] },  // 216°
      { id: 'section5', position: [Math.round(16 * Math.sin(8 * Math.PI / 5) * 100) / 100, 0, Math.round(-16 * Math.cos(8 * Math.PI / 5) * 100) / 100], color: sectionColors['section5'] },  // 288°
    ],
    [],
  )

  // Handler called when the player collides with a portal.  We initiate a transition
  // to the target section if we are not already transitioning.
  const handlePortalEnter = (target) => {
    if (!transitionState.active && target !== section) {
      beginSimpleFadeTransition(target, { mode: 'noise', durationMs: 700 })
    }
  }

  // Called by the TransitionOverlay after the shader animation finishes.  We then
  // update the current section and reset the transition state.
  const handleTransitionComplete = () => {
    // Stop psychedelic effects
    try {
      if (typeof stopPsycho === 'function') stopPsycho()
    } catch { }
    setSection(transitionState.to)
    setTransitionState({ active: false, from: transitionState.to || section, to: null })
    if (transitionState.to) syncUrl(transitionState.to)
    // Stop CTA preloader when transition completes
    try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch { }
    setCtaLoading(false)
    setCtaProgress(0)
    // On return to HOME, reset player/camera to default and hide section UI
    if (transitionState.to === 'home') {
      try {
        if (playerRef.current) {
          // Reposition to scene center on return to HOME
          playerRef.current.position.set(0, 0, 0)
          playerRef.current.rotation.set(0, 0, 0)
        }
      } catch { }
      // Restore UI/controls to HOME defaults
      setShowSectionUi(false)
      setSectionUiAnimatingOut(false)
      setUiHintPortalId(null)
      setNearPortalId(null)
      // Hide CTA without animation and clear timers on return to HOME
      try { if (ctaHideTimerRef.current) { clearTimeout(ctaHideTimerRef.current); ctaHideTimerRef.current = null } } catch { }
      setShowCta(false)
      setCtaAnimatingOut(false)
      setCtaLoading(false)
      setCtaProgress(0)
      // Debounce: hide CTA briefly after landing in HOME to prevent flash
      setCtaForceHidden(true)
      try { if (ctaForceTimerRef.current) clearTimeout(ctaForceTimerRef.current) } catch { }
      ctaForceTimerRef.current = window.setTimeout(() => { setCtaForceHidden(false); ctaForceTimerRef.current = null }, 600)
      setTintFactor(0)
      try { if (mainControlsRef.current) mainControlsRef.current.enabled = true } catch { }
      // Reveal shortly after so the character's landing animation is visible
      setTimeout(() => setBlackoutVisible(false), 80)
    }
    // Show active section banner for 1.8s
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

  // ── Game Toasts: feedback for user actions ──
  const prevMusicRef = useRef(showMusic)
  const prevLangRef = useRef(lang)
  const prevCameraRef = useRef(cameraMode)
  const prevSectionRef = useRef(section)
  const toastInitRef = useRef(false)
  useEffect(() => {
    // Skip first render to avoid toasts on mount
    if (!toastInitRef.current) { toastInitRef.current = true; return }
    if (showMusic !== prevMusicRef.current) {
      prevMusicRef.current = showMusic
      gameToast({ message: showMusic ? (lang === 'es' ? 'DJ Mode on' : 'DJ Mode on') : (lang === 'es' ? 'DJ Mode off' : 'DJ Mode off'), type: 'info', icon: <MusicalNoteIcon className="w-4 h-4" />, duration: 2000 })
    }
  }, [showMusic]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toastInitRef.current) return
    if (lang !== prevLangRef.current) {
      prevLangRef.current = lang
      gameToast({ message: lang === 'es' ? 'Idioma: Espanol' : 'Language: English', type: 'info', duration: 2000 })
    }
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toastInitRef.current) return
    if (cameraMode !== prevCameraRef.current) {
      prevCameraRef.current = cameraMode
      gameToast({ message: cameraMode === 'third-person' ? (lang === 'es' ? 'Camara: tercera persona' : 'Camera: third person') : (lang === 'es' ? 'Camara: vista superior' : 'Camera: top-down'), type: 'info', icon: <VideoCameraIcon className="w-4 h-4" />, duration: 2000 })
    }
  }, [cameraMode]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toastInitRef.current) return
    if (section !== prevSectionRef.current && section !== 'home' && showSectionUi) {
      prevSectionRef.current = section
      gameToast({ message: sectionLabel[section] || section, type: 'portal', borderColor: sectionColors[section], duration: 2500 })
    } else {
      prevSectionRef.current = section
    }
  }, [section, showSectionUi]) // eslint-disable-line react-hooks/exhaustive-deps

  // CTA control with exit animation
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

  // If blackout is active (exit to HOME or transitions), immediately hide CTA without animation
  React.useEffect(() => {
    if (blackoutVisible) {
      setShowCta(false)
      setCtaAnimatingOut(false)
    }
  }, [blackoutVisible])

  // Marquee control (persistent during section transitions)
  React.useEffect(() => {
    if (marqueeForceHidden) {
      setShowMarquee(false)
      setMarqueeAnimatingOut(false)
      return
    }
    if (landingBannerActive) {
      setShowMarquee(true)
      // Block exit animation while landing banner is active
      setMarqueeAnimatingOut(false)
      return
    }
    // During active transition to a section, keep marquee visible with target label
    if (((transitionState.active && transitionState.to && transitionState.to !== 'home')
      || (ctaLoading && transitionState.to && transitionState.to !== 'home'))) {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(transitionState.to)
      return
    }
    // Bridge between transition end and section UI mount: if already in a section, keep visible
    if (section !== 'home') {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(section)
      return
    }
    // In sections (UI visible), fixed marquee with section label
    if (showSectionUi) {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(section)
      return
    }
    // In HOME: only when standing near a portal (near/uiHint)
    const shouldShowHome = Boolean(section === 'home' && (nearPortalId || uiHintPortalId))
    if (shouldShowHome) {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(nearPortalId || uiHintPortalId || section)
      if (marqueeHideTimerRef.current) { clearTimeout(marqueeHideTimerRef.current); marqueeHideTimerRef.current = null }
      return
    }
    // If none of the above, hide (no debounce)
    if (showMarquee) {
      setMarqueeAnimatingOut(true)
      if (marqueeHideTimerRef.current) clearTimeout(marqueeHideTimerRef.current)
      marqueeHideTimerRef.current = window.setTimeout(() => {
        // If a landing banner starts, don't trigger exit
        if (!landingBannerActive) {
          setShowMarquee(false)
          setMarqueeAnimatingOut(false)
        }
        marqueeHideTimerRef.current = null
      }, 200)
    }
  }, [marqueeForceHidden, landingBannerActive, ctaLoading, transitionState.to, showSectionUi, section, nearPortalId, uiHintPortalId, showMarquee])

  // Avoid unnecessary re-entry: animate only on hidden -> visible change
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

  // Force quick fade-to-black when exiting a section to hide flickers
  useEffect(() => {
    if (!transitionState.active) return
    if (transitionState.from !== 'home' && transitionState.to === 'home') {
      // Temporarily change 'to' color to black for 200ms
      // using forceOnceKey to recreate the overlay if needed
    }
  }, [transitionState])

  const [tintFactor, setTintFactor] = useState(0)
  // Throttle scene color recomputation, damping abrupt changes
  const sceneColor = useMemo(() => {
    const baseBg = '#022dd6'
    const nearColor = '#011d8a'
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
  // Color helpers
  function lightenHexColor(hex, amount = 0.4) {
    try {
      const c = parseInt(hex.slice(1), 16)
      const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255
      const lr = Math.round(r + (255 - r) * amount)
      const lg = Math.round(g + (255 - g) * amount)
      const lb = Math.round(b + (255 - b) * amount)
      return `#${((1 << 24) + (lr << 16) + (lg << 8) + lb).toString(16).slice(1)}`
    } catch { return hex }
  }
  // Prioritize egg color, otherwise apply dampened color
  const effectiveSceneColor = eggActive ? redEgg : sceneColor
  // During psychedelic effect, lighten background to avoid swallowing the warp
  const psychoSceneColor = fx.psychoEnabled ? lightenHexColor(effectiveSceneColor, 0.45) : effectiveSceneColor

  // IMPORTANT: prevent invisible overlays from blocking canvas drag.
  // Section UI may be mounted with opacity=0.
  // In that case, it must have pointer-events: none.
  const sectionUiCanInteract = (showSectionUi && !sectionUiAnimatingOut)

  // DEV: "panic reset" to escape stuck states (gray screen/overlays).
  const devPanicReset = React.useCallback(() => {
    try { setTransitionState({ active: false, from: section, to: null }) } catch { }
    try { setNoiseMixEnabled(false); setPrevSceneTex(null); setNoiseMixProgress(0); rippleMixRef.current.v = 0 } catch { }
    try { setNoiseOverlayActive(false); setNoisePrevTex(null); setNoiseNextTex(null); setNoiseProgress(0) } catch { }
    try { setGridOverlayActive(false); setGridPhase('out') } catch { }
    try { setShowSectionPreloader(false); setSectionPreloaderFading(false) } catch { }
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch { }
    try { setShowSectionUi(false); setSectionUiAnimatingOut(false); setSectionUiFadeIn(false) } catch { }
    try { setShowCta(false); setCtaAnimatingOut(false); setCtaLoading(false); setCtaProgress(0); setCtaForceHidden(false) } catch { }
    try { setShowMarquee(false); setMarqueeAnimatingOut(false); setMarqueeForceHidden(false) } catch { }
    try { setNearPortalId(null); setUiHintPortalId(null) } catch { }
    // Force ready state
    try { setBootLoading(false); setShowPreloaderOverlay(false); setPreloaderFadingOut(false) } catch { }
    try { setNavTarget('home'); setSection('home'); syncUrl('home') } catch { }
  }, [section])

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    try { window.__panicReset = devPanicReset } catch { }
    const onKeyDown = (e) => {
      try {
        if (e.key === 'F9') devPanicReset()
      } catch { }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { try { window.removeEventListener('keydown', onKeyDown) } catch { } }
  }, [devPanicReset])



  return (
    <div className={`w-full h-full relative overflow-hidden ${(isCompactUi && section === 'home') ? 'home-touch-no-select' : ''}`}>
      {/* The main WebGL canvas */}
      {/* Lazy — keeps three/@react-three/drei/postfx out of the eager bundle.
          The HTML boot preloader (z-20000 overlay) shows while this chunk loads. */}
      <Suspense fallback={null}>
        <HomeCanvas
          glRef={glRef}
          setDegradedMode={setDegradedMode}
          pageHidden={pageHidden}
          showPreloaderOverlay={showPreloaderOverlay}
          showSectionUi={showSectionUi}
          sectionUiAnimatingOut={sectionUiAnimatingOut}
          transitionState={transitionState}
          noiseMixEnabled={noiseMixEnabled}
          mainWarmStage={mainWarmStage}
          psychoSceneColor={psychoSceneColor}
          effectiveSceneColor={effectiveSceneColor}
          isMobilePerf={isMobilePerf}
          degradedMode={degradedMode}
          fxWarm={fxWarm}
          prevSceneTex={prevSceneTex}
          eggActive={eggActive}
          boltFlashActive={boltFlashActive}
          vhsRewindActive={vhsRewindActive}
          section={section}
          homeLanded={homeLanded}
          spheresTutorialOpen={spheresTutorialOpen}
          sphereGameActive={sphereGameActive}
          cheatDragEnabled={cheatDragEnabled}
          bootLoading={bootLoading}
          goldSkinModelActive={goldSkinModelActive}
          goldSkinTransformActive={goldSkinTransformActive}
          navTarget={navTarget}
          preloaderFadingOut={preloaderFadingOut}
          blackoutVisible={blackoutVisible}
          orbActiveUi={orbActiveUi}
          playerMoving={playerMoving}
          nearPortalId={nearPortalId}
          actionCooldown={actionCooldown}
          cameraMode={cameraMode}
          playerMeshes={playerMeshes}
          portalMixMap={portalMixMap}
          portals={portals}
          noiseMixProgress={noiseMixProgress}
          fx={fx}
          playerRef={playerRef}
          homeOrbsRef={homeOrbsRef}
          sunRef={sunRef}
          mainControlsRef={mainControlsRef}
          dofTargetRef={dofTargetRef}
          bannerTimerRef={bannerTimerRef}
          ctaForceTimerRef={ctaForceTimerRef}
          lastPortalIdRef={lastPortalIdRef}
          autoEnterOnArrivalRef={autoEnterOnArrivalRef}
          prevPlayerPosRef={prevPlayerPosRef}
          gridOutTimerRef={gridOutTimerRef}
          preloaderGridOutPendingRef={preloaderGridOutPendingRef}
          preloaderHideTimerRef={preloaderHideTimerRef}
          lastExitedSectionRef={lastExitedSectionRef}
          setTintFactor={setTintFactor}
          setPortalMixMap={setPortalMixMap}
          setNearPortalId={setNearPortalId}
          setBlackoutImmediate={setBlackoutImmediate}
          setBlackoutVisible={setBlackoutVisible}
          setMarqueeAnimatingOut={setMarqueeAnimatingOut}
          setMarqueeForceHidden={setMarqueeForceHidden}
          setMarqueeLabelSection={setMarqueeLabelSection}
          setShowMarquee={setShowMarquee}
          setLandingBannerActive={setLandingBannerActive}
          setCtaForceHidden={setCtaForceHidden}
          setShowCta={setShowCta}
          setCtaAnimatingOut={setCtaAnimatingOut}
          setUiHintPortalId={setUiHintPortalId}
          setGridPhase={setGridPhase}
          setGridOverlayActive={setGridOverlayActive}
          setCharacterReady={setCharacterReady}
          setNavTarget={setNavTarget}
          setPortraitGlowV={setPortraitGlowV}
          setOrbActiveUi={setOrbActiveUi}
          setPlayerMoving={setPlayerMoving}
          setActionCooldown={setActionCooldown}
          setPreloaderFadingOut={setPreloaderFadingOut}
          setHomeLanded={setHomeLanded}
          setSpheresTutorialOpen={setSpheresTutorialOpen}
          setPlayerMeshes={setPlayerMeshes}
          GRID_OUT_MS={GRID_OUT_MS}
          GRID_DELAY_MS={GRID_DELAY_MS}
          handlePortalEnter={handlePortalEnter}
          handleCheatCapture={handleCheatCapture}
          handleBlockedDragAttempt={handleBlockedDragAttempt}
          beginGridRevealTransition={beginGridRevealTransition}
          beginLiquidWipe={beginLiquidWipe}
          playSfx={playSfx}
        />
      </Suspense>

      {/* Preloader overlay - HTML only (no 3D scene) */}
      {showPreloaderOverlay && (
        <PreloaderContent
          t={t}
          lang={lang}
          setLang={setLang}
          bootAllDone={bootAllDone}
          bootProgress={bootProgress}
          scenePreMounted={scenePreMounted}
          preloaderFadingOut={preloaderFadingOut}
          setAudioReady={setAudioReady}
          exitToHomeLikeExitButton={exitToHomeLikeExitButton}
        />
      )}
      {/* Scrollable sections with smooth transition and section background */}
      {(!showPreloaderOverlay && (showSectionUi || sectionUiAnimatingOut)) && (
        <div
          ref={sectionScrollRef}
          className={`fixed inset-0 z-[10] overflow-y-auto section-scroll ${sectionUiCanInteract ? 'pointer-events-auto' : 'pointer-events-none'}`}
          data-section={section}
          style={{
            backgroundColor: sectionBgOverrides[section] || sectionColors[section] || '#000000',
            overflowAnchor: 'none',
            overflowY: 'auto',
            opacity: (noiseMixEnabled && !prevSceneTex)
              ? 1
              : ((sectionUiFadeIn && showSectionUi && !sectionUiAnimatingOut) ? 1 : 0),
            transition: (noiseMixEnabled && !prevSceneTex) ? 'opacity 0ms' : 'opacity 500ms ease',
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
            } catch { }
          }}
          data-section-scroll
        >
          <div className="min-h-screen w-full" style={{ paddingTop: `${marqueeHeight}px`, overscrollBehavior: 'contain' }}>
            <Suspense fallback={null}>
              <div className={`relative mx-auto px-6 sm:px-8 pt-6 pb-12 ${section === 'section3' ? 'max-w-7xl' : 'max-w-5xl'}`}>
                {section === 'section1' && <Section1 scrollerRef={sectionScrollRef} scrollbarOffsetRight={scrollbarW} scrollVelocityRef={scrollVelocityRef} lenisRef={lenisRef} initialSlug={workProjectSlug} onSlugChange={handleWorkSlugChange} />}
                {section === 'section2' && <Section2 scrollVelocityRef={scrollVelocityRef} />}
                {section === 'section3' && <Section3 />}
                {section === 'section4' && <Section4 />}
                {section === 'section5' && <Section5 initialPostSlug={blogPostSlug} onPostSlugChange={handleBlogPostSlugChange} />}
              </div>
            </Suspense>
          </div>
          {/* Minimal nav overlay removed in section view */}
        </div>
      )}

      {/* CTA: Cross the portal (appears when player is near a portal) */}
      <PortalCTA
        show={(showCta || ctaAnimatingOut || ctaLoading)
          && (!transitionState.active || ctaLoading)
          && !ctaForceHidden
          && !blackoutVisible
          && (((section === 'home') && !showSectionUi && !sectionUiAnimatingOut) || ctaLoading)}
        compact={isCompactUi}
        nearPortalId={nearPortalId}
        uiHintPortalId={uiHintPortalId}
        ctaLoading={ctaLoading}
        ctaProgress={ctaProgress}
        ctaColor={ctaColor}
        t={t}
        onEnter={handleCTAEnter}
      />

      {/* Section title marquee - controlled by uiAnimPhase */}
      {/* IMPORTANT: Keep mounted to avoid abrupt appearance/disappearance */}
      {/* Use CSS transitions for smooth enter/exit synchronized with uiAnimPhase */}
      {(showMarquee || marqueeAnimatingOut) && !showPreloaderOverlay && !preloaderFadingOut && (
        <div
          ref={marqueeRef}
          className={`fixed top-0 left-0 right-0 z-[20] pointer-events-none pt-0 pb-2 ${
            // Priority 1: UI exiting animation (must complete before hiding)
            uiAnimPhase === 'exiting'
              ? 'animate-ui-exit-up'
              // Priority 2: UI entering animation  
              : uiAnimPhase === 'entering'
                ? 'animate-ui-enter-down'
                // Priority 3: Hidden state (after animations complete)
                : uiAnimPhase === 'hidden' || gridOverlayActive
                  ? 'opacity-0 -translate-y-full transition-all duration-300 ease-out'
                  // Priority 4: Marquee-specific animations (near portal in HOME)
                  : marqueeAnimateIn
                    ? 'animate-ui-enter-down'
                    : marqueeAnimatingOut
                      ? 'animate-ui-exit-up'
                      // Default: visible
                      : 'opacity-100 translate-y-0 transition-all duration-300 ease-out'
            }`}
          style={{ right: `${scrollbarW}px` }}
        >
          {(() => {
            // Seamless marquee: dos mitades idénticas como flex-children en un
            // inline-flex. Translate -50% lleva la mitad B exactamente a la
            // posición de la mitad A → loop sin brinco. `key` basado en el
            // label hace que la animación se reinicie limpia cuando cambia el
            // texto (ej. al pasar a otra sección) en vez de recalcular -50%
            // a medio ciclo con un ancho distinto.
            const label = marqueeLabel[marqueeLabelSection || nearPortalId || uiHintPortalId || section]
              || ((marqueeLabelSection || nearPortalId || uiHintPortalId || section || '').toUpperCase())
            const tilesPerHalf = 8
            const halfTiles = Array.from({ length: tilesPerHalf })
            const bannerStyle = {
              fontFamily: "'Luckiest Guy', Archivo Black, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
              WebkitTextStroke: '1px rgba(255,255,255,0.08)'
            }
            return (
              <div className="overflow-hidden w-full">
                <div
                  key={label}
                  className="inline-flex flex-nowrap opacity-95 will-change-transform"
                  style={{ animation: 'marquee-seamless 90s linear infinite' }}
                >
                  {[0, 1].map((half) => (
                    <div key={half} className="flex flex-nowrap flex-shrink-0" aria-hidden={half === 1 ? true : undefined}>
                      {halfTiles.map((_, i) => (
                        <span key={i} className="title-banner" style={bannerStyle}>
                          {label}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* --- TOP LEFT (mobile): Camera toggle — floating on its own so it's always reachable --- */}
      {isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
        <div className={`pointer-events-none fixed top-4 left-4 z-[999993] transition-opacity duration-200 ${showMusic ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${uiAnimPhase === 'entering' ? 'animate-ui-enter-left' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-left' : ''}`}>
          <button
            type="button"
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setCameraMode((m) => m === 'third-person' ? 'top-down' : 'third-person') }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
            className={`pointer-events-auto h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-3xl border transition-colors ${cameraMode === 'third-person' ? 'bg-sky-400/15 border-sky-400 text-white shadow-glow-terminal' : 'bg-black/40 border-white/[0.12] text-white hover:bg-white/[0.15]'}`}
            aria-label={t('tutorial.slide3.camera')}
            title={t('tutorial.slide3.camera')}
          >
            <VideoCameraIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* --- TOP RIGHT CONTROLS (Both Desktop & Mobile): Cheat Terminal + Auth --- */}
      {!showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
        <div
          // Wrapper de push por marquee. Vive como fixed bar arriba y
          // aplica transform → los `animate-ui-enter-right` / `-exit-right`
          // del inner usan transform en su propio elemento y no se pisan.
          className="fixed top-0 left-0 right-0 z-[999993] pointer-events-none"
          style={{
            transform: `translateY(${showMarquee ? marqueeHeight : 0}px)`,
            transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
        <div
          key="top-right-group"
          className={`pointer-events-auto absolute top-4 right-4 md:top-10 md:right-10 flex items-center gap-3 transition-opacity duration-200 ${showMusic ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${uiAnimPhase === 'entering' ? 'animate-ui-enter-right' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-right' : ''}`}
          style={{ paddingRight: `${(scrollbarW || 0)}px` }}
        >
          {/* Cheat Terminal */}
          <button
            type="button"
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setCheatTerminalOpen(true) }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
            className="h-11 w-11 md:h-12 md:w-12 rounded-full grid place-items-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-3xl border border-white/[0.08] transition-colors bg-black/40 text-white hover:bg-white/[0.15]"
            aria-label="Cheat Terminal"
            title="Cheat Terminal"
          >
            <CommandLineIcon className="w-5 h-5" />
          </button>
          
          {/* Auth Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; if (authenticated) setAuthMenuOpen(v => !v); else { sessionStorage.setItem('skip_preloader', '1'); login(); } }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              className="h-11 w-11 md:h-12 md:w-12 rounded-full grid place-items-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-3xl border border-white/[0.08] transition-colors bg-black/40 text-white hover:bg-white/[0.15]"
              aria-label={authenticated ? "Profile Menu" : "Login"}
              title={authenticated ? "Profile Menu" : "Login"}
            >
              <UserIcon className="w-5 h-5" />
            </button>
            {/* Online indicator — outside the button, bottom-right */}
            {authenticated && (
              <div className="absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] rounded-full bg-green-500 shadow-[0_0_6px_#22c55e] ring-2 ring-[#0a0a14] pointer-events-none" />
            )}

            {/* Logout Tooltip */}
            {authenticated && authMenuOpen && (
              <div className="absolute right-0 top-full mt-3 z-50 animate-ui-enter-down">
                <button
                  type="button"
                  onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; logout(); setAuthMenuOpen(false); }}
                  className="px-4 py-2 bg-black/60 backdrop-blur-3xl text-red-400 text-sm tracking-wide rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.6)] border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition-colors whitespace-nowrap flex items-center gap-2"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Terminal HUD Cluster (compact mode): 2x2 unified panel with glass-terminal + Icon variant buttons.
          Design tokens only — see DESIGN.md §4.2 (Icon), §6.1 (glass-terminal), §1.3 (semantic accents).
          Fans keep original disclosure pattern (Progressive Information Disclosure, game-ui-design). */}
      {isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
        <div
          key="mobile-controls"
          ref={compactControlsRef}
          className={`pointer-events-none fixed right-4 bottom-4 z-[999992] transition-opacity duration-200 ${showMusic ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${uiAnimPhase === 'entering' ? 'animate-ui-enter-right' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-right' : ''}`}
          style={{ marginRight: `${(scrollbarW || 0)}px` }}
        >
          {/* Synthesized mobile cluster — just 2 floating buttons: Music (always visible) + Menu.
              Heart/Settings actions live inside the nav overlay to reduce on-screen clutter. */}
          <div className="pointer-events-auto relative flex flex-col items-center gap-3">
            {/* Music — always visible per user request */}
            <button
              type="button"
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setShowMusic((v) => !v) }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              className={`h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-3xl border transition-colors ${showMusic ? 'bg-blue-500/15 border-blue-500 text-white shadow-glow-terminal' : 'bg-black/40 border-white/[0.12] text-white hover:bg-white/[0.15]'}`}
              aria-label="Music"
              title="Music"
            >
              <MusicalNoteIcon className={`w-5 h-5 ${showMusic ? 'animate-music-pulse' : ''}`} />
            </button>

            {/* Menu — entry point to sections + settings + socials */}
            <button
              type="button"
              onClick={() => {
                try { playSfx('click', { volume: 1.0 }) } catch { }
                if (menuOpen) closeMenuAnimated()
                else openMenuAnimated()
              }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              className={`h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-3xl border transition-colors ${menuOpen ? 'bg-blue-500/15 border-blue-500 text-white shadow-glow-terminal' : 'bg-black/40 border-white/[0.12] text-white hover:bg-white/[0.15]'}`}
              aria-expanded={menuOpen ? 'true' : 'false'}
              aria-controls="nav-overlay"
              aria-label={t('a11y.openNavigationMenu')}
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {/* Desktop settings: Socials + Gear with fan (dark glass circles) */}
      {!isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
        <div key="desktop-socials-settings" className={`pointer-events-auto fixed right-10 bottom-10 z-[999993] flex gap-3 transition-opacity duration-200 ${showMusic ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${uiAnimPhase === 'entering' ? 'animate-ui-enter-right' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-right' : ''}`}>
          
          <div ref={socialsWrapDesktopRef} className="pointer-events-auto relative" style={{ width: '44px', height: '44px' }}>
            {[
              { key: 'x', href: 'https://x.com/mroscareth', tooltip: 'X', icon: `${import.meta.env.BASE_URL}x.svg`, dx: -52, dy: 0 },
              { key: 'ig', href: 'https://www.instagram.com/mroscar.eth', tooltip: 'Instagram', icon: `${import.meta.env.BASE_URL}instagram.svg`, dx: -104, dy: 0 },
              { key: 'be', href: 'https://www.behance.net/mroscar', tooltip: 'Behance', icon: `${import.meta.env.BASE_URL}behance.svg`, dx: -156, dy: 0 },
            ].map((s) => (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                data-tooltip={s.tooltip}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setSocialsOpen(false) }}
                className="tooltip-black absolute right-0 top-0 h-10 w-10 rounded-full bg-black/50 backdrop-blur-3xl border border-white/[0.08] text-white hover:bg-white/[0.15] grid place-items-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-200"
                style={{
                  transform: socialsOpen ? `translate(${s.dx}px, ${s.dy}px) scale(1)` : 'translate(0px, 0px) scale(0.9)',
                  opacity: socialsOpen ? 1 : 0,
                  pointerEvents: socialsOpen ? 'auto' : 'none',
                }}
                aria-label={s.tooltip}
              >
                <img src={s.icon} alt="" aria-hidden className="w-5 h-5 invert" draggable="false" />
              </a>
            ))}
            <button
              type="button"
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { } setSocialsOpen((v) => !v) }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              className={`absolute right-0 top-0 h-11 w-11 rounded-full bg-black/50 backdrop-blur-3xl border border-white/[0.08] grid place-items-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-colors ${socialsOpen ? 'text-white bg-white/[0.15]' : 'text-white hover:bg-white/[0.08]'}`}
              aria-expanded={socialsOpen ? 'true' : 'false'}
              aria-label="Redes sociales"
              title="Redes sociales"
            >
              <HeartIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Gear fan: Info + Game UI + Camera stacked upward */}
          <div ref={settingsWrapDesktopRef} className="pointer-events-auto relative" style={{ width: '44px', height: '44px' }}>
            {[
              {
                key: 'info',
                tooltip: t('tutorial.showTutorial'),
                active: false,
                onClick: () => setTutorialOpen(true),
                render: () => <InformationCircleIcon className="w-5 h-5" />,
                dx: 0, dy: -52,
              },
              {
                key: 'mobile-ui',
                tooltip: 'Game UI',
                active: forceCompactUi,
                onClick: () => setForceCompactUi((v) => !v),
                render: () => <GamepadIcon className="w-5 h-5" />,
                dx: 0, dy: -104,
              },
              {
                key: 'camera',
                tooltip: t('tutorial.slide3.camera'),
                active: cameraMode === 'third-person',
                onClick: () => setCameraMode((m) => m === 'third-person' ? 'top-down' : 'third-person'),
                render: () => <VideoCameraIcon className="w-5 h-5" />,
                dx: 0, dy: -156,
              },
            ].map((it) => (
              <button
                key={it.key}
                type="button"
                data-tooltip={it.tooltip}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
                onClick={() => {
                  try { playSfx('click', { volume: 1.0 }) } catch { }
                  try { it.onClick?.() } catch { }
                  setSettingsOpen(false)
                }}
                className={`tooltip-black absolute right-0 bottom-0 h-10 w-10 rounded-full grid place-items-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-3xl border border-white/[0.08] transition-all duration-200 ${it.active ? 'bg-white/20 text-white' : 'bg-black/50 text-white'}`}
                style={{
                  transform: settingsOpen ? `translate(${it.dx}px, ${it.dy}px) scale(1)` : 'translate(0px, 0px) scale(0.9)',
                  opacity: settingsOpen ? 1 : 0,
                  pointerEvents: settingsOpen ? 'auto' : 'none',
                }}
                aria-label={it.tooltip}
              >
                {it.render()}
              </button>
            ))}
            {/* Gear button */}
            <button
              type="button"
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { } setSettingsOpen((v) => !v) }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
              className={`absolute right-0 bottom-0 h-11 w-11 rounded-full grid place-items-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-3xl border border-white/[0.08] transition-colors ${settingsOpen ? 'bg-white/20 text-white' : 'bg-black/50 text-white'}`}
              aria-expanded={settingsOpen ? 'true' : 'false'}
              aria-label={t('a11y.toggleSettings')}
              title={t('common.settings')}
            >
              <Cog6ToothIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop nav - Dark Glass HUD */}
      {!isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
        <DesktopNav
          uiAnimPhase={uiAnimPhase}
          showSectionUi={showSectionUi}
          section={section}
          sectionLabel={sectionLabel}
          sections={['section1', 'section2', 'section3', 'section4', 'section5']}
          showMusic={showMusic}
          onSelectSection={handleMenuSectionSelect}
          onToggleMusic={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setShowMusic((v) => !v) }}
          onToggleLang={() => setLang(lang === 'es' ? 'en' : 'es')}
          lang={lang}
          t={t}
          navRef={navRef}
          navInnerRef={navInnerRef}
          navBtnRefs={navBtnRefs}
          navHover={navHover}
          setNavHover={setNavHover}
          updateNavHighlightForEl={updateNavHighlightForEl}
        />
      )}

      {/* Overlay menu */}
      {menuOpen && (
        <NavOverlay
          visible={menuVisible}
          onClose={closeMenuAnimated}
          onSelectSection={handleMenuSectionSelect}
          sections={mobileMenuIds}
          sectionLabel={sectionLabel}
          t={t}
          openTutorial={() => { closeMenuAnimated(); setTutorialOpen(true) }}
          itemAnim={{ inMs: MENU_ITEM_IN_MS, outMs: MENU_ITEM_OUT_MS, stepMs: MENU_ITEM_STEP_MS }}
        />
      )}
      {/* DJ deck modal — mounted always so audio state persists; hidden via CSS when closed */}
      <MusicModal
        open={showMusic}
        onClose={() => setShowMusic(false)}
        tracks={tracks}
        navHeight={navHeight}
        audioReady={audioReady}
        pageHidden={pageHidden}
      />
      {/* Character portrait: controlled by uiAnimPhase */}
      {/* IMPORTANT: Keep mounted to avoid re-creating the 3D canvas (causes flash/reload) */}
      {/* Use CSS opacity/pointer-events instead of unmounting when hidden */}
      {!bootLoading && !showPreloaderOverlay && (
        <Suspense fallback={null}>
        <CharacterPortrait
          key="character-portrait"
          className={
            showMusic
              ? 'opacity-0 pointer-events-none transition-opacity duration-200'
              : uiAnimPhase === 'hidden'
                ? 'opacity-0 pointer-events-none'
                : uiAnimPhase === 'entering'
                  ? 'animate-ui-enter-left'
                  : uiAnimPhase === 'exiting'
                    ? 'animate-ui-exit-left'
                    : 'transition-opacity duration-200'
          }
          paused={uiAnimPhase === 'hidden'}
          showUI={false}
          dotEnabled={fx.dotEnabled}
          dotScale={fx.dotScale}
          dotAngle={fx.dotAngle}
          dotCenterX={fx.dotCenterX}
          dotCenterY={fx.dotCenterY}
          dotOpacity={fx.dotOpacity}
          dotBlend={fx.dotBlend}
          glowVersion={portraitGlowV}
          onEggActiveChange={setEggActive}
          zIndex={999990}
          showExit={section !== 'home'}
          mode={'overlay'}
          actionCooldown={actionCooldown}
          eggEnabled={true}
          eggClicksRequired={5}
          forceCompact={forceCompactUi ? true : undefined}
          goldSkinActive={goldSkinModelActive}
        />
        </Suspense>
      )}

      {/* Shop cart GLOBAL — acompaña al retrato en todas las secciones.
          Lee estado del ShopCartProvider (main.jsx). */}
      {!bootLoading && !showPreloaderOverlay && (
        <Suspense fallback={null}>
          <GlobalShopCart />
        </Suspense>
      )}
      {/* Skin toggle — sólo visible si el user ya desbloqueó el golden ticket.
          Mirror del cart button, sobre la curva superior-izquierda del retrato. */}
      {!bootLoading && !showPreloaderOverlay && goldSkinUnlocked && (
        <Suspense fallback={null}>
          <SkinToggleButton
            unlocked={goldSkinUnlocked}
            preference={skinPreference}
            onToggle={toggleSkin}
            label={lang === 'es'
              ? (skinPreference === 'gold' ? 'Cambiar a skin base' : 'Cambiar a skin dorada')
              : (skinPreference === 'gold' ? 'Switch to base skin' : 'Switch to gold skin')}
          />
        </Suspense>
      )}
      {/* Score HUD - only show when game is active and character has landed */}
      {section === 'home' && !bootLoading && homeLanded && sphereGameActive && (
        <ScoreHUD t={t} isCompactUi={isCompactUi} />
      )}
      {/* END GAME button — floats above nav, only when game is active */}
      {section === 'home' && !bootLoading && homeLanded && sphereGameActive && !gameOverOpen && (
        <div
          className={`pointer-events-auto fixed z-[999992] flex justify-center left-1/2 -translate-x-1/2 ${isCompactUi ? 'bottom-24' : 'bottom-36'}`}
        >
          <button
            type="button"
            onClick={() => {
              try { playSfx('click', { volume: 1.0 }) } catch { }
              setGameOverScore(scoreStore.get())
              setGameOverOpen(true)
              setSphereGameActive(false)
            }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
            className="h-9 px-5 rounded-full bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white text-xs font-marquee uppercase tracking-widest shadow-lg shadow-red-900/30 backdrop-blur-sm transition-all duration-200 animate-ui-enter-up"
          >
            {t('game.endGame')}
          </button>
        </div>
      )}

      {/* Lightning bolt flash overlay (easter egg). z just under the cheat alert. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 99999990,
          background: 'white',
          opacity: boltFlashActive ? 0.92 : 0,
          transition: boltFlashActive
            ? 'opacity 40ms linear'
            : 'opacity 380ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          mixBlendMode: 'screen',
        }}
      />

      {/* VHS rewind OSD during character reassembly (easter egg). */}
      {vhsRewindActive && (
        <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 99999991 }}>
          {/* Scanlines + subtle tracking-line animated band */}
          <div className="absolute inset-0 vhs-scanlines" />
          <div className="absolute inset-x-0 h-[2px] bg-white/40 vhs-tracking-line" />
          {/* REW OSD badge (top-left, VCR style) */}
          <div className="vhs-osd-rew">
            <span className="vhs-osd-triangle">◄◄</span>
            <span className="vhs-osd-label">REW</span>
          </div>
          {/* PLAY-tape-like timestamp (bottom-left) */}
          <div className="vhs-osd-time">SP&nbsp;&nbsp;00:00:00</div>
        </div>
      )}

      {/* Cheat system alert overlay */}
      {cheatAlertVisible && (
        <div className="fixed inset-0 z-[99999999] flex items-center justify-center pointer-events-none">
          <div
            className="relative overflow-hidden border-2 rounded-lg pointer-events-auto cheat-alert-enter"
            style={{
              width: 'min(520px, 90vw)',
              background: 'rgba(0, 0, 0, 0.95)',
              borderColor: cheatCountRef.current >= 3 ? '#dc2626' : '#f59e0b',
              boxShadow: `0 0 60px ${cheatCountRef.current >= 3 ? 'rgba(220, 38, 38, 0.5)' : 'rgba(245, 158, 11, 0.3)'}, inset 0 0 60px ${cheatCountRef.current >= 3 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(245, 158, 11, 0.05)'}`,
              fontFamily: '"Courier New", Courier, monospace',
            }}
          >
            {/* Scanlines overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
                zIndex: 1,
              }}
            />
            {/* Content */}
            <div className="relative p-6" style={{ zIndex: 2 }}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-3 h-3 rounded-full cheat-alert-blink"
                  style={{ backgroundColor: cheatCountRef.current >= 3 ? '#dc2626' : '#f59e0b' }}
                />
                <span
                  className="text-xs uppercase font-bold"
                  style={{
                    color: cheatCountRef.current >= 3 ? '#dc2626' : '#f59e0b',
                    letterSpacing: '0.3em',
                  }}
                >
                  ⚠ SYSTEM ALERT
                </span>
              </div>
              {/* Message */}
              <div
                className="text-lg leading-relaxed"
                style={{ color: cheatCountRef.current >= 3 ? '#fca5a5' : '#fde68a' }}
              >
                {'> '}{cheatAlertText}
                <span className="cheat-alert-cursor">_</span>
              </div>
              {/* Terminal footer */}
              <div
                className="mt-4 text-xs uppercase"
                style={{
                  color: cheatCountRef.current >= 3 ? 'rgba(220, 38, 38, 0.5)' : 'rgba(245, 158, 11, 0.4)',
                  letterSpacing: '0.15em',
                }}
              >
                [M.A.D.R.E. OS v2.0.26]
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Cheat Terminal modal */}
      <CheatTerminal
        open={cheatTerminalOpen}
        onClose={() => setCheatTerminalOpen(false)}
        onCodeAccepted={handleCheatCode}
        goldSkinUnlocked={goldSkinUnlocked}
      />

      {/* Tutorial modal */}
      <TutorialModal
        t={t}
        open={tutorialOpen}
        onClose={() => {
          setTutorialOpen(false)
          markTutorialShown()
        }}
      />
      {/* Sphere game tutorial modal */}
      <SphereGameModal
        t={t}
        open={spheresTutorialOpen}
        onClose={() => setSpheresTutorialOpen(false)}
        gameActive={sphereGameActive}
        onStartGame={() => {
          setSphereGameActive(true)
          scoreStore.reset()
        }}
      />
      {/* Game Over modal */}
      <GameOverModal
        t={t}
        open={gameOverOpen}
        finalScore={gameOverScore}
        authenticated={authenticated}
        userProfile={userProfile}
        onExit={() => {
          setGameOverOpen(false)
          // Full reset of game + cheat state
          scoreStore.reset()
          cheatCountRef.current = 0
          setCheatDragEnabled(true)
          cheatBlockedShownRef.current = false
          // Flush alert queue and dismiss
          cheatAlertQueueRef.current.length = 0
          cheatAlertProcessingRef.current = false
          if (cheatAlertDismissTimerRef.current) clearTimeout(cheatAlertDismissTimerRef.current)
          setCheatAlertVisible(false)
        }}
        onPlayAgain={() => {
          setGameOverOpen(false)
          // Reset everything and restart game immediately
          scoreStore.reset()
          cheatCountRef.current = 0
          setCheatDragEnabled(true)
          cheatBlockedShownRef.current = false
          // Flush alert queue and dismiss
          cheatAlertQueueRef.current.length = 0
          cheatAlertProcessingRef.current = false
          if (cheatAlertDismissTimerRef.current) clearTimeout(cheatAlertDismissTimerRef.current)
          setCheatAlertVisible(false)
          setSphereGameActive(true)
        }}
      />
      {/* Mobile HUD: joystick + horizontal power bar (hamburger breakpoint, HOME, orb off) */}
      {(isMobileUi && section === 'home' && !orbActiveUi) && (
        <MobileJoystickPower
          powerSafeInsets={powerSafeInsets}
          actionCooldown={actionCooldown}
        />
      )}
      {/* Blackout overlay for smooth/instant fade to black */}
      <div
        className="fixed inset-0 z-[50000] pointer-events-none"
        style={{
          background: '#000',
          opacity: (blackoutVisible && !noiseMixEnabled && !transitionState.active && !noiseOverlayActive && !gridOverlayActive) ? 1 : 0,
          transition: blackoutImmediate ? 'none' : 'opacity 300ms ease',
        }}
      />
      {/* Noise mask A/B overlay */}
      <NoiseTransitionOverlay
        active={noiseOverlayActive}
        prevTex={noisePrevTex}
        nextTex={noiseNextTex}
        progress={noiseProgress}
        edge={0.35}
        speed={1.5}
      />
      {/* Grid reveal overlay (covers and uncovers with staggered cells) */}
      <GridRevealOverlay
        active={gridOverlayActive}
        phase={gridPhase}
        center={gridCenter}
        cellSize={64}
        gap={0}
        inDurationMs={280}
        outDurationMs={520}
        delaySpanMs={460}
        forceKey={gridKey}
        onPhaseEnd={onGridPhaseEnd}
        color={sectionColors[preloaderTargetSection] || '#000'}
      />

      {/* Section transition preloader with progressive loading bar */}
      <SectionPreloader
        visible={showSectionPreloader}
        fading={sectionPreloaderFading}
        targetSection={preloaderTargetSection}
        durationMs={SECTION_PRELOADER_MIN_MS}
      />


      {/* Debug HUD disabled - use F9 for panic reset if needed */}
    </div>
  )
}

// GamepadIcon, LOADING_MEMORIES, BlobShadow, PreloaderContent moved to dedicated files — see imports at top.

