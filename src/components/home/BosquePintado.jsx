import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { getRuneAtlas, RUNE_ATLAS_GLSL } from '../../lib/runeAtlas.js'
import { compileAsyncSafe } from '../../lib/compileAsyncSafe.js'
import { setObstaculos, setClaro } from '../../lib/obstaculosHome.js'
import { zonasPiso } from '../../lib/pisoPintado.js'
import { sectionColors } from '../../lib/appHelpers.js'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { LUGARES, ANTORCHAS, SOLIDO_ANTORCHA } from '../../lib/plazaOfrenda.js'
import { ofrendaPuesta } from '../../lib/ofrendas.js'

// El bosque del home (Oscar, 2026-11-22): la home es un claro en el bosque que
// M.A.D.R.E. hizo con los recuerdos de Skulley. Pinos como la referencia de Oscar
// (pisos de copa con la orilla en ondas, varios tamaños), peñascos de cara plana,
// tres sólidos perfectos medio enterrados (la naturaleza no hace icosaedros). Los
// menhires con runas ya no se siembran: los de los portales los reemplazaron los
// letreros de neón (LetrerosPortales) y las estelas de la plaza de la ofrenda, los
// hitos labrados (HitosOfrenda, 2026-11-25); su código queda por si vuelven.
//
// Los modelos y el atlas los arma scripts/bosque/armar_bosque.py (Blender). Todo
// va pintado en grises como el piso: el 0.5 es el color de la escena (`colorPiso`),
// lo oscuro lo oscurece y lo claro lo acerca al blanco, con el banding toon de los
// personajes encima. Cambiar de día a noche no compila nada.
//
// Rendimiento: un InstancedMesh por pieza y por zona del mapa (ZONA m), así three
// descarta las zonas que no se ven; dos programas (bosque y menhir) que se compilan
// antes de entrar a la escena (compileAsyncSafe contra un render target, como el
// warm-up). Lo que queda pegado a la cámara o tapa a Skulley se trama (Bayer 4 × 4,
// sin transparencia): la cámara gira de 90 en 90° y cualquier pino puede quedar enfrente.

const VERSION = 2
const URL_GLB = `${import.meta.env.BASE_URL}3dmodels/bosque.glb?v=${VERSION}`
const URL_ATLAS = `${import.meta.env.BASE_URL}textures/bosque-atlas.webp?v=${VERSION}`

export const BOSQUE = {
  semilla: 23,
  // Más tupido y más ancho desde el 2026-11-23 (Oscar: en los huecos se veía el vacío);
  // por fuera de todo, el código (BordeDelMundo).
  anillo: [30, 62],        // el bosque alrededor del claro (radio)
  hueco: 9,                // medio ancho del paso al norte, hacia el glifo
  corredor: [9, 36],       // |x| de los pinos a los lados del camino al glifo
  corredorZ: [-46, -108],
  glifo: [18, 40],         // anillo alrededor de la plaza del glifo
  separa: 4.3,             // distancia mínima entre troncos de escala 1
  zona: 30,
  // Color: el de la escena con más luz (con el azul exacto del piso, sobre su
  // albedo tan oscuro, el bosque se perdía en lo negro); tope para el día, que ya
  // es claro. Luego cuánto oscurece lo oscuro del atlas y cuánto aclara lo claro.
  luz: 0.17,
  luzTope: 0.6,
  oscuro: 0.35,
  claro: 0.5,
  // Trama: cerca de la cámara (profundidad de vista) y frente a Skulley.
  cerca: [3, 7],
  choqueCopa: 0.72,        // el radio de choque de un pino, en fracción de su copa
  tapa: 0.82,
  frente: 0.7,             // trama de los pinos entre la cámara y Skulley
}

