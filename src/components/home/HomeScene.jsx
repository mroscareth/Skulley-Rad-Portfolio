import React, { Suspense, lazy, useEffect, useState, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import LightningBolt, { BOLT_TOTAL_S, boltCoreAlpha } from '../fx/LightningBolt.jsx'
import CharacterNormalPass from '../fx/CharacterNormalPass.jsx'
import WallpaperEscena, { CARA_Y } from './WallpaperEscena.jsx'
import { registrarCabeza } from '../../lib/cabezaEnPantalla.js'
import { toonPisoGlobal } from '../../lib/toonBanding.js'
import { cine } from '../../lib/cinematicaOfrenda.js'
import { wallpaperEstado } from '../../lib/wallpaperEscritorio.js'
import { PALETAS_HOME, useMomentoHome } from '../../lib/momentoHome.js'
import PortalCrystal from '../fx/PortalCrystal.jsx'
import PortalHitArea from '../fx/PortalHitArea.jsx'
import Luciernagas from '../fx/Luciernagas.jsx'
import * as THREE from 'three'
import '../../lib/esqueletoPorCuadro.js'
import PauseFrameloop from '../PauseFrameloop.jsx'
import { compileAsyncSafe } from '../../lib/compileAsyncSafe.js'
import { homeFramePaused } from '../../lib/homeFrameloop.js'

// Al dar Enter, Skulley baja como esfera y applyModelOpacity pone sus
// materiales en transparent. Un material transparente y DoubleSide son DOS
// programas nuevos (cara de atrás y de enfrente) y salían compilándose en plena
// caída: ~3 s congelado en una primera visita, medido el 2026-11-10. three
// guarda los programas por material, así que compilarlos aquí una vez basta.
// Mismo filtro que applyModelOpacity: contornos y pupilas se ocultan, no se
// transparentan.
function precompilarFundido(scene) {
  let raiz = null
  scene.traverse((o) => { if (!raiz && o.userData?.fundidoWarm) raiz = o })
  if (!raiz) return []
  const volteados = []
  raiz.traverse((o) => {
    if (!o.material) return
    if (o.name && o.name.endsWith('_outline')) return
    if (o.userData?.__isPupilMesh) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    for (const m of mats) {
      if (m && !m.transparent && !volteados.includes(m)) { m.transparent = true; volteados.push(m) }
    }
  })
  return volteados
}
// gl.compile solo crea y manda a linkear los programas (con
// KHR_parallel_shader_compile no espera), así que voltear, compilar y regresar
// pasa en el mismo tick: nadie alcanza a ver los materiales transparentes.
function compilarFundido(gl, scene, camera, target) {
  const volteados = precompilarFundido(scene)
  if (!volteados.length) return
  const prev = gl.getRenderTarget()
  try {
    gl.setRenderTarget(target)
    gl.compile(scene, camera)
  } catch { }
  try { gl.setRenderTarget(prev) } catch { }
  for (const m of volteados) {
    try { m.transparent = false; m.needsUpdate = true } catch { }
  }
}

// Los pases del EffectComposer no están en la escena: compileAsync no los ve y
// el pre-pase los compilaba de golpe dentro de un solo cuadro (~15 programas y
// 63–109 ms esperando su link, medido el 2026-11-11 detrás del About). Se
// juntan sus materiales, también los de adentro de cada efecto (el bloom trae
// los suyos), y se compilan en paralelo, cada uno con el destino al que dibuja:
// el último pase va a la pantalla y los demás a un render target, y la llave
// del programa cambia entre uno y otro (ver compileAsyncSafe).
function materialesDelComposer(composer) {
  const aRT = new Set()
  const aPantalla = new Set()
  const visto = new Set()
  const recorrer = (obj, prof) => {
    if (!obj || typeof obj !== 'object' || visto.has(obj) || prof > 8) return
    visto.add(obj)
    if (obj.isMaterial) { aRT.add(obj); return }
    if (obj.isTexture || obj.isWebGLRenderTarget || obj.isBufferGeometry || obj.isWebGLRenderer) return
    if (obj.isObject3D && !obj.isMesh) return
    if (Array.isArray(obj)) { for (const v of obj) recorrer(v, prof + 1); return }
    for (const k of Object.keys(obj)) {
      if (k === 'renderer' || k === 'parent' || k === 'children') continue
      recorrer(obj[k], prof + 1)
    }
  }
  recorrer(composer, 0)
  for (const p of composer.passes || []) {
    const m = p.renderToScreen ? p.fullscreenMaterial : null
    if (m) { aRT.delete(m); aPantalla.add(m) }
  }
  return { aRT, aPantalla }
}
async function compilarComposer(gl, camera, target) {
  const composer = wallpaperEstado.composer
  const geo = composer?.passes?.find((p) => p.screen)?.screen.geometry
  if (!geo) return false
  const { aRT, aPantalla } = materialesDelComposer(composer)
  const escena = (mats) => {
    const s = new THREE.Scene()
    for (const m of mats) {
      const mesh = new THREE.Mesh(geo, m)
      mesh.frustumCulled = false
      s.add(mesh)
    }
    return s
  }
  await Promise.all([
    compileAsyncSafe(gl, escena(aRT), camera, 10000, target),
    compileAsyncSafe(gl, escena(aPantalla), camera, 10000, null),
  ])
  return true
}

// Compila los shaders de la escena DETRÁS del preloader, sin que el gameplay
// avance ni un tick.
//
// Historia (para no repetir intentos a ciegas):
// · 2026-08-09: despausar el frameloop durante el preloader fue DESTRUCTIVO —
//   los orbes derivaban ocultos y el corrupto se consumía solo en un portal.
// · Un intento posterior con gl.render()/compileAsync se midió "sin mejora"
//   (1033ms sin precalentar vs ~1100ms con), pero esas corridas fueron con el
//   CACHÉ DE SHADERS DEL DRIVER ya poblado y en un browser a ~4fps. Medido en
//   frío (caché limpio, build de prod, 2026-08-27): el primer render tras el
//   ENTER bloquea 5,564ms; con caché caliente, 244ms. La compilación ES el
//   monstruo — solo se ve en la primera visita real de cada usuario.
//
// Cómo funciona esto sin repetir el desastre de 2026-08-09:
// 1. `gl.compileAsync(scene, camera)`: linkea TODOS los programas de la escena
//    en paralelo (KHR_parallel_shader_compile) sin renderizar ni tocar estado.
// 2. Unos pocos `advance()` manuales con el delta DRENADO: llamamos
//    `clock.getDelta()` justo antes, así cada useFrame recibe delta≈0 y el
//    gameplay no avanza (orbes quietos, sin caída, física congelada). El
//    advance sí ejecuta el EffectComposer de PostFX, el normal-pass y los RTT
//    → compilan y suben texturas/buffers.
// 3. El canvas va con `visibility:hidden` mientras el warm está activo: un
//    gl.clear() en el mismo tick NO impide que el frame se componga (se
//    alcanzaba a ver al personaje parado en el piso durante la animación de
//    salida del preloader — la caída no arranca hasta el handler del ENTER).
//    CSS visibility no afecta el trabajo WebGL, solo el pintado; se restaura
//    en cuanto `active` baja, justo cuando el ENTER dispara la caída.
// 4. Se corre varias veces espaciado porque PostFX es lazy y puede montar
//    después del primer tick.
// `onDone` avisa cuando terminó el último tick (App espera eso para entrar):
// las partes síncronas de esto congelaban la página encima de la salida del
// preloader (1.18 s en primera visita, rendimiento.md 2026-11-11).
function PreloaderWarmRender({ active, onDone }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const advance = useThree((s) => s.advance)
  const clock = useThree((s) => s.clock)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  useEffect(() => {
    if (!active || !gl || !scene || !camera) return undefined
    // Ocultar SIEMPRE que el warm esté activo (aunque el trabajo ya se hizo):
    // la restauración vive en el cleanup y corre en cada re-ejecución.
    try { gl.domElement.style.visibility = 'hidden' } catch { }
    if (doneRef.current) {
      return () => { try { gl.domElement.style.visibility = '' } catch { } }
    }
    doneRef.current = true
    let cancelled = false
    const timers = []
    const warmTick = () => {
      if (cancelled) return
      try {
        clock.getDelta() // drena el delta acumulado → useFrame recibe ~0
        advance(performance.now())
      } catch { }
    }
    // Cede el hilo hasta el siguiente frame: entre fase y fase el browser
    // puede pintar el preloader en vez de quedarse mudo durante todo el warm.
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()))
    // Render target de 64×64. Sirve para dos cosas: compilar con la llave que
    // usa el composer (ver compileAsyncSafe) y el pre-pase en miniatura.
    const tinyRT = new THREE.WebGLRenderTarget(64, 64)

    let composerCompilado = false
    ;(async () => {
      try { await compileAsyncSafe(gl, scene, camera, 10000, tinyRT) } catch { }
      if (cancelled) return
      compilarFundido(gl, scene, camera, tinyRT)
      try { composerCompilado = await compilarComposer(gl, camera, tinyRT) } catch { }
      if (cancelled) return
      await nextFrame()
      if (cancelled) return

      // Pre-pase en miniatura. compileAsync compila los programas, pero el
      // PRIMER dibujo real sigue pagando link + subida de texturas, y medido
      // en frío eso era un solo frame de ~3s. El tamaño del buffer no cambia
      // qué programas se compilan, así que hacemos ese primer dibujo contra
      // un render target de 64×64: mismos programas, misma subida, con el
      // fillrate dividido entre ~1000. Los ticks a tamaño real que vienen
      // después ya encuentran todo residente.
      try {
        const prevRT = gl.getRenderTarget()
        gl.setRenderTarget(tinyRT)
        warmTick()
        gl.setRenderTarget(prevRT)
      } catch { }
      await nextFrame()
      if (cancelled) return

      // Ticks a tamaño real: el primero sube lo que el pre-pase no tocó (el
      // composer de PostFX dibuja a sus propios targets y se salta el RT de
      // arriba); los siguientes agarran su chunk si montó tarde.
      warmTick()
      timers.push(window.setTimeout(warmTick, 450))
      timers.push(window.setTimeout(() => { warmTick(); onDoneRef.current?.() }, 1100))

      // Con el loop de verdad pausado, lo que monta después de estos ticks (el
      // GLB de Argus llega tarde, por ejemplo) ya no se compila solo: se
      // compilaba porque la escena se dibujaba entera detrás del preloader.
      // Cada 1.5 s se revisa; si apareció un programa nuevo, se compila y se
      // dibuja un cuadro para subir sus texturas. Si no, no cuesta nada.
      const revisar = async () => {
        if (cancelled) return
        const antes = gl.info.programs?.length ?? 0
        try { await compileAsyncSafe(gl, scene, camera, 10000, tinyRT) } catch { }
        if (!composerCompilado) {
          try { composerCompilado = await compilarComposer(gl, camera, tinyRT) } catch { }
        }
        if (cancelled) return
        if ((gl.info.programs?.length ?? 0) > antes) {
          compilarFundido(gl, scene, camera, tinyRT)
          warmTick()
        }
        timers.push(window.setTimeout(revisar, 1500))
      }
      timers.push(window.setTimeout(revisar, 2000))
    })()
    return () => {
      cancelled = true
      for (const t of timers) window.clearTimeout(t)
      try { tinyRT.dispose() } catch { }
      try { gl.domElement.style.visibility = '' } catch { }
    }
  }, [active, gl, scene, camera, advance, clock])
  return null
}
import Player from '../Player.jsx'
import HomeOrbs, { OrbLightRig } from '../HomeOrbs.jsx'
import { OLEADA } from '../../lib/juegoEsferas.js'
import Portal from '../Portal.jsx'
import CameraController from '../CameraController.jsx'
import FrustumCulledGroup from '../FrustumCulledGroup.jsx'
import Environment from '../Environment.jsx'
import FakeGrass from '../FakeGrass.jsx'
import PastoPintado from './PastoPintado.jsx'
import { zonasPiso } from '../../lib/pisoPintado.js'
// El pasto fino no crece sobre las lozas: el claro casi hasta los pinos y la plaza
// del glifo (Oscar, 2026-11-25: el pasto solo en las orillas).
const HUECOS_PASTO = [
  [zonasPiso.plaza[0], zonasPiso.plaza[1], zonasPiso.lozasClaro - 2, zonasPiso.lozasClaro + 1],
  [zonasPiso.plazaGlifo[0], zonasPiso.plazaGlifo[1], 7, 9],
]
import BosquePintado from './BosquePintado.jsx'
import PetalosCamino from './PetalosCamino.jsx'
import BordeDelMundo from './BordeDelMundo.jsx'
import RenderboxClaro from './RenderboxClaro.jsx'
import LetrerosPortales from './LetrerosPortales.jsx'
import ZonaOfrenda from './ZonaOfrenda.jsx'
import PlazaOfrenda from './PlazaOfrenda.jsx'
import ObjetosOfrenda from './ObjetosOfrenda.jsx'
import TransformaSkulley from './TransformaSkulley.jsx'
import HitosOfrenda from './HitosOfrenda.jsx'
import SiluetasOfrenda from './SiluetasOfrenda.jsx'
import { skulleyOculto, pideOculto, ponerOculto } from '../../lib/inventarioEscena.js'

