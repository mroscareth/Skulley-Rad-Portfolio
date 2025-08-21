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

// Define a simple shader material that mixes two colours based on a progress uniform.
const TransitionMaterial = shaderMaterial(
  {
    uFrom: new Color(),
    uTo: new Color(),
    uProgress: 0,
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
  // Fragment shader: smoothly interpolate between two colours as
  // uProgress goes from 0 to 1.  Use smoothstep to ease the transition.
  `
    uniform vec3 uFrom;
    uniform vec3 uTo;
    uniform float uProgress;
    varying vec2 vUv;
    void main() {
      float t = smoothstep(0.0, 1.0, uProgress);
      vec3 color = mix(uFrom, uTo, t);
      gl_FragColor = vec4(color, t);
    }
  `,
)

// Register the material so it can be used as a JSX element (<transitionMaterial />)
extend({ TransitionMaterial })

export default function TransitionOverlay({ active, fromColor, toColor, duration = 1, onComplete }) {
  const materialRef = useRef()
  const tweenRef = useRef(null)
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
      return
    }
    // Set shader colours
    materialRef.current.uniforms.uFrom.value = new Color(fromColor)
    materialRef.current.uniforms.uTo.value = new Color(toColor)
    // Animate uProgress from 0 to 1
    tweenRef.current = gsap.fromTo(
      materialRef.current.uniforms.uProgress,
      { value: 0 },
      {
        value: 1,
        duration,
        ease: 'power2.inOut',
        onComplete: () => {
          // Ocultar overlay al finalizar para no oscurecer la escena
          if (materialRef.current) materialRef.current.uniforms.uProgress.value = 0
          if (typeof onComplete === 'function') onComplete()
        },
      },
    )
  }, [active, fromColor, toColor, duration, onComplete])

  return (
    <mesh renderOrder={1000} frustumCulled={false} position={[0, 0, 0]}>
      <planeGeometry args={[2, 2]} />
      <transitionMaterial ref={materialRef} transparent />
    </mesh>
  )
}