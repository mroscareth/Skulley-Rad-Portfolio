import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { dialogoMadre } from '../../lib/dialogoMadre.js'
import { avisarDron } from '../../lib/droneNpc.js'
import { blipMadre } from '../../lib/blipMadre.js'
import { useGlitchSolo, textoGlitch } from '../../hooks/useGlitchRunas.js'
import RenglonRunas from './RenglonRunas.jsx'

// El diálogo con el drone de M.A.D.R.E. (Oscar, 2026-11-19: "cinemáticos, muy de
// videojuego"). La UI del sitio se va (App), entran las barras de cine y abajo
// un globo con la tinta de las viñetas del sitio. Cada renglón llega en
// SKULLEYGLYPH y se revela letra por letra como el título del preloader y el
// About (lib/runeReveal.js; Oscar: "el efecto de revelado de las runas"), con
// su bip por letra; se pasa con clic, Espacio o Enter (a medio revelado, lo
// completa). Luego un menú de preguntas (flechas + Enter, o el mouse). Escape
// sale en cualquier momento. Cada renglón le pide al drone su cara y su acción
// (avisarDron); la cámara sobre el hombro de Skulley la pone App/CameraController.

const ENTRADA_MS = 750
const SALIDA_MS = 650
const VISTO = 'skulley_madre_hablo'
const FIRMA_GLITCH = { primeraMs: 1400, cadaMs: 4200, sostieneMs: 1300 }

const quietoPreferido = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export default function DialogoMadre({ onClose }) {
  const { lang } = useLanguage()
  const D = dialogoMadre(lang)
  const [fase, setFase] = useState('entra')      // entra | texto | menu | sale
  const [cola, setCola] = useState(null)         // { lineas, i, despues: 'menu' | 'salir', n }
  const [completo, setCompleto] = useState(false)
  const [sel, setSel] = useState(0)
  const [vistos, setVistos] = useState(() => new Set())
  const nombreRef = useRef(null)
  const firma = useGlitchSolo(nombreRef, FIRMA_GLITCH)
  const renglonesRef = useRef(0)

  const linea = cola ? cola.lineas[cola.i] : null
  const opciones = [...D.temas, { id: 'adios', ...D.adios }]

  const empezar = useCallback((lineas, despues) => {
    renglonesRef.current += 1
    setCola({ lineas, i: 0, despues, n: renglonesRef.current })
    setCompleto(false)
    setFase('texto')
  }, [])

  const cerrar = useCallback(() => {
    setFase((f) => {
      if (f === 'sale') return f
      avisarDron({ fin: true })
      setTimeout(() => onClose?.(), SALIDA_MS)
      return 'sale'
    })
  }, [onClose])

  // entrada: las barras y el globo; luego el saludo
  useEffect(() => {
    let primera = true
    try { primera = !sessionStorage.getItem(VISTO); sessionStorage.setItem(VISTO, '1') } catch { }
    const id = setTimeout(() => empezar(primera ? D.saludo : D.otraVez, 'menu'), ENTRADA_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // cada renglón le pide al drone su cara y su acción
  useEffect(() => {
    if (!linea) return
    avisarDron({ cara: linea.cara, accion: linea.accion, voltear: linea.voltear })
  }, [linea])

  const avanzar = useCallback(() => {
    if (fase !== 'texto' || !linea) return
    if (!completo) { setCompleto(true); return }
    if (cola.i + 1 < cola.lineas.length) {
      renglonesRef.current += 1
      setCola({ ...cola, i: cola.i + 1, n: renglonesRef.current })
      setCompleto(false)
      return
    }
    if (cola.despues === 'salir') { cerrar(); return }
    avisarDron({ cara: 'normal' })
    setFase('menu')
  }, [fase, linea, completo, cola, cerrar])

  const elegir = useCallback((i) => {
    const o = opciones[i]
    if (!o) return
    try { blipMadre(1.4) } catch { }
    if (o.id === 'adios') { empezar(o.lineas, 'salir'); return }
    setVistos((v) => new Set(v).add(o.id))
    setSel(i)
    empezar(o.lineas, 'menu')
  }, [opciones, empezar])

  // teclado: va en captura y no deja pasar nada al juego mientras dura
  useEffect(() => {
    const tecla = (e) => {
      const k = e.key
      if (!['Escape', ' ', 'Enter', 'ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(k)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (k === 'Escape') { cerrar(); return }
      if (fase === 'texto' && (k === ' ' || k === 'Enter')) { avanzar(); return }
      if (fase === 'menu') {
        if (k === 'ArrowUp' || k === 'w' || k === 'W') setSel((s) => (s + opciones.length - 1) % opciones.length)
        else if (k === 'ArrowDown' || k === 's' || k === 'S') setSel((s) => (s + 1) % opciones.length)
        else if (k === ' ' || k === 'Enter') elegir(sel)
      }
    }
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [fase, avanzar, elegir, sel, opciones.length, cerrar])

  const enojo = linea?.cara === 'enojada' && fase === 'texto'
  const clase = `dlg-raiz is-${fase}${quietoPreferido() ? ' is-quieto' : ''}`

  return (
    <div className={clase} role="dialog" aria-modal="true" aria-label={D.nombre} onClick={() => { if (fase === 'texto') avanzar() }}>
      <div className="dlg-barra dlg-barra--arriba">
        <button type="button" className="dlg-salir" onClick={(e) => { e.stopPropagation(); cerrar() }}>
          <span className="dlg-tecla">Esc</span>{D.saltar}
        </button>
      </div>
      <div className="dlg-barra dlg-barra--abajo" />
      <div className={`dlg-globo${enojo ? ' is-enojo' : ''}`}>
        <span ref={nombreRef} className={`dlg-nombre${firma?.letras ? ' display-title--runas' : ''}${firma?.tiembla ? ' glitch-runas' : ''}`}>{textoGlitch(D.nombre, firma)}</span>
        {fase === 'menu' ? (
          <div className="dlg-menu">
            <RenglonRunas key={`pregunta-${renglonesRef.current}`} texto={D.pregunta} completo={false} className="dlg-texto--pregunta" />
            <ul role="listbox" aria-label={D.pregunta}>
              {opciones.map((o, i) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sel === i}
                    className={`dlg-opcion${vistos.has(o.id) ? ' is-visto' : ''}`}
                    onMouseEnter={() => setSel(i)}
                    onClick={(e) => { e.stopPropagation(); elegir(i) }}
                  >
                    <span className="dlg-cursor" aria-hidden="true">▶</span>
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          linea && (
            <RenglonRunas
              key={cola.n}
              texto={linea.t}
              completo={completo}
              alTerminar={() => setCompleto(true)}
            />
          )
        )}
        {fase === 'texto' && completo && <span className="dlg-sigue" aria-label={D.continuar}>▼</span>}
      </div>
    </div>
  )
}
