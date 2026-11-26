import * as THREE from 'three'

// El piso del home pintado a mano (Oscar, 2026-11-19): tierra en el mismo azul.
// La pintura es una textura en grises (`public/textures/piso-tierra.webp`, la
// pinta scripts/piso/pintar_tierra.py) que se reparte en hexágonos con un
// desfase al azar (hex-tiling de Mikkelsen, sin giro para que la luz de las
// piedras no cambie de lado), así que no se ve que se repite. El gris medio es
// el azul de siempre; lo de abajo lo oscurece un poco y lo de arriba lo acerca
// al blanco. Se aplica sobre lo que se ve: el azul del piso sale al tope
// (0, 0, 255) y multiplicar la luz no lo aclararía. Va encima del color del
// material, así que sigue al tinte de los portales y al rojo del easter egg.
// El desgaste (más claro) solo vive alrededor y adentro de los portales, por
// la erosión de tanto pisar (Oscar); su orilla la muerden la pintura y un ruido.
// Al centro, donde cae Skulley, una mancha de piedras planas (Oscar, como su
// referencia del camino empedrado): `public/textures/piso-piedras.webp`, la pinta
// scripts/piso/pintar_piedras.py; gris = valor y alfa = dónde hay piedra o junta,
// así que tapa la tierra sin cortar piedras a la mitad. Son lozas grandes de
// lados rectos (su referencia de lozas de piedra). Bajo el portal de SKULLEYGLYPH
// hay otra área igual, pintada con otra semilla (`piso-piedras-glifo.webp`) para
// que no sea copia del centro.
// Un camino escondido de las mismas lozas va del portal de Work al de
// SKULLEYGLYPH (Oscar): arranca apartado de Work para que no sea obvio y a
// tramos lo tapa la tierra. Es una tira que cierra a lo largo
// (`public/textures/piso-camino.webp`, scripts/piso/pintar_camino.py) que el
// shader dobla siguiendo la curva. Para no recorrer la curva en cada pixel, al
// cargar se arma un campo chico (CAMPO_RES texels por unidad) con la distancia
// con signo al camino y la posición a lo largo (como coseno y seno de la vuelta
// de la tira, para que su repetición no deje costura); el shader solo lo lee.
// Lo que Oscar ya rechazó: el ruido procedural en el shader ("horrendo"), los
// azules oscuros y las manchas claras grandes.

