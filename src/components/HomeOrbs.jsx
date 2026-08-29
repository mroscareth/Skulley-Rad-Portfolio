import React, { useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import scoreStore from '../lib/scoreStore'
import makeHullOutline from '../lib/makeHullOutline'
import { applyToonBanding } from '../lib/toonBanding'
import { applyNeonOrb } from '../lib/applyNeonOrb'
import AntimatterOrbAura from './AntimatterOrbAura'
import RuneBurstParticles from './fx/RuneBurstParticles.jsx'
import { playSfx } from '../lib/sfx.js'

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
// Particle caps — overridden per instance via isMobile prop
const PART_CAP_DESKTOP = 1200
const PART_CAP_MOBILE = 300
const POPUP_CAP = 8   // Max simultaneous popups
const PARTICLES_PER_EXPLOSION_DESKTOP = 24
const PARTICLES_PER_EXPLOSION_MOBILE = 8

// Color de la esfera PURIFICADA — la antimatter después de ser entregada a
// section6. Persiste eternamente con este color para seguir invocando rayos.
// Púrpura arcano, distinto del magenta (#e600ff) de quests y del rojo
// (#ff2200) original de antimatter.
const PURIFIED_COLOR = '#a855f7'

// Ventana "user-active" sobre la cursed: cuando el user la arrastra o la
// empuja con su cuerpo, este timestamp se refresca. Mientras estemos dentro
// de esta ventana, CUALQUIER contacto cursed→otra orb taint a la otra.
// Después de la ventana, los toques son "puramente autónomos" (movimiento
// natural sin intervención reciente) y no taintean.
const CURSED_USER_ACTIVE_WINDOW_S = 5.0

// Ventana de "tainted by cursed": cuánto persiste la marca sobre una orb
// después de que la cursed la tocó. Si entra a un portal durante este
// tiempo → cheat penalty. Después se olvida.
const TAINT_WINDOW_S = 4.0

// ===== THUNDER EASTER EGG (comer cursed orb → invocar rayo) =====
// Cooldown desde el CAST (no desde comer): mientras corre, el cursed orb
// permanece oculto y reaparece al expirar. Persistente en localStorage para
// que un refresh no resetee el abuso-guard.
const THUNDER_COOLDOWN_MS = 5 * 60 * 1000
const THUNDER_CD_KEY = 'skulley_thunder_cd_until'
// Guard anti-doble-disparo: el mismo click que confirma "Sí" no debe castear.
const THUNDER_ARM_GUARD_MS = 320

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
function HomeOrbsImpl({ playerRef, active = true, num = 10, portals = [], portalRadius = 2, onCheatCapture, onBlockedDragAttempt, onOfferingDelivered, section6Unlocked = false, dragEnabled = true, gameActive = false, isMobile = false }, ref) {
  // Resolve mobile-aware caps once
  const PART_CAP = isMobile ? PART_CAP_MOBILE : PART_CAP_DESKTOP
  const PARTICLES_PER_EXPLOSION = isMobile ? PARTICLES_PER_EXPLOSION_MOBILE : PARTICLES_PER_EXPLOSION_DESKTOP
  const groupRef = useRef(null)
  const orbsRef = useRef([])
  const orbGroupsRef = useRef([]) // Three.js group refs for imperative visual updates
  const orbAurasRef = useRef([]) // Refs al AntimatterOrbAura por orb — setVisible/setRadius/setColor
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

  // Throw physics: ring buffer of recent drag positions for velocity calculation
  const DRAG_HISTORY_SIZE = 6
  const dragHistoryRef = useRef([]) // Array of { x, z, t } samples

  // ===== Thunder easter egg state (refs → sin re-renders) =====
  const thunderArmedRef = useRef(false)     // esperando el click de cast
  const thunderEatenRef = useRef(false)     // orb comido, oculto hasta castear
  const thunderCdUntilRef = useRef(0)       // Date.now() ms fin del cooldown
  // Espejo de gameActive siempre fresco (evita closures stale en castThunder /
  // listeners). En MODO LIBRE (!gameActive) la esfera corrupta no tiene cooldown
  // → reaparece de inmediato para reintentar el unlock de Oil rápido.
  const gameActiveRef = useRef(gameActive)
  gameActiveRef.current = gameActive
  const thunderArmedAtRef = useRef(0)       // performance.now() al armar (guard)
  const pendingEatIdxRef = useRef(-1)       // idx del orb ofrecido para comer
  const reticleRef = useRef(null)           // grupo 3D del target en el piso
  const reticleNDCRef = useRef(new THREE.Vector2())
  const runeBurstRef = useRef(null)         // trigger imperativo de runas
  const _groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

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
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
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
    // Patada del personaje: impulso DIRECCIONAL (no radial) dentro de un cono
    // al frente del pie. Devuelve las esferas conectadas (con su posición y
    // fuerza) para que Player dispare chispas y SFX en el punto de contacto.
    //
    // `skip` es el Set de esferas ya golpeadas en esta misma patada: el golpe
    // se evalúa durante una VENTANA de varios frames siguiendo al pie, no en
    // un único instante, así que hay que evitar pegarle dos veces a la misma.
    kickImpulse(center, dir, strength = 11, radius = 1.5, skip = null, base = null, halfAngle = 1.31) {
      const arr = orbsRef.current || []
      const hits = []
      for (const s of arr) {
        if (!s || s._isDragging || s._thunderHidden) continue
        if (skip && skip.has(s)) continue
        // ÁREA DE GOLPE = EXACTAMENTE EL ABANICO QUE SE DIBUJA.
        // El sector se mide desde el CUERPO (igual que el indicador), no
        // desde el pie: el pie se levanta y se adelanta durante la patada, y
        // usarlo como centro hacía que el área real no coincidiera con la
        // retícula. Lo que está dentro del abanico se patea; lo de fuera, no.
        const bx = base ? base.x : center.x
        const bz = base ? base.z : center.z
        const fx = s.pos.x - bx
        const fz = s.pos.z - bz
        const d = Math.hypot(fx, fz)
        // Radio: cuenta el BORDE de la esfera, no su centro. Si la esfera toca
        // el abanico, se patea (una esfera grande asomando al borde debe
        // contar; con el centro solo, las grandes se libraban).
        if (d - s.radius > radius) continue
        // Altura: el abanico es plano, pero las esferas flotan. El margen se
        // escala con el radio por el mismo motivo.
        const dy = s.pos.y - center.y
        if (dy > 1.25 + s.radius || dy < -1.35 - s.radius) continue
        // Ángulo: se compara contra el semiángulo del sector dibujado,
        // ensanchado por el ángulo que la propia esfera subtiende.
        let nx = 1
        let nz = 0
        if (d > 1e-4) { nx = fx / d; nz = fz / d }
        const facing = nx * dir.x + nz * dir.z
        if (d > s.radius) {
          const ang = Math.acos(Math.max(-1, Math.min(1, facing)))
          const angRadius = Math.asin(Math.max(0, Math.min(1, s.radius / d)))
          if (ang - angRadius > halfAngle) continue
        }
        // (si d <= s.radius la esfera envuelve al personaje: siempre golpea)
        // Dirección de salida: manda la RADIAL cuerpo→esfera, como en un
        // impacto real (el impulso viaja por la normal de contacto). Una
        // esfera tendida a un lado del abanico sale hacia ESE lado, no al
        // frente — con la mezcla al revés todas salían casi en paralelo, como
        // sobre rieles. Queda un sesgo hacia el frente del pie para que el
        // golpe se siga leyendo como patada y no como explosión radial.
        // Muy pegado al cuerpo la radial es ruido puro, así que ahí el frente
        // recupera el mando.
        const radialW = 0.85 * Math.min(1, d / 0.6)
        let ox = nx * radialW + dir.x * (1 - radialW)
        let oz = nz * radialW + dir.z * (1 - radialW)
        const ol = Math.max(1e-4, Math.hypot(ox, oz))
        ox /= ol; oz /= ol
        // Fuerza por CENTRADO del golpe (de lleno pega más que de refilón) y
        // por cercanía dentro del abanico (el borde pega menos que el centro).
        const centerHit = 0.55 + 0.45 * Math.max(0, facing)
        const near = 0.6 + 0.4 * Math.max(0, 1 - d / Math.max(1e-4, radius))
        const sizeBoost = (s.radius <= 0.30) ? 1.9 : (s.radius >= 0.5 ? 0.72 : 1.0)
        const imp = strength * centerHit * near * sizeBoost
        s.vel.x += ox * imp
        s.vel.z += oz * imp
        // Loft: se eleva un poco — se lee como patada, no como empujón raso.
        s.vel.y += imp * (s.radius <= 0.30 ? 0.5 : 0.34)
        // Marca de "golpeada por el jugador": el mismo sello que usa el
        // shockwave del rayo, así el unlock de Oil cuenta las pateadas.
        if (!s._isCursed) s._boltKnockedAt = performance.now()
        if (skip) skip.add(s)
        hits.push({ x: s.pos.x, y: s.pos.y, z: s.pos.z, power: imp / Math.max(1e-4, strength), color: s.color || '' })
      }
      return hits
    },
  }))

  // ============= DRAG HANDLING (cheat easter egg) =============
  const handleSpherePointerDown = (e, idx) => {
    if (!dragEnabled) {
      // Drag disabled after cheat penalty — notify parent
      e.stopPropagation()
      try { if (onBlockedDragAttempt) onBlockedDragAttempt() } catch { }
      return
    }
    if (dragStateRef.current.active) return
    e.stopPropagation()
    const s = orbsRef.current[idx]
    if (!s || s._isDragging || s._thunderHidden) return

    dragStateRef.current.active = true
    dragStateRef.current.sphereIdx = idx
    s._isDragging = true
    // Arrastrar descalifica al orbe del unlock de Oil: ese logro SOLO cuenta
    // esferas empujadas por el shockwave del rayo, no las que metes a mano.
    s._boltKnockedAt = 0
    s.vel.set(0, 0, 0)
    // Bandera global: CameraController la usa para saber que la escena ya está
    // capturando este drag (orb grab) → NO girar la cámara top-down.
    try { window.__r3fSceneDragActive = true } catch { }

    // Clear throw history for fresh tracking
    dragHistoryRef.current.length = 0

    // Drag plane FIJADO al y ACTUAL del orb (no al suelo) — evita el
    // teleport-a-suelo que se sentía como "pelea" al agarrar un orb que iba
    // rebotando. Constant = -y porque el plano es horizontal con normal +Y.
    _dragPlane.constant = -s.pos.y

    // Initialize NDC from the event
    try {
      const rect = gl.domElement.getBoundingClientRect()
      const cx = e.clientX ?? e.nativeEvent?.clientX ?? 0
      const cy = e.clientY ?? e.nativeEvent?.clientY ?? 0
      dragNDCRef.current.x = ((cx - rect.left) / rect.width) * 2 - 1
      dragNDCRef.current.y = -((cy - rect.top) / rect.height) * 2 + 1
    } catch { }
    try { gl.domElement.style.cursor = 'grabbing' } catch { }
  }

  // ============= THUNDER EASTER EGG =============
  // Click derecho sobre el cursed/purified orb → ofrece comerlo. Para orbs
  // normales NO hacemos preventDefault (deja el menú nativo del browser).
  const handleSphereContextMenu = (e, idx) => {
    const s = orbsRef.current[idx]
    if (!s || !s._isCursed || s._thunderHidden) return
    try { e.nativeEvent?.preventDefault?.() } catch { }
    try { e.stopPropagation?.() } catch { }
    if (thunderArmedRef.current) return
    // En cooldown (no debería estar visible, pero por seguridad): avisar y salir.
    if (Date.now() < thunderCdUntilRef.current) {
      try {
        window.dispatchEvent(new CustomEvent('thunder:cooldown', {
          detail: { remMs: thunderCdUntilRef.current - Date.now() },
        }))
      } catch { }
      return
    }
    pendingEatIdxRef.current = idx
    let sx = 0, sy = 0
    try {
      sx = e.clientX ?? e.nativeEvent?.clientX ?? 0
      sy = e.clientY ?? e.nativeEvent?.clientY ?? 0
    } catch { }
    try {
      window.dispatchEvent(new CustomEvent('thunder:offer', {
        detail: { screenX: sx, screenY: sy, color: s.color },
      }))
    } catch { }
  }

  // Lanza 1-3 rayos: el primero al target del cursor, el resto random alrededor.
  const castThunder = () => {
    if (!thunderArmedRef.current) return
    // Proyecta el cursor al plano del suelo (y=0).
    _dragRaycaster.setFromCamera(reticleNDCRef.current, camera)
    if (!_dragRaycaster.ray.intersectPlane(_groundPlane, _dragTarget)) return
    const tx = _dragTarget.x, tz = _dragTarget.z
    const n = 1 + Math.floor(Math.random() * 3) // 1..3
    const points = [{ x: tx, z: tz }]
    for (let k = 1; k < n; k++) {
      const ang = Math.random() * Math.PI * 2
      const rad = 1.5 + Math.random() * 3.0
      points.push({ x: tx + Math.cos(ang) * rad, z: tz + Math.sin(ang) * rad })
    }
    // HomeScene renderiza el pool de LightningBolt en estos puntos.
    try { window.dispatchEvent(new CustomEvent('thunder-strike', { detail: { points } })) } catch { }
    try { playSfx('thunder.mp3', { volume: 1.0 }) } catch { }
    // Flash blanco + camera shake (reusa el pipe del easter egg del bolt).
    try { window.dispatchEvent(new CustomEvent('bolt-strike', { detail: { at: performance.now() } })) } catch { }
    // Impulso físico: revienta orbs cercanos a cada impacto.
    for (const p of points) {
      for (const s of orbsRef.current) {
        if (s._isDragging || s._thunderHidden) continue
        const dx = s.pos.x - p.x
        const dz = s.pos.z - p.z
        const d2 = dx * dx + dz * dz
        const R = 4.0
        if (d2 > R * R || d2 < 1e-4) continue
        const d = Math.sqrt(d2)
        const falloff = 1 - d / R
        s.vel.x += (dx / d) * 7.5 * falloff
        s.vel.z += (dz / d) * 7.5 * falloff
        s.vel.y += 4.0 * falloff
        // Marca: este orbe fue empujado por el rayo. SOLO estos cuentan para el
        // unlock de Oil (esferas que el shockwave mete al portal, no las que
        // arrastras/empujas a mano).
        if (!s._isCursed) s._boltKnockedAt = performance.now()
      }
    }
    // Cooldown desde el cast (persistente). El orb sigue oculto hasta expirar.
    // En modo libre NO hay cooldown → la corrupta reaparece de inmediato.
    if (gameActiveRef.current) {
      const until = Date.now() + THUNDER_COOLDOWN_MS
      thunderCdUntilRef.current = until
      try { localStorage.setItem(THUNDER_CD_KEY, String(until)) } catch { }
    } else {
      thunderCdUntilRef.current = 0
      try { localStorage.removeItem(THUNDER_CD_KEY) } catch { }
    }
    thunderArmedRef.current = false
    thunderEatenRef.current = false // ahora el cooldown gobierna el ocultado
    try { gl.domElement.style.cursor = '' } catch { }
    try { window.dispatchEvent(new CustomEvent('thunder:cast')) } catch { }
  }

  // Restaura cooldown persistido al montar.
  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem(THUNDER_CD_KEY) || '0', 10)
      if (Number.isFinite(v) && v > Date.now()) thunderCdUntilRef.current = v
    } catch { }
  }, [])

  // Burst de runas a pedido (ej. botón Randomize del customizer de color):
  // brota del personaje como un "casteo" de repintado. Reusa el mismo pool.
  useEffect(() => {
    const onBurst = () => {
      try {
        runeBurstRef.current?.fire({
          mode: 'spiral',      // vórtice ascendente tipo portal (no explosión)
          count: 34,           // densidad de columna
          scaleBase: 0.16,     // runas chiquitas
          scaleGrow: 0.10,
          spin: 2.2,           // giro suave del glyph
          radius: 0.5,         // anillo cercano al cuerpo
          radiusGrow: 0.55,    // se abre un poco al subir
          swirl: 1.7,          // giro orbital suave
          rise: 1.9,           // velocidad de ascenso
          riseStart: -1.45,    // empieza cerca de los pies
          spread: 0.75,        // aparición escalonada → flujo continuo
          wobble: 0.14,        // wander lateral orgánico
          life: 2.0,           // flotan más tiempo
        })
      } catch { }
    }
    window.addEventListener('character-color-burst', onBurst)
    return () => window.removeEventListener('character-color-burst', onBurst)
  }, [])

  // Decisión del menú HTML (comer / cancelar / desarmar con ESC).
  useEffect(() => {
    const onEat = () => {
      const s = orbsRef.current[pendingEatIdxRef.current]
      if (!s || !s._isCursed) return
      thunderEatenRef.current = true   // oculta el orb hasta castear
      thunderArmedRef.current = true   // entra a modo apuntado
      thunderArmedAtRef.current = performance.now()
      try { gl.domElement.style.cursor = 'crosshair' } catch { }
      try { if (runeBurstRef.current) runeBurstRef.current.fire() } catch { }
      try { playSfx('magiaInicia', { volume: 0.9 }) } catch { }
      try { window.dispatchEvent(new CustomEvent('thunder:armed')) } catch { }
    }
    const onCancel = () => { pendingEatIdxRef.current = -1 }
    // ESC cancela el cast SIN gastar el rayo → no cooldown, el orb reaparece.
    const onDisarm = () => {
      thunderArmedRef.current = false
      thunderEatenRef.current = false
      try { gl.domElement.style.cursor = '' } catch { }
      try { window.dispatchEvent(new CustomEvent('thunder:cast')) } catch { }
    }
    window.addEventListener('thunder:eat', onEat)
    window.addEventListener('thunder:cancel', onCancel)
    window.addEventListener('thunder:disarm', onDisarm)
    return () => {
      window.removeEventListener('thunder:eat', onEat)
      window.removeEventListener('thunder:cancel', onCancel)
      window.removeEventListener('thunder:disarm', onDisarm)
    }
  }, [gl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tracking del cursor + click de cast + ESC, sólo activo mientras armado.
  useEffect(() => {
    const onMove = (e) => {
      if (!thunderArmedRef.current) return
      try {
        const rect = gl.domElement.getBoundingClientRect()
        reticleNDCRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        reticleNDCRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      } catch { }
    }
    const onClick = (e) => {
      if (!thunderArmedRef.current) return
      // Sólo castea si el click cae en el canvas (no en UI HTML).
      if (e.target !== gl.domElement) return
      // Guard: ignora el mismo click que confirmó "Sí".
      if (performance.now() - thunderArmedAtRef.current < THUNDER_ARM_GUARD_MS) return
      castThunder()
    }
    const onKey = (e) => {
      if (e.key === 'Escape' && thunderArmedRef.current) {
        try { window.dispatchEvent(new CustomEvent('thunder:disarm')) } catch { }
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [gl, camera]) // eslint-disable-line react-hooks/exhaustive-deps

  // Window listeners for drag tracking
  useEffect(() => {
    const onMove = (e) => {
      if (!dragStateRef.current.active) return
      try {
        const rect = gl.domElement.getBoundingClientRect()
        dragNDCRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        dragNDCRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      } catch { }
    }
    const onUp = () => {
      if (!dragStateRef.current.active) return
      const idx = dragStateRef.current.sphereIdx
      const s = orbsRef.current[idx]
      if (s) {
        s._isDragging = false
        s._wasDragged = true

        // Calculate throw velocity from drag position history
        const hist = dragHistoryRef.current
        if (hist.length >= 2) {
          // Use the oldest and newest samples in the buffer for a smooth average
          const oldest = hist[0]
          const newest = hist[hist.length - 1]
          const dtSec = (newest.t - oldest.t) / 1000
          if (dtSec > 0.005) { // Avoid division by near-zero
            const vx = (newest.x - oldest.x) / dtSec
            const vz = (newest.z - oldest.z) / dtSec
            // Scale factor: controls how "strong" the throw feels
            const THROW_SCALE = 0.55
            const MAX_THROW_SPEED = 8.0
            let tvx = vx * THROW_SCALE
            let tvz = vz * THROW_SCALE
            // Clamp magnitude
            const speed = Math.hypot(tvx, tvz)
            if (speed > MAX_THROW_SPEED) {
              const k = MAX_THROW_SPEED / speed
              tvx *= k
              tvz *= k
            }
            // Only apply if there's meaningful velocity (avoids micro-drift)
            if (speed > 0.3) {
              s.vel.set(tvx, 0, tvz)
            } else {
              s.vel.set(0, 0, 0)
            }
          } else {
            s.vel.set(0, 0, 0)
          }
        } else {
          s.vel.set(0, 0, 0)
        }
        dragHistoryRef.current.length = 0
      }
      dragStateRef.current.active = false
      dragStateRef.current.sphereIdx = -1
      try { gl.domElement.style.cursor = '' } catch { }
      try { window.__r3fSceneDragActive = false } catch { }
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
      try { gl.domElement.style.cursor = '' } catch { }
      try { window.__r3fSceneDragActive = false } catch { }
    }
  }, [dragEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ref to section6Unlocked — leído desde closures estables (respawnAtCenter)
  // sin re-crear el componente entero cuando cambia el flag.
  const section6UnlockedRef = useRef(section6Unlocked)
  useEffect(() => { section6UnlockedRef.current = section6Unlocked }, [section6Unlocked])

  // Initialize orbs once
  useMemo(() => {
    const rng = (min, max) => Math.random() * (max - min) + min
    // Pool de colores de orbs = colores de todos los portales. EXCEPTO: si el
    // portal antimateria ya fue desbloqueado en esta sesión, excluimos su
    // color del pool random — pero a UNA esfera le asignamos el PURIFIED_COLOR
    // y _isPurified=true (es la esfera maldita-purificada que persiste para
    // seguir invocando rayos en sesiones futuras).
    let initColors = portals && portals.length ? portals.map((p) => p.color) : ['#8ec5ff', '#ff9bf4', '#ffe48a', '#9bffb2']
    const sec6P0 = portals && portals.find ? portals.find((pp) => pp.id === 'section6') : null
    const sec6Col0 = sec6P0 ? (sec6P0.color || '').toLowerCase() : ''
    if (section6Unlocked && sec6Col0) {
      initColors = initColors.filter((c) => (c || '').toLowerCase() !== sec6Col0)
    }
    const colors = initColors.length ? initColors : ['#8ec5ff']
    // Índice de la esfera que será cursed (antimatter pre-unlock o purified
    // post-unlock). Se asigna SIEMPRE de forma explícita, en los dos casos.
    //
    // Antes solo se forzaba post-unlock y pre-unlock se confiaba en que el
    // round-robin `colors[i % colors.length]` cayera sobre el color de
    // section6. Eso funciona con num=10 (índices 0,1,2,3,4,5,… → el 5 sí sale)
    // pero NO con num=5 (solo llega al 4), así que en cualquier equipo marcado
    // como `isMobilePerf` —incluidos falsos positivos de la heurística de
    // index.html— la esfera corrupta simplemente NO EXISTÍA, y con ella se caía
    // el rayo y el acceso al portal de antimateria.
    // Con num=10 esto es un no-op (el slot 5 ya era ese color); con num=5
    // recupera la esfera.
    const CURSED_SLOT = Math.min(5, num - 1)
    const antimatterColor = sec6P0 ? sec6P0.color : null
    const arr = []
    for (let i = 0; i < num; i++) {
      const radius = rng(0.18, 0.55)
      const x = rng(-6, 6)
      const z = rng(-6, 6)
      const y = rng(1.2, 2.8)
      let color = colors[i % colors.length]
      let isPurifiedInit = false
      // El slot designado es SIEMPRE la esfera maldita: purificada (púrpura)
      // post-unlock, antimatter (color del portal section6) pre-unlock.
      if (i === CURSED_SLOT) {
        if (section6Unlocked) {
          color = PURIFIED_COLOR
          isPurifiedInit = true
        } else if (antimatterColor) {
          color = antimatterColor
        }
      }
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
        _isPurified: isPurifiedInit,
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

    try { if (groupRef.current) groupRef.current.userData.orbs = orbsRef.current } catch { }
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

    // Cache antimatter color UNA vez por frame y tagueamos cada orb. Lo usan
    // el bloque de comportamiento cursed (jitter+kick) y el sync visual.
    // - _isAntimatter: tiene el color literal de section6 (rojo, pre-unlock)
    // - _isPurified: flag persistente que se activa cuando la antimatter es
    //   entregada al portal section6 (post-unlock). Mantiene comportamiento
    //   cursed pero con color púrpura arcano.
    // - _isCursed: union — ambos disparan el aura, jitter, kicks, etc.
    const _sec6Portal = portals && portals.find ? portals.find((pp) => pp.id === 'section6') : null
    const sec6ColLower = _sec6Portal ? (_sec6Portal.color || '').toLowerCase() : ''
    for (const s of orbsRef.current) {
      s._isAntimatter = !!sec6ColLower && (s.color || '').toLowerCase() === sec6ColLower
      s._isCursed = s._isAntimatter || !!s._isPurified
    }

    // DEDUP: solo puede existir UNA esfera maldita en total (antimatter o
    // purified, no ambas; no múltiples del mismo tipo). Si hay duplicados
    // (estado pre-fix, etc.), convertimos las extras a un color random
    // non-section6. Preferimos mantener la PURIFIED si existe (es la
    // canónica post-unlock); si no, la primera antimatter.
    if (sec6ColLower) {
      const _portalCols = portals ? portals.map((p) => p.color) : []
      const nonSpecialPool = _portalCols.filter((c) => (c || '').toLowerCase() !== sec6ColLower)
      if (nonSpecialPool.length) {
        // Identificar la "canónica": primera purified, o primera antimatter.
        let canonical = orbsRef.current.find((s) => s._isPurified) ||
                        orbsRef.current.find((s) => s._isAntimatter) || null
        for (const s of orbsRef.current) {
          if (s === canonical) continue
          if (!s._isCursed) continue
          // Duplicada → reasignar a color non-special y limpiar flags cursed.
          s.color = nonSpecialPool[Math.floor(Math.random() * nonSpecialPool.length)]
          s._isAntimatter = false
          s._isPurified = false
          s._isCursed = false
          // Reset estado cursed para que no quede con timers viejos.
          s._curseState = 'calm'
          s._curseStateT = 0
          s._curseJX = 0; s._curseJY = 0; s._curseJZ = 0
          s._curseFlash = 0
        }
      }
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

    // Color del portal antimateria — lo filtramos del pool cuando está unlocked.
    const sec6Portal0 = portals && portals.find ? portals.find((pp) => pp.id === 'section6') : null
    const sec6ColorCanonical = sec6Portal0 ? (sec6Portal0.color || '').toLowerCase() : ''

    const respawnAtCenter = (s, opts = {}) => {
      const j = 0.35
      const y = rng(1.6, 3.2)
      s.pos.set(rng(-j, j), y, rng(-j, j))
      s.vel.set(rng(-0.25, 0.25), 0, rng(-0.25, 0.25))
      s.radius = rng(0.18, 0.55)
      // Color selection:
      // - Si opts.keepColor (ej. orb rojo rebotando por portal equivocado) →
      //   fuerza ese color para que la "ofrenda" no se pierda en el caos.
      // - El color de section6 (antimateria) SIEMPRE se excluye del pool
      //   random. La esfera maldita es ÚNICA: nace con ese color en el init
      //   round-robin, lo retiene vía keepColor cuando rebota, y al ser
      //   entregada se respawnea como cualquier otro color. Si dejáramos
      //   section6 en el pool random, cada captura tendría 1/6 de probabilidad
      //   de generar otra esfera roja → con el tiempo proliferaban duplicados.
      if (opts.keepColor) {
        s.color = opts.keepColor
      } else {
        let pool = colors
        if (sec6ColorCanonical) {
          pool = colors.filter((c) => (c || '').toLowerCase() !== sec6ColorCanonical)
          if (!pool.length) pool = colors
        }
        s.color = pool[Math.floor(Math.random() * pool.length)]
      }
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
          // Y respeta el plano (fijado en pickup al y actual del orb), pero
          // clamp para no atravesar el piso si el plano por alguna razón está
          // por debajo del ground+radius.
          ds.pos.y = Math.max(_dragTarget.y, GROUND_Y + ds.radius)
          ds.vel.set(0, 0, 0)

          // Si la orb arrastrada es CURSED: refrescar el timestamp de
          // interacción del user. Esto habilita el tainting de otras orbs
          // por contacto durante (y hasta CURSED_USER_ACTIVE_WINDOW_S
          // después de) la sesión de drag.
          if (ds._isCursed) ds._userInteractedAt = state.clock.elapsedTime

          // Record position sample for throw velocity calculation
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
          const hist = dragHistoryRef.current
          hist.push({ x: _dragTarget.x, z: _dragTarget.z, t: now })
          // Keep only the most recent samples
          if (hist.length > DRAG_HISTORY_SIZE) hist.shift()
        }
      }
    }

    // Per-orb integration
    const _thunderNow = Date.now()
    for (const s of orbsRef.current) {
      // Thunder: el cursed orb desaparece tras comerlo y durante el cooldown.
      // Lo congelamos y ocultamos; lo saltamos en colisión/captura vía _thunderHidden.
      // En modo libre el cooldown no aplica (solo el ocultado mientras está comido).
      // Además la ANTIMATERIA pre-unlock NUNCA se oculta por cooldown: es la
      // esfera del tributo a SKULLEYGLYPH y debe estar siempre disponible.
      const onCooldown = !s._isAntimatter && gameActiveRef.current && _thunderNow < thunderCdUntilRef.current
      if (s._isCursed && (thunderEatenRef.current || onCooldown)) {
        s._thunderHidden = true
        s._visible = false
        s.vel.set(0, 0, 0)
        continue
      }
      s._thunderHidden = false
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

      // ── ORB CURSED (antimatter O purified) ────────────────────────────
      // Ciclo en 2 estados: CALMA (mayoría del tiempo, quieto) → TWITCH
      // (~0.5s, vibración intensa creciente) → kick + flash → CALMA. La
      // tensión se "carga" durante el twitch antes de descargar → telegraph
      // claro del poder maldito sin saturar visualmente. El twitch NO toca
      // física (solo offset visual en sync), evita romper colisiones.
      // Aplica a antimatter (pre-unlock, color rojo) y purified (post-unlock,
      // color púrpura) — ambos son "cursed" funcionalmente.
      if (s._isCursed && !s._isDragging) {
        const seed = (s._curseSeed = s._curseSeed || (Math.random() * 100))
        s._curseState = s._curseState || 'calm'
        s._curseStateT = (s._curseStateT || 0) + dt
        // Duraciones inicializadas la primera vez que se entra a cada estado.
        s._curseCalmDur = s._curseCalmDur ?? (2.0 + Math.random() * 1.8) // 2-3.8s quieto
        s._curseTwitchDur = s._curseTwitchDur ?? (0.4 + Math.random() * 0.25) // 0.4-0.65s

        if (s._curseState === 'calm') {
          // Quieto. Sin jitter visual. Espera el siguiente brote.
          s._curseJX = 0; s._curseJY = 0; s._curseJZ = 0
          if (s._curseStateT >= s._curseCalmDur) {
            s._curseState = 'twitch'
            s._curseStateT = 0
            s._curseCalmDur = 4.5 + Math.random() * 4.0
          }
        } else { // 'twitch'
          // Intensidad crece linealmente 0→1 a lo largo del twitch — la
          // vibración acumula tensión, culmina en el kick al final.
          const k = Math.min(1, s._curseStateT / s._curseTwitchDur)
          const jt = state.clock.elapsedTime
          s._curseJX = Math.sin(jt * 47.3 + seed * 1.7) * 0.05 * k
          s._curseJY = Math.sin(jt * 53.1 + seed * 2.3) * 0.035 * k
          s._curseJZ = Math.sin(jt * 61.7 + seed * 3.1) * 0.05 * k
          if (s._curseStateT >= s._curseTwitchDur) {
            // DESCARGA: kick + flash. Forces más bajos que antes (1.0-1.8)
            // Mid-range entre la versión hiperactiva y la quieta.
            const ang = Math.random() * Math.PI * 2
            const force = 1.4 + Math.random() * 1.0
            s.vel.x += Math.cos(ang) * force
            s.vel.z += Math.sin(ang) * force
            s.vel.y += 0.7 + Math.random() * 0.7
            const sp = Math.hypot(s.vel.x, s.vel.z)
            const MAX_CURSE_SPEED = 4.0
            if (sp > MAX_CURSE_SPEED) {
              const kk = MAX_CURSE_SPEED / sp
              s.vel.x *= kk
              s.vel.z *= kk
            }
            s._curseFlash = 0.18
            // Reset — re-roll TANTO calmDur como twitchDur (si no, queda con
            // los valores del primer ciclo y deja de variar entre brotes).
            s._curseState = 'calm'
            s._curseStateT = 0
            s._curseCalmDur = 2.0 + Math.random() * 1.8
            s._curseTwitchDur = 0.4 + Math.random() * 0.25
          }
        }
        if (s._curseFlash && s._curseFlash > 0) s._curseFlash = Math.max(0, s._curseFlash - dt)

        // LEASH: si el orb se aleja >18u del centro, le aplicamos drag
        // tangencial hacia adentro para "recogerlo" suavemente. Mucho menor
        // que un respawn — el player aún lo siente físico. Solo afecta a la
        // velocidad outward, no a la inward (no se atora si quieres llevarlo).
        const LEASH_R = 18
        const distXZ = Math.hypot(s.pos.x, s.pos.z)
        if (distXZ > LEASH_R) {
          const nx = -s.pos.x / distXZ
          const nz = -s.pos.z / distXZ
          // Dot del velocity con el vector hacia centro (positivo = ya va hacia centro).
          const vDotIn = s.vel.x * nx + s.vel.z * nz
          if (vDotIn < 0.5) {
            // Push suave hacia centro proporcional a cuánto se pasó del límite.
            const pull = Math.min(1.5, (distXZ - LEASH_R) * 0.4)
            s.vel.x += nx * pull * dt * 6
            s.vel.z += nz * pull * dt * 6
          }
        }
      }

      // Out-of-bounds: los orbs normales respawnean a 55u del centro. Los
      // ORBS CURSED (antimatter o purified) NO tienen límite — pueden ir a
      // cualquier parte del escenario. Solo respawnean cuando entran a un
      // portal.
      if (!s._isCursed) {
        const dCenter2 = s.pos.x * s.pos.x + s.pos.z * s.pos.z
        if (dCenter2 > MAX_CENTER_DIST * MAX_CENTER_DIST) {
          respawnAtCenter(s)
          continue
        }
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
          // Si la orb golpeada es CURSED: refrescar timestamp de interacción.
          // El user usó su personaje para empujarla → cualquier contacto con
          // otras orbs dentro de los próximos CURSED_USER_ACTIVE_WINDOW_S
          // taintea a esas orbs (cubre el caso "preparo la cursed con el
          // cuerpo y dejo que sus kicks la lleven al target").
          if (s._isCursed) s._userInteractedAt = state.clock.elapsedTime
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
    const tNowFrame = state.clock.elapsedTime
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i]
        const b = arr[j]
        // Orb comido/cooldown: inerte e invisible → ni colisión ni taint.
        if (a._thunderHidden || b._thunderHidden) continue
        const dx = a.pos.x - b.pos.x
        const dz = a.pos.z - b.pos.z
        const rSum = a.radius + b.radius
        const dist2 = dx * dx + dz * dz
        if (dist2 > rSum * rSum) continue

        // === TAINT por contacto con cursed ===
        // Evalúa SIEMPRE en overlap, ANTES del skip de impulse para drag.
        // Esto asegura que aunque el cursed esté siendo arrastrado (skip
        // físico), el contacto con otras orbs se registra como cheat.
        //
        // Regla: si la cursed está "user-active" (currently dragging O
        // dentro de CURSED_USER_ACTIVE_WINDOW_S desde la última interacción
        // del user con ella: drag o body push), CUALQUIER contacto con
        // otras orbs taintea a la otra. Sin threshold de velocidad — basta
        // con tocarse mientras el user la usa o acaba de usarla.
        //
        // Fuera de la ventana user-active (movimiento puramente autónomo
        // sin intervención reciente), los toques NO taintean → la cursed
        // puede vagar libremente sin generar falsos positivos.
        const aCursed = !!a._isCursed
        const bCursed = !!b._isCursed
        if (aCursed && !bCursed) {
          const active = a._isDragging || ((tNowFrame - (a._userInteractedAt || -999)) < CURSED_USER_ACTIVE_WINDOW_S)
          if (active) b._taintedByCursedAt = tNowFrame
        } else if (bCursed && !aCursed) {
          const active = b._isDragging || ((tNowFrame - (b._userInteractedAt || -999)) < CURSED_USER_ACTIVE_WINDOW_S)
          if (active) a._taintedByCursedAt = tNowFrame
        }

        // Skip impulse para orbs arrastrados — preserva la UX del drag
        // (la dragged sigue tracking el pointer sin recibir collision push).
        if (a._isDragging || b._isDragging) continue

        {
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
        if (s._thunderHidden) continue // orb comido/cooldown: no captura ni rayo
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
        const isCursed = s._isCursed
        // La OFRENDA SAGRADA: mientras section6 siga BLOQUEADO, CUALQUIER esfera
        // corrupta (antimateria roja O purificada morada) entregada al portal
        // SKULLEYGLYPH cuenta como tributo. Cubre el caso borde donde una ofrenda
        // previa convirtió la esfera a purified pero el unlock no se guardó (sin
        // esto el usuario quedaba atorado sin esfera roja). Post-unlock, la
        // purified ya NO ofrenda → invoca rayos como siempre.
        const isOffering = isCursed && nearest.id === 'section6' && !section6UnlockedRef.current
        // La ofrenda se captura AL INSTANTE — sin exigir que vaya lenta ni que
        // repose: si la avientas con fuerza igual cuenta el tributo.
        if (!isOffering && speed > SPEED_STOP && s.portalDwellTime < DWELL_CAPTURE_TIME) continue

        // === DETERMINAR CASO ===
        // Rayo: cursed (antimatter o purified) hitting cualquier portal EXCEPTO
        // la ofrenda sagrada. La purified invoca rayos en TODOS los portales.
        const triggerLightning = isCursed && !isOffering

        // === SCORING + DETECCIÓN DE CHEAT ===
        if (gameActive) {
          if (!isCursed) {
            // Three scoring tiers: small (100), medium (30), large (5)
            const correct = (nearest.color || '').toLowerCase() === (s.color || '').toLowerCase()
            const base = s.radius <= 0.28 ? 100 : s.radius <= 0.42 ? 30 : 5
            const delta = correct ? base : -base
            scoreStore.add(delta)

            const popupText = `${delta > 0 ? '+' : ''}${delta}`
            const popupColor = delta > 0 ? '#3b82f6' : '#ef4444'
            addPopup(nearest.position[0], GROUND_Y + 2.6, nearest.position[2], popupText, popupColor)

            // Cheat detection: (1) la esfera fue arrastrada por el user, o
            // (2) fue TAINTED por contacto con la cursed (player usó la
            // cursed como herramienta para empujarla). La ventana TAINT_WINDOW_S
            // perdona contactos viejos para evitar penalties por accidente.
            const tNow = state.clock.elapsedTime
            const tainted = s._taintedByCursedAt && (tNow - s._taintedByCursedAt) < TAINT_WINDOW_S
            if (s._wasDragged || tainted) {
              s._wasDragged = false
              s._taintedByCursedAt = 0
              try { if (onCheatCapture) onCheatCapture() } catch { }
            }
          } else {
            // CURSED: NO da puntos, NO penaliza el drag. Es la única esfera
            // que el user puede mover con la mano libremente — su propósito
            // es invocar al rayo, no scorear.
            s._wasDragged = false
            s._taintedByCursedAt = 0
          }
        } else {
          s._wasDragged = false
          s._taintedByCursedAt = 0
        }

        // === EXPLOSIÓN DE PARTÍCULAS ===
        let explosionColor
        if (isCursed) {
          // Cursed: explota en su propio color (rojo o púrpura) — lectura
          // mística, no scoring.
          explosionColor = s.color || '#10b981'
        } else if (gameActive) {
          const matchColor = (nearest.color || '').toLowerCase() === (s.color || '').toLowerCase()
          explosionColor = matchColor ? (s.color || '#10b981') : '#ef4444'
        } else {
          explosionColor = s.color || '#10b981'
        }
        addParticles(
          nearest.position[0],
          GROUND_Y + s.radius * 0.8,
          nearest.position[2],
          explosionColor,
          PARTICLES_PER_EXPLOSION
        )

        // === OFRENDA / NOTIFICACIÓN AL PADRE ===
        if (isOffering) {
          // OFRENDA SAGRADA: antimatter → section6. Marcamos _isPurified=true
          // ANTES del respawn → el orb persiste con color púrpura por siempre.
          s._isPurified = true
          try {
            if (typeof onOfferingDelivered === 'function' && nearest.id) {
              onOfferingDelivered(nearest.id, s.color)
            }
          } catch {}
        } else if (!isCursed) {
          // Orbs normales matching su portal: notifica al padre (puede ser
          // usado por otras secciones para sus propios unlocks futuros).
          const matchColor = (nearest.color || '').toLowerCase() === (s.color || '').toLowerCase()
          try {
            if (matchColor && typeof onOfferingDelivered === 'function' && nearest.id) {
              onOfferingDelivered(nearest.id, s.color)
            }
          } catch {}
        }

        // Captura de orbe NORMAL (cualquier color) → evento para el unlock de
        // Oil (2 colores distintos al mismo portal). `boltKnocked` indica si la
        // esfera fue empujada por el shockwave del rayo recientemente — Oil SOLO
        // cuenta esas (no las que arrastras/empujas a mano). Corre también en
        // modo libre (no gated por gameActive).
        if (!isCursed && nearest.id) {
          const boltKnocked = !!s._boltKnockedAt && (performance.now() - s._boltKnockedAt) < 6000
          try {
            window.dispatchEvent(new CustomEvent('orb-captured', {
              detail: { portalId: nearest.id, color: s.color || '', boltKnocked },
            }))
          } catch { }
        }

        // === RESPAWN ===
        if (isOffering) {
          // Conversión a purified: respawn con PURIFIED_COLOR fijo.
          respawnAtCenter(s, { keepColor: PURIFIED_COLOR })
        } else if (triggerLightning) {
          // Cursed hitting portal (no-ofrenda): mantiene su color actual
          // (rojo si antimatter, púrpura si purified).
          respawnAtCenter(s, { keepColor: s.color })
        } else {
          respawnAtCenter(s)
        }

        if (triggerLightning) {
          const strikeX = s.pos.x
          const strikeY = s.pos.y
          const strikeZ = s.pos.z
          // Nube de polvo en el PISO donde el rayo impacta — una sola capa
          // blanca sutil, lectura "impacto levantando tierra". Sin rojo.
          addParticles(strikeX, GROUND_Y + 0.15, strikeZ, '#ffffff', PARTICLES_PER_EXPLOSION * 2)

          // Shockwave: empuja a TODOS los otros orbs cercanos hacia afuera.
          // El orb antimatter no se toca (skip `other === s`).
          const blastR = 5.5
          const blastStrength = 15.0
          for (const other of orbsRef.current) {
            if (other === s) continue
            const dx = other.pos.x - strikeX
            const dz = other.pos.z - strikeZ
            const d2 = dx * dx + dz * dz
            if (d2 > blastR * blastR || d2 < 0.0001) continue
            const d = Math.sqrt(d2)
            const nx = dx / d, nz = dz / d
            const falloff = 1.0 - d / blastR
            other.vel.x += nx * blastStrength * falloff
            other.vel.z += nz * blastStrength * falloff
            other.vel.y += 3.5 * falloff
          }

          // Evento global para que la escena renderice el LightningBolt y
          // reproduzca el thunder. Adicionalmente, el `bolt-strike` dispara
          // el flash overlay que ya usa el easter egg → ambos bolts duran
          // exactamente lo mismo visualmente.
          try {
            window.dispatchEvent(new CustomEvent('antimatter-orb-strike', {
              detail: { x: strikeX, y: strikeY, z: strikeZ },
            }))
            window.dispatchEvent(new CustomEvent('bolt-strike', {
              detail: { at: performance.now() },
            }))
          } catch {}
        }
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
      // Cursed: jitter visual (no toca la física para no romper colisiones)
      // y flash de escala al kick. Solo si NO se está arrastrando.
      const cursed = s._isCursed && !s._isDragging
      const jx = cursed ? (s._curseJX || 0) : 0
      const jy = cursed ? (s._curseJY || 0) : 0
      const jz = cursed ? (s._curseJZ || 0) : 0
      grp.position.set(s.pos.x + jx, s.pos.y + jy, s.pos.z + jz)
      grp.visible = !!s._visible
      // children[0] = mesh, children[1] = pointLight, children[2] = hitbox
      const mesh = grp.children[0]
      if (mesh) {
        // Flash de escala — easeOut sobre 0.18s. Boost máx ~1.35x.
        const flashT = cursed && s._curseFlash ? Math.max(0, s._curseFlash) / 0.18 : 0
        const flashBoost = 1.0 + flashT * 0.35
        mesh.scale.setScalar(Math.max(0.01, s.radius * flashBoost))
        if (mesh.material && mesh.material.emissive) {
          // NEÓN: color (diffuse) se mantiene NEGRO permanente — ver material
          // del orb. Solo el emissive cambia al color del orb. Si esto se
          // sincronizara al color de la esfera, el IBL volvería a blanquear.
          _tempColor.set(s.color)
          if (!mesh.material.emissive.equals(_tempColor)) {
            mesh.material.emissive.copy(_tempColor)
          }
        }
      }
      const light = grp.children[1]
      if (light) {
        _tempColor.set(s.color)
        if (!light.color.equals(_tempColor)) light.color.copy(_tempColor)
      }
      // Hitbox (children[2]): scale separado del orb visual.
      // Radio efectivo en mundo = max(s.radius * 1.5, 0.42) → orbs chicos
      // (0.18 radio) reciben hitbox de 0.42 (>2x área para drag fácil).
      // Orbs grandes (0.55) reciben 0.825 (1.5x).
      const hitbox = grp.children[2]
      if (hitbox) hitbox.scale.setScalar(Math.max(s.radius * 1.5, 0.42))

      // Aura antimateria/purified — visible para CUALQUIER orb cursed
      // (antimatter rojo o purified púrpura). El color del aura sigue al
      // color del orb → aura roja pre-unlock, aura púrpura post-unlock.
      const aura = orbAurasRef.current[i]
      if (aura) {
        aura.setVisible(!!s._isCursed && !!s._visible)
        aura.setRadius(s.radius)
        aura.setColor(s.color)
      }
    }

    // Thunder reticle: sigue el cursor proyectado al suelo mientras armado.
    const reticle = reticleRef.current
    if (reticle) {
      if (thunderArmedRef.current) {
        _dragRaycaster.setFromCamera(reticleNDCRef.current, camera)
        if (_dragRaycaster.ray.intersectPlane(_groundPlane, _tempVec3)) {
          reticle.position.set(_tempVec3.x, 0.02, _tempVec3.z)
          reticle.rotation.x = -Math.PI / 2
          reticle.rotation.z += dt * 1.3
          reticle.scale.setScalar(1 + Math.sin(performance.now() * 0.006) * 0.1)
          if (!reticle.visible) reticle.visible = true
        }
      } else if (reticle.visible) {
        reticle.visible = false
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
  // Black inverted-hull outline, matched to the character outline thickness.
  // Shared across all orbs (same look); disposed on unmount.
  const orbOutlineMat = useMemo(() => makeHullOutline({ color: 0x000000, thickness: 0.03 }), [])
  useEffect(() => () => { try { orbOutlineMat.dispose() } catch { } }, [orbOutlineMat])

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
          >
            <sphereGeometry args={[1, 24, 24]} />
            {/* Look NEÓN ESFÉRICO (WoW Legion / toxic green):
                - color={'#000000'}: diffuse negro → el IBL no contamina con
                  luz blanca. Sin esto los orbs se iban a cream pastel.
                - emissive={s.color} con emissiveIntensity 1.0: vive en zona
                  donde ACES preserva chroma. El multiplicador de neonOrb
                  amplifica esto al centro (1.0 * 1.8 = 1.8 hot) y lo reduce
                  al rim (1.0 * 0.45 = 0.45 oscuro).
                - roughness=1.0: mata el specular highlight blanco del IBL.
                - applyNeonOrb: cuantiza el emissive por NdotV en 3 bandas
                  cell-shaded → centro caliente, rim oscuro → LECTURA ESFÉRICA
                  en vez de disco plano 2D. */}
            <meshStandardMaterial ref={(m) => { try { if (m) applyNeonOrb(m, { steps: 3, rimMul: 0.45, coreMul: 1.8, power: 1.4 }) } catch { } }} transparent opacity={1} color={'#000000'} emissive={s.color} emissiveIntensity={1.0} roughness={1.0} metalness={0.0} />
            {/* Black outline (inverted hull). Nested so it inherits the orb's
                radius scale; view-space expansion keeps the rim a constant width. */}
            <mesh material={orbOutlineMat} raycast={() => null} renderOrder={-1}>
              <sphereGeometry args={[1, 24, 24]} />
            </mesh>
          </mesh>
          <pointLight color={s.color} intensity={2.8} distance={6} decay={1.6} />
          {/* DRAG HITBOX invisible — sphere más grande para que orbs pequeños
              (radius 0.18) sean fáciles de agarrar. Scale se sincroniza en el
              imperative sync loop a max(s.radius * 1.5, 0.42). Tiene los
              handlers de pointer; el mesh visible queda libre de eventos
              (un solo punto de drag, sin doble-fire). */}
          <mesh
            visible={false}
            onPointerDown={(e) => handleSpherePointerDown(e, i)}
            onContextMenu={(e) => handleSphereContextMenu(e, i)}
            onPointerOver={dragEnabled ? () => { try { gl.domElement.style.cursor = 'grab' } catch { } } : undefined}
            onPointerOut={dragEnabled ? () => { try { if (!dragStateRef.current.active) gl.domElement.style.cursor = '' } catch { } } : undefined}
          >
            <sphereGeometry args={[1, 12, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* AURA antimateria (particulas + runas SDF). Mounted siempre pero
              su visibilidad se controla en el sync loop según s._isAntimatter
              — solo el orb cuyo color matchea section6 muestra el aura. El
              radius/color se actualizan vía ref imperativo (sin re-renders)
              cada vez que respawnea con valores nuevos. */}
          <AntimatterOrbAura
            ref={(r) => { if (r) orbAurasRef.current[i] = r }}
            color={s.color}
            radius={s.radius}
            visible={false}
          />
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

      {/* Thunder target reticle — plano sobre el piso (rotación se fija en el
          frame loop). Additive púrpura, pulsa y gira mientras está armado. */}
      <group ref={reticleRef} visible={false}>
        <mesh>
          <ringGeometry args={[0.85, 1.02, 56]} />
          <meshBasicMaterial color={'#c77dff'} transparent opacity={0.85} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.34, 0.42, 40]} />
          <meshBasicMaterial color={'#ffffff'} transparent opacity={0.8} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color={'#ffffff'} transparent opacity={0.95} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a, k) => (
          <mesh key={k} position={[Math.cos(a) * 1.18, Math.sin(a) * 1.18, 0]} rotation={[0, 0, a]}>
            <planeGeometry args={[0.28, 0.06]} />
            <meshBasicMaterial color={'#c77dff'} transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {/* Runas "POWER OF GOD" que brotan del personaje al comer el orbe. */}
      <RuneBurstParticles ref={runeBurstRef} playerRef={playerRef} />
    </group>
  )
}

export default forwardRef(HomeOrbsImpl)
