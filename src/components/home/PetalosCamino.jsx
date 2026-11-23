import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { caminoEnPiso, zonasPiso } from '../../lib/pisoPintado.js'
import { escucharExplosiones } from '../../lib/explosionesHome.js'
import { ubicarSonido } from '../../lib/homeSounds.js'
import { sonarBrota, sonarFuego, sonarPrenden } from '../../lib/petalosSonidos.js'

// Pétalos de cempasúchil en el camino escondido de Work a SKULLEYGLYPH (2026-11-22):
// donde la tierra tapa las lozas, los pétalos siguen el camino, como el de Día de
// Muertos que guía a los muertos a casa (nadie lo dice en el sitio). Se siembran
// con la misma cuenta del shader del piso (`caminoEnPiso`): tupidos al centro de la
// tira tapada, ralos a los lados y casi nada sobre las lozas que se ven.
// El atlas lo pinta scripts/petalos/pintar_petalos.py (gris 0.5 = el naranja, abajo
// un rojo quemado, arriba aclara; alfa = pétalo): doce pétalos sueltos, dos
// doblados, un par y una flor entera.
// Cada pétalo es suyo: Skulley los levanta al pasar (más corriendo), giran, planean
// meciéndose y se acuestan donde caen, de cara o de espaldas, sin meterse en el
// piso. Las explosiones de la bola de fuego (lib/explosionesHome.js) los avientan y
// prenden los de cerca (Oscar): cada uno arde, se carboniza desde la orilla, se
// deshace en ceniza y prende a sus vecinos, así que el fuego corre por el camino
// como mecha hasta donde las lozas cortan la hilera. Después de `FUEGO.repone` (más
// un rato al azar, para que no salgan todos juntos) caen pétalos nuevos del cielo,
// meciéndose, sobre donde estaban (Oscar). Suenan (lib/petalosSonidos.js): el
// fuego que agarra, el crepitar y unas campanitas al caer (pisarlos no suena).
// Un solo dibujo (InstancedBufferGeometry) con los pétalos y, después, las chispas
// y la ceniza (mismo programa: quemarlos no compila nada). Posición, giro y quema
// viven en la CPU y solo se suben mientras algo se mueve. Montado siempre.

const VERSION = 1
const URL_PETALOS = `${import.meta.env.BASE_URL}textures/petalos-camino.webp?v=${VERSION}`

const PETALOS = {
  semilla: 31,
  densidad: 7.5,        // pétalos por unidad² al centro de lo que tapa la tierra
  sueltos: 0.05,        // lo mismo sobre las lozas que se ven, en fracción
  tam: [0.24, 0.38],    // lo que mide un pétalo en el mundo
  flor: 0.03,           // de cada cuántos es una flor entera
  tamFlor: [0.46, 0.6],
  alto: [0.004, 0.013], // sobre el piso (cada uno distinto: no pelean al encimarse)
  color: '#ff7014',
  oscuro: [0.6, 0.27, 0.22],  // hacia dónde se va lo oscuro del atlas (multiplica)
  claro: [1, 0.9, 0.62],      // y lo claro (mezcla)
  claroFuerza: 0.55,
  espalda: 0.8,         // el revés, un poco más apagado
}

const FISICA = {
  radio: 0.62,          // alcance de los pies de Skulley
  radioCorre: 0.85,
  minVel: 1.2,          // abajo de esto no levanta nada
  caminar: 9,           // la velocidad de Skulley caminando (Player, SPEED)
  vuelo: [1.4, 3.0],    // velocidad hacia arriba al caminar
  empuje: [0.6, 1.5],   // hacia afuera
  arrastre: 0.3,        // lo que se lleva de la velocidad de Skulley
  gravedad: 7.5,
  caidaMax: [1.1, 1.8], // velocidad de caída tope: los pétalos planean
  aire: 1.7,            // freno horizontal en el aire
  aleteo: 2.4,          // vaivén al caer
  giro: [5, 13],        // rad/s al salir
  roce: 7,              // freno al resbalar en el piso
  asienta: 13,          // qué tan rápido se acuesta al caer
  espera: 0.35,         // segundos antes de poder levantarse otra vez
  flor: 0.4,            // las flores pesan más: vuelan menos y giran menos
}

const FUEGO = {
  quemaS: [1.5, 2.2],   // lo que tarda un pétalo en arder hasta hacerse polvo
  prende: 0.45,         // fracción del alcance de la explosión que prende (más lejos solo avienta)
  explota: [2.2, 6.5],  // velocidad hacia afuera al centro de la explosión (débil, fuerte)
  explotaArriba: [2.0, 4.5],
  contagio: 0.8,        // a qué distancia prende a sus vecinos (así cada tramo tapado es una mecha)
  contagiaEn: 0.1,      // en qué punto de su quema
  velocidad: 2.4,       // unidades por segundo a las que corre el fuego
  repone: 22,           // segundos para que caigan pétalos nuevos donde se quemaron
  reponeAzar: 8,        // más hasta esto, a cada uno
  caeDe: [2.6, 4.6],    // de qué altura caen
  brotaS: 0.9,
  chispasPorS: 2.2,     // chispas que suben mientras arde, por pétalo
  cenizas: 3,           // motas al deshacerse
  particulas: 420,      // tope de chispas y ceniza a la vez
  calor: 2.6,           // el fuego pasa del 1 para que lo agarre el bloom
}

