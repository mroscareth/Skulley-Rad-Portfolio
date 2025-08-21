import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function FollowLight({ playerRef, height = 6, intensity = 2.5, color = '#ffffff', angle = 0.8, penumbra = 0.6 }) {
  const lightRef = useRef()
  const targetRef = useRef()
  const tempPos = useRef(new THREE.Vector3())
  const tempTarget = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    if (!playerRef.current || !lightRef.current || !targetRef.current) return
    const smoothing = 1 - Math.pow(0.001, delta)

    // Desired positions
    tempPos.current.copy(playerRef.current.position)
    tempPos.current.y += height

    tempTarget.current.copy(playerRef.current.position)
    tempTarget.current.y += 1.6

    // Smoothly interpolate light position
    lightRef.current.position.lerp(tempPos.current, smoothing)

    // Update target to follow the player's head
    targetRef.current.position.lerp(tempTarget.current, smoothing)
    lightRef.current.target = targetRef.current
    lightRef.current.target.updateMatrixWorld()
  })

  return (
    <>
      <spotLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        angle={angle}
        penumbra={penumbra}
        distance={50}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00008}
        shadow-radius={4}
      />
      <object3D ref={targetRef} />
    </>
  )
}


