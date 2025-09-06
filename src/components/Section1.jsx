import React from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import * as THREE from 'three'

const PLACEHOLDER_ITEMS = Array.from({ length: 6 }).map((_, i) => ({
  id: `item-${i}`,
  title: `Proyecto ${i + 1}`,
  image: `${import.meta.env.BASE_URL}Etherean.jpg`,
}))

// Export util para pre-cargar imágenes desde el preload del CTA
export function getWorkImageUrls() {
  try {
    // Un solo asset local es suficiente (cacheado por el navegador)
    return [`${import.meta.env.BASE_URL}Etherean.jpg`]
  } catch {
    return []
  }
}

export default function Section1({ scrollerRef, scrollbarOffsetRight = 0 }) {
  const [items] = React.useState(PLACEHOLDER_ITEMS)
  const [hover, setHover] = React.useState({ active: false, title: '', x: 0, y: 0 })
  const listRef = React.useRef(null)
  const rafRef = React.useRef(0)
  const lastUpdateRef = React.useRef(0)
  const hoverTiltRef = React.useRef({ el: null, rx: 0, ry: 0 })
  const invalidateRef = React.useRef(null)
  const [overlayKey, setOverlayKey] = React.useState(0)
  const degradedRef = React.useRef(false)

  const onEnter = (e, it) => setHover({ active: true, title: it.title, x: e.clientX, y: e.clientY })
  const onMove = (e) => setHover((h) => ({ ...h, x: e.clientX, y: e.clientY }))
  const onLeave = () => setHover({ active: false, title: '', x: 0, y: 0 })

  const renderItems = React.useMemo(() => {
    const REPEATS = 12
    const out = []
    for (let r = 0; r < REPEATS; r++) {
      for (let i = 0; i < items.length; i++) {
        out.push({ key: `r${r}-i${i}`, i, r, item: items[i] })
      }
    }
    return out
  }, [items])

  React.useEffect(() => {
    const scroller = scrollerRef?.current
    const container = listRef.current
    if (!scroller || !container) return
    let scheduled = false
    // Medidas para bucle infinito
    const periodPxRef = { current: 0 }
    const top0Ref = { current: 0 }
    const repeatsRef = { current: 0 }

    const measurePeriod = () => {
      try {
        const sRect = scroller.getBoundingClientRect()
        const anchors = Array.from(container.querySelectorAll('[data-work-card][data-work-card-i="0"]'))
        if (anchors.length >= 2) {
          const a0 = anchors[0].getBoundingClientRect()
          const a1 = anchors[1].getBoundingClientRect()
          const t0 = (scroller.scrollTop || 0) + (a0.top - sRect.top)
          const t1 = (scroller.scrollTop || 0) + (a1.top - sRect.top)
          periodPxRef.current = Math.max(1, Math.round(t1 - t0))
          top0Ref.current = t0
          repeatsRef.current = anchors.length
        }
      } catch {}
    }
    measurePeriod()
    setTimeout(measurePeriod, 0)
    const update = () => {
      scheduled = false
      lastUpdateRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      try {
        const sRect = scroller.getBoundingClientRect()
        const viewCenterY = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2
        const half = (scroller.clientHeight || 1) / 2
        const cards = container.querySelectorAll('[data-work-card]')
        cards.forEach((el) => {
          const r = el.getBoundingClientRect()
          const center = (scroller.scrollTop || 0) + (r.top - sRect.top) + r.height / 2
          const dy = Math.abs(center - viewCenterY)
          const t = Math.max(0, Math.min(1, dy / (half)))
          const ease = (x) => 1 - Math.pow(1 - x, 2)
          const scale = 0.88 + 0.18 * (1 - ease(t))
          const boost = dy < 14 ? 0.04 : 0
          // Opacidad progresiva: centro 1.0, bordes ~0.55
          const fade = 0.55 + 0.45 * (1 - ease(t))
          el.__scale = scale + boost
          el.style.opacity = fade.toFixed(3)
          // Sombra dinámica eliminada para reducir coste; se mantiene sombra estática del contenedor
          // Solo escala (tilt desactivado para transiciones más limpias)
          el.style.transform = `perspective(1200px) scale(${(el.__scale || 1).toFixed(3)})`
        })
      } catch {}
    }
    const onScroll = () => {
      if (scheduled) return
      // Ajuste de bucle infinito: cuando se supera el penúltimo ancla o antes del segundo, reubicar
      try {
        const p = periodPxRef.current
        const t0 = top0Ref.current
        const reps = repeatsRef.current
        if (p > 0 && reps >= 2) {
          const st = scroller.scrollTop || 0
          const lower = t0 + p * 1
          const upper = t0 + p * (reps - 2)
          if (st < lower) scroller.scrollTop = st + p * (reps - 3)
          else if (st > upper) scroller.scrollTop = st - p * (reps - 3)
        }
      } catch {}
      scheduled = true
      rafRef.current = requestAnimationFrame(update)
      try { if (typeof invalidateRef.current === 'function') invalidateRef.current() } catch {}
    }
    const onResize = () => { onScroll(); try { if (typeof invalidateRef.current === 'function') invalidateRef.current() } catch {} }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    // Sembrar: situar en mitad de las repeticiones para permitir scroll en ambas direcciones
    const seed = () => {
      try {
        measurePeriod()
        const p = periodPxRef.current
        const reps = repeatsRef.current
        if (p > 0 && reps >= 2) {
          const mid = top0Ref.current + p * Math.floor(reps / 2)
          scroller.scrollTop = mid
        }
      } catch {}
      onScroll()
    }
    setTimeout(seed, 0)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [scrollerRef])

  // Tilt desactivado: transiciones entre tarjetas más limpias

  return (
    <div className="pointer-events-auto select-none relative">
      {/* Overlay capturador de scroll sobre áreas sin tarjetas (por encima del canvas, debajo del contenido) */}
      <ScrollForwarder scrollerRef={scrollerRef} />
      {/* Parallax 3D overlay como fondo de todo el viewport (no ocupa layout) */}
      <div className="fixed inset-0 z-[0]" aria-hidden style={{ right: `${scrollbarOffsetRight}px`, pointerEvents: 'none' }}>
        <Canvas
          key={overlayKey}
          className="w-full h-full block"
          orthographic
          frameloop="always"
          dpr={[1, 1]}
          gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 10] }}
          events={undefined}
          onCreated={(state) => {
            try { state.gl.domElement.style.pointerEvents = 'none' } catch {}
            try { invalidateRef.current = state.invalidate } catch {}
            try {
              const canvas = state.gl.domElement
              const onLost = (e) => { try { e.preventDefault() } catch {}; try { degradedRef.current = true } catch {}; try { setOverlayKey((k) => k + 1) } catch {} }
              const onRestored = () => { try { setOverlayKey((k) => k + 1) } catch {} }
              canvas.addEventListener('webglcontextlost', onLost, { passive: false })
              canvas.addEventListener('webglcontextrestored', onRestored)
            } catch {}
          }}
        >
          <ScreenOrthoCamera />
          <React.Suspense fallback={null}>
            {!degradedRef.current && (<Environment files={`${import.meta.env.BASE_URL}light.hdr`} background={false} />)}
            <ambientLight intensity={0.6} />
            <directionalLight intensity={0.4} position={[0.5, 0.5, 1]} />
            <ParallaxBirds scrollerRef={scrollerRef} />
          </React.Suspense>
        </Canvas>
      </div>
      <div ref={listRef} className="relative z-[12010] space-y-12 w-full min-h-screen flex flex-col items-center justify-start px-10 py-10">
        {/* Fade gradients top/bottom — disabled in Work to evitar halo sobre la primera tarjeta */}
        {false && (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 z-[1]" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.28), rgba(0,0,0,0))' }} />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 z-[1]" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.28), rgba(0,0,0,0))' }} />
          </>
        )}
        {renderItems.map((it) => (
          <div key={it.key} className="py-4 will-change-transform" data-work-card data-work-card-i={it.i} style={{ transform: 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale(0.96)', transition: 'transform 220ms ease' }}>
            <Card item={it.item} onEnter={onEnter} onMove={onMove} onLeave={onLeave} />
          </div>
        ))}
      </div>
      {hover.active && (
        <div
          className="fixed z-[13060] pointer-events-none px-3 py-1 rounded-md bg-black/70 text-white text-sm font-medium shadow-lg"
          style={{ left: `${hover.x + 12}px`, top: `${hover.y + 12}px` }}
        >
          {hover.title}
        </div>
      )}
    </div>
  )
}

