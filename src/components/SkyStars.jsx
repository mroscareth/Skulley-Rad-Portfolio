import React, { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * SkyStars
 * Very low-cost star field:
 * - Static sky: no camera tracking or animations.
 * - Three fixed Points layers with very low density.
 */
export default function SkyStars({ radius = 90, counts = [40, 20, 8], sizes = [0.9, 1.2, 1.6], baseOpacities = [0.12, 0.1, 0.08] }) {
  const groupRef = useRef()
  const { camera } = useThree()

  const circleTex = useMemo(() => {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grd.addColorStop(0.0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.5, 'rgba(255,255,255,0.7)')
    grd.addColorStop(1.0, 'rgba(255,255,255,0)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    return tex
  }, [])

  const palettes = useMemo(() => {
    // Small magical variations (cool/pastel tones)
    const cols = ['#ffffff', '#cfe7ff', '#ffe9ff', '#eaffff', '#fff7cf']
    return cols.map((c) => new THREE.Color(c))
  }, [])

  const layers = useMemo(() => {
    const rngOnSphere = () => {
      const u = Math.random() * 2 - 1
      const phi = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      return new THREE.Vector3(s * Math.cos(phi), u, s * Math.sin(phi))
    }
    const makeLayer = (count) => {
      const positions = new Float32Array(count * 3)
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const dir = rngOnSphere().multiplyScalar(radius)
        positions[i * 3 + 0] = dir.x
        positions[i * 3 + 1] = Math.max(dir.y, 8) // avoid stars below horizon
        positions[i * 3 + 2] = dir.z
        const col = palettes[(i + (Math.random() * palettes.length) | 0) % palettes.length].clone()
        const glow = 0.9 + Math.random() * 0.1
        col.multiplyScalar(glow)
        colors[i * 3 + 0] = col.r
        colors[i * 3 + 1] = col.g
        colors[i * 3 + 2] = col.b
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      return geo
    }
    return counts.map((c) => makeLayer(c))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, radius])

  const materialsRef = useRef([
    new THREE.PointsMaterial({ size: sizes[0], sizeAttenuation: true, vertexColors: true, transparent: true, opacity: baseOpacities[0], depthWrite: false, depthTest: false, map: circleTex, alphaMap: circleTex, fog: false, blending: THREE.NormalBlending }),
    new THREE.PointsMaterial({ size: sizes[1], sizeAttenuation: true, vertexColors: true, transparent: true, opacity: baseOpacities[1], depthWrite: false, depthTest: false, map: circleTex, alphaMap: circleTex, fog: false, blending: THREE.NormalBlending }),
    new THREE.PointsMaterial({ size: sizes[2], sizeAttenuation: true, vertexColors: true, transparent: true, opacity: baseOpacities[2], depthWrite: false, depthTest: false, map: circleTex, alphaMap: circleTex, fog: false, blending: THREE.NormalBlending }),
  ])

  // Lock to camera to avoid parallax and a drifting-particles look
  useFrame(() => {
    if (!groupRef.current || !camera) return
    groupRef.current.position.copy(camera.position)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  return (
    <group ref={groupRef} renderOrder={-10}>
      <points frustumCulled={false} geometry={layers[0]} material={materialsRef.current[0]} />
      <points frustumCulled={false} geometry={layers[1]} material={materialsRef.current[1]} />
      <points frustumCulled={false} geometry={layers[2]} material={materialsRef.current[2]} />
    </group>
  )
}


