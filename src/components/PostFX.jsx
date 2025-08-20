import React, { useMemo, useRef } from 'react'
import { EffectComposer, Bloom, SMAA, Vignette, Noise, ToneMapping, DotScreen, GodRays, DepthOfField, Glitch, ChromaticAberration } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BlendFunction, ToneMappingMode, GlitchMode } from 'postprocessing'

export default function PostFX({
  lowPerf = false,
  eggActiveGlobal = false,
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
        {!lowPerf && dofEnabled && (
          <DepthOfField
            focusDistance={dofProgressive ? focusDistRef.current : dofFocusDistance}
            focalLength={dofFocalLength}
            bokehScale={dofBokehScale}
          />
        )}
        <Vignette eskil={false} offset={0.15} darkness={vignette} />
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
        {dotEnabled && !lowPerf && (
          <DotScreen
            blendFunction={dotBlendFn}
            angle={dotAngle}
            scale={dotScale}
            center={[dotCenterX, dotCenterY]}
            opacity={dotOpacity}
          />
        )}
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={lowPerf ? Math.min(noise, 0.04) : noise} />
        {eggActiveGlobal && !lowPerf && (
          <>
            <ChromaticAberration offset={[0.0016, 0.001]} radialModulation modulationOffset={0.18} />
            <Glitch
              delay={[0.2, 0.45]}
              duration={[0.25, 0.6]}
              strength={[0.22, 0.4]}
              mode={GlitchMode.SPORADIC}
              active
              columns={0.0005}
            />
          </>
        )}
      </EffectComposer>

      {/* UI externa controlada desde App.jsx */}
    </>
  )
}


