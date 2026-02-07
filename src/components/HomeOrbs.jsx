import React, { useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import scoreStore from '../lib/scoreStore'

/**
 * HomeOrbs — OPTIMIZED
 * Glowing spheres with simple physics (gravity, floor bounce, and push on player collision).
 * 
 * Optimizations applied:
 * 1. Object Pooling — Pre-create Vector3/Color and recycle them (avoid GC spikes)
 * 2. Ring Buffer — Circular indices for particles (avoid splice O(n))
 * 3. Native 3D Sprite — Replace drei Html for popups (less DOM overhead)
 * 4. Pre-allocated arrays — Pre-sized buffers
 */

// ============= GLOBAL CONSTANTS =============
// Reduce particles for better performance
const PART_CAP = 1200
const POPUP_CAP = 8   // Max simultaneous popups
const PARTICLES_PER_EXPLOSION = 24 // Reduced from 32

// ============= OBJECT POOL =============
// Pre-create reusable objects to avoid runtime allocations
const _tempVec3 = new THREE.Vector3()
const _tempVec3_2 = new THREE.Vector3()
const _tempColor = new THREE.Color()
const GROUND_Y = 0.0

// Pre-allocated particle pool (Ring Buffer)
function createParticlePool(capacity) {
  const pool = {
    positions: new Float32Array(capacity * 3),
    velocities: new Float32Array(capacity * 3),
    colors: new Float32Array(capacity * 3),
    lifetimes: new Float32Array(capacity),
    head: 0,      // Index for next particle write
    count: 0,     // Active count
    capacity,
  }
  return pool
}

// Pre-allocated popup pool
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

// ============= MAIN COMPONENT =============
function HomeOrbsImpl({ playerRef, active = true, num = 10, portals = [], portalRadius = 2, onCheatCapture, onBlockedDragAttempt, dragEnabled = true, gameActive = false }, ref) {
  const groupRef = useRef(null)
  const orbsRef = useRef([])
  const orbGroupsRef = useRef([]) // Three.js group refs for imperative visual updates
  const prevPlayerPosRef = useRef(new THREE.Vector3())
  const playerVelRef = useRef(new THREE.Vector3())
  
  // Access renderer for shader precompilation
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  
  // Particle system with Ring Buffer (pre-allocated)
  const particlePoolRef = useRef(null)
  const partGeoRef = useRef()
  
  // Popup system (pre-allocated pool)
  const popupPoolRef = useRef(null)
  const popupMeshesRef = useRef([])
  
  // Refs for materials needing precompilation
  const particleMaterialRef = useRef(null)
  const spriteMaterialsRef = useRef([])
  
  // Refs for imperative popup updates (avoids React re-renders)
  const popupSpritesRef = useRef([])
  const popupMaterialsRef = useRef([])
  
  // Drag state (for cheat easter egg)
  const dragStateRef = useRef({ active: false, sphereIdx: -1 })
  const dragNDCRef = useRef(new THREE.Vector2())
  const _dragRaycaster = useMemo(() => new THREE.Raycaster(), [])
  const _dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const _dragTarget = useMemo(() => new THREE.Vector3(), [])

  // Circular texture for particles
  const circleTexRef = useRef(null)
  
  // Pre-rendered popup textures (cache)
  const popupTexturesRef = useRef(new Map())
  
  // Initialize pools once
  useMemo(() => {
    particlePoolRef.current = createParticlePool(PART_CAP)
    popupPoolRef.current = createPopupPool(POPUP_CAP)
  }, [])
  
  // Flag for prewarm
  const prewarmDoneRef = useRef(false)
  
  // Pre-create textures immediately on mount (before first render)
  // Avoids lag from creating textures on first explosion
  useEffect(() => {
    // Use requestIdleCallback to avoid blocking the main thread
    const doPrewarmTextures = () => {
      // Pre-create circular texture
      ensureCircleTexture()
      
      // Pre-create all possible popup textures
      const popupValues = ['+100', '-100', '+30', '-30', '+5', '-5']
      const popupColors = ['#3b82f6', '#ef4444']
      for (const val of popupValues) {
        for (const col of popupColors) {
          getPopupTexture(val, col)
        }
      }
    }
    
    // requestIdleCallback with setTimeout fallback
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

  // Create popup texture with canvas (cached by text+color)
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
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Glow effect
    ctx.shadowColor = color
    ctx.shadowBlur = 20
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    
    // Text
    ctx.font = 'bold 72px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    
    // Draw multiple times for stronger glow
    for (let i = 0; i < 3; i++) {
      ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    }
    
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    
    // Limit cache to 20 textures
    if (popupTexturesRef.current.size > 20) {
      const firstKey = popupTexturesRef.current.keys().next().value
      const oldTex = popupTexturesRef.current.get(firstKey)
      oldTex.dispose()
      popupTexturesRef.current.delete(firstKey)
    }
    
    popupTexturesRef.current.set(key, tex)
    return tex
  }
  
  // ============= PREWARM — Avoids lag on first explosion =============
  // Pre-creates all textures, uploads buffers to GPU, and compiles shaders before first use
  const prewarm = () => {
    if (prewarmDoneRef.current) return
    prewarmDoneRef.current = true
    
    // 1. Pre-create circular particle texture
    ensureCircleTexture()
    
    // 2. Pre-create all possible popup textures
    const popupValues = ['+100', '-100', '+30', '-30', '+5', '-5']
    const popupColors = ['#3b82f6', '#ef4444']
    for (const val of popupValues) {
      for (const col of popupColors) {
        getPopupTexture(val, col)
      }
    }
    
    // 3. Generate dummy particles off-screen to warm up code
    // This runs addParticles so JIT compiles the code before real use
    addParticles(0, -1000, 0, '#ffffff', 10)
    
    // 4. Briefly activate dummy popup to warm up sprite system
    const popupPool = popupPoolRef.current
    if (popupPool && popupPool.length > 0) {
      const dummyPopup = popupPool[0]
      dummyPopup.active = true
      dummyPopup.x = 0
      dummyPopup.y = -1000 // Off-screen
      dummyPopup.z = 0
      dummyPopup.text = '+100'
      dummyPopup.color = '#3b82f6'
      dummyPopup.ttl = 0.01 // Dies almost immediately
      dummyPopup.opacity = 0 // Invisible
    }
    
    // 4. Precompile material shaders
    // Forces Three.js to compile WebGL programs before first real use
    try {
      if (gl && camera) {
        // Create temp objects for compilation
        const tempScene = new THREE.Scene()
        
        // Compile particle material
        if (particleMaterialRef.current) {
          const tempPoints = new THREE.Points(
            new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, -100, 0], 3)),
            particleMaterialRef.current
          )
          tempScene.add(tempPoints)
        }
        
        // Compile sprite materials
        if (spriteMaterialsRef.current.length > 0) {
          for (const mat of spriteMaterialsRef.current) {
            if (mat) {
              const tempSprite = new THREE.Sprite(mat)
              tempSprite.position.set(0, -100, 0)
              tempScene.add(tempSprite)
            }
          }
        }
        
        // Force compilation by rendering temp scene (nothing visible)
        gl.compile(tempScene, camera)
        
        // Cleanup
        tempScene.clear()
      }
    } catch (e) {
      // Silence precompilation errors — not critical
    }

    // Clear prewarm particles — they served their purpose (JIT warm-up +
    // shader compilation). Resetting gives a clean initial state so the
    // first real explosion behaves identically to every subsequent one.
    const ppPool = particlePoolRef.current
    if (ppPool) {
      for (let i = 0; i < ppPool.capacity; i++) ppPool.lifetimes[i] = 0
      ppPool.head = 0
      ppPool.count = 0
    }
  }

  // Imperative API
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

  // ============= DRAG HANDLING (cheat easter egg) =============
  const handleSpherePointerDown = (e, idx) => {
    if (!dragEnabled) {
      // Drag disabled after cheat penalty — notify parent
      e.stopPropagation()
      try { if (onBlockedDragAttempt) onBlockedDragAttempt() } catch {}
      return
    }
    if (dragStateRef.current.active) return
    e.stopPropagation()
    const s = orbsRef.current[idx]
    if (!s || s._isDragging) return

    dragStateRef.current.active = true
    dragStateRef.current.sphereIdx = idx
    s._isDragging = true
    s.vel.set(0, 0, 0)

    // Set drag plane at sphere's resting height
    _dragPlane.constant = -(GROUND_Y + s.radius)

    // Initialize NDC from the event
    try {
      const rect = gl.domElement.getBoundingClientRect()
      const cx = e.clientX ?? e.nativeEvent?.clientX ?? 0
      const cy = e.clientY ?? e.nativeEvent?.clientY ?? 0
      dragNDCRef.current.x = ((cx - rect.left) / rect.width) * 2 - 1
      dragNDCRef.current.y = -((cy - rect.top) / rect.height) * 2 + 1
    } catch {}
    try { gl.domElement.style.cursor = 'grabbing' } catch {}
  }

  // Window listeners for drag tracking
  useEffect(() => {
    const onMove = (e) => {
      if (!dragStateRef.current.active) return
      try {
        const rect = gl.domElement.getBoundingClientRect()
        dragNDCRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        dragNDCRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      } catch {}
    }
    const onUp = () => {
      if (!dragStateRef.current.active) return
      const idx = dragStateRef.current.sphereIdx
      const s = orbsRef.current[idx]
      if (s) {
        s._isDragging = false
        s._wasDragged = true
        s.vel.set(0, 0, 0)
      }
      dragStateRef.current.active = false
      dragStateRef.current.sphereIdx = -1
      try { gl.domElement.style.cursor = '' } catch {}
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [gl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Force-release drag if dragEnabled becomes false
  useEffect(() => {
    if (!dragEnabled && dragStateRef.current.active) {
      const idx = dragStateRef.current.sphereIdx
      const s = orbsRef.current[idx]
      if (s) {
        s._isDragging = false
        s._wasDragged = false
        s.vel.set(0, 0, 0)
      }
      dragStateRef.current.active = false
      dragStateRef.current.sphereIdx = -1
      try { gl.domElement.style.cursor = '' } catch {}
    }
  }, [dragEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize orbs once
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
        portalDwellTime: 0, // time spent inside a portal capture zone (seconds)
        _isDragging: false, // currently being dragged by user
        _wasDragged: false, // was dragged into a portal (cheat detection)
      })
    }
    orbsRef.current = arr
  }, [num, portals])

  // ============= OPTIMIZED FUNCTIONS =============
  
  // Add particles to ring buffer (without creating new objects)
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
      
      // Uniform spherical direction (inline calculation, no Vector3 creation)
      const u = Math.random() * 2 - 1
      const phi = Math.random() * Math.PI * 2
      const sqrt1u2 = Math.sqrt(Math.max(0, 1 - u * u))
      const dirX = sqrt1u2 * Math.cos(phi)
      const dirY = Math.abs(u)
      const dirZ = sqrt1u2 * Math.sin(phi)
      
      const speed = 1.2 + Math.random() * 2.2
      
      // Write directly to buffers
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
      
      // Advance head (ring buffer)
      pool.head = (pool.head + 1) % pool.capacity
      pool.count = Math.min(pool.count + 1, pool.capacity)
    }
  }
  
  // Add popup to pool (without creating new objects)
  const addPopup = (x, y, z, text, color) => {
    const pool = popupPoolRef.current
    if (!pool) return
    
    // Find inactive slot or oldest
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
    // Prewarm on first frame to avoid lag on first explosion
    if (!prewarmDoneRef.current) prewarm()
    
    try { if (groupRef.current) groupRef.current.userData.orbs = orbsRef.current } catch {}
    if (!active) return
    const dt = THREE.MathUtils.clamp(delta, 1 / 120, 1 / 30)

    // Estimate player velocity
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
      s.portalDwellTime = 0
      s._isDragging = false
      s._wasDragged = false
    }

    // Drag position update (before physics)
    if (dragStateRef.current.active) {
      const dIdx = dragStateRef.current.sphereIdx
      const ds = orbsRef.current[dIdx]
      if (ds) {
        _dragRaycaster.setFromCamera(dragNDCRef.current, camera)
        const hit = _dragRaycaster.ray.intersectPlane(_dragPlane, _dragTarget)
        if (hit) {
          ds.pos.x = _dragTarget.x
          ds.pos.z = _dragTarget.z
          ds.pos.y = GROUND_Y + ds.radius
          ds.vel.set(0, 0, 0)
        }
      }
    }

    // Per-orb integration
    for (const s of orbsRef.current) {
      if (s._isDragging) continue // Skip physics for sphere being dragged
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

    // Sphere-to-sphere collisions
    const arr = orbsRef.current
    const SPHERE_RESTITUTION = 0.7
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i]
        const b = arr[j]
        if (a._isDragging || b._isDragging) continue // Skip dragged sphere
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

    // Portal capture (optimized — no object creation)
    // Uses a dwell timer so sphere-to-sphere micro-bounces inside a portal
    // don't prevent capture indefinitely.
    if (portals && portals.length) {
      const SPEED_STOP = 0.06
      const DWELL_CAPTURE_TIME = 0.3 // seconds inside portal zone before force-capture
      const portalRad = portalRadius
      for (let i = orbsRef.current.length - 1; i >= 0; i--) {
        const s = orbsRef.current[i]
        if (s._isDragging) continue // Skip capture while being dragged
        if (s.spawnCooldown && s.spawnCooldown > 0) continue
        
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
        const inZone = d <= Math.max(0.1, portalRad - s.radius * 0.5) && s.pos.y <= (GROUND_Y + s.radius + 0.02)
        
        if (inZone) {
          s.portalDwellTime = (s.portalDwellTime || 0) + dt
        } else {
          s.portalDwellTime = 0
          continue
        }
        
        const speed = s.vel.length()
        // Capture if: sphere is nearly stopped OR has dwelled long enough
        // (dwell handles the case where sphere-to-sphere collisions keep speed above SPEED_STOP)
        if (speed > SPEED_STOP && s.portalDwellTime < DWELL_CAPTURE_TIME) continue
        
        // Scoring, popups, and cheat detection only when game is active
        if (gameActive) {
          // Three scoring tiers: small (100), medium (30), large (5)
          const correct = (nearest.color || '').toLowerCase() === (s.color || '').toLowerCase()
          const base = s.radius <= 0.28 ? 100 : s.radius <= 0.42 ? 30 : 5
          const delta = correct ? base : -base
          // Use scoreStore directly (no parent re-render)
          scoreStore.add(delta)
          
          // Popup — uses pre-allocated pool
          const popupText = `${delta > 0 ? '+' : ''}${delta}`
          const popupColor = delta > 0 ? '#3b82f6' : '#ef4444'
          addPopup(nearest.position[0], GROUND_Y + 2.6, nearest.position[2], popupText, popupColor)
          
          // Cheat detection: sphere was dragged into portal by user
          if (s._wasDragged) {
            s._wasDragged = false
            try { if (onCheatCapture) onCheatCapture() } catch {}
          }
        } else {
          // Not playing: clear drag flag silently (no cheat penalty)
          s._wasDragged = false
        }

        // Particles — always show explosion (visual feedback even when not playing)
        const explosionColor = gameActive
          ? ((((nearest.color || '').toLowerCase() === (s.color || '').toLowerCase()) ? (s.color || '#10b981') : '#ef4444'))
          : (s.color || '#10b981')
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

    // ============= IMPERATIVE VISUAL SYNC =============
    // Update every orb's Three.js objects directly each frame so the visual
    // always matches the physics data (position, scale, color, visibility).
    // This prevents the desync where a respawned sphere keeps its old visual
    // size while scoring uses the new radius.
    for (let i = 0; i < orbsRef.current.length; i++) {
      const s = orbsRef.current[i]
      const grp = orbGroupsRef.current[i]
      if (!grp) continue
      grp.position.set(s.pos.x, s.pos.y, s.pos.z)
      grp.visible = !!s._visible
      // children[0] = mesh, children[1] = pointLight
      const mesh = grp.children[0]
      if (mesh) {
        mesh.scale.setScalar(Math.max(0.01, s.radius))
        if (mesh.material) {
          _tempColor.set(s.color)
          if (!mesh.material.color.equals(_tempColor)) {
            mesh.material.color.copy(_tempColor)
            if (mesh.material.emissive) mesh.material.emissive.copy(_tempColor)
          }
        }
      }
      const light = grp.children[1]
      if (light) {
        _tempColor.set(s.color)
        if (!light.color.equals(_tempColor)) light.color.copy(_tempColor)
      }
    }

    // Update popups (pre-allocated pool — imperative update, no re-renders)
    const popupPool = popupPoolRef.current
    if (popupPool) {
      for (let i = 0; i < popupPool.length; i++) {
        const p = popupPool[i]
        const sprite = popupSpritesRef.current?.[i]
        const mat = popupMaterialsRef.current?.[i]
        
        if (p.active) {
          p.ttl -= dt
          p.y += dt * 0.8 // Float up gently
          p.opacity = Math.max(0, p.ttl / 1.2)
          
          // Imperative update (no React props)
          if (sprite) {
            sprite.position.set(p.x, p.y, p.z)
            sprite.visible = true
          }
          if (mat) {
            mat.opacity = p.opacity
            // Update texture if changed
            const tex = getPopupTexture(p.text, p.color)
            if (mat.map !== tex) mat.map = tex
          }
          
          if (p.ttl <= 0) {
            p.active = false
            if (sprite) sprite.visible = false
            if (mat) mat.opacity = 0
          }
        } else {
          // Ensure inactive sprites are hidden
          if (sprite && sprite.visible) sprite.visible = false
        }
      }
    }

    // Update particles (ring buffer — full scan)
    // Always scan the entire capacity to guarantee no particle is ever missed,
    // even after the ring buffer head wraps around. 1200 float comparisons per
    // frame is negligible (~0.01ms).
    const pool = particlePoolRef.current
    if (pool && pool.count > 0) {
      const gravity = 9.8 * 0.8
      const drag = 0.996
      const cap = pool.capacity
      
      let activeCount = 0
      for (let i = 0; i < cap; i++) {
        if (pool.lifetimes[i] <= 0) continue
        
        const i3 = i * 3
        
        // Update physics
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
    
    // Update particle geometry (only if particles are active)
    if (partGeoRef.current && pool && pool.count > 0) {
      const geo = partGeoRef.current
      const posArr = geo.attributes.position.array
      const colArr = geo.attributes.color.array
      const cap = pool.capacity
      
      // Compact live particles to first slots of render buffer
      let writeIdx = 0
      for (let i = 0; i < cap && writeIdx < PART_CAP; i++) {
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
      // No particles — hide all
      partGeoRef.current.setDrawRange(0, 0)
    }
  })

  // Particle geometry with pre-allocated buffers
  // Init with 1 off-screen dummy point to force initial GPU upload
  const particleGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(PART_CAP * 3)
    const colors = new Float32Array(PART_CAP * 3)
    // Off-screen dummy point for prewarm
    positions[0] = 0
    positions[1] = -1000
    positions[2] = 0
    colors[0] = 1
    colors[1] = 1
    colors[2] = 1
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setDrawRange(0, 1) // Render 1 dummy point to compile shader
    return geo
  }, [])

  return (
    <group ref={(n) => { groupRef.current = n; if (typeof ref === 'function') ref(n); else if (ref) ref.current = n }}>
      {/* Spheres — visuals updated imperatively in useFrame (see IMPERATIVE VISUAL SYNC) */}
      {orbsRef.current.map((s, i) => (
        <group key={i} ref={(g) => { if (g) orbGroupsRef.current[i] = g }}>
          <mesh
            castShadow={false}
            receiveShadow={false}
            onPointerDown={(e) => handleSpherePointerDown(e, i)}
            onPointerOver={dragEnabled ? () => { try { gl.domElement.style.cursor = 'grab' } catch {} } : undefined}
            onPointerOut={dragEnabled ? () => { try { if (!dragStateRef.current.active) gl.domElement.style.cursor = '' } catch {} } : undefined}
          >
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial transparent opacity={1} color={s.color} emissive={s.color} emissiveIntensity={1.6} roughness={0.2} metalness={0.0} />
          </mesh>
          <pointLight color={s.color} intensity={2.8} distance={6} decay={1.6} />
        </group>
      ))}
      
      {/* Score popups — native 3D sprites (always mounted, controlled imperatively) */}
      {/* Fixed-size array of POPUP_CAP elements to avoid re-renders */}
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
                // Pre-assign default texture to compile shader
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
      
      {/* Disintegration particles */}
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
