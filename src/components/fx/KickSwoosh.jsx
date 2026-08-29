import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Líneas de movimiento de la PATADA — speed lines de cómic.
//
// UN trazo siguiendo el arco del pie, no una superficie. Se intentó primero con
// una cinta rellena (blade trail) y el problema no eran sus proporciones: por
// fina o ancha que se hiciera, una superficie anclada al pie se lee como una
// barra saliendo del pie, nunca como movimiento. También se probó con varias
// líneas concéntricas y se leían como un peine.
//
// El trazo es un quad-strip que encara a la cámara (si no, al ver el arco de
// canto desaparecería), se afina hacia la cola y se apaga.
//
// El muestreo del rastro es por DISTANCIA, no por frame: el swing dura ~75ms
// (4 frames a 60fps) y una muestra por frame daba un polígono en vez de un arco.
//
// `activeRef` lleva la potencia (0..1) mientras barre, -1 mientras el gesto
// todavía se prepara (ahí solo se memoriza dónde está el pie, para que el trazo
// arranque desde el fondo del recorrido) y 0 fuera.

const MAX = 44          // muestras del rastro
const STEP = 0.05       // distancia entre muestras (unidades de mundo)
const TIP_EXTEND = 0.18 // la trayectoria se toma un poco más allá del pie
const FADE = 0.18       // segundos que tarda en apagarse al acabar el gesto
const LINE_W = 0.075    // media anchura del trazo (unidades de mundo)
const HIP_Y = 0.85      // altura aproximada de la cadera sobre el piso

// UNA sola línea. `k` es su radio respecto a la cadera (1 = el arco exacto del
// pie; 1.06 la deja justo por fuera, rozando la punta), `len` la fracción del
// rastro que cubre y `a` su opacidad. El array se mantiene por si alguna vez se
// quieren trazos de acompañamiento — con varios se leía como un peine.
const LINES = [
  { k: 1.06, len: 1.00, a: 1.00 },
]
const NL = LINES.length

