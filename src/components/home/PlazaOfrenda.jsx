import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { CAMPO_MAX, VERT_CAMPO, FRAG_CAMPO, VERT_CHISPA, FRAG_CHISPA } from '../../lib/fuegoToon.js'
import { ANTORCHAS, CENTRO, LUGARES, CAMA } from '../../lib/plazaOfrenda.js'
import { ofrendaPuesta, ofrendaEnMano } from '../../lib/ofrendas.js'
import { distanciaOfrenda } from '../../lib/zonaOfrenda.js'
import { wallpaperEstado } from '../../lib/wallpaperEscritorio.js'

// La plaza de la ofrenda: su oscuridad, sus rayos de luz y sus antorchas. Las
// estelas con el nombre de cada ofrenda van con el bosque (BosquePintado) y los
// pétalos con PetalosCamino.
//
// Oscura (Oscar, 2026-11-24: "quisiera que esta zona fuera más oscura"): al
// acercarse al portal del glifo bajan la luz principal, las ambientales, el
// HDRI y la niebla de toda la escena (`OSCURO`, por distancia, como el cruce de
// la música; intensidades: no compila nada). Lo que brilla solo (el código, las
// runas, el fuego, las luciérnagas, los rayos) resalta. En Customize regresa.
//
// Rayos de luz que bajan del cielo (god rays, Oscar): uno siempre sobre el
// portal y uno sobre el lugar de cada ofrenda (y de la almohada) cuando el
// jugador la pone; los objetos van en el piso, sin pedestal (se probaron
// cantera, color de la escena y tocones, y no). Es el haz del foco de "Conocer
// la historia" (SkulleyFallRig) hecho para la cámara en perspectiva del home:
// centro lleno, rayos suaves a los lados que fluyen y motas de polvo, y abajo un
// charco de luz sobre los pétalos. Todos los rayos en un solo dibujo instanciado
// (y los charcos en otro), cada uno con su brillo (`aBrillo`); fuera de cuadro
// three los descarta.
// Las antorchas (Oscar, 2026-11-24: "algunas antorchas
// clavadas en el piso, ya tenemos shader de fuego"). Dónde van lo dice
// lib/plazaOfrenda.js: dos en la entrada del camino, dos a los lados y dos junto
// a la cama. Cada una es un palo de madera clavado y un poco chueco, con amarres
// de cuerda, una copa de hierro con brasas y encima el fuego de la turbina del
// drone (lib/fuegoToon.js, el mismo programa: bocanadas que viven en el mundo
// fundidas en bandas duras sobre un cuadro de frente a la cámara), aquí subiendo
// y meciéndose con el viento, con chispas que suben y se apagan.
// En el toon de las barricadas (BordeDelMundo), fundido en un dibujo por
// material. Lejos de la plaza el fuego no se simula ni se dibuja. Montado
// siempre: se compila con la escena (y el fuego ya está compilado por el drone).

const ANTORCHA = {
  palo: 1.95,         // de alto sobre el piso hasta la copa
  enterrado: 0.15,
  grueso: [0.05, 0.07],
  copa: { alto: 0.26, arriba: 0.19, abajo: 0.1 },
}
const FUEGO = {
  max: 30,
  porSegundo: 36,
  vida: [0.42, 0.72],
  sube: [1.05, 1.65],
  abre: 0.2,          // velocidad de lado al nacer
  sale: 0.1,          // de qué tanto de la boca nacen
  tam: [0.19, 0.28],
  empuja: 1.4,        // lo que acelera hacia arriba (el aire caliente)
  viento: 0.5,
}
const CHISPAS = { max: 60, porSegundo: 2.2, vida: [0.6, 1.2], sube: [0.9, 1.9], abre: 0.45, aire: 1.2 }
const BANDAS = { orilla: 0.32, medio: 0.7, claro: 1.25, centro: 2.4 }
const PALETA = ['#8a1800', '#ff4a10', '#ff9a2a', '#ffe7a0']
// Más lejos que esto de la plaza no se simula nada (la cámara no la alcanza).
const CERCA = 75

// Lo que queda de cada luz con la plaza en su punto más oscuro, y desde y hasta
// dónde (distancia al portal) se oscurece.
const OSCURO = { empieza: 48, llena: 26, luz: 0.42, ambiente: 0.45, entorno: 0.38, niebla: 0.42 }

