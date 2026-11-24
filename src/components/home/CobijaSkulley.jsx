import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { crearUniformContorno, medirContorno, glslContorno } from '../../lib/contornoPantalla.js'
import { siesta, ahoraS } from '../../lib/siestaSkulley.js'
import { sonarCobijaAparece, sonarCobijaCae, sonarCobijaTirada, sonarPuf } from '../../lib/siestaSonidos.js'
import HumoDron from '../drone/HumoDron.jsx'

// La cobijita que M.A.D.R.E. le pone a Skulley dormido (Oscar, 2026-11-23). Es tela simulada en
// Blender (scripts/skulley-anim/cobija.py) que cae sobre su pose de dormido; la caída viene como
// formas (morph targets) que aquí se recorren en orden: entre una y la siguiente se mezclan dos
// (pesos que suman 1), así la tela cae como en la simulación. Encima respira con él (cubre ↔
// inhala) y al despertar la avienta: sube volando, se extiende y cae tirada a su lado (piso).
//
// Vive en el espacio del modelo de cuando se durmió (siesta.matriz: el de la escena del personaje,
// el mismo de los props). Montada siempre y visible bajo el piso: así el warm-up compila sus dos
// programas (el toon con formas y el contorno) y que aparezca no compila nada.
// Va colgada del grupo de Skulley (playerRef) con su matriz compensada cada cuadro (se queda en
// el mundo aunque él camine): así entra al pase de normales de la tinta (CharacterNormalPass), que
// la dibuja solo en profundidad antes que a él (`ocluyeTinta`) y le tapa las líneas del cuerpo.
// Su cuadro corre después de Player (prioridad 0.4), antes que ese pase (0.5).
//
// Fases (siesta.cobija.fase): nada → aparece (la pide el drone) → cae → puesta → tirada → sevaya → nada.

const FPS = 30
// cuadro de la simulación de la base y de cae_01 … cae_10 (CAIDA en cobija.py)
const CAIDA = [1, 4, 7, 10, 13, 16, 20, 25, 32, 44, 70]
const T = {
  aparece: 0.38,      // de nada a su tamaño, con un rebote
  espera: 0.4,        // extendida bajo el drone antes de soltarla
  caeVel: 0.9,        // la simulación un poco más lenta: flota como sábana
  respira: 0.5,       // al terminar de caer entra la respiración en este rato
  tiro: 0.62,         // aventada: sale en arco hacia su lado y cae arrugada
  queda: 3.2,         // tirada antes de irse
  vaya: 0.3,          // se encoge con un puf
}
const LADO = 1.1      // a dónde cae aventada (m del modelo, hacia la izquierda de Skulley: +X; lejos de su mano en el piso)
const ALTO_TIRO = 0.32 // lo alto del arco
const ESCONDIDA = new THREE.Vector3(0, -60, 0)
// Sarape de caricatura: franjas de mitad del largo (se reflejan), [color, alto en px de 512]
const COLORES = {
  rosa: '#e4007c', negro: '#1d1424', crema: '#f4ead8', naranja: '#ff7014',
  amarillo: '#f5ff00', turquesa: '#12b5a6', morado: '#6a2fd0', rojo: '#d7263d',
}
const MITAD = [
  ['fleco', 14], ['negro', 4], ['rojo', 26], ['negro', 3], ['crema', 3], ['negro', 3],
  ['naranja', 18], ['amarillo', 5], ['naranja', 18], ['negro', 3], ['turquesa', 24], ['crema', 4],
  ['morado', 14], ['crema', 4], ['turquesa', 24], ['negro', 3], ['crema', 3], ['negro', 3],
]

