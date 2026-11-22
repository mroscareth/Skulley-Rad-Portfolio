import React, { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { ZoidianModel } from '../ZoidianNPC.jsx'

// Demo de desarrollo de Argus (argus.html): grande, con un botón por clip, para
// revisar el rig, la cara y las antenas sin jugar. No va al build.
const CLIPS = ['IdleComer', 'IdleMirar', 'IdleImpaciente', 'Saludo', 'Risa', 'Impresionado']

function Objetivo({ objRef, mover }) {
  useFrame((s) => {
    if (!objRef.current) return
    const t = s.clock.elapsedTime
    if (mover) objRef.current.position.set(Math.sin(t * 0.6) * 4, -0.6 + Math.sin(t * 0.9) * 0.5, 6)
    else objRef.current.position.set(0, -0.2, 6)
  })
  return <object3D ref={objRef} />
}

function Camara({ cerca }) {
  useFrame(({ camera }) => {
    if (cerca) { camera.position.set(0.5, 2.5, 4.4); camera.lookAt(0, 2.3, 0) } else { camera.position.set(0, 1.7, 9); camera.lookAt(0, 1.6, 0) }
  })
  return null
}

function Giro({ giro, children }) {
  const ref = useRef()
  useFrame(() => { if (ref.current) ref.current.rotation.y = giro })
  return <group ref={ref}>{children}</group>
}

export default function ArgusDemo() {
  const ctrlRef = useRef(null)
  const hablaRef = useRef({ ultimo: 0 })
  const pushRef = useRef({ t: -1 })
  const objRef = useRef(null)
  const [giro, setGiro] = useState(0)
  const [mover, setMover] = useState(false)
  const [variedad, setVariedad] = useState(false)
  const [cerca, setCerca] = useState(false)
  const hablar = () => {
    const fin = performance.now() + 2500
    const id = setInterval(() => {
      if (performance.now() > fin) clearInterval(id)
      else hablaRef.current.ultimo = performance.now()
    }, 50)
  }
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas camera={{ fov: 28, position: [0, 1.7, 9], near: 0.1, far: 100 }} gl={{ antialias: true }}>
        <color attach="background" args={['#011d8a']} />
        <ambientLight intensity={0.6} />
        <directionalLight intensity={2.6} position={[-2.5, 3.5, 4]} color="#fff1dc" />
        <directionalLight intensity={0.5} position={[3, 1, 2]} color="#9fd0ff" />
        <Objetivo objRef={objRef} mover={mover} />
        <Camara cerca={cerca} />
        <Suspense fallback={null}>
          <Giro giro={giro}>
            <ZoidianModel targetHeight={3.2} lookAtRef={objRef} ctrlRef={ctrlRef} hablaRef={hablaRef} pushRef={pushRef} variedad={variedad} />
          </Giro>
        </Suspense>
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.6} luminanceThreshold={0.85} mipmapBlur />
        </EffectComposer>
      </Canvas>
      <div style={{ position: 'fixed', left: 12, top: 12, display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 520 }}>
        {CLIPS.map((c) => (
          <button key={c} type="button" className="shop-btn shop-btn--primary" onClick={() => ctrlRef.current?.reaccionar(c)}>{c}</button>
        ))}
        <button type="button" className="shop-btn" onClick={hablar}>Hablar</button>
        <button type="button" className="shop-btn" onClick={() => { pushRef.current.t = 0 }}>Empujón</button>
        <button type="button" className="shop-btn" onClick={() => setMover((v) => !v)}>{mover ? 'Mirada fija' : 'Mirada se mueve'}</button>
        <button type="button" className="shop-btn" onClick={() => setVariedad((v) => !v)}>{variedad ? 'Sin variedad' : 'Variedad'}</button>
        <button type="button" className="shop-btn" onClick={() => setGiro((g) => g + Math.PI / 4)}>Girar</button>
        <button type="button" className="shop-btn" onClick={() => setCerca((v) => !v)}>{cerca ? 'Cuerpo' : 'Cara'}</button>
        <button type="button" className="shop-btn" onClick={() => { setGiro(Math.PI); setMover(true); setCerca(false) }}>Mochila</button>
      </div>
    </div>
  )
}

if (typeof window !== 'undefined') window.__THREE_DEMO = THREE