const URL_TIERRA = `${import.meta.env.BASE_URL}textures/piso-tierra.webp`
// Las lozas del claro, hasta la orilla del bosque (Oscar, 2026-11-25; antes una
// mancha de ~10 unidades de radio al centro, piso-piedras.webp): gris y alfa en
// dos imágenes de un canal, que en la GPU van como R8 (ver pintar_piedras.py
// --claro). La versión va en la URL: con el mismo nombre el CDN servía la de antes.
const VERSION_CLARO = 2
const URL_CLARO_GRIS = `${import.meta.env.BASE_URL}textures/piso-claro-gris.webp?v=${VERSION_CLARO}`
const URL_CLARO_ALFA = `${import.meta.env.BASE_URL}textures/piso-claro-alfa.webp?v=${VERSION_CLARO}`
const URL_CAMINO = `${import.meta.env.BASE_URL}textures/piso-camino.webp`
const URL_PIEDRAS_GLIFO = `${import.meta.env.BASE_URL}textures/piso-piedras-glifo.webp`
// El área de lozas bajo el portal de SKULLEYGLYPH (x, z, lo que mide en el mundo).
const PLAZA_GLIFO = [0, -120, 26]
// Puntos (x, z) del camino: recto sobre la línea entre el portal de Work (0, -16)
// y el de SKULLEYGLYPH (0, -120) (Oscar: que los una y no serpentee). Empieza
// unas 8 unidades después de Work y el primer tramo visible más allá, para que no
// se vea pegado a él. Con más puntos se suaviza con Catmull-Rom.
const CAMINO = [[0, -24], [0, -114]]
// Tramos que se ven, en unidades a lo largo del camino (mide 90): lo demás lo
// tapa la tierra. De largos y huecos distintos (Oscar: que no sea regular).
// El último se apaga antes de la punta, ya sobre las lozas del portal.
const CAMINO_TRAMOS = [[3, 7.5], [11.5, 29], [38, 41.5], [46.5, 61], [69, 72], [78, 86]]
// Lo que mide la tira en el mundo (ancho, largo): 560 × 2520 px a 2048/26 px por unidad.
const CAMINO_TAM = [560 / (2048 / 26), 2520 / (2048 / 26)]
const CAMPO_RES = 4
// La mancha de piedras: centro (x, z) y lo que mide en el mundo (las lozas llegan
// a ~25 de radio y los pinos empiezan en 30: Oscar quiso tierra entre las dos).
const PLAZA = [0, 0, 54]
// Lo que mide la textura en el mundo, en unidades.
const TAM_TIERRA = 5.5
const PORTALES_MAX = 6
// La luz del fuego en el piso (Oscar, 2026-11-26): la flama de Skulley (0) y las antorchas de la plaza (1..6).
export const LUCES_PISO = 8
// Hasta dónde llega el desgaste desde el centro de cada portal.
// (Oscar: que abarque más y se vaya desvaneciendo; antes 3.6 y en dos escalones.)
const RADIO_DESGASTE = 6.5
// También en las dos áreas de lozas (lo que llega desde su centro) y en los tramos
// visibles del camino (Oscar: que se vea en la textura del inicio y en el camino).
const RADIO_DESGASTE_PLAZA = 11.0
// Para que lo que crece en el piso (las matas de PastoPintado) sepa dónde hay lozas y camino.
// `lozasClaro`: desde qué radio se deshacen las lozas del claro; de ahí a los pinos
// crece el pasto (Oscar, 2026-11-25: el pasto solo en las orillas).
export const zonasPiso = { plaza: PLAZA, plazaGlifo: PLAZA_GLIFO, camino: CAMINO, caminoTramos: CAMINO_TRAMOS, caminoLargo: 90, lozasClaro: 21.5 }

export const uniformsPiso = {
  uPisoFuerza: { value: 1 },
  uPisoTam: { value: TAM_TIERRA },
  uPisoTierra: { value: null },
  uPisoRuido: { value: null },
  uPisoOscuro: { value: 1.2 },
  uPisoClaro: { value: 0.32 },
  uPisoDesgaste: { value: 0.07 },
  // La capa fina: la misma pintura más chica, encima (ver GLSL_PISO).
  uPisoFino: { value: 0.8 },
  uPisoPortales: { value: Array.from({ length: PORTALES_MAX }, () => new THREE.Vector3()) },
  uPisoLuces: { value: Array.from({ length: LUCES_PISO }, () => new THREE.Vector4(0, 0, 1, 0)) },
  uPisoLucesColor: { value: Array.from({ length: LUCES_PISO }, () => new THREE.Color('#ff8a2a')) },
  uPisoLuzFuerza: { value: 0.6 },
  uPisoPiedras: { value: null },
  uPisoPiedrasAlfa: { value: null },
  uPisoPlaza: { value: new THREE.Vector3(...PLAZA) },
  // Las piedras llevan su propio contraste: con el de la tierra casi no leían.
  uPisoPiedrasContraste: { value: 1.9 },
  uPisoPiedrasGlifo: { value: null },
  uPisoPlazaGlifo: { value: new THREE.Vector3(...PLAZA_GLIFO) },
  uPisoCamino: { value: null },
  uPisoCaminoCampo: { value: null },
  uPisoCaminoCaja: { value: new THREE.Vector4() },
  uPisoCaminoTam: { value: new THREE.Vector2(...CAMINO_TAM) },
  uPisoCaminoTramos: { value: Array.from({ length: 6 }, (_, i) => new THREE.Vector2(...(CAMINO_TRAMOS[i] || [0, 0]))) },
}

