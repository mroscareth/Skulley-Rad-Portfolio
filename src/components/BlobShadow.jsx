import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Cheap abstract blob shadow under the player. Avoids shadow maps / ContactShadows
// RTT (which tank performance). Uses a radial-gradient canvas texture + a plane
// that follows the player XZ position each frame via ref mutation (no re-renders).
export default function BlobShadow({
  playerRef,
  enabled = true,
  size = 0.5,
  opacity = 1,
  // Fine control of dark center intensity (0..1)
  innerAlpha = 0.9,
  midAlpha = 0.3,
}) {
  const tex = useMemo(() => {
    try {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 256
      const ctx = c.getContext('2d')
      if (!ctx) return null
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
      // Higher contrast so it's visible even with halftone/post effects
      g.addColorStop(0.0, `rgba(0,0,0,${Math.max(0, Math.min(1, innerAlpha))})`)
      g.addColorStop(0.45, `rgba(0,0,0,${Math.max(0, Math.min(1, midAlpha))})`)
      g.addColorStop(1.0, 'rgba(0,0,0,0)')
      ctx.clearRect(0, 0, 256, 256)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 256, 256)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.needsUpdate = true
      return t
    } catch {
      return null
    }
  }, [innerAlpha, midAlpha])
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!enabled) return
    if (!ref.current || !playerRef?.current) return
    try {
      playerRef.current.getWorldPosition(tmp)
      // Slightly above ground to avoid z-fighting
      ref.current.position.set(tmp.x, 0.02, tmp.z)
    } catch { }
  })
  useEffect(() => () => { try { tex?.dispose?.() } catch { } }, [tex])
  if (!enabled || !tex) return null
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      // Always visible (abstract shadow)
      renderOrder={50}
      frustumCulled={false}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-2}
      />
    </mesh>
  )
}
