import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { extendGLTFLoaderKTX2 } from '../../lib/ktx2Setup.js'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { crearMaterialPantalla, crearCara } from '../../lib/pantallaDrone.js'
import TurbinaDrone from './TurbinaDrone.jsx'

// El drone del imperio Etherean (modelo de Oscar) con su rig y sus acciones
// (scripts/drone/armar_drone.py). Mismo toon que Skulley y Argus: banding de 2
// bandas con brillo duro, contorno de hull invertido y, si el Canvas monta un
// CharacterNormalPass sobre `ref`, la tinta de pliegues.
//
// Acciones (`accion`): IdleTranquilo, IdleJugueton y Avanzar se repiten;
// Arrancar (con el giro) pasa sola a Avanzar y Detenerse a IdleTranquilo
// (`onAccion` avisa cuál suena; `accionN` la repite). El fuego de la turbina sale al arrancar y
// mientras avanza. La cara de la pantalla (lib/pantallaDrone.js) sale por
// `caraRef`: poner('feliz' | 'enojada' | 'confundida' | 'normal'), voltear(),
// apagar(), mirar(x, y). Con la cara el cuerpo voltea hacia donde mira, se
// ladea con la confundida y con la enojada se inclina, tiembla y toda su luz
// (cuerpo, franjas de luz, fuego y ojos) se pone roja.
//
// `tiempoRef`: si se pasa ({ t } en segundos), todo sigue ese reloj en vez del
// cuadro (para grabar video cuadro por cuadro).

export const DRONE_URL = `${import.meta.env.BASE_URL}3dmodels/madre_etherean_empire_drone_rig.glb`
const SIGUIENTE = { Arrancar: 'Avanzar', Detenerse: 'IdleTranquilo', Invocar: 'IdleTranquilo' }
const UNA_VEZ = new Set(['Arrancar', 'Detenerse', 'Invocar'])
// Segundo de Invocar en que azota (cuadro 36 de INVOCAR_GOLPE en armar_drone.py): ahí cae el rayo.
export const INVOCAR_GOLPE_S = 36 / 30
const TRANSICION = 0.22
// El fuego según la acción y el segundo dentro de ella: en Arrancar chisporrotea
// en la anticipación, revienta al salir disparado (cuadro 8) y se queda; en
// Detenerse se apaga en 0.3 s; en Invocar escupe un golpe al azotar.
function fuegoDe(accion, t) {
  if (accion === 'Arrancar') return t < 0.24 ? 0.2 : t < 0.5 ? 1.8 : 1.0
  if (accion === 'Avanzar') return 1.0
  if (accion === 'Detenerse') return Math.max(0, 1 - t / 0.3)
  if (accion === 'Invocar') return t > INVOCAR_GOLPE_S - 0.05 && t < INVOCAR_GOLPE_S + 0.3 ? 1.7 : 0
  return 0
}
const ROJO_LUZ = new THREE.Color(1.0, 0.15, 0.12)
// el hollín: casi negro, un pelo café (multiplica la luz que llega)
const HOLLIN = new THREE.Color(0.16, 0.13, 0.11)
const ROJO_FRANJA = new THREE.Color('#ff2a1c')