function texturaSarape() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 512
  const g = c.getContext('2d')
  const franjas = [...MITAD]
  const usado = MITAD.reduce((s, [, h]) => s + h, 0)
  franjas.push(['rosa', 512 - 2 * usado])
  franjas.push(...[...MITAD].reverse())
  let y = 0
  for (const [n, h] of franjas) {
    if (n === 'fleco') {
      g.fillStyle = COLORES.crema
      g.fillRect(0, y, 64, h)
      g.fillStyle = COLORES.negro
      for (let x = 2; x < 64; x += 5) g.fillRect(x, y, 1, h)
    } else {
      g.fillStyle = COLORES[n]
      g.fillRect(0, y, 64, h)
    }
    y += h
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// El contorno como el de Argus y el drone (grosor medido en pantalla), con la normal de las formas
function materialContorno(grosor) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: false, toneMapped: false })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uContorno = grosor
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uContorno;')
      .replace('#include <project_vertex>', `vec3 nCobija = vec3( normal );
      #ifdef USE_MORPHNORMALS
        nCobija *= morphTargetBaseInfluence;
        for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
          if ( morphTargetInfluences[ i ] != 0.0 ) nCobija += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
        }
      #endif
      ${glslContorno({ normalSinPiel: 'nCobija' })}`)
  }
  m.customProgramCacheKey = () => 'contornoCobija'
  return m
}

const suave = (x) => x * x * (3 - 2 * x)
// crece pasándose un poco de su tamaño y regresa (easeOutBack)
const alRebote = (u) => { const c1 = 2.2, c3 = c1 + 1, x = u - 1; return 1 + c3 * x * x * x + c1 * x * x }
const clamp01 = (x) => Math.max(0, Math.min(1, x))

