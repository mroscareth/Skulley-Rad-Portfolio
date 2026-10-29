import React, { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { EffectComposer } from '@react-three/postprocessing'
import { extendGLTFLoaderKTX2, detectKTX2Support } from '../../lib/ktx2Setup.js'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { applyCharacterColorsToScene, CHARACTER_COLOR_EVENT } from '../../lib/characterColors.js'
import { posterNormalTexture } from '../../lib/toonInkBuffer.js'
import CharacterNormalPass from '../fx/CharacterNormalPass.jsx'
import EdgeInkEffect from '../fx/EdgeInkEffect.jsx'

// El cartel: Skulley a tamaño completo sobre color plano, en teléfonos.
//
// Acá no hay mundo. Ni piso, ni sombra, ni HDRI, ni portales: el personaje
// recortado sobre el fondo, como portada de disco. El molde es
// PreloaderCharacter.jsx — un Canvas ortográfico aislado, iluminado con tres
// luces propias en vez del HDRI (ahorra light-mobile.hdr y su pase de PMREM).
//
// Lo que SÍ se conserva del look: el banding toon, el contraluz de filo y las
// ink lines de crease (DESIGN.md §7.8). Son la firma visual, y acá cuestan lo
// que deben: este canvas renderiza un personaje y nada más, mientras la versión
// de escritorio sostiene pasto, orbes, seis portales y dos RTT de sombra.

// Contraluz toon: frío, duro y de un solo lado, opuesto a la key cálida.
// Recorta la silueta contra el fondo casi negro — que acá es TODO el fondo, así
// que pega más fuerte que en el preloader.
const RIM_LIGHT = {
  rimStrength: 1.9,
  rimColor: [0.22, 0.78, 1.0],
  rimThreshold: 0.54,
  rimWidth: 0.07,
  rimDirection: [-0.75, 0.4, -0.55],
}

// Encuadre. El personaje mide ~1.7 de alto con los pies en y≈0, así que una
// ventana de 2.65 unidades lo deja de cuerpo entero con aire. Va corrido a la
// derecha y alto: el título gigante vive en la columna izquierda y la lista de
// capítulos lo corta por abajo con un borde duro. La asimetría es el encuadre,
// no un descuido. Se mueve la CÁMARA y no el contenedor: un transform en un
// ancestro del <Canvas> de R3F rompe el mapeo de punteros (lo documenta el
// retrato).
// 3.4 unidades de ventana dejan al personaje (1.7 de alto) en ~420 px, que es
// justo lo que hay desde el borde superior hasta el filo del bloque de
// capítulos. Con el centro en 0.10 los pies caen sobre ese filo: la línea
// blanca hace de suelo, que es lo que reemplaza al piso y a la sombra que este
// cartel no tiene.
const VIEW_HEIGHT = 3.5
const FRAME_CENTER_Y = 0.12
// Negativo = la cámara se corre a la izquierda, así que el personaje entra por
// la DERECHA del cuadro: la columna izquierda queda para el título.
const FRAME_SHIFT_X = -0.46

function PosterCamera() {
  const { camera, size } = useThree()
  useEffect(() => {
    camera.position.set(FRAME_SHIFT_X, FRAME_CENTER_Y, 10)
    camera.rotation.set(0, 0, 0)
    camera.zoom = size.height / VIEW_HEIGHT
    // Rango generoso: la ortográfica no tiene perspectiva que perder y así
    // ningún miembro de la pose se recorta por near/far.
    camera.near = -5000
    camera.far = 5000
    camera.updateProjectionMatrix()
  }, [camera, size.height])
  return null
}

function PosterModel({ modelRef }) {
  const { gl } = useThree()
  const groupRef = useRef(null)
  useEffect(() => { detectKTX2Support(gl) }, [gl])

  const { scene, animations } = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true,
    true,
    extendGLTFLoaderKTX2,
  )

  const cloned = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)

    // El GLB está cacheado y compartido: puede traer los outline meshes que
    // inyecta Player.jsx. Acá estorban (BackSide negro) → fuera.
    const toRemove = []
    clone.traverse((obj) => {
      if (!obj) return
      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material
      const esOutline = (obj.name && obj.name.endsWith('_outline'))
        || (mat && mat.side === THREE.BackSide && mat.type === 'MeshBasicMaterial')
      if (esOutline) toRemove.push(obj)
    })
    toRemove.forEach((obj) => {
      try {
        obj.parent?.remove(obj)
        obj.geometry?.dispose?.()
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m?.dispose?.())
        else obj.material?.dispose?.()
      } catch { }
    })

    // Materiales propios (el GLB es compartido) + cel-shading.
    clone.traverse((obj) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      const out = src.map((m) => {
        if (!m?.clone) return m
        const mm = m.clone()
        try {
          mm.envMapIntensity = 0.5
          // Pupilas planas: el GLB las trae con roughness 0 (espejo). El nombre
          // se conserva porque con él se reconocen los ojos.
          if (/pupil/i.test(mm.name || '')) {
            return new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, name: mm.name })
          }
          // Rim solo en cuerpo y pelo: en los ojos dibuja un aro dentro de la
          // cuenca y la bola de energía se lava entera.
          const withRim = /^(head|hair)$/i.test(mm.name || '')
          applyToonBanding(mm, { steps: 2, minBand: 0.04, bandIndirect: true, ...(withRim ? RIM_LIGHT : {}) })
        } catch { }
        return mm
      })
      obj.material = Array.isArray(obj.material) ? out : out[0]
    })
    return clone
  }, [scene])

  const { actions } = useAnimations(animations, groupRef)
  useEffect(() => {
    if (!actions) return
    const names = Object.keys(actions)
    // El GLB solo trae dos clips: 'root|root|Iddle' (con doble d) y
    // 'root|root|Walking'. Acá nunca camina.
    const idleName = names.includes('root|root|Iddle')
      ? 'root|root|Iddle'
      : (names.find((n) => n.toLowerCase().includes('idle')) || names[0])
    const idle = idleName && actions[idleName]
    if (idle) {
      idle.reset().fadeIn(0.5).play()
      idle.timeScale = 1.6
    }
    return () => { try { idle?.fadeOut(0.2) } catch { } }
  }, [actions])

  // Colores del customizer: mismo slot global que el resto del sitio.
  useEffect(() => {
    if (!cloned) return
    const apply = (detail) => { try { applyCharacterColorsToScene(cloned, detail) } catch { } }
    apply()
    const onChange = (e) => apply(e?.detail)
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [cloned])

  // Deriva lentísima. No es una pose congelada: es un plano vivo. El idle ya
  // respira; esto le suma una rotación de cadera y una flotación mínima para
  // que el cartel nunca se lea como una imagen estática.
  useFrame(({ clock }) => {
    const g = groupRef.current
    if (!g) return
    const t = clock.getElapsedTime()
    g.rotation.y = Math.sin(t * 0.12) * 0.15
    g.position.y = Math.sin(t * 0.35) * 0.014
  })

  return (
    <group ref={groupRef}>
      <primitive
        object={cloned}
        ref={(node) => {
          if (modelRef) modelRef.current = node || null
        }}
      />
    </group>
  )
}