// moved inside component; no-op at module scope

function Card({ item, onEnter, onMove, onLeave }) {
  return (
    <div
      className="group mx-auto w-full max-w-[min(90vw,860px)] aspect-[5/3] rounded-xl overflow-hidden shadow-xl relative"
      onMouseEnter={(e) => onEnter(e, item)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <img
        src={item.image}
        alt={item.title}
        className="w-full h-full object-cover block"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
    </div>
  )
}

function ScreenOrthoCamera() {
  const { camera, size } = useThree()
  React.useEffect(() => {
    // Ampliar máscara/frustum para que no recorte elementos en los bordes
    const PAD = Math.max(80, Math.min(200, Math.round(Math.max(size.width, size.height) * 0.08)))
    camera.left = -size.width / 2 - PAD
    camera.right = size.width / 2 + PAD
    camera.top = size.height / 2 + PAD
    camera.bottom = -size.height / 2 - PAD
    // Para evitar clipping por detrás del plano cercano, llevar near muy negativo y far moderado
    // en ortho, valores grandes son seguros para nuestro overlay 2D
    camera.near = -5000
    camera.far = 5000
    camera.position.set(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function ParallaxField({ scrollerRef }) {
  const { size } = useThree()
  const groups = React.useRef([])
  const bases = React.useMemo(() => {
    const vh = size.height
    const leftX = size.width * 0.22
    const rightX = size.width * 0.78
    const pattern = [
      { x: leftX, y: vh * 0.20, size: 180, color: '#c9e5ff' },
      { x: rightX, y: vh * 0.85, size: 220, color: '#ffd7f6' },
      { x: leftX, y: vh * 1.55, size: 200, color: '#d7ffd9' },
      { x: rightX, y: vh * 2.20, size: 240, color: '#ffe6c9' },
    ]
    const repeats = 12
    const out = []
    for (let r = 0; r < repeats; r++) {
      const offset = r * vh * 2.4
      pattern.forEach((p) => out.push({ ...p, y: p.y + offset }))
    }
    return out
  }, [size])

  useFrame((state, delta) => {
    const scroller = scrollerRef?.current
    const top = scroller ? scroller.scrollTop : 0
    const viewportH = size.height
    bases.forEach((b, i) => {
      const g = groups.current[i]
      if (!g) return
      const x = b.x - size.width / 2
      const yBase = b.y - top
      const y = (viewportH / 2 - yBase) + (i % 2 === 0 ? -1 : 1) * 0.18 * top // Sin parallax
      g.position.set(x, y, 0)
      if (g.children[0]) {
        g.children[0].rotation.x += delta * 0.25
        g.children[0].rotation.z += delta * 0.06
      }
      const inView = yBase > -viewportH * 0.2 && yBase < viewportH * 1.2
      g.visible = inView
    })
  })

  return (
    <group>
      {bases.map((b, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)}>
          <mesh frustumCulled={false} castShadow={false} receiveShadow={false}>
            <boxGeometry args={[b.size, b.size, b.size * 0.35]} />
            <meshStandardMaterial color={b.color} transparent opacity={0.9} depthWrite={false} depthTest side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function ParallaxBirds({ scrollerRef }) {
  const { size } = useThree()
  const leftRef = React.useRef()
  const rightRef = React.useRef()
  const whiteRef = React.useRef()
  const isMobile = React.useMemo(() => {
    try { return (typeof window !== 'undefined') ? window.matchMedia('(max-width: 640px)').matches : (size.width <= 640) } catch { return size.width <= 640 }
  }, [size])
  const mobileScale = React.useMemo(() => {
    try {
      // Runtime override (no-op por defecto)
      if (typeof window !== 'undefined' && typeof window.__birdsScaleMobile === 'number') {
        return isMobile ? Math.max(0.3, Math.min(1.0, window.__birdsScaleMobile)) : 1.0
      }
    } catch {}
    return isMobile ? 0.6 : 1.0
  }, [isMobile])
  React.useEffect(() => {
    try {
      if (leftRef.current) leftRef.current.scale.setScalar(mobileScale)
      if (rightRef.current) rightRef.current.scale.setScalar(mobileScale)
      if (whiteRef.current) whiteRef.current.scale.setScalar(mobileScale)
    } catch {}
  }, [mobileScale])
  const leftYRef = React.useRef(0)
  const rightYRef = React.useRef(0)
  const whiteYRef = React.useRef(0)
  const leftXRef = React.useRef(0)
  const rightXRef = React.useRef(0)
  const whiteXRef = React.useRef(0)
  const initRef = React.useRef(false)
  const prevTopRef = React.useRef(0)
  const phaseRef = React.useRef(0)
  const leftVyRef = React.useRef(0)
  const rightVyRef = React.useRef(0)
  const whiteVyRef = React.useRef(0)
  const leftVxRef = React.useRef(0)
  const rightVxRef = React.useRef(0)
  const whiteVxRef = React.useRef(0)
  const lastCollisionLRRef = React.useRef(0)
  const lastCollisionLWRef = React.useRef(0)
  const lastCollisionRWRef = React.useRef(0)
  const entryStartRef = React.useRef(null)
  const gltf = useGLTF(`${import.meta.env.BASE_URL}3dmodels/housebird.glb`)
  const gltfPink = useGLTF(`${import.meta.env.BASE_URL}3dmodels/housebirdPink.glb`)
  const gltfWhite = useGLTF(`${import.meta.env.BASE_URL}3dmodels/housebirdWhite.glb`)
  const DEBUG = false
  const DEBUG_CENTER = false
  // Parámetros ajustables de zero‑g
  const ZERO_G = React.useMemo(() => ({
    windAmpX: 0.045, // fracción del width
    windFreqL: 0.60,
    windFreqR: 0.52,
    windFreqW: 0.58,
    driftYScale: 0.014, // fracción del height
    kY: { L: 44, R: 40, W: 42 }, // rigidez vertical
    cY: { L: 6.2, R: 6.6, W: 6.4 }, // amortiguación vertical
    bounceY: { L: 0.86, R: 0.88, W: 0.88 },
    minKickY: { L: 48, R: 55, W: 52 },
    kX: { L: 7.0, R: 6.6, W: 6.8 },
    cX: { L: 4.0, R: 4.2, W: 4.1 },
    bounceX: { L: 0.88, R: 0.90, W: 0.89 },
    minKickX: { L: 52, R: 58, W: 55 },
    repelK: { L: 200, R: 210, W: 205 },
    edgeThreshY: 0.12,
    edgeThreshX: 0.12,
  }), [])
  // preparar escena clonada y material amigable al overlay 2D
  const makeBird = React.useCallback((variant = 'default') => {
    let baseScene = gltf.scene
    if (variant === 'pink' && gltfPink?.scene) baseScene = gltfPink.scene
    else if (variant === 'white' && gltfWhite?.scene) baseScene = gltfWhite.scene
    const clone = baseScene.clone(true)
    clone.traverse((n) => {
      if (n.isMesh) {
        n.frustumCulled = false
        if (n.material) {
          try {
            n.material = n.material.clone()
            // Evitar artefactos/tearing al rotar: sin transparencia ni doble cara
            n.material.transparent = false
            n.material.opacity = 1.0
            n.material.depthWrite = true
            n.material.depthTest = true
            n.material.side = THREE.FrontSide
            n.material.alphaTest = 0
            n.material.needsUpdate = true
          } catch {}
        }
      }
    })
    // Auto‑escala a tamaño en píxeles del overlay ortográfico
    try {
      const box = new THREE.Box3().setFromObject(clone)
      const sizeV = new THREE.Vector3()
      box.getSize(sizeV)
      const maxDim = Math.max(sizeV.x, sizeV.y, sizeV.z) || 1
      const targetPx = 900 // más pequeño en ortho (px)
      const scale = targetPx / maxDim
      clone.scale.setScalar(scale)
    } catch {}
    return clone
  }, [gltf, gltfPink, gltfWhite])

  // layout aleatorio una vez
  const layout = React.useMemo(() => {
    const vh = size.height
    const vw = size.width
    if (DEBUG_CENTER) {
      return {
        left: { x: vw * 0.5 - vw * 0.15, y: vh * 0.5, scale: 3.0 },
        right: { x: vw * 0.5 + vw * 0.15, y: vh * 0.5, scale: 3.0 },
        white: { x: vw * 0.5, y: vh * 0.5, scale: 3.0 },
      }
    }
    return {
      left: { x: vw * 0.18, y: vh * 0.32, scale: 4.0 },
      right: { x: vw * 0.76, y: vh * 0.68, scale: 4.8 },
      white: { x: vw * 0.50, y: vh * 0.60, scale: 4.4 },
    }
  }, [size])

  const leftBird = React.useMemo(() => makeBird('default'), [makeBird])
  const rightBird = React.useMemo(() => makeBird('pink'), [makeBird])
  const whiteBird = React.useMemo(() => makeBird('white'), [makeBird])

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    const w = size.width
    const h = size.height
    let ampFactor = isMobile ? 0.7 : 1.0
    try {
      if (typeof window !== 'undefined' && typeof window.__birdsAmpFactor === 'number') {
        ampFactor = Math.max(0.3, Math.min(1.5, window.__birdsAmpFactor))
      }
    } catch {}
    const ampX = Math.min(w, h) * 0.12 * ampFactor
    const ampY = Math.min(w, h) * 0.10 * ampFactor
    // Left
    if (leftRef.current) {
      const baseX = layout.left.x - w / 2
      const baseY = layout.left.y
      const x = baseX + Math.sin(t * 0.6) * ampX
      const scrY = baseY + Math.cos(t * 0.7) * ampY
      const y = h / 2 - scrY
      leftRef.current.position.set(x, y, 0)
      leftRef.current.rotation.y += delta * 0.08
      leftRef.current.rotation.x += delta * 0.03
      leftRef.current.rotation.z += delta * 0.028
    }
    // Right
    if (rightRef.current) {
      const baseX = layout.right.x - w / 2
      const baseY = layout.right.y
      const x = baseX + Math.sin(t * 0.52 + Math.PI * 0.33) * (ampX * 0.95)
      const scrY = baseY + Math.sin(t * 0.62 + 1.2) * (ampY * 0.9)
      const y = h / 2 - scrY
      rightRef.current.position.set(x, y, 0)
      rightRef.current.rotation.y -= delta * 0.075
      rightRef.current.rotation.x -= delta * 0.026
      rightRef.current.rotation.z -= delta * 0.03
    }
    // White
    if (whiteRef.current) {
      const baseX = layout.white.x - w / 2
      const baseY = layout.white.y
      const x = baseX + Math.sin(t * 0.58 + Math.PI * 0.18) * (ampX * 0.9)
      const scrY = baseY + Math.cos(t * 0.66 + 0.8) * (ampY * 0.85)
      const y = h / 2 - scrY
      whiteRef.current.position.set(x, y, 0)
      whiteRef.current.rotation.y += delta * 0.085
      whiteRef.current.rotation.x += delta * 0.024
      whiteRef.current.rotation.z += delta * 0.032
    }
  })

  return (
    <group>
      {DEBUG && (
        <>
          <axesHelper args={[200]} />
          {/* cruz en el centro de la pantalla */}
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={4}
                array={new Float32Array([
                  -size.width/2, 0, 0,
                   size.width/2, 0, 0,
                  0, -size.height/2, 0,
                  0,  size.height/2, 0,
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#ffffff" opacity={0.4} transparent />
          </lineSegments>
        </>
      )}
      <group ref={leftRef}>
        <primitive object={leftBird} />
        {DEBUG && (
          <mesh frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#00ff88" wireframe opacity={0.6} transparent />
          </mesh>
        )}
      </group>
      <group ref={rightRef}>
        <primitive object={rightBird} />
        {DEBUG && (
          <mesh frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ff0088" wireframe opacity={0.6} transparent />
          </mesh>
        )}
      </group>
      <group ref={whiteRef}>
        <primitive object={whiteBird} />
        {DEBUG && (
          <mesh frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ffffff" wireframe opacity={0.6} transparent />
          </mesh>
        )}
      </group>
    </group>
  )
}

useGLTF.preload(`${import.meta.env.BASE_URL}3dmodels/housebird.glb`)
useGLTF.preload(`${import.meta.env.BASE_URL}3dmodels/housebirdPink.glb`)
useGLTF.preload(`${import.meta.env.BASE_URL}3dmodels/housebirdWhite.glb`)


function ScrollForwarder({ scrollerRef }) {
  // Capa invisible que reenvía rueda/touch al contenedor scrolleable cuando el puntero no está sobre las tarjetas
  React.useEffect(() => {
    const onWheel = (e) => {
      try {
        e.preventDefault()
        const el = scrollerRef?.current
        if (el) el.scrollTop += e.deltaY
      } catch {}
    }
    let touchY = null
    const onTouchStart = (e) => { try { touchY = e.touches?.[0]?.clientY ?? null } catch {} }
    const onTouchMove = (e) => {
      try {
        if (touchY == null) return
        const y = e.touches?.[0]?.clientY ?? touchY
        const dy = touchY - y
        touchY = y
        const el = scrollerRef?.current
        if (el) el.scrollTop += dy
        e.preventDefault()
      } catch {}
    }
    const onTouchEnd = () => { touchY = null }
    const el = document.getElementById('work-scroll-forwarder')
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [scrollerRef])
  return (
    <div
      id="work-scroll-forwarder"
      className="fixed inset-0 z-[5]"
      style={{ pointerEvents: 'auto', background: 'transparent' }}
    />
  )
}

