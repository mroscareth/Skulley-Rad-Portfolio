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
