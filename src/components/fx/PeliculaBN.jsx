import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Effect, BlendFunction } from 'postprocessing'

// "Conocer la historia" en blanco y negro de película vieja (Oscar, inspirado
// en Akira Kurosawa: la cuenta M.A.D.R.E. y se tiene que ver retro). Grises con
// mucho contraste y negros profundos, grano que cambia cada cuadro de
// película, un parpadeo leve de proyector y las orillas más oscuras. La mezcla
// sale de `escenaRef.current.bn` (0 a 1), que la historia anima junto con las
// luces; en 0 el efecto no hace nada. Va en el composer desde que se monta,
// así su shader se compila al cargar y no al empezar la historia. El grano y
// el parpadeo se detienen con la historia en pausa, como un cuadro congelado.
// `filtro`: cuánto pesa cada canal al pasar a gris. Como el filtro rojo de la
// fotografía en blanco y negro: Skulley es rojo, y con los pesos de siempre
// quedaba casi negro. `blancos`: hasta dónde llega el blanco (más bajo, más
// brilla lo iluminado).
const BN = { filtro: [0.62, 0.3, 0.08], contraste: 0.85, blancos: 0.72, grano: 0.08, parpadeo: 0.025, orillas: 0.9, cuadrosPorSegundo: 24 }

export default function PeliculaBN({ escenaRef }) {
  const efecto = useMemo(() => new Effect('PeliculaBN', /* glsl */`
    uniform float uMezcla;
    uniform float uTiempo;
    float azarBN(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outColor) {
      if (uMezcla <= 0.0) { outColor = inputColor; return; }
      vec3 c = inputColor.rgb;
      float y = dot(c, vec3(${BN.filtro.map((v) => v.toFixed(3)).join(', ')}));
      // Curva de contraste: negros que se hunden y blancos que revientan.
      float curva = mix(y, smoothstep(0.03, ${BN.blancos.toFixed(3)}, y), ${BN.contraste.toFixed(3)});
      // El grano cambia ${BN.cuadrosPorSegundo} veces por segundo, como la película.
      float cuadro = floor(uTiempo * ${BN.cuadrosPorSegundo.toFixed(1)});
      float grano = azarBN(floor(uv * resolution) + cuadro * 17.0) - 0.5;
      curva += grano * ${BN.grano.toFixed(3)};
      curva *= 1.0 + ${BN.parpadeo.toFixed(3)} * sin(uTiempo * 13.0) * sin(uTiempo * 7.3);
      vec2 d = uv - 0.5;
      curva *= 1.0 - dot(d, d) * ${BN.orillas.toFixed(3)};
      vec3 bn = vec3(max(curva, 0.0));
      outColor = vec4(mix(c, bn, uMezcla), inputColor.a);
    }
  `, {
    blendFunction: BlendFunction.NORMAL,
    uniforms: new Map([
      ['uMezcla', new THREE.Uniform(0)],
      ['uTiempo', new THREE.Uniform(0)],
    ]),
  }), [])

  useFrame((_, delta) => {
    const e = escenaRef?.current
    const mezcla = Math.max(0, Math.min(1, e?.bn ?? 0))
    efecto.uniforms.get('uMezcla').value = mezcla
    if (mezcla > 0 && e?.pausa == null) efecto.uniforms.get('uTiempo').value += Math.min(0.05, delta || 0)
  })

  return <primitive object={efecto} />
}