const CHISPA = 16
const CENIZA = 17

const suaveEntre = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function sembrar() {
  let semilla = PETALOS.semilla
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646 }
  const [x0, z0] = zonasPiso.camino[0]
  const [x1, z1] = zonasPiso.camino[zonasPiso.camino.length - 1]
  const largo = zonasPiso.caminoLargo
  const margen = 4
  const caja = [Math.min(x0, x1) - margen, Math.min(z0, z1) - margen, Math.max(x0, x1) + margen, Math.max(z0, z1) + margen]
  const area = (caja[2] - caja[0]) * (caja[3] - caja[1])
  const candidatos = Math.round(area * PETALOS.densidad)
  const lista = []
  for (let i = 0; i < candidatos; i++) {
    const x = caja[0] + azar() * (caja[2] - caja[0])
    const z = caja[1] + azar() * (caja[3] - caja[1])
    const c = caminoEnPiso(x, z)
    const filtro = azar()
    if (c.pasado) continue
    // Tupidos al centro de la tira, se abren hacia sus orillas.
    const ancho = 0.45 * c.medio + 0.35
    const perfil = Math.exp(-((c.d / ancho) ** 2))
    const tapado = 1 - c.visible
    let p = perfil * (tapado * tapado + PETALOS.sueltos * c.visible)
    // Empiezan apartados de Work y se acaban antes del portal del glifo.
    p *= suaveEntre(-1, 1.5, c.s) * (1 - suaveEntre(largo - 7, largo, c.s))
    if (filtro >= p) continue
    const flor = azar() < PETALOS.flor
    const [t0, t1] = flor ? PETALOS.tamFlor : PETALOS.tam
    lista.push({
      x, z,
      yaw: azar() * Math.PI * 2,
      tam: t0 + (t1 - t0) * azar(),
      celda: flor ? 15 : Math.floor(azar() * 15),
      alto: PETALOS.alto[0] + (PETALOS.alto[1] - PETALOS.alto[0]) * azar(),
      fase: azar() * 6.283,
      flor,
    })
  }
  return lista
}

function armarGeometria(lista) {
  // Dos cuadros: el de enfrente mira hacia arriba y el revés hacia abajo (marcado en z).
  const esq = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 1, 0.5, -0.5, 1, 0.5, 0.5, 1, -0.5, 0.5, 1]
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(esq, 3))
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6])
  // Primero los pétalos y después las partículas (chispas y ceniza), apagadas.
  const n = lista.length + FUEGO.particulas
  const pos = new Float32Array(n * 4)
  const giro = new Float32Array(n * 2)
  const info = new Float32Array(n * 4)
  lista.forEach((p, i) => {
    pos.set([p.x, 0, p.z, p.yaw], i * 4)
    info.set([p.tam, p.celda, p.alto, 0], i * 4)
  })
  for (let i = lista.length; i < n; i++) info.set([0, CHISPA, 0, 1], i * 4)
  const crear = (arr, k) => {
    const a = new THREE.InstancedBufferAttribute(arr, k)
    a.setUsage(THREE.DynamicDrawUsage)
    return a
  }
  g.setAttribute('aPetalo', crear(pos, 4))
  g.setAttribute('aPetaloGiro', crear(giro, 2))
  g.setAttribute('aPetaloInfo', crear(info, 4))
  g.instanceCount = n
  return g
}

