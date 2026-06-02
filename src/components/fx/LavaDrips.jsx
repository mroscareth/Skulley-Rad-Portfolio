import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getCurrentSkinMode } from '../../lib/skinShaders.js'

// Gotas que gotean del personaje según la skin activa:
//   - mode 4 (Molten Lava)  → chispas naranja/rojas, ADITIVAS (glow), caída rápida.
//   - mode 5 (Green Slime)   → gotas verdes glossy con forma de teardrop, blending
//                              NORMAL (gota sólida translúcida, no chispa), viscosas.
// Partículas en ESPACIO MUNDO (emite desde playerRef.getWorldPosition). Buffer
// compactado + drawRange (sin allocs en el loop). Nada cuando la skin no gotea.
const LAVA_MODE = 4
const SLIME_MODE = 5

export default function LavaDrips({ playerRef, count = 80 }) {
  const geoRef = useRef()
  const matRef = useRef()
  const lastBlendRef = useRef(null)
  const positions = useMemo(() => new Float32Array(count * 3), [count])
  const heats = useMemo(() => new Float32Array(count), [count])
  const sizes = useMemo(() => new Float32Array(count), [count])
  const particles = useMemo(
    () => Array.from({ length: count }, () => ({
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0, size: 0, grav: 4.5, alive: false,
    })),
    [count]
  )
  const spawnAccRef = useRef(0)
  const originRef = useRef(new THREE.Vector3())
  const uniforms = useMemo(() => ({
    uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1 },
    uMode: { value: 0 },
  }), [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw || 0.016, 0.05)
    const mode = getCurrentSkinMode()
    const active = (mode === LAVA_MODE || mode === SLIME_MODE) && !!playerRef?.current
    const isSlime = mode === SLIME_MODE
    uniforms.uMode.value = mode

    // Blending: slime = NORMAL (gota sólida), lava = ADDITIVE (glow). Solo se
    // cambia cuando cambia el modo (needsUpdate es caro por frame).
    const wantBlend = isSlime ? THREE.NormalBlending : THREE.AdditiveBlending
    if (matRef.current && lastBlendRef.current !== wantBlend) {
      matRef.current.blending = wantBlend
      matRef.current.needsUpdate = true
      lastBlendRef.current = wantBlend
    }

    const origin = originRef.current
    if (active) {
      try { playerRef.current.getWorldPosition(origin) } catch { }
      const rate = isSlime ? 14 : 24 // slime gotea más espaciado
      spawnAccRef.current += dt * rate
      while (spawnAccRef.current >= 1) {
        spawnAccRef.current -= 1
        const p = particles.find((q) => !q.alive)
        if (!p) break
        p.alive = true
        p.age = 0
        p.life = isSlime ? (1.6 + Math.random() * 1.0) : (0.9 + Math.random() * 0.7)
        p.size = isSlime ? (0.10 + Math.random() * 0.08) : (0.05 + Math.random() * 0.06)
        p.grav = isSlime ? 2.2 : 4.5 // viscoso vs líquido
        const ox = (Math.random() * 2 - 1) * 0.42
        const oz = (Math.random() * 2 - 1) * 0.28
        const oy = 0.15 + Math.pow(Math.random(), 1.7) * 1.35 // bias hacia abajo
        p.pos.set(origin.x + ox, origin.y + oy, origin.z + oz)
        const vy = isSlime ? (-0.02 - Math.random() * 0.08) : (-0.18 - Math.random() * 0.28)
        p.vel.set((Math.random() * 2 - 1) * (isSlime ? 0.05 : 0.12), vy, (Math.random() * 2 - 1) * (isSlime ? 0.05 : 0.12))
      }
    }

    // Actualiza + escribe el buffer compactado (solo vivas, al frente).
    let n = 0
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      if (!p.alive) continue
      p.age += dt
      if (p.age >= p.life) { p.alive = false; continue }
      p.vel.y -= p.grav * dt
      p.pos.x += p.vel.x * dt
      p.pos.y += p.vel.y * dt
      p.pos.z += p.vel.z * dt
      const k = 1 - p.age / p.life // 1 → 0 (frescura)
      positions[n * 3] = p.pos.x
      positions[n * 3 + 1] = p.pos.y
      positions[n * 3 + 2] = p.pos.z
      heats[n] = k
      sizes[n] = p.size
      n++
    }

    const geo = geoRef.current
    if (geo) {
      if (!geo.getAttribute('position')) {
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setAttribute('aHeat', new THREE.BufferAttribute(heats, 1))
        geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
      }
      geo.setDrawRange(0, n)
      if (geo.attributes.position) geo.attributes.position.needsUpdate = true
      if (geo.attributes.aHeat) geo.attributes.aHeat.needsUpdate = true
      if (geo.attributes.aSize) geo.attributes.aSize.needsUpdate = true
    }
  })

  return (
    <points frustumCulled={false} renderOrder={3}>
      <bufferGeometry ref={geoRef} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        depthTest
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uPixelRatio;
          uniform float uMode;
          attribute float aHeat;
          attribute float aSize;
          varying float vHeat;
          void main(){
            vHeat = aHeat;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            // Slime: gotas más grandes (gota visible); lava: chispa.
            float sz = (uMode > 4.5) ? aSize * 1.5 : aSize * (0.6 + vHeat);
            gl_PointSize = sz * (320.0 / max(1.0, -mv.z)) * uPixelRatio;
          }
        `}
        fragmentShader={`
          precision highp float;
          uniform float uMode;
          varying float vHeat;
          void main(){
            vec2 uv = gl_PointCoord * 2.0 - 1.0;
            if (uMode > 4.5) {
              // SLIME — gota (teardrop) verde glossy translúcida. Punta (cola)
              // ARRIBA, cabeza redonda ABAJO → forma de gota cayendo. gl_PointCoord
              // crece hacia abajo, así que uv.y<0 = arriba: ahí va lo angosto.
              float t = clamp(0.5 - uv.y * 0.5, 0.0, 1.0); // 1 arriba (angosto), 0 abajo (ancho)
              float w = mix(0.95, 0.30, t * t);
              float d = length(vec2(uv.x / w, uv.y));
              if (d > 1.0) discard;
              float body = smoothstep(1.0, 0.55, d);
              // brillo glossy en la cabeza (abajo)
              float hi = smoothstep(0.55, 0.0, length(uv - vec2(-0.25, 0.22)));
              vec3 col = mix(vec3(0.05, 0.40, 0.02), vec3(0.35, 1.0, 0.14), vHeat);
              col += vec3(0.55, 1.0, 0.45) * hi * 0.55;   // reflejo húmedo
              float alpha = body * (0.65 + 0.35 * vHeat);
              gl_FragColor = vec4(col, alpha);
            } else {
              // LAVA — chispa redonda incandescente (aditiva).
              float d = length(uv);
              if (d > 1.0) discard;
              float core = pow(1.0 - d, 2.0);
              vec3 col = mix(vec3(0.65, 0.04, 0.0), vec3(1.0, 0.85, 0.30), vHeat);
              float alpha = core * (0.25 + 0.75 * vHeat);
              gl_FragColor = vec4(col * (0.6 + vHeat), alpha);
            }
          }
        `}
      />
    </points>
  )
}
