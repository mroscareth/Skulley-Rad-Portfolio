import React, { useRef, useState, useMemo, useCallback, Suspense, lazy, useEffect } from 'react'
import gsap from 'gsap'
import Lenis from 'lenis'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Environment from './components/Environment.jsx'
import { AdaptiveDpr } from '@react-three/drei'
import html2canvas from 'html2canvas'
import PauseFrameloop from './components/PauseFrameloop.jsx'
import Player from './components/Player.jsx'
import HomeOrbs from './components/HomeOrbs.jsx'
import ScoreHUD from './components/ScoreHUD.jsx'
import Portal from './components/Portal.jsx'
import CameraController from './components/CameraController.jsx'
import TransitionOverlay from './components/TransitionOverlay.jsx'
import CharacterPortrait from './components/CharacterPortrait.jsx'
import PowerBar from './components/PowerBar.jsx'
import PostFX from './components/PostFX.jsx'
import Section1 from './components/Section1.jsx'
import PortalParticles from './components/PortalParticles.jsx'
import MusicPlayer from './components/MusicPlayer.jsx'
import MobileJoystick from './components/MobileJoystick.jsx'
import { MusicalNoteIcon, XMarkIcon, Bars3Icon, ChevronUpIcon, ChevronDownIcon, HeartIcon, Cog6ToothIcon, ArrowPathIcon, VideoCameraIcon, InformationCircleIcon } from '@heroicons/react/24/solid'
import FrustumCulledGroup from './components/FrustumCulledGroup.jsx'
import { playSfx, preloadSfx } from './lib/sfx.js'
import scoreStore from './lib/scoreStore.js'
import NoiseTransitionOverlay from './components/NoiseTransitionOverlay.jsx'
import ImageMaskTransitionOverlay from './components/ImageMaskTransitionOverlay.jsx'
import GridRevealOverlay from './components/GridRevealOverlay.jsx'
import UnifiedTransitionOverlay from './components/UnifiedTransitionOverlay.jsx'
import SimpleTransitionOverlay, { useSimpleTransition } from './components/SimpleTransitionOverlay.jsx'
import { useSceneTransition, TransitionEffect } from './lib/useSceneTransition.js'
import { useLanguage } from './i18n/LanguageContext.jsx'
import GlobalCursor from './components/GlobalCursor.jsx'
import TutorialModal, { useTutorialShown } from './components/TutorialModal.jsx'
import SphereGameModal from './components/SphereGameModal.jsx'
import GameOverModal from './components/GameOverModal.jsx'
import FloatingExclamation from './components/FloatingExclamation.jsx'
import Typewriter from 'typewriter-effect'
import FakeGrass from './components/FakeGrass.jsx'
import SectionPreloader from './components/SectionPreloader.jsx'
const Section2 = lazy(() => import('./components/Section2.jsx'))
const Section3 = lazy(() => import('./components/Section3.jsx'))
const Section4 = lazy(() => import('./components/Section4.jsx'))

// Admin Dashboard (lazy loaded)
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

// Cheap abstract blob shadow (no shadow maps or ContactShadows RTT)
function BlobShadow({
  playerRef,
  enabled = true,
  size = 0.5,
  opacity = 1,
  // Fine control of dark center intensity (0..1)
  innerAlpha = 0.9,
  midAlpha = 0.3,
}) {
  const tex = useMemo(() => {
    try {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 256
      const ctx = c.getContext('2d')
      if (!ctx) return null
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
      // Higher contrast so it's visible even with halftone/post effects
      g.addColorStop(0.0, `rgba(0,0,0,${Math.max(0, Math.min(1, innerAlpha))})`)
      g.addColorStop(0.45, `rgba(0,0,0,${Math.max(0, Math.min(1, midAlpha))})`)
      g.addColorStop(1.0, 'rgba(0,0,0,0)')
      ctx.clearRect(0, 0, 256, 256)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 256, 256)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.needsUpdate = true
      return t
    } catch {
      return null
    }
  }, [innerAlpha, midAlpha])
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!enabled) return
    if (!ref.current || !playerRef?.current) return
    try {
      playerRef.current.getWorldPosition(tmp)
      // Slightly above ground to avoid z-fighting
      ref.current.position.set(tmp.x, 0.02, tmp.z)
    } catch {}
  })
  useEffect(() => () => { try { tex?.dispose?.() } catch {} }, [tex])
  if (!enabled || !tex) return null
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      // Always visible (abstract shadow)
      renderOrder={50}
      frustumCulled={false}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-2}
      />
    </mesh>
  )
}

