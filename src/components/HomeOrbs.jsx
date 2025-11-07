import React, { useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * HomeOrbs
 * Esferas luminosas con física simple (gravedad, rebote en piso y empuje por colisión con el personaje).
 * - Sin librería de física externa; integra a 60fps con dt clamp.
 * - Colisión con el piso (y=0) y fricción. Empuje en XZ al chocar con el jugador.
 */
function HomeOrbsImpl({ playerRef, active = true, num = 10, portals = [], portalRadius = 2, onScoreDelta }, ref) {
  const groupRef = useRef(null)
  // Estados de física: posición, velocidad, radio, color
  const orbsRef = useRef([])
  const prevPlayerPosRef = useRef(new THREE.Vector3())
  const playerVelRef = useRef(new THREE.Vector3())
  const popupsRef = useRef([]) // {pos:Vector3, text:string, color:string, ttl:number}
  // Sistema simple de partículas de explosión
  const partRef = useRef([]) // {pos:Vector3, vel:Vector3, life:number, col:THREE.Color}
  const PART_CAP = 3000
  const partPositionsRef = useRef(new Float32Array(PART_CAP * 3))
  const partColorsRef = useRef(new Float32Array(PART_CAP * 3))
  const partGeoRef = useRef()

  // API imperativa: aplicar impulso radial a esferas cercanas
  useImperativeHandle(ref, () => ({
    radialImpulse(center, strength = 6, radius = 4) {
      try {
        const arr = orbsRef.current || []
        for (const s of arr) {
          const dx = s.pos.x - center.x
          const dz = s.pos.z - center.z
          const d2 = dx * dx + dz * dz
          const r = radius + s.radius
          if (d2 <= r * r) {
            const d = Math.max(1e-4, Math.sqrt(d2))
            const nx = dx / d
            const nz = dz / d
            const falloff = 1 - d / r
            const impulse = strength * falloff
            s.vel.x += nx * impulse
            s.vel.z += nz * impulse
            s.vel.y += impulse * 0.4
          }
        }
      } catch {}
    },
  }))

  // Inicializar orbes una vez
  useMemo(() => {
    const rng = (min, max) => Math.random() * (max - min) + min
    const colors = (portals && portals.length ? portals.map((p) => p.color) : ['#8ec5ff', '#ff9bf4', '#ffe48a', '#9bffb2'])
    const arr = []
    for (let i = 0; i < num; i++) {
      const radius = rng(0.18, 0.55)
      const x = rng(-6, 6)
      const z = rng(-6, 6)
      // Iniciar un poco arriba para que caigan
      const y = rng(1.2, 2.8)
      const color = colors[i % colors.length]
      arr.push({
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(rng(-0.2, 0.2), 0, rng(-0.2, 0.2)),
        radius,
        color,
        spawnCooldown: 0.6,
        blinkT: 0.6,
        _blinkPhase: 0,
        _visible: true,
      })
    }
    orbsRef.current = arr
  }, [num, portals])

  useFrame((state, delta) => {
    try { if (groupRef.current) groupRef.current.userData.orbs = orbsRef.current } catch {}
    if (!active) return
    const dt = THREE.MathUtils.clamp(delta, 1 / 120, 1 / 30)

    // Estimar velocidad del jugador
    const player = playerRef?.current
    if (player) {
      const ppos = player.position
      const prev = prevPlayerPosRef.current
      playerVelRef.current.set(ppos.x - prev.x, ppos.y - prev.y, ppos.z - prev.z).divideScalar(dt)
      prev.copy(ppos)
    } else {
      playerVelRef.current.set(0, 0, 0)
    }

    const GRAVITY = 9.8
    const GROUND_Y = 0.0
    const RESTITUTION = 0.5
    // Más deslizamiento para sensación de rodado
    const FRICTION = 0.98
    const AIR_DRAG = 0.999
    const ROLLING_DRAG = 0.996
    const PLAYER_RADIUS = 0.45
    // Empuje más fuerte al contacto + componente tangencial
    const IMPULSE_BASE = 1.2
    const PLAYER_PUSH_K = 0.25
    const TANGENTIAL_PUSH_K = 0.6

    // Integración por orb
    for (const s of orbsRef.current) {
      // gravedad
      s.vel.y -= GRAVITY * dt
      // integrar
      s.pos.addScaledVector(s.vel, dt)
      // reducir cooldown de spawn (evita capturas instantáneas)
      if (s.spawnCooldown && s.spawnCooldown > 0) s.spawnCooldown = Math.max(0, s.spawnCooldown - dt)
      // blink de aparición
      if (s.blinkT && s.blinkT > 0) {
        s.blinkT = Math.max(0, s.blinkT - dt)
        s._blinkPhase = (s._blinkPhase || 0) + dt
        const period = 0.12
        s._visible = Math.floor((s._blinkPhase / period)) % 2 === 0
      } else {
        s._visible = true
      }

      // colisión con piso (plano y=0)
      const floorY = GROUND_Y + s.radius
      if (s.pos.y < floorY) {
        s.pos.y = floorY
        // rebote vertical y fricción horizontal
        s.vel.y = Math.abs(s.vel.y) * RESTITUTION
        s.vel.x *= FRICTION
        s.vel.z *= FRICTION
      }

      // arrastre aire o rodando
      if (s.pos.y <= floorY + 1e-3) {
        s.vel.x *= ROLLING_DRAG
        s.vel.z *= ROLLING_DRAG
      } else {
        s.vel.x *= AIR_DRAG
        s.vel.z *= AIR_DRAG
      }

      // colisión con jugador (aprox esfera 2D en XZ)
      if (player) {
        const p = player.position
        const dx = s.pos.x - p.x
        const dz = s.pos.z - p.z
        const dist2 = dx * dx + dz * dz
        const minDist = s.radius + PLAYER_RADIUS
        if (dist2 < minDist * minDist) {
          const dist = Math.max(1e-4, Math.sqrt(dist2))
          const nx = dx / dist
          const nz = dz / dist
          // corrección posicional mínima para separar
          const pen = minDist - dist
          s.pos.x += nx * pen
          s.pos.z += nz * pen
          // impulso en la dirección normal + componente tangencial (simular rodado)
          const playerSpeed = Math.min(playerVelRef.current.length(), 8)
          const playerPush = THREE.MathUtils.clamp(playerSpeed * PLAYER_PUSH_K, 0, 2.0)
          const impulse = (IMPULSE_BASE + playerPush) * THREE.MathUtils.clamp(0.6 + (0.5 / Math.max(0.18, s.radius)), 0.6, 3.0)
          s.vel.x += nx * impulse
          s.vel.z += nz * impulse
          // componente tangencial: proyectar vel jugador al plano XZ y quitar normal
          const vpx = playerVelRef.current.x
          const vpz = playerVelRef.current.z
          const vDotN = vpx * nx + vpz * nz
          let tx = vpx - vDotN * nx
          let tz = vpz - vDotN * nz
          const tLen = Math.hypot(tx, tz)
          if (tLen > 1e-3) {
            tx /= tLen; tz /= tLen
            const tangImpulse = playerSpeed * TANGENTIAL_PUSH_K
            s.vel.x += tx * tangImpulse
            s.vel.z += tz * tangImpulse
          }
          // limitar velocidad horizontal para estabilidad
          const maxXZ = 6.5
          const xzSpeed = Math.hypot(s.vel.x, s.vel.z)
          if (xzSpeed > maxXZ) {
            const k = maxXZ / xzSpeed
            s.vel.x *= k
            s.vel.z *= k
          }
        }
      }
    }

    // Colisiones entre esferas (billar 2D en XZ): separación + choque elástico
    const arr = orbsRef.current
    const SPHERE_RESTITUTION = 0.7
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i]
        const b = arr[j]
        const dx = a.pos.x - b.pos.x
        const dz = a.pos.z - b.pos.z
        const rSum = a.radius + b.radius
        const dist2 = dx * dx + dz * dz
        if (dist2 <= rSum * rSum) {
          const dist = Math.max(1e-5, Math.sqrt(dist2))
          // Normal 2D
          let nx = dx / dist
          let nz = dz / dist
          // Separación mínima mitad a mitad
          const overlap = rSum - dist
          const half = overlap * 0.5
          a.pos.x += nx * half
          a.pos.z += nz * half
          b.pos.x -= nx * half
          b.pos.z -= nz * half
          // Choque elástico a lo largo de la normal, masas ~ volumen (r^3)
          const m1 = a.radius * a.radius * a.radius
          const m2 = b.radius * b.radius * b.radius
          const rvx = a.vel.x - b.vel.x
          const rvz = a.vel.z - b.vel.z
          const vn = rvx * nx + rvz * nz
          if (vn < 0) {
            const jImpulse = - (1 + SPHERE_RESTITUTION) * vn / (1 / m1 + 1 / m2)
            const jx = jImpulse * nx
            const jz = jImpulse * nz
            a.vel.x += jx / m1
            a.vel.z += jz / m1
            b.vel.x -= jx / m2
            b.vel.z -= jz / m2
            // Limitar velocidad horizontal para estabilidad
            const clamp = (sph) => {
              const maxXZ = 7.2
              const sp = Math.hypot(sph.vel.x, sph.vel.z)
              if (sp > maxXZ) {
                const k = maxXZ / sp
                sph.vel.x *= k
                sph.vel.z *= k
              }
            }
            clamp(a)
            clamp(b)
          }
        }
      }
    }

    // Captura en portales: si esfera está dentro y detenida, puntuar
    if (portals && portals.length) {
      const SPEED_STOP = 0.06
      const portalRad = portalRadius
      for (let i = orbsRef.current.length - 1; i >= 0; i--) {
        const s = orbsRef.current[i]
        if (s.spawnCooldown && s.spawnCooldown > 0) continue
        const speed = s.vel.length()
        if (speed > SPEED_STOP) continue
        // buscar portal más cercano
        let nearest = null
        let bestD2 = Infinity
        for (const p of portals) {
          const dx = s.pos.x - (p.position?.[0] || 0)
          const dz = s.pos.z - (p.position?.[2] || 0)
          const d2 = dx * dx + dz * dz
          if (d2 < bestD2) { bestD2 = d2; nearest = p }
        }
        if (!nearest) continue
        const d = Math.sqrt(bestD2)
        if (d <= Math.max(0.1, portalRad - s.radius * 0.5) && s.pos.y <= (GROUND_Y + s.radius + 0.02)) {
          // Determinar puntos segun tamaño y color
          const isSmall = s.radius <= 0.30
          const correct = (nearest.color || '').toLowerCase() === (s.color || '').toLowerCase()
          const delta = correct ? (isSmall ? 100 : 5) : -20
          try { if (typeof onScoreDelta === 'function') onScoreDelta(delta) } catch {}
          // Popup en portal (más alto y grande con glow)
          const popupText = `${delta > 0 ? '+' : ''}${delta}`
          const popupColor = delta > 0 ? '#10b981' : '#ef4444'
          popupsRef.current.push({ pos: new THREE.Vector3(nearest.position[0], GROUND_Y + 2.6, nearest.position[2]), text: popupText, color: popupColor, ttl: 1.2 })
          // Desintegrar: generar partículas de explosión con color acorde (más sutil)
          {
            const baseCol = new THREE.Color(delta > 0 ? (s.color || '#10b981') : '#ef4444')
            const center = new THREE.Vector3(nearest.position[0], GROUND_Y + s.radius * 0.8, nearest.position[2])
            const COUNT = 40
            for (let k = 0; k < COUNT; k++) {
              const u = Math.random() * 2 - 1
              const phi = Math.random() * Math.PI * 2
              const sqrt1u2 = Math.sqrt(Math.max(0, 1 - u * u))
              const dir = new THREE.Vector3(sqrt1u2 * Math.cos(phi), Math.abs(u), sqrt1u2 * Math.sin(phi))
              const speed = 1.2 + Math.random() * 2.2
              const vel = dir.multiplyScalar(speed)
              partRef.current.push({ pos: center.clone(), vel, life: 0.5 + Math.random() * 0.5, col: baseCol.clone() })
              if (partRef.current.length > PART_CAP) partRef.current.splice(0, partRef.current.length - PART_CAP)
            }
          }
          // Respawn esfera aleatoria en el centro, lejos de portales (mutando el mismo objeto)
          const rng = (min, max) => Math.random() * (max - min) + min
          const colors = (portals && portals.length ? portals.map((p) => p.color) : ['#8ec5ff', '#ff9bf4', '#ffe48a', '#9bffb2'])
          const radius = rng(0.18, 0.55)
          const color = colors[Math.floor(Math.random() * colors.length)]
          // Muestrear posición evitando radios cercanos a portales
          const margin = Math.max(portalRad + 1.8, 3.2)
          let sx = 0, sz = 0, tries = 0
          while (tries < 24) {
            sx = rng(-6, 6)
            sz = rng(-6, 6)
            let ok = true
            for (const p2 of portals) {
              const dx2 = sx - (p2.position?.[0] || 0)
              const dz2 = sz - (p2.position?.[2] || 0)
              if (dx2 * dx2 + dz2 * dz2 < margin * margin) { ok = false; break }
            }
            if (ok) break
            tries++
          }
          const sy = rng(1.6, 3.2)
          // Mutar el mismo objeto para evitar cerrar sobre referencias viejas
          s.pos.set(sx, sy, sz)
          s.vel.set(rng(-0.25, 0.25), 0, rng(-0.25, 0.25))
          s.radius = radius
          s.color = color
          s.spawnCooldown = 0.6
          s.blinkT = 0.6
          s._blinkPhase = 0
          s._visible = true
        }
      }
    }

    // Actualizar popups (ttl)
    for (let i = popupsRef.current.length - 1; i >= 0; i--) {
      popupsRef.current[i].ttl -= dt
      if (popupsRef.current[i].ttl <= 0) popupsRef.current.splice(i, 1)
    }

    // Actualizar partículas de explosión y escribir buffers
    const arrP = partRef.current
    for (let i = arrP.length - 1; i >= 0; i--) {
      const p = arrP[i]
      p.vel.y -= 9.8 * dt * 0.8
      p.vel.x *= 0.996
      p.vel.z *= 0.996
      p.pos.addScaledVector(p.vel, dt)
      p.life -= dt
      if (p.life <= 0) arrP.splice(i, 1)
    }
    const lenP = Math.min(arrP.length, PART_CAP)
    for (let i = 0; i < lenP; i++) {
      const p = arrP[i]
      partPositionsRef.current[i * 3 + 0] = p.pos.x
      partPositionsRef.current[i * 3 + 1] = p.pos.y
      partPositionsRef.current[i * 3 + 2] = p.pos.z
      partColorsRef.current[i * 3 + 0] = p.col.r
      partColorsRef.current[i * 3 + 1] = p.col.g
      partColorsRef.current[i * 3 + 2] = p.col.b
    }
    if (partGeoRef.current) {
      const geo = partGeoRef.current
      if (!geo.getAttribute('position')) {
        geo.setAttribute('position', new THREE.BufferAttribute(partPositionsRef.current, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(partColorsRef.current, 3))
      }
      geo.setDrawRange(0, lenP)
      const pa = geo.getAttribute('position')
      const ca = geo.getAttribute('color')
      if (pa) pa.needsUpdate = true
      if (ca) ca.needsUpdate = true
    }
  })

  return (
    <group ref={(n) => { groupRef.current = n; if (typeof ref === 'function') ref(n); else if (ref) ref.current = n }}>
      {orbsRef.current.map((s, i) => (
        <group key={i} position={[s.pos.x, s.pos.y, s.pos.z]}
          onUpdate={(g) => { g.position.set(s.pos.x, s.pos.y, s.pos.z); g.visible = !!s._visible }}>
          <mesh castShadow={false} receiveShadow={false}
            onUpdate={(m) => {
              try {
                if (m.material) {
                  m.material.color.set(s.color)
                  if (m.material.emissive) m.material.emissive.set(s.color)
                  m.material.needsUpdate = true
                }
                const baseR = m.geometry?.parameters?.radius || 1
                const scale = Math.max(0.01, s.radius / baseR)
                m.scale.setScalar(scale)
              } catch {}
            }}
          >
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial transparent opacity={1} color={s.color} emissive={s.color} emissiveIntensity={1.6} roughness={0.2} metalness={0.0} />
          </mesh>
          <pointLight color={s.color} intensity={2.8} distance={6} decay={1.6} />
        </group>
      ))}
      {/* Popups de puntaje en 3D */}
      {popupsRef.current.map((p, idx) => (
        <group key={`popup-${idx}`} position={[p.pos.x, p.pos.y, p.pos.z]}
          onUpdate={(g) => { g.position.set(p.pos.x, p.pos.y, p.pos.z) }}>
          <Html center style={{ pointerEvents: 'none', color: p.color, fontWeight: 900, fontSize: 56, textShadow: p.color === '#10b981' ? '0 0 10px rgba(16,185,129,0.95), 0 0 26px rgba(16,185,129,0.75)' : '0 0 10px rgba(239,68,68,0.95), 0 0 26px rgba(239,68,68,0.75)' }}>{p.text}</Html>
        </group>
      ))}
      {/* Partículas de desintegración */}
      <points frustumCulled={false}>
        <bufferGeometry ref={partGeoRef} />
        <pointsMaterial size={2} sizeAttenuation color={'#ffffff'} vertexColors depthWrite={false} depthTest blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}
export default forwardRef(HomeOrbsImpl)
