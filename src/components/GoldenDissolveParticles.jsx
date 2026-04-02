import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * GoldenDissolveParticles — GPU-driven dissolve particles for gold skin activation.
 * Particles rise from the character position like golden embers/ash.
 * Everything is computed in the vertex shader — zero JS physics loop.
 * Pre-allocated geometry, zero allocations on activation.
 */
const PARTICLE_COUNT = 300

export default function GoldenDissolveParticles({ active = false, playerRef, duration = 1.5 }) {
  const pointsRef = useRef()
  const startTimeRef = useRef(-1)

  // Pre-allocate per-particle attributes (stable, never recreated)
  const { seeds, offsets, speeds, sizes } = useMemo(() => {
    const seeds = new Float32Array(PARTICLE_COUNT)
    const offsets = new Float32Array(PARTICLE_COUNT * 3)
    const speeds = new Float32Array(PARTICLE_COUNT)
    const sizes = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      seeds[i] = Math.random() * Math.PI * 2
      // Random spawn offset around body (radius ~0.6, height ~0-2.0)
      const angle = Math.random() * Math.PI * 2
      const r = 0.1 + Math.random() * 0.5
      offsets[i * 3] = Math.cos(angle) * r
      offsets[i * 3 + 1] = Math.random() * 2.0
      offsets[i * 3 + 2] = Math.sin(angle) * r
      speeds[i] = 0.5 + Math.random() * 1.5
      sizes[i] = 1.0 + Math.random() * 2.0
    }
    return { seeds, offsets, speeds, sizes }
  }, [])

  // Dummy position attribute for vertex count
  const dummyPos = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), [])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uActive: { value: 0 },
    uPlayerPos: { value: new THREE.Vector3() },
    uColor1: { value: new THREE.Color('#ffcc00') },  // bright gold
    uColor2: { value: new THREE.Color('#ff8800') },  // warm orange
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
  }), [])

  useFrame((state) => {
    if (!pointsRef.current) return
    if (!active) {
      if (pointsRef.current.visible) pointsRef.current.visible = false
      startTimeRef.current = -1
      uniforms.uActive.value = 0
      return
    }
    // Lazily capture start
    if (startTimeRef.current < 0) {
      startTimeRef.current = state.clock.getElapsedTime()
      pointsRef.current.visible = true
      uniforms.uActive.value = 1
    }
    const elapsed = state.clock.getElapsedTime() - startTimeRef.current
    uniforms.uTime.value = elapsed
    uniforms.uProgress.value = Math.min(elapsed / duration, 1)
    // Sync renderer DPR
    if (state.gl?.getPixelRatio) {
      uniforms.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 2)
    }
    // Track player position
    if (playerRef?.current) {
      uniforms.uPlayerPos.value.copy(playerRef.current.position)
    }
  })

  return (
    <points ref={pointsRef} visible={false} frustumCulled={false} renderOrder={100}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={dummyPos} count={PARTICLE_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" array={seeds} count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aOffset" array={offsets} count={PARTICLE_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aSpeed" array={speeds} count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={PARTICLE_COUNT} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest={true}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float aSeed;
          attribute vec3 aOffset;
          attribute float aSpeed;
          attribute float aSize;

          uniform float uTime;
          uniform float uProgress;
          uniform float uActive;
          uniform vec3 uPlayerPos;
          uniform float uPixelRatio;

          varying float vLife;
          varying float vProgress;

          void main() {
            if (uActive < 0.5) {
              gl_Position = vec4(0.0, 0.0, -999.0, 1.0);
              gl_PointSize = 0.0;
              return;
            }

            vProgress = uProgress;

            // Staggered start per particle (delayed by seed)
            float delay = fract(aSeed * 1.618) * 0.4;
            float localT = max(0.0, uTime - delay);

            // Rise upward with slight spiral
            float riseSpeed = aSpeed * 2.0;
            float y = aOffset.y + localT * riseSpeed;

            // Spiral around vertical axis
            float spiralAngle = aSeed + localT * (1.5 + aSeed * 0.5);
            float spiralRadius = 0.3 + 0.2 * sin(localT * 2.0 + aSeed);
            float x = aOffset.x + cos(spiralAngle) * spiralRadius * 0.5;
            float z = aOffset.z + sin(spiralAngle) * spiralRadius * 0.5;

            // World position relative to player
            vec3 worldPos = uPlayerPos + vec3(x, y, z);

            // Life: fade in quickly, then fade out as particles rise
            float fadeIn = smoothstep(0.0, 0.15, localT);
            float fadeOut = 1.0 - smoothstep(0.6, 1.2, localT / max(riseSpeed, 0.1));
            float progressFade = 1.0 - uProgress * uProgress; // fade overall as effect ends
            vLife = fadeIn * fadeOut * progressFade;

            // Cull dead particles
            if (vLife < 0.01) {
              gl_Position = vec4(0.0, 0.0, -999.0, 1.0);
              gl_PointSize = 0.0;
              return;
            }

            vec4 mvPos = viewMatrix * vec4(worldPos, 1.0);
            gl_Position = projectionMatrix * mvPos;
            gl_PointSize = aSize * vLife * (120.0 / max(1.0, -mvPos.z)) * uPixelRatio;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          varying float vLife;
          varying float vProgress;

          void main() {
            vec2 uv = gl_PointCoord * 2.0 - 1.0;
            float d = length(uv);
            if (d > 1.0) discard;

            // Soft glow disc
            float core = pow(1.0 - d, 4.0);
            float halo = pow(1.0 - d, 1.5) * 0.25;
            float alpha = clamp(core + halo, 0.0, 1.0) * vLife;

            // Color varies per particle (gradient from gold to orange)
            vec3 col = mix(uColor1, uColor2, vProgress);
            col *= (1.0 + 0.5 * vLife); // brighter when alive

            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </points>
  )
}