// La curva del camino suavizada con Catmull-Rom y lo recorrido en cada punto.
let curva = null
function curvaCamino() {
  if (curva) return curva
  const ext = [CAMINO[0], ...CAMINO, CAMINO[CAMINO.length - 1]]
  const pts = []
  const cr = (a, b, c, d, t) => {
    const t2 = t * t, t3 = t2 * t
    return [0, 1].map((i) => 0.5 * (2 * b[i] + (-a[i] + c[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t2 + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * t3))
  }
  for (let i = 1; i < ext.length - 2; i++) {
    for (let k = 0; k < 4; k++) pts.push(cr(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], k / 4))
  }
  pts.push(CAMINO[CAMINO.length - 1])
  const acum = [0]
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  curva = { pts, acum }
  return curva
}

// Lo más cercano de la curva a (x, z): distancia con signo, lo recorrido y si cae
// pasado una punta.
function cercaDeCurva(x, z) {
  const { pts, acum } = curvaCamino()
  let lejos = Infinity, recorrido = 0, lado = 1, pasado = false
  for (let k = 0; k < pts.length - 1; k++) {
    const ax = pts[k][0], az = pts[k][1]
    const ex = pts[k + 1][0] - ax, ez = pts[k + 1][1] - az
    const crudo = ((x - ax) * ex + (z - az) * ez) / Math.max(ex * ex + ez * ez, 1e-6)
    const t = Math.max(0, Math.min(1, crudo))
    const d = Math.hypot(x - (ax + ex * t), z - (az + ez * t))
    if (d < lejos) {
      lejos = d
      recorrido = acum[k] + t * (acum[k + 1] - acum[k])
      lado = ex * (z - az) - ez * (x - ax) < 0 ? -1 : 1
      pasado = (k === 0 && crudo < 0) || (k === pts.length - 2 && crudo > 1)
    }
  }
  return { d: lado * lejos, s: recorrido, pasado }
}

// El campo del camino: la curva suavizada, su caja (más el ancho de la tira) y,
// por texel, la distancia con signo, la vuelta de la tira y lo recorrido.
function armarCamino() {
  const { pts } = curvaCamino()
  const m = CAMINO_TAM[0]
  const caja = [
    Math.min(...pts.map((p) => p[0])) - m, Math.min(...pts.map((p) => p[1])) - m,
    Math.max(...pts.map((p) => p[0])) + m, Math.max(...pts.map((p) => p[1])) + m,
  ]
  uniformsPiso.uPisoCaminoCaja.value.set(...caja)
  const w = Math.ceil((caja[2] - caja[0]) * CAMPO_RES)
  const h = Math.ceil((caja[3] - caja[1]) * CAMPO_RES)
  const datos = new Uint16Array(w * h * 4)
  const media = THREE.DataUtils.toHalfFloat
  const vuelta = (2 * Math.PI) / CAMINO_TAM[1]
  for (let j = 0; j < h; j++) {
    const z = caja[1] + ((j + 0.5) / h) * (caja[3] - caja[1])
    for (let i = 0; i < w; i++) {
      const x = caja[0] + ((i + 0.5) / w) * (caja[2] - caja[0])
      const c = cercaDeCurva(x, z)
      const recorrido = c.s
      const o = (j * w + i) * 4
      // Pasado una punta del camino no hay tira: ahí el lado se voltea sobre el eje y
      // dejaba una línea hasta el centro del portal.
      datos[o] = media(c.pasado ? 50 : c.d)
      datos[o + 1] = media(Math.cos(recorrido * vuelta))
      datos[o + 2] = media(Math.sin(recorrido * vuelta))
      datos[o + 3] = media(recorrido / 100)
    }
  }
  const t = new THREE.DataTexture(datos, w, h, THREE.RGBAFormat, THREE.HalfFloatType)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.magFilter = t.minFilter = THREE.LinearFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  uniformsPiso.uPisoCaminoCampo.value = t
}

if (import.meta.env.DEV && typeof window !== 'undefined') window.__pisoPintado = uniformsPiso

function cargarTextura(gl, url, envolver, formato) {
  const t = new THREE.TextureLoader().load(url, (tex) => {
    // Subirla en cuanto llega (con sus mipmaps), no en el primer cuadro que la dibuja.
    try { gl?.initTexture?.(tex) } catch { }
  })
  t.wrapS = t.wrapT = envolver
  // Un solo canal (R8): la imagen se sube tomando su rojo, sin gastar RGBA.
  if (formato) t.format = formato
  t.colorSpace = THREE.NoColorSpace
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = Math.min(8, gl?.capabilities?.getMaxAnisotropy?.() ?? 1)
  return t
}

// Ruido suave que cierra en mosaico (valor en una retícula periódica, tres
// octavas): rompe la orilla del desgaste. Se lee a dos escalas.
const RUIDO_N = 128
let datosRuido = null
function ruidoSuave() {
  const t = new THREE.DataTexture(generarRuido(), RUIDO_N, RUIDO_N, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = t.minFilter = THREE.LinearFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}

function generarRuido() {
  if (datosRuido) return datosRuido
  const n = RUIDO_N
  const datos = new Uint8Array(n * n * 4)
  let s = 0x2545f491
  const azar = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
  const octavas = [8, 16, 32].map((celdas) => ({ celdas, v: Array.from({ length: celdas * celdas }, azar) }))
  const suave = (x) => x * x * (3 - 2 * x)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let suma = 0, peso = 0, w = 1
      for (const { celdas, v } of octavas) {
        const fx = (x / n) * celdas, fy = (y / n) * celdas
        const ix = Math.floor(fx), iy = Math.floor(fy)
        const tx = suave(fx - ix), ty = suave(fy - iy)
        const at = (i, j) => v[(j % celdas) * celdas + (i % celdas)]
        const a = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx
        const b = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx
        suma += (a * (1 - ty) + b * ty) * w
        peso += w
        w *= 0.5
      }
      datos[(y * n + x) * 4] = Math.round((suma / peso) * 255)
    }
  }
  datosRuido = datos
  return datos
}

