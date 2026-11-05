import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Effect, BlendFunction } from 'postprocessing'
import { wallpaperEstado } from '../../lib/wallpaperEscritorio.js'

// La trama se come al mundo (al entrar a Customize en escritorio, pedido de Oscar):
// una onda de puntos de retícula, del color elegido, nace en los pies de Skulley y
// va tapando todo menos a él. Va al final de la cadena del composer, y por eso el
// fondo sale exacto.
//
// Se monta siempre y sin onda es un passthrough: meter un efecto al composer lo
// obliga a recompilar toda la cadena (ver la nota de Glitch en PostFX).
//
// La máscara (home/WallpaperEscena.jsx) trae a Skulley en alfa 1 y su sombra en alfa
// parcial. Él pasa tal cual, con su trama de cámara, que es parte de cómo se ve; el
// fondo no se deja pasar nunca, porque esos mismos puntos le mueven el color (de
// 255,45,142 a 251,0,119). Ya sin mundo (uSolo) se pinta entero aquí, con las runas
// de Aleatorio encima, y en el marco del wallpaper con el texto (uCapa), que queda
// sobre el fondo y por eso pasa detrás de Skulley.
const FRAGMENTO = /* glsl */`
  uniform sampler2D uMascara;
  uniform sampler2D uRunas;
  uniform sampler2D uCapa;
  uniform sampler2D uParticulas;
  uniform float uConParticulas;
  uniform float uCorte;
  uniform float uSombra;
  uniform float uRunasTinta;
  uniform vec4 uCapaCaja;
  uniform float uConCapa;
  uniform vec2 uPies;
  uniform vec2 uResolucion;
  uniform vec3 uFondo;
  uniform float uOnda;
  uniform float uAplana;
  uniform float uPaso;
  uniform float uSolo;

  const float BANDA = 0.34;
  const float ANG_COS = 0.9659;
  const float ANG_SIN = 0.2588;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uOnda <= 0.0) {
      outputColor = inputColor;
      return;
    }
    float a = texture2D(uMascara, uv).a;
    float skulley = smoothstep(0.72, 0.96, a);
    float sombra = a * (1.0 - skulley) * uSombra;

    vec2 px = uv * uResolucion;
    vec2 g = vec2(px.x * ANG_COS - px.y * ANG_SIN, px.x * ANG_SIN + px.y * ANG_COS) / uPaso;
    float celda = length(fract(g) - 0.5);
    float aa = 1.2 / uPaso;

    // Yendo a una sección Skulley se deshace en estos mismos puntos, de los pies a la
    // cabeza. El corte es de pantalla: él va de pie, y así no se tocan sus materiales.
    if (uCorte > 0.0) {
      float kCorte = clamp((uCorte - uv.y) / 0.09, 0.0, 1.0);
      float rCorte = pow(kCorte, 0.7) * 0.86;
      if (kCorte > 0.0) skulley *= smoothstep(rCorte - aa, rCorte + aa, celda);
    }

    vec3 salida;
    if (uSolo > 0.5) {
      vec3 base = uFondo;
      if (uConCapa > 0.5) {
        vec2 q = (uv - uCapaCaja.xy) / uCapaCaja.zw;
        if (q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0) {
          vec4 capa = texture2D(uCapa, q);
          base = mix(base, capa.rgb, capa.a);
        }
      }
      vec3 runas = texture2D(uRunas, uv).rgb;
      vec3 solo = base * (1.0 - sombra);
      // Son de luz: sobre amarillo o verde no se leen, y ahí van en tinta.
      solo = uRunasTinta > 0.5
        ? mix(solo, vec3(0.0024, 0.0012, 0.009), clamp(dot(runas, vec3(0.6)), 0.0, 1.0))
        : solo + runas;
      salida = mix(solo, inputColor.rgb, skulley);
    } else {
      // Medido en altos de pantalla. Abajo se aplana: nace acostada en el piso,
      // como un círculo visto de lado, y se va abriendo.
      vec2 d = (uv - uPies) * vec2(uResolucion.x / uResolucion.y, uAplana);
      float dist = length(d);

      // Adelante de la onda, una banda de puntos de tinta: el mundo se imprime.
      float kTinta = (uOnda + 0.078 - dist) / 0.1;
      float rTinta = 0.43 * (kTinta < 1.0 ? kTinta : 2.0 - kTinta);
      float tinta = (kTinta > 0.0 && kTinta < 2.0) ? 1.0 - smoothstep(rTinta - aa, rTinta + aa, celda) : 0.0;

      // Atrás, los puntos del color crecen hasta tocarse y ya no queda mundo.
      float k = clamp((uOnda - dist) / BANDA, 0.0, 1.0);
      float r = pow(k, 0.7) * 0.86;
      float punto = k > 0.0 ? 1.0 - smoothstep(r - aa, r + aa, celda) : 0.0;

      vec3 mundo = mix(inputColor.rgb, vec3(0.0024, 0.0012, 0.009), tinta * 0.92);
      vec3 plano = mix(mundo, uFondo * (1.0 - sombra), punto);
      salida = mix(plano, inputColor.rgb, skulley);
    }
    if (uConParticulas > 0.5) {
      vec4 p = texture2D(uParticulas, uv);
      salida = mix(salida, p.rgb, p.a);
    }
    outputColor = vec4(salida, inputColor.a);
  }
`

