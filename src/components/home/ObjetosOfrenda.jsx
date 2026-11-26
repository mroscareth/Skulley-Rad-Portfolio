import React, { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { applyToonBanding } from '../../lib/toonBanding.js'
import { crearUniformContorno, medirContorno, glslContorno } from '../../lib/contornoPantalla.js'
import { CENTRO, LUGARES, CAMA } from '../../lib/plazaOfrenda.js'
import { ofrendaPuesta, ofrendasEnMano, ponerOfrenda, nivelOfrenda, TOTAL_OFRENDAS } from '../../lib/ofrendas.js'
import { setObstaculosExtra } from '../../lib/obstaculosHome.js'
import { playSfx } from '../../lib/sfx.js'
import { sonarOfrendaVuela, sonarOfrendaPuesta } from '../../lib/ofrendaSonidos.js'
import { cine, finalVisto, EVENTO_REPETIR } from '../../lib/cinematicaOfrenda.js'
import { siesta } from '../../lib/siestaSkulley.js'
import STICKER_IPAD from '../../assets/stickers/4-lineas.png'

// Los objetos de la ofrenda del Día de los Skulleys (Oscar, 2026-11-24;
// features.md): el iPad donde dibuja, su cámara (una D-Lux 8, sin marcas: Oscar no quiere que se llame Leica en el sitio), el álbum de su gente, su teclado
// MIDI, la caja de cerillos que le regaló su novia y la almohada. Los modela
// scripts/ofrenda/objetos.py (Character/Ofrendas.blend) → public/3dmodels/ofrendas.glb,
// cada uno a su tamaño real en metros con el frente hacia +z; aquí van en el piso de
// su lugar (`mesa` de lib/plazaOfrenda.js, dentro de su corona de pétalos; la
// almohada en `CAMA`), viendo al portal, con su escala (`ESCALA`: a tamaño real
// la caja de cerillos sería un punto desde la cámara del juego).
//
// Al poner una ofrenda (ponerOfrenda), con su rayo de luz el objeto baja del cielo
// y se asienta con un rebote; ya puesto, lo alumbra el rayo (un poco de su propio
// color en el emisivo: la plaza es oscura). Lo que no está puesto no se oculta: se
// encoge a casi nada (`NADA`), así se compila con la escena y aparecer no compila.
// Toon de la plaza (banding de 3 bandas) y contorno de tinta con el grosor medido
// en pantalla, como el drone. Lo dibujado (la pantalla del iPad, las fotos, la
// etiqueta de los cerillos, los pads del teclado) se pinta en canvas aquí. Puestos
// son sólidos (setObstaculosExtra), menos la almohada, donde Skulley se va a dormir.
//
// Antes de ponerla, la ofrenda se consigue (conseguirOfrenda, la da una misión) y
// Skulley la carga: una copia del objeto (mismas mallas y materiales, así no
// compila) flota sobre su cabeza, girando; si carga varias, le dan vueltas. Al
// llegar a la orilla de su corona (`CARGA.radio`) vuela en arco hasta arriba de su
// lugar, creciendo a su tamaño, y de ahí cae con el rayo. La almohada solo se pone con las otras cinco ya puestas.

const VERSION = '2026-11-25d'
export const URL_OFRENDAS = `${import.meta.env.BASE_URL}3dmodels/ofrendas.glb?v=${VERSION}`
const URL = URL_OFRENDAS
const NADA = 1e-4
const CERCA = 75
// metros reales → unidades del sitio (Skulley mide 2.85, o sea 1.61 por metro real)
export const ESCALA = { ipad: 6, leica: 9, album: 3.3, teclado: 4.6, cerillos: 10, almohada: 2.2 }
// lo sólido de cada uno, en unidades del sitio (radio en el piso)
const SOLIDO = { ipad: 0.62, leica: 0.5, album: 0.85, teclado: 0.72, cerillos: 0.38 }
const CAE = { alto: 2.6, espera: 0.6, dura: 0.75, rebote: 0.12, luz: 0.3 }
// al tocar el piso: el estallido (color, tamaño de la esfera y del aro en PortalBurst) y el temblor
const PUESTA = { color: '#ff7a1a', orb: 0.75, radio: 2.4, temblor: 0.55 }
// La que carga: `tam` lo que mide su lado más largo, a `alto` del piso (arriba de la cresta), con
// `vueltas` de varias alrededor; `sigue` lo pegada que va a él (1/s). `radio` y `radioCama`: a qué
// distancia del lugar se pone (afuera de lo que ocupa el objeto, para que no le caiga encima); `arco`:
// lo alto del arco con que vuela a su lugar, y `luz` lo que la alumbra mientras la carga (la plaza es oscura).
// `cabeza`: si lo que carga flota sobre su cabeza. Oscar, 2026-11-25: no; lo que gana va al inventario
// (Customize → Objetos) y al llegar a su piedra el objeto sale de Skulley (`salida`, a la altura del pecho)
// y vuela a su lugar.
const CARGA = { cabeza: false, salida: 1.5, tam: 1.05, alto: 3.75, vueltas: 0.75, separa: 0.75, sigue: 9, entra: 0.45, sale: 0.22, radio: 2.3, radioCama: 2.5, arco: 2.2, luz: 0.55 }
const TAU = Math.PI * 2
const rebotaFuera = (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }

const COLOR = {
  Ipad_Aluminio: '#5b6068', Ipad_Bisel: '#111215', Ipad_Funda: '#24305e', Ipad_Lente: '#0c0c0e',
  Lapiz_Blanco: '#f3f3f1', Lapiz_Punta: '#8e8f93',
  // la cámara (la D-Lux 8 de Oscar, sin marcas; los nombres de material conservan el id `leica`)
  Leica_Piel: '#141416', Leica_Tapa: '#2a2c31', Leica_Metal: '#c9ccd1', Leica_Lente: '#16161a', Leica_Vidrio: '#22335a',
  Leica_Ventana: '#3b4658', Leica_Rojo: '#e0141e', Leica_Pantalla: '#2c3540',
  Album_Piel: '#6e2a1c', Album_Hojas: '#f1e8d2', Album_Marco: '#fbfaf6', Album_Esquina: '#1c1c1c',
  Teclado_Cuerpo: '#1b1b1f', Teclado_Blanca: '#f5f5f3', Teclado_Negra: '#0d0d0f', Teclado_Perilla: '#2a2a2f',
  Teclado_Marca: '#f0f0f0', Teclado_Fader: '#d9d9dc', Teclado_Tira: '#333338',
  Cerillos_Caja: '#e3cfa2', Cerillos_Lija: '#5a3a22', Cerillos_Palo: '#efd39a', Cerillos_Cabeza: '#d4161b',
  Cerillos_Quemado: '#151212',
  Almohada_Tela: '#f4efe4', Almohada_Ribete: '#3a6fd8',
}
const PADS = ['#ff3b5c', '#ff8a1f', '#ffd31a', '#4cd964', '#21d4fd', '#3d7bff', '#a259ff', '#ff4fd8']

// ---------------------------------------------------------------- lo dibujado

function lienzo(w, h, pinta) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  pinta(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// La pantalla del iPad: la app de dibujo con el sticker de Skulley en líneas negras, el mismo del
// wallpaper (Oscar, 2026-11-25: el dibujo de antes "feo"). La imagen llega después: se pinta encima
// y se resube la textura (no compila nada).
function pantallaIpad() {
  const fondo = (g, w, h) => {
    g.fillStyle = '#f6f1e4'
    g.fillRect(0, 0, w, h)
    // la barra de la app y los deslizadores del pincel
    g.fillStyle = '#26262b'
    g.fillRect(0, 0, w, 26)
    g.fillStyle = '#f5ff00'
    g.beginPath(); g.arc(w - 26, 13, 7, 0, 7); g.fill()
    g.fillStyle = '#d9d4c6'
    for (const [x, y, hh] of [[10, 70, 90], [10, 180, 90]]) { g.beginPath(); g.roundRect(x, y, 10, hh, 5); g.fill() }
  }
  let lienzoPantalla = null
  const tex = lienzo(512, 368, (g, w, h) => { fondo(g, w, h); lienzoPantalla = g })
  // la pantalla del GLB trae la v de arriba hacia abajo (v = 0 arriba): sin esto el dibujo salía de cabeza
  tex.flipY = false
  const img = new Image()
  img.onload = () => {
    const g = lienzoPantalla
    const { width: w, height: h } = g.canvas
    const lado = (h - 26) * 0.86
    const k = lado / Math.max(img.width, img.height)
    const iw = img.width * k, ih = img.height * k
    g.drawImage(img, w * 0.53 - iw / 2, 26 + (h - 26 - ih) / 2, iw, ih)
    tex.needsUpdate = true
  }
  img.src = STICKER_IPAD
  return tex
}

// Las fotos del álbum (4 × 2, en el orden de las celdas del modelo): el Cerro de
// la Silla al atardecer, una pareja, la familia, el perro, los amigos en un
// concierto, la playa, un pastel de cumpleaños y la ciudad de noche. Siluetas,
// sin caras: son su gente.
function fotosAlbum() {
  return lienzo(1024, 512, (g) => {
    const celda = (k, pinta) => {
      const x = (k % 4) * 256, y = (1 - Math.floor(k / 4)) * 256
      g.save()
      g.beginPath(); g.rect(x, y, 256, 256); g.clip()
      g.translate(x, y)
      pinta()
      // viñeta de foto vieja
      const v = g.createRadialGradient(128, 128, 60, 128, 128, 190)
      v.addColorStop(0, 'rgba(0,0,0,0)')
      v.addColorStop(1, 'rgba(40,20,0,0.35)')
      g.fillStyle = v
      g.fillRect(0, 0, 256, 256)
      g.restore()
    }
    const cielo = (a, b) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 256, 256) }
    const persona = (x, y, s, color) => {
      g.fillStyle = color
      g.beginPath(); g.arc(x, y - 52 * s, 16 * s, 0, 7); g.fill()
      g.beginPath(); g.roundRect(x - 22 * s, y - 34 * s, 44 * s, 80 * s, 18 * s); g.fill()
    }
    celda(0, () => {
      cielo('#ff8a3d', '#ffd0a0')
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(128, 150, 26, 0, 7); g.fill()
      g.fillStyle = '#3a1d3a'
      g.beginPath(); g.moveTo(0, 256); g.lineTo(0, 170); g.lineTo(60, 120); g.lineTo(100, 150); g.lineTo(128, 132)
      g.lineTo(150, 152); g.lineTo(196, 96); g.lineTo(256, 160); g.lineTo(256, 256); g.fill()
    })
    celda(1, () => {
      cielo('#7ec8ff', '#d9f1ff')
      g.fillStyle = '#5fbf5f'; g.fillRect(0, 200, 256, 56)
      persona(100, 200, 1.1, '#2a2a3a'); persona(156, 206, 1, '#3a2a3a')
      g.fillStyle = '#ff3b5c'; g.beginPath(); g.moveTo(128, 92); g.bezierCurveTo(108, 70, 90, 96, 128, 120); g.bezierCurveTo(166, 96, 148, 70, 128, 92); g.fill()
    })
    celda(2, () => {
      cielo('#ffe1b0', '#fff4dc')
      persona(60, 215, 1.05, '#4a3a5a'); persona(110, 210, 1.15, '#2e2a40'); persona(160, 222, 0.8, '#5a3a4a'); persona(205, 228, 0.65, '#3a4a5a')
    })
    celda(3, () => {
      cielo('#a8e0ff', '#f0faff')
      g.fillStyle = '#ffe066'; g.beginPath(); g.arc(200, 60, 24, 0, 7); g.fill()
      g.fillStyle = '#7ccf6a'; g.fillRect(0, 200, 256, 56)
      g.fillStyle = '#3b2a20'
      g.beginPath(); g.ellipse(128, 190, 40, 30, 0, 0, 7); g.fill()
      g.beginPath(); g.arc(150, 140, 24, 0, 7); g.fill()
      g.beginPath(); g.ellipse(166, 122, 8, 14, 0.5, 0, 7); g.fill()
      g.beginPath(); g.ellipse(140, 120, 8, 14, -0.5, 0, 7); g.fill()
    })
    celda(4, () => {
      cielo('#1a0d3a', '#4a1a6a')
      for (const [x, c] of [[50, '#ff3b5c'], [128, '#21d4fd'], [206, '#ffd31a']]) {
        const gr = g.createLinearGradient(x, 0, x, 180); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x + 60, 180); g.lineTo(x - 60, 180); g.fill()
      }
      persona(70, 240, 1, '#0d0618'); persona(128, 236, 1.1, '#0d0618'); persona(186, 242, 0.95, '#0d0618')
    })
    celda(5, () => {
      cielo('#5ec8ff', '#c8f0ff')
      g.fillStyle = '#2f9be0'; g.fillRect(0, 150, 256, 50)
      g.fillStyle = '#f3dd9b'; g.fillRect(0, 196, 256, 60)
      g.fillStyle = '#fff6a0'; g.beginPath(); g.arc(60, 70, 22, 0, 7); g.fill()
      g.strokeStyle = '#5a3a1a'; g.lineWidth = 8; g.beginPath(); g.moveTo(200, 230); g.quadraticCurveTo(190, 160, 210, 110); g.stroke()
      g.fillStyle = '#2f8a3a'
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(210 + Math.cos(k * 1.3) * 22, 110 + Math.sin(k * 1.3) * 10, 30, 8, k * 1.3, 0, 7); g.fill() }
    })
    celda(6, () => {
      cielo('#ffd9e6', '#fff0f5')
      g.fillStyle = '#7a3a2a'; g.beginPath(); g.roundRect(58, 140, 140, 80, 10); g.fill()
      g.fillStyle = '#ff9ec0'; g.beginPath(); g.roundRect(58, 132, 140, 22, 10); g.fill()
      for (let k = 0; k < 5; k++) {
        const x = 78 + k * 25
        g.fillStyle = PADS[k]; g.fillRect(x - 3, 100, 6, 32)
        g.fillStyle = '#ffd31a'; g.beginPath(); g.ellipse(x, 92, 5, 9, 0, 0, 7); g.fill()
      }
    })
    celda(7, () => {
      cielo('#0b1030', '#22205a')
      g.fillStyle = '#f5f1d0'; g.beginPath(); g.arc(200, 50, 16, 0, 7); g.fill()
      for (let k = 0; k < 9; k++) {
        const x = k * 30, hh = 70 + ((k * 37) % 80)
        g.fillStyle = '#0a0a18'; g.fillRect(x, 256 - hh, 28, hh)
        g.fillStyle = '#ffd31a'
        for (let j = 0; j < 6; j++) if ((k + j) % 3) g.fillRect(x + 6 + (j % 2) * 10, 256 - hh + 10 + Math.floor(j / 2) * 18, 5, 7)
      }
    })
  })
}

