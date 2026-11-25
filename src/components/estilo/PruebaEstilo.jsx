import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import CharacterNormalPass from '../fx/CharacterNormalPass.jsx'
import EdgeInkEffect from '../fx/EdgeInkEffect.jsx'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { extendGLTFLoaderKTX2 } from '../../lib/ktx2Setup.js'
import { armarPintado } from '../../lib/pintado.js'
import { applyCharacterColorsToScene } from '../../lib/characterColors.js'
import { unlockSfx } from '../../lib/sfx.js'
import { iniciarVentiladores, ajustarVentiladores, pararVentiladores, vibracionRenderbox } from '../../lib/ventiladoresRenderbox.js'
import { crearRenderbox, RENDERBOX } from '../../lib/renderbox.js'
import ChispasGolpe from '../fx/ChispasGolpe.jsx'

// Una sola Renderbox en el visor: la comparten el panel (patada, sonido) y su malla.
const RB = crearRenderbox()
const SONIDO_RB = { prendido: false, cerca: 1, auto: false }

// Prueba del estilo pintado a mano con el toon del sitio (estilo.html, solo en
// desarrollo; Oscar, 2026-11-24; features.md, La ofrenda -> El estilo gráfico).
// El barril de scripts/estilo/barril.py junto a Skulley, con la luz de la home
// (HDRI, key que sigue a la cámara y ambiente plano), sus bandas y su contorno de
// tinta medido en pantalla. La toma "Juego" es la cámara de la home (10 de alto, 50°).

const URL_BARRIL = `${import.meta.env.BASE_URL}3dmodels/estilo/barril.glb?v=6`
const URL_TURQUESA = `${import.meta.env.BASE_URL}3dmodels/estilo/barril_turquesa.glb?v=6`
const tinta = { current: null, scale: 1 }
// Los grupos de props (scripts/estilo/props_<grupo>.py): se cargan los que ya existan, a la escala del
// juego (se modelan a tamaño real y el sitio los multiplica por ~2.2), un grupo por fila.
const GRUPOS_PROPS = ['laguna', 'senderos', 'foro', 'taller', 'estudio', 'pesca', 'rocas']
const ESCALA_PROPS = 2.2
const VER_PROPS = Date.now()
const urlProps = (g) => `${import.meta.env.BASE_URL}3dmodels/estilo/props_${g}.glb`
const FONDOS = { noche: '#011d8a', dia: '#7d3fd9' }
const TOMAS = {
  juego: { pos: [0.6, 10.5, -11.9], mira: [0.6, 0.5, 0], fov: 60 },
  cerca: { pos: [1.4, 2.4, 7.4], mira: [0.8, 1.0, 0], fov: 40 },
  props: { pos: [2, 24, 30], mira: [2, 0, -22], fov: 45 },
}
const UP = new THREE.Vector3(0, 1, 0)

