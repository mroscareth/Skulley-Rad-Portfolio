import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Fake grass: instancing + distance-based reveal/grow around the player.
// - 1 drawcall (InstancedMesh)
// - No external textures
// - No transparency (avoids overdraw); thin blades
export default function FakeGrass({
  playerRef,
  enabled = true,
  // Total seeded area (radius). Reveal controlled via `revealRadius`.
  fieldRadius = 30,
  // Base grass color (allows easy tone customization)
  baseColor = '#2bdc4f',
  // Enable per-instance variation via vertex colors for natural look
  enableInstanceColor = true,
  // Small emissive boost to prevent black appearance on GPUs/scenes with low light
  emissiveIntensity = 0.18,
  // Make the grass field follow the player (grass always under the character)
  followPlayer = false,
  // Optional snap when following (reduces visual jitter). 0 = no snap.
  followSnap = 0.0,
  // Blade taper toward tip (0 = rectangular, 1 = very thin tip)
  widthTaper = 0.8,
  // Slight blade curvature (0 = no curve, 0.3 recommended)
  bendAmount = 0.2,
  // Max random tilt in X/Z (radians) to avoid perfect verticality
  tiltAmplitudeX = 0.25,
  tiltAmplitudeZ = 0.15,
  // Radius where grass appears (grows from 0 near the character)
  revealRadius = 7,
  // Reveal edge smoothing
  feather = 2.2,
  // Persistence: grass stays where the player has walked (trail reveal)
  persistent = false,
  // Mask resolution (higher = better, but more update cost)
  maskRes = 128,
  // Minimum movement distance before stamping again
  stampStep = 0.28,
  // Optional directional mode (off by default). Radial is the default.
  directional = false,
  forwardShift = 2.2,
  rearFade = 2.2,
  rearMin = 0.35,
  // Aggressively reduced blade count for better perf
  count = 2500,
  // Base blade height (variation is per-instance)
  bladeHeight = 1.05,
  // Base blade width
  bladeWidth = 0.06,
  // Sway intensity (wind)
  sway = 0.06,
  // Low perf: reduce density and detail
  lowPerf = false,
  // Mobile: even more aggressive reduction (separate from lowPerf which also affects desktop warm-up)
  isMobile = false,
}) {
  const meshRef = useRef()
  const matRef = useRef()
  const centerRef = useRef(new THREE.Vector3())
  const forwardRef = useRef(new THREE.Vector3(0, 0, 1))
  const prevPosRef = useRef(new THREE.Vector3(1e9, 0, 1e9))
  const timeRef = useRef(0)
  const maskRef = useRef({
    canvas: null,
    ctx: null,
    tex: null,
    lastStamp: new THREE.Vector3(1e9, 0, 1e9),
  })

  const cfg = useMemo(() => {
    const c = Math.max(500, Math.floor(Number(count) || 0))
    const r = Math.max(6, Number(fieldRadius) || 30)
    return { c, r }
  }, [count, fieldRadius])

  // Capture initial lowPerf to avoid regenerating geometry
  // when state changes (causes massive lag from shader recompilation)
  const initialLowPerfRef = useRef(lowPerf)

  const finalCount = useMemo(() => {
    if (!enabled) return 0
    // Mobile: ultra-aggressive reduction (separate from lowPerf warm-up)
    if (isMobile) return Math.max(400, Math.floor(cfg.c * 0.30))
    // Use INITIAL lowPerf value to avoid regenerating instances
    if (initialLowPerfRef.current) return Math.max(600, Math.floor(cfg.c * 0.35))
    return cfg.c
  }, [enabled, cfg.c, isMobile]) // isMobile is stable (calculated once via useMemo)

  const geo = useMemo(() => {
    // More Y segments = better sway curve, but more vertices.
    // Mobile: minimal segments for cheapest possible geometry
    const segY = isMobile ? 1 : (initialLowPerfRef.current ? 2 : 3)
    // Add X segments for tip taper and curvature
    const segX = 2
    const g = new THREE.PlaneGeometry(bladeWidth, bladeHeight, segX, segY)
    // Ground pivot: grow from y=0
    g.translate(0, bladeHeight * 0.5, 0)
    // Shape blade: taper tip and add slight curve
    try {
      const pos = g.attributes.position
      const arr = pos.array
      const stride = 3
      const h = bladeHeight
      const halfW = bladeWidth * 0.5
      const taper = THREE.MathUtils.clamp(Number(widthTaper) || 0, 0, 0.98)
      const bend = THREE.MathUtils.clamp(Number(bendAmount) || 0, 0, 0.8)
      for (let i = 0; i < arr.length; i += stride) {
        const x = arr[i + 0]
        const y = arr[i + 1] // already in [0..h] after the translate
        const z = arr[i + 2]
        const v = Math.max(0, Math.min(1, y / Math.max(1e-6, h)))
        // taper: reduce width as it rises (in X)
        const widthScale = 1.0 - taper * v
        const xTapered = THREE.MathUtils.clamp(x, -halfW, halfW) * widthScale
        // curvature: slight Z arch depending on X sign
        const side = (x >= 0 ? 1 : -1)
        const zCurved = z + side * bend * (v * v) * halfW * 0.6
        arr[i + 0] = xTapered
        arr[i + 2] = zCurved
      }
      pos.needsUpdate = true
      g.computeVertexNormals()
    } catch { }
    return g
  }, [bladeWidth, bladeHeight, widthTaper, bendAmount]) // Do NOT include lowPerf — use initial value

  const material = useMemo(() => {
    const base = new THREE.Color(baseColor)
    const m = new THREE.MeshStandardMaterial({
      color: base.clone(),
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      vertexColors: !!enableInstanceColor,
    })
    // Slight color boost to avoid black appearance without IBL/lights
    try {
      m.emissive.copy(base)
      m.emissiveIntensity = Math.max(0, Number(emissiveIntensity) || 0)
    } catch { }
    return m
  }, [baseColor, enableInstanceColor, emissiveIntensity])

  // Persistent mask (CanvasTexture): paints a circle around the player.
  useEffect(() => {
    if (!enabled || !persistent) {
      // cleanup if it was active
      try { maskRef.current.tex?.dispose?.() } catch { }
      maskRef.current.canvas = null
      maskRef.current.ctx = null
      maskRef.current.tex = null
      return undefined
    }
    try {
      const res = Math.max(64, Math.floor(Number(maskRes) || 256))
      const c = document.createElement('canvas')
      c.width = res
      c.height = res
      const ctx = c.getContext('2d')
      if (!ctx) return undefined
      ctx.clearRect(0, 0, res, res)
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fillRect(0, 0, res, res)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.NoColorSpace
      t.wrapS = THREE.ClampToEdgeWrapping
      t.wrapT = THREE.ClampToEdgeWrapping
      t.minFilter = THREE.LinearFilter
      t.magFilter = THREE.LinearFilter
      t.needsUpdate = true
      maskRef.current.canvas = c
      maskRef.current.ctx = ctx
      maskRef.current.tex = t
      maskRef.current.lastStamp.set(1e9, 0, 1e9)
    } catch { }
    return () => {
      try { maskRef.current.tex?.dispose?.() } catch { }
      maskRef.current.canvas = null
      maskRef.current.ctx = null
      maskRef.current.tex = null
    }
  }, [enabled, persistent, maskRes])

  // Instancing: matrices + per-instance colors (variation)
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !finalCount) return
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    // Prepare HSL from base color for coherent variation
    const base = new THREE.Color(baseColor)
    const hsl = { h: 0, s: 0, l: 0 }
    try { base.getHSL(hsl) } catch { }
    for (let i = 0; i < finalCount; i += 1) {
      // Uniform disc distribution
      const t = Math.random() * Math.PI * 2
      const u = Math.sqrt(Math.random())
      const rr = u * cfg.r
      const x = Math.cos(t) * rr
      const z = Math.sin(t) * rr

      const rotY = Math.random() * Math.PI * 2
      // Random tilt in X/Z (imperfect verticality)
      const rotX = (Math.random() - 0.5) * (Number(tiltAmplitudeX) || 0)
      const rotZ = (Math.random) ? (Math.random() - 0.5) * (Number(tiltAmplitudeZ) || 0) : 0
      const sY = 0.65 + Math.random() * 0.85
      const sX = 0.85 + Math.random() * 0.55

      dummy.position.set(x, 0, z)
      // slight tilt in x/z to add lean, plus random yaw
      dummy.rotation.set(rotX, rotY, rotZ)
      dummy.scale.set(sX, sY, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      if (enableInstanceColor) {
        // Subtle variation around base hue for naturalness
        const hue = hsl.h + (Math.random() - 0.5) * 0.06
        const sat = THREE.MathUtils.clamp(hsl.s + (Math.random() - 0.5) * 0.12, 0.0, 1.0)
        const lum = THREE.MathUtils.clamp((hsl.l <= 0 ? 0.38 : hsl.l) + (Math.random() - 0.5) * 0.10, 0.0, 1.0)
        color.setHSL(hue, sat, lum)
        mesh.setColorAt(i, color)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (enableInstanceColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Large bounding sphere for correct frustum culling (instancing)
    try {
      mesh.geometry.computeBoundingSphere()
      mesh.geometry.boundingSphere.radius = Math.max(mesh.geometry.boundingSphere.radius, cfg.r + 5)
    } catch { }
  }, [finalCount, cfg.r, geo, baseColor, enableInstanceColor])

  // Shader injection: distance-based reveal/grow + sway
  useEffect(() => {
    const m = material
    if (!m) return
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCenter = { value: new THREE.Vector3(0, 0, 0) }
      shader.uniforms.uForward = { value: new THREE.Vector3(0, 0, 1) }
      shader.uniforms.uRadius = { value: Math.max(0.1, revealRadius) }
      shader.uniforms.uFeather = { value: Math.max(0.01, feather) }
      shader.uniforms.uFieldRadius = { value: Math.max(1, cfg.r) }
      shader.uniforms.uForwardShift = { value: Math.max(0, forwardShift) }
      shader.uniforms.uRearFade = { value: Math.max(0.01, rearFade) }
      shader.uniforms.uRearMin = { value: THREE.MathUtils.clamp(rearMin, 0, 1) }
      shader.uniforms.uDirectional = { value: directional ? 1 : 0 }
      shader.uniforms.uTime = { value: 0 }
      shader.uniforms.uSway = { value: Math.max(0, sway) }
      shader.uniforms.uMask = { value: null }
      shader.uniforms.uUseMask = { value: 0 }

      // Save refs for updating uniforms in useFrame
      matRef.current = { shader }

      // Inject uniforms
      shader.vertexShader =
        `
        uniform vec3 uCenter;
        uniform vec3 uForward;
        uniform float uRadius;
        uniform float uFeather;
        uniform float uFieldRadius;
        uniform float uForwardShift;
        uniform float uRearFade;
        uniform float uRearMin;
        uniform float uDirectional;
        uniform float uTime;
        uniform float uSway;
        uniform sampler2D uMask;
        uniform float uUseMask;
        varying float vGrow;
      ` + shader.vertexShader

      // Replace begin_vertex: control growth and sway here
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec3 transformed = vec3(position);
        // Blade origin position in world (instancing)
        vec3 worldOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float grow = 0.0;
        if (uUseMask > 0.5) {
          // Mask UV (field centered at 0,0): [-R..R] -> [0..1]
          vec2 uv = (worldOrigin.xz / (uFieldRadius * 2.0)) + vec2(0.5);
          float m = texture2D(uMask, uv).r; // 0..1
          // The mask is persistent, so m controls already-revealed areas
          grow = smoothstep(0.08, 0.92, m);
        } else {
          // Radial (as requested):
          // Near the character = grows more, far = grows less, down to 0 at radius.
          float d = distance(worldOrigin.xz, uCenter.xz);
          float t = clamp(1.0 - (d / max(0.001, uRadius)), 0.0, 1.0);
          // Smooth and apply feather to edge
          float edge = smoothstep(0.0, max(0.001, uFeather / uRadius), t);
          grow = t * edge;
          // Optional directional (if enabled in the future)
          if (uDirectional > 0.5) {
            vec2 fwd = normalize(uForward.xz);
            vec2 dir = worldOrigin.xz - uCenter.xz;
            float proj = dot(dir, fwd); // <0 behind, >0 ahead
            float frontT = smoothstep(0.0, max(0.001, uForwardShift), proj);
            float radiusBoost = frontT * uForwardShift;
            float d2 = distance(worldOrigin.xz, uCenter.xz);
            float t2 = clamp(1.0 - (d2 / max(0.001, uRadius + radiusBoost)), 0.0, 1.0);
            float edge2 = smoothstep(0.0, max(0.001, uFeather / max(0.001, (uRadius + radiusBoost))), t2);
            float g2 = t2 * edge2;
            float backT = smoothstep(-uRearFade, 0.0, proj);
            float dirFactor = mix(uRearMin, 1.0, backT);
            grow = g2 * dirFactor;
          }
        }
        // smooth curve
        grow = grow * grow * (3.0 - 2.0 * grow);
        transformed.y *= grow;
        vGrow = grow;
        // sway: higher = more sway
        float k = transformed.y;
        float w = sin(uTime * 1.25 + worldOrigin.x * 0.35 + worldOrigin.z * 0.27);
        transformed.x += w * uSway * k * grow;
        transformed.z += cos(uTime * 1.08 + worldOrigin.z * 0.31) * uSway * 0.45 * k * grow;
        // Flatten blades when far (reduce shading cost visually)
        transformed.xz *= (0.15 + 0.85 * grow);
        `,
      )

      // If grow is ~0, discard fragment so grass is not visible across the entire field
      shader.fragmentShader =
        `
        varying float vGrow;
      ` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `
        void main() {
          if (vGrow <= 0.001) discard;
        `,
      )
    }
    m.needsUpdate = true
  }, [material, revealRadius, feather, sway, cfg.r, directional, forwardShift, rearFade, rearMin])

  useFrame((_, dt) => {
    if (!enabled) return
    timeRef.current += Math.min(0.05, Math.max(0, dt || 0))
    try {
      if (playerRef?.current) playerRef.current.getWorldPosition(centerRef.current)
    } catch { }

    // Move grass field to follow player (infinite/always-under-foot)
    try {
      const mesh = meshRef.current
      if (mesh && followPlayer) {
        const cx = centerRef.current.x || 0
        const cz = centerRef.current.z || 0
        if (followSnap && followSnap > 0) {
          const s = followSnap
          const fx = Math.round(cx / s) * s
          const fz = Math.round(cz / s) * s
          if (mesh.position.x !== fx || mesh.position.z !== fz) {
            mesh.position.set(fx, 0, fz)
          }
        } else {
          if (mesh.position.x !== cx || mesh.position.z !== cz) {
            mesh.position.set(cx, 0, cz)
          }
        }
      }
    } catch { }

    // Forward vector (for directional reveal)
    try {
      const prev = prevPosRef.current
      const cur = centerRef.current
      if (prev.x < 1e8) {
        const dx = cur.x - prev.x
        const dz = cur.z - prev.z
        const len = Math.sqrt(dx * dx + dz * dz)
        if (len > 1e-3) {
          forwardRef.current.set(dx / len, 0, dz / len)
        }
      }
      prev.copy(cur)
    } catch { }

    // Paint persistent mask (trail) in a radius around the player
    if (persistent) {
      const mr = maskRef.current
      const ctx = mr.ctx
      const canvas = mr.canvas
      const tex = mr.tex
      if (ctx && canvas && tex) {
        const dx = centerRef.current.x - mr.lastStamp.x
        const dz = centerRef.current.z - mr.lastStamp.z
        const dist2 = dx * dx + dz * dz
        const step = Math.max(0.05, Number(stampStep) || 0.28)
        if (dist2 >= step * step) {
          mr.lastStamp.copy(centerRef.current)
          const res = canvas.width
          const R = Math.max(1, cfg.r)
          // map world->uv
          const u = (centerRef.current.x / (R * 2)) + 0.5
          const v = (centerRef.current.z / (R * 2)) + 0.5
          const px = u * res
          const py = v * res
          const radPx = (Math.max(0.1, revealRadius) / (R * 2)) * res
          const featherPx = (Math.max(0.01, feather) / (R * 2)) * res
          try {
            ctx.save()
            ctx.globalCompositeOperation = 'lighter'
            const g = ctx.createRadialGradient(px, py, 0, px, py, Math.max(2, radPx))
            g.addColorStop(0.0, 'rgba(255,255,255,0.75)')
            g.addColorStop(Math.max(0.05, Math.min(0.95, (radPx - featherPx) / Math.max(1, radPx))), 'rgba(255,255,255,0.25)')
            g.addColorStop(1.0, 'rgba(255,255,255,0)')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(px, py, Math.max(2, radPx), 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
            tex.needsUpdate = true
          } catch { }
        }
      }
    }

    const s = matRef.current?.shader
    if (!s) return
    try {
      s.uniforms.uCenter.value.copy(centerRef.current)
      s.uniforms.uForward.value.copy(forwardRef.current)
      s.uniforms.uRadius.value = Math.max(0.1, revealRadius)
      s.uniforms.uFeather.value = Math.max(0.01, feather)
      s.uniforms.uFieldRadius.value = Math.max(1, cfg.r)
      s.uniforms.uForwardShift.value = Math.max(0, forwardShift)
      s.uniforms.uRearFade.value = Math.max(0.01, rearFade)
      s.uniforms.uRearMin.value = THREE.MathUtils.clamp(rearMin, 0, 1)
      s.uniforms.uDirectional.value = directional ? 1 : 0
      s.uniforms.uTime.value = timeRef.current
      s.uniforms.uSway.value = Math.max(0, sway)
      const tex = (persistent ? maskRef.current.tex : null)
      s.uniforms.uMask.value = tex
      s.uniforms.uUseMask.value = (persistent && tex) ? 1 : 0
    } catch { }
  })

  if (!enabled || finalCount <= 0) return null
  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, material, finalCount]}
      // Instanced meshes cull incorrectly if bounding sphere doesn't include all instances.
      // Keep visible (still 1 drawcall).
      frustumCulled={false}
      renderOrder={-10}
      position={[0, 0.0, 0]}
    />
  )
}