// El ruido leído como lo lee el shader (bilineal, repetido, sin mipmaps).
function leerRuido(u, v) {
  const d = generarRuido()
  const n = RUIDO_N
  const fx = u * n - 0.5, fy = v * n - 0.5
  const ix = Math.floor(fx), iy = Math.floor(fy)
  const tx = fx - ix, ty = fy - iy
  const at = (i, j) => d[((((j % n) + n) % n) * n + (((i % n) + n) % n)) * 4] / 255
  const a = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx
  const b = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx
  return a * (1 - ty) + b * ty
}

const suaveEntre = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** El camino escondido en (x, z), con la misma cuenta que el shader del piso:
 * `d` distancia con signo a la curva, `s` lo recorrido (0 a 90), `medio` su medio
 * ancho ahí y `visible` qué tanto se ven sus lozas (0 = las tapa la tierra). Para
 * lo que se siembra en el piso según el camino (los pétalos de PetalosCamino). */
export function caminoEnPiso(x, z) {
  const c = cercaDeCurva(x, z)
  const s = c.s
  let tramo = 0
  for (const [a, b] of CAMINO_TRAMOS) tramo = Math.max(tramo, suaveEntre(a - 3, a + 3, s) * (1 - suaveEntre(b - 3, b + 3, s)))
  const rotos = leerRuido(x * 0.12 + 0.13, z * 0.12 + 0.57) * 0.65 + leerRuido(x * 0.41 + 0.37, z * 0.41 + 0.11) * 0.35
  tramo = suaveEntre(0.42, 0.58, tramo + (rotos - 0.5) * 1.6)
  const medio = Math.max(1, Math.min(2.8, 1 + 4.5 * (leerRuido(s * 0.021, 0.31) - 0.3)))
  const rotosLado = leerRuido(x * 0.33 + 0.71, z * 0.33 + 0.29)
  const lado = c.pasado ? 0 : 1 - suaveEntre(medio - 0.35, medio + 0.35, Math.abs(c.d) + (rotosLado - 0.5) * 1.1)
  return { d: c.d, s, medio, pasado: c.pasado, visible: tramo * lado }
}

// Los portales del home ({ position: [x, y, z] }): ahí se gasta el piso.
// La luz de un fuego en el piso: `i` su casilla (0 la flama de Skulley, 1..6 las antorchas), dónde, de qué radio,
// qué tan fuerte (0 la apaga) y de qué color.
export function ponerLuzPiso(i, x, z, radio, fuerza, color) {
  const L = uniformsPiso.uPisoLuces.value[i]
  if (!L) return
  L.set(x, z, Math.max(0.01, radio), Math.max(0, fuerza))
  if (color) uniformsPiso.uPisoLucesColor.value[i].copy(color)
}

