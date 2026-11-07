import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Lo que la esfera se traga mientras carga: líneas que llegan del frente, de donde va a
// salir el rayo, y entran girando cada vez más rápido. Más carga, más líneas y más prisa.
//
// Son opacas y del mismo tipo de material que la nube de LaserBeam, así que comparten su
// programa. Igual que ella, se quedan en la escena con cero instancias: ocultas, three no
// las recompilaría al cambiar las luces y se notaría en la primera carga.

const POOL = 48
const RATE = [10, 90]       // líneas por segundo, de sin carga a carga llena
const LIFE = [0.6, 0.32]    // lo que tarda una en llegar, igual
const REACH = [2.6, 5.6]    // de qué tan lejos sale
const MOUTH = [0.4, 0.95]   // qué tan abierta va la boca: radio entre distancia
const FLAT = 0.6            // la boca es más ancha que alta: si no, medio embudo cae en el piso
const SWIRL = 1.8           // lo que gira en el camino, en radianes
const TAIL = 0.22           // largo de la línea, en parte del camino
const WIDTH = [0.032, 0.062]
const WHITE_EVERY = 3       // una de cada tres es blanca: el aire que arrastra
const TILT = 0.5            // el embudo mira hacia la mira, pero menos inclinado que el rayo
const FOLLOW = 12           // qué tan rápido gira con la puntería
const RELEASE = 3           // al soltar, las que iban en camino acaban de entrar de golpe
const FLOOR_GAP = 0.08

const UP = new THREE.Vector3(0, 1, 0)
const WHITE = new THREE.Color('#ffffff').multiplyScalar(1.4)
const lerp = (a, b, k) => a + (b - a) * k
const between = ([a, b]) => lerp(a, b, Math.random())

// Punta en el origen y cola hacia -Y: la línea se adelgaza hacia atrás.
function lineGeometry() {
  return new THREE.LatheGeometry([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(1, -0.14),
    new THREE.Vector2(0, -1),
  ], 4)
}

export default function LaserInhale({ aimRef, chargeRef, poseRef }) {
  const meshRef = useRef(null)
  const stateRef = useRef({ was: false, due: 0, serial: 0 })
  const lines = useMemo(() => Array.from({ length: POOL }, () => ({
    on: false, u: 0, life: 1, reach: 1, mouth: 0.5, angle: 0, width: 0.03,
  })), [])
  const tmp = useMemo(() => ({
    orb: new THREE.Vector3(),
    axis: new THREE.Vector3(0, 0, 1),
    want: new THREE.Vector3(),
    side: new THREE.Vector3(),
    up: new THREE.Vector3(),
    head: new THREE.Vector3(),
    tail: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    size: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    matrix: new THREE.Matrix4(),
    tint: new THREE.Color(),
  }), [])

  const geo = useMemo(lineGeometry, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  useEffect(() => () => {
    try {
      geo.dispose()
      mat.dispose()
    } catch { }
  }, [geo, mat])

  // Colores desde el montaje: si el atributo nace en la primera carga, se recompila ahí.
  useEffect(() => {
    const el = meshRef.current
    if (!el) return
    tmp.matrix.makeScale(0, 0, 0)
    for (let i = 0; i < POOL; i += 1) {
      el.setMatrixAt(i, tmp.matrix)
      el.setColorAt(i, WHITE)
    }
  }, [tmp])

  useFrame((state, delta) => {
    const el = meshRef.current
    const a = aimRef.current
    if (!el || !a) return
    const s = stateRef.current
    const { orb, axis, want, side, up, head, tail, dir, size, quat, matrix, tint } = tmp
    const step = Math.min(delta, 0.05)
    // `fresh`: la mira todavía no llega a su lugar, apuntaría al disparo anterior.
    const charging = a.on && !a.fresh
    const c = THREE.MathUtils.clamp(chargeRef.current, 0, 1)

    orb.set(a.ex, a.ey, a.ez)
    if (charging) {
      want.set(a.x - a.ex, (a.y - a.ey) * TILT, a.z - a.ez).normalize()
      if (s.was) axis.lerp(want, 1 - Math.exp(-FOLLOW * step)).normalize()
      else {
        axis.copy(want)
        s.due = 1
      }
      s.due += step * lerp(RATE[0], RATE[1], c)
      poseRef.current?.orbColor?.(tint)
      tint.multiplyScalar(1.3)
    }
    s.was = charging
    side.crossVectors(axis, UP).normalize()
    up.crossVectors(side, axis).multiplyScalar(FLAT)

    let born = false
    let alive = false
    const floor = a.y + FLOOR_GAP
    // Embudo: se cierra más rápido de lo que se acerca, y acelera hasta entrar.
    const place = (out, line, u) => {
      const k = 1 - u * u
      const radial = line.reach * line.mouth * Math.pow(k, 1.4)
      const angle = line.angle + SWIRL * (1 - k)
      out.copy(orb)
        .addScaledVector(axis, line.reach * k)
        .addScaledVector(side, Math.cos(angle) * radial)
        .addScaledVector(up, Math.sin(angle) * radial)
      if (out.y < floor) out.y = floor
    }

    lines.forEach((line, i) => {
      if (!line.on && charging && s.due >= 1) {
        s.due -= 1
        s.serial += 1
        line.on = true
        line.u = 0
        line.life = lerp(LIFE[0], LIFE[1], c) * (0.85 + Math.random() * 0.3)
        line.reach = between(REACH)
        line.mouth = between(MOUTH)
        line.angle = Math.random() * Math.PI * 2
        line.width = between(WIDTH)
        el.setColorAt(i, s.serial % WHITE_EVERY === 0 ? WHITE : tint)
        born = true
      }
      if (!line.on) return
      line.u += (step / line.life) * (charging ? 1 : RELEASE)
      if (line.u >= 1) {
        line.on = false
        matrix.makeScale(0, 0, 0)
        el.setMatrixAt(i, matrix)
        return
      }
      place(head, line, line.u)
      place(tail, line, Math.max(0, line.u - TAIL))
      dir.subVectors(head, tail)
      const length = dir.length()
      if (length > 1e-4) quat.setFromUnitVectors(UP, dir.multiplyScalar(1 / length))
      matrix.compose(head, quat, size.set(line.width, length, line.width))
      el.setMatrixAt(i, matrix)
      alive = true
    })
    s.due = Math.min(s.due, 2)

    el.count = alive ? POOL : 0
    if (alive) el.instanceMatrix.needsUpdate = true
    if (born && el.instanceColor) el.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[geo, mat, POOL]} frustumCulled={false} raycast={() => null} />
  )
}