export function useTrama() {
  const uniformes = useMemo(() => ({
    uMascara: new THREE.Uniform(null),
    uRunas: new THREE.Uniform(null),
    uCapa: new THREE.Uniform(null),
    uParticulas: new THREE.Uniform(null),
    uConParticulas: new THREE.Uniform(0),
    uCorte: new THREE.Uniform(0),
    uSombra: new THREE.Uniform(1),
    uRunasTinta: new THREE.Uniform(0),
    uCapaCaja: new THREE.Uniform(new THREE.Vector4(0, 0, 1, 1)),
    uConCapa: new THREE.Uniform(0),
    uPies: new THREE.Uniform(new THREE.Vector2(0.5, 0.2)),
    uResolucion: new THREE.Uniform(new THREE.Vector2(1, 1)),
    uFondo: new THREE.Uniform(new THREE.Color('#022dd6')),
    uOnda: new THREE.Uniform(0),
    uAplana: new THREE.Uniform(1),
    uPaso: new THREE.Uniform(16),
    uSolo: new THREE.Uniform(0),
  }), [])

  const efecto = useMemo(
    () => new Effect('TramaEffect', FRAGMENTO, { blendFunction: BlendFunction.NORMAL, uniforms: new Map(Object.entries(uniformes)) }),
    [uniformes],
  )
  const capa = useRef(null)
  const capaVista = useRef(-1)
  useEffect(() => () => { try { efecto.dispose?.(); capa.current?.dispose() } catch { } }, [efecto])

  // Después de WallpaperEscena (0.4), que decide si este cuadro es la captura, y
  // antes del composer.
  useFrame(({ size }) => {
    const e = wallpaperEstado
    if (e.capaLienzo && !capa.current) {
      const c = new THREE.CanvasTexture(e.capaLienzo)
      c.colorSpace = THREE.SRGBColorSpace
      c.minFilter = THREE.LinearMipmapLinearFilter
      capa.current = c
    }
    if (capa.current && capaVista.current !== e.capaVersion) {
      capaVista.current = e.capaVersion
      capa.current.needsUpdate = true
    }
    const m = e.marco
    uniformes.uCapa.value = capa.current
    uniformes.uConCapa.value = e.enMarco && e.capaHay && capa.current && m ? 1 : 0
    // En la captura la vista ya es el marco.
    if (e.captura?.fase === 'render') uniformes.uCapaCaja.value.set(0, 0, 1, 1)
    else if (m) uniformes.uCapaCaja.value.set(m.x / size.width, 1 - (m.y + m.h) / size.height, m.w / size.width, m.h / size.height)
    // La onda acelera, y tiene que llegar a la esquina más lejana con todo y su
    // banda. Ya cubierto, los pies dejan de importar: con zoom caen fuera de la
    // pantalla y la onda no alcanzaría.
    const t = e.onda
    const llega = 1.95 * Math.sqrt(size.width / size.height / 1.78)
    uniformes.uOnda.value = e.fase === 'off' || t <= 0 ? 0 : e.fase === 'lista' || e.cubre ? 100 : llega * Math.pow(t, 1.5)
    uniformes.uSolo.value = e.fase === 'lista' ? 1 : 0
    // Nace acostada y se va levantando.
    uniformes.uAplana.value = 2.7 - 1.35 * Math.min(1, t * 2)
    uniformes.uPies.value.set(e.pies[0], e.pies[1])
    uniformes.uResolucion.value.set(size.width, size.height)
    uniformes.uPaso.value = size.height / 56
    uniformes.uFondo.value.set(e.color)
    const f = uniformes.uFondo.value
    uniformes.uRunasTinta.value = e.viaje && 0.2126 * f.r + 0.7152 * f.g + 0.0722 * f.b > 0.6 ? 1 : 0
    uniformes.uMascara.value = e.mascara
    uniformes.uRunas.value = e.runas
    uniformes.uParticulas.value = e.particulas
    uniformes.uConParticulas.value = e.particulas ? 1 : 0
    uniformes.uCorte.value = e.corte
    uniformes.uSombra.value = e.sombraViva
  }, 0.9)

  return efecto
}
