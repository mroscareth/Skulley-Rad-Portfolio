import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Lo que la esfera se traga mientras carga: chispas que llegan del frente, de donde va a
// salir el rayo, y entran girando cada vez más rápido. Más carga, más chispas y más prisa.
//
// Son las mismas de la carga de la patada (pedido de Oscar): viven en `sparksRef` y las
// pinta TrailSparks, así que no agregan malla ni programa. TrailSparks no las mueve
// (`t: 'laserSpark'`): el camino lo lleva este componente.

const POOL = 96
const RATE = [12, 150]      // chispas por segundo: goteo al arrancar, fuente con carga llena
const LIFE = [0.7, 0.4]     // lo que tarda una en llegar, igual
const REACH = [0.9, 3.2]    // de qué tan lejos sale
const MOUTH = [0.35, 1]     // qué tan abierta va la boca: radio entre distancia
const FLAT = 0.6            // la boca es más ancha que alta: si no, media nube cae en el piso
const SWIRL = 1.8           // lo que gira en el camino, en radianes
const PULL = 1.6            // qué tanto acelera al entrar: con más se quedan amontonadas lejos
const GLOW = 1.5            // el color de la esfera, subido: el shader de las chispas lo baja
const BRIGHT = [0.45, 1]    // brillo que le prestan al shader, como la patada
const TILT = 0.5            // la nube mira hacia la mira, pero menos inclinada que el rayo
const FOLLOW = 12           // qué tan rápido gira con la puntería
const RELEASE = 3           // al soltar, las que iban en camino acaban de entrar de golpe
const FLOOR_GAP = 0.08

const UP = new THREE.Vector3(0, 1, 0)
const lerp = (a, b, k) => a + (b - a) * k
const between = ([a, b]) => lerp(a, b, Math.random())

export default function LaserInhale({ aimRef, chargeRef, poseRef, sparksRef, boostRef, tintRef }) {
  const stateRef = useRef({ was: false, due: 0 })
  const pool = useMemo(() => Array.from({ length: POOL }, () => ({
    on: false, u: 0, life: 1, reach: 1, mouth: 0.5, angle: 0,
    spark: { pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, t: 'laserSpark' },
  })), [])
  const tmp = useMemo(() => ({
    orb: new THREE.Vector3(),
    axis: new THREE.Vector3(0, 0, 1),
    want: new THREE.Vector3(),
    side: new THREE.Vector3(),
    up: new THREE.Vector3(),
  }), [])

  useFrame((state, delta) => {
    const a = aimRef.current
    if (!a) return
    const s = stateRef.current
    const { orb, axis, want, side, up } = tmp
    const step = Math.min(delta, 0.05)
    // `fresh`: la mira todavía no llega a su lugar, apuntaría al disparo anterior.
    const charging = a.on && !a.fresh
    const c = THREE.MathUtils.clamp(chargeRef.current, 0, 1)
    const tint = tintRef.current

    orb.set(a.ex, a.ey, a.ez)
    if (charging) {
      want.set(a.x - a.ex, (a.y - a.ey) * TILT, a.z - a.ez).normalize()
      if (s.was) axis.lerp(want, 1 - Math.exp(-FOLLOW * step)).normalize()
      else {
        axis.copy(want)
        s.due = 1
      }
      s.due += step * lerp(RATE[0], RATE[1], c * c)
      boostRef.current = Math.max(boostRef.current, lerp(BRIGHT[0], BRIGHT[1], c))
      poseRef.current?.orbColor?.(tint.color)
      tint.color.multiplyScalar(GLOW)
      tint.on = true
    }
    s.was = charging
    side.crossVectors(axis, UP).normalize()
    up.crossVectors(side, axis).multiplyScalar(FLAT)

    let alive = false
    const floor = a.y + FLOOR_GAP
    pool.forEach((item) => {
      if (!item.on && charging && s.due >= 1) {
        s.due -= 1
        item.on = true
        item.u = 0
        item.life = lerp(LIFE[0], LIFE[1], c) * (0.85 + Math.random() * 0.3)
        item.reach = between(REACH)
        item.mouth = between(MOUTH)
        item.angle = Math.random() * Math.PI * 2
        item.spark.life = 1
        sparksRef.current.push(item.spark)
      }
      if (!item.on) return
      item.u += (step / item.life) * (charging ? 1 : RELEASE)
      if (item.u >= 1) {
        item.on = false
        item.spark.life = 0
        return
      }
      // Se cierra más rápido de lo que se acerca, y acelera hasta entrar.
      const k = 1 - Math.pow(item.u, PULL)
      const radial = item.reach * item.mouth * Math.pow(k, 1.4)
      const angle = item.angle + SWIRL * (1 - k)
      const pos = item.spark.pos
      pos.copy(orb)
        .addScaledVector(axis, item.reach * k)
        .addScaledVector(side, Math.cos(angle) * radial)
        .addScaledVector(up, Math.sin(angle) * radial)
      if (pos.y < floor) pos.y = floor
      alive = true
    })
    s.due = Math.min(s.due, 2)
    tint.hold = alive
  })

  return null
}
