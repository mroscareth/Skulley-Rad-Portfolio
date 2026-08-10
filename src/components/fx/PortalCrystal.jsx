import React, { useMemo, useRef, useEffect, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * PortalCrystal — bipirámide de neón que se ARMA arista por arista y se
 * desarma al revés. Dos disparadores, y basta con uno:
 *
 *   1. El cursor entra al item de menú de esa sección (`portal-hover`).
 *   2. El personaje pisa el portal (`near`, derivado de `nearPortalId`).
 *
 * Los dos se resuelven a un solo objetivo 0/1, así que si el cristal ya está
 * armado porque estás parado en el portal, pasar el mouse por el menú no lo
 * re-arma ni lo parpadea: ya está en su destino y no hay nada que animar.
 *
 * El hover llega por `CustomEvent` en vez de por props, a propósito: el estado
 * del nav vive en App.jsx (~4000 líneas de JSX), así que un `useState` allá
 * arriba re-renderizaría el árbol entero cada vez que el mouse pasa por encima
 * de un botón. El evento entra directo a un ref y de ahí al useFrame — cero
 * re-renders. `near` sí viaja como prop porque `nearPortalId` ya era prop de
 * HomeScene: no agrega ningún render que no estuviera pasando.
 *
 * Las 12 aristas son UN InstancedMesh: seis portales × doce cilindros serían
 * 72 draw calls sentados en la escena. Así son 2 por cristal (aristas +
 * cuerpo). Las matrices solo se reescriben mientras la animación corre; ya
 * armado, el bob y el giro los hace el grupo padre.
 *
 * Ojo con `visible`: el grupo se queda SIEMPRE montado y visible, con las
 * aristas en escala 0 cuando está apagado. three se salta los objetos
 * invisibles al renderizar (`projectObject` corta en `visible === false`), así
 * que ocultarlo dejaría el shader sin compilar hasta el primer hover — y ese
 * primer hover pagaría la compilación con un tirón. Mismo aprendizaje que el
 * prewarm del personaje en Player.jsx.
 */

const R = 0.52          // radio del ecuador
const H = 1.06          // media altura (de centro a apex)
const THICK = 0.028     // grosor de arista
const EDGE_COUNT = 12

// Coreografía: el índice de la arista ES su turno. Primero la pirámide de
// abajo (crece desde el apex inferior), luego el ecuador, y al final las
// cuatro que convergen en la punta. Se lee como algo que cristaliza hacia
// arriba, no como un cascarón que aparece de golpe.
const EDGE_STAGGER = 0.04   // desfase por arista, en fracción del total
const EDGE_SPAN = 0.52      // cuánto dura cada arista, en fracción del total

const ASSEMBLE_RATE = 1 / 0.42  // armado completo en 420ms
const COLLAPSE_RATE = 1 / 0.20  // desarmado más rápido: salir no es un evento

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)

function buildEdges() {
  const top = new THREE.Vector3(0, H, 0)
  const bot = new THREE.Vector3(0, -H, 0)
  const eq = [
    new THREE.Vector3(R, 0, 0),
    new THREE.Vector3(0, 0, R),
    new THREE.Vector3(-R, 0, 0),
    new THREE.Vector3(0, 0, -R),
  ]
  const pairs = [
    // pirámide inferior — nacen en el apex de abajo
    [bot, eq[0]], [bot, eq[1]], [bot, eq[2]], [bot, eq[3]],
    // ecuador
    [eq[0], eq[1]], [eq[1], eq[2]], [eq[2], eq[3]], [eq[3], eq[0]],
    // pirámide superior — convergen en la punta
    [eq[0], top], [eq[1], top], [eq[2], top], [eq[3], top],
  ]
  const up = new THREE.Vector3(0, 1, 0)
  return pairs.map(([a, b]) => {
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    dir.normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir)
    return { from: a.clone(), dir: dir.clone(), len, quat }
  })
}

