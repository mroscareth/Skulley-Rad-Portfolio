import * as THREE from 'three'

// La pantalla de los ojos del drone de M.A.D.R.E. (el domo de enfrente, material
// `Pantalla` del GLB). Son los ojos del modelo de Oscar: dos pastillas cian
// sólidas sobre negro, con la orilla nítida (Oscar, 2026-11-19: "los ojos deben
// ser como los originales"; pixeleados con una rejilla de LEDs perdían la
// definición). Lugar y tamaño medidos de la textura original (scripts/drone).
// La rejilla se quedó como textura encima, sin recortar la forma ("una mezcla").
// Encima van las animaciones: parpadeo, mirada a saltos y caras. Sin reflejo
// pintado: quieto sobre el domo se veía raro (Oscar).
//
// Un solo programa: cara, parpadeo, mirada, falla y encendido son uniforms, así
// que cambiar de cara nunca compila nada. Se monta sobre MeshBasicMaterial (el
// skinning lo pone three) y el dibujo sale de la posición del vértice en la
// pantalla, no del UV (en el GLB el UV del domo va girado).

export const EXPRESIONES = ['normal', 'feliz', 'enojada', 'confundida', 'tache']

const VERT_PARS = /* glsl */`
uniform vec2 uPantCentro;
uniform vec2 uPantRadio;
varying vec2 vPant;
`
const VERT = /* glsl */`
vPant = (position.xy - uPantCentro) / uPantRadio;
`

