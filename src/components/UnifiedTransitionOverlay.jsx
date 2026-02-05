/**
 * UnifiedTransitionOverlay - Single overlay with multi-effect shader
 * 
 * Supports the following effects:
 * - FADE: Fade to solid color
 * - DISSOLVE: Dissolution with procedural noise
 * - GRID: Animated cell grid (shader, not CSS)
 * - WIPE: Directional wipe
 * - MASK: Image mask
 */
import React, { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { TransitionEffect } from '../lib/useSceneTransition.js'

// Common vertex shader
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// Unified fragment shader with all effects
const fragmentShader = `
  precision highp float;
  
  uniform sampler2D uTexA;      // Scene A (source)
  uniform sampler2D uTexB;      // Scene B (destination)
  uniform sampler2D uNoise;     // Noise texture
  uniform sampler2D uMask;      // Mask texture
  uniform float uProgress;      // 0..1 (covering) or 1..2 (revealing for dissolve/mask)
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uCenter;         // Effect center (0..1)
  uniform vec3 uColor;          // Fade color
  uniform float uCellSize;      // Cell size for grid
  uniform float uEdge;          // Soft edge for dissolve
  uniform float uSoftness;      // Softness for mask/wipe
  uniform vec2 uDirection;      // Direction for wipe
  uniform int uEffect;          // Effect type
  
  varying vec2 vUv;
  
  // Simple noise function
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  // Smoothed value noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  // FBM (Fractional Brownian Motion)
  float fbm(vec2 p, float t) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) {
      v += a * noise(p + t * 0.1);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }
  
  // Effect FADE: darken to color and back
  vec4 effectFade(vec2 uv, float p) {
    // 0→1: fade A toward black
    // 1→2: fade black toward B
    vec3 texA = texture2D(uTexA, uv).rgb;
    vec3 texB = texture2D(uTexB, uv).rgb;
    
    if (p <= 1.0) {
      // Cover: blend A with black
      return vec4(mix(texA, uColor, p), 1.0);
    } else {
      // Reveal: blend black with B
      float revealP = p - 1.0;
      return vec4(mix(uColor, texB, revealP), 1.0);
    }
  }
  
  // Effect DISSOLVE: blend with animated noise
  vec4 effectDissolve(vec2 uv, float p) {
    vec3 a = texture2D(uTexA, uv).rgb;
    vec3 b = texture2D(uTexB, uv).rgb;
    
    // Normalize progress to 0..1 for blending
    float mixP = clamp(p < 1.0 ? 0.0 : (p - 1.0), 0.0, 1.0);
    
    // During cover phase (p < 1), show black
    if (p < 1.0) {
      float n = fbm(uv * 8.0, uTime);
      float threshold = p;
      float edge = uEdge * 0.5;
      float mask = smoothstep(threshold - edge, threshold + edge, n);
      return vec4(mix(a, uColor, 1.0 - mask), 1.0);
    }
    
    // During reveal phase (p >= 1), blend toward B
    float n = fbm(uv * 8.0, uTime);
    float revealP = p - 1.0;
    float threshold = revealP;
    float edge = uEdge * 0.5;
    float mask = smoothstep(threshold - edge, threshold + edge, n);
    return vec4(mix(uColor, b, mask), 1.0);
  }
  
  // Effect GRID: cells appearing/disappearing radially
  vec4 effectGrid(vec2 uv, float p) {
    // Calculate cell position
    vec2 pixelPos = uv * uResolution;
    vec2 cellPos = floor(pixelPos / uCellSize);
    vec2 cellUV = (cellPos + 0.5) * uCellSize / uResolution;
    
    // Distance from effect center
    vec2 diff = cellUV - uCenter;
    // Adjust for aspect ratio
    diff.x *= uResolution.x / uResolution.y;
    float dist = length(diff);
    float maxDist = 1.2; // Approximate max distance
    float normalizedDist = clamp(dist / maxDist, 0.0, 1.0);
    
    // Random per-cell variation (staggered effect)
    float cellRand = hash(cellPos) * 0.15;
    
    // p 0→1 is cover, p 1→2 is reveal
    float cellOpacity;
    
    if (p <= 1.0) {
      // COVER PHASE: cells from outside to inside
      // low threshold = covered earlier (with small p)
      // far cells (high dist) should cover FIRST → low threshold
      float threshold = 1.0 - normalizedDist - cellRand;
      threshold = clamp(threshold, 0.05, 0.95);
      // Fast per-cell transition for "appearance" effect
      cellOpacity = smoothstep(threshold - 0.08, threshold + 0.08, p);
    } else {
      // REVEAL PHASE: cells from center outward
      float revealP = p - 1.0; // 0→1
      // close cells (low dist) should reveal FIRST → low threshold
      float threshold = normalizedDist + cellRand;
      threshold = clamp(threshold, 0.05, 0.95);
      cellOpacity = 1.0 - smoothstep(threshold - 0.08, threshold + 0.08, revealP);
    }
    
    cellOpacity = clamp(cellOpacity, 0.0, 1.0);
    
    // Select texture: during cover show A, during reveal show B
    vec3 texColor = p <= 1.0 ? texture2D(uTexA, uv).rgb : texture2D(uTexB, uv).rgb;
    
    // Blend: cellOpacity=0 → texture, cellOpacity=1 → black
    vec3 col = mix(texColor, uColor, cellOpacity);
    return vec4(col, 1.0);
  }
  
  // Effect WIPE: directional wipe
  vec4 effectWipe(vec2 uv, float p) {
    vec3 a = texture2D(uTexA, uv).rgb;
    vec3 b = texture2D(uTexB, uv).rgb;
    
    // Projection along wipe direction
    float d = dot(uv - vec2(0.5), normalize(uDirection)) + 0.5;
    
    // During cover: go to black
    if (p < 1.0) {
      float threshold = p;
      float mask = smoothstep(threshold - uSoftness, threshold + uSoftness, d);
      return vec4(mix(uColor, a, mask), 1.0);
    }
    
    // During reveal: show B
    float revealP = p - 1.0;
    float threshold = revealP;
    float mask = smoothstep(threshold - uSoftness, threshold + uSoftness, d);
    return vec4(mix(uColor, b, mask), 1.0);
  }
  
  // Effect MASK: based on image mask
  vec4 effectMask(vec2 uv, float p) {
    vec3 a = texture2D(uTexA, uv).rgb;
    vec3 b = texture2D(uTexB, uv).rgb;
    vec3 m = texture2D(uMask, uv).rgb;
    float lum = dot(m, vec3(0.299, 0.587, 0.114));
    
    // During cover
    if (p < 1.0) {
      float threshold = p;
      float mask = smoothstep(threshold - uSoftness, threshold + uSoftness, lum);
      return vec4(mix(uColor, a, mask), 1.0);
    }
    
    // During reveal
    float revealP = p - 1.0;
    float threshold = revealP;
    float mask = smoothstep(threshold - uSoftness, threshold + uSoftness, lum);
    return vec4(mix(uColor, b, mask), 1.0);
  }
  
  void main() {
    vec2 uv = vUv;
    
    // Select effect
    if (uEffect == 0) {
      gl_FragColor = effectFade(uv, uProgress);
    } else if (uEffect == 1) {
      gl_FragColor = effectDissolve(uv, uProgress);
    } else if (uEffect == 2) {
      gl_FragColor = effectGrid(uv, uProgress);
    } else if (uEffect == 3) {
      gl_FragColor = effectWipe(uv, uProgress);
    } else if (uEffect == 4) {
      gl_FragColor = effectMask(uv, uProgress);
    } else {
      // Fallback: fade
      gl_FragColor = effectFade(uv, uProgress);
    }
  }
`

// Effect-to-shader-index mapping
const effectToIndex = {
  [TransitionEffect.FADE]: 0,
  [TransitionEffect.DISSOLVE]: 1,
  [TransitionEffect.GRID]: 2,
  [TransitionEffect.WIPE]: 3,
  [TransitionEffect.MASK]: 4,
}

function FullscreenQuad({ 
  texA, 
  texB, 
  maskTex,
  effect, 
  progress, 
  config,
}) {
  const materialRef = useRef()
  
  // Create noise texture once
  const noiseTex = useMemo(() => {
    const size = 256
    const data = new Uint8Array(size * size)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.floor(Math.random() * 255)
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true
    return tex
  }, [])
  
  // Black fallback texture
  const blackTex = useMemo(() => {
    const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat)
    tex.needsUpdate = true
    return tex
  }, [])
  
  // Shader material
  const material = useMemo(() => {
    return new THREE.RawShaderMaterial({
      vertexShader: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTexA: { value: null },
        uTexB: { value: null },
        uNoise: { value: noiseTex },
        uMask: { value: null },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1920, 1080) },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uColor: { value: new THREE.Vector3(0, 0, 0) },
        uCellSize: { value: 40 },
        uEdge: { value: 0.35 },
        uSoftness: { value: 0.08 },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uEffect: { value: 0 },
      },
    })
  }, [noiseTex])
  
  // Update uniforms every frame
  useFrame((state) => {
    if (!materialRef.current) return
    const { size, clock } = state
    const u = materialRef.current.uniforms
    
    // Textures
    u.uTexA.value = texA || blackTex
    u.uTexB.value = texB || texA || blackTex
    u.uMask.value = maskTex || blackTex
    
    // Progress and time
    u.uProgress.value = progress
    u.uTime.value = clock.getElapsedTime()
    u.uResolution.value.set(size.width, size.height)
    
    // Effect configuration
    u.uEffect.value = effectToIndex[effect] ?? 0
    u.uCenter.value.set(config.center?.[0] ?? 0.5, config.center?.[1] ?? 0.5)
    // Color: if array [0-255], divide; if [0-1], use directly
    const c0 = config.color?.[0] ?? 0
    const c1 = config.color?.[1] ?? 0
    const c2 = config.color?.[2] ?? 0
    const isNormalized = c0 <= 1 && c1 <= 1 && c2 <= 1
    u.uColor.value.set(
      isNormalized ? c0 : c0 / 255,
      isNormalized ? c1 : c1 / 255,
      isNormalized ? c2 : c2 / 255
    )
    u.uCellSize.value = config.cellSize ?? 40
    u.uEdge.value = config.edge ?? 0.35
    u.uSoftness.value = config.softness ?? 0.08
    u.uDirection.value.set(config.direction?.[0] ?? 1, config.direction?.[1] ?? 0)
  })
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { material.dispose() } catch {}
      try { noiseTex.dispose() } catch {}
      try { blackTex.dispose() } catch {}
    }
  }, [material, noiseTex, blackTex])
  
  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={4}
          array={new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0])}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-uv"
          count={4}
          array={new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])}
          itemSize={2}
        />
        <bufferAttribute
          attach="index"
          count={6}
          array={new Uint16Array([0, 1, 2, 2, 1, 3])}
          itemSize={1}
        />
      </bufferGeometry>
      <primitive object={material} attach="material" ref={materialRef} />
    </mesh>
  )
}

