import React from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'

function FullscreenQuad({ maskTex, progress = 0, softness = 0.08, invert = false }) {
  const materialRef = React.useRef()
  const fragment = React.useMemo(() => `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uMask;
    uniform float uT;
    uniform float uSoft;
    uniform float uInvert;
    void main() {
      vec3 m = texture2D(uMask, vUv).rgb;
      float lum = dot(m, vec3(0.299, 0.587, 0.114));
      if (uInvert > 0.5) { lum = 1.0 - lum; }
      float t0 = clamp(uT - uSoft, 0.0, 1.0);
      float t1 = clamp(uT + uSoft, 0.0, 1.0);
      float k = smoothstep(t0, t1, lum);
      // alpha alta fuera de la zona revelada (tapa con negro), baja donde se revela
      float alpha = 1.0 - k;
      gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
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
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uMask: { value: maskTex },
        uT: { value: progress },
        uSoft: { value: softness },
        uInvert: { value: invert ? 1.0 : 0.0 },
      },
    })
    return m
  }, [vertex, fragment])

  useFrame(() => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uMask.value = maskTex
    materialRef.current.uniforms.uT.value = progress
    materialRef.current.uniforms.uSoft.value = softness
    materialRef.current.uniforms.uInvert.value = invert ? 1.0 : 0.0
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

export default function ImageRevealMaskOverlay({
  active = false,
  maskTex = null,
  progress = 0,
  softness = 0.08,
  invert = false,
}) {
  if (!active || !maskTex) return null
  return (
    <div className="fixed inset-0 z-[86000] pointer-events-none" aria-hidden data-image-reveal-overlay>
      <Canvas dpr={[1, 1]} orthographic camera={{ position: [0, 0, 1], zoom: 1 }} gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}>
        <FullscreenQuad maskTex={maskTex} progress={progress} softness={softness} invert={invert} />
      </Canvas>
    </div>
  )
}




