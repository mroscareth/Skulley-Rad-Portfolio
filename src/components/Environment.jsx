import React, { useMemo, useEffect, useRef } from 'react'
import { Environment as DreiEnv, MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'

/**
 * Environment
 *
 * Provides basic lighting and a ground plane for the scene.  A large grid is
 * added as a visual reference so the player doesn’t appear to float in empty
 * space.  The plane receives shadows cast by the directional light.
 */
export default function Environment({ overrideColor, lowPerf = false, noAmbient = false, transparentBg = false, shadowCatcherOpacity }) {
  // Scene background color (can be overridden from props for proximity tint)
  const bg = overrideColor || '#204580'
  const { scene } = useThree()
  const reflectRef = useRef()
  const catcherOpacity = (typeof shadowCatcherOpacity === 'number')
    ? Math.max(0, Math.min(1, shadowCatcherOpacity))
    : (lowPerf ? 0.18 : 0.22)

  // Background: if transparentBg, don't set background color (let clearAlpha control transparency)
  useEffect(() => {
    if (!scene) return
    if (transparentBg) {
      try { scene.background = null } catch {}
    } else {
      try { scene.background = new THREE.Color(bg) } catch {}
    }
  }, [scene, bg, transparentBg])

  // Clamp highlights in reflector shader to avoid hot pixels, preserving tone mapping
  // Configured once to avoid recompilations on each color change
  useEffect(() => {
    const mat = reflectRef.current
    if (!mat) return
    mat.onBeforeCompile = (shader) => {
      try {
        const targetLine = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );'
        const replacement = `
          vec3 _out = outgoingLight;
          float _lum = dot(_out, vec3(0.2126, 0.7152, 0.0722));
          // Clamp only very hot highlights
          float _k = smoothstep(0.92, 1.2, _lum);
          vec3 _tgt = _out * (0.85 / max(_lum, 1e-3));
          _out = mix(_out, _tgt, _k);
          gl_FragColor = vec4(_out, diffuseColor.a );
        `
        if (shader.fragmentShader.includes(targetLine)) {
          shader.fragmentShader = shader.fragmentShader.replace(targetLine, replacement)
        }
      } catch {}
    }
    mat.needsUpdate = true
  }, [])
  return (
    <>
      {/* HDRI environment (lighting only, no visible background image)
          Important: keep even in lowPerf to avoid darkening the scene.
          In lowPerf use frames=1 to minimize cost (single PMREM pass). */}
      <DreiEnv
        files={`${import.meta.env.BASE_URL}light.hdr`}
        background={false}
        // For static HDRI we don't need 40 frames; reduces spikes/hitch.
        frames={1}
        environmentIntensity={0.60}
      />

      {/* Global background override color to tint the scene (omit if transparent) */}
      {!transparentBg && <color id="bgcolor" attach="background" args={[bg]} />}
      <fog attach="fog" args={[bg, 25, 120]} />

      {/* Key fill light (optional) */}
      {!noAmbient && (<ambientLight intensity={0.2} />)}

      {/* 
        Ground (reflector + shadow catcher)
        Common issue: MeshReflectorMaterial + receiveShadow can double-read the shadow
        (real shadow + reflection darkening). Split into two planes:
        - reflector (does NOT receive shadows)
        - shadow catcher (shadows only, no reflection)
      */}
      <group rotation={[-Math.PI / 2, 0, 0]} renderOrder={-20}>
        {/* In lowPerf use simple material instead of expensive reflector */}
        <mesh receiveShadow={false}>
          <planeGeometry args={[1000, 1000]} />
          {lowPerf ? (
            // Simple material without reflection (saves ~1 full RTT pass per frame)
            <meshStandardMaterial
              color={bg}
              roughness={0.95}
              metalness={0}
              dithering
            />
          ) : (
            <MeshReflectorMaterial
            ref={reflectRef}
            blur={[50, 20]}
            // This material is very expensive: keep resolution moderate even in high quality.
            resolution={128}
            mixBlur={0.35}
            // lower strength slightly in lowPerf to reduce visual cost
            mixStrength={0.28}
            roughness={0.94}
            metalness={0}
            mirror={0.02}
            depthScale={0.25}
            minDepthThreshold={0.5}
            maxDepthThreshold={1.05}
            mixContrast={0.5}
            dithering
            color={bg}
            depthWrite
            />
          )}
        </mesh>
        {/* 
          Shadow catcher
          Note: the group is rotated -90° on X, so the vertical offset is the local Z axis.
          Displacing on Y makes it coplanar and causes z-fighting/flicker on camera movement.
        */}
        <mesh position={[0, 0, 0.002]} receiveShadow renderOrder={-19}>
          <planeGeometry args={[1000, 1000]} />
          <shadowMaterial
            transparent
            opacity={catcherOpacity}
            depthWrite={false}
            // Extra protection against z-fighting with the reflector
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      
    </>
  )
}