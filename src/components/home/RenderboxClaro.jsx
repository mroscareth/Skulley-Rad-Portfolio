import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { armarPintado } from '../../lib/pintado.js'
import { compileAsyncSafe } from '../../lib/compileAsyncSafe.js'
import { cargarGrupoEstilo, copiaLocal } from '../../lib/cargarEstilo.js'
import { setObstaculosExtra } from '../../lib/obstaculosHome.js'
import { RENDERBOX } from '../../lib/renderbox.js'
import { iniciarVentiladores, ajustarVentiladores, pararVentiladores, vibracionRenderbox } from '../../lib/ventiladoresRenderbox.js'
import { RENDERBOX_CLARO, renderboxClaro } from '../../lib/renderboxHome.js'
import ChispasGolpe from '../fx/ChispasGolpe.jsx'

// La Renderbox Nano de Oscar en la orilla del claro (Oscar, 2026-11-24: de los props del mapa que se
// descartó, quiso rescatar esta). Prendida giran sus ventiladores, tiembla y, con Skulley cerca, se
// oye el motor que escogió Oscar (lib/ventiladoresRenderbox.js); una patada la apaga y otra la prende,
// con un golpe de caricatura sin moverla y chispas (lib/renderboxHome.js, lib/renderbox.js). Se arma
// fuera de la escena cuando llega su GLB, se compila contra un render target y entonces se monta.

const VERSION = 1
const SOLTAR_SIN_CUADROS_MS = 400 // si la escena se pausa (una sección, la historia), el motor se calla

// La textura sin sus manchas grandes: lo que queda de restarle su propio promedio (una mip borrosa)
// es el detalle fino, que va sobre un gris parejo. Un programa propio, compilado al armarla.
const uPizarra = { value: new THREE.Color(RENDERBOX_CLARO.pizarra) }
const uDetalle = { value: RENDERBOX_CLARO.detalle }
function limpiarManchas(m) {
  const previo = m.onBeforeCompile
  m.onBeforeCompile = function (shader, renderer) {
    previo?.call(this, shader, renderer)
    shader.uniforms.uRbPizarra = uPizarra
    shader.uniforms.uRbDetalle = uDetalle
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRbPizarra;\nuniform float uRbDetalle;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  vec3 rbGrueso = texture2D( map, vMapUv, 5.0 ).rgb;
  sampledDiffuseColor.rgb = clamp( uRbPizarra + ( sampledDiffuseColor.rgb - rbGrueso ) * uRbDetalle, 0.0, 1.0 );
  diffuseColor *= sampledDiffuseColor;
#endif`)
  }
  const llave = m.customProgramCacheKey
  m.customProgramCacheKey = function () { return `renderbox-limpia|${llave.call(this)}` }
  m.needsUpdate = true
}

const _caja = new THREE.Box3()
const _mA = new THREE.Matrix4()
const _mB = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _n = new THREE.Vector3()

