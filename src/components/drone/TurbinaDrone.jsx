import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMPO_MAX as MAX, VERT_CAMPO as VERT, FRAG_CAMPO as FRAG, VERT_CHISPA, FRAG_CHISPA } from '../../lib/fuegoToon.js'

// El fuego de la turbinita de atrás del drone (Oscar, 2026-11-19: "debe expulsar
// fuego y partículas cuando avanza"). Misma receta que la llama de la mano de
// Skulley (fx/LlamaMano.jsx): bocanadas con inercia que viven en el mundo (si el
// drone avanza o gira, lo que ya salió se queda atrás), fundidas en un campo de
// metaballs con bandas duras (orilla oscura, media, clara y un centro chico, sin
// blanco), sobre un cuadro que mira a la cámara y se recorta a donde hay fuego.
// Más chispas sueltas que salen disparadas y caen.
//
// `boquillaRef`: un Object3D en la boca de la turbina; `dir` (en su espacio) es
// hacia donde sale el fuego. `escala`: unidades del mundo por unidad del modelo
// (los tamaños de aquí van en unidades del modelo). `intensidad` (ref, 0..2):
// 0 apagado, 1 avanzando, más de 1 el golpe del arranque. `enojoRef`: el uniform
// del enojo de la cara; con él el fuego se pone rojo como la luz del drone.
// Siempre montado: sin fuego el campo no tiene bocanadas y las chispas tienen
// count 0, y los dos programas se compilan desde el primer cuadro. Todo vive en
// el mundo sin heredar nada de su padre (matrixWorld a mano), así da igual
// dónde se monte.

const FUEGO = { porSegundo: 100, vida: [0.22, 0.4], velocidad: 5.4, abre: 0.6, aire: 2.8, hereda: 0.85, tam: [0.24, 0.36] }
const CHISPAS = { max: 80, porSegundo: 34, vida: [0.35, 0.75], velocidad: [3.5, 6.5], abre: 1.6, gravedad: 2.5, aire: 1.5 }
const BANDAS = { orilla: 0.32, medio: 0.7, claro: 1.25, centro: 2.4 }
const PALETA = {
  frio: ['#0a2fc4', '#1683ff', '#3fdcff', '#8ff6ff'],
  rojo: ['#7a0600', '#ff2a1c', '#ff8a3a', '#ffe0a8'],
}

const azar = (a, b) => a + Math.random() * (b - a)
const _p = new THREE.Vector3()
const _d = new THREE.Vector3()
const _v = new THREE.Vector3()
const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _c = new THREE.Vector3()
const _prev = new THREE.Vector3()
const _q = new THREE.Vector3()

