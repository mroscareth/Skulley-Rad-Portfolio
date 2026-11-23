import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { applyNeonOrb } from '../../lib/applyNeonOrb.js'
import makeHullOutline from '../../lib/makeHullOutline.js'

// El modo esfera en 3D (Oscar, 2026-11-23: "se ve bien feo el efecto"; pidió mejorar lo
// que había, todo en 3D, nada de dibujos planos). La esfera ya no es una bola blanca
// quemada: tiene el neón toon de las esferas del juego (el brillo en tres bandas según
// el ángulo, con el contorno de tinta) en el color del viaje, que va del azul claro al
// del portal (eso va en Player). Lo de aquí, `EstelaTubo`: un tubo que la sigue por el
// camino y se afila hacia atrás, del mismo
// neón con su contorno, y chispas (octaedros con tinta) que se desprenden, giran y
// caen. Viven en el mundo: no heredan nada del grupo de la esfera. (Dos anillos que
// giraban alrededor, como giroscopio, no le gustaron a Oscar.)
// El material es el de las esferas del juego (mismos parámetros de applyNeonOrb y
// transparente con opacidad 1): mismo programa, ya compilado. Todo montado siempre.

const NEON = { steps: 3, rimMul: 0.45, coreMul: 1.8, power: 1.4 }

function materialNeon() {
  const m = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#aee2ff', emissiveIntensity: 1, roughness: 1, metalness: 0, transparent: true, opacity: 1 })
  applyNeonOrb(m, NEON)
  return m
}

const copiarColor = (destino, colorRef, k = 1) => {
  const m = colorRef?.current
  if (m?.emissive) destino.emissive.copy(m.emissive)
  destino.emissiveIntensity = k
}

const TUBO = {
  muestras: 30,       // anillos del tubo a lo largo
  lados: 10,          // vértices de cada anillo
  cada: 0.17,         // una muestra nueva cada tanto recorrido
  radio: 0.46,        // en la cabeza (la esfera mide 0.6: la cabeza queda adentro)
  afila: 0.85,        // curva del afilado hacia la cola
}
const CHISPAS = {
  max: 40,
  cada: 0.035,        // segundos entre chispas mientras viaja
  vida: [0.5, 0.85],
  tam: 0.11,
}

