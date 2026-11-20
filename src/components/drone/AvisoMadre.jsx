import React, { useRef } from 'react'
import RenglonRunas from './RenglonRunas.jsx'
import { useGlitchSolo, textoGlitch } from '../../hooks/useGlitchRunas.js'

// Los avisos de M.A.D.R.E. en el juego de esferas (las trampas, App.jsx), con
// la cara de su diálogo (Oscar, 2026-11-19: "como si fueran diálogos de
// M.A.D.R.E."; antes eran una tarjeta oscura con un triángulo de alerta): el
// globo blanco con tinta, su etiqueta que se glitchea a runas y el texto
// revelándose desde SKULLEYGLYPH con su bip. Sin barras ni menú y sin tomar el
// puntero: la partida sigue. App lo deja montado y lo prende con `visible`, así
// entra y sale con la misma animación del globo del diálogo. `enojo`: el aviso
// del castigo, en rojo.

const FIRMA_GLITCH = { primeraMs: 900, cadaMs: 3600, sostieneMs: 1100 }

export default function AvisoMadre({ visible = false, texto = '', enojo = false, id = 0 }) {
  const nombreRef = useRef(null)
  const firma = useGlitchSolo(nombreRef, FIRMA_GLITCH)
  return (
    <div className={`aviso-madre${visible ? ' is-on' : ''}`} role="alert" aria-live="assertive">
      <div className={`dlg-globo${enojo ? ' is-enojo' : ''}`}>
        <span ref={nombreRef} className={`dlg-nombre${firma?.letras ? ' display-title--runas' : ''}${firma?.tiembla ? ' glitch-runas' : ''}`}>
          {textoGlitch('M.A.D.R.E.', firma)}
        </span>
        {texto && <RenglonRunas key={id} texto={texto} />}
      </div>
    </div>
  )
}
