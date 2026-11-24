import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// El humo del drone de M.A.D.R.E. cuando la quema el rayo de la esfera
// corrupta (DroneNPC). Bocanadas toon como las de la explosión de la bola de
// fuego (LaserBeam): bolitas grises en tres tonos a saltos, con su contorno de
// tinta, que suben, se abren y se encogen hasta desaparecer. Mismos materiales
// y geometría que las de LaserBeam, así que usan sus programas: no compila nada.
// Monta desde el principio con todo en tamaño cero.
//
// `fuenteRef.current`: { pos: Vector3 (de dónde sale), nivel: 0..1 (cuánto humea) }.
// `config` (al montar) cambia cuántas, cuántas por segundo, su vida, tamaño, subida, cuánto se abren y sus tres tonos
// (del que nace al que se va): así sale también el fuego y la ceniza de la guitarra del solo (Player), con los
// mismos programas.

const BASE = {
  n: 40,
  porSegundo: 11,               // con nivel 1
  vida: [1.3, 2.1],
  tam: [0.1, 0.19],             // al nacer; crece hasta ~2.1 veces
  sube: [0.9, 1.5],
  abre: 0.35,
  outline: 0.035,
  tonos: ['#2b2a31', '#57555f', '#8c8a96'],
}

export default function HumoDron({ fuenteRef, config }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const C = useMemo(() => {
    const c = { ...BASE, ...(config || {}) }
    return { ...c, tonos: c.tonos.map((t) => new THREE.Color(t)) }
  }, [])
  const N = C.n
  const POR_SEGUNDO = C.porSegundo
  const VIDA = C.vida
  const TAM = C.tam
  const SUBE = C.sube
  const OUTLINE = C.outline
  const TONOS = C.tonos
  const humoRef = useRef(null)
  const tintaRef = useRef(null)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 2), [])
  const mats = useMemo(() => ({
    humo: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    tinta: new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide, toneMapped: false }),
  }), [])
  const est = useRef(null)
  if (!est.current) {
    est.current = {
      acc: 0,
      vivos: 0,
      p: Array.from({ length: N }, () => ({ vivo: false, t: 0, vida: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, tono: 0 })),
      sucio: true,
    }
  }
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3() }), [])

  // el color por instancia desde el montaje: si nace en la primera bocanada, recompila
  useEffect(() => {
    const h = humoRef.current
    const t = tintaRef.current
    if (!h || !t) return
    tmp.m.compose(tmp.v.set(0, 0, 0), tmp.q, tmp.s.setScalar(0))
    for (let i = 0; i < N; i++) {
      h.setMatrixAt(i, tmp.m)
      t.setMatrixAt(i, tmp.m)
      h.setColorAt(i, TONOS[0])
    }
    h.instanceMatrix.needsUpdate = true
    t.instanceMatrix.needsUpdate = true
    if (h.instanceColor) h.instanceColor.needsUpdate = true
  }, [tmp])

  useEffect(() => () => { geo.dispose(); mats.humo.dispose(); mats.tinta.dispose() }, [geo, mats])

  useFrame((_, dtReal) => {
    const h = humoRef.current
    const t = tintaRef.current
    if (!h || !t) return
    const dt = Math.min(dtReal, 1 / 20)
    const e = est.current
    const f = fuenteRef?.current
    const nivel = f ? Math.max(0, Math.min(1, f.nivel || 0)) : 0
    // nacen
    if (nivel > 0 && f?.pos) {
      e.acc += dt * POR_SEGUNDO * nivel
      while (e.acc >= 1) {
        e.acc -= 1
        const b = e.p.find((x) => !x.vivo)
        if (!b) { e.acc = 0; break }
        const a = Math.random() * Math.PI * 2
        const r0 = Math.random() * C.abre
        b.vivo = true
        b.t = 0
        b.vida = VIDA[0] + Math.random() * (VIDA[1] - VIDA[0])
        b.x = f.pos.x + Math.cos(a) * r0
        b.y = f.pos.y + 0.15 + Math.random() * 0.2
        b.z = f.pos.z + Math.sin(a) * r0
        b.vx = Math.cos(a) * 0.25 + (Math.random() - 0.5) * 0.2
        b.vz = Math.sin(a) * 0.25 + (Math.random() - 0.5) * 0.2
        b.vy = SUBE[0] + Math.random() * (SUBE[1] - SUBE[0])
        b.r = (TAM[0] + Math.random() * (TAM[1] - TAM[0])) * (0.6 + 0.4 * nivel)
        b.tono = Math.random() < 0.35 ? 0 : 1
      }
    } else e.acc = 0
    // viven
    let vivos = 0
    for (let i = 0; i < N; i++) {
      const b = e.p[i]
      let radio = 0
      if (b.vivo) {
        b.t += dt
        const k = b.t / b.vida
        if (k >= 1) b.vivo = false
        else {
          vivos++
          b.vy *= Math.exp(-dt * 0.6)
          b.x += b.vx * dt
          b.y += b.vy * dt
          b.z += b.vz * dt
          // crece rápido, se abre y al final se encoge (sin transparencia)
          const crece = 1 - Math.pow(1 - Math.min(1, k / 0.35), 2)
          const encoge = k > 0.6 ? 1 - Math.pow((k - 0.6) / 0.4, 2) : 1
          radio = b.r * (1 + 1.1 * crece) * encoge
          // se aclara a saltos mientras sube
          const tono = Math.min(2, b.tono + (k > 0.45 ? 1 : 0))
          h.setColorAt(i, TONOS[tono])
        }
      }
      tmp.m.compose(tmp.v.set(b.x, b.y, b.z), tmp.q, tmp.s.setScalar(radio))
      h.setMatrixAt(i, tmp.m)
      tmp.m.compose(tmp.v, tmp.q, tmp.s.setScalar(radio > 0 ? radio + OUTLINE : 0))
      t.setMatrixAt(i, tmp.m)
    }
    // una vuelta más al apagarse para dejar todo en cero
    if (vivos || e.sucio) {
      h.instanceMatrix.needsUpdate = true
      t.instanceMatrix.needsUpdate = true
      if (h.instanceColor) h.instanceColor.needsUpdate = true
    }
    e.sucio = vivos > 0
    e.vivos = vivos
  })

  const props = { frustumCulled: false, raycast: () => null }
  return (
    <>
      <instancedMesh {...props} ref={tintaRef} args={[geo, mats.tinta, N]} />
      <instancedMesh {...props} ref={humoRef} args={[geo, mats.humo, N]} />
    </>
  )
}