const FRAG_PARS = /* glsl */`
uniform float uTiempo;
uniform float uAbierto;
uniform float uExpr;
uniform float uExprPrev;
uniform float uCambio;
uniform float uDesdeCambio;
uniform vec2 uMirar;
uniform float uGlitch;
uniform float uEncendido;
uniform vec3 uColorOjo;
uniform vec3 uColorFondo;
uniform vec3 uColorLedApagado;
uniform float uCeldas;
uniform float uLadoConf;
uniform float uEnojo;
uniform vec3 uColorOjoEnojo;
uniform vec3 uColorLedEnojo;
uniform float uQuemado;
varying vec2 vPant;

// Las pastillas originales, en unidades de la pantalla (-1..1): centro en
// x = ±0.213, y = -0.0875; miden 0.508 de alto y 0.19 de ancho.
#define OJO_X 0.213
#define OJO_Y -0.0875
#define OJO_H 0.1596
#define OJO_R 0.0946

float hashP(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float sdCapsulaV(vec2 p, float h, float r) {
  p.y -= clamp(p.y, -h, h);
  return length(p) - r;
}
float sdCapsulaH(vec2 p, float w, float r) {
  p.x -= clamp(p.x, -w, w);
  return length(p) - r;
}
float sdSegmento(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// gira el punto a radianes contra el reloj
vec2 gira(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
// almendra de puntas filosas arriba y abajo (iq): ancho 2(r - d), alto 2·sqrt(r² - d²)
float sdVesica(vec2 p, float r, float d) {
  p = abs(p);
  float b = sqrt(r * r - d * d);
  return ((p.y - b) * d > p.x * b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;
}
// arco de radio r entre los ángulos a0 y a1 (a0 < a1), grosor th
float sdArco(vec2 p, float r, float a0, float a1, float th) {
  float a = atan(p.y, p.x);
  float am = 0.5 * (a0 + a1), ah = 0.5 * (a1 - a0);
  float da = mod(a - am + 3.14159265, 6.2831853) - 3.14159265;
  if (abs(da) <= ah) return abs(length(p) - r) - th;
  vec2 e0 = r * vec2(cos(a0), sin(a0)), e1 = r * vec2(cos(a1), sin(a1));
  return min(length(p - e0), length(p - e1)) - th;
}
// signo de interrogación de ~0.24 de alto, con el punto abajo
float sdPregunta(vec2 p) {
  float th = 0.024;
  float gancho = sdArco(p - vec2(0.0, 0.055), 0.058, -1.25, 3.4, th);
  float palo = sdSegmento(p, vec2(0.024, 0.003), vec2(0.0, -0.035)) - th;
  float punto = length(p - vec2(0.0, -0.1)) - th * 1.15;
  return min(min(gancho, palo), punto);
}

// Un ojo. e: punto relativo al centro del ojo, con x volteada en el ojo derecho
// (x > 0 es hacia el centro de la cara en los dos). der: 1 en el ojo derecho.
float ojo(vec2 e, float expr, float abierto, float der) {
  float cerrado = sdCapsulaH(e - vec2(0.0, -0.03), OJO_R * 1.05, 0.038);
  float d;
  if (expr < 0.5) {            // normal: la pastilla original
    d = sdCapsulaV(e, OJO_H, OJO_R);
  } else if (expr < 1.5) {     // feliz: ^ ^
    vec2 q = e - vec2(0.0, -0.11);
    d = max(abs(length(q) - 0.15) - 0.05, -q.y);
    d = min(d, max(length(q - vec2(0.15, 0.0)) - 0.05, 0.0));
    d = min(d, length(q + vec2(0.15, 0.0)) - 0.05);
    d = min(d, length(q - vec2(0.15, 0.0)) - 0.05);
    abierto = max(abierto, 0.6);
  } else if (expr < 2.5) {     // enojada: cuchillas de puntas filosas en V hacia el centro
    // una almendra larga inclinada (la punta de adentro abajo) con la orilla de
    // arriba cortada recta, como ceja: queda la hoja de abajo con las dos puntas
    vec2 q = e - vec2(-0.045, 0.01);
    vec2 u = normalize(vec2(-0.74, 0.7));          // a lo largo, hacia afuera y arriba
    d = sdVesica(gira(q, 1.5708 - atan(u.y, u.x)), 0.47, 0.37);
    d = max(d, dot(q, vec2(u.y, -u.x)) - 0.03);
  } else if (expr < 3.5) {     // confundida: el ojo del lado al que voltea, chiquito y alzado
    bool chico = (der > 0.5) == (uLadoConf > 0.0);
    if (chico) {
      vec2 q = gira(e - vec2(0.0, 0.07), 0.22);
      d = sdCapsulaV(q, OJO_H * 0.38, OJO_R * 0.92);
    } else {
      vec2 q = gira(e, -0.16);
      d = sdCapsulaV(q, OJO_H, OJO_R);
    }
  } else {                     // tache: X X de caricatura, mareada (el rayo de la esfera corrupta)
    vec2 q = gira(e, 0.18 * sin(uTiempo * 2.6 + der * 2.1));
    float b = 0.105;
    d = min(sdSegmento(q, vec2(-b, -b), vec2(b, b)), sdSegmento(q, vec2(-b, b), vec2(b, -b))) - 0.04;
    abierto = 1.0;
  }
  return mix(cerrado, d, clamp(abierto, 0.0, 1.0));
}

// Los dos ojos y lo que acompañe a la cara. p en -1..1.
float cara(vec2 p, float expr, float abierto) {
  vec2 m = uMirar * vec2(0.2, 0.12);
  // al voltear, los ojos se angostan y el del lado al que mira crece un poco
  float ang = 1.0 - 0.14 * abs(uMirar.x);
  float est = max(abierto, 1.0);   // al abrir de más el ojo se estira (squash and stretch)
  vec2 escala = vec2(ang / sqrt(est), est);
  vec2 c = vec2(0.0, OJO_Y) + m;
  float crecL = 1.0 - 0.08 * uMirar.x, crecR = 1.0 + 0.08 * uMirar.x;
  vec2 el = (p - c - vec2(-OJO_X, 0.0)) / (escala * crecL);
  vec2 er = (p - c - vec2(OJO_X, 0.0)) / (escala * crecR);
  er.x = -er.x;
  float d = min(ojo(el, expr, abierto, 0.0) * crecL, ojo(er, expr, abierto, 1.0) * crecR);
  if (expr > 2.5 && expr < 3.5) {   // el ? que salta con la cara confundida
    float k = clamp(uDesdeCambio / 0.28, 0.0, 1.0);
    float pop = k < 1.0 ? (1.0 + 2.7 * pow(k - 1.0, 3.0) + 1.7 * pow(k - 1.0, 2.0)) : 1.0;
    float s = max(pop, 0.001) * (1.0 + 0.04 * sin(uTiempo * 6.0));
    vec2 q = gira(p - vec2(0.52 * uLadoConf, 0.36) - vec2(0.0, 0.015 * sin(uTiempo * 3.1)), -0.18 * uLadoConf) / s;
    d = min(d, sdPregunta(q) * s);
  }
  return d;
}
`

