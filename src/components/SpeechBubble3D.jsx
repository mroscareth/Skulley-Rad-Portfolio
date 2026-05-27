import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

// Spiky comic "burst/explosion" bubble shape: alternates between an outer
// radius (spike tips) and an inner radius (valleys) around the circle.
// `jitter` breaks the perfect symmetry slightly for a hand-drawn pop-art feel.
function makeBurstGeometry(outerR, innerR, spikes = 12) {
  const shape = new THREE.Shape()
  const total = spikes * 2
  for (let i = 0; i <= total; i++) {
    const ang = (i / total) * Math.PI * 2 - Math.PI / 2
    // Deterministic per-vertex jitter so spikes look irregular but stable.
    const j = i % 2 === 0 ? 1 + 0.06 * Math.sin(i * 12.9898) : 1 + 0.04 * Math.sin(i * 4.137)
    const rad = (i % 2 === 0 ? outerR : innerR) * j
    const x = Math.cos(ang) * rad
    const y = Math.sin(ang) * rad
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

// Simple triangle (used for the comic tail).
function makeTriangle(ax, ay, bx, by, cx, cy) {
  const s = new THREE.Shape()
  s.moveTo(ax, ay)
  s.lineTo(bx, by)
  s.lineTo(cx, cy)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

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

  // ── SIZING MODEL (two simple knobs) ─────────────────────────────────────
  // 1) FONT: the text size is FIXED and readable (never shrinks → no tiny text).
  // 2) MAX_R: the bubble GROWS to fit the text, up to this cap.
  // maxWidth is a constant (not tied to R), so R converges once per phrase and
  // never oscillates → no trembling. Short phrases → small bubble; long ones →
  // bigger bubble, but text stays the same readable size.
  const FONT = 0.27         // ← text size (fixed)
  const MAX_WIDTH = 2.2     // ← wrap width (wider = fewer lines = squarer bubble)
  const PAD = 0.20          // inner margin (text ↔ spike valleys)
  const MIN_R = 0.62
  const MAX_R = 2.4         // ← bubble size cap (room for the longest phrases)
  const BASE_R = 0.82
  const [R, setR] = useState(BASE_R)
  const rRef = useRef(R)
  useEffect(() => { rRef.current = R }, [R])
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
    zAxis: new THREE.Vector3(),
    basisMat: new THREE.Matrix4(),
    smoothScale: 1,
    initialized: false,
    // IMPORTANT: deps must be [] so this object (and its smoothing state) is
    // created ONCE. `offset` arrives as a fresh array literal every parent
    // render; depending on it here re-created `tmp` each render, resetting the
    // smoothing every frame → the bubble snapped to the raw jittery pose and
    // trembled. tmp.off is refreshed in useFrame instead.
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset smoothing when bubble appears/disappears
  useEffect(() => {
    if (visible) {
      // Force re-init of smoothing to avoid "jump" from previous position
      tmp.initialized = false
    }
  }, [visible, tmp])

  // Burst geometries (regenerated when the auto-fit radius R changes).
  const SPIKES = 12
  const INNER_RATIO = 0.78
  const BORDER = 0.07 // black outline thickness
  // Tail points toward the character = OPPOSITE of the screen offset (the bubble
  // is placed offset.x right / offset.y up from the character). Extract as
  // primitives so a fresh `offset` array each render doesn't rebuild geometry.
  const ox = offset?.[0] ?? 1.05
  const oy = offset?.[1] ?? 0.85
  const burstGeos = useMemo(() => {
    // Unit direction from bubble center toward the character.
    const dlen = Math.hypot(ox, oy) || 1
    const dx = -ox / dlen, dy = -oy / dlen
    const px = -dy, py = dx              // perpendicular (base spread axis)
    const baseR = 0.55 * R               // base midpoint, INSIDE the burst (hidden)
    const halfBase = 0.22 * R            // half-width of the tail base
    const tailLen = 1.25 * R             // how far the tip sticks out
    const bmx = dx * baseR, bmy = dy * baseR
    const tipX = dx * tailLen, tipY = dy * tailLen
    // Fill base corners (perpendicular to the tail direction).
    const aLx = bmx + px * halfBase, aLy = bmy + py * halfBase
    const aRx = bmx - px * halfBase, aRy = bmy - py * halfBase
    // Border: same base midpoint (stays hidden) but wider + longer toward the tip.
    const bHalf = halfBase + 0.05
    const bLx = bmx + px * bHalf, bLy = bmy + py * bHalf
    const bRx = bmx - px * bHalf, bRy = bmy - py * bHalf
    const bTipX = dx * (tailLen + 0.09), bTipY = dy * (tailLen + 0.09)
    return {
      fill: makeBurstGeometry(R, R * INNER_RATIO, SPIKES),
      border: makeBurstGeometry(R + BORDER, R * INNER_RATIO + BORDER, SPIKES),
      tailFill: makeTriangle(aLx, aLy, aRx, aRy, tipX, tipY),
      tailBorder: makeTriangle(bLx, bLy, bRx, bRy, bTipX, bTipY),
    }
  }, [R, ox, oy])
  useEffect(() => () => {
    try {
      burstGeos.fill.dispose(); burstGeos.border.dispose()
      burstGeos.tailFill.dispose(); burstGeos.tailBorder.dispose()
    } catch { }
  }, [burstGeos])

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

      // Keep the offset current without recreating tmp (preserves smoothing).
      if (offset) tmp.off.set(offset[0] || 0, offset[1] || 0, offset[2] || 0)

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
      // Orient from the SMOOTHED camera basis (not the raw camera quaternion):
      // copying camera.quaternion directly leaks the camera's per-frame jitter
      // while following the walking character, making the text plane vibrate.
      // The bubble's +Z must face the camera, i.e. opposite the view direction.
      tmp.zAxis.copy(tmp.smoothCamFwd).negate().normalize()
      // Re-orthonormalize up from (zAxis × right) so the text plane never shears
      // when the camera tilts (camera.up isn't perpendicular to the view dir).
      tmp.up.crossVectors(tmp.zAxis, tmp.right).normalize()
      tmp.basisMat.makeBasis(tmp.right, tmp.up, tmp.zAxis)
      g.quaternion.setFromRotationMatrix(tmp.basisMat)

      // Smoothed scale (capped tighter so the bubble stays compact)
      const d = camera.position.distanceTo(tmp.smoothPos)
      const targetScale = clamp(d * 0.048, 0.50, 1.12)
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
      {/* Shadow: hard offset black burst + tail (pop-art drop) */}
      <mesh geometry={burstGeos.border} position={[0.12, CY - 0.12, -0.02]} raycast={noRaycast}>
        <meshBasicMaterial color={'#000000'} opacity={0.9} />
      </mesh>
      <mesh geometry={burstGeos.tailBorder} position={[0.12, CY - 0.12, -0.021]} raycast={noRaycast}>
        <meshBasicMaterial color={'#000000'} opacity={0.9} />
      </mesh>

      {/* Tail border (black) — drawn BEFORE the burst so its base is hidden by
          the white fill; only the protruding part keeps its black outline. */}
      <mesh geometry={burstGeos.tailBorder} position={[0, CY, -0.001]} raycast={noRaycast}>
        <meshBasicMaterial color={isEgg ? '#ff2a2a' : '#000000'} opacity={0.98} />
      </mesh>

      {/* Border (thick black outline burst) */}
      <mesh geometry={burstGeos.border} position={[0, CY, 0]} raycast={noRaycast}>
        <meshBasicMaterial color={isEgg ? '#ff2a2a' : '#000000'} opacity={0.98} />
      </mesh>

      {/* Fill (white burst) — covers the tail border's base → connected look */}
      <mesh geometry={burstGeos.fill} position={[0, CY, 0.002]} raycast={noRaycast}>
        <meshBasicMaterial color={isEgg ? '#000000' : '#fbfbfb'} opacity={0.98} />
      </mesh>

      {/* Halftone overlay clipped to the burst — reduced opacity for readability */}
      {halftoneTex && !isEgg && (
        <mesh geometry={burstGeos.fill} position={[0, CY, 0.003]} raycast={noRaycast}>
          <meshBasicMaterial map={halftoneTex} transparent opacity={0.30} />
        </mesh>
      )}

      {/* Tail fill (white) — on top; its base merges with the burst's white. */}
      <mesh geometry={burstGeos.tailFill} position={[0, CY, 0.0035]} raycast={noRaycast}>
        <meshBasicMaterial color={isEgg ? '#000000' : '#fbfbfb'} opacity={0.98} />
      </mesh>

      {/* MEASUREMENT text (invisible): always renders the FULL phrase so the
          bubble is sized for the complete text — not the partial string being
          typed. This is what makes the bubble grow with the text reliably. */}
      <Text
        position={[0, CY, 0.009]}
        fontSize={FONT}
        maxWidth={MAX_WIDTH}
        font={`${import.meta.env.BASE_URL}fonts/LuckiestGuy-Regular.ttf`}
        lineHeight={1.30}
        letterSpacing={0.025}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        fillOpacity={0}
        visible={false}
        raycast={noRaycast}
        onSync={(troika) => {
          try {
            const info = troika?.textRenderInfo
            const bb = info?.blockBounds
            if (!bb || bb.length < 4) return
            const w = Math.max(0, bb[2] - bb[0])
            const h = Math.max(0, bb[3] - bb[1])
            // Grow the bubble to fit the FULL text: the block's half-diagonal
            // (corners) plus PAD must reach the valley circle (R*INNER_RATIO).
            const halfDiag = 0.5 * Math.sqrt(w * w + h * h)
            const desired = clamp((halfDiag + PAD) / INNER_RATIO, MIN_R, MAX_R)
            if (Math.abs((rRef.current || 0) - desired) > 0.04) setR(desired)
          } catch {}
        }}
      >
        {layoutText || displayText}
      </Text>

      {/* VISIBLE text: shows the typed-in characters. No onSync (doesn't drive
          size) so the bubble doesn't resize per keystroke. */}
      <Text
        position={[0, CY, 0.01]}
        fontSize={FONT}
        maxWidth={MAX_WIDTH}
        font={`${import.meta.env.BASE_URL}fonts/LuckiestGuy-Regular.ttf`}
        lineHeight={1.30}
        letterSpacing={0.025}
        color={isEgg ? '#ff2a2a' : '#111111'}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        outlineWidth={0.003}
        outlineColor={isEgg ? '#000000' : '#fbfbfb'}
        raycast={noRaycast}
      >
        {displayText || layoutText}
      </Text>
    </group>
  )
}