// Los rayos: de qué altura bajan, cuánto se angosta la punta, cuánto siguen bajo
// el piso (su orilla de abajo no se ve), dónde se apagan al tocar el piso y el
// radio de cada uno en el piso.
const RAYO = {
  alto: 13,
  punta: 0.42,
  bajoPiso: 1.12,
  fundido: 2.4,
  color: '#fff0d2',
  haz: 0.3,
  charco: 0.22,
  radioPortal: 2.5,
  radioOfrenda: 1.25,
  radioCama: 1.7,
  prende: 1.8,        // segundos en prender al poner la ofrenda
  guia: 0.32,         // lo que brilla el rayo del lugar de una ofrenda que Skulley carga
}

const azar = (a, b) => a + Math.random() * (b - a)
const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _c = new THREE.Vector3()
const _q = new THREE.Vector3()
const _v = new THREE.Vector3()

function armarAntorchas() {
  const partes = { madera: [], cuerda: [], hierro: [], brasa: [] }
  const bocas = []
  const A = ANTORCHA
  const C = A.copa
  const arriba = A.palo
  for (const a of ANTORCHAS) {
    const una = { madera: [], cuerda: [], hierro: [], brasa: [] }
    const palo = new THREE.CylinderGeometry(A.grueso[0], A.grueso[1], arriba + A.enterrado, 8)
    palo.translate(0, (arriba - A.enterrado) / 2, 0)
    una.madera.push(palo)
    // Dos amarres de cuerda abajo de la copa.
    for (const y of [arriba - 0.07, arriba - 0.19]) {
      const t = new THREE.TorusGeometry(0.07, 0.022, 6, 12)
      t.rotateX(Math.PI / 2)
      t.translate(0, y, 0)
      una.cuerda.push(t)
    }
    const copa = new THREE.CylinderGeometry(C.arriba, C.abajo, C.alto, 10)
    copa.translate(0, arriba + C.alto / 2 - 0.02, 0)
    una.hierro.push(copa)
    const borde = new THREE.TorusGeometry(C.arriba, 0.026, 6, 16)
    borde.rotateX(Math.PI / 2)
    borde.translate(0, arriba + C.alto - 0.02, 0)
    una.hierro.push(borde)
    const brasa = new THREE.CylinderGeometry(C.arriba * 0.86, C.arriba * 0.86, 0.04, 10)
    brasa.translate(0, arriba + C.alto - 0.05, 0)
    una.brasa.push(brasa)
    // Clavada un poco chueca, cada una hacia su lado.
    const eje = new THREE.Vector3(Math.cos(a.hacia), 0, Math.sin(a.hacia))
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(a.x, 0, a.z),
      new THREE.Quaternion().setFromAxisAngle(eje, a.inclina),
      new THREE.Vector3(1, 1, 1),
    )
    for (const nombre of Object.keys(una)) for (const g of una[nombre]) { g.applyMatrix4(m); partes[nombre].push(g) }
    bocas.push(new THREE.Vector3(0, arriba + C.alto - 0.04, 0).applyMatrix4(m))
  }
  const geos = {}
  for (const nombre of Object.keys(partes)) {
    geos[nombre] = mergeGeometries(partes[nombre].map((g) => g.toNonIndexed()), false)
    partes[nombre].forEach((g) => g.dispose())
  }
  return { geos, bocas }
}

