import React, { useRef, useState, useMemo, Suspense, lazy, useEffect } from 'react'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Environment from './components/Environment.jsx'
import Player from './components/Player.jsx'
import Portal from './components/Portal.jsx'
import CameraController from './components/CameraController.jsx'
import TransitionOverlay from './components/TransitionOverlay.jsx'
import CharacterPortrait from './components/CharacterPortrait.jsx'
import PostFX from './components/PostFX.jsx'
import FollowLight from './components/FollowLight.jsx'
import PortalParticles from './components/PortalParticles.jsx'
import MusicPlayer from './components/MusicPlayer.jsx'
import { MusicalNoteIcon } from '@heroicons/react/24/solid'
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
  section1: '#001aff',
  section2: '#ff0019',
  section3: '#9800de',
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
    bloom: 0.34,
    vignette: 0.4,
    noise: 0,
    dotEnabled: true,
    dotScale: 0.76,
    dotAngle: 0.06,
    dotCenterX: 0.38,
    dotCenterY: 0.44,
    dotOpacity: 0.04,
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
  const [copiedFx, setCopiedFx] = useState(false)
  const [navTarget, setNavTarget] = useState(null)
  const [orbActiveUi, setOrbActiveUi] = useState(false)
  const glRef = useRef(null)
  useEffect(() => {
    if (!glRef.current) return
    const target = orbActiveUi ? 0.9 : (isMobilePerf ? 1.2 : 1.5)
    try { glRef.current.setPixelRatio(target) } catch {}
  }, [orbActiveUi, isMobilePerf])
  const [showMusic, setShowMusic] = useState(false)
  const [tracks, setTracks] = useState([])
  // Track which section is currently active (home by default)
  const [section, setSection] = useState('home')
  // Track transition state; when active we animate the shader and then switch sections
  const [transitionState, setTransitionState] = useState({ active: false, from: 'home', to: null })
  const [eggActive, setEggActive] = useState(false)
  const mainControlsRef = useRef(null)
  const [nearPortalId, setNearPortalId] = useState(null)
  const [showSectionBanner, setShowSectionBanner] = useState(false)
  const bannerTimerRef = useRef(null)
  // CTA y Marquee con animación de salida
  const [showCta, setShowCta] = useState(false)
  const [ctaAnimatingOut, setCtaAnimatingOut] = useState(false)
  const ctaHideTimerRef = useRef(null)
  const [showMarquee, setShowMarquee] = useState(false)
  const [marqueeAnimatingOut, setMarqueeAnimatingOut] = useState(false)
  const marqueeHideTimerRef = useRef(null)
  const [marqueeLabelSection, setMarqueeLabelSection] = useState(null)
  const sectionLabel = useMemo(() => ({
    home: 'HOME',
    section1: 'WORK',
    section2: 'ABOUT',
    section3: 'SIDE QUESTS',
    section4: 'CONTACT',
  }), [])

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
      if (target && target !== section && !transitionState.active) {
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
    if (nearPortalId) {
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
  }, [nearPortalId, transitionState.active, showCta])

  // Control de Marquee con animación de salida
  React.useEffect(() => {
    if (transitionState.active) return
    const shouldShow = Boolean(nearPortalId || showSectionBanner)
    if (shouldShow) {
      setShowMarquee(true)
      setMarqueeAnimatingOut(false)
      // Congelar el label mostrado para evitar parpadeo a HOME durante la salida
      setMarqueeLabelSection(nearPortalId || section)
      if (marqueeHideTimerRef.current) {
        clearTimeout(marqueeHideTimerRef.current)
        marqueeHideTimerRef.current = null
      }
    } else if (showMarquee) {
      setMarqueeAnimatingOut(true)
      if (marqueeHideTimerRef.current) clearTimeout(marqueeHideTimerRef.current)
      marqueeHideTimerRef.current = window.setTimeout(() => {
        setShowMarquee(false)
        setMarqueeAnimatingOut(false)
        marqueeHideTimerRef.current = null
      }, 200)
    }
  }, [nearPortalId, showSectionBanner, transitionState.active, showMarquee, section])

  const [tintFactor, setTintFactor] = useState(0)
  const [portalMixMap, setPortalMixMap] = useState({})
  const baseBg = '#204580'
  const nearColor = '#0a132b'
  function lerpColor(hex1, hex2, t) {
    const c1 = parseInt(hex1.slice(1), 16)
    const c2 = parseInt(hex2.slice(1), 16)
    const r = Math.round(((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t)
    const g = Math.round(((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t)
    const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t)
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  }
  const redEgg = '#7a0b0b'
  const sceneColor = eggActive ? redEgg : lerpColor(baseBg, nearColor, tintFactor)

  

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
          <Environment overrideColor={sceneColor} lowPerf={isMobilePerf} />
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
            onProximityChange={setTintFactor}
            onPortalsProximityChange={setPortalMixMap}
            onNearPortalChange={(id) => setNearPortalId(id)}
            navigateToPortalId={navTarget}
            sceneColor={sceneColor}
            onReachedPortal={(id) => {
              // Solo detener navegación; NO cambiar sección aquí
              setNavTarget(null)
            }}
            onOrbStateChange={(active) => setOrbActiveUi(active)}
          />
          {/* Tumba removida */}
          <FollowLight playerRef={playerRef} height={topLight.height} intensity={topLight.intensity} angle={topLight.angle} penumbra={topLight.penumbra} color={'#fff'} />
          {portals.map((p) => {
            const mix = portalMixMap[p.id] || 0
            const targetColor = sectionColors[p.id] || '#ffffff'
            return (
            <group key={p.id}>
              <Portal position={p.position} color={p.color} targetColor={targetColor} mix={mix} size={2} />
              <PortalParticles center={p.position} radius={4} count={isMobilePerf ? 120 : 220} color={'#9ec6ff'} targetColor={targetColor} mix={mix} playerRef={playerRef} frenzyRadius={10} />
            </group>
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
          />
        </Suspense>
      </Canvas>
      {/* Texto: mostrar solo cuando no estamos en transición (primero entra el color) */}
      {!transitionState.active && (
        <Suspense fallback={null}>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            {section === 'section1' && <Section1 />}
            {section === 'section2' && <Section2 />}
            {section === 'section3' && <Section3 />}
            {section === 'section4' && <Section4 />}
          </div>
        </Suspense>
      )}

      {/* CTA: Cruza el portal (aparece cuando el jugador está cerca del portal) */}
      {!transitionState.active && (showCta || ctaAnimatingOut) && (
        <div
          className="pointer-events-auto fixed inset-x-0 bottom-24 z-[10000] flex items-center justify-center"
        >
          <button
            type="button"
            onClick={() => {
              const target = nearPortalId
              if (!target) return
              if (transitionState.active) return
              if (target === section) return
              // Inicia transición visual
              setTransitionState({ active: true, from: section, to: target })
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
              setNearPortalId(null)
              // Fallback extra: completar transición si por alguna razón no se resetea el overlay
              window.setTimeout(() => {
                setTransitionState((s) => (s.active ? { active: false, from: target, to: null } : s))
              }, 900)
            }}
            className="px-6 sm:px-8 md:px-12 py-3 sm:py-3.5 md:py-4 rounded-full bg-white text-black font-bold uppercase tracking-wide text-lg sm:text-2xl md:text-3xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:translate-y-[-2px] active:translate-y-[0] transition-transform font-marquee"
            style={{ fontFamily: '\'Luckiest Guy\', Archivo Black, system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif', animation: `${nearPortalId ? 'slideup 220ms ease-out forwards' : 'slideup-out 220ms ease-in forwards'}` }}
          
          >Cruza el portal</button>
        </div>
      )}

      {/* Marquee de título de sección: visible cuando hay sección distinta de home y no hay transición */}
      {/* Banner superior con marquee infinito: aparece al pisar portal o brevemente tras entrar */}
      {!transitionState.active && (showMarquee || marqueeAnimatingOut) && (
        <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none py-2" style={{ animation: `${(nearPortalId || showSectionBanner) ? 'slidedown 200ms ease-out' : 'slidedown-out 200ms ease-in forwards'}` }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 to-transparent" />
          <div className="overflow-hidden w-full">
            <div className="whitespace-nowrap opacity-95 will-change-transform" style={{ animation: 'marquee 18s linear infinite' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className="title-banner"
                  style={{ fontFamily: '\'Luckiest Guy\', Archivo Black, system-ui, -apple-system, \'Segoe UI\', Roboto, Arial, sans-serif', WebkitTextStroke: '1px rgba(255,255,255,0.08)', textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}
                >
                  {(sectionLabel[marqueeLabelSection || nearPortalId || section] || ((marqueeLabelSection || nearPortalId || section || '').toUpperCase()))}
                  {i < 5 ? ' · ' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Toggle panel FX */}
      <button
        type="button"
        onClick={() => setShowFxPanel((v) => !v)}
        className="pointer-events-auto fixed right-4 bottom-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md z-[15000]"
        aria-label="Toggle panel FX"
      >FX</button>
      {/* Toggle Music Player */}
      <button
        type="button"
        onClick={() => setShowMusic((v) => !v)}
        className="pointer-events-auto fixed right-4 bottom-16 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white grid place-items-center shadow-md z-[400]"
        aria-label="Toggle music player"
      >
        <MusicalNoteIcon className="w-5 h-5" />
      </button>
      {/* Nav rápida a secciones */}
      <div className="pointer-events-auto fixed inset-x-0 bottom-4 z-[450] flex items-center justify-center gap-3">
        {['section1','section2','section3','section4'].map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => { if (!orbActiveUi) setNavTarget(id) }}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm sm:text-base font-marquee uppercase tracking-wide shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
          >{sectionLabel[id]}</button>
        ))}
      </div>
      <div
        className={`fixed right-4 bottom-28 z-[400] transition-all duration-200 ${showMusic ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}
        aria-hidden={!showMusic}
      >
        <MusicPlayer tracks={tracks} />
      </div>
      {/* Panel externo para ajustar postprocesado */}
      {showFxPanel && (
      <div className="pointer-events-auto fixed right-4 bottom-16 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none z-[500]">
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
          className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
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
        className="pointer-events-auto fixed right-4 top-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md"
        aria-label="Toggle panel Luz"
      >Luz</button>
      {showLightPanel && (
      <div className="pointer-events-auto fixed right-4 top-16 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none">
        <button
          type="button"
          className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
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
        onEggActiveChange={setEggActive}
      />
      {/* Toggle panel Retrato */}
      <button
        type="button"
        onClick={() => setShowPortraitPanel((v) => !v)}
        className="pointer-events-auto fixed left-40 bottom-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md"
        aria-label="Toggle panel Retrato"
      >Ret</button>
    </div>
  )
}