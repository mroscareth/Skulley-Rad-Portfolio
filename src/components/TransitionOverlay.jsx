import React, { useEffect, useRef } from 'react'
import { shaderMaterial } from '@react-three/drei'
import { extend, useThree } from '@react-three/fiber'
import { Color } from 'three'
import { gsap } from 'gsap'

/*
 * TransitionOverlay
 *
 * Renders a full‑screen quad with a custom shader that crossfades between
 * two colours.  When the `active` prop becomes true, GSAP animates the
 * `uProgress` uniform from 0 to 1 over the specified duration.  Once
 * complete, the onComplete callback is invoked.  The overlay is always
 * present in the scene but fully transparent when not transitioning.
 */

// Ripple dissolve material: genera ondas concéntricas y una máscara circular que crece
const TransitionMaterial = shaderMaterial(
  {
    uFrom: new Color(),
    uTo: new Color(),
    uProgress: 0,
    uOpacity: 1,
    uCenter: [0.5, 0.5],
    uFreq: 24.0,
    uWidth: 0.035,
  },
  // Vertex shader: pass the UV coordinates to the fragment shader and
  // position the plane in clip space.  We scale by 2 because the plane
  // geometry uses UV range [0,1], while clip space expects [-1,1].
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  // Fragment shader: máscara circular con ondas, la zona interior se hace transparente
  `
    uniform vec3 uFrom;
    uniform vec3 uTo;
    uniform float uProgress;
    uniform float uOpacity;
    uniform vec2 uCenter;
    uniform float uFreq;
    uniform float uWidth;
    varying vec2 vUv;
    void main() {
      float t = clamp(uProgress, 0.0, 1.0);
      float r = distance(vUv, uCenter);
      // Cobertura fuera del círculo, gated por t para que no sea visible con t=0
      float cover = smoothstep(t, t + uWidth, r);
      // Banda de onda alrededor del frente (visible y “acuosa”)
      float band = 1.0 - smoothstep(0.0, uWidth, abs(r - t));
      float ripple = 0.5 + 0.5 * sin((r - t) * uFreq);
      // Onda más visible
      float ringAlpha = band * (0.45 + 0.45 * ripple);
      // Gate suave de la onda para que aparezca pronto aun con t pequeño
      float ringGate = smoothstep(0.02, 0.28, t);
      // Alpha final: cobertura + onda (la cobertura sí escala con t)
      float alpha = cover * uOpacity * t + ringAlpha * ringGate * uOpacity;
      // Color ligeramente aclarado para que se lea sobre fondos oscuros
      vec3 col = mix(uFrom, uTo, 0.5) + vec3(0.12);
      gl_FragColor = vec4(col, alpha);
    }
  `,
)

// Register the material so it can be used as a JSX element (<transitionMaterial />)
extend({ TransitionMaterial })

export default function TransitionOverlay({
  active,
  fromColor,
  toColor,
  duration = 1,
  onComplete,
  onMid,
  forceOnceKey,
  maxOpacity = 1,
  center = [0.5, 0.5],
  freq = 24.0,
  width = 0.035,
}) {
  const materialRef = useRef()
  const tweenRef = useRef(null)
  const midFiredRef = useRef(false)
  // Prewarm GSAP timeline engine una vez al montar (sin efectos visuales)
  useEffect(() => {
    let t = null
    try {
      const dummy = { v: 0 }
      t = gsap.fromTo(dummy, { v: 0 }, { v: 1, duration: 0.01 })
    } catch {}
    return () => { if (t) t.kill() }
  }, [])

  // When activation state changes, trigger the GSAP animation
  useEffect(() => {
    if (!materialRef.current) return
    // kill tween anterior si existe
    if (tweenRef.current) {
      tweenRef.current.kill()
      tweenRef.current = null
    }
    if (!active) {
      // asegurar transparencia cuando no está activo
      materialRef.current.uniforms.uProgress.value = 0
      midFiredRef.current = false
      return
    }
    // Set shader colours
    materialRef.current.uniforms.uFrom.value = new Color(fromColor)
    materialRef.current.uniforms.uTo.value = new Color(toColor)
    materialRef.current.uniforms.uOpacity.value = maxOpacity
    materialRef.current.uniforms.uCenter.value = center
    materialRef.current.uniforms.uFreq.value = freq
    materialRef.current.uniforms.uWidth.value = width
    // Animate uProgress from 0 to 1
    tweenRef.current = gsap.fromTo(
      materialRef.current.uniforms.uProgress,
      { value: 0 },
      {
        value: 1,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => {
          try {
            const v = materialRef.current.uniforms.uProgress.value
            if (!midFiredRef.current && v >= 0.5) {
              midFiredRef.current = true
              if (typeof onMid === 'function') onMid()
            }
          } catch {}
        },
        onComplete: () => {
          // Ocultar overlay al finalizar para no oscurecer la escena
          if (materialRef.current) materialRef.current.uniforms.uProgress.value = 0
          midFiredRef.current = false
          if (typeof onComplete === 'function') onComplete()
        },
      },
    )
  }, [active, fromColor, toColor, duration, onComplete, onMid, maxOpacity, center, freq, width])

  return (
    <mesh key={forceOnceKey} renderOrder={1000} frustumCulled={false} position={[0, 0, 0]}>
      <planeGeometry args={[2, 2]} />
      <transitionMaterial ref={materialRef} transparent />
    </mesh>
  )
}