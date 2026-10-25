import React, { useEffect, useRef } from 'react'
import { registerIrisLayer } from '../lib/irisTransition.js'

// La capa del iris de caricatura (motor en src/lib/irisTransition.js). Se
// monta una sola vez en App.jsx, arriba de todo, para que siga cubriendo
// mientras la escena de abajo cambia.
export default function IrisOverlay() {
  const layerRef = useRef(null)
  useEffect(() => {
    registerIrisLayer(layerRef.current)
    return () => registerIrisLayer(null)
  }, [])
  return (
    <div ref={layerRef} className="iris-layer" data-mode="off" aria-hidden>
      <img
        className="iris-loader"
        src={`${import.meta.env.BASE_URL}preloader.gif`}
        alt=""
        draggable={false}
      />
    </div>
  )
}
