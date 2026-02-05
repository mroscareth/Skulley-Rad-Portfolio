import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

export default function SpeechBubble3D({
  anchorRef,
  visible = false,
  // displayText: what is shown (typing)
  // layoutText: full text to measure size (avoids jitter during typing)
  displayText = '',
  layoutText = '',
  // theme: enables special styles (easter egg)
  theme = 'normal', // 'normal' | 'egg'
  // Comic-style offset: to the right and above the character.
  // Note: applied relative to camera (right/up), not world.
  offset = [1.05, 0.85, 0],
}) {
  const { camera } = useThree()
  const groupRef = useRef(null)
  const isEgg = theme === 'egg'

  // Circular bubble: auto-adjustable radius based on text size
  // (Hooks ALWAYS at top to respect Rules of Hooks)
  // Increased so typography is larger without clipping.
  const BASE_R = 1.22
  const MIN_R = 1.05
  const MAX_R = 1.60
  const [R, setR] = useState(BASE_R)
  const rRef = useRef(R)
  useEffect(() => { rRef.current = R }, [R])
  // Reset when target phrase changes (avoids inheriting previous size)
  useEffect(() => { setR(BASE_R) }, [layoutText])

  const tmp = useMemo(() => ({
    p: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    fwd: new THREE.Vector3(),
    off: new THREE.Vector3(...offset),
    // For frame-rate independent smoothing
    smoothPos: new THREE.Vector3(),
    smoothAnchorPos: new THREE.Vector3(), // smoothed anchor position
    smoothCamFwd: new THREE.Vector3(0, 0, -1), // smoothed camera direction
    smoothScale: 1,
    initialized: false,
  }), [offset])

  // Reset smoothing when bubble appears/disappears
  useEffect(() => {
    if (visible) {
      // Force re-init of smoothing to avoid "jump" from previous position
      tmp.initialized = false
    }
  }, [visible, tmp])

  const halftoneTex = useMemo(() => {
    // Comic-style dot texture (procedural, no assets)
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const ctx = c.getContext('2d')
    if (!ctx) return null

    ctx.clearRect(0, 0, c.width, c.height)
    // Transparent background
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, c.width, c.height)

    // Dots
    const step = 16
    for (let y = 0; y < c.height + step; y += step) {
      for (let x = 0; x < c.width + step; x += step) {
        // radial gradient: denser at bottom-right
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

  // Force always-visible (no occlusion) for readability
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

  useFrame((state, delta) => {
    const g = groupRef.current
    const a = anchorRef?.current
    if (!g || !a) return

    try {
      const dt = Math.min(delta, 0.1) // cap for tab-out

      // Get raw anchor position
      a.getWorldPosition(tmp.p)

      // Get raw camera direction
      camera.getWorldDirection(tmp.fwd)

      // --- INITIALIZATION ---
      if (!tmp.initialized) {
        tmp.smoothAnchorPos.copy(tmp.p)
        tmp.smoothCamFwd.copy(tmp.fwd)
        tmp.smoothScale = 1
        tmp.initialized = true
      }

      // --- SMOOTH ANCHOR AND CAMERA SEPARATELY ---
      // Very low lambda for anchor (eliminates character vibration)
      const anchorLambda = 4.0
      const anchorK = 1 - Math.exp(-anchorLambda * dt)
      tmp.smoothAnchorPos.lerp(tmp.p, anchorK)

      // Very low lambda for camera direction (eliminates rotation vibration)
      const camLambda = 3.0
      const camK = 1 - Math.exp(-camLambda * dt)
      tmp.smoothCamFwd.lerp(tmp.fwd, camK)
      tmp.smoothCamFwd.normalize()

      // --- COMPUTE FINAL POSITION WITH SMOOTHED VALUES ---
      tmp.right.crossVectors(tmp.smoothCamFwd, camera.up).normalize()
      tmp.up.copy(camera.up).normalize()
      
      // Final position = smoothed anchor + offset relative to smoothed camera
      tmp.smoothPos.copy(tmp.smoothAnchorPos)
      tmp.smoothPos.addScaledVector(tmp.right, tmp.off.x)
      tmp.smoothPos.addScaledVector(tmp.up, tmp.off.y)
      tmp.smoothPos.addScaledVector(tmp.smoothCamFwd, tmp.off.z)

      g.position.copy(tmp.smoothPos)
      g.quaternion.copy(camera.quaternion)

      // Smoothed scale
      const d = camera.position.distanceTo(tmp.smoothPos)
      const targetScale = clamp(d * 0.058, 0.62, 1.38)
      const scaleLambda = 2.0
      const scaleK = 1 - Math.exp(-scaleLambda * dt)
      tmp.smoothScale = THREE.MathUtils.lerp(tmp.smoothScale, targetScale, scaleK)
      g.scale.setScalar(tmp.smoothScale)
    } catch {}
  })

  const shouldRender = Boolean(visible && (displayText || layoutText))
  if (!shouldRender) return null

  const CY = 0.72 // local Y center of the bubble
  const SEG = 64

  // Avoid any interference with controls/clicks: no raycast
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
        <meshBasicMaterial color={isEgg ? '#ff2a2a' : '#000000'} opacity={0.95} />
      </mesh>

      {/* Fill (slightly off-white) */}
      <mesh position={[0, CY, 0.002]} raycast={noRaycast}>
        <circleGeometry args={[R, SEG]} />
        <meshBasicMaterial color={isEgg ? '#000000' : '#fbfbfb'} opacity={0.98} />
      </mesh>

      {/* Halftone overlay (bottom-right) */}
      {halftoneTex && !isEgg && (
        <mesh position={[0.10, CY - 0.10, 0.003]} raycast={noRaycast}>
          <circleGeometry args={[R, SEG]} />
          <meshBasicMaterial map={halftoneTex} transparent opacity={0.65} />
        </mesh>
      )}

      {/* Motion lines (simple, above) */}
      <mesh position={[R * 0.95, CY + R * 0.95, 0.004]} rotation={[0, 0, 0.25]} raycast={noRaycast}>
        <planeGeometry args={[0.55, 0.06]} />
        <meshBasicMaterial color={isEgg ? '#ff2a2a' : '#000000'} opacity={0.85} />
      </mesh>
      <mesh position={[-R * 0.95, CY + R * 0.9, 0.004]} rotation={[0, 0, -0.28]} raycast={noRaycast}>
        <planeGeometry args={[0.45, 0.06]} />
        <meshBasicMaterial color={isEgg ? '#ff2a2a' : '#000000'} opacity={0.75} />
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
        <meshBasicMaterial color={isEgg ? '#000000' : '#fbfbfb'} opacity={0.98} />
      </mesh>

      <Text
        position={[0, CY, 0.01]}
        fontSize={0.25}
        maxWidth={R * 1.62}
        // Typography matching portrait (font-marquee): Luckiest Guy
        font={`${import.meta.env.BASE_URL}fonts/LuckiestGuy-Regular.ttf`}
        lineHeight={1.32}
        letterSpacing={0.03}
        color={isEgg ? '#ff2a2a' : '#111111'}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        // Less "bold visual": remove hard outline that thickens and becomes illegible
        outlineWidth={0.004}
        outlineColor={isEgg ? '#000000' : '#fbfbfb'}
        raycast={noRaycast}
        onSync={(troika) => {
          try {
            const info = troika?.textRenderInfo
            const bb = info?.blockBounds
            if (!bb || bb.length < 4) return
            const w = Math.max(0, bb[2] - bb[0])
            const h = Math.max(0, bb[3] - bb[1])
            // Convert text bounds (in local units) to required radius,
            // leaving padding so text does not touch the edge.
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

