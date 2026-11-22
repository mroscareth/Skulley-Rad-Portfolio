import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BANDAS as BANDAS_MANO, VERT_BRASA, FRAG_BRASA } from '../../lib/fuegoToon.js'

// La estela de fuego de la esfera del modo esfera (Oscar, 2026-11-22: "la pura
// esfera se ve chafa"): cuando Skulley viaja a un portal o cae al home, detrás de
// la esfera salen lenguas de fuego. Es la receta de la llama de la mano
// (fx/LlamaMano.jsx): bocanadas con inercia que viven en el mundo, fundidas en un
// campo de metaballs con bandas duras (orilla oscura, media, clara y un centro
// chico) sobre un cuadro que mira a la cámara y se recorta a donde hay fuego.
//
// Las lenguas (`LENGUAS`): tres, cada una en su carril a la izquierda, al centro
// y a la derecha de la estela TAL COMO SE VE (perpendicular al camino y a la
// vista; repartidas alrededor del camino en 3D, vistas desde arriba se encimaban
// en una sola gota). Cada una suelta bocanadas a ritmo fijo y sin azar en su
// forma, así es una tira seguida que se afila; heredan parte de la velocidad de
// la esfera y el aire las frena, así se quedan atrás, y se abren hacia su carril.
// Cada lengua se mece de lado y pulsa (unas se alargan mientras otras se
// recogen); la del centro es la larga. Cada bocanada es una lágrima estirada
// hacia atrás (con círculos salían burbujas) y un ruido que corre hacia atrás le
// come a la cola surcos en V, así las puntas se separan. Un núcleo de bocanadas
// cortas al azar junta todo en la cabeza. Cada tanto la punta suelta una gota que
// sigue sola (va aparte, por máximo: sumada se pegaba, como en la mano) y brasas
// que se quedan en el aire. Al llegar, lo que queda se frena y se consume en un
// instante, debajo de la explosión.
//
// Lo que ya falló (Oscar, 2026-11-22, "aplastadas y burdas y mordidas, como si
// hubiera una máscara"): el piso mordía las flamas en línea recta (ver la
// profundidad al final del fragmento) y un ruido grande las dejaba burdas. Y en
// el camino de ajustarla: una columna lisa, una gota pálida de fantasmita, un
// renacuajo con cola de hilo y lenguas tan abiertas que perdían el cuerpo.
//
// El color es el de la esfera en ese cuadro (va del azul claro al color del
// portal conforme se acerca), llevado a su tono puro para que las bandas no
// salgan lavadas. La esfera se dibuja encima: es el núcleo.
//
// Siempre montada: sin fuego el campo y las brasas quedan en count = 0, y sus
// programas se compilan en el warm-up. Las brasas usan el shader de las de la
// mano (lib/fuegoToon.js): mismo programa. Nada hereda del padre
// (`matrixWorldAutoUpdate` apagado): vive en el mundo, como las bolas de fuego.
// Corre después de Player (prioridad 0.5), así la cabeza es la de este cuadro.

