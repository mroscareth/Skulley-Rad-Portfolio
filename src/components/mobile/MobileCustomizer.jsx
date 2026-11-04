import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowsPointingInIcon, DevicePhoneMobileIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { playSfx } from '../../lib/sfx.js'
import { getCharacterColors, setCharacterColors, randomVividColor, CHARACTER_COLOR_EVENT } from '../../lib/characterColors.js'
import { getSkin } from '../../lib/skinRegistry.js'
import { chooseSkin, readActiveSkinId } from '../../lib/characterSkin.js'
import SkinChip from '../SkinChip.jsx'
import ColorWell from '../ColorWell.jsx'

// La versión ligera del personalizador de escritorio (CharacterCustomizer) para
// la home de teléfono: cuatro skins, un color por parte y a Skulley se le gira
// con un dedo y se le acerca con dos. Skins y colores usan los mismos controles
// que escritorio (SkinChip, ColorWell). Armarlo y encuadrarlo es cosa del rig
// (PERSONALIZA_* en SkulleyFallRig); aquí solo se escribe en personalizaRef: el
// giro, el zoom, si hay dedos encima, cuánto tapan la barra y el panel, el marco
// del wallpaper y los pedidos de captura. El fondo se pinta en vivo con
// `onFondo` y es uno solo: el del escenario y el del marco.
const SKINS_TELEFONO = ['base', 'slime', 'void', 'oilslick']

const PARTES = [
  { key: 'head', label: 'customizer.skeleton' },
  { key: 'hair', label: 'customizer.hair' },
  { key: 'eyes', label: 'customizer.eyes' },
  { key: 'orb', label: 'customizer.orb' },
]

// Qué se puede pintar con cada skin: la regla del registro (vacío nada, slime
// solo la esfera) o, si no dice, todo en Personalizada y ojos + esfera en las
// demás. La misma que usa el panel de escritorio.
function partesDe(skinId) {
  const skin = getSkin(skinId)
  const keys = skin.editableColors ?? (skinId === 'base' ? ['head', 'hair', 'eyes', 'orb'] : ['eyes', 'orb'])
  return PARTES.filter((p) => keys.includes(p.key))
}

// Radianes por pixel de arrastre: un ancho de teléfono es un poco más de media
// vuelta. El giro sigue al dedo sin más; solo un flick (soltar todavía en
// movimiento) le deja inercia, medida con lo que se movió el dedo en los
// últimos VENTANA_MS.
const GIRO_POR_PX = 0.0105
const VEL_MAX = 8
const VENTANA_MS = 100
const FLICK_MS = 60

// El zoom: el mismo tope que PERSONALIZA_ZOOM_MAX en el rig. La rueda del
// mouse también acerca (teléfono abierto en una ventana angosta).
const ZOOM_MAX = 4
const RUEDA = 0.0015

// Los botones de ícono (cerrar, Restablecer vista, el dado) son los flotantes
// del sitio: las mismas clases que la X de las secciones y la hamburguesa
// (MobileApp), vidrio oscuro de 48 px.
const BOTON_HUD = 'h-12 w-12 rounded-full grid place-items-center shadow-elev-lg backdrop-blur-3xl border bg-black/40 border-white/[0.12] text-white hover:bg-white/[0.15] transition-colors'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const medio = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

// ── Wallpaper ──────────────────────────────────────────────────────────────
// Wallpaper 4K baja el panel y deja el marco: el archivo tal cual, con Skulley
// vivo adentro (el rig encuadra ahí, ver WALLPAPER_*). Nada se captura hasta que
// lo pides con Crear, y Guardar es otro toque: compartir pide que el toque sea
// reciente y no alcanza a esperar a que se haga. Cualquier cambio después de
// Crear tira el archivo: el que se guarda siempre es el que se ve.
// Cuerpo y Cara son atajos de encuadre (`plano`); un pellizco los apaga.
const PLANOS = [
  { id: 'cuerpo', label: 'customizer.wallBody' },
  { id: 'cara', label: 'customizer.wallFace' },
]
const ANCHO_ARCHIVO = 2160
const ALTO_ARCHIVO = 4680
// El cuadro de 4K pide unos 350 MB de video entre canvas y buffers: con 4 GB de
// RAM o menos sale a 1620 × 3510, de sobra para esas pantallas.
const ANCHO_POCA_MEMORIA = 1620
const anchoPedido = () => ((navigator.deviceMemory || 8) <= 4 ? ANCHO_POCA_MEMORIA : ANCHO_ARCHIVO)
const altoDe = (w) => Math.floor((w * ALTO_ARCHIVO) / ANCHO_ARCHIVO)
// Entre el marco y la barra de abajo, y a los lados.
const MARCO_AIRE = 12
const MARCO_LADO = 16

