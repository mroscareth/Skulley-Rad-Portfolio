import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { extendGLTFLoaderKTX2, detectKTX2Support } from '../lib/ktx2Setup.js'
import { applyCharacterColorsToScene, CHARACTER_COLOR_EVENT } from '../lib/characterColors.js'
import { applyToonBanding } from '../lib/toonBanding.js'
import CameraAim from './fx/CharacterCursorAim.jsx'

// Skulley de fondo en el preloader: encuadre de CABEZA Y BUSTO, en idle.
//
// Por qué acá y no en el canvas de HomeScene: ese canvas trae orbes, física y
// timers de gameplay. Ya nos costó una vez (los orbes derivaban solos durante
// el preloader y el corrupto se consumía). Este es un Canvas PROPIO y aislado
// — solo el modelo, su idle y dos luces. Nada que se pueda gastar.
//
// Efecto secundario deseado: el GLB ya está descargado y parseado justo en
// este momento (el preloader existe para esperarlo), así que mostrarlo no
// cuesta carga extra y de paso compila sus shaders antes del ENTER.

function IdleCamera() {
  const { camera } = useThree()
  useEffect(() => {
    // Encuadre CERRADO de cabeza y busto. El zoom del retrato chico (160) es
    // para un canvas de ~190px; acá el canvas mide varios cientos, así que
    // hay que escalarlo en proporción o sale de cuerpo entero.
    // La Y sube al pecho para que el corte quede bajo los hombros.
    // Calibrado midiendo sobre la propia pantalla: con la cabeza en world
    // y≈1.05 y el pecho en y≈0.3, para dejar la cabeza al ~35% desde arriba y
    // el busto llenando hacia abajo hace falta una ventana de ~1.5 unidades
    // de alto → zoom = altoDelCanvas / 1.5, centrada en y≈0.85.
    // La X corre al personaje hacia la IZQUIERDA en pantalla (la cámara se
    // mueve a la derecha, así que el modelo entra más en cuadro). Se hace
    // acá y no con un transform en el contenedor: mover el div despegaría el
    // canvas del borde derecho y el personaje quedaría cortado con una arista
    // dura. Moviendo la cámara, el encuadre se recorre pero el canvas sigue
    // sangrando por el borde.
    // X negativa: el contenedor se ensanchó (46% → 72%) para que la rampa de
    // la máscara caiga sobre lienzo vacío. Al ensancharlo, su centro se corrió
    // a la izquierda y el personaje se iba con él; esto lo regresa a su sitio.
    camera.position.set(-0.11, 0.85, 10)
    camera.rotation.set(0, 0, 0)
    camera.zoom = 700
    camera.near = -5000
    camera.far = 5000
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

// Render manual de respaldo.
//
// R3F deja de llamar a `gl.render()` automáticamente en cuanto ALGÚN
// useFrame del canvas se registra con priority > 0 — el root entra en "manual
// render mode" y espera que alguien dibuje. `CameraAim` usa priority 1 (corre
// después del mixer de animaciones), así que al montarlo este canvas dejaba
// de pintar por completo: personaje invisible, cero excepciones, consola
// limpia. En CharacterPortrait no pasa porque su <EffectComposer> ya dibuja
// por su cuenta a priority 1; acá no hay composer a propósito, para no
// arrastrar @react-three/postprocessing al chunk del arranque.
//
// Esto es ese mismo relevo, en tres líneas.
function ManualRenderKeepAlive() {
  useFrame((state) => { state.gl.render(state.scene, state.camera) }, 1)
  return null
}

function Model() {
  const { gl } = useThree()
  const groupRef = useRef(null)
  useEffect(() => { detectKTX2Support(gl) }, [gl])

  const { scene, animations } = useGLTF(
    `${import.meta.env.BASE_URL}character.glb`,
    true,
    true,
    extendGLTFLoaderKTX2,
  )

  // Clon con esqueleto propio para no pelearse con el Player ni el retrato.
  const cloned = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    // El GLB cacheado puede traer los outline meshes que inyecta Player.jsx.
    // Acá estorban (son BackSide negro) → fuera.
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

    // Materiales propios + banding toon: DESIGN.md §7.8 regla 5 — cualquier
    // render nuevo del personaje conserva el cel-shading.
    clone.traverse((obj) => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return
      const src = Array.isArray(obj.material) ? obj.material : [obj.material]
      const out = src.map((m) => {
        if (!m?.clone) return m
        const mm = m.clone()
        try {
          mm.envMapIntensity = 0.5
          // Pupilas planas (roughness 0 del GLB = espejo). Mismo trato que en
          // Player y el retrato.
          if (/pupil/i.test(mm.name || '')) {
            return new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })
          }
          applyToonBanding(mm, { steps: 2, minBand: 0.04, bandIndirect: true })
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
    // Mismo clip explícito que usa el retrato; si no está, heurística.
    const idleName = names.includes('root|root|Iddle')
      ? 'root|root|Iddle'
      : (names.find((n) => n.toLowerCase().includes('idle')) || names[0])
    const idle = idleName && actions[idleName]
    if (idle) idle.reset().fadeIn(0.4).play()
    return () => { try { idle?.fadeOut(0.2) } catch { } }
  }, [actions])

  // Colores del customizer (mismo slot global que el resto del sitio).
  useEffect(() => {
    if (!cloned) return
    const apply = (detail) => { try { applyCharacterColorsToScene(cloned, detail) } catch { } }
    apply()
    const onChange = (e) => apply(e?.detail)
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [cloned])

  // Deriva lentísima: no es una pose congelada, es un plano vivo.
  useFrame(({ clock }) => {
    const g = groupRef.current
    if (!g) return
    const t = clock.getElapsedTime()
    g.rotation.y = Math.sin(t * 0.12) * 0.13
    g.position.y = -1.45 + Math.sin(t * 0.35) * 0.012
  })

  // Seguimiento de cursor SOLO en desktop: con puntero grueso no hay cursor
  // que seguir y el head-tracking se sentiría errático al hacer scroll.
  const finePointer = useMemo(() => {
    try { return window.matchMedia('(pointer: fine)').matches } catch { return false }
  }, [])

  return (
    <group ref={groupRef} position={[0, -1.45, 0]}>
      <primitive object={cloned} scale={1.65} />
      {/* SEGUIMIENTO DE CURSOR: DESACTIVADO. No borrar sin leer esto.
          Montar <CameraAim modelRef={groupRef} /> acá deja al personaje fuera
          de cuadro: medido con Box3, el modelo pasa a ocupar y ∈ [-1.46, 0.20]
          mientras la ventana de esta cámara (y 0.85, zoom 700) cubre
          y ∈ [0.06, 1.64] — o sea que queda por debajo del encuadre. No lanza
          ninguna excepción, así que no es un error de referencia; algo en el
          componente reposiciona/reescala el subárbol en este contexto de
          ortográfica muy cerrada. En el retrato funciona bien.
          Pendiente de investigar con calma antes de reactivar. */}
      {finePointer && (
        <>
          <CameraAim modelRef={groupRef} />
          {/* Obligatorio junto a CameraAim — ver la nota del componente. */}
          <ManualRenderKeepAlive />
        </>
      )}
      {/* Key cálida lateral + relleno frío tenue: el corte toon necesita una
          dirección dominante, si no el banding se aplana. */}
      <directionalLight intensity={1.6} position={[3, 4, 3]} color="#fff4e6" />
      <directionalLight intensity={0.35} position={[-4, 1, -2]} color="#9fd0ff" />
      <ambientLight intensity={0.5} />
    </group>
  )
}

export default function PreloaderCharacter({ className = '' }) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden>
      <Canvas
        orthographic
        dpr={[1, 1.25]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false }}
        events={undefined}
        style={{ width: '100%', height: '100%' }}
      >
        <IdleCamera />
        <React.Suspense fallback={null}>
          <Model />
        </React.Suspense>
      </Canvas>
    </div>
  )
}
