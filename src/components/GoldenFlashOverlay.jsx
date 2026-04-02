import React, { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * GoldenFlashOverlay — fullscreen golden flash when gold skin activates.
 * Renders a screen-space quad with additive blending.
 * Zero cost when inactive (visible=false, no useFrame work).
 */
export default function GoldenFlashOverlay({ active = false, duration = 0.5 }) {
  const meshRef = useRef()
  const startTimeRef = useRef(-1)
  const { camera } = useThree()

  const uniforms = useMemo(() => ({
    uProgress: { value: 0 },
    uColor: { value: new THREE.Color('#ffaa00') },
  }), [])

  useFrame((state) => {
    if (!meshRef.current) return
    if (!active) {
      if (meshRef.current.visible) meshRef.current.visible = false
      startTimeRef.current = -1
      return
    }
    // Lazily capture start time
    if (startTimeRef.current < 0) {
      startTimeRef.current = state.clock.getElapsedTime()
      meshRef.current.visible = true
    }
    const elapsed = state.clock.getElapsedTime() - startTimeRef.current
    const t = Math.min(elapsed / duration, 1)
    // Fast rise, slow fall (asymmetric flash)
    const flash = t < 0.25
      ? t / 0.25 // rise: 0→1 in first 25%
      : 1 - Math.pow((t - 0.25) / 0.75, 0.6) // fall: easeOut over remaining 75%
    uniforms.uProgress.value = Math.max(0, flash)

    // Keep the quad in front of the camera
    meshRef.current.position.copy(camera.position)
    meshRef.current.quaternion.copy(camera.quaternion)
    meshRef.current.translateZ(-0.5)
  })

  return (
    <mesh ref={meshRef} visible={false} renderOrder={9999} frustumCulled={false}>
      <planeGeometry args={[4, 4]} />
      <shaderMaterial
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uProgress;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            // Radial vignette: brighter center, darker edges
            vec2 c = vUv - 0.5;
            float vignette = 1.0 - dot(c, c) * 2.0;
            vignette = clamp(vignette, 0.0, 1.0);
            // Flash intensity with vignette
            float intensity = uProgress * vignette * 0.85;
            gl_FragColor = vec4(uColor * intensity, intensity);
          }
        `}
      />
    </mesh>
  )
}