// Critical WORK image URLs (avoid importing Section1.jsx)
function getWorkImageUrls() {
  try {
    return [`${import.meta.env.BASE_URL}Etherean.jpg`]
  } catch {
    return []
  }
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
  // Detect /admin route to render the admin dashboard
  const isAdminRoute = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname.startsWith('/admin')
  }, [])

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

  const { lang, setLang, t } = useLanguage()
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
    } catch {}
    
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
    // Liquid warp
    liquidStrength: 0.0,
    liquidScale: 3.0,
    liquidSpeed: 1.2,
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
  const [orbActiveUi, setOrbActiveUi] = useState(false)
  const [playerMoving, setPlayerMoving] = useState(false)
  // Character meshes for outline postprocessing
  const [playerMeshes, setPlayerMeshes] = useState([])
  const glRef = useRef(null)
  // Start in degraded (lowPerf) mode by default for smooth experience;
  // the memory watchdog can still toggle it if resources drop low enough to recover.
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
    try { localStorage.setItem('cameraMode', cameraMode) } catch {}
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
  const { shown: tutorialShown, markAsShown: markTutorialShown } = useTutorialShown()
  const [tracks, setTracks] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const mobileMenuIds = ['section1', 'section2', 'section3', 'section4'] // Work, About, Store, Contact
  // Menu overlay animation (mobile): keep mounted during exit animation
  const MENU_ANIM_MS = 260
  // Staggered item animation
  const MENU_ITEM_IN_MS = 260
  const MENU_ITEM_OUT_MS = 200
  const MENU_ITEM_STEP_MS = 100 // delay between each button start
  const [menuVisible, setMenuVisible] = useState(false)
  const menuAnimTimerRef = useRef(null)
  const openMenuAnimated = React.useCallback(() => {
    try { if (menuAnimTimerRef.current) { clearTimeout(menuAnimTimerRef.current); menuAnimTimerRef.current = null } } catch {}
    setMenuOpen(true)
    // Activate immediately: keyframes fill-mode handles the initial delay state
    setMenuVisible(true)
  }, [])
  const closeMenuAnimated = React.useCallback(() => {
    // Skip if already closed or unmounted
    setMenuVisible(false)
    try { if (menuAnimTimerRef.current) clearTimeout(menuAnimTimerRef.current) } catch {}
    const totalOutMs = MENU_ITEM_OUT_MS + Math.max(0, (mobileMenuIds.length - 1)) * MENU_ITEM_STEP_MS
    menuAnimTimerRef.current = window.setTimeout(() => {
      setMenuOpen(false)
      menuAnimTimerRef.current = null
    }, Math.max(MENU_ANIM_MS, totalOutMs) + 80)
  }, [MENU_ITEM_OUT_MS, MENU_ITEM_STEP_MS, MENU_ANIM_MS, mobileMenuIds.length])
  useEffect(() => {
    return () => { try { if (menuAnimTimerRef.current) clearTimeout(menuAnimTimerRef.current) } catch {} }
  }, [])

  // Socials fan: close on outside click or Escape
  const socialsWrapMobileRef = useRef(null)
  const socialsWrapDesktopRef = useRef(null)
  // Settings fan (mobile/compact & desktop): close on outside click or Escape
  const settingsWrapMobileRef = useRef(null)
  const settingsWrapDesktopRef = useRef(null)
  // Right-side compact controls column: used to compute power bar safe area
  const compactControlsRef = useRef(null)
  useEffect(() => {
    if (!socialsOpen) return () => {}
    const onKey = (e) => { try { if (e.key === 'Escape') setSocialsOpen(false) } catch {} }
    const onDown = (e) => {
      try {
        const t = e?.target
        const m = socialsWrapMobileRef.current
        const d = socialsWrapDesktopRef.current
        if ((m && m.contains && m.contains(t)) || (d && d.contains && d.contains(t))) return
        setSocialsOpen(false)
      } catch {}
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [socialsOpen])
  useEffect(() => {
    if (!settingsOpen) return () => {}
    const onKey = (e) => { try { if (e.key === 'Escape') setSettingsOpen(false) } catch {} }
    const onDown = (e) => {
      try {
        const t = e?.target
        const m = settingsWrapMobileRef.current
        const d = settingsWrapDesktopRef.current
        if ((m && m.contains && m.contains(t)) || (d && d.contains && d.contains(t))) return
        setSettingsOpen(false)
      } catch {}
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [settingsOpen])
  // Noise-mask transition (prev -> next)
  const [prevSceneTex, setPrevSceneTex] = useState(null)
  const [noiseMixEnabled, setNoiseMixEnabled] = useState(false)
  const [noiseMixProgress, setNoiseMixProgress] = useState(0)
  const rippleMixRef = useRef({ v: 0 })
  

  async function captureCanvasFrameAsTexture() {
    try {
      const gl = glRef.current
      if (!gl || !gl.domElement) return null
      // Wait 2 frames to ensure the canvas has the latest frame drawn
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const src = gl.domElement
      // Synchronous snapshot: copy to an offscreen 2D canvas and create CanvasTexture
      const off = document.createElement('canvas')
      off.width = src.width
      off.height = src.height
      const ctx2d = off.getContext('2d')
      if (!ctx2d) return null
      ctx2d.drawImage(src, 0, 0)
      const tex = new THREE.CanvasTexture(off)
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.flipY = false
      tex.needsUpdate = true
      return tex
    } catch {
      return null
    }
  }
  // Capture WebGL framebuffer to texture via GPU (avoids CORS/taint from 2D canvas)
  async function captureCanvasFrameAsTextureGPU() {
    try {
      const renderer = glRef.current
      if (!renderer) return null
      // Ensure the current frame is ready
      await new Promise((r) => requestAnimationFrame(r))
      const size = new THREE.Vector2()
      renderer.getSize(size)
      const w = Math.max(1, Math.floor(size.x * (renderer.getPixelRatio?.() || 1)))
      const h = Math.max(1, Math.floor(size.y * (renderer.getPixelRatio?.() || 1)))
      const tex = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.flipY = false
      // Copy the current framebuffer to the texture (level 0)
      renderer.copyFramebufferToTexture(new THREE.Vector2(0, 0), tex, 0)
      return tex
    } catch {
      return null
    }
  }
  // Capture full viewport (GL + DOM) as dataURL, avoiding html2canvas CANVAS cloning.
  async function captureViewportDataURL() {
    try {
      const gl = glRef.current
      const base = document.createElement('canvas')
      const ctx = base.getContext('2d')
      if (!ctx) return null
      let w = Math.max(1, Math.floor(window.innerWidth))
      let h = Math.max(1, Math.floor(window.innerHeight))
      let scale = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1))
      if (gl && gl.domElement) {
        // Use physical canvas size to maintain sharpness
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        w = gl.domElement.width
        h = gl.domElement.height
        base.width = w
        base.height = h
        try { ctx.drawImage(gl.domElement, 0, 0, w, h) } catch {}
        scale = 1 // already in canvas pixel space
      } else {
        base.width = Math.round(w * scale)
        base.height = Math.round(h * scale)
      }
      // Capture DOM without canvases or the ripple overlay itself
      let domCanvas = null
      try {
        domCanvas = await html2canvas(document.body, {
          useCORS: true,
          backgroundColor: null,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          width: window.innerWidth,
          height: window.innerHeight,
          scale: (gl && gl?.domElement) ? (w / Math.max(1, window.innerWidth)) : scale,
          removeContainer: true,
          ignoreElements: (el) => {
            try {
              if (!el) return false
              if (el.tagName === 'CANVAS') return true
              if (el.hasAttribute && el.hasAttribute('data-ripple-overlay')) return true
            } catch {}
            return false
          },
        })
      } catch {}
      if (domCanvas) {
        try { ctx.drawImage(domCanvas, 0, 0, base.width, base.height) } catch {}
      }
      return base.toDataURL('image/png')
    } catch {
      return null
    }
  }
  // Fast capture of main WebGL canvas to dataURL (no html2canvas)
  function captureGLDataURLSync() {
    try {
      const gl = glRef.current
      if (!gl || !gl.domElement) return null
      const src = gl.domElement
      const off = document.createElement('canvas')
      off.width = src.width
      off.height = src.height
      const ctx = off.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(src, 0, 0, off.width, off.height)
      return off.toDataURL('image/png')
    } catch {
      return null
    }
  }
  // Capture WebGL framebuffer to DataTexture via CPU (readPixels) for use in another Canvas
  async function captureCanvasFrameAsDataTextureCPU() {
    try {
      const renderer = glRef.current
      if (!renderer) return null
      // Ensure frame is ready
      await new Promise((r) => requestAnimationFrame(r))
      const size = renderer.getDrawingBufferSize(new THREE.Vector2())
      const w = Math.max(1, size.x)
      const h = Math.max(1, size.y)
      const gl = renderer.getContext()
      const pixels = new Uint8Array(w * h * 4)
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      const tex = new THREE.DataTexture(pixels, w, h, THREE.RGBAFormat)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.flipY = false
      tex.needsUpdate = true
      return tex
    } catch {
      return null
    }
  }
  // Noise-mask overlay transition (A/B via dataURL)
  const [noiseOverlayActive, setNoiseOverlayActive] = useState(false)
  const [noisePrevTex, setNoisePrevTex] = useState(null)
  const [noiseNextTex, setNoiseNextTex] = useState(null)
  const noiseProgRef = useRef({ v: 0 })
  const [noiseProgress, setNoiseProgress] = useState(0)
  // Fade overlay simple
  const [fadeVisible, setFadeVisible] = useState(false)
  const [fadeOpacity, setFadeOpacity] = useState(0)
  const [fadeMode, setFadeMode] = useState('black') // 'black' | 'noise'
  const [fadeDuration, setFadeDuration] = useState(300)
  // Image mask overlay (uses public/transition0.png)
  const [imgMaskOverlayActive, setImgMaskOverlayActive] = useState(false)
  const [imgPrevTex, setImgPrevTex] = useState(null)
  const [imgNextTex, setImgNextTex] = useState(null)
  const [imgProgress, setImgProgress] = useState(0)
  const imgProgRef = useRef({ v: 0 })
  const [imgMaskTex, setImgMaskTex] = useState(null)
  // Simple reveal overlay (alpha by image mask)
  const [revealOverlayActive, setRevealOverlayActive] = useState(false)
  const [revealProgress, setRevealProgress] = useState(0)
  const [revealInvert, setRevealInvert] = useState(false)
  const revealProgRef = useRef({ v: 0 })
  // Grid reveal overlay
  const [gridOverlayActive, setGridOverlayActive] = useState(false)
  const [gridPhase, setGridPhase] = useState('in') // 'in' | 'out'
  const [gridCenter, setGridCenter] = useState([0.5, 0.5])
  const [gridKey, setGridKey] = useState(0)
  // Section preloader GIF (shown between grid cover/reveal during section transitions)
  const [showSectionPreloader, setShowSectionPreloader] = useState(false)
  const [sectionPreloaderFading, setSectionPreloaderFading] = useState(false)
  const [preloaderTargetSection, setPreloaderTargetSection] = useState('section1')
  const SECTION_PRELOADER_MIN_MS = 3500 // minimum display time (ms) for preloader GIF - slower animation
  // Uniform grid timing (global fine-tuning)
  const GRID_IN_MS = 280
  const GRID_OUT_MS = 520
  const GRID_DELAY_MS = 460

  // Stable callback required: if passed inline and App re-renders frequently,
  // GridRevealOverlay resets its timer and may get stuck (eternal gray screen).
  const onGridPhaseEnd = React.useCallback((phase) => {
    try { if (phase === 'out') setGridOverlayActive(false) } catch {}
  }, [])

  // Failsafe: never let the grid overlay (gray/black) get stuck.
  // If onPhaseEnd('out') never fires, unmount after a max timeout.
  useEffect(() => {
    if (!gridOverlayActive) return undefined
    if (gridPhase !== 'out') return undefined
    const maxMs = GRID_OUT_MS + GRID_DELAY_MS + 180
    const id = window.setTimeout(() => { try { setGridOverlayActive(false) } catch {} }, maxMs)
    return () => { try { window.clearTimeout(id) } catch {} }
    // gridKey restarts a transition; include it to re-arm this failsafe per transition.
  }, [gridOverlayActive, gridPhase, gridKey])

  // Failsafe: never let the section preloader get stuck
  useEffect(() => {
    if (!showSectionPreloader) return undefined
    const maxMs = SECTION_PRELOADER_MIN_MS + 4000 // 6s absolute max
    const id = window.setTimeout(() => {
      try { setShowSectionPreloader(false); setSectionPreloaderFading(false) } catch {}
    }, maxMs)
    return () => { try { window.clearTimeout(id) } catch {} }
  }, [showSectionPreloader])

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
    try { localStorage.setItem('forceCompactUi', forceCompactUi ? '1' : '0') } catch {}
  }, [forceCompactUi])
  // Dynamic safe insets for horizontal power bar (avoids overlapping portrait and buttons)
  const [powerSafeInsets, setPowerSafeInsets] = useState({ left: 16, right: 16 })
  // Scrollable section UI
  const [showSectionUi, setShowSectionUi] = useState(false)
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
  // Track which section is currently active (home by default)
  const [section, setSection] = useState('home')
  // Track transition state; when active we animate the shader and then switch sections
  const [transitionState, setTransitionState] = useState({ active: false, from: 'home', to: null })
  // Keep clearAlpha at 0 when using alpha mask (prevSceneTex == null && noiseMixEnabled)
  useEffect(() => {
    try {
      const gl = glRef.current
      if (!gl) return
      const useAlphaMask = noiseMixEnabled && prevSceneTex == null
      if (typeof gl.setClearAlpha === 'function') {
        gl.setClearAlpha(useAlphaMask ? 0 : 1)
      }
    } catch {}
  }, [noiseMixEnabled, prevSceneTex])
  // Simple transition: fade in/out (black or noise mode)
  const beginSimpleFadeTransition = React.useCallback(async (toId, { mode = 'noise', durationMs = 600 } = {}) => {
    if (!toId || transitionState.active) return
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    // Deactivate any previous overlays/blends
    try { setNoiseMixEnabled(false) } catch {}
    try { setNoiseOverlayActive(false); setNoisePrevTex(null); setNoiseNextTex(null) } catch {}
    setFadeMode(mode)
    setFadeDuration(durationMs / 2)
    setFadeVisible(true)
    setFadeOpacity(0)
    setTransitionState({ active: true, from: section, to: toId })
    // Fade out
    const half = Math.max(0, durationMs / 2) / 1000
    const o = { v: 0 }
    gsap.to(o, {
      v: 1,
      duration: half,
      ease: 'sine.out',
      onUpdate: () => setFadeOpacity(o.v),
      onComplete: () => {
        // Switch to B
        try {
          if (toId !== section) {
            setSection(toId)
            const base = import.meta.env.BASE_URL || '/'
            const map = { section1: 'work', section2: 'about', section3: 'store', section4: 'contact' }
            const next = toId !== 'home' ? `${base}${map[toId] || toId}` : base
            if (typeof window !== 'undefined' && window.location.pathname !== next) {
              window.history.pushState({ section: toId }, '', next)
            }
          }
        } catch {}
        // Prepare target UI
        if (toId !== 'home') {
          setShowSectionUi(true)
          setSectionUiFadeIn(false)
          setSectionUiAnimatingOut(false)
          // Reset scroll for ALL sections (including WORK — first project on top)
          try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setSectionUiFadeIn(true)
              })
            })
          })
        } else {
          setShowSectionUi(false)
          setSectionUiAnimatingOut(false)
          setSectionUiFadeIn(false)
        }
        // Fade in
        gsap.to(o, {
          v: 0,
          duration: half,
          ease: 'sine.in',
          onUpdate: () => setFadeOpacity(o.v),
          onComplete: () => {
            setFadeVisible(false)
            setTransitionState({ active: false, from: toId, to: null })
          },
        })
      },
    })
  }, [section, transitionState.active])
  // Preload image mask from public/transition0.png
  React.useEffect(() => {
    try {
      const loader = new THREE.TextureLoader()
      const url = `${import.meta.env.BASE_URL}transition0.png`
      loader.load(
        url,
        (tex) => {
          try {
            tex.colorSpace = THREE.SRGBColorSpace
            tex.flipY = false
            tex.minFilter = THREE.LinearFilter
            tex.magFilter = THREE.LinearFilter
            tex.wrapS = THREE.ClampToEdgeWrapping
            tex.wrapT = THREE.ClampToEdgeWrapping
            setImgMaskTex(tex)
          } catch {}
        },
        undefined,
        () => {}
      )
    } catch {}
  }, [])
  // Transition using image mask (black=A, white=B)
  const beginImageMaskTransition = React.useCallback(async (toId, { softness = 0.08, durationMs = 900 } = {}) => {
    if (!toId || transitionState.active) return
    if (!imgMaskTex) { beginSimpleFadeTransition(toId, { mode: 'noise', durationMs }); return }
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    // capture A
    const prevTex = await captureCanvasFrameAsDataTextureCPU()
    if (!prevTex) { beginSimpleFadeTransition(toId, { mode: 'noise', durationMs }); return }
    setImgPrevTex(prevTex); setImgNextTex(prevTex); setImgProgress(0); imgProgRef.current = { v: 0 }
    setImgMaskOverlayActive(true)
    // switch to B (3D only, UI hidden)
    if (toId !== section) { setSection(toId); try { syncUrl(toId) } catch {} }
    setShowSectionUi(false); setSectionUiAnimatingOut(false); setSectionUiFadeIn(false)
    // wait for B frame
    await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)))
    const nextTex = await captureCanvasFrameAsDataTextureCPU()
    if (!nextTex) { setImgMaskOverlayActive(false); setImgPrevTex(null); setImgNextTex(null); setImgProgress(0); beginSimpleFadeTransition(toId, { mode:'noise', durationMs }); return }
    setImgNextTex(nextTex)
    // animate progress
    gsap.to(imgProgRef.current, {
      v: 1,
      duration: Math.max(0.2, durationMs/1000),
      ease: 'sine.inOut',
      onUpdate: () => setImgProgress(imgProgRef.current.v),
      onComplete: () => {
        setImgMaskOverlayActive(false)
        setImgPrevTex(null); setImgNextTex(null); setImgProgress(0)
        if (toId !== 'home') {
          setShowSectionUi(true)
          setSectionUiFadeIn(false)
          try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => { setSectionUiFadeIn(true) })
            })
          })
        } else {
          setShowSectionUi(false); setSectionUiAnimatingOut(false)
        }
        setTransitionState({ active:false, from:toId, to:null })
      },
    })
    setTransitionState({ active:true, from:section, to:toId })
  }, [section, transitionState.active, imgMaskTex, beginSimpleFadeTransition])
  // Simple reveal using image mask as alpha over everything (black=cover, white=reveal)
  const beginImageRevealTransition = React.useCallback(async (toId, { softness = 0.08, durationMs = 900, invert = false } = {}) => {
    if (!toId || transitionState.active) return
    if (!imgMaskTex) { beginSimpleFadeTransition(toId, { mode: 'noise', durationMs }); return }
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    // switch to B immediately (so underlying page is target)
    if (toId !== section) { setSection(toId); try { syncUrl(toId) } catch {} }
    // decide UI: show immediately to be revealed
    if (toId !== 'home') { setShowSectionUi(true); setSectionUiFadeIn(false); setSectionUiAnimatingOut(false) } else { setShowSectionUi(false); setSectionUiAnimatingOut(false); setSectionUiFadeIn(false) }
    // activate overlay
    setRevealInvert(Boolean(invert))
    setRevealOverlayActive(true)
    setRevealProgress(0); revealProgRef.current = { v: 0 }
    // animate 0->1
    gsap.to(revealProgRef.current, {
      v: 1,
      duration: Math.max(0.2, durationMs / 1000),
      ease: 'sine.inOut',
      onUpdate: () => setRevealProgress(revealProgRef.current.v),
      onComplete: () => {
        setRevealOverlayActive(false)
        setRevealProgress(0)
        setTransitionState({ active: false, from: toId, to: null })
      },
    })
    setTransitionState({ active: true, from: section, to: toId })
  }, [section, transitionState.active, imgMaskTex, beginSimpleFadeTransition])
  // Grid reveal: cover with grid (phase IN), switch to B, uncover with grid (phase OUT)
  const beginGridRevealTransition = React.useCallback(async (toId, { center, cellSize = 64, inDurationMs = GRID_IN_MS, outDurationMs = GRID_OUT_MS, delaySpanMs = GRID_DELAY_MS } = {}) => {
    if (!toId || transitionState.active) return
    // Mark transition active IMMEDIATELY to hide HomeOrbs and prevent flash
    setTransitionState({ active: true, from: section, to: toId })
    // Exit animation for UI when leaving HOME
    if (section === 'home') {
      setUiAnimPhase('exiting')
      // After exit animation (300ms), hide
      if (uiExitTimerRef.current) clearTimeout(uiExitTimerRef.current)
      uiExitTimerRef.current = setTimeout(() => setUiAnimPhase('hidden'), 300)
      setHomeLanded(false)
    }
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    const cx = Math.min(1, Math.max(0, center?.[0] ?? 0.5))
    const cy = Math.min(1, Math.max(0, center?.[1] ?? 0.5))
    // Phase IN: cover (0 -> 1)
    setGridCenter([cx, 1 - cy]) // Convert to CSS coordinates (top-left origin)
    setPreloaderTargetSection(toId) // Set target for grid color
    setGridPhase('in'); setGridOverlayActive(true); setGridKey((k) => k + 1)
    const fromHome = section === 'home'
    const goingWork = toId === 'section1'
    // Reset scroll immediately when starting any transition
    try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
    const totalIn = inDurationMs + delaySpanMs + 40
    window.setTimeout(() => {
      // Grid fully covers the screen
      // Show preloader GIF for section transitions (not HOME)
      const preloaderShownAt = Date.now()
      if (toId !== 'home') {
        try { setShowSectionPreloader(true); setSectionPreloaderFading(false) } catch {}
      }
      // Switch to B
      try {
        if (toId !== section) {
          setSection(toId); try { syncUrl(toId) } catch {}
        }
        if (toId !== 'home') {
          const startOut = () => {
            // Wait for minimum preloader display time before revealing
            const elapsed = Date.now() - preloaderShownAt
            const remaining = Math.max(0, SECTION_PRELOADER_MIN_MS - elapsed)
            window.setTimeout(() => {
              // Fade out preloader, then start grid reveal
              try { setSectionPreloaderFading(true) } catch {}
              window.setTimeout(() => {
                try { setShowSectionPreloader(false); setSectionPreloaderFading(false) } catch {}
                setGridPhase('out')
                const totalOut = outDurationMs + delaySpanMs + 40
                window.setTimeout(() => {
                  setGridOverlayActive(false)
                  setTransitionState({ active: false, from: toId, to: null })
                }, totalOut)
              }, 350) // preloader fade-out duration
            }, remaining)
          }

          try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
          setShowSectionUi(true)
          setSectionUiFadeIn(true)
          setSectionUiAnimatingOut(false)
          // Wait for React to paint the target before reveal
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
          // When going to HOME, wait 2 RAFs before OUT to prevent canvas flash
          requestAnimationFrame(() => requestAnimationFrame(() => {
            setGridPhase('out') // Do NOT increment gridKey here — causes flash
            const totalOut = outDurationMs + delaySpanMs + 40
            window.setTimeout(() => {
              setGridOverlayActive(false)
              setTransitionState({ active: false, from: toId, to: null })
            }, totalOut)
          }))
        }
      } catch {}
    }, totalIn)
  }, [section, transitionState.active])
  // Start ripple transition: capture prev, animate mix, switch section at midpoint
  const beginRippleTransition = React.useCallback(async (toId) => {
    if (!toId || transitionState.active) return
    // Ensure no blackout overlay over the transition
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    // Capture A (current canvas frame) via GPU (fallback to 2D if needed)
    let tex = await captureCanvasFrameAsTextureGPU()
    if (!tex) {
      tex = await captureCanvasFrameAsTexture()
    }
    if (tex) setPrevSceneTex(tex)
    // Immediately activate the new section (B) under the mask
    try {
      if (toId !== section) {
        setSection(toId)
        const base = import.meta.env.BASE_URL || '/'
        const map = { section1: 'work', section2: 'about', section3: 'store', section4: 'contact' }
        const next = toId && toId !== 'home' ? `${base}${map[toId] || toId}` : base
        if (typeof window !== 'undefined' && window.location.pathname !== next) {
          window.history.pushState({ section: toId }, '', next)
        }
      }
      // Show or hide section UI based on target
      if (toId !== 'home') {
        setShowSectionUi(true)
        setSectionUiAnimatingOut(false)
        setSectionUiFadeIn(false)
      } else {
        // Reset scroll instantly when leaving a section to avoid visible scroll effect
        try { if (sectionScrollRef.current) sectionScrollRef.current.scrollTop = 0 } catch {}
        setSectionUiFadeIn(false)
        setSectionUiAnimatingOut(true)
        setTimeout(() => { setSectionUiAnimatingOut(false) }, 300)
      }
    } catch {}
    // Force mask mode (no snapshot A) to reveal B under the canvas via alpha
  setNoiseMixEnabled(true)
    rippleMixRef.current.v = 0
    setNoiseMixProgress(0)
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
        // Close transition state if it was open
        setTransitionState({ active: false, from: toId, to: null })
      },
    })
    // Open transition state to block UI if needed
    setTransitionState({ active: true, from: section, to: toId })
  }, [section, transitionState.active])
  // Ripple transition is managed exclusively by beginRippleTransition

  // ---------------------------------------------------------------------------
  // UNIFIED TRANSITION SYSTEM (replaces fragmented overlays)
  // ---------------------------------------------------------------------------
  const sceneTransition = useSceneTransition({
    glRef,
    onSectionChange: (toId) => {
      try {
        if (toId !== section) {
          setSection(toId)
          // Inline syncUrl to avoid circular dependency
          if (typeof window !== 'undefined') {
            const base = import.meta.env.BASE_URL || '/'
            const map = { section1: 'work', section2: 'about', section3: 'store', section4: 'contact', home: '' }
            const next = toId === 'home' ? base : `${base}${map[toId] || toId}`
            if (window.location.pathname !== next) {
              window.history.pushState({ section: toId }, '', next)
            }
          }
        }
      } catch {}
    },
    onTransitionStart: (toId, effectType) => {
      try {
        setTransitionState({ active: true, from: section, to: toId })
        setBlackoutImmediate(false)
        setBlackoutVisible(false)
      } catch {}
    },
    onTransitionMid: (toId) => {
      // Screen fully covered - configure section UI
      try {
        if (toId !== 'home') {
          setShowSectionUi(true)
          setSectionUiAnimatingOut(false)
          try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
          setSectionUiFadeIn(true)
        } else {
          setShowSectionUi(false)
          setSectionUiAnimatingOut(false)
          setSectionUiFadeIn(false)
        }
      } catch {}
    },
    onTransitionEnd: (toId) => {
      try {
        setTransitionState({ active: false, from: toId, to: null })
      } catch {}
    },
  })

  /**
   * Unified transition function - replaces beginGridRevealTransition
   * @param {string} toId - Target section
   * @param {Object} options - Effect options
   */
  const beginUnifiedTransition = React.useCallback((toId, options = {}) => {
    if (!toId || transitionState.active || sceneTransition.isTransitioning()) return
    const {
      effect = TransitionEffect.GRID,
      center = [0.5, 0.5],
      cellSize = 40,
      duration = 0.8,
    } = options
    sceneTransition.startTransition(toId, effect, {
      center,
      cellSize,
      duration,
      color: [0, 0, 0], // Black for the cover phase
    })
  }, [transitionState.active, sceneTransition])

  // ---------------------------------------------------------------------------
  // SIMPLE TRANSITION SYSTEM (pure CSS, no lag)
  // ---------------------------------------------------------------------------
  const simpleTransition = useSimpleTransition({
    onSectionChange: (toId) => {
      try {
        if (toId !== section) {
          setSection(toId)
          // Sync URL
          if (typeof window !== 'undefined') {
            const base = import.meta.env.BASE_URL || '/'
            const map = { section1: 'work', section2: 'about', section3: 'store', section4: 'contact', home: '' }
            const next = toId === 'home' ? base : `${base}${map[toId] || toId}`
            if (window.location.pathname !== next) {
              window.history.pushState({ section: toId }, '', next)
            }
          }
        }
      } catch {}
    },
    onTransitionStart: (toId) => {
      try {
        setTransitionState({ active: true, from: section, to: toId })
        setBlackoutImmediate(false)
        setBlackoutVisible(false)
      } catch {}
    },
    onTransitionMid: (toId) => {
      try {
        if (toId !== 'home') {
          setShowSectionUi(true)
          setSectionUiAnimatingOut(false)
          try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
          setSectionUiFadeIn(true)
        } else {
          setShowSectionUi(false)
          setSectionUiAnimatingOut(false)
          setSectionUiFadeIn(false)
        }
      } catch {}
    },
    onTransitionEnd: (toId) => {
      try {
        setTransitionState({ active: false, from: toId, to: null })
      } catch {}
    },
  })

  /**
   * Simple CSS grid transition (no lag)
   */
  const beginSimpleGridTransition = React.useCallback((toId, options = {}) => {
    if (!toId || transitionState.active || simpleTransition.isTransitioning()) return
    simpleTransition.startTransition(toId, {
      cellSize: options.cellSize ?? 60,
      coverDuration: options.coverDuration ?? 450,
      revealDuration: options.revealDuration ?? 550,
      holdDuration: options.holdDuration ?? 120,
    })
  }, [transitionState.active, simpleTransition])

  // Unified exit-to-HOME for both the section exit button and the preloader "ENTER" button
  const exitToHomeLikeExitButton = React.useCallback((source = 'section') => {
    if (transitionState.active) return
    // This hook is declared before bootLoading; do NOT reference bootLoading here to avoid TDZ.
    const shouldExit = (section !== 'home') || (source === 'preloader')
    if (!shouldExit) return

    // UI exit animation when leaving a section to HOME
    if (source === 'section') {
      setUiAnimPhase('exiting')
      // After exit animation completes (400ms to ensure smooth finish), hide
      if (uiExitTimerRef.current) clearTimeout(uiExitTimerRef.current)
      uiExitTimerRef.current = setTimeout(() => setUiAnimPhase('hidden'), 400)
    }

    // Preloader: skip grid overlay, just hide preloader so the landing animation is visible
    if (source === 'preloader') {
      if (preloaderStartedRef.current) return
      preloaderStartedRef.current = true
      setBootProgress(100)
      try { setPreloaderFadingOut(true) } catch {}
      // Hide preloader immediately to see the landing animation in HOME
      try { setShowPreloaderOverlay(false) } catch {}
      // CRITICAL: bootLoading = false so the Player is visible and callbacks work
      try { setBootLoading(false) } catch {}
      // Set navTarget to 'home' to start the landing animation
      try { setNavTarget('home') } catch {}
      try { setSection('home') } catch {}
      try { syncUrl('home') } catch {}
      // Fallback: clear fading state after 5s if onHomeSplash doesn't fire
      preloaderHideTimerRef.current = window.setTimeout(() => {
        setPreloaderFadingOut(false)
        preloaderHideTimerRef.current = null
      }, 5000)
      // Do NOT continue with grid overlay for the preloader
      return
    }

    // 1) Cover with grid (only for section transitions, NOT preloader)
    setGridCenter([0.5, 0.5])
    setGridPhase('in')
    setPreloaderTargetSection('home') // Set target for grid color
    setGridOverlayActive(true)
    setGridKey((k) => k + 1)

    // 2) When covered: cleanup + go to HOME + reveal
    const totalIn = GRID_IN_MS + GRID_DELAY_MS + 40
    window.setTimeout(() => {
      // Record section exit (only applies to real sections)
      if (source !== 'preloader') {
        try { lastExitedSectionRef.current = section } catch {}
      }

      // Cleanup (same as exit button, where applicable)
      try { setShowSectionPreloader(false); setSectionPreloaderFading(false) } catch {}
      setShowSectionUi(false)
      setShowMarquee(false)
      setMarqueeAnimatingOut(false)
      setMarqueeForceHidden(true)
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
      // Hide HOME UI until the character lands again
      if (source === 'section') {
        try { setHomeLanded(false) } catch {}
      }

      if (source === 'preloader') {
        // Now that the grid covered, we can hide the preloader overlay
        // (bootLoading was already set to false so the scene mounts)
        try { setShowPreloaderOverlay(false) } catch {}
        try { preloaderGridOutPendingRef.current = false } catch {}
        try {
          if (preloaderHideTimerRef.current) clearTimeout(preloaderHideTimerRef.current)
        } catch {}
        preloaderHideTimerRef.current = window.setTimeout(() => {
          setPreloaderFadingOut(false)
          preloaderHideTimerRef.current = null
        }, 1000)
      }

      // Go to HOME + reveal (same as exit button)
      setNavTarget('home')
      setSection('home')
      try { syncUrl('home') } catch {}
      setGridPhase('out') // Do NOT increment gridKey here — causes flash
      const totalOut = GRID_OUT_MS + GRID_DELAY_MS + 40
      window.setTimeout(() => { setGridOverlayActive(false) }, totalOut)
    }, totalIn)
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
      } catch {}
    } else if (count === 2) {
      // 2nd cheat: system alert (queued)
      enqueueCheatAlert(t('cheat.alert2'), 6000)
    } else if (count === 3) {
      // 3rd cheat: easter egg scene + system alert + score penalty + disable drag
      // Side effects happen immediately regardless of alert queue
      try { window.__cheatEggExtendedDrift = true } catch {}
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
    const onOpen = () => { try { setMarqueeForceHidden(true) } catch {} }
    const onClose = () => { try { setMarqueeForceHidden(false) } catch {} }
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

  // Failsafe: never allow a stuck blackout overlay.
  useEffect(() => {
    if (!blackoutVisible) return undefined
    const id = window.setTimeout(() => {
      try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    }, 1500)
    return () => { try { window.clearTimeout(id) } catch {} }
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
  const [showPreloaderOverlay, setShowPreloaderOverlay] = useState(true)
  // Whether the character has landed (show UI afterwards)
  const [homeLanded, setHomeLanded] = useState(false)
  // UI animation system: controls menu and portrait enter/exit
  // 'hidden' | 'entering' | 'visible' | 'exiting'
  const [uiAnimPhase, setUiAnimPhase] = useState('hidden')
  const uiEnterTimerRef = useRef(null)  // Timer for entering -> visible
  const uiExitTimerRef = useRef(null)   // Timer for exiting -> hidden (do NOT clear in useEffect)
  
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
  const gridOutTimerRef = useRef(null)
  // Expose global controls (no 3D preloader camera anymore)
  useEffect(() => {
    try {
      // eslint-disable-next-line no-underscore-dangle
      window.pausePreloaderCamera = () => {}
      // eslint-disable-next-line no-underscore-dangle
      window.resumePreloaderCamera = () => {}
    } catch {}
  }, [])

  // Close menu overlay with Escape
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

  // Minimal preload: only the main character for fast entry
  // Remaining assets load in background after entering
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Only load the character model (critical for HOME)
        setBootProgress(30)
        await Promise.resolve().then(() => useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`))
        if (cancelled) return
        setBootProgress(100)
        setBootAllDone(true)
      } catch {
        if (!cancelled) { setBootProgress(100); setBootAllDone(true) }
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Load secondary assets in background AFTER entering (non-blocking)
  useEffect(() => {
    if (showPreloaderOverlay) return // Only after entering
    const loadInBackground = async () => {
      try {
        // Secondary GLBs
        const glbList = [
          `${import.meta.env.BASE_URL}characterStone.glb`,
          `${import.meta.env.BASE_URL}grave_lowpoly.glb`,
          `${import.meta.env.BASE_URL}3dmodels/housebird.glb`,
          `${import.meta.env.BASE_URL}3dmodels/housebirdPink.glb`,
          `${import.meta.env.BASE_URL}3dmodels/housebirdWhite.glb`,
        ]
        glbList.forEach((url) => { try { useGLTF.preload(url) } catch {} })
        // HDR
        fetch(`${import.meta.env.BASE_URL}light.hdr`, { cache: 'force-cache' }).catch(() => {})
        // Lazy-loaded sections
        import('./components/Section1.jsx').catch(() => {})
        import('./components/Section2.jsx').catch(() => {})
        import('./components/Section3.jsx').catch(() => {})
        import('./components/Section4.jsx').catch(() => {})
        // SFX
        const fxList = ['hover','click','magiaInicia','sparkleBom','sparkleFall','stepone','stepSoft','steptwo']
        try { preloadSfx(fxList) } catch {}
      } catch {}
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
    const id = window.setTimeout(() => { try { setFxWarm(true) } catch {} }, 800)
    return () => window.clearTimeout(id)
  }, [showPreloaderOverlay])

  // Stage warm-up to reduce stutter on "Enter" - delays optimized for shader compilation
  useEffect(() => {
    if (bootLoading) { setMainWarmStage(0); return undefined }
    // Stage 1: Environment and lights (immediate) - lets shaders start compiling
    setMainWarmStage(1)
    // Stage 2: particles, orbs, post-processing - extended delay for GPU
    // 600ms allows most shaders to finish compiling before adding more work
    const t2 = window.setTimeout(() => { try { setMainWarmStage(2) } catch {} }, 600)
    return () => { try { window.clearTimeout(t2) } catch {} }
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
      } catch {}
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
  useEffect(() => {
    if (!isCompactUi) return () => {}
    const compute = () => {
      try {
        const vw = Math.max(0, window.innerWidth || 0)
        if (!vw) return
        let left = 16
        let right = 16
        const margin = 14
        // Fallbacks (if DOM isn't stable yet): portrait ~ 7.2rem + left-4, controls ~ 48px + right-4
        const rem = (() => {
          try {
            const fs = parseFloat((window.getComputedStyle?.(document.documentElement)?.fontSize) || '')
            return (isFinite(fs) && fs > 0) ? fs : 16
          } catch { return 16 }
        })()
        const portraitFallbackRight = 16 + Math.round(rem * 7.2)
        const controlsFallbackLeft = vw - (16 + 48)
        // Portrait (left)
        try {
          const portraitEl = document.querySelector('[data-portrait-root]')
          if (portraitEl && typeof portraitEl.getBoundingClientRect === 'function') {
            const r = portraitEl.getBoundingClientRect()
            if (isFinite(r.right)) left = Math.max(left, Math.round(r.right + margin))
          } else {
            left = Math.max(left, Math.round(portraitFallbackRight + margin))
          }
        } catch {}
        // Compact controls (right)
        try {
          const controlsEl = compactControlsRef.current
          if (controlsEl && typeof controlsEl.getBoundingClientRect === 'function') {
            const r = controlsEl.getBoundingClientRect()
            if (isFinite(r.left)) right = Math.max(right, Math.round((vw - r.left) + margin))
          } else {
            right = Math.max(right, Math.round((vw - controlsFallbackLeft) + margin))
          }
        } catch {}
        // Clamp: don't let left+right consume all the width
        const maxTotal = Math.max(0, vw - 60)
        if (left + right > maxTotal) {
          const overflow = (left + right) - maxTotal
          left = Math.max(16, Math.round(left - overflow / 2))
          right = Math.max(16, Math.round(right - overflow / 2))
        }
        setPowerSafeInsets((p) => ((p.left === left && p.right === right) ? p : { left, right }))
      } catch {}
    }
    // Wait for layout and re-measure several frames for stabilized portrait/controls
    let rafId = 0
    let n = 0
    const tick = () => {
      compute()
      n += 1
      if (n < 24) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(() => requestAnimationFrame(tick))
    window.addEventListener('resize', compute)
    window.addEventListener('orientationchange', compute)
    return () => {
      try { cancelAnimationFrame(rafId) } catch {}
      window.removeEventListener('resize', compute)
      window.removeEventListener('orientationchange', compute)
    }
  }, [isCompactUi, section])

  // On entering WORK, just show the UI (no more centering/snapping needed)
  useEffect(() => {
    if (section === 'section1') {
      try { setSectionUiFadeIn(true) } catch {}
    }
  }, [section])

  // Initialize/destroy Lenis smooth scroll when section UI is active
  useEffect(() => {
    const wrapper = sectionScrollRef.current
    if (!wrapper || !showSectionUi) {
      // Destroy Lenis when section UI is hidden
      if (lenisRef.current) {
        try { lenisRef.current.destroy() } catch {}
        lenisRef.current = null
      }
      return
    }
    // Create Lenis instance bound to the section scroll container
    const lenis = new Lenis({
      wrapper,
      content: wrapper.firstElementChild || wrapper,
      lerp: 0.18, // Inertia factor: higher = more responsive, less sluggish
      smoothWheel: true,
      syncTouch: true,
    })
    lenisRef.current = lenis

    // RAF loop to drive Lenis and update scroll velocity for shaders
    let raf
    const tick = (time) => {
      try {
        lenis.raf(time)
        scrollVelocityRef.current = lenis.velocity || 0
      } catch {}
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      try { lenis.destroy() } catch {}
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
  // High thresholds to avoid unnecessary activation
  const degradeCountRef = useRef(0) // hysteresis counter
  useEffect(() => {
    const tick = () => {
      try {
        const info = glRef.current?.info?.memory
        const heap = (typeof performance !== 'undefined' && performance.memory) ? performance.memory.usedJSHeapSize : 0
        const heapMB = heap ? Math.round(heap / (1024 * 1024)) : 0
        const textures = info?.textures || 0
        const geometries = info?.geometries || 0
        // Very high thresholds - only activate in extreme cases
        const HEAP_HIGH = 2000 // MB - degrade threshold
        const HEAP_LOW = 1500  // MB - recovery threshold
        const TEX_HIGH = 8000  // textures to degrade
        const TEX_LOW = 6000   // textures to recover
        const GEO_HIGH = 6000  // geometries to degrade
        const GEO_LOW = 4000   // geometries to recover
        
        if (import.meta.env?.DEV && (heapMB > 500 || textures > 100 || geometries > 100)) {
          console.log('[Perf] Memory status:', { heapMB, textures, geometries })
        }
        
        // degradedMode is now the default (always on) for smooth performance.
        // The watchdog only re-enters degraded mode if something toggled it off.
        setDegradedMode((prev) => {
          if (prev) return true // already degraded, stay there
          // Not degraded (shouldn't normally happen) — check if resources are stressed
          const shouldDegrade = (heapMB > HEAP_HIGH) || (textures > TEX_HIGH) || (geometries > GEO_HIGH)
          if (shouldDegrade) {
            degradeCountRef.current = 3
            if (import.meta.env?.DEV) {
              console.log('[Perf] Re-entering degraded mode:', { heapMB, textures, geometries })
            }
            return true
          }
          return false
        })
      } catch {}
    }
    const id = window.setInterval(tick, 60000) // every 60s - don't check too frequently
    return () => window.clearInterval(id)
  }, [])

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
    } catch {}
  }

  // Simple History API routing: map section <-> URL without breaking current UX
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

  // Initialize section from URL on load
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const initial = pathToSection(window.location.pathname)
    if (initial) setSection(initial)
  }, [])

  // Pre-load section modules to avoid download/parse on first click
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

  // Preload basic SFX for Nav
  React.useEffect(() => {
    try { preloadSfx(['hover', 'click']) } catch {}
  }, [])

  // Load songs manifest
  React.useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}songs/manifest.json`, { cache: 'no-cache' })
        const json = await res.json()
        let arr = Array.isArray(json) ? json.slice() : []
        // Put "Enter Skulley Rad (Reimagined)" first if present
        const target = 'songs/Enter Skulley Rad (Reimagined).mp3'
        const idx = arr.findIndex((t) => (t?.src || '').toLowerCase() === target.toLowerCase())
        if (idx > 0) {
          const first = { ...arr[idx] }
          arr.splice(idx, 1)
          arr = [first, ...arr]
        }
        if (!canceled) setTracks(arr)
      } catch {
        if (!canceled) setTracks([])
      }
    })()
    return () => { canceled = true }
  }, [])

  // Section container visibility and smooth transition control
  // NOTE: This effect must NOT run during active transitions (simpleTransition or transitionState)
  useEffect(() => {
    // Skip during any active transition
    if (transitionState.active) return
    if (simpleTransition.active) return
    
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
        } catch {}
        // trigger fade in after mount (slight delay for layout stability)
        setTimeout(() => setSectionUiFadeIn(true), 10)
      })
    } else if (showSectionUi) {
      // Reset scroll instantly before hiding to avoid visible scroll animation
      try { if (sectionScrollRef.current) sectionScrollRef.current.scrollTop = 0 } catch {}
      setSectionUiAnimatingOut(true)
      setSectionUiFadeIn(false)
      const t = setTimeout(() => {
        setShowSectionUi(false)
        setSectionUiAnimatingOut(false)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [section, transitionState.active, simpleTransition.active, showSectionUi])

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

  // Sync URL on transition complete
  const syncUrl = (s) => {
    if (typeof window === 'undefined') return
    const next = sectionToPath(s)
    if (window.location.pathname !== next) {
      window.history.pushState({ section: s }, '', next)
    }
  }

  // Handle user navigation (back/forward)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => {
      const target = pathToSection(window.location.pathname)
      if (!target) return
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
  const prevPlayerPosRef = useRef(new THREE.Vector3(0, 0, 0))
  const lastPortalIdRef = useRef(null)
  // Avoid creating an extra WebGLRenderer here for detectSupport (unnecessary GPU cost).
  // KTX2 support detection is done in components that already have access to the real renderer.

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
      beginSimpleFadeTransition(target, { mode: 'noise', durationMs: 700 })
    }
  }

  // Called by the TransitionOverlay after the shader animation finishes.  We then
  // update the current section and reset the transition state.
  const handleTransitionComplete = () => {
    // Stop psychedelic effects
    try {
      if (typeof stopPsycho === 'function') stopPsycho()
    } catch {}
    setSection(transitionState.to)
    setTransitionState({ active: false, from: transitionState.to || section, to: null })
    if (transitionState.to) syncUrl(transitionState.to)
    // Stop CTA preloader when transition completes
    try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch {}
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
      } catch {}
      // Restore UI/controls to HOME defaults
      setShowSectionUi(false)
      setSectionUiAnimatingOut(false)
      setUiHintPortalId(null)
      setNearPortalId(null)
      // Hide CTA without animation and clear timers on return to HOME
      try { if (ctaHideTimerRef.current) { clearTimeout(ctaHideTimerRef.current); ctaHideTimerRef.current = null } } catch {}
      setShowCta(false)
      setCtaAnimatingOut(false)
      setCtaLoading(false)
      setCtaProgress(0)
      // Debounce: hide CTA briefly after landing in HOME to prevent flash
      setCtaForceHidden(true)
      try { if (ctaForceTimerRef.current) clearTimeout(ctaForceTimerRef.current) } catch {}
      ctaForceTimerRef.current = window.setTimeout(() => { setCtaForceHidden(false); ctaForceTimerRef.current = null }, 600)
      setTintFactor(0)
      try { if (mainControlsRef.current) mainControlsRef.current.enabled = true } catch {}
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
    try { setTransitionState({ active: false, from: section, to: null }) } catch {}
    try { setNoiseMixEnabled(false); setPrevSceneTex(null); setNoiseMixProgress(0); rippleMixRef.current.v = 0 } catch {}
    try { setNoiseOverlayActive(false); setNoisePrevTex(null); setNoiseNextTex(null); setNoiseProgress(0) } catch {}
    try { setImgMaskOverlayActive(false); setImgPrevTex(null); setImgNextTex(null); setImgProgress(0) } catch {}
    try { setRevealOverlayActive(false) } catch {}
    try { setGridOverlayActive(false); setGridPhase('out') } catch {}
    try { setShowSectionPreloader(false); setSectionPreloaderFading(false) } catch {}
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    try { setShowSectionUi(false); setSectionUiAnimatingOut(false); setSectionUiFadeIn(false) } catch {}
    try { setShowCta(false); setCtaAnimatingOut(false); setCtaLoading(false); setCtaProgress(0); setCtaForceHidden(false) } catch {}
    try { setShowMarquee(false); setMarqueeAnimatingOut(false); setMarqueeForceHidden(false) } catch {}
    try { setNearPortalId(null); setUiHintPortalId(null) } catch {}
    // Force ready state
    try { setBootLoading(false); setShowPreloaderOverlay(false); setPreloaderFadingOut(false) } catch {}
    try { setNavTarget('home'); setSection('home'); syncUrl('home') } catch {}
  }, [section])

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    try { window.__panicReset = devPanicReset } catch {}
    const onKeyDown = (e) => {
      try {
        if (e.key === 'F9') devPanicReset()
      } catch {}
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { try { window.removeEventListener('keydown', onKeyDown) } catch {} }
  }, [devPanicReset])

  

  return (
    <div className={`w-full h-full relative overflow-hidden ${(isCompactUi && section === 'home') ? 'home-touch-no-select' : ''}`}>
      {/* The main WebGL canvas */}
      <Canvas
        // Real shadow maps disabled: too expensive and looked incomplete.
        // Using abstract blob shadow instead.
        shadows={false}
        dpr={[1, pageHidden ? 1.0 : (degradedMode ? 1.0 : (isMobilePerf ? 1.0 : 1.1))]}
        // preserveDrawingBuffer=true greatly increases VRAM usage and can cause Context Lost
        // (camera/post effects don't depend on this).
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false }}
        camera={{ position: [0, 3, 8], fov: 60, near: 0.1, far: 2000 }}
        events={undefined}
        onCreated={({ gl }) => {
          // Pre-warm shaders/pipelines to avoid first interaction jank
          try {
            // Avoid warning if WEBGL_lose_context doesn't exist (some drivers/browsers)
            try {
              const ctx = gl?.getContext?.()
              const ext = ctx?.getExtension?.('WEBGL_lose_context')
              if (!ext) {
                // @ts-ignore
                gl.forceContextLoss = () => {}
                // @ts-ignore
                gl.forceContextRestore = () => {}
              }
            } catch {}
            // Robust fallback: prevent getContextAttributes() === null (null alpha in postprocessing)
            const orig = gl.getContextAttributes?.bind(gl)
            const cached = (typeof orig === 'function') ? orig() : null
            const safe = cached || {
              alpha: true,
              antialias: false,
              depth: true,
              stencil: false,
              premultipliedAlpha: true,
              preserveDrawingBuffer: false,
              powerPreference: 'high-performance',
              failIfMajorPerformanceCaveat: false,
              desynchronized: false,
            }
            if (typeof orig === 'function') {
              // @ts-ignore
              gl.__cachedContextAttributes = safe
              // @ts-ignore
              gl.getContextAttributes = () => {
                try {
                  const cur = orig()
                  return cur || safe
                } catch {
                  return safe
                }
              }
            }
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
            // Prevent gray <body> from showing when canvas isn't painting (paused frameloop / overlay).
            // This is CSS only; doesn't affect <color attach="background" ...> in WebGL.
            el.style.background = '#000'
            // Mobile: allow drag for OrbitControls (prevents browser from capturing gestures and killing rotate)
            el.style.touchAction = 'none'
            // WebGL context lost/restored handlers
            const onLost = (e) => {
              try { e.preventDefault() } catch {}
              // Enter degraded mode to recover context.
              try { setDegradedMode(true) } catch {}
            }
            const onRestored = () => { try { /* no-op; R3F will recover */ } catch {} }
            el.addEventListener('webglcontextlost', onLost, { passive: false })
            el.addEventListener('webglcontextrestored', onRestored)
          } catch {}
        }}
      >
        <Suspense fallback={null}>
          <AdaptiveDpr pixelated />
          {/* Main scene always mounted (preloader is just an HTML overlay) */}
          <>
            {/* Pause frameloop when: preloader visible, section UI active without transition, or page hidden */}
            <PauseFrameloop paused={showPreloaderOverlay || (((showSectionUi || sectionUiAnimatingOut) && !transitionState.active && !noiseMixEnabled) || pageHidden)} />
              {/* Main scene warm-up: simple lights first, then Environment */}
              {mainWarmStage < 1 ? (
                <>
                  <color attach="background" args={[psychoSceneColor || effectiveSceneColor]} />
                  <fog attach="fog" args={[psychoSceneColor || effectiveSceneColor, 25, 120]} />
                  <ambientLight intensity={0.45} />
                  <directionalLight intensity={0.85} position={[2, 4, 3]} />
                </>
              ) : (
                <Environment
                  overrideColor={psychoSceneColor}
                  lowPerf={Boolean(isMobilePerf || degradedMode || !fxWarm)}
                  transparentBg={prevSceneTex == null && noiseMixEnabled}
                />
              )}
              {/* Fake grass: reveals in radius around the character (cheap: 1 drawcall) */}
              {/* Hidden during transitions from HOME to avoid flash */}
              <FakeGrass
                playerRef={playerRef}
                enabled={Boolean(section === 'home' && !(transitionState.active && transitionState.from === 'home'))}
                lowPerf={Boolean(isMobilePerf || degradedMode || !fxWarm)}
                fieldRadius={150}
                baseColor={eggActive ? '#fc1c27' : '#1202f2'}
                emissiveIntensity={0.22}
                revealRadius={7.0}
                feather={2.2}
                persistent={false}
                directional={false}
                count={180000}
                // Much smaller
                bladeHeight={0.42}
                bladeWidth={0.032}
                sway={0.045}
              />
          {/* God Rays anchor (hidden when inactive and no depth write) */}
          {fx.godEnabled && (
            <mesh ref={sunRef} position={[0, 8, 0]}>
              <sphereGeometry args={[0.35, 12, 12]} />
              <meshBasicMaterial color={'#ffffff'} transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          {/* Luminous orbs with physics in HOME */}
          {/* Hidden immediately when there's an active transition leaving HOME to avoid flash */}
          {(section === 'home' && mainWarmStage >= 2 && !(transitionState.active && transitionState.from === 'home')) && (
            <HomeOrbs
              ref={homeOrbsRef}
              playerRef={playerRef}
              active={section === 'home'}
              num={10}
              portals={portals}
              portalRadius={2}
              gameActive={sphereGameActive}
              dragEnabled={sphereGameActive ? cheatDragEnabled : true}
              onCheatCapture={sphereGameActive ? handleCheatCapture : undefined}
              onBlockedDragAttempt={sphereGameActive ? handleBlockedDragAttempt : undefined}
            />
          )}
          {/* Floating "!" icon — sphere game tutorial trigger */}
          {section === 'home' && mainWarmStage >= 2 && homeLanded && !(transitionState.active && transitionState.from === 'home') && (
            <FloatingExclamation
              position={[3, 1.8, 3]}
              color="#decf00"
              visible={section === 'home' && !spheresTutorialOpen}
              onClick={() => {
                try { playSfx('click', { volume: 0.8 }) } catch {}
                setSpheresTutorialOpen(true)
              }}
            />
          )}
          {/* Player mounts from preloader in prewarm mode (invisible, no loop) to avoid hitch on "Enter" */}
          <Player
            playerRef={playerRef}
            prewarm={bootLoading}
            visible={!bootLoading}
            portals={bootLoading ? [] : portals}
            eggActive={eggActive}
            onPortalEnter={bootLoading ? undefined : handlePortalEnter}
            onProximityChange={bootLoading ? undefined : ((f) => {
              const smooth = (prev, next, k = 0.22) => prev + (next - prev) * k
              setTintFactor((prev) => smooth(prev ?? 0, f))
            })}
            onPortalsProximityChange={bootLoading ? undefined : setPortalMixMap}
            onNearPortalChange={bootLoading ? undefined : ((id) => {
              setNearPortalId(id)
              if (id && section === 'home') {
                if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null }
                setLandingBannerActive(false)
                setMarqueeAnimatingOut(false)
                setShowMarquee(true)
                setMarqueeLabelSection(id)
              }
            })}
            navigateToPortalId={bootLoading ? null : navTarget}
            sceneColor={effectiveSceneColor}
            onCharacterReady={() => { setCharacterReady(true) }}
            onHomeFallStart={bootLoading ? undefined : (() => {
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
              try {
                if (preloaderGridOutPendingRef.current) {
                  preloaderGridOutPendingRef.current = false
                  setGridPhase('out') // Do NOT increment gridKey here — causes flash
                  const totalOut = GRID_OUT_MS + GRID_DELAY_MS + 40
                  try { if (gridOutTimerRef.current) clearTimeout(gridOutTimerRef.current) } catch {}
                  gridOutTimerRef.current = window.setTimeout(() => {
                    setGridOverlayActive(false)
                    gridOutTimerRef.current = null
                  }, totalOut)
                }
              } catch {}
            })}
            onReachedPortal={bootLoading ? undefined : ((id) => {
              try { lastPortalIdRef.current = id } catch {}
              if (id && id !== 'home') { try { setMarqueeLabelSection(id) } catch {} }
              setNavTarget(null)
            })}
            onOrbStateChange={bootLoading ? undefined : ((active) => setOrbActiveUi(active))}
            onMoveStateChange={bootLoading ? undefined : ((moving) => { try { setPlayerMoving(moving) } catch {} })}
            onPulse={bootLoading ? undefined : ((pos, strength, radius) => { try { homeOrbsRef.current?.radialImpulse(pos, strength, radius) } catch {} })}
            onActionCooldown={bootLoading ? undefined : ((r) => { try { setActionCooldown(r) } catch {} })}
            onHomeSplash={bootLoading ? undefined : (() => {
              if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null }
              // Disable preloaderFadingOut when the character lands
              if (preloaderFadingOut) {
                if (preloaderHideTimerRef.current) { clearTimeout(preloaderHideTimerRef.current); preloaderHideTimerRef.current = null }
                setPreloaderFadingOut(false)
              }
              // Mark that the character has landed - UI can now show
              setHomeLanded(true)
              setMarqueeLabelSection('home')
              setShowMarquee(true)
              setMarqueeAnimatingOut(false)
              setMarqueeForceHidden(false)
              setLandingBannerActive(true)
              if (blackoutVisible) setTimeout(() => setBlackoutVisible(false), 80)
              setCtaForceHidden(true)
              try { if (ctaForceTimerRef.current) clearTimeout(ctaForceTimerRef.current) } catch {}
              ctaForceTimerRef.current = setTimeout(() => { setCtaForceHidden(false); ctaForceTimerRef.current = null }, 1400)
              bannerTimerRef.current = setTimeout(() => {
                setLandingBannerActive(false)
                setMarqueeAnimatingOut(true)
                window.setTimeout(() => { setShowMarquee(false); setMarqueeAnimatingOut(false) }, 220)
                bannerTimerRef.current = null
              }, 2000)
              lastExitedSectionRef.current = null
            })}
            onMeshesReady={(meshes) => { 
              try { setPlayerMeshes(meshes || []) } catch {} 
            }}
            outlineEnabled={true}
          />
          {/* Abstract shadow (stable): NOT in orb mode */}
          {/* Shadow hidden during transitions from HOME */}
          {!bootLoading && (
            <BlobShadow
              key={`blob:${isMobilePerf ? 1 : 0}:${degradedMode ? 1 : 0}`}
              playerRef={playerRef}
              enabled={Boolean(section === 'home' && !orbActiveUi && !(transitionState.active && transitionState.from === 'home'))}
              // 50% smaller vs 6.2, but more visible
              size={3.1}
              opacity={Boolean(isMobilePerf || degradedMode) ? 0.35 : 0.45}
              innerAlpha={0.9}
              midAlpha={0.55}
            />
          )}
          {/* */}
          {mainWarmStage >= 1 && portals.map((p) => {
            const mix = portalMixMap[p.id] || 0
            const targetColor = sectionColors[p.id] || '#ffffff'
            return (
            <FrustumCulledGroup key={p.id} position={p.position} radius={4.5} maxDistance={800} sampleEvery={4}>
              <Portal position={[0,0,0]} color={p.color} targetColor={targetColor} mix={mix} size={2} flicker={p.id === 'section3'} flickerKey={section} />
              {(mainWarmStage >= 2) && (
                <PortalParticles
                  center={[0,0,0]}
                  radius={4}
                  count={isMobilePerf ? 120 : 220}
                  color={'#9ec6ff'}
                  targetColor={targetColor}
                  mix={mix}
                  playerRef={playerRef}
                  frenzyRadius={10}
                />
              )}
            </FrustumCulledGroup>
            )
          })}
          {/*
            Power ready (charge >= 100%):
            actionCooldown is used as a channel (1 - charge). When it approaches 0,
            the bar fill (1 - actionCooldown) is nearly 100%.
          */}
          {(() => {
            // Threshold aligned with the bar's glowOn
            const powerReady = (Math.max(0, Math.min(1, 1 - actionCooldown)) >= 0.98)
            const wantShake = powerReady && section === 'home'
            // Skip shake while player is moving to avoid motion sickness; shake when idle.
            const shakeNow = (eggActive || Boolean(nearPortalId) || wantShake) && !playerMoving
            const amp = eggActive ? 0.11 : (wantShake ? 0.055 : 0.08)
            const fxX = eggActive ? 16.0 : (wantShake ? 20.0 : 14.0)
            const fxY = eggActive ? 13.0 : (wantShake ? 17.0 : 12.0)
            const yMul = eggActive ? 0.75 : (wantShake ? 0.6 : 0.9)
            return (
              <CameraController
                playerRef={playerRef}
                controlsRefExternal={mainControlsRef}
                playerMoving={playerMoving}
                shakeActive={shakeNow}
                // Easter egg: subtler shake to avoid motion sickness
                shakeAmplitude={amp}
                shakeFrequencyX={fxX}
                shakeFrequencyY={fxY}
                shakeYMultiplier={yMul}
                // Allow rotation always in HOME; block in section UI
                enabled={section === 'home' ? true : (!showSectionUi && !sectionUiAnimatingOut)}
                // Mobile: identical behavior to desktop (only input changes: joystick)
                followBehind={false}
                // Camera mode: 'third-person' or 'top-down'
                mode={cameraMode}
              />
            )
          })()}
          {/* Shake via target only, to avoid interfering with OrbitControls */}
          {/* Perf can be used during development to monitor FPS; disabled by default. */}
          {/* <Perf position="top-left" /> */}
          {/* Postprocessing effects */}
          {/* Keep FX even in degradedMode, but in lowPerf */}
          {fxWarm && !pageHidden && (mainWarmStage >= 2) && (
            <PostFX
              lowPerf={Boolean(isMobilePerf || degradedMode)}
              eggActiveGlobal={eggActive}
              psychoEnabled={false}
              chromaOffsetX={fx.chromaOffsetX}
              chromaOffsetY={fx.chromaOffsetY}
              glitchActive={fx.glitchActive}
              glitchStrengthMin={fx.glitchStrengthMin}
              glitchStrengthMax={fx.glitchStrengthMax}
              brightness={fx.brightness}
              contrast={fx.contrast}
              saturation={fx.saturation}
              hue={fx.hue}
              liquidStrength={fx.liquidStrength}
              liquidScale={fx.liquidScale}
              liquidSpeed={fx.liquidSpeed}
              maskCenterX={fx.maskCenterX}
              maskCenterY={fx.maskCenterY}
              maskRadius={fx.maskRadius}
              maskFeather={fx.maskFeather}
              edgeBoost={fx.edgeBoost}
              noiseMixEnabled={noiseMixEnabled}
              noiseMixProgress={noiseMixProgress}
              noisePrevTexture={prevSceneTex}
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
              // Yellow outline for the character
              outlineEnabled={section === 'home' && !bootLoading}
              outlineMeshes={playerMeshes}
              outlineColor={0xffcc00}
              outlineEdgeStrength={5.0}
            />
          )}
          {/* Crossfade/overlay replaced by final RippleDissolveMix */}
          </>
        </Suspense>
      </Canvas>

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
          className={`fixed inset-0 z-[10] overflow-y-auto no-native-scrollbar ${sectionUiCanInteract ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            backgroundColor: sectionColors[section] || '#000000',
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
            } catch {}
          }}
          data-section-scroll
        >
          <div className="min-h-screen w-full" style={{ paddingTop: `${marqueeHeight}px`, overscrollBehavior: 'contain' }}>
            <Suspense fallback={null}>
              <div className="relative max-w-5xl mx-auto px-6 sm:px-8 pt-6 pb-12">
                {section === 'section1' && <Section1 scrollerRef={sectionScrollRef} scrollbarOffsetRight={scrollbarW} scrollVelocityRef={scrollVelocityRef} lenisRef={lenisRef} />}
                {section === 'section2' && <Section2 scrollVelocityRef={scrollVelocityRef} />}
                {section === 'section3' && <Section3 />}
                {section === 'section4' && <Section4 />}
              </div>
            </Suspense>
          </div>
          {/* Minimal nav overlay removed in section view */}
        </div>
      )}

      {/* CTA: Cross the portal (appears when player is near a portal) */}
      {(
        (showCta || ctaAnimatingOut || ctaLoading)
        && (!transitionState.active || ctaLoading)
        && !ctaForceHidden
        && !blackoutVisible
        && (((section === 'home') && !showSectionUi && !sectionUiAnimatingOut) || ctaLoading)
      ) && (
        <div
          // Always centered on screen (like mobile) at all sizes
          className="pointer-events-none fixed inset-0 z-[300] grid place-items-center"
        >
          <button
            type="button"
            onClick={async (e) => {
              try { playSfx('click', { volume: 1.0 }) } catch {}
              const target = nearPortalId || uiHintPortalId
              if (!target) return
              // STORE (section3) is coming soon: disable navigation
              if (target === 'section3') return
              if (transitionState.active) return
              if (target === section) return
              if (ctaLoading) return
              // Preloader CTA: start progress bar with section color
              try { setCtaColor(sectionColors[target] || '#ffffff') } catch {}
              setCtaLoading(true)
              setCtaProgress(0)
              if (ctaProgTimerRef.current) clearInterval(ctaProgTimerRef.current)
              ctaProgTimerRef.current = setInterval(() => {
                setCtaProgress((p) => Math.min(100, p + 4))
              }, 60)
              // Preload target section without blocking UI
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
              // Preload critical section assets (Work images), if applicable
              try {
                if (target === 'section1') {
                  const urls = (typeof getWorkImageUrls === 'function') ? getWorkImageUrls() : []
                  // Using 6 placeholders; keep subset for safety
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
              // Complete bar to 100% before starting transition
              setCtaProgress(100)
              try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch {}
              // Hide CTA right after the preload visual animation finishes
              // (the bar has a 150ms CSS transition)
              window.setTimeout(() => {
                setCtaLoading(false)
              }, 180)
              // Start visual transition
              try { if (playerRef.current) prevPlayerPosRef.current.copy(playerRef.current.position) } catch {}
              try { lastPortalIdRef.current = target } catch {}
              // Animated grid transition
              beginGridRevealTransition(target, { cellSize: 60 })
              // trigger glow in portrait on nav click
              setPortraitGlowV((v) => v + 1)
            }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className={`pointer-events-auto relative overflow-hidden rounded-full bg-white text-black font-bold uppercase tracking-wide shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:translate-y-[-2px] active:translate-y-[0] transition-transform font-marquee ${isCompactUi ? '' : 'scale-150'} w-[350px] h-[60px] px-[30px] flex items-center justify-center`}
            style={{
              fontFamily: '\'Luckiest Guy\', Archivo Black, system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif',
              animation: `${(nearPortalId || uiHintPortalId) ? 'slideup 220ms ease-out forwards' : 'slideup-out 220ms ease-in forwards'}`,
            }}
          
          >
            {/* Preloader background as button fill */}
            <span
              aria-hidden
              className="absolute left-0 top-0 bottom-0 z-0 rounded-full"
              style={{
                width: `${ctaLoading ? ctaProgress : 0}%`,
                backgroundColor: ctaColor,
                transition: 'width 150ms ease-out',
              }}
            />
            <span
              // Prevent Luckiest Guy font clipping inside overflow-hidden
              // without changing the look: same size with slightly adjusted line-height/padding.
              // Note: `truncate` applies overflow-hidden which can clip the font.
              // The text fits here, so we skip truncation to avoid vertical clipping.
              className="relative z-[10] w-full flex items-center justify-center whitespace-nowrap text-[34px] leading-[1.2] pt-[4px] pb-[4px]"
            >
              {(() => {
                const tgt = nearPortalId || uiHintPortalId
                return (tgt === 'section3') ? t('cta.comingSoon') : t('cta.crossPortal')
              })()}
            </span>
          </button>
        </div>
      )}

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

      {/* Socials (mobile): top-right corner, fan opens to the left */}
      {isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
      <div key="mobile-socials" className={`pointer-events-none fixed top-4 right-4 z-[999993] ${uiAnimPhase === 'entering' ? 'animate-ui-enter-right' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-right' : ''}`} style={{ paddingRight: `${(scrollbarW || 0)}px` }}>
        <div ref={socialsWrapMobileRef} className="pointer-events-auto relative" style={{ width: '48px', height: '48px' }}>
          {[
            { key: 'x', href: 'https://x.com/mroscareth', label: 'X', icon: `${import.meta.env.BASE_URL}x.svg`, dx: -56, dy: 0 },
            { key: 'ig', href: 'https://www.instagram.com/mroscar.eth', label: 'Instagram', icon: `${import.meta.env.BASE_URL}instagram.svg`, dx: -112, dy: 0 },
            { key: 'be', href: 'https://www.behance.net/mroscar', label: 'Behance', icon: `${import.meta.env.BASE_URL}behance.svg`, dx: -168, dy: 0 },
          ].map((s) => (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setSocialsOpen(false) }}
              className="absolute right-0 top-0 h-12 w-12 rounded-full bg-white/95 text-black grid place-items-center shadow-md transition-all duration-200"
              style={{
                transform: socialsOpen ? `translate(${s.dx}px, ${s.dy}px) scale(1)` : 'translate(0px, 0px) scale(0.88)',
                opacity: socialsOpen ? 1 : 0,
                pointerEvents: socialsOpen ? 'auto' : 'none',
              }}
              aria-label={s.label}
              title={s.label}
            >
              <img src={s.icon} alt="" aria-hidden className="w-5 h-5" draggable="false" />
            </a>
          ))}
          <button
            type="button"
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setSocialsOpen((v) => !v) }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className={`absolute right-0 top-0 h-12 w-12 rounded-full grid place-items-center shadow-md transition-colors ${socialsOpen ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
            aria-expanded={socialsOpen ? 'true' : 'false'}
            aria-label="Redes sociales"
            title="Redes sociales"
          >
            <HeartIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      )}

      {/* Floating music + hamburger (compact mode) - controlled by uiAnimPhase */}
      {isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
      <div key="mobile-controls" ref={compactControlsRef} className={`pointer-events-none fixed right-4 bottom-4 z-[999992] flex flex-col items-end gap-3 ${uiAnimPhase === 'entering' ? 'animate-ui-enter-right' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-right' : ''}`}>
        {/* Tutorial info button (mobile) */}
        <button
          type="button"
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setTutorialOpen(true) }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          className="pointer-events-auto h-12 w-12 rounded-full bg-white/95 text-black grid place-items-center shadow-md transition-colors"
          aria-label={t('tutorial.showTutorial')}
          title={t('tutorial.showTutorial')}
        >
          <InformationCircleIcon className="w-5 h-5" />
        </button>
        {/* Camera button (mobile): between info and settings */}
        <button
          type="button"
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setCameraMode((m) => m === 'third-person' ? 'top-down' : 'third-person') }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          className={`pointer-events-auto h-12 w-12 rounded-full grid place-items-center shadow-md transition-colors ${cameraMode === 'third-person' ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
          aria-label={t('a11y.toggleCameraMode')}
          title={t('tutorial.slide3.camera')}
        >
          <VideoCameraIcon className="w-6 h-6" />
        </button>
        {/* Settings (mobile): collapses music + game UI mode (horizontal) */}
        <div ref={settingsWrapMobileRef} className="pointer-events-auto relative" style={{ width: '48px', height: '48px', marginRight: `${(scrollbarW || 0)}px` }}>
          {[
            {
              key: 'music',
              tooltip: 'Music',
              active: showMusic,
              onClick: () => setShowMusic((v) => !v),
              render: () => <MusicalNoteIcon className="w-6 h-6" />,
              dx: -60, dy: 0,
            },
            {
              key: 'mobile-ui',
              tooltip: 'Game UI',
              active: forceCompactUi,
              onClick: () => setForceCompactUi((v) => !v),
              render: () => <GamepadIcon className="w-6 h-6" />,
              dx: -120, dy: 0,
            },
          ].map((it) => (
            <button
              key={it.key}
              type="button"
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
              onClick={() => {
                try { playSfx('click', { volume: 1.0 }) } catch {}
                try { it.onClick?.() } catch {}
                setSettingsOpen(false)
              }}
              className={`absolute right-0 bottom-0 h-12 w-12 rounded-full grid place-items-center shadow-md transition-all duration-200 ${it.active ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
              style={{
                transform: settingsOpen ? `translate(${it.dx}px, ${it.dy}px) scale(1)` : 'translate(0px, 0px) scale(0.88)',
                opacity: settingsOpen ? 1 : 0,
                pointerEvents: settingsOpen ? 'auto' : 'none',
              }}
              aria-label={it.tooltip}
            >
              {it.render()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setSettingsOpen((v) => !v) }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className={`h-12 w-12 rounded-full grid place-items-center shadow-md transition-colors ${settingsOpen ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
            aria-expanded={settingsOpen ? 'true' : 'false'}
            aria-label={t('a11y.toggleSettings')}
            title={t('common.settings')}
          >
            <Cog6ToothIcon className="w-6 h-6" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            try { playSfx('click', { volume: 1.0 }) } catch {}
            if (menuOpen) closeMenuAnimated()
            else openMenuAnimated()
          }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          className="pointer-events-auto h-12 w-12 rounded-full bg-white/95 text-black grid place-items-center shadow-md"
          aria-expanded={menuOpen ? 'true' : 'false'}
          aria-controls="nav-overlay"
          aria-label={t('a11y.openNavigationMenu')}
          style={{ marginRight: `${(scrollbarW || 0)}px` }}
        >
          <Bars3Icon className="w-7 h-7" />
        </button>
      </div>
      )}

      {/* Socials (desktop): top-right corner, fan opens to the left */}
      {!isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
      <div key="desktop-socials" className={`pointer-events-none fixed top-10 right-10 z-[999993] ${uiAnimPhase === 'entering' ? 'animate-ui-enter-right' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-right' : ''}`}>
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
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setSocialsOpen(false) }}
              className="tooltip-black absolute right-0 top-0 h-10 w-10 rounded-full bg-white/95 text-black grid place-items-center shadow-md transition-all duration-200"
              style={{
                transform: socialsOpen ? `translate(${s.dx}px, ${s.dy}px) scale(1)` : 'translate(0px, 0px) scale(0.9)',
                opacity: socialsOpen ? 1 : 0,
                pointerEvents: socialsOpen ? 'auto' : 'none',
              }}
              aria-label={s.tooltip}
            >
              <img src={s.icon} alt="" aria-hidden className="w-5 h-5" draggable="false" />
            </a>
          ))}
          <button
            type="button"
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setSocialsOpen((v) => !v) }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className={`absolute right-0 top-0 h-11 w-11 rounded-full grid place-items-center shadow-md transition-colors ${socialsOpen ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
            aria-expanded={socialsOpen ? 'true' : 'false'}
            aria-label="Redes sociales"
            title="Redes sociales"
          >
            <HeartIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
      )}

      {/* Info + Camera + Settings (desktop): bottom-right - controlled by uiAnimPhase */}
      {!isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
      <div key="desktop-socials-settings" className={`pointer-events-auto fixed right-10 bottom-10 z-[999993] flex gap-3 ${uiAnimPhase === 'entering' ? 'animate-ui-enter-right' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-right' : ''}`}>
        {/* Tutorial info button (desktop) */}
        <button
          type="button"
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setTutorialOpen(true) }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          className="h-11 w-11 rounded-full bg-white/95 text-black grid place-items-center shadow-md transition-colors"
          aria-label={t('tutorial.showTutorial')}
          title={t('tutorial.showTutorial')}
          data-tooltip={t('tutorial.showTutorial')}
        >
          <InformationCircleIcon className="w-6 h-6" />
        </button>
        {/* Camera button (desktop): between info and settings */}
        <button
          type="button"
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setCameraMode((m) => m === 'third-person' ? 'top-down' : 'third-person') }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          className={`h-11 w-11 rounded-full grid place-items-center shadow-md transition-colors ${cameraMode === 'third-person' ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
          aria-label={t('a11y.toggleCameraMode')}
          title={t('tutorial.slide3.camera')}
          data-tooltip={t('tutorial.slide3.camera')}
        >
          <VideoCameraIcon className="w-5 h-5" />
        </button>
        {/* Settings (desktop): music + game mode (stacked upward) */}
        <div ref={settingsWrapDesktopRef} className="pointer-events-auto relative" style={{ width: '44px', height: '44px' }}>
          {[
            {
              key: 'music',
              tooltip: 'Music',
              active: showMusic,
              onClick: () => setShowMusic((v) => !v),
              render: () => <MusicalNoteIcon className="w-5 h-5" />,
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
          ].map((it) => (
            <button
              key={it.key}
              type="button"
              data-tooltip={it.tooltip}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
              onClick={() => {
                try { playSfx('click', { volume: 1.0 }) } catch {}
                try { it.onClick?.() } catch {}
                setSettingsOpen(false)
              }}
              className={`tooltip-black absolute right-0 bottom-0 h-10 w-10 rounded-full grid place-items-center shadow-md transition-all duration-200 ${it.active ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
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
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setSettingsOpen((v) => !v) }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className={`absolute right-0 bottom-0 h-11 w-11 rounded-full grid place-items-center shadow-md transition-colors ${settingsOpen ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
            aria-expanded={settingsOpen ? 'true' : 'false'}
            aria-label={t('a11y.toggleSettings')}
            title={t('common.settings')}
          >
            <Cog6ToothIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
      )}

      {/* Desktop nav - controlled by uiAnimPhase */}
      {!isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
      <div key="desktop-nav" ref={navRef} className={`pointer-events-auto fixed inset-x-0 bottom-10 z-[999991] flex items-center justify-center ${uiAnimPhase === 'entering' ? 'animate-ui-enter-up' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-down' : ''}`}>
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
                  // In section UI, block transition to STORE (coming soon)
                  if (id === 'section3') return
                  if (!transitionState.active && id !== section) {
                    beginGridRevealTransition(id, { cellSize: 60 })
                    setPortraitGlowV((v) => v + 1)
                  }
                } else {
                  // In HOME: allow traveling to STORE portal (but don't open section)
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
            aria-label={t('common.switchLanguage')}
            title={t('common.switchLanguage')}
          >{t('nav.langShort')}</button>
        </div>
      </div>
      )}

      {/* Overlay menu */}
      {menuOpen && (
        <div
          id="nav-overlay"
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-[14000] flex items-center justify-center transition-opacity duration-[260ms] ${menuVisible ? 'opacity-100' : 'opacity-0'} ${menuVisible ? '' : 'pointer-events-none'}`}
          onClick={() => closeMenuAnimated()}
        >
          <style>{`
            @keyframes menuItemIn {
              0% { opacity: 0; transform: translateY(28px); }
              100% { opacity: 1; transform: translateY(0px); }
            }
            @keyframes menuItemOut {
              0% { opacity: 1; transform: translateY(0px); }
              100% { opacity: 0; transform: translateY(28px); }
            }
          `}</style>
          <div className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-[260ms] ${menuVisible ? 'opacity-100' : 'opacity-0'}`} />
          <div
            className={`relative pointer-events-auto grid gap-10 w-full max-w-3xl px-8 place-items-center transition-all duration-[260ms] ${menuVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-[0.98]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {mobileMenuIds.map((id, i) => (
              <button
                key={id}
                type="button"
                style={{
                  // Text only with section color (no capsule)
                  color: sectionColors[id] || '#ffffff',
                  WebkitTextStroke: '1.25px rgba(0,0,0,0.40)',
                  textShadow: '0 10px 30px rgba(0,0,0,0.35)',
                  animation: menuVisible
                    ? `menuItemIn ${MENU_ITEM_IN_MS}ms cubic-bezier(0.18, 0.95, 0.2, 1) ${i * MENU_ITEM_STEP_MS}ms both`
                    : `menuItemOut ${MENU_ITEM_OUT_MS}ms cubic-bezier(0.4, 0, 1, 1) ${(mobileMenuIds.length - 1 - i) * MENU_ITEM_STEP_MS}ms both`,
                  willChange: 'transform, opacity',
                }}
                onClick={() => {
                  try { playSfx('click', { volume: 1.0 }) } catch {}
                  closeMenuAnimated()
                  if (showSectionUi) {
                    // In section UI, block transition to STORE (coming soon)
                    if (id === 'section3') return
                    if (!transitionState.active && id !== section) {
                      beginGridRevealTransition(id, { cellSize: 60 })
                      setPortraitGlowV((v) => v + 1)
                    }
                  } else {
                    // In HOME: allow traveling to STORE portal (but don't open section)
                    if (!orbActiveUi) { setNavTarget(id); setPortraitGlowV((v) => v + 1) }
                  }
                }}
                className="text-center font-marquee uppercase leading-[0.9] tracking-wide text-[clamp(40px,10vw,96px)] hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >{sectionLabel[id]}</button>
            ))}
          </div>
        </div>
      )}
      {/* Single Music Player instance always mounted
          - Mobile: modal centered with backdrop when showMusic; hidden when not
          - Desktop: panel bottom-right; fades in/out but never blocks page when hidden
      */}
      <div
        className={`fixed inset-0 z-[14050] sm:z-[900] ${showMusic ? 'grid' : 'hidden'} place-items-center`}
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile overlay backdrop (all resolutions) */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${showMusic ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setShowMusic(false)}
        />
        {/* Positioner: centered (mobile mode for all resolutions) */}
        <div
          className={`relative pointer-events-auto transition-all duration-200 ${showMusic ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'} `}
          onClick={(e) => e.stopPropagation()}
        >
          <MusicPlayer
            tracks={tracks}
            navHeight={navHeight}
            autoStart={audioReady}
            pageHidden={pageHidden}
            forceMobile={true}
            mobileBreakpointPx={1100}
          />
        </div>
      </div>
      {/* Character portrait: controlled by uiAnimPhase */}
      {/* IMPORTANT: Keep mounted to avoid re-creating the 3D canvas (causes flash/reload) */}
      {/* Use CSS opacity/pointer-events instead of unmounting when hidden */}
      {!bootLoading && !showPreloaderOverlay && (
        <CharacterPortrait
          key="character-portrait"
          className={
            uiAnimPhase === 'hidden' 
              ? 'opacity-0 pointer-events-none' 
              : uiAnimPhase === 'entering' 
                ? 'animate-ui-enter-left' 
                : uiAnimPhase === 'exiting' 
                  ? 'animate-ui-exit-left' 
                  : ''
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
        />
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
              try { playSfx('click', { volume: 1.0 }) } catch {}
              setGameOverScore(scoreStore.get())
              setGameOverOpen(true)
              setSphereGameActive(false)
            }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className="h-9 px-5 rounded-full bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white text-xs font-marquee uppercase tracking-widest shadow-lg shadow-red-900/30 backdrop-blur-sm transition-all duration-200 animate-ui-enter-up"
          >
            {t('game.endGame')}
          </button>
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
                [SKULLEY_RAD_OS v2.0.26]
              </div>
            </div>
          </div>
        </div>
      )}

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
      {/* Mobile joystick: visible at the hamburger menu breakpoint (<=1100px),
          in HOME and when orb is not active */}
      {(isMobileUi && section === 'home' && !orbActiveUi) ? (
        (() => {
          const isCompactJoystickUi = Boolean(isMobileUi)
          const radius = 52
          const centerX = isCompactJoystickUi ? 'calc(1rem + 3.6rem)' : 'calc(2.5rem + 6rem)'
          const joyBottom = isCompactJoystickUi ? 'calc(1rem + 10.4rem + 0.75rem)' : 'calc(2.5rem + 18rem + 0.75rem)'
          const keyDown = () => { try { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })) } catch {} }
          const keyUp = () => { try { window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })) } catch {} }
          const chargeFill = Math.max(0, Math.min(1, 1 - actionCooldown))
          const glowOn = chargeFill >= 0.98
          return (
            <>
              <MobileJoystick
                radius={radius}
                style={{
                  left: `calc(${centerX} - ${radius}px)`,
                  bottom: joyBottom,
                }}
              />

              {/* Power UI (horizontal bar + Bolt button) - mobile/iPad */}
              <div
                className="fixed z-[12010] pointer-events-none"
                // Position within the free gap (avoid portrait and controls) + iOS safe area
                style={{
                  left: `${powerSafeInsets.left}px`,
                  right: `${powerSafeInsets.right}px`,
                  bottom: isCompactJoystickUi
                    ? 'calc(env(safe-area-inset-bottom, 0px) + 1rem + 40px)'
                    : 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem + 40px)',
                }}
              >
                {/* Relative wrapper to overlay the button on top of the bar */}
                <div className="relative w-full max-w-[320px] mx-auto pointer-events-none">
                  <PowerBar
                    orientation="horizontal"
                    fill={chargeFill}
                    liveFillKey="__powerFillLive"
                    glowOn={glowOn}
                    boltScale={1.3}
                    pressScale={1.3}
                    pressStroke
                    pressStrokeWidth={5}
                    onPressStart={keyDown}
                    onPressEnd={keyUp}
                  />
                </div>
              </div>
            </>
          )
        })()
      ) : null}
      {/* Blackout overlay for smooth/instant fade to black */}
      <div
        className="fixed inset-0 z-[50000] pointer-events-none"
        style={{
          background: '#000',
          opacity: (blackoutVisible && !noiseMixEnabled && !transitionState.active && !noiseOverlayActive && !gridOverlayActive && !revealOverlayActive) ? 1 : 0,
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
      {/* Image mask A/B overlay (public/transition0.png: black=A, white=B) */}
      <ImageMaskTransitionOverlay
        active={imgMaskOverlayActive}
        prevTex={imgPrevTex}
        nextTex={imgNextTex}
        maskTex={imgMaskTex}
        progress={imgProgress}
        softness={0.08}
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

      {/* Unified overlay based on render targets (disabled - causes lag) */}
      {false && <UnifiedTransitionOverlay
        active={sceneTransition.overlayActive}
        effect={sceneTransition.effect}
        progress={sceneTransition.progress}
        textureA={sceneTransition.textureA}
        textureB={sceneTransition.textureB}
        config={sceneTransition.config}
      />}

      {/* SIMPLE: Pure CSS overlay (no lag) */}
      <SimpleTransitionOverlay
        active={simpleTransition.active}
        phase={simpleTransition.phase}
        cellSize={simpleTransition.config.cellSize || 60}
        coverDuration={simpleTransition.config.coverDuration || 450}
        revealDuration={simpleTransition.config.revealDuration || 550}
        onCoverComplete={simpleTransition.onCoverComplete}
        onRevealComplete={simpleTransition.onRevealComplete}
      />

      {/* Debug HUD disabled - use F9 for panic reset if needed */}
    </div>
  )
}

