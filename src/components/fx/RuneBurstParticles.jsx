import React, { useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RUNE_FONT_FAMILY } from '../../lib/installRuneFont.js'

// RuneBurstParticles — glyphs rúnicos que brotan del personaje. Dos modos:
//   • 'burst'  (default): estallido radial. Easter egg del cursed orb — cada
//     letra de "POWER OF GOD" sale disparada (se "lee" si conoces el alfabeto).
//   • 'spiral': vórtice ascendente que gira alrededor del personaje, como un
//     casteo de encantamiento. Efecto del botón Randomize del customizer.
// Imperativo via ref.fire(opts) — sin re-renders; el pool vive montado y se
// controla por frame. Additive + depthTest off → energía sobre la escena.
const PHRASE = 'POWEROFGOD' // sin espacios: cada char = una partícula rune
const MAX = 36              // pool: el easter egg usa 10, el spiral hasta 36
const DEFAULT_LIFE = 1.5

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
  const timeRef = useRef(0) // reloj acumulado para twinkle/wander tipo portal

  // Slot i → char (cicla PHRASE). Los primeros 10 slots == PHRASE exacto, así el
  // easter egg (fire() sin args, count=10) conserva "POWEROFGOD" intacto.
  const glyphAt = (i) => PHRASE[i % PHRASE.length]

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
    partsRef.current = Array.from({ length: MAX }, () => ({
      mode: 'burst', active: false, ttl: 0, life: DEFAULT_LIFE, delay: 0,
      x: 0, y: -1000, z: 0, vx: 0, vy: 0, vz: 0, gravity: 4.2,
      cx: 0, cz: 0, baseY: 0, angle: 0, omega: 0, r0: 0.4, rGrow: 0,
      phase: 0, twk: 3, wob: 1, wobAmp: 0,
      scaleBase: 0.5, scaleGrow: 0.55, spinV: 0,
    }))
  }, [])

  useImperativeHandle(ref, () => ({
    // opts comunes: count, life, scaleBase, scaleGrow, spin (rad/s máx).
    // mode 'burst': speedMin/Max (radial), upMin/Max (impulso vertical), gravity.
    // mode 'spiral': radius (anillo base), radiusGrow (abre cono), swirl (giro
    //   rad/s, coherente), rise (vy ascenso), riseStart (offset Y inicial),
    //   spread (ventana de aparición escalonada).
    fire(opts = {}) {
      const {
        mode = 'burst',
        count = PHRASE.length,
        life = DEFAULT_LIFE,
        scaleBase = 0.5, scaleGrow = 0.55,
        spin = 0,
        // burst
        speedMin = 1.6, speedMax = 3.5, upMin = 2.4, upMax = 4.8, gravity = 4.2,
        // spiral
        radius = 0.55, radiusGrow = 0.9, swirl = 3.4, rise = 1.7,
        riseStart = -0.9, spread = 0.45, wobble = 0.12,
      } = opts
      let px = 0, py = 1.6, pz = 0
      try {
        const p = playerRef?.current?.position
        if (p) { px = p.x; py = p.y + 1.6; pz = p.z }
      } catch { }
      const parts = partsRef.current
      const n = Math.min(count, MAX)
      const swirlDir = Math.random() < 0.5 ? -1 : 1 // sentido coherente del vórtice
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (i >= n) { part.active = false; continue }
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
        part.mode = mode
        part.ttl = life
        part.life = life
        part.scaleBase = scaleBase
        part.scaleGrow = scaleGrow
        part.spinV = spin ? (Math.random() - 0.5) * 2 * spin : 0
        part.active = true
        if (mode === 'spiral') {
          part.delay = Math.random() * spread
          part.cx = px; part.cz = pz
          part.baseY = py + riseStart
          part.angle = a
          part.omega = swirlDir * swirl * (0.85 + Math.random() * 0.35)
          part.r0 = radius * (0.75 + Math.random() * 0.5)
          part.rGrow = radiusGrow
          part.vy = rise * (0.8 + Math.random() * 0.5)
          part.phase = Math.random() * Math.PI * 2
          part.twk = 2.5 + Math.random() * 3.5   // freq de twinkle (parpadeo)
          part.wob = 0.6 + Math.random() * 1.0   // freq de wander lateral
          part.wobAmp = wobble * (0.6 + Math.random() * 0.8)
        } else {
          part.delay = 0
          const sp = speedMin + Math.random() * (speedMax - speedMin)
          part.x = px; part.y = py; part.z = pz
          part.vx = Math.cos(a) * sp
          part.vz = Math.sin(a) * sp
          part.vy = upMin + Math.random() * (upMax - upMin)
          part.gravity = gravity
        }
      }
    },
  }), [playerRef])

  useFrame((_, dt) => {
    const parts = partsRef.current
    if (!parts) return
    const d = Math.min(dt, 0.05)
    timeRef.current += d
    const t = timeRef.current
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const spr = spritesRef.current[i]
      const mat = matsRef.current[i]
      if (!spr) continue
      if (!part.active) { if (spr.visible) spr.visible = false; continue }
      // Aparición escalonada (solo spiral): espera su turno, invisible.
      if (part.delay > 0) {
        part.delay -= d
        if (spr.visible) spr.visible = false
        if (mat) mat.opacity = 0
        continue
      }
      part.ttl -= d
      if (part.ttl <= 0) {
        part.active = false
        spr.visible = false
        if (mat) mat.opacity = 0
        continue
      }
      const p = 1 - part.ttl / part.life // progreso 0→1

      if (part.mode === 'spiral') {
        // Como las luciérnagas del portal: la runa ASCIENDE (de los pies hacia
        // arriba), con swirl suave + wander lateral orgánico y twinkle. Fade-in
        // al nacer y fade-out al morir → flota y se desvanece subiendo.
        const elapsed = part.life - part.ttl
        part.angle += part.omega * d
        const radius = part.r0 + part.rGrow * p
        const y = part.baseY + part.vy * elapsed
        const wx = Math.sin(t * part.wob + part.phase) * part.wobAmp
        const wz = Math.cos(t * part.wob * 0.9 + part.phase) * part.wobAmp
        spr.position.set(
          part.cx + Math.cos(part.angle) * radius + wx,
          y,
          part.cz + Math.sin(part.angle) * radius + wz,
        )
        spr.visible = true
        spr.scale.setScalar(part.scaleBase + p * part.scaleGrow)
        if (mat) {
          if (part.spinV) mat.rotation += part.spinV * d
          const fadeIn = Math.min(1, elapsed / 0.3)
          const fadeOut = Math.min(1, part.ttl / 0.6)
          const twinkle = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * part.twk + part.phase))
          mat.opacity = Math.min(fadeIn, fadeOut) * twinkle
        }
      } else {
        // Burst radial (easter egg): impulso + gravedad.
        part.vy -= part.gravity * d
        part.vx *= 0.96
        part.vz *= 0.96
        part.x += part.vx * d
        part.y += part.vy * d
        part.z += part.vz * d
        spr.position.set(part.x, part.y, part.z)
        spr.visible = true
        const k = part.ttl / part.life
        spr.scale.setScalar(part.scaleBase + (1 - k) * part.scaleGrow)
        if (mat) {
          if (part.spinV) mat.rotation += part.spinV * d
          mat.opacity = Math.min(1, k * 1.6)
        }
      }
    }
  })

  return (
    <group>
      {Array.from({ length: MAX }).map((_, i) => (
        <sprite
          key={i}
          ref={(s) => { if (s) spritesRef.current[i] = s }}
          position={[0, -1000, 0]}
          visible={false}
          renderOrder={60}
        >
          <spriteMaterial
            ref={(m) => { if (m) { matsRef.current[i] = m; if (!m.map) m.map = textures[glyphAt(i)] || null } }}
            map={textures[glyphAt(i)] || undefined}
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
