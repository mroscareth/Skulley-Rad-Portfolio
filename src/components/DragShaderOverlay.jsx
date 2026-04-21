import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import PauseFrameloop from './PauseFrameloop.jsx'

// ── Inline GLSL ───────────────────────────────────────────────────────────
// Vertex: sinusoidal deformation on Y based on scroll velocity (the "DRAG" effect)
const vertexShader = /* glsl */ `
precision highp float;

#define PI 3.14159265359

attribute vec3 position;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float uScrollVelocity;

varying vec2 vUv;

void main() {
  float strength = -0.004;
  vec3 pos = position;
  // Bell-curve deformation along X: 0 at edges, max at center
  pos.y = pos.y - (sin(uv.x * PI) * uScrollVelocity * strength);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  vUv = uv;
}
`

// Fragment: object-cover + hover (zoom, desat, darken, cursor glow) + RGB split
//           + grain + animated icon composite. Math en linear space.
const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;
uniform sampler2D uIconTexture;
uniform float uHover;
uniform float uShowIcon;
uniform float uImageAspect;
uniform float uPlaneAspect;
uniform float uScrollVelocity;
uniform vec2 uMouse;   // card-local UV (0..1) or (-1,-1) when outside
uniform float uTime;

varying vec2 vUv;

// Cheap hash noise for grain
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  // Hover zoom-in from center (UV-space, mesh size stays fixed)
  float zoom = 1.0 - uHover * 0.04;
  vec2 uvZ = (vUv - 0.5) * zoom + 0.5;

  // Object-cover UV
  float ratio = uImageAspect / uPlaneAspect;
  vec2 coverUv = uvZ;
  if (ratio > 1.0) {
    float s = 1.0 / ratio;
    coverUv.x = uvZ.x * s + (1.0 - s) * 0.5;
  } else {
    coverUv.y = uvZ.y * ratio + (1.0 - ratio) * 0.5;
  }

  vec3 srgb = texture2D(uTexture, coverUv).rgb;

  // sRGB -> linear (approx gamma 2.0) para que el mix perceptual sea correcto
  vec3 lin = srgb * srgb;

  // Hover: desaturar ligeramente + oscurecer
  float luma = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  lin = mix(lin, vec3(luma), uHover * 0.35);
  lin = mix(lin, lin * 0.15, uHover);

  // Cursor-reactive glow (sólo cuando hay mouse dentro del card)
  if (uMouse.x >= 0.0) {
    float d = distance(vUv, uMouse);
    float glow = smoothstep(0.45, 0.0, d) * uHover * 0.12;
    lin += vec3(glow);
  }

  // linear -> sRGB
  vec3 color = sqrt(max(lin, 0.0));

  // External link icon con smoothstep edges + bounce up on hover
  if (uShowIcon > 0.5) {
    float iconH = 0.11;
    float iconW = iconH / uPlaneAspect;
    float padH = 0.03;
    float padW = padH / uPlaneAspect;

    // Bounce: icon sube un poquito al hacer hover
    float bounce = uHover * 0.015;
    vec2 iconMin = vec2(1.0 - padW - iconW, padH + bounce);
    vec2 iconMax = vec2(1.0 - padW, padH + iconH + bounce);

    float edge = 0.004;
    float maskX = smoothstep(iconMin.x - edge, iconMin.x + edge, vUv.x) *
                  (1.0 - smoothstep(iconMax.x - edge, iconMax.x + edge, vUv.x));
    float maskY = smoothstep(iconMin.y - edge, iconMin.y + edge, vUv.y) *
                  (1.0 - smoothstep(iconMax.y - edge, iconMax.y + edge, vUv.y));
    float mask = maskX * maskY;

    if (mask > 0.001) {
      vec2 iconUv = clamp((vUv - iconMin) / (iconMax - iconMin), 0.0, 1.0);
      iconUv.y = 1.0 - iconUv.y;
      vec4 iconSample = texture2D(uIconTexture, iconUv);
      float iconAlpha = iconSample.a * mix(0.85, 1.0, uHover) * mask;
      color = mix(color, iconSample.rgb, iconAlpha);
    }
  }

  // Grano sutil animado para romper banding (~1.5%)
  float grain = hash12(vUv * 1024.0 + fract(uTime)) - 0.5;
  color += grain * 0.015;

  gl_FragColor = vec4(color, 1.0);
}
`

// ── Texture loader (singleton cache) ──────────────────────────────────────
const loader = new THREE.TextureLoader()
const textureCache = new Map()
// Track max anisotropy from renderer (set on Canvas onCreated); default 1
let _maxAnisotropy = 1

function loadTexture(src) {
  if (textureCache.has(src)) return textureCache.get(src)
  const tex = loader.load(src, () => {
    // On load, re-apply filter settings in case renderer became available after
    tex.anisotropy = _maxAnisotropy
    tex.needsUpdate = true
  })
  // sRGB decode is done manually in fragment; keep texel data raw here
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = _maxAnisotropy
  textureCache.set(src, tex)
  return tex
}

// ── External link icon texture (singleton) ────────────────────────────────
// Renders the HeroIcons ArrowTopRightOnSquare icon inside a dark circle
// onto an offscreen canvas. Created once and shared by all DragPlanes.
let _iconTexture = null

function getIconTexture() {
  if (_iconTexture) return _iconTexture

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const r = size / 2

  // Circle background (dark semi-transparent)
  ctx.beginPath()
  ctx.arc(r, r, r - 2, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fill()

  // Draw HeroIcons ArrowTopRightOnSquare using Path2D with the SVG d attribute
  // The path is designed for a 24×24 viewBox, so we scale and center it
  ctx.save()
  const margin = size * 0.28
  const iconArea = size - margin * 2
  ctx.translate(margin, margin)
  ctx.scale(iconArea / 24, iconArea / 24)

  const svgPath = new Path2D(
    'M15.75 2.25H21a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0V4.81L8.03 17.03a.75.75 0 0 1-1.06-1.06L19.19 3.75H15.75a.75.75 0 0 1 0-1.5Zm-10.5 4.5a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5V12a.75.75 0 0 1 1.5 0v6.75a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V8.25a3 3 0 0 1 3-3H12a.75.75 0 0 1 0 1.5H5.25Z'
  )
  ctx.fillStyle = 'white'
  ctx.fill(svgPath)
  ctx.restore()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.premultiplyAlpha = false

  _iconTexture = tex
  return tex
}

// ── Single card plane ─────────────────────────────────────────────────────
const SEGMENTS = 64
const HOVER_LERP = 0.08
// Velocity low-pass: higher k = más rápido de seguir (menos suave). ~8 ≈ tau 125ms
const VELOCITY_SMOOTH_K = 8
// Clamp duro para que scrolls bruscos no doblen el card en exceso
const VELOCITY_CLAMP = 1200

function DragPlane({ cardRect, texture, scrollVelocityRef, containerRect, isHovered, showIcon, mousePosRef }) {
  const meshRef = useRef()
  const materialRef = useRef()
  const hoverRef = useRef(0)
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(1, 1, SEGMENTS, SEGMENTS),
    [],
  )

  const iconTexture = useMemo(() => getIconTexture(), [])

  // Create uniforms once and keep them stable (use ref instead of useMemo)
  // This prevents the issue where a new uniforms object is created but the
  // material still references the old one
  const uniformsRef = useRef({
    uTexture: { value: texture },
    uIconTexture: { value: iconTexture },
    uScrollVelocity: { value: 0.0 },
    uHover: { value: 0.0 },
    uShowIcon: { value: showIcon ? 1.0 : 0.0 },
    uImageAspect: { value: 1.0 },
    uPlaneAspect: { value: 1.0 },
    uMouse: { value: new THREE.Vector2(-1, -1) },
    uTime: { value: 0.0 },
  })

  // Update texture uniform when texture prop changes
  useEffect(() => {
    uniformsRef.current.uTexture.value = texture
    uniformsRef.current.uShowIcon.value = showIcon ? 1.0 : 0.0
    if (materialRef.current) {
      materialRef.current.needsUpdate = true
    }
  }, [texture, showIcon])

  useFrame((state, delta) => {
    if (!meshRef.current || !cardRect.current || !containerRect.current) return
    const cr = containerRect.current
    const r = cardRect.current

    // Convert DOM rect to Three.js ortho coordinates
    const x = r.left - cr.left + r.width / 2 - cr.width / 2
    const y = -(r.top - cr.top + r.height / 2 - cr.height / 2)
    meshRef.current.position.set(x, y, 0)
    meshRef.current.scale.set(r.width, r.height, 1)

    // Velocidad ya filtrada centralmente en el overlay (ver VelocitySmoother).
    // scrollVelocityRef aquí apunta al ref smoothed, no al crudo de lenis.
    uniformsRef.current.uScrollVelocity.value = scrollVelocityRef.current || 0

    // Update aspect ratios for object-cover UV math
    const img = texture.image
    if (img && img.width && img.height) {
      uniformsRef.current.uImageAspect.value = img.width / img.height
    }
    uniformsRef.current.uPlaneAspect.value = r.width / Math.max(1, r.height)

    // Smooth hover transition
    const target = isHovered ? 1.0 : 0.0
    hoverRef.current += (target - hoverRef.current) * HOVER_LERP
    if (Math.abs(hoverRef.current - target) < 0.005) hoverRef.current = target
    uniformsRef.current.uHover.value = hoverRef.current

    // Cursor position in card-local UV (0..1). Signal (-1,-1) when outside.
    const mp = mousePosRef?.current
    const muni = uniformsRef.current.uMouse.value
    if (isHovered && mp && r.width > 0 && r.height > 0) {
      const u = (mp.x - r.left) / r.width
      const v = 1.0 - (mp.y - r.top) / r.height
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        muni.set(u, v)
      } else {
        muni.set(-1, -1)
      }
    } else {
      muni.set(-1, -1)
    }

    // Time (seconds, wrapped) for animated grain
    uniformsRef.current.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false}>
      <rawShaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniformsRef.current}
        transparent={false}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}

// ── Centralized velocity smoother ─────────────────────────────────────────
// Lee scrollVelocityRef (crudo de lenis) y escribe smoothedRef con low-pass
// exponencial frame-rate independent. Se renderiza antes que los planes en
// el JSX, así que su useFrame registra primero y corre primero cada frame.
function VelocitySmoother({ rawRef, smoothedRef }) {
  useFrame((_, delta) => {
    const dt = Math.max(0.001, Math.min(delta, 0.1))
    const alpha = 1.0 - Math.exp(-dt * VELOCITY_SMOOTH_K)
    const raw = rawRef?.current || 0
    const target = Math.max(-VELOCITY_CLAMP, Math.min(VELOCITY_CLAMP, raw))
    const cur = smoothedRef.current || 0
    let next = cur + (target - cur) * alpha
    if (Math.abs(next) < 0.05) next = 0
    smoothedRef.current = next
  })
  return null
}

// ── Orthographic camera matching container ────────────────────────────────
function OrthoCamera({ containerRect }) {
  const { camera } = useThree()
  useFrame(() => {
    if (!containerRect.current) return
    const w = containerRect.current.width
    const h = containerRect.current.height
    camera.left = -w / 2
    camera.right = w / 2
    camera.top = h / 2
    camera.bottom = -h / 2
    camera.near = -100
    camera.far = 100
    camera.position.set(0, 0, 10)
    camera.updateProjectionMatrix()
  })
  return null
}

// ── Pause canvas when tab is hidden ───────────────────────────────────────
function PauseWhenHidden() {
  const [hidden, setHidden] = React.useState(false)
  React.useEffect(() => {
    const onVis = () => {
      try { setHidden(document.visibilityState === 'hidden') } catch { setHidden(false) }
    }
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  return <PauseFrameloop paused={hidden} />
}

// ── Main overlay component ────────────────────────────────────────────────
export default function DragShaderOverlay({
  items = [],
  cardRefsMap,
  scrollVelocityRef,
  scrollerRef,
  scrollbarOffsetRight = 0,
  hoveredIdx = -1,
  paused = false,
}) {
  const containerRectRef = useRef(null)
  const mousePosRef = useRef({ x: -9999, y: -9999 })
  // Shared smoothed velocity (populated by <VelocitySmoother/> dentro del Canvas)
  const smoothedVelocityRef = useRef(0)
  const [canvasKey, setCanvasKey] = useState(0)
  const [degraded, setDegraded] = useState(false)

  // Track global cursor position (overlay is pointer-events:none so we listen on window)
  useEffect(() => {
    const onMove = (e) => {
      mousePosRef.current.x = e.clientX
      mousePosRef.current.y = e.clientY
    }
    const onLeave = () => {
      mousePosRef.current.x = -9999
      mousePosRef.current.y = -9999
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  // Keep container rect up to date via RAF for smooth sync
  useEffect(() => {
    let raf
    const update = () => {
      try {
        const el = scrollerRef?.current
        if (el) containerRectRef.current = el.getBoundingClientRect()
      } catch { }
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [scrollerRef])

  // Also measure on resize as a safety net
  useEffect(() => {
    const measure = () => {
      try {
        const el = scrollerRef?.current
        if (el) containerRectRef.current = el.getBoundingClientRect()
      } catch { }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [scrollerRef])

  // Pre-load textures
  const textures = useMemo(() => {
    return items.map((it) => {
      try { return loadTexture(it.image) } catch { return null }
    })
  }, [items])

  if (degraded) return null

  return (
    <div
      className="fixed inset-0 z-[12005] pointer-events-none"
      aria-hidden
      style={{ right: `${scrollbarOffsetRight}px` }}
      data-work-shader
    >
      <Canvas
        key={canvasKey}
        className="w-full h-full block"
        orthographic
        flat
        frameloop="always"
        dpr={[1, Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)]}
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        }}
        camera={{ position: [0, 0, 10] }}
        events={undefined}
        style={{ pointerEvents: 'none' }}
        onCreated={(state) => {
          try { state.gl.domElement.style.pointerEvents = 'none' } catch { }
          try {
            _maxAnisotropy = state.gl.capabilities.getMaxAnisotropy() || 1
            // Re-apply anisotropy to already-cached textures
            textureCache.forEach((t) => { t.anisotropy = _maxAnisotropy; t.needsUpdate = true })
          } catch { }
          try {
            const canvas = state.gl.domElement
            canvas.addEventListener('webglcontextlost', (e) => {
              try { e.preventDefault() } catch { }
              setDegraded(true)
            }, { passive: false })
            canvas.addEventListener('webglcontextrestored', () => {
              setCanvasKey((k) => k + 1)
              setDegraded(false)
            })
          } catch { }
        }}
      >
        <PauseWhenHidden />
        <PauseFrameloop paused={paused} />
        <OrthoCamera containerRect={containerRectRef} />
        <VelocitySmoother rawRef={scrollVelocityRef} smoothedRef={smoothedVelocityRef} />
        {items.map((it, idx) => {
          const tex = textures[idx]
          if (!tex) return null
          const cardRectRef = cardRefsMap?.get(idx)
          if (!cardRectRef) return null
          return (
            <DragPlane
              key={it.id || idx}
              cardRect={cardRectRef}
              texture={tex}
              scrollVelocityRef={smoothedVelocityRef}
              containerRect={containerRectRef}
              isHovered={hoveredIdx === idx}
              showIcon={Boolean(it.url)}
              mousePosRef={mousePosRef}
            />
          )
        })}
      </Canvas>
    </div>
  )
}
