import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Effect, BlendFunction } from 'postprocessing'
import { wallpaperEstado } from '../../lib/wallpaperEscritorio.js'

// Vidrio en la orilla de la pantalla (pedido de Oscar, 2026-11-19): el home se ve a
// través de una lámina de vidrio con el canto redondeado. En una franja junto a la
// orilla el mundo se dobla (se ve lo de más adentro, estirado hacia el canto), los
// colores se separan apenas y un filo de luz recorre el canto, fuerte del lado de la
// luz y tenue del contrario.
//
// Lee la imagen en pixeles vecinos, y aun así va sin EffectAttribute.CONVOLUTION: con
// él, el EffectComposer de R3F le daba su propio pase (0.58 ms de GPU en la Iris Xe a
// 1800 × 1125, casi todo por leer y escribir la pantalla entera). Sin él se junta con
// Glitch y Trama, y funciona porque va PRIMERO en ese pase, justo después de
// ChromaticAberration (que sí es convolución y cierra el pase anterior): lo que lee de
// inputBuffer es la imagen ya terminada. Si algo se mete entre los dos, deja de ser
// cierto. Se monta siempre y se apaga con uFuerza: meter o sacar un efecto recompila
// la cadena (nota de Glitch en PostFX).
// En Customize y yendo a una sección se va, porque la trama tiene que dejar el color
// exacto del fondo (el del preloader que releva), y nunca sale en la captura del
// wallpaper.
const FRAGMENTO = /* glsl */`
  uniform float uFuerza;
  uniform float uBanda;
  uniform float uRefraccion;
  uniform float uDispersion;
  uniform float uBrillo;
  uniform float uSombra;
  uniform vec2 uLuz;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uFuerza <= 0.0) {
      outputColor = inputColor;
      return;
    }
    vec2 mitad = 0.5 * resolution;
    vec2 p = uv * resolution - mitad;
    float banda = uBanda * min(resolution.x, resolution.y);
    // Esquinas con radio mayor que la franja: así la normal nunca cambia de golpe
    // dentro de ella (el cambio de lado cae en el interior, donde ya no hay vidrio).
    float radio = 1.6 * banda;
    vec2 q = abs(p) - (mitad - radio);
    float adentro = radio - length(max(q, 0.0)) - min(max(q.x, q.y), 0.0);
    if (adentro >= banda) {
      outputColor = inputColor;
      return;
    }
    float t = clamp(1.0 - adentro / banda, 0.0, 1.0);
    vec2 s = sign(p);
    vec2 n = (q.x > 0.0 && q.y > 0.0) ? normalize(q) * s
      : (q.x > q.y ? vec2(s.x, 0.0) : vec2(0.0, s.y));

    // Se ve lo de más adentro: con uRefraccion * 2.2 < 1 el mapeo nunca se dobla
    // sobre sí mismo (en el canto queda estirado, sin espejo).
    float o = banda * uRefraccion * uFuerza * pow(t, 2.2);
    vec2 d = -n * o * texelSize;
    vec4 c = texture2D(inputBuffer, uv + d);
    vec3 col = vec3(
      texture2D(inputBuffer, uv + d * (1.0 + uDispersion)).r,
      c.g,
      texture2D(inputBuffer, uv + d * (1.0 - uDispersion)).b
    );

    // Un anillo apenas más oscuro a media franja, como el grueso del vidrio.
    col *= 1.0 - uSombra * uFuerza * smoothstep(0.25, 0.55, t) * (1.0 - smoothstep(0.55, 0.85, t));

    float l = dot(n, uLuz);
    float frente = pow(max(l, 0.0), 1.5);
    float atras = pow(max(-l, 0.0), 1.5);
    float ancho = max(1.0, banda * 0.028);
    float filo = exp(-pow((adentro - ancho) / ancho, 2.0));
    float halo = pow(t, 5.0);
    col += (filo * (0.55 * frente + 0.18 * atras) + halo * (0.05 + 0.07 * frente)) * uBrillo * uFuerza;

    outputColor = vec4(col, c.a);
  }
`

// En desarrollo se ajusta en vivo con window.__vidrio.
export const VIDRIO = {
  banda: 0.042,
  refraccion: 0.32,
  dispersion: 0.14,
  brillo: 0.5,
  sombra: 0.05,
  // Luz arriba a la izquierda (y hacia arriba, como el uv).
  luz: [-0.55, 0.83],
  // Qué tan rápido entra y se va (1/s).
  ritmo: 5,
}

export function useVidrioOrilla() {
  const uniformes = useMemo(() => ({
    uFuerza: new THREE.Uniform(0),
    uBanda: new THREE.Uniform(VIDRIO.banda),
    uRefraccion: new THREE.Uniform(VIDRIO.refraccion),
    uDispersion: new THREE.Uniform(VIDRIO.dispersion),
    uBrillo: new THREE.Uniform(VIDRIO.brillo),
    uSombra: new THREE.Uniform(VIDRIO.sombra),
    uLuz: new THREE.Uniform(new THREE.Vector2(...VIDRIO.luz).normalize()),
  }), [])

  const efecto = useMemo(
    () => new Effect('VidrioOrilla', FRAGMENTO, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map(Object.entries(uniformes)),
    }),
    [uniformes],
  )
  useEffect(() => () => { try { efecto.dispose?.() } catch { } }, [efecto])
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__vidrio = VIDRIO
    return () => { if (window.__vidrio === VIDRIO) delete window.__vidrio }
  }, [])

  const fuerza = useRef(0)
  // Después de WallpaperEscena (0.4), que decide si este cuadro es la captura, y
  // antes del composer.
  useFrame((_, dt) => {
    const e = wallpaperEstado
    const quiere = e.fase === 'off' && !e.viaje ? 1 : 0
    // Yendo a una sección se va antes de que la trama llegue a la orilla.
    const ritmo = e.viaje ? VIDRIO.ritmo * 2.5 : VIDRIO.ritmo
    fuerza.current += (quiere - fuerza.current) * (1 - Math.exp(-Math.min(dt, 0.1) * ritmo))
    if (Math.abs(quiere - fuerza.current) < 0.002) fuerza.current = quiere
    uniformes.uFuerza.value = e.captura?.fase === 'render' ? 0 : fuerza.current
    uniformes.uBanda.value = VIDRIO.banda
    uniformes.uRefraccion.value = VIDRIO.refraccion
    uniformes.uDispersion.value = VIDRIO.dispersion
    uniformes.uBrillo.value = VIDRIO.brillo
    uniformes.uSombra.value = VIDRIO.sombra
    uniformes.uLuz.value.set(VIDRIO.luz[0], VIDRIO.luz[1]).normalize()
  }, 0.9)

  return efecto
}