const MAX = 64
const GOTAS = 6
const GRUPOS = 8
const BRASAS = 64
// Radio de la esfera en el modelo (el sphereGeometry de Player).
const RADIO = 0.6
// Las lenguas: cuántas bocanadas por segundo suelta cada una a toda velocidad
// (abajo de `rapida`, unidades del mundo por segundo, menos), cuánto viven (s),
// qué tanto de la velocidad de la esfera heredan, aire (1/s), calor y remolino
// (radios/s²), qué tan rápido se abren hacia su carril (radios/s), qué tan atrás
// del centro nacen y a qué distancia del eje por carril (radios), tamaño
// (radios) y qué tan rápido pulsa cada una.
const FUEGO = {
  porSegundo: 50,
  rapida: 6,
  vida: 0.3,
  hereda: 0.5,
  aire: 3,
  sube: 4,
  remolino: 8,
  abre: 8,
  atras: 0.35,
  orilla: 0.55,
  tam: 0.62,
  pulso: 4.3,
  // Cada lengua se mece de lado (`mece`, en carriles) y se abre y se cierra
  // (`flama`, veces su carril); lo que ya salió se queda atrás dibujando la onda.
  mece: 0.45,
  meceVel: 5.5,
  flama: 0.35,
  flamaVel: 7,
}
// Las lenguas: su carril (-1 izquierda, 0 centro, 1 derecha de la estela en la
// pantalla), cuánto viven y qué tan anchas son respecto a FUEGO.
const LENGUAS = [
  { lado: -1, largo: 0.8, ancho: 0.85 },
  { lado: 0, largo: 1.1, ancho: 1.2 },
  { lado: 1, largo: 0.8, ancho: 0.85 },
]
// Bocanadas de núcleo, al azar junto al eje, grandes y cortas, para que la cabeza
// sea una sola masa de donde salen las lenguas; pesan menos (`peso`), si no el
// centro claro se comía la cabeza.
const NUCLEO = { porSegundo: 24, vida: [0.08, 0.13], tam: [0.6, 0.8], orilla: 0.25, peso: 0.55 }
// Peso de una bocanada en el campo: joven pesa más.
const PESO = [0.62, 0.3]
// Vista de frente la estela se encima sobre sí misma y todo salía en la banda
// clara; vista de lado se reparte y salía oscura. El peso se multiplica por esto
// según qué tanto se ve de lado (0 de frente, 1 de lado).
const DENSIDAD = [0.4, 1]
// Cuántas veces su radio mide cada bocanada hacia atrás, con la estela de lado a
// la cámara (de frente se ve corta y se estira menos).
const ESTIRA = 2
// Las bandas: las de la mano, con la media más ancha (la estela es menos densa
// que la llama de la mano y casi todo caía en la orilla oscura) y el centro más
// alto (un núcleo chico, como en la mano).
const BANDAS = { ...BANDAS_MANO, medio: 0.7, claro: 1.5, centro: 3.4 }
// Gotas que suelta la punta: cada cuánto (s), vida (s), tamaño (radios) y empujón
// hacia atrás al soltarse (radios/s).
const GOTA = { cada: [0.16, 0.32], vida: [0.16, 0.28], tam: [0.18, 0.3], suelta: 0.4 }
const BRASA = { porSegundo: 70, vida: [0.3, 0.65], tam: [0.08, 0.16], aire: 3.5, sube: 3, salta: [1, 3] }
// La cabeza: una bola del campo alrededor de la esfera (radios), para que el fuego
// la envuelva y no salga despegado.
const CABEZA = 0.8
// Cuánto mueve el ruido lo que se lee del campo: `base` en la cabeza, `base + cola`
// a `largo` radios hacia atrás y de ahí en adelante; las gotas, `gota`.
const DEF = { base: 0.1, cola: 0.5, largo: 5, gota: 0.25 }
// Lo que el ruido le come a la cola para partirla en lenguas: a cuántos radios
// llega a toda fuerza, qué tan angostas son (frecuencia a lo ancho), desde qué
// valor del ruido empieza a comer y cuánto.
const CORTE = { largo: 5, ancho: 0.9, desde: 0.45, fuerza: 6 }
// El ruido mueve (lado·w.x + atrás·w.y/2)·amp con |w| ≤ 0.5: a lo más √0.3125·amp.
const ALCANCE = 0.5591
const DEFORMA = ALCANCE * (DEF.base + DEF.cola)
// Al llegar: lo que le queda de vida a cada bocanada y el aire que la frena.
const CONSUME = { vida: 0.16, aire: 10 }
// Un brinco de la esfera mayor a esto (unidades del mundo) en un cuadro es un
// corte (la caída empieza arriba): no se hereda esa velocidad.
const SALTO = 4
// Tope de seguridad del cuadro, en radios (una bocanada detrás de la cámara
// saldría disparada en la proyección).
const TOPE = 160

