import React, { useMemo, useRef } from 'react'
import { EffectComposer, Bloom, SMAA, Vignette, Noise, ToneMapping, DotScreen, GodRays, DepthOfField, Glitch, ChromaticAberration, BrightnessContrast, HueSaturation } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BlendFunction, ToneMappingMode, GlitchMode, Effect } from 'postprocessing'

export default function PostFX({
  lowPerf = false,
  eggActiveGlobal = false,
  psychoEnabled = false,
  chromaOffsetX = 0,
  chromaOffsetY = 0,
  glitchActive = false,
  glitchStrengthMin = 0.2,
  glitchStrengthMax = 0.6,
  brightness = 0.0,
  contrast = 0.0,
  saturation = 0.0,
  hue = 0.0,
  // Warp (líquido)
  liquidStrength = 0.0,
  liquidScale = 3.0,
  liquidSpeed = 1.2,
  maskCenterX = 0.5,
  maskCenterY = 0.5,
  maskRadius = 0.6,
  maskFeather = 0.35,
  edgeBoost = 0.0,
  // Transition mix (prev -> next) — uses noise mask shader
  noiseMixEnabled = false,
  noiseMixProgress = 0.0,
  noisePrevTexture = null,
  // legacy ripple props kept for API compatibility (unused by noise mask)
  rippleCenterX = 0.5,
  rippleCenterY = 0.5,
  rippleFreq = 26.0,
  rippleWidth = 0.02,
  rippleStrength = 0.45,
  bloom = 0.25,
  vignette = 0.7,
  noise = 0.08,
  dotEnabled = true,
  dotScale = 1.0,
  dotAngle = Math.PI / 4,
  dotCenterX = 0.5,
  dotCenterY = 0.5,
  dotOpacity = 1.0,
  dotBlend = 'normal',
  // Cuando hay movimiento (player/cámara), DotScreen puede producir shimmer en bordes de alto contraste (sombras).
  // En vez de apagarlo por completo, lo atenuamos para mantener el look.
  motionDampenDots = false,
  godEnabled = false,
  godSun = null,
  godDensity = 0.9,
  godDecay = 0.95,
  godWeight = 0.6,
  godExposure = 0.3,
  godClampMax = 1.0,
  godSamples = 60,
  dofEnabled = false,
  dofProgressive = true,
  dofFocusDistance = 0.2,
  dofFocalLength = 0.02,
  dofBokehScale = 3.0,
  dofFocusSpeed = 0.08,
  dofTargetRef = null,
}) {
  const blendMap = useMemo(
    () => ({
      normal: BlendFunction.NORMAL,
      multiply: BlendFunction.MULTIPLY,
      screen: BlendFunction.SCREEN,
      overlay: BlendFunction.OVERLAY,
      softlight: BlendFunction.SOFT_LIGHT,
      add: BlendFunction.ADD,
      darken: BlendFunction.DARKEN,
      lighten: BlendFunction.LIGHTEN,
    }),
    [],
  )
  const dotBlendFn = blendMap[(dotBlend || 'normal').toLowerCase()] ?? BlendFunction.NORMAL
  const effectiveDotOpacity = motionDampenDots ? Math.min(dotOpacity, 0.012) : dotOpacity

  // Custom "liquid" distortion effect (warp + lift/tint/edge in mask)
  function LiquidDistortion({
    enabled,
    strength = 0.9,
    scale = 3.6,
    speed = 1.3,
    tint = [1.0, 0.25, 0.95],
    lift = 0.2,
    maskCenter = [0.5, 0.5],
    maskRadius = 0.6,
    maskFeather = 0.35,
    edgeBoost = 0.0,
  }) {
    const effectRef = useRef()
    const uniformsRef = useRef({
      uTime: new THREE.Uniform(0),
      uStrength: new THREE.Uniform(strength),
      uScale: new THREE.Uniform(scale),
      uSpeed: new THREE.Uniform(speed),
      uTint: new THREE.Uniform(new THREE.Vector3().fromArray(tint)),
      uLift: new THREE.Uniform(lift),
      uMaskCenter: new THREE.Uniform(new THREE.Vector2().fromArray(maskCenter)),
      uMaskRadius: new THREE.Uniform(maskRadius),
      uMaskFeather: new THREE.Uniform(maskFeather),
      uEdgeBoost: new THREE.Uniform(edgeBoost),
    })
    useFrame((_, dt) => {
      const u = uniformsRef.current
      u.uTime.value += dt
      u.uStrength.value = strength
      u.uScale.value = scale
      u.uSpeed.value = speed
      u.uTint.value.set(tint[0], tint[1], tint[2])
      u.uLift.value = lift
      u.uMaskCenter.value.set(maskCenter[0], maskCenter[1])
      u.uMaskRadius.value = maskRadius
      u.uMaskFeather.value = maskFeather
      u.uEdgeBoost.value = edgeBoost
    })
    const effect = useMemo(() => {
      const frag = `
        uniform sampler2D inputBuffer;
        uniform float uTime, uStrength, uScale, uSpeed, uLift, uMaskRadius, uMaskFeather, uEdgeBoost;
        uniform vec2 uMaskCenter;
        uniform vec3 uTint;
        varying vec2 vUv;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }
        float edge(vec2 uv){
          float px = 1.0 / 1024.0;
          vec3 tl = texture2D(inputBuffer, uv + vec2(-px, -px)).rgb;
          vec3 tr = texture2D(inputBuffer, uv + vec2(px, -px)).rgb;
          vec3 bl = texture2D(inputBuffer, uv + vec2(-px, px)).rgb;
          vec3 br = texture2D(inputBuffer, uv + vec2(px, px)).rgb;
          vec3 t = texture2D(inputBuffer, uv + vec2(0.0, -px)).rgb;
          vec3 b = texture2D(inputBuffer, uv + vec2(0.0,  px)).rgb;
          vec3 l = texture2D(inputBuffer, uv + vec2(-px, 0.0)).rgb;
          vec3 r = texture2D(inputBuffer, uv + vec2( px, 0.0)).rgb;
          vec3 gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
          vec3 gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
          return length(gx+gy);
        }
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outColor) {
          float d = distance(uv, uMaskCenter);
          float k = smoothstep(uMaskRadius, uMaskRadius - uMaskFeather, d);
          float t = uTime * uSpeed;
          vec2 nUv = uv * uScale;
          float n = noise(nUv + vec2(0.0, t)) * 0.5 + noise(nUv * 2.0 + vec2(t, 0.0)) * 0.25;
          vec2 warp = vec2(
            sin((uv.y * 6.28318 + n*2.0) + t*1.2),
            cos((uv.x * 6.28318 + n*2.0) - t*1.4)
          ) * (0.004 + 0.03 * uStrength * (1.0 - k));
          vec2 suv = uv + warp;
          vec4 col = texture2D(inputBuffer, suv);
          float e = edge(uv) * uEdgeBoost * (1.0 - k);
          col.rgb += e * vec3(0.9, 0.2, 1.0);
          vec3 tintCol = mix(col.rgb, uTint, 0.35 * (1.0 - k));
          tintCol += uLift * (1.0 - k);
          outColor = vec4(tintCol, col.a);
        }
      `
      // @ts-ignore
      const e = new Effect('Liquid', frag, {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map(Object.entries(uniformsRef.current)),
      })
      effectRef.current = e
      return e
    }, [])
    if (!enabled || !prevTex) return null
    return <primitive object={effectRef.current} />
  }

  // Noise-mask A/B mix (prevTexture -> inputBuffer) using shadertoy-like noise
  function NoiseMaskMix({
    enabled,
    prevTex = null,
    progress = 0.0,
    edge = 0.35,     // maximum half-width for the smoothstep window
    speed = 1.5,     // time multiplier for scrolling noise
    noiseTex = null, // tileable noise texture (sampler2D)
  }) {
    const effectRef = useRef()
    const uniformsRef = useRef({
      uPrev: new THREE.Uniform(prevTex),
      uProgress: new THREE.Uniform(progress),
      uEdge: new THREE.Uniform(edge),
      uSpeed: new THREE.Uniform(speed),
      uNoise: new THREE.Uniform(noiseTex),
      uTime: new THREE.Uniform(0),
      uResolution: new THREE.Uniform(new THREE.Vector2(1, 1)),
    })
    const { size, clock } = useThree()
    useFrame(() => {
      const u = uniformsRef.current
      u.uPrev.value = prevTex
      u.uProgress.value = progress
      u.uEdge.value = edge
      u.uSpeed.value = speed
      u.uNoise.value = noiseTex
      u.uTime.value = clock.getElapsedTime()
      u.uResolution.value.set(size.width, size.height)
    })
    const effect = useMemo(() => {
      const frag = `
        uniform sampler2D inputBuffer; // next scene (composer input)
        uniform sampler2D uPrev;       // captured previous frame (A)
        uniform sampler2D uNoise;      // noise texture (iChannel0)
        uniform float uProgress, uEdge, uTime, uSpeed;
        uniform vec2 uResolution;
        varying vec2 vUv;
        // ---- Noise mask from shadertoy sketch ----
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
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outColor) {
          vec2 R = uResolution;
          vec2 U = (vec2(uv.x * R.x, uv.y * R.y) - 0.5 * R) / R.y;
          float T = 1.5 * uTime * uSpeed;
          vec3 nextCol = texture2D(inputBuffer, uv).rgb;
          vec3 prevCol = texture2D(uPrev, uv).rgb;
          float e = clamp(0.03 + uEdge * uProgress, 0.0, 0.5); // add base width to avoid hard pop at t=0
          float mask = sqrt( smoothstep(0.7 - e, 0.7 + e, N(U, T)) );
          vec3 col = mix(prevCol, nextCol, mask);
          outColor = vec4(col, 1.0);
        }
      `
      // @ts-ignore
      const e = new Effect('NoiseMaskMix', frag, {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map(Object.entries(uniformsRef.current)),
      })
      effectRef.current = e
      return e
    }, [])
    if (!enabled || !prevTex || !noiseTex) return null
    return <primitive object={effectRef.current} />
  }

  // Noise alpha-mask reveal (no prev texture): reveals next scene with noise mask alpha
  function NoiseAlphaMask({
    enabled,
    progress = 0.0,
    edge = 0.35,
    speed = 1.5,
    noiseTex = null,
  }) {
    const effectRef = useRef()
    const uniformsRef = useRef({
      uProgress: new THREE.Uniform(progress),
      uEdge: new THREE.Uniform(edge),
      uSpeed: new THREE.Uniform(speed),
      uNoise: new THREE.Uniform(noiseTex),
      uTime: new THREE.Uniform(0),
      uResolution: new THREE.Uniform(new THREE.Vector2(1, 1)),
    })
    const { size, clock } = useThree()
    useFrame(() => {
      const u = uniformsRef.current
      u.uProgress.value = progress
      u.uEdge.value = edge
      u.uSpeed.value = speed
      u.uNoise.value = noiseTex
      u.uTime.value = clock.getElapsedTime()
      u.uResolution.value.set(size.width, size.height)
    })
    const effect = useMemo(() => {
      const frag = `
        uniform sampler2D inputBuffer; // next scene (composer input)
        uniform sampler2D uNoise;      // noise texture (iChannel0)
        uniform float uProgress, uEdge, uTime, uSpeed;
        uniform vec2 uResolution;
        varying vec2 vUv;
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
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outColor) {
          vec2 R = uResolution;
          vec2 U = (vec2(uv.x * R.x, uv.y * R.y) - 0.5 * R) / R.y;
          float T = 1.5 * uTime * uSpeed;
          vec4 nextC = texture2D(inputBuffer, uv);
          float e = clamp(0.03 + uEdge * uProgress, 0.0, 0.5); // base width for initial visibility
          float mask = sqrt( smoothstep(0.7 - e, 0.7 + e, N(U, T)) );
          outTEX = vec4(nextC.rgb, mask);
        }
      `.replace('outTEX','outColor'); // keep GLSL block readable
      // @ts-ignore
      const e = new Effect('NoiseAlphaMask', frag, {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map(Object.entries(uniformsRef.current)),
      })
      effectRef.current = e
      return e
    }, [])
    if (!enabled || !noiseTex) return null
    return <primitive object={effectRef.current} />
  }

  // Tiny tileable noise texture for noise mask
  const noiseTex = useMemo(() => {
    const size = 256
    const data = new Uint8Array(size * size)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.floor(Math.random() * 255)
    }
    // r182: LuminanceFormat fue removido → usar RedFormat (1 canal)
    const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true
    return tex
  }, [])
  // DOF progresivo: calcula focusDistance normalizado a partir de la Z en espacio de cámara
  const { camera } = useThree()
  const focusDistRef = useRef(dofFocusDistance)
  useFrame(() => {
    if (!dofEnabled || !dofProgressive || !dofTargetRef?.current) return
    const world = new THREE.Vector3()
    dofTargetRef.current.getWorldPosition(world)
    // a espacio de cámara
    world.applyMatrix4(camera.matrixWorldInverse)
    const zView = -world.z // delante de la cámara es positivo
    const t = THREE.MathUtils.clamp((zView - camera.near) / (camera.far - camera.near), 0, 1)
    focusDistRef.current = THREE.MathUtils.lerp(focusDistRef.current, t, dofFocusSpeed)
  })

  const godKey = useMemo(
    () => `gr:${godEnabled ? 1 : 0}:${godDensity.toFixed(3)}:${godDecay.toFixed(3)}:${godWeight.toFixed(3)}:${godExposure.toFixed(3)}:${godClampMax.toFixed(3)}:${godSamples}`,
    [godEnabled, godDensity, godDecay, godWeight, godExposure, godClampMax, godSamples],
  )

  return (
    <>
      <EffectComposer multisampling={0} disableNormalPass>
        {!lowPerf && <SMAA />}
        <Bloom mipmapBlur intensity={bloom} luminanceThreshold={0.86} luminanceSmoothing={0.18} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        {/* Liquid distortion before color pipeline */}
        {psychoEnabled && (
          <LiquidDistortion
            enabled
            strength={liquidStrength}
            scale={liquidScale}
            speed={liquidSpeed}
            tint={[1.0, 0.25, 0.95]}
            lift={brightness}
            maskCenter={[maskCenterX, maskCenterY]}
            maskRadius={maskRadius}
            maskFeather={maskFeather}
            edgeBoost={edgeBoost}
          />
        )}
        {!lowPerf && dofEnabled && (
          <DepthOfField
            focusDistance={dofProgressive ? focusDistRef.current : dofFocusDistance}
            focalLength={dofFocalLength}
            bokehScale={dofBokehScale}
          />
        )}
        {/* Noise-mask transition (prev->next) with automatic fallback to alpha-mask when no prev texture */}
        {noisePrevTexture ? (
          <NoiseMaskMix
            enabled={noiseMixEnabled}
            prevTex={noisePrevTexture}
            progress={noiseMixProgress}
            edge={0.35}
            speed={1.5}
            noiseTex={noiseTex}
          />
        ) : (
          <NoiseAlphaMask
            enabled={noiseMixEnabled}
            progress={noiseMixProgress}
            edge={0.35}
            speed={1.5}
            noiseTex={noiseTex}
          />
        )}
        {psychoEnabled && (
          <>
            <HueSaturation hue={hue} saturation={saturation} />
            <BrightnessContrast brightness={brightness} contrast={contrast} />
          </>
        )}
        {!eggActiveGlobal && <Vignette eskil={false} offset={0.15} darkness={vignette} />}
        {!lowPerf && godEnabled && godSun?.current && (
          <GodRays
            key={godKey}
            sun={godSun.current}
            density={godDensity}
            decay={godDecay}
            weight={godWeight}
            exposure={godExposure}
            clampMax={godClampMax}
            samples={godSamples}
            blendFunction={BlendFunction.SCREEN}
          />
        )}
        {/* DotScreen: mantener look, pero atenuar en movimiento para evitar shimmer */}
        {dotEnabled && (
          <DotScreen
            blendFunction={dotBlendFn}
            angle={dotAngle}
            scale={lowPerf ? Math.max(0.55, dotScale * 0.9) : dotScale}
            center={[dotCenterX, dotCenterY]}
            opacity={lowPerf ? Math.min(effectiveDotOpacity, 0.85) : effectiveDotOpacity}
          />
        )}
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={lowPerf ? Math.min(noise, 0.04) : noise} />
        {((eggActiveGlobal && !lowPerf) || psychoEnabled) && (
          <>
            <ChromaticAberration offset={[chromaOffsetX, chromaOffsetY]} />
            {glitchActive && (
              <Glitch
                delay={[0.01, 0.04]}
                duration={[0.25, 0.6]}
                strength={[glitchStrengthMin, glitchStrengthMax]}
                mode={GlitchMode.CONSTANT}
                active
                columns={0.006}
              />
            )}
          </>
        )}
      </EffectComposer>

      {/* UI externa controlada desde App.jsx */}
    </>
  )
}


