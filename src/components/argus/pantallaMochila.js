import * as THREE from 'three'

// La carita de la mochila de Argus (la misma de M.A.D.R.E.): dos pastillas cian y
// una raya sobre negro. Son las del modelo, medidas de su textura (cada una con su
// lugar, tamaño e inclinación: no son simétricas) y dibujadas con orilla nítida;
// encima va la mirada, que sigue a Skulley cuando lo tiene enfrente, y el parpadeo.
// Sin diálogos (Oscar, 2026-11-19).
//
// Un solo programa: mirada y parpadeo son uniforms. El dibujo sale de la posición
// del vértice en la pantalla (la malla `Argus_pantalla`, plana, en x/y del GLB).

const VERT_PARS = /* glsl */`
uniform vec2 uPantCentro;
uniform vec2 uPantRadio;
varying vec2 vPant;
`
const VERT = /* glsl */`
vPant = (position.xy - uPantCentro) / uPantRadio;
`

const FRAG_PARS = /* glsl */`
uniform vec2 uMirar;
uniform float uAbierto;
uniform vec3 uColorOjo;
uniform vec3 uColorFondo;
varying vec2 vPant;

// medidas de la textura, en unidades de la pantalla (-1..1); x = izquierda de Argus
#define OJO_A vec3(-0.2057, 0.1445, 0.035)
#define OJO_A_H 0.1194
#define OJO_A_R 0.0938
#define OJO_B vec3(0.2119, 0.1312, 0.032)
#define OJO_B_H 0.1297
#define OJO_B_R 0.0919
#define BOCA vec3(-0.0113, -0.3024, 0.028)
#define BOCA_W 0.3208
#define BOCA_R 0.0926

vec2 giraM(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float capsV(vec2 p, float h, float r) { p.y -= clamp(p.y, -h, h); return length(p) - r; }
float capsH(vec2 p, float w, float r) { p.x -= clamp(p.x, -w, w); return length(p) - r; }

// un ojo: e relativo a su centro; cerrado es una rayita abajo de la mitad
float ojoM(vec2 e, float h, float r, float abierto) {
  float est = max(abierto, 1.0);              // al abrirse de más se estira
  vec2 s = vec2((1.0 - 0.12 * abs(uMirar.x)) / sqrt(est), est);
  float d = capsV(e / s, h, r) * min(s.x, s.y);
  float cerrado = capsH(e - vec2(0.0, -0.035), r * 1.05, 0.032);
  return mix(cerrado, d, clamp(abierto, 0.0, 1.0));
}
`

const FRAG = /* glsl */`
{
  vec2 p = vPant;
  vec2 m = uMirar * vec2(0.17, 0.12);
  float d = ojoM(giraM(p - OJO_A.xy - m, OJO_A.z), OJO_A_H, OJO_A_R, uAbierto);
  d = min(d, ojoM(giraM(p - OJO_B.xy - m, OJO_B.z), OJO_B_H, OJO_B_R, uAbierto));
  d = min(d, capsH(giraM(p - BOCA.xy - m * 0.6, BOCA.z), BOCA_W, BOCA_R));
  float aa = max(fwidth(d), 1e-5) * 0.7;
  float on = 1.0 - smoothstep(-aa, aa, d);
  outgoingLight = mix(uColorFondo, uColorOjo, on);
}
`

export function crearMaterialMochila(geometria) {
  geometria.computeBoundingBox()
  const bb = geometria.boundingBox
  const u = {
    uPantCentro: { value: new THREE.Vector2((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2) },
    uPantRadio: { value: new THREE.Vector2((bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2) },
    uMirar: { value: new THREE.Vector2() },
    uAbierto: { value: 1 },
    uColorOjo: { value: new THREE.Color(4 / 255, 229 / 255, 242 / 255) },
    uColorFondo: { value: new THREE.Color(0, 0, 0) },
  }
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  m.name = 'PantallaMochila'
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = VERT_PARS + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT)
    shader.fragmentShader = FRAG_PARS + shader.fragmentShader.replace('#include <opaque_fragment>', FRAG + '\n#include <opaque_fragment>')
  }
  m.customProgramCacheKey = () => 'pantallaMochila1'
  m.userData.pantalla = u
  return m
}

// Parpadeo de caricatura (el de la pantalla del drone): cierra rápido, abre
// pasándose y se asienta.
const PARPADEO = { cierra: 0.055, cerrado: 0.04, abre: 0.09, asienta: 0.16, pasa: 1.12 }
const DURA_PARPADEO = PARPADEO.cierra + PARPADEO.cerrado + PARPADEO.abre + PARPADEO.asienta
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

// El que la anima. mirar(x, y) cada cuadro mientras tiene a quién ver (-1..1 en la
// pantalla); sin eso pasea la vista a saltos, despacio. Al encontrarlo, los ojos
// se abren de más un instante.
export function crearCaraMochila(uniforms) {
  const u = uniforms
  const azar = (a, b) => a + Math.random() * (b - a)
  const est = {
    t: 0, parpadeo: -1, proximoParpadeo: azar(1.5, 4), doble: false,
    mirada: [0, 0], vel: [0, 0], meta: [0, 0], proximaMirada: azar(1, 3),
    viendo: false, pedido: false, susto: -1,
  }
  return {
    estado: est,
    mirar(x, y) { est.pedido = true; est.meta = [x, y] },
    actualizar(dt) {
      dt = Math.min(dt, 0.1)
      est.t += dt
      const t = est.t
      if (est.pedido && !est.viendo) { est.susto = 0; est.parpadeo = -1 }
      est.viendo = est.pedido
      est.pedido = false
      if (!est.viendo && t >= est.proximaMirada) {
        est.meta = Math.random() < 0.35 ? [0, 0] : [azar(-0.6, 0.6), azar(-0.35, 0.35)]
        est.proximaMirada = t + azar(1.2, 3.5)
      }
      let abierto = 1
      if (est.susto >= 0) {
        est.susto += dt
        const k = est.susto
        abierto = 1 + 0.22 * Math.exp(-k * 7) * Math.cos(k * 18)
        if (k > 0.6) { est.susto = -1; est.proximoParpadeo = t + azar(0.8, 2) }
      } else {
        if (est.parpadeo < 0 && t >= est.proximoParpadeo) { est.parpadeo = 0; est.doble = Math.random() < 0.2 }
        if (est.parpadeo >= 0) {
          est.parpadeo += dt
          abierto = abiertoParpadeo(est.parpadeo)
          if (est.parpadeo >= DURA_PARPADEO) {
            if (est.doble) { est.doble = false; est.parpadeo = 0.02 } else { est.parpadeo = -1; est.proximoParpadeo = t + azar(2, 5) }
          }
        }
      }
      u.uAbierto.value = abierto
      // resorte con sobrepaso, en subpasos (un cuadro lento no lo vuelve inestable)
      const w = 2 * Math.PI * (est.viendo ? 6 : 4.5)
      const pasos = Math.max(1, Math.ceil(dt * 120))
      const h = dt / pasos
      for (let k = 0; k < 2; k += 1) {
        let x = est.mirada[k], v = est.vel[k]
        for (let i = 0; i < pasos; i += 1) {
          v += (-w * w * (x - est.meta[k]) - 2 * 0.4 * w * v) * h
          x += v * h
        }
        if (!Number.isFinite(x) || !Number.isFinite(v)) { x = 0; v = 0 }
        est.mirada[k] = x
        est.vel[k] = v
      }
      u.uMirar.value.set(est.mirada[0], est.mirada[1])
    },
  }
}
