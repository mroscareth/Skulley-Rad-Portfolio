import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

function SyncOrthoCameraFixed() {
  const { camera, size } = useThree()
  useFrame(() => {
    camera.position.set(0, 0.8, 10)
    camera.rotation.set(0, 0, 0)
    if (typeof camera.zoom === 'number') camera.zoom = 160
    camera.updateProjectionMatrix()
  })
  useEffect(() => {
    // ensure stable projection
    camera.near = -5000
    camera.far = 5000
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

function CharacterModel({ modelRef }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}character.glb`, true)
  const cloned = React.useMemo(() => scene.clone(true), [scene])
  return (
    <group position={[0, -1.45, 0]}>
      <primitive ref={modelRef} object={cloned} scale={1.65} />
      <directionalLight intensity={0.7} position={[2, 3, 3]} />
      <ambientLight intensity={0.8} />
    </group>
  )
}

export default function CharacterPortraitHero({ className = '', animateIn = true, durationMs = 380 }) {
  const modelRef = useRef()
  const rootRef = useRef(null)
  useEffect(() => {
    if (!animateIn) return
    const el = rootRef.current
    if (!el) return
    try {
      el.animate([
        { transform: 'translateY(40px) scale(0.88)', opacity: 0 },
        { transform: 'translateY(0px) scale(1)', opacity: 1 },
      ], { duration: durationMs, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' })
    } catch {}
  }, [animateIn, durationMs])
  return (
    <div ref={rootRef} className={`relative mx-auto max-w-[min(880px,92vw)] ${className}`} style={{ aspectRatio: '1/1', transform: 'translateZ(0)' }}>
      <div className="absolute inset-0 rounded-full border-[6px] border-white shadow-xl" aria-hidden />
      <Canvas
        orthographic
        dpr={[1, 1.25]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true, stencil: false }}
        events={undefined}
      >
        <SyncOrthoCameraFixed />
        <CharacterModel modelRef={modelRef} />
      </Canvas>
    </div>
  )
}

useGLTF.preload(`${import.meta.env.BASE_URL}character.glb`)


