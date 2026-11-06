// La trama de las secciones (fx/TramaEffect.jsx) en el iris: la misma retícula, los
// mismos puntos que crecen hasta tocarse. El iris cubre mientras la escena de abajo se
// cambia, así que no puede vivir en el composer de home: va en su propio canvas, con
// WebGL directo para no cargar three en el arranque, y se suelta al terminar.
//
// `dibuja` recibe el radio del hoyo. Afuera de él los puntos crecen a lo largo de la
// banda, así que con el radio en -banda ya no queda hoyo, y con la esquina más lejana
// adentro del radio no queda ningún punto. `lleno` hace crecer todos los puntos parejo,
// sin círculo: de 0 a 1 tapa la pantalla en su lugar.

const VERTICE = `
  attribute vec2 p;
  void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

const FRAGMENTO = `
  precision highp float;
  uniform vec2 uCentro;
  uniform float uRadio;
  uniform float uLleno;
  uniform float uBanda;
  uniform float uPaso;
  uniform vec3 uColor;

  const float ANG_COS = 0.9659;
  const float ANG_SIN = 0.2588;

  void main() {
    vec2 px = gl_FragCoord.xy;
    vec2 g = vec2(px.x * ANG_COS - px.y * ANG_SIN, px.x * ANG_SIN + px.y * ANG_COS) / uPaso;
    float celda = length(fract(g) - 0.5);
    float aa = 1.2 / uPaso;
    float d = length(px - uCentro) - uRadio;

    float k = max(clamp(d / uBanda, 0.0, 1.0), uLleno);
    float r = pow(k, 0.7) * 0.86;
    float punto = k > 0.0 ? 1.0 - smoothstep(r - aa, r + aa, celda) : 0.0;

    gl_FragColor = vec4(uColor * punto, punto);
  }
`

// Medidas en altos de pantalla, como en la trama.
const BANDA = 0.34
const CELDAS_POR_ALTO = 56
const AZUL_HOME = [2, 45, 214]

function compila(gl, tipo, fuente) {
  const s = gl.createShader(tipo)
  gl.shaderSource(s, fuente)
  gl.compileShader(s)
  return s
}

// Sin WebGL devuelve null y el iris se queda con su círculo de CSS. `color` va en 0-255.
export function crearIrisTrama(capa, color = AZUL_HOME) {
  const canvas = document.createElement('canvas')
  canvas.className = 'iris-trama'
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
  if (!gl) return null

  const programa = gl.createProgram()
  gl.attachShader(programa, compila(gl, gl.VERTEX_SHADER, VERTICE))
  gl.attachShader(programa, compila(gl, gl.FRAGMENT_SHADER, FRAGMENTO))
  gl.linkProgram(programa)
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) return null
  gl.useProgram(programa)

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const p = gl.getAttribLocation(programa, 'p')
  gl.enableVertexAttribArray(p)
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0)

  const u = (nombre) => gl.getUniformLocation(programa, nombre)
  const uCentro = u('uCentro')
  const uRadio = u('uRadio')
  const uLleno = u('uLleno')
  gl.uniform3fv(u('uColor'), color.map((c) => c / 255))
  capa.style.setProperty('--iris-fondo', `rgb(${color.join(',')})`)
  const uBanda = u('uBanda')
  const uPaso = u('uPaso')

  const dpr = () => Math.min(2, window.devicePixelRatio || 1)
  const mide = () => {
    const w = Math.round(window.innerWidth * dpr())
    const h = Math.round(window.innerHeight * dpr())
    if (canvas.width === w && canvas.height === h) return
    canvas.width = w
    canvas.height = h
    gl.viewport(0, 0, w, h)
    gl.uniform1f(uBanda, h * BANDA)
    gl.uniform1f(uPaso, h / CELDAS_POR_ALTO)
  }
  mide()
  capa.prepend(canvas)

  return {
    banda: () => window.innerHeight * BANDA,
    dibuja(x, y, r, lleno = 0) {
      mide()
      const k = dpr()
      gl.uniform2f(uCentro, x * k, canvas.height - y * k)
      gl.uniform1f(uRadio, r * k)
      gl.uniform1f(uLleno, lleno)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    suelta() {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    },
  }
}