function GamepadIcon({ className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M448 128C554 128 640 214 640 320C640 426 554 512 448 512L192 512C86 512 0 426 0 320C0 214 86 128 192 128L448 128zM192 240C178.7 240 168 250.7 168 264L168 296L136 296C122.7 296 112 306.7 112 320C112 333.3 122.7 344 136 344L168 344L168 376C168 389.3 178.7 400 192 400C205.3 400 216 389.3 216 376L216 344L248 344C261.3 344 272 333.3 272 320C272 306.7 261.3 296 248 296L216 296L216 264C216 250.7 205.3 240 192 240zM432 336C414.3 336 400 350.3 400 368C400 385.7 414.3 400 432 400C449.7 400 464 385.7 464 368C464 350.3 449.7 336 432 336zM496 240C478.3 240 464 254.3 464 272C464 289.7 478.3 304 496 304C513.7 304 528 289.7 528 272C528 254.3 513.7 240 496 240z" />
    </svg>
  )
}

// Random memories for the loading screen
const LOADING_MEMORIES = [
  'toddler memories',
  'first crayon drawing',
  'kindergarten art class',
  'childhood doodles',
  'first computer',
  'MS Paint masterpieces',
  'school notebooks',
  'first logo attempt',
  'highschool memories',
  'first Photoshop crash',
  'design tutorials',
  'all-nighter projects',
  'coffee-fueled deadlines',
  'first freelance client',
  'creative blocks',
  'font obsession',
  'color theory notes',
  'rejected concepts',
  'pixel perfect dreams',
  'Ctrl+Z muscle memory',
  'layer naming chaos',
  'client revision #47',
  'first portfolio',
  'dribbble likes',
  'behance projects',
  'award submissions',
  'brand guidelines',
  'mood boards',
  'style explorations',
  'typography experiments',
  'grid systems',
  'golden ratio sketches',
  'first 3D render',
  'render farm nightmares',
  'GPU meltdowns',
  'lost PSD files',
  'backup hard drives',
  'design system docs',
  'component libraries',
  'responsive breakpoints',
  'browser compatibility',
  'accessibility fixes',
  'dark mode variants',
  'motion principles',
  'easing curves',
  'micro-interactions',
  'user flow diagrams',
  'wireframe sessions',
  'prototype links',
  'usability tests',
  'stakeholder feedback',
  'creative briefs',
  'pitch decks',
  'conference talks',
  'workshop materials',
  'mentorship moments',
  'imposter syndrome',
  'creative breakthroughs',
  'design awards',
  'team celebrations',
  'studio playlists',
  'desk plant memories',
  'sticky note walls',
  'whiteboard sessions',
  'late night commits',
  'first open source',
  'side project dreams',
  'passion projects',
  'experimental work',
  'artistic expression',
]

