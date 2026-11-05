import * as THREE from 'three'

// Skulley se deshace en puntos de sus propios colores. Salen de la pose que traía en
// ese momento, de los pies a la cabeza, y todo el vuelo corre en el shader: al soltarlos
// no se paga nada por cuadro. Son planos a propósito: los pinta la trama al final de la
// cadena, junto con los demás puntos.
//
// El color se toma de un cuadro congelado, de donde caía cada punto en pantalla, porque
// las skins pintan en su shader y material.color no las conoce. Así sale cualquier skin
// tal cual se veía, con sus tintas y sus puntos de cámara.
const MAX = 1500
const VIDA_S = [0.42, 0.78]

const VERTICE = /* glsl */`
  attribute vec3 aRumbo;
  attribute vec2 aTiempo;
  attribute vec2 aFoto;
  attribute float aTam;
  uniform sampler2D uFoto;
  uniform float uT;
  uniform float uTam;
  varying vec3 vTono;

  void main() {
    float k = (uT - aTiempo.x) / aTiempo.y;
    if (k <= 0.0 || k >= 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    // Primero suben, y ya arriba se abren: alcanzan a leerse como él.
    float ang = aRumbo.x + 2.4 * k;
    vec3 p = position + vec3(cos(ang), 0.0, sin(ang)) * aRumbo.y * k * k;
    p.y += aRumbo.z * k * (0.3 + 0.7 * k);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uTam * aTam * pow(1.0 - k, 0.7);
    // El cuadro ya viene en sRGB y la trama trabaja en lineal.
    vec3 c = texture2D(uFoto, aFoto).rgb;
    vTono = mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045)));
  }
`

const FRAGMENTO = /* glsl */`
  varying vec3 vTono;

  void main() {
    if (length(gl_PointCoord - 0.5) > 0.5) discard;
    gl_FragColor = vec4(vTono, 1.0);
  }
`

export function crearParticulas() {
  const geometria = new THREE.BufferGeometry()
  const posicion = new Float32Array(MAX * 3)
  const rumbo = new Float32Array(MAX * 3)
  const tiempo = new Float32Array(MAX * 2)
  const foto = new Float32Array(MAX * 2)
  const tam = new Float32Array(MAX)
  geometria.setAttribute('position', new THREE.BufferAttribute(posicion, 3))
  geometria.setAttribute('aRumbo', new THREE.BufferAttribute(rumbo, 3))
  geometria.setAttribute('aTiempo', new THREE.BufferAttribute(tiempo, 2))
  geometria.setAttribute('aFoto', new THREE.BufferAttribute(foto, 2))
  geometria.setAttribute('aTam', new THREE.BufferAttribute(tam, 1))

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: FRAGMENTO,
    uniforms: { uT: { value: 0 }, uTam: { value: 12 }, uFoto: { value: null } },
    depthTest: false,
    depthWrite: false,
  })
  const puntos = new THREE.Points(geometria, material)
  puntos.frustumCulled = false

  const v = new THREE.Vector3()

  return {
    puntos,
    set t(valor) { material.uniforms.uT.value = valor },
    set tam(valor) { material.uniforms.uTam.value = valor },
    set foto(valor) { material.uniforms.uFoto.value = valor },

    // Devuelve la altura de los pies y de la cabeza, para que el corte suba parejo.
    suelta(raiz, duracion) {
      const cuerpos = []
      let total = 0
      raiz.traverse((o) => {
        if (!o.isSkinnedMesh || !o.visible || o.name.endsWith('_outline')) return
        const n = o.geometry?.attributes?.position?.count || 0
        if (!n) return
        cuerpos.push({ malla: o, n })
        total += n
      })
      if (!cuerpos.length) return null

      let y0 = Infinity
      let y1 = -Infinity
      for (let i = 0; i < MAX; i += 1) {
        let r = Math.random() * total
        let c = cuerpos[0]
        for (const x of cuerpos) {
          c = x
          r -= x.n
          if (r <= 0) break
        }
        c.malla.getVertexPosition(Math.floor(Math.random() * c.n), v).applyMatrix4(c.malla.matrixWorld)
        posicion[i * 3] = v.x
        posicion[i * 3 + 1] = v.y
        posicion[i * 3 + 2] = v.z
        if (v.y < y0) y0 = v.y
        if (v.y > y1) y1 = v.y
        rumbo[i * 3] = Math.random() * Math.PI * 2
        rumbo[i * 3 + 1] = 0.15 + Math.random() * 0.75
        rumbo[i * 3 + 2] = 1.2 + Math.random() * 2.2
        tiempo[i * 2 + 1] = VIDA_S[0] + Math.random() * (VIDA_S[1] - VIDA_S[0])
        tam[i] = 0.55 + Math.random() * 0.75
      }
      const alto = Math.max(0.01, y1 - y0)
      for (let i = 0; i < MAX; i += 1) {
        tiempo[i * 2] = ((posicion[i * 3 + 1] - y0) / alto) * duracion + Math.random() * 0.05
      }
      for (const a of Object.values(geometria.attributes)) a.needsUpdate = true
      return [y0, y1]
    },

    // Con la cámara del cuadro que se va a congelar.
    apunta(camara) {
      for (let i = 0; i < MAX; i += 1) {
        v.fromArray(posicion, i * 3).project(camara)
        foto[i * 2] = v.x * 0.5 + 0.5
        foto[i * 2 + 1] = v.y * 0.5 + 0.5
      }
      geometria.attributes.aFoto.needsUpdate = true
    },

    dispose() {
      geometria.dispose()
      material.dispose()
    },
  }
}
