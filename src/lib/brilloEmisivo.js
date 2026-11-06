import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { skinLineColor } from './skinShaders.js'

// El post de bolsillo del Skulley del preloader, que no tiene composer: meterlo
// arrastraría @react-three/postprocessing al chunk del arranque. Hace las dos cosas que
// en home hacen EdgeInk y Bloom, más los puntos de cámara de DotScreen.
//
// Los puntos son la misma cuenta y los mismos valores que en home, solo sobre Skulley.
// Hay que leer el cuadro, que aquí va directo a la pantalla: se copia al terminar.
//
// La tinta es la de EdgeInkEffect, con el contorno por borde interno del teléfono: lee
// las normales de CharacterNormalPass, y no duplica ninguna malla como el hull.
//
// El brillo parte de la silueta real de lo que emite luz: primero se dibuja la profundidad de
// toda la escena y encima solo los emisores, así la cuenca del hueso les tapa lo que
// tapa en pantalla. Eso se difumina a un cuarto de tamaño y se suma al cuadro. Un sprite
// redondo no sirve: no conoce la forma del ojo y su luz parecía salir de abajo del
// hueso. Al final se redibuja lo que va `encima` (las pupilas), que se quedan negras.
//
// Se dibuja aquí la escena: en cuanto un useFrame tiene prioridad mayor a 0, R3F deja de
// llamar a gl.render por su cuenta. Va en 2 para correr después de CameraAim (prioridad 1).
const ESCALA = 4
const INTENSIDAD = 1.15
// Se miden contra el alto de la pantalla: aquí Skulley la llena, y con grosor fijo el
// trazo se vería mucho más fino que en home.
const LINEA_POR_ALTO = 2.4 / 900
const CONTORNO_POR_ALTO = 3.6 / 900
// Los de fx en App.jsx. PUNTOS_RESOLUCION es el resolutionScale del composer de escritorio:
// el punto mide lo mismo que en home porque el patrón se calcula en sus pixeles.
const PUNTOS_ANGULO = 0.06
const PUNTOS_OPACIDAD = 0.02
const PUNTOS_RESOLUCION = 0.8

const VERTICE = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const TINTA = /* glsl */`
  uniform sampler2D tNormales;
  uniform vec2 uLinea;
  uniform vec2 uContorno;
  uniform vec3 uColor;
  varying vec2 vUv;

  float esFondo(vec2 uv) {
    vec3 n = texture2D(tNormales, uv).rgb;
    return 1.0 - smoothstep(0.001, 0.05, dot(n, n));
  }

  void main() {
    vec3 c = texture2D(tNormales, vUv).rgb;
    if (dot(c, c) < 0.001) discard;
    // Laplaciano: solo se dispara en pliegues reales, no en superficies curvas.
    vec3 vecinos = texture2D(tNormales, vUv - vec2(uLinea.x, 0.0)).rgb
      + texture2D(tNormales, vUv + vec2(uLinea.x, 0.0)).rgb
      + texture2D(tNormales, vUv + vec2(0.0, uLinea.y)).rgb
      + texture2D(tNormales, vUv - vec2(0.0, uLinea.y)).rgb;
    float tinta = smoothstep(0.3, 0.46, distance(c, vecinos * 0.25) * 4.0) * 0.95;

    vec2 d = uContorno * 0.70710678;
    float borde = esFondo(vUv + vec2(uContorno.x, 0.0));
    borde = max(borde, esFondo(vUv - vec2(uContorno.x, 0.0)));
    borde = max(borde, esFondo(vUv + vec2(0.0, uContorno.y)));
    borde = max(borde, esFondo(vUv - vec2(0.0, uContorno.y)));
    borde = max(borde, esFondo(vUv + d));
    borde = max(borde, esFondo(vUv - d));
    borde = max(borde, esFondo(vUv + vec2(d.x, -d.y)));
    borde = max(borde, esFondo(vUv + vec2(-d.x, d.y)));

    gl_FragColor = vec4(uColor, max(tinta, borde));
  }
`

