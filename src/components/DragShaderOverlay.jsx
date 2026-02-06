import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import PauseFrameloop from './PauseFrameloop.jsx'

// ── Inline GLSL ───────────────────────────────────────────────────────────
// Vertex: sinusoidal deformation on Y based on scroll velocity (the "DRAG" effect)
const vertexShader = /* glsl */ `
precision mediump float;

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

// Fragment: object-cover UV + hover darkening + external link icon
const fragmentShader = /* glsl */ `
precision mediump float;

uniform sampler2D uTexture;
uniform sampler2D uIconTexture;
uniform float uHover;
uniform float uShowIcon;
uniform float uImageAspect;
uniform float uPlaneAspect;

varying vec2 vUv;

void main() {
  // ── Object-cover UV adjustment ──
  vec2 uv = vUv;
  float ratio = uImageAspect / uPlaneAspect;
  if (ratio > 1.0) {
    float s = 1.0 / ratio;
    uv.x = vUv.x * s + (1.0 - s) * 0.5;
  } else {
    uv.y = vUv.y * ratio + (1.0 - ratio) * 0.5;
  }

  vec4 color = texture2D(uTexture, uv);

  // Darken on hover
  color.rgb = mix(color.rgb, color.rgb * 0.1, uHover);

  // ── External link icon (composited in shader so it deforms with the mesh) ──
  if (uShowIcon > 0.5) {
    // Icon size relative to plane height, aspect-corrected for square shape
    float iconH = 0.11;
    float iconW = iconH / uPlaneAspect;
    float padH = 0.03;
    float padW = padH / uPlaneAspect;

    // Bottom-right position in UV space (Y=0 is bottom in GL)
    vec2 iconMin = vec2(1.0 - padW - iconW, padH);
    vec2 iconMax = vec2(1.0 - padW, padH + iconH);

    if (vUv.x >= iconMin.x && vUv.x <= iconMax.x &&
        vUv.y >= iconMin.y && vUv.y <= iconMax.y) {
      vec2 iconUv = (vUv - iconMin) / (iconMax - iconMin);
      iconUv.y = 1.0 - iconUv.y; // Flip Y for canvas coordinates
      vec4 iconSample = texture2D(uIconTexture, iconUv);
      // Slightly brighter icon on hover (0.8 → 1.0 opacity)
      float iconAlpha = iconSample.a * mix(0.85, 1.0, uHover);
      color.rgb = mix(color.rgb, iconSample.rgb, iconAlpha);
    }
  }

  gl_FragColor = color;
}
`

// ── Texture loader (singleton cache) ──────────────────────────────────────
const loader = new THREE.TextureLoader()
const textureCache = new Map()

function loadTexture(src) {
  if (textureCache.has(src)) return textureCache.get(src)
  const tex = loader.load(src)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
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

function DragPlane({ cardRect, texture, scrollVelocityRef, containerRect, isHovered, showIcon }) {
  const meshRef = useRef()
  const hoverRef = useRef(0)
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(1, 1, SEGMENTS, SEGMENTS),
    [],
  )

  const iconTexture = useMemo(() => getIconTexture(), [])

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uIconTexture: { value: iconTexture },
      uScrollVelocity: { value: 0.0 },
      uHover: { value: 0.0 },
      uShowIcon: { value: showIcon ? 1.0 : 0.0 },
      uImageAspect: { value: 1.0 },
      uPlaneAspect: { value: 1.0 },
    }),
    [texture, iconTexture, showIcon],
  )

  useFrame(() => {
    if (!meshRef.current || !cardRect.current || !containerRect.current) return
    const cr = containerRect.current
    const r = cardRect.current

    // Convert DOM rect to Three.js ortho coordinates
    const x = r.left - cr.left + r.width / 2 - cr.width / 2
    const y = -(r.top - cr.top + r.height / 2 - cr.height / 2)
    meshRef.current.position.set(x, y, 0)
    meshRef.current.scale.set(r.width, r.height, 1)

    // Update scroll velocity uniform
    uniforms.uScrollVelocity.value = scrollVelocityRef.current || 0

    // Update aspect ratios for object-cover UV math
    const img = texture.image
    if (img && img.width && img.height) {
      uniforms.uImageAspect.value = img.width / img.height
    }
    uniforms.uPlaneAspect.value = r.width / Math.max(1, r.height)

    // Smooth hover transition
    const target = isHovered ? 1.0 : 0.0
    hoverRef.current += (target - hoverRef.current) * HOVER_LERP
    if (Math.abs(hoverRef.current - target) < 0.005) hoverRef.current = target
    uniforms.uHover.value = hoverRef.current
  })

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false}>
      <rawShaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={false}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
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
  const [canvasKey, setCanvasKey] = useState(0)
  const [degraded, setDegraded] = useState(false)

  // Keep container rect up to date via RAF for smooth sync
  useEffect(() => {
    let raf
    const update = () => {
      try {
        const el = scrollerRef?.current
        if (el) containerRectRef.current = el.getBoundingClientRect()
      } catch {}
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
      } catch {}
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
          try { state.gl.domElement.style.pointerEvents = 'none' } catch {}
          try {
            const canvas = state.gl.domElement
            canvas.addEventListener('webglcontextlost', (e) => {
              try { e.preventDefault() } catch {}
              setDegraded(true)
            }, { passive: false })
            canvas.addEventListener('webglcontextrestored', () => {
              setCanvasKey((k) => k + 1)
              setDegraded(false)
            })
          } catch {}
        }}
      >
        <PauseWhenHidden />
        <PauseFrameloop paused={paused} />
        <OrthoCamera containerRect={containerRectRef} />
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
              scrollVelocityRef={scrollVelocityRef}
              containerRect={containerRectRef}
              isHovered={hoveredIdx === idx}
              showIcon={Boolean(it.url)}
            />
          )
        })}
      </Canvas>
    </div>
  )
}
