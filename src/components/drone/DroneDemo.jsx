import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import DroneModel from './DroneModel.jsx'
import CharacterNormalPass from '../fx/CharacterNormalPass.jsx'
import EdgeInkEffect from '../fx/EdgeInkEffect.jsx'
import { EXPRESIONES } from '../../lib/pantallaDrone.js'

// Demo del drone (drone.html, solo en desarrollo): el drone con el toon del
// sitio sobre el azul del home, chips para sus acciones y caras, y un recorrido
// en círculo con la cámara siguiéndolo (así se ve el fuego quedarse atrás).
// Con ?captura=1&toma=… no corre en tiempo real: dibuja cuadro por cuadro a 30
// fps, sigue el guion de la toma y manda cada PNG a un servidor local
// (?subir=http://127.0.0.1:8765) para armar el video.

const tinta = { current: null, scale: 1 }
const NOMBRES = { normal: 'Normal', feliz: 'Feliz', enojada: 'Enojada', confundida: 'Confundida' }
const params = new URLSearchParams(location.search)
const CAPTURA = params.get('captura') === '1'
const RADIO = 2.4
// velocidad de avance (mundo/s) según la acción y el segundo dentro de ella
function rapidez(accion, t) {
  if (accion === 'Arrancar') return t < 0.27 ? -0.4 * Math.sin((t / 0.27) * Math.PI) : 2.6 + 1.6 * Math.max(0, 1 - (t - 0.27) / 0.4)
  if (accion === 'Avanzar') return 2.6
  return 0
}

