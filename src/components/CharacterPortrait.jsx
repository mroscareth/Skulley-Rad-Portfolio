import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { EffectComposer, DotScreen, Glitch, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction, GlitchMode } from 'postprocessing'

function CharacterModel({ modelRef, glowVersion = 0 }) {
  const { scene, animations } = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true,
    true,
    (loader) => {
      try {
        const ktx2 = new KTX2Loader()
        ktx2.setTranscoderPath('https://unpkg.com/three@0.179.1/examples/jsm/libs/basis/')
        // @ts-ignore optional API
        if (loader.setKTX2Loader) loader.setKTX2Loader(ktx2)
      } catch {}
    },
  )
  // Clonar profundamente para no compartir jerarquías/skin con el jugador
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene])
  // Aislar materiales del retrato para que no compartan instancia con el Player
  useEffect(() => {
    if (!cloned) return
    try {
      cloned.traverse((obj) => {
        if (obj && obj.isMesh && obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map((m) => {
              const mm = m?.isMaterial ? m.clone() : m
              if (mm && mm.isMaterial) {
                mm.transparent = false
                mm.opacity = 1
                mm.depthWrite = true
                mm.userData = { ...(mm.userData || {}), __portraitMaterial: true }
              }
              return mm
            })
          } else if (obj.material.isMaterial) {
            const mm = obj.material.clone()
            mm.transparent = false
            mm.opacity = 1
            mm.depthWrite = true
            mm.userData = { ...(mm.userData || {}), __portraitMaterial: true }
            obj.material = mm
          }
        }
      })
    } catch {}
  }, [cloned])
  const { actions } = useAnimations(animations, cloned)
  const matUniformsRef = useRef(new Map())
  const materialsRef = useRef(new Set())
  const emissiveBaseRef = useRef(new Map())
  const glowColorRef = useRef(new THREE.Color('#ffd480'))
  const glowAmountRef = useRef(0)
  const PERMA_GLOW = true
  const prevGlowVRef = useRef(glowVersion)

  // Seleccionar clip de idle explícito si existe; si no, usar heurística
  const idleName = useMemo(() => {
    const names = actions ? Object.keys(actions) : []
    const explicitIdle = 'root|root|Iddle'
    if (names.includes(explicitIdle)) return explicitIdle
    return names.find((n) => n.toLowerCase().includes('idle')) || names[0]
  }, [actions])

  useEffect(() => {
    if (!actions || !idleName) return
    Object.values(actions).forEach((a) => a.stop())
    const idle = actions[idleName]
    if (idle) idle.reset().fadeIn(0.1).play()
  }, [actions, idleName])

  // Inject emissive glow uniform into materials and cache base emissive
  useEffect(() => {
    if (!cloned) return
    matUniformsRef.current.clear()
    materialsRef.current.clear()
    try {
      cloned.traverse((obj) => {
        if (!obj || !obj.isMesh || !obj.material) return
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach((mm) => {
          if (!mm || !mm.isMaterial) return
          materialsRef.current.add(mm)
          try {
            if (mm.emissive) {
              emissiveBaseRef.current.set(mm, { color: mm.emissive.clone(), intensity: typeof mm.emissiveIntensity === 'number' ? mm.emissiveIntensity : 1 })
            }
          } catch {}
          const original = mm.onBeforeCompile
          mm.onBeforeCompile = (shader) => {
            try {
              shader.uniforms.uGlow = { value: 0 }
              shader.uniforms.uGlowColor = { value: new THREE.Color('#ffe9b0') }
              const target = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );'
              const repl = `
                vec3 _outGlow = outgoingLight + uGlowColor * (uGlow * 3.0);
                gl_FragColor = vec4(_outGlow, diffuseColor.a );
              `
              if (shader.fragmentShader.includes(target)) {
                shader.fragmentShader = shader.fragmentShader.replace(target, repl)
              }
              matUniformsRef.current.set(mm, shader.uniforms)
            } catch {}
            if (typeof original === 'function') try { original(shader) } catch {}
          }
          mm.needsUpdate = true
        })
      })
    } catch {}
  }, [cloned])

  // Trigger glow on version change
  useEffect(() => {
    if (glowVersion !== prevGlowVRef.current) {
      prevGlowVRef.current = glowVersion
      glowAmountRef.current = 1.0
    }
  }, [glowVersion])

  useFrame((_, delta) => {
    const val = PERMA_GLOW ? 1.0 : glowAmountRef.current
    if (!PERMA_GLOW) {
      if (glowAmountRef.current <= 0) return
      glowAmountRef.current = Math.max(0, glowAmountRef.current * (1 - 2 * delta))
    }
    matUniformsRef.current.forEach((u) => {
      if (u && u.uGlow) u.uGlow.value = val
    })
    // Also drive emissive properties so the whole model glows clearly
    materialsRef.current.forEach((mm) => {
      try {
        const base = emissiveBaseRef.current.get(mm)
        if (!base || !mm.emissive) return
        mm.emissive.copy(glowColorRef.current)
        mm.emissiveIntensity = Math.max(0, (base.intensity || 1) + 8.0 * val)
      } catch {}
    })
  })

  // Posicionar el modelo para que se vea la cabeza dentro de la cápsula
  return (
    <group position={[0, -1.45, 0]}>
      <primitive ref={modelRef} object={cloned} scale={1.65} />
    </group>
  )
}