export function ponerPortalesPiso(portales) {
  const lista = uniformsPiso.uPisoPortales.value
  for (let i = 0; i < PORTALES_MAX; i++) {
    const p = portales?.[i]?.position
    if (p) lista[i].set(p[0], p[2], RADIO_DESGASTE)
    else lista[i].set(0, 0, 0)
  }
}

const GLSL_COMUN = /* glsl */ `
varying vec2 vPisoP;
uniform float uPisoFuerza;
uniform float uPisoTam;
uniform sampler2D uPisoTierra;
uniform sampler2D uPisoRuido;
uniform float uPisoOscuro;
uniform float uPisoClaro;
uniform float uPisoDesgaste;
uniform float uPisoFino;
uniform vec3 uPisoPortales[${PORTALES_MAX}];
uniform vec4 uPisoLuces[${LUCES_PISO}];
uniform vec3 uPisoLucesColor[${LUCES_PISO}];
uniform float uPisoLuzFuerza;
uniform sampler2D uPisoPiedras;
uniform sampler2D uPisoPiedrasAlfa;
uniform vec3 uPisoPlaza;
uniform float uPisoPiedrasContraste;
uniform sampler2D uPisoPiedrasGlifo;
uniform vec3 uPisoPlazaGlifo;
uniform sampler2D uPisoCamino;
uniform sampler2D uPisoCaminoCampo;
uniform vec4 uPisoCaminoCaja;
uniform vec2 uPisoCaminoTam;
uniform vec2 uPisoCaminoTramos[6];

vec2 pisoAzar(vec2 c) {
  vec3 p3 = fract(vec3(c.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Hex-tiling sin giro: cada hexágono lee la textura con un desfase al azar y se
// mezcla con sus vecinos en una franja angosta. Las derivadas son las del uv sin
// desfase, para que el mipmap no salte en las orillas.
float pisoTierra(vec2 uv, float semilla) {
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  vec2 sk = mat2(1.0, 0.0, -0.57735027, 1.15470054) * (uv * 3.1176915);
  vec2 b = floor(sk);
  vec3 t = vec3(fract(sk), 0.0);
  t.z = 1.0 - t.x - t.y;
  float s = step(0.0, -t.z);
  float s2 = 2.0 * s - 1.0;
  vec3 w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
  b += semilla;
  float c1 = textureGrad(uPisoTierra, uv + pisoAzar(b + vec2(s, s)), dx, dy).r;
  float c2 = textureGrad(uPisoTierra, uv + pisoAzar(b + vec2(s, 1.0 - s)), dx, dy).r;
  float c3 = textureGrad(uPisoTierra, uv + pisoAzar(b + vec2(1.0 - s, s)), dx, dy).r;
  w = w * w * w;
  w = w * w;
  return dot(vec3(c1, c2, c3), w) / dot(w, vec3(1.0));
}
`

