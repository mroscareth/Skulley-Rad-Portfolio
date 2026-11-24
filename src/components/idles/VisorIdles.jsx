import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { EffectComposer } from '@react-three/postprocessing'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import CharacterNormalPass from '../fx/CharacterNormalPass.jsx'
import EdgeInkEffect from '../fx/EdgeInkEffect.jsx'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { extendGLTFLoaderKTX2 } from '../../lib/ktx2Setup.js'
import { URL_IDLES, URL_GUITARRA, URL_PUA, CLIP_IDLE } from '../../lib/siestaSkulley.js'
import { crearGuitarraSolo } from '../../lib/guitarraSolo.js'
import { ponerGuitarra } from '../../lib/accesorios.js'

// Visor de los idles de Skulley (idles.html, solo en desarrollo; Oscar, 2026-11-23: "necesito
// un visualizador donde las pueda ver para irte dando screenshots e instrucciones"). Skulley con
// el toon y la tinta del sitio, los clips de public/animaciones, una línea de tiempo con el
// número de cuadro de Blender (30 fps: el cuadro 44 aquí es el 44 de la acción en
// Character/SkulleyRad.blend) y cámaras que siguen el cuerpo o cada mano. El número de cuadro
// va grande arriba para que salga en las capturas.
// Teclas: espacio reproduce o pausa, ← → un cuadro, 1 a 4 los clips.

const FPS = 30
const tinta = { current: null, scale: 1 }
const CLIPS = [
  { id: 'guitarra', nombre: 'Guitarra' },
  { id: 'entra', nombre: 'Se duerme' },
  { id: 'dormido', nombre: 'Dormido' },
  { id: 'sale', nombre: 'Despierta' },
]
// dirección de la cámara (desde lo que sigue) y distancia en altos de Skulley
const TOMAS = {
  frente: { dir: [0, 0.25, 1], dist: 2.7 },
  atras: { dir: [0, 0.25, -1], dist: 2.7 },
  izq: { dir: [1, 0.2, 0.15], dist: 2.7 },
  der: { dir: [-1, 0.2, 0.15], dist: 2.7 },
  arriba: { dir: [0.02, 1, 0.12], dist: 3 },
  manoL: { dir: [0.6, 0.35, 1], dist: 0.65, sigue: 'handl' },
  manoR: { dir: [-0.6, 0.35, 1], dist: 0.65, sigue: 'handr' },
  pua: { dir: [0.15, -1, 0.45], dist: 0.42, sigue: 'thumb3r' },
}
const NOMBRE_TOMA = { frente: 'Frente', atras: 'Atrás', izq: 'Su izquierda', der: 'Su derecha', arriba: 'Arriba', manoL: 'Mano izquierda', manoR: 'Mano derecha', pua: 'Púa' }

