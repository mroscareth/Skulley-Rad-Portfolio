import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSkinForcedColors, SKIN_LINE_COLOR_EVENT } from '../../lib/skinShaders.js'
import { getCharacterColors, CHARACTER_COLOR_EVENT } from '../../lib/characterColors.js'
import { uniformsLlama } from '../../lib/toonBanding.js'

// La llama de la mano de Skulley, con todas las skins (Oscar, 2026-11-15: la
// esfera verde era provisional mientras se hacía este shader). Referencia de
// Oscar: el fuego toon de Blender (video "Easy Blender Fire", seg. 3 a 9): un
// fluido en bandas duras por densidad, con gotas que se cortan de la punta.
//
// Es un sistema de partículas, como el fuego estilizado de los juegos: cada
// bocanada nace en la mano con buena parte de su velocidad, flota con el calor,
// el aire la frena y la turbulencia la remueve; crece rápido, se encoge y se
// apaga en menos de medio segundo. Juntas se funden en un campo de metaballs
// con bandas duras (un centro claro donde hay más fuego, sin llegar a blanco;
// clara, media y orilla oscura). La forma cambia sola: quieta es una llama de
// pie; al mover la mano suelta una lengua que se queda donde nació y se consume.
//
// Bola de fuego (la E, con `disparoRef`, solo en Player; desde 2026-11-15 con
// todas las skins, en lugar del rayo): al cargar, la esfera crece y la llama con
// ella; al soltar, la llama deja la mano y vuela a la mira dejando su estela, al
// llegar explota (la explosión de cómic de LaserBeam) y luego vuelve a crecer en
// la mano. Player espera el viaje para el empujón y el temblor.
//
// Cada bola va sola en el mundo: ninguna malla hereda nada de Skulley
// (`matrixWorldAutoUpdate` apagado; las bolas y las brasas se quedan en la
// identidad). Antes vivían en su grupo con el padre compensado, pero esa cuenta
// lleva un cuadro de atraso (este useFrame corre antes que el de Player) y, al
// cargar el siguiente disparo, Skulley gira hacia la mira nueva y arrastraba las
// bolas en vuelo hasta 4 unidades (Oscar: "se regresan o quieren ir al nuevo
// target"). La llama de la mano se recorre a la esfera al dibujarse.
//
// Lo que ya se probó y no (Oscar): una gota 3D con bandas por fresnel ("un
// coco"), la forma estirándose o con resorte ("elástica"), una cadena que se
// dobla ("un moco que gira"), una llama de pie con estela aparte ("sigue
// apuntando hacia arriba") y una columna que seguía a la mano ("una línea que
// dura siempre").
//
// Dibujo: un cuadro que siempre mira a la cámara; el campo se deforma con ruido
// que sube y que el viento arrastra, más en lo alto, que se deshilacha. Las
// gotas van aparte (el máximo, no la suma: sumadas, la llama se les pegaba).
// Colores del orbe del configurador. Las brasas se quedan en el mundo.
//
// Va pegada a `Egg_EnergyBall` (la busca en `raiz`) y mide en radios de la
// esfera: crece con ella (la carga de la E la infla) y se encoge con ella (la historia
// la esconde). La esfera se oculta mientras arde, y su contorno de tinta. Si
// cambia el modelo (la skin dorada trae el suyo) la busca otra vez. Siempre
// montada: sin esfera visible se queda en count = 0, que igual compila su
// programa en el warm-up. `cuerpoPropio`: el modo wallpaper la deja como parte
// del cuerpo y le pide su propia máscara.
//
// Alumbra a Skulley (Oscar, 2026-11-15: "que produzca algo de luz sin ser
// exagerada"): lo cercano que mira a la llama se tiñe de su banda clara, en dos
// bandas duras, desde el banding de sus materiales (`uniformsLlama` en
// toonBanding.js; este componente les enlaza su posición, color y fuerza). Una
// pointLight real no servía: el banding aplana lo que cae en la banda iluminada
// y el verde no rebota en el rojo del cuerpo ni en el azul del piso, así que
// no se veía, y costaba una luz más en cada material. Va con el fuego: en la
// mano, con la bola más reciente mientras vuela y un destello corto donde
// explota. Se mide en el radio de la esfera en reposo, así se ve igual en el
// juego, el retrato y el rig.

// Lugares en el campo para bocanadas (mano y bola usan el mismo shader).
const MAX = 64
// Bocanadas de la mano: cuántas nacen por segundo, cuánto viven (s), qué tanto
// de la velocidad de la mano heredan, aire (1/s), empuje del calor y remolino
// (radios/s²), subida al nacer (radios/s) y tamaño (radios).
const FUEGO = {
  porSegundo: 84,
  vida: [0.3, 0.5],
  hereda: 0.82,
  aire: 3.2,
  empuje: 26,
  remolino: 26,
  subida: 3.5,
  tam: [0.54, 0.84],
  base: 0.58,
}
// La bola en vuelo: su tamaño sale del de la llama al soltarla. Va recta y rápida
// como el rayo (Oscar). La cabeza es un núcleo con bocanadas que viajan con ella
// (heredan casi toda su velocidad y viven poco: no se riegan por el camino, que
// el cuadro de la cabeza las cortaba) y chispas a lo largo.
const BOLA = { porSegundo: 160, vida: [0.12, 0.22], hereda: 0.95, aire: 0.6, tam: [0.5, 0.9], base: 0.85, chispas: 90 }
// La estela: una franja de fuego de la mano a la bola, con las mismas bandas,
// como el trayecto del rayo. Su cola persigue a la cabeza con `cola` segundos de
// atraso y, al explotar, la alcanza y se consume en `fin` segundos. Ancho en
// unidades de la bola.
const ESTELA = { cola: 0.16, fin: 0.25, ancho: 1.1 }
// Bolas que conviven en el aire (disparos seguidos); si se acaban, cede la que
// se disparó primero, de preferencia una que ya explotó. Con 4 y eligiendo por su
// reloj (que se reinicia al explotar) se reusaba una en vuelo y brincaba de
// regreso a la mano (Oscar: "como si retrocedieran").
const BOLAS = 8
// La llama vuelve a la mano después de explotar la bola.
const RENACE = { espera: 0.12, dura: 0.6 }
// Umbrales de las bandas sobre la densidad del campo. La orilla manda y el
// centro es un núcleo chico (Oscar).
const BANDAS = { halo: 0.22, hondo: 0.42, medio: 0.95, claro: 1.55, centro: 3.1 }
const GOTAS = 6
// Grupos de bocanadas para el descarte barato del shader (ver `agrupa`).
const GRUPOS = 8
const BRASAS = 96
const BRASA = { base: 3, porVelocidad: 1.2, tope: 40 }
// Cada cuadro se recorta a donde hay fuego (`ajustaCuadro`). Esto es solo un
// tope de seguridad, en su unidad (medio ancho, medio alto y centro x, y), lejos
// de cualquier llama real: una bocanada que pasara detrás de la cámara saldría
// disparada en la proyección. El tope de antes, 11 × 10 radios, mordía en línea
// recta las lenguas que la mano suelta al moverse rápido, que se quedan atrás
// más lejos que eso (Oscar, 2026-11-15); las gotas viven hasta 1.3 s.
const CUADRO_MANO = [120, 120, 0, 0]
const CUADRO_BOLA = [120, 120, 0, 0]
// Lo más que el ruido mueve lo que se lee del campo: w ∈ ±0.5 por (0.3 + 1.2·h).
const DEFORMA = 0.75
// La luz, relativa a la llama de la mano en reposo: cuánto parpadea, cuánto
// crece con la carga (tope del tamaño relativo), cuánto alumbra la bola en vuelo
// respecto a la mano y el destello al explotar (veces la bola y segundos).
const LUZ = { parpadeo: 0.16, tope: 1.8, bola: 1.1, destello: 1.8, destelloDura: 0.3 }
// El derrame sobre el propio Skulley (toonBanding): cuánto toma el color de la
// llama en la banda fuerte (0..1; la débil toma 0.4 de eso), hasta dónde llega
// (en radios de la esfera en reposo; crece con la llama) y el umbral de la
// banda fuerte (la débil va a 0.45 de él). Cada cuánto (s) se vuelven a enlazar sus materiales, por si una
// skin los cambió.
const DERRAME = { fuerza: 0.78, alcance: 4.2, umbral: 0.45, enlace: 0.5 }

