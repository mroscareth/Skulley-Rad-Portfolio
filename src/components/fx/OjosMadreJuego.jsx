import React, { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OjosMadre, JUEGOS_OJOS } from '../mobile/SkulleyFallRig.jsx'
import { cabezaEnPantalla } from '../../lib/cabezaEnPantalla.js'

// Los ojos de M.A.D.R.E. en el juego de esferas (Oscar, 2026-11-15): cuando el
// jugador hace trampa (arrastra una esfera con el cursor hasta un portal), la
// primera vez se asoman los ojos blancos unos segundos; cuando lo castiga,
// salen los rojos de la furia y luego lo parte el rayo (App.jsx).
//
// Son los mismos de "Conocer la historia" (OjosMadre de SkulleyFallRig: los
// impostores, la falla de tele vieja, el parpadeo), en una capa transparente
// encima del juego con su propia cámara ortográfica, que es para la que están
// hechos. Lo que en la historia da el escenario aquí se arma: un Skulley
// virtual del tamaño del plano abierto (lo visible mide 1.55 altos, así los
// ojos miden lo mismo en pantalla), el foco de la historia fuera de cuadro
// (aquí no hay luz que esquivar) y un `headx` que sigue la cabeza de Skulley
// en pantalla (cabezaEnPantalla), para que las pupilas lo vean a él.
//
// `aviso`: { modo: 'madre' | 'furia', id } cada vez que deben salir. El canvas
// solo dibuja mientras hay ojos (y su primer segundo, para compilar los dos
// programas antes de que haga falta).

// Sin el blanco y negro de la historia el magenta se veía magenta, y sobre el azul
// del juego los de atrás se veían grises o guindas: aquí brillan parejo.
const ROJOS = { ...JUEGOS_OJOS.furia, tinte: [1, 0.08, 0.06], brilloMin: 1 }
const BLANCOS = { ...JUEGOS_OJOS.madre, brilloMin: 0.85 }
const DURA = { madre: 4200, furia: 2900 }

function Escena({ aviso, onActivo }) {
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const cabeza = useRef(null)
  const escenaRef = useRef({ pausa: null, blanco: null, historiaId: 0 })
  // Skulley mide 1 y la cámara ve 1.55 de alto, como el plano abierto de la
  // historia: OjosMadre pone las profundidades en altos de Skulley y midiendo
  // en pixeles quedaban fuera del cuadro de la cámara.
  const fitRef = useRef({ ready: false, alto: 1, top: -1000, piso: -1001 })
  const vivo = useRef(null)

  useEffect(() => {
    camera.zoom = Math.max(1, size.height) / 1.55
    camera.updateProjectionMatrix()
    fitRef.current.ready = true
  }, [camera, size])

  useEffect(() => {
    if (!aviso) return
    vivo.current = { modo: aviso.modo, t0: performance.now() }
    escenaRef.current.historiaId = aviso.id
    onActivo(true)
  }, [aviso, onActivo])

  // Antes que OjosMadre (0.7): su tiempo y la cabeza de Skulley.
  useFrame(() => {
    const c = cabezaEnPantalla()
    if (c && cabeza.current) cabeza.current.position.set((c.x - size.width / 2) / camera.zoom, (size.height / 2 - c.y) / camera.zoom, 0)
    const e = escenaRef.current
    e.madreT = null
    e.furiaT = null
    const v = vivo.current
    if (!v) return
    // En desarrollo, `window.__ojosJuegoT = 2500` los congela en ese ms.
    const fijo = import.meta.env.DEV ? window.__ojosJuegoT : null
    const t = fijo != null ? fijo : performance.now() - v.t0
    if (t < DURA[v.modo]) {
      e[`${v.modo}T`] = t
      e[`${v.modo}Dura`] = DURA[v.modo]
    } else {
      vivo.current = null
      onActivo(false)
    }
  }, 0.5)
  // OjosMadre corre con prioridad: R3F ya no dibuja solo.
  useFrame(({ gl, scene, camera }) => gl.render(scene, camera), 1)

  return (
    <>
      <object3D ref={cabeza} name="headx" />
      <OjosMadre escenaRef={escenaRef} fitRef={fitRef} juego={BLANCOS} />
      <OjosMadre escenaRef={escenaRef} fitRef={fitRef} juego={ROJOS} />
    </>
  )
}

export default function OjosMadreJuego({ aviso }) {
  const [activo, setActivo] = useState(false)
  const [calentando, setCalentando] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setCalentando(false), 1200)
    return () => clearTimeout(id)
  }, [])
  return (
    <div className="ojos-madre-juego" aria-hidden>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 300, near: 0.1, far: 60 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        frameloop={activo || calentando ? 'always' : 'never'}
      >
        <Escena aviso={aviso} onActivo={setActivo} />
      </Canvas>
    </div>
  )
}
