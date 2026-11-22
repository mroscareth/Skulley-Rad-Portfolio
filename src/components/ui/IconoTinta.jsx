import React, { memo, useMemo } from 'react'
import { svgTinta } from '../../lib/iconosTinta.js'

// Un ícono de tinta (lib/iconosTinta.js). El SVG se arma una vez por nombre,
// tamaño y color de cara; `tam` es el lado en px de la caja, que incluye el
// costado y su aire, así que la figura se ve un poco más chica que la caja.
function IconoTinta({ nombre, tam = 32, cara, giro, className = '', style }) {
  const html = useMemo(() => svgTinta(nombre, tam, { cara, giro }), [nombre, tam, cara, giro])
  return (
    <span
      className={`icono-tinta ${className}`}
      style={style ? { ...style, width: tam, height: tam } : { width: tam, height: tam }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default memo(IconoTinta)