function hash1(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
function ruido1(x) {
  const i = Math.floor(x)
  let f = x - i
  f = f * f * (3 - 2 * f)
  return hash1(i) * (1 - f) + hash1(i + 1) * f
}
const azar = (a, b) => a + Math.random() * (b - a)

const VERT = /* glsl */`
uniform float uR;
uniform vec4 uCuadro;
varying vec2 vF;
void main(){
  // Coordenadas del campo en su unidad (el radio de la esfera en la mano, el de
  // la bola en vuelo): x a lo ancho, y hacia arriba de la pantalla.
  vF = vec2(position.x * 2.0 * uCuadro.x + uCuadro.z, position.y * 2.0 * uCuadro.y + uCuadro.w);
  mat4 m = mat4(1.0);
  #ifdef USE_INSTANCING
    m = instanceMatrix;
  #endif
  vec4 centro = modelViewMatrix * m * vec4(0.0, 0.0, 0.0, 1.0);
  centro.xy += vF * uR;
  gl_Position = projectionMatrix * centro;
}
`

const FRAG = /* glsl */`
uniform float uT;
uniform vec2 uFlujo;
uniform vec3 uBase;
uniform int uN;
uniform vec4 uFuego[${MAX}];
uniform vec4 uGotas[${GOTAS}];
uniform vec4 uGrupo[${GRUPOS}];
uniform float uGrupoPeso[${GRUPOS}];
uniform vec3 uHondo;
uniform vec3 uMedio;
uniform vec3 uClaro;
uniform vec3 uCentro;
varying vec2 vF;

// Ruido que evoluciona (la tercera coordenada es el tiempo): si solo se
// desliza hacia arriba se lee como banda transportadora, predecible.
float llH3(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float llN3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(llH3(i), llH3(i+vec3(1.0,0.0,0.0)), f.x), mix(llH3(i+vec3(0.0,1.0,0.0)), llH3(i+vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(llH3(i+vec3(0.0,0.0,1.0)), llH3(i+vec3(1.0,0.0,1.0)), f.x), mix(llH3(i+vec3(0.0,1.0,1.0)), llH3(i+vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z);
}
float llFbm(vec3 p){ return llN3(p)*0.6 + llN3(p*2.1 + 3.7)*0.3 + llN3(p*4.3 + 1.3)*0.1; }
float bola(vec2 p, vec2 c, float r){ vec2 d = (p - c) / r; return exp(-dot(d, d)); }
// Lo más que puede valer bola(q, c, r) para cualquier q a no más de d de p.
float cotaBola(vec2 p, vec2 c, float r, float d){ float e = max(length(p - c) - d, 0.0) / r; return exp(-e*e); }

void main(){
  vec2 p = vF;
  float t = uT;
  // Ruido que sube y que el viento arrastra (uFlujo se acumula en JS). Más
  // arriba de la base deforma más: ahí se deshilacha en lenguas que se cortan.
  float h = clamp((p.y - uBase.y + 0.5) / 4.0, 0.0, 1.0);
  // Antes de pagar el ruido: lo más que puede leer este pixel si el ruido lo
  // llevara lo más cerca posible de cada bocanada (w mide a lo más √2/2). Si
  // ni así llega a la orilla, se descarta: exacto, no cambia ningún pixel, y
  // es la mayor parte del cuadro (en la primera pantalla del teléfono la mano
  // queda fuera y solo el margen entraba a cuadro). Primero por grupos: cada
  // uno cubre a sus bocanadas con una bola (centro, radio que las alcanza, su
  // radio más grande y la suma de sus pesos), así lo lejano se va en 8 cuentas;
  // lo que pasa se revisa bocanada por bocanada, cortando en cuanto pasa.
  float alcance = 0.7072 * (0.3 + 1.2*h);
  float cotaBase = uBase.z > 1e-3 ? 0.9 * cotaBola(p, uBase.xy, uBase.z, alcance) : 0.0;
  float cota = cotaBase;
  for (int i = 0; i < ${GRUPOS}; i++) {
    vec4 g = uGrupo[i];
    float e = max(length(p - g.xy) - g.z - alcance, 0.0) / max(g.w, 1e-4);
    cota += uGrupoPeso[i] * exp(-e*e);
  }
  if (cota >= ${BANDAS.halo.toFixed(2)}) {
    cota = cotaBase;
    for (int i = 0; i < ${MAX}; i++) {
      if (i >= uN || cota >= ${BANDAS.halo.toFixed(2)}) break;
      vec4 b = uFuego[i];
      cota += b.w * cotaBola(p, b.xy, b.z, alcance);
    }
  }
  if (cota < ${BANDAS.halo.toFixed(2)}) {
    float cg = 0.0;
    for (int i = 0; i < ${GOTAS}; i++) cg = max(cg, cotaBola(p, uGotas[i].xy, max(uGotas[i].z, 1e-3), 0.2476) * step(1e-3, uGotas[i].z));
    if (cg * ${BANDAS.claro.toFixed(2)} < ${BANDAS.halo.toFixed(2)}) discard;
  }
  vec2 pr = p * vec2(0.9, 0.8) - uFlujo;
  vec2 w = vec2(
    llFbm(vec3(pr, t*0.9)),
    llFbm(vec3(pr + vec2(5.2, 1.7), t*0.9 + 4.0))
  ) - 0.5;
  vec2 q = p + w * (0.3 + 1.2*h);
  // La base (la mano o la bola) y las bocanadas (xy, tamaño, calor).
  float f = uBase.z > 1e-3 ? 0.9 * bola(q, uBase.xy, uBase.z) : 0.0;
  // Solo las vivas: JS las junta al frente y dice cuántas son.
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uN) break;
    vec4 b = uFuego[i];
    f += b.w * bola(q, b.xy, b.z);
  }
  // Las gotas, cada una por su lado.
  vec2 qg = p + w * 0.35;
  float g = 0.0;
  for (int i = 0; i < ${GOTAS}; i++) g = max(g, bola(qg, uGotas[i].xy, max(uGotas[i].z, 1e-3)) * step(1e-3, uGotas[i].z));
  // Una gota sola llega a 1: se lee en las bandas como una bocanada.
  float k = max(f, g * ${BANDAS.claro.toFixed(2)});
  if (k < ${BANDAS.halo.toFixed(2)}) discard;
  vec3 col = k > ${BANDAS.centro.toFixed(2)} ? uCentro
           : (k > ${BANDAS.claro.toFixed(2)} ? uClaro
           : (k > ${BANDAS.medio.toFixed(2)} ? uMedio : uHondo));
  // Afuera de la orilla, un resplandor tenue (sin bloom en el preloader).
  float alfa = k > ${BANDAS.hondo.toFixed(2)} ? 1.0 : smoothstep(${BANDAS.halo.toFixed(2)}, ${BANDAS.hondo.toFixed(2)}, k) * 0.3;
  gl_FragColor = vec4(col, alfa);
}
`

// La franja de la estela: de la mano (uDe) a la mira (uA), de frente a la cámara,
// armada en el espacio de la vista; la perspectiva la adelgaza sola a lo lejos.
const VERT_ESTELA = /* glsl */`
uniform vec3 uDe;
uniform vec3 uA;
uniform float uAncho;
varying vec2 vUv;
void main(){
  float a = position.x + 0.5;
  vec3 vd = (modelViewMatrix * vec4(uDe, 1.0)).xyz;
  vec3 va = (modelViewMatrix * vec4(uA, 1.0)).xyz;
  vec3 v = mix(vd, va, a);
  vec2 d = va.xy - vd.xy;
  float l = length(d);
  vec2 lado = l > 1e-5 ? vec2(-d.y, d.x) / l : vec2(0.0, 1.0);
  v.xy += lado * position.y * 2.0 * uAncho;
  vUv = vec2(a, position.y * 2.0);
  gl_Position = projectionMatrix * vec4(v, 1.0);
}
`

const FRAG_ESTELA = /* glsl */`
uniform float uT;
uniform float uCola;
uniform float uCabeza;
uniform float uFin;
uniform float uLargo;
uniform vec3 uHondo;
uniform vec3 uMedio;
uniform vec3 uClaro;
uniform vec3 uCentro;
varying vec2 vUv;
float llH3(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float llN3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(llH3(i), llH3(i+vec3(1.0,0.0,0.0)), f.x), mix(llH3(i+vec3(0.0,1.0,0.0)), llH3(i+vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(llH3(i+vec3(0.0,0.0,1.0)), llH3(i+vec3(1.0,0.0,1.0)), f.x), mix(llH3(i+vec3(0.0,1.0,1.0)), llH3(i+vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z);
}
float llFbm(vec3 p){ return llN3(p)*0.6 + llN3(p*2.1 + 3.7)*0.3 + llN3(p*4.3 + 1.3)*0.1; }
void main(){
  float x = vUv.x;
  if (x > uCabeza || x < uCola) discard;
  // 0 en la cola, 1 en la cabeza: ahí es más ancha y más densa.
  float s = clamp((x - uCola) / max(uCabeza - uCola, 1e-3), 0.0, 1.0);
  float ancho = mix(0.2, 1.0, pow(s, 0.6));
  // Turbulencia que corre de la cabeza hacia la cola y deshilacha la orilla.
  float n = llFbm(vec3(x * uLargo * 0.45 + uT * 7.0, vUv.y * 1.6, uT * 1.3));
  float borde = abs(vUv.y) + (n - 0.5) * 0.7;
  float k = (1.0 - borde / ancho) * 1.7 * (0.55 + 0.45 * s) - uFin * 1.8;
  if (k < 0.15) discard;
  vec3 col = k > 1.35 ? uCentro : (k > 0.95 ? uClaro : (k > 0.5 ? uMedio : uHondo));
  gl_FragColor = vec4(col, 1.0);
}
`

const VERT_BRASA = /* glsl */`
varying vec2 vUv;
void main(){
  vUv = position.xy * 2.0;
  mat4 m = mat4(1.0);
  #ifdef USE_INSTANCING
    m = instanceMatrix;
  #endif
  vec4 c = modelViewMatrix * vec4(m[3].xyz, 1.0);
  c.xy += vUv * length(m[0].xyz);
  gl_Position = projectionMatrix * c;
}
`

const FRAG_BRASA = /* glsl */`
uniform vec3 uHondo;
uniform vec3 uMedio;
uniform vec3 uClaro;
varying vec2 vUv;
void main(){
  float d = length(vUv);
  if (d > 1.0) discard;
  gl_FragColor = vec4(d < 0.45 ? uClaro : (d < 0.75 ? uMedio : uHondo), 1.0);
}
`

function visibleSusPadres(o) {
  for (let x = o.parent; x; x = x.parent) if (!x.visible) return false
  const m = o.material
  if (m && m.transparent && m.opacity < 0.5) return false
  return true
}

const particula = () => ({ vivo: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0, edad: 0, vida: 1, semilla: 0, unidad: 1, empuje: 0, aire: 0, remolino: 0 })

// Los uniforms de un campo: los colores se comparten (mano, bola y brasas).
function uniformsCampo(colores) {
  return {
    uT: { value: 0 },
    uR: { value: 1 },
    uCuadro: { value: new THREE.Vector4(...CUADRO_MANO) },
    uFlujo: { value: new THREE.Vector2() },
    uBase: { value: new THREE.Vector3() },
    uN: { value: 0 },
    uFuego: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uGotas: { value: Array.from({ length: GOTAS }, () => new THREE.Vector4()) },
    uGrupo: { value: Array.from({ length: GRUPOS }, () => new THREE.Vector4()) },
    uGrupoPeso: { value: new Array(GRUPOS).fill(0) },
    ...colores,
  }
}
const materialCampo = (uniforms) => new THREE.ShaderMaterial({
  uniforms,
  vertexShader: VERT,
  fragmentShader: FRAG,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
})

const nuevaBola = () => ({
  activa: false,
  fase: 'vuela',
  t: 0,
  dur: 0.3,
  de: new THREE.Vector3(),
  a: new THREE.Vector3(),
  centro: new THREE.Vector3(),
  pos: new THREE.Vector3(),
  antes: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  U: 1,
  radio: 2,
  fuerza: 0,
  nacio: 0,
  fuego: Array.from({ length: MAX }, particula),
  acc: 0,
  accChispa: 0,
})

const uniformsEstela = (colores) => ({
  uT: { value: 0 },
  uDe: { value: new THREE.Vector3() },
  uA: { value: new THREE.Vector3() },
  uAncho: { value: 0.1 },
  uCola: { value: 0 },
  uCabeza: { value: 0 },
  uFin: { value: 0 },
  uLargo: { value: 1 },
  ...colores,
})

export default function LlamaMano({ raiz, disparoRef = null }) {
  const llamaRef = useRef(null)
  const brasasRef = useRef(null)
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const colores = useMemo(() => ({
    uHondo: { value: new THREE.Color() },
    uMedio: { value: new THREE.Color() },
    uClaro: { value: new THREE.Color() },
    uCentro: { value: new THREE.Color() },
  }), [])
  const uMano = useMemo(() => uniformsCampo(colores), [colores])

  // La paleta sale del color del orbe (el de la skin si lo fuerza).
  useEffect(() => {
    const blanco = new THREE.Color(1, 1, 1)
    const pinta = () => {
      const hex = getSkinForcedColors()?.orb || getCharacterColors().orb || '#00ff00'
      const base = new THREE.Color(hex)
      colores.uMedio.value.copy(base)
      colores.uHondo.value.copy(base).multiplyScalar(0.32)
      // El centro, apenas más claro que la banda clara (Oscar: blanco no).
      colores.uClaro.value.copy(base).lerp(blanco, 0.38)
      colores.uCentro.value.copy(base).lerp(blanco, 0.7)
    }
    pinta()
    window.addEventListener(CHARACTER_COLOR_EVENT, pinta)
    window.addEventListener(SKIN_LINE_COLOR_EVENT, pinta)
    return () => {
      window.removeEventListener(CHARACTER_COLOR_EVENT, pinta)
      window.removeEventListener(SKIN_LINE_COLOR_EVENT, pinta)
    }
  }, [colores])

  const matMano = useMemo(() => materialCampo(uMano), [uMano])
  // Casillas de bola de fuego: cada disparo ocupa una con su cabeza, su estela y
  // su explosión, así que uno nuevo no borra al anterior (Oscar). Mismo código
  // de shader en todas: comparten programa.
  const casillas = useMemo(() => Array.from({ length: BOLAS }, () => {
    const uB = uniformsCampo(colores)
    const uE = uniformsEstela(colores)
    return {
      uB,
      uE,
      matB: materialCampo(uB),
      matE: new THREE.ShaderMaterial({
        uniforms: uE,
        vertexShader: VERT_ESTELA,
        fragmentShader: FRAG_ESTELA,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
      bola: nuevaBola(),
      refB: { current: null },
      refE: { current: null },
    }
  }), [colores])
  const matBrasa = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uHondo: colores.uHondo, uMedio: colores.uMedio, uClaro: colores.uClaro },
    vertexShader: VERT_BRASA,
    fragmentShader: FRAG_BRASA,
    toneMapped: false,
  }), [colores])

  const s = useRef({
    raiz: null,
    orbe: null,
    contorno: null,
    oculta: false,
    radio: 1,
    escalaReposo: 1,
    luzPos: new THREE.Vector3(),
    luzI: 0,
    luzColor: new THREE.Color(),
    luzParams: new THREE.Vector3(0, 1, DERRAME.umbral),
    enlace: 0,
    Rultimo: 0,
    t: 0,
    previo: new THREE.Vector3(),
    hayPrevio: false,
    vel: new THREE.Vector3(),
    fuego: Array.from({ length: MAX }, particula),
    fuegoAcc: 0,
    renace: 1,
    esperaRenace: 0,
    gotas: Array.from({ length: GOTAS }, particula),
    sigueGota: 0,
    brasas: Array.from({ length: BRASAS }, particula),
    brasaAcc: 0,
    ultimoDisparo: null,
    tmp: new THREE.Vector3(),
    der: new THREE.Vector3(),
    arr: new THREE.Vector3(),
    vista: new THREE.Matrix4(),
    perspectiva: true,
    vc: new THREE.Vector3(),
    vp: new THREE.Vector3(),
    proy: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    esc: new THREE.Vector3(),
    P: new THREE.Vector3(),
    S: new THREE.Vector3(),
    m: new THREE.Matrix4(),
  })

  // La llama de la mano se arma con la pose del cuadro anterior (este useFrame
  // corre antes que el de Player): al dibujarse se recorre a donde está la esfera
  // ya posada, si no se quedaba atrás de la mano caminando (hasta 0.44 unidades).
  // Y si no hay fuego posible a cuadro no se dibuja: cada bocanada vale a lo
  // más su peso a la distancia del pixel de la pantalla más cercano, menos lo
  // que el ruido puede mover lo leído (1.5 × √2/2; 0.35 × √2/2 las gotas), y si
  // ni la suma llega a la orilla, nada se vería (en la primera pantalla del
  // teléfono la mano queda fuera y el margen del cuadro pagaba el 36 % de la
  // pantalla). La pantalla en el campo: la vista a la profundidad de la mano,
  // en radios, igual que el cuadro.
  useEffect(() => {
    const llama = llamaRef.current
    if (!llama) return undefined
    const centro = new THREE.Vector3()
    const vista = new THREE.Vector3()
    const esquina = new THREE.Vector3()
    const caja = [0, 0, 0, 0]
    const aporte = (x, y, r, peso, alcance) => {
      const dx = Math.max(caja[0] - x, 0, x - caja[1])
      const dy = Math.max(caja[2] - y, 0, y - caja[3])
      const e = Math.max(Math.hypot(dx, dy) - alcance, 0) / Math.max(r, 1e-6)
      return peso * Math.exp(-e * e)
    }
    const fuegoAcuadro = (camera) => {
      const R = uMano.uR.value
      esquina.copy(centro).project(camera)
      const z = esquina.z
      if (!(R > 0) || !(z > -1 && z < 1)) return true
      vista.copy(centro).applyMatrix4(camera.matrixWorldInverse)
      esquina.set(-1, -1, z).applyMatrix4(camera.projectionMatrixInverse)
      const ax = (esquina.x - vista.x) / R
      const ay = (esquina.y - vista.y) / R
      esquina.set(1, 1, z).applyMatrix4(camera.projectionMatrixInverse)
      const bx = (esquina.x - vista.x) / R
      const by = (esquina.y - vista.y) / R
      caja[0] = Math.min(ax, bx); caja[1] = Math.max(ax, bx)
      caja[2] = Math.min(ay, by); caja[3] = Math.max(ay, by)
      const base = uMano.uBase.value
      const fuego = uMano.uFuego.value
      let suma = base.z > 1e-3 ? aporte(base.x, base.y, base.z, 0.9, 1.0608) : 0
      for (let i = 0; i < uMano.uN.value && suma < BANDAS.halo; i += 1) {
        suma += aporte(fuego[i].x, fuego[i].y, fuego[i].z, fuego[i].w, 1.0608)
      }
      if (suma >= BANDAS.halo) return true
      for (const g of uMano.uGotas.value) {
        if (g.z > 1e-3 && aporte(g.x, g.y, g.z, BANDAS.claro, 0.2476) >= BANDAS.halo) return true
      }
      return false
    }
    // Se apaga solo para este dibujo: otro con otra cámara en el mismo cuadro
    // (la captura del wallpaper) vuelve a preguntar.
    let apagada = false
    llama.onBeforeRender = (renderer, scene, camera) => {
      const st = s.current
      if (!st.orbe) return
      st.orbe.getWorldPosition(centro)
      llama.matrixWorld.makeTranslation(centro.x - st.P.x, centro.y - st.P.y, centro.z - st.P.z)
      if (llama.count > 0 && camera && !fuegoAcuadro(camera)) {
        llama.count = 0
        apagada = true
      }
    }
    llama.onAfterRender = () => {
      if (!apagada) return
      llama.count = 1
      apagada = false
    }
    return () => {
      llama.onBeforeRender = () => {}
      llama.onAfterRender = () => {}
    }
  }, [uMano])

  // En desarrollo, para medir dónde se dibuja cada bola y la llama de la mano:
  // `__llama` es la de Player y `__llamas` todas (retrato, preloader, teléfono).
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    const yo = { casillas, s, llama: llamaRef, brasas: brasasRef, mano: uMano }
    const todas = (window.__llamas ||= new Set())
    todas.add(yo)
    if (disparoRef) window.__llama = yo
    return () => {
      todas.delete(yo)
      if (window.__llama === yo) delete window.__llama
    }
  }, [casillas, disparoRef, uMano])

  const muestraEsfera = (st, si) => {
    if (st.oculta === !si) return
    st.oculta = !si
    if (st.orbe) st.orbe.visible = si
    if (st.contorno) st.contorno.visible = si
  }

  // Avanza una partícula: el aire frena su velocidad (también lo heredado),
  // el calor la empuja hacia arriba de la pantalla y, si trae remolino, un
  // ruido propio la mueve de lado. Empuje y remolino van en su unidad.
  const mueve = (st, b, dt, k) => {
    b.v.multiplyScalar(Math.exp(-b.aire * dt))
    b.v.addScaledVector(st.arr, b.empuje * b.unidad * dt)
    if (b.remolino) {
      const n = (ruido1(b.semilla + st.t * 3.1) - 0.5) * 2
      b.v.addScaledVector(st.der, n * b.remolino * k * b.unidad * dt)
    }
    b.p.addScaledVector(b.v, dt)
  }
  // Tamaño en su vida: crece rápido, luego se encoge hasta apagarse.
  const tamano = (b, k) => b.r * (k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 0.75))

  // Dónde se ve `p` sobre el cuadro, que es un plano de frente a la cámara a la
  // profundidad de `centro`: en el espacio de la vista, escalado por la
  // perspectiva (con la ortográfica no cambia). Sin esto, lo lejano del camino
  // de la bola se dibujaba mucho más arriba de donde está y parecía irse al
  // cielo (Oscar). Deja en `st.proy` x, y y la escala.
  const proyecta = (st, p, centro, unidad) => {
    st.vc.copy(centro).applyMatrix4(st.vista)
    st.vp.copy(p).applyMatrix4(st.vista)
    const k = st.perspectiva ? st.vc.z / Math.min(-1e-4, st.vp.z) : 1
    st.proy.set((st.vp.x * k - st.vc.x) / unidad, (st.vp.y * k - st.vc.y) / unidad, k)
    return st.proy
  }
  // Escribe un sistema de partículas en las ranuras del campo, relativo a
  // `centro` y en `unidad`. Lo joven pesa más.
  // Las vivas van juntas al frente y `uN` dice cuántas son: el shader no
  // recorre las vacías (con varias explosiones a la vez trababa los cuadros).
  const escribe = (st, lista, uCampo, centro, unidad) => {
    const uFuego = uCampo.uFuego.value
    let n = 0
    for (let i = 0; i < MAX; i += 1) {
      const b = lista[i]
      if (!b.vivo) continue
      const k = b.edad / b.vida
      const pr = proyecta(st, b.p, centro, unidad)
      uFuego[n].set(pr.x, pr.y, (tamano(b, k) / unidad) * pr.z, 1.25 - 0.65 * k)
      n += 1
    }
    uCampo.uN.value = n
  }
  const avanza = (st, lista, dt) => {
    for (const b of lista) {
      if (!b.vivo) continue
      b.edad += dt
      const k = b.edad / b.vida
      if (k >= 1) { b.vivo = false; continue }
      mueve(st, b, dt, k)
    }
  }
  const libre = (lista) => lista.find((x) => !x.vivo) || null

  // Recorta el cuadro de un campo a donde hay fuego: cada pixel del cuadro paga
  // el ruido y todas las bocanadas aunque se descarte, y el cuadro fijo casi
  // siempre estaba vacío (en el preloader la llama costaba 0.77 ms de GPU de un
  // cuadro de ~1.1). Fuera del recorte la densidad nunca llega a la orilla: a s
  // radios de cada bocanada su aporte es menor que su peso por e^(-s²), y con
  // s² = ln(peso total / orilla) ni todas juntas la alcanzan; las gotas van por
  // máximo, multiplicadas por la banda clara. El ruido mueve lo que se lee
  // hasta DEFORMA. Sigue a todas las bocanadas vivas (el tope es solo de
  // seguridad) y lo vacío de adentro lo descarta barato el shader. Sin fuego el
  // cuadro queda en cero.
  const caja = { x0: 0, x1: 0, y0: 0, y1: 0 }
  const meteEnCaja = (x, y, r) => {
    if (x - r < caja.x0) caja.x0 = x - r
    if (x + r > caja.x1) caja.x1 = x + r
    if (y - r < caja.y0) caja.y0 = y - r
    if (y + r > caja.y1) caja.y1 = y + r
  }
  // Reparte las bocanadas vivas en GRUPOS cercanos (cortes por la mediana del
  // eje más largo, tres niveles) para el descarte del shader. Cada grupo: el
  // centro de su caja, el radio que alcanza a todas, su radio más grande y la
  // suma de sus pesos. A una bocanada del grupo el pixel está a lo menos a la
  // distancia al centro menos ese radio, así que la bola del grupo nunca vale
  // menos que la suma de las suyas: el descarte sigue siendo exacto.
  const orden = Array.from({ length: MAX }, (_, i) => i)
  const agrupa = (u) => {
    const fuego = u.uFuego.value
    const n = u.uN.value
    const grupos = u.uGrupo.value
    const pesos = u.uGrupoPeso.value
    for (let i = 0; i < n; i += 1) orden[i] = i
    let hoja = 0
    const parte = (lo, hi, nivel) => {
      if (hi <= lo) return
      if (nivel < 3 && hi - lo > 1) {
        let ax = Infinity, bx = -Infinity, ay = Infinity, by = -Infinity
        for (let i = lo; i < hi; i += 1) {
          const f = fuego[orden[i]]
          if (f.x < ax) ax = f.x
          if (f.x > bx) bx = f.x
          if (f.y < ay) ay = f.y
          if (f.y > by) by = f.y
        }
        const eje = bx - ax >= by - ay ? 'x' : 'y'
        for (let i = lo + 1; i < hi; i += 1) {
          const v = orden[i]
          const clave = fuego[v][eje]
          let j = i - 1
          while (j >= lo && fuego[orden[j]][eje] > clave) { orden[j + 1] = orden[j]; j -= 1 }
          orden[j + 1] = v
        }
        const mitad = (lo + hi) >> 1
        parte(lo, mitad, nivel + 1)
        parte(mitad, hi, nivel + 1)
        return
      }
      let ax = Infinity, bx = -Infinity, ay = Infinity, by = -Infinity
      let rMax = 0
      let peso = 0
      for (let i = lo; i < hi; i += 1) {
        const f = fuego[orden[i]]
        if (f.x < ax) ax = f.x
        if (f.x > bx) bx = f.x
        if (f.y < ay) ay = f.y
        if (f.y > by) by = f.y
        if (f.z > rMax) rMax = f.z
        peso += f.w
      }
      const cx = (ax + bx) / 2
      const cy = (ay + by) / 2
      let alcanza = 0
      for (let i = lo; i < hi; i += 1) {
        const f = fuego[orden[i]]
        alcanza = Math.max(alcanza, Math.hypot(f.x - cx, f.y - cy))
      }
      grupos[hoja].set(cx, cy, alcanza, rMax)
      pesos[hoja] = peso
      hoja += 1
    }
    parte(0, n, 0)
    for (; hoja < GRUPOS; hoja += 1) {
      grupos[hoja].set(0, 0, 0, 1)
      pesos[hoja] = 0
    }
  }

  const ajustaCuadro = (u, tope) => {
    agrupa(u)
    const fuego = u.uFuego.value
    const n = u.uN.value
    const base = u.uBase.value
    const conBase = base.z > 1e-3
    caja.x0 = caja.y0 = Infinity
    caja.x1 = caja.y1 = -Infinity
    let total = conBase ? 0.9 : 0
    for (let i = 0; i < n; i += 1) total += fuego[i].w
    if (total > BANDAS.halo) {
      const s = Math.sqrt(Math.log(total / BANDAS.halo))
      if (conBase) meteEnCaja(base.x, base.y, base.z * s)
      for (let i = 0; i < n; i += 1) meteEnCaja(fuego[i].x, fuego[i].y, fuego[i].z * s)
    }
    const sGota = Math.sqrt(Math.log(BANDAS.claro / BANDAS.halo))
    for (const g of u.uGotas.value) if (g.z > 1e-3) meteEnCaja(g.x, g.y, g.z * sGota)
    const x0 = Math.max(caja.x0 - DEFORMA, tope[2] - tope[0])
    const x1 = Math.min(caja.x1 + DEFORMA, tope[2] + tope[0])
    const y0 = Math.max(caja.y0 - DEFORMA, tope[3] - tope[1])
    const y1 = Math.min(caja.y1 + DEFORMA, tope[3] + tope[1])
    if (!(x1 > x0 && y1 > y0)) u.uCuadro.value.set(0, 0, 0, 0)
    else u.uCuadro.value.set((x1 - x0) / 2, (y1 - y0) / 2, (x0 + x1) / 2, (y0 + y1) / 2)
  }

  useFrame(({ camera }, dtRaw) => {
    const st = s.current
    const llama = llamaRef.current
    const brasas = brasasRef.current
    if (!llama || !brasas) return
    const dt = Math.min(dtRaw || 0.016, 0.05)

    if (raiz && (raiz !== st.raiz || !st.orbe || !st.orbe.parent)) {
      muestraEsfera(st, true)
      st.raiz = raiz
      st.orbe = raiz.getObjectByName?.('Egg_EnergyBall') || null
      st.contorno = st.orbe?.parent?.getObjectByName?.('Egg_EnergyBall_outline') || null
      // Su tamaño en reposo, para medir la luz: la carga la infla y la
      // historia la encoge (como guardan su escala Player y el rig).
      if (st.orbe) st.escalaReposo = Math.abs(st.orbe.scale.x) || 1
      if (st.orbe?.geometry) {
        if (!st.orbe.geometry.boundingSphere) st.orbe.geometry.computeBoundingSphere()
        st.radio = st.orbe.geometry.boundingSphere?.radius || 1
      }
    }
    const orbe = st.orbe
    let activa = !!orbe && visibleSusPadres(orbe)
    let R = 0
    if (activa) {
      orbe.updateWorldMatrix(true, false)
      orbe.getWorldPosition(st.P)
      orbe.getWorldScale(st.S)
      R = st.S.x * st.radio
      if (!(R > 1e-4)) activa = false
    }
    const disparo = disparoRef?.current || null
    if (st.ultimoDisparo === null && disparo) st.ultimoDisparo = disparo.id
    if (!activa) {
      muestraEsfera(st, true)
      llama.count = 0
      brasas.count = 0
      st.luzI = 0
      st.luzParams.x = 0
      for (const c of casillas) {
        if (c.refB.current) c.refB.current.count = 0
        if (c.refE.current) c.refE.current.count = 0
        c.bola.activa = false
        for (const x of c.bola.fuego) x.vivo = false
      }
      st.hayPrevio = false
      st.renace = 1
      st.esperaRenace = 0
      if (disparo) st.ultimoDisparo = disparo.id
      for (const x of st.fuego) x.vivo = false
      for (const x of st.gotas) x.vivo = false
      for (const x of st.brasas) x.vivo = false
      return
    }
    // Cada cuadro: el fundido del modo esfera regresa los contornos.
    st.oculta = false
    muestraEsfera(st, false)

    st.t += dt
    uMano.uT.value = st.t
    uMano.uR.value = R
    for (const c of casillas) {
      c.uB.uT.value = st.t
      c.uE.uT.value = st.t
      c.uB.uFlujo.value.y += 3.0 * dt
    }

    // Ejes de la pantalla en el mundo y la vista de la cámara.
    st.der.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    st.arr.setFromMatrixColumn(camera.matrixWorld, 1).normalize()
    st.vista.copy(camera.matrixWorld).invert()
    st.perspectiva = !camera.isOrthographicCamera

    // Velocidad de la mano (mundo), suavizada. Si brincó lejos (corte,
    // recarga), el fuego viejo se apaga para no dejar una raya.
    if (st.hayPrevio && st.previo.distanceTo(st.P) > R * 12) {
      st.hayPrevio = false
      for (const x of st.fuego) x.vivo = false
    }
    if (st.hayPrevio && dt > 0) {
      st.tmp.copy(st.P).sub(st.previo).divideScalar(dt)
      st.vel.lerp(st.tmp, 1 - Math.exp(-14 * dt))
    } else st.vel.set(0, 0, 0)
    st.previo.copy(st.P)
    st.hayPrevio = true

    // El viento lleva el ruido de la llama: se acumula para no brincar.
    const vx = -st.vel.dot(st.der) / R
    const vy = -st.vel.dot(st.arr) / R
    uMano.uFlujo.value.x += vx * 0.05 * dt
    uMano.uFlujo.value.y += (3.0 + vy * 0.05) * dt

    // Disparo nuevo: la llama deja la mano como bola de fuego. Sale del tamaño
    // que traía al soltar (la carga infló la esfera), desde la mano hacia la
    // mira, y la mano se queda sin fuego hasta que la bola explote. Ocupa una
    // casilla libre o, si no hay, la que lleva más tiempo.
    if (disparo && disparo.id !== st.ultimoDisparo) {
      st.ultimoDisparo = disparo.id
      const vieja = (lista) => lista.reduce((x, y) => (y.bola.nacio < x.bola.nacio ? y : x), lista[0])
      const explotando = casillas.filter((x) => x.bola.fase === 'estalla')
      const c = casillas.find((x) => !x.bola.activa)
        || (explotando.length ? vieja(explotando) : vieja(casillas))
      const b = c.bola
      const uBola = c.uB
      const uEstela = c.uE
      b.activa = true
      b.fase = 'vuela'
      b.t = 0
      b.nacio = st.t
      b.dur = disparo.travel || 0.3
      b.fuerza = disparo.power || 0
      b.radio = disparo.radius || 2
      b.U = Math.max(R, st.Rultimo) * (1.05 + 0.35 * b.fuerza)
      b.de.copy(st.P)
      b.a.set(disparo.x, disparo.y + 0.4, disparo.z)
      b.centro.copy(b.de)
      b.pos.copy(b.de)
      b.antes.copy(b.de)
      b.acc = 0
      for (const x of b.fuego) x.vivo = false
      // El campo de la cabeza viaja con ella; la estela es la franja.
      uBola.uR.value = b.U
      uEstela.uDe.value.copy(b.de)
      uEstela.uA.value.copy(b.a)
      uEstela.uAncho.value = b.U * ESTELA.ancho
      uEstela.uLargo.value = b.de.distanceTo(b.a) / b.U
      uEstela.uFin.value = 0
      for (const x of st.fuego) x.vivo = false
      for (const x of st.gotas) x.vivo = false
      st.renace = 0
      st.esperaRenace = b.dur + RENACE.espera
    }
    st.Rultimo = R

    // La llama de la mano renace después de la explosión.
    if (st.esperaRenace > 0) st.esperaRenace -= dt
    else st.renace = Math.min(1, st.renace + dt / RENACE.dura)
    const renace = st.renace

    // Bocanadas de la mano: nacen con buena parte de su velocidad.
    st.fuegoAcc += dt * FUEGO.porSegundo * renace
    while (st.fuegoAcc >= 1) {
      st.fuegoAcc -= 1
      const f = libre(st.fuego)
      if (!f) { st.fuegoAcc = 0; break }
      f.vivo = true
      f.edad = Math.random() * dt
      f.vida = azar(FUEGO.vida[0], FUEGO.vida[1])
      f.r = R * azar(FUEGO.tam[0], FUEGO.tam[1]) * (0.35 + 0.65 * renace)
      f.semilla = Math.random() * 1000
      f.unidad = R
      f.empuje = FUEGO.empuje
      f.aire = FUEGO.aire
      f.remolino = FUEGO.remolino
      f.p.copy(st.P)
        .addScaledVector(st.der, R * (Math.random() - 0.5) * 0.5)
        .addScaledVector(st.arr, R * Math.random() * 0.3)
      f.v.copy(st.arr).multiplyScalar(R * FUEGO.subida * azar(0.7, 1.3))
        .addScaledVector(st.der, R * (Math.random() - 0.5) * 1.2)
        .addScaledVector(st.vel, FUEGO.hereda)
    }
    avanza(st, st.fuego, dt)
    escribe(st, st.fuego, uMano, st.P, R)
    uMano.uBase.value.set(0, 0.12, FUEGO.base * renace)
    let alto = -1e9
    let masAlta = null
    for (const f of st.fuego) {
      if (!f.vivo || f.edad / f.vida < 0.4) continue
      const y = f.p.dot(st.arr)
      if (y > alto) { alto = y; masAlta = f }
    }

    st.m.makeTranslation(st.P.x, st.P.y, st.P.z)
    llama.setMatrixAt(0, st.m)
    llama.count = 1
    llama.instanceMatrix.needsUpdate = true

    // Las bolas: cada una vuela de la mano a la mira con su estela y explota al llegar.
    for (const cas of casillas) {
      const b = cas.bola
      const uBola = cas.uB
      const uEstela = cas.uE
      const bolaMesh = cas.refB.current
      const estela = cas.refE.current
      if (!bolaMesh || !estela) continue
      if (!b.activa) {
        bolaMesh.count = 0
        estela.count = 0
        continue
      }
      b.t += dt
      if (b.fase === 'vuela') {
        const k = Math.min(1, b.t / b.dur)
        b.antes.copy(b.pos)
        b.pos.copy(b.de).lerp(b.a, k)
        if (dt > 0) b.vel.copy(b.pos).sub(b.antes).divideScalar(dt)
        // Chispas a lo largo del camino recorrido en este cuadro.
        b.accChispa = (b.accChispa || 0) + dt * BOLA.chispas
        while (b.accChispa >= 1) {
          b.accChispa -= 1
          const c = libre(st.brasas)
          if (!c) { b.accChispa = 0; break }
          c.vivo = true
          c.edad = 0
          c.vida = azar(0.35, 0.7)
          c.r = b.U * azar(0.12, 0.28)
          c.semilla = Math.random() * 1000
          c.unidad = b.U
          c.empuje = 3
          c.aire = 4
          c.remolino = 8
          c.p.copy(b.antes).lerp(b.pos, Math.random())
            .addScaledVector(st.der, b.U * (Math.random() - 0.5) * 1.2)
            .addScaledVector(st.arr, b.U * (Math.random() - 0.5) * 1.2)
          c.v.copy(b.vel).multiplyScalar(0.05)
            .addScaledVector(st.arr, b.U * azar(0.5, 2))
            .addScaledVector(st.der, b.U * (Math.random() - 0.5) * 2)
        }
        // La cabeza: bocanadas que viajan con ella y casi no suben (el calor
        // las llevaría hacia arriba de la pantalla y, yendo lejos, parecía irse
        // al cielo).
        b.acc += dt * BOLA.porSegundo
        while (b.acc >= 1) {
          b.acc -= 1
          const f = libre(b.fuego)
          if (!f) { b.acc = 0; break }
          f.vivo = true
          f.edad = 0
          f.vida = azar(BOLA.vida[0], BOLA.vida[1])
          f.r = b.U * azar(BOLA.tam[0], BOLA.tam[1])
          f.semilla = Math.random() * 1000
          f.unidad = b.U
          f.empuje = FUEGO.empuje * 0.2
          // Casi sin aire: si se frenan, se quedan atrás de la cabeza.
          f.aire = BOLA.aire
          f.remolino = FUEGO.remolino
          f.p.copy(b.antes).lerp(b.pos, Math.random())
            .addScaledVector(st.der, b.U * (Math.random() - 0.5) * 0.6)
            .addScaledVector(st.arr, b.U * (Math.random() - 0.5) * 0.6)
          f.v.copy(st.arr).multiplyScalar(b.U * azar(0.2, 0.9))
            .addScaledVector(st.der, b.U * (Math.random() - 0.5) * 1.2)
            .addScaledVector(b.vel, BOLA.hereda)
        }
        b.centro.copy(b.pos)
        uBola.uBase.value.set(0, 0, BOLA.base * (1 + 0.3 * b.fuerza))
        uEstela.uCabeza.value = k
        uEstela.uCola.value = Math.max(0, (b.t - ESTELA.cola) / b.dur)
        if (k >= 1) {
          // Llega: la cabeza se apaga y explota con la explosión de cómic de
          // LaserBeam. Una nube de fuego propia encima sobraba (Oscar: "un polvo
          // que está de más").
          b.fase = 'estalla'
          b.t = 0
          uBola.uBase.value.z = 0
          for (const x of b.fuego) x.vivo = false
        }
      } else {
        // La cola de la estela alcanza a la cabeza y la franja se consume.
        uEstela.uCabeza.value = 1
        uEstela.uCola.value = Math.min(1, (b.dur + b.t - ESTELA.cola) / b.dur)
        uEstela.uFin.value = Math.min(1, b.t / ESTELA.fin)
      }
      avanza(st, b.fuego, dt)
      escribe(st, b.fuego, uBola, b.centro, b.U)
      ajustaCuadro(uBola, CUADRO_BOLA)
      const estelaViva = uEstela.uCola.value < 1 && uEstela.uFin.value < 1
      if (b.fase === 'estalla' && b.t > 0.3 && !estelaViva && !b.fuego.some((x) => x.vivo)) b.activa = false
      st.m.makeTranslation(b.centro.x, b.centro.y, b.centro.z)
      bolaMesh.setMatrixAt(0, st.m)
      bolaMesh.count = b.activa ? 1 : 0
      bolaMesh.instanceMatrix.needsUpdate = true
      estela.count = b.activa && estelaViva ? 1 : 0
    }

    // Gotas: de vez en cuando la bocanada más alta suelta una que sigue sola,
    // con su velocidad; sube y se encoge.
    st.sigueGota -= dt
    if (st.sigueGota <= 0 && masAlta && renace > 0.8) {
      st.sigueGota = 0.25 + Math.random() * Math.random() * 0.7
      const g = libre(st.gotas)
      if (g) {
        g.vivo = true
        g.edad = 0
        g.vida = azar(0.8, 1.3)
        g.r = azar(0.18, 0.44)
        g.semilla = Math.random() * 1000
        g.unidad = R
        g.empuje = 4
        g.aire = 3
        g.remolino = 6
        g.p.copy(masAlta.p).addScaledVector(st.arr, R * 0.6)
        g.v.copy(masAlta.v).addScaledVector(st.arr, R * 0.8)
      }
    }
    for (let i = 0; i < GOTAS; i += 1) {
      const g = st.gotas[i]
      const u = uMano.uGotas.value[i]
      if (!g.vivo) { u.set(0, 0, 0, 0); continue }
      g.edad += dt
      const k = g.edad / g.vida
      if (k >= 1) { g.vivo = false; u.set(0, 0, 0, 0); continue }
      mueve(st, g, dt, 1)
      st.tmp.copy(g.p).sub(st.P).divideScalar(R)
      // Pop al nacer y se va encogiendo.
      const e = Math.min(1, k / 0.1) * (1 - k * k)
      u.set(st.tmp.dot(st.der), st.tmp.dot(st.arr), g.r * e, 0)
    }
    ajustaCuadro(uMano, CUADRO_MANO)

    // Brasas: chispas que salen de las bocanadas casi sin su velocidad, más
    // entre más rápido se mueve la mano; suben, se frenan y se apagan.
    const rapidez = st.vel.length() / R
    st.brasaAcc += dt * Math.min(BRASA.tope, BRASA.base + rapidez * BRASA.porVelocidad) * renace
    while (st.brasaAcc >= 1) {
      st.brasaAcc -= 1
      const c = libre(st.brasas)
      const f = st.fuego[Math.floor(Math.random() * MAX)]
      if (!c) { st.brasaAcc = 0; break }
      c.vivo = true
      c.edad = 0
      c.vida = azar(0.45, 0.9)
      c.r = R * azar(0.07, 0.2)
      c.semilla = Math.random() * 1000
      c.unidad = R
      c.empuje = 3
      c.aire = 4
      c.remolino = 10
      c.p.copy(f.vivo ? f.p : st.P)
        .addScaledVector(st.der, R * (Math.random() - 0.5) * 0.8)
        .addScaledVector(st.arr, R * (Math.random() - 0.5) * 0.8)
      c.v.copy(st.arr).multiplyScalar(R * azar(0.8, 2.2))
        .addScaledVector(st.der, R * (Math.random() * 2 - 1) * 0.8)
        .addScaledVector(st.vel, 0.15)
    }
    let nb = 0
    for (const c of st.brasas) {
      if (!c.vivo) continue
      c.edad += dt
      const k = c.edad / c.vida
      if (k >= 1) { c.vivo = false; continue }
      mueve(st, c, dt, 1)
      const r = Math.max(1e-5, c.r * Math.min(1, k / 0.08) * (1 - k))
      st.esc.set(r, r, r)
      st.m.compose(c.p, st.q, st.esc)
      brasas.setMatrixAt(nb, st.m)
      nb += 1
    }
    brasas.count = nb
    brasas.instanceMatrix.needsUpdate = true

    // La luz se queda con el fuego que más alumbra: la mano (con lo que ha
    // renacido), una bola en vuelo o el destello de la que acaba de explotar.
    // `nivel` es 1 con la llama de la mano en reposo.
    const Rrep = R * (st.escalaReposo / Math.max(1e-6, Math.abs(orbe.scale.x)))
    let nivel = Math.min(R / Rrep, LUZ.tope) * renace
    st.luzPos.copy(st.P)
    for (const cas of casillas) {
      const b = cas.bola
      if (!b.activa) continue
      const deBola = LUZ.bola * Math.min(b.U / Rrep, LUZ.tope)
      let nb = 0
      if (b.fase === 'vuela') nb = deBola
      else if (b.t < LUZ.destelloDura) nb = deBola * LUZ.destello * (1 - b.t / LUZ.destelloDura) ** 2
      if (nb > nivel) {
        nivel = nb
        st.luzPos.copy(b.centro)
      }
    }
    nivel *= 1 + LUZ.parpadeo * ((ruido1(st.t * 7.3) - 0.5) * 1.4 + (ruido1(st.t * 19.1 + 31) - 0.5) * 0.6)
    // En desarrollo, `window.__llamaLuz` la multiplica (0 la apaga) para compararla.
    if (import.meta.env.DEV && typeof window.__llamaLuz === 'number') nivel *= window.__llamaLuz
    // Suavizada lo justo para que no brinque de un cuadro a otro.
    st.luzI += (nivel - st.luzI) * (1 - Math.exp(-25 * dt))
    // La banda clara y no el color puro: más clara se lee como luz.
    st.luzColor.copy(colores.uClaro.value)
    st.luzParams.set(
      DERRAME.fuerza * Math.min(1, st.luzI),
      Rrep * DERRAME.alcance * Math.sqrt(Math.max(0, st.luzI)),
      DERRAME.umbral,
    )
    st.enlace -= dt
    if (st.enlace <= 0 && st.raiz) {
      st.enlace = DERRAME.enlace
      st.raiz.traverse((o) => {
        if (!o.isMesh || !o.material) return
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          const u = uniformsLlama(m)
          if (!u || u.uLlamaPos.value === st.luzPos) continue
          u.uLlamaPos.value = st.luzPos
          u.uLlamaColor.value = st.luzColor
          u.uLlamaParams.value = st.luzParams
        }
      })
    }
  })

  return (
    <>
      <instancedMesh
        ref={llamaRef}
        args={[geo, matMano, 1]}
        count={0}
        frustumCulled={false}
        matrixAutoUpdate={false}
        matrixWorldAutoUpdate={false}
        renderOrder={5}
        userData={{ cuerpoPropio: true }}
        raycast={() => null}
      />
      {casillas.map((cas, i) => (
        <group key={i}>
          <instancedMesh
            ref={cas.refE}
            args={[geo, cas.matE, 1]}
            count={0}
            frustumCulled={false}
            matrixAutoUpdate={false}
            matrixWorldAutoUpdate={false}
            renderOrder={4}
            raycast={() => null}
          />
          <instancedMesh
            ref={cas.refB}
            args={[geo, cas.matB, 1]}
            count={0}
            frustumCulled={false}
            matrixAutoUpdate={false}
            matrixWorldAutoUpdate={false}
            renderOrder={5}
            raycast={() => null}
          />
        </group>
      ))}
      <instancedMesh
        ref={brasasRef}
        args={[geo, matBrasa, BRASAS]}
        count={0}
        frustumCulled={false}
        matrixAutoUpdate={false}
        matrixWorldAutoUpdate={false}
        userData={{ cuerpoPropio: true }}
        raycast={() => null}
      />
    </>
  )
}
