import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { extendGLTFLoaderKTX2 } from '../lib/ktx2Setup.js'
import { applyToonBanding } from '../lib/toonBanding.js'
import { applyNeonOrb } from '../lib/applyNeonOrb.js'
import makeHullOutline from '../lib/makeHullOutline.js'
import { sectionColors } from '../lib/appHelpers.js'
import SpeechBubble3D from './SpeechBubble3D.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { playSfx } from '../lib/sfx.js'
import { escuchar as escucharJuego } from '../lib/juegoEsferas.js'
import { crearMaterialMochila, crearCaraMochila } from './argus/pantallaMochila.js'
import { crearRelojHolograma } from './argus/relojHolograma.js'
import { argus, escucharArgus } from '../lib/argusNpc.js'

// Zoidian (Argus) — NPC dueño del juego de las esferas. Vive donde antes flotaba
// solo el "!" amarillo (entre los portales de Store y Contact); ahora el signo
// flota ARRIBA de él. Click → diálogo (ZoidianDialog en App) → instrucciones.
//
// El GLB (zoidian_rig.glb) lo arma scripts/argus/armar_argus.py a partir del de
// Sketchfab (zoidian.glb): esqueleto limpio con el reposo en la pose que se ve,
// huesos de cara (quijada, globos de los ojos, cuatro párpados que se le
// agregaron, cejas), tres huesos por antena y los clips de abajo. Encima de los
// clips, aquí: la cara (parpadeo, mirada, expresión, quijada al hablar), el
// resorte de las antenas, la esfera luminosa del idle de comer, el head tracking
// hacia Skulley y el empujón procedural.
//
// El modelo se AUTO-CENTRA por bounding box: pies en y=0, centrado en X/Z.

const ZOIDIAN_URL = `${import.meta.env.BASE_URL}3dmodels/zoidian_rig.glb`
// Hueso de la cabeza. Lo usan el head-tracking y el encuadre del retrato.
export const ZOIDIAN_HEAD_BONE = 'head_05'
const ZOIDIAN_NECK_BONE = 'neck_04'

// Clips (ver acciones_lista.py). Los de una vez regresan solos a la base.
const UNA_VEZ = new Set(['IdleMirar', 'IdleImpaciente', 'IdleComer', 'Saludo', 'Risa', 'Impresionado', 'Empujon',
  'Trato', 'Senalar', 'Presumir', 'Encogerse', 'Celebrar'])
const VARIEDAD = [['IdleComer', 0.45], ['IdleMirar', 0.3], ['IdleImpaciente', 0.25]]
// Una reacción no interrumpe a otra de más peso.
const PESO_REACCION = { Saludo: 1, Impresionado: 2, Risa: 3, Empujon: 4 }
const TRANSICION = 0.35
// Cuánto manda el head tracking en cada clip: los que mueven la cabeza a
// propósito (mirar alrededor, comer, reírse) casi no lo dejan.
const SEGUIR_EN = { Idle: 1, Hablar: 1, Saludo: 0.9, Impresionado: 0.6, IdleImpaciente: 0.5, IdleMirar: 0.15, IdleComer: 0.12, Risa: 0.2, Empujon: 0.3,
  Trato: 0.8, Senalar: 1, Presumir: 0.5, Encogerse: 0.7, Celebrar: 0.3 }

// Cada párpado son tres huesos a lo ancho del ojo; cada uno cierra hasta la línea
// medida de la cuenca en su lugar (grados, de armar_argus.py), así el filo sigue la
// almendra inclinada del ojo a cualquier altura. 1 = cerrado. El hueso 0 es la
// orilla de afuera en el ojo izquierdo y la de adentro en el derecho (ADENTRO).
const CIERRE = {
  L: { sup: [80.13, 56.98, 28.19], inf: [52.21, 38.02, 20.37] },
  R: { sup: [28.18, 56.98, 79.71], inf: [20.37, 38.02, 51.95] },
}
const ADENTRO = { L: 2, R: 0 }
// Abiertos se guardan este tanto más adentro de la cuenca (grados): desde arriba la
// cámara alcanzaba a ver el filo debajo de la ceja.
const ABIERTO_EXTRA = 14
// La carita de la mochila ve a Skulley si está más cerca que `lejos` (unidades del
// mundo) y dentro de un cono de ~75° alrededor de hacia donde ve la pantalla.
const MOCHILA_VE = { lejos: 16, cono: Math.cos(THREE.MathUtils.degToRad(75)) }
// La pupila queda a ~30 % de la orilla de arriba: con más de ~0.4 el párpado la tapa.
// Al mirar arriba el párpado sube con el ojo (por radián de mirada).
const SUBE_CON_MIRADA = 1.3
const ESFERA_R = 0.09 // radio de la esfera de comer, en el espacio del modelo

