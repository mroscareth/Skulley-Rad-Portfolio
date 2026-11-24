// Lo que comparten los fuegos de Skulley: la llama de la mano (fx/LlamaMano.jsx)
// y la estela de la esfera (fx/EstelaEsfera.jsx). Las brasas usan el mismo texto
// de shader en los dos, así three les da un solo programa y la estela no compila
// nada nuevo para ellas.

// Umbrales de las bandas sobre la densidad del campo. La orilla manda y el
// centro es un núcleo chico (Oscar).
export const BANDAS = { halo: 0.22, hondo: 0.42, medio: 0.95, claro: 1.55, centro: 3.1 }

export const VERT_BRASA = /* glsl */`
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

export const FRAG_BRASA = /* glsl */`
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

// El campo de bocanadas (metaballs en bandas duras sobre un cuadro de frente a la
// cámara) y las chispas de rombo con tinta: los de la turbina del drone
// (drone/TurbinaDrone.jsx) y las antorchas de la plaza de la ofrenda
// (home/PlazaOfrenda.jsx). El mismo texto: un solo programa para los dos.
export const CAMPO_MAX = 40
export const VERT_CAMPO = /* glsl */`
varying vec2 vQ;
void main() {
  vQ = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
export const FRAG_CAMPO = /* glsl */`
#define MAX ${CAMPO_MAX}
uniform vec4 uBolas[MAX];
uniform int uN;
uniform float uTiempo;
uniform vec3 uC0, uC1, uC2, uC3;
uniform vec4 uBandas;
varying vec2 vQ;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  // el campo se deforma con ruido que corre, para que la orilla no sea de burbujas
  vec2 q = vQ + (vec2(ruido(vQ * 9.0 + uTiempo * 7.0), ruido(vQ * 9.0 - uTiempo * 6.0)) - 0.5) * 0.05;
  float campo = 0.0;
  for (int i = 0; i < MAX; i++) {
    if (i >= uN) break;
    vec4 b = uBolas[i];
    vec2 d = q - b.xy;
    float k = 1.0 - dot(d, d) / (b.z * b.z);
    if (k > 0.0) campo += b.w * k * k;
  }
  if (campo < uBandas.x) discard;
  vec3 col = uC0;
  if (campo > uBandas.y) col = uC1;
  if (campo > uBandas.z) col = uC2;
  if (campo > uBandas.w) col = uC3;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`
export const VERT_CHISPA = /* glsl */`
attribute float aTam;
attribute vec3 aColor;
varying vec3 vColor;
uniform float uEscalaPx;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aTam * uEscalaPx / max(-mv.z, 0.1);
}
`
export const FRAG_CHISPA = /* glsl */`
varying vec3 vColor;
void main() {
  // rombo de orilla dura con tinta
  vec2 p = abs(gl_PointCoord - 0.5);
  float d = p.x + p.y;
  if (d > 0.5) discard;
  gl_FragColor = vec4(d > 0.36 ? vec3(0.0) : vColor, 1.0);
  #include <colorspace_fragment>
}
`