export function EstelaTubo({ orbeRef, mostrarRef, colorRef, apagada = false }) {
  const r = useMemo(() => {
    const { muestras: N, lados: M } = TUBO
    const geo = new THREE.BufferGeometry()
    const pos = new THREE.BufferAttribute(new Float32Array(N * M * 3), 3)
    const nor = new THREE.BufferAttribute(new Float32Array(N * M * 3), 3)
    pos.setUsage(THREE.DynamicDrawUsage)
    nor.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', pos)
    geo.setAttribute('normal', nor)
    const idx = []
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < M; j++) {
        const a = i * M + j, b = i * M + ((j + 1) % M), c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M)
        idx.push(a, c, b, b, c, d)
      }
    }
    geo.setIndex(idx)
    geo.setDrawRange(0, 0)
    const matTubo = materialNeon()
    const contornoTubo = makeHullOutline({ color: 0x000000, thickness: 0.03 })
    const tubo = new THREE.Mesh(geo, matTubo)
    const tuboTinta = new THREE.Mesh(geo, contornoTubo)
    tuboTinta.renderOrder = -1
    // Chispas: octaedros con su contorno, que comparten las matrices.
    const geoChispa = new THREE.OctahedronGeometry(CHISPAS.tam, 0)
    const matChispa = materialNeon()
    const contornoChispa = makeHullOutline({ color: 0x000000, thickness: 0.022 })
    const chispas = new THREE.InstancedMesh(geoChispa, matChispa, CHISPAS.max)
    const chispasTinta = new THREE.InstancedMesh(geoChispa, contornoChispa, CHISPAS.max)
    chispasTinta.instanceMatrix = chispas.instanceMatrix
    chispasTinta.renderOrder = -1
    chispas.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const cero = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let i = 0; i < CHISPAS.max; i++) chispas.setMatrixAt(i, cero)
    for (const o of [tubo, tuboTinta, chispas, chispasTinta]) {
      o.frustumCulled = false
      o.matrixAutoUpdate = false
      o.matrixWorldAutoUpdate = false
    }
    const grupo = new THREE.Group()
    grupo.matrixAutoUpdate = false
    grupo.matrixWorldAutoUpdate = false
    grupo.add(tuboTinta, tubo, chispasTinta, chispas)
    return {
      geo, pos, nor, matTubo, contornoTubo, tubo, tuboTinta, geoChispa, matChispa, contornoChispa, chispas, chispasTinta, grupo, cero,
      hist: Array.from({ length: N }, () => new THREE.Vector3()),
      cuantas: 0,
      escala: 0,
      ultimo: new THREE.Vector3(),
      cabeza: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, -1),
      t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3(), v: new THREE.Vector3(),
      // Chispas: posición, velocidad, eje y velocidad de giro, edad y vida.
      cp: Array.from({ length: CHISPAS.max }, () => new THREE.Vector3()),
      cv: Array.from({ length: CHISPAS.max }, () => new THREE.Vector3()),
      ce: Array.from({ length: CHISPAS.max }, () => new THREE.Vector3(0, 1, 0)),
      cw: new Float32Array(CHISPAS.max),
      ca: new Float32Array(CHISPAS.max).fill(1),
      cvida: new Float32Array(CHISPAS.max).fill(1),
      sig: 0, reloj: 0, vivas: 0,
      m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(),
    }
  }, [])

  useEffect(() => () => {
    r.geo.dispose(); r.matTubo.dispose(); r.contornoTubo.dispose()
    r.geoChispa.dispose(); r.matChispa.dispose(); r.contornoChispa.dispose()
  }, [r])

  useEffect(() => { if (import.meta.env.DEV) window.__esferaViaje = r }, [r])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const activa = !apagada && !!mostrarRef?.current && !!orbeRef?.current
    copiarColor(r.matTubo, colorRef, 1.05)
    copiarColor(r.matChispa, colorRef, 1.3)
    // El tubo crece al salir y se encoge al llegar.
    r.escala += ((activa ? 1 : 0) - r.escala) * (1 - Math.exp(-(activa ? 10 : 14) * dt))
    if (activa) {
      orbeRef.current.getWorldPosition(r.cabeza)
      if (r.cuantas === 0) { r.hist[0].copy(r.cabeza); r.ultimo.copy(r.cabeza); r.cuantas = 1 }
      if (r.cabeza.distanceTo(r.ultimo) >= TUBO.cada) {
        // Recorre la historia una casilla y mete la muestra nueva.
        const N = TUBO.muestras
        const ultima = r.hist[N - 1]
        for (let i = N - 1; i > 1; i--) r.hist[i] = r.hist[i - 1]
        r.hist[1] = ultima.copy(r.ultimo)
        r.dir.subVectors(r.cabeza, r.ultimo).normalize()
        r.ultimo.copy(r.cabeza)
        r.cuantas = Math.min(N, r.cuantas + 1)
      }
      r.hist[0].copy(r.cabeza)
    } else if (r.escala < 0.01 && r.cuantas) {
      r.cuantas = 0
    }
    // Arma el tubo: cada anillo perpendicular al camino, el radio se afila hacia atrás.
    const k = r.cuantas
    if (k >= 2 && r.escala > 0.01) {
      const { lados: M } = TUBO
      const P = r.pos.array, Nn = r.nor.array
      for (let i = 0; i < k; i++) {
        const a = r.hist[Math.max(0, i - 1)], b = r.hist[Math.min(k - 1, i + 1)]
        r.t.subVectors(a, b)
        if (r.t.lengthSq() < 1e-8) r.t.copy(r.dir)
        r.t.normalize()
        r.n.set(0, 1, 0).cross(r.t)
        if (r.n.lengthSq() < 1e-6) r.n.set(1, 0, 0).cross(r.t)
        r.n.normalize()
        r.b.crossVectors(r.t, r.n)
        const u = i / (k - 1)
        const rad = TUBO.radio * r.escala * Math.pow(1 - u, TUBO.afila) * (1 + 0.08 * Math.sin(state.clock.elapsedTime * 18 - i * 0.7))
        for (let j = 0; j < M; j++) {
          const ang = (j / M) * Math.PI * 2
          const cx = Math.cos(ang), sx = Math.sin(ang)
          r.v.set(r.n.x * cx + r.b.x * sx, r.n.y * cx + r.b.y * sx, r.n.z * cx + r.b.z * sx)
          const o = (i * M + j) * 3
          P[o] = r.hist[i].x + r.v.x * rad; P[o + 1] = r.hist[i].y + r.v.y * rad; P[o + 2] = r.hist[i].z + r.v.z * rad
          Nn[o] = r.v.x; Nn[o + 1] = r.v.y; Nn[o + 2] = r.v.z
        }
      }
      r.pos.needsUpdate = true
      r.nor.needsUpdate = true
      r.geo.setDrawRange(0, (k - 1) * TUBO.lados * 6)
    } else {
      r.geo.setDrawRange(0, 0)
    }
    // Chispas.
    if (activa) {
      r.reloj += dt
      while (r.reloj >= CHISPAS.cada) {
        r.reloj -= CHISPAS.cada
        const i = r.sig
        r.sig = (i + 1) % CHISPAS.max
        r.cp[i].copy(r.cabeza).add(r.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.7))
        r.cv[i].copy(r.dir).multiplyScalar(-2.2).add(r.v.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(3.2))
        r.ce[i].set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
        r.cw[i] = 8 + Math.random() * 8
        r.ca[i] = 0
        r.cvida[i] = CHISPAS.vida[0] + Math.random() * (CHISPAS.vida[1] - CHISPAS.vida[0])
      }
    }
    let cambio = false
    for (let i = 0; i < CHISPAS.max; i++) {
      if (r.ca[i] >= 1) continue
      cambio = true
      r.ca[i] += dt / r.cvida[i]
      if (r.ca[i] >= 1) { r.chispas.setMatrixAt(i, r.cero); continue }
      r.cv[i].y -= 7 * dt
      r.cv[i].multiplyScalar(Math.exp(-1.5 * dt))
      r.cp[i].addScaledVector(r.cv[i], dt)
      r.q.setFromAxisAngle(r.ce[i], r.cw[i] * r.ca[i] * r.cvida[i])
      const e = Math.pow(1 - r.ca[i], 0.7)
      r.m.compose(r.cp[i], r.q, r.s.set(e, e, e))
      r.chispas.setMatrixAt(i, r.m)
    }
    if (cambio) r.chispas.instanceMatrix.needsUpdate = true
  })

  return <primitive object={r.grupo} />
}
