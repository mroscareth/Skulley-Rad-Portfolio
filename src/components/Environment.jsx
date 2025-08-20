import React, { useMemo, useEffect } from 'react'
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
export default function Environment({ overrideColor, lowPerf = false }) {
  // Scene background color (can be overridden from props for proximity tint)
  const bg = overrideColor || '#204580'
  const { scene } = useThree()

  // Fuerza color de fondo siempre (evita que el HDRI se muestre como background)
  useEffect(() => {
    if (scene) {
      scene.background = new THREE.Color(bg)
    }
  }, [scene, bg])
  return (
    <>
      {/* HDRI environment (solo iluminación, sin mostrar imagen) */}
      <DreiEnv
        files={`${import.meta.env.BASE_URL}light.hdr`}
        background={false}
        frames={lowPerf ? 1 : 40}
      />

      {/* Global background override color to tint the scene */}
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 25, 120]} />

      {/* Key fill light to avoid flat shading when HDR is dark */}
      <ambientLight intensity={0.4} />

      {/* Ground reflective plane with opaque reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <MeshReflectorMaterial
          blur={lowPerf ? [80, 24] : [120, 32]}
          resolution={lowPerf ? 256 : 512}
          mixBlur={0.8}
          mixStrength={lowPerf ? 1.2 : 1.6}
          roughness={0.88}
          metalness={0}
          mirror={lowPerf ? 0.12 : 0.18}
          depthScale={0.55}
          minDepthThreshold={0.48}
          maxDepthThreshold={1.08}
          color={bg}
        />
      </mesh>
    </>
  )
}