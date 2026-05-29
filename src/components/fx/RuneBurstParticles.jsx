import React, { useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RUNE_FONT_FAMILY } from '../../lib/installRuneFont.js'

// RuneBurstParticles — estallido de glyphs rúnicos que brota del personaje.
// Cada letra de "POWER OF GOD" es un sprite billboard en rune font: el easter
// egg "lee" power of god solo si conoces el alfabeto Skulley. Sale al COMER el
// cursed orb (canal del poder del rayo). Imperativo via ref.fire() — sin
// re-renders; el pool de sprites vive montado y se controla por frame.
//
// Mismo patrón de pool que los popups de HomeOrbs: array fijo de partículas,
// integración en useFrame, opacity/scale por ttl. Additive + depthTest off →
// se leen como energía sobre la escena, no como cartelitos opacos.
const PHRASE = 'POWEROFGOD' // sin espacios: cada char = una partícula rune
const LIFE = 1.5

function makeGlyphTexture(ch) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Doble pasada: halo púrpura ancho + glyph blanco al centro → glow neón.
  ctx.font = `bold 92px ${RUNE_FONT_FAMILY}`
  ctx.shadowColor = '#c77dff'
  ctx.shadowBlur = 26
  ctx.fillStyle = '#ffffff'
  ctx.fillText(ch, size / 2, size / 2)
  ctx.shadowBlur = 10
  ctx.fillStyle = '#e9d5ff'
  ctx.fillText(ch, size / 2, size / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

const RuneBurstParticles = forwardRef(function RuneBurstParticles({ playerRef }, ref) {
  const spritesRef = useRef([])
  const matsRef = useRef([])
  const partsRef = useRef([])

  // Cache de texturas por char único (O se reusa 3 veces).
  const textures = useMemo(() => {
    const map = {}
    for (const ch of PHRASE) {
      if (!map[ch]) {
        try { map[ch] = makeGlyphTexture(ch) } catch { map[ch] = null }
      }
    }
    return map
  }, [])

  useMemo(() => {
    partsRef.current = Array.from({ length: PHRASE.length }, () => ({
      x: 0, y: -1000, z: 0, vx: 0, vy: 0, vz: 0, ttl: 0, active: false,
    }))
  }, [])

  useImperativeHandle(ref, () => ({
    fire() {
      let px = 0, py = 1.6, pz = 0
      try {
        const p = playerRef?.current?.position
        if (p) { px = p.x; py = p.y + 1.6; pz = p.z }
      } catch { }
      const parts = partsRef.current
      for (let i = 0; i < parts.length; i++) {
        // Distribución radial uniforme + jitter → corona de runas, no chorro.
        const a = (i / parts.length) * Math.PI * 2 + Math.random() * 0.5
        const sp = 1.6 + Math.random() * 1.9
        const part = parts[i]
        part.x = px; part.y = py; part.z = pz
        part.vx = Math.cos(a) * sp
        part.vz = Math.sin(a) * sp
        part.vy = 2.4 + Math.random() * 2.4
        part.ttl = LIFE
        part.active = true
      }
    },
  }), [playerRef])

  useFrame((_, dt) => {
    const parts = partsRef.current
    if (!parts) return
    const d = Math.min(dt, 0.05)
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const spr = spritesRef.current[i]
      const mat = matsRef.current[i]
      if (!spr) continue
      if (!part.active) { if (spr.visible) spr.visible = false; continue }
      part.ttl -= d
      if (part.ttl <= 0) {
        part.active = false
        spr.visible = false
        if (mat) mat.opacity = 0
        continue
      }
      part.vy -= 4.2 * d
      part.vx *= 0.96
      part.vz *= 0.96
      part.x += part.vx * d
      part.y += part.vy * d
      part.z += part.vz * d
      spr.position.set(part.x, part.y, part.z)
      spr.visible = true
      const k = part.ttl / LIFE
      spr.scale.setScalar(0.5 + (1 - k) * 0.55)
      if (mat) mat.opacity = Math.min(1, k * 1.6)
    }
  })

  return (
    <group>
      {Array.from({ length: PHRASE.length }).map((_, i) => (
        <sprite
          key={i}
          ref={(s) => { if (s) spritesRef.current[i] = s }}
          position={[0, -1000, 0]}
          visible={false}
          renderOrder={60}
        >
          <spriteMaterial
            ref={(m) => { if (m) { matsRef.current[i] = m; if (!m.map) m.map = textures[PHRASE[i]] || null } }}
            map={textures[PHRASE[i]] || undefined}
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  )
})

export default RuneBurstParticles