// Inventario → Objetos: Skulley se quita de en medio y en su lugar gira el objeto (lib/inventarioEscena.js).
// En Customize ya cubierto lo deshace y lo rearma WallpaperEscena; fuera de ahí va de inmediato.
// Se ocultan sus hijos, no el grupo: dentro van dos pointLight (en 0) y, oculto el grupo, salían de la escena,
// cambiaba el número de luces y three recompilaba todos los materiales iluminados (17 programas la primera vez
// que se transformaba al final de la ofrenda; Oscar, 2026-11-26). Los hijos con luz se quedan.
function OcultaSkulley({ playerRef }) {
  const ocultos = useRef(null)
  useFrame(() => {
    const g = playerRef?.current
    if (!g) return
    if (wallpaperEstado.fase !== 'lista' && skulleyOculto() !== pideOculto()) ponerOculto(pideOculto())
    const ocultar = skulleyOculto()
    if (ocultar && !ocultos.current) {
      const lista = []
      for (const hijo of g.children) {
        let conLuz = false
        hijo.traverse((o) => { if (o.isLight) conLuz = true })
        if (!conLuz && hijo.visible) { hijo.visible = false; lista.push(hijo) }
      }
      ocultos.current = lista
    } else if (!ocultar && ocultos.current) {
      for (const hijo of ocultos.current) hijo.visible = true
      ocultos.current = null
    }
  })
  return null
}
import { PrecalentarGlobo } from '../SpeechBubble3D.jsx'
import FloatingExclamation from '../FloatingExclamation.jsx'
import ZoidianNPC from '../ZoidianNPC.jsx'
import DroneNPC from '../drone/DroneNPC.jsx'
import { patadaAlDron } from '../../lib/droneNpc.js'
import { patadaARenderbox } from '../../lib/renderboxHome.js'
import PortalParticles from '../PortalParticles.jsx'
import GoldenFlashOverlay from '../GoldenFlashOverlay.jsx'
import GoldenDissolveParticles from '../GoldenDissolveParticles.jsx'
import SilhouetteShadow from '../SilhouetteShadow.jsx'
import SlimeSlug3D from '../SlimeSlug3D.jsx'
import { sectionColors } from '../../lib/appHelpers.js'

