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
  // Edge sharpness. 0 = soft radial gradient (legacy look),
  // 1 = flat solid disc with a crisp cel-shaded edge.
  hardness = 0.85,
}) {
  const tex = useMemo(() => {
    try {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 256
      const ctx = c.getContext('2d')
      if (!ctx) return null
      const inner = Math.max(0, Math.min(1, innerAlpha))
      const mid = Math.max(0, Math.min(1, midAlpha))
      const h = Math.max(0, Math.min(1, hardness))
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
      if (h <= 0.001) {
        // Legacy soft gradient
        g.addColorStop(0.0, `rgba(0,0,0,${inner})`)
        g.addColorStop(0.45, `rgba(0,0,0,${mid})`)
        g.addColorStop(1.0, 'rgba(0,0,0,0)')
      } else {
        // Solid flat disc: full alpha out to `edge`, then a thin AA band to 0.
        // Higher hardness pushes the solid radius outward and tightens the band.
        const edge = Math.min(0.5 + h * 0.45, 0.97)
        const aa = Math.max(0.005, 0.06 * (1 - h)) // antialias band (avoids jaggies)
        g.addColorStop(0.0, `rgba(0,0,0,${inner})`)
        g.addColorStop(edge, `rgba(0,0,0,${inner})`)
        g.addColorStop(Math.min(edge + aa, 1.0), 'rgba(0,0,0,0)')
      }
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
  }, [innerAlpha, midAlpha, hardness])
  const ref = useRef()
  const matRef = useRef()
  const tmp = useMemo(() => new THREE.Vector3(), [])
  // Movement state: last XZ position + smoothed horizontal speed, used to
  // squash/stretch and react to the player lifting off the ground.
  const last = useRef({ x: 0, z: 0, baseY: 0, init: false })
  const speedRef = useRef(0)
  useFrame((_, delta) => {
    if (!enabled) return
    if (!ref.current || !playerRef?.current) return
    try {
      playerRef.current.getWorldPosition(tmp)
      ref.current.position.set(tmp.x, 0.02, tmp.z)

      // Horizontal speed (units/sec), smoothed to avoid jitter.
      const dt = Math.max(delta, 1 / 120)
      if (!last.current.init) {
        last.current.x = tmp.x; last.current.z = tmp.z
        last.current.baseY = tmp.y // resting height = no lift
        last.current.init = true
      }
      const dx = tmp.x - last.current.x
      const dz = tmp.z - last.current.z
      last.current.x = tmp.x; last.current.z = tmp.z
      const inst = Math.hypot(dx, dz) / dt
      speedRef.current = THREE.MathUtils.lerp(speedRef.current, inst, 0.15)

      // Height above resting position. When the player jumps/floats the shadow
      // shrinks and fades, like a real ground projection.
      const lift = THREE.MathUtils.clamp((tmp.y - last.current.baseY) / 2.2, 0, 1)
      const liftScale = 1 - lift * 0.55
      const liftAlpha = 1 - lift * 0.7

      // Subtle squash with speed (max ~12% bigger footprint while moving).
      const move = THREE.MathUtils.clamp(speedRef.current / 6, 0, 1)
      const grow = 1 + move * 0.12

      const s = liftScale * grow
      ref.current.scale.set(s, s, 1)
      if (matRef.current) matRef.current.opacity = opacity * liftAlpha
    } catch { }
  })
  useEffect(() => () => { try { tex?.dispose?.() } catch { } }, [tex])
  if (!enabled || !tex) return null
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={-18}
      frustumCulled={false}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        ref={matRef}
        map={tex}
        transparent
        opacity={opacity}
        depthWrite={false}
        // depthTest ON so the character's body occludes the shadow instead of
        // the disc painting over the legs/feet.
        depthTest
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-2}
      />
    </mesh>
  )
}