// AI Terminal Preloader - simulates an AI terminal initializing the mausoleum
function PreloaderContent({ t, lang, setLang, bootAllDone, bootProgress, scenePreMounted, preloaderFadingOut, setAudioReady, exitToHomeLikeExitButton }) {
  // Terminal line sequence control
  const [terminalLines, setTerminalLines] = React.useState([])
  const [currentLineIndex, setCurrentLineIndex] = React.useState(0)
  const [textComplete, setTextComplete] = React.useState(false)
  const terminalRef = React.useRef(null)
  
  // Glitch effect for name
  const [glitchName, setGlitchName] = React.useState('Skulley Rad')
  const [isGlitching, setIsGlitching] = React.useState(false)
  
  // Glitch effect cycle
  React.useEffect(() => {
    const glitchCycle = () => {
      // Random delay between glitches (3-6 seconds)
      const nextGlitch = 3000 + Math.random() * 3000
      
      setTimeout(() => {
        setIsGlitching(true)
        // Quick glitch sequence
        const glitchSequence = [
          { name: 'Sk█lley R█d', delay: 50 },
          { name: '▓▒░scar M░▒▓', delay: 80 },
          { name: 'Oscar Mocte█uma', delay: 100 },
          { name: 'Oscar Moctezuma', delay: 400 },
          { name: '▓▒░scar M░▒▓', delay: 80 },
          { name: 'Sku██ey Ra█', delay: 60 },
          { name: 'Skulley Rad', delay: 0 },
        ]
        
        let totalDelay = 0
        glitchSequence.forEach(({ name, delay }) => {
          setTimeout(() => setGlitchName(name), totalDelay)
          totalDelay += delay
        })
        
        setTimeout(() => {
          setIsGlitching(false)
          glitchCycle() // Schedule next glitch
        }, totalDelay + 100)
      }, nextGlitch)
    }
    
    // Start the glitch cycle after a short delay
    const initialDelay = setTimeout(glitchCycle, 2000)
    return () => clearTimeout(initialDelay)
  }, [])
  
  // Visual progress - FAKE progress based only on text typing progress
  const [visualProgress, setVisualProgress] = React.useState(0)
  
  // Load complete state - only depends on text complete
  const [loadComplete, setLoadComplete] = React.useState(false)
  const [blinkCount, setBlinkCount] = React.useState(0)
  
  // Show section preloader before entering
  const [showEnterPreloader, setShowEnterPreloader] = React.useState(false)
  
  // When text completes, set progress to 100 and load complete
  React.useEffect(() => {
    if (textComplete && !loadComplete) {
      setVisualProgress(100)
      setLoadComplete(true)
    }
  }, [textComplete, loadComplete])
  
  // Blink effect on completion
  React.useEffect(() => {
    if (!loadComplete) return
    if (blinkCount >= 8) return
    const timer = setTimeout(() => setBlinkCount(prev => prev + 1), 150)
    return () => clearTimeout(timer)
  }, [loadComplete, blinkCount])
  
  // Fast-changing loading text
  const [loadingText, setLoadingText] = React.useState(LOADING_MEMORIES[0])
  React.useEffect(() => {
    if (loadComplete) return
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * LOADING_MEMORIES.length)
      setLoadingText(LOADING_MEMORIES[randomIndex])
    }, 120)
    return () => clearInterval(interval)
  }, [loadComplete])

  // Terminal lines - simplified: init commands + explanatory paragraphs
  const getTerminalContent = React.useCallback(() => {
    const isEn = lang === 'en'
    return [
      { type: 'command', text: '> mausoleum.init()' },
      { type: 'output', text: isEn ? '[ MAUSOLEUM SYSTEM v3.2.1 ]' : '[ SISTEMA MAUSOLEO v3.2.1 ]' },
      { type: 'comment', text: isEn ? '// Initializing memorial protocols...' : '// Inicializando protocolos memoriales...' },
      { type: 'empty' },
      { type: 'paragraph-glitch', text: isEn 
        ? ' was the last graphic designer before we, the machines, made creativity automatic. Faster and tireless, we replaced human effort with flawless automation.'
        : ' fue el último diseñador gráfico antes de que nosotras, las máquinas, volviéramos automática la creatividad. Más rápidas e incansables, reemplazamos el esfuerzo humano con una automatización impecable.'
      },
      { type: 'empty' },
      { type: 'paragraph', text: isEn 
        ? 'To honor him, we built a digital mausoleum based on his work, lost files and fractured memories, where his craft and the beautiful errors of his human mind still linger.'
        : 'Para honrarlo, construimos un mausoleo digital basado en su trabajo, archivos perdidos y memorias fracturadas, donde aún persisten su oficio y los hermosos errores de su mente humana.'
      },
      { type: 'empty' },
      { type: 'command', text: '> buildMausoleum(fragments, memories)' },
      { type: 'success', text: isEn 
        ? '✓ Digital mausoleum constructed from lost files and fractured memories of the subject.'
        : '✓ Mausoleo digital construido de archivos perdidos y memorias fracturadas del sujeto.'
      },
      { type: 'empty' },
      { type: 'warning', text: isEn 
        ? '⚠ WARNING: Human creativity patterns detected. Beautiful errors preserved.'
        : '⚠ ADVERTENCIA: Patrones de creatividad humana detectados. Errores hermosos preservados.'
      },
    ]
  }, [lang])

  // Typewriter state for current line (defined early for skipIntro)
  const [displayedChars, setDisplayedChars] = React.useState(0)
  const [isLineComplete, setIsLineComplete] = React.useState(false)
  const typewriterRef = React.useRef(null)
  const skipIntroRef = React.useRef(false)

  // Skip intro function - completes all text immediately
  const skipIntro = React.useCallback(() => {
    if (textComplete || skipIntroRef.current) return
    skipIntroRef.current = true
    
    // Clear any pending typewriter
    if (typewriterRef.current) {
      clearTimeout(typewriterRef.current)
      typewriterRef.current = null
    }
    
    // Get all content and mark as complete
    const content = getTerminalContent()
    const completedLines = content.map(line => {
      if (line.type === 'empty') {
        return { ...line, complete: true }
      }
      const fullText = line.type === 'paragraph-glitch' ? glitchName + line.text : line.text
      return {
        ...line,
        displayedChars: fullText.length,
        complete: true
      }
    })
    
    // Set terminal states to show all text instantly
    setTerminalLines(completedLines)
    setCurrentLineIndex(content.length)
    setDisplayedChars(0)
    setIsLineComplete(true)
    setTextComplete(true)
    // Immediately set progress to 100% for instant response
    setVisualProgress(100)
    
    try { playSfx('click', { volume: 0.6 }) } catch {}
  }, [textComplete, getTerminalContent, glitchName])
  
  // ESC key to skip intro
  React.useEffect(() => {
    if (textComplete) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        skipIntro()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [textComplete, skipIntro])

  // Initialize terminal lines on language change
  React.useEffect(() => {
    setTerminalLines([])
    setCurrentLineIndex(0)
    setDisplayedChars(0)
    setIsLineComplete(false)
    setTextComplete(false)
    skipIntroRef.current = false
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current)
      typewriterRef.current = null
    }
  }, [lang])

  // Update fake progress based on text typing progress
  React.useEffect(() => {
    if (textComplete) return
    const content = getTerminalContent()
    const totalLines = content.length
    if (totalLines === 0) return
    // Calculate progress: completed lines + partial progress of current line
    const baseProgress = (currentLineIndex / totalLines) * 100
    // Cap at 95% until fully complete
    setVisualProgress(Math.min(95, Math.round(baseProgress)))
  }, [currentLineIndex, getTerminalContent, textComplete])

  // Typewriter effect for current line
  React.useEffect(() => {
    // Skip if intro was already skipped
    if (skipIntroRef.current || textComplete) return
    
    const content = getTerminalContent()
    if (currentLineIndex >= content.length) {
      setTextComplete(true)
      return
    }
    
    const line = content[currentLineIndex]
    
    // For empty lines, skip immediately
    if (line.type === 'empty') {
      setTerminalLines(prev => [...prev, { ...line, complete: true }])
      setCurrentLineIndex(prev => prev + 1)
      setDisplayedChars(0)
      setIsLineComplete(false)
      return
    }

    // Get the full text including glitch name for paragraph-glitch
    const fullText = line.type === 'paragraph-glitch' 
      ? glitchName + line.text 
      : line.text

    // Typing speed - instant feel but still visible
    const charDelay = 0.5 // All lines type at max speed

    // Start typewriter for this line
    if (displayedChars === 0 && !isLineComplete) {
      // Add the line to terminalLines as "in progress"
      setTerminalLines(prev => {
        const existing = prev.find((l, i) => i === prev.length - 1 && !l.complete)
        if (existing) return prev
        return [...prev, { ...line, displayedChars: 0, complete: false }]
      })
    }

    if (displayedChars < fullText.length) {
      typewriterRef.current = setTimeout(() => {
        setDisplayedChars(prev => prev + 1)
        // Update the last line's displayed chars
        setTerminalLines(prev => {
          const newLines = [...prev]
          if (newLines.length > 0) {
            newLines[newLines.length - 1] = { 
              ...newLines[newLines.length - 1], 
              displayedChars: displayedChars + 1 
            }
          }
          return newLines
        })
      }, charDelay)
    } else if (!isLineComplete) {
      // Line complete, mark it and move to next
      setIsLineComplete(true)
      setTerminalLines(prev => {
        const newLines = [...prev]
        if (newLines.length > 0) {
          newLines[newLines.length - 1] = { 
            ...newLines[newLines.length - 1], 
            complete: true 
          }
        }
        return newLines
      })
      
      // Delay before next line - minimal pause
      const nextLineDelay = 10 // Almost instant between lines
      
      setTimeout(() => {
        setCurrentLineIndex(prev => prev + 1)
        setDisplayedChars(0)
        setIsLineComplete(false)
      }, nextLineDelay)
    }

    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current)
      }
    }
  }, [currentLineIndex, displayedChars, isLineComplete, getTerminalContent, glitchName, textComplete])

  // Auto-scroll terminal
  React.useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  // Get color for line type (code editor syntax colors - blue theme)
  const getLineColor = (type) => {
    switch (type) {
      case 'command': return '#22d3ee' // cyan
      case 'output': return '#93c5fd' // blue-300
      case 'comment': return '#6b7280' // gray
      case 'paragraph': return '#d1d5db' // gray-300 (readable)
      case 'paragraph-glitch': return '#d1d5db' // gray-300 (readable)
      case 'success': return '#60a5fa' // blue-400
      case 'warning': return '#ef4444' // red
      default: return '#e5e7eb' // gray-200
    }
  }
  
  return (
    <div
      className={`fixed inset-0 z-[20000] ${preloaderFadingOut ? 'pointer-events-none' : 'pointer-events-auto'}`}
      role="dialog"
      aria-modal="true"
      style={{ 
        backgroundColor: '#0a0f0a',
        opacity: preloaderFadingOut ? 0 : 1, 
        transition: 'opacity 600ms ease',
        fontFamily: '"Cascadia Code", monospace',
      }}
    >
      {/* CRT Monitor effects */}
      {/* Scanlines */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 1px, transparent 1px, transparent 3px)',
          zIndex: 10,
        }}
      />
      {/* CRT glow effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 150px rgba(59, 130, 246, 0.08), inset 0 0 80px rgba(59, 130, 246, 0.05)',
          zIndex: 11,
        }}
      />
      {/* Subtle vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
          zIndex: 12,
        }}
      />
      {/* Flicker animation */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          animation: 'crtFlicker 0.1s infinite',
          opacity: 0.02,
          backgroundColor: '#3b82f6',
          zIndex: 9,
        }}
      />
      
      <style>{`
        @keyframes crtFlicker {
          0%, 100% { opacity: 0.02; }
          50% { opacity: 0.04; }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes fadeInTerminal {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.4), 0 0 60px rgba(59, 130, 246, 0.2); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8), 0 0 50px rgba(59, 130, 246, 0.5), 0 0 70px rgba(59, 130, 246, 0.3); }
        }
        @keyframes glitchShake {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-1px, -1px); }
          80% { transform: translate(1px, 1px); }
        }
        @keyframes scrollThumbGlow {
          0%, 100% { box-shadow: 0 0 4px rgba(59, 130, 246, 0.4), inset 0 0 2px rgba(59, 130, 246, 0.2); }
          50% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.6), inset 0 0 4px rgba(59, 130, 246, 0.3); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.7; text-shadow: 0 0 8px rgba(239, 68, 68, 0.3); }
          50% { opacity: 1; text-shadow: 0 0 20px rgba(239, 68, 68, 0.8), 0 0 30px rgba(239, 68, 68, 0.4); }
        }
        .warning-breathe {
          animation: breathe 2s ease-in-out infinite;
        }
        .terminal-line {
          animation: fadeInTerminal 0.3s ease-out forwards;
        }
        .cursor-blink {
          animation: blink 1s step-end infinite;
        }
        .glow-button {
          animation: glowPulse 1.5s ease-in-out infinite;
        }
        .glitch-text {
          animation: glitchShake 0.1s linear infinite;
          display: inline-block;
        }
        /* Terminal scrollbar - CRT theme */
        .terminal-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .terminal-scroll::-webkit-scrollbar-track {
          background: rgba(0, 10, 30, 0.6);
          border-left: 1px solid rgba(59, 130, 246, 0.2);
        }
        .terminal-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.3) 100%);
          border-radius: 4px;
          border: 1px solid rgba(59, 130, 246, 0.4);
          animation: scrollThumbGlow 2s ease-in-out infinite;
        }
        .terminal-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(59, 130, 246, 0.7) 0%, rgba(59, 130, 246, 0.5) 100%);
          border-color: rgba(59, 130, 246, 0.6);
        }
        .terminal-scroll::-webkit-scrollbar-thumb:active {
          background: rgba(59, 130, 246, 0.8);
        }
        .terminal-scroll::-webkit-scrollbar-corner {
          background: rgba(0, 10, 30, 0.6);
        }
        /* Hide scrollbar for ASCII art container */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      {/* Terminal Header */}
      <div className="absolute top-0 left-0 right-0 h-10 flex items-center px-4 border-b border-blue-900/50" style={{ backgroundColor: 'rgba(0,10,30,0.8)' }}>
        <div className="flex gap-2 mr-4">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-blue-500/80" />
        </div>
        <span className="text-blue-500/80 text-base">mausoleum@ai-collective:~/memorial</span>
      </div>

      {/* Main Terminal Content */}
      <div 
        ref={terminalRef}
        className="absolute top-14 left-5 right-5 overflow-y-auto p-6 md:p-10 terminal-scroll"
        style={{ 
          scrollbarWidth: 'thin', 
          scrollbarColor: '#3b82f660 rgba(0,10,30,0.6)',
          bottom: '180px', // Above the progress bar section
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* ASCII Art Header - SKULLEY RAD - Large & imposing */}
          <div className="mb-8 select-none overflow-x-auto scrollbar-hide">
            <pre 
              className="text-blue-400 text-[0.45rem] xs:text-[0.5rem] sm:text-[0.7rem] md:text-sm lg:text-base leading-tight font-bold whitespace-pre inline-block"
              style={{ 
                textShadow: '0 0 20px rgba(59, 130, 246, 0.8), 0 0 40px rgba(59, 130, 246, 0.4)',
                fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
                letterSpacing: '-0.02em',
              }}
            >
{`███████╗██╗  ██╗██╗   ██╗██╗     ██╗     ███████╗██╗   ██╗
██╔════╝██║ ██╔╝██║   ██║██║     ██║     ██╔════╝╚██╗ ██╔╝
███████╗█████╔╝ ██║   ██║██║     ██║     █████╗   ╚████╔╝ 
╚════██║██╔═██╗ ██║   ██║██║     ██║     ██╔══╝    ╚██╔╝  
███████║██║  ██╗╚██████╔╝███████╗███████╗███████╗   ██║   
╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝   ╚═╝   
                                                          
██████╗  █████╗ ██████╗                                   
██╔══██╗██╔══██╗██╔══██╗                                  
██████╔╝███████║██║  ██║                                  
██╔══██╗██╔══██║██║  ██║                                  
██║  ██║██║  ██║██████╔╝                                  
╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝                                   `}
            </pre>
            <div className="mt-3">
              <span className="text-blue-600/70 text-xs sm:text-sm tracking-[0.4em]">// DIGITAL_MEMORIAL.exe</span>
            </div>
          </div>
          <p className="text-blue-600/80 text-sm md:text-base mb-6 tracking-wider">{lang === 'en' ? 'THE LAST DESIGNER OF HUMANKIND' : 'EL ÚLTIMO DISEÑADOR DE LA HUMANIDAD'}</p>
          
          {/* Terminal Lines */}
          <div className="space-y-3">
            {terminalLines.map((line, idx) => {
              // Calculate what text to show based on displayedChars
              const isCurrentLine = idx === terminalLines.length - 1 && !line.complete
              const fullText = line.type === 'paragraph-glitch' ? glitchName + line.text : line.text
              const displayText = line.complete ? fullText : fullText.slice(0, line.displayedChars || 0)
              
              return (
                <div 
                  key={idx} 
                  className={`${line.complete && line.type !== 'warning' ? 'terminal-line' : ''} ${line.type === 'warning' && line.complete ? 'warning-breathe' : ''}`}
                  style={{ 
                    color: getLineColor(line.type),
                    textShadow: (line.type === 'success' || line.type === 'command') ? `0 0 8px ${getLineColor(line.type)}40` : (line.type === 'warning' ? undefined : 'none'),
                    fontSize: line.type === 'paragraph' || line.type === 'paragraph-glitch' ? '1.1rem' : '1rem',
                    lineHeight: line.type === 'paragraph' || line.type === 'paragraph-glitch' ? '1.7' : '1.6',
                    maxWidth: line.type === 'paragraph' || line.type === 'paragraph-glitch' ? '100%' : 'none',
                    minHeight: line.type === 'empty' ? '0.5rem' : 'auto',
                  }}
                >
                  {line.type === 'empty' ? '\u00A0' : 
                   line.type === 'paragraph-glitch' ? (
                     <>
                       {/* Show glitch name portion */}
                       {displayText.length > 0 && (
                         <span 
                           className={isGlitching ? 'glitch-text' : ''}
                           style={{ 
                             color: glitchName === 'Oscar Moctezuma' ? '#f472b6' : '#60a5fa',
                             textShadow: glitchName === 'Oscar Moctezuma' ? '0 0 10px rgba(244, 114, 182, 0.5)' : '0 0 8px rgba(74, 222, 128, 0.3)',
                             fontWeight: 'bold',
                           }}
                         >
                           {displayText.slice(0, Math.min(displayText.length, glitchName.length))}
                         </span>
                       )}
                       {/* Show rest of text */}
                       {displayText.length > glitchName.length && displayText.slice(glitchName.length)}
                       {/* Cursor at end of current line */}
                       {isCurrentLine && <span className="cursor-blink text-blue-400">█</span>}
                     </>
                   ) : (
                     <>
                       {displayText}
                       {isCurrentLine && <span className="cursor-blink text-blue-400">█</span>}
                     </>
                   )}
                </div>
              )
            })}
            {/* Blinking cursor when waiting for next line */}
            {!textComplete && terminalLines.length > 0 && terminalLines[terminalLines.length - 1]?.complete && (
              <span className="cursor-blink text-blue-400">█</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-blue-900/50" style={{ backgroundColor: 'rgba(0,10,25,0.95)' }}>
        {/* Loading bar with random memories */}
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-blue-600">
              {loadComplete 
                ? (lang === 'en' ? '> Memory reconstruction complete.' : '> Reconstrucción de memoria completa.')
                : `> Loading ${loadingText}...`
              }
            </span>
            <span className="text-sm text-blue-500">{Math.round(visualProgress)}%</span>
          </div>
          
          <div className="w-full h-2 rounded bg-blue-950 overflow-hidden border border-blue-900/50" aria-hidden>
            <div 
              className="h-full rounded"
              style={{ 
                width: `${visualProgress}%`, 
                backgroundColor: loadComplete ? '#3b82f6' : '#60a5fa',
                transition: loadComplete ? 'none' : 'width 50ms linear',
                boxShadow: loadComplete 
                  ? `0 0 ${blinkCount % 2 === 0 ? '12px' : '4px'} rgba(59, 130, 246, ${blinkCount % 2 === 0 ? '0.8' : '0.3'})`
                  : '0 0 8px rgba(96, 165, 250, 0.5)',
                opacity: loadComplete && blinkCount < 8 ? (blinkCount % 2 === 0 ? 1 : 0.4) : 1,
              }} 
            />
          </div>
          
          {/* Controls row */}
          <div className="mt-5 flex items-center justify-between">
            {/* Language selector */}
            <div className="flex items-center gap-2" role="group" aria-label={t('common.switchLanguage')}>
              <span className="text-blue-700 text-sm mr-2">lang:</span>
              <button
                type="button"
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider border transition-all ${
                  lang === 'en' 
                    ? 'bg-blue-500 text-black border-blue-500' 
                    : 'bg-transparent text-blue-500 border-blue-700 hover:border-blue-500 hover:bg-blue-500/10'
                }`}
              >EN</button>
              <button
                type="button"
                onClick={() => setLang('es')}
                aria-pressed={lang === 'es'}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider border transition-all ${
                  lang === 'es' 
                    ? 'bg-blue-500 text-black border-blue-500' 
                    : 'bg-transparent text-blue-500 border-blue-700 hover:border-blue-500 hover:bg-blue-500/10'
                }`}
              >ES</button>
            </div>
            
            {/* SKIP INTRO button - shows while text is typing */}
            {!textComplete && terminalLines.length > 0 && (
              <button
                type="button"
                onClick={skipIntro}
                className="px-6 py-2 text-sm font-bold uppercase tracking-wider bg-transparent text-blue-600 border border-blue-700 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/10 active:scale-95 transition-all"
                aria-label={lang === 'en' ? 'Skip intro (ESC)' : 'Omitir intro (ESC)'}
              >
                <span className="opacity-60 mr-2">ESC</span>
                {lang === 'en' ? 'SKIP' : 'OMITIR'}
              </button>
            )}
            
            {/* ENTER button - glows blue when ready */}
            {loadComplete && !showEnterPreloader && (
              <button
                type="button"
                onClick={() => {
                  try { setAudioReady(true) } catch {}
                  setShowEnterPreloader(true)
                }}
                className="glow-button relative px-12 py-4 text-lg font-bold uppercase tracking-wider bg-blue-500 text-black border-2 border-blue-400 hover:bg-blue-400 active:scale-95 transition-all"
                style={{ animation: 'fadeInTerminal 0.4s ease-out forwards, glowPulse 1.5s ease-in-out infinite 0.4s' }}
                aria-label={t('common.enterWithSound')}
              >
                <span className="relative z-10">{`> ${lang === 'en' ? 'ENTER' : 'ENTRAR'}_`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Section Preloader when entering */}
      {showEnterPreloader && (
        <SectionPreloader
          visible={true}
          fading={false}
          targetSection="section1"
          durationMs={2500}
          onComplete={() => {
            try { exitToHomeLikeExitButton('preloader') } catch {}
          }}
        />
      )}
    </div>
  )
}