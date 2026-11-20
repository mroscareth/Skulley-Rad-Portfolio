import * as THREE from 'three'
import { RUNE_FONT_FAMILY_BOLD } from '../../lib/installRuneFont.js'

// El "reloj" de Argus (Oscar, 2026-11-19): Argus no trae reloj, así que en el idle
// impaciente su muñequera proyecta un holograma con la hora real (la del
// visitante) escrita en SKULLEYGLYPH. Flota sobre la muñeca con un haz de luz
// desde la muñequera; prende como tele vieja, falla mientras sacude la muñeca y
// se apaga en una raya al bajar el brazo.
//
// La pantalla va anclada en el mundo cada cuadro (sigue a la muñeca; no va pegada
// al cuadro) y ve al frente de Argus, un poco hacia arriba: viendo hacia sus
// ojos, la cámara del juego la veía de canto. Se lee de los dos lados (por
// detrás el shader voltea el texto), así que Argus también la lee.
// Montado desde el inicio con brillo 0: su programa entra al warm-up.

const COLOR = new THREE.Color(0.25, 0.95, 1.0)
const TEX_W = 256
const TEX_H = 96

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const FRAG_PANTALLA = /* glsl */`
uniform sampler2D uTexto;
uniform vec3 uColor;
uniform float uTiempo;
uniform float uBrillo;
uniform float uEncendido;
uniform float uFalla;
varying vec2 vUv;
float hashH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  if (uBrillo <= 0.0) discard;
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
  // encendido de tele vieja: primero una raya, luego se abre a lo alto
  float sy = smoothstep(0.0, 0.6, uEncendido);
  float sx = smoothstep(0.0, 0.25, uEncendido) * 0.9 + 0.1;
  vec2 q = (uv - 0.5) / vec2(sx, max(sy, 0.04)) + 0.5;
  // falla: franjas que brincan de lado
  float franja = floor(q.y * 7.0);
  float tf = floor(uTiempo * 30.0);
  q.x += step(0.6, hashH(vec2(franja, tf))) * (hashH(vec2(franja, tf + 3.0)) - 0.5) * 0.25 * uFalla;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) discard;
  float texto = texture2D(uTexto, q).a;
  // marco fino con esquinas, y un velo tenue de fondo
  vec2 b = min(q, 1.0 - q);
  float px = fwidth(q.x) * 1.5;
  float marco = 1.0 - smoothstep(0.0, px, abs(min(b.x * 2.6, b.y) - 0.035));
  float esquina = step(min(b.x, b.y), 0.05) * step(max(b.x, b.y), 0.16);
  float velo = 0.16 + 0.06 * sin(q.y * 3.1416);
  float scan = 0.72 + 0.28 * sin((q.y * 38.0 - uTiempo * 6.0) * 3.1416);
  float titila = 0.88 + 0.12 * hashH(vec2(tf, 1.0));
  float a = max(texto, max(marco * 0.7, esquina * 0.9));
  a = max(a, velo) * scan * titila;
  // raya brillante mientras enciende
  a += (1.0 - smoothstep(0.0, 0.5, uEncendido)) * (1.0 - smoothstep(0.0, 0.06, abs(uv.y - 0.5))) * step(0.02, uEncendido);
  gl_FragColor = vec4(uColor * (0.7 + 0.8 * texto), clamp(a * uBrillo, 0.0, 1.0));
}
`
const FRAG_HAZ = /* glsl */`
uniform vec3 uColor;
uniform float uTiempo;
uniform float uBrillo;
varying vec2 vUv;
void main() {
  if (uBrillo <= 0.0) discard;
  // vUv.y: 0 en la muñequera, 1 en la pantalla
  float a = (0.10 + 0.22 * vUv.y) * (0.85 + 0.15 * sin(vUv.y * 40.0 - uTiempo * 9.0));
  gl_FragColor = vec4(uColor, a * uBrillo);
}
`