const azar = (a, b) => a + Math.random() * (b - a)
function hash1(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
function ruido1(x) {
  const i = Math.floor(x)
  let f = x - i
  f = f * f * (3 - 2 * f)
  return hash1(i) * (1 - f) + hash1(i + 1) * f
}
const f2 = (x) => x.toFixed(4)

const VERT = /* glsl */`
uniform float uR;
uniform vec4 uCuadro;
varying vec2 vF;
varying vec3 vVista;
varying vec3 vCabeza;
varying vec3 vArriba;
varying vec4 vProy;
void main(){
  // Coordenadas del campo en radios de la esfera, a la profundidad de la cabeza:
  // x a lo ancho de la pantalla, y hacia arriba.
  vF = vec2(position.x * 2.0 * uCuadro.x + uCuadro.z, position.y * 2.0 * uCuadro.y + uCuadro.w);
  mat4 m = mat4(1.0);
  #ifdef USE_INSTANCING
    m = instanceMatrix;
  #endif
  vec4 centro = modelViewMatrix * m * vec4(0.0, 0.0, 0.0, 1.0);
  // Para la profundidad de cada pixel (ver el final del fragmento), en la vista:
  // la cabeza, el arriba del mundo y el punto del cuadro.
  vCabeza = centro.xyz;
  vArriba = (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
  centro.xy += vF * uR;
  vVista = centro.xyz;
  gl_Position = projectionMatrix * centro;
  vProy = vec4(projectionMatrix[2][2], projectionMatrix[3][2], projectionMatrix[2][3], projectionMatrix[3][3]);
}
`

const FRAG = /* glsl */`
uniform float uT;
uniform float uFlujo;
uniform vec2 uDir;
uniform float uEstira;
uniform float uLargo;
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
varying vec3 vVista;
varying vec3 vCabeza;
varying vec3 vArriba;
varying vec4 vProy;

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
// Una bocanada es una lágrima: hacia atrás de la estela mide uEstira veces su
// radio, así cada una deja su cola y juntas hacen lenguas y no burbujas.
float lagrima(vec2 p, vec2 c, float r, vec2 lado){
  vec2 d = p - c;
  float a = dot(d, uDir);
  a /= a > 0.0 ? r * uEstira : r;
  float b = dot(d, lado) / r;
  return exp(-(a*a + b*b));
}
// Lo más que puede valer bola(q, c, r) para cualquier q a no más de d de p.
// Con r·uEstira también acota a la lágrima.
float cotaBola(vec2 p, vec2 c, float r, float d){ float e = max(length(p - c) - d, 0.0) / r; return exp(-e*e); }

void main(){
  vec2 p = vF;
  // a: qué tan atrás de la cabeza a lo largo de la estela; lado: a lo ancho.
  vec2 lado = vec2(-uDir.y, uDir.x);
  float a = dot(p, uDir);
  float amp = ${f2(DEF.base)} + ${f2(DEF.cola)} * clamp(a / (${f2(DEF.largo)} * uLargo), 0.0, 1.0);
  // Antes de pagar el ruido, lo más que puede leer este pixel (como en la mano):
  // primero por grupos y luego bocanada por bocanada. Exacto: no cambia ningún pixel.
  float alcance = ${f2(ALCANCE)} * amp;
  float cotaBase = uBase.z > 1e-3 ? 0.9 * cotaBola(p, uBase.xy, uBase.z, alcance) : 0.0;
  float cota = cotaBase;
  for (int i = 0; i < ${GRUPOS}; i++) {
    vec4 g = uGrupo[i];
    float e = max(length(p - g.xy) - g.z - alcance, 0.0) / max(g.w * uEstira, 1e-4);
    cota += uGrupoPeso[i] * exp(-e*e);
  }
  if (cota >= ${f2(BANDAS.halo)}) {
    cota = cotaBase;
    for (int i = 0; i < ${MAX}; i++) {
      if (i >= uN || cota >= ${f2(BANDAS.halo)}) break;
      vec4 b = uFuego[i];
      cota += b.w * cotaBola(p, b.xy, b.z * uEstira, alcance);
    }
  }
  if (cota < ${f2(BANDAS.halo)}) {
    float cg = 0.0;
    for (int i = 0; i < ${GOTAS}; i++) cg = max(cg, cotaBola(p, uGotas[i].xy, max(uGotas[i].z, 1e-3), ${f2(ALCANCE * DEF.gota)}) * step(1e-3, uGotas[i].z));
    if (cg * ${f2(BANDAS.claro)} < ${f2(BANDAS.halo)}) discard;
  }
  // Ruido estirado a lo largo de la estela que corre hacia atrás (uFlujo) y
  // evoluciona; mueve sobre todo de lado, así las lenguas ondean.
  vec2 pr = vec2(a * 0.45 - uFlujo, dot(p, lado) * 1.6);
  vec2 w = vec2(
    llFbm(vec3(pr, uT * 1.1)),
    llFbm(vec3(pr + vec2(5.2, 1.7), uT * 1.1 + 4.0))
  ) - 0.5;
  vec2 mueve = lado * w.x + uDir * (w.y * 0.5);
  vec2 q = p + mueve * amp;
  float f = uBase.z > 1e-3 ? 0.9 * bola(q, uBase.xy, uBase.z) : 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uN) break;
    vec4 b = uFuego[i];
    f += b.w * lagrima(q, b.xy, b.z, lado);
  }
  // Las lenguas: un ruido estirado a lo largo que corre hacia atrás se come la
  // cola, nada junto a la cabeza y más entre más atrás, así el cono se parte en
  // lenguas que terminan en punta (el fuego toon de siempre: forma menos ruido).
  // Solo resta: las cotas de arriba siguen valiendo.
  float hc = clamp(a / (${f2(CORTE.largo)} * uLargo), 0.0, 1.0);
  float corta = llFbm(vec3(a * 0.3 - uFlujo * 0.8, dot(q, lado) * ${f2(CORTE.ancho)}, uT * 0.9 + 9.0));
  f -= max(corta - ${f2(CORTE.desde)}, 0.0) * ${f2(CORTE.fuerza)} * hc * hc;
  vec2 qg = p + mueve * ${f2(DEF.gota)};
  float g = 0.0;
  for (int i = 0; i < ${GOTAS}; i++) g = max(g, bola(qg, uGotas[i].xy, max(uGotas[i].z, 1e-3)) * step(1e-3, uGotas[i].z));
  float k = max(f, g * ${f2(BANDAS.claro)});
  if (k < ${f2(BANDAS.halo)}) discard;
  // La profundidad. El cuadro es un plano de frente a la cámara a la altura de la
  // esfera y, como la cámara ve desde arriba, lo que queda abajo de la cabeza en
  // la pantalla se mete bajo el piso: el piso mordía las flamas en línea recta
  // (Oscar: "como si hubiera una máscara"). Ahí cada pixel va a donde su rayo
  // cruza la altura de la cabeza, que está más cerca y nunca bajo el piso; arriba
  // de la cabeza se queda el plano (así la estela de la caída pasa enfrente de
  // lo que está detrás).
  if (vProy.z != 0.0) {
    float t = dot(vArriba, vCabeza) / dot(vArriba, vVista);
    float z = (t > 0.0 && t < 1.0) ? vVista.z * t : vVista.z;
    gl_FragDepth = clamp(0.5 * (vProy.x * z + vProy.y) / (vProy.z * z + vProy.w) + 0.5, 0.0, 1.0);
  } else gl_FragDepth = gl_FragCoord.z;
  vec3 col = k > ${f2(BANDAS.centro)} ? uCentro
           : (k > ${f2(BANDAS.claro)} ? uClaro
           : (k > ${f2(BANDAS.medio)} ? uMedio : uHondo));
  float alfa = k > ${f2(BANDAS.hondo)} ? 1.0 : smoothstep(${f2(BANDAS.halo)}, ${f2(BANDAS.hondo)}, k) * 0.3;
  gl_FragColor = vec4(col, alfa);
}
`

const particula = () => ({ vivo: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0, edad: 0, vida: 1, semilla: 0, aire: 0, peso: 1 })
const libre = (lista) => lista.find((x) => !x.vivo) || null
// Crece rápido y luego se encoge hasta apagarse (como en la mano).
const tamano = (b, k) => b.r * (k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 0.6))
const EJE_X = new THREE.Vector3(1, 0, 0)
const EJE_Y = new THREE.Vector3(0, 1, 0)
const BLANCO = new THREE.Color(1, 1, 1)

