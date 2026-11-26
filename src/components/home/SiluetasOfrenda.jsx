import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { compileAsyncSafe } from '../../lib/compileAsyncSafe.js'
import { URL_OFRENDAS, ESCALA } from './ObjetosOfrenda.jsx'
import { LUGARES, CAMA } from '../../lib/plazaOfrenda.js'
import { OFRENDAS, ofrendaPuesta } from '../../lib/ofrendas.js'
import { misionesAbiertas } from '../../lib/misionesOfrenda.js'

// La silueta de lo que falta en la plaza de la ofrenda (Oscar, 2026-11-25): en el lugar de cada
// ofrenda que no está puesta, el objeto mismo a su tamaño y en su pose, como fantasma: un color
// plano y tenue, tramado (Bayer 4 × 4, sin transparencia), que respira despacio. Así se sabe qué
// traer sin que nadie lo diga. Al ponerla se encoge a nada (la ofrenda de verdad cae ahí con su
// rayo). Solo con las misiones abiertas (misionesOfrenda.js). Un programa para las seis; se
// compila fuera de la escena antes de montarse y poner una ofrenda no compila nada.

export const SILUETAS = {
  color: '#d9c29a',   // crema tibio: tenue en la plaza oscura, abajo del umbral del bloom
  brillo: 0.5,
  trama: 0.42,        // qué tanto se llena la trama (0 a 1)
  respira: 0.1,       // cuánto sube y baja la trama
  hz: 0.28,
  apaga: 0.35,        // s en irse al ponerla
}
const NADA = 1e-4

const VERT = /* glsl */`
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uTrama;
float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x + q.y * 4.0);
  float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return (m[i] + 0.5) / 16.0;
}
void main() {
  if (bayer(gl_FragCoord.xy) > uTrama) discard;
  gl_FragColor = vec4(uColor, 1.0);
}`

function geometriaDe(gltf, id) {
  const nodo = gltf.scene.children.find((o) => o.name === `Ofrenda_${id}`)
  if (!nodo) return null
  const inv = new THREE.Matrix4().copy(nodo.matrixWorld).invert()
  const geos = []
  nodo.traverse((m) => {
    if (!m.isMesh) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', m.geometry.attributes.position.clone())
    if (m.geometry.index) g.setIndex(m.geometry.index.clone())
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    geos.push(g)
  })
  if (!geos.length) return null
  const unida = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return unida
}

export default function SiluetasOfrenda({ visible = true }) {
  const gltf = useGLTF(URL_OFRENDAS, true)
  const { gl, camera, scene } = useThree()
  const [listo, setListo] = useState(false)
  const abiertas = useMemo(() => misionesAbiertas(), [])

  const armado = useMemo(() => {
    gltf.scene.updateMatrixWorld(true)
    const raiz = new THREE.Group()
    raiz.name = 'SiluetasOfrenda'
    const color = new THREE.Color(SILUETAS.color).multiplyScalar(SILUETAS.brillo)
    const siluetas = []
    OFRENDAS.forEach(({ id }, i) => {
      const geo = geometriaDe(gltf, id)
      const lugar = id === CAMA.id ? CAMA : LUGARES.find((l) => l.id === id)?.mesa
      if (!geo || !lugar) return
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uColor: { value: color.clone() }, uTrama: { value: SILUETAS.trama } },
      })
      const malla = new THREE.Mesh(geo, mat)
      malla.position.set(lugar.x, 0, lugar.z)
      malla.rotation.y = lugar.rot || 0
      const esc = ESCALA[id] || 4
      malla.scale.setScalar(esc)
      malla.userData.esc = esc
      raiz.add(malla)
      siluetas.push({ id, malla, mat, esc, fase: i * 1.7, f: ofrendaPuesta(id) ? 0 : 1 })
    })
    return { raiz, siluetas }
  }, [gltf])

  useEffect(() => {
    let vivo = true
    armado.raiz.updateMatrixWorld(true)
    const rt = new THREE.WebGLRenderTarget(16, 16)
    compileAsyncSafe(gl, armado.raiz, camera, 10000, rt, scene)
      .catch(() => { })
      .finally(() => { rt.dispose(); if (vivo) setListo(true) })
    return () => {
      vivo = false
      for (const s of armado.siluetas) { s.malla.geometry.dispose(); s.mat.dispose() }
    }
  }, [armado, gl, camera, scene])

  const t = useRef(0)
  useFrame((_, delta) => {
    if (!listo || !visible || !abiertas) return
    const dt = Math.min(delta, 0.05)
    t.current += dt
    for (const s of armado.siluetas) {
      const meta = ofrendaPuesta(s.id) ? 0 : 1
      s.f += Math.max(-dt / SILUETAS.apaga, Math.min(dt / SILUETAS.apaga, meta - s.f))
      s.malla.scale.setScalar(s.esc * Math.max(NADA, s.f))
      s.mat.uniforms.uTrama.value = s.f * (SILUETAS.trama + SILUETAS.respira * Math.sin(t.current * SILUETAS.hz * Math.PI * 2 + s.fase))
    }
  })

  if (typeof window !== 'undefined' && import.meta.env.DEV) window.__siluetasOfrenda = { ...armado, SILUETAS, abiertas }
  if (!listo || !abiertas) return null
  return <primitive object={armado.raiz} visible={visible} />
}