// Normales promediadas por posición para el contorno: el modelo es de superficie
// dura con normales partidas en las aristas, y extruir con esas abre huecos en
// el hull justo en las esquinas.
function normalesSuaves(geo) {
  if (geo.attributes.normalSuave) return
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  const n = pos.count
  const grupos = new Map()
  const idx = new Int32Array(n)
  const suma = []
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)}|${Math.round(pos.getY(i) * 1e4)}|${Math.round(pos.getZ(i) * 1e4)}`
    let g = grupos.get(k)
    if (g === undefined) { g = suma.length / 3; grupos.set(k, g); suma.push(0, 0, 0) }
    idx[i] = g
    suma[g * 3] += nor.getX(i); suma[g * 3 + 1] += nor.getY(i); suma[g * 3 + 2] += nor.getZ(i)
  }
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const g = idx[i]
    const x = suma[g * 3], y = suma[g * 3 + 1], z = suma[g * 3 + 2]
    const l = Math.hypot(x, y, z) || 1
    out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l
  }
  geo.setAttribute('normalSuave', new THREE.BufferAttribute(out, 3))
}

function materialContorno(grosor) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: false, toneMapped: false })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGrosor = grosor
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 normalSuave;\nuniform float uGrosor;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalSuave;')
      .replace('#include <project_vertex>', 'transformed += normalize(objectNormal) * uGrosor;\n#include <project_vertex>')
  }
  m.customProgramCacheKey = () => 'contornoDrone'
  return m
}

// El material del GLB pasa a MeshStandardMaterial con el banding de Skulley: el
// clearcoat del original (MeshPhysical) dejaba brillos 3D suaves. Encima, el
// enojo: la luz que llega se tiñe de rojo (después del banding, así conserva sus
// bandas) y lo que brilla solo (las franjas cian) se vuelve rojo. Y lo quemado
// (el rayo de la esfera corrupta): hollín que oscurece todo y apaga las franjas.
function materialToon(m, { mapasNormales, toon, enojo, quemado }) {
  const s = new THREE.MeshStandardMaterial({
    name: m.name,
    color: m.color.clone(),
    map: m.map,
    normalMap: mapasNormales ? m.normalMap : null,
    emissive: m.emissive.clone(),
    emissiveMap: m.emissiveMap,
    emissiveIntensity: m.emissiveIntensity,
    roughness: m.roughness,
    metalness: m.metalness,
    side: m.side,
  })
  applyToonBanding(s, { steps: 2, minBand: 0.04, bandIndirect: true, especularDuro: true, ...toon })
  const previo = s.onBeforeCompile
  s.onBeforeCompile = (shader, renderer) => {
    previo(shader, renderer)
    shader.uniforms.uEnojo = enojo
    shader.uniforms.uRojoLuz = { value: ROJO_LUZ }
    shader.uniforms.uRojoFranja = { value: ROJO_FRANJA }
    shader.uniforms.uQuemado = quemado
    shader.uniforms.uHollin = { value: HOLLIN }
    shader.fragmentShader = 'uniform float uEnojo;\nuniform vec3 uRojoLuz;\nuniform vec3 uRojoFranja;\nuniform float uQuemado;\nuniform vec3 uHollin;\n' + shader.fragmentShader
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = mix(totalEmissiveRadiance, uRojoFranja * max(max(totalEmissiveRadiance.r, totalEmissiveRadiance.g), totalEmissiveRadiance.b), uEnojo);
        totalEmissiveRadiance *= 1.0 - 0.8 * uQuemado;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        {
          vec3 _rojo = mix(vec3(1.0), uRojoLuz, uEnojo) * mix(vec3(1.0), uHollin, uQuemado);
          reflectedLight.directDiffuse *= _rojo;
          reflectedLight.indirectDiffuse *= _rojo;
          reflectedLight.directSpecular *= _rojo;
        }`)
  }
  const clave = s.customProgramCacheKey
  s.customProgramCacheKey = () => clave() + '|enojoDrone'
  return s
}

// La boca de la turbina: lo más atrás (−Z) de lo que queda cerca del eje.
function medirBoquilla(pieles) {
  let z = Infinity
  const p = new THREE.Vector3()
  for (const o of pieles) {
    const pos = o.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
      if (Math.hypot(p.x, p.y) < 0.32 && p.z < z) z = p.z
    }
  }
  return new THREE.Vector3(0, 0, z)
}