// La hora llena la pantalla: los números de las runas son mayas (gotas y barras)
// y a tamaño fijo quedaban en menos de la mitad del ancho.
function dibujarHora(ctx, texto) {
  ctx.clearRect(0, 0, TEX_W, TEX_H)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 64px ${RUNE_FONT_FAMILY_BOLD}`
  const ancho = Math.max(1, ctx.measureText(texto).width)
  const px = Math.min(TEX_H * 1.15, 64 * (TEX_W * 0.8) / ancho)
  ctx.font = `700 ${px.toFixed(1)}px ${RUNE_FONT_FAMILY_BOLD}`
  ctx.shadowColor = 'rgba(255,255,255,0.9)'
  ctx.shadowBlur = 8
  ctx.fillText(texto, TEX_W / 2, TEX_H / 2 + px * 0.06)
}

function horaActual() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Haz de luz: una pirámide de la muñequera a las cuatro esquinas de la pantalla.
// Sus vértices van en el mundo y se rehacen cada cuadro (12 vértices).
function geometriaHaz() {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(36), 3))
  const uv = []
  for (let i = 0; i < 4; i += 1) uv.push(0.5, 0, 0, 1, 1, 1)
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return g
}

const _c = new THREE.Vector3()
const _n = new THREE.Vector3()
const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _a = new THREE.Vector3()
const _e = new THREE.Vector3()
const ARRIBA = new THREE.Vector3(0, 1, 0)
const ESQ = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]

export function crearRelojHolograma() {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  let ctx = null
  const textura = new THREE.CanvasTexture(canvas || undefined)
  if (canvas) {
    canvas.width = TEX_W
    canvas.height = TEX_H
    ctx = canvas.getContext('2d')
    textura.colorSpace = THREE.NoColorSpace
    textura.generateMipmaps = false
    textura.minFilter = THREE.LinearFilter
  }
  let hora = ''
  const pintar = () => {
    if (!ctx) return
    hora = horaActual()
    dibujarHora(ctx, hora)
    textura.needsUpdate = true
  }
  pintar()
  // la fuente de las runas puede llegar después: se repinta cuando cargue
  try { document.fonts?.load(`700 64px ${RUNE_FONT_FAMILY_BOLD}`, '0123456789:').then(pintar, () => {}) } catch { }

  const uniforms = {
    uTexto: { value: textura },
    uColor: { value: COLOR.clone().multiplyScalar(1.4) },
    uTiempo: { value: 0 },
    uBrillo: { value: 0 },
    uEncendido: { value: 0 },
    uFalla: { value: 0 },
  }
  const comun = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }
  const matPantalla = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG_PANTALLA, ...comun })
  const matHaz = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG_HAZ, ...comun })
  // transparentes de los dos lados en una sola pasada (si no, three los dibuja dos veces)
  matPantalla.forceSinglePass = true
  matHaz.forceSinglePass = true
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matPantalla)
  const haz = new THREE.Mesh(geometriaHaz(), matHaz)
  const grupo = new THREE.Group()
  for (const m of [pantalla, haz]) {
    m.frustumCulled = false
    m.matrixAutoUpdate = false
    m.matrixWorldAutoUpdate = false
    m.raycast = () => { }
    m.renderOrder = 5
    grupo.add(m)
  }

  return {
    grupo,
    // muneca y frente (hacia donde ve Argus) en el mundo; ancho de la pantalla en
    // unidades del mundo; brillo 0..1, encendido 0..1 (la raya que se abre), falla 0..1.
    // La pantalla flota enfrente de la muñeca, inclinada hacia arriba y viendo al
    // frente (a la cámara del juego); Argus la lee por detrás (el shader voltea el
    // texto de ese lado).
    // `mano`: puntos de la mano en el mundo (muñeca y coyunturas de los dedos); la
    // pantalla queda arriba y adelante de todos, con margen, así nunca se empalma
    // con la mano ni se mete en ella (Oscar).
    actualizar(dt, { muneca, frente, mano = [], margen = 0, ancho, brillo, encendido, falla }) {
      uniforms.uTiempo.value += dt
      uniforms.uBrillo.value = brillo
      uniforms.uEncendido.value = encendido
      uniforms.uFalla.value = falla
      if (brillo <= 0) return
      if (horaActual() !== hora) pintar()
      const alto = ancho * (TEX_H / TEX_W) * 1.15
      _n.copy(frente).setY(0).normalize().multiplyScalar(0.8).addScaledVector(ARRIBA, 0.6).normalize()
      _x.crossVectors(ARRIBA, _n).normalize()
      _y.crossVectors(_n, _x).normalize()
      // enfrente de la muñeca (encima le tapaba la cara: la muñeca queda abajo de la
      // barbilla), pero siempre más arriba y más adelante que toda la mano
      let arriba = -Infinity
      let adelante = -Infinity
      for (const p of mano) {
        _e.copy(p).sub(muneca)
        arriba = Math.max(arriba, _e.y)
        adelante = Math.max(adelante, _e.dot(frente))
      }
      if (!mano.length) { arriba = 0; adelante = 0 }
      // la orilla de abajo de la pantalla (inclinada) baja |y.y|·alto/2 del centro y
      // avanza lo que la inclinación la echa hacia adelante
      const bajaOrilla = 0.5 * alto * Math.abs(_y.y)
      const avanzaOrilla = 0.5 * alto * Math.max(0, -_y.dot(frente))
      const sube = Math.max(alto * 0.05, arriba + margen + bajaOrilla)
      const avanza = Math.max(ancho * 0.42, adelante + margen + avanzaOrilla)
      _c.copy(muneca).addScaledVector(frente, avanza).addScaledVector(ARRIBA, sube)
      pantalla.matrixWorld.makeBasis(_a.copy(_x).multiplyScalar(ancho), _e.copy(_y).multiplyScalar(alto), _n).setPosition(_c)
      // el haz: de la muñequera (un poco arriba de la muñeca) a las esquinas
      const pos = haz.geometry.attributes.position
      _a.copy(muneca).addScaledVector(ARRIBA, ancho * 0.05)
      for (let i = 0; i < 4; i += 1) {
        const [x0, y0] = ESQ[i]
        const [x1, y1] = ESQ[(i + 1) % 4]
        pos.setXYZ(i * 3, _a.x, _a.y, _a.z)
        _e.copy(_c).addScaledVector(_x, x0 * ancho).addScaledVector(_y, y0 * alto)
        pos.setXYZ(i * 3 + 1, _e.x, _e.y, _e.z)
        _e.copy(_c).addScaledVector(_x, x1 * ancho).addScaledVector(_y, y1 * alto)
        pos.setXYZ(i * 3 + 2, _e.x, _e.y, _e.z)
      }
      pos.needsUpdate = true
    },
    dispose() {
      textura.dispose()
      matPantalla.dispose()
      matHaz.dispose()
      pantalla.geometry.dispose()
      haz.geometry.dispose()
    },
  }
}
