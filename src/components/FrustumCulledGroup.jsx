import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function FrustumCulledGroup({ position = [0, 0, 0], radius = 5, maxDistance = 80, sampleEvery = 3, children }) {
  const groupRef = useRef()
  const { camera } = useThree()
  const frustum = useMemo(() => new THREE.Frustum(), [])
  const projScreenMatrix = useMemo(() => new THREE.Matrix4(), [])
  const sphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(), radius), [radius])
  const tmp = useRef({ frame: 0, worldPos: new THREE.Vector3() })

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(position[0] || 0, position[1] || 0, position[2] || 0)
    }
  }, [position])

  useFrame(() => {
    if (!groupRef.current || !camera) return
    const t = tmp.current
    t.frame = (t.frame + 1) % Math.max(1, sampleEvery)
    if (t.frame !== 0) return
    // Distance cull first (fast path)
    const worldPos = groupRef.current.getWorldPosition(t.worldPos)
    const dist = camera.position.distanceTo(worldPos)
    if (dist > maxDistance) {
      groupRef.current.visible = false
      return
    }
    // Frustum test
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(projScreenMatrix)
    sphere.center.copy(worldPos)
    sphere.radius = radius
    groupRef.current.visible = frustum.intersectsSphere(sphere)
  })

  return <group ref={groupRef}>{children}</group>
}