const RAYO_VERT = /* glsl */`
attribute float aBrillo;
varying vec3 vLocal;
varying vec3 vMundo;
varying float vBrillo;
void main() {
  vLocal = position;
  vBrillo = aBrillo;
  vec4 m = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vMundo = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}
`
// Lo del haz de la historia (SkulleyFallRig, HAZ_FRAG), con la vista de la
// cámara en perspectiva: el centro de la silueta es donde la vuelta del cono
// mira a la cámara (el rayo no gira, así que la vuelta local es la del mundo).
const RAYO_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTiempo;
uniform float uFundido;
varying vec3 vLocal;
varying vec3 vMundo;
varying float vBrillo;
float hash(float n) { return fract(sin(n) * 43758.5453); }
float ruido(float x, float p) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(hash(mod(i, p)), hash(mod(i + 1.0, p)), f);
}
float ruido2(vec2 x, float p) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float x0 = mod(i.x, p);
  float x1 = mod(i.x + 1.0, p);
  return mix(mix(hash(x0 + i.y * 57.0), hash(x1 + i.y * 57.0), f.x), mix(hash(x0 + (i.y + 1.0) * 57.0), hash(x1 + (i.y + 1.0) * 57.0), f.x), f.y);
}
void main() {
  if (vBrillo <= 0.001) discard;
  vec2 vuelta = normalize(vLocal.xz);
  float vX = atan(vuelta.x, vuelta.y) / 6.28318530718 + 0.5;
  float vY = 1.0 + vLocal.y;
  float frente = abs(dot(vuelta, normalize(cameraPosition.xz - vMundo.xz)));
  float nucleo = pow(frente, 1.8);
  float r = 0.65 * ruido(vX * 16.0 + uTiempo * 0.15, 16.0) + 0.35 * ruido(vX * 35.0 - uTiempo * 0.11 + 7.0, 35.0);
  float rayo = smoothstep(0.2, 0.85, r);
  float tramo = ruido2(vec2(vX * 16.0, vY * 2.6 - uTiempo * 0.22), 16.0);
  rayo *= smoothstep(0.2, 0.7, tramo);
  float lado = smoothstep(0.92, 0.35, frente) * smoothstep(0.0, 0.45, frente);
  float luz = nucleo * mix(0.85, 1.15, rayo) + lado * mix(0.04, 0.6, rayo);
  vec2 g = vec2(vX * 420.0, vY * 170.0 + uTiempo * 2.0);
  float h = fract(sin(dot(floor(g), vec2(127.1, 311.7))) * 43758.5453);
  float mota = step(0.986, h) * smoothstep(0.16, 0.0, length(fract(g) - 0.5)) * (0.5 + 0.5 * sin(uTiempo * 2.2 + h * 40.0));
  // Se apaga antes de tocar el piso (visto desde arriba, el cono cerca del piso
  // se veía como un disco blanco sólido; el piso recibe el charco) y se pierde
  // hacia el cielo.
  float suelo = smoothstep(0.0, uFundido, vMundo.y);
  suelo *= suelo;
  float cielo = 1.0 - smoothstep(0.3, 1.0, vY);
  float a = (luz * mix(1.0, 0.6, vY) + (nucleo + lado * 0.5) * mota * 0.6) * suelo * cielo * uAlpha * vBrillo;
  gl_FragColor = vec4(uColor, a);
}
`
const CHARCO_VERT = /* glsl */`
attribute float aBrillo;
varying vec2 vUv;
varying float vBrillo;
void main() {
  vUv = uv;
  vBrillo = aBrillo;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`
const CHARCO_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
varying float vBrillo;
void main() {
  if (vBrillo <= 0.001) discard;
  float r = length(vUv - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.0, 1.0, r);
  gl_FragColor = vec4(uColor, a * a * a * uAlpha * vBrillo);
}
`

// Dónde caen los rayos: el portal, los cinco lugares y la cama.
function lugaresDeRayos() {
  return [
    { id: 'portal', x: CENTRO[0], z: CENTRO[1], r: RAYO.radioPortal },
    ...LUGARES.map((l) => ({ id: l.id, x: l.mesa.x, z: l.mesa.z, r: RAYO.radioOfrenda })),
    { id: CAMA.id, x: CAMA.x, z: CAMA.z, r: RAYO.radioCama },
  ]
}

function armarRayos() {
  const lista = lugaresDeRayos()
  const n = lista.length
  const color = new THREE.Color(RAYO.color)
  const comun = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }
  const cono = new THREE.CylinderGeometry(RAYO.punta, 1, 1, 48, 1, true)
  cono.translate(0, -0.5, 0)
  const brilloCono = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
  brilloCono.setUsage(THREE.DynamicDrawUsage)
  cono.setAttribute('aBrillo', brilloCono)
  const matRayo = new THREE.ShaderMaterial({
    ...comun, vertexShader: RAYO_VERT, fragmentShader: RAYO_FRAG,
    uniforms: { uColor: { value: color }, uAlpha: { value: RAYO.haz }, uTiempo: { value: 0 }, uFundido: { value: RAYO.fundido } },
  })
  const conos = new THREE.InstancedMesh(cono, matRayo, n)
  const plano = new THREE.PlaneGeometry(2, 2)
  plano.rotateX(-Math.PI / 2)
  const brilloCharco = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
  brilloCharco.setUsage(THREE.DynamicDrawUsage)
  plano.setAttribute('aBrillo', brilloCharco)
  const matCharco = new THREE.ShaderMaterial({
    ...comun, vertexShader: CHARCO_VERT, fragmentShader: CHARCO_FRAG,
    uniforms: { uColor: { value: color }, uAlpha: { value: RAYO.charco } },
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })
  const charcos = new THREE.InstancedMesh(plano, matCharco, n)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  lista.forEach((l, i) => {
    m.compose(new THREE.Vector3(l.x, RAYO.alto, l.z), q, new THREE.Vector3(l.r, RAYO.alto * RAYO.bajoPiso, l.r))
    conos.setMatrixAt(i, m)
    m.compose(new THREE.Vector3(l.x, 0.02, l.z), q, new THREE.Vector3(l.r * 1.15, 1, l.r * 1.15))
    charcos.setMatrixAt(i, m)
  })
  conos.instanceMatrix.needsUpdate = true
  charcos.instanceMatrix.needsUpdate = true
  conos.computeBoundingSphere()
  charcos.computeBoundingSphere()
  // Después de lo opaco y antes de las antorchas; los charcos encima de los pétalos.
  conos.renderOrder = 1
  charcos.renderOrder = 1
  // Siempre se dibujan (sin brillo se descartan): el calentamiento solo compila
  // lo que dibuja, y fuera de cuadro se compilaban al llegar a la plaza.
  conos.frustumCulled = false
  charcos.frustumCulled = false
  return { lista, conos, charcos, brillo: new Float32Array(n), matRayo }
}