function azarCon(semilla) {
  let s = semilla
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

// ¿Puede ir un pino aquí? Fuera del claro, del paso al norte y del camino.
function lugarDePino(x, z) {
  const r = Math.hypot(x, z)
  const { plazaGlifo } = zonasPiso
  const dg = Math.hypot(x - plazaGlifo[0], z - plazaGlifo[1])
  if (dg < BOSQUE.glifo[0]) return false
  // El paso al norte y el camino: libres.
  if (z < -12 && Math.abs(x) < BOSQUE.hueco) return false
  if (r < BOSQUE.anillo[0]) return false
  return true
}

function sembrar(portales) {
  const azar = azarCon(BOSQUE.semilla)
  const pinos = []
  const piedras = []
  const menhires = []
  const ocupado = []
  const libre = (x, z, rad) => {
    for (const o of ocupado) {
      const lim = rad + o.rad
      if ((x - o.x) ** 2 + (z - o.z) ** 2 < lim * lim) return false
    }
    return true
  }
  const variante = (t) => {
    // Cerca del claro, los chicos (C) y medianos (A); hacia afuera, los altos.
    const u = azar()
    if (t < 0.35) return u < 0.45 ? 2 : u < 0.85 ? 0 : 1
    if (t < 0.7) return u < 0.15 ? 2 : u < 0.55 ? 0 : u < 0.85 ? 1 : 3
    return u < 0.3 ? 0 : u < 0.6 ? 1 : 3
  }
  const ponerPino = (x, z, t) => {
    const s = (0.72 + 0.6 * t) * (0.85 + 0.3 * azar())
    const rad = BOSQUE.separa * 0.5 * s
    if (!lugarDePino(x, z) || !libre(x, z, rad)) return false
    pinos.push({ v: variante(t), x, z, s, rot: azar() * Math.PI * 2 })
    ocupado.push({ x, z, rad })
    return true
  }
  // El trío idéntico (un error de M.A.D.R.E.): tres pinos iguales en fila.
  {
    const ang = -2.25, r = 34
    for (let i = -1; i <= 1; i++) {
      const a = ang + i * 0.16
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      pinos.push({ v: 0, x, z, s: 1.05, rot: 0.6 })
      ocupado.push({ x, z, rad: BOSQUE.separa * 0.5 })
    }
  }
  // El anillo del claro, el camino al glifo y el anillo del glifo.
  const [r0, r1] = BOSQUE.anillo
  for (let i = 0; i < 18000; i++) {
    const a = azar() * Math.PI * 2
    const r = Math.sqrt(r0 * r0 + azar() * (r1 * r1 - r0 * r0))
    ponerPino(Math.cos(a) * r, Math.sin(a) * r, (r - r0) / (r1 - r0))
  }
  const [c0, c1] = BOSQUE.corredor
  const [zc0, zc1] = BOSQUE.corredorZ
  for (let i = 0; i < 6000; i++) {
    const lado = azar() < 0.5 ? -1 : 1
    const ax = c0 + azar() * (c1 - c0)
    ponerPino(lado * ax, zc0 + azar() * (zc1 - zc0), (ax - c0) / (c1 - c0) * 0.9)
  }
  const { plazaGlifo } = zonasPiso
  const [g0, g1] = BOSQUE.glifo
  for (let i = 0; i < 7000; i++) {
    const a = azar() * Math.PI * 2
    const r = g0 + azar() * (g1 - g0)
    ponerPino(plazaGlifo[0] + Math.cos(a) * r, plazaGlifo[1] + Math.sin(a) * r, (r - g0) / (g1 - g0))
  }
  // Los portales ya no llevan menhires: los reemplazó un letrero de neón detrás de cada uno
  // (home/LetrerosPortales.jsx, Oscar 2026-11-25). Se gasta el azar que usaban (uno por menhir) para
  // que los peñascos de abajo no cambien de lugar.
  const lista = (portales || []).filter((p) => !p.antimatter)
  for (let k = 0; k < lista.length * 2; k++) azar()
  // La plaza de la ofrenda: las estelas también se fueron (las reemplazan los hitos labrados de
  // home/HitosOfrenda.jsx, Oscar 2026-11-25). Que nada crezca donde va cada objeto.
  for (const l of LUGARES) ocupado.push({ x: l.mesa.x, z: l.mesa.z, rad: 1.2 })
  // Peñascos: en la orilla del bosque, entre los pinos, y unos por el camino.
  for (let i = 0, puestos = 0; i < 4000 && puestos < 30; i++) {
    let x, z
    if (azar() < 0.75) {
      const a = azar() * Math.PI * 2
      const r = 28.5 + azar() * 9
      x = Math.cos(a) * r; z = Math.sin(a) * r
    } else {
      x = (azar() < 0.5 ? -1 : 1) * (6.5 + azar() * 8)
      z = -30 - azar() * 70
    }
    if (z < -12 && Math.abs(x) < 5.5) continue
    const v = Math.floor(azar() * 3)
    const s = 0.6 + azar() * 0.7
    const rad = [2.6, 1.8, 3.4][v] * 0.8 * s
    if (!libre(x, z, rad)) continue
    piedras.push({ v, x, z, s, rot: azar() * Math.PI * 2 })
    ocupado.push({ x, z, rad })
    puestos++
  }
  // Los tres sólidos perfectos, en la orilla entre portales.
  const angulos = lista.map((p) => Math.atan2(p.position[2], p.position[0])).sort((a, b) => a - b)
  ;[0, 2, 3].forEach((i, k) => {
    if (angulos.length < 5) return
    const a0 = angulos[i], a1 = angulos[(i + 1) % angulos.length] + (i + 1 >= angulos.length ? Math.PI * 2 : 0)
    const a = (a0 + a1) / 2 + (azar() - 0.5) * 0.2
    const r = 29.5 + azar() * 2
    piedras.push({ v: 3 + k, x: Math.cos(a) * r, z: Math.sin(a) * r, s: 1, rot: azar() * Math.PI * 2 })
  })
  return { pinos, piedras, menhires }
}

// ---------------------------------------------------------------- shaders

const VERT_COMUN = /* glsl */`
attribute vec2 aBosqueUv;
varying vec2 vBosqueUv;
varying vec4 vBosqueClip;
varying float vBosqueVista;
#ifdef BOSQUE_MENHIR
attribute vec2 aRunaUv;
attribute vec4 aRuna0;
attribute vec4 aRuna1;
attribute vec4 aRunaInfo;
attribute vec4 aBrillo;
varying vec2 vRunaUv;
varying vec4 vRuna0;
varying vec4 vRuna1;
varying vec4 vRunaInfo;
varying vec4 vBrillo;
#endif
`
const VERT_FIN = /* glsl */`
  vBosqueUv = aBosqueUv;
  vBosqueClip = gl_Position;
  vBosqueVista = -mvPosition.z;
#ifdef BOSQUE_MENHIR
  // El glTF voltea la v: se regresa a metros hacia arriba.
  vRunaUv = vec2(aRunaUv.x, 1.0 - aRunaUv.y);
  vRuna0 = aRuna0;
  vRuna1 = aRuna1;
  vRunaInfo = aRunaInfo;
  vBrillo = aBrillo;
#endif
`
const FRAG_COMUN = /* glsl */`
uniform sampler2D uBosqueAtlas;
uniform vec4 uBosqueSkulley;   // xy: NDC de Skulley, z: su profundidad de vista, w: radio en NDC (y)
uniform float uBosqueAspecto;
uniform vec2 uBosqueCerca;
uniform float uBosqueTapa;
uniform float uBosqueFrente;
uniform float uBosqueOscuro;
uniform float uBosqueClaro;
varying vec2 vBosqueUv;
varying vec4 vBosqueClip;
varying float vBosqueVista;
float bosqueValor;
float runaLuz = 0.0;
float bosqueBayer(vec2 p) {
  ivec2 q = ivec2(mod(floor(p), 4.0));
  int a = (((q.x ^ q.y) & 1) << 1) | (q.y & 1);
  int b = ((((q.x >> 1) ^ (q.y >> 1)) & 1) << 1) | ((q.y >> 1) & 1);
  return (float(a * 4 + b) + 0.5) / 16.0;
}
#ifdef BOSQUE_MENHIR
uniform float uRunaTiempo;
varying vec2 vRunaUv;
varying vec4 vRuna0;
varying vec4 vRuna1;
varying vec4 vRunaInfo;
varying vec4 vBrillo;
float runaCorte;
float runaHalo;
${RUNE_ATLAS_GLSL}
float runaLetra(float i) {
  vec4 a = i < 4.0 ? vRuna0 : vRuna1;
  float k = mod(i, 4.0);
  return k < 0.5 ? a.x : k < 1.5 ? a.y : k < 2.5 ? a.z : a.w;
}
#endif
`
// Antes de la luz: la trama (cerca de la cámara y frente a Skulley), el valor
// del atlas y, en los menhires, el corte de las runas.
const FRAG_ALFA = /* glsl */`
  {
    float tapa = 1.0 - smoothstep(uBosqueCerca.x, uBosqueCerca.y, vBosqueVista);
    vec2 ndc = vBosqueClip.xy / vBosqueClip.w;
    vec2 d = (ndc - uBosqueSkulley.xy) / max(uBosqueSkulley.w, 1e-3);
    d.x *= uBosqueAspecto;
    float circulo = 1.0 - smoothstep(0.75, 1.0, length(d * vec2(1.0, 0.8)));
    float enfrente = step(vBosqueVista, uBosqueSkulley.z - 1.2);
    tapa = max(tapa, enfrente * circulo * uBosqueTapa);
#ifndef BOSQUE_MENHIR
    // Los pinos (y peñascos) entre la cámara y Skulley se vuelven trama: con la
    // cámara del lado del bosque, las copas de enfrente tapaban media pantalla.
    tapa = max(tapa, (1.0 - smoothstep(uBosqueSkulley.z * 0.5, uBosqueSkulley.z * 0.8, vBosqueVista)) * uBosqueFrente);
#endif
    if (tapa > 0.0 && bosqueBayer(gl_FragCoord.xy) < tapa) discard;
    bosqueValor = texture2D(uBosqueAtlas, vBosqueUv).r;
#ifdef BOSQUE_MENHIR
    runaCorte = 0.0;
    runaHalo = 0.0;
    float n = vRunaInfo.x;
    if (vRunaUv.x > -50.0 && n > 0.5) {
      float ch = vRunaInfo.z;
      float cw = ch * 4.0 / 6.0;
      float paso = ch * 1.16;
      float y = vRunaInfo.y - vRunaUv.y;
      float fila = floor(y / paso);
      if (fila >= 0.0 && fila < n && abs(vRunaUv.x) < cw * 0.75) {
        float cell = runaLetra(fila);
        if (cell > -0.5) {
          vec2 g = vec2(vRunaUv.x / cw * 4.0 + 2.0, (y - fila * paso) / ch * 6.0);
          float dr = runeDist(cell, g);
          float aa = clamp(fwidth(dr) * 0.8, 0.02, 0.4);
          runaCorte = 1.0 - smoothstep(-aa, aa, dr + 0.04);
          runaHalo = exp(-max(dr, 0.0) * 2.2) * (1.0 - runaCorte);
        }
      }
    }
    // Lo cortado es más hondo: más oscuro.
    bosqueValor = mix(bosqueValor, 0.3, runaCorte);
#endif
  }
`
const FRAG_EMISIVO = /* glsl */`
#ifdef BOSQUE_MENHIR
  {
    // Se prende del color del portal al acercarse (vBrillo.a es la cercanía).
    float m = clamp(vBrillo.a, 0.0, 1.0);
    float pulso = 0.85 + 0.15 * sin(uRunaTiempo * 2.4 + vRunaInfo.w);
    // Los colores claros (el amarillo de Contacto) se lavaban a blanco con el bloom.
    float k = mix(1.0, 0.5, clamp(dot(vBrillo.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0));
    totalEmissiveRadiance += vBrillo.rgb * k * (runaCorte * (0.1 + 2.6 * m * pulso) + runaHalo * 0.55 * m);
    // Prendida, la runa es solo su luz: el azul de la piedra debajo la lavaba a blanco.
    runaLuz = min(1.0, runaCorte + runaHalo * 0.6) * m;
  }
#endif
`
const FRAG_COLOR = /* glsl */`
  {
    // El valor pintado se aplica a la luz (no al brillo de las runas), en un
    // espacio parecido al de la vista, como el piso y las matas.
    float v = (bosqueValor - 0.5) / 0.5;
    vec3 vis = sqrt(min(max(outgoingLight - totalEmissiveRadiance, 0.0), vec3(1.0)));
    vis *= 1.0 - uBosqueOscuro * max(-v, 0.0);
    vis = mix(vis, vec3(1.0), uBosqueClaro * max(v, 0.0));
    vis *= 1.0 - runaLuz;
    outgoingLight = vis * vis + totalEmissiveRadiance;
  }
`

function crearMaterial(tipo, uniforms, color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, envMapIntensity: 0.6 })
  const menhir = tipo === 'menhir'
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    if (menhir) shader.defines = { ...(shader.defines || {}), BOSQUE_MENHIR: '' }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_COMUN}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${VERT_FIN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_COMUN}`)
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>\n${FRAG_ALFA}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAG_EMISIVO}`)
      .replace('#include <opaque_fragment>', `${FRAG_COLOR}\n#include <opaque_fragment>`)
  }
  mat.customProgramCacheKey = () => `bosque-pintado-${tipo}-1`
  // Bandas de luz como los personajes, sin caer a negro (es piedra y follaje, no tinta).
  applyToonBanding(mat, { steps: 3, minBand: 0.32, bandIndirect: true })
  return mat
}