const FRAG = /* glsl */`
{
  vec2 p = vPant;
  // falla de señal: franjas que se recorren de lado un instante
  if (uGlitch > 0.0) {
    float franja = floor(p.y * 9.0);
    float tg = floor(uTiempo * 24.0);
    float on = step(0.55, hashP(vec2(franja, tg)));
    p.x += on * (hashP(vec2(franja, tg + 9.0)) - 0.5) * 0.18 * uGlitch;
  }
  // temblor de rabia: los ojos tiemblan a saltos (24 por segundo)
  if (uEnojo > 0.0) {
    float tj = floor(uTiempo * 24.0);
    p += (vec2(hashP(vec2(tj, 1.7)), hashP(vec2(tj, 5.3))) - 0.5) * 0.016 * uEnojo;
  }
  // encendido de tele vieja: la imagen se aplasta a una raya y luego a un punto
  float enc = clamp(uEncendido, 0.0, 1.0);
  float sy = smoothstep(0.0, 0.55, enc);
  float sx = smoothstep(0.35, 1.0, enc) * 0.97 + 0.03;
  vec2 pe = vec2(p.x / max(sx, 0.03), p.y / max(sy, 0.012));
  // al cambiar de cara la nueva entra con un barrido de arriba abajo
  float d = cara(pe, uExpr, uAbierto);
  if (uCambio < 1.0 && p.y < mix(1.2, -1.2, uCambio)) d = cara(pe, uExprPrev, uAbierto);
  // orilla nítida, del ancho de un pixel
  float aa = max(fwidth(d), 1e-5) * 0.7;
  float ojoOn = 1.0 - smoothstep(-aa, aa, d);
  ojoOn *= step(0.001, enc);
  // la rejilla de LEDs (Oscar: "una mezcla"): no recorta la forma, le da textura.
  // Cada LED es un cuadrito de esquina redonda; entre uno y otro el ojo baja de
  // brillo y en el negro se alcanzan a ver los LEDs apagados. Fija a la pantalla:
  // la falla recorre el dibujo, no la rejilla. Si la pantalla se ve chica (celdas
  // de pocos pixeles) la rejilla se funde para no hacer moiré.
  vec2 f = fract((vPant * 0.5 + 0.5) * uCeldas) - 0.5;
  float celdaPx = (2.0 / uCeldas) / max(fwidth(vPant.x), 1e-5);
  float aaL = 1.2 / max(celdaPx, 1.0);
  float led = 1.0 - smoothstep(-aaL, aaL, length(max(abs(f) - 0.2, 0.0)) - 0.17);
  led = mix(1.0, led, smoothstep(3.0, 7.0, celdaPx));
  vec3 apagado = uColorFondo + mix(uColorLedApagado, uColorLedEnojo, uEnojo) * led;
  vec3 colOjo = mix(uColorOjo, uColorOjoEnojo, uEnojo);
  // quemada: la pantalla baja de brillo y titila como foco a punto de fundirse
  float tq = floor(uTiempo * 18.0);
  colOjo *= 1.0 - uQuemado * (0.3 + 0.35 * step(0.7, hashP(vec2(tq, 3.1))));
  vec3 col = mix(apagado, colOjo * mix(0.5, 1.0, led), ojoOn);
  outgoingLight = col;
}
`