// Baja las luces de la escena a `f` de lo que tienen (1 = como estaban). Cada luz
// guarda su valor de base; si alguien más se lo cambió (React con otra prop, un
// efecto por cuadro) se toma ese como base nueva.
function oscurecer(scene, k) {
  const base = (obj, campo, valor, f) => {
    const u = obj.userData
    const llave = `__oscuroBase_${campo}`
    const puesto = `__oscuroPuesto_${campo}`
    if (u[llave] == null || Math.abs(valor - u[puesto]) > 1e-6) u[llave] = valor
    const v = u[llave] * f
    u[puesto] = v
    return v
  }
  const luz = 1 - k * (1 - OSCURO.luz)
  const amb = 1 - k * (1 - OSCURO.ambiente)
  for (const o of scene.children) {
    if (o.isDirectionalLight) o.intensity = base(o, 'i', o.intensity, luz)
    else if (o.isAmbientLight || o.isHemisphereLight) o.intensity = base(o, 'i', o.intensity, amb)
  }
  if (typeof scene.environmentIntensity === 'number') {
    scene.environmentIntensity = base(scene, 'env', scene.environmentIntensity, 1 - k * (1 - OSCURO.entorno))
  }
  const fn = 1 - k * (1 - OSCURO.niebla)
  for (const [c, campo] of [[scene.fog?.color, 'niebla'], [scene.background?.isColor ? scene.background : null, 'fondo']]) {
    if (!c) continue
    const u = scene.userData
    const llave = `__oscuroColor_${campo}`
    const puesto = `__oscuroColorPuesto_${campo}`
    if (!u[llave] || !u[puesto] || !c.equals(u[puesto])) u[llave] = c.clone()
    c.copy(u[llave]).multiplyScalar(fn)
    u[puesto] = c.clone()
  }
}

function materialToon(params) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...params })
  applyToonBanding(mat, { steps: 3, minBand: 0.32, bandIndirect: true })
  return mat
}