// ---------------------------------------------------------------- piezas

// Las runas de las estelas de la ofrenda: el naranja de los pétalos.
const COLOR_OFRENDA = '#ff7a1a'

const PIEZAS_PINO = ['Pino_A', 'Pino_B', 'Pino_C', 'Pino_D']
const PIEZAS_PIEDRA = ['Penasco_A', 'Penasco_B', 'Penasco_C', 'Solido_Ico', 'Solido_Dodeca', 'Solido_Octa']
const PIEZAS_MENHIR = ['Menhir_A', 'Menhir_B', 'Menhir_C']

let cargaGlb = null
function cargarGlb() {
  if (cargaGlb) return cargaGlb
  // Su propio LoadingManager: la barra del preloader no espera al bosque.
  const manager = new THREE.LoadingManager()
  const draco = new DRACOLoader(manager)
  draco.setDecoderPath(`${import.meta.env.BASE_URL || '/'}three/draco/gltf/`)
  const loader = new GLTFLoader(manager)
  loader.setDRACOLoader(draco)
  cargaGlb = new Promise((resolve, reject) => {
    loader.load(URL_GLB, (g) => { resolve(g); setTimeout(() => draco.dispose(), 0) }, undefined, reject)
  })
  return cargaGlb
}

function geometriaDe(gltf, nombre) {
  let malla = null
  gltf.scene.traverse((o) => { if (!malla && o.isMesh && (o.name === nombre || o.parent?.name === nombre)) malla = o })
  if (!malla) return null
  const g = malla.geometry.clone()
  g.setAttribute('aBosqueUv', g.getAttribute('uv'))
  if (g.getAttribute('uv1')) g.setAttribute('aRunaUv', g.getAttribute('uv1'))
  g.deleteAttribute('uv')
  g.deleteAttribute('uv1')
  const extras = { ...(malla.parent?.userData || {}), ...(malla.userData || {}) }
  g.computeBoundingBox()
  const tam = g.boundingBox.getSize(new THREE.Vector3())
  return { geo: g, choque: Number(extras.choque) || 1, alto: Number(extras.alto) || 4.5, copa: (tam.x + tam.z) / 4 }
}

