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

  const onEnter = (e, it) => setHover({ active: true, title: it.title, x: e.clientX, y: e.clientY })
  const onMove = (e) => setHover((h) => ({ ...h, x: e.clientX, y: e.clientY }))
  const onLeave = () => setHover({ active: false, title: '', x: 0, y: 0 })

  const renderItems = React.useMemo(() => {
    const REPEATS = 24
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
          // Sombra difusa (drop-shadow) más marcada en el centro
          const shadowA = 0.10 + 0.25 * (1 - ease(t))
          el.style.filter = `drop-shadow(0 18px 32px rgba(0,0,0,${shadowA.toFixed(3)})) drop-shadow(0 2px 8px rgba(0,0,0,${(shadowA*0.6).toFixed(3)}))`
          // Solo escala (tilt desactivado para transiciones más limpias)
          el.style.transform = `perspective(1200px) scale(${(el.__scale || 1).toFixed(3)})`
        })
      } catch {}
    }
    const onScroll = () => {
      if (scheduled) return
      scheduled = true
      rafRef.current = requestAnimationFrame(update)
    }
    const onResize = () => { onScroll() }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    onScroll()
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
          className="w-full h-full block"
          orthographic
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 0, 10] }}
          events={undefined}
          onCreated={({ gl }) => {
            try { gl.domElement.style.pointerEvents = 'none' } catch {}
          }}
        >
          <ScreenOrthoCamera />
          <Environment files={`${import.meta.env.BASE_URL}light.hdr`} background={false} />
          <ambientLight intensity={0.8} />
          <directionalLight intensity={0.6} position={[0, 0, 10]} />
          <ParallaxBirds scrollerRef={scrollerRef} />
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
    const parallaxStrength = 0.18
    bases.forEach((b, i) => {
      const g = groups.current[i]
      if (!g) return
      const x = b.x - size.width / 2
      const yBase = b.y - top
      const y = (viewportH / 2 - yBase) + (i % 2 === 0 ? -1 : 1) * parallaxStrength * top
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
  const leftYRef = React.useRef(0)
  const rightYRef = React.useRef(0)
  const whiteYRef = React.useRef(0)
  const leftXRef = React.useRef(0)
  const rightXRef = React.useRef(0)
  const whiteXRef = React.useRef(0)
  const initRef = React.useRef(false)
  const prevTopRef = React.useRef(0)
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
      right: { x: vw * 0.76, y: vh * 1.55, scale: 4.8 },
      white: { x: vw * 0.50, y: vh * 0.60, scale: 4.4 },
    }
  }, [size])

  const leftBird = React.useMemo(() => makeBird('default'), [makeBird])
  const rightBird = React.useMemo(() => makeBird('pink'), [makeBird])
  const whiteBird = React.useMemo(() => makeBird('white'), [makeBird])

  useFrame((_, delta) => {
    const scroller = scrollerRef?.current
    const top = scroller ? scroller.scrollTop : 0
    const viewportH = size.height
    // Parallax relativo al scroll con fases distintas, distintas velocidades y suavizado por inercia
    const total = Math.max(1, (scroller?.scrollHeight || viewportH) - viewportH)
    const tRaw = top / total // 0..1
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
    const clamp01 = (v) => clamp(v, 0, 1)
    const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    const easeInOutQuad = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)
    const easeOutBack = (x) => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
    }
    // Estimar velocidad de scroll para un pequeño sesgo inercial y de rotación
    const dt = Math.max(0.001, delta)
    const vel = (top - (prevTopRef.current || 0)) / dt // px/seg aprox
    prevTopRef.current = top
    // Fases/offsets: izquierdo recorre todo el rango; derecho inicia más tarde y recorre menos
    const tL = clamp01((tRaw - 0.05) / 0.90)
    const tR = clamp01((tRaw - 0.30) / 0.65)
    const tW = clamp01((tRaw - 0.18) / 0.78)
    // Baselines y rangos (fracción de viewport)
    // Aumentar intensidad del parallax (más rango)
    let baseL = 0.36, rangeL = 0.38
    let baseR = 0.88, rangeR = 0.34
    let baseW = 0.62, rangeW = 0.34
    // Aumentar rango de parallax si el contenedor tiene mucho scroll (galería infinita)
    try {
      const el = scrollerRef?.current
      const max = el ? Math.max(1, el.scrollHeight - el.clientHeight) : viewportH
      const long = max > viewportH * 3
      if (long) {
        rangeL *= 1.15
        rangeR *= 1.18
        rangeW *= 1.12
      }
    } catch {}
    // Componentes: mapeo suave + oscilación sutil dependiente del progreso (no del tiempo)
    // Más oscilación sutil para reforzar sensación de profundidad
    const oscL = Math.sin((tL) * Math.PI * 2 * 0.9) * 0.09
    const oscR = Math.sin((tR) * Math.PI * 2 * 0.75 + Math.PI * 0.35) * 0.08
    const oscW = Math.sin((tW) * Math.PI * 2 * 0.88 + Math.PI * 0.15) * 0.085
    const fL = easeInOutCubic(tL)
    const fR = easeInOutQuad(tR)
    const fW = easeInOutCubic(tW)
    let yLscreenTarget = viewportH * (baseL + (fL - 0.5) * rangeL + oscL)
    let yRscreenTarget = viewportH * (baseR + (fR - 0.5) * rangeR + oscR)
    let yWscreenTarget = viewportH * (baseW + (fW - 0.5) * rangeW + oscW)
    // Mantener visibles
    // Aflojar límites para permitir mayor recorrido, asegurando visibilidad
    yLscreenTarget = clamp(yLscreenTarget, viewportH * 0.08, viewportH * 0.92)
    yRscreenTarget = clamp(yRscreenTarget, viewportH * 0.08, viewportH * 0.92)
    yWscreenTarget = clamp(yWscreenTarget, viewportH * 0.08, viewportH * 0.92)
    // Dinámica elástica tipo resorte (subamortiguado) por ave
    // y'' = k*(target - y) - c*y'
    if (!initRef.current) {
      leftYRef.current = yLscreenTarget; leftVyRef.current = 0
      // Iniciar el ave derecha más abajo
      rightYRef.current = Math.min(viewportH * 0.94, yRscreenTarget + viewportH * 0.08); rightVyRef.current = 0
      // Iniciar el ave blanca un poco más abajo también (entrada desde abajo)
      whiteYRef.current = Math.min(viewportH * 0.94, yWscreenTarget + viewportH * 0.10); whiteVyRef.current = 0
      leftXRef.current = layout.left.x - size.width / 2; leftVxRef.current = 0
      rightXRef.current = layout.right.x - size.width / 2; rightVxRef.current = 0
      whiteXRef.current = layout.white.x - size.width / 2; whiteVxRef.current = 0
      initRef.current = true
    } else {
      // Izquierda: más "blando" (globo más suelto), intensidad intermedia
      {
        const k = 50 // rigidez más alta (más rápido)
        const c = 5.1 // menos amortiguación (más rebote)
        const y = leftYRef.current
        const v = leftVyRef.current
        let a = k * (yLscreenTarget - y) - c * v
        // Repulsión de borde (progresiva) tipo campo elástico
        const minY = viewportH * 0.12, maxY = viewportH * 0.88
        const edgeThresh = viewportH * 0.12
        const repelK = 220
        const dTop = Math.max(0, y - minY)
        const dBot = Math.max(0, maxY - y)
        if (dTop < edgeThresh) a += repelK * (1 - dTop / edgeThresh)
        if (dBot < edgeThresh) a -= repelK * (1 - dBot / edgeThresh)
        let vNext = v + a * dt
        let yNext = y + vNext * dt
        // Rebote suave y siempre dentro (impulso moderado dependiente de trayectoria)
        const bounce = 0.88
        const minEdgeKick = 60
        const edgeKickFactor = 0.25
        if (yNext < minY) {
          const over = (minY - yNext)
          yNext = minY + over
          vNext = Math.max(Math.abs(vNext) * bounce + edgeKickFactor * Math.abs(v), minEdgeKick)
        } else if (yNext > maxY) {
          const over = (yNext - maxY)
          yNext = maxY - over
          vNext = -Math.max(Math.abs(vNext) * bounce + edgeKickFactor * Math.abs(v), minEdgeKick)
        }
        leftVyRef.current = vNext
        leftYRef.current = yNext
      }
      // Derecha: un poco más pesado, rebote intermedio
      {
        const k = 44
        const c = 5.6
        const y = rightYRef.current
        const v = rightVyRef.current
        let a = k * (yRscreenTarget - y) - c * v
        const minY = viewportH * 0.12, maxY = viewportH * 0.88
        const edgeThresh = viewportH * 0.12
        const repelK = 240
        const dTop = Math.max(0, y - minY)
        const dBot = Math.max(0, maxY - y)
        if (dTop < edgeThresh) a += repelK * (1 - dTop / edgeThresh)
        if (dBot < edgeThresh) a -= repelK * (1 - dBot / edgeThresh)
        let vNext = v + a * dt
        let yNext = y + vNext * dt
        const bounce = 0.90
        const minEdgeKick = 70
        const edgeKickFactor = 0.28
        if (yNext < minY) {
          const over = (minY - yNext)
          yNext = minY + over
          vNext = Math.max(Math.abs(vNext) * bounce + edgeKickFactor * Math.abs(v), minEdgeKick)
        } else if (yNext > maxY) {
          const over = (yNext - maxY)
          yNext = maxY - over
          vNext = -Math.max(Math.abs(vNext) * bounce + edgeKickFactor * Math.abs(v), minEdgeKick)
        }
        rightVyRef.current = vNext
        rightYRef.current = yNext
      }
      // Blanca: intermedia, con rebote y límites similares
      {
        const k = 46
        const c = 5.4
        const y = whiteYRef.current
        const v = whiteVyRef.current
        let a = k * (yWscreenTarget - y) - c * v
        const minY = viewportH * 0.12, maxY = viewportH * 0.88
        const edgeThresh = viewportH * 0.12
        const repelK = 230
        const dTop = Math.max(0, y - minY)
        const dBot = Math.max(0, maxY - y)
        if (dTop < edgeThresh) a += repelK * (1 - dTop / edgeThresh)
        if (dBot < edgeThresh) a -= repelK * (1 - dBot / edgeThresh)
        let vNext = v + a * dt
        let yNext = y + vNext * dt
        const bounce = 0.90
        const minEdgeKick = 65
        const edgeKickFactor = 0.27
        if (yNext < minY) {
          const over = (minY - yNext)
          yNext = minY + over
          vNext = Math.max(Math.abs(vNext) * bounce + edgeKickFactor * Math.abs(v), minEdgeKick)
        } else if (yNext > maxY) {
          const over = (yNext - maxY)
          yNext = maxY - over
          vNext = -Math.max(Math.abs(vNext) * bounce + edgeKickFactor * Math.abs(v), minEdgeKick)
        }
        whiteVyRef.current = vNext
        whiteYRef.current = yNext
      }
    }
    // Flotación horizontal tipo globo con rebote en bordes (X)
    { // Añadir deriva suave en Y para simular corrientes (depende del tiempo, no solo del scroll)
      const time = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000)
      // Izquierda
      {
        const baseX = layout.left.x - size.width / 2
        const wind = Math.sin(time * 0.6) * (size.width * 0.06)
        const targetX = baseX + wind
        const x = leftXRef.current
        const vx = leftVxRef.current
        const kx = 8.0, cx = 3.6
        const minX = -size.width / 2 + Math.min(size.width, size.height) * 0.18
        const maxX = size.width / 2 - Math.min(size.width, size.height) * 0.18
        const edgeThreshX = size.width * 0.12
        const repelKx = 220
        let ax = kx * (targetX - x) - cx * vx
        const dL = Math.max(0, x - minX)
        const dR = Math.max(0, maxX - x)
        if (dL < edgeThreshX) ax += repelKx * (1 - dL / edgeThreshX)
        if (dR < edgeThreshX) ax -= repelKx * (1 - dR / edgeThreshX)
        let vxNext = vx + ax * delta
        let xNext = x + vxNext * delta
        const bounceX = 0.9
        const minKickX = 60
        if (xNext < minX) { const over = (minX - xNext); xNext = minX + over; vxNext = Math.max(Math.abs(vxNext) * bounceX + 0.25 * Math.abs(vx), minKickX) }
        else if (xNext > maxX) { const over = (xNext - maxX); xNext = maxX - over; vxNext = -Math.max(Math.abs(vxNext) * bounceX + 0.25 * Math.abs(vx), minKickX) }
        leftXRef.current = xNext
        leftVxRef.current = vxNext
        // deriva Y sutil
        leftYRef.current += Math.sin(time * 0.25 + 0.3) * 0.02 * viewportH * dt
      }
      // Derecha
      {
        const baseX = layout.right.x - size.width / 2
        const wind = Math.sin(time * 0.48 + Math.PI * 0.33) * (size.width * 0.07)
        const targetX = baseX + wind
        const x = rightXRef.current
        const vx = rightVxRef.current
        const kx = 7.0, cx = 3.9
        const minX = -size.width / 2 + Math.min(size.width, size.height) * 0.20
        const maxX = size.width / 2 - Math.min(size.width, size.height) * 0.20
        const edgeThreshX = size.width * 0.14
        const repelKx = 240
        let ax = kx * (targetX - x) - cx * vx
        const dL = Math.max(0, x - minX)
        const dR = Math.max(0, maxX - x)
        if (dL < edgeThreshX) ax += repelKx * (1 - dL / edgeThreshX)
        if (dR < edgeThreshX) ax -= repelKx * (1 - dR / edgeThreshX)
        let vxNext = vx + ax * delta
        let xNext = x + vxNext * delta
        const bounceX = 0.92
        const minKickX = 70
        if (xNext < minX) { const over = (minX - xNext); xNext = minX + over; vxNext = Math.max(Math.abs(vxNext) * bounceX + 0.28 * Math.abs(vx), minKickX) }
        else if (xNext > maxX) { const over = (xNext - maxX); xNext = maxX - over; vxNext = -Math.max(Math.abs(vxNext) * bounceX + 0.28 * Math.abs(vx), minKickX) }
        rightXRef.current = xNext
        rightVxRef.current = vxNext
        rightYRef.current += Math.cos(time * 0.22 + 1.1) * 0.018 * viewportH * dt
      }
      // Blanca
      {
        const baseX = layout.white.x - size.width / 2
        const wind = Math.sin(time * 0.52 + Math.PI * 0.55) * (size.width * 0.055)
        const targetX = baseX + wind
        const x = whiteXRef.current
        const vx = whiteVxRef.current
        const kx = 7.6, cx = 3.7
        const minX = -size.width / 2 + Math.min(size.width, size.height) * 0.18
        const maxX = size.width / 2 - Math.min(size.width, size.height) * 0.18
        const edgeThreshX = size.width * 0.13
        const repelKx = 230
        let ax = kx * (targetX - x) - cx * vx
        const dL = Math.max(0, x - minX)
        const dR = Math.max(0, maxX - x)
        if (dL < edgeThreshX) ax += repelKx * (1 - dL / edgeThreshX)
        if (dR < edgeThreshX) ax -= repelKx * (1 - dR / edgeThreshX)
        let vxNext = vx + ax * delta
        let xNext = x + vxNext * delta
        const bounceX = 0.91
        const minKickX = 65
        if (xNext < minX) { const over = (minX - xNext); xNext = minX + over; vxNext = Math.max(Math.abs(vxNext) * bounceX + 0.26 * Math.abs(vx), minKickX) }
        else if (xNext > maxX) { const over = (xNext - maxX); xNext = maxX - over; vxNext = -Math.max(Math.abs(vxNext) * bounceX + 0.26 * Math.abs(vx), minKickX) }
        whiteXRef.current = xNext
        whiteVxRef.current = vxNext
        whiteYRef.current += Math.sin(time * 0.28 + 2.0) * 0.016 * viewportH * dt
      }
    }
    if (leftRef.current) {
      const x = leftXRef.current
      let y = DEBUG_CENTER ? (viewportH / 2 - (viewportH * baseL)) : (viewportH / 2 - leftYRef.current)
      // Animación de entrada: deslizar desde abajo con easeOutBack
      const ENTRY_MS = 900
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      if (entryStartRef.current == null) entryStartRef.current = now
      const p = Math.max(0, Math.min(1, (now - entryStartRef.current) / ENTRY_MS))
      if (p < 1) {
        const off = viewportH * 0.34
        const eased = easeOutBack(p)
        y += (1 - eased) * off
      }
      // Clamp visual final para no rebasar viewport durante la entrada
      {
        const minYb = viewportH * 0.12, maxYb = viewportH * 0.88
        const yTop = viewportH / 2 - minYb
        const yBot = viewportH / 2 - maxYb
        y = Math.min(yTop, Math.max(yBot, y))
      }
      leftRef.current.position.set(x, y, 0)
      // Rotación diferenciada (izquierda): yaw oscilante, pitch suave, roll más marcado
      const PI2 = Math.PI * 2
      // boost de entrada leve
      const entryBoost = (entryStartRef.current && p < 1) ? (0.06 * (1 - p)) : 0
      leftRef.current.rotation.y += delta * (0.058 + 0.024 * Math.sin(tL * PI2) + entryBoost)
      leftRef.current.rotation.x += delta * (0.020 + 0.012 * Math.cos(tL * PI2 * 0.7) + entryBoost * 0.5)
      leftRef.current.rotation.z += delta * (0.026 + 0.00010 * vel) + (-leftVyRef.current * 0.000035) + entryBoost * 0.4
    }
    if (rightRef.current) {
      const x = rightXRef.current
      let y = DEBUG_CENTER ? (viewportH / 2 - (viewportH * baseR)) : (viewportH / 2 - rightYRef.current)
      // Animación de entrada: deslizar desde más abajo (derecha va más abajo)
      const ENTRY_MS = 900
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      if (entryStartRef.current == null) entryStartRef.current = now
      const p = Math.max(0, Math.min(1, (now - entryStartRef.current) / ENTRY_MS))
      if (p < 1) {
        const off = viewportH * 0.48
        const eased = easeOutBack(p)
        y -= (1 - eased) * off
      }
      // Clamp visual final durante la entrada
      {
        const minYb = viewportH * 0.12, maxYb = viewportH * 0.88
        const yTop = viewportH / 2 - minYb
        const yBot = viewportH / 2 - maxYb
        y = Math.min(yTop, Math.max(yBot, y))
      }
      rightRef.current.position.set(x, y, 0)
      // Rotación diferenciada (derecha): yaw opuesto, pitch distinto y roll en sentido contrario (más intenso)
      const PI2 = Math.PI * 2
      const now2 = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const p2 = Math.max(0, Math.min(1, (now2 - (entryStartRef.current || now2)) / 900))
      const entryBoostR = (p2 < 1) ? (0.055 * (1 - p2)) : 0
      rightRef.current.rotation.y -= delta * (0.050 + 0.022 * Math.cos(tR * PI2 * 0.9) + entryBoostR)
      rightRef.current.rotation.x -= delta * (0.018 + 0.010 * Math.sin(tR * PI2 * 1.2) + entryBoostR * 0.5)
      rightRef.current.rotation.z -= delta * (0.022 + 0.00008 * vel) + (-rightVyRef.current * 0.000032) + entryBoostR * 0.35
    }
    if (whiteRef.current) {
      let x = whiteXRef.current
      let y = DEBUG_CENTER ? (viewportH / 2 - (viewportH * baseW)) : (viewportH / 2 - whiteYRef.current)
      // Animación de entrada: desde esquina inferior izquierda hacia el centro
      const ENTRY_MS = 1000
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      if (entryStartRef.current == null) entryStartRef.current = now
      const p = Math.max(0, Math.min(1, (now - entryStartRef.current) / ENTRY_MS))
      if (p < 1) {
        const offY = viewportH * 0.40
        const offX = size.width * 0.42
        const eased = easeOutBack(p)
        y += (1 - eased) * offY
        x -= (1 - eased) * offX
      }
      // Clamp visual final durante la entrada
      {
        const minYb = viewportH * 0.12, maxYb = viewportH * 0.88
        const yTop = viewportH / 2 - minYb
        const yBot = viewportH / 2 - maxYb
        y = Math.min(yTop, Math.max(yBot, y))
      }
      whiteRef.current.position.set(x, y, 0)
      const PI2 = Math.PI * 2
      const entryBoostW = (p < 1) ? (0.052 * (1 - p)) : 0
      whiteRef.current.rotation.y += delta * (0.052 + 0.020 * Math.sin(tW * PI2) + entryBoostW)
      whiteRef.current.rotation.x += delta * (0.017 + 0.011 * Math.cos(tW * PI2 * 0.9) + entryBoostW * 0.5)
      whiteRef.current.rotation.z += delta * (0.020 + 0.00009 * vel) + (-whiteVyRef.current * 0.000033) + entryBoostW * 0.33
    }

    // Colisiones 2D (círculos) con separación en X/Y e impulso elástico
    const resolvePair = (aRef, bRef, aXR, aYR, aVX, aVY, bXR, bYR, bVX, bVY, rA, rB, lastRef) => {
      if (!aRef.current || !bRef.current) return
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const cooldownMs = 40
      const ax = aRef.current.position.x
      const ay = aRef.current.position.y
      const bx = bRef.current.position.x
      const by = bRef.current.position.y
      const dx = bx - ax
      const dy = by - ay
      const dist = Math.hypot(dx, dy)
      const rSum = rA + rB
      if (!(dist > 0 && dist < rSum)) return
      if ((now - (lastRef.current || 0)) <= cooldownMs) return
      lastRef.current = now
      const nx = dx / (dist || 1)
      const ny = dy / (dist || 1)
      const overlap = rSum - dist
      const sep = overlap * 0.5
      // Ajustar refs (aplicar en el siguiente frame por coherencia con R3F)
      const dAx = -nx * sep
      const dAy = -ny * sep
      const dBx = +nx * sep
      const dBy = +ny * sep
      aXR.current += dAx
      aYR.current -= dAy
      bXR.current += dBx
      bYR.current -= dBy
      // Clamp suave en Y para mantener dentro de límites visibles
      const minY = size.height * 0.12, maxY = size.height * 0.88
      aYR.current = Math.max(minY, Math.min(maxY, aYR.current))
      bYR.current = Math.max(minY, Math.min(maxY, bYR.current))
      // Impulso elástico igual-masa a lo largo de la normal
      const eRest = 0.90
      const vAn = (aVX.current * nx) + ((-aVY.current) * ny) // vyRef -> pos vy = -vyRef
      const vBn = (bVX.current * nx) + ((-bVY.current) * ny)
      const vRel = vAn - vBn
      if (vRel < 0) {
        const j = -(1 + eRest) * vRel / 2
        const jx = j * nx
        const jy = j * ny
        // A: v += j*n ; B: v -= j*n
        aVX.current += jx
        aVY.current -= jy // convertir pos-vy -> vyRef (signo invertido)
        bVX.current -= jx
        bVY.current += jy
      }
    }
    const base = Math.min(size.width, size.height)
    const rL = base * 0.18
    const rR = base * 0.20
    const rW = base * 0.19
    resolvePair(leftRef, rightRef, leftXRef, leftYRef, leftVxRef, leftVyRef, rightXRef, rightYRef, rightVxRef, rightVyRef, rL, rR, lastCollisionLRRef)
    resolvePair(leftRef, whiteRef, leftXRef, leftYRef, leftVxRef, leftVyRef, whiteXRef, whiteYRef, whiteVxRef, whiteVyRef, rL, rW, lastCollisionLWRef)
    resolvePair(whiteRef, rightRef, whiteXRef, whiteYRef, whiteVxRef, whiteVyRef, rightXRef, rightYRef, rightVxRef, rightVyRef, rW, rR, lastCollisionRWRef)
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