/**
 * Unified overlay component
 */
export default function UnifiedTransitionOverlay({
  active = false,
  effect = TransitionEffect.GRID,
  progress = 0,
  textureA = null,
  textureB = null,
  maskTex = null,
  config = {},
}) {
  // State for smooth fade out on completion
  const [mounted, setMounted] = React.useState(false)
  const [opacity, setOpacity] = React.useState(0)
  
  React.useEffect(() => {
    if (active) {
      setMounted(true)
      // Small delay so DOM is ready before fade in
      requestAnimationFrame(() => setOpacity(1))
    } else if (mounted) {
      // Fade out before unmounting
      setOpacity(0)
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [active, mounted])
  
  if (!mounted) return null
  
  return (
    <div 
      className="fixed inset-0 z-[200000] pointer-events-none" 
      aria-hidden
      data-unified-transition
      style={{
        opacity,
        transition: 'opacity 250ms ease-out',
      }}
    >
      <Canvas 
        dpr={[1, 1.5]} 
        orthographic 
        camera={{ position: [0, 0, 1], zoom: 1 }} 
        gl={{ 
          antialias: false, 
          alpha: false, 
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        }}
      >
        <FullscreenQuad
          texA={textureA}
          texB={textureB}
          maskTex={maskTex}
          effect={effect}
          progress={progress}
          config={config}
        />
      </Canvas>
    </div>
  )
}