const GLSL_PISO = /* glsl */ `
{
  vec2 p = vPisoP;
  // Cerca de la cámara los trazos se ven grandes y, difuminados, ya no leen
  // como textura (Oscar: "abajo del personaje no se ve"). La misma pintura más
  // chica encima da ese grano; lejos el mipmap la promedia al gris medio y no
  // cambia nada.
  float g = pisoTierra(p / uPisoTam, 0.0);
  g += (pisoTierra(p * (2.7 / uPisoTam), 37.0) - 0.5) * uPisoFino;
  // Las piedras del centro tapan la tierra. Fuera de la calcomanía se lee su
  // orilla (sin piedra, alfa 0): no hace falta preguntar si está adentro.
  vec2 uvPlaza = (p - uPisoPlaza.xy) / uPisoPlaza.z + 0.5;
  float piedra = texture2D(uPisoPiedras, uvPlaza).r;
  float piedraA = texture2D(uPisoPiedrasAlfa, uvPlaza).r;
  g = mix(g, 0.5 + (piedra - 0.5) * uPisoPiedrasContraste, piedraA);
  vec4 piedraGlifo = texture2D(uPisoPiedrasGlifo, (p - uPisoPlazaGlifo.xy) / uPisoPlazaGlifo.z + 0.5);
  g = mix(g, 0.5 + (piedraGlifo.r - 0.5) * uPisoPiedrasContraste, piedraGlifo.a);
  // El camino escondido: el campo da de qué lado y a qué distancia de la curva
  // cae el pixel y a qué altura de la tira. Solo dentro de su caja.
  // Qué tan cerca está de algo que se pisa mucho (1 encima, 0 lejos): da el desgaste.
  float pisado = 0.0;
  if (all(greaterThan(p, uPisoCaminoCaja.xy)) && all(lessThan(p, uPisoCaminoCaja.zw))) {
    vec4 campo = texture2D(uPisoCaminoCampo, (p - uPisoCaminoCaja.xy) / (uPisoCaminoCaja.zw - uPisoCaminoCaja.xy));
    float aLoLargo = campo.a * 100.0;
    vec2 uvLoza = vec2(0.5 + campo.r / uPisoCaminoTam.x, atan(campo.b, campo.g) * 0.15915494);
    // Las derivadas, de lo que no salta (la vuelta del atan sí salta una vez por tira).
    vec2 dLoza = vec2(1.0 / uPisoCaminoTam.x, 1.0 / uPisoCaminoTam.y);
    vec2 gx = vec2(dFdx(campo.r), dFdx(aLoLargo)) * dLoza;
    vec2 gy = vec2(dFdy(campo.r), dFdy(aLoLargo)) * dLoza;
    vec4 loza = textureGrad(uPisoCamino, uvLoza, gx, gy);
    // Los tramos que tapa la tierra, con la orilla rota por un ruido.
    // Los extremos se deshacen en lozas sueltas: transición larga y dos ruidos que
    // la muerden (con orillas derechas los tramos se veían como rectángulos).
    float tramo = 0.0;
    for (int i = 0; i < 6; i++) {
      vec2 tr = uPisoCaminoTramos[i];
      tramo = max(tramo, smoothstep(tr.x - 3.0, tr.x + 3.0, aLoLargo) * (1.0 - smoothstep(tr.y - 3.0, tr.y + 3.0, aLoLargo)));
    }
    float rotos = texture2D(uPisoRuido, p * 0.12 + vec2(0.13, 0.57)).r * 0.65 + texture2D(uPisoRuido, p * 0.41 + vec2(0.37, 0.11)).r * 0.35;
    tramo = smoothstep(0.42, 0.58, tramo + (rotos - 0.5) * 1.6);
    // El ancho cambia a lo largo (de 1 a 2.8 de medio ancho) y su orilla se rompe.
    float medio = clamp(1.0 + 4.5 * (texture2D(uPisoRuido, vec2(aLoLargo * 0.021, 0.31)).r - 0.3), 1.0, 2.8);
    float rotosLado = texture2D(uPisoRuido, p * 0.33 + vec2(0.71, 0.29)).r;
    // El camino se gasta donde se ve (en los tramos tapados no, o se notaría la línea).
    pisado = max(pisado, (1.0 - abs(campo.r) / (medio + 2.5)) * tramo);
    tramo *= 1.0 - smoothstep(medio - 0.35, medio + 0.35, abs(campo.r) + (rotosLado - 0.5) * 1.1);
    g = mix(g, 0.5 + (loza.r - 0.5) * uPisoPiedrasContraste, loza.a * tramo);
  }
  // Desgaste alrededor y adentro de los portales y de las áreas de lozas, más
  // fuerte en medio.
  for (int i = 0; i < ${PORTALES_MAX}; i++) {
    vec3 c = uPisoPortales[i];
    if (c.z > 0.0) pisado = max(pisado, 1.0 - length(p - c.xy) / c.z);
  }
  pisado = max(pisado, 1.0 - length(p - uPisoPlaza.xy) / ${RADIO_DESGASTE_PLAZA.toFixed(1)});
  pisado = max(pisado, 1.0 - length(p - uPisoPlazaGlifo.xy) / ${RADIO_DESGASTE_PLAZA.toFixed(1)});
  float r1 = texture2D(uPisoRuido, p * 0.06 + vec2(0.37, 0.71)).r;
  float r2 = texture2D(uPisoRuido, mat2(0.8, 0.6, -0.6, 0.8) * p * 0.17).r;
  float e = pisado + (r1 - 0.5) * 0.5 + (r2 - 0.5) * 0.25 + (g - 0.5) * 1.4;
  // Se desvanece poco a poco hacia afuera; la pintura y el ruido lo muerden.
  float desgaste = smoothstep(0.0, 0.85, e);
  float d = g - 0.5;
  vec3 vis = sqrt(min(outgoingLight, vec3(1.0)));
  vec3 pintado = vis * (1.0 - uPisoOscuro * max(-d, 0.0));
  pintado = mix(pintado, vec3(1.0), uPisoClaro * max(d, 0.0) + uPisoDesgaste * desgaste);
  float mascara = clamp(max(abs(d) * 60.0, desgaste * 4.0), 0.0, 1.0) * uPisoFuerza;
  outgoingLight = mix(outgoingLight, pintado * pintado, mascara);
  // La luz del fuego (la flama de Skulley, sus bolas y explosiones, las antorchas): charcos suaves que bailan.
  // Sin luces reales: una luz nueva recompilaría la escena.
  // Se mezcla hacia el color del fuego (sumado, el naranja sobre el azul salía rosa).
  vec3 fuego = vec3(0.0);
  float peso = 0.0;
  for (int i = 0; i < ${LUCES_PISO}; i++) {
    vec4 L = uPisoLuces[i];
    if (L.w <= 0.0) continue;
    // caída suave y redonda (en bandas duras se veía demasiado toon y con la orilla en ruido, como nube: Oscar);
    // lo que se mueve es la fuerza y el tamaño, como la llama
    float d = length(p - L.xy) / L.z;
    if (d >= 1.6) continue;
    // gaussiana: un resplandor que se pierde solo, sin orilla (Oscar: "más natural, como bloom, cozy")
    float k = exp(-d * d * 3.2) * L.w;
    fuego += uPisoLucesColor[i] * k;
    peso += k;
  }
  if (peso > 0.0) {
    vec3 tono = fuego / peso;
    outgoingLight = mix(outgoingLight, tono * 0.8, min(peso * uPisoLuzFuerza, 0.5));
    outgoingLight += tono * min(peso, 1.2) * 0.12;
  }
}
`

