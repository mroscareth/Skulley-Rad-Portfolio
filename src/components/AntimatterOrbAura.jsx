import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Aura del orb antimateria — particulas orbitando + runas SDF flotantes.
// Inspirado en PortalParticles / Portal.jsx pero simplificado y escalado al
// tamaño de un orb. Todo es proporcional al `radius`.
//
// API IMPERATIVA: HomeOrbs guarda un ref por orb y llama setVisible/setRadius/
// setColor desde el sync loop. Así evita re-renders cuando el orb respawnea o
// cambia de estado antimatter.

const PARTICLE_COUNT = 14
const RUNE_COUNT = 3

const _tempColor = new THREE.Color()

const AntimatterOrbAura = forwardRef(function AntimatterOrbAura({
  color = '#ff2200',
  radius = 0.4,
  visible = false,
}, ref) {
  const groupRef = useRef(null)

  // Per-particle seeds (deterministas por instancia, estables en frames).
  const aSeed = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) arr[i] = Math.random() * Math.PI * 2
    return arr
  }, [])
  // Dummy positions — el vertex shader calcula el pos real cada frame.
  const dummyPos = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), [])

  // Uniforms compartidos entre particulas y runas. Color y radius vivos para
  // que respondan a respawns (mismo orb, mismo grupo, props nuevas).
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uRadius: { value: radius },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
  })
  useEffect(() => {
    uniformsRef.current.uColor.value.set(color)
    uniformsRef.current.uRadius.value = radius
  }, [color, radius])

  // Uniforms por rune (orbitan a distintas velocidades / radios para no
  // moverse en sync entre sí). Comparten uTime/uColor/uRadius por referencia.
  const runeData = useMemo(() => {
    const arr = []
    for (let i = 0; i < RUNE_COUNT; i++) {
      arr.push({
        uTime: uniformsRef.current.uTime,
        uColor: uniformsRef.current.uColor,
        uRadius: uniformsRef.current.uRadius,
        uOffset: { value: (i / RUNE_COUNT) * Math.PI * 2 + Math.random() * 0.4 },
        uSpeed: { value: 0.25 + Math.random() * 0.35 },
        uSeed: { value: Math.random() * 100 },
      })
    }
    return arr
  }, [])

  useFrame((state) => {
    uniformsRef.current.uTime.value = state.clock.elapsedTime
  })

  useImperativeHandle(ref, () => ({
    setVisible: (v) => { if (groupRef.current) groupRef.current.visible = !!v },
    setRadius: (r) => { uniformsRef.current.uRadius.value = r },
    setColor: (c) => {
      _tempColor.set(c)
      if (!uniformsRef.current.uColor.value.equals(_tempColor)) {
        uniformsRef.current.uColor.value.copy(_tempColor)
      }
    },
  }), [])

  return (
    <group ref={groupRef} visible={visible}>
      {/* PARTICULAS — orbitan en cascarón esférico alrededor del orb */}
      <points frustumCulled={false} renderOrder={5} raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dummyPos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[aSeed, 1]} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          depthTest={true}
          blending={THREE.AdditiveBlending}
          uniforms={uniformsRef.current}
          vertexShader={`
            precision highp float;
            attribute float aSeed;
            uniform float uTime;
            uniform float uRadius;
            uniform float uPixelRatio;
            varying float vLife;
            void main() {
              // STREAM ASCENDENTE — cada particula tiene su propio ciclo:
              // nace cerca del orb (un poco abajo), sube linealmente, se
              // desvanece arriba. Como un portal pero pequeño.
              float speed = 0.4 + 0.25 * fract(aSeed * 0.31);
              float cycle = fract(uTime * speed + aSeed * 0.5);

              // Posición horizontal: cerca del orb, con leve drift outward al subir.
              float ang = aSeed * 2.13;
              float baseR = uRadius * (0.25 + 0.45 * fract(aSeed * 0.17));
              // Spread radial crece con la altura (forma de pluma de humo).
              float spread = uRadius * 0.45 * cycle;
              float wanderX = sin(uTime * 1.2 + aSeed * 1.7) * spread;
              float wanderZ = cos(uTime * 0.95 + aSeed * 2.3) * spread;

              // Vertical: nace ligeramente debajo del centro, sube hasta 3.2x radio.
              float maxH = uRadius * 3.2;
              float startY = -uRadius * 0.3;
              float y = mix(startY, maxH, cycle);

              vec3 pos = vec3(
                cos(ang) * baseR + wanderX,
                y,
                sin(ang) * baseR + wanderZ
              );

              // Fade in/out para que entre/salga suave del ciclo.
              float fadeIn = smoothstep(0.0, 0.12, cycle);
              float fadeOut = 1.0 - smoothstep(0.7, 1.0, cycle);
              vLife = fadeIn * fadeOut;

              vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              // Sprites más pequeños (menos bloom) y achicándose al subir.
              float baseSize = 2.0 + vLife * 2.4;
              gl_PointSize = baseSize * uRadius * (140.0 / max(1.0, -mvPosition.z)) * uPixelRatio;
            }
          `}
          fragmentShader={`
            precision highp float;
            uniform vec3 uColor;
            varying float vLife;
            void main() {
              vec2 uv = gl_PointCoord * 2.0 - 1.0;
              float d = length(uv);
              if (d > 1.0) discard;
              // Falloff más nítido = menos halo bloom.
              float core = pow(1.0 - d, 3.5);
              float halo = pow(1.0 - d, 2.0) * 0.12;
              float a = clamp(core + halo, 0.0, 1.0) * vLife;
              // Brillo bajado: 0.7+1.5*vLife → 0.35+0.6*vLife → mucho menos bloom.
              vec3 col = uColor * (0.35 + 0.6 * vLife);
              gl_FragColor = vec4(col, a);
            }
          `}
        />
      </points>

      {/* RUNAS — 3 planes shader-billboarded orbitando lento. Cada uno
          dibuja un glifo SDF procedural que muta cada ~2s. */}
      {runeData.map((u, i) => (
        <mesh key={i} raycast={() => null} renderOrder={5}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            uniforms={u}
            vertexShader={`
              precision highp float;
              uniform float uTime;
              uniform float uRadius;
              uniform float uOffset;
              uniform float uSpeed;
              uniform float uSeed;
              varying vec2 vUv;
              varying float vLife;
              void main() {
                vUv = uv;
                // STREAM ASCENDENTE — runas suben en su propio ciclo, no orbitan.
                // Las 3 runas tienen uOffset/uSeed distintos → ciclos desfasados.
                float speed = uSpeed * 0.35;  // más lento que las particulas
                float cycle = fract(uTime * speed + uOffset * 0.16 + uSeed * 0.013);

                // Posición horizontal: angular fijo per-rune (no orbita), con
                // ligero sway que crece al subir.
                float ang = uOffset;
                float baseR = uRadius * 0.45;
                float sway = sin(uTime * 0.9 + uSeed) * uRadius * 0.35 * cycle;
                float swayZ = cos(uTime * 0.7 + uSeed * 1.4) * uRadius * 0.35 * cycle;

                // Vertical: nace en el centro, sube hasta 3.6x radio.
                float maxH = uRadius * 3.6;
                float y = mix(-uRadius * 0.1, maxH, cycle);

                vec3 center = vec3(
                  cos(ang) * baseR + sway,
                  y,
                  sin(ang) * baseR + swayZ
                );

                // Vida para fade in/out
                float fadeIn = smoothstep(0.0, 0.15, cycle);
                float fadeOut = 1.0 - smoothstep(0.65, 1.0, cycle);
                vLife = fadeIn * fadeOut;

                // Billboard estándar: centro a view-space + offset del vértice.
                float planeSize = uRadius * 0.45;
                vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
                vec4 mvFinal = mvCenter + vec4(position.x * planeSize, position.y * planeSize, 0.0, 0.0);
                gl_Position = projectionMatrix * mvFinal;
              }
            `}
            fragmentShader={`
              precision highp float;
              uniform vec3 uColor;
              uniform float uTime;
              uniform float uSeed;
              varying vec2 vUv;
              varying float vLife;

              float hash21(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
              }

              float segLine(vec2 uv, vec2 a, vec2 b, float w) {
                vec2 pa = uv - a;
                vec2 ba = b - a;
                float denom = max(dot(ba, ba), 0.0001);
                float t = clamp(dot(pa, ba) / denom, 0.0, 1.0);
                float d = length(pa - ba * t);
                return smoothstep(w + 0.02, w, d);
              }

              void main() {
                vec2 uv = vUv - 0.5;
                // Tick lento → la runa muta cada ~2s. Seed distinto por instancia.
                float tick = floor(uTime * 0.5 + uSeed * 0.13);
                float accum = 0.0;
                for (int i = 0; i < 3; i++) {
                  float fi = float(i);
                  float x1 = floor(hash21(vec2(uSeed + tick + fi * 3.13, 1.0)) * 4.0) / 3.0 - 0.5;
                  float y1 = floor(hash21(vec2(uSeed + tick + fi * 5.17, 2.0)) * 4.0) / 3.0 - 0.5;
                  float x2 = floor(hash21(vec2(uSeed + tick + fi * 7.11, 3.0)) * 4.0) / 3.0 - 0.5;
                  float y2 = floor(hash21(vec2(uSeed + tick + fi * 11.3, 4.0)) * 4.0) / 3.0 - 0.5;
                  accum = max(accum, segLine(uv, vec2(x1, y1), vec2(x2, y2), 0.045));
                }
                if (accum < 0.05) discard;
                // Brillo MUCHO más bajo + multiplicado por vLife (fade del ciclo).
                float pulse = 0.7 + 0.3 * sin(uTime * 1.6 + uSeed);
                vec3 col = uColor * (0.45 + 0.35 * pulse);
                gl_FragColor = vec4(col, accum * 0.55 * vLife);
              }
            `}
          />
        </mesh>
      ))}
    </group>
  )
})

export default AntimatterOrbAura
