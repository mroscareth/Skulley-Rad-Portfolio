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
export default function Environment({ overrideColor, lowPerf = false, noAmbient = false, transparentBg = false }) {
  // Scene background color (can be overridden from props for proximity tint)
  const bg = overrideColor || '#204580'
  const { scene } = useThree()
  const reflectRef = useRef()

  // Fondo: si transparentBg, no fijar color de fondo (dejar clearAlpha controlar transparencia)
  useEffect(() => {
    if (!scene) return
    if (transparentBg) {
      try { scene.background = null } catch {}
    } else {
      try { scene.background = new THREE.Color(bg) } catch {}
    }
  }, [scene, bg, transparentBg])

  // Clamp highlights in reflector shader to avoid hot pixels, preserving tone mapping
  // Se configura una sola vez para evitar recompilaciones por cada cambio de color
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
      {/* HDRI environment (solo iluminación, sin mostrar imagen) */}
      <DreiEnv
        files={`${import.meta.env.BASE_URL}light.hdr`}
        background={false}
        frames={lowPerf ? 1 : 40}
        environmentIntensity={0.45}
      />

      {/* Global background override color to tint the scene (omit if transparent) */}
      {!transparentBg && <color id="bgcolor" attach="background" args={[bg]} />}
      <fog attach="fog" args={[bg, 25, 120]} />

      {/* Key fill light (opcional) */}
      {!noAmbient && (<ambientLight intensity={0.4} />)}

      {/* Ground reflective plane with opaque reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={-20}>
        <planeGeometry args={[1000, 1000]} />
        <MeshReflectorMaterial
          ref={reflectRef}
          blur={lowPerf ? [80, 24] : [140, 40]}
          resolution={lowPerf ? 256 : 512}
          mixBlur={0.6}
          mixStrength={0.85}
          roughness={0.94}
          metalness={0}
          mirror={0.08}
          depthScale={0.55}
          minDepthThreshold={0.5}
          maxDepthThreshold={1.05}
          mixContrast={0.85}
          dithering
          color={bg}
          depthWrite={true}
        />
      </mesh>

      
    </>
  )
}