function Skulley({ alListo }) {
  const base = useGLTF(`${import.meta.env.BASE_URL}character.glb`, true, true, extendGLTFLoaderKTX2)
  const armado = useMemo(() => {
    const escena = SkeletonUtils.clone(base.scene)
    escena.traverse((o) => {
      if (!o.isMesh) return
      if (o.name.startsWith('Egg_EnergyBall')) { o.visible = false; return }
      o.frustumCulled = false
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
    applyCharacterColorsToScene(escena)
    const mixer = new THREE.AnimationMixer(escena)
    const nombres = base.animations.map((c) => c.name)
    const idle = base.animations.find((c) => c.name === 'root|root|Iddle') || base.animations.find((c) => /idle|iddle/i.test(c.name)) || base.animations[0]
    if (idle) mixer.clipAction(idle, escena).play()
    escena.updateMatrixWorld(true)
    const caja = new THREE.Box3().setFromObject(escena)
    return { escena, mixer, nombres, alto: Math.max(0.5, caja.max.y - caja.min.y) * 1.5 }
  }, [base])
  const grupoRef = useRef()
  useEffect(() => { alListo({ ...armado, grupo: grupoRef.current }) }, [armado, alListo])
  useFrame((_, dt) => armado.mixer.update(Math.min(dt, 0.05)))
  return (
    <group ref={grupoRef} position={[-0.9, 0, 0]} scale={1.5}>
      <primitive object={armado.escena} />
    </group>
  )
}

function Barriles({ altoSkulley, opciones }) {
  const [natural, turquesa] = useGLTF([URL_BARRIL, URL_TURQUESA], true)
  const lista = useMemo(() => {
    const escala = (altoSkulley * 0.48) / 1.05
    const poses = [
      { p: [1.5, 0, 0.2], r: [0, 0.2, 0], g: natural },
      { p: [3.1, 0, -0.6], r: [0, -0.35, 0], g: turquesa },
      { p: [2.4, 0.33 * escala, 1.5], r: [Math.PI / 2, 0, 0.9], g: natural },
    ]
    return poses.map(({ p, r, g }) => {
      const o = armarPintado(g.scene)
      o.grupo.position.set(...p)
      o.grupo.rotation.set(...r)
      o.grupo.scale.setScalar(escala)
      o.base = r[1]
      return o
    })
  }, [natural, turquesa, altoSkulley])
  useEffect(() => {
    for (const o of lista) {
      o.hull.visible = opciones.contorno
      o.grupo.traverse((m) => {
        if (!m.isMesh || m === o.hull) return
        if (!m.userData.map) m.userData.map = m.material.map
        const quiere = opciones.textura ? m.userData.map : null
        if (m.material.map !== quiere) {
          m.material.map = quiere
          m.material.color.set(quiere ? '#ffffff' : '#c27a3a')
          m.material.needsUpdate = true
        }
      })
    }
  }, [lista, opciones.contorno, opciones.textura])
  useFrame((state, dt) => {
    for (let i = 0; i < lista.length; i++) {
      const o = lista[i]
      if (opciones.girar && i < 2) o.grupo.rotation.y += dt * 0.5
      o.medir(state)
    }
  })
  return lista.map((o, i) => <primitive key={i} object={o.grupo} />)
}

function useGruposExistentes(version) {
  const [lista, setLista] = useState([])
  useEffect(() => {
    let vivo = true
    Promise.all(GRUPOS_PROPS.map(async (g) => {
      try {
        const r = await fetch(urlProps(g), { method: 'HEAD', cache: 'no-store' })
        const tipo = r.headers.get('content-type') || ''
        return r.ok && !tipo.includes('text/html') ? g : null
      } catch { return null }
    })).then((r) => { if (vivo) setLista(r.filter(Boolean)) })
    return () => { vivo = false }
  }, [version])
  return lista
}

// Cada grupo en su fila (siempre la misma, aunque falten otros), centrada a lo ancho, detrás de Skulley.
const FILA_Z = (g) => -6 - GRUPOS_PROPS.indexOf(g) * 13

const _rb = new THREE.Vector3()
const _mA = new THREE.Matrix4()
const _mB = new THREE.Matrix4()

function GrupoProps({ grupo, version }) {
  const gltf = useGLTF(`${urlProps(grupo)}?v=${VER_PROPS}-${version}`, true)
  const { lista, centroX } = useMemo(() => {
    gltf.scene.updateMatrixWorld(true)
    const caja = new THREE.Box3().setFromObject(gltf.scene)
    const lista = gltf.scene.children.map((nodo) => {
      const o = armarPintado(nodo)
      o.computadora = nodo.name.startsWith('Prop_Estudio_Computadora') || o.ventiladores.length > 0
      if (o.computadora) {
        // el golpe se deforma alrededor del centro de su base: así se aplasta contra el piso sin moverse
        const caja = new THREE.Box3().setFromObject(o.grupo)
        o.base = new THREE.Vector3((caja.min.x + caja.max.x) / 2, caja.min.y, (caja.min.z + caja.max.z) / 2)
        o.medioAncho = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z) / 2
        // donde pega la patada: al frente, a media altura baja
        o.golpe = [(caja.min.x + caja.max.x) / 2, caja.min.y + (caja.max.y - caja.min.y) * 0.38, caja.max.z]
        o.grupo.matrixAutoUpdate = false
      }
      return o
    })
    return { lista, centroX: (caja.min.x + caja.max.x) / 2 }
  }, [gltf])
  const chispas = useRef()
  const golpesVistos = useRef(RB.golpes)
  const pc = lista.find((o) => o.computadora)
  useFrame((state, dt) => {
    for (const o of lista) o.medir(state)
    if (!pc) return
    // la Renderbox: gira, tiembla, sus luces siguen al botón y el motor suena según qué tan cerca está la cámara
    RB.paso(dt)
    if (RB.golpes !== golpesVistos.current) {
      golpesVistos.current = RB.golpes
      chispas.current?.disparar(pc.golpe, [0, 0.25, 1])
    }
    for (const v of pc.ventiladores) v.malla.quaternion.setFromAxisAngle(v.eje, RB.giro)
    // golpe de caricatura + temblor: T(base + temblor + lo que sube al ladearse) · Rz(ladeo) · S · T(−base)
    const [vx, vy, vz] = vibracionRenderbox(state.clock.elapsedTime, RB.rpm, RENDERBOX.temblor / ESCALA_PROPS)
    const f = RB.deformacion()
    const b = pc.base
    _mA.makeTranslation(-b.x, -b.y, -b.z)
    _mB.makeScale(f.sx, f.sy, f.sz).multiply(_mA)
    _mA.makeRotationZ(f.ladeo).multiply(_mB)
    _mB.makeTranslation(b.x + vx, b.y + vy + Math.abs(Math.sin(f.ladeo)) * pc.medioAncho, b.z + vz).multiply(_mA)
    pc.grupo.matrix.copy(_mB)
    pc.grupo.matrixWorldNeedsUpdate = true
    for (const l of pc.luces) l.material.color.copy(l.prendido).multiplyScalar(RB.boton)
    if (SONIDO_RB.prendido) {
      let c = SONIDO_RB.cerca
      if (SONIDO_RB.auto) {
        pc.grupo.getWorldPosition(_rb)
        c = Math.max(0, Math.min(1, 1 - (state.camera.position.distanceTo(_rb) - 4) / 26))
      }
      ajustarVentiladores(c, 0, RB.rpm)
    }
  })
  return (
    <group position={[2 - centroX * ESCALA_PROPS, 0, FILA_Z(grupo)]} scale={ESCALA_PROPS}>
      {lista.map((o, i) => <primitive key={i} object={o.grupo} />)}
      {pc && <ChispasGolpe ref={chispas} />}
    </group>
  )
}

function Props({ version, alListar }) {
  const grupos = useGruposExistentes(version)
  useEffect(() => { alListar?.(grupos) }, [grupos, alListar])
  return grupos.map((g) => (
    <Suspense key={`${g}-${version}`} fallback={null}><GrupoProps grupo={g} version={version} /></Suspense>
  ))
}

function Luz({ objetivo }) {
  const luz = useRef()
  const blanco = useRef()
  const { camera } = useThree()
  const dir = useMemo(() => new THREE.Vector3(), [])
  const der = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!luz.current || !blanco.current) return
    luz.current.target = blanco.current
    camera.getWorldDirection(dir)
    der.crossVectors(dir, UP).normalize()
    luz.current.position.set(...objetivo).addScaledVector(dir, -4).addScaledVector(der, 4).addScaledVector(UP, 3.5)
    blanco.current.position.set(...objetivo)
    blanco.current.updateMatrixWorld()
  })
  return (
    <>
      <directionalLight ref={luz} intensity={2.4} color="#fff4e6" />
      <object3D ref={blanco} />
      <ambientLight intensity={0.32} color="#aeb9cc" />
    </>
  )
}