export default function KickSwoosh({ activeRef, bonesRef, originRef }) {
  const groupRef = useRef(null)
  const matRef = useRef(null)
  const fadeRef = useRef(0)
  const powerRef = useRef(0.5)

  const trail = useMemo(() => ({
    pts: Array.from({ length: MAX }, () => new THREE.Vector3()),
    n: 0,
    last: new THREE.Vector3(),
    started: false,
  }), [])

  const tmp = useMemo(() => ({
    knee: new THREE.Vector3(),
    tip: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    seg: new THREE.Vector3(),
    a: new THREE.Vector3(),
    pivot: new THREE.Vector3(),
    p: new THREE.Vector3(),
    q: new THREE.Vector3(),
    tan: new THREE.Vector3(),
    view: new THREE.Vector3(),
    side: new THREE.Vector3(),
  }), [])

  const geom = useMemo(() => {
    const count = NL * MAX * 2
    const positions = new Float32Array(count * 3)
    const alphas = new Float32Array(count)
    const index = []
    for (let j = 0; j < NL; j += 1) {
      const base = j * MAX * 2
      for (let i = 0; i < MAX - 1; i += 1) {
        const a = base + i * 2
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    geo.setIndex(index)
    return { geo, positions, alphas }
  }, [])

  const shader = useMemo(() => ({
    uniforms: {
      uColor: { value: new THREE.Color('#f4feff') },
      uOpacity: { value: 0 },
    },
    vertexShader: [
      'attribute float aAlpha;',
      'varying float vA;',
      'void main() {',
      '  vA = aAlpha;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uColor;',
      'uniform float uOpacity;',
      'varying float vA;',
      'void main() {',
      '  float a = vA * uOpacity;',
      '  if (a <= 0.004) discard;',
      '  gl_FragColor = vec4(uColor, a);',
      '}',
    ].join('\n'),
  }), [])

  React.useEffect(() => () => {
    try { geom.geo.dispose() } catch { }
  }, [geom])

  const pushSample = (v) => {
    const pts = trail.pts
    for (let i = MAX - 1; i > 0; i -= 1) pts[i].copy(pts[i - 1])
    pts[0].copy(v)
    if (trail.n < MAX) trail.n += 1
  }

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return
    const power = activeRef?.current || 0
    const dt = Math.min(Math.max(delta || 0, 0), 0.05)

    if (power !== 0) {
      if (power > 0) powerRef.current = power
      const bones = bonesRef?.current
      const knee = bones && (bones.leg_stretchl || bones.thigh_stretchl)
      const foot = bones && (bones.toes_01l || bones.footl)
      if (knee && foot) {
        knee.getWorldPosition(tmp.knee)
        foot.getWorldPosition(tmp.tip)
        tmp.dir.subVectors(tmp.tip, tmp.knee)
        if (tmp.dir.lengthSq() > 1e-8) tmp.tip.addScaledVector(tmp.dir.normalize(), TIP_EXTEND)

        if (power < 0) {
          // Solo semilla: mover el ancla sin acumular rastro. El temblor de la
          // carga generaría muestras basura si se acumulara.
          trail.started = true
          trail.n = 0
          trail.last.copy(tmp.tip)
        } else if (!trail.started) {
          trail.started = true
          trail.last.copy(tmp.tip)
          pushSample(tmp.tip)
        } else {
          tmp.seg.subVectors(tmp.tip, trail.last)
          const d = tmp.seg.length()
          if (d >= STEP) {
            let steps = Math.floor(d / STEP)
            if (steps > MAX) steps = MAX
            for (let i = 1; i <= steps; i += 1) {
              tmp.a.copy(trail.last).addScaledVector(tmp.seg, i / steps)
              pushSample(tmp.a)
            }
            trail.last.copy(tmp.tip)
          }
        }
      }
      fadeRef.current = power > 0 ? 1 : 0
    } else if (fadeRef.current > 0) {
      fadeRef.current = Math.max(0, fadeRef.current - dt / FADE)
      if (fadeRef.current === 0) {
        trail.n = 0
        trail.started = false
      }
    }

    const n = trail.n
    const visible = n >= 3 && fadeRef.current > 0
    if (g.visible !== visible) g.visible = visible
    if (!visible) return

    // Pivote de los arcos concéntricos: la cadera.
    if (originRef?.current) {
      originRef.current.getWorldPosition(tmp.pivot)
      tmp.pivot.y += HIP_Y
    } else {
      tmp.pivot.copy(trail.pts[n - 1])
    }

    const cam = state.camera
    const pos = geom.positions
    const al = geom.alphas
    const pw = powerRef.current
    let w = LINE_W
    try {
      const c = window.__kickCfg
      if (c && typeof c.lineW === 'number') w = c.lineW
    } catch { }

    for (let j = 0; j < NL; j += 1) {
      const cfg = LINES[j]
      const base = j * MAX * 2
      // Cada línea cubre solo una fracción del rastro.
      const last = Math.max(2, Math.floor((n - 1) * cfg.len))
      for (let i = 0; i < MAX; i += 1) {
        const k = Math.min(i, last)
        // Arco concéntrico: la muestra escalada respecto a la cadera.
        tmp.p.copy(tmp.pivot).addScaledVector(
          tmp.a.subVectors(trail.pts[k], tmp.pivot), cfg.k,
        )
        const kn = Math.min(k + 1, last)
        tmp.q.copy(tmp.pivot).addScaledVector(
          tmp.a.subVectors(trail.pts[kn], tmp.pivot), cfg.k,
        )
        tmp.tan.subVectors(tmp.p, tmp.q)
        if (tmp.tan.lengthSq() < 1e-9) tmp.tan.set(0, 1, 0)
        tmp.tan.normalize()
        tmp.view.subVectors(cam.position, tmp.p).normalize()
        tmp.side.crossVectors(tmp.tan, tmp.view)
        if (tmp.side.lengthSq() < 1e-9) tmp.side.set(1, 0, 0)
        tmp.side.normalize()

        // El trazo se afina hacia la cola: una línea de grosor constante se ve
        // como un alambre, no como un trazo dibujado.
        const f = i / Math.max(1, last)
        const taper = Math.max(0.4, 1 - f * 0.6)
        const ww = w * taper
        const a = i <= last
          ? Math.pow(1 - Math.min(1, f), 0.7) * cfg.a * (0.6 + 0.4 * pw)
          : 0

        const o = (base + i * 2) * 3
        pos[o + 0] = tmp.p.x + tmp.side.x * ww
        pos[o + 1] = tmp.p.y + tmp.side.y * ww
        pos[o + 2] = tmp.p.z + tmp.side.z * ww
        pos[o + 3] = tmp.p.x - tmp.side.x * ww
        pos[o + 4] = tmp.p.y - tmp.side.y * ww
        pos[o + 5] = tmp.p.z - tmp.side.z * ww
        al[base + i * 2 + 0] = a
        al[base + i * 2 + 1] = a
      }
    }

    geom.geo.attributes.position.needsUpdate = true
    geom.geo.attributes.aAlpha.needsUpdate = true
    if (matRef.current) matRef.current.uniforms.uOpacity.value = 0.95 * fadeRef.current
  })

  return (
    <group ref={groupRef} visible={false} renderOrder={40}>
      <mesh geometry={geom.geo} frustumCulled={false}>
        <shaderMaterial
          ref={matRef}
          args={[shader]}
          transparent
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
