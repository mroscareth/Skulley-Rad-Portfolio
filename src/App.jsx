import React, { useRef, useState, useMemo, Suspense, lazy, useEffect } from 'react'
import gsap from 'gsap'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Environment from './components/Environment.jsx'
import { AdaptiveDpr, useGLTF, useAnimations, TransformControls, Html, ContactShadows, Environment as DreiEnv } from '@react-three/drei'
import html2canvas from 'html2canvas'
// import DomRippleOverlay from './components/DomRippleOverlay.jsx'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
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
// Removed psycho/dissolve overlays
import { MusicalNoteIcon, XMarkIcon, Bars3Icon, ChevronUpIcon, ChevronDownIcon, HeartIcon, Cog6ToothIcon, ArrowPathIcon, VideoCameraIcon, InformationCircleIcon } from '@heroicons/react/24/solid'
import GpuStats from './components/GpuStats.jsx'
import FrustumCulledGroup from './components/FrustumCulledGroup.jsx'
import { playSfx, preloadSfx } from './lib/sfx.js'
import NoiseTransitionOverlay from './components/NoiseTransitionOverlay.jsx'
import ScreenFadeOverlay from './components/ScreenFadeOverlay.jsx'
import ImageMaskTransitionOverlay from './components/ImageMaskTransitionOverlay.jsx'
import ImageRevealMaskOverlay from './components/ImageRevealMaskOverlay.jsx'
import GridRevealOverlay from './components/GridRevealOverlay.jsx'
import UnifiedTransitionOverlay from './components/UnifiedTransitionOverlay.jsx'
import SimpleTransitionOverlay, { useSimpleTransition } from './components/SimpleTransitionOverlay.jsx'
import { useSceneTransition, TransitionEffect } from './lib/useSceneTransition.js'
import { useLanguage } from './i18n/LanguageContext.jsx'
import GlobalCursor from './components/GlobalCursor.jsx'
import TutorialModal, { useTutorialShown } from './components/TutorialModal.jsx'
import Typewriter from 'typewriter-effect'
import FakeGrass from './components/FakeGrass.jsx'
// (Tumba removida)
const Section2 = lazy(() => import('./components/Section2.jsx'))
const Section3 = lazy(() => import('./components/Section3.jsx'))
const Section4 = lazy(() => import('./components/Section4.jsx'))

// Admin Dashboard (lazy loaded)
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

// Sombra "blob" (abstracta y barata): no usa shadow maps ni ContactShadows RTT.
function BlobShadow({
  playerRef,
  enabled = true,
  size = 0.5,
  opacity = 1,
  // Control fino del ?centro oscuro? (0..1)
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
      // M?s contraste para que se note incluso con halftone/post
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
      // Un poquito m?s arriba para evitar z-fighting con el suelo
      ref.current.position.set(tmp.x, 0.02, tmp.z)
    } catch {}
  })
  useEffect(() => () => { try { tex?.dispose?.() } catch {} }, [tex])
  if (!enabled || !tex) return null
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      // Asegurar que se vea siempre (sombra abstracta)
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