const DroneModel = forwardRef(function DroneModel({
  size = 2,
  outlineWorld = 0.022,
  accion = 'IdleTranquilo',
  accionN = 0,
  onAccion,
  velocidad = 1,
  expresion = null,
  encendida = true,
  caraAuto = true,
  caraRnd = undefined,
  ojosOriginales = false,
  mapasNormales = false,
  toon = null,
  tiempoRef = null,
  caraRef = null,
  contornoColor = '#000000',
  fuegoEscala = 1,
  children,
  ...grupo
}, ref) {
  const raizRef = useRef()
  const giroRef = useRef()
  useImperativeHandle(ref, () => raizRef.current)
  const { scene: original, animations } = useGLTF(DRONE_URL, true, true, extendGLTFLoaderKTX2)

  const armado = useMemo(() => {
    const c = SkeletonUtils.clone(original)
    const grosor = { value: 0.01 }
    const contorno = materialContorno(grosor)
    let pantalla = null
    let pantallaOriginal = null
    let pantallaShader = null
    const pieles = []
    c.traverse((o) => { if (o.isMesh && o.material.name === 'Pantalla') pantallaShader = crearMaterialPantalla(o.geometry) })
    const enojo = pantallaShader.userData.pantalla.uEnojo
    const quemado = pantallaShader.userData.pantalla.uQuemado
    c.traverse((o) => {
      if (!o.isMesh) return
      o.frustumCulled = false
      if (o.material.name === 'Pantalla') {
        pantallaOriginal = o.material
        o.material = pantallaShader
        pantalla = o
      } else {
        o.material = materialToon(o.material, { mapasNormales, toon, enojo, quemado })
      }
      if (o.isSkinnedMesh) pieles.push(o)
    })
    for (const o of pieles) {
      normalesSuaves(o.geometry)
      const hull = new THREE.SkinnedMesh(o.geometry, contorno)
      hull.name = `${o.name}_outline`
      hull.bindMode = o.bindMode
      hull.bind(o.skeleton, o.bindMatrix)
      hull.position.copy(o.position)
      hull.quaternion.copy(o.quaternion)
      hull.scale.copy(o.scale)
      hull.frustumCulled = false
      o.parent.add(hull)
    }
    c.updateMatrixWorld(true)
    const caja = new THREE.Box3()
    for (const o of pieles) {
      o.geometry.computeBoundingBox()
      caja.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))
    }
    const tam = caja.getSize(new THREE.Vector3())
    const centro = caja.getCenter(new THREE.Vector3())
    const escala = 1 / Math.max(tam.x, tam.y, tam.z)
    // la boquilla cuelga del hueso del cuerpo, así sigue el rebote, el giro y el squash
    const hueso = c.getObjectByName('cuerpo_squash') || c.getObjectByName('cuerpo')
    const boquilla = new THREE.Object3D()
    boquilla.name = 'boquilla_turbina'
    const inv = hueso.matrixWorld.clone().invert()
    boquilla.position.copy(medirBoquilla(pieles.filter((o) => /Metals|Glows/.test(o.name))).applyMatrix4(inv))
    const dir = new THREE.Vector3(0, 0, -1).transformDirection(inv)
    hueso.add(boquilla)
    return { c, grosor, contorno, pantalla, pantallaOriginal, pantallaShader, escala, centro, boquilla, dir: dir.toArray(), enojo }
  }, [original, mapasNormales, toon])

  const cara = useMemo(() => crearCara(armado.pantallaShader.userData.pantalla, { auto: caraAuto, rnd: caraRnd }), [armado, caraAuto, caraRnd])
  useEffect(() => { if (caraRef) caraRef.current = cara }, [cara, caraRef])
  useEffect(() => { if (expresion != null) cara.poner(expresion) }, [cara, expresion])
  useEffect(() => { if (encendida) cara.encender(); else cara.apagar() }, [cara, encendida])
  useEffect(() => {
    armado.pantalla.material = ojosOriginales ? armado.pantallaOriginal : armado.pantallaShader
  }, [armado, ojosOriginales])

  const escala = size * armado.escala
  useEffect(() => { armado.grosor.value = outlineWorld / escala }, [armado, outlineWorld, escala])
  // el contorno blanco al pasar el mouse (como Argus): un uniform, no compila
  useEffect(() => { armado.contorno.color.set(contornoColor) }, [armado, contornoColor])

  // ---- acciones
  const mixer = useMemo(() => new THREE.AnimationMixer(armado.c), [armado])
  const clips = useMemo(() => {
    const m = {}
    for (const a of animations) {
      const act = mixer.clipAction(a)
      if (UNA_VEZ.has(a.name)) { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true }
      else act.setLoop(THREE.LoopRepeat, Infinity)
      m[a.name] = act
    }
    return m
  }, [mixer, animations])
  const sonando = useRef({ nombre: null, t: 0 })
  const onAccionRef = useRef(onAccion)
  onAccionRef.current = onAccion
  const cambiar = useRef(null)
  cambiar.current = (nombre) => {
    const nueva = clips[nombre]
    if (!nueva) return
    const vieja = sonando.current.nombre ? clips[sonando.current.nombre] : null
    nueva.reset().setEffectiveWeight(1).play()
    if (vieja && vieja !== nueva) nueva.crossFadeFrom(vieja, TRANSICION, false)
    sonando.current = { nombre, t: 0 }
    onAccionRef.current?.(nombre)
  }
  useEffect(() => { cambiar.current(accion) }, [accion, accionN, clips])
  useEffect(() => {
    const alTerminar = (e) => {
      const nombre = sonando.current.nombre
      if (e.action === clips[nombre] && SIGUIENTE[nombre]) cambiar.current(SIGUIENTE[nombre])
    }
    mixer.addEventListener('finished', alTerminar)
    return () => mixer.removeEventListener('finished', alTerminar)
  }, [mixer, clips])
  useEffect(() => () => mixer.stopAllAction(), [mixer])

  // ---- cada cuadro
  const fuego = useRef(0)
  const fuegoMeta = useRef(0)
  const mov = useRef({ yaw: 0, roll: 0, pitch: 0 })
  const ultimo = useRef(0)
  useFrame((_, dtReal) => {
    let dt = dtReal
    if (tiempoRef) { dt = Math.max(0, tiempoRef.current.t - ultimo.current); ultimo.current = tiempoRef.current.t }
    dt *= velocidad
    mixer.update(dt)
    cara.actualizar(dt)
    sonando.current.t += dt
    // el fuego sigue a la acción, con un poco de inercia
    fuegoMeta.current = fuegoDe(sonando.current.nombre, sonando.current.t) * fuegoEscala
    fuego.current += (fuegoMeta.current - fuego.current) * (1 - Math.exp(-dt * (fuegoMeta.current > fuego.current ? 30 : 9)))
    // el cuerpo con la cara: voltea hacia donde mira, se ladea con la confundida
    // y con la enojada se inclina hacia adelante y tiembla
    const e = cara.estado
    const conf = e.expr === 3
    const k = 1 - Math.exp(-dt * 7)
    const m = mov.current
    m.yaw += (e.mirada[0] * 0.32 - m.yaw) * k
    m.roll += ((conf ? -e.lado * 0.2 : 0) - m.roll) * k
    m.pitch += (e.enojo * 0.13 - m.pitch) * k
    const g = giroRef.current
    if (g) {
      g.rotation.set(m.pitch, m.yaw, m.roll, 'YXZ')
      if (e.enojo > 0) {
        const tj = Math.floor(e.t * 24)
        const h = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) - 0.5 }
        g.position.set(h(tj) * 0.012 * size * e.enojo, h(tj + 9.3) * 0.012 * size * e.enojo, 0)
      } else g.position.set(0, 0, 0)
    }
  })

  const refs = useMemo(() => ({ boquilla: { current: armado.boquilla }, enojo: { current: armado.enojo } }), [armado])
  const c = armado.centro
  return (
    <>
      <group ref={raizRef} {...grupo}>
        <group ref={giroRef}>
          <group scale={escala}>
            <primitive object={armado.c} position={[-c.x, -c.y, -c.z]} />
          </group>
        </group>
        {children}
      </group>
      <TurbinaDrone boquillaRef={refs.boquilla} dir={armado.dir} escala={escala} intensidad={fuego} enojoRef={refs.enojo} />
    </>
  )
})

export default DroneModel
useGLTF.preload?.(DRONE_URL, true, true, extendGLTFLoaderKTX2)
