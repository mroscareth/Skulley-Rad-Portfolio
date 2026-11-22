import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { playSfx } from '../../lib/sfx.js'
import IconoTinta from './IconoTinta.jsx'

// El selector de color del sitio (reemplazó al <input type="color"> nativo,
// "está bien culero", Oscar, 2026-11-15). Lo abre ColorWell: los colores de
// Skulley, el fondo y el texto del wallpaper, en escritorio y en teléfono.
// Saturación y brillo en un cuadro, tono en una barra, el código hex y, a la
// izquierda, el color con el que se abrió para regresar a él. Cada cambio sale
// en vivo (uno por cuadro como máximo), igual que el nativo.
//
// Va en la capa superior del navegador (popover="manual", como TipLayer): ni
// el overflow ni el z-index de Customize o del wallpaper lo tapan. En
// escritorio es un globo pegado al círculo; en pantallas angostas, una hoja
// abajo, sobre el panel, para que Skulley siga a la vista mientras se pinta.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// h en grados, s y v de 0 a 100. Sin redondear: el ida y vuelta con el hex
// tiene que dar el mismo hex. `tonoPrevio` se queda cuando el color es gris o
// negro, que no tienen tono: si no, la barra brincaría al rojo.
export function hexToHsv(hex, tonoPrevio = 0) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = tonoPrevio
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 }
}

export function hsvToHex({ h, s, v }) {
  const sv = s / 100
  const vv = v / 100
  const c = vv * sv
  const hh = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const [r, g, b] = (
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] :
      hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x]
  )
  const m = vv - c
  const aHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${aHex(r)}${aHex(g)}${aHex(b)}`
}

// Lo que se escribe en el campo: con o sin #, de 6 cifras (o de 3 al soltar el
// campo, `corto`). Devuelve '#rrggbb' o null.
export function normalizaHex(texto, corto = false) {
  const t = String(texto || '').trim().replace(/^#/, '')
  if (/^[0-9a-f]{6}$/i.test(t)) return `#${t.toLowerCase()}`
  if (corto && /^[0-9a-f]{3}$/i.test(t)) return `#${t.split('').map((c) => c + c).join('').toLowerCase()}`
  return null
}

// Tinta o blanco encima de un color, según qué tan claro es.
function tintaSobre(hex) {
  const [r, g, b] = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? '#0a0510' : '#fff'
}

const LADOS = ['bottom', 'top', 'left', 'right']
// Separación entre el círculo y el globo (el piquito vive ahí) y aire mínimo
// con las orillas de la pantalla.
const SEPARACION = 14
const ORILLA = 12
const PIQUITO_MIN = 22
const SALIDA_MS = 140

const esHoja = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
const conPopover = () => typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function'

export default function SelectorColor({ abierto, ...props }) {
  const [montado, setMontado] = useState(abierto)
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    if (abierto) {
      setMontado(true)
      setSaliendo(false)
      return undefined
    }
    setSaliendo(true)
    const id = setTimeout(() => { setMontado(false); setSaliendo(false) }, SALIDA_MS)
    return () => clearTimeout(id)
  }, [abierto])

  if (!montado || typeof document === 'undefined') return null
  return createPortal(<Globo {...props} saliendo={saliendo} />, document.body)
}

