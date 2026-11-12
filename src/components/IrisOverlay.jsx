import React, { useEffect, useRef } from 'react'
import { registerIrisLayer } from '../lib/irisTransition.js'
import CargandoAnillo from './ui/CargandoAnillo.jsx'

// La capa del iris de caricatura (motor en src/lib/irisTransition.js). Se
// monta una sola vez en App.jsx, arriba de todo, para que siga cubriendo
// mientras la escena de abajo cambia. Cuando espera (irisWaiting) enseña el
// loading del sitio (CargandoAnillo), el mismo del preloader de sección.
export default function IrisOverlay() {
  const layerRef = useRef(null)
  useEffect(() => {
    registerIrisLayer(layerRef.current)
    return () => registerIrisLayer(null)
  }, [])
  return (
    <div ref={layerRef} className="iris-layer" data-mode="off" aria-hidden>
      <div className="iris-loader">
        <CargandoAnillo tam={300} />
      </div>
    </div>
  )
}