export default function PortalCrystal({ sectionId, color = '#ffffff', enabled = true, near = false, y = 3.0 }) {
  const groupRef = useRef(null)
  const meshRef = useRef(null)
  const bodyRef = useRef(null)

  const edges = useMemo(() => buildEdges(), [])

  // Color base ya "sobreexpuesto": con toneMapped=false, un valor > 1 es lo
  // que cruza el umbral del Bloom de PostFX y se lee como neón en vez de como
  // una línea de color plano.
  const baseColor = useMemo(() => new THREE.Color(color).multiplyScalar(1.7), [color])
  const bodyColor = useMemo(() => new THREE.Color(color), [color])

  const targetRef = useRef(0)   // 1 = hover del menú puesto
  const tRef = useRef(0)        // progreso real del armado
  const prevTRef = useRef(-1)
  const flashRef = useRef(0)    // fogonazo al terminar de armarse
  const flashedRef = useRef(false)

  const tmp = useMemo(() => ({
    m: new THREE.Matrix4(),
    pos: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    color: new THREE.Color(),
  }), [])

  // Las matrices de un InstancedMesh nacen en identidad, o sea doce cilindros
  // de 1×1×1 plantados sobre el portal en el primer frame. Hay que aplastarlas
  // ANTES de que se pinte nada — de ahí el useLayoutEffect.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    tmp.scale.set(0, 0, 0)
    tmp.pos.set(0, 0, 0)
    for (let i = 0; i < EDGE_COUNT; i++) {
      tmp.m.compose(tmp.pos, edges[i].quat, tmp.scale)
      mesh.setMatrixAt(i, tmp.m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [edges, tmp])

  useEffect(() => {
    const onHover = (e) => {
      const id = e?.detail?.id
      targetRef.current = id && id === sectionId ? 1 : 0
    }
    window.addEventListener('portal-hover', onHover)
    return () => window.removeEventListener('portal-hover', onHover)
  }, [sectionId])

  // Apagar la sección (salir de HOME) cancela el hover pendiente: si no, al
  // volver el cristal aparecería ya armado sin que nadie lo pidiera.
  useEffect(() => {
    if (!enabled) targetRef.current = 0
  }, [enabled])

  useFrame((state, delta) => {
    const g = groupRef.current
    const mesh = meshRef.current
    if (!g || !mesh) return

    const dt = Math.min(delta, 0.1) // un tab en background no debe teletransportar la animación
    // Hover del menú O personaje parado en el portal. Cualquiera lo sostiene;
    // se desarma solo cuando se apagan los dos.
    const target = enabled && (targetRef.current === 1 || near) ? 1 : 0
    const rate = target > tRef.current ? ASSEMBLE_RATE : COLLAPSE_RATE
    const t = THREE.MathUtils.clamp(
      tRef.current + Math.sign(target - tRef.current) * rate * dt,
      0, 1,
    )
    // Evita el zumbido de ±epsilon alrededor del objetivo
    tRef.current = Math.abs(target - t) < 0.001 ? target : t

    const tt = tRef.current

    if (tt >= 0.995 && !flashedRef.current) {
      flashedRef.current = true
      flashRef.current = 1
    }
    if (tt < 0.2) flashedRef.current = false

    // Flotación e inercia: solo valen la pena si hay algo en pantalla.
    if (tt > 0.001) {
      const time = state.clock.elapsedTime
      g.position.y = y + Math.sin(time * 1.55) * 0.09
      g.rotation.y += dt * 0.55
    }

    // Fogonazo al cerrar la última arista: es lo que vende el "clac" del
    // armado. Sin esto la animación termina y nada la remata.
    if (flashRef.current > 0) {
      flashRef.current = Math.max(0, flashRef.current - dt * 5.5)
      tmp.color.copy(baseColor).multiplyScalar(1 + flashRef.current * 1.1)
      mesh.material.color.copy(tmp.color)
    }

    // Las matrices por instancia solo se reescriben mientras algo se mueve.
    // Armado y quieto, este bloque no corre: el bob y el giro son del grupo.
    if (Math.abs(tt - prevTRef.current) > 0.0005) {
      prevTRef.current = tt
      for (let i = 0; i < EDGE_COUNT; i++) {
        const e = edges[i]
        const start = i * EDGE_STAGGER
        const p = easeOutCubic(THREE.MathUtils.clamp((tt - start) / EDGE_SPAN, 0, 1))
        const len = e.len * p
        // La arista crece DESDE su vértice de origen: el cilindro está
        // centrado, así que se desplaza medio largo por el camino.
        tmp.pos.copy(e.dir).multiplyScalar(len * 0.5).add(e.from)
        tmp.scale.set(THICK, Math.max(len, 0.0001), THICK)
        tmp.m.compose(tmp.pos, e.quat, tmp.scale)
        mesh.setMatrixAt(i, tmp.m)
      }
      mesh.instanceMatrix.needsUpdate = true

      if (bodyRef.current) {
        // El cuerpo entra al final, cuando la jaula ya existe.
        const bodyIn = THREE.MathUtils.clamp((tt - 0.55) / 0.45, 0, 1)
        bodyRef.current.material.opacity = bodyIn * 0.13
        const s = 0.6 + 0.4 * bodyIn
        bodyRef.current.scale.set(R * s, H * s, R * s)
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, y, 0]}>
      {/* Aristas */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, EDGE_COUNT]}
        frustumCulled={false}
        raycast={() => null}
      >
        <cylinderGeometry args={[1, 1, 1, 6, 1, true]} />
        <meshBasicMaterial color={baseColor} toneMapped={false} />
      </instancedMesh>

      {/* Cuerpo: apenas un velo aditivo para que se lea como cristal y no como
          jaula de alambre. depthWrite off para que no recorte las aristas de
          atrás, que son justo las que dan la lectura de volumen. */}
      <mesh ref={bodyRef} scale={[R * 0.6, H * 0.6, R * 0.6]} raycast={() => null}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color={bodyColor}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