function Globo({ anclaRef, valor, titulo, onCambio, onCerrar, lados, saliendo }) {
  const { t } = useLanguage()
  // En una ref: un arreglo escrito en línea cambiaría en cada render y el
  // globo se volvería a colocar sin razón.
  const ladosRef = useRef(lados)
  ladosRef.current = lados
  const raiz = useRef(null)
  const cuadroRef = useRef(null)
  const tonoRef = useRef(null)
  const inicial = normalizaHex(valor) || '#ffffff'
  const [anterior] = useState(inicial)
  const [hsv, setHsv] = useState(() => hexToHsv(inicial))
  const hsvRef = useRef(hsv)
  const [texto, setTexto] = useState(inicial.slice(1).toUpperCase())
  const editando = useRef(false)
  const [hoja, setHoja] = useState(esHoja)
  const [pos, setPos] = useState(null)
  const [teclado, setTeclado] = useState(0)

  // El último hex que salió y el que espera su cuadro: cuando el valor que
  // regresa del padre es uno de ellos no se resincroniza (si no, a medio
  // arrastre el punto brincaría hacia atrás un cuadro).
  const salido = useRef(inicial)
  const enviado = useRef(inicial)
  const pendiente = useRef(null)
  const cuadro = useRef(0)
  const onCambioRef = useRef(onCambio)
  onCambioRef.current = onCambio

  const enviar = useCallback(() => {
    cancelAnimationFrame(cuadro.current)
    cuadro.current = 0
    const hex = pendiente.current
    pendiente.current = null
    if (!hex) return
    enviado.current = hex
    onCambioRef.current?.(hex)
  }, [])

  const aplicar = useCallback((n, hexDirecto) => {
    hsvRef.current = n
    setHsv(n)
    const hex = hexDirecto || hsvToHex(n)
    if (!editando.current) setTexto(hex.slice(1).toUpperCase())
    if (hex === salido.current) return
    salido.current = hex
    pendiente.current = hex
    if (!cuadro.current) cuadro.current = requestAnimationFrame(enviar)
  }, [enviar])

  const aplicarHex = useCallback((hex) => {
    aplicar(hexToHsv(hex, hsvRef.current.h), hex)
  }, [aplicar])

  useEffect(() => {
    const v = normalizaHex(valor)
    if (!v || v === salido.current || v === enviado.current) return
    salido.current = v
    enviado.current = v
    const n = hexToHsv(v, hsvRef.current.h)
    hsvRef.current = n
    setHsv(n)
    if (!editando.current) setTexto(v.slice(1).toUpperCase())
  }, [valor])

  // Lo que quede pendiente sale antes de desmontar.
  useEffect(() => () => enviar(), [enviar])

  const cerrarRef = useRef(null)
  cerrarRef.current = (devolverFoco) => {
    enviar()
    onCerrar?.(devolverFoco)
  }

  // ── Dónde va ──────────────────────────────────────────────────────────────
  const colocar = useCallback(() => {
    const p = raiz.current
    if (!p) return
    const enHoja = esHoja()
    setHoja(enHoja)
    const vv = window.visualViewport
    setTeclado(vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0)
    const a = anclaRef?.current
    if (enHoja || !a) return
    const r = a.getBoundingClientRect()
    const w = p.offsetWidth
    const h = p.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const espacio = {
      bottom: vh - r.bottom - SEPARACION - ORILLA - h,
      top: r.top - SEPARACION - ORILLA - h,
      left: r.left - SEPARACION - ORILLA - w,
      right: vw - r.right - SEPARACION - ORILLA - w,
    }
    const orden = ladosRef.current || LADOS
    const lado = orden.find((l) => espacio[l] >= 0) || [...orden].sort((x, y) => espacio[y] - espacio[x])[0]
    let x
    let y
    if (lado === 'top' || lado === 'bottom') {
      x = clamp(cx - w / 2, ORILLA, vw - ORILLA - w)
      y = lado === 'bottom' ? r.bottom + SEPARACION : r.top - SEPARACION - h
      y = clamp(y, ORILLA, vh - ORILLA - h)
    } else {
      y = clamp(cy - h / 2, ORILLA, vh - ORILLA - h)
      x = lado === 'right' ? r.right + SEPARACION : r.left - SEPARACION - w
      x = clamp(x, ORILLA, vw - ORILLA - w)
    }
    const piquito = (lado === 'top' || lado === 'bottom')
      ? clamp(cx - x, PIQUITO_MIN, w - PIQUITO_MIN)
      : clamp(cy - y, PIQUITO_MIN, h - PIQUITO_MIN)
    setPos({ x: Math.round(x), y: Math.round(y), lado, piquito: Math.round(piquito) })
  }, [anclaRef])

  useLayoutEffect(() => {
    const p = raiz.current
    if (p && conPopover()) {
      try { p.showPopover() } catch { }
    }
    colocar()
    window.addEventListener('resize', colocar)
    window.addEventListener('scroll', colocar, true)
    window.visualViewport?.addEventListener('resize', colocar)
    return () => {
      window.removeEventListener('resize', colocar)
      window.removeEventListener('scroll', colocar, true)
      window.visualViewport?.removeEventListener('resize', colocar)
    }
  }, [colocar])

  // La hoja cambia de alto (otro idioma, el teclado): se vuelve a medir.
  useLayoutEffect(() => { colocar() }, [hoja, colocar])

  // El foco entra al cuadro ya colocado: mientras se mide, el globo va con
  // visibility: hidden y ahí nada se puede enfocar.
  const enfocado = useRef(false)
  useEffect(() => {
    if (enfocado.current || (!hoja && !pos)) return
    enfocado.current = true
    cuadroRef.current?.focus({ preventScroll: true })
  }, [hoja, pos])

  // Tocar fuera lo cierra. El círculo que lo abrió se encarga solo de cerrarlo.
  useEffect(() => {
    const fuera = (e) => {
      const p = raiz.current
      if (!p || p.contains(e.target)) return
      const boton = anclaRef?.current?.closest('.color-well')
      if (boton && boton.contains(e.target)) return
      cerrarRef.current(false)
    }
    document.addEventListener('pointerdown', fuera, true)
    return () => document.removeEventListener('pointerdown', fuera, true)
  }, [anclaRef])

  // ── Cuadro de saturación y brillo ────────────────────────────────────────
  const desdeCuadro = (e) => {
    const r = cuadroRef.current.getBoundingClientRect()
    aplicar({
      ...hsvRef.current,
      s: clamp((e.clientX - r.left) / r.width, 0, 1) * 100,
      v: (1 - clamp((e.clientY - r.top) / r.height, 0, 1)) * 100,
    })
  }

  const desdeTono = (e) => {
    const r = tonoRef.current.getBoundingClientRect()
    aplicar({ ...hsvRef.current, h: clamp((e.clientX - r.left) / r.width, 0, 1) * 359.999 })
  }

  const arrastre = (mover, ref) => ({
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      ref.current?.focus({ preventScroll: true })
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { }
      mover(e)
    },
    onPointerMove: (e) => {
      if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return
      mover(e)
    },
    onPointerUp: () => enviar(),
    onLostPointerCapture: () => enviar(),
  })

  const teclasCuadro = (e) => {
    const paso = e.shiftKey ? 10 : 1
    const n = { ...hsvRef.current }
    switch (e.key) {
      case 'ArrowLeft': n.s -= paso; break
      case 'ArrowRight': n.s += paso; break
      case 'ArrowUp': n.v += paso; break
      case 'ArrowDown': n.v -= paso; break
      case 'PageUp': n.v += 10; break
      case 'PageDown': n.v -= 10; break
      case 'Home': n.s = 0; break
      case 'End': n.s = 100; break
      default: return
    }
    e.preventDefault()
    n.s = clamp(Math.round(n.s), 0, 100)
    n.v = clamp(Math.round(n.v), 0, 100)
    aplicar(n)
  }

  const teclasTono = (e) => {
    const paso = e.shiftKey ? 10 : 1
    let h = Math.round(hsvRef.current.h)
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': h -= paso; break
      case 'ArrowRight': case 'ArrowUp': h += paso; break
      case 'PageDown': h -= 30; break
      case 'PageUp': h += 30; break
      case 'Home': h = 0; break
      case 'End': h = 359; break
      default: return
    }
    e.preventDefault()
    aplicar({ ...hsvRef.current, h: clamp(h, 0, 359) })
  }

  // ── Campo hex ────────────────────────────────────────────────────────────
  const escribir = (e) => {
    const limpio = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6)
    setTexto(limpio)
    const hex = normalizaHex(limpio)
    if (hex) aplicarHex(hex)
  }

  const soltarCampo = () => {
    editando.current = false
    const hex = normalizaHex(texto, true)
    if (hex) aplicarHex(hex)
    setTexto((hex || salido.current).slice(1).toUpperCase())
  }

  // ── Teclado del globo ────────────────────────────────────────────────────
  // Nada sale de aquí: los atajos del wallpaper (R, H, Z, C, Supr) y el
  // Escape de Customize no deben enterarse de lo que se teclea en el selector.
  const teclas = (e) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      if (e.target.tagName === 'INPUT') e.target.blur()
      cerrarRef.current(true)
      return
    }
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault()
      soltarCampo()
      editando.current = true
      return
    }
    if (e.key !== 'Tab') return
    const enfocables = [...raiz.current.querySelectorAll('[data-sc-foco]:not(:disabled)')]
    if (!enfocables.length) return
    const i = enfocables.indexOf(document.activeElement)
    const siguiente = e.shiftKey
      ? (i <= 0 ? enfocables.length - 1 : i - 1)
      : (i === enfocables.length - 1 ? 0 : i + 1)
    e.preventDefault()
    enfocables[siguiente].focus()
  }

  const hex = hsvToHex(hsv)
  const tonoPuro = hsvToHex({ h: hsv.h, s: 100, v: 100 })
  const cambio = hex !== anterior
  const s = Math.round(hsv.s)
  const v = Math.round(hsv.v)

  const clases = [
    'selcolor',
    hoja ? 'selcolor--hoja' : 'selcolor--globo',
    saliendo ? 'is-saliendo' : '',
  ].join(' ')

  const estilo = hoja
    ? { '--sc-teclado': `${teclado}px` }
    : pos
      ? { left: pos.x, top: pos.y, '--sc-piquito': `${pos.piquito}px` }
      : { visibility: 'hidden' }

  const parar = (e) => e.stopPropagation()

  return (
    <div
      ref={raiz}
      className={clases}
      popover={conPopover() ? 'manual' : undefined}
      role="dialog"
      aria-label={titulo}
      data-lado={hoja ? undefined : pos?.lado}
      style={estilo}
      onKeyDown={teclas}
      onPointerDown={parar}
      onClick={parar}
      onWheel={parar}
      onContextMenu={parar}
    >
      <div className="selcolor__cuerpo">
        <p className="selcolor__titulo" aria-hidden="true">{titulo}</p>

        <div
          ref={cuadroRef}
          className="selcolor__cuadro"
          style={{ '--sc-tono': tonoPuro, '--sc-color': hex, '--sc-x': `${hsv.s}%`, '--sc-y': `${100 - hsv.v}%` }}
          role="slider"
          tabIndex={0}
          data-sc-foco=""
          aria-label={t('colorPicker.area')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={s}
          aria-valuetext={t('colorPicker.areaValue', { s, v })}
          onKeyDown={teclasCuadro}
          {...arrastre(desdeCuadro, cuadroRef)}
        >
          <span className="selcolor__punto" aria-hidden="true" />
        </div>

        <div
          ref={tonoRef}
          className="selcolor__tono"
          style={{ '--sc-tono': tonoPuro, '--sc-x': `${(hsv.h / 360) * 100}%` }}
          role="slider"
          tabIndex={0}
          data-sc-foco=""
          aria-label={t('colorPicker.hue')}
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={Math.round(hsv.h)}
          aria-valuetext={`${Math.round(hsv.h)}°`}
          onKeyDown={teclasTono}
          {...arrastre(desdeTono, tonoRef)}
        >
          <span className="selcolor__riel" aria-hidden="true" />
          <span className="selcolor__punto" aria-hidden="true" />
        </div>

        <div className="selcolor__pie">
          <button
            type="button"
            className="selcolor__antes"
            style={{ backgroundColor: anterior, color: tintaSobre(anterior) }}
            onClick={() => aplicarHex(anterior)}
            disabled={!cambio}
            data-sc-foco=""
            aria-label={t('colorPicker.previous', { hex: anterior.toUpperCase() })}
            data-tip={t('colorPicker.previousTip')}
          >
            <IconoTinta nombre="deshacer" tam={27} />
          </button>
          <label className="selcolor__hex">
            <span aria-hidden="true">#</span>
            <input
              type="text"
              value={texto}
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              enterKeyHint="done"
              data-sc-foco=""
              aria-label={t('colorPicker.hex')}
              onFocus={(e) => { editando.current = true; e.target.select() }}
              onChange={escribir}
              onBlur={soltarCampo}
            />
          </label>
          <button
            type="button"
            className="shop-btn shop-btn--primary selcolor__listo"
            data-sc-foco=""
            onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; cerrarRef.current(true) }}
          >
            {t('colorPicker.done')}
          </button>
        </div>
      </div>
    </div>
  )
}