const VERT_COMUN = /* glsl */`
attribute vec4 aPetalo;
attribute vec2 aPetaloGiro;
attribute vec4 aPetaloInfo;
uniform float uPetalosListo;
varying vec2 vPetaloUv;
varying vec2 vPetaloLocal;
varying float vPetaloCara;
varying float vPetaloEst;
varying float vPetaloTipo;
varying float vPetaloSemilla;
`
const VERT_POS = /* glsl */`
  float tam = aPetaloInfo.x;
  float celda = aPetaloInfo.y;
  float est = aPetaloInfo.w;
  vPetaloEst = est;
  vPetaloLocal = position.xy + 0.5;
  vPetaloSemilla = float(gl_InstanceID) * 1.618;
  vec3 transformed;
  if (celda > 15.5) {
    // Chispa o ceniza: un disco que mira a la cámara (solo el cuadro de enfrente).
    vPetaloTipo = celda - 15.0;
    vec3 der = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 arr = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float s = position.z > 0.5 || est >= 1.0 ? 0.0 : tam;
    transformed = aPetalo.xyz + (der * position.x + arr * position.y) * s * uPetalosListo;
    vPetaloUv = vec2(0.0);
    vPetaloCara = 1.0;
  } else {
    vPetaloTipo = 0.0;
    // Brotando (est de -1 a 0) crece; ardiendo (0 a 1) se encoge al deshacerse; en 1 ya no está.
    float escala = est < 0.0 ? 1.0 + est : (est >= 1.0 ? 0.0 : 1.0 - 0.2 * max(est - 0.6, 0.0) / 0.4);
    vec3 q = vec3(position.x, 0.0, -position.y) * tam * escala;
    float cp = cos(aPetaloGiro.x), sp = sin(aPetaloGiro.x);
    q = vec3(q.x, q.y * cp - q.z * sp, q.y * sp + q.z * cp);
    float cr = cos(aPetaloGiro.y), sr = sin(aPetaloGiro.y);
    q = vec3(q.x * cr - q.y * sr, q.x * sr + q.y * cr, q.z);
    float cy = cos(aPetalo.w), sy = sin(aPetalo.w);
    q = vec3(q.x * cy + q.z * sy, q.y, -q.x * sy + q.z * cy);
    // Sin el atlas cargado, cada pétalo se junta en un punto y no dibuja nada.
    transformed = aPetalo.xyz + vec3(0.0, aPetaloInfo.z, 0.0) + q * uPetalosListo;
    // Celda del atlas (4 x 4, la 0 arriba a la izquierda).
    vec2 c = vec2(mod(celda, 4.0), 3.0 - floor(celda / 4.0));
    vec2 uvq = position.xy + 0.5;
    // El revés se ve en espejo.
    if (position.z > 0.5) uvq.x = 1.0 - uvq.x;
    vPetaloUv = (c + uvq) * 0.25;
    vPetaloCara = position.z > 0.5 ? ${PETALOS.espalda.toFixed(2)} : 1.0;
  }
`
const FRAG_COMUN = /* glsl */`
uniform sampler2D uPetalosAtlas;
uniform float uPetalosTiempo;
varying vec2 vPetaloUv;
varying vec2 vPetaloLocal;
varying float vPetaloCara;
varying float vPetaloEst;
varying float vPetaloTipo;
varying float vPetaloSemilla;
float petaloValor;
float petaloQuema;
float petaloAzar(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float petaloRuido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(petaloAzar(i), petaloAzar(i + vec2(1.0, 0.0)), f.x), mix(petaloAzar(i + vec2(0.0, 1.0)), petaloAzar(i + vec2(1.0, 1.0)), f.x), f.y);
}
float petaloBayer(vec2 p) {
  ivec2 q = ivec2(mod(floor(p), 4.0));
  int a = (((q.x ^ q.y) & 1) << 1) | (q.y & 1);
  int b = ((((q.x >> 1) ^ (q.y >> 1)) & 1) << 1) | ((q.y >> 1) & 1);
  return (float(a * 4 + b) + 0.5) / 16.0;
}
`
const FRAG_ALFA = /* glsl */`
  {
    if (vPetaloTipo > 0.5) {
      // Discos duros (sin degradado) que se van tramados al acabarse.
      if (length(vPetaloLocal - 0.5) > 0.5) discard;
      if (smoothstep(0.5, 1.0, vPetaloEst) > petaloBayer(gl_FragCoord.xy)) discard;
      petaloValor = 0.0;
      petaloQuema = 0.0;
    } else {
      vec4 tx = texture2D(uPetalosAtlas, vPetaloUv);
      // Las mips promedian el alfa y los pétalos lejanos se adelgazarían: se compensa.
      vec2 dx = dFdx(vPetaloUv * 1024.0), dy = dFdy(vPetaloUv * 1024.0);
      float lod = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-6));
      if (tx.a * (1.0 + max(lod, 0.0) * 0.25) < 0.5) discard;
      petaloValor = tx.r * 2.0 - 1.0;
      petaloQuema = 1.0;
      if (vPetaloEst > 0.0) {
        // Lo que se quema primero: un ruido, de la orilla hacia adentro.
        vec2 l = vPetaloLocal;
        float n = 0.62 * petaloRuido(l * 5.0 + vPetaloSemilla) + 0.38 * petaloRuido(l * 11.0 + vPetaloSemilla * 1.7);
        petaloQuema = mix(n, 1.0 - length(l - 0.5) * 1.5, 0.4);
        // Al final se deshace en polvo.
        if (petaloQuema < (vPetaloEst - 0.6) / 0.4) discard;
      }
    }
  }
`
const v3 = (a) => `vec3(${a.map((n) => n.toFixed(3)).join(', ')})`
const FRAG_COLOR = /* glsl */`
  {
    float calor = ${FUEGO.calor.toFixed(2)};
    vec3 amarillo = vec3(1.0, 0.86, 0.36);
    vec3 naranja = vec3(1.0, 0.42, 0.06);
    vec3 rojo = vec3(0.85, 0.12, 0.03);
    if (vPetaloTipo > 0.5) {
      float vida = vPetaloEst;
      outgoingLight = vPetaloTipo < 1.5
        ? (vida < 0.3 ? amarillo : (vida < 0.6 ? naranja : rojo)) * calor
        : vec3(0.2, 0.19, 0.19);
    } else {
      vec3 vis = sqrt(min(outgoingLight, vec3(1.0)));
      vis = petaloValor < 0.0
        ? mix(vis, vis * ${v3(PETALOS.oscuro)}, -petaloValor)
        : mix(vis, ${v3(PETALOS.claro)}, ${PETALOS.claroFuerza.toFixed(2)} * petaloValor);
      vis *= vPetaloCara;
      outgoingLight = vis * vis;
      float b = vPetaloEst;
      if (b > 0.0) {
        // Arde en bandas duras: se calienta entero, el carbón avanza desde la
        // orilla con un filo de brasa y, ya negro, se deshace con la orilla al rojo.
        float parpadeo = step(0.5, petaloAzar(vec2(floor(uPetalosTiempo * 14.0), vPetaloSemilla)));
        vec3 fuego = mix(naranja, amarillo, parpadeo * step(0.45, petaloValor + 0.5)) * calor;
        vec3 col = b < 0.05 ? mix(outgoingLight, fuego, step(0.5, b / 0.05)) : fuego;
        float frente = (b - 0.06) / 0.5;
        float q = petaloQuema;
        vec3 carbon = vec3(0.035, 0.02, 0.018);
        if (q < frente) col = carbon;
        else if (q < frente + 0.13) col = rojo * calor;
        float desh = (b - 0.6) / 0.4;
        if (desh > 0.0 && q < desh + 0.07) col = naranja * calor * 0.8;
        outgoingLight = col;
      }
    }
  }
`