export default function RenderboxClaro({ playerRef, visible = true, activo = false }) {
  const { gl, camera, scene } = useThree()
  const [armado, setArmado] = useState(null)
  const pc = useRef(null)
  const chispas = useRef()
  const golpesVistos = useRef(renderboxClaro.rb.golpes)
  const voz = useRef(false)
  const ultimoCuadro = useRef(0)

  useEffect(() => {
    let vivo = true
    Promise.all([cargarGrupoEstilo('taller', VERSION), cargarGrupoEstilo('claro', VERSION)]).then(async ([gltf, claro]) => {
      const nodo = gltf?.scene.getObjectByName('Prop_Estudio_Computadora')
      if (!vivo || !nodo) return
      const copia = nodo.clone(true)
      copia.position.set(0, 0, 0)
      copia.updateMatrixWorld(true)
      const p = armarPintado(copia)
      // el golpe se deforma alrededor del centro de su base: así se aplasta contra el piso sin moverse
      _caja.setFromObject(p.grupo)
      p.base = new THREE.Vector3((_caja.min.x + _caja.max.x) / 2, _caja.min.y, (_caja.min.z + _caja.max.z) / 2)
      p.medioAncho = Math.max(_caja.max.x - _caja.min.x, _caja.max.z - _caja.min.z) / 2
      p.grupo.matrixAutoUpdate = false
      const C = RENDERBOX_CLARO
      for (const l of p.luces) if (/LuzVentiladores$/.test(l.nombre)) l.prendido.multiplyScalar(C.brilloVentiladores)
      p.grupo.traverse((o) => { if (o.isMesh && o.material?.isMeshStandardMaterial && o.material.map) limpiarManchas(o.material) })
      const raiz = new THREE.Group()
      raiz.name = 'RenderboxClaro'
      raiz.position.set(C.x, 0, C.z)
      raiz.rotation.y = C.giro
      raiz.scale.setScalar(C.escala)
      raiz.add(p.grupo)
      // su cable a un registro en el piso, detrás (props_claro.glb, en el marco de la Renderbox): no tiembla
      // con ella, se queda tendido
      const nodoCable = claro?.scene.getObjectByName('Prop_RenderboxCable')
      const cable = nodoCable ? armarPintado(copiaLocal(nodoCable)) : null
      if (cable) { raiz.add(cable.grupo); p.cable = cable }
      raiz.updateMatrixWorld(true)
      renderboxClaro.radio = Math.hypot(_caja.max.x - _caja.min.x, _caja.max.z - _caja.min.z) / 2 * C.escala * 0.82
      renderboxClaro.alto = (_caja.max.y - _caja.min.y) * C.escala
      const rt = new THREE.WebGLRenderTarget(16, 16)
      try { await compileAsyncSafe(gl, raiz, camera, 10000, rt, scene) } catch { }
      rt.dispose()
      if (!vivo) return
      pc.current = p
      renderboxClaro.montado = true
      setObstaculosExtra('renderbox', [{ x: C.x, z: C.z, r: renderboxClaro.radio }])
      setArmado(raiz)
    }).catch((e) => console.warn('[renderbox] no se armó', e))
    return () => {
      vivo = false
      renderboxClaro.montado = false
      setObstaculosExtra('renderbox', [])
    }
  }, [gl, camera, scene])

  // el motor se calla al salir de la home, con la pestaña oculta o si la escena deja de dibujarse
  useEffect(() => {
    const callar = () => { if (voz.current) { pararVentiladores(); voz.current = false } }
    if (!activo) callar()
    const vigila = setInterval(() => {
      if (voz.current && performance.now() - ultimoCuadro.current > SOLTAR_SIN_CUADROS_MS) callar()
    }, 200)
    const oculta = () => { if (document.hidden) callar() }
    document.addEventListener('visibilitychange', oculta)
    return () => { clearInterval(vigila); document.removeEventListener('visibilitychange', oculta); callar() }
  }, [activo])

  useEffect(() => () => pararVentiladores(true), [])

  useFrame((state, dt) => {
    const p = pc.current
    if (!p || !visible) return
    const rb = renderboxClaro.rb
    rb.paso(dt)
    p.medir(state)
    p.cable?.medir(state)
    if (rb.golpes !== golpesVistos.current) {
      golpesVistos.current = rb.golpes
      // las chispas salen del lado por donde llegó la patada, a media altura baja
      const jug = playerRef?.current
      _n.set(0, 0, 1)
      if (jug) {
        armado.worldToLocal(_p.copy(jug.position))
        _n.set(_p.x - p.base.x, 0, _p.z - p.base.z)
        if (_n.lengthSq() < 1e-6) _n.set(0, 0, 1)
        _n.normalize()
      }
      const alto = renderboxClaro.alto / RENDERBOX_CLARO.escala
      chispas.current?.disparar([p.base.x + _n.x * p.medioAncho, p.base.y + alto * 0.38, p.base.z + _n.z * p.medioAncho], [_n.x, 0.25, _n.z])
    }
    for (const v of p.ventiladores) v.malla.quaternion.setFromAxisAngle(v.eje, rb.giro)
    for (const l of p.luces) l.material.color.copy(l.prendido).multiplyScalar(rb.boton)
    // golpe de caricatura + temblor: T(base + temblor + lo que sube al ladearse) · Rz(ladeo) · S · T(−base)
    const [vx, vy, vz] = vibracionRenderbox(state.clock.elapsedTime, rb.rpm, RENDERBOX.temblor / RENDERBOX_CLARO.escala)
    const f = rb.deformacion()
    const b = p.base
    _mA.makeTranslation(-b.x, -b.y, -b.z)
    _mB.makeScale(f.sx, f.sy, f.sz).multiply(_mA)
    _mA.makeRotationZ(f.ladeo).multiply(_mB)
    _mB.makeTranslation(b.x + vx, b.y + vy + Math.abs(Math.sin(f.ladeo)) * p.medioAncho, b.z + vz).multiply(_mA)
    p.grupo.matrix.copy(_mB)
    p.grupo.matrixWorldNeedsUpdate = true

    // el motor: se oye según qué tan cerca está Skulley, del lado de la pantalla donde está ella
    ultimoCuadro.current = performance.now()
    const jug = playerRef?.current
    if (!activo || !jug) return
    const [cerca, lejos] = RENDERBOX_CLARO.oye
    const d = Math.hypot(jug.position.x - RENDERBOX_CLARO.x, jug.position.z - RENDERBOX_CLARO.z)
    if (!voz.current && d < lejos) voz.current = iniciarVentiladores()
    else if (voz.current && d > lejos + 4) { pararVentiladores(); voz.current = false }
    if (!voz.current) return
    const cercania = Math.max(0, Math.min(1, 1 - (d - cerca) / (lejos - cerca)))
    _p.set(RENDERBOX_CLARO.x, renderboxClaro.alto * 0.5, RENDERBOX_CLARO.z).project(state.camera)
    ajustarVentiladores(cercania, Math.max(-0.8, Math.min(0.8, _p.x * 0.8)), rb.rpm)
  })

  if (typeof window !== 'undefined' && import.meta.env.DEV) window.__renderboxClaro = { estado: renderboxClaro, armado, patear: (l = 1) => renderboxClaro.rb.patear(l) }
  // las chispas van montadas desde el principio (en reposo count = 0) para que se compilen con la escena
  return (
    <group visible={visible}>
      {armado && <primitive object={armado} />}
      <group position={[RENDERBOX_CLARO.x, 0, RENDERBOX_CLARO.z]} rotation={[0, RENDERBOX_CLARO.giro, 0]} scale={RENDERBOX_CLARO.escala}>
        <ChispasGolpe ref={chispas} />
      </group>
    </group>
  )
}
