import React, { useMemo } from 'react'
import { Environment as DreiEnv, MeshReflectorMaterial, useTexture } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Environment
 *
 * Provides basic lighting and a ground plane for the scene.  A large grid is
 * added as a visual reference so the player doesn’t appear to float in empty
 * space.  The plane receives shadows cast by the directional light.
 */
export default function Environment({ overrideColor }) {
  // Scene background color (can be overridden from props for proximity tint)
  const bg = overrideColor || '#204580'
  return (
    <>
      {/* HDRI environment (solo iluminación, sin mostrar imagen) */}
      <DreiEnv files={`${import.meta.env.BASE_URL}light.hdr`} background={false} />

      {/* Global background override color to tint the scene */}
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 25, 120]} />

      {/* Key fill light to avoid flat shading when HDR is dark */}
      <ambientLight intensity={0.4} />

      {/* Ground reflective plane with opaque reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <MeshReflectorMaterial
          blur={[200, 50]}
          resolution={1024}
          mixBlur={1}
          mixStrength={2.0}
          roughness={0.8}
          metalness={0}
          mirror={0.25}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color={bg}
        />
      </mesh>
    </>
  )
}