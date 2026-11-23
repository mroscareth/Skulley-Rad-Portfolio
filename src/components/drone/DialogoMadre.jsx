import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { dialogoMadre, escoger } from '../../lib/dialogoMadre.js'
import { avisarDron, tomarSaludo, cerrarConMadre } from '../../lib/droneNpc.js'
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
//
// No dice siempre lo mismo (Oscar, 2026-11-23): el saludo sale de su humor
// (lib/droneNpc.js: normal, seguido, de regreso de una sección, regaño, perdón),
// cada tema tiene dos versiones y la despedida cambia. Si la cortas a media frase
// o te vas del menú sin despedirte, lo cuenta (`cerrarConMadre`) y te lo reclama
// en su viñeta. Si la picas justo después de que te recomendó un proyecto en su
// viñeta (saludo 'proyecto'), te lo ofrece: "Enséñame…" va primero en el menú y, al
// cerrar, App abre su ficha encima de la home, sin pasar por Trabajo
// (`onVerProyecto`). Si el proyecto es un enlace a otro sitio (`url`), lo abre en
// otra pestaña en el mismo clic o Enter que lo elige (el navegador solo deja abrir
// pestañas en un gesto del usuario) y luego te dice que ahí te espera. Al regresar
// (al cerrar la ficha, o esta charla si fue en otra pestaña) lo comenta en su
// viñeta: dónde lo usaría una marca (DroneNPC, `comenta`).

const ENTRADA_MS = 750
const SALIDA_MS = 650
const VISTO = 'skulley_madre_hablo'
const FIRMA_GLITCH = { primeraMs: 1400, cadaMs: 4200, sostieneMs: 1300 }

const quietoPreferido = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// `modo`: 'charla' (al picarla: saludo y menú) o 'bienvenida' (la primera vez en
// la experiencia: su bienvenida y se cierra; App abre después los controles).
export default function DialogoMadre({ onClose, onVerProyecto, modo = 'charla' }) {
  const { lang } = useLanguage()
  const D = dialogoMadre(lang)
  const [fase, setFase] = useState('entra')      // entra | texto | menu | sale
  const [cola, setCola] = useState(null)         // { lineas, i, despues: 'menu' | 'salir', n }
  const [completo, setCompleto] = useState(false)
  const [sel, setSel] = useState(0)
  const [vistos, setVistos] = useState(() => new Set())
  const [pregunta, setPregunta] = useState('')
  const [proyecto, setProyecto] = useState(null)   // el que acaba de recomendar { slug, titulo, url }
  const verRef = useRef(null)                       // el que pediste ver: al cerrar, App te lleva
  const fueraRef = useRef(null)                     // el que te abrió en otra pestaña: al cerrar, lo comenta
  const nombreRef = useRef(null)
  const firma = useGlitchSolo(nombreRef, FIRMA_GLITCH)
  const renglonesRef = useRef(0)

  const linea = cola ? cola.lineas[cola.i] : null
  const opciones = [
    ...(proyecto ? [{ id: 'verProyecto', label: (proyecto.url ? D.verFuera : D.verProyecto).replace('{titulo}', proyecto.titulo) }] : []),
    ...D.temas,
    { id: 'adios', label: D.adios.label },
  ]
  const colaRef = useRef(null)
  colaRef.current = cola

  const empezar = useCallback((lineas, despues) => {
    renglonesRef.current += 1
    setCola({ lineas, i: 0, despues, n: renglonesRef.current })
    setCompleto(false)
    setFase('texto')
  }, [])

  // `como`: 'adios' al despedirse; con Esc o Saltar, 'cortada' si estaba hablando
  // y 'sinAdios' en el menú. La bienvenida no cuenta.
  const faseRef = useRef(fase)
  faseRef.current = fase
  const cerrar = useCallback((como = null) => {
    const f = faseRef.current
    if (f === 'sale') return
    faseRef.current = 'sale'
    let c = como
    if (!c) c = f !== 'texto' ? 'sinAdios' : colaRef.current?.despues === 'salir' ? 'adios' : 'cortada'
    if (modo === 'bienvenida') c = null
    cerrarConMadre(c)
    avisarDron({ fin: true, como: c })
    setTimeout(() => {
      onClose?.()
      if (verRef.current) onVerProyecto?.(verRef.current)
      if (fueraRef.current) avisarDron({ comenta: fueraRef.current })
    }, SALIDA_MS)
    setFase('sale')
  }, [onClose, onVerProyecto, modo])

  // entrada: las barras y el globo; luego el saludo
  useEffect(() => {
    let primera = true
    try { primera = !sessionStorage.getItem(VISTO); sessionStorage.setItem(VISTO, '1') } catch { }
    const s = modo === 'bienvenida' ? null : tomarSaludo()
    const id = setTimeout(() => {
      if (modo === 'bienvenida') { empezar(D.bienvenida, 'salir'); return }
      if (s.tipo === 'proyecto' && s.proyecto) {
        setProyecto(s.proyecto)
        const lista = s.proyecto.url ? D.llevarFuera : D.llevar
        empezar([{ t: escoger(lista, s.proyecto.url ? 'llevarFuera' : 'llevar', { lang }).replace('{titulo}', s.proyecto.titulo), cara: 'feliz', accion: 'IdleJugueton' }], 'menu')
        return
      }
      if (primera && s.tipo !== 'regano' && s.tipo !== 'perdon') { empezar(D.saludo, 'menu'); return }
      const lista = { seguido: D.seguido, vuelta: D.vuelta, regano: D.regano, perdon: D.perdon }[s.tipo] || D.otraVez
      empezar(escoger(lista, `saludo-${s.tipo}`, { seg: s.seg, lang }), 'menu')
    }, ENTRADA_MS)
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
    if (cola.despues === 'salir') { cerrar('adios'); return }
    avisarDron({ cara: 'normal' })
    setPregunta(escoger(vistos.size ? D.preguntasOtra : D.preguntas, vistos.size ? 'preguntaOtra' : 'pregunta', { lang }))
    setFase('menu')
  }, [fase, linea, completo, cola, cerrar, vistos, D, lang])

  const elegir = useCallback((i) => {
    const o = opciones[i]
    if (!o) return
    try { blipMadre(1.4) } catch { }
    if (o.id === 'adios') { empezar([escoger(D.adios.lineas, 'adios', { lang })], 'salir'); return }
    if (o.id === 'verProyecto' && proyecto) {
      if (proyecto.url) {
        try { window.open(proyecto.url, '_blank', 'noopener,noreferrer') } catch { }
        fueraRef.current = proyecto.slug
        empezar([{ t: escoger(D.vamosFuera, 'vamosFuera', { lang }), cara: 'feliz', accion: 'IdleJugueton' }], 'salir')
        return
      }
      verRef.current = proyecto.slug
      empezar([{ t: escoger(D.vamos, 'vamos', { lang }), cara: 'feliz', accion: 'IdleJugueton' }], 'salir')
      return
    }
    setVistos((v) => new Set(v).add(o.id))
    setSel(i)
    empezar(escoger(o.variantes, `tema-${o.id}`, { lang }), 'menu')
  }, [opciones, empezar, D, lang, proyecto])

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
            <RenglonRunas key={`pregunta-${renglonesRef.current}`} texto={pregunta} completo={false} className="dlg-texto--pregunta" />
            <ul role="listbox" aria-label={pregunta}>
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
