import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { ponerZonaOfrenda, salirDeZonaOfrenda } from '../../lib/zonaOfrenda.js'

// Le avisa a la canción de la ofrenda (lib/cancionOfrenda.js) dónde va
// Skulley respecto al portal de SKULLEYGLYPH. Fuera del home no cuenta: ahí
// regresa la música del reproductor.
export default function ZonaOfrenda({ playerRef, activa }) {
  useEffect(() => {
    if (!activa) salirDeZonaOfrenda()
  }, [activa])
  useEffect(() => () => salirDeZonaOfrenda(), [])
  useFrame(() => {
    if (!activa) return
    const p = playerRef?.current?.position
    if (p) ponerZonaOfrenda(p.x, p.z, true)
  })
  return null
}