// Expresiones: párpados (0..1; supInt/supExt cierran de más la orilla de adentro o
// la de afuera: enojo y tristeza), cejas (en unidades del modelo, + = arriba; int =
// solo la de adentro; L/R = de un lado) y boca (son = sonrisa, + arriba y afuera,
// - abajo; junta = boca en "o"; grune = labio de arriba arriba).
const EXPR = {
  neutral: {},
  feliz: { inf: 0.4, ceja: 0.02, cejaInt: 0.015, son: 0.8 },
  carcajada: { sup: 0.3, inf: 0.55, ceja: 0.03, son: 1.2 },
  sorpresa: { ceja: 0.06, cejaInt: 0.01, junta: 0.6 },
  furia: { sup: 0.15, supInt: 0.25, supExt: -0.15, ceja: -0.02, cejaInt: -0.025, grune: 0.8, son: -0.4 },
  aburrido: { sup: 0.36, ceja: -0.005, son: -0.3 },
  sospecha: { sup: 0.28, cejaL: 0.05, cejaR: -0.02, son: 0.3 },
  apretados: { sup: 1, inf: 1, ceja: -0.02, junta: 0.3 },
  encoge: { ceja: 0.04, inf: 0.12, son: -0.2 },
}
const CLAVES_EXPR = ['sup', 'inf', 'supInt', 'supExt', 'ceja', 'cejaInt', 'cejaL', 'cejaR', 'son', 'junta', 'grune']
// Formas de boca al hablar. q: quijada en grados (0 = la boca del modelo,
// entreabierta; con -4 cierra los dientes y con -7 casi los labios; más, se arruga
// la barbilla); ancho / junta: comisuras afuera o juntas (como la expresión);
// labio / frente: el labio de arriba sube o se adelanta. Medidas en Blender.
const VISEMAS = {
  reposo: { q: 0, ancho: 0, junta: 0, labio: 0, frente: 0 },
  cerrada: { q: -2.5, ancho: 0.05, junta: 0, labio: -0.002, frente: 0 },
  A: { q: 12, ancho: 0.25, junta: 0, labio: 0.014, frente: 0 },
  E: { q: 6, ancho: 0.8, junta: 0, labio: 0.01, frente: 0 },
  I: { q: 3, ancho: 0.9, junta: 0, labio: 0.007, frente: 0 },
  O: { q: 8, ancho: -0.2, junta: 0.6, labio: 0.004, frente: 0.007 },
  U: { q: 3, ancho: -0.3, junta: 0.85, labio: 0, frente: 0.01 },
  M: { q: -5, ancho: 0.1, junta: 0.15, labio: -0.005, frente: 0 },
  F: { q: 2, ancho: 0.3, junta: 0, labio: 0.008, frente: 0.004 },
}
// Las formas de boca abiertas salen más seguido que las cerradas: saltar de la A a
// la M en cada sílaba se veía robótico (Oscar)
const PESO_VISEMA = [['A', 0.24], ['E', 0.22], ['I', 0.12], ['O', 0.16], ['U', 0.08], ['M', 0.08], ['F', 0.1]]
const canal = () => ({ x: 0, v: 0 })
function crearBoca() {
  return {
    t: 0, dur: 0, vis: 'reposo', restan: 0, idx: 0, acento: 0, fuerte: false, ladoMeta: 0,
    fuerza: 1, qLado: 0, qRoll: 0, cejaMeta: 0, asim: 0, pausaLarga: false, miraMeta: [0, 0], fase: Math.random() * 100,
    q: canal(), ancho: canal(), junta: canal(), labio: canal(), frente: canal(), lado: canal(), ceja: canal(), cabeza: canal(),
    jl: canal(), jr: canal(), cejaPal: canal(), ojos: canal(), miraX: canal(), miraY: canal(),
  }
}
function elegirVisema(antes) {
  const op = PESO_VISEMA.filter(([n]) => n !== antes)
  let r = Math.random() * op.reduce((t, [, w]) => t + w, 0)
  for (const [n, w] of op) { r -= w; if (r <= 0) return n }
  return op[0][0]
}
// La siguiente sílaba: entre palabras la boca cierra (a veces una pausa larga,
// como coma); en cada palabra una sílaba es la fuerte.
function siguienteSilaba(bo) {
  bo.t = 0
  if (bo.restan <= 0) {
    if (bo.vis !== 'cerrada' && bo.vis !== 'reposo') {
      bo.vis = 'cerrada'
      bo.fuerte = false
      bo.pausaLarga = Math.random() < 0.18
      bo.dur = bo.pausaLarga ? 0.38 + Math.random() * 0.2 : 0.13 + Math.random() * 0.1
      // en las pausas largas desvía la mirada un instante (piensa) y regresa
      bo.miraMeta = bo.pausaLarga ? [(Math.random() - 0.5) * 0.4, (Math.random() - 0.3) * 0.16] : [0, 0]
      return
    }
    bo.pausaLarga = false
    bo.miraMeta = [0, 0]
    bo.restan = 1 + Math.floor(Math.random() * 4)
    bo.idx = 0
    bo.acento = Math.floor(Math.random() * bo.restan)
    bo.ladoMeta = Math.random() < 0.45 ? (Math.random() < 0.5 ? -1 : 1) : 0
    // las cejas de cada palabra: casi siempre suben (más o menos), a veces frunce,
    // y a veces más una que otra
    const r = Math.random()
    bo.cejaMeta = r < 0.6 ? 0.004 + Math.random() * 0.009 : r < 0.75 ? -0.007 : 0
    bo.asim = Math.random() < 0.4 ? (Math.random() - 0.5) * 1.2 : 0
  }
  bo.fuerte = bo.idx === bo.acento
  bo.vis = elegirVisema(bo.vis)
  // cada sílaba abre distinto, la fuerte más; la quijada se corre y se ladea poquito
  bo.fuerza = bo.fuerte ? 1.1 + Math.random() * 0.15 : 0.55 + Math.random() * 0.45
  bo.qLado = (Math.random() - 0.5) * 3
  bo.qRoll = (Math.random() - 0.5) * 1.6
  bo.dur = bo.fuerte ? 0.3 + Math.random() * 0.12 : 0.18 + Math.random() * 0.12
  bo.idx += 1
  bo.restan -= 1
}
// Resorte amortiguado de un canal (en subpasos: un cuadro lento no lo vuelve inestable)
function resorte(c, meta, dt, hz, zeta) {
  const w = 2 * Math.PI * hz
  const pasos = Math.max(1, Math.ceil(dt * 240))
  const h = dt / pasos
  for (let i = 0; i < pasos; i += 1) {
    c.v += (-w * w * (c.x - meta) - 2 * zeta * w * c.v) * h
    c.x += c.v * h
  }
  if (!Number.isFinite(c.x) || !Number.isFinite(c.v)) { c.x = meta; c.v = 0 }
}
// La cara de cada momento de cada clip: [segundo, expresión].
const CARA_CLIP = {
  IdleComer: [[0, 'neutral'], [0.3, 'sorpresa'], [1.3, 'feliz'], [3.7, 'sorpresa'], [4.6, 'apretados'], [4.78, 'feliz'],
    [6.05, 'apretados'], [6.45, 'feliz'], [8.15, 'sorpresa'], [8.7, 'feliz'], [9.5, 'neutral']],
  IdleMirar: [[0, 'neutral'], [0.6, 'sospecha'], [4.5, 'encoge'], [5.2, 'neutral']],
  IdleImpaciente: [[0, 'neutral'], [0.5, 'aburrido'], [5.6, 'neutral']],
  Saludo: [[0, 'neutral'], [0.3, 'feliz'], [2.2, 'neutral']],
  Risa: [[0, 'feliz'], [0.25, 'carcajada'], [2.6, 'feliz'], [3.1, 'neutral']],
  Impresionado: [[0, 'sorpresa'], [0.6, 'feliz'], [2.4, 'neutral']],
  // los de la escena del trato (si el renglón no trae cara)
  Trato: [[0, 'sospecha'], [1.5, 'feliz'], [2.6, 'neutral']],
  Senalar: [[0, 'neutral']],
  Presumir: [[0, 'feliz'], [2.1, 'neutral']],
  Encogerse: [[0, 'encoge'], [1.4, 'neutral']],
  Celebrar: [[0, 'carcajada'], [1.5, 'feliz']],
}
// Hacia dónde mira cada clip (si no, sigue a Skulley o pasea la mirada):
// [desde, hasta, 'esfera' | [yaw, pitch] en radianes respecto a su frente].
const MIRADA_CLIP = {
  IdleComer: [[0.25, 1.3, [-0.3, 0.6]], [1.3, 4.5, 'esfera'], [8.1, 8.6, [0, 0.4]]],
  IdleMirar: [[0.4, 1.9, [-0.45, 0.05]], [2.2, 3.2, [0.45, 0.0]], [3.2, 4.4, [0.2, 0.45]]],
  IdleImpaciente: [[0.4, 2.1, [0.3, -0.4]], [2.5, 3.0, [0.0, 0.3]], [4.6, 5.6, [0.0, -0.05]]],
}

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _v4 = new THREE.Vector3()
const _mir = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _q3 = new THREE.Quaternion()
const _e = new THREE.Euler()
const EJE_X = new THREE.Vector3(1, 0, 0)
const EJE_Z = new THREE.Vector3(0, 0, 1)
const ARRIBA = new THREE.Vector3(0, 1, 0)
const _q4 = new THREE.Quaternion()

// Aplica un giro en ejes del MUNDO a un hueso, encima de lo que ya tiene.
function girarEnMundo(bone, qMundo) {
  bone.getWorldQuaternion(_q2)
  _q3.copy(_q2).invert().multiply(qMundo).multiply(_q2)
  bone.quaternion.multiply(_q3)
}

function valorExpr(nombre, k) {
  const e = EXPR[nombre] || EXPR.neutral
  return e[k] || 0
}

