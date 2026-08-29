import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Retícula de puntería de la PATADA, dibujada en el piso.
//
// No es decoración: muestra el ÁREA REAL de golpe. El sector abarca el mismo
// cono frontal que usa `kickImpulse` y su radio crece con la carga igual que
// el alcance, así que lo que ves es exactamente lo que vas a poder patear.
// Aparece solo mientras cargas (el personaje está clavado apuntando).
//
// `chargeRef` y `aimRef` se leen por ref en el useFrame: cero re-renders.

// FUENTE DE VERDAD del área de golpe: estas constantes las importa Player
// para la física, así que lo que ves dibujado es exactamente lo que pega.
// Si se cambia el abanico, cambian los dos a la vez.
export const KICK_HALF_ANGLE = THREE.MathUtils.degToRad(75)
const HALF_ANGLE = KICK_HALF_ANGLE
// Agujero interior: solo estético (no tapar al personaje). Se deja chico para
// que casi no haya diferencia entre lo dibujado y lo que la física acepta.
const R_MIN = 0.28
const COLOR = '#22d3ee'
const COLOR_FULL = '#d8fbff'

export default function KickAimIndicator({ anchorRef, chargeRef, yawRef, reachRef }) {
  const groupRef = useRef(null)
  const sectorRef = useRef(null)
  const sectorMatRef = useRef(null)
  const arrowRef = useRef(null)
  const arrowMatRef = useRef(null)
  const tmp = useMemo(() => ({ p: new THREE.Vector3() }), [])

  // Sector anular con el vértice en el personaje. thetaStart lo dejamos
  // centrado en +Z para que baste rotar el group con el yaw del personaje.
  const sectorGeo = useMemo(() => {
    const g = new THREE.RingGeometry(R_MIN, 1, 48, 1, Math.PI / 2 - HALF_ANGLE, HALF_ANGLE * 2)
    // El ring nace en XY. Al tumbarlo con rotateX(-90°), su +Y local acaba
    // en -Z (hacia ATRÁS del personaje): por eso el rotateY(180°), que lo
    // deja mirando a +Z, que es el frente real del rig.
    g.rotateX(-Math.PI / 2)
    g.rotateY(Math.PI)
    return g
  }, [])
  const arrowGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0.42)
    shape.lineTo(-0.16, 0.1)
    shape.lineTo(-0.06, 0.1)
    shape.lineTo(-0.06, -0.3)
    shape.lineTo(0.06, -0.3)
    shape.lineTo(0.06, 0.1)
    shape.lineTo(0.16, 0.1)
    shape.closePath()
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    g.rotateY(Math.PI) // mismo motivo que el sector: apuntar al frente (+Z)
    return g
  }, [])
  React.useEffect(() => () => {
    try { sectorGeo.dispose(); arrowGeo.dispose() } catch { }
  }, [sectorGeo, arrowGeo])

  useFrame((state) => {
    const g = groupRef.current
    if (!g) return
    const charge = chargeRef?.current || 0
    const visible = charge > 0.01
    if (g.visible !== visible) g.visible = visible
    if (!visible) return

    const anchor = anchorRef?.current
    if (anchor) {
      anchor.getWorldPosition(tmp.p)
      // Pegado al piso, no a los pies: un pelo arriba para no hacer z-fight
      // con el suelo ni con la sombra de silueta.
      g.position.set(tmp.p.x, 0.03, tmp.p.z)
    }
    if (yawRef && typeof yawRef.current === 'number') g.rotation.y = yawRef.current

    // El radio sigue al alcance real de la patada con la carga actual.
    const reach = (reachRef && reachRef.current) || 1.6
    const s = sectorRef.current
    if (s) s.scale.set(reach, 1, reach)

    // Pulso de intensidad: sube con la carga y late al llegar a tope.
    const full = charge > 0.995
    const pulse = full ? 0.3 + 0.12 * Math.sin(state.clock.elapsedTime * 14) : 0.1 + 0.18 * charge
    if (sectorMatRef.current) {
      sectorMatRef.current.opacity = pulse
      sectorMatRef.current.color.set(full ? COLOR_FULL : COLOR)
    }
    if (arrowMatRef.current) {
      arrowMatRef.current.opacity = Math.min(0.85, 0.3 + 0.5 * charge)
      arrowMatRef.current.color.set(full ? COLOR_FULL : COLOR)
    }
    // La flecha se estira hacia el frente conforme cargas.
    const a = arrowRef.current
    if (a) {
      a.position.z = R_MIN + (reach - R_MIN) * 0.62
      const k = 0.75 + 0.5 * charge
      a.scale.set(k, 1, k)
    }
  })

  return (
    <group ref={groupRef} visible={false} renderOrder={-14}>
      <mesh ref={sectorRef} geometry={sectorGeo} frustumCulled={false}>
        <meshBasicMaterial
          ref={sectorMatRef}
          color={COLOR}
          transparent
          opacity={0.25}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={arrowRef} geometry={arrowGeo} frustumCulled={false}>
        <meshBasicMaterial
          ref={arrowMatRef}
          color={COLOR}
          transparent
          opacity={0.6}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