function cargarAtlas(gl, alListo) {
  const t = new THREE.TextureLoader().load(URL_PETALOS, (tex) => {
    try { gl?.initTexture?.(tex) } catch { }
    alListo()
  })
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = Math.min(8, gl?.capabilities?.getMaxAnisotropy?.() || 1)
  return t
}

// Lo que se levanta del piso cuando el pétalo va inclinado: así ninguna esquina se mete.
// (La esquina más baja del cuadro girado en x y luego en z baja eso; el giro en y no cambia la altura.)
const levante = (s, i) => 0.5 * s.tam[i] * (Math.abs(Math.sin(s.roll[i])) + Math.abs(Math.sin(s.pitch[i]) * Math.cos(s.roll[i])))

function crearSim(lista) {
  const n = lista.length
  const P = FUEGO.particulas
  return {
    n,
    x: Float32Array.from(lista, (p) => p.x),
    y: new Float32Array(n),
    z: Float32Array.from(lista, (p) => p.z),
    yaw: Float32Array.from(lista, (p) => p.yaw),
    x0: Float32Array.from(lista, (p) => p.x),
    z0: Float32Array.from(lista, (p) => p.z),
    yaw0: Float32Array.from(lista, (p) => p.yaw),
    pitch: new Float32Array(n),
    roll: new Float32Array(n),
    vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n),
    wy: new Float32Array(n), wp: new Float32Array(n), wr: new Float32Array(n),
    tam: Float32Array.from(lista, (p) => p.tam),
    fase: Float32Array.from(lista, (p) => p.fase),
    flor: Uint8Array.from(lista, (p) => (p.flor ? 1 : 0)),
    caida: Float32Array.from(lista, (p, i) => FISICA.caidaMax[0] + (FISICA.caidaMax[1] - FISICA.caidaMax[0]) * ((i * 0.618) % 1)),
    // 0 quieto, 1 en el aire, 2 acostándose en el piso.
    estado: new Uint8Array(n),
    espera: new Float32Array(n),
    // Fuego: quema de 0 (nada) a 1 (ya es polvo); cuándo prende; si ya contagió y
    // soltó su ceniza; cuándo vuelve a salir y lo que lleva brotando (de -1 a 0).
    quema: new Float32Array(n),
    prende: new Float32Array(n).fill(Infinity),
    contagio: new Uint8Array(n),
    ceniza: new Uint8Array(n),
    durQ: Float32Array.from(lista, (p, i) => FUEGO.quemaS[0] + (FUEGO.quemaS[1] - FUEGO.quemaS[0]) * ((i * 0.381) % 1)),
    regresa: new Float32Array(n).fill(Infinity),
    brota: new Float32Array(n),
    // Partículas (chispas y ceniza), en anillo.
    px: new Float32Array(P), py: new Float32Array(P), pz: new Float32Array(P),
    pvx: new Float32Array(P), pvy: new Float32Array(P), pvz: new Float32Array(P),
    pvida: new Float32Array(P).fill(1), pdur: new Float32Array(P).fill(1),
    ptam: new Float32Array(P), ptipo: new Float32Array(P).fill(CHISPA),
    pSig: 0, pVivas: 0,
  }
}