export default function MobileCharacterPoster({ className = '', paused = false }) {
  const modelRef = useRef(null)

  return (
    <div
      className={`absolute inset-0 ${className}`}
      // El canvas no recibe punteros: arriba van el título y el menú, y el tap
      // sobre el personaje lo resuelve el shell sobre el contenedor.
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <Canvas
        orthographic
        frameloop={paused ? 'never' : 'always'}
        dpr={[1, 2]}
        gl={{
          antialias: false,
          // alpha + sin <color attach="background">: el color plano lo pinta el
          // DOM, así el fondo del cartel es CSS y no un clear del renderer.
          alpha: true,
          stencil: false,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [FRAME_SHIFT_X, FRAME_CENTER_Y, 10], near: -5000, far: 5000 }}
        style={{ background: 'transparent' }}
      >
        <PosterCamera />

        {/* Tres luces propias en vez del HDRI: la key cálida define el banding,
            la fría de relleno abre las sombras y la ambiental evita el negro
            absoluto en las caras ocultas. */}
        <directionalLight intensity={1.7} position={[3, 4, 3]} color="#fff4e6" />
        <directionalLight intensity={0.38} position={[-4, 1, -2]} color="#9fd0ff" />
        <ambientLight intensity={0.5} />

        <React.Suspense fallback={null}>
          <PosterModel modelRef={modelRef} />
        </React.Suspense>

        {/* Normal-render exclusivo del personaje → lo lee EdgeInk.
            fixedScale: el encuadre es constante (ortográfica fija), así que no
            hay declutter por distancia que calcular. */}
        <CharacterNormalPass
          playerRef={modelRef}
          target={posterNormalTexture}
          fixedScale
        />

        <EffectComposer multisampling={0} resolutionScale={0.9}>
          {/* Ink lines de crease + silueta por borde interno. La silueta va por
              EdgeInk y no por hull invertido: es continua por construcción,
              corre solo sobre la geometría y nunca agranda al personaje. */}
          <EdgeInkEffect
            bufferRef={posterNormalTexture}
            thickness={1.2}
            strength={0.95}
            threshold={0.3}
            soft={0.16}
            silhouette
            silhouetteWidth={2.6}
            silhouetteStrength={1}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
