import React, { useId, useRef } from 'react'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { useGlitchSolo, textoGlitch } from '../../hooks/useGlitchRunas.js'

// El loading del sitio (Oscar): la mascota animada al centro y la palabra
// LOADING / CARGANDO escrita en SKULLEYGLYPH en un anillo alrededor, que gira
// despacio y cada tanto se glitchea a Luckiest Guy y regresa (el glitch solo de
// la firma de M.A.D.R.E., useGlitchSolo). El texto va sobre un círculo de SVG
// con textLength: llena el anillo justo en cualquiera de las dos fuentes.
// Lo usan el preloader de sección y el iris cuando espera.
const RADIO = 104
const CAJA = 260
// Dos veces la palabra: con las runas grandes (Oscar) es lo que cabe en la vuelta.
const REPETICIONES = { es: 2, en: 2 }
const GLITCH = { primeraMs: 700, cadaMs: 2400, sostieneMs: 650 }

export default function CargandoAnillo({ color = '#ffffff', tam = 260, className = '' }) {
  const { lang } = useLanguage()
  const id = useId().replace(/:/g, '')
  const svgRef = useRef(null)
  const fase = useGlitchSolo(svgRef, GLITCH)
  const palabra = lang === 'es' ? 'CARGANDO' : 'LOADING'
  const texto = Array.from({ length: REPETICIONES[lang] || 3 }, () => `${palabra} · `).join('')
  const c = CAJA / 2
  return (
    <div className={`cargando-anillo ${className}`} style={{ '--tam': `${tam}px`, color }} aria-hidden="true">
      <svg ref={svgRef} className="cargando-anillo-texto" viewBox={`0 0 ${CAJA} ${CAJA}`}>
        <defs>
          <path id={`anillo-${id}`} d={`M${c},${c} m-${RADIO},0 a${RADIO},${RADIO} 0 1,1 ${RADIO * 2},0 a${RADIO},${RADIO} 0 1,1 -${RADIO * 2},0`} />
        </defs>
        <text className={`${fase?.letras ? 'cargando-letras' : 'cargando-runas'}${fase?.tiembla ? ' glitch-runas' : ''}`} fill="currentColor">
          <textPath href={`#anillo-${id}`} textLength={Math.round(2 * Math.PI * RADIO) - 6} lengthAdjust="spacing">
            {textoGlitch(texto, fase)}
          </textPath>
        </text>
      </svg>
      <img className="cargando-anillo-gif" src={`${import.meta.env.BASE_URL}preloader.gif`} alt="" draggable={false} />
    </div>
  )
}
