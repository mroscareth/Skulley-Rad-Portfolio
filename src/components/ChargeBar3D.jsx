import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Barra de carga del poder (billboard 3D sobre la cabeza del personaje).
// Patrón calcado de SpeechBubble3D: mesh puro + useFrame que hace billboard
// (basis de cámara) y suaviza el anchor para no vibrar con el walk cycle.
// Sin useState: toda mutación es vía refs → cero re-renders por frame.

const BAR_W = 1.1
const BAR_H = 0.12
const PAD = 0.012 // margen entre el track y el fill
const INNER_W = BAR_W - PAD * 2
const INNER_H = BAR_H - PAD * 2

const COLOR_NORMAL = '#f5ff00'
const COLOR_FULL = '#fff9d6' // más caliente/blanco al llegar a full

export default function ChargeBar3D({ anchorRef, chargeRef }) {
  const { camera } = useThree()
  const groupRef = useRef(null)
  const fillGroupRef = useRef(null)
  const fillMatRef = useRef(null)
  const wasFullRef = useRef(false)

  const tmp = useMemo(() => ({
    p: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    fwd: new THREE.Vector3(),
    zAxis: new THREE.Vector3(),
    basisMat: new THREE.Matrix4(),
    smoothAnchorPos: new THREE.Vector3(),
    smoothCamFwd: new THREE.Vector3(0, 0, -1),
  }), [])

  // Geometría del fill con el pivote en el borde IZQUIERDO (x: 0..1 en vez de
  // -0.5..0.5) para poder crecer con scale.x sin recalcular posición cada frame.
  const fillGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.translate(0.5, 0, 0)
    return g
  }, [])
  useEffect(() => () => { try { fillGeo.dispose() } catch { } }, [fillGeo])

  useFrame(() => {
    const g = groupRef.current
    const a = anchorRef?.current
    const charge = chargeRef?.current || 0
    if (!g) return

    const visible = charge > 0.01
    g.visible = visible
    if (!visible || !a) return

    try {
      a.getWorldPosition(tmp.p)
      camera.getWorldDirection(tmp.fwd)

      // Seguimiento RÍGIDO (sin lerp): el anchor vive en el ROOT del player
      // (no en huesos), así que no hay vaivén de walk cycle que amortiguar y
      // cualquier suavizado se lee como la barra "persiguiendo" al personaje.
      tmp.smoothAnchorPos.copy(tmp.p)
      tmp.smoothCamFwd.copy(tmp.fwd).normalize()

      tmp.right.crossVectors(tmp.smoothCamFwd, camera.up).normalize()
      tmp.up.copy(camera.up).normalize()

      g.position.copy(tmp.smoothAnchorPos)
      tmp.zAxis.copy(tmp.smoothCamFwd).negate().normalize()
      tmp.up.crossVectors(tmp.zAxis, tmp.right).normalize()
      tmp.basisMat.makeBasis(tmp.right, tmp.up, tmp.zAxis)
      g.quaternion.setFromRotationMatrix(tmp.basisMat)

      const d = camera.position.distanceTo(tmp.smoothAnchorPos)
      const scale = THREE.MathUtils.clamp(d * 0.048, 0.5, 1.12)
      g.scale.setScalar(scale)

      // Fill: crece desde el borde izquierdo (grupo con geometría left-pivot).
      const c = THREE.MathUtils.clamp(charge, 0, 1)
      if (fillGroupRef.current) fillGroupRef.current.scale.x = Math.max(0.0001, c * INNER_W)

      const isFull = c >= 0.98
      if (isFull !== wasFullRef.current) {
        wasFullRef.current = isFull
        if (fillMatRef.current) fillMatRef.current.color.set(isFull ? COLOR_FULL : COLOR_NORMAL)
      }
    } catch { }
  })

  const noRaycast = () => null

  return (
    <group ref={groupRef} visible={false} raycast={noRaycast}>
      {/* Track (fondo oscuro semitransparente) */}
      <mesh renderOrder={9998} raycast={noRaycast}>
        <planeGeometry args={[BAR_W, BAR_H]} />
        <meshBasicMaterial
          color="#000000"
          opacity={0.5}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Fill (amarillo del botón ⚡, blanco cálido al llegar a full) */}
      <group ref={fillGroupRef} position={[-BAR_W / 2 + PAD, 0, 0.001]}>
        <mesh geometry={fillGeo} scale={[1, INNER_H, 1]} renderOrder={9998} raycast={noRaycast}>
          <meshBasicMaterial
            ref={fillMatRef}
            color={COLOR_NORMAL}
            transparent
            opacity={0.95}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}