function CameraAim({ modelRef }) {
  const { camera } = useThree()
  const headObjRef = useRef(null)
  const tmp = useRef({ target: new THREE.Vector3(), size: new THREE.Vector3(), box: new THREE.Box3() })

  useEffect(() => {
    if (!modelRef.current) return
    let found = null
    modelRef.current.traverse((o) => {
      if (!found && o.name && /head/i.test(o.name)) found = o
    })
    headObjRef.current = found
  }, [modelRef])

  useFrame(() => {
    if (!modelRef.current) return
    const { target, size, box } = tmp.current
    if (headObjRef.current) {
      headObjRef.current.getWorldPosition(target)
    } else {
      box.setFromObject(modelRef.current)
      box.getCenter(target)
      box.getSize(size)
      target.y = box.max.y - size.y * 0.1
    }
    camera.lookAt(target)
  })
  return null
}

function SyncOrthoCamera({ y, zoom }) {
  const { camera } = useThree()
  useFrame(() => {
    if (!camera) return
    // Fijar una pose estable de cámara ortográfica para evitar desviaciones entre recargas
    camera.position.set(0, y, 10)
    camera.rotation.set(0, 0, 0)
    if (typeof camera.zoom === 'number') camera.zoom = zoom
    camera.updateProjectionMatrix()
  })
  return null
}

function EggCameraShake({ active, amplitude = 0.012, rot = 0.005, frequency = 18, burstUntilRef }) {
  const { camera } = useThree()
  const base = useRef({ pos: camera.position.clone(), rot: camera.rotation.clone() })
  useEffect(() => {
    return () => {
      // restaurar cámara al desmontar
      camera.position.copy(base.current.pos)
      camera.rotation.copy(base.current.rot)
    }
  }, [camera])
  useFrame((state) => {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const burstActive = Boolean(burstUntilRef?.current && now < burstUntilRef.current)
    const isActive = active || burstActive
    if (!isActive) {
      camera.position.lerp(base.current.pos, 0.2)
      camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, base.current.rot.x, 0.2)
      camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, base.current.rot.y, 0.2)
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, base.current.rot.z, 0.2)
      return
    }
    const t = state.clock.getElapsedTime()
    const ampNow = burstActive ? amplitude * 4 : amplitude
    const rotNow = burstActive ? rot * 3 : rot
    const freqNow = burstActive ? frequency * 1.25 : frequency
    const ax = Math.sin(t * freqNow) * ampNow
    const ay = Math.cos(t * (freqNow * 1.27)) * ampNow * 0.75
    const az = (Math.sin(t * (freqNow * 0.83)) + Math.sin(t * (freqNow * 1.91))) * 0.5 * ampNow * 0.6
    camera.position.x = base.current.pos.x + ax
    camera.position.y = base.current.pos.y + ay
    camera.position.z = base.current.pos.z + az
    camera.rotation.z = base.current.rot.z + Math.sin(t * (freqNow * 0.6)) * rotNow
  })
  return null
}

function PinBackLight({ modelRef, intensity, angle, penumbra, posY, posZ, color }) {
  const lightRef = useRef(null)
  const targetRef = useRef(null)
  const headObjRef = useRef(null)
  const tmp = useRef({ target: new THREE.Vector3(), size: new THREE.Vector3(), box: new THREE.Box3() })

  useEffect(() => {
    if (!modelRef.current) return
    let found = null
    modelRef.current.traverse((o) => {
      if (!found && o.name && /head/i.test(o.name)) found = o
    })
    headObjRef.current = found
  }, [modelRef])

  useFrame(() => {
    if (!lightRef.current || !targetRef.current || !modelRef.current) return
    const { target, size, box } = tmp.current
    if (headObjRef.current) {
      headObjRef.current.getWorldPosition(target)
    } else {
      box.setFromObject(modelRef.current)
      box.getCenter(target)
      box.getSize(size)
      target.y = box.max.y - size.y * 0.1
    }
    // Colocar target en la cabeza y apuntar el foco
    targetRef.current.position.copy(target)
    lightRef.current.target = targetRef.current
    lightRef.current.target.updateMatrixWorld()
  })

  return (
    <>
      {/* Luz puntual/spot detrás del modelo para rim light */}
      <spotLight
        ref={lightRef}
        position={[0, posY, posZ]}
        angle={angle}
        penumbra={penumbra}
        intensity={intensity}
        color={color}
      />
      <object3D ref={targetRef} />
    </>
  )
}

