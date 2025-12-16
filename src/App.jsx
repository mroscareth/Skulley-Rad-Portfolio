import React, { useRef, useState, useMemo, Suspense, lazy, useEffect } from 'react'
import gsap from 'gsap'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Environment from './components/Environment.jsx'
import { AdaptiveDpr, useGLTF, useAnimations, TransformControls, Html, ContactShadows } from '@react-three/drei'
import html2canvas from 'html2canvas'
// import DomRippleOverlay from './components/DomRippleOverlay.jsx'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import PauseFrameloop from './components/PauseFrameloop.jsx'
import Player from './components/Player.jsx'
import HomeOrbs from './components/HomeOrbs.jsx'
import Portal from './components/Portal.jsx'
import CameraController from './components/CameraController.jsx'
import TransitionOverlay from './components/TransitionOverlay.jsx'
import CharacterPortrait from './components/CharacterPortrait.jsx'
import PowerBar from './components/PowerBar.jsx'
import PostFX from './components/PostFX.jsx'
import Section1 from './components/Section1.jsx'
import FollowLight from './components/FollowLight.jsx'
import PortalParticles from './components/PortalParticles.jsx'
import MusicPlayer from './components/MusicPlayer.jsx'
import MobileJoystick from './components/MobileJoystick.jsx'
// Removed psycho/dissolve overlays
import { MusicalNoteIcon, XMarkIcon, Bars3Icon, ChevronUpIcon, ChevronDownIcon, HeartIcon } from '@heroicons/react/24/solid'
import GpuStats from './components/GpuStats.jsx'
import FrustumCulledGroup from './components/FrustumCulledGroup.jsx'
import { playSfx, preloadSfx } from './lib/sfx.js'
import NoiseTransitionOverlay from './components/NoiseTransitionOverlay.jsx'
import ScreenFadeOverlay from './components/ScreenFadeOverlay.jsx'
import ImageMaskTransitionOverlay from './components/ImageMaskTransitionOverlay.jsx'
import ImageRevealMaskOverlay from './components/ImageRevealMaskOverlay.jsx'
import GridRevealOverlay from './components/GridRevealOverlay.jsx'
import { useLanguage } from './i18n/LanguageContext.jsx'
import GlobalCursor from './components/GlobalCursor.jsx'
// (Tumba removida)
const Section2 = lazy(() => import('./components/Section2.jsx'))
const Section3 = lazy(() => import('./components/Section3.jsx'))
const Section4 = lazy(() => import('./components/Section4.jsx'))

// URLs de imágenes críticas de WORK (evitar importar Section1.jsx)
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