// Cada bocanada va donde se VE sobre el cuadro (un plano de frente a la cámara a
// la profundidad del centro), escalada por la perspectiva: lo mismo que la
// turbina del drone.
function ponerCampo(f, camera) {
  const n = f.bocanadas.length
  f.u.uN.value = n
  const mesh = f.mesh
  if (!n) {
    mesh.scale.set(1e-4, 1e-4, 1)
    mesh.matrixWorld.compose(mesh.position, mesh.quaternion, mesh.scale)
    return
  }
  _x.setFromMatrixColumn(camera.matrixWorld, 0)
  _y.setFromMatrixColumn(camera.matrixWorld, 1)
  const persp = camera.isPerspectiveCamera
  _c.set(0, 0, 0)
  for (const b of f.bocanadas) _c.add(b.p)
  _c.divideScalar(n)
  _q.copy(_c).applyMatrix4(camera.matrixWorldInverse)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  const loc = f.loc
  f.bocanadas.forEach((b, i) => {
    const k = b.t / b.vida
    // Crece rápido al nacer y se consume al subir: la punta se afila.
    const r0 = b.r * Math.min(1, k / 0.18 + 0.35) * (1 - k * k)
    _v.copy(b.p).applyMatrix4(camera.matrixWorldInverse)
    const esc = persp ? _q.z / Math.min(-1e-4, _v.z) : 1
    const x = _v.x * esc - _q.x, y = _v.y * esc - _q.y, r = Math.max(r0 * esc, 1e-4)
    const l = loc[i]
    l[0] = x; l[1] = y; l[2] = r; l[3] = 1.15 - 0.5 * k
    x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r)
  })
  const w = Math.max(x1 - x0, 1e-3), h = Math.max(y1 - y0, 1e-3)
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const lado = Math.max(w, h)
  for (let i = 0; i < n; i++) {
    const [x, y, r, peso] = loc[i]
    f.u.uBolas.value[i].set((x - cx) / lado, (y - cy) / lado, r / lado, peso)
  }
  mesh.position.copy(_c).addScaledVector(_x, cx).addScaledVector(_y, cy)
  mesh.quaternion.copy(camera.quaternion)
  mesh.scale.set(lado, lado, 1)
  mesh.matrixWorld.compose(mesh.position, mesh.quaternion, mesh.scale)
}