const PUNTOS = /* glsl */`
  uniform sampler2D tCuadro;
  uniform sampler2D tNormales;
  uniform vec2 uResolucion;
  uniform vec2 uAngulo;
  uniform float uOpacidad;
  varying vec2 vUv;

  vec3 aLineal(vec3 c) {
    return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045)));
  }
  vec3 aSrgb(vec3 c) {
    return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }

  void main() {
    vec3 n = texture2D(tNormales, vUv).rgb;
    if (dot(n, n) < 0.001) discard;
    vec4 cuadro = texture2D(tCuadro, vUv);
    vec3 a = aLineal(cuadro.rgb);
    vec2 p = vUv * uResolucion;
    vec2 q = vec2(dot(uAngulo.yx, vec2(p.x, -p.y)), dot(uAngulo, p));
    vec3 trama = a * 10.0 - 5.0 + sin(q.x) * sin(q.y) * 4.0;
    vec3 c = mix(a, a + trama - min(a * trama, 1.0), uOpacidad);
    gl_FragColor = vec4(aSrgb(clamp(c, 0.0, 1.0)), cuadro.a);
  }
`

const DIFUMINA = /* glsl */`
  uniform sampler2D tMapa;
  uniform vec2 uPaso;
  varying vec2 vUv;
  void main() {
    // Gaussiana de 13 muestras, sigma ~3.2 a este tamaño: un halo corto, pegado a la orilla.
    vec3 c = texture2D(tMapa, vUv).rgb * 0.1247;
    c += (texture2D(tMapa, vUv + uPaso).rgb + texture2D(tMapa, vUv - uPaso).rgb) * 0.1174;
    c += (texture2D(tMapa, vUv + uPaso * 2.0).rgb + texture2D(tMapa, vUv - uPaso * 2.0).rgb) * 0.0979;
    c += (texture2D(tMapa, vUv + uPaso * 3.0).rgb + texture2D(tMapa, vUv - uPaso * 3.0).rgb) * 0.0722;
    c += (texture2D(tMapa, vUv + uPaso * 4.0).rgb + texture2D(tMapa, vUv - uPaso * 4.0).rgb) * 0.0472;
    c += (texture2D(tMapa, vUv + uPaso * 5.0).rgb + texture2D(tMapa, vUv - uPaso * 5.0).rgb) * 0.0273;
    c += (texture2D(tMapa, vUv + uPaso * 6.0).rgb + texture2D(tMapa, vUv - uPaso * 6.0).rgb) * 0.014;
    gl_FragColor = vec4(c, 1.0);
  }
`

const SUMA = /* glsl */`
  uniform sampler2D tMapa;
  uniform float uIntensidad;
  varying vec2 vUv;
  void main() {
    vec3 c = pow(texture2D(tMapa, vUv).rgb * uIntensidad, vec3(1.0 / 2.2));
    // Alfa aparte: el canvas es transparente y el brillo también cae sobre la página.
    gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
  }
`

