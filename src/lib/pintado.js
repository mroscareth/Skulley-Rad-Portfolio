import * as THREE from 'three'
import { applyToonBanding } from './toonBanding.js'
import { crearUniformContorno, medirContorno, glslContorno } from './contornoPantalla.js'

// El estilo pintado a mano con el toon del sitio (Oscar, 2026-11-24: "todo debe ser
// con el look toon… es una mezcla hermosa"; features.md, La ofrenda -> El estilo
// gráfico). La textura pintada en Blender (degradado, desgaste, vetas, óxido) va
// debajo de las bandas de luz de Skulley y todo lleva el contorno de tinta medido
// en pantalla. Un solo programa para todos los objetos: cambiar de textura no
// compila. Lo usan los objetos del bosque nuevo (la prueba: components/estilo).

export const BANDAS_PINTADO = { steps: 3, minBand: 0.32, bandIndirect: true }

export function crearMaterialPintado({ map, color = '#ffffff', ...resto } = {}) {
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace
    // de lado la textura no se embarra (no compila nada: es del muestreo)
    map.anisotropy = 8
  }
  const m = new THREE.MeshStandardMaterial({ map, color, roughness: 0.9, metalness: 0, ...resto })
  applyToonBanding(m, BANDAS_PINTADO)
  return m
}

// Normales promediadas por posición: con las aristas partidas el contorno se abre
// en las esquinas (los biseles parten muchas).
export function normalesSuaves(geo) {
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
  return geo
}

export function crearMaterialContorno(uniform) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: false, toneMapped: false })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uContorno = uniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 normalSuave;\nuniform float uContorno;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalSuave;')
      .replace('#include <project_vertex>', glslContorno({ normalSinPiel: 'normalSuave' }))
  }
  m.customProgramCacheKey = () => 'contornoPintado'
  return m
}

// Neón (Oscar, 2026-11-24: PESCA y el pez del puesto de Argus, ESCENARIO del foro, ESTUDIO).
// Los tubos son mallas aparte que se llaman `…_Neon_<Letrero>` o `…_Neon_<Letrero>_<n>`,
// con `n` el orden de lectura de cada letra. Brillan solos (sin luz ni bandas, con
// el color arriba del umbral del bloom) y parpadean con el reloj: un letrero prende
// letra por letra, se queda, flashea tres veces y se apaga; uno de una pieza prende
// y se apaga zumbando. Cambiar el brillo es un color: no compila.
export const NEON = {
  // colores bien saturados: prendido, el canal fuerte pasa de 1 y los demás no, así el tubo no se
  // lava (con un naranja claro el verde también pasaba de 1 y el pez salía amarillo)
  colores: { Pesca: '#2ff3e0', Pez: '#ff5a14', Escenario: '#ff3fb4', Estudio: '#f5ff00' },
  // prendido, la luminancia del color sube a esto: un poco arriba del umbral del bloom de la home
  // (0.86, PostFX), con cualquier color (con un multiplicador fijo el magenta y el naranja se quedaban abajo)
  brillo: 1.05,
  // apagado se ve el vidrio: su color lavado de gris y oscuro
  apagado: { gris: '#9aa3ad', lavado: 0.5, valor: 0.45 },
  letra: 0.22,
  quieto: 2.6,
  flash: 0.16,
  luego: 1.4,
  oscuro: 0.7,
}
// Luces fijas (Oscar, 2026-11-24: la Renderbox Nano del Estudio): mallas que se llaman `…_Luz<Nombre>`
// brillan solas con su color y no parpadean. `brillo` es la luminancia, como en el neón.
export const LUCES = {
  LuzBoton: { color: '#ffffff', brillo: 1.05 },
  LuzVentiladores: { color: '#3d7bff', brillo: 0.5 },
  // los ojos del señuelo de calaverita (grupo pesca): brillan tantito en lo hondo
  Luz: { color: '#7dfff0', brillo: 0.9 },
}

// `Prop_PuestoArgus_Neon_Pesca_3` (el letrero después de Neon) o `Prop_Escenario_Neon_4` (antes)
function leerNeon(nombre) {
  const m = nombre.match(/([A-Za-z]+)_Neon(?:_([A-Za-z]+))?(?:_(\d+))?$/)
  return m ? { letrero: m[2] || m[1], n: m[3] ? Number(m[3]) : 0 } : null
}

const azar = (x) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s) }

// Al prender, un tubo de neón tartamudea antes de quedarse.
function zumbido(t, semilla) {
  return azar(Math.floor(t * 34) + semilla * 7.1) > 0.45 ? 1 : 0
}

function brilloNeon(t, n, total, semilla) {
  const c = NEON
  if (total <= 1) {
    const ciclo = 1.5 + 0.45
    const p = (t + semilla * 0.37) % ciclo
    if (p > 1.5) return 0
    return p < 0.16 ? zumbido(p, semilla) : 1
  }
  const prende = total * c.letra
  const ciclo = prende + c.quieto + 6 * c.flash + c.luego + c.oscuro
  const p = t % ciclo
  if (p < prende) {
    const d = p - n * c.letra
    if (d < 0) return 0
    return d < 0.12 ? zumbido(d, semilla + n) : 1
  }
  let q = p - prende
  if (q < c.quieto) {
    // una letra cansada que a veces falla
    const vuelta = Math.floor(t / ciclo)
    const floja = Math.floor(azar(vuelta + semilla) * total)
    if (n === floja && q > 1.0 && q < 1.45) return zumbido(q, semilla + 3)
    return 1
  }
  q -= c.quieto
  if (q < 6 * c.flash) return Math.floor(q / c.flash) % 2 === 0 ? 0 : 1
  q -= 6 * c.flash
  if (q < c.luego) return 1
  return 0
}