function Exponer() {
  const { gl, camera, controls, scene } = useThree()
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__estiloGl = gl
    window.__estiloEscena = scene
    // fija la cámara: __estiloCamara([x, y, z], [mx, my, mz])
    window.__estiloCamara = (pos, mira) => { camera.position.set(...pos); controls?.target.set(...mira); controls?.update() }
  }, [gl, camera, controls, scene])
  return null
}

function Camara({ toma }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    const t = TOMAS[toma]
    camera.position.set(...t.pos)
    camera.fov = t.fov
    camera.updateProjectionMatrix()
    if (controls) { controls.target.set(...t.mira); controls.update() }
    else camera.lookAt(...t.mira)
  }, [toma, camera, controls])
  return null
}

// La Renderbox: oír sus ventiladores y patearla para apagarla o prenderla (con su golpe de caricatura).
function PruebaVentiladores() {
  const [suena, setSuena] = useState(false)
  const [prendida, setPrendida] = useState(RB.prendida)
  const [cerca, setCerca] = useState(SONIDO_RB.cerca)
  const [auto, setAuto] = useState(SONIDO_RB.auto)
  useEffect(() => () => { SONIDO_RB.prendido = false; pararVentiladores(true) }, [])
  const tocar = () => {
    unlockSfx()
    if (suena) { SONIDO_RB.prendido = false; pararVentiladores(); setSuena(false); return }
    if (iniciarVentiladores()) { SONIDO_RB.prendido = true; setSuena(true) }
  }
  return (
    <div style={{ position: 'fixed', right: 16, top: 16, zIndex: 2, font: '700 13px Outfit, system-ui, sans-serif', color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div>Renderbox · {prendida ? 'prendida' : 'apagada'}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={boton(suena)} onClick={tocar}>Sonido</button>
        <button style={boton(false)} onClick={() => { unlockSfx(); setPrendida(RB.patear(Math.random() < 0.5 ? -1 : 1)) }}>Patada</button>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: auto ? 0.4 : 1 }}>
        Cercanía
        <input type="range" min="0" max="1" step="0.01" value={cerca} disabled={auto} onChange={(e) => { const c = Number(e.target.value); setCerca(c); SONIDO_RB.cerca = c }} />
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
        <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); SONIDO_RB.auto = e.target.checked }} />
        Según qué tan cerca está la cámara
      </label>
    </div>
  )
}

