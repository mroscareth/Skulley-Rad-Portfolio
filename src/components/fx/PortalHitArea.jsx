import React, { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

// Zona clicable de un portal en el mundo 3D. Hace lo mismo que su botón en la
// main nav: el hover arma el cristal (mismo CustomEvent `portal-hover` que
// DesktopNav) y el click dispara el viaje en orbe hasta el portal y la entrada
// a la sección (handleMenuSectionSelect en App).
//
// Es un disco plano sobre el anillo: el portal vive en el piso y desde la
// cámara de juego se ve como una elipse, así que el área de golpe tiene que
// ser esa misma elipse. No pinta nada (colorWrite off) pero sí se raycastea.
const HIT_RADIUS = 2.4
// Más de esto entre pointerdown y pointerup ya es un arrastre (cámara, orbe),
// no un click.
const CLICK_MAX_DELTA = 6

const emitPortalHover = (id) => {
  try { window.dispatchEvent(new CustomEvent('portal-hover', { detail: { id } })) } catch { }
}

export default function PortalHitArea({ sectionId, enabled, onSelect, playSfx }) {
  const { gl } = useThree()
  const hoveredRef = useRef(false)

  const clearHover = () => {
    if (!hoveredRef.current) return
    hoveredRef.current = false
    emitPortalHover(null)
    try { gl.domElement.style.cursor = '' } catch { }
  }

  // Si el portal deja de estar disponible con el cursor encima (empieza un
  // viaje, se abre una sección), el cristal y la manita no se quedan colgados.
  useEffect(() => {
    if (!enabled) clearHover()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
  useEffect(() => () => clearHover(), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Solo si el portal es lo PRIMERO bajo el cursor: un orbe parado encima del
  // anillo conserva su propio click/arrastre.
  const isFrontHit = (e) => e.intersections?.[0]?.eventObject === e.eventObject

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
      onPointerOver={(e) => {
        if (!enabled || !isFrontHit(e)) return
        e.stopPropagation()
        if (hoveredRef.current) return
        hoveredRef.current = true
        emitPortalHover(sectionId)
        try { gl.domElement.style.cursor = 'pointer' } catch { }
        try { playSfx?.('hover', { volume: 0.9 }) } catch { }
      }}
      onPointerOut={clearHover}
      onClick={(e) => {
        if (!enabled || !isFrontHit(e) || (e.delta ?? 0) > CLICK_MAX_DELTA) return
        e.stopPropagation()
        clearHover()
        try { playSfx?.('click', { volume: 1.0 }) } catch { }
        onSelect?.(sectionId)
      }}
    >
      <circleGeometry args={[HIT_RADIUS, 40]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} transparent opacity={0} />
    </mesh>
  )
}