export default function PlazaOfrenda({ playerRef, activo = true }) {
  const { size, gl, scene } = useThree()
  const recursos = useMemo(() => {
    const { geos, bocas } = armarAntorchas()
    const mats = {
      madera: materialToon({ color: '#7a5236' }),
      cuerda: materialToon({ color: '#c9a46a' }),
      hierro: materialToon({ color: '#3d3532', roughness: 0.6 }),
      brasa: materialToon({ color: '#ff5a14', emissive: '#ff4a00', emissiveIntensity: 1.2 }),
    }
    const plano = new THREE.PlaneGeometry(1, 1)
    const colores = PALETA.map((c) => new THREE.Color(c))
    const fuegos = bocas.map((boca, i) => {
      const u = {
        uBolas: { value: Array.from({ length: CAMPO_MAX }, () => new THREE.Vector4()) },
        uN: { value: 0 },
        uTiempo: { value: 0 },
        uC0: { value: colores[0].clone() }, uC1: { value: colores[1].clone() },
        uC2: { value: colores[2].clone() }, uC3: { value: colores[3].clone() },
        uBandas: { value: new THREE.Vector4(BANDAS.orilla, BANDAS.medio, BANDAS.claro, BANDAS.centro) },
      }
      const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT_CAMPO, fragmentShader: FRAG_CAMPO, depthWrite: false, toneMapped: false })
      const mesh = new THREE.Mesh(plano, m)
      mesh.frustumCulled = false
      mesh.renderOrder = 2
      mesh.matrixAutoUpdate = false
      mesh.matrixWorldAutoUpdate = false
      mesh.scale.set(1e-4, 1e-4, 1)
      mesh.matrixWorld.compose(mesh.position, mesh.quaternion, mesh.scale)
      return { mesh, u, boca, bocanadas: [], loc: Array.from({ length: FUEGO.max }, () => [0, 0, 0, 0]), resto: i * 0.37, restoCh: i * 0.21, fase: i * 1.7 }
    })
    const n = CHISPAS.max
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aTam', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
    g.setDrawRange(0, 0)
    const mc = new THREE.ShaderMaterial({ uniforms: { uEscalaPx: { value: 1 } }, vertexShader: VERT_CHISPA, fragmentShader: FRAG_CHISPA, toneMapped: false })
    const puntos = new THREE.Points(g, mc)
    puntos.frustumCulled = false
    return { geos, mats, plano, fuegos, colores, chispas: { puntos, g, m: mc, vivas: [] }, rayos: armarRayos() }
  }, [])

  useEffect(() => () => {
    Object.values(recursos.geos).forEach((g) => g.dispose())
    Object.values(recursos.mats).forEach((m) => m.dispose())
    recursos.plano.dispose()
    recursos.fuegos.forEach((f) => f.mesh.material.dispose())
    recursos.chispas.g.dispose()
    recursos.chispas.m.dispose()
    for (const im of [recursos.rayos.conos, recursos.rayos.charcos]) { im.geometry.dispose(); im.material.dispose() }
  }, [recursos])

  const est = useRef({ t: 0, cerca: false, oscuro: 0, oscuroPuesto: false })
  useEffect(() => {
    if (import.meta.env.DEV) window.__plazaOfrenda = { recursos, est: est.current, ANTORCHA, FUEGO, CHISPAS, OSCURO, RAYO }
  }, [recursos])

  useFrame((state, dtReal) => {
    const dt = Math.min(dtReal, 1 / 20)
    const e = est.current
    e.t += dt
    const p = playerRef?.current?.position
    const cerca = Boolean(activo && p && Math.hypot(p.x - CENTRO[0], p.z - CENTRO[1]) < CERCA)
    e.cerca = cerca
    // Las brasas respiran.
    recursos.mats.brasa.emissiveIntensity = 1.1 + 0.35 * Math.sin(e.t * 5.3) * Math.sin(e.t * 1.7)
    // La oscuridad de la plaza (en Customize no: ahí la escena es la foto).
    const d = distanciaOfrenda()
    const metaOscuro = wallpaperEstado.fase === 'off' ? 1 - THREE.MathUtils.smoothstep(d, OSCURO.llena, OSCURO.empieza) : 0
    e.oscuro += (metaOscuro - e.oscuro) * (1 - Math.exp(-4 * dt))
    if (e.oscuro < 1e-3 && metaOscuro === 0) e.oscuro = 0
    if (e.oscuro > 0 || e.oscuroPuesto) {
      oscurecer(scene, e.oscuro)
      e.oscuroPuesto = e.oscuro > 0
    }
    // Los rayos: el del portal siempre; los de las ofrendas, al ponerlas.
    const R = recursos.rayos
    if (cerca) {
      R.matRayo.uniforms.uTiempo.value = e.t
      const ac = R.conos.geometry.getAttribute('aBrillo'), ah = R.charcos.geometry.getAttribute('aBrillo')
      let cambio = false
      R.lista.forEach((l, i) => {
        // si Skulley carga esa ofrenda, su lugar lo llama con un rayo tenue que respira
        const meta = l.id === 'portal' || ofrendaPuesta(l.id) ? 1
          : ofrendaEnMano(l.id) ? RAYO.guia * (0.8 + 0.2 * Math.sin(e.t * 2.2)) : 0
        const b = R.brillo[i]
        const nb = b + Math.max(-dt / 0.8, Math.min(dt / RAYO.prende, meta - b))
        if (Math.abs(nb - b) > 1e-4 || ac.array[i] !== nb) {
          R.brillo[i] = nb
          // Prende con un pulso: entra, se pasa tantito y se asienta.
          const v = nb >= 1 ? 1 : nb * (1 + 0.35 * Math.sin(Math.PI * nb))
          ac.array[i] = v
          ah.array[i] = v
          cambio = true
        }
      })
      if (cambio) { ac.needsUpdate = true; ah.needsUpdate = true }
    }
    const camera = state.camera
    if (cerca) camera.updateMatrixWorld()
    const ch = recursos.chispas
    for (const f of recursos.fuegos) {
      f.u.uTiempo.value = e.t + f.fase
      if (!cerca) {
        f.bocanadas.length = 0
        ponerCampo(f, camera)
        continue
      }
      // Nacen en la boca, suben (el aire caliente las empuja), el viento las mece
      // y lo que ya salió se queda en el mundo.
      f.resto += FUEGO.porSegundo * dt
      while (f.resto >= 1) {
        f.resto -= 1
        if (f.bocanadas.length >= FUEGO.max) f.bocanadas.shift()
        const ang = Math.random() * Math.PI * 2
        const rr = Math.sqrt(Math.random()) * FUEGO.sale
        f.bocanadas.push({
          p: new THREE.Vector3(f.boca.x + Math.cos(ang) * rr, f.boca.y, f.boca.z + Math.sin(ang) * rr),
          v: new THREE.Vector3(azar(-1, 1) * FUEGO.abre, azar(...FUEGO.sube), azar(-1, 1) * FUEGO.abre),
          t: 0,
          vida: azar(...FUEGO.vida),
          r: azar(...FUEGO.tam),
        })
      }
      const vx = (Math.sin(e.t * 1.3 + f.fase) + 0.4 * Math.sin(e.t * 3.7 + f.fase * 2)) * FUEGO.viento
      const vz = Math.cos(e.t * 1.1 + f.fase * 1.3) * FUEGO.viento * 0.6
      f.bocanadas = f.bocanadas.filter((b) => (b.t += dt) < b.vida)
      for (const b of f.bocanadas) {
        b.v.y += FUEGO.empuja * dt
        b.v.x += (vx - b.v.x) * Math.min(1, 2.5 * dt)
        b.v.z += (vz - b.v.z) * Math.min(1, 2.5 * dt)
        b.p.addScaledVector(b.v, dt)
      }
      ponerCampo(f, camera)
      // Chispas que se sueltan de la punta.
      f.restoCh += CHISPAS.porSegundo * dt
      while (f.restoCh >= 1) {
        f.restoCh -= 1
        if (ch.vivas.length >= CHISPAS.max) ch.vivas.shift()
        ch.vivas.push({
          p: f.boca.clone().add(new THREE.Vector3(azar(-0.08, 0.08), azar(0.2, 0.45), azar(-0.08, 0.08))),
          v: new THREE.Vector3(azar(-1, 1) * CHISPAS.abre, azar(...CHISPAS.sube), azar(-1, 1) * CHISPAS.abre),
          t: 0,
          vida: azar(...CHISPAS.vida),
          tam: azar(0.028, 0.05),
          c: Math.random() < 0.5 ? 3 : 2,
        })
      }
    }
    if (!cerca && ch.vivas.length) ch.vivas.length = 0
    const aire = Math.exp(-CHISPAS.aire * dt)
    ch.vivas = ch.vivas.filter((c) => (c.t += dt) < c.vida)
    const pos = ch.g.attributes.position.array
    const tam = ch.g.attributes.aTam.array
    const col = ch.g.attributes.aColor.array
    ch.vivas.forEach((c, i) => {
      c.v.multiplyScalar(aire)
      c.v.x += Math.sin(e.t * 4 + i) * 0.6 * dt
      c.p.addScaledVector(c.v, dt)
      pos[i * 3] = c.p.x; pos[i * 3 + 1] = c.p.y; pos[i * 3 + 2] = c.p.z
      tam[i] = c.tam * (1 - c.t / c.vida)
      const cc = recursos.colores[c.c]
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b
    })
    ch.g.setDrawRange(0, ch.vivas.length)
    if (ch.vivas.length) {
      ch.g.attributes.position.needsUpdate = true
      ch.g.attributes.aTam.needsUpdate = true
      ch.g.attributes.aColor.needsUpdate = true
    }
    const fov = camera.isPerspectiveCamera ? THREE.MathUtils.degToRad(camera.fov) : 1
    ch.m.uniforms.uEscalaPx.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan(fov / 2))
  }, 0.5)

  const { geos, mats } = recursos
  return (
    <group>
      <mesh geometry={geos.madera} material={mats.madera} />
      <mesh geometry={geos.cuerda} material={mats.cuerda} />
      <mesh geometry={geos.hierro} material={mats.hierro} />
      <mesh geometry={geos.brasa} material={mats.brasa} />
      <primitive object={recursos.rayos.conos} />
      <primitive object={recursos.rayos.charcos} />
      {recursos.fuegos.map((f, i) => <primitive key={i} object={f.mesh} />)}
      <primitive object={recursos.chispas.puntos} />
    </group>
  )
}
