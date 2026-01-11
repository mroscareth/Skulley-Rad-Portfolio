import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Pasto fake: instancing + “reveal/grow” por distancia al personaje.
// - 1 drawcall (InstancedMesh)
// - Sin texturas externas
// - Sin transparencia (evita overdraw); son “blades” finos
export default function FakeGrass({
  playerRef,
  enabled = true,
  // Área total sembrada (radio). El reveal se controla con `revealRadius`.
  fieldRadius = 30,
  // Color base del pasto (permite personalizar fácilmente el tono)
  baseColor = '#2bdc4f',
  // Habilita variación por instancia usando vertex colors (verde “natural”)
  enableInstanceColor = true,
  // Pequeño refuerzo emisivo para evitar que se vea negro en GPUs/escenas con poca luz
  emissiveIntensity = 0.18,
  // Hacer que el campo de pasto siga al jugador (pasto siempre bajo el personaje)
  followPlayer = false,
  // Snap opcional al seguir (reduce jitter visual en movimiento). 0 = sin snap.
  followSnap = 0.0,
  // Afinamiento del blade hacia la punta (0 = rectangular, 1 = punta muy fina)
  widthTaper = 0.8,
  // Curvatura leve del blade (0 = sin curva, 0.3 recomendado)
  bendAmount = 0.2,
  // Inclinación aleatoria máxima en X/Z (radianes) para evitar verticalidad perfecta
  tiltAmplitudeX = 0.25,
  tiltAmplitudeZ = 0.15,
  // Radio donde el pasto aparece (crece desde 0 cerca del personaje)
  revealRadius = 7,
  // Suavizado del borde del reveal
  feather = 2.2,
  // Persistencia: el pasto “queda” donde ya pasaste (trail reveal)
  persistent = false,
  // Resolución de la máscara (más = mejor, pero más costo al actualizar)
  maskRes = 256,
  // Distancia mínima de movimiento para “pintar” otra vez
  stampStep = 0.28,
  // Modo direccional opcional (por defecto apagado). El usuario pidió “radial”.
  directional = false,
  forwardShift = 2.2,
  rearFade = 2.2,
  rearMin = 0.35,
  // Cantidad de blades (ajusta perf)
  count = 7000,
  // Altura base del blade (la variación es por instancia)
  bladeHeight = 1.05,
  // Ancho base del blade
  bladeWidth = 0.06,
  // Intensidad de sway (viento)
  sway = 0.06,
  // Low perf: reduce densidad y detalle
  lowPerf = false,
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

  const finalCount = useMemo(() => {
    if (!enabled) return 0
    if (lowPerf) return Math.max(800, Math.floor(cfg.c * 0.55))
    return cfg.c
  }, [enabled, lowPerf, cfg.c])

  const geo = useMemo(() => {
    // Más segmentos en Y = mejor curva con el sway, pero más vértices.
    const segY = lowPerf ? 2 : 3
    // Añadimos segmentos en X para poder afinar la punta (taper) y dar curvatura
    const segX = 2
    const g = new THREE.PlaneGeometry(bladeWidth, bladeHeight, segX, segY)
    // Pivote en el suelo: que crezca desde y=0
    g.translate(0, bladeHeight * 0.5, 0)
    // Dar forma de hoja: afinar la punta y curvar levemente el blade
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
        const y = arr[i + 1] // ya está en [0..h] tras el translate
        const z = arr[i + 2]
        const v = Math.max(0, Math.min(1, y / Math.max(1e-6, h)))
        // taper: reduce el ancho conforme sube (en X)
        const widthScale = 1.0 - taper * v
        const xTapered = THREE.MathUtils.clamp(x, -halfW, halfW) * widthScale
        // curvatura: leve arqueo en Z hacia un lado dependiente del signo de X
        const side = (x >= 0 ? 1 : -1)
        const zCurved = z + side * bend * (v * v) * halfW * 0.6
        arr[i + 0] = xTapered
        arr[i + 2] = zCurved
      }
      pos.needsUpdate = true
      g.computeVertexNormals()
    } catch {}
    return g
  }, [bladeWidth, bladeHeight, lowPerf, widthTaper, bendAmount])

  const material = useMemo(() => {
    const base = new THREE.Color(baseColor)
    const m = new THREE.MeshStandardMaterial({
      color: base.clone(),
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      vertexColors: !!enableInstanceColor,
    })
    // Refuerzo leve de color para evitar apariencia negra en ausencia de IBL/luces
    try {
      m.emissive.copy(base)
      m.emissiveIntensity = Math.max(0, Number(emissiveIntensity) || 0)
    } catch {}
    return m
  }, [baseColor, enableInstanceColor, emissiveIntensity])

  // Máscara persistente (CanvasTexture): se “pinta” un círculo alrededor del player.
  useEffect(() => {
    if (!enabled || !persistent) {
      // cleanup si estaba activa
      try { maskRef.current.tex?.dispose?.() } catch {}
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
    } catch {}
    return () => {
      try { maskRef.current.tex?.dispose?.() } catch {}
      maskRef.current.canvas = null
      maskRef.current.ctx = null
      maskRef.current.tex = null
    }
  }, [enabled, persistent, maskRes])

  // Instancing: matrices + colores por instancia (variación)
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !finalCount) return
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    // Preparar HSL a partir del color base para variación coherente
    const base = new THREE.Color(baseColor)
    const hsl = { h: 0, s: 0, l: 0 }
    try { base.getHSL(hsl) } catch {}
    for (let i = 0; i < finalCount; i += 1) {
      // Distribución uniforme en disco
      const t = Math.random() * Math.PI * 2
      const u = Math.sqrt(Math.random())
      const rr = u * cfg.r
      const x = Math.cos(t) * rr
      const z = Math.sin(t) * rr

      const rotY = Math.random() * Math.PI * 2
      // Inclinación aleatoria en X/Z (verticalidad imperfecta)
      const rotX = (Math.random() - 0.5) * (Number(tiltAmplitudeX) || 0)
      const rotZ = (Math.random) ? (Math.random() - 0.5) * (Number(tiltAmplitudeZ) || 0) : 0
      const sY = 0.65 + Math.random() * 0.85
      const sX = 0.85 + Math.random() * 0.55

      dummy.position.set(x, 0, z)
      // rotación (x,z) ligeras para añadir “lean”, y yaw aleatorio
      dummy.rotation.set(rotX, rotY, rotZ)
      dummy.scale.set(sX, sY, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      if (enableInstanceColor) {
        // Variación sutil alrededor del tono base para naturalidad
        const hue = hsl.h + (Math.random() - 0.5) * 0.06
        const sat = THREE.MathUtils.clamp(hsl.s + (Math.random() - 0.5) * 0.12, 0.0, 1.0)
        const lum = THREE.MathUtils.clamp((hsl.l <= 0 ? 0.38 : hsl.l) + (Math.random() - 0.5) * 0.10, 0.0, 1.0)
        color.setHSL(hue, sat, lum)
        mesh.setColorAt(i, color)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (enableInstanceColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Bounding sphere grande para que no se culee mal (instancing)
    try {
      mesh.geometry.computeBoundingSphere()
      mesh.geometry.boundingSphere.radius = Math.max(mesh.geometry.boundingSphere.radius, cfg.r + 5)
    } catch {}
  }, [finalCount, cfg.r, geo, baseColor, enableInstanceColor])

  // Shader injection: reveal/grow por distancia + sway
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

      // Guardar refs para actualizar uniforms en useFrame
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

      // Reemplazar begin_vertex: aquí controlamos crecimiento y sway
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec3 transformed = vec3(position);
        // Posición del origen del blade en mundo (instancing)
        vec3 worldOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float grow = 0.0;
        if (uUseMask > 0.5) {
          // UV de máscara (campo centrado en 0,0): [-R..R] -> [0..1]
          vec2 uv = (worldOrigin.xz / (uFieldRadius * 2.0)) + vec2(0.5);
          float m = texture2D(uMask, uv).r; // 0..1
          // Nota: la máscara es persistente, así que m controla el “ya revelado”
          grow = smoothstep(0.08, 0.92, m);
        } else {
          // Radial (lo que pidió el usuario):
          // Cerca del personaje = crece más, lejos = crece menos, hasta 0 en el radio.
          float d = distance(worldOrigin.xz, uCenter.xz);
          float t = clamp(1.0 - (d / max(0.001, uRadius)), 0.0, 1.0);
          // Suavizar y aplicar feather al borde
          float edge = smoothstep(0.0, max(0.001, uFeather / uRadius), t);
          grow = t * edge;
          // Direccional opcional (si se enciende en el futuro)
          if (uDirectional > 0.5) {
            vec2 fwd = normalize(uForward.xz);
            vec2 dir = worldOrigin.xz - uCenter.xz;
            float proj = dot(dir, fwd); // <0 detrás, >0 delante
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
        // curva suave
        grow = grow * grow * (3.0 - 2.0 * grow);
        transformed.y *= grow;
        vGrow = grow;
        // sway: más arriba = más sway
        float k = transformed.y;
        float w = sin(uTime * 1.25 + worldOrigin.x * 0.35 + worldOrigin.z * 0.27);
        transformed.x += w * uSway * k * grow;
        transformed.z += cos(uTime * 1.08 + worldOrigin.z * 0.31) * uSway * 0.45 * k * grow;
        // Flatten blades when far (reduce shading cost visually)
        transformed.xz *= (0.15 + 0.85 * grow);
        `,
      )

      // Si grow es ~0, descartar fragmento para que NO se vea “pasto en todo el campo”
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
    } catch {}

    // Mover el campo de pasto para que siga al jugador (infinite/always-under-foot)
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
    } catch {}

    // Vector de avance (para reveal direccional)
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
    } catch {}

    // “Pintar” máscara persistente (trail) en un radio alrededor del player
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
          } catch {}
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
    } catch {}
  })

  if (!enabled || finalCount <= 0) return null
  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, material, finalCount]}
      // Instanced meshes se culean mal si el bounding sphere no incluye todas las instancias.
      // Mantener visible (1 drawcall igual).
      frustumCulled={false}
      renderOrder={-10}
      position={[0, 0.0, 0]}
    />
  )
}