function prng(semilla) {
  let s = semilla >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// Tomas de la captura: duración, cámara (azimut, alto en grados, distancia) y guion [segundo, cambio]
const TOMAS = {
  caras: {
    dura: 15, cam: () => [22, 6, 5.2], seguir: false,
    guion: [[0, { accion: 'IdleTranquilo', expr: 'normal' }], [1.6, { expr: 'feliz' }], [4.0, { expr: 'normal' }],
      [5.0, { voltear: true }], [7.8, { expr: 'confundida' }], [11.0, { expr: 'enojada' }], [14.2, { expr: 'normal' }]],
  },
  acciones: {
    dura: 15, cam: () => [35, 12, 7.0], seguir: true,
    guion: [[0, { accion: 'IdleTranquilo', expr: 'normal' }], [2.2, { accion: 'Arrancar' }], [6.6, { accion: 'Detenerse' }],
      [8.6, { accion: 'IdleJugueton', expr: 'feliz' }], [11.8, { expr: 'normal' }]],
  },
}

function Escena({ estado, droneRef, caraRef, tiempoRef, onAccion, ui }) {
  const { camera, gl, advance, controls } = useThree()
  const mov = useRef({ p: new THREE.Vector3(-RADIO, 0, 0), yaw: 0, v: 0 })
  const objetivo = useRef(new THREE.Vector3(0, 0, 0))
  const onAccionRef = useRef(onAccion)
  onAccionRef.current = onAccion

  // mover el drone: avanza hacia donde mira y va dando la vuelta
  const paso = (dt) => {
    const d = droneRef.current
    if (!d) return
    const m = mov.current
    const meta = rapidez(estado.current.accion, estado.current.t)
    m.v += (meta - m.v) * (1 - Math.exp(-dt * (meta > m.v ? 6 : 5)))
    if (estado.current.accion === 'Detenerse') m.v *= Math.exp(-dt * 7)
    m.yaw += (Math.max(m.v, 0) / RADIO) * dt
    m.p.x += Math.sin(m.yaw) * m.v * dt
    m.p.z += Math.cos(m.yaw) * m.v * dt
    d.position.copy(m.p)
    d.rotation.y = m.yaw
    estado.current.t += dt
  }

  useFrame((_, dt) => {
    if (CAPTURA) return
    paso(dt * (ui.current.lento ? 0.5 : 1))
    // la cámara sigue al drone sin perder su ángulo
    if (controls && ui.current.seguir) {
      objetivo.current.lerp(mov.current.p, 1 - Math.exp(-dt * 3))
      const delta = objetivo.current.clone().sub(controls.target)
      controls.target.add(delta)
      camera.position.add(delta)
      controls.update()
    }
  })

  useEffect(() => {
    if (!CAPTURA) return undefined
    let vivo = true
    const toma = TOMAS[params.get('toma') || 'caras']
    const subir = params.get('subir') || 'http://127.0.0.1:8765'
    const nombre = params.get('toma') || 'caras'
    const n = Math.round(toma.dura * 30)
    const objetivoCam = mov.current.p.clone()
    window.__captura = { fase: 'esperando', i: 0 }
    ;(async () => {
      await new Promise((r) => setTimeout(r, 2000))
      window.__captura.fase = 'grabando'
      let g = 0
      for (let i = 0; i < n && vivo; i++) {
        const t = i / 30
        while (g < toma.guion.length && toma.guion[g][0] <= t + 1e-6) {
          const c = toma.guion[g][1]
          if (c.accion) { estado.current.accion = c.accion; estado.current.t = 0; onAccionRef.current(c.accion, true) }
          if (c.expr) caraRef.current?.poner(c.expr)
          if (c.voltear) caraRef.current?.voltear()
          g++
        }
        if (i > 0) paso(1 / 30)
        tiempoRef.current.t = t
        const [az, alt, dist] = toma.cam(i / n)
        if (toma.seguir) objetivoCam.lerp(mov.current.p, i === 0 ? 1 : 1 - Math.exp(-3 / 30))
        const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(alt)
        camera.position.set(objetivoCam.x + Math.sin(a) * Math.cos(e) * dist, objetivoCam.y + Math.sin(e) * dist, objetivoCam.z + Math.cos(a) * Math.cos(e) * dist)
        camera.lookAt(objetivoCam)
        advance(performance.now())
        const blob = await new Promise((r) => gl.domElement.toBlob(r, 'image/png'))
        await fetch(`${subir}/${nombre}_${String(i).padStart(4, '0')}.png`, { method: 'POST', body: blob })
        window.__captura.i = i
      }
      window.__captura.fase = 'listo'
      document.title = 'LISTO'
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function DroneDemo() {
  const droneRef = useRef()
  const caraRef = useRef(null)
  const tiempoRef = useRef({ t: 0 })
  const estado = useRef({ accion: 'IdleTranquilo', t: 0 })
  const ui = useRef({ lento: false, seguir: true })
  const [accion, setAccion] = useState({ nombre: 'IdleTranquilo', n: 0 })
  const [sonando, setSonando] = useState('IdleTranquilo')
  const [expr, setExpr] = useState('normal')
  const [auto, setAuto] = useState(!CAPTURA)
  const [lento, setLento] = useState(false)
  const [originales, setOriginales] = useState(false)
  const rnd = useMemo(() => (CAPTURA ? prng(7) : undefined), [])
  ui.current.lento = lento

  useEffect(() => { if (caraRef.current) caraRef.current.estado.auto = auto }, [auto])
  useEffect(() => { window.__drone = { cara: () => caraRef.current, estado: estado.current } }, [])

  const alSonar = (nombre, forzar) => {
    if (forzar) setAccion((a) => ({ nombre, n: a.n + 1 }))
    estado.current.accion = nombre
    estado.current.t = 0
    setSonando(nombre)
  }
  const pedir = (nombre) => setAccion((a) => ({ nombre, n: a.n + 1 }))
  const elegir = (e) => { setAuto(false); setExpr(e); caraRef.current?.poner(e) }
  const avanzando = sonando === 'Arrancar' || sonando === 'Avanzar'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#011d8a' }}>
      <Canvas
        dpr={CAPTURA ? 1 : [1, 2]}
        frameloop={CAPTURA ? 'never' : 'always'}
        camera={{ fov: 30, position: [-RADIO + 2.6, 1.6, 7.2], near: 0.1, far: 200 }}
        gl={{ antialias: false, preserveDrawingBuffer: CAPTURA }}
        style={CAPTURA ? { width: 1280, height: 720 } : undefined}
      >
        <color attach="background" args={['#011d8a']} />
        <ambientLight intensity={0.45} />
        <directionalLight intensity={1.5} position={[2, 4, 3]} />
        <Suspense fallback={null}>
          <DroneModel
            ref={droneRef}
            caraRef={caraRef}
            position={[-RADIO, 0, 0]}
            size={2.3}
            accion={accion.nombre}
            accionN={accion.n}
            onAccion={(n) => alSonar(n)}
            velocidad={lento ? 0.5 : 1}
            ojosOriginales={originales}
            caraAuto={auto}
            caraRnd={rnd}
            tiempoRef={CAPTURA ? tiempoRef : null}
          />
          <CharacterNormalPass playerRef={droneRef} target={tinta} fixedScale allMeshes />
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.72} luminanceSmoothing={0.18} />
            <EdgeInkEffect bufferRef={tinta} thickness={1.1} strength={0.9} threshold={0.3} soft={0.16} />
          </EffectComposer>
          <Escena estado={estado} droneRef={droneRef} caraRef={caraRef} tiempoRef={tiempoRef} onAccion={alSonar} ui={ui} />
          {!CAPTURA && <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={20} target={[-RADIO, 0, 0]} />}
        </Suspense>
      </Canvas>
      {!CAPTURA && (
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            <button type="button" className="shop-chip" aria-pressed={sonando === 'IdleTranquilo'} onClick={() => pedir(avanzando ? 'Detenerse' : 'IdleTranquilo')}>Idle tranquilo</button>
            <button type="button" className="shop-chip" aria-pressed={sonando === 'IdleJugueton'} onClick={() => pedir('IdleJugueton')}>Idle juguetón</button>
            <button type="button" className="shop-chip" aria-pressed={avanzando} onClick={() => { if (!avanzando) pedir('Arrancar') }}>Avanzar</button>
            <button type="button" className="shop-chip" aria-pressed={sonando === 'Detenerse'} onClick={() => { if (avanzando) pedir('Detenerse') }}>Detenerse</button>
            <button type="button" className="shop-chip" aria-pressed={lento} onClick={() => setLento((v) => !v)}>½×</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {EXPRESIONES.map((e) => (
              <button key={e} type="button" className="shop-chip" aria-pressed={!auto && expr === e} onClick={() => elegir(e)}>{NOMBRES[e]}</button>
            ))}
            <button type="button" className="shop-chip" onClick={() => { setAuto(false); caraRef.current?.voltear() }}>Voltear</button>
            <button type="button" className="shop-chip" aria-pressed={auto} onClick={() => setAuto((a) => !a)}>Auto</button>
            <button type="button" className="shop-chip" aria-pressed={originales} onClick={() => setOriginales((v) => !v)}>Ojos originales</button>
          </div>
        </div>
      )}
    </div>
  )
}