// CharacterPortrait is App-HUD (not scene). PostFX is scene but lazy-loaded;
// re-import here so HomeScene owns the full render tree.
const PostFX = lazy(() => import('../PostFX.jsx'))

// Luz de impacto COMPARTIDA para todos los bolts pooled (antimatter strike +
// thunder cast). Una sola luz persistente → el conteo de luces de la escena es
// estable desde el warmup y NO recompila los shaders en el primer strike (causa
// raíz del freeze; ver LightningBolt.jsx). Escucha los mismos eventos que
// disparan los bolts y reproduce la envolvente del core en el punto primario.
function SharedBoltImpactLight() {
  const lightRef = useRef(null)
  // { start: performance.now() ms (-1 = idle), x, z }
  const stateRef = useRef({ start: -1, x: 0, z: 0 })
  useEffect(() => {
    const onAnti = (e) => {
      const d = e?.detail || {}
      stateRef.current = {
        start: performance.now(),
        x: Number.isFinite(d.x) ? d.x : 0,
        z: Number.isFinite(d.z) ? d.z : 0,
      }
    }
    const onThunder = (e) => {
      const pts = e?.detail?.points || []
      const p = pts[0] || { x: 0, z: 0 }
      stateRef.current = { start: performance.now(), x: p.x, z: p.z }
    }
    window.addEventListener('antimatter-orb-strike', onAnti)
    window.addEventListener('madre-castigo-strike', onAnti)
    window.addEventListener('thunder-strike', onThunder)
    return () => {
      window.removeEventListener('antimatter-orb-strike', onAnti)
      window.removeEventListener('madre-castigo-strike', onAnti)
      window.removeEventListener('thunder-strike', onThunder)
    }
  }, [])
  useFrame(() => {
    const l = lightRef.current
    if (!l) return
    const st = stateRef.current
    if (st.start < 0) return
    const t = (performance.now() - st.start) / 1000
    if (t > BOLT_TOTAL_S) {
      if (l.intensity !== 0) l.intensity = 0
      st.start = -1
      return
    }
    l.position.set(st.x, 0.05, st.z)
    l.intensity = boltCoreAlpha(t) * 14
  })
  return <pointLight ref={lightRef} color={'#cfeaff'} intensity={0} distance={18} decay={1.6} />
}

// Key light del cel-shading RELATIVA A LA CÁMARA. Antes era una direccional
// world-space casi cenital ([1,10,2.5]) → el corte luz/sombra del toon caía
// arriba y la cara que ve el jugador quedaba casi uniforme; además el corte
// dependía de cómo girara el personaje ("a veces sí, a veces no"). Acá la
// reposicionamos cada frame en el arriba-frente-derecha de la VISTA y apuntando
// al player → el corte toon es CONSISTENTE y fuerte desde cualquier ángulo
// (igual que el retrato, que tiene la key fija frontal). Estilo toon-games.
const _tkUp = new THREE.Vector3(0, 1, 0)
// Con Skulley aislado, lo más oscuro que puede llegar a ser su sombra. Con dos
// bandas lo que caía en la de abajo salía casi negro, y de cerca eran manchas.
const PISO_AISLADO = 0.35
// UNA SOLA key direccional relativa a la vista → un único gradiente N·L → corte
// (terminator) limpio. El relleno de la sombra lo da un ambientLight PLANO
// (uniforme, no direccional) igual que el retrato → la sombra queda pareja en
// vez de "manchada" (dos luces direccionales creaban gradientes que competían).
// La cara de Skulley en la pantalla (lib/cabezaEnPantalla.js), para que el
// iris de "Conocer la historia" se cierre y se abra sobre ella. Se mide al
// pedirla, con la cámara del último cuadro: sirve con la escena en pausa.
// `RADIO`: el de la cabeza, en unidades del mundo.
const CABEZA_RADIO = 0.55
function CabezaEnPantalla({ playerRef }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const c = new THREE.Vector3()
    const o = new THREE.Vector3()
    return registrarCabeza(() => {
      const p = playerRef?.current?.position
      if (!p) return null
      const rect = gl.domElement.getBoundingClientRect()
      c.set(p.x, p.y + CARA_Y, p.z)
      o.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(CABEZA_RADIO).add(c).project(camera)
      c.project(camera)
      const x = rect.left + (c.x * 0.5 + 0.5) * rect.width
      return {
        x,
        y: rect.top + (0.5 - c.y * 0.5) * rect.height,
        r: Math.abs(rect.left + (o.x * 0.5 + 0.5) * rect.width - x),
      }
    })
  }, [camera, gl, playerRef])
  return null
}

// En Customize la trama tapa el mundo, pero Argus, el "!", las esferas, la
// babosa y los portales seguían recibiendo clics y hover detrás (Oscar: "el
// entorno 3D que queda atrás es clickeable, no debería"). Mientras dura se
// apagan los eventos de R3F (sin intersecciones no hay clic ni hover); lo que
// Customize arrastra va por eventos del DOM, que no pasan por aquí.
function SinClicsDelMundo({ activo }) {
  const setEvents = useThree((s) => s.setEvents)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (!activo) return undefined
    setEvents({ enabled: false })
    try {
      gl.domElement.style.cursor = ''
      document.body.style.cursor = ''
    } catch { }
    return () => setEvents({ enabled: true })
  }, [activo, setEvents, gl])
  return null
}

function ToonKeyLight({ playerRef, intensity = 2.4 }) {
  const keyRef = useRef(null)
  const keyTgt = useRef(null)
  const { camera } = useThree()
  const _camDir = useRef(new THREE.Vector3())
  const _right = useRef(new THREE.Vector3())
  const _pos = useRef(new THREE.Vector3())
  const aislado = useRef(0)
  useFrame((_, delta) => {
    const k = keyRef.current, kt = keyTgt.current
    if (!k || !kt) return
    if (k.target !== kt) k.target = kt
    const p = playerRef?.current?.position
    if (!p) return
    camera.getWorldDirection(_camDir.current)            // cámara → escena
    _right.current.crossVectors(_camDir.current, _tkUp).normalize()
    // Frente-derecha de la vista, elevación media → terminator diagonal limpio
    // (como el retrato, key en [2,4,3]). Menos cenital que antes.
    // Skulley aislado (Customize y wallpaper): de cerca ese corte diagonal le cruza
    // la cara como una mancha (Oscar, 2026-11-04). La luz se pasa casi al frente y
    // la sombra se acomoda alrededor de ojos, nariz y boca. Se recorre, no brinca.
    // También en la cinemática del final: con 3 bandas, lo que recibía menos de 1/6 de luz caía a negro puro
    // y en la plaza oscura el lado sin luz del mohawk y la cara brincaba a negro según la toma (Oscar, 2026-11-26)
    const meta = wallpaperEstado.fase === 'off' && !cine.activo ? 0 : 1
    aislado.current += (meta - aislado.current) * (1 - Math.exp(-6 * Math.min(0.05, delta || 0)))
    const a = aislado.current
    toonPisoGlobal.value = PISO_AISLADO * a
    _pos.current.copy(p)
      .addScaledVector(_camDir.current, -4.0 - 3.0 * a)  // hacia la cámara (frontal)
      .addScaledVector(_right.current, 4.0 - 2.6 * a)    // a la derecha (corte lateral)
      .addScaledVector(_tkUp, 3.5 + 1.5 * a)             // arriba (menos cenital)
    k.position.copy(_pos.current)
    kt.position.copy(p); kt.updateMatrixWorld()
  })
  return (
    <>
      <directionalLight ref={keyRef} intensity={intensity} color={'#fff4e6'} />
      <object3D ref={keyTgt} />
    </>
  )
}