// Letras de un nombre en casillas del atlas (A = 0 … Z = 25), sin acentos ni espacios.
function letrasDe(nombre) {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8)
    .split('').map((c) => c.charCodeAt(0) - 65)
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _arriba = new THREE.Vector3(0, 1, 0)

function armarInstancias(grupo, geo, mat, items, porZona = true) {
  const zonas = new Map()
  for (const it of items) {
    const k = porZona ? `${Math.floor(it.x / BOSQUE.zona)},${Math.floor(it.z / BOSQUE.zona)}` : 'todo'
    if (!zonas.has(k)) zonas.set(k, [])
    zonas.get(k).push(it)
  }
  const mallas = []
  for (const lista of zonas.values()) {
    const im = new THREE.InstancedMesh(geo, mat, lista.length)
    lista.forEach((it, i) => {
      _q.setFromAxisAngle(_arriba, it.rot)
      _p.set(it.x, 0, it.z)
      _s.setScalar(it.s)
      im.setMatrixAt(i, _m.compose(_p, _q, _s))
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
    im.matrixAutoUpdate = false
    im.userData.items = lista
    grupo.add(im)
    mallas.push(im)
  }
  return mallas
}

export default function BosquePintado({ playerRef, portales, colorPiso = '#204580', portalMixMap, visible = true }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const { t, lang } = useLanguage()
  const [listo, setListo] = useState(null)

  const uniforms = useMemo(() => {
    const atlas = new THREE.TextureLoader().load(URL_ATLAS, (tex) => { try { gl.initTexture(tex) } catch { } })
    atlas.flipY = false
    atlas.colorSpace = THREE.NoColorSpace
    atlas.wrapS = THREE.RepeatWrapping
    atlas.anisotropy = Math.min(8, gl?.capabilities?.getMaxAnisotropy?.() || 1)
    return {
      uBosqueAtlas: { value: atlas },
      uBosqueSkulley: { value: new THREE.Vector4(0, 0, -100, 0.2) },
      uBosqueAspecto: { value: 1 },
      uBosqueCerca: { value: new THREE.Vector2(...BOSQUE.cerca) },
      uBosqueTapa: { value: BOSQUE.tapa },
      uBosqueFrente: { value: BOSQUE.frente },
      uBosqueOscuro: { value: BOSQUE.oscuro },
      uBosqueClaro: { value: BOSQUE.claro },
      uRunaTiempo: { value: 0 },
      uRuneAtlas: { value: getRuneAtlas() },
    }
  }, [gl])

  const listaPortales = useMemo(() => (portales || []).map((p) => ({ id: p.id, position: p.position, antimatter: !!p.antimatter })), [portales])

  // Arma todo cuando llega el GLB, lo compila fuera de la escena y entonces lo monta.
  useEffect(() => {
    let vivo = true
    let armado = null
    cargarGlb().then(async (gltf) => {
      if (!vivo) return
      const plan = sembrar(listaPortales)
      const grupo = new THREE.Group()
      grupo.name = 'BosquePintado'
      const matBosque = crearMaterial('bosque', uniforms, colorPiso)
      const matMenhir = crearMaterial('menhir', uniforms, colorPiso)
      const geos = []
      const obstaculos = []
      const pino = PIEZAS_PINO.map((n) => geometriaDe(gltf, n))
      const piedra = PIEZAS_PIEDRA.map((n) => geometriaDe(gltf, n))
      const menhir = PIEZAS_MENHIR.map((n) => geometriaDe(gltf, n))
      pino.forEach((pz, v) => {
        if (!pz) return
        geos.push(pz.geo)
        const items = plan.pinos.filter((it) => it.v === v)
        armarInstancias(grupo, pz.geo, matBosque, items)
        // Skulley choca con la copa, no con el tronco: el primer piso le queda a la
        // altura de la cabeza, y así el bosque es la orilla del claro (se pasa por
        // el camino al glifo y por los huecos que queden).
        for (const it of items) obstaculos.push({ x: it.x, z: it.z, r: pz.copa * BOSQUE.choqueCopa * it.s })
      })
      piedra.forEach((pz, v) => {
        if (!pz) return
        geos.push(pz.geo)
        const items = plan.piedras.filter((it) => it.v === v)
        armarInstancias(grupo, pz.geo, matBosque, items)
        for (const it of items) obstaculos.push({ x: it.x, z: it.z, r: pz.choque * it.s })
      })
      // Lo sólido de la plaza de la ofrenda: las antorchas (PlazaOfrenda).
      for (const a of ANTORCHAS) obstaculos.push({ x: a.x, z: a.z, r: SOLIDO_ANTORCHA })
      const menhires = []
      menhir.forEach((pz, v) => {
        if (!pz) return
        const items = plan.menhires.filter((it) => it.v === v)
        if (!items.length) return
        const g = pz.geo
        geos.push(g)
        const n = items.length
        g.setAttribute('aRuna0', new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(-1), 4))
        g.setAttribute('aRuna1', new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(-1), 4))
        g.setAttribute('aRunaInfo', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4))
        const brillo = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)
        brillo.setUsage(THREE.DynamicDrawUsage)
        g.setAttribute('aBrillo', brillo)
        const [im] = armarInstancias(grupo, g, matMenhir, items, false)
        im.userData.alto = pz.alto
        menhires.push(im)
        for (const it of items) obstaculos.push({ x: it.x, z: it.z, r: pz.choque * it.s, esfera: true })
      })
      setObstaculos(obstaculos)
      setClaro({
        radio: BOSQUE.anillo[0] - 1.5,
        ancho: BOSQUE.hueco - 1,
        glifo: [zonasPiso.plazaGlifo[0], zonasPiso.plazaGlifo[1]],
        radioGlifo: BOSQUE.glifo[0] - 1.5,
      })
      // Compilar antes de montar, con un render target puesto (la escena se
      // dibuja dentro del composer: otra llave de programa que contra la pantalla).
      const rt = new THREE.WebGLRenderTarget(16, 16)
      try { await compileAsyncSafe(gl, grupo, camera, 10000, rt, scene) } catch { }
      rt.dispose()
      if (!vivo) {
        geos.forEach((g) => g.dispose()); matBosque.dispose(); matMenhir.dispose()
        return
      }
      armado = { grupo, matBosque, matMenhir, menhires, geos, plan }
      setListo(armado)
    }).catch((e) => { if (import.meta.env.DEV) console.warn('[Bosque] no cargó', e) })
    return () => {
      vivo = false
      setObstaculos([])
      setClaro(null)
      if (armado) {
        armado.grupo.removeFromParent()
        armado.geos.forEach((g) => g.dispose())
        armado.matBosque.dispose()
        armado.matMenhir.dispose()
      }
    }
    // El bosque se arma una vez; el color y los nombres cambian sin rearmar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaPortales, uniforms, gl])

  // Color de la escena (día y noche), con más luz: sin recompilar.
  useEffect(() => {
    if (!listo) return
    const c = new THREE.Color(colorPiso)
    const hsl = {}
    c.getHSL(hsl)
    c.setHSL(hsl.h, hsl.s, Math.min(hsl.l + BOSQUE.luz, Math.max(hsl.l, BOSQUE.luzTope)))
    listo.matBosque.color.copy(c)
    listo.matMenhir.color.copy(c)
  }, [listo, colorPiso])

  // Los nombres de las secciones en runas, en el idioma de la barra.
  useEffect(() => {
    if (!listo) return
    for (const im of listo.menhires) {
      const g = im.geometry
      const r0 = g.getAttribute('aRuna0'), r1 = g.getAttribute('aRuna1'), info = g.getAttribute('aRunaInfo')
      im.userData.items.forEach((it, i) => {
        const letras = letrasDe(it.nombre ? (lang === 'es' ? it.nombre.es : it.nombre.en) : t?.(`nav.${it.portal}`) || it.portal)
        for (let k = 0; k < 8; k++) {
          const arr = k < 4 ? r0.array : r1.array
          arr[i * 4 + (k % 4)] = k < letras.length ? letras[k] : -1
        }
        const n = letras.length
        // La columna empieza abajo de la cabeza y las runas miden lo mismo en
        // cada piedra hasta que no caben.
        const arriba = im.userData.alto * 0.8
        const alto = Math.min(0.56, (arriba - 0.55) / Math.max(n, 1) / 1.16)
        info.array.set([n, arriba, alto, i * 1.7 + it.x], i * 4)
      })
      r0.needsUpdate = true; r1.needsUpdate = true; info.needsUpdate = true
    }
  }, [listo, t, lang])

  // En desarrollo: el plan, los materiales y los uniforms.
  useEffect(() => { if (import.meta.env.DEV && listo) window.__bosque = { ...listo, uniforms, BOSQUE } }, [listo, uniforms])

  const v = useRef({ p: new THREE.Vector3(), tam: new THREE.Vector2() })
  useFrame((state, delta) => {
    if (!listo) return
    const u = uniforms
    u.uRunaTiempo.value += Math.min(delta, 0.05)
    // Skulley en pantalla: para tramar lo que lo tapa.
    const p = playerRef?.current?.position
    const cam = state.camera
    if (p) {
      const w = v.current.p.set(p.x, p.y + 1.4, p.z)
      w.applyMatrix4(cam.matrixWorldInverse)
      const prof = -w.z
      w.applyMatrix4(cam.projectionMatrix)
      const radio = prof > 0.1 ? (2.85 * 0.5 * cam.projectionMatrix.elements[5] / prof) * 1.7 : 0
      u.uBosqueSkulley.value.set(w.x, w.y, prof, Math.max(radio, 0.05))
    }
    state.gl.getDrawingBufferSize(v.current.tam)
    u.uBosqueAspecto.value = v.current.tam.x / Math.max(1, v.current.tam.y)
    // La cercanía de cada portal enciende sus dos menhires; la ofrenda puesta, su
    // estela (sube en un segundo y medio).
    const dt = Math.min(delta, 0.05)
    for (const im of listo.menhires) {
      const attr = im.geometry.getAttribute('aBrillo')
      let cambio = false
      im.userData.items.forEach((it, i) => {
        let m
        if (it.ofrenda) {
          const meta = ofrendaPuesta(it.ofrenda) ? 1 : 0
          it.brillo = (it.brillo || 0) + Math.max(-dt / 0.6, Math.min(dt / 1.5, meta - (it.brillo || 0)))
          m = it.brillo
        } else {
          m = Math.min(1, portalMixMap?.[it.portal] || 0)
        }
        const o = i * 4
        if (!it.color) {
          it.color = new THREE.Color(it.ofrenda ? COLOR_OFRENDA : sectionColors[it.portal] || '#ffffff')
          attr.array.set([it.color.r, it.color.g, it.color.b, m], o)
          cambio = true
        } else if (Math.abs(attr.array[o + 3] - m) > 1e-3) {
          attr.array[o + 3] = m
          cambio = true
        }
      })
      if (cambio) attr.needsUpdate = true
    }
  })

  if (!listo) return null
  return <primitive object={listo.grupo} visible={visible} />
}
