import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

export default function SpeechBubble3D({
  anchorRef,
  visible = false,
  // displayText: lo que se ve (typing)
  // layoutText: texto completo para medir tamaño (evita jitter mientras escribe)
  displayText = '',
  layoutText = '',
  // Offset “cómico”: a la derecha y arriba del personaje.
  // Ojo: se aplica relativo a cámara (right/up), no al mundo.
  offset = [1.05, 0.85, 0],
}) {
  const { camera } = useThree()
  const groupRef = useRef(null)

  // Burbuja circular: radio auto‑ajustable según el tamaño del texto
  // (Hooks SIEMPRE arriba para respetar Rules of Hooks)
  const BASE_R = 1.05
  const MIN_R = 0.92
  const MAX_R = 1.35
  const [R, setR] = useState(BASE_R)
  const rRef = useRef(R)
  useEffect(() => { rRef.current = R }, [R])
  // Reset al cambiar frase objetivo (evita heredar tamaño anterior)
  useEffect(() => { setR(BASE_R) }, [layoutText])

  const tmp = useMemo(() => ({
    p: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    fwd: new THREE.Vector3(),
    off: new THREE.Vector3(...offset),
  }), [offset])

  const halftoneTex = useMemo(() => {
    // Textura de puntitos estilo cómic (procedural, sin assets)
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const ctx = c.getContext('2d')
    if (!ctx) return null

    ctx.clearRect(0, 0, c.width, c.height)
    // Fondo transparente
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, c.width, c.height)

    // Dots
    const step = 16
    for (let y = 0; y < c.height + step; y += step) {
      for (let x = 0; x < c.width + step; x += step) {
        // gradiente radial: más denso en abajo-derecha
        const nx = x / c.width
        const ny = y / c.height
        const k = Math.pow(clamp((nx * 0.85 + ny * 1.05) * 0.62, 0, 1), 1.8)
        const r = 1 + k * 4.6
        const a = 0.05 + k * 0.35
        ctx.beginPath()
        ctx.fillStyle = `rgba(0,0,0,${a})`
        ctx.arc(x + (y / step % 2 ? step * 0.5 : 0), y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 1)
    tex.needsUpdate = true
    return tex
  }, [])

  // Fuerza siempre-visible (sin oclusión) para legibilidad
  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    try {
      g.renderOrder = 9999
      g.traverse((o) => {
        if (o && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((m) => {
            if (!m) return
            m.depthTest = false
            m.depthWrite = false
            m.transparent = true
          })
        }
        o.renderOrder = 9999
      })
    } catch {}
  }, [])

  useFrame(() => {
    const g = groupRef.current
    const a = anchorRef?.current
    if (!g || !a) return

    try {
      a.getWorldPosition(tmp.p)
      // Offset relativo a la cámara para que SIEMPRE quede a la derecha en pantalla
      camera.getWorldDirection(tmp.fwd)
      tmp.right.crossVectors(tmp.fwd, camera.up).normalize()
      tmp.up.copy(camera.up).normalize()
      tmp.p.addScaledVector(tmp.right, tmp.off.x)
      tmp.p.addScaledVector(tmp.up, tmp.off.y)
      tmp.p.addScaledVector(tmp.fwd, tmp.off.z)
      g.position.copy(tmp.p)
      g.quaternion.copy(camera.quaternion)

      // Escala para mantener legibilidad aproximada (clamp)
      const d = camera.position.distanceTo(tmp.p)
      // Más pequeño: reduce factor y tope máximo
      const s = clamp(d * 0.055, 0.55, 1.25)
      g.scale.setScalar(s)
    } catch {}
  })

  const shouldRender = Boolean(visible && (displayText || layoutText))
  if (!shouldRender) return null

  const CY = 0.72 // centro Y local de la burbuja
  const SEG = 64

  // Evitar cualquier interferencia con controles/clicks: no raycast
  const noRaycast = () => null

  return (
    <group ref={groupRef} rotation={[0, 0, -0.04]} raycast={noRaycast}>
      {/* Shadow (comic drop) */}
      <mesh position={[0.12, CY - 0.08, -0.02]} raycast={noRaycast}>
        <circleGeometry args={[R + 0.10, SEG]} />
        <meshBasicMaterial color={'#000000'} opacity={0.42} />
      </mesh>

      {/* Border (thick outline) */}
      <mesh position={[0, CY, 0]} raycast={noRaycast}>
        <circleGeometry args={[R + 0.10, SEG]} />
        <meshBasicMaterial color={'#000000'} opacity={0.95} />
      </mesh>

      {/* Fill (slightly off-white) */}
      <mesh position={[0, CY, 0.002]} raycast={noRaycast}>
        <circleGeometry args={[R, SEG]} />
        <meshBasicMaterial color={'#fbfbfb'} opacity={0.98} />
      </mesh>

      {/* Halftone overlay (bottom-right) */}
      {halftoneTex && (
        <mesh position={[0.10, CY - 0.10, 0.003]} raycast={noRaycast}>
          <circleGeometry args={[R, SEG]} />
          <meshBasicMaterial map={halftoneTex} transparent opacity={0.65} />
        </mesh>
      )}

      {/* Motion lines (simple, arriba) */}
      <mesh position={[R * 0.95, CY + R * 0.95, 0.004]} rotation={[0, 0, 0.25]} raycast={noRaycast}>
        <planeGeometry args={[0.55, 0.06]} />
        <meshBasicMaterial color={'#000000'} opacity={0.85} />
      </mesh>
      <mesh position={[-R * 0.95, CY + R * 0.9, 0.004]} rotation={[0, 0, -0.28]} raycast={noRaycast}>
        <planeGeometry args={[0.45, 0.06]} />
        <meshBasicMaterial color={'#000000'} opacity={0.75} />
      </mesh>

      {/* Tail (comic) */}
      <mesh position={[-R * 0.78 + 0.10, CY - R * 0.92, -0.02]} rotation={[0, 0, Math.PI * 0.08]} raycast={noRaycast}>
        <coneGeometry args={[0.28, 0.42, 3]} />
        <meshBasicMaterial color={'#000000'} opacity={0.42} />
      </mesh>
      <mesh position={[-R * 0.78, CY - R * 0.86, 0.001]} rotation={[0, 0, Math.PI * 0.08]} raycast={noRaycast}>
        <coneGeometry args={[0.33, 0.46, 3]} />
        <meshBasicMaterial color={'#000000'} opacity={0.95} />
      </mesh>
      <mesh position={[-R * 0.78, CY - R * 0.86, 0.003]} rotation={[0, 0, Math.PI * 0.08]} raycast={noRaycast}>
        <coneGeometry args={[0.27, 0.40, 3]} />
        <meshBasicMaterial color={'#fbfbfb'} opacity={0.98} />
      </mesh>

      <Text
        position={[0, CY, 0.01]}
        fontSize={0.20}
        maxWidth={R * 1.55}
        // Tipografía igual al retrato (font-marquee): Luckiest Guy
        font={`${import.meta.env.BASE_URL}fonts/LuckiestGuy-Regular.ttf`}
        lineHeight={1.32}
        letterSpacing={0.03}
        color={'#111111'}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        // Menos "bold visual": quitar outline duro que engruesa y vuelve ilegible
        outlineWidth={0.004}
        outlineColor={'#fbfbfb'}
        raycast={noRaycast}
        onSync={(troika) => {
          try {
            const info = troika?.textRenderInfo
            const bb = info?.blockBounds
            if (!bb || bb.length < 4) return
            const w = Math.max(0, bb[2] - bb[0])
            const h = Math.max(0, bb[3] - bb[1])
            // Convertir bounds del texto (en unidades locales) a radio requerido,
            // dejando padding para que no “toque” el borde.
            const pad = 0.32
            const desired = clamp(Math.max(w, h) * 0.52 + pad, MIN_R, MAX_R)
            if (Math.abs((rRef.current || 0) - desired) > 0.04) setR(desired)
          } catch {}
        }}
      >
        {displayText || layoutText}
      </Text>
    </group>
  )
}

