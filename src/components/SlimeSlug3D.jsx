import React, { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { collectSlug, hasSlug, SLIME_SLUGS_EVENT } from '../lib/slimeSlugs.js'
import { playSfx } from '../lib/sfx.js'

// Babosa de slime coleccionable — MODELO 3D real (no sprite). Cuerpo verde
// gomoso/gel + ojo grande tipo cíclope + dos burbujas + contorno toon (hull
// invertido). Se mueve VIVA: brinquito con squash/stretch + respiración + sway.
//
// `SlimeMesh` es el modelo puro (se usa tanto en escenas R3F como dentro de un
// mini-canvas para los slugs en DOM, ver SlimeSlugDOM.jsx).
//   id        — uno de SLUG_IDS
//   baseScale — tamaño base del modelo
//   hopScale  — amplitud del brinco (1 = escena, <1 para no cortar en canvas chico)
//   onGone    — callback cuando termina la animación de recogida
export function SlimeMesh({ id, baseScale = 1, hopScale = 1, onGone }) {
  const grp = useRef()
  const popRef = useRef(0)
  const phaseRef = useRef(Math.random() * Math.PI * 2)
  const [hidden, setHidden] = useState(false)

  useFrame((state, dt) => {
    const g = grp.current
    if (!g) return
    // Recogida: crece y desaparece.
    if (popRef.current > 0) {
      popRef.current = Math.min(1, popRef.current + dt * 4.5)
      const p = popRef.current
      g.scale.setScalar(baseScale * (1 + p * 0.9))
      if (p >= 1) { setHidden(true); try { onGone?.() } catch { } }
      return
    }
    const t = state.clock.elapsedTime
    const ph = phaseRef.current
    const cyc = ((t * 0.8 + ph) % (Math.PI * 2)) / (Math.PI * 2) // 0..1
    let sx = 1, sy = 1, hop = 0, rotZ = 0
    if (cyc < 0.5) {
      // Medio ciclo: brinco. Achata al despegar/aterrizar, estira en el aire.
      const p = cyc / 0.5
      const arch = Math.sin(p * Math.PI)
      hop = arch * 0.4 * hopScale
      const land = (p < 0.16 || p > 0.84) ? 0.13 : 0
      sy = 1 + arch * 0.16 - land
      sx = 1 - arch * 0.10 + land
    } else {
      // Medio ciclo: reposo con respiración + sway.
      const br = Math.sin(t * 2.0 + ph) * 0.045
      sy = 1 + br; sx = 1 - br
      rotZ = Math.sin(t * 1.3 + ph) * 0.06
    }
    g.position.y = hop * baseScale
    g.rotation.z = rotZ
    g.rotation.y = Math.sin(t * 0.7 + ph) * 0.12
    g.scale.set(baseScale * sx, baseScale * sy, baseScale * sx)
  })

  if (hidden) return null

  const onClick = (e) => {
    try { e.stopPropagation() } catch { }
    if (popRef.current > 0) return
    const isNew = collectSlug(id)
    if (isNew) { try { playSfx('sparkleBom', { volume: 0.9 }) } catch { } }
    popRef.current = 0.001
  }

  return (
    <group
      ref={grp}
      onClick={onClick}
      onPointerOver={(e) => { try { e.stopPropagation(); document.body.style.cursor = 'pointer' } catch { } }}
      onPointerOut={() => { try { document.body.style.cursor = '' } catch { } }}
    >
      {/* contorno toon (hull invertido negro-verdoso) */}
      <mesh scale={[1.07, 1.07 * 0.9, 1.07 * 0.96]}>
        <sphereGeometry args={[1, 26, 20]} />
        <meshBasicMaterial color="#0e360d" side={THREE.BackSide} />
      </mesh>
      {/* cuerpo gel */}
      <mesh scale={[1, 0.9, 0.96]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshPhysicalMaterial
          color="#43c83a"
          emissive="#1c7a26"
          emissiveIntensity={0.35}
          roughness={0.28}
          metalness={0}
          clearcoat={0.6}
          clearcoatRoughness={0.3}
          transparent
          opacity={0.96}
        />
      </mesh>
      {/* contorno del ojo (disco oscuro) */}
      <mesh position={[0, 0.06, 0.62]} scale={[0.6, 0.6, 0.34]}>
        <sphereGeometry args={[1, 22, 16]} />
        <meshBasicMaterial color="#0e360d" />
      </mesh>
      {/* ojo cíclope (crema) */}
      <mesh position={[0, 0.06, 0.7]} scale={[0.52, 0.52, 0.32]}>
        <sphereGeometry args={[1, 22, 16]} />
        <meshStandardMaterial color="#f6e279" emissive="#b89a2a" emissiveIntensity={0.18} roughness={0.4} />
      </mesh>
      {/* pupila */}
      <mesh position={[0.02, 0.0, 0.92]} scale={[0.15, 0.17, 0.12]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#0e1f0a" />
      </mesh>
      {/* brillo del ojo */}
      <mesh position={[-0.13, 0.17, 0.95]} scale={[0.07, 0.07, 0.05]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* dos burbujas (boquita) */}
      <mesh position={[-0.2, -0.5, 0.72]} scale={0.13}>
        <sphereGeometry args={[1, 14, 12]} />
        <meshStandardMaterial color="#dcffb0" emissive="#3f8a2a" emissiveIntensity={0.2} roughness={0.3} />
      </mesh>
      <mesh position={[0.2, -0.52, 0.74]} scale={0.13}>
        <sphereGeometry args={[1, 14, 12]} />
        <meshStandardMaterial color="#dcffb0" emissive="#3f8a2a" emissiveIntensity={0.2} roughness={0.3} />
      </mesh>
    </group>
  )
}

// Wrapper para escenas R3F (About bird, wander). Posiciona el modelo y maneja
// el estado "ya recogida".
//   position — [x,y,z]
//   scale    — tamaño (pequeño → difícil de hallar)
//   visible  — gate extra (ej. solo en easter-egg)
export default function SlimeSlug3D({ id, position = [0, 0, 0], scale = 0.6, visible = true }) {
  const [gone, setGone] = useState(() => hasSlug(id))
  useEffect(() => {
    const on = () => { if (hasSlug(id)) setGone(true) }
    window.addEventListener(SLIME_SLUGS_EVENT, on)
    return () => window.removeEventListener(SLIME_SLUGS_EVENT, on)
  }, [id])
  if (gone || !visible) return null
  return (
    <group position={position}>
      <SlimeMesh id={id} baseScale={scale} onGone={() => setGone(true)} />
    </group>
  )
}