// Crea el material de pantalla para una malla (necesita su geometría para medir
// la pantalla). Regresa el material; los uniforms viven en material.userData.pantalla.
export function crearMaterialPantalla(geometria, opciones = {}) {
  geometria.computeBoundingBox()
  const bb = geometria.boundingBox
  const centro = new THREE.Vector2((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2)
  const radio = new THREE.Vector2((bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2)
  const u = {
    uPantCentro: { value: centro },
    uPantRadio: { value: radio },
    uTiempo: { value: 0 },
    uAbierto: { value: 1 },
    uExpr: { value: 0 },
    uExprPrev: { value: 0 },
    uCambio: { value: 1 },
    uDesdeCambio: { value: 10 },
    uMirar: { value: new THREE.Vector2() },
    uGlitch: { value: 0 },
    uEncendido: { value: 1 },
    uColorOjo: { value: new THREE.Color(opciones.colorOjo ?? '#67ffff') },
    uColorFondo: { value: new THREE.Color(opciones.colorFondo ?? '#000000') },
    uColorLedApagado: { value: new THREE.Color(opciones.colorLedApagado ?? '#0b1722') },
    uCeldas: { value: opciones.celdas ?? 40 },
    uLadoConf: { value: 1 },
    // el enojo (0..1) también lo leen los materiales del cuerpo: la luz se pone roja
    uEnojo: { value: 0 },
    uColorOjoEnojo: { value: new THREE.Color(opciones.colorOjoEnojo ?? '#ff2a1c') },
    uColorLedEnojo: { value: new THREE.Color('#2a0806') },
    // quemada por el rayo (0..1): también la leen los materiales del cuerpo (hollín)
    uQuemado: { value: 0 },
  }
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  m.name = 'Pantalla'
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = VERT_PARS + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT)
    shader.fragmentShader = FRAG_PARS + shader.fragmentShader.replace('#include <opaque_fragment>', FRAG + '\n#include <opaque_fragment>')
  }
  m.customProgramCacheKey = () => 'pantallaDrone5'
  m.userData.pantalla = u
  return m
}

// ---------------------------------------------------------------- el que la anima

// Resorte con sobrepaso para la mirada: los ojos brincan a donde van y se pasan
// un poco (timing de caricatura), no se deslizan.
function resorte(x, v, meta, dt, hz, zeta) {
  const w = 2 * Math.PI * hz
  const a = -w * w * (x - meta) - 2 * zeta * w * v
  v += a * dt
  x += v * dt
  return [x, v]
}

// Parpadeo de caricatura: cierra rápido, se queda un instante, abre pasándose
// (el ojo se estira de más) y se asienta. t en segundos desde que empezó.
const PARPADEO = { cierra: 0.055, cerrado: 0.04, abre: 0.09, asienta: 0.16, pasa: 1.12 }
function abiertoParpadeo(t) {
  const P = PARPADEO
  if (t < P.cierra) { const k = t / P.cierra; return 1 - k * k }
  t -= P.cierra
  if (t < P.cerrado) return 0
  t -= P.cerrado
  if (t < P.abre) { const k = t / P.abre; return P.pasa * (1 - (1 - k) * (1 - k)) }
  t -= P.abre
  if (t < P.asienta) { const k = t / P.asienta; return 1 + (P.pasa - 1) * Math.cos(k * Math.PI * 1.5) * (1 - k) }
  return 1
}
const DURA_PARPADEO = PARPADEO.cierra + PARPADEO.cerrado + PARPADEO.abre + PARPADEO.asienta

// Voltear a los lados: a la izquierda, se queda, a la derecha, se queda, al
// centro. [segundo, mirada x]; entre uno y otro la mirada brinca con resorte.
const VOLTEAR = [[0, -1], [0.75, 1], [1.5, -0.95], [2.05, 0]]
const VOLTEAR_DURA = 2.4
// Confundida: mira a un lado (ahí el ojo chico) y cada tanto cambia de lado parpadeando.
const CONFUNDIDA = { mirada: [0.6, 0.22], cambia: [2.2, 3.4] }
// Enojada: la luz roja entra parpadeando como alarma ([segundo, nivel]) y sale en 0.35 s.
const ALARMA = [[0, 1], [0.05, 0.15], [0.1, 1], [0.15, 0.35], [0.2, 1]]
const ENOJO_SALE = 0.35
const ENOJADA = 2, CONF = 3, TACHE = 4
// Quemada: el hollín entra de golpe y se va despacio (segundos).
const HOLLIN = { entra: 0.12, sale: 3.2 }

