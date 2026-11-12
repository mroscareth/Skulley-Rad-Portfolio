import React, { useEffect } from 'react'
import { useGlitchRunas, textoGlitch } from '../hooks/useGlitchRunas.js'
import { SUB_RUNAS_MS } from '../lib/historiaMadre.js'

// Un subtítulo de "Conocer la historia": llega en SKULLEYGLYPH y se glitchea
// a letras (el glitch de los títulos, solo de ida). `enojo`: la frase del
// rayo, en rojo.
export default function SubtituloMadre({ texto, sale, enojo = false }) {
  const { fase, disparar } = useGlitchRunas(true, { sonido: false, sostieneMs: 864e5 })
  useEffect(() => {
    const id = window.setTimeout(disparar, SUB_RUNAS_MS)
    return () => window.clearTimeout(id)
  }, [disparar])
  return (
    <p className={`dsp-subtitulo${fase?.letras ? '' : ' dsp-subtitulo--runas'}${fase?.tiembla ? ' glitch-runas' : ''}${sale ? ' is-sale' : ''}${enojo ? ' dsp-subtitulo--enojo' : ''}`}>
      {textoGlitch(texto, fase)}
    </p>
  )
}