export function useBrilloEmisivo(fuentes, normales) {
  const { gl, scene, camera } = useThree()
  const r = useMemo(() => {
    const destino = (depthBuffer) => new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer,
    })
    const difumina = new THREE.ShaderMaterial({
      vertexShader: VERTICE,
      fragmentShader: DIFUMINA,
      uniforms: { tMapa: { value: null }, uPaso: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    })
    const suma = new THREE.ShaderMaterial({
      vertexShader: VERTICE,
      fragmentShader: SUMA,
      uniforms: { tMapa: { value: null }, uIntensidad: { value: INTENSIDAD } },
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const tinta = new THREE.ShaderMaterial({
      vertexShader: VERTICE,
      fragmentShader: TINTA,
      uniforms: {
        tNormales: { value: null },
        uLinea: { value: new THREE.Vector2() },
        uContorno: { value: new THREE.Vector2() },
        uColor: { value: new THREE.Color() },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const puntos = new THREE.ShaderMaterial({
      vertexShader: VERTICE,
      fragmentShader: PUNTOS,
      uniforms: {
        tCuadro: { value: null },
        tNormales: { value: null },
        uResolucion: { value: new THREE.Vector2() },
        uAngulo: { value: new THREE.Vector2(Math.sin(PUNTOS_ANGULO), Math.cos(PUNTOS_ANGULO)) },
        uOpacidad: { value: PUNTOS_OPACIDAD },
      },
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    })
    const cuadro = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), difumina)
    cuadro.frustumCulled = false
    return {
      mascara: destino(true),
      ida: destino(false),
      vuelta: destino(false),
      soloProfundidad: new THREE.MeshBasicMaterial({ colorWrite: false }),
      plano: new THREE.MeshBasicMaterial({ toneMapped: false }),
      tinta,
      puntos,
      copia: null,
      difumina,
      suma,
      cuadro,
      camara: new THREE.Camera(),
      tam: new THREE.Vector2(),
    }
  }, [])

  useEffect(() => () => {
    r.mascara.dispose()
    r.ida.dispose()
    r.vuelta.dispose()
    r.soloProfundidad.dispose()
    r.plano.dispose()
    r.tinta.dispose()
    r.puntos.dispose()
    r.copia?.dispose()
    r.difumina.dispose()
    r.suma.dispose()
    r.cuadro.geometry.dispose()
  }, [r])

  useFrame(({ size }) => {
    gl.render(scene, camera)
    const auto = gl.autoClear
    gl.autoClear = false

    const { brillan, encima } = fuentes()
    if (brillan.length) {
      const m = gl.getDrawingBufferSize(r.tam)
      const w = Math.max(2, Math.floor(m.x / ESCALA))
      const h = Math.max(2, Math.floor(m.y / ESCALA))
      if (r.mascara.width !== w || r.mascara.height !== h) {
        r.mascara.setSize(w, h)
        r.ida.setSize(w, h)
        r.vuelta.setSize(w, h)
      }

      const alfa = gl.getClearAlpha()
      gl.setClearAlpha(0)

      gl.setRenderTarget(r.mascara)
      gl.clear(true, true, true)
      scene.overrideMaterial = r.soloProfundidad
      gl.render(scene, camera)
      scene.overrideMaterial = null
      for (const { malla, tono } of brillan) {
        const material = malla.material
        r.plano.color.copy(tono)
        malla.material = r.plano
        gl.render(malla, camera)
        malla.material = material
      }

      const pasa = (destino, mapa, x, y) => {
        r.difumina.uniforms.tMapa.value = mapa
        r.difumina.uniforms.uPaso.value.set(x, y)
        gl.setRenderTarget(destino)
        gl.clear(true, false, false)
        gl.render(r.cuadro, r.camara)
      }
      r.cuadro.material = r.difumina
      pasa(r.ida, r.mascara.texture, 1 / w, 0)
      pasa(r.vuelta, r.ida.texture, 0, 1 / h)

      gl.setRenderTarget(null)
      r.suma.uniforms.tMapa.value = r.vuelta.texture
      r.cuadro.material = r.suma
      gl.render(r.cuadro, r.camara)
      for (const malla of encima) gl.render(malla, camera)

      gl.setClearAlpha(alfa)
    }

    // Después del brillo: debajo de él la línea del ojo se volvía café.
    if (normales?.current) {
      const u = r.tinta.uniforms
      u.tNormales.value = normales.current
      const linea = size.height * LINEA_POR_ALTO
      u.uLinea.value.set(linea / size.width, linea / size.height)
      const contorno = size.height * CONTORNO_POR_ALTO
      u.uContorno.value.set(contorno / size.width, contorno / size.height)
      u.uColor.value.setRGB(skinLineColor[0], skinLineColor[1], skinLineColor[2])
      r.cuadro.material = r.tinta
      gl.render(r.cuadro, r.camara)

      const m = gl.getDrawingBufferSize(r.tam)
      if (r.copia?.image.width !== m.x || r.copia?.image.height !== m.y) {
        r.copia?.dispose()
        r.copia = new THREE.FramebufferTexture(m.x, m.y)
        r.copia.minFilter = THREE.NearestFilter
        r.copia.magFilter = THREE.NearestFilter
      }
      gl.copyFramebufferToTexture(r.copia)
      const p = r.puntos.uniforms
      p.tCuadro.value = r.copia
      p.tNormales.value = normales.current
      p.uResolucion.value.set(size.width * PUNTOS_RESOLUCION, size.height * PUNTOS_RESOLUCION)
      r.cuadro.material = r.puntos
      gl.render(r.cuadro, r.camara)
    }

    gl.autoClear = auto
  }, 2)
}