const FONDO_KEY = 'skulley_wallpaper_fondo'
function leerFondo(porDefecto) {
  try {
    const v = localStorage.getItem(FONDO_KEY)
    return /^#[0-9a-f]{6}$/i.test(v || '') ? v : porDefecto
  } catch { return porDefecto }
}

// Dos cuadros: el velo se pinta antes del cuadro de 4K, que congela la pantalla.
const dosCuadros = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

// Un pedido al rig: lo atiende en el siguiente cuadro con Skulley armado. Si
// el canvas no corre (pestaña en segundo plano), no se queda colgado.
function capturar(personalizaRef, { ancho, fondo }) {
  return new Promise((resolve, reject) => {
    const pz = personalizaRef?.current
    if (!pz) { reject(new Error('sin rig')); return }
    let reloj = 0
    const pedido = {
      ancho,
      fondo,
      fase: 'pedida',
      resolve: (blob) => { clearTimeout(reloj); resolve({ blob, w: pedido.w, h: pedido.h }) },
      reject: (e) => { clearTimeout(reloj); reject(e) },
    }
    reloj = setTimeout(() => {
      if (pz.captura === pedido) pz.captura = null
      reject(new Error('timeout'))
    }, 30000)
    pz.captura = pedido
  })
}

function DiceIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function MobileCustomizer({ open = false, onClose, personalizaRef, onFondo }) {
  const { t, lang } = useLanguage()
  const panelRef = useRef(null)
  const barraRef = useRef(null)
  const cerrarRef = useRef(null)
  const wallBtnRef = useRef(null)
  const marcoRef = useRef(null)
  const barraWallRef = useRef(null)
  const crearRef = useRef(null)
  const [skinId, setSkinId] = useState(readActiveSkinId)
  const [colors, setColors] = useState(getCharacterColors)
  // El aviso de girar y acercar se va con el primer gesto y ya no regresa.
  const [yaGiro, setYaGiro] = useState(false)
  // Con zoom aparece "Restablecer vista". Estado solo al cruzar el umbral:
  // el zoom en sí vive en el ref.
  const [conZoom, setConZoom] = useState(false)
  const conZoomRef = useRef(false)

  const marcarZoom = (v) => {
    if (conZoomRef.current === v) return
    conZoomRef.current = v
    setConZoom(v)
  }

  // ── Wallpaper ──────────────────────────────────────────────────────────
  // `sesion` invalida un archivo que llegue tarde (ya cambiaste algo o saliste
  // del marco); `listoRef` y `planoRef` para no tocar el estado en cada
  // movimiento de un dedo.
  const [wall, setWall] = useState(false)
  const [plano, setPlano] = useState('cuerpo')
  const [fondo, setFondo] = useState(() => leerFondo(personalizaRef?.current?.fondo || '#022dd6'))
  const [creando, setCreando] = useState(false)
  const [listo, setListo] = useState(null)
  const [fallo, setFallo] = useState(false)
  const [ahora, setAhora] = useState(() => new Date())
  const sesion = useRef(0)
  const listoRef = useRef(null)
  const planoRef = useRef('cuerpo')

  const tirarArchivo = () => {
    if (!listoRef.current) return
    listoRef.current = null
    setListo(null)
    if (personalizaRef?.current) personalizaRef.current.quieto = false
  }

  const marcarPlano = (id) => {
    if (planoRef.current === id) return
    planoRef.current = id
    setPlano(id)
  }

  const abrirWall = () => {
    const pz = personalizaRef?.current
    if (!pz) return
    pz.vel = 0
    pz.plano = null
    pz.wall = true
    marcarPlano((pz.zoom || 1) <= 1.01 ? 'cuerpo' : null)
    setFallo(false)
    setAhora(new Date())
    setWall(true)
    try { playSfx('click', { volume: 1.0 }) } catch { }
  }

  const salirWall = useCallback(() => {
    const pz = personalizaRef?.current
    sesion.current += 1
    if (pz) {
      pz.wall = false
      pz.plano = null
      pz.quieto = false
      marcarZoom((pz.zoom || 1) > 1.01)
    }
    listoRef.current = null
    setListo(null)
    setFallo(false)
    setCreando(false)
    setWall(false)
    requestAnimationFrame(() => { try { wallBtnRef.current?.focus({ preventScroll: true }) } catch { } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalizaRef])

  const elegirPlano = (id) => {
    const pz = personalizaRef?.current
    if (!pz || planoRef.current === id) return
    pz.plano = id
    pz.vel = 0
    marcarPlano(id)
    tirarArchivo()
    setFallo(false)
    try { playSfx('click', { volume: 1.0 }) } catch { }
  }

  const elegirFondo = (hex) => {
    setFondo(hex)
    onFondo?.(hex)
    tirarArchivo()
    setFallo(false)
    try { localStorage.setItem(FONDO_KEY, hex) } catch { }
  }

  const crear = async () => {
    const pz = personalizaRef?.current
    if (!pz || creando) return
    // Sin inercia, sin persecución y sin idle: lo que se ve es lo que sale, y
    // se queda así hasta que cambies algo.
    pz.vel = 0
    pz.giroVisto = pz.giro
    pz.quieto = true
    sesion.current += 1
    const s = sesion.current
    setFallo(false)
    setCreando(true)
    try { navigator.vibrate?.(10) } catch { }
    await dosCuadros()
    try {
      const r = await capturar(personalizaRef, { ancho: anchoPedido(), fondo })
      if (sesion.current !== s) return
      listoRef.current = r
      setListo(r)
    } catch {
      if (sesion.current === s) {
        setFallo(true)
        pz.quieto = false
      }
    }
    if (sesion.current === s) setCreando(false)
  }

  const guardar = async () => {
    const r = listoRef.current
    if (!r) return
    const nombre = 'skulley-rad-wallpaper.png'
    try { navigator.vibrate?.(10) } catch { }
    // En el teléfono, la hoja de compartir: ahí está "Guardar imagen", que lo
    // manda a Fotos (una descarga se va a Archivos). Si no hay, se descarga.
    const archivo = new File([r.blob], nombre, { type: 'image/png' })
    const tactil = window.matchMedia?.('(pointer: coarse)')?.matches
    if (tactil && navigator.canShare?.({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo] }); return } catch (e) { if (e?.name === 'AbortError') return }
    }
    const url = URL.createObjectURL(r.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  // El rig lo regresa a 1 al cerrar; esto es para el botón.
  const restablecerVista = () => {
    const pz = personalizaRef?.current
    if (!pz) return
    pz.zoom = 1
    pz.panX = 0
    pz.panY = 0
    marcarZoom(false)
    try { playSfx('click', { volume: 1.0 }) } catch { }
  }

  useEffect(() => {
    if (!open) {
      if (wall) salirWall()
      marcarZoom(false)
      return undefined
    }
    setSkinId(readActiveSkinId())
    setColors(getCharacterColors())
    onFondo?.(fondo)
    const id = requestAnimationFrame(() => { try { cerrarRef.current?.focus({ preventScroll: true }) } catch { } })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!wall) return undefined
    const id = requestAnimationFrame(() => { try { crearRef.current?.focus({ preventScroll: true }) } catch { } })
    return () => cancelAnimationFrame(id)
  }, [wall])

  useEffect(() => {
    const onChange = (e) => setColors(e?.detail ? { ...e.detail } : getCharacterColors())
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (wall) salirWall()
      else onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, wall, salirWall])

  // El rig encuadra a Skulley entre la orilla de arriba de la barra y el
  // panel. Los botones de la barra van en las esquinas y Skulley al centro,
  // así que no se estorban; el aviso sobre el panel tapa un poco los pies
  // hasta el primer gesto. Todo para que se vea lo más grande posible.
  // El marco del wallpaper: lo más grande que quepa con la proporción del
  // archivo, entre la orilla de arriba de la barra y la barra de abajo.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel || !personalizaRef) return undefined
    const medir = () => {
      const alto = Math.max(1, window.innerHeight)
      const ancho = Math.max(1, window.innerWidth)
      const barra = barraRef.current
      const pz = personalizaRef.current
      pz.abajo = panel.offsetHeight / alto
      if (barra) pz.arriba = barra.offsetTop / alto
      const marco = marcoRef.current
      const abajo = barraWallRef.current
      if (!marco || !abajo) return
      const proporcion = ANCHO_ARCHIVO / ALTO_ARCHIVO
      const techo = barra ? barra.offsetTop : MARCO_LADO
      const libre = Math.max(1, alto - abajo.offsetHeight - techo - MARCO_AIRE)
      const h = Math.min(libre, (ancho - 2 * MARCO_LADO) / proporcion)
      const w = h * proporcion
      const y = techo + (libre - h) / 2
      marco.style.width = `${w}px`
      marco.style.height = `${h}px`
      marco.style.left = `${(ancho - w) / 2}px`
      marco.style.top = `${y}px`
      marco.style.setProperty('--marco-w', `${w}px`)
      pz.marco = { cy: (y + h / 2) / alto, h: h / alto, w }
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(panel)
    if (barraWallRef.current) ro?.observe(barraWallRef.current)
    window.addEventListener('resize', medir)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [personalizaRef])

  const partes = partesDe(skinId)

  const elegirSkin = (id) => {
    if (id === skinId) return
    chooseSkin(id)
    setSkinId(id)
    try { navigator.vibrate?.(10) } catch { }
  }

  const pintar = (key, hex) => {
    setColors(setCharacterColors({ [key]: hex }))
  }

  const alAzar = () => {
    const next = {}
    for (const p of partes) next[p.key] = randomVividColor()
    setColors(setCharacterColors(next))
    try { playSfx('magiaInicia', { volume: 0.9 }) } catch { }
    try { navigator.vibrate?.(14) } catch { }
  }

  // ── Gestos ─────────────────────────────────────────────────────────────
  // Un dedo gira (solo escribe en el ref; el rig hace que lo que se ve
  // persiga al dedo, GIRO_SIGUE, y frena la inercia de un flick). Dos dedos
  // acercan y mueven el cuadro: el punto de Skulley que quedó entre los dedos
  // sigue entre los dedos. Después de un pellizco, el dedo que queda no gira
  // hasta que se levantan todos (si no, Skulley daba un latigazo). En el marco
  // es igual, medido contra el marco: el archivo es lo que cae adentro.
  const arrastre = useRef(null)
  const punteros = useRef(new Map())
  const pellizco = useRef(null)
  const soloZoom = useRef(false)
  const caja = useRef({ cx: 0, cy: 0, w: 1, h: 1 })

  const avisarGesto = () => setYaGiro(true)

  const medirCaja = (el) => {
    const r = (wall ? marcoRef.current : el).getBoundingClientRect()
    caja.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: Math.max(1, r.width), h: Math.max(1, r.height) }
  }

  const moviendo = (si) => marcoRef.current?.classList.toggle('is-moviendo', si)

  // Zoom a `z1` dejando el punto de pantalla `antes` (con el zoom y paneo de
  // `base`) debajo de `despues`. El paneo va en altos de pantalla con zoom 1,
  // como lo lee el rig. Sin zoom no se mueve el cuadro.
  const zoomEn = (pz, z1, antes, despues, base) => {
    const { cx, cy, w, h } = caja.current
    const u0 = 1 / (base.z * h)
    const u1 = 1 / (z1 * h)
    const maxX = (w / h / 2) * (1 - 1 / z1)
    const maxY = 0.5 * (1 - 1 / z1)
    pz.zoom = z1
    pz.panX = clamp(base.x + (antes.x - cx) * u0 - (despues.x - cx) * u1, -maxX, maxX)
    pz.panY = clamp(base.y - (antes.y - cy) * u0 + (despues.y - cy) * u1, -maxY, maxY)
    marcarZoom(z1 > 1.01)
    marcarPlano(null)
  }

  const onDown = (e) => {
    const pz = personalizaRef?.current
    if (!pz) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { }
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moviendo(true)
    if (punteros.current.size === 2) {
      arrastre.current = null
      pz.arrastrando = false
      pz.vel = 0
      medirCaja(e.currentTarget)
      const [a, b] = punteros.current.values()
      pellizco.current = { d: Math.max(1, distancia(a, b)), m: medio(a, b), z: pz.zoom || 1, x: pz.panX || 0, y: pz.panY || 0 }
      pz.pellizcando = true
      soloZoom.current = true
      avisarGesto()
      return
    }
    if (punteros.current.size !== 1 || soloZoom.current) return
    arrastre.current = { x: e.clientX, muestras: [{ t: performance.now(), giro: pz.giro }] }
    pz.arrastrando = true
    pz.vel = 0
  }

  const onMove = (e) => {
    if (!punteros.current.has(e.pointerId)) return
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pz = personalizaRef?.current
    if (!pz) return
    const p = pellizco.current
    if (p && punteros.current.size >= 2) {
      const [a, b] = punteros.current.values()
      const z1 = clamp(p.z * (distancia(a, b) / p.d), 1, ZOOM_MAX)
      zoomEn(pz, z1, p.m, medio(a, b), p)
      tirarArchivo()
      return
    }
    const a = arrastre.current
    if (!a) return
    const dx = e.clientX - a.x
    a.x = e.clientX
    if (dx) tirarArchivo()
    pz.giro += dx * GIRO_POR_PX
    const ahora = performance.now()
    a.muestras.push({ t: ahora, giro: pz.giro })
    while (a.muestras.length > 2 && ahora - a.muestras[0].t > VENTANA_MS) a.muestras.shift()
    if (Math.abs(dx) > 2) avisarGesto()
  }

  const onUp = (e) => {
    punteros.current.delete(e.pointerId)
    const pz = personalizaRef?.current
    if (!pz) return
    if (pellizco.current && punteros.current.size < 2) {
      pellizco.current = null
      pz.pellizcando = false
    }
    if (punteros.current.size > 0) return
    moviendo(false)
    soloZoom.current = false
    const a = arrastre.current
    arrastre.current = null
    pz.arrastrando = false
    pz.vel = 0
    if (!a) return
    const ultima = a.muestras[a.muestras.length - 1]
    const primera = a.muestras[0]
    const tramo = ultima.t - primera.t
    if (performance.now() - ultima.t < FLICK_MS && tramo > 16) {
      const v = (ultima.giro - primera.giro) / (tramo / 1000)
      pz.vel = Math.max(-VEL_MAX, Math.min(VEL_MAX, v))
    }
  }

  const onWheel = (e) => {
    const pz = personalizaRef?.current
    if (!pz) return
    medirCaja(e.currentTarget)
    const base = { z: pz.zoom || 1, x: pz.panX || 0, y: pz.panY || 0 }
    const z1 = clamp(base.z * Math.exp(-e.deltaY * RUEDA), 1, ZOOM_MAX)
    const punto = { x: e.clientX, y: e.clientY }
    zoomEn(pz, z1, punto, punto, base)
    tirarArchivo()
    avisarGesto()
  }

  const locale = lang === 'es' ? 'es-MX' : 'en-US'
  const hora = ahora.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: false })
  const fecha = ahora.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const anchoDato = listo ? listo.w : anchoPedido()
  const altoDato = listo ? listo.h : altoDe(anchoDato)
  const cerrarLabel = wall ? t('common.back') : t('customizer.close')

  return (
    <div className={`mcz ${open ? 'is-open' : ''} ${wall ? 'is-wall' : ''} ${creando ? 'is-creando' : ''}`} aria-hidden={!open}>
      <div
        className="mcz-escenario"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      />

      {/* El archivo: lo que cae adentro es lo que sale. Tapa lo demás con su
          sombra y no recibe toques, así los gestos siguen en el escenario. El
          reloj es de muestra: no sale en el archivo y se quita al mover. */}
      <div ref={marcoRef} className="mcz-marco" aria-hidden="true">
        <div className="mcz-reloj">
          <span>{fecha}</span>
          <b>{hora}</b>
        </div>
      </div>

      {/* Fuera del escenario: ahí el dedo captura el puntero y el toque no
          llegaría a los botones. Cerrar a la izquierda (pedido de Oscar) y,
          con zoom, Restablecer vista a la derecha. En el marco la X regresa a
          Personalizar y Cuerpo hace de Restablecer vista. */}
      <div ref={barraRef} className="mcz-arriba">
        <button
          ref={cerrarRef}
          type="button"
          className={BOTON_HUD}
          onClick={() => { if (wall) salirWall(); else onClose?.() }}
          aria-label={cerrarLabel}
          data-tip={cerrarLabel}
          data-tip-side="bottom"
          tabIndex={open ? 0 : -1}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        <div className="mcz-arriba-der">
          {conZoom && !wall && (
            <button
              type="button"
              className={BOTON_HUD}
              onClick={restablecerVista}
              aria-label={t('customizer.resetView')}
              data-tip={t('customizer.resetView')}
              data-tip-side="bottom"
            >
              <ArrowsPointingInIcon className="w-5 h-5" />
            </button>
          )}
          {/* El fondo, sobre el escenario (pedido de Oscar: en el panel se
              amontonaban los colores) para ir probando la mezcla desde antes
              de crear el wallpaper. Va en el vidrio de la X: sin él, el círculo
              se perdería contra su propio color y el nombre no se leería sobre
              un fondo claro. En el marco está en la barra de abajo. */}
          <div className={`${BOTON_HUD} mcz-fondo`} inert={!open || wall || undefined}>
            <ColorWell label={t('customizer.wallBg')} value={fondo} onChange={elegirFondo} />
          </div>
        </div>
      </div>

      <section ref={panelRef} className="mcz-panel" role="dialog" aria-label={t('customizer.title')} inert={wall || undefined}>
        <p className={`mcz-pista ${yaGiro ? 'is-off' : ''}`}>{t('customizer.dragHint')}</p>

        <div className="mcz-cabeza">
          <h2 className="mcz-titulo">{t('customizer.title')}</h2>
        </div>

        <fieldset className="mcz-skins">
          <legend className="sr-only">{t('customizer.skin')}</legend>
          {SKINS_TELEFONO.map((id) => (
            <SkinChip
              key={id}
              skin={getSkin(id)}
              lang={lang}
              active={skinId === id}
              live={open && !wall}
              onSelect={elegirSkin}
            />
          ))}
        </fieldset>

        {partes.length > 0 ? (
          <fieldset className="mcz-colores">
            <legend className="sr-only">{t('customizer.color')}</legend>
            {partes.map((p) => (
              <ColorWell
                key={p.key}
                label={t(p.label)}
                value={colors[p.key] || '#ffffff'}
                onChange={(hex) => pintar(p.key, hex)}
              />
            ))}
            {/* Colores al azar, al lado de los colores (pedido de Oscar) y con
                su misma anatomía: círculo de vidrio y nombre abajo. Solo en
                Personalizada, como en escritorio: en las demás la skin pone
                casi todo. */}
            {skinId === 'base' && (
              <button type="button" className="mcz-dado" onClick={alAzar}>
                <span className={`${BOTON_HUD} mcz-dado__circulo`} aria-hidden="true">
                  <DiceIcon className="w-5 h-5" />
                </span>
                <span className="color-well__label">{t('customizer.randomize')}</span>
              </button>
            )}
          </fieldset>
        ) : (
          <div className="mcz-colores">
            <p className="mcz-nota">{t('customizer.ownColors')}</p>
          </div>
        )}

        <div className="mcz-pie">
          <button
            ref={wallBtnRef}
            type="button"
            className="shop-btn shop-btn--primary mcz-boton"
            onClick={abrirWall}
          >
            <DevicePhoneMobileIcon className="w-4 h-4" aria-hidden="true" />
            {t('customizer.wallpaper')}
          </button>
        </div>
      </section>

      <section
        ref={barraWallRef}
        className="mcz-wall-barra"
        role="dialog"
        aria-label={t('customizer.wallpaper')}
        inert={!wall || undefined}
      >
        <div className="mcz-wall-controles">
          <ColorWell label={t('customizer.wallBg')} value={fondo} onChange={elegirFondo} />
          <div className="mcz-wall-chips" role="group" aria-label={t('customizer.wallpaper')}>
            {PLANOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="shop-chip min-h-[40px] px-4 text-[11px]"
                aria-pressed={plano === p.id}
                onClick={() => elegirPlano(p.id)}
              >
                {t(p.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="mcz-wall-pie">
          <p className="mcz-wall-dato" role="status">
            {fallo ? t('customizer.wallError') : `${anchoDato} × ${altoDato} px`}
          </p>
          <button
            ref={crearRef}
            type="button"
            className="shop-btn shop-btn--primary mcz-boton"
            onClick={listo ? guardar : crear}
            disabled={creando}
            aria-busy={creando}
          >
            {listo ? t('customizer.wallSave') : fallo ? t('customizer.wallRetry') : t('customizer.wallCreate')}
          </button>
        </div>
      </section>

      {/* El cuadro de 4K deja un parpadeo del canvas y congela la pantalla un
          momento: lo tapa este velo, que además detiene los dedos. */}
      <div className="mcz-velo" role="status">{creando ? t('customizer.wallMaking') : ''}</div>
    </div>
  )
}