export function aplicarPisoPintado(material, gl) {
  if (!material || material.userData.pisoPintado) return material
  if (!uniformsPiso.uPisoTierra.value) uniformsPiso.uPisoTierra.value = cargarTextura(gl, URL_TIERRA, THREE.RepeatWrapping)
  if (!uniformsPiso.uPisoPiedras.value) uniformsPiso.uPisoPiedras.value = cargarTextura(gl, URL_CLARO_GRIS, THREE.ClampToEdgeWrapping, THREE.RedFormat)
  if (!uniformsPiso.uPisoPiedrasAlfa.value) uniformsPiso.uPisoPiedrasAlfa.value = cargarTextura(gl, URL_CLARO_ALFA, THREE.ClampToEdgeWrapping, THREE.RedFormat)
  if (!uniformsPiso.uPisoPiedrasGlifo.value) uniformsPiso.uPisoPiedrasGlifo.value = cargarTextura(gl, URL_PIEDRAS_GLIFO, THREE.ClampToEdgeWrapping)
  if (!uniformsPiso.uPisoCaminoCampo.value) armarCamino()
  if (!uniformsPiso.uPisoCamino.value) {
    // A lo ancho no se repite (sus lados son transparentes); a lo largo sí.
    const t = cargarTextura(gl, URL_CAMINO, THREE.RepeatWrapping)
    t.wrapS = THREE.ClampToEdgeWrapping
    uniformsPiso.uPisoCamino.value = t
  }
  if (!uniformsPiso.uPisoRuido.value) uniformsPiso.uPisoRuido.value = ruidoSuave()
  const previo = material.onBeforeCompile
  material.onBeforeCompile = function (shader, renderer) {
    previo?.call(this, shader, renderer)
    for (const k of Object.keys(uniformsPiso)) shader.uniforms[k] = uniformsPiso[k]
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPisoP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPisoP = (modelMatrix * vec4(transformed, 1.0)).xz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMUN}`)
      .replace('#include <opaque_fragment>', `${GLSL_PISO}\n#include <opaque_fragment>`)
  }
  const llavePrevia = material.customProgramCacheKey
  material.customProgramCacheKey = function () {
    return `piso-pintado-3|${llavePrevia.call(this)}`
  }
  material.userData.pisoPintado = true
  material.needsUpdate = true
  return material
}
