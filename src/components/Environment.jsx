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
      {/* HDRI environment (solo iluminación, sin mostrar imagen)
          Importante: mantenerlo también en lowPerf para evitar “oscurecer” la escena.
          En lowPerf usamos frames=1 para minimizar el costo (PMREM 1 vez). */}
      <DreiEnv
        files={`${import.meta.env.BASE_URL}light.hdr`}
        background={false}
        // Para HDRI estático no necesitamos 40 frames; reduce picos/hitch.
        frames={1}
        environmentIntensity={0.60}
      />

      {/* Global background override color to tint the scene (omit if transparent) */}
      {!transparentBg && <color id="bgcolor" attach="background" args={[bg]} />}
      <fog attach="fog" args={[bg, 25, 120]} />

      {/* Key fill light (opcional) */}
      {!noAmbient && (<ambientLight intensity={0.2} />)}

      {/* 
        Ground (reflector + shadow catcher)
        Problema típico: MeshReflectorMaterial + receiveShadow puede “duplicar” la lectura de sombra
        (sombra real + oscurecimiento en la reflexión). Lo separamos en dos planos:
        - reflector (NO recibe sombras)
        - shadow catcher (solo sombras, sin reflexión)
      */}
      <group rotation={[-Math.PI / 2, 0, 0]} renderOrder={-20}>
        {/* Reflector: mantenerlo también en lowPerf pero con menos resolución/blur */}
        <mesh receiveShadow={false}>
          <planeGeometry args={[1000, 1000]} />
          <MeshReflectorMaterial
            ref={reflectRef}
            blur={lowPerf ? [80, 24] : [140, 40]}
            // Este material es MUY caro: mantener resolución moderada incluso en “high”.
            resolution={lowPerf ? 192 : 256}
            mixBlur={0.6}
            // bajar un poco fuerza en lowPerf para reducir costo visual
            mixStrength={lowPerf ? 0.72 : 0.78}
            roughness={0.94}
            metalness={0}
            mirror={0.08}
            depthScale={0.55}
            minDepthThreshold={0.5}
            maxDepthThreshold={1.05}
            mixContrast={0.85}
            dithering
            color={bg}
            depthWrite
          />
        </mesh>
        {/* 
          Shadow catcher
          OJO: el grupo está rotado -90° en X, así que el “up” (separación vertical) es el eje Z local.
          Si desplazamos en Y, queda coplanar y produce z-fighting/flicker al moverse la cámara.
        */}
        <mesh position={[0, 0, 0.002]} receiveShadow renderOrder={-19}>
          <planeGeometry args={[1000, 1000]} />
          <shadowMaterial
            transparent
            opacity={catcherOpacity}
            depthWrite={false}
            // Protección extra contra z-fighting con el reflector
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      
    </>
  )
}