export default function EstelaEsfera({ orbeRef, activaRef, colorRef, apagada = false }) {
  const campoRef = useRef(null)
  const brasasRef = useRef(null)
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const colores = useMemo(() => ({
    uHondo: { value: new THREE.Color() },
    uMedio: { value: new THREE.Color() },
    uClaro: { value: new THREE.Color() },
    uCentro: { value: new THREE.Color() },
  }), [])
  const u = useMemo(() => ({
    uT: { value: 0 },
    uR: { value: RADIO },
    uCuadro: { value: new THREE.Vector4() },
    uFlujo: { value: 0 },
    uDir: { value: new THREE.Vector2(0, 1) },
    uEstira: { value: 1 },
    uLargo: { value: 1 },
    uBase: { value: new THREE.Vector3() },
    uN: { value: 0 },
    uFuego: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uGotas: { value: Array.from({ length: GOTAS }, () => new THREE.Vector4()) },
    uGrupo: { value: Array.from({ length: GRUPOS }, () => new THREE.Vector4()) },
    uGrupoPeso: { value: new Array(GRUPOS).fill(0) },
    ...colores,
  }), [colores])
  const matCampo = useMemo(() => new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }), [u])
  const matBrasa = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uHondo: colores.uHondo, uMedio: colores.uMedio, uClaro: colores.uClaro },
    vertexShader: VERT_BRASA,
    fragmentShader: FRAG_BRASA,
    toneMapped: false,
  }), [colores])
  useEffect(() => () => {
    geo.dispose()
    matCampo.dispose()
    matBrasa.dispose()
  }, [geo, matCampo, matBrasa])

  const s = useRef({
    t: 0,
    flujo: 0,
    activa: false,
    hayPrevio: false,
    R: RADIO,
    P: new THREE.Vector3(),
    previo: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    adelante: new THREE.Vector3(0, -1, 0),
    e1: new THREE.Vector3(1, 0, 0),
    e2: new THREE.Vector3(0, 0, 1),
    lado: new THREE.Vector3(1, 0, 0),
    dir: new THREE.Vector2(0, 1),
    tmp: new THREE.Vector3(),
    fuego: Array.from({ length: MAX }, particula),
    acc: 0,
    lenguas: LENGUAS.map(() => Math.random() * 100),
    accLengua: LENGUAS.map(() => 0),
    gotas: Array.from({ length: GOTAS }, particula),
    sigueGota: 0,
    brasas: Array.from({ length: BRASAS }, particula),
    accBrasa: 0,
    vista: new THREE.Matrix4(),
    perspectiva: true,
    vc: new THREE.Vector3(),
    vp: new THREE.Vector3(),
    proy: new THREE.Vector3(),
    m: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    esc: new THREE.Vector3(),
    color: new THREE.Color(),
    hsl: { h: 0, s: 0, l: 0 },
  })

  // En desarrollo: el estado y, cada vez que arranca un viaje, si el programa del
  // campo ya estaba compilado (`listo`: debe ser true desde el primero).
  const gl = useThree((x) => x.gl)
  useEffect(() => {
    if (!import.meta.env.DEV || apagada) return undefined
    window.__estelaEsfera = {
      s,
      u,
      campo: campoRef,
      brasas: brasasRef,
      viajes: [],
      gl,
      compilado: () => !!gl.info.programs?.some((p) => gl.getContext().getShaderSource(p.fragmentShader)?.includes('uFlujo')),
    }
    return () => { if (window.__estelaEsfera?.s === s) delete window.__estelaEsfera }
  }, [u, gl, apagada])

  const apagaTodo = (st) => {
    for (const x of st.fuego) x.vivo = false
    for (const x of st.gotas) x.vivo = false
    for (const x of st.brasas) x.vivo = false
    st.acc = 0
    st.accBrasa = 0
  }

  // El aire la frena hacia el aire quieto, el calor la sube y un ruido propio la
  // remueve de lado, más entre más vieja.
  const mueve = (st, b, dt, k, sube, remolino) => {
    b.v.multiplyScalar(Math.exp(-b.aire * dt))
    b.v.y += sube * st.R * dt
    if (remolino) {
      const a = remolino * st.R * k * dt
      b.v.addScaledVector(st.e1, (ruido1(b.semilla + st.t * 3.1) - 0.5) * 2 * a)
      b.v.addScaledVector(st.e2, (ruido1(b.semilla + 57.3 + st.t * 3.1) - 0.5) * 2 * a)
    }
    b.p.addScaledVector(b.v, dt)
  }

  // Dónde se ve `p` sobre el cuadro (un plano de frente a la cámara a la
  // profundidad de la cabeza), en radios: como `proyecta` de la mano.
  const proyecta = (st, p) => {
    st.vp.copy(p).applyMatrix4(st.vista)
    const k = st.perspectiva ? st.vc.z / Math.min(-1e-4, st.vp.z) : 1
    st.proy.set((st.vp.x * k - st.vc.x) / st.R, (st.vp.y * k - st.vc.y) / st.R, k)
    return st.proy
  }

  // Reparte las bocanadas en GRUPOS para el descarte del shader (igual que la mano).
  const orden = useMemo(() => Array.from({ length: MAX }, (_, i) => i), [])
  const agrupa = () => {
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

  // Recorta el cuadro a donde hay fuego (la cuenta de `ajustaCuadro` de la mano).
  // Devuelve si hay algo que dibujar.
  const ajustaCuadro = () => {
    agrupa()
    const fuego = u.uFuego.value
    const n = u.uN.value
    const base = u.uBase.value
    const conBase = base.z > 1e-3
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    const mete = (x, y, r) => {
      if (x - r < x0) x0 = x - r
      if (x + r > x1) x1 = x + r
      if (y - r < y0) y0 = y - r
      if (y + r > y1) y1 = y + r
    }
    let total = conBase ? 0.9 : 0
    for (let i = 0; i < n; i += 1) total += fuego[i].w
    if (total > BANDAS.halo) {
      const k = Math.sqrt(Math.log(total / BANDAS.halo))
      if (conBase) mete(base.x, base.y, base.z * k)
      const kb = k * u.uEstira.value
      for (let i = 0; i < n; i += 1) mete(fuego[i].x, fuego[i].y, fuego[i].z * kb)
    }
    const kGota = Math.sqrt(Math.log(BANDAS.claro / BANDAS.halo))
    for (const g of u.uGotas.value) if (g.z > 1e-3) mete(g.x, g.y, g.z * kGota)
    x0 = Math.max(x0 - DEFORMA, -TOPE)
    x1 = Math.min(x1 + DEFORMA, TOPE)
    y0 = Math.max(y0 - DEFORMA, -TOPE)
    y1 = Math.min(y1 + DEFORMA, TOPE)
    if (!(x1 > x0 && y1 > y0)) {
      u.uCuadro.value.set(0, 0, 0, 0)
      return false
    }
    u.uCuadro.value.set((x1 - x0) / 2, (y1 - y0) / 2, (x0 + x1) / 2, (y0 + y1) / 2)
    return true
  }

  // La paleta: el color de la esfera en su tono puro, con las bandas de la mano.
  const pinta = (st) => {
    const m = colorRef?.current
    if (!m?.emissive) return
    m.emissive.getHSL(st.hsl, THREE.SRGBColorSpace)
    st.color.setHSL(st.hsl.h, Math.max(st.hsl.s, 0.85), 0.5, THREE.SRGBColorSpace)
    colores.uMedio.value.copy(st.color)
    colores.uHondo.value.copy(st.color).multiplyScalar(0.32)
    colores.uClaro.value.copy(st.color).lerp(BLANCO, 0.38)
    colores.uCentro.value.copy(st.color).lerp(BLANCO, 0.7)
  }

  useFrame(({ camera }, dtRaw) => {
    const campo = campoRef.current
    const brasas = brasasRef.current
    if (!campo || !brasas) return
    const st = s.current
    if (apagada) {
      campo.count = 0
      brasas.count = 0
      return
    }
    // En desarrollo, `window.__estelaEsfera.sim = { de, a, vel, escala }` mueve una
    // cabeza de mentira de `de` a `a` (mundo) una y otra vez, con su propio reloj
    // (`escala` 0 la congela), para revisar la forma sin viajar a un portal; se
    // quita con `delete window.__estelaEsfera.sim`.
    const sim = import.meta.env.DEV ? window.__estelaEsfera?.sim : null
    const dt = Math.min(dtRaw || 0.016, 0.05) * (sim ? sim.escala ?? 1 : 1)
    st.t += dt
    const orbe = orbeRef?.current
    const activa = !!(orbe && activaRef?.current) || !!sim

    if (activa && !st.activa) {
      apagaTodo(st)
      st.hayPrevio = false
      if (import.meta.env.DEV && window.__estelaEsfera?.s === s) {
        window.__estelaEsfera.viajes.push({ t: Math.round(performance.now()), listo: window.__estelaEsfera.compilado() })
      }
    }
    if (!activa && st.activa) {
      // Llegó: lo que queda se frena y se consume debajo de la explosión.
      for (const b of st.fuego) {
        if (!b.vivo) continue
        b.vida = Math.min(b.vida, b.edad + CONSUME.vida)
        b.aire = CONSUME.aire
      }
      for (const g of st.gotas) if (g.vivo) g.vida = Math.min(g.vida, g.edad + CONSUME.vida * 1.5)
    }
    st.activa = activa

    if (activa && sim) {
      sim.t = (sim.t || 0) + dt
      const largo = Math.hypot(sim.a[0] - sim.de[0], sim.a[1] - sim.de[1], sim.a[2] - sim.de[2])
      const k = ((sim.t * (sim.vel || 22)) / Math.max(largo, 1e-3)) % 1
      st.tmp.set(...sim.de).lerp(st.esc.set(...sim.a), k)
      st.R = RADIO
    } else if (activa) {
      orbe.updateWorldMatrix(true, false)
      orbe.getWorldPosition(st.tmp)
      orbe.getWorldScale(st.esc)
      st.R = RADIO * (Math.abs(st.esc.x) || 1)
    }
    if (activa) {
      if (st.hayPrevio && st.tmp.distanceTo(st.previo) > SALTO) {
        st.hayPrevio = false
        apagaTodo(st)
      }
      st.P.copy(st.tmp)
      if (st.hayPrevio && dt > 0) {
        st.tmp.subVectors(st.P, st.previo).divideScalar(dt)
        st.vel.lerp(st.tmp, 1 - Math.exp(-20 * dt))
      } else if (!st.hayPrevio) st.vel.set(0, 0, 0)
      st.previo.copy(st.P)
      st.hayPrevio = true
      pinta(st)
    } else st.hayPrevio = false

    const R = st.R
    const rapidez = st.vel.length()
    if (activa && rapidez > 0.5) {
      st.adelante.copy(st.vel).divideScalar(rapidez)
      st.e1.crossVectors(st.adelante, Math.abs(st.adelante.y) > 0.9 ? EJE_X : EJE_Y).normalize()
      st.e2.crossVectors(st.e1, st.adelante)
      // El lado de la estela tal como se ve: perpendicular al camino y a la vista,
      // así las lenguas siempre se abren en la pantalla (acostado, en un viaje de
      // lado quedaba casi en la dirección de la vista y se enciman). La de abajo
      // no se ve mordida por el piso: la profundidad del campo nunca baja de la
      // altura de la cabeza (ver el fragmento).
      st.tmp.subVectors(st.P, camera.position)
      st.lado.crossVectors(st.adelante, st.tmp)
      if (st.lado.lengthSq() < 1e-8) st.lado.copy(st.e1)
      st.lado.normalize()
    }

    // Nacen bocanadas en la orilla de atrás: núcleo y lenguas.
    const fuerza = THREE.MathUtils.clamp(rapidez / FUEGO.rapida, 0.35, 1)
    const nace = (b, u) => {
      b.vivo = true
      b.edad = u * dt
      b.semilla = Math.random() * 1000
      b.aire = FUEGO.aire
      // En su punto del camino de este cuadro, para que no salga en escalones.
      b.p.copy(st.P).addScaledVector(st.vel, -u * dt).addScaledVector(st.adelante, -R * FUEGO.atras)
      b.v.copy(st.vel).multiplyScalar(FUEGO.hereda)
    }
    if (activa && rapidez > 0.5) {
      // El núcleo, al azar alrededor del eje.
      st.acc += dt * NUCLEO.porSegundo * fuerza
      while (st.acc >= 1) {
        st.acc -= 1
        const b = libre(st.fuego)
        if (!b) { st.acc = 0; break }
        nace(b, Math.random())
        b.peso = NUCLEO.peso
        b.vida = azar(NUCLEO.vida[0], NUCLEO.vida[1])
        b.r = R * azar(NUCLEO.tam[0], NUCLEO.tam[1])
        b.p.addScaledVector(st.lado, R * NUCLEO.orilla * (Math.random() * 2 - 1))
      }
      // Las lenguas, a ritmo fijo y sin azar en su forma: cada una es una tira
      // seguida que se afila. Cada una tiene su carril (a la izquierda, al centro o
      // a la derecha de la estela en la pantalla), se abre y se cierra, se mece de
      // lado y pulsa: unas se alargan mientras otras se recogen.
      for (let i = 0; i < LENGUAS.length; i += 1) {
        const L = LENGUAS[i]
        const fase = st.lenguas[i]
        st.accLengua[i] += dt * FUEGO.porSegundo * fuerza
        const n = Math.floor(st.accLengua[i])
        st.accLengua[i] -= n
        for (let j = 0; j < n; j += 1) {
          const b = libre(st.fuego)
          if (!b) break
          const u = (j + 0.5) / n
          const t = st.t - u * dt
          const pulso = ruido1(fase + t * FUEGO.pulso)
          const s = L.lado * (1 + FUEGO.flama * Math.sin(t * FUEGO.flamaVel + fase))
            + FUEGO.mece * Math.sin(t * FUEGO.meceVel + fase * 1.7)
          nace(b, u)
          b.peso = 1
          b.vida = FUEGO.vida * L.largo * (0.55 + 0.8 * pulso)
          b.r = R * FUEGO.tam * L.ancho * (0.75 + 0.4 * pulso)
          b.p.addScaledVector(st.lado, R * FUEGO.orilla * s)
          b.v.addScaledVector(st.lado, R * FUEGO.abre * s)
        }
      }
    }
    for (const b of st.fuego) {
      if (!b.vivo) continue
      b.edad += dt
      const k = b.edad / b.vida
      if (k >= 1) { b.vivo = false; continue }
      mueve(st, b, dt, k, FUEGO.sube, FUEGO.remolino)
    }

    // La punta suelta una gota: de las bocanadas maduras, una de las de más atrás.
    st.sigueGota -= dt
    if (activa && st.sigueGota <= 0) {
      st.sigueGota = azar(GOTA.cada[0], GOTA.cada[1])
      let mejor = null
      let atras = -Infinity
      for (const b of st.fuego) {
        if (!b.vivo || b.edad / b.vida < 0.45) continue
        const d = -st.tmp.subVectors(b.p, st.P).dot(st.adelante) + Math.random() * R * 2
        if (d > atras) { atras = d; mejor = b }
      }
      const g = mejor ? libre(st.gotas) : null
      if (g) {
        g.vivo = true
        g.edad = 0
        g.vida = azar(GOTA.vida[0], GOTA.vida[1])
        g.r = R * azar(GOTA.tam[0], GOTA.tam[1])
        g.semilla = Math.random() * 1000
        g.aire = FUEGO.aire
        g.p.copy(mejor.p).addScaledVector(st.adelante, -R * 0.4)
        g.v.copy(mejor.v).addScaledVector(st.adelante, -R * GOTA.suelta)
      }
    }
    for (const g of st.gotas) {
      if (!g.vivo) continue
      g.edad += dt
      const k = g.edad / g.vida
      if (k >= 1) { g.vivo = false; continue }
      mueve(st, g, dt, 1, FUEGO.sube, FUEGO.remolino * 0.5)
    }

    // Brasas: salen de las bocanadas con parte de su velocidad y se quedan en el aire.
    if (activa) st.accBrasa += dt * BRASA.porSegundo * fuerza
    while (st.accBrasa >= 1) {
      st.accBrasa -= 1
      const c = libre(st.brasas)
      const f = st.fuego[Math.floor(Math.random() * MAX)]
      if (!c) { st.accBrasa = 0; break }
      if (!f.vivo) continue
      c.vivo = true
      c.edad = 0
      c.vida = azar(BRASA.vida[0], BRASA.vida[1])
      c.r = R * azar(BRASA.tam[0], BRASA.tam[1])
      c.semilla = Math.random() * 1000
      c.aire = BRASA.aire
      c.p.copy(f.p)
      st.tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      c.v.copy(f.v).multiplyScalar(0.5).addScaledVector(st.tmp, R * azar(BRASA.salta[0], BRASA.salta[1]))
    }
    let nb = 0
    for (const c of st.brasas) {
      if (!c.vivo) continue
      c.edad += dt
      const k = c.edad / c.vida
      if (k >= 1) { c.vivo = false; continue }
      mueve(st, c, dt, k, BRASA.sube, 8)
      const r = Math.max(1e-5, c.r * Math.min(1, k / 0.08) * (1 - k))
      st.esc.set(r, r, r)
      st.m.compose(c.p, st.q, st.esc)
      brasas.setMatrixAt(nb, st.m)
      nb += 1
    }
    brasas.count = nb
    brasas.instanceMatrix.needsUpdate = true

    // El campo, en el plano de la cabeza.
    camera.updateMatrixWorld()
    if (import.meta.env.DEV && window.__estelaEsfera?.s === s) window.__estelaEsfera.camara = camera
    st.vista.copy(camera.matrixWorldInverse)
    st.perspectiva = !camera.isOrthographicCamera
    st.vc.copy(st.P).applyMatrix4(st.vista)
    u.uT.value = st.t
    u.uR.value = R
    // Hacia atrás de la estela en la pantalla. Yendo hacia la cámara o alejándose
    // de ella casi no tiene dirección: se queda la de antes.
    st.tmp.copy(st.P).addScaledVector(st.adelante, -R * 4)
    const pr = proyecta(st, st.tmp)
    const largo = Math.hypot(pr.x, pr.y)
    if (largo > 0.4) {
      const k = 1 - Math.exp(-14 * dt)
      st.dir.x += (pr.x / largo - st.dir.x) * k
      st.dir.y += (pr.y / largo - st.dir.y) * k
      if (st.dir.lengthSq() < 1e-6) st.dir.set(pr.x / largo, pr.y / largo)
      st.dir.normalize()
    }
    u.uDir.value.copy(st.dir)
    const estira = 1 + (ESTIRA - 1) * THREE.MathUtils.clamp(largo / 4, 0, 1)
    u.uEstira.value += (estira - u.uEstira.value) * (1 - Math.exp(-10 * dt))
    const deLado = (u.uEstira.value - 1) / (ESTIRA - 1)
    const densidad = DENSIDAD[0] + (DENSIDAD[1] - DENSIDAD[0]) * deLado
    // De frente la estela se ve corta: las lenguas se cortan y ondean a su escala.
    u.uLargo.value = 0.3 + 0.7 * deLado
    st.flujo += dt * 0.55 * (2 + 0.45 * (activa ? rapidez / R : 0))
    u.uFlujo.value = st.flujo
    u.uBase.value.set(0, 0, activa ? CABEZA : 0)

    const uF = u.uFuego.value
    let n = 0
    for (const b of st.fuego) {
      if (!b.vivo) continue
      const k = b.edad / b.vida
      const p = proyecta(st, b.p)
      uF[n].set(p.x, p.y, Math.max(1e-4, (tamano(b, k) / R) * p.z), (PESO[0] - PESO[1] * k) * b.peso * densidad)
      n += 1
    }
    u.uN.value = n
    for (let i = 0; i < GOTAS; i += 1) {
      const g = st.gotas[i]
      const ug = u.uGotas.value[i]
      if (!g.vivo) { ug.set(0, 0, 0, 0); continue }
      const k = g.edad / g.vida
      const p = proyecta(st, g.p)
      // Pop al soltarse y se va encogiendo.
      ug.set(p.x, p.y, (g.r / R) * p.z * Math.min(1, k / 0.1) * (1 - k * k), 0)
    }
    const hay = ajustaCuadro()
    st.m.makeTranslation(st.P.x, st.P.y, st.P.z)
    campo.setMatrixAt(0, st.m)
    campo.instanceMatrix.needsUpdate = true
    campo.count = hay ? 1 : 0
  }, 0.5)

  return (
    <>
      <instancedMesh
        ref={campoRef}
        args={[geo, matCampo, 1]}
        count={0}
        frustumCulled={false}
        matrixAutoUpdate={false}
        matrixWorldAutoUpdate={false}
        renderOrder={-2}
        raycast={() => null}
      />
      <instancedMesh
        ref={brasasRef}
        args={[geo, matBrasa, BRASAS]}
        count={0}
        frustumCulled={false}
        matrixAutoUpdate={false}
        matrixWorldAutoUpdate={false}
        raycast={() => null}
      />
    </>
  )
}
