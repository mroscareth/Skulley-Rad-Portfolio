import React from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'

const NoiseMixMat = shaderMaterial(
  {
    uA: null,
    uB: null,
    uNoise: null,
    uProgress: 0,
    uEdge: 0.35,
    uSpeed: 1.5,
    uTime: 0,
    uResolution: new THREE.Vector2(1, 1),
  },
  `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  `
    uniform sampler2D uA;       // Scene A (prev)
    uniform sampler2D uB;       // Scene B (next)
    uniform sampler2D uNoise;   // noise (iChannel0)
    uniform float uProgress;
    uniform float uEdge;
    uniform float uSpeed;
    uniform float uTime;
    uniform vec2  uResolution;
    varying vec2  vUv;

    mat4 rot(float a){
      float c = cos(a), s = sin(a);
      return mat4(c, s, 0., 0., -s, c, 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.);
    }
    mat2 R(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
    float B(vec2 u){ return 1.0 - abs( 2.0 * texture2D(uNoise, u/1000.0).r - 1.0 ); }
    float N(in vec2 u, float T){
      const int L = 20;
      mat2 M = R(1.7);
      float v = 0.0, t = 0.0;
      for (int i=0; i<L; i++) {
        float k = mod(float(i) - T, float(L));
        float a = 1.0 - cos(6.28318530718 * k / float(L));
        float s = exp2(k);
        v += a / s * B((M * u) * s);
        t += a / s;
        M = M * M;
      }
      return v / t;
    }
    void main(){
      vec2 Rv = uResolution;
      vec2 U = (vec2(vUv.x * Rv.x, vUv.y * Rv.y) / Rv.y) - vec2(0.5 * Rv.x / Rv.y, 0.5);
      float T = 1.5 * uTime * uSpeed;
      vec3 a = texture2D(uA, vUv).rgb;
      vec3 b = texture2D(uB, vUv).rgb;
      float e = clamp(0.03 + uEdge * uProgress, 0.0, 0.5);
      float m = sqrt( smoothstep(0.7 - e, 0.7 + e, N(U, T)) ); // black->A, white->B
      vec3 col = mix(a, b, m);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
)
// @ts-ignore
extend({ NoiseMixMat })

function FullscreenQuad({ prevTex, nextTex, progress = 0, edge = 0.35, speed = 1.5 }) {
  const mat = React.useRef()
  const noiseTex = React.useMemo(() => {
    const size = 256
    const data = new Uint8Array(size * size)
    for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 255)
    const tex = new THREE.DataTexture(data, size, size, THREE.LuminanceFormat)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true
    return tex
  }, [])
  useFrame((state) => {
    if (!mat.current) return
    const { size, clock } = state
    mat.current.uA = prevTex
    mat.current.uB = nextTex
    mat.current.uNoise = noiseTex
    mat.current.uProgress = progress
    mat.current.uEdge = edge
    mat.current.uSpeed = speed
    mat.current.uTime = clock.getElapsedTime()
    mat.current.uResolution.set(size.width, size.height)
  })
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <noiseMixMat ref={mat} />
    </mesh>
  )
}

export default function NoiseTransitionOverlay({
  active = false,
  prevTex = null,
  nextTex = null,
  prevSrc = null, // optional fallback
  nextSrc = null, // optional fallback
  progress = 0,
  edge = 0.35,
  speed = 1.5,
}) {
  const prevFromSrc = React.useMemo(() => {
    if (!prevSrc || prevTex) return null
    const t = new THREE.TextureLoader().load(prevSrc)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = true
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    return t
  }, [prevSrc, prevTex])
  const nextFromSrc = React.useMemo(() => {
    if (!nextSrc || nextTex) return null
    const t = new THREE.TextureLoader().load(nextSrc)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = true
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    return t
  }, [nextSrc, nextTex])
  React.useEffect(() => {
    return () => {
      try { prevFromSrc?.dispose?.() } catch {}
      try { nextFromSrc?.dispose?.() } catch {}
    }
  }, [prevFromSrc, nextFromSrc])
  const aTex = prevTex || prevFromSrc
  const bTex = nextTex || nextFromSrc
  if (!active || !aTex || !bTex) return null
  return (
    <div className="fixed inset-0 z-[70000] pointer-events-none" data-noise-overlay>
      <Canvas dpr={[1, 1.25]} orthographic camera={{ position: [0, 0, 1], zoom: 1 }} gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}>
        <FullscreenQuad prevTex={aTex} nextTex={bTex} progress={progress} edge={edge} speed={speed} />
      </Canvas>
    </div>
  )
}


