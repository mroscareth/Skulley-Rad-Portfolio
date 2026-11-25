import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Chispas de caricatura de un golpe (Oscar, 2026-11-24: la patada a la Renderbox). Rayitas que salen
// en abanico desde donde pega, estiradas a lo largo de su velocidad, que caen con gravedad, se
// encogen y se apagan. Brillan solas por encima del umbral del bloom. Un solo InstancedMesh montado
// siempre: en reposo `count = 0` (oculto, three no lo compilaría y compilaría en el primer golpe).
//
//   ref.current.disparar([x, y, z], [nx, ny, nz])   // punto del golpe y hacia dónde sale (normal)

export const CHISPAS = {
  max: 48,
  porGolpe: 22,
  vida: [0.32, 0.62],
  velocidad: [2.2, 5.2],
  abanico: 0.95,     // qué tan abierto sale alrededor de la normal (0 = recto)
  subida: 1.4,       // empujón hacia arriba
  gravedad: 9.8,
  largo: 0.16,       // largo de la rayita a velocidad 1 (se estira con la velocidad)
  grueso: 0.022,
  colores: ['#fff6c2', '#ffd23a', '#ff9a1f'],
  brillo: 2.2,
}

const ChispasGolpe = forwardRef(function ChispasGolpe({ escala = 1 }, ref) {
  const malla = useRef()
  const estado = useMemo(() => ({
    vivas: [],
    p: new THREE.Vector3(), v: new THREE.Vector3(),
    m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), y: new THREE.Vector3(0, 1, 0),
    colores: CHISPAS.colores.map((c) => new THREE.Color(c).multiplyScalar(CHISPAS.brillo)),
    color: new THREE.Color(),
  }), [])
  const geo = useMemo(() => {
    // una rayita que apunta en +Y con su base en el origen: se estira hacia atrás de la velocidad
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 5, 1)
    g.translate(0, -0.5, 0)
    return g
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, fog: false }), [])

  useImperativeHandle(ref, () => ({
    disparar(punto, normal = [0, 0, 1]) {
      const n = new THREE.Vector3(...normal).normalize()
      const t1 = new THREE.Vector3(0, 1, 0).cross(n)
      if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0)
      t1.normalize()
      const t2 = n.clone().cross(t1)
      for (let i = 0; i < CHISPAS.porGolpe; i++) {
        if (estado.vivas.length >= CHISPAS.max) estado.vivas.shift()
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * CHISPAS.abanico
        const dir = n.clone().addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).normalize()
        const vel = CHISPAS.velocidad[0] + Math.random() * (CHISPAS.velocidad[1] - CHISPAS.velocidad[0])
        estado.vivas.push({
          p: new THREE.Vector3(...punto),
          v: dir.multiplyScalar(vel * escala).add(new THREE.Vector3(0, CHISPAS.subida * Math.random() * escala, 0)),
          vida: CHISPAS.vida[0] + Math.random() * (CHISPAS.vida[1] - CHISPAS.vida[0]),
          t: 0,
          color: (Math.random() * CHISPAS.colores.length) | 0,
        })
      }
    },
  }), [estado, escala])

  useFrame((_, dt) => {
    const m = malla.current
    if (!m) return
    const d = Math.min(dt, 0.05)
    let n = 0
    for (let i = estado.vivas.length - 1; i >= 0; i--) {
      const c = estado.vivas[i]
      c.t += d
      if (c.t >= c.vida) { estado.vivas.splice(i, 1); continue }
      c.v.y -= CHISPAS.gravedad * escala * d
      c.p.addScaledVector(c.v, d)
      const vida = 1 - c.t / c.vida
      const rapidez = c.v.length()
      estado.q.setFromUnitVectors(estado.y, estado.v.copy(c.v).divideScalar(rapidez || 1))
      const largo = Math.max(0.02, CHISPAS.largo * rapidez * 0.35) * escala * (0.4 + 0.6 * vida)
      const grueso = CHISPAS.grueso * escala * (0.3 + 0.7 * vida)
      estado.m.compose(c.p, estado.q, estado.s.set(grueso, largo, grueso))
      m.setMatrixAt(n, estado.m)
      m.setColorAt(n, estado.color.copy(estado.colores[c.color]).multiplyScalar(0.35 + 0.65 * vida))
      n++
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={malla} args={[geo, mat, CHISPAS.max]} count={0} frustumCulled={false}>
      <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(CHISPAS.max * 3), 3]} />
    </instancedMesh>
  )
})

export default ChispasGolpe