// La etiqueta de la caja de cerillos: roja con un corazón, como de lotería.
function etiquetaCerillos() {
  return lienzo(512, 340, (g, w, h) => {
    g.fillStyle = '#d4202a'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#f6e7c4'
    g.lineWidth = 14
    g.strokeRect(18, 18, w - 36, h - 36)
    g.lineWidth = 4
    g.strokeRect(36, 36, w - 72, h - 72)
    const cx = w / 2, cy = h / 2 + 8
    g.strokeStyle = '#ffd31a'
    g.lineWidth = 6
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      g.beginPath(); g.moveTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92); g.lineTo(cx + Math.cos(a) * 124, cy + Math.sin(a) * 124); g.stroke()
    }
    g.fillStyle = '#f6e7c4'
    g.beginPath()
    g.moveTo(cx, cy + 70)
    g.bezierCurveTo(cx - 120, cy - 10, cx - 60, cy - 100, cx, cy - 46)
    g.bezierCurveTo(cx + 60, cy - 100, cx + 120, cy - 10, cx, cy + 70)
    g.fill()
  })
}

// Los pads del teclado: una celda de color por pad (u de 0 a 1 en 8 partes).
function padsTeclado() {
  return lienzo(256, 8, (g) => {
    PADS.forEach((c, k) => { g.fillStyle = c; g.fillRect(k * 32, 0, 32, 8) })
  })
}