export default function TurbinaDrone({ boquillaRef, dir = [0, 0, -1], escala = 1, intensidad, enojoRef }) {
  const { camera, size, gl } = useThree()
  const colores = useMemo(() => ({
    frio: PALETA.frio.map((c) => new THREE.Color(c)),
    rojo: PALETA.rojo.map((c) => new THREE.Color(c)),
  }), [])

  const campo = useMemo(() => {
    const u = {
      uBolas: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
      uN: { value: 0 },
      uTiempo: { value: 0 },
      uC0: { value: new THREE.Color() }, uC1: { value: new THREE.Color() },
      uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() },
      uBandas: { value: new THREE.Vector4(BANDAS.orilla, BANDAS.medio, BANDAS.claro, BANDAS.centro) },
    }
    const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, depthWrite: false, toneMapped: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m)
    mesh.frustumCulled = false
    mesh.renderOrder = 2
    mesh.matrixAutoUpdate = false
    mesh.matrixWorldAutoUpdate = false
    return { mesh, u }
  }, [])

  const chispas = useMemo(() => {
    const n = CHISPAS.max
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aTam', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
    g.setDrawRange(0, 0)
    const m = new THREE.ShaderMaterial({
      uniforms: { uEscalaPx: { value: 1 } }, vertexShader: VERT_CHISPA, fragmentShader: FRAG_CHISPA, toneMapped: false,
    })
    const pts = new THREE.Points(g, m)
    pts.frustumCulled = false
    pts.matrixAutoUpdate = false
    pts.matrixWorldAutoUpdate = false
    return { pts, g, m, vivas: [] }
  }, [])

  useEffect(() => () => {
    campo.mesh.geometry.dispose(); campo.mesh.material.dispose()
    chispas.g.dispose(); chispas.m.dispose()
  }, [campo, chispas])

  const est = useRef({ bocanadas: [], resto: 0, restoCh: 0, prev: null, vel: new THREE.Vector3(), t: 0 })

  useFrame((_, dtReal) => {
    const dt = Math.min(dtReal, 1 / 20)
    const e = est.current
    e.t += dt
    const boq = boquillaRef?.current
    if (!boq) return
    boq.updateWorldMatrix(true, false)
    boq.getWorldPosition(_p)
    _d.set(dir[0], dir[1], dir[2]).transformDirection(boq.matrixWorld)
    // velocidad de la boquilla en el mundo (para que el fuego herede el avance)
    if (e.prev) _v.subVectors(_p, e.prev).divideScalar(Math.max(dt, 1e-4))
    else _v.set(0, 0, 0)
    e.vel.lerp(_v, 0.5)
    e.prev = (e.prev || new THREE.Vector3()).copy(_p)

    const I = Math.max(0, intensidad?.current ?? 0)
    const s = escala
    // nacen bocanadas
    e.resto += FUEGO.porSegundo * Math.min(I, 1.6) * dt
    while (e.resto >= 1) {
      e.resto -= 1
      if (e.bocanadas.length >= MAX) e.bocanadas.shift()
      const vel = _d.clone().multiplyScalar(FUEGO.velocidad * s * (0.8 + 0.35 * I) * azar(0.85, 1.15))
      vel.add(new THREE.Vector3(azar(-1, 1), azar(-1, 1), azar(-1, 1)).multiplyScalar(FUEGO.abre * s))
      vel.addScaledVector(e.vel, FUEGO.hereda)
      const vida = azar(...FUEGO.vida) * (0.75 + 0.25 * Math.min(I, 1.6))
      e.bocanadas.push({ p: _p.clone().addScaledVector(_d, 0.04 * s), v: vel, t: 0, vida, r: azar(...FUEGO.tam) * s * (0.7 + 0.3 * Math.min(I, 1.6)) })
    }
    // avanzan: el aire las frena hacia la velocidad del aire quieto
    const aire = Math.exp(-FUEGO.aire * dt)
    e.bocanadas = e.bocanadas.filter((b) => (b.t += dt) < b.vida)
    for (const b of e.bocanadas) { b.v.multiplyScalar(aire); b.p.addScaledVector(b.v, dt) }

    // el cuadro: de frente a la cámara, recortado a donde hay fuego
    const n = e.bocanadas.length
    campo.u.uN.value = n
    campo.u.uTiempo.value = e.t
    const en = enojoRef?.current?.value ?? 0
    for (let k = 0; k < 4; k++) campo.u[`uC${k}`].value.copy(colores.frio[k]).lerp(colores.rojo[k], en)
    if (n > 0) {
      // Cada bocanada se coloca donde se VE sobre el cuadro (un plano de frente a
      // la cámara a la profundidad del centro): en el espacio de la vista y
      // escalada por la perspectiva, como en LlamaMano. Proyectada plano, con la
      // cámara alta del home lo cercano y lo lejano del chorro se corrían y
      // salía chueco y despegado de la turbina (Oscar).
      camera.updateMatrixWorld()
      _x.setFromMatrixColumn(camera.matrixWorld, 0)
      _y.setFromMatrixColumn(camera.matrixWorld, 1)
      const persp = camera.isPerspectiveCamera
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      _c.set(0, 0, 0)
      for (const b of e.bocanadas) _c.add(b.p)
      _c.divideScalar(n)
      _q.copy(_c).applyMatrix4(camera.matrixWorldInverse)
      const loc = []
      for (const b of e.bocanadas) {
        const k = b.t / b.vida
        // crece rápido al nacer y se consume al final
        const r0 = b.r * Math.min(1, k / 0.18 + 0.35) * (1 - k * k)
        _v.copy(b.p).applyMatrix4(camera.matrixWorldInverse)
        const esc = persp ? _q.z / Math.min(-1e-4, _v.z) : 1
        const x = _v.x * esc - _q.x, y = _v.y * esc - _q.y, r = r0 * esc
        loc.push([x, y, Math.max(r, 1e-4), 1.15 - 0.5 * k])
        x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r)
      }
      const w = Math.max(x1 - x0, 1e-3), h = Math.max(y1 - y0, 1e-3)
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
      for (let i = 0; i < n; i++) {
        const [x, y, r, wgt] = loc[i]
        campo.u.uBolas.value[i].set((x - cx) / w, (y - cy) / h, r / Math.max(w, h), wgt)
      }
      // el cuadro es cuadrado en su espacio (el radio se mide igual en x y y)
      const lado = Math.max(w, h)
      for (let i = 0; i < n; i++) {
        const b = campo.u.uBolas.value[i]
        b.x *= w / lado; b.y *= h / lado
      }
      campo.mesh.position.copy(_c).addScaledVector(_x, cx).addScaledVector(_y, cy)
      campo.mesh.quaternion.copy(camera.quaternion)
      campo.mesh.scale.set(lado, lado, 1)
    } else {
      campo.mesh.scale.set(1e-4, 1e-4, 1)
    }
    campo.mesh.matrixWorld.compose(campo.mesh.position, campo.mesh.quaternion, campo.mesh.scale)

    // chispas
    e.restoCh += CHISPAS.porSegundo * Math.min(I, 1.8) * dt
    while (e.restoCh >= 1) {
      e.restoCh -= 1
      if (chispas.vivas.length >= CHISPAS.max) chispas.vivas.shift()
      const v = _d.clone().multiplyScalar(azar(...CHISPAS.velocidad) * s)
      v.add(new THREE.Vector3(azar(-1, 1), azar(-1, 1), azar(-1, 1)).multiplyScalar(CHISPAS.abre * s))
      v.addScaledVector(e.vel, 0.7)
      chispas.vivas.push({ p: _p.clone(), v, t: 0, vida: azar(...CHISPAS.vida), tam: azar(0.035, 0.07) * s, c: Math.random() < 0.5 ? 2 : 1 })
    }
    const aireCh = Math.exp(-CHISPAS.aire * dt)
    chispas.vivas = chispas.vivas.filter((c) => (c.t += dt) < c.vida)
    const pos = chispas.g.attributes.position.array
    const tam = chispas.g.attributes.aTam.array
    const col = chispas.g.attributes.aColor.array
    chispas.vivas.forEach((c, i) => {
      c.v.multiplyScalar(aireCh)
      c.v.y -= CHISPAS.gravedad * s * dt
      c.p.addScaledVector(c.v, dt)
      pos[i * 3] = c.p.x; pos[i * 3 + 1] = c.p.y; pos[i * 3 + 2] = c.p.z
      tam[i] = c.tam * (1 - c.t / c.vida)
      const cc = colores.frio[c.c].clone().lerp(colores.rojo[c.c], en)
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b
    })
    chispas.g.setDrawRange(0, chispas.vivas.length)
    chispas.g.attributes.position.needsUpdate = true
    chispas.g.attributes.aTam.needsUpdate = true
    chispas.g.attributes.aColor.needsUpdate = true
    // tamaño de las chispas en pixeles a 1 unidad de distancia
    const fov = camera.isPerspectiveCamera ? THREE.MathUtils.degToRad(camera.fov) : 1
    chispas.m.uniforms.uEscalaPx.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan(fov / 2))
  }, 0.5)

  return (
    <>
      <primitive object={campo.mesh} />
      <primitive object={chispas.pts} />
    </>
  )
}
