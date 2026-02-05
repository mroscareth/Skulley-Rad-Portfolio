import React, { useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import scoreStore from '../lib/scoreStore'

/**
 * HomeOrbs - OPTIMIZADO
 * Esferas luminosas con física simple (gravedad, rebote en piso y empuje por colisión con el personaje).
 * 
 * Optimizaciones aplicadas:
 * 1. Object Pooling - Pre-crea objetos Vector3/Color y los recicla (evita GC spikes)
 * 2. Ring Buffer - Índices circulares para partículas (evita splice O(n))
 * 3. Sprite 3D nativo - Reemplaza Html de drei para popups (menos overhead DOM)
 * 4. Pre-allocated arrays - Buffers pre-dimensionados
 */

// ============= CONSTANTES GLOBALES =============
const PART_CAP = 2000 // Reducido de 3000 - suficiente para el efecto
const POPUP_CAP = 10  // Máximo de popups simultáneos
const PARTICLES_PER_EXPLOSION = 32 // Reducido de 40 - visualmente similar, menos trabajo

// ============= OBJECT POOL =============
// Pre-crear objetos reutilizables para evitar allocations en runtime
const _tempVec3 = new THREE.Vector3()
const _tempVec3_2 = new THREE.Vector3()
const _tempColor = new THREE.Color()

// Pool de partículas pre-allocated (Ring Buffer)
function createParticlePool(capacity) {
  const pool = {
    positions: new Float32Array(capacity * 3),
    velocities: new Float32Array(capacity * 3),
    colors: new Float32Array(capacity * 3),
    lifetimes: new Float32Array(capacity),
    head: 0,      // Índice donde escribir siguiente partícula
    count: 0,     // Cantidad activa
    capacity,
  }
  return pool
}

// Pool de popups pre-allocated
function createPopupPool(capacity) {
  const pool = []
  for (let i = 0; i < capacity; i++) {
    pool.push({
      active: false,
      x: 0, y: 0, z: 0,
      text: '',
      color: '#ffffff',
      ttl: 0,
      opacity: 1,
    })
  }
  return pool
}

// ============= COMPONENTE PRINCIPAL =============
function HomeOrbsImpl({ playerRef, active = true, num = 10, portals = [], portalRadius = 2 }, ref) {
  const groupRef = useRef(null)
  const orbsRef = useRef([])
  const prevPlayerPosRef = useRef(new THREE.Vector3())
  const playerVelRef = useRef(new THREE.Vector3())
  
  // Acceso al renderer para precompilar shaders
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  
  // Sistema de partículas con Ring Buffer (pre-allocated)
  const particlePoolRef = useRef(null)
  const partGeoRef = useRef()
  
  // Sistema de popups (pre-allocated pool)
  const popupPoolRef = useRef(null)
  const popupMeshesRef = useRef([])
  
  // Refs para materiales que necesitan precompilación
  const particleMaterialRef = useRef(null)
  const spriteMaterialsRef = useRef([])
  
  // Refs para actualización imperativa de popups (evita re-renders de React)
  const popupSpritesRef = useRef([])
  const popupMaterialsRef = useRef([])
  
  // Textura circular para partículas
  const circleTexRef = useRef(null)
  
  // Texturas de popup pre-renderizadas (cache)
  const popupTexturesRef = useRef(new Map())
  
  // Inicializar pools una sola vez
  useMemo(() => {
    particlePoolRef.current = createParticlePool(PART_CAP)
    popupPoolRef.current = createPopupPool(POPUP_CAP)
  }, [])
  
  // Flag para prewarm
  const prewarmDoneRef = useRef(false)
  
  // Pre-crear texturas inmediatamente al montar (antes del primer render)
  // Esto evita el lag de crear texturas cuando ocurre la primera explosión
  useEffect(() => {
    // Usar requestIdleCallback para no bloquear el hilo principal
    const doPrewarmTextures = () => {
      // Pre-crear textura circular
      ensureCircleTexture()
      
      // Pre-crear todas las texturas de popup posibles
      const popupValues = ['+100', '-100', '+5', '-5']
      const popupColors = ['#3b82f6', '#ef4444']
      for (const val of popupValues) {
        for (const col of popupColors) {
          getPopupTexture(val, col)
        }
      }
    }
    
    // requestIdleCallback con fallback a setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(doPrewarmTextures, { timeout: 100 })
    } else {
      setTimeout(doPrewarmTextures, 0)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ensureCircleTexture = () => {
    if (circleTexRef.current) return circleTexRef.current
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    const grd = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.6, 'rgba(255,255,255,0.6)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    circleTexRef.current = tex
    return tex
  }

  // Crear textura de popup con canvas (cacheada por texto+color)
  const getPopupTexture = (text, color) => {
    const key = `${text}_${color}`
    if (popupTexturesRef.current.has(key)) {
      return popupTexturesRef.current.get(key)
    }
    
    const canvas = document.createElement('canvas')
    const size = 256
    canvas.width = size
    canvas.height = size / 2
    const ctx = canvas.getContext('2d')
    
    // Limpiar
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Glow effect
    ctx.shadowColor = color
    ctx.shadowBlur = 20
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    
    // Texto
    ctx.font = 'bold 72px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    
    // Dibujar múltiples veces para glow más intenso
    for (let i = 0; i < 3; i++) {
      ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    }
    
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    
    // Limitar cache a 20 texturas
    if (popupTexturesRef.current.size > 20) {
      const firstKey = popupTexturesRef.current.keys().next().value
      const oldTex = popupTexturesRef.current.get(firstKey)
      oldTex.dispose()
      popupTexturesRef.current.delete(firstKey)
    }
    
    popupTexturesRef.current.set(key, tex)
    return tex
  }
  
  // ============= PREWARM - Evita lag en la primera explosión =============
  // Pre-crea todas las texturas, sube buffers al GPU y compila shaders antes del primer uso
  const prewarm = () => {
    if (prewarmDoneRef.current) return
    prewarmDoneRef.current = true
    
    // 1. Pre-crear textura circular de partículas
    ensureCircleTexture()
    
    // 2. Pre-crear todas las texturas de popup posibles
    const popupValues = ['+100', '-100', '+5', '-5']
    const popupColors = ['#3b82f6', '#ef4444']
    for (const val of popupValues) {
      for (const col of popupColors) {
        getPopupTexture(val, col)
      }
    }
    
    // 3. Generar partículas dummy fuera de vista para calentar el código
    // Esto ejecuta addParticles para que el JIT compile el código antes del primer uso real
    addParticles(0, -1000, 0, '#ffffff', 10)
    
    // 4. Activar popup dummy brevemente para calentar el sistema de sprites
    const popupPool = popupPoolRef.current
    if (popupPool && popupPool.length > 0) {
      const dummyPopup = popupPool[0]
      dummyPopup.active = true
      dummyPopup.x = 0
      dummyPopup.y = -1000 // Fuera de vista
      dummyPopup.z = 0
      dummyPopup.text = '+100'
      dummyPopup.color = '#3b82f6'
      dummyPopup.ttl = 0.01 // Muere casi inmediatamente
      dummyPopup.opacity = 0 // Invisible
    }
    
    // 4. Precompilar shaders de materiales
    // Esto fuerza a Three.js a compilar los programas WebGL antes del primer uso real
    try {
      if (gl && camera) {
        // Crear objetos temporales para compilar
        const tempScene = new THREE.Scene()
        
        // Compilar material de partículas
        if (particleMaterialRef.current) {
          const tempPoints = new THREE.Points(
            new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, -100, 0], 3)),
            particleMaterialRef.current
          )
          tempScene.add(tempPoints)
        }
        
        // Compilar material de sprites
        if (spriteMaterialsRef.current.length > 0) {
          for (const mat of spriteMaterialsRef.current) {
            if (mat) {
              const tempSprite = new THREE.Sprite(mat)
              tempSprite.position.set(0, -100, 0)
              tempScene.add(tempSprite)
            }
          }
        }
        
        // Forzar compilación renderizando la escena temporal (sin mostrar nada visible)
        gl.compile(tempScene, camera)
        
        // Limpiar
        tempScene.clear()
      }
    } catch (e) {
      // Silenciar errores de precompilación - no son críticos
    }
  }

  // API imperativa
  useImperativeHandle(ref, () => ({
    radialImpulse(center, strength = 6, radius = 4) {
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
          const sizeBoost = (s.radius <= 0.30) ? 2.0 : 1.0
          const impulse = strength * falloff * sizeBoost
          s.vel.x += nx * impulse
          s.vel.z += nz * impulse
          s.vel.y += impulse * 0.4
        }
      }
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

  // ============= FUNCIONES OPTIMIZADAS =============
  
  // Agregar partículas al ring buffer (SIN crear objetos nuevos)
  const addParticles = (centerX, centerY, centerZ, colorHex, count) => {
    const pool = particlePoolRef.current
    if (!pool) return
    
    _tempColor.set(colorHex)
    const r = _tempColor.r
    const g = _tempColor.g
    const b = _tempColor.b
    
    for (let k = 0; k < count; k++) {
      const idx = pool.head
      const i3 = idx * 3
      
      // Dirección esférica uniforme (cálculo inline, sin crear Vector3)
      const u = Math.random() * 2 - 1
      const phi = Math.random() * Math.PI * 2
      const sqrt1u2 = Math.sqrt(Math.max(0, 1 - u * u))
      const dirX = sqrt1u2 * Math.cos(phi)
      const dirY = Math.abs(u)
      const dirZ = sqrt1u2 * Math.sin(phi)
      
      const speed = 1.2 + Math.random() * 2.2
      
      // Escribir directamente en los buffers
      pool.positions[i3] = centerX
      pool.positions[i3 + 1] = centerY
      pool.positions[i3 + 2] = centerZ
      
      pool.velocities[i3] = dirX * speed
      pool.velocities[i3 + 1] = dirY * speed
      pool.velocities[i3 + 2] = dirZ * speed
      
      pool.colors[i3] = r
      pool.colors[i3 + 1] = g
      pool.colors[i3 + 2] = b
      
      pool.lifetimes[idx] = 0.5 + Math.random() * 0.5
      
      // Avanzar head (ring buffer)
      pool.head = (pool.head + 1) % pool.capacity
      pool.count = Math.min(pool.count + 1, pool.capacity)
    }
  }
  
  // Agregar popup al pool (SIN crear objetos nuevos)
  const addPopup = (x, y, z, text, color) => {
    const pool = popupPoolRef.current
    if (!pool) return
    
    // Buscar slot inactivo o el más antiguo
    let slot = null
    let oldestIdx = 0
    let minTtl = Infinity
    
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].active) {
        slot = pool[i]
        break
      }
      if (pool[i].ttl < minTtl) {
        minTtl = pool[i].ttl
        oldestIdx = i
      }
    }
    
    if (!slot) slot = pool[oldestIdx]
    
    slot.active = true
    slot.x = x
    slot.y = y
    slot.z = z
    slot.text = text
    slot.color = color
    slot.ttl = 1.2
    slot.opacity = 1
  }

  useFrame((state, delta) => {
    // Prewarm en el primer frame para evitar lag en la primera explosión
    if (!prewarmDoneRef.current) prewarm()
    
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
    const FRICTION = 0.98
    const AIR_DRAG = 0.999
    const ROLLING_DRAG = 0.996
    const PLAYER_RADIUS = 0.45
    const IMPULSE_BASE = 1.2
    const PLAYER_PUSH_K = 0.25
    const TANGENTIAL_PUSH_K = 0.6
    const MAX_CENTER_DIST = 55.0
    const rng = (min, max) => Math.random() * (max - min) + min
    const colors = (portals && portals.length ? portals.map((p) => p.color) : ['#8ec5ff', '#ff9bf4', '#ffe48a', '#9bffb2'])
    
    const respawnAtCenter = (s) => {
      const j = 0.35
      const y = rng(1.6, 3.2)
      s.pos.set(rng(-j, j), y, rng(-j, j))
      s.vel.set(rng(-0.25, 0.25), 0, rng(-0.25, 0.25))
      s.radius = rng(0.18, 0.55)
      s.color = colors[Math.floor(Math.random() * colors.length)]
      s.spawnCooldown = 0.6
      s.blinkT = 0.6
      s._blinkPhase = 0
      s._visible = true
    }

    // Integración por orb
    for (const s of orbsRef.current) {
      s.vel.y -= GRAVITY * dt
      s.pos.addScaledVector(s.vel, dt)
      if (s.spawnCooldown && s.spawnCooldown > 0) s.spawnCooldown = Math.max(0, s.spawnCooldown - dt)
      
      if (s.blinkT && s.blinkT > 0) {
        s.blinkT = Math.max(0, s.blinkT - dt)
        s._blinkPhase = (s._blinkPhase || 0) + dt
        const period = 0.12
        s._visible = Math.floor((s._blinkPhase / period)) % 2 === 0
      } else {
        s._visible = true
      }

      const floorY = GROUND_Y + s.radius
      if (s.pos.y < floorY) {
        s.pos.y = floorY
        s.vel.y = Math.abs(s.vel.y) * RESTITUTION
        s.vel.x *= FRICTION
        s.vel.z *= FRICTION
      }

      if (s.pos.y <= floorY + 1e-3) {
        s.vel.x *= ROLLING_DRAG
        s.vel.z *= ROLLING_DRAG
      } else {
        s.vel.x *= AIR_DRAG
        s.vel.z *= AIR_DRAG
      }

      const dCenter2 = s.pos.x * s.pos.x + s.pos.z * s.pos.z
      if (dCenter2 > MAX_CENTER_DIST * MAX_CENTER_DIST) {
        respawnAtCenter(s)
        continue
      }

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
          const pen = minDist - dist
          s.pos.x += nx * pen
          s.pos.z += nz * pen
          const playerSpeed = Math.min(playerVelRef.current.length(), 8)
          const playerPush = THREE.MathUtils.clamp(playerSpeed * PLAYER_PUSH_K, 0, 2.0)
          const impulseBase = (IMPULSE_BASE + playerPush) * THREE.MathUtils.clamp(0.6 + (0.5 / Math.max(0.18, s.radius)), 0.6, 3.0)
          const sizeBoost = (s.radius <= 0.30) ? 2.0 : 1.0
          const impulse = impulseBase * sizeBoost
          s.vel.x += nx * impulse
          s.vel.z += nz * impulse
          const vpx = playerVelRef.current.x
          const vpz = playerVelRef.current.z
          const vDotN = vpx * nx + vpz * nz
          let tx = vpx - vDotN * nx
          let tz = vpz - vDotN * nz
          const tLen = Math.hypot(tx, tz)
          if (tLen > 1e-3) {
            tx /= tLen; tz /= tLen
            const tangImpulse = playerSpeed * TANGENTIAL_PUSH_K * sizeBoost
            s.vel.x += tx * tangImpulse
            s.vel.z += tz * tangImpulse
          }
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

    // Colisiones entre esferas
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
          let nx = dx / dist
          let nz = dz / dist
          const overlap = rSum - dist
          const half = overlap * 0.5
          a.pos.x += nx * half
          a.pos.z += nz * half
          b.pos.x -= nx * half
          b.pos.z -= nz * half
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

    // Captura en portales (OPTIMIZADO - sin crear objetos)
    if (portals && portals.length) {
      const SPEED_STOP = 0.06
      const portalRad = portalRadius
      for (let i = orbsRef.current.length - 1; i >= 0; i--) {
        const s = orbsRef.current[i]
        if (s.spawnCooldown && s.spawnCooldown > 0) continue
        const speed = s.vel.length()
        if (speed > SPEED_STOP) continue
        
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
          const isSmall = s.radius <= 0.30
          const correct = (nearest.color || '').toLowerCase() === (s.color || '').toLowerCase()
          const base = isSmall ? 100 : 5
          const delta = correct ? base : -base
          // Usar scoreStore directamente (no causa re-render del padre)
          scoreStore.add(delta)
          
          // Popup OPTIMIZADO - usa pool pre-allocated
          const popupText = `${delta > 0 ? '+' : ''}${delta}`
          const popupColor = delta > 0 ? '#3b82f6' : '#ef4444'
          addPopup(nearest.position[0], GROUND_Y + 2.6, nearest.position[2], popupText, popupColor)
          
          // Partículas OPTIMIZADO - escribe directo al ring buffer
          const explosionColor = delta > 0 ? (s.color || '#10b981') : '#ef4444'
          addParticles(
            nearest.position[0],
            GROUND_Y + s.radius * 0.8,
            nearest.position[2],
            explosionColor,
            PARTICLES_PER_EXPLOSION
          )
          
          respawnAtCenter(s)
        }
      }
    }

    // Actualizar popups (pool pre-allocated - actualización IMPERATIVA sin re-renders)
    const popupPool = popupPoolRef.current
    if (popupPool) {
      for (let i = 0; i < popupPool.length; i++) {
        const p = popupPool[i]
        const sprite = popupSpritesRef.current?.[i]
        const mat = popupMaterialsRef.current?.[i]
        
        if (p.active) {
          p.ttl -= dt
          p.y += dt * 0.8 // Subir suavemente
          p.opacity = Math.max(0, p.ttl / 1.2)
          
          // Actualización IMPERATIVA (sin props de React)
          if (sprite) {
            sprite.position.set(p.x, p.y, p.z)
            sprite.visible = true
          }
          if (mat) {
            mat.opacity = p.opacity
            // Actualizar textura si cambió
            const tex = getPopupTexture(p.text, p.color)
            if (mat.map !== tex) mat.map = tex
          }
          
          if (p.ttl <= 0) {
            p.active = false
            if (sprite) sprite.visible = false
            if (mat) mat.opacity = 0
          }
        } else {
          // Asegurar que sprites inactivos estén ocultos
          if (sprite && sprite.visible) sprite.visible = false
        }
      }
    }

    // Actualizar partículas (ring buffer - sin splice)
    const pool = particlePoolRef.current
    if (pool && pool.count > 0) {
      const gravity = 9.8 * 0.8
      const drag = 0.996
      
      let activeCount = 0
      // Solo iterar hasta head (donde hemos escrito) para evitar recorrer slots vacíos
      const scanLimit = Math.min(pool.head + pool.count + PARTICLES_PER_EXPLOSION, pool.capacity)
      for (let i = 0; i < scanLimit; i++) {
        if (pool.lifetimes[i] <= 0) continue
        
        const i3 = i * 3
        
        // Actualizar física
        pool.velocities[i3 + 1] -= gravity * dt
        pool.velocities[i3] *= drag
        pool.velocities[i3 + 2] *= drag
        
        pool.positions[i3] += pool.velocities[i3] * dt
        pool.positions[i3 + 1] += pool.velocities[i3 + 1] * dt
        pool.positions[i3 + 2] += pool.velocities[i3 + 2] * dt
        
        pool.lifetimes[i] -= dt
        
        if (pool.lifetimes[i] > 0) activeCount++
      }
      pool.count = activeCount
    }
    
    // Actualizar geometría de partículas (solo si hay partículas activas)
    if (partGeoRef.current && pool && pool.count > 0) {
      const geo = partGeoRef.current
      const posArr = geo.attributes.position.array
      const colArr = geo.attributes.color.array
      
      // Compactar partículas vivas a los primeros slots del buffer de renderizado
      let writeIdx = 0
      const scanLimit = Math.min(pool.head + pool.count + PARTICLES_PER_EXPLOSION, pool.capacity)
      for (let i = 0; i < scanLimit && writeIdx < PART_CAP; i++) {
        if (pool.lifetimes[i] <= 0) continue
        
        const i3 = i * 3
        const w3 = writeIdx * 3
        
        posArr[w3] = pool.positions[i3]
        posArr[w3 + 1] = pool.positions[i3 + 1]
        posArr[w3 + 2] = pool.positions[i3 + 2]
        
        colArr[w3] = pool.colors[i3]
        colArr[w3 + 1] = pool.colors[i3 + 1]
        colArr[w3 + 2] = pool.colors[i3 + 2]
        
        writeIdx++
      }
      
      geo.setDrawRange(0, writeIdx)
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
    } else if (partGeoRef.current) {
      // No hay partículas - ocultar todo
      partGeoRef.current.setDrawRange(0, 0)
    }
  })

  // Geometría de partículas con buffers pre-allocated
  // Inicializamos con 1 punto dummy fuera de vista para forzar upload inicial al GPU
  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(PART_CAP * 3)
    const colors = new Float32Array(PART_CAP * 3)
    // Punto dummy fuera de vista para prewarm
    positions[0] = 0
    positions[1] = -1000
    positions[2] = 0
    colors[0] = 1
    colors[1] = 1
    colors[2] = 1
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setDrawRange(0, 1) // Renderizar 1 punto dummy para compilar shader
    return geo
  }, [])

  return (
    <group ref={(n) => { groupRef.current = n; if (typeof ref === 'function') ref(n); else if (ref) ref.current = n }}>
      {/* Esferas */}
      {orbsRef.current.map((s, i) => (
        <group key={i} position={[s.pos.x, s.pos.y, s.pos.z]}
          onUpdate={(g) => { g.position.set(s.pos.x, s.pos.y, s.pos.z); g.visible = !!s._visible }}>
          <mesh castShadow={false} receiveShadow={false}
            onUpdate={(m) => {
              try {
                if (m.material) {
                  // Solo actualizar color si cambió (usa _tempColor para evitar allocations)
                  _tempColor.set(s.color)
                  if (!m.material.color.equals(_tempColor)) {
                    m.material.color.copy(_tempColor)
                    if (m.material.emissive) m.material.emissive.copy(_tempColor)
                  }
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
      
      {/* Popups de puntaje - Sprites 3D nativos (siempre montados, todo controlado imperativamente) */}
      {/* Usamos un array fijo de POPUP_CAP elementos para evitar re-renders */}
      {Array.from({ length: POPUP_CAP }).map((_, idx) => (
        <sprite
          key={`popup-${idx}`}
          ref={(sprite) => {
            if (sprite) {
              if (!popupSpritesRef.current) popupSpritesRef.current = []
              popupSpritesRef.current[idx] = sprite
            }
          }}
          position={[0, -1000, 0]}
          scale={[2.5, 1.25, 1]}
          visible={false}
          renderOrder={100}
        >
          <spriteMaterial
            ref={(mat) => {
              if (mat) {
                if (!popupMaterialsRef.current) popupMaterialsRef.current = []
                popupMaterialsRef.current[idx] = mat
                // Pre-asignar textura default para compilar shader
                if (!mat.map) mat.map = getPopupTexture('+100', '#3b82f6')
              }
            }}
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      ))}
      
      {/* Partículas de desintegración */}
      <points frustumCulled={false} renderOrder={40}>
        <primitive object={particleGeometry} ref={partGeoRef} />
        <pointsMaterial
          ref={(mat) => { particleMaterialRef.current = mat }}
          size={5}
          sizeAttenuation
          color={'#e6f0ff'}
          vertexColors
          transparent
          opacity={0.22}
          depthWrite={false}
          depthTest={true}
          blending={THREE.NormalBlending}
          map={ensureCircleTexture()}
          alphaMap={ensureCircleTexture()}
        />
      </points>
    </group>
  )
}

export default forwardRef(HomeOrbsImpl)