// ---------------------------------------------------------------- materiales y contorno

function materialToon(params) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...params })
  applyToonBanding(m, { steps: 3, minBand: 0.32, bandIndirect: true })
  return m
}

function materialContorno(grosor) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: false, toneMapped: false })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uContorno = grosor
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 normalSuave;\nuniform float uContorno;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalSuave;')
      .replace('#include <project_vertex>', glslContorno({ normalSinPiel: 'normalSuave' }))
  }
  m.customProgramCacheKey = () => 'contornoOfrenda'
  return m
}

// Normales promediadas por posición: con las partidas de las aristas el hull se abre en las esquinas.
function normalesSuaves(geo) {
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  const n = pos.count
  const grupos = new Map()
  const idx = new Int32Array(n)
  const suma = []
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)}|${Math.round(pos.getY(i) * 1e4)}|${Math.round(pos.getZ(i) * 1e4)}`
    let gi = grupos.get(k)
    if (gi === undefined) { gi = suma.length / 3; grupos.set(k, gi); suma.push(0, 0, 0) }
    idx[i] = gi
    suma[gi * 3] += nor.getX(i); suma[gi * 3 + 1] += nor.getY(i); suma[gi * 3 + 2] += nor.getZ(i)
  }
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const gi = idx[i]
    const x = suma[gi * 3], y = suma[gi * 3 + 1], z = suma[gi * 3 + 2]
    const l = Math.hypot(x, y, z) || 1
    out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l
  }
  geo.setAttribute('normalSuave', new THREE.BufferAttribute(out, 3))
}

function sombra() {
  return lienzo(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64)
    gr.addColorStop(0, 'rgba(0,0,0,0.55)')
    gr.addColorStop(0.6, 'rgba(0,0,0,0.25)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 128, 128)
  })
}

export function armar(gltf) {
  const tex = { pantalla: pantallaIpad(), fotos: fotosAlbum(), etiqueta: etiquetaCerillos(), pads: padsTeclado(), sombra: sombra() }
  tex.pads.magFilter = THREE.NearestFilter
  // cada objeto con sus materiales (la luz de su rayo no debe prender otro objeto); mismos programas
  const mats = new Map()
  const materialDe = (id, nombre) => {
    const llave = `${id}|${nombre}`
    if (mats.has(llave)) return mats.get(llave)
    let m
    if (nombre === 'Ipad_Pantalla') m = materialToon({ map: tex.pantalla, emissive: '#ffffff', emissiveMap: tex.pantalla, emissiveIntensity: 0.55 })
    else if (nombre === 'Album_Fotos') m = materialToon({ map: tex.fotos })
    else if (nombre === 'Cerillos_Etiqueta') m = materialToon({ map: tex.etiqueta })
    else if (nombre === 'Teclado_Pads') m = materialToon({ map: tex.pads, emissive: '#ffffff', emissiveMap: tex.pads, emissiveIntensity: 0.9 })
    else if (nombre === 'Teclado_Pantalla') m = materialToon({ color: '#4ec9ff', emissive: '#4ec9ff', emissiveIntensity: 1.1 })
    else m = materialToon({ color: COLOR[nombre] || '#cccccc' })
    m.name = nombre
    // lo que ya brilla solo se queda; a lo demás lo alumbra el rayo con su propio color
    m.userData.brillaSolo = m.emissiveIntensity > 0 && !!m.emissiveMap || nombre === 'Teclado_Pantalla'
    m.userData.colorBase = m.color.clone()
    mats.set(llave, m)
    return m
  }
  const objetos = {}
  const sombraGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const sombraMat = new THREE.MeshBasicMaterial({ map: tex.sombra, transparent: true, depthWrite: false, toneMapped: false })
  gltf.scene.updateMatrixWorld(true)
  for (const o of gltf.scene.children) {
    if (!o.name?.startsWith('Ofrenda_')) continue
    const id = o.name.slice(8)
    const raiz = new THREE.Group()
    raiz.name = `ofrenda_${id}`
    const cuerpo = new THREE.Group()
    raiz.add(cuerpo)
    const geos = []
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert()
    o.traverse((m) => {
      if (!m.isMesh) return
      const g = m.geometry.clone()
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
      const malla = new THREE.Mesh(g, materialDe(id, m.material?.name))
      malla.frustumCulled = false
      cuerpo.add(malla)
      const solo = new THREE.BufferGeometry()
      solo.setAttribute('position', g.attributes.position.clone())
      solo.setAttribute('normal', g.attributes.normal.clone())
      if (g.index) solo.setIndex(g.index.clone())
      geos.push(solo)
    })
    const unida = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    normalesSuaves(unida)
    const grosor = crearUniformContorno()
    const hull = new THREE.Mesh(unida, materialContorno(grosor))
    hull.frustumCulled = false
    hull.renderOrder = -1
    cuerpo.add(hull)
    unida.computeBoundingBox()
    const caja = unida.boundingBox
    const tam = caja.getSize(new THREE.Vector3())
    const esc = ESCALA[id] || 4
    cuerpo.scale.setScalar(esc * NADA)
    const sombraM = new THREE.Mesh(sombraGeo, sombraMat)
    sombraM.scale.set(tam.x * esc * 1.35, 1, tam.z * esc * 1.35)
    sombraM.position.y = 0.012
    sombraM.renderOrder = -2
    raiz.add(sombraM)
    const lugar = id === CAMA.id ? CAMA : LUGARES.find((l) => l.id === id)?.mesa
    if (lugar) {
      raiz.position.set(lugar.x, 0, lugar.z)
      raiz.rotation.y = lugar.rot || 0
    }
    // la copia que carga: girando sobre su centro
    const carga = new THREE.Group()
    carga.name = `ofrenda_${id}_carga`
    const cargaCuerpo = new THREE.Group()
    cargaCuerpo.position.copy(caja.getCenter(new THREE.Vector3())).multiplyScalar(-1)
    carga.add(cargaCuerpo)
    for (const m of cuerpo.children) {
      if (m === hull) continue
      const c = new THREE.Mesh(m.geometry, m.material)
      c.frustumCulled = false
      cargaCuerpo.add(c)
    }
    const grosorCarga = crearUniformContorno()
    const hullCarga = new THREE.Mesh(unida, materialContorno(grosorCarga))
    hullCarga.frustumCulled = false
    hullCarga.renderOrder = -1
    cargaCuerpo.add(hullCarga)
    const escCarga = CARGA.tam / Math.max(tam.x, tam.y, tam.z)
    carga.scale.setScalar(escCarga * NADA)
    carga.position.copy(raiz.position)
    objetos[id] = {
      id, raiz, cuerpo, sombra: sombraM, grosor, esc, alto: tam.y * esc, lugar,
      mats: [...new Set(cuerpo.children.map((m) => m.material).filter((m) => m.isMeshStandardMaterial))],
      estado: null, t: 0, luz: 0,
      carga, grosorCarga, escCarga, cargaT: 0, cargaPos: new THREE.Vector3().copy(raiz.position), sube: -1, enMano: null,
      centro: caja.getCenter(new THREE.Vector3()), tamMax: Math.max(tam.x, tam.y, tam.z),
      p0: new THREE.Vector3(), p1: new THREE.Vector3(), q0: new THREE.Quaternion(), q1: new THREE.Quaternion(), s0: 0,
    }
  }
  return { objetos, tex, mats, sombraGeo, sombraMat }
}

const _c = new THREE.Vector3()
const _m = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _qy = new THREE.Quaternion()
const _y = new THREE.Vector3(0, 1, 0)

export default function ObjetosOfrenda({ playerRef, activo = true, mostrarCarga = true }) {
  const gltf = useGLTF(URL, true)
  const armado = useMemo(() => armar(gltf), [gltf])

  useEffect(() => {
    // sólido desde que empieza a caer: Skulley no puede meterse donde va a quedar
    const solidos = () => setObstaculosExtra('ofrenda', Object.values(armado.objetos)
      .filter((o) => SOLIDO[o.id] && (o.estado === 'puesto' || o.estado === 'cae'))
      .map((o) => ({ x: o.raiz.position.x, z: o.raiz.position.z, r: SOLIDO[o.id] })))
    armado.solidos = solidos
    if (import.meta.env.DEV) window.__objetosOfrenda = armado
    return () => {
      setObstaculosExtra('ofrenda', [])
      Object.values(armado.tex).forEach((t) => t.dispose())
      armado.mats.forEach((m) => m.dispose())
      armado.sombraGeo.dispose()
      armado.sombraMat.dispose()
      for (const o of Object.values(armado.objetos)) {
        o.cuerpo.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); if (!m.material.isMeshStandardMaterial) m.material.dispose() } })
        o.carga.traverse((m) => { if (m.isMesh && !m.material.isMeshStandardMaterial) m.material.dispose() })
      }
    }
  }, [armado])

  useFrame((state, dtReal) => {
    const dt = Math.min(dtReal, 1 / 20)
    armado.t = (armado.t || 0) + dt
    const T = armado.t
    const p = playerRef?.current?.position
    const cerca = Boolean(p && Math.hypot(p.x - CENTRO[0], p.z - CENTRO[1]) < CERCA)
    const mano = activo ? ofrendasEnMano() : []
    const ver = Boolean(activo && mostrarCarga && p)
    const primera = !armado.listo
    armado.listo = true
    const dpr = state.gl.getPixelRatio()
    let cambio = false
    for (const o of Object.values(armado.objetos)) {
      // ---- la que carga
      const enM = mano.includes(o.id)
      if (CARGA.cabeza && enM && o.enMano === false && !primera) { try { playSfx('magiaInicia', { volume: 0.8 }) } catch { /* sin audio */ } }
      o.enMano = enM
      // llegó a la orilla de su corona: vuela a su lugar y cae con el rayo
      if (enM && ver && o.lugar && o.sube < 0 && (o.cargaT > 0.5 || !CARGA.cabeza)) {
        const d = Math.hypot(p.x - o.lugar.x, p.z - o.lugar.z)
        // en cualquier orden: la que cierre la ofrenda, sea cual sea, arranca el final (Oscar, 2026-11-26; antes
        // la almohada solo se ponía con las otras cinco)
        if (d < (o.id === CAMA.id ? CARGA.radioCama : CARGA.radio) && ponerOfrenda(o.id)) {
          // vuela de donde va hasta la pose con que el puesto empieza a caer: un solo objeto
          o.sube = 0
          if (CARGA.cabeza) {
            o.p0.copy(o.carga.position)
            o.q0.copy(o.carga.quaternion)
            o.s0 = o.carga.scale.x
          } else {
            // sale de Skulley, chiquito, y crece en el vuelo
            o.p0.set(p.x, p.y + CARGA.salida, p.z)
            o.q0.identity()
            o.s0 = 0
          }
          o.q1.setFromAxisAngle(_y, o.raiz.rotation.y)
          o.p1.copy(o.centro).multiplyScalar(o.esc).applyQuaternion(o.q1)
          o.p1.x += o.raiz.position.x
          o.p1.y += CAE.alto
          o.p1.z += o.raiz.position.z
          sonarOfrendaVuela(CAE.espera)
        }
      }
      let escala = 0
      const i = o.cargaI || 0
      if (o.sube >= 0) {
        // en arco, creciendo a su tamaño y girando a su lugar en lo que espera el rayo (CAE.espera)
        o.sube += dt
        const u = Math.min(1, o.sube / CAE.espera)
        const e = u * u * (3 - 2 * u)
        o.carga.position.lerpVectors(o.p0, o.p1, e)
        o.carga.position.y += Math.sin(Math.PI * u) * CARGA.arco
        _q.slerpQuaternions(o.q0, o.q1, e)
        _qy.setFromAxisAngle(_y, TAU * e)
        o.carga.quaternion.multiplyQuaternions(_qy, _q)
        escala = o.s0 + (o.esc - o.s0) * e
        if (u >= 1) { o.sube = -1; o.cargaT = 0; escala = 0 }
      } else if (p) {
        const meta = enM && ver && CARGA.cabeza ? 1 : 0
        const aparece = meta && o.cargaT === 0
        o.cargaT = meta ? Math.min(1, o.cargaT + dt / CARGA.entra) : Math.max(0, o.cargaT - dt / CARGA.sale)
        if (enM) {
          const n = mano.length
          o.cargaI = mano.indexOf(o.id)
          const ang = T * CARGA.vueltas + (o.cargaI / n) * TAU
          const r = n > 1 ? CARGA.separa + 0.14 * n : 0
          _m.set(p.x + Math.cos(ang) * r, p.y + CARGA.alto + 0.09 * Math.sin(T * 2.1 + o.cargaI * 1.7), p.z + Math.sin(ang) * r)
          if (aparece) o.cargaPos.copy(_m)
          else o.cargaPos.lerp(_m, 1 - Math.exp(-CARGA.sigue * dt))
        }
        const f = o.cargaT >= 1 ? 1 : meta ? rebotaFuera(o.cargaT) : o.cargaT
        escala = o.escCarga * f
        if (f > 0) {
          o.carga.position.copy(o.cargaPos)
          o.carga.rotation.set(0.22 * Math.sin(T * 1.3 + i), T * 0.9 + i * 1.3, 0.12 * Math.sin(T * 1.7 + i))
        }
      }
      if (escala > 0) medirContorno(o.grosorCarga, state.camera, state.size, dpr, o.carga.position, Math.max(0.3, o.tamMax * escala))
      o.carga.scale.setScalar(Math.max(o.escCarga * NADA, escala))

      // ---- la puesta
      const puesta = activo && ofrendaPuesta(o.id)
      // primera vez: lo que ya estaba puesto aparece puesto, sin caer
      if (o.estado === null) { o.estado = puesta ? 'puesto' : 'fuera'; o.t = puesta ? 9 : 0; cambio = cambio || puesta }
      else if (puesta && o.estado === 'fuera') { o.estado = 'cae'; o.t = 0; cambio = true }
      else if (!puesta && o.estado !== 'fuera') { o.estado = 'fuera'; cambio = true }
      if (o.estado === 'cae') {
        const antes = o.t
        o.t += dt
        // toca el piso: su golpe y el estallido naranja (PortalBurst de HomeOrbs, ya montado) con un
        // temblor chico (Oscar, 2026-11-26: "un sonido de cuando lo pones en su lugar y un visual")
        const toca = CAE.espera + CAE.dura
        if (antes < toca && o.t >= toca) {
          sonarOfrendaPuesta()
          try {
            window.dispatchEvent(new CustomEvent('estallido-piso', { detail: { x: o.raiz.position.x, z: o.raiz.position.z, ...PUESTA } }))
            window.dispatchEvent(new CustomEvent('camera-temblor', { detail: { fuerza: PUESTA.temblor } }))
          } catch { /* sin window */ }
        }
        if (o.t >= CAE.espera + CAE.dura + 0.5) o.estado = 'puesto'
      }
      // la luz: la del rayo ya puesto, o un poco mientras la carga (comparten materiales)
      const metaLuz = o.estado !== 'fuera' ? 1 : escala > 0 ? CARGA.luz : 0
      if (Math.abs(metaLuz - o.luz) > 1e-3) {
        o.luz += (metaLuz - o.luz) * (1 - Math.exp(-3 * dt))
        for (const m of o.mats) {
          if (m.userData.brillaSolo) continue
          m.emissive.copy(m.userData.colorBase).multiplyScalar(CAE.luz * o.luz)
        }
      }
      if (!cerca && o.estado !== 'cae') continue
      // la caída: espera a que prenda el rayo, baja acelerando y se asienta con un rebote (aplastado al tocar)
      let alto = 0, esc = o.esc, aplasta = 1
      if (o.estado === 'fuera') esc = o.esc * NADA
      else if (o.estado === 'cae') {
        const u = Math.max(0, (o.t - CAE.espera) / CAE.dura)
        if (u <= 0) esc = o.esc * NADA
        else if (u < 1) alto = CAE.alto * (1 - u * u)
        else {
          const r = Math.min(1, (u - 1) * CAE.dura / 0.5)
          alto = CAE.alto * CAE.rebote * Math.sin(Math.PI * Math.min(1, r * 1.6)) * (r < 0.62 ? 1 : 0)
          aplasta = 1 - 0.18 * Math.exp(-r * 6) * Math.cos(r * 18)
        }
      }
      // la cabeza de Skulley dormido en la cinemática del final (lib/cinematicaOfrenda.js) aplasta la almohada:
      // baja y apenas se ensancha, y entra y sale suave (inflándose 42 % de golpe parecía que se movía; Oscar)
      let sxz = 2 - aplasta, sy = aplasta
      if (o.id === CAMA.id) {
        o.aplastaS = (o.aplastaS || 0) + (cine.aplasta - (o.aplastaS || 0)) * (1 - Math.exp(-5 * dt))
        if (o.aplastaS > 1e-3) { sy *= 1 - 0.25 * o.aplastaS; sxz *= 1 + 0.06 * o.aplastaS }
      }
      o.cuerpo.position.y = alto
      o.cuerpo.scale.set(esc * sxz, esc * sy, esc * sxz)
      o.sombra.scale.y = 1
      o.sombra.visible = o.estado !== 'fuera' && !(o.estado === 'cae' && o.t < CAE.espera)
      o.sombra.material.opacity = 1
      // el contorno: su grosor con lo que se ve de alto
      if (o.estado !== 'fuera') {
        o.raiz.getWorldPosition(_c)
        _c.y += o.alto * 0.5
        medirContorno(o.grosor, state.camera, state.size, dpr, _c, Math.max(o.alto, 0.6))
      }
    }
    if (cambio) armado.solidos?.()
  })

  // la almohada, con la ofrenda completa y el final ya visto: picarla lo vuelve a dormir y repite el final
  const { gl } = useThree()
  // Desde cualquier distancia: en el primer corte la cinemática lo pone junto a la cama (`cine.salta`), así que
  // ya no cruza el portal caminando; con la distancia, las Zzz se veían desde la plaza y el clic no hacía nada
  // (Oscar, 2026-11-26). Dormido en su propia siesta no: la cinemática lo acuesta ella (ahí tampoco salen las Zzz).
  const almohadaLista = () => activo && !cine.activo && nivelOfrenda() >= TOTAL_OFRENDAS && finalVisto()
    && !['entra', 'dormido', 'sale'].includes(siesta.estado)
  const picarAlmohada = (ev) => {
    if (!almohadaLista()) return
    ev.stopPropagation()
    try { gl.domElement.style.cursor = '' } catch { }
    try { window.dispatchEvent(new CustomEvent(EVENTO_REPETIR)) } catch { }
  }
  const sobreAlmohada = (ev) => {
    if (!almohadaLista()) return
    ev.stopPropagation()
    try { gl.domElement.style.cursor = 'pointer' } catch { }
  }
  const fueraAlmohada = () => { try { gl.domElement.style.cursor = '' } catch { } }

  return (
    <group name="objetos-ofrenda">
      {Object.values(armado.objetos).map((o) => (o.id === CAMA.id
        ? <primitive key={o.id} object={o.raiz} onClick={picarAlmohada} onPointerOver={sobreAlmohada} onPointerOut={fueraAlmohada} />
        : <primitive key={o.id} object={o.raiz} />))}
      {Object.values(armado.objetos).map((o) => <primitive key={`${o.id}-carga`} object={o.carga} />)}
      <ZzzAlmohada activo={activo} onPicar={picarAlmohada} onSobre={sobreAlmohada} onFuera={fueraAlmohada} />
    </group>
  )
}

// Las "Zzz" sobre la almohada (Oscar, 2026-11-26: "un indicador en la almohada para que los players sepan que
// pueden repetir la cinemática"): tres zetas de barras en 3D, en el amarillo del sitio y con contorno de tinta,
// que suben meciéndose y respiran. Salen con la ofrenda completa, el final ya visto y fuera de la cinemática
// (también desde lejos: se ven desde la plaza); picarlas es como picar la almohada. Montadas siempre: ocultas
// se encogen a casi nada (como los objetos), así no compilan al aparecer.
const ZZZ = {
  alto: 1.05,            // la primera, sobre la almohada
  zetas: [{ tam: 0.42, dx: -0.55, dy: 0.0 }, { tam: 0.55, dx: 0.0, dy: 0.65 }, { tam: 0.72, dx: 0.62, dy: 1.45 }],
  grueso: 0.075,         // grosor de cada barra
  fondo: 0.07,
  tinta: 0.035,          // lo que sobresale el contorno
  color: '#f5ff00',
  entra: 0.6,            // s en aparecer / irse
}
function ZzzAlmohada({ activo, onPicar, onSobre, onFuera }) {
  const recursos = useMemo(() => {
    const barra = new THREE.BoxGeometry(1, 1, 1)
    const amarillo = new THREE.MeshBasicMaterial({ color: ZZZ.color, toneMapped: false })
    const tinta = new THREE.MeshBasicMaterial({ color: '#0a0510', side: THREE.BackSide })
    return { barra, amarillo, tinta }
  }, [])
  useEffect(() => () => { recursos.barra.dispose(); recursos.amarillo.dispose(); recursos.tinta.dispose() }, [recursos])
  const grupo = React.useRef(null)
  const zetas = React.useRef([])
  const est = React.useRef({ k: 0, t: 0 })

  useFrame((state, delta) => {
    const g = grupo.current
    if (!g) return
    const dt = Math.min(delta, 0.1)
    const e = est.current
    e.t += dt
    // voltea hacia la cámara solo de lado (de espaldas se leían al revés); siguen siendo barras en 3D
    const c = state.camera.position
    g.rotation.y = Math.atan2(c.x - g.position.x, c.z - g.position.z)
    const meta = activo && !cine.activo && nivelOfrenda() >= TOTAL_OFRENDAS && finalVisto() && ofrendaPuesta(CAMA.id)
      && !['entra', 'dormido', 'sale'].includes(siesta.estado) ? 1 : 0
    e.k = meta ? Math.min(1, e.k + dt / ZZZ.entra) : Math.max(0, e.k - dt / ZZZ.entra)
    const s = e.k <= 0 ? NADA : e.k * e.k * (3 - 2 * e.k)
    g.scale.setScalar(Math.max(NADA, s))
    zetas.current.forEach((z, i) => {
      if (!z) return
      const f = e.t * 1.6 - i * 0.7
      z.position.y = ZZZ.zetas[i].dy + Math.sin(f) * 0.06
      z.rotation.y = Math.sin(e.t * 0.7 + i) * 0.35
      z.rotation.z = Math.sin(f * 0.8) * 0.12
      z.scale.setScalar(ZZZ.zetas[i].tam * (1 + 0.08 * Math.sin(f * 1.3)))
    })
  })

  // una zeta de lado 1: barra de arriba, de abajo y la diagonal, cada una con su contorno
  const g = ZZZ.grueso, d = ZZZ.fondo, ti = ZZZ.tinta
  const diag = Math.hypot(1, 1 - g)
  const barras = [
    { p: [0, 0.5 - g / 2, 0], r: 0, l: 1 },
    { p: [0, -0.5 + g / 2, 0], r: 0, l: 1 },
    { p: [0, 0, 0], r: Math.atan2(1 - g, 1), l: diag },
  ]
  return (
    <group ref={grupo} position={[CAMA.x, ZZZ.alto, CAMA.z]} scale={NADA}
      onClick={onPicar} onPointerOver={onSobre} onPointerOut={onFuera}>
      {ZZZ.zetas.map((zt, i) => (
        <group key={i} ref={(el) => { zetas.current[i] = el }} position={[zt.dx, zt.dy, 0]} scale={zt.tam}>
          {barras.map((b, j) => (
            <group key={j} position={b.p} rotation-z={b.r}>
              <mesh geometry={recursos.barra} material={recursos.tinta} scale={[b.l + ti * 2, g + ti * 2, d + ti * 2]} frustumCulled={false} renderOrder={1} />
              <mesh geometry={recursos.barra} material={recursos.amarillo} scale={[b.l, g, d]} frustumCulled={false} renderOrder={2} />
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

useGLTF.preload(URL, true)