/**
 * Arma un objeto pintado desde la escena de un GLB: cada malla con el material
 * pintado (su textura del GLB) y, encima, el contorno de toda la pieza unida.
 * Devuelve { grupo, contorno: { uniform, centro, alto }, medir(state) }.
 */
export function armarPintado(escenaGltf) {
  const grupo = new THREE.Group()
  escenaGltf.updateMatrixWorld(true)
  const piezas = []
  const neones = []
  const ventiladores = []
  const luces = []
  escenaGltf.traverse((o) => {
    if (!o.isMesh) return
    // lo que gira (los rotores de la Renderbox) se queda en su espacio, colgado de un pivote en su eje
    const gira = /_Ventilador_\d+$/.test(o.name)
    const g = gira ? o.geometry.clone() : o.geometry.clone().applyMatrix4(o.matrixWorld)
    const neon = leerNeon(o.name)
    const luz = LUCES[(o.name.match(/_(Luz[A-Za-z]*)$/) || [])[1]]
    let material
    if (luz) {
      const base = new THREE.Color(luz.color)
      const lum = 0.2126 * base.r + 0.7152 * base.g + 0.0722 * base.b
      material = new THREE.MeshBasicMaterial({ color: base.multiplyScalar(luz.brillo / Math.max(lum, 0.05)), toneMapped: false })
      luces.push({ material, prendido: material.color.clone(), nombre: o.name })
    } else if (neon) {
      const base = new THREE.Color(NEON.colores[neon.letrero] || '#ffffff')
      const a = NEON.apagado
      const apagado = base.clone().lerp(new THREE.Color(a.gris), a.lavado).multiplyScalar(a.valor)
      const lum = 0.2126 * base.r + 0.7152 * base.g + 0.0722 * base.b
      const prendido = base.clone().multiplyScalar(NEON.brillo / Math.max(lum, 0.05))
      material = new THREE.MeshBasicMaterial({ color: apagado.clone(), toneMapped: false })
      neones.push({ material, apagado, prendido, letrero: neon.letrero, n: neon.n, semilla: neones.length + 1 })
    } else {
      material = crearMaterialPintado({ map: o.material?.map || null, color: o.material?.map ? '#ffffff' : (o.material?.color || '#cccccc') })
    }
    const malla = new THREE.Mesh(g, material)
    if (gira) {
      // gira alrededor de su eje: la medida más chica del rotor (su grosor)
      g.computeBoundingBox()
      const s = g.boundingBox.getSize(new THREE.Vector3())
      const eje = s.x <= s.y && s.x <= s.z ? new THREE.Vector3(1, 0, 0) : s.y <= s.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
      const pivote = new THREE.Group()
      o.matrixWorld.decompose(pivote.position, pivote.quaternion, pivote.scale)
      pivote.add(malla)
      grupo.add(pivote)
      ventiladores.push({ malla, eje, nombre: o.name })
    } else {
      grupo.add(malla)
    }
    // si tapa a Skulley, el pase de normales de su tinta lo dibuja solo en profundidad antes que a él
    // (CharacterNormalPass): si no, las líneas del cuerpo salen encima del objeto
    malla.userData.ocluyeTinta = true
    // al contorno unido no entran lo que gira (su silueta se quedaría quieta) ni las luces de adentro
    if (!gira && !luz) piezas.push(g)
  })
  // el contorno: una malla con todas las posiciones y sus normales promediadas
  const unida = new THREE.BufferGeometry()
  const pos = [], nor = [], ind = []
  let base = 0
  for (const g of piezas) {
    const p = g.attributes.position, nn = g.attributes.normal
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(nn.getX(i), nn.getY(i), nn.getZ(i)) }
    if (g.index) for (let i = 0; i < g.index.count; i++) ind.push(g.index.getX(i) + base)
    else for (let i = 0; i < p.count; i++) ind.push(i + base)
    base += p.count
  }
  unida.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  unida.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  unida.setIndex(ind)
  normalesSuaves(unida)
  unida.computeBoundingBox()
  const uniform = crearUniformContorno()
  const hull = new THREE.Mesh(unida, crearMaterialContorno(uniform))
  hull.renderOrder = -1
  grupo.add(hull)
  const caja = unida.boundingBox
  const centroLocal = caja.getCenter(new THREE.Vector3())
  const altoLocal = caja.max.y - caja.min.y
  const _c = new THREE.Vector3()
  const _s = new THREE.Vector3()
  const letras = {}
  for (const n of neones) letras[n.letrero] = Math.max(letras[n.letrero] || 0, n.n + 1)
  for (const n of neones) n.total = letras[n.letrero]
  return {
    grupo, hull, neones, ventiladores, luces,
    medir(state) {
      grupo.updateWorldMatrix(true, false)
      _c.copy(centroLocal).applyMatrix4(grupo.matrixWorld)
      grupo.matrixWorld.decompose(_v0, _q0, _s)
      medirContorno(uniform, state.camera, state.size, state.viewport?.dpr || state.gl.getPixelRatio(), _c, Math.max(altoLocal * _s.y, 0.3))
      if (!neones.length) return
      const t = state.clock.elapsedTime
      for (const n of neones) {
        n.material.color.copy(n.apagado).lerp(n.prendido, brilloNeon(t, n.n, n.total, n.semilla))
      }
    },
  }
}

const _v0 = new THREE.Vector3()
const _q0 = new THREE.Quaternion()