export default function PetalosCamino({ playerRef }) {
  const gl = useThree((s) => s.gl)
  const recursos = useMemo(() => {
    const lista = sembrar()
    const geo = armarGeometria(lista)
    const uniforms = {
      uPetalosAtlas: { value: null },
      uPetalosListo: { value: 0 },
      uPetalosTiempo: { value: 0 },
    }
    uniforms.uPetalosAtlas.value = cargarAtlas(gl, () => { uniforms.uPetalosListo.value = 1 })
    const mat = new THREE.MeshStandardMaterial({
      color: PETALOS.color,
      roughness: 0.9,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_COMUN}`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <begin_vertex>', VERT_POS)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAG_COMUN}`)
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>\n${FRAG_ALFA}`)
        .replace('#include <opaque_fragment>', `${FRAG_COLOR}\n#include <opaque_fragment>`)
    }
    mat.customProgramCacheKey = () => 'petalos-camino-2'
    return { geo, mat, uniforms, sim: crearSim(lista) }
  }, [gl])

  useEffect(() => () => {
    recursos.geo.dispose()
    recursos.mat.dispose()
    recursos.uniforms.uPetalosAtlas.value?.dispose?.()
  }, [recursos])

  const prev = useRef({ x: 0, z: 0, ok: false, vx: 0, vz: 0, t: 0, azar: 0x9e3779b9, celdas: new Map(), explosiones: [], derecha: new THREE.Vector3(), sonaba: false })
  const azar = () => {
    const pr = prev.current
    pr.azar ^= pr.azar << 13; pr.azar ^= pr.azar >>> 17; pr.azar ^= pr.azar << 5
    return (pr.azar >>> 0) / 4294967296
  }

  // Avienta el pétalo i: hacia arriba, hacia afuera de (ox, oz) con `empuje` y con
  // algo de la velocidad (vx, vz).
  const aventar = (i, ox, oz, vx, vz, empuje, arriba, giroK) => {
    const s = recursos.sim
    let dx = s.x[i] - ox, dz = s.z[i] - oz
    let d = Math.hypot(dx, dz)
    if (d < 1e-3) { dx = Math.cos(s.fase[i]); dz = Math.sin(s.fase[i]); d = 1 }
    const peso = s.flor[i] ? FISICA.flor : 1
    s.vx[i] = (dx / d) * empuje * peso + vx * FISICA.arrastre * peso
    s.vz[i] = (dz / d) * empuje * peso + vz * FISICA.arrastre * peso
    s.vy[i] = arriba * Math.max(0.45, peso)
    const giro = () => (azar() < 0.5 ? -1 : 1) * (FISICA.giro[0] + (FISICA.giro[1] - FISICA.giro[0]) * azar()) * peso * giroK
    s.wy[i] = giro() * 0.5
    s.wp[i] = giro()
    s.wr[i] = giro() * 0.6
    s.y[i] = Math.max(s.y[i], levante(s, i))
    s.estado[i] = 1
  }

  // Levanta el pétalo i con los pies de Skulley. `fuerza` 1 es caminar.
  const levantar = (i, ox, oz, vx, vz, fuerza) => {
    const f = Math.min(1.5, fuerza)
    const e = (FISICA.empuje[0] + (FISICA.empuje[1] - FISICA.empuje[0]) * azar()) * f
    const arriba = (FISICA.vuelo[0] + (FISICA.vuelo[1] - FISICA.vuelo[0]) * azar()) * Math.max(0.45, f)
    aventar(i, ox, oz, vx, vz, e, arriba, 1)
  }

  const yaNoEsta = (s, i) => s.quema[i] >= 1

  const prender = (i, cuando) => {
    const s = recursos.sim
    if (s.quema[i] > 0 || yaNoEsta(s, i)) return
    if (cuando < s.prende[i]) s.prende[i] = cuando
  }

  const soltar = (tipo, x, y, z, vx, vy, vz, dur, tam) => {
    const s = recursos.sim
    const k = s.pSig
    s.pSig = (k + 1) % FUEGO.particulas
    if (s.pvida[k] >= 1) s.pVivas++
    s.ptipo[k] = tipo
    s.px[k] = x; s.py[k] = y; s.pz[k] = z
    s.pvx[k] = vx; s.pvy[k] = vy; s.pvz[k] = vz
    s.pvida[k] = 0; s.pdur[k] = dur; s.ptam[k] = tam
  }

  // Una explosión: avienta todo lo que alcanza y prende lo de cerca.
  const explotar = (e) => {
    const s = recursos.sim
    const ahora = prev.current.t
    const R = Math.max(0.5, e.radio || 4)
    const k = Math.max(0, Math.min(1, e.fuerza ?? 1))
    const R2 = R * R
    for (let i = 0; i < s.n; i++) {
      if (yaNoEsta(s, i)) continue
      const dx = s.x[i] - e.x, dz = s.z[i] - e.z, dy = s.y[i] - (e.y - 0.4)
      const d2 = dx * dx + dz * dz + dy * dy
      if (d2 >= R2) continue
      const d = Math.sqrt(d2)
      const f = 1 - d / R
      const empuje = (FUEGO.explota[0] + (FUEGO.explota[1] - FUEGO.explota[0]) * k) * f * (0.75 + 0.5 * azar())
      const arriba = (FUEGO.explotaArriba[0] + (FUEGO.explotaArriba[1] - FUEGO.explotaArriba[0]) * k) * Math.sqrt(f) * (0.7 + 0.6 * azar())
      aventar(i, e.x, e.z, 0, 0, empuje, arriba, 1.4)
      if (d < R * FUEGO.prende) prender(i, ahora + d * 0.04)
    }
  }

  useEffect(() => escucharExplosiones((e) => { prev.current.explosiones.push(e) }), [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__petalos = {
      recursos,
      PETALOS,
      FISICA,
      FUEGO,
      // Patea los pétalos alrededor de (x, z) como si pasara Skulley.
      patear: (x, z, radio = 1.2, fuerza = 1.3) => {
        const s = recursos.sim
        let k = 0
        for (let i = 0; i < s.n; i++) {
          if (Math.hypot(s.x[i] - x, s.z[i] - z) < radio && !yaNoEsta(s, i)) { levantar(i, x, z, 0, 0, fuerza); k++ }
        }
        return k
      },
      // Una explosión de mentira (como la de la bola de fuego).
      explotar: (x, z, radio = 6, fuerza = 0.5) => { prev.current.explosiones.push({ x, y: 0.4, z, radio, fuerza }) },
      // Prende el pétalo más cercano a (x, z).
      quemar: (x, z) => {
        const s = recursos.sim
        let mejor = -1, md = Infinity
        for (let i = 0; i < s.n; i++) {
          const d = Math.hypot(s.x[i] - x, s.z[i] - z)
          if (d < md && !yaNoEsta(s, i) && s.quema[i] === 0) { md = d; mejor = i }
        }
        if (mejor >= 0) prender(mejor, prev.current.t)
        return mejor
      },
      // Que todos los quemados vuelvan a salir ya.
      reponer: () => { const s = recursos.sim; for (let i = 0; i < s.n; i++) if (yaNoEsta(s, i)) s.regresa[i] = 0 },
      enAire: () => Array.from(recursos.sim.estado).filter((e) => e > 0).length,
      ardiendo: () => Array.from(recursos.sim.quema).filter((q) => q > 0 && q < 1).length,
      quemados: () => Array.from(recursos.sim.quema).filter((q) => q >= 1).length,
      particulas: () => recursos.sim.pVivas,
      jugador: () => playerRef?.current?.position?.toArray(),
      // Lo más que se mete un pétalo en el piso (negativo = se mete), con sus cuatro esquinas.
      bajoPiso: () => {
        const s = recursos.sim
        let peor = Infinity
        const m = new THREE.Matrix4(), e = new THREE.Euler(), v = new THREE.Vector3()
        const alto = recursos.geo.getAttribute('aPetaloInfo')
        for (let i = 0; i < s.n; i++) {
          if (yaNoEsta(s, i)) continue
          e.set(s.pitch[i], s.yaw[i], s.roll[i], 'YZX')
          m.makeRotationFromEuler(e)
          for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
            v.set(a * s.tam[i], 0, -b * s.tam[i]).applyMatrix4(m)
            peor = Math.min(peor, s.y[i] + alto.getZ(i) + v.y)
          }
        }
        return peor
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recursos])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    if (dt <= 0) return
    const s = recursos.sim
    const pr = prev.current
    pr.t += dt
    const ahora = pr.t
    recursos.uniforms.uPetalosTiempo.value = ahora
    let cambio = false
    while (pr.explosiones.length) { explotar(pr.explosiones.shift()); cambio = true }

    const p = playerRef?.current?.position
    let vel = 0
    if (p) {
      if (pr.ok) {
        const vx = (p.x - pr.x) / dt, vz = (p.z - pr.z) / dt
        // Un salto grande (teletransporte, regreso al home, la esfera) no es caminar.
        if (vx * vx + vz * vz < 600) { pr.vx += (vx - pr.vx) * 0.35; pr.vz += (vz - pr.vz) * 0.35 }
        else { pr.vx = 0; pr.vz = 0 }
      }
      pr.x = p.x; pr.z = p.z; pr.ok = true
      vel = Math.hypot(pr.vx, pr.vz)
    }
    // Solo con los pies en el piso.
    const pisa = p && p.y < 0.6 && vel > FISICA.minVel
    const fuerza = vel / FISICA.caminar
    const radio = fuerza > 1.15 ? FISICA.radioCorre : FISICA.radio

    // Lo que arde contagia a sus vecinos: celdas del tamaño del contagio con lo que
    // todavía no prende, armadas solo en los cuadros en que alguien contagia.
    let celdas = null
    const C = FUEGO.contagio
    const llave = (cx, cz) => cx * 73856093 ^ cz * 19349663
    const contagiar = (i) => {
      if (!celdas) {
        celdas = pr.celdas
        celdas.clear()
        for (let j = 0; j < s.n; j++) {
          if (s.quema[j] > 0 || yaNoEsta(s, j)) continue
          const k = llave(Math.floor(s.x[j] / C), Math.floor(s.z[j] / C))
          let l = celdas.get(k)
          if (!l) { l = []; celdas.set(k, l) }
          l.push(j)
        }
      }
      const cx = Math.floor(s.x[i] / C), cz = Math.floor(s.z[i] / C)
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const l = celdas.get(llave(cx + a, cz + b))
          if (!l) continue
          for (const j of l) {
            const d = Math.hypot(s.x[j] - s.x[i], s.z[j] - s.z[i], s.y[j] - s.y[i])
            if (d < C) prender(j, ahora + d / FUEGO.velocidad + azar() * 0.08)
          }
        }
      }
    }

    // Para los sonidos: cuántos prendieron, ardieron y brotaron, y dónde.
    let prendidos = 0, px = 0, pz = 0, ardiendo = 0, fx = 0, fz = 0, brotan = 0, bx = 0, bz = 0
    for (let i = 0; i < s.n; i++) {
      // Fuego: prende a su hora, arde, contagia, suelta chispas y ceniza, y se va.
      if (s.prende[i] <= ahora) {
        s.prende[i] = Infinity
        if (s.quema[i] === 0 && !yaNoEsta(s, i)) {
          s.quema[i] = 1e-4; s.contagio[i] = 0; s.ceniza[i] = 0; s.brota[i] = 0
          prendidos++; px += s.x[i]; pz += s.z[i]
        }
      }
      const q = s.quema[i]
      if (q > 0 && q < 1) {
        cambio = true
        ardiendo++; fx += s.x[i]; fz += s.z[i]
        const qn = Math.min(1, q + dt / s.durQ[i])
        s.quema[i] = qn
        if (!s.contagio[i] && qn >= FUEGO.contagiaEn) { s.contagio[i] = 1; contagiar(i) }
        if (qn > 0.06 && qn < 0.62 && azar() < FUEGO.chispasPorS * dt) {
          soltar(CHISPA, s.x[i] + (azar() - 0.5) * 0.15, s.y[i] + 0.05, s.z[i] + (azar() - 0.5) * 0.15,
            (azar() - 0.5) * 0.6, 1.4 + azar() * 1.6, (azar() - 0.5) * 0.6, 0.55 + azar() * 0.5, 0.045 + azar() * 0.035)
        }
        if (!s.ceniza[i] && qn >= 0.62) {
          s.ceniza[i] = 1
          for (let k = 0; k < FUEGO.cenizas; k++) {
            soltar(CENIZA, s.x[i] + (azar() - 0.5) * s.tam[i] * 0.6, s.y[i] + 0.03, s.z[i] + (azar() - 0.5) * s.tam[i] * 0.6,
              (azar() - 0.5) * 0.35, 0.35 + azar() * 0.6, (azar() - 0.5) * 0.35, 1.3 + azar() * 1.0, 0.035 + azar() * 0.03)
          }
        }
        if (qn >= 1) {
          s.regresa[i] = ahora + FUEGO.repone + azar() * FUEGO.reponeAzar
          s.estado[i] = 0
          s.vx[i] = s.vy[i] = s.vz[i] = 0
        }
      } else if (q >= 1 && ahora >= s.regresa[i]) {
        // Cae uno nuevo del cielo sobre donde estaba: aparece creciendo y planea.
        s.regresa[i] = Infinity
        s.quema[i] = 0
        s.x[i] = s.x0[i] + (azar() - 0.5) * 0.5; s.z[i] = s.z0[i] + (azar() - 0.5) * 0.5; s.yaw[i] = s.yaw0[i]
        s.y[i] = FUEGO.caeDe[0] + (FUEGO.caeDe[1] - FUEGO.caeDe[0]) * azar()
        s.pitch[i] = (azar() - 0.5) * 1.4; s.roll[i] = (azar() - 0.5) * 1.4
        s.vx[i] = 0; s.vz[i] = 0; s.vy[i] = -0.3
        s.wy[i] = (azar() - 0.5) * 2; s.wp[i] = (azar() - 0.5) * 3; s.wr[i] = (azar() - 0.5) * 2
        s.estado[i] = 1
        s.brota[i] = -1
        brotan++; bx += s.x[i]; bz += s.z[i]
        cambio = true
      }
      if (s.brota[i] < 0) { s.brota[i] = Math.min(0, s.brota[i] + dt / FUEGO.brotaS); cambio = true }
      if (yaNoEsta(s, i)) continue

      if (s.espera[i] > 0) s.espera[i] -= dt
      if (pisa && s.estado[i] !== 1 && s.espera[i] <= 0) {
        const dx = s.x[i] - p.x, dz = s.z[i] - p.z
        if (dx * dx + dz * dz < radio * radio) levantar(i, p.x, p.z, pr.vx, pr.vz, fuerza)
      }
      const e = s.estado[i]
      if (e === 0) continue
      cambio = true
      if (e === 1) {
        // En el aire: cae hasta su velocidad tope, el aire lo frena y al bajar se mece.
        s.vy[i] = Math.max(s.vy[i] - FISICA.gravedad * dt, -s.caida[i])
        const freno = Math.exp(-FISICA.aire * dt)
        s.vx[i] *= freno; s.vz[i] *= freno
        if (s.vy[i] < 0) {
          const a = FISICA.aleteo * (s.flor[i] ? 0.2 : 1)
          s.vx[i] += Math.sin(ahora * 6.1 + s.fase[i]) * a * dt
          s.vz[i] += Math.cos(ahora * 5.3 + s.fase[i] * 1.7) * a * dt
          s.wp[i] += Math.sin(ahora * 7.3 + s.fase[i]) * 9 * dt
        }
        const giroFreno = Math.exp(-1.1 * dt)
        s.wy[i] *= giroFreno; s.wp[i] *= giroFreno; s.wr[i] *= giroFreno
        s.yaw[i] += s.wy[i] * dt
        s.pitch[i] += s.wp[i] * dt
        s.roll[i] += s.wr[i] * dt
        s.x[i] += s.vx[i] * dt
        s.z[i] += s.vz[i] * dt
        s.y[i] += s.vy[i] * dt
        // De subida también: girando rápido, una esquina bajaba más rápido de lo que subía él.
        const piso = levante(s, i)
        if (s.y[i] <= piso) {
          s.y[i] = piso
          if (s.vy[i] <= 0) {
            s.vy[i] = 0
            s.vx[i] *= 0.3; s.vz[i] *= 0.3
            s.wy[i] *= 0.2
            s.estado[i] = 2
          }
        }
      } else {
        // En el piso: se acuesta de cara o de espaldas (lo más cerca) y resbala tantito.
        const k = 1 - Math.exp(-FISICA.asienta * (s.flor[i] ? 0.6 : 1) * dt)
        const tp = Math.round(s.pitch[i] / Math.PI) * Math.PI
        const tr = Math.round(s.roll[i] / Math.PI) * Math.PI
        s.pitch[i] += (tp - s.pitch[i]) * k
        s.roll[i] += (tr - s.roll[i]) * k
        const roce = Math.exp(-FISICA.roce * dt)
        s.vx[i] *= roce; s.vz[i] *= roce; s.wy[i] *= roce
        s.x[i] += s.vx[i] * dt
        s.z[i] += s.vz[i] * dt
        s.yaw[i] += s.wy[i] * dt
        s.y[i] = levante(s, i)
        if (Math.abs(tp - s.pitch[i]) < 0.002 && Math.abs(tr - s.roll[i]) < 0.002 && s.vx[i] * s.vx[i] + s.vz[i] * s.vz[i] < 1e-4) {
          // Ángulos de vuelta a una vuelta: de cara (0) o de espaldas (π).
          s.pitch[i] = ((Math.round(tp / Math.PI) % 2) + 2) % 2 ? Math.PI : 0
          s.roll[i] = ((Math.round(tr / Math.PI) % 2) + 2) % 2 ? Math.PI : 0
          s.y[i] = 0
          s.estado[i] = 0
          s.espera[i] = FISICA.espera
        }
      }
    }

    // Chispas (suben y se frenan) y ceniza (sube despacio meciéndose).
    if (s.pVivas > 0) {
      cambio = true
      for (let k = 0; k < FUEGO.particulas; k++) {
        if (s.pvida[k] >= 1) continue
        const v = s.pvida[k] + dt / s.pdur[k]
        if (v >= 1) { s.pvida[k] = 1; s.pVivas--; continue }
        s.pvida[k] = v
        const chispa = s.ptipo[k] === CHISPA
        const freno = Math.exp(-(chispa ? 2.2 : 1.2) * dt)
        s.pvx[k] *= freno; s.pvz[k] *= freno; s.pvy[k] *= freno
        if (!chispa) {
          s.pvx[k] += Math.sin(ahora * 3.1 + k) * 0.5 * dt
          s.pvz[k] += Math.cos(ahora * 2.7 + k * 1.3) * 0.5 * dt
        }
        s.px[k] += s.pvx[k] * dt
        s.py[k] += s.pvy[k] * dt
        s.pz[k] += s.pvz[k] * dt
      }
    }

    // Los sonidos, desde Skulley y del lado de la pantalla donde pasa.
    if (prendidos || ardiendo || brotan || pr.sonaba) {
      const derecha = pr.derecha.setFromMatrixColumn(state.camera.matrixWorld, 0)
      const ox = p ? p.x : state.camera.position.x, oz = p ? p.z : state.camera.position.z
      const donde = (x, z) => ubicarSonido(x - ox, z - oz, derecha)
      if (prendidos) sonarPrenden(prendidos, donde(px / prendidos, pz / prendidos))
      if (brotan) sonarBrota(donde(bx / brotan, bz / brotan))
      sonarFuego(ardiendo, dt, ardiendo ? donde(fx / ardiendo, fz / ardiendo) : null)
      pr.sonaba = ardiendo > 0
    }
    if (!cambio) return
    const aPos = recursos.geo.getAttribute('aPetalo')
    const aGiro = recursos.geo.getAttribute('aPetaloGiro')
    const aInfo = recursos.geo.getAttribute('aPetaloInfo')
    const P = aPos.array, G = aGiro.array, I = aInfo.array
    for (let i = 0; i < s.n; i++) {
      P[i * 4] = s.x[i]; P[i * 4 + 1] = s.y[i]; P[i * 4 + 2] = s.z[i]; P[i * 4 + 3] = s.yaw[i]
      G[i * 2] = s.pitch[i]; G[i * 2 + 1] = s.roll[i]
      I[i * 4 + 3] = s.quema[i] > 0 ? s.quema[i] : s.brota[i]
    }
    for (let k = 0; k < FUEGO.particulas; k++) {
      const o = (s.n + k) * 4
      P[o] = s.px[k]; P[o + 1] = s.py[k]; P[o + 2] = s.pz[k]
      I[o] = s.pvida[k] >= 1 ? 0 : s.ptam[k]
      I[o + 1] = s.ptipo[k]
      I[o + 3] = s.pvida[k]
    }
    aPos.needsUpdate = true
    aGiro.needsUpdate = true
    aInfo.needsUpdate = true
  })

  return <mesh geometry={recursos.geo} material={recursos.mat} frustumCulled={false} />
}