// Modelo + capas. Reusable: escena principal y retrato del diálogo.
// `lookAtRef`: Object3D a seguir con cabeza, cuello y ojos (Skulley).
// `pushRef`: timeline del EMPUJÓN procedural ({ t: -1 } = sin empujón).
// `ctrlRef`: aquí se cuelga { reaccionar(nombre) } para el NPC.
// `hablaRef`: { ultimo } = performance.now() de la última letra que dijo; mientras
//   escribe, mueve la quijada y gesticula (clip Hablar).
// `variedad`: idles de variedad cada tanto (en el retrato no).
// `pitchMax`: cuánto puede levantar la cabeza (rad).
// `outlineWorld`: grosor del contorno en unidades del mundo.
export function ZoidianModel({ targetHeight = 1.7, lookAtRef = null, outlineColor = '#000000', outlineWorld = 0.02, pushRef = null, onMeasured, toon = null, pitchMax = 0.45, ctrlRef = null, hablaRef = null, variedad = false, dialogoRef = null }) {
  const groupRef = useRef()
  const { scene: srcScene, animations } = useGLTF(ZOIDIAN_URL, true, true, extendGLTFLoaderKTX2)

  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(srcScene)
    // Contorno de hull invertido — MISMA receta que el outline de Skulley
    // (Player.jsx): MeshBasicMaterial negro BackSide extruido a lo largo de la
    // normal DESPUÉS del skinning, así el trazo se deforma con los clips, la
    // cara y el head-tracking. El grosor va en unidades del objeto.
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x000000, side: THREE.BackSide, transparent: false, depthWrite: true, depthTest: true, fog: false, toneMapped: false,
    })
    outlineMat.onBeforeCompile = (shader) => {
      shader.uniforms.outlineThickness = { value: c.userData.__outlineThickness || 0.012 }
      c.userData.__outlineUniform = shader.uniforms.outlineThickness
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        uniform float outlineThickness;`)
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#ifdef USE_SKINNING
        transformed += normalize(objectNormal) * outlineThickness;
        #else
        transformed += normalize(normal) * outlineThickness;
        #endif
        #include <project_vertex>`)
    }
    const skinnedMeshes = []
    c.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return
      if (o.name.includes('pantalla')) {
        // la carita de la mochila: su propio shader (sin toon ni contorno)
        o.material = crearMaterialMochila(o.geometry)
        o.frustumCulled = false
        o.raycast = () => { }
        c.userData.__mochila = o
        return
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      const out = mats.map((m) => {
        const mm = m.clone()
        try { applyToonBanding(mm, { steps: 2, minBand: 0.04, bandIndirect: true, ...toon }) } catch { }
        return mm
      })
      o.material = Array.isArray(o.material) ? out : out[0]
      o.frustumCulled = false
      o.raycast = () => { }
      if (o.isSkinnedMesh) skinnedMeshes.push(o)
    })
    // los párpados (su propia malla) no llevan contorno: escondidos en la cuenca, su
    // contorno se salía de la piel como mancha negra
    for (const o of skinnedMeshes.filter((m) => !m.name.includes('parpado') && !m.name.includes('pantalla'))) {
      const hull = new THREE.SkinnedMesh(o.geometry, outlineMat)
      hull.name = `${o.name || 'zoid'}_outline`
      hull.bindMode = o.bindMode
      hull.bind(o.skeleton, o.bindMatrix)
      hull.position.copy(o.position)
      hull.quaternion.copy(o.quaternion)
      hull.scale.copy(o.scale)
      hull.frustumCulled = false
      hull.raycast = () => { }
      o.parent.add(hull)
    }
    // Reposo de cada hueso (la cara y las antenas se ponen desde aquí cada cuadro)
    c.traverse((o) => {
      if (!o.isBone && !o.isObject3D) return
      o.userData.__restQ = o.quaternion.clone()
      o.userData.__restP = o.position.clone()
    })
    c.userData.__outlineMat = outlineMat
    // La esfera luminosa del idle de comer: hija del hueso `esfera` (el clip la
    // mueve y la escala; fuera del clip va en escala 0). Mismo material y
    // contorno que las esferas del juego, así que no compila nada propio, y se
    // dibuja desde el principio (con escala 0) para entrar al warm-up.
    const huesoEsfera = c.getObjectByName('esfera')
    if (huesoEsfera) {
      const mat = new THREE.MeshStandardMaterial({ color: '#000000', emissive: sectionColors.section1, emissiveIntensity: 1, roughness: 1, metalness: 0, transparent: true, opacity: 1 })
      applyNeonOrb(mat, { steps: 3, rimMul: 0.45, coreMul: 1.8, power: 1.4 })
      const esfera = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), mat)
      esfera.scale.setScalar(ESFERA_R)
      esfera.frustumCulled = false
      esfera.raycast = () => { }
      const borde = new THREE.Mesh(esfera.geometry, makeHullOutline({ color: 0x000000, thickness: 0.03 }))
      borde.renderOrder = -1
      borde.frustumCulled = false
      borde.raycast = () => { }
      esfera.add(borde)
      huesoEsfera.add(esfera)
      c.userData.__esfera = esfera
    }
    return c
  }, [srcScene])

  // Auto-fit: escala a `targetHeight` y apoya los pies en y=0.
  const fit = useMemo(() => {
    // El reposo del rig es la pose que se ve: basta la caja de la geometría en bind
    // (la de SkinnedMesh depende de que el esqueleto ya se haya actualizado).
    cloned.updateMatrixWorld(true)
    const box = new THREE.Box3()
    const caja = new THREE.Box3()
    cloned.traverse((o) => {
      if (!o.isSkinnedMesh || o.name.endsWith('_outline')) return
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      box.union(caja.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld))
    })
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const scale = targetHeight / Math.max(size.y, 0.001)
    return { scale, offset: [-center.x * scale, -box.min.y * scale, -center.z * scale], height: targetHeight }
  }, [cloned, targetHeight])

  useMemo(() => {
    const t = outlineWorld / fit.scale
    cloned.userData.__outlineThickness = t
    if (cloned.userData.__outlineUniform) cloned.userData.__outlineUniform.value = t
  }, [cloned, fit.scale, outlineWorld])

  useEffect(() => { try { onMeasured?.(fit) } catch { } }, [fit, onMeasured])
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__argusModelo = { cloned, fit, est, animations }
    return () => { if (window.__argusModelo?.cloned === cloned) delete window.__argusModelo }
  }, [cloned, fit])

  // Hover: el contorno cambia de color (uniform del material compartido).
  useEffect(() => {
    try { cloned.userData.__outlineMat?.color?.set(outlineColor) } catch { }
  }, [cloned, outlineColor])

  // ── Huesos ──
  const bones = useMemo(() => {
    const findBone = (...names) => {
      for (const n of names) {
        const b = cloned.getObjectByName(n)
        if (b) return b
      }
      return null
    }
    // OJO: GLTFLoader sanitiza los nombres y borra los puntos
    // (`upper_arm.L_09` llega como `upper_armL_09`). Se prueban las dos formas.
    const fingerChains = (side) => ['thumb', 'index', 'middle', 'ring'].map((f) => {
      const out = []
      cloned.traverse((o) => {
        if (!o.isBone || o.name.includes('_end')) return
        if (!o.name.startsWith(`${f}_`)) return
        if (new RegExp(`\\.?${side}_\\d+$`).test(o.name)) out.push(o)
      })
      return out
    })
    const b = {
      head: findBone(ZOIDIAN_HEAD_BONE),
      neck: findBone(ZOIDIAN_NECK_BONE),
      hips: findBone('hips_01'),
      spine: findBone('spine_02'),
      chest: findBone('chest_03'),
      fingersL: fingerChains('L'),
      fingersR: fingerChains('R'),
      shL: findBone('shoulderL_08', 'shoulder.L_08'),
      shR: findBone('shoulderR_024', 'shoulder.R_024'),
      uaL: findBone('upper_armL_09', 'upper_arm.L_09'),
      uaR: findBone('upper_armR_025', 'upper_arm.R_025'),
      laL: findBone('lower_armL_010', 'lower_arm.L_010'),
      laR: findBone('lower_armR_026', 'lower_arm.R_026'),
      hL: findBone('handL_011', 'hand.L_011'),
      hR: findBone('handR_027', 'hand.R_027'),
      quijada: findBone('quijada'),
      comisuraL: findBone('comisura_L'),
      comisuraR: findBone('comisura_R'),
      labioSup: findBone('labio_sup'),
      esfera: findBone('esfera'),
      cara: {},
      todos: [],
    }
    cloned.traverse((o) => {
      if (!o.isBone) return
      o.userData.__mixQ = o.quaternion.clone()
      o.userData.__mixP = o.position.clone()
      b.todos.push(o)
    })
    for (const lado of ['L', 'R']) {
      b.cara[lado] = {
        ojo: findBone(`ojo_${lado}`),
        sup: [0, 1, 2].map((k) => findBone(`parpado_sup_${lado}_${k}`)),
        inf: [0, 1, 2].map((k) => findBone(`parpado_inf_${lado}_${k}`)),
        cejaInt: findBone(`ceja_int_${lado}`),
        cejaExt: findBone(`ceja_ext_${lado}`),
        antena: [1, 2, 3].map((k) => findBone(`antena_${lado}_${k}`)),
      }
    }
    return b
  }, [cloned])

  // ── La carita de la mochila: centro, ejes y normal de la pantalla en el espacio
  // del hueso del pecho (la pantalla va entera con él), para medir cada cuadro
  // hacia dónde queda Skulley sin leer la malla deformada.
  const mochila = useMemo(() => {
    const m = cloned.userData.__mochila
    const pecho = bones.chest
    if (!m || !pecho || !m.skeleton) return null
    const i = m.skeleton.bones.indexOf(pecho)
    if (i < 0) return null
    const bb = m.geometry.boundingBox
    const c = new THREE.Vector3(); bb.getCenter(c)
    const rx = (bb.max.x - bb.min.x) / 2
    const ry = (bb.max.y - bb.min.y) / 2
    const aHueso = new THREE.Matrix4().multiplyMatrices(m.skeleton.boneInverses[i], m.bindMatrix)
    const pt = (x, y, z) => new THREE.Vector3(c.x + x, c.y + y, c.z + z).applyMatrix4(aHueso)
    // la pantalla ve hacia atrás de Argus (-Z del GLB)
    return { pecho, c: pt(0, 0, 0), x: pt(rx, 0, 0), y: pt(0, ry, 0), n: pt(0, 0, -0.1), cara: crearCaraMochila(m.material.userData.pantalla) }
  }, [cloned, bones])

  // ── El holograma de la hora sobre la muñeca (idle impaciente) ──
  const puntosMano = useRef([])
  const reloj = useMemo(() => {
    const r = crearRelojHolograma()
    cloned.add(r.grupo)
    return r
  }, [cloned])
  useEffect(() => () => { reloj.grupo.removeFromParent(); reloj.dispose() }, [reloj])

  // ── Clips ──
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned])
  const clips = useMemo(() => {
    const m = {}
    for (const a of animations || []) {
      const act = mixer.clipAction(a)
      if (UNA_VEZ.has(a.name)) { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true } else act.setLoop(THREE.LoopRepeat, Infinity)
      m[a.name] = act
    }
    return m
  }, [mixer, animations])
  const est = useRef(null)
  if (!est.current) {
    est.current = {
      actual: null, uno: null, base: 'Idle', proximaVariedad: 6 + Math.random() * 6, ultimaVariedad: null, reloj: 0,
      expr: Object.fromEntries(CLAVES_EXPR.map((k) => [k, 0])),
      parpadeo: { t: -1, prox: 1.5 + Math.random() * 3, doble: false },
      mirada: { yaw: 0, pitch: 0, metaYaw: 0, metaPitch: 0, prox: 0.5 },
      ojos: { yaw: 0, pitch: 0 },
      habla: 0, boca: crearBoca(),
      track: { yaw: 0, pitch: 0, w: 0 },
      antenas: null,
    }
  }
  const cambiar = useRef(null)
  cambiar.current = (nombre) => {
    const e = est.current
    const nueva = clips[nombre]
    if (!nueva) return
    const vieja = e.actual ? clips[e.actual] : null
    if (vieja === nueva && !UNA_VEZ.has(nombre)) return
    nueva.reset().setEffectiveWeight(1).play()
    if (vieja && vieja !== nueva) nueva.crossFadeFrom(vieja, TRANSICION, false)
    e.actual = nombre
    e.uno = UNA_VEZ.has(nombre) ? nombre : null
    if (nombre === 'IdleComer') {
      // la esfera sale de un color de portal cada vez
      const cols = ['section1', 'section2', 'section3', 'section4', 'section5'].map((k) => sectionColors[k]).filter(Boolean)
      try { cloned.userData.__esfera?.material.emissive.set(cols[Math.floor(Math.random() * cols.length)]) } catch { }
    }
  }
  useEffect(() => {
    cambiar.current('Idle')
    const alTerminar = (ev) => {
      const e = est.current
      if (e.uno && ev.action === clips[e.uno]) {
        e.uno = null
        cambiar.current(e.base)
        e.proximaVariedad = e.reloj + 8 + Math.random() * 8
      }
    }
    mixer.addEventListener('finished', alTerminar)
    return () => { mixer.removeEventListener('finished', alTerminar); mixer.stopAllAction() }
  }, [mixer, clips])

  // Lo que el NPC le pide (reacciones)
  useEffect(() => {
    if (!ctrlRef) return undefined
    ctrlRef.current = {
      reaccionar: (nombre) => {
        const e = est.current
        const actualPeso = PESO_REACCION[e.uno] || 0
        if ((PESO_REACCION[nombre] || 0) < actualPeso) return
        cambiar.current(nombre)
      },
      ocupado: () => Boolean(est.current.uno && PESO_REACCION[est.current.uno]),
      // la escena del trato manda la acción de cada renglón: va aunque haya otra
      // reacción encima
      forzar: (nombre) => { if (clips[nombre]) cambiar.current(nombre) },
    }
    return () => { if (ctrlRef) ctrlRef.current = null }
  }, [ctrlRef])


  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return
    const dt = Math.min(Math.max(delta, 0), 1 / 20)
    const e = est.current
    // desarrollo: con el HMR el estado sobrevive al cambio de código y le faltaban canales
    if (!e.boca?.miraY) e.boca = crearBoca()
    e.reloj += dt
    const ahora = performance.now()
    const dlg = dialogoRef?.current
    const ultimaLetra = Math.max(hablaRef?.current?.ultimo || 0, dlg ? argus.hablaUltimo || 0 : 0)
    const hablando = ahora - ultimaLetra < 260

    // ── qué clip toca ──
    const base = hablando ? 'Hablar' : 'Idle'
    if (base !== e.base) {
      e.base = base
      if (!e.uno) cambiar.current(base)
    }
    if (variedad && !dlg?.on && !e.uno && !hablando && e.reloj > e.proximaVariedad && !(pushRef?.current?.t >= 0)) {
      let total = 0
      const opciones = VARIEDAD.filter(([n]) => n !== e.ultimaVariedad && clips[n])
      for (const [, w] of opciones) total += w
      let r = Math.random() * total
      let elegido = opciones[0]?.[0]
      for (const [n, w] of opciones) { r -= w; if (r <= 0) { elegido = n; break } }
      if (elegido) { e.ultimaVariedad = elegido; cambiar.current(elegido) }
      e.proximaVariedad = e.reloj + 30
    }
    // three solo reescribe un hueso cuando el valor de su pista cambia: lo que las
    // capas de abajo le suman (head tracking, quijada, empujón) se quedaba pegado en
    // los tramos quietos del clip y se acumulaba cuadro tras cuadro (la cabeza
    // acababa girando). Antes del mixer se repone la pose que dejó el cuadro
    // anterior, y después se guarda la nueva antes de sumarle nada.
    const huesos = bones.todos
    for (let i = 0; i < huesos.length; i += 1) {
      const b = huesos[i]
      b.quaternion.copy(b.userData.__mixQ)
      b.position.copy(b.userData.__mixP)
    }
    // Desarrollo: window.__argusCongela = { clip, t } deja un clip quieto en un segundo
    const congela = import.meta.env.DEV && typeof window !== 'undefined' ? window.__argusCongela : null
    if (congela && clips[congela.clip]) {
      const act = clips[congela.clip]
      if (e.congelado !== congela.clip) {
        mixer.stopAllAction()
        act.reset().setEffectiveWeight(1).play()
        e.congelado = congela.clip
      }
      act.paused = true
      act.time = congela.t
      e.actual = congela.clip
      e.uno = UNA_VEZ.has(congela.clip) ? congela.clip : null
      mixer.update(0)
    } else {
      if (e.congelado) { e.congelado = null; mixer.stopAllAction(); e.actual = null; e.uno = null; cambiar.current('Idle') }
      mixer.update(dt)
    }
    for (let i = 0; i < huesos.length; i += 1) {
      const b = huesos[i]
      b.userData.__mixQ.copy(b.quaternion)
      b.userData.__mixP.copy(b.position)
    }
    const tClip = e.uno && clips[e.uno] ? clips[e.uno].time : 0
    g.updateMatrixWorld(true)

    // ── EMPUJÓN: el clip Empujon (brazos rectos al frente, palmas al frente) y un
    // pasito con rebote del cuerpo entero. La línea de tiempo la lleva pushRef (el
    // golpe que despieza a Skulley cae a los 0.13 s, ver ZoidianNPC).
    const push = pushRef?.current
    const enEmpujon = Boolean(push && push.t >= 0)
    if (enEmpujon) {
      const cfg = (typeof window !== 'undefined' && window.__argusPushCfg) || null
      if (!e.empujando) { e.empujando = true; cambiar.current('Empujon') }
      if (!cfg?.hold) push.t += Math.min(delta, 0.05)
      const DUR = 0.86
      if (!cfg?.hold && push.t >= DUR) push.t = -1
      // se echa atrás (0.1 s), da el paso en el golpe y rebota hacia atrás
      const tt = Math.max(0, push.t)
      let z = tt < 0.1 ? -0.05 * Math.sin((tt / 0.1) * Math.PI / 2) : 0.16 * Math.min(1, (tt - 0.1) / 0.1) * Math.max(0, 1 - (tt - 0.3) / 0.56)
      if (tt > 0.2) z -= 0.075 * Math.exp(-(tt - 0.2) * 6.5) * Math.sin((tt - 0.2) * 19)
      g.position.z = z
      g.position.y = -Math.max(0, z) * 0.2
    } else {
      e.empujando = false
      if (g.position.z !== 0 || g.position.y !== 0) g.position.set(0, 0, 0)
    }

    // ── head tracking hacia lookAtRef (giro en ejes del mundo, encima del clip) ──
    const target = lookAtRef?.current
    const tr = e.track
    let wantYaw = 0
    let wantPitch = 0
    let wantW = 0
    let tieneTarget = false
    const headBone = bones.head || bones.neck
    g.getWorldQuaternion(_q1)
    // a quién ve: Skulley (a su cara, no a los pies), o lo que pida la escena del trato
    let hayMira = false
    if (dlg?.mirar === 'camara') { _mir.copy(state.camera.position); hayMira = true }
    else if (Array.isArray(dlg?.mirar)) { _mir.set(dlg.mirar[0], dlg.mirar[1], dlg.mirar[2]); hayMira = true }
    else if (target) { target.getWorldPosition(_mir); _mir.y += 1.4; hayMira = true }
    if (hayMira && headBone) {
      headBone.getWorldPosition(_v1)
      _v2.copy(_mir)
      _v3.copy(_v2).sub(_v1)
      const dist = _v3.length()
      if (dist > 0.6 && dist < 14) {
        _v3.normalize().applyQuaternion(_q2.copy(_q1).invert())
        // El GLB mira hacia +Z en su propio espacio.
        const yaw = Math.atan2(_v3.x, _v3.z)
        const pitch = Math.asin(THREE.MathUtils.clamp(_v3.y, -1, 1))
        if (Math.abs(yaw) < 1.25) {
          wantYaw = THREE.MathUtils.clamp(yaw, -0.8, 0.8)
          wantPitch = THREE.MathUtils.clamp(pitch, -0.4, pitchMax)
          wantW = SEGUIR_EN[e.actual] ?? 1
          tieneTarget = true
        }
      }
    }
    const k = 1 - Math.exp(-6 * Math.max(dt, 0.001))
    tr.yaw += (wantYaw - tr.yaw) * k
    tr.pitch += (wantPitch - tr.pitch) * k
    tr.w += (wantW - tr.w) * k
    if (tr.w > 0.01) {
      const lateral = _v1.set(1, 0, 0).applyQuaternion(_q1)
      const arriba = _v2.copy(ARRIBA)
      const aplicar = (bone, f) => {
        if (!bone) return
        _q3.setFromAxisAngle(lateral, -tr.pitch * tr.w * f)
        _q4.setFromAxisAngle(arriba, tr.yaw * tr.w * f).multiply(_q3)
        girarEnMundo(bone, _q4)
        bone.updateMatrixWorld(true)
      }
      aplicar(bones.neck, 0.35)
      aplicar(bones.head, 0.65)
    }

    // ── cara ──
    // expresión: la del clip, o furia en el empujón
    let exprNombre = 'neutral'
    const tl = e.uno ? CARA_CLIP[e.uno] : null
    if (tl) for (const [t0, n] of tl) if (tClip >= t0) exprNombre = n
    if (dlg?.cara && EXPR[dlg.cara]) exprNombre = dlg.cara
    if (enEmpujon) exprNombre = 'furia'
    const ex = e.expr
    const kx = 1 - Math.exp(-dt * (exprNombre === 'apretados' ? 30 : 9))
    for (const key of CLAVES_EXPR) {
      ex[key] += (valorExpr(exprNombre, key) - ex[key]) * kx
    }
    // hablando: las cejas acompañan los acentos
    const habla = e.habla
    e.habla += ((hablando ? 1 : 0) - habla) * (1 - Math.exp(-dt * 10))
    // parpadeo
    const pb = e.parpadeo
    let blink = 0
    if (pb.t < 0) {
      pb.prox -= dt
      if (pb.prox <= 0) { pb.t = 0; pb.doble = Math.random() < 0.2 }
    } else {
      pb.t += dt
      const D = 0.17
      const fase = pb.t / D
      blink = fase < 0.35 ? fase / 0.35 : fase < 0.5 ? 1 : Math.max(0, 1 - (fase - 0.5) / 0.5)
      if (pb.t >= D) {
        if (pb.doble) { pb.t = 0; pb.doble = false } else { pb.t = -1; pb.prox = 2.2 + Math.random() * 4 }
      }
    }
    // mirando arriba (pitch negativo) el párpado de arriba sube con el ojo
    const subeMirada = Math.max(0, -e.ojos.pitch) * SUBE_CON_MIRADA
    for (const lado of ['L', 'R']) {
      const cb = bones.cara[lado]
      for (let k = 0; k < 3; k += 1) {
        const bs = cb.sup[k]
        const bi = cb.inf[k]
        if (!bs || !bi) continue
        const wIn = k === ADENTRO[lado] ? 1 : k === 1 ? 0.5 : 0
        const sup = Math.max(THREE.MathUtils.clamp(ex.sup + ex.supInt * wIn + ex.supExt * (1 - wIn) - subeMirada - e.boca.ojos.x, 0, 1), blink)
        const inf = Math.max(ex.inf, blink)
        _q1.setFromAxisAngle(EJE_X, THREE.MathUtils.degToRad(-ABIERTO_EXTRA + (CIERRE[lado].sup[k] + ABIERTO_EXTRA) * sup))
        bs.quaternion.copy(bs.userData.__restQ).multiply(_q1)
        _q1.setFromAxisAngle(EJE_X, THREE.MathUtils.degToRad(-ABIERTO_EXTRA + (CIERRE[lado].inf[k] + ABIERTO_EXTRA) * inf))
        bi.quaternion.copy(bi.userData.__restQ).multiply(_q1)
      }
      const bo = e.boca
      const acento = bo.ceja.x * (lado === 'L' ? 1 : 0.85) + bo.cejaPal.x * (1 + (lado === 'L' ? bo.asim : -bo.asim))
      const ce = ex.ceja + (lado === 'L' ? ex.cejaL : ex.cejaR) + acento
      for (const [b, extra] of [[cb.cejaInt, ex.cejaInt], [cb.cejaExt, 0]]) {
        if (!b) continue
        _v1.set(0, ce + extra, 0).applyQuaternion(b.userData.__restQ)
        b.position.copy(b.userData.__restP).add(_v1)
      }
    }
    // mirada: lo que pide el clip, o Skulley, o pasea
    const mi = e.mirada
    let objetivo = null
    let metaYaw = null
    let metaPitch = null
    const mc = e.uno ? MIRADA_CLIP[e.uno] : null
    if (mc) {
      for (const [t0, t1, que] of mc) {
        if (tClip >= t0 && tClip <= t1) {
          if (que === 'esfera') objetivo = 'esfera'
          else { metaYaw = que[0]; metaPitch = que[1] }
        }
      }
    }
    if (!objetivo && metaYaw === null) {
      if (tieneTarget && (SEGUIR_EN[e.actual] ?? 1) > 0.3) objetivo = 'target'
      else {
        mi.prox -= dt
        if (mi.prox <= 0) {
          mi.metaYaw = (Math.random() - 0.5) * 0.7
          mi.metaPitch = (Math.random() - 0.5) * 0.3
          mi.prox = 0.6 + Math.random() * 2.2
        }
        metaYaw = mi.metaYaw
        metaPitch = mi.metaPitch
      }
    }
    // Los ojos saltan (sacádicos): muy rápido hacia la meta. En el espacio del ojo
    // en reposo la pupila es +Y, X es su izquierda y Z abajo: girar +Z voltea a su
    // derecha y girar +X baja la mirada.
    const ko = 1 - Math.exp(-dt * 22)
    const ojoL = bones.cara.L.ojo
    if (ojoL) {
      g.getWorldQuaternion(_q1)
      ojoL.parent.getWorldQuaternion(_q2)
      _q2.multiply(ojoL.userData.__restQ)
      ojoL.getWorldPosition(_v1)
      if (objetivo === 'esfera' && bones.esfera) {
        bones.esfera.getWorldPosition(_v2)
      } else if (objetivo === 'target') {
        _v2.copy(_mir)
      } else {
        _e.set(-(metaPitch || 0), metaYaw || 0, 0, 'YXZ')
        _v2.set(0, 0, 1).applyEuler(_e).applyQuaternion(_q1).multiplyScalar(6).add(_v1)
      }
      _v3.copy(_v2).sub(_v1).normalize().applyQuaternion(_q3.copy(_q2).invert())
      const yaw = THREE.MathUtils.clamp(Math.atan2(-_v3.x, _v3.y), -0.45, 0.45)
      const pitch = THREE.MathUtils.clamp(Math.atan2(_v3.z, Math.hypot(_v3.x, _v3.y)), -0.35, 0.35)
      const o = e.ojos
      o.yaw += (yaw + e.boca.miraX.x - o.yaw) * ko
      o.pitch += (pitch + e.boca.miraY.x - o.pitch) * ko
      _q3.setFromAxisAngle(EJE_Z, o.yaw)
      _q1.setFromAxisAngle(EJE_X, o.pitch)
      for (const lado of ['L', 'R']) {
        const ojo = bones.cara[lado].ojo
        if (ojo) ojo.quaternion.copy(ojo.userData.__restQ).multiply(_q3).multiply(_q1)
      }
    }
    // ── boca al hablar (Oscar: se veía tiesa, muy rápida, solo arriba y abajo y
    // siempre abierta): formas de boca en palabras de 1 a 4 sílabas, cada una
    // sostenida un rato, con la boca cerrada entre palabras y en las M; cada canal
    // llega con su resorte, así se encadenan en vez de abrir y cerrar a cada
    // sílaba. La sílaba fuerte de cada palabra dura más, abre más, alza las cejas y
    // cabecea. Sin hablar regresa a su boca de siempre (la del modelo, entreabierta).
    const bo = e.boca
    if (hablando) {
      bo.t += dt
      if (bo.t >= bo.dur) siguienteSilaba(bo)
    } else if (bo.vis !== 'reposo') {
      bo.vis = 'reposo'
      bo.fuerte = false
      bo.restan = 0
      bo.t = 0
      bo.dur = 0
    }
    const vis = VISEMAS[bo.vis]
    const fz = hablando ? bo.fuerza : 1
    // resortes lentos y casi sin rebote: la boca se desliza de una forma a otra y en
    // las sílabas cortas no alcanza a llegar del todo, como al hablar de verdad
    resorte(bo.q, vis.q > 0 ? vis.q * fz : vis.q, dt, 3, 0.9)
    resorte(bo.ancho, vis.ancho * fz, dt, 2.8, 0.95)
    resorte(bo.junta, vis.junta * fz, dt, 2.8, 0.95)
    resorte(bo.labio, vis.labio * fz, dt, 3.2, 0.85)
    resorte(bo.frente, vis.frente, dt, 2.8, 0.95)
    resorte(bo.lado, hablando ? bo.ladoMeta : 0, dt, 4, 0.8)
    resorte(bo.ceja, bo.fuerte && hablando ? 0.012 : 0, dt, 3.5, 0.75)
    resorte(bo.cejaPal, hablando ? bo.cejaMeta : 0, dt, 3.5, 0.7)
    resorte(bo.cabeza, bo.fuerte && hablando ? 1 : 0, dt, 2.6, 0.7)
    resorte(bo.jl, hablando && vis.q > 0 ? bo.qLado : 0, dt, 2.4, 0.95)
    resorte(bo.jr, hablando && vis.q > 0 ? bo.qRoll : 0, dt, 2.4, 0.95)
    resorte(bo.ojos, bo.fuerte && hablando ? 0.12 : 0, dt, 3.5, 0.85)
    resorte(bo.miraX, hablando ? bo.miraMeta[0] : 0, dt, 5, 0.75)
    resorte(bo.miraY, hablando ? bo.miraMeta[1] : 0, dt, 5, 0.75)
    if (hablando && bo.pausaLarga && bo.t < dt * 1.5 && e.parpadeo.t < 0 && Math.random() < 0.6) e.parpadeo.t = 0
    const q = bo.q.x
    const abre = Math.max(0, q) / 22
    if (bones.quijada && (Math.abs(q) > 0.05 || Math.abs(bo.jl.x) > 0.05)) {
      // abre (X), se corre de lado (Z) y se ladea (Y): medido en Blender
      _q1.setFromAxisAngle(EJE_X, THREE.MathUtils.degToRad(q))
      _q2.setFromAxisAngle(EJE_Z, THREE.MathUtils.degToRad(bo.jl.x))
      _q3.setFromAxisAngle(ARRIBA, THREE.MathUtils.degToRad(bo.jr.x))
      bones.quijada.quaternion.multiply(_q1).multiply(_q2).multiply(_q3)
    }
    // las comisuras: X local = izquierda de Argus (afuera en la izquierda, adentro en
    // la derecha), Y arriba, Z al frente; con `lado` una comisura sube más que la otra
    const junta = ex.junta + bo.junta.x
    for (const [b, s] of [[bones.comisuraL, 1], [bones.comisuraR, -1]]) {
      if (!b) continue
      const fuera = 0.016 * ex.son - 0.02 * junta + 0.012 * bo.ancho.x
      _v1.set(s * fuera, 0.022 * ex.son + 0.004 * abre + 0.005 * bo.lado.x * s, 0.004 * junta).applyQuaternion(b.userData.__restQ)
      b.position.copy(b.userData.__restP).add(_v1)
    }
    if (bones.labioSup) {
      // en el espacio de la cabeza: X izquierda, Y arriba, Z al frente
      _v1.set(0.006 * bo.lado.x, 0.022 * ex.grune + bo.labio.x, 0.004 * ex.grune + bo.frente.x).applyQuaternion(bones.labioSup.userData.__restQ)
      bones.labioSup.position.copy(bones.labioSup.userData.__restP).add(_v1)
    }
    // la cabeza: cabecea en la sílaba fuerte, se ladea hacia el lado de la palabra y,
    // mientras habla, no se queda quieta (un vaivén lento que nunca se repite igual)
    if (bones.head && (e.habla > 0.01 || Math.abs(bo.cabeza.x) > 0.002)) {
      const tf = e.reloj + bo.fase
      const h = e.habla
      const yaw = h * (1.8 * Math.sin(tf * 0.9) + 1.1 * Math.sin(tf * 2.3 + 1.3))
      const pitch = 3.2 * bo.cabeza.x + h * (1.2 * Math.sin(tf * 1.4 + 0.5) + 0.7 * Math.sin(tf * 3.1))
      const roll = -1.6 * bo.lado.x + h * (1.4 * Math.sin(tf * 1.1 + 2.1) + 0.6 * Math.sin(tf * 2.7 + 0.4))
      g.getWorldQuaternion(_q1)
      _v1.set(1, 0, 0).applyQuaternion(_q1)
      _q4.setFromAxisAngle(_v1, THREE.MathUtils.degToRad(pitch))
      _v2.set(0, 0, 1).applyQuaternion(_q1)
      _q3.setFromAxisAngle(_v2, THREE.MathUtils.degToRad(roll))
      _q4.multiply(_q3)
      _q3.setFromAxisAngle(ARRIBA, THREE.MathUtils.degToRad(yaw))
      girarEnMundo(bones.head, _q4.multiply(_q3))
    }

    // ── antenas: resorte que se queda atrás de la cabeza y latiguea ──
    g.updateMatrixWorld(true)
    if (!e.antenas) {
      e.antenas = {}
      for (const lado of ['L', 'R']) {
        e.antenas[lado] = bones.cara[lado].antena.map(() => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), listo: false }))
      }
    }
    const HZ = [5.2, 4.4, 3.8]
    const ZETA = 0.3
    for (const lado of ['L', 'R']) {
      const cadena = bones.cara[lado].antena
      const sim = e.antenas[lado]
      for (let i = 0; i < cadena.length; i += 1) {
        const b = cadena[i]
        if (!b) break
        const s = sim[i]
        b.quaternion.copy(b.userData.__restQ)
        b.updateMatrixWorld(true)
        b.getWorldPosition(_v1) // base del tramo
        const hijo = cadena[i + 1]
        if (hijo) hijo.getWorldPosition(_v2)
        else _v2.set(0, hijo ? 0 : (cadena[i - 1] ? cadena[i].position.length() : 0.1), 0).applyMatrix4(b.matrixWorld)
        const largo = _v2.distanceTo(_v1)
        if (!s.listo || largo < 1e-5) { s.p.copy(_v2); s.v.set(0, 0, 0); s.listo = true; continue }
        const w = 2 * Math.PI * HZ[i]
        const pasos = 3
        const h = dt / pasos
        for (let n = 0; n < pasos; n += 1) {
          _v3.copy(_v2).sub(s.p).multiplyScalar(w * w).addScaledVector(s.v, -2 * ZETA * w)
          s.v.addScaledVector(_v3, h)
          s.p.addScaledVector(s.v, h)
        }
        _v3.copy(s.p).sub(_v1)
        if (_v3.lengthSq() < 1e-10) continue
        _v3.setLength(largo)
        s.p.copy(_v1).add(_v3)
        // girar el tramo de donde lo dejó el clip hacia donde quedó el resorte
        const de = _v2.sub(_v1).normalize()
        const a = _v3.normalize()
        const ang = Math.acos(THREE.MathUtils.clamp(de.dot(a), -1, 1))
        if (ang > 1e-4) {
          _q1.setFromUnitVectors(de, a)
          if (ang > 0.6) _q1.slerp(_q3.identity(), 1 - 0.6 / ang)
          girarEnMundo(b, _q1)
          b.updateMatrixWorld(true)
        }
      }
    }

    // ── la carita de la mochila: sigue a Skulley con la vista si lo tiene enfrente ──
    if (mochila) {
      const mw = mochila.pecho.matrixWorld
      const c = _v1.copy(mochila.c).applyMatrix4(mw)
      if (target) {
        target.getWorldPosition(_v2)
        _v2.y += 1.1 * (fit.height / 1.7)
        _v2.sub(c)
        const dist = _v2.length()
        _v2.divideScalar(Math.max(dist, 1e-5))
        const n = _v3.copy(mochila.n).applyMatrix4(mw).sub(c).normalize()
        if (dist < MOCHILA_VE.lejos && _v2.dot(n) > MOCHILA_VE.cono) {
          const ex = _v4.copy(mochila.x).applyMatrix4(mw).sub(c).normalize()
          const mx = THREE.MathUtils.clamp(_v2.dot(ex) / 0.75, -1, 1)
          const ey = ex.copy(mochila.y).applyMatrix4(mw).sub(c).normalize()
          const my = THREE.MathUtils.clamp(_v2.dot(ey) / 0.6, -1, 1)
          mochila.cara.mirar(mx, my)
        }
      }
      mochila.cara.actualizar(dt)
    }

    // ── el holograma de la hora: prende cuando alza la muñeca, falla mientras la
    // sacude y se apaga en una raya al bajarla (tiempos del clip, a 30 cuadros) ──
    let enc = 0
    let falla = 0
    if (e.uno === 'IdleImpaciente') {
      const t = tClip
      enc = THREE.MathUtils.smoothstep(t, 0.55, 0.85) * (1 - THREE.MathUtils.smoothstep(t, 1.97, 2.17))
      if (t > 1.13 && t < 1.6) falla = 0.55 + 0.45 * Math.abs(Math.sin(t * 23))
      else if (t < 0.95) falla = THREE.MathUtils.clamp((0.95 - t) * 3, 0, 1)
    }
    if (enc > 0.001 && bones.hL) {
      bones.hL.getWorldPosition(_v1)
      g.getWorldQuaternion(_q1)
      _v2.set(0, 0, 1).applyQuaternion(_q1)
      // la mano: la muñeca y cada coyuntura de los dedos (las puntas van con margen)
      const mano = puntosMano.current
      let n = 0
      const poner = (b) => { if (!mano[n]) mano[n] = new THREE.Vector3(); b.getWorldPosition(mano[n]); n += 1 }
      poner(bones.hL)
      for (const cadena of bones.fingersL || []) {
        for (const b of cadena) poner(b)
        // la punta: la última falange otra vez más allá de su coyuntura
        if (cadena.length >= 2) {
          if (!mano[n]) mano[n] = new THREE.Vector3()
          mano[n].copy(mano[n - 1]).sub(mano[n - 2]).multiplyScalar(0.9).add(mano[n - 1])
          n += 1
        }
      }
      mano.length = n
      reloj.actualizar(dt, { muneca: _v1, frente: _v2, mano, margen: 0.08 * fit.height, ancho: 0.24 * fit.height, brillo: 1, encendido: enc, falla })
    } else {
      reloj.actualizar(dt, { brillo: 0, encendido: 0, falla: 0 })
    }
  })

  return (
    <group ref={groupRef}>
      <group position={fit.offset} scale={fit.scale}>
        <primitive object={cloned} />
      </group>
    </group>
  )
}