function Skulley({ estado, alListo }) {
  const base = useGLTF(`${import.meta.env.BASE_URL}character.glb`, true, true, extendGLTFLoaderKTX2)
  const gltfs = useGLTF([URL_IDLES.guitarra, URL_IDLES.entra, URL_IDLES.dormido, URL_IDLES.sale], true)
  const guitarraGltf = useGLTF(URL_GUITARRA, true)
  const puaGltf = useGLTF(URL_PUA, true)
  const raizRef = useRef()
  const armado = useMemo(() => {
    const escena = SkeletonUtils.clone(base.scene)
    // la guitarra del solo, como en el sitio: cae, la cacha, se quema y se deshace (lib/guitarraSolo.js)
    ponerGuitarra(escena, guitarraGltf, puaGltf)
    escena.traverse((o) => {
      if (!o.isMesh) return
      if (o.name.startsWith('Egg_EnergyBall')) { o.visible = false; return }
      o.frustumCulled = false
      // como en el sitio: Standard con el banding (el clearcoat del GLB deja brillos 3D suaves)
      const toon = (x) => {
        if (!x.isMeshStandardMaterial) return x
        const s = new THREE.MeshStandardMaterial({
          name: x.name, color: x.color.clone(), map: x.map, emissive: x.emissive.clone(), emissiveMap: x.emissiveMap,
          emissiveIntensity: x.emissiveIntensity, roughness: Math.max(0.6, x.roughness), metalness: 0, side: x.side,
        })
        applyToonBanding(s, { steps: 3, minBand: 0.04, bandIndirect: true, especularDuro: true })
        return s
      }
      o.material = Array.isArray(o.material) ? o.material.map(toon) : toon(o.material)
    })
    const mixer = new THREE.AnimationMixer(escena)
    const acciones = {}
    const clips = gltfs.flatMap((g) => g.animations || [])
    for (const { id } of CLIPS) {
      const clip = clips.find((c) => c.name === CLIP_IDLE[id])
      if (!clip) continue
      const a = mixer.clipAction(clip, escena)
      a.setLoop(THREE.LoopRepeat, Infinity)
      acciones[id] = a
    }
    escena.updateMatrixWorld(true)
    const caja = new THREE.Box3().setFromObject(escena)
    return { escena, mixer, acciones, solo: crearGuitarraSolo(escena), alto: Math.max(0.5, caja.max.y - caja.min.y) }
  }, [base, gltfs, guitarraGltf, puaGltf])

  useEffect(() => { alListo(armado) }, [armado, alListo])

  const eje = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }, dt) => {
    const E = estado.current
    const a = armado.acciones[E.clip]
    if (!a) return
    if (E.activa !== a) {
      armado.mixer.stopAllAction()
      a.reset().play()
      E.activa = a
      E.dur = a.getClip().duration
      E.t = Math.min(E.t, E.dur)
    }
    if (E.reproduce) E.t = (E.t + dt * E.vel) % E.dur
    // el último cuadro sin llegar a la duración (en bucle, ahí regresaría al primero)
    a.time = Math.min(E.dur - 1e-4, Math.max(1 / FPS, E.t))
    armado.mixer.update(0)
    E.cuadro = Math.max(1, Math.round(a.time * FPS))
    E.cuadros = Math.round(E.dur * FPS)
    camera.getWorldDirection(eje)
    armado.escena.updateMatrixWorld(true)
    armado.solo?.aplicar(E.clip === 'guitarra' ? a.time * FPS : null, 1, eje)
  })

  return (
    <group ref={raizRef} scale={1.5}>
      <primitive object={armado.escena} />
    </group>
  )
}

// La cámara: va tras lo que sigue (el cuerpo o una mano) sin perder el ángulo que le des con el mouse.
function Camara({ armadoRef, tomaRef }) {
  const { camera, controls } = useThree()
  const meta = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const A = armadoRef.current
    const T = tomaRef.current
    if (!A || !controls) return
    const sigue = TOMAS[T.toma].sigue
    const hueso = sigue ? A.escena.getObjectByName(sigue) : A.escena.getObjectByName('rootx')
    if (!hueso) return
    hueso.getWorldPosition(meta)
    if (!sigue) meta.y += A.alto * 0.15
    if (T.nueva) {
      // una toma nueva: se coloca desde el principio
      T.nueva = false
      const t = TOMAS[T.toma]
      tmp.set(...t.dir).normalize().multiplyScalar(t.dist * A.alto * 1.5)
      controls.target.copy(meta)
      camera.position.copy(meta).add(tmp)
      controls.update()
      return
    }
    tmp.copy(meta).sub(controls.target)
    controls.target.add(tmp)
    camera.position.add(tmp)
    controls.update()
  })
  return null
}

