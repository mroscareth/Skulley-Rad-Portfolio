import React, { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { hasSlug, SLIME_SLUGS_EVENT } from '../lib/slimeSlugs.js'
import { SlimeMesh } from './SlimeSlug3D.jsx'

// Babosa de slime para contextos DOM (tarjeta de WORK, reproductor, códice
// SKULLEYGLYPH). Es un MODELO 3D real montado en un mini-canvas transparente
// (mismo SlimeMesh que las de escena). Pequeña → reto oculto. Al recogerla el
// canvas se desmonta (libera el contexto WebGL).
//
//   id        — uno de SLUG_IDS
//   size      — px (default 24)
//   className — posicionamiento (ej. 'absolute')
//   style     — estilos inline extra (gana sobre el stylesheet, ej. position)
export default function SlimeSlugDOM({ id, size = 24, className = '', style }) {
  const [gone, setGone] = useState(() => hasSlug(id))

  useEffect(() => {
    const on = () => { if (hasSlug(id)) setGone(true) }
    window.addEventListener(SLIME_SLUGS_EVENT, on)
    return () => window.removeEventListener(SLIME_SLUGS_EVENT, on)
  }, [id])

  if (gone) return null

  return (
    <div
      className={`slime-slug-3d ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, ...(style || {}) }}
      // Que el click/drag no se propague al contenedor (tarjeta, disco, etc.).
      onPointerDown={(e) => { try { e.stopPropagation() } catch { } }}
      onClick={(e) => { try { e.stopPropagation() } catch { } }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        camera={{ position: [0, 0.05, 3.3], fov: 46 }}
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%', background: 'transparent', cursor: 'pointer' }}
      >
        <ambientLight intensity={0.95} />
        <directionalLight position={[2, 3, 4]} intensity={1.15} />
        <directionalLight position={[-2, 1, 2]} intensity={0.4} />
        <SlimeMesh id={id} baseScale={1.0} hopScale={0.4} onGone={() => setGone(true)} />
      </Canvas>
    </div>
  )
}