export default function CharacterPortrait({
  dotEnabled = true,
  dotScale = 1,
  dotAngle = Math.PI / 4,
  dotCenterX = 0.38,
  dotCenterY = 0.44,
  dotOpacity = 0.04,
  dotBlend = 'screen',
  showUI = true,
  onEggActiveChange,
  glowVersion = 0,
}) {
  const modelRef = useRef()
  const containerRef = useRef(null)
  const portraitRef = useRef(null)
  // Límites de cámara: maximos dados por el usuario
  const CAM_Y_MAX = 0.8
  const CAM_Y_MIN = -1.0
  const ZOOM_MAX = 160
  const ZOOM_MIN = 15
  const clickShakeUntilRef = useRef(0)
  // Detección local de perfil móvil/low‑perf para optimizar el retrato
  const isLowPerf = React.useMemo(() => {
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
  // Controles de luz (ajustables por el usuario)
  const [lightIntensity, setLightIntensity] = useState(20)
  const [lightAngle, setLightAngle] = useState(1)
  const [lightPenumbra, setLightPenumbra] = useState(0.28)
  const [lightPosY, setLightPosY] = useState(2.7)
  const [lightPosZ, setLightPosZ] = useState(-0.2)
  const [lightColor, setLightColor] = useState('#ffffff')
  const [copied, setCopied] = useState(false)

  // Cursor personalizado (slap.svg) dentro del retrato
  const [cursorVisible, setCursorVisible] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [cursorScale, setCursorScale] = useState(1)
  // Cámara libre vertical (sin lookAt forzado) y zoom sin distorsión
  const [camY, setCamY] = useState(CAM_Y_MAX)
  const [camZoom, setCamZoom] = useState(ZOOM_MAX)
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ y: 0, camY: CAM_Y_MAX })

  // Audio de click (punch) con polifonía: pool de instancias
  const clickAudioPoolRef = useRef([])
  const clickAudioIdxRef = useRef(0)
  const audioCtxRef = useRef(null)
  const audioBufferRef = useRef(null)
  useEffect(() => {
    const POOL_SIZE = 8
    const pool = new Array(POOL_SIZE).fill(null).map(() => {
      const a = new Audio(`${import.meta.env.BASE_URL}punch.mp3`)
      a.preload = 'auto'
      a.volume = 0.8
      try { a.load() } catch {}
      return a
    })
    clickAudioPoolRef.current = pool
    return () => {
      clickAudioPoolRef.current = []
    }
  }, [])

  // Web Audio: precargar y decodificar el audio para latencia casi cero
  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    audioCtxRef.current = ctx
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}punch.mp3`, { cache: 'force-cache' })
        const arr = await res.arrayBuffer()
        const buf = await ctx.decodeAudioData(arr)
        if (!cancelled) audioBufferRef.current = buf
      } catch {}
    })()
    return () => {
      cancelled = true
      try { ctx.close() } catch {}
    }
  }, [])

  // Easter egg: multi‑click en el retrato
  const eggPhrases = useMemo(
    () => [
      "Even after life, you poke my very soul to make your logo bigger? Let me rest…",
      "Yeah, a graphic designer's job is also to entertain you, right?",
      "Fuck off, I'm tired of you…",
      "Did you know that this is considered bullying, right?",
      "Everything OK at home?",
      "So this is what it feels like not being registered in social security?",
      "“Let me rest… go away, dude!”",
      "If you keep poking my soul, I will not make your logo bigger.",
      "I'm sending you an invoice for this, OK?",
      "I will report you for using pirate software.",
      "¡Deja de chingar! …That's what my uncle says when he's mad.",
    ],
    [],
  )
  const [eggActive, setEggActive] = useState(false)
  const [eggPhrase, setEggPhrase] = useState('')
  const eggTimerRef = useRef(null)
  const eggStyleTimerRef = useRef(null)
  const clickCountRef = useRef(0)
  const lastClickTsRef = useRef(0)
  const eggActiveRef = useRef(false)
  useEffect(() => { eggActiveRef.current = eggActive }, [eggActive])

  async function handlePortraitClick() {
    // Burst de shake de cámara del retrato (≈ 480ms)
    const nowTs = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    clickShakeUntilRef.current = nowTs + 480
    // Animación de cursor más grande con ligero rebote al hacer click
    setCursorScale(1.9)
    window.setTimeout(() => setCursorScale(0.96), 110)
    window.setTimeout(() => setCursorScale(1.08), 200)
    window.setTimeout(() => setCursorScale(1), 280)
    // Sonido punch (Web Audio preferido para baja latencia)
    let played = false
    const ctx = audioCtxRef.current
    const buffer = audioBufferRef.current
    if (ctx && buffer) {
      try { if (ctx.state !== 'running') await ctx.resume() } catch {}
      try {
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = 0.9
        src.connect(gain).connect(ctx.destination)
        src.start(0)
        played = true
      } catch {}
    }
    // Fallback a HTMLAudio pool si Web Audio falla
    if (!played) {
      const pool = clickAudioPoolRef.current
      if (pool && pool.length) {
        const i = clickAudioIdxRef.current % pool.length
        clickAudioIdxRef.current += 1
        const a = pool[i]
        try { a.currentTime = 0 } catch {}
        try { a.play() } catch {}
      }
    }
    const now = Date.now()
    const delta = now - lastClickTsRef.current
    if (delta > 600) {
      clickCountRef.current = 0
    }
    lastClickTsRef.current = now
    clickCountRef.current += 1
    if (clickCountRef.current > 3 && !eggActive) {
      const phrase = eggPhrases[Math.floor(Math.random() * eggPhrases.length)]
      setEggPhrase(phrase)
      setEggActive(true)
      if (typeof onEggActiveChange === 'function') onEggActiveChange(true)
      setBubbleText(phrase)
      setShowBubble(true)
      setBubbleTheme('egg')
      // Cancelar timers de viñetas normales
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      // Posicionar como en flujo normal
      requestAnimationFrame(() => {
        const contEl = containerRef.current
        const bubbleEl = bubbleRef.current
        if (contEl && bubbleEl) {
          const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
          const c = contEl.getBoundingClientRect()
          const b = bubbleEl.getBoundingClientRect()
          const marginRight = -18
          const marginTop = -18
          let rightTop = clamp(c.top + c.height * 0.25 - b.height * 0.3, 8, window.innerHeight - b.height - 8)
          let rightLeft = c.right + marginRight
          const fitsRight = rightLeft + b.width <= window.innerWidth - 8
          let topTop = c.top - b.height - marginTop
          let topLeft = clamp(c.left + c.width / 2 - b.width / 2, 8, window.innerWidth - b.width - 8)
          const fitsTop = topTop >= 8
          let placedTop = 0
          let placedLeft = 0
          if (fitsRight) {
            setBubbleSide('right')
            placedTop = rightTop
            placedLeft = rightLeft
          } else if (fitsTop) {
            setBubbleSide('top')
            placedTop = topTop
            placedLeft = topLeft
          } else {
            setBubbleSide('right')
            rightLeft = clamp(rightLeft, 8, window.innerWidth - b.width - 8)
            placedTop = rightTop
            placedLeft = rightLeft
          }
          setBubblePos({ top: placedTop, left: placedLeft })
          const bCenterX = placedLeft + b.width / 2
          const bCenterY = placedTop + b.height / 2
          const targetX = c.left + c.width * 0.1
          const targetY = c.top + c.height * 0.35
          const ang = Math.atan2(targetY - bCenterY, targetX - bCenterX)
          const anchorX = b.width / 2 + Math.cos(ang) * (b.width / 2 - 6)
          const anchorY = b.height / 2 + Math.sin(ang) * (b.height / 2 - 6)
          const offset = 10
          const cx = anchorX + Math.cos(ang) * offset
          const cy = anchorY + Math.sin(ang) * offset
          setTail({ x: anchorX, y: anchorY, cx, cy, angleDeg: (ang * 180) / Math.PI })
        }
      })
      // Unificar fin del egg y viñeta
      const EGG_MS = 7000
      if (eggStyleTimerRef.current) window.clearTimeout(eggStyleTimerRef.current)
      eggStyleTimerRef.current = window.setTimeout(() => {
        setBubbleTheme('normal')
      }, EGG_MS)
      clickCountRef.current = 0
      if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current)
      eggTimerRef.current = window.setTimeout(() => {
        setShowBubble(false)
        setEggActive(false)
        setEggPhrase('')
        setBubbleTheme('normal')
        if (typeof onEggActiveChange === 'function') onEggActiveChange(false)
        // reanudar normal
        const delayBack = 800
        showTimerRef.current = window.setTimeout(() => {
          if (!eggActiveRef.current) {
            const next = phrases[Math.floor(Math.random() * phrases.length)]
            setBubbleText(next)
            setShowBubble(true)
          }
        }, delayBack)
      }, EGG_MS)
    }
  }

  function handleMouseEnter() {
    setCursorVisible(true)
    const ctx = audioCtxRef.current
    if (ctx && ctx.state !== 'running') {
      // Intentar reanudar en primer gesto del usuario para eliminar latencia del primer click
      ctx.resume().catch(() => {})
    }
  }
  function handleMouseLeave() { setCursorVisible(false); draggingRef.current = false }
  function handleMouseMove(e) {
    const el = portraitRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCursorPos({ x: e.clientX - r.left, y: e.clientY - r.top })
    if (draggingRef.current) {
      const dy = e.clientY - dragStartRef.current.y
      const next = dragStartRef.current.camY - dy * 0.01
      setCamY(Math.max(CAM_Y_MIN, Math.min(CAM_Y_MAX, next)))
    }
  }
  function handleMouseDown(e) {
    draggingRef.current = true
    dragStartRef.current = { y: e.clientY, camY }
  }
  function handleMouseUp() { draggingRef.current = false }
  function handleWheel(e) {
    const next = camZoom - e.deltaY * 0.06
    setCamZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next)))
  }

  // Frases estilo cómic
  const phrases = useMemo(
    () => [
      // Frase larga adicional
      `Yeah, well, AI killed graphic designers and here i am, fucking entertaining you...`,
      // Primer bloque de 30
      `I didn’t starve, I was just doing intermittent fasting… forever.`,
      `Turns out my portfolio wasn’t compatible with ChatGPT.`,
      `I asked MidJourney for food, it gave me a moodboard.`,
      `AI ate my job, so I ate… nothing.`,
      `They said design feeds the soul. Pity it doesn’t feed the stomach.`,
      `At least my hunger pangs come in a nice minimalist grid.`,
      `I died in Helvetica Bold, not Comic Sans.`,
      `Clients still ghosted me… now permanently.`,
      `AI doesn’t sleep, but apparently I don’t eat.`,
      `At my funeral, please kerning the flowers properly.`,
      `I asked DALL·E for bread… it gave me a surrealist painting of toast.`,
      `Even my gravestone has better alignment than my old invoices.`,
      `AI doesn’t get paid, but neither did I.`,
      `Starving for art was supposed to be metaphorical.`,
      `At least my hunger made me pixel-perfect thin.`,
      `My last meal was RGB soup with a side of CMYK crumbs.`,
      `No one wanted to pay for logos, but hey, I died branded.`,
      `AI makes logos in 5 seconds. I made one in 5 days… then died.`,
      `My obituary will be in Arial, because I wasn’t worth a typeface license.`,
      `I thought I was irreplaceable. AI thought otherwise.`,
      `Hungry, but at least my color palette was vibrant.`,
      `They asked for unlimited revisions. I gave them unlimited silence.`,
      `I went from freelancing to free starving.`,
      `AI doesn’t complain about exposure. I just died from it.`,
      `Design used to keep me alive. Now it’s just keeping my Behance alive.`,
      `I tried to barter my Photoshop skills for tacos. Didn’t work.`,
      `The only thing left aligned in my life was my coffin.`,
      `I asked for a client brief. Life gave me a death brief.`,
      `AI makes mistakes too… but at least it doesn’t need lunch.`,
      `I’m not gone, I’m just on the ultimate creative break.`,
      // Segundo bloque de 30
      `I used to design posters. Now I’m the poster child of unemployment.`,
      `My diet? Strictly vector-based.`,
      `Clients said: ‘Can you make it pop?’ — my stomach did.`,
      `I always wanted to be timeless. Death helped.`,
      `I finally reached negative space: my fridge.`,
      `I exported myself… as a ghost.`,
      `They paid me in exposure. Turns out exposure kills.`,
      `At least AI can’t feel hunger… lucky bastard.`,
      `I designed my own tombstone. Minimalist. No budget.`,
      `I was 99% caffeine, 1% hope.`,
      `Starved, but hey—my resume is still responsive.`,
      `I left life on draft mode.`,
      `They said design is forever. Guess rent isn’t.`,
      `No more clients asking for ‘one last change’… finally.`,
      `My life was low budget, but high resolution.`,
      `I aligned everything… except my destiny.`,
      `AI took my clients. Hunger took my soul.`,
      `I’m trending now… in the obituary section.`,
      `I wanted to go viral. Ended up going vital… signs flat.`,
      `I kerning-ed myself into the grave.`,
      `The only thing scalable now is my skeleton.`,
      `I asked life for balance. It gave me imbalance and starvation.`,
      `They’ll miss me when AI starts using Comic Sans.`,
      `I worked for peanuts… wish I had actual peanuts.`,
      `Dead, but at least I’m vector — infinitely scalable.`,
      `They automated design. Can they automate tacos too?`,
      `Death was my final deadline.`,
      `AI makes perfect gradients. Mine was starvation to extinction.`,
      `I asked the universe for feedback. It replied: ‘Looks good, but you’re gone.’`,
      `I didn’t lose my job. I just Ctrl+Z’d out of existence.`,
    ],
    [],
  )

  const [showBubble, setShowBubble] = useState(false)
  const [bubbleText, setBubbleText] = useState('')
  const bubbleRef = useRef(null)
  const [bubblePos, setBubblePos] = useState({ top: -9999, left: -9999 })
  const [bubbleSide, setBubbleSide] = useState('right')
  const [tail, setTail] = useState({ x: 0, y: 0, cx: 0, cy: 0, angleDeg: 0 })
  const [posReady, setPosReady] = useState(false)
  const [bubbleTheme, setBubbleTheme] = useState('normal')
  const showTimerRef = useRef(null)
  const hideTimerRef = useRef(null)

  useEffect(() => {
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
    function scheduleNext() {
      const delay = 4000 + Math.random() * 5000
      showTimerRef.current = window.setTimeout(() => {
        if (eggActiveRef.current) { scheduleNext(); return }
        const next = phrases[Math.floor(Math.random() * phrases.length)]
        setBubbleText(next)
        setShowBubble(true)
        setPosReady(false)
        requestAnimationFrame(() => {
          const contEl = containerRef.current
          const bubbleEl = bubbleRef.current
          if (!contEl || !bubbleEl) return
          const c = contEl.getBoundingClientRect()
          const b = bubbleEl.getBoundingClientRect()
          const marginRight = -18
          const marginTop = -18
          let rightTop = clamp(c.top + c.height * 0.25 - b.height * 0.3, 8, window.innerHeight - b.height - 8)
          let rightLeft = c.right + marginRight
          const fitsRight = rightLeft + b.width <= window.innerWidth - 8
          let topTop = c.top - b.height - marginTop
          let topLeft = clamp(c.left + c.width / 2 - b.width / 2, 8, window.innerWidth - b.width - 8)
          const fitsTop = topTop >= 8
          let placedTop = 0
          let placedLeft = 0
          if (fitsRight) { setBubbleSide('right'); placedTop = rightTop; placedLeft = rightLeft }
          else if (fitsTop) { setBubbleSide('top'); placedTop = topTop; placedLeft = topLeft }
          else { setBubbleSide('right'); rightLeft = clamp(rightLeft, 8, window.innerWidth - b.width - 8); placedTop = rightTop; placedLeft = rightLeft }
          setBubblePos({ top: placedTop, left: placedLeft })
          const bCenterX = placedLeft + b.width / 2
          const bCenterY = placedTop + b.height / 2
          const targetX = c.left + c.width * 0.1
          const targetY = c.top + c.height * 0.35
          const ang = Math.atan2(targetY - bCenterY, targetX - bCenterX)
          const anchorX = b.width / 2 + Math.cos(ang) * (b.width / 2 - 6)
          const anchorY = b.height / 2 + Math.sin(ang) * (b.height / 2 - 6)
          const offset = 10
          const cx = anchorX + Math.cos(ang) * offset
          const cy = anchorY + Math.sin(ang) * offset
          setTail({ x: anchorX, y: anchorY, cx, cy, angleDeg: (ang * 180) / Math.PI })
          setPosReady(true)
        })
        const visibleFor = 6500 + Math.random() * 3000
        hideTimerRef.current = window.setTimeout(() => {
          setShowBubble(false)
          setBubbleTheme('normal')
          scheduleNext()
        }, visibleFor)
      }, delay)
    }
    scheduleNext()
    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [phrases])

  const handleCopy = async () => {
    const snippet = `{
  "intensity": ${lightIntensity},
  "angle": ${lightAngle},
  "penumbra": ${lightPenumbra},
  "posY": ${lightPosY},
  "posZ": ${lightPosZ},
  "color": "${lightColor}"
}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet)
      } else {
        const ta = document.createElement('textarea')
        ta.value = snippet
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch (e) {
      console.warn('No se pudo copiar al portapapeles', e)
    }
  }
  return (
    <div ref={containerRef} className="fixed left-10 bottom-10 flex gap-3 items-end">
      {showBubble && (
        <div
          ref={bubbleRef}
          className={`pointer-events-none fixed z-50 max-w-56 px-3 py-2.5 rounded-[18px] border-[3px] text-[13px] leading-snug shadow-[6px_6px_0_#000] rotate-[-1.5deg] ${bubbleTheme === 'egg' ? 'bg-black border-black text-white' : 'bg-[#fff7df] border-black text-black'}`}
          style={{ top: bubblePos.top, left: bubblePos.left }}
        >
          {/* Overlay halftone suave para estética cómic */}
          {bubbleTheme === 'normal' && (
            <div
              className="pointer-events-none absolute inset-0 opacity-15 mix-blend-multiply rounded-[16px]"
              style={{
                backgroundImage:
                  'radial-gradient(currentColor 1px, transparent 1px), radial-gradient(currentColor 1px, transparent 1px)',
                backgroundSize: '10px 10px, 10px 10px',
                backgroundPosition: '0 0, 5px 5px',
                color: '#111',
              }}
            />
          )}
          {/* Borde interior sutil */}
          <div className="absolute inset-0 rounded-[16px] border border-black/20 pointer-events-none" />
          {/* Texto */}
          <div className="relative font-semibold tracking-wide px-2 text-center uppercase text-[14px] sm:text-[15px]" style={{ fontFamily: '"Comic Neue", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' }}>{bubbleText}</div>

          {/* Cola orientada al personaje usando un rombo rotado (contorno + relleno) */}
          <div
            className={`absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 ${bubbleTheme === 'egg' ? 'bg-white' : 'bg-black'}`}
            style={{ left: `${tail.x}px`, top: `${tail.y}px`, transform: `translate(-50%, -50%) rotate(${tail.angleDeg}deg)` }}
          />
          <div
            className={`absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 ${bubbleTheme === 'egg' ? 'bg-black' : 'bg-[#fff7df]'}`}
            style={{ left: `${tail.cx}px`, top: `${tail.cy}px`, transform: `translate(-50%, -50%) rotate(${tail.angleDeg}deg)` }}
          />
        </div>
      )}
      {/* Cápsula del retrato (clickable para easter egg) */}
      <div
        ref={portraitRef}
        className={`pointer-events-auto cursor-pointer relative w-44 h-72 sm:w-48 sm:h-80 rounded-full overflow-hidden border border-white/20 shadow-lg transform-gpu will-change-transform transition-transform duration-200 ease-out hover:scale-105 ${eggActive ? 'bg-red-600' : 'bg-[#06061D]'}`}
        onClick={handlePortraitClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        aria-label="Retrato personaje"
        title=""
        style={{ cursor: 'none' }}
      >
        <Canvas
          dpr={[1, isLowPerf ? 1.2 : 1.5]}
          orthographic
          camera={{ position: [0, camY, 10], zoom: camZoom, near: -100, far: 100 }}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false }}
        >
          {/* Sincronizar cámara ortográfica con estados camY/camZoom */}
          <SyncOrthoCamera y={camY} zoom={camZoom} />
          <ambientLight intensity={0.8} />
          <directionalLight intensity={0.7} position={[2, 3, 3]} />
          <CharacterModel modelRef={modelRef} glowVersion={glowVersion} />
          {/* Mantener cámara ortográfica apuntando al frente */}
          <group position={[0, 0, 0]} />
          {/* Cámara libre: sin lookAt forzado; sin shake para precisión de encuadre */}
          <PinBackLight
            modelRef={modelRef}
            intensity={lightIntensity}
            angle={lightAngle}
            penumbra={lightPenumbra}
            posY={lightPosY}
            posZ={lightPosZ}
            color={lightColor}
          />
          {/* Composer de postproceso del retrato */}
          <EffectComposer multisampling={0} disableNormalPass>
            {dotEnabled && (
              <DotScreen
                blendFunction={{
                  normal: BlendFunction.NORMAL,
                  multiply: BlendFunction.MULTIPLY,
                  screen: BlendFunction.SCREEN,
                  overlay: BlendFunction.OVERLAY,
                  softlight: BlendFunction.SOFT_LIGHT,
                  add: BlendFunction.ADD,
                  darken: BlendFunction.DARKEN,
                  lighten: BlendFunction.LIGHTEN,
                }[(dotBlend || 'normal').toLowerCase()] || BlendFunction.NORMAL}
                angle={dotAngle}
                scale={dotScale}
                center={[dotCenterX, dotCenterY]}
                opacity={dotOpacity}
              />
            )}
            {eggActive && (
              <>
                <ChromaticAberration offset={[0.012, 0.009]} />
                <Glitch
                  delay={[0.02, 0.06]}
                  duration={[0.6, 1.4]}
                  strength={[1.0, 1.8]}
                  mode={GlitchMode.CONSTANT}
                  active
                  columns={0.006}
                />
              </>
            )}
          </EffectComposer>
        </Canvas>
        {/* Cursor personalizado tipo slap que sigue al mouse dentro del retrato */}
        <img
          src={`${import.meta.env.BASE_URL}slap.svg`}
          alt="slap"
          draggable="false"
          className="pointer-events-none select-none absolute"
          style={{
            left: `${cursorPos.x}px`,
            top: `${cursorPos.y}px`,
            width: '80px',
            height: '80px',
            transform: `translate(-50%, -50%) scale(${cursorScale})`,
            opacity: cursorVisible ? 1 : 0,
            transition: 'transform 90ms ease-out, opacity 120ms ease-out',
          }}
        />
        {/* Overlay de frase del easter egg (el texto ahora vive en la viñeta; retirado del retrato) */}
      </div>
      {/* Controles de luz (interactivos) */}
      {showUI && (
        <div className="pointer-events-auto select-none p-2 rounded-md bg-black/50 text-white w-52 space-y-2">
          <div className="text-xs font-semibold opacity-90">UI de retrato</div>
          {/* Cámara */}
          <div className="text-[11px] font-medium opacity-80 mt-1">Cámara</div>
          <label className="block text-[11px] opacity-80">Altura Y: {camY.toFixed(2)}
            <input
              className="w-full"
              type="range"
              min={CAM_Y_MIN}
              max={CAM_Y_MAX}
              step="0.01"
              value={camY}
              onChange={(e) => setCamY(parseFloat(e.target.value))}
            />
          </label>
          <label className="block text-[11px] opacity-80">Zoom: {Math.round(camZoom)}
            <input
              className="w-full"
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step="1"
              value={camZoom}
              onChange={(e) => setCamZoom(parseFloat(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
            onClick={async () => {
              const preset = JSON.stringify({ camY: parseFloat(camY.toFixed(2)), camZoom: Math.round(camZoom) }, null, 2)
              try { await navigator.clipboard.writeText(preset) } catch {
                const ta = document.createElement('textarea'); ta.value = preset; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
              }
            }}
          >Copiar preset Cámara</button>
          <div className="h-px bg-white/10 my-1" />
          <div className="text-[11px] font-medium opacity-80">Luz</div>
          <label className="block text-[11px] opacity-80">Intensidad: {lightIntensity.toFixed(1)}
            <input
              className="w-full"
              type="range"
              min="0"
              max="20"
              step="0.1"
              value={lightIntensity}
              onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
            />
          </label>
          <label className="block text-[11px] opacity-80">Ángulo: {lightAngle.toFixed(2)}
            <input
              className="w-full"
              type="range"
              min="0.1"
              max="1.0"
              step="0.01"
              value={lightAngle}
              onChange={(e) => setLightAngle(parseFloat(e.target.value))}
            />
          </label>
          <label className="block text-[11px] opacity-80">Penumbra: {lightPenumbra.toFixed(2)}
            <input
              className="w-full"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={lightPenumbra}
              onChange={(e) => setLightPenumbra(parseFloat(e.target.value))}
            />
          </label>
          <div className="flex gap-2">
            <label className="flex-1 block text-[11px] opacity-80">Altura Y
              <input
                className="w-full"
                type="range"
                min="1.0"
                max="3.5"
                step="0.05"
                value={lightPosY}
                onChange={(e) => setLightPosY(parseFloat(e.target.value))}
              />
            </label>
            <label className="flex-1 block text-[11px] opacity-80">Dist Z
              <input
                className="w-full"
                type="range"
                min="-3.0"
                max="-0.2"
                step="0.02"
                value={lightPosZ}
                onChange={(e) => setLightPosZ(parseFloat(e.target.value))}
              />
            </label>
          </div>
          <div className="flex items-center justify-between text-[11px] opacity-80">
            <span>Color</span>
            <input
              type="color"
              value={lightColor}
              onChange={(e) => setLightColor(e.target.value)}
              className="h-6 w-10 bg-transparent border-0 outline-none cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
          >
            {copied ? '¡Copiado!' : 'Copiar valores'}
          </button>
        </div>
      )}
    </div>
  )
}

// Preload del modelo
useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`)