// Sombras de contacto (mejoran mucho la “pegada” al piso).
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
        // r182: el shadow mapping principal está modernizado; aquí complementamos con “contact”
        opacity={lowPerf ? 0.35 : 0.5}
        scale={lowPerf ? 4.5 : 6.0}
        blur={lowPerf ? 1.6 : 2.8}
        far={lowPerf ? 5.0 : 7.0}
        resolution={lowPerf ? 256 : 1024}
        color={'#000000'}
        frames={Infinity}
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
    // Warp líquido
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
  const glRef = useRef(null)
  const [degradedMode, setDegradedMode] = useState(false)
  const [showMusic, setShowMusic] = useState(false)
  const [socialsOpen, setSocialsOpen] = useState(false)
  const [showGpu, setShowGpu] = useState(false)
  const [tracks, setTracks] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const mobileMenuIds = ['section1', 'section2', 'section3', 'section4'] // Work, About, Store, Contact
  // Animación de menú overlay (mobile): mantener montado mientras sale
  const MENU_ANIM_MS = 260
  // Animación de items: uno detrás de otro (bien visible)
  const MENU_ITEM_IN_MS = 260
  const MENU_ITEM_OUT_MS = 200
  const MENU_ITEM_STEP_MS = 100 // delay entre inicios de cada botón
  const [menuVisible, setMenuVisible] = useState(false)
  const menuAnimTimerRef = useRef(null)
  const openMenuAnimated = React.useCallback(() => {
    try { if (menuAnimTimerRef.current) { clearTimeout(menuAnimTimerRef.current); menuAnimTimerRef.current = null } } catch {}
    setMenuOpen(true)
    // Activar inmediatamente: usamos keyframes con fill-mode para que el delay aplique el estado inicial
    setMenuVisible(true)
  }, [])
  const closeMenuAnimated = React.useCallback(() => {
    // Si ya está cerrado o no montado, no hacer nada
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
  const showDebugUi = import.meta.env.DEV
  // Noise-mask transition (prev -> next)
  const [prevSceneTex, setPrevSceneTex] = useState(null)
  const [noiseMixEnabled, setNoiseMixEnabled] = useState(false)
  const [noiseMixProgress, setNoiseMixProgress] = useState(0)
  const rippleMixRef = useRef({ v: 0 })
  

  async function captureCanvasFrameAsTexture() {
    try {
      const gl = glRef.current
      if (!gl || !gl.domElement) return null
      // Esperar 2 frames para asegurar que el canvas tenga el último frame dibujado
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const src = gl.domElement
      // Snapshot sincrónico: copiar a un canvas 2D offscreen y crear CanvasTexture
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
  // Captura del framebuffer WebGL a textura vía GPU (evita CORS/taint del canvas 2D)
  async function captureCanvasFrameAsTextureGPU() {
    try {
      const renderer = glRef.current
      if (!renderer) return null
      // Asegurar que el frame actual esté listo
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
        // usar tamaño físico del canvas principal para mantener nitidez
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
  // Captura rápida del canvas WebGL principal a dataURL (sin html2canvas)
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
  // Captura del framebuffer WebGL a DataTexture vía CPU (readPixels) para usar en otro Canvas
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

  // (Deprecated) DOM-level ripple overlay — sustituido por alpha-mask en postFX
  const [domRippleActive, setDomRippleActive] = useState(false)
  const [domPrevSrc, setDomPrevSrc] = useState(null)
  const [domNextSrc, setDomNextSrc] = useState(null)
  const domRippleProgRef = useRef({ v: 0 })
  const [domRippleProgress, setDomRippleProgress] = useState(0)
  // Nueva transición overlay con máscara de ruido (A/B por dataURL)
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
  // Tiempos homogéneos de retícula (ajuste fino global)
  const GRID_IN_MS = 280
  const GRID_OUT_MS = 520
  const GRID_DELAY_MS = 460

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
      // En error, no bloquees transición
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
    // Capturar frame actual para overlay de disolución (no bloquear timeline)
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
      // Fondo oscuro: baja la viñeta para que el efecto se note más
      vignette: Math.max(0.18, v.vignette - 0.18),
      // Arranque de color ácido
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
    // Timeline de disolución (overlay DOM): 0 → 1
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
    // Limpiar overlay de disolución
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
  // "Modo compacto" debe activarse por viewport O por dispositivo (iPad/Tesla)
  const isCompactUi = Boolean(isHamburgerViewport || isIpadDevice || isTeslaBrowser)
  // Safe insets dinámicos para la barra de poder horizontal (evita tocar retrato y botones)
  const [powerSafeInsets, setPowerSafeInsets] = useState({ left: 16, right: 16 })
  // UI de secciones scrolleables
  const [showSectionUi, setShowSectionUi] = useState(false)
  const [sectionUiAnimatingOut, setSectionUiAnimatingOut] = useState(false)
  const [sectionUiFadeIn, setSectionUiFadeIn] = useState(false)
  const sectionScrollRef = useRef(null)
  // Lock de arranque en WORK para evitar cualquier movimiento visible hasta centrar
  const workInitLockRef = useRef(false)
  // Habilita el snapping SOLO después de una interacción del usuario
  const snapEnabledRef = useRef(false)
  // Bloqueo de scroll del contenedor (overflow hidden) durante el centrado inicial
  const [lockScroll, setLockScroll] = useState(false)
  // Congelar rewrap interno de Section1 hasta interacción del usuario
  const [freezeWorkWrap, setFreezeWorkWrap] = useState(false)
  // Pin de tarjeta: mientras esté activo, forzamos la tarjeta i=0 (Heritage) en el centro
  const pinIndexRef = useRef(null) // 0 = Heritage fijado; null = libre
  const pinningRef = useRef(false) // reentrancia para evitar bucles en onScroll
  // Hint temporal para reactivar CTA/marquee al volver a HOME
  const [uiHintPortalId, setUiHintPortalId] = useState(null)
  const uiHintTimerRef = useRef(null)
  // Track which section is currently active (home by default)
  const [section, setSection] = useState('home')
  // Track transition state; when active we animate the shader and then switch sections
  const [transitionState, setTransitionState] = useState({ active: false, from: 'home', to: null })
  // Mantener el clearAlpha en 0 cuando usamos máscara alpha (prevSceneTex == null && noiseMixEnabled)
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
  // Transición “alpha-mask ripple” en compositor (sin snapshots)
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
    // Montar UI de sección debajo del canvas, sin fade propio (la máscara controla el reveal)
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
  // Transición overlay con máscara de ruido (A/B) usando capturas del canvas GL
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
    // Diferimos el centrado hasta justo antes de revelar la UI para evitar “brinco”
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
              // Un RAF más y hacer fade‑in
              requestAnimationFrame(() => {
                setSectionUiFadeIn(true)
                // Liberar lock y mantener snapping desactivado hasta interacción
                if (toId === 'section1') setTimeout(() => {
                  try { workInitLockRef.current = false } catch {}
                  try { snapInProgressRef.current = false } catch {}
                  try { setLockScroll(false) } catch {}
                  // snapEnabledRef.current se activará con wheel/touch/tecla o botones
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
  // Transición simple: fade in/out (modo negro o noise)
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
        // Preparar UI de destino; el centrado de WORK se hace explícitamente para evitar brinco
        if (toId !== 'home') {
          workInitLockRef.current = (toId === 'section1')
          setShowSectionUi(true)
          setSectionUiFadeIn(false)
          setSectionUiAnimatingOut(false)
          // Cancelar snap pendiente y bloquear snaps durante el centrado inicial si vamos a WORK
          try { if (typeof snapTimerRef !== 'undefined' && snapTimerRef?.current) clearTimeout(snapTimerRef.current) } catch {}
          if (toId === 'section1') { try { snapInProgressRef.current = true; snapEnabledRef.current = false; setLockScroll(true); setFreezeWorkWrap(true) } catch {} }
          // Esperar layout estable y centrar antes del fade‑in
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try { scrollToFirstWorkCardImmediate() } catch {}
              requestAnimationFrame(() => {
                setSectionUiFadeIn(true)
                if (toId === 'section1') setTimeout(() => {
                  try { workInitLockRef.current = false } catch {}
                  try { snapInProgressRef.current = false } catch {}
                  try { setLockScroll(false) } catch {}
                  // snapEnabledRef.current se activará con wheel/touch/tecla o botones
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
                  // snapEnabledRef.current se activará con wheel/touch/tecla o botones
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
  // Grid reveal: cubrir con cuadrícula (fase IN), cambiar a B, descubrir con cuadrícula (fase OUT)
  const beginGridRevealTransition = React.useCallback(async (toId, { center, cellSize = 64, inDurationMs = GRID_IN_MS, outDurationMs = GRID_OUT_MS, delaySpanMs = GRID_DELAY_MS } = {}) => {
    if (!toId || transitionState.active) return
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    const cx = Math.min(1, Math.max(0, center?.[0] ?? 0.5))
    const cy = Math.min(1, Math.max(0, center?.[1] ?? 0.5))
    // Fase IN: cubrir (de 0->1)
    setGridCenter([cx, 1 - cy]) // adaptar a coords CSS (top-left origin)
    setGridPhase('in'); setGridOverlayActive(true); setGridKey((k) => k + 1)
    const fromHome = section === 'home'
    const goingWork = toId === 'section1'
    // Resetea scroll inmediatamente al iniciar la transición solo si no vamos a WORK
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
            // Espera extra al entrar desde HOME para evitar ver HOME 1 frame durante el reveal
            const holdMs = fromHome ? 80 : 0
            window.setTimeout(() => {
              setGridPhase('out'); setGridKey((k) => k + 1)
              const totalOut = outDurationMs + delaySpanMs + 40
              window.setTimeout(() => {
                setGridOverlayActive(false)
                setTransitionState({ active: false, from: toId, to: null })
              }, totalOut)
            }, holdMs)
          }

          if (goingWork) {
            // Bloquear wrap y snap mientras centramos antes de mostrar para evitar “brinco”
            workInitLockRef.current = true
            setShowSectionUi(true)
            setSectionUiFadeIn(false)
            // Cancelar cualquier snap pendiente (por si algo se programó durante el cambio)
            try { if (snapTimerRef?.current) clearTimeout(snapTimerRef.current) } catch {}
            try { snapInProgressRef.current = true; snapEnabledRef.current = false; setLockScroll(true); setFreezeWorkWrap(true) } catch {}
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                try { scrollToFirstWorkCardImmediate() } catch {}
                requestAnimationFrame(() => {
                  try { scrollToFirstWorkCardImmediate() } catch {}
                  setSectionUiFadeIn(true)
                  // Una vez que WORK está listo para ser visto, arrancar OUT
                  requestAnimationFrame(() => startOut())
                  setTimeout(() => {
                    try { workInitLockRef.current = false } catch {}
                    try { snapInProgressRef.current = false } catch {}
                    try { setLockScroll(false) } catch {}
                    // snapEnabledRef.current se activará con wheel/touch/tecla o botones
                  }, 600)
                })
              })
            })
          } else {
            try { sectionScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) } catch {}
            setShowSectionUi(true)
            setSectionUiFadeIn(true)
            setSectionUiAnimatingOut(false)
            // Esperar a que React pinte el destino antes de revelar el centro (2 RAF)
            requestAnimationFrame(() => requestAnimationFrame(() => startOut()))
          }
        } else {
          setShowSectionUi(false)
          setSectionUiAnimatingOut(false)
          setSectionUiFadeIn(false)
          // Si vamos a HOME, esperamos 2 RAF antes de OUT para evitar “flash” del canvas
          requestAnimationFrame(() => requestAnimationFrame(() => {
            setGridPhase('out'); setGridKey((k) => k + 1)
            const totalOut = outDurationMs + delaySpanMs + 40
            window.setTimeout(() => {
              setGridOverlayActive(false)
              setTransitionState({ active: false, from: toId, to: null })
            }, totalOut)
          }))
        }
      } catch {}
    }, totalIn)
    setTransitionState({ active: true, from: section, to: toId })
  }, [section, transitionState.active])
  // Iniciar transición ripple: capturar prev, animar mix y cambiar sección a mitad
  const beginRippleTransition = React.useCallback(async (toId) => {
    if (!toId || transitionState.active) return
    // Garantizar que no haya blackout sobre la transición
    try { setBlackoutImmediate(false); setBlackoutVisible(false) } catch {}
    // Capturar A (frame actual del canvas) vía GPU (fallback a 2D si aplica)
    let tex = await captureCanvasFrameAsTextureGPU()
    if (!tex) {
      tex = await captureCanvasFrameAsTexture()
    }
    if (tex) setPrevSceneTex(tex)
    // Activar inmediatamente la nueva sección (B) bajo la máscara
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
      // Mostrar u ocultar UI de sección según destino
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
    // Forzar modo máscara (sin snapshot A) para revelar B bajo el canvas por alpha
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
        // cerrar estado de transición si estuviera abierto
        setTransitionState({ active: false, from: toId, to: null })
      },
    })
    // Abrir estado de transición para bloquear UI si fuese necesario
    setTransitionState({ active: true, from: section, to: toId })
  }, [section, transitionState.active])
  // (Desactivado) La transición ripple se gestiona exclusivamente por beginRippleTransition
  // useEffect(() => { ... }, [transitionState.active])
  const handleExitSection = React.useCallback(() => {
    if (transitionState.active) return
    if (section !== 'home') {
      // 1) Mostrar PRIMERO la retícula (frame 0) para cubrir por encima de todo
      setGridCenter([0.5, 0.5])
      setGridPhase('in')
      setGridOverlayActive(true)
      setGridKey((k) => k + 1)
      // 2) Tras finalizar IN (pantalla cubierta), hacer el cleanup + switch a HOME y lanzar OUT
      const totalIn = GRID_IN_MS + GRID_DELAY_MS + 40
      window.setTimeout(() => {
        // Registrar salida
        try { lastExitedSectionRef.current = section } catch {}
        // Ocultar UI/CTA/Marquee y limpiar timers/estados (ya no se ve nada detrás)
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
        // Switch a HOME y lanzar OUT
        setNavTarget('home')
        setSection('home')
        try { syncUrl('home') } catch {}
        setGridPhase('out'); setGridKey((k) => k + 1)
        const totalOut = GRID_OUT_MS + GRID_DELAY_MS + 40
        window.setTimeout(() => { setGridOverlayActive(false) }, totalOut)
      }, totalIn)
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
  const [showPreloaderOverlay, setShowPreloaderOverlay] = useState(true)
  const preloaderStartedRef = useRef(false)
  const preloaderHideTimerRef = useRef(null)
  const preloaderGridOutPendingRef = useRef(false)
  const gridOutTimerRef = useRef(null)
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

  // Cerrar preloader cuando TODO + personaje listos + audio desbloqueado.
  // Sólo disparamos caída/intro hacia HOME si la sección actual es HOME.
  useEffect(() => {
    if (!bootAllDone || !audioReady) return
    if (preloaderStartedRef.current) return
    preloaderStartedRef.current = true
    setBootProgress(100)
    const t = setTimeout(() => {
      // Transición de retícula: IN → apagar preloader → OUT revelando HOME
      setGridCenter([0.5, 0.5])
      setGridPhase('in')
      setGridOverlayActive(true)
      setGridKey((k) => k + 1)
      const totalIn = GRID_IN_MS + GRID_DELAY_MS + 40
      window.setTimeout(() => {
        // Mantener retícula cubierta; montar HOME por detrás, pero NO revelar hasta onHomeFallStart
        preloaderGridOutPendingRef.current = true
        setBootLoading(false) // monta canvas principal / HOME
        try { setNavTarget('home') } catch {}
        // Apagar overlay del preloader por detrás (sin que se vea porque la retícula cubre)
        setPreloaderFadingOut(true)
        try {
          if (preloaderHideTimerRef.current) clearTimeout(preloaderHideTimerRef.current)
        } catch {}
        preloaderHideTimerRef.current = window.setTimeout(() => {
          setShowPreloaderOverlay(false)
          setPreloaderFadingOut(false)
          preloaderHideTimerRef.current = null
        }, 1000)
      }, totalIn)
    }, 180)
    return () => clearTimeout(t)
  }, [bootAllDone, audioReady, section])
  // Custom scrollbar (Work sections): dynamic thumb + drag support + snap buttons
  const scrollTrackRef = useRef(null)
  const [scrollThumb, setScrollThumb] = useState({ height: 12, top: 0 })
  const isDraggingThumbRef = useRef(false)
  const snapTimerRef = useRef(null)
  const snapInProgressRef = useRef(false)
  const controlledScrollRef = useRef(false)
  const workReadyRef = useRef(false)
  const [workReady, setWorkReady] = useState(false)
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

  // Detectar el breakpoint de hamburguesa (≤1100px) para alinear UI (música + idioma)
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
        // Fallbacks (si aún no hay DOM estable): retrato ≈ 7.2rem + left-4, controles ≈ 48px + right-4
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
  // y mostrar la UI solo después del centrado para evitar el “brinco”.
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
      // Asegurar que el contenido de Section1 esté montado antes de centrar
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
      const offset = Math.round((navHeight || 0) / 2)
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
      const offset = Math.round((navHeight || 0) / 2)
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
      const offset = Math.round((navHeight || 0) / 2)
      const targetScroll = Math.max(0, Math.round(best.c - (scroller.clientHeight || 0) / 2 - offset))
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
      // Elegir la réplica más cercana al centro actual para evitar saltos grandes
      let best = { el: null, d: Infinity, c: 0 }
      for (const el of cards0) {
        const r = el.getBoundingClientRect()
        const c = (scroller.scrollTop || 0) + (r.top - sRect.top) + (r.height / 2)
        const d = Math.abs(c - viewCenter)
        if (d < best.d) best = { el, d, c }
      }
      if (!best.el) return
      const offset = Math.round((navHeight || 0) / 2)
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
      // Posición inicial determinista: usar SIEMPRE el primer ancla i=0
      const sRect = scroller.getBoundingClientRect()
      const first = cards0[0]
      const rr = first.getBoundingClientRect()
      const center = (rr.top - sRect.top) + (rr.height / 2)
      const offset = Math.round((navHeight || 0) / 2)
      const targetScroll = Math.max(0, Math.round(center - (scroller.clientHeight || 0) / 2 - offset))
      // Suprimir “wrap”/snap durante el posicionamiento inicial
      controlledScrollRef.current = true
      workReadyRef.current = false
      try { setWorkReady(false) } catch {}
      scroller.scrollTop = targetScroll
      // Corrección fina: medir y ajustar el delta para que el centro visual sea exacto
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
        controlledScrollRef.current = false
        workReadyRef.current = true
        try { setWorkReady(true) } catch {}
      }
      requestAnimationFrame(refine)
    } catch {}
  }, [section])

  // Forzar centrado en múltiples ticks para cubrir variaciones de layout (fonts/images/resize)
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

  // Re-centrar una vez que la altura de la nav inferior esté medida (evita desalineo inicial)
  useEffect(() => {
    try {
      if (section !== 'section1') return
      if (!showSectionUi) return
      if (workSimpleMode) return
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
        // Nunca resetear scroll cuando vamos a WORK para evitar saltos
        try {
          if (sectionScrollRef.current && section !== 'section1') {
            sectionScrollRef.current.scrollTop = 0
          }
        } catch {}
        // Section1 se centrará sola (seed) en Heritage, sin animación
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
  const [score, setScore] = useState(0)
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
      beginSimpleFadeTransition(target, { mode: 'noise', durationMs: 700 })
    }
  }

  // Called by the TransitionOverlay after the shader animation finishes.  We then
  // update the current section and reset the transition state.
  const handleTransitionComplete = () => {
    // Finalizar efectos psicodélicos
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
  // Durante efecto psicodélico, aclara el fondo para no “comerse” el warp
  const psychoSceneColor = fx.psychoEnabled ? lightenHexColor(effectiveSceneColor, 0.45) : effectiveSceneColor

  // IMPORTANTE: evitar overlays invisibles que bloqueen el drag del canvas.
  // La UI de secciones puede estar montada con opacity=0 (ej. WORK antes de workReady).
  // En ese caso, debe tener pointer-events: none.
  const sectionUiCanInteract = (showSectionUi && !sectionUiAnimatingOut && !(section === 'section1' && !workReady))

  

  return (
    <div className={`w-full h-full relative overflow-hidden ${(isCompactUi && section === 'home') ? 'home-touch-no-select' : ''}`}>
      {/* The main WebGL canvas */}
      {!bootLoading && (
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, pageHidden ? 1.0 : (degradedMode ? 1.1 : (isMobilePerf ? 1.1 : 1.3))]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false, preserveDrawingBuffer: true }}
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
            // Mobile: permitir drag para OrbitControls (evita que el navegador capture gestos y “mate” el rotate)
            el.style.touchAction = 'none'
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
          <PauseFrameloop paused={(((showSectionUi || sectionUiAnimatingOut) && !transitionState.active && !noiseMixEnabled) || pageHidden)} />
          <Environment overrideColor={psychoSceneColor} lowPerf={isMobilePerf} transparentBg={prevSceneTex == null && noiseMixEnabled} />
          {/* Ancla para God Rays (oculta cuando no está activo y sin escribir depth) */}
          {fx.godEnabled && (
            <mesh ref={sunRef} position={[0, 8, 0]}>
              <sphereGeometry args={[0.35, 12, 12]} />
              <meshBasicMaterial color={'#ffffff'} transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
          {/* Esferas luminosas con física en HOME */}
          {section === 'home' && (
            <HomeOrbs
              ref={homeOrbsRef}
              playerRef={playerRef}
              active={section === 'home'}
              num={10}
              portals={portals}
              portalRadius={2}
              onScoreDelta={(delta) => { try { setScore((s) => s + delta) } catch {} }}
            />
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
              // PRELOADER: revelar HOME EXACTAMENTE al iniciar la caída
              try {
                if (preloaderGridOutPendingRef.current) {
                  preloaderGridOutPendingRef.current = false
                  setGridPhase('out'); setGridKey((k) => k + 1)
                  const totalOut = GRID_OUT_MS + GRID_DELAY_MS + 40
                  try { if (gridOutTimerRef.current) clearTimeout(gridOutTimerRef.current) } catch {}
                  gridOutTimerRef.current = window.setTimeout(() => {
                    setGridOverlayActive(false)
                    gridOutTimerRef.current = null
                  }, totalOut)
                }
              } catch {}
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
            onPulse={(pos, strength, radius) => {
              try { homeOrbsRef.current?.radialImpulse(pos, strength, radius) } catch {}
            }}
            onActionCooldown={(r) => { try { setActionCooldown(r) } catch {} }}
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
          {/* Sombras de contacto bajo el jugador (mejor lectura y menos “flotante”) */}
          <PlayerContactShadows
            playerRef={playerRef}
            enabled={!pageHidden && !transitionState.active && !noiseMixEnabled}
            lowPerf={Boolean(degradedMode || isMobilePerf)}
          />
          {/* Tumba removida */}
          <FollowLight
            playerRef={playerRef}
            height={topLight.height}
            intensity={topLight.intensity}
            angle={topLight.angle}
            penumbra={topLight.penumbra}
            color={'#fff'}
            lowPerf={Boolean(degradedMode || isMobilePerf)}
          />
          {portals.map((p) => {
            const mix = portalMixMap[p.id] || 0
            const targetColor = sectionColors[p.id] || '#ffffff'
            return (
            <FrustumCulledGroup key={p.id} position={p.position} radius={4.5} maxDistance={64} sampleEvery={4}>
              <Portal position={[0,0,0]} color={p.color} targetColor={targetColor} mix={mix} size={2} flicker={p.id === 'section3'} flickerKey={section} />
              <PortalParticles center={[0,0,0]} radius={4} count={isMobilePerf ? 120 : 220} color={'#9ec6ff'} targetColor={targetColor} mix={mix} playerRef={playerRef} frenzyRadius={10} />
            </FrustumCulledGroup>
            )
          })}
          {/*
            Power ready (charge ≈ 100%):
            actionCooldown se usa como canal (1 - charge). Cuando llega cerca de 0,
            el fill de la barra (1 - actionCooldown) está casi al 100%.
          */}
          {(() => {
            // Umbral alineado con glowOn de la barra
            const powerReady = (Math.max(0, Math.min(1, 1 - actionCooldown)) >= 0.98)
            const wantShake = powerReady && section === 'home'
            // Si el jugador está moviéndose, evitamos mareo visual; al soltar/quedarse quieto, sí tiembla.
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
                // Easter egg: shake más sutil para no marear
                shakeAmplitude={amp}
                shakeFrequencyX={fxX}
                shakeFrequencyY={fxY}
                shakeYMultiplier={yMul}
                // Permitir rotación siempre en HOME; en secciones UI se bloquea
                enabled={section === 'home' ? true : (!showSectionUi && !sectionUiAnimatingOut)}
                // Mobile: comportamiento idéntico a desktop (solo cambia el input: joystick)
                followBehind={false}
              />
            )
          })()}
          {/* Mantengo sólo el shake vía target para no interferir con OrbitControls */}
          {/* Perf can be used during development to monitor FPS; disabled by default. */}
          {/* <Perf position="top-left" /> */}
          {/* Postprocessing effects */}
          <PostFX
            lowPerf={Boolean(pageHidden || degradedMode || isMobilePerf)}
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
          />
          {/* Desactivado: el crossfade/overlay se reemplaza por RippleDissolveMix final */}
        </Suspense>
      </Canvas>
      )}

      {/* (Efectos DOM removidos a petición del usuario) */}

      {/* Preloader overlay global */}
      {showPreloaderOverlay && (
        <div
          className={`fixed inset-0 z-[20000] bg-[#0a0f22] text-white ${preloaderFadingOut ? 'pointer-events-none' : 'pointer-events-auto'}`}
          role="dialog"
          aria-modal="true"
          style={{ opacity: preloaderFadingOut ? 0 : 1, transition: 'opacity 1000ms ease' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full">
            {/* Izquierda: personaje caminando (oculto en mobile) */}
            <div className="hidden md:block relative overflow-hidden">
              <div className="absolute inset-0">
                <Canvas dpr={[1, 1.2]} camera={{ position: [0, 1.6, 4], fov: 55, near: 0.1, far: 120 }} gl={{ antialias: false, powerPreference: 'high-performance', alpha: true }}>
                  {/* For regular screenshot reliability we keep the main canvas preserveDrawingBuffer; preloader can keep default */}
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
                    psychoEnabled={fx.psychoEnabled}
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
                <h1 className="font-marquee uppercase text-[2.625rem] sm:text-[3.15rem] md:text-[4.2rem] leading-[0.9] tracking-wide mb-4" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.08)' }}>{t('pre.title')}</h1>
                <p className="opacity-90 mb-6 copy-lg" style={{ whiteSpace: 'pre-line' }}>{t('pre.p1')}</p>
                <p className="opacity-90 mb-6 copy-lg" style={{ whiteSpace: 'pre-line' }}>{t('pre.p2')}</p>
                {(() => { const v = t('pre.p3'); return (v && v !== 'pre.p3') ? (<p className="opacity-90 mb-6 copy-lg" style={{ whiteSpace: 'pre-line' }}>{v}</p>) : null })()}
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
                    <div className="inline-flex items-center gap-2" role="group" aria-label={t('common.switchLanguage')}>
                      <button
                        type="button"
                        onClick={() => setLang('es')}
                        aria-pressed={lang === 'es'}
                        className={`h-12 px-5 rounded-full text-sm sm:text-base font-bold uppercase tracking-wide border transition-colors ${lang === 'es' ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/60 hover:bg-white/10'}`}
                        title={t('common.langEs')}
                      >{t('common.langEs')}</button>
                      <button
                        type="button"
                        onClick={() => setLang('en')}
                        aria-pressed={lang === 'en'}
                        className={`h-12 px-5 rounded-full text-sm sm:text-base font-bold uppercase tracking-wide border transition-colors ${lang === 'en' ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/60 hover:bg-white/10'}`}
                        title={t('common.langEn')}
                      >{t('common.langEn')}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showDebugUi && showGpu && <GpuStats sampleMs={1000} gl={glRef.current} />}
      {/* Overlay global negro desactivado para no tapar la animación de HOME */}
      {/* Secciones scrolleables con transición suave y fondo por sección */}
      {(showSectionUi || sectionUiAnimatingOut) && (
        <div
          ref={sectionScrollRef}
          className={`fixed inset-0 z-[10] overflow-y-auto no-native-scrollbar ${sectionUiCanInteract ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            backgroundColor: sectionColors[section] || '#000000',
            overflowAnchor: 'none',
            overflowY: (lockScroll ? 'hidden' : 'auto'),
            // Forzar oculta en WORK hasta que el centrado inicial esté listo (evita "brinco")
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
            scrollSnapType: (section === 'section1' ? 'y mandatory' : undefined),
            scrollSnapStop: (section === 'section1' ? 'always' : undefined),
          }}
          onWheel={() => { try { if (section === 'section1') { snapEnabledRef.current = true; setFreezeWorkWrap(false) } } catch {} }}
          onTouchStart={() => { try { if (section === 'section1') { snapEnabledRef.current = true; setFreezeWorkWrap(false) } } catch {} }}
          onScroll={(e) => {
            try {
              const el = e.currentTarget
              const max = Math.max(1, el.scrollHeight - el.clientHeight)
              setSectionScrollProgress(el.scrollTop / max)
              updateScrollbarFromScroll()
              // En WORK, habilitar wrap/snap sólo cuando el carrusel esté listo y NO en modo simple
              if (section === 'section1' && workReadyRef.current && !workSimpleMode) {
                if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
                ensureInfiniteScroll()
                snapTimerRef.current = setTimeout(() => {
                  if (!snapInProgressRef.current) snapToNearestWorkCard()
                }, 240)
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

      {/* CTA: Cruza el portal (aparece cuando el jugador está cerca del portal) */}
      {(
        (showCta || ctaAnimatingOut || ctaLoading)
        && (!transitionState.active || ctaLoading)
        && !domRippleActive
        && !ctaForceHidden
        && !blackoutVisible
        && (((section === 'home') && !showSectionUi && !sectionUiAnimatingOut) || ctaLoading)
      ) && (
        <div
          // Siempre centrado en pantalla (como en mobile) en todos los tamaños
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
              // Transición de cuadrícula desde el centro
              beginGridRevealTransition(target, { center: [0.5, 0.5], cellSize: 40, inDurationMs: 260, outDurationMs: 520, delaySpanMs: 420 })
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
            <span
              // Evitar “mordido” de la tipografía (Luckiest Guy) dentro de overflow-hidden
              // sin cambiar el look: mantenemos el mismo tamaño pero damos un pelín de line-height/padding.
              // Nota: `truncate` aplica overflow-hidden y puede recortar la tipografía.
              // Aquí el texto cabe, así que preferimos NO truncar para evitar el clipping vertical.
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
      {/* Floating music + hamburger (modo compacto: viewport o iPad/Tesla) */}
      {isCompactUi && (
      <div ref={compactControlsRef} className="pointer-events-none fixed right-4 bottom-4 z-[16000] flex flex-col items-end gap-3">
        {/* Socials (mobile): colapsados en botón + abanico */}
        <div ref={socialsWrapMobileRef} className="pointer-events-auto relative" style={{ width: '48px', height: '48px', marginRight: `${(scrollbarW || 0)}px` }}>
          {/* Abanico */}
          {[
            { key: 'x', href: 'https://x.com/mroscareth', label: 'X', icon: `${import.meta.env.BASE_URL}x.svg`, dx: -78, dy: -10 },
            { key: 'ig', href: 'https://www.instagram.com/mroscar.eth', label: 'Instagram', icon: `${import.meta.env.BASE_URL}instagram.svg`, dx: -58, dy: -64 },
            { key: 'be', href: 'https://www.behance.net/mroscar', label: 'Behance', icon: `${import.meta.env.BASE_URL}behance.svg`, dx: -10, dy: -78 },
          ].map((s) => (
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
          ))}
          {/* Botón base */}
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
        <button
          type="button"
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setLang(lang === 'es' ? 'en' : 'es') }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          className="pointer-events-auto h-12 w-12 rounded-full bg-white/95 text-black grid place-items-center shadow-md"
          aria-label={t('common.switchLanguage')}
          title={t('common.switchLanguage')}
          style={{ marginRight: `${(scrollbarW || 0)}px` }}
        >
          <span className="font-marquee uppercase tracking-wide text-sm leading-none">{t('nav.langShort')}</span>
        </button>
        <button
          type="button"
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setShowMusic((v) => !v) }}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          className={`pointer-events-auto h-12 w-12 rounded-full grid place-items-center shadow-md transition-colors ${showMusic ? 'bg-black text-white' : 'bg-white/95 text-black'}`}
          aria-pressed={showMusic ? 'true' : 'false'}
          aria-label={t('a11y.toggleMusic')}
          title={showMusic ? t('common.hidePlayer') : t('common.showPlayer')}
          style={{ marginRight: `${(scrollbarW || 0)}px` }}
        >
          <MusicalNoteIcon className="w-6 h-6" />
        </button>
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

      {/* Socials (desktop): alineados con nav (bottom-10) y padding del retrato (right-10) */}
      {!isCompactUi && (
      <div className="pointer-events-none fixed right-10 bottom-10 z-[16000] flex">
        <div ref={socialsWrapDesktopRef} className="pointer-events-auto relative" style={{ width: '44px', height: '44px', marginRight: `${(scrollbarW || 0)}px` }}>
          {/* Abanico */}
          {[
            { key: 'x', href: 'https://x.com/mroscareth', label: 'X', icon: `${import.meta.env.BASE_URL}x.svg`, dx: -68, dy: -8 },
            { key: 'ig', href: 'https://www.instagram.com/mroscar.eth', label: 'Instagram', icon: `${import.meta.env.BASE_URL}instagram.svg`, dx: -50, dy: -50 },
            { key: 'be', href: 'https://www.behance.net/mroscar', label: 'Behance', icon: `${import.meta.env.BASE_URL}behance.svg`, dx: -8, dy: -68 },
          ].map((s) => (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setSocialsOpen(false) }}
              className="absolute right-0 bottom-0 h-10 w-10 rounded-full bg-white/95 text-black grid place-items-center shadow-md transition-all duration-200"
              style={{
                transform: socialsOpen ? `translate(${s.dx}px, ${s.dy}px) scale(1)` : 'translate(0px, 0px) scale(0.9)',
                opacity: socialsOpen ? 1 : 0,
                pointerEvents: socialsOpen ? 'auto' : 'none',
              }}
              aria-label={s.label}
              title={s.label}
            >
              <img src={s.icon} alt="" aria-hidden className="w-5 h-5" draggable="false" />
            </a>
          ))}
          {/* Botón base */}
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
      </div>
      )}

      {/* Desktop nav (solo cuando NO estamos en modo compacto) */}
      {!isCompactUi && (
      <div ref={navRef} className="pointer-events-auto fixed inset-x-0 bottom-10 z-[1200] flex items-center justify-center">
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
                  // En UI de sección, no permitir transición a STORE (coming soon)
                  if (id === 'section3') return
                  if (!transitionState.active && id !== section) {
                    beginGridRevealTransition(id, { center: [0.5, 0.5], cellSize: 40, inDurationMs: 260, outDurationMs: 520, delaySpanMs: 420 })
                    setPortraitGlowV((v) => v + 1)
                  }
                } else {
                  // En HOME: permitir viajar al portal STORE (pero sin abrir sección)
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
            aria-label={t('a11y.toggleMusic')}
            title={showMusic ? t('common.hidePlayer') : t('common.showPlayer')}
          >
            <MusicalNoteIcon className="w-6 h-6" />
          </button>
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
                  // Solo el texto con color por sección (sin “cápsula”)
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
                    // En UI de sección, no permitir transición a STORE (coming soon)
                    if (id === 'section3') return
                  if (!transitionState.active && id !== section) {
                     beginGridRevealTransition(id, { center: [0.5, 0.5], cellSize: 40, inDurationMs: 260, outDurationMs: 520, delaySpanMs: 420 })
                    setPortraitGlowV((v) => v + 1)
                  }
                  } else {
                    // En HOME: permitir viajar al portal STORE (pero sin abrir sección)
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
      {/* Portrait del personaje en cápsula, esquina inferior izquierda (no visible durante preloader) */}
      {!bootLoading && (
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
          zIndex={20000}
          showExit={section !== 'home' && showSectionUi}
          mode={'overlay'}
          actionCooldown={actionCooldown}
          eggEnabled={true}
        />
      )}
      {/* HUD de puntaje — solo visible en HOME y fuera del preloader */}
      {section === 'home' && !bootLoading && (
        <div
          // Score siempre arriba-izquierda, respetando padding del viewport (compact vs desktop)
          className={`fixed z-[30000] pointer-events-none select-none ${isCompactUi ? 'left-4 top-4' : 'left-10 top-10'}`}
        >
          <div
            className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-black/40 text-white shadow-md font-marquee uppercase tracking-wide"
            style={{ WebkitTextStroke: '1px rgba(0,0,0,0.3)' }}
          >
            <span className={`leading-none ${isCompactUi ? 'text-xl' : 'text-2xl'}`}>
              {t('hud.score')}:{' '}
              <span className={score > 0 ? 'text-sky-400' : (score < 0 ? 'text-red-500' : 'text-white')}>
                {score}
              </span>
            </span>
          </div>
        </div>
      )}
      {/* Joystick móvil: visible en el mismo breakpoint del menú hamburguesa (≤1100px),
          en HOME y cuando el orbe no está activo */}
      {((isHamburgerViewport || isIpadDevice || isTeslaBrowser) && section === 'home' && !orbActiveUi) ? (
        (() => {
          // iPad/Tesla deben comportarse visualmente como mobile (layout compacto)
          const isCompactJoystickUi = Boolean(isHamburgerViewport || isIpadDevice || isTeslaBrowser)
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

              {/* UI de poder (barra horizontal + botón Bolt) — mobile/iPad */}
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
                {/* Wrapper relativo para superponer el botón sobre la barra */}
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
      />
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