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
// giro, el zoom, si hay dedos encima, cuánto tapan la barra y el panel, y los
// pedidos de wallpaper.
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
// Los dos encuadres (ver WALLPAPER_* en el rig) y el ancho de sus miniaturas.
// Al abrir la hoja se hacen las dos miniaturas y el 4K del elegido, para que
// Guardar ya tenga el archivo: compartir pide que el toque sea reciente y no
// alcanza a esperar a que se haga.
const ENCUADRES = [
  { id: 'cuerpo', label: 'customizer.wallBody', archivo: 'full-body' },
  { id: 'cara', label: 'customizer.wallFace', archivo: 'close-up' },
]
const MINI_ANCHO = 240

// Un pedido al rig: lo atiende en el siguiente cuadro con Skulley armado. Si
// el canvas no corre (pestaña en segundo plano), no se queda colgado.
function capturar(personalizaRef, { encuadre, ancho }) {
  return new Promise((resolve, reject) => {
    const pz = personalizaRef?.current
    if (!pz) { reject(new Error('sin rig')); return }
    let reloj = 0
    const pedido = {
      encuadre,
      ancho,
      fondo: pz.fondo,
      fase: 'pedida',
      resolve: (blob) => { clearTimeout(reloj); resolve({ blob, w: pedido.w, h: pedido.h }) },
      reject: (e) => { clearTimeout(reloj); reject(e) },
    }
    reloj = setTimeout(() => {
      if (pz.captura === pedido) pz.captura = null
      reject(new Error('timeout'))
    }, 15000)
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

export default function MobileCustomizer({ open = false, onClose, personalizaRef }) {
  const { t, lang } = useLanguage()
  const panelRef = useRef(null)
  const barraRef = useRef(null)
  const cerrarRef = useRef(null)
  const wallBtnRef = useRef(null)
  const wallHojaRef = useRef(null)
  const [skinId, setSkinId] = useState(readActiveSkinId)
  const [colors, setColors] = useState(getCharacterColors)
  // El aviso de girar y acercar se va con el primer gesto y ya no regresa.
  const [yaGiro, setYaGiro] = useState(false)
  // Con zoom aparece "Restablecer vista". Estado solo al cruzar el umbral:
  // el zoom en sí vive en el ref.
  const [conZoom, setConZoom] = useState(false)
  const conZoomRef = useRef(false)

  // ── Wallpaper ──────────────────────────────────────────────────────────
  // `sesion` invalida lo que llegue tarde de una hoja ya cerrada; `cola` pone
  // los pedidos en fila (el rig atiende uno a la vez).
  const [wall, setWall] = useState(false)
  const [sel, setSel] = useState('cuerpo')
  const [minis, setMinis] = useState({})
  const [listos, setListos] = useState({})
  const [fallo, setFallo] = useState(false)
  const sesion = useRef(0)
  const cola = useRef(Promise.resolve())
  const pidiendo = useRef(new Set())
  const urls = useRef([])

  const pedir = useCallback((opts) => {
    const p = cola.current.then(() => capturar(personalizaRef, opts))
    cola.current = p.catch(() => { })
    return p
  }, [personalizaRef])

  const hacer4K = useCallback((encuadre) => {
    if (pidiendo.current.has(encuadre)) return
    pidiendo.current.add(encuadre)
    const s = sesion.current
    setFallo(false)
    pedir({ encuadre })
      .then((r) => { if (sesion.current === s) setListos((prev) => ({ ...prev, [encuadre]: r })) })
      .catch(() => {
        pidiendo.current.delete(encuadre)
        if (sesion.current === s) setFallo(true)
      })
  }, [pedir])

  const soltarArchivos = () => {
    for (const u of urls.current) { try { URL.revokeObjectURL(u) } catch { } }
    urls.current = []
    pidiendo.current = new Set()
  }

  const abrirWall = () => {
    sesion.current += 1
    const s = sesion.current
    soltarArchivos()
    setMinis({})
    setListos({})
    setFallo(false)
    setSel('cuerpo')
    setWall(true)
    try { playSfx('click', { volume: 1.0 }) } catch { }
    for (const e of ENCUADRES) {
      pedir({ encuadre: e.id, ancho: MINI_ANCHO })
        .then(({ blob }) => {
          if (sesion.current !== s) return
          const url = URL.createObjectURL(blob)
          urls.current.push(url)
          setMinis((prev) => ({ ...prev, [e.id]: url }))
        })
        .catch(() => { })
    }
    hacer4K('cuerpo')
  }

  const cerrarWall = useCallback(() => {
    sesion.current += 1
    soltarArchivos()
    setWall(false)
    setMinis({})
    setListos({})
    requestAnimationFrame(() => { try { wallBtnRef.current?.focus({ preventScroll: true }) } catch { } })
  }, [])

  const elegirEncuadre = (id) => {
    setSel(id)
    if (!listos[id]) hacer4K(id)
  }

  const guardar = async () => {
    const r = listos[sel]
    if (!r) { if (fallo) hacer4K(sel); return }
    const nombre = `skulley-rad-wallpaper-${ENCUADRES.find((e) => e.id === sel)?.archivo || sel}.png`
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

  const marcarZoom = (v) => {
    if (conZoomRef.current === v) return
    conZoomRef.current = v
    setConZoom(v)
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
      if (wall) cerrarWall()
      marcarZoom(false)
      return undefined
    }
    setSkinId(readActiveSkinId())
    setColors(getCharacterColors())
    const id = requestAnimationFrame(() => { try { cerrarRef.current?.focus({ preventScroll: true }) } catch { } })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!wall) return undefined
    const id = requestAnimationFrame(() => {
      try { wallHojaRef.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }) } catch { }
    })
    return () => cancelAnimationFrame(id)
  }, [wall])

  useEffect(() => () => soltarArchivos(), [])

  useEffect(() => {
    const onChange = (e) => setColors(e?.detail ? { ...e.detail } : getCharacterColors())
    window.addEventListener(CHARACTER_COLOR_EVENT, onChange)
    return () => window.removeEventListener(CHARACTER_COLOR_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (wall) cerrarWall()
      else onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, wall, cerrarWall])

  // El rig encuadra a Skulley entre la orilla de arriba de la barra y el
  // panel. Los botones de la barra van en las esquinas y Skulley al centro,
  // así que no se estorban; el aviso sobre el panel tapa un poco los pies
  // hasta el primer gesto. Todo para que se vea lo más grande posible.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel || !personalizaRef) return undefined
    const medir = () => {
      const alto = Math.max(1, window.innerHeight)
      const barra = barraRef.current
      personalizaRef.current.abajo = panel.offsetHeight / alto
      if (barra) personalizaRef.current.arriba = barra.offsetTop / alto
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(panel)
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
  // hasta que se levantan todos (si no, Skulley daba un latigazo).
  const arrastre = useRef(null)
  const punteros = useRef(new Map())
  const pellizco = useRef(null)
  const soloZoom = useRef(false)
  const caja = useRef({ cx: 0, cy: 0, w: 1, h: 1 })

  const avisarGesto = () => setYaGiro(true)

  const medirCaja = (el) => {
    const r = el.getBoundingClientRect()
    caja.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: Math.max(1, r.width), h: Math.max(1, r.height) }
  }

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
  }

  const onDown = (e) => {
    const pz = personalizaRef?.current
    if (!pz) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { }
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
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
      return
    }
    const a = arrastre.current
    if (!a) return
    const dx = e.clientX - a.x
    a.x = e.clientX
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
    avisarGesto()
  }

  const listo = listos[sel]

  return (
    <div className={`mcz ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div
        className="mcz-escenario"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      />

      {/* Fuera del escenario: ahí el dedo captura el puntero y el toque no
          llegaría a los botones. Cerrar a la izquierda (pedido de Oscar) y,
          con zoom, Restablecer vista a la derecha. */}
      <div ref={barraRef} className="mcz-arriba">
        <button
          ref={cerrarRef}
          type="button"
          className={BOTON_HUD}
          onClick={() => onClose?.()}
          aria-label={t('customizer.close')}
          data-tip={t('customizer.close')}
          data-tip-side="bottom"
          tabIndex={open ? 0 : -1}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        {conZoom && (
          <button
            type="button"
            className={`${BOTON_HUD} mcz-restablecer`}
            onClick={restablecerVista}
            aria-label={t('customizer.resetView')}
            data-tip={t('customizer.resetView')}
            data-tip-side="bottom"
          >
            <ArrowsPointingInIcon className="w-5 h-5" />
          </button>
        )}
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
              live={open}
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

      {wall && (
        <div className="mcz-wall" onClick={(e) => { if (e.target === e.currentTarget) cerrarWall() }}>
          <section ref={wallHojaRef} className="mcz-wall-hoja" role="dialog" aria-modal="true" aria-label={t('customizer.wallpaper')}>
            <div className="mcz-cabeza">
              <h2 className="mcz-titulo">{t('customizer.wallpaper')}</h2>
              <button
                type="button"
                className={BOTON_HUD}
                onClick={cerrarWall}
                aria-label={t('customizer.close')}
                data-tip={t('customizer.close')}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="mcz-wall-opciones" role="radiogroup" aria-label={t('customizer.wallpaper')}>
              {ENCUADRES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={sel === e.id}
                  className={`mcz-wall-opcion ${sel === e.id ? 'is-on' : ''}`}
                  onClick={() => elegirEncuadre(e.id)}
                >
                  <span className="mcz-wall-mini">
                    {minis[e.id] && <img src={minis[e.id]} alt="" draggable="false" />}
                  </span>
                  <span className="mcz-wall-nombre">{t(e.label)}</span>
                </button>
              ))}
            </div>

            <div className="mcz-wall-pie">
              <p className="mcz-wall-dato" role="status">
                {fallo ? t('customizer.wallError') : listo ? `${listo.w} × ${listo.h} px` : t('customizer.wallMaking')}
              </p>
              <button
                type="button"
                className="shop-btn shop-btn--primary mcz-boton"
                onClick={guardar}
                disabled={!listo && !fallo}
                aria-busy={!listo && !fallo}
              >
                {fallo && !listo ? t('customizer.wallRetry') : t('customizer.wallSave')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