// El controlador de la cara: parpadea solo, mira alrededor a saltos, tiene
// fallas de señal de vez en cuando, cambia de cara con un barrido y voltea a
// los lados. `rnd` (como Math.random) permite repetir el azar al grabar video.
// `estado.mirada` sirve para que el cuerpo voltee con los ojos.
export function crearCara(uniforms, { auto = true, rnd = Math.random } = {}) {
  const u = uniforms
  const azar = (a, b) => a + rnd() * (b - a)
  const est = {
    t: 0,
    proximoParpadeo: azar(1.2, 3.2),
    parpadeo: -1,
    doble: false,
    proximaMirada: azar(0.6, 1.6),
    mirada: [0, 0], vel: [0, 0], meta: [0, 0],
    voltear: -1,
    proximaFalla: azar(5, 10),
    falla: -1, fallaDura: 0.2,
    cambio: 1,
    desdeCambio: 10,
    expr: 0,
    lado: 1, ladoPendiente: 0, cambioLado: 0,
    enojo: 0, desdeEnojo: -1,
    quemado: 0, quemadoMeta: 0,
    encendido: 1, encMeta: 1,
    auto,
    proximaAuto: 2.4,
    ordenAuto: [1, 0, 'voltear', 2, 0, 3, 0, 'voltear'],
    iAuto: 0,
  }
  const cara = {
    estado: est,
    poner(expr) {
      if (expr === 'voltear') { cara.voltear(); return }
      const i = typeof expr === 'number' ? expr : Math.max(0, EXPRESIONES.indexOf(expr))
      if (i === est.expr) return
      u.uExprPrev.value = est.expr
      u.uExpr.value = i
      est.expr = i
      est.cambio = 0
      est.desdeCambio = 0
      est.parpadeo = 0
      est.voltear = -1
      if (i === CONF) {
        est.lado = rnd() < 0.5 ? -1 : 1
        u.uLadoConf.value = est.lado
        est.cambioLado = est.t + azar(...CONFUNDIDA.cambia)
      }
      est.desdeEnojo = i === ENOJADA ? 0 : -1
    },
    voltear() {
      est.voltear = 0
      est.parpadeo = -1
      est.proximoParpadeo = est.t + VOLTEAR_DURA + azar(0.4, 1.2)
    },
    apagar() { est.encMeta = 0 },
    // el hollín del rayo (0 a 1); entra rápido y se va despacio
    quemar(nivel) { est.quemadoMeta = Math.max(0, Math.min(1, nivel)) },
    encender() { est.encMeta = 1 },
    mirar(x, y) { est.meta = [x, y]; est.proximaMirada = est.t + 2.5 },
    actualizar(dt) {
      dt = Math.min(dt, 0.1)
      est.t += dt
      const t = est.t
      u.uTiempo.value = t
      // parpadeo
      if (est.parpadeo < 0 && t >= est.proximoParpadeo) {
        est.parpadeo = 0
        est.doble = rnd() < 0.22
      }
      if (est.parpadeo >= 0) {
        est.parpadeo += dt
        u.uAbierto.value = abiertoParpadeo(est.parpadeo)
        if (est.ladoPendiente && est.parpadeo >= PARPADEO.cierra) {
          est.lado = est.ladoPendiente
          est.ladoPendiente = 0
          u.uLadoConf.value = est.lado
          est.desdeCambio = 0
        }
        if (est.parpadeo >= DURA_PARPADEO) {
          if (est.doble) { est.doble = false; est.parpadeo = 0.02 }
          else { est.parpadeo = -1; u.uAbierto.value = 1; est.proximoParpadeo = t + azar(1.8, 4.8) }
        }
      }
      // voltear a los lados, o la mirada a saltos
      if (est.voltear >= 0) {
        est.voltear += dt
        let x = 0
        for (const [s, v] of VOLTEAR) if (est.voltear >= s) x = v
        est.meta = [x, 0]
        if (est.voltear >= VOLTEAR_DURA) { est.voltear = -1; est.proximaMirada = t + azar(0.8, 1.6) }
      } else if (est.expr === CONF) {
        if (t >= est.cambioLado && est.parpadeo < 0) {
          est.ladoPendiente = -est.lado
          est.parpadeo = 0
          est.cambioLado = t + azar(...CONFUNDIDA.cambia)
        }
        est.meta = [CONFUNDIDA.mirada[0] * est.lado, CONFUNDIDA.mirada[1]]
      } else if (est.expr === ENOJADA) {
        est.meta = [0, -0.15]   // la mirada fija al frente
      } else if (est.expr === TACHE) {
        est.meta = [0.3 * Math.cos(t * 2.2), 0.18 * Math.sin(t * 2.2)]   // mareada: da vueltas
        est.parpadeo = -1
        est.proximoParpadeo = t + 1
        u.uAbierto.value = 1
      } else if (t >= est.proximaMirada) {
        const lejos = rnd() < 0.35
        est.meta = rnd() < 0.3 ? [0, 0] : [azar(-1, 1) * (lejos ? 0.8 : 0.45), azar(-0.8, 0.8) * (lejos ? 0.8 : 0.4)]
        est.proximaMirada = t + azar(0.7, 2.4)
      }
      // el resorte en subpasos: con un solo paso de 0.1 s (un cuadro lento, el
      // warm-up de la home) se volvía inestable y la mirada explotaba a NaN
      const hz = est.voltear >= 0 ? 4.2 : 5.5
      const pasos = Math.max(1, Math.ceil(dt * 120))
      for (let k = 0; k < 2; k++) {
        let x = est.mirada[k], v = est.vel[k]
        for (let i = 0; i < pasos; i++) [x, v] = resorte(x, v, est.meta[k], dt / pasos, hz, 0.36)
        if (!Number.isFinite(x) || !Number.isFinite(v)) { x = est.meta[k] || 0; v = 0 }
        est.mirada[k] = x; est.vel[k] = v
      }
      u.uMirar.value.set(est.mirada[0], est.mirada[1])
      // cambio de cara: el barrido dura 0.22 s
      est.desdeCambio += dt
      u.uDesdeCambio.value = est.desdeCambio
      if (est.cambio < 1) { est.cambio = Math.min(1, est.cambio + dt / 0.22); u.uCambio.value = est.cambio }
      // fallas de señal
      if (est.falla < 0 && t >= est.proximaFalla) { est.falla = 0; est.fallaDura = azar(0.06, 0.16) }
      if (est.falla >= 0) {
        est.falla += dt
        u.uGlitch.value = est.falla < est.fallaDura ? 1 : 0
        if (est.falla >= est.fallaDura) { est.falla = -1; u.uGlitch.value = 0; est.proximaFalla = t + azar(5, 10) }
      }
      // la luz roja del enojo
      if (est.desdeEnojo >= 0) {
        est.desdeEnojo += dt
        let v = 1
        for (const [s0, n] of ALARMA) if (est.desdeEnojo >= s0) v = n
        est.enojo = v
      } else {
        est.enojo = Math.max(0, est.enojo - dt / ENOJO_SALE)
      }
      u.uEnojo.value = est.enojo
      const dq = est.quemadoMeta - est.quemado
      est.quemado += Math.sign(dq) * Math.min(Math.abs(dq), dt / (dq > 0 ? HOLLIN.entra : HOLLIN.sale))
      u.uQuemado.value = est.quemado
      // encendido / apagado
      const vEnc = est.encMeta > est.encendido ? 1 / 0.45 : 1 / 0.35
      est.encendido += Math.sign(est.encMeta - est.encendido) * Math.min(Math.abs(est.encMeta - est.encendido), vEnc * dt)
      u.uEncendido.value = est.encendido
      // modo automático (la demo): cambia de cara solo
      if (est.auto && t >= est.proximaAuto) {
        const sig = est.ordenAuto[est.iAuto % est.ordenAuto.length]
        cara.poner(sig)
        est.iAuto++
        est.proximaAuto = t + (sig === 'voltear' ? VOLTEAR_DURA + 0.6 : sig === 0 ? 1.4 : 2.4)
      }
    },
  }
  return cara
}