const boton = (activo) => ({
  font: '700 13px Outfit, system-ui, sans-serif', padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
  border: '2px solid #000', background: activo ? '#f5ff00' : '#fff', color: '#000',
})

export default function PruebaEstilo() {
  const [skulley, setSkulley] = useState(null)
  // Skulley y los barriles en un mismo grupo: el pase de tinta solo recorre ese grupo, y los barriles
  // (ocluyeTinta) le tapan las líneas donde quedan enfrente, como la cobija en la home.
  const raizRef = useRef()
  const [opciones, setOpciones] = useState({ toma: 'props', momento: 'noche', textura: true, contorno: true, girar: false, vista: 'todo' })
  const [versionProps, setVersionProps] = useState(0)
  const [grupos, setGrupos] = useState([])
  const pon = (k, v) => setOpciones((o) => ({ ...o, [k]: v }))
  const fondo = FONDOS[opciones.momento]
  useEffect(() => { if (import.meta.env.DEV) window.__estilo = { opciones, pon } }, [opciones])
  return (
    <div style={{ position: 'fixed', inset: 0, background: fondo }}>
      {opciones.vista === 'todo' && (
        <div style={{ position: 'fixed', left: 16, top: 16, zIndex: 2, font: '700 13px Outfit, system-ui, sans-serif', color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>
          {GRUPOS_PROPS.map((g) => <div key={g}>{grupos.includes(g) ? '●' : '○'} {g}</div>)}
        </div>
      )}
      <PruebaVentiladores />
      <Canvas dpr={[1, 2]} camera={{ fov: 40, position: TOMAS.cerca.pos, near: 0.1, far: 400 }} gl={{ antialias: true }}>
        <color attach="background" args={[fondo]} />
        <Environment files={`${import.meta.env.BASE_URL}light.hdr`} environmentIntensity={0.6} />
        <Luz objetivo={[0.6, 0.6, 0]} />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[60, 64]} />
          <meshStandardMaterial color={fondo} roughness={1} />
        </mesh>
        <Suspense fallback={null}>
          <group ref={raizRef}>
            <Skulley alListo={setSkulley} />
            {skulley && <Barriles altoSkulley={skulley.alto} opciones={opciones} />}
          </group>
          {opciones.vista === 'todo' && <Props version={versionProps} alListar={setGrupos} />}
          {skulley && <CharacterNormalPass playerRef={raizRef} target={tinta} fixedScale />}
          <EffectComposer multisampling={0}>
            {/* el de la home (PostFX): lo pintado no llega, los neones sí */}
            <Bloom mipmapBlur luminanceThreshold={0.86} luminanceSmoothing={0.18} intensity={1.1} />
            <EdgeInkEffect bufferRef={tinta} thickness={1.1} strength={0.9} threshold={0.3} soft={0.16} />
          </EffectComposer>
        </Suspense>
        <OrbitControls makeDefault target={TOMAS.cerca.mira} />
        <Camara toma={opciones.toma} />
        <Exponer />
      </Canvas>
      <div style={{ position: 'fixed', left: 16, bottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 'calc(100vw - 32px)' }}>
        <button style={boton(opciones.vista === 'todo')} onClick={() => { pon('vista', 'todo'); pon('toma', 'props') }}>Todo junto</button>
        <button style={boton(opciones.vista === 'barriles')} onClick={() => { pon('vista', 'barriles'); pon('toma', 'cerca') }}>Solo barriles</button>
        <button style={boton(false)} onClick={() => setVersionProps((v) => v + 1)}>Recargar props</button>
        <button style={boton(opciones.toma === 'cerca')} onClick={() => pon('toma', 'cerca')}>Cerca</button>
        <button style={boton(opciones.toma === 'juego')} onClick={() => pon('toma', 'juego')}>Cámara del juego</button>
        <button style={boton(opciones.momento === 'noche')} onClick={() => pon('momento', 'noche')}>Noche</button>
        <button style={boton(opciones.momento === 'dia')} onClick={() => pon('momento', 'dia')}>Día</button>
        <button style={boton(opciones.textura)} onClick={() => pon('textura', !opciones.textura)}>Textura pintada</button>
        <button style={boton(opciones.contorno)} onClick={() => pon('contorno', !opciones.contorno)}>Contorno</button>
        <button style={boton(opciones.girar)} onClick={() => pon('girar', !opciones.girar)}>Girar</button>
      </div>
    </div>
  )
}