// The entire 3D scene that lives inside <Canvas>. Extracted verbatim from App.jsx.
// Prop list is large on purpose — App owns the state; this component only renders.
// En desarrollo, `window.__r3f()` da el estado de R3F del home (para cronometrar
// cada useFrame y el render: ver rendimiento.md, "Cómo medir").
function EstadoR3fDev() {
  const get = useThree((s) => s.get)
  useEffect(() => { if (import.meta.env.DEV) window.__r3f = get }, [get])
  return null
}

export default function HomeScene({
  // state flags
  pageHidden, showPreloaderOverlay, showSectionUi, sectionUiAnimatingOut, sectionCovered, historiaCubre, proyectoCubre = false, proyectoAbierto = false, proyectoTapa = false, primerPlano,
  dialogoDron = false, puedeHablarDron = false, onHablarDron, dialogoArgus = false, onHablarArgus,
  transitionState, tramaViaje, noiseMixEnabled, mainWarmStage, sectionHomeWarm, onHomeWarmDone, psychoSceneColor,
  effectiveSceneColor, isMobilePerf, degradedMode, fxWarm, prevSceneTex,
  eggActive, boltFlashActive, vhsRewindActive, section, homeLanded, sphereGameActive,
  cheatDragEnabled, bootLoading, goldSkinModelActive, goldSkinTransformActive,
  navTarget, preloaderFadingOut, blackoutVisible, orbActiveUi, playerMoving,
  nearPortalId, actionCooldown, cameraMode, customizeActive, playerMeshes, portalMixMap,
  portals, noiseMixProgress, fx,

  // refs
  playerRef, homeOrbsRef, sunRef, mainControlsRef, dofTargetRef,
  bannerTimerRef, ctaForceTimerRef, lastPortalIdRef, autoEnterOnArrivalRef,
  prevPlayerPosRef,
  preloaderHideTimerRef, lastExitedSectionRef,

  // setters
  setDegradedMode,
  setTintFactor, setPortalMixMap, setNearPortalId, setBlackoutImmediate,
  setBlackoutVisible, setMarqueeAnimatingOut, setMarqueeForceHidden,
  setMarqueeLabelSection, setShowMarquee, setLandingBannerActive,
  setCtaForceHidden, setShowCta, setCtaAnimatingOut, setUiHintPortalId,
  setCharacterReady, setNavTarget,
  setPortraitGlowV, setOrbActiveUi, setPlayerMoving, setActionCooldown,
  setPreloaderFadingOut, setHomeLanded, setPlayerMeshes,

  // actions (useCallback-wrapped in App)
  handlePortalEnter, handleCheatCapture, handleBlockedDragAttempt, onOfferingDelivered, section6Unlocked,
  onPortalClick,
  beginSectionTransition,
  beginLiquidWipe,
  playSfx,
}) {
  // Lazy-init THREE-dependent refs owned by App (kept null in eager chunk).
  useEffect(() => {
    if (prevPlayerPosRef && !prevPlayerPosRef.current) {
      prevPlayerPosRef.current = new THREE.Vector3(0, 0, 0)
    }
  }, [prevPlayerPosRef])

  // Los portales se pueden clickear solo con el personaje libre en HOME: ni
  // durante un viaje en orbe ya lanzado, ni con una transición o el modo
  // customize encima.
  // Yendo a una sección con la trama, el mundo se queda hasta que ella lo tape.
  const saliendoDeHome = transitionState.active && transitionState.from === 'home' && !tramaViaje
  // Detrás de una sección, mientras corre su warm-up (`sectionHomeWarm`, App), la
  // escena se arma como en home para que compile lo que verá al regresar: las
  // esferas, Argus, la babosa, el pasto, las sombras, los cristales y el contorno
  // del composer. Solo lo que se dibuja; el juego sigue con `section`.
  const comoHome = section === 'home' || Boolean(sectionHomeWarm)
  // Las esferas, Argus y el drone se montan la primera vez que la escena está como
  // home y ya no se desmontan: fuera de ella se ocultan y las esferas se congelan.
  // Desmontados al salir, al regresar se creaban con materiales nuevos y se
  // compilaban 10 programas a media caída de Skulley (medido el 2026-11-23).
  const [npcsMontados, setNpcsMontados] = useState(false)
  if (!npcsMontados && comoHome && mainWarmStage >= 2) setNpcsMontados(true)
  const npcsVisibles = comoHome && !saliendoDeHome
  const momentoHome = useMomentoHome()
  // dónde anda la esfera corrupta (el drone de M.A.D.R.E. va a verla de vez en cuando)
  const buscarCorrupta = useRef(() => homeOrbsRef.current?.corrupta?.() || null).current
  const portalClickEnabled = section === 'home' && !bootLoading && !showPreloaderOverlay
    && !showSectionUi && !orbActiveUi && !navTarget && !transitionState?.active && !customizeActive

  // Antimatter strike: cuando un orb rojo entra en un portal equivocado y
  // respawnea, HomeOrbs dispara el evento — acá renderizamos un LightningBolt
  // breve (~260ms) en esa posición. Safety timeout garantiza que se limpie.
  // Posición persistente del último strike + seed/playing. El bolt se monta
  // una sola vez (tras el primer strike) y de ahí en adelante solo cambia
  // `seed`/`playing` → materiales y luz se compilan una vez, sin recompilar la
  // escena en cada rayo. Mismo patrón que el bolt del easter egg en Player.
  // Default válido (no null): el bolt se monta PERSISTENTE (idle, opacity 0) tras
  // el warmup, así su shader + la luz compartida se compilan una vez durante el
  // load (tapado por el preloader) y el primer strike no recompila la escena.
  // `y`: dónde termina (0, el piso; el que le cae a Argus termina en su cabeza)
  const [strikePos, setStrikePos] = useState({ x: 0, z: 0, y: 0 })
  const [strikeSeed, setStrikeSeed] = useState(0)
  const [strikePlaying, setStrikePlaying] = useState(false)
  // Group raíz del zoidian — lo llena ZoidianNPC; SilhouetteShadow lo lee.
  const zoidianRef = useRef(null)
  // Luces de las esferas, montadas aparte para que el conteo de luces no cambie
  // cuando HomeOrbs se desmonta (ver OrbLightRig).
  const orbLightRigRef = useRef(null)
  // Sacudida de cámara del empujón de Argus (ver el bloque de CameraController).
  const [argusPushShake, setArgusPushShake] = useState(false)
  useEffect(() => {
    let id = null
    const onPush = () => {
      setArgusPushShake(true)
      if (id) clearTimeout(id)
      id = setTimeout(() => { setArgusPushShake(false); id = null }, 420)
    }
    window.addEventListener('argus-push-strike', onPush)
    return () => {
      window.removeEventListener('argus-push-strike', onPush)
      if (id) clearTimeout(id)
    }
  }, [])

  // Thunder cast (easter egg comer-orbe): pool de hasta 3 bolts simultáneos.
  // Inicializado a slots idle (no null) → montaje persistente. El conteo de
  // luces lo gobierna SharedBoltImpactLight (una sola luz), no estos bolts.
  const THUNDER_BOLTS = 3
  const [thunderBolts, setThunderBolts] = useState(
    () => Array.from({ length: THUNDER_BOLTS }, () => ({ x: 0, z: 0, seed: 0, playing: false })),
  )
  const thunderSeedRef = useRef(0)
  useEffect(() => {
    const onCast = (e) => {
      const pts = e?.detail?.points || []
      if (!pts.length) return
      thunderSeedRef.current += 1
      const base = thunderSeedRef.current * 10
      setThunderBolts((prev) => {
        const slots = prev.slice()
        for (let i = 0; i < THUNDER_BOLTS; i++) {
          if (i < pts.length) slots[i] = { x: pts[i].x, z: pts[i].z, seed: base + i, playing: true }
          else slots[i] = { ...slots[i], playing: false }
        }
        return slots
      })
    }
    window.addEventListener('thunder-strike', onCast)
    return () => window.removeEventListener('thunder-strike', onCast)
  }, [])
  useEffect(() => {
    const onStrike = (e) => {
      try {
        const d = e?.detail || {}
        const x = Number.isFinite(d.x) ? d.x : 0
        const z = Number.isFinite(d.z) ? d.z : 0
        setStrikePos({ x, z, y: Number.isFinite(d.y0) ? d.y0 : 0 })
        setStrikeSeed((k) => k + 1)
        setStrikePlaying(true)
      } catch {}
    }
    window.addEventListener('antimatter-orb-strike', onStrike)
    // El castigo de M.A.D.R.E. por trampa en el juego (App.jsx): el mismo rayo.
    window.addEventListener('madre-castigo-strike', onStrike)
    return () => {
      window.removeEventListener('antimatter-orb-strike', onStrike)
      window.removeEventListener('madre-castigo-strike', onStrike)
    }
  }, [])
  // Safety: si onDone del bolt falla (frameloop pausado, etc), forzar el clear
  // del playing a los 600ms. Keyed en strikeSeed → se reinicia por strike.
  useEffect(() => {
    if (!strikePlaying) return
    const id = setTimeout(() => setStrikePlaying(false), 600)
    return () => clearTimeout(id)
  }, [strikePlaying, strikeSeed])

  return (
    <Suspense fallback={null}>
      {/* La resolución adaptable vive en HomeCanvas (ResolucionAdaptable): el
          AdaptiveDpr de drei que estaba aquí solo reaccionaba a
          performance.regress(), que nadie llamaba. */}
      {/* PerformanceMonitor removed: even one-way transitions (onDecline) cause
          visible stutter when swapping ground material (reflector → standard),
          Environment lowPerf, and DPR. Memory watchdog (useMemoryWatchdog) is
          the only safety net now — degrades only at extreme thresholds. */}
      {/* Main scene always mounted (preloader is just an HTML overlay) */}
      <>
        {/* Pause frameloop when: preloader visible, section UI active without transition, or page hidden */}
        {/* NO “optimizar” esto dejando correr el loop durante el preloader.
            Se intentó (2026-08-09) para que los shaders compilaran detrás del
            overlay, y fue DESTRUCTIVO: `HomeOrbs` monta con `mainWarmStage>=2`,
            que ocurre antes del ENTER, así que su física empezaba a correr
            oculta. Los orbes derivaban solos y el CORRUPTO se metía a un
            portal → se consumía y entraba en cooldown, o sea que el usuario
            entraba y el orbe ya no estaba. Lo mismo aplica a cualquier
            `useFrame` de gameplay (caída del personaje, timers).
            Si se reintenta el warm-up, hay que CONGELAR el gameplay primero
            (p.ej. `active={... && !showPreloaderOverlay}` en HomeOrbs) y no
            solo despausar el render. */}
        {/* `sectionCovered`: ventana del section preloader (grid cubriendo TODO,
            yendo a una sección). Ahí la escena de home no se ve — pausarla libera
            CPU/GPU justo cuando la sección destino está montando (su commit
            pesado + creación de canvas). NO aplica yendo a home (to==='home'):
            ese camino necesita el render corriendo antes del reveal. */}
        <PauseFrameloop paused={homeFramePaused({ showPreloaderOverlay, showSectionUi, sectionUiAnimatingOut, transitionState, noiseMixEnabled, pageHidden, sectionCovered, historiaCubre, proyectoCubre })} />
        {/* Warm-up real detrás del preloader — ver la nota del componente. Gate:
            escena completa montada (stage 2 + PostFX via fxWarm) y overlay aún
            tapando. Se cancela solo si el usuario entra antes de terminar.
            Entrando directo a una sección corre detrás de ella (`sectionHomeWarm`,
            App); cualquier transición lo corta, porque el iris de regreso
            necesita el canvas visible. */}
        <PreloaderWarmRender active={Boolean((showPreloaderOverlay || (sectionHomeWarm && section !== 'home' && !transitionState?.active)) && !bootLoading && fxWarm && mainWarmStage >= 2)} onDone={onHomeWarmDone} />
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
            mobileHdri={Boolean(isMobilePerf)}
            transparentBg={prevSceneTex == null && noiseMixEnabled}
            portales={portals}
          />
        )}
        {/* Cel-shading key light RELATIVA A CÁMARA → corte toon consistente y
            fuerte desde cualquier ángulo (ver ToonKeyLight arriba). Solo tras el
            warmup (durante el warmup ya hay una direccional simple). */}
        {/* UNA key cámara-relativa (corte limpio) + ambient PLANO de relleno
            (uniforme → sombra pareja, no manchada), receta del retrato. */}
        {mainWarmStage >= 1 && (
          <>
            <ToonKeyLight playerRef={playerRef} intensity={2.4} />
            <ambientLight intensity={0.32} color={'#aeb9cc'} />
          </>
        )}
        <CabezaEnPantalla playerRef={playerRef} />
        <SinClicsDelMundo activo={!!customizeActive} />
        {/* Fake grass: reveals in radius around the character (cheap: 1 drawcall)
            Hidden during transitions from HOME to avoid flash */}
        <FakeGrass
          playerRef={playerRef}
          enabled={Boolean(comoHome && !saliendoDeHome)}
          lowPerf={Boolean(isMobilePerf || degradedMode || !fxWarm)}
          isMobile={Boolean(isMobilePerf)}
          fieldRadius={isMobilePerf ? 80 : 150}
          baseColor={eggActive ? '#fc1c27' : PALETAS_HOME[momentoHome].pastoFino}
          emissiveIntensity={0.22}
          revealRadius={7.0}
          feather={2.2}
          persistent={false}
          directional={false}
          count={isMobilePerf ? 8000 : 180000}
          bladeHeight={0.42}
          bladeWidth={0.032}
          huecos={HUECOS_PASTO}
          sway={isMobilePerf ? 0.02 : 0.045}
        />
        {/* Matas pintadas a mano (home/PastoPintado.jsx): del color del piso, se
            doblan y se aplastan al pasar Skulley. Montadas siempre: no compilan al jugar. */}
        <PastoPintado playerRef={playerRef} portales={portals} colorPiso={psychoSceneColor || '#204580'} />
        {/* Pétalos de cempasúchil donde la tierra tapa el camino escondido
            (home/PetalosCamino.jsx); Skulley los levanta al pasar. Montados siempre. */}
        <PetalosCamino playerRef={playerRef} />
        {import.meta.env.DEV && <EstadoR3fDev />}
        {/* Los programas de la primera viñeta, compilados con la escena (SpeechBubble3D). */}
        <PrecalentarGlobo />
        {/* El bosque del claro (home/BosquePintado.jsx): pinos, peñascos y los menhires
            rúnicos de cada portal. Montado siempre; se compila antes de entrar a la escena. */}
        <BosquePintado playerRef={playerRef} portales={portals} colorPiso={psychoSceneColor || '#204580'} portalMixMap={portalMixMap} visible={comoHome} />
        {/* Pasando el portal del glifo: barricadas de calle cerrada y, detrás, el código
            crudo del mundo, que se revela al acercarse (home/BordeDelMundo.jsx). */}
        <BordeDelMundo playerRef={playerRef} />
        {/* La Renderbox de Oscar en la orilla del claro (home/RenderboxClaro.jsx): zumba con Skulley
            cerca y una patada la apaga o la prende. Su GLB llega aparte y se compila antes de montarse. */}
        <RenderboxClaro playerRef={playerRef} visible={comoHome} activo={section === 'home' && !customizeActive} />
        {/* Un letrero de neón de doble cara detrás de cada portal con el nombre de la sección en runas,
            que corre y flashea con Skulley cerca (home/LetrerosPortales.jsx; reemplaza a los menhires). */}
        <LetrerosPortales portales={portals} portalMixMap={portalMixMap} visible={comoHome} />
        {/* La ofrenda del Día de los Skulleys: qué tan cerca va Skulley del portal del
            glifo, para cruzar la música con la canción rota (lib/cancionOfrenda.js). */}
        <ZonaOfrenda playerRef={playerRef} activa={section === 'home' && !bootLoading} />
        {/* La plaza de la ofrenda: su oscuridad, sus rayos de luz y sus antorchas
            (home/PlazaOfrenda.jsx; los pétalos van con PetalosCamino). Montada siempre. */}
        <PlazaOfrenda playerRef={playerRef} activo={section === 'home'} />
        {/* Detrás de cada lugar de la plaza, un hito labrado con el nombre de su ofrenda en runas que se
            prende en naranja al ponerla (home/HitosOfrenda.jsx; reemplaza a las estelas). */}
        <HitosOfrenda visible={comoHome} playerRef={playerRef} />
        <OcultaSkulley playerRef={playerRef} />
        {/* Los objetos de la ofrenda en su lugar al ponerlos (home/ObjetosOfrenda.jsx):
            su GLB llega aparte; montados siempre, lo no puesto encogido a casi nada.
            Los que Skulley carga flotan sobre él solo con él a la vista en la home. */}
        <Suspense fallback={null}>
          <TransformaSkulley playerRef={playerRef} />
          <ObjetosOfrenda
            playerRef={playerRef}
            mostrarCarga={Boolean(section === 'home' && homeLanded && !saliendoDeHome && !orbActiveUi && !customizeActive)}
          />
          {/* La silueta de cada ofrenda que falta, en su lugar (home/SiluetasOfrenda.jsx; con las misiones abiertas). */}
          <SiluetasOfrenda visible={comoHome} />
        </Suspense>
        {/* God Rays anchor (hidden when inactive and no depth write) */}
        {fx.godEnabled && (
          <mesh ref={sunRef} position={[0, 8, 0]}>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshBasicMaterial color={'#ffffff'} transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
        {/* Luminous orbs with physics in HOME.
            Hidden immediately when there's an active transition leaving HOME to avoid flash */}
        {/* Las esferas se congelan en Customize: ahí no se ven, pero seguían rodando y la
            corrupta acababa en un portal, y su rayo despedazaba a Skulley en pleno
            wallpaper. Yendo a una sección siguen rodando, porque se ven; solo la
            corrupta deja de invocar el rayo. */}
        {npcsMontados && (
          <group visible={npcsVisibles}>
          <HomeOrbs
            ref={homeOrbsRef}
            playerRef={playerRef}
            lightRigRef={orbLightRigRef}
            active={section === 'home' && npcsVisibles && !showPreloaderOverlay && !customizeActive}
            sinRayo={Boolean(navTarget || transitionState.active || preloaderFadingOut || dialogoDron || dialogoArgus)}
            // OLEADA.tope montadas desde el principio: el juego las va soltando por
            // oleadas y fuera del juego se ven OLEADA.libre (HomeOrbs oculta las
            // demás). No depende de isMobilePerf, que también se prende con
            // internet lenta (navigator.connection en 2g, index.html) y dejaba el
            // juego con 4 esferas normales (Oscar, 2026-11-15). Las esferas no
            // cuestan; sus luces sí y siguen a isMobilePerf (OrbLightRig): las que
            // se quedan sin luz brillan igual por su neón.
            num={OLEADA.tope}
            isMobile={Boolean(isMobilePerf)}
            portals={portals}
            portalRadius={2}
            gameActive={sphereGameActive}
            dragEnabled={sphereGameActive ? cheatDragEnabled : true}
            onCheatCapture={sphereGameActive ? handleCheatCapture : undefined}
            onBlockedDragAttempt={sphereGameActive ? handleBlockedDragAttempt : undefined}
            onOfferingDelivered={onOfferingDelivered}
            section6Unlocked={section6Unlocked}
          />
          </group>
        )}
        {/* Bolts pooled (antimatter strike + thunder cast) + su luz de impacto
            COMPARTIDA. Montados PERSISTENTES tras el warmup (mainWarmStage >= 2,
            mismo gate que HomeOrbs): la recompilación por el alta de la luz
            ocurre una vez durante el load, no en el primer strike → mata el
            freeze. Los bolts NO traen luz propia (withImpactLight={false}); el
            conteo de luces lo gobierna SharedBoltImpactLight. */}
        {mainWarmStage >= 2 && (
          <>
            <SharedBoltImpactLight />
            {/* Luciérnagas del escenario (fx/Luciernagas.jsx): montadas desde el
                warm-up y nunca desmontadas, para que su programa se compile ahí;
                fuera del home o en Customize solo se apagan. */}
            <Luciernagas playerRef={playerRef} activo={Boolean(section === 'home' && !saliendoDeHome && !customizeActive)} />
            <OrbLightRig count={isMobilePerf ? 5 : 10} rigRef={orbLightRigRef} />
            {/* Antimatter strike — rayo del cielo al PISO en la posición del
                respawn. Top alto fijo, bottom siempre en y=0 (ground) para que
                el rayo atraviese el orb y termine en el suelo. */}
            <LightningBolt
              withImpactLight={false}
              seed={strikeSeed}
              playing={strikePlaying}
              top={[strikePos.x, 22, strikePos.z]}
              bottom={[strikePos.x, strikePos.y, strikePos.z]}
              coreRadius={0.09}
              haloRadius={0.32}
              onDone={() => setStrikePlaying(false)}
            />
            {/* Thunder cast: 1-3 bolts en los puntos elegidos por el usuario. */}
            {thunderBolts.map((b, i) => (
              <LightningBolt
                key={`thunder-bolt-${i}`}
                withImpactLight={false}
                seed={b.seed}
                playing={b.playing}
                top={[b.x, 22, b.z]}
                bottom={[b.x, 0, b.z]}
                coreRadius={0.09}
                haloRadius={0.32}
                onDone={() => setThunderBolts((prev) => prev.map((s, j) => (j === i ? { ...s, playing: false } : s)))}
              />
            ))}
          </>
        )}
        {/* Zoidian — NPC dueño del juego de las esferas, parado donde antes
            flotaba solo el "!". Click (en él o en el "!", con Skulley cerca) →
            su escena del trato (ZoidianDialog en App) → partida. Monta desde el
            warmup (sin esperar homeLanded) para que sus shaders entren al
            compileAsync del preloader; Suspense PROPIO para no suspender la
            escena entera mientras baja su GLB. */}
        {npcsMontados && (
          <group visible={npcsVisibles}>
            <Suspense fallback={null}>
              <ZoidianNPC
                groupRef={zoidianRef}
                lookAtRef={playerRef}
                position={[0, 0, 12.9]}
                rotationY={Math.PI}
                targetHeight={3.2}
                onClick={() => { try { onHablarArgus?.() } catch { } }}
              />
            </Suspense>
            {/* Sombra de contacto del zoidian — misma silueta RTT cenital que
                la del personaje (forma real, filo toon). Se anima con su idle. */}
            <SilhouetteShadow
              key={`zoidianshadow:${isMobilePerf ? 1 : 0}`}
              playerRef={zoidianRef}
              enabled={npcsVisibles}
              size={3.8}
              opacity={Boolean(isMobilePerf || degradedMode) ? 0.42 : 0.52}
              resolution={isMobilePerf ? 128 : 192}
              blur={1.0}
              height={7}
            />
          </group>
        )}
        {/* El drone de M.A.D.R.E.: deambula, ofrece la tienda en el portal de Work,
            habla (DialogoMadre en App) y castiga las trampas. Monta desde el
            warm-up como Argus, con su propio Suspense. */}
        {npcsMontados && (
          <group visible={npcsVisibles}>
          <Suspense fallback={null}>
            <DroneNPC
              playerRef={playerRef}
              portals={portals}
              nearPortalId={nearPortalId}
              activo={section === 'home' && homeLanded}
              juegoActivo={sphereGameActive}
              dialogo={dialogoDron}
              puedeHablar={puedeHablarDron}
              onHablar={onHablarDron}
              buscarCorrupta={buscarCorrupta}
            />
          </Suspense>
          </group>
        )}
        {/* Floating "!" — ahora flota ARRIBA del zoidian, mismo trigger.
            Monta desde el warmup y no se desmonta: su luz cuenta para todos los
            materiales iluminados, y aparecer al aterrizar o irse con la sección
            los recompilaba. Lo demás lo decide `visible`. */}
        {mainWarmStage >= 2 && (
          <FloatingExclamation
            position={[0, 4.1, 12.9]}
            color="#f5ff00"
            visible={section === 'home' && !saliendoDeHome && homeLanded && !dialogoArgus}
            onClick={() => { try { onHablarArgus?.() } catch { } }}
          />
        )}
        {/* Player mounts from preloader in prewarm mode (invisible, no loop) to avoid hitch on "Enter" */}
        <Player
          playerRef={playerRef}
          prewarm={bootLoading}
          visible={!bootLoading}
          portals={bootLoading ? [] : portals}
          eggActive={eggActive}
          goldSkinActive={goldSkinModelActive}
          goldSkinTransformActive={goldSkinTransformActive}
          customizeActive={customizeActive || tramaViaje || primerPlano || dialogoDron || dialogoArgus}
          powerEnabled={section === 'home' && !saliendoDeHome && !dialogoDron && !dialogoArgus && !proyectoTapa}
          homeLanded={homeLanded}
          onPortalEnter={bootLoading ? undefined : handlePortalEnter}
          onProximityChange={bootLoading ? undefined : ((f) => {
            // Llamado CADA frame desde el useFrame de Player. Sin dedupe, el lerp
            // asintótico nunca devuelve el mismo número → React re-renderiza por
            // frame. Hacemos el suavizado y, si el delta es imperceptible, devolvemos
            // el MISMO valor para que React haga bail (no re-render). Ver OOM fix.
            setTintFactor((prev) => {
              const base = prev ?? 0
              const next = base + (f - base) * 0.22
              return Math.abs(next - base) < 0.002 ? base : next
            })
          })}
          onPortalsProximityChange={bootLoading ? undefined : ((perPortal) => {
            // perPortal es un objeto NUEVO cada frame → pasar setPortalMixMap directo
            // re-renderiza por frame eternamente (causa raíz del OOM). Dedupe por
            // valor: si ningún portal cambió >0.002, devolvemos el objeto previo
            // (misma referencia) → React hace bail.
            setPortalMixMap((prev) => {
              if (prev) {
                const keys = Object.keys(perPortal)
                let same = keys.length === Object.keys(prev).length
                if (same) {
                  for (const k of keys) {
                    if (Math.abs((prev[k] || 0) - (perPortal[k] || 0)) > 0.002) { same = false; break }
                  }
                }
                if (same) return prev
              }
              return perPortal
            })
          })}
          onNearPortalChange={bootLoading ? undefined : ((id) => {
            setNearPortalId(id)
            // Durante la partida pararse en un portal no prende el marquee: los
            // portales son metas, no puertas (ver gameBlockRef en App).
            if (id && section === 'home' && !sphereGameActive) {
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
          })}
          onReachedPortal={bootLoading ? undefined : ((id) => {
            try { lastPortalIdRef.current = id } catch { }
            if (id && id !== 'home') { try { setMarqueeLabelSection(id) } catch { } }
            setNavTarget(null)
            // Auto-enter: if the user clicked this section from the menu, skip the CTA
            // and trigger the portal transition directly on arrival.
            const autoTarget = autoEnterOnArrivalRef.current
            autoEnterOnArrivalRef.current = null
            if (autoTarget && autoTarget === id && id !== 'home' && !transitionState.active && id !== section) {
              try { setPortraitGlowV((v) => v + 1) } catch { }
              try { if (playerRef.current) prevPlayerPosRef.current.copy(playerRef.current.position) } catch { }
              beginSectionTransition(id)
            }
          })}
          onOrbStateChange={bootLoading ? undefined : ((active) => setOrbActiveUi(active))}
          onMoveStateChange={bootLoading ? undefined : ((moving) => { try { setPlayerMoving(moving) } catch { } })}
          onPulse={bootLoading ? undefined : ((pos, strength, radius) => { try { homeOrbsRef.current?.radialImpulse(pos, strength, radius) } catch { } })}
          onPredictKick={bootLoading ? undefined : ((base, dir, strength, radius, halfAngle, centerY) => {
            try { return homeOrbsRef.current?.predictKick(base, dir, strength, radius, halfAngle, centerY) || [] } catch { return [] }
          })}
          onKick={bootLoading ? undefined : ((pos, dir, strength, radius, skip, base, halfAngle) => {
            // Devuelve la LISTA de impactos (posición + fuerza de cada esfera),
            // no un contador: Player la usa para lanzar chispas en cada punto
            // de contacto y modular el SFX.
            let hits = []
            try { hits = homeOrbsRef.current?.kickImpulse(pos, dir, strength, radius, skip, base, halfAngle) || [] } catch { }
            // el drone de M.A.D.R.E. también se patea (y castiga en el acto)
            try { const d = patadaAlDron(pos, dir, radius, skip, base, halfAngle); if (d) hits = [...hits, d] } catch { }
            // y la Renderbox del claro (la apaga o la prende)
            try { const r = patadaARenderbox(pos, dir, radius, skip, base, halfAngle); if (r) hits = [...hits, r] } catch { }
            return hits
          })}
          onActionCooldown={bootLoading ? undefined : ((r) => { try { setActionCooldown(r) } catch { } })}
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
            try { if (ctaForceTimerRef.current) clearTimeout(ctaForceTimerRef.current) } catch { }
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
            try { setPlayerMeshes(meshes || []) } catch { }
          }}
          outlineEnabled={true}
        />
        {/* Normal-render exclusivo del personaje → EdgeInk (PostFX) entinta sus
            creases sin tocar el resto de la escena. Corre en TODOS los dispositivos
            (incl. mobile/iPad/Tesla). NO atar a degradedMode: ese flag arranca en
            true y es el estado normal de rendering, no una emergencia. */}
        {/* Montado también en bootLoading (prewarm): compila los materiales del
            normal-pass durante el preloader, no en el frame del aterrizaje. */}
        <CharacterNormalPass playerRef={playerRef} prewarm={bootLoading} resolutionScale={isMobilePerf ? 0.85 : 1} />
        <WallpaperEscena playerRef={playerRef} portals={portals} />
        {/* Gold skin activation FX: flash overlay + dissolve particles */}
        <GoldenFlashOverlay active={goldSkinTransformActive} duration={0.5} />
        <GoldenDissolveParticles active={goldSkinTransformActive} playerRef={playerRef} duration={1.3} />
        {/* Sombra de silueta real (RTT cenital): forma del personaje, no un disco.
            NOT en orb mode; oculta durante transiciones desde HOME. */}
        <SilhouetteShadow
          key={`silshadow:${isMobilePerf ? 1 : 0}`}
          playerRef={playerRef}
          prewarm={bootLoading}
          planoEn={wallpaperEstado}
          enabled={Boolean(!bootLoading && comoHome && !orbActiveUi && !saliendoDeHome)}
          size={3.2}
          opacity={Boolean(isMobilePerf || degradedMode) ? 0.42 : 0.52}
          resolution={isMobilePerf ? 160 : 256}
          blur={1.0}
        />
        {mainWarmStage >= 1 && portals.map((p) => {
          const mix = portalMixMap[p.id] || 0
          const targetColor = sectionColors[p.id] || '#ffffff'
          // Antimatter portal: partículas en rojo intenso, no azul default.
          const particleColor = p.antimatter ? '#ff5500' : '#9ec6ff'
          return (
            <FrustumCulledGroup key={p.id} position={p.position} radius={4.5} maxDistance={800} sampleEvery={4}>
              <Portal
                position={[0, 0, 0]}
                color={p.color}
                targetColor={targetColor}
                mix={mix}
                size={2}
                flickerKey={section}
                sectionName={p.name}
                antimatter={p.antimatter}
                juegoId={p.id}
                apagado={Boolean(p.antimatter && !section6Unlocked)}
              />
              {/* Cristal: se arma con el hover del item de menú de ESTA sección
                  o cuando el personaje pisa el portal, y se desarma al salir de
                  los dos. Toma el color del portal, no un verde fijo, para que
                  te diga a dónde vas. */}
              <PortalCrystal
                sectionId={p.id}
                color={targetColor}
                enabled={Boolean(comoHome && !(p.antimatter && !section6Unlocked))}
                near={nearPortalId === p.id}
              />
              {/* Click en el portal = su botón de la nav. El de antimateria
                  queda fuera a propósito: llegar caminando hasta allá ES el
                  reto, y la nav tampoco lo ofrece. */}
              {!p.antimatter && (
                <PortalHitArea
                  sectionId={p.id}
                  enabled={Boolean(portalClickEnabled)}
                  onSelect={onPortalClick}
                  playSfx={playSfx}
                />
              )}
              {(mainWarmStage >= 2) && (
                <PortalParticles
                  center={[0, 0, 0]}
                  radius={4}
                  count={isMobilePerf ? 40 : 220}
                  color={particleColor}
                  targetColor={targetColor}
                  mix={mix}
                  playerRef={playerRef}
                  frenzyRadius={10}
                  apagado={Boolean(p.antimatter && !section6Unlocked)}
                />
              )}
            </FrustumCulledGroup>
          )
        })}
        {/* Babosa de slime oculta (#4) — deambula cerca de los portales pero SOLO
            es visible en modo easter-egg (eggActive). Reto: hay que activar el egg
            y alcanzarla en la ventana. */}
        {mainWarmStage >= 1 && comoHome && (
          <SlimeSlug3D id="wander" position={[2.4, 0.9, -7.5]} scale={0.5} visible={eggActive} />
        )}
        {(() => {
          // Power ready (charge >= 100%). actionCooldown is 1 - charge.
          // Threshold aligned with the bar's glowOn.
          const powerReady = (Math.max(0, Math.min(1, 1 - actionCooldown)) >= 0.98)
          const wantShake = powerReady && section === 'home'
          // Skip shake while player is moving to avoid motion sickness; shake when idle.
          // El empujón de Argus SÍ sacude la cámara (vende el impacto) pero
          // NO enciende el flash blanco del rayo: no hay relámpago, hay un
          // manotazo. Por eso va aparte de boltFlashActive. Ignora
          // `playerMoving`: el golpe pasa justo cuando vas caminando.
          const shakeNow = ((eggActive || boltFlashActive || Boolean(nearPortalId) || wantShake) && !playerMoving) || argusPushShake
          const amp = argusPushShake ? 0.2 : (boltFlashActive ? 0.28 : (eggActive ? 0.11 : (wantShake ? 0.055 : 0.08)))
          const fxX = argusPushShake ? 26.0 : (boltFlashActive ? 28.0 : (eggActive ? 16.0 : (wantShake ? 20.0 : 14.0)))
          const fxY = argusPushShake ? 22.0 : (boltFlashActive ? 24.0 : (eggActive ? 13.0 : (wantShake ? 17.0 : 12.0)))
          const yMul = argusPushShake ? 0.9 : (boltFlashActive ? 1.0 : (eggActive ? 0.75 : (wantShake ? 0.6 : 0.9)))
          return (
            <CameraController
              playerRef={playerRef}
              controlsRefExternal={mainControlsRef}
              playerMoving={playerMoving}
              shakeActive={shakeNow}
              shakeAmplitude={amp}
              shakeFrequencyX={fxX}
              shakeFrequencyY={fxY}
              shakeYMultiplier={yMul}
              // Allow rotation always in HOME; block in section UI
              enabled={section === 'home' ? true : (!showSectionUi && !sectionUiAnimatingOut)}
              followBehind={false}
              mode={cameraMode}
              customizeActive={customizeActive}
              primerPlano={primerPlano}
              dialogo={dialogoDron || dialogoArgus}
              dialogoCon={dialogoArgus ? 'argus' : 'dron'}
              cortaBarrido={proyectoAbierto}
            />
          )
        })()}
        {/* Postprocessing effects — keep in degradedMode, but in lowPerf.
            No se desmonta con la pestaña oculta (2026-11-24): desmontarlo tiraba
            los materiales del composer y al regresar se recompilaban de golpe
            (10 programas: profundidad de campo y bloom). Oculta, el frameloop ya
            va en 'never' y no dibuja nada. */}
        {fxWarm && (mainWarmStage >= 2) && (
          <PostFX
            lowPerf={Boolean(isMobilePerf || degradedMode)}
            isMobile={Boolean(isMobilePerf)}
            eggActiveGlobal={eggActive}
            boltFlashActive={boltFlashActive}
            vhsRewindActive={vhsRewindActive}
            psychoEnabled={Boolean(fx.psychoEnabled)}
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
            transitionWarpStrength={fx.transitionWarpStrength || 0}
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
            dofNitida={fx.dofNitida}
            dofRango={fx.dofRango}
            dofBokehScale={fx.dofBokehScale}
            dofTargetRef={dofTargetRef}
            // Yellow outline for the character
            outlineEnabled={comoHome && !bootLoading}
            outlineMeshes={playerMeshes}
            outlineColor={0xffcc00}
            outlineEdgeStrength={5.0}
          />
        )}
      </>
    </Suspense>
  )
}
