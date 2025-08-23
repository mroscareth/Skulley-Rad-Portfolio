import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'

export default function FollowLight({ playerRef, height = 6, intensity = 2.5, color = '#ffffff', angle = 0.8, penumbra = 0.6, relativeToBounds = false, relativeFactor = 0.4, showGizmo = false, gizmoColor = '#00ffff', follow = true, targetFollows = true, gizmoLayer = 31 }) {
  const lightRef = useRef()
  const targetRef = useRef()
  const tempPos = useRef(new THREE.Vector3())
  const tempTarget = useRef(new THREE.Vector3())
  const bboxRef = useRef(new THREE.Box3())
  const sizeRef = useRef(new THREE.Vector3())
  const gizmoRef = useRef()
  const lineRef = useRef()
  const draggingRef = useRef(false)
  const initedRef = useRef(false)
  const groupRef = useRef()
  const { camera } = useThree()

  // Inicializar posición de luz/gizmo respecto al personaje al montar o cuando aparezca el player
  React.useEffect(() => {
    if (!showGizmo) return
    if (!playerRef?.current || !lightRef.current) return
    if (initedRef.current) return
    try {
      const base = playerRef.current.position.clone()
      let yOff = height
      if (relativeToBounds) {
        bboxRef.current.setFromObject(playerRef.current)
        bboxRef.current.getSize(sizeRef.current)
        const h = Math.max(0.1, sizeRef.current.y)
        yOff = h * (1 + Math.max(0, relativeFactor))
      }
      base.y += yOff
      lightRef.current.position.copy(base)
      if (gizmoRef.current) gizmoRef.current.position.copy(base)
      initedRef.current = true
    } catch {}
  }, [showGizmo, playerRef, height, relativeToBounds, relativeFactor])

  // Asegurar que la cámara pueda ver y raycastear el layer del gizmo
  React.useEffect(() => {
    if (!showGizmo || !camera) return
    try { camera.layers.enable(gizmoLayer) } catch {}
  }, [showGizmo, camera, gizmoLayer])

  useFrame((_, delta) => {
    if (!playerRef.current || !lightRef.current || !targetRef.current) return
    const smoothing = 1 - Math.pow(0.001, delta)

    // Desired positions
    if (follow) {
      tempPos.current.copy(playerRef.current.position)
      if (relativeToBounds) {
        // Medir altura aproximada del personaje y colocar la luz al 140% de su altura (40% por encima de la cabeza)
        try {
          bboxRef.current.setFromObject(playerRef.current)
          bboxRef.current.getSize(sizeRef.current)
          const h = Math.max(0.1, sizeRef.current.y)
          tempPos.current.y += h * (1 + Math.max(0, relativeFactor))
        } catch {
          tempPos.current.y += height
        }
      } else {
        tempPos.current.y = (playerRef.current.position.y || 0) + height
      }
    }

    if (targetFollows) {
      tempTarget.current.copy(playerRef.current.position)
      tempTarget.current.y += 1.6
    }

    // Decide desired light position (follow or gizmo override when dragging)
    if (showGizmo) {
      try {
        if (!draggingRef.current) {
          // when not dragging, keep gizmo synced to desired position
          if (gizmoRef.current && follow) gizmoRef.current.position.lerp(tempPos.current, smoothing)
        }
        const src = (gizmoRef.current && draggingRef.current) ? gizmoRef.current.position : (follow ? tempPos.current : gizmoRef.current?.position || lightRef.current.position)
        lightRef.current.position.lerp(src, smoothing)
      } catch {
        lightRef.current.position.lerp(tempPos.current, smoothing)
      }
    } else {
      if (follow) lightRef.current.position.lerp(tempPos.current, smoothing)
    }

    // Update target to follow the player's head (optional)
    if (targetFollows) {
      targetRef.current.position.lerp(tempTarget.current, smoothing)
      lightRef.current.target = targetRef.current
      lightRef.current.target.updateMatrixWorld()
    }

    // Gizmo helpers
    if (showGizmo) {
      try {
        if (gizmoRef.current) {
          gizmoRef.current.position.copy(lightRef.current.position)
        }
        if (lineRef.current) {
          const geo = lineRef.current.geometry
          const posArr = new Float32Array([
            lightRef.current.position.x, lightRef.current.position.y, lightRef.current.position.z,
            targetRef.current.position.x, targetRef.current.position.y, targetRef.current.position.z,
          ])
          if (!geo.getAttribute('position')) {
            geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
          } else {
            const attr = geo.getAttribute('position')
            attr.array.set(posArr)
            attr.needsUpdate = true
          }
        }
      } catch {}
    }

    // Exponer posición/target para copiar desde UI
    try {
      // eslint-disable-next-line no-underscore-dangle
      window.__preLightPos = [lightRef.current.position.x, lightRef.current.position.y, lightRef.current.position.z]
      // eslint-disable-next-line no-underscore-dangle
      window.__preLightTarget = [targetRef.current.position.x, targetRef.current.position.y, targetRef.current.position.z]
    } catch {}
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
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00006}
        shadow-normalBias={0.02}
        shadow-radius={8}
      />
      <object3D ref={targetRef} />
      {showGizmo && (
        <>
          <TransformControls
            mode="translate"
            onMouseDown={() => { draggingRef.current = true }}
            onMouseUp={() => { draggingRef.current = false }}
          >
            <group ref={groupRef}>
              {/* Invisible hit helper bigger than the visible gizmo */}
              <mesh layers={gizmoLayer}>
                <sphereGeometry args={[0.3, 12, 12]} />
                <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
              </mesh>
              <mesh ref={gizmoRef} layers={gizmoLayer}>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshBasicMaterial color={gizmoColor} wireframe />
              </mesh>
            </group>
          </TransformControls>
          <line ref={lineRef}>
            <bufferGeometry />
            <lineBasicMaterial color={gizmoColor} />
          </line>
        </>
      )}
    </>
  )
}


