import React from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'

function FullscreenQuad({ prevTex, nextTex, maskTex, progress = 0, softness = 0.08 }) {
  const materialRef = React.useRef()
  const fragment = React.useMemo(() => `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uA;
    uniform sampler2D uB;
    uniform sampler2D uMask;
    uniform float uT;        // 0..1
    uniform float uSoft;     // softness around threshold
    void main() {
      vec3 a = texture2D(uA, vUv).rgb;
      vec3 b = texture2D(uB, vUv).rgb;
      vec3 m = texture2D(uMask, vUv).rgb;
      float lum = dot(m, vec3(0.299, 0.587, 0.114)); // negro->0, blanco->1
      float t0 = clamp(uT - uSoft, 0.0, 1.0);
      float t1 = clamp(uT + uSoft, 0.0, 1.0);
      float k = smoothstep(t0, t1, lum);
      vec3 col = mix(a, b, k);
      gl_FragColor = vec4(col, 1.0);
    }
  `, [])
  const vertex = React.useMemo(() => `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `, [])

  const material = React.useMemo(() => {
    const m = new THREE.RawShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uA: { value: prevTex },
        uB: { value: nextTex },
        uMask: { value: maskTex },
        uT: { value: progress },
        uSoft: { value: softness },
      },
    })
    return m
  }, [vertex, fragment])

  useFrame(() => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uA.value = prevTex
    materialRef.current.uniforms.uB.value = nextTex
    materialRef.current.uniforms.uMask.value = maskTex
    materialRef.current.uniforms.uT.value = progress
    materialRef.current.uniforms.uSoft.value = softness
  })

  React.useEffect(() => () => { try { material.dispose() } catch {} }, [material])

  return (
    <mesh>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          attach="attributes-position"
          count={4}
          array={new Float32Array([
            -1, -1, 0,
             1, -1, 0,
            -1,  1, 0,
             1,  1, 0,
          ])}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-uv"
          count={4}
          array={new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            1, 1,
          ])}
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

export default function ImageMaskTransitionOverlay({
  active = false,
  prevTex = null,
  nextTex = null,
  maskTex = null,
  progress = 0,
  softness = 0.08,
}) {
  if (!active || !prevTex || !nextTex || !maskTex) return null
  return (
    <div className="fixed inset-0 z-[85000] pointer-events-none" aria-hidden data-image-mask-overlay>
      <Canvas dpr={[1, 1]} orthographic camera={{ position: [0, 0, 1], zoom: 1 }} gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}>
        <FullscreenQuad prevTex={prevTex} nextTex={nextTex} maskTex={maskTex} progress={progress} softness={softness} />
      </Canvas>
    </div>
  )
}