export default function VisorIdles() {
  const estado = useRef({ clip: 'guitarra', t: 0, vel: 1, reproduce: true, cuadro: 1, cuadros: 1, dur: 1, activa: null })
  const armadoRef = useRef(null)
  const tomaRef = useRef({ toma: 'frente', nueva: true })
  const [clip, setClip] = useState('guitarra')
  const [toma, setToma] = useState('frente')
  const [reproduce, setReproduce] = useState(true)
  const [vel, setVel] = useState(1)
  const [info, setInfo] = useState({ cuadro: 1, cuadros: 1 })
  const sueltaRef = useRef(false)

  // el número de cuadro en pantalla (sin rerenderizar en cada cuadro de la escena)
  useEffect(() => {
    let id = 0
    const leer = () => {
      const E = estado.current
      setInfo((v) => (v.cuadro === E.cuadro && v.cuadros === E.cuadros ? v : { cuadro: E.cuadro, cuadros: E.cuadros }))
      id = requestAnimationFrame(leer)
    }
    id = requestAnimationFrame(leer)
    return () => cancelAnimationFrame(id)
  }, [])

  const elegirClip = (id) => { estado.current.clip = id; estado.current.t = 0; setClip(id) }
  const elegirToma = (id) => { tomaRef.current = { toma: id, nueva: true }; setToma(id) }
  const alternar = () => { estado.current.reproduce = !estado.current.reproduce; setReproduce(estado.current.reproduce) }
  const irA = (cuadro) => {
    const E = estado.current
    E.reproduce = false
    setReproduce(false)
    E.t = Math.min(E.dur, Math.max(1, cuadro) / FPS)
  }
  const paso = (d) => irA(estado.current.cuadro + d)
  const ponerVel = (v) => { estado.current.vel = v; setVel(v) }

  useEffect(() => {
    const tecla = (e) => {
      if (e.target?.tagName === 'INPUT' && e.target.type !== 'range') return
      if (e.code === 'Space') { e.preventDefault(); alternar() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); paso(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); paso(-1) }
      else if (/^[1-4]$/.test(e.key)) elegirClip(CLIPS[Number(e.key) - 1].id)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { window.__visor = { estado: estado.current, irA, elegirClip, elegirToma } })

  const nombreClip = CLIPS.find((c) => c.id === clip)?.nombre
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#011d8a', fontFamily: 'system-ui, sans-serif' }}>
      <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, 3, 9], near: 0.05, far: 200 }} gl={{ antialias: true }}>
        <color attach="background" args={['#011d8a']} />
        <ambientLight intensity={0.55} />
        <directionalLight intensity={1.6} position={[3, 6, 4]} />
        <directionalLight intensity={0.5} position={[-4, 3, -3]} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#1b2fa8" roughness={1} />
        </mesh>
        <gridHelper args={[30, 60, '#3d52c8', '#2a3db8']} position={[0, 0, 0]} />
        <Suspense fallback={null}>
          <group ref={(g) => { if (g) armadoRef.grupo = g }}>
            <Skulley estado={estado} alListo={(a) => { armadoRef.current = a }} />
          </group>
          <CharacterNormalPass playerRef={{ get current() { return armadoRef.grupo } }} target={tinta} fixedScale />
          <EffectComposer multisampling={0}>
            <EdgeInkEffect bufferRef={tinta} thickness={1.1} strength={0.9} threshold={0.3} soft={0.16} />
          </EffectComposer>
          <Camara armadoRef={armadoRef} tomaRef={tomaRef} />
          <OrbitControls makeDefault enablePan={false} minDistance={0.3} maxDistance={40} />
        </Suspense>
      </Canvas>

      {/* lo que sale en la captura: qué clip, qué cuadro y desde dónde */}
      <div style={{ position: 'fixed', left: 16, top: 12, color: '#fff', textShadow: '0 2px 0 #000', pointerEvents: 'none' }}>
        <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{nombreClip} · cuadro {info.cuadro}</div>
        <div style={{ fontSize: 16, opacity: 0.85, marginTop: 4 }}>de {info.cuadros} · cámara: {NOMBRE_TOMA[toma]} · {vel}×</div>
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {CLIPS.map((c, i) => (
            <button key={c.id} type="button" className="shop-chip" aria-pressed={clip === c.id} onClick={() => elegirClip(c.id)}>{i + 1}. {c.nombre}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: 'min(900px, 100%)' }}>
          <button type="button" className="shop-chip" onClick={() => paso(-1)} aria-label="Cuadro anterior">◀</button>
          <button type="button" className="shop-chip" aria-pressed={reproduce} onClick={alternar}>{reproduce ? 'Pausa' : 'Reproducir'}</button>
          <button type="button" className="shop-chip" onClick={() => paso(1)} aria-label="Cuadro siguiente">▶</button>
          <input
            type="range" min={1} max={info.cuadros} step={1} value={info.cuadro}
            onPointerDown={() => { sueltaRef.current = estado.current.reproduce; estado.current.reproduce = false }}
            onPointerUp={() => { if (sueltaRef.current) { estado.current.reproduce = true; setReproduce(true) } }}
            onChange={(e) => { estado.current.t = Number(e.target.value) / FPS }}
            style={{ flex: 1 }}
            aria-label="Cuadro"
          />
          {[0.25, 0.5, 1].map((v) => (
            <button key={v} type="button" className="shop-chip" aria-pressed={vel === v} onClick={() => ponerVel(v)}>{v === 1 ? '1×' : v === 0.5 ? '½×' : '¼×'}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {Object.keys(TOMAS).map((t) => (
            <button key={t} type="button" className="shop-chip" aria-pressed={toma === t} onClick={() => elegirToma(t)}>{NOMBRE_TOMA[t]}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