// URLs de im?genes cr?ticas de WORK (evitar importar Section1.jsx)
function getWorkImageUrls() {
  try {
    return [`${import.meta.env.BASE_URL}Etherean.jpg`]
  } catch {
    return []
  }
}
// Shake "debug" (ligero): mantener MUY sutil para no marear ni interferir con controles
function EggMainShake({ active, amplitude = 0.008, rot = 0.0024, frequency = 12 }) {
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

// Sombras de contacto (mejoran mucho la ?pegada? al piso).
// Mantenerlas separadas del shadow map principal evita subir mapSize global.
function PlayerContactShadows({ playerRef, enabled = true, lowPerf = false }) {
  const groupRef = useRef()
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!enabled) return
    if (!groupRef.current || !playerRef?.current) return
    try {
      playerRef.current.getWorldPosition(tmp)
      // Pegadas al suelo (ligero offset para evitar z-fighting)
      groupRef.current.position.set(tmp.x, 0.01, tmp.z)
    } catch {}
  })
  if (!enabled) return null
  return (
    <group ref={groupRef} position={[0, 0.01, 0]}>
      <ContactShadows
        // OPTIMIZACIÓN AGRESIVA: frames=1 siempre (estático), RTT continuo es muy costoso
        opacity={lowPerf ? 0.3 : 0.45}
        scale={lowPerf ? 4.0 : 5.0}
        blur={lowPerf ? 1.2 : 2.0}
        far={lowPerf ? 4.0 : 6.0}
        resolution={lowPerf ? 64 : 256}
        color={'#000000'}
        frames={1}
      />
    </group>
  )
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
  // Detectar si estamos en /admin para renderizar el dashboard
  const isAdminRoute = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname.startsWith('/admin')
  }, [])

  // Si estamos en /admin, renderizar solo el AdminApp
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
  // OPTIMIZACIÓN: Detección de perfil móvil/low-perf mejorada (incluye GPU integrada)
  const isMobilePerf = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer:coarse)').matches
    const saveData = navigator.connection && (navigator.connection.saveData || (navigator.connection.effectiveType && /2g/.test(navigator.connection.effectiveType)))
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4
    const lowThreads = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
    const highDPR = window.devicePixelRatio && window.devicePixelRatio > 2
    
    // OPTIMIZACIÓN: Detectar GPU integrada via WebGL debug info
    let isIntegratedGPU = false
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2')
      if (gl) {
        const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info')
        if (dbgInfo) {
          const renderer = (gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) || '').toLowerCase()
          // GPUs integradas conocidas que suelen tener bajo rendimiento en WebGL
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
          // Log para debug
          if (import.meta.env?.DEV) {
            console.log('[Perf] GPU detected:', renderer, '| Integrated:', isIntegratedGPU)
          }
        }
      }
    } catch {}
    
    return Boolean(isMobileUA || coarse || saveData || lowMemory || lowThreads || highDPR || isIntegratedGPU)
  }, [])
  // Estado para sliders de postprocesado (UI fuera del Canvas)
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
    // Warp l?quido
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
  const [topLight, setTopLight] = useState({ height: 3.35, intensity: 8, angle: 1.2, penumbra: 0.6 })
  const [showFxPanel, setShowFxPanel] = useState(false)
  const [showLightPanel, setShowLightPanel] = useState(false)
  const [showPortraitPanel, setShowPortraitPanel] = useState(false)
  const [portraitGlowV, setPortraitGlowV] = useState(0)
  const [copiedFx, setCopiedFx] = useState(false)
  const [navTarget, setNavTarget] = useState(null)
  const [orbActiveUi, setOrbActiveUi] = useState(false)
  const [playerMoving, setPlayerMoving] = useState(false)
  // Meshes del personaje para outline postprocessing
  const [playerMeshes, setPlayerMeshes] = useState([])
  const glRef = useRef(null)
  const [degradedMode, setDegradedMode] = useState(false)
  // ?Warm-up? de post FX: durante el arranque mantenemos un perfil lowPerf,
  // y lo escalamos a full cuando el preloader desaparece (evita Context Lost sin perder FX).
  const [fxWarm, setFxWarm] = useState(false)
  const [showMusic, setShowMusic] = useState(false)
  // Camera mode: 'third-person' (default OrbitControls) or 'top-down' (fixed overhead view)
  const initialCameraMode = useMemo(() => {
    try { return localStorage.getItem('cameraMode') || 'third-person' } catch { return 'third-person' }
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
  const { shown: tutorialShown, markAsShown: markTutorialShown } = useTutorialShown()
  const [showGpu, setShowGpu] = useState(false)
  const [tracks, setTracks] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const mobileMenuIds = ['section1', 'section2', 'section3', 'section4'] // Work, About, Store, Contact
  // Animaci?n de men? overlay (mobile): mantener montado mientras sale
  const MENU_ANIM_MS = 260
  // Animaci?n de items: uno detr?s de otro (bien visible)
  const MENU_ITEM_IN_MS = 260
  const MENU_ITEM_OUT_MS = 200
  const MENU_ITEM_STEP_MS = 100 // delay entre inicios de cada bot?n
  const [menuVisible, setMenuVisible] = useState(false)
  const menuAnimTimerRef = useRef(null)
  const openMenuAnimated = React.useCallback(() => {
    try { if (menuAnimTimerRef.current) { clearTimeout(menuAnimTimerRef.current); menuAnimTimerRef.current = null } } catch {}
    setMenuOpen(true)
    // Activar inmediatamente: usamos keyframes con fill-mode para que el delay aplique el estado inicial
    setMenuVisible(true)
  }, [])
  const closeMenuAnimated = React.useCallback(() => {
    // Si ya est? cerrado o no montado, no hacer nada
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

  // Socials fan: cerrar al click fuera o Escape
  const socialsWrapMobileRef = useRef(null)
  const socialsWrapDesktopRef = useRef(null)
  // Settings fan (mobile/compact y desktop): cerrar al click fuera o Escape
  const settingsWrapMobileRef = useRef(null)
  const settingsWrapDesktopRef = useRef(null)
  // Columna de controles (mobile/compact) a la derecha: para calcular safe-area del power bar
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
  const showDebugUi = false // DEV HUD desactivado
  // Noise-mask transition (prev -> next)
  const [prevSceneTex, setPrevSceneTex] = useState(null)
  const [noiseMixEnabled, setNoiseMixEnabled] = useState(false)
  const [noiseMixProgress, setNoiseMixProgress] = useState(0)
  const rippleMixRef = useRef({ v: 0 })
  

  async function captureCanvasFrameAsTexture() {
    try {
      const gl = glRef.current
      if (!gl || !gl.domElement) return null
      // Esperar 2 frames para asegurar que el canvas tenga el ?ltimo frame dibujado
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const src = gl.domElement
      // Snapshot sincr?nico: copiar a un canvas 2D offscreen y crear CanvasTexture
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
  // Captura del framebuffer WebGL a textura v?a GPU (evita CORS/taint del canvas 2D)
  async function captureCanvasFrameAsTextureGPU() {
    try {
      const renderer = glRef.current
      if (!renderer) return null
      // Asegurar que el frame actual est? listo
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
      // Copiar el framebuffer actual a la textura (nivel 0)
      renderer.copyFramebufferToTexture(new THREE.Vector2(0, 0), tex, 0)
      return tex
    } catch {
      return null
    }
  }
  // Captura del viewport completo (GL + DOM) a dataURL, evitando clonado de CANVAS por html2canvas.
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
        // usar tama?o f?sico del canvas principal para mantener nitidez
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        w = gl.domElement.width
        h = gl.domElement.height
        base.width = w
        base.height = h
        try { ctx.drawImage(gl.domElement, 0, 0, w, h) } catch {}
        scale = 1 // ya estamos en espacio de pixeles del canvas
      } else {
        base.width = Math.round(w * scale)
        base.height = Math.round(h * scale)
      }
      // Capturar DOM sin canvases ni el propio overlay ripple
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
  // Captura r?pida del canvas WebGL principal a dataURL (sin html2canvas)
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
  // Captura del framebuffer WebGL a DataTexture v?a CPU (readPixels) para usar en otro Canvas
  async function captureCanvasFrameAsDataTextureCPU() {
    try {
      const renderer = glRef.current
      if (!renderer) return null
      // asegurar frame listo
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
  // Dissolve overlay
  const [dissolveImg, setDissolveImg] = useState(null)
  const [dissolveProgress, setDissolveProgress] = useState(0)
  const dissolveProgRef = useRef({ v: 0 })
  const [dissolveCenter, setDissolveCenter] = useState([0.5, 0.5])

  // (Deprecated) DOM-level ripple overlay ? sustituido por alpha-mask en postFX
  const [domRippleActive, setDomRippleActive] = useState(false)
  const [domPrevSrc, setDomPrevSrc] = useState(null)
  const [domNextSrc, setDomNextSrc] = useState(null)
  const domRippleProgRef = useRef({ v: 0 })
  const [domRippleProgress, setDomRippleProgress] = useState(0)
  // Nueva transici?n overlay con m?scara de ruido (A/B por dataURL)
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
  // Tiempos homog?neos de ret?cula (ajuste fino global)
  const GRID_IN_MS = 280
  const GRID_OUT_MS = 520
  const GRID_DELAY_MS = 460

  // Importante: callback estable. Si se pasa inline y App re-renderiza frecuentemente,
  // GridRevealOverlay reinicia su timer y puede quedarse "pegado" (pantalla gris eterna).
  const onGridPhaseEnd = React.useCallback((phase) => {
    try { if (phase === 'out') setGridOverlayActive(false) } catch {}
  }, [])

  // Failsafe: nunca permitir que la ret?cula (gris/negra) quede pegada.
  // Si por cualquier raz?n no llega onPhaseEnd('out'), la desmontamos por tiempo m?ximo.
  useEffect(() => {
    if (!gridOverlayActive) return undefined
    if (gridPhase !== 'out') return undefined
    const maxMs = GRID_OUT_MS + GRID_DELAY_MS + 180
    const id = window.setTimeout(() => { try { setGridOverlayActive(false) } catch {} }, maxMs)
    return () => { try { window.clearTimeout(id) } catch {} }
    // Nota: gridKey reinicia una transici?n; lo incluimos para re-armar este failsafe por transici?n.
  }, [gridOverlayActive, gridPhase, gridKey])

  async function captureForDissolve() {
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: Math.max(1, Math.min(1.5, window.devicePixelRatio || 1)),
        backgroundColor: null,
      })
      setDissolveImg(canvas.toDataURL('image/png'))
      setDissolveProgress(0)
      dissolveProgRef.current.v = 0
    } catch {
      // En error, no bloquees transici?n
      setDissolveImg(null)
    }
  }

  // (beginRippleTransition moved below after section/transitionState definitions)

  // Psychedelic transition orchestrator
  const psychoTlRef = useRef(null)
  const prevFxRef = useRef(null)
  const startPsycho = React.useCallback((isLow = false) => {
    try { if (psychoTlRef.current) { psychoTlRef.current.kill(); psychoTlRef.current = null } } catch {}
    prevFxRef.current = fx
    // Capturar frame actual para overlay de disoluci?n (no bloquear timeline)
    captureForDissolve()
    const p = { t: 0, a: fx.dotAngle || 0 }
    setFx((v) => ({
      ...v,
      psychoEnabled: true,
      glitchActive: !isLow,
      glitchStrengthMin: 0.35,
      glitchStrengthMax: 1.1,
      dotEnabled: true,
      noise: Math.max(0.035, v.noise),
      bloom: v.bloom + (isLow ? 0.1 : 0.22),
      // Fondo oscuro: baja la vi?eta para que el efecto se note m?s
      vignette: Math.max(0.18, v.vignette - 0.18),
      // Arranque de color ?cido
      saturation: 0.6,
      contrast: 0.22,
      brightness: 0.08,
      hue: 0.0,
      // Warp base
      liquidStrength: isLow ? 0.55 : 1.0,
      liquidScale: isLow ? 2.6 : 3.8,
      liquidSpeed: isLow ? 0.9 : 1.35,
      edgeBoost: isLow ? 0.10 : 0.18,
      maskCenterX: 0.5,
      maskCenterY: 0.5,
      maskRadius: 0.6,
      maskFeather: 0.35,
    }))
    const tl = gsap.timeline({ defaults: { ease: 'sine.inOut' } })
    // Timeline de disoluci?n (overlay DOM): 0 ? 1
    tl.to(dissolveProgRef.current, {
      duration: isLow ? 0.65 : 0.9,
      v: 1,
      onUpdate: () => setDissolveProgress(dissolveProgRef.current.v),
    }, 0)
    tl.to(p, {
      duration: isLow ? 0.5 : 0.9,
      t: 1,
      onUpdate: () => {
        const k = p.t
        const chroma = isLow ? 0.018 + 0.014 * Math.sin(k * Math.PI * 4.0) : 0.034 + 0.024 * Math.sin(k * Math.PI * 6.0)
        const dotS = 0.9 + 1.5 * Math.sin(k * Math.PI * (isLow ? 2.0 : 3.0))
        const ang = p.a + k * (isLow ? Math.PI * 1.2 : Math.PI * 2.2)
        const hue = (isLow ? 0.3 : 0.6) * Math.sin(k * Math.PI * (isLow ? 1.2 : 1.6))
        const sat = (isLow ? 0.6 : 0.9)
        const br = (isLow ? 0.08 : 0.14)
        const ct = (isLow ? 0.25 : 0.4)
        setFx((v) => ({
          ...v,
          chromaOffsetX: chroma,
          chromaOffsetY: chroma * 0.7,
          dotScale: Math.max(0.4, dotS),
          dotAngle: ang,
          hue,
          saturation: sat,
          brightness: br,
          contrast: ct,
          // Anima ligeramente la fuerza del warp
          liquidStrength: (isLow ? 0.55 : 1.05) * (0.85 + 0.25 * Math.sin(k * 6.28318)),
        }))
      },
    })
    psychoTlRef.current = tl
  }, [fx, setFx])
  const stopPsycho = React.useCallback(() => {
    try { if (psychoTlRef.current) { psychoTlRef.current.kill(); psychoTlRef.current = null } } catch {}
    const base = prevFxRef.current
    if (base) {
      setFx((v) => ({
        ...v,
        psychoEnabled: false,
        glitchActive: false,
        chromaOffsetX: 0,
        chromaOffsetY: 0,
        dotAngle: base.dotAngle ?? v.dotAngle,
        dotScale: base.dotScale ?? v.dotScale,
        bloom: base.bloom,
        vignette: base.vignette,
        noise: base.noise,
        liquidStrength: 0.0,
        edgeBoost: 0.0,
        saturation: base.saturation ?? v.saturation,
        contrast: base.contrast ?? v.contrast,
        brightness: base.brightness ?? v.brightness,
        hue: base.hue ?? v.hue,
      }))
    } else {
      setFx((v) => ({
        ...v,
        psychoEnabled: false,
        glitchActive: false,
        chromaOffsetX: 0,
        chromaOffsetY: 0,
        liquidStrength: 0.0,
        edgeBoost: 0.0,
      }))
    }
    // Limpiar overlay de disoluci?n
    setTimeout(() => {
      setDissolveImg(null)
      setDissolveProgress(0)
      dissolveProgRef.current.v = 0
    }, 40)
  }, [setFx])
  const [isMobile, setIsMobile] = useState(false)
  // Breakpoint de UI compacta (mismo punto donde aparece el hamburguesa)
  const [isHamburgerViewport, setIsHamburgerViewport] = useState(false)
  // iPad: mostrar joystick aunque el viewport sea >1100 (ej. landscape 1024px)
  const [isIpadDevice, setIsIpadDevice] = useState(false)
  // Tesla (browser del coche): tratarlo como iPad-like para joystick/power UI
  const [isTeslaBrowser, setIsTeslaBrowser] = useState(false)
  // UI mobile/compacta: incluye retrato peque?o + joystick + barra de poder horizontal
  const isMobileUi = Boolean(forceCompactUi || isHamburgerViewport || isIpadDevice || isTeslaBrowser)
  // Alias usado en el resto del layout
  const isCompactUi = isMobileUi
  useEffect(() => {
    try { localStorage.setItem('forceCompactUi', forceCompactUi ? '1' : '0') } catch {}
  }, [forceCompactUi])
  // Safe insets din?micos para la barra de poder horizontal (evita tocar retrato y botones)
  const [powerSafeInsets, setPowerSafeInsets] = useState({ left: 16, right: 16 })
  // UI de secciones scrolleables
  const [showSectionUi, setShowSectionUi] = useState(false)
  const [sectionUiAnimatingOut, setSectionUiAnimatingOut] = useState(false)
  const [sectionUiFadeIn, setSectionUiFadeIn] = useState(false)
  const sectionScrollRef = useRef(null)
  // Lock de arranque en WORK para evitar cualquier movimiento visible hasta centrar
  const workInitLockRef = useRef(false)
  // Habilita el snapping SOLO despu?s de una interacci?n del usuario
  const snapEnabledRef = useRef(false)
  // Bloqueo de scroll del contenedor (overflow hidden) durante el centrado inicial
  const [lockScroll, setLockScroll] = useState(false)
  // Congelar rewrap interno de Section1 hasta interacci?n del usuario
  const [freezeWorkWrap, setFreezeWorkWrap] = useState(false)
  // Pin de tarjeta: mientras est? activo, forzamos la tarjeta i=0 (Heritage) en el centro
  const pinIndexRef = useRef(null) // 0 = Heritage fijado; null = libre
  const pinningRef = useRef(false) // reentrancia para evitar bucles en onScroll
  // Hint temporal para reactivar CTA/marquee al volver a HOME
  const [uiHintPortalId, setUiHintPortalId] = useState(null)
  const uiHintTimerRef = useRef(null)
  // Track which section is currently active (home by default)
  const [section, setSection] = useState('home')
  // Track transition state; when active we animate the shader and then switch sections
  const [transitionState, setTransitionState] = useState({ active: false, from: 'home', to: null })
  // Mantener el clearAlpha en 0 cuando usamos m?scara alpha (prevSceneTex == null && noiseMixEnabled)
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
  // Transici?n ?alpha-mask ripple? en compositor (sin snapshots)
  const alphaMaskRef = useRef({ v: 0 })
  const beginAlphaTransition = React.useCallback((toId) => {
    if (!toId) return
    if (noiseMixEnabled) return
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    // Activar pass de ripple (sin prevTex => alpha-mask en PostFX)
    setPrevSceneTex(null)
    setNoiseMixProgress(0)
    alphaMaskRef.current = { v: 0 }
    setNoiseMixEnabled(true)
    // Montar UI de secci?n debajo del canvas, sin fade propio (la m?scara controla el reveal)
    if (toId !== section) {
      setSection(toId)
      try { syncUrl(toId) } catch {}
    }
    if (toId !== 'home') {
      setShowSectionUi(true)
      setSectionUiAnimatingOut(false)
      setSectionUiFadeIn(false)
    } else {
      setSectionUiFadeIn(false)
      setSectionUiAnimatingOut(true)
      setTimeout(() => { setSectionUiAnimatingOut(false) }, 300)
    }
    // Animar 2.5s para un efecto perceptible
    gsap.to(alphaMaskRef.current, {
      v: 1,
      duration: 2.5,
      ease: 'sine.inOut',
      onUpdate: () => setNoiseMixProgress(alphaMaskRef.current.v),
      onComplete: () => {
        setNoiseMixEnabled(false)
        setNoiseMixProgress(0)
        setPrevSceneTex(null)
        alphaMaskRef.current = { v: 0 }
      },
    })
  }, [noiseMixEnabled, section])
  // Transici?n overlay con m?scara de ruido (A/B) usando capturas del canvas GL
  const beginNoiseOverlayTransition = React.useCallback(async (toId) => {
    if (!toId) return
    if (noiseOverlayActive || transitionState.active) return
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    const prevTex = await captureCanvasFrameAsDataTextureCPU()
    if (!prevTex) { beginRippleTransition(toId); return }
    setNoisePrevTex(prevTex)
    setNoiseNextTex(prevTex)
    setNoiseProgress(0); noiseProgRef.current = { v: 0 }
    setNoiseOverlayActive(true)
    if (toId !== section) {
      setSection(toId)
      try { syncUrl(toId) } catch {}
    }
    // Diferimos el centrado hasta justo antes de revelar la UI para evitar ?brinco?
    setShowSectionUi(false)
    setSectionUiAnimatingOut(false)
    setSectionUiFadeIn(false)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const nextTex = await captureCanvasFrameAsDataTextureCPU()
    if (!nextTex) { setNoiseOverlayActive(false); setNoisePrevTex(null); setNoiseNextTex(null); setNoiseProgress(0); beginRippleTransition(toId); return }
    setNoiseNextTex(nextTex)
    gsap.to(noiseProgRef.current, {
      v: 1,
      duration: 0.9,
      ease: 'sine.inOut',
      onUpdate: () => setNoiseProgress(noiseProgRef.current.v),
      onComplete: () => {
        setNoiseOverlayActive(false)
        setNoisePrevTex(null)
        setNoiseNextTex(null)
        setNoiseProgress(0)
        if (toId !== 'home') {
          // Montar UI oculta, esperar layout y centrar antes del fade-in
          workInitLockRef.current = (toId === 'section1')
          setShowSectionUi(true)
          setSectionUiFadeIn(false)
          if (toId === 'section1') { try { snapEnabledRef.current = false; setLockScroll(true); setFreezeWorkWrap(true) } catch {} }
          // Cancelar cualquier snap pendiente y bloquear snaps durante el centrado inicial
          try { if (snapTimerRef?.current) { clearTimeout(snapTimerRef.current) } } catch {}
          if (toId === 'section1') { try { snapInProgressRef.current = true; setFreezeWorkWrap(true) } catch {} }
          // 2 RAFs para asegurar layout estable antes de centrar
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try { scrollToFirstWorkCardImmediate() } catch {}
              // Un RAF m?s y hacer fade-in
              requestAnimationFrame(() => {
                setSectionUiFadeIn(true)
                // Liberar lock y mantener snapping desactivado hasta interacci?n
                if (toId === 'section1') setTimeout(() => {
                  try { workInitLockRef.current = false } catch {}
                  try { snapInProgressRef.current = false } catch {}
                  try { setLockScroll(false) } catch {}
                  // snapEnabledRef.current se activar? con wheel/touch/tecla o botones
                }, 600)
              })
            })
          })
        } else {
          setShowSectionUi(false)
          setSectionUiAnimatingOut(false)
        }
        setTransitionState({ active: false, from: toId, to: null })
      },
    })
    setTransitionState({ active: true, from: section, to: toId })
  }, [noiseOverlayActive, transitionState.active, section])
  // Transici?n simple: fade in/out (modo negro o noise)
  const beginSimpleFadeTransition = React.useCallback(async (toId, { mode = 'noise', durationMs = 600 } = {}) => {
    if (!toId || transitionState.active) return
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    // Desactivar cualesquiera overlays/mezclas previas
    try { setNoiseMixEnabled(false) } catch {}
    try { setNoiseOverlayActive(false); setNoisePrevTex(null); setNoiseNextTex(null) } catch {}
    try { setDomRippleActive(false) } catch {}
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
        // Cambiar a B
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
        // Preparar UI de destino; el centrado de WORK se hace expl?citamente para evitar brinco
        if (toId !== 'home') {
          workInitLockRef.current = (toId === 'section1')
          setShowSectionUi(true)
          setSectionUiFadeIn(false)
          setSectionUiAnimatingOut(false)
          // Cancelar snap pendiente y bloquear snaps durante el centrado inicial si vamos a WORK
          try { if (typeof snapTimerRef !== 'undefined' && snapTimerRef?.current) clearTimeout(snapTimerRef.current) } catch {}
          if (toId === 'section1') { try { snapInProgressRef.current = true; snapEnabledRef.current = false; setLockScroll(true); setFreezeWorkWrap(true) } catch {} }
          // Esperar layout estable y centrar antes del fade-in
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try { scrollToFirstWorkCardImmediate() } catch {}
              requestAnimationFrame(() => {
                setSectionUiFadeIn(true)
                if (toId === 'section1') setTimeout(() => {
                  try { workInitLockRef.current = false } catch {}
                  try { snapInProgressRef.current = false } catch {}
                  try { setLockScroll(false) } catch {}
                  // snapEnabledRef.current se activar? con wheel/touch/tecla o botones
                }, 600)
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
          workInitLockRef.current = (toId === 'section1')
          setShowSectionUi(true)
          setSectionUiFadeIn(false)
          // Cancelar snap pendiente y bloquear snaps durante el centrado inicial si vamos a WORK
          try { if (snapTimerRef?.current) clearTimeout(snapTimerRef.current) } catch {}
          if (toId === 'section1') { try { snapInProgressRef.current = true; snapEnabledRef.current = false; setLockScroll(true) } catch {} }
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try { scrollToFirstWorkCardImmediate() } catch {}
              requestAnimationFrame(() => {
                setSectionUiFadeIn(true)
                if (toId === 'section1') setTimeout(() => {
                  try { workInitLockRef.current = false } catch {}
                  try { snapInProgressRef.current = false } catch {}
                  try { setLockScroll(false) } catch {}
                  // snapEnabledRef.current se activar? con wheel/touch/tecla o botones
                }, 600)
              })
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
  // Grid reveal: cubrir con cuadr?cula (fase IN), cambiar a B, descubrir con cuadr?cula (fase OUT)
  const beginGridRevealTransition = React.useCallback(async (toId, { center, cellSize = 64, inDurationMs = GRID_IN_MS, outDurationMs = GRID_OUT_MS, delaySpanMs = GRID_DELAY_MS } = {}) => {
    if (!toId || transitionState.active) return
    // Marcar transici?n activa INMEDIATAMENTE para ocultar HomeOrbs y evitar flash
    setTransitionState({ active: true, from: section, to: toId })
    // Animaci?n de salida de UI cuando salimos de HOME
    if (section === 'home') {
      setUiAnimPhase('exiting')
      // Despu?s de la animaci?n de salida (300ms), ocultar
      if (uiExitTimerRef.current) clearTimeout(uiExitTimerRef.current)
      uiExitTimerRef.current = setTimeout(() => setUiAnimPhase('hidden'), 300)
      setHomeLanded(false)
    }
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    const cx = Math.min(1, Math.max(0, center?.[0] ?? 0.5))
    const cy = Math.min(1, Math.max(0, center?.[1] ?? 0.5))
    // Fase IN: cubrir (de 0->1)
    setGridCenter([cx, 1 - cy]) // adaptar a coords CSS (top-left origin)
    setGridPhase('in'); setGridOverlayActive(true); setGridKey((k) => k + 1)
    const fromHome = section === 'home'
    const goingWork = toId === 'section1'
    // Resetea scroll inmediatamente al iniciar la transici?n solo si no vamos a WORK
    if (!goingWork) {
      try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
    } else {
      // Si vamos a WORK: bloquear snapping y el scroll del contenedor durante el centrado
      try { if (snapTimerRef?.current) clearTimeout(snapTimerRef.current) } catch {}
      try { snapInProgressRef.current = true; snapEnabledRef.current = false; setLockScroll(true); setFreezeWorkWrap(true) } catch {}
    }
    const totalIn = inDurationMs + delaySpanMs + 40
    window.setTimeout(() => {
      // Cambiar a B
      try {
        if (toId !== section) {
          setSection(toId); try { syncUrl(toId) } catch {}
        }
        if (toId !== 'home') {
          const startOut = () => {
            // Espera extra al entrar desde HOME para asegurar que la secci?n est? 100% renderizada
            // antes de revelar (evita ver HOME durante el reveal)
            // 400ms da suficiente tiempo para que React monte y Three.js renderice la nueva escena
            const holdMs = fromHome ? 400 : 100
            window.setTimeout(() => {
              setGridPhase('out') // NO incrementar gridKey aqu? - causa flash
              const totalOut = outDurationMs + delaySpanMs + 40
              window.setTimeout(() => {
                setGridOverlayActive(false)
                setTransitionState({ active: false, from: toId, to: null })
              }, totalOut)
            }, holdMs)
          }

          if (goingWork) {
            // Bloquear wrap y snap mientras centramos antes de mostrar para evitar ?brinco?
            workInitLockRef.current = true
            setShowSectionUi(true)
            setSectionUiFadeIn(false)
            // Cancelar cualquier snap pendiente (por si algo se program? durante el cambio)
            try { if (snapTimerRef?.current) clearTimeout(snapTimerRef.current) } catch {}
            try { snapInProgressRef.current = true; snapEnabledRef.current = false; setLockScroll(true); setFreezeWorkWrap(true) } catch {}
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                try { scrollToFirstWorkCardImmediate() } catch {}
                requestAnimationFrame(() => {
                  try { scrollToFirstWorkCardImmediate() } catch {}
                  setSectionUiFadeIn(true)
                  // Una vez que WORK est? listo para ser visto, arrancar OUT
                  requestAnimationFrame(() => startOut())
                  setTimeout(() => {
                    try { workInitLockRef.current = false } catch {}
                    try { snapInProgressRef.current = false } catch {}
                    try { setLockScroll(false) } catch {}
                    // snapEnabledRef.current se activar? con wheel/touch/tecla o botones
                  }, 600)
                })
              })
            })
          } else {
            try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
            setShowSectionUi(true)
            setSectionUiFadeIn(true)
            setSectionUiAnimatingOut(false)
            // Esperar a que React pinte el destino antes de revelar (4 RAF para dar m?s tiempo)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => startOut())
                })
              })
            })
          }
        } else {
          setShowSectionUi(false)
          setSectionUiAnimatingOut(false)
          setSectionUiFadeIn(false)
          // Si vamos a HOME, esperamos 2 RAF antes de OUT para evitar ?flash? del canvas
          requestAnimationFrame(() => requestAnimationFrame(() => {
            setGridPhase('out') // NO incrementar gridKey aqu? - causa flash
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
  // Iniciar transici?n ripple: capturar prev, animar mix y cambiar secci?n a mitad
  const beginRippleTransition = React.useCallback(async (toId) => {
    if (!toId || transitionState.active) return
    // Garantizar que no haya blackout sobre la transici?n
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    // Capturar A (frame actual del canvas) v?a GPU (fallback a 2D si aplica)
    let tex = await captureCanvasFrameAsTextureGPU()
    if (!tex) {
      tex = await captureCanvasFrameAsTexture()
    }
    if (tex) setPrevSceneTex(tex)
    // Activar inmediatamente la nueva secci?n (B) bajo la m?scara
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
      // Mostrar u ocultar UI de secci?n seg?n destino
      if (toId !== 'home') {
        setShowSectionUi(true)
        setSectionUiAnimatingOut(false)
        setSectionUiFadeIn(false)
      } else {
        setSectionUiFadeIn(false)
        setSectionUiAnimatingOut(true)
        setTimeout(() => { setSectionUiAnimatingOut(false) }, 300)
      }
    } catch {}
    // Forzar modo m?scara (sin snapshot A) para revelar B bajo el canvas por alpha
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
        // cerrar estado de transici?n si estuviera abierto
        setTransitionState({ active: false, from: toId, to: null })
      },
    })
    // Abrir estado de transici?n para bloquear UI si fuese necesario
    setTransitionState({ active: true, from: section, to: toId })
  }, [section, transitionState.active])
  // (Desactivado) La transici?n ripple se gestiona exclusivamente por beginRippleTransition
  // useEffect(() => { ... }, [transitionState.active])

  // ---------------------------------------------------------------------------
  // SISTEMA UNIFICADO DE TRANSICIONES (reemplaza los overlays fragmentados)
  // ---------------------------------------------------------------------------
  const sceneTransition = useSceneTransition({
    glRef,
    onSectionChange: (toId) => {
      try {
        if (toId !== section) {
          setSection(toId)
          // Inline syncUrl para evitar dependencia circular
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
      // Pantalla completamente cubierta - configurar UI de secci?n
      try {
        if (toId !== 'home') {
          setShowSectionUi(true)
          setSectionUiAnimatingOut(false)
          // Si vamos a WORK, preparar centrado
          if (toId === 'section1') {
            workInitLockRef.current = true
            setSectionUiFadeIn(false)
            try { if (snapTimerRef?.current) clearTimeout(snapTimerRef.current) } catch {}
            try { snapInProgressRef.current = true; snapEnabledRef.current = false; setLockScroll(true); setFreezeWorkWrap(true) } catch {}
          } else {
            try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
            setSectionUiFadeIn(true)
          }
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
        // Si fuimos a WORK, finalizar centrado
        if (toId === 'section1') {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try { scrollToFirstWorkCardImmediate?.() } catch {}
              requestAnimationFrame(() => {
                try { scrollToFirstWorkCardImmediate?.() } catch {}
                setSectionUiFadeIn(true)
                setTimeout(() => {
                  try { workInitLockRef.current = false } catch {}
                  try { snapInProgressRef.current = false } catch {}
                  try { setLockScroll(false) } catch {}
                }, 400)
              })
            })
          })
        }
      } catch {}
    },
  })

  /**
   * Nueva funci?n de transici?n unificada - reemplaza beginGridRevealTransition
   * @param {string} toId - Secci?n destino
   * @param {Object} options - Opciones del efecto
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
      color: [0, 0, 0], // Negro para la fase de cobertura
    })
  }, [transitionState.active, sceneTransition])

  // ---------------------------------------------------------------------------
  // SISTEMA SIMPLE DE TRANSICIONES (CSS puro, sin lag)
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
          if (toId === 'section1') {
            workInitLockRef.current = true
            setSectionUiFadeIn(false)
            try { if (snapTimerRef?.current) clearTimeout(snapTimerRef.current) } catch {}
            try { snapInProgressRef.current = true; snapEnabledRef.current = false; setLockScroll(true); setFreezeWorkWrap(true) } catch {}
          } else {
            try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
            setSectionUiFadeIn(true)
          }
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
        if (toId === 'section1') {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try { scrollToFirstWorkCardImmediate?.() } catch {}
              requestAnimationFrame(() => {
                try { scrollToFirstWorkCardImmediate?.() } catch {}
                setSectionUiFadeIn(true)
                setTimeout(() => {
                  try { workInitLockRef.current = false } catch {}
                  try { snapInProgressRef.current = false } catch {}
                  try { setLockScroll(false) } catch {}
                }, 400)
              })
            })
          })
        }
      } catch {}
    },
  })

  /**
   * Transici?n simple con grid CSS (sin lag)
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

  // Homologaci?n: misma salida a HOME para
  // - bot?n "SALIR DE SECCI?N" (cuando section !== 'home')
  // - bot?n "ENTER" del preloader (force exit)
  const exitToHomeLikeExitButton = React.useCallback((source = 'section') => {
    if (transitionState.active) return
    // OJO: este hook se declara antes que bootLoading en el archivo; NO referenciar bootLoading aqu?
    // para evitar TDZ ("Cannot access 'bootLoading' before initialization").
    const shouldExit = (section !== 'home') || (source === 'preloader')
    if (!shouldExit) return

    // Animaci?n de salida de UI cuando salimos de una secci?n a HOME
    if (source === 'section') {
      setUiAnimPhase('exiting')
      // Despu?s de la animaci?n de salida (300ms), ocultar
      if (uiExitTimerRef.current) clearTimeout(uiExitTimerRef.current)
      uiExitTimerRef.current = setTimeout(() => setUiAnimPhase('hidden'), 300)
    }

    // Preloader: NO usar ret?cula, solo ocultar el preloader para ver la animaci?n de ca?da
    if (source === 'preloader') {
      if (preloaderStartedRef.current) return
      preloaderStartedRef.current = true
      setBootProgress(100)
      try { setPreloaderFadingOut(true) } catch {}
      // Ocultar preloader inmediatamente para ver la animaci?n de ca?da en HOME
      try { setShowPreloaderOverlay(false) } catch {}
      // CR?TICO: bootLoading = false para que el Player sea visible y los callbacks funcionen
      try { setBootLoading(false) } catch {}
      // IMPORTANTE: Establecer navTarget a 'home' para iniciar la animaci?n de ca?da
      try { setNavTarget('home') } catch {}
      try { setSection('home') } catch {}
      try { syncUrl('home') } catch {}
      // Fallback: limpiar el estado de fading despu?s de 5s si onHomeSplash no se dispara
      preloaderHideTimerRef.current = window.setTimeout(() => {
        setPreloaderFadingOut(false)
        preloaderHideTimerRef.current = null
      }, 5000)
      // NO continuar con la ret?cula para el preloader
      return
    }

    // 1) Cubrir con ret?cula (solo para transiciones entre secciones, NO preloader)
    setGridCenter([0.5, 0.5])
    setGridPhase('in')
    setGridOverlayActive(true)
    setGridKey((k) => k + 1)

    // 2) Cuando est? cubierta: cleanup + ir a HOME + descubrir
    const totalIn = GRID_IN_MS + GRID_DELAY_MS + 40
    window.setTimeout(() => {
      // Registrar salida de secci?n (solo aplica a secciones reales)
      if (source !== 'preloader') {
        try { lastExitedSectionRef.current = section } catch {}
      }

      // Cleanup (id?ntico al bot?n salir, en lo que aplica)
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
      // Ocultar UI de HOME hasta que el personaje aterrice de nuevo
      if (source === 'section') {
        try { setHomeLanded(false) } catch {}
      }

      if (source === 'preloader') {
        // Ahora que la ret?cula cubri?, podemos ocultar el preloader overlay
        // (bootLoading ya se puso false antes para que la escena se monte)
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

      // Ir a HOME + revelar (id?ntico al bot?n salir)
      setNavTarget('home')
      setSection('home')
      try { syncUrl('home') } catch {}
      setGridPhase('out') // NO incrementar gridKey aqu? - causa flash
      const totalOut = GRID_OUT_MS + GRID_DELAY_MS + 40
      window.setTimeout(() => { setGridOverlayActive(false) }, totalOut)
    }, totalIn)
  }, [section, transitionState.active])

  const handleExitSection = React.useCallback(() => {
    exitToHomeLikeExitButton('section')
  }, [exitToHomeLikeExitButton])

  // Escuchar click del bot?n cerrar que emite el retrato
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

  // Ocultar/mostrar marquee cuando se abre/cierra un detalle de proyecto (Work)
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
  // CTA y Marquee con animaci?n de salida
  const [showCta, setShowCta] = useState(false)
  const [ctaAnimatingOut, setCtaAnimatingOut] = useState(false)
  const ctaHideTimerRef = useRef(null)
  // CTA preloader state
  const [ctaLoading, setCtaLoading] = useState(false)
  const [ctaProgress, setCtaProgress] = useState(0)
  const [ctaColor, setCtaColor] = useState('#ffffff')
  const ctaProgTimerRef = useRef(null)
  // Forzar ocultar CTA temporalmente al salir de secci?n para evitar flash
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

  // Failsafe: nunca permitir blackout "pegado".
  useEffect(() => {
    if (!blackoutVisible) return undefined
    const id = window.setTimeout(() => {
      try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    }, 1500)
    return () => { try { window.clearTimeout(id) } catch {} }
  }, [blackoutVisible])
  // Preloader global de arranque
  const [bootLoading, setBootLoading] = useState(true)
  // Warm-up de escena principal tras ?Enter?: evita hitch por montar TODO en un solo frame
  const [mainWarmStage, setMainWarmStage] = useState(0) // 0=min, 1=env/luces, 2=particles/orbs/post/shadows
  const [bootProgress, setBootProgress] = useState(0)
  const [bootAllDone, setBootAllDone] = useState(false)
  const [characterReady, setCharacterReady] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [preloaderFadingOut, setPreloaderFadingOut] = useState(false)
  const [showPreloaderOverlay, setShowPreloaderOverlay] = useState(true)
  // Estado para saber si el personaje ya aterriz? (para mostrar UI despu?s)
  const [homeLanded, setHomeLanded] = useState(false)
  // Sistema de animaci?n de UI: controla entrada/salida del men? y portrait
  // 'hidden' = no visible, 'entering' = animando entrada, 'visible' = visible sin animaci?n, 'exiting' = animando salida
  const [uiAnimPhase, setUiAnimPhase] = useState('hidden')
  const uiEnterTimerRef = useRef(null)  // Timer para entering ? visible
  const uiExitTimerRef = useRef(null)   // Timer para exiting ? hidden (NO limpiar en useEffect)
  
  // L?gica de animaci?n de UI
  useEffect(() => {
    const inHome = section === 'home'
    
    if (inHome) {
      // En HOME: UI entra cuando homeLanded es true
      if (homeLanded && uiAnimPhase !== 'visible' && uiAnimPhase !== 'entering' && uiAnimPhase !== 'exiting') {
        setUiAnimPhase('entering')
        // Despu?s de la animaci?n de entrada, marcar como visible
        if (uiEnterTimerRef.current) clearTimeout(uiEnterTimerRef.current)
        uiEnterTimerRef.current = setTimeout(() => setUiAnimPhase('visible'), 500)
      } else if (!homeLanded && uiAnimPhase !== 'hidden' && uiAnimPhase !== 'exiting') {
        // Personaje no ha aterrizado, UI oculta (pero no interrumpir exiting)
        setUiAnimPhase('hidden')
      }
    } else {
      // En secciones: UI entra animada cuando la grid termina
      if (!gridOverlayActive && uiAnimPhase === 'hidden') {
        setUiAnimPhase('entering')
        if (uiEnterTimerRef.current) clearTimeout(uiEnterTimerRef.current)
        uiEnterTimerRef.current = setTimeout(() => setUiAnimPhase('visible'), 500)
      }
    }
    
    // Solo limpiar timer de entrada en cleanup (el de salida debe terminar siempre)
    return () => {
      if (uiEnterTimerRef.current) {
        clearTimeout(uiEnterTimerRef.current)
      }
    }
  }, [section, homeLanded, gridOverlayActive, uiAnimPhase])

  // Mostrar tutorial autom?ticamente cuando el personaje aterriza por primera vez
  const tutorialTriggeredRef = useRef(false)
  useEffect(() => {
    if (homeLanded && !tutorialShown && !tutorialTriggeredRef.current) {
      tutorialTriggeredRef.current = true
      // Peque?o delay para que la UI termine de aparecer
      const timer = setTimeout(() => {
        setTutorialOpen(true)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [homeLanded, tutorialShown])
  
  const preloaderStartedRef = useRef(false)
  const preloaderHideTimerRef = useRef(null)
  // Timer que apaga bootLoading + desmonta overlay (evita flash full-screen del preloader)
  const preloaderBootSwapTimerRef = useRef(null)
  const preloaderGridOutPendingRef = useRef(false)
  const gridOutTimerRef = useRef(null)
  // Exponer controles globales (ya no hay c?mara de preloader 3D)
  useEffect(() => {
    try {
      // eslint-disable-next-line no-underscore-dangle
      window.pausePreloaderCamera = () => {}
      // eslint-disable-next-line no-underscore-dangle
      window.resumePreloaderCamera = () => {}
    } catch {}
  }, [])

  // Cerrar overlay del men? con Escape
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

  // Preload M?NIMO: solo el personaje principal para entrada r?pida
  // El resto de assets se carga en background despu?s de entrar
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Solo cargar el modelo del personaje (cr?tico para HOME)
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

  // Cargar assets secundarios en background DESPU?S de entrar (no bloquea entrada)
  useEffect(() => {
    if (showPreloaderOverlay) return // Solo despu?s de entrar
    const loadInBackground = async () => {
      try {
        // GLBs secundarios
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
        // Secciones (lazy)
        import('./components/Section1.jsx').catch(() => {})
        import('./components/Section2.jsx').catch(() => {})
        import('./components/Section3.jsx').catch(() => {})
        import('./components/Section4.jsx').catch(() => {})
        // SFX
        const fxList = ['hover','click','magiaInicia','sparkleBom','sparkleFall','stepone','stepSoft','steptwo']
        try { preloadSfx(fxList) } catch {}
      } catch {}
    }
    // Peque?o delay para no competir con la animaci?n de entrada
    const timer = setTimeout(loadInBackground, 500)
    return () => clearTimeout(timer)
  }, [showPreloaderOverlay])

  // Pre-montar la escena cuando el personaje est? cargado
  const [scenePreMounted, setScenePreMounted] = React.useState(false)
  useEffect(() => {
    if (!bootAllDone) return
    // Escena lista inmediatamente - sin delays innecesarios
    setBootLoading(false)
    setScenePreMounted(true)
  }, [bootAllDone])

  // Activar FX completos cuando el preloader ya no está en pantalla
  useEffect(() => {
    if (showPreloaderOverlay) { setFxWarm(false); return undefined }
    // Delay MUY extendido para dar tiempo a GPU a compilar TODOS los shaders
    // antes de habilitar los FX completos (evita lag visible al usuario)
    const id = window.setTimeout(() => { try { setFxWarm(true) } catch {} }, 800)
    return () => window.clearTimeout(id)
  }, [showPreloaderOverlay])

  // Stage warm-up para reducir stutter al "Enter" - delays optimizados para compilacion de shaders
  useEffect(() => {
    if (bootLoading) { setMainWarmStage(0); return undefined }
    // Stage 1: Environment y luces (inmediato) - permite que shaders empiecen a compilar
    setMainWarmStage(1)
    // Stage 2: partículas, orbes, post-processing - delay MUY extendido para dar tiempo a GPU
    // 600ms permite que la mayoría de shaders terminen de compilar antes de agregar más trabajo
    const t2 = window.setTimeout(() => { try { setMainWarmStage(2) } catch {} }, 600)
    return () => { try { window.clearTimeout(t2) } catch {} }
  }, [bootLoading])

  // Pre-compilación de shaders: forzar compile de la escena antes de que el usuario la vea
  const shaderCompileTriggeredRef = useRef(false)
  useEffect(() => {
    // Solo correr una vez cuando la escena está montada pero antes de activar fx
    if (!scenePreMounted || fxWarm || shaderCompileTriggeredRef.current) return
    shaderCompileTriggeredRef.current = true
    // Dar 1 frame para que los componentes se monten
    requestAnimationFrame(() => {
      try {
        const gl = glRef.current
        if (!gl || !gl.render) return
        // Forzar un render completo para compilar todos los shaders
        gl.setRenderTarget(null)
        // El render real ya se hace en el frameloop, esto solo asegura que
        // requestIdleCallback no bloquee la GPU mientras compila
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => {
            // Dar tiempo adicional a la GPU para terminar compilación
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
  const snapTimerRef = useRef(null)
  const snapInProgressRef = useRef(false)
  const controlledScrollRef = useRef(false)
  const workReadyRef = useRef(false)
  const [workReady, setWorkReady] = useState(false)
  const workMinScrollRef = useRef(0) // Scroll m?nimo para mantener primer elemento centrado
  const navHeightRef = useRef(0) // Ref para usar en callbacks antes de que navHeight state est? declarado
  const workSimpleMode = true

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

  // Detectar el breakpoint de hamburguesa (=1100px) para alinear UI (m?sica + idioma)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1100px)')
    const update = () => setIsHamburgerViewport(Boolean(mql.matches))
    update()
    try { mql.addEventListener('change', update) } catch { window.addEventListener('resize', update) }
    return () => { try { mql.removeEventListener('change', update) } catch { window.removeEventListener('resize', update) } }
  }, [])

  // Detectar iPad (incluye iPadOS que reporta MacIntel + touch)
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

  // Detectar navegador de Tesla (UA suele incluir "Tesla/..." o "QtCarBrowser")
  useEffect(() => {
    try {
      const ua = (navigator.userAgent || '')
      const isTeslaUa = /Tesla\/\S+/i.test(ua) || /QtCarBrowser/i.test(ua)
      setIsTeslaBrowser(Boolean(isTeslaUa))
    } catch {
      setIsTeslaBrowser(false)
    }
  }, [])

  // Mantener oculto por defecto en mobile; visible s?lo cuando el usuario lo abre
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

  // Barra de poder horizontal: mantenerla dentro del "hueco" entre retrato (izq) y controles (der)
  useEffect(() => {
    if (!isCompactUi) return () => {}
    const compute = () => {
      try {
        const vw = Math.max(0, window.innerWidth || 0)
        if (!vw) return
        let left = 16
        let right = 16
        const margin = 14
        // Fallbacks (si a?n no hay DOM estable): retrato ? 7.2rem + left-4, controles ? 48px + right-4
        const rem = (() => {
          try {
            const fs = parseFloat((window.getComputedStyle?.(document.documentElement)?.fontSize) || '')
            return (isFinite(fs) && fs > 0) ? fs : 16
          } catch { return 16 }
        })()
        const portraitFallbackRight = 16 + Math.round(rem * 7.2)
        const controlsFallbackLeft = vw - (16 + 48)
        // Retrato (izquierda)
        try {
          const portraitEl = document.querySelector('[data-portrait-root]')
          if (portraitEl && typeof portraitEl.getBoundingClientRect === 'function') {
            const r = portraitEl.getBoundingClientRect()
            if (isFinite(r.right)) left = Math.max(left, Math.round(r.right + margin))
          } else {
            left = Math.max(left, Math.round(portraitFallbackRight + margin))
          }
        } catch {}
        // Controles compactos (derecha)
        try {
          const controlsEl = compactControlsRef.current
          if (controlsEl && typeof controlsEl.getBoundingClientRect === 'function') {
            const r = controlsEl.getBoundingClientRect()
            if (isFinite(r.left)) right = Math.max(right, Math.round((vw - r.left) + margin))
          } else {
            right = Math.max(right, Math.round((vw - controlsFallbackLeft) + margin))
          }
        } catch {}
        // Clamp: no dejar que left+right coma todo el ancho
        const maxTotal = Math.max(0, vw - 60)
        if (left + right > maxTotal) {
          const overflow = (left + right) - maxTotal
          left = Math.max(16, Math.round(left - overflow / 2))
          right = Math.max(16, Math.round(right - overflow / 2))
        }
        setPowerSafeInsets((p) => ((p.left === left && p.right === right) ? p : { left, right }))
      } catch {}
    }
    // Esperar layout y re-medir varios frames para agarrar el retrato/controles ya estabilizados
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

  // Al entrar en WORK, forzar un centrado inmediato al anchor central evitando el wrap y el snap,
  // y mostrar la UI solo despu?s del centrado para evitar el ?brinco?.
  useEffect(() => {
    if (section === 'section1') {
      if (workSimpleMode) {
        try { setSectionUiFadeIn(true) } catch {}
        try { setLockScroll(false) } catch {}
        try { setWorkReady(true) } catch {}
        return
      }
      try { workInitLockRef.current = true } catch {}
      try { setSectionUiFadeIn(false) } catch {}
      try { snapEnabledRef.current = false; setLockScroll(true) } catch {}
      try { if (snapTimerRef?.current) clearTimeout(snapTimerRef.current) } catch {}
      try { snapInProgressRef.current = true } catch {}
      try { setWorkReady(false) } catch {}
      // Asegurar que el contenido de Section1 est? montado antes de centrar
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try { scrollToFirstWorkCardImmediate() } catch {}
          requestAnimationFrame(() => {
            try { scrollToFirstWorkCardImmediate() } catch {}
            try { setSectionUiFadeIn(true) } catch {}
            setTimeout(() => {
              try { workInitLockRef.current = false } catch {}
              try { snapInProgressRef.current = false } catch {}
              try { setLockScroll(false) } catch {}
            }, 600)
          })
        })
      })
    }
  }, [section])

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
      const offset = Math.round((navHeightRef.current || 0) / 2)
      const targetScroll = Math.max(0, Math.round(targetCenter - (scroller.clientHeight || 0) / 2 - offset))
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
      const offset = Math.round((navHeightRef.current || 0) / 2)
      const targetScroll = Math.max(0, Math.round(c - (scroller.clientHeight || 0) / 2 - offset))
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
      const offset = Math.round((navHeightRef.current || 0) / 2)
      const viewCenter = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2 - offset
      let best = { d: Infinity, c: null, idx: -1 }
      for (let i = 0; i < cards.length; i++) {
        const el = cards[i]
        const r = el.getBoundingClientRect()
        const c = (scroller.scrollTop || 0) + (r.top - sRect.top) + (r.height / 2)
        const d = Math.abs(c - viewCenter)
        if (d < best.d) best = { d, c, idx: i }
      }
      if (best.c == null) return
      // Snap preciso: umbral peque?o (8px) para mejor centrado
      const delta = best.c - viewCenter
      if (Math.abs(delta) < 8) return
      snapInProgressRef.current = true
      let targetScroll = Math.round(best.c - (scroller.clientHeight || 0) / 2 - offset)
      // Respetar el l?mite m?nimo (no ir arriba del primer elemento)
      if (workMinScrollRef.current > 0) {
        targetScroll = Math.max(workMinScrollRef.current, targetScroll)
      }
      targetScroll = Math.max(0, targetScroll)
      scroller.scrollTo({ top: targetScroll, behavior: 'smooth' })
      // Liberar flag tras breve tiempo
      setTimeout(() => { snapInProgressRef.current = false }, 340)
    } catch {}
  }, [section])

  // Snap explicitly to the first project (i === 0) when entering Work
  const snapToFirstWorkCard = React.useCallback(() => {
    try {
      if (section !== 'section1') return
      const scroller = sectionScrollRef.current
      if (!scroller) return
      const cards0 = Array.from(scroller.querySelectorAll('[data-work-card][data-work-card-i="0"]'))
      if (!cards0.length) return
      const sRect = scroller.getBoundingClientRect()
      const viewCenter = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2
      // Elegir la r?plica m?s cercana al centro actual para evitar saltos grandes
      let best = { el: null, d: Infinity, c: 0 }
      for (const el of cards0) {
        const r = el.getBoundingClientRect()
        const c = (scroller.scrollTop || 0) + (r.top - sRect.top) + (r.height / 2)
        const d = Math.abs(c - viewCenter)
        if (d < best.d) best = { el, d, c }
      }
      if (!best.el) return
      const offset = Math.round((navHeightRef.current || 0) / 2)
      const targetScroll = Math.max(0, Math.round(best.c - (scroller.clientHeight || 0) / 2 - offset))
      snapInProgressRef.current = true
      scroller.scrollTo({ top: targetScroll, behavior: 'smooth' })
      setTimeout(() => { snapInProgressRef.current = false }, 360)
    } catch {}
  }, [section])

  // Scroll instantly (no animation) to first project center (WORK) before reveal to avoid visible jump
  const scrollToFirstWorkCardImmediate = React.useCallback(() => {
    try {
      if (section !== 'section1') return
      const scroller = sectionScrollRef.current
      if (!scroller) return
      const cards0 = Array.from(scroller.querySelectorAll('[data-work-card][data-work-card-i="0"]'))
      if (!cards0.length) return
      // Posici?n inicial determinista: usar SIEMPRE el primer ancla i=0
      const sRect = scroller.getBoundingClientRect()
      const first = cards0[0]
      const rr = first.getBoundingClientRect()
      const center = (rr.top - sRect.top) + (rr.height / 2)
      const offset = Math.round((navHeightRef.current || 0) / 2)
      const targetScroll = Math.max(0, Math.round(center - (scroller.clientHeight || 0) / 2 - offset))
      // Suprimir ?wrap?/snap durante el posicionamiento inicial
      controlledScrollRef.current = true
      workReadyRef.current = false
      try { setWorkReady(false) } catch {}
      scroller.scrollTop = targetScroll
      // Correcci?n fina: medir y ajustar el delta para que el centro visual sea exacto
      let iter = 0
      const refine = () => {
        try {
          const sRect2 = scroller.getBoundingClientRect()
          const r2 = first.getBoundingClientRect()
          const viewCenter = (scroller.clientHeight || 0) / 2
          const desired = viewCenter - offset
          const current = (r2.top - sRect2.top) + (r2.height / 2)
          const delta = Math.round(current - desired)
          if (Math.abs(delta) > 1 && iter < 3) {
            scroller.scrollTop = Math.max(0, (scroller.scrollTop || 0) - delta)
            iter += 1
            requestAnimationFrame(refine)
            return
          }
        } catch {}
        // Guardar el scroll m?nimo para no permitir scroll arriba del primer elemento centrado
        workMinScrollRef.current = Math.max(0, scroller.scrollTop || 0)
        controlledScrollRef.current = false
        workReadyRef.current = true
        try { setWorkReady(true) } catch {}
      }
      requestAnimationFrame(refine)
    } catch {}
  }, [section])

  // Forzar centrado en m?ltiples ticks para cubrir variaciones de layout (fonts/images/resize)
  const forceCenterOnEntry = React.useCallback(() => {
    try {
      const delays = [0, 16, 32, 64, 120, 240, 420]
      delays.forEach((ms) => {
        window.setTimeout(() => {
          try { scrollToFirstWorkCardImmediate() } catch {}
        }, ms)
      })
    } catch {}
  }, [scrollToFirstWorkCardImmediate])

  // (moved below where navHeight is initialized)

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

  // Medir altura de la nav inferior para posicionar CTA a +40px de separaci?n
  const navRef = useRef(null)
  const [navHeight, setNavHeight] = useState(0)
  const [navBottomOffset, setNavBottomOffset] = useState(0)
  const musicBtnRef = useRef(null)
  const [musicPos, setMusicPos] = useState({ left: 0, bottom: 0 })
  const navInnerRef = useRef(null)
  const navBtnRefs = useRef({})
  const [navHover, setNavHover] = useState({ left: 0, width: 0, visible: false })
  const [pageHidden, setPageHidden] = useState(false)
  // Medir altura del marquee para empujar contenido de secciones y posicionar bot?n salir
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

  // Re-centrar una vez que la altura de la nav inferior est? medida (evita desalineo inicial)
  useEffect(() => {
    try {
      if (section !== 'section1') return
      if (!showSectionUi) return
      // navHeight puede ser 0 en el primer render; cuando cambia, recentrar con varios ticks
      requestAnimationFrame(() => { try { forceCenterOnEntry() } catch {} })
    } catch {}
  }, [navHeight, section, showSectionUi, forceCenterOnEntry])

  // Pausar animaciones en background
  useEffect(() => {
    const onVis = () => {
      try { setPageHidden(document.visibilityState === 'hidden') } catch { setPageHidden(false) }
    }
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Watchdog de memoria/VRAM: degradacion suave sin pausar audio
  // OPTIMIZADO: Umbrales muy altos para evitar activación innecesaria
  const degradeCountRef = useRef(0) // contador para histeresis
  useEffect(() => {
    const tick = () => {
      try {
        const info = glRef.current?.info?.memory
        const heap = (typeof performance !== 'undefined' && performance.memory) ? performance.memory.usedJSHeapSize : 0
        const heapMB = heap ? Math.round(heap / (1024 * 1024)) : 0
        const textures = info?.textures || 0
        const geometries = info?.geometries || 0
        // Umbrales MUY ALTOS - solo activar en casos extremos
        const HEAP_HIGH = 2000 // MB - umbral para degradar (subido mucho)
        const HEAP_LOW = 1500  // MB - umbral para recuperar
        const TEX_HIGH = 8000  // texturas para degradar
        const TEX_LOW = 6000   // texturas para recuperar
        const GEO_HIGH = 6000  // geometrias para degradar
        const GEO_LOW = 4000   // geometrias para recuperar
        
        // Log para debug
        if (import.meta.env?.DEV && (heapMB > 500 || textures > 100 || geometries > 100)) {
          console.log('[Perf] Memory status:', { heapMB, textures, geometries })
        }
        
        setDegradedMode((prev) => {
          if (prev) {
            // Ya estamos degradados - verificar si podemos recuperar
            const canRecover = (heapMB < HEAP_LOW) && (textures < TEX_LOW) && (geometries < GEO_LOW)
            if (canRecover) {
              degradeCountRef.current = Math.max(0, degradeCountRef.current - 1)
              // Requiere 3 ticks consecutivos buenos para recuperar (histeresis)
              if (degradeCountRef.current <= 0) {
                if (import.meta.env?.DEV) console.log('[Perf] Recovered from degraded mode')
                return false
              }
            } else {
              degradeCountRef.current = 3 // resetear contador
            }
            return true
          } else {
            // No estamos degradados - verificar si debemos degradar
            const shouldDegrade = (heapMB > HEAP_HIGH) || (textures > TEX_HIGH) || (geometries > GEO_HIGH)
            if (shouldDegrade) {
              degradeCountRef.current = 3
              if (import.meta.env?.DEV) {
                console.log('[Perf] Entering degraded mode:', { heapMB, textures, geometries })
              }
              return true
            }
            return false
          }
        })
      } catch {}
    }
    const id = window.setInterval(tick, 60000) // cada 60s - no revisar tan frecuentemente
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
      if (workSimpleMode) return
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

  // Posicionar panel de m?sica justo encima de su bot?n en la nav
  useEffect(() => {
    const measureMusicPos = () => {
      try {
        if (!musicBtnRef.current) return
        const r = musicBtnRef.current.getBoundingClientRect()
        const left = Math.round(r.left + r.width / 2)
        const gap = 12 // separaci?n sobre el bot?n
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

  // Medir highlight l?quido en nav
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
      // redondeo a enteros para evitar jitter subpixel y asegurar simetr?a
      left = Math.round(left)
      width = Math.round(width)
      setNavHover({ left, width, visible: true })
    } catch {}
  }

  // Routing sencillo por History API: mapear secci?n <-> URL sin romper UX actual
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

  // Inicializar secci?n desde la URL al cargar
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const initial = pathToSection(window.location.pathname)
    if (initial) setSection(initial)
  }, [])

  // Pre-cargar m?dulos de secciones para evitar descarga/parseo en primer uso de clic
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

  // Preload SFX b?sicos para Nav
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

  // Control de visibilidad y transici?n suave del contenedor de secciones
  // NOTA: Este efecto NO debe ejecutarse durante transiciones activas (simpleTransition o transitionState)
  useEffect(() => {
    // Ignorar durante cualquier transici?n activa
    if (transitionState.active) return
    if (simpleTransition.active) return
    
    if (section !== 'home') {
      setShowSectionUi(true)
      setSectionUiAnimatingOut(false)
      setSectionUiFadeIn(false)
      // Reset scroll al entrar
      requestAnimationFrame(() => {
        // Nunca resetear scroll cuando vamos a WORK para evitar saltos
        try {
          if (sectionScrollRef.current && section !== 'section1') {
            sectionScrollRef.current.scrollTop = 0
          }
        } catch {}
        // Section1 se centrar? sola (seed) en Heritage, sin animaci?n
        // disparar fade in tras montar (ligero retardo para asegurar layout)
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
  }, [section, transitionState.active, simpleTransition.active, showSectionUi])

  // Bloquear scroll del body cuando la UI de secci?n est? visible
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

  // Sincronizar URL al completar transici?n
  const syncUrl = (s) => {
    if (typeof window === 'undefined') return
    const next = sectionToPath(s)
    if (window.location.pathname !== next) {
      window.history.pushState({ section: s }, '', next)
    }
  }

  // Responder a navegaci?n del usuario (back/forward)
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
  const dofTargetRef = playerRef // enfocamos al jugador
  const prevPlayerPosRef = useRef(new THREE.Vector3(0, 0, 0))
  const lastPortalIdRef = useRef(null)
  // Nota: evitamos crear un WebGLRenderer extra aqu? para detectSupport (coste GPU innecesario)
  // La detecci?n de soporte KTX2 se realiza en componentes que ya tienen acceso al renderer real.

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
    // Finalizar efectos psicod?licos
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
    // Al volver a HOME, reestablecer jugador/c?mara a estado por defecto y ocultar UI de secci?n
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
      // Ocultar CTA sin animaci?n y limpiar timers al volver a HOME
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
      // Revelar poco despu?s para que se vea la ca?da del personaje
      setTimeout(() => setBlackoutVisible(false), 80)
    }
    // Mostrar banner de la secci?n activa durante 1.8s
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

  // Control de CTA con animaci?n de salida
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

  // Si hay blackout (salida a HOME o transiciones), ocultar CTA de inmediato sin animaci?n
  React.useEffect(() => {
    if (blackoutVisible) {
      setShowCta(false)
      setCtaAnimatingOut(false)
    }
  }, [blackoutVisible])

  // Control de Marquee conforme a checklist (persistente en transici?n a secciones)
  React.useEffect(() => {
    if (marqueeForceHidden) {
      setShowMarquee(false)
      setMarqueeAnimatingOut(false)
      return
    }
    if (landingBannerActive) {
      setShowMarquee(true)
      // Bloquear animaci?n de salida mientras dura el banner de aterrizaje
      setMarqueeAnimatingOut(false)
      return
    }
    // Si estamos en transici?n activa hacia una secci?n (CTA o navegaci?n normal), mantener marquee visible con label destino
    if (((transitionState.active && transitionState.to && transitionState.to !== 'home')
      || (ctaLoading && transitionState.to && transitionState.to !== 'home'))) {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(transitionState.to)
      return
    }
    // Puente entre fin de transici?n y montaje de UI de secci?n: si ya estamos en una secci?n, mantener visible
    if (section !== 'home') {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      setMarqueeLabelSection(section)
      return
    }
    // En secciones (UI visible), marquee fijo con label de la secci?n
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

  // Forzar fade a negro r?pido al salir de secci?n para ocultar parpadeos
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
  // Prioriza huevo, en caso contrario aplica el color amortiguado
  const effectiveSceneColor = eggActive ? redEgg : sceneColor
  // Durante efecto psicod?lico, aclara el fondo para no ?comerse? el warp
  const psychoSceneColor = fx.psychoEnabled ? lightenHexColor(effectiveSceneColor, 0.45) : effectiveSceneColor

  // IMPORTANTE: evitar overlays invisibles que bloqueen el drag del canvas.
  // La UI de secciones puede estar montada con opacity=0 (ej. WORK antes de workReady).
  // En ese caso, debe tener pointer-events: none.
  const sectionUiCanInteract = (showSectionUi && !sectionUiAnimatingOut && !(section === 'section1' && !workReady))

  // DEV: "panic reset" para salir de estados pegados (pantalla gris/overlays).
  const devPanicReset = React.useCallback(() => {
    try { setTransitionState({ active: false, from: section, to: null }) } catch {}
    try { setNoiseMixEnabled(false); setPrevSceneTex(null); setNoiseMixProgress(0); rippleMixRef.current.v = 0 } catch {}
    try { setNoiseOverlayActive(false); setNoisePrevTex(null); setNoiseNextTex(null); setNoiseProgress(0) } catch {}
    try { setImgMaskOverlayActive(false); setImgPrevTex(null); setImgNextTex(null); setImgProgress(0) } catch {}
    try { setRevealOverlayActive(false) } catch {}
    try { setDomRippleActive(false) } catch {}
    try { setGridOverlayActive(false); setGridPhase('out') } catch {}
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    try { setShowSectionUi(false); setSectionUiAnimatingOut(false); setSectionUiFadeIn(false) } catch {}
    try { setShowCta(false); setCtaAnimatingOut(false); setCtaLoading(false); setCtaProgress(0); setCtaForceHidden(false) } catch {}
    try { setShowMarquee(false); setMarqueeAnimatingOut(false); setMarqueeForceHidden(false) } catch {}
    try { setNearPortalId(null); setUiHintPortalId(null) } catch {}
    // Forzar estado de entrada listo
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
        // Sombras ?reales? (shadow maps) se deshabilitan: eran caras y se ve?an incompletas.
        // Usamos sombra abstracta tipo ContactShadows en su lugar.
        shadows={false}
        dpr={[1, pageHidden ? 1.0 : (degradedMode ? 1.0 : (isMobilePerf ? 1.0 : 1.1))]}
        // preserveDrawingBuffer=true aumenta MUCHO el uso de VRAM y puede provocar Context Lost
        // (los efectos de c?mara/post no dependen de esto).
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false }}
        camera={{ position: [0, 3, 8], fov: 60, near: 0.1, far: 2000 }}
        events={undefined}
        onCreated={({ gl }) => {
          // Pre-warm shaders/pipelines to avoid first interaction jank
          try {
            // Evitar warning si WEBGL_lose_context no existe (algunos drivers/navegadores)
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
            // Fallback robusto: evitar getContextAttributes() === null (alpha null en postprocessing)
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
            // Evitar que se vea el gris del <body> cuando el canvas no pinta (frameloop pausado / overlay).
            // Esto es solo CSS del canvas; no afecta a tus <color attach="background" ...> en WebGL.
            el.style.background = '#000'
            // Mobile: permitir drag para OrbitControls (evita que el navegador capture gestos y ?mate? el rotate)
            el.style.touchAction = 'none'
            // WebGL context lost/restored handlers
            const onLost = (e) => {
              try { e.preventDefault() } catch {}
              // Entrar a modo degradado para recuperar el contexto.
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
          {/* Escena principal siempre montada (preloader es solo overlay HTML) */}
          <>
            {/* Pausar frameloop cuando: preloader visible, secci?n UI activa sin transici?n, o p?gina oculta */}
            <PauseFrameloop paused={showPreloaderOverlay || (((showSectionUi || sectionUiAnimatingOut) && !transitionState.active && !noiseMixEnabled) || pageHidden)} />
              {/* Warm-up escena principal: primero luces simples, luego Environment */}
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
              {/* Pasto fake: se revela en radio alrededor del personaje (barato: 1 drawcall) */}
              {/* Se oculta durante transiciones desde HOME para evitar flash */}
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
                // Mucho m?s peque?o
                bladeHeight={0.42}
                bladeWidth={0.032}
                sway={0.045}
              />
          {/* Ancla para God Rays (oculta cuando no est? activo y sin escribir depth) */}
          {fx.godEnabled && (
            <mesh ref={sunRef} position={[0, 8, 0]}>
              <sphereGeometry args={[0.35, 12, 12]} />
              <meshBasicMaterial color={'#ffffff'} transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          {/* Esferas luminosas con f?sica en HOME */}
          {/* Se ocultan inmediatamente cuando hay transici?n activa saliendo de HOME para evitar flash */}
          {(section === 'home' && mainWarmStage >= 2 && !(transitionState.active && transitionState.from === 'home')) && (
            <HomeOrbs
              ref={homeOrbsRef}
              playerRef={playerRef}
              active={section === 'home'}
              num={10}
              portals={portals}
              portalRadius={2}
            />
          )}
          {/* Player se monta desde el preloader en modo prewarm (invisible, sin loop) para evitar hitch al ?Enter? */}
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
                  setGridPhase('out') // NO incrementar gridKey aqu? - causa flash
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
              // Desactivar preloaderFadingOut cuando el personaje aterriza
              if (preloaderFadingOut) {
                if (preloaderHideTimerRef.current) { clearTimeout(preloaderHideTimerRef.current); preloaderHideTimerRef.current = null }
                setPreloaderFadingOut(false)
              }
              // Marcar que el personaje ya aterriz? - la UI puede mostrarse
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
          {/* Sombra abstracta (stable): NO en modo orbe */}
          {/* Sombra se oculta durante transiciones desde HOME */}
          {!bootLoading && (
            <BlobShadow
              key={`blob:${isMobilePerf ? 1 : 0}:${degradedMode ? 1 : 0}`}
              playerRef={playerRef}
              enabled={Boolean(section === 'home' && !orbActiveUi && !(transitionState.active && transitionState.from === 'home'))}
              // 50% m?s chica vs 6.2, pero m?s visible
              size={3.1}
              opacity={Boolean(isMobilePerf || degradedMode) ? 0.35 : 0.45}
              innerAlpha={0.9}
              midAlpha={0.55}
            />
          )}
          {/* Tumba removida */}
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
            Power ready (charge ? 100%):
            actionCooldown se usa como canal (1 - charge). Cuando llega cerca de 0,
            el fill de la barra (1 - actionCooldown) est? casi al 100%.
          */}
          {(() => {
            // Umbral alineado con glowOn de la barra
            const powerReady = (Math.max(0, Math.min(1, 1 - actionCooldown)) >= 0.98)
            const wantShake = powerReady && section === 'home'
            // Si el jugador est? movi?ndose, evitamos mareo visual; al soltar/quedarse quieto, s? tiembla.
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
                // Easter egg: shake m?s sutil para no marear
                shakeAmplitude={amp}
                shakeFrequencyX={fxX}
                shakeFrequencyY={fxY}
                shakeYMultiplier={yMul}
                // Permitir rotaci?n siempre en HOME; en secciones UI se bloquea
                enabled={section === 'home' ? true : (!showSectionUi && !sectionUiAnimatingOut)}
                // Mobile: comportamiento id?ntico a desktop (solo cambia el input: joystick)
                followBehind={false}
                // Camera mode: 'third-person' or 'top-down'
                mode={cameraMode}
              />
            )
          })()}
          {/* Mantengo s?lo el shake v?a target para no interferir con OrbitControls */}
          {/* Perf can be used during development to monitor FPS; disabled by default. */}
          {/* <Perf position="top-left" /> */}
          {/* Postprocessing effects */}
          {/* Mantener FX incluso en degradedMode, pero en lowPerf */}
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
              rippleCenterX={0.5}
              rippleCenterY={0.5}
              rippleFreq={30.0}
              rippleWidth={0.03}
              rippleStrength={0.6}
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
              // Outline amarillo para el personaje
              outlineEnabled={section === 'home' && !bootLoading}
              outlineMeshes={playerMeshes}
              outlineColor={0xffcc00}
              outlineEdgeStrength={5.0}
            />
          )}
          {/* Desactivado: el crossfade/overlay se reemplaza por RippleDissolveMix final */}
          </>
        </Suspense>
      </Canvas>

      {/* (Efectos DOM removidos a petici?n del usuario) */}

      {/* Preloader overlay global - solo HTML (sin escena 3D) */}
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
      {showDebugUi && showGpu && <GpuStats sampleMs={1000} gl={glRef.current} />}
      {/* Overlay global negro desactivado para no tapar la animaci?n de HOME */}
      {/* Secciones scrolleables con transici?n suave y fondo por secci?n */}
      {(!showPreloaderOverlay && (showSectionUi || sectionUiAnimatingOut)) && (
        <div
          ref={sectionScrollRef}
          className={`fixed inset-0 z-[10] overflow-y-auto no-native-scrollbar ${sectionUiCanInteract ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            backgroundColor: sectionColors[section] || '#000000',
            overflowAnchor: 'none',
            overflowY: (lockScroll ? 'hidden' : 'auto'),
            // Forzar oculta en WORK hasta que el centrado inicial est? listo (evita "brinco")
            opacity: (section === 'section1' && !workReady)
              ? 0
              : ((noiseMixEnabled && !prevSceneTex)
                  ? 1
                  : ((sectionUiFadeIn && showSectionUi && !sectionUiAnimatingOut) ? 1 : 0)),
            transition: (noiseMixEnabled && !prevSceneTex) ? 'opacity 0ms' : 'opacity 500ms ease',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            touchAction: 'pan-y',
          }}
          onWheel={() => { try { if (section === 'section1') { snapEnabledRef.current = true; setFreezeWorkWrap(false) } } catch {} }}
          onTouchStart={() => { try { if (section === 'section1') { snapEnabledRef.current = true; setFreezeWorkWrap(false) } } catch {} }}
          onScroll={(e) => {
            try {
              const el = e.currentTarget
              const max = Math.max(1, el.scrollHeight - el.clientHeight)
              setSectionScrollProgress(el.scrollTop / max)
              updateScrollbarFromScroll()
              // En WORK: limitar scroll m?nimo para no mostrar espacio vac?o arriba del primer proyecto
              if (section === 'section1' && workReadyRef.current && workMinScrollRef.current > 0) {
                if (el.scrollTop < workMinScrollRef.current) {
                  el.scrollTop = workMinScrollRef.current
                }
              }
              // En WORK: snap con JavaScript despu?s de que el usuario deje de scrollear (debounce)
              if (section === 'section1' && workReadyRef.current) {
                if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
                snapTimerRef.current = setTimeout(() => {
                  if (!snapInProgressRef.current && !controlledScrollRef.current) {
                    snapToNearestWorkCard()
                  }
                }, 180) // 180ms despu?s de dejar de scrollear
              }
            } catch {}
          }}
          data-section-scroll
        >
          <div className="min-h-screen w-full" style={{ paddingTop: `${marqueeHeight}px`, overscrollBehavior: 'contain' }}>
            <Suspense fallback={null}>
              <div className="relative max-w-5xl mx-auto px-6 sm:px-8 pt-6 pb-12">
                {section === 'section1' && <Section1 scrollerRef={sectionScrollRef} scrollbarOffsetRight={scrollbarW} disableInitialSeed={true} navOffset={navHeight} simpleMode={true} />}
                {section === 'section2' && <Section2 />}
                {section === 'section3' && <Section3 />}
                {section === 'section4' && <Section4 />}
              </div>
            </Suspense>
          </div>
          {/* Minimal nav overlay eliminado en WORK para evitar interferencias con WorkCarousel */}
        </div>
      )}

      {/* CTA: Cruza el portal (aparece cuando el jugador est? cerca del portal) */}
      {(
        (showCta || ctaAnimatingOut || ctaLoading)
        && (!transitionState.active || ctaLoading)
        && !domRippleActive
        && !ctaForceHidden
        && !blackoutVisible
        && (((section === 'home') && !showSectionUi && !sectionUiAnimatingOut) || ctaLoading)
      ) && (
        <div
          // Siempre centrado en pantalla (como en mobile) en todos los tama?os
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
              // Preloader CTA: iniciar barra de progreso y color por secci?n
              try { setCtaColor(sectionColors[target] || '#ffffff') } catch {}
              setCtaLoading(true)
              setCtaProgress(0)
              if (ctaProgTimerRef.current) clearInterval(ctaProgTimerRef.current)
              ctaProgTimerRef.current = setInterval(() => {
                setCtaProgress((p) => Math.min(100, p + 4))
              }, 60)
              // Preload secci?n destino sin bloquear UI
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
              // Preload assets cr?ticos de la secci?n (im?genes de Work), si aplica
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
              // completar barra a 100% antes de iniciar transici?n
              setCtaProgress(100)
              try { if (ctaProgTimerRef.current) { clearInterval(ctaProgTimerRef.current); ctaProgTimerRef.current = null } } catch {}
              // Ocultar CTA justo al finalizar la animaci?n visual del preload
              // (la "barra" tiene transition de 150ms)
              window.setTimeout(() => {
                setCtaLoading(false)
              }, 180)
              // Inicia transici?n visual
              try { if (playerRef.current) prevPlayerPosRef.current.copy(playerRef.current.position) } catch {}
              try { lastPortalIdRef.current = target } catch {}
              // Transici?n con ret?cula animada
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
            {/* Fondo de preloader como relleno del bot?n */}
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
              // Evitar ?mordido? de la tipograf?a (Luckiest Guy) dentro de overflow-hidden
              // sin cambiar el look: mantenemos el mismo tama?o pero damos un pel?n de line-height/padding.
              // Nota: `truncate` aplica overflow-hidden y puede recortar la tipograf?a.
              // Aqu? el texto cabe, as? que preferimos NO truncar para evitar el clipping vertical.
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

      {/* Marquee de t?tulo de secci?n (solo visible en HOME) */}
      {/* Marquee - controlado por uiAnimPhase */}
      {(showMarquee || marqueeAnimatingOut) && !showPreloaderOverlay && !gridOverlayActive && !preloaderFadingOut && uiAnimPhase !== 'hidden' && (
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

      {/* Bot?n cerrar se renderiza dentro de CharacterPortrait para posicionarlo con precisi?n sobre el retrato */}
      {/* Toggle panel FX */}
      {showDebugUi && !showSectionUi && (
        <button
          type="button"
          onClick={() => setShowFxPanel((v) => !v)}
          className="pointer-events-auto fixed right-4 top-16 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md z-[15000]"
          aria-label={t('a11y.toggleFx')}
        >{t('common.fxShort')}</button>
      )}
      {/* Toggle Music Player (movido a la nav principal) */}
      {/* Toggle GPU Stats */}
      {showDebugUi && !showSectionUi && (
        <button
          type="button"
          onClick={() => setShowGpu((v) => !v)}
          className="pointer-events-auto fixed right-4 top-28 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md z-[15000] transition-transform hover:translate-y-[-1px]"
          aria-label={t('a11y.toggleGpu')}
        >{t('common.gpuShort')}</button>
      )}
      {/* Floating music + hamburger (modo compacto) - controlado por uiAnimPhase */}
      {isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
      <div key="mobile-controls" ref={compactControlsRef} className={`pointer-events-none fixed right-4 bottom-4 z-[999992] flex flex-col items-end gap-3 ${uiAnimPhase === 'entering' ? 'animate-ui-enter-right' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-right' : ''}`}>
        {/* Socials (mobile): colapsados en bot?n + abanico */}
        <div ref={socialsWrapMobileRef} className="pointer-events-auto relative" style={{ width: '48px', height: '48px', marginRight: `${(scrollbarW || 0)}px` }}>
          {/* Abanico */}
          {(() => {
            // Espaciado uniforme en arco (izquierda ? arriba) para que no se ?desalineen?
            // Ajuste: mantener el espaciado OK pero acercar el abanico al coraz?n.
            // Botones 48px => buscamos >~50px entre centros para que no se encimen.
            // Arco arriba-izquierda (evitar dx positivo).
            const R = 74
            const startDeg = 188
            const stepDeg = 41
            const items = [
              { key: 'x', href: 'https://x.com/mroscareth', label: 'X', icon: `${import.meta.env.BASE_URL}x.svg` },
              { key: 'ig', href: 'https://www.instagram.com/mroscar.eth', label: 'Instagram', icon: `${import.meta.env.BASE_URL}instagram.svg` },
              { key: 'be', href: 'https://www.behance.net/mroscar', label: 'Behance', icon: `${import.meta.env.BASE_URL}behance.svg` },
            ].map((s, i) => {
              const deg = startDeg + (i * stepDeg)
              const rad = (deg * Math.PI) / 180
              const dx = Math.round(Math.cos(rad) * R)
              const dy = Math.round(Math.sin(rad) * R)
              return { ...s, dx, dy }
            })
            return items.map((s) => (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setSocialsOpen(false) }}
              className="absolute right-0 bottom-0 h-12 w-12 rounded-full bg-white/95 text-black grid place-items-center shadow-md transition-all duration-200"
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
            ))
          })()}
          {/* Bot?n base */}
          <button
            type="button"
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setSocialsOpen((v) => !v) }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className={`h-12 w-12 rounded-full grid place-items-center shadow-md transition-colors ${socialsOpen ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
            aria-expanded={socialsOpen ? 'true' : 'false'}
            aria-label="Redes sociales"
            title="Redes sociales"
          >
            <HeartIcon className="w-5 h-5" />
          </button>
        </div>
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
        {/* Settings (mobile): colapsa m?sica + c?mara + modo videojuego (horizontal) */}
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
              key: 'camera',
              tooltip: 'Cam View',
              active: cameraMode === 'top-down',
              onClick: () => setCameraMode((m) => m === 'third-person' ? 'top-down' : 'third-person'),
              render: () => <VideoCameraIcon className="w-6 h-6" />,
              dx: -120, dy: 0,
            },
            {
              key: 'mobile-ui',
              tooltip: 'Game UI',
              active: forceCompactUi,
              onClick: () => setForceCompactUi((v) => !v),
              render: () => <GamepadIcon className="w-6 h-6" />,
              dx: -180, dy: 0,
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

      {/* Socials + Settings (desktop): alineados con nav - controlado por uiAnimPhase */}
      {!isCompactUi && !showPreloaderOverlay && !preloaderFadingOut && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
      <div key="desktop-socials-settings" className={`pointer-events-auto fixed right-10 bottom-10 z-[999993] flex gap-3 ${uiAnimPhase === 'entering' ? 'animate-ui-enter-right' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-right' : ''}`}>
        <div ref={socialsWrapDesktopRef} className="pointer-events-auto relative" style={{ width: '44px', height: '44px' }}>
          {/* Apilados hacia arriba */}
          {[
            { key: 'x', href: 'https://x.com/mroscareth', tooltip: 'X', icon: `${import.meta.env.BASE_URL}x.svg`, dx: 0, dy: -52 },
            { key: 'ig', href: 'https://www.instagram.com/mroscar.eth', tooltip: 'Instagram', icon: `${import.meta.env.BASE_URL}instagram.svg`, dx: 0, dy: -104 },
            { key: 'be', href: 'https://www.behance.net/mroscar', tooltip: 'Behance', icon: `${import.meta.env.BASE_URL}behance.svg`, dx: 0, dy: -156 },
          ].map((s) => (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              data-tooltip={s.tooltip}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setSocialsOpen(false) }}
              className="tooltip-black absolute right-0 bottom-0 h-10 w-10 rounded-full bg-white/95 text-black grid place-items-center shadow-md transition-all duration-200"
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
          {/* Bot?n base */}
          <button
            type="button"
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setSocialsOpen((v) => !v) }}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            onFocus={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
            className={`h-11 w-11 rounded-full grid place-items-center shadow-md transition-colors ${socialsOpen ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
            aria-expanded={socialsOpen ? 'true' : 'false'}
            aria-label="Redes sociales"
            title="Redes sociales"
          >
            <HeartIcon className="w-6 h-6" />
          </button>
        </div>
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
        {/* Settings (desktop): m?sica + c?mara + modo videojuego (apilados hacia arriba) */}
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
              key: 'camera',
              tooltip: 'Cam View',
              active: cameraMode === 'top-down',
              onClick: () => setCameraMode((m) => m === 'third-person' ? 'top-down' : 'third-person'),
              render: () => <VideoCameraIcon className="w-5 h-5" />,
              dx: 0, dy: -104,
            },
            {
              key: 'mobile-ui',
              tooltip: 'Game UI',
              active: forceCompactUi,
              onClick: () => setForceCompactUi((v) => !v),
              render: () => <GamepadIcon className="w-5 h-5" />,
              dx: 0, dy: -156,
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
          {/* Bot?n engrane */}
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

      {/* Desktop nav - controlado por uiAnimPhase */}
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
                  // En UI de secci?n, no permitir transici?n a STORE (coming soon)
                  if (id === 'section3') return
                  if (!transitionState.active && id !== section) {
                    beginGridRevealTransition(id, { cellSize: 60 })
                    setPortraitGlowV((v) => v + 1)
                  }
                } else {
                  // En HOME: permitir viajar al portal STORE (pero sin abrir secci?n)
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
                  // Solo el texto con color por secci?n (sin ?c?psula?)
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
                    // En UI de secci?n, no permitir transici?n a STORE (coming soon)
                    if (id === 'section3') return
                    if (!transitionState.active && id !== section) {
                      beginGridRevealTransition(id, { cellSize: 60 })
                      setPortraitGlowV((v) => v + 1)
                    }
                  } else {
                    // En HOME: permitir viajar al portal STORE (pero sin abrir secci?n)
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
        {/* Mobile overlay backdrop (todas las resoluciones) */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${showMusic ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setShowMusic(false)}
        />
        {/* Positioner: centered (modo mobile en todas las resoluciones) */}
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
      {/* Panel externo para ajustar postprocesado */}
      {showDebugUi && showFxPanel && (
      <div className="pointer-events-auto fixed right-4 top-28 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none z-[500]">
        <div className="text-xs font-semibold opacity-80">{t('fx.title')}</div>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>{t('fx.godRays')}</span>
          <input
            type="checkbox"
            checked={fx.godEnabled}
            onChange={(e) => {
              const enabled = e.target.checked
              // Si se activa y seguimos en los valores por defecto suaves, aplicar un preset m?s evidente
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
            <label className="block text-[11px] opacity-80">{t('fx.labels.density')}: {fx.godDensity.toFixed(2)}
              <input className="w-full" type="range" min="0.1" max="1.5" step="0.01" value={fx.godDensity} onChange={(e) => setFx({ ...fx, godDensity: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">{t('fx.labels.decay')}: {fx.godDecay.toFixed(2)}
              <input className="w-full" type="range" min="0.5" max="1.0" step="0.01" value={fx.godDecay} onChange={(e) => setFx({ ...fx, godDecay: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">{t('fx.labels.weight')}: {fx.godWeight.toFixed(2)}
              <input className="w-full" type="range" min="0.1" max="1.5" step="0.01" value={fx.godWeight} onChange={(e) => setFx({ ...fx, godWeight: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">{t('fx.labels.exposure')}: {fx.godExposure.toFixed(2)}
              <input className="w-full" type="range" min="0.0" max="1.0" step="0.01" value={fx.godExposure} onChange={(e) => setFx({ ...fx, godExposure: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">{t('fx.labels.clampMax')}: {fx.godClampMax.toFixed(2)}
              <input className="w-full" type="range" min="0.2" max="2.0" step="0.01" value={fx.godClampMax} onChange={(e) => setFx({ ...fx, godClampMax: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">{t('fx.labels.samples')}: {fx.godSamples}
              <input className="w-full" type="range" min="16" max="120" step="1" value={fx.godSamples} onChange={(e) => setFx({ ...fx, godSamples: parseInt(e.target.value, 10) })} />
            </label>
          </>
        )}
        <label className="block text-[11px] opacity-80">{t('fx.labels.bloom')}: {fx.bloom.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1.5" step="0.01" value={fx.bloom} onChange={(e) => setFx({ ...fx, bloom: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">{t('fx.labels.vignette')}: {fx.vignette.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.vignette} onChange={(e) => setFx({ ...fx, vignette: parseFloat(e.target.value) })} />
        </label>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>{t('fx.halftone')}</span>
          <input type="checkbox" checked={fx.dotEnabled} onChange={(e) => setFx({ ...fx, dotEnabled: e.target.checked })} />
        </div>
        <label className="block text-[11px] opacity-80">{t('fx.labels.dotScale')}: {fx.dotScale.toFixed(2)}
          <input className="w-full" type="range" min="0" max="3" step="0.01" value={fx.dotScale} onChange={(e) => setFx({ ...fx, dotScale: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
        </label>
        <label className="block text-[11px] opacity-80">{t('fx.labels.dotAngle')}: {fx.dotAngle.toFixed(2)}
          <input className="w-full" type="range" min="0" max="3.1416" step="0.01" value={fx.dotAngle} onChange={(e) => setFx({ ...fx, dotAngle: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 block text-[11px] opacity-80">{t('fx.labels.centerX')}: {fx.dotCenterX.toFixed(2)}
            <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.dotCenterX} onChange={(e) => setFx({ ...fx, dotCenterX: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
          </label>
          <label className="flex-1 block text-[11px] opacity-80">{t('fx.labels.centerY')}: {fx.dotCenterY.toFixed(2)}
            <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.dotCenterY} onChange={(e) => setFx({ ...fx, dotCenterY: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
          </label>
        </div>
        <label className="block text-[11px] opacity-80">{t('fx.labels.dotOpacity')}: {fx.dotOpacity.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.dotOpacity} onChange={(e) => setFx({ ...fx, dotOpacity: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
        </label>
        <label className="block text-[11px] opacity-80">{t('fx.labels.dotBlend')}
          <select
            className="w-full bg-black/30 border border-white/10 rounded mt-1"
            value={fx.dotBlend}
            onChange={(e) => setFx({ ...fx, dotBlend: e.target.value })}
            disabled={!fx.dotEnabled}
          >
            <option value="normal">{t('fx.blend.normal')}</option>
            <option value="multiply">{t('fx.blend.multiply')}</option>
            <option value="screen">{t('fx.blend.screen')}</option>
            <option value="overlay">{t('fx.blend.overlay')}</option>
            <option value="softlight">{t('fx.blend.softlight')}</option>
            <option value="add">{t('fx.blend.add')}</option>
            <option value="darken">{t('fx.blend.darken')}</option>
            <option value="lighten">{t('fx.blend.lighten')}</option>
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
        <label className="block text-[11px] opacity-80">{t('fx.labels.noise')}: {fx.noise.toFixed(2)}
          <input className="w-full" type="range" min="0" max="0.6" step="0.01" value={fx.noise} onChange={(e) => setFx({ ...fx, noise: parseFloat(e.target.value) })} />
        </label>
        <div className="h-px bg-white/10 my-2" />
        <div className="text-xs font-semibold opacity-80">{t('fx.dof.title')}</div>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>{t('fx.dof.enabled')}</span>
          <input type="checkbox" checked={fx.dofEnabled} onChange={(e) => setFx({ ...fx, dofEnabled: e.target.checked })} />
        </div>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>{t('fx.dof.progressive')}</span>
          <input type="checkbox" checked={fx.dofProgressive} onChange={(e) => setFx({ ...fx, dofProgressive: e.target.checked })} />
        </div>
        {!fx.dofProgressive && (
          <label className="block text-[11px] opacity-80">{t('fx.dof.focusDistance')}: {fx.dofFocusDistance.toFixed(2)}
            <input className="w-full" type="range" min="0" max="1" step="0.005" value={fx.dofFocusDistance} onChange={(e) => setFx({ ...fx, dofFocusDistance: parseFloat(e.target.value) })} />
          </label>
        )}
        <label className="block text-[11px] opacity-80">{t('fx.dof.focalLength')}: {fx.dofFocalLength.toFixed(3)}
          <input className="w-full" type="range" min="0.001" max="0.06" step="0.001" value={fx.dofFocalLength} onChange={(e) => setFx({ ...fx, dofFocalLength: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">{t('fx.dof.bokehScale')}: {fx.dofBokehScale.toFixed(1)}
          <input className="w-full" type="range" min="0.5" max="6" step="0.1" value={fx.dofBokehScale} onChange={(e) => setFx({ ...fx, dofBokehScale: parseFloat(e.target.value) })} />
        </label>
        {fx.dofProgressive && (
          <label className="block text-[11px] opacity-80">{t('fx.dof.focusSpeed')}: {fx.dofFocusSpeed.toFixed(2)}
            <input className="w-full" type="range" min="0.02" max="0.5" step="0.01" value={fx.dofFocusSpeed} onChange={(e) => setFx({ ...fx, dofFocusSpeed: parseFloat(e.target.value) })} />
          </label>
        )}
      </div>
      )}
      {/* Panel externo para ajustar la luz superior */}
      {showDebugUi && (
        <>
          <button
            type="button"
            onClick={() => setShowLightPanel((v) => !v)}
            className="pointer-events-auto fixed right-4 top-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md transition-transform hover:translate-y-[-1px]"
            aria-label={t('a11y.toggleLight')}
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
        <label className="block text-[11px] opacity-80">{t('light.labels.height')}: {topLight.height.toFixed(2)}
          <input className="w-full" type="range" min="2" max="12" step="0.05" value={topLight.height} onChange={(e) => setTopLight({ ...topLight, height: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">{t('light.labels.intensity')}: {topLight.intensity.toFixed(2)}
          <input className="w-full" type="range" min="0" max="8" step="0.05" value={topLight.intensity} onChange={(e) => setTopLight({ ...topLight, intensity: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">{t('light.labels.angle')}: {topLight.angle.toFixed(2)}
          <input className="w-full" type="range" min="0.1" max="1.2" step="0.01" value={topLight.angle} onChange={(e) => setTopLight({ ...topLight, angle: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">{t('light.labels.penumbra')}: {topLight.penumbra.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1" step="0.01" value={topLight.penumbra} onChange={(e) => setTopLight({ ...topLight, penumbra: parseFloat(e.target.value) })} />
        </label>
        <div className="h-px bg-white/10 my-2" />
        <div className="text-xs font-semibold opacity-80">{t('light.preloaderTitle')}</div>
        <button
          type="button"
          className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
          onClick={async () => {
            const preset = JSON.stringify({ intensity: topLight.intensity, angle: topLight.angle, penumbra: topLight.penumbra, relativeFactor: 0.4 }, null, 2)
            try { await navigator.clipboard.writeText(preset) } catch {
              const ta = document.createElement('textarea'); ta.value = preset; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
            }
          }}
        >{t('pre.copyLightPreset')}</button>
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
        >{t('light.copyPositionTarget')}</button>
      </div>
          )}
        </>
      )}
      {/* Portrait del personaje: controlado por uiAnimPhase */}
      {!bootLoading && !showPreloaderOverlay && (uiAnimPhase === 'visible' || uiAnimPhase === 'entering' || uiAnimPhase === 'exiting') && (
        <CharacterPortrait
          key="character-portrait"
          className={uiAnimPhase === 'entering' ? 'animate-ui-enter-left' : uiAnimPhase === 'exiting' ? 'animate-ui-exit-left' : ''}
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
          zIndex={999990}
          showExit={section !== 'home'}
          mode={'overlay'}
          actionCooldown={actionCooldown}
          eggEnabled={true}
          eggClicksRequired={5}
          forceCompact={forceCompactUi ? true : undefined}
        />
      )}
      {/* HUD de puntaje - solo mostrar cuando el personaje aterriz? */}
      {section === 'home' && !bootLoading && homeLanded && (
        <ScoreHUD t={t} isCompactUi={isCompactUi} />
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
      {/* Joystick m?vil: visible en el mismo breakpoint del men? hamburguesa (=1100px),
          en HOME y cuando el orbe no est? activo */}
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

              {/* UI de poder (barra horizontal + bot?n Bolt) ? mobile/iPad */}
              <div
                className="fixed z-[12010] pointer-events-none"
                // Colocarla dentro del hueco libre (no tocar retrato ni controles) + safe area iOS
                style={{
                  left: `${powerSafeInsets.left}px`,
                  right: `${powerSafeInsets.right}px`,
                  bottom: isCompactJoystickUi
                    ? 'calc(env(safe-area-inset-bottom, 0px) + 1rem + 40px)'
                    : 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem + 40px)',
                }}
              >
                {/* Wrapper relativo para superponer el bot?n sobre la barra */}
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
      {/* Toggle panel Retrato */}
      {showDebugUi && (
        <button
          type="button"
          onClick={() => setShowPortraitPanel((v) => !v)}
          className="pointer-events-auto fixed right-4 top-40 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md transition-transform hover:translate-y-[-1px]"
          aria-label={t('a11y.togglePortrait')}
        >{t('common.portraitShort')}</button>
      )}
      {/* Blackout overlay for smooth/instant fade to black */}
      <div
        className="fixed inset-0 z-[50000] pointer-events-none"
        style={{
          background: '#000',
          opacity: (blackoutVisible && !noiseMixEnabled && !transitionState.active && !noiseOverlayActive && !domRippleActive && !gridOverlayActive && !revealOverlayActive) ? 1 : 0,
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
      {/* Image mask A/B overlay (public/transition0.png: negro=A, blanco=B) */}
      <ImageMaskTransitionOverlay
        active={imgMaskOverlayActive}
        prevTex={imgPrevTex}
        nextTex={imgNextTex}
        maskTex={imgMaskTex}
        progress={imgProgress}
        softness={0.08}
      />
      {/* Grid reveal overlay (cubre y descubre con celdas en desfase) */}
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
      />

      {/* NUEVO: Overlay unificado basado en render targets (deshabilitado - causa lag) */}
      {false && <UnifiedTransitionOverlay
        active={sceneTransition.overlayActive}
        effect={sceneTransition.effect}
        progress={sceneTransition.progress}
        textureA={sceneTransition.textureA}
        textureB={sceneTransition.textureB}
        config={sceneTransition.config}
      />}

      {/* SIMPLE: Overlay CSS puro (sin lag) */}
      <SimpleTransitionOverlay
        active={simpleTransition.active}
        phase={simpleTransition.phase}
        cellSize={simpleTransition.config.cellSize || 60}
        coverDuration={simpleTransition.config.coverDuration || 450}
        revealDuration={simpleTransition.config.revealDuration || 550}
        onCoverComplete={simpleTransition.onCoverComplete}
        onRevealComplete={simpleTransition.onRevealComplete}
      />

      {/* Debug HUD desactivado - usar F9 para panic reset si es necesario */}
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

// Personaje en el preloader: reproduce animaci?n de caminar en bucle
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
  // encuentra la cabeza y exp?n referencia global para otras utilidades si hiciera falta
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

// Animaci?n de zoom out de la c?mara en el preloader
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

// Apunta la c?mara a la clav?cula (buscando un bone por nombre y con fallback por heur?stica)
function PreloaderAim({ playerRef }) {
  const { camera } = useThree()
  const clavicleRef = React.useRef(null)
  // localizar un hueso de clav?cula por nombre com?n
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

// ?rbita lenta de c?mara alrededor del personaje tras el zoom inicial
// ?rbita tipo turntable: la c?mara rodea al personaje manteniendo el rostro (cabeza) en foco
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

// Luz editable dedicada al preloader (no sigue al personaje; con gizmo y bot?n copiar)
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
          <button type="button" onClick={async () => { try { const pos = (window.__preLightPos || []); const tgt = (window.__preLightTarget || []); const json = JSON.stringify({ position: pos, target: tgt }, null, 2); await navigator.clipboard.writeText(json) } catch {} }} className="px-3 py-1 rounded bg-white/90 text-black text-xs shadow hover:bg-white">{t('pre.copyLightPreset')}</button>
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
      // mantener valores dados; solo centrar en XZ si el player no est? en el origen
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

// Memorias random para el loading
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

// Preloader content con typewriter secuencial
function PreloaderContent({ t, lang, setLang, bootAllDone, bootProgress, scenePreMounted, preloaderFadingOut, setAudioReady, exitToHomeLikeExitButton }) {
  // Control de secuencia: 0=titulo, 1=p1, 2=p2, 3=p3, 4=done
  const [step, setStep] = React.useState(0)
  const p3Text = t('pre.p3')
  const hasP3 = p3Text && p3Text !== 'pre.p3'
  
  // Progreso visual m?s lento que el real
  const [visualProgress, setVisualProgress] = React.useState(0)
  React.useEffect(() => {
    if (bootProgress <= 0) { setVisualProgress(0); return }
    // Llenar m?s lento: incrementar gradualmente hacia el bootProgress
    const interval = setInterval(() => {
      setVisualProgress(prev => {
        const target = bootProgress
        if (prev >= target) return target
        // Incremento peque?o para que sea m?s lento
        const increment = Math.max(0.5, (target - prev) * 0.08)
        return Math.min(target, prev + increment)
      })
    }, 50)
    return () => clearInterval(interval)
  }, [bootProgress])
  
  // Estado de carga completa y blink
  const [loadComplete, setLoadComplete] = React.useState(false)
  const [blinkCount, setBlinkCount] = React.useState(0)
  
  // Detectar cuando el progreso visual llega a 100
  React.useEffect(() => {
    if (visualProgress >= 100 && !loadComplete) {
      setLoadComplete(true)
    }
  }, [visualProgress, loadComplete])
  
  // Efecto de blink cuando se completa
  React.useEffect(() => {
    if (!loadComplete) return
    if (blinkCount >= 8) return // 4 blinks = 8 cambios (on/off)
    const timer = setTimeout(() => {
      setBlinkCount(prev => prev + 1)
    }, 150)
    return () => clearTimeout(timer)
  }, [loadComplete, blinkCount])
  
  // Texto de loading que cambia rapido (solo mientras carga)
  const [loadingText, setLoadingText] = React.useState(LOADING_MEMORIES[0])
  React.useEffect(() => {
    if (loadComplete) return // Detener cuando carga completa
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * LOADING_MEMORIES.length)
      setLoadingText(LOADING_MEMORIES[randomIndex])
    }, 120) // Cambia cada 120ms
    return () => clearInterval(interval)
  }, [loadComplete])
  
  // Reiniciar secuencia cuando cambia el idioma
  const prevLangRef = React.useRef(lang)
  React.useEffect(() => {
    if (prevLangRef.current !== lang) {
      setStep(0)
      prevLangRef.current = lang
    }
  }, [lang])
  
  return (
    <div
      className={`fixed inset-0 z-[20000] text-white ${preloaderFadingOut ? 'pointer-events-none' : 'pointer-events-auto'}`}
      role="dialog"
      aria-modal="true"
      style={{ 
        backgroundColor: '#0a0a0a',
        opacity: preloaderFadingOut ? 0 : 1, 
        transition: 'opacity 600ms ease' 
      }}
    >
      {/* Efecto de estatica de TV - grano blanco */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3CfeComponentTransfer%3E%3CfeFuncR type='discrete' tableValues='0 1'/%3E%3CfeFuncG type='discrete' tableValues='0 1'/%3E%3CfeFuncB type='discrete' tableValues='0 1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' fill='white'/%3E%3C/svg%3E")`,
          animation: 'tvStatic 0.08s steps(8) infinite',
          opacity: 0.06,
          mixBlendMode: 'overlay',
        }}
      />
      {/* Capa adicional de ruido para mas textura */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch' result='noise'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E")`,
          animation: 'tvStatic2 0.1s steps(6) infinite',
          opacity: 0.12,
          mixBlendMode: 'screen',
        }}
      />
      <style>{`
        @keyframes tvStatic {
          0% { transform: translate(0, 0) scale(1.02); }
          25% { transform: translate(-0.5%, 0.5%) scale(1.02); }
          50% { transform: translate(0.5%, -0.5%) scale(1.02); }
          75% { transform: translate(-0.5%, -0.5%) scale(1.02); }
          100% { transform: translate(0.5%, 0.5%) scale(1.02); }
        }
        @keyframes tvStatic2 {
          0% { transform: translate(0, 0); }
          16% { transform: translate(-1%, 1%); }
          33% { transform: translate(1%, -0.5%); }
          50% { transform: translate(-0.5%, -1%); }
          66% { transform: translate(0.5%, 0.5%); }
          83% { transform: translate(-0.5%, 0.5%); }
          100% { transform: translate(0, 0); }
        }
        .preloader-tw .Typewriter__cursor { display: inline-block; }
        .preloader-tw.hide-cursor .Typewriter__cursor { display: none; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.4s ease-out forwards; }
      `}</style>
      
      {/* Contenido principal */}
      <div className="flex items-center justify-center w-full h-full p-8 pb-20">
        <div className="w-full max-w-5xl flex flex-col items-center text-center">
          {/* T?tulo grande con typewriter */}
          <h1 
            key={`title-${lang}`}
            className={`font-marquee uppercase text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] leading-[0.85] tracking-wide mb-8 preloader-tw ${step >= 1 ? 'hide-cursor' : ''}`}
            style={{ WebkitTextStroke: '1.5px rgba(255,255,255,0.12)', whiteSpace: 'pre-line' }}
          >
            <Typewriter
              options={{
                cursor: '|',
                delay: 40,
              }}
              onInit={(typewriter) => {
                typewriter
                  .typeString(t('pre.title'))
                  .callFunction(() => setStep(1))
                  .start()
              }}
            />
          </h1>
          
          {/* P?rrafo 1 - aparece cuando step >= 1 */}
          {step >= 1 && (
            <div 
              key={`p1-${lang}`}
              className={`opacity-90 mb-6 copy-lg text-center max-w-3xl preloader-tw ${step >= 2 ? 'hide-cursor' : ''}`} 
              style={{ whiteSpace: 'pre-line' }}
            >
              <Typewriter
                options={{
                  cursor: '|',
                  delay: 10,
                }}
                onInit={(typewriter) => {
                  typewriter
                    .pauseFor(200)
                    .typeString(t('pre.p1'))
                    .callFunction(() => setStep(2))
                    .start()
                }}
              />
            </div>
          )}
          
          {/* P?rrafo 2 - aparece cuando step >= 2 */}
          {step >= 2 && (
            <div 
              key={`p2-${lang}`}
              className={`opacity-90 mb-6 copy-lg text-center max-w-3xl preloader-tw ${step >= (hasP3 ? 3 : 4) ? 'hide-cursor' : ''}`} 
              style={{ whiteSpace: 'pre-line' }}
            >
              <Typewriter
                options={{
                  cursor: '|',
                  delay: 10,
                }}
                onInit={(typewriter) => {
                  typewriter
                    .pauseFor(200)
                    .typeString(t('pre.p2'))
                    .callFunction(() => setStep(hasP3 ? 3 : 4))
                    .start()
                }}
              />
            </div>
          )}
          
          {/* P?rrafo 3 (opcional) - aparece cuando step >= 3 */}
          {step >= 3 && hasP3 && (
            <div 
              key={`p3-${lang}`}
              className={`opacity-90 mb-6 copy-lg text-center max-w-3xl preloader-tw ${step >= 4 ? 'hide-cursor' : ''}`} 
              style={{ whiteSpace: 'pre-line' }}
            >
              <Typewriter
                options={{
                  cursor: '|',
                  delay: 10,
                }}
                onInit={(typewriter) => {
                  typewriter
                    .pauseFor(200)
                    .typeString(p3Text)
                    .callFunction(() => setStep(4))
                    .start()
                }}
              />
            </div>
          )}
          
          {/* Botones de control */}
          <div className="mt-8 flex flex-col items-center gap-5">
            {/* Selector de idioma - siempre visible (ENG izquierda, ESP derecha) */}
            <div className="inline-flex items-center justify-center gap-3" role="group" aria-label={t('common.switchLanguage')}>
              <button
                type="button"
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
                className={`h-11 px-5 rounded-full text-sm font-bold uppercase tracking-wide border transition-colors ${lang === 'en' ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/60 hover:bg-white/10'}`}
                title={t('common.langEn')}
              >{t('common.langEn')}</button>
              <button
                type="button"
                onClick={() => setLang('es')}
                aria-pressed={lang === 'es'}
                className={`h-11 px-5 rounded-full text-sm font-bold uppercase tracking-wide border transition-colors ${lang === 'es' ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/60 hover:bg-white/10'}`}
                title={t('common.langEs')}
              >{t('common.langEs')}</button>
            </div>
            {/* Boton ENTER - solo visible cuando la carga visual esta completa */}
            {visualProgress >= 100 && (
              <button
                type="button"
                onClick={() => {
                  try { setAudioReady(true) } catch {}
                  try { exitToHomeLikeExitButton('preloader') } catch {}
                }}
                className="inline-flex items-center justify-center px-10 py-5 md:px-12 md:py-6 rounded-full bg-white text-black font-bold uppercase tracking-wide text-xl md:text-2xl shadow-lg hover:shadow-xl hover:translate-y-[-2px] active:translate-y-0 transition-all font-marquee animate-fade-in-up"
                aria-label={t('common.enterWithSound')}
              >{t('pre.enter')}</button>
            )}
          </div>
        </div>
      </div>
      
      {/* Barra de loading en la parte inferior */}
      <div className="absolute bottom-6 left-6 right-6">
        {/* Texto de loading con memorias random o mensaje de completado */}
        <div className="text-center mb-3 text-sm font-mono tracking-wide" style={{ color: loadComplete ? '#22c55e' : 'rgba(255,255,255,0.5)' }}>
          {loadComplete ? 'Memories loaded successfully.' : `Loading ${loadingText}...`}
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden>
          <div 
            className="h-full rounded-full"
            style={{ 
              width: `${visualProgress}%`, 
              backgroundColor: loadComplete ? '#22c55e' : '#eab308',
              transition: loadComplete ? 'none' : 'width 50ms linear',
              boxShadow: loadComplete 
                ? `0 0 ${blinkCount % 2 === 0 ? '12px' : '4px'} rgba(34, 197, 94, ${blinkCount % 2 === 0 ? '0.8' : '0.3'})`
                : '0 0 8px rgba(234, 179, 8, 0.5)',
              opacity: loadComplete && blinkCount < 8 ? (blinkCount % 2 === 0 ? 1 : 0.4) : 1,
            }} 
          />
        </div>
      </div>
    </div>
  )
}