export default function ZoidianNPC({
  position = [0, 0, 12.9],
  rotationY = Math.PI,
  targetHeight = 1.7,
  onClick,
  visible = true,
  // Object3D a seguir con la cabeza (Skulley) — ver ZoidianModel.
  lookAtRef = null,
  // Ref externo al group raíz — lo usa SilhouetteShadow (HomeScene).
  groupRef = null,
}) {
  const wrapRef = useRef()
  const [hovered, setHovered] = useState(false)
  const hoveredRef = useRef(false)
  const { gl } = useThree()
  const ctrlRef = useRef(null)
  const hablaRef = useRef({ ultimo: 0 })
  // La escena del trato (ZoidianDialog, lib/argusNpc.js): con `dialogo` no hay
  // idles de variedad, empujón ni saludo automático; cara y mirada pedidas mandan
  // hasta el siguiente renglón y la acción de cada renglón se fuerza.
  const dialogoRef = useRef({ on: false, cara: null, mirar: null })
  useEffect(() => escucharArgus((msg) => {
    if (!msg) return
    const d = dialogoRef.current
    if (msg.dialogo !== undefined) {
      d.on = Boolean(msg.dialogo)
      if (!d.on) { d.cara = null; d.mirar = null }
    }
    if (msg.cara !== undefined) d.cara = msg.cara
    if (msg.mirar !== undefined) d.mirar = msg.mirar
    // Ya saludó al entrar Skulley a su radio (y sigue adentro: la escena solo abre
    // ahí), así que el saludo del primer renglón no se repite (Oscar: "se ve raro");
    // ese renglón lo dice hablando.
    const yaSaludo = msg.accion === 'Saludo' && !saludoRef.current.lejos
    if (msg.accion && !yaSaludo) { try { ctrlRef.current?.forzar(msg.accion) } catch { } }
  }), [])
  const reaccionar = (nombre, delay = 0) => {
    const go = () => { try { ctrlRef.current?.reaccionar(nombre) } catch { } }
    if (delay > 0) mockTimersRef.current.push(setTimeout(go, delay))
    else go()
  }

  // ── Burlas cuando algo despieza a Skulley ──
  // · Un rayo que despieza a Skulley ('character-disassembled-by-bolt' / '-by-madre'
  //   / '-by-egg') o el de la esfera del portal que quema a M.A.D.R.E. ('madre-quemada').
  // · 'character-disassembled-by-argus' — su propio empujón.
  // Argus espera un beat (que el flash y las piezas registren), se carcajea y remata.
  const { t } = useLanguage()
  const mockAnchorRef = useRef(null)
  const [mock, setMock] = useState({ on: false, typed: '', full: '' })
  const mockTimersRef = useRef([])
  useEffect(() => {
    const clearTimers = () => {
      for (const id of mockTimersRef.current) { clearTimeout(id); clearInterval(id) }
      mockTimersRef.current = []
    }
    const sayMock = (key, { delay = 700, dura = 5600, tecleo = 60 } = {}) => {
      clearTimers()
      // La key puede resolver a un string o a un POOL de frases (rayo.skulley).
      const resolved = t(key)
      const full = Array.isArray(resolved) ? resolved[Math.floor(Math.random() * resolved.length)] : resolved
      if (!full) return
      mockTimersRef.current.push(setTimeout(() => {
        let i = 0
        setMock({ on: true, typed: '', full })
        const typeId = setInterval(() => {
          i += 1
          setMock({ on: true, typed: full.slice(0, i), full })
          // la quijada se mueve mientras escribe (no en espacios ni puntuación)
          if (/[\p{L}\p{N}]/u.test(full[i - 1] || '')) hablaRef.current.ultimo = performance.now()
          if (i >= full.length) clearInterval(typeId)
        }, tecleo)
        mockTimersRef.current.push(typeId)
        mockTimersRef.current.push(setTimeout(() => {
          setMock({ on: false, typed: '', full: '' })
        }, dura))
      }, delay))
    }
    const burla = (key) => { sayMock(key); reaccionar('Risa', 450) }
    // Los rayos (Oscar, 2026-11-19): solo comenta si le pegan a alguien. A
    // Skulley, cualquiera que lo despiece (la esfera que cae en un portal, el
    // castigo de M.A.D.R.E., el easter egg); a M.A.D.R.E., solo el de la esfera
    // del portal; si ese pega a los dos, una para ambos. Antes se burlaba con el
    // 'bolt-strike', el destello de cualquier rayo, aunque no le pegara a nadie.
    const RAYO_AMBOS_MS = 1500
    let skulleyEn = -Infinity, madreEn = -Infinity, madreTimer = 0
    const onRayoSkulley = () => {
      const ahora = performance.now()
      skulleyEn = ahora
      burla(ahora - madreEn < RAYO_AMBOS_MS ? 'zoidian.rayo.ambos' : 'zoidian.rayo.skulley')
    }
    const onMadreQuemada = (e) => {
      if (e?.detail?.fuente !== 'portal') return
      madreEn = performance.now()
      clearTimeout(madreTimer)
      // A Skulley el mismo rayo lo despieza 230 ms después: se espera a ver si
      // también le tocó, para no cambiar la frase a media escritura.
      madreTimer = setTimeout(() => { if (skulleyEn < madreEn) burla('zoidian.rayo.madre') }, 400)
    }
    const onPushShatter = () => burla('zoidian.mockPush')
    window.addEventListener('character-disassembled-by-bolt', onRayoSkulley)
    window.addEventListener('character-disassembled-by-madre', onRayoSkulley)
    window.addEventListener('character-disassembled-by-egg', onRayoSkulley)
    window.addEventListener('madre-quemada', onMadreQuemada)
    window.addEventListener('character-disassembled-by-argus', onPushShatter)

    // El juego de esferas: Argus comenta la partida. Las grandes interrumpen; las
    // chicas esperan a que termine la anterior. Lo que impresiona, lo celebra.
    let ocupadoHasta = 0
    const comenta = (key, grande = false, celebra = false) => {
      const ahora = performance.now()
      if (celebra) reaccionar('Impresionado')
      if (!grande && ahora < ocupadoHasta) return
      ocupadoHasta = ahora + 2400
      sayMock(`zoidian.juego.${key}`, { delay: 0, dura: 2600, tecleo: 35 })
    }
    const quitarJuego = escucharJuego((tipo, d) => {
      if (tipo === 'captura') {
        if (d.fiebre) comenta('fiebre', true, true)
        else if (d.dorada) comenta('doradaAtrapada', true, true)
        else if (d.subioMult && d.mult >= 3) comenta(`x${d.mult}`, false, true)
        else if (d.oleada) comenta('oleada')
        else if (d.carambola) comenta('carambola')
        else if (d.rompioRacha) comenta('rompe')
      } else if (tipo === 'doblete') comenta('doblete', true, true)
      else if (tipo === 'dorada') comenta('dorada', true)
      else if (tipo === 'dorada-fin') comenta('doradaFin')
      else if (tipo === 'fuego') comenta('fuego')
      else if (tipo === 'tiempo') comenta('tiempo', true)
    })
    return () => {
      window.removeEventListener('character-disassembled-by-bolt', onRayoSkulley)
      window.removeEventListener('character-disassembled-by-madre', onRayoSkulley)
      window.removeEventListener('character-disassembled-by-egg', onRayoSkulley)
      window.removeEventListener('madre-quemada', onMadreQuemada)
      window.removeEventListener('character-disassembled-by-argus', onPushShatter)
      clearTimeout(madreTimer)
      quitarJuego()
      clearTimers()
    }
  }, [t])

  // ── Collider sólido + empujón por contacto ──
  // El collider lo consume Player (clamp del movimiento). El trigger de contacto
  // queda apenas AFUERA del radio sólido: solo dispara cuando Skulley está
  // empujando contra Argus, no al pasar cerca.
  const COLLIDER_R = 1.2
  const PUSH_TRIGGER_R = 1.26
  const REARM_R = 2.3
  // Saludo: cada vez que Skulley entra a su radio (Oscar, 2026-11-19); para el
  // siguiente tiene que salir más allá de SALUDO_SALE. Ese mismo radio es el de
  // poder platicar con él: fuera de él no se le puede picar (la cámara del trato
  // se arma con Skulley ahí). `argus.cerca` lo avisa a la escena del trato.
  const SALUDO_R = 6
  const SALUDO_SALE = 7.5
  const SALUDO_PAUSA_S = 3
  useEffect(() => {
    try { window.__argusCollider = { x: position[0], z: position[2], r: COLLIDER_R } } catch { }
    return () => { try { delete window.__argusCollider } catch { } }
  }, [position[0], position[2]])
  const pushTimelineRef = useRef({ t: -1, hit: false, armed: true, lastAt: -Infinity })
  const saludoRef = useRef({ lejos: true, ultimo: -Infinity })
  // Helpers de desarrollo: `__argusPush()` dispara el empujón; `__argusPush(true)`
  // solo la animación. `__argus('Risa')` (o IdleComer, Saludo…) pone un clip.
  useEffect(() => {
    try {
      window.__argusPush = (animOnly = false) => {
        const p = pushTimelineRef.current
        p.t = 0
        p.hit = !!animOnly
        p.armed = false
        p.lastAt = -Infinity
      }
      window.__argusPushState = () => ({ ...pushTimelineRef.current })
      if (import.meta.env.DEV) window.__argus = (n) => ctrlRef.current?.reaccionar(n)
    } catch { }
    return () => {
      try { delete window.__argusPush; delete window.__argusPushState; delete window.__argus } catch { }
    }
  }, [])
  const _playerPos = useRef(new THREE.Vector3())

  useFrame((state) => {
    const g = wrapRef.current
    if (!g) return
    if (groupRef && groupRef.current !== g) groupRef.current = g

    const push = pushTimelineRef.current
    // Momento del impacto: el thrust del brazo conecta a t≈0.13 → recién ahí se
    // despieza a Skulley (Player escucha 'argus-push-strike').
    if (push.t >= 0 && !push.hit && push.t >= 0.13) {
      push.hit = true
      try { playSfx('sparkleBom', { volume: 0.9 }) } catch { }
      try { window.dispatchEvent(new CustomEvent('argus-push-strike', { detail: { x: position[0], z: position[2] } })) } catch { }
    }
    if (lookAtRef?.current) {
      lookAtRef.current.getWorldPosition(_playerPos.current)
      const dx = _playerPos.current.x - position[0]
      const dz = _playerPos.current.z - position[2]
      const dist = Math.hypot(dx, dz)
      const now = state.clock.elapsedTime
      // Trigger por contacto, con histéresis: tras un empujón hay que ALEJARSE
      // (REARM_R) antes de poder comerse otro.
      if (push.t < 0) {
        if (!push.armed) {
          if (dist > REARM_R) push.armed = true
        } else if (dist < PUSH_TRIGGER_R && now - push.lastAt > 3 && !dialogoRef.current.on) {
          push.t = 0
          push.hit = false
          push.armed = false
          push.lastAt = now
        }
      }
      const sal = saludoRef.current
      const cerca = dist < SALUDO_R
      if (cerca !== argus.cerca) argus.cerca = cerca
      // si se aleja con el cursor encima, se apaga el contorno blanco
      if (!cerca && hoveredRef.current) {
        hoveredRef.current = false
        setHovered(false)
        try { gl.domElement.style.cursor = '' } catch { }
      }
      if (dist > SALUDO_SALE) sal.lejos = true
      else if (sal.lejos && cerca && now - sal.ultimo > SALUDO_PAUSA_S && !dialogoRef.current.on) {
        sal.lejos = false
        sal.ultimo = now
        reaccionar('Saludo')
      }
    } else if (argus.cerca) argus.cerca = false
  })

  if (!visible) return null

  // solo se le puede picar con Skulley dentro de su radio (argus.cerca)
  const handleClick = (e) => {
    e.stopPropagation()
    if (!argus.cerca) return
    try { onClick?.() } catch { }
  }
  const handlePointerOver = (e) => {
    e.stopPropagation()
    if (!argus.cerca) return
    hoveredRef.current = true
    setHovered(true)
    try { gl.domElement.style.cursor = 'pointer' } catch { }
  }
  const handlePointerOut = () => {
    hoveredRef.current = false
    setHovered(false)
    try { gl.domElement.style.cursor = '' } catch { }
  }

  return (
    <>
      <group ref={wrapRef} position={position} rotation={[0, rotationY, 0]}>
        {/* Hitbox invisible generoso (cilindro) — raycast barato y click fácil */}
        <mesh
          position={[0, targetHeight * 0.5, 0]}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[targetHeight * 0.55, targetHeight * 0.55, targetHeight * 1.1, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Hover = outline blanco (nada de escalar al NPC, se veía raro) */}
        <ZoidianModel targetHeight={targetHeight} lookAtRef={lookAtRef} outlineColor={hovered ? '#ffffff' : '#000000'} pushRef={pushTimelineRef}
          ctrlRef={ctrlRef} hablaRef={hablaRef} dialogoRef={dialogoRef} variedad />
        {/* Ancla de la viñeta a la altura del pecho */}
        <object3D ref={mockAnchorRef} position={[0, targetHeight * 0.55, 0]} />
      </group>
      {/* La viñeta va FUERA del group rotado π: SpeechBubble3D arma su base
          mirando a cámara asumiendo padre sin rotación. */}
      <SpeechBubble3D
        anchorRef={mockAnchorRef}
        visible={mock.on}
        displayText={mock.typed}
        layoutText={mock.full}
        offset={[2.5, 0.1, 0]}
      />
    </>
  )
}

// SIN useGLTF.preload a nivel módulo: este chunk se evalúa durante el boot y
// la descarga se colaría al DefaultLoadingManager — la barra del preloader
// esperaría también este GLB antes de habilitar el ENTER. El Suspense del
// mount (post-bootAllDone, detrás del preloader) dispara la carga en el
// momento correcto.