export default function CobijaSkulley({ gltf, playerRef }) {
  const humoRef = useRef({ pos: new THREE.Vector3(), nivel: 0 })
  const armado = useMemo(() => {
    let fuente = null
    gltf.scene.traverse((o) => { if (!fuente && o.isMesh) fuente = o })
    if (!fuente) return null
    // meshopt guarda las posiciones cuantizadas y su escala va en el nodo: hay que conservarlo
    gltf.scene.updateMatrixWorld(true)
    const nodo = fuente.matrixWorld.clone()
    const geo = fuente.geometry
    // la caja de la base sola (computeBoundingBox suma las formas: la tirada en el piso y demás)
    const caja = new THREE.Box3().setFromBufferAttribute(geo.attributes.position)
    const dic = fuente.morphTargetDictionary || {}
    const idx = (n) => (dic[n] ?? -1)
    const mat = new THREE.MeshStandardMaterial({ map: texturaSarape(), roughness: 1, metalness: 0 })
    applyToonBanding(mat, { steps: 2, minBand: 0.04, bandIndirect: true })
    const grosor = crearUniformContorno()
    const cuerpo = new THREE.Mesh(geo, mat)
    const contorno = new THREE.Mesh(geo, materialContorno(grosor))
    cuerpo.morphTargetInfluences = new Array(Object.keys(dic).length).fill(0)
    cuerpo.morphTargetDictionary = dic
    // el contorno comparte los pesos (es el mismo arreglo)
    contorno.morphTargetInfluences = cuerpo.morphTargetInfluences
    contorno.morphTargetDictionary = dic
    for (const m of [cuerpo, contorno]) {
      m.frustumCulled = false
      nodo.decompose(m.position, m.quaternion, m.scale)
    }
    cuerpo.name = 'Cobija'
    contorno.name = 'Cobija_outline'
    contorno.renderOrder = -1
    cuerpo.userData.ocluyeTinta = true
    const grupo = new THREE.Group()
    grupo.name = 'CobijaSiesta'
    grupo.matrixAutoUpdate = false
    grupo.add(contorno, cuerpo)
    const caida = ['', ...Array.from({ length: CAIDA.length - 1 }, (_, i) => `cae_${String(i + 1).padStart(2, '0')}`)].map((n) => (n ? idx(n) : -1))
    // el centro de la cobija extendida (donde la pone el drone) y el de la tirada, en el espacio del modelo
    const centro = new THREE.Vector3()
    caja.getCenter(centro).applyMatrix4(nodo)
    const tam = new THREE.Vector3()
    caja.getSize(tam)
    tam.multiply(new THREE.Vector3().setFromMatrixScale(nodo))
    return {
      geo, cuerpo, contorno, grosor, caida, centro, grupo,
      cubre: idx('cubre'), inhala: idx('inhala'), piso: idx('piso'),
      // el alto de la cobija para el grosor del contorno
      alto: tam.x,
    }
  }, [gltf])

  const est = useRef({ fase: 'nada', vista: 0, desdePuesta: 0, desde: null, sono: {} })
  const tmp = useMemo(() => ({
    M: new THREE.Matrix4(), off: new THREE.Matrix4(), s: new THREE.Vector3(), c: new THREE.Vector3(),
    q: new THREE.Quaternion(), p: new THREE.Vector3(), ec: new THREE.Vector3(),
  }), [])

  // colgada de Skulley (ver arriba)
  useEffect(() => {
    const p = playerRef?.current
    if (!armado || !p) return undefined
    p.add(armado.grupo)
    return () => { p.remove(armado.grupo) }
  }, [armado, playerRef])
  useEffect(() => () => {
    if (!armado) return
    armado.cuerpo.material.map?.dispose()
    armado.cuerpo.material.dispose()
    armado.contorno.material.dispose()
  }, [armado])

  useFrame(({ camera, size, gl }) => {
    const A = armado
    const g = A?.grupo
    const padre = playerRef?.current
    if (!g || !padre) return
    const w = A.cuerpo.morphTargetInfluences
    const C = siesta.cobija
    const E = est.current
    const ahora = ahoraS()
    // mientras duerme, el drone sabe a dónde ir: el centro de la cobija extendida en el mundo
    if (siesta.estado === 'dormido' || C.fase !== 'nada') {
      tmp.M.fromArray(siesta.matriz)
      tmp.c.copy(A.centro).applyMatrix4(tmp.M)
      siesta.cobijaCentro.x = tmp.c.x
      siesta.cobijaCentro.y = tmp.c.y
      siesta.cobijaCentro.z = tmp.c.z
    }
    if (C.fase !== E.fase) {
      // al entrar a cada fase: sus sonidos y lo que arranca
      E.fase = C.fase
      E.desde = C.fase === 'nada' ? null : C.t0
      if (C.fase === 'aparece') sonarCobijaAparece()
      if (C.fase === 'tirada') {
        sonarCobijaTirada()
        // de dónde la avienta: los pesos de ese momento
        E.pesosTiro = w.slice()
      }
      if (C.fase === 'sevaya') { sonarPuf(); E.escalaVaya = E.escala ?? 1 }
    }
    for (let i = 0; i < w.length; i++) w[i] = 0
    let escala = 1
    let visible = C.fase !== 'nada'
    tmp.off.identity()
    const t = E.desde == null ? 0 : ahora - E.desde
    if (C.fase === 'aparece') {
      // imprimiéndose: crece desde el centro con un rebote
      const u = clamp01(t / T.aparece)
      escala = alRebote(u)
      if (t > T.aparece + T.espera) { C.fase = 'cae'; C.t0 = ahora }
    } else if (C.fase === 'cae') {
      const f = 1 + t * FPS * T.caeVel
      const cad = CAIDA
      if (f >= cad[cad.length - 1]) {
        C.fase = 'puesta'
        C.t0 = ahora
        w[A.caida[cad.length - 1]] = 1
      } else {
        let k = 0
        while (k < cad.length - 2 && f >= cad[k + 1]) k++
        const u = (f - cad[k]) / (cad[k + 1] - cad[k])
        if (A.caida[k] >= 0) w[A.caida[k]] = 1 - u
        if (A.caida[k + 1] >= 0) w[A.caida[k + 1]] += u
        // cuando toca su cuerpo (entre el segundo y el tercer cuadro guardado)
        if (!E.sono.cae && f >= cad[3]) { E.sono.cae = true; sonarCobijaCae() }
      }
    } else if (C.fase === 'puesta') {
      // de la última de la caída a la respiración
      const r = suave(clamp01(t / T.respira))
      const b = siesta.respira
      const ult = A.caida[CAIDA.length - 1]
      if (ult >= 0) w[ult] = 1 - r
      if (A.cubre >= 0) w[A.cubre] += r * (1 - b)
      if (A.inhala >= 0) w[A.inhala] += r * b
    } else if (C.fase === 'tirada') {
      // se la quita de encima: sale en arco hacia su izquierda arrugándose (de como estaba a la
      // tirada, que es la misma tela caída al piso sin él debajo) y cae lejos de su cuerpo
      const p0 = E.pesosTiro || w
      const u = clamp01(t / T.tiro)
      const k = suave(u)
      for (let i = 0; i < w.length; i++) w[i] = (p0[i] || 0) * (1 - k)
      if (A.piso >= 0) w[A.piso] += k
      tmp.off.makeTranslation(LADO * k, 0, ALTO_TIRO * 4 * u * (1 - u))
      if (!E.sono.piso && u > 0.85) { E.sono.piso = true; sonarCobijaCae() }
      if (t > T.tiro + T.queda) { C.fase = 'sevaya'; C.t0 = ahora }
    } else if (C.fase === 'sevaya') {
      // un puf: se encoge donde esté
      const u = clamp01(t / T.vaya)
      const p0 = E.pesosVaya || (E.pesosVaya = E.pesosUlt ? E.pesosUlt.slice() : w.slice())
      for (let i = 0; i < w.length; i++) w[i] = p0[i] || 0
      tmp.off.copy(E.offUlt || tmp.off)
      escala = (E.escalaVaya ?? 1) * (1 - suave(u))
      humoRef.current.nivel = u < 0.6 ? 1 : 0
      if (u >= 1) {
        C.fase = 'nada'
        visible = false
        humoRef.current.nivel = 0
      }
    }
    if (C.fase !== 'sevaya') {
      E.pesosVaya = null
      E.pesosUlt = w.slice()
      E.offUlt = (E.offUlt || new THREE.Matrix4()).copy(tmp.off)
    }
    if (C.fase === 'nada') { E.sono = {}; E.pesosTiro = null }
    E.escala = escala

    // dónde: en el espacio del modelo al dormirse (Blender: Z arriba → three: Y arriba, Z = -Y de Blender)
    if (visible) {
      tmp.M.fromArray(siesta.matriz)
      // el desplazamiento de la tirada viene en ejes de Blender (x, y, z): en el modelo es (x, z, -y)
      const e = tmp.off.elements
      tmp.p.set(e[12], e[14], -e[13])
      tmp.M.multiply(tmp.off.makeTranslation(tmp.p.x, tmp.p.y, tmp.p.z))
      // la escala de "aparece" y "sevaya", desde su centro
      if (escala !== 1) {
        tmp.ec.copy(A.centro)
        tmp.off.makeTranslation(tmp.ec.x, tmp.ec.y, tmp.ec.z)
          .multiply(new THREE.Matrix4().makeScale(Math.max(1e-3, escala), Math.max(1e-3, escala), Math.max(1e-3, escala)))
          .multiply(new THREE.Matrix4().makeTranslation(-tmp.ec.x, -tmp.ec.y, -tmp.ec.z))
        tmp.M.multiply(tmp.off)
      }
      tmp.c.copy(A.centro).applyMatrix4(tmp.M)
      humoRef.current.pos.copy(tmp.c)
    } else {
      // escondida bajo el piso y en un punto (visible para que el warm-up la compile y que three
      // la recompile con la escena si algo cambia; así no pinta ni un pixel)
      tmp.M.makeScale(1e-4, 1e-4, 1e-4).setPosition(ESCONDIDA)
    }
    // en el mundo, aunque cuelgue de Skulley: su matriz local deshace la de él
    padre.updateWorldMatrix(true, false)
    g.matrix.copy(padre.matrixWorld).invert().multiply(tmp.M)
    g.matrixWorldNeedsUpdate = true
    tmp.s.setFromMatrixScale(tmp.M)
    tmp.c.copy(A.centro).applyMatrix4(tmp.M)
    medirContorno(A.grosor, camera, size, gl.getPixelRatio(), tmp.c, A.alto * tmp.s.y)
  }, 0.4)

  if (!armado) return null
  // el puf de cuando se va
  return <HumoDron fuenteRef={humoRef} />
}
