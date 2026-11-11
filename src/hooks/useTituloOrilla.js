import { useEffect, useState } from 'react'
import { whenRuneFontsReady } from '../lib/runeReveal.js'

// Títulos de orilla a orilla (Oscar: "grande", "block size" o "brutalista" es un
// título enorme que llena su contenedor de lado a lado, y su bloque es solo para
// él). Mide la tinta del texto en las dos fuentes del glitch de runas y devuelve
// las variables de .titulo-orilla, en unidades del contenedor (cqi):
//   - llena el ancho en runas y en Luckiest Guy, y sigue al contenedor;
//   - la caja mide lo que la tinta de las runas, no lo que su línea, así que el
//     aire que le pongas arriba y abajo se ve igual (las runas traen remates que
//     suben y gotas que bajan);
//   - en Luckiest Guy la caja no cambia de alto y la tinta va centrada en ella.
// El que lo usa pone `@container` en el padre.
const FUENTES = { runas: "'Skulley Glyph Variable Bold'", letras: "'Luckiest Guy'" }

function medir(c, familia, t) {
  c.font = `100px ${familia}`
  const m = c.measureText(t)
  const ancho = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || m.width || 1
  const sube = m.actualBoundingBoxAscent
  const baja = m.actualBoundingBoxDescent
  const fSube = m.fontBoundingBoxAscent ?? sube
  const fBaja = m.fontBoundingBoxDescent ?? baja
  // Con line-height: 1 el navegador centra la caja de la fuente en la línea:
  // ahí queda la base, y de ella sale la tinta.
  const base = (100 + fSube - fBaja) / 2
  const k = 100 / ancho // px a 100px → cqi
  return { k, ancho, izq: m.actualBoundingBoxLeft, arriba: (base - sube) * k, alto: (sube + baja) * k }
}

export function useTituloOrilla(texto) {
  const [vars, setVars] = useState(null)
  useEffect(() => {
    let vivo = true
    const t = String(texto || '').toUpperCase()
    const f = document.fonts
    Promise.all([whenRuneFontsReady(), f?.load(`100px ${FUENTES.letras}`, t)])
      .catch(() => {})
      .then(() => {
        if (!vivo) return
        const c = document.createElement('canvas').getContext('2d')
        const r = medir(c, FUENTES.runas, t)
        const l = medir(c, FUENTES.letras, t)
        const cqi = (n) => `${n.toFixed(3)}cqi`
        setVars({
          '--orilla-alto': cqi(r.alto),
          '--orilla-runas': cqi(100 * r.k),
          '--orilla-runas-sangria': cqi(r.izq * r.k),
          '--orilla-runas-sube': cqi(-r.arriba),
          '--orilla-letras': cqi(100 * l.k),
          '--orilla-letras-sangria': cqi(l.izq * l.k),
          '--orilla-letras-sube': cqi(-l.arriba + (r.alto - l.alto) / 2),
        })
      })
    return () => { vivo = false }
  }, [texto])
  return vars